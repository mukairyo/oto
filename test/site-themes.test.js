'use strict';
// Classic Roblox and YouTube in Oto's look set up their page hooks the moment their files load, even when start-up
// hasn't read the saved state yet ("S" still undefined). Before 1.9.2 they waited for S; on a slower start (more
// tabs, a busier PC) the hooks were never set up and the look only went on when Settings changed.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['roblox-classic.js', 'youtube-space.js']) {
  test(`${file}: page hooks are set up even before the saved state is read`, () => {
    const intervals = [];
    const original = function bindView() {};
    const ctx = {
      bindView: original, console, Promise, WeakSet, Uint8Array, String, Object, Math, JSON, Number, Array, Error,
      setInterval: (fn, ms) => { intervals.push(ms); return 1; }, setTimeout: () => 1, clearTimeout: () => {},
      fetch: () => Promise.reject(new Error('no files here')), btoa: (b) => Buffer.from(b, 'binary').toString('base64'),
      encodeURIComponent,
    };
    vm.createContext(ctx);
    vm.runInContext(`let S;\n${fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8')}`, ctx);
    assert.notStrictEqual(ctx.bindView, original, 'new tabs get the hooks');
    assert.ok(intervals.includes(1000), 'and a sweep hooks tabs made before that');
  });
}
