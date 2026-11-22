'use strict';
// New Tab (1.8.3) shows the start page — greeting, search, Oto card, shortcuts — the same page Oto shows when it starts
// with nothing open. Typing there searches; Esc goes back; opening something from it makes a real tab.
module.exports = async (t) => {
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  const state = "return { start: !document.getElementById('empty').classList.contains('gone') && !activeTab(), cmd: !document.getElementById('cmdk').hidden, active: (activeTab() || {}).url || null, tabs: S.tabs.length, lit: !!document.querySelector('.tab.active, .tab.on, .tab[aria-selected=true]') }";
  await t.open('http://news.site/');
  const before = await J(state);
  await t.js("document.getElementById('btnNewTab').click(), 1"); await t.sleep(300);
  let a = await J(state);
  t.check('New Tab shows the start page (not just the search bar)', a.start && !a.cmd, JSON.stringify(a));
  t.check('…no tab is selected while it shows, and no empty tab is added', a.tabs === before.tabs && !a.lit, JSON.stringify(a));
  a = await J("return { greet: !!document.getElementById('greet') && getComputedStyle(document.getElementById('greet')).display !== 'none', search: !!document.getElementById('emptySearch') };");
  t.check('…with the greeting and the search box', a.greet && a.search, JSON.stringify(a));
  // the space look (1.8.3, src/oto-space.js)
  a = await J("const sky = document.getElementById('shSky'); return { on: document.body.classList.contains('space-home'), sky: !!sky && getComputedStyle(sky).backgroundImage, crumb: (document.getElementById('shCrumb') || {}).textContent, planet: !!document.querySelector('#v1Widgets .wg.card .sh-pl'), k: (document.querySelector('#v1Widgets .wg.card .k') || {}).textContent, esc: !document.getElementById('shEsc').hidden, star: !!document.querySelector('#emptySearch .ic-slot svg path') };");
  t.check('the start page has the space look: starfield, "OTO // HOME · ORBIT 01", the card\'s planet', a.on && /space\.webp/.test(a.sky || '') && /OTO \/\/ HOME/.test(a.crumb || '') && /ORBIT 01/.test(a.crumb || '') && a.planet && /LEVEL 1/.test(a.k || '') && a.star, JSON.stringify(a));
  t.check('…and says Esc goes back to your tab', a.esc === true, JSON.stringify(a));

  t.ui.sendInputEvent({ type: 'keyDown', keyCode: 'f' }); t.ui.sendInputEvent({ type: 'char', keyCode: 'f' }); t.ui.sendInputEvent({ type: 'keyUp', keyCode: 'f' });
  await t.sleep(300);
  a = await J("return { cmd: !document.getElementById('cmdk').hidden, q: document.getElementById('cmdInput').value };");
  t.check('typing on the start page opens the search with what you typed', a.cmd && a.q === 'f', JSON.stringify(a));
  await t.js("(document.getElementById('cmdInput').value = 'http://fine.site/', computeItems(), 1)");
  await t.js("document.getElementById('cmdInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })), 1"); await t.sleep(800);
  a = await J(state);
  t.check('…and Enter opens it as a new tab', !a.start && /fine\.site/.test(a.active || '') && a.tabs === before.tabs + 1, JSON.stringify(a));

  await t.js("document.getElementById('btnNewTab').click(), 1"); await t.sleep(300);
  t.ui.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); t.ui.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' }); await t.sleep(300);
  a = await J(state);
  t.check('Esc on the start page goes back to the tab you were on', !a.start && /fine\.site/.test(a.active || ''), JSON.stringify(a));

  await t.js("CMDS.newTab(), 1"); await t.sleep(300);
  a = await J(state);
  t.check('Ctrl+T does the same', a.start && !a.cmd, JSON.stringify(a));
  await t.js("document.getElementById('emptySearch').click(), 1"); await t.sleep(200);
  a = await J(state);
  t.check("clicking the start page's search box opens the search", a.cmd, JSON.stringify(a));
  await t.js('(closeCmd(false), 1)');
  await t.js("(activate(S.tabs.find((x) => /news\\.site/.test(x.url)).id), 1)"); await t.sleep(300);
  a = await J(state);
  t.check('picking a tab in the sidebar leaves the start page', !a.start && /news\.site/.test(a.active || ''), JSON.stringify(a));

  // the Space card: the default design, the level's planet on the front, badges as a star chart on the back
  a = await J("const m = cardModel(); const f = cardSvg(m); V1D.back = true; const b = cardSvg(m); V1D.back = false; return { design: m.design, first: Object.keys(CARD_DESIGNS)[0], front: /OTO \\/\\/ CARD/.test(f) && /LEVEL 1 · MOON/.test(f) && /Rookie/.test(f), back: /STAR CHART/.test(b) && /FOUND/.test(b) };");
  t.check('the Oto Card\'s default design is Space: the level as a planet on the front, a star chart of badges on the back', a.design === 'space' && a.first === 'space' && a.front && a.back, JSON.stringify(a));
  a = await J("S.card.edition = 'og'; const og = cardSvg(cardModel()); S.card.edition = 'standard'; return { og: /ORIGINAL USER/.test(og) };");
  t.check('…the OG edition keeps its own art', a.og === true, JSON.stringify(a));
  a = await J("const f = spaceFounderSvg(cardModel()), b = spaceFounderBack(cardModel()); return { wide: f.includes('viewBox=' + String.fromCharCode(34) + '0 0 580 362'), text: /FOUNDER/.test(f) && /ULTRAMASSIVE/.test(f) && /OWNER · Nº 0000/.test(f), back: /STAR CHART · FOUNDER/.test(b), swapped: v1CardFounder(cardModel()).includes('ULTRAMASSIVE') };");
  t.check('the Founder card is the wide black hole (front and back)', a.wide && a.text && a.back && a.swapped, JSON.stringify(a));
  a = JSON.parse(await t.js("(async () => { const u = await cardPng(1); const im = new Image(); im.src = u; await im.decode(); return JSON.stringify({ w: im.width, h: im.height }); })()"));
  t.check('a saved card image has the card\'s real size (not 300×150)', a.w === 320 && a.h === 504, JSON.stringify(a));
  a = await J("const before = document.querySelectorAll('.sh-shoot').length; dlFly({ x: 600, y: 300 }, 'x.zip'); return { def: S.settings.dlAnim, star: document.querySelectorAll('.sh-shoot').length > before, choice: !!document.querySelector('body') };");
  t.check('downloads start with a shooting star by default', a.def === 'star' && a.star, JSON.stringify(a));
  await t.js("(openLibrary('history'), 1)"); await t.sleep(300);
  a = await J("const l = document.getElementById('library'); return { bg: getComputedStyle(l).backgroundImage, accent: getComputedStyle(l).getPropertyValue('--accent').trim() };");
  t.check('the Library pages have the space look (starfield, cyan)', /space\.webp/.test(a.bg) && /7FE3FF/i.test(a.accent), JSON.stringify(a));
  await t.js('(closeLibrary(), 1)');
  a = await J("return V1_LEVELS.map((l) => { const s = spacePlanet(l.id, 40); return /<svg/.test(s) && s.length > 200; });");
  t.check('every level has its own planet (moon to galaxy)', Array.isArray(a) && a.length === 6 && a.every(Boolean), JSON.stringify(a));
};
