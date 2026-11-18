'use strict';
// Trust boundaries, checked in the running app (1.7.13): a web page can't reach local files, browser-internal pages
// or Oto's own window file, by navigating, by a frame or by a popup; and a Space with its own logins doesn't share
// cookies or storage with the others. (No Node/Oto API in pages: isolation suite. Private windows: private suite.)
const { webContents, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

module.exports = async (t) => {
  const UI_FILE = pathToFileURL(path.join(__dirname, '..', '..', '..', 'src', 'index.html')).href;
  const LOCAL = process.platform === 'win32' ? 'file:///C:/Windows/win.ini' : 'file:///etc/hostname';
  const page = (code) => t.js(`V.get(activeTab().id).wv.executeJavaScript(${JSON.stringify(code)}, true)`);
  const wcOf = async () => webContents.fromId(await t.js('V.get(activeTab().id).wcId'));

  await t.open('http://fine.site/');
  // 1 · navigating the page itself
  for (const target of [LOCAL, UI_FILE, 'chrome://gpu', 'view-source:http://fine.site/', 'devtools://devtools/bundled/inspector.html']) {
    await page(`location.href = ${JSON.stringify(target)}; 1`).catch(() => {});
    await t.sleep(700);
    const now = (await wcOf()).getURL();
    t.check(`a page can't send itself to ${target.split(':')[0]}: (${target.slice(0, 40)})`, /^http:\/\/fine\.site\//.test(now), now);
    if (!/^http:\/\/fine\.site\//.test(now)) await t.open('http://fine.site/');
  }
  // 2 · a frame inside the page
  await page(`const f = document.createElement('iframe'); f.src = ${JSON.stringify(LOCAL)}; document.body.appendChild(f); const g = document.createElement('iframe'); g.src = ${JSON.stringify(UI_FILE)}; document.body.appendChild(g); 1`);
  await t.sleep(900);
  const frames = (await wcOf()).mainFrame.framesInSubtree.map((f) => f.url);
  t.check('a frame in a page can\'t load a local file or Oto\'s own window', !frames.some((u) => /^file:/i.test(u)), JSON.stringify(frames));
  // 3 · a popup
  const before = BrowserWindow.getAllWindows().length;
  await page(`window.open(${JSON.stringify(UI_FILE)}, 'x', 'popup'); window.open(${JSON.stringify(LOCAL)}, 'y', 'popup'); 1`);
  await t.sleep(900);
  const wins = BrowserWindow.getAllWindows();
  t.check('a popup can\'t open Oto\'s own window or a local file (no new window)', wins.length === before, `windows ${before} -> ${wins.length}`);
  t.check('…and no window shows Oto\'s UI except Oto\'s own', BrowserWindow.getAllWindows().filter((w) => w.webContents.getURL().split(/[?#]/)[0] === UI_FILE).length === before, BrowserWindow.getAllWindows().map((w) => w.webContents.getURL().slice(0, 60)).join(' | '));
  // 4 · a Space with its own logins
  await page("document.cookie = 'who=main; path=/'; localStorage.setItem('who', 'main'); 1");
  await t.js("(v1NewSpaceFrom({ name: 'Work', emoji: '', colors: ['#D6A276', '#8b5cf6'] }), S.workspaces[S.workspaces.length - 1].v1Own = true, save(), 1)");
  await t.sleep(300);
  await t.open('http://fine.site/');
  const part = await t.js('V.get(activeTab().id).wv.getAttribute("partition")');
  t.check('a Space with its own logins gets its own session', /^persist:oto-ws-/.test(part), part);
  const inWork = await page("JSON.stringify({ c: document.cookie, s: localStorage.getItem('who') })");
  t.check('…which sees none of the other Spaces\' cookies or storage', !/who=main/.test(JSON.parse(inWork).c) && JSON.parse(inWork).s === null, inWork);
  await page("document.cookie = 'who=work; path=/'; localStorage.setItem('who', 'work'); 1");
  await t.js('(switchWorkspace(S.workspaces[0].id), 1)'); await t.sleep(300);
  await t.open('http://fine.site/');
  const back = await page("JSON.stringify({ c: document.cookie, s: localStorage.getItem('who') })");
  t.check('…and its own cookies and storage don\'t reach the others', /who=main/.test(JSON.parse(back).c) && !/who=work/.test(JSON.parse(back).c) && JSON.parse(back).s === 'main', back);
};
