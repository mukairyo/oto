'use strict';
// Sandboxing, isolation and navigation protection, checked in the running browser.
const { webContents } = require('electron');
module.exports = async (t) => {
  for (const c of webContents.getAllWebContents().filter((w) => w.getType() === 'window')) {
    const p = c.getLastWebPreferences ? c.getLastWebPreferences() : {};
    t.check(`Oto's window is sandboxed and isolated (${c.getURL().split('/').pop()})`, p.sandbox === true && p.contextIsolation === true && p.nodeIntegration === false, `sandbox=${p.sandbox} contextIsolation=${p.contextIsolation} nodeIntegration=${p.nodeIntegration}`);
  }
  t.check("Oto's window can't reach Node (no require, no process)", await t.js('typeof require === "undefined" && typeof process === "undefined"'));
  t.check("Oto's window still has its own API", await t.js('typeof oto === "object" && typeof oto.pwList === "function"'));
  await t.open('http://nav.site/');
  t.check('web pages get no Oto API and no Node', await t.page('typeof oto === "undefined" && typeof require === "undefined" && typeof process === "undefined"'));
  for (const w of webContents.getAllWebContents().filter((w) => w.getType() === 'webview')) {
    const p = w.getLastWebPreferences ? w.getLastWebPreferences() : {};
    t.check(`web page is sandboxed (${w.getURL().slice(0, 40)})`, p.sandbox === true && p.contextIsolation === true && p.nodeIntegration === false, JSON.stringify({ s: p.sandbox, c: p.contextIsolation, n: p.nodeIntegration }));
  }
  const url = () => t.js('V.get(activeTab().id).wv.getURL()');
  await t.page("location.href = 'file:///'; 1"); await t.sleep(1200);
  t.check("a website can't open local files", /^http:\/\/nav\.site/.test(await url()), await url());
  await t.page("location.href = 'view-source:http://nav.site/'; 1"); await t.sleep(1200);
  t.check("a website can't open view-source:", /^http:\/\/nav\.site/.test(await url()), await url());
  const before = await t.js('S.tabs.length');
  await t.page("window.open('file:///'); 1"); await t.sleep(1200);
  t.check("a website can't pop up a local-file window", (await t.js('S.tabs.length')) === before);
  // the gatekeeper: a message from a web page's process can't reach Oto's handlers (pages have no ipcRenderer at all;
  // as a stand-in, the window's own process also can't call a channel with bad arguments)
  t.check('the gatekeeper refuses malformed messages', await t.js("oto.pwGet({ id: 'x' }, 'reveal').then(() => false, () => true)"));
  t.check('the gatekeeper refuses prototype-pollution keys', await t.js('oto.pwUpdate("x", JSON.parse(\'{"__proto__":{"polluted":1}}\')).then(() => false, () => true)'));
};
