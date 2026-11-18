'use strict';
// Puts Tor into vendor-tor/ for Oto VPN (main/vpn.js); electron-builder ships it as resources/tor. Run by the
// release build on Windows (node scripts/fetch-tor.js [--version 16.0.1]).
//
// What it gets: the Tor Project's "Tor Expert Bundle" for Windows x64, the same tor.exe Tor Browser uses, from
// dist.torproject.org. Nothing is trusted because of where it came from: the bundle must carry a valid OpenPGP
// signature by the Tor Browser signing key, whose PRIMARY fingerprint is pinned below. The key itself is fetched (it
// gets new signing subkeys over time) into a throwaway keyring; a key with any other fingerprint is useless, so a
// swapped key or file is refused. Tor is free software by The Tor Project (3-clause BSD); its licence files are
// copied along.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const TOR_KEY = 'EF6E286DDA85EA2A4BA7DE684E2C6E8793298290'; // Tor Browser Developers (signing key)
const KEY_URLS = [
  // the Tor Project's own Web Key Directory entry for torbrowser@torproject.org, then two public keyservers
  'https://openpgpkey.torproject.org/.well-known/openpgpkey/torproject.org/hu/kounek7zrdx745qydx6p59t9mqjpuhdf',
  `https://keyserver.ubuntu.com/pks/lookup?op=get&options=mr&search=0x${TOR_KEY}`,
  `https://keys.openpgp.org/vks/v1/by-fingerprint/${TOR_KEY}`,
];
const VERSION_RE = /^\d{1,3}\.\d{1,3}(\.\d{1,3}){0,2}$/;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Which key really signed: gpg's machine-readable "VALIDSIG" line ends with the PRIMARY key's fingerprint (the
// signature may come from a subkey). Anything else (BADSIG, EXPKEYSIG, no VALIDSIG at all) is a refusal.
function signerOf(status) {
  const lines = String(status).split(/\r?\n/);
  if (lines.some((l) => /^\[GNUPG:\] (BADSIG|ERRSIG|EXPKEYSIG|REVKEYSIG|EXPSIG)\b/.test(l))) return '';
  const v = lines.map((l) => /^\[GNUPG:\] VALIDSIG ([0-9A-F]{40}) .* ([0-9A-F]{40})$/.exec(l)).find(Boolean);
  return v ? v[2] : '';
}

// Checks `file` against its detached signature `sig` with only the keys in `keys` (a fresh keyring each time).
function verify({ file, sig, keys, want = TOR_KEY, gpg = 'gpg' }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-gpg-'));
  try {
    // (the keyring folder is given relative to its parent: Git for Windows' gpg treats C:\... as a relative path,
    // a native gpg doesn't understand /c/..., and both understand a plain folder name)
    const run = (args, opts = {}) => execFileSync(gpg, ['--homedir', path.basename(home), '--batch', '--no-tty', ...args], { cwd: path.dirname(home), stdio: ['pipe', 'pipe', 'pipe'], ...opts });
    const notes = [];
    for (const k of keys) {
      try { run(['--import'], { input: k }); notes.push(`imported ${k.length} bytes`); } catch (e) { notes.push(`import refused (${k.length} bytes): ${String(e.stderr || e.message).trim().split(/\r?\n/).slice(-2).join(' | ')}`); }
    }
    let status = '', errText = '';
    try { status = run(['--status-fd', '1', '--verify', sig, file]).toString(); } catch (e) { status = String(e.stdout || ''); errText = String(e.stderr || e.message); }
    const signer = signerOf(status);
    if (signer !== want) {
      // (what gpg said, so a refusal can be understood; public information only)
      const keysNow = (() => { try { return run(['--with-colons', '--list-keys']).toString().split(/\r?\n/).filter((l) => /^(pub|sub|fpr|uid):/.test(l)).map((l) => l.split(':').slice(0, 10).join(':')).join('\n'); } catch (e) { return String(e.message); } })();
      console.error(`gpg: ${gpg}\n${notes.join('\n')}\nkeys:\n${keysNow}\nstatus:\n${status.trim()}\nstderr:\n${errText.trim().slice(0, 1500)}`);
      throw new Error(signer ? `signed by ${signer}, not the Tor Browser key ${want}` : 'no valid signature by the Tor Browser key');
    }
    return signer;
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

async function get(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) { const e = new Error(`${r.status} ${url}`); e.status = r.status; throw e; }
  return Buffer.from(await r.arrayBuffer());
}

async function latestVersion() {
  const j = JSON.parse((await get('https://aus1.torproject.org/torbrowser/update_3/release/downloads.json')).toString('utf8'));
  if (!VERSION_RE.test(j.version || '')) throw new Error(`unexpected version from the Tor Project: ${j.version}`);
  return j.version;
}

async function main() {
  const args = process.argv.slice(2);
  const asked = args[0] === '--version' ? String(args[1] || '') : process.env.OTO_TOR_VERSION || '';
  if (asked && !VERSION_RE.test(asked)) throw new Error('give a version like 16.0.1');
  const v = asked || await latestVersion();
  const name = `tor-expert-bundle-windows-x86_64-${v}.tar.gz`;
  let tgz, asc;
  for (const base of ['https://dist.torproject.org/torbrowser', 'https://archive.torproject.org/tor-package-archive/torbrowser']) {
    try { tgz = await get(`${base}/${v}/${name}`); asc = await get(`${base}/${v}/${name}.asc`); break; } catch (e) { if (e.status !== 404) throw e; }
  }
  if (!tgz) throw new Error(`no ${name} on dist.torproject.org or the archive`);
  const keys = [];
  for (const u of KEY_URLS) { try { keys.push(await get(u)); } catch (e) { console.warn(`key: ${e.message}`); } }
  if (!keys.length) throw new Error('could not fetch the Tor Browser signing key');

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-tor-'));
  try {
    fs.writeFileSync(path.join(work, name), tgz); fs.writeFileSync(path.join(work, `${name}.asc`), asc);
    const signer = verify({ file: path.join(work, name), sig: path.join(work, `${name}.asc`), keys });
    const x = path.join(work, 'x'); fs.mkdirSync(x);
    execFileSync('tar', ['-xzf', name, '-C', 'x'], { cwd: work, stdio: 'inherit' }); // (relative: Git's tar reads C:\ as a remote host)
    if (!fs.existsSync(path.join(x, 'tor', 'tor.exe'))) throw new Error('the bundle has no tor/tor.exe');
    const out = path.join(__dirname, '..', 'vendor-tor');
    fs.rmSync(out, { recursive: true, force: true });
    // tor.exe and what it loads; the geoip files (which country an exit is in); licences. Not the pluggable
    // transports (bridges), which Oto doesn't use.
    fs.cpSync(path.join(x, 'tor'), path.join(out, 'tor'), { recursive: true, filter: (f) => !/pluggable_transports/.test(f) });
    fs.mkdirSync(path.join(out, 'data'), { recursive: true });
    for (const g of ['geoip', 'geoip6']) if (fs.existsSync(path.join(x, 'data', g))) fs.copyFileSync(path.join(x, 'data', g), path.join(out, 'data', g));
    const licences = [];
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/licen[cs]e|copying/i.test(e.name)) licences.push(f); } };
    walk(x);
    fs.mkdirSync(path.join(out, 'licenses'), { recursive: true });
    for (const f of licences) fs.copyFileSync(f, path.join(out, 'licenses', path.relative(x, f).replace(/[\\/]/g, '_')));
    fs.writeFileSync(path.join(out, 'README.md'), `Tor ${v} (Tor Expert Bundle, Windows x64) from dist.torproject.org, for Oto VPN.\n` +
      `Tor is free software by The Tor Project, Inc., under the 3-clause BSD licence: https://gitlab.torproject.org/tpo/core/tor/-/blob/main/LICENSE\n` +
      `Signature checked against the Tor Browser signing key ${signer} (scripts/fetch-tor.js).\n`);
    const info = { version: v, bundle: name, bundleSha256: sha256(tgz), torExeSha256: sha256(fs.readFileSync(path.join(out, 'tor', 'tor.exe'))), signer };
    fs.writeFileSync(path.join(out, 'VERSION.json'), `${JSON.stringify(info, null, 2)}\n`);
    console.log(`vendor-tor: Tor ${v}, signed by ${signer}, tor.exe ${info.torExeSha256.slice(0, 16)}…, ${licences.length} licence file(s)`);
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}

module.exports = { TOR_KEY, signerOf, verify, VERSION_RE };
if (require.main === module) main().catch((e) => { console.error(`fetch-tor: ${e.message}`); process.exit(1); });
