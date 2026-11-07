'use strict';
/* Oto — downloads (sidebar card + manager), the Library panel, site routing, and the Oto Card */

// ================================================================ helpers
const fmtBytes = (n) => {
  if (!(n > 0)) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i >= 2 ? 1 : 0).replace(/\.0$/, '')} ${u[i]}`;
};
const fmtWhen = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const dayLabel = (ts) => {
  const d = new Date(ts), t = new Date();
  const diff = Math.floor((new Date(t.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: diff > 300 ? 'numeric' : undefined });
};
const extOf = (name) => { const m = /\.([a-z0-9]{1,5})$/i.exec(name || ''); return m ? m[1].toUpperCase() : 'FILE'; };
function groupByDay(list, tsKey) {
  const out = [];
  let cur = null;
  for (const x of list) {
    const lbl = dayLabel(x[tsKey]);
    if (!cur || cur.label !== lbl) { cur = { label: lbl, items: [] }; out.push(cur); }
    cur.items.push(x);
  }
  return out;
}

// ================================================================ downloads
const DL_LIVE = new Map(); // this session's download id -> record
const dlList = () => (S.downloads = S.downloads || []);
function dlSpeed(rec, d) {
  const now = Date.now();
  if (rec._t && d.received >= rec._r) {
    const inst = (d.received - rec._r) / Math.max(0.05, (now - rec._t) / 1000);
    rec.speed = rec.speed ? rec.speed * 0.7 + inst * 0.3 : inst;
  }
  rec._t = now; rec._r = d.received;
}
function onDownload(d) {
  let rec = DL_LIVE.get(d.id);
  if (!rec) {
    rec = { key: `${d.startedAt || Date.now()}-${d.id}`, id: d.id };
    DL_LIVE.set(d.id, rec);
    dlList().unshift(rec);
    if (S.downloads.length > 150) S.downloads.length = 150;
    dlCard.dismissed = false;
    dlBtn.recentAt = Date.now();
    renderDlButton();
    requestAnimationFrame(() => dlFly(d.cursor, d.name));
  }
  if (['progress', 'paused', 'started'].includes(d.state)) dlSpeed(rec, d);
  const { id, ...rest } = d;
  Object.assign(rec, rest);
  if (['completed', 'cancelled', 'interrupted'].includes(d.state)) {
    rec.speed = 0;
    DL_LIVE.delete(d.id);
    delete rec._t; delete rec._r;
    if (d.state === 'interrupted') toast(`Download failed — ${d.name}`, { icon: 'download' });
    dlCard.doneAt = Date.now();
    dlBtn.recentAt = Date.now();
    dlButtonDone(d.state === 'completed');
    save();
  }
  renderDlCard();
  renderDlButton();
  if (LIB.open && LIB.page === 'downloads') renderLibrary();
}
function dlActive() { return dlList().filter((r) => DL_LIVE.has(r.id) && ['started', 'progress', 'paused'].includes(r.state)); }
async function openDownload(r) {
  const res = await oto.dlOpen(r.path);
  if (res === 'missing') { r.missing = true; toast('That file was moved or deleted', { timeout: 1800 }); renderDlCard(); if (LIB.open) renderLibrary(); }
}
function dlIcon(r) {
  return r.icon ? h('img', { class: 'dl-ic', src: r.icon, alt: '' }) : h('span', { class: 'dl-ic ext' }, extOf(r.name).slice(0, 4));
}
function dlSub(r) {
  if (r.state === 'completed') return `${fmtBytes(r.total || r.received)} — ${hostOf(r.url) || 'file'}`;
  if (r.state === 'cancelled') return 'Cancelled';
  if (r.state === 'interrupted') return 'Failed';
  if (r.state === 'paused') return `Paused — ${fmtBytes(r.received)}${r.total ? ` of ${fmtBytes(r.total)}` : ''}`;
  const left = r.total && r.speed > 1 ? Math.max(1, Math.round((r.total - r.received) / r.speed)) : 0;
  const eta = left ? ` · ${left > 90 ? `${Math.round(left / 60)} min` : `${left} s`} left` : '';
  return `${fmtBytes(r.received)}${r.total ? ` of ${fmtBytes(r.total)}` : ''}${eta}`;
}

// The card at the bottom of the sidebar (like Zen's), showing the newest download.
const dlCard = { dismissed: false, doneAt: 0, timer: 0 };
function renderDlCard() {
  const card = $('#dlCard');
  if (!card) return;
  clearTimeout(dlCard.timer);
  const active = dlActive();
  const r = active[0] || dlList()[0];
  const recentDone = r && !DL_LIVE.has(r.id) && Date.now() - (r.doneAt || 0) < 15000;
  if (!r || dlCard.dismissed || (!active.length && !recentDone)) { card.hidden = true; card.replaceChildren(); return; }
  card.hidden = false;
  const pct = r.total ? Math.min(100, (r.received / r.total) * 100) : 0;
  const live = DL_LIVE.has(r.id);
  const btn = (ic, tip, run) => h('button', { class: 'icon-btn sm', title: tip, html: icon(ic), onclick: (e) => { e.stopPropagation(); run(); } });
  card.className = `dl-card${live ? ' live' : ''} st-${r.state}`;
  card.replaceChildren(...[
    h('div', { class: 'dl-row', title: r.state === 'completed' ? 'Open' : r.name, onclick: () => (r.state === 'completed' ? openDownload(r) : openLibrary('downloads')) },
      dlIcon(r),
      h('div', { class: 'dl-text' }, h('b', {}, r.name || 'Download'), h('small', {}, active.length > 1 ? `${active.length} downloads · ${dlSub(r)}` : dlSub(r))),
      live ? btn(r.state === 'paused' ? 'play' : 'pause', r.state === 'paused' ? 'Resume' : 'Pause', () => oto.dlAction(r.id, r.state === 'paused' ? 'resume' : 'pause')) : null,
      live ? btn('x', 'Cancel', () => oto.dlAction(r.id, 'cancel')) : null,
      !live && r.state === 'completed' ? btn('folder', 'Show in folder', () => oto.showInFolder(r.path)) : null,
      !live ? btn('x', 'Hide', () => { dlCard.dismissed = true; renderDlCard(); }) : null),
    live ? h('div', { class: 'dl-bar' }, h('span', { style: `width:${r.total ? pct : 30}%` })) : null].filter(Boolean));
  if (live && !r.total) card.classList.add('indeterminate');
  if (!live) dlCard.timer = setTimeout(() => { if (!card.matches(':hover')) renderDlCard(); else dlCard.timer = setTimeout(renderDlCard, 4000); }, 15200 - (Date.now() - (r.doneAt || 0)));
}

// ================================================================ downloads button + "fly" animation
// The button lives at the bottom of the sidebar while downloads are running or recent: a tray with an
// arrow inside a progress ring. When a download starts, a glowing orb arcs from the cursor into it.
const dlBtn = { recentAt: 0, doneT: 0, hideT: 0 };
const dlbSvg = (inner) => `<svg class="dlb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <circle class="dlb-track" cx="12" cy="12" r="10.3"/>
  <circle class="dlb-ring" cx="12" cy="12" r="10.3" pathLength="100" transform="rotate(-90 12 12)"/>
  ${inner}
  <path class="dlb-check" pathLength="1" d="M8.2 12.3l2.6 2.6 5-5.4"/>
</svg><span class="dlb-badge"></span>`;
// Downloads button icon styles (Settings → General → Downloads).
const DL_ICONS = {
  tray: dlbSvg('<g class="dlb-arrow"><path d="M12 6.2v7.6M8.9 10.9l3.1 3.1 3.1-3.1"/></g><path class="dlb-tray" d="M7.2 14.6v1.5a1.9 1.9 0 0 0 1.9 1.9h5.8a1.9 1.9 0 0 0 1.9-1.9v-1.5"/>'),
  arrow: dlbSvg('<g class="dlb-arrow"><path d="M12 6v10M7.8 12 12 16.2l4.2-4.2"/></g><path class="dlb-tray" d="M8 18.2h8"/>'),
  cloud: dlbSvg('<path class="dlb-tray" d="M8.3 15.6a3 3 0 0 1-.4-6 4.2 4.2 0 0 1 8.1-.6 2.9 2.9 0 0 1 .3 5.8" opacity=".9"/><g class="dlb-arrow"><path d="M12 10.5v7M9.8 15.4 12 17.6l2.2-2.2"/></g>'),
  box: dlbSvg('<path class="dlb-tray" d="M6.8 10.8h10.4v5.6a1.8 1.8 0 0 1-1.8 1.8H8.6a1.8 1.8 0 0 1-1.8-1.8z"/><g class="dlb-arrow"><path d="M12 5.6v7.2M9.6 10.4 12 12.8l2.4-2.4"/></g>'),
};
const DL_BTN_SVG = DL_ICONS.tray;
function renderDlButton() {
  const b = $('#btnDownloads');
  if (!b) return;
  const style = DL_ICONS[S.settings.dlIcon] ? S.settings.dlIcon : 'tray';
  if (b.dataset.icon !== style) { b.innerHTML = DL_ICONS[style]; b.dataset.icon = style; }
  const active = dlActive();
  const recent = Date.now() - (dlBtn.recentAt || 0) < 10 * 60 * 1000;
  b.hidden = !active.length && !recent && !b.classList.contains('done');
  b.classList.toggle('active', active.length > 0);
  const tot = active.reduce((a, r) => a + (r.total || 0), 0);
  const got = active.reduce((a, r) => a + (r.received || 0), 0);
  b.classList.toggle('indet', active.length > 0 && !tot);
  const ring = b.querySelector('.dlb-ring');
  if (ring) ring.style.strokeDasharray = `${active.length ? (tot ? Math.max(3, (got / tot) * 100) : 26) : 0} 100`;
  const badge = b.querySelector('.dlb-badge');
  if (badge) { badge.textContent = active.length > 1 ? String(active.length) : ''; badge.hidden = active.length < 2; }
  b.title = active.length ? `${active.length} download${active.length > 1 ? 's' : ''} — ${dlSub(active[0])}` : 'Downloads (Ctrl+J)';
  clearTimeout(dlBtn.hideT);
  if (!active.length && recent) dlBtn.hideT = setTimeout(renderDlButton, 10 * 60 * 1000 - (Date.now() - dlBtn.recentAt) + 50);
}
function dlButtonDone(ok) {
  const b = $('#btnDownloads');
  if (!b) return;
  b.classList.remove('done', 'failed');
  void b.offsetWidth;
  b.classList.add(ok ? 'done' : 'failed');
  clearTimeout(dlBtn.doneT);
  dlBtn.doneT = setTimeout(() => { b.classList.remove('done', 'failed'); renderDlButton(); }, 2200);
}
function dlTarget() {
  const b = $('#btnDownloads');
  const sb = $('#sidebar').getBoundingClientRect();
  if (b && !b.hidden) {
    const r = b.getBoundingClientRect();
    if (r.width > 0 && r.left >= sb.left - 1 && r.right <= sb.right + 1 && r.bottom <= innerHeight) return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: b };
  }
  // Sidebar hidden / collapsed: land in the bottom corner on the sidebar's side.
  return { x: S.settings.sidebarSide === 'right' ? innerWidth - 26 : 26, y: innerHeight - 26, el: null };
}
function dlRipple(x, y, cls = '') {
  const r = h('div', { class: `dl-ripple ${cls}`, style: `left:${x}px;top:${y}px` });
  document.body.append(r);
  r.addEventListener('animationend', () => r.remove());
}
function dlFly(from, fromName = '') {
  const tgt = dlTarget();
  const catchIt = () => {
    dlRipple(tgt.x, tgt.y);
    if (tgt.el) { tgt.el.classList.remove('catch'); void tgt.el.offsetWidth; tgt.el.classList.add('catch'); setTimeout(() => tgt.el.classList.remove('catch'), 700); }
  };
  const look = S.settings.dlAnim || 'file';
  if (!animOn() || look === 'off') { catchIt(); return; }
  const c = $('#content').getBoundingClientRect();
  let sx = from && from.x >= 0 && from.y >= 0 && from.x <= innerWidth && from.y <= innerHeight ? from.x : c.left + c.width / 2;
  let sy = from && from.x >= 0 && from.y >= 0 && from.x <= innerWidth && from.y <= innerHeight ? from.y : c.top + c.height / 2;
  const tx = tgt.x, ty = tgt.y;
  // A lifted arc: the control point sits above the higher end, pulled toward the target.
  const cx = sx + (tx - sx) * 0.35, cy = Math.min(sy, ty) - Math.min(220, 60 + Math.hypot(tx - sx, ty - sy) * 0.28);
  const N = 28, SIZE = 46;
  const frames = (scale0, scale1, spin) => Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N, u = 1 - t;
    const x = u * u * sx + 2 * u * t * cx + t * t * tx;
    const y = u * u * sy + 2 * u * t * cy + t * t * ty;
    const s = scale0 + (scale1 - scale0) * Math.pow(t, 1.3);
    return { transform: `translate(${(x - SIZE / 2).toFixed(1)}px, ${(y - SIZE / 2).toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${(spin * t).toFixed(1)}deg)`, offset: t };
  });
  dlRipple(sx, sy, 'start');
  const orb = look === 'orb'
    ? h('div', { class: 'dl-orb', html: '<span class="dl-orb-ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5v10M7.8 11.6 12 15.8l4.2-4.2"/><path d="M7 19h10" opacity=".7"/></svg>' })
    // a little file — a page with a folded corner showing the file type
    : h('div', { class: 'dl-file', html: `<svg viewBox="0 0 46 46"><defs><linearGradient id="dlfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ece9f6"/></linearGradient></defs><path d="M11 4h17l10 10v26a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill="url(#dlfg)"/><path d="M28 4v7a3 3 0 0 0 3 3h7" fill="#d7d2ea"/><rect class="dlf-tag" x="5" y="24" width="${Math.max(24, 8 + extOf(fromName).slice(0, 4).length * 7)}" height="13" rx="3.5"/><text x="${5 + Math.max(24, 8 + extOf(fromName).slice(0, 4).length * 7) / 2}" y="33.6" text-anchor="middle">${esc(extOf(fromName).slice(0, 4))}</text></svg>` });
  document.body.append(orb);
  const spawn = orb.animate([
    { transform: `translate(${sx - SIZE / 2}px, ${sy - SIZE / 2}px) scale(.2)`, opacity: 0 },
    { transform: `translate(${sx - SIZE / 2}px, ${sy - SIZE / 2}px) scale(1.18)`, opacity: 1, offset: 0.6 },
    { transform: `translate(${sx - SIZE / 2}px, ${sy - SIZE / 2}px) scale(1)`, opacity: 1 },
  ], { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' });
  spawn.onfinish = () => {
    const dur = 780;
    const fly = orb.animate(frames(1, 0.34, 26), { duration: dur, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'forwards' });
    // Sparks trailing behind the orb.
    for (let i = 1; i <= 6; i++) {
      const sp = h('div', { class: 'dl-spark' });
      document.body.append(sp);
      const a = sp.animate(frames(0.55 - i * 0.05, 0.12, 0), { duration: dur, delay: i * 38, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'both' });
      sp.animate([{ opacity: 0.9 - i * 0.1 }, { opacity: 0 }], { duration: dur, delay: i * 38, fill: 'both' });
      a.onfinish = () => sp.remove();
    }
    fly.onfinish = () => { orb.remove(); catchIt(); };
  };
}

// ================================================================ routing (Arc's "Air Traffic Control", Oto-style)
// Links that arrive from other apps or open in a new tab go to the space you chose for that site.
const routeFor = (url) => {
  const host = hostOf(url);
  if (!host) return null;
  return (S.routes || []).find((r) => r.on !== false && r.host && (host === r.host || host.endsWith(`.${r.host}`)) && S.workspaces.some((w) => w.id === r.ws)) || null;
};
function routedOpen(url, opts = {}) {
  const r = routeFor(url);
  if (r && r.ws !== S.activeWs) {
    switchWorkspace(r.ws);
    const w = S.workspaces.find((x) => x.id === r.ws);
    toast(`Opened in ${w ? w.name : 'its space'}`, { icon: 'move', timeout: 1600 });
    return newTab(url, { ...opts, background: false, opener: null });
  }
  return newTab(url, opts);
}

// ================================================================ stats (for the card)
let statsSaveT = 0;
function bumpStat(key, n = 1) {
  S.stats = S.stats || {};
  S.stats[key] = (S.stats[key] || 0) + n;
  if (!statsSaveT) statsSaveT = setTimeout(() => { statsSaveT = 0; save(); }, 5000);
}
function ensureSince() {
  if (S.since) return;
  const oldest = Math.min(Date.now(), ...S.tabs.map((t) => t.lastActive || Date.now()), ...(S.history || []).slice(-1).map((x) => x.ts || Date.now()));
  S.since = oldest;
}

// ================================================================ the Oto Card
const CARD_ART = {
  orbit: 'Orbit', waves: 'Waves', bloom: 'Bloom', rings: 'Rings', grid: 'Dots', aurora: 'Aurora', peaks: 'Peaks',
};
const CARD_STYLES = { night: 'Neon', holo: 'Holo', tinted: 'Tinted', paper: 'Ivory' };
const CARD_FONTS = {
  sans: ['Modern', '"Segoe UI Variable Display", "Segoe UI", Inter, system-ui, sans-serif'],
  mono: ['Mono', '"Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace'],
  serif: ['Serif', 'Georgia, "Times New Roman", serif'],
  tech: ['Tech', 'Bahnschrift, "DIN Alternate", "Segoe UI", sans-serif'],
};
const CARD_TITLES = ['Calm Explorer', 'Tab Tamer', 'Space Cadet', 'Night Surfer', 'Pixel Pilot', 'Bookmark Hoarder', 'Ad Slayer', 'Gradient Wizard', 'Speed Demon', 'Quiet Genius'];
const CARD_STATS = { days: 'Days with Oto', blocked: 'Ads blocked', pages: 'Pages visited', spaces: 'Spaces', bookmarks: 'Bookmarks', tabs: 'Open tabs' };

function cardModel() {
  S.card = S.card || {};
  const c = S.card;
  if (!c.no) c.no = String(1 + Math.floor(Math.random() * 9998)).padStart(4, '0');
  if (c.seed == null) c.seed = Math.floor(Math.random() * 1e6);
  return {
    name: c.name ?? (S.settings.userName || 'Oto user'),
    title: c.title ?? 'Calm Explorer',
    colors: c.colors || null, // null = match the current space
    design: c.design || 'keycard', art: c.art || 'orbit', style: c.style || 'night', font: c.font || (c.design === 'classic' || c.design === 'shiny' ? 'sans' : 'tech'),
    grain: c.grain ?? 0.35, stats: c.stats || ['days', 'blocked', 'spaces'], showStats: c.showStats !== false,
    seed: c.seed, no: c.no,
  };
}
function cardStatValue(k) {
  const st = S.stats || {};
  switch (k) {
    case 'days': return Math.max(1, Math.ceil((Date.now() - (S.since || Date.now())) / 864e5));
    case 'blocked': return st.blocked || 0;
    case 'pages': return (st.pages || 0) || (S.history || []).length;
    case 'spaces': return S.workspaces.length;
    case 'bookmarks': return typeof allBookmarks === 'function' ? allBookmarks().length : 0;
    case 'tabs': return S.tabs.length;
    default: return 0;
  }
}
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// The Oto mark on cards: the white hole (tilted rings around a bright core), in a 64×64 box.
function cardVortex(stroke, sw = 3) {
  const rings = [10, 16, 22, 28].map((r, i) => `<ellipse cx="32" cy="32" rx="${r}" ry="${(r * 0.46).toFixed(1)}" stroke-width="${(sw * (1 - i * 0.18)).toFixed(2)}" opacity="${(1 - i * 0.2).toFixed(2)}"/>`).join('');
  return `<g fill="none" stroke="${stroke}" transform="rotate(-6 32 32)">${rings}</g><circle cx="32" cy="32" r="${(sw * 1.5).toFixed(1)}" fill="${stroke}"/>`;
}

function cardArt(m, cols, W, H, id) {
  const r = rng(m.seed);
  const white = (o) => `rgba(255,255,255,${o})`;
  switch (m.art) {
    case 'orbit': {
      const cx = W * (0.55 + r() * 0.15), cy = H * (0.5 + r() * 0.1), R = H * 0.62;
      const inf = 'M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z';
      return `<g fill="none" stroke="${white(0.55)}" stroke-linecap="round">
        <circle cx="${cx}" cy="${cy}" r="${R}" stroke-width="10" stroke-dasharray="${R * 5.2} ${R * 1.1}" transform="rotate(${-40 + r() * 30} ${cx} ${cy})"/>
        <circle cx="${cx}" cy="${cy}" r="${R * 0.78}" stroke-width="2" opacity=".6"/>
        </g><g transform="translate(${cx - R * 0.9} ${cy - R * 0.9}) scale(${(R * 1.8) / 64})">${cardVortex(white(0.75), 1.6)}</g>`;
    }
    case 'waves': {
      let out = '';
      for (let i = 0; i < 6; i++) {
        const y = H * (0.25 + i * 0.13), a = 10 + r() * 22, ph = r() * W;
        let d = `M0 ${y}`;
        for (let x = 0; x <= W; x += 12) d += ` L${x} ${(y + Math.sin((x + ph) / (38 + i * 6)) * a).toFixed(1)}`;
        out += `<path d="${d} L${W} ${H} L0 ${H}Z" fill="${white(0.08 + i * 0.025)}"/>`;
      }
      return out;
    }
    case 'bloom': {
      let out = `<defs><filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter></defs><g filter="url(#${id}b)">`;
      for (let i = 0; i < 5; i++) out += `<circle cx="${r() * W}" cy="${r() * H}" r="${40 + r() * 70}" fill="${cols[i % cols.length]}" opacity=".9"/>`;
      return `${out}<circle cx="${r() * W}" cy="${r() * H}" r="60" fill="#fff" opacity=".35"/></g>`;
    }
    case 'rings': {
      const cx = r() * W, cy = H * (0.2 + r() * 0.6);
      let out = '<g fill="none">';
      for (let i = 1; i < 12; i++) out += `<circle cx="${cx}" cy="${cy}" r="${i * 22}" stroke="${white(0.42 - i * 0.03)}" stroke-width="${i % 3 ? 1.5 : 4}"/>`;
      return `${out}</g>`;
    }
    case 'grid': {
      let out = '';
      const ox = r() * W, oy = r() * H;
      for (let y = 10; y < H; y += 16) for (let x = 10; x < W; x += 16) {
        const d = Math.hypot(x - ox, y - oy);
        const s = Math.max(0.6, 4.2 - d / 55);
        out += `<circle cx="${x}" cy="${y}" r="${s.toFixed(2)}" fill="${white(0.55)}"/>`;
      }
      return out;
    }
    case 'aurora': {
      let out = `<defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="${id}f"><feGaussianBlur stdDeviation="6"/></filter></defs><g filter="url(#${id}f)">`;
      for (let i = 0; i < 9; i++) { const x = r() * W, w = 8 + r() * 26; out += `<rect x="${x}" y="${-20 + r() * 30}" width="${w}" height="${H * (0.7 + r() * 0.5)}" rx="${w / 2}" fill="url(#${id}a)" opacity="${0.4 + r() * 0.5}" transform="skewX(${-18 + r() * 10})"/>`; }
      return `${out}</g>`;
    }
    case 'peaks': {
      let out = '';
      for (let i = 0; i < 4; i++) {
        const base = H * (0.55 + i * 0.12);
        let d = `M0 ${H} L0 ${base}`;
        let x = 0;
        while (x < W) { const nx = x + 30 + r() * 50; d += ` L${(x + nx) / 2} ${base - 20 - r() * (70 - i * 12)} L${nx} ${base}`; x = nx; }
        out += `<path d="${d} L${W} ${H}Z" fill="${i % 2 ? 'rgba(0,0,0,.14)' : white(0.16 + i * 0.05)}"/>`;
      }
      return out;
    }
    default: return '';
  }
}

// The Oto Card is a cyberpunk access keycard: chamfered corners, a lanyard slot, a neon edge, a chip,
// a holo sticker, scanlines over the artwork, a data readout and a barcode — all generated from your settings.
function cardSvgClassic(m = cardModel(), { scale = 1 } = {}) {
  const W = 320, H = 460, P = 18;
  const id = `oc${Math.floor(Math.random() * 1e6)}`;
  const cols = (m.colors && m.colors.length ? m.colors : themeOf(currentWs()).colors).slice(0, 3);
  const c3 = cols.length === 1 ? [cols[0], mix(cols[0], '#ffffff', 0.35)] : cols;
  const theme = {
    paper: { bg: '#fbf8f1', ink: '#1d1b26', sub: '#5d5a6b', line: 'rgba(29,27,38,.18)' },
    night: { bg: '#111019', ink: '#f6f4ff', sub: '#a8a3c2', line: 'rgba(255,255,255,.16)' },
    tinted: { bg: mix(c3[0], '#ffffff', 0.86), ink: mix(c3[0], '#111111', 0.82), sub: mix(c3[0], '#333333', 0.55), line: 'rgba(0,0,0,.14)' },
  }[m.style === 'holo' ? 'paper' : m.style] || {};
  const font = (CARD_FONTS[m.font] || CARD_FONTS.sans)[1].replace(/"/g, "'");
  const mono = CARD_FONTS.mono[1].replace(/"/g, "'");
  const AW = W - P * 2, AH = 232;
  const stops = c3.map((c, i) => `<stop offset="${(i / (c3.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const nameSize = m.name.length > 16 ? 24 : m.name.length > 11 ? 29 : 34;
  const since = new Date(S.since || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const stats = m.showStats ? m.stats.slice(0, 3).map((k, i) => {
    const x = P + i * (AW / 3);
    return `<text x="${x}" y="368" font-family="${font}" font-size="20" font-weight="700" fill="${theme.ink}">${esc(compact(cardStatValue(k)))}</text>
      <text x="${x}" y="384" font-family="${mono}" font-size="8.5" letter-spacing=".8" fill="${theme.sub}">${esc(CARD_STATS[k].toUpperCase())}</text>`;
  }).join('') : '';
  const mark = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 64})">${cardVortex(theme.ink, 4)}</g>`;
  const grain = m.grain > 0.02 ? `<rect x="${P}" y="${P}" width="${AW}" height="${AH}" rx="14" filter="url(#${id}n)" opacity="${(m.grain * 0.9).toFixed(2)}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
    <clipPath id="${id}c"><rect x="${P}" y="${P}" width="${AW}" height="${AH}" rx="14"/></clipPath>
    <filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.32"/></filter>
  </defs>
  <rect width="${W}" height="${H}" rx="22" fill="${theme.bg}"/>
  <g clip-path="url(#${id}c)">
    <rect x="${P}" y="${P}" width="${AW}" height="${AH}" fill="url(#${id}g)"/>
    <g transform="translate(${P} ${P})">${cardArt(m, c3, AW, AH, id)}</g>
    ${grain}
  </g>
  <text x="${P}" y="${P + AH + 46}" font-family="${font}" font-size="${nameSize}" font-weight="700" letter-spacing="-.5" fill="${theme.ink}">${esc(m.name || ' ')}</text>
  <text x="${P}" y="${P + AH + 66}" font-family="${mono}" font-size="11" letter-spacing="2" fill="${theme.sub}">${esc((m.title || '').toUpperCase())}</text>
  ${stats}
  <line x1="${P}" y1="404" x2="${W - P}" y2="404" stroke="${theme.line}"/>
  <rect x="${P}" y="418" width="${Math.round(56 + `SINCE ${since}`.length * 6.25)}" height="24" rx="6" fill="none" stroke="${theme.ink}" stroke-opacity=".75"/>
  <text x="${P + 9}" y="434" font-family="${mono}" font-size="10" font-weight="700" fill="${theme.ink}">OTO</text>
  <line x1="${P + 38}" y1="418" x2="${P + 38}" y2="442" stroke="${theme.ink}" stroke-opacity=".5"/>
  <text x="${P + 46}" y="434" font-family="${mono}" font-size="10" fill="${theme.ink}">SINCE ${esc(since.toUpperCase())}</text>
  <text x="${W - P - 30}" y="434" text-anchor="end" font-family="${mono}" font-size="10" fill="${theme.sub}">Nº ${esc(m.no)}</text>
  ${mark(W - P - 24, 418, 24)}
</svg>`;
}

// A shiny holographic trading card: metallic frame, foil artwork with sparkles, a rarity row,
// stats as "abilities" and a light sweep. In the Library preview it tilts and the foil follows the mouse.
function cardSvgShiny(m = cardModel(), { scale = 1 } = {}) {
  const W = 320, H = 460;
  const id = `os${Math.floor(Math.random() * 1e6)}`;
  const cols = (m.colors && m.colors.length ? m.colors : themeOf(currentWs()).colors).slice(0, 3);
  const c3 = cols.length === 1 ? [cols[0], mix(cols[0], '#ffffff', 0.35)] : cols;
  const frames = {
    night: ['#3a3d4a', '#d9dce6', '#5b5f70', '#f4f6ff', '#2c2f3a'],
    holo: ['#ff9de2', '#9df3ff', '#c5ff9d', '#ffd79d', '#d6a8ff'],
    tinted: [mix(c3[0], '#000', 0.3), mix(c3[0], '#fff', 0.55), c3[0], mix(c3[c3.length - 1], '#fff', 0.6), mix(c3[c3.length - 1], '#000', 0.25)],
    paper: ['#8a6a1f', '#f6e7a6', '#c9a24a', '#fff4c9', '#9c7a2a'],
  };
  const fr = frames[m.style] || frames.night;
  const ink = '#ffffff', sub = 'rgba(255,255,255,.75)';
  const font = (CARD_FONTS[m.font] || CARD_FONTS.sans)[1].replace(/"/g, "'");
  const mono = CARD_FONTS.mono[1].replace(/"/g, "'");
  const r = rng(m.seed + 13);
  const stops = c3.map((c, i) => `<stop offset="${(i / (c3.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const AX = 22, AY = 62, AW = W - 44, AH = 206;
  const name = m.name || ' ';
  const nameSize = name.length > 16 ? 17 : name.length > 11 ? 20 : 23;
  const stars = Math.min(5, 1 + Math.floor(Math.log10(1 + cardStatValue('blocked'))) + (S.workspaces.length > 2 ? 1 : 0));
  const since = new Date(S.since || Date.now()).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const star4 = (x, y, s, o) => `<path d="M${x} ${y - s}C${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}C${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}C${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}C${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z" fill="#fff" opacity="${o}"/>`;
  let sparkles = '';
  for (let i = 0; i < 9; i++) sparkles += star4(AX + r() * AW, AY + r() * AH, 3 + r() * 7, (0.5 + r() * 0.5).toFixed(2));
  const rows = m.showStats ? m.stats.slice(0, 3).map((k, i) => {
    const y = 318 + i * 26;
    return `<circle cx="34" cy="${y - 4}" r="7" fill="url(#${id}f)"/><text x="48" y="${y}" font-family="${font}" font-size="12.5" font-weight="600" fill="${ink}">${esc(CARD_STATS[k])}</text>
      <text x="${W - 30}" y="${y}" text-anchor="end" font-family="${font}" font-size="15" font-weight="800" fill="${ink}">${esc(compact(cardStatValue(k)))}</text>
      ${i < Math.min(3, m.stats.length) - 1 ? `<line x1="28" y1="${y + 9}" x2="${W - 28}" y2="${y + 9}" stroke="rgba(255,255,255,.18)"/>` : ''}`;
  }).join('') : `<text x="${W / 2}" y="350" text-anchor="middle" font-family="${font}" font-size="13" font-style="italic" fill="${sub}">“A calm browser for a busy web.”</text>`;
  const markPath = 'M44.5 15.2 A21 21 0 1 0 49.6 21.3';
  const infPath = 'M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z';
  const grain = m.grain > 0.02 ? `<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" filter="url(#${id}n)" opacity="${(m.grain * 0.9).toFixed(2)}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}">
  <defs>
    <linearGradient id="${id}fr" x1="0" y1="0" x2="1" y2="1">${fr.map((c, i) => `<stop offset="${(i / (fr.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c3[0], '#0b0a14', 0.55)}"/><stop offset="1" stop-color="${mix(c3[c3.length - 1], '#07060d', 0.7)}"/></linearGradient>
    <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9de2"/><stop offset=".33" stop-color="#9df3ff"/><stop offset=".66" stop-color="#c5ff9d"/><stop offset="1" stop-color="#ffd79d"/></linearGradient>
    <linearGradient id="${id}foil" x1="0" y1="0" x2="1" y2=".6" spreadMethod="repeat" gradientTransform="scale(.35)">
      <stop offset="0" stop-color="#ff7ad9"/><stop offset=".2" stop-color="#7af0ff"/><stop offset=".4" stop-color="#b4ff7a"/><stop offset=".6" stop-color="#ffe27a"/><stop offset=".8" stop-color="#c58bff"/><stop offset="1" stop-color="#ff7ad9"/></linearGradient>
    <linearGradient id="${id}shine" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".1"/><stop offset=".56" stop-color="#fff" stop-opacity=".35"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}a"><rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="10"/></clipPath>
    <clipPath id="${id}c"><rect width="${W}" height="${H}" rx="20"/></clipPath>
    <filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.32"/></filter>
  </defs>
  <g clip-path="url(#${id}c)">
    <rect width="${W}" height="${H}" rx="20" fill="url(#${id}fr)"/>
    <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="14" fill="url(#${id}bg)"/>
    <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="14" fill="url(#${id}foil)" opacity=".14" style="mix-blend-mode:color-dodge"/>
    <rect x="9.5" y="9.5" width="${W - 19}" height="${H - 19}" rx="13.5" fill="none" stroke="rgba(255,255,255,.35)"/>
    <text x="24" y="44" font-family="${font}" font-size="${nameSize}" font-weight="800" fill="${ink}">${esc(name)}</text>
    <g transform="translate(${W - 24} 30)">${Array.from({ length: 5 }, (_, i) => `<path transform="translate(${-i * 13 - 6} 0) scale(.55)" d="M0-10 2.9-3.1 10-3.1 4.3 1.2 6.4 8.1 0 4 -6.4 8.1 -4.3 1.2 -10-3.1 -2.9-3.1Z" fill="${4 - i < stars ? 'url(#' + id + 'f)' : 'rgba(255,255,255,.22)'}"/>`).join('')}</g>
    <text x="${W - 24}" y="51" text-anchor="end" font-family="${mono}" font-size="7.5" letter-spacing="2" fill="${sub}">HOLO · Nº ${esc(m.no)}</text>
    <g clip-path="url(#${id}a)">
      <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}g)"/>
      <g transform="translate(${AX} ${AY})">${cardArt(m, c3, AW, AH, id)}</g>
      ${grain}
      <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}foil)" opacity=".38" style="mix-blend-mode:overlay"/>
      ${sparkles}
    </g>
    <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="10" fill="none" stroke="url(#${id}fr)" stroke-width="3"/>
    <rect x="${W / 2 - 78}" y="${AY + AH - 2}" width="156" height="22" rx="11" fill="url(#${id}fr)"/>
    <text x="${W / 2}" y="${AY + AH + 13}" text-anchor="middle" font-family="${mono}" font-size="9.5" font-weight="700" letter-spacing="1.6" fill="#14121f">${esc((m.title || 'Oto user').toUpperCase().slice(0, 22))}</text>
    ${rows}
    <line x1="24" y1="${H - 50}" x2="${W - 24}" y2="${H - 50}" stroke="rgba(255,255,255,.2)"/>
    <text x="24" y="${H - 30}" font-family="${mono}" font-size="8.5" letter-spacing="1.4" fill="${sub}">OTO · SINCE ${esc(since)}</text>
    <g transform="translate(${W - 46} ${H - 44}) scale(${22 / 64})">${cardVortex(`url(#${id}f)`, 4.5)}</g>
    <rect width="${W}" height="${H}" fill="url(#${id}shine)" style="mix-blend-mode:soft-light" opacity=".9"/>
    <rect width="${W}" height="${H}" fill="url(#${id}shine)" opacity=".25"/>
  </g>
</svg>`;
}
const CARD_DESIGNS = { keycard: 'Keycard', classic: 'Classic', shiny: 'Shiny' };

function cardSvg(m = cardModel(), opts = {}) {
  if (m.design === 'classic') return cardSvgClassic(m, opts);
  if (m.design === 'shiny') return cardSvgShiny(m, opts);
  return cardSvgKeycard(m, opts);
}
function cardSvgKeycard(m = cardModel(), { scale = 1 } = {}) {
  const W = 320, H = 504, P = 18, C = 28, R = 10;
  const id = `oc${Math.floor(Math.random() * 1e6)}`;
  const cols = (m.colors && m.colors.length ? m.colors : themeOf(currentWs()).colors).slice(0, 3);
  const c3 = cols.length === 1 ? [cols[0], mix(cols[0], '#ffffff', 0.35)] : cols;
  const neonA = c3[0], neonB = c3[c3.length - 1];
  const T = {
    night: { bg1: '#0e0d1a', bg2: '#05050a', ink: '#ecfbff', sub: 'rgba(205,228,255,.62)', line: 'rgba(255,255,255,.12)', grid: 'rgba(255,255,255,.035)', glow: true, glitch: true },
    holo: { bg1: '#e6ecff', bg2: '#f7e3ff', ink: '#14121f', sub: 'rgba(20,18,31,.6)', line: 'rgba(20,18,31,.16)', grid: 'rgba(20,18,31,.05)', glow: true, glitch: true, holo: true },
    tinted: { bg1: mix(c3[0], '#0a0a12', 0.78), bg2: mix(neonB, '#050508', 0.9), ink: '#ffffff', sub: 'rgba(255,255,255,.66)', line: 'rgba(255,255,255,.15)', grid: 'rgba(255,255,255,.04)', glow: true, glitch: true },
    paper: { bg1: '#f1eee6', bg2: '#e6e2d6', ink: '#16141f', sub: 'rgba(22,20,31,.58)', line: 'rgba(22,20,31,.16)', grid: 'rgba(22,20,31,.04)', glow: false, glitch: false },
  }[m.style] || {};
  const font = (CARD_FONTS[m.font] || CARD_FONTS.tech)[1].replace(/"/g, "'");
  const mono = CARD_FONTS.mono[1].replace(/"/g, "'");
  const r = rng(m.seed + 7);
  const shape = `M${R} 0H${W - C}L${W} ${C}V${H - R}Q${W} ${H} ${W - R} ${H}H${C}L0 ${H - C}V${R}Q0 0 ${R} 0Z`;
  // artwork window with its own cut corner
  const AX = P, AY = 56, AW = W - P * 2, AH = 196, AC = 18;
  const art = `M${AX + AC} ${AY}H${AX + AW}V${AY + AH}H${AX}V${AY + AC}Z`;
  const stops = c3.map((c, i) => `<stop offset="${(i / (c3.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const name = (m.name || ' ').toUpperCase();
  const nameSize = name.length > 15 ? 22 : name.length > 11 ? 27 : 32;
  const d = new Date(S.since || Date.now());
  const since = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
  // barcode from the name + seed
  let bars = '';
  let hsh = [...(m.name || 'oto')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, m.seed >>> 0);
  for (let x = 0; x < 150;) { hsh = (hsh * 1103515245 + 12345) >>> 0; const w = 1 + (hsh % 3); if ((hsh >> 3) % 3) bars += `<rect x="${P + x}" y="440" width="${w}" height="30"/>`; x += w + 1 + ((hsh >> 5) % 2); }
  const statsY = 378;
  const stats = m.showStats ? m.stats.slice(0, 3).map((k, i) => {
    const bw = (AW - 12) / 3, x = P + i * (bw + 6);
    return `<g><path d="M${x} ${statsY}h${bw - 8}l8 8v${30 - 8}H${x}Z" fill="none" stroke="${T.line}"/>
      <text x="${x + 7}" y="${statsY + 12}" font-family="${mono}" font-size="6.8" letter-spacing="1" fill="${T.sub}">${esc(CARD_STATS[k].toUpperCase())}</text>
      <text x="${x + 7}" y="${statsY + 27}" font-family="${mono}" font-size="13" font-weight="700" fill="${T.ink}">${esc(String(compact(cardStatValue(k))).padStart(3, '0'))}</text></g>`;
  }).join('') : `<text x="${P}" y="${statsY + 20}" font-family="${mono}" font-size="9" letter-spacing="2" fill="${T.sub}">// CLEARANCE GRANTED</text>`;
  const markPath = 'M44.5 15.2 A21 21 0 1 0 49.6 21.3';
  const infPath = 'M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z';
  const mark = (x, y, sz, stroke) => `<g transform="translate(${x} ${y}) scale(${sz / 64})">${cardVortex(stroke, 4)}</g>`;
  const grain = m.grain > 0.02 ? `<path d="${art}" filter="url(#${id}n)" opacity="${(m.grain * 0.9).toFixed(2)}"/>` : '';
  const nameY = 334;
  const glitch = T.glitch ? `<text x="${P - 1.6}" y="${nameY}" font-family="${font}" font-size="${nameSize}" font-weight="800" letter-spacing="1" fill="#22d3ee" opacity=".55">${esc(name)}</text>
    <text x="${P + 1.6}" y="${nameY + 0.6}" font-family="${font}" font-size="${nameSize}" font-weight="800" letter-spacing="1" fill="#f0f" opacity=".42">${esc(name)}</text>` : '';
  const ticks = Array.from({ length: 14 }, (_, i) => `<rect x="${W - 7}" y="${150 + i * 9}" width="${i % 4 ? 3 : 5}" height="1.4" fill="${T.sub}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
    <linearGradient id="${id}bg" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${T.bg1}"/><stop offset="1" stop-color="${T.bg2}"/></linearGradient>
    <linearGradient id="${id}edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${neonA}"/><stop offset=".5" stop-color="${mix(neonA, neonB, 0.5)}"/><stop offset="1" stop-color="${neonB}"/></linearGradient>
    <linearGradient id="${id}chip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e3a1"/><stop offset=".5" stop-color="#c9a24a"/><stop offset="1" stop-color="#f3d98b"/></linearGradient>
    <linearGradient id="${id}holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9de2"/><stop offset=".33" stop-color="#9df3ff"/><stop offset=".66" stop-color="#c5ff9d"/><stop offset="1" stop-color="#ffd79d"/></linearGradient>
    <pattern id="${id}scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".22"/></pattern>
    <pattern id="${id}grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="${T.grid}"/></pattern>
    <clipPath id="${id}a"><path d="${art}"/></clipPath>
    <mask id="${id}m"><rect width="${W}" height="${H}" fill="#fff"/><rect x="${W / 2 - 30}" y="13" width="60" height="10" rx="5" fill="#000"/></mask>
    <filter id="${id}glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.32"/></filter>
  </defs>
  <g mask="url(#${id}m)">
    ${T.glow ? `<path d="${shape}" fill="none" stroke="url(#${id}edge)" stroke-width="4" filter="url(#${id}glow)" opacity=".85"/>` : ''}
    <path d="${shape}" fill="url(#${id}bg)"/>
    ${T.holo ? `<path d="${shape}" fill="url(#${id}holo)" opacity=".35"/>` : ''}
    <path d="${shape}" fill="url(#${id}grid)"/>
    <path d="${shape}" fill="none" stroke="url(#${id}edge)" stroke-width="1.6"/>
    <rect x="${W / 2 - 34}" y="9" width="68" height="18" rx="9" fill="none" stroke="${T.line}"/>
    <text x="${P}" y="44" font-family="${mono}" font-size="9" font-weight="700" letter-spacing="2.4" fill="${T.ink}">OTO//ACCESS</text>
    <text x="${W - P - 8}" y="44" text-anchor="end" font-family="${mono}" font-size="9" letter-spacing="1.6" fill="${neonB}">LVL·${String(1 + (m.seed % 9)).padStart(2, '0')}</text>
    <g clip-path="url(#${id}a)">
      <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}g)"/>
      <g transform="translate(${AX} ${AY})">${cardArt(m, c3, AW, AH, id)}</g>
      ${grain}
      <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}scan)"/>
      <rect x="${AX}" y="${AY + AH * (0.25 + r() * 0.5)}" width="${AW}" height="2" fill="#fff" opacity=".25"/>
    </g>
    <path d="${art}" fill="none" stroke="url(#${id}edge)" stroke-width="1.2"/>
    <path d="M${AX + AW - 14} ${AY + AH + 6}h14v-14M${AX} ${AY + AH + 6}v-0" fill="none" stroke="${neonB}" stroke-width="1.4"/>
    <text x="${AX + 8}" y="${AY + AH - 8}" font-family="${mono}" font-size="7.5" letter-spacing="1.4" fill="#fff" opacity=".85">REC ● ${String(m.no)}</text>
    <g transform="translate(${P} 268)">
      <rect width="40" height="30" rx="5" fill="url(#${id}chip)"/>
      <path d="M0 10h13M0 20h13M27 10h13M27 20h13M13 0v30M27 0v30M13 15h14" stroke="#8a6a24" stroke-width="1" opacity=".7"/>
    </g>
    <g transform="translate(${P + 52} 270)" font-family="${mono}" font-size="7.5" letter-spacing="1.2" fill="${T.sub}">
      <text y="9">ID Nº ${esc(m.no)}-OTO</text><text y="21">ISSUED ${esc(since)}</text>
    </g>
    <circle cx="${W - P - 20}" cy="283" r="20" fill="url(#${id}holo)" opacity=".95"/>
    <circle cx="${W - P - 20}" cy="283" r="20" fill="none" stroke="#fff" stroke-opacity=".6"/>
    ${mark(W - P - 33, 270, 26, 'rgba(20,18,31,.75)')}
    ${glitch}
    <text x="${P}" y="${nameY}" font-family="${font}" font-size="${nameSize}" font-weight="800" letter-spacing="1" fill="${T.ink}">${esc(name)}</text>
    <text x="${P}" y="${nameY + 20}" font-family="${mono}" font-size="11" letter-spacing="1.6" fill="${neonA}">&gt; ${esc((m.title || '').toUpperCase())}_</text>
    ${stats}
    <g fill="${T.ink}" opacity=".85">${bars}</g>
    <text x="${P}" y="482" font-family="${mono}" font-size="7.5" letter-spacing="2" fill="${T.sub}">${esc((m.no + (m.name || '').replace(/\s+/g, '').toUpperCase()).slice(0, 16).padEnd(16, '0'))}</text>
    <text x="${W - P}" y="452" text-anchor="end" font-family="${mono}" font-size="8" letter-spacing="1.6" fill="${T.sub}">SINCE</text>
    <text x="${W - P}" y="468" text-anchor="end" font-family="${mono}" font-size="13" font-weight="700" letter-spacing="1" fill="${T.ink}">${esc(since)}</text>
    <g transform="translate(${W - 56} 476)">${Array.from({ length: 6 }, (_, i) => `<path d="M${i * 7} 14l7-14h3l-7 14z" fill="${neonB}" opacity="${0.35 + i * 0.1}"/>`).join('')}</g>
    ${ticks}
  </g>
</svg>`;
}
async function cardPng(scale = 3) {
  const svg = cardSvg(cardModel(), { scale });
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  cv.getContext('2d').drawImage(img, 0, 0);
  return cv.toDataURL('image/png');
}
async function saveCard() {
  const url = await cardPng(3);
  const a = h('a', { href: url, download: `Oto-Card-${(cardModel().name || 'me').replace(/[^\w-]+/g, '-')}.png` });
  document.body.append(a); a.click(); a.remove();
}
async function copyCard() {
  oto.copyImage(await cardPng(3));
  toast('Card copied — paste it anywhere', { icon: 'copy', timeout: 1800 });
}
function shuffleCard() {
  const c = S.card;
  const arts = Object.keys(CARD_ART);
  const pr = GRAD_PRESETS[Math.floor(Math.random() * GRAD_PRESETS.length)];
  c.seed = Math.floor(Math.random() * 1e6);
  c.art = arts[Math.floor(Math.random() * arts.length)];
  c.colors = pr.length > 1 ? [...pr] : [pr[0], mix(pr[0], '#6366f1', 0.4)];
  save();
}

// ================================================================ the Library panel
const LIB = { open: false, page: 'downloads', q: '' };
const LIB_PAGES = [
  ['downloads', 'Downloads', 'download'], ['history', 'History', 'clock'], ['passwords', 'Passwords', 'key'], ['media', 'Media', 'play'],
  ['spaces', 'Spaces', 'palette'], ['boosts', 'Boosts', 'bolt'], ['routing', 'Routing', 'route'], ['card', 'Oto Card', 'card'], ['phone', 'Oto Phone', 'phone'],
];
function openLibrary(page) {
  if (page) LIB.page = page;
  LIB.q = '';
  closeCmd(false); closeMenu();
  if (!$('#settings').hidden) closeSettings();
  let root = $('#library');
  if (!root) {
    root = h('div', { id: 'library' });
    $('#content').append(root);
  }
  LIB.open = true;
  root.hidden = false;
  root.classList.remove('leaving');
  renderLibrary(true);
  diag('library', LIB.page);
}
function closeLibrary() {
  const root = $('#library');
  if (!root || !LIB.open) return;
  LIB.open = false;
  if (!animOn()) { root.hidden = true; return; }
  root.classList.add('leaving');
  setTimeout(() => { if (!LIB.open) root.hidden = true; }, 170);
  const v = activeView();
  if (v) setTimeout(() => focusView(v), 0);
}
function toggleLibrary(page) { if (LIB.open && (!page || LIB.page === page)) closeLibrary(); else openLibrary(page); }

function libEmpty(ic, text) { return h('div', { class: 'lib-empty' }, h('span', { class: 'lib-empty-ic', html: icon(ic) }), h('p', {}, text)); }
const libRow = (opts, ...kids) => h('div', { class: `lib-row${opts.cls ? ` ${opts.cls}` : ''}`, title: opts.title || '', onclick: opts.onclick, oncontextmenu: opts.oncontextmenu }, ...kids);
const libBtn = (ic, tip, run, cls = '') => h('button', { class: `icon-btn sm ${cls}`, title: tip, html: icon(ic), onclick: (e) => { e.stopPropagation(); run(); } });
const matchQ = (...strs) => !LIB.q || strs.some((s) => String(s || '').toLowerCase().includes(LIB.q));

const LIB_RENDER = {
  downloads() {
    const list = dlList().filter((r) => matchQ(r.name, r.url));
    if (!list.length) return [libEmpty('download', LIB.q ? 'No downloads match your search.' : 'Files you download show up here.')];
    const paths = list.filter((r) => r.state === 'completed' && r.path && r.missing == null).map((r) => r);
    if (paths.length) oto.dlExists(paths.map((r) => r.path)).then((res) => { let ch = false; paths.forEach((r, i) => { if (!res[i]) { r.missing = true; ch = true; } else r.missing = false; }); if (ch && LIB.open && LIB.page === 'downloads') renderLibrary(); });
    return [
      h('div', { class: 'lib-tools' }, h('button', { class: 'btn', onclick: () => oto.showInFolder(list.find((r) => r.path)?.path || '') }, 'Open Downloads folder'),
        h('button', { class: 'btn', onclick: () => { S.downloads = dlList().filter((r) => DL_LIVE.has(r.id)); save(); renderLibrary(); renderDlCard(); } }, 'Clear list')),
      ...groupByDay(list, 'startedAt').map((g) => h('div', { class: 'lib-group' }, h('h5', {}, g.label), ...g.items.map((r) => {
        const live = DL_LIVE.has(r.id);
        const pct = r.total ? Math.min(100, (r.received / r.total) * 100) : 0;
        return libRow({
          cls: `dl${r.missing ? ' missing' : ''}${live ? ' live' : ''}`, title: r.url,
          onclick: () => { if (r.state === 'completed' && !r.missing) openDownload(r); },
        }, dlIcon(r),
        h('div', { class: 'lib-txt' }, h('b', {}, r.name), h('small', {}, r.missing ? 'File moved or deleted' : `${dlSub(r)}${live ? '' : ` · ${fmtWhen(r.startedAt)}`}`),
          live ? h('div', { class: 'dl-bar' }, h('span', { style: `width:${r.total ? pct : 30}%` })) : null),
        live ? libBtn(r.state === 'paused' ? 'play' : 'pause', r.state === 'paused' ? 'Resume' : 'Pause', () => oto.dlAction(r.id, r.state === 'paused' ? 'resume' : 'pause')) : null,
        live ? libBtn('x', 'Cancel', () => oto.dlAction(r.id, 'cancel')) : null,
        !live && r.state === 'completed' && !r.missing ? libBtn('folder', 'Show in folder', () => oto.showInFolder(r.path)) : null,
        !live && r.url ? libBtn('reload', 'Download again', () => newTab(r.url, { background: true })) : null,
        !live ? libBtn('trash', 'Remove from list', () => { S.downloads = dlList().filter((x) => x !== r); save(); renderLibrary(); }) : null);
      }))),
    ];
  },

  history() {
    const list = (S.history || []).filter((x) => matchQ(x.t, x.u)).slice(0, 400);
    if (!list.length) return [libEmpty('clock', LIB.q ? 'Nothing in your history matches.' : 'Pages you visit show up here.')];
    return [
      h('div', { class: 'lib-tools' }, h('button', { class: 'btn danger', onclick: () => { if (!confirm('Clear all browsing history?')) return; S.history = []; save(); renderLibrary(); } }, 'Clear history')),
      ...groupByDay(list, 'ts').map((g) => h('div', { class: 'lib-group' }, h('h5', {}, g.label), ...g.items.map((x) => libRow({
        title: x.u, onclick: (e) => (e.ctrlKey ? newTab(x.u, { background: true }) : (newTab(x.u), closeLibrary())),
      }, favEl({ url: x.u, title: x.t, favicon: '' }, null, true),
      h('div', { class: 'lib-txt' }, h('b', {}, x.t || prettyUrl(x.u)), h('small', {}, `${hostOf(x.u)} · ${fmtWhen(x.ts)}`)),
      libBtn('trash', 'Remove', () => { S.history = S.history.filter((y) => y !== x); save(); renderLibrary(); }))))),
    ];
  },

  media() {
    const tabs = S.tabs.filter((t) => { const v = V.get(t.id); return v && (v.audible || v.muted || (media && media.tabId === t.id)); }).filter((t) => matchQ(t.title, t.url));
    if (!tabs.length) return [libEmpty('play', 'Tabs playing music or video show up here, with controls.')];
    return [h('div', { class: 'lib-group' }, ...tabs.map((t) => {
      const v = V.get(t.id);
      const playing = media && media.tabId === t.id ? media.playing : v.audible;
      return libRow({ cls: 'media', onclick: () => { activate(t.id); closeLibrary(); } }, favEl(t, v),
        h('div', { class: 'lib-txt' }, h('b', {}, t.title || prettyUrl(t.url)), h('small', {}, `${hostOf(t.url)}${playing ? ' · playing' : ''}${v.muted ? ' · muted' : ''}`)),
        libBtn(playing ? 'pause' : 'play', playing ? 'Pause' : 'Play', async () => { media = { tabId: t.id, playing }; await mediaToggle(); renderLibrary(); }),
        libBtn(v.muted ? 'mute' : 'vol', v.muted ? 'Unmute' : 'Mute', () => { toggleMute(t.id); renderLibrary(); }),
        libBtn('pip', 'Picture in picture', () => pictureInPicture(t.id)));
    }))];
  },

  spaces() {
    return [h('div', { class: 'lib-spaces' }, ...S.workspaces.filter((w) => matchQ(w.name)).map((w) => {
      const n = S.tabs.filter((t) => !t.essential && t.ws === w.id).length;
      return h('div', { class: `lib-space${w.id === S.activeWs ? ' on' : ''}`, onclick: () => { switchWorkspace(w.id); closeLibrary(); } },
        h('div', { class: 'ls-swatch', style: w.image ? `background:center / cover no-repeat url("${w.image}")` : `background:${wsSwatch(w)}` }, !w.image && w.emoji ? h('span', {}, w.emoji) : null),
        h('div', { class: 'lib-txt' }, h('b', {}, w.name), h('small', {}, `${n} tab${n === 1 ? '' : 's'}${w.id === S.activeWs ? ' · current' : ''}`)),
        libBtn('palette', 'Edit space', () => openWsDialog(w)));
    }), h('button', { class: 'lib-space add', onclick: () => openWsDialog() }, h('span', { html: icon('plus') }), 'New space'))];
  },

  boosts() {
    const list = (S.boosts || []).filter((b) => matchQ(b.name, b.host));
    return [
      h('div', { class: 'lib-tools' }, h('button', { class: 'btn primary', onclick: () => { closeLibrary(); openSettings('boosts'); } }, 'New Boost…')),
      list.length ? h('div', { class: 'lib-group' }, ...list.map((b) => libRow({ title: b.host },
        h('span', { class: 'lib-boost-ic', html: icon('bolt') }),
        h('div', { class: 'lib-txt' }, h('b', {}, b.name || b.host || 'Boost'), h('small', {}, b.host || 'every site')),
        h('button', { class: `switch${b.on ? ' on' : ''}`, onclick: (e) => { e.stopPropagation(); b.on = !b.on; save(); reapplyBoosts(); renderLibrary(); } }),
        libBtn('edit', 'Edit', () => { closeLibrary(); openSettings('boosts'); })))) : libEmpty('bolt', 'Boosts restyle a site with your own CSS — hide distractions, change fonts, force dark mode.'),
    ];
  },

  routing() {
    S.routes = S.routes || [];
    const wsOpts = () => S.workspaces.map((w) => h('option', { value: w.id }, w.name));
    const hostIn = h('input', { class: 'lib-input', placeholder: 'Site, e.g. youtube.com', spellcheck: 'false' });
    const wsSel = h('select', { class: 'lib-select' }, ...wsOpts());
    const cur = activeTab();
    if (cur && hostOf(cur.url)) hostIn.value = hostOf(cur.url).replace(/^www\./, '');
    const add = () => {
      const host = hostIn.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      if (!host || !host.includes('.')) { hostIn.focus(); return; }
      S.routes = S.routes.filter((r) => r.host !== host);
      S.routes.push({ host, ws: wsSel.value, on: true });
      save(); renderLibrary();
    };
    hostIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    return [
      h('p', { class: 'lib-intro' }, 'Send sites to the space they belong in. Links to these sites — from other apps or opened in a new tab — open in the space you pick.'),
      h('div', { class: 'lib-route-add' }, hostIn, h('span', { class: 'lib-arrow', html: icon('move') }), wsSel, h('button', { class: 'btn primary', onclick: add }, 'Add rule')),
      S.routes.length ? h('div', { class: 'lib-group' }, ...S.routes.filter((r) => matchQ(r.host)).map((r) => {
        const w = S.workspaces.find((x) => x.id === r.ws);
        return libRow({ cls: w ? '' : 'missing' },
          favEl({ url: `https://${r.host}/`, title: r.host, favicon: '' }, null, true),
          h('div', { class: 'lib-txt' }, h('b', {}, r.host), h('small', {}, w ? `Opens in ${w.name}` : 'Space was deleted')),
          w ? h('span', { class: 'ls-dot', style: `background:${wsSwatch(w)}` }) : null,
          h('button', { class: `switch${r.on !== false ? ' on' : ''}`, onclick: (e) => { e.stopPropagation(); r.on = r.on === false; save(); renderLibrary(); } }),
          libBtn('trash', 'Delete rule', () => { S.routes = S.routes.filter((x) => x !== r); save(); renderLibrary(); }));
      })) : libEmpty('route', 'No rules yet. Try sending youtube.com to an “Entertainment” space.'),
    ];
  },

  card() {
    ensureSince();
    const m = cardModel();
    const c = S.card;
    const art = h('div', { class: 'card-art-svg', html: cardSvg(m) });
    const preview = h('div', { class: `card-preview design-${m.design}` }, h('div', { class: 'card-tilt' }, art, h('div', { class: 'card-foil' }), h('div', { class: 'card-glare' })));
    // Tilt the card toward the mouse; the glare (and the foil on Shiny) follows it.
    const tilt = preview.firstChild;
    preview.addEventListener('pointermove', (e) => {
      const b = tilt.getBoundingClientRect();
      const x = clamp((e.clientX - b.left) / b.width, 0, 1), y = clamp((e.clientY - b.top) / b.height, 0, 1);
      tilt.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(2)}deg`);
      tilt.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
      tilt.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      tilt.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      tilt.classList.add('on');
    });
    preview.addEventListener('pointerleave', () => { tilt.classList.remove('on'); tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg'); });
    const repaint = () => { art.innerHTML = cardSvg(cardModel()); };
    const set = (k, v, full) => { c[k] = v; save(); if (full) renderLibrary(); else repaint(); };
    const seg = (opts, val, pick) => h('div', { class: 'seg' }, ...Object.entries(opts).map(([k, l]) => h('button', { class: k === val ? 'on' : '', onclick: () => pick(k) }, Array.isArray(l) ? l[0] : l)));
    const field = (label, control) => h('label', { class: 'card-field' }, h('span', {}, label), control);
    const nameIn = h('input', { class: 'lib-input', value: m.name, maxlength: 22, spellcheck: 'false', oninput: (e) => set('name', e.target.value) });
    const titleIn = h('input', { class: 'lib-input', value: m.title, maxlength: 28, spellcheck: 'false', oninput: (e) => set('title', e.target.value) });
    const useSpace = !c.colors;
    const colorInputs = (c.colors || themeOf(currentWs()).colors).slice(0, 3).map((col, i) => h('input', {
      type: 'color', value: col, title: 'Pick a colour',
      oninput: (e) => { const arr = [...(c.colors || themeOf(currentWs()).colors)].slice(0, 3); arr[i] = e.target.value; set('colors', arr); },
      onchange: () => renderLibrary(),
    }));
    return [h('div', { class: 'card-wrap' },
      h('div', { class: 'card-stage' }, preview,
        h('div', { class: 'card-actions' },
          h('button', { class: 'btn', title: 'Random colours and artwork', onclick: () => { shuffleCard(); renderLibrary(); } }, h('span', { html: icon('shuffle') }), 'Shuffle'),
          h('button', { class: 'btn', title: 'Save as an image', onclick: saveCard }, h('span', { html: icon('download') }), 'Save'),
          h('button', { class: 'btn', title: 'Copy the image to paste anywhere', onclick: copyCard }, h('span', { html: icon('copy') }), 'Copy'))),
      h('div', { class: 'card-form' },
        h('h3', {}, 'Your Oto Card'),
        h('p', { class: 'lib-intro' }, 'Make it yours, then save it or share it.'),
        field('Design', seg(CARD_DESIGNS, m.design, (k) => { c.design = k; if (!c.fontSet) delete c.font; set('design', k, true); })),
        field('Name', nameIn),
        field('Title', titleIn),
        h('div', { class: 'card-chips' }, ...CARD_TITLES.map((t) => h('button', { class: `chip${m.title === t ? ' on' : ''}`, onclick: () => { c.title = t; save(); renderLibrary(); } }, t))),
        field('Artwork', h('div', { class: 'card-arts' }, ...Object.entries(CARD_ART).map(([k, l]) => h('button', {
          class: `card-art${m.art === k ? ' on' : ''}`, title: l, onclick: () => set('art', k, true),
          html: `<svg viewBox="0 0 284 232">${(() => { const mm = { ...m, art: k }; const cols = (mm.colors && mm.colors.length ? mm.colors : themeOf(currentWs()).colors); const cc = cols.length === 1 ? [cols[0], mix(cols[0], '#fff', 0.35)] : cols; return `<defs><linearGradient id="ca${k}" x1="0" y1="0" x2="1" y2="1">${cc.map((x, i) => `<stop offset="${i / (cc.length - 1)}" stop-color="${x}"/>`).join('')}</linearGradient></defs><rect width="284" height="232" fill="url(#ca${k})"/>${cardArt(mm, cc, 284, 232, `cp${k}`)}`; })()}</svg><span>${l}</span>`,
        })))),
        field('Colours', h('div', { class: 'card-colours' },
          h('button', { class: `chip${useSpace ? ' on' : ''}`, onclick: () => set('colors', null, true) }, 'Match my space'),
          ...GRAD_PRESETS.slice(0, 9).map((p) => h('button', { class: 'gp-preset sm', style: `background:${p.length > 1 ? `linear-gradient(135deg, ${p.join(', ')})` : p[0]}`, onclick: () => set('colors', p.length > 1 ? [...p] : [p[0], mix(p[0], '#6366f1', 0.4)], true) })),
          h('span', { class: 'card-custom' }, ...colorInputs))),
        field(m.design === 'shiny' ? 'Frame' : 'Style', seg(m.design === 'shiny' ? { night: 'Chrome', holo: 'Rainbow', tinted: 'Colour', paper: 'Gold' } : m.design === 'classic' ? { paper: 'Paper', night: 'Night', tinted: 'Tinted' } : CARD_STYLES, m.design === 'classic' && m.style === 'holo' ? 'paper' : m.style, (k) => set('style', k, true))),
        field('Font', seg(CARD_FONTS, m.font, (k) => { c.fontSet = true; set('font', k, true); })),
        field('Grain', (() => { const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: m.grain }); r.addEventListener('input', () => set('grain', +r.value)); return r; })()),
        field('Stats', h('div', { class: 'card-stats' },
          h('button', { class: `switch${m.showStats ? ' on' : ''}`, onclick: () => set('showStats', !m.showStats, true) }),
          m.showStats ? h('div', { class: 'card-chips' }, ...Object.entries(CARD_STATS).map(([k, l]) => h('button', {
            class: `chip${m.stats.includes(k) ? ' on' : ''}`,
            onclick: () => { let s = [...m.stats]; if (s.includes(k)) s = s.filter((x) => x !== k); else { s.push(k); if (s.length > 3) s.shift(); } set('stats', s, true); },
          }, l))) : null)),
      ))];
  },
};

// Oto on your phone — not ready yet, so the page shows what's coming.
LIB_RENDER.phone = function phone() {
  ensureSince();
  const m = cardModel();
  return [h('div', { class: 'phone-page' },
    h('div', { class: 'pp-device' },
      h('div', { class: 'cp-notch' }),
      h('div', { class: 'pp-screen' },
        h('div', { class: 'pp-status' }, h('span', {}, new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })), h('span', { html: icon('globe') })),
        h('div', { class: 'pp-card', html: cardSvg(m) }),
        h('div', { class: 'pp-hint' }, 'Hold near reader'),
        h('div', { class: 'pp-dock' }, ...['globe', 'tab', 'search', 'library'].map((ic) => h('span', { html: icon(ic) }))))),
    h('div', { class: 'pp-text' },
      h('span', { class: 'cp-soon' }, 'Coming soon'),
      h('h2', {}, 'Oto on your phone'),
      h('p', {}, 'Your Oto Card in your pocket, your spaces and tabs with you, and the same calm browser on the go.'),
      h('ul', { class: 'pp-list' }, ...[
        ['card', 'Your Oto Card in your phone’s wallet'],
        ['palette', 'Your spaces and colours, synced'],
        ['tab', 'Pick up tabs where you left off'],
        ['shield', 'The same ad and tracker blocking'],
      ].map(([ic, t]) => h('li', {}, h('span', { html: icon(ic) }), t))),
      h('div', { class: 'cp-btns' },
        h('button', { class: 'btn', disabled: true }, 'Add to Wallet'),
        h('button', { class: 'btn', disabled: true }, 'Get Oto for phone')),
      h('small', { class: 'pp-note' }, 'Not available yet — this page will light up when it is.')))];
};

function renderLibrary(first = false) {
  const root = $('#library');
  if (!root || !LIB.open) return;
  const body = root.querySelector('.lib-body');
  const scroll = body && !first ? body.scrollTop : 0;
  const hadFocus = document.activeElement && document.activeElement.classList.contains('lib-search') ? document.activeElement.selectionStart : -1;
  const search = h('input', { class: 'lib-search', placeholder: `Search ${LIB_PAGES.find((p) => p[0] === LIB.page)[1]}…`, value: LIB.q, spellcheck: 'false' });
  search.addEventListener('input', () => { LIB.q = search.value.trim().toLowerCase(); renderLibrary(); });
  const nav = h('nav', { class: 'lib-nav' }, ...LIB_PAGES.map(([k, l, ic]) => h('button', {
    class: LIB.page === k ? 'on' : '', onclick: () => { LIB.page = k; LIB.q = ''; renderLibrary(true); },
  }, h('span', { class: 'ln-ic', html: icon(ic) }), h('span', {}, l))),
  h('div', { class: 'lib-nav-foot' }, h('button', { class: 'icon-btn sm', title: 'Close (Esc)', html: icon('back'), onclick: closeLibrary })));
  const head = h('div', { class: 'lib-head' },
    LIB.page === 'card' || LIB.page === 'phone' ? h('h2', {}, LIB.page === 'card' ? 'Oto Card' : 'Oto Phone') : h('label', { class: 'lib-search-wrap' }, h('span', { html: icon('search') }), search),
    h('button', { class: 'icon-btn sm lib-close', title: 'Close (Esc)', html: icon('x'), onclick: closeLibrary }));
  const content = h('div', { class: `lib-body page-${LIB.page}` }, ...(LIB_RENDER[LIB.page]() || []));
  root.replaceChildren(h('div', { class: 'lib-shell' }, nav, h('div', { class: 'lib-main' }, head, content)));
  content.scrollTop = scroll;
  if (hadFocus >= 0) { search.focus(); search.setSelectionRange(hadFocus, hadFocus); }
  else if (first && !['card', 'phone'].includes(LIB.page)) setTimeout(() => search.focus(), 30);
}

// ================================================================ wiring
function initLibrary() {
  const foot = document.querySelector('#sidebar .sb-foot');
  if (foot && !$('#dlCard')) foot.before(h('div', { id: 'dlCard', class: 'dl-card', hidden: true }));
  const libBtnEl = h('button', { id: 'btnLibrary', class: 'icon-btn', title: 'Library — downloads, history, spaces… (Ctrl+Shift+O)', html: icon('library'), onclick: () => toggleLibrary() });
  const ext = $('#btnExtensions');
  if (ext && !$('#btnLibrary')) ext.before(libBtnEl);
  if (!$('#btnDownloads')) {
    const db = h('button', { id: 'btnDownloads', class: 'icon-btn dl-btn', hidden: true, html: DL_BTN_SVG, onclick: () => toggleLibrary('downloads') });
    db.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const last = dlList().find((r) => r.path);
      showMenu(e.clientX, e.clientY, [
        { label: 'All downloads', icon: 'download', k: 'Ctrl+J', run: () => openLibrary('downloads') },
        last && { label: 'Open Downloads folder', icon: 'folder', run: () => oto.showInFolder(last.path) },
        '-',
        { label: 'Hide until next download', icon: 'x', run: () => { dlBtn.recentAt = 0; renderDlButton(); } },
      ]);
    });
    libBtnEl.before(db);
  }
  oto.on('download', (d) => { if (d && d.reason === 'danger') toast(`Download blocked: ${d.name} comes from a site known for ${d.kind === 'phishing' ? 'phishing' : 'harmful software'}`, { icon: 'shield', timeout: 5000 }); onDownload(d); });
  oto.on('blocked', (_wc, n) => bumpStat('blocked', n || 1));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && LIB.open && $('#wsDialog').hidden && $('#menuLayer').hidden) { e.stopPropagation(); closeLibrary(); } }, true);
  ensureSince();
  // Downloads still "in progress" from a previous run can't continue.
  for (const r of dlList()) if (['started', 'progress', 'paused'].includes(r.state)) r.state = 'interrupted';
}
