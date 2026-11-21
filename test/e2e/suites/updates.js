'use strict';
// A new version shows up in the sidebar by itself (1.7.11): the update messages from the main process reach the
// sidebar's update card. Before, they only reached the first version of the handler, so the card appeared only after
// Settings → About asked for the status.
module.exports = async (t) => {
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  await t.sleep(600);
  t.ui.send('update', { state: 'downloading', version: '9.9.9', percent: 40, at: Date.now() });
  await t.sleep(300);
  let a = await J("const c = document.getElementById('v1Upd'); return { card: !!c, s: c && c.dataset.s, about: !!document.querySelector('#settings.open, .settings.open') };");
  t.check('a download in progress shows in the sidebar without opening About', a.card && a.s === 'downloading' && !a.about, JSON.stringify(a));
  t.ui.send('update', { state: 'ready', version: '9.9.9', at: Date.now() });
  await t.sleep(300);
  a = await J("const c = document.getElementById('v1Upd'); return { card: !!c, s: c && c.dataset.s, text: c && c.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80) };");
  t.check('a ready update shows its card with Restart now', a.card && a.s === 'ready' && /9\.9\.9/.test(a.text) && /restart/i.test(a.text), JSON.stringify(a));
  t.ui.send('update', { state: 'latest', at: Date.now() }); await t.sleep(200);
  // (1.8.2) owner mode survives update messages: a plain "checking" message doesn't make Oto ask for the key again
  await t.js('(UPD.owner = true, 1)');
  t.ui.send('update', { state: 'checking', at: Date.now() }); await t.sleep(200);
  t.ui.send('update', { state: 'latest', at: Date.now() }); await t.sleep(200);
  a = await J('return { owner: UPD.owner };');
  t.check('owner mode stays on through "checking for updates" messages (no asking for the key again)', a.owner === true, JSON.stringify(a));
  t.ui.send('update', { state: 'latest', owner: false, at: Date.now() }); await t.sleep(200);
  a = await J('return { owner: UPD.owner };');
  t.check('…but when Oto itself says the owner is locked, the window follows', a.owner === false, JSON.stringify(a));
  // the find bar's close button and the settings button reach the sidebar's versions of their handlers too
  a = await J("const t = document.getElementById('v1Ticks') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'v1Ticks' })); t.appendChild(document.createElement('i')); document.getElementById('findClose').click(); return { ticks: t.children.length };");
  t.check('closing the find bar clears its result ticks', a.ticks === 0, JSON.stringify(a));
};
