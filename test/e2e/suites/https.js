'use strict';
// Certificate checks stay on, and the dangerous-site check blocks redirects and disguised hosts.
module.exports = async (t) => {
  await t.open(`https://bad.sec/`, 3500);
  const err = await t.js('JSON.stringify(V.get(activeTab().id).error || null)');
  t.check('a site with an untrusted certificate shows the certificate warning', /CERT/.test(err), err);
  for (const [label, url] of [['direct', 'http://evil.site/'], ['trailing dot', 'http://evil.site./'], ['uppercase', 'http://EVIL.SITE/'], ['redirect', 'http://fine.site/go?to=http%3A%2F%2Fevil.site%2F']]) {
    await t.open(url, 1500);
    let e = 'null';
    for (let i = 0; i < 26 && !/"code":"danger"/.test(e); i++) { e = await t.js('JSON.stringify(V.get(activeTab().id).error || null)'); if (!/"code":"danger"/.test(e)) await t.sleep(250); } // up to ~8 s: a slow machine can take seconds to open a tab
    const why = /"code":"danger"/.test(e) ? e : await t.js('JSON.stringify({ err: V.get(activeTab().id).error || null, wv: V.get(activeTab().id).wv.getURL(), loading: V.get(activeTab().id).wv.isLoading(), tab: activeTab().url, tabs: S.tabs.length })');
    t.check(`a dangerous site is blocked (${label})`, /"code":"danger"/.test(e), why);
  }
  await t.js('oto.setBlocking(false)'); await t.sleep(600);
  await t.open('http://evil.site/', 1500);
  let off = 'null';
  for (let i = 0; i < 26 && !/"code":"danger"/.test(off); i++) { off = await t.js('JSON.stringify(V.get(activeTab().id).error || null)'); if (!/"code":"danger"/.test(off)) await t.sleep(250); } // up to ~8 s on a slow machine
  t.check('a dangerous site is still blocked with ad blocking off', /"code":"danger"/.test(off), off);
  await t.js('oto.setBlocking(true)'); await t.sleep(600);
  await t.js("(loadIn(activeTab(), 'http://fine.site/'), 1)"); await t.sleep(2500);
  const after = await t.js('JSON.stringify({ err: V.get(activeTab().id).error || null, url: V.get(activeTab().id).wv.getURL() })');
  t.check('after a warning, the same tab opens a normal site (no leftover warning)', /"err":null,"url":"http:\/\/fine\.site\/"/.test(after), after);
  await t.open('http://fine.site/');
  t.check('a normal site still opens', (await t.js('JSON.stringify(V.get(activeTab().id).error || null)')) === 'null');
};
module.exports.seed = { 'danger-lists.json': () => JSON.stringify({ at: Date.now(), malware: ['evil.site'], phishing: [] }) };
