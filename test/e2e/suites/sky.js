'use strict';
// Sky View (src/sky.js): the SKY side of the space overview. Real tabs show as stars, a click opens the tab, a star
// dragged into another Space moves the tab there, search and the arrow keys find tabs, a hover shows the preview window,
// and the layout stays put: reopening the overview or closing a tab doesn't move the other stars.
const fs = require('fs');
const path = require('path');

module.exports = async (t) => {
  const shots = process.env.OTO_SKY_SHOTS; // folder for screenshots (optional, for looking at it by eye)
  const shot = async (name) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); const im = await t.ui.capturePage(); fs.writeFileSync(path.join(shots, `${name}.png`), im.toPNG()); };
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  const mouse = async (type, x, y, extra = {}) => t.ui.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, ...extra });
  const starXY = (id) => J(`const s = SKY.starById.get(${JSON.stringify(id)}); if (!s) return null; const [x, y] = skyToScreen(s.x, s.y); const r = SKY.canvas.getBoundingClientRect(); return [x + r.left, y + r.top];`);

  // tabs in two Spaces
  await t.open('http://news.site/', 1500); await t.open('http://fine.site/', 1500); await t.open('http://nav.site/', 1500);
  await t.js("v1NewSpaceFrom({ name: 'Videos', emoji: '', colors: ['#D6A276', '#8b5cf6'] }), 1"); await t.sleep(600);
  await t.open('http://open.site/', 1500); await t.open('http://quiet.site/', 1500);
  const ids = await J("return S.tabs.filter((x) => !x.essential).map((x) => ({ id: x.id, host: hostOf(x.url), ws: x.ws }));");
  const wsIds = await J('return S.workspaces.map((w) => w.id);');

  // 1 · real tabs as stars
  await t.js('v1Overview(), 1'); await t.sleep(900);
  let a = await J("return { sky: !!document.querySelector('#v1Ov.sky .sky-canvas'), stars: SKY.starById.size, tabs: S.tabs.length, spaces: SKY.lay.spaces.length, view: S.settings.overviewView || 'sky' };");
  t.check('the space overview opens in Sky View', a.sky, JSON.stringify(a));
  t.check('every tab is a star', a.stars === a.tabs && a.tabs >= 5, JSON.stringify(a));
  t.check('every Space is a region of the sky', a.spaces >= 2, JSON.stringify(a));
  await shot('1-sky');

  // 3 · search flies to the match; arrows move between tabs
  const nav = ids.find((x) => x.host === 'nav.site');
  await t.js("(() => { const i = document.querySelector('#v1Ov input'); i.value = 'nav'; i.dispatchEvent(new Event('input')); })(), 1"); await t.sleep(500);
  a = await J('return { sel: SKY.sel };');
  t.check('search selects the matching tab', a.sel === nav.id, JSON.stringify(a));
  await t.js("(() => { const i = document.querySelector('#v1Ov input'); i.value = ''; i.dispatchEvent(new Event('input')); SKY.sel = null; })(), 1");
  await t.js("SKY.canvas.focus(), SKY.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })), SKY.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })), 1"); await t.sleep(400);
  a = await J('return { sel: SKY.sel };');
  t.check('the arrow keys select a tab', !!a.sel, JSON.stringify(a));

  // 4 · hover a star: the preview window
  const fine = ids.find((x) => x.host === 'fine.site');
  await t.js(`skyHideCard(), SKY.sel = null, skyFocusStar(${JSON.stringify(fine.id)}, 1), 1`); await t.sleep(500);
  let p = await starXY(fine.id);
  await mouse('mouseMove', p[0] - 30, p[1] - 30); await t.sleep(80);
  await mouse('mouseMove', p[0], p[1]); await t.sleep(700);
  a = await J("const c = document.querySelector('.sky-card'); return { card: !!c, id: c && c.dataset.id, title: c && c.querySelector('.tt b').textContent, buttons: c ? [...c.querySelectorAll('.acts .b')].map((b) => b.textContent) : [] };");
  t.check('hovering a star shows its preview window', a.card && a.id === fine.id, JSON.stringify(a));
  t.check('the preview window has Open, Pin and Move to Space', a.buttons.join('|') === 'Open|Pin|Move to Space ▾', JSON.stringify(a));
  await shot('2-preview');

  // 5 · the layout stays put: reopening the overview keeps every star where it was
  const before = await J('return [...SKY.starById.values()].map((s) => [s.id, Math.round(s.x), Math.round(s.y)]);');
  await t.js('v1CloseOverview(), 1'); await t.sleep(300); await t.js('v1Overview(), 1'); await t.sleep(700);
  const after = await J('return [...SKY.starById.values()].map((s) => [s.id, Math.round(s.x), Math.round(s.y)]);');
  t.check('reopening the overview keeps every star in its place', JSON.stringify(before) === JSON.stringify(after), `${JSON.stringify(before).slice(0, 120)} / ${JSON.stringify(after).slice(0, 120)}`);
  a = await J('return { saved: !!(S.sky && S.sky.cells && Object.keys(S.sky.slots).length) };');
  t.check('the layout is saved with the rest of Oto’s state', a.saved, JSON.stringify(a));

  // 2 · drag a star into the other Space: the tab moves there
  const news = ids.find((x) => x.host === 'news.site');
  await t.js('skyHideCard(), Object.assign(SKY.cam, skyFitAll()), skyDraw(), 1'); await t.sleep(200);
  p = await starXY(news.id);
  const target = await J(`const sp = SKY.spaceById.get(${JSON.stringify(wsIds[1])}); const [x, y] = skyToScreen(sp.cx, sp.cy + sp.ry * 0.3); const r = SKY.canvas.getBoundingClientRect(); return [x + r.left, y + r.top];`);
  await mouse('mouseDown', p[0], p[1]);
  for (let k = 1; k <= 8; k++) { await mouse('mouseMove', p[0] + (target[0] - p[0]) * k / 8, p[1] + (target[1] - p[1]) * k / 8); await t.sleep(30); }
  await shot('3-drag');
  await mouse('mouseUp', target[0], target[1]); await t.sleep(500);
  a = await J(`return { ws: tabById(${JSON.stringify(news.id)}).ws };`);
  t.check('dragging a star into another Space moves the tab there', a.ws === wsIds[1], JSON.stringify(a));

  // closing a tab doesn't move the other stars
  const keep = await J(`return [...SKY.starById.values()].filter((s) => s.id !== ${JSON.stringify(fine.id)}).map((s) => [s.id, Math.round(s.x), Math.round(s.y)]).sort();`);
  await t.js(`skyClose(${JSON.stringify(fine.id)}), 1`); await t.sleep(900);
  const kept = await J(`return [...SKY.starById.values()].map((s) => [s.id, Math.round(s.x), Math.round(s.y)]).sort();`);
  t.check('closing a tab leaves every other star where it was', JSON.stringify(keep) === JSON.stringify(kept), `${JSON.stringify(keep).slice(0, 140)} / ${JSON.stringify(kept).slice(0, 140)}`);

  // 1 · a click on a star opens its tab and closes the overview
  const quiet = ids.find((x) => x.host === 'quiet.site');
  await t.js(`SKY.cam.z = 1; skyFocusStar(${JSON.stringify(nav.id)}, 1), 1`); await t.sleep(500);
  p = await starXY(nav.id);
  await mouse('mouseDown', p[0], p[1]); await mouse('mouseUp', p[0], p[1]); await t.sleep(700);
  a = await J("return { active: (activeTab() || {}).id, open: !!document.querySelector('#v1Ov') };");
  t.check('clicking a star opens its tab', a.active === nav.id && !a.open, JSON.stringify(a));
  void quiet;

  // GRID | SKY: the familiar grid is one click away, and the choice is remembered
  await t.js('v1Overview(), 1'); await t.sleep(600);
  await t.js("[...document.querySelectorAll('.v1-ovsw .b')].find((b) => /grid/i.test(b.textContent)).click(), 1"); await t.sleep(500);
  a = await J("return { grid: !!document.querySelector('#v1Ov:not(.sky) .grid:not([hidden])'), view: S.settings.overviewView, skyOff: !SKY.on };");
  t.check('the Grid switch shows the grid of Spaces (and remembers it)', a.grid && a.view === 'grid' && a.skyOff, JSON.stringify(a));
  await t.js("[...document.querySelectorAll('.v1-ovsw .b')].find((b) => /sky/i.test(b.textContent)).click(), 1"); await t.sleep(600);
  a = await J("return { sky: SKY.on, view: S.settings.overviewView };");
  t.check('the Sky switch brings Sky View back', a.sky && a.view === 'sky', JSON.stringify(a));
  await shot('4-final');
  await t.js('v1CloseOverview(), 1');
};
