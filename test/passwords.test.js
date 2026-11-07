'use strict';
// Audit items 01, 03, 10, 12, 21: saved passwords are only stored encrypted, old readable copies are migrated,
// plain-http logins aren't saved, exports always ask, and deletions sync as deletions.
const test = require('node:test');
const assert = require('node:assert');
const { install, memFiles } = require('./_mock-electron.js');

function load(opts = {}, files = {}) {
  const m = install(opts);
  delete require.cache[require.resolve('../main/passwords.js')];
  const mem = memFiles(files);
  const pw = require('../main/passwords.js')({ readJSON: mem.readJSON, writeJSON: mem.writeJSON, win: null, account: null });
  pw.setupPasswordIPC();
  m.restore();
  return { ...m, mem, pw, ipc: m.electron.ipcMain };
}
const UI = {}; // these handlers are reached only through the IPC gatekeeper; here we call them directly

test('passwords are saved encrypted, never readable', async () => {
  const { pw, mem } = load();
  assert.strictEqual(pw.pwUpsert('https://a.example', 'me', 'hunter2'), 'saved');
  const e = mem.files['passwords.json'].entries[0];
  assert.ok(e.enc && !e.plain, 'stored with enc only');
  assert.ok(!JSON.stringify(mem.files).includes('hunter2'));
  assert.strictEqual(pw.pwDec(e), 'hunter2');
});

test('without Windows encryption Oto refuses to save (no Base64 fallback)', async () => {
  const { pw, mem, ipc } = load({ canEncrypt: false });
  assert.strictEqual(pw.pwUpsert('https://a.example', 'me', 'hunter2'), 'noenc');
  assert.ok(!mem.files['passwords.json'] || !JSON.stringify(mem.files).includes(Buffer.from('hunter2').toString('base64')));
  assert.strictEqual(await ipc.invoke('pw:save', UI, 'https://a.example/login', 'me', 'hunter2'), 'noenc');
});

test('old readable (Base64) entries are encrypted on load', () => {
  const plain = { v: 1, entries: [{ id: 'x', origin: 'https://old.example', username: 'u', plain: Buffer.from('s3cret').toString('base64'), created: 1, updated: 1 }] };
  const { pw, mem } = load({}, { 'passwords.json': plain });
  pw.pwLoad();
  const e = mem.files['passwords.json'].entries[0];
  assert.ok(e.enc && !e.plain);
  assert.strictEqual(pw.pwDec(e), 's3cret');
});

test('logins on plain http are not saved (localhost is fine)', async () => {
  const { ipc } = load();
  assert.strictEqual(await ipc.invoke('pw:save', UI, 'http://shop.example/login', 'me', 'pw'), 'invalid');
  assert.strictEqual(await ipc.invoke('pw:check', UI, 'http://shop.example/login', 'me', 'pw'), 'invalid');
  assert.strictEqual(await ipc.invoke('pw:save', UI, 'http://localhost:3000/login', 'me', 'pw'), 'saved');
});

test('there is no generic "run this code in the page" channel any more', () => {
  const { ipc } = load();
  assert.ok(!ipc.handlers.has('pw:inject'));
  assert.ok(ipc.handlers.has('pw:arm'));
});

test('CSV export always asks first, and Cancel exports nothing', async () => {
  const { ipc, state } = load();
  state.dialogAnswer = 0;
  assert.strictEqual(await ipc.invoke('pw:export', UI), false);
  assert.strictEqual(state.dialogs.length, 1);
  assert.match(state.dialogs[0].detail, /unencrypted|read every password/i);
});

test('a deleted login stays deleted after another device syncs it back', async () => {
  const A = load();
  A.pw.pwUpsert('https://a.example', 'me', 'one');
  const id = A.pw.pwLoad().entries[0].id;
  const fromB = { entries: [{ o: 'https://a.example', u: 'me', p: 'one', up: Date.now() - 60000 }], deleted: [] };
  assert.strictEqual(await A.ipc.invoke('pw:delete', UI, id), true);
  A.pw.pwSyncMerge(fromB.entries, fromB.deleted);
  assert.strictEqual(A.pw.pwLoad().entries.length, 0, 'not resurrected');
  // and device B deletes it when it sees A's marker
  const B = load();
  B.pw.pwUpsert('https://a.example', 'me', 'one');
  B.pw.pwLoad().entries[0].updated = Date.now() - 60000;
  const out = A.pw.pwSyncExport();
  assert.strictEqual(out.deleted.length, 1);
  assert.ok(!JSON.stringify(out.deleted).includes('one'), 'markers never contain the password');
  B.pw.pwSyncMerge(out.entries, out.deleted);
  assert.strictEqual(B.pw.pwLoad().entries.length, 0);
});

test('saving a login again after deleting it brings it back', async () => {
  const A = load();
  A.pw.pwUpsert('https://a.example', 'me', 'one');
  await A.ipc.invoke('pw:delete', UI, A.pw.pwLoad().entries[0].id);
  A.pw.pwUpsert('https://a.example', 'me', 'two');
  assert.strictEqual(A.pw.pwSyncExport().deleted.length, 0);
  assert.strictEqual(A.pw.pwLoad().entries.length, 1);
});
