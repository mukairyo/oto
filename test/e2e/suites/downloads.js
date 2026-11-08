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
