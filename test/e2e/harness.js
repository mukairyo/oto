'use strict';
// Oto end-to-end tests: Electron entry point. Starts the real Oto (../../main.js) with a fresh profile, runs one
// suite (OTO_E2E_SUITE) and writes its results to OTO_E2E_OUT. Started by run.js, not by hand.
const { app, BrowserWindow, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const OUT = process.env.OTO_E2E_OUT;
app.setPath('userData', process.env.OTO_E2E_PROFILE);
// downloads go to a folder inside the throwaway profile, never the real Downloads folder
fs.mkdirSync(path.join(process.env.OTO_E2E_PROFILE, 'Downloads'), { recursive: true });
app.setPath('downloads', path.join(process.env.OTO_E2E_PROFILE, 'Downloads'));
app.commandLine.appendSwitch('host-resolver-rules', process.env.OTO_E2E_RULES);
// (no proxy switches: the runner removes proxy variables from the environment)
const results = [];
const save = () => fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
process.on('uncaughtException', (e) => { results.push({ name: 'no crash in Oto', pass: false, detail: String(e && e.stack).slice(0, 300) }); save(); });
if (process.env.OTO_E2E_SEED && fs.existsSync(process.env.OTO_E2E_SEED)) fs.cpSync(process.env.OTO_E2E_SEED, process.env.OTO_E2E_PROFILE, { recursive: true });
require(process.env.OTO_E2E_MAIN || '../../main.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  // Linux CI machines have no keyring: let Electron use its basic store so password tests run (Windows uses DPAPI).
  if (process.platform === 'linux' && !safeStorage.isEncryptionAvailable()) { try { safeStorage.setUsePlainTextEncryption(true); } catch {} }
  const deadline = Date.now() + 20000;
  let win;
  while (!(win = BrowserWindow.getAllWindows().find((w) => /index\.html$/.test(w.webContents.getURL().split('?')[0]))) && Date.now() < deadline) await sleep(200);
  await sleep(4500);
  const ui = win.webContents;
  const t = {
    win, ui, sleep, platform: process.platform, ports: { http: +process.env.OTO_E2E_HTTP, https: +process.env.OTO_E2E_HTTPS },
    js: (code) => ui.executeJavaScript(code),
    page: (code) => ui.executeJavaScript(`V.get(activeTab().id).wv.executeJavaScript(${JSON.stringify(code)})`),
    open: async (url, wait = 2500) => { await ui.executeJavaScript(`(openUrl(${JSON.stringify(url)}, { newTabForce: true }), 1)`); await sleep(wait); },
    check: (name, pass, detail = '') => { results.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) }); save(); },
  };
  await t.js("(document.querySelectorAll('#setup,.setup,#v1Intro,.v1-intro,#whatsnew').forEach((e) => e.remove()), 1)");
  try { await require(path.join(__dirname, 'suites', `${process.env.OTO_E2E_SUITE}.js`))(t); }
  catch (e) { t.check('suite ran to the end', false, e && e.stack); }
  save();
  app.exit(0);
});
