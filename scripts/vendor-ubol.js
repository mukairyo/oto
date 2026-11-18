'use strict';
// Copies the uBlock Origin Lite rules Oto ships with (main/ubol.js) into vendor-ubol/: from a uBOL-home checkout
// (node scripts/vendor-ubol.js <path to uBOL-home>) or straight from uBOL's GitHub at one commit
// (node scripts/vendor-ubol.js --commit <sha>). Only the files Oto uses, each checked like a daily update.
// uBOL is by Raymond Hill, GPLv3: its LICENSE.txt is copied along. (Since 1.7.12 these are the only uBOL rules Oto
// uses: they ship with Oto updates. HASHES.json records each file's SHA-256, checked by test/ubol.test.js.)
const fs = require('fs');
const path = require('path');
const { filesOf, looksRight } = require('../main/ubol.js');

(async () => {
  const out = path.join(__dirname, '..', 'vendor-ubol');
  const args = process.argv.slice(2);
  let get, source = 'local checkout';
  if (args[0] === '--commit') {
    const sha = String(args[1] || ''); source = `uBOL-home ${sha}`;
    if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('give the full commit sha');
    get = async (rel) => { const r = await fetch(`https://raw.githubusercontent.com/uBlockOrigin/uBOL-home/${sha}/chromium/${rel}`); if (!r.ok) { const e = new Error(`${r.status} ${rel}`); e.status = r.status; throw e; } return Buffer.from(await r.arrayBuffer()); };
  } else {
    const src = path.join(path.resolve(args[0] || ''), 'chromium');
    get = async (rel) => { const f = path.join(src, rel); if (!fs.existsSync(f)) { const e = new Error(`missing ${rel}`); e.status = 404; throw e; } return fs.readFileSync(f); };
  }
  const details = JSON.parse((await get('rulesets/scriptlet-details.json')).toString('utf8'));
  fs.rmSync(out, { recursive: true, force: true });
  let n = 0, bytes = 0;
  for (const rel of filesOf(details)) {
    let buf;
    try { buf = await get(rel); } catch (e) { if (e.status === 404 && rel.startsWith('rulesets/regex/')) continue; throw e; }
    if (!looksRight(rel, buf)) throw new Error(`looks wrong: ${rel}`);
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.writeFileSync(path.join(out, rel), buf);
    n++; bytes += buf.length;
  }
  const version = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')).version;
  require('./ubol-hashes.js').write(out, { version, source });
  console.log(`vendor-ubol: uBOL ${version}, ${n} files, ${(bytes / 1048576).toFixed(1)} MB`);
})().catch((e) => { console.error(e.message); process.exit(1); });
