'use strict';
// A download that opens its own new tab must not leave a white, empty tab behind (main/download-tab.js).
const test = require('node:test');
const assert = require('node:assert');
const { isBlankTab, closer } = require('../main/download-tab.js');

const wc = (url, type = 'webview', extra = {}) => ({ id: 7, getURL: () => url, getType: () => type, isDestroyed: () => false, ...extra });

test('a browser tab that never showed a page counts as blank', () => {
  assert.strictEqual(isBlankTab(wc('')), true);
  assert.strictEqual(isBlankTab(wc('about:blank')), true);
});

test('a tab showing a page, the Oto window itself, or nothing at all is never closed', () => {
  assert.strictEqual(isBlankTab(wc('https://example.com/')), false);
  assert.strictEqual(isBlankTab(wc('', 'window')), false);
  assert.strictEqual(isBlankTab(null), false);
  assert.strictEqual(isBlankTab(wc('', 'webview', { isDestroyed: () => true })), false);
  assert.strictEqual(isBlankTab(wc('', 'webview', { getURL: () => { throw new Error('gone'); } })), false);
});

test('the close is sent once, and waits for the Save dialog when one is open', () => {
  const sent = [];
  let savePath = '';
  const close = closer(wc(''), { getSavePath: () => savePath }, (id) => sent.push(id));
  close(); // Save dialog still open: wait
  assert.deepStrictEqual(sent, []);
  savePath = '/home/me/Downloads/file.zip';
  close(); close(); close(true);
  assert.deepStrictEqual(sent, [7]);
});

test('a cancelled Save dialog still closes the empty tab', () => {
  const sent = [];
  const close = closer(wc(''), { getSavePath: () => '' }, (id) => sent.push(id));
  close(true);
  assert.deepStrictEqual(sent, [7]);
});

test('downloads from a page that is showing never close anything', () => {
  const sent = [];
  const close = closer(wc('https://example.com/'), { getSavePath: () => '/x' }, (id) => sent.push(id));
  close(); close(true);
  assert.deepStrictEqual(sent, []);
});
