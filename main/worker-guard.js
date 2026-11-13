'use strict';
// Fingerprint protection inside background workers.
//
// A page can start a background worker (a script without a page) and draw on an off-screen canvas or WebGL there.
// Oto's page preload doesn't run in workers, so before 1.6.0 a worker read the real values, and Oto couldn't change
// anything else a worker can also read (CPU cores): a page that sees two different answers treats the browser as a
// bot.
//
// Chromium can hold a new worker before its first line runs. Oto watches every tab through Chromium's own debugging
// connection (the one Oto already uses for full-page screenshots and for freezing background tabs), and when a
// worker starts it runs the same protection code the page got (page-preload.js otoFarble, same per-site number)
// inside the worker, then lets the worker go. Workers inside frames from other sites and workers started by workers
// are covered the same way. Nothing is read from the page or the worker, and nothing is sent anywhere.
//
// Only what the page itself would get is applied: nothing with fingerprint protection off, with Shield off for the
// site, or inside "are you human?" checks (decided by protectionFor in main.js).
const { otoFarble } = require('../page-preload.js');

const SRC = otoFarble.toString();
// Service workers are not changed here: Chromium can't run code in one while it's held, and they get the protection
// through their own preload instead (page-preload.js, registered in main.js). Shared workers aren't reported to a tab
// at all; they are the one kind of worker that still reads real values (see docs/PRIVACY_PROTECTION.md).
const KINDS = new Set(['worker', 'shared_worker']);
const watched = new WeakSet();

// protectionFor(workerUrl, wc) -> per-site number, or 0 for "leave this worker alone"
function guard(wc, protectionFor) {
  if (!wc || wc.isDestroyed() || watched.has(wc)) return false;
  const dbg = wc.debugger;
  try { if (!dbg.isAttached()) dbg.attach('1.3'); } catch (e) { console.warn('[oto] worker protection unavailable for this tab:', e && e.message); return false; }
  watched.add(wc);
  // every step has a time limit: whatever happens, a held worker or frame is let go within a second or two
  const send = (method, params, sessionId) => Promise.race([dbg.sendCommand(method, params || {}, sessionId).catch(() => null), new Promise((r) => setTimeout(r, 1500, null))]);
  const AUTO = { autoAttach: true, waitForDebuggerOnStart: true, flatten: true };
  dbg.on('message', async (_e, method, params) => {
    if (method !== 'Target.attachedToTarget' || !params || !params.sessionId) return;
    const sid = params.sessionId, info = params.targetInfo || {};
    try {
      // anything this new target starts (a worker's own workers, a frame's workers) is held the same way
      await send('Target.setAutoAttach', AUTO, sid);
      if (KINDS.has(info.type)) {
        const seed = protectionFor(String(info.url || ''), wc);
        if (seed) await send('Runtime.evaluate', { expression: `(${SRC})(${seed >>> 0})`, silent: true, includeCommandLineAPI: false, returnByValue: true }, sid);
      }
    } catch (e) {} finally {
      if (params.waitingForDebugger) send('Runtime.runIfWaitingForDebugger', {}, sid); // never leave a worker or frame held
    }
  });
  dbg.on('detach', () => watched.delete(wc));
  send('Target.setAutoAttach', AUTO);
  return true;
}

const isGuarded = (wc) => !!wc && watched.has(wc);

module.exports = { guard, isGuarded };
