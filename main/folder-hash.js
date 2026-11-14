'use strict';
// Oto — a fingerprint of an unpacked extension folder (every file's path and contents), so Oto notices when an
// extension added from a folder was changed on disk after you approved it. No Electron here, so it can be unit-tested.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LIMITS = { files: 10000, total: 500 * 1024 * 1024 };

// Returns a hex string, or null if the folder can't be read or is over the limits (treated as "changed").
function folderHash(dir, limits = LIMITS) {
  const list = [];
  let total = 0;
  const walk = (rel) => {
    const abs = path.join(dir, rel);
    for (const d of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isSymbolicLink()) { list.push([r, 'link']); continue; } // never followed; a link appearing counts as a change
      if (d.isDirectory()) { walk(r); continue; }
      if (!d.isFile()) continue;
      const size = fs.statSync(path.join(dir, r)).size;
      total += size;
      if (list.length >= limits.files || total > limits.total) throw new Error('too big');
      list.push([r, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, r))).digest('hex')]);
    }
  };
  try { walk(''); } catch { return null; }
  list.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const h = crypto.createHash('sha256');
  for (const [r, x] of list) h.update(`${r}\0${x}\n`);
  return h.digest('hex');
}

module.exports = { folderHash, LIMITS };
