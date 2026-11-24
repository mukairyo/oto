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
  // one random picture for each place on the page (two different tall ones); null where none could be had
  async function pick() {
    const l = await getList();
    const out = { sky1: null, sky2: null, board: null, rect: null };
    if (!l || !l.items.length) return out;
    const of = (k) => l.items.filter((x) => x.kind === k);
    const take = (arr, not) => { const c = arr.filter((x) => x !== not); return c.length ? c[Math.floor(random() * c.length)] : null; };
    const sky = of('sky'), s1 = take(sky), s2 = take(sky, s1), b = take(of('board')), rc = take(of('rect'));
    await Promise.all([['sky1', s1], ['sky2', s2], ['board', b], ['rect', rc]].map(async ([k, it]) => { if (it) { try { out[k] = await picture(it); } catch {} } }));
    return out;
  }
  return { pick, getList, kindOf, goodImageUrl };
}

module.exports = { createRobloxAds, kindOf, goodImageUrl };
