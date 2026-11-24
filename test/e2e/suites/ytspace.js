'use strict';
// YouTube in Oto's look (1.9.1): youtube.com (and only the site itself) gets the space sidebar's style sheet, with
// Oto's own fonts handed over inline and the stars drawn in CSS; Settings › Appearance › Websites turns it off.
module.exports = async (t) => {
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  let a = await J(`return { yes: ['https://www.youtube.com/', 'https://youtube.com/watch?v=x', 'https://www.youtube.com/results?search_query=a'].map((u) => YTS_HOST.test(u)),
    no: ['https://music.youtube.com/', 'https://studio.youtube.com/', 'https://m.youtube.com/', 'https://www.youtube.com.evil.site/', 'https://notyoutube.com/', 'http://www.youtube.com/'].map((u) => YTS_HOST.test(u)), on: ytsOn() };`);
  t.check('YouTube in Oto’s look applies to youtube.com only (not Music, Studio, the phone site or look-alikes), and is on by default', a.yes.every(Boolean) && !a.no.some(Boolean) && a.on, JSON.stringify(a));
  a = await J(`const c = ytsCss(); return { vars: /--yt-sys-color-baseline--text-primary:#ece8e1/.test(c) && /--yt-spec-text-primary:#ece8e1/.test(c), stars: (c.match(/radial-gradient\\(/g) || []).length >= 10,
    serif: /Oto Instrument Serif/.test(c), mono: /Oto JetBrains Mono/.test(c), guide: /ytd-guide-entry-renderer\\[active\\]/.test(c), both: /ytLockupMetadataViewModelTitle/.test(c) && /yt-lockup-metadata-view-model__title/.test(c),
    noWeb: !/url\\(["']?(https?:|\\/\\/)/i.test(c), white: /ytp-play-progress[^{]*\\{background:linear-gradient\\(90deg,#e7dfd1,#fff\\)/.test(c) };`);
  t.check('…the sidebar’s colours, a field of stars drawn in CSS, serif titles and mono labels, a white played bar, nothing loaded from the web', Object.values(a).every(Boolean), JSON.stringify(a));
  const fonts = await t.js('ytsFonts()');
  t.check('…with Instrument Serif and JetBrains Mono (4 faces) handed to the page inline', (fonts.match(/@font-face/g) || []).length === 4 && (fonts.match(/data:font\/woff2;base64,/g) || []).length === 4, String(fonts).slice(0, 80));
  await t.js("(openSettings('appearance'), 1)"); await t.sleep(300);
  a = await J("const r = [...document.querySelectorAll('#settings .set-row')].find((x) => /YouTube in Oto/.test(x.textContent)); return { row: !!r, on: !!(r && r.querySelector('.switch.on')) };");
  t.check('Settings › Appearance › Websites has a switch for it (on)', a.row && a.on, JSON.stringify(a));
  await t.js("([...document.querySelectorAll('#settings .set-row')].find((x) => /YouTube in Oto/.test(x.textContent)).querySelector('.switch').click(), 1)"); await t.sleep(200);
  t.check('…and it turns the look off', (await t.js('ytsOn()')) === false);
  await t.js("(S.settings.ytSpace = true, closeSettings(), 1)");
};
