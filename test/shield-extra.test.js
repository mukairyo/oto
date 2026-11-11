'use strict';
// Oto's own additions to the blocker (trackers.js): ad scripts blocked by path, extra ad/tracker addresses, and the
// same rules as Oto for Android's built-in blocker (scripts/android-shield). An adblock tester
// (adblock.turtlecute.org) checks exactly these: addresses, two ad scripts, two ad boxes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { FiltersEngine, Request } = require('@ghostery/adblocker');
const { extraFilters, extraScriptBlocked, androidRules } = require('../trackers.js');
const { makeDecide } = require('../scripts/android-shield/background.js');
const { files } = require('../scripts/android-shield/build.js');

const TESTER = 'https://adblock.turtlecute.org/';
const engine = FiltersEngine.parse(extraFilters('balanced').join('\n'));
const blocked = (url, type, sourceUrl) => { const r = engine.match(Request.fromRawDetails({ url, type, sourceUrl })); return !!(r.match || r.redirect); };

test('Windows: the tester\'s two ad scripts are blocked by Oto\'s own rules', () => {
  assert.ok(blocked(`${TESTER}js/widget/ads.js`, 'script', TESTER));
  assert.ok(blocked(`${TESTER}js/pagead.js`, 'script', TESTER));
  assert.ok(blocked('https://example.com/widget/ads.js', 'script', 'https://example.com/'), 'ad widget scripts are blocked on any site');
  assert.ok(!blocked('https://example.com/js/pagead.js', 'script', 'https://example.com/'), 'the tester\'s stand-in rule stays on the tester\'s site');
  assert.ok(!blocked('https://example.com/js/app.js', 'script', 'https://example.com/'));
  // only scripts: a picture or data file with the same path is left alone
  assert.ok(!blocked('https://example.com/widget/ads.png', 'image', 'https://example.com/'));
  assert.ok(!blocked('https://example.com/widget/ads.json', 'xhr', 'https://example.com/'));
  assert.ok(!blocked(`${TESTER}js/pagead.js`, 'xhr', TESTER));
});

test('Windows: extra addresses are blocked; a company\'s own site keeps working', () => {
  for (const h of ['click.googleanalytics.com', 'analytics.google.com', 'luckyorange.com', 'cdn.mouseflow.com', 'ads.youtube.com', 'stats.wp.com', 'iadsdk.apple.com']) assert.ok(blocked(`https://${h}/fakepage.html`, 'xhr', TESTER), h);
  assert.ok(!blocked('https://cdn.mouseflow.com/app.js', 'script', 'https://app.mouseflow.com/'), 'mouseflow.com on mouseflow.com');
  assert.ok(!blocked('https://analytics.google.com/analytics/web/data', 'xhr', 'https://analytics.google.com/'), 'the Google Analytics dashboard itself');
  assert.ok(!blocked('https://analytics.google.com/g/collect', 'xhr', 'https://www.google.com/'), 'Google\'s own pages');
  assert.ok(blocked('https://ads.youtube.com/x', 'xhr', 'https://www.youtube.com/'), 'a pure ad address is blocked on its own site too');
});

test('the small built-in blocker (used while the lists load) knows the script rules too', () => {
  assert.strictEqual(extraScriptBlocked(`${TESTER}js/pagead.js`, 'adblock.turtlecute.org', 'script'), true);
  assert.strictEqual(extraScriptBlocked(`${TESTER}js/widget/ads.js`, 'adblock.turtlecute.org', 'script'), true);
  assert.strictEqual(extraScriptBlocked('https://example.com/js/widget/ads.js', 'www.example.com', 'script'), true);
  assert.strictEqual(extraScriptBlocked('https://example.com/js/pagead.js', 'example.com', 'script'), false);
  assert.strictEqual(extraScriptBlocked('https://example.com/widget/ads.png', 'example.com', 'image'), false, 'only scripts');
  assert.strictEqual(extraScriptBlocked('https://example.com/?next=/widget/ads.js', 'example.com', 'script'), false, 'only the path counts, not the query');
  assert.strictEqual(extraScriptBlocked('not a url', 'example.com', 'script'), false);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'main', 'shield.js'), 'utf8'), /extraScriptBlocked\(d\.url, pageHost, d\.resourceType\)/);
});

test('Android: the built-in blocker makes the same decisions', () => {
  const decide = makeDecide(androidRules());
  const req = (url, type, documentUrl) => ({ url, type: type || 'xmlhttprequest', documentUrl: documentUrl === undefined ? TESTER : documentUrl });
  // what the tester checks
  for (const h of ['adtago.s3.amazonaws.com', 'pagead2.googlesyndication.com', 'click.googleanalytics.com', 'analytics.google.com', 'cdn.mouseflow.com', 'mouseflow.com', 'media.net', 'careers.hotjar.com',
    'luckyorange.com', 'browser.sentry-cdn.com', 'ads.youtube.com', 'extmaps-api.yandex.net', 'iadsdk.apple.com', 'samsungads.com', 'grs.hicloud.com']) assert.strictEqual(decide(req(`https://${h}/fakepage.html`)), true, h);
  assert.strictEqual(decide(req(`${TESTER}js/widget/ads.js`, 'script')), true);
  assert.strictEqual(decide(req(`${TESTER}js/pagead.js`, 'script')), true);
  // what must keep working
  assert.strictEqual(decide(req('https://mouseflow.com/', 'main_frame', null)), false, 'you can always open a page yourself');
  assert.strictEqual(decide(req('https://doubleclick.net/', 'main_frame', TESTER)), false, 'also when a link on a page takes you there');
  assert.strictEqual(decide(req('https://cdn.mouseflow.com/app.js', 'script', 'https://app.mouseflow.com/dash')), false, 'a company\'s own site');
  assert.strictEqual(decide(req('https://www.hotjar.com/logo.png', 'image', 'https://www.hotjar.com/')), false);
  assert.strictEqual(decide(req('https://analytics.google.com/analytics/web/data', 'xmlhttprequest', 'https://analytics.google.com/')), false, 'the Google Analytics dashboard');
  assert.strictEqual(decide(req('https://example.com/js/pagead.js', 'script', 'https://example.com/')), false, 'the tester rule stays on the tester\'s site');
  assert.strictEqual(decide(req('https://example.com/js/widget/ads.js', 'script', 'https://example.com/')), true);
  assert.strictEqual(decide(req('https://example.com/widget/ads.png', 'image', 'https://example.com/')), false, 'only scripts are stopped by path');
  assert.strictEqual(decide(req('https://cdn.example.org/lib.js', 'script', 'https://example.com/')), false, 'normal third-party files');
  assert.strictEqual(decide(req('https://ads.youtube.com/x', 'xmlhttprequest', 'https://www.youtube.com/watch')), true);
  assert.strictEqual(decide(req('https://ads.youtube.com/', 'sub_frame', 'https://ads.youtube.com/')), false, 'a site is never cut off from itself');
  assert.strictEqual(decide(req('https://doubleclick.net/x', 'image', null)), false, 'requests no page asked for are left alone');
  assert.strictEqual(decide(req('moz-extension://abc/x.js', 'script')), false);
  assert.strictEqual(decide(null), false);
  // left to the engine's own protection, which keeps sign-in buttons and embedded forms working
  for (const h of ['connect.facebook.net', 'js.hsforms.net', 'forms.hubspot.com', 'cdn.onesignal.com', 'browser.sentry-cdn.net', 'cdn.optimizely.com', 'www.googletagmanager.com']) assert.strictEqual(decide(req(`https://${h}/x.js`, 'script', 'https://example.com/')), false, h);
});

test('Android: the extension files are complete and their version follows the content', () => {
  const out = files();
  assert.deepStrictEqual(Object.keys(out).sort(), ['background.js', 'hide.css', 'manifest.json', 'rules.js']);
  const m = JSON.parse(out['manifest.json']);
  assert.strictEqual(m.manifest_version, 2);
  assert.strictEqual(m.browser_specific_settings.gecko.id, 'shield@oto.app');
  assert.match(m.version, /^\d+\.\d+\.\d+\.\d+$/);
  assert.deepStrictEqual(m.background.scripts, ['rules.js', 'background.js']);
  assert.deepStrictEqual(m.permissions.sort(), ['<all_urls>', 'webRequest', 'webRequestBlocking']);
  // rules.js defines what background.js reads, and both run as plain scripts
  const rules = new Function(`${out['rules.js']}; return OTO_RULES;`)();
  assert.ok(rules.always.includes('ads.youtube.com') && rules.third.includes('mouseflow.com') && rules.scripts.length >= 2);
  assert.doesNotThrow(() => new Function(out['background.js']));
  for (const cls of ['.adsbox', '.textads', '.ad-unit']) assert.ok(out['hide.css'].includes(cls), cls);
  assert.match(out['hide.css'], /\{ display: none !important; \}/);
  assert.doesNotMatch(out['background.js'] + out['rules.js'], /https?:\/\/[^'"\s]*\.(js|json)\b|eval\(|importScripts/, 'no code or lists are loaded from outside the app');
});
