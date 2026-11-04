'use strict';
/* Oto v1 — Alpha 4: the held 0.10 ideas. Card levels + badges, OG and Founder cards, Now Playing,
   new-tab widgets, space switch animation, tab peek, ambient glow, focus mode + reader, breathing
   backgrounds, units & timers in the command bar, and the Owner panel (owner key only). */

// ================================================================ card levels, badges, editions
const V1_LEVELS = [
  { id: 'rookie', name: 'Rookie', xp: 0, color: '#94a3b8', title: 'Fresh Start' },
  { id: 'bronze', name: 'Bronze', xp: 100, color: '#c2773d', title: 'Trail Starter' },
  { id: 'silver', name: 'Silver', xp: 300, color: '#cbd5e1', title: 'Space Walker' },
  { id: 'gold', name: 'Gold', xp: 700, color: '#f5c542', title: 'Gold Navigator' },
  { id: 'holo', name: 'Holo', xp: 1500, color: '#a78bfa', title: 'Holo Voyager' },
  { id: 'mythic', name: 'Mythic', xp: 3000, color: '#22d3ee', title: 'Mythic Wanderer' },
];
const V1_BADGES = {
  week: ['7 days with Oto', '📅'], month: ['30 days with Oto', '🗓️'], blocker: ['1,000 ads blocked', '🛡️'], wall: ['10,000 ads blocked', '🏰'],
  spaces: ['3 spaces', '🪐'], split: ['First split view', '◫'], avocado: ['Went Avocado', '🥑'], folder: ['First tab folder', '🗂️'],
  shot: ['First screenshot', '📸'], theme: ['Theme maker', '🎨'], wrapped: ['Opened Wrapped', '🎁'], owl: ['Night owl', '🦉'],
  secret: ['Found a secret', '🤫'], note: ['First site note', '📝'], focus: ['Focus session', '🎯'],
};
function v1Stats() {
  const st = S.stats || {};
  const days = Math.max(1, Math.ceil((Date.now() - (S.since || Date.now())) / 864e5));
  return { days, blocked: st.blocked || 0, pages: st.pages || 0, spaces: S.workspaces.length };
}
function v1Xp() {
  const s = v1Stats();
  return s.days * 10 + Math.floor(s.blocked / 50) + s.spaces * 20 + Math.floor(s.pages / 20) + Object.keys(S.v1Badges || {}).length * 15 + (S.v1XpBonus || 0);
}
function v1Level(xp = v1Xp()) {
  let i = 0;
  V1_LEVELS.forEach((l, k) => { if (xp >= l.xp) i = k; });
  const cur = V1_LEVELS[i], next = V1_LEVELS[i + 1];
  return { i, cur, next, xp, pct: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}
function v1Badge(id) {
  if (AVOCADO_MODE || !V1_BADGES[id]) return;
  S.v1Badges = S.v1Badges || {};
  if (S.v1Badges[id]) return;
  S.v1Badges[id] = Date.now(); save();
  toast(`Badge unlocked: ${V1_BADGES[id][1]} ${V1_BADGES[id][0]}`, { icon: 'star', timeout: 3000 });
  v1CheckLevel();
}
function v1AutoBadges() {
  const s = v1Stats();
  if (s.days >= 7) v1Badge('week');
  if (s.days >= 30) v1Badge('month');
  if (s.blocked >= 1000) v1Badge('blocker');
  if (s.blocked >= 10000) v1Badge('wall');
  if (s.spaces >= 3) v1Badge('spaces');
  if ((S.v1Secrets || []).length) v1Badge('secret');
  const T = S.v1Time;
  if (T && T.total > 120) { const pk = T.hours.indexOf(Math.max(...T.hours)); if (pk >= 22 || pk < 4) v1Badge('owl'); }
}
function v1CheckLevel() {
  if (AVOCADO_MODE) return;
  const L = v1Level();
  if (S.v1LevelSeen == null) { S.v1LevelSeen = L.i; save(); return; }
  if (L.i > S.v1LevelSeen) { S.v1LevelSeen = L.i; save(); v1LevelUp(L); }
}
function v1LevelUp(L) {
  const el = h('div', { class: 'v1-lvlup' }, h('div', { class: 'card', style: `--lc:${L.cur.color}` }, h('div', { class: 'f front', html: `<span>${V1_LEVELS[Math.max(0, L.i - 1)].name}</span>` }), h('div', { class: 'f back', html: `<b>${L.cur.name}</b><small>LEVEL UP</small>` })),
    h('h3', {}, `You reached ${L.cur.name}!`), h('p', {}, `New title unlocked: “${L.cur.title}”. Your Oto Card got a ${L.cur.name.toLowerCase()} frame.`),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => el.remove() }, 'Nice'), h('button', { class: 'btn primary', onclick: () => { el.remove(); openLibrary('card'); } }, 'See my card')));
  el.addEventListener('mousedown', (e) => { if (e.target === el) el.remove(); });
  document.body.append(el);
}
const v1Edition = () => {
  const e = (S.card || {}).edition;
  if (e === 'founder' && !(UPD && UPD.owner)) return 'standard';
  return e === 'og' || e === 'founder' ? e : 'standard';
};
const v1CardId = () => { let h2 = 7; for (const ch of String(S.since || 0)) h2 = (h2 * 31 + ch.charCodeAt(0)) >>> 0; return String(h2 % 10000).padStart(4, '0'); };

function v1CardOG(m) {
  const W = 320, H = 504;
  const name = esc(String(m.name || 'You').toUpperCase().slice(0, 18));
  const since = new Date(S.since || Date.now()).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ogb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
  <radialGradient id="ogg" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" rx="22" fill="url(#ogb)"/><rect width="${W}" height="${H}" rx="22" fill="url(#ogg)"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="16" fill="none" stroke="#fff" stroke-opacity=".45" stroke-dasharray="2 5"/>
  <text x="26" y="44" font-family="ui-monospace,Consolas,monospace" font-size="11" letter-spacing="2.5" fill="#fff" fill-opacity=".85">OTO · ORIGINAL USER</text>
  <g transform="translate(${W / 2} 190)" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"><circle cx="-26" cy="0" r="44"/><circle cx="26" cy="0" r="44" stroke-opacity=".8"/></g>
  <text x="${W / 2}" y="296" text-anchor="middle" font-family="'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif" font-weight="800" font-size="30" fill="#fff">${name}</text>
  <text x="${W / 2}" y="320" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="11" letter-spacing="2" fill="#fff" fill-opacity=".85">BEFORE 1.0 · KEPT FOREVER</text>
  <rect x="26" y="${H - 104}" width="${W - 52}" height="1" fill="#fff" fill-opacity=".35"/>
  <text x="26" y="${H - 74}" font-family="ui-monospace,Consolas,monospace" font-size="10" fill="#fff" fill-opacity=".75">CARD Nº</text><text x="26" y="${H - 52}" font-family="ui-monospace,Consolas,monospace" font-size="20" font-weight="700" fill="#fff">${v1CardId()}</text>
  <text x="${W - 26}" y="${H - 74}" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="10" fill="#fff" fill-opacity=".75">SINCE</text><text x="${W - 26}" y="${H - 52}" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="15" font-weight="700" fill="#fff">${esc(since)}</text>
  <text x="${W / 2}" y="${H - 24}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="9" letter-spacing="3" fill="#fff" fill-opacity=".6">★ OG EDITION ★</text></svg>`;
}
function v1CardFounder(m) {
  const W = 320, H = 504;
  const name = esc(String(m.name || 'Ryo').slice(0, 18));
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>
  <linearGradient id="fdg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".45" stop-color="#d4a017"/><stop offset=".7" stop-color="#fff3c4"/><stop offset="1" stop-color="#b8860b"/></linearGradient>
  <radialGradient id="fdb" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#1c1a14"/><stop offset="1" stop-color="#050505"/></radialGradient></defs>
  <rect width="${W}" height="${H}" rx="22" fill="url(#fdb)"/>
  <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="16" fill="none" stroke="url(#fdg)" stroke-width="2"/>
  <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="12" fill="none" stroke="url(#fdg)" stroke-width=".6" stroke-opacity=".6"/>
  <text x="28" y="48" font-family="ui-monospace,Consolas,monospace" font-size="11" letter-spacing="3" fill="url(#fdg)">OTO · FOUNDER</text>
  <text x="${W - 28}" y="48" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="11" letter-spacing="2" fill="url(#fdg)">1/1</text>
  <text x="${W / 2}" y="250" text-anchor="middle" font-family="'Yu Mincho','MS Mincho','Noto Serif JP',serif" font-weight="700" font-size="150" fill="url(#fdg)">力</text>
  <text x="${W / 2}" y="318" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="11" letter-spacing="3" fill="url(#fdg)">OWNER · Nº 0000 · ONE OF ONE</text>
  <rect x="40" y="340" width="${W - 80}" height=".8" fill="url(#fdg)" opacity=".6"/>
  <text x="${W / 2}" y="${H - 86}" text-anchor="middle" font-family="'Segoe Script','Brush Script MT','Lucida Handwriting',cursive" font-size="40" fill="url(#fdg)">${name}</text>
  <text x="${W / 2}" y="${H - 40}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="9" letter-spacing="3" fill="#d4a017" fill-opacity=".8">THE ONE WHO MADE OTO</text></svg>`;
}
function v1CardBack() {
  const W = 320, H = 504;
  const got = S.v1Badges || {};
  const ids = Object.keys(V1_BADGES);
  let cells = '';
  ids.forEach((id, k) => {
    const x = 34 + (k % 3) * 90, y = 96 + Math.floor(k / 3) * 74;
    const on = !!got[id];
    cells += `<g transform="translate(${x} ${y})"><circle cx="36" cy="22" r="22" fill="${on ? '#ffffff' : '#ffffff'}" fill-opacity="${on ? 0.16 : 0.05}" stroke="#fff" stroke-opacity="${on ? 0.5 : 0.15}"/>
      <text x="36" y="29" text-anchor="middle" font-size="18">${on ? V1_BADGES[id][1] : '?'}</text>
      <text x="36" y="60" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8.5" fill="#fff" fill-opacity="${on ? 0.9 : 0.35}">${on ? esc(V1_BADGES[id][0]) : 'Hidden'}</text></g>`;
  });
  const L = v1Level();
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cbk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
  <rect width="${W}" height="${H}" rx="22" fill="url(#cbk)"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="16" fill="none" stroke="${L.cur.color}" stroke-opacity=".7"/>
  <text x="26" y="46" font-family="ui-monospace,Consolas,monospace" font-size="11" letter-spacing="2.5" fill="#fff" fill-opacity=".8">CARD BACK · BADGES</text>
  <text x="${W - 26}" y="46" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="11" fill="${L.cur.color}">${Object.keys(got).length}/${ids.length}</text>${cells}</svg>`;
}

function v1CardPanel() {
  const L = v1Level();
  const ed = v1Edition();
  const owner = !!(UPD && UPD.owner);
  const pick = (e) => { S.card = S.card || {}; S.card.edition = e; save(); renderLibrary(); };
  const titles = V1_LEVELS.slice(1).map((l, k) => ({ l, open: L.i >= k + 1 }));
  return h('div', { class: 'v1-cardpanel' },
    h('div', { class: 'lv', style: `--lc:${L.cur.color}` },
      h('div', { class: 'lvh' }, h('span', { class: 'chip' }, L.cur.name.toUpperCase()), h('b', {}, `Level ${L.i + 1} · ${L.xp.toLocaleString()} XP`), L.next ? h('small', {}, `${(L.next.xp - L.xp).toLocaleString()} XP to ${L.next.name}`) : h('small', {}, 'Top level — Mythic!')),
      h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(L.pct * 100)}%` })),
      h('div', { class: 'steps' }, ...V1_LEVELS.map((l, k) => h('span', { class: k <= L.i ? 'on' : '', style: `--c:${l.color}` }, l.name))),
      h('p', { class: 'how' }, 'XP comes from days with Oto, ads blocked, spaces, pages and badges.')),
    h('div', { class: 'row2' }, h('span', { class: 'lab' }, 'Edition'),
      h('div', { class: 'seg' }, h('button', { class: ed === 'standard' ? 'on' : '', onclick: () => pick('standard') }, 'Standard'), h('button', { class: ed === 'og' ? 'on' : '', onclick: () => pick('og') }, 'OG ★'),
        owner ? h('button', { class: ed === 'founder' ? 'on' : '', onclick: () => pick('founder') }, 'Founder 力') : h('button', { class: 'locked', title: 'Only the owner can unlock this', disabled: true }, '🔒 Founder'))),
    h('div', { class: 'row2' }, h('span', { class: 'lab' }, 'Level titles'), h('div', { class: 'titles' }, ...titles.map(({ l, open }) => h('button', {
      class: `${open ? '' : 'locked'}${S.card && S.card.title === l.title ? ' on' : ''}`, disabled: !open, title: open ? 'Use this title' : `Unlocks at ${l.name}`,
      onclick: () => { S.card.title = l.title; save(); renderLibrary(); },
    }, open ? l.title : `🔒 ${l.name}`)))),
    h('div', { class: 'row2' }, h('span', { class: 'lab' }, 'Badges'), h('div', { class: 'badges' }, ...Object.entries(V1_BADGES).map(([id, [label, ic]]) => {
      const on = !!(S.v1Badges || {})[id];
      return h('span', { class: on ? 'on' : '', title: on ? label : 'Hidden badge — keep using Oto to find it' }, on ? ic : '?');
    }))));
}

// ================================================================ Now Playing (art + waveform)
const V1NP = { meta: null, tabId: null, t: 0 };
async function v1NowPlayingTick() {
  const t = typeof media !== 'undefined' && media && tabById(media.tabId);
  const v = t && V.get(t.id);
  if (!v) { V1NP.meta = null; return; }
  try {
    const m = await v.wv.executeJavaScript(`(() => { const md = navigator.mediaSession && navigator.mediaSession.metadata; if (!md) return null; const a = (md.artwork || []).slice(-1)[0]; return { title: md.title || '', artist: md.artist || '', art: a ? a.src : '' }; })()`);
    const changed = JSON.stringify(m) !== JSON.stringify(V1NP.meta) || V1NP.tabId !== t.id;
    V1NP.meta = m; V1NP.tabId = t.id;
    if (changed) renderMedia();
  } catch {}
}

// ================================================================ new tab widgets
function v1Widgets() {
  if (AVOCADO_MODE || S.settings.v1Widgets === false) { const w = $('#v1Widgets'); if (w) w.remove(); return; }
  let box = $('#v1Widgets');
  if (!box) { box = h('div', { id: 'v1Widgets', class: 'v1-widgets' }); const j = $('#v1Jump') || $('#emptySearch'); j.after(box); }
  const L = v1Level();
  const counts = {};
  for (const it of (S.history || []).slice(0, 800)) { const hst = hostOf(it.u); if (hst) counts[hst] = (counts[hst] || 0) + 1; }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  box.replaceChildren(
    h('button', { class: 'wg card', style: `--lc:${L.cur.color}`, onclick: () => openLibrary('card') }, h('span', { class: 'k' }, 'OTO CARD'), h('b', {}, `${L.cur.name} · Level ${L.i + 1}`),
      h('span', { class: 'bar' }, h('i', { style: `width:${Math.round(L.pct * 100)}%` })), h('small', {}, L.next ? `${(L.next.xp - L.xp).toLocaleString()} XP to ${L.next.name}` : 'Mythic — the top!')),
    h('div', { class: 'wg sc' }, h('span', { class: 'k' }, 'SHORTCUTS'), h('div', { class: 'ic' }, ...(top.length ? top.map(([hst]) => h('button', { title: hst, onclick: () => openUrl(`https://${hst}/`) }, favEl({ url: `https://${hst}/`, title: hst }, null, true), h('span', {}, hst.replace(/^www\./, '').split('.')[0]))) : [h('small', {}, 'Sites you visit a lot show up here.')]))),
  );
}

// ================================================================ space switch animation
function v1SpaceSplash(ws) {
  if (S.settings.reduceMotion || S.settings.animations === 'off' || S.settings.v1Splash === false || !ws) return;
  const th = themeOf(ws);
  const el = h('div', { class: 'v1-splash', style: `--g:linear-gradient(135deg, ${th.colors.join(', ')})` }, h('span', {}, ws.name));
  document.body.append(el);
  setTimeout(() => el.remove(), 900);
}

// ================================================================ tab peek
const V1P = { t: 0, el: null, cache: new Map() };
function v1HidePeek() { clearTimeout(V1P.t); if (V1P.el) { V1P.el.remove(); V1P.el = null; } }
function v1Peek(row) {
  const t = tabById(row.dataset.id);
  if (!t || S.settings.v1Peek === false || document.body.classList.contains('dragging')) return;
  const v = V.get(t.id);
  const r = row.getBoundingClientRect();
  const card = h('div', { class: 'v1-peek' }, h('div', { class: 'img' }), h('div', { class: 'tx' }, h('b', {}, t.title || prettyUrl(t.url)), h('small', {}, prettyUrl(t.url)),
    h('span', { class: 'm' }, v ? (V1H.mem.get(t.id) ? `${V1H.mem.get(t.id)} MB` : 'Open') : 'Sleeping — click to wake')));
  const left = Math.min(r.right + 10, innerWidth - 300);
  card.style.left = `${left}px`; card.style.top = `${clamp(r.top - 40, 8, innerHeight - 230)}px`;
  document.body.append(card);
  V1P.el = card;
  const img = card.querySelector('.img');
  const c = V1P.cache.get(t.id);
  if (c) img.style.backgroundImage = `url(${c.url})`;
  if (v && t.id !== (activeTab() || {}).id && (!c || Date.now() - c.at > 30000)) {
    v.wv.capturePage().then((im) => { if (im.isEmpty()) { if (!c) img.classList.add('none'); return; } const url = im.resize({ width: 560 }).toDataURL(); V1P.cache.set(t.id, { url, at: Date.now() }); if (V1P.el === card) img.style.backgroundImage = `url(${url})`; }).catch(() => {});
  } else if (!c) img.classList.add('none');
}

// ================================================================ ambient glow around videos
async function v1AmbientTick() {
  const v = activeView(), t = activeTab();
  const content = $('#content');
  if (!v || !t || !v.audible || S.settings.v1Ambient === false || document.hidden || V1H.saver) { content.style.removeProperty('--v1-amb'); content.classList.remove('v1-amb'); return; }
  try {
    const im = await v.wv.capturePage();
    const small = im.resize({ width: 16, height: 9 });
    const img = new Image();
    img.src = small.toDataURL();
    await img.decode();
    const c = document.createElement('canvas'); c.width = 16; c.height = 9;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, 16, 9).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const lum = d[i] + d[i + 1] + d[i + 2]; if (lum < 60 || lum > 720) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    if (!n) return;
    content.style.setProperty('--v1-amb', `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
    content.classList.add('v1-amb');
  } catch {}
}

// ================================================================ focus mode + reader
const V1F2 = { on: false, end: 0, tick: 0, muted: [] };
function v1Focus(minutes = 25) {
  if (V1F2.on) return v1EndFocus();
  const act = activeTab();
  if (!act || !activeView()) return toast('Open a page to focus on', { timeout: 1600 });
  V1F2.on = true; V1F2.end = Date.now() + minutes * 60000; V1F2.muted = [];
  for (const [id, v] of V) if (id !== act.id && !v.muted) { v.muted = true; wv(v, (w) => w.setAudioMuted(true)); V1F2.muted.push(id); }
  document.body.classList.add('v1-focus');
  const pill = h('div', { id: 'v1FocusPill', class: 'v1-focuspill' }, h('span', { class: 'ic', html: icon('eye') }), h('b', { class: 'tm' }, ''),
    h('button', { onclick: () => v1Reader() }, 'Reader'), h('button', { onclick: () => { V1F2.end += 5 * 60000; } }, '+5 min'), h('button', { class: 'end', onclick: v1EndFocus }, 'End'));
  document.body.append(pill);
  const paint = () => {
    const left = Math.max(0, V1F2.end - Date.now());
    pill.querySelector('.tm').textContent = `Focus · ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
    if (!left) { v1EndFocus(); v1Sound('done'); toast('Focus session done — nice work 🎯', { icon: 'check', timeout: 4000 }); v1Badge('focus'); try { new Notification('Oto — focus session done', { body: 'Time for a break.' }); } catch {} }
  };
  paint(); V1F2.tick = setInterval(paint, 1000);
  toast(`Focus for ${minutes} minutes — other tabs are muted`, { icon: 'eye', timeout: 2200 });
}
function v1EndFocus() {
  V1F2.on = false; clearInterval(V1F2.tick);
  document.body.classList.remove('v1-focus');
  const p = $('#v1FocusPill'); if (p) p.remove();
  for (const id of V1F2.muted) { const v = V.get(id); if (v) { v.muted = false; wv(v, (w) => w.setAudioMuted(false)); } }
  V1F2.muted = []; render();
}
const V1_READER_JS = `(() => { const old = document.getElementById('__otoReader'); if (old) { old.remove(); document.documentElement.style.overflow = ''; return 'off'; }
  let best = null, bestScore = 0;
  for (const el of document.querySelectorAll('article, main, [role=main], .post, .entry, .content, #content, section, div')) { const ps = el.querySelectorAll(':scope > p, :scope > div > p'); let s = 0; ps.forEach(p => s += Math.min(p.innerText.length, 600)); if (s > bestScore) { bestScore = s; best = el; } }
  if (!best || bestScore < 400) return 'none';
  const title = (document.querySelector('h1') || {}).innerText || document.title;
  const box = document.createElement('div'); box.id = '__otoReader';
  box.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{all:initial;position:fixed;inset:0;z-index:2147483647;background:#fbf8f2;overflow:auto;font:19px/1.75 Georgia,serif;color:#24201b}.w{max-width:680px;margin:0 auto;padding:60px 28px 120px}h1{font:700 38px/1.15 Georgia,serif;margin:0 0 30px}img{max-width:100%;height:auto;border-radius:10px}a{color:#9a4a1c}.x{position:fixed;top:16px;right:20px;font:600 13px system-ui;background:#24201b;color:#fff;border:0;border-radius:99px;padding:8px 14px;cursor:pointer}@media (prefers-color-scheme:dark){:host{background:#16130f;color:#e9e2d6}a{color:#f0a370}.x{background:#e9e2d6;color:#16130f}}</style><button class="x">Close reader</button><div class="w"><h1></h1><div class="c"></div></div>';
  const sr = box.shadowRoot; sr.querySelector('h1').textContent = title; const c = best.cloneNode(true);
  c.querySelectorAll('script,style,nav,aside,form,iframe,button,svg,[aria-hidden=true],.ad,.ads,[class*=share],[class*=related],[class*=comment]').forEach(n => n.remove());
  sr.querySelector('.c').append(c); sr.querySelector('.x').onclick = () => { box.remove(); document.documentElement.style.overflow = ''; };
  document.documentElement.appendChild(box); document.documentElement.style.overflow = 'hidden'; return 'on'; })()`;
async function v1Reader() {
  const v = activeView();
  if (!v) return;
  try { const r = await v.wv.executeJavaScript(V1_READER_JS); if (r === 'none') toast('No article found on this page', { timeout: 1800 }); } catch {}
}

// ================================================================ breathing background while music plays
function v1Breath() {
  let el = $('#v1Breath');
  if (!el) { el = h('div', { id: 'v1Breath', class: 'v1-breath' }); document.body.prepend(el); }
  const any = [...V.values()].some((v) => v.audible && !v.muted);
  el.classList.toggle('on', any && S.settings.v1Breath !== false && !S.settings.reduceMotion && !document.body.classList.contains('skin-rt'));
}

// ================================================================ units & timers in the command bar
const V1_UNITS = {
  km: ['mi', (v) => v * 0.621371], mi: ['km', (v) => v / 0.621371], kg: ['lb', (v) => v * 2.20462], lb: ['kg', (v) => v / 2.20462], lbs: ['kg', (v) => v / 2.20462],
  cm: ['in', (v) => v / 2.54], in: ['cm', (v) => v * 2.54], m: ['ft', (v) => v * 3.28084], ft: ['m', (v) => v / 3.28084], c: ['°F', (v) => v * 9 / 5 + 32], f: ['°C', (v) => (v - 32) * 5 / 9],
  l: ['gal', (v) => v * 0.264172], gal: ['l', (v) => v / 0.264172], g: ['oz', (v) => v / 28.3495], oz: ['g', (v) => v * 28.3495],
};
function v1Unit(q) {
  const m = /^(-?\d+(?:[.,]\d+)?)\s*(km|mi|kg|lbs?|cm|in|m|ft|°?c|°?f|l|gal|g|oz)\b(?:\s*(?:to|in|=)\s*\S+)?$/i.exec(q.trim());
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.')), u = m[2].toLowerCase().replace('°', '');
  const conv = V1_UNITS[u];
  if (!conv) return null;
  const out = conv[1](v);
  return `${Math.round(out * 100) / 100} ${conv[0]}`;
}
const V1TM = { list: [] };
function v1Timer(q) {
  const m = /^(?:timer\s+)?(\d+(?:[.,]\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hours?)(?:\s+timer)?$/i.exec(q.trim());
  if (!m || !/timer/i.test(q)) return null;
  const n = parseFloat(m[1].replace(',', '.')), u = m[2][0].toLowerCase();
  const ms = n * (u === 's' ? 1000 : u === 'h' ? 3600e3 : 60e3);
  return { ms, label: `${n} ${u === 's' ? 'second' : u === 'h' ? 'hour' : 'minute'}${n === 1 ? '' : 's'}` };
}
function v1StartTimer(tm) {
  const end = Date.now() + tm.ms;
  const pill = h('button', { class: 'v1-timer', title: 'Click to cancel' });
  const id = setInterval(() => {
    const left = end - Date.now();
    if (left <= 0) {
      clearInterval(id); pill.remove();
      v1Sound('done'); toast(`⏱ ${tm.label} timer is done`, { icon: 'clock', timeout: 8000 });
      try { new Notification('Oto timer', { body: `${tm.label} — time’s up!` }); } catch {}
      return;
    }
    pill.textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
  }, 250);
  pill.onclick = () => { clearInterval(id); pill.remove(); toast('Timer cancelled', { timeout: 1200 }); };
  let box = $('#v1Timers');
  if (!box) { box = h('div', { id: 'v1Timers', class: 'v1-timers' }); document.body.append(box); }
  box.append(pill);
  toast(`Timer started: ${tm.label}`, { icon: 'clock', timeout: 1500 });
}

// ================================================================ the Owner panel (owner key only)
function v1OwnerPanel() {
  if (!(UPD && UPD.owner)) return toast('The Owner panel needs your owner key (Settings → About → tap “Oto version” 7 times)', { timeout: 3500 });
  v1ClosePop();
  const L = v1Level();
  const flags = [['v1Menu', 'New right-click menu'], ['v1Quick', 'Quick window for links from other apps'], ['v1Cookies', 'Auto-reject cookie popups'], ['v1Clean', 'Clean links on copy'],
    ['v1Video', 'Video tools'], ['v1Swipe', 'Two-finger swipe'], ['v1Ambient', 'Ambient glow'], ['v1Peek', 'Tab peek'], ['v1Breath', 'Breathing background'], ['v1Splash', 'Space switch animation'],
    ['v1Widgets', 'New tab widgets'], ['v1CtrlSheet', 'Hold-Ctrl sheet'], ['v1Intro', 'Startup animation']];
  const tool = (label, run, cls) => h('button', { class: `ob${cls ? ` ${cls}` : ''}`, onclick: () => { run(); } }, label);
  const layer = v1Layer(v1ClosePop); v1Pop = layer;
  const panel = h('div', { class: 'v1-pop v1-owner' },
    h('div', { class: 'oh' }, h('span', { class: 'mk' }, '力'), h('div', {}, h('b', {}, 'Owner panel'), h('small', {}, `Oto ${UPD.version || INFO.version} · ${S.settings.updateChannel || 'stable'} channel`)), h('button', { class: 'x', html: icon('x'), onclick: v1ClosePop })),
    h('div', { class: 'osec' }, h('div', { class: 'ot' }, 'CARD & LEVELS'), h('p', {}, `${L.cur.name} · ${L.xp.toLocaleString()} XP · ${Object.keys(S.v1Badges || {}).length}/${Object.keys(V1_BADGES).length} badges`),
      h('div', { class: 'og' },
        tool('+500 XP', () => { S.v1XpBonus = (S.v1XpBonus || 0) + 500; save(); v1CheckLevel(); v1OwnerPanel(); }),
        tool('Reset XP bonus', () => { S.v1XpBonus = 0; S.v1LevelSeen = v1Level().i; save(); v1OwnerPanel(); }),
        tool('Show level-up', () => { v1ClosePop(); v1LevelUp(v1Level()); }),
        tool('Unlock all badges', () => { S.v1Badges = Object.fromEntries(Object.keys(V1_BADGES).map((k) => [k, Date.now()])); save(); v1OwnerPanel(); }),
        tool('Clear badges', () => { S.v1Badges = {}; save(); v1OwnerPanel(); }),
        tool('Founder card', () => { S.card = S.card || {}; S.card.edition = 'founder'; S.card.name = S.card.name || 'Ryo'; save(); v1ClosePop(); openLibrary('card'); }, 'gold'))),
    h('div', { class: 'osec' }, h('div', { class: 'ot' }, 'TEST SCREENS'),
      h('div', { class: 'og' },
        tool('Welcome setup', () => { v1ClosePop(); S.onboarded = false; save(); runSetup(); }),
        tool('What’s new', () => { v1ClosePop(); showWhatsNew({ all: true }); }),
        tool('Startup animation', () => { v1ClosePop(); const was = S.settings.v1Intro; S.settings.v1Intro = true; v1Intro(); S.settings.v1Intro = was; }),
        tool('Offline page', () => { v1ClosePop(); const v = activeView(), t = activeTab(); if (v && t) { v.error = { code: -106, desc: 'ERR_INTERNET_DISCONNECTED', url: t.url }; updateChrome(); } }),
        tool('Update card', () => { v1ClosePop(); v1UpdateCard({ state: 'ready', version: 'test' }); }),
        tool('Wrapped', () => { v1ClosePop(); v1Wrapped(); }),
        tool('Shortcut sheet', () => { v1ClosePop(); v1ShortcutSheet(true); }),
        tool('Check for updates', () => { oto.updateCheck().then(onUpdate); toast('Checking…', { timeout: 1200 }); }))),
    h('div', { class: 'osec' }, h('div', { class: 'ot' }, 'FEATURE SWITCHES'),
      h('div', { class: 'flags' }, ...flags.map(([k, label]) => h('label', {}, h('button', { class: `switch${S.settings[k] !== false ? ' on' : ''}`, role: 'switch', onclick: (e) => { S.settings[k] = S.settings[k] === false; save(); if (k === 'v1Menu') syncMainSettings(); e.currentTarget.classList.toggle('on', S.settings[k] !== false); } }), h('span', {}, label))))),
    h('div', { class: 'osec' }, h('div', { class: 'ot' }, 'INFO'),
      h('p', { class: 'mono' }, `Tabs ${S.tabs.length} · open ${V.size} · spaces ${S.workspaces.length} · history ${(S.history || []).length} · since ${new Date(S.since || Date.now()).toLocaleDateString()}`),
      h('div', { class: 'og' }, tool('Save problem report', () => { v1ClosePop(); openSettings('about'); }), tool('Lock owner (this PC)', () => { oto.ownerLock().then(() => { UPD.owner = false; v1ClosePop(); toast('Owner locked on this PC', { timeout: 1600 }); }); }, 'danger'))));
  layer.append(panel);
}

// ================================================================ init
function initV1d() {
  // card: editions, level frame, back side, level panel
  const _svg = cardSvg;
  cardSvg = function (m = cardModel(), opts) {
    const ed = v1Edition();
    if (V1D.back) return v1CardBack();
    if (ed === 'og') return v1CardOG(m);
    if (ed === 'founder') return v1CardFounder(m);
    return _svg.apply(this, arguments);
  };
  const _card = LIB_RENDER.card;
  LIB_RENDER.card = function () {
    const out = _card.apply(this, arguments);
    setTimeout(() => {
      const pv = document.querySelector('.card-preview');
      if (pv) {
        const L = v1Level();
        pv.classList.add(`v1-lvl-${L.cur.id}`, `v1-ed-${v1Edition()}`);
        const acts = document.querySelector('.card-actions');
        if (acts && !acts.querySelector('.v1-flip')) acts.append(h('button', { class: 'btn v1-flip', title: 'See your badges on the back', onclick: () => { V1D.back = !V1D.back; const a = pv.querySelector('.card-tilt'); if (a) { a.classList.add('v1-flipping'); setTimeout(() => { const s = pv.querySelector('.card-art-svg'); if (s) s.innerHTML = cardSvg(cardModel()); a.classList.remove('v1-flipping'); }, 200); } } }, '↻ Flip'));
      }
      const form = document.querySelector('.card-form');
      if (form && !form.querySelector('.v1-cardpanel')) { const intro = form.querySelector('.lib-intro'); (intro || form.firstChild).after(v1CardPanel()); }
    }, 0);
    return out;
  };
  // badges from features
  const wrap = (name, id) => { const f = globalThis[name] || (typeof window[name] === 'function' ? window[name] : null); if (typeof f !== 'function') return; };
  void wrap;
  const _split = startSplit; startSplit = function () { const r = _split.apply(this, arguments); v1Badge('split'); return r; };
  const _nf = v1NewFolder; v1NewFolder = async function () { const r = await _nf.apply(this, arguments); if ((S.v1Folders || []).length) v1Badge('folder'); return r; };
  const _se = v1ShotEditor; v1ShotEditor = function () { v1Badge('shot'); return _se.apply(this, arguments); };
  const _wr = v1Wrapped; v1Wrapped = function () { v1Badge('wrapped'); return _wr.apply(this, arguments); };
  const _tm = v1ThemeMaker; v1ThemeMaker = function () { v1Badge('theme'); return _tm.apply(this, arguments); };
  const _np = v1NotePanel; v1NotePanel = function () { const r = _np.apply(this, arguments); if (Object.keys(S.v1Notes || {}).length) v1Badge('note'); return r; };
  const avo = () => { v1Badge('avocado'); oto.openAvocado(); };
  CMDS.avocado = avo;
  const aa = ACTIONS.find((a) => a.name === 'Open an Avocado window'); if (aa) aa.run = avo;
  if (typeof V1_FOOT !== 'undefined' && V1_FOOT.avocado) V1_FOOT.avocado[2] = avo;
  // slash list: /focus, /reader, /admin
  const _slash = v1Slash;
  v1Slash = function (q) {
    const items = _slash.apply(this, arguments);
    const cmd = (q.slice(1).split(/\s+/)[0] || '').toLowerCase();
    const mine = [['focus', 'Focus mode — hide everything, mute other tabs', 'eye', () => v1Focus(25)], ['reader', 'Reader view for this page', 'book', v1Reader], ['timer', 'Start a timer — type “timer 5 min”', 'clock', null]];
    if (UPD && UPD.owner) mine.push(['admin', 'Owner panel', 'key', v1OwnerPanel]);
    for (const [c, d, ic, run] of mine) if (c.startsWith(cmd) && !items.some((it) => it.t === `/${c}`)) items.push({ g: 'Commands', icon: ic, t: `/${c}`, s: d, hint: run ? 'Run' : 'Type', run: () => { if (!run) { $('#cmdInput').value = 'timer 5 min'; computeItems(); return; } closeCmd(false); run(); } });
    return items;
  };
  // Now Playing art + waveform
  const _rm = renderMedia;
  renderMedia = function () {
    _rm.apply(this, arguments);
    const card = $('#mediaCard');
    if (!card || card.hidden) return;
    const info = card.querySelector('.mc-info');
    const m = V1NP.meta;
    if (info && m && m.art && V1NP.tabId === (media || {}).tabId) {
      const fav = info.firstElementChild;
      const art = h('img', { class: 'v1-np-art', src: m.art, alt: '' });
      art.onerror = () => art.remove();
      if (fav) fav.replaceWith(art);
      const tx = info.querySelector('.mc-text');
      if (tx && m.title) tx.replaceChildren(h('b', {}, m.title), h('small', {}, m.artist || hostOf(tabById(media.tabId).url)));
    }
    if (!card.querySelector('.v1-np-wave')) card.append(h('div', { class: `v1-np-wave${media && media.playing ? ' on' : ''}` }, ...Array.from({ length: 18 }, () => h('i'))));
  };
  setInterval(v1NowPlayingTick, 3000);
  // new tab widgets + level checks
  const _uc = updateClock;
  updateClock = function () { _uc.apply(this, arguments); v1Widgets(); };
  v1AutoBadges(); v1CheckLevel();
  setInterval(() => { v1AutoBadges(); v1CheckLevel(); }, 10 * 60 * 1000);
  // space switch splash
  const _sw = switchWorkspace;
  switchWorkspace = function (id) { const was = S.activeWs; const r = _sw.apply(this, arguments); if (id !== was) v1SpaceSplash(S.workspaces.find((w) => w.id === id)); return r; };
  // tab peek
  const sb = $('#sidebar');
  sb.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.tab[data-id]');
    if (!row) return;
    if (V1P.row === row) return;
    V1P.row = row; v1HidePeek();
    V1P.t = setTimeout(() => v1Peek(row), 650);
  });
  sb.addEventListener('mouseleave', () => { V1P.row = null; v1HidePeek(); });
  sb.addEventListener('mousedown', () => { V1P.row = null; v1HidePeek(); }, true);
  // ambient glow + breathing background
  setInterval(v1AmbientTick, 3000);
  const _rn = renderNow;
  renderNow = function () { _rn.apply(this, arguments); v1Breath(); };
  // command bar: units, timers, /focus, /admin
  const _compute = computeItems;
  computeItems = function () {
    const q = $('#cmdInput').value.trim();
    const low = q.toLowerCase();
    if (low === '/admin' || low === '/owner') { C.items = [{ g: 'Commands', icon: 'key', t: low, s: UPD && UPD.owner ? 'Open the Owner panel' : 'Needs the owner key', hint: 'Run', run: () => { closeCmd(false); v1OwnerPanel(); } }]; C.sel = 0; renderCmd(); return; }
    if (/^\/focus/.test(low)) { const n = parseInt(low.split(/\s+/)[1], 10) || 25; C.items = [{ g: 'Commands', icon: 'eye', t: `/focus ${n}`, s: `Focus mode for ${n} minutes`, hint: 'Run', run: () => { closeCmd(false); v1Focus(n); } }]; C.sel = 0; renderCmd(); return; }
    _compute.apply(this, arguments);
    const extra = [];
    const u = q && v1Unit(q);
    if (u) extra.push({ g: 'Quick answer', icon: 'calc', t: q, ans: u, s: '', hint: 'Copy', run: () => { oto.copy(u); closeCmd(false); toast(`Copied ${u}`, { icon: 'copy', timeout: 1400 }); } });
    const tm = q && v1Timer(q);
    if (tm) extra.push({ g: 'Quick answer', icon: 'clock', t: `Start a ${tm.label} timer`, s: '', hint: 'Start', run: () => { closeCmd(false); v1StartTimer(tm); } });
    if (extra.length) { C.items = [...extra, ...C.items]; C.sel = 0; renderCmd(); }
  };
  ACTIONS.push(
    { name: 'Focus mode', kw: 'focus pomodoro concentrate timer reader', icon: 'eye', run: () => v1Focus(25) },
    { name: 'Reader view', kw: 'reader article read clean', icon: 'book', run: v1Reader },
    { name: 'Owner panel', kw: 'admin owner tools test debug', icon: 'key', run: v1OwnerPanel },
  );
  if (typeof V1_FOOT !== 'undefined') {
    V1_FOOT.focus = ['eye', 'Focus mode', () => v1Focus(25)];
    V1_FOOT.reader = ['book', 'Reader view', () => v1Reader()];
    V1_FOOT.owner = ['key', 'Owner panel', () => v1OwnerPanel()];
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && V1F2.on && !v1Pop && !document.querySelector('.overlay:not([hidden])')) { /* Esc doesn't end focus by accident */ } }, true);
}
const V1D = { back: false };
