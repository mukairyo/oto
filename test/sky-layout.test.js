'use strict';
// Sky View's layout engine (src/sky.js): stable places. Nothing that's already in the sky moves when tabs, sites or
// Spaces come and go; new things take the nearest free place; positions only depend on what was saved.
const test = require('node:test');
const assert = require('node:assert');
const { skyLayout, skyAssign, skySlots, skyShape } = require('../src/sky.js');

const tab = (id, ws, key) => ({ id, ws, key, keyName: key });
const pos = (lay) => Object.fromEntries(lay.groups.flatMap((g) => g.stars.map((s) => [s.id, [Math.round(s.x), Math.round(s.y)]])));

test('the same tabs give the same sky', () => {
  const tabs = [tab('a', 'w1', 'x.com'), tab('b', 'w1', 'x.com'), tab('c', 'w2', 'y.com')];
  const sp = [{ id: 'w1' }, { id: 'w2' }];
  assert.deepStrictEqual(pos(skyLayout(tabs, sp, {})), pos(skyLayout(tabs, sp, {})));
});

test('a new tab never moves the stars already there', () => {
  const sp = [{ id: 'w1' }, { id: 'w2' }];
  const one = skyLayout([tab('a', 'w1', 'x.com'), tab('b', 'w1', 'x.com'), tab('c', 'w2', 'y.com')], sp, {});
  const two = skyLayout([tab('a', 'w1', 'x.com'), tab('b', 'w1', 'x.com'), tab('c', 'w2', 'y.com'), tab('d', 'w1', 'x.com'), tab('e', 'w1', 'z.com')], sp, one.state);
  for (const id of ['a', 'b', 'c']) assert.deepStrictEqual(pos(two)[id], pos(one)[id], id);
});

test('closing a tab never moves the others (its place just stays free)', () => {
  const sp = [{ id: 'w1' }];
  const one = skyLayout([tab('a', 'w1', 'x.com'), tab('b', 'w1', 'x.com'), tab('c', 'w1', 'x.com')], sp, {});
  const two = skyLayout([tab('a', 'w1', 'x.com'), tab('c', 'w1', 'x.com')], sp, one.state);
  assert.deepStrictEqual(pos(two).a, pos(one).a);
  assert.deepStrictEqual(pos(two).c, pos(one).c);
  // and a new tab takes the free place
  const three = skyLayout([tab('a', 'w1', 'x.com'), tab('c', 'w1', 'x.com'), tab('n', 'w1', 'x.com')], sp, two.state);
  assert.deepStrictEqual(pos(three).n, pos(one).b);
});

test('a new Space never moves the Spaces already there', () => {
  const one = skyLayout([tab('a', 'w1', 'x.com'), tab('b', 'w2', 'y.com')], [{ id: 'w1' }, { id: 'w2' }], {});
  const two = skyLayout([tab('a', 'w1', 'x.com'), tab('b', 'w2', 'y.com')], [{ id: 'w0' }, { id: 'w1' }, { id: 'w2' }], one.state);
  assert.deepStrictEqual(two.state.cells.w1, one.state.cells.w1);
  assert.deepStrictEqual(two.state.cells.w2, one.state.cells.w2);
});

test('a star you dragged stays where you put it', () => {
  const sp = [{ id: 'w1' }];
  const one = skyLayout([tab('a', 'w1', 'x.com')], sp, {});
  const st = { ...one.state, offsets: { a: [40, -25] } };
  const two = skyLayout([tab('a', 'w1', 'x.com')], sp, st);
  assert.deepStrictEqual(pos(two).a, [pos(one).a[0] + 40, pos(one).a[1] - 25]);
});

test('only places of things that still exist are saved', () => {
  const one = skyLayout([tab('a', 'w1', 'x.com'), tab('b', 'w2', 'y.com')], [{ id: 'w1' }, { id: 'w2' }], {});
  const two = skyLayout([tab('a', 'w1', 'x.com')], [{ id: 'w1' }], one.state);
  assert.deepStrictEqual(Object.keys(two.state.cells), ['w1']);
  assert.deepStrictEqual(Object.keys(two.state.slots), ['a']);
});

test('helpers: places are unique, earlier constellation places never change', () => {
  const p = skyAssign(['a', 'b', 'c'], { b: [0, 0] }, [[0, 0], [1, 0], [0, 1]]);
  assert.deepStrictEqual(p.b, [0, 0]);
  assert.strictEqual(new Set(Object.values(p).map(String)).size, 3);
  assert.deepStrictEqual(skySlots(['x', 'y', 'z'], { y: 0, z: 0 }), { y: 0, x: 1, z: 2 }); // the duplicate gets a free place, in tab order
  assert.deepStrictEqual(skyShape('k', 3), skyShape('k', 6).slice(0, 3));
});

// ---- Galaxy view: each Space a spiral arm, the middle is now, further out = longer ago
const { galaxyLayout, GAL } = require('../src/sky.js');
const NOW = 1_800_000_000_000;
const gt = (id, ws, minutesAgo, extra = {}) => ({ id, ws, essential: false, active: false, lastActive: NOW - minutesAgo * 60000, ...extra });

test('galaxy: one arm per Space', () => {
  const g = galaxyLayout([gt('a', 'w1', 5), gt('b', 'w2', 5)], [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }], NOW);
  assert.deepStrictEqual(g.arms.map((a) => a.ws), ['w1', 'w2', 'w3']);
});

test('galaxy: the longer ago a tab was used, the further out it sits', () => {
  const g = galaxyLayout([gt('old', 'w1', 60 * 24 * 5), gt('new', 'w1', 2), gt('mid', 'w1', 90)], [{ id: 'w1' }], NOW);
  const r = Object.fromEntries(g.stars.map((s) => [s.id, s.r]));
  assert.ok(r.new < r.mid && r.mid < r.old, JSON.stringify(r));
});

test('galaxy: the tab you are on is nearest the middle; Essentials circle the core', () => {
  const g = galaxyLayout([gt('x', 'w1', 1), gt('on', 'w1', 600, { active: true }), gt('e', null, 0, { essential: true })], [{ id: 'w1' }], NOW);
  const by = Object.fromEntries(g.stars.map((s) => [s.id, s]));
  assert.ok(by.on.r < by.x.r);
  assert.strictEqual(by.e.ws, '__essentials'); assert.strictEqual(by.e.r, GAL.CORE);
});

test('galaxy: tabs used at the same moment still get their own place on the arm', () => {
  const g = galaxyLayout([gt('a', 'w1', 10), gt('b', 'w1', 10), gt('c', 'w1', 10)], [{ id: 'w1' }], NOW);
  const rs = g.stars.map((s) => s.r).sort((x, y) => x - y);
  assert.ok(rs[1] - rs[0] >= 52 && rs[2] - rs[1] >= 52, JSON.stringify(rs));
});

test('galaxy: rings for 1 hour, 1 day and 1 week, in order', () => {
  const g = galaxyLayout([], [{ id: 'w1' }], NOW);
  assert.deepStrictEqual(g.rings.map((x) => x[0]), ['1 HOUR', '1 DAY', '1 WEEK']);
  assert.ok(g.rings[0][1] < g.rings[1][1] && g.rings[1][1] < g.rings[2][1]);
});
