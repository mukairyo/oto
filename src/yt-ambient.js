'use strict';
/* Oto — YouTube ambient light.
 *
 * A soft glow in the video's own colours spreads out around the player and over the page, and follows the picture as
 * it changes. Written for Oto (not taken from any extension).
 *
 * How: a small canvas (64 x 36 pixels) behind the page gets the current video frame drawn into it, and the browser
 * stretches and blurs it far past the player's edges. Nothing is read back from the canvas: the picture only goes
 * from the video onto the screen, so it needs no permissions and works with Shield's fingerprint protection.
 *
 * otoYtAmbient(opts) is run in YouTube pages by the renderer (src/v1j.js, wv.executeJavaScript): it installs once
 * per page, and later calls change the settings or switch it off. Settings (Shield › YouTube › Ambient light):
 *   on          switched on
 *   strength    0–100: how bright the glow is
 *   blur        0–100: how soft
 *   spread      0–200: how far past the player it reaches (100 = normal)
 *   fade        milliseconds the glow takes to appear and disappear
 *   layouts     'all' | 'normal' | 'theater': which player sizes get it
 *   light       also in YouTube's light theme (normally only the dark theme, where a glow reads best)
 * Only on watch pages. Hidden in fullscreen (the video fills the screen), in the mini-player, for videos with copy
 * protection (they draw black) and while the tab is in the background. YouTube's own, much smaller "ambient mode"
 * glow is hidden while Oto's is on.
 */
const OTO_AMBIENT_DEFAULTS = { on: true, strength: 85, blur: 45, spread: 100, fade: 600, layouts: 'all', light: false };
function otoYtAmbient(opts) {
  const D = { on: true, strength: 85, blur: 45, spread: 100, fade: 600, layouts: 'all', light: false }; // = OTO_AMBIENT_DEFAULTS (this function runs inside the page on its own)
  const A = window.__otoAmbient;
  if (A) { A.set(opts); return 'updated'; }
  const o0 = { ...D, ...(opts || {}) };
  if (!o0.on) return 'off';
  const doc = document, W = 64, H = 36, FPS = 30;
  const layer = doc.createElement('div'), cv = doc.createElement('canvas');
  layer.id = 'oto-ambient';
  layer.setAttribute('aria-hidden', 'true');
  cv.width = W; cv.height = H;
  layer.appendChild(cv);
  const ctx = cv.getContext('2d', { alpha: false, desynchronized: true });
  const style = doc.createElement('style');
  style.id = 'oto-ambient-css';
  style.textContent = `
html[oto-ambient] ytd-app{background:transparent!important;position:relative;z-index:1}
html[oto-ambient] #cinematics,html[oto-ambient] #cinematics-container{display:none!important}
#oto-ambient{position:absolute;left:0;top:0;width:0;height:0;z-index:0;pointer-events:none;opacity:0;transition:opacity var(--oa-fade,600ms) ease;contain:layout style size}
#oto-ambient.on{opacity:var(--oa-strength,.85)}
#oto-ambient canvas{position:absolute;left:calc(-1*var(--oa-x,10%));top:calc(-1*var(--oa-y,14%));width:calc(100% + 2*var(--oa-x,10%));height:calc(100% + 2*var(--oa-y,14%));filter:blur(var(--oa-blur,70px)) saturate(1.35)}
html[oto-ambient] #movie_player,html[oto-ambient] .html5-video-player,html[oto-ambient] #full-bleed-container,html[oto-ambient] #player-full-bleed-container,html[oto-ambient] #player-container-outer,html[oto-ambient] #player-container-inner,html[oto-ambient] #ytd-player,html[oto-ambient] #container.ytd-player{background:transparent!important}`;
  let o = o0, enabled = false, timer = 0, lastDraw = 0, video = null, rvfc = 0, shown = false;
  const looks = () => {
    const n = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    const sp = n(o.spread, 0, 200, 100) / 100, s = layer.style;
    s.setProperty('--oa-strength', String(n(o.strength, 0, 100, 85) / 100));
    s.setProperty('--oa-blur', `${Math.round(12 + n(o.blur, 0, 100, 45) * 1.3)}px`);
    s.setProperty('--oa-x', `${(10 * sp).toFixed(1)}%`); s.setProperty('--oa-y', `${(14 * sp).toFixed(1)}%`);
    s.setProperty('--oa-fade', `${n(o.fade, 0, 5000, 600)}ms`);
  };

  const player = () => doc.querySelector('ytd-watch-flexy:not([hidden]) #movie_player');
  const usable = () => {
    if (!enabled || doc.hidden || doc.fullscreenElement) return false;
    if (!/^\/watch/.test(location.pathname) || (!o.light && !doc.documentElement.hasAttribute('dark'))) return false;
    const p = player();
    if (!p || p.classList.contains('ytp-player-minimized')) return false;
    const theater = !!doc.querySelector('ytd-watch-flexy[theater]:not([hidden]), ytd-watch-flexy[full-bleed-player]:not([hidden])');
    if ((o.layouts === 'normal' && theater) || (o.layouts === 'theater' && !theater)) return false;
    const v = p.querySelector('video.html5-main-video');
    return v && v.videoWidth > 0 ? v : false;
  };
  // the glow follows the picture itself: in theatre mode the player is wider than the video (the bars at the sides
  // are made see-through above, so the glow fills them)
  const place = () => {
    const p = player();
    if (!p) return;
    const pr = p.getBoundingClientRect();
    let r = pr;
    if (video && video.videoWidth && video.videoHeight) {
      const k = Math.min(pr.width / video.videoWidth, pr.height / video.videoHeight), w = video.videoWidth * k, h = video.videoHeight * k;
      r = { left: pr.left + (pr.width - w) / 2, top: pr.top + (pr.height - h) / 2, width: w, height: h };
    }
    const s = layer.style;
    s.left = `${r.left + scrollX}px`; s.top = `${r.top + scrollY}px`; s.width = `${r.width}px`; s.height = `${r.height}px`;
  };
  const draw = () => {
    if (!video) return;
    try { ctx.drawImage(video, 0, 0, W, H); } catch (e) {}
    lastDraw = performance.now();
  };
  const onFrame = () => {
    rvfc = 0;
    if (!video || !shown) return;
    if (performance.now() - lastDraw >= 1000 / FPS - 2) draw();
    rvfc = video.requestVideoFrameCallback(onFrame);
  };
  const show = (v) => {
    if (video !== v) {
      if (video && rvfc) { video.cancelVideoFrameCallback(rvfc); rvfc = 0; }
      video = v;
    }
    if (!layer.isConnected) doc.body.prepend(layer);
    if (!style.isConnected) doc.head.appendChild(style);
    clearTimeout(gone);
    doc.documentElement.setAttribute('oto-ambient', '');
    place();
    if (!shown) { shown = true; draw(); layer.classList.add('on'); }
    if (!rvfc && video.requestVideoFrameCallback) rvfc = video.requestVideoFrameCallback(onFrame);
  };
  // the glow fades out first; YouTube's own background comes back once it has gone
  let gone = 0;
  const hide = () => {
    if (!shown) return;
    shown = false;
    layer.classList.remove('on');
    if (video && rvfc) { video.cancelVideoFrameCallback(rvfc); rvfc = 0; }
    clearTimeout(gone);
    gone = setTimeout(() => { if (!shown) doc.documentElement.removeAttribute('oto-ambient'); }, Math.max(0, Number(o.fade) || 0));
  };
  const check = () => { const v = usable(); if (v) show(v); else hide(); }; // show() also re-places the glow
  // a still picture (paused, seeking) still needs a fresh frame
  const still = (e) => { if (shown && e.target === video) draw(); };
  const tick = () => { check(); timer = setTimeout(tick, 700); }; // the page changes without telling (theatre mode, layout, new video)
  const events = [['resize', () => shown && place()], ['yt-navigate-finish', check], ['fullscreenchange', check], ['visibilitychange', check]];
  const add = () => { for (const [n, f] of events) addEventListener(n, f, true); doc.addEventListener('seeked', still, true); doc.addEventListener('loadeddata', still, true); tick(); };
  const remove = () => { for (const [n, f] of events) removeEventListener(n, f, true); doc.removeEventListener('seeked', still, true); doc.removeEventListener('loadeddata', still, true); clearTimeout(timer); hide(); };
  const set = (next) => {
    o = { ...D, ...(next || {}) };
    looks();
    const v = !!o.on;
    if (v !== enabled) { enabled = v; if (v) add(); else remove(); } else if (v) check();
  };
  window.__otoAmbient = { set };
  set(o0);
  return 'installed';
}
