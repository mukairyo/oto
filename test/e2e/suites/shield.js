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
  // What an ad-block tester checks on its own page (a local copy, see server.js): Oto stops the two stand-in ad
  // scripts and hides the ad-shaped boxes, and leaves the page's normal script, box and picture alone.
  const tester = async (url) => { await t.open(url, 4500); return JSON.parse((await t.page('JSON.stringify(window.__res)')) || '{}'); };
  const on = await tester('http://adblock.turtlecute.org/');
  t.check('ad-block tester: the ads.js script is blocked', on.adsBlocked === true, JSON.stringify(on));
  t.check('ad-block tester: the pagead.js script is blocked', on.pageadBlocked === true);
  t.check('ad-block tester: the ad box in the page is hidden', on.staticHidden === true);
  t.check('ad-block tester: an ad box added later is hidden', on.dynamicHidden === true);
  t.check('…and the page\'s normal script, box and picture are untouched', on.appLoaded === true && on.normalBoxShown === true && on.pictureLoaded === true, JSON.stringify(on));
  const other = await tester('http://adtest.site/');
  t.check('on any other site: ad widget scripts are blocked, a file that is only named pagead.js is not', other.adsBlocked === true && other.pageadBlocked === false && other.appLoaded === true, JSON.stringify(other));
  // Updating the filter lists (the Update now / Refresh buttons, and once a day by itself) never leaves a gap: with no
  // internet here the download fails, and the lists Oto has keep blocking in every session.
  const up = JSON.parse(await t.js('oto.shield.update().then((r) => JSON.stringify(r))'));
  const after = [];
  for (const part of ['persist:oto', 'persist:oto-ws-e2e', 'avocado']) after.push(await inPart(part));
  // the Shield pop-up on a page: when the lists were updated, and a Refresh button
  await t.open('http://fine.site/', 1500);
  await t.js('v1ShieldMenu(), 1'); await t.sleep(700);
  const pop = JSON.parse(await t.js("JSON.stringify((() => { const l = document.querySelector('.v1-shield .lists'); return { row: !!l, text: l ? l.textContent : '', btn: l ? l.querySelector('button').textContent : '' }; })())"));
  t.check('the Shield pop-up shows the filter lists with a Refresh button', pop.row && /Updated/.test(pop.text) && pop.btn === 'Refresh', JSON.stringify(pop));
  if (process.env.OTO_SKY_SHOTS) { const fs2 = require('fs'), p2 = require('path'); fs2.mkdirSync(process.env.OTO_SKY_SHOTS, { recursive: true }); fs2.writeFileSync(p2.join(process.env.OTO_SKY_SHOTS, 'shield-pop.png'), (await t.ui.capturePage()).toPNG()); }
  await t.js('v1ClosePop(), 1');
  t.check('updating the filter lists keeps blocking on (a failed download changes nothing)', up.mode === 'full' && (up.ok || after.every((x) => x === 'blocked')), `${JSON.stringify(up)} ${after.join(',')}`);
  await t.js('oto.setBlocking(false)'); await t.sleep(800);
  const off = await tester('http://adblock.turtlecute.org/');
  t.check('control: with Shield off the same page loads both scripts and shows both boxes', off.adsBlocked === false && off.pageadBlocked === false && off.staticHidden === false && off.dynamicHidden === false, JSON.stringify(off));
  await t.js('oto.setBlocking(true)'); await t.sleep(800);
  void session;
};

// Offline: a tiny filter engine (one rule for the test tracker) in the cache file Oto reads, so no list download is needed.
// Same file name and format Oto writes after downloading the real lists (Balanced level).
module.exports.seed = {
  'adblock-engine.bin': () => Buffer.from(require('@ghostery/adblocker').FiltersEngine.parse('||tracker.site^').serialize()),
};
