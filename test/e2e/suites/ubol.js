'use strict';
// Oto Shield's two modes (1.7.6): Oto Shield and uBlock Origin Lite. In uBOL mode, uBOL's own network rules block
// (here: one of EasyList's, as uBOL ships it) and uBOL's scriptlets run in the page before its own scripts (uBOL's
// test rules, which only act on localhost). Switching back to Oto Shield turns both off again. No internet needed:
// the uBOL rules that come with Oto are used.
module.exports = async (t) => {
  const st = JSON.parse(await t.js('oto.shield.state().then((s) => JSON.stringify(s))'));
  t.check('Shield runs, in Oto Shield mode by default', st.mode === 'full' && st.engine === 'oto', JSON.stringify({ mode: st.mode, engine: st.engine }));
  t.check('the uBOL rules that come with Oto are there', !!(st.ubol && /^\d{4}\.\d+\.\d+$/.test(st.ubol.version)), JSON.stringify(st.ubol));
  const probe = (url) => t.page(`fetch(${JSON.stringify(url)} + '?' + Math.random(), { mode: 'no-cors' }).then(() => 'loaded', () => 'blocked')`);
  const port = process.env.OTO_E2E_HTTP;

  await t.open('http://fine.site/', 1500);
  t.check('Oto Shield mode: a file only uBOL’s rules list loads', (await probe('http://fine.site/pogoadkit.js')) === 'loaded');
  await t.open(`http://localhost:${port}/ubol-test`, 1500);
  t.check('Oto Shield mode: uBOL’s scriptlets don’t run', (await t.page('window.__s1')) === 'page');

  const r = JSON.parse(await t.js("oto.shield.engine('ubol').then((x) => JSON.stringify(x))"));
  t.check('switching to uBlock Origin Lite mode', r.engine === 'ubol' && r.mode === 'full', JSON.stringify(r));
  await t.open('http://fine.site/', 1500);
  t.check('uBOL mode: uBOL’s own network rules block (an EasyList rule as uBOL ships it)', (await probe('http://fine.site/pogoadkit.js')) === 'blocked');
  t.check('…and a normal file still loads', (await probe('http://fine.site/js/app.js')) === 'loaded');
  await t.js("oto.shield.filters('||mine.site^')"); await t.sleep(300);
  t.check('…and your own filters (My filters) still apply', (await probe('http://mine.site/x.js')) === 'blocked');
  await t.js("oto.shield.filters('')");
  await t.open(`http://localhost:${port}/ubol-test`, 1500);
  t.check('uBOL mode: uBOL’s scriptlets run in the page before its own scripts', (await t.page('window.__s1')) === 'undefined', await t.page('window.__s1'));

  await t.js("oto.shield.site('http://localhost/', true)"); await t.page('location.reload()'); await t.sleep(1500);
  t.check('uBOL mode: a site with Shield turned off gets no scriptlets', (await t.page('window.__s1')) === 'page');
  await t.js("oto.shield.site('http://localhost/', false)");

  const back = JSON.parse(await t.js("oto.shield.engine('oto').then((x) => JSON.stringify(x))"));
  await t.open('http://fine.site/', 1500);
  t.check('back to Oto Shield mode: uBOL’s rules are off again', back.engine === 'oto' && (await probe('http://fine.site/pogoadkit.js')) === 'loaded');
  await t.open(`http://localhost:${port}/ubol-test`, 1500);
  t.check('…and so are its scriptlets', (await t.page('window.__s1')) === 'page');
};
module.exports.seed = require('./shield.js').seed;
