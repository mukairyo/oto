'use strict';
// Extensions run only in normal tabs: never in private windows or in Spaces with their own logins, and they can't
// list private tabs. Uses a tiny test extension made at run time (content script on every site, "tabs" permission).
const { BrowserWindow, webContents, session, app } = require('electron');
const fs = require('fs');
const path = require('path');
module.exports = async (t) => {
  const dir = path.join(app.getPath('userData'), 'e2e-extension');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'Oto e2e probe', version: '1.0', permissions: ['tabs'], host_permissions: ['<all_urls>'],
    content_scripts: [{ matches: ['<all_urls>'], js: ['cs.js'], run_at: 'document_start' }],
  }));
  fs.writeFileSync(path.join(dir, 'cs.js'), "document.documentElement.dataset.otoE2eExt = typeof chrome !== 'undefined' && chrome.runtime ? 'ran' : 'odd';");
  fs.writeFileSync(path.join(dir, 'probe.html'), '<!doctype html><meta charset="utf-8"><title>probe</title>');
  const main = session.fromPartition('persist:oto');
  const ext = await (main.extensions || main).loadExtension(dir, { allowFileAccess: false });
  t.check('the test extension loads in the normal session', !!(ext && ext.id));

  const ran = () => t.page("document.documentElement.dataset.otoE2eExt || 'no'");
  await t.open('http://fine.site/?normal=1', 3000);
  t.check('control: it runs in a normal tab', (await ran()) === 'ran');

  await t.js("(() => { S.workspaces.push({ id: 'e2x', name: 'Own', emoji: '', image: '', color: '#888888', colors: ['#888888'], intensity: .8, grain: .1, v1Own: true }); save(); switchWorkspace('e2x'); return 1; })()");
  await t.sleep(800);
  await t.open('http://fine.site/?space=1', 3000);
  t.check('it doesn’t run in a Space with its own logins', (await ran()) === 'no');
  await t.js('(switchWorkspace(S.workspaces[0].id), 1)'); await t.sleep(800);

  await t.js('(oto.openAvocado(), 1)'); await t.sleep(5000);
  const avo = BrowserWindow.getAllWindows().find((w) => /avocado=1/.test(w.webContents.getURL()));
  if (avo) {
    await avo.webContents.executeJavaScript("(document.querySelectorAll('#setup,.setup,#v1Intro,.v1-intro,#whatsnew').forEach((e) => e.remove()), openUrl('http://fine.site/?private-ext-secret=1', { newTabForce: true }), 1)");
    await t.sleep(3500);
  }
  const pwv = webContents.getAllWebContents().find((c) => c.getType() === 'webview' && /private-ext-secret/.test(c.getURL()));
  t.check('a private tab opened', !!pwv);
  if (pwv) t.check('it doesn’t run in a private window', (await pwv.executeJavaScript("document.documentElement.dataset.otoE2eExt || 'no'")) === 'no');

  // what the extension itself can see of your tabs
  const w = new BrowserWindow({ show: false, webPreferences: { session: main, sandbox: true } });
  try {
    await w.loadURL(`chrome-extension://${ext.id}/probe.html`);
    const urls = await w.webContents.executeJavaScript("new Promise((r) => { try { chrome.tabs.query({}, (tabs) => r(JSON.stringify((tabs || []).map((x) => x.url || '')))); } catch (e) { r('ERR ' + e.message); } })");
    t.check('control: the extension can list normal tabs', /normal=1/.test(urls), urls);
    t.check('the extension can’t see private tabs', !/private-ext-secret/.test(urls), urls);
    t.check('the extension can’t see tabs in a Space with its own logins', !/space=1/.test(urls), urls);
    t.check('the extension page has no Oto API', (await w.webContents.executeJavaScript("typeof window.oto + '/' + typeof require + '/' + typeof process")) === 'undefined/undefined/undefined');
  } finally { w.destroy(); if (avo) avo.close(); }
};
