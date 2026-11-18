'use strict';
// scripts/fetch-tor.js (1.8.0): Tor is only accepted with a valid signature whose PRIMARY key is the pinned
// Tor Browser key. Checked with throwaway keys made here (gpg needed; skipped without it).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { signerOf, verify, TOR_KEY } = require('../scripts/fetch-tor.js');

const hasGpg = (() => { try { execFileSync('gpg', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

test('the pinned key is the Tor Browser signing key', () => {
  assert.strictEqual(TOR_KEY, 'EF6E286DDA85EA2A4BA7DE684E2C6E8793298290');
});

test('gpg status: the primary fingerprint counts; bad or expired signatures are refused', () => {
  const ok = '[GNUPG:] GOODSIG 1234 Tor\n[GNUPG:] VALIDSIG 1111111111111111111111111111111111111111 2026-11-01 1 0 4 0 1 10 01 EF6E286DDA85EA2A4BA7DE684E2C6E8793298290\n';
  assert.strictEqual(signerOf(ok), TOR_KEY);
  assert.strictEqual(signerOf(`${ok}[GNUPG:] EXPKEYSIG 1234 Tor\n`), '');
  assert.strictEqual(signerOf('[GNUPG:] BADSIG 1234 Tor\n'), '');
  assert.strictEqual(signerOf('[GNUPG:] NO_PUBKEY 1234\n'), '');
});

test('a file signed by the right key passes; another key, or a changed file, is refused', { skip: !hasGpg && 'no gpg' }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-sig-'));
  const mk = (who) => {
    const home = path.join(d, who); fs.mkdirSync(home, { mode: 0o700 });
    const g = (a, o = {}) => execFileSync('gpg', ['--homedir', home, '--batch', '--no-tty', '--pinentry-mode', 'loopback', '--passphrase', '', ...a], { stdio: ['pipe', 'pipe', 'pipe'], ...o });
    g(['--quick-gen-key', `${who} <${who}@example.test>`, 'ed25519', 'sign', '1d']);
    const fpr = /^fpr:+([0-9A-F]{40}):/m.exec(g(['--with-colons', '--fingerprint', who]).toString())[1];
    return { fpr, pub: g(['--export', fpr]), sign: (file) => g(['--detach-sign', '--armor', '-o', `${file}.${who}.asc`, file]) };
  };
  const tor = mk('tor'), evil = mk('evil');
  const file = path.join(d, 'bundle.tar.gz'); fs.writeFileSync(file, 'tor bits');
  tor.sign(file); evil.sign(file);
  assert.strictEqual(verify({ file, sig: `${file}.tor.asc`, keys: [tor.pub], want: tor.fpr }), tor.fpr);
  assert.throws(() => verify({ file, sig: `${file}.evil.asc`, keys: [tor.pub, evil.pub], want: tor.fpr }), /signed by|no valid signature/);
  assert.throws(() => verify({ file, sig: `${file}.tor.asc`, keys: [evil.pub], want: tor.fpr }), /no valid signature/, 'without the right key nothing verifies');
  fs.appendFileSync(file, 'x');
  assert.throws(() => verify({ file, sig: `${file}.tor.asc`, keys: [tor.pub], want: tor.fpr }), /no valid signature/);
  fs.rmSync(d, { recursive: true, force: true });
});
