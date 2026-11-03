'use strict';
/* Oto — split view, Glance (link previews), media controls, problem reports */

// ================================================================ problem log
// A small ring buffer of what the sidebar / top bar / cursor did, so a bug on someone's PC can be
// seen exactly as it happened. Saved from Settings → About → Report a problem.
const DIAG = [];
const DIAG_T0 = Date.now();
function diag(type, data) {
  DIAG.push([Date.now() - DIAG_T0, type, data === undefined ? '' : data]);
  if (DIAG.length > 600) DIAG.splice(0, DIAG.length - 600);
}
let diagMouseCount = 0;
async function buildReport() {
  const info = await oto.diagInfo().catch(() => ({}));
  const st = S.settings;
  const pick = ['toolbarLayout', 'collapsed', 'compact', 'sidebarSide', 'autohideTop', 'stayOpen', 'closeDelay', 'hoverDelay',
    'railWidth', 'sidebarWidth', 'snapRail', 'snapHide', 'navWhenCollapsed', 'animations', 'uiScale', 'pageStyle'];
  const lines = [
    `Oto problem report — ${new Date().toISOString()}`,
    `Version ${INFO.version || '?'} · ${info.platform || ''} ${info.osVersion || ''} · Electron ${info.electron || '?'}`,
    `Window: ${innerWidth}×${innerHeight} css px · devicePixelRatio ${devicePixelRatio} · UI zoom ${info.zoom}`,
    `Content bounds: ${JSON.stringify(info.contentBounds || {})}`,
    `Displays: ${JSON.stringify(info.displays || [])}`,
    `Body classes: ${document.body.className}`,
    `Settings: ${JSON.stringify(Object.fromEntries(pick.map((k) => [k, st[k]])))}`,
    `Page mouse reports since start: ${diagMouseCount}`,
    '',
    'Events (ms since start · event · details):',
    ...DIAG.map(([t, type, d]) => `${String(t).padStart(8)}  ${type}  ${typeof d === 'string' ? d : JSON.stringify(d)}`),
  ];
  return lines.join('\n');
}
async function saveReport() {
  const text = await buildReport();
  const r = await oto.saveReport(text);
  if (r) toast('Problem report saved — send that file to whoever is helping you', { timeout: 3600 });
}
async function copyReport() {
  oto.copy(await buildReport());
  toast('Problem report copied', { icon: 'copy', timeout: 1600 });
}
// Watch the sidebar / top bar open and close.
(() => {
  let last = '';
  new MutationObserver(() => {
    const b = document.body.classList;
    const now = ['rail-open', 'peek', 'peek-top', 'compact', 'rail', 'autohide-top', 'split'].filter((c) => b.contains(c)).join(' ');
    if (now !== last) { diag('layout', now || '(none)'); last = now; }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();

// ================================================================ split view
const splitOf = (wsId = S.activeWs) => (S.splits || {})[wsId];
const inSplit = (id) => Object.values(S.splits || {}).some((sp) => sp && (sp.a === id || sp.b === id));

function applySplit() {
  const sp = splitOf();
  const act = activeTab();
  const ok = !!(sp && sp.a !== sp.b && tabById(sp.a) && tabById(sp.b));
  if (sp && !ok) { delete S.splits[S.activeWs]; save(); }
  const showing = ok && act && (act.id === sp.a || act.id === sp.b);
  document.body.classList.toggle('split', !!showing);
  for (const rv of V.values()) rv.wv.classList.remove('split-l', 'split-r', 'split-focus');
  const bar = $('#splitBar');
  if (bar) bar.hidden = !showing;
  document.body.classList.toggle('sf-l', !!showing && act.id === sp.a);
  document.body.classList.toggle('sf-r', !!showing && act.id === sp.b);
  if (!showing) return;
  for (const [id, cls] of [[sp.a, 'split-l'], [sp.b, 'split-r']]) {
    const v = ensureView(tabById(id));
    if (v.frozen) thawView(v);
    v.hiddenAt = 0;
    v.wv.classList.add('on', cls);
    if (id === act.id) v.wv.classList.add('split-focus');
  }
  $('#views').style.setProperty('--split', String(clamp(sp.ratio || 0.5, 0.2, 0.8)));
}

function startSplit(otherId) {
  const cur = activeTab();
  if (!cur) { toast('Open a tab first', { timeout: 1600 }); return; }
  let other = otherId && otherId !== cur.id ? tabById(otherId) : null;
  if (!other) {
    other = [...essentials(), ...wsTabs()].filter((t) => t.id !== cur.id)
      .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))[0];
  }
  if (!other) { toast('Open another tab to split with', { timeout: 1800 }); return; }
  S.splits = S.splits || {};
  S.splits[S.activeWs] = { a: cur.id, b: other.id, ratio: 0.5 };
  diag('split', 'start');
  applySplit(); render(); save();
}
function endSplit() {
  if (!S.splits || !S.splits[S.activeWs]) return;
  delete S.splits[S.activeWs];
  diag('split', 'end');
  const t = activeTab();
  if (t) activate(t.id); else applySplit();
  render(); save();
}
const splitShowing = () => document.body.classList.contains('split');
function toggleSplit() { if (splitShowing()) endSplit(); else startSplit(); }
function swapSplit() {
  const sp = splitOf();
  if (!sp) return;
  [sp.a, sp.b] = [sp.b, sp.a];
  sp.ratio = 1 - (sp.ratio || 0.5);
  applySplit(); save();
}

function initSplitBar() {
  const bar = h('div', { id: 'splitBar', class: 'split-bar', title: 'Drag to resize · double-click to make equal', hidden: true }, h('span'));
  $('#views').append(bar, h('div', { id: 'splitMark', class: 'split-mark' }));
  bar.addEventListener('dblclick', () => { const sp = splitOf(); if (sp) { sp.ratio = 0.5; applySplit(); save(); } });
  bar.addEventListener('pointerdown', (e) => {
    const sp = splitOf();
    if (!sp) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    document.body.classList.add('split-drag');
    const box = $('#views').getBoundingClientRect();
    const move = (ev) => { sp.ratio = clamp((ev.clientX - box.left) / box.width, 0.2, 0.8); $('#views').style.setProperty('--split', String(sp.ratio)); };
    const up = () => {
      document.body.classList.remove('split-drag');
      bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up);
      save();
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
}

// ================================================================ Glance (link preview)
// Injected into pages. What opens Glance depends on Settings → Tabs → Glance (window.__otoGlanceMode):
//   'off'   — nothing: clicks are normal clicks (default). Right-click a link → Open link in Glance.
//   'alt'   — Alt + click on a real link; holding Alt outlines the link that would open.
//   'external' — a plain click on a link to a *different* site opens it in Glance (like Arc's Peek);
//                links within the same site (e.g. another YouTube video) open normally.
//   'click' — a plain click on any real link opens it in Glance.
// Only real links count — not video players, ad overlays or whole areas wrapped in a link.
const PAGE_HELPER = `(() => {
  if (window.__otoHelper) return; window.__otoHelper = 1;
  const mode = () => window.__otoGlanceMode || 'off';
  const st = document.createElement('style');
  st.textContent = '[data-oto-glance]{outline:2px solid rgba(139,92,246,.95)!important;outline-offset:2px!important;border-radius:4px;cursor:zoom-in!important;box-shadow:0 0 0 5px rgba(139,92,246,.18)!important}';
  (document.head || document.documentElement).appendChild(st);
  const linkAt = (el) => {
    if (!el || !el.closest) return null;
    if (el.closest('video, audio, iframe, canvas, embed, object, input, textarea, select, button, [role=button], [contenteditable=""], [contenteditable=true]')) return null;
    const a = el.closest('a[href]');
    if (!a || !/^https?:/i.test(a.href)) return null;
    const raw = a.getAttribute('href') || '';
    if (raw.startsWith('#') || a.hasAttribute('download')) return null;
    const r = a.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    if (r.width * r.height > innerWidth * innerHeight * 0.18 || r.height > innerHeight * 0.45) return null;
    const text = (a.innerText || a.getAttribute('aria-label') || a.title || '').trim();
    if (!text && !a.querySelector('img, svg, picture')) return null;
    const cs = getComputedStyle(a);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.2 || cs.pointerEvents === 'none') return null;
    return a;
  };
  let alt = false, mark = null, lastEl = null, altMoveSince = 0, downLink = null;
  const setMark = (a) => { if (mark === a) return; if (mark) mark.removeAttribute('data-oto-glance'); mark = a; if (a) a.setAttribute('data-oto-glance', ''); };
  addEventListener('keydown', (e) => { if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey) { alt = true; if (mode() === 'alt') setMark(linkAt(lastEl)); } }, true);
  addEventListener('keyup', (e) => { if (e.key === 'Alt') { alt = false; setMark(null); } }, true);
  addEventListener('blur', () => { alt = false; setMark(null); });
  addEventListener('mousemove', (e) => {
    lastEl = e.target;
    if (e.altKey) { if (!altMoveSince) altMoveSince = Date.now(); } else altMoveSince = 0;
    if (mode() === 'alt' && (alt || e.altKey)) setMark(e.altKey ? linkAt(e.target) : null); else if (mark) setMark(null);
  }, true);
  const armed = () => alt || (altMoveSince && Date.now() - altMoveSince > 120);
  const wants = (e) => {
    if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.metaKey) return false;
    const m = mode();
    if (m === 'alt') return e.altKey && armed();
    if (m === 'click' || m === 'external') return !e.altKey;
    return false;
  };
  // "site" = the last two parts of the host name (www.youtube.com and m.youtube.com are both youtube.com)
  const site = (h) => { const p = String(h || '').toLowerCase().replace(/^www\./, '').split('.'); return p.length > 2 && p[p.length - 2].length <= 3 && p[p.length - 1].length === 2 ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const otherSite = (a) => { try { return site(new URL(a.href).hostname) !== site(location.hostname); } catch (_) { return false; } };
  addEventListener('mousedown', (e) => { downLink = wants(e) ? linkAt(e.target) : null; }, true);
  addEventListener('click', (e) => {
    if (!wants(e)) { downLink = null; return; }
    const a = linkAt(e.target);
    // press and release must both be on the same real link, by a real person
    if (!a || a !== downLink || (!e.isTrusted && !window.__otoTest)) { downLink = null; return; }
    if (mode() === 'external' && !otherSite(a)) { downLink = null; return; }
    downLink = null;
    e.preventDefault(); e.stopImmediatePropagation();
    setMark(null);
    console.log('__oto_glance__' + a.href);
  }, true);
})();`;
const glanceMode = () => (['off', 'alt', 'external', 'click'].includes(S.settings.glanceMode) ? S.settings.glanceMode : 'off');
// Apply a changed Glance setting to every open page right away.
function applyGlanceMode() {
  const m = glanceMode();
  const set = `window.__otoGlanceMode = ${JSON.stringify(m)};`;
  for (const v of V.values()) if (v.ready) wv(v, (w) => w.executeJavaScript(m === 'off' ? set : `${set}${PAGE_HELPER}`).catch(() => {}));
}
const GLANCE_HELPER = `(() => {
  if (window.__otoGlance) return; window.__otoGlance = 1;
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.defaultPrevented) console.log('__oto_glance_close__'); }, true);
})();`;

let glance = null;
function openGlance(url) {
  if (!url) return;
  closeGlance(true);
  const host = $('#content');
  const wvEl = document.createElement('webview');
  wvEl.setAttribute('partition', 'persist:oto');
  wvEl.setAttribute('allowpopups', '');
  wvEl.setAttribute('plugins', '');
  wvEl.setAttribute('src', url);
  const title = h('span', { class: 'gl-title' }, prettyUrl(url));
  const fav = h('span', { class: 'gl-fav' });
  const btn = (ic, tip, run) => h('button', { class: 'icon-btn sm', title: tip, html: icon(ic), onclick: run });
  const card = h('div', { class: 'gl-card' },
    h('div', { class: 'gl-bar' }, fav, title,
      btn('split', 'Open in split view', () => glanceTo('split')),
      btn('expand', 'Open as a tab', () => glanceTo('tab')),
      btn('x', 'Close (Esc)', () => closeGlance())),
    h('div', { class: 'gl-page' }, wvEl));
  const root = h('div', { id: 'glance' }, h('div', { class: 'gl-back', onclick: () => closeGlance() }), card);
  host.append(root);
  glance = { root, wv: wvEl, url, title };
  diag('glance', 'open');
  wvEl.addEventListener('dom-ready', () => { try { wvEl.executeJavaScript(GLANCE_HELPER).catch(() => {}); if (glanceMode() !== 'off') wvEl.executeJavaScript(`window.__otoGlanceMode = ${JSON.stringify(glanceMode())};${PAGE_HELPER}`).catch(() => {}); } catch {} });
  wvEl.addEventListener('console-message', (e) => {
    const m = e.message || '';
    if (m === '__oto_glance_close__') closeGlance();
    else if (m.startsWith('__oto_glance__')) { const u = m.slice(14); if (glance) { glance.url = u; wvEl.loadURL(u); } }
  });
  wvEl.addEventListener('did-navigate', (e) => { if (glance) { glance.url = e.url; title.textContent = prettyUrl(e.url); } });
  wvEl.addEventListener('did-navigate-in-page', (e) => { if (glance && e.isMainFrame) glance.url = e.url; });
  wvEl.addEventListener('page-title-updated', (e) => { if (glance) title.textContent = e.title; });
  wvEl.addEventListener('page-favicon-updated', (e) => {
    const f = e.favicons && e.favicons[0];
    if (f) fav.replaceChildren(h('img', { src: f, alt: '' }));
  });
  wvEl.addEventListener('focus', () => {});
  setTimeout(() => { try { wvEl.focus(); } catch {} }, 250);
}
function closeGlance(instant = false) {
  if (!glance) return;
  const { root } = glance;
  glance = null;
  diag('glance', 'close');
  if (instant || !animOn()) { root.remove(); return; }
  root.classList.add('leaving');
  setTimeout(() => root.remove(), 180);
  const v = activeView();
  if (v) setTimeout(() => focusView(v), 0);
}
function glanceTo(where) {
  if (!glance) return;
  const url = glance.url;
  closeGlance(true);
  const cur = activeTab();
  const t = newTab(url);
  if (where === 'split' && cur && t) startSplit(cur.id);
}

// ================================================================ media controls
let media = null; // { tabId, playing }
const MEDIA_TOGGLE = `(() => {
  const m = [...document.querySelectorAll('video, audio')];
  const on = m.filter((x) => !x.paused);
  if (on.length) { on.forEach((x) => x.pause()); return 'paused'; }
  const t = m.find((x) => x.currentTime > 0) || m[0];
  if (t) { t.play(); return 'playing'; }
  const b = document.querySelector('[data-testid="control-button-playpause"], button.ytp-play-button, [aria-label="Play"], [aria-label="Pause"]');
  if (b) { b.click(); return 'clicked'; }
  return 'none';
})()`;
const MEDIA_PIP = `(() => {
  if (document.pictureInPictureElement) { document.exitPictureInPicture(); return 'exit'; }
  const v = [...document.querySelectorAll('video')].filter((x) => x.readyState > 0)
    .sort((a, b) => b.videoWidth * b.videoHeight - a.videoWidth * a.videoHeight)[0];
  if (!v) return 'none';
  v.disablePictureInPicture = false;
  return v.requestPictureInPicture().then(() => 'ok', (e) => 'err:' + e.message);
})()`;
async function pictureInPicture(tabId) {
  const t = tabId ? tabById(tabId) : activeTab();
  const v = t && V.get(t.id);
  if (!v) return;
  const r = await wv(v, (w) => w.executeJavaScript(MEDIA_PIP, true).catch(() => 'err'), 'err');
  if (r === 'none') toast('No video on this page', { timeout: 1600 });
  else if (String(r).startsWith('err')) toast('This video can’t pop out', { timeout: 1800 });
}
async function mediaToggle() {
  const v = media && V.get(media.tabId);
  if (!v) return;
  const r = await wv(v, (w) => w.executeJavaScript(MEDIA_TOGGLE, true).catch(() => 'none'), 'none');
  if (r === 'paused') media.playing = false;
  else if (r === 'playing' || r === 'clicked') media.playing = true;
  renderMedia();
}
function renderMedia() {
  const card = $('#mediaCard');
  if (!card) return;
  const t = media && tabById(media.tabId);
  const v = t && V.get(t.id);
  if (!t || !v || media.dismissed) { card.hidden = true; card.replaceChildren(); return; }
  card.hidden = false;
  const btn = (ic, tip, run, on) => h('button', { class: `icon-btn sm${on ? ' on' : ''}`, title: tip, html: icon(ic), onclick: (e) => { e.stopPropagation(); run(); } });
  card.replaceChildren(
    h('div', { class: 'mc-info', title: 'Go to this tab', onclick: () => activate(t.id) },
      favEl(t, v),
      h('div', { class: 'mc-text' }, h('b', {}, t.title || prettyUrl(t.url)), h('small', {}, `${hostOf(t.url)}${media.playing ? '' : ' · paused'}`))),
    h('div', { class: 'mc-btns' },
      btn(media.playing ? 'pause' : 'play', media.playing ? 'Pause' : 'Play', mediaToggle),
      btn(v.muted ? 'mute' : 'vol', v.muted ? 'Unmute' : 'Mute', () => { toggleMute(t.id); renderMedia(); }),
      btn('pip', 'Picture in picture', () => pictureInPicture(t.id)),
      btn('x', 'Hide', () => { media.dismissed = true; renderMedia(); })));
  card.classList.toggle('playing', !!media.playing);
}

// ================================================================ updates
let UPD = { state: 'idle' };
let updToastShown = '';
function updateText(u = UPD) {
  switch (u.state) {
    case 'checking': return 'Checking for updates…';
    case 'downloading': return `Downloading Oto ${u.version || ''}… ${u.percent ? `${u.percent}%` : ''}`;
    case 'ready': return `Oto ${u.version} is ready — restart to finish updating`;
    case 'latest': return 'Oto is up to date';
    case 'none-published': return 'No updates published yet';
    case 'error': return `Couldn’t check for updates${u.message ? ` (${u.message})` : ''}`;
    case 'dev': return 'Updates are off when running from source';
    default: return 'Oto checks for updates automatically';
  }
}
function onUpdate(u) {
  UPD = u || UPD;
  if (UPD.state === 'ready' && updToastShown !== UPD.version) {
    updToastShown = UPD.version;
    toast(`Oto ${UPD.version} is ready`, { icon: 'download', timeout: 12000, action: { label: 'Restart', run: () => { save(); oto.updateInstall(); } } });
  }
  const el = document.getElementById('updLine');
  if (el) el.textContent = updateText();
  const b = document.getElementById('updBtn');
  if (b) { b.textContent = UPD.state === 'ready' ? 'Restart now' : 'Check now'; b.disabled = ['checking', 'downloading'].includes(UPD.state); }
}
function updatesSection() {
  const st = S.settings;
  oto.updateStatus().then(onUpdate).catch(() => {});
  return section('Updates',
    row('Oto version', h('span', { id: 'updLine' }, updateText()), h('button', {
      id: 'updBtn', class: 'btn',
      onclick: () => { if (UPD.state === 'ready') { save(); oto.updateInstall(); } else { onUpdate({ state: 'checking' }); oto.updateCheck().then(onUpdate); } },
    }, UPD.state === 'ready' ? 'Restart now' : 'Check now')),
    row('Update automatically', 'Downloads new versions in the background and installs them the next time Oto starts.', sw(st.autoUpdate !== false, (on) => setPref('autoUpdate', on))));
}

// ================================================================ hooks used by renderer.js
function extrasBindView(tab, v) {
  const el = v.wv;
  el.addEventListener('dom-ready', () => {
    const m = glanceMode();
    if (m === 'off') return;
    try { el.executeJavaScript(`window.__otoGlanceMode = ${JSON.stringify(m)};${PAGE_HELPER}`).catch(() => {}); } catch {}
  });
  el.addEventListener('console-message', (e) => {
    const m = e.message || '';
    if (m.startsWith('__oto_glance__') && glanceMode() !== 'off') { diag('glance', `from click (${glanceMode()})`); openGlance(m.slice(14)); }
  });
  // Clicking into the other half of a split makes it the active tab.
  el.addEventListener('focus', () => {
    if (!document.body.classList.contains('split')) return;
    if (S.active[S.activeWs] !== tab.id && inSplit(tab.id)) activate(tab.id, { focus: false });
  });
  el.addEventListener('media-started-playing', () => { media = { tabId: tab.id, playing: true }; renderMedia(); });
  el.addEventListener('media-paused', () => { if (media && media.tabId === tab.id) { media.playing = false; renderMedia(); } });
}

function initExtras() {
  initSplitBar();
  const foot = document.querySelector('#sidebar .sb-foot');
  if (foot && !$('#mediaCard')) foot.before(h('div', { id: 'mediaCard', class: 'media-card', hidden: true }));
  oto.on('glance', (url) => { diag('glance', 'from right-click menu'); openGlance(url); });
  oto.on('update', onUpdate);
  oto.on('page-mouse', () => { diagMouseCount++; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && glance) { e.stopPropagation(); closeGlance(); } }, true);
  diag('start', { w: innerWidth, h: innerHeight, dpr: devicePixelRatio });
}
