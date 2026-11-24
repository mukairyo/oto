'use strict';
// Classic Roblox (1.9.0): roblox.com gets Oto's 2015–2017 style sheet (and only roblox.com), with Source Sans handed
// over inline; Settings › Appearance › Classic Roblox turns it off.
module.exports = async (t) => {
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  let a = await J(`return { yes: ['https://www.roblox.com/', 'https://roblox.com/games/1', 'https://create.roblox.com/x'].map((u) => RBX_HOST.test(u)),
    no: ['https://roblox.com.evil.site/', 'https://notroblox.com/', 'https://example.com/?roblox.com'].map((u) => RBX_HOST.test(u)), on: rbxOn(),
    css: /#00a2ff/i.test(RBX_CSS) && /#02b757/i.test(RBX_CSS) && /Oto Source Sans/.test(RBX_CSS) };`);
  t.check('Classic Roblox applies to roblox.com and its subdomains only, and is on by default', a.yes.every(Boolean) && !a.no.some(Boolean) && a.on && a.css, JSON.stringify(a));
  const fonts = await t.js('rbxFonts()');
  t.check('…with Source Sans (3 weights) handed to the page inline', (fonts.match(/@font-face/g) || []).length === 3 && /data:font\/woff2;base64,/.test(fonts), String(fonts).slice(0, 80));
  a = await J(`const off = RBX_ADS_CSS({}), png = 'data:image/png;base64,iVBORw0KGgo=', on = RBX_ADS_CSS({ sky1: png, sky2: png, board: png, rect: png });
    return { places: (on.match(/pointer-events:none/g) || []).length, noLinks: !/url\\(["']?https?:/i.test(off + on), drawn: /data:image\\/svg\\+xml/.test(off), pics: (on.match(/data:image\\/png/g) || []).length,
      fixed: /#content\\{max-width:1000px/.test(on), bad: [rbxPic('javascript:alert(1)'), rbxPic('https://x.example/a.png'), rbxPic('data:text/html;base64,PHNjcmlwdD4=')].every((x) => x === null), ok: rbxPic(png) === png, adsOn: rbxAdsOn() };`);
  t.check('the old ads: four places (two tall, a banner, a box), only pictures that go nowhere, gallery pictures or Oto’s own drawings, nothing loaded from the web by the page',
    a.places >= 3 && a.noLinks && a.drawn && a.pics === 4 && a.fixed && a.bad && a.ok && a.adsOn, JSON.stringify(a));
  await t.js("(openSettings('appearance'), 1)"); await t.sleep(300);
  a = await J("const r = [...document.querySelectorAll('#settings .set-row')].find((x) => /Classic Roblox/.test(x.textContent)); return { row: !!r, on: !!(r && r.querySelector('.switch.on')) };");
  t.check('Settings › Appearance has a Classic Roblox switch (on)', a.row && a.on, JSON.stringify(a));
  t.check('…and one for the old ads', await t.js("[...document.querySelectorAll('#settings .set-row')].some((x) => /Old ads in Classic Roblox/.test(x.textContent))"));
  await t.js("([...document.querySelectorAll('#settings .set-row')].find((x) => /Classic Roblox/.test(x.textContent)).querySelector('.switch').click(), 1)"); await t.sleep(200);
  t.check('…and it turns the look off', (await t.js('rbxOn()')) === false);
  await t.js("(S.settings.rbxClassic = true, closeSettings(), 1)");
};
