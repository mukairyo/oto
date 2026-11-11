'use strict';
// Which page is a request for? (main/request-source.js) The filter lists apply most tracker rules "on other sites
// only", so the answer decides whether a tracker is blocked. It must not depend on the page sending a Referer header.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { FiltersEngine, Request } = require('@ghostery/adblocker');
const { requestSource, withSource } = require('../main/request-source.js');

const frame = (url, parent) => ({ url, parent: parent || null });

test('the Referer is used when the page sends one', () => {
  assert.strictEqual(requestSource({ referrer: 'https://news.example/story', frame: frame('https://other.example/') }), 'https://news.example/story');
  const d = { referrer: 'https://news.example/', url: 'https://t.example/x' };
  assert.strictEqual(withSource(d), d, 'the request is passed on untouched');
});

test('without a Referer, the frame that makes the request says which page it is for', () => {
  assert.strictEqual(requestSource({ referrer: '', frame: frame('https://quiet.example/page') }), 'https://quiet.example/page');
  // a frame's own document is asked for by the frame around it
  assert.strictEqual(requestSource({ referrer: '', resourceType: 'subFrame', frame: frame('about:blank', frame('https://quiet.example/')) }), 'https://quiet.example/');
  // frames with no address of their own act for the page around them
  assert.strictEqual(requestSource({ referrer: '', frame: frame('about:blank', frame('about:srcdoc', frame('https://quiet.example/'))) }), 'https://quiet.example/');
  assert.strictEqual(requestSource({ referrer: '', frame: frame('blob:https://quiet.example/1234', frame('https://quiet.example/')) }), 'https://quiet.example/');
  assert.strictEqual(requestSource({ referrer: 'about:client', frame: frame('https://quiet.example/') }), 'https://quiet.example/', 'a Referer that is not a web address counts as none');
});

test('no frame (a worker, a frame that is gone): the tab\'s page; nothing known: nothing', () => {
  assert.strictEqual(requestSource({ referrer: '' }, () => 'https://tab.example/'), 'https://tab.example/');
  assert.strictEqual(requestSource({ referrer: '', frame: null }, 'https://tab.example/'), 'https://tab.example/');
  const gone = { referrer: '', get frame() { throw new Error('Render frame was disposed'); } };
  assert.strictEqual(requestSource(gone, () => 'https://tab.example/'), 'https://tab.example/');
  assert.strictEqual(requestSource({ referrer: '' }, () => { throw new Error('no tab'); }), '');
  assert.strictEqual(requestSource({ referrer: '' }), '');
  assert.strictEqual(requestSource(null), '');
  const loop = frame('about:blank'); loop.parent = loop; // never spins on a broken frame tree
  assert.strictEqual(requestSource({ referrer: '', frame: loop }), '');
});

test('the filter engine then blocks a "on other sites only" tracker that it let through before', () => {
  const engine = FiltersEngine.parse('||recorder.example^$third-party');
  const seen = (d) => { const r = engine.match(Request.fromRawDetails({ url: d.url, type: 'script', sourceUrl: d.referrer })); return !!r.match; };
  const d = { url: 'https://cdn.recorder.example/rec.js', referrer: '', resourceType: 'script', frame: frame('https://quiet.example/') };
  assert.strictEqual(seen(d), false, 'the hole: with no Referer the tracker looked like part of the site');
  const fixed = withSource(d);
  assert.strictEqual(seen(fixed), true);
  assert.strictEqual(fixed.url, d.url);
  assert.strictEqual(d.referrer, '', 'the original request is not changed');
  // the tracker company's own website is still not cut off from itself
  assert.strictEqual(seen(withSource({ url: 'https://cdn.recorder.example/rec.js', referrer: '', frame: frame('https://www.recorder.example/') })), false);
});

test('Shield passes every request through it, for blocking and for response rules', () => {
  const shield = fs.readFileSync(path.join(__dirname, '..', 'main', 'shield.js'), 'utf8');
  assert.match(shield, /ob\(withSource\(d, \(\) => pageUrlOf\(d\.webContentsId\)\), cb\)/);
  assert.match(shield, /oh\(withSource\(d, \(\) => pageUrlOf\(d\.webContentsId\)\), cb\)/);
});
