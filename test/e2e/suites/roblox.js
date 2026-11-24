'use strict';
// Classic Roblox (1.9.0): roblox.com gets Oto's style sheet for a year from 2010 to 2017 (and only roblox.com), with Source Sans handed
// over inline; Settings › Appearance › Classic Roblox turns it off.
module.exports = async (t) => {
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  let a = await J(`return { yes: ['https://www.roblox.com/', 'https://roblox.com/games/1', 'https://create.roblox.com/x'].map((u) => RBX_HOST.test(u)),
    no: ['https://roblox.com.evil.site/', 'https://notroblox.com/', 'https://example.com/?roblox.com'].map((u) => RBX_HOST.test(u)), on: rbxOn(),
    css: /#00a2ff/i.test(RBX_CSS) && /#02b757/i.test(RBX_CSS) && /Oto Source Sans/.test(RBX_CSS) };`);
  t.check('Classic Roblox applies to roblox.com and its subdomains only, and is on by default', a.yes.every(Boolean) && !a.no.some(Boolean) && a.on && a.css, JSON.stringify(a));
  a = await J(`const css = RBX_YEAR_LIST.map((y) => rbxCss(y)); return { list: RBX_YEAR_LIST, def: rbxYear(), distinct: new Set(css).size,
    y10: /#6e99c9/.test(css[0]) && /Verdana/.test(css[0]) && /--rbx-w:900px/.test(css[0]), y11: /#000444/.test(css[1]), y13: /#114081/.test(css[3]), y14: /#2d528f/.test(css[4]),
    y16: rbxCss(2016) === RBX_CSS && rbxCss(2017).replace(/--oto-rbx:\\d+/, '') === RBX_CSS.replace(/--oto-rbx:\\d+/, ''), bad: rbxCss(1999) === RBX_CSS };`);
  t.check('a look for every year from 2010 to 2017 (2016 by default; 2017 looked like 2016)', JSON.stringify(a.list) === '[2010,2011,2012,2013,2014,2015,2016,2017]' && a.def === 2016 && a.distinct >= 7
    && a.y10 && a.y11 && a.y13 && a.y14 && a.y16 && a.bad, JSON.stringify(a));
  a = await J(`const bar = rbxCss(2011), col = rbxCss(2016);
    return { bar: /--left-nav-reserved-width:0px/.test(bar) && /flex-direction:row/.test(bar) && /top:40px/.test(bar) && !/175px/.test(bar),
      col: /--left-nav-reserved-width:175px/.test(col) && /width:175px/.test(col) && !/flex-direction:row/.test(col),
      allBar: [2010, 2012, 2013, 2014].every((y) => /flex-direction:row/.test(rbxCss(y))), light: /left-nav\{[^}]*background:#fff/.test(col) };`);
  t.check('the signed-in menu: a bar under the top bar up to 2014, a narrow white column from 2015, never on the page colour', a.bar && a.col && a.allBar && a.light, JSON.stringify(a));
  const fonts = await t.js('rbxFonts()');
  t.check('…with Source Sans (3 weights) handed to the page inline', (fonts.match(/@font-face/g) || []).length === 3 && /data:font\/woff2;base64,/.test(fonts), String(fonts).slice(0, 80));
  a = await J(`const off = RBX_ADS_CSS({}), png = 'data:image/png;base64,iVBORw0KGgo=', on = RBX_ADS_CSS({ sky1: png, sky2: png, board: png, rect: png });
    return { places: (on.match(/pointer-events:none/g) || []).length, noLinks: !/url\\(["']?https?:/i.test(off + on), drawn: /data:image\\/svg\\+xml/.test(off), pics: (on.match(/data:image\\/png/g) || []).length,
      fixed: /var\\(--rbx-w,970px\\)/.test(on), bad: [rbxPic('javascript:alert(1)'), rbxPic('https://x.example/a.png'), rbxPic('data:text/html;base64,PHNjcmlwdD4=')].every((x) => x === null), ok: rbxPic(png) === png, adsOn: rbxAdsOn() };`);
  t.check('the old ads: four places (two tall, a banner, a box), only pictures that go nowhere, gallery pictures or Oto’s own drawings, nothing loaded from the web by the page',
    a.places >= 3 && a.noLinks && a.drawn && a.pics === 4 && a.fixed && a.bad && a.ok && a.adsOn, JSON.stringify(a));
  // (1.9.1) the look goes on by itself the moment a page is ready, even when the ad pictures never come
  await t.js("(window.__rbxHost = RBX_HOST.test, RBX_HOST.test = (u) => /^http:\\/\\/roblox\\.site\\//.test(u), window.__rbxPics = rbxAdPics, rbxAdPics = () => new Promise(() => {}), S.settings.rbxYear = 2011, 1)");
  await t.open('http://roblox.site/', 400);
  for (let i = 0; i < 28 && !(await t.js(`(async () => { const v = V.get(activeTab().id); try { return /^http:\\/\\/roblox\\.site/.test(v.wv.getURL()) && await v.wv.executeJavaScript("getComputedStyle(document.documentElement).backgroundColor !== 'rgba(0, 0, 0, 0)' || getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'"); } catch { return false; } })()`)); i++) await t.sleep(200); // up to ~6 s: a slow machine is still loading the page
  a = await t.js(`(async () => { const v = V.get(activeTab().id); return await v.wv.executeJavaScript("JSON.stringify({ bg: getComputedStyle(document.body).backgroundColor, w: getComputedStyle(document.getElementById('content')).maxWidth, ad: getComputedStyle(document.getElementById('content'), '::before').backgroundImage.slice(0, 30) })"); })()`);
  a = JSON.parse(a);
  a.why = await t.js(`(() => { const t2 = activeTab(); const v = t2 && V.get(t2.id); let u = ''; try { u = v.wv.getURL(); } catch (e) { u = 'err'; } return JSON.stringify({ tab: t2 && t2.url, u, key: !!(v && v.rbxKey), err: v && v.rbxErr, stage: v && v.rbxStage, queued: !!(v && v.rbxQ), ready: !!(v && v.ready), on: rbxOn(), tabs: S.tabs.length }); })()`);
  t.check('Classic Roblox goes on by itself when roblox.com opens, in the year picked, even when the Wiki’s ad pictures never come (Oto’s drawn ads stand in)', a.bg === 'rgb(0, 4, 68)' && a.w === '900px' && /^url\("data:image\/svg/.test(a.ad), JSON.stringify(a));
  // (1.9.1) the safety net: if the look goes missing from a page (as on real roblox.com going from Home to Profile), it comes back by itself
  await t.js(`(async () => { const v = V.get(activeTab().id); if (v.rbxKey) await v.wv.removeInsertedCSS(v.rbxKey); await v.wv.executeJavaScript("history.pushState({}, '', '/users/1/profile')"); return 1; })()`);
  const gone = await t.js(`V.get(activeTab().id).wv.executeJavaScript("getComputedStyle(document.body).backgroundColor")`);
  await t.sleep(2600);
  const back = await t.js(`V.get(activeTab().id).wv.executeJavaScript("getComputedStyle(document.body).backgroundColor")`);
  t.check('…and if it goes missing from a page, it puts itself back within a second or two', gone !== 'rgb(0, 4, 68)' && back === 'rgb(0, 4, 68)', JSON.stringify({ gone, back }));
  await t.js("(RBX_HOST.test = window.__rbxHost, rbxAdPics = window.__rbxPics, S.settings.rbxYear = 2016, 1)");
  await t.js("(openSettings('appearance'), 1)"); await t.sleep(300);
  a = await J("const r = [...document.querySelectorAll('#settings .set-row')].find((x) => /Classic Roblox/.test(x.textContent)); return { row: !!r, on: !!(r && r.querySelector('.switch.on')) };");
  t.check('Settings › Appearance has a Classic Roblox switch (on)', a.row && a.on, JSON.stringify(a));
  a = await J("const b = [...document.querySelectorAll('#settings .rbx-years button')]; return { years: b.map((x) => x.textContent), on: (b.find((x) => x.classList.contains('on')) || {}).textContent };");
  t.check('…with a year picker, 2010 to 2017', a.years.join() === '2010,2011,2012,2013,2014,2015,2016,2017' && a.on === '2016', JSON.stringify(a));
  await t.js("([...document.querySelectorAll('#settings .rbx-years button')].find((x) => x.textContent === '2012').click(), 1)"); await t.sleep(200);
  t.check('…that picks the year', (await t.js('rbxYear()')) === 2012 && (await t.js("document.querySelector('#settings .rbx-years button.on').textContent")) === '2012');
  await t.js("(setPref('rbxYear', 2016), renderSettings(), 1)"); await t.sleep(150);
  t.check('…and one for the old ads', await t.js("[...document.querySelectorAll('#settings .set-row')].some((x) => /Old ads in Classic Roblox/.test(x.textContent))"));
  await t.js("([...document.querySelectorAll('#settings .set-row')].find((x) => /Classic Roblox/.test(x.textContent)).querySelector('.switch').click(), 1)"); await t.sleep(200);
  t.check('…and it turns the look off', (await t.js('rbxOn()')) === false);
  await t.js("(S.settings.rbxClassic = true, closeSettings(), 1)");
};
