// Oto — well-known tracking and analytics companies, by the domains they load from.
// Used only to label what Oto Shield blocked ("Google Analytics tried to track you on example.com").
// Everything blocked that isn't on this list is counted as an ad.
'use strict';
const T = {
  'Google Analytics': ['google-analytics.com', 'googletagmanager.com', 'analytics.google.com', 'ssl.google-analytics.com'],
  'Google Ads': ['doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adservice.google.com', 'g.doubleclick.net'],
  'Meta (Facebook)': ['connect.facebook.net', 'facebook.net', 'pixel.facebook.com', 'graph.instagram.com'],
  'Microsoft': ['clarity.ms', 'bat.bing.com', 'c.bing.com'],
  'TikTok': ['analytics.tiktok.com', 'business-api.tiktok.com', 'analytics-sg.tiktok.com'],
  'X (Twitter)': ['analytics.twitter.com', 'static.ads-twitter.com', 'ads-api.twitter.com'],
  'LinkedIn': ['px.ads.linkedin.com', 'snap.licdn.com', 'analytics.pointdrive.linkedin.com'],
  'Snapchat': ['sc-static.net', 'tr.snapchat.com'],
  'Pinterest': ['ct.pinterest.com', 'trk.pinterest.com'],
  'Reddit': ['alb.reddit.com', 'events.redditmedia.com'],
  'Amazon': ['amazon-adsystem.com', 'assoc-amazon.com'],
  'Yandex': ['mc.yandex.com', 'mc.yandex.ru', 'mc.webvisor.org'],
  'Hotjar': ['hotjar.com', 'hotjar.io'],
  'Segment': ['segment.com', 'segment.io', 'cdn.segment.com'],
  'Mixpanel': ['mixpanel.com', 'mxpnl.com'],
  'Amplitude': ['amplitude.com', 'api2.amplitude.com'],
  'Heap': ['heapanalytics.com', 'heap.io'],
  'FullStory': ['fullstory.com'],
  'Mouseflow': ['mouseflow.com'],
  'Crazy Egg': ['crazyegg.com'],
  'Lucky Orange': ['luckyorange.com', 'luckyorange.net'],
  'New Relic': ['nr-data.net', 'newrelic.com'],
  'Datadog': ['browser-intake-datadoghq.com', 'browser-intake-datadoghq.eu'],
  'Sentry': ['sentry.io', 'sentry-cdn.com'],
  'Adobe': ['omtrdc.net', 'demdex.net', '2o7.net', 'everesttech.net', 'adobedtm.com'],
  'Oracle': ['bluekai.com', 'addthis.com', 'moatads.com', 'eloqua.com'],
  'Comscore': ['scorecardresearch.com', 'comscore.com'],
  'Nielsen': ['imrworldwide.com', 'exelator.com'],
  'Quantcast': ['quantserve.com', 'quantcount.com', 'quantcast.com'],
  'Criteo': ['criteo.com', 'criteo.net'],
  'Taboola': ['taboola.com'],
  'Outbrain': ['outbrain.com', 'outbrainimg.com'],
  'The Trade Desk': ['adsrvr.org'],
  'Xandr': ['adnxs.com'],
  'PubMatic': ['pubmatic.com'],
  'Rubicon / Magnite': ['rubiconproject.com'],
  'OpenX': ['openx.net'],
  'Index Exchange': ['casalemedia.com', 'indexww.com'],
  'Lotame': ['crwdcntrl.net'],
  'LiveRamp': ['rlcdn.com', 'pippio.com'],
  'ID5': ['id5-sync.com'],
  'Tapad': ['tapad.com'],
  'HubSpot': ['hs-analytics.net', 'hs-scripts.com', 'hubspot.com', 'hsforms.com'],
  'Marketo': ['marketo.net', 'mktoresp.com'],
  'Salesforce': ['krxd.net', 'exacttarget.com', 'evergage.com'],
  'Optimizely': ['optimizely.com'],
  'VWO': ['visualwebsiteoptimizer.com'],
  'Chartbeat': ['chartbeat.com', 'chartbeat.net'],
  'Parse.ly': ['parsely.com', 'parse.ly'],
  'Matomo': ['matomo.cloud'],
  'Plausible': ['plausible.io'],
  'Yahoo': ['analytics.yahoo.com', 'ads.yahoo.com'],
  'Branch': ['app.link', 'api2.branch.io'],
  'AppsFlyer': ['appsflyer.com', 'onelink.me'],
  'Adjust': ['adjust.com'],
  'OneSignal': ['onesignal.com'],
  'Bounce Exchange': ['bounceexchange.com', 'bouncex.net'],
  'Cloudflare Insights': ['cloudflareinsights.com'],
  'Vimeo Analytics': ['fresnel.vimeocdn.com'],
  'Spotify Ads': ['pixel.spotify.com'],
};
// Oto's extra block list: ad, tracking and telemetry hosts that uBlock Origin's lists don't cover
// (the ones adblock testers check). Blocked at every protection level.
const EXTRA = {
  'Amazon': ['adtago.s3.amazonaws.com', 'analyticsengine.s3.amazonaws.com', 'analytics.s3.amazonaws.com', 'advice-ads.s3.amazonaws.com'],
  'Google Ads': ['pagead2.googlesyndication.com', 'adservice.google.com', 'pagead2.googleadservices.com', 'afs.googlesyndication.com', 'stats.g.doubleclick.net', 'ad.doubleclick.net', 'static.doubleclick.net', 'm.doubleclick.net', 'mediavisor.doubleclick.net'],
  'AdColony': ['ads30.adcolony.com', 'adc3-launch.adcolony.com', 'events3alt.adcolony.com', 'wd.adcolony.com'],
  'Media.net': ['static.media.net', 'adservetx.media.net'],
  'Hotjar': ['static.hotjar.com', 'api-hotjar.com', 'hotjar-analytics.com'],
  'Mouseflow': ['a.mouseflow.com'],
  'Freshworks': ['freshmarketer.com', 'claritybt.freshmarketer.com', 'fwtracks.freshmarketer.com'],
  'Lucky Orange': ['api.luckyorange.com', 'realtime.luckyorange.com', 'cdn.luckyorange.com', 'w1.luckyorange.com', 'upload.luckyorange.net', 'cs.luckyorange.net', 'settings.luckyorange.net'],
  'WordPress Stats': ['stats.wp.com'],
  'Bugsnag': ['notify.bugsnag.com', 'sessions.bugsnag.com', 'api.bugsnag.com', 'app.bugsnag.com'],
  'Sentry': ['browser.sentry-cdn.com', 'app.getsentry.com'],
  'Meta (Facebook)': ['pixel.facebook.com', 'an.facebook.com'],
  'X (Twitter)': ['static.ads-twitter.com', 'ads-api.twitter.com'],
  'LinkedIn': ['ads.linkedin.com', 'analytics.pointdrive.linkedin.com'],
  'Pinterest': ['ads.pinterest.com', 'log.pinterest.com', 'trk.pinterest.com'],
  'Reddit': ['events.reddit.com', 'events.redditmedia.com'],
  'YouTube Ads': ['ads.youtube.com'],
  'TikTok': ['ads-api.tiktok.com', 'analytics.tiktok.com', 'ads-sg.tiktok.com', 'analytics-sg.tiktok.com', 'business-api.tiktok.com', 'ads.tiktok.com', 'log.byteoversea.com'],
  'Yahoo': ['ads.yahoo.com', 'analytics.yahoo.com', 'geo.yahoo.com', 'udcm.yahoo.com', 'analytics.query.yahoo.com', 'partnerads.ysm.yahoo.com', 'log.fc.yahoo.com', 'gemini.yahoo.com', 'adtech.yahooinc.com'],
  'Yandex': ['appmetrica.yandex.ru', 'adfstat.yandex.ru', 'metrika.yandex.ru', 'offerwall.yandex.net', 'adfox.yandex.ru'],
  'Unity Ads': ['auction.unityads.unity3d.com', 'webview.unityads.unity3d.com', 'config.unityads.unity3d.com', 'adserver.unityads.unity3d.com'],
  'Realme': ['iot-eu-logser.realme.com', 'iot-logser.realme.com', 'bdapi-ads.realmemobile.com', 'bdapi-in-ads.realmemobile.com'],
  'Xiaomi': ['api.ad.xiaomi.com', 'data.mistat.xiaomi.com', 'data.mistat.india.xiaomi.com', 'data.mistat.rus.xiaomi.com', 'sdkconfig.ad.xiaomi.com', 'sdkconfig.ad.intl.xiaomi.com', 'tracking.rus.miui.com'],
  'Oppo': ['adsfs.oppomobile.com', 'adx.ads.oppomobile.com', 'ck.ads.oppomobile.com', 'data.ads.oppomobile.com'],
  'Huawei': ['metrics.data.hicloud.com', 'metrics2.data.hicloud.com', 'grs.hicloud.com', 'logservice.hicloud.com', 'logservice1.hicloud.com', 'logbak.hicloud.com'],
  'OnePlus': ['click.oneplus.cn', 'open.oneplus.net'],
  'Samsung': ['samsungads.com', 'smetrics.samsung.com', 'nmetrics.samsung.com', 'samsung-com.112.2o7.net', 'analytics-api.samsunghealthcn.com'],
  'Apple': ['iadsdk.apple.com', 'metrics.icloud.com', 'metrics.mzstatic.com', 'api-adservices.apple.com', 'books-analytics-events.apple.com', 'weather-analytics-events.apple.com', 'notes-analytics-events.apple.com'],
};
// Only in Strict: this one also serves Yandex's map embeds, so blocking it can break maps on some sites.
const EXTRA_STRICT = ['extmaps-api.yandex.net'];
const BY = new Map();
for (const [name, list] of Object.entries(T)) for (const d of list) BY.set(d, name);
for (const [name, list] of Object.entries(EXTRA)) for (const d of list) if (!BY.has(d)) BY.set(d, name);
BY.set('extmaps-api.yandex.net', 'Yandex');
// Common ad boxes that the downloaded lists don't hide on their own (also when a page adds them later).
const EXTRA_COSMETIC = [
  'ins.adsbygoogle', '.adsbygoogle', '.adsbox', '.ad-banner', '.banner-ad', '.textads', '.text-ads', '.ad-slot', '.ad-unit', '.ad-container',
  '.ad-placeholder', '.advertisement', '.sponsored-ad', '[id^="div-gpt-ad"]', '[id^="google_ads_iframe"]', '[id^="google_ads_frame"]',
  'iframe[src*="googlesyndication.com"]', 'iframe[src*="doubleclick.net"]', 'a[href*="doubleclick.net/"]', '[data-ad-slot]', '[data-google-query-id]',
];
const extraFilters = (level) => [
  ...[...Object.values(EXTRA).flat(), ...(level === 'strict' ? EXTRA_STRICT : [])].map((d) => `||${d}^`),
  ...EXTRA_COSMETIC.map((sel) => `##${sel}`),
];

// The company behind a request's hostname, or '' if it isn't a known tracker.
function trackerOf(host) {
  let h = String(host || '').toLowerCase();
  while (h) {
    if (BY.has(h)) return BY.get(h);
    const i = h.indexOf('.');
    if (i < 0) break;
    h = h.slice(i + 1);
  }
  return '';
}
module.exports = { trackerOf, extraFilters };
