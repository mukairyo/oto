'use strict';
// Oto Shield mode, on YouTube: uBlock Origin Lite's scriptlets run there (see oto:page in main.js), so the engine's own
// YouTube scriptlets are taken out first. Otherwise both sets ran on YouTube, each changing the same page data and
// wrapping the same built-ins twice, and YouTube's pages could stop loading (an endless grey grid; fixed in 1.7.9).
// The engine keeps a filter's site names only as hashes, so a filter is matched against YouTube's own hosts here:
// scriptlets for named sites that apply on YouTube are dropped; generic ones and every other site's stay.
const YT_HOSTS = [['www.youtube.com', 'youtube.com'], ['youtube.com', 'youtube.com'], ['m.youtube.com', 'youtube.com'], ['music.youtube.com', 'youtube.com'], ['www.youtube-nocookie.com', 'youtube-nocookie.com']];

function onYouTube(f) {
  try {
    if (!f.isScriptInject() || f.isUnhide() || !f.hasHostnameConstraint()) return false;
    return YT_HOSTS.some(([h, d]) => { try { return f.match(h, d); } catch { return false; } });
  } catch { return false; }
}

/** The engine without its YouTube scriptlets (the same engine if it has none). */
function withoutYouTubeScriptlets(Blocker, base) {
  const { networkFilters, cosmeticFilters } = base.getFilters();
  const keep = cosmeticFilters.filter((f) => !onYouTube(f));
  if (keep.length === cosmeticFilters.length) return base;
  const b = new Blocker({ networkFilters, cosmeticFilters: keep, config: base.config });
  b.resources = base.resources;
  return b;
}

module.exports = { withoutYouTubeScriptlets, onYouTube, YT_HOSTS };
