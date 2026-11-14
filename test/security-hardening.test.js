'use strict';
// 1.6.6 hardening from the threat model (threat-model/2026-11-14-quick): popups show their real site, the Web Store
// channels answer only the exact store origin, folder extensions are fingerprinted, the update file is re-hashed,
// and the workflows keep third-party code away from release rights.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { fakeIpcMain } = require('./_mock-electron.js');
const guardIPC = require('../main/ipc-guard.js');
const { popupTitle } = require('../main/popup-title.js');
const { folderHash } = require('../main/folder-hash.js');
const { fileSha256, fileSha256Sync } = require('../main/attest.js');

test('a popup title always starts with the site it is really on', () => {
  assert.strictEqual(popupTitle('https://accounts.google.com/signin', 'Sign in – Google Accounts'), 'accounts.google.com — Sign in – Google Accounts');
  assert.strictEqual(popupTitle('https://evil.example/x', 'accounts.google.com — Sign in'), 'evil.example — accounts.google.com — Sign in');
  assert.strictEqual(popupTitle('http://shop.example/', 'Pay'), 'shop.example (not secure) — Pay');
  assert.strictEqual(popupTitle('https://a.example:8443/', ''), 'a.example:8443');
  assert.strictEqual(popupTitle('about:blank', ''), 'Oto');
  assert.strictEqual(popupTitle('data:text/html,hi', 'x'), 'data: — x');
  assert.ok(popupTitle('https://a.example/', 'x'.repeat(500)).length < 200, 'long titles are cut');
});

test('Web Store channels answer only the exact Chrome Web Store origin', () => {
  const ipc = fakeIpcMain();
  guardIPC(ipc, path.join(__dirname, '..'));
  let ran = 0;
  ipc.handle('chromeWebstore.install', () => { ran++; return 'installed'; });
  ipc.handle('chrome.management.setEnabled', () => { ran++; return true; });
  const from = (origin, type = 'webview') => ({ sender: { isDestroyed: () => false, getType: () => type }, senderFrame: { origin, url: `${origin}/detail/x`, parent: null } });
  const silence = console.warn; console.warn = () => {};
  try {
    for (const o of ['https://chromewebstore.google.com.evil.example', 'https://evil.example', 'http://chromewebstore.google.com', 'https://xchromewebstore.google.com']) {
      assert.strictEqual(ipc.invoke('chromeWebstore.install', from(o)), undefined, o);
      assert.strictEqual(ipc.invoke('chrome.management.setEnabled', from(o)), undefined, o);
    }
    assert.strictEqual(ran, 0, 'no look-alike reached the library');
    assert.strictEqual(ipc.invoke('chromeWebstore.install', from('https://chromewebstore.google.com')), 'installed', 'the real store still works');
  } finally { console.warn = silence; }
});

test('a folder fingerprint changes when any file, name or link changes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-fh-'));
  try {
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{"name":"x"}');
    fs.mkdirSync(path.join(dir, 'js'));
    fs.writeFileSync(path.join(dir, 'js', 'bg.js'), 'console.log(1)');
    const a = folderHash(dir);
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.strictEqual(folderHash(dir), a, 'stable');
    fs.writeFileSync(path.join(dir, 'js', 'bg.js'), 'console.log(2)');
    const b = folderHash(dir); assert.notStrictEqual(b, a, 'content change');
    fs.renameSync(path.join(dir, 'js', 'bg.js'), path.join(dir, 'js', 'bg2.js'));
    const c = folderHash(dir); assert.notStrictEqual(c, b, 'rename');
    try { fs.symlinkSync(os.tmpdir(), path.join(dir, 'out')); assert.notStrictEqual(folderHash(dir), c, 'a new link'); } catch (e) { if (e.code !== 'EPERM') throw e; }
    assert.strictEqual(folderHash(path.join(dir, 'missing')), null, 'unreadable folder');
    assert.strictEqual(folderHash(dir, { files: 1, total: 1e9 }), null, 'over the limits');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the update file can be re-hashed while quitting (same answer as the normal check)', async () => {
  const f = path.join(os.tmpdir(), `oto-upd-${process.pid}.bin`);
  try {
    fs.writeFileSync(f, crypto.randomBytes(3 * 1024 * 1024 + 7));
    assert.strictEqual(fileSha256Sync(f), await fileSha256(f));
  } finally { fs.rmSync(f, { force: true }); }
});

test('saved-password filling re-checks the site inside the page', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main', 'passwords.js'), 'utf8');
  assert.match(src, /if \(location\.origin !== o\) return \{ user: false, pass: false, moved: true \}/);
  assert.match(src, /pwFillCode\(cred\.username, pwDec\(cred\), cred\.origin\)/);
  assert.match(src, /if \(!\(await mayReveal\(\)\)\) return null;/, 'showing a password asks first');
});

test('popups get the same guards as tabs', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.match(src, /contents\.on\('did-create-window', \(child\) => \{[\s\S]*?guardWebContent\(child\.webContents, tab\)/);
  assert.match(src, /guardWebContent\(contents, contents\)/);
});

const WF = path.join(__dirname, '..', '.github', 'workflows');
const job = (s, name) => { const i = s.indexOf(`\n  ${name}:\n`); const rest = s.slice(i + 1); const j = rest.slice(3).search(/\n {2}[a-z][\w-]*:\n/); return j < 0 ? rest : rest.slice(0, j + 3); };

test('release: the job that runs packages and builds has no release rights; the publishing job runs no packages', () => {
  const rel = fs.readFileSync(path.join(WF, 'release.yml'), 'utf8');
  const build = job(rel, 'build'), publish = job(rel, 'release');
  assert.match(build, /npm ci/); assert.match(build, /electron-builder --win/);
  assert.doesNotMatch(build, /contents: write|id-token: write|attestations: write/, 'build job is read-only');
  assert.match(publish, /id-token: write/); assert.match(publish, /attest-build-provenance/);
  assert.doesNotMatch(publish, /npm (ci|install|test|run)|pip install|electron-builder/, 'publish job runs no third-party build code');
  assert.match(publish, /sha256sum -c SHA256SUMS\.txt/, 'files checked against the build job’s checksums');
});

test('build tools from PyPI are pinned by hash', () => {
  for (const f of ['release.yml', 'test-build.yml']) {
    const s = fs.readFileSync(path.join(WF, f), 'utf8');
    for (const m of s.matchAll(/pip install[^\n]*/g)) assert.match(m[0], /--require-hashes/, `${f}: ${m[0]}`);
  }
  const req = fs.readFileSync(path.join(__dirname, '..', '.github', 'requirements-evs.txt'), 'utf8');
  for (const line of req.split('\n').filter((l) => /^[a-z]/i.test(l))) assert.match(line, /==\S+ \\$/, `exact version: ${line}`);
  assert.match(req, /castlabs-evs==/);
});

test('an automated Electron update waits for review instead of releasing itself', () => {
  const s = fs.readFileSync(path.join(WF, 'chromium-update.yml'), 'utf8');
  assert.match(s, /gh pr create/);
  assert.doesNotMatch(s, /git push\s*\n|git push origin main|gh workflow run release\.yml --ref main --repo "\$GITHUB_REPOSITORY"\n\n {6}- name: Report/, 'no direct push or release after a bump');
});
