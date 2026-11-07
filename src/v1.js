'use strict';
/* Oto v1 (Owner alpha) — the big refresh from the v1 concept pictures.
   Loaded after renderer.js; initV1() wraps a few renderer functions and adds the new pieces. */

const V1_ICONS = {
  note: '<path d="M5 4.5h14v10l-5 5H5z"/><path d="M14 19.5v-5h5"/>',
  zoomin: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11h5M11 8.5v5"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  cam: '<rect x="3.5" y="7" width="12.5" height="10" rx="2.5"/><path d="M16 11l4.5-2.5v7L16 13"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5h4"/>',
  mappin: '<path d="M12 21s-6.5-5.5-6.5-11a6.5 6.5 0 0 1 13 0c0 5.5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  share: '<path d="M12 15V4M8 7.5 12 3.5l4 4M5.5 12v6.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V12"/>',
  calc: '<rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4.5v4h4M12 7.5V12l3 2"/>',
  wifioff: '<path d="M3 9a13.5 13.5 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="19.5" r=".9"/><path d="M4 4l16 16"/>',
  alert: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  swap: '<path d="M7 7.5h12M15.5 4l3.5 3.5-3.5 3.5M17 16.5H5M8.5 13 5 16.5 8.5 20"/>',
  keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2.5"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  puzzle: '<path d="M9 4.5h3.5v2a1.8 1.8 0 1 0 3.5 0v-2H19.5V9h-2a1.8 1.8 0 1 0 0 3.5h2v7H16v-2a1.8 1.8 0 1 0-3.5 0v2H4.5V16h2a1.8 1.8 0 1 0 0-3.5h-2V4.5z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  minus: '<path d="M6 12h12"/>',
};

const V1 = { titleEl: null, dateEl: null, jumpEl: null };

// ================================================================ board 1 — main window
function v1Labels() {
  const pinned = $('#pinned');
  if (pinned && !$('#v1PinnedLab')) pinned.before(h('div', { id: 'v1PinnedLab', class: 'v1-lab' }, 'Pinned'));
  const div = document.querySelector('#tabsWrap .divider');
  if (div && !div.querySelector('.v1-lab')) div.prepend(h('span', { class: 'v1-lab' }, 'Today'));
  const lab = $('#v1PinnedLab');
  if (lab) lab.hidden = !(pinned && pinned.children.length);
}

const v1Wave = () => '<span class="v1-wave" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
// "(3) Inbox" style titles mean the site has something new.
const v1HasNew = (t) => /^\(\d+\+?\)\s|^\[\d+\]\s|\(\d+\+?\)$/.test(t.title || '');

function v1Version() {
  const foot = document.querySelector('#sidebar .sb-foot');
  if (!foot || $('#v1Ver')) return;
  const el = h('span', { id: 'v1Ver', class: 'v1-ver', title: 'Oto version — Settings → About' });
  oto.updateStatus().then((u) => { el.textContent = (u && u.version) || ''; }).catch(() => {});
  el.onclick = () => openSettings('about');
  foot.append(el);
}

// Page name in the middle of the top bar (when the bookmarks bar is empty).
function v1TopTitle() {
  if (!V1.titleEl) {
    V1.titleEl = h('div', { id: 'v1Title', class: 'v1-title nodrag' });
    V1.titleEl.onclick = () => openCmd('current');
    $('#topstrip').append(V1.titleEl);
  }
  const el = V1.titleEl;
  const t = activeTab();
  const v = t && V.get(t.id);
  const bar = $('#bmbar');
  const barEmpty = !bar || !bar.children.length || !!bar.querySelector('.bm-hint');
  const show = !!(t && v) && $('#empty').classList.contains('gone') && barEmpty && !document.body.classList.contains('layout-top');
  el.hidden = !show;
  if (!show) return;
  const host = (hostOf(t.url) || '').replace(/^www\./, '');
  el.replaceChildren(...[favEl(t, null, true), h('span', { class: 't' }, t.title || prettyUrl(t.url)), host ? h('span', { class: 'hst' }, `· ${host}`) : null].filter(Boolean));
}

function v1NewTab() {
  const inner = document.querySelector('#empty .empty-inner');
  if (!inner) return;
  if (!V1.dateEl) { V1.dateEl = h('div', { id: 'v1Date', class: 'v1-date' }); $('#clock').before(V1.dateEl); }
  V1.dateEl.textContent = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', ' ·');
  V1.dateEl.hidden = !S.settings.showClock;
  const g = $('#greet');
  if (g && S.settings.userName && !g.querySelector('b')) {
    const txt = g.textContent, name = S.settings.userName;
    const i = txt.lastIndexOf(name);
    if (i > 0) g.replaceChildren(txt.slice(0, i), h('b', {}, name), txt.slice(i + name.length));
  }
  if (!V1.jumpEl) { V1.jumpEl = h('div', { id: 'v1Jump', class: 'v1-jump' }); $('#emptySearch').after(V1.jumpEl); }
  // Jump back in: the last few pages you visited that aren't open right now.
  const open = new Set(S.tabs.map((t) => t.url));
  const seen = new Set(), items = [];
  for (const it of S.history || []) {
    const host = hostOf(it.u);
    if (!host || seen.has(host) || open.has(it.u)) continue;
    seen.add(host); items.push(it);
    if (items.length >= 3) break;
  }
  V1.jumpEl.hidden = !items.length || S.settings.v1Jump === false;
  V1.jumpEl.replaceChildren(...items.map((it) => {
    const host = hostOf(it.u).replace(/^www\./, '');
    const ago = v1Ago(it.ts);
    return h('button', { class: 'v1-jc', title: it.u, onclick: () => openUrl(it.u) },
      favEl({ url: it.u, title: it.t }, null, true),
      h('span', { class: 'tx' }, h('b', {}, it.t || host), h('small', {}, `${host} · ${ago}`)));
  }));
  const s = $('#emptySearch');
  if (s && !s.querySelector('.v1-eng')) s.querySelector('kbd').before(h('span', { class: 'v1-eng', html: `${icon('globe')}<span>${v1EngineName()}</span>` }));
}
function v1EngineName() {
  try { const e = currentEngine(); return (e && (e.name || e.label)) || 'Search'; } catch { return 'Search'; }
}
function v1Ago(ts) {
  const m = Math.round((Date.now() - (ts || 0)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.round(hr / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

function v1Board1() {
  const _renderNow = renderNow;
  renderNow = function () { _renderNow.apply(this, arguments); v1Labels(); v1TopTitle(); };
  const _tabRow = tabRow;
  tabRow = function (t, active) {
    const row = _tabRow(t, active);
    const v = V.get(t.id);
    const a = row.querySelector('.audio');
    if (a && v && v.audible && !v.muted) { a.innerHTML = v1Wave(); a.classList.add('playing'); }
    if (!v) row.append(h('span', { class: 'v1-zz', title: 'Sleeping to save memory' }, 'zz'));
    return row;
  };
  const _essTile = essTile;
  essTile = function (t, active) {
    const el = _essTile(t, active);
    if (v1HasNew(t) && !active) el.append(h('span', { class: 'v1-new' }));
    return el;
  };
  const _updateChrome = updateChrome;
  updateChrome = function () {
    _updateChrome.apply(this, arguments);
    const pill = $('#urlPill');
    if (pill && pill.querySelector('.ph') && !pill.querySelector('kbd')) pill.append(h('kbd', { class: 'v1-kbd' }, 'Ctrl L'));
    v1TopTitle();
  };
  const _updateClock = updateClock;
  updateClock = function () { _updateClock.apply(this, arguments); v1NewTab(); };
  v1Version();
}


// ================================================================ board 2 — site panel + right-click menu
// A transparent layer behind popovers so a click anywhere (even on the page) closes them.
function v1Layer(onClose) {
  const layer = h('div', { class: 'v1-layer' });
  layer.addEventListener('mousedown', (e) => { if (e.target === layer) { e.preventDefault(); onClose(); } });
  layer.addEventListener('contextmenu', (e) => { e.preventDefault(); onClose(); });
  layer.tabIndex = -1;
  document.body.append(layer);
  setTimeout(() => { try { layer.focus({ preventScroll: true }); } catch {} }, 0);
  return layer;
}
let v1Pop = null;
function v1ClosePop() { if (v1Pop) { v1Pop.remove(); v1Pop = null; } }
addEventListener('keydown', (e) => { if (e.key === 'Escape' && v1Pop) { e.stopPropagation(); v1ClosePop(); } }, true);

const V1_PERMS = [
  ['geolocation', 'Location', 'mappin'],
  ['media', 'Camera & mic', 'cam'],
  ['notifications', 'Notifications', 'bell'],
];

async function v1SitePanel() {
  const t = activeTab(), v = activeView();
  if (!t || !v) return;
  let u; try { u = new URL(t.url); } catch { return; }
  if (!/^https?:$/.test(u.protocol)) return;
  v1ClosePop();
  const origin = u.origin, host = u.hostname.replace(/^www\./, '');
  const secure = u.protocol === 'https:';
  let perms = {};
  try { perms = await oto.listPermissions(); } catch {}
  const layer = v1Layer(v1ClosePop);
  v1Pop = layer;
  const permRow = ([key, label, ic]) => {
    const k = `${origin}|${key}`;
    const val = k in perms ? (perms[k] ? 'allow' : 'block') : 'ask';
    const seg3 = h('div', { class: 'v1-seg3' }, ...[['ask', 'Ask'], ['allow', 'Allow'], ['block', 'Block']].map(([id, l]) =>
      h('button', { class: id === val ? 'on' : '', onclick: async () => {
        perms = await oto.setPermission(k, id === 'ask' ? null : id === 'allow');
        seg3.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === l));
      } }, l)));
    return h('div', { class: 'v1-prow' }, iconEl(ic), h('span', { class: 'l' }, label), seg3);
  };
  const muted = !!v.muted;
  const sw = h('button', { class: `switch${muted ? '' : ' on'}`, role: 'switch', onclick: () => { toggleMute(t.id); sw.classList.toggle('on', !V.get(t.id).muted); } });
  const zoomVal = h('span', { class: 'zv' }, `${Math.round(wv(v, (w) => w.getZoomFactor(), 1) * 100)}%`);
  const doZoom = (d) => { if (d === 0) wv(v, (w) => w.setZoomFactor(1)); else zoom(d); zoomVal.textContent = `${Math.round(wv(v, (w) => w.getZoomFactor(), 1) * 100)}%`; };
  const route = (S.routes || []).find((r) => r.host === u.hostname || r.host === host);
  const wsSel = h('select', { class: 'v1-sel', onchange: () => {
    S.routes = (S.routes || []).filter((r) => r.host !== host && r.host !== u.hostname);
    if (wsSel.value) S.routes.push({ host, ws: wsSel.value, on: true });
    save(); toast(wsSel.value ? `${host} will always open in ${(S.workspaces.find((w) => w.id === wsSel.value) || {}).name}` : `${host} opens in any space`, { timeout: 2200 });
  } }, h('option', { value: '' }, 'Any space'), ...S.workspaces.map((w) => h('option', { value: w.id, selected: route && route.ws === w.id }, w.name)));
  const blockedPage = v.blocked || 0, blockedAll = (S.stats && S.stats.blocked) || 0;
  const panel = h('div', { class: 'v1-pop v1-site' },
    h('div', { class: 'hd' }, h('div', { class: 'big' }, favEl(t, null, true)),
      h('div', {}, h('b', {}, host), h('small', { class: secure ? 'ok' : 'warn', html: `${icon(secure ? 'lock' : 'unlock')}<span>${secure ? 'Connection is secure' : 'Not secure — don’t type passwords here'}</span>` }))),
    S.settings.blockTrackers ? h('div', { class: 'stat' },
      h('div', {}, h('b', {}, String(blockedPage)), h('small', {}, 'ads & trackers blocked here')),
      h('div', {}, h('b', {}, blockedAll > 9999 ? `${Math.round(blockedAll / 1000)}k` : String(blockedAll)), h('small', {}, 'blocked by Oto so far'))) : null,
    h('div', { class: 'sec' }, ...V1_PERMS.map(permRow), h('div', { class: 'v1-prow' }, iconEl('vol'), h('span', { class: 'l' }, 'Sound'), sw)),
    h('div', { class: 'sec' },
      h('div', { class: 'v1-prow' }, iconEl('zoomin'), h('span', { class: 'l' }, 'Zoom'),
        h('div', { class: 'v1-seg3' }, h('button', { onclick: () => doZoom(-1) }, '−'), h('button', { class: 'on', onclick: () => doZoom(0), title: 'Reset' }, zoomVal), h('button', { onclick: () => doZoom(1) }, '+'))),
      h('div', { class: 'v1-prow' }, iconEl('layers'), h('span', { class: 'l' }, 'Always open in'), wsSel),
      h('button', { class: 'v1-prow danger', onclick: async () => {
        if (!confirm(`Clear cookies and saved data for ${host}? You will be logged out of this site.`)) return;
        const ok = await oto.clearSite(origin);
        v1ClosePop();
        toast(ok ? `Cleared data for ${host}` : 'Couldn’t clear site data', { timeout: 2200 });
        if (ok) wv(v, (w) => w.reload());
      } }, iconEl('trash'), h('span', { class: 'l' }, 'Clear site data'))));
  layer.append(panel);
  const r = ($('#urlPill').querySelector('.ic-slot') || $('#urlPill')).getBoundingClientRect();
  panel.style.left = `${clamp(r.left - 10, 8, innerWidth - 320)}px`;
  panel.style.top = `${r.bottom + 10}px`;
  panel.style.setProperty('--arrow-x', `${r.left + r.width / 2 - clamp(r.left - 10, 8, innerWidth - 320)}px`);
}

// The page right-click menu, drawn by Oto: big back / forward / reload / bookmark buttons on top.
function v1PageMenu(c) {
  v1ClosePop();
  const tabId = wcToTab.get(c.wcId);
  const v = tabId && V.get(tabId);
  // Electron reports webview right-clicks in window coordinates already.
  const x = c.x, y = c.y;
  const go = (act, arg) => { v1ClosePop(); oto.ctxDo(act, arg); };
  const it = (ic, label, run, k, cls) => h('button', { class: `mi${cls ? ` ${cls}` : ''}`, onclick: () => { v1ClosePop(); run(); } }, iconEl(ic), h('span', { class: 'ml' }, label), k ? h('span', { class: 'k' }, k) : null);
  const sep = () => h('div', { class: 'msep' });
  const items = [];
  const sel = (c.selectionText || '').trim().replace(/\s+/g, ' ');
  if (!c.isEditable) {
    const t = tabId && S.tabs.find((x) => x.id === tabId);
    const starred = !!(t && findBookmark(t.url));
    items.push(h('div', { class: 'v1-mgrp' },
      h('button', { title: 'Back', disabled: !c.canBack, onclick: () => go('back'), html: icon('back') }),
      h('button', { title: 'Forward', disabled: !c.canFwd, onclick: () => go('forward'), html: icon('fwd') }),
      h('button', { title: 'Reload', onclick: () => go('reload'), html: icon('reload') }),
      h('button', { title: starred ? 'Bookmarked' : 'Bookmark this page', class: starred ? 'on' : '', onclick: () => { v1ClosePop(); if (tabId) activate(tabId); setTimeout(() => $('#btnStar') && $('#btnStar').click(), 30); }, html: icon('star') })));
  }
  if (c.linkURL) {
    items.push(
      it('eye', 'Open link in Glance', () => openGlance(c.linkURL), null, 'hl'),
      it('plus', 'Open in new tab', () => go('openTab'), 'Ctrl click'),
      it('tab', 'Open in background tab', () => go('openBg')),
      it('split', 'Open in split view', () => v1OpenSplit(c.linkURL)),
      S.workspaces.length > 1 ? it('layers', 'Open in space…', () => v1SpacePicker(c.linkURL, x, y)) : null,
      sep(),
      it('copy', 'Copy link', () => go('copyLink')),
      sep());
  }
  if (c.mediaType === 'image' && c.srcURL) {
    items.push(it('expand', 'Open image in new tab', () => go('openImage')), it('download', 'Save image', () => go('saveImage')),
      it('copy', 'Copy image', () => go('copyImage')), sep());
  }
  if (c.isEditable) {
    const f = c.editFlags || {};
    items.push(it('back', 'Undo', () => go('undo'), 'Ctrl Z', f.canUndo ? '' : 'off'), it('edit', 'Cut', () => go('cut'), 'Ctrl X', f.canCut ? '' : 'off'),
      it('copy', 'Copy', () => go('copy'), 'Ctrl C', f.canCopy ? '' : 'off'), it('dup', 'Paste', () => go('paste'), 'Ctrl V', f.canPaste ? '' : 'off'),
      it('check', 'Select all', () => go('selectAll'), 'Ctrl A'), sep());
  } else if (sel) {
    const short = sel.length > 26 ? `${sel.slice(0, 26)}…` : sel;
    items.push(it('copy', 'Copy', () => go('copy'), 'Ctrl C'), it('search', `Search for “${short}”`, () => openUrl(resolveInput(sel))), sep());
  }
  if (!c.linkURL && !c.isEditable && !sel && c.mediaType === 'none') {
    items.push(it('copy', 'Copy page address', () => go('copyPage'), 'Ctrl Shift C'), typeof v1Screenshot === 'function' ? null : null, it('code', 'View page source', () => go('source')), sep());
  }
  if (c.hasExt) items.push(it('puzzle', 'Extensions…', () => go('native')));
  items.push(it('find', 'Inspect', () => go('inspect')));
  const layer = v1Layer(v1ClosePop);
  v1Pop = layer;
  const menu = h('div', { class: 'menu v1-menu' }, ...items.filter(Boolean));
  while (menu.lastChild && menu.lastChild.classList.contains('msep')) menu.lastChild.remove();
  layer.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${clamp(x, 6, innerWidth - r.width - 6)}px`;
  menu.style.top = `${y + r.height > innerHeight - 6 ? Math.max(6, y - r.height) : y}px`;
}
function v1OpenSplit(url) {
  const t = newTab(url, { background: true });
  if (t) startSplit(t.id);
}
function v1SpacePicker(url, x, y) {
  showMenu(x, y, [{ header: 'Open in space' }, ...S.workspaces.map((w) => ({ label: w.name, icon: 'layers', run: () => {
    const t = newTab(url, { background: true, ws: w.id });
    if (t && t.ws !== w.id) moveToWorkspace(t.id, w.id);
    toast(`Opened in ${w.name}`, { timeout: 1800 });
  } }))]);
}

function v1Board2() {
  $('#urlPill').addEventListener('click', (e) => {
    const slot = e.target.closest('.ic-slot');
    if (slot && slot === $('#urlPill').firstElementChild && activeView()) { e.stopImmediatePropagation(); e.preventDefault(); v1SitePanel(); }
  }, true);
  $('#btnShield').onclick = () => (activeView() ? v1SitePanel() : openSettings());
  oto.on('ctx:show', (c) => v1PageMenu(c));
}


// ================================================================ board 3 — command bar
const V1C = { f: 'all', counts: {} };
const V1_CHIPS = [['all', 'All'], ['tabs', 'Tabs'], ['history', 'History'], ['bookmarks', 'Bookmarks'], ['actions', 'Actions'], ['spaces', 'Spaces']];
const V1_CAT = { Tabs: 'tabs', 'Open tabs': 'tabs', History: 'history', Recent: 'history', Archived: 'history', Bookmarks: 'bookmarks', Actions: 'actions', Commands: 'actions', Spaces: 'spaces' };
const V1_KEYS = {
  'Split view': 'Ctrl Shift S', Library: 'Ctrl Shift O', Downloads: 'Ctrl J', History: 'Ctrl H', 'Picture in picture': 'Ctrl Shift P',
  'Open settings': 'Ctrl ,', 'Copy current link': 'Ctrl Shift C', 'Pin or unpin current tab': 'Ctrl D', 'Add or remove from Essentials': 'Ctrl Shift D',
  'Reopen closed tab': 'Ctrl Shift T', 'Find in page': 'Ctrl F', 'Toggle compact mode': 'Ctrl B', 'Developer tools': 'F12',
};

// A tiny maths parser (no eval): + − × ÷ ^ % and brackets.
function v1Math(q) {
  const src = q.replace(/[×x]/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/\s+/g, '').replace(/=$/, '');
  if (!/^[\d.+\-*/^%()]+$/.test(src) || !/\d[+\-*/^%(]|\)/.test(src) || !/[+\-*/^%]/.test(src.replace(/^-/, ''))) return null;
  let i = 0;
  const peek = () => src[i];
  const num = () => { const m = /^\d*\.?\d+/.exec(src.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
  const atom = () => {
    if (peek() === '-') { i++; return -atom(); }
    if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw 0; i++; return v; }
    let v = num();
    if (peek() === '%') { i++; v /= 100; }
    return v;
  };
  const pow = () => { const b = atom(); if (peek() === '^') { i++; return b ** pow(); } return b; };
  const term = () => { let v = pow(); while (peek() === '*' || peek() === '/') { const o = src[i++]; const r = pow(); v = o === '*' ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') { const o = src[i++]; const r = term(); v = o === '+' ? v + r : v - r; } return v; };
  try { const v = expr(); if (i !== src.length || !Number.isFinite(v)) return null; return Math.round(v * 1e10) / 1e10; } catch { return null; }
}

function v1Slash(q) {
  const [cmd, ...rest] = q.slice(1).split(/\s+/);
  const arg = rest.join(' ').toLowerCase();
  const all = [
    { c: 'space', d: 'Switch to a space', icon: 'layers', sub: () => S.workspaces.filter((w) => !arg || w.name.toLowerCase().includes(arg)).map((w) => ({ t: `/space ${w.name}`, run: () => switchWorkspace(w.id) })) },
    { c: 'theme', d: 'Change the look', icon: 'palette', sub: () => [['Dark', () => setTheme('dark')], ['Light', () => setTheme('light')], ['System', () => setTheme('system')]]
      .filter(([n]) => !arg || n.toLowerCase().includes(arg)).map(([n, run]) => ({ t: `/theme ${n}`, run: () => { run(); save(); } })) },
    { c: 'card', d: 'Your Oto Card', icon: 'card', run: () => openLibrary('card') },
    { c: 'library', d: 'Downloads, history, spaces…', icon: 'library', run: () => openLibrary() },
    { c: 'history', d: 'Pages you visited', icon: 'clock', run: () => openLibrary('history') },
    { c: 'downloads', d: 'Your downloads', icon: 'download', run: () => openLibrary('downloads') },
    { c: 'passwords', d: 'Saved logins', icon: 'key', run: () => openLibrary('passwords') },
    { c: 'settings', d: 'Open settings', icon: 'settings', run: () => openSettings() },
    { c: 'split', d: 'Split view', icon: 'split', run: () => toggleSplit() },
    { c: 'pip', d: 'Picture in picture', icon: 'pip', run: () => pictureInPicture() },
    { c: 'newspace', d: 'Make a new space', icon: 'plus', run: () => openWsDialog() },
    { c: 'closed', d: 'Recently closed tabs', icon: 'history', run: () => (typeof v1RecentlyClosed === 'function' ? v1RecentlyClosed() : reopenClosed()) },
    { c: 'shortcuts', d: 'Every keyboard shortcut', icon: 'keyboard', run: () => (typeof v1ShortcutSheet === 'function' ? v1ShortcutSheet(true) : openSettings('shortcuts')) },
    { c: 'whatsnew', d: 'What’s new in Oto', icon: 'star', run: () => showWhatsNew({ all: true }) },
  ];
  const items = [];
  const exact = all.find((x) => x.c === (cmd || '').toLowerCase());
  if (exact && exact.sub) {
    for (const s2 of exact.sub()) items.push({ g: 'Commands', icon: exact.icon, t: s2.t, s: '', hint: 'Run', run: () => { closeCmd(false); s2.run(); } });
  } else {
    for (const x of all.filter((y) => y.c.startsWith((cmd || '').toLowerCase()))) {
      items.push({ g: 'Commands', icon: x.icon, t: `/${x.c}`, s: x.d, hint: x.sub ? 'Choose' : 'Run', run: () => {
        if (x.sub) { $('#cmdInput').value = `/${x.c} `; computeItems(); return; }
        closeCmd(false); x.run();
      } });
    }
  }
  return items;
}

function v1CmdExtra(q) {
  const ws = words(q);
  const extra = [];
  if (!q) return extra;
  const bms = (typeof allBookmarks === 'function' ? allBookmarks(S.bookmarks || []) : []).filter((b) => b.url && matchAll(`${b.title} ${b.url}`, ws)).slice(0, 4);
  for (const b of bms) extra.push({ g: 'Bookmarks', hist: { u: b.url, t: b.title }, t: b.title || prettyUrl(b.url), s: prettyUrl(b.url), hint: 'Open', run: (nt) => go(b.url, nt) });
  for (const w of S.workspaces.filter((x) => matchAll(x.name, ws))) extra.push({ g: 'Spaces', icon: 'layers', t: w.name, s: w.id === S.activeWs ? 'you’re here' : `${S.tabs.filter((t) => t.ws === w.id).length} tabs`, hint: 'Switch', run: () => { closeCmd(false); switchWorkspace(w.id); } });
  return extra;
}
function v1CmdAll(f) {
  const out = [];
  if (f === 'tabs') for (const t of S.tabs.filter((x) => x.ws === S.activeWs || x.essential)) out.push({ g: 'Tabs', tab: t, t: t.title || prettyUrl(t.url), s: prettyUrl(t.url), hint: 'Switch to tab', run: () => { closeCmd(false); activate(t.id); } });
  if (f === 'history') { const seen = new Set(); for (const hi of S.history) { if (seen.size >= 40) break; if (seen.has(hi.u)) continue; seen.add(hi.u); out.push({ g: 'History', hist: hi, t: hi.t || prettyUrl(hi.u), s: prettyUrl(hi.u), hint: 'Open', run: (nt) => go(hi.u, nt) }); } }
  if (f === 'bookmarks') for (const b of (typeof allBookmarks === 'function' ? allBookmarks(S.bookmarks || []) : []).slice(0, 60)) out.push({ g: 'Bookmarks', hist: { u: b.url, t: b.title }, t: b.title || prettyUrl(b.url), s: prettyUrl(b.url), hint: 'Open', run: (nt) => go(b.url, nt) });
  if (f === 'actions') for (const a of ACTIONS) out.push({ g: 'Actions', icon: a.icon, t: a.name, s: '', k: V1_KEYS[a.name], hint: 'Run', run: () => { closeCmd(false); a.run(); } });
  if (f === 'spaces') for (const w of S.workspaces) out.push({ g: 'Spaces', icon: 'layers', t: w.name, s: w.id === S.activeWs ? 'you’re here' : `${S.tabs.filter((t) => t.ws === w.id).length} tabs`, hint: 'Switch', run: () => { closeCmd(false); switchWorkspace(w.id); } });
  return out;
}

function v1Board3() {
  const _compute = computeItems;
  computeItems = function () {
    const q = $('#cmdInput').value.trim();
    if (q.startsWith('/') && !/^\/\//.test(q)) { C.items = v1Slash(q); V1C.counts = {}; C.sel = 0; renderCmd(); return; }
    _compute.apply(this, arguments);
    let items = C.items;
    for (const it of items) if (it.g === 'Actions') it.k = V1_KEYS[it.t];
    items = [...items, ...v1CmdExtra(q)];
    const ans = q ? v1Math(q) : null;
    if (ans != null) items.unshift({ g: 'Quick answer', icon: 'calc', t: q.replace(/=\s*$/, ''), ans, s: '', hint: 'Copy', run: () => { v1Copy(String(ans)); closeCmd(false); toast(`Copied ${ans}`, { icon: 'copy', timeout: 1500 }); } });
    // group order: top, quick answer, tabs, history, bookmarks, actions, spaces, suggestions
    const order = { '': 0, 'Quick answer': 1, 'Open tabs': 2, Tabs: 2, Recent: 3, History: 3, Archived: 3, Bookmarks: 4, Actions: 5, Spaces: 6, Suggestions: 7 };
    items = items.map((it, n) => ({ it, n })).sort((a, b) => ((order[a.it.g] ?? 8) - (order[b.it.g] ?? 8)) || a.n - b.n).map((x) => x.it);
    V1C.counts = {};
    if (q) for (const it of items) { const c = V1_CAT[it.g]; if (c) V1C.counts[c] = (V1C.counts[c] || 0) + 1; }
    if (V1C.f !== 'all') items = q ? items.filter((it) => V1_CAT[it.g] === V1C.f) : v1CmdAll(V1C.f);
    C.items = items; C.sel = 0;
    renderCmd();
  };
  const _render = renderCmd;
  renderCmd = function () {
    _render.apply(this, arguments);
    let chips = $('#v1Chips');
    if (!chips) { chips = h('div', { id: 'v1Chips', class: 'v1-chips' }); document.querySelector('.cmdk-input').after(chips); }
    const q = $('#cmdInput').value.trim();
    chips.hidden = q.startsWith('/');
    chips.replaceChildren(...V1_CHIPS.map(([id, label]) => h('button', {
      class: id === V1C.f ? 'on' : '', onmousedown: (e) => { e.preventDefault(); V1C.f = id; computeItems(); },
    }, label, q && id !== 'all' && V1C.counts[id] ? h('i', {}, String(V1C.counts[id])) : null)));
    const ws = words(q.replace(/^\//, ''));
    document.querySelectorAll('#cmdList .cmdk-item').forEach((row) => {
      const it = C.items[+row.dataset.i];
      if (!it) return;
      const t = row.querySelector('.t');
      if (t && ws.length && it.g !== '' && it.g !== 'Quick answer') {
        const txt = t.textContent, low = txt.toLowerCase();
        const marks = [];
        for (const w of ws) { let k = low.indexOf(w); if (k >= 0) marks.push([k, k + w.length]); }
        if (marks.length) {
          marks.sort((a, b) => a[0] - b[0]);
          const parts = []; let at = 0;
          for (const [a, b] of marks) { if (a < at) continue; parts.push(txt.slice(at, a), h('b', {}, txt.slice(a, b))); at = b; }
          parts.push(txt.slice(at));
          t.replaceChildren(...parts);
        }
      }
      if (it.ans != null) row.querySelector('.hint').before(h('span', { class: 'v1-ans' }, `= ${it.ans}`));
      if (it.k) row.querySelector('.hint').before(h('kbd', { class: 'v1-k' }, it.k));
    });
  };
  const _open = openCmd;
  openCmd = function () { V1C.f = 'all'; return _open.apply(this, arguments); };
  $('#cmdInput').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || $('#cmdInput').value.trim().startsWith('/')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const i = V1_CHIPS.findIndex(([id]) => id === V1C.f);
    V1C.f = V1_CHIPS[(i + (e.shiftKey ? V1_CHIPS.length - 1 : 1)) % V1_CHIPS.length][0];
    computeItems();
  }, true);
  const foot = document.querySelector('.cmdk-foot');
  if (foot) foot.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Tab</kbd> next filter</span><span><kbd>Enter</kbd> open</span><span><kbd>Alt</kbd>+<kbd>Enter</kbd> new tab</span><span class="v1-r"><kbd>/</kbd> commands like /space /theme</span>';
}
function v1Copy(text) { try { navigator.clipboard.writeText(text); } catch {} }


// ================================================================ board 4 — settings
const V1_SET_GROUPS = [
  ['Basics', ['general', 'account', 'appearance', 'sidebar', 'newtab']],
  ['Browsing', ['search', 'tabs', 'privacy', 'performance', 'bookmarks']],
  ['Make it yours', ['extensions', 'boosts', 'mods']],
  ['Oto', ['archive', 'shortcuts', 'about']],
];
const V1_SET_NAMES = { performance: 'Speed & memory', about: 'About & updates', extensions: 'Extensions', icon: 'App icon' };
const V1S = { q: '', index: null, undoT: 0 };

function v1SettingsIndex() {
  if (V1S.index) return V1S.index;
  const out = [];
  const keepTab = settingsTab;
  for (const [k, label] of PAGES) {
    try {
      settingsTab = k;
      const nodes = (PAGE_RENDER[k] || (() => []))();
      const box = h('div', {}, ...nodes);
      let sec = '';
      box.querySelectorAll('h4, .set-row').forEach((el) => {
        if (el.tagName === 'H4') { sec = el.textContent; return; }
        const l = el.querySelector('.lbl > span');
        const sub = el.querySelector('.lbl > small');
        if (l && l.textContent.trim()) out.push({ page: k, pageLabel: V1_SET_NAMES[k] || label, label: l.textContent.trim(), sub: sub ? sub.textContent.trim() : '', sec });
      });
    } catch {}
  }
  settingsTab = keepTab;
  if (settingsTab !== 'performance') { clearInterval(perfTimer); perfTimer = null; }
  V1S.index = out;
  return out;
}
function v1SettingsResults(pane) {
  const ws = words(V1S.q);
  const hits = v1SettingsIndex().filter((r) => matchAll(`${r.label} ${r.sub} ${r.sec} ${r.pageLabel}`, ws)).slice(0, 40);
  pane.replaceChildren(h('h2', { class: 'set-title' }, `Results for “${V1S.q}”`),
    hits.length ? h('div', { class: 'v1-sres' }, ...hits.map((r) => h('button', { class: 'v1-shit', onclick: () => v1GotoSetting(r) },
      h('span', { class: 'l' }, r.label), r.sub ? h('small', {}, r.sub) : null, h('span', { class: 'pg' }, `${r.pageLabel}${r.sec ? ` · ${r.sec}` : ''}`))))
      : h('p', { class: 'v1-snone' }, 'No settings match. Try another word, like “sidebar”, “password” or “grain”.'));
}
function v1GotoSetting(r) {
  V1S.q = ''; settingsTab = r.page; renderSettings();
  const row = [...document.querySelectorAll('.set-pane .set-row')].find((el) => (el.querySelector('.lbl > span') || {}).textContent === r.label);
  if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('v1-flash'); setTimeout(() => row.classList.remove('v1-flash'), 1600); }
}

function v1SavedPill(undo) {
  let pill = $('#v1Saved');
  if (!pill) { pill = h('div', { id: 'v1Saved', class: 'v1-saved' }); document.body.append(pill); }
  pill.replaceChildren(...[h('span', { class: 'ic', html: icon('check') }), 'Saved', undo ? h('button', { onclick: () => { undo(); pill.classList.remove('on'); } }, 'Undo') : null].filter(Boolean));
  pill.classList.add('on');
  clearTimeout(V1S.undoT);
  V1S.undoT = setTimeout(() => pill.classList.remove('on'), 3200);
}

function v1Board4() {
  const _render = renderSettings;
  renderSettings = function () {
    _render.apply(this, arguments);
    const body = $('#settingsBody');
    const nav = body && body.querySelector('.set-nav');
    if (!nav) return;
    const tabs = new Map([...nav.querySelectorAll('.set-tab')].map((b, i) => [PAGES[i][0], b]));
    const search = h('div', { class: 'v1-ssearch' }, h('span', { class: 'ic', html: icon('search') }));
    const inp = h('input', { placeholder: 'Search settings', spellcheck: 'false', value: V1S.q });
    inp.addEventListener('input', () => {
      V1S.q = inp.value.trim();
      const pane = body.querySelector('.set-pane');
      if (V1S.q) v1SettingsResults(pane); else renderSettings();
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Escape' && inp.value) { e.stopPropagation(); inp.value = ''; V1S.q = ''; renderSettings(); } });
    search.append(inp);
    const kids = [search];
    for (const [g, keys] of V1_SET_GROUPS) {
      kids.push(h('div', { class: 'v1-sh' }, g));
      for (const k of keys) {
        const b = tabs.get(k);
        if (!b) continue;
        if (V1_SET_NAMES[k]) b.querySelector('span:not(.ic-slot):not(.count)').textContent = V1_SET_NAMES[k];
        if (V1S.q) b.classList.remove('on');
        kids.push(b); tabs.delete(k);
      }
    }
    kids.push(...tabs.values());
    nav.replaceChildren(...kids);
    nav.classList.add('v1-nav');
    const pane = body.querySelector('.set-pane');
    if (V1S.q) { v1SettingsResults(pane); setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0); return; }
    const title = pane.querySelector('.set-title');
    const grp = V1_SET_GROUPS.find(([, keys]) => keys.includes(settingsTab));
    if (title) {
      if (V1_SET_NAMES[settingsTab]) title.textContent = V1_SET_NAMES[settingsTab];
      title.before(h('div', { class: 'v1-crumb' }, 'Settings', h('span', { html: icon('fwd') }), grp ? grp[0] : ''));
    }
  };
  const _setPref = setPref;
  setPref = function (key, val) {
    const had = Object.prototype.hasOwnProperty.call(S.settings, key);
    const before = S.settings[key];
    _setPref(key, val);
    if (before === val || key === 'updateChannel') return;
    v1SavedPill(() => { if (had) _setPref(key, before); else { delete S.settings[key]; save(); syncMainSettings(); } if (typeof applyLayout === 'function') applyLayout(); applyTheme(); if (!$('#settings').hidden) renderSettings(); });
  };
  const _open = openSettings;
  openSettings = function () { V1S.q = ''; V1S.index = null; return _open.apply(this, arguments); };
}


// ================================================================ board 5 — drag a tab onto the page to split
function v1DropZones() {
  const box = h('div', { id: 'v1Drop', class: 'v1-drop' },
    h('div', { class: 'z l', 'data-side': 'l' }, h('span', { class: 'zl', html: `${icon('split')}<b>Split left</b><small></small>` })),
    h('div', { class: 'z r', 'data-side': 'r' }, h('span', { class: 'zl', html: `${icon('split')}<b>Split right</b><small></small>` })));
  $('#content').append(box);
  const zoneAt = (e) => e.target.closest && e.target.closest('.z');
  box.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const cur = activeTab();
    if (!cur || cur.id === dragId || !V.get(cur.id)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const z = zoneAt(e);
    box.querySelectorAll('.z').forEach((n) => n.classList.toggle('on', n === z));
    const other = cur.title || prettyUrl(cur.url);
    box.querySelector('.l small').textContent = `${other} moves right`;
    box.querySelector('.r small').textContent = `${other} moves left`;
  });
  box.addEventListener('dragleave', (e) => { if (e.target === box) box.querySelectorAll('.z').forEach((n) => n.classList.remove('on')); });
  box.addEventListener('drop', (e) => {
    e.preventDefault();
    const z = zoneAt(e);
    const id = dragId;
    box.querySelectorAll('.z').forEach((n) => n.classList.remove('on'));
    if (!z || !id) return;
    const cur = activeTab();
    if (!cur || cur.id === id) return;
    startSplit(id);
    if (z.dataset.side === 'l') swapSplit();
    toast('Split view — drag the middle bar to resize', { icon: 'split', timeout: 2200 });
  });
}
function v1PaneHeads() {
  const views = $('#views');
  let l = $('#v1PaneL'), r = $('#v1PaneR');
  if (!l) { l = h('div', { id: 'v1PaneL', class: 'v1-pane l' }); r = h('div', { id: 'v1PaneR', class: 'v1-pane r' }); views.append(l, r); }
  const sp = typeof splitOf === 'function' ? splitOf() : null;
  const on = document.body.classList.contains('split') && sp;
  l.hidden = r.hidden = !on;
  if (!on) return;
  const act = activeTab();
  const fill = (el, id, otherId) => {
    const t = tabById(id);
    if (!t) return;
    el.classList.toggle('focus', !!act && act.id === id);
    el.replaceChildren(favEl(t, null, true), h('span', { class: 't' }, t.title || prettyUrl(t.url)),
      h('button', { title: 'Swap sides', html: icon('swap'), onclick: (e) => { e.stopPropagation(); swapSplit(); } }),
      h('button', { title: 'Close this side', html: icon('x'), onclick: (e) => { e.stopPropagation(); delete S.splits[S.activeWs]; save(); activate(otherId); } }));
    el.onclick = () => activate(id);
  };
  fill(l, sp.a, sp.b); fill(r, sp.b, sp.a);
}
function v1Board5() {
  v1DropZones();
  const _apply = applySplit;
  applySplit = function () { _apply.apply(this, arguments); v1PaneHeads(); };
  const _rn = renderNow;
  renderNow = function () { _rn.apply(this, arguments); v1PaneHeads(); };
}


// ================================================================ board 6 — error pages + Ring Run
const V1E = { retryT: 0, retryAt: 0, tries: 0, tick: 0, key: '' };
const V1_ERR_ART = `<svg class="v1-err-art" viewBox="0 0 64 64" width="120" height="120"><defs><linearGradient id="v1eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a855f7"/><stop offset=".5" stop-color="#6366f1"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
  <g fill="none" stroke="url(#v1eg)" stroke-linecap="round"><path d="M44.5 15.2 A21 21 0 1 0 49.6 21.3" stroke-width="3" stroke-dasharray="4 5" opacity=".6"/>
  <path d="M30 32 C27 27.5 24 26 21 26 C17.6 26 15 28.7 15 32 C15 35.3 17.6 38 21 38 C24 38 27 36.5 30 32" stroke-width="3.4"/>
  <path d="M34 32 C37 27.5 40 26 43 26 C46.4 26 49 28.7 49 32 C49 35.3 46.4 38 43 38 C40 38 37 36.5 34 32" stroke-width="3.4"/></g>
  <path d="M30.8 28.5l2.4 2M30.8 35.5l2.4-2" stroke="#ec4899" stroke-width="1.6" stroke-linecap="round"/></svg>`;

function v1Retry() {
  const t = activeTab(), v = activeView();
  if (!t || !v) return;
  const u = (v.error && v.error.url) || t.url;
  v.error = null; updateChrome(); loadIn(t, u);
}
function v1StopRetry() { clearTimeout(V1E.retryT); clearInterval(V1E.tick); V1E.retryT = 0; }
function v1ScheduleRetry() {
  v1StopRetry();
  const wait = [5, 10, 20, 30, 60][Math.min(V1E.tries, 4)] * 1000;
  V1E.retryAt = Date.now() + wait;
  V1E.retryT = setTimeout(() => { V1E.tries++; v1Retry(); }, wait);
  const paint = () => {
    const el = $('#v1RetryLine');
    if (!el) return;
    const left = Math.max(0, Math.ceil((V1E.retryAt - Date.now()) / 1000));
    el.querySelector('.tx').textContent = `Trying again in ${left} s…`;
    el.querySelector('.rg').style.setProperty('--p', String(1 - (V1E.retryAt - Date.now()) / wait));
  };
  paint(); V1E.tick = setInterval(paint, 250);
}

function v1ErrorPage(v) {
  const e = v.error;
  const box = $('#error');
  const u = e.url || '';
  const host = (hostOf(u) || 'this site').replace(/^www\./, '');
  const offline = e.code === -106 || ((e.code === -105 || e.code === -137 || e.code === -21) && !navigator.onLine);
  const cert = typeof e.code === 'number' && e.code <= -200 && e.code > -300;
  const crash = e.code === 'crash';
  const key = `${e.code}|${u}`;
  if (V1E.key !== key) { V1E.key = key; if (!offline) V1E.tries = 0; }
  v1StopRetry();
  let kind = 'other', title, msg, art = V1_ERR_ART, btns;
  const btn = (label, ic, run, primary) => h('button', { class: `v1-ebtn${primary ? ' p' : ''}`, onclick: run, html: `${icon(ic)}<span>${label}</span>` });
  if (offline) {
    kind = 'offline'; title = 'You’re offline';
    msg = h('p', {}, 'Oto can’t reach ', h('b', {}, host), ' because your internet connection is off. Your tabs are safe — Oto opens the page by itself as soon as you’re back.');
    btns = [btn('Try again', 'reload', v1Retry, true)];
  } else if (cert) {
    kind = 'cert'; title = 'This site isn’t safe right now'; art = `<span class="v1-eico red">${icon('alert')}</span>`;
    msg = h('p', {}, 'The lock for ', h('b', {}, host), ' is broken, so someone could see or change what you send. Oto stopped before the page opened.');
    btns = [btn('Go back', 'back', () => { const w = v.wv; try { if (w.canGoBack()) w.goBack(); else closeTab(activeTab().id); } catch {} }, true), btn('Details', 'info', () => toast(`${e.desc || 'Certificate error'} (${e.code})`, { timeout: 4000 }))];
  } else if (crash) {
    kind = 'crash'; title = 'This tab crashed'; art = `<span class="v1-eico violet">${icon('moon')}</span>`;
    msg = h('p', {}, 'The page stopped working. Your other tabs are still running fine.');
    btns = [btn('Reload', 'reload', v1Retry, true), btn('Close tab', 'x', () => closeTab(activeTab().id))];
  } else {
    const known = ERRORS[String(e.code)];
    title = known ? known[0] : 'This page can’t be reached';
    msg = h('p', {}, known ? known[1](u) : `${e.desc || 'Something went wrong'} (${e.code})`);
    btns = [btn('Try again', 'reload', v1Retry, true), e.code === -105 ? btn('Search instead', 'search', () => openUrl(resolveInput(host).url || host)) : null];
  }
  const kids = [h('div', { class: 'art', html: art }), h('h2', {}, title), msg, h('div', { class: 'btns' }, ...btns.filter(Boolean))];
  if (offline) {
    kids.push(h('div', { id: 'v1RetryLine', class: 'v1-retry' }, h('span', { class: 'rg' }), h('span', { class: 'tx' }, '')));
    kids.push(h('div', { class: 'v1-checks' },
      h('div', {}, iconEl('wifioff'), h('span', {}, 'Internet', h('small', {}, navigator.onLine ? 'Looks connected' : 'Not connected'))),
      h('div', {}, iconEl('globe'), h('span', {}, 'Other sites', h('small', {}, navigator.onLine ? 'Might work' : 'Also offline'))),
      h('div', {}, iconEl('shield'), h('span', {}, 'Oto', h('small', {}, 'Working fine')))));
  }
  box.querySelectorAll('.v1-err, .v1-game').forEach((n) => n.remove());
  const inner = box.querySelector('.err-inner');
  if (inner) inner.hidden = true;
  box.append(h('div', { class: `v1-err ${kind}` }, ...kids));
  if (offline) box.append(v1RingRun());
  box.classList.add('v1e');
  if (offline) v1ScheduleRetry();
}

// Ring Run: jump the ∞ through the rings while you wait (Space, ↑ or click).
function v1RingRun() {
  const card = h('div', { class: 'v1-game', tabindex: '0' });
  const cv = h('canvas', { width: 520, height: 150 });
  const best = () => (S.v1RingBest || 0);
  card.append(h('div', { class: 'gt', html: `${icon('star')}<b>Ring Run</b><span class="bs">BEST ${best()}</span>` }), cv, h('small', {}, 'Space or click to jump the ∞ through the rings'));
  const ctx = cv.getContext('2d');
  const G = { y: 75, vy: 0, rings: [], t: 0, score: 0, state: 'ready', last: 0, raf: 0 };
  const W = 520, H = 150, PX = 80;
  const reset = () => { Object.assign(G, { y: 75, vy: 0, rings: [], t: 0, score: 0, state: 'ready' }); };
  const jump = () => {
    if (G.state === 'over') { reset(); }
    if (G.state === 'ready') G.state = 'play';
    G.vy = -4.6;
  };
  const inf = (x, y, s) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const g = ctx.createLinearGradient(-12, 0, 12, 0); g.addColorStop(0, '#a855f7'); g.addColorStop(1, '#22d3ee');
    ctx.strokeStyle = g; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -6, -8, -7, -11, -7); ctx.bezierCurveTo(-15, -7, -17, -3.5, -17, 0); ctx.bezierCurveTo(-17, 3.5, -15, 7, -11, 7); ctx.bezierCurveTo(-8, 7, -4, 6, 0, 0);
    ctx.bezierCurveTo(4, -6, 8, -7, 11, -7); ctx.bezierCurveTo(15, -7, 17, -3.5, 17, 0); ctx.bezierCurveTo(17, 3.5, 15, 7, 11, 7); ctx.bezierCurveTo(8, 7, 4, 6, 0, 0);
    ctx.stroke(); ctx.restore();
  };
  const step = (now) => {
    if (!card.isConnected) return;
    G.raf = requestAnimationFrame(step);
    const dt = Math.min(2, (now - (G.last || now)) / 16.7); G.last = now;
    if (G.state === 'play') {
      G.t += dt;
      G.vy += 0.24 * dt; G.y += G.vy * dt;
      const speed = 2.6 + Math.min(2.4, G.score * 0.08);
      if (!G.rings.length || G.rings[G.rings.length - 1].x < W - 170) G.rings.push({ x: W + 30, y: 40 + Math.random() * 70, r: 24, done: false });
      for (const r of G.rings) {
        r.x -= speed * dt;
        if (!r.done && r.x < PX) {
          r.done = true;
          if (Math.abs(G.y - r.y) < r.r - 7) { G.score++; r.hit = 1; }
          else { G.state = 'over'; if (G.score > best()) { S.v1RingBest = G.score; save(); card.querySelector('.bs').textContent = `BEST ${G.score}`; } }
        }
      }
      G.rings = G.rings.filter((r) => r.x > -40);
      if (G.y > H - 10 || G.y < 8) { G.y = clamp(G.y, 8, H - 10); if (G.state === 'play') { G.state = 'over'; if (G.score > best()) { S.v1RingBest = G.score; save(); card.querySelector('.bs').textContent = `BEST ${G.score}`; } } }
    }
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#2c2540'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, H - 4); ctx.lineTo(W, H - 4); ctx.stroke();
    for (const r of G.rings) {
      ctx.strokeStyle = r.hit ? 'rgba(74,222,128,.9)' : '#4b4366'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, 9, r.r, 0, 0, Math.PI * 2); ctx.stroke();
    }
    inf(PX, G.y, 0.9);
    ctx.fillStyle = '#e9e5f5'; ctx.font = '600 14px ui-monospace, Consolas, monospace'; ctx.textAlign = 'right';
    ctx.fillText(String(G.score), W - 10, 22);
    if (G.state !== 'play') { ctx.textAlign = 'center'; ctx.fillStyle = '#c4b5fd'; ctx.font = '600 15px system-ui, sans-serif'; ctx.fillText(G.state === 'over' ? `Score ${G.score} — Space to try again` : 'Press Space to start', W / 2, H / 2 + 5); }
  };
  card.addEventListener('mousedown', (e) => { e.preventDefault(); card.focus(); jump(); });
  card.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); jump(); } });
  requestAnimationFrame(step);
  return card;
}

// "Page not found" — a small, polite bar instead of covering the site's own 404 page.
function v1NotFoundBar(v, t) {
  const old = $('#v1Nf'); if (old) old.remove();
  if (!v || !v.v1nf || v.v1nf !== t.url) return;
  let u; try { u = new URL(t.url); } catch { return; }
  const bar = h('div', { id: 'v1Nf', class: 'v1-nf' }, h('span', { html: `${icon('search')}<span>This page doesn’t exist on <b>${u.hostname.replace(/^www\./, '')}</b></span>` }),
    h('button', { onclick: () => loadIn(t, `${u.origin}/`) }, 'Site home'),
    h('button', { onclick: () => openUrl(resolveInput(`${u.hostname} ${decodeURIComponent(u.pathname).replace(/[/_-]+/g, ' ').trim()}`).url) }, 'Search for it'),
    h('button', { class: 'x', html: icon('x'), onclick: () => { v.v1nf = null; bar.remove(); } }));
  $('#content').append(bar);
}

function v1Board6() {
  const _re = renderError;
  renderError = function (v) {
    _re.apply(this, arguments);
    const box = $('#error');
    if (!(v && v.error)) { v1StopRetry(); box.classList.remove('v1e'); box.querySelectorAll('.v1-err, .v1-game').forEach((n) => n.remove()); const inner = box.querySelector('.err-inner'); if (inner) inner.hidden = false; return; }
    v1ErrorPage(v);
  };
  const _bind = bindView;
  bindView = function (tab, v) {
    _bind.apply(this, arguments);
    const el = v.wv;
    el.addEventListener('render-process-gone', (e) => {
      if (e && e.details && e.details.reason === 'clean-exit') return;
      v.error = { code: 'crash', url: tab.url };
      if (activeTab() && activeTab().id === tab.id) updateChrome();
    });
    el.addEventListener('did-navigate', (e) => {
      v.v1nf = e.httpResponseCode === 404 ? e.url : null;
      if (activeTab() && activeTab().id === tab.id) v1NotFoundBar(v, tab);
    });
  };
  const _uc = updateChrome;
  updateChrome = function () { _uc.apply(this, arguments); const t = activeTab(); v1NotFoundBar(t && V.get(t.id), t || {}); };
  addEventListener('online', () => { const v = activeView(); if (v && v.error && $('#v1RetryLine')) { V1E.tries = 0; v1Retry(); } });
}


// ================================================================ board 7 — small popups
const V1F = { matchCase: false, tickSeq: 0 };
// Yellow marks on the right edge for every match (positions found by reading the page's text).
async function v1FindTicks() {
  const v = activeView();
  let box = $('#v1Ticks');
  if (!box) { box = h('div', { id: 'v1Ticks', class: 'v1-ticks' }); $('#content').append(box); }
  const q = $('#findInput').value;
  const seq = ++V1F.tickSeq;
  if (!v || !q || $('#findbar').hidden) { box.replaceChildren(); return; }
  const code = `(() => { const q = ${JSON.stringify(q)}, mc = ${V1F.matchCase}; const H = Math.max(document.documentElement.scrollHeight, 1); const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const r = document.createRange(); let n;
    const needle = mc ? q : q.toLowerCase();
    while ((n = w.nextNode()) && out.length < 400) { const t = mc ? n.data : n.data.toLowerCase(); let i = t.indexOf(needle);
      while (i >= 0 && out.length < 400) { r.setStart(n, i); r.setEnd(n, i + q.length); const b = r.getBoundingClientRect(); if (b.height) out.push((b.top + scrollY) / H); i = t.indexOf(needle, i + needle.length); } }
    return out; })()`;
  let ys = [];
  try { ys = await v.wv.executeJavaScript(code); } catch {}
  if (seq !== V1F.tickSeq) return;
  box.replaceChildren(...(ys || []).map((y) => h('i', { style: `top:${(y * 100).toFixed(2)}%` })));
}
function v1Board7Find() {
  const bar = $('#findbar');
  const aa = h('button', { id: 'v1Aa', class: 'icon-btn sm v1-aa', title: 'Match case', onclick: () => { V1F.matchCase = !V1F.matchCase; aa.classList.toggle('on', V1F.matchCase); doFind(true, true); } }, 'Aa');
  $('#findNext').after(aa);
  bar.prepend(h('span', { class: 'v1-fic', html: icon('search') }));
  const _doFind = doFind;
  doFind = function (forward = true, fresh = false) {
    const v = activeView();
    const q = $('#findInput').value;
    if (v && q && V1F.matchCase) { wv(v, (w) => w.findInPage(q, { forward, findNext: fresh, matchCase: true })); }
    else _doFind.apply(this, arguments);
    if (fresh) v1FindTicks();
  };
  const _close = closeFind;
  closeFind = function () { _close.apply(this, arguments); const b = $('#v1Ticks'); if (b) b.replaceChildren(); };
}

// Zoom pill in the middle that fades away.
let v1ZoomT = 0;
function v1ZoomPill(f) {
  let p = $('#v1Zoom');
  if (!p) {
    p = h('div', { id: 'v1Zoom', class: 'v1-zoom' },
      h('button', { html: icon('minus'), onclick: () => zoom(-1) }), h('span', { class: 'v' }), h('button', { html: icon('plus'), onclick: () => zoom(1) }),
      h('button', { class: 'rs', onclick: () => { const v = activeView(); if (v) { wv(v, (w) => w.setZoomFactor(1)); v1ZoomPill(1); } } }, 'Reset'), h('span', { class: 'bar' }, h('i')));
    p.addEventListener('mouseenter', () => clearTimeout(v1ZoomT));
    p.addEventListener('mouseleave', () => { v1ZoomT = setTimeout(() => p.classList.remove('on'), 900); });
    $('#content').append(p);
  }
  p.querySelector('.v').textContent = `${Math.round(f * 100)}%`;
  p.querySelector('.bar i').style.width = `${clamp((f - ZOOMS[0]) / (ZOOMS[ZOOMS.length - 1] - ZOOMS[0]), 0, 1) * 100}%`;
  p.classList.add('on');
  clearTimeout(v1ZoomT);
  v1ZoomT = setTimeout(() => p.classList.remove('on'), 1600);
}

// Update ready: a card at the bottom of the sidebar with the top changes.
async function v1UpdateCard(u) {
  let card = $('#v1Upd');
  if (!u || u.state !== 'ready') { if (card) card.remove(); return; }
  if (card && card.dataset.v === u.version) return;
  if (card) card.remove();
  const install = () => { save(); oto.updateInstall(); };
  card = skinIsRt()
    // Oto theme: same language as the sidebar — a numbered mono label with a hairline, a HOME-style box, a cream block button
    ? h('div', { id: 'v1Upd', class: 'v1-upd rt', 'data-v': u.version },
      h('div', { class: 'rt-lbl' }, h('span', {}, 'UPDATE'), h('i'), h('span', { class: 'ready' }, h('b'), 'READY')),
      h('div', { class: 'rt-box' }, h('span', { class: 'lg enter', html: `<i class="shock"></i>${logoSvg()}` }),
        h('div', { class: 'tx' }, h('b', {}, `OTO ${String(u.version).toUpperCase()}`), h('small', {}, 'RESTART TO INSTALL'))),
      h('div', { class: 'ua' }, h('button', { onclick: () => card.remove() }, 'Later'), h('button', { class: 'p', onclick: install }, 'Restart now')))
    : h('div', { id: 'v1Upd', class: 'v1-upd', 'data-v': u.version },
      h('div', { class: 'uh' }, h('span', { class: 'lg', html: logoSvg() }), h('div', {}, h('b', {}, `Oto ${u.version} is ready`), h('small', {}, 'Restart takes a few seconds'))),
      h('p', { class: 'un' }, 'What’s new shows up right after the restart.'),
      h('div', { class: 'ua' }, h('button', { onclick: () => card.remove() }, 'Later'), h('button', { class: 'p', onclick: install }, 'Restart now')));
  const foot = document.querySelector('#sidebar .sb-foot');
  if (foot) foot.before(card);

}

// Recently closed tabs list (also /closed in the command bar).
function v1RecentlyClosed(x, y) {
  const list = [...closedStack].reverse().slice(0, 12);
  if (!list.length) return toast('No recently closed tabs', { timeout: 1500 });
  const items = [{ header: 'Recently closed' }, ...list.map((it) => ({ label: it.tab.title || prettyUrl(it.tab.url), fav: it.tab, run: () => {
    const i = closedStack.indexOf(it);
    if (i >= 0) closedStack.splice(i, 1);
    closedStack.push(it);
    reopenClosed();
  } }))];
  if (list.length > 1) items.push('-', { label: `Reopen all ${list.length}`, icon: 'reload', run: () => { for (let i = 0; i < list.length; i++) reopenClosed(); } });
  const r = $('#sidebar').getBoundingClientRect();
  showMenu(x != null ? x : r.right + 8, y != null ? y : 120, items);
}

function v1Board7() {
  v1Board7Find();
  zoom = function (dir) {
    const v = activeView();
    if (!v) return;
    const cur = wv(v, (w) => w.getZoomFactor(), 1);
    let next = 1;
    if (dir > 0) next = ZOOMS.find((z) => z > cur + 0.001) || ZOOMS[ZOOMS.length - 1];
    if (dir < 0) next = [...ZOOMS].reverse().find((z) => z < cur - 0.001) || ZOOMS[0];
    wv(v, (w) => w.setZoomFactor(next));
    v1ZoomPill(next);
  };
  const _onUpdate = onUpdate;
  onUpdate = function (u) { if (u) v1UpdateCard(u); _onUpdate.apply(this, arguments); };
  oto.updateStatus().then((u) => v1UpdateCard(u)).catch(() => {});
  // the permission ask comes out of the address pill
  const pb = $('#permBar');
  pb.classList.add('v1-perm');
  const _snp = showNextPerm;
  showNextPerm = function () {
    _snp.apply(this, arguments);
    if (pb.hidden) return;
    const p = permQueue[0];
    const ic = p && (p.permission === 'geolocation' ? 'mappin' : p.permission === 'media' ? 'cam' : p.permission === 'notifications' ? 'bell' : 'shield');
    let i = pb.querySelector('.v1-pic');
    if (!i) { i = h('span', { class: 'v1-pic' }); pb.prepend(i); }
    i.innerHTML = icon(ic);
    const pill = $('#urlPill');
    const pr = pill.getBoundingClientRect(), cr = $('#content').getBoundingClientRect();
    if (pr.width && pr.left < cr.left) { pb.classList.add('anchored'); pb.style.left = `${Math.max(8, pr.left)}px`; pb.style.top = `${pr.bottom + 10}px`; }
    else { pb.classList.remove('anchored'); pb.style.left = ''; pb.style.top = ''; }
  };
  // Right-click "New Tab" (or /closed in the command bar) for the list of recently closed tabs.
  $('#btnNewTab').addEventListener('contextmenu', (e) => { e.preventDefault(); v1RecentlyClosed(e.clientX, e.clientY); });
}


// ================================================================ board 8 — hold Ctrl for the shortcut sheet
const V1_SHEET = [
  ['Tabs', 'sidebar', [['newTab', 'New tab / command bar'], ['closeTab', 'Close tab'], ['reopen', 'Reopen closed tab'], ['nextTab', 'Next tab'], ['togglePin', 'Pin tab'], ['toggleEssential', 'Add to Essentials']]],
  ['Spaces & view', 'layers', [['ws', 'Go to space 1–9', 'Ctrl+Shift+1…9'], ['toggleSidebar', 'Show / hide sidebar'], ['toggleTop', 'Show / hide top bar'], ['splitView', 'Split view'], ['pip', 'Picture in picture'], ['library', 'Library']]],
  ['Page', 'tab', [['focusUrl', 'Address'], ['find', 'Find on page'], ['copyUrl', 'Copy link'], ['reload', 'Reload'], ['zoomIn', 'Zoom in'], ['zoomOut', 'Zoom out']]],
  ['Oto', 'star', [['settings', 'Settings'], ['downloads', 'Downloads'], ['history', 'History'], ['devtools', 'Developer tools'], ['fullscreen', 'Full screen']]],
];
const V1K = { t: 0, open: false, pinned: false };
function v1Keys(combo) {
  return h('span', { class: 'ks' }, ...String(combo || '').split('+').filter((k, i, a) => !(k === 'Ctrl' && a.length > 1 && !V1K.pinned && false)).map((k) => h('kbd', {}, k === 'Shift' ? '⇧' : k)));
}
function v1ShortcutSheet(pinned = false) {
  v1HideSheet();
  V1K.open = true; V1K.pinned = pinned;
  const q = h('input', { placeholder: 'Find a shortcut…', spellcheck: 'false' });
  const cols = h('div', { class: 'cols' });
  const paint = () => {
    const ws = words(q.value);
    cols.replaceChildren(...V1_SHEET.map(([g, ic, rows]) => h('div', { class: 'col' }, h('h4', { html: `${icon(ic)}<span>${g.toUpperCase()}</span>` }),
      ...rows.filter(([, label]) => !ws.length || matchAll(label, ws)).map(([cmd, label, fixed]) => {
        const combo = fixed || (typeof combosFor === 'function' ? combosFor(cmd)[0] : '') || '—';
        return h('div', { class: 'k' }, h('span', {}, label), v1Keys(combo));
      }))));
  };
  q.addEventListener('input', paint);
  paint();
  const sheet = h('div', { id: 'v1Sheet', class: 'v1-sheet' + (pinned ? ' pinned' : '') },
    h('div', { class: 'ch' }, h('h3', {}, 'Shortcuts'), h('label', { class: 'srch', html: icon('search') }, q),
      h('span', { class: 'hold' }, ...(pinned ? ['Press ', h('kbd', {}, 'Esc'), ' to close'] : ['Holding ', h('kbd', {}, 'Ctrl'), ' · let go to close']))),
    cols,
    h('div', { class: 'cf' }, h('span', {}, '⇧ = Shift'), h('button', { onclick: () => { v1HideSheet(); openSettings('shortcuts'); } }, 'Change a shortcut…'),
      h('button', { onclick: () => { setPref('v1CtrlSheet', false); v1HideSheet(); toast('Hold-Ctrl sheet off — /shortcuts still shows it', { timeout: 2600 }); } }, 'Turn off holding Ctrl')));
  const layer = h('div', { id: 'v1SheetLayer', class: 'v1-sheet-layer' }, sheet);
  layer.addEventListener('mousedown', (e) => { if (e.target === layer) v1HideSheet(); });
  document.body.append(layer);
  if (pinned) setTimeout(() => q.focus(), 30);
}
function v1HideSheet() { V1K.open = false; const l = $('#v1SheetLayer'); if (l) l.remove(); }
function v1Board8() {
  oto.on('ctrl-hold', (st) => {
    clearTimeout(V1K.t);
    if (st === 'down') {
      if (S.settings.v1CtrlSheet === false || V1K.open) return;
      V1K.t = setTimeout(() => { if (!document.querySelector('.overlay:not([hidden]), #settings:not([hidden])')) v1ShortcutSheet(false); }, 900);
    } else if (st === 'up') { if (V1K.open && !V1K.pinned) v1HideSheet(); }
    else if (st === 'other') { if (V1K.open && !V1K.pinned) v1HideSheet(); }
  });
  addEventListener('mousedown', () => clearTimeout(V1K.t), true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && V1K.open) { e.stopPropagation(); v1HideSheet(); } }, true);
  addEventListener('blur', () => { clearTimeout(V1K.t); if (V1K.open && !V1K.pinned) v1HideSheet(); });
}

// ================================================================ init
function initV1() {
  Object.assign(ICONS, V1_ICONS);
  document.body.classList.add('v1');
  v1Board1();
  if (typeof v1Board2 === 'function') v1Board2();
  if (typeof v1Board3 === 'function') v1Board3();
  if (typeof v1Board4 === 'function') v1Board4();
  if (typeof v1Board5 === 'function') v1Board5();
  if (typeof v1Board6 === 'function') v1Board6();
  if (typeof v1Board7 === 'function') v1Board7();
  if (typeof v1Board8 === 'function') v1Board8();
  if (typeof initV1b === 'function') initV1b();
  if (typeof initV1c === 'function') initV1c();
  if (typeof initV1d === 'function') initV1d();
  if (typeof initV1e === 'function') initV1e();
  if (typeof initV1f === 'function') initV1f();
  if (typeof initV1g === 'function') initV1g();
}
