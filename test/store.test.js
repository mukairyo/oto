'use strict';
// Aegis Phase 1: Oto's own files are never silently replaced, and writes are all-or-nothing (main/store.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const createStore = require('../main/store.js');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-store-'));
  const told = [];
  const store = createStore((n) => path.join(dir, n), (name, info) => told.push([name, info]));
  return { dir, told, store, file: (n) => path.join(dir, n) };
}
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
function patch(obj, key, fn, body) { const orig = obj[key]; obj[key] = fn; try { return body(); } finally { obj[key] = orig; } }

test('a missing file gives the fallback and nothing else happens', () => {
  const { store, told } = setup();
  assert.deepStrictEqual(store.readJSON('state.json', { fresh: 1 }), { fresh: 1 });
  assert.deepStrictEqual(told, []);
});

test('a damaged file (unreadable settings database) is moved aside, never overwritten (#19)', () => {
  const { store, told, dir, file } = setup();
  fs.writeFileSync(file('state.json'), '{"tabs":[{"url":"https://a.example"'); // cut off
  assert.deepStrictEqual(quiet(() => store.readJSON('state.json', {})), {});
  const aside = fs.readdirSync(dir).find((f) => f.startsWith('state.json.damaged-'));
  assert.ok(aside && fs.readFileSync(path.join(dir, aside), 'utf8').includes('a.example'), 'old contents kept');
  assert.deepStrictEqual(told, [['state.json', { aside, readOnly: false }]], 'told once');
  store.writeJSON('state.json', { tabs: [] });
  assert.ok(fs.readFileSync(path.join(dir, aside), 'utf8').includes('a.example'), 'saving fresh data never touches the kept copy');
});

test('if the damaged file can’t be moved aside, it becomes read-only (#3: rename fails too)', () => {
  const { store, told, file } = setup();
  fs.writeFileSync(file('account.json'), 'not json');
  quiet(() => patch(fs, 'renameSync', () => { const e = new Error('EPERM'); e.code = 'EPERM'; throw e; }, () => store.readJSON('account.json', {})));
  assert.strictEqual(told[0][1].readOnly, true);
  assert.throws(() => store.writeJSON('account.json', { userId: 'x' }), (e) => e.code === 'EDAMAGED');
  assert.strictEqual(fs.readFileSync(file('account.json'), 'utf8'), 'not json', 'the damaged file is untouched');
  assert.deepStrictEqual(store.readJSON('account.json', { f: 1 }), { f: 1 });
});

test('a file that can’t be read at all (locked, no permission) is never overwritten either', () => {
  const { store, file } = setup();
  fs.writeFileSync(file('permissions.json'), '{"https://a.example|camera":"block"}');
  quiet(() => patch(fs, 'readFileSync', () => { const e = new Error('EACCES'); e.code = 'EACCES'; throw e; }, () =>
    patch(fs, 'renameSync', () => { const e = new Error('EACCES'); e.code = 'EACCES'; throw e; }, () => store.readJSON('permissions.json', {}))));
  assert.throws(() => store.writeJSON('permissions.json', {}), /won't overwrite/);
  assert.match(fs.readFileSync(file('permissions.json'), 'utf8'), /camera/);
});

test('disk full during a write leaves the old file intact and no temporary file behind (#1, #2)', () => {
  const { store, dir, file } = setup();
  store.writeJSON('state.json', { v: 'old' });
  assert.throws(() => patch(fs, 'writeSync', () => { const e = new Error('ENOSPC'); e.code = 'ENOSPC'; throw e; }, () => store.writeJSON('state.json', { v: 'new' })), (e) => e.code === 'ENOSPC');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file('state.json'), 'utf8')), { v: 'old' });
  assert.deepStrictEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), []);
});

test('a crash before the swap (interrupted write) leaves the old file; the leftover temp file is harmless (#5)', () => {
  const { store, file } = setup();
  store.writeJSON('shield.json', { level: 'strict' });
  fs.writeFileSync(file('shield.json.tmp'), '{"level":"of'); // what a crash mid-write would leave
  assert.deepStrictEqual(store.readJSON('shield.json', {}), { level: 'strict' });
  store.writeJSON('shield.json', { level: 'basic' });
  assert.deepStrictEqual(store.readJSON('shield.json', {}), { level: 'basic' });
});

test('data that can’t be saved is refused before the disk is touched', () => {
  const { store, file } = setup();
  store.writeJSON('state.json', { ok: 1 });
  assert.throws(() => store.writeJSON('state.json', { n: 10n }));
  const cyc = {}; cyc.self = cyc;
  assert.throws(() => store.writeJSON('state.json', cyc));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file('state.json'), 'utf8')), { ok: 1 });
});

test('writes are flushed to disk before the swap (durability)', () => {
  const { store } = setup();
  let synced = 0;
  patch(fs, 'fsyncSync', (fd) => { synced++; return fs.fstatSync(fd); }, () => store.writeJSON('a.json', { x: 1 }));
  assert.strictEqual(synced, 1);
});
