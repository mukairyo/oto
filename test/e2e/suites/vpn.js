'use strict';
// Oto VPN in the running app (1.8.0), with a stand-in Tor (test/e2e/fake-tor.js): the panel, pages really going
// through Tor's port, WebRTC locked to the proxy, the kill switch when Tor stops, Tor restarting, scopes, off again.
const fs = require('fs');
const path = require('path');
const { webContents } = require('electron');

module.exports = async (t) => {
  const LOG = process.env.OTO_FAKE_TOR_LOG, PID = process.env.OTO_FAKE_TOR_PID;
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  const log = () => { try { return fs.readFileSync(LOG, 'utf8'); } catch { return ''; } };
  const wc = async () => webContents.fromId(await t.js('V.get(activeTab().id).wcId'));
  const until = async (fn, ms = 6000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await t.sleep(100); } return v; };
  const st = () => t.js('oto.vpn.state()');

  await t.open('http://news.site/');
  let a = await J("const b = document.getElementById('btnVpn'); return { pill: !!b, label: b && b.getAttribute('aria-label'), row: (document.getElementById('vpnRow') || {}).className, rail: document.body.classList.contains('rail'), railShown: !!document.getElementById('vpnRow') && getComputedStyle(document.getElementById('vpnRow')).display !== 'none' };");
  t.check('the VPN pill sits next to Shield, off', a.pill && /off/i.test(a.label) && /ph-off/.test(a.row || ''), JSON.stringify(a));
  a = await J("const f = document.querySelector('#v1Foot .v1-fb[data-k=vpn]'), r = document.getElementById('vpnRow'); return { foot: !!f, sameRow: !!f && [...f.parentElement.children].map((b) => b.dataset.k).join(), rowShown: !!r && getComputedStyle(r).display !== 'none', title: f && f.title };");
  t.check('the VPN star is one of the sidebar\'s own buttons, in the same row as Library and Notifications', a.foot && /vpn/.test(a.sameRow) && /library/.test(a.sameRow) && /notifications/.test(a.sameRow), JSON.stringify(a));
  t.check('…and no separate VPN line while it\'s off', a.rowShown === false && /off/.test(a.title), JSON.stringify(a));
  await t.js("document.querySelector('#v1Foot .v1-fb[data-k=vpn]').click(), 1"); await t.sleep(200);
  t.check('…tapping it opens the VPN panel', await t.js("!!document.getElementById('vpnPanel')"));
  await t.js('(vpnClose(), 1)');
  await t.js("document.getElementById('btnVpn').click(), 1"); await t.sleep(200);
  a = await J("const p = document.getElementById('vpnPanel'); return { open: !!p, big: p && p.querySelector('.vpn-big').textContent, bg: p && getComputedStyle(p).backgroundImage };");
  t.check('the panel opens on the starfield, not connected', a.open && a.big === 'Not connected' && /space\.webp/.test(a.bg), JSON.stringify(a));

  // on
  await t.js("document.querySelector('#vpnPanel .vpn-power').click(), 1");
  const on = await until(async () => { const s = await st(); return s.phase === 'on' ? s : null; });
  t.check('tapping the star connects (Tor bootstraps to 100%)', on && on.phase === 'on' && on.progress === 100, JSON.stringify(on));
  a = await J("const b = document.getElementById('btnVpn'); return { label: b.getAttribute('aria-label'), row: document.getElementById('vpnRow') && document.getElementById('vpnRow').textContent, big: document.querySelector('#vpnPanel .vpn-big') && document.querySelector('#vpnPanel .vpn-big').textContent };");
  t.check('the pill, the sidebar line and the panel say it\'s on', /on/.test(a.label) && /VPN ·/.test(a.row || ''), JSON.stringify(a));
  a = await J("const f = document.querySelector('#v1Foot .v1-fb[data-k=vpn]'); return { lit: f && f.classList.contains('vpn-on'), title: f && f.title };");
  t.check('…and the star in the button row lights up', a.lit === true && /on/.test(a.title), JSON.stringify(a));
  await t.js('(vpnClose(), 1)');
  fs.writeFileSync(LOG, '');
  await t.open('http://fine.site/?via=tor');
  const through = await until(async () => /connect fine\.site:80/.test(log()));
  t.check('pages go through Tor\'s port (the name is sent to Tor, not looked up here)', !!through, log().slice(0, 200));
  a = { policy: (await wc()).getWebRTCIPHandlingPolicy(), title: await t.js('V.get(activeTab().id).wv.executeJavaScript("document.title")') };
  t.check('…and the page loads; calls (WebRTC) may only use the proxy', a.policy === 'disable_non_proxied_udp' && a.title.length > 0, JSON.stringify(a));

  // Tor stops: kill switch
  const pid = Number(fs.readFileSync(PID, 'utf8'));
  try { process.kill(pid); } catch {}
  const dropped = await until(async () => { const s = await st(); return s.phase === 'dropped' ? s : null; }, 4000);
  t.check('when Tor stops, Oto shows it (reconnecting)', !!dropped, JSON.stringify(await st()));
  fs.writeFileSync(LOG, '');
  const w = await wc();
  const failed = await new Promise((ok) => { const done = (v) => { w.removeListener('did-fail-load', f); ok(v); }; const f = (_e, code) => done(code); w.on('did-fail-load', f); w.loadURL('http://quiet.site/').catch(() => {}); setTimeout(() => done('loaded'), 3000); });
  t.check('…and pages fail instead of loading with your real address (kill switch)', failed !== 'loaded', `result: ${failed}`);
  const back = await until(async () => { const s = await st(); return s.phase === 'on' ? s : null; }, 12000);
  t.check('…then Oto starts Tor again by itself', !!back, JSON.stringify(await st()));

  // country
  fs.writeFileSync(LOG, '');
  await t.js("oto.vpn.set({ country: 'de' }), 1");
  const de = await until(async () => { const s = await st(); return s.phase === 'on' && /start exit=de/.test(log()) ? s : null; }, 8000);
  t.check('picking a country restarts Tor with exits there', !!de, log().slice(-120));

  // private only: normal tabs go direct again
  await t.js("oto.vpn.set({ scope: 'private' }), 1"); await t.sleep(500);
  fs.writeFileSync(LOG, '');
  await t.open('http://fine.site/?direct=1');
  await t.sleep(800);
  t.check('"private windows only": normal tabs don\'t go through it', !/connect fine\.site/.test(log()) && (await wc()).getWebRTCIPHandlingPolicy() !== 'disable_non_proxied_udp', log().slice(0, 200));

  // off
  await t.js("oto.vpn.set({ scope: 'all', on: false }), 1");
  const off = await until(async () => { const s = await st(); return s.phase === 'off' ? s : null; });
  a = await J("return { row: (document.getElementById('vpnRow') || {}).className, label: document.getElementById('btnVpn').getAttribute('aria-label') };");
  t.check('turning it off: direct again, the sidebar line goes back to off', !!off && /ph-off/.test(a.row || '') && /off/.test(a.label), JSON.stringify(a));
  const alive = () => { try { process.kill(Number(fs.readFileSync(PID, 'utf8')), 0); return true; } catch { return false; } };
  const gone = await until(async () => !alive(), 4000);
  t.check('…and Tor is stopped', gone);
  void path;
};
