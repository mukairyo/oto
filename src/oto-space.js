// Oto — the space look for the New Tab start page and the Oto Card (1.8.3), from the approved design
// (Sky/VPN starfield, cyan #7FE3FF). Six levels, six kinds of star: moon, red dwarf, ringed world, sun, nebula,
// galaxy. The planets are plain SVG so the same art works on the start page, the card (and its saved PNG) and the
// level-up flip. Loaded after renderer.js and the v1 files; it only adds to what they draw.
/* global S, V1D, V1_LEVELS, V1_BADGES, v1Level, v1Edition, v1CardId, cardModel, cardStatValue, CARD_STATS, esc, h, $, icon,
   updateClock, AVOCADO_MODE, startBack, save */

const SPACE_KINDS = { rookie: 'MOON', bronze: 'RED DWARF', silver: 'RINGED WORLD', gold: 'SUN', holo: 'NEBULA', mythic: 'GALAXY' };
const SPACE_STAR = 'M12 2Q12.8 11.2 22 12Q12.8 12.8 12 22Q11.2 12.8 2 12Q11.2 11.2 12 2z';
let spaceUid = 0;

// The planet for a level, as SVG markup in a 100×100 box (drawn at `size` px when `size` is given).
function spacePlanetSvg(id, { inner = false } = {}) {
  const u = `sp${++spaceUid}`;
  const crater = (x, y, r, o) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#000" fill-opacity="${o}"/>`;
  const art = {
    rookie: `<defs><radialGradient id="${u}a" cx=".34" cy=".3" r=".75"><stop offset="0" stop-color="#eef1f5"/><stop offset=".48" stop-color="#a3adbb"/><stop offset=".82" stop-color="#48505e"/><stop offset="1" stop-color="#2a2f38"/></radialGradient>
      <radialGradient id="${u}g"><stop offset=".55" stop-color="#94a3b8" stop-opacity=".35"/><stop offset="1" stop-color="#94a3b8" stop-opacity="0"/></radialGradient></defs>
      <circle cx="50" cy="50" r="48" fill="url(#${u}g)"/><circle cx="50" cy="50" r="30" fill="url(#${u}a)"/>${crater(41, 41, 5.5, 0.14)}${crater(58, 56, 3.8, 0.12)}${crater(46, 63, 2.6, 0.12)}${crater(60, 40, 2, 0.1)}`,
    bronze: `<defs><radialGradient id="${u}a" cx=".4" cy=".36" r=".72"><stop offset="0" stop-color="#ffd8b0"/><stop offset=".45" stop-color="#e08a4a"/><stop offset="1" stop-color="#8a3b14"/></radialGradient>
      <radialGradient id="${u}g"><stop offset=".4" stop-color="#e08a4a" stop-opacity=".55"/><stop offset="1" stop-color="#c2773d" stop-opacity="0"/></radialGradient></defs>
      <circle cx="50" cy="50" r="49" fill="url(#${u}g)"/><circle cx="50" cy="50" r="27" fill="url(#${u}a)"/>`,
    silver: `<defs><radialGradient id="${u}a" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cbd5e1"/><stop offset="1" stop-color="#64748b"/></radialGradient>
      <radialGradient id="${u}g"><stop offset=".5" stop-color="#cbd5e1" stop-opacity=".3"/><stop offset="1" stop-color="#cbd5e1" stop-opacity="0"/></radialGradient></defs>
      <circle cx="50" cy="50" r="46" fill="url(#${u}g)"/>
      <path d="M8 56 A42 11 -14 0 1 92 44" fill="none" stroke="#e2e8f0" stroke-opacity=".55" stroke-width="2.4"/>
      <circle cx="50" cy="50" r="24" fill="url(#${u}a)"/>
      <path d="M92 44 A42 11 -14 0 1 8 56" fill="none" stroke="#e2e8f0" stroke-opacity=".9" stroke-width="2.4"/>`,
    gold: `<defs><radialGradient id="${u}a" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#fff7d6"/><stop offset=".5" stop-color="#f5c542"/><stop offset="1" stop-color="#c27b0c"/></radialGradient>
      <radialGradient id="${u}g"><stop offset=".3" stop-color="#f5c542" stop-opacity=".6"/><stop offset="1" stop-color="#f5c542" stop-opacity="0"/></radialGradient></defs>
      <circle cx="50" cy="50" r="50" fill="url(#${u}g)"/>
      <g stroke="#fde68a" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round">${Array.from({ length: 12 }, (_, k) => { const a = (k * Math.PI) / 6, r1 = 31, r2 = k % 2 ? 38 : 43; return `<line x1="${(50 + r1 * Math.cos(a)).toFixed(1)}" y1="${(50 + r1 * Math.sin(a)).toFixed(1)}" x2="${(50 + r2 * Math.cos(a)).toFixed(1)}" y2="${(50 + r2 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</g>
      <circle cx="50" cy="50" r="26" fill="url(#${u}a)"/>`,
    holo: `<defs><filter id="${u}b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs>
      <g filter="url(#${u}b)"><ellipse cx="44" cy="52" rx="30" ry="22" fill="#a78bfa" fill-opacity=".85"/><ellipse cx="62" cy="46" rx="24" ry="18" fill="#7FE3FF" fill-opacity=".7"/><ellipse cx="54" cy="66" rx="20" ry="13" fill="#f9a8d4" fill-opacity=".7"/></g>
      <circle cx="47" cy="49" r="7" fill="#fff" fill-opacity=".85" filter="url(#${u}b)"/><circle cx="47" cy="49" r="2.4" fill="#fff"/>
      <circle cx="26" cy="34" r=".9" fill="#fff"/><circle cx="74" cy="70" r=".8" fill="#fff"/><circle cx="70" cy="30" r=".7" fill="#fff"/>`,
    mythic: `<defs><radialGradient id="${u}a" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#E8F9FF"/><stop offset=".16" stop-color="#7FE3FF" stop-opacity=".85"/><stop offset=".45" stop-color="#22d3ee" stop-opacity=".35"/><stop offset=".7" stop-color="#a78bfa" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <filter id="${u}b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>
      <g transform="rotate(-16 50 50)"><ellipse cx="50" cy="50" rx="49" ry="20" fill="url(#${u}a)"/>
        <g filter="url(#${u}b)" fill="none" stroke="#E8F9FF" stroke-opacity=".55" stroke-width="1.6"><path d="M50 50 C60 42 78 44 86 52"/><path d="M50 50 C40 58 22 56 14 48"/>
        ${inner ? '' : `<animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="60s" repeatCount="indefinite"/>`}</g>
        <ellipse cx="50" cy="50" rx="36" ry="10" fill="none" stroke="#E8F9FF" stroke-opacity=".35" stroke-dasharray="1.5 3"/></g>
      <circle cx="50" cy="50" r="5" fill="#fff"/><circle cx="50" cy="50" r="10" fill="#7FE3FF" fill-opacity=".35" filter="url(#${u}b)"/>`,
  }[id] || '';
  return art;
}
function spacePlanet(id, size = 54) {
  return `<svg class="sh-pl pl-${esc(id)}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${spacePlanetSvg(id)}</svg>`;
}

// A starfield for the cards, the same for one card every time (seeded).
function spaceStars(seed, W, H, n, y0 = 0) {
  let s = (seed >>> 0) || 7, out = '';
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  for (let k = 0; k < n; k++) { const x = rnd() * W, y = y0 + rnd() * (H - y0), r = rnd() < 0.08 ? 1.1 : 0.55; out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" fill-opacity="${(0.25 + rnd() * 0.55).toFixed(2)}"/>`; }
  return out;
}

// ---------------------------------------------------------------- the card, front (the "Space" design)
function cardSvgSpace(m = cardModel()) {
  const W = 320, H = 504, L = v1Level(), lv = L.cur, col = lv.color;
  const serif = "'Instrument Serif',Georgia,'Times New Roman',serif", mono = "'JetBrains Mono','Cascadia Mono',Consolas,monospace", sans = "'Segoe UI Variable Display','Segoe UI',Inter,system-ui,sans-serif";
  const u = `cs${++spaceUid}`;
  const cx = W / 2, cy = 168, R = 96, C = 2 * Math.PI * R, pct = Math.max(0.02, Math.min(1, L.pct));
  const a = -Math.PI / 2 + pct * 2 * Math.PI, mx = cx + R * Math.cos(a), my = cy + R * Math.sin(a);
  const stars = V1_LEVELS.map((_, k) => `<path transform="translate(${cx - 66 + k * 24} 392) scale(.55)" d="${SPACE_STAR}" ${k <= L.i ? `fill="${col}"` : 'fill="none" stroke="#ece8e1" stroke-opacity=".3" stroke-width="2.2"'}/>`).join('');
  const stats = m.showStats ? m.stats.slice(0, 3) : [];
  const statsSvg = stats.map((k, i) => {
    const x = stats.length === 1 ? cx : 28 + i * ((W - 56) / Math.max(1, stats.length - 1)), anchor = stats.length === 1 ? 'middle' : i === 0 ? 'start' : i === stats.length - 1 ? 'end' : 'middle';
    const v = cardStatValue(k);
    return `<text x="${x}" y="${H - 50}" text-anchor="${anchor}" font-family="${mono}" font-size="8.5" letter-spacing="1.4" fill="#ece8e1" fill-opacity=".6">${esc((CARD_STATS[k] || k).toUpperCase())}</text>
      <text x="${x}" y="${H - 28}" text-anchor="${anchor}" font-family="${sans}" font-size="18" font-weight="600" fill="#ece8e1">${esc(Number(v).toLocaleString())}</text>`;
  }).join('');
  const next = L.next ? `${(L.next.xp - L.xp).toLocaleString()} XP to ${L.next.name}` : 'The top: Mythic';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="${u}bg" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#14161e"/><stop offset="1" stop-color="#08090c"/></linearGradient>
    <radialGradient id="${u}top" cx=".5" cy="0" r=".7"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${u}xp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col}"/><stop offset="1" stop-color="#E8F9FF"/></linearGradient>
    <linearGradient id="${u}sh" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".46" stop-color="#E8F9FF" stop-opacity=".07"/><stop offset=".53" stop-color="#a78bfa" stop-opacity=".06"/><stop offset=".66" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${u}c"><rect width="${W}" height="${H}" rx="22"/></clipPath></defs>
  <g clip-path="url(#${u}c)"><rect width="${W}" height="${H}" fill="url(#${u}bg)"/><rect width="${W}" height="${H}" fill="url(#${u}top)"/>${spaceStars(m.seed || 7, W, H, 70)}<rect width="${W}" height="${H}" fill="url(#${u}sh)"/></g>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="#fff" stroke-opacity=".13"/>
  <text x="22" y="36" font-family="${mono}" font-size="10.5" letter-spacing="2" fill="#ece8e1" fill-opacity=".64">音 OTO // CARD</text>
  <text x="${W - 22}" y="36" text-anchor="end" font-family="${mono}" font-size="10.5" letter-spacing="2" fill="#ece8e1" fill-opacity=".64">Nº ${esc(m.no || v1CardId())}</text>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#${u}xp)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
  <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9" fill="#FFFFFF" fill-opacity=".18"/><circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="3.6" fill="#FFFFFF"/>
  <ellipse cx="${cx}" cy="${cy}" rx="82" ry="24" fill="none" stroke="#FFFFFF" stroke-opacity=".16" stroke-dasharray="2 5" transform="rotate(-18 ${cx} ${cy})"/>
  <svg x="${cx - 70}" y="${cy - 70}" width="140" height="140" viewBox="0 0 100 100">${spacePlanetSvg(lv.id, { inner: true })}</svg>
  <text x="${cx}" y="300" text-anchor="middle" font-family="${mono}" font-size="10" letter-spacing="2.4" fill="${col}">LEVEL ${L.i + 1} · ${SPACE_KINDS[lv.id] || ''}</text>
  <text x="${cx}" y="344" text-anchor="middle" font-family="${serif}" font-size="44" fill="#ece8e1">${esc(lv.name)}</text>
  <text x="${cx}" y="368" text-anchor="middle" font-family="${sans}" font-size="13" fill="#ece8e1" fill-opacity=".72">${esc(m.name)} · ${esc(m.title)}</text>
  ${stars}
  <text x="${cx}" y="424" text-anchor="middle" font-family="${mono}" font-size="9.5" letter-spacing="1.2" fill="#ece8e1" fill-opacity=".55">${esc(next.toUpperCase())}</text>
  ${stats.length ? `<rect x="22" y="${H - 72}" width="${W - 44}" height=".8" fill="#fff" fill-opacity=".1"/>${statsSvg}` : ''}</svg>`;
}

// ---------------------------------------------------------------- the card, back: badges as a star chart
function spaceCardBack(m = cardModel()) {
  const W = 320, H = 504, got = S.v1Badges || {}, ids = Object.keys(V1_BADGES), L = v1Level();
  const serif = "'Instrument Serif',Georgia,serif", mono = "'JetBrains Mono',Consolas,monospace", sans = "'Segoe UI',Inter,system-ui,sans-serif";
  const u = `cb${++spaceUid}`;
  // fixed spots for the 15 badges, like a real constellation chart
  const P = [[48, 150], [104, 182], [168, 140], [232, 186], [276, 146], [70, 236], [136, 252], [204, 236], [262, 262], [46, 300], [112, 322], [178, 300], [244, 324], [92, 372], [214, 372]];
  const pts = ids.map((id, k) => ({ id, on: !!got[id], x: P[k % P.length][0], y: P[k % P.length][1] }));
  const lit = pts.filter((p) => p.on);
  const lines = lit.slice(1).map((p, k) => `<line x1="${lit[k].x}" y1="${lit[k].y}" x2="${p.x}" y2="${p.y}" stroke="#FFFFFF" stroke-opacity=".45"/>`).join('');
  const dots = pts.map((p) => (p.on
    ? `<circle cx="${p.x}" cy="${p.y}" r="11" fill="#FFFFFF" fill-opacity=".18"/><path transform="translate(${p.x - 6} ${p.y - 6}) scale(.5)" d="${SPACE_STAR}" fill="#FFFFFF"/>
       <text x="${p.x < 80 ? p.x - 10 : p.x > 240 ? p.x + 10 : p.x}" y="${p.y + 22}" text-anchor="${p.x < 80 ? 'start' : p.x > 240 ? 'end' : 'middle'}" font-family="${sans}" font-size="8.5" fill="#ece8e1" fill-opacity=".85">${esc(V1_BADGES[p.id][0])}</text>`
    : `<circle cx="${p.x}" cy="${p.y}" r="2.6" fill="#ece8e1" fill-opacity=".3"/>`)).join('');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="${u}bg" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#14161e"/><stop offset="1" stop-color="#08090c"/></linearGradient>
    <clipPath id="${u}c"><rect width="${W}" height="${H}" rx="22"/></clipPath></defs>
  <g clip-path="url(#${u}c)"><rect width="${W}" height="${H}" fill="url(#${u}bg)"/>${spaceStars((m.seed || 7) + 99, W, H, 50)}</g>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="#fff" stroke-opacity=".13"/>
  <text x="22" y="36" font-family="${mono}" font-size="10.5" letter-spacing="2" fill="#ece8e1" fill-opacity=".64">STAR CHART · BADGES</text>
  <text x="${W - 22}" y="36" text-anchor="end" font-family="${mono}" font-size="10.5" letter-spacing="1.6" fill="#FFFFFF">${lit.length} / ${ids.length} FOUND</text>
  <text x="22" y="74" font-family="${serif}" font-size="26" fill="#ece8e1">Your sky so far</text>
  <text x="22" y="94" font-family="${sans}" font-size="11.5" fill="#ece8e1" fill-opacity=".7">Each badge lights a star. Hidden ones stay</text>
  <text x="22" y="109" font-family="${sans}" font-size="11.5" fill="#ece8e1" fill-opacity=".7">dark until you find them.</text>
  <rect x="16" y="120" width="${W - 32}" height="290" rx="14" fill="#050506" fill-opacity=".5" stroke="#fff" stroke-opacity=".07"/>
  ${lines}${dots}
  <text x="22" y="${H - 52}" font-family="${mono}" font-size="9" letter-spacing="1.6" fill="#ece8e1" fill-opacity=".6">TITLE</text>
  <text x="22" y="${H - 32}" font-family="${sans}" font-size="14" font-weight="500" fill="#ece8e1">${esc(m.title)}</text>
  <text x="${W - 22}" y="${H - 32}" text-anchor="end" font-family="${mono}" font-size="9.5" letter-spacing="1.2" fill="#ece8e1" fill-opacity=".6">${esc(L.cur.name.toUpperCase())} · ${L.xp.toLocaleString()} XP</text></svg>`;
}

// ---------------------------------------------------------------- the New Tab start page
function spaceHome() {
  const on = !AVOCADO_MODE && S.settings.spaceHome !== false;
  document.body.classList.toggle('space-home', on);
  const inner = document.querySelector('#empty .empty-inner');
  if (!on || !inner) return;
  if (!$('#shSky')) $('#empty').prepend(h('div', { id: 'shSky', 'aria-hidden': 'true' }, h('i', { class: 'orbit' }, h('b'))));
  let cr = $('#shCrumb');
  if (!cr) { cr = h('div', { id: 'shCrumb', 'aria-hidden': 'true' }); inner.prepend(cr); }
  const n = Math.max(1, S.workspaces.findIndex((w) => w.id === S.activeWs) + 1);
  const orbit = `ORBIT ${String(n).padStart(2, '0')}`;
  if (cr.dataset.o !== orbit) { cr.dataset.o = orbit; cr.replaceChildren(h('span', { class: 'd' }), h('span', {}, '音 OTO // HOME'), h('span', { class: 'r' }), h('span', { class: 'o' }, orbit)); }
  if (!$('#shSub')) { const g = $('#greet'); if (g) g.after(h('p', { id: 'shSub' }, 'Pick up where you left off, or set a course somewhere new.')); }
  const slot = $('#emptySearch .ic-slot');
  if (slot && !slot.dataset.star) { slot.dataset.star = '1'; slot.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="${SPACE_STAR}" fill="#E8F9FF"/></svg>`; }
  // the card widget: its level's planet, the level and title
  const card = document.querySelector('#v1Widgets .wg.card');
  if (card && !card.querySelector('.sh-pl')) {
    const L = v1Level();
    card.prepend(h('span', { class: 'sh-plw', html: spacePlanet(L.cur.id, 54) }));
    const k = card.querySelector('.k'); if (k) k.textContent = `OTO CARD · LEVEL ${L.i + 1}`;
    const b = card.querySelector('b'); if (b) b.replaceChildren(L.cur.name, h('span', {}, ` · ${L.cur.title}`));
  }
  // shortcuts as a little constellation
  const sc = document.querySelector('#v1Widgets .wg.sc');
  if (sc) { const k = sc.querySelector('.k'); if (k && k.textContent !== 'SHORTCUTS · CONSTELLATION') k.textContent = 'SHORTCUTS · CONSTELLATION'; }
  const jump = $('#v1Jump');
  if (jump && !jump.hidden && !(jump.firstChild && jump.firstChild.classList && jump.firstChild.classList.contains('sh-k'))) jump.prepend(h('div', { class: 'sh-k' }, 'JUMP BACK IN · LAST SIGNALS'));
  // "Esc back to your tab" when New Tab was opened from a tab
  const hints = $('#emptyHints');
  if (hints) {
    let esc1 = $('#shEsc');
    if (!esc1) { esc1 = h('span', { id: 'shEsc' }, h('kbd', {}, 'Esc'), ' back to your tab'); hints.append(esc1); }
    esc1.hidden = !startBack;
  }
}

let spaceReady = false;
function initSpace() {
  if (spaceReady) return;
  spaceReady = true;
  // the Space card design: first in the list, the default, and (once) what Standard cards switch to
  if (typeof CARD_DESIGNS === 'object' && !CARD_DESIGNS.space) {
    const rest = { ...CARD_DESIGNS };
    for (const k of Object.keys(CARD_DESIGNS)) delete CARD_DESIGNS[k];
    Object.assign(CARD_DESIGNS, { space: 'Space' }, rest);
  }
  S.card = S.card || {};
  if (!S.card.spaceIntro) { S.card.spaceIntro = true; if (S.card.design && S.card.design !== 'space') { S.card.designBeforeSpace = S.card.design; S.card.design = 'space'; } save(); }
  // the shooting star is the download animation, once, for people still on the old default (Settings can change it)
  if (!S.settings.spaceStarIntro) { S.settings.spaceStarIntro = true; if (!S.settings.dlAnim || S.settings.dlAnim === 'file') S.settings.dlAnim = 'star'; save(); }
  // downloads live in the Library: when the downloads button isn't shown, the star lands on the sidebar's Library button
  if (typeof dlTarget === 'function') {
    const _t = dlTarget;
    dlTarget = function () {
      const t = _t.apply(this, arguments);
      if (t.el) return t;
      const lib = document.querySelector('#sidebar .v1-fb[data-k="library"]');
      if (lib && lib.offsetParent) { const r = lib.getBoundingClientRect(); if (r.width > 0) return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: lib }; }
      return t;
    };
  }
  // the Founder edition becomes the black hole (wide); main still decides who may see it
  if (typeof v1CardFounder === 'function') v1CardFounder = function (m) { return spaceFounderSvg(m); };
  if (typeof v1CardOG === 'function') v1CardOG = function (m) { return spaceOGSvg(m); };
  if (typeof initSpaceLibrary === 'function') initSpaceLibrary();
  // Settings in the space look (1.8.6): the look itself is CSS (#settings under body.space-home); this adds the one line
  // under each page title. Done after the whole render (a microtask), so it works whichever wrapper runs first.
  if (typeof renderSettings === 'function' && !renderSettings.spaceSub) {
    const _rs = renderSettings;
    renderSettings = function () { const r = _rs.apply(this, arguments); queueMicrotask(spaceSettingsSub); return r; };
    renderSettings.spaceSub = true;
  }
  const _uc = updateClock;
  updateClock = function () { _uc.apply(this, arguments); spaceHome(); };
  spaceHome();
}
// (Oto's start-up calls initSpace; if it already ran before this file loaded, start now)
if (typeof S !== 'undefined' && S && S.settings) initSpace();
// (space-library.js may load after initSpace already ran)


// ---------------------------------------------------------------- the Founder card: an ultramassive black hole (wide)
// Only shown when main has signed it with the owner key (v1Edition() checks V1D.founder), as before.
const SPACE_SET_SUB = {
  general: 'How Oto starts, where downloads go, and your backups.', account: 'Sign in to sync your spaces and settings.',
  appearance: 'Colours, themes and how Oto looks.', sidebar: 'What your sidebar shows, and where.', newtab: 'What you see when you open a new tab.',
  search: 'Your search engine and shortcuts.', tabs: 'How tabs open, sleep and close.', privacy: 'Blocking, trackers, and what sites can see.',
  performance: 'Keep Oto quick and light on memory.', bookmarks: 'Your saved pages.', extensions: 'Chrome extensions, in Oto.',
  boosts: 'Your own touches on the sites you use.', mods: 'Change how Oto itself looks.', archive: 'Tabs you closed, ready to come back.',
  shortcuts: 'Every keyboard shortcut in one place.', about: 'Your version, and updates.', icon: 'The icon Oto shows in your taskbar.',
  feedback: 'Found a bug or have an idea? Tell us.',
};
function spaceSettingsSub() {
  if (!document.body.classList.contains('space-home')) return;
  const title = document.querySelector('#settings .set-pane .set-title');
  if (!title || title.nextElementSibling?.classList.contains('ss-sub')) return;
  const line = SPACE_SET_SUB[typeof settingsTab === 'string' ? settingsTab : ''];
  if (line) title.after(h('p', { class: 'ss-sub' }, line));
}
function spaceRand(seed) { let s = (seed >>> 0) || 7; return () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; }; }
function spaceDiskStreaks(half, rnd) {
  let out = '';
  for (let k = 0; k < 46; k++) {
    const rx = 96 + k * 4.2 + (rnd() * 4 - 2), ry = rx * 0.155, t = k / 45;
    const col = t < 0.12 ? '#fff3c4' : t < 0.35 ? '#f7b23b' : t < 0.7 ? '#ef4444' : '#a855f7';
    const op = (0.9 - t * 0.65) * (0.55 + rnd() * 0.45), sw = (0.35 + rnd() * 0.95) * (1.4 - t * 0.7);
    const a0 = rnd() * 0.35 * Math.PI, a1 = Math.PI - rnd() * 0.35 * Math.PI, sg = half === 'far' ? -1 : 1, sweep = half === 'far' ? 0 : 1;
    out += `<path d="M${(rx * Math.cos(a0)).toFixed(1)} ${(sg * ry * Math.sin(a0)).toFixed(1)} A${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 ${sweep} ${(rx * Math.cos(a1)).toFixed(1)} ${(sg * ry * Math.sin(a1)).toFixed(1)}" stroke="${col}" stroke-opacity="${op.toFixed(2)}" stroke-width="${sw.toFixed(2)}"/>`;
  }
  return out;
}
function spaceFounderSvg(m = cardModel(), { scale = 1 } = {}) {
  const W = 580, H = 362, cx = 352, cy = 186, u = `fd${++spaceUid}`, rnd = spaceRand(42);
  const mono = "'JetBrains Mono',Consolas,monospace", serif = "'Instrument Serif',Georgia,serif", jp = "'Yu Mincho','MS Mincho','Noto Serif JP',serif";
  const year = new Date(S.since || Date.now()).getFullYear();
  const sig = V1D.founder && V1D.founder.ok ? `✓ SIGNED · ${esc(String(V1D.founder.sig).slice(0, 10))}` : '';
  let dust = ''; for (let k = 0; k < 110; k++) dust += `<circle cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * H).toFixed(1)}" r="${[0.4, 0.5, 0.6, 0.9][Math.floor(rnd() * 4)]}" fill="#fff" fill-opacity="${(0.2 + rnd() * 0.55).toFixed(2)}"/>`;
  const far = spaceDiskStreaks('far', rnd), near = spaceDiskStreaks('near', rnd);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}"><defs>
    <linearGradient id="${u}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#f5c542" stop-opacity=".55"/><stop offset=".7" stop-color="#ef4444" stop-opacity=".8"/><stop offset="1" stop-color="#a855f7" stop-opacity=".85"/></linearGradient>
    <linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <radialGradient id="${u}n1" cx=".62" cy=".45" r=".6"><stop offset="0" stop-color="#7c3aed" stop-opacity=".34"/><stop offset=".55" stop-color="#4c1d95" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}n2" cx=".9" cy=".2" r=".5"><stop offset="0" stop-color="#be123c" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}gl"><stop offset=".35" stop-color="#f59e0b" stop-opacity=".35"/><stop offset=".7" stop-color="#ef4444" stop-opacity=".12"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></radialGradient>
    <linearGradient id="${u}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fde68a"/><stop offset="1" stop-color="#c084fc"/></linearGradient>
    <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#d4a017"/><stop offset="1" stop-color="#fff3c4"/></linearGradient>
    <filter id="${u}w" x="-20%" y="-60%" width="140%" height="220%"><feTurbulence type="fractalNoise" baseFrequency=".018 .06" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
    <filter id="${u}b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="${u}b1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="${u}hz" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="4" seed="3"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .2  0 0 0 0 .75  0 0 0 1.1 -.45"/></filter>
    <clipPath id="${u}c"><rect width="${W}" height="${H}" rx="26"/></clipPath></defs>
  <g clip-path="url(#${u}c)"><rect width="${W}" height="${H}" fill="#050407"/><rect width="${W}" height="${H}" filter="url(#${u}hz)" opacity=".55"/>
    <rect width="${W}" height="${H}" fill="url(#${u}n1)"/><rect width="${W}" height="${H}" fill="url(#${u}n2)"/>${dust}
    <g transform="translate(${cx} ${cy}) rotate(-13)"><circle r="210" fill="url(#${u}gl)"/><g fill="none" filter="url(#${u}w)">${far}</g>
      <path d="M-84 0 A84 74 0 0 1 84 0" fill="none" stroke="#fde68a" stroke-width="10" opacity=".55" filter="url(#${u}b3)"/>
      <path d="M-82 0 A82 72 0 0 1 82 0" fill="none" stroke="#fff3c4" stroke-width="1.6" opacity=".85"/>
      <path d="M-72 0 A72 56 0 0 0 72 0" fill="none" stroke="#f59e0b" stroke-width="4" opacity=".45" filter="url(#${u}b1)"/>
      <circle r="66" fill="#000"/><circle r="67.5" fill="none" stroke="url(#${u}r)" stroke-width="1.6"/><circle r="69" fill="none" stroke="#fde68a" stroke-width="4" opacity=".35" filter="url(#${u}b3)"/>
      <g fill="none" filter="url(#${u}w)">${near}</g><ellipse rx="128" ry="9" fill="#fff3c4" opacity=".55" filter="url(#${u}b3)"/></g>
    <path d="M0 0 H250 L170 ${H} H0 Z" fill="url(#${u}s)"/></g>
  <rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="25.5" fill="none" stroke="url(#${u}e)" stroke-width="1.5"/>
  <rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="23" fill="none" stroke="#fff" stroke-opacity=".06"/>
  <g transform="translate(34 30)"><circle cx="18" cy="18" r="17" fill="none" stroke="#ece8e1" stroke-opacity=".7"/>
    <text x="18" y="24.5" text-anchor="middle" font-family="'Yu Gothic UI','Meiryo','Noto Sans CJK JP',sans-serif" font-size="17" fill="#ece8e1">音</text>
    <rect x="48" y="6" width="1" height="24" fill="#ece8e1" fill-opacity=".3"/><text x="62" y="25" font-family="${serif}" font-size="25" fill="#ece8e1">Oto</text></g>
  <text x="${W - 34}" y="56" text-anchor="end" font-family="${mono}" font-size="15" letter-spacing="9" fill="#ece8e1">FOUNDER</text>
  <text x="${W - 34}" y="76" text-anchor="end" font-family="${mono}" font-size="9" letter-spacing="3" fill="url(#${u}g)">ULTRAMASSIVE · 1/1</text>
  <text x="34" y="182" font-family="${mono}" font-size="9.5" letter-spacing="3.4" fill="#ece8e1" fill-opacity=".72">WITH OTO SINCE</text>
  <text x="34" y="212" font-family="${mono}" font-size="26" letter-spacing="2" fill="#ece8e1">${year}</text>
  <rect x="34" y="${H - 58}" width="34" height="1" fill="#ece8e1" fill-opacity=".55"/>
  <text x="80" y="${H - 54}" font-family="${mono}" font-size="9.5" letter-spacing="3.4" fill="#ece8e1" fill-opacity=".8">OWNER · Nº 0000</text>
  <text x="80" y="${H - 38}" font-family="${mono}" font-size="9.5" letter-spacing="3.4" fill="#ece8e1" fill-opacity=".8">THE ONE WHO MADE OTO</text>
  <text x="${W - 74}" y="${H - 36}" text-anchor="end" font-family="'Segoe Script','Brush Script MT','Lucida Handwriting',cursive" font-size="26" fill="url(#${u}g)">${esc(String(m.name || 'Ryo').slice(0, 18))}</text>
  <text x="${W - 34}" y="${H - 34}" text-anchor="end" font-family="${jp}" font-weight="700" font-size="30" fill="url(#${u}g)">力</text>
  <text x="${W - 34}" y="${H - 20}" text-anchor="end" font-family="${mono}" font-size="6.5" letter-spacing="1.4" fill="#d4a017" fill-opacity=".7">${sig}</text></svg>`;
}
function spaceFounderBack(m = cardModel(), { scale = 1 } = {}) {
  const W = 580, H = 362, u = `fb${++spaceUid}`, got = S.v1Badges || {}, ids = Object.keys(V1_BADGES), L = v1Level();
  const mono = "'JetBrains Mono',Consolas,monospace", serif = "'Instrument Serif',Georgia,serif", sans = "'Segoe UI',Inter,system-ui,sans-serif";
  const P = [[70, 150], [132, 186], [196, 140], [160, 252], [250, 206], [84, 276], [220, 292], [286, 262], [52, 214], [270, 150], [116, 228], [196, 210], [300, 196], [140, 300], [44, 168]];
  const pts = ids.map((id, k) => ({ id, on: !!got[id], x: P[k % P.length][0], y: P[k % P.length][1] }));
  const lit = pts.filter((p) => p.on);
  const lines = lit.slice(1).map((p, k) => `<line x1="${lit[k].x}" y1="${lit[k].y}" x2="${p.x}" y2="${p.y}" stroke="#fca5a5" stroke-opacity=".55"/>`).join('');
  const dots = pts.map((p) => (p.on
    ? `<circle cx="${p.x}" cy="${p.y}" r="11" fill="#f59e0b" fill-opacity=".16"/><path transform="translate(${p.x - 6} ${p.y - 6}) scale(.5)" d="${SPACE_STAR}" fill="#fde68a"/><text x="${p.x}" y="${p.y + 22}" text-anchor="middle" font-family="${sans}" font-size="8.5" fill="#ece8e1" fill-opacity=".85">${esc(V1_BADGES[p.id][0])}</text>`
    : `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="#ece8e1" fill-opacity=".3"/>`)).join('');
  const sig = V1D.founder && V1D.founder.ok ? `✓ SIGNED ${esc(String(V1D.founder.sig).slice(0, 8))}…` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}"><defs>
    <linearGradient id="${u}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a855f7" stop-opacity=".85"/><stop offset=".35" stop-color="#ef4444" stop-opacity=".8"/><stop offset=".7" stop-color="#f5c542" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".5"/></linearGradient>
    <radialGradient id="${u}n" cx=".78" cy=".5" r=".55"><stop offset="0" stop-color="#7c3aed" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <filter id="${u}b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <clipPath id="${u}c"><rect width="${W}" height="${H}" rx="26"/></clipPath></defs>
  <g clip-path="url(#${u}c)"><rect width="${W}" height="${H}" fill="#050407"/><rect width="${W}" height="${H}" fill="url(#${u}n)"/>${spaceStars(1234, W, H, 60)}
    <g transform="translate(468 186) rotate(-13)" opacity=".55"><ellipse rx="150" ry="22" fill="none" stroke="#ef4444" stroke-opacity=".5" stroke-width="2" filter="url(#${u}b)"/><circle r="52" fill="#000"/><circle r="53.5" fill="none" stroke="#fde68a" stroke-opacity=".6"/></g>
    <text x="470" y="210" text-anchor="middle" font-family="'Yu Mincho','MS Mincho',serif" font-weight="700" font-size="64" fill="#d4a017" fill-opacity=".22">力</text></g>
  <rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="25.5" fill="none" stroke="url(#${u}e)" stroke-width="1.5"/>
  <text x="34" y="46" font-family="${mono}" font-size="10" letter-spacing="3" fill="#ece8e1" fill-opacity=".75">STAR CHART · FOUNDER</text>
  <text x="34" y="82" font-family="${serif}" font-size="26" fill="#ece8e1">Beyond the horizon</text>
  <text x="${W - 34}" y="46" text-anchor="end" font-family="${mono}" font-size="10" letter-spacing="2" fill="#fca5a5">${lit.length} / ${ids.length} FOUND</text>
  ${lines}${dots}
  <rect x="34" y="${H - 58}" width="34" height="1" fill="#ece8e1" fill-opacity=".55"/>
  <text x="80" y="${H - 54}" font-family="${mono}" font-size="9.5" letter-spacing="3" fill="#ece8e1" fill-opacity=".8">OWNER · Nº 0000 · ${esc(L.cur.name.toUpperCase())} · ${L.xp.toLocaleString()} XP</text>
  <text x="80" y="${H - 38}" font-family="${mono}" font-size="9" letter-spacing="2" fill="#d4a017" fill-opacity=".8">ONLY ONE PC CAN SHOW THIS CARD</text>
  <text x="${W - 34}" y="${H - 38}" text-anchor="end" font-family="${mono}" font-size="7.5" letter-spacing="1" fill="#d4a017" fill-opacity=".7">${sig}</text></svg>`;
}

// ---------------------------------------------------------------- downloads: a shooting star into the downloads button
// (1.8.5) the cursor becomes the star: where you clicked, a star lights up under the mouse (a quick twinkle), then
// streaks to the downloads button. The arc first drops, then sweeps across to the button, so it never flies up and
// away first (when the button is lower than the cursor, as it usually is).
function spaceStarFly(px, py, tx, ty, done, atMouse = false) {
  // (1.8.6: white) The mouse lights up as a neon arrow, turns into a neon star, and the star flies to Downloads leaving a
  // glowing white trail, then lands with a soft ring. Drawn on one canvas (no CSS filters); dark middle + neon edge reads on white and dark pages.
  const sx = px, sy = py;
  const dist = Math.hypot(tx - sx, ty - sy);
  const cx = sx + (tx - sx) * 0.3, cy = Math.min(sy, ty) - Math.min(200, 50 + dist * 0.3); // a gentle arc
  const at = (t) => { const u = 1 - t; return [u * u * sx + 2 * u * t * cx + t * t * tx, u * u * sy + 2 * u * t * cy + t * t * ty]; };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) * 0.35 + (1 - Math.pow(1 - t, 2.2)) * 0.65;
  const LIGHT = 300, MORPH = 260, BORN = LIGHT + MORPH, FLY = Math.round(Math.min(1050, 620 + dist * 0.45)), LAND = 520, TAIL_MS = 200;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = h('canvas', { class: 'sh-shoot', 'aria-hidden': 'true' });
  const W = innerWidth, H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  document.body.append(cv);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  // Your real mouse pointer hides while it "becomes" the star: a clear cover with no cursor sits on top for a moment.
  // It comes back as soon as you move or click, or when the star lands.
  let cover = null, first = null;
  const showMouse = () => { if (cover) { cover.remove(); cover = null; } };
  if (atMouse) {
    cover = h('div', { class: 'sh-nocursor', 'aria-hidden': 'true' });
    cover.addEventListener('mousemove', (ev) => { if (!first) first = [ev.clientX, ev.clientY]; else if (Math.hypot(ev.clientX - first[0], ev.clientY - first[1]) > 5) showMouse(); });
    for (const ev of ['mousedown', 'wheel', 'contextmenu']) cover.addEventListener(ev, showMouse, { passive: true });
    document.body.append(cover);
    setTimeout(showMouse, 4000); // never longer than this
  }
  const trail = [], dust = [], burst = [];
  let caught = false, last = 0;
  const t0 = performance.now();
  // a plain pointer arrow, tip at (0,0); everything is white neon with a dark middle
  const ARROW = [[0, 0], [0, 17.5], [4.3, 13.5], [7.2, 20], [10, 18.8], [7.2, 12.5], [12.6, 12.5]];
  // a five-point star, centre at (0,0)
  const STAR = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 5.2 : 12; return [Math.cos(a) * r, Math.sin(a) * r]; });
  const neon = (shape, x, y, s, rot, alpha) => {
    if (alpha <= 0.01 || s <= 0.02) return;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.lineJoin = 'round';
    g.beginPath(); shape.forEach(([ax, ay], i) => (i ? g.lineTo(ax, ay) : g.moveTo(ax, ay))); g.closePath();
    g.globalAlpha = alpha;
    g.strokeStyle = 'rgba(15,23,42,.45)'; g.lineWidth = 5; g.stroke(); // a faint dark edge so it reads on white pages
    for (const [w, o] of [[10, 0.08], [6.5, 0.16], [3.8, 0.34]]) { g.strokeStyle = `rgba(255,255,255,${o})`; g.lineWidth = w; g.stroke(); }
    const fill = g.createLinearGradient(-6, -10, 10, 19); fill.addColorStop(0, 'rgba(30,32,40,.94)'); fill.addColorStop(1, 'rgba(6,7,10,.94)');
    g.fillStyle = fill; g.fill();
    g.shadowColor = 'rgba(255,255,255,.95)'; g.shadowBlur = 16 * s;
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.9; g.stroke(); g.stroke(); // twice: a brighter neon edge
    g.shadowBlur = 4 * s; g.shadowColor = 'rgba(255,255,255,1)'; g.strokeStyle = '#ffffff'; g.lineWidth = 0.7; g.stroke();
    g.shadowBlur = 0;
    g.restore(); g.globalAlpha = 1;
  };
  const arrow = (x, y, s, rot, alpha) => neon(ARROW, x, y, s, rot, alpha);
  const star = (x, y, s, rot, alpha) => neon(STAR, x, y, s, rot, alpha);
  const ring = (x, y, r, w, o) => { g.strokeStyle = `rgba(255,255,255,${o.toFixed(3)})`; g.lineWidth = w; g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); g.stroke(); };
  const drawTail = (now) => {
    while (trail.length && now - trail[0].t > TAIL_MS) trail.shift();
    if (trail.length < 2) return;
    const n = trail.length;
    g.lineCap = 'round';
    for (let pass = 0; pass < 3; pass++) { // wide glow, neon blue, white-hot core
      for (let i = 1; i < n; i++) {
        const p0 = trail[i - 1], p1 = trail[i], f = i / (n - 1);
        if (pass === 0) { g.strokeStyle = `rgba(15,23,42,${(0.26 * Math.pow(f, 1.3)).toFixed(3)})`; g.lineWidth = 2.5 + 8 * Math.pow(f, 1.4); } // a soft shadow, seen only on white pages
        else if (pass === 1) { g.strokeStyle = `rgba(255,255,255,${(0.2 * Math.pow(f, 1.4)).toFixed(3)})`; g.lineWidth = 3 + 15 * Math.pow(f, 1.5); }
        else { g.strokeStyle = `rgba(255,255,255,${(0.95 * Math.pow(f, 1.2)).toFixed(3)})`; g.lineWidth = 0.8 + 4.2 * Math.pow(f, 1.3); }
        g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
      }
    }
  };
  const drawDust = (list, dt) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      d.life -= dt; if (d.life <= 0) { list.splice(i, 1); continue; }
      d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.985; d.vy = d.vy * 0.985 + 0.00012 * dt;
      const k = d.life / d.max;
      g.globalAlpha = k; g.fillStyle = d.c;
      g.beginPath(); g.arc(d.x, d.y, d.r * (0.4 + 0.6 * k), 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  };
  const flicker = [0, 0.9, 0.25, 1, 0.55, 1, 1, 1]; // the neon switching on
  let rotNow = 0;
  const frame = () => {
    const now = performance.now(), e = Math.max(0, now - t0), dt = last ? Math.min(40, now - last) : 16; last = now;
    g.clearRect(0, 0, W, H);
    if (e < LIGHT) { // the mouse lights up as a neon arrow
      const k = e / LIGHT, sc = 1.75 * (k < 0.5 ? 0.7 + 0.6 * (k / 0.5) : 1.3 - 0.3 * ((k - 0.5) / 0.5));
      arrow(sx, sy, sc, 0, flicker[Math.min(flicker.length - 1, Math.floor(k * flicker.length))]);
    } else if (e < BORN) { // …and turns into a star
      const k = (e - LIGHT) / MORPH, q = k * k * (3 - 2 * k);
      ring(sx, sy, 6 + 30 * k, 2, 0.6 * (1 - k));
      arrow(sx, sy, 1.75 * (1 - 0.6 * q), q * 1.2, 1 - q);
      star(sx, sy, 1.35 * (k < 0.7 ? (k / 0.7) * 1.2 : 1.2 - 0.2 * ((k - 0.7) / 0.3)), (1 - q) * -1.6, Math.min(1, q * 1.6));
    } else if (e < BORN + FLY) {
      const raw = (e - BORN) / FLY, k = ease(raw), [x, y] = at(k);
      rotNow = raw * 2.4; // a slow spin on the way
      trail.push({ x, y, t: now });
      if (Math.random() < 0.5) {
        const p = trail[Math.max(0, trail.length - 3)];
        dust.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05, r: 0.8 + Math.random() * 1.3, life: 360 + Math.random() * 240, max: 600, c: Math.random() < 0.6 ? '#ffffff' : '#cbd5e1' });
      }
      drawDust(dust, dt); drawTail(now);
      star(x, y, 1.35 * (1 - 0.35 * k), rotNow, 1);
    } else {
      if (!caught) {
        caught = true;
        showMouse();
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + Math.random() * 0.3, v = 0.07 + Math.random() * 0.09; burst.push({ x: tx, y: ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1 + Math.random() * 1.5, life: 420 + Math.random() * 120, max: 540, c: i % 3 ? '#e2e8f0' : '#ffffff' }); }
        if (done) done();
      }
      const k = (e - BORN - FLY) / LAND;
      drawDust(dust, dt); drawTail(now); drawDust(burst, dt);
      if (k < 1) {
        ring(tx, ty, 4 + 30 * Math.pow(k, 0.6), 2.5 * (1 - k) + 0.5, 0.75 * (1 - k));
        if (k < 0.3) star(tx, ty, 0.88 * (1 - k / 0.3), rotNow, 1 - k / 0.3);
      } else { cv.remove(); return; }
    }
    requestAnimationFrame(safe);
  };
  const safe = () => { try { frame(); } catch (err) { cv.remove(); showMouse(); if (!caught && done) done(); } };
  requestAnimationFrame(safe);
}

// ---------------------------------------------------------------- the OG card: "first light" (wide), Oto's first logo
function spaceOGSvg(m = cardModel(), { scale = 1 } = {}) {
  const W = 580, H = 362, cx = 356, cy = 184, u = `og${++spaceUid}`, rnd = spaceRand(9);
  const mono = "'JetBrains Mono',Consolas,monospace", serif = "'Instrument Serif',Georgia,serif";
  const year = new Date(S.since || Date.now()).getFullYear();
  let dust = ''; for (let k = 0; k < 120; k++) dust += `<circle cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * H).toFixed(1)}" r="${[0.4, 0.5, 0.6, 0.9][Math.floor(rnd() * 4)]}" fill="#fff" fill-opacity="${(0.2 + rnd() * 0.55).toFixed(2)}"/>`;
  // Oto's very first logo: two overlapping rings
  const logo = '<g fill="none" stroke="#ece8e1" stroke-opacity=".85" stroke-width="1.8"><circle cx="12" cy="18" r="9"/><circle cx="24" cy="18" r="9" stroke-opacity=".7"/></g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}"><defs>
    <linearGradient id="${u}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".4" stop-color="#38bdf8" stop-opacity=".75"/><stop offset="1" stop-color="#4f46e5" stop-opacity=".9"/></linearGradient>
    <linearGradient id="${u}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b0a24"/><stop offset=".55" stop-color="#05050f"/><stop offset="1" stop-color="#03030a"/></linearGradient>
    <radialGradient id="${u}n1" cx=".64" cy=".5" r=".55"><stop offset="0" stop-color="#4f46e5" stop-opacity=".45"/><stop offset=".6" stop-color="#312e81" stop-opacity=".15"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}n2" cx=".85" cy=".15" r=".45"><stop offset="0" stop-color="#38bdf8" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="${u}st"><stop offset="0" stop-color="#fff"/><stop offset=".2" stop-color="#e0f2fe"/><stop offset=".45" stop-color="#7dd3fc" stop-opacity=".6"/><stop offset="1" stop-color="#4f46e5" stop-opacity="0"/></radialGradient>
    <linearGradient id="${u}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#818cf8"/><stop offset=".5" stop-color="#e0f2fe"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
    <linearGradient id="${u}cm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#38bdf8" stop-opacity="0"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient>
    <linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="${u}b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="${u}hz" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="4" seed="11"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .35  0 0 0 0 .95  0 0 0 1.1 -.47"/></filter>
    <clipPath id="${u}c"><rect width="${W}" height="${H}" rx="26"/></clipPath></defs>
  <g clip-path="url(#${u}c)"><rect width="${W}" height="${H}" fill="url(#${u}bg)"/><rect width="${W}" height="${H}" filter="url(#${u}hz)" opacity=".6"/>
    <rect width="${W}" height="${H}" fill="url(#${u}n1)"/><rect width="${W}" height="${H}" fill="url(#${u}n2)"/>${dust}
    <path d="M60 52 C150 66 220 92 286 128" fill="none" stroke="url(#${u}cm)" stroke-width="2" stroke-linecap="round"/><circle cx="287" cy="129" r="2.6" fill="#fff"/><circle cx="287" cy="129" r="7" fill="#7dd3fc" fill-opacity=".35"/>
    <g transform="translate(${cx} ${cy})"><circle r="120" fill="url(#${u}st)" opacity=".55"/>
      <g fill="none" stroke="url(#${u}r)"><ellipse rx="128" ry="44" transform="rotate(-28)" stroke-width="1.6" stroke-opacity=".9"/><ellipse rx="128" ry="44" transform="rotate(28)" stroke-width="1.6" stroke-opacity=".9"/>
        <ellipse rx="128" ry="44" transform="rotate(-28)" stroke-width="7" stroke-opacity=".25" filter="url(#${u}b)"/><ellipse rx="128" ry="44" transform="rotate(28)" stroke-width="7" stroke-opacity=".25" filter="url(#${u}b)"/></g>
      <circle r="26" fill="#e0f2fe" opacity=".6" filter="url(#${u}b)"/><circle r="13" fill="#fff"/>
      <g transform="rotate(-28)"><circle cx="-112" cy="21" r="6" fill="#818cf8"/><circle cx="-112" cy="21" r="12" fill="#818cf8" fill-opacity=".25"/></g>
      <g transform="rotate(28)"><circle cx="108" cy="-24" r="4.5" fill="#7dd3fc"/><circle cx="108" cy="-24" r="10" fill="#7dd3fc" fill-opacity=".25"/></g></g>
    <path d="M0 0 H250 L170 ${H} H0 Z" fill="url(#${u}s)"/></g>
  <rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="25.5" fill="none" stroke="url(#${u}e)" stroke-width="1.5"/>
  <rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="23" fill="none" stroke="#fff" stroke-opacity=".06"/>
  <g transform="translate(34 30)">${logo}<rect x="48" y="6" width="1" height="24" fill="#ece8e1" fill-opacity=".3"/><text x="62" y="25" font-family="${serif}" font-size="25" fill="#ece8e1">Oto</text></g>
  <text x="${W - 34}" y="56" text-anchor="end" font-family="${mono}" font-size="14" letter-spacing="7" fill="#ece8e1">ORIGINAL USER</text>
  <text x="${W - 34}" y="76" text-anchor="end" font-family="${mono}" font-size="9" letter-spacing="3" fill="#7dd3fc">OG · FIRST LIGHT · BEFORE 1.0</text>
  <text x="34" y="182" font-family="${mono}" font-size="9.5" letter-spacing="3.4" fill="#ece8e1" fill-opacity=".72">CARD Nº</text>
  <text x="34" y="214" font-family="${mono}" font-size="30" letter-spacing="3" fill="#ece8e1">${esc(m.no || v1CardId())}</text>
  <rect x="34" y="${H - 58}" width="34" height="1" fill="#ece8e1" fill-opacity=".55"/>
  <text x="80" y="${H - 54}" font-family="${mono}" font-size="9.5" letter-spacing="3.4" fill="#ece8e1" fill-opacity=".8">WITH OTO SINCE ${year}</text>
  <text x="80" y="${H - 38}" font-family="${mono}" font-size="9.5" letter-spacing="3.4" fill="#ece8e1" fill-opacity=".8">KEPT FOREVER</text>
  <text x="${W - 34}" y="${H - 40}" text-anchor="end" font-family="${serif}" font-size="30" fill="#ece8e1">${esc(String(m.name || 'You').slice(0, 20))}</text>
  <text x="${W - 34}" y="${H - 22}" text-anchor="end" font-family="${mono}" font-size="8" letter-spacing="2.4" fill="#7dd3fc">★ OG EDITION ★</text></svg>`;
}
function spaceOGBack(m = cardModel(), { scale = 1 } = {}) {
  const W = 580, H = 362, u = `ob${++spaceUid}`, got = S.v1Badges || {}, ids = Object.keys(V1_BADGES), L = v1Level();
  const mono = "'JetBrains Mono',Consolas,monospace", serif = "'Instrument Serif',Georgia,serif", sans = "'Segoe UI',Inter,system-ui,sans-serif";
  const P = [[70, 150], [132, 186], [196, 140], [160, 252], [250, 206], [84, 276], [220, 292], [286, 262], [52, 214], [270, 150], [116, 228], [196, 210], [300, 196], [140, 300], [44, 168]];
  const pts = ids.map((id, k) => ({ id, on: !!got[id], x: P[k % P.length][0], y: P[k % P.length][1] }));
  const lit = pts.filter((p) => p.on);
  const lines = lit.slice(1).map((p, k) => `<line x1="${lit[k].x}" y1="${lit[k].y}" x2="${p.x}" y2="${p.y}" stroke="#7dd3fc" stroke-opacity=".55"/>`).join('');
  const dots = pts.map((p) => (p.on
    ? `<circle cx="${p.x}" cy="${p.y}" r="11" fill="#38bdf8" fill-opacity=".18"/><path transform="translate(${p.x - 6} ${p.y - 6}) scale(.5)" d="${SPACE_STAR}" fill="#e0f2fe"/><text x="${p.x}" y="${p.y + 22}" text-anchor="middle" font-family="${sans}" font-size="8.5" fill="#ece8e1" fill-opacity=".85">${esc(V1_BADGES[p.id][0])}</text>`
    : `<circle cx="${p.x}" cy="${p.y}" r="2.4" fill="#ece8e1" fill-opacity=".3"/>`)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}"><defs>
    <linearGradient id="${u}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5" stop-opacity=".9"/><stop offset=".6" stop-color="#38bdf8" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient>
    <radialGradient id="${u}n" cx=".8" cy=".5" r=".55"><stop offset="0" stop-color="#4f46e5" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <clipPath id="${u}c"><rect width="${W}" height="${H}" rx="26"/></clipPath></defs>
  <g clip-path="url(#${u}c)"><rect width="${W}" height="${H}" fill="#05050f"/><rect width="${W}" height="${H}" fill="url(#${u}n)"/>${spaceStars(4321, W, H, 60)}
    <g transform="translate(468 186)" fill="none" stroke="#7dd3fc" stroke-opacity=".35" stroke-width="1.4"><ellipse rx="86" ry="30" transform="rotate(-28)"/><ellipse rx="86" ry="30" transform="rotate(28)"/></g><circle cx="468" cy="186" r="7" fill="#e0f2fe" fill-opacity=".7"/></g>
  <rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="25.5" fill="none" stroke="url(#${u}e)" stroke-width="1.5"/>
  <text x="34" y="46" font-family="${mono}" font-size="10" letter-spacing="3" fill="#ece8e1" fill-opacity=".75">STAR CHART · ORIGINAL USER</text>
  <text x="34" y="82" font-family="${serif}" font-size="26" fill="#ece8e1">Here from the first light</text>
  <text x="${W - 34}" y="46" text-anchor="end" font-family="${mono}" font-size="10" letter-spacing="2" fill="#7dd3fc">${lit.length} / ${ids.length} FOUND</text>
  ${lines}${dots}
  <rect x="34" y="${H - 58}" width="34" height="1" fill="#ece8e1" fill-opacity=".55"/>
  <text x="80" y="${H - 54}" font-family="${mono}" font-size="9.5" letter-spacing="3" fill="#ece8e1" fill-opacity=".8">CARD Nº ${esc(m.no || v1CardId())} · ${esc(L.cur.name.toUpperCase())} · ${L.xp.toLocaleString()} XP</text>
  <text x="80" y="${H - 38}" font-family="${mono}" font-size="9" letter-spacing="2" fill="#7dd3fc" fill-opacity=".85">★ OG EDITION · KEPT FOREVER</text></svg>`;
}
