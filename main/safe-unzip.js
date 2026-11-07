'use strict';
// Oto — opening extension archives (.crx / .xpi / .zip) safely. No Electron here, so it can be unit-tested.
// Everything is checked before a single file is written: size limits (no "zip bombs") and every path must stay
// inside the target folder (no "../", absolute paths, drive letters or symbolic links).
const fs = require('fs');
const path = require('path');

const LIMITS = { file: 100 * 1024 * 1024, entries: 10000, total: 500 * 1024 * 1024 };

function zipBytes(buf) {
  if (buf.slice(0, 4).toString('latin1') !== 'Cr24') return buf;
  const version = buf.readUInt32LE(4);
  const start = version === 3 ? 12 + buf.readUInt32LE(8) : 16 + buf.readUInt32LE(8) + buf.readUInt32LE(12);
  if (!(start > 0 && start < buf.length)) throw new Error('This .crx file is damaged.');
  return buf.slice(start);
}

function readArchive(fileOrBuf, limits = LIMITS) {
  const AdmZip = require('adm-zip');
  let buf = fileOrBuf;
  if (!Buffer.isBuffer(buf)) {
    if (fs.statSync(fileOrBuf).size > limits.file) throw new Error('This file is too big to be a browser extension (over 100 MB).');
    buf = fs.readFileSync(fileOrBuf);
  } else if (buf.length > limits.file) throw new Error('This file is too big to be a browser extension (over 100 MB).');
  let zip;
  try { zip = new AdmZip(zipBytes(buf)); } catch (e) { throw new Error(/crx/.test(e.message) ? e.message : 'This file is damaged or isn’t a browser extension.'); }
  const entries = zip.getEntries();
  if (entries.length > limits.entries) throw new Error('This extension has too many files.');
  let total = 0;
  const plan = [];
  for (const en of entries) {
    const name = String(en.entryName).replace(/\\/g, '/');
    const parts = name.split('/');
    if (!name || name.startsWith('/') || /^[a-z]:/i.test(name) || parts.includes('..') || name.includes('\0')) throw new Error(`This extension contains an unsafe file path (${name.slice(0, 60)}).`);
    const mode = ((en.header && en.header.attr) >>> 16) & 0o170000;
    if (mode === 0o120000) throw new Error('This extension contains a link to somewhere else on your PC.');
    total += Math.max(0, (en.header && en.header.size) || 0);
    if (total > limits.total) throw new Error('This extension unpacks to more than 500 MB.');
    plan.push({ en, name });
  }
  const me = plan.find((p) => p.name === 'manifest.json');
  if (!me) throw new Error('This file has no manifest.json — it isn’t a browser extension.');
  let manifest;
  try { manifest = JSON.parse(me.en.getData().toString('utf8').replace(/^\uFEFF/, '')); } catch { throw new Error('This extension’s manifest.json is damaged.'); }
  return { zip, plan, manifest, limits };
}

function extractTo(plan, dir, limits = LIMITS) {
  dir = path.resolve(dir);
  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const { en, name } of plan) {
    const out = path.resolve(dir, name);
    if (out !== dir && !out.startsWith(dir + path.sep)) throw new Error('This extension contains an unsafe file path.');
    if (en.isDirectory) { fs.mkdirSync(out, { recursive: true }); continue; }
    const data = en.getData(); // the real size, whatever the archive claimed
    written += data.length;
    if (written > limits.total) throw new Error('This extension unpacks to more than 500 MB.');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, data);
  }
}

module.exports = { readArchive, extractTo, LIMITS };
