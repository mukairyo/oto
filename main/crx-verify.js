'use strict';
// Oto — checks a Chrome extension package's (CRX3) signatures, the way Chrome does (components/crx_file/crx_verifier.cc).
// No Electron here, so it can be unit-tested.
//
// Why: electron-chrome-web-store only checks that the public key in the file matches the extension's ID. It never
// checks the signatures, so a file with a copied (public) key and different contents would be accepted. Oto checks:
//   1. it's CRX3 (the old CRX2 format is refused, like Chrome does);
//   2. a proof with the extension's own key (the one its ID is made from) is present;
//   3. EVERY signature in the file verifies over the signed header and the whole archive;
//   4. for the Chrome Web Store: Google's Web Store key also signed it (proof it was published through the store).
const crypto = require('crypto');

// SHA-256 of the Chrome Web Store's publisher key ("ecdsa_2017_public"), from Chromium's crx_verifier.cc.
const WEBSTORE_KEY_HASH = '61f7f2a6bfcf74cd0bc1fe2497cc9b04254c658f79f2145392867ea8366367cf';
const CONTEXT = Buffer.from('CRX3 SignedData\x00', 'latin1');
const MAX_HEADER = 1 << 18;

class CrxError extends Error {}

// Minimal protobuf reader: returns [field, wireType, value] for length-delimited and varint fields.
function fields(buf) {
  const out = [];
  let i = 0;
  const varint = () => {
    let v = 0, mul = 1, b;
    do { if (i >= buf.length) throw new CrxError('damaged header'); b = buf[i++]; v += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80 && mul < 2 ** 56);
    if (b & 0x80) throw new CrxError('damaged header');
    return v;
  };
  while (i < buf.length) {
    const key = varint(), field = Math.floor(key / 8), wire = key & 7;
    if (wire === 0) out.push([field, wire, varint()]);
    else if (wire === 2) { const len = varint(); if (i + len > buf.length) throw new CrxError('damaged header'); out.push([field, wire, buf.subarray(i, i + len)]); i += len; }
    else if (wire === 1) { i += 8; } else if (wire === 5) { i += 4; } else throw new CrxError('damaged header');
    if (i > buf.length) throw new CrxError('damaged header');
  }
  return out;
}
const idOf = (key) => crypto.createHash('sha256').update(key).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, (c) => 'abcdefghijklmnop'[parseInt(c, 16)]);

// buf: the whole .crx file. opts.requireWebStore: also require Google's Web Store signature. opts.expectedId: the
// extension ID it must be. Returns { id, archive, publisher } or throws CrxError.
function verifyCrx(buf, opts = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < 12 || buf.toString('latin1', 0, 4) !== 'Cr24') throw new CrxError('not a Chrome extension package');
  const version = buf.readUInt32LE(4);
  if (version !== 3) throw new CrxError(`old or unknown package format (CRX${version}); only CRX3 is accepted`);
  const size = buf.readUInt32LE(8);
  if (size > MAX_HEADER || 12 + size > buf.length) throw new CrxError('damaged header');
  const header = buf.subarray(12, 12 + size), archive = buf.subarray(12 + size);
  const proofs = [];
  let signedHeader = null;
  for (const [f, w, v] of fields(header)) {
    if ((f === 2 || f === 3) && w === 2) {
      const p = { kind: f === 2 ? 'rsa' : 'ecdsa', key: null, sig: null };
      for (const [g, w2, x] of fields(v)) { if (g === 1 && w2 === 2) p.key = x; else if (g === 2 && w2 === 2) p.sig = x; }
      if (!p.key || !p.sig) throw new CrxError('incomplete signature');
      proofs.push(p);
    } else if (f === 10000 && w === 2) signedHeader = v;
  }
  if (!signedHeader) throw new CrxError('no signed header');
  let crxId = null;
  for (const [f, w, v] of fields(signedHeader)) if (f === 1 && w === 2) crxId = v;
  if (!crxId || crxId.length !== 16) throw new CrxError('no extension ID in the signed header');
  const id = crxId.toString('hex').replace(/[0-9a-f]/g, (c) => 'abcdefghijklmnop'[parseInt(c, 16)]);
  if (opts.expectedId && opts.expectedId !== id) throw new CrxError('package is for a different extension');
  const lenLE = Buffer.alloc(4); lenLE.writeUInt32LE(signedHeader.length);
  const data = Buffer.concat([CONTEXT, lenLE, signedHeader, archive]);
  let developer = false, publisher = false;
  for (const p of proofs) {
    let key;
    try { key = crypto.createPublicKey({ key: p.key, format: 'der', type: 'spki' }); } catch { throw new CrxError('unreadable signing key'); }
    if (p.kind === 'rsa' && key.asymmetricKeyType !== 'rsa') throw new CrxError('wrong key type');
    if (p.kind === 'ecdsa' && key.asymmetricKeyType !== 'ec') throw new CrxError('wrong key type');
    let ok = false;
    try { ok = crypto.verify('sha256', data, key, p.sig); } catch {}
    if (!ok) throw new CrxError('a signature doesn’t match (the package was changed or isn’t genuine)');
    if (idOf(p.key) === id) developer = true;
    if (crypto.createHash('sha256').update(p.key).digest('hex') === WEBSTORE_KEY_HASH) publisher = true;
  }
  if (!developer) throw new CrxError('not signed by the extension’s own key');
  if (opts.requireWebStore && !publisher) throw new CrxError('not signed by the Chrome Web Store');
  return { id, archive, publisher };
}

module.exports = { verifyCrx, CrxError, WEBSTORE_KEY_HASH };
