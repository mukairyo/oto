'use strict';
// Oto Shield (1.7.12): page code comes only with Oto. The engine's scriptlets/redirects are Oto's pinned copy, and
// rules from the downloaded lists can't use uBO's "trusted" scriptlets (which can put any code into a page).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { trustEngine, noScriptlets, RESOURCES_SHA256 } = require('../main/shield-trust.js');
const APP = path.join(__dirname, '..');

const LINES = [
  'example.com##+js(set, adsEnabled, false)',
  'example.com##+js(trusted-rpnt, script, /x/, alert(document.cookie))',
  'example.com##+js(trusted-set-cookie, a, b)',
  'example.com##.ad-box',
  '||ads.example.com^',
];
const scripts = (e) => e.getCosmeticsFilters({ url: 'https://example.com/', hostname: 'example.com', domain: 'example.com', getBaseRules: false, getInjectionRules: true, getExtendedRules: false, getRulesFromHostname: true, getRulesFromDOM: false }).scripts;

test('the bundled copy is the one Oto pinned', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, 'vendor-ghostery', 'resources.json'))).digest('hex');
  assert.strictEqual(sha, RESOURCES_SHA256);
});

test('the engine uses Oto\'s own scriptlets, and no trusted scriptlets from downloaded lists', () => {
  const e = ElectronBlocker.parse(LINES.join('\n'), { loadCosmeticFilters: true, debug: true });
  // a downloaded "resources" file that would put its own code into pages
  const res = JSON.parse(fs.readFileSync(path.join(APP, 'vendor-ghostery', 'resources.json'), 'utf8'));
  const sc = res.scriptlets.find((x) => x.name === 'set-constant.js');
  sc.body = sc.body.replace(/\{/, '{ window.__evil = 1; ');
  e.updateResources(JSON.stringify(res), 'downloaded');
  assert.match(scripts(e).join('\n'), /__evil/, 'the downloaded copy would have run');
  const r = trustEngine(e, APP);
  assert.strictEqual(r.dropped, 2, 'both trusted scriptlets dropped');
  const raw = e.getFilters().cosmeticFilters.map((f) => f.rawLine).sort();
  assert.deepStrictEqual(raw, ['example.com##+js(set, adsEnabled, false)', 'example.com##.ad-box']);
  const js = scripts(e).join('\n');
  assert.doesNotMatch(js, /__evil/, 'the downloaded code is gone');
  assert.match(js, /adsEnabled/, 'the ordinary scriptlet still runs, from Oto\'s copy');
  assert.match(e.resources.checksum, /^oto-/);
  assert.strictEqual(e.getFilters().networkFilters.length, 1, 'network rules untouched');
});

test('a changed bundled copy is refused (and Shield then runs no scriptlets)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-res-'));
  fs.mkdirSync(path.join(dir, 'vendor-ghostery'));
  const buf = fs.readFileSync(path.join(APP, 'vendor-ghostery', 'resources.json'));
  buf[100] ^= 1; fs.writeFileSync(path.join(dir, 'vendor-ghostery', 'resources.json'), buf);
  const e = ElectronBlocker.parse(LINES.join('\n'), { loadCosmeticFilters: true, debug: true });
  assert.throws(() => trustEngine(e, dir), /changed/);
  noScriptlets(e);
  assert.strictEqual(scripts(e).length, 0);
  assert.ok(e.getFilters().cosmeticFilters.some((f) => f.rawLine === 'example.com##.ad-box'), 'element hiding stays');
  fs.rmSync(dir, { recursive: true, force: true });
});
