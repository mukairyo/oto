// Oto — main process
const {
  app, BrowserWindow, ipcMain, session, Menu, clipboard, shell, nativeTheme, net, screen, nativeImage, webContents, dialog, safeStorage,
} = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

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
function readJSON(name, fallback) {
  try { return JSON.parse(fs.readFileSync(userFile(name), 'utf8')); } catch { return fallback; }
}
function writeJSON(name, data) {
  const p = userFile(name);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, p);
}

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

// ---------------------------------------------------------------- keyboard
const DEFAULT_KEYS = {
  'Shift+Escape': 'health', 'Ctrl+Shift+ ': 'overview', 'Ctrl+Shift+N': 'avocado', 'Ctrl+Shift+X': 'screenshot',
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
const winOf = (e) => BrowserWindow.fromWebContents(hostOfWc(e && e.sender)) || win;
let restoringBackup = false;

// v1: holding Ctrl on its own shows the shortcut sheet (any other key or a click cancels it).
let ctrlDown = false;
function ctrlHold(input, wc) {
  if (input.key === 'Control') {
    if (input.type === 'keyDown' && !input.isAutoRepeat && !ctrlDown) { ctrlDown = true; sendVia(wc, 'ctrl-hold', 'down'); }
    else if (input.type === 'keyUp') { ctrlDown = false; sendVia(wc, 'ctrl-hold', 'up'); }
  } else if (ctrlDown && input.type === 'keyDown') { sendVia(wc, 'ctrl-hold', 'other'); }
}
function handleKeys(event, input) {
  ctrlHold(input, event.sender);
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
  const w = winOf(event);
  if (cmd === 'fullscreen') { if (w) w.setFullScreen(!w.isFullScreen()); return; }
  if (cmd === 'uiDevtools') { if (w) w.webContents.openDevTools({ mode: 'detach' }); return; }
  if (cmd === 'avocado') { createAvocadoWindow(); return; }
  sendVia(event.sender, 'cmd', cmd);
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
  const dark = nativeTheme.shouldUseDarkColors;
  const bg = dark ? '#141417' : '#f2f1f6';

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
      preload: path.join(__dirname, 'preload.js'),
      // The UI only ever loads Oto's own local files; the preload needs Node to host
      // the extension toolbar (<browser-action-list>). Web pages stay sandboxed.
      sandbox: false,
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
  ui.on('before-input-event', handleKeys);
  ui.on('will-attach-webview', (e, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    // v1: a space can have its own logins (its own cookie jar): persist:oto-ws-<space id>
    const sp = /^persist:oto-ws-[\w-]{1,40}$/.test(params.partition || '') ? params.partition : null;
    if (sp) prepSpaceSession(sp);
    params.partition = sp || PARTITION;
    if (params.src && !/^(https?|file|about|data|view-source|chrome-extension):/i.test(params.src)) e.preventDefault();
  });
}

// Every page (webview) gets keyboard shortcuts, tab-style popups and a context menu.
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.on('before-input-event', handleKeys);
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
  if (extensions && win) { try { extensions.addTab(contents, win); } catch {} }
  contents.setWindowOpenHandler(({ url, disposition }) => {
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
function prepSpaceSession(part) {
  if (spaceSessions.has(part)) return;
  spaceSessions.add(part);
  try { setupSession(part); } catch {}
  if (blockingMode !== 'off') enableBlocking(session.fromPartition(part)).catch(() => {});
}

// ---------------------------------------------------------------- Avocado (private windows)
// Oto's private mode: its own window whose pages use an in-memory session. Closing the last
// Avocado window wipes that session (cookies, storage, cache). Its state is never saved.
let avocadoReady = false;
function setupAvocadoSession() {
  if (avocadoReady) return;
  avocadoReady = true;
  const s = session.fromPartition(AVOCADO);
  s.setPermissionRequestHandler((_wc, p, cb) => cb(ALWAYS.has(p)));
  s.setPermissionCheckHandler((_wc, p) => ALWAYS.has(p));
  if (blockingMode !== 'off') enableBlocking(s).catch(() => {});
}
function createAvocadoWindow() {
  setupAvocadoSession();
  const w = new BrowserWindow({
    width: 1240, height: 800, minWidth: 720, minHeight: 480, show: false, backgroundColor: '#0e110b', title: 'Oto — Avocado', icon: ICON,
    titleBarStyle: 'hidden',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: false, webviewTag: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  avocadoWins.add(w);
  w.removeMenu();
  w.loadFile(path.join(__dirname, 'src', 'index.html'), { query: { avocado: '1' } });
  w.once('ready-to-show', () => w.show());
  const ui = w.webContents;
  ui.on('will-navigate', (e) => e.preventDefault());
  ui.setWindowOpenHandler(() => ({ action: 'deny' }));
  ui.on('before-input-event', handleKeys);
  ui.on('will-attach-webview', (e, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false; webPreferences.contextIsolation = true; webPreferences.sandbox = true;
    params.partition = AVOCADO;
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
  wc.on('will-navigate', (e, link) => { try { const o = new URL(link); if (o.origin !== u.origin && !/accounts\.|login\.|auth/.test(o.hostname)) { e.preventDefault(); toOto(link); } } catch {} });
  wc.on('page-title-updated', (_e, t) => w.setTitle(t));
  w.loadURL(url);
}
const appArg = (argv) => { const a = (argv || []).find((x) => /^--oto-app=/.test(x)); return a ? a.slice(10) : null; };

// ---------------------------------------------------------------- version numbers
// Oto shows versions like 0.9.8 for big updates and 0.9.8.1, 0.9.8.2 … for small ones. The updater
// needs three-part numbers, so the patch part carries both: 0.9.801 = 0.9.8.1, 0.9.900 = 0.9.9.
function displayVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || ''));
  if (!m) return String(v || '');
  if (/-/.test(String(v))) return String(v); // tester builds keep their full name, e.g. 0.10.0-beta.1
  const p = +m[3];
  if (p < 100) return `${m[1]}.${m[2]}.${p}`;
  const base = Math.floor(p / 100), small = p % 100;
  return small ? `${m[1]}.${m[2]}.${base}.${small}` : `${m[1]}.${m[2]}.${base}`;
}
const OTO_VERSION = (() => { try { return require('./package.json').otoVersion || displayVersion(app.getVersion()); } catch { return displayVersion(app.getVersion()); } })();

// ---------------------------------------------------------------- auto-update (GitHub Releases)
// New versions are published as releases on github.com/mukairyo/oto. Oto checks a few seconds after
// launch and every 6 hours, downloads in the background and installs when you restart.
let updater = null;
let updateState = { state: 'idle' };
function setUpdate(st) {
  updateState = { ...st, at: Date.now() };
  send('update', updateState);
}
function setupUpdates() {
  ipcMain.handle('update:status', () => ({ ...updateState, packaged: app.isPackaged, version: OTO_VERSION, channel: updateChannel(), owner: ownerOn }));
  ipcMain.handle('owner:unlock', (_e, key) => {
    if (ownerHash(key) !== OWNER_HASH) return false;
    ownerOn = true;
    try { writeJSON('owner.json', { h: OWNER_HASH }); } catch {}
    return true;
  });
  ipcMain.handle('owner:lock', () => {
    ownerOn = false;
    try { fs.unlinkSync(userFile('owner.json')); } catch {}
    return true;
  });
  ipcMain.handle('update:check', () => checkForUpdates(true));
  ipcMain.on('update:install', () => {
    if (!updater || updateState.state !== 'ready') return;
    setImmediate(() => updater.quitAndInstall(true, true));
  });
  if (!app.isPackaged) { updateState = { state: 'dev' }; return; }
  try { updater = require('electron-updater').autoUpdater; } catch (err) { updateState = { state: 'error', message: err.message }; return; }
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.logger = null;
  configureChannel(updateChannel());
  updater.on('checking-for-update', () => setUpdate({ state: 'checking' }));
  updater.on('update-available', (i) => setUpdate({ state: 'downloading', version: displayVersion(i.version), percent: 0 }));
  updater.on('update-not-available', () => setUpdate({ state: 'latest' }));
  updater.on('download-progress', (p) => setUpdate({ state: 'downloading', version: updateState.version, percent: Math.round(p.percent || 0) }));
  updater.on('update-downloaded', (i) => setUpdate({ state: 'ready', version: displayVersion(i.version) }));
  updater.on('error', (err) => {
    const m = String((err && err.message) || err);
    // No releases yet / repo not created yet: not worth bothering anyone about.
    const quiet = /404|Unable to find latest version|No published versions|HttpError: 4/i.test(m);
    setUpdate({ state: quiet ? 'none-published' : 'error', message: m.split('\n')[0].slice(0, 200) });
  });
  setTimeout(() => checkForUpdates(false), 8000);
  setInterval(() => checkForUpdates(false), 6 * 3600 * 1000);
}
// Update channels: Stable (everyone), Beta (testers get new versions early), Alpha (newest
// experiments). Testers also still get every stable update — if their channel has nothing newer,
// Oto checks the stable channel too. Oto never goes back to an older version on its own.
const UPDATE_CHANNELS = ['stable', 'beta', 'alpha'];
// Owner channel: Ryo's own test builds (1.0.0-owner.N). Hidden until the private owner key is entered
// (Settings → About → tap "Oto version" 7 times). Only a hash of the key is in the code.
const OWNER_HASH = '5d3daf57d0126aea9114a57a08c97450bdcb786f6e40f7ef8b69858042d77fb0';
const ownerHash = (key) => require('crypto').createHash('sha256').update(`oto-owner|${String(key || '').trim().toUpperCase()}`).digest('hex');
let ownerOn = (readJSON('owner.json', {}) || {}).h === OWNER_HASH;
const updateChannel = () => {
  if (prefs.updateChannel === 'owner') return ownerOn ? 'owner' : 'stable';
  return UPDATE_CHANNELS.includes(prefs.updateChannel) ? prefs.updateChannel : 'stable';
};
function configureChannel(ch) {
  updater.channel = ch === 'stable' ? 'latest' : ch;
  updater.allowPrerelease = ch !== 'stable';
  updater.allowDowngrade = false;
}
async function checkForUpdates(manual) {
  if (!updater) return updateState;
  if (!manual && prefs.autoUpdate === false) return updateState;
  if (['checking', 'downloading', 'ready'].includes(updateState.state)) return updateState;
  const ch = updateChannel();
  let found = false;
  try { configureChannel(ch); const r = await updater.checkForUpdates(); found = !!(r && r.isUpdateAvailable); } catch {}
  if (!found && ch !== 'stable') { try { configureChannel('stable'); await updater.checkForUpdates(); } catch {} }
  return updateState;
}

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
    try { hasExt = !!(extensions && extensions.getContextMenuItems(wc, p).length); } catch {}
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
  if (extensions) {
    try {
      const extItems = extensions.getContextMenuItems(wc, p);
      if (extItems.length) t.push(...extItems, sep);
    } catch {}
  }
  t.push({ label: 'Inspect', click: () => wc.inspectElement(p.x, p.y) });
  Menu.buildFromTemplate(t).popup({ window: win });
}

// ---------------------------------------------------------------- ad & tracker blocking
let blocker = null;
let fallbackOn = false;
let blockingMode = 'off';
const pendingBlocked = new Map();
let blockedFlush = null;

function notifyBlocked(wcId) {
  if (!wcId) return;
  pendingBlocked.set(wcId, (pendingBlocked.get(wcId) || 0) + 1);
  if (blockedFlush) return;
  blockedFlush = setTimeout(() => {
    blockedFlush = null;
    for (const [id, n] of pendingBlocked) { let wc = null; try { wc = webContents.fromId(id); } catch {} sendVia(wc, 'blocked', id, n); }
    pendingBlocked.clear();
  }, 250);
}

function enableFallback(ses) {
  const list = new Set(require('./blocklist.js'));
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => {
    if (d.resourceType === 'mainFrame') return cb({});
    let h;
    try { h = new URL(d.url).hostname; } catch { return cb({}); }
    while (h) {
      if (list.has(h)) { notifyBlocked(d.webContentsId); return cb({ cancel: true }); }
      const i = h.indexOf('.');
      if (i < 0) break;
      h = h.slice(i + 1);
    }
    cb({});
  });
  fallbackOn = true;
}

async function enableBlocking(ses) {
  if (blocker) { blocker.enableBlockingInSession(ses); return (blockingMode = 'full'); }
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    const cache = userFile('adblock-engine.bin');
    try { if (Date.now() - fs.statSync(cache).mtimeMs > 7 * 864e5) fs.unlinkSync(cache); } catch {}
    const fetchFn = (url, opts) => net.fetch(url, opts);
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetchFn, {
      path: cache, read: fs.promises.readFile, write: fs.promises.writeFile,
    });
    blocker.on('request-blocked', (req) => notifyBlocked(req.tabId));
    blocker.on('request-redirected', (req) => notifyBlocked(req.tabId)); // trackers swapped for harmless stubs
    if (fallbackOn) { ses.webRequest.onBeforeRequest(null); fallbackOn = false; }
    blocker.enableBlockingInSession(ses);
    return (blockingMode = 'full');
  } catch (err) {
    console.warn('[oto] full blocker unavailable, using built-in list:', err && err.message);
    if (!fallbackOn) enableFallback(ses);
    return (blockingMode = 'basic');
  }
}

function disableBlocking(ses) {
  if (blocker && blocker.isBlockingEnabled(ses)) blocker.disableBlockingInSession(ses);
  if (fallbackOn) { ses.webRequest.onBeforeRequest(null); fallbackOn = false; }
  blockingMode = 'off';
  return blockingMode;
}

// ---------------------------------------------------------------- permissions
const ALWAYS = new Set(['fullscreen', 'clipboard-sanitized-write', 'window-management']);
let perms = {};
let permSeq = 0;
const pendingPerms = new Map();

function originOf(u) { try { return new URL(u).origin; } catch { return String(u || ''); } }

function setupSession(part = PARTITION) {
  const ses = session.fromPartition(part);
  if (part === PARTITION) perms = readJSON('permissions.json', {});

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (ALWAYS.has(permission)) return callback(true);
    const origin = originOf(details.requestingUrl || (wc && wc.getURL()));
    const key = `${origin}|${permission}`;
    if (key in perms) return callback(perms[key]);
    if (!win) return callback(false);
    const id = ++permSeq;
    const timer = setTimeout(() => {
      if (pendingPerms.delete(id)) { callback(false); send('perm:cancel', id); }
    }, 90000);
    pendingPerms.set(id, { callback, key, timer });
    send('perm:ask', {
      id, origin, permission, mediaTypes: details.mediaTypes || [],
      externalURL: details.externalURL || '', wcId: wc ? wc.id : 0,
    });
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => {
    if (ALWAYS.has(permission)) return true;
    return perms[`${originOf(origin)}|${permission}`] === true;
  });

  // Downloads go straight to the Downloads folder, Chrome-style.
  let dlSeq = 0;
  ses.on('will-download', (_e, item) => {
    const id = ++dlSeq;
    const name = item.getFilename() || 'download';
    const url = item.getURL();
    dlItems.set(id, item);
    const base = () => ({ id, name: item.getSavePath() ? path.basename(item.getSavePath()) : name, url, path: item.getSavePath() || '', total: item.getTotalBytes(), received: item.getReceivedBytes(), startedAt: Math.round(item.getStartTime() * 1000) || Date.now() });
    if (!prefs.downloadsAsk) {
      const dir = app.getPath('downloads');
      const ext = path.extname(name);
      const stem = path.basename(name, ext);
      let file = path.join(dir, name);
      for (let i = 1; fs.existsSync(file); i++) file = path.join(dir, `${stem} (${i})${ext}`);
      item.setSavePath(file);
    }
    // With "ask where to save", Electron shows the Save dialog itself; we report once a path is chosen.
    let announced = false;
    let last = 0;
    // Where the mouse was when the download began — the UI's download animation starts there.
    let cursor = null;
    try { const p = screen.getCursorScreenPoint(); const b = win.getContentBounds(); const z = win.webContents.getZoomFactor() || 1; cursor = { x: (p.x - b.x) / z, y: (p.y - b.y) / z }; } catch {}
    const announce = () => { if (!announced && item.getSavePath()) { announced = true; send('download', { ...base(), state: 'started', cursor }); } };
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
      const file = item.getSavePath();
      if (st === 'cancelled' && !file) return;
      let iconUrl = '';
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
  if (wantBlock) enableBlocking(ses);
  return ses;
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
    blocking: blockingMode,
    // set by the installer on a fresh install (not on updates) — the UI shows the welcome setup once
    installMarker: (() => { try { return fs.readFileSync(path.join(process.resourcesPath, 'fresh-install.txt'), 'utf8').trim() || null; } catch { return null; } })(),
  }));
  ipcMain.handle('state:load', () => readJSON('state.json', null));
  ipcMain.handle('app:changelog', () => { try { return fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8'); } catch { return ''; } });
  ipcMain.on('state:save', (e, s) => { if (restoringBackup || isAvocadoUi(e.sender)) return; try { writeJSON('state.json', s); } catch {} });
  ipcMain.on('state:save-sync', (e, s) => { if (!restoringBackup && !isAvocadoUi(e.sender)) { try { writeJSON('state.json', s); } catch {} } e.returnValue = true; });
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
      return f;
    } catch { return ''; }
  });
  ipcMain.on('shot:show', (_e, f) => { try { if (f) shell.showItemInFolder(f); else shell.openPath(path.join(app.getPath('pictures'), 'Oto Screenshots')); } catch {} });
  ipcMain.on('shot:open', (_e, f) => { try { if (f) shell.openPath(f); } catch {} });
  ipcMain.handle('qr:svg', async (_e, text) => { try { return await require('qrcode').toString(String(text || ''), { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1d1b26', light: '#ffffff' } }); } catch { return ''; } });
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
  // Backup & restore: one .oto file with your state; passwords are added only with a backup password.
  ipcMain.handle('backup:save', async (e, state, pass) => {
    const day = new Date().toISOString().slice(0, 10);
    const r = await dialog.showSaveDialog(winOf(e), { defaultPath: path.join(app.getPath('documents'), `Oto-backup-${day}.oto`), filters: [{ name: 'Oto backup', extensions: ['oto'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    const out = { oto: 'backup', v: 1, created: Date.now(), version: OTO_VERSION, state };
    if (pass) {
      const crypto = require('crypto');
      const list = pwLoad().entries.map((en) => ({ origin: en.origin, username: en.username, password: pwDec(en) }));
      const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
      const key = crypto.scryptSync(String(pass), salt, 32);
      const c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([c.update(JSON.stringify(list), 'utf8'), c.final()]);
      out.passwords = { n: list.length, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
    }
    const txt = JSON.stringify(out);
    fs.writeFileSync(r.filePath, txt);
    return { ok: true, path: r.filePath, size: txt.length, passwords: out.passwords ? out.passwords.n : 0 };
  });
  let pendingBackup = null;
  ipcMain.handle('backup:open', async (e) => {
    const r = await dialog.showOpenDialog(winOf(e), { properties: ['openFile'], filters: [{ name: 'Oto backup', extensions: ['oto'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const d = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
      if (d.oto !== 'backup' || !d.state) return { ok: false, error: 'This isn’t an Oto backup file.' };
      pendingBackup = d;
      const st = d.state;
      return { ok: true, created: d.created, version: d.version, spaces: (st.workspaces || []).length, tabs: (st.tabs || []).length, bookmarks: JSON.stringify(st.bookmarks || []).split('"url"').length - 1, passwords: d.passwords ? d.passwords.n : 0 };
    } catch { return { ok: false, error: 'Couldn’t read that file.' }; }
  });
  ipcMain.handle('backup:restore', async (_e, pass) => {
    const d = pendingBackup;
    if (!d) return { ok: false };
    let pw = 0;
    if (d.passwords && pass) {
      try {
        const crypto = require('crypto');
        const p = d.passwords;
        const key = crypto.scryptSync(String(pass), Buffer.from(p.salt, 'base64'), 32);
        const dc = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(p.iv, 'base64'));
        dc.setAuthTag(Buffer.from(p.tag, 'base64'));
        const list = JSON.parse(Buffer.concat([dc.update(Buffer.from(p.data, 'base64')), dc.final()]).toString('utf8'));
        for (const en of list) if (en.origin && en.password) { pwUpsert(en.origin, en.username || '', en.password); pw++; }
      } catch { return { ok: false, error: 'Wrong backup password.' }; }
    }
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
  ipcMain.on('shell:show', (_e, p) => { if (typeof p === 'string') shell.showItemInFolder(p); });
  ipcMain.on('clipboard:image', (_e, dataUrl) => { try { const img = nativeImage.createFromDataURL(String(dataUrl || '')); if (!img.isEmpty()) clipboard.writeImage(img); } catch {} });
  ipcMain.on('dl:action', (_e, id, act) => {
    const it = dlItems.get(id);
    if (!it) return;
    if (act === 'cancel') it.cancel();
    else if (act === 'pause') it.pause();
    else if (act === 'resume' && it.canResume()) it.resume();
  });
  ipcMain.handle('dl:open', async (_e, p) => {
    if (!p || !fs.existsSync(p)) return 'missing';
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
  ipcMain.handle('blocker:set', async (_e, on) => (on ? enableBlocking(ses) : disableBlocking(ses)));
  ipcMain.on('perm:reply', (_e, id, allow) => {
    const p = pendingPerms.get(id);
    if (!p) return;
    pendingPerms.delete(id);
    clearTimeout(p.timer);
    perms[p.key] = !!allow;
    try { writeJSON('permissions.json', perms); } catch {}
    p.callback(!!allow);
  });
  ipcMain.on('settings:sync', (_e, p) => {
    if (!p || typeof p !== 'object') return;
    const { keymap, ...rest } = p;
    const chBefore = prefs.updateChannel;
    prefs = { ...prefs, ...rest };
    if (updater && chBefore !== undefined && chBefore !== prefs.updateChannel) setTimeout(() => checkForUpdates(true), 300);
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
      if (!frozen) dbg.detach();
      return true;
    } catch { return false; }
  });
  ipcMain.handle('perm:list', () => perms);
  ipcMain.handle('perm:set', (_e, key, val) => {
    if (typeof key !== 'string' || !key.includes('|')) return perms;
    if (val === null || val === undefined) delete perms[key]; else perms[key] = !!val;
    try { writeJSON('permissions.json', perms); } catch {}
    return perms;
  });
  ipcMain.handle('site:clear', async (_e, origin) => {
    try {
      const o = new URL(origin).origin;
      await session.fromPartition(PARTITION).clearStorageData({ origin: o });
      for (const k of Object.keys(perms)) if (k.startsWith(`${o}|`)) delete perms[k];
      try { writeJSON('permissions.json', perms); } catch {}
      return true;
    } catch { return false; }
  });
  ipcMain.on('ctx:do', (_e, act, arg) => ctxAction(act, arg));
  ipcMain.handle('perm:reset', (_e, key) => {
    if (key) delete perms[key]; else perms = {};
    try { writeJSON('permissions.json', perms); } catch {}
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
    await ses.clearStorageData();
    await ses.clearCache();
    perms = {};
    try { writeJSON('permissions.json', perms); } catch {}
    return true;
  });
}

// ---------------------------------------------------------------- extensions (Chrome / Opera / Firefox)
let extensions = null;
let extReq = 0;
const extWaiters = new Map();
const MANUAL_EXT_FILE = 'extensions-manual.json';

function extApi(ses) { return ses.extensions || ses; }

// Part 1 — runs before the window opens, so the extension toolbar finds its handlers right away.
function initExtensionAPI(ses) {
  try {
    const { ElectronChromeExtensions } = require('electron-chrome-extensions');
    extensions = new ElectronChromeExtensions({
      session: ses,
      async createTab(details) {
        const id = ++extReq;
        const wcId = await new Promise((resolve, reject) => {
          extWaiters.set(id, resolve);
          send('ext:create-tab', { id, url: details.url || 'about:blank', active: details.active !== false });
          setTimeout(() => { if (extWaiters.delete(id)) reject(new Error('tab was not created')); }, 15000);
        });
        return [webContents.fromId(wcId), win];
      },
      selectTab(wc) { send('ext:select-tab', wc.id); },
      removeTab(wc) { send('ext:remove-tab', wc.id); },
      async createWindow(details) {
        for (const u of [].concat(details.url || [])) send('tab:open', { url: u, background: false });
        return win;
      },
      async removeWindow() { return win; },
    });
    ElectronChromeExtensions.handleCRXProtocol(session.defaultSession);
  } catch (err) {
    console.warn('[oto] extension APIs unavailable:', err && err.message);
  }
}

// Part 2 — after the window is up: load installed extensions (Web Store + files).
async function setupExtensions(ses) {
  if (extensions) {
    for (const wc of webContents.getAllWebContents()) {
      if (wc.getType() === 'webview' && !wc.isDestroyed() && win) { try { extensions.addTab(wc, win); } catch {} }
    }
  }
  try {
    const { installChromeWebStore } = require('electron-chrome-web-store');
    await installChromeWebStore({
      session: ses,
      extensionsPath: userFile('Extensions'),
      beforeInstall: async (details) => {
        const r = await dialog.showMessageBox(win, {
          type: 'question', buttons: ['Add extension', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true,
          title: 'Add extension', message: `Add “${details.localizedName}” to Oto?`,
          detail: 'It can read and change data on the sites it asks for, like it would in Chrome.',
          icon: details.icon,
        });
        if (r.response === 0) setTimeout(() => send('ext:changed'), 1500);
        return { action: r.response === 0 ? 'allow' : 'deny' };
      },
    });
  } catch (err) {
    console.warn('[oto] Chrome Web Store support unavailable:', err && err.message);
  }
  // Extensions installed from files / folders.
  for (const dir of readJSON(MANUAL_EXT_FILE, [])) {
    try { await extApi(ses).loadExtension(dir, { allowFileAccess: true }); } catch (err) { console.warn('[oto] could not load', dir, err && err.message); }
  }
  send('ext:changed');
}

// Unpack .crx (Chrome / Opera), .xpi (Firefox) or .zip into a folder Oto owns.
function unpackExtension(file) {
  const AdmZip = require('adm-zip');
  let buf = fs.readFileSync(file);
  if (buf.slice(0, 4).toString('latin1') === 'Cr24') {
    const version = buf.readUInt32LE(4);
    const start = version === 3 ? 12 + buf.readUInt32LE(8) : 16 + buf.readUInt32LE(8) + buf.readUInt32LE(12);
    buf = buf.slice(start);
  }
  const zip = new AdmZip(buf);
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) throw new Error('This file has no manifest.json — it isn’t a browser extension.');
  const manifest = JSON.parse(zip.readAsText(manifestEntry).replace(/^\uFEFF/, ''));
  const safe = String(manifest.name || 'extension').replace(/__MSG_.*__/, 'extension').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 40);
  const dir = path.join(userFile('Extensions-files'), `${safe}-${Date.now().toString(36)}`);
  fs.mkdirSync(dir, { recursive: true });
  zip.extractAllTo(dir, true);
  // Firefox-only manifest keys Chromium doesn't understand.
  const mf = path.join(dir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8').replace(/^\uFEFF/, ''));
  delete m.browser_specific_settings; delete m.applications;
  if (m.background && m.background.scripts && m.manifest_version === 3 && !m.background.service_worker) {
    // Firefox MV3 uses background scripts; Chromium needs a service worker that imports them.
    fs.writeFileSync(path.join(dir, '__oto_bg.js'), m.background.scripts.map((x) => `importScripts(${JSON.stringify(x)});`).join('\n'));
    m.background = { service_worker: '__oto_bg.js' };
  }
  fs.writeFileSync(mf, JSON.stringify(m, null, 2));
  return dir;
}

function setupExtensionIPC(ses) {
  ipcMain.on('ext:tab-ready', (_e, id, wcId) => {
    const done = extWaiters.get(id);
    if (done) { extWaiters.delete(id); done(wcId); }
  });
  ipcMain.on('ext:active', (_e, wcId) => {
    if (!extensions) return;
    const wc = webContents.fromId(wcId);
    if (wc && !wc.isDestroyed()) { try { extensions.selectTab(wc); } catch {} }
  });
  ipcMain.handle('ext:list', () => {
    const storeDir = userFile('Extensions');
    const iconOf = (x) => {
      try {
        const icons = (x.manifest && x.manifest.icons) || {};
        const best = Object.keys(icons).map(Number).sort((a, b) => b - a)[0];
        if (!best) return '';
        const img = nativeImage.createFromPath(path.join(x.path, icons[best]));
        return img.isEmpty() ? '' : img.resize({ width: 32, height: 32, quality: 'best' }).toDataURL();
      } catch { return ''; }
    };
    return extApi(ses).getAllExtensions().map((x) => ({
      id: x.id, name: x.name, version: x.version, path: x.path, icon: iconOf(x),
      description: (x.manifest && x.manifest.description) || '',
      options: (x.manifest && ((x.manifest.options_ui && x.manifest.options_ui.page) || x.manifest.options_page)) || '',
      source: x.path.startsWith(storeDir) ? 'store' : 'file',
    }));
  });
  ipcMain.handle('ext:install-file', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Add an extension file',
      filters: [{ name: 'Browser extensions', extensions: ['crx', 'xpi', 'zip'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const dir = unpackExtension(r.filePaths[0]);
      const ext = await extApi(ses).loadExtension(dir, { allowFileAccess: true });
      writeJSON(MANUAL_EXT_FILE, [...readJSON(MANUAL_EXT_FILE, []), dir]);
      return { ok: true, name: ext.name };
    } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('ext:load-folder', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Load an unpacked extension folder', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    try {
      const ext = await extApi(ses).loadExtension(r.filePaths[0], { allowFileAccess: true });
      writeJSON(MANUAL_EXT_FILE, [...new Set([...readJSON(MANUAL_EXT_FILE, []), r.filePaths[0]])]);
      return { ok: true, name: ext.name };
    } catch (err) { return { ok: false, error: err.message }; }
  });
  ipcMain.handle('ext:remove', async (_e, id) => {
    const ext = extApi(ses).getExtension(id);
    if (!ext) return false;
    const storeDir = userFile('Extensions');
    try {
      if (ext.path.startsWith(storeDir)) {
        const { uninstallExtension } = require('electron-chrome-web-store');
        await uninstallExtension(id, { session: ses, extensionsPath: storeDir });
      } else {
        extApi(ses).removeExtension(id);
        writeJSON(MANUAL_EXT_FILE, readJSON(MANUAL_EXT_FILE, []).filter((d) => d !== ext.path));
        if (ext.path.startsWith(userFile('Extensions-files'))) fs.rmSync(ext.path, { recursive: true, force: true });
      }
      return true;
    } catch { return false; }
  });
}

// ---------------------------------------------------------------- bookmark import
const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const CHROMIUM_BOOKMARKS = {
  chrome: ['Google Chrome', [path.join(local, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks')]],
  edge: ['Microsoft Edge', [path.join(local, 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks')]],
  brave: ['Brave', [path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Bookmarks')]],
  opera: ['Opera', [path.join(roaming, 'Opera Software', 'Opera Stable', 'Default', 'Bookmarks'), path.join(roaming, 'Opera Software', 'Opera Stable', 'Bookmarks')]],
  operagx: ['Opera GX', [path.join(roaming, 'Opera Software', 'Opera GX Stable', 'Default', 'Bookmarks'), path.join(roaming, 'Opera Software', 'Opera GX Stable', 'Bookmarks')]],
  vivaldi: ['Vivaldi', [path.join(local, 'Vivaldi', 'User Data', 'Default', 'Bookmarks')]],
};
const GECKO_PROFILES = {
  zen: ['Zen', path.join(roaming, 'zen', 'Profiles')],
  firefox: ['Firefox', path.join(roaming, 'Mozilla', 'Firefox', 'Profiles')],
};
function geckoPlaces(dir) {
  try {
    return fs.readdirSync(dir).map((p) => path.join(dir, p, 'places.sqlite')).filter((f) => fs.existsSync(f))
      .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0] || null;
  } catch { return null; }
}
function chromiumTree(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const conv = (n) => (n.type === 'folder'
    ? { title: n.name, children: (n.children || []).map(conv).filter(Boolean) }
    : n.url ? { title: n.name, url: n.url } : null);
  const bar = (j.roots.bookmark_bar.children || []).map(conv).filter(Boolean);
  const other = (j.roots.other && j.roots.other.children || []).map(conv).filter(Boolean);
  if (other.length) bar.push({ title: 'Other bookmarks', children: other });
  return bar;
}
function geckoTree(places) {
  const { DatabaseSync } = require('node:sqlite');
  const tmp = path.join(app.getPath('temp'), `oto-places-${Date.now()}.sqlite`);
  fs.copyFileSync(places, tmp); // Firefox/Zen keep the file locked while running
  for (const ext of ['-wal']) { try { fs.copyFileSync(places + ext, tmp + ext); } catch {} }
  const db = new DatabaseSync(tmp, { readOnly: true });
  try {
    const kids = db.prepare('SELECT b.id, b.type, b.title, p.url FROM moz_bookmarks b LEFT JOIN moz_places p ON p.id = b.fk WHERE b.parent = ? ORDER BY b.position');
    const walk = (parent, depth = 0) => kids.all(parent).map((r) => (r.type === 2
      ? (depth < 6 ? { title: r.title || 'Folder', children: walk(r.id, depth + 1) } : null)
      : r.url && /^https?:/.test(r.url) ? { title: r.title || r.url, url: r.url } : null)).filter(Boolean);
    const root = (guid) => { const r = db.prepare('SELECT id FROM moz_bookmarks WHERE guid = ?').get(guid); return r ? r.id : null; };
    const bar = walk(root('toolbar_____'));
    const other = walk(root('unfiled_____'));
    const menu = walk(root('menu________'));
    if (other.length) bar.push({ title: 'Other bookmarks', children: other });
    if (menu.length) bar.push({ title: 'Bookmarks menu', children: menu });
    return bar;
  } finally {
    db.close();
    for (const f of [tmp, `${tmp}-wal`]) { try { fs.unlinkSync(f); } catch {} }
  }
}

// ---------------------------------------------------------------- passwords
// Saved logins live in passwords.json, each password encrypted with Windows' own data protection
// (Electron safeStorage = DPAPI, the same thing Chrome uses). Nothing leaves the PC. The UI only
// ever gets usernames; a password is decrypted when you pick it to fill, copy or reveal.
const PW_FILE = 'passwords.json';
let PW = null;
const pwCanEncrypt = () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } };
function pwLoad() {
  if (PW) return PW;
  const d = readJSON(PW_FILE, null);
  PW = d && Array.isArray(d.entries) ? d : { v: 1, entries: [] };
  return PW;
}
function pwSave() { try { writeJSON(PW_FILE, PW); } catch {} }
function pwEnc(plain) {
  if (pwCanEncrypt()) return { enc: safeStorage.encryptString(String(plain)).toString('base64') };
  return { plain: Buffer.from(String(plain), 'utf8').toString('base64') }; // only where the OS offers no encryption
}
function pwDec(e) {
  try {
    if (e.enc) return safeStorage.decryptString(Buffer.from(e.enc, 'base64'));
    if (e.plain) return Buffer.from(e.plain, 'base64').toString('utf8');
  } catch {}
  return '';
}
const pwOrigin = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.origin : null; } catch { return null; } };
const pwSite = (origin) => { try { return new URL(origin).hostname.replace(/^www\./, ''); } catch { return origin; } };
const pwPublic = (e) => ({ id: e.id, origin: e.origin, site: pwSite(e.origin), username: e.username, created: e.created, updated: e.updated, lastUsed: e.lastUsed || 0 });
function pwFind(origin, username) { return pwLoad().entries.find((e) => e.origin === origin && e.username === username); }
function pwUpsert(origin, username, password) {
  const d = pwLoad();
  const now = Date.now();
  const ex = pwFind(origin, username);
  if (ex) {
    if (pwDec(ex) === password) { ex.lastUsed = now; pwSave(); return 'same'; }
    delete ex.enc; delete ex.plain;
    Object.assign(ex, pwEnc(password), { updated: now, lastUsed: now });
    pwSave(); return 'updated';
  }
  d.entries.push({ id: `pw${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`, origin, username, ...pwEnc(password), created: now, updated: now, lastUsed: now });
  pwSave(); return 'saved';
}
function csvParse(text) {
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const csvCell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
function setupPasswordIPC() {
  ipcMain.handle('pw:status', () => ({ encrypted: pwCanEncrypt(), count: pwLoad().entries.length }));
  ipcMain.handle('pw:list', () => pwLoad().entries.map(pwPublic).sort((a, b) => a.site.localeCompare(b.site) || a.username.localeCompare(b.username)));
  ipcMain.handle('pw:forOrigin', (_e, url) => { const o = pwOrigin(url); return o ? pwLoad().entries.filter((e) => e.origin === o).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0)).map(pwPublic) : []; });
  ipcMain.handle('pw:check', (_e, url, username, password) => {
    const o = pwOrigin(url);
    if (!o || !password) return 'invalid';
    const ex = pwFind(o, String(username || ''));
    if (!ex) return 'new';
    return pwDec(ex) === password ? 'same' : 'update';
  });
  ipcMain.handle('pw:save', (_e, url, username, password) => { const o = pwOrigin(url); return o && password ? pwUpsert(o, String(username || ''), String(password)) : 'invalid'; });
  ipcMain.handle('pw:get', (_e, id) => { const e = pwLoad().entries.find((x) => x.id === id); if (!e) return null; e.lastUsed = Date.now(); pwSave(); return { username: e.username, password: pwDec(e), origin: e.origin }; });
  ipcMain.handle('pw:update', (_e, id, patch) => {
    const e = pwLoad().entries.find((x) => x.id === id);
    if (!e || !patch) return false;
    if (typeof patch.username === 'string') e.username = patch.username;
    if (typeof patch.url === 'string' && pwOrigin(patch.url)) e.origin = pwOrigin(patch.url);
    if (typeof patch.password === 'string' && patch.password) { delete e.enc; delete e.plain; Object.assign(e, pwEnc(patch.password)); }
    e.updated = Date.now(); pwSave(); return true;
  });
  ipcMain.handle('pw:delete', (_e, id) => { const d = pwLoad(); const n = d.entries.length; d.entries = d.entries.filter((x) => x.id !== id); pwSave(); return d.entries.length < n; });
  ipcMain.handle('pw:import', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Import passwords (CSV from Chrome, Edge, Brave, Opera or Firefox)', filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const rows = csvParse(fs.readFileSync(r.filePaths[0], 'utf8').replace(/^﻿/, ''));
    if (!rows.length) return { added: 0, updated: 0 };
    const head = rows[0].map((x) => x.trim().toLowerCase());
    const col = (...names) => head.findIndex((h) => names.includes(h));
    const iu = col('url', 'origin', 'login_uri', 'website'), iuser = col('username', 'login_username', 'login', 'user'), ip = col('password', 'login_password');
    if (iu < 0 || ip < 0) return { error: 'This file doesn’t look like a password export (it needs url and password columns).' };
    let added = 0, updated = 0;
    for (const row of rows.slice(1)) {
      const o = pwOrigin(row[iu]); const pass = row[ip];
      if (!o || !pass) continue;
      const res = pwUpsert(o, iuser >= 0 ? row[iuser] || '' : '', pass);
      if (res === 'saved') added++; else if (res === 'updated') updated++;
    }
    return { added, updated };
  });
  ipcMain.handle('pw:export', async () => {
    const r = await dialog.showSaveDialog(win, { title: 'Export passwords', defaultPath: path.join(app.getPath('documents'), 'Oto Passwords.csv'), filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (r.canceled || !r.filePath) return false;
    const lines = ['name,url,username,password', ...pwLoad().entries.map((e) => [pwSite(e.origin), e.origin, e.username, pwDec(e)].map(csvCell).join(','))];
    fs.writeFileSync(r.filePath, lines.join('\n'));
    return true;
  });
}

function setupBookmarkIPC() {
  ipcMain.handle('bm:sources', () => {
    const out = [];
    for (const [k, [name, files]] of Object.entries(CHROMIUM_BOOKMARKS)) if (files.some((f) => fs.existsSync(f))) out.push({ id: k, name });
    for (const [k, [name, dir]] of Object.entries(GECKO_PROFILES)) if (geckoPlaces(dir)) out.push({ id: k, name });
    return out;
  });
  ipcMain.handle('bm:import', (_e, id) => {
    try {
      if (CHROMIUM_BOOKMARKS[id]) return { ok: true, tree: chromiumTree(CHROMIUM_BOOKMARKS[id][1].find((f) => fs.existsSync(f))) };
      if (GECKO_PROFILES[id]) return { ok: true, tree: geckoTree(geckoPlaces(GECKO_PROFILES[id][1])) };
      return { ok: false, error: 'Browser not found' };
    } catch (err) { return { ok: false, error: err.message }; }
  });
}

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
    send('tab:open', { url: url || null, background: false, external: !!url });
  });

  app.whenReady().then(() => {
    const ses = setupSession();
    setupIPC(ses);
    setupExtensionIPC(ses);
    setupBookmarkIPC();
    setupPasswordIPC();
    setupWindowIPC();
    initExtensionAPI(ses);
    createWindow();
    { const a = appArg(process.argv); if (a) setTimeout(() => openAppWindow(a), 1200); }
    win.webContents.once('did-finish-load', () => setupExtensions(ses));
  });

  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(() => setupUpdates());

  // "Clear cookies & site data when Oto closes"
  let cleared = false;
  app.on('before-quit', (e) => {
    if (!prefs.clearOnExit || cleared) return;
    e.preventDefault();
    cleared = true;
    const ses = session.fromPartition(PARTITION);
    Promise.race([
      Promise.all([ses.clearStorageData(), ses.clearCache()]),
      new Promise((r) => setTimeout(r, 3000)),
    ]).finally(() => app.quit());
  });
}
