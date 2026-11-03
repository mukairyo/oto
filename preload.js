// Oto — bridge between the browser UI and the main process.
const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = new Set([
  'cmd', 'tab:open', 'search', 'blocked', 'download', 'perm:ask', 'perm:cancel', 'window-fullscreen', 'overlay-sampled',
  'win-state', 'page-mouse', 'ext:create-tab', 'ext:select-tab', 'ext:remove-tab', 'ext:changed', 'glance', 'update',
]);

contextBridge.exposeInMainWorld('oto', {
  info: () => ipcRenderer.invoke('app:info'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (s) => ipcRenderer.send('state:save', s),
  saveStateSync: (s) => ipcRenderer.sendSync('state:save-sync', s),
  setOverlay: (color, symbol, height) => ipcRenderer.send('win:overlay', { color, symbol, height }),
  captureStrip: (height) => ipcRenderer.invoke('win:capture-strip', height),
  pauseKeys: (on) => ipcRenderer.send('keys:pause', on),
  relaunch: () => ipcRenderer.send('app:relaunch'),
  metrics: () => ipcRenderer.invoke('perf:metrics'),
  freezeTab: (wcId, frozen) => ipcRenderer.invoke('tab:freeze', wcId, frozen),
  setTheme: (t) => ipcRenderer.send('theme:set', t),
  copy: (text) => ipcRenderer.send('clipboard:write', text),
  copyImage: (dataUrl) => ipcRenderer.send('clipboard:image', dataUrl),
  suggest: (engine, q) => ipcRenderer.invoke('suggest', engine, q),
  setBlocking: (on) => ipcRenderer.invoke('blocker:set', on),
  replyPermission: (id, allow) => ipcRenderer.send('perm:reply', id, allow),
  showInFolder: (p) => ipcRenderer.send('shell:show', p),
  dlAction: (id, act) => ipcRenderer.send('dl:action', id, act),
  dlOpen: (p) => ipcRenderer.invoke('dl:open', p),
  dlExists: (paths) => ipcRenderer.invoke('dl:exists', paths),
  clearData: () => ipcRenderer.invoke('data:clear'),
  syncSettings: (p) => ipcRenderer.send('settings:sync', p),
  listPermissions: () => ipcRenderer.invoke('perm:list'),
  resetPermission: (key) => ipcRenderer.invoke('perm:reset', key),
  setAppIcon: (dataUrl) => ipcRenderer.send('app:icon', dataUrl),
  makeDefaultBrowser: () => ipcRenderer.invoke('app:default-browser'),
  // window buttons
  winMin: () => ipcRenderer.send('win:min'),
  winMax: () => ipcRenderer.send('win:max'),
  winClose: () => ipcRenderer.send('win:close'),
  cursor: () => ipcRenderer.invoke('win:cursor'),
  diagInfo: () => ipcRenderer.invoke('diag:info'),
  saveReport: (text) => ipcRenderer.invoke('diag:save', text),
  updateStatus: () => ipcRenderer.invoke('update:status'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.send('update:install'),
  // extensions
  extTabReady: (id, wcId) => ipcRenderer.send('ext:tab-ready', id, wcId),
  extActive: (wcId) => ipcRenderer.send('ext:active', wcId),
  extList: () => ipcRenderer.invoke('ext:list'),
  extInstallFile: () => ipcRenderer.invoke('ext:install-file'),
  extLoadFolder: () => ipcRenderer.invoke('ext:load-folder'),
  extRemove: (id) => ipcRenderer.invoke('ext:remove', id),
  // bookmarks import
  bookmarkSources: () => ipcRenderer.invoke('bm:sources'),
  importBookmarks: (id) => ipcRenderer.invoke('bm:import', id),
  on: (channel, fn) => {
    if (CHANNELS.has(channel)) ipcRenderer.on(channel, (_e, ...args) => fn(...args));
  },
});

// The extension toolbar element (<browser-action-list>) used in Oto's top strip.
try {
  require('electron-chrome-extensions/browser-action').injectBrowserAction();
} catch (err) {
  console.warn('[oto] extension toolbar unavailable', err && err.message);
}
