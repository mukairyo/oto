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
  await run({ spread: 200, blur: 100 }); await wait(200);
  a = await look();
  t.check('…spread 200% reaches twice as far as normal, blur 100% is the softest', a.canvas[0] < a.layer[0] - a.layer[2] * 0.19 && /blur\(142px\)/.test(a.blur), `glow ${a.canvas} layer ${a.layer} ${a.blur}`);

  // theatre mode: the player gets wider than the picture; the glow stays on the picture
  await run({ fade: 0 });
  await t.page('document.querySelector("ytd-watch-flexy").setAttribute("theater", "")'); await wait(1000);
  a = await look();
  t.check('theatre mode: the glow follows the picture, not the wider player', a.on && Math.abs(a.layer[2] - 640) <= 1 && Math.abs(a.layer[0] - 180) <= 1, `layer ${a.layer}`);
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
  t.check('Oto\'s YouTube page: ambient light switch, Brightness/Blur/Spread sliders, fade/player-size/theme choices, changes saved', /"ranges":"Brightness,Blur,Spread","segs":3,"strength":55/.test(panel), panel);
};
