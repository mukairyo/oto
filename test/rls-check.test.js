'use strict';
// scripts/rls-check.js fails closed (1.7.13): a run without the two test accounts is never a pass, an unreachable
// backend is inconclusive, and a leak is a failure. Run against a small fake backend on this machine.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

function fakeBackend(handler) {
  return new Promise((ok) => { const s = http.createServer(handler).listen(0, '127.0.0.1', () => ok(s)); });
}
function run(url, args = [], env = {}) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [path.join(__dirname, '..', 'scripts', 'rls-check.js'), ...args], {
      env: { PATH: process.env.PATH, OTO_SUPABASE_URL: url, OTO_SUPABASE_KEY: 'test-key', ...env },
    });
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => ok({ code, out }));
  });
}
const denyAll = (req, res) => {
  if (req.url.startsWith('/auth/v1/settings')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{}'); }
  res.writeHead(401, { 'content-type': 'application/json' }); res.end('{"message":"denied"}');
};

test('without the two test accounts the check fails (exit 2), never passes', async () => {
  const s = await fakeBackend(denyAll);
  const r = await run(`http://127.0.0.1:${s.address().port}`);
  s.close();
  assert.strictEqual(r.code, 2, r.out);
  assert.match(r.out, /NOT RUN\s+test accounts not configured/);
  assert.match(r.out, /INCOMPLETE/);
  assert.doesNotMatch(r.out, /test-key/, 'the key is never printed');
});

test('--anonymous-only is a local tool: it passes but says it is only the anonymous part', async () => {
  const s = await fakeBackend(denyAll);
  const r = await run(`http://127.0.0.1:${s.address().port}`, ['--anonymous-only']);
  s.close();
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /anonymous checks only \(--anonymous-only, not a full result\)/);
});

test('a test account that can\'t sign in is "not run" (2), not a pass', async () => {
  const s = await fakeBackend(denyAll);
  const r = await run(`http://127.0.0.1:${s.address().port}`, [], { OTO_RLS_A_EMAIL: 'a@test.invalid', OTO_RLS_A_PASSWORD: 'secret-a', OTO_RLS_B_EMAIL: 'b@test.invalid', OTO_RLS_B_PASSWORD: 'secret-b' });
  s.close();
  assert.strictEqual(r.code, 2, r.out);
  assert.match(r.out, /sign-in failed/);
  assert.doesNotMatch(r.out, /secret-a|secret-b/, 'passwords are never printed');
});

test('an unreachable backend is inconclusive (3)', async () => {
  const s = await fakeBackend(denyAll); const port = s.address().port; await new Promise((ok) => s.close(ok));
  const r = await run(`http://127.0.0.1:${port}`, ['--anonymous-only']);
  assert.strictEqual(r.code, 3, r.out);
  assert.match(r.out, /INCONCLUSIVE/);
});

test('a backend that shows rows to anyone fails (1)', async () => {
  const s = await fakeBackend((req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/rest/v1/oto_sync')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('[{"user_id":"x","blob":"secret"}]'); }
    return denyAll(req, res);
  });
  const r = await run(`http://127.0.0.1:${s.address().port}`, ['--anonymous-only']);
  s.close();
  assert.strictEqual(r.code, 1, r.out);
  assert.match(r.out, /FAIL\s+anonymous can't read oto_sync/);
  assert.doesNotMatch(r.out, /secret/, 'row contents are never printed');
});
