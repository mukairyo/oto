'use strict';
// Permission questions: a site's request that is still waiting when its tab closes is dropped. It is never answered
// afterwards (answering a mouse-lock or keyboard-lock request for a page that is gone crashed Electron before 45.3).
module.exports = async (t) => {
  await t.open('http://fine.site/');
  const tab = await t.js('activeTab().id');
  // Chromium only lets a page lock the mouse while its window has focus: from a window in the background the request
  // is refused at once and never reaches Oto (right: a background window mustn't grab the mouse). On a busy Windows
  // runner Oto's window could be left without focus (1.7.12 Checks #270 failed this way: "no question"), so the test
  // brings it forward first and says so plainly if the system won't give it focus.
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.fromWebContents(t.ui);
  let focused = false;
  for (let i = 0; i < 30 && !focused; i++) {
    if (win && !win.isDestroyed()) { win.show(); win.focus(); }
    await t.js('(V.get(activeTab().id).wv.focus(), 1)');
    await t.sleep(100);
    focused = await t.js('V.get(activeTab().id).wv.executeJavaScript("document.hasFocus()")');
  }
  // the page asks to lock the mouse (as games do); Oto asks you first
  await t.js(`(V.get(activeTab().id).wv.executeJavaScript("window.__pl = ''; document.addEventListener('pointerlockerror', () => { window.__pl = 'refused by Chromium'; }, { once: true }); document.body.requestPointerLock(); 1", true).catch(() => {}), 1)`);
  let asked = null;
  for (let i = 0; i < 40 && !asked; i++) { await t.sleep(100); asked = await t.js('permQueue[0] ? JSON.stringify({ id: permQueue[0].id, permission: permQueue[0].permission }) : null'); }
  const q = asked ? JSON.parse(asked) : {};
  const why = asked || `no question (window focused: ${focused}; page: ${await t.js('V.get(activeTab().id).wv.executeJavaScript("window.__pl || \'no error\'")')})`;
  t.check('a site that wants to lock the mouse has to ask first', q.permission === 'pointerLock', why);
  // the tab is closed while the question is still open
  await t.js(`(closeTabNow(${JSON.stringify(tab)}), 1)`);
  await t.sleep(800);
  t.check('closing the tab takes its question away', (await t.js('permQueue.length')) === 0, `questions left: ${await t.js('permQueue.length')}`);
  // an answer that arrives late (a slow click, or the 90 s time-out) must not reach the page that is gone
  if (q.id) await t.js(`(oto.replyPermission(${q.id}, true), 1)`);
  await t.sleep(1500);
  t.check('Oto keeps running after a late answer', (await t.js('1 + 1')) === 2);
  await t.open('http://fine.site/');
  const saved = await t.js('oto.listPermissions().then((l) => JSON.stringify(l))');
  t.check('a late answer for a closed tab is not saved as your choice', !/pointerLock/.test(String(saved)), String(saved).slice(0, 200));

  // (1.7.13) the tab leaves the site while its question is open: the question goes, and a late yes isn't saved for it
  await t.js(`(oto.clearPermissions ? oto.clearPermissions() : 0, 1)`).catch(() => {});
  await t.open('http://news.site/');
  for (let i = 0; i < 30; i++) { if (win && !win.isDestroyed()) { win.show(); win.focus(); } await t.js('(V.get(activeTab().id).wv.focus(), 1)'); await t.sleep(100); if (await t.js('V.get(activeTab().id).wv.executeJavaScript("document.hasFocus()")')) break; }
  await t.js(`(V.get(activeTab().id).wv.executeJavaScript("document.body.requestPointerLock(); 1", true).catch(() => {}), 1)`);
  let q2 = null;
  for (let i = 0; i < 40 && !q2; i++) { await t.sleep(100); q2 = await t.js('permQueue[0] ? JSON.stringify({ id: permQueue[0].id, origin: permQueue[0].origin }) : null'); }
  t.check('(control) news.site asks to lock the mouse', !!q2 && /news\.site/.test(q2), q2 || 'no question');
  await t.js(`(V.get(activeTab().id).wv.loadURL('http://fine.site/'), 1)`);
  await t.sleep(1200);
  t.check('when the tab moves to another site, the question for the first site goes away', (await t.js('permQueue.length')) === 0, `questions left: ${await t.js('permQueue.length')}`);
  if (q2) await t.js(`(oto.replyPermission(${JSON.parse(q2).id}, true), 1)`);
  await t.sleep(500);
  const saved2 = await t.js('oto.listPermissions().then((l) => JSON.stringify(l))');
  t.check('…and a yes clicked afterwards is not saved for the first site', !/news\.site/.test(String(saved2)), String(saved2).slice(0, 200));
};

