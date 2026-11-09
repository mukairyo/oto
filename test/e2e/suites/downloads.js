'use strict';
// Downloads: kept in Downloads, never overwritten, tagged as from the internet (Windows), risky files ask first.
const { app, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
module.exports = async (t) => {
  const dir = app.getPath('downloads'); // the harness points this inside the throwaway profile
  await t.open('http://fine.site/');
  const ui = t.ui;
  for (let i = 0; i < 2; i++) { await ui.executeJavaScript("V.get(activeTab().id).wv.downloadURL('http://fine.site/report.pdf?n=' + Date.now())"); await t.sleep(2500); }
  const got = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => /^report( \(\d+\))?\.pdf$/.test(f));
  t.check('downloads land in the Downloads folder', got.length >= 2, got.join(', '));
  t.check('a second download never overwrites the first', got.includes('report.pdf') && got.some((f) => /^report \(\d+\)\.pdf$/.test(f)), got.join(', '));
  // A link that opens a new tab and turns out to be a file: Oto doesn't leave a white, empty tab behind (Chrome-style),
  // you're back on the tab with the link, and the download still finishes after its tab is gone.
  const tabs0 = await ui.executeJavaScript('S.tabs.length');
  const from = await ui.executeJavaScript('activeTab().id');
  await ui.executeJavaScript(`V.get(activeTab().id).wv.executeJavaScript("document.getElementById('nt').click()", true)`);
  let peak = tabs0;
  for (let i = 0; i < 40; i++) { await t.sleep(100); peak = Math.max(peak, await ui.executeJavaScript('S.tabs.length')); }
  await t.sleep(2000);
  const tabs1 = await ui.executeJavaScript('S.tabs.length');
  const back = await ui.executeJavaScript('activeTab() && activeTab().id');
  t.check('a download link that opens a new tab opens one', peak === tabs0 + 1, `tabs ${tabs0} → peak ${peak}`);
  t.check('…and that empty tab closes on its own (no white page left)', tabs1 === tabs0, `tabs ${tabs0} → ${tabs1}`);
  t.check('…and you are back on the tab with the link', back === from, `${from} / ${back}`);
  const closedList = await ui.executeJavaScript('closedStack.length ? closedStack[closedStack.length - 1].tab.url : ""');
  t.check('…and it is not offered in "reopen closed tab"', !/slow\.bin/.test(closedList), closedList);
  let slow = 0; try { slow = fs.statSync(path.join(dir, 'slow.bin')).size; } catch {}
  t.check('the download still finishes after its tab closed', slow === 8 * 64 * 1024, `${slow} bytes`);
  // a normal download link on a page that's already showing never closes that page
  const tabs2 = await ui.executeJavaScript('S.tabs.length');
  await ui.executeJavaScript(`V.get(activeTab().id).wv.executeJavaScript("document.getElementById('dl').click()", true)`);
  await t.sleep(2000);
  t.check('a normal download link leaves its page open', (await ui.executeJavaScript('S.tabs.length')) === tabs2 && (await ui.executeJavaScript('activeTab().id')) === from);
  if (process.platform === 'win32') {
    let motw = '';
    try { motw = fs.readFileSync(path.join(dir, 'report.pdf') + ':Zone.Identifier', 'utf8'); } catch (e) { motw = `missing (${e.code})`; }
    t.check('Windows Mark of the Web is set on downloads (ZoneId=3)', /ZoneId=3/.test(motw) && /HostUrl=http:\/\/fine\.site\/report\.pdf/.test(motw), motw.replace(/\r?\n/g, ' | '));
  }
  // opening a program asks first; Cancel opens nothing
  const exe = path.join(dir, 'e2e-setup.exe'); fs.writeFileSync(exe, 'MZ');
  const asked = [], opened = [];
  const origBox = dialog.showMessageBox, origOpen = shell.openPath;
  dialog.showMessageBox = async (_w, o) => { asked.push(o.message); return { response: 0 }; };
  shell.openPath = async (p) => { opened.push(p); return ''; };
  try {
    const r = await ui.executeJavaScript(`oto.dlOpen(${JSON.stringify(exe)})`);
    t.check('opening a program from Oto asks first', asked.length === 1 && /can run programs/.test(asked[0]), asked.join(' | '));
    t.check('Cancel opens nothing', r === 'cancelled' && opened.length === 0, `${r} / opened ${opened.length}`);
  } finally { dialog.showMessageBox = origBox; shell.openPath = origOpen; try { fs.unlinkSync(exe); } catch {} }
};
