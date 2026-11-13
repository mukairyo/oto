// Oto — tiny preload for web pages (runs before the page's own scripts).
// Google sign-in refuses browsers whose `window.chrome` object is empty, which is how plain Electron looks
// ("This browser or app may not be secure"). On Google's sign-in pages only, fill in the standard Chrome
// properties so signing in works like in Chrome.
// Also: sites set to "Autoplay: Block" in Site permissions don't start video or sound until you click the page.
// YouTube: the ads are removed from the player's data before the player reads it (like uBlock Origin does),
// and if an ad still starts, it is skipped.
// Fingerprint protection: canvas (also off-screen), WebGL and audio readouts get tiny changes that are the same on
// one site for one session and different everywhere else, so sites can't recognise this PC by them. The battery
// answer is the one a desktop PC gives, and the PDF plugin's internal file name differs per site (see below).
// CPU cores: each site gets a common number (4 or 8, never more than the PC has); languages: only the main one.
// This file runs in every frame, also frames from other sites inside a page (where trackers usually sit); a frame
// gets the changes of the site you are on. Background workers get the same: main/worker-guard.js runs otoFarble
// inside dedicated workers, and this file is also the preload of service workers (see the end of the file).
// Nothing is read from the page.
'use strict';
const inPage = typeof window !== 'undefined' && typeof document !== 'undefined';
if (inPage) try {
  const host = location.hostname;
  if (/(^|\.)accounts\.google\.com$/.test(host) || /(^|\.)accounts\.youtube\.com$/.test(host)) {
    const { contextBridge, webFrame } = require('electron');
    const fill = () => {
      const c = window.chrome || {};
      if (!c.app) {
        c.app = {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getDetails() { return null; }, getIsInstalled() { return false; }, runningState() { return 'cannot_run'; },
        };
      }
      if (!c.runtime) {
        c.runtime = {
          OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
          RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
          connect() { throw new TypeError('Error in invocation of runtime.connect'); },
          sendMessage() { throw new TypeError('Error in invocation of runtime.sendMessage'); },
          id: undefined,
        };
      }
      if (!c.csi) {
        c.csi = function csi() { const t = performance.timing; return { onloadT: t.domContentLoadedEventEnd, startE: t.navigationStart, pageT: performance.now(), tran: 15 }; };
      }
      if (!c.loadTimes) {
        c.loadTimes = function loadTimes() {
          const t = performance.timing, s = (v) => v / 1000;
          return { requestTime: s(t.navigationStart), startLoadTime: s(t.navigationStart), commitLoadTime: s(t.responseStart), finishDocumentLoadTime: s(t.domContentLoadedEventEnd), finishLoadTime: s(t.loadEventEnd), firstPaintTime: s(t.responseEnd), firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true, npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2' };
        };
      }
      try { Object.defineProperty(window, 'chrome', { value: c, writable: true, configurable: true, enumerable: true }); } catch { window.chrome = c; }
    };
    if (contextBridge && contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: fill });
    else if (webFrame) webFrame.executeJavaScript(`(${fill.toString()})()`);
  }
} catch {}

// Autoplay: Block — media only plays once you've clicked or typed on the page.
// Cookies: Block — the page can't write cookies (ones sent by the server are removed by Oto right away).
if (inPage) try {
  const { ipcRenderer, contextBridge, webFrame } = require('electron');
  const run = (fn, ...args) => { if (contextBridge && contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: fn, args }); else if (webFrame) webFrame.executeJavaScript(`(${fn.toString()})(...${JSON.stringify(args)})`); };
  const site = ipcRenderer.sendSync('oto:page', location.origin) || {};
  if (site.cookies) {
    run(() => {
      try { Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get() { return ''; }, set() {} }); } catch (e) {}
      try { if (window.cookieStore) window.cookieStore.set = () => Promise.resolve(); } catch (e) {}
    });
  }
  if (site.fp) run(otoFarble, site.fp, !!site.fpStrict);
  if (site.yt) run(otoYouTubeAds);
  if (site.autoplay) {
    const hold = () => {
      const P = HTMLMediaElement.prototype, play = P.play;
      const ok = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
      P.play = function () { if (!ok()) { try { this.pause(); } catch (e) {} return Promise.reject(new DOMException('Autoplay is blocked for this site in Oto', 'NotAllowedError')); } return play.apply(this, arguments); };
      document.addEventListener('play', (e) => { const m = e.target; if (!ok() && m && typeof m.pause === 'function') m.pause(); }, true);
    };
    run(hold);
  }
} catch {}

// Runs in the page. `seed` is per site and per session (main.js). Changes are tiny (a few lowest bits) and
// always the same for the same picture or sound on the same site, so pages still work and look right.
function otoFarble(seed, strict) {
  const done = new WeakSet();
  const natives = new WeakMap();
  const nativeToString = Function.prototype.toString;
  const fakeToString = function toString() { return natives.has(this) ? natives.get(this) : nativeToString.call(this); };
  const mix = (n) => { let x = (n ^ seed) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; return (x ^ (x >>> 16)) >>> 0; };
  // Which pixels change depends on the site, the session AND the picture itself. With a fixed pattern a script could
  // draw a plain test picture, see which pixels moved, and undo the same changes in its real fingerprint picture.
  const noisePixels = (d) => {
    let k = d.length >>> 0;
    if (d.byteOffset % 4 === 0 && d.length % 4 === 0) { const p = new Uint32Array(d.buffer, d.byteOffset, d.length >>> 2); for (let i = 0; i < p.length; i++) k = Math.imul(k ^ p[i], 0x01000193); } // a whole pixel at a time
    else for (let i = 0; i + 3 < d.length; i += 4) k = Math.imul(k ^ (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)), 0x01000193);
    k = mix(k >>> 0);
    for (let i = 0; i < d.length; i += 4) { const m = mix(i ^ k); if ((m & 15) === 0) { const c = i + (m >>> 4) % 3; d[c] = d[c] ^ 1; } }
  };
  function patch(w) {
    try {
      if (!w || done.has(w)) return;
      done.add(w);
      // a replaced function keeps the original's name and number of arguments
      const like = (fn, orig) => { try { Object.defineProperty(fn, 'name', { value: orig.name, configurable: true }); Object.defineProperty(fn, 'length', { value: orig.length, configurable: true }); } catch (e) {} };
      const swap = (obj, name, make) => {
        const desc = Object.getOwnPropertyDescriptor(obj, name);
        if (!desc || typeof desc.value !== 'function') return;
        const orig = desc.value, fn = make(orig);
        natives.set(fn, nativeToString.call(orig));
        like(fn, orig);
        Object.defineProperty(obj, name, { ...desc, value: fn });
      };
      const getter = (obj, name, make) => {
        const desc = Object.getOwnPropertyDescriptor(obj, name);
        if (!desc || !desc.get) return;
        const fn = make(desc.get);
        natives.set(fn, nativeToString.call(desc.get));
        like(fn, desc.get);
        Object.defineProperty(obj, name, { ...desc, get: fn });
      };
      const inWorker = typeof w.document === 'undefined';
      w.Function.prototype.toString = fakeToString;
      natives.set(fakeToString, nativeToString.call(nativeToString));
      // 2D canvas
      const C2D = w.CanvasRenderingContext2D && w.CanvasRenderingContext2D.prototype;
      const getImageData = C2D && C2D.getImageData;
      if (C2D) swap(C2D, 'getImageData', (orig) => function getImageData() { const img = orig.apply(this, arguments); try { noisePixels(img.data); } catch (e) {} return img; });
      const copyNoisy = (canvas) => {
        const w2 = canvas.width, h2 = canvas.height;
        if (!w2 || !h2 || w2 * h2 > 16e6) return null;
        const c = w.document.createElement('canvas'); c.width = w2; c.height = h2;
        const x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
        const img = getImageData.call(x, 0, 0, w2, h2); noisePixels(img.data); x.putImageData(img, 0, 0);
        return c;
      };
      const HC = w.HTMLCanvasElement && w.HTMLCanvasElement.prototype;
      if (HC) {
        swap(HC, 'toDataURL', (orig) => function toDataURL() { let c = null; try { c = copyNoisy(this); } catch (e) {} return orig.apply(c || this, arguments); });
        swap(HC, 'toBlob', (orig) => function toBlob() { let c = null; try { c = copyNoisy(this); } catch (e) {} return orig.apply(c || this, arguments); });
      }
      // Off-screen canvas: the same picture can be drawn and read without ever being on the page
      const O2D = w.OffscreenCanvasRenderingContext2D && w.OffscreenCanvasRenderingContext2D.prototype;
      const offGet = O2D && O2D.getImageData;
      if (O2D) swap(O2D, 'getImageData', (orig) => function getImageData() { const img = orig.apply(this, arguments); try { noisePixels(img.data); } catch (e) {} return img; });
      const OC = w.OffscreenCanvas && w.OffscreenCanvas.prototype;
      if (OC && offGet) {
        swap(OC, 'convertToBlob', (orig) => function convertToBlob() {
          let c = null;
          try {
            const w2 = this.width, h2 = this.height;
            if (w2 && h2 && w2 * h2 <= 16e6) { c = new w.OffscreenCanvas(w2, h2); const x = c.getContext('2d'); x.drawImage(this, 0, 0); const img = offGet.call(x, 0, 0, w2, h2); noisePixels(img.data); x.putImageData(img, 0, 0); }
          } catch (e) { c = null; }
          return orig.apply(c || this, arguments);
        });
      }
      // WebGL: tiny changes to read-back pixels. The graphics-card name stays real: a made-up one is exactly what
      // "are you human?" checks (Cloudflare, used by ChatGPT and many others) look for, and they lock you out.
      for (const G of [w.WebGLRenderingContext, w.WebGL2RenderingContext]) {
        if (!G) continue;
        const P = G.prototype;
        swap(P, 'readPixels', (orig) => function readPixels() { const r = orig.apply(this, arguments); try { const d = arguments[6]; if (d && d.BYTES_PER_ELEMENT === 1) noisePixels(d); } catch (e) {} return r; });
      }
      // Audio
      const AB = w.AudioBuffer && w.AudioBuffer.prototype;
      if (AB) {
        const seen = new WeakSet();
        const nativeGet = AB.getChannelData;
        // The changes are made once, in the sound data itself, so every way of reading it gives the same answer.
        // A volume factor between 0.99 and 1 (far too small to hear) gives every site and session its own values;
        // a few samples also move by about a millionth, so the factor can't simply be divided out again. Silence
        // stays silence. (Changing only a few samples by less than the data can store gave two sites the same
        // values far too often; the end-to-end test caught that.)
        const gain = 1 - (mix(0x9e3779b9) / 4294967296) * 0.01;
        const noised = (buf, ch) => {
          const d = nativeGet.call(buf, ch);
          try {
            if (!seen.has(d)) {
              seen.add(d);
              for (let i = 0; i < d.length; i++) d[i] *= gain;
              for (let i = 0; i < d.length; i += 31) if (d[i] !== 0) d[i] += ((mix(i) >>> 8) / 16777216 - 0.5) * 2e-6;
            }
          } catch (e) {}
          return d;
        };
        swap(AB, 'getChannelData', () => function getChannelData(channel) { return arguments.length ? noised(this, channel) : nativeGet.apply(this, arguments); });
        swap(AB, 'copyFromChannel', (orig) => function copyFromChannel(destination, channelNumber) { try { noised(this, channelNumber); } catch (e) {} return orig.apply(this, arguments); });
      }
      const AN = w.AnalyserNode && w.AnalyserNode.prototype;
      if (AN) {
        swap(AN, 'getFloatFrequencyData', (orig) => function getFloatFrequencyData(a) { orig.apply(this, arguments); try { for (let i = 0; i < a.length; i += 7) a[i] += ((mix(i) & 255) / 255 - 0.5) * 0.001; } catch (e) {} });
        swap(AN, 'getFloatTimeDomainData', (orig) => function getFloatTimeDomainData(a) { orig.apply(this, arguments); try { for (let i = 0; i < a.length; i += 7) a[i] += ((mix(i + 1) & 255) / 255 - 0.5) * 1e-6; } catch (e) {} });
      }
      // The PDF plugin's internal file name. Chrome reports the same five PDF plugins to every site, each with the
      // file name "internal-pdf-viewer", so this list identifies nobody and changing it hides nothing by itself. It
      // is varied anyway because fingerprint tests (EFF's Cover Your Tracks) count the plugin details as one of the
      // five things that must differ between sites before they call a browser's fingerprint "randomized"; Brave
      // varies them for the same reason. Only the file name changes (to the kind of name Chrome itself used for
      // years: 32 letters a to p). The plugin names, their order and the list itself stay exactly Chrome's, the
      // plugins stay the browser's real objects, and every way of reaching a plugin gives the same answer.
      const PL = w.Plugin && w.Plugin.prototype;
      if (PL) {
        let file = '';
        for (let i = 0; i < 32; i++) file += String.fromCharCode(97 + (mix(0x70646600 + i) & 15));
        getter(PL, 'filename', (orig) => function filename() { const real = orig.call(this); return real === 'internal-pdf-viewer' ? file : real; });
      }
      // Battery: level and charging times can link two sites visited at the same moment. Every site gets the answer
      // of a desktop PC on mains power (a real, common answer; nothing made up).
      const BM = w.BatteryManager && w.BatteryManager.prototype;
      if (BM) {
        getter(BM, 'charging', () => function charging() { return true; });
        getter(BM, 'level', () => function level() { return 1; });
        getter(BM, 'chargingTime', () => function chargingTime() { return 0; });
        getter(BM, 'dischargingTime', () => function dischargingTime() { return Infinity; });
      }
      // CPU cores: a common number per site, 4 or 8 (never more than this PC has; a PC with fewer keeps its own).
      // The page, its frames and its workers all get the same number (workers through main/worker-guard.js), so a
      // page never sees two different answers. Memory stays as Chromium reports it (already rounded, at most 8).
      const NV = (w.WorkerNavigator && inWorker ? w.WorkerNavigator : w.Navigator);
      if (NV && NV.prototype) getter(NV.prototype, 'hardwareConcurrency', (orig) => function hardwareConcurrency() {
        const real = orig.call(this);
        const opts = [4, 8].filter((n) => n <= real);
        return opts.length ? opts[mix(0x636f7265) % opts.length] : real;
      });
      // Languages: only your main language, like Brave. The full list (e.g. Greek, Greek (Greece), English) is rarer
      // than the first entry alone, and Oto's request headers already send only that one. Pages use the first entry
      // to pick a language, so nothing changes for them. Same list object every time, like Chrome.
      if (NV && NV.prototype) getter(NV.prototype, 'languages', (orig) => {
        let from = null, list = null;
        return function languages() {
          const real = orig.call(this);
          if (!real || !real.length) return real;
          if (real !== from) { from = real; list = Object.freeze([real[0]]); }
          return list;
        };
      });
      // Strict level only: two more details that can tell people apart and that a few sites do use.
      if (strict && !inWorker) {
        // Keyboard layout (Greek, US, German...): the layout map is refused, as Chrome itself refuses it inside frames.
        const KB = w.Keyboard && w.Keyboard.prototype;
        if (KB) swap(KB, 'getLayoutMap', () => function getLayoutMap() { return Promise.reject(new w.DOMException('getLayoutMap() must be called from a top-level browsing context or allowed by the permission policy.', 'SecurityError')); });
        // Read-aloud voices show which Windows language packs are installed. Only voices in your main language are
        // listed (if there are none, only the default voice).
        const SS = w.SpeechSynthesis && w.SpeechSynthesis.prototype;
        if (SS) swap(SS, 'getVoices', (orig) => function getVoices() {
          const all = orig.apply(this, arguments);
          try {
            const main = String((w.navigator.language || '')).split('-')[0].toLowerCase();
            const mine = all.filter((v) => String(v.lang || '').split(/[-_]/)[0].toLowerCase() === main);
            return mine.length ? mine : all.filter((v) => v.default).slice(0, 1);
          } catch (e) { return all; }
        });
      }
      // Frames made by script (about:blank) get the same protection when the page reaches into them
      const IF = w.HTMLIFrameElement && w.HTMLIFrameElement.prototype;
      if (IF) {
        getter(IF, 'contentWindow', (orig) => function contentWindow() { const cw = orig.call(this); try { if (cw && cw.document) patch(cw); } catch (e) {} return cw; });
        getter(IF, 'contentDocument', (orig) => function contentDocument() { const cd = orig.call(this); try { if (cd && cd.defaultView) patch(cd.defaultView); } catch (e) {} return cd; });
      }
    } catch (e) {}
  }
  patch(typeof window !== 'undefined' ? window : self);
}

// Runs in YouTube pages before YouTube's own scripts.
function otoYouTubeAds() {
  const KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'];
  const strip = (o) => { if (o && typeof o === 'object') for (const k of KEYS) if (k in o) { try { delete o[k]; } catch (e) {} } };
  const prune = (o) => {
    try {
      if (!o || typeof o !== 'object') return o;
      strip(o); strip(o.playerResponse);
      if (Array.isArray(o)) for (const x of o) if (x && typeof x === 'object') strip(x.playerResponse);
    } catch (e) {}
    return o;
  };
  const disguise = (fn, orig) => { try { const s = Function.prototype.toString.call(orig); Object.defineProperty(fn, 'toString', { value: () => s, configurable: true }); } catch (e) {} return fn; };
  const jp = JSON.parse;
  JSON.parse = disguise(function parse() { return prune(jp.apply(this, arguments)); }, jp);
  const rj = Response.prototype.json;
  Response.prototype.json = disguise(function json() { return rj.apply(this, arguments).then(prune); }, rj);
  // The first video's data is written straight into the page
  for (const name of ['ytInitialPlayerResponse', 'playerResponse']) {
    let val;
    try { Object.defineProperty(window, name, { configurable: true, get() { return val; }, set(v) { val = prune(v); } }); } catch (e) {}
  }
  // Safety net: if an ad still starts, jump to its end and press Skip; sound comes back for the real video.
  let mutedByOto = false;
  setInterval(() => {
    try {
      const p = document.querySelector('.html5-video-player');
      if (!p) return;
      const v = p.querySelector('video');
      if (p.classList.contains('ad-showing')) {
        if (v && !v.muted) { v.muted = true; mutedByOto = true; }
        if (v && isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.1) v.currentTime = v.duration;
        const b = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button');
        if (b) b.click();
      } else if (mutedByOto && v) { v.muted = false; mutedByOto = false; }
    } catch (e) {}
  }, 250);
}

// Service workers (scripts a site leaves running in the background) get the same protection: main.js registers this
// file as their preload too. The per-site number comes from the site the service worker belongs to.
const processKind = typeof process === 'object' && process ? process.type : '';
if (processKind === 'service-worker') try {
  const { ipcRenderer, contextBridge } = require('electron');
  const seed = ipcRenderer.sendSync('oto:worker');
  if (seed && contextBridge && contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: otoFarble, args: [seed] });
} catch {}

// main.js (and the tests) load this file too, outside any page, to run the same protection inside background workers.
if (!inPage && processKind !== 'service-worker' && typeof module === 'object' && module && module.exports) module.exports = { otoFarble };
