#!/usr/bin/env node
'use strict';
// Oto's quick checks (npm run lint): every JavaScript file must parse, and a few security rules from the
// 1.2.2 audit must stay true. Plain Node, no extra packages, so it runs anywhere (also in CI).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
// Every .js file in the repository, in any folder (except dependencies, build output and git data).
const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage', 'out']);
function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = path.join(dir, d.name);
    if (d.isDirectory()) return SKIP.has(d.name) || d.name.startsWith('userdata') ? [] : walk(rel);
    return d.isFile() && /\.(c|m)?js$/.test(d.name) ? [rel] : [];
  });
}
const files = walk('.').map((f) => path.normalize(f));
let bad = 0;
const fail = (msg) => { bad++; console.error(`✗ ${msg}`); };

// 1. syntax
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); } catch (e) { fail(`${f} doesn't parse:\n${String(e.stderr || e.message).trim()}`); }
}

// 2. security rules (pattern, files it applies to, why)
const RULES = [
  [/nodeIntegration:\s*true/, /./, 'nodeIntegration must stay off'],
  [/contextIsolation:\s*false/, /./, 'contextIsolation must stay on'],
  [/webSecurity:\s*false/, /./, 'webSecurity must stay on'],
  [/allowRunningInsecureContent:\s*true/, /./, 'no insecure content'],
  [/allowFileAccess:\s*true/, /./, 'extensions from files/folders get no file:// access (audit 13)'],
  [/\bplain:\s*Buffer\.from/, /./, 'passwords are never stored as Base64 (audit 01)'],
  [/\{\s*p:\s*Buffer\.from/, /./, 'account secrets are never stored as Base64 (audit 02)'],
  [/['"]pw:inject['"]/, /./, 'no generic code-injection channel (audit 03)'],
  [/executeJavaScriptInIsolatedWorld/, /^(?!main[\\/]passwords\.js$)/, 'only main/passwords.js runs code in pages’ hidden world'],
  [/extractAllTo\(/, /./, 'unpack archives with main/safe-unzip.js (audit 13)'],
  [/\beval\(|new Function\(/, /^(main|src|account\.js|preload\.js|page-preload\.js|main\.js)/, 'no eval / new Function in Oto’s own code'],
  [/shell\.openExternal\((?!['"`])/, /./, 'shell.openExternal only with a fixed address (anything else goes through Oto’s checked helpers)'],
  [/sandbox:\s*false/, /^(?!main\.js$)/, 'only Oto’s own window may run unsandboxed (audit 06, documented in SECURITY.md)'],
  [/callback\(\{\}\)/, /^main\.js$/, 'screen-share refusals use callback(null) (Electron 45 throws on {})'],
  [/ignore-certificate-errors|setCertificateVerifyProc\([^)]*callback\(0\)/, /^(?!test[\\/])/, 'never turn off certificate checks'],
];
for (const f of files) {
  if (f.startsWith('scripts') || f.startsWith('test')) continue; // tests mention the old patterns on purpose
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const [re, applies, why] of RULES) {
    if (!applies.test(f)) continue;
    const lines = text.split('\n');
    lines.forEach((l, i) => { if (!/^\s*(\/\/|\*)/.test(l) && re.test(l)) fail(`${f}:${i + 1} — ${why}\n    ${l.trim().slice(0, 140)}`); });
  }
}

// 3. the IPC gatekeeper must be installed before anything registers a handler
{
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const g = main.indexOf("require('./main/ipc-guard.js')"), h = main.search(/ipcMain\.(handle|on)\(|require\('\.\/(main|account)/);
  if (g < 0 || (h >= 0 && h < g)) fail('main.js must install main/ipc-guard.js before any IPC handler or module (audit 04)');
}

// 4. both version fields agree
{
  const p = require(path.join(ROOT, 'package.json'));
  if (p.otoVersion && p.version !== p.otoVersion && !/^\d+\.\d+\.\d{3}$/.test(p.version)) fail(`package.json version (${p.version}) and otoVersion (${p.otoVersion}) disagree`);
  const log = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  if (!log.includes(`## ${p.otoVersion || p.version} `)) fail(`CHANGELOG.md has no section for ${p.otoVersion || p.version}`);
}

if (bad) { console.error(`\n${bad} problem(s).`); process.exit(1); }
console.log(`✓ ${files.length} files parse, security rules hold.`);
