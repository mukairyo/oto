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
      const { installChromeWebStore } = require('electron-chrome-web-store');
      await installChromeWebStore({
        session: ses,
        extensionsPath: userFile('Extensions'),
        beforeInstall: async (details) => {
          const r = await dialog.showMessageBox(ctx.win, {
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
      const r = await dialog.showOpenDialog(ctx.win, {
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
      const r = await dialog.showOpenDialog(ctx.win, { title: 'Load an unpacked extension folder', properties: ['openDirectory'] });
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

  return { get extensions() { return extensions; }, initExtensionAPI, setupExtensions, setupExtensionIPC };
};
