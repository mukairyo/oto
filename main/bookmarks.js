'use strict';
// Oto — import bookmarks from Chrome, Edge, Brave, Opera, Vivaldi, Firefox and Zen (moved out of main.js).
const { app, ipcMain } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');

const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const CHROMIUM_BOOKMARKS = {
  chrome: ['Google Chrome', [path.join(local, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks')]],
  edge: ['Microsoft Edge', [path.join(local, 'Microsoft', 'Edge', 'User Data', 'Default', 'Bookmarks')]],
  brave: ['Brave', [path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Bookmarks')]],
  opera: ['Opera', [path.join(roaming, 'Opera Software', 'Opera Stable', 'Default', 'Bookmarks'), path.join(roaming, 'Opera Software', 'Opera Stable', 'Bookmarks')]],
  operagx: ['Opera GX', [path.join(roaming, 'Opera Software', 'Opera GX Stable', 'Default', 'Bookmarks'), path.join(roaming, 'Opera Software', 'Opera GX Stable', 'Bookmarks')]],
  vivaldi: ['Vivaldi', [path.join(local, 'Vivaldi', 'User Data', 'Default', 'Bookmarks')]],
};
const GECKO_PROFILES = {
  zen: ['Zen', path.join(roaming, 'zen', 'Profiles')],
  firefox: ['Firefox', path.join(roaming, 'Mozilla', 'Firefox', 'Profiles')],
};
function geckoPlaces(dir) {
  try {
    return fs.readdirSync(dir).map((p) => path.join(dir, p, 'places.sqlite')).filter((f) => fs.existsSync(f))
      .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0] || null;
  } catch { return null; }
}
function chromiumTree(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const conv = (n) => (n.type === 'folder'
    ? { title: n.name, children: (n.children || []).map(conv).filter(Boolean) }
    : n.url ? { title: n.name, url: n.url } : null);
  const bar = (j.roots.bookmark_bar.children || []).map(conv).filter(Boolean);
  const other = (j.roots.other && j.roots.other.children || []).map(conv).filter(Boolean);
  if (other.length) bar.push({ title: 'Other bookmarks', children: other });
  return bar;
}
function geckoTree(places) {
  const { DatabaseSync } = require('node:sqlite');
  const tmp = path.join(app.getPath('temp'), `oto-places-${Date.now()}.sqlite`);
  fs.copyFileSync(places, tmp); // Firefox/Zen keep the file locked while running
  for (const ext of ['-wal']) { try { fs.copyFileSync(places + ext, tmp + ext); } catch {} }
  const db = new DatabaseSync(tmp, { readOnly: true });
  try {
    const kids = db.prepare('SELECT b.id, b.type, b.title, p.url FROM moz_bookmarks b LEFT JOIN moz_places p ON p.id = b.fk WHERE b.parent = ? ORDER BY b.position');
    const walk = (parent, depth = 0) => kids.all(parent).map((r) => (r.type === 2
      ? (depth < 6 ? { title: r.title || 'Folder', children: walk(r.id, depth + 1) } : null)
      : r.url && /^https?:/.test(r.url) ? { title: r.title || r.url, url: r.url } : null)).filter(Boolean);
    const root = (guid) => { const r = db.prepare('SELECT id FROM moz_bookmarks WHERE guid = ?').get(guid); return r ? r.id : null; };
    const bar = walk(root('toolbar_____'));
    const other = walk(root('unfiled_____'));
    const menu = walk(root('menu________'));
    if (other.length) bar.push({ title: 'Other bookmarks', children: other });
    if (menu.length) bar.push({ title: 'Bookmarks menu', children: menu });
    return bar;
  } finally {
    db.close();
    for (const f of [tmp, `${tmp}-wal`]) { try { fs.unlinkSync(f); } catch {} }
  }
}

function setupBookmarkIPC() {
  ipcMain.handle('bm:sources', () => {
    const out = [];
    for (const [k, [name, files]] of Object.entries(CHROMIUM_BOOKMARKS)) if (files.some((f) => fs.existsSync(f))) out.push({ id: k, name });
    for (const [k, [name, dir]] of Object.entries(GECKO_PROFILES)) if (geckoPlaces(dir)) out.push({ id: k, name });
    return out;
  });
  ipcMain.handle('bm:import', (_e, id) => {
    try {
      if (CHROMIUM_BOOKMARKS[id]) return { ok: true, tree: chromiumTree(CHROMIUM_BOOKMARKS[id][1].find((f) => fs.existsSync(f))) };
      if (GECKO_PROFILES[id]) return { ok: true, tree: geckoTree(geckoPlaces(GECKO_PROFILES[id][1])) };
      return { ok: false, error: 'Browser not found' };
    } catch (err) { return { ok: false, error: err.message }; }
  });
}

module.exports = { setupBookmarkIPC };
