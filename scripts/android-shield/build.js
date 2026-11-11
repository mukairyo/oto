#!/usr/bin/env node
'use strict';
// Writes Oto for Android's own blocker (a small built-in extension) from Oto's lists:
//   node scripts/android-shield/build.js <folder>      e.g. ../oto-android/android/app/src/main/assets/shield
// The app code lives on the "android" branch; this keeps one set of lists (trackers.js, blocklist.js) for both.
// The extension's version changes whenever its content does, so the app installs the new one on its next start.
const fs = require('fs');
const path = require('path');
const { androidRules } = require('../../trackers.js');

function files() {
  const rules = androidRules();
  const out = {
    'rules.js': `// Written by scripts/android-shield/build.js from Oto's lists (main branch). Don't edit by hand.\nconst OTO_RULES = ${JSON.stringify({ third: rules.third, scripts: rules.scripts })};\n`,
    'hide.css': `/* Written by scripts/android-shield/build.js. Common ad boxes, hidden. */\n${rules.hide.join(',\n')} { display: none !important; }\n`,
    'background.js': fs.readFileSync(path.join(__dirname, 'background.js'), 'utf8'),
  };
  // a number that changes with the content (version parts must be plain numbers)
  let sum = 0;
  for (const k of Object.keys(out).sort()) for (const ch of out[k]) sum = (sum * 31 + ch.charCodeAt(0)) % 65521;
  out['manifest.json'] = `${JSON.stringify({
    manifest_version: 2,
    name: 'Oto Shield',
    version: `1.${rules.third.length}.${rules.scripts.length + rules.hide.length}.${sum}`,
    description: 'Oto\'s own blocker: stops known ad, tracker and telemetry addresses and ad scripts, and hides common ad boxes.',
    browser_specific_settings: { gecko: { id: 'shield@oto.app' } },
    permissions: ['webRequest', 'webRequestBlocking', '<all_urls>'],
    background: { scripts: ['rules.js', 'background.js'] },
    content_scripts: [{ matches: ['<all_urls>'], css: ['hide.css'], all_frames: true, match_about_blank: true, run_at: 'document_start' }],
  }, null, 2)}\n`;
  return out;
}

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node scripts/android-shield/build.js <folder>'); process.exit(1); }
  fs.mkdirSync(dir, { recursive: true });
  const out = files();
  for (const [name, text] of Object.entries(out)) fs.writeFileSync(path.join(dir, name), text);
  console.log(`wrote ${Object.keys(out).join(', ')} to ${dir} (version ${JSON.parse(out['manifest.json']).version})`);
}
module.exports = { files };
