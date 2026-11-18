'use strict';
// vendor-ubol/HASHES.json: the SHA-256 of every file of the uBOL copy Oto ships, with its version and where it came
// from. test/ubol.test.js checks the folder against it, so a change to those files (they run in web pages) can't slip
// in unreviewed: updating them means running scripts/vendor-ubol.js, which writes this file again.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
function list(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...list(f, base));
    else if (e.isFile()) out.push(path.relative(base, f).split(path.sep).join('/'));
    else throw new Error(`not a plain file: ${f}`);
  }
  return out.sort();
}
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function compute(dir) { const files = {}; for (const rel of list(dir)) if (rel !== 'HASHES.json' && rel !== 'README.md') files[rel] = hash(path.join(dir, rel)); return files; }
function write(dir, { version, source }) { fs.writeFileSync(path.join(dir, 'HASHES.json'), `${JSON.stringify({ version, source, files: compute(dir) }, null, 1)}\n`); }
module.exports = { compute, write, list };
if (require.main === module) {
  const dir = path.join(__dirname, '..', 'vendor-ubol');
  const version = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;
  write(dir, { version, source: process.argv[2] || 'uBOL-home main, vendored in Oto 1.7.6 (commit not recorded then)' });
  console.log('vendor-ubol/HASHES.json written');
}
