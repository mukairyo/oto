'use strict';
// Audit item 02 and 05: login tokens and the sync key are never stored readable; the PC lock is really gone.
const test = require('node:test');
const assert = require('node:assert');
const { install, memFiles } = require('./_mock-electron.js');

function load(canEncrypt, files) {
  const m = install({ canEncrypt });
  const mem = memFiles(files);
  delete require.cache[require.resolve('../account.js')];
  const acc = require('../account.js')({ ...m.electron, net: {}, readJSON: mem.readJSON, writeJSON: mem.writeJSON, send: () => {}, pwSyncExport: () => ({ entries: [], deleted: [] }), pwSyncMerge: () => 0, OTO_VERSION: 'test' });
  m.restore();
  return { m, mem, acc };
}
const b64 = (s) => Buffer.from(s).toString('base64');

test('old readable tokens are re-encrypted on start', () => {
  const { mem } = load(true, { 'account.json': { userId: 'u1', refresh: { p: b64('REFRESH') }, access: { p: b64('ACCESS') }, key: { p: b64('KEY') } } });
  const a = mem.files['account.json'];
  for (const k of ['refresh', 'access', 'key']) assert.ok(a[k].e && !a[k].p, k);
  assert.ok(!JSON.stringify(a).includes(b64('REFRESH')));
});

test('without Windows encryption nothing readable is written to disk', () => {
  const { mem } = load(false, { 'account.json': { userId: 'u1', refresh: { p: b64('REFRESH') } } });
  const a = mem.files['account.json'];
  assert.ok(!JSON.stringify(a).includes(b64('REFRESH')) && !JSON.stringify(a).includes('REFRESH'));
  assert.ok(a.refresh.m, 'kept in memory for this session only');
});

test('the PC lock is gone: no lock channels except status, and it reports off', async () => {
  const { m, acc } = load(true, {});
  const chans = [...m.electron.ipcMain.handlers.keys()].filter((c) => c.startsWith('lock:'));
  assert.deepStrictEqual(chans, ['lock:status']);
  assert.deepStrictEqual(await m.electron.ipcMain.invoke('lock:status', {}), { enabled: false, locked: false });
  assert.strictEqual(acc.pwAllowed('reveal'), true);
});

// A tiny fake of the Supabase REST API, enough for push/pull.
function fakeCloud() {
  const db = { row: null, writes: 0 };
  const json = (status, body) => ({ ok: status < 300, status, text: async () => (body == null ? '' : JSON.stringify(body)) });
  db.fetch = async (url, o) => {
    const u = new URL(url);
    if (u.pathname === '/rest/v1/oto_sync' && o.method === 'GET') return json(200, db.row ? [db.row] : []);
    if (u.pathname === '/rest/v1/oto_sync' && o.method === 'POST') { if (db.row) return json(409, { code: '23505' }); db.row = JSON.parse(o.body); db.writes++; return json(201, [db.row]); }
    if (u.pathname === '/rest/v1/oto_sync' && o.method === 'PATCH' && db.failPatch) { db.failPatch--; return json(500, { message: 'server error' }); }
    if (u.pathname === '/rest/v1/oto_sync' && o.method === 'PATCH') {
      const want = u.searchParams.get('updated_at').replace(/^eq\./, '');
      if (!db.row || db.row.updated_at !== want) return json(200, []);
      db.row = { ...db.row, ...JSON.parse(o.body) }; db.writes++; return json(200, [db.row]);
    }
    if (u.pathname === '/auth/v1/token') {
      const b = JSON.parse(o.body);
      if (b.password !== undefined && b.password !== db.password) return json(400, { error_description: 'Invalid login credentials' });
      return json(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u1', email: 'a@b.c' } });
    }
    if (u.pathname === '/auth/v1/user' && o.method === 'PUT') {
      if (db.dropPut) { db.password = JSON.parse(o.body).password; db.dropPut = false; throw new Error('socket hang up'); } // changed, but the answer is lost
      if (db.netDown) throw new Error('offline');
      db.password = JSON.parse(o.body).password; return json(200, {});
    }
    return json(404, { message: 'nope' });
  };
  db.password = 'old-password';
  return db;
}
const signedInFiles = () => ({ 'account.json': { userId: 'u1', email: 'a@b.c', salt: Buffer.alloc(16).toString('base64'), key: { e: Buffer.from('ENC:' + Buffer.alloc(32, 7).toString('base64')).toString('base64') }, refresh: { e: Buffer.from('ENC:r').toString('base64') }, access: { e: Buffer.from('ENC:a').toString('base64') }, expires: Date.now() + 3600e3 } });
function loadWithCloud(db) {
  const m = install({ canEncrypt: true });
  const mem = memFiles(signedInFiles());
  delete require.cache[require.resolve('../account.js')];
  require('../account.js')({ ...m.electron, net: { fetch: (...a) => db.fetch(...a) }, readJSON: mem.readJSON, writeJSON: mem.writeJSON, send: () => {}, pwSyncExport: () => ({ entries: [], deleted: [] }), pwSyncMerge: () => 0, OTO_VERSION: 'test' });
  m.restore();
  const ipc = m.electron.ipcMain;
  ipc.mem = mem; ipc.state = m.state;
  return ipc;
}

test('sync never overwrites another device’s newer cloud copy (N04)', async () => {
  const db = fakeCloud();
  const pcA = loadWithCloud(db), pcB = loadWithCloud(db);
  assert.strictEqual((await pcA.invoke('account:push', {}, { s: { data: 1, at: 1 } }, {})).ok, true, 'first push creates the row');
  // B never pulled: its push must be refused, not overwrite A
  const r = await pcB.invoke('account:push', {}, { s: { data: 2, at: 2 } }, {});
  assert.strictEqual(r.code, 'conflict');
  assert.strictEqual(db.writes, 1);
  // after B pulls, its push goes through
  assert.strictEqual((await pcB.invoke('account:pull', {}, {})).ok, true);
  assert.strictEqual((await pcB.invoke('account:push', {}, { s: { data: 2, at: 2 } }, {})).ok, true);
  assert.strictEqual(db.writes, 2);
  // and now A is the one that must pull first
  assert.strictEqual((await pcA.invoke('account:push', {}, { s: { data: 3, at: 3 } }, {})).code, 'conflict');
});

// Real key derivation and encryption, to check what's in the cloud row.
const nodeCrypto = require('crypto');
const keyFor = (pw, salt) => nodeCrypto.scryptSync(pw, Buffer.from(salt, 'base64'), 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
function readRow(row, key) {
  const [, iv, tag, data] = row.blob.split('.');
  const d = nodeCrypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64')); d.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString());
}
async function seeded() {
  const db = fakeCloud();
  const pc = loadWithCloud(db);
  assert.strictEqual((await pc.invoke('account:push', {}, { s: { data: 'mine', at: 1 } }, {})).ok, true);
  return { db, pc };
}

test('changing the account password re-encrypts the cloud copy (P1-01)', async () => {
  const { db, pc } = await seeded();
  const r = await pc.invoke('account:changePassword', {}, 'old-password', 'new-password-1');
  assert.deepStrictEqual(r, { ok: true });
  assert.strictEqual(readRow(db.row, keyFor('new-password-1', db.row.salt)).sections.s.data, 'mine');
  assert.strictEqual((await pc.invoke('account:pull', {}, {})).ok, true, 'this PC still syncs');
});

test('if the upload fails after the password changed, the next sync finishes it — no data lost', async () => {
  const { db, pc } = await seeded();
  const oldSalt = db.row.salt;
  db.failPatch = 1;
  const r = await pc.invoke('account:changePassword', {}, 'old-password', 'new-password-2');
  assert.strictEqual(r.ok, true); assert.strictEqual(r.pending, true);
  assert.strictEqual(db.row.salt, oldSalt, 'cloud still under the old key for now');
  assert.strictEqual((await pc.invoke('account:pull', {}, {})).ok, true);
  assert.notStrictEqual(db.row.salt, oldSalt);
  assert.strictEqual(readRow(db.row, keyFor('new-password-2', db.row.salt)).sections.s.data, 'mine', 'readable with the new password');
});

test('if the server’s answer is lost, Oto checks which password is real before touching the data', async () => {
  // case 1: the change went through but the answer was lost
  let { db, pc } = await seeded();
  db.dropPut = true;
  let r = await pc.invoke('account:changePassword', {}, 'old-password', 'new-password-3');
  assert.strictEqual(r.pending, true);
  assert.strictEqual((await pc.invoke('account:pull', {}, {})).ok, true);
  assert.strictEqual(readRow(db.row, keyFor('new-password-3', db.row.salt)).sections.s.data, 'mine');
  // case 2: the change never reached the server
  ({ db, pc } = await seeded());
  const salt = db.row.salt;
  db.netDown = true;
  r = await pc.invoke('account:changePassword', {}, 'old-password', 'new-password-4');
  assert.strictEqual(r.pending, true);
  db.netDown = false;
  assert.strictEqual((await pc.invoke('account:pull', {}, {})).ok, true);
  assert.strictEqual(db.row.salt, salt, 'data left under the password that is really in use');
  assert.strictEqual(readRow(db.row, Buffer.alloc(32, 7)).sections.s.data, 'mine'); // the profile's original key
});

test('a password change waits for a running sync instead of overlapping it (P2-14)', async () => {
  const { db, pc } = await seeded();
  const order = [];
  const realFetch = db.fetch;
  db.fetch = async (url, o) => { order.push(`${o.method} ${new URL(url).pathname}`); return realFetch(url, o); };
  await Promise.all([pc.invoke('account:push', {}, { s: { data: 'x', at: 2 } }, {}), pc.invoke('account:changePassword', {}, 'old-password', 'new-password-5')]);
  const firstAuth = order.findIndex((x) => x.includes('/auth/v1/token'));
  const pushWrite = order.findIndex((x) => x.startsWith('PATCH'));
  assert.ok(pushWrite < firstAuth, `push finished before the password change started: ${order.join(', ')}`);
});

test('the password change refuses to start if its job can’t be saved to disk (nothing changes)', async () => {
  const { db, pc } = await seeded();
  const salt = db.row.salt;
  pc.mem.failWrites = true;
  const r = await pc.invoke('account:changePassword', {}, 'old-password', 'new-password-6');
  assert.strictEqual(r.ok, false); assert.match(r.error, /disk/);
  assert.strictEqual(db.password, 'old-password', 'server password untouched');
  assert.strictEqual(db.row.salt, salt, 'cloud data untouched');
  pc.mem.failWrites = false;
  assert.strictEqual((await pc.invoke('account:pull', {}, {})).ok, true, 'still syncs with the old key');
});

test('the password change refuses without Windows encryption (it couldn’t resume after a restart)', async () => {
  const { db, pc } = await seeded();
  pc.state.canEncrypt = false;
  const r = await pc.invoke('account:changePassword', {}, 'old-password', 'new-password-7');
  assert.strictEqual(r.ok, false); assert.match(r.error, /encrypt/);
  assert.strictEqual(db.password, 'old-password');
});

test('the in-progress job holds the new password only encrypted, and drops it once the server confirms', async () => {
  const { db, pc } = await seeded();
  db.netDown = true;
  await pc.invoke('account:changePassword', {}, 'old-password', 'new-password-8');
  const saved = JSON.stringify(pc.mem.files['account.json']);
  assert.ok(pc.mem.files['account.json'].rotation.pw.e, 'sealed by Windows');
  assert.ok(!saved.includes('new-password-8') && !saved.includes(Buffer.from('new-password-8').toString('base64')), 'never readable on disk');
  db.netDown = false;
  await pc.invoke('account:pull', {}, {});
  assert.ok(!pc.mem.files['account.json'].rotation, 'job finished and removed');
});

test('a failed everyday save (sign-in, sync time) is reported, never thrown', async () => {
  const { pc } = await seeded();
  pc.mem.failWrites = true;
  // the cloud write still happens; only the local note of it couldn't be saved (and Oto says so via saveOrWarn)
  assert.strictEqual((await pc.invoke('account:push', {}, { s: { data: 'y', at: 5 } }, {})).ok, true);
});
