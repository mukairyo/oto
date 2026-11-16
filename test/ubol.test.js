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

test('a daily uBOL update only takes a complete set that looks like uBOL’s', async () => {
  assert.ok(!U.looksRight('rulesets/scripting/scriptlet/main/x.js', Buffer.from('alert(1)')));
  assert.ok(!U.looksRight('rulesets/main/x.json', Buffer.from('{"not":"rules"}')));
  assert.ok(U.looksRight('rulesets/main/x.json', Buffer.from('[]')));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-ubol-'));
  const files = { 'manifest.json': JSON.stringify({ version: '2099.101.1' }), 'rulesets/scriptlet-details.json': '[]' };
  const ub = U({ appDir: path.join(__dirname, '..'), userFile: (f) => path.join(tmp, f), fetchBuf: async (url) => { const rel = url.split('/chromium/')[1]; if (rel in files) return Buffer.from(files[rel]); if (rel.startsWith('rulesets/main/')) return Buffer.from('[]'); if (rel === 'LICENSE.txt') return Buffer.from('GNU GENERAL PUBLIC LICENSE'); if (rel.endsWith('.js')) return Buffer.from('evil()'); const e = new Error('404'); e.status = 404; throw e; } });
  const before = ub.current().version;
  assert.strictEqual(await ub.update(true), false); // scripts that aren't uBOL's: refused, nothing changes
  assert.strictEqual(ub.current().version, before);
  assert.ok(ub.current().bundled);
  fs.rmSync(tmp, { recursive: true, force: true });
});
