'use strict';
// Oto — one gatekeeper for every message channel between Oto's window and its main process (audit item 04).
// Every handler Oto registers only answers messages from Oto's own window UI: the top frame of a window that is
// showing Oto's src/index.html (normal or private window). Messages from web pages, frames inside pages,
// extension pages or Oto-app windows are refused before the handler runs.
// A few channels are meant for pages and libraries and stay open; each validates its own input:
//   oto:page        page-preload.js asks once per frame what protection applies (returns flags only)
//   crx-*           electron-chrome-extensions (extension APIs, checks its own senders)
//   @ghostery/*     the ad blocker's cosmetic filters
//   chromeWebstore.* / chrome.*   electron-chrome-web-store (only answers the Chrome Web Store's own origin)
// Reviewed for 1.3.2: oto:page returns only flags about the asking frame; the web-store library checks
// event.senderFrame.origin; crx-* calls are routed to the extension they name; @ghostery/* only returns
// cosmetic filters for the URL of the frame that asks. None of them read or change Oto's own data.
const path = require('path');
const { pathToFileURL } = require('url');

const OPEN = /^(oto:page$|crx-|@ghostery\/|chromeWebstore\.|chrome\.)/;
// Size limits per message: 1 MB normally; only the channels that carry Oto's whole saved state (or an image) may
// send more. Strings are measured directly; objects are measured only up to the limit.
const LIMIT = 1024 * 1024;
const BIG = { 'state:save': 64, 'state:save-sync': 64, 'backup:save': 64, 'account:push': 32, 'settings:sync': 8, 'clipboard:image': 32, 'app:icon': 8, 'diag:save': 8 };

module.exports = function guardIPC(ipcMain, appDir) {
  const UI = pathToFileURL(path.join(appDir, 'src', 'index.html')).href;
  const refused = new Set();
  function trusted(e) {
    try {
      const wc = e.sender;
      if (!wc || wc.isDestroyed() || wc.getType() !== 'window') return false;
      const f = e.senderFrame;
      if (!f || f.parent) return false; // only the window's own top frame
      return String(f.url || '').split(/[?#]/)[0] === UI;
    } catch { return false; }
  }
  function tooBig(channel, args) {
    const max = (BIG[channel] || 0) * 1024 * 1024 || LIMIT;
    let n = 0;
    for (const a of args) {
      if (typeof a === 'string') n += a.length;
      else if (a && typeof a === 'object') {
        if (!BIG[channel]) { try { n += JSON.stringify(a).length; } catch { return true; } } // small channels: cheap
        else if (Array.isArray(a) ? a.length > 1e6 : Object.keys(a).length > 1e5) return true; // big ones: no full re-serialization
      }
      if (n > max) return true;
    }
    return false;
  }
  const refuse = (ch, e) => {
    if (!refused.has(ch)) { refused.add(ch); console.warn(`[oto] refused "${ch}" from ${(() => { try { return e.sender.getType() + ' ' + e.senderFrame.url; } catch { return 'unknown'; } })()}`); }
  };
  // The ad blocker registers the same two handlers once per session it protects. Electron allows only one
  // handler per channel, so the second session's setup threw halfway (that session got no network blocking),
  // and switching one session off removed them for all. Shared here with a count instead.
  const SHARED = /^@ghostery\//;
  const sharedCount = new Map();
  const origRemove = ipcMain.removeHandler.bind(ipcMain);
  ipcMain.removeHandler = function (channel) {
    if (SHARED.test(channel) && sharedCount.has(channel)) {
      const n = sharedCount.get(channel) - 1;
      if (n > 0) { sharedCount.set(channel, n); return; }
      sharedCount.delete(channel);
    }
    return origRemove(channel);
  };
  const wrap = (kind, orig) => function (channel, fn) {
    if (kind === 'handle' && SHARED.test(channel) && typeof fn === 'function') {
      const n = sharedCount.get(channel) || 0;
      if (n > 0) origRemove(channel); // newest wins (all of them call the same blocker)
      sharedCount.set(channel, n + 1);
      return orig.call(ipcMain, channel, fn);
    }
    if (OPEN.test(channel) || typeof fn !== 'function') return orig.call(ipcMain, channel, fn);
    const guarded = kind === 'handle'
      ? (e, ...args) => { if (!trusted(e) || tooBig(channel, args)) { refuse(channel, e); throw new Error('Not allowed'); } return fn(e, ...args); }
      : (e, ...args) => { if (!trusted(e) || tooBig(channel, args)) { refuse(channel, e); e.returnValue = null; return; } return fn(e, ...args); };
    return orig.call(ipcMain, channel, guarded);
  };
  ipcMain.handle = wrap('handle', ipcMain.handle);
  ipcMain.handleOnce = wrap('handle', ipcMain.handleOnce);
  ipcMain.on = wrap('on', ipcMain.on);
  ipcMain.once = wrap('on', ipcMain.once);
  return { trusted };
};
