'use strict';
// Links that open a new tab open it in the background, and its video waits until you open that tab.
const { webContents } = require('electron');
module.exports = async (t) => {
  const wcOf = async (tabId) => webContents.fromId(await t.js(`V.get(${JSON.stringify(tabId)}).wv.getWebContentsId()`));
  const videoTab = () => t.js("(S.tabs.filter((x) => /yt\\.site/.test(x.url)).pop() || {}).id || null");
  await t.open('http://fine.site/links', 1500);
  const first = await t.js('activeTab().id'), n0 = await t.js('S.tabs.length');
  await (await wcOf(first)).executeJavaScript("document.getElementById('nt').click(); 1", true);
  await t.sleep(3000);
  const vid = await videoTab();
  t.check('a link that opens a new tab opens it in the background (you stay on your tab)', (await t.js('S.tabs.length')) === n0 + 1 && !!vid && (await t.js('activeTab().id')) === first);
  if (vid) {
    const bw = await wcOf(vid);
    const st = () => bw.executeJavaScript("JSON.stringify((() => { const v = document.querySelector('video'); return { paused: v.paused, t: v.currentTime }; })())").then(JSON.parse);
    let a = await st();
    t.check('…and its video waits instead of playing in the background', a.paused === true && a.t === 0, JSON.stringify(a));
    await t.js(`(activate(${JSON.stringify(vid)}), 1)`); await t.sleep(1500);
    a = await st();
    t.check('opening that tab starts the video', a.paused === false && a.t > 0.2, JSON.stringify(a));
    await t.js(`(activate(${JSON.stringify(first)}), 1)`); await t.sleep(500);
    a = await st();
    const t1 = a.t; await t.sleep(800); a = await st();
    t.check('once you have opened it, it is a normal tab (it keeps playing when you switch away)', a.paused === false && a.t > t1, JSON.stringify(a));
  }
  // a tab you open yourself plays as usual
  await t.open('http://yt.site/watch', 2000);
  const fw = await wcOf(await t.js('activeTab().id'));
  const fa = JSON.parse(await fw.executeJavaScript("JSON.stringify({ paused: document.querySelector('video').paused })"));
  t.check('a tab you open in front plays its video as usual', fa.paused === false, JSON.stringify(fa));
  // switched off: the link opens in front
  await t.js("(S.settings.linksInBackground = false, 1)");
  await t.js(`(activate(${JSON.stringify(first)}), 1)`); await t.sleep(600);
  await (await wcOf(first)).executeJavaScript("document.getElementById('nt').click(); 1", true);
  await t.sleep(2500);
  t.check('with "Links open in the background" off, the new tab opens in front', (await t.js('activeTab().id')) !== first && /yt\.site/.test(await t.js('activeTab().url')));
};
