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
};
function handler(req, res) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase().replace(/\.$/, '').replace(/\.sec$/, '.site');
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/go') { res.writeHead(302, { Location: url.searchParams.get('to') || '/' }); return res.end(); }
  if (url.pathname === '/report.pdf') { res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="report.pdf"' }); return res.end('%PDF-1.4 test'); }
  if (url.pathname === '/slow.bin') { // a file that takes ~1.5 s, so a tab closed mid-download can be checked
    const chunk = Buffer.alloc(64 * 1024, 7), n = 8;
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="slow.bin"', 'Content-Length': String(chunk.length * n) });
    let i = 0; const next = () => { if (i++ >= n) return res.end(); res.write(chunk); setTimeout(next, 180); }; return next();
  }
  if (url.pathname === '/setup.exe') { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="setup.exe"' }); return res.end('MZ test'); }
  if (host === 'tracker.site') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end('window.__trackerLoaded = 1;'); }
  const site = SITES[host] || (host === 'localhost' || host === '127.0.0.1' ? SITES['login.site'] : null);
  if (!site) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(site());
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
    rules: `MAP *.site ${'127.0.0.1'}:${hp}, MAP *.site. 127.0.0.1:${hp}, MAP *.sec 127.0.0.1:${sp}`,
    close: () => { h.close(); s.close(); },
  };
}
module.exports = { start };
