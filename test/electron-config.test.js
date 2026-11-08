'use strict';
// Area 7 (1.3.3): Oto's Electron security settings, checked on every change so none can be weakened by accident.
// Reads the source (no Electron needed). Each test names the rule and why it matters.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const main = read('main.js');
const allMain = ['main.js', 'account.js', ...fs.readdirSync(path.join(ROOT, 'main')).map((f) => `main/${f}`)].map((f) => [f, read(f)]);

// Every `webPreferences: { … }` object literal in main-process code, with the file it's in.
function webPrefBlocks() {
  const out = [];
  for (const [f, src] of allMain) {
    let i = 0;
    while ((i = src.indexOf('webPreferences: {', i)) >= 0) {
      let depth = 0, j = src.indexOf('{', i);
      const start = j;
      for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; }
      out.push({ f, text: src.slice(start, j + 1) });
      i = j;
    }
  }
  return out;
}

test('no window turns on Node in web content or turns off isolation / web security', () => {
  const blocks = webPrefBlocks();
  assert.ok(blocks.length >= 3, 'found the window definitions');
  for (const b of blocks) {
    assert.doesNotMatch(b.text, /nodeIntegration:\s*true/, `${b.f}: nodeIntegration`);
    assert.doesNotMatch(b.text, /nodeIntegrationInSubFrames:\s*true/, `${b.f}: nodeIntegrationInSubFrames`);
    assert.doesNotMatch(b.text, /contextIsolation:\s*false/, `${b.f}: contextIsolation`);
    assert.doesNotMatch(b.text, /webSecurity:\s*false/, `${b.f}: webSecurity`);
    assert.doesNotMatch(b.text, /allowRunningInsecureContent:\s*true/, `${b.f}: insecure content`);
    assert.doesNotMatch(b.text, /experimentalFeatures:\s*true/, `${b.f}: experimental features`);
    assert.doesNotMatch(b.text, /enableBlinkFeatures/, `${b.f}: extra Blink features`);
  }
});

test('every window is sandboxed, Oto’s own UI included (1.3.3: no sandbox exceptions left)', () => {
  for (const b of webPrefBlocks()) {
    assert.doesNotMatch(b.text, /sandbox:\s*false/, `${b.f}: unsandboxed window`);
    assert.match(b.text, /sandbox:\s*true/, `${b.f}: sandbox must be set explicitly`);
    if (/preload:/.test(b.text)) assert.match(b.text, /preload\.bundle\.js/, `${b.f}: Oto's windows use the sandbox-ready preload bundle`);
  }
  for (const [f, src] of allMain) assert.doesNotMatch(src, /sandbox\s*[:=]\s*false/, `${f}: no sandbox exceptions anywhere`);
  // and Oto's UI windows only ever load Oto's local page
  assert.ok((main.match(/win\.loadFile\(|w\.loadFile\(/g) || []).length >= 2);
  assert.doesNotMatch(main, /win\.loadURL\(/, 'the main UI window never loads a web address');
});

test('the sandboxed preload bundle is up to date with preload.js and needs only electron', () => {
  const { build } = require('../scripts/build-preload.js');
  assert.strictEqual(read('preload.bundle.js'), build(), 'run: node scripts/build-preload.js');
  const reqs = [...read('preload.bundle.js').matchAll(/require\((["'])([^"']+)\1\)/g)].map((m) => m[2]);
  assert.deepStrictEqual([...new Set(reqs)], ['electron'], 'a sandboxed preload can only require electron');
  assert.ok(JSON.parse(read('package.json')).build.files.includes('preload.bundle.js'), 'packaged');
});

test('every web page (webview) is forced into the sandbox with no preload and no Node', () => {
  const attaches = main.split("on('will-attach-webview'").slice(1).map((s) => s.slice(0, 900));
  assert.strictEqual(attaches.length, 2, 'normal and private windows');
  for (const a of attaches) {
    assert.match(a, /delete webPreferences\.preload/);
    assert.match(a, /webPreferences\.nodeIntegration = false/);
    assert.match(a, /webPreferences\.contextIsolation = true/);
    assert.match(a, /webPreferences\.sandbox = true/);
    assert.match(a, /e\.preventDefault\(\)/, 'unknown address types are refused');
  }
});

test('Oto’s window can’t be navigated away or open popups', () => {
  // both the normal and the private (Avocado) window
  assert.strictEqual((main.match(/ui\.on\('will-navigate', \(e\) => e\.preventDefault\(\)\)/g) || []).length, 2);
  assert.strictEqual((main.match(/ui\.setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/g) || []).length, 2);
});

test('websites can’t reach local files or internal pages, and popups only open web addresses', () => {
  assert.match(main, /const localOnly = \/\^\(file\|view-source\|chrome\|devtools\|chrome-extension\):\/i/);
  assert.match(main, /contents\.on\('will-navigate', \(e, url\) => blockLocal\(e, url\)\)/);
  assert.match(main, /contents\.on\('will-frame-navigate'/);
  assert.match(main, /if \(!mayOpen\(url\)\) return \{ action: 'deny' \}/);
});

test('permission requests and checks are always decided by Oto (never Electron’s allow-everything default)', () => {
  for (const s of ['setPermissionRequestHandler', 'setPermissionCheckHandler', 'setDisplayMediaRequestHandler']) assert.match(main, new RegExp(`\\.${s}\\(`), s);
});

test('the UI page has a strict Content Security Policy', () => {
  const html = read('src/index.html');
  const csp = (html.match(/Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/, "scripts only from Oto's own files: no inline, no eval");
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.match(csp, /form-action 'none'/);
});

test('the preload exposes Oto’s API only through contextBridge (never ipcRenderer itself)', () => {
  const pre = read('preload.js');
  assert.match(pre, /contextBridge\.exposeInMainWorld\(/);
  assert.doesNotMatch(pre, /exposeInMainWorld\([^)]*ipcRenderer\s*[,)]/, 'raw ipcRenderer never handed to the page');
  assert.doesNotMatch(pre, /ipcRenderer\.(invoke|send|sendSync)\(\s*[a-z]\w*\s*[,)]/i, 'channel names are fixed strings, never passed in by the page');
});

test('the page preload for websites only asks one fixed, flags-only question', () => {
  const pp = read('page-preload.js');
  const calls = pp.match(/ipcRenderer\.\w+\(\s*'[^']+'/g) || [];
  assert.deepStrictEqual([...new Set(calls)], ["ipcRenderer.sendSync('oto:page'"]);
  assert.doesNotMatch(pp, /exposeInMainWorld/, 'websites get no Oto API');
});

test('the IPC gatekeeper is installed before anything else registers a handler', () => {
  const g = main.indexOf("require('./main/ipc-guard.js')");
  const firstHandler = main.search(/ipcMain\.(handle|on)\(|require\('\.\/(main\/(?!ipc-guard)|account)/);
  assert.ok(g > 0 && g < firstHandler);
});

test('the updater never installs an older version and only uses GitHub releases', () => {
  const u = read('main/updates.js');
  assert.match(u, /allowDowngrade = false/);
  const pkg = JSON.parse(read('package.json'));
  assert.deepStrictEqual(pkg.build.publish.map((p) => [p.provider, p.owner, p.repo]), [['github', 'mukairyo', 'oto']]);
});

test('private (Avocado) pages only ever run in the in-memory session (1.3.3 fix)', () => {
  // Electron 45 ignores changes to params.partition, so the core must refuse, and the UI must ask for the right one.
  const avo = main.slice(main.indexOf('function createAvocadoWindow'), main.indexOf('// ---------------------------------------------------------------- Oto Apps'));
  assert.match(avo, /if \(params\.partition !== AVOCADO\) \{[^}]*return e\.preventDefault\(\); \}/);
  assert.match(main, /const AVOCADO = 'avocado';/, 'no "persist:" prefix = kept in memory only');
  const normal = main.slice(main.indexOf("ui.on('will-attach-webview'"), main.indexOf("ui.on('will-attach-webview'") + 900);
  assert.match(normal, /if \(!sp && params\.partition !== PARTITION\)[^;]*;[^}]*return e\.preventDefault\(\); \}/);
  const v1c = read('src/v1c.js');
  assert.match(v1c, /function v1PartitionFor\(tab\) \{\n {2}if \(AVOCADO_MODE\) return 'avocado';/);
  assert.match(read('src/extras.js'), /wvEl\.setAttribute\('partition', typeof v1PartitionFor === 'function' \? v1PartitionFor\(activeTab\(\)\)/, 'Glance uses the tab’s own session');
});

test('an update only installs after its GitHub build record is verified (item 5)', () => {
  const u = read('main/updates.js');
  assert.match(u, /updater\.autoInstallOnAppQuit = false;/, 'nothing installs on quit before the check');
  assert.match(u, /updater\.autoDownload = false;/, 'a refused version is never downloaded again');
  assert.match(u, /updater\.on\('update-downloaded', \(i\) => verifyDownloaded\(i\)\)/);
  const v = u.slice(u.indexOf('async function verifyDownloaded'), u.indexOf('async function verifyDownloaded') + 1600);
  assert.ok(v.indexOf('await verifyInstaller(') < v.indexOf("state: 'ready'"), '"ready" only after verification');
  assert.ok(v.indexOf('await verifyInstaller(') < v.indexOf('autoInstallOnAppQuit = true'));
  assert.match(v, /fs\.unlinkSync\(file\)/, 'a failed file is deleted');
  assert.match(u, /redirect: 'error'/, 'the GitHub API answer is not followed through redirects');
  assert.match(u, /if \(!updater \|\| updateState\.state !== 'ready'\) return;/, 'install button only works when ready (= verified)');
});
