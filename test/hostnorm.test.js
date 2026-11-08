'use strict';
// Aegis 7.2: Oto Shield compares the same host the same way, however the address was written.
const test = require('node:test');
const assert = require('node:assert');
const { normHost, hostAndParents, parseHostList } = require('../main/hostnorm.js');

test('case, trailing dots and brackets', () => {
  assert.strictEqual(normHost('EVIL.Example'), 'evil.example');
  assert.strictEqual(normHost('evil.example.'), 'evil.example');
  assert.strictEqual(normHost('evil.example...'), 'evil.example');
  assert.strictEqual(normHost('[::1]'), '::1');
  assert.strictEqual(normHost('[2001:DB8::1]'), '2001:db8::1');
});

test('international domain names become the form browsers send', () => {
  assert.strictEqual(normHost('bücher.example'), 'xn--bcher-kva.example');
  assert.strictEqual(normHost('XN--BCHER-KVA.example'), 'xn--bcher-kva.example');
  assert.strictEqual(normHost('раураl.example'), normHost(new URL('http://раураl.example/').hostname), 'same as the URL parser (Cyrillic lookalike)');
});

test('other ways of writing an IPv4 address', () => {
  for (const h of ['2130706433', '0x7f000001', '0x7f.0.0.1', '0177.0.0.1', '127.1', '127.0.0.1']) assert.strictEqual(normHost(h), '127.0.0.1', h);
  assert.strictEqual(normHost(new URL('http://0x7f.1/').hostname), '127.0.0.1', 'matches what the browser resolves');
});

test('junk is refused, never half-matched', () => {
  for (const bad of ['', '   ', 'evil example', 'evil/example', 'a'.repeat(2000), 'evil.example:8080/path', '<script>']) assert.strictEqual(normHost(bad), '', JSON.stringify(bad).slice(0, 30));
});

test('parents are checked for names, but never partial labels, and IPs only exactly', () => {
  assert.deepStrictEqual(hostAndParents('A.Sub.Evil.Example.'), ['a.sub.evil.example', 'sub.evil.example', 'evil.example']);
  assert.ok(!hostAndParents('notevil.example').includes('evil.example'), 'no partial label match');
  assert.deepStrictEqual(hostAndParents('10.1.2.3'), ['10.1.2.3'], 'no "1.2.3" parents for IPs');
  assert.deepStrictEqual(hostAndParents('[fe80::1]'), ['fe80::1'], 'IPv6 is checked (was skipped before 1.4.0)');
});

test('downloaded lists: hosts cleaned, hosts-file lines read, junk and tiny or huge lists refused', () => {
  const lines = ['# comment', '! comment', 'Evil.Example.', '0.0.0.0 tracker.example', '127.0.0.1 x.example', 'not a host line', 'bücher.example', '[2001:db8::66]'];
  for (let i = 0; i < 100; i++) lines.push(`bad${i}.example`);
  const list = parseHostList(lines.join('\n'));
  for (const h of ['evil.example', 'tracker.example', 'x.example', 'xn--bcher-kva.example', '2001:db8::66']) assert.ok(list.includes(h), h);
  assert.ok(!list.some((h) => /\s|#|!/.test(h)));
  assert.strictEqual(parseHostList('evil.example\n'), null, 'too few entries to be a real list');
  assert.strictEqual(parseHostList('<html>Error 503</html>\n'.repeat(500)), null, 'an error page is not a list');
  assert.strictEqual(parseHostList('a.example\n'.repeat(10), { minHosts: 1, maxBytes: 50 }), null, 'over the size limit');
});

test('Shield uses this for list lookups, cached lists and downloads (and keeps the old list if a new one shrank suspiciously)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'main', 'shield.js'), 'utf8');
  assert.match(src, /const all = hostAndParents\(host\);/);
  assert.match(src, /parseHostList\(await r\.text\(\)\)/);
  assert.match(src, /list\.length < prev \* 0\.25/);
  assert.match(src, /map\(normHost\)/, 'cached lists normalized too');
});
