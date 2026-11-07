'use strict';
// Audit item 13: extension archives can't write outside their folder or blow up the disk.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { readArchive, extractTo } = require('../main/safe-unzip.js');

const MANIFEST = JSON.stringify({ manifest_version: 3, name: 'Test', version: '1.0' });
function zipOf(files, tweak) {
  const z = new AdmZip();
  for (const [name, data] of Object.entries(files)) z.addFile(name, Buffer.from(data));
  if (tweak) tweak(z);
  return z.toBuffer();
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'oto-ext-'));

test('a normal extension unpacks', () => {
  const dir = tmp();
  const { plan, manifest } = readArchive(zipOf({ 'manifest.json': MANIFEST, 'js/bg.js': 'x' }));
  assert.strictEqual(manifest.name, 'Test');
  extractTo(plan, path.join(dir, 'out'));
  assert.ok(fs.existsSync(path.join(dir, 'out', 'js', 'bg.js')));
});

test('"../" paths are refused before anything is written', () => {
  const dir = tmp();
  const buf = zipOf({ 'manifest.json': MANIFEST, 'x.js': 'x' }, (z) => { z.getEntries()[1].entryName = '../../evil.js'; });
  assert.throws(() => readArchive(buf), /unsafe file path/);
  assert.ok(!fs.existsSync(path.join(dir, '..', 'evil.js')));
});

test('absolute and drive-letter paths are refused', () => {
  for (const bad of ['/etc/evil', 'C:/Windows/evil.dll', 'a\\..\\..\\evil']) {
    const buf = zipOf({ 'manifest.json': MANIFEST, 'x.js': 'x' }, (z) => { z.getEntries()[1].entryName = bad; });
    assert.throws(() => readArchive(buf), /unsafe file path/, bad);
  }
});

test('symbolic links are refused', () => {
  const buf = zipOf({ 'manifest.json': MANIFEST, 'link': '/etc/passwd' }, (z) => { z.getEntries()[1].attr = (0o120777 << 16) >>> 0; });
  assert.throws(() => readArchive(buf), /link/);
});

test('size and file-count limits', () => {
  const buf = zipOf({ 'manifest.json': MANIFEST, 'big.bin': Buffer.alloc(2048) });
  assert.throws(() => readArchive(buf, { file: 1e9, entries: 1e4, total: 1000 }), /more than/);
  assert.throws(() => readArchive(buf, { file: 1e9, entries: 1, total: 1e9 }), /too many files/);
  assert.throws(() => readArchive(buf, { file: 10, entries: 1e4, total: 1e9 }), /too big/);
});

test('files without a manifest, or damaged files, are refused', () => {
  assert.throws(() => readArchive(zipOf({ 'a.js': 'x' })), /manifest/);
  assert.throws(() => readArchive(Buffer.from('not a zip at all')), /damaged|isn’t/);
});
