'use strict';
// Oto — where a download is saved. No Electron here, so it can be unit-tested.
// Chromium already cleans file names; this is a second, independent check so a download can never be written outside
// the folder it belongs in, overwrite an existing file, or get a name Windows treats specially.
const fs = require('fs');
const path = require('path');

const RESERVED = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(\..*)?$/i;

function safeDownloadName(name) {
  let n = String(name == null ? '' : name);
  n = n.split(/[\\/]/).pop();                         // never a path, only the last part
  n = n.replace(/[\u0000-\u001f\u007f<>:"|?*‪-‮⁦-⁩]/g, '_'); // control, Windows-illegal and text-direction tricks
  n = n.replace(/[. ]+$/, '');                         // Windows drops trailing dots/spaces (hides the real extension)
  n = n.replace(/^\.+/, '');                           // no hidden or "..", "." names
  if (!n) n = 'download';
  if (RESERVED.test(n)) n = `_${n}`;                   // CON, NUL, COM1 … are devices, not files
  if (n.length > 180) { const ext = path.extname(n).slice(0, 20); n = n.slice(0, 180 - ext.length) + ext; }
  return n;
}

// A free path for `name` inside `dir` ("file (1).pdf", "file (2).pdf" … if taken). Throws if it would leave `dir`.
function downloadPath(dir, name, exists = fs.existsSync) {
  const base = path.resolve(dir);
  const clean = safeDownloadName(name);
  const ext = path.extname(clean), stem = clean.slice(0, clean.length - ext.length) || 'download';
  let file = path.join(base, clean);
  for (let i = 1; exists(file); i++) { file = path.join(base, `${stem} (${i})${ext}`); if (i > 9999) throw new Error('too many files with this name'); }
  if (path.dirname(file) !== base) throw new Error('download path outside the downloads folder');
  return file;
}

module.exports = { safeDownloadName, downloadPath };
