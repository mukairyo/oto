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
const { checkArgs } = require('./ipc-schema.js');

const OPEN = /^(oto:page$|crx-|@ghostery\/|chromeWebstore\.|chrome\.)/;
// Size limits per message (counted like memory: 2 bytes per character): 1 MB normally; only the channels that carry
// Oto's whole saved state (or an image) may send more.
const LIMIT = 2 * 1024 * 1024;
const BIG = { 'state:save': 128, 'state:save-sync': 128, 'backup:save': 128, 'account:push': 64, 'settings:sync': 16, 'clipboard:image': 64, 'shot:save': 128, 'app:icon': 16, 'app:install': 16, 'diag:save': 16, 'shield:filters': 16, 'devices:beat': 8 };

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
  // Measures the whole message, however deeply nested, without re-serializing it, and stops as soon as it is over the
  // limit (so a huge message costs no more to refuse than a small one). Also refuses very deep nesting and odd types.
  function tooBig(channel, args) {
    const max = (BIG[channel] || 0) * 1024 * 1024 || LIMIT;
    let n = 0, seen = 0;
    const stack = args.map((v) => [v, 0]);
    while (stack.length) {
      const [v, depth] = stack.pop();
      if (++seen > 2e6 || depth > 64) return true;
      if (v == null || typeof v === 'boolean') n += 4;
      else if (typeof v === 'number') n += 8;
      else if (typeof v === 'string') n += v.length * 2;
      else if (Buffer.isBuffer(v) || ArrayBuffer.isView(v)) n += v.byteLength;
      else if (Array.isArray(v)) { n += 8; for (let i = v.length - 1; i >= 0; i--) stack.push([v[i], depth + 1]); }
      else if (typeof v === 'object') { n += 8; for (const k of Object.keys(v)) { n += k.length * 2; stack.push([v[k], depth + 1]); } }
      else return true; // functions, symbols, bigints never come from Oto's window
      if (n > max) return true;
    }
    return false;
  }
  const refuse = (ch, e) => {
    if (!refused.has(ch)) { refused.add(ch); console.warn(`[oto] refused "${ch}" from ${(() => { try { return `${e.sender.getType()} ${new URL(e.senderFrame.url).origin}`; } catch { return 'unknown'; } })()}`); } // origin only: full addresses can hold tokens
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
    // sender -> size -> shape (main/ipc-schema.js: per-channel argument rules + no prototype keys)
    const ok = (e, args) => trusted(e) && !tooBig(channel, args) && !checkArgs(channel, args);
    const guarded = kind === 'handle'
      ? (e, ...args) => { if (!ok(e, args)) { refuse(channel, e); throw new Error('Not allowed'); } return fn(e, ...args); }
      : (e, ...args) => { if (!ok(e, args)) { refuse(channel, e); e.returnValue = null; return; } return fn(e, ...args); };
    return orig.call(ipcMain, channel, guarded);
  };
  ipcMain.handle = wrap('handle', ipcMain.handle);
  ipcMain.handleOnce = wrap('handle', ipcMain.handleOnce);
  ipcMain.on = wrap('on', ipcMain.on);
  ipcMain.once = wrap('on', ipcMain.once);
  return { trusted };
};
