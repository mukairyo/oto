'use strict';
// Spaces with their own logins keep separate cookies and storage; clearing site data reaches every Space.
const { session } = require('electron');
module.exports = async (t) => {
  await t.open('http://fine.site/');
  await t.page("document.cookie = 'main=1; max-age=99999'; localStorage.setItem('where', 'main'); 1");
  await t.js("(() => { S.workspaces.push({ id: 'e2e', name: 'Work', emoji: '', image: '', color: '#888888', colors: ['#888888'], intensity: .8, grain: .1, v1Own: true }); save(); switchWorkspace('e2e'); return 1; })()");
  await t.sleep(800);
  await t.open('http://fine.site/');
  t.check("the Space's tab uses its own session", (await t.js('V.get(activeTab().id).wv.partition')) === 'persist:oto-ws-e2e');
  t.check("the Space can't see the main session's cookie or storage", await t.page("!document.cookie.includes('main=1') && localStorage.getItem('where') === null"));
  await t.page("document.cookie = 'space=1; max-age=99999'; localStorage.setItem('where', 'space'); 1");
  t.check("the main session can't see the Space's cookie", !(await session.fromPartition('persist:oto').cookies.get({})).some((c) => c.name === 'space'));
  t.check('“Clear site data” reports success', (await t.js("oto.clearSite('http://fine.site')")) === true);
  for (const p of ['persist:oto', 'persist:oto-ws-e2e']) t.check(`cleared in ${p}`, !(await session.fromPartition(p).cookies.get({})).some((c) => /fine\.site/.test(c.domain)));
};
