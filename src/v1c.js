'use strict';
/* Oto v1 — Alpha 3: pictures 17–23 (customize buttons, notifications + comfort + gestures, theme maker,
   tab folders + site notes, screenshots, Oto Wrapped, startup animation + sounds + logins per space). */

const V1C_ICONS = {
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z"/><path d="M10 20.5h4"/>',
  crop: '<path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13"/>',
  pen2: '<path d="M14.5 5.5l4 4L8 20H4v-4z"/>',
  arrow2: '<path d="M5 19L19 5M10 5h9v9"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  blur: '<circle cx="7" cy="7" r="1.5"/><circle cx="12" cy="7" r="1.5"/><circle cx="17" cy="7" r="1.5"/><circle cx="7" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="17" cy="12" r="1.5"/><circle cx="7" cy="17" r="1.5"/><circle cx="12" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/>',
  sound: '<path d="M4.5 9.5v5h3.5l4.5 4V5.5L8 9.5z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18v3H3zM12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z"/>',
  wand: '<path d="M4 20L15 9M14 4v3M17.5 5.5l-2 2M20 9h-3M10.5 5.5l2 2"/>',
};

// ================================================================ 17 · make the buttons yours
const V1_FOOT = {
  library: ['library', 'Library', () => toggleLibrary()],
  health: ['pulse', 'Oto Health', () => v1Health()],
  notifications: ['bell', 'Notifications', () => v1Notifs()],
  settings: ['settings', 'Settings', () => openSettings()],
  split: ['split', 'Split view', () => toggleSplit()],
  screenshot: ['crop', 'Screenshot', () => v1Screenshot()],
  overview: ['grid', 'Space overview', () => v1Overview()],
  theme: ['palette', 'Theme maker', () => v1ThemeMaker()],
  notes: ['note', 'Site note', () => v1NotePanel()],
  night: ['moon', 'Oto Night', () => v1SetNight(v1NightMode() === 'on' ? 'off' : 'on')],
  avocado: ['avo', 'Avocado', () => oto.openAvocado()],
  phone: ['phone', 'Send to phone', () => { const t = activeTab(); if (t) v1SendToPhone(t.url); }],
  wrapped: ['gift', 'Oto Wrapped', () => v1Wrapped()],
  extensions: ['puzzle', 'Extensions', () => { const b = $('#btnExtensions'); if (b) b.click(); }],
};
const V1_FOOT_DEFAULT = ['library', 'notifications', 'health', 'settings'];
const v1FootList = () => (Array.isArray(S.settings.v1Foot) ? S.settings.v1Foot : V1_FOOT_DEFAULT).filter((k) => V1_FOOT[k]);
let v1FootDrag = null;
function v1RenderFoot() {
  const foot = document.querySelector('#sidebar .sb-foot');
  if (!foot) return;
  let box = $('#v1Foot');
  if (!box) { box = h('div', { id: 'v1Foot', class: 'v1-foot' }); const ver = $('#v1Ver'); if (ver) ver.before(box); else foot.append(box); }
  const lab = S.settings.v1FootLabels || 'hover';
  box.className = `v1-foot lab-${lab} sz-${S.settings.v1FootSize || 'md'}`;
  box.replaceChildren(...v1FootList().map((k) => {
    const [ic, label, run] = V1_FOOT[k];
    const b = h('button', { class: 'v1-fb', 'data-k': k, title: label, draggable: document.body.classList.contains('v1-edit') ? 'true' : 'false', onclick: () => { if (!document.body.classList.contains('v1-edit')) run(); } },
      h('span', { class: 'ic', html: icon(ic) }), lab === 'text' ? h('span', { class: 'tx' }, label) : null, k === 'notifications' && V1N.unread ? h('span', { class: 'badge' }, String(Math.min(V1N.unread, 99))) : null);
    b.addEventListener('dragstart', (e) => { v1FootDrag = k; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', k); });
    b.addEventListener('dragover', (e) => { if (v1FootDrag) e.preventDefault(); });
    b.addEventListener('drop', (e) => { e.preventDefault(); v1FootMove(v1FootDrag, k); });
    return b;
  }));
}
function v1FootMove(k, before) {
  if (!k) return;
  const list = v1FootList().filter((x) => x !== k);
  const i = before ? list.indexOf(before) : -1;
  list.splice(i < 0 ? list.length : i, 0, k);
  S.settings.v1Foot = list; save(); v1RenderFoot(); v1FootDrag = null;
}
function v1Customize() {
  if (document.body.classList.contains('v1-edit')) return;
  document.body.classList.add('v1-edit');
  v1RenderFoot();
  const tray = h('div', { id: 'v1Tray', class: 'v1-tray' });
  const paint = () => {
    const used = new Set(v1FootList());
    const lab = S.settings.v1FootLabels || 'hover', sz = S.settings.v1FootSize || 'md';
    const pill = (opts, cur, set) => h('div', { class: 'v1-seg3' }, ...opts.map(([v, l]) => h('button', { class: v === cur ? 'on' : '', onclick: () => { set(v); save(); v1RenderFoot(); paint(); } }, l)));
    tray.replaceChildren(
      h('div', { class: 'th' }, h('b', {}, 'Customize Oto'), h('small', {}, 'Click a button to add or remove it. Drag the buttons at the bottom of the sidebar to reorder.'),
        h('button', { class: 'btn', onclick: () => { delete S.settings.v1Foot; save(); v1RenderFoot(); paint(); } }, 'Reset'), h('button', { class: 'btn primary', onclick: v1EndCustomize }, 'Done')),
      h('div', { class: 'items' }, ...Object.entries(V1_FOOT).map(([k, [ic, label]]) => h('button', { class: `it${used.has(k) ? ' used' : ''}`, draggable: 'true', title: used.has(k) ? 'Remove' : 'Add',
        ondragstart: (e) => { v1FootDrag = k; e.dataTransfer.setData('text/plain', k); },
        onclick: () => { const l = v1FootList(); S.settings.v1Foot = used.has(k) ? l.filter((x) => x !== k) : [...l, k]; save(); v1RenderFoot(); paint(); } },
        h('span', { class: 'bx', html: icon(ic) }), h('span', {}, label), h('i', { html: icon(used.has(k) ? 'check' : 'plus') })))),
      h('div', { class: 'opts' }, h('span', {}, 'Labels'), pill([['icons', 'Icons'], ['hover', 'Hover labels'], ['text', 'Icons + text']], lab, (v) => { S.settings.v1FootLabels = v; }),
        h('span', {}, 'Size'), pill([['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']], sz, (v) => { S.settings.v1FootSize = v; })));
  };
  paint();
  document.body.append(tray);
  const foot = $('#v1Foot');
  if (foot) { foot.addEventListener('dragover', v1FootOver); foot.addEventListener('drop', v1FootDropEnd); }
}
function v1FootOver(e) { if (v1FootDrag) e.preventDefault(); }
function v1FootDropEnd(e) { if (e.target === e.currentTarget && v1FootDrag) { e.preventDefault(); v1FootMove(v1FootDrag, null); } }
function v1EndCustomize() { document.body.classList.remove('v1-edit'); const t = $('#v1Tray'); if (t) t.remove(); v1RenderFoot(); }
function v1Board17() {
  v1RenderFoot();
  document.querySelector('#sidebar .sb-foot').addEventListener('contextmenu', (e) => {
    if (e.target.closest('#btnDownloads')) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY - 60, [{ label: 'Customize buttons…', icon: 'edit', run: v1Customize }]);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('v1-edit')) v1EndCustomize(); }, true);
  ACTIONS.push({ name: 'Customize buttons', kw: 'toolbar buttons edit arrange', icon: 'edit', run: v1Customize });
}

// ================================================================ 18 · notifications, comfort, gestures
const V1N = { list: [], unread: 0 };
const V1_NOTIF_JS = `(() => { if (window.__otoN || !window.Notification) return; window.__otoN = 1; const N = window.Notification;
  function O(title, opts) { opts = opts || {}; try { console.log('__oto_notif__' + JSON.stringify({ title: String(title || ''), body: String(opts.body || '').slice(0, 300) })); } catch (e) {}
    if (window.__otoDnd) return { close() {}, addEventListener() {}, removeEventListener() {}, onclick: null }; return new N(title, opts); }
  O.prototype = N.prototype; Object.defineProperty(O, 'permission', { get: () => N.permission }); O.requestPermission = N.requestPermission.bind(N); window.Notification = O; })()`;
const v1Dnd = () => !!S.settings.v1DndUntil && (S.settings.v1DndUntil === -1 || Date.now() < S.settings.v1DndUntil);
function v1PushDnd() { const on = v1Dnd(); for (const v of V.values()) wv(v, (w) => w.executeJavaScript(`window.__otoDnd=${on}`).catch(() => {})); }
function v1Notifs() {
  v1ClosePop();
  V1N.unread = 0; v1RenderFoot();
  const layer = v1Layer(v1ClosePop); v1Pop = layer;
  const dnd = v1Dnd();
  const until = S.settings.v1DndUntil === -1 ? 'until you turn it off' : dnd ? `until ${new Date(S.settings.v1DndUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
  const sw = h('button', { class: `switch${dnd ? ' on' : ''}`, role: 'switch', onclick: () => {
    if (v1Dnd()) { S.settings.v1DndUntil = 0; save(); v1PushDnd(); v1Notifs(); return; }
    const r = sw.getBoundingClientRect();
    showMenu(r.left - 140, r.bottom + 6, [{ header: 'Do not disturb' },
      { label: 'For 1 hour', icon: 'clock', run: () => { S.settings.v1DndUntil = Date.now() + 3600e3; save(); v1PushDnd(); v1Notifs(); } },
      { label: 'Until tomorrow morning', icon: 'moon', run: () => { const d = new Date(); d.setDate(d.getDate() + (d.getHours() >= 8 ? 1 : 0)); d.setHours(8, 0, 0, 0); S.settings.v1DndUntil = d.getTime(); save(); v1PushDnd(); v1Notifs(); } },
      { label: 'Until I turn it off', icon: 'bell', run: () => { S.settings.v1DndUntil = -1; save(); v1PushDnd(); v1Notifs(); } }]);
  } });
  const groups = new Map();
  for (const n of V1N.list) { if (!groups.has(n.host)) groups.set(n.host, []); groups.get(n.host).push(n); }
  const panel = h('div', { class: 'v1-pop v1-notifs' },
    h('div', { class: 'nh', html: `${icon('bell')}<b>Notifications</b>` }, h('span', { class: 'dnd' }, dnd ? `Do not disturb ${until}` : 'Do not disturb', sw)),
    groups.size ? h('div', { class: 'list' }, ...[...groups.entries()].map(([host, items]) => h('div', { class: 'grp' },
      h('div', { class: 'gh' }, favEl({ url: `https://${host}/`, title: host }, null, true), h('b', {}, host), items.length > 1 ? h('span', { class: 'cnt' }, String(items.length)) : null),
      ...items.slice(0, 3).map((n) => h('button', { class: 'ni', onclick: () => { v1ClosePop(); const t = S.tabs.find((x) => x.id === n.tabId); if (t) { if (t.ws !== S.activeWs && !t.essential) switchWorkspace(t.ws); activate(t.id); } } },
        h('b', {}, n.title), n.body ? h('small', {}, n.body) : null, h('span', { class: 'tm' }, v1Ago(n.at))))))) :
      h('div', { class: 'empty' }, h('span', { html: icon('bell') }), 'No notifications yet', h('small', {}, 'When a site sends one, it shows up here — even while Do not disturb is on.')),
    V1N.list.length ? h('div', { class: 'nf' }, h('button', { onclick: () => { V1N.list = []; v1Notifs(); } }, 'Clear all')) : null);
  layer.append(panel);
  const b = document.querySelector('.v1-fb[data-k="notifications"]') || $('#v1Foot') || $('#sidebar');
  const r = b.getBoundingClientRect();
  panel.style.left = `${clamp(r.left - 10, 8, innerWidth - 400)}px`;
  panel.style.bottom = `${innerHeight - r.top + 10}px`;
}

// Comfort: text size for pages, high contrast, reduce motion, bigger buttons, night light
function v1ApplyComfort() {
  const b = document.body;
  b.classList.toggle('v1-contrast', !!S.settings.v1Contrast);
  b.classList.toggle('v1-big', !!S.settings.v1Big);
  const hr = new Date().getHours();
  b.classList.toggle('v1-nightlight', !!S.settings.v1NightLight && (hr >= 21 || hr < 7));
}
function v1PageZoom(v) { const z = S.settings.v1PageZoom || 1; if (z !== 1) wv(v, (w) => { if (Math.abs(w.getZoomFactor() - 1) < 0.01) w.setZoomFactor(z); }); }
function v1ComfortSection() {
  const z = S.settings.v1PageZoom || 1;
  const sw = (key, after) => h('button', { class: `switch${S.settings[key] ? ' on' : ''}`, role: 'switch', onclick: () => { setPref(key, !S.settings[key]); v1ApplyComfort(); if (after) after(); renderSettings(); } });
  return section('Comfort',
    row('Text size on websites', 'Makes every website bigger or smaller (you can still zoom each site).', slider(z, 0.8, 1.5, 0.1, (v) => `${Math.round(v * 100)}%`, (v) => { S.settings.v1PageZoom = v; for (const vv of V.values()) wv(vv, (w) => w.setZoomFactor(v)); })),
    row('High contrast', 'Stronger lines and text in Oto.', sw('v1Contrast')),
    row('Reduce motion', 'Fades instead of slides and bounces.', h('button', { class: `switch${S.settings.reduceMotion ? ' on' : ''}`, role: 'switch', onclick: () => { setPref('reduceMotion', !S.settings.reduceMotion); applyLayout(); renderSettings(); } })),
    row('Bigger buttons', 'Easier to click: larger tabs and buttons.', sw('v1Big')),
    row('Night light', 'Warmer colours from 21:00 to 07:00.', sw('v1NightLight')),
    row('Swipe to go back', 'Swipe left or right with two fingers on a touchpad to go back or forward.', h('button', { class: `switch${S.settings.v1Swipe !== false ? ' on' : ''}`, role: 'switch', onclick: () => { setPref('v1Swipe', S.settings.v1Swipe === false); renderSettings(); } })));
}
// Two-finger swipe: the page tells Oto when you swipe sideways at the edge of what can scroll.
const V1_SWIPE_JS = `(() => { if (window.__otoSwipe) return; window.__otoSwipe = 1; let acc = 0, t = 0, cool = 0;
  const canScroll = (el, dx) => { for (; el && el !== document.documentElement; el = el.parentElement) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) { if (dx < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1) return true; } }
    const d = document.scrollingElement; return dx < 0 ? d.scrollLeft > 0 : d.scrollLeft + innerWidth < d.scrollWidth - 1; };
  addEventListener('wheel', (e) => { if (e.ctrlKey || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5 || e.deltaMode !== 0) return; const now = Date.now(); if (now < cool) return;
    if (now - t > 350) acc = 0; t = now; if (canScroll(e.target, e.deltaX)) { acc = 0; return; } acc += e.deltaX;
    if (Math.abs(acc) > 260) { console.log('__oto_swipe__' + (acc < 0 ? 'back' : 'fwd')); acc = 0; cool = now + 900; } }, { passive: true }); })()`;
function v1SwipeHint(dir) {
  const el = h('div', { class: `v1-swipe ${dir}`, html: icon(dir === 'back' ? 'back' : 'fwd') });
  $('#content').append(el);
  setTimeout(() => el.remove(), 650);
}
function v1Board18() {
  v1ApplyComfort();
  setInterval(v1ApplyComfort, 5 * 60 * 1000);
  ACTIONS.push({ name: 'Notifications', kw: 'notification center do not disturb dnd', icon: 'bell', run: v1Notifs });
  const _render = renderSettings;
  renderSettings = function () {
    _render.apply(this, arguments);
    const pane = document.querySelector('.set-pane');
    if (pane && settingsTab === 'appearance' && !V1S.q) pane.append(v1ComfortSection());
  };
}

// ================================================================ 19 · theme maker
const V1_STYLES = {
  glossy: (c) => ({ colors: c, intensity: 0.85, grain: 0.1 }),
  pastel: (c) => ({ colors: c.map((x) => mix(x, '#ffffff', 0.45)), intensity: 0.7, grain: 0.05 }),
  deep: (c) => ({ colors: c.map((x) => mix(x, '#0b0820', 0.55)), intensity: 1, grain: 0.2 }),
  mono: (c) => ({ colors: [mix(c[0], '#808080', 0.75), mix(c[0], '#202020', 0.6)], intensity: 0.8, grain: 0.3 }),
};
function v1ThemeCode(th) {
  const s = `${th.colors.map((c) => c.replace('#', '')).join('.')}-${Math.round(th.intensity * 100)}-${Math.round((th.grain || 0) * 100)}`;
  return `OTO-${btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}
function v1ParseThemeCode(code) {
  try {
    const raw = atob(String(code).trim().replace(/^OTO-/i, '').replace(/-/g, '+').replace(/_/g, '/'));
    const [cols, inten, grain] = raw.split('-');
    const colors = cols.split('.').filter((c) => /^[0-9a-f]{6}$/i.test(c)).slice(0, 3).map((c) => `#${c.toLowerCase()}`);
    if (!colors.length) return null;
    return { colors, intensity: clamp(+inten / 100 || 0.75, 0.05, 1), grain: clamp(+grain / 100 || 0, 0, 1) };
  } catch { return null; }
}
function v1ApplyWsTheme(th) {
  const ws = currentWs();
  ws.colors = [...th.colors]; ws.color = th.colors[0]; ws.intensity = th.intensity; ws.grain = th.grain;
  applyTheme(); render();
}
function v1ThemeMaker() {
  v1ClosePop();
  const ws = currentWs();
  const before = JSON.parse(JSON.stringify(themeOf(ws)));
  const th = JSON.parse(JSON.stringify(themeOf(ws)));
  const layer = v1Layer(() => { save(); v1ClosePop(); }); v1Pop = layer;
  const panel = h('div', { class: 'v1-pop v1-tm' });
  const paint = () => {
    const code = v1ThemeCode(th);
    const codeIn = h('input', { class: 'lib-input', placeholder: 'Paste a code like OTO-…', spellcheck: 'false' });
    panel.replaceChildren(...[
      h('div', { class: 'hd', html: `${icon('palette')}<b>Theme maker</b><small>${ws.name} · changes show live</small>` }),
      h('div', { class: 'ttl' }, 'COLOURS'),
      h('div', { class: 'cols' }, h('span', { class: 'bar', style: `background:linear-gradient(90deg, ${th.colors.join(', ')})` }),
        ...th.colors.map((c, i) => { const inp = h('input', { type: 'color', value: c }); inp.addEventListener('input', () => { th.colors[i] = inp.value; v1ApplyWsTheme(th); panel.querySelector('.bar').style.background = `linear-gradient(90deg, ${th.colors.join(', ')})`; panel.querySelector('.cv').textContent = v1ThemeCode(th); });
          return h('span', { class: 'cw' }, inp, th.colors.length > 1 ? h('button', { title: 'Remove', html: icon('x'), onclick: () => { th.colors.splice(i, 1); v1ApplyWsTheme(th); paint(); } }) : null); }),
        th.colors.length < 3 ? h('button', { class: 'add', html: icon('plus'), title: 'Add a colour', onclick: () => { th.colors.push(mix(th.colors[th.colors.length - 1], '#ffffff', 0.3)); v1ApplyWsTheme(th); paint(); } }) : null),
      h('div', { class: 'ttl' }, 'STYLE'),
      h('div', { class: 'styles' }, ...Object.keys(V1_STYLES).map((k) => { const p = V1_STYLES[k](before.colors); return h('button', { style: `background:linear-gradient(135deg, ${p.colors.join(', ')})`, onclick: () => { Object.assign(th, p); v1ApplyWsTheme(th); paint(); } }, k[0].toUpperCase() + k.slice(1)); })),
      h('div', { class: 'ttl' }, 'DETAILS'),
      row('Strength', null, slider(th.intensity, 0.05, 1, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => { th.intensity = v; v1ApplyWsTheme(th); })),
      row('Grain', null, slider(th.grain || 0, 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => { th.grain = v; v1ApplyWsTheme(th); })),
      h('div', { class: 'code' }, h('div', { class: 'cl' }, 'SHARE CODE'), h('div', { class: 'cv' }, code),
        h('div', { class: 'cb' }, h('button', { onclick: () => { oto.copy(v1ThemeCode(th)); toast('Theme code copied', { icon: 'copy', timeout: 1400 }); }, html: `${icon('copy')}<span>Copy</span>` }),
          h('button', { class: 'p', onclick: () => { S.v1Themes = [...(S.v1Themes || []).filter((t) => v1ThemeCode(t) !== v1ThemeCode(th)), JSON.parse(JSON.stringify(th))].slice(-12); save(); paint(); toast('Saved to My themes', { icon: 'check', timeout: 1400 }); }, html: `${icon('check')}<span>Save theme</span>` })),
        h('div', { class: 'paste' }, codeIn, h('button', { class: 'btn', onclick: () => { const p = v1ParseThemeCode(codeIn.value); if (!p) return toast('That code doesn’t look right', { timeout: 1600 }); Object.assign(th, p); v1ApplyWsTheme(th); paint(); } }, 'Try it'))),
      (S.v1Themes || []).length ? h('div', { class: 'ttl' }, 'MY THEMES') : null,
      (S.v1Themes || []).length ? h('div', { class: 'mine' }, ...S.v1Themes.map((t) => h('button', { title: v1ThemeCode(t), style: `background:linear-gradient(135deg, ${t.colors.join(', ')})`, onclick: () => { Object.assign(th, JSON.parse(JSON.stringify(t))); v1ApplyWsTheme(th); paint(); } }))) : null,
      h('div', { class: 'ft' }, h('button', { class: 'btn', onclick: () => { Object.assign(th, JSON.parse(JSON.stringify(before))); v1ApplyWsTheme(th); paint(); } }, 'Undo changes'), h('button', { class: 'btn primary', onclick: () => { save(); v1ClosePop(); } }, 'Done'))].filter(Boolean));
  };
  paint();
  layer.append(panel);
}
function v1Board19() {
  ACTIONS.push({ name: 'Theme maker', kw: 'theme colours gradient make share code', icon: 'palette', run: v1ThemeMaker });
}

// ================================================================ 20 · tab folders + site notes
const v1Folder = (id) => (S.v1Folders || []).find((f) => f.id === id);
function v1FolderRows() {
  for (const listId of ['pinned', 'tabs']) {
    const list = $(`#${listId}`);
    if (!list) continue;
    const rows = [...list.querySelectorAll(':scope > .tab')];
    const seen = new Map();
    for (const row of rows) {
      const t = tabById(row.dataset.id);
      const f = t && t.v1f && v1Folder(t.v1f);
      if (!f || f.ws !== (t.essential ? f.ws : t.ws)) continue;
      let box = seen.get(f.id);
      if (!box) {
        const kids = h('div', { class: 'v1-kids' });
        const members = S.tabs.filter((x) => x.v1f === f.id && !x.essential && x.ws === f.ws && !!x.pinned === (listId === 'pinned'));
        const head = h('div', { class: `v1-fold${f.open === false ? ' closed' : ''}`, onclick: () => { f.open = f.open === false; save(); render(); },
          oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); v1FolderMenu(f, e.clientX, e.clientY); } },
        h('span', { class: 'chev', html: icon(f.open === false ? 'fwd' : 'down') }), h('span', { class: 'fi', style: `background:${f.color}`, html: icon('folder') }),
        h('span', { class: 'nm' }, f.name), f.open === false ? h('span', { class: 'stack' }, ...members.slice(0, 3).map((m) => favEl(m, null, true))) : null, h('span', { class: 'ct' }, String(members.length)));
        head.addEventListener('dragover', (e) => { if (dragId) { e.preventDefault(); head.classList.add('drop'); } });
        head.addEventListener('dragleave', () => head.classList.remove('drop'));
        head.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); head.classList.remove('drop'); const d = tabById(dragId); if (d) { d.v1f = f.id; d.ws = f.ws; d.essential = false; d.pinned = listId === 'pinned' ? true : d.pinned; save(); render(); } });
        row.before(head, kids);
        box = kids; seen.set(f.id, kids);
        kids.hidden = f.open === false;
      }
      box.append(row);
    }
  }
}
function v1FolderMenu(f, x, y) {
  const colors = ['#f97316', '#16a34a', '#e11d48', '#7c3aed', '#0ea5e9', '#64748b'];
  showMenu(x, y, [
    { header: f.name },
    { label: 'Rename…', icon: 'edit', run: async () => { const n = await v1AskText('Rename folder', 'Give the folder a name.'); if (n && n.trim()) { f.name = n.trim().slice(0, 40); save(); render(); } } },
    { label: 'Change colour', icon: 'palette', run: () => { f.color = colors[(colors.indexOf(f.color) + 1) % colors.length]; save(); render(); } },
    { label: f.open === false ? 'Open' : 'Close', icon: 'folder', run: () => { f.open = f.open === false; save(); render(); } },
    '-',
    { label: 'Ungroup (keep tabs)', icon: 'x', run: () => { for (const t of S.tabs) if (t.v1f === f.id) delete t.v1f; S.v1Folders = S.v1Folders.filter((x2) => x2.id !== f.id); save(); render(); } },
    { label: 'Close all tabs in it', icon: 'trash', danger: true, run: () => { for (const t of S.tabs.filter((x2) => x2.v1f === f.id)) closeTab(t.id); S.v1Folders = S.v1Folders.filter((x2) => x2.id !== f.id); save(); render(); } },
  ]);
}
async function v1NewFolder(t) {
  const name = await v1AskText('New folder', 'Name the folder (you can change it later).');
  if (name === null) return;
  const f = { id: uid(), name: (name || 'New folder').trim().slice(0, 40) || 'New folder', color: '#f97316', ws: t.ws, open: true, pinned: !!t.pinned };
  S.v1Folders = [...(S.v1Folders || []), f];
  t.v1f = f.id; save(); render();
}

// Site notes: a sticky note for a page or for the whole site.
const v1NoteKey = (url, scope) => { try { const u = new URL(url); return scope === 'page' ? `${u.origin}${u.pathname}` : u.hostname.replace(/^www\./, ''); } catch { return ''; } };
function v1NoteOf(url) {
  const n = S.v1Notes || {};
  return n[v1NoteKey(url, 'page')] ? { scope: 'page', ...n[v1NoteKey(url, 'page')] } : n[v1NoteKey(url, 'site')] ? { scope: 'site', ...n[v1NoteKey(url, 'site')] } : null;
}
function v1NotePanel() {
  const t = activeTab();
  if (!t || !/^https?:/.test(t.url)) return toast('Open a website to add a note', { timeout: 1600 });
  v1ClosePop();
  const cur = v1NoteOf(t.url);
  let scope = cur ? cur.scope : 'site';
  const host = hostOf(t.url).replace(/^www\./, '');
  const ta = h('textarea', { placeholder: 'Write anything — only you can see this.', spellcheck: 'true' });
  ta.value = cur ? cur.text : '';
  const saved = h('span', { class: 'sv' }, cur ? 'Saved ✓' : '');
  let saveT = 0;
  const store = () => {
    S.v1Notes = S.v1Notes || {};
    delete S.v1Notes[v1NoteKey(t.url, 'page')]; delete S.v1Notes[v1NoteKey(t.url, 'site')];
    if (ta.value.trim()) S.v1Notes[v1NoteKey(t.url, scope)] = { text: ta.value, updated: Date.now() };
    save(); saved.textContent = ta.value.trim() ? 'Saved ✓' : ''; render(); v1NoteBadge();
  };
  ta.addEventListener('input', () => { saved.textContent = '…'; clearTimeout(saveT); saveT = setTimeout(store, 500); });
  const scopes = h('div', { class: 'sc' }, ...[['page', 'This page'], ['site', 'Whole site']].map(([k, l]) => h('button', { class: k === scope ? 'on' : '', onclick: () => { scope = k; scopes.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.textContent === l)); store(); } }, l)));
  const layer = v1Layer(() => { store(); v1ClosePop(); }); v1Pop = layer;
  const panel = h('div', { class: 'v1-note' }, h('div', { class: 'nh', html: `${icon('note')}<b>Note on ${host}</b><small>only you see this</small>` }), ta,
    h('div', { class: 'nf' }, scopes, saved, h('button', { class: 'del', title: 'Delete note', html: icon('trash'), onclick: () => { ta.value = ''; store(); v1ClosePop(); } })));
  layer.append(panel);
  const r = $('#urlPill').getBoundingClientRect();
  panel.style.left = `${clamp(r.right + 14, 8, innerWidth - 350)}px`;
  panel.style.top = `${Math.max(50, r.top)}px`;
  setTimeout(() => ta.focus(), 30);
}
function v1NoteBadge() {
  const pill = $('#urlPill');
  if (!pill) return;
  const t = activeTab();
  let b = pill.querySelector('.v1-nb');
  const has = t && /^https?:/.test(t.url) && v1NoteOf(t.url);
  if (has && !b) { b = h('span', { class: 'v1-nb', title: 'Your note on this site', html: icon('note') }); b.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); v1NotePanel(); }, true); pill.append(b); }
  else if (!has && b) b.remove();
}
function v1Board20() {
  const _rn = renderNow;
  renderNow = function () {
    _rn.apply(this, arguments);
    try { v1FolderRows(); } catch (e) { console.error(e); }
    document.querySelectorAll('#tabs .tab, #pinned .tab').forEach((row) => {
      const t = tabById(row.dataset.id);
      if (t && /^https?:/.test(t.url) && v1NoteOf(t.url) && !row.querySelector('.v1-tn')) row.querySelector('.title').after(h('span', { class: 'v1-tn', title: 'Has a note', html: icon('note') }));
    });
  };
  const _uc = updateChrome;
  updateChrome = function () { _uc.apply(this, arguments); v1NoteBadge(); };
  const _menu = tabMenu;
  tabMenu = function (t, x, y) {
    _menu.apply(this, arguments);
    const m = $('#menu');
    if (!m || t.essential) return;
    const mk = (ic, label, run) => h('button', { class: 'mi', onclick: () => { closeMenu(); run(); } }, iconEl(ic), h('span', { class: 'ml' }, label));
    const folders = (S.v1Folders || []).filter((f) => f.ws === t.ws && f.id !== t.v1f);
    const extra = [h('div', { class: 'msep' }), mk('folder', 'Add to new folder…', () => v1NewFolder(t)),
      ...folders.slice(0, 5).map((f) => mk('folder', `Move to “${f.name}”`, () => { t.v1f = f.id; if (typeof f.pinned === 'boolean') t.pinned = f.pinned; save(); render(); })),
      t.v1f ? mk('x', 'Remove from folder', () => { delete t.v1f; save(); render(); }) : null,
      mk('note', 'Note on this site…', () => { activate(t.id); setTimeout(v1NotePanel, 60); })].filter(Boolean);
    const firstSep = m.querySelector('.msep');
    if (firstSep) firstSep.before(...extra); else m.append(...extra);
    const r = m.getBoundingClientRect();
    m.style.top = `${clamp(y, 6, innerHeight - r.height - 6)}px`;
  };
  ACTIONS.push({ name: 'Note on this site', kw: 'sticky note memo', icon: 'note', run: v1NotePanel });
  const _site = v1SitePanel;
  v1SitePanel = async function () {
    await _site.apply(this, arguments);
    const panel = document.querySelector('.v1-site');
    if (!panel) return;
    const secs = panel.querySelectorAll('.sec');
    const last = secs[secs.length - 1];
    const t = activeTab();
    if (last && t) last.prepend(h('button', { class: 'v1-prow', onclick: () => { v1ClosePop(); v1NotePanel(); } }, iconEl('note'), h('span', { class: 'l' }, v1NoteOf(t.url) ? 'Your note' : 'Add a note')));
  };
}

// ================================================================ 21 · screenshots (Ctrl+Shift+X)
const V1X = { tool: 'pen', color: '#ec4899' };
function v1Screenshot(mode = 'area') {
  const v = activeView();
  if (!v || !document.getElementById('empty').classList.contains('gone')) return toast('Open a page to take a screenshot', { timeout: 1600 });
  v1CloseShot();
  const ov = h('div', { id: 'v1Shot', class: 'v1-shot' });
  const sel = h('div', { class: 'sel', hidden: true }, h('span', { class: 'dim' }));
  const modes = h('div', { class: 'modes' }, ...[['area', 'crop', 'Area'], ['visible', 'tab', 'Visible part'], ['full', 'expand', 'Whole page']].map(([k, ic, l]) =>
    h('button', { class: k === mode ? 'on' : '', html: `${icon(ic)}<span>${l}</span>`, onclick: (e) => { e.stopPropagation(); if (k === 'area') return; v1DoShot(k); } })),
  h('button', { class: 'x', html: icon('x'), title: 'Cancel (Esc)', onclick: (e) => { e.stopPropagation(); v1CloseShot(); } }));
  ov.append(h('div', { class: 'hint' }, 'Drag to pick an area'), sel, modes);
  let start = null;
  ov.addEventListener('mousedown', (e) => {
    if (e.target.closest('.modes')) return;
    const r = ov.getBoundingClientRect();
    start = { x: e.clientX - r.left, y: e.clientY - r.top };
    sel.hidden = false;
  });
  ov.addEventListener('mousemove', (e) => {
    if (!start) return;
    const r = ov.getBoundingClientRect();
    const x = clamp(e.clientX - r.left, 0, r.width), y = clamp(e.clientY - r.top, 0, r.height);
    const L = Math.min(x, start.x), T = Math.min(y, start.y), W = Math.abs(x - start.x), H = Math.abs(y - start.y);
    Object.assign(sel.style, { left: `${L}px`, top: `${T}px`, width: `${W}px`, height: `${H}px` });
    sel.querySelector('.dim').textContent = `${Math.round(W)} × ${Math.round(H)}`;
  });
  ov.addEventListener('mouseup', () => {
    if (!start) return;
    start = null;
    const rr = { x: sel.offsetLeft, y: sel.offsetTop, width: sel.offsetWidth, height: sel.offsetHeight };
    if (rr.width < 8 || rr.height < 8) { sel.hidden = true; return; }
    v1DoShot('area', rr);
  });
  $('#content').append(ov);
}
function v1CloseShot() { ['#v1Shot', '#v1Edit'].forEach((s) => { const e = $(s); if (e) e.remove(); }); }
async function v1DoShot(kind, rect) {
  const v = activeView();
  if (!v) return;
  const ov = $('#v1Shot'); if (ov) ov.style.visibility = 'hidden';
  await new Promise((r) => setTimeout(r, 60));
  let url = '';
  try {
    if (kind === 'full') url = await oto.shotFull(v.wcId);
    if (!url) { const img = await v.wv.capturePage(kind === 'area' && rect ? { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } : undefined); url = img.toDataURL(); }
  } catch {}
  v1CloseShot();
  if (!url) return toast('Couldn’t take a screenshot here', { timeout: 1800 });
  v1ShotEditor(url);
}
function v1ShotEditor(url) {
  const img = new Image();
  img.onload = () => {
    const cv = h('canvas', { width: img.width, height: img.height });
    const x = cv.getContext('2d');
    x.drawImage(img, 0, 0);
    const history = [];
    const snap = () => { history.push(x.getImageData(0, 0, cv.width, cv.height)); if (history.length > 20) history.shift(); };
    const ed = h('div', { id: 'v1Edit', class: 'v1-edit' });
    const stage = h('div', { class: 'stage' }, cv);
    const tools = [['pen', 'pen2', 'Pen'], ['arrow', 'arrow2', 'Arrow'], ['box', 'square', 'Box'], ['text', 'text', 'Text'], ['blur', 'blur', 'Blur (hide private stuff)']];
    const bar = h('div', { class: 'bar' },
      ...tools.map(([k, ic, l]) => h('button', { class: V1X.tool === k ? 'on' : '', title: l, 'data-t': k, html: icon(ic), onclick: () => { V1X.tool = k; bar.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === k)); } })),
      h('i'),
      ...['#ec4899', '#facc15', '#22d3ee', '#ffffff'].map((c) => h('button', { class: `sw${V1X.color === c ? ' on' : ''}`, style: `--c:${c}`, 'data-c': c, onclick: () => { V1X.color = c; bar.querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === c)); } })),
      h('i'),
      h('button', { title: 'Undo (Ctrl+Z)', html: icon('back'), onclick: () => { const d = history.pop(); if (d) x.putImageData(d, 0, 0); } }),
      h('button', { class: 'tx', html: `${icon('copy')}<span>Copy</span>`, onclick: () => { oto.copyImage(cv.toDataURL('image/png')); toast('Screenshot copied', { icon: 'check', timeout: 1500 }); } }),
      h('button', { class: 'tx', html: `${icon('download')}<span>Save</span>`, onclick: async () => { const f = await oto.shotSave(cv.toDataURL('image/png')); if (f) { v1ShotDone(cv.toDataURL('image/png'), f); ed.remove(); } } }),
      h('button', { class: 'tx go', html: `${icon('check')}<span>Copy &amp; close</span>`, onclick: () => { oto.copyImage(cv.toDataURL('image/png')); v1ShotDone(cv.toDataURL('image/png'), null); ed.remove(); } }),
      h('button', { title: 'Cancel', html: icon('x'), onclick: () => ed.remove() }));
    ed.append(stage, bar);
    $('#content').append(ed);
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height, s: cv.width / r.width }; };
    let st = null, base = null;
    cv.addEventListener('mousedown', async (e) => {
      const p = pos(e);
      snap();
      x.strokeStyle = x.fillStyle = V1X.color; x.lineWidth = 4 * p.s; x.lineCap = x.lineJoin = 'round';
      if (V1X.tool === 'text') {
        const t = await v1AskText('Add text', 'Type the text to place on the screenshot.');
        if (t) { x.font = `600 ${Math.round(22 * p.s)}px system-ui, sans-serif`; x.lineWidth = 4 * p.s; x.strokeStyle = 'rgba(0,0,0,.55)'; x.strokeText(t, p.x, p.y); x.fillStyle = V1X.color; x.fillText(t, p.x, p.y); }
        return;
      }
      st = p; base = x.getImageData(0, 0, cv.width, cv.height);
      if (V1X.tool === 'pen') { x.beginPath(); x.moveTo(p.x, p.y); }
    });
    cv.addEventListener('mousemove', (e) => {
      if (!st) return;
      const p = pos(e);
      if (V1X.tool === 'pen') { x.lineTo(p.x, p.y); x.stroke(); return; }
      x.putImageData(base, 0, 0);
      if (V1X.tool === 'box' || V1X.tool === 'blur') {
        if (V1X.tool === 'box') x.strokeRect(st.x, st.y, p.x - st.x, p.y - st.y);
        else { x.save(); x.setLineDash([8 * p.s, 6 * p.s]); x.lineWidth = 2 * p.s; x.strokeStyle = '#fff'; x.strokeRect(st.x, st.y, p.x - st.x, p.y - st.y); x.restore(); }
      }
      if (V1X.tool === 'arrow') {
        const a = Math.atan2(p.y - st.y, p.x - st.x), L = 18 * p.s;
        x.beginPath(); x.moveTo(st.x, st.y); x.lineTo(p.x, p.y); x.moveTo(p.x, p.y); x.lineTo(p.x - L * Math.cos(a - 0.5), p.y - L * Math.sin(a - 0.5)); x.moveTo(p.x, p.y); x.lineTo(p.x - L * Math.cos(a + 0.5), p.y - L * Math.sin(a + 0.5)); x.stroke();
      }
    });
    const end = (e) => {
      if (!st) return;
      const p = pos(e);
      if (V1X.tool === 'blur') {
        x.putImageData(base, 0, 0);
        const L = Math.round(Math.min(st.x, p.x)), T = Math.round(Math.min(st.y, p.y)), W = Math.round(Math.abs(p.x - st.x)), H = Math.round(Math.abs(p.y - st.y));
        if (W > 3 && H > 3) { const b = 12; for (let yy = T; yy < T + H; yy += b) for (let xx = L; xx < L + W; xx += b) { const d = x.getImageData(xx, yy, 1, 1).data; x.fillStyle = `rgb(${d[0]},${d[1]},${d[2]})`; x.fillRect(xx, yy, Math.min(b, L + W - xx), Math.min(b, T + H - yy)); } }
      }
      st = null;
    };
    cv.addEventListener('mouseup', end);
    cv.addEventListener('mouseleave', end);
    ed.tabIndex = -1; setTimeout(() => ed.focus(), 30);
    ed.addEventListener('keydown', (e) => { if (e.key === 'Escape') ed.remove(); if (e.ctrlKey && e.key.toLowerCase() === 'z') { const d = history.pop(); if (d) x.putImageData(d, 0, 0); } if (e.ctrlKey && e.key.toLowerCase() === 'c') { oto.copyImage(cv.toDataURL('image/png')); toast('Screenshot copied', { icon: 'check', timeout: 1500 }); } });
  };
  img.src = url;
}
function v1ShotDone(url, file) {
  const old = $('#v1ShotDone'); if (old) old.remove();
  const card = h('div', { id: 'v1ShotDone', class: 'v1-shotdone' }, h('img', { src: url, alt: '' }),
    h('div', { class: 'sd', html: `${icon('check')}<span>${file ? 'Saved to Pictures › Oto Screenshots' : 'Copied to clipboard'}</span>` }, file ? h('button', { onclick: () => oto.shotShow(file) }, 'Show') : null));
  if (file) card.querySelector('img').onclick = () => oto.shotOpen(file);
  document.body.append(card);
  setTimeout(() => card.classList.add('out'), 5000);
  setTimeout(() => card.remove(), 5400);
}
function v1Board21() {
  CMDS.screenshot = () => v1Screenshot();
  ACTIONS.push({ name: 'Screenshot', kw: 'screenshot capture snip picture whole page', icon: 'crop', run: () => v1Screenshot() });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#v1Shot')) { e.stopPropagation(); v1CloseShot(); } }, true);
}

// ================================================================ 22 · Oto Wrapped
function v1TrackTime() {
  if (AVOCADO_MODE || document.hidden || !document.hasFocus()) return;
  const t = activeTab();
  if (!t || !V.has(t.id) || !$('#empty').classList.contains('gone')) return;
  const T = S.v1Time = S.v1Time || { since: Date.now(), total: 0, hosts: {}, hours: Array(24).fill(0) };
  const host = (hostOf(t.url) || '').replace(/^www\./, '');
  T.total++; T.hours[new Date().getHours()]++;
  if (host) T.hosts[host] = (T.hosts[host] || 0) + 1;
  save();
}
function v1WrappedData() {
  const T = S.v1Time || { since: Date.now(), total: 0, hosts: {}, hours: Array(24).fill(0) };
  const useHist = T.total < 120;
  const hosts = {}, hours = Array(24).fill(0);
  if (useHist) for (const it of S.history || []) { const hst = (hostOf(it.u) || '').replace(/^www\./, ''); if (hst) hosts[hst] = (hosts[hst] || 0) + 1; hours[new Date(it.ts).getHours()]++; }
  const src = useHist ? hosts : T.hosts, hrs = useHist ? hours : T.hours;
  const top = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const peak = hrs.indexOf(Math.max(...hrs));
  const tabsNow = S.tabs.length;
  const persona = tabsNow > 25 ? ['Tab Hoarder 🗂️', `You have ${tabsNow} tabs. Each one is “for later”. We believe you.`]
    : peak >= 21 || peak < 4 ? ['Night Owl 🦉', `Your busiest hour is ${String(peak).padStart(2, '0')}:00. The internet is quieter then, and you know it.`]
      : peak < 10 ? ['Early Bird 🐦', `Your busiest hour is ${String(peak).padStart(2, '0')}:00 — you're online before most people have coffee.`]
        : ['Day Explorer ☀️', `Your busiest hour is ${String(peak).padStart(2, '0')}:00 — right in the middle of the day.`];
  return { T, useHist, top, hrs, peak, persona, unit: useHist ? 'visits' : 'min' };
}
function v1Wrapped() {
  const d = v1WrappedData();
  const st = S.stats || {};
  const hrsTotal = Math.floor(d.T.total / 60), mins = d.T.total % 60;
  const since = new Date(d.T.since).toLocaleDateString([], { day: 'numeric', month: 'long' });
  const name = S.settings.userName || 'You';
  const fmt = (v) => (d.unit === 'min' ? (v >= 60 ? `${Math.round(v / 60)} h` : `${v} min`) : `${v} visits`);
  const max = Math.max(1, ...d.hrs);
  const cards = [
    h('div', { class: 'wc c1' }, h('div', { class: 'wt' }, `OTO WRAPPED · ${new Date().getFullYear()}`), h('h4', {}, `${name}, here's your Oto.`),
      h('div', { class: 'huge' }, d.T.total >= 60 ? `${hrsTotal}h` : `${d.T.total}m`), h('p', {}, d.T.total >= 60 ? `${hrsTotal} hours${mins ? ` ${mins} min` : ''} on pages in Oto since ${since}. Who's counting? (Oto is.)` : `Oto started counting on ${since}. Come back in a while for the big numbers.`)),
    h('div', { class: 'wc c2' }, h('div', { class: 'wt' }, 'YOUR TOP SITES'), h('h4', {}, 'You couldn’t stop visiting…'),
      h('div', { class: 'rows' }, ...(d.top.length ? d.top.map(([hst, v], i) => h('div', {}, h('b', {}, String(i + 1)), favEl({ url: `https://${hst}/`, title: hst }, null, true), h('span', {}, hst), h('small', {}, fmt(v)))) : [h('p', {}, 'Browse a bit and your top sites show up here.')]))),
    h('div', { class: 'wc c3' }, h('div', { class: 'wt' }, 'YOU ARE A…'), h('h4', {}, d.persona[0]), h('p', {}, d.persona[1]),
      h('div', { class: 'hrs' }, ...d.hrs.map((v, i) => h('i', { class: i === d.peak ? 'pk' : '', style: `height:${Math.max(4, (v / max) * 100)}%` }))), h('div', { class: 'hl' }, h('span', {}, '00:00'), h('span', {}, '12:00'), h('span', {}, '23:00'))),
    h('div', { class: 'wc c4' }, h('div', { class: 'wt' }, 'OTO HAD YOUR BACK'), h('h4', {}, 'Behind the scenes'),
      h('div', { class: 'stats' }, h('div', {}, h('b', {}, (st.blocked || 0).toLocaleString()), h('small', {}, 'ads & trackers blocked')), h('div', {}, h('b', {}, (st.cookies || 0).toLocaleString()), h('small', {}, 'cookie popups handled')),
        h('div', {}, h('b', {}, (st.pages || 0).toLocaleString()), h('small', {}, 'pages opened')), h('div', {}, h('b', {}, String(S.workspaces.length)), h('small', {}, `space${S.workspaces.length === 1 ? '' : 's'}`)))),
    h('div', { class: 'wc c5' }, h('div', { class: 'wt' }, 'THAT’S A WRAP'), h('h4', {}, `Thanks for using Oto, ${name}.`), h('p', {}, 'Share your Wrapped as a picture — nothing else leaves your PC.'),
      h('button', { class: 'share', onclick: () => v1WrappedPicture(d, st, name) }, 'Copy as picture')),
  ];
  let i = 0;
  const dots = h('div', { class: 'dots' }, ...cards.map(() => h('i')));
  const stage = h('div', { class: 'stage' });
  const show = () => { stage.replaceChildren(cards[i]); dots.querySelectorAll('i').forEach((el, k) => el.classList.toggle('on', k <= i)); };
  const layer = h('div', { id: 'v1Wrap', class: 'v1-wrap', tabindex: '-1' }, h('div', { class: 'box' }, dots, stage,
    h('button', { class: 'nav p', html: icon('back'), onclick: () => { i = Math.max(0, i - 1); show(); } }), h('button', { class: 'nav n', html: icon('fwd'), onclick: () => { i = Math.min(cards.length - 1, i + 1); show(); } }),
    h('button', { class: 'close', html: icon('x'), onclick: () => layer.remove() })));
  layer.addEventListener('mousedown', (e) => { if (e.target === layer) layer.remove(); });
  layer.addEventListener('keydown', (e) => { if (e.key === 'Escape') layer.remove(); if (e.key === 'ArrowRight' || e.key === ' ') { i = Math.min(cards.length - 1, i + 1); show(); } if (e.key === 'ArrowLeft') { i = Math.max(0, i - 1); show(); } });
  document.body.append(layer);
  show();
  setTimeout(() => layer.focus(), 30);
}
function v1WrappedPicture(d, st, name) {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 900, 1200); g.addColorStop(0, '#6366f1'); g.addColorStop(0.5, '#a855f7'); g.addColorStop(1, '#ec4899');
  x.fillStyle = g; x.fillRect(0, 0, 900, 1200);
  x.fillStyle = '#fff'; x.font = '600 26px ui-monospace, Consolas, monospace'; x.fillText(`OTO WRAPPED · ${new Date().getFullYear()}`, 70, 110);
  x.font = '800 64px system-ui, sans-serif'; x.fillText(`${name}'s Oto`, 70, 200);
  x.font = '800 160px system-ui, sans-serif'; x.fillText(d.T.total >= 60 ? `${Math.floor(d.T.total / 60)}h` : `${d.T.total}m`, 64, 380);
  x.font = '500 30px system-ui, sans-serif'; x.fillText('on pages in Oto', 72, 430);
  x.font = '700 40px system-ui, sans-serif'; x.fillText(d.persona[0], 70, 540);
  x.font = '600 26px ui-monospace, Consolas, monospace'; x.fillText('TOP SITES', 70, 630);
  x.font = '600 36px system-ui, sans-serif';
  d.top.slice(0, 5).forEach(([hst], k) => x.fillText(`${k + 1}  ${hst}`, 70, 690 + k * 56));
  x.font = '500 28px system-ui, sans-serif';
  x.fillText(`${(st.blocked || 0).toLocaleString()} ads & trackers blocked`, 70, 1040);
  x.fillText(`${(st.cookies || 0).toLocaleString()} cookie popups handled`, 70, 1085);
  x.globalAlpha = 0.7; x.font = '600 24px ui-monospace, Consolas, monospace'; x.fillText('made with Oto', 70, 1150);
  oto.copyImage(c.toDataURL('image/png'));
  toast('Wrapped copied as a picture', { icon: 'check', timeout: 1800 });
}
function v1Board22() {
  setInterval(v1TrackTime, 60000);
  ACTIONS.push({ name: 'Oto Wrapped', kw: 'wrapped recap year stats summary', icon: 'gift', run: v1Wrapped });
}

// ================================================================ 23 · startup animation, sounds, logins per space
// Startup sound: a deep rumble that swells while the rings spin up, a boom when the light bursts out (0.75 s).
function v1IntroSound() {
  if (S.settings.v1IntroSound === false) return;
  try {
    const a = new Audio('sounds/start.mp3');
    a.volume = Math.max(0, Math.min(1, S.settings.v1IntroSoundVol ?? 0.6));
    a.play().catch(() => {});
  } catch {}
}
function v1Intro() {
  if (AVOCADO_MODE || S.settings.v1Intro === false || S.settings.reduceMotion || S.settings.animations === 'off') return;
  if (typeof skinIsRt === 'function' && skinIsRt()) {
    // Oto theme: a galaxy forms — star dust swirls in from far out and settles into two spiral arms,
    // the white hole ignites (with the boom), a shockwave and stars rush out past you, then 音 and OTO.
    const el = h('div', { id: 'v1Intro', class: 'v1-intro rt gx', html: `<div class="gbg">${galaxyBg({ band: false, stars: 520 })}</div><div class="st"><div class="vx"><i class="shock"></i>${vortexSvg({ bg: false, live: true })}</div>
      <div class="ln"><i></i><span class="k">音</span><i></i></div>
      <div class="w">OTO</div></div>` });
    document.body.append(el);
    v1IntroSound();
    // stars passing by: warp streaks out of the white hole, starting on the boom
    const cv = h('canvas', { class: 'warp' });
    el.prepend(cv);
    const warp = vortexWarp(cv), t0 = performance.now();
    const frame = () => {
      if (!el.isConnected) return;
      const sv = el.querySelector('.vx svg'), r = sv ? sv.getBoundingClientRect() : null;
      warp((performance.now() - t0) / 1000, r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top + r.height * 0.484 : innerHeight / 2);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    setTimeout(() => el.classList.add('out'), 1950);
    setTimeout(() => el.remove(), 2350);
    return;
  }
  const el = h('div', { id: 'v1Intro', class: 'v1-intro', html: `<svg viewBox="0 0 64 64" width="96" height="96"><defs><linearGradient id="v1ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a855f7"/><stop offset=".5" stop-color="#6366f1"/><stop offset="1" stop-color="#22d3ee"/></linearGradient><filter id="v1if" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g fill="none" stroke="url(#v1ig)" stroke-linecap="round" filter="url(#v1if)"><path class="r" d="M44.5 15.2 A21 21 0 1 0 49.6 21.3" stroke-width="3.4"/><path class="i" transform="translate(32 32) scale(.84) translate(-32 -32)" d="M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z" stroke-width="4"/></g></svg>` });
  document.body.append(el);
  setTimeout(() => el.classList.add('out'), 820);
  setTimeout(() => el.remove(), 1150);
}
// Oto sounds (音): tiny sounds made on the fly — no sound files.
let v1Audio = null;
function v1Sound(kind) {
  const pack = S.settings.v1Sounds || 'off';
  if (pack === 'off' || AVOCADO_MODE) return;
  try {
    v1Audio = v1Audio || new AudioContext();
    const a = v1Audio, now = a.currentTime, vol = (S.settings.v1SoundVol ?? 0.5) * 0.25;
    const g = a.createGain(); g.connect(a.destination);
    const notes = { open: [660, 880], close: [520, 390], done: [660, 990, 1320], space: [440, 660] }[kind] || [600];
    if (pack === 'soft') {
      notes.forEach((f, i) => { const o = a.createOscillator(), gg = a.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.setValueAtTime(0, now + i * 0.07); gg.gain.linearRampToValueAtTime(vol, now + i * 0.07 + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.35); o.connect(gg); gg.connect(a.destination); o.start(now + i * 0.07); o.stop(now + i * 0.07 + 0.4); });
    } else if (pack === 'type') {
      const n = Math.floor(a.sampleRate * 0.03), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
      const s = a.createBufferSource(), f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'close' ? 1200 : 2200;
      s.buffer = buf; s.connect(f); f.connect(g); g.gain.value = vol * 3; s.start(now);
    } else if (pack === 'bubbles') {
      const o = a.createOscillator(); o.type = 'sine';
      const up = kind !== 'close';
      o.frequency.setValueAtTime(up ? 300 : 900, now); o.frequency.exponentialRampToValueAtTime(up ? 1100 : 280, now + 0.12);
      g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      o.connect(g); o.start(now); o.stop(now + 0.18);
    }
  } catch {}
}
function v1SoundSection() {
  const cur = S.settings.v1Sounds || 'off';
  return section('Oto sounds (音)',
    row('Sound pack', 'Little sounds for new tab, close tab, download done and switching spaces. Off by default.',
      seg([['off', 'Off'], ['soft', 'Soft'], ['type', 'Typewriter'], ['bubbles', 'Bubbles']], cur, (v) => { S.settings.v1Sounds = v; save(); setTimeout(() => v1Sound('done'), 50); })),
    cur !== 'off' ? row('Volume', null, h('div', { style: 'display:flex;gap:8px;align-items:center' }, slider(S.settings.v1SoundVol ?? 0.5, 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => { S.settings.v1SoundVol = v; }), h('button', { class: 'btn', onclick: () => v1Sound('done') }, 'Play'))) : null,
    row('Startup animation', 'The Oto vortex spins up when Oto opens (under two seconds).', h('button', { class: `switch${S.settings.v1Intro !== false ? ' on' : ''}`, role: 'switch', onclick: () => { setPref('v1Intro', S.settings.v1Intro === false); renderSettings(); } })),
    S.settings.v1Intro !== false ? row('Startup sound', 'A deep rumble and boom with the startup animation.', h('div', { style: 'display:flex;gap:8px;align-items:center' },
      S.settings.v1IntroSound !== false ? slider(S.settings.v1IntroSoundVol ?? 0.6, 0.05, 1, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => { S.settings.v1IntroSoundVol = v; }) : null,
      S.settings.v1IntroSound !== false ? h('button', { class: 'btn', onclick: () => { save(); v1IntroSound(); } }, 'Play') : null,
      h('button', { class: `switch${S.settings.v1IntroSound !== false ? ' on' : ''}`, role: 'switch', onclick: () => { setPref('v1IntroSound', S.settings.v1IntroSound === false); renderSettings(); } }))) : null);
}
// Separate logins per space: the space's tabs use their own cookie jar.
function v1PartitionFor(tab) {
  if (AVOCADO_MODE || !tab || tab.essential) return 'persist:oto';
  const ws = S.workspaces.find((w) => w.id === tab.ws);
  return ws && ws.v1Own ? `persist:oto-ws-${String(ws.id).replace(/[^\w-]/g, '').slice(0, 40)}` : 'persist:oto';
}
function v1ToggleOwnLogins(ws) {
  const on = !ws.v1Own;
  if (on && !confirm(`Give “${ws.name}” its own logins?\n\nIts tabs will use their own cookies, so you can be logged in to the same site with a different account here. You’ll need to log in again in this space.`)) return;
  ws.v1Own = on; save();
  const act = activeTab();
  for (const t of S.tabs.filter((x) => x.ws === ws.id && !x.essential)) if (V.has(t.id)) destroyView(t.id);
  if (act && act.ws === ws.id && !act.essential) activate(act.id); else render();
  toast(on ? `${ws.name} now has its own logins` : `${ws.name} shares logins again`, { icon: 'key', timeout: 2200 });
}
function v1Board23() {
  v1Intro();
  const _nt = newTab;
  newTab = function () { const r = _nt.apply(this, arguments); v1Sound('open'); return r; };
  const _ct = closeTab;
  closeTab = function () { v1Sound('close'); return _ct.apply(this, arguments); };
  const _sw = switchWorkspace;
  switchWorkspace = function (id) { const was = S.activeWs; const r = _sw.apply(this, arguments); if (id !== was) v1Sound('space'); return r; };
  oto.on('download', (d) => { if (d && d.state === 'completed') v1Sound('done'); });
  const _render = renderSettings;
  renderSettings = function () {
    _render.apply(this, arguments);
    const pane = document.querySelector('.set-pane');
    if (pane && settingsTab === 'appearance' && !V1S.q) pane.append(v1SoundSection());
  };
  const _wsMenu = wsMenu;
  wsMenu = function (w, x, y) {
    _wsMenu.apply(this, arguments);
    const m = $('#menu');
    if (!m) return;
    m.append(h('div', { class: 'msep' }), h('button', { class: 'mi', onclick: () => { closeMenu(); v1ToggleOwnLogins(w); } }, iconEl('key'), h('span', { class: 'ml' }, w.v1Own ? 'Share logins with other spaces' : 'Give this space its own logins'), w.v1Own ? h('span', { class: 'k' }, 'on') : null));
    const r = m.getBoundingClientRect();
    m.style.top = `${clamp(y, 6, innerHeight - r.height - 6)}px`;
  };
}

// page hooks for 18: notifications + swipe
function v1PageHooks3() {
  const _bind = bindView;
  bindView = function (tab, v) {
    _bind.apply(this, arguments);
    const el = v.wv;
    el.addEventListener('dom-ready', () => {
      el.executeJavaScript(`${V1_NOTIF_JS};window.__otoDnd=${v1Dnd()}`).catch(() => {});
      if (S.settings.v1Swipe !== false) el.executeJavaScript(V1_SWIPE_JS).catch(() => {});
      v1PageZoom(v);
    });
    el.addEventListener('console-message', (e) => {
      const m = e.message || '';
      if (m.startsWith('__oto_notif__')) {
        try {
          const n = JSON.parse(m.slice(13));
          V1N.list.unshift({ ...n, host: (hostOf(tab.url) || '').replace(/^www\./, ''), at: Date.now(), tabId: tab.id });
          V1N.list = V1N.list.slice(0, 60);
          V1N.unread++; v1RenderFoot();
        } catch {}
      }
      if (m.startsWith('__oto_swipe__') && S.settings.v1Swipe !== false) {
        const dir = m.slice(13);
        wv(v, (w) => { if (dir === 'back' && w.canGoBack()) { w.goBack(); v1SwipeHint('back'); } if (dir === 'fwd' && w.canGoForward()) { w.goForward(); v1SwipeHint('fwd'); } });
      }
    });
  };
}

// ================================================================ Alpha 3 init
function initV1c() {
  Object.assign(ICONS, V1C_ICONS);
  // keep which folder each tab is in when Oto saves
  const _persist = persistable;
  persistable = function () {
    const o = _persist.apply(this, arguments);
    const f = new Map(S.tabs.filter((t) => t.v1f).map((t) => [t.id, t.v1f]));
    if (f.size) o.tabs = o.tabs.map((t) => (f.has(t.id) ? { ...t, v1f: f.get(t.id) } : t));
    return o;
  };
  v1PageHooks3();
  for (const f of [v1Board17, v1Board18, v1Board19, v1Board20, v1Board21, v1Board22, v1Board23]) { try { f(); } catch (e) { console.error('v1c', f.name, e); } }
}
