'use strict';
// A Web Store extension update that asks for more than you approved is switched off until you say yes (1.7.13).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { permsOf, added, store } = require('../main/ext-perms.js');

test('permissions are read from API permissions, host permissions and content scripts', () => {
  const m = { permissions: ['storage', 'tabs', 'https://a.example/*'], host_permissions: ['https://b.example/*'], content_scripts: [{ matches: ['<all_urls>'] }] };
  assert.deepStrictEqual(permsOf(m), ['api:storage', 'api:tabs', 'site:<all_urls>', 'site:https://a.example/*', 'site:https://b.example/*']);
  assert.deepStrictEqual(permsOf(null), []);
  assert.deepStrictEqual(permsOf({ permissions: 'nope', content_scripts: [null, { matches: [5] }] }), []);
});

test('an update asking for more is noticed; the same or less is not', () => {
  const v1 = permsOf({ permissions: ['storage'], host_permissions: ['https://a.example/*'] });
  assert.deepStrictEqual(added(v1, permsOf({ permissions: ['storage'], host_permissions: ['https://a.example/*'] })), []);
  assert.deepStrictEqual(added(v1, permsOf({ permissions: [] })), []);
  assert.deepStrictEqual(added(v1, permsOf({ permissions: ['storage', 'cookies'], host_permissions: ['<all_urls>'] })), ['api:cookies', 'site:<all_urls>']);
  assert.deepStrictEqual(added(v1, permsOf({ permissions: ['storage'], content_scripts: [{ matches: ['https://bank.example/*'] }] })), ['site:https://bank.example/*'], 'a new content-script site counts');
});

test('approvals are kept per extension, and a damaged file means nothing approved', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-ext-'));
  const f = path.join(dir, 'extension-approvals.json');
  const s = store(f);
  assert.strictEqual(s.get('abc'), null);
  s.set('abc', ['api:storage']); s.set('def', ['api:tabs']);
  assert.deepStrictEqual(store(f).get('abc'), ['api:storage']);
  fs.writeFileSync(f, '{broken');
  assert.strictEqual(store(f).get('abc'), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('extensions.js switches a Web Store extension off when an update asks for more, and records approvals on install', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main', 'extensions.js'), 'utf8');
  assert.match(src, /api\.on\('extension-loaded'/);
  assert.match(src, /const extra = P\.added\(was, now\);[\s\S]{0,200}api\.removeExtension\(ext\.id\)/);
  assert.match(src, /buttons: \['Keep it off', 'Allow and turn it on'\], defaultId: 0, cancelId: 0/);
  assert.match(src, /approvals\(\)\.set\(details\.id, require\('\.\/ext-perms\.js'\)\.permsOf\(details\.manifest\)\)/);
  assert.match(src, /watchStoreUpdates\(ses\);\n\s+const \{ installChromeWebStore \}/, 'watching starts before the library loads or updates anything');
});
