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
  // Many sites send outside links through their own redirect page first (YouTube descriptions and comments use
  // youtube.com/redirect?q=…). Look inside those for the real address, so "other site" means where you'll end up.
  const REDIRECTS = [
    [/(^|\\.)youtube\\.com$/, /^\\/redirect$/, ['q']], [/(^|\\.)google\\.[a-z.]+$/, /^\\/url$/, ['q', 'url']],
    [/^l\\.facebook\\.com$|^lm\\.facebook\\.com$/, /^\\/l\\.php$/, ['u']], [/^l\\.instagram\\.com$/, /^\\/$/, ['u']],
    [/^out\\.reddit\\.com$/, /./, ['url']], [/(^|\\.)steamcommunity\\.com$/, /^\\/linkfilter\\/?$/, ['url', 'u']],
    [/^away\\.vk\\.com$|(^|\\.)vk\\.com$/, /^\\/away\\.php$/, ['to']], [/^href\\.li$/, /./, []], [/^(www\\.)?linkedin\\.com$/, /^\\/redir\\/redirect$/, ['url']],
  ];
  // Only real web addresses come out (http/https, up to 8 KB); a redirect inside a redirect is followed up to 3 deep.
  const unwrapOnce = (u) => {
    for (const [host, path, keys] of REDIRECTS) {
      if (!host.test(u.hostname) || !path.test(u.pathname)) continue;
      let t = keys.length ? keys.map((k) => u.searchParams.get(k)).find(Boolean) : u.search.slice(1);
      if (t && !/^https?:/i.test(t) && /^https?%3a/i.test(t)) { try { t = decodeURIComponent(t); } catch (_) {} }
      if (t && t.length <= 8192 && /^https?:\\/\\//i.test(t)) { try { return new URL(t); } catch (_) {} }
    }
    return null;
  };
  const realUrl = (href) => {
    try {
      let u = new URL(href);
      for (let i = 0; i < 3; i++) { const next = unwrapOnce(u); if (!next) break; u = next; }
      return u.href;
    } catch (_) { return href; }
  };
  const otherSite = (a) => { try { return site(new URL(realUrl(a.href)).hostname) !== site(location.hostname); } catch (_) { return false; } };
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
    console.log('__oto_glance__' + realUrl(a.href)); // opens the real site, skipping the redirect page
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
  // Same cookie jar as the tab it was opened from: private windows stay private, a Space's own logins stay in that Space.
  wvEl.setAttribute('partition', typeof v1PartitionFor === 'function' ? v1PartitionFor(activeTab()) : 'persist:oto');
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
    case 'verifying': return `Checking Oto ${u.version || ''} is genuine (GitHub build record)…`;
    case 'ready': return `Oto ${u.version} is ready${u.verified ? ' and checked' : ''} — restart to finish updating`;
    case 'latest': return 'Oto is up to date';
    case 'none-published': return 'No updates published yet';
    case 'error': return u.message && /^Update /.test(u.message) ? u.message : `Couldn’t check for updates${u.message ? ` (${u.message})` : ''}`;
    case 'dev': return 'Updates are off when running from source';
    default: return 'Oto checks for updates automatically';
  }
}
function onUpdate(u) {
  UPD = u || UPD;
  if (UPD.state === 'ready' && updToastShown !== UPD.version) {
    updToastShown = UPD.version;
    // the update card in the sidebar already says it — only toast when the card can't be seen (sidebar hidden or slim)
    const card = document.getElementById('v1Upd');
    if (!(card && card.offsetParent)) toast(`Oto ${UPD.version} is ready`, { icon: 'download', timeout: 12000, action: { label: 'Restart', run: () => { save(); oto.updateInstall(); } } });
  }
  const el = document.getElementById('updLine');
  if (el) el.textContent = updateText();
  const b = document.getElementById('updBtn');
  if (b) { b.textContent = UPD.state === 'ready' ? 'Restart now' : 'Check now'; b.disabled = ['checking', 'downloading', 'verifying'].includes(UPD.state); }
}
// Owner channel: tap "Oto version" 7 times to show the owner-key box.
let ownerTaps = 0, ownerTapT = 0, ownerKeyOpen = false;
function ownerTap() {
  const now = Date.now();
  ownerTaps = now - ownerTapT < 900 ? ownerTaps + 1 : 1;
  ownerTapT = now;
  if (ownerTaps >= 7 && !ownerKeyOpen) { ownerKeyOpen = true; renderSettings(); setTimeout(() => { const i = document.getElementById('ownerKey'); if (i) i.focus(); }, 30); }
}
async function ownerSubmit() {
  const i = document.getElementById('ownerKey');
  const ok = await oto.ownerUnlock(i ? i.value : '');
  if (ok !== true) { toast(ok && ok.wait ? `Too many wrong keys — try again in ${ok.wait > 90 ? `${Math.ceil(ok.wait / 60)} minutes` : `${ok.wait} seconds`}` : 'That key doesn’t match', { timeout: 2600 }); return; }
  if (typeof v1OwnerRefresh === 'function') v1OwnerRefresh();
  UPD.owner = true; ownerKeyOpen = false;
  setPref('updateChannel', 'owner');
  toast('Owner unlocked — you’re on the Owner channel 🔑', { timeout: 3000 });
  renderSettings();
}
function updatesSection() {
  const st = S.settings;
  oto.updateStatus().then(onUpdate).catch(() => {});
  return section('Updates',
    row(h('span', { onclick: ownerTap, style: 'cursor:default;user-select:none' }, 'Oto version'), h('span', { id: 'updLine' }, updateText()), h('button', {
      id: 'updBtn', class: 'btn',
      onclick: () => { if (UPD.state === 'ready') { save(); oto.updateInstall(); } else { onUpdate({ state: 'checking' }); oto.updateCheck().then(onUpdate); } },
    }, UPD.state === 'ready' ? 'Restart now' : 'Check now')),
    row('Update automatically', 'Downloads new versions in the background and installs them the next time Oto starts.', sw(st.autoUpdate !== false, (on) => setPref('autoUpdate', on))),
    row('Update channel', h('span', {}, (st.updateChannel || 'stable') === 'alpha' ? 'Alpha: the newest experiments as soon as they exist. Things can break — thanks for testing!' : (st.updateChannel || 'stable') === 'beta' ? 'Beta: new versions before everyone else. Mostly stable — tell Ryo what you find.' : 'Stable: tested versions. Join Beta or Alpha to try new things early and help test.'),
      seg([['stable', 'Stable'], ['beta', 'Beta'], ['alpha', 'Alpha'], ...(UPD.owner ? [['owner', 'Owner']] : [])], (st.updateChannel === 'owner' && !UPD.owner) ? 'stable' : (st.updateChannel || 'stable'), (v) => {
        if (v === 'alpha' && !confirm('Alpha versions are early experiments and can have bugs or lose settings. Join the Alpha channel?')) return;
        setPref('updateChannel', v);
        toast(v === 'stable' ? 'Back on Stable — you’ll move over at the next stable version' : v === 'owner' ? 'Owner channel on — you get Ryo’s v1 test builds 🔑' : `You’re a ${v === 'alpha' ? 'Alpha' : 'Beta'} tester now 🧪`, { timeout: 2600 });
      })),
    ownerKeyOpen && !UPD.owner ? row('Owner key', 'Enter your private owner key to unlock the Owner update channel.', h('div', { style: 'display:flex;gap:6px' },
      h('input', { id: 'ownerKey', class: 'lib-input', placeholder: 'OTO-XXXX-XXXX-XXXX-XXXX', spellcheck: 'false', style: 'width:230px;font-family:ui-monospace,Consolas,monospace', onkeydown: (e) => { if (e.key === 'Enter') ownerSubmit(); } }),
      h('button', { class: 'btn', onclick: ownerSubmit }, 'Unlock'))) : null,
    UPD.owner ? row('Owner', 'This PC is unlocked for the Owner channel.', h('div', { style: 'display:flex;gap:6px' }, typeof v1OwnerPanel === 'function' ? h('button', { class: 'btn primary', onclick: () => { closeSettings && closeSettings(); v1OwnerPanel(); } }, 'Owner panel') : null, h('button', { class: 'btn', onclick: () => { oto.ownerLock().then(() => { UPD.owner = false; if (typeof V1D !== 'undefined') V1D.founder = null; if (S.settings.updateChannel === 'owner') setPref('updateChannel', 'stable'); renderSettings(); }); } }, 'Lock'))) : null,
        row('Show what’s new after an update', h('a', { href: '#', onclick: (e) => { e.preventDefault(); closeSettings(); showWhatsNew({ all: true }); } }, 'See the release notes'), sw(st.showWhatsNew !== false, (on) => setPref('showWhatsNew', on))));
}

// Settings → About: what version everything is.
function versionsSection() {
  const grid = h('div', { class: 'ver-grid' }, h('p', { class: 'set-note' }, 'Loading…'));
  const ago = (t) => { if (!t) return 'not yet'; const s = (Date.now() - t) / 1000; return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; };
  let text = '';
  oto.versions().then((v) => {
    const u = v.update || {};
    const upd = u.state === 'ready' ? `${u.version} downloaded — restart to finish` : u.state === 'downloading' ? `downloading ${u.version || ''} · ${u.percent || 0}%` : u.state === 'checking' ? 'checking…' : u.state === 'latest' ? 'up to date' : u.state === 'dev' ? 'running from source' : u.state === 'error' ? 'couldn’t check' : '';
    const rows = [
      ['Oto', `${v.oto}`, `${(v.channel || 'stable').replace(/^./, (c) => c.toUpperCase())} channel${upd ? ` · ${upd}` : ''}${v.latest && v.latest !== v.oto && u.state !== 'ready' ? ` · newest is ${v.latest}` : ''}`],
      ['Chromium', v.chrome, 'the web engine — security fixes arrive with Oto updates'],
      ['Electron', v.electron, 'castlabs build with Widevine'],
      ['Widevine', v.widevine || '—', 'protected video (Netflix, Spotify, Disney+…)'],
      ['Node.js · V8', `${v.node} · ${v.v8}`, ''],
      ['Filter lists', ago(v.lists && v.lists.at), `${(v.lists && v.lists.level) || 'balanced'} level${v.lists && v.lists.mode === 'off' ? ' · blocking is off' : ''}`],
      ['Dangerous sites', ago(v.danger && v.danger.at), v.danger && v.danger.count ? `${v.danger.count.toLocaleString()} known sites` : 'list not downloaded yet'],
      ['Oto for Android', v.android || '—', 'newest app on the latest release'],
      ['System', v.os, ''],
    ];
    text = rows.map(([k, val, sub]) => `${k}: ${val}${sub ? ` (${sub})` : ''}`).join('\n');
    grid.replaceChildren(...rows.map(([k, val, sub]) => h('div', { class: 'vr' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, h('b', {}, val || '—'), sub ? h('small', {}, sub) : null))));
  }).catch(() => grid.replaceChildren(h('p', { class: 'set-note' }, 'Couldn’t read the versions.')));
  return section('Versions', grid, h('div', { class: 'ver-acts' },
    h('button', { class: 'btn', onclick: () => { if (text) { oto.copy(text); toast('Versions copied', { icon: 'check', timeout: 1600 }); } } }, 'Copy'),
    h('button', { class: 'btn', onclick: () => { onUpdate({ state: 'checking' }); oto.updateCheck().then((r) => { onUpdate(r); renderSettings(); }); } }, 'Check for updates')));
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

// ================================================================ What's new
// After Oto updates, a window shows what changed since the version you had (from CHANGELOG.md).
const verTuple = (v) => String(v || '').split(/[^\d]+/).filter(Boolean).map(Number);
const verCmp = (a, b) => { const x = verTuple(a), y = verTuple(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
function parseChangelog(md) {
  const out = [];
  let cur = null;
  for (const line of String(md || '').split(/\r?\n/)) {
    const hm = /^##\s+(\d[\d.]*(?:-[a-z]+\.\d+)?)\s*(?:—|-)?\s*(.*)$/i.exec(line);
    if (hm) { cur = { version: hm[1], date: hm[2].trim(), blocks: [] }; out.push(cur); continue; }
    if (!cur) continue;
    if (/^##\s/.test(line)) { cur = null; continue; }
    const gm = /^\*\*(.+?)\*\*\s*$/.exec(line.trim());
    if (gm) { cur.blocks.push({ title: gm[1], items: [] }); continue; }
    const im = /^\s*[-*]\s+(.*)$/.exec(line);
    if (im) { if (!cur.blocks.length) cur.blocks.push({ title: '', items: [] }); cur.blocks[cur.blocks.length - 1].items.push(im[1]); }
  }
  return out;
}
// tiny, safe Markdown for one line: escape first, then **bold**, *italic*, `code` and [links](url)
function mdInline(t) {
  let s = String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
  s = s.replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" data-ext>$1</a>');
  return s;
}
async function showWhatsNew({ since = null, all = false } = {}) {
  const md = await oto.changelog().catch(() => '');
  let list = parseChangelog(md).filter((x) => verCmp(x.version, INFO.version) <= 0);
  if (!all && since) list = list.filter((x) => verCmp(x.version, since) > 0);
  list = list.slice(0, all ? 8 : 6);
  if (!list.length) { if (all) toast('No release notes found', { timeout: 1600 }); return; }
  const close = () => { root.classList.add('leaving'); setTimeout(() => root.remove(), 180); };
  const tagCls = (t) => (/fix/i.test(t) ? 'fixed' : /secur/i.test(t) ? 'security' : /change/i.test(t) ? 'changed' : 'new');
  const root = h('div', { id: 'whatsnew', class: 'overlay' },
    h('div', { class: 'wn-card', role: 'dialog' },
      h('div', { class: 'wn-head' },
        h('span', { class: 'wn-logo', html: logoSvg() }),
        h('div', {}, h('h2', {}, all ? 'Release notes' : `What’s new in Oto ${INFO.version}`), h('small', {}, since && !all ? `Since ${since}` : 'Recent versions')),
        h('button', { class: 'icon-btn sm wn-x', title: 'Close', html: icon('x'), onclick: close })),
      h('div', { class: 'wn-body' }, ...list.map((rel, i) => h('section', { class: `wn-rel${i === 0 ? ' first' : ''}` },
        h('div', { class: 'wn-ver' }, h('b', {}, rel.version), rel.date ? h('span', {}, rel.date) : null),
        ...rel.blocks.map((b) => h('div', { class: 'wn-block' },
          b.title ? h('span', { class: `wn-tag ${tagCls(b.title)}` }, b.title) : null,
          h('ul', {}, ...b.items.map((it) => h('li', { html: mdInline(it) })))))))),
      h('div', { class: 'wn-foot' },
        h('button', { class: 'btn', onclick: () => { newTab('https://github.com/mukairyo/oto/blob/main/CHANGELOG.md'); close(); } }, 'All changes on GitHub'),
        h('button', { class: 'btn primary', onclick: close }, 'Got it'))));
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  root.addEventListener('click', (e) => { const a = e.target.closest('a[data-ext]'); if (a) { e.preventDefault(); newTab(a.getAttribute('href')); close(); } });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.body.append(root);
  setTimeout(() => root.querySelector('.btn.primary').focus(), 50);
}
// Called at startup: remember the version, and show what's new when it changed.
function checkWhatsNew() {
  const prev = S.lastSeenVersion;
  if (prev !== INFO.version && INFO.version) {
    S.lastSeenVersion = INFO.version;
    save();
    if (prev && S.onboarded && S.settings.showWhatsNew !== false && verCmp(INFO.version, prev) > 0) setTimeout(() => showWhatsNew({ since: prev }), 1200);
  }
}
