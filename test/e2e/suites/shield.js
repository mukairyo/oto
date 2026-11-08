'use strict';
// Oto Shield blocks trackers in the main window, in Spaces and in private windows, and turns off and on everywhere.
const { BrowserWindow, session } = require('electron');
module.exports = async (t) => {
  const mode = JSON.parse(await t.js('oto.shield.state().then((s) => JSON.stringify(s))'));
  t.check('Shield runs its full filter engine', mode.mode === 'full', JSON.stringify(mode));
  if (mode.mode !== 'full') return;
  const probe = async (wc) => wc.executeJavaScript("fetch('http://tracker.site/analytics.js?' + Math.random(), { mode: 'no-cors' }).then(() => 'loaded', () => 'blocked')");
  const inPart = async (part) => { const w = new BrowserWindow({ show: false, webPreferences: { partition: part, sandbox: true } }); await w.loadURL('http://fine.site/').catch(() => {}); const r = await probe(w.webContents); w.destroy(); return r; };
  t.check('control: the tracker loads in a session Shield doesn’t cover', (await inPart('e2e-unblocked')) === 'loaded');
  await t.js("(() => { S.workspaces.push({ id: 'e2e', name: 'Work', emoji: '', image: '', color: '#888888', colors: ['#888888'], intensity: .8, grain: .1, v1Own: true }); save(); return 1; })()");
  await t.js("(oto.openAvocado(), 1)"); await t.sleep(4000);
  await t.js("(switchWorkspace('e2e'), 1)"); await t.open('http://fine.site/'); await t.js(`(switchWorkspace(S.workspaces[0].id), 1)`); await t.sleep(800);
  for (const part of ['persist:oto', 'persist:oto-ws-e2e', 'avocado']) t.check(`tracker blocked (${part})`, (await inPart(part)) === 'blocked');
  await t.js('oto.setBlocking(false)'); await t.sleep(800);
  for (const part of ['persist:oto', 'persist:oto-ws-e2e', 'avocado']) t.check(`Shield off reaches ${part}`, (await inPart(part)) === 'loaded');
  await t.js('oto.setBlocking(true)'); await t.sleep(800);
  for (const part of ['persist:oto', 'persist:oto-ws-e2e', 'avocado']) t.check(`Shield back on reaches ${part}`, (await inPart(part)) === 'blocked');
  void session;
};

// Offline: a tiny filter engine (one rule for the test tracker) in the cache file Oto reads, so no list download is needed.
// Same file name and format Oto writes after downloading the real lists (Balanced level).
module.exports.seed = {
  'adblock-engine.bin': () => Buffer.from(require('@ghostery/adblocker').FiltersEngine.parse('||tracker.site^').serialize()),
};
