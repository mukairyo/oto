'use strict';
// Audit item 04: only Oto's own window can use Oto's message channels.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { fakeIpcMain } = require('./_mock-electron.js');
const guardIPC = require('../main/ipc-guard.js');

const APP = path.join(__dirname, '..');
const UI = pathToFileURL(path.join(APP, 'src', 'index.html')).href;
const ev = (type, url, parent = null) => ({ sender: { isDestroyed: () => false, getType: () => type }, senderFrame: { url, parent } });

function setup() {
  const ipc = fakeIpcMain();
  const raw = { handle: ipc.handle, on: ipc.on };
  guardIPC(ipc, APP);
  let ran = 0;
  ipc.handle('pw:list', () => { ran++; return ['secret']; });
  ipc.on('shot:open', (e) => { ran++; e.returnValue = 'done'; });
  ipc.on('oto:page', (e) => { ran++; e.returnValue = { fp: 1 }; });
  ipc.handle('crx-msg', () => { ran++; return 'ext'; });
  return { ipc, raw, count: () => ran };
}

test("Oto's window (normal and private) is allowed", () => {
  const { ipc } = setup();
  assert.deepStrictEqual(ipc.invoke('pw:list', ev('window', UI)), ['secret']);
  assert.deepStrictEqual(ipc.invoke('pw:list', ev('window', `${UI}?avocado=1`)), ['secret']);
});

test('web pages, frames, app windows and extension pages are refused', () => {
  const { ipc, count } = setup();
  const silence = console.warn; console.warn = () => {};
  try {
    for (const e of [ev('webview', 'https://evil.example/'), ev('window', 'https://evil.example/'), ev('window', UI, {}), ev('window', 'chrome-extension://abc/popup.html'), ev('webview', UI)]) {
      assert.throws(() => ipc.invoke('pw:list', e), /Not allowed/);
      const sync = { ...e }; ipc.emit('shot:open', sync); assert.strictEqual(sync.returnValue, null);
    }
  } finally { console.warn = silence; }
  assert.strictEqual(count(), 0, 'no handler ran');
});

test('channels meant for pages and libraries stay open', () => {
  const { ipc } = setup();
  const e = ev('webview', 'https://site.example/');
  ipc.emit('oto:page', e);
  assert.deepStrictEqual(e.returnValue, { fp: 1 });
  assert.strictEqual(ipc.invoke('crx-msg', e), 'ext');
});

test('oversized messages are refused', () => {
  const { ipc } = setup();
  const silence = console.warn; console.warn = () => {};
  try { assert.throws(() => ipc.invoke('pw:list', ev('window', UI), 'x'.repeat(65 * 1024 * 1024)), /Not allowed/); } finally { console.warn = silence; }
});

test('the ad blocker can protect several sessions at once (shared handlers are counted)', () => {
  const ipc = fakeIpcMain();
  ipc.handle = function (ch, fn) { if (this.handlers.has(ch)) throw new Error(`Attempted to register a second handler for '${ch}'`); this.handlers.set(ch, fn); };
  ipc.removeHandler = function (ch) { this.handlers.delete(ch); };
  guardIPC(ipc, APP);
  const ch = '@ghostery/adblocker/inject-cosmetic-filters';
  assert.doesNotThrow(() => { ipc.handle(ch, () => 'a'); ipc.handle(ch, () => 'b'); ipc.handle(ch, () => 'c'); });
  ipc.removeHandler(ch); ipc.removeHandler(ch);
  assert.ok(ipc.handlers.has(ch), 'still there while one session uses it');
  ipc.removeHandler(ch);
  assert.ok(!ipc.handlers.has(ch), 'gone after the last session switches off');
});
