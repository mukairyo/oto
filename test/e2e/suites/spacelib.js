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

  // without the space look, the Library is as before
  await t.js("(S.settings.spaceHome = false, spaceHome(), openLibrary('history'), 1)"); await t.sleep(300);
  a = await J("return { space: document.getElementById('library').classList.contains('space-lib'), brand: !!document.querySelector('#library .sl-brand'), old: !!document.querySelector('#library .lib-group') };");
  t.check('with the space look off, the Library is the classic one', !a.space && !a.brand && a.old, JSON.stringify(a));
  await t.js("(S.settings.spaceHome = true, spaceHome(), closeLibrary(), 1)");
};
