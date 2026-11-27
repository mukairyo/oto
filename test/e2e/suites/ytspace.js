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
  a = await J(`const c = ytsCss(); return { logo: /a#logo::before\\{content:"音"/.test(c) && /OTO \\/\\/ YOUTUBE/.test(c), star: /InputBox[^{]*::before\\{content:"✦"/.test(c),
    noYtGlass: /ytSearchboxComponentInnerSearchIcon[^{]*\\{display:none/.test(c), chips: /span\\[style\\*="border-radius"\\] a\\{text-decoration:none/.test(c), cards: /ytd-search ytd-video-renderer #dismissible\\{[^}]*border-radius:10px/.test(c), numbered: /counter\\(yts-r,decimal-leading-zero\\)/.test(c), onAir: /ON AIR/.test(c), noBanner: /ytCinematicContainerViewModelFadeToThemeContainer[^{]*\\{display:none/.test(c) };`);
  t.check('…laid out like Oto: its space badge for the logo, the start page’s search box, numbered hairline cards for results, the channel card without YouTube’s banner glow', Object.values(a).every(Boolean), JSON.stringify(a));
  const fonts = await t.js('ytsFonts()');
  t.check('…with Instrument Serif and JetBrains Mono (4 faces) handed to the page inline', (fonts.match(/@font-face/g) || []).length === 4 && (fonts.match(/data:font\/woff2;base64,/g) || []).length === 4, String(fonts).slice(0, 80));
  // (1.9.1) on by itself the moment a YouTube page is ready
  await t.js("(window.__ytsHost = YTS_HOST.test, YTS_HOST.test = (u) => /^http:\\/\\/tube\\.site\\//.test(u), 1)");
  await t.open('http://tube.site/', 400);
  for (let i = 0; i < 28 && !(await t.js(`(async () => { const v = V.get(activeTab().id); try { return /^http:\\/\\/tube\\.site/.test(v.wv.getURL()) && await v.wv.executeJavaScript("getComputedStyle(document.documentElement).backgroundColor !== 'rgba(0, 0, 0, 0)' || getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'"); } catch { return false; } })()`)); i++) await t.sleep(200); // up to ~6 s: a slow machine is still loading the page
  a = JSON.parse(await t.js(`(async () => { const v = V.get(activeTab().id); return await v.wv.executeJavaScript("JSON.stringify({ bg: getComputedStyle(document.documentElement).backgroundColor, stars: /radial-gradient/.test(getComputedStyle(document.documentElement).backgroundImage) })"); })()`));
  a.why = await t.js(`(() => { const t2 = activeTab(); const v = t2 && V.get(t2.id); let u = ''; try { u = v.wv.getURL(); } catch (e) { u = 'err'; } return JSON.stringify({ tab: t2 && t2.url, u, key: !!(v && v.ytsKey), err: v && v.ytsErr, stage: v && v.ytsStage, queued: !!(v && v.ytsQ), ready: !!(v && v.ready), on: ytsOn(), tabs: S.tabs.length }); })()`);
  t.check('…and goes on by itself when YouTube opens', a.bg === 'rgb(11, 11, 12)' && a.stars, JSON.stringify(a));
  // (1.9.1) the safety net: if the look goes missing from a page (as on real roblox.com going from Home to Profile), it comes back by itself
  await t.js(`(async () => { const v = V.get(activeTab().id); if (v.ytsKey) await v.wv.removeInsertedCSS(v.ytsKey); await v.wv.executeJavaScript("history.pushState({}, '', '/users/1/profile')"); return 1; })()`);
  const gone = await t.js(`V.get(activeTab().id).wv.executeJavaScript("getComputedStyle(document.documentElement).backgroundColor")`);
  await t.sleep(2600);
  const back = await t.js(`V.get(activeTab().id).wv.executeJavaScript("getComputedStyle(document.documentElement).backgroundColor")`);
  t.check('…and if it goes missing from a page, it puts itself back within a second or two', gone !== 'rgb(11, 11, 12)' && back === 'rgb(11, 11, 12)', JSON.stringify({ gone, back }));
  // (1.9.5) YouTube's light theme (Linux): the frosted top layer and text that set their own light colours come out dark;
  // the lists are System24 boxes (border, label in the top border); ambient light shows on the light theme too
  await t.js("(YTS_HOST.test = (u) => /^http:\\/\\/(tube|tubelight)\\.site\\//.test(u), 1)");
  await t.open('http://tubelight.site/', 400);
  for (let i = 0; i < 28 && !(await t.js(`(async () => { const v = V.get(activeTab().id); try { return /tubelight/.test(v.wv.getURL()) && await v.wv.executeJavaScript("getComputedStyle(document.documentElement).backgroundColor === 'rgb(11, 11, 12)'"); } catch { return false; } })()`)); i++) await t.sleep(200);
  a = JSON.parse(await t.js(`(async () => { const v = V.get(activeTab().id); return await v.wv.executeJavaScript("JSON.stringify({ glass: getComputedStyle(document.getElementById('frosted-glass')).backgroundColor, text: getComputedStyle(document.querySelector('.title')).color, box: getComputedStyle(document.querySelector('ytd-guide-section-renderer')).borderTopStyle, label: getComputedStyle(document.getElementById('guide-section-title')).position })"); })()`));
  t.check('…on YouTube’s light theme too (Linux): the top bar’s frosted layer and the text are dark/light as in the look; the sidebar is a System24 box with its label in the border', a.glass === 'rgba(11, 11, 12, 0.86)' && a.text === 'rgb(236, 232, 225)' && a.box === 'solid' && a.label === 'absolute', JSON.stringify(a));
  // (1.9.6) the page is switched to YouTube's own dark theme (text it colours by theme comes out light), and stays so when
  // YouTube takes the attribute off (the stand-in does after 1.5 s); no empty playlist box; the chips' header has no blur
  await t.sleep(2200);
  a = JSON.parse(await t.js(`V.get(activeTab().id).wv.executeJavaScript("JSON.stringify({ dark: document.documentElement.hasAttribute('dark'), text: getComputedStyle(document.getElementById('lt')).color, playlist: getComputedStyle(document.getElementById('playlist')).display, blur: getComputedStyle(document.getElementById('header')).backdropFilter })")`));
  t.check('…YouTube draws its own dark theme under the look (and keeps it when YouTube takes it away); an empty playlist panel stays hidden; the chip row isn’t under a blurred header', a.dark === true && a.text === 'rgb(241, 241, 241)' && a.playlist === 'none' && a.blur === 'none', JSON.stringify(a));
  // (1.9.7) the boxes under the video let the ambient light through (a light tint, the top border drawn around the
  // label); shooting stars pass by between the stars and the page
  a = JSON.parse(await t.js(`V.get(activeTab().id).wv.executeJavaScript("JSON.stringify((() => { const c = getComputedStyle(document.getElementById('comments')), b = getComputedStyle(document.documentElement, '::before'), f = getComputedStyle(document.documentElement, '::after'); return { bg: c.backgroundColor, top: c.borderTopColor, label: getComputedStyle(document.getElementById('comments'), '::before').backgroundColor, meteors: [b.animationName, f.animationName, b.position, b.zIndex], page: getComputedStyle(document.body).backgroundColor }; })())")`));
  t.check('…the comments box is see-through (the ambient light shows through it), its label leaves a gap in the top line; shooting stars pass behind the page', a.bg === 'rgba(11, 11, 12, 0.3)' && a.top === 'rgba(0, 0, 0, 0)' && a.label === 'rgba(0, 0, 0, 0)' && a.meteors.join() === 'yts-meteor-a,yts-meteor-b,fixed,-1' && a.page === 'rgba(0, 0, 0, 0)', JSON.stringify(a));
  await t.js("(S.settings.ytSpace = false, ytsRefresh(), 1)"); await t.sleep(900);
  a = await t.js(`V.get(activeTab().id).wv.executeJavaScript("document.documentElement.hasAttribute('dark')")`);
  t.check('…and with the look off, the page goes back to the theme YouTube picked', a === false, String(a));
  await t.js("(S.settings.ytSpace = true, 1)");
  await t.js("(YTS_HOST.test = window.__ytsHost, 1)");
  a = await t.js(`(async () => { const calls = []; await ytAmbApply({ wv: { executeJavaScript: async (c) => { calls.push(c); } } }, 'https://www.youtube.com/watch?v=x'); return calls.length ? /"light":true/.test(calls[0]) : 'not run'; })()`);
  t.check('…and ambient light shows on YouTube’s light theme while the look is on', a === true, String(a));
  await t.js("(openSettings('appearance'), 1)"); await t.sleep(300);
  a = await J("const r = [...document.querySelectorAll('#settings .set-row')].find((x) => /YouTube in Oto/.test(x.textContent)); return { row: !!r, on: !!(r && r.querySelector('.switch.on')) };");
  t.check('Settings › Appearance › Websites has a switch for it (on)', a.row && a.on, JSON.stringify(a));
  await t.js("([...document.querySelectorAll('#settings .set-row')].find((x) => /YouTube in Oto/.test(x.textContent)).querySelector('.switch').click(), 1)"); await t.sleep(200);
  t.check('…and it turns the look off', (await t.js('ytsOn()')) === false);
  await t.js("(S.settings.ytSpace = true, closeSettings(), 1)");
};
