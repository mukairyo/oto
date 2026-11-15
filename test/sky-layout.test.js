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

// ---- the free sky (1.7.1): stars stay where you put them; groups are the lines you draw
const { skyFree } = require('../src/sky.js');
const T = (id, key) => ({ id, key, keyName: key });
const at = (l) => Object.fromEntries(l.stars.map((s) => [s.id, [s.x, s.y]]));

test('free sky: stars keep the places you gave them', () => {
  const one = skyFree([T('a', 'x'), T('b', 'y')], {});
  one.state.pos.a = [999, -40];
  const two = skyFree([T('a', 'x'), T('b', 'y'), T('c', 'z')], one.state);
  assert.deepStrictEqual(at(two).a, [999, -40]);
  assert.deepStrictEqual(at(two).b, at(one).b);
});

test('free sky: a new tab joins its site’s stars with a line, a new site stands alone', () => {
  const one = skyFree([T('a', 'yt'), T('b', 'gh')], {});
  const two = skyFree([T('a', 'yt'), T('b', 'gh'), T('c', 'yt')], one.state);
  assert.ok(two.edges.some((e) => e.join() === 'a,c'));
  const g = two.groups.find((x) => x.ids.includes('c'));
  assert.deepStrictEqual(g.ids.sort(), ['a', 'c']);
  assert.strictEqual(g.name, 'yt');
  assert.ok(two.groups.find((x) => x.ids.includes('b')).lone);
  // never on top of another star
  const p = at(two); assert.ok(Math.hypot(p.c[0] - p.a[0], p.c[1] - p.a[1]) >= 90);
});

test('free sky: joining stars of different sites makes one group with an invented name that stays', () => {
  const one = skyFree([T('a', 'yt'), T('b', 'gh')], {});
  one.state.edges.push(['a', 'b']);
  const two = skyFree([T('a', 'yt'), T('b', 'gh')], one.state);
  assert.strictEqual(two.groups.length, 1);
  const name = two.groups[0].name;
  assert.ok(name !== 'yt' && name !== 'gh' && name.length >= 4);
  assert.strictEqual(skyFree([T('a', 'yt'), T('b', 'gh'), T('n', 'zz')], two.state).groups.find((g) => g.ids.includes('a')).name, name);
});

test('free sky: closing the star that held a group together keeps the group whole', () => {
  const s0 = { pos: { a: [0, 0], b: [100, 0], c: [200, 0] }, edges: [['a', 'b'], ['b', 'c']], names: { a: 'Velis', b: 'Velis', c: 'Velis' } };
  const l = skyFree([T('a', 'x'), T('c', 'y')], s0);
  assert.deepStrictEqual(l.edges, [['a', 'c']]);
  assert.strictEqual(l.groups.length, 1);
  assert.strictEqual(l.groups[0].name, 'Velis');
});

test('free sky: the first time, every star starts where the old layout had it', () => {
  const l = skyFree([T('a', 'x'), T('b', 'x')], {}, { pos: { a: [10, 20], b: [110, 20] }, edges: [['a', 'b']] });
  assert.deepStrictEqual(at(l), { a: [10, 20], b: [110, 20] });
  assert.strictEqual(l.groups.length, 1);
});
