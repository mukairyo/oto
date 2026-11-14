'use strict';
// A new tab doesn't flash white in dark mode while its page loads; pages without their own background still get white.
module.exports = async (t) => {
  const bg = () => t.js(`JSON.stringify((() => { const el = V.get(activeTab().id).wv; return { bg: getComputedStyle(el).backgroundColor, plain: el.classList.contains('plain'), theme: document.documentElement.dataset.theme }; })())`);
  await t.js("(document.documentElement.dataset.theme = 'dark', 1)");
  await t.open('http://fine.site/slow-dark', 400);
  let a = JSON.parse(await bg());
  {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.getAllWindows().find((w) => /index\.html/.test(w.webContents.getURL()));
    const r = JSON.parse(await t.js('JSON.stringify((() => { const b = V.get(activeTab().id).wv.getBoundingClientRect(); return [Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2)]; })())'));
    const bm = (await win.webContents.capturePage({ x: r[0], y: r[1], width: 1, height: 1 })).toBitmap();
    const px = [bm[2], bm[1], bm[0]];
    t.check('…and that is what is on screen (no white from the page before it draws)', px.every((v) => v < 60), String(px));
  }
  t.check('dark mode: a new tab waits on a dark background, not white, while its page loads', a.theme === 'dark' && a.bg === 'rgb(15, 15, 15)' && !a.plain, JSON.stringify(a));
  await t.sleep(2600);
  a = JSON.parse(await bg());
  t.check('a page with its own (dark) background keeps the dark backdrop', !a.plain && a.bg === 'rgb(15, 15, 15)', JSON.stringify(a));
  await t.open('http://fine.site/', 2000);
  a = JSON.parse(await bg());
  t.check('a page without its own background gets the usual white behind it', a.plain && a.bg === 'rgb(255, 255, 255)', JSON.stringify(a));
  await t.js("(document.documentElement.dataset.theme = 'light', 1)");
  await t.open('http://fine.site/slow-dark', 400);
  a = JSON.parse(await bg());
  t.check('light mode: a new tab waits on white as before', a.bg === 'rgb(255, 255, 255)', JSON.stringify(a));
};
