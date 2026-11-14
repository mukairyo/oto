'use strict';
// Oto end-to-end tests: harmless local test sites. No outside network, no real services.
// HTTP sites are "<name>.site", HTTPS sites "<name>.sec" (self-signed certificate made at run time, so Oto must show
// its certificate warning). Oto is told (host-resolver-rules) that these names, live here ("tracker.site" plays a tracker: real tracker hosts
// like google-analytics.com are HTTPS-only in Chromium, so they can't be served locally).
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const page = (title, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:15px sans-serif;padding:30px">${body}</body>`;
const SITES = {
  'news.site': () => page('News', `<h1>News</h1><p>Normal page with trackers.</p>
    <script src="http://tracker.site/analytics.js"></script><img src="http://tracker.site/collect?v=1">`),
  'fine.site': () => page('Fine', '<h1>A normal site</h1><a id="dl" href="/report.pdf" download>report</a> <a id="nt" href="/slow.bin" target="_blank">get the file</a>'),
  'evil.site': () => page('Evil', '<h1>Pretend malware site</h1>'),
  'login.site': () => page('Login', `<form id="f" method="post" action="/done"><input id="u" name="u" autocomplete="username"><input id="p" name="p" type="password"><button>Sign in</button></form>`),
  'nav.site': () => page('Nav', '<h1>Navigation tests</h1>'),
  // What an ad-block tester checks on its own page (written for these tests, after adblock.turtlecute.org): two
  // stand-in ad scripts served by the site itself, an ad-shaped box in the page and one added later. Each script sets
  // a variable when it runs; a box counts as hidden when it has no height. A normal script and box are the controls.
  'adblock.turtlecute.org': () => adTester(),
  'adtest.site': () => adTester(), // the same page on another site: the tester-only script rule must not apply here
  // Pages that load a session recorder from another site ("recorder.site") in every way a page can ask for something.
  // quiet.site and private.site tell the browser not to say where requests come from (no Referer header).
  'open.site': () => recorderUser(),
  'quiet.site': () => ({ html: recorderUser(), headers: { 'Referrer-Policy': 'no-referrer' } }),
  'private.site': () => ({ html: recorderUser(), headers: { 'Referrer-Policy': 'same-origin' } }),
  // What a fingerprinting script can read (fp.site, fp2.site: two unrelated sites; each also runs the same readings
  // inside a frame from a third site, the way an embedded tracker would).
  'fp.site': () => fpPage(true), 'fp2.site': () => fpPage(true), 'fpframe.site': () => fpPage(false),
  'recorder.site': () => page('Recorder Inc.', '<h1>The recorder company\'s own website</h1><script src="/rec.js"></script>'),
};
// Every way of asking, each to its own address so the server can tell which ones arrived (see /__hits).
const recorderUser = () => page('A site that records visitors', `<h1>A site that records visitors</h1>
  <script src="http://recorder.site/rec.js?how=script"></script>
  <img src="http://recorder.site/pixel.gif?how=img" width="1" height="1">
  <iframe src="http://recorder.site/frame.html?how=frame" width="10" height="10"></iframe>
  <script>window.__res = null; addEventListener('load', async () => {
    const R = 'http://recorder.site/', tried = (p) => p.then(() => 'loaded', () => 'blocked');
    const out = { script: typeof window.__rec === 'undefined' ? 'blocked' : 'loaded' };
    out.fetch = await tried(fetch(R + 'collect?how=fetch', { mode: 'no-cors' }));
    out.fetchNoRef = await tried(fetch(R + 'collect?how=fetch-noref', { mode: 'no-cors', referrerPolicy: 'no-referrer' }));
    out.xhr = await new Promise((r) => { const x = new XMLHttpRequest(); x.open('GET', R + 'collect?how=xhr'); x.onload = () => r('loaded'); x.onerror = () => r('blocked'); x.send(); });
    out.image = await new Promise((r) => { const i = new Image(); i.onload = () => r('loaded'); i.onerror = () => r('blocked'); i.src = R + 'pixel.gif?how=image'; });
    try { navigator.sendBeacon(R + 'collect?how=beacon', 'x'); } catch (e) {}
    try { const f = document.createElement('iframe'); document.body.appendChild(f); out.blankFrame = await tried(f.contentWindow.fetch(R + 'collect?how=blank-frame', { mode: 'no-cors' })); } catch (e) { out.blankFrame = 'error ' + e.message; }
    try { out.worker = await new Promise((r) => { const w = new Worker(URL.createObjectURL(new Blob(["fetch('" + R + "collect?how=worker', { mode: 'no-cors' }).then(() => postMessage('loaded'), () => postMessage('blocked'))"]))); w.onmessage = (e) => r(e.data); setTimeout(() => r('timeout'), 3000); }); } catch (e) { out.worker = 'error ' + e.message; }
    out.own = await tried(fetch('/own-data?how=own'));
    setTimeout(() => { window.__res = out; }, 700);
  });</script>`);
// What a background worker can read: the same off-screen picture and WebGL picture the page draws, and CPU cores.
// Served as /fpworker.js; the page also starts it from a blob: and lets it start a worker of its own.
const FP_WORKER = `
const hs = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) >>> 0; return x.toString(16); };
const draw = (x) => { x.textBaseline = 'top'; x.font = "14px Arial"; x.fillStyle = '#f60'; x.fillRect(125, 1, 62, 20); x.fillStyle = '#069'; x.fillText('Oto <canvas> reading 1.0', 2, 15); x.fillStyle = 'rgba(102, 204, 0, 0.7)'; x.fillText('Oto <canvas> reading 1.0', 4, 17); };
async function readings() {
  const o = { cores: navigator.hardwareConcurrency, langs: navigator.languages.join(',') };
  try { const c = new OffscreenCanvas(240, 60); const x = c.getContext('2d'); draw(x); o.offscreenPixels = hs(String([...x.getImageData(0, 0, 240, 60).data])); o.offscreenBlob = hs(String([...new Uint8Array(await (await c.convertToBlob()).arrayBuffer())])); } catch (e) { o.offscreenPixels = 'error ' + e.message; }
  try { const gl = new OffscreenCanvas(64, 64).getContext('webgl');
    if (!gl) o.webgl = 'no WebGL here'; else {
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0,1);}')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 v;void main(){gl_FragColor=vec4(v.x*0.5+0.5,v.y*0.5+0.5,sin(v.x*9.0)*0.5+0.5,1);}')); gl.linkProgram(pr); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 0, 1]), gl.STATIC_DRAW);
      const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      const px = new Uint8Array(64 * 64 * 4); gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px); o.webglPixels = hs(String([...px]));
    } } catch (e) { o.webgl = 'error ' + e.message; }
  const f = OffscreenCanvasRenderingContext2D.prototype.getImageData, g = Object.getOwnPropertyDescriptor(WorkerNavigator.prototype, 'hardwareConcurrency').get;
  o.looks = [f.name, f.length, /\\[native code\\]/.test(Function.prototype.toString.call(f)), g.name, /\\[native code\\]/.test(Function.prototype.toString.call(g))].join('/');
  o.node = [typeof require, typeof process, typeof module, typeof Buffer].join('/');
  return o;
}
onmessage = async (e) => {
  const o = await readings();
  if (e.data === 'nest' && typeof Worker !== 'undefined') o.nested = await new Promise((r) => { const w = new Worker(location.href); w.onmessage = (m) => r(m.data); w.postMessage('plain'); setTimeout(() => r(null), 4000); });
  postMessage(o);
};`;
const fpPage = (withFrame) => page('Fingerprint readings', `<h1>Fingerprint readings</h1>${withFrame ? '<iframe id="tp" src="http://fpframe.site/" width="300" height="80"></iframe>' : ''}
  <script>
  const hs = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) >>> 0; return x.toString(16); };
  const draw = (x) => { x.textBaseline = 'top'; x.font = "14px Arial"; x.fillStyle = '#f60'; x.fillRect(125, 1, 62, 20); x.fillStyle = '#069'; x.fillText('Oto <canvas> reading 1.0', 2, 15); x.fillStyle = 'rgba(102, 204, 0, 0.7)'; x.fillText('Oto <canvas> reading 1.0', 4, 17); };
  async function readings() {
    const out = {};
    const c = document.createElement('canvas'); c.width = 240; c.height = 60; const x = c.getContext('2d'); draw(x);
    out.canvasUrl = hs(c.toDataURL()); out.canvasUrlAgain = hs(c.toDataURL()); out.canvasPixels = hs(String([...x.getImageData(0, 0, 240, 60).data]));
    out.canvasBlob = await new Promise((r) => c.toBlob(async (b) => r(hs(String([...new Uint8Array(await b.arrayBuffer())])))));
    try { const o = new OffscreenCanvas(240, 60); const ox = o.getContext('2d'); draw(ox); out.offscreenPixels = hs(String([...ox.getImageData(0, 0, 240, 60).data])); out.offscreenBlob = hs(String([...new Uint8Array(await (await o.convertToBlob()).arrayBuffer())])); } catch (e) { out.offscreenPixels = 'error ' + e.message; }
    try { const g = document.createElement('canvas'); g.width = 64; g.height = 64; const gl = g.getContext('webgl', { preserveDrawingBuffer: true });
      if (!gl) out.webgl = 'no WebGL here'; else {
        const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
        const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0,1);}')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 v;void main(){gl_FragColor=vec4(v.x*0.5+0.5,v.y*0.5+0.5,sin(v.x*9.0)*0.5+0.5,1);}')); gl.linkProgram(pr); gl.useProgram(pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 0, 1]), gl.STATIC_DRAW);
        const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
        const px = new Uint8Array(64 * 64 * 4); gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px); out.webglPixels = hs(String([...px])); out.webglUrl = hs(g.toDataURL());
      } } catch (e) { out.webgl = 'error ' + e.message; }
    try { const mk = async () => { const ac = new OfflineAudioContext(1, 5000, 44100); const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = 10000; const k = ac.createDynamicsCompressor(); k.threshold.value = -50; k.knee.value = 40; k.ratio.value = 12; k.attack.value = 0; k.release.value = 0.25; o.connect(k); k.connect(ac.destination); o.start(0); return ac.startRendering(); };
      const sum = (d) => { let s = 0; for (let i = 4500; i < 5000; i++) s += Math.abs(d[i]); return String(s); };
      out.audioCopy = await mk().then((b) => { const d = new Float32Array(5000); b.copyFromChannel(d, 0); return sum(d); }); // read WITHOUT getChannelData first
      out.audioData = await mk().then((b) => sum(b.getChannelData(0)));
    } catch (e) { out.audio = 'error ' + e.message; }
    // storage inside a frame from another site: is it shared between the sites that embed the frame?
    try { out.sawStorage = localStorage.getItem('oto-fp-test') || 'empty'; localStorage.setItem('oto-fp-test', 'written under ' + (document.referrer || location.href)); } catch (e) { out.sawStorage = 'blocked'; }
    out.langs = navigator.languages.join(','); out.langsSameObject = navigator.languages === navigator.languages; try { out.langHeader = await (await fetch('/echo-lang')).text(); } catch (e) { out.langHeader = 'error'; }
    try { out.keyboard = navigator.keyboard ? await Promise.race([navigator.keyboard.getLayoutMap().then((m) => 'layout map', (e) => e.name), new Promise((r) => setTimeout(r, 2000, 'timeout'))]) : 'no keyboard API'; } catch (e) { out.keyboard = 'error ' + e.message; }
    try { out.voices = speechSynthesis.getVoices().map((v) => v.lang).join(','); } catch (e) { out.voices = 'error'; }
    out.cores = navigator.hardwareConcurrency; out.plugins = [...navigator.plugins].map((p) => p.name).join('|'); out.agent = navigator.userAgent;
    // the plugins' internal file name, reached in every way a script can reach a plugin
    const pf = Object.getOwnPropertyDescriptor(Plugin.prototype, 'filename').get;
    out.pluginFile = navigator.plugins.length ? navigator.plugins[0].filename : 'no plugins';
    out.pluginFiles = [...new Set([...[...navigator.plugins].map((p) => p.filename), navigator.plugins.item(1).filename, navigator.plugins.namedItem('PDF Viewer').filename, navigator.plugins['Chrome PDF Viewer'].filename, navigator.mimeTypes[0].enabledPlugin.filename, navigator.mimeTypes['text/pdf'].enabledPlugin.filename, pf.call(navigator.plugins[4])])].join('|');
    // everything a script can read about the plugins, in a fixed order (fingerprint tests compare this between sites)
    out.pluginDetails = [...navigator.plugins].map((p) => [p.name, p.description, p.filename, ...[...p].map((m) => m.type + ',' + m.suffixes + ',' + m.description)].join(';')).sort().join('|');
    out.pluginLooks = [pf.name, pf.length, /\[native code\]/.test(Function.prototype.toString.call(pf)), navigator.plugins[0] instanceof Plugin, navigator.plugins instanceof PluginArray, navigator.plugins.length, (() => { try { pf.call({}); return 'no error'; } catch (e) { return e.constructor.name; } })()].join('/');
    // no Node.js or Electron in the page, also not inside frames
    out.node = [typeof require, typeof process, typeof module, typeof global, typeof Buffer].join('/');
    // replaced functions look like the originals to a script that inspects them
    const f = HTMLCanvasElement.prototype.toDataURL, g = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
    out.looks = [f.name, f.length, /\[native code\]/.test(Function.prototype.toString.call(f)), g.name, /\[native code\]/.test(String(g))].join('/');
    // battery (only exists on secure pages such as localhost): the answer of a desktop PC on mains power
    try { if (navigator.getBattery) { const b = await navigator.getBattery(); out.battery = [b.charging, b.level, b.chargingTime, b.dischargingTime].join('/'); out.batteryIs = b instanceof BatteryManager; } } catch (e) { out.battery = 'error ' + e.message; }
    try { out.workerCores = await new Promise((r) => { const w = new Worker(URL.createObjectURL(new Blob(['postMessage(navigator.hardwareConcurrency)']))); w.onmessage = (e) => r(e.data); setTimeout(() => r('timeout'), 2000); }); } catch (e) { out.workerCores = 'error'; }
    // background workers: one from the site's own address (which starts a worker of its own), one made from a blob:
    const ask = (w, msg) => new Promise((r) => { w.onmessage = (e) => r(e.data); w.onerror = () => r(null); w.postMessage(msg); setTimeout(() => r(null), 8000); });
    try { out.worker = await ask(new Worker('/fpworker.js'), 'nest'); } catch (e) { out.worker = null; }
    try { out.blobWorker = await ask(new Worker(URL.createObjectURL(new Blob([await (await fetch('/fpworker.js')).text()], { type: 'text/javascript' }))), 'plain'); } catch (e) { out.blobWorker = null; }
    return out;
  }
  window.__res = null;
  // the embedded frame may finish first: listen for its readings from the start
  const fromFrame = window.top === window && document.getElementById('tp') ? new Promise((r) => { addEventListener('message', (e) => { if (e.data && e.data.fpFrame) r(e.data.fpFrame); }); setTimeout(() => r(null), 5000); }) : null;
  addEventListener('load', async () => {
    const mine = await readings();
    if (window.top !== window) { window.top.postMessage({ fpFrame: mine }, '*'); return; }
    window.__res = { page: mine, frame: await fromFrame };
  });
  </script>`);
const HITS = {}; // "how" -> how many requests of that kind reached recorder.site
const adTester = () => page('Ad-block tester (local)', `<h1>Ad-block tester</h1>
  <div id="cts_test" class="textads adsbox banner_ads adbox ADBox AdBox adbox-wrapper adSocial ">&nbsp;</div><div id="ctd_test"></div><div id="normal_box" class="article-box">&nbsp;</div>
  <script defer src="./js/widget/ads.js"></script><script defer src="./js/pagead.js"></script><script defer src="./js/app.js"></script>
  <script>window.__res = null; addEventListener('DOMContentLoaded', () => {
    const ad = document.createElement('div'); ad.id = 'ad_ctd'; ad.className = 'textads banner-ads banner_ads ad-unit afs_ads ad-zone ad-space adsbox'; ad.innerHTML = '&nbsp;'; document.querySelector('#ctd_test').appendChild(ad);
    const pic = new Promise((r) => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = './widget/ads.png'; });
    setTimeout(async () => {
      const h = (id) => { const e = document.getElementById(id); return !e || !(e.clientHeight || e.offsetHeight); };
      window.__res = { adsBlocked: typeof s_test_ads === 'undefined', pageadBlocked: typeof s_test_pagead === 'undefined', appLoaded: typeof app_ok !== 'undefined',
        staticHidden: h('cts_test'), dynamicHidden: h('ad_ctd'), normalBoxShown: !h('normal_box'), pictureLoaded: await pic };
    }, 1500);
  });</script>`);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
function handler(req, res) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase().replace(/\.$/, '').replace(/\.sec$/, '.site');
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__hits') { const out = JSON.stringify(HITS); if (url.searchParams.get('reset')) for (const k of Object.keys(HITS)) delete HITS[k]; res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(out); }
  if (host === 'recorder.site' && url.pathname !== '/') {
    const how = `${url.searchParams.get('how') || 'own'}@${String(req.headers.referer || '').replace(/^https?:\/\//, '').split('/')[0] || 'no-referer'}`;
    HITS[how] = (HITS[how] || 0) + 1;
    if (url.pathname === '/rec.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end('window.__rec = 1;'); }
    if (url.pathname === '/pixel.gif') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
    res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' }); return res.end('ok');
  }
  if (url.pathname === '/fpshared.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(FP_WORKER + '\nonconnect = (e) => { const p = e.ports[0]; p.onmessage = async () => p.postMessage(await readings()); };'); }
  if (url.pathname === '/fpsw.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(FP_WORKER + '\nonmessage = null; addEventListener("message", async (e) => e.source.postMessage(await readings()));'); }
  if (url.pathname === '/fpworkers.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(page('Workers', '<h1>Workers</h1><script>window.__res = null; addEventListener("load", async () => { const out = {};'
    + 'try { const sw = new SharedWorker("/fpshared.js"); out.shared = await new Promise((r) => { sw.port.onmessage = (e) => r(e.data); sw.port.postMessage("go"); setTimeout(() => r(null), 8000); }); } catch (e) { out.shared = "error " + e.message; }'
    + 'try { if (navigator.serviceWorker) { const reg = await navigator.serviceWorker.register("/fpsw.js"); await navigator.serviceWorker.ready; const w = reg.active; out.service = await new Promise((r) => { navigator.serviceWorker.onmessage = (e) => r(e.data); w.postMessage("go"); setTimeout(() => r(null), 8000); }); await reg.unregister(); } else out.service = "no service workers on this page"; } catch (e) { out.service = "error " + e.message; }'
    + 'try { const o = new OffscreenCanvas(240, 60); const x = o.getContext("2d"); x.textBaseline = "top"; x.font = "14px Arial"; x.fillStyle = "#f60"; x.fillRect(125, 1, 62, 20); x.fillStyle = "#069"; x.fillText("Oto <canvas> reading 1.0", 2, 15); x.fillStyle = "rgba(102, 204, 0, 0.7)"; x.fillText("Oto <canvas> reading 1.0", 4, 17); const d = x.getImageData(0, 0, 240, 60).data; let h = 0; const s = String([...d]); for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0; out.offscreenPixels = h.toString(16); } catch (e) {}'
    + 'out.cores = navigator.hardwareConcurrency; window.__res = out; });</script>')); }
  // A stand-in for a YouTube watch page (the parts Oto's ambient light uses): dark theme, ytd-app, ytd-watch-flexy,
  // #movie_player and a playing video. The video plays a canvas whose colour the test changes (window.__paint).
  if (host === 'yt.site' && url.pathname === '/watch') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`<!doctype html><html dark><head><title>Watch</title><style>html{background:#0f0f0f}body{margin:0}ytd-app{display:block;background:#0f0f0f;min-height:100vh}#movie_player{position:relative;width:640px;height:360px;margin:60px 0 0 40px;background:#000}ytd-watch-flexy[theater] #movie_player{width:1000px;margin-left:0}video{width:100%;height:100%;object-fit:contain}#below{height:300px;color:#fff}</style></head>
<body><ytd-app><div id="masthead-container"><ytd-masthead><div id="background" style="background:#0f0f0f;opacity:1"></div><div id="frosted-glass" style="backdrop-filter:blur(48px);background:rgba(15,15,15,.7)"></div>Top bar</ytd-masthead></div><ytd-watch-flexy><div id="movie_player" class="html5-video-player"><video class="html5-main-video" muted playsinline></video><div class="ytp-chrome-bottom" style="position:absolute;right:0;bottom:0"><div class="ytp-right-controls"><button class="ytp-button ytp-subtitles-button">CC</button><button class="ytp-button ytp-settings-button">S</button></div></div></div><div id="columns"><div id="below">Title<input id="q"></div></div><div id="cinematics">youtube glow</div></ytd-watch-flexy><div style="height:1200px"></div></ytd-app>
<script>const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d'); let color = '#e0204a', bars = false;
window.__paint = (col) => { color = col; }; window.__bars = (on) => { bars = on; };
setInterval(() => { x.fillStyle = '#000'; x.fillRect(0, 0, 320, 180); x.fillStyle = color; if (bars) x.fillRect(0, 30, 320, 120); else x.fillRect(0, 0, 320, 180); }, 30);
const v = document.querySelector('video'); v.srcObject = c.captureStream(30); v.play();
window.__playerClicks = 0; document.getElementById('movie_player').addEventListener('click', () => window.__playerClicks++);</script></body></html>`);
  }
  if (url.pathname === '/echo-lang') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(String(req.headers['accept-language'] || '')); }
  if (url.pathname === '/fpworker.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(FP_WORKER); }
  if (url.pathname === '/go') { res.writeHead(302, { Location: url.searchParams.get('to') || '/' }); return res.end(); }
  if (url.pathname === '/report.pdf') { res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="report.pdf"' }); return res.end('%PDF-1.4 test'); }
  if (url.pathname === '/slow.bin') { // a file that takes ~1.5 s, so a tab closed mid-download can be checked
    const chunk = Buffer.alloc(64 * 1024, 7), n = 8;
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="slow.bin"', 'Content-Length': String(chunk.length * n) });
    let i = 0; const next = () => { if (i++ >= n) return res.end(); res.write(chunk); setTimeout(next, 180); }; return next();
  }
  if (url.pathname === '/js/widget/ads.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end('window.s_test_ads = true'); }
  if (url.pathname === '/js/pagead.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end('window.s_test_pagead = true'); }
  if (url.pathname === '/js/app.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end('window.app_ok = true'); }
  if (url.pathname === '/widget/ads.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG); }
  if (url.pathname === '/setup.exe') { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="setup.exe"' }); return res.end('MZ test'); }
  if (host === 'tracker.site') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end('window.__trackerLoaded = 1;'); }
  const local = host === 'localhost' || host === '127.0.0.1';
  const site = local && url.pathname === '/fp' ? () => fpPage(false) : SITES[host] || (local ? SITES['login.site'] : null);
  if (!site) { res.writeHead(404); return res.end('not found'); }
  const made = site(), html = typeof made === 'string' ? made : made.html;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...(made.headers || {}) });
  res.end(html);
}
function selfSigned() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-e2e-cert-'));
  const key = path.join(dir, 'k.pem'), crt = path.join(dir, 'c.pem');
  const args = ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', '1', '-subj', '/CN=oto-e2e.sec'];
  // Windows: Git for Windows ships openssl even when it isn't on PATH
  const tries = ['openssl', ...(process.platform === 'win32' ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'openssl.exe')] : [])];
  let made = false;
  for (const bin of tries) { try { execFileSync(bin, args, { stdio: 'ignore', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }); made = true; break; } catch {} }
  if (!made) throw new Error('openssl is needed to make the test certificate');
  return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
}
async function start() {
  const h = http.createServer(handler), s = https.createServer(selfSigned(), handler);
  await Promise.all([new Promise((r) => h.listen(0, '127.0.0.1', r)), new Promise((r) => s.listen(0, '127.0.0.1', r))]);
  const hp = h.address().port, sp = s.address().port;
  return {
    httpPort: hp, httpsPort: sp,
    rules: `MAP *.site ${'127.0.0.1'}:${hp}, MAP *.site. 127.0.0.1:${hp}, MAP *.sec 127.0.0.1:${sp}, MAP adblock.turtlecute.org 127.0.0.1:${hp}`,
    close: () => { h.close(); s.close(); },
  };
}
module.exports = { start };
