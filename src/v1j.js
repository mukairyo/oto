'use strict';
/* Oto — the Oto Shield page: privacy dashboard, blocking levels, YouTube switches and every site's permissions.
   Stats are counted in main.js (privacy-stats.json) and never leave this PC. */

const SHP = { open: null, tab: 'overview', stats: null, st: null, perms: {}, q: '', exp: null, busy: false };
const SHP_TABS = [['overview', 'Overview'], ['blocking', 'Blocking'], ['youtube', 'YouTube'], ['permissions', 'Permissions']];
const SHP_ICONS = {
  chev: '<path d="m9.5 6 6 6-6 6"/>',
  cookie: '<path d="M20.5 12.5a8.5 8.5 0 1 1-9-9 3 3 0 0 0 3.5 3.5 3 3 0 0 0 3 3 2.5 2.5 0 0 0 2.5 2.5z"/><path d="M8.5 9.5h.01M8 14.5h.01M12.5 16.5h.01M12 12h.01"/>',
  autoplay: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M10.5 9.5v5l4-2.5z"/>',
  ytube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.3v5.4l4.6-2.7z"/>',
};

// ---------------------------------------------------------------- YouTube switches (CSS put into youtube.com)
const YT_SW = [
  ['FEED', [
    ['shorts', 'Hide Shorts', 'Shorts shelves, Shorts in search and subscriptions, and the Shorts button',
      'ytd-reel-shelf-renderer,ytd-rich-shelf-renderer[is-shorts],ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model),ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2),grid-shelf-view-model:has(ytm-shorts-lockup-view-model),grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2),ytd-guide-entry-renderer:has(a[title="Shorts"]),ytd-mini-guide-entry-renderer[aria-label="Shorts"],ytd-video-renderer:has(a[href^="/shorts/"]),ytd-grid-video-renderer:has(a[href^="/shorts/"]),ytd-rich-item-renderer:has(a[href^="/shorts/"]),yt-tab-shape[tab-title="Shorts"],ytd-notification-renderer:has(a[href^="/shorts/"]),yt-chip-cloud-chip-renderer:has([title="Shorts"])'],
    ['shortsPlayer', 'Open Shorts in the normal player', 'A Shorts link opens as a regular video you can scrub and pause', ''],
    ['home', 'Hide the home feed', 'No recommendations on the start page. Search and Subscriptions still work',
      'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer,ytd-browse[page-subtype="home"] #chips-wrapper'],
    ['previews', 'No video previews on hover', 'Thumbnails stay still when the mouse is over them',
      'ytd-video-preview,#video-preview,#mouseover-overlay,ytd-thumbnail-overlay-loading-preview-renderer'],
  ]],
  ['WATCH PAGE', [
    ['comments', 'Hide comments', '', 'ytd-comments#comments,#comments,ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"],ytd-comments-entry-point-header-renderer'],
    ['related', 'Hide suggested videos', 'The list of videos next to and under the one you watch',
      '#related,ytd-watch-next-secondary-results-renderer,ytd-watch-flexy ytd-compact-autoplay-renderer'],
    ['endscreen', 'Hide end screens & cards', 'The video wall and pop-up cards at the end of a video',
      '.ytp-ce-element,.ytp-endscreen-content,.ytp-autonav-endscreen-countdown-overlay,.ytp-autonav-endscreen-upnext-container,.ytp-fullscreen-grid,.ytp-fullscreen-grid-stills-container,.ytp-cards-teaser,.ytp-cards-button,.iv-branding,.videowall-endscreen,.ytp-pause-overlay,.ytp-suggestion-set'],
    ['chat', 'Hide live chat', '', 'ytd-live-chat-frame,#chat,#chat-container'],
    ['promos', 'Hide promos & shelves', 'Merch, tickets, fundraisers, product lists and banners',
      'ytd-merch-shelf-renderer,ytd-ticket-shelf-renderer,ytd-donation-shelf-renderer,ytd-offer-module-renderer,ytd-product-list-renderer,ytd-statement-banner-renderer,ytd-banner-promo-renderer,#masthead-ad,ytd-ad-slot-renderer,ytd-brand-video-singleton-renderer,ytd-primetime-promo-renderer'],
  ]],
  ['EVERYWHERE', [
    ['explore', 'Hide Explore & More from YouTube', 'Trending, gaming, music and the other YouTube apps in the menu',
      'ytd-guide-section-renderer:has(a[href="/feed/trending"]),ytd-guide-section-renderer:has(a[href^="/feed/explore"]),ytd-guide-section-renderer:has(a[href="/gaming"]),ytd-guide-section-renderer:has(a[href*="music.youtube.com"]),ytd-guide-section-renderer:has(a[href*="kids.youtube.com"])'],
    ['bell', 'Hide the notification bell', '', 'ytd-notification-topbar-button-renderer'],
  ]],
];
const YT_ALL = YT_SW.flatMap(([, list]) => list);
const ytOn = (k) => !!(S.settings.yt && S.settings.yt[k]);
const isYT = (u) => /^https?:\/\/([a-z0-9-]+\.)*youtube\.com\//i.test(u || '');
function ytCss() {
  const sel = YT_ALL.filter(([k, , , css]) => css && ytOn(k)).map(([, , , css]) => css);
  if (!sel.length) return '';
  let css = `${sel.join(',')}{display:none!important}`;
  if (ytOn('home')) css += 'ytd-browse[page-subtype="home"] #primary::before{content:"Home feed hidden by Oto. Search, or open Subscriptions.";display:block;margin:72px auto;text-align:center;font:400 15px/1.5 Roboto,Arial,sans-serif;color:var(--yt-spec-text-secondary,#aaa)}';
  if (ytOn('related')) css += 'ytd-watch-flexy[flexy]:not([theater]) #secondary:not(:has(ytd-playlist-panel-renderer:not([hidden]))):not(:has(#chat:not([collapsed]))){min-width:0!important;width:0!important;padding:0!important}';
  return css;
}
async function ytApply(v) {
  if (!v || !v.wv) return;
  let url = '';
  try { url = v.wv.getURL(); } catch { return; }
  if (v.ytKey) { try { await v.wv.removeInsertedCSS(v.ytKey); } catch {} v.ytKey = null; }
  if (!isYT(url)) return;
  const css = ytCss();
  if (css) { try { v.ytKey = await v.wv.insertCSS(css); } catch {} }
}
function ytRefresh() { for (const v of V.values()) if (v && v.ready) ytApply(v); }
function ytShorts(v, url) {
  if (!ytOn('shortsPlayer')) return;
  const m = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/shorts\/([\w-]{6,})/i.exec(url || '');
  if (m) wv(v, (w) => w.executeJavaScript(`location.replace(${JSON.stringify(`https://www.youtube.com/watch?v=${m[1]}`)})`).catch(() => {}));
}

// ---------------------------------------------------------------- numbers
const shpN = (n) => (n || 0).toLocaleString();
function shpDays(days, back) {
  const out = [];
  for (let i = back - 1; i >= 0; i--) {
    const t = new Date(Date.now() - i * 864e5);
    const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const d = (days || {})[k] || { a: 0, t: 0 };
    out.push({ k, t, a: d.a || 0, tr: d.t || 0, r: d.r || 0 });
  }
  return out;
}
const shpSum = (list) => list.reduce((s, d) => ({ a: s.a + d.a, tr: s.tr + d.tr, r: s.r + (d.r || 0) }), { a: 0, tr: 0, r: 0 });
function shpAgo(t) {
  if (!t) return 'not yet';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
const shpLetter = (host) => h('span', { class: 'lt' }, (host || '?').replace(/^www\./, '').slice(0, 1).toUpperCase());

// ---------------------------------------------------------------- small building blocks
const shpCrumb = (txt, n) => h('div', { class: 'sh-crumb' }, h('i', {}), h('b', {}, '音'), h('span', {}, txt), h('em', {}), h('span', {}, n));
const shpLbl = (txt, extra) => h('div', { class: 'sh-lbl' }, h('span', {}, txt), h('em', {}), extra || null);
function shpSwitch(on, onchange) {
  const b = h('button', { class: `sh-sw${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(!!on), onclick: () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); onchange(v); } });
  return b;
}
function shpSeg(opts, cur, onpick) {
  const box = h('div', { class: 'sh-seg' }, ...opts.map(([id, label]) => h('button', { class: id === cur ? 'on' : '', 'data-id': id, onclick: async () => {
    box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.id === id));
    await onpick(id);
  } }, label)));
  return box;
}

// A line of plain facts under the big numbers: session recorders stopped (counted from real blocked requests), the
// protection level, which protections are on right now, and how many sites have Shield switched off.
function shpFacts(week, s) {
  const st = SHP.st || {};
  const ft = st.features || {};
  const prot = st.protection || (st.level === 'strict' ? 'strict' : 'standard');
  const off = S.settings.blockTrackers === false;
  const recSites = (s.sites || []).filter((x) => x.r > 0).length;
  const onList = off ? [] : [['Ads', true], ['Trackers', ft.trackers], ['Session recorders', ft.recorders], ['Cookie banners', ft.annoyances], ['Fingerprint protection', ft.fp], ['Calls hide your network', ft.webrtc && ft.webrtc !== 'off']].filter((x) => x[1]).map((x) => x[0]);
  const fact = (k, v, sub) => h('div', { class: 'fact' }, h('small', {}, k), h('b', {}, v), sub ? h('span', {}, sub) : null);
  return h('div', { class: 'sh-facts' },
    fact('SESSION RECORDERS · THIS WEEK', shpN(week.r || 0), week.r ? `stopped from recording you on ${recSites} ${recSites === 1 ? 'site' : 'sites'}` : 'none tried to record you'),
    fact('PROTECTION', off ? 'Off' : prot[0].toUpperCase() + prot.slice(1), off ? 'Turn it on in Blocking' : onList.join(' · ')),
    fact('SITE EXCEPTIONS', shpN((st.allow || []).length), (st.allow || []).length ? 'Shield is off on these sites' : 'Shield works on every site'));
}

// ---------------------------------------------------------------- 01 overview
function shpOverview() {
  const s = SHP.stats || { days: {}, sites: [], companies: [], total: 0 };
  const today = shpDays(s.days, 1)[0], week = shpSum(shpDays(s.days, 7)), d14 = shpDays(s.days, 14);
  const total = Math.max(s.total || 0, (S.stats && S.stats.blocked) || 0);
  const since = new Date(Math.min(s.since || Date.now(), S.since || Date.now())).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const off = S.settings.blockTrackers === false;
  const cell = (k, n, sub) => h('div', { class: 'cell' }, h('small', {}, k), h('b', {}, shpN(n)), h('span', {}, sub));
  const max = Math.max(1, ...d14.map((d) => d.a + d.tr));
  const chart = h('div', { class: 'sh-chart' }, ...d14.map((d, i) => h('div', { class: `col${i === 13 ? ' now' : ''}`, title: `${d.t.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}\n${shpN(d.tr)} trackers · ${shpN(d.a)} ads` },
    h('div', { class: 'bar' }, h('i', { class: 'a', style: `height:${(d.a / max) * 100}%` }), h('i', { class: 't', style: `height:${(d.tr / max) * 100}%` })),
    h('small', {}, i === 13 ? 'TODAY' : d.t.toLocaleDateString([], { weekday: 'narrow' })))));
  const sites = s.sites.filter((x) => x.t > 0).sort((a, b) => b.t - a.t).slice(0, 24);
  const siteRow = (x) => {
    const cos = [...new Set(x.by.filter((b) => b.co).map((b) => b.co))];
    const open = SHP.exp === `s:${x.host}`;
    return h('div', { class: `sh-site${open ? ' open' : ''}` },
      h('button', { class: 'row', onclick: () => { SHP.exp = open ? null : `s:${x.host}`; shpPaint(); } },
        shpLetter(x.host), h('span', { class: 'tt' }, h('b', {}, x.host), h('small', {}, cos.slice(0, 3).join(' · ') + (cos.length > 3 ? ` +${cos.length - 3}` : ''))),
        h('span', { class: 'n' }, h('b', {}, shpN(x.t)), h('small', {}, 'TRACKERS'))),
      open ? h('div', { class: 'det' },
        ...x.by.map((b) => h('div', { class: 'dr' }, h('span', {}, b.d), h('em', {}, b.co || 'ad'), h('b', {}, shpN(b.n)))),
        h('div', { class: 'acts' }, h('button', { onclick: () => { shpClose(); openUrl(`https://${x.host}`, { newTabForce: true }); } }, 'OPEN SITE'), h('button', { onclick: () => { SHP.tab = 'permissions'; SHP.q = x.host; SHP.exp = null; shpPaint(); } }, 'PERMISSIONS'))) : null);
  };
  const cmax = Math.max(1, ...s.companies.map((c) => c.sites));
  return [
    shpCrumb('SHIELD / OVERVIEW', '01'),
    h('h1', {}, 'Your privacy'),
    h('p', { class: 'sub' }, off ? 'Blocking is off. Turn it on in Blocking and Oto starts counting again.' : 'Everything Oto Shield blocked for you. These numbers stay on this PC.'),
    h('div', { class: 'sh-cells' },
      cell('TODAY', today.a + today.tr, `${shpN(today.tr)} trackers · ${shpN(today.a)} ads`),
      cell('THIS WEEK', week.a + week.tr, `${shpN(week.tr)} trackers · ${shpN(week.a)} ads`),
      cell('IN TOTAL', total, `since ${since}`)),
    shpFacts(week, s),
    shpLbl('LAST 14 DAYS', h('span', { class: 'leg' }, h('i', { class: 't' }), 'TRACKERS', h('i', { class: 'a' }), 'ADS')),
    chart,
    h('div', { class: 'sh-two' },
      h('div', {}, shpLbl('WHO TRIED TO TRACK YOU'),
        sites.length ? h('div', { class: 'sh-sites' }, ...sites.map(siteRow)) : h('p', { class: 'none' }, 'No trackers blocked yet. Browse a little and the websites that try to follow you show up here.')),
      h('div', {}, shpLbl('TRACKING COMPANIES'),
        s.companies.length ? h('div', { class: 'sh-cos' }, ...s.companies.slice(0, 14).map((c) => h('div', { class: 'co', title: `${c.name}: ${shpN(c.n)} requests blocked\n${c.top.join(', ')}` },
          h('span', { class: 'nm' }, c.name), h('span', { class: 'bar' }, h('i', { style: `width:${(c.sites / cmax) * 100}%` })), h('b', {}, `${c.sites} ${c.sites === 1 ? 'SITE' : 'SITES'}`))))
          : h('p', { class: 'none' }, 'Google, Meta and the others appear here once Oto has blocked them.'))),
    h('div', { class: 'sh-foot' }, h('span', {}, 'COUNTED ON THIS PC ONLY · NEVER UPLOADED'),
      h('button', { onclick: async () => { if (!confirm('Reset the privacy stats? The Oto Card total stays.')) return; SHP.stats = await oto.shield.statsReset(); shpPaint(); } }, 'RESET STATS')),
  ];
}

// ---------------------------------------------------------------- 02 blocking
const SHP_LEVELS = [
  ['standard', 'Standard', 'Ads, trackers and session recorders blocked. Fingerprint protection. Recommended.'],
  ['strict', 'Strict', 'Standard, plus cookie banners, popups and “turn off your adblocker” walls, and calls learn less about your network. A few sites may break.'],
  ['custom', 'Custom', 'Choose each protection yourself, below.'],
];
// Each protection as a switch. Changing one moves the level to Custom (Oto's main process does that).
const SHP_FEATURES = [
  ['trackers', 'Trackers and analytics', 'Scripts that follow you from site to site (Google Analytics, Meta, TikTok and thousands more)'],
  ['recorders', 'Session recorders', 'Products that record your mouse, scrolling, clicks and typing on a page so it can be replayed (Hotjar, FullStory, Clarity…)'],
  ['annoyances', 'Cookie banners and popups', 'Also newsletter popups and “turn off your adblocker” walls. A few sites may break'],
  ['fp', 'Fingerprint protection', 'Each site gets slightly different canvas, WebGL and audio answers every session, so it can’t recognise this PC. Not a full shield: screen size, fonts and time zone stay real'],
];
const SHP_RTC = [['off', 'Off'], ['route', 'Standard'], ['public', 'Strict']];
const SHP_RTC_HELP = {
  off: 'A call can find every network connection of this PC, also your real address when you use a VPN',
  route: 'A call only sees the connection your traffic really uses, so a VPN isn’t bypassed',
  public: 'A call only sees your public address, nothing about your home network. Calls on the same Wi-Fi may connect slower',
};
function shpBlocking() {
  const st = SHP.st || {};
  const on = S.settings.blockTrackers !== false;
  const t = activeTab();
  const web = !!(t && /^https?:/.test(t.url || ''));
  // st.protection and st.features come from Oto's main process (settings from before 1.5 are understood there)
  const prot = st.protection || (st.level === 'strict' ? 'strict' : 'standard');
  const ft = st.features || { trackers: st.level !== 'basic', annoyances: st.level === 'strict', recorders: st.level !== 'basic', fp: st.fp !== false, webrtc: 'route' };
  const add = h('input', { class: 'sh-in', placeholder: 'example.com', spellcheck: 'false', onkeydown: (e) => { if (e.key === 'Enter') addSite(); } });
  async function addSite() {
    const host = hostOf(/^https?:/.test(add.value) ? add.value : `https://${add.value.trim()}`);
    if (!host || !host.includes('.')) return toast('Type a website like example.com', { timeout: 2000 });
    await oto.shield.site(`https://${host}/`, true);
    SHP.st = await oto.shield.state(`https://${host}/`); shpPaint();
    toast(`Blocking is off on ${host}`, { icon: 'shield', timeout: 2000 });
  }
  return [
    shpCrumb('SHIELD / BLOCKING', '02'),
    h('h1', {}, 'Blocking'),
    h('p', { class: 'sub' }, 'Oto Shield uses uBlock Origin’s filter lists. Pick how strict it is, and turn it off where a site needs it.'),
    h('div', { class: 'sh-row big' }, h('span', { class: 'tt' }, h('b', {}, 'Block ads & trackers'), h('small', {}, on ? (st.mode === 'basic' ? 'Using the built-in list until the full lists load' : 'On everywhere, except the sites below') : 'Off everywhere')),
      shpSwitch(on, async (v) => { setPref('blockTrackers', v); INFO.blocking = await oto.setBlocking(v); updateChrome(); SHP.st = await oto.shield.state('https://oto.local/'); shpPaint(); toast(v ? 'Blocking on. Reload pages to apply' : 'Blocking off', { icon: 'shield', timeout: 1800 }); })),
    shpLbl('PROTECTION LEVEL'),
    h('div', { class: `sh-levels${on ? '' : ' dim'}` }, ...SHP_LEVELS.map(([id, name, desc], i) => h('button', { class: `lv${prot === id ? ' on' : ''}`, disabled: SHP.busy, onclick: async () => {
      if (prot === id || SHP.busy) return;
      SHP.busy = true; st.protection = id; shpPaint();
      const r = await oto.shield.level(id);
      SHP.busy = false; Object.assign(st, r); shpPaint();
      toast(id === 'custom' ? 'Custom protection. Use the switches below' : `${name} protection. Reload pages to apply`, { icon: 'shield', timeout: 2200 });
    } }, h('small', {}, String(i + 1).padStart(2, '0')), h('b', {}, name), h('span', {}, desc), h('i', { class: 'meter' }, ...[0, 1, 2].map((k) => h('em', { class: id !== 'custom' && k <= i + 1 ? 'f' : '' })))))),
    shpLbl('WHAT’S ON', h('span', { class: 'leg' }, prot === 'custom' ? h('button', { class: 'sh-btn', disabled: !!SHP.busy, onclick: async () => { Object.assign(st, await oto.shield.level('standard')); shpPaint(); toast('Back to Standard protection. Reload pages to apply', { icon: 'shield', timeout: 2200 }); } }, 'RESTORE DEFAULTS') : 'CHANGING A SWITCH MAKES IT CUSTOM')),
    h('div', { class: `sh-feats${on ? '' : ' dim'}` },
      h('div', { class: 'sh-row' }, h('span', { class: 'tt' }, h('b', {}, 'Ads'), h('small', {}, 'Always blocked while Oto Shield is on')), h('span', { class: 'sh-fixed' }, 'ON')),
      ...SHP_FEATURES.map(([id, name, desc]) => h('div', { class: 'sh-row' }, h('span', { class: 'tt' }, h('b', {}, name), h('small', {}, desc)),
        shpSwitch(!!ft[id], async (v) => { Object.assign(st, await oto.shield.feature(id, v)); shpPaint(); toast(`${name} ${v ? 'on' : 'off'}. Reload pages to apply`, { icon: 'shield', timeout: 2000 }); }))),
      h('div', { class: 'sh-row' }, h('span', { class: 'tt' }, h('b', {}, 'Calls and your network (WebRTC)'), h('small', {}, SHP_RTC_HELP[ft.webrtc] || '')),
        shpSeg(SHP_RTC, ft.webrtc, async (v) => { Object.assign(st, await oto.shield.feature('webrtc', v)); shpPaint(); }))),
    shpLbl('DANGEROUS SITES'),
    h('div', { class: 'sh-row' }, h('span', { class: 'tt' }, h('b', {}, 'Warn me about dangerous sites'), h('small', {}, st.dangerCount ? `${shpN(st.dangerCount)} known malware and phishing sites · list updated ${shpAgo(st.dangerAt)} · checked on this PC, nothing is sent anywhere` : 'Malware and phishing lists from URLhaus (abuse.ch), updated twice a day · checked on this PC')),
      shpSwitch(st.danger !== false, async (v) => { st.danger = await oto.shield.danger(v); toast(v ? 'Dangerous-site warnings on' : 'Dangerous-site warnings off', { icon: 'shield', timeout: 2000 }); })),
    shpLbl('FILTER LISTS'),
    h('div', { class: 'sh-row' }, h('span', { class: 'tt' }, h('b', {}, 'uBlock Origin, EasyList, EasyPrivacy + Oto’s extra list'), h('small', {}, SHP.busy === 'upd' ? 'Downloading the newest lists…' : `Updated ${shpAgo(st.listsAt)} · they also update by themselves every week`)),
      h('button', { class: 'sh-btn', disabled: !on || !!SHP.busy, onclick: async () => {
        SHP.busy = 'upd'; shpPaint();
        const r = await oto.shield.update();
        SHP.busy = false; Object.assign(st, { listsAt: r.listsAt, mode: r.mode }); shpPaint();
        toast(r.ok ? 'Filter lists updated. Reload pages to apply' : r.off ? 'Turn blocking on first' : 'Couldn’t download the lists. Kept the ones you have', { icon: 'shield', timeout: 2400 });
      } }, SHP.busy === 'upd' ? 'UPDATING…' : 'UPDATE NOW')),
    shpLbl('BLOCK THINGS YOURSELF'),
    h('div', { class: 'sh-tools' },
      h('button', { disabled: !web, title: web ? '' : 'Open a website first', onclick: () => { shpClose(); v1ShieldPick('zap'); } }, h('b', {}, 'Zap'), h('small', {}, 'Click anything on the page to remove it until you reload')),
      h('button', { disabled: !web, title: web ? '' : 'Open a website first', onclick: () => { shpClose(); v1ShieldPick('pick'); } }, h('b', {}, 'Hide for good'), h('small', {}, `Pick something to hide on ${web ? hostOf(t.url) : 'a site'} from now on`)),
      h('button', { onclick: () => { shpClose(); v1ShieldFilters(); } }, h('b', {}, `My filters${st.filters ? ` · ${st.filters}` : ''}`), h('small', {}, 'Your own rules in uBlock Origin syntax'))),
    shpLbl('BLOCKING IS OFF ON'),
    h('div', { class: 'sh-allow' },
      ...(st.allow || []).map((host) => h('span', { class: 'chip' }, host, h('button', { title: 'Turn blocking back on', onclick: async () => { await oto.shield.site(`https://${host}/`, false); st.allow = st.allow.filter((x) => x !== host); shpPaint(); } }, '×'))),
      (st.allow || []).length ? null : h('span', { class: 'none' }, 'No sites. Blocking works everywhere.'),
      h('span', { class: 'add' }, add, h('button', { class: 'sh-btn', onclick: addSite }, 'ADD'))),
  ];
}

// ---------------------------------------------------------------- 03 youtube
function shpYouTube() {
  const set = (k, v) => { S.settings.yt = { ...(S.settings.yt || {}), [k]: v }; save(); ytRefresh(); };
  const n = YT_ALL.filter(([k]) => ytOn(k)).length;
  return [
    shpCrumb('SHIELD / YOUTUBE', '03'),
    h('h1', {}, 'YouTube, calmer'),
    h('p', { class: 'sub' }, 'Switch off the parts of YouTube you don’t want. Changes show right away, no filters to write.'),
    ...YT_SW.flatMap(([grp, list]) => [shpLbl(grp),
      h('div', { class: 'sh-list' }, ...list.map(([k, label, desc]) => h('div', { class: 'sh-row' }, h('span', { class: 'tt' }, h('b', {}, label), desc ? h('small', {}, desc) : null), shpSwitch(ytOn(k), (v) => set(k, v)))))]),
    h('div', { class: 'sh-foot' }, h('span', {}, `${n} OF ${YT_ALL.length} SWITCHED ON`),
      h('button', { onclick: () => { S.settings.yt = {}; save(); ytRefresh(); shpPaint(); } }, 'ALL OFF'),
      h('button', { onclick: () => { shpClose(); openUrl('https://www.youtube.com/', { newTabForce: true }); } }, 'OPEN YOUTUBE')),
  ];
}

// ---------------------------------------------------------------- 04 permissions
const SHP_PERMS = [
  ['camera', 'Camera', 'cam', 'ask'],
  ['microphone', 'Microphone', 'mic', 'ask'],
  ['geolocation', 'Location', 'mappin', 'ask'],
  ['notifications', 'Notifications', 'bell', 'ask'],
  ['cookies', 'Cookies', 'cookie', 'cookies'],
  ['autoplay', 'Autoplay', 'autoplay', 'allow'],
];
function shpVal(origin, key) {
  const p = SHP.perms, k = `${origin}|${key}`;
  if (k in p) return p[k];
  if ((key === 'camera' || key === 'microphone') && `${origin}|media` in p) return p[`${origin}|media`];
  return undefined;
}
const shpWord = (key, v) => (key === 'cookies' ? (v === false ? 'blocked' : v === 'session' ? 'cleared on close' : 'allowed') : v === true ? 'allowed' : v === false ? 'blocked' : '');
function shpSites() {
  const set = new Map();
  const addO = (o, w) => { if (!/^https?:\/\//.test(o || '')) return; try { o = new URL(o).origin; } catch { return; } set.set(o, Math.max(set.get(o) || 0, w)); };
  for (const k of Object.keys(SHP.perms)) addO(k.split('|')[0], 3);
  for (const t of S.tabs || []) addO(t.url, 2);
  for (const x of (S.history || []).slice(0, 400)) addO(x.u, 1);
  let list = [...set.entries()];
  if (SHP.q) list = list.filter(([o]) => o.toLowerCase().includes(SHP.q.toLowerCase()));
  return list.sort((a, b) => b[1] - a[1] || hostOf(a[0]).localeCompare(hostOf(b[0]))).slice(0, 80).map(([o]) => o);
}
async function shpSet(key, val) { SHP.perms = await oto.setPermission(key, val); }
function shpPermissions() {
  const def = (k) => SHP.perms[`*|${k}`];
  const defaults = h('div', { class: 'sh-defs' }, ...SHP_PERMS.filter(([k]) => k !== 'cookies').map(([k, label, ic, kind]) => h('div', { class: 'sh-row' },
    iconEl(ic), h('span', { class: 'tt' }, h('b', {}, label)),
    kind === 'allow'
      ? shpSeg([['allow', 'Allow'], ['block', 'Block']], def(k) === false ? 'block' : 'allow', (id) => shpSet(`*|${k}`, id === 'block' ? false : null).then(shpPaint))
      : shpSeg([['ask', 'Ask'], ['block', 'Block']], def(k) === false ? 'block' : 'ask', (id) => shpSet(`*|${k}`, id === 'block' ? false : null).then(shpPaint)))));
  const search = h('input', { class: 'sh-in wide', placeholder: 'Find or add a site', value: SHP.q, spellcheck: 'false', oninput: () => { SHP.q = search.value.trim(); clearTimeout(SHP.qt); SHP.qt = setTimeout(() => { shpPaint(); const s2 = SHP.open && SHP.open.box.querySelector('.sh-in.wide'); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); } }, 180); } });
  const sites = shpSites();
  const typed = SHP.q && /\./.test(SHP.q) ? (() => { try { return new URL(/^https?:/.test(SHP.q) ? SHP.q : `https://${SHP.q}`).origin; } catch { return ''; } })() : '';
  if (typed && !sites.includes(typed)) sites.unshift(typed);
  const row = (origin) => {
    const host = hostOf(origin) || origin, open = SHP.exp === `p:${origin}`;
    const sum = shpSumOf(origin);
    const ctl = ([k, label, ic, kind]) => {
      const v = shpVal(origin, k), d = def(k);
      let opts, cur;
      if (kind === 'cookies') { opts = [['allow', 'Allow'], ['block', 'Block'], ['session', 'Clear on close']]; cur = v === false ? 'block' : v === 'session' ? 'session' : 'allow'; }
      else if (kind === 'allow') { opts = [['def', d === false ? 'Default · block' : 'Default · allow'], ['allow', 'Allow'], ['block', 'Block']]; cur = v === true ? 'allow' : v === false ? 'block' : 'def'; }
      else { opts = [['def', d === false ? 'Default · block' : 'Ask'], ['allow', 'Allow'], ['block', 'Block']]; cur = v === true ? 'allow' : v === false ? 'block' : 'def'; }
      return h('div', { class: 'sh-row' }, iconEl(ic), h('span', { class: 'tt' }, h('b', {}, label)), shpSeg(opts, cur, async (id) => {
        const val = id === 'def' || (kind === 'cookies' && id === 'allow') ? null : id === 'allow' ? true : id === 'block' ? false : 'session';
        await shpSet(`${origin}|${k}`, val);
        if (k === 'cookies' && id === 'block') toast(`Cookies blocked on ${host}. You’ll be signed out there`, { icon: 'cookie', timeout: 2600 });
        if (k === 'autoplay') toast('Reload the site to apply', { timeout: 1600 });
        const s = SHP.open && SHP.open.box.querySelector(`.sh-perm[data-o="${CSS.escape(origin)}"] .sum`);
        if (s) s.textContent = shpSumOf(origin);
      }));
    };
    return h('div', { class: `sh-perm${open ? ' open' : ''}`, 'data-o': origin },
      h('button', { class: 'row', onclick: () => { SHP.exp = open ? null : `p:${origin}`; shpPaint(); } }, shpLetter(host), h('span', { class: 'tt' }, h('b', {}, host), h('small', { class: 'sum' }, sum)), h('span', { class: 'chev', html: icon('chev') })),
      open ? h('div', { class: 'det' }, ...SHP_PERMS.map(ctl),
        h('div', { class: 'acts' },
          h('button', { onclick: async () => { for (const [k] of SHP_PERMS) if (`${origin}|${k}` in SHP.perms) SHP.perms = await oto.setPermission(`${origin}|${k}`, null); if (`${origin}|media` in SHP.perms) SHP.perms = await oto.setPermission(`${origin}|media`, null); shpPaint(); } }, 'RESET'),
          h('button', { onclick: async () => { if (!confirm(`Clear cookies and saved data for ${host}? You’ll be signed out of this site.`)) return; const ok = await oto.clearSite(origin); SHP.perms = await oto.listPermissions(); shpPaint(); toast(ok ? `Cleared data for ${host}` : 'Couldn’t clear site data', { timeout: 2200 }); } }, 'CLEAR SITE DATA'))) : null);
  };
  return [
    shpCrumb('SHIELD / PERMISSIONS', '04'),
    h('h1', {}, 'Site permissions'),
    h('p', { class: 'sub' }, 'Camera, microphone, location, notifications, cookies and autoplay for every website, in one place.'),
    shpLbl('FOR ALL SITES'),
    defaults,
    shpLbl('EACH SITE', h('span', { class: 'cnt' }, `${sites.length}`)),
    search,
    sites.length ? h('div', { class: 'sh-perms' }, ...sites.map(row)) : h('p', { class: 'none' }, 'No sites match. Type a full address like example.com to add it.'),
  ];
}
function shpSumOf(origin) {
  const parts = [];
  for (const [k, label] of SHP_PERMS) { const w = shpWord(k, shpVal(origin, k)); if (w && !(k === 'cookies' && w === 'allowed')) parts.push(`${label} ${w}`); }
  return parts.join(' · ') || 'Default settings';
}

// ---------------------------------------------------------------- the page
function shpPaint() {
  const o = SHP.open;
  if (!o) return;
  const scroll = o.main.scrollTop;
  o.nav.querySelectorAll('button[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === SHP.tab));
  const st = SHP.st || {};
  const on = S.settings.blockTrackers !== false;
  o.status.replaceChildren(h('i', { class: on ? 'on' : '' }), h('span', {}, on ? `SHIELD ON · ${(st.protection || (st.level === 'strict' ? 'strict' : 'standard')).toUpperCase()}` : 'SHIELD OFF'));
  const body = { overview: shpOverview, blocking: shpBlocking, youtube: shpYouTube, permissions: shpPermissions }[SHP.tab]();
  o.main.replaceChildren(...body.filter(Boolean));
  o.main.className = `sh-main t-${SHP.tab}`;
  if (o.lastTab === SHP.tab) o.main.scrollTop = scroll; else o.main.scrollTop = 0;
  o.lastTab = SHP.tab;
}
function shpClose() {
  if (!SHP.open) return;
  SHP.open.layer.remove(); SHP.open = null;
  if (v1Pop && v1Pop.isShield) v1Pop = null;
}
async function v1ShieldPage(tab) {
  if (tab) SHP.tab = tab;
  if (SHP.open) { shpPaint(); return; }
  v1ClosePop();
  const layer = v1Layer(() => shpClose());
  const nav = h('nav', { class: 'sh-nav' },
    h('div', { class: 'brand' }, h('span', { class: 'vx', html: vortexSvg({ small: true, bg: false }) }), h('span', {}, h('b', {}, 'OTO SHIELD'), h('small', {}, 'PRIVACY'))),
    ...SHP_TABS.map(([id, label], i) => h('button', { 'data-tab': id, onclick: () => { SHP.tab = id; SHP.exp = null; shpPaint(); } }, h('small', {}, String(i + 1).padStart(2, '0')), h('span', {}, label))),
    h('div', { class: 'grow' }));
  const status = h('div', { class: 'status' });
  nav.append(status);
  const main = h('div', { class: 'sh-main' });
  const box = h('div', { class: 'v1-shp enter' }, nav, main, h('button', { class: 'sh-x', title: 'Close', html: icon('x'), onclick: () => shpClose() }));
  layer.append(box);
  SHP.open = { layer, box, nav, main, status, lastTab: null };
  v1Pop = { isShield: true, remove: shpClose };
  const t = activeTab();
  try { [SHP.stats, SHP.st, SHP.perms] = await Promise.all([oto.shield.stats(), oto.shield.state(t && /^https?:/.test(t.url || '') ? t.url : 'https://oto.local/'), oto.listPermissions()]); } catch (e) { console.warn('[oto shield page]', e && e.message); }
  shpPaint();
}

// ---------------------------------------------------------------- screen sharing picker
const SCR = { open: null, queue: [] };
const SHP_DANGER = new Map(); // webContents id -> the dangerous page Oto just stopped
function v1ScreenPick(p) {
  if (SCR.open) { SCR.queue.push(p); return; }
  const host = hostOf(p.origin) || 'This site';
  let kind = p.sources.some((s) => s.kind === 'screen') ? 'screen' : 'window', sel = null, audio = !!p.audio;
  const layer = v1Layer(() => done(null));
  const grid = h('div', { class: 'sc-grid' });
  const share = h('button', { class: 'pri', disabled: true, onclick: () => done(sel) });
  share.textContent = 'SHARE';
  const tabs = h('div', { class: 'sc-tabs' });
  const paint = () => {
    tabs.replaceChildren(...[['screen', 'SCREENS'], ['window', 'WINDOWS']].filter(([k]) => p.sources.some((s) => s.kind === k)).map(([k, l]) => h('button', { class: k === kind ? 'on' : '', onclick: () => { kind = k; sel = null; paint(); } }, l)));
    grid.replaceChildren(...p.sources.filter((s) => s.kind === kind).map((s) => h('button', { class: `sc-src${sel === s.id ? ' on' : ''}`, title: s.name, onclick: () => { sel = s.id; paint(); }, ondblclick: () => done(s.id) },
      h('span', { class: 'th' }, s.thumb ? h('img', { src: s.thumb, alt: '' }) : null),
      h('span', { class: 'nm' }, s.icon ? h('img', { src: s.icon, alt: '' }) : null, h('span', {}, s.name)))));
    share.disabled = !sel;
  };
  const box = h('div', { class: 'v1-scr enter' },
    h('div', { class: 'sh-crumb' }, h('i', {}), h('b', {}, '音'), h('span', {}, 'SHARE / SCREEN'), h('em', {})),
    h('h1', {}, 'Share your screen'),
    h('p', { class: 'sub' }, h('b', {}, host), ' wants to see your screen. Pick what it can see. You can stop sharing any time.'),
    tabs, grid,
    h('div', { class: 'sc-foot' },
      p.audio ? h('label', { class: 'sc-aud' }, (() => { const c = h('input', { type: 'checkbox', checked: audio, onchange: () => { audio = c.checked; } }); return c; })(), h('span', {}, 'Share sound too')) : h('span', {}),
      h('button', { onclick: () => done(null) }, 'CANCEL'), share));
  layer.append(box);
  SCR.open = { id: p.id, layer };
  paint();
  function done(sourceId) {
    if (!SCR.open) return;
    oto.replyScreen(p.id, sourceId, sourceId && audio);
    layer.remove(); SCR.open = null;
    if (sourceId) toast(`Sharing with ${host}`, { icon: 'eye', timeout: 2600 });
    const next = SCR.queue.shift(); if (next) v1ScreenPick(next);
  }
}

function initV1j() {
  // A stopped page load looks like "cancelled" to the tab, so show the warning page ourselves.
  oto.on('danger', (d) => {
    if (!d || !d.wcId) return;
    d.at = Date.now();
    SHP_DANGER.set(d.wcId, d);
    const show = () => {
      if (SHP_DANGER.get(d.wcId) !== d) return;
      const tabId = wcToTab.get(d.wcId), v = tabId && V.get(tabId), t = tabId && tabById(tabId);
      if (!v) return;
      v.error = { code: 'danger', desc: d.kind, url: d.url }; v.loading = false;
      if (t) { t.url = d.url; t.title = hostOf(d.url); }
      render(); if (S.active[S.activeWs] === tabId) updateChrome();
    };
    for (const ms of [150, 700, 1500, 3000]) setTimeout(show, ms); // a slow PC can link the tab to its page late
  });
  oto.on('screen:pick', (p) => v1ScreenPick(p));
  oto.on('screen:cancel', (id) => { if (SCR.open && SCR.open.id === id) { SCR.open.layer.remove(); SCR.open = null; } SCR.queue = SCR.queue.filter((x) => x.id !== id); });
  Object.assign(ICONS, SHP_ICONS);
  // YouTube switches on every YouTube page
  const _bind = bindView;
  bindView = function (tab, v) {
    _bind.apply(this, arguments);
    v.wv.addEventListener('dom-ready', () => { v.ytKey = null; ytApply(v); });
    v.wv.addEventListener('did-navigate', (e) => ytShorts(v, e.url));
    v.wv.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) ytShorts(v, e.url); });
  };
  ACTIONS.push(
    { name: 'Privacy dashboard', kw: 'privacy stats trackers blocked today week shield dashboard', icon: 'shield', run: () => v1ShieldPage('overview') },
    { name: 'Protection level', kw: 'blocking standard strict custom basic balanced filter lists update adblock trackers session recorders fingerprint webrtc', icon: 'shield', run: () => v1ShieldPage('blocking') },
    { name: 'YouTube switches', kw: 'youtube shorts comments suggested end screen distractions', icon: 'ytube', run: () => v1ShieldPage('youtube') },
    { name: 'Site permissions', kw: 'permissions camera microphone location notifications cookies autoplay sites', icon: 'lock', run: () => v1ShieldPage('permissions') });
}
