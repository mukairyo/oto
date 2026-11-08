'use strict';
// Oto — Chrome / Opera / Firefox extensions (moved out of main.js).
const { ipcMain, dialog, nativeImage, session, webContents } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function createExtensions(ctx) {
  const { readJSON, writeJSON, userFile, send } = ctx;

  let extensions = null;
  let extReq = 0;
  const extWaiters = new Map();
  const MANUAL_EXT_FILE = 'extensions-manual.json';

  function extApi(ses) { return ses.extensions || ses; }
  // true if `p` is inside folder `dir` (not just a name that starts the same: "Extensions-files" isn't in "Extensions")
  const inside = (dir, p) => { const r = path.relative(dir, String(p || '')); return !!r && !r.startsWith('..') && !path.isAbsolute(r); };

  // The Web Store library downloads extensions (installs and updates) with the global fetch and doesn't check their
  // signatures. Every extension package it receives is checked here first (main/crx-verify.js): CRX3 only, signed by
  // the extension's own key AND by the Chrome Web Store, every signature valid. Anything else never reaches the disk.
  function guardCrxDownloads() {
    if (typeof globalThis.fetch !== 'function' || globalThis.fetch.otoCrxGuard) return;
    const { verifyCrx } = require('./crx-verify.js');
    const orig = globalThis.fetch;
    const guarded = async (input, init) => {
      const res = await orig(input, init);
      const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (method !== 'GET' || !res.ok || res.status === 204 || !res.body) return res;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'Cr24') {
        try { verifyCrx(buf, { requireWebStore: true }); } catch (err) {
          console.warn('[oto] extension package refused:', err.message);
          send('ext:refused', err.message);
          return new Response(null, { status: 403, statusText: 'Refused by Oto' });
        }
      }
      return new Response(buf, { status: res.status, statusText: res.statusText, headers: res.headers });
    };
    guarded.otoCrxGuard = true;
    globalThis.fetch = guarded;
  }

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
          return [webContents.fromId(wcId), ctx.win];
        },
        selectTab(wc) { send('ext:select-tab', wc.id); },
        removeTab(wc) { send('ext:remove-tab', wc.id); },
        async createWindow(details) {
          for (const u of [].concat(details.url || [])) send('tab:open', { url: u, background: false });
          return ctx.win;
        },
        async removeWindow() { return ctx.win; },
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
        if (wc.getType() === 'webview' && !wc.isDestroyed() && ctx.win) { try { extensions.addTab(wc, ctx.win); } catch {} }
      }
    }
    try {
      guardCrxDownloads();
      const { installChromeWebStore } = require('electron-chrome-web-store');
      await installChromeWebStore({
        session: ses,
        extensionsPath: userFile('Extensions'),
        beforeInstall: async (details) => {
          const r = await dialog.showMessageBox(ctx.win, {
            type: 'question', buttons: ['Add extension', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true,
            title: 'Add extension', message: `Add “${details.localizedName}” to Oto?`,
            detail: `From the Chrome Web Store. It asks to:\n${manifestPermissions(details.manifest).text}\n\nOto keeps it updated from the Web Store, and checks every download is signed by its developer and by the Chrome Web Store.`,
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
      // File access (reading file:// pages) stays off for extensions added from files or folders.
      try { await extApi(ses).loadExtension(dir, { allowFileAccess: false }); } catch (err) { console.warn('[oto] could not load', dir, err && err.message); }
    }
    send('ext:changed');
  }

  // Unpack .crx (Chrome / Opera), .xpi (Firefox) or .zip into a folder Oto owns.
  // Archives are checked before anything is written: size limits (no "zip bombs"), and every file must land
  // inside the new folder (no "../" tricks, absolute paths or links that point elsewhere).
  function unpackExtension(file) {
    const { readArchive, extractTo } = require('./safe-unzip.js');
    const { plan, manifest } = readArchive(file);
    const safe = String(manifest.name || 'extension').replace(/__MSG_.*__/, 'extension').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 40);
    const dir = path.join(userFile('Extensions-files'), `${safe}-${Date.now().toString(36)}`);
    try {
      extractTo(plan, dir);
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
    } catch (err) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} throw err; }
    return dir;
  }
  // What an extension asks for, in words, shown before it's added from a file or folder.
  function permissionText(dir) {
    let m = {};
    try { m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')); } catch {}
    return manifestPermissions(m);
  }
  function manifestPermissions(m) {
    m = m && typeof m === 'object' ? m : {};
    const hosts = [...(m.host_permissions || []), ...(m.permissions || []).filter((p) => /[:/*]/.test(p)), ...((m.content_scripts || []).flatMap((c) => c.matches || []))];
    const all = hosts.some((h) => /^(<all_urls>|\*:\/\/\*\/\*|https?:\/\/\*\/\*)$/.test(h));
    const api = (m.permissions || []).filter((p) => !/[:/*]/.test(p));
    const lines = [];
    lines.push(all ? '• Read and change everything on every website you visit' : hosts.length ? `• Read and change data on: ${[...new Set(hosts)].slice(0, 6).join(', ')}${hosts.length > 6 ? ' …' : ''}` : '• No website access requested');
    const words = { tabs: 'see your open tabs', history: 'read and change your history', cookies: 'read and change cookies', webRequest: 'see what pages load', downloads: 'manage downloads', clipboardRead: 'read your clipboard', nativeMessaging: 'talk to programs on your PC', debugger: 'control pages with the debugger', management: 'manage other extensions', proxy: 'change your proxy settings', privacy: 'change privacy settings', bookmarks: 'read and change bookmarks' };
    const risky = api.filter((p) => words[p]).map((p) => words[p]);
    if (risky.length) lines.push(`• Also: ${risky.join(', ')}`);
    return { name: String(m.name || 'This extension').replace(/__MSG_.*__/, 'This extension'), version: m.version || '', text: lines.join('\n') };
  }
  async function confirmAdd(dir, source) {
    const p = permissionText(dir);
    const r = await dialog.showMessageBox(ctx.win, {
      type: 'warning', buttons: ['Cancel', 'Add extension'], defaultId: 0, cancelId: 0, noLink: true, title: 'Add extension',
      message: `Add “${p.name}”${p.version ? ` ${p.version}` : ''} from ${source}?`,
      detail: `It isn’t from the Chrome Web Store, so nobody has reviewed it. Only add it if you trust where it came from.\n\nIt asks to:\n${p.text}`,
    });
    return r.response === 1;
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
        source: inside(storeDir, x.path) ? 'store' : 'file',
      }));
    });
    ipcMain.handle('ext:install-file', async () => {
      const r = await dialog.showOpenDialog(ctx.win, {
        title: 'Add an extension file',
        filters: [{ name: 'Browser extensions', extensions: ['crx', 'xpi', 'zip'] }],
        properties: ['openFile'],
      });
      if (r.canceled || !r.filePaths[0]) return { ok: false };
      let dir = null;
      try {
        dir = unpackExtension(r.filePaths[0]);
        if (!(await confirmAdd(dir, 'a file'))) { fs.rmSync(dir, { recursive: true, force: true }); return { ok: false }; }
        const ext = await extApi(ses).loadExtension(dir, { allowFileAccess: false });
        writeJSON(MANUAL_EXT_FILE, [...readJSON(MANUAL_EXT_FILE, []), dir]);
        return { ok: true, name: ext.name };
      } catch (err) { if (dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} } return { ok: false, error: err.message }; }
    });
    ipcMain.handle('ext:load-folder', async () => {
      const r = await dialog.showOpenDialog(ctx.win, { title: 'Load an unpacked extension folder', properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths[0]) return { ok: false };
      try {
        if (!fs.existsSync(path.join(r.filePaths[0], 'manifest.json'))) return { ok: false, error: 'That folder has no manifest.json — it isn’t an extension.' };
        if (!(await confirmAdd(r.filePaths[0], 'a folder'))) return { ok: false };
        const ext = await extApi(ses).loadExtension(r.filePaths[0], { allowFileAccess: false });
        writeJSON(MANUAL_EXT_FILE, [...new Set([...readJSON(MANUAL_EXT_FILE, []), r.filePaths[0]])]);
        return { ok: true, name: ext.name };
      } catch (err) { return { ok: false, error: err.message }; }
    });
    ipcMain.handle('ext:remove', async (_e, id) => {
      const ext = extApi(ses).getExtension(id);
      if (!ext) return false;
      const storeDir = userFile('Extensions');
      try {
        if (inside(storeDir, ext.path)) {
          const { uninstallExtension } = require('electron-chrome-web-store');
          await uninstallExtension(id, { session: ses, extensionsPath: storeDir });
        } else {
          extApi(ses).removeExtension(id);
          writeJSON(MANUAL_EXT_FILE, readJSON(MANUAL_EXT_FILE, []).filter((d) => d !== ext.path));
          if (inside(userFile('Extensions-files'), ext.path)) fs.rmSync(ext.path, { recursive: true, force: true });
        }
        return true;
      } catch { return false; }
    });
  }

  return { get extensions() { return extensions; }, initExtensionAPI, setupExtensions, setupExtensionIPC, guardCrxDownloads, _inside: inside };
};
