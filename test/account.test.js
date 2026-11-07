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
    if (u.pathname === '/rest/v1/oto_sync' && o.method === 'PATCH') {
      const want = u.searchParams.get('updated_at').replace(/^eq\./, '');
      if (!db.row || db.row.updated_at !== want) return json(200, []);
      db.row = { ...db.row, ...JSON.parse(o.body) }; db.writes++; return json(200, [db.row]);
    }
    return json(404, { message: 'nope' });
  };
  return db;
}
const signedInFiles = () => ({ 'account.json': { userId: 'u1', email: 'a@b.c', salt: Buffer.alloc(16).toString('base64'), key: { e: Buffer.from('ENC:' + Buffer.alloc(32, 7).toString('base64')).toString('base64') }, refresh: { e: Buffer.from('ENC:r').toString('base64') }, access: { e: Buffer.from('ENC:a').toString('base64') }, expires: Date.now() + 3600e3 } });
function loadWithCloud(db) {
  const m = install({ canEncrypt: true });
  const mem = memFiles(signedInFiles());
  delete require.cache[require.resolve('../account.js')];
  require('../account.js')({ ...m.electron, net: { fetch: db.fetch }, readJSON: mem.readJSON, writeJSON: mem.writeJSON, send: () => {}, pwSyncExport: () => ({ entries: [], deleted: [] }), pwSyncMerge: () => 0, OTO_VERSION: 'test' });
  m.restore();
  return m.electron.ipcMain;
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
