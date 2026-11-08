'use strict';
// Item 5 (1.3.3): Oto's updater checks GitHub's signed build record itself before installing an update.
// Uses the real, public record of the published Oto-Setup-1.3.2.exe, then tampers with it in every way that matters.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { verifyBundle, verifyInstaller } = require('../main/attest.js');

const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'attestation-1.3.2.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(FIX.bundle));
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64');
const statement = (b) => JSON.parse(Buffer.from(b.dsseEnvelope.payload, 'base64').toString());

test('the real 1.3.2 build record passes every check', () => {
  assert.deepStrictEqual(verifyBundle(FIX.bundle, FIX.digest), { ref: 'refs/heads/main', signedAt: '2026-11-07T21:36:00.000Z' });
});

test('a record for a different file is refused', () => {
  assert.throws(() => verifyBundle(FIX.bundle, 'a'.repeat(64)), /different file/);
});

test('changing what the record says breaks its signature', () => {
  const b = clone(); const st = statement(b);
  st.subject[0].digest.sha256 = 'b'.repeat(64); b.dsseEnvelope.payload = b64(st);
  assert.throws(() => verifyBundle(b, 'b'.repeat(64)), /bad signature/);
});

test('a signature from any other key is refused', () => {
  const b = clone();
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const payload = Buffer.from(b.dsseEnvelope.payload, 'base64'); const t = Buffer.from(b.dsseEnvelope.payloadType);
  const pae = Buffer.concat([Buffer.from(`DSSEv1 ${t.length} `), t, Buffer.from(` ${payload.length} `), payload]);
  b.dsseEnvelope.signatures[0].sig = crypto.sign('sha256', pae, privateKey).toString('base64');
  assert.throws(() => verifyBundle(b, FIX.digest), /bad signature/);
});

test('a certificate not issued by Sigstore is refused (any change breaks the CA signature)', () => {
  const b = clone();
  // any change to the certificate breaks the CA's signature on it
  const der = Buffer.from(b.verificationMaterial.certificate.rawBytes, 'base64');
  der[der.length - 10] ^= 0xff; // flip a byte in the CA's signature on the certificate
  b.verificationMaterial.certificate.rawBytes = der.toString('base64');
  assert.throws(() => verifyBundle(b, FIX.digest), /Sigstore|certificate/);
});

test('a record built by another repository, workflow or branch is refused', () => {
  assert.throws(() => verifyBundle(FIX.bundle, FIX.digest, { repo: 'someone/else' }), /release workflow/);
  assert.throws(() => verifyBundle(FIX.bundle, FIX.digest, { refs: ['refs/heads/evil'] }), /release workflow/);
});

test('the public log promise must be signed by Sigstore and match this signature and payload', () => {
  let b = clone();
  b.verificationMaterial.tlogEntries[0].integratedTime = String(Number(b.verificationMaterial.tlogEntries[0].integratedTime) + 60);
  assert.throws(() => verifyBundle(b, FIX.digest), /log promise|lifetime/);
  b = clone();
  b.verificationMaterial.tlogEntries[0].inclusionPromise.signedEntryTimestamp = Buffer.alloc(70, 1).toString('base64');
  assert.throws(() => verifyBundle(b, FIX.digest), /log promise/);
  b = clone(); b.verificationMaterial.tlogEntries = [];
  assert.throws(() => verifyBundle(b, FIX.digest), /public log/);
});

test('signed outside the certificate’s 10-minute lifetime is refused', () => {
  const b = clone();
  b.verificationMaterial.tlogEntries[0].integratedTime = String(Number(b.verificationMaterial.tlogEntries[0].integratedTime) + 3600);
  assert.throws(() => verifyBundle(b, FIX.digest), /lifetime/);
});

test('verifyInstaller: hashes the file, asks GitHub, and fails closed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-upd-'));
  const file = path.join(dir, 'Oto-Setup.exe'); fs.writeFileSync(file, 'not the real installer');
  const urls = [];
  // the file doesn't match the record -> refused for good
  await assert.rejects(verifyInstaller(file, async (u) => { urls.push(u); return { attestations: [{ bundle: FIX.bundle }] }; }), (e) => /different file/.test(e.message) && !e.transient);
  assert.match(urls[0], /^https:\/\/api\.github\.com\/repos\/mukairyo\/oto\/attestations\/sha256:[0-9a-f]{64}$/);
  // no record at all -> refused
  await assert.rejects(verifyInstaller(file, async () => { const e = new Error('nf'); e.status = 404; throw e; }), (e) => /no build record/.test(e.message) && !e.transient);
  await assert.rejects(verifyInstaller(file, async () => ({ attestations: [] })), /no build record/);
  // GitHub unreachable -> not installed now, try again later
  await assert.rejects(verifyInstaller(file, async () => { throw new Error('ENOTFOUND'); }), (e) => e.transient === true);
});
