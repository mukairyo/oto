'use strict';
// Oto's version numbering (main/version.js): the updater's number always goes up, also across the small automatic
// engine updates, and package.json + CHANGELOG.md agree with it. A mistake here means people stop getting updates.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const V = require('../main/version.js');
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('updater numbers are shown as the names people know', () => {
  assert.strictEqual(V.display('1.4.1'), '1.4.1'); // releases up to 1.4.1 were numbered plainly
  assert.strictEqual(V.display('1.4.101'), '1.4.1.1');
  assert.strictEqual(V.display('1.4.200'), '1.4.2');
  assert.strictEqual(V.display('1.4.201'), '1.4.2.1');
  assert.strictEqual(V.display('1.5.0'), '1.5.0');
  assert.strictEqual(V.display('1.5.3'), '1.5.0.3');
  assert.strictEqual(V.display('2.0.1000'), '2.0.10');
  assert.strictEqual(V.display('0.9.801'), '0.9.8.1');
  assert.strictEqual(V.display('1.5.0-beta.1'), '1.5.0-beta.1');
});

test('names turn back into the same updater numbers', () => {
  for (const n of ['1.4.1', '1.4.101', '1.4.200', '1.4.201', '1.4.299', '1.5.0', '1.5.3', '1.5.100', '2.0.1000']) assert.strictEqual(V.fromDisplay(V.display(n)), n, n);
  assert.strictEqual(V.fromDisplay('1.4.2'), '1.4.200');
  assert.strictEqual(V.fromDisplay('1.4.2.100'), null);
  assert.strictEqual(V.fromDisplay('nonsense'), null);
  assert.strictEqual(V.fromTag('v1.4.2'), '1.4.200');
  assert.strictEqual(V.fromTag('v1.4.1.1'), '1.4.101');
  assert.strictEqual(V.fromTag('v1.5.0-beta.2'), '1.5.0-beta.2');
});

test('a small automatic update is newer than its release and older than the next one', () => {
  assert.strictEqual(V.nextSmall('1.4.1'), '1.4.101');
  assert.strictEqual(V.nextSmall('1.4.101'), '1.4.102');
  assert.strictEqual(V.nextSmall('1.4.200'), '1.4.201');
  assert.strictEqual(V.nextSmall('1.5.0'), '1.5.1');
  assert.strictEqual(V.display(V.nextSmall('1.5.0')), '1.5.0.1'); // not "1.5.1", which is the next real release
  for (const v of ['1.4.1', '1.4.200', '1.5.0', '1.5.100']) {
    const small = V.nextSmall(v);
    assert.ok(V.cmp(small, v) > 0, `${small} > ${v}`);
    const [M, m, big] = V.display(v).split('.').map(Number);
    assert.ok(V.cmp(V.fromDisplay(`${M}.${m}.${big + 1}`), small) > 0, `the release after ${v} is newer than ${small}`);
  }
  assert.throws(() => V.nextSmall('1.4.299'), /99 small updates/);
  assert.throws(() => V.nextSmall('1.5.0-beta.1'));
});

test('the release check refuses a release nobody would receive', () => {
  // the trap: after the automatic update 1.4.1.1 (number 1.4.101), a plain 1.4.2 is OLDER to the updater
  assert.match(V.releaseProblem({ version: '1.4.2', otoVersion: '1.4.2' }, '1.4.101'), /use "version": "1\.4\.200"/);
  assert.match(V.releaseProblem({ version: '1.4.100', otoVersion: '1.4.1' }, '1.4.101'), /OLDER/);
  assert.strictEqual(V.releaseProblem({ version: '1.4.200', otoVersion: '1.4.2' }, '1.4.101'), '');
  assert.strictEqual(V.releaseProblem({ version: '1.4.200', otoVersion: '1.4.2' }, '1.4.200'), ''); // building the same release again
  assert.strictEqual(V.releaseProblem({ version: '1.4.200', otoVersion: '1.4.2' }, ''), '');
  assert.strictEqual(V.releaseProblem({ version: '1.5.0-beta.1', otoVersion: '1.5.0-beta.1' }, '1.4.200'), '');
  assert.match(V.releaseProblem({ version: 'x', otoVersion: 'x' }, ''), /not a version number/);
});

test('package.json, its lockfile and the changelog agree on the version', () => {
  assert.strictEqual(V.releaseProblem(pkg, ''), '');
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.strictEqual(lock.version, pkg.version);
  assert.strictEqual(lock.packages[''].version, pkg.version);
  if (String(pkg.version).includes('-')) return;
  const heads = [...fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').matchAll(/^## (\S+)/gm)].map((m) => m[1]);
  assert.strictEqual(heads[0], pkg.otoVersion, 'the newest changelog entry is this version');
  // every entry is newer than the one below it (checked down to 1.4.1, where this numbering starts)
  const upto = heads.indexOf('1.4.1');
  assert.ok(upto > 0, 'the changelog reaches back to 1.4.1');
  for (let i = 0; i < upto; i++) {
    const a = V.fromDisplay(heads[i]), b = V.fromDisplay(heads[i + 1]);
    assert.ok(a && b && V.cmp(a, b) > 0, `${heads[i]} (${a}) must be newer than ${heads[i + 1]} (${b})`);
  }
});

test('the engine updater, the app and the release check all use the one rule', () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  assert.match(read('.github/scripts/chromium-update.mjs'), /ver\.nextSmall\(/);
  assert.match(read('.github/scripts/version-guard.mjs'), /ver\.releaseProblem\(/);
  assert.match(read('main.js'), /require\('\.\/main\/version\.js'\)\.display/);
  assert.match(read('.github/workflows/release.yml'), /node \.github\/scripts\/version-guard\.mjs/);
});
