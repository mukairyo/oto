'use strict';
// YouTube ambient light (src/yt-ambient.js): the glow appears behind a playing video, follows its colours, obeys every
// setting, follows the picture in theatre mode, stays away where it should, and goes away cleanly when switched off.
// Runs Oto's own ambient code (taken from Oto's window) in a stand-in watch page; the real youtube.com can't be
// reached from the test machine. The settings panel on Oto's YouTube page is checked too.
module.exports = async (t) => {
  await t.open('http://yt.site/watch', 4000);
  const src = await t.js('otoYtAmbient.toString()');
  const run = (opts) => t.page(`(${src})(${JSON.stringify(opts)})`);
  // what the page looks like right now: the glow layer, its picture, YouTube's own background
  const look = () => t.page(`(() => {
    const L = document.getElementById('oto-ambient'), c = L && L.querySelector('canvas'), app = document.querySelector('ytd-app');
    const box = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); };
    let px = null; try { const d = c.getContext('2d').getImageData(32, 18, 1, 1).data; px = [d[0], d[1], d[2]]; } catch (e) { px = String(e); }
    return { on: !!L && L.classList.contains('on'), attr: document.documentElement.hasAttribute('oto-ambient'), opacity: L ? getComputedStyle(L).opacity : null,
      layer: L ? box(L) : null, canvas: c ? box(c) : null, blur: c ? getComputedStyle(c).filter : null, video: box(document.querySelector('video')),
      appBg: getComputedStyle(app).backgroundColor, cinematics: getComputedStyle(document.getElementById('cinematics')).display, px, noApi: typeof window.oto === 'undefined' && typeof require === 'undefined' };
  })()`);
  const near = (px, rgb) => Array.isArray(px) && px.every((v, i) => Math.abs(v - rgb[i]) < 40);
  const wait = (ms) => t.sleep(ms);

  t.check('installs once in the page and reports it', (await run({})) === 'installed' && (await run({})) === 'updated');
  await wait(1200);
  let a = await look();
  t.check('a glow appears behind the playing video, and YouTube\'s own background lets it through', a.on && a.attr && a.appBg === 'rgba(0, 0, 0, 0)' && a.cinematics === 'none', JSON.stringify(a));
  t.check('…placed on the picture and reaching past it on every side', JSON.stringify(a.layer) === JSON.stringify(a.video) && a.canvas[0] < a.layer[0] && a.canvas[1] < a.layer[1] && a.canvas[2] > a.layer[2] && a.canvas[3] > a.layer[3], `layer ${a.layer} video ${a.video} glow ${a.canvas}`);
  t.check('…in the video\'s colour (red)', near(a.px, [224, 32, 74]), String(a.px));
  await t.page('window.__paint("#20c040")'); await wait(700);
  a = await look();
  t.check('it follows the picture: the video turns green, so does the glow', near(a.px, [32, 192, 64]), String(a.px));
  t.check('the page gets no Oto API and no Node.js from it', a.noApi === true);

  await run({ strength: 40, blur: 0, spread: 0, fade: 0 }); await wait(200);
  a = await look();
  t.check('settings apply at once: brightness 40%, blur 0, spread 0 (glow exactly on the picture)', a.opacity === '0.4' && /blur\(12px\)/.test(a.blur) && JSON.stringify(a.canvas) === JSON.stringify(a.layer), `opacity ${a.opacity} ${a.blur} glow ${a.canvas} layer ${a.layer}`);
  await run({ spread: 400, blur: 100 }); await wait(200);
  a = await look();
  const pageW = await t.page('document.documentElement.clientWidth');
  const ctxMode = await t.page(`JSON.stringify(document.querySelector('#oto-ambient canvas').getContext('2d').getContextAttributes())`);
  t.check('spread 400% reaches far past the picture but stays inside the page (no hard line at the window edge), blur 100% is the softest', a.canvas[0] >= 0 && a.canvas[0] + a.canvas[2] <= pageW && a.canvas[1] >= 0 && a.canvas[3] > a.layer[3] * 1.6 && /blur\(142px\)/.test(a.blur), `glow ${a.canvas} layer ${a.layer} page width ${pageW} ${a.blur}`);
  t.check('the glow canvas is an ordinary one (a low-latency canvas can skip the blur on Windows and show stripes)', JSON.parse(ctxMode).desynchronized === false, ctxMode);

  // theatre mode: the player gets wider than the picture; the glow stays on the picture
  await run({ fade: 0 });
  await t.page('document.querySelector("ytd-watch-flexy").setAttribute("theater", "")'); await wait(1000);
  a = await look();
  t.check('theatre mode: the glow follows the picture, not the wider player', a.on && Math.abs(a.layer[2] - 640) <= 1 && Math.abs(a.layer[0] - 180) <= 1 && a.layer[1] === a.video[1], `layer ${a.layer}`);
  await run({ fade: 0, layouts: 'normal' }); await wait(900);
  t.check('"Normal" only: no glow in theatre mode', !(await look()).on);
  await t.page('document.querySelector("ytd-watch-flexy").removeAttribute("theater")'); await wait(900);
  t.check('…and back in the normal player it returns', (await look()).on);
  await run({ fade: 0, layouts: 'theater' }); await wait(900);
  t.check('"Theatre" only: no glow in the normal player', !(await look()).on);

  await run({ fade: 0 });
  await t.page('document.documentElement.removeAttribute("dark")'); await wait(900);
  t.check('YouTube\'s light theme: no glow unless asked for', !(await look()).on);
  await run({ fade: 0, light: true }); await wait(900);
  t.check('…with "Dark & light" it shows there too', (await look()).on);
  await t.page('document.documentElement.setAttribute("dark", "")');

  await run({ on: false }); await wait(150);
  t.check('switching off fades the glow out before YouTube\'s background returns', (await look()).attr === true);
  await wait(800);
  a = await look();
  t.check('switched off: the glow goes, and YouTube looks exactly as before (its background and its own glow are back)', !a.on && !a.attr && a.appBg === 'rgb(15, 15, 15)' && a.cinematics !== 'none', JSON.stringify(a));
  await run({ fade: 0 }); await wait(900);
  t.check('…and switched on again it comes back', (await look()).on);

  // the settings under MORE SETTINGS
  await run({ fade: 0 }); await wait(300);
  await t.page('window.__paint("#e0204a"); window.__bars(true)'); await wait(3200);
  a = await look();
  t.check('black bars inside the picture are left out: the glow starts where the picture starts, in its colour', Math.abs(a.layer[3] - 240) <= 8 && Math.abs(a.layer[1] - (a.video[1] + 60)) <= 4 && near(a.px, [224, 32, 74]), `layer ${a.layer} video ${a.video} colour ${a.px}`);
  await run({ fade: 0, bars: false }); await wait(400);
  a = await look();
  t.check('…and with "Ignore black bars" off it covers the whole frame again', a.layer[3] === 360 && a.layer[1] === a.video[1], `layer ${a.layer} video ${a.video}`);
  await t.page('window.__bars(false)');
  await run({ fade: 0, edge: 60, text: 50, boxes: 0, thumbs: 50, res: 'high', brightness: 120, colors: 50 }); await wait(400);
  const pageLook = JSON.parse(await t.page(`JSON.stringify({ edge: getComputedStyle(document.getElementById('oto-ambient'), '::after').boxShadow, text: getComputedStyle(document.querySelector('ytd-watch-flexy')).textShadow, chip: getComputedStyle(document.documentElement).getPropertyValue('--yt-spec-badge-chip-background').trim(), detail: document.querySelector('#oto-ambient canvas').width, filter: getComputedStyle(document.querySelector('#oto-ambient canvas')).filter })`));
  t.check('video edge shadow, text shadows, see-through boxes, glow detail, brightness and colours all apply', /54px/.test(pageLook.edge) && pageLook.text !== 'none' && /rgba\(255,\s*255,\s*255,\s*0(\.0+)?\)/.test(pageLook.chip) && pageLook.detail === 128 && /saturate\(0\.5\) brightness\(1\.2\)/.test(pageLook.filter), JSON.stringify(pageLook));
  await run({ fade: 0, immersive: true });
  await t.page('document.querySelector("ytd-watch-flexy").setAttribute("theater", ""); scrollTo(0, 0)'); await wait(1000);
  const imm = async () => JSON.parse(await t.page(`JSON.stringify({ top: getComputedStyle(document.getElementById('masthead-container')).opacity, page: getComputedStyle(document.getElementById('columns')).opacity })`));
  let i1 = await imm(); await wait(600); i1 = await imm();
  await t.page('scrollTo(0, 200)'); await wait(800);
  const i2 = await imm();
  t.check('immersive theatre: the top bar and the page fade away, and come back when you scroll', i1.top === '0' && i1.page === '0' && i2.top === '1' && i2.page === '1', `${JSON.stringify(i1)} → ${JSON.stringify(i2)}`);
  await t.page('scrollTo(0, 0); document.querySelector("ytd-watch-flexy").removeAttribute("theater")');
  await run({ fade: 0 }); await wait(900);
  const key = (target) => t.page(`(${target}).dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }))`);
  await key('document.body'); await wait(300);
  const g1 = (await look()).on;
  await key('document.getElementById("q")'); await wait(300);
  const g2 = (await look()).on;
  await key('document.body'); await wait(300);
  const g3 = (await look()).on;
  t.check('the G key switches the glow off and on (not while typing in a box)', g1 === false && g2 === false && g3 === true, `${g1} ${g2} ${g3}`);

  // the button in the player's controls and its small panel
  await run({ fade: 0 }); await wait(1300);
  const btnInfo = JSON.parse(await t.page(`JSON.stringify((() => { const b = document.querySelector('.ytp-right-controls .oto-amb-btn'); return b ? { next: b.nextElementSibling && b.nextElementSibling.className, pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), svg: !!b.querySelector('svg') } : null; })())`));
  t.check('an ambient light button sits in the player\'s controls, just before the settings gear', !!btnInfo && /ytp-settings-button/.test(btnInfo.next) && btnInfo.pressed === 'true' && btnInfo.label === 'Ambient light' && btnInfo.svg, JSON.stringify(btnInfo));
  const popRes = JSON.parse(await t.page(`(async () => {
    const b = document.querySelector('.oto-amb-btn'); b.click(); await new Promise((r) => setTimeout(r, 200));
    const pop = document.querySelector('#movie_player .oto-amb-pop'); const open = !!pop && !pop.hidden;
    const r = pop.querySelector('input[aria-label="Strength"]'); r.value = 40; r.dispatchEvent(new Event('input', { bubbles: true })); r.click();
    await new Promise((x) => setTimeout(x, 200));
    return JSON.stringify({ open, sliders: [...pop.querySelectorAll('input[type=range]')].map((x) => x.getAttribute('aria-label')).join(','), opacity: getComputedStyle(document.getElementById('oto-ambient')).opacity, clicks: window.__playerClicks });
  })()`));
  t.check('the button opens a small panel (switch, Strength, Blur, Spread, Brightness) that changes the glow at once', popRes.open && popRes.sliders === 'Strength,Blur,Spread,Brightness' && popRes.opacity === '0.4', JSON.stringify(popRes));
  t.check('…and clicks in the panel don\'t reach the video (no pause)', popRes.clicks === 0, `player clicks: ${popRes.clicks}`);
  await t.js('(() => { const v = V.get(activeTab().id); v.ytAmbient = true; })()');
  await t.js('ytAmbTakeFrom(V.get(activeTab().id))');
  t.check('Oto picks up the change from the panel and saves it', (await t.js('ytAmb().strength')) === 40);
  t.check('…keeping only known settings with sensible values (junk from a page is dropped)', (await t.js(`JSON.stringify(ytAmbClean({ strength: 9999, blur: 'x', evil: 1, layouts: 'bad', on: 'yes', __proto__: { on: false } }))`)) === '{"strength":100}');
  await t.page(`(() => { const pop = document.querySelector('.oto-amb-pop'); pop.querySelector('.sw').click(); })()`); await wait(400);
  const offNow = JSON.parse(await t.page(`JSON.stringify({ glow: document.getElementById('oto-ambient').classList.contains('on'), btn: !!document.querySelector('.oto-amb-btn'), pressed: document.querySelector('.oto-amb-btn').getAttribute('aria-pressed') })`));
  t.check('the panel\'s switch turns the glow off; the button stays so it can be turned back on', !offNow.glow && offNow.btn && offNow.pressed === 'false', JSON.stringify(offNow));
  await t.page(`document.querySelector('.oto-amb-pop .f button').click()`);
  await t.js('ytAmbTakeFrom(V.get(activeTab().id))'); await wait(700);
  t.check('"All settings" opens Oto\'s YouTube page; the glow\'s "off" was saved too', (await t.js(`!!document.querySelector('.sh-amb') && ytAmb().on === false`)) === true);
  await t.js(`typeof shpClose === 'function' && shpClose(); S.settings.ytAmbient = { ...OTO_AMBIENT_DEFAULTS }; true`);
  await run({ fade: 0, button: false }); await wait(300);
  t.check('with "Button in the player" off, the button goes away', (await t.page(`!document.querySelector('.oto-amb-btn')`)) === true);

  // the glow around Oto's own window takes the glow's edge colours
  await run({ fade: 0, button: true }); await t.page('window.__paint("#2050e0")'); await wait(900);
  const cols = JSON.parse(await t.page('JSON.stringify(window.__otoAmbient.colors())'));
  t.check('the page hands Oto only the glow\'s edge colours (blue here)', !!cols && ['left', 'right', 'top', 'bottom'].every((k) => Array.isArray(cols[k]) && cols[k][2] > 150 && cols[k][0] < 90), JSON.stringify(cols));
  t.check('…and Oto accepts only real colours from it', (await t.js(`[ambRgb([1, 2, 3]), ambRgb([1, 2]), ambRgb([1, 2, 300]), ambRgb(['1', 2, 3]), ambRgb('red')].join('|')`)) === 'rgb(1,2,3)||||');

  await t.js(`AMBF.hold = true; ambFrameShow(${JSON.stringify(cols)}); true`); await wait(900);
  const fr = JSON.parse(await t.js(`JSON.stringify((() => { const el = document.getElementById('amb-frame'), c = document.getElementById('content').getBoundingClientRect(); return { on: el.classList.contains('on'), opacity: getComputedStyle(el).opacity, clip: el.style.clipPath, hole: [c.left, c.top].map(Math.round), pointer: getComputedStyle(el).pointerEvents, left: getComputedStyle(el.querySelector('.l')).backgroundColor }; })())`));
  t.check('Oto\'s window glows around the page in those colours, never over the page and never catching the mouse', fr.on && +fr.opacity > 0.3 && fr.pointer === 'none' && /evenodd/.test(fr.clip) && fr.clip.includes(`${fr.hole[0]}px`) && /rgb\(\d+, \d+, (1[5-9]\d|2\d\d)\)/.test(fr.left), JSON.stringify(fr));
  if (process.env.OTO_E2E_SHOTS) {
    const win = require('electron').BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.isVisible());
    if (win) require('fs').writeFileSync(require('path').join(process.env.OTO_E2E_SHOTS, 'oto-ambient-frame.png'), (await win.capturePage()).toPNG());
  }
  await t.js('ambFrameOff(); AMBF.hold = false; true');

  // only real YouTube addresses get it, and it is on unless switched off
  t.check('runs on youtube.com watch pages, nowhere else; on by default', await t.js(`isYT('https://www.youtube.com/watch?v=abc') && isYT('https://m.youtube.com/watch?v=abc') && !isYT('https://youtube.com.evil.example/') && !isYT('https://notyoutube.com/') && ytAmb().on === true`));

  // Oto's YouTube page has the settings (OTO_E2E_SHOTS=<folder> saves a picture of it)
  if (process.env.OTO_E2E_SHOTS) {
    await t.js(`v1ShieldPage('youtube')`); await wait(800);
    const win = require('electron').BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.isVisible());
    if (win) require('fs').writeFileSync(require('path').join(process.env.OTO_E2E_SHOTS, 'oto-youtube-ambient.png'), (await win.capturePage()).toPNG());
    await t.js(`typeof shpClose === 'function' && shpClose()`);
  }
  const panel = await t.js(`(async () => {
    v1ShieldPage('youtube'); await new Promise((r) => setTimeout(r, 600));
    const box = document.querySelector('.sh-amb'); if (!box) return 'no panel';
    const ranges = [...box.querySelectorAll('input[type=range]')];
    const r = ranges[0]; r.value = 55; r.dispatchEvent(new Event('input'));
    const segs = box.querySelectorAll('.sh-seg').length;
    const out = { ranges: ranges.map((x) => x.getAttribute('aria-label')).join(','), segs, strength: ytAmb().strength };
    if (typeof shpClose === 'function') shpClose();
    return JSON.stringify(out);
  })()`);
  t.check('Oto\'s YouTube page: ambient light switch, Strength/Blur/Spread sliders, fade/player-size/theme choices, changes saved', /"ranges":"Strength,Blur,Spread","segs":3,"strength":55/.test(panel), panel);
};
