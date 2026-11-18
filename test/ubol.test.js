'use strict';
// uBlock Origin Lite mode (main/ubol.js): uBOL's network rules become filters Shield's engine runs, the rules that
// ship with Oto are complete, and its scriptlets are put together the way uBOL registers them.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const U = require('../main/ubol.js');

test('uBOL rules become filters: block, allow, sites, types, third-party, important, redirect, regex', () => {
  assert.deepStrictEqual(U.toFilters({ priority: 1, action: { type: 'block' }, condition: { urlFilter: '||ads.example^', resourceTypes: ['script', 'sub_frame'], domainType: 'thirdParty' } }), ['||ads.example^$script,subdocument,third-party']);
  assert.deepStrictEqual(U.toFilters({ action: { type: 'block' }, condition: { requestDomains: ['a.com', 'b.com'] } }), ['||a.com^', '||b.com^']);
  assert.deepStrictEqual(U.toFilters({ action: { type: 'allow' }, condition: { urlFilter: '/ok.js', initiatorDomains: ['x.com'], excludedInitiatorDomains: ['y.x.com'] } }), ['@@/ok.js$domain=x.com|~y.x.com']);
  assert.deepStrictEqual(U.toFilters({ priority: 30, action: { type: 'block' }, condition: { urlFilter: '/w.js' } }), ['/w.js$important']);
  assert.deepStrictEqual(U.toFilters({ action: { type: 'redirect', redirect: { extensionPath: '/web_accessible_resources/noop.js' } }, condition: { urlFilter: '||t.com/a.js' } }), ['||t.com/a.js$redirect=noop.js']);
  assert.deepStrictEqual(U.toFilters({ action: { type: 'block' }, condition: { regexFilter: '^https://x\\.com/[a-z]+\\.js' } }), ['/^https://x\\.com/[a-z]+\\.js/']);
  assert.deepStrictEqual(U.toFilters({ action: { type: 'allowAllRequests' }, condition: { urlFilter: '||good.com^', resourceTypes: ['main_frame'] } }), ['@@||good.com^$document']);
  assert.deepStrictEqual(U.toFilters({ action: { type: 'modifyHeaders', requestHeaders: [{ header: 'x', operation: 'remove' }] }, condition: {} }), []); // not something Oto can do: left out
});

test('the uBOL rules that ship with Oto are a complete, checked set', () => {
  const dir = path.join(__dirname, '..', 'vendor-ubol');
  const details = JSON.parse(fs.readFileSync(path.join(dir, 'rulesets/scriptlet-details.json'), 'utf8'));
  for (const rel of U.filesOf(details)) {
    const f = path.join(dir, rel);
    if (rel.startsWith('rulesets/regex/') && !fs.existsSync(f)) continue; // not every ruleset has regex rules
    assert.ok(fs.existsSync(f), rel);
    assert.ok(U.looksRight(rel, fs.readFileSync(f)), rel);
  }
  assert.match(fs.readFileSync(path.join(dir, 'LICENSE.txt'), 'utf8'), /GNU GENERAL PUBLIC LICENSE/);
});

test('uBOL mode: network rules for every level, readable by Shield’s engine; scriptlets in uBOL’s framework', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-ubol-'));
  const ub = U({ appDir: path.join(__dirname, '..'), userFile: (f) => path.join(tmp, f), fetchBuf: async () => { throw new Error('offline'); } });
  const { FiltersEngine, NetworkFilter } = require('@ghostery/adblocker');
  const lines = ub.networkLines('balanced');
  assert.ok(lines.length > 50000, `${lines.length} lines`);
  const ok = lines.filter((l) => NetworkFilter.parse(l)).length;
  assert.ok(ok / lines.length > 0.97, `${ok}/${lines.length} readable`);
  assert.ok(ub.networkLines('strict').length > lines.length && ub.networkLines('basic').length < lines.length);
  const e = FiltersEngine.parse(lines.join('\n'));
  const { Request } = require('@ghostery/adblocker');
  assert.ok(e.match(Request.fromRawDetails({ url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', sourceUrl: 'https://example.com/', type: 'script' })).match);
  assert.ok(!e.match(Request.fromRawDetails({ url: 'https://example.com/app.js', sourceUrl: 'https://example.com/', type: 'script' })).match);
  const s = ub.scriptlets('balanced');
  assert.match(s.main, /^[\s\S]*uBOL_scriptletFrameworkBegin[\s\S]*ruleset: ublock-filters[\s\S]*uBOL_scriptletFrameworkEnd/);
  assert.match(s.isolated, /uBOL_scriptletFrameworkBegin/);
  const pre = fs.readFileSync(ub.preloadFile('balanced'), 'utf8');
  assert.match(pre, /ipcRenderer\.sendSync\('oto:page', location\.origin\)/);
  assert.match(pre, /if \(site\.ubol\)/);
  assert.match(pre, /executeInMainWorld\(\{ func: uBOLMain \}\)/);
  new Function(pre); // eslint-disable-line no-new-func -- it parses
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('uBOL’s rules come only with Oto: nothing is downloaded, and rules downloaded before are deleted, never run (1.7.12)', async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main', 'ubol.js'), 'utf8');
  assert.doesNotMatch(src, /raw\.githubusercontent|\bfetch\w*\(|net\.|require\('https?'\)/, 'main/ubol.js downloads nothing');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-ubol-'));
  // a set downloaded by an older Oto, with a script that isn't uBOL's, and a current.json pointing outside the folder
  const old = path.join(tmp, 'ubol', '2099.101.1');
  fs.mkdirSync(path.join(old, 'rulesets/scripting/scriptlet/main'), { recursive: true });
  fs.writeFileSync(path.join(old, 'manifest.json'), JSON.stringify({ version: '2099.101.1' }));
  fs.writeFileSync(path.join(old, 'rulesets/scripting/scriptlet/main/ublock-filters.js'), 'evil()');
  fs.writeFileSync(path.join(tmp, 'ubol', 'current.json'), JSON.stringify({ version: '../../outside' }));
  const ub = U({ appDir: path.join(__dirname, '..'), userFile: (f) => path.join(tmp, f) });
  const cur = ub.current();
  assert.ok(cur.bundled && cur.dir === path.join(__dirname, '..', 'vendor-ubol'));
  assert.ok(!fs.existsSync(path.join(tmp, 'ubol')), 'the old downloaded rules are deleted');
  assert.doesNotMatch(ub.scriptlets('balanced').main, /evil\(\)/);
  assert.strictEqual(await ub.update(true), false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('the uBOL preload is made from Oto’s copy every time: a changed file, or a link in its place, is never run (1.7.12)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-ubol-'));
  const ub = U({ appDir: path.join(__dirname, '..'), userFile: (f) => path.join(tmp, f) });
  const file = ub.preloadFile('balanced');
  const good = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, `${good}\nevil();`);
  assert.strictEqual(ub.preloadFile('balanced'), file);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), good, 'a changed preload is written again from Oto’s copy');
  const elsewhere = path.join(tmp, 'elsewhere.js');
  fs.writeFileSync(elsewhere, 'keep me');
  fs.rmSync(file); fs.symlinkSync(elsewhere, file);
  ub.preloadFile('balanced');
  assert.ok(!fs.lstatSync(file).isSymbolicLink() && fs.readFileSync(file, 'utf8') === good, 'a link in its place is replaced by the real file');
  assert.strictEqual(fs.readFileSync(elsewhere, 'utf8'), 'keep me', 'what the link pointed at is left alone');
  assert.throws(() => ub.preloadFile('../../x'), /unexpected/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('the uBOL copy Oto ships matches vendor-ubol/HASHES.json, file for file (1.7.12)', () => {
  const dir = path.join(__dirname, '..', 'vendor-ubol');
  const want = JSON.parse(fs.readFileSync(path.join(dir, 'HASHES.json'), 'utf8'));
  const { compute } = require('../scripts/ubol-hashes.js');
  assert.deepStrictEqual(compute(dir), want.files, 'vendor-ubol changed: run scripts/vendor-ubol.js (it records the new hashes)');
  assert.strictEqual(want.version, JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version);
  for (const rel of Object.keys(want.files)) if (rel.endsWith('.js')) assert.ok(U.looksRight(rel, fs.readFileSync(path.join(dir, rel))), rel);
});

test('YouTube gets uBOL’s scriptlets in both modes, and Oto’s own YouTube code only as a fallback (1.7.8)', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(main, /r\.ubol = on && SH\.mode\(\) === 'full' && \(SH\.engine\(\) === 'ubol' \|\| r\.ytWall\);/);
  assert.match(main, /r\.yt = r\.ytWall && !r\.ubol;/);
  const sh = fs.readFileSync(path.join(__dirname, '..', 'main', 'shield.js'), 'utf8');
  assert.match(sh, /const ubolPreloadAll = \(\) => \{ for \(const x of blockerSessions\) ubolPreload\(x, !!blocker\); \};/);
});
