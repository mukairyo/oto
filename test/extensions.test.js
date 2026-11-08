'use strict';
// Extensions (Aegis Phase 6): Web Store packages must be genuinely signed, and file-installed extensions are told
// apart from Web Store ones correctly (so "Remove" really removes them).
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { verifyCrx, WEBSTORE_KEY_HASH } = require('../main/crx-verify.js');
const { install, memFiles } = require('./_mock-electron.js');

const FIX = path.join(__dirname, 'fixtures', 'crx');
const fx = (f) => fs.readFileSync(path.join(FIX, f));

// Small protobuf writer to build CRX3 files for the attack cases.
const varint = (n) => { const b = []; do { let x = n % 128; n = Math.floor(n / 128); if (n) x |= 128; b.push(x); } while (n); return Buffer.from(b); };
const field = (num, bytes) => Buffer.concat([varint(num * 8 + 2), varint(bytes.length), bytes]);
function buildCrx({ signers, crxIdKey, archive = Buffer.from('PK\x05\x06' + '\0'.repeat(18), 'latin1'), tamper }) {
  const idKeyDer = crxIdKey.export({ type: 'spki', format: 'der' });
  const crxId = crypto.createHash('sha256').update(idKeyDer).digest().subarray(0, 16);
  const signedHeader = field(1, crxId);
  const len = Buffer.alloc(4); len.writeUInt32LE(signedHeader.length);
  const data = Buffer.concat([Buffer.from('CRX3 SignedData\x00', 'latin1'), len, signedHeader, archive]);
  const proofs = signers.map(({ pub, priv, kind = 'rsa', fakeSig }) => {
    const sig = fakeSig || crypto.sign('sha256', data, priv);
    return field(kind === 'rsa' ? 2 : 3, Buffer.concat([field(1, pub.export({ type: 'spki', format: 'der' })), field(2, sig)]));
  });
  const header = Buffer.concat([...proofs, field(10000, signedHeader)]);
  const head = Buffer.alloc(12); head.write('Cr24', 0, 'latin1'); head.writeUInt32LE(3, 4); head.writeUInt32LE(header.length, 8);
  const out = Buffer.concat([head, header, tamper ? Buffer.concat([archive, Buffer.from('x')]) : archive]);
  return out;
}
const rsa = () => { const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }); return { pub: publicKey, priv: privateKey }; };

test('real Chromium test packages: Web Store–signed passes, the rest are refused like Chrome does', () => {
  const ok = verifyCrx(fx('valid_publisher.crx3'), { requireWebStore: true });
  assert.strictEqual(ok.id, 'ojjgnpkioondelmggbekfhllhdaimnho');
  assert.strictEqual(ok.publisher, true, 'signed by the Chrome Web Store key');
  assert.throws(() => verifyCrx(fx('valid_no_publisher.crx3'), { requireWebStore: true }), /Chrome Web Store/);
  assert.strictEqual(verifyCrx(fx('valid_no_publisher.crx3')).publisher, false, 'developer-signed is fine where the store isn’t required');
  assert.throws(() => verifyCrx(fx('unsigned.crx3')), /own key/);
  assert.throws(() => verifyCrx(fx('valid.crx2')), /CRX2/);
  assert.match(WEBSTORE_KEY_HASH, /^61f7f2a6/, 'Chromium’s Web Store key hash');
});

test('changing any byte of a signed package breaks it', () => {
  const good = fx('valid_publisher.crx3');
  for (const at of [good.length - 10, 12 + 40, good.length - 200]) {
    const bad = Buffer.from(good); bad[at] ^= 1;
    assert.throws(() => verifyCrx(bad, { requireWebStore: true }), `byte ${at}`);
  }
});

test('the attack the Web Store library allows: a copied public key with a fake signature is refused', () => {
  const dev = rsa(), attacker = rsa();
  // the extension's real (public) key in the header, signature made by someone else
  const forged = buildCrx({ crxIdKey: dev.pub, signers: [{ pub: dev.pub, priv: attacker.priv }] });
  assert.throws(() => verifyCrx(forged), /signature doesn’t match/);
  // junk signature bytes
  assert.throws(() => verifyCrx(buildCrx({ crxIdKey: dev.pub, signers: [{ pub: dev.pub, fakeSig: crypto.randomBytes(256) }] })), /signature/);
  // signed correctly, but by a key that isn't the extension's
  assert.throws(() => verifyCrx(buildCrx({ crxIdKey: dev.pub, signers: [{ pub: attacker.pub, priv: attacker.priv }] })), /own key/);
  // an extra (valid) signer can't hide a bad one: every signature must verify
  assert.throws(() => verifyCrx(buildCrx({ crxIdKey: dev.pub, signers: [{ pub: dev.pub, priv: dev.priv }, { pub: attacker.pub, fakeSig: crypto.randomBytes(256) }] })), /signature/);
  // contents changed after signing
  assert.throws(() => verifyCrx(buildCrx({ crxIdKey: dev.pub, signers: [{ pub: dev.pub, priv: dev.priv }], tamper: true })), /signature/);
  // the honest case passes (developer-signed), and is refused only for lacking the store signature
  const honest = buildCrx({ crxIdKey: dev.pub, signers: [{ pub: dev.pub, priv: dev.priv }] });
  assert.ok(verifyCrx(honest).id);
  assert.throws(() => verifyCrx(honest, { requireWebStore: true }), /Chrome Web Store/);
  assert.throws(() => verifyCrx(honest, { expectedId: 'a'.repeat(32) }), /different extension/);
});

test('damaged packages are refused, never half-read', () => {
  const good = fx('valid_publisher.crx3');
  for (const bad of [Buffer.alloc(0), Buffer.from('PK\x03\x04'), good.subarray(0, 11), good.subarray(0, 60), Buffer.concat([good.subarray(0, 8), Buffer.from([0xff, 0xff, 0xff, 0x7f])])]) {
    assert.throws(() => verifyCrx(bad));
  }
});

function loadExt() {
  const m = install();
  m.electron.dialog.showOpenDialog = async () => ({ canceled: true });
  const mem = memFiles();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-ext-'));
  const sent = [];
  delete require.cache[require.resolve('../main/extensions.js')];
  const EXT = require('../main/extensions.js')({ readJSON: mem.readJSON, writeJSON: mem.writeJSON, userFile: (n) => path.join(dir, n), send: (...a) => sent.push(a) });
  return { m, mem, dir, EXT, sent };
}

test('every package the Web Store library downloads goes through the signature check first', async () => {
  const { m, EXT, sent } = loadExt();
  const orig = globalThis.fetch;
  let next;
  globalThis.fetch = async () => next();
  try {
    EXT.guardCrxDownloads();
    EXT.guardCrxDownloads(); // installed once
    const good = fx('valid_publisher.crx3');
    next = () => new Response(good, { status: 200 });
    const r1 = await globalThis.fetch('https://clients2.google.com/service/update2/crx?x=id%3Dojjgnpkioondelmggbekfhllhdaimnho');
    assert.strictEqual(r1.status, 200);
    assert.ok(Buffer.from(await r1.arrayBuffer()).equals(good), 'passed through unchanged');
    const bad = Buffer.from(good); bad[bad.length - 5] ^= 1;
    next = () => new Response(bad, { status: 200 });
    const r2 = await globalThis.fetch('https://clients2.googleusercontent.com/crx/blobs/x.crx');
    assert.strictEqual(r2.status, 403, 'tampered package refused before the library sees it');
    assert.ok(sent.some(([ch]) => ch === 'ext:refused'), 'the user is told');
    next = () => new Response(fx('valid_no_publisher.crx3'), { status: 200 });
    assert.strictEqual((await globalThis.fetch('https://x/y.crx')).status, 403, 'not from the Web Store: refused');
    next = () => new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
    const r3 = await globalThis.fetch('https://chromewebstore.googleapis.com/x');
    assert.deepStrictEqual(await r3.json(), { ok: 1 }, 'other answers (update info, icons) pass');
  } finally { globalThis.fetch = orig; m.restore(); }
});

test('a file-installed extension is not mistaken for a Web Store one, and Remove really removes it', async () => {
  const { m, mem, dir, EXT } = loadExt();
  try {
    const store = path.join(dir, 'Extensions'), files = path.join(dir, 'Extensions-files');
    assert.strictEqual(EXT._inside(store, path.join(files, 'evil-1')), false, '"Extensions-files" is not inside "Extensions"');
    assert.strictEqual(EXT._inside(store, path.join(store, 'abc', '1.0_0')), true);
    assert.strictEqual(EXT._inside(store, store), false);
    const extDir = path.join(files, 'test-ext-1');
    fs.mkdirSync(extDir, { recursive: true });
    mem.files['extensions-manual.json'] = [extDir];
    const removed = [];
    const ses = { extensions: {
      getExtension: (id) => (id === 'x' ? { id: 'x', path: extDir, name: 'Test', version: '1', manifest: {} } : null),
      getAllExtensions: () => [{ id: 'x', path: extDir, name: 'Test', version: '1', manifest: {} }],
      removeExtension: (id) => removed.push(id),
    } };
    EXT.setupExtensionIPC(ses);
    const ipc = m.electron.ipcMain;
    assert.strictEqual((await ipc.invoke('ext:list', {}))[0].source, 'file', 'listed as from a file (not the Web Store)');
    assert.strictEqual(await ipc.invoke('ext:remove', {}, 'x'), true);
    assert.deepStrictEqual(removed, ['x']);
    assert.deepStrictEqual(mem.files['extensions-manual.json'], [], 'won’t load again at the next start');
    assert.ok(!fs.existsSync(extDir), 'its unpacked copy is deleted');
  } finally { m.restore(); }
});
