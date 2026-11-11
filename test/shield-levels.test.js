'use strict';
// Oto Shield protection levels (main/shield-levels.js): Standard, Strict and Custom, and settings from before 1.5.
const test = require('node:test');
const assert = require('node:assert');
const LV = require('../main/shield-levels.js');
const { extraFilters } = require('../trackers.js');

test('a new user gets Standard: ads, trackers and session recorders blocked, fingerprint protection, safer calls', () => {
  assert.deepStrictEqual(LV.featuresOf({}), { mode: 'standard', lists: 'balanced', recorders: true, fp: true, webrtc: 'route' });
  assert.deepStrictEqual(LV.featuresOf(undefined), LV.featuresOf({}));
});

test('settings from before 1.5 mean the same as they did', () => {
  assert.strictEqual(LV.modeOf({ level: 'balanced' }), 'standard');
  assert.strictEqual(LV.modeOf({ level: 'strict', annoy: true }), 'strict');
  assert.strictEqual(LV.modeOf({ annoy: true }), 'strict'); // the oldest form: only the "annoyances" switch
  // Basic was "ads only": it stays ads only, now shown as Custom
  assert.deepStrictEqual(LV.featuresOf({ level: 'basic' }), { mode: 'custom', lists: 'basic', recorders: false, fp: true, webrtc: 'route' });
  // someone who had switched fingerprint protection off keeps it off
  assert.deepStrictEqual(LV.featuresOf({ level: 'balanced', fp: false }), { mode: 'custom', lists: 'balanced', recorders: true, fp: false, webrtc: 'route' });
  assert.deepStrictEqual(LV.featuresOf({ level: 'strict', fp: false }), { mode: 'custom', lists: 'strict', recorders: true, fp: false, webrtc: 'route' });
});

test('Strict adds the annoyance lists and tells calls less about the network', () => {
  const c = {};
  assert.strictEqual(LV.setMode(c, 'strict'), true);
  assert.deepStrictEqual(LV.featuresOf(c), { mode: 'strict', lists: 'strict', recorders: true, fp: true, webrtc: 'public' });
  assert.strictEqual(c.level, 'strict'); assert.strictEqual(c.annoy, true); // readable by an older Oto too
});

test('choosing Custom changes nothing by itself; each switch changes one thing', () => {
  const c = {};
  LV.setMode(c, 'strict'); LV.setMode(c, 'custom');
  assert.deepStrictEqual(LV.featuresOf(c), { mode: 'custom', lists: 'strict', recorders: true, fp: true, webrtc: 'public' });
  assert.strictEqual(LV.setFeature(c, 'annoyances', false), true); assert.strictEqual(LV.featuresOf(c).lists, 'balanced');
  LV.setFeature(c, 'trackers', false); assert.strictEqual(LV.featuresOf(c).lists, 'basic');
  assert.strictEqual(LV.featuresOf(c).recorders, true, 'recorders have their own switch');
  LV.setFeature(c, 'trackers', true); assert.strictEqual(LV.featuresOf(c).lists, 'balanced');
  LV.setFeature(c, 'annoyances', true); assert.strictEqual(LV.featuresOf(c).lists, 'strict');
  LV.setFeature(c, 'recorders', false); LV.setFeature(c, 'fp', false); LV.setFeature(c, 'webrtc', 'off');
  assert.deepStrictEqual(LV.featuresOf(c), { mode: 'custom', lists: 'strict', recorders: false, fp: false, webrtc: 'off' });
});

test('flipping a switch in Standard moves to Custom and keeps everything else', () => {
  const c = {};
  LV.setFeature(c, 'recorders', false);
  assert.deepStrictEqual(LV.featuresOf(c), { mode: 'custom', lists: 'balanced', recorders: false, fp: true, webrtc: 'route' });
  LV.setMode(c, 'standard'); // "Restore defaults"
  assert.deepStrictEqual(LV.featuresOf(c), { mode: 'standard', lists: 'balanced', recorders: true, fp: true, webrtc: 'route' });
});

test('wrong input is refused and changes nothing', () => {
  const c = {}, before = JSON.stringify(c);
  assert.strictEqual(LV.setMode(c, 'ultra'), false);
  assert.strictEqual(LV.setFeature(c, 'webrtc', 'nope'), false);
  assert.strictEqual(LV.setFeature(c, 'fp', 'yes'), false);
  assert.strictEqual(LV.setFeature(c, '__proto__', true), false);
  assert.strictEqual(JSON.stringify(c), before);
});

test('the older level names still work (other parts of Oto and old builds use them)', () => {
  const c = {};
  LV.setMode(c, 'balanced'); assert.strictEqual(LV.modeOf(c), 'standard');
  LV.setMode(c, 'basic'); assert.deepStrictEqual(LV.featuresOf(c), { mode: 'custom', lists: 'basic', recorders: false, fp: true, webrtc: 'route' });
});

test('WebRTC: the Chromium setting per level, and the default when Shield is off for a site', () => {
  assert.strictEqual(LV.webrtcPolicy(LV.featuresOf({}), false), 'default_public_and_private_interfaces');
  assert.strictEqual(LV.webrtcPolicy(LV.featuresOf({ mode: 'strict' }), false), 'default_public_interface_only');
  assert.strictEqual(LV.webrtcPolicy(LV.featuresOf({ mode: 'strict' }), true), 'default');
  assert.strictEqual(LV.webrtcPolicy(LV.featuresOf({ mode: 'custom', webrtc: 'off' }), false), 'default');
});

test('session recorders follow their own switch in Oto\'s rules', () => {
  const has = (list) => list.includes('||hotjar.com^$third-party');
  assert.ok(has(extraFilters('balanced')) && has(extraFilters('strict')) && !has(extraFilters('basic')));
  assert.ok(!has(extraFilters('balanced', { recorders: false })) && has(extraFilters('basic', { recorders: true })));
});
