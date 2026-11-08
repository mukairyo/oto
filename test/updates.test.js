'use strict';
// Updates when things go wrong (Aegis 11 #11, #12; Phase 8): corrupted release metadata, a damaged or interrupted
// download, a build record that fails, GitHub unreachable. In every case nothing becomes installable, and only a
// file that failed the security check is refused for good. Uses a stand-in for electron-updater, plus the real
// library's own metadata checks.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { install, memFiles } = require('./_mock-electron.js');

function setup({ fetch } = {}) {
  test.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const m = install();
  m.electron.app = { isPackaged: true, getVersion: () => '1.3.4', on() {}, getPath: () => os.tmpdir() };
  m.electron.net = { fetch: fetch || (async () => ({ ok: false, status: 404, json: async () => ({}) })) };
  const updater = Object.assign(new EventEmitter(), {
    downloads: 0, installs: 0, checks: 0,
    downloadUpdate() { this.downloads++; return Promise.resolve(); },
    checkForUpdates() { this.checks++; return Promise.resolve(null); },
    quitAndInstall() { this.installs++; },
  });
  const orig = Module._load;
  Module._load = function (req, ...rest) { return req === 'electron-updater' ? { autoUpdater: updater } : orig.call(this, req, ...rest); };
  delete require.cache[require.resolve('../main/updates.js')];
  const states = [];
  const files = memFiles();
  const U = require('../main/updates.js')({
    readJSON: files.readJSON, writeJSON: files.writeJSON, userFile: (n) => path.join(os.tmpdir(), n),
    send: (ch, st) => { if (ch === 'update') states.push(st); }, OTO_VERSION: '1.3.4', displayVersion: (v) => v, prefs: {},
  });
  U.setupUpdates();
  const ipc = m.electron.ipcMain;
  const tryInstall = () => { ipc.emit('update:install', {}); return new Promise((r) => setImmediate(r)); };
  const done = () => { Module._load = orig; m.restore(); test.mock.timers.reset(); };
  return { U, updater, states, tryInstall, done, last: () => states[states.length - 1] };
}
// waits for the check to finish (it reads the file from disk; timers are mocked, so poll with setImmediate)
async function settled(s) { for (let i = 0; i < 5000 && s.last().state === 'verifying'; i++) await new Promise((r) => setImmediate(r)); }
const tmpFile = (content = 'MZ fake installer') => { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'oto-upd-')), 'Oto-Setup.exe'); fs.writeFileSync(f, content); return f; };

test('safe defaults: nothing downloads or installs on its own, never an older version', () => {
  const s = setup();
  try {
    assert.strictEqual(s.updater.autoDownload, false);
    assert.strictEqual(s.updater.autoInstallOnAppQuit, false);
    assert.strictEqual(s.updater.allowDowngrade, false);
  } finally { s.done(); }
});

test('corrupted release metadata: the error is shown and nothing can install (#11)', async () => {
  const s = setup();
  try {
    s.updater.emit('checking-for-update');
    s.updater.emit('error', new Error('Cannot parse update info from latest.yml in the latest release artifacts: YAMLException: bad indentation\nrawData: ...'));
    assert.strictEqual(s.last().state, 'error');
    assert.doesNotMatch(s.last().message, /\n/, 'one line, no raw data dumped into the UI');
    await s.tryInstall();
    assert.strictEqual(s.updater.installs, 0);
    assert.strictEqual(s.updater.autoInstallOnAppQuit, false);
  } finally { s.done(); }
});

test('the real updater library rejects broken metadata and files without a checksum (#11)', () => {
  const { parseUpdateInfo, resolveFiles } = require('electron-updater/out/providers/Provider');
  assert.throws(() => parseUpdateInfo('version: 1.4.0\n  files: [broken', 'latest.yml', 'https://x/latest.yml'), (e) => e.code === 'ERR_UPDATER_INVALID_UPDATE_INFO');
  assert.throws(() => parseUpdateInfo(null, 'latest.yml', 'https://x/latest.yml'), (e) => e.code === 'ERR_UPDATER_INVALID_UPDATE_INFO');
  const base = new URL('https://github.com/mukairyo/oto/releases/download/v1.4.0/');
  assert.throws(() => resolveFiles({ version: '1.4.0', files: [{ url: 'Oto-Setup-1.4.0.exe', size: 1 }] }, base), (e) => e.code === 'ERR_UPDATER_NO_CHECKSUM');
  assert.throws(() => resolveFiles({ version: '1.4.0' }, base), (e) => e.code === 'ERR_UPDATER_NO_FILES_PROVIDED');
});

test('the real library refuses a download whose SHA-512 doesn’t match latest.yml', async () => {
  const { DigestTransform } = require('builder-util-runtime');
  const t = new DigestTransform(require('crypto').createHash('sha512').update('the real installer').digest('base64'));
  const err = await new Promise((resolve) => { t.on('error', resolve); t.on('finish', () => { try { t.validate(); resolve(null); } catch (e) { resolve(e); } }); t.end(Buffer.from('a different file')); });
  assert.ok(err && err.code === 'ERR_CHECKSUM_MISMATCH', 'mismatch refused');
});

test('an interrupted download: error shown, not installable, and the next check downloads again (#12)', async () => {
  const s = setup();
  try {
    s.updater.emit('update-available', { version: '1.4.0' });
    assert.strictEqual(s.last().state, 'downloading');
    s.updater.emit('download-progress', { percent: 41 });
    s.updater.emit('error', new Error('net::ERR_CONNECTION_RESET'));
    assert.strictEqual(s.last().state, 'error');
    await s.tryInstall();
    assert.strictEqual(s.updater.installs, 0);
    // an interrupted download isn't a security failure: the same version is tried again
    s.updater.emit('update-available', { version: '1.4.0' });
    assert.strictEqual(s.updater.downloads, 2);
    assert.strictEqual(s.last().state, 'downloading');
  } finally { s.done(); }
});

test('disk full while downloading: reported, nothing installs', async () => {
  const s = setup();
  try {
    s.updater.emit('update-available', { version: '1.4.0' });
    s.updater.emit('error', Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' }));
    assert.strictEqual(s.last().state, 'error');
    assert.match(s.last().message, /ENOSPC/);
    await s.tryInstall();
    assert.strictEqual(s.updater.installs, 0);
  } finally { s.done(); }
});

test('a downloaded file with no valid build record is deleted, refused for good, and never installs', async () => {
  const s = setup(); // GitHub answers 404: no build record for this file
  try {
    const file = tmpFile();
    s.updater.emit('update-downloaded', { version: '1.4.0', downloadedFile: file });
    await settled(s);
    assert.strictEqual(s.last().state, 'error');
    assert.match(s.last().message, /failed Oto’s security check/);
    assert.ok(!fs.existsSync(file), 'file deleted');
    assert.strictEqual(s.updater.autoInstallOnAppQuit, false);
    await s.tryInstall();
    assert.strictEqual(s.updater.installs, 0);
    s.updater.emit('update-available', { version: '1.4.0' });
    assert.strictEqual(s.updater.downloads, 0, 'that version is not downloaded again');
    s.updater.emit('update-available', { version: '1.4.1' });
    assert.strictEqual(s.updater.downloads, 1, 'a newer version still can be');
  } finally { s.done(); }
});

test('GitHub unreachable during the check: kept, not installable yet, checked again later', async () => {
  const s = setup({ fetch: async () => { throw new Error('net::ERR_INTERNET_DISCONNECTED'); } });
  try {
    const file = tmpFile();
    s.updater.emit('update-downloaded', { version: '1.4.0', downloadedFile: file });
    await settled(s);
    assert.strictEqual(s.last().state, 'error');
    assert.match(s.last().message, /not checked yet/);
    assert.ok(fs.existsSync(file), 'kept for the next try');
    await s.tryInstall();
    assert.strictEqual(s.updater.installs, 0);
    assert.strictEqual(s.updater.autoInstallOnAppQuit, false);
  } finally { s.done(); }
});

test('the update source can’t be redirected: no feed overrides anywhere in Oto', () => {
  const src = ['main/updates.js', 'main.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /setFeedURL|updateConfigPath|forceDevUpdateConfig/, 'the GitHub release feed is the only source');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.deepStrictEqual(pkg.build.publish, [{ provider: 'github', owner: 'mukairyo', repo: 'oto' }].map((p) => ({ ...p, ...Object.fromEntries(Object.entries(pkg.build.publish[0]).filter(([k]) => !['provider', 'owner', 'repo'].includes(k))) })));
  assert.ok(!pkg.build.publish.some((p) => p.url || p.provider === 'generic'), 'no generic/custom update server');
});
