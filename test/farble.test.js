'use strict';
// Fingerprint protection's common answers (page-preload.js otoFarble), checked outside a browser: CPU cores are 4 or
// 8 per site (never more than the PC has), languages are only the main one, and a page and a worker on the same site
// always get the same answers.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { otoFarble } = require('../page-preload.js');

// A tiny stand-in for a page (or a worker) that has what otoFarble touches here: navigator's cores and languages.
function realm({ cores, langs = ['el', 'el-GR', 'en'], worker = false }) {
  const ctx = vm.createContext({});
  vm.runInContext(`
    var NavCls = function () {};
    var list = Object.freeze(${JSON.stringify(langs)});
    Object.defineProperty(NavCls.prototype, 'hardwareConcurrency', { get: function hardwareConcurrency() { return ${cores}; }, configurable: true, enumerable: true });
    Object.defineProperty(NavCls.prototype, 'languages', { get: function languages() { return list; }, configurable: true, enumerable: true });
    var navigator = new NavCls();
    ${worker ? 'var WorkerNavigator = NavCls; var self = this;' : 'var Navigator = NavCls; var window = this; var document = {};'}
  `, ctx);
  return ctx;
}
const run = (seed, opts) => { const ctx = realm(opts); vm.runInContext(`(${otoFarble})(${seed})`, ctx); return vm.runInContext('({ cores: navigator.hardwareConcurrency, langs: navigator.languages, same: navigator.languages === navigator.languages, looks: Function.prototype.toString.call(Object.getOwnPropertyDescriptor((typeof Navigator === "function" ? Navigator : WorkerNavigator).prototype, "hardwareConcurrency").get) })', ctx); };
const seeds = Array.from({ length: 64 }, (_, i) => (Math.imul(i + 1, 2654435761) >>> 0) || 1);

test('CPU cores: 4 or 8 per site on a PC with 8 or more, both answers occur, the same seed gives the same answer', () => {
  for (const real of [8, 12, 16, 32]) {
    const got = seeds.map((s) => run(s, { cores: real }).cores);
    assert.ok(got.every((n) => n === 4 || n === 8), `${real}: ${got}`);
    assert.ok(got.includes(4) && got.includes(8), `${real}: both 4 and 8 should occur across sites`);
    assert.deepStrictEqual(seeds.map((s) => run(s, { cores: real }).cores), got);
  }
});

test('CPU cores: a PC with 4 to 7 always says 4, a PC with fewer keeps its own number', () => {
  for (const real of [4, 6, 7]) assert.ok(seeds.every((s) => run(s, { cores: real }).cores === 4), String(real));
  for (const real of [1, 2, 3]) assert.ok(seeds.every((s) => run(s, { cores: real }).cores === real), String(real));
});

test('a page and a worker on the same site get the same answers', () => {
  for (const s of seeds.slice(0, 16)) {
    const p = run(s, { cores: 16 }), w = run(s, { cores: 16, worker: true });
    assert.strictEqual(w.cores, p.cores);
    assert.deepStrictEqual([...w.langs], [...p.langs]);
  }
});

test('languages: only the main one, the same list object every time', () => {
  const r = run(seeds[0], { cores: 8 });
  assert.deepStrictEqual([...r.langs], ['el']);
  assert.strictEqual(r.same, true);
  assert.deepStrictEqual([...run(seeds[0], { cores: 8, langs: [] }).langs], []);
});

test('the replaced getter still looks like the original', () => {
  assert.match(run(seeds[0], { cores: 8 }).looks, /function hardwareConcurrency\(\) \{ return 8; \}/);
});
