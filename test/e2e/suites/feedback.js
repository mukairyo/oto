'use strict';
// Oto feedback (1.8.1) in the running app, with a stand-in feedback service (test/e2e/server.js /__feedback):
// the page in Settings, About's button, sending a bug with the report, refusals shown, and "Post on GitHub".
const http = require('http');

module.exports = async (t) => {
  const PORT = Number(process.env.OTO_E2E_HTTP);
  const got = (q = '') => new Promise((ok) => http.get(`http://127.0.0.1:${PORT}/__feedback${q}`, (r) => { let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => ok(JSON.parse(b))); }));
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  const until = async (fn, ms = 5000) => { const end = Date.now() + ms; let v; while (Date.now() < end) { v = await fn(); if (v) return v; await t.sleep(100); } return v; };

  await t.js("openSettings('about'), 1"); await t.sleep(300);
  await t.js("[...document.querySelectorAll('#settingsBody button')].find((b) => b.textContent === 'Send feedback').click(), 1"); await t.sleep(300);
  let a = await J("const p = document.querySelector('.set-pane[data-page=feedback]'); return { open: !!p, kinds: [...document.querySelectorAll('.fb-kind b')].map((b) => b.textContent), on: (document.querySelector('.fb-kind.on b') || {}).textContent, send: document.querySelector('.fb-send').disabled, nav: [...document.querySelectorAll('#settings nav button, #settings .set-nav button')].some((b) => /Feedback/.test(b.textContent)) };");
  t.check('About → Send feedback opens the Feedback page (Bug, Idea, Other; Bug first)', a.open && a.kinds.join() === 'Bug,Idea,Other' && a.on === 'Bug', JSON.stringify(a));
  t.check('…and nothing can be sent until there\'s a real message', a.send === true, JSON.stringify(a));

  const type = (text) => t.js(`(() => { const m = document.querySelector('.fb-msg'); m.value = ${JSON.stringify(text)}; m.dispatchEvent(new Event('input')); return 1; })()`);
  await type('The sidebar flickers when I resize the window quickly.');
  await t.js("(() => { const m = document.querySelector('.fb-mail'); m.value = 'tester@example.com'; m.dispatchEvent(new Event('input')); return 1; })()");
  a = await J("return { send: document.querySelector('.fb-send').disabled, count: document.querySelector('.fb-count').textContent, report: document.querySelector('.fb-check input').checked };");
  t.check('typing enables Send; the technical report is ticked for bugs', a.send === false && /\/ 4000/.test(a.count) && a.report === true, JSON.stringify(a));
  const already = (await got()).length;
  await t.js("document.querySelector('.fb-send').click(), 1");
  const sent = await until(async () => { const f = await got(); return f.length > already ? f.slice(already) : null; });
  const body = sent ? JSON.parse(sent[0].body) : {};
  t.check('Send to Oto posts the bug to Oto\'s feedback service', body.kind === 'bug' && /flickers/.test(body.message) && body.contact === 'tester@example.com', JSON.stringify(body).slice(0, 200));
  t.check('…with Oto\'s version, Windows version and the technical report (nothing about sites)', !!body.version && !!body.os && /Oto problem report/.test(body.report || '') && !/news\.site|fine\.site/.test(body.report || ''), `${body.version} · ${body.os} · report ${String(body.report || '').length} chars`);
  t.check('…using Oto\'s public key, not a secret one', /^sb_publishable_/.test(sent && sent[0].apikey), sent && sent[0].apikey.slice(0, 16));
  a = await until(async () => { const v = await J("const n = document.querySelector('.fb-note'); return n && { ok: n.classList.contains('ok'), text: n.textContent, msg: document.querySelector('.fb-msg').value }"); return v; });
  t.check('…and says thanks, clearing the form', a && a.ok && /Thanks/.test(a.text) && a.msg === '', JSON.stringify(a));

  // an idea: no report box; the service refusing is shown, and what you wrote stays
  await t.js("[...document.querySelectorAll('.fb-kind')].find((b) => /Idea/.test(b.textContent)).click(), 1"); await t.sleep(200);
  a = await J("return { report: !!document.querySelector('.fb-check'), hint: document.querySelector('.fb-msg').placeholder };");
  t.check('Idea: no technical report, its own hint', !a.report && /like Oto to do/.test(a.hint), JSON.stringify(a));
  await type('A button to put every tab in a space to sleep.');
  await t.sleep(31000); // (the app waits 30 s between two sends)
  await got('?fail=1');
  await t.js("document.querySelector('.fb-send').click(), 1");
  a = await until(async () => J("const n = document.querySelector('.fb-note'); return n && n.classList.contains('bad') ? { text: n.textContent, msg: document.querySelector('.fb-msg').value } : null"));
  t.check('when the service says no, Oto explains and keeps what you wrote', a && /Too many/.test(a.text) && /sleep/.test(a.msg), JSON.stringify(a));

  // GitHub instead
  const before = await t.js('S.tabs.length');
  await t.js("document.querySelector('.fb-gh').click(), 1");
  const url = await until(async () => { const n = await t.js('S.tabs.length'); return n > before ? t.js('S.tabs[S.tabs.length - 1].url') : null; });
  t.check('"Post on GitHub instead" opens a filled-in issue on Oto\'s repository in a new tab', /^https:\/\/github\.com\/mukairyo\/oto\/issues\/new\?/.test(url || '') && /title=%5BIdea%5D/.test(url || '') && /labels=idea/.test(url || ''), String(url).slice(0, 140));

  // command bar
  a = await J("return ACTIONS.some((x) => x.name === 'Send feedback');");
  t.check('"Send feedback" is in the command bar', a === true);
};
