'use strict';
// Trackers that the lists block "on other sites only" (most of them: session recorders, analytics, ad networks) are
// blocked whatever the page does with the Referer header. Before, a page that sent no Referer made every tracker look
// like part of the site itself, and those rules never applied (main/request-source.js).
const { net } = require('electron');
module.exports = async (t) => {
  const hits = async (reset) => JSON.parse(await (await net.fetch(`http://127.0.0.1:${process.env.OTO_E2E_HTTP}/__hits${reset ? '?reset=1' : ''}`)).text());
  const visit = async (site) => { await hits(true); await t.open(`http://${site}/`, 5200); const res = JSON.parse((await t.page('JSON.stringify(window.__res)')) || '{}'); await t.sleep(400); return { res, hits: await hits() }; };
  const state = JSON.parse(await t.js('oto.shield.state().then((s) => JSON.stringify(s))'));
  t.check('Shield runs its full filter engine', state.mode === 'full', JSON.stringify(state));
  if (state.mode !== 'full') return;
  const ways = ['script', 'fetch', 'fetchNoRef', 'xhr', 'image', 'blankFrame', 'worker'];
  const reached = (h) => Object.keys(h).filter((k) => !k.startsWith('own@'));

  for (const [site, what] of [['open.site', 'a normal page'], ['quiet.site', 'a page that sends no Referer (no-referrer)'], ['private.site', 'a page that sends no Referer to other sites (same-origin)']]) {
    const v = await visit(site);
    const through = ways.filter((w) => v.res[w] !== 'blocked');
    t.check(`${what}: a session recorder from another site is blocked in every way of asking`, through.length === 0 && Object.keys(v.res).length > 0, `got through: ${through.join(', ') || 'nothing'} · ${JSON.stringify(v.res)}`);
    t.check(`${what}: nothing reached the recorder (also no beacon and no frame)`, reached(v.hits).length === 0, JSON.stringify(v.hits));
    t.check(`${what}: the page's own requests still work`, v.res.own === 'loaded');
  }

  // the recorder company's own website is not broken by a rule meant for other sites
  await hits(true); await t.open('http://recorder.site/', 3000);
  t.check('the recorder company\'s own website loads its own script', (await t.page('typeof window.__rec')) === 'number', JSON.stringify(await hits()));

  // per-site exception: "Shield off for this site" lets everything on that site through, and only there
  await t.js("oto.shield.site('http://quiet.site/', true)"); await t.sleep(500);
  const off = await visit('quiet.site');
  t.check('with Shield off for that one site, its recorder loads', ways.every((w) => off.res[w] === 'loaded'), JSON.stringify(off.res));
  const other = await visit('private.site');
  t.check('…and other sites stay protected', ways.every((w) => other.res[w] === 'blocked'), JSON.stringify(other.res));
  await t.js("oto.shield.site('http://quiet.site/', false)"); await t.sleep(500);
  const back = await visit('quiet.site');
  t.check('…and switching it back on protects that site again', ways.every((w) => back.res[w] === 'blocked'), JSON.stringify(back.res));
};

// Offline: a small filter engine in the cache file Oto reads. The recorder rule is the usual list form: "on other sites only".
module.exports.seed = {
  'adblock-engine.bin': () => Buffer.from(require('@ghostery/adblocker').FiltersEngine.parse('||tracker.site^\n||recorder.site^$third-party').serialize()),
};
