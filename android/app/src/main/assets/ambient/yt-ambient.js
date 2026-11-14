'use strict';
/* Oto — YouTube ambient light (Oto for Android).
 *
 * The same light as Oto for Windows (src/yt-ambient.js on main, 1.6.7), plus the phone's YouTube (m.youtube.com):
 * its player and dark theme are found too, its page lets the light through, and the light follows the player while
 * you scroll. Run as a content script of the built-in "Oto ambient light" extension (start.js starts it).
 *
 * A soft glow in the video's own colours spreads out around the player and over the page, and follows the picture as
 * it changes. Written for Oto (not taken from any extension).
 *
 * How: a small canvas behind the page gets the current video frame drawn into it, and the browser stretches and
 * blurs it far past the player's edges. The picture only goes from the video onto the screen; the one thing read
 * back is a tiny copy, about once a second, to find black bars inside the picture (films), and nothing leaves the
 * page. No permissions, and it works with Shield's fingerprint protection.
 *
 * otoYtAmbient(opts) is run in YouTube pages by the renderer (src/v1j.js, wv.executeJavaScript): it installs once
 * per page, and later calls change the settings or switch it off. Settings (Shield › YouTube › Ambient light):
 *   on          switched on
 *   strength    0–100   how strongly the glow shows
 *   blur        0–100   how soft, as a share of the picture's height (so it looks the same in any player size)
 *   spread      0–400   how far past the picture it reaches: 100% = half the picture's width past every edge
 *   step        1–60    edge size: the light is the picture drawn several times, each copy this much (% of the
 *               picture) bigger than the last, smaller copies on top. Just outside the picture you then see its own
 *               edge colours carried outward, ring by ring, instead of colours from further inside the picture.
 *   fadeStart   -50–100 where the fade-out starts, in % of the spread (0 = right at the picture's edge)
 *   fadeCurve   1–100   how the fade-out runs: low = light fades early and gently, high = it stays strong longer
 * (The way the light is built, with stacked copies, an even reach on all sides and a fade curve, follows the
 * approach of the MIT-licensed "Ambient light for YouTube" extension by Wessel Kroos; the code is Oto's own.)
 *   brightness  50–150  glow brightness (100 = the video's own)
 *   colors      0–200   glow colour strength (100 = the video's own)
 *   fade        ms      how long the glow takes to appear and go
 *   layouts     'all' | 'normal' | 'theater'
 *   light       also on YouTube's light theme (normally only the dark theme, where a glow reads best)
 *   res         'low' | 'normal' | 'high'   detail of the glow (128, 256 or 512 points across)
 *   fps         15 | 30 | 60               most glow updates per second
 *   bars        ignore black bars inside the picture
 *   edge        0–100   shadow around the video's edges
 *   text        0–100   shadow behind the page's text, for reading over the glow
 *   boxes       0–200   how solid YouTube's buttons and boxes are (100 = as YouTube draws them)
 *   thumbs      20–100  thumbnail brightness
 *   header      YouTube's top bar lets the light through: its frosted-glass and background layers (which blur
 *               the colourful light into flat grey) are switched off, with a soft dark shade so its buttons stay readable
 *   immersive   theatre mode: the top bar and the page below fade away until you scroll or point at them
 *   key         the G key switches the glow off and on in this tab
 *   frame       Oto's own window (sidebar, top bar, edges around the page) glows too: Oto asks the page for the
 *               glow's tiny picture (frame(), below) several times a second and continues the glow around the page.
 *   button      an ambient light button in the player's controls, next to captions and settings. It opens a small
 *               panel with the main settings; changes there are collected by Oto (take(), below), checked and saved.
 * Only on watch pages. Hidden in fullscreen (the video fills the screen), in the mini-player, for videos with copy
 * protection (they draw black) and while the tab is in the background. YouTube's own, much smaller "ambient mode"
 * glow is hidden while Oto's is on.
 */
const OTO_AMBIENT_DEFAULTS = { on: true, strength: 85, blur: 30, spread: 100, step: 12, fadeStart: 15, fadeCurve: 35, brightness: 100, colors: 135, fade: 600, layouts: 'all', light: false, res: 'normal', fps: 30, bars: true, edge: 0, text: 0, boxes: 100, thumbs: 100, immersive: false, key: true, button: true, frame: true, header: true };
function otoYtAmbient(opts) {
  // = OTO_AMBIENT_DEFAULTS (this function runs inside the page on its own)
  const D = { on: true, strength: 85, blur: 30, spread: 100, step: 12, fadeStart: 15, fadeCurve: 35, brightness: 100, colors: 135, fade: 600, layouts: 'all', light: false, res: 'normal', fps: 30, bars: true, edge: 0, text: 0, boxes: 100, thumbs: 100, immersive: false, key: true, button: true, frame: true, header: true };
  const A = window.__otoAmbient;
  if (A) { A.set(opts); return 'updated'; }
  const o0 = { ...D, ...(opts || {}) };
  if (!o0.on && !o0.button) return 'off';
  const doc = document, root = doc.documentElement;
  const layer = doc.createElement('div'), cv = doc.createElement('canvas'); // cv: the current frame, not on the page
  layer.id = 'oto-ambient';
  layer.setAttribute('aria-hidden', 'true');
  // two fades on two elements (one mask each always multiplies correctly): left/right on wrap, top/bottom on mid
  const wrap = doc.createElement('div'), mid = doc.createElement('div');
  wrap.className = 'oa-wrap'; mid.className = 'oa-mid';
  wrap.appendChild(mid); layer.appendChild(wrap);
  // Normal canvases, not low-latency ("desynchronized") ones: Chromium may put those straight on the screen and skip
  // the blur, which shows as sharp stretched stripes (seen on Windows in 1.6.1).
  const ctx = cv.getContext('2d', { alpha: false });
  let levels = []; // [{ el, ctx, s }] from the biggest copy (bottom) to the smallest (top)
  const probe = doc.createElement('canvas'); probe.width = 96; probe.height = 54; // for black bars
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  const style = doc.createElement('style'), look = doc.createElement('style');
  style.id = 'oto-ambient-css'; look.id = 'oto-ambient-look';
  const IMM = 'html[oto-ambient][oto-immersive][oto-theater]:not([oto-scrolled])';
  // The glow sits under the whole page (z-index -1: above the page's own dark background, below everything else) and
  // YouTube's own layout is left alone. (Until 1.6.6 YouTube's app element was moved up a layer instead, which made
  // YouTube place its hover previews too low, under the thumbnail they belong to.)
  style.textContent = `
html[oto-ambient] body,html[oto-ambient] ytd-app{background:transparent!important}
html[oto-ambient][oto-pagebg]{background:var(--oto-pagebg)!important}
html[oto-ambient] ytm-app,html[oto-ambient] #app,html[oto-ambient] .page-container,html[oto-ambient] ytm-watch,html[oto-ambient] ytm-single-column-watch-next-results-renderer,html[oto-ambient] #player-container-id,html[oto-ambient] .player-container,html[oto-ambient] .watch-below-the-player{background:transparent!important}
html[oto-ambient] #cinematics,html[oto-ambient] #cinematics-container{display:none!important}
#oto-ambient{position:absolute;left:0;top:0;width:0;height:0;z-index:-1;pointer-events:none;opacity:0;transition:opacity var(--oa-fade,600ms) ease;contain:layout style size}
#oto-ambient.on{opacity:var(--oa-strength,.85)}
#oto-ambient .oa-wrap{position:absolute}
#oto-ambient .oa-mid{position:absolute;inset:0;filter:blur(var(--oa-blur,54px)) saturate(var(--oa-colors,1.35)) brightness(var(--oa-bright,1))}
#oto-ambient canvas{position:absolute;transform-origin:50% 50%}
#oto-ambient::after{content:'';position:absolute;inset:0;box-shadow:0 0 var(--oa-edge,0px) calc(var(--oa-edge,0px)/5) rgba(0,0,0,.85)}
html[oto-ambient] #movie_player,html[oto-ambient] .html5-video-player,html[oto-ambient] #full-bleed-container,html[oto-ambient] #player-full-bleed-container,html[oto-ambient] #player-container-outer,html[oto-ambient] #player-container-inner,html[oto-ambient] #ytd-player,html[oto-ambient] #container.ytd-player{background:transparent!important}
html[oto-ambient][oto-header] #masthead-container #frosted-glass,html[oto-ambient][oto-header] ytd-masthead #background{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;opacity:0!important}
html[oto-ambient][oto-header][dark] #masthead-container{background:linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.18) 70%,rgba(0,0,0,0))!important}
html[oto-ambient][oto-immersive] #masthead-container,html[oto-ambient][oto-immersive] ytd-watch-flexy #columns{transition:opacity .45s ease}
${IMM} #masthead-container:not(:hover),${IMM} ytd-watch-flexy[theater] #columns:not(:hover){opacity:0}
.oto-amb-btn{display:inline-flex!important;align-items:center;justify-content:center}
.oto-amb-btn svg{width:100%;height:100%;pointer-events:none}
.oto-amb-btn .ray{transition:opacity .2s}
.oto-amb-btn[aria-pressed=false] .ray{opacity:.25}
.oto-amb-pop{position:absolute;right:12px;bottom:60px;z-index:72;width:280px;padding:10px 0 8px;border-radius:12px;background:rgba(28,28,28,.92);color:#eee;font:500 13px/1.3 Roboto,Arial,sans-serif;text-shadow:none;box-shadow:0 6px 24px rgba(0,0,0,.45);backdrop-filter:blur(8px)}
.oto-amb-pop[hidden]{display:none}
.oto-amb-pop .h{display:flex;align-items:center;justify-content:space-between;padding:2px 16px 8px;font-weight:600;font-size:14px}
.oto-amb-pop .sw{position:relative;width:36px;height:20px;border:0;border-radius:10px;background:#555;cursor:pointer;padding:0}
.oto-amb-pop .sw::after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#ccc;transition:transform .18s}
.oto-amb-pop .sw[aria-checked=true]{background:#e7dfd1}
.oto-amb-pop .sw[aria-checked=true]::after{transform:translateX(16px);background:#131313}
.oto-amb-pop .r{display:grid;grid-template-columns:76px 1fr 40px;align-items:center;gap:8px;padding:5px 16px}
.oto-amb-pop .r span:last-child{text-align:right;font-size:12px;color:#bbb}
.oto-amb-pop input[type=range]{width:100%;accent-color:#e7dfd1;margin:0}
.oto-amb-pop .f{display:flex;justify-content:space-between;align-items:center;padding:8px 16px 2px;border-top:1px solid rgba(255,255,255,.1);margin-top:6px;font-size:11px;color:#999}
.oto-amb-pop .f button{border:0;background:transparent;color:#e7dfd1;font:600 12px Roboto,Arial,sans-serif;cursor:pointer;padding:4px 0}
.oto-amb-pop.off .r{opacity:.45;pointer-events:none}`;
  let o = o0, enabled = false, userOff = false, timer = 0, lastDraw = 0, lastProbe = 0, video = null, rvfc = 0, shown = false, gone = 0;
  // 256 points across (enough that stretched copies don't look blocky, and small enough to draw several of them)
  let W = 256, H = 144, crop = { x: 0, y: 0, w: 1, h: 1 }, cropSeen = '', cropCount = 0, geo = null, shape = '';
  cv.width = W; cv.height = H;
  const n = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

  const player = () => doc.querySelector('ytd-watch-flexy:not([hidden]) #movie_player') || doc.querySelector('ytm-watch #movie_player, #player-container-id #movie_player, .player-container #movie_player');
  // the phone's YouTube marks its dark theme differently: a dark page background counts too
  // (read while the light is off: once it's on, those backgrounds are see-through and the answer is kept)
  let pageBg = '', pageDark = false;
  const isDark = () => {
    if (root.hasAttribute('dark')) return true;
    if (root.hasAttribute('oto-ambient')) return pageDark;
    pageBg = ''; pageDark = false;
    for (const el of [doc.body, doc.querySelector('ytm-app')]) {
      if (!el) continue;
      const c = String(getComputedStyle(el).backgroundColor), m = c.match(/[\d.]+/g);
      if (m && m.length >= 3 && (m.length < 4 || Number(m[3]) > 0)) { pageBg = c; pageDark = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] < 60; break; }
    }
    return pageDark;
  };
  const theaterNow = () => !!doc.querySelector('ytd-watch-flexy[theater]:not([hidden]), ytd-watch-flexy[full-bleed-player]:not([hidden])');
  const usable = () => {
    if (!enabled || userOff || doc.hidden || doc.fullscreenElement) return false;
    if (!/^\/watch/.test(location.pathname) || (!o.light && !isDark())) return false;
    const p = player();
    if (!p || p.classList.contains('ytp-player-minimized')) return false;
    const theater = theaterNow();
    if ((o.layouts === 'normal' && theater) || (o.layouts === 'theater' && !theater)) return false;
    const v = p.querySelector('video.html5-main-video');
    return v && v.videoWidth > 0 ? v : false;
  };
  // A fade-out along one direction: the picture starts at `a` (px, inside the element) and is `len` long; the light
  // reaches `e` px past each end. Light is full up to the fade start, then falls along the curve to nothing.
  const fadeMask = (dir, a, len, e) => {
    if (e < 1) return `linear-gradient(${dir},#000,#000)`;
    const f = n(o.fadeStart, -50, 100, 15) / 100 * e, curve = 16 / (n(o.fadeCurve, 1, 100, 35) * 0.64);
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, d = f + (e - f) * t; // distance from the picture's edge
      if (d < 0) continue;
      pts.push([d, 1 - Math.pow(t, curve)]);
    }
    const first = pts.length ? pts[0][1] : 1;
    const before = pts.slice().reverse().map(([d, al]) => `rgba(0,0,0,${al.toFixed(3)}) ${(a - d).toFixed(1)}px`);
    const after = pts.map(([d, al]) => `rgba(0,0,0,${al.toFixed(3)}) ${(a + len + d).toFixed(1)}px`);
    return `linear-gradient(${dir},${before.join(',')},rgba(0,0,0,${first.toFixed(3)}) ${a.toFixed(1)}px,rgba(0,0,0,${first.toFixed(3)}) ${(a + len).toFixed(1)}px,${after.join(',')})`;
  };
  const drawLevels = () => { for (const l of levels) { try { l.ctx.drawImage(cv, 0, 0); } catch (e) {} } };
  // the glow follows the picture itself: in theatre mode the player is wider than the video (the bars at the sides
  // are made see-through above, so the glow fills them), and black bars inside the picture are left out
  const place = () => {
    const p = player();
    if (!p) return;
    const pr = p.getBoundingClientRect();
    let r = { left: pr.left, top: pr.top, width: pr.width, height: pr.height };
    if (video && video.videoWidth && video.videoHeight) {
      const k = Math.min(pr.width / video.videoWidth, pr.height / video.videoHeight), w = video.videoWidth * k, h = video.videoHeight * k;
      r = { left: pr.left + (pr.width - w) / 2, top: pr.top + (pr.height - h) / 2, width: w, height: h };
    }
    r = { left: r.left + r.width * crop.x, top: r.top + r.height * crop.y, width: r.width * crop.w, height: r.height * crop.h };
    const s = layer.style;
    s.left = `${r.left + scrollX}px`; s.top = `${r.top + scrollY}px`; s.width = `${r.width}px`; s.height = `${r.height}px`;
    // The copies: how many and how big. Each is `step` % of the picture bigger than the last; widths grow by that much
    // of the picture's width and heights by the same number of pixels, so the light reaches equally far on every side.
    // Two smaller copies sit under the picture: blurred, they make the light right at its edge as strong as the picture.
    const step = n(o.step, 1, 60, 12) / 100, outer = Math.min(46, Math.round(n(o.spread, 0, 400, 100) / 100 / step)), INNER = 2;
    const want = `${outer}|${step}|${W}x${H}`;
    if (want !== shape) {
      shape = want;
      for (const l of levels) l.el.remove();
      levels = [];
      for (let pos = outer; pos >= -INNER; pos--) { // biggest first: later (smaller) copies are drawn on top
        const el = doc.createElement('canvas'); el.width = W; el.height = H;
        mid.appendChild(el);
        levels.push({ el, ctx: el.getContext('2d', { alpha: false }), pos });
      }
      if (shown) drawLevels();
    }
    const ex = (r.width * step * outer) / 2, ey = ex;
    // The light stays inside the page: a blurred layer cut off by the window's edge shows a hard bright line there.
    const pageW = root.clientWidth, x0 = Math.max(r.left - ex, 0), x1 = Math.min(r.left + r.width + ex, pageW);
    const y0 = Math.max(r.top + scrollY - ey, 0) - scrollY, y1 = r.top + r.height + ey;
    const w = wrap.style, c = mid.style;
    w.left = `${x0 - r.left}px`; w.top = `${y0 - r.top}px`; w.width = `${Math.max(1, x1 - x0)}px`; w.height = `${Math.max(1, y1 - y0)}px`;
    for (const l of levels) {
      const sx = Math.max(0.02, 1 + step * l.pos), sy = Math.max(0.02, 1 + step * l.pos * (r.width / r.height)), st = l.el.style;
      st.left = `${r.left - x0}px`; st.top = `${r.top - y0}px`; st.width = `${r.width}px`; st.height = `${r.height}px`;
      st.transform = `scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    }
    layer.style.setProperty('--oa-blur', `${Math.round(r.height * 0.0025 * n(o.blur, 0, 100, 30))}px`);
    // The fade-out: full light up to `fadeStart` % of the spread, then fading along a curve to nothing at its end.
    const mx = fadeMask('to right', r.left - x0, r.width, ex), my = fadeMask('to bottom', r.top - y0, r.height, ey);
    w.maskImage = mx; w.webkitMaskImage = mx;
    c.maskImage = my; c.webkitMaskImage = my;
    geo = { pic: [r.left, r.top, r.width, r.height], ex, ey, step, outer, inner: INNER };
  };
  // Black bars: about once a second a tiny copy of the frame is checked for dark rows and columns at its edges. A
  // change is only used once it has been seen twice in a row, so a dark scene doesn't make the glow jump.
  const findBars = () => {
    let d;
    try { pctx.drawImage(video, 0, 0, 96, 54); d = pctx.getImageData(0, 0, 96, 54).data; } catch (e) { return; } // protected video: keep as is
    const dark = (i) => d[i] < 22 && d[i + 1] < 22 && d[i + 2] < 22;
    const rowDark = (y) => { for (let x = 2; x < 94; x += 2) if (!dark((y * 96 + x) * 4)) return false; return true; };
    const colDark = (x) => { for (let y = 2; y < 52; y += 2) if (!dark((y * 96 + x) * 4)) return false; return true; };
    let t = 0, b = 0, l = 0, rr = 0;
    while (t < 16 && rowDark(t)) t++;
    while (b < 16 && rowDark(53 - b)) b++;
    while (l < 28 && colDark(l)) l++;
    while (rr < 28 && colDark(95 - rr)) rr++;
    if (t >= 16 && b >= 16) return; // a (nearly) black frame says nothing
    const pair = (a, z) => (Math.abs(a - z) <= 1 ? Math.min(a, z) : 0); // real bars come in pairs
    const ty = pair(t, b), lx = pair(l, rr), key = `${lx},${ty}`;
    if (key !== cropSeen) { cropSeen = key; cropCount = 1; return; }
    if (++cropCount !== 2) return;
    const next = { x: lx / 96, y: ty / 54, w: 1 - (2 * lx) / 96, h: 1 - (2 * ty) / 54 };
    if (next.x !== crop.x || next.y !== crop.y) { crop = next; place(); }
  };
  const draw = () => {
    if (!video) return;
    const now = performance.now();
    if (o.bars && now - lastProbe > 1000) { lastProbe = now; findBars(); }
    try {
      const vw = video.videoWidth, vh = video.videoHeight;
      ctx.drawImage(video, vw * crop.x, vh * crop.y, vw * crop.w, vh * crop.h, 0, 0, W, H);
    } catch (e) {}
    drawLevels();
    lastDraw = now;
  };
  const onFrame = () => {
    rvfc = 0;
    if (!video || !shown) return;
    if (performance.now() - lastDraw >= 1000 / n(o.fps, 5, 60, 30) - 2) draw();
    rvfc = video.requestVideoFrameCallback(onFrame);
  };

  // the settings that only change how things look
  const looks = () => {
    const s = layer.style;
    s.setProperty('--oa-strength', String(n(o.strength, 0, 100, 85) / 100));
    s.setProperty('--oa-fade', `${n(o.fade, 0, 5000, 600)}ms`);
    s.setProperty('--oa-bright', String(n(o.brightness, 50, 150, 100) / 100));
    s.setProperty('--oa-colors', String(n(o.colors, 0, 200, 135) / 100));
    s.setProperty('--oa-edge', `${Math.round(n(o.edge, 0, 100, 0) * 0.9)}px`);
    const res = { low: [128, 72], high: [512, 288] }[o.res] || [256, 144];
    if (res[0] !== W) { W = res[0]; H = res[1]; cv.width = W; cv.height = H; shape = ''; if (shown) { place(); draw(); } }
    if (!o.bars && (crop.w !== 1 || crop.h !== 1)) { crop = { x: 0, y: 0, w: 1, h: 1 }; cropSeen = ''; if (shown) { place(); draw(); } }
    // page look: text shadows, buttons and boxes, thumbnails (only what differs from YouTube's own)
    const text = n(o.text, 0, 100, 0), boxes = n(o.boxes, 0, 200, 100) / 100, thumbs = n(o.thumbs, 20, 100, 100) / 100;
    let css = '';
    if (text) { const a = (text / 100).toFixed(2); css += `html[oto-ambient] ytd-watch-flexy{text-shadow:0 0 ${(text * 0.06).toFixed(1)}px rgba(0,0,0,${a}),0 1px ${(text * 0.03).toFixed(1)}px rgba(0,0,0,${a})}`; }
    if (boxes !== 1) {
      const d = Math.min(1, 0.1 * boxes).toFixed(3), l = Math.min(1, 0.05 * boxes).toFixed(3);
      css += `html[oto-ambient][dark]{--yt-spec-badge-chip-background:rgba(255,255,255,${d});--yt-spec-10-percent-layer:rgba(255,255,255,${d})}html[oto-ambient]:not([dark]){--yt-spec-badge-chip-background:rgba(0,0,0,${l});--yt-spec-10-percent-layer:rgba(0,0,0,${l})}`;
    }
    if (thumbs !== 1) css += `html[oto-ambient] ytd-watch-flexy ytd-thumbnail img,html[oto-ambient] ytd-watch-flexy yt-thumbnail-view-model img,html[oto-ambient] ytd-watch-flexy .yt-lockup-view-model img{filter:brightness(${thumbs})}`;
    look.textContent = css;
    root.toggleAttribute('oto-immersive', !!(o.on && o.immersive));
    root.toggleAttribute('oto-header', !!(o.on && o.header !== false));
    if (shown) place();
  };
  const show = (v) => {
    if (video !== v) {
      if (video && rvfc) { video.cancelVideoFrameCallback(rvfc); rvfc = 0; }
      video = v; crop = { x: 0, y: 0, w: 1, h: 1 }; cropSeen = ''; lastProbe = 0;
    }
    if (!layer.isConnected) doc.body.prepend(layer);
    if (!style.isConnected) doc.head.appendChild(style);
    if (!look.isConnected) doc.head.appendChild(look);
    clearTimeout(gone);
    // the phone's YouTube paints its dark colour on the page, not on <html>: <html> takes it over while the page lets
    // the light through (otherwise the browser's white shows behind it)
    if (!root.hasAttribute('oto-ambient') && pageBg && !root.hasAttribute('dark')) { root.style.setProperty('--oto-pagebg', pageBg); root.setAttribute('oto-pagebg', ''); }
    root.setAttribute('oto-ambient', '');
    root.toggleAttribute('oto-theater', theaterNow());
    place();
    if (!shown) { shown = true; draw(); layer.classList.add('on'); }
    if (!rvfc && video.requestVideoFrameCallback) rvfc = video.requestVideoFrameCallback(onFrame);
  };
  // the glow fades out first; YouTube's own look comes back once it has gone
  const hide = () => {
    if (!shown) return;
    shown = false;
    layer.classList.remove('on');
    if (video && rvfc) { video.cancelVideoFrameCallback(rvfc); rvfc = 0; }
    clearTimeout(gone);
    gone = setTimeout(() => { if (!shown) { root.removeAttribute('oto-ambient'); root.removeAttribute('oto-theater'); root.removeAttribute('oto-pagebg'); } }, n(o.fade, 0, 5000, 600));
  };
  const check = () => { const v = usable(); if (v) show(v); else hide(); }; // show() also re-places the glow
  // a still picture (paused, seeking) still needs a fresh frame
  const still = (e) => { if (shown && e.target === video) draw(); };
  let raf = 0;
  const scrolled = () => {
    root.toggleAttribute('oto-scrolled', scrollY > 40);
    // the phone's player can stay at the top while the page scrolls under it: the light goes with it
    if (shown && !raf) raf = requestAnimationFrame(() => { raf = 0; if (shown) place(); });
  };
  // G switches the glow off and on in this tab (not while typing, and not with Ctrl/Alt/Cmd)
  const keyG = (e) => {
    if (!o.key || e.repeat || e.ctrlKey || e.altKey || e.metaKey || String(e.key).toLowerCase() !== 'g') return;
    const t = e.target, tag = t && t.tagName;
    if (t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;
    if (!/^\/watch/.test(location.pathname)) return;
    userOff = !userOff; check();
    btn.setAttribute('aria-pressed', String(!!o.on && !userOff));
  };
  const tick = () => { check(); timer = setTimeout(tick, 700); }; // the page changes without telling (theatre mode, layout, new video)
  const events = [['resize', () => shown && place()], ['yt-navigate-finish', check], ['fullscreenchange', check], ['visibilitychange', check], ['scroll', scrolled], ['keydown', keyG]];
  const add = () => { for (const [e, f] of events) addEventListener(e, f, { capture: true, passive: e !== 'keydown' }); doc.addEventListener('seeked', still, true); doc.addEventListener('loadeddata', still, true); scrolled(); tick(); };
  const remove = () => { for (const [e, f] of events) removeEventListener(e, f, { capture: true }); doc.removeEventListener('seeked', still, true); doc.removeEventListener('loadeddata', still, true); clearTimeout(timer); hide(); root.removeAttribute('oto-scrolled'); };
  // ---- the button in the player's controls and its small panel (built with the DOM: YouTube allows no HTML strings)
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, at) => { const e = doc.createElementNS(SVG, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const btn = doc.createElement('button');
  btn.className = 'ytp-button oto-amb-btn';
  btn.setAttribute('aria-label', 'Ambient light'); btn.setAttribute('title', 'Ambient light (g)'); btn.setAttribute('aria-haspopup', 'true');
  const icon = svgEl('svg', { viewBox: '0 0 36 36', fill: 'none', stroke: '#fff', 'stroke-width': '2', 'stroke-linecap': 'round' });
  icon.appendChild(svgEl('rect', { x: '11', y: '13', width: '14', height: '10', rx: '2' }));
  for (const [x1, y1, x2, y2] of [[18, 7, 18, 9.5], [6, 18, 8.5, 18], [27.5, 18, 30, 18], [9.5, 9.5, 11.2, 11.2], [26.5, 9.5, 24.8, 11.2], [9.5, 26.5, 11.2, 24.8], [26.5, 26.5, 24.8, 24.8], [18, 26.5, 18, 29]]) icon.appendChild(svgEl('line', { x1, y1, x2, y2, class: 'ray' }));
  btn.appendChild(icon);
  const pop = doc.createElement('div');
  pop.className = 'oto-amb-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Ambient light');
  const el = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const head = el('div', 'h'), swB = el('button', 'sw');
  swB.setAttribute('role', 'switch'); swB.setAttribute('aria-label', 'Ambient light');
  head.append(el('span', '', 'Ambient light'), swB);
  pop.appendChild(head);
  const changes = {}; let wantOpen = false;
  const change = (k, v) => { o = { ...o, [k]: v }; changes[k] = v; looks(); const on = !!o.on; if (on !== enabled) { enabled = on; if (on) add(); else remove(); } else if (on) check(); paintPop(); };
  const ranges = {};
  for (const [k, label, min, max] of [['strength', 'Strength', 10, 100], ['blur', 'Blur', 0, 100], ['spread', 'Spread', 0, 400], ['brightness', 'Brightness', 50, 150]]) {
    const row = el('div', 'r'), r = el('input'), out = el('span');
    r.type = 'range'; r.min = String(min); r.max = String(max); r.step = '1'; r.setAttribute('aria-label', label);
    r.addEventListener('input', () => { out.textContent = `${r.value}%`; change(k, +r.value); });
    row.append(el('span', '', label), r, out);
    ranges[k] = [r, out];
    pop.appendChild(row);
  }
  const foot = el('div', 'f'), all = el('button', '', 'All settings');
  foot.append(el('span', '', 'Saved in Oto'), all);
  pop.appendChild(foot);
  const paintPop = () => {
    swB.setAttribute('aria-checked', String(!!o.on));
    btn.setAttribute('aria-pressed', String(!!o.on && !userOff));
    pop.classList.toggle('off', !o.on);
    for (const k in ranges) { const [r, out] = ranges[k]; if (doc.activeElement !== r) r.value = String(o[k]); out.textContent = `${o[k]}%`; }
  };
  swB.addEventListener('click', () => change('on', !o.on));
  all.addEventListener('click', () => { wantOpen = true; pop.hidden = true; });
  const openPop = (v) => { pop.hidden = !v; btn.setAttribute('aria-expanded', String(v)); if (v) paintPop(); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); openPop(pop.hidden); });
  // inside the panel, clicks and keys stay in the panel (YouTube would pause, seek or change the volume)
  for (const t of ['click', 'mousedown', 'mouseup', 'dblclick', 'keydown', 'keyup', 'wheel', 'pointerdown']) pop.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') { openPop(false); btn.focus(); } });
  doc.addEventListener('mousedown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) openPop(false); }, true);
  // YouTube rebuilds its controls now and then: put the button back when it goes
  const mountButton = () => {
    const p = player();
    const bar = p && p.querySelector('.ytp-right-controls');
    if (!o.button || !bar || !/^\/watch/.test(location.pathname)) { btn.remove(); pop.remove(); return; }
    const gear = bar.querySelector('.ytp-settings-button');
    const where = gear && gear.parentNode ? gear.parentNode : bar; // YouTube sometimes groups its buttons
    if (btn.parentNode !== where) where.insertBefore(btn, gear && gear.parentNode === where ? gear : where.firstChild);
    if (pop.parentNode !== p) p.appendChild(pop);
    if (!style.isConnected) doc.head.appendChild(style);
    btn.setAttribute('aria-pressed', String(!!o.on && !userOff));
  };
  let mountT = 0;
  const mountTick = () => { mountButton(); mountT = setTimeout(mountTick, 1000); };

  const set = (next) => {
    o = { ...D, ...(next || {}) };
    looks();
    const v = !!o.on;
    if (v !== enabled) { enabled = v; if (v) add(); else remove(); } else if (v) check();
    clearTimeout(mountT); if (o.button) mountTick(); else { btn.remove(); pop.remove(); }
    if (!pop.hidden) paintPop();
  };
  // Oto collects what was changed in the panel (and whether "All settings" was pressed), checks it and saves it
  const take = () => {
    const r = { changes: { ...changes }, open: wantOpen };
    for (const k in changes) delete changes[k];
    wantOpen = false;
    return Object.keys(r.changes).length || r.open ? r : null;
  };
  // For the glow around Oto's own window: a small copy of the current frame (128 x 72 colour points, nothing else),
  // where the picture sits in the page, and how the light is built (copies, reach, blur, fade). Oto builds the same
  // light around the page, so it carries on into Oto's sidebar and bars. null while there is no glow.
  const small = doc.createElement('canvas'); small.width = 128; small.height = 72;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const frame = () => {
    if (!shown || !enabled || !geo) return null;
    let d;
    try { sctx.drawImage(cv, 0, 0, 128, 72); d = sctx.getImageData(0, 0, 128, 72).data; } catch (e) { return null; }
    let bin = '';
    for (let i = 0; i < d.length; i += 4) bin += String.fromCharCode(d[i], d[i + 1], d[i + 2]);
    return { w: 128, h: 72, rgb: btoa(bin), pic: geo.pic.map((v) => Math.round(v)), ex: Math.round(geo.ex), step: geo.step, outer: geo.outer, inner: geo.inner,
      blur: Math.round(geo.pic[3] * 0.0025 * n(o.blur, 0, 100, 30)), fadeStart: n(o.fadeStart, -50, 100, 15), fadeCurve: n(o.fadeCurve, 1, 100, 35),
      strength: n(o.strength, 0, 100, 85) / 100, bright: n(o.brightness, 50, 150, 100) / 100, colors: n(o.colors, 0, 200, 135) / 100 };
  };
  window.__otoAmbient = { set, take, frame };
  set(o0);
  return 'installed';
}
