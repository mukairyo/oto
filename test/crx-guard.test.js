'use strict';
// The extension-package check on main-process downloads (main/crx-guard.js, 1.7.12).
const test = require('node:test');
const assert = require('node:assert');
const { crxGuard } = require('../main/crx-guard.js');
const { verifyCrx } = require('../main/crx-verify.js');

const chunked = (bufs, headers = {}) => async () => new Response(new ReadableStream({ start(c) { for (const b of bufs) c.enqueue(new Uint8Array(b)); c.close(); } }), { status: 200, headers });
const real = (buf) => verifyCrx(buf, { requireWebStore: true });

test('anything that isn\'t a package passes through untouched, streamed', async () => {
  let pulled = 0;
  const big = Buffer.alloc(1 << 20, 7);
  const orig = async () => new Response(new ReadableStream({ pull(c) { pulled++; if (pulled > 8) c.close(); else c.enqueue(new Uint8Array(pulled === 1 ? Buffer.from('{"a":1}') : big)); } }), { status: 200, headers: { 'content-type': 'application/json' } });
  const r = await crxGuard(orig, { verify: real })('https://update.example/x');
  assert.strictEqual(pulled <= 2, true, 'only the first bytes were read before handing it on');
  const out = Buffer.from(await r.arrayBuffer());
  assert.strictEqual(out.length, 7 + 7 * (1 << 20));
  assert.strictEqual(out.toString('utf8', 0, 7), '{"a":1}');
  assert.strictEqual(r.headers.get('content-type'), 'application/json');
});

test('a package that doesn\'t verify is refused (first install and updates go through the same fetch)', async () => {
  const fake = Buffer.concat([Buffer.from('Cr24'), Buffer.from([3, 0, 0, 0, 4, 0, 0, 0]), Buffer.alloc(4), Buffer.from('PK')]);
  let refused = '';
  const r = await crxGuard(chunked([fake.subarray(0, 2), fake.subarray(2)]), { verify: real, onRefuse: (m) => { refused = m; } })('https://edgedl.me.gvt1.com/x.crx');
  assert.strictEqual(r.status, 403);
  assert.ok(refused, 'the refusal is reported');
});

test('a package that verifies comes through whole', async () => {
  const pkg = Buffer.concat([Buffer.from('Cr24'), Buffer.alloc(1000, 1)]);
  const r = await crxGuard(chunked([pkg.subarray(0, 3), pkg.subarray(3)]), { verify: () => {} })('https://x/');
  assert.strictEqual(r.status, 200);
  assert.ok(Buffer.from(await r.arrayBuffer()).equals(pkg));
});

test('an oversized package is refused, by its declared size or as it streams', async () => {
  const pkg = Buffer.concat([Buffer.from('Cr24'), Buffer.alloc(5000)]);
  let r = await crxGuard(chunked([pkg], { 'content-length': '999999999' }), { verify: () => {}, max: 4096 })('https://x/');
  assert.strictEqual(r.status, 403);
  r = await crxGuard(chunked([pkg.subarray(0, 2000), pkg.subarray(2000)]), { verify: () => {}, max: 4096 })('https://x/');
  assert.strictEqual(r.status, 403);
});

test('POSTs, errors and empty answers are left alone', async () => {
  const post = async () => new Response('Cr24xxxx', { status: 200 });
  assert.strictEqual(await (await crxGuard(post, { verify: real })('https://x/', { method: 'POST' })).text(), 'Cr24xxxx');
  const e404 = async () => new Response('nope', { status: 404 });
  assert.strictEqual((await crxGuard(e404, { verify: real })('https://x/')).status, 404);
  const tiny = async () => new Response('ab', { status: 200 });
  assert.strictEqual(await (await crxGuard(tiny, { verify: real })('https://x/')).text(), 'ab');
});
