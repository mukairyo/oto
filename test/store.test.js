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

// Background saves (1.4.0 performance): the flush runs off the main thread, with the same guarantees.
const leftovers = (dir) => fs.readdirSync(dir).filter((f) => /\.tmp/.test(f));

test('a background save writes the data, flushed, and leaves no temporary file', async () => {
  const { dir, store, file } = setup();
  assert.strictEqual(await store.writeJSONAsync('state.json', { tabs: [1, 2, 3] }), true);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file('state.json'), 'utf8')), { tabs: [1, 2, 3] });
  assert.deepStrictEqual(leftovers(dir), []);
});

test('background saves that pile up are merged: the newest wins and every caller hears back', async () => {
  const { dir, store, file } = setup();
  let opens = 0;
  const orig = fs.promises.open;
  fs.promises.open = function (...a) { opens++; return orig.apply(this, a); };
  try {
    const all = await Promise.all([1, 2, 3, 4, 5].map((n) => store.writeJSONAsync('state.json', { n })));
    assert.deepStrictEqual(all, [true, true, true, true, true]);
  } finally { fs.promises.open = orig; }
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file('state.json'), 'utf8')), { n: 5 });
  assert.ok(opens <= 2, `merged (${opens} writes for 5 saves)`);
  assert.deepStrictEqual(leftovers(dir), []);
});

test('an older background save never replaces a newer immediate save (e.g. the save when Oto closes)', async () => {
  const { dir, store, file } = setup();
  const slow = store.writeJSONAsync('state.json', { from: 'background, older' }); // its flush is still running…
  store.writeJSON('state.json', { from: 'on close, newer' }); // …when the immediate save happens
  await slow;
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file('state.json'), 'utf8')), { from: 'on close, newer' });
  assert.deepStrictEqual(leftovers(dir), []);
});

test('a background save that fails (disk full) is reported and leaves the old file intact', async () => {
  const { dir, store, file } = setup();
  store.writeJSON('state.json', { old: 1 });
  const orig = fs.promises.open;
  fs.promises.open = async (p, ...a) => { const fh = await orig(p, ...a); const w = fh.writeFile.bind(fh); fh.writeFile = async () => { await w('{"half'); throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }); }; return fh; };
  try { await assert.rejects(store.writeJSONAsync('state.json', { new: 1 }), /ENOSPC/); } finally { fs.promises.open = orig; }
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file('state.json'), 'utf8')), { old: 1 });
  assert.deepStrictEqual(leftovers(dir), []);
});

test('a background save never writes over a damaged file that couldn’t be set aside', async () => {
  const { store, file } = setup();
  fs.writeFileSync(file('state.json'), '{broken');
  quiet(() => patch(fs, 'renameSync', () => { throw new Error('EPERM'); }, () => store.readJSON('state.json', {})));
  await assert.rejects(store.writeJSONAsync('state.json', { x: 1 }), (e) => e.code === 'EDAMAGED');
  assert.strictEqual(fs.readFileSync(file('state.json'), 'utf8'), '{broken');
  await assert.rejects(store.writeJSONAsync('state.json', () => {}), (e) => e.code === 'EINVAL', 'nothing to save is refused before the disk');
});
