'use strict';
// Oto Shield mode leaves the engine's YouTube scriptlets out (uBOL's run there instead), picked by site, not by text.
const test = require('node:test');
const assert = require('node:assert');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { withoutYouTubeScriptlets } = require('../main/yt-scriptlets.js');

const LINES = [
  'youtube.com##+js(json-prune, playerResponse.adPlacements)',
  'www.youtube.com##+js(set, ytcfg.data_.EXPERIMENT_FLAGS.all_web_enable_network_machine, false)',
  'm.youtube.com,music.youtube.com,www.youtube.com##+js(set, ytInitialPlayerResponse.adSlots, undefined)',
  'youtube-nocookie.com##+js(set, playerResponse.adPlacements, undefined)',
  'twitch.tv##+js(set, twitchAds, false)',
  'kissasian.*,~youtube.com##+js(nowoif)',
  'youtube.com##.ytd-ad-slot-renderer',
  '||ads.example.com^',
];
const raw = (e) => e.getFilters().cosmeticFilters.map((f) => f.rawLine).sort();
const css = (e, h, d) => e.getCosmeticsFilters({ url: `https://${h}/`, hostname: h, domain: d, getBaseRules: false, getInjectionRules: false, getExtendedRules: false, getRulesFromHostname: true, getRulesFromDOM: false }).styles;

test('the engine\'s YouTube scriptlets are left out, everything else stays', () => {
  const base = ElectronBlocker.parse(LINES.join('\n'), { loadCosmeticFilters: true, debug: true });
  const b = withoutYouTubeScriptlets(ElectronBlocker, base);
  assert.strictEqual(raw(base).length, 7, 'every sample line was read');
  assert.deepStrictEqual(raw(b), [
    'kissasian.*,~youtube.com##+js(nowoif)',
    'twitch.tv##+js(set, twitchAds, false)',
    'youtube.com##.ytd-ad-slot-renderer',
  ]);
  assert.match(css(b, 'www.youtube.com', 'youtube.com'), /ytd-ad-slot-renderer/, 'YouTube keeps its element hiding');
  assert.strictEqual(b.getFilters().networkFilters.length, base.getFilters().networkFilters.length, 'network filters untouched');
});

test('an engine without YouTube scriptlets comes back as it was', () => {
  const base = ElectronBlocker.parse('twitch.tv##+js(set, a, false)\n||ads.example.com^', { loadCosmeticFilters: true });
  assert.strictEqual(withoutYouTubeScriptlets(ElectronBlocker, base), base);
});
