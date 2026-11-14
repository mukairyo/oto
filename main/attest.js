'use strict';
// Oto — checks an update's GitHub build record (a Sigstore "attestation") before it may install. No Electron here,
// so it can be unit-tested.
//
// Why: the updater already checks the file's SHA-512 against latest.yml, but both come from the same release, so
// someone who could replace release files could replace both. This adds an independent check.
//
// The checks:
//   1. GitHub's API returns the signed build record(s) for this exact file (looked up by its SHA-256).
//   2. The record's certificate was issued by Sigstore's public CA (built in below, from Sigstore's trusted root),
//      and names Oto's own release workflow: github.com/mukairyo/oto/.github/workflows/release.yml on main or v1,
//      authenticated by GitHub Actions.
//   3. The certificate's key signed the record, and the record says it describes this file's SHA-256.
//   4. Sigstore's public transparency log (Rekor) vouches, with its signature, for when it was signed (inside the
//      certificate's 10-minute lifetime) and for exactly this signature and payload.
//
// Only a run of Oto's own release workflow can produce a record that passes.
const crypto = require('crypto');
const fs = require('fs');

const REPO = 'mukairyo/oto';
const WORKFLOW = '.github/workflows/release.yml';
const REFS = ['refs/heads/main', 'refs/heads/v1'];
const GH_ISSUER = 'https://token.actions.githubusercontent.com';

// Sigstore public-good trusted root (github.com/sigstore/root-signing, targets/trusted_root.json): the Fulcio CA
// in use since 2022-04-13 (valid to 2031) and the Rekor log key. Public keys only, nothing secret here.
const FULCIO_INTERMEDIATE = `-----BEGIN CERTIFICATE-----
MIICGjCCAaGgAwIBAgIUALnViVfnU0brJasmRkHrn/UnfaQwCgYIKoZIzj0EAwMw
KjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0y
MjA0MTMyMDA2MTVaFw0zMTEwMDUxMzU2NThaMDcxFTATBgNVBAoTDHNpZ3N0b3Jl
LmRldjEeMBwGA1UEAxMVc2lnc3RvcmUtaW50ZXJtZWRpYXRlMHYwEAYHKoZIzj0C
AQYFK4EEACIDYgAE8RVS/ysH+NOvuDZyPIZtilgUF9NlarYpAd9HP1vBBH1U5CV7
7LSS7s0ZiH4nE7Hv7ptS6LvvR/STk798LVgMzLlJ4HeIfF3tHSaexLcYpSASr1kS
0N/RgBJz/9jWCiXno3sweTAOBgNVHQ8BAf8EBAMCAQYwEwYDVR0lBAwwCgYIKwYB
BQUHAwMwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU39Ppz1YkEZb5qNjp
KFWixi4YZD8wHwYDVR0jBBgwFoAUWMAeX5FFpWapesyQoZMi0CrFxfowCgYIKoZI
zj0EAwMDZwAwZAIwPCsQK4DYiZYDPIaDi5HFKnfxXx6ASSVmERfsynYBiX2X6SJR
nZU84/9DZdnFvvxmAjBOt6QpBlc4J/0DxvkTCqpclvziL6BCCPnjdlIB3Pu3BxsP
mygUY7Ii2zbdCdliiow=
-----END CERTIFICATE-----`;
const FULCIO_ROOT = `-----BEGIN CERTIFICATE-----
MIIB9zCCAXygAwIBAgIUALZNAPFdxHPwjeDloDwyYChAO/4wCgYIKoZIzj0EAwMw
KjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0y
MTEwMDcxMzU2NTlaFw0zMTEwMDUxMzU2NThaMCoxFTATBgNVBAoTDHNpZ3N0b3Jl
LmRldjERMA8GA1UEAxMIc2lnc3RvcmUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAT7
XeFT4rb3PQGwS4IajtLk3/OlnpgangaBclYpsYBr5i+4ynB07ceb3LP0OIOZdxex
X69c5iVuyJRQ+Hz05yi+UF3uBWAlHpiS5sh0+H2GHE7SXrk1EC5m1Tr19L9gg92j
YzBhMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRY
wB5fkUWlZql6zJChkyLQKsXF+jAfBgNVHSMEGDAWgBRYwB5fkUWlZql6zJChkyLQ
KsXF+jAKBggqhkjOPQQDAwNpADBmAjEAj1nHeXZp+13NWBNa+EDsDP8G1WWg1tCM
WP/WHPqpaVo0jhsweNFZgSs0eE7wYI4qAjEA2WB9ot98sIkoF3vZYdd3/VtWB5b9
TNMea7Ix/stJ5TfcLLeABLE4BNJOsQ4vnBHJ
-----END CERTIFICATE-----`;
const REKOR_KEY_ID = 'wNI9atQGlz+VWfO6LRygH4QUfY/8W4RFwiT5i5WRgB0=';
const REKOR_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2G2Y+2tabdTV5BcGiBIx0a9fAFwr
kBbmLSGtks4L3qX6yYY0zufBnhC8Ur/iy55GhWP/9A/bY2LhC30M9+RYtw==
-----END PUBLIC KEY-----`;

class AttestError extends Error { constructor(msg, transient = false) { super(msg); this.transient = transient; } }
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const pae = (type, payload) => { const t = Buffer.from(type); return Buffer.concat([Buffer.from(`DSSEv1 ${t.length} `), t, Buffer.from(` ${payload.length} `), payload]); };

function verifyBundle(bundle, digest, opts = {}) {
  const repo = opts.repo || REPO, refs = opts.refs || REFS;
  if (!bundle || !/^application\/vnd\.dev\.sigstore\.bundle(\.v0\.[123])?\+json/.test(bundle.mediaType || '')) throw new AttestError('not a Sigstore bundle');
  const vm = bundle.verificationMaterial || {};
  const der = (vm.certificate && vm.certificate.rawBytes) || (vm.x509CertificateChain && vm.x509CertificateChain.certificates && vm.x509CertificateChain.certificates[0].rawBytes);
  if (!der) throw new AttestError('no certificate');
  const leaf = new crypto.X509Certificate(Buffer.from(der, 'base64'));
  const inter = new crypto.X509Certificate(FULCIO_INTERMEDIATE), root = new crypto.X509Certificate(FULCIO_ROOT);
  // 1. issued by Sigstore's CA
  if (!(leaf.checkIssued(inter) && leaf.verify(inter.publicKey) && inter.checkIssued(root) && inter.verify(root.publicKey) && root.verify(root.publicKey))) throw new AttestError('certificate not from Sigstore');
  // 2. it names Oto's own release workflow, authenticated by GitHub Actions
  const sans = String(leaf.subjectAltName || '').split(/,\s*/);
  const ref = refs.find((r) => sans.includes(`URI:https://github.com/${repo}/${WORKFLOW}@${r}`));
  if (!ref) throw new AttestError('not built by Oto’s release workflow');
  if (!leaf.raw.includes(Buffer.from(GH_ISSUER))) throw new AttestError('not issued for GitHub Actions');
  // 3. the record is signed by that certificate and is about this file
  const env = bundle.dsseEnvelope;
  if (!env || env.payloadType !== 'application/vnd.in-toto+json' || !env.signatures || !env.signatures[0]) throw new AttestError('no signed record');
  const payload = Buffer.from(env.payload, 'base64'), sig = Buffer.from(env.signatures[0].sig, 'base64');
  if (!crypto.verify('sha256', pae(env.payloadType, payload), leaf.publicKey, sig)) throw new AttestError('bad signature');
  let st; try { st = JSON.parse(payload.toString('utf8')); } catch { throw new AttestError('unreadable record'); }
  if (!Array.isArray(st.subject) || !st.subject.some((s) => s && s.digest && s.digest.sha256 === digest)) throw new AttestError('record is for a different file');
  if (!/^https:\/\/slsa\.dev\/provenance\//.test(st.predicateType || '')) throw new AttestError('not a build record');
  const wf = (((st.predicate || {}).buildDefinition || {}).externalParameters || {}).workflow || {};
  if (wf.repository !== `https://github.com/${repo}` || wf.path !== WORKFLOW || wf.ref !== ref) throw new AttestError('record names a different workflow');
  // 4. Sigstore's public log vouches for the time and for exactly this signature and payload
  const e = (vm.tlogEntries || []).find((x) => x && x.logId && x.logId.keyId === REKOR_KEY_ID && x.inclusionPromise);
  if (!e) throw new AttestError('not in Sigstore’s public log');
  const t = Number(e.integratedTime) * 1000;
  if (!(t >= Date.parse(leaf.validFrom) && t <= Date.parse(leaf.validTo))) throw new AttestError('signed outside the certificate’s lifetime');
  const set = JSON.stringify({ body: e.canonicalizedBody, integratedTime: Number(e.integratedTime), logID: Buffer.from(e.logId.keyId, 'base64').toString('hex'), logIndex: Number(e.logIndex) });
  if (!crypto.verify('sha256', Buffer.from(set), crypto.createPublicKey(REKOR_KEY), Buffer.from(e.inclusionPromise.signedEntryTimestamp, 'base64'))) throw new AttestError('log promise not signed by Sigstore');
  let body; try { body = JSON.parse(Buffer.from(e.canonicalizedBody, 'base64').toString('utf8')); } catch { throw new AttestError('unreadable log entry'); }
  const spec = body.spec || {};
  const s0 = (spec.signatures || [])[0] || {};
  let verifierOk = false;
  try { verifierOk = new crypto.X509Certificate(Buffer.from(s0.verifier || '', 'base64').toString('utf8')).raw.equals(leaf.raw); } catch {}
  if (body.kind !== 'dsse' || !spec.payloadHash || spec.payloadHash.value !== sha256(payload) || s0.signature !== env.signatures[0].sig || !verifierOk) throw new AttestError('log entry is for something else');
  return { ref, signedAt: new Date(t).toISOString() };
}

function fileSha256(file) {
  return new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(file).on('error', rej).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))); });
}

// The same, without waiting (used while Oto quits, where nothing asynchronous can run any more).
function fileSha256Sync(file) {
  const h = crypto.createHash('sha256'), fd = fs.openSync(file, 'r'), buf = Buffer.allocUnsafe(1 << 20);
  try { let n; while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n)); } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

// fetchJson(url) -> parsed JSON, throwing an error with .status on HTTP errors. Resolves { ok, digest, ref, signedAt }
// or throws AttestError: transient = couldn't check right now (try later); otherwise the file must not be installed.
async function verifyInstaller(file, fetchJson, opts = {}) {
  const digest = await fileSha256(file);
  let list;
  try { list = await fetchJson(`https://api.github.com/repos/${opts.repo || REPO}/attestations/sha256:${digest}`); }
  catch (err) {
    if (err && err.status === 404) throw new AttestError('no build record for this file');
    throw new AttestError(`couldn’t reach GitHub (${(err && (err.status || err.message)) || 'error'})`, true);
  }
  const atts = (list && list.attestations) || [];
  if (!atts.length) throw new AttestError('no build record for this file');
  const why = [];
  for (const a of atts) { try { return { ok: true, digest, ...verifyBundle(a.bundle, digest, opts) }; } catch (err) { why.push(err.message); } }
  throw new AttestError(`build record check failed: ${[...new Set(why)].join('; ')}`);
}

module.exports = { verifyBundle, verifyInstaller, fileSha256, fileSha256Sync, AttestError };
