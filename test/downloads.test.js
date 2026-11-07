'use strict';
// Download and navigation safety (1.3.3, area 7): names, destinations, risky types, and the release checks.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { safeDownloadName, downloadPath } = require('../main/download-name.js');

test('download names can’t contain paths or tricks', () => {
  assert.strictEqual(safeDownloadName('../../Windows/System32/evil.dll'), 'evil.dll');
  assert.strictEqual(safeDownloadName('..\\..\\Startup\\run.bat'), 'run.bat');
  assert.strictEqual(safeDownloadName('C:\\Users\\me\\x.exe'), 'x.exe');
  assert.strictEqual(safeDownloadName('invoice.pdf.   '), 'invoice.pdf', 'trailing dots/spaces hide the real extension');
  assert.strictEqual(safeDownloadName('photo\u202Egpj.exe'), 'photo_gpj.exe', 'right-to-left trick shows "exe.jpg"');
  assert.strictEqual(safeDownloadName('a<b>c:d"e|f?g*h.txt'), 'a_b_c_d_e_f_g_h.txt');
  assert.strictEqual(safeDownloadName('CON'), '_CON');
  assert.strictEqual(safeDownloadName('nul.txt'), '_nul.txt');
  assert.strictEqual(safeDownloadName('..'), 'download');
  assert.strictEqual(safeDownloadName(''), 'download');
  assert.strictEqual(safeDownloadName('.htaccess'), 'htaccess');
  const long = safeDownloadName('a'.repeat(400) + '.pdf');
  assert.ok(long.length <= 180 && long.endsWith('.pdf'));
});

test('downloads stay in the downloads folder and never overwrite a file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-dl-'));
  fs.writeFileSync(path.join(dir, 'report.pdf'), 'old');
  const p = downloadPath(dir, 'report.pdf');
  assert.strictEqual(p, path.join(dir, 'report (1).pdf'));
  for (const bad of ['../../etc/passwd', '..\\..\\x', '/etc/shadow', 'sub/dir/file.txt']) assert.strictEqual(path.dirname(downloadPath(dir, bad)), path.resolve(dir), bad);
});

test('opening a program or script from Oto always asks first', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const re = new RegExp(main.match(/const RISKY_FILE = \/(.+)\/i;/)[1], 'i');
  for (const f of ['setup.exe', 'a.MSI', 'x.bat', 'x.cmd', 'x.ps1', 'x.vbs', 'x.js', 'x.lnk', 'x.iso', 'x.scr', 'x.hta', 'x.jar', 'x.reg']) assert.ok(re.test(f), f);
  for (const f of ['photo.png', 'doc.pdf', 'song.mp3', 'notes.txt', 'archive.zip']) assert.ok(!re.test(f), f);
  const open = main.slice(main.indexOf("ipcMain.handle('dl:open'"), main.indexOf("ipcMain.handle('dl:exists'"));
  assert.ok(open.indexOf('RISKY_FILE.test(p)') < open.indexOf('shell.openPath(p)'), 'the warning comes before opening');
  assert.match(open, /defaultId: 0, cancelId: 0/, 'Cancel is the default');
  assert.doesNotMatch(main, /item\.once\('done'[^\n]*openPath/, 'downloads are never opened automatically');
});

test('downloads are tagged as from the internet, and dangerous sources are stopped (normal + private windows)', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.strictEqual((main.match(/markFromInternet\(f(ile)?, item\.getURL\(\)/g) || []).length, 2);
  assert.strictEqual((main.match(/item\.getURLChain \? item\.getURLChain\(\)/g) || []).length, 2);
  assert.match(main, /ZoneId=3/);
});

test('HTTPS certificate checks are never switched off in Oto itself', () => {
  for (const f of ['main.js', 'account.js', ...fs.readdirSync(path.join(__dirname, '..', 'main')).map((x) => `main/${x}`)]) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.doesNotMatch(src, /ignore-certificate-errors|rejectUnauthorized:\s*false|setCertificateVerifyProc|on\('certificate-error'[^)]*callback\(true\)/, f);
  }
});

test('the problem report and logs carry no addresses, page data or secrets', () => {
  const extras = fs.readFileSync(path.join(__dirname, '..', 'src', 'extras.js'), 'utf8');
  const calls = [];
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'src')).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
    for (const m of src.matchAll(/\bdiag\('[^']+',\s*([^;\n]*)\)/g)) calls.push(`${f}: ${m[1]}`);
  }
  for (const c of calls) assert.doesNotMatch(c, /\burl\b|href|\.title|password|cookie|token|history/i, c);
  assert.doesNotMatch(extras.slice(extras.indexOf('async function buildReport'), extras.indexOf('async function saveReport')), /S\.history|S\.tabs|bookmarks|\.url/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'main', 'ipc-guard.js'), 'utf8'), /new URL\(e\.senderFrame\.url\)\.origin/, 'refusal log keeps only the origin');
});

test('every release is checked as the public downloads it', () => {
  const rel = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'release.yml'), 'utf8');
  const verify = rel.slice(rel.indexOf('  verify:'));
  assert.match(verify, /gh release download/);
  assert.match(verify, /sha256sum -c SHA256SUMS\.txt/);
  assert.match(verify, /gh attestation verify/);
  assert.match(verify, /openssl dgst -sha512/, 'latest.yml (what the updater trusts) matches the installer');
  assert.ok(rel.indexOf('npm test') < rel.indexOf('electron-builder --win'), 'tests before building');
});
