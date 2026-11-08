'use strict';
// Private (Avocado) windows: in-memory session, nothing left after closing, nothing visible to normal tabs.
const { BrowserWindow, webContents, session, app } = require('electron');
const fs = require('fs');
const path = require('path');
module.exports = async (t) => {
  await t.js('(oto.openAvocado(), 1)'); await t.sleep(5000);
  const avo = BrowserWindow.getAllWindows().find((w) => /avocado=1/.test(w.webContents.getURL()));
  t.check('a private window opens', !!avo);
  if (!avo) return;
  await avo.webContents.executeJavaScript("(document.querySelectorAll('#setup,.setup,#v1Intro,.v1-intro,#whatsnew').forEach((e) => e.remove()), openUrl('http://fine.site/?private-secret=1', { newTabForce: true }), 1)");
  await t.sleep(3500);
  const wv = webContents.getAllWebContents().find((c) => c.getType() === 'webview' && /private-secret/.test(c.getURL()));
  t.check('the private tab loaded', !!wv);
  if (!wv) return;
  t.check('the private tab keeps nothing on disk (in-memory session)', wv.session.getStoragePath() === null, String(wv.session.getStoragePath()));
  await wv.executeJavaScript("document.cookie = 'priv=1; max-age=99999'; localStorage.setItem('priv', '1'); indexedDB.open('privdb'); 1");
  await t.sleep(500);
  t.check('control: while open, the private storage and IndexedDB exist', (await wv.executeJavaScript("indexedDB.databases().then((d) => localStorage.getItem('priv') === '1' && d.some((x) => x.name === 'privdb'))")) === true);
  t.check('while open, the private cookie exists in the private session', (await session.fromPartition('avocado').cookies.get({})).some((c) => c.name === 'priv'));
  avo.close(); await t.sleep(4000);
  t.check('after closing, the private cookie is gone', !(await session.fromPartition('avocado').cookies.get({})).some((c) => c.name === 'priv'));
  t.check('the private cookie never reached the normal session', !(await session.fromPartition('persist:oto').cookies.get({})).some((c) => c.name === 'priv'));
  const st = fs.readFileSync(path.join(app.getPath('userData'), 'state.json'), 'utf8');
  t.check('the private address is not in saved tabs or history', !st.includes('private-secret'));
  // nothing of the private session ever reaches the disk, so a crash can't leave anything behind either
  const parts = path.join(app.getPath('userData'), 'Partitions');
  t.check('no private session folder on disk', !(fs.existsSync(parts) && fs.readdirSync(parts).some((d) => /avocado/i.test(d))), fs.existsSync(parts) ? fs.readdirSync(parts).join(', ') : 'no Partitions folder');
  // a new private window starts empty: storage and IndexedDB from the closed one are gone
  await t.js('(oto.openAvocado(), 1)'); await t.sleep(5000);
  const avo2 = BrowserWindow.getAllWindows().find((w) => /avocado=1/.test(w.webContents.getURL()));
  if (avo2) {
    await avo2.webContents.executeJavaScript("(document.querySelectorAll('#setup,.setup,#v1Intro,.v1-intro,#whatsnew').forEach((e) => e.remove()), openUrl('http://fine.site/?private-2=1', { newTabForce: true }), 1)");
    await t.sleep(3500);
    const wv2 = webContents.getAllWebContents().find((c) => c.getType() === 'webview' && /private-2/.test(c.getURL()));
    const left = wv2 ? await wv2.executeJavaScript("indexedDB.databases().then((dbs) => JSON.stringify({ cookie: document.cookie, ls: localStorage.getItem('priv'), idb: dbs.map((d) => d.name) }))") : 'no tab';
    t.check('a new private window starts empty (no cookie, storage or IndexedDB from the last one)', left === '{"cookie":"","ls":null,"idb":[]}', left);
    avo2.close(); await t.sleep(3000);
  } else t.check('a second private window opens', false);
  await t.open('http://fine.site/');
  t.check('normal tabs see no private data', await t.page("!document.cookie.includes('priv') && localStorage.getItem('priv') === null"));
  t.check('normal tabs see no private IndexedDB', (await t.page("indexedDB.databases().then((d) => JSON.stringify(d.map((x) => x.name)))")) === '[]');
};
