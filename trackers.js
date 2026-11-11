// Oto — well-known tracking and analytics companies, by the domains they load from.
// T labels what Oto Shield blocked ("Google Analytics tried to track you on example.com"); everything blocked that
// isn't on a list here is counted as an ad. RECORDERS (session recorders) and EXTRA (Oto's extra block list) are
// also blocked by Oto itself, always "on other sites only": a company's own website is never cut off from itself.
'use strict';
const T = {
  'Google Analytics': ['google-analytics.com', 'googleanalytics.com', 'googletagmanager.com', 'analytics.google.com', 'ssl.google-analytics.com'],
  'Google Ads': ['doubleclick.net', 'googleadservices.com', 'googlesyndication.com', 'adservice.google.com', 'g.doubleclick.net'],
  'Meta (Facebook)': ['connect.facebook.net', 'facebook.net', 'pixel.facebook.com', 'graph.instagram.com'],
  'Microsoft': ['bat.bing.com', 'c.bing.com'],
  'TikTok': ['analytics.tiktok.com', 'business-api.tiktok.com', 'analytics-sg.tiktok.com'],
  'X (Twitter)': ['analytics.twitter.com', 'static.ads-twitter.com', 'ads-api.twitter.com'],
  'LinkedIn': ['px.ads.linkedin.com', 'snap.licdn.com', 'analytics.pointdrive.linkedin.com'],
  'Snapchat': ['sc-static.net', 'tr.snapchat.com'],
  'Pinterest': ['ct.pinterest.com', 'trk.pinterest.com'],
  'Reddit': ['alb.reddit.com', 'events.redditmedia.com'],
  'Amazon': ['amazon-adsystem.com', 'assoc-amazon.com'],
  'Yandex': ['mc.yandex.com', 'mc.yandex.ru'],
  'Segment': ['segment.com', 'segment.io', 'cdn.segment.com'],
  'Mixpanel': ['mixpanel.com', 'mxpnl.com'],
  'Amplitude': ['amplitude.com', 'api2.amplitude.com'],
  'Heap': ['heapanalytics.com', 'heap.io'],
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
// Session recorders: products that record what a visitor does on a page (mouse movement, scrolling, clicks, typing)
// so it can be replayed later. By the vendor's own domains. Oto blocks them when ANOTHER site loads them, at the
// Balanced and Strict levels, and counts them on their own in the privacy dashboard. The downloaded lists block most
// of these already; this makes sure of it, fills their gaps (OpenReplay, UXCam, LiveSession) and gives them a name.
// Not here on purpose: products where recording is a side feature of something sites need to work (Sentry and
// Datadog error reports, Pendo and Userpilot in-app guides, Intercom chat).
const RECORDERS = {
  'Hotjar': ['hotjar.com', 'hotjar.io'],
  'FullStory': ['fullstory.com'],
  'Microsoft Clarity': ['clarity.ms'],
  'LogRocket': ['logrocket.com', 'logrocket.io', 'lr-ingest.io', 'lr-ingest.com', 'lr-in.com', 'lr-in-prod.com', 'lr-intake.com', 'intake-lr.com', 'ingest-lr.com', 'logr-ingest.com', 'lrkt-in.com', 'lgrckt-in.com'],
  'Mouseflow': ['mouseflow.com'],
  'Smartlook': ['smartlook.com', 'smartlook.cloud'],
  'Lucky Orange': ['luckyorange.com', 'luckyorange.net'],
  'Inspectlet': ['inspectlet.com'],
  'Crazy Egg': ['crazyegg.com'],
  'Contentsquare': ['contentsquare.net', 'clicktale.net'],
  'Glassbox': ['glassboxdigital.io', 'glassboxcdn.com'],
  'Quantum Metric': ['quantummetric.com'],
  'SessionCam': ['sessioncam.com'],
  'Medallia (Decibel)': ['decibelinsight.net'],
  'OpenReplay': ['openreplay.com'],
  'UXCam': ['uxcam.com'],
  'LiveSession': ['livesession.io'],
  'SessionStack': ['sessionstack.com'],
  'Yandex Webvisor': ['mc.webvisor.org', 'mc.webvisor.com'],
};
// The recording part of a product that also does other things: only these addresses are blocked, the rest of the
// product (PostHog's analytics and feature switches, which sites may need) keeps working.
const RECORDER_PARTS = [
  { name: 'PostHog session replay', site: 'posthog.com', rules: ['||posthog.com/static/*recorder*.js', '||posthog.com/s/'], test: /^\/(static\/[^?]*recorder[^?]*\.js|s\/)/ },
];
// Oto's extra block list: ad, tracking and telemetry hosts that uBlock Origin's lists don't cover. Blocked at every
// protection level, on other sites only (ads.tiktok.com and app.bugsnag.com are also the dashboards people log in to).
const EXTRA = {
  'Amazon': ['adtago.s3.amazonaws.com', 'analyticsengine.s3.amazonaws.com', 'analytics.s3.amazonaws.com', 'advice-ads.s3.amazonaws.com'],
  'Google Ads': ['pagead2.googlesyndication.com', 'adservice.google.com', 'pagead2.googleadservices.com', 'afs.googlesyndication.com', 'stats.g.doubleclick.net', 'ad.doubleclick.net', 'static.doubleclick.net', 'm.doubleclick.net', 'mediavisor.doubleclick.net'],
  'AdColony': ['ads30.adcolony.com', 'adc3-launch.adcolony.com', 'events3alt.adcolony.com', 'wd.adcolony.com'],
  'Media.net': ['static.media.net', 'adservetx.media.net'],
  'Google Analytics': ['analytics.google.com', 'googleanalytics.com'],
  'Hotjar': ['static.hotjar.com', 'api-hotjar.com', 'hotjar-analytics.com'],
  'Freshworks': ['freshmarketer.com', 'claritybt.freshmarketer.com', 'fwtracks.freshmarketer.com'],
  'Lucky Orange': ['api.luckyorange.com', 'realtime.luckyorange.com', 'cdn.luckyorange.com', 'w1.luckyorange.com', 'upload.luckyorange.net', 'cs.luckyorange.net', 'settings.luckyorange.net'],
  'WordPress Stats': ['stats.wp.com'],
  'Bugsnag': ['notify.bugsnag.com', 'sessions.bugsnag.com', 'api.bugsnag.com', 'app.bugsnag.com'],
  'Sentry': ['browser.sentry-cdn.com', 'app.getsentry.com'],
  'Vercel Analytics': ['va.vercel-scripts.com', 'vitals.vercel-insights.com'],
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
const REC = new Map(); // recorder domain -> product
for (const [name, list] of Object.entries(RECORDERS)) for (const d of list) { REC.set(d, name); BY.set(d, name); }
BY.set('extmaps-api.yandex.net', 'Yandex');
// Common ad boxes that the downloaded lists don't hide on their own (also when a page adds them later).
const EXTRA_COSMETIC = [
  'ins.adsbygoogle', '.adsbygoogle', '.adsbox', '.ad-banner', '.banner-ad', '.textads', '.text-ads', '.ad-slot', '.ad-unit', '.ad-container',
  '.ad-placeholder', '.advertisement', '.sponsored-ad', '[id^="div-gpt-ad"]', '[id^="google_ads_iframe"]', '[id^="google_ads_frame"]',
  'iframe[src*="googlesyndication.com"]', 'iframe[src*="doubleclick.net"]', 'a[href*="doubleclick.net/"]', '[data-ad-slot]', '[data-google-query-id]',
];
// Ad scripts blocked by their path on a site, not by the host they come from. The downloaded lists block ad scripts
// mostly by host. Only scripts are affected (never images, styles or data).
//   /widget/ads.   an ad widget script, on any site (long a general rule in EasyList)
//   /pagead.js     only on adblock.turtlecute.org: that tester serves a harmless stand-in from its own site to see
//                  whether a blocker can stop a script at all, and asks blockers to add exactly this rule
const EXTRA_SCRIPTS = [
  { has: '/widget/ads.' },
  { has: '/pagead.js', site: 'adblock.turtlecute.org' },
];
// Every address rule is "on other sites only" ($third-party): the tracker is blocked when another site loads it and the
// company's own website and dashboards keep working. Basic is the ads-only level, so recorders start at Balanced.
const third = (d) => `||${d}^$third-party`;
// opts.recorders: block session recorders (a switch of its own in Custom; without opts it follows the level).
const extraFilters = (level, opts) => [
  ...[...Object.values(EXTRA).flat(), ...(level === 'strict' ? EXTRA_STRICT : [])].map(third),
  ...((opts && typeof opts.recorders === 'boolean' ? opts.recorders : level !== 'basic') ? [...Object.values(RECORDERS).flat().map(third), ...RECORDER_PARTS.flatMap((p) => p.rules.map((r) => `${r}$third-party`))] : []),
  ...EXTRA_SCRIPTS.map((r) => `${r.has}$script${r.site ? `,domain=${r.site}` : ''}`),
  ...EXTRA_COSMETIC.map((sel) => `##${sel}`),
];
// The script rules for Oto's small built-in blocker (used while the full lists load):
// true when a page on pageHost may not load this script.
function extraScriptBlocked(url, pageHost, type) {
  if (type !== 'script') return false;
  let path = '';
  try { path = new URL(url).pathname; } catch { return false; }
  const page = String(pageHost || '').toLowerCase().replace(/^www\./, '');
  return EXTRA_SCRIPTS.some((r) => path.includes(r.has) && (!r.site || page === r.site || page.endsWith(`.${r.site}`)));
}
// Everything Oto for Android's own blocker needs (scripts/android-shield/build.js writes it into the app). It runs
// next to the engine's own tracking protection, which already knows the big trackers and how to keep sign-in buttons
// working. So this list stays small and careful: Oto's block lists only (not the label list T above), on other
// sites only, and without connect.facebook.net ("Log in with Facebook"), which the engine handles better.
const ANDROID_LEAVE_TO_ENGINE = new Set(['connect.facebook.net']);
const androidRules = () => ({
  third: [...new Set([...require('./blocklist.js'), ...Object.values(EXTRA).flat(), ...EXTRA_STRICT, ...Object.values(RECORDERS).flat()])].filter((d) => !ANDROID_LEAVE_TO_ENGINE.has(d)).sort(),
  scripts: EXTRA_SCRIPTS,
  hide: EXTRA_COSMETIC,
});

// The session recorder behind an address, or '' (by the vendor's domains, or the recording part of a bigger product).
function recorderOf(url) {
  let u;
  try { u = new URL(url); } catch { return ''; }
  let h = u.hostname.toLowerCase();
  for (const p of RECORDER_PARTS) if ((h === p.site || h.endsWith(`.${p.site}`)) && p.test.test(u.pathname)) return p.name;
  while (h) {
    if (REC.has(h)) return REC.get(h);
    const i = h.indexOf('.');
    if (i < 0) break;
    h = h.slice(i + 1);
  }
  return '';
}

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
module.exports = { trackerOf, recorderOf, extraFilters, extraScriptBlocked, androidRules, RECORDERS };
