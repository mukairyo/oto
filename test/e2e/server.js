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
  const site = SITES[host] || (host === 'localhost' || host === '127.0.0.1' ? SITES['login.site'] : null);
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
