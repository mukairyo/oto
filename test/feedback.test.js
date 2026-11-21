'use strict';
// Oto feedback (1.8.1): the app's sender (main/feedback.js) and Oto's feedback service (supabase/functions/oto-feedback)
// with a stand-in database and Gmail.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');
const { createFeedback, clean, githubIssueUrl } = require('../main/feedback.js');
const { pathToFileURL } = require('url');
const svc = (f) => import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', 'oto-feedback', f)).href); // (Windows needs a file:// URL)

test('what the window sends is checked field by field', () => {
  assert.strictEqual(clean({ kind: 'nope', message: 'x'.repeat(20) }).ok, false);
  assert.strictEqual(clean({ kind: 'bug', message: 'too short' }).ok, false);
  assert.strictEqual(clean({ kind: 'bug', message: 'x'.repeat(4001) }).ok, false);
  assert.strictEqual(clean({ kind: 'bug', message: 'long enough text', contact: 'not an email' }).ok, false);
  assert.strictEqual(clean({ kind: 'bug', message: 'long enough text', contact: 'a@b.co\r\nBcc: x@y.z' }).ok, false, 'no extra mail headers');
  const c = clean({ kind: 'idea', message: '  Dark mode\u0007 please, for real  ', contact: ' me@example.com ', report: 'r'.repeat(70000), extra: 1 });
  assert.ok(c.ok);
  assert.deepStrictEqual(Object.keys(c.value).sort(), ['contact', 'kind', 'message', 'report']);
  assert.strictEqual(c.value.message, 'Dark mode please, for real');
  assert.strictEqual(c.value.contact, 'me@example.com');
  assert.ok(c.value.report.length <= 60000);
});

test('"Post on GitHub" opens a filled-in issue on Oto\'s repository', () => {
  const u = new URL(githubIssueUrl({ kind: 'bug', message: 'Tabs vanish after sleep\nSteps: …', version: '1.8.1', osName: 'Windows 11' }));
  assert.strictEqual(u.origin + u.pathname, 'https://github.com/mukairyo/oto/issues/new');
  assert.strictEqual(u.searchParams.get('title'), '[Bug] Tabs vanish after sleep');
  assert.strictEqual(u.searchParams.get('labels'), 'bug');
  assert.match(u.searchParams.get('body'), /Oto 1\.8\.1 · Windows 11/);
  assert.strictEqual(new URL(githubIssueUrl({ kind: 'other', message: 'hello there friends' })).searchParams.get('labels'), null);
});

test('sending: posts to the service, with Oto\'s version; a short wait between sends; errors read well', async () => {
  const calls = [];
  let t = 1e12, reply = { status: 200, body: { ok: true, emailed: true } };
  const net = { fetch: async (url, opts) => { calls.push({ url, opts }); return { status: reply.status, ok: reply.status < 300, json: async () => reply.body }; } };
  const fb = createFeedback({ net, url: 'https://x.supabase.co/functions/v1/oto-feedback', key: 'sb_publishable_x', version: '1.8.1', now: () => t });
  assert.deepStrictEqual(await fb.send({ kind: 'bug', message: 'It crashed when I opened it' }), { ok: true, emailed: true });
  const body = JSON.parse(calls[0].opts.body);
  assert.strictEqual(calls[0].url, 'https://x.supabase.co/functions/v1/oto-feedback');
  assert.strictEqual(calls[0].opts.headers.apikey, 'sb_publishable_x');
  assert.strictEqual(body.version, '1.8.1');
  assert.ok(body.os);
  assert.match((await fb.send({ kind: 'bug', message: 'Again right away please' })).error, /wait/);
  t += 31000; reply = { status: 429, body: { ok: false } };
  assert.match((await fb.send({ kind: 'idea', message: 'Another idea for Oto' })).error, /Too many/);
  t += 31000;
  const off = createFeedback({ net: { fetch: async () => { throw new Error('offline'); } }, url: 'https://x/', key: 'k', version: '1' });
  assert.match((await off.send({ kind: 'bug', message: 'It crashed when I opened it' })).error, /Couldn't reach/);
});

function fakeDb() {
  const rows = [];
  return {
    rows,
    count: async (h, since) => rows.filter((r) => r.ip_hash === h && r.created_at >= since).length,
    insert: async (row) => { rows.push({ ...row, id: rows.length + 1, created_at: new Date(Date.now()).toISOString(), emailed: false }); return rows.length; },
    markEmailed: async (id) => { rows[id - 1].emailed = true; },
  };
}
const post = (body, ip = '203.0.113.7') => new Request('https://x/functions/v1/oto-feedback', { method: 'POST', headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('the service saves every message, emails bug reports to Oto\'s maker, and limits spam', async () => {
  const { makeHandler, LIMIT_HOUR } = await svc('handler.mjs');
  const db = fakeDb(), mails = [];
  const handle = makeHandler({ db, hash: async (s) => require('crypto').createHash('sha256').update(`salt|${s}`).digest('hex'), sendMail: async (m) => { mails.push(m); } });
  let r = await handle(post({ kind: 'bug', message: 'Tabs vanish after sleep\nhappens daily', contact: 'me@example.com', version: '1.8.1', os: 'Windows 11', report: 'events…' }));
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { ok: true, id: 1, emailed: true });
  assert.strictEqual(mails.length, 1);
  assert.match(mails[0].subject, /^🐞 Oto bug: Tabs vanish after sleep$/);
  assert.strictEqual(mails[0].replyTo, 'me@example.com');
  assert.match(mails[0].text, /Oto: 1\.8\.1 · Windows 11/);
  assert.strictEqual(mails[0].attachments[0].filename, 'report.txt');
  assert.ok(db.rows[0].emailed);
  assert.doesNotMatch(JSON.stringify(db.rows[0]), /203\.0\.113\.7/, 'the IP itself is never saved');
  r = await handle(post({ kind: 'idea', message: 'A dark theme for the new tab' }));
  assert.deepStrictEqual(await r.json(), { ok: true, id: 2, emailed: false }, 'ideas are saved, not emailed');
  assert.strictEqual(mails.length, 1);
  for (let i = db.rows.length; i < LIMIT_HOUR; i++) await handle(post({ kind: 'other', message: 'filler message here' }));
  r = await handle(post({ kind: 'bug', message: 'one more from the same place' }));
  assert.strictEqual(r.status, 429);
  r = await handle(post({ kind: 'bug', message: 'someone else entirely' }, '198.51.100.9'));
  assert.strictEqual(r.status, 200, 'other people are not affected');
});

test('the service refuses bad requests, and still saves when Gmail fails', async () => {
  const { makeHandler } = await svc('handler.mjs');
  const db = fakeDb();
  const handle = makeHandler({ db, hash: async (s) => require('crypto').createHash('sha256').update(s).digest('hex'), sendMail: async () => { throw new Error('535 bad login'); } });
  assert.strictEqual((await handle(new Request('https://x/', { method: 'GET' }))).status, 405);
  assert.strictEqual((await handle(post('{nope'))).status, 400);
  assert.strictEqual((await handle(post({ kind: 'bug', message: 'short' }))).status, 400);
  assert.strictEqual((await handle(post({ kind: 'bug', message: 'x'.repeat(200000) }))).status, 413);
  assert.strictEqual((await handle(post({ kind: 'bug', message: 'valid enough', contact: 'a@b.co\nBcc: evil@x.io' }))).status, 400);
  const r = await handle(post({ kind: 'bug', message: 'Gmail is down today' }));
  assert.deepStrictEqual(await r.json(), { ok: true, id: 1, emailed: false });
  const { mailFor } = await svc('check.mjs');
  assert.doesNotMatch(mailFor({ kind: 'bug', message: 'line one\r\nBcc: x@y.z', contact: '', report: '' }, 1).subject, /[\r\n]/);
});

test('the one-file version for Supabase\'s dashboard is up to date', () => {
  execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'feedback-bundle.js'), '--check'], { stdio: 'pipe' });
});
