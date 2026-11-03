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
    requestAnimationFrame(() => dlFly(d.cursor));
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
const DL_BTN_SVG = `<svg class="dlb" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
  <circle class="dlb-track" cx="12" cy="12" r="10.3"/>
  <circle class="dlb-ring" cx="12" cy="12" r="10.3" pathLength="100" transform="rotate(-90 12 12)"/>
  <g class="dlb-arrow"><path d="M12 6.2v7.6M8.9 10.9l3.1 3.1 3.1-3.1"/></g>
  <path class="dlb-tray" d="M7.2 14.6v1.5a1.9 1.9 0 0 0 1.9 1.9h5.8a1.9 1.9 0 0 0 1.9-1.9v-1.5"/>
  <path class="dlb-check" pathLength="1" d="M8.2 12.3l2.6 2.6 5-5.4"/>
</svg><span class="dlb-badge"></span>`;
function renderDlButton() {
  const b = $('#btnDownloads');
  if (!b) return;
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
function dlFly(from) {
  const tgt = dlTarget();
  const catchIt = () => {
    dlRipple(tgt.x, tgt.y);
    if (tgt.el) { tgt.el.classList.remove('catch'); void tgt.el.offsetWidth; tgt.el.classList.add('catch'); setTimeout(() => tgt.el.classList.remove('catch'), 700); }
  };
  if (!animOn()) { catchIt(); return; }
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
  const orb = h('div', { class: 'dl-orb', html: '<span class="dl-orb-ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5v10M7.8 11.6 12 15.8l4.2-4.2"/><path d="M7 19h10" opacity=".7"/></svg>' });
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
const CARD_STYLES = { paper: 'Paper', night: 'Night', tinted: 'Tinted' };
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
    art: c.art || 'orbit', style: c.style || 'paper', font: c.font || 'sans',
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
        <path d="${inf}" stroke-width="2.6" transform="translate(${cx - R * 0.9} ${cy - R * 0.9}) scale(${(R * 1.8) / 64})"/></g>`;
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

function cardSvg(m = cardModel(), { scale = 1 } = {}) {
  const W = 320, H = 460, P = 18;
  const id = `oc${Math.floor(Math.random() * 1e6)}`;
  const cols = (m.colors && m.colors.length ? m.colors : themeOf(currentWs()).colors).slice(0, 3);
  const c3 = cols.length === 1 ? [cols[0], mix(cols[0], '#ffffff', 0.35)] : cols;
  const theme = {
    paper: { bg: '#fbf8f1', ink: '#1d1b26', sub: '#5d5a6b', line: 'rgba(29,27,38,.18)' },
    night: { bg: '#111019', ink: '#f6f4ff', sub: '#a8a3c2', line: 'rgba(255,255,255,.16)' },
    tinted: { bg: mix(c3[0], '#ffffff', 0.86), ink: mix(c3[0], '#111111', 0.82), sub: mix(c3[0], '#333333', 0.55), line: 'rgba(0,0,0,.14)' },
  }[m.style] || {};
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
  const mark = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 64})" fill="none" stroke="${theme.ink}" stroke-width="5" stroke-linecap="round">
    <path d="M44.5 15.2 A21 21 0 1 0 49.6 21.3"/><g transform="translate(32 32) scale(.84) translate(-32 -32)"><path stroke-width="5" d="M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z"/></g></g>`;
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
  ['downloads', 'Downloads', 'download'], ['history', 'History', 'clock'], ['media', 'Media', 'play'],
  ['spaces', 'Spaces', 'palette'], ['boosts', 'Boosts', 'bolt'], ['routing', 'Routing', 'route'], ['card', 'Oto Card', 'card'],
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
        h('div', { class: 'ls-swatch', style: `background:${wsSwatch(w)}` }, w.emoji ? h('span', {}, w.emoji) : null),
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
    const preview = h('div', { class: 'card-preview', html: cardSvg(m) });
    const repaint = () => { preview.innerHTML = cardSvg(cardModel()); };
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
        field('Card', seg(CARD_STYLES, m.style, (k) => set('style', k, true))),
        field('Font', seg(CARD_FONTS, m.font, (k) => set('font', k, true))),
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
    LIB.page === 'card' ? h('h2', {}, 'Oto Card') : h('label', { class: 'lib-search-wrap' }, h('span', { html: icon('search') }), search),
    h('button', { class: 'icon-btn sm lib-close', title: 'Close (Esc)', html: icon('x'), onclick: closeLibrary }));
  const content = h('div', { class: `lib-body page-${LIB.page}` }, ...(LIB_RENDER[LIB.page]() || []));
  root.replaceChildren(h('div', { class: 'lib-shell' }, nav, h('div', { class: 'lib-main' }, head, content)));
  content.scrollTop = scroll;
  if (hadFocus >= 0) { search.focus(); search.setSelectionRange(hadFocus, hadFocus); }
  else if (first && LIB.page !== 'card') setTimeout(() => search.focus(), 30);
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
  oto.on('download', onDownload);
  oto.on('blocked', (_wc, n) => bumpStat('blocked', n || 1));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && LIB.open && $('#wsDialog').hidden && $('#menuLayer').hidden) { e.stopPropagation(); closeLibrary(); } }, true);
  ensureSince();
  // Downloads still "in progress" from a previous run can't continue.
  for (const r of dlList()) if (['started', 'progress', 'paused'].includes(r.state)) r.state = 'interrupted';
}
