'use strict';
// Classic Roblox's old ads (1.9.0): the user-made ads collected on the Roblox Wiki's "User Advertisements/Gallery"
// page. They aren't shipped with Oto (they're other people's work): the first time Classic Roblox needs them, Oto
// asks the wiki for the gallery's list of pictures, keeps that list for a week, and downloads a picture only when it
// is about to be shown, then keeps it in Oto's data folder. Everything goes through the browsing session, so it
// follows your VPN, proxy and blocking like any page would.
// Only pictures are ever taken: https from static.wikia.nocookie.net, PNG/JPEG/GIF/WebP, at most 1.5 MB each, and they
// reach the Roblox page only as image data inside Oto's own style sheet (nothing links anywhere, nothing runs).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API = 'https://roblox.fandom.com/api.php';
const PAGE = 'User_Advertisements/Gallery';
const IMG_HOST = 'static.wikia.nocookie.net';
const MIMES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const MAX_BYTES = 1.5 * 1024 * 1024;
const LIST_DAYS = 7;

// the shape of an ad decides where it goes: tall (skyscraper), wide (banner) or boxy (rectangle)
function kindOf(w, h) {
  if (!w || !h) return '';
  const r = w / h;
  if (r >= 4) return 'board';
  if (r <= 0.4) return 'sky';
  if (r >= 0.8 && r <= 1.6) return 'rect';
  return '';
}
function goodImageUrl(u) {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname === IMG_HOST && x.pathname.startsWith('/roblox/images/'); } catch { return false; }
}

// What a picture is, from its first bytes (never its name), and how big it is.
function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 32) return null;
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.slice(0, 6).toString('latin1') === 'GIF87a' || buf.slice(0, 6).toString('latin1') === 'GIF89a') return { mime: 'image/gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') {
    const kind = buf.slice(12, 16).toString('latin1');
    if (kind === 'VP8 ' && buf.length >= 30) return { mime: 'image/webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L' && buf.length >= 25) { const b = buf.readUInt32LE(21); return { mime: 'image/webp', w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
    if (kind === 'VP8X' && buf.length >= 30) return { mime: 'image/webp', w: (buf.readUIntLE(24, 3)) + 1, h: (buf.readUIntLE(27, 3)) + 1 };
    return null;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i < buf.length - 9;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { mime: 'image/jpeg', w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

function createRobloxAds({ dir, fetch: doFetch, now = () => Date.now(), random = Math.random }) {
  const listFile = path.join(dir, 'list.json');
  let list = null, loading = null;
  const ensureDir = () => { try { fs.mkdirSync(dir, { recursive: true }); } catch {} };
  const readList = () => {
    try { const j = JSON.parse(fs.readFileSync(listFile, 'utf8')); if (j && Array.isArray(j.items)) return j; } catch {}
    return null;
  };
  async function fetchList() {
    const items = [];
    let cont = {};
    for (let i = 0; i < 6; i++) {
      const q = new URLSearchParams({ action: 'query', generator: 'images', titles: PAGE, prop: 'imageinfo', iiprop: 'url|size|mime', gimlimit: '500', format: 'json', ...cont });
      const r = await doFetch(`${API}?${q}`);
      if (!r.ok) throw new Error(`wiki ${r.status}`);
      const j = await r.json();
      for (const p of Object.values((j && j.query && j.query.pages) || {})) {
        const info = p && p.imageinfo && p.imageinfo[0];
        if (!info || !goodImageUrl(info.url) || !MIMES[info.mime] || !(info.size > 0) || info.size > MAX_BYTES) continue;
        const kind = kindOf(+info.width, +info.height);
        if (kind) items.push({ u: String(info.url), w: +info.width, h: +info.height, kind });
      }
      if (!j || !j.continue) break;
      cont = Object.fromEntries(Object.entries(j.continue).filter(([k, v]) => /^[a-z]+$/i.test(k) && typeof v === 'string').slice(0, 4));
    }
    return items;
  }
  async function getList() {
    if (list && now() - list.at < LIST_DAYS * 864e5) return list;
    if (!list) list = readList();
    if (list && now() - list.at < LIST_DAYS * 864e5) return list;
    if (!loading) {
      loading = fetchList().then((items) => {
        if (items.length) { list = { at: now(), items }; ensureDir(); try { fs.writeFileSync(listFile, JSON.stringify(list)); } catch {} }
        return list;
      }).catch(() => list).finally(() => { loading = null; });
    }
    return loading;
  }
  async function picture(item) {
    const name = crypto.createHash('sha256').update(item.u).digest('hex').slice(0, 24);
    for (const ext of Object.values(MIMES)) {
      const f = path.join(dir, `${name}.${ext}`);
      try { const b = fs.readFileSync(f); if (b.length && b.length <= MAX_BYTES) return `data:${Object.keys(MIMES).find((m) => MIMES[m] === ext)};base64,${b.toString('base64')}`; } catch {}
    }
    const r = await doFetch(item.u);
    if (!r.ok) throw new Error(`picture ${r.status}`);
    const mime = String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!MIMES[mime]) throw new Error('not a picture');
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) throw new Error('too big');
    ensureDir();
    try { fs.writeFileSync(path.join(dir, `${name}.${MIMES[mime]}`), buf); } catch {}
    return `data:${mime};base64,${buf.toString('base64')}`;
  }
  // Your own copies (1.9.0): pictures you import from a zip or a folder are copied into Oto's data folder and used
  // instead of the wiki (nothing is fetched then). Only real pictures are kept, under Oto's own file names.
  const localDir = path.join(dir, 'imported'), localFile = path.join(localDir, 'list.json');
  let local = null;
  const readLocal = () => { if (local) return local; try { const j = JSON.parse(fs.readFileSync(localFile, 'utf8')); if (j && Array.isArray(j.items)) local = j; } catch {} return local || { items: [] }; };
  function importBuffers(bufs) {
    const items = readLocal().items.slice(), have = new Set(items.map((x) => x.f));
    let added = 0;
    for (const buf of bufs) {
      if (!buf || !buf.length || buf.length > MAX_BYTES) continue;
      const info = sniff(buf);
      const kind = info && kindOf(info.w, info.h);
      if (!kind) continue;
      const f = `${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 24)}.${MIMES[info.mime]}`;
      if (have.has(f)) continue;
      try { fs.mkdirSync(localDir, { recursive: true }); fs.writeFileSync(path.join(localDir, f), buf); } catch { continue; }
      have.add(f); items.push({ f, w: info.w, h: info.h, kind, mime: info.mime }); added++;
    }
    local = { at: now(), items };
    try { fs.mkdirSync(localDir, { recursive: true }); fs.writeFileSync(localFile, JSON.stringify(local)); } catch {}
    return { added, ...counts() };
  }
  function importFrom(p) {
    const st = fs.statSync(p);
    const bufs = [];
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p).slice(0, 2000)) {
        const f = path.join(p, name);
        try { const s2 = fs.lstatSync(f); if (s2.isFile() && s2.size <= MAX_BYTES) bufs.push(fs.readFileSync(f)); } catch {}
      }
    } else {
      if (st.size > 300 * 1024 * 1024) throw new Error('That zip is too big.');
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(fs.readFileSync(p));
      const entries = zip.getEntries();
      if (entries.length > 5000) throw new Error('That zip has too many files.');
      for (const e of entries) { if (!e.isDirectory && e.header.size > 0 && e.header.size <= MAX_BYTES) { try { bufs.push(e.getData()); } catch {} } }
    }
    return importBuffers(bufs);
  }
  function counts() { const it = readLocal().items; return { total: it.length, sky: it.filter((x) => x.kind === 'sky').length, board: it.filter((x) => x.kind === 'board').length, rect: it.filter((x) => x.kind === 'rect').length }; }
  function clearImported() { local = { at: now(), items: [] }; try { fs.rmSync(localDir, { recursive: true, force: true }); } catch {} return counts(); }
  const localPicture = (it) => { const b = fs.readFileSync(path.join(localDir, it.f)); return `data:${it.mime};base64,${b.toString('base64')}`; };

  // one random picture for each place on the page (two different tall ones); null where none could be had
  async function pick() {
    const mine = readLocal().items.filter((x) => /^[a-f0-9]{24}\.(png|jpg|gif|webp)$/.test(x.f));
    if (mine.length) {
      const out = { sky1: null, sky2: null, board: null, rect: null };
      const of = (k) => mine.filter((x) => x.kind === k);
      const take = (arr, not) => { const c = arr.filter((x) => x !== not); return c.length ? c[Math.floor(random() * c.length)] : null; };
      const sky = of('sky'), s1 = take(sky), s2 = take(sky, s1);
      for (const [k, it] of [['sky1', s1], ['sky2', s2], ['board', take(of('board'))], ['rect', take(of('rect'))]]) { if (it) { try { out[k] = localPicture(it); } catch {} } }
      return out;
    }
    const l = await getList();
    const out = { sky1: null, sky2: null, board: null, rect: null };
    if (!l || !l.items.length) return out;
    const of = (k) => l.items.filter((x) => x.kind === k);
    const take = (arr, not) => { const c = arr.filter((x) => x !== not); return c.length ? c[Math.floor(random() * c.length)] : null; };
    const sky = of('sky'), s1 = take(sky), s2 = take(sky, s1), b = take(of('board')), rc = take(of('rect'));
    await Promise.all([['sky1', s1], ['sky2', s2], ['board', b], ['rect', rc]].map(async ([k, it]) => { if (it) { try { out[k] = await picture(it); } catch {} } }));
    return out;
  }
  return { pick, getList, importFrom, importBuffers, clearImported, counts, kindOf, goodImageUrl };
}

module.exports = { createRobloxAds, kindOf, goodImageUrl, sniff };
