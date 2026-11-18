'use strict';
// Oto Shield (1.7.12): the code an engine runs in pages comes only with Oto.
//  - Its resources (uBO's scriptlets and redirect stand-ins) are replaced by Oto's bundled, pinned copy
//    (vendor-ghostery/resources.json, checked against its SHA-256 here). The library would otherwise use the copy it
//    downloads from GitHub's master branch with the lists.
//  - Rules from the downloaded lists can't use uBO's "trusted" scriptlets (trusted-replace-node-text and friends can
//    put any code into a page). uBO itself only allows them from its own trusted lists. On YouTube, uBOL's bundled
//    scriptlets do that work (main/yt-scriptlets.js).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RESOURCES_SHA256 = '5ce0ce483f0e5514308ccb0240960a9dd7bfeab417debeef96960dce2c95f690';

function bundledResources(appDir) {
  const buf = fs.readFileSync(path.join(appDir, 'vendor-ghostery', 'resources.json'));
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== RESOURCES_SHA256) throw new Error('bundled Shield resources changed');
  return { text: buf.toString('utf8'), sha };
}

const isTrusted = (f) => { try { return f.isScriptInject() && /^trusted-/i.test(String((f.parseScript() || {}).name || '')); } catch { return false; } };

/** The engine with its filters, minus the ones `drop` picks (the same engine if none). */
function rebuild(base, drop) {
  const { networkFilters, cosmeticFilters } = base.getFilters();
  const keep = cosmeticFilters.filter((f) => !drop(f));
  if (keep.length === cosmeticFilters.length) return 0;
  // (FiltersEngine keeps no list of its own here: update() swaps the cosmetic filters in place)
  base.update({ removedCosmeticFilters: cosmeticFilters.filter(drop).map((f) => f.getId()) });
  return cosmeticFilters.length - keep.length;
}

/** In place: Oto's own resources, no trusted scriptlets. Throws if the bundled copy isn't the one Oto shipped. */
function trustEngine(base, appDir) {
  const { text, sha } = bundledResources(appDir);
  base.updateResources(text, `oto-${sha.slice(0, 16)}`);
  return { dropped: rebuild(base, isTrusted) };
}

/** In place: no scriptlets at all (when Oto's own copy can't be read). */
function noScriptlets(base) { base.updateResources('{"scriptlets":[],"redirects":[]}', 'oto-none'); return rebuild(base, (f) => { try { return f.isScriptInject(); } catch { return false; } }); }

module.exports = { trustEngine, noScriptlets, bundledResources, isTrusted, RESOURCES_SHA256 };
