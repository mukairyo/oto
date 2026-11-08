'use strict';
// Oto — reading and writing Oto's own JSON files (settings, account, permissions, Shield, passwords …).
// No Electron here, so it can be unit-tested with real files.
// - A missing file gives the fallback.
// - A file that exists but can't be read or parsed is DAMAGED and is never silently replaced: it's moved aside as
//   "<name>.damaged-<time>" (so nothing is lost), or, if even that fails, it becomes read-only for this session
//   (writes to it are refused). onDamaged(name, info) is called once per file.
// - Writes are all-or-nothing and durable: a temporary file is written, flushed to disk (fsync), then swapped in, so
//   a crash or power cut leaves either the old file or the new one, never half of one.
const fs = require('fs');
const path = require('path');

module.exports = function createStore(fileFor, onDamaged = () => {}) {
  const DAMAGED = new Map(); // name -> { aside, readOnly }
  function damaged(name, p, err, fallback) {
    if (!DAMAGED.has(name)) {
      const aside = `${p}.damaged-${Date.now()}`;
      let rec;
      try { fs.renameSync(p, aside); rec = { aside: path.basename(aside), readOnly: false }; } catch { rec = { aside: '', readOnly: true }; }
      DAMAGED.set(name, rec);
      console.warn(`[oto] ${name} could not be read (${(err && err.code) || 'invalid data'}); ${rec.readOnly ? 'kept read-only' : `kept as ${rec.aside}`}`);
      try { onDamaged(name, rec); } catch {}
    }
    return fallback;
  }
  function readJSON(name, fallback) {
    const p = fileFor(name);
    if (DAMAGED.has(name) && DAMAGED.get(name).readOnly) return fallback;
    let text;
    try { text = fs.readFileSync(p, 'utf8'); } catch (e) { return e && e.code === 'ENOENT' ? fallback : damaged(name, p, e, fallback); }
    try { return JSON.parse(text); } catch (e) { return damaged(name, p, e, fallback); }
  }
  function writeJSON(name, data) {
    const json = JSON.stringify(data); // throws before touching the disk if the data can't be saved
    if (typeof json !== 'string') { const e = new Error('nothing to save'); e.code = 'EINVAL'; throw e; }
    writeText(name, json);
  }
  // Same all-or-nothing, flushed write for plain text files (e.g. your own Oto Shield filter rules).
  function writeText(name, text) {
    const d = DAMAGED.get(name);
    if (d && d.readOnly) { const e = new Error(`${name} is damaged and could not be set aside, so Oto won't overwrite it`); e.code = 'EDAMAGED'; throw e; }
    if (typeof text !== 'string') { const e = new Error('nothing to save'); e.code = 'EINVAL'; throw e; }
    const p = fileFor(name), json = text;
    const tmp = `${p}.tmp`;
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, json); fs.fsyncSync(fd); } catch (e) { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(tmp); } catch {} throw e; }
    fs.closeSync(fd);
    fs.renameSync(tmp, p);
  }
  return { readJSON, writeJSON, writeText, damagedFile: (name) => DAMAGED.get(name) || null, damagedList: () => [...DAMAGED] };
};
