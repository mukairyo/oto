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
