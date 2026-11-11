'use strict';
// Permission questions: a site's request that is still waiting when its tab closes is dropped. It is never answered
// afterwards (answering a mouse-lock or keyboard-lock request for a page that is gone crashed Electron before 45.3).
module.exports = async (t) => {
  await t.open('http://fine.site/');
  const tab = await t.js('activeTab().id');
  // the page asks to lock the mouse (as games do); Oto asks you first
  await t.js(`(V.get(activeTab().id).wv.executeJavaScript("document.body.requestPointerLock(); 1", true).catch(() => {}), 1)`);
  let asked = null;
  for (let i = 0; i < 40 && !asked; i++) { await t.sleep(100); asked = await t.js('permQueue[0] ? JSON.stringify({ id: permQueue[0].id, permission: permQueue[0].permission }) : null'); }
  const q = asked ? JSON.parse(asked) : {};
  t.check('a site that wants to lock the mouse has to ask first', q.permission === 'pointerLock', asked || 'no question');
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
};
