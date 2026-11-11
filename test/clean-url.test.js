'use strict';
// Click identifiers are removed from an address when a page is opened (main/clean-url.js); nothing else changes.
const test = require('node:test');
const assert = require('node:assert');
const { cleanNavigation } = require('../main/clean-url.js');

test('click identifiers are removed, everything else stays exactly as it was', () => {
  assert.strictEqual(cleanNavigation('https://shop.example/p/42?fbclid=IwAR0abc&color=red'), 'https://shop.example/p/42?color=red');
  assert.strictEqual(cleanNavigation('https://shop.example/p/42?color=red&gclid=Cj0K&size=m#reviews'), 'https://shop.example/p/42?color=red&size=m#reviews');
  assert.strictEqual(cleanNavigation('https://news.example/a?msclkid=1&twclid=2&ttclid=3'), 'https://news.example/a');
  assert.strictEqual(cleanNavigation('https://news.example/a?FBCLID=1#x'), 'https://news.example/a#x');
  assert.strictEqual(cleanNavigation('https://example.com/?q=a%20b+c&mc_eid=9&next=%2Fhome%3Fa%3D1'), 'https://example.com/?q=a%20b+c&next=%2Fhome%3Fa%3D1', 'no re-encoding of what is kept');
});

test('nothing to remove means no change at all', () => {
  for (const u of ['https://example.com/', 'https://example.com/?q=fbclid', 'https://example.com/?page=2#gclid=1', 'https://example.com/path/fbclid=1', 'https://example.com/?a=1&b=2']) assert.strictEqual(cleanNavigation(u), '', u);
});

test('campaign labels, affiliate parameters and everyday names are left alone', () => {
  for (const u of ['https://example.com/?utm_source=newsletter&utm_campaign=spring', 'https://shop.example/?ref=friend&irclickid=abc&tag=site-20', 'https://youtu.be/abc?si=xyz&t=30', 'https://example.com/?id=5&s=term&ref_src=x']) assert.strictEqual(cleanNavigation(u), '', u);
});

test('only web addresses, and never an error on odd input', () => {
  for (const u of ['file:///C:/a?fbclid=1', 'data:text/html,?fbclid=1', 'chrome-extension://abc/p.html?gclid=1', '', null, undefined, 42, `https://example.com/?fbclid=${'a'.repeat(9000)}`]) assert.strictEqual(cleanNavigation(u), '');
  assert.strictEqual(cleanNavigation('https://example.com/?%E0%A4%A=1&fbclid=2&&=&x'), 'https://example.com/?%E0%A4%A=1&&=&x');
});

test('a cleaned address has nothing left to clean (no redirect loop)', () => {
  const once = cleanNavigation('https://example.com/?gclid=1&a=1&fbclid=2&fbclid=3');
  assert.strictEqual(once, 'https://example.com/?a=1');
  assert.strictEqual(cleanNavigation(once), '');
});
