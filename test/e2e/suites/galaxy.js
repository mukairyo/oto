'use strict';
// The Galaxy view (src/sky.js, the GALAXY side of the space overview), as of 1.7.10: the galaxy and the devices signed
// in to your Oto account circling it, nothing else (your tabs and Spaces live in Sky). A device whose app is open is a
// bright star; one whose app isn't is dark. Clicking this PC flies you to it and down into Sky; clicking a phone that's
// on flies you to it and opens its panel; a dark one just shows when it was last on. Zooming moves between the views.
const fs = require('fs');
const path = require('path');

module.exports = async (t) => {
  const shots = process.env.OTO_SKY_SHOTS;
  const shot = async (name) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); const im = await t.ui.capturePage(); fs.writeFileSync(path.join(shots, `${name}.png`), im.toPNG()); };
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  const mouse = async (type, x, y) => t.ui.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
  const devXY = (id) => J(`const d = (SKY.devs || []).find((x) => x.id === ${JSON.stringify(id)}); if (!d) return null; const r = SKY.canvas.getBoundingClientRect(); return [d.sx + r.left, d.sy + r.top];`);

  await t.open('http://news.site/', 1200); await t.open('http://fine.site/', 1200);
  await t.js("v1NewSpaceFrom({ name: 'Videos', emoji: '', colors: ['#D6A276', '#8b5cf6'] }), 1"); await t.sleep(500);
  await t.open('http://open.site/', 1200);
  // two other devices on the account: a phone with Oto open, and one that hasn't been on for an hour
  await t.js(`(() => {
    PH.me = PH.me || { id: 'pc-here', name: 'AZA', kind: 'pc', os: 'Windows 11' };
    PH.devices = [
      { id: 'ph-on', kind: 'phone', name: 'Nothing (3a) Pro', os: 'Android 15', seen: Date.now(), tabs: [{ u: 'https://example.com/', t: 'Example' }], app: '0.3.1' },
      { id: 'ph-off', kind: 'phone', name: 'Old phone', os: 'Android 13', seen: Date.now() - 36e5, tabs: [] },
    ];
    window.__phoneOpened = 0; const orig = window.v1Phone; window.v1Phone = function () { window.__phoneOpened++; };
    window.__origPhone = orig;
  })(), 1`);

  await t.js("S.settings.overviewView = 'galaxy', v1Overview(), 1"); await t.sleep(1300);
  let a = await J("return { mode: SKY.mode, stars: SKY.starById.size, on: !!document.querySelector('.v1-ovsw .b.on') && document.querySelector('.v1-ovsw .b.on').textContent };");
  t.check('the Galaxy switch shows the Galaxy view', a.mode === 'galaxy' && /galaxy/i.test(a.on), JSON.stringify(a));
  t.check('no tabs and no Spaces in the Galaxy (they live in Sky)', a.stars === 0, JSON.stringify(a));
  a = await J("return (SKY.devs || []).map((d) => ({ id: d.id, me: !!d.me, plat: d.plat, on: !!(d.me || d.online) }));");
  const by = Object.fromEntries(a.map((d) => [d.me ? 'me' : d.id, d]));
  t.check('your devices circle the galaxy, named with what they run', by.me && /WINDOWS|LINUX|MACOS|PC/.test(by.me.plat) && by['ph-on'] && by['ph-on'].plat === 'ANDROID', JSON.stringify(a));
  t.check('a device whose app is open is lit, one whose app isn’t is dark', by['ph-on'].on === true && by['ph-off'].on === false, JSON.stringify(a));
  await shot('g1-galaxy');

  // it keeps turning while you look around
  a = await J('return { t0: SKY.turn, motion: skyMotion() };');
  await t.sleep(1200);
  let b = await J('return { t1: SKY.turn };');
  t.check('the galaxy keeps turning', a.motion ? b.t1 > a.t0 : b.t1 === a.t0, JSON.stringify({ ...a, ...b }));

  // pointer moves don't each draw a frame: they ask for one (the lag fix)
  a = await J(`let n = 0; const orig = galaxyDraw; galaxyDraw = function (...x) { n++; return orig.apply(this, x); };
    const r = SKY.canvas.getBoundingClientRect();
    for (let i = 0; i < 40; i++) dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 200 + i, clientY: r.top + 200, bubbles: true }));
    const drawnNow = n; galaxyDraw = orig; return { drawnNow };`);
  t.check('moving the pointer doesn’t redraw on every mouse event', a.drawnNow === 0, JSON.stringify(a));

  // a dark device: clicking shows its window (last seen), no flight
  await t.js('Object.assign(SKY.cam, skyFitAll()), skyDraw(), 1'); await t.sleep(300);
  let p = await devXY('ph-off');
  await mouse('mouseDown', p[0], p[1]); await mouse('mouseUp', p[0], p[1]); await t.sleep(300);
  a = await J("const c = document.querySelector('.sky-card.dev'); return { fly: !!SKY.fly, card: c && c.dataset.dev, seen: c && c.querySelector('.st').textContent };");
  t.check('clicking a dark device shows when it was last on (no flight)', !a.fly && a.card === 'ph-off' && /SEEN|OFFLINE/.test(a.seen), JSON.stringify(a));
  await t.js('galaxyHideDevice(), 1');

  // a phone that's on: the view jumps to it, then its panel opens
  p = await devXY('ph-on');
  await mouse('mouseDown', p[0], p[1]); await mouse('mouseUp', p[0], p[1]); await t.sleep(380);
  await t.sleep(400);
  a = await J('return { fly: !!SKY.warp, s: SKY.warp && +SKY.warp.s.toFixed(2), z: +SKY.cam.z.toFixed(2) };');
  await shot('g2-flying');
  const motion = await J('return skyMotion();');
  t.check('clicking a phone that’s on makes a quantum jump to it (streaks speeding up)', motion ? a.fly && a.s > 0 && a.s < 1 : true, JSON.stringify(a));
  await t.sleep(1000);
  a = await J("return { opened: window.__phoneOpened, fly: !!SKY.fly, overview: !!document.querySelector('#v1Ov') };");
  t.check('…and arriving opens its phone panel', a.opened === 1 && !a.fly && !a.overview, JSON.stringify(a));

  // this PC: the view flies to it and comes down into Sky
  await t.js("S.settings.overviewView = 'galaxy', v1Overview(), 1"); await t.sleep(1100);
  const me = await J('return (SKY.devs.find((d) => d.me) || {}).id;');
  p = await devXY(me);
  await mouse('mouseDown', p[0], p[1]); await mouse('mouseUp', p[0], p[1]); await t.sleep(1000);
  await shot('g3-flying-pc');
  await t.sleep(1900);
  a = await J("return { mode: SKY.mode, view: S.settings.overviewView, on: document.querySelector('.v1-ovsw .b.on').textContent, fly: !!SKY.fly || !!SKY.warp };");
  t.check('clicking this PC flies to it and comes down into Sky', a.mode === 'sky' && a.view === 'sky' && /sky/i.test(a.on) && !a.fly, JSON.stringify(a));
  await shot('g4-sky-landed');

  // zooming moves between the views: out of Sky into the Galaxy, into the Galaxy down into Sky on the tab you're on
  const wheel = (x, y, dy) => t.js(`(() => { const r = SKY.canvas.getBoundingClientRect(); SKY.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: ${dy}, clientX: ${x} || r.left + r.width / 2, clientY: ${y} || r.top + r.height / 2, bubbles: true, cancelable: true })); })(), 1`);
  await t.js('Object.assign(SKY.cam, skyFitAll()), SKY.cam.z = 0.25, skyDraw(), 1'); await t.sleep(200);
  await wheel(0, 0, 120); await t.sleep(80); await wheel(0, 0, 120); await t.sleep(950);
  a = await J("return { mode: SKY.mode, view: S.settings.overviewView, deep: SKY_DEEP.list && SKY_DEEP.list.length };");
  t.check('zooming out of Sky rises into the Galaxy', a.mode === 'galaxy' && a.view === 'galaxy', JSON.stringify(a));
  t.check('far-off galaxies sit behind the view', a.deep >= 8, JSON.stringify(a));
  await t.js('SKY.cam.z = 1.8, skyDraw(), 1'); await t.sleep(200);
  await wheel(0, 0, -120); await t.sleep(80); await wheel(0, 0, -120); await t.sleep(950);
  a = await J('const s = SKY.starById.get((activeTab() || {}).id); return { mode: SKY.mode, dx: s && Math.round(SKY.cam.x - s.x), dy: s && Math.round(SKY.cam.y - s.y) };');
  t.check('zooming into the Galaxy comes down into Sky on the tab you’re on', a.mode === 'sky' && Math.abs(a.dx) < 8 && Math.abs(a.dy) < 8, JSON.stringify(a));
  await t.js('v1CloseOverview(), window.v1Phone = window.__origPhone, PH.devices = [], 1');
};
