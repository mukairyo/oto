// Oto — main process
const {
  app, BrowserWindow, ipcMain, session, Menu, clipboard, shell, nativeTheme, net, screen, nativeImage, webContents, dialog, safeStorage, powerMonitor, desktopCapturer,
} = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
// Before anything registers a message handler: only Oto's own window may use Oto's channels (main/ipc-guard.js).
const IPC_GUARD = require('./main/ipc-guard.js')(ipcMain, __dirname);

const PARTITION = 'persist:oto';
const ICON = path.join(__dirname, 'build', 'icon.png');
const TOPBAR_H = 44;

app.setName('Oto');
if (process.platform === 'win32') app.setAppUserModelId('com.ryo.oto');

// Performance options that need a restart are read before Chromium starts.
try {
  const st = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'state.json'), 'utf8')).settings || {};
  if (st.hwAccel === false) app.disableHardwareAcceleration();
  if (st.smoothScroll === false) app.commandLine.appendSwitch('disable-smooth-scrolling');
} catch {}

// Present as plain Chrome so sites don't treat Oto as an "embedded" app.
app.userAgentFallback = app.userAgentFallback.replace(/\s(?:Electron|Oto)\/\S+/gi, '');

let win = null;
let launchUrl = urlFromArgv(process.argv);

// ---------------------------------------------------------------- storage
const userFile = (n) => path.join(app.getPath('userData'), n);
// Oto's own files: damaged files are kept (never silently replaced), writes are atomic and flushed (main/store.js).
const STORE = require('./main/store.js')((name) => userFile(name), () => { try { flushDataNotices(); } catch {} });
const { readJSON, writeJSON, damagedFile } = STORE;
// Text-file version of saveOrWarn (defined below), for files like your Oto Shield filter rules.
const saveTextOrWarn = (name, text, what) => saveOrWarn(name, null, what, () => STORE.writeText(name, text));

// URLs or local files (.html, .pdf…) passed on the command line, e.g. when Oto is the default browser.
function urlFromArgv(argv) {
  for (const a of argv.slice(1)) {
    if (/^https?:\/\//i.test(a)) return a;
    if (/\.(html?|xhtml|pdf|svg|txt)$/i.test(a) && !a.startsWith('-')) {
      try { if (fs.existsSync(a)) return pathToFileURL(path.resolve(a)).href; } catch {}
    }
  }
  return null;
}

// Settings the main process needs (kept in sync by the UI).
const dlItems = new Map(); // active downloads by id
let prefs = { downloadsAsk: false, gpc: true, clearOnExit: false, updateChannel: 'stable' };

function send(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

// Saving something that matters (your settings, site permissions, Shield choices, your account): if the disk write
// fails (disk full, no permission), the change still works until Oto closes, and you're told once — never silently.
// Damaged-file notices wait until the window can show them.
let noticesSent = new Set();
function flushDataNotices() {
  if (!win || win.isDestroyed() || win.webContents.isLoading()) return;
  for (const [name, d] of STORE.damagedList()) if (!noticesSent.has(name)) { noticesSent.add(name); send('data-damaged', { name, aside: d.aside, readOnly: d.readOnly }); }
}
const saveWarned = new Set();
function saveOrWarn(name, data, what, write = () => writeJSON(name, data)) {
  try { write(); saveWarned.delete(name); return true; } catch (e) {
    console.warn(`[oto] could not save ${name}:`, e && e.code ? e.code : e && e.message);
    if (!saveWarned.has(name)) { saveWarned.add(name); try { send('save-failed', { what: what || name, code: (e && e.code) || '' }); } catch {} }
    return false;
  }
}
// Same as saveOrWarn, for frequent background saves: the disk flush runs off the main thread (main/store.js).
function saveOrWarnAsync(name, data, what) {
  return STORE.writeJSONAsync(name, data).then(() => { saveWarned.delete(name); return true; }, (e) => saveOrWarn(name, data, what, () => { throw e; }));
}

// ---------------------------------------------------------------- keyboard
const DEFAULT_KEYS = {
  'Shift+Escape': 'health', 'Ctrl+Shift+ ': 'overview', 'Ctrl+Shift+N': 'avocado', 'Ctrl+Shift+X': 'screenshot', 'Ctrl+Shift+H': 'hub',
  'Ctrl+T': 'newTab', 'Ctrl+N': 'newTab', 'Ctrl+K': 'newTab',
  'Ctrl+L': 'focusUrl', 'Alt+D': 'focusUrl', 'F6': 'focusUrl',
  'Ctrl+W': 'closeTab', 'Ctrl+F4': 'closeTab', 'Ctrl+Shift+T': 'reopen',
  'Ctrl+Tab': 'nextTab', 'Ctrl+Shift+Tab': 'prevTab', 'Ctrl+PageDown': 'nextTab', 'Ctrl+PageUp': 'prevTab',
  'Ctrl+R': 'reload', 'F5': 'reload', 'Ctrl+Shift+R': 'hardReload', 'Ctrl+F5': 'hardReload',
  'Alt+ArrowLeft': 'back', 'Alt+ArrowRight': 'forward', 'BrowserBack': 'back', 'BrowserForward': 'forward',
  'Ctrl+B': 'toggleSidebar', 'Ctrl+D': 'togglePin', 'Ctrl+Shift+D': 'toggleEssential',
  'Ctrl+F': 'find', 'F3': 'findNext', 'Ctrl+Shift+C': 'copyUrl',
  'Ctrl+=': 'zoomIn', 'Ctrl+Shift+=': 'zoomIn', 'Ctrl+-': 'zoomOut', 'Ctrl+0': 'zoomReset',
  'F12': 'devtools', 'Ctrl+Shift+I': 'devtools', 'Ctrl+Shift+Alt+I': 'uiDevtools',
  'Ctrl+,': 'settings', 'F11': 'fullscreen', 'Ctrl+H': 'history', 'Ctrl+Shift+B': 'toggleTop',
  'Ctrl+Shift+S': 'splitView', 'Ctrl+Shift+P': 'pip', 'Ctrl+J': 'downloads', 'Ctrl+Shift+O': 'library',
};

function comboOf(input) {
  let k = input.key;
  if (/^Key[A-Z]$/.test(input.code)) k = input.code.slice(3);
  else if (/^(Digit|Numpad)\d$/.test(input.code)) k = input.code.slice(-1);
  else if (input.code === 'Equal' || input.code === 'NumpadAdd') k = '=';
  else if (input.code === 'Minus' || input.code === 'NumpadSubtract') k = '-';
  else if (input.code === 'Comma') k = ',';
  return (input.control ? 'Ctrl+' : '') + (input.shift ? 'Shift+' : '') + (input.alt ? 'Alt+' : '') + k;
}

// User overrides: { command: 'Ctrl+Shift+X' } ('' = unassigned) replace that command's defaults.
let KEYS = { ...DEFAULT_KEYS };
let keysPaused = false;
function buildKeymap(overrides = {}) {
  const map = {};
  for (const [combo, cmd] of Object.entries(DEFAULT_KEYS)) if (!(cmd in overrides)) map[combo] = cmd;
  for (const [cmd, combo] of Object.entries(overrides)) if (combo) map[combo] = cmd;
  KEYS = map;
}

let lastKey = { combo: '', t: 0 };
// v1: Avocado (private) windows. Messages caused by a page go to the window that page lives in.
const AVOCADO = 'avocado';
const avocadoWins = new Set();
const isAvocadoUi = (wc) => !!wc && [...avocadoWins].some((w) => !w.isDestroyed() && w.webContents === wc);
function hostOfWc(wc) { try { return wc ? (wc.hostWebContents || wc) : null; } catch { return null; } }
function sendVia(wc, ch, ...args) {
  const host = hostOfWc(wc);
  if (host && !host.isDestroyed() && isAvocadoUi(host)) { host.send(ch, ...args); return; }
  send(ch, ...args);
}
// A download that opened its own new tab leaves that tab white and empty; the window closes it (main/download-tab.js).
function blankTabCloser(wc, item) {
  const host = hostOfWc(wc);
  return require('./main/download-tab.js').closer(wc, item, (id) => sendVia(host, 'download-tab', id));
}
// Finds the window a webContents (or an IPC event) belongs to. Never throws: falls back to the main window.
function winOfWc(wc) {
  const host = hostOfWc(wc);
  if (!host || (host.isDestroyed && host.isDestroyed())) return win;
  try { return BrowserWindow.fromWebContents(host) || win; } catch { return win; }
}
const winOf = (e) => winOfWc(e && e.sender);
let restoringBackup = false;

// v1: holding Ctrl on its own shows the shortcut sheet (any other key or a click cancels it).
let ctrlDown = false;
function ctrlHold(input, wc) {
  if (input.key === 'Control') {
    if (input.type === 'keyDown' && !input.isAutoRepeat && !ctrlDown) { ctrlDown = true; sendVia(wc, 'ctrl-hold', 'down'); }
    else if (input.type === 'keyUp') { ctrlDown = false; sendVia(wc, 'ctrl-hold', 'up'); }
  } else if (ctrlDown && input.type === 'keyDown') { sendVia(wc, 'ctrl-hold', 'other'); }
}
// Key events don't say which page they came from, so each listener passes its webContents in.
function handleKeys(event, input, wc) {
  ctrlHold(input, wc);
  if (input.type !== 'keyDown' || keysPaused) return;
  const combo = comboOf(input);
  let cmd = KEYS[combo];
  let m;
  if (!cmd && (m = combo.match(/^Ctrl\+([1-9])$/))) cmd = `tab:${m[1]}`;
  if (!cmd && (m = combo.match(/^Ctrl\+Shift\+([1-9])$/))) cmd = `ws:${m[1]}`;
  if (!cmd) return;
  event.preventDefault();
  // Guard against the same keystroke arriving from both the UI and a page.
  const now = Date.now();
  if (combo === lastKey.combo && now - lastKey.t < 15) return;
  lastKey = { combo, t: now };
  const w = winOfWc(wc);
  if (cmd === 'fullscreen') { if (w) w.setFullScreen(!w.isFullScreen()); return; }
  // The UI's own DevTools could change anything in the UI, so release builds only allow them for the owner.
  if (cmd === 'uiDevtools') { if (w && (!app.isPackaged || UPDATES.ownerOn)) w.webContents.openDevTools({ mode: 'detach' }); return; }
  if (cmd === 'avocado') { createAvocadoWindow(); return; }
  sendVia(wc, 'cmd', cmd);
}

// ---------------------------------------------------------------- window
function visibleOnSomeDisplay(b) {
  if (b.x == null || b.y == null) return false;
  return screen.getAllDisplays().some(({ workArea: w }) =>
    b.x < w.x + w.width - 80 && b.x + b.width > w.x + 80 && b.y >= w.y - 10 && b.y < w.y + w.height - 60);
}

function createWindow() {
  const ws = readJSON('window.json', { width: 1320, height: 840 });
  if (!visibleOnSomeDisplay(ws)) { delete ws.x; delete ws.y; }
  // The Oto theme is always near-black, so the window opens near-black too (no light flash at start).
  const bg = '#0b0b0c';

  win = new BrowserWindow({
    x: ws.x, y: ws.y, width: ws.width || 1320, height: ws.height || 840,
    minWidth: 720, minHeight: 480,
    show: false,
    backgroundColor: bg,
    title: 'Oto',
    icon: ICON,
    // Oto draws its own minimise / maximise / close buttons, so the whole top can hide.
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.bundle.js'),
      // Sandboxed like web pages (since 1.3.3): the extension toolbar module is built into preload.bundle.js
      // (scripts/build-preload.js), so the preload needs nothing but require('electron').
      sandbox: true,
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  if (ws.maximized) win.maximize();
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());

  const saveBounds = () => {
    if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) Object.assign(ws, win.getBounds());
    ws.maximized = win.isMaximized();
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('close', () => { saveBounds(); try { writeJSON('window.json', ws); } catch {} });
  win.on('closed', () => { win = null; });
  win.on('app-command', (_e, c) => {
    if (c === 'browser-backward') send('cmd', 'back');
    if (c === 'browser-forward') send('cmd', 'forward');
  });
  const sendWinState = () => send('win-state', { maximized: win.isMaximized(), fullscreen: win.isFullScreen() });
  win.on('maximize', sendWinState);
  win.on('unmaximize', sendWinState);
  win.webContents.on('did-finish-load', sendWinState);
  win.webContents.on('did-finish-load', () => { noticesSent = new Set(); setTimeout(flushDataNotices, 1500); }); // damaged-file notices
  // Oto's own interface always stays at 100% (Interface size in Settings handles scaling) —
  // Ctrl+scroll over the sidebar used to zoom the whole UI and threw off the hover maths.
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1);
    win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  });
  win.webContents.on('zoom-changed', () => win.webContents.setZoomFactor(1));
  win.on('enter-full-screen', () => send('window-fullscreen', true));
  win.on('leave-full-screen', () => send('window-fullscreen', false));

  const ui = win.webContents;
  ui.on('will-navigate', (e) => e.preventDefault());
  ui.setWindowOpenHandler(() => ({ action: 'deny' }));
  ui.on('before-input-event', (e, input) => handleKeys(e, input, ui));
  ui.on('will-attach-webview', (e, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.nodeIntegrationInSubFrames = true; // see pagesInFrames below: page protection in every frame, no Node
    // v1: a space can have its own logins (its own cookie jar): persist:oto-ws-<space id>
    const sp = /^persist:oto-ws-[\w-]{1,40}$/.test(params.partition || '') ? params.partition : null;
    if (sp) prepSpaceSession(sp);
    // Electron 45 ignores changes to params.partition, so a page asking for any other cookie jar is refused outright.
    if (!sp && params.partition !== PARTITION) { console.warn('[oto] refused a page with session', params.partition); return e.preventDefault(); }
    if (params.src && !/^(https?|file|about|data|view-source|chrome-extension):/i.test(params.src)) e.preventDefault();
  });
}

// pagesInFrames: "nodeIntegrationInSubFrames" is Electron's name for "also run the session's page scripts in frames
// inside a page". It gives pages NO Node.js: every page and frame stays sandboxed, context-isolated and without Node
// (checked by the end-to-end tests). Without it Oto's page protection (fingerprint changes, the ad blocker's hiding
// rules, YouTube ad removal in embedded players) only ran in the top page, and a tracker inside a frame from another
// site, which is where trackers usually sit, read the real fingerprint.

// Every page (webview) gets keyboard shortcuts, tab-style popups and a context menu.
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.on('before-input-event', (e, input) => handleKeys(e, input, contents));
  // Calls (WebRTC): how much of this PC's network the page may find out follows the Shield level and the site
  SH.rtcApply(contents);
  // Fingerprint protection inside the page's background workers (see main/worker-guard.js)
  require('./main/worker-guard.js').guard(contents, (workerUrl, wc) => fpSeed(wc.getURL(), workerUrl));
  contents.on('did-start-navigation', (ev, url, _inPlace, isMain) => {
    const main = ev && typeof ev.isMainFrame === 'boolean' ? ev.isMainFrame : isMain, same = ev && ev.isSameDocument;
    if (main && !same) SH.rtcApply(contents, (ev && ev.url) || url);
  });
  // Tell the UI when the mouse is moving over a page (throttled): on Windows the UI doesn't get
  // a reliable "mouse left" when you move from the sidebar onto a page.
  let lastMouse = 0;
  contents.on('before-mouse-event', (_ev, m) => {
    if (m.type === 'mouseDown' && ctrlDown) sendVia(contents, 'ctrl-hold', 'other');
    if (m.type !== 'mouseMove') return;
    const now = Date.now();
    if (now - lastMouse < 120) return;
    lastMouse = now;
    sendVia(contents, 'page-mouse', now);
  });
  if (EXT.extensions && win) { try { EXT.extensions.addTab(contents, win); } catch {} }
  // Websites can't send you to local files or browser-internal pages (only you can, by typing them):
  // a page that isn't itself a local file can't navigate itself or a frame to file:, view-source:, chrome: …
  const localOnly = /^(file|view-source|chrome|devtools|chrome-extension):/i;
  const sameOrigin = (a, b) => { try { const x = new URL(a), y = new URL(b); return x.protocol === y.protocol && x.host === y.host; } catch { return false; } };
  const mayOpen = (url) => !localOnly.test(String(url)) || /^file:/i.test(contents.getURL()) || (/^chrome-extension:/i.test(url) && sameOrigin(url, contents.getURL()));
  const blockLocal = (e, url) => { try { if (!mayOpen(url)) e.preventDefault(); } catch {} };
  contents.on('will-navigate', (e, url) => blockLocal(e, url));
  contents.on('will-frame-navigate', (e) => blockLocal(e, e && e.url));
  contents.setWindowOpenHandler(({ url, disposition }) => {
    if (!mayOpen(url)) return { action: 'deny' };
    if (disposition === 'new-window') {
      // Real popups (sign-in windows, etc.) keep window.opener working.
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 560, height: 720, autoHideMenuBar: true, icon: ICON, backgroundColor: '#ffffff' },
      };
    }
    sendVia(contents, 'tab:open', { url, background: disposition === 'background-tab' });
    return { action: 'deny' };
  });
  contents.on('context-menu', (_ev, params) => showContextMenu(contents, params));
});

// ---------------------------------------------------------------- separate logins per space
const spaceSessions = new Set();
// Every cookie jar your browsing uses: the main one plus each Space that has its own logins (opened this run or not).
function browsingPartitions() {
  const set = new Set([PARTITION, ...spaceSessions]);
  try { for (const w of (readJSON('state.json', {}).workspaces || [])) if (w && w.v1Own) set.add(`persist:oto-ws-${String(w.id).replace(/[^\w-]/g, '').slice(0, 40)}`); } catch {}
  return [...set];
}
// Runs fn in every browsing session; resolves to the list of sessions where it failed (empty = all worked).
const eachBrowsingSession = async (fn) => {
  const parts = browsingPartitions();
  const res = await Promise.all(parts.map((p) => Promise.resolve().then(() => fn(session.fromPartition(p))).then(() => null, (e) => { console.warn('[oto] clearing failed in', p, e && e.message); return p; })));
  return res.filter(Boolean);
};
// "Clear when Oto closes": what to clear, and a marker so a crash or forced close is cleaned up at the next start.
const exitClearSites = () => Object.keys(perms).filter((k) => k.endsWith('|cookies') && perms[k] === 'session').map((k) => k.split('|')[0]).filter((o) => o !== '*');
const exitClearWanted = () => !!(prefs.clearOnExit || exitClearSites().length);
const runExitClear = () => { const sites = exitClearSites(); return eachBrowsingSession((ses) => (prefs.clearOnExit ? Promise.all([ses.clearStorageData(), ses.clearCache()]) : Promise.all(sites.map((origin) => ses.clearStorageData({ origin }))))); };
function prepSpaceSession(part) {
  if (spaceSessions.has(part)) return;
  spaceSessions.add(part);
  try { setupSession(part); } catch {}
  // Same Shield state as everywhere else (with Shield off, dangerous-site warnings still run here)
  if (SH.mode() !== 'off') enableBlocking(session.fromPartition(part)).catch(() => {}); else disableBlocking(session.fromPartition(part));
}
// Every session Oto browses in right now: main, Spaces with their own logins, and Avocado (private) if open.
const liveSessions = () => [session.fromPartition(PARTITION), ...[...spaceSessions].map((p) => session.fromPartition(p)), ...(avocadoReady ? [session.fromPartition(AVOCADO)] : [])];

// ---------------------------------------------------------------- Avocado (private windows)
// Oto's private mode: its own window whose pages use an in-memory session. Closing the last
// Avocado window wipes that session (cookies, storage, cache). Its state is never saved.
let avocadoReady = false;
function setupAvocadoSession() {
  if (avocadoReady) return;
  avocadoReady = true;
  const s = session.fromPartition(AVOCADO);
  addPagePreload(s);
  s.setPermissionRequestHandler((_wc, p, cb) => cb(ALWAYS.has(p)));
  s.setPermissionCheckHandler((_wc, p) => ALWAYS.has(p));
  if (SH.mode() !== 'off') enableBlocking(s).catch(() => {}); else disableBlocking(s);
  // Downloads from private windows get the same safety: stopped if they come from a dangerous site, and tagged by
  // Windows as "from the internet" when done (Electron asks where to save them).
  s.on('will-download', (_e, item, wc) => {
    const closeBlank = blankTabCloser(wc, item);
    try { if ((item.getURLChain ? item.getURLChain() : [item.getURL()]).some((u) => { try { return SH.dangerOf(new URL(u).hostname); } catch { return false; } })) { item.cancel(); closeBlank(true); return; } } catch {}
    item.on('updated', () => closeBlank());
    item.once('done', (_ev, st) => { closeBlank(true); const f = item.getSavePath(); if (st === 'completed' && f) { rememberFile(f); markFromInternet(f, item.getURL(), item.getReferrer ? item.getReferrer() : ''); } });
  });
}
function createAvocadoWindow() {
  setupAvocadoSession();
  const w = new BrowserWindow({
    width: 1240, height: 800, minWidth: 720, minHeight: 480, show: false, backgroundColor: '#0e110b', title: 'Oto — Avocado', icon: ICON,
    titleBarStyle: 'hidden',
    webPreferences: { preload: path.join(__dirname, 'preload.bundle.js'), sandbox: true, webviewTag: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  avocadoWins.add(w);
  w.removeMenu();
  w.loadFile(path.join(__dirname, 'src', 'index.html'), { query: { avocado: '1' } });
  w.once('ready-to-show', () => w.show());
  const ui = w.webContents;
  ui.on('will-navigate', (e) => e.preventDefault());
  ui.setWindowOpenHandler(() => ({ action: 'deny' }));
  ui.on('before-input-event', (e, input) => handleKeys(e, input, ui));
  ui.on('will-attach-webview', (e, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false; webPreferences.contextIsolation = true; webPreferences.sandbox = true;
    webPreferences.nodeIntegrationInSubFrames = true; // page protection in every frame (see the normal window above), no Node
    // Private window: only the in-memory 'avocado' session. Electron 45 ignores changes to params.partition, so a page
    // asking for anything else (like the saved 'persist:oto' jar) is refused, never loaded where it could leave traces.
    if (params.partition !== AVOCADO) { console.warn('[oto] refused a non-private page in a private window:', params.partition); return e.preventDefault(); }
    if (params.src && !/^(https?|file|about|data|view-source):/i.test(params.src)) e.preventDefault();
  });
  w.on('closed', () => {
    avocadoWins.delete(w);
    if (!avocadoWins.size) { const s = session.fromPartition(AVOCADO); s.clearStorageData().catch(() => {}); s.clearCache().catch(() => {}); }
  });
  return w;
}

// ---------------------------------------------------------------- Oto Apps (a site in its own window)
const appWins = new Map(); // url origin -> window
function pngToIco(png) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  head.writeUInt8(0, 6); head.writeUInt8(0, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9);
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
}
function appIconImage(origin) {
  try { const f = userFile(path.join('apps', `${new URL(origin).hostname}.png`)); if (fs.existsSync(f)) return nativeImage.createFromPath(f); } catch {}
  return null;
}
// Sign-in providers an Oto-app window may visit without leaving the window (https only). Anything else that
// isn't the app's own site (same registrable domain) opens in a normal Oto tab.
const SIGN_IN_HOSTS = [
  'accounts.google.com', 'accounts.youtube.com', 'login.microsoftonline.com', 'login.live.com', 'login.microsoft.com', 'account.live.com',
  'appleid.apple.com', 'idmsa.apple.com', 'github.com', 'gitlab.com', 'discord.com', 'www.facebook.com', 'm.facebook.com', 'id.atlassian.com',
  'auth.openai.com', 'accounts.spotify.com', 'login.yahoo.com', 'api.twitter.com', 'x.com', 'twitter.com', 'www.linkedin.com', 'slack.com',
  'auth.services.adobe.com', 'id.twitch.tv', 'www.amazon.com', 'login.salesforce.com',
];
const SIGN_IN_SUFFIXES = ['.auth0.com', '.okta.com', '.onelogin.com', '.b2clogin.com', '.slack.com', '.zoom.us', '.my.salesforce.com'];
function appMayNavigate(appUrl, to) {
  if (to.protocol !== 'https:' && to.origin !== appUrl.origin) return false;
  if (SH.regDomain(to.hostname) === SH.regDomain(appUrl.hostname)) return true;
  return SIGN_IN_HOSTS.includes(to.hostname) || SIGN_IN_SUFFIXES.some((x) => to.hostname.endsWith(x));
}
function openAppWindow(url) {
  let u; try { u = new URL(url); } catch { return; }
  if (!/^https?:$/.test(u.protocol)) return;
  const old = appWins.get(u.origin);
  if (old && !old.isDestroyed()) { if (old.isMinimized()) old.restore(); old.focus(); return; }
  const img = appIconImage(u.origin);
  const w = new BrowserWindow({
    width: 1100, height: 760, minWidth: 420, minHeight: 320, title: u.hostname, icon: img && !img.isEmpty() ? img : ICON, autoHideMenuBar: true, backgroundColor: '#ffffff',
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  w.removeMenu();
  if (process.platform === 'win32') { try { w.setAppDetails({ appId: `com.ryo.oto.app.${u.hostname}`, relaunchCommand: `"${process.execPath}" --oto-app=${u.origin}/`, relaunchDisplayName: u.hostname }); } catch {} }
  appWins.set(u.origin, w);
  w.on('closed', () => appWins.delete(u.origin));
  const wc = w.webContents;
  const toOto = (link) => { send('tab:open', { url: link, background: false }); if (win) { if (win.isMinimized()) win.restore(); win.focus(); } };
  wc.setWindowOpenHandler(({ url: link }) => { try { if (new URL(link).origin === u.origin) return { action: 'allow' }; } catch {} toOto(link); return { action: 'deny' }; });
  // Stay in the app window for the app's own site and for real sign-in pages; everything else opens in Oto.
  wc.on('will-navigate', (e, link) => { try { const o = new URL(link); if (o.origin !== u.origin && !appMayNavigate(u, o)) { e.preventDefault(); toOto(link); } } catch { e.preventDefault(); } });
  wc.on('page-title-updated', (_e, t) => w.setTitle(t));
  w.loadURL(url);
}
const appArg = (argv) => { const a = (argv || []).find((x) => /^--oto-app=/.test(x)); return a ? a.slice(10) : null; };

// ---------------------------------------------------------------- version numbers
// Version names (1.4.200 is shown as 1.4.2, 1.4.201 as 1.4.2.1): main/version.js
const displayVersion = require('./main/version.js').display;
const OTO_VERSION = (() => { try { return require('./package.json').otoVersion || displayVersion(app.getVersion()); } catch { return displayVersion(app.getVersion()); } })();

// ---------------------------------------------------------------- auto-update (main/updates.js)
// Things the main/*.js parts share with main.js (live values through getters).
const CTX = {
  readJSON, writeJSON, saveOrWarn, saveTextOrWarn, damagedFile, userFile, send, sendVia: (...a) => sendVia(...a), OTO_VERSION, displayVersion,
  get win() { return win; }, get prefs() { return prefs; }, get account() { return ACCOUNT; },
};
const UPDATES = require('./main/updates.js')(CTX);
const { setupUpdates, ownerLoad, checkForUpdates, updateChannel } = UPDATES;

function canNav(wc, dir) {
  try {
    const h = wc.navigationHistory;
    return dir < 0 ? h.canGoBack() : h.canGoForward();
  } catch { return false; }
}

// v1: the page right-click menu is drawn by Oto's UI (see v1.js); main just runs the chosen action.
let lastCtx = null;
function showContextMenu(wc, p) {
  if (prefs.v1Menu !== false && win && !win.isDestroyed()) {
    let hasExt = false;
    try { hasExt = !!(EXT.extensions && EXT.extensions.getContextMenuItems(wc, p).length); } catch {}
    lastCtx = { wc, p };
    sendVia(wc, 'ctx:show', {
      wcId: wc.id, x: p.x, y: p.y, linkURL: p.linkURL || '', linkText: p.linkText || '', srcURL: p.srcURL || '',
      mediaType: p.mediaType, isEditable: !!p.isEditable, editFlags: p.editFlags || {}, selectionText: p.selectionText || '',
      canBack: canNav(wc, -1), canFwd: canNav(wc, 1), pageURL: wc.getURL(), hasExt,
    });
    return;
  }
  showNativeContextMenu(wc, p);
}
function ctxAction(act, arg) {
  if (!lastCtx) return;
  const { wc, p } = lastCtx;
  if (!wc || wc.isDestroyed()) return;
  const open = (url, background) => send('tab:open', { url, background });
  switch (act) {
    case 'back': return wc.navigationHistory.goBack();
    case 'forward': return wc.navigationHistory.goForward();
    case 'reload': return wc.reload();
    case 'openTab': return open(p.linkURL, false);
    case 'openBg': return open(p.linkURL, true);
    case 'copyLink': return clipboard.writeText(p.linkURL);
    case 'copyText': return clipboard.writeText(String(arg || ''));
    case 'copy': return wc.copy();
    case 'cut': return wc.cut();
    case 'paste': return wc.paste();
    case 'undo': return wc.undo();
    case 'redo': return wc.redo();
    case 'selectAll': return wc.selectAll();
    case 'openImage': return open(p.srcURL, false);
    case 'saveImage': return wc.downloadURL(p.srcURL);
    case 'copyImage': return wc.copyImageAt(p.x, p.y);
    case 'copyImageAddr': return clipboard.writeText(p.srcURL);
    case 'copyPage': return clipboard.writeText(wc.getURL());
    case 'source': return open(`view-source:${wc.getURL()}`, false);
    case 'inspect': return wc.inspectElement(p.x, p.y);
    case 'native': return showNativeContextMenu(wc, p);
    default:
  }
}
function showNativeContextMenu(wc, p) {
  const t = [];
  const open = (url, background) => send('tab:open', { url, background });
  const sep = { type: 'separator' };
  if (p.linkURL) {
    t.push(
      { label: 'Open link in new tab', click: () => open(p.linkURL, false) },
      { label: 'Open link in background tab', click: () => open(p.linkURL, true) },
      { label: 'Open link in Glance', click: () => send('glance', p.linkURL) },
      { label: 'Copy link address', click: () => clipboard.writeText(p.linkURL) },
      sep,
    );
  }
  if (p.mediaType === 'image' && p.srcURL) {
    t.push(
      { label: 'Open image in new tab', click: () => open(p.srcURL, false) },
      { label: 'Save image', click: () => wc.downloadURL(p.srcURL) },
      { label: 'Copy image', click: () => wc.copyImageAt(p.x, p.y) },
      { label: 'Copy image address', click: () => clipboard.writeText(p.srcURL) },
      sep,
    );
  }
  if (p.isEditable) {
    const f = p.editFlags;
    t.push(
      { label: 'Undo', enabled: f.canUndo, click: () => wc.undo() },
      { label: 'Redo', enabled: f.canRedo, click: () => wc.redo() },
      sep,
      { label: 'Cut', enabled: f.canCut, click: () => wc.cut() },
      { label: 'Copy', enabled: f.canCopy, click: () => wc.copy() },
      { label: 'Paste', enabled: f.canPaste, click: () => wc.paste() },
      { label: 'Select all', click: () => wc.selectAll() },
      sep,
    );
  } else if (p.selectionText && p.selectionText.trim()) {
    const s = p.selectionText.trim().replace(/\s+/g, ' ');
    const short = s.length > 28 ? `${s.slice(0, 28)}…` : s;
    t.push(
      { label: 'Copy', click: () => wc.copy() },
      { label: `Search for “${short}”`, click: () => send('search', s) },
      sep,
    );
  }
  if (!p.linkURL && !p.isEditable && !(p.selectionText || '').trim() && p.mediaType === 'none') {
    t.push(
      { label: 'Back', enabled: canNav(wc, -1), click: () => wc.navigationHistory.goBack() },
      { label: 'Forward', enabled: canNav(wc, 1), click: () => wc.navigationHistory.goForward() },
      { label: 'Reload', click: () => wc.reload() },
      sep,
      { label: 'Copy page address', click: () => clipboard.writeText(wc.getURL()) },
      { label: 'View page source', click: () => open(`view-source:${wc.getURL()}`, false) },
      sep,
    );
  }
  if (EXT.extensions) {
    try {
      const extItems = EXT.extensions.getContextMenuItems(wc, p);
      if (extItems.length) t.push(...extItems, sep);
    } catch {}
  }
  t.push({ label: 'Inspect', click: () => wc.inspectElement(p.x, p.y) });
  Menu.buildFromTemplate(t).popup({ window: win });
}

// ---------------------------------------------------------------- Oto Shield (main/shield.js)
const SH = require('./main/shield.js')(CTX);
const { enableBlocking, disableBlocking, shieldHost, shieldAllowed, shieldLevel, shieldListsAt, regDomain, dangerUpdate, SHIELD, DANGER, FP_SESSION } = SH;
// Fingerprint protection: a number that's the same for one site (the page you are on) during one session and
// different everywhere else; 0 means "real values". Pages and frames ask through oto:page, workers through
// main/worker-guard.js, so a page, its frames and its workers always get the same answers.
function fpSeed(topUrl, frameUrl) {
  try {
    const top = shieldHost(topUrl);
    // ...except inside the "are you human?" boxes themselves (Cloudflare, hCaptcha, reCAPTCHA): changed readings there
    // look like a bot and the box never lets you through.
    const fh = (() => { try { const u = new URL(String(frameUrl)); return u.protocol === 'blob:' ? new URL(u.pathname).hostname : u.hostname; } catch { return ''; } })(); // a worker made from a blob: belongs to the site that made it
    const humanCheck = /(^|\.)(challenges\.cloudflare\.com|hcaptcha\.com|recaptcha\.net|arkoselabs\.com|funcaptcha\.com)$/.test(fh)
      || (/(^|\.)google\.com$/.test(fh) && fh !== top);
    if (top && !humanCheck && SH.features().fp && SH.mode() !== 'off' && !shieldAllowed(top)) {
      return require('crypto').createHash('sha256').update(`${FP_SESSION}|${regDomain(top)}`).digest().readUInt32LE(0) || 1;
    }
  } catch {}
  return 0;
}

// ---------------------------------------------------------------- permissions
// mediaKeySystem = protected content (Widevine) for Spotify, Netflix, Disney+ … — Chrome allows it by default too.
const ALWAYS = new Set(['fullscreen', 'clipboard-sanitized-write', 'window-management', 'mediaKeySystem']);
let perms = {};
let permSeq = 0;
const pendingPerms = new Map();
const screenPicks = new Map();

// Files Oto may open or show for you: ones it downloaded or saved itself, or anything in your Downloads
// and Oto Screenshots folders. A path coming from the UI is never opened just because it was asked for.
const KNOWN_FILES = new Set(readJSON('known-files.json', []));
let knownTimer = null;
function rememberFile(p) {
  if (!p) return;
  KNOWN_FILES.delete(path.resolve(p)); KNOWN_FILES.add(path.resolve(p));
  while (KNOWN_FILES.size > 1000) KNOWN_FILES.delete(KNOWN_FILES.values().next().value);
  clearTimeout(knownTimer); knownTimer = setTimeout(() => saveOrWarn('known-files.json', [...KNOWN_FILES], 'the list of files you downloaded'), 1000);
}
function fileAllowed(p) {
  if (typeof p !== 'string' || !p) return false;
  let real;
  try { real = fs.realpathSync(path.resolve(p)); } catch { return false; }
  if (KNOWN_FILES.has(path.resolve(p)) || KNOWN_FILES.has(real)) return true;
  const inside = (dir) => { try { const rel = path.relative(fs.realpathSync(dir), real); return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel); } catch { return false; } };
  return inside(app.getPath('downloads')) || inside(path.join(app.getPath('pictures'), 'Oto Screenshots'));
}

function originOf(u) { try { return new URL(u).origin; } catch { return String(u || ''); } }
// Saved choice for a site, else the default for all sites ("*|permission"), else undefined (= ask).
// Camera and microphone are separate ("camera" / "microphone"); older saves used one "media" key for both.
function permDecide(origin, perm) {
  const k = `${origin}|${perm}`;
  if (k in perms) return perms[k];
  if ((perm === 'camera' || perm === 'microphone') && `${origin}|media` in perms) return perms[`${origin}|media`];
  if (`*|${perm}` in perms) return perms[`*|${perm}`];
  return undefined;
}
const mediaParts = (types) => (types && types.length ? [...new Set(types.map((t) => (t === 'video' ? 'camera' : 'microphone')))] : ['media']);
// Cookies per site: false = blocked (removed as soon as they're set), 'session' = cleared when Oto closes.
let cookieBlockHosts = [];
const bareHost = (h) => String(h || '').replace(/^\./, '').replace(/^www\./, '').toLowerCase();
function savePerms() {
  saveOrWarn('permissions.json', perms, 'site permissions');
  cookieBlockHosts = Object.keys(perms).filter((k) => k.endsWith('|cookies') && perms[k] === false).map((k) => { try { return bareHost(new URL(k.split('|')[0]).hostname); } catch { return ''; } }).filter(Boolean);
}
const cookieBlocked = (domain) => { const d = bareHost(domain); return !!d && cookieBlockHosts.some((h) => d === h || d.endsWith(`.${h}`) || h.endsWith(`.${d}`)); };
const autoplayBlocked = (origin) => permDecide(origin, 'autoplay') === false;

// Page preload (page-preload.js): fixes Google sign-in ("This browser or app may not be secure").
function addPagePreload(ses) {
  const file = path.join(__dirname, 'page-preload.js');
  try {
    if (ses.registerPreloadScript) {
      const have = (id) => (ses.getPreloadScripts ? ses.getPreloadScripts() : []).some((p) => p.id === id);
      if (!have('oto-page')) ses.registerPreloadScript({ type: 'frame', id: 'oto-page', filePath: file });
      // Service workers: the same fingerprint protection as the site's pages (page-preload.js asks oto:worker)
      if (!have('oto-sw') && ses.serviceWorkers) {
        ses.registerPreloadScript({ type: 'service-worker', id: 'oto-sw', filePath: file });
        ses.serviceWorkers.on('running-status-changed', ({ versionId, runningStatus }) => {
          if (runningStatus !== 'starting') return;
          try {
            const sw = ses.serviceWorkers.getWorkerFromVersionID(versionId);
            if (sw && !sw.ipc.listenerCount('oto:worker')) sw.ipc.on('oto:worker', (e) => { e.returnValue = fpSeed(sw.scope, sw.scope); });
          } catch {}
        });
      }
    } else if (!ses.getPreloads().includes(file)) ses.setPreloads([...ses.getPreloads(), file]);
  } catch (e) { console.warn('[oto] page preload:', e && e.message); }
}
function setupSession(part = PARTITION) {
  const ses = session.fromPartition(part);
  addPagePreload(ses);
  if (part === PARTITION) { perms = readJSON('permissions.json', {}); savePerms(); }

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (ALWAYS.has(permission)) return callback(true);
    const origin = originOf(details.requestingUrl || (wc && wc.getURL()));
    if (permission === 'display-capture') return callback(permDecide(origin, 'display-capture') !== false); // Oto's screen picker asks next
    const parts = permission === 'media' ? mediaParts(details.mediaTypes) : [permission];
    const vals = parts.map((p) => permDecide(origin, p));
    if (vals.some((v) => v === false)) return callback(false);
    if (vals.every((v) => v === true)) return callback(true);
    if (!win) return callback(false);
    const keys = parts.map((p) => `${origin}|${p}`);
    const id = ++permSeq;
    // The page that asked can go away while the question is open (tab closed, page crashed). The question is then
    // dropped and never answered: there is nothing left to answer, and answering a mouse-lock or keyboard-lock
    // request for a page that is gone crashed all of Oto (an Electron bug, fixed upstream in 45.3).
    const gone = () => { try { return !!wc && wc.isDestroyed(); } catch { return true; } };
    const drop = () => { const p = pendingPerms.get(id); if (!p) return; pendingPerms.delete(id); clearTimeout(p.timer); send('perm:cancel', id); };
    const off = () => { try { if (wc && !wc.isDestroyed()) wc.removeListener('destroyed', drop); } catch {} };
    const timer = setTimeout(() => {
      if (gone()) return drop();
      if (pendingPerms.delete(id)) { off(); callback(false); send('perm:cancel', id); }
    }, 90000);
    pendingPerms.set(id, { callback, keys, timer, gone, off });
    try { if (wc) wc.once('destroyed', drop); } catch {}
    send('perm:ask', {
      id, origin, permission, mediaTypes: details.mediaTypes || [],
      externalURL: details.externalURL || '', wcId: wc ? wc.id : 0,
    });
  });
  ses.setPermissionCheckHandler((_wc, permission, origin, details) => {
    if (ALWAYS.has(permission)) return true;
    const o = originOf(origin);
    if (permission === 'display-capture') return permDecide(o, 'display-capture') !== false;
    if (permission === 'media') return mediaParts(details && details.mediaType ? [details.mediaType] : []).every((p) => permDecide(o, p) === true);
    return permDecide(o, permission) === true;
  });
  // Screen sharing (Meet, Discord, Zoom, Teams…): Oto shows its own picker of screens and windows.
  if (ses.setDisplayMediaRequestHandler) {
    // callback(null) refuses (Electron 45 throws on callback({}), which left the picker open and the page waiting).
    ses.setDisplayMediaRequestHandler(async (request, callback) => {
      const origin = originOf(request.securityOrigin || (request.frame && request.frame.url) || '');
      if (!win || permDecide(origin, 'display-capture') === false) return callback(null);
      let sources = [];
      const get = (types) => desktopCapturer.getSources({ types, thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: types[0] === 'window' }).catch(() => []);
      // screens and windows separately: if listing windows fails or times out, screens still show
      sources = (await Promise.all([get(['screen']), get(['window'])])).flat();
      sources = sources.filter((s) => !/^Oto( |$)/.test(s.name) || s.id.startsWith('screen'));
      if (!sources.length) return callback(null);
      const id = ++permSeq;
      // The choice is tied to the page that asked: if it navigates away, closes or the 2 minutes run out, the picker
      // closes and nothing is shared. Every request gets a fresh choice (nothing is remembered).
      const frame = request.frame || null;
      let reqWc = null; try { reqWc = frame ? webContents.fromFrame(frame) : null; } catch {}
      const cancel = () => { const p = screenPicks.get(id); if (!p) return; screenPicks.delete(id); clearTimeout(p.timer); p.cleanup(); callback(null); send('screen:cancel', id); };
      const onNav = (ev, _url, inPlace, isMain) => { const main = ev && typeof ev.isMainFrame === 'boolean' ? ev.isMainFrame : isMain; const same = ev && typeof ev.isSameDocument === 'boolean' ? ev.isSameDocument : inPlace; if (main && !same) cancel(); };
      if (reqWc) { reqWc.on('did-start-navigation', onNav); reqWc.once('destroyed', cancel); }
      const cleanup = () => { if (reqWc && !reqWc.isDestroyed()) { reqWc.removeListener('did-start-navigation', onNav); reqWc.removeListener('destroyed', cancel); } };
      const stillThere = () => { try { return !frame || (!frame.detached && originOf(frame.url) === origin); } catch { return false; } };
      const timer = setTimeout(cancel, 120000);
      screenPicks.set(id, { callback, sources, timer, cleanup, stillThere });
      send('screen:pick', { id, origin, audio: process.platform === 'win32' && !!request.audioRequested,
        sources: sources.map((s) => ({ id: s.id, name: s.name, kind: s.id.startsWith('screen') ? 'screen' : 'window', thumb: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : '', icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : '' })) });
    });
  }
  { // "Block cookies" for a site works in every Space's cookie jar, not just the main one
    ses.cookies.on('changed', (_e, c, _cause, removed) => {
      if (removed || !cookieBlockHosts.length || !cookieBlocked(c.domain)) return;
      const d = String(c.domain || '').replace(/^\./, '');
      ses.cookies.remove(`http${c.secure ? 's' : ''}://${d}${c.path || '/'}`, c.name).catch(() => {});
    });
  }

  // Downloads go straight to the Downloads folder, Chrome-style.
  let dlSeq = 0;
  ses.on('will-download', (_e, item, wc) => {
    const id = ++dlSeq;
    const closeBlank = blankTabCloser(wc, item);
    const name = item.getFilename() || 'download';
    const url = item.getURL();
    dlItems.set(id, item);
    // A download that came from (or was redirected through) a known malware/phishing site is stopped.
    try {
      const chain = item.getURLChain ? item.getURLChain() : [url];
      const bad = chain.map((u) => { try { return SH.dangerOf(new URL(u).hostname); } catch { return ''; } }).find(Boolean);
      if (bad) { item.cancel(); closeBlank(true); send('download', { id, name, url, path: '', total: 0, received: 0, startedAt: Date.now(), state: 'cancelled', reason: 'danger', kind: bad }); return; }
    } catch {}
    const base = () => ({ id, name: item.getSavePath() ? path.basename(item.getSavePath()) : name, url, path: item.getSavePath() || '', total: item.getTotalBytes(), received: item.getReceivedBytes(), startedAt: Math.round(item.getStartTime() * 1000) || Date.now() });
    if (!prefs.downloadsAsk) {
      // Checked name, always inside Downloads, never overwriting an existing file (main/download-name.js)
      try { item.setSavePath(require('./main/download-name.js').downloadPath(app.getPath('downloads'), name)); } catch { item.cancel(); return; }
    }
    // With "ask where to save", Electron shows the Save dialog itself; we report once a path is chosen.
    let announced = false;
    let last = 0;
    // Where the mouse was when the download began — the UI's download animation starts there.
    let cursor = null;
    try { const p = screen.getCursorScreenPoint(); const b = win.getContentBounds(); const z = win.webContents.getZoomFactor() || 1; cursor = { x: (p.x - b.x) / z, y: (p.y - b.y) / z }; } catch {}
    const announce = () => { if (!announced && item.getSavePath()) { announced = true; send('download', { ...base(), state: 'started', cursor }); closeBlank(); } };
    setImmediate(announce);
    item.on('updated', (_ev, st) => {
      announce();
      const now = Date.now();
      if (now - last < 250) return;
      last = now;
      send('download', { ...base(), state: st === 'interrupted' ? 'interrupted' : item.isPaused() ? 'paused' : 'progress' });
    });
    item.once('done', async (_ev, st) => {
      dlItems.delete(id);
      closeBlank(true);
      const file = item.getSavePath();
      if (st === 'cancelled' && !file) return;
      let iconUrl = '';
      if (st === 'completed' && file) rememberFile(file);
      if (st === 'completed' && file) markFromInternet(file, item.getURL(), item.getReferrer ? item.getReferrer() : '');
      if (st === 'completed' && file) { try { iconUrl = (await app.getFileIcon(file, { size: 'normal' })).toDataURL(); } catch {} }
      send('download', { ...base(), state: st, icon: iconUrl, doneAt: Date.now() });
    });
  });

  // Global Privacy Control + Do Not Track headers.
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    if (!prefs.gpc) return cb({});
    cb({ requestHeaders: { ...details.requestHeaders, 'Sec-GPC': '1', DNT: '1' } });
  });

  const state = readJSON('state.json', null);
  if (state && state.settings) {
    for (const k of Object.keys(prefs)) if (k in state.settings) prefs[k] = state.settings[k];
  }
  const wantBlock = !(state && state.settings && state.settings.blockTrackers === false);
  if (wantBlock) enableBlocking(ses); else disableBlocking(ses);
  if (part === PARTITION) {
    // Last time Oto didn't get to finish "Clear when Oto closes" (crash, forced close, power cut): do it now.
    if (exitClearWanted() && readJSON('exit-clear.json', { done: true }).done === false) runExitClear().then((f) => { if (!f.length) saveOrWarn('exit-clear.json', { done: false }); }).catch(() => {});
    saveOrWarn('exit-clear.json', { done: false }, '“Clear when Oto closes” status'); // a full disk must never stop Oto from starting
  }
  return ses;
}

// ---------------------------------------------------------------- downloads: safety
// File types that can run code when opened.
const RISKY_FILE = /\.(exe|msi|msix|msixbundle|appx|appxbundle|bat|cmd|com|scr|pif|cpl|msc|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|url|reg|jar|dll|sys|iso|img|vhd|vhdx|application|appref-ms|gadget|inf|scf|chm|settingcontent-ms)$/i;
// Windows' "this came from the internet" tag (Mark of the Web). Windows SmartScreen, Office Protected View and
// others use it to warn before running or editing downloaded files. Written for every finished download.
function markFromInternet(file, url, referrer) {
  if (process.platform !== 'win32') return;
  try {
    const safe = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? `${x.origin}${x.pathname}` : ''; } catch { return ''; } };
    const lines = ['[ZoneTransfer]', 'ZoneId=3'];
    if (safe(referrer)) lines.push(`ReferrerUrl=${safe(referrer)}`);
    if (safe(url)) lines.push(`HostUrl=${safe(url)}`);
    fs.writeFileSync(`${file}:Zone.Identifier`, `${lines.join('\r\n')}\r\n`);
  } catch (err) { console.warn('[oto] could not mark download as from the internet:', err && err.message); }
}

// ---------------------------------------------------------------- IPC
const SUGGEST = {
  duckduckgo: 'https://duckduckgo.com/ac/?type=list&q=',
  google: 'https://suggestqueries.google.com/complete/search?client=firefox&q=',
  brave: 'https://search.brave.com/api/suggest?q=',
  bing: 'https://api.bing.com/osjson.aspx?query=',
  startpage: 'https://duckduckgo.com/ac/?type=list&q=',
};

function setupIPC(ses) {
  ipcMain.handle('app:info', () => ({
    version: OTO_VERSION,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    launchUrl: (() => { const u = launchUrl; launchUrl = null; return u; })(),
    blocking: SH.mode(),
    // set by the installer on a fresh install (not on updates) — the UI shows the welcome setup once
    installMarker: (() => { try { return fs.readFileSync(path.join(process.resourcesPath, 'fresh-install.txt'), 'utf8').trim() || null; } catch { return null; } })(),
  }));
  // Settings → About: every version in one place (Oto, its engine, DRM, filter lists, Android app).
  let androidVer = { v: '', at: 0 };
  ipcMain.handle('app:versions', async () => {
    let widevine = '';
    try { const st = ecs && ecs.status ? ecs.status() : null; for (const c of Object.values(st || {})) { if (/widevine/i.test(`${c.name || ''} ${c.title || ''}`) || st.oimompecagnajdejgnnjijobebaeigek === c) { widevine = c.version || c.status || ''; break; } } } catch {}
    if (Date.now() - androidVer.at > 3600e3) {
      try {
        const r = await net.fetch('https://api.github.com/repos/mukairyo/oto/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
        if (r.ok) { const j = await r.json(); const a = (j.assets || []).map((x) => (/^Oto-Android-([0-9.]+)-arm64\.apk$/.exec(x.name) || [])[1]).find(Boolean); androidVer = { v: a || '', latest: displayVersion(String(j.tag_name || '').replace(/^v/, '')), at: Date.now() }; }
      } catch {}
    }
    return {
      oto: OTO_VERSION, channel: updateChannel(), update: UPDATES.updateState, latest: androidVer.latest || '',
      chrome: process.versions.chrome, electron: process.versions.electron, node: process.versions.node, v8: process.versions.v8,
      widevine, os: `${process.platform === 'win32' ? 'Windows' : process.platform} ${os.release()} (${process.arch})`,
      lists: { level: shieldLevel(), at: shieldListsAt(), mode: SH.mode() }, danger: { at: DANGER.at, count: DANGER.malware.size + DANGER.phishing.size },
      android: androidVer.v,
    };
  });
  ipcMain.handle('state:load', () => readJSON('state.json', null));
  ipcMain.handle('app:changelog', () => { try { return fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8'); } catch { return ''; } });
  ipcMain.on('state:save', (e, s) => { if (restoringBackup || isAvocadoUi(e.sender) || !s || typeof s !== 'object' || Array.isArray(s)) return; saveOrWarnAsync('state.json', s, 'your tabs and settings'); });
  // Structured result: { ok: true } or { ok: false, code } (never "true" when nothing reached the disk).
  ipcMain.on('state:save-sync', (e, s) => {
    if (restoringBackup || isAvocadoUi(e.sender)) { e.returnValue = { ok: true }; return; }
    if (!s || typeof s !== 'object' || Array.isArray(s)) { e.returnValue = { ok: false, code: 'invalid' }; return; }
    e.returnValue = saveOrWarn('state.json', s, 'your tabs and settings') ? { ok: true } : { ok: false, code: (damagedFile('state.json') || {}).readOnly ? 'damaged' : 'disk' };
  });
  ipcMain.handle('app:mode', (e) => (isAvocadoUi(e.sender) ? 'avocado' : 'main'));
  // v1 screenshots: whole long pages (via the DevTools protocol) and saving to Pictures\Oto Screenshots
  ipcMain.handle('shot:full', async (_e, wcId) => {
    let wc = null; try { wc = webContents.fromId(wcId); } catch {}
    if (!wc || wc.isDestroyed()) return '';
    const dbg = wc.debugger;
    let attached = false;
    try {
      if (!dbg.isAttached()) { dbg.attach('1.3'); attached = true; }
      const m = await dbg.sendCommand('Page.getLayoutMetrics');
      const cs = m.cssContentSize || m.contentSize;
      const width = Math.ceil(cs.width), height = Math.min(Math.ceil(cs.height), 16000);
      const r = await dbg.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
      return `data:image/png;base64,${r.data}`;
    } catch { return ''; } finally { if (attached) { try { dbg.detach(); } catch {} } }
  });
  ipcMain.handle('shot:save', async (_e, dataUrl) => {
    try {
      const dir = path.join(app.getPath('pictures'), 'Oto Screenshots');
      fs.mkdirSync(dir, { recursive: true });
      const d = new Date(), p2 = (n) => String(n).padStart(2, '0');
      const f = path.join(dir, `Oto ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}.${p2(d.getMinutes())}.${p2(d.getSeconds())}.png`);
      fs.writeFileSync(f, nativeImage.createFromDataURL(String(dataUrl)).toPNG());
      rememberFile(f);
      return f;
    } catch { return ''; }
  });
  ipcMain.on('shot:show', (_e, f) => { try { if (f) { if (fileAllowed(f)) shell.showItemInFolder(f); } else { const d = path.join(app.getPath('pictures'), 'Oto Screenshots'); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); } } catch {} });
  ipcMain.on('shot:open', (_e, f) => { try { if (fileAllowed(f)) shell.openPath(f); } catch {} });
  ipcMain.handle('qr:svg', async (_e, text) => { try { return await require('qrcode').toString(String(text || ''), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1d1b26', light: '#ffffff' } }); } catch { return ''; } });
  // Phone panel: your own 3D model of your phone (.glb) stays on this PC, in Oto's data folder.
  ipcMain.handle('phone:pickModel', async (e) => {
    const r = await dialog.showOpenDialog(winOf(e), { title: 'Choose a 3D model of your phone', properties: ['openFile'], filters: [{ name: '3D model (glTF binary)', extensions: ['glb'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const st = fs.statSync(r.filePaths[0]);
      if (st.size > 80 * 1024 * 1024) return { ok: false, error: 'That file is bigger than 80 MB.' };
      const b = fs.readFileSync(r.filePaths[0]);
      if (b.slice(0, 4).toString() !== 'glTF') return { ok: false, error: 'That isn’t a .glb 3D model.' };
      fs.writeFileSync(userFile('phone-model.glb'), b);
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('phone:model', () => { try { return fs.readFileSync(userFile('phone-model.glb')); } catch { return null; } });
  ipcMain.handle('phone:clearModel', () => { try { fs.unlinkSync(userFile('phone-model.glb')); return true; } catch (e) { return !!(e && e.code === 'ENOENT'); } });
  ipcMain.on('app:open', (_e, url) => openAppWindow(url));
  ipcMain.handle('app:install', async (_e, url, title, iconDataUrl) => {
    let u; try { u = new URL(url); } catch { return { ok: false }; }
    const dir = userFile('apps');
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    let icoPath = '';
    try {
      const img = nativeImage.createFromDataURL(String(iconDataUrl || ''));
      if (!img.isEmpty()) {
        const big = img.resize({ width: 256, height: 256, quality: 'best' });
        fs.writeFileSync(path.join(dir, `${u.hostname}.png`), big.toPNG());
        icoPath = path.join(dir, `${u.hostname}.ico`);
        fs.writeFileSync(icoPath, pngToIco(big.toPNG()));
      }
    } catch {}
    let shortcut = false;
    if (process.platform === 'win32') {
      try {
        const name = String(title || u.hostname).replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || u.hostname;
        const lnk = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${name}.lnk`);
        shortcut = shell.writeShortcutLink(lnk, { target: process.execPath, args: `--oto-app=${u.origin}/`, description: `${name} (Oto app)`, appUserModelId: `com.ryo.oto.app.${u.hostname}`, ...(icoPath ? { icon: icoPath, iconIndex: 0 } : {}) });
      } catch {}
    }
    openAppWindow(`${u.origin}/`);
    return { ok: true, shortcut };
  });
  ipcMain.on('avocado:open', () => createAvocadoWindow());
  // Backup & restore: one .oto file. With a backup password the WHOLE file is encrypted (AES-256-GCM, key from
  // scrypt) and saved passwords are included. Without one, Oto warns first: history, tabs, bookmarks and settings
  // are readable by anyone who opens the file, and saved passwords are left out.
  const crypto = require('crypto');
  const bkKey = (pass, salt) => crypto.scryptSync(String(pass), salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const bkSummary = (st, nPw, extra = {}) => ({ ok: true, spaces: (st.workspaces || []).length, tabs: (st.tabs || []).length, bookmarks: JSON.stringify(st.bookmarks || []).split('"url"').length - 1, passwords: nPw, ...extra });
  ipcMain.handle('backup:save', async (e, state, pass) => {
    if (!state || typeof state !== 'object') return { ok: false };
    pass = typeof pass === 'string' && pass ? pass : null;
    if (!pass) {
      const c = await dialog.showMessageBox(winOf(e), {
        type: 'warning', buttons: ['Cancel', 'Save without encryption'], defaultId: 0, cancelId: 0, noLink: true, title: 'Unencrypted backup',
        message: 'Save this backup without a password?',
        detail: 'Anyone who opens the file can read your history, open tabs, bookmarks and settings. Saved passwords are left out.\n\nType a backup password first to encrypt the whole file (and include your saved passwords).',
      });
      if (c.response !== 1) return { ok: false };
    }
    const day = new Date().toISOString().slice(0, 10);
    const r = await dialog.showSaveDialog(winOf(e), { defaultPath: path.join(app.getPath('documents'), `Oto-backup-${day}.oto`), filters: [{ name: 'Oto backup', extensions: ['oto'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    let out, nPw = 0;
    if (pass) {
      const passwords = pwOk() === true ? pwLoad().entries.map((en) => ({ origin: en.origin, username: en.username, password: pwDec(en) })).filter((x) => x.password) : [];
      nPw = passwords.length;
      const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', bkKey(pass, salt), iv);
      const data = Buffer.concat([c.update(JSON.stringify({ state, passwords }), 'utf8'), c.final()]);
      out = { oto: 'backup', v: 2, created: Date.now(), version: OTO_VERSION, enc: { salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') } };
    } else out = { oto: 'backup', v: 1, created: Date.now(), version: OTO_VERSION, state };
    const txt = JSON.stringify(out);
    fs.writeFileSync(r.filePath, txt);
    return { ok: true, path: r.filePath, size: txt.length, passwords: nPw, encrypted: !!pass };
  });
  let pendingBackup = null;
  ipcMain.handle('backup:open', async (e) => {
    pendingBackup = null;
    const r = await dialog.showOpenDialog(winOf(e), { properties: ['openFile'], filters: [{ name: 'Oto backup', extensions: ['oto'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      if (fs.statSync(r.filePaths[0]).size > 200 * 1024 * 1024) return { ok: false, error: 'That file is too big to be an Oto backup.' };
      const d = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (d.oto !== 'backup' || !(d.state || d.enc)) return { ok: false, error: 'This isn’t an Oto backup file.' };
      pendingBackup = d;
      if (d.enc) return { ok: true, locked: true, created: d.created, version: d.version };
      return bkSummary(d.state, d.passwords ? d.passwords.n : 0, { created: d.created, version: d.version });
    } catch { return { ok: false, error: 'Couldn’t read that file.' }; }
  });
  // Encrypted (v2) backups: unlock with the backup password to see what's inside before restoring.
  ipcMain.handle('backup:unlock', async (_e, pass) => {
    const d = pendingBackup;
    if (!d || !d.enc) return { ok: false };
    try {
      const p = d.enc;
      const dc = crypto.createDecipheriv('aes-256-gcm', bkKey(pass, Buffer.from(p.salt, 'base64')), Buffer.from(p.iv, 'base64'));
      dc.setAuthTag(Buffer.from(p.tag, 'base64'));
      const inner = JSON.parse(Buffer.concat([dc.update(Buffer.from(p.data, 'base64')), dc.final()]).toString('utf8'));
      if (!inner || typeof inner.state !== 'object') throw new Error('format');
      pendingBackup = { oto: 'backup', v: 2, created: d.created, version: d.version, state: inner.state, pwList: Array.isArray(inner.passwords) ? inner.passwords : [] };
      return bkSummary(inner.state, pendingBackup.pwList.length, { created: d.created, version: d.version });
    } catch { return { ok: false, error: 'Wrong backup password.' }; }
  });
  ipcMain.handle('backup:restore', async (_e, pass) => {
    const d = pendingBackup;
    if (!d || !d.state) return { ok: false };
    let list = d.pwList || null;
    if (!list && d.passwords && pass) { // v1 backups: only the passwords part was encrypted
      try {
        const p = d.passwords;
        const dc = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(String(pass), Buffer.from(p.salt, 'base64'), 32), Buffer.from(p.iv, 'base64'));
        dc.setAuthTag(Buffer.from(p.tag, 'base64'));
        list = JSON.parse(Buffer.concat([dc.update(Buffer.from(p.data, 'base64')), dc.final()]).toString('utf8'));
      } catch { return { ok: false, error: 'Wrong backup password.' }; }
    }
    let pw = 0;
    for (const en of list || []) if (en && en.origin && en.password && ['saved', 'updated', 'same'].includes(pwUpsert(en.origin, en.username || '', en.password))) pw++;
    restoringBackup = true;
    writeJSON('state.json', d.state);
    setTimeout(() => { app.relaunch(); app.quit(); }, 400);
    return { ok: true, passwords: pw };
  });
  ipcMain.on('win:overlay', (_e, o) => {
    try {
      if (win && win.setTitleBarOverlay) {
        win.setTitleBarOverlay({ color: o.color, symbolColor: o.symbol, height: Math.round(o.height || TOPBAR_H) });
      }
    } catch {}
  });
  // Screenshot of the strip under Windows' caption buttons. Returned as a PNG data URL so the
  // UI decodes it with a canvas — raw bitmaps differ in byte order between platforms.
  ipcMain.handle('win:capture-strip', async (_e, height) => {
    if (!win || win.isDestroyed()) return null;
    try {
      const [w] = win.getContentSize();
      const hgt = Math.max(20, Math.round((height || TOPBAR_H) - 12));
      const img = await win.webContents.capturePage({ x: Math.max(0, w - 140), y: 6, width: 130, height: hgt });
      return img.isEmpty() ? null : img.toDataURL();
    } catch { return null; }
  });
  ipcMain.on('theme:set', (_e, t) => { nativeTheme.themeSource = ['light', 'dark'].includes(t) ? t : 'system'; });
  ipcMain.on('clipboard:write', (_e, text) => clipboard.writeText(String(text || '')));
  ipcMain.on('shell:show', (_e, p) => { if (fileAllowed(p)) shell.showItemInFolder(p); });
  ipcMain.on('clipboard:image', (_e, dataUrl) => { try { const img = nativeImage.createFromDataURL(String(dataUrl || '')); if (!img.isEmpty()) clipboard.writeImage(img); } catch {} });
  ipcMain.on('dl:action', (_e, id, act) => {
    const it = dlItems.get(id);
    if (!it) return;
    if (act === 'cancel') it.cancel();
    else if (act === 'pause') it.pause();
    else if (act === 'resume' && it.canResume()) it.resume();
  });
  ipcMain.handle('dl:open', async (e, p) => {
    if (!p || !fs.existsSync(p)) return 'missing';
    if (!fileAllowed(p)) return 'error';
    // Files that can run code (programs, scripts, shortcuts, disk images …) are never opened without a clear warning.
    if (RISKY_FILE.test(p)) {
      const c = await dialog.showMessageBox(winOf(e), {
        type: 'warning', buttons: ['Cancel', 'Open anyway'], defaultId: 0, cancelId: 0, noLink: true, title: 'Open this file?',
        message: `“${path.basename(p)}” can run programs on your PC.`,
        detail: 'Only open it if you trust where it came from. Files like this are how most viruses get in. Windows will check it too (SmartScreen).',
      });
      if (c.response !== 1) return 'cancelled';
    }
    const err = await shell.openPath(p);
    return err ? 'error' : 'ok';
  });
  ipcMain.handle('dl:exists', (_e, paths) => (Array.isArray(paths) ? paths.map((p) => !!p && fs.existsSync(p)) : []));
  ipcMain.handle('suggest', async (_e, engine, q) => {
    const ep = SUGGEST[engine] || SUGGEST.duckduckgo;
    try {
      const r = await net.fetch(ep + encodeURIComponent(q), { signal: AbortSignal.timeout(2500) });
      const j = await r.json();
      if (Array.isArray(j) && Array.isArray(j[1])) return j[1].filter((s) => typeof s === 'string').slice(0, 5);
      if (Array.isArray(j)) return j.map((x) => x && x.phrase).filter(Boolean).slice(0, 5);
    } catch {}
    return [];
  });
  // Shield on/off applies to every session at once (main, every Space, Avocado), not just the main one.
  ipcMain.handle('blocker:set', async (_e, on) => { let mode = 'off'; for (const x of liveSessions()) mode = on ? await enableBlocking(x) : disableBlocking(x); SH.rtcRefresh(); return mode; });
  SH.setupShieldIPC();
  ipcMain.on('screen:reply', (_e, id, sourceId, audio) => {
    const p = screenPicks.get(id);
    if (!p) return;
    screenPicks.delete(id); clearTimeout(p.timer); p.cleanup();
    const src = typeof sourceId === 'string' && p.sources.find((s) => s.id === sourceId);
    if (!src || !p.stillThere()) return p.callback(null);
    p.callback(audio && process.platform === 'win32' ? { video: src, audio: 'loopback' } : { video: src });
  });
  ipcMain.on('perm:reply', (_e, id, allow) => {
    const p = pendingPerms.get(id);
    if (!p) return;
    pendingPerms.delete(id);
    clearTimeout(p.timer);
    if (p.gone && p.gone()) return; // the page that asked is gone: nothing to answer, nothing to remember
    if (p.off) p.off();
    for (const k of p.keys || [p.key]) perms[k] = !!allow;
    savePerms();
    p.callback(!!allow);
  });
  ipcMain.on('settings:sync', (_e, p) => {
    if (!p || typeof p !== 'object') return;
    const { keymap, ...rest } = p;
    const chBefore = prefs.updateChannel;
    prefs = { ...prefs, ...rest };
    if (UPDATES.updater && chBefore !== undefined && chBefore !== prefs.updateChannel) setTimeout(() => checkForUpdates(true), 300);
    if (keymap && typeof keymap === 'object') buildKeymap(keymap);
  });
  ipcMain.on('keys:pause', (_e, on) => { keysPaused = !!on; });
  ipcMain.on('app:relaunch', () => { app.relaunch(); app.quit(); });

  // Task manager: memory and CPU per process, plus which page each process belongs to.
  ipcMain.handle('perf:metrics', () => {
    const procs = app.getAppMetrics().map((m) => ({
      pid: m.pid, type: m.type, name: m.name || m.serviceName || '',
      mem: Math.round((m.memory.workingSetSize || 0) / 1024), // MB
      cpu: Math.round((m.cpu.percentCPUUsage || 0) * 10) / 10,
    }));
    const pages = webContents.getAllWebContents()
      .filter((wc) => !wc.isDestroyed() && wc.getType() === 'webview')
      .map((wc) => ({ wcId: wc.id, pid: wc.getOSProcessId() }));
    return { procs, pages };
  });

  // Efficiency mode: freeze a background page completely (no timers, no scripts) and thaw it later.
  ipcMain.handle('tab:freeze', async (_e, wcId, frozen) => {
    const wc = webContents.fromId(wcId);
    if (!wc || wc.isDestroyed() || wc.getType() !== 'webview') return false;
    try {
      const dbg = wc.debugger;
      if (!dbg.isAttached()) dbg.attach('1.3');
      await dbg.sendCommand('Page.enable');
      await dbg.sendCommand('Page.setWebLifecycleState', { state: frozen ? 'frozen' : 'active' });
      if (!frozen && !require('./main/worker-guard.js').isGuarded(wc)) dbg.detach(); // stays connected for worker protection
      return true;
    } catch { return false; }
  });
  ipcMain.handle('perm:list', () => perms);
  ipcMain.handle('perm:set', async (_e, key, val) => {
    if (typeof key !== 'string' || !key.includes('|')) return perms;
    const [origin, perm] = key.split('|');
    if (val === null || val === undefined) delete perms[key]; else perms[key] = perm === 'cookies' && val === 'session' ? 'session' : !!val;
    // camera / microphone replace the old shared "media" choice for that site
    if ((perm === 'camera' || perm === 'microphone') && `${origin}|media` in perms) {
      const old = perms[`${origin}|media`]; delete perms[`${origin}|media`];
      const other = perm === 'camera' ? 'microphone' : 'camera';
      if (!(`${origin}|${other}` in perms)) perms[`${origin}|${other}`] = old;
    }
    savePerms();
    if (perm === 'cookies' && val === false && origin !== '*') await eachBrowsingSession((ses) => ses.clearStorageData({ origin, storages: ['cookies'] }));
    return perms;
  });
  // page-preload.js asks this once per page: should media wait for a click, and may this frame write cookies?
  ipcMain.on('oto:page', (e, frameOrigin) => {
    const r = { autoplay: false, cookies: false, fp: 0, fpStrict: false, yt: false };
    // YouTube (also its players embedded on other sites): strip the ads out of the player's data before it reads it,
    // so the player never waits for an ad Oto blocked (that left an empty player until you reloaded).
    try {
      const fh = new URL(String(frameOrigin)).hostname, top = shieldHost(e.sender.getURL());
      r.yt = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(fh) && SH.mode() !== 'off' && !shieldAllowed(top || fh);
    } catch {}
    // Fingerprint protection: a number that's the same for one site during one session, different everywhere else.
    try {
      r.fp = fpSeed(e.sender.getURL(), String(frameOrigin));
      r.fpStrict = !!r.fp && SH.features().mode === 'strict'; // Strict: keyboard layout and read-aloud voices too
    } catch {}
    try { r.autoplay = autoplayBlocked(originOf(e.sender.getURL())); } catch {}
    try { r.cookies = cookieBlockHosts.length > 0 && cookieBlocked(new URL(String(frameOrigin)).hostname); } catch {}
    e.returnValue = r;
  });
  ipcMain.handle('site:clear', async (_e, origin) => {
    try {
      const o = new URL(origin).origin;
      const failed = await eachBrowsingSession((ses) => ses.clearStorageData({ origin: o })); // every Space, not just the main one
      for (const k of Object.keys(perms)) if (k.startsWith(`${o}|`)) delete perms[k];
      savePerms();
      return failed.length === 0; // only "done" if every Space was really cleared
    } catch { return false; }
  });
  ipcMain.on('ctx:do', (_e, act, arg) => ctxAction(act, arg));
  ipcMain.handle('perm:reset', (_e, key) => {
    if (key) delete perms[key]; else perms = {};
    savePerms();
    return perms;
  });
  ipcMain.on('app:icon', (_e, dataUrl) => {
    try {
      const img = nativeImage.createFromDataURL(String(dataUrl || ''));
      if (!img.isEmpty() && win) win.setIcon(img);
    } catch {}
  });
  ipcMain.handle('app:default-browser', async () => {
    if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:defaultapps?registeredAppUser=Oto');
      return 'opened';
    }
    app.setAsDefaultProtocolClient('http');
    app.setAsDefaultProtocolClient('https');
    return 'set';
  });
  ipcMain.handle('data:clear', async () => {
    const failed = await eachBrowsingSession((x) => Promise.all([x.clearStorageData(), x.clearCache()])); // every Space too
    perms = {};
    savePerms();
    return failed.length === 0 ? true : { ok: false, failed: failed.length };
  });
}

// ---------------------------------------------------------------- extensions (main/extensions.js)
const EXT = require('./main/extensions.js')(CTX);
const { initExtensionAPI, setupExtensions, setupExtensionIPC } = EXT;

// ---------------------------------------------------------------- bookmark import (main/bookmarks.js)
const { setupBookmarkIPC } = require('./main/bookmarks.js');

// ---------------------------------------------------------------- passwords
// Saved logins live in passwords.json, each password encrypted with Windows' own data protection
// (Electron safeStorage = DPAPI, the same thing Chrome uses). Nothing leaves the PC. The UI only
// ever gets usernames; a password is decrypted when you pick it to fill, copy or reveal.
const PW_FILE = 'passwords.json';
let ACCOUNT = null; // Oto Accounts + PC lock (account.js)
// Protected content (Widevine DRM) for Spotify, Netflix, Disney+, Prime Video…: Oto is built on
// Electron for Content Security (castlabs), which installs Google's Widevine module on first start
// and keeps it updated. We wait a moment for it, but never block Oto from opening.
const ecs = (() => { try { return require('electron').components || null; } catch { return null; } })();
let drmState = { available: !!ecs, ready: false, status: null };
let drmLate = false;
async function drmReady() {
  if (!ecs) return;
  const done = ecs.whenReady().then(() => { const was = drmState.ready; drmState.ready = true; if (!was && drmLate) send('drm:ready'); }).catch(() => {}).finally(() => { try { drmState.status = ecs.status(); } catch {} });
  await Promise.race([done, new Promise((r) => setTimeout(r, 4000))]);
  drmLate = true;
}
ipcMain.handle('drm:status', () => { try { drmState.status = ecs ? ecs.status() : null; } catch {} return drmState; });
// "Install now": ask the component updater to fetch Widevine right away (waits up to a minute).
ipcMain.handle('drm:install', async () => {
  if (!ecs) return drmState;
  try { await Promise.race([ecs.whenReady().then(() => { drmState.ready = true; }), new Promise((r) => setTimeout(r, 60000))]); } catch (e) { drmState.error = String(e && e.message || e); }
  try { drmState.status = ecs.status(); } catch {}
  return drmState;
});
const { pwOk, pwLoad, pwDec, pwUpsert, pwSyncExport, pwSyncMerge, setupPasswordIPC } = require('./main/passwords.js')(CTX);

// ---------------------------------------------------------------- window buttons
function setupWindowIPC() {
  // Where the mouse really is, relative to Oto's window — web pages swallow mouse events on Windows,
  // so the UI asks this to know when you've moved out of a slid-open sidebar or top bar.
  ipcMain.handle('win:cursor', () => {
    if (!win || win.isDestroyed()) return null;
    const p = screen.getCursorScreenPoint();
    const b = win.getContentBounds();
    // Screen DIPs -> the UI's CSS pixels (differs if the UI page itself is zoomed).
    const z = win.webContents.getZoomFactor() || 1;
    return { x: (p.x - b.x) / z, y: (p.y - b.y) / z, focused: win.isFocused() };
  });
  ipcMain.handle('diag:info', () => ({
    platform: process.platform, osVersion: require('os').release(), electron: process.versions.electron,
    zoom: win && !win.isDestroyed() ? win.webContents.getZoomFactor() : null,
    contentBounds: win && !win.isDestroyed() ? win.getContentBounds() : null,
    displays: screen.getAllDisplays().map((d) => ({ scale: d.scaleFactor, bounds: d.bounds, primary: d.id === screen.getPrimaryDisplay().id })),
  }));
  ipcMain.handle('diag:save', async (_e, text) => {
    const r = await dialog.showSaveDialog(win, { title: 'Save problem report', defaultPath: path.join(app.getPath('desktop'), 'Oto-problem-report.txt'), filters: [{ name: 'Text', extensions: ['txt'] }] });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, String(text || ''));
    return true;
  });
  ipcMain.on('win:min', (e) => { const w = winOf(e); if (w) w.minimize(); });
  ipcMain.on('win:max', (e) => { const w = winOf(e); if (!w) return; if (w.isMaximized()) w.unmaximize(); else w.maximize(); });
  ipcMain.on('win:close', (e) => { const w = winOf(e); if (w) w.close(); });
}

// ---------------------------------------------------------------- boot
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const appUrl = appArg(argv);
    if (appUrl) { openAppWindow(appUrl); return; }
    const url = urlFromArgv(argv);
    if (url) send('quick:open', url); else send('tab:open', { url: null, background: false });
  });

  app.whenReady().then(async () => {
    ownerLoad();
    await drmReady();
    const ses = setupSession();
    setupIPC(ses);
    setupExtensionIPC(ses);
    setupBookmarkIPC();
    setupPasswordIPC();
    ACCOUNT = require('./account.js')({ ipcMain, app, safeStorage, net, readJSON, writeJSON, saveOrWarn, send, pwSyncExport, pwSyncMerge, OTO_VERSION });
    setupWindowIPC();
    initExtensionAPI(ses);
    createWindow();
    { const a = appArg(process.argv); if (a) setTimeout(() => openAppWindow(a), 1200); }
    win.webContents.once('did-finish-load', () => setupExtensions(ses));
  });

  app.on('browser-window-created', (_e, bw) => bw.webContents.on('devtools-opened', () => { if (app.isPackaged && !UPDATES.ownerOn) bw.webContents.closeDevTools(); }));
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(() => setupUpdates());

  app.on('will-quit', () => { SH.flushStats(); });
  app.whenReady().then(() => { setTimeout(() => dangerUpdate(false).catch(() => {}), 15000); setInterval(() => dangerUpdate(false).catch(() => {}), 3600e3); });
  // "Clear cookies & site data when Oto closes"
  let cleared = false;
  app.on('before-quit', (e) => {
    // sites set to "Clear when Oto closes" in Site permissions
    if (!exitClearWanted() || cleared) { if (!exitClearWanted()) { try { writeJSON('exit-clear.json', { done: true }); } catch {} } return; }
    e.preventDefault();
    cleared = true;
    SH.flushStats();
    // Up to 5 seconds; if it doesn't finish (or Oto is killed/crashes), the marker stays and the next start clears.
    Promise.race([
      runExitClear().then((failed) => { if (!failed.length) { try { writeJSON('exit-clear.json', { done: true, at: Date.now() }); } catch {} } }),
      new Promise((r) => setTimeout(r, 5000)),
    ]).finally(() => app.quit());
  });
}
