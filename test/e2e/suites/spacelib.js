'use strict';
// The Library remade in the space look (1.8.3, src/space-library.js): the sidebar with counts, the page header,
// History as a timeline with a week chart and most-visited sites, Downloads as a ring card and file cards.
module.exports = async (t) => {
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  await t.open('http://news.site/');
  await t.js(`(() => { const D = 864e5, now = Date.now(); S.history = [
    { u: 'http://radio.site/', t: 'Radio', ts: now - 60e3 }, { u: 'http://kitchen.site/', t: 'Kitchen', ts: now - 120e3 },
    { u: 'http://radio.site/b', t: 'Radio B', ts: now - D - 60e3 }, { u: 'http://old.site/', t: 'Old', ts: now - 9 * D }]; return 1; })()`);
  await t.js("(openLibrary('history'), 1)"); await t.sleep(300);
  let a = await J(`const nav = document.querySelector('#library .lib-nav'); const on = nav.querySelector('button.on');
    return { space: document.getElementById('library').classList.contains('space-lib'), brand: (nav.querySelector('.sl-brand') || {}).textContent,
      count: (on.querySelector('.sl-n') || {}).textContent, crumb: (document.querySelector('#library .sl-crumb') || {}).textContent, title: (document.querySelector('#library .sl-title h1') || {}).textContent,
      kbd: !!document.querySelector('#library .lib-search-wrap kbd'), store: !!nav.querySelector('.sl-store') };`);
  t.check('the Library has the new sidebar (OTO // LIBRARY, a count per page) and header (LIBRARY / HISTORY, big title)',
    a.space && /OTO \/\/ LIBRARY/.test(a.brand || '') && a.count === '4' && /LIBRARY \/ HISTORY/.test(a.crumb || '') && a.title === 'History' && a.kbd && a.store, JSON.stringify(a));
  a = await J(`return { days: [...document.querySelectorAll('#library .sl-day h5')].map((x) => x.textContent), first: !!document.querySelector('#library .sl-day.first .sl-node svg'),
    bars: document.querySelectorAll('#library .sl-bar').length, top: [...document.querySelectorAll('#library .sl-top5 .nm')].map((x) => x.textContent), clear: !!document.querySelector('#library .sl-clear') };`);
  t.check('History is a timeline of days (a star per day) with this week’s chart and the most-visited sites',
    a.days.length >= 2 && /TODAY · 2 VISITS/.test(a.days[0]) && a.first && a.bars === 7 && a.top[0] === 'radio.site' && a.clear, JSON.stringify(a));
  await t.js("[...document.querySelectorAll('#library .sl-chip')].find((b) => b.textContent === 'Today').click(), 1"); await t.sleep(200);
  a = await J("return { rows: document.querySelectorAll('#library .sl-visit').length, on: (document.querySelector('#library .sl-chip.on') || {}).textContent };");
  t.check('…"Today" shows only today', a.rows === 2 && a.on === 'Today', JSON.stringify(a));
  await t.js("[...document.querySelectorAll('#library .sl-chip')].find((b) => b.textContent === 'All').click(), 1"); await t.sleep(200);
  const before = await t.js('S.tabs.length');
  await t.js("document.querySelector('#library .sl-visit').click(), 1"); await t.sleep(400);
  a = await J("return { open: !!document.getElementById('library') && !document.getElementById('library').hidden, tabs: S.tabs.length, url: (activeTab() || {}).url };");
  t.check('…clicking a visit opens it in a new tab', a.tabs === before + 1 && /radio\.site/.test(a.url || ''), JSON.stringify(a));

  await t.js(`(() => { const now = Date.now(); onDownload({ id: 7101, name: 'big-file.zip', url: 'http://fine.site/big', total: 100e6, received: 40e6, startedAt: now, state: 'progress' });
    onDownload({ id: 7102, name: 'notes.pdf', url: 'http://fine.site/n', total: 2e6, received: 2e6, startedAt: now - 3600e3, state: 'completed', path: '' }); return 1; })()`);
  await t.js("(openLibrary('downloads'), 1)"); await t.sleep(300);
  a = await J(`const live = document.querySelector('#library .sl-live'); return { live: !!live, k: live && live.querySelector('.k').textContent, ring: live && (live.querySelector('.sl-ring') || {}).getAttribute('aria-label'),
    btns: live && [...live.querySelectorAll('.sl-live-btns .btn')].map((b) => b.textContent), files: [...document.querySelectorAll('#library .sl-file .lib-txt b')].map((x) => x.textContent),
    tag: (document.querySelector('#library .sl-file .sl-tag') || {}).textContent, stats: (document.querySelector('#library .sl-stats') || {}).textContent };`);
  t.check('Downloads: what’s coming in is a big card with a progress ring, Pause and Cancel', a.live && a.k === 'DOWNLOADING NOW' && a.ring === '40%' && a.btns.join() === 'Pause,Cancel', JSON.stringify(a));
  t.check('…what landed shows as file cards with a type tag, and the totals sit by the title', a.files.includes('notes.pdf') && a.tag === 'PDF' && /FILES/.test(a.stats || ''), JSON.stringify(a));
  await t.js('(oto.dlAction && 0, closeLibrary(), 1)');

  // (1.8.6) History times read like the start page (4:20 PM, not 04:20 PM)
  await t.js("(openLibrary('history'), 1)"); await t.sleep(300);
  a = await J("return { times: [...document.querySelectorAll('#library .sl-visit')].map((r) => (r.textContent.match(/\\d{1,2}:\\d{2}\\s?[AP]M/i) || [''])[0]) };");
  t.check('History times have no leading zero (4:20 PM, like the start page)', a.times.length > 0 && a.times.every((x) => x === '' || !/^0\d:/.test(x)), JSON.stringify(a));

  // (1.8.6) the empty Downloads page: the star, where files go (open it / pick another), three tips
  await t.js("(S.downloads = [], DL_LIVE.clear && DL_LIVE.clear(), openLibrary('downloads'), 1)"); await t.sleep(700);
  a = await J(`const e = document.querySelector('#library .sl-dlempty'); return { e: !!e, h: e && e.querySelector('h2').textContent, path: e && (e.querySelector('.sl-dlfolder code') || {}).textContent,
    btns: e && [...e.querySelectorAll('.sl-dlfolder .btn')].map((b) => b.textContent), tips: e ? e.querySelectorAll('.sl-tips > div').length : 0, star: !!(e && e.querySelector('.art .star')),
    ring: e && (() => { const r = e.querySelector('.art circle[r="44"]'); return r && r.getAttribute('cy'); })() };`);
  t.check('an empty Downloads page shows the star, your downloads folder with Open folder and Change, and three tips',
    a.e && a.h === 'Nothing has landed yet' && /Downloads/i.test(a.path || '') && a.btns.join() === 'Open folder,Change' && a.tips === 3 && a.star && a.ring === '118', JSON.stringify(a)); // ring centred on the tray (1.8.9)
  a = { f: JSON.parse(await t.js('oto.dlFolder().then((f) => JSON.stringify(f))')) };
  t.check('…the folder comes from Oto itself (Windows’ Downloads unless you picked another)', a.f && typeof a.f.path === 'string' && a.f.custom === false, JSON.stringify(a));
  await t.js('(closeLibrary(), 1)');

  // (1.8.6) the Oto Card's badges as a grid: unlocked ones lit, locked ones with a hint or progress, the secret hidden
  await t.js("(S.v1Badges = { week: Date.now(), split: Date.now() }, S.stats = Object.assign(S.stats || {}, { blocked: 620 }), openLibrary('card'), 1)"); await t.sleep(700);
  a = await J(`const g = document.querySelector('#library .sl-badges'); return { g: !!g, n: g && g.querySelector('.n').textContent, tiles: g ? g.querySelectorAll('.sl-badge').length : 0,
    on: g ? g.querySelectorAll('.sl-badge.on').length : 0, ads: g && [...g.querySelectorAll('.sl-badge')].map((x) => x.textContent).find((x) => /1,000 ads/.test(x)),
    secret: g && [...g.querySelectorAll('.sl-badge b')].some((b) => b.textContent === '???'), next: g && (g.querySelector('.sl-next b') || {}).textContent, last: !!document.querySelector('#library .card-form > .sl-badges-row:last-child') };`);
  t.check('the Oto Card shows all badges as a grid: 2 of 15 lit, "620 / 1,000" on the ads badge, the secret still hidden, and what’s next',
    a.g && /2 OF 15/.test(a.n || '') && a.tiles === 15 && a.on === 2 && /620 \/ 1,000/.test(a.ads || '') && a.secret && /Next up: 1,000 ads blocked/.test(a.next || '') && a.last, JSON.stringify(a));
  await t.js('(closeLibrary(), 1)');

  // (1.8.6) Settings in the space look: dark starry window, a line under the title, and "Neon star"
  await t.js("(openSettings('general'), 1)"); await t.sleep(400);
  a = await J(`const sh = document.querySelector('#settings .sheet'); const cs = getComputedStyle(sh); return { bg: cs.backgroundImage, sub: (document.querySelector('#settings .ss-sub') || {}).textContent,
    crumb: getComputedStyle(document.querySelector('#settings .v1-crumb') || sh).textTransform, neon: [...document.querySelectorAll('#settings .seg button')].some((b) => b.textContent === 'Neon star'),
    shooting: [...document.querySelectorAll('#settings .seg button')].some((b) => b.textContent === 'Shooting star') };`);
  t.check('Settings has the space look (starry background, a line under the title) and the download option is called "Neon star"',
    /space\.webp/.test(a.bg) && /How Oto starts/.test(a.sub || '') && a.crumb === 'uppercase' && a.neon && !a.shooting, JSON.stringify(a));
  await t.js('(closeSettings(), 1)');

  // without the space look, the Library is as before
  await t.js("(S.settings.spaceHome = false, spaceHome(), openLibrary('history'), 1)"); await t.sleep(300);
  a = await J("return { space: document.getElementById('library').classList.contains('space-lib'), brand: !!document.querySelector('#library .sl-brand'), old: !!document.querySelector('#library .lib-group') };");
  t.check('with the space look off, the Library is the classic one', !a.space && !a.brand && a.old, JSON.stringify(a));
  await t.js("(S.settings.spaceHome = true, spaceHome(), closeLibrary(), 1)");
};
