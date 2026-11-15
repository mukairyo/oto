'use strict';
// The Galaxy view (src/sky.js, the GALAXY side of the space overview): each Space is a spiral arm, the middle is now
// and tabs used longer ago sit further out; hover shows the preview, a star dragged onto another arm moves the tab to
// that Space, and a click opens the tab.
const fs = require('fs');
const path = require('path');

module.exports = async (t) => {
  const shots = process.env.OTO_SKY_SHOTS;
  const shot = async (name) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); const im = await t.ui.capturePage(); fs.writeFileSync(path.join(shots, `${name}.png`), im.toPNG()); };
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  const mouse = async (type, x, y) => t.ui.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
  const starXY = (id) => J(`const s = SKY.starById.get(${JSON.stringify(id)}); if (!s) return null; const [x, y] = skyToScreen(s.x, s.y); const r = SKY.canvas.getBoundingClientRect(); return [x + r.left, y + r.top];`);

  await t.open('http://news.site/', 1200); await t.open('http://fine.site/', 1200); await t.open('http://nav.site/', 1200);
  await t.js("v1NewSpaceFrom({ name: 'Videos', emoji: '', colors: ['#D6A276', '#8b5cf6'] }), 1"); await t.sleep(500);
  await t.open('http://open.site/', 1200); await t.open('http://quiet.site/', 1200);
  // pretend some tabs were last used a while ago
  await t.js("(() => { const h = (x) => S.tabs.find((t) => hostOf(t.url) === x); h('news.site').lastActive = Date.now() - 3 * 864e5; h('fine.site').lastActive = Date.now() - 2 * 36e5; h('nav.site').lastActive = Date.now() - 5 * 6e4; })(), 1");
  const ids = await J("return S.tabs.filter((x) => !x.essential).map((x) => ({ id: x.id, host: hostOf(x.url), ws: x.ws }));");
  const wsIds = await J('return S.workspaces.map((w) => w.id);');
  const id = (host) => ids.find((x) => x.host === host).id;

  await t.js("S.settings.overviewView = 'galaxy', v1Overview(), 1"); await t.sleep(900);
  let a = await J("return { mode: SKY.mode, stars: SKY.starById.size, tabs: S.tabs.length, arms: SKY.gal.arms.length, on: !!document.querySelector('.v1-ovsw .b.on') && document.querySelector('.v1-ovsw .b.on').textContent };");
  t.check('the Galaxy switch shows the Galaxy view', a.mode === 'galaxy' && /galaxy/i.test(a.on), JSON.stringify(a));
  t.check('every tab is a star, every Space an arm', a.stars === a.tabs && a.arms === 2, JSON.stringify(a));
  a = await J(`const r = (i) => Math.round(SKY.starById.get(i).r); return { nav: r(${JSON.stringify(id('nav.site'))}), fine: r(${JSON.stringify(id('fine.site'))}), news: r(${JSON.stringify(id('news.site'))}) };`);
  t.check('tabs used longer ago sit further out', a.nav < a.fine && a.fine < a.news, JSON.stringify(a));
  await shot('g1-galaxy');

  // hover: the preview window
  const fine = id('fine.site');
  await t.js(`SKY.cam.z = 1, skyFocusStar(${JSON.stringify(fine)}, 1), 1`); await t.sleep(500);
  let p = await starXY(fine);
  await mouse('mouseMove', p[0] - 30, p[1] - 30); await t.sleep(60); await mouse('mouseMove', p[0], p[1]); await t.sleep(700);
  a = await J("const c = document.querySelector('.sky-card'); return { id: c && c.dataset.id };");
  t.check('hovering a star shows its preview window', a.id === fine, JSON.stringify(a));
  await shot('g2-preview');

  // drag a star onto the other arm: the tab moves to that Space
  await t.js('skyHideCard(), SKY.hover = null, Object.assign(SKY.cam, skyFitAll()), skyDraw(), 1'); await t.sleep(200);
  const news = id('news.site');
  p = await starXY(news);
  const target = await J(`const arm = SKY.gal.arms.find((x) => x.ws === ${JSON.stringify(wsIds[1])}); const r = 330, th = arm.off + Math.log(r / GAL.R0) / GAL.B + SKY.turn; const [x, y] = skyToScreen(Math.cos(th) * r, Math.sin(th) * r * GAL.TILT); const b = SKY.canvas.getBoundingClientRect(); return [x + b.left, y + b.top];`);
  await mouse('mouseDown', p[0], p[1]);
  for (let k = 1; k <= 8; k++) { await mouse('mouseMove', p[0] + (target[0] - p[0]) * k / 8, p[1] + (target[1] - p[1]) * k / 8); await t.sleep(30); }
  await shot('g3-drag');
  await mouse('mouseUp', target[0], target[1]); await t.sleep(500);
  a = await J(`return { ws: tabById(${JSON.stringify(news)}).ws };`);
  t.check('dragging a star onto another arm moves the tab to that Space', a.ws === wsIds[1], JSON.stringify(a));

  // click a star: the tab opens
  const quiet = id('quiet.site');
  await t.js(`skyFocusStar(${JSON.stringify(quiet)}, 1), 1`); await t.sleep(500);
  p = await starXY(quiet);
  await mouse('mouseDown', p[0], p[1]); await mouse('mouseUp', p[0], p[1]); await t.sleep(1400);
  a = await J("return { active: (activeTab() || {}).id, open: !!document.querySelector('#v1Ov') };");
  t.check('clicking a star opens its tab', a.active === quiet && !a.open, JSON.stringify(a));

  // the choice is remembered, and Grid / Sky are one click away
  await t.js('v1Overview(), 1'); await t.sleep(600);
  a = await J('return { mode: SKY.mode, view: S.settings.overviewView };');
  t.check('the overview reopens in Galaxy', a.mode === 'galaxy' && a.view === 'galaxy', JSON.stringify(a));
  await t.js("[...document.querySelectorAll('.v1-ovsw .b')].find((b) => /^sky$/i.test(b.textContent.trim())).click(), 1"); await t.sleep(600);
  a = await J('return { mode: SKY.mode, on: SKY.on };');
  t.check('Sky is one click away', a.on && a.mode === 'sky', JSON.stringify(a));

  // zooming moves between the views: out of Sky into the Galaxy, into a star in the Galaxy down into Sky on that tab
  const wheel = (x, y, dy) => t.js(`(() => { const r = SKY.canvas.getBoundingClientRect(); SKY.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: ${dy}, clientX: ${x} || r.left + r.width / 2, clientY: ${y} || r.top + r.height / 2, bubbles: true, cancelable: true })); })(), 1`);
  await t.js('Object.assign(SKY.cam, skyFitAll()), SKY.cam.z = 0.25, skyDraw(), 1'); await t.sleep(200);
  await wheel(0, 0, 120); await t.sleep(80); await wheel(0, 0, 120); await t.sleep(250);
  await shot('g4-rising');
  await t.sleep(700);
  a = await J("return { mode: SKY.mode, view: S.settings.overviewView, on: document.querySelector('.v1-ovsw .b.on').textContent, deep: SKY_DEEP.list && SKY_DEEP.list.length };");
  t.check('zooming out of Sky rises into the Galaxy (and the switch follows)', a.mode === 'galaxy' && a.view === 'galaxy' && /galaxy/i.test(a.on), JSON.stringify(a));
  t.check('far-off galaxies sit behind the view', a.deep >= 8, JSON.stringify(a));
  await shot('g5-galaxy-deep');
  const nav = id('nav.site');
  await t.js(`skyFocusStar(${JSON.stringify(nav)}, 1.8), 1`); await t.sleep(600);
  p = await starXY(nav);
  await wheel(p[0], p[1], -120); await t.sleep(80); await wheel(p[0], p[1], -120); await t.sleep(250);
  await shot('g6-diving');
  await t.sleep(700);
  a = await J(`const s = SKY.starById.get(${JSON.stringify(nav)}); return { mode: SKY.mode, view: S.settings.overviewView, on: document.querySelector('.v1-ovsw .b.on').textContent, dx: s && Math.round(SKY.cam.x - s.x), dy: s && Math.round(SKY.cam.y - s.y) };`);
  t.check('zooming into a star in the Galaxy comes down into Sky on that tab', a.mode === 'sky' && a.view === 'sky' && /sky/i.test(a.on) && Math.abs(a.dx) < 8 && Math.abs(a.dy) < 8, JSON.stringify(a));
  await shot('g7-sky-landed');
  await t.js('v1CloseOverview(), 1');
};
