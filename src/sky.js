'use strict';
/* Oto — Sky View: the SKY side of the space overview (Ctrl+Shift+Space). Every open tab is a star; the tabs of one
   site (or one of your tab folders) make a constellation; each Space is a softly lit region of the sky.

   Built in the order the design review asked for (docs: "Oto Sky View — design & engineering proposal"):
     1. real tabs as stars, click to open       2. Spaces: drag a star into another Space to move the tab
     3. pan, zoom, search, keyboard             4. a preview window with a cached picture (never a live page per star)
     5. the layout is saved and comes back      6. light, twinkle and glides last (and off with reduce-motion)

   The sky only SHOWS tabs: S.tabs / S.workspaces stay the source of truth; every action goes through the same
   functions the sidebar uses (activate, closeTab, togglePin, moveToWorkspace-like moves). Page titles and addresses
   come from websites, so they're only ever drawn as canvas text or DOM text nodes, never as HTML.

   Saved in S.sky (since 1.7.1; v: 3 since 1.7.2, when the stars were scattered at random): pos (tab → where its star is), edges (the lines between stars: a group is stars
   joined by lines), names (tab → its group's name), cam / gcam (where you were looking in Sky / Galaxy). Older skies
   (v: 1, one region per Space) are turned into this the first time, every star staying where it was. */

// ------------------------------------------------------------------ layout engine (pure: no DOM, testable)
const SKY_L = {
  SPACE_W: 1080, SPACE_H: 780,  // one Space's place in the sky (world px)
  SUB_W: 330, SUB_H: 240,       // one constellation's place inside its Space (room for its tab names)
};

/** The same small random numbers every time for the same seed. */
function skyRng(seed) {
  let s = (Math.abs(seed | 0) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
function skyHash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }

/** Free places, nearest the middle first (a bit wider than tall, like a monitor). */
function skySpiral(rings, xBias = 1, yBias = 1.3) {
  const l = [];
  for (let c = -rings; c <= rings; c++) for (let r = -rings; r <= rings; r++) l.push([c, r]);
  return l.sort((a, b) => (Math.max(Math.abs(a[0]) * xBias, Math.abs(a[1]) * yBias) - Math.max(Math.abs(b[0]) * xBias, Math.abs(b[1]) * yBias))
    || (Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0])));
}

/** Places for keys: ones already placed keep theirs; new ones take the nearest free place. Never moves anything. */
function skyAssign(keys, saved, spiral) {
  const out = {}, used = new Set();
  for (const k of keys) { const c = saved && saved[k]; if (Array.isArray(c) && !used.has(`${c[0]},${c[1]}`)) { used.add(`${c[0]},${c[1]}`); out[k] = [c[0], c[1]]; } }
  for (const k of keys) if (!out[k]) {
    const free = spiral.find((p) => !used.has(`${p[0]},${p[1]}`)) || [used.size, 0];
    used.add(`${free[0]},${free[1]}`); out[k] = [free[0], free[1]];
  }
  return out;
}

/** Give each tab without a place the lowest free place in its constellation; keep everyone else's. */
function skySlots(groupTabIds, saved) {
  const out = {};
  const taken = new Set();
  for (const id of groupTabIds) { const s = saved && saved[id]; if (Number.isInteger(s) && s >= 0 && !taken.has(s)) { taken.add(s); out[id] = s; } }
  for (const id of groupTabIds) if (out[id] == null) { let k = 0; while (taken.has(k)) k++; taken.add(k); out[id] = k; }
  return out;
}

/** A made-up constellation shape: a wandering line of stars with the odd branch, never too close together.
 *  Place k depends only on places 0…k-1, so adding places never moves the earlier ones. [x, y, parent] each. */
function skyShape(key, n) {
  const r = skyRng(skyHash(key));
  const pts = [], ang = [];
  for (let k = 0; k < n; k++) {
    if (!k) { pts.push([0, 0, -1]); ang.push(r() * 6.283); continue; }
    let ok = null, okA = 0;
    for (let tries = 0; tries < 24 && !ok; tries++) {
      const parent = k >= 3 && r() < 0.3 ? Math.min(k - 1, Math.floor(r() * k)) : k - 1;
      const a = ang[parent] + (r() - 0.5) * 1.7, l = 62 + r() * 30;
      const x = pts[parent][0] + Math.cos(a) * l, y = pts[parent][1] + Math.sin(a) * l * 0.82;
      if (Math.hypot(x, y) <= 96 + tries * 6 && pts.every((p) => Math.hypot(p[0] - x, p[1] - y) >= 54)) { ok = [x, y, parent]; okA = a; }
    }
    if (!ok) { const a = r() * 6.283; ok = [pts[k - 1][0] + Math.cos(a) * 64, pts[k - 1][1] + Math.sin(a) * 52, k - 1]; okA = a; }
    pts.push(ok); ang.push(okA);
  }
  return pts;
}

/**
 * Where everything goes. tabs: [{id, ws, key, keyName, essential}], spaces: [{id}], saved: S.sky (may be empty).
 * Returns { spaces: [{id, cx, cy, rx, ry}], groups: [{ws, key, name, cx, cy, stars:[{id, x, y, parent}]}], state }
 * where state is the S.sky to save (only places of things that still exist).
 */
function skyLayout(tabs, spaces, saved = {}) {
  const sp = SKY_L;
  const cells = skyAssign(spaces.map((w) => w.id), saved.cells, skySpiral(8, 1, 1.35));
  const state = { cells, groups: {}, slots: {}, offsets: {}, cam: saved.cam || null, gcam: saved.gcam || null, v: 1 };
  const outSpaces = [], outGroups = [];
  const subSpiral = skySpiral(3, 1, 1.25);
  for (const w of spaces) {
    const [c, r] = cells[w.id];
    const cx = c * sp.SPACE_W, cy = r * sp.SPACE_H;
    const mine = tabs.filter((t) => t.ws === w.id);
    const keys = [...new Set(mine.map((t) => t.key))];
    const gSaved = {};
    for (const k of keys) { const g = saved.groups && saved.groups[`${w.id}|${k}`]; if (g) gSaved[k] = g; }
    const places = skyAssign(keys, gSaved, subSpiral);
    let ext = [0, 0, 0, 0]; // furthest sub-places used (for the Space's outline)
    for (const k of keys) {
      state.groups[`${w.id}|${k}`] = places[k];
      const [sc, sr] = places[k];
      ext = [Math.min(ext[0], sc), Math.max(ext[1], sc), Math.min(ext[2], sr), Math.max(ext[3], sr)];
      const jr = skyRng(skyHash(k) ^ 0x5bd1);
      const gx = cx + sc * sp.SUB_W + (jr() - 0.5) * 30, gy = cy + sr * sp.SUB_H + (jr() - 0.5) * 24;
      const gt = mine.filter((t) => t.key === k);
      const slots = skySlots(gt.map((t) => t.id), saved.slots);
      Object.assign(state.slots, slots);
      const n = Math.max(gt.length, ...gt.map((t) => slots[t.id] + 1));
      const shape = skyShape(k, n);
      const bySlot = new Map();
      const stars = [];
      for (const t of [...gt].sort((a, b) => slots[a.id] - slots[b.id])) {
        const s = slots[t.id];
        let p = shape[s][2];
        while (p >= 0 && !bySlot.has(p)) p = shape[p][2]; // a line goes to the nearest place above it that has a tab
        const off = saved.offsets && saved.offsets[t.id];
        if (Array.isArray(off)) state.offsets[t.id] = off;
        bySlot.set(s, stars.length);
        stars.push({ id: t.id, x: gx + shape[s][0] + (off ? off[0] : 0), y: gy + shape[s][1] + (off ? off[1] : 0), parent: p >= 0 ? bySlot.get(p) : -1 });
      }
      // two stars side by side: the second one's name goes above it, so the names don't run into each other
      stars.forEach((st, i) => { st.up = stars.slice(0, i).some((o) => !o.up && Math.abs(o.x - st.x) < 200 && Math.abs(o.y - st.y) < 44); });
      outGroups.push({ ws: w.id, key: k, name: gt[0].keyName, cx: gx, cy: gy, stars });
    }
    const rx = Math.max(300, (Math.max(-ext[0], ext[1]) + 0.5) * sp.SUB_W + 140);
    const ry = Math.max(230, (Math.max(-ext[2], ext[3]) + 0.5) * sp.SUB_H + 120);
    outSpaces.push({ id: w.id, cx, cy, rx: Math.min(rx, sp.SPACE_W / 2 - 20), ry: Math.min(ry, sp.SPACE_H / 2 - 16) });
  }
  return { spaces: outSpaces, groups: outGroups, state };
}

/**
 * The free sky (Sky View since 1.7.1): every star sits wherever you put it, and groups are the lines you draw between
 * stars (like a constellation on a star chart). Nothing moves on its own: a new tab's star appears next to the stars of
 * its site (joined to them by a line), or near the middle of the sky if it's the first of its site. Closing a tab that
 * held a group together joins its neighbours to each other, so the group stays one group.
 * tabs: [{id, key, keyName}] (key = site or folder), saved: { pos: {id: [x, y]}, edges: [[a, b]], names: {id: name} }.
 * seed (first time only): { pos, edges } from the old layout. Returns { stars, edges, groups, state }.
 */
function skyFree(tabs, saved = {}, seed = null) {
  const ids = new Set(tabs.map((t) => t.id));
  const first = !saved.pos || !Object.keys(saved.pos).length;
  const srcPos = first && seed ? seed.pos : (saved.pos || {});
  let srcEdges = first && seed ? seed.edges : (saved.edges || []);
  // closed tabs: their neighbours are joined in a chain, so a group never falls apart because one star went
  const adj = new Map();
  const link = (a, b) => { if (a === b) return; (adj.get(a) || adj.set(a, new Set()).get(a)).add(b); (adj.get(b) || adj.set(b, new Set()).get(b)).add(a); };
  for (const e of srcEdges) if (Array.isArray(e) && e.length === 2) link(e[0], e[1]);
  for (const gone of [...adj.keys()].filter((k) => !ids.has(k))) {
    const nb = [...(adj.get(gone) || [])].filter((k) => k !== gone).sort();
    for (const k of nb) adj.get(k).delete(gone);
    adj.delete(gone);
    for (let i = 1; i < nb.length; i++) link(nb[i - 1], nb[i]);
  }
  const edges = [], seen = new Set();
  for (const [a, set] of adj) for (const b of set) {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!seen.has(k) && ids.has(a) && ids.has(b)) { seen.add(k); edges.push(a < b ? [a, b] : [b, a]); }
  }
  const pos = {};
  for (const t of tabs) { const p = srcPos[t.id]; if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) pos[t.id] = [Math.round(p[0]), Math.round(p[1])]; }
  // a sky from before 1.7.2 (stars in rows): scattered around the sky at random, every group keeping its shape
  if (saved.v !== 3) Object.assign(pos, skyScatter(tabs.map((t) => t.id).filter((id) => pos[id]), pos, edges));
  // new tabs: a random free spot near their site's stars (joined to the nearest one), else somewhere random in the sky
  const GAP = 110;
  const freeAt = (x, y) => Object.values(pos).every((q) => Math.hypot(q[0] - x, q[1] - y) >= GAP);
  for (const t of tabs) {
    if (pos[t.id]) continue;
    const mates = tabs.filter((o) => o.id !== t.id && o.key === t.key && pos[o.id]);
    const all = Object.values(pos);
    const mid = all.length ? [all.reduce((a, q) => a + q[0], 0) / all.length, all.reduce((a, q) => a + q[1], 0) / all.length] : [0, 0];
    const anchor = mates.length ? pos[mates[mates.length - 1].id] : mid;
    const r = skyRng(skyHash(String(t.id)) ^ all.length);
    const spread = mates.length ? 110 : 160 + Math.sqrt(all.length + 1) * 150;
    let spot = null;
    for (let k = 0; k < 400 && !spot; k++) {
      const grow = 1 + k / 40, a = r() * Math.PI * 2;
      const d = mates.length ? (110 + r() * 70) * grow : (all.length ? 0.35 + 0.65 * Math.sqrt(r()) : Math.sqrt(r()) * 0.3) * spread * grow;
      const x = anchor[0] + Math.cos(a) * d, y = anchor[1] + Math.sin(a) * d * 0.72;
      if (freeAt(x, y)) spot = [Math.round(x), Math.round(y)];
    }
    pos[t.id] = spot || [Math.round(anchor[0] + 120), Math.round(anchor[1])];
    if (mates.length) {
      const near = mates.map((o) => ({ o, d: Math.hypot(pos[o.id][0] - pos[t.id][0], pos[o.id][1] - pos[t.id][1]) })).sort((a, b) => a.d - b.d)[0].o;
      const e = near.id < t.id ? [near.id, t.id] : [t.id, near.id];
      if (!seen.has(e.join('|'))) { seen.add(e.join('|')); edges.push(e); }
    }
  }
  // groups: stars joined by lines. A group keeps the name it had (or you gave it); a new one is named after its site,
  // or, if it mixes sites, gets an invented star-chart name
  const comp = new Map(), byId = new Map(tabs.map((t) => [t.id, t]));
  const nb = new Map(); for (const [a, b] of edges) { (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); }
  const groups = [], names = {}, oldNames = saved.names || {};
  const taken = new Set(Object.values(oldNames));
  for (const t of tabs) {
    if (comp.has(t.id)) continue;
    const list = [], q = [t.id]; comp.set(t.id, groups.length);
    while (q.length) { const x = q.shift(); list.push(x); for (const y of nb.get(x) || []) if (!comp.has(y)) { comp.set(y, groups.length); q.push(y); } }
    let name;
    if (list.length > 1) {
      const votes = {}; for (const x of list) if (oldNames[x]) votes[oldNames[x]] = (votes[oldNames[x]] || 0) + 1;
      name = Object.keys(votes).sort((a, b) => votes[b] - votes[a] || a.localeCompare(b))[0];
      if (!name) {
        const keys = new Set(list.map((x) => byId.get(x).key));
        name = keys.size === 1 ? byId.get(list[0]).keyName : skyMadeUpName(skyRng(skyHash([...list].sort().join(','))), taken);
        taken.add(name);
      }
      for (const x of list) names[x] = name;
    } else name = byId.get(list[0]).keyName;
    groups.push({ name, ids: list, lone: list.length === 1, key: byId.get(list[0]).key });
  }
  const stars = tabs.map((t) => ({ id: t.id, x: pos[t.id][0], y: pos[t.id][1], group: comp.get(t.id) }));
  return { stars, edges, groups, state: { pos, edges, names, cam: saved.cam || null, gcam: saved.gcam || null, v: 3 } };
}

/**
 * Scatter stars around the sky at random (not in rows): each group (stars joined by lines) is moved as one piece, so it
 * keeps its shape, and lone stars land wherever there's room. The sky grows with the number of stars.
 */
function skyScatter(ids, pos, edges, seed = 2026) {
  const nb = new Map(); for (const [a, b] of edges) { (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); }
  const seen = new Set(), comps = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const list = [], q = [id]; seen.add(id);
    while (q.length) { const x = q.shift(); list.push(x); for (const y of nb.get(x) || []) if (!seen.has(y) && pos[y]) { seen.add(y); q.push(y); } }
    comps.push(list);
  }
  comps.sort((a, b) => b.length - a.length);
  const r = skyRng(seed ^ ids.length), out = {}, placed = [];
  const R0 = 220 + Math.sqrt(ids.length) * 170;
  for (const list of comps) {
    const cx0 = list.reduce((a, id) => a + pos[id][0], 0) / list.length, cy0 = list.reduce((a, id) => a + pos[id][1], 0) / list.length;
    const shape = list.map((id) => [id, pos[id][0] - cx0, pos[id][1] - cy0]);
    let at = null;
    for (let k = 0; k < 600 && !at; k++) {
      const a = r() * Math.PI * 2, d = (placed.length ? Math.sqrt(r()) : 0.25 * r()) * R0 * (1 + k / 80);
      const cx = Math.cos(a) * d, cy = Math.sin(a) * d * 0.72;
      if (shape.every(([, dx, dy]) => placed.every((p) => Math.hypot(p[0] - cx - dx, p[1] - cy - dy) >= 130))) at = [cx, cy];
    }
    if (!at) at = [R0 * (1 + placed.length * 0.1), 0];
    for (const [id, dx, dy] of shape) { const p = [Math.round(at[0] + dx), Math.round(at[1] + dy)]; out[id] = p; placed.push(p); }
  }
  return out;
}

/**
 * The galaxy: every Space is a spiral arm and time runs outwards — the middle is now, and the longer ago you last used a
 * tab, the further out along its Space's arm it sits (1 hour, 1 day, 1 week rings). Essentials circle the core.
 * tabs: [{id, ws, essential, active, lastActive}], spaces: [{id}], now: ms. Positions are polar (r, th) so the galaxy
 * can turn; x = cos(th + turn)·r, y = sin(th + turn)·r·TILT.
 */
const GAL = { R0: 120, RMAX: 640, B: 0.55, TILT: 0.62, CORE: 62, OLD: 20160 /* minutes: two weeks */ };
const galR = (ageMin) => GAL.R0 + (GAL.RMAX - GAL.R0) * Math.log(1 + Math.max(0, ageMin)) / Math.log(1 + GAL.OLD);
const galTh = (r, off) => off + Math.log(Math.max(r, GAL.R0) / GAL.R0) / GAL.B;
function galaxyLayout(tabs, spaces, now = Date.now()) {
  const n = Math.max(1, spaces.length);
  const arms = spaces.map((w, i) => ({ ws: w.id, off: (i / n) * Math.PI * 2 - Math.PI / 2 }));
  const stars = [];
  for (const arm of arms) {
    const mine = tabs.filter((t) => !t.essential && t.ws === arm.ws)
      .map((t) => ({ t, r: galR(t.active ? 0 : t.lastActive ? (now - t.lastActive) / 60000 : GAL.OLD) }))
      .sort((a, b) => a.r - b.r || String(a.t.id).localeCompare(String(b.t.id)));
    let prev = -Infinity;
    for (const m of mine) { const r = Math.max(m.r, prev + 52); prev = r; stars.push({ id: m.t.id, ws: arm.ws, r, th: galTh(r, arm.off) }); }
    arm.end = Math.max(GAL.RMAX, prev + 60);
  }
  const ess = tabs.filter((t) => t.essential);
  ess.forEach((t, k) => stars.push({ id: t.id, ws: '__essentials', r: GAL.CORE, th: (k / ess.length) * Math.PI * 2 }));
  return { arms, stars, rings: [['1 HOUR', galR(60)], ['1 DAY', galR(1440)], ['1 WEEK', galR(10080)]], rMax: Math.max(GAL.RMAX, ...arms.map((a) => a.end)) };
}

// (the unit tests load this file in Node: below here only declares things; nothing runs until the overview mounts it)
if (typeof module !== 'undefined') module.exports = { skyLayout, skyAssign, skySlots, skyShape, skySpiral, SKY_L, galaxyLayout, GAL, skyFree, skyScatter };

// ------------------------------------------------------------------ the view
const SKY = {
  on: false, layer: null, canvas: null, ctx: null, card: null, help: null,
  lay: null, starById: new Map(), spaceById: new Map(),
  cam: { x: 0, y: 0, z: 1 }, glide: null, raf: 0, twinkle: 0,
  hover: null, sel: null, drag: null, pan: null, query: '', words: [],
  dpr: 1, w: 0, h: 0,
  mode: 'sky', gal: null, turn: 0, lastT: 0, // Galaxy view: its layout and how far it has turned
};
const SKY_C = { bg: '#07080B', surf: '#111318', tx: '#F1EEE8', tx2: '#AAA8A5', hi: '#A8E7F3', red: '#D87979' };
const skyMotion = () => !S.settings.reduceMotion && S.settings.animations !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What the sky shows for a tab (its constellation is its folder, else its site). */
function skyTabInfo(t) {
  const f = t.v1f && typeof v1Folder === 'function' ? v1Folder(t.v1f) : null;
  const host = hostOf(t.url) || (String(t.url).startsWith('oto:') ? 'oto' : 'page');
  const site = host === 'oto' ? 'Oto' : (host.split('.').slice(-2)[0] || host).replace(/^./, (m) => m.toUpperCase());
  return { key: f ? `f:${f.id}` : host, keyName: f ? f.name : site };
}

function skyRelayout() {
  if (SKY.mode === 'galaxy') return galaxyRelayout();
  const tabs = S.tabs.map((t) => ({ id: t.id, ...skyTabInfo(t) }));
  let seed = null;
  if (!S.sky || !S.sky.v || S.sky.v < 2) { // from the Space layout of 1.6.8–1.7.0: every group keeps its shape and lines (then scattered)
    const spaces = S.workspaces.map((w) => ({ id: w.id }));
    if (essentials().length) spaces.unshift({ id: '__essentials' });
    const old = skyLayout(S.tabs.map((t) => ({ id: t.id, ws: t.essential ? '__essentials' : t.ws, ...skyTabInfo(t) })), spaces, (S.sky && S.sky.v === 1) ? S.sky : {});
    seed = { pos: {}, edges: [] };
    // (the Spaces' regions are gone, so they're drawn in closer together: every constellation keeps its shape)
    const cen = new Map(old.spaces.map((q) => [q.id, q]));
    for (const g of old.groups) g.stars.forEach((st) => { const q = cen.get(g.ws) || { cx: 0, cy: 0 }; seed.pos[st.id] = [st.x - q.cx * 0.5, st.y - q.cy * 0.5]; if (st.parent >= 0) seed.edges.push([g.stars[st.parent].id, st.id]); });
    S.sky = { cam: null, gcam: (S.sky && S.sky.gcam) || null };
  }
  const lay = skyFree(tabs, S.sky || {}, seed);
  S.sky = lay.state; save();
  SKY.lay = { stars: lay.stars, edges: lay.edges, groups: lay.groups, spaces: [] };
  SKY.starById = new Map();
  for (const st of lay.stars) SKY.starById.set(st.id, { ...st, g: lay.groups[st.group] });
  SKY.spaceById = new Map();
}

function galaxyRelayout() {
  // (1.7.10) The Galaxy shows the galaxy and your devices only: your tabs live in Sky. The galaxy's shape is fixed.
  SKY.gal = { arms: [], rings: [], offs: [-Math.PI / 2, Math.PI / 2], rMax: GAL.RMAX };
  SKY.lay = { spaces: [], groups: [] }; SKY.decor = [];
  SKY.spaceById = new Map();
  SKY.starById = new Map();
}
/** Where the stars are now that the galaxy has turned. */
function galaxyPlace() {
  for (const s of SKY.starById.values()) { s.x = Math.cos(s.th + SKY.turn) * s.r; s.y = Math.sin(s.th + SKY.turn) * s.r * GAL.TILT; }
}
const skyWs = (id) => (id === '__essentials' ? { id, name: 'Essentials', ess: true } : S.workspaces.find((w) => w.id === id));
function skySpaceColor(id) {
  if (id === '__essentials') return '#E7DFD1';
  const w = skyWs(id); const c = w && themeOf(w).colors;
  return (c && c[0]) || '#8F87D6';
}
function skyRgba(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  const n = m ? parseInt(m[1], 16) : 0x8f87d6;
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function skyMatch(t) { if (!SKY.words.length) return true; const s = `${t.title} ${t.url} ${(skyWs(t.essential ? '__essentials' : t.ws) || {}).name || ''}`.toLowerCase(); return SKY.words.every((w) => s.includes(w)); }

// world ⇄ screen
const skyToScreen = (x, y) => [(x - SKY.cam.x) * SKY.cam.z + SKY.w / 2, (y - SKY.cam.y) * SKY.cam.z + SKY.h / 2];
const skyToWorld = (x, y) => [(x - SKY.w / 2) / SKY.cam.z + SKY.cam.x, (y - SKY.h / 2) / SKY.cam.z + SKY.cam.y];

function skyFitAll() {
  if (SKY.mode === 'galaxy') { // the whole galaxy with its arms' names, clear of the top bar and the bottom controls
    const R = SKY.gal.rMax + 150;
    const z = clamp(Math.min((SKY.w - 120) / (2 * R), (SKY.h - 220) / (2 * R * GAL.TILT + 70)), 0.22, 1.2);
    return { x: 0, y: -10 / z, z };
  }
  return skyFitStars([...SKY.starById.values()]);
}
/** A view with all these stars in it (clear of the top bar and the controls). */
function skyFitStars(list) {
  if (!list.length) return { x: 0, y: 0, z: 1 };
  const x0 = Math.min(...list.map((q) => q.x)) - 190, x1 = Math.max(...list.map((q) => q.x)) + 190;
  const y0 = Math.min(...list.map((q) => q.y)) - 120, y1 = Math.max(...list.map((q) => q.y)) + 110;
  const z = clamp(Math.min((SKY.w - 80) / (x1 - x0), (SKY.h - 200) / (y1 - y0)), 0.3, 1.1);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 10 / z, z };
}

function skyGlideTo(to, ms = 260) {
  if (!skyMotion()) { Object.assign(SKY.cam, to); skyDraw(); return; }
  const from = { ...SKY.cam }, t0 = performance.now();
  SKY.glide = (now) => {
    const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    SKY.cam.x = from.x + (to.x - from.x) * e; SKY.cam.y = from.y + (to.y - from.y) * e; SKY.cam.z = from.z + (to.z - from.z) * e;
    if (p >= 1) SKY.glide = null;
  };
  skyKick();
}
/** Fly to a Space (1–9 in Sky View). */
function skyGoSpace(id, ms = 380) {
  if (SKY.mode === 'galaxy') { // fly to the Space's arm: around its most recent tabs
    const st = [...SKY.starById.values()].filter((s) => s.ws === id).sort((a, b) => a.r - b.r).slice(0, 4);
    if (st.length) skyGlideTo({ x: st.reduce((a, s) => a + s.x, 0) / st.length, y: st.reduce((a, s) => a + s.y, 0) / st.length, z: 1 }, ms);
    return;
  }
  if (SKY.mode === 'sky') { // Sky has no Space regions: show that Space's stars
    const list = [...SKY.starById.values()].filter((st) => { const t = tabById(st.id); return t && (id === '__essentials' ? t.essential : !t.essential && t.ws === id); });
    if (list.length) { skyGlideTo(skyFitStars(list), ms); setTimeout(() => { skyUpdateZoom(); skySaveCam(); }, ms + 20); }
    return;
  }
  const sp = SKY.spaceById.get(id); if (sp) { skyGlideTo({ x: sp.cx, y: sp.cy, z: clamp(Math.min((SKY.w - 80) / (sp.rx * 2), (SKY.h - 140) / (sp.ry * 2)), 0.4, 1.4) }, ms); setTimeout(() => { skyUpdateZoom(); skySaveCam(); }, ms + 20); } }
function skyFocusStar(id, z) { const s = SKY.starById.get(id); if (s) skyGlideTo({ x: s.x, y: s.y, z: z || Math.max(SKY.cam.z, 0.9) }); }

// ------------------------------------------------------------------ the Android look: the website's own starfield
// The same space as Oto for Android and the website: the black sky (#030304) with the site's starfield (img/space.webp,
// the 2400 px picture shown as a 1200 px tile), drifting a little slower than your tabs as you look around.
const SKY_FIELD = { img: null, pat: null, ready: false };
function skyBackdrop(c, deep = true) {
  const { w, h } = SKY;
  c.fillStyle = '#030304'; c.fillRect(0, 0, w, h);
  if (!SKY_FIELD.img && typeof Image === 'function') {
    SKY_FIELD.img = new Image();
    SKY_FIELD.img.onload = () => { SKY_FIELD.ready = true; SKY_FIELD.pat = null; if (SKY.on) skyDraw(); };
    SKY_FIELD.img.src = 'img/space.webp';
  }
  if (SKY_FIELD.ready) {
    // (the tile is shrunk once, at the screen's pixel size, so each frame only copies it instead of resampling the
    // whole 2400 px picture: that was most of a frame's work, 1.7.10)
    const dpr = SKY.dpr || 1, k = 0.12;
    if (!SKY_FIELD.pat || SKY_FIELD.patDpr !== dpr) {
      const tw = Math.round(SKY_FIELD.img.naturalWidth * 0.5 * dpr), th = Math.round(SKY_FIELD.img.naturalHeight * 0.5 * dpr);
      const tile = document.createElement('canvas'); tile.width = tw; tile.height = th;
      const tc = tile.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(SKY_FIELD.img, 0, 0, tw, th);
      SKY_FIELD.pat = c.createPattern(tile, 'repeat'); SKY_FIELD.patDpr = dpr;
    }
    if (SKY_FIELD.pat && SKY_FIELD.pat.setTransform && typeof DOMMatrix === 'function') {
      // whole device pixels only, so the copy never has to blend between pixels
      const ox = Math.round(-SKY.cam.x * k * dpr) / dpr, oy = Math.round(-SKY.cam.y * k * dpr) / dpr;
      SKY_FIELD.pat.setTransform(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, ox, oy]));
      c.fillStyle = SKY_FIELD.pat; c.fillRect(0, 0, w, h);
    }
  }
  if (deep) skyDeepField(c);
}

// Made-up constellations that fill the sky around your tabs, like on Android: 1 to 18 faint stars each, with an
// invented star-chart name (never a real one). Scenery only: not tabs, not clickable. A new sky each time Oto starts.
const SKY_SEED = (Math.random() * 2e9) | 0;
const SKY_REAL = new Set(('andromeda antlia apus aquarius aquila ara aries auriga bootes caelum camelopardalis cancer canes canis capricornus ' +
  'carina cassiopeia centaurus cepheus cetus chamaeleon circinus columba coma corona corvus crater crux cygnus delphinus dorado draco ' +
  'equuleus eridanus fornax gemini grus hercules horologium hydra hydrus indus lacerta leo lepus libra lupus lynx lyra mensa ' +
  'microscopium monoceros musca norma octans ophiuchus orion pavo pegasus perseus phoenix pictor pisces puppis pyxis reticulum sagitta ' +
  'sagittarius scorpius sculptor scutum serpens sextans taurus telescopium triangulum tucana ursa vela virgo volans vulpecula argo sirius ' +
  'vega rigel deneb altair antares polaris castor pollux spica arcturus capella aldebaran betelgeuse procyon regulus canopus mira algol ' +
  'alcor mizar electra maia atlas pleione merope taygeta celaeno sterope bellatrix nova sol luna terra mars venus saturn jupiter pluto ' +
  'titan europa io ceres').split(' '));
const SKY_NAME = {
  start: ['Ka', 'Vel', 'Thyr', 'Nae', 'Lu', 'Sar', 'Ix', 'Mor', 'Ael', 'Qua', 'Ren', 'Syl', 'Tor', 'Eth', 'Zan', 'Cal', 'Vey', 'Dra', 'Ost', 'Pha', 'Kre', 'Yl', 'Bre', 'Hal', 'Ner', 'Ulm', 'Fae', 'Gor', 'Ish', 'Jov', 'Ske', 'Wen'],
  mid: ['', '', '', 'ra', 'len', 've', 'th', 'mi', 'ro', 'sa', 'ky', 'do', 'ne', 'lo'],
  end: ['is', 'a', 'on', 'ae', 'us', 'ix', 'ara', 'el', 'yr', 'os', 'eth', 'une', 'ia', 'or', 'ith', 'ux'],
};
function skyMadeUpName(r, taken) {
  const pick = (a) => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
  for (let i = 0; i < 40; i++) {
    const n = pick(SKY_NAME.start) + pick(SKY_NAME.mid) + pick(SKY_NAME.end), low = n.toLowerCase();
    if (/([a-z])\1/.test(low) || SKY_REAL.has(low) || taken.has(n) || n.length < 4 || n.length > 10) continue;
    if ([...SKY_REAL].some((x) => (x.length >= 4 && low.startsWith(x)) || (x.length >= 5 && low.includes(x)))) continue;
    return n;
  }
  return 'Ulvarion';
}
/** A wandering line of stars with the odd branch, never too close together (the same shapes Android draws). */
function skyDecorShape(r, n, stepMin, stepVar, minGap, reach) {
  const pts = [], ang = [];
  for (let k = 0; k < n; k++) {
    if (!k) { pts.push([0, 0, -1]); ang.push(r() * 6.283); continue; }
    let ok = null, okA = 0;
    for (let tries = 0; tries < 24 && !ok; tries++) {
      const parent = k >= 3 && r() < 0.3 ? Math.min(k - 1, Math.floor(r() * k)) : k - 1;
      const a = ang[parent] + (r() - 0.5) * 1.7, l = stepMin + r() * stepVar;
      const x = pts[parent][0] + Math.cos(a) * l, y = pts[parent][1] + Math.sin(a) * l;
      if (Math.hypot(x, y) <= reach + tries * 6 && pts.every((q) => Math.hypot(q[0] - x, q[1] - y) >= minGap)) { ok = [x, y, parent]; okA = a; }
    }
    if (!ok) { const a = r() * 6.283; ok = [pts[k - 1][0] + Math.cos(a) * (stepMin + 2), pts[k - 1][1] + Math.sin(a) * (stepMin + 2), k - 1]; okA = a; }
    pts.push(ok); ang.push(okA);
  }
  return pts;
}
/** The scenery: an endless sky in squares, each made once (the same all session), never too close to your stars. */
const SKY_SCN = new Map(), SKY_SCN_NAMES = new Set();
const SKY_SCN_CELL = 680; // (one made-up constellation in about every third square: a few here and there, not a crowd)
function skySceneryCell(i, j) {
  const key = `${i},${j}`;
  if (SKY_SCN.has(key)) return SKY_SCN.get(key);
  const r = skyRng(SKY_SEED ^ Math.imul(i, 73856093) ^ Math.imul(j, 19349663));
  let dc = null;
  if (r() < 0.34) {
    const n = 1 + Math.min(17, Math.floor(Math.pow(r(), 1.7) * 18)); // mostly small ones, the odd big one
    const px = (i + 0.5) * SKY_SCN_CELL + (r() - 0.5) * 70, py = (j + 0.5) * SKY_SCN_CELL + (r() - 0.5) * 70;
    const pts = skyDecorShape(r, n, 36, 30, 32, 48 + n * 5.5);
    const name = skyMadeUpName(r, SKY_SCN_NAMES); SKY_SCN_NAMES.add(name); // (no two the same in one sky)
    dc = { name, cx: px, cy: py, pts: pts.map(([x, y, p], k) => ({ x: px + x, y: py + y, p, size: 1 + r() * 1.1, a: 0.35 + r() * 0.45, ph: k * 2.7 + (skyHash(name) % 7), sp: 0.7 + ((k * 37 + name.length * 11) % 10) / 16 })) };
  }
  SKY_SCN.set(key, dc);
  return dc;
}
function skyScenery() { /* made as you look around (skySceneryCell) */ }
let SKY_DOT = null;
function skyDotSprite() {
  if (SKY_DOT) return SKY_DOT;
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d'), g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(232,238,255,1)'); g.addColorStop(0.25, 'rgba(232,238,255,.33)'); g.addColorStop(1, 'rgba(232,238,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  c.fillStyle = '#FFFAF2'; c.beginPath(); c.moveTo(16, 9); c.quadraticCurveTo(16, 16, 23, 16); c.quadraticCurveTo(16, 16, 16, 23); c.quadraticCurveTo(16, 16, 9, 16); c.quadraticCurveTo(16, 16, 16, 9); c.fill();
  return (SKY_DOT = cv);
}
function skyDrawScenery(c, now) {
  const z = SKY.cam.z, { w, h } = SKY, dot = skyDotSprite();
  const [wx0, wy0] = skyToWorld(-80, -80), [wx1, wy1] = skyToWorld(w + 80, h + 80);
  const stars = [...SKY.starById.values()];
  SKY.decor = [];
  for (let j = Math.floor(wy0 / SKY_SCN_CELL) - 1; j <= Math.floor(wy1 / SKY_SCN_CELL) + 1; j++) for (let i = Math.floor(wx0 / SKY_SCN_CELL) - 1; i <= Math.floor(wx1 / SKY_SCN_CELL) + 1; i++) {
    const dc = skySceneryCell(i, j);
    if (dc && !stars.some((st) => Math.abs(st.x - dc.cx) < 300 && Math.abs(st.y - dc.cy) < 240)) SKY.decor.push(dc);
  }
  // fainter when you zoom far out, so your own stars stand out
  const A = (SKY.words.length ? 0.4 : 1) * (SKY.dive ? 1 - SKY.dive.p : 1) * clamp((z - 0.12) / 0.4, 0.65, 1), tw = skyMotion();
  c.lineWidth = 1; c.lineCap = 'round'; c.setLineDash([1.5, 4]);
  for (const dc of SKY.decor) {
    const P = dc.pts.map((q) => skyToScreen(q.x, q.y));
    if (P.every(([x, y]) => x < -60 || x > w + 60 || y < -60 || y > h + 60)) continue;
    c.strokeStyle = `rgba(236,232,225,${0.27 * A})`;
    dc.pts.forEach((q, k) => { if (q.p < 0) return; const a = P[q.p], b = P[k]; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); });
    dc.pts.forEach((q, k) => {
      const a = A * q.a * (tw ? 0.6 + 0.4 * Math.sin(now / 900 * q.sp + q.ph) : 0.85);
      const sz = q.size * 7 * clamp(z + 0.25, 0.55, 1.4);
      c.globalAlpha = a; c.drawImage(dot, P[k][0] - sz / 2, P[k][1] - sz / 2, sz, sz);
    });
    c.globalAlpha = 1;
    if (z >= 0.4) {
      const top = Math.min(...P.map((q) => q[1])), mx = P.reduce((a, q) => a + q[0], 0) / P.length;
      c.font = `italic ${Math.round(clamp(15 * z, 12, 17))}px Georgia,"Times New Roman",serif`; c.textAlign = 'center';
      c.fillStyle = `rgba(239,231,216,${0.5 * A * clamp((z - 0.4) / 0.15, 0, 1)})`;
      c.fillText(dc.name, mx, top - 16);
    }
  }
  c.setLineDash([]);
}

// ------------------------------------------------------------------ far-off galaxies behind everything
// A handful of other galaxies in the distance: small and faint ones far away, a few bigger ones closer. Each sits at its
// own depth, so it drifts slower than the stars when you move and grows a little when you zoom (parallax). Drawn once
// into small pictures, then just placed each frame.
const SKY_DEEP = { list: null };
function skyDeepSprite(kind, tint, seed) {
  const S2 = 192, cv = document.createElement('canvas'); cv.width = S2; cv.height = S2;
  const c = cv.getContext('2d'), m = S2 / 2, r = skyRng(seed);
  const core = c.createRadialGradient(m, m, 0, m, m, m * (kind === 'elliptical' ? 0.9 : 0.42));
  core.addColorStop(0, `rgba(${tint},.95)`); core.addColorStop(0.18, `rgba(${tint},.35)`); core.addColorStop(1, `rgba(${tint},0)`);
  c.fillStyle = core; c.beginPath(); c.arc(m, m, m, 0, 7); c.fill();
  if (kind === 'spiral') {
    for (let arm = 0; arm < 2; arm++) for (let k = 0; k < 420; k++) {
      const t = Math.pow(r(), 0.8) * 3.9, rad = 6 * Math.exp(0.62 * t) * (1 + (r() - 0.5) * 0.25), a = t + arm * Math.PI + (r() - 0.5) * 0.35;
      if (rad > m - 4) continue;
      c.fillStyle = `rgba(${tint},${(0.25 + r() * 0.55) * (1 - rad / m)})`; c.beginPath(); c.arc(m + Math.cos(a) * rad, m + Math.sin(a) * rad, 0.5 + r() * 1.1, 0, 7); c.fill();
    }
  }
  return cv;
}
function skyDeepField(c) {
  if (!SKY_DEEP.list) {
    const r = skyRng(2026_11);
    const tints = ['255,240,220', '226,232,255', '244,226,255', '255,228,206', '220,240,255'];
    SKY_DEEP.list = Array.from({ length: 11 }, (_, i) => {
      const k = i < 3 ? 0.18 + r() * 0.1 : 0.03 + r() * 0.08; // depth: a few closer (k bigger), the rest far away
      const near = i < 3;
      const kind = r() < 0.7 || near ? 'spiral' : 'elliptical'; // the close ones always show their arms
      return { x: (r() - 0.5) * (near ? 2600 : 3600), y: (r() - 0.5) * (near ? 1500 : 2200), k, size: near ? 230 + r() * 150 : 40 + r() * 50, rot: r() * Math.PI, tilt: 0.35 + r() * 0.5,
        a: near ? 0.5 + r() * 0.15 : 0.3 + r() * 0.3, img: skyDeepSprite(kind, tints[i % tints.length], 77 + i * 131) };
    });
  }
  const { w, h } = SKY;
  for (const g of SKY_DEEP.list) {
    const grow = 1 + (SKY.cam.z - 1) * g.k * 1.5;
    const x = w / 2 + (g.x - SKY.cam.x * g.k) * (0.32 + g.k) * grow, y = h / 2 + (g.y - SKY.cam.y * g.k) * (0.32 + g.k) * grow;
    const sz = g.size * grow;
    if (x < -sz || x > w + sz || y < -sz || y > h + sz) continue;
    c.save(); c.globalAlpha = g.a; c.translate(x, y); c.rotate(g.rot); c.scale(1, g.tilt);
    c.drawImage(g.img, -sz / 2, -sz / 2, sz, sz); c.restore();
  }
  c.globalAlpha = 1;
}

// ------------------------------------------------------------------ zooming between the views
// Zoom out of Sky far enough and you rise into the Galaxy; zoom into a star (or an arm) in the Galaxy and you come down
// into Sky, onto that tab in its Space. The view you leave keeps zooming as it fades; the new one eases in.
function skySnapshot() {
  try { const cv = document.createElement('canvas'); cv.width = SKY.canvas.width; cv.height = SKY.canvas.height; cv.getContext('2d').drawImage(SKY.canvas, 0, 0); return cv; } catch { return null; }
}
function skySwitchMode(to, { focusId = null, ws = null, fx = SKY.w / 2, fy = SKY.h / 2, warp = false } = {}) {
  if (!SKY.on || SKY.mode === to || SKY.dive) return;
  const snap = skyMotion() && !warp ? skySnapshot() : null; // (after a quantum jump the flash hides the switch instead)
  skyHideCard(); SKY.hover = null; SKY.sel = null; SKY.pull = null;
  skySaveCam();
  SKY.mode = to; S.settings.overviewView = to; save();
  skyRelayout();
  if (to === 'sky') {
    const st = focusId && SKY.starById.get(focusId);
    const target = st ? { x: st.x, y: st.y, z: 0.75 } : skyFitAll();
    Object.assign(SKY.cam, { ...target, z: target.z * (warp ? 0.3 : 0.5) });
    skyGlideTo(target, warp ? WARP.DROP : 560); // (out of a jump: still moving fast, slowing to a stop)
  } else {
    const fit = skyFitAll();
    const near = ws ? [...SKY.starById.values()].filter((x) => x.ws === ws).sort((a, b) => a.r - b.r).slice(0, 3) : [];
    const from = near.length ? { x: near.reduce((a, x) => a + x.x, 0) / near.length, y: near.reduce((a, x) => a + x.y, 0) / near.length, z: Math.min(1.6, fit.z * 2.4) } : { ...fit, z: fit.z * 2 };
    Object.assign(SKY.cam, from);
    skyGlideTo(fit, 680);
  }
  if (snap) SKY.trans = { img: snap, t0: performance.now(), dir: to === 'sky' ? 'in' : 'out', fx, fy, ms: 520 };
  // the switch at the top follows along, and so do the controls
  document.querySelectorAll('.v1-ovsw .b').forEach((b) => { const on = b.textContent.trim().toLowerCase() === to; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  for (const sel of ['.rst', '.me']) { const b = SKY.layer && SKY.layer.querySelector(`.sky-ctl ${sel}`); if (b) b.hidden = to === 'galaxy'; }
  setTimeout(() => { skyUpdateZoom(); skySaveCam(); }, 700);
  skyKick();
}
/** Drawn over the new view while it eases in: the old view, still zooming (in or out) and fading away. */
function skyTransition(now) {
  const tr = SKY.trans; if (!tr) return;
  const p = Math.min(1, (now - tr.t0) / tr.ms), e = 1 - Math.pow(1 - p, 2);
  const c = SKY.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.save(); c.globalAlpha = 1 - e;
  const sc = tr.dir === 'in' ? 1 + 2.6 * e : 1 - 0.6 * e, fx = tr.fx * SKY.dpr, fy = tr.fy * SKY.dpr;
  c.translate(fx, fy); c.scale(sc, sc); c.translate(-fx, -fy);
  c.drawImage(tr.img, 0, 0);
  c.restore();
  if (p >= 1) SKY.trans = null;
}
/** The wheel at the end of a view's zoom: two more turns that way switch to the next view (so it never happens by accident). */
function skyEdgePull(dir, x, y) {
  const now = performance.now();
  SKY.pull = SKY.pull && SKY.pull.dir === dir && now - SKY.pull.t < 700 ? { dir, n: SKY.pull.n + 1, t: now } : { dir, n: 1, t: now };
  if (SKY.pull.n < 2) return;
  if (dir === 'out' && SKY.mode === 'sky') skySwitchMode('galaxy', { ws: skySpaceAt(SKY.w / 2, SKY.h / 2) || S.activeWs, fx: x, fy: y });
  // into the Galaxy far enough: down into Sky, on the tab you're on
  if (dir === 'in' && SKY.mode === 'galaxy') skySwitchMode('sky', { focusId: (activeTab() || {}).id, fx: x, fy: y });
}

// ------------------------------------------------------------------ drawing
function skyKick() { if (!SKY.raf) SKY.raf = requestAnimationFrame(skyFrame); }
function skyFrame(now) {
  SKY.raf = 0;
  if (!SKY.on) return;
  if (SKY.glide) SKY.glide(now);
  if (SKY.warp) skyWarpTick(now);
  if (SKY.mode === 'galaxy') {
    const dt = SKY.lastT ? Math.min(100, now - SKY.lastT) : 0; SKY.lastT = now;
    // one turn every 6 minutes. It keeps turning while you look around or point at something (1.7.9): only dragging a
    // star or opening one holds it still. A window that's open follows its star.
    if (skyMotion() && !SKY.drag && !SKY.dive && !SKY.fly) { SKY.turn += dt * (Math.PI * 2) / 360000; galaxyPlace(); if (SKY.card) skyPlaceCard(true); }
  }
  skyDraw(now);
  skyTransition(now);
  if (SKY.glide || SKY.trans || SKY.warp) skyKick();
  else if (skyMotion() && !document.hidden) { clearTimeout(SKY.twinkle); SKY.twinkle = setTimeout(skyKick, 50); } // gentle twinkle, ~20 fps
}

function skyDraw(now = performance.now()) {
  if (SKY.mode === 'galaxy') return galaxyDraw(now);
  const c = SKY.ctx; if (!c || !SKY.lay) return;
  const { w, h, dpr } = SKY;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  skyBackdrop(c, false); // (no far-off galaxies here: in Sky we're inside one)
  const z = SKY.cam.z;
  const act = activeTab();
  const MONO = 'ui-monospace,Consolas,"DejaVu Sans Mono",monospace', SERIF = 'Georgia,"Times New Roman",serif';
  skyDrawScenery(c, now);
  const boxes = []; // [cx, cy, half width, half height] of every name already written, so names never run into each other
  const free = (b) => !boxes.some((o) => Math.abs(o[0] - b[0]) < o[2] + b[2] && Math.abs(o[1] - b[1]) < o[3] + b[3]);
  const fade = SKY.dive ? 1 - SKY.dive.p * 0.6 : 1;
  const P = new Map(); for (const st of SKY.starById.values()) P.set(st.id, skyToScreen(st.x, st.y));
  // where a star being dragged is drawn (it follows the pointer)
  if (SKY.drag && SKY.drag.moved && !SKY.drag.link) P.set(SKY.drag.id, [SKY.drag.mx, SKY.drag.my]);
  if (SKY.gdrag && SKY.gdrag.moved) for (const id of SKY.gdrag.ids) { const st = SKY.starById.get(id); if (st) P.set(id, skyToScreen(st.x + SKY.gdrag.dx, st.y + SKY.gdrag.dy)); }
  const matchOf = (id) => { const t = tabById(id); return t && skyMatch(t); };
  // the lines: thin, solid and bright, like a constellation on a star chart
  c.lineCap = 'round';
  for (const [a, b] of SKY.lay.edges) {
    const pa = P.get(a), pb = P.get(b); if (!pa || !pb) continue;
    if (Math.max(pa[0], pb[0]) < -20 || Math.min(pa[0], pb[0]) > w + 20 || Math.max(pa[1], pb[1]) < -20 || Math.min(pa[1], pb[1]) > h + 20) continue;
    const hot = SKY.hoverEdge && SKY.hoverEdge[0] === a && SKY.hoverEdge[1] === b;
    const dim = SKY.words.length && !(matchOf(a) || matchOf(b));
    c.strokeStyle = hot ? 'rgba(240,154,124,.95)' : `rgba(255,255,255,${(dim ? 0.2 : 0.62) * fade})`; c.lineWidth = hot ? 2 : 1.3;
    c.beginPath(); c.moveTo(pa[0], pa[1]); c.lineTo(pb[0], pb[1]); c.stroke();
  }
  // drawing a new line (Shift-drag, or "Connect to…"): it follows the pointer to the star you join it to
  const linkFrom = SKY.drag && SKY.drag.link && SKY.drag.moved ? SKY.drag.id : SKY.linking ? SKY.linking.id : null;
  if (linkFrom && P.get(linkFrom)) {
    const [ax, ay] = P.get(linkFrom), tx = SKY.drag && SKY.drag.link ? SKY.drag.mx : SKY.linking.mx, ty = SKY.drag && SKY.drag.link ? SKY.drag.my : SKY.linking.my;
    const tgt = SKY.drag && SKY.drag.link ? SKY.drag.over : SKY.linking.over;
    const [bx, by] = tgt && P.get(tgt) ? P.get(tgt) : [tx, ty];
    c.strokeStyle = tgt ? 'rgba(127,227,255,.95)' : 'rgba(255,255,255,.75)'; c.lineWidth = 1.4; c.setLineDash([5, 5]);
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
  }
  // group names above their highest star (drag a name to move the whole group)
  SKY.nameHit = [];
  for (const g of SKY.lay.groups) {
    if (g.lone || z < 0.3) continue;
    const pts = g.ids.map((id) => P.get(id)).filter(Boolean);
    if (!pts.length || pts.every(([x, y]) => x < -150 || x > w + 150 || y < -100 || y > h + 100)) continue;
    const dimG = SKY.words.length && !g.ids.some(matchOf);
    const top = Math.min(...pts.map((q) => q[1])), mx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
    c.font = `italic ${Math.round(clamp(21 * z, 14, 23))}px ${SERIF}`; c.textAlign = 'center';
    c.fillStyle = `rgba(244,237,224,${(dimG ? 0.25 : 0.95) * fade})`;
    const ny = top - Math.max(26, 34 * z), nw = c.measureText(g.name).width / 2 + 6;
    c.fillText(g.name, mx, ny); boxes.push([mx, ny - 6, nw, 12]);
    SKY.nameHit.push({ g, x0: mx - nw, x1: mx + nw, y0: ny - 20, y1: ny + 6 });
  }
  // names go under their star; if that's taken, above it; if that's taken too they wait until you zoom in or point
  // at it (the tab you're on, and the one you point at, always get one)
  const list = [...SKY.starById.values()].map((st) => { const [x, y] = P.get(st.id); return { st, x, y }; })
    .filter(({ x, y }) => x > -150 && x < w + 150 && y > -100 && y < h + 100);
  const strongOf = (st) => (act && st.id === act.id) || SKY.hover === st.id || SKY.sel === st.id || (SKY.drag && SKY.drag.over === st.id);
  list.sort((a, b) => strongOf(b.st) - strongOf(a.st));
  const labels = z >= 0.38;
  c.font = `12px ${MONO}`; if (c.letterSpacing !== undefined) c.letterSpacing = '1px';
  for (const it of list) {
    const t = tabById(it.st.id); if (!t) continue;
    const strong = strongOf(it.st);
    const hw = Math.min(82, c.measureText(String(t.title || prettyUrl(t.url)).toUpperCase()).width / 2) + 6;
    it.label = null;
    if (labels || strong) {
      if (free([it.x, it.y + 28, hw, 9])) it.label = 'down';
      else if (free([it.x, it.y - 21, hw, 9])) it.label = 'up';
      else if (strong) it.label = 'down';
      if (it.label) boxes.push([it.x, it.label === 'down' ? it.y + 28 : it.y - 21, hw, 9]);
    }
  }
  if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
  for (const it of list) {
    const t = tabById(it.st.id); if (!t) continue;
    skyPaintTab(c, t, it.x, it.y, now, { labels: !!it.label, up: it.label === 'up' });
    // the star you're about to join it to
    if (SKY.drag && SKY.drag.over === it.st.id || SKY.linking && SKY.linking.over === it.st.id) { c.strokeStyle = '#7FE3FF'; c.lineWidth = 1.5; c.beginPath(); c.arc(it.x, it.y, 18, 0, 7); c.stroke(); }
  }
  skyWindows(c, now);
  skyOverlays(c, w, h);
  skyDrawWarp(c, w, h, now);
}

// ------------------------------------------------------------------ the Galaxy's own look (1.7.9)
// A real spiral galaxy, like a picture of the Milky Way: a blue-white disc of stars, two big arms and two smaller ones
// with pink star-forming knots and dark dust lanes, and a warm yellow bar in the middle. Your Spaces are arms of it (the
// big arms follow the same spiral the tabs sit on). Drawn once into a picture flat on, then tilted and turned with the
// galaxy each frame.
const GAL_PIC = { key: '', cv: null, R: 0 };
function galaxySprite(offs, rMax) {
  const key = `${offs.map((o) => o.toFixed(3)).join(',')}|${Math.round(rMax)}`;
  if (GAL_PIC.key === key && GAL_PIC.cv) return GAL_PIC;
  const R = rMax * 1.12, SZ = 1600, k = SZ / (2 * R), m = SZ / 2;
  const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
  const c = cv.getContext('2d'), r = skyRng(31415);
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  // the arms: every Space's, plus fill-ins so there are always two big and two smaller arms
  const arms = offs.map((o) => ({ off: o, big: true }));
  if (arms.length === 1) arms.push({ off: offs[0] + Math.PI, big: true });
  const bigs = arms.slice();
  for (const a of bigs) arms.push({ off: a.off + Math.PI / bigs.length, big: false });
  // the disc: a soft blue-white haze, brightest in the middle
  let g = c.createRadialGradient(m, m, 0, m, m, R * k);
  g.addColorStop(0, 'rgba(225,228,255,.5)'); g.addColorStop(0.25, 'rgba(170,185,240,.26)'); g.addColorStop(0.6, 'rgba(120,140,215,.12)'); g.addColorStop(1, 'rgba(90,110,200,0)');
  c.fillStyle = g; c.beginPath(); c.arc(m, m, R * k, 0, 7); c.fill();
  c.globalCompositeOperation = 'lighter';
  const P = (rr, th) => [m + Math.cos(th) * rr * k, m + Math.sin(th) * rr * k];
  for (const a of arms) {
    const reach = a.big ? rMax * 1.02 : rMax * 0.82, n = a.big ? 2600 : 1300;
    // a glow along the arm
    for (let rr = GAL.R0 * 0.7; rr < reach; rr += 6) {
      const [x, y] = P(rr, galTh(rr, a.off)), fade = 1 - rr / reach, w = (24 + rr * 0.13) * k;
      const gg = c.createRadialGradient(x, y, 0, x, y, w);
      gg.addColorStop(0, `rgba(165,185,255,${(a.big ? 0.075 : 0.045) * (0.4 + fade)})`); gg.addColorStop(1, 'rgba(160,180,255,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(x, y, w, 0, 7); c.fill();
    }
    // its stars: blue-white, a few warm ones, and pink knots where new stars are born
    for (let i = 0; i < n; i++) {
      const rr = GAL.R0 * 0.7 + (reach - GAL.R0 * 0.7) * Math.pow(r(), 0.85);
      const th = galTh(rr, a.off) + gauss() * (0.1 + rr / rMax * 0.16);
      const [x, y] = P(rr, th), knot = r() < 0.014;
      if (knot) { const w = (1.5 + r() * 2.5) * k * 1.6; const gg = c.createRadialGradient(x, y, 0, x, y, w); gg.addColorStop(0, 'rgba(255,150,180,.4)'); gg.addColorStop(1, 'rgba(255,140,175,0)'); c.fillStyle = gg; c.beginPath(); c.arc(x, y, w, 0, 7); c.fill(); continue; }
      const warm = r() < 0.12;
      c.fillStyle = warm ? `rgba(255,236,210,${0.25 + r() * 0.5})` : `rgba(200,212,255,${0.2 + r() * 0.55})`;
      c.fillRect(x, y, 0.6 + r() * 1.3, 0.6 + r() * 1.3);
    }
  }
  // stars between the arms
  for (let i = 0; i < 4200; i++) {
    const rr = Math.pow(r(), 0.7) * R * 0.95, th = r() * Math.PI * 2, [x, y] = P(rr, th);
    c.fillStyle = `rgba(215,222,255,${0.08 + r() * 0.3})`; c.fillRect(x, y, 0.5 + r(), 0.5 + r());
  }
  // dark dust lanes on the inside edge of the big arms
  c.globalCompositeOperation = 'source-over';
  for (const a of arms.filter((x) => x.big)) {
    c.beginPath();
    for (let rr = GAL.R0 * 0.9; rr < rMax * 0.9; rr += 5) { const [x, y] = P(rr, galTh(rr, a.off) - 0.13); if (rr === GAL.R0 * 0.9) c.moveTo(x, y); else c.lineTo(x, y); }
    c.strokeStyle = 'rgba(4,5,10,.32)'; c.lineWidth = 5 * k; c.lineCap = 'round'; c.stroke();
  }
  // the warm bar and bulge in the middle
  c.globalCompositeOperation = 'lighter';
  g = c.createRadialGradient(m, m, 0, m, m, GAL.R0 * 1.5 * k);
  g.addColorStop(0, 'rgba(255,246,220,.95)'); g.addColorStop(0.25, 'rgba(255,226,170,.55)'); g.addColorStop(0.6, 'rgba(240,200,150,.18)'); g.addColorStop(1, 'rgba(240,200,150,0)');
  c.fillStyle = g; c.beginPath(); c.arc(m, m, GAL.R0 * 1.5 * k, 0, 7); c.fill();
  c.save(); c.translate(m, m); c.rotate(offs[0] + 0.7); c.scale(1, 0.42);
  g = c.createRadialGradient(0, 0, 0, 0, 0, GAL.R0 * 1.25 * k);
  g.addColorStop(0, 'rgba(255,240,205,.8)'); g.addColorStop(0.5, 'rgba(255,215,160,.3)'); g.addColorStop(1, 'rgba(255,215,160,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, GAL.R0 * 1.25 * k, 0, 7); c.fill(); c.restore();
  c.globalCompositeOperation = 'source-over';
  Object.assign(GAL_PIC, { key, cv, R });
  return GAL_PIC;
}

// The devices signed in to your Oto account (this PC, your phone, other PCs) are stars of the galaxy itself,
// each named with what it is: WINDOWS, ANDROID, IOS, LINUX, MACOS. Point at one to see it, its open tabs and when it
// was last on; a phone opens its panel.
// (1.7.10) Each device is one of the galaxy's own stars, sitting on its arms: the first two on the two big arms, the
// next ones a little further out. Where one is now that the galaxy has turned:
function devPos(i) {
  const offs = (SKY.gal && SKY.gal.offs) || [-Math.PI / 2, Math.PI / 2], rMax = (SKY.gal && SKY.gal.rMax) || GAL.RMAX;
  const RS = [0.46, 0.8, 0.63, 0.95, 0.36], r = rMax * RS[Math.floor(i / 2) % RS.length], th = galTh(r, offs[i % 2]) + SKY.turn + (i >= 10 ? 0.3 : 0);
  return [Math.cos(th) * r, Math.sin(th) * r * GAL.TILT];
}
function devPlatform(d) {
  const o = String((d && d.os) || '');
  if (/android/i.test(o)) return 'ANDROID';
  if (/ios|iphone|ipad/i.test(o)) return 'IOS';
  if (/linux/i.test(o)) return 'LINUX';
  if (/mac/i.test(o)) return 'MACOS';
  if (/windows/i.test(o)) return 'WINDOWS';
  return d && d.kind === 'phone' ? 'PHONE' : 'PC';
}
function galaxyDevices() {
  const ph = typeof PH !== 'undefined' ? PH : null;
  const me = { id: (ph && ph.me && ph.me.id) || 'this-pc', name: (ph && ph.me && ph.me.name) || 'This PC', me: true, online: true, kind: 'pc', os: typeof navigator !== 'undefined' ? (/Win/.test(navigator.platform) ? 'Windows' : /Mac/.test(navigator.platform) ? 'macOS' : /Linux/.test(navigator.platform) ? 'Linux' : '') : '' };
  const others = ph && Array.isArray(ph.devices) ? ph.devices.filter((d) => d && !d.locked).map((d) => ({ ...d, online: typeof phOnline === 'function' ? phOnline(d) : false })) : [];
  const list = [me, ...others];
  return list.map((d, i) => ({ ...d, plat: devPlatform(d), i }));
}
function galaxyDevAt(x, y) {
  for (const d of SKY.devs || []) if (Math.hypot(d.sx - x, d.sy - y) < 16) return d;
  return null;
}
function galaxyDrawDevices(c, now) {
  const z = SKY.cam.z, MONO = 'ui-monospace,Consolas,"DejaVu Sans Mono",monospace';
  // (who's online is looked at once a second, not every frame)
  if (!SKY.devs || !SKY.devsAt || now - SKY.devsAt > 1000 || now < SKY.devsAt) { SKY.devs = galaxyDevices(); SKY.devsAt = now; }
  for (const d of SKY.devs) {
    const [wx, wy] = devPos(d.i), [x, y] = skyToScreen(wx, wy);
    d.sx = x; d.sy = y;
    const hov = SKY.hoverDev === d.id, on = d.me || d.online;
    // one of the galaxy's stars: a bright one where Oto is open, a dark one where it isn't
    if (on) {
      const tw = 0.85 + 0.15 * Math.sin(now / 700 + d.i * 1.7); // a slow twinkle
      skyStar(c, x, y, (hov ? 3.6 : 3) * tw, 1, false);
    } else {
      skyStar(c, x, y, hov ? 2.2 : 1.7, hov ? 0.55 : 0.35, false);
      c.fillStyle = 'rgba(8,10,14,.55)'; c.beginPath(); c.arc(x, y, hov ? 3.4 : 2.8, 0, 7); c.fill();
    }
    if ((z >= 0.35 || hov) && !SKY.warp) { // its name, small and quiet, like a name on a star chart (not during a jump)
      c.font = `${hov ? 600 : 500} 10px ${MONO}`; c.textAlign = 'center'; if (c.letterSpacing !== undefined) c.letterSpacing = '1.4px';
      c.shadowColor = 'rgba(3,3,6,.9)'; c.shadowBlur = 5; // (readable over the bright arms)
      const nm = d.me ? (d.name && d.name !== 'This PC' ? d.name : '') : d.name || '';
      c.fillStyle = on ? `rgba(236,240,255,${hov ? 1 : 0.85})` : `rgba(120,128,140,${hov ? 0.85 : 0.6})`;
      c.fillText(`${d.me ? 'THIS PC · ' : ''}${d.plat}`, x, y - 16);
      if (nm) { c.font = `10px ${MONO}`; c.fillStyle = on ? `rgba(236,232,225,${hov ? 0.9 : 0.62})` : `rgba(120,128,140,${hov ? 0.7 : 0.45})`; c.fillText(skyEll(c, String(nm).toUpperCase(), 140), x, y + 22); }
      if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
      c.shadowBlur = 0; c.shadowColor = 'transparent';
    }
  }
}

// Clicking a device that's on is a quantum jump to it (1.7.10), like fast travel in a space game: the view turns to
// face the device's star and brackets lock on (spool), then everything stretches into streaks of light rushing past
// as you accelerate into it (jump), a flash, and you drop out of it slowing down: at this PC, into Sky with your tabs
// rushing up to meet you; at your phone, its panel. A device whose app isn't open is dark: clicking it just shows
// when it was last on.
const WARP = { SPOOL: 420, JUMP: 820, DROP: 820 }; // ms: turn and lock on · accelerate · slow down after the flash
function galaxyFlyTo(d) {
  if (!d) return;
  if (!d.me && !d.online) { galaxyShowDevice(d); return; }
  skyHideCard(); galaxyHideDevice(); SKY.hoverDev = null;
  const back = { ...SKY.cam }; // (the Galaxy is remembered as you left it, not zoomed in on the device)
  const arrive = () => {
    Object.assign(SKY.cam, back); skySaveCam();
    if (d.me) skySwitchMode('sky', { focusId: (activeTab() || {}).id, warp: true });
    else if (d.kind === 'phone' && typeof v1Phone === 'function') { SKY.warp = null; SKY.fly = null; v1CloseOverview(); v1Phone(); }
    else { SKY.warp = null; SKY.fly = null; skyDraw(); galaxyShowDevice(d); }
  };
  if (!skyMotion()) { arrive(); SKY.warp = null; SKY.fly = null; return; }
  const [wx, wy] = devPos(d.i);
  skyQuantum({ wx, wy, label: d.me ? 'THIS PC' : d.plat, arrive });
}
/** Starts a quantum jump to a point (world units) of the view that's showing; arrive() runs under the flash. */
function skyQuantum({ wx, wy, label, arrive }) {
  const r = skyRng((Date.now() & 0xffff) + 7);
  SKY.warp = {
    t0: performance.now(), label, wx, wy, from: { ...SKY.cam }, arrive, arrived: false, last: 0, s: 0,
    parts: Array.from({ length: 320 }, () => ({ a: r() * Math.PI * 2, d: Math.pow(r(), 1.6) * 900 + 4, k: 0.6 + r() * 0.8 })),
  };
  SKY.fly = SKY.warp; // (holds the galaxy still and keeps the pointer out until you've arrived)
  SKY.glide = null;
  skyKick();
}
/** Moves the jump along: called every frame from skyFrame while it lasts. */
function skyWarpTick(now) {
  const W = SKY.warp; if (!W) return;
  const e = now - W.t0, { SPOOL, JUMP, DROP } = WARP;
  const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  if (!W.arrived) {
    if (e < SPOOL) { // turn to face it: the device glides to the middle, brackets lock on
      const q = ease(e / SPOOL);
      SKY.cam.x = W.from.x + (W.wx - W.from.x) * q; SKY.cam.y = W.from.y + (W.wy - W.from.y) * q; SKY.cam.z = W.from.z * (1 + 0.25 * q);
      W.s = 0;
    } else { // the jump: speeding up into the star, everything streaming past
      const q = Math.min(1, (e - SPOOL) / JUMP);
      SKY.cam.x = W.wx; SKY.cam.y = W.wy; SKY.cam.z = W.from.z * 1.25 * Math.pow(11, q * q * q);
      W.s = Math.pow(q, 1.5);
      if (q >= 1) { W.arrived = true; W.ta = now; W.arrive(); }
    }
  } else { // dropping out: the streaks slow and shorten while the new view settles
    const q = Math.min(1, (now - W.ta) / DROP);
    W.s = Math.pow(1 - q, 2.2);
    if (q >= 1) { SKY.warp = null; SKY.fly = null; skyUpdateZoom(); }
  }
}
/** The jump's look, drawn over either view: zoom blur, streaks of light from the point you're flying into, a flash. */
function skyDrawWarp(c, w, h, now) {
  const W = SKY.warp; if (!W) return;
  const MONO = 'ui-monospace,Consolas,"DejaVu Sans Mono",monospace', s = W.s;
  // where you're flying to on screen: the device's star, then (after the flash) the middle of the new view
  const [fx, fy] = W.arrived ? [w / 2, h / 2] : skyToScreen(W.wx, W.wy);
  const dt = W.last ? Math.min(50, now - W.last) : 16; W.last = now;
  // zoom blur: the picture smeared outward from the target
  if (s > 0.04 && SKY.canvas && !W.arrived) { // (not after the flash: it would double the new view's names)
    const dpr = SKY.dpr;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    for (const [k, al] of [[1 + 0.05 * s, 0.4], [1 + 0.12 * s, 0.25]]) {
      c.globalAlpha = al * Math.min(1, s * 2);
      c.translate(fx * dpr, fy * dpr); c.scale(k, k); c.translate(-fx * dpr, -fy * dpr);
      c.drawImage(SKY.canvas, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0);
    }
    c.restore();
    c.setTransform(SKY.dpr, 0, 0, SKY.dpr, 0, 0);
  }
  // the tunnel: darker at the edges as you speed up
  if (s > 0.02) {
    const R = Math.hypot(w, h) * 0.75, v = c.createRadialGradient(fx, fy, R * 0.15, fx, fy, R);
    v.addColorStop(0, 'rgba(3,4,8,0)'); v.addColorStop(1, `rgba(3,4,8,${0.8 * s})`);
    c.fillStyle = v; c.fillRect(0, 0, w, h);
    c.fillStyle = `rgba(4,6,12,${0.4 * s})`; c.fillRect(0, 0, w, h); // (the stretched-out galaxy fades behind the streaks)
  }
  // streaks: stars stretched into lines, rushing outward from the target, longer and brighter the faster you go
  const maxD = Math.hypot(Math.max(fx, w - fx), Math.max(fy, h - fy)) + 40;
  const sp = 0.25 + 9 * s;
  c.lineCap = 'round';
  for (const p of W.parts) { // (moved once per frame, drawn in two passes below)
    p.d += p.d * sp * p.k * dt / 1000;
    if (p.d > maxD) { p.d = 4 + Math.random() * 60; p.a = Math.random() * Math.PI * 2; }
  }
  if (s >= 0.03) {
    for (const [col, al, lw, lenK] of [['150,180,255', 0.35, 2.6, 1], ['238,244,255', 0.9, 1.1, 0.8]]) {
      c.beginPath();
      for (const p of W.parts) {
        const len = 2 + p.d * 0.45 * s * p.k * lenK, ca = Math.cos(p.a), sa = Math.sin(p.a), d0 = p.d * (lenK < 1 ? 1.04 : 1);
        c.moveTo(fx + ca * d0, fy + sa * d0); c.lineTo(fx + ca * (d0 + len), fy + sa * (d0 + len));
      }
      c.strokeStyle = `rgba(${col},${Math.min(1, s * 1.6) * al})`; c.lineWidth = lw * (0.5 + s * 0.9); c.stroke();
    }
  }
  // before the jump: brackets lock onto the star, and where you're going
  if (!W.arrived) {
    const e = now - W.t0, lk = Math.min(1, e / WARP.SPOOL), rr = 60 - 40 * (1 - Math.pow(1 - lk, 2)) + 30 * s, tk = 7;
    c.save(); c.translate(fx, fy); c.rotate((1 - lk) * Math.PI / 4);
    c.strokeStyle = `rgba(236,240,255,${0.95 * (1 - s)})`; c.lineWidth = 1.4;
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.beginPath(); c.moveTo(sx * rr, sy * (rr - tk)); c.lineTo(sx * rr, sy * rr); c.lineTo(sx * (rr - tk), sy * rr); c.stroke(); }
    c.restore();
    skyStar(c, fx, fy, 3.4 + 10 * s, 1, false);
    c.font = `11px ${MONO}`; c.textAlign = 'center'; c.fillStyle = `rgba(236,240,255,${Math.max(0, 1 - s * 3)})`;
    if (c.letterSpacing !== undefined) c.letterSpacing = '2.4px';
    c.fillText(`QUANTUM TRAVEL // ${W.label}`, fx, fy + 52);
    if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
  }
  // the light ahead grows, then a flash that hides the switch and fades as you slow down
  const glow = W.arrived ? 0 : s;
  if (glow > 0) {
    const g = c.createRadialGradient(fx, fy, 0, fx, fy, Math.max(w, h) * (0.05 + 0.9 * glow));
    g.addColorStop(0, `rgba(250,252,255,${0.9 * glow})`); g.addColorStop(0.35, `rgba(214,226,255,${0.35 * glow})`); g.addColorStop(1, 'rgba(214,226,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  const fl = W.arrived ? Math.pow(Math.max(0, 1 - (now - W.ta) / 340), 2) : Math.max(0, (now - W.t0 - WARP.SPOOL - WARP.JUMP * 0.82) / (WARP.JUMP * 0.18));
  if (fl > 0) {
    const a = Math.min(1, fl), g2 = c.createRadialGradient(fx, fy, 0, fx, fy, Math.hypot(w, h) * 0.7);
    g2.addColorStop(0, `rgba(255,255,255,${0.97 * a})`); g2.addColorStop(1, `rgba(200,216,255,${0.85 * a})`);
    c.fillStyle = g2; c.fillRect(0, 0, w, h);
  }
}

function galaxyShowDevice(d) {
  skyHideCard(); galaxyHideDevice();
  const sum = d.me ? `${S.tabs.length} tab${S.tabs.length === 1 ? '' : 's'} open here` : `${(d.tabs || []).length} tab${(d.tabs || []).length === 1 ? '' : 's'} open${d.app ? ` · Oto ${d.app}` : ''}${typeof d.battery === 'number' ? ` · battery ${d.battery}%` : ''}`;
  const seen = d.me || d.online ? 'ONLINE' : (typeof phAgo === 'function' && d.seen ? `SEEN ${phAgo(d.seen).toUpperCase()}` : 'OFFLINE');
  const tabs = d.me ? [] : (d.tabs || []).slice(0, 5);
  const act = activeTab();
  const card = h('div', { class: 'sky-card dev', 'data-dev': d.id, role: 'dialog', 'aria-label': `Device: ${d.name || d.plat}` },
    h('div', { class: 'bd' },
      h('div', { class: 'hd' }, h('span', { class: 'tag' }, `DEVICE // ${d.plat}`), h('span', { class: `st ${d.me || d.online ? 'live' : ''}` }, seen)),
      h('div', { class: 'tt' }, h('b', {}, d.me ? `${d.name || 'This PC'} (this PC)` : d.name || d.plat)),
      h('div', { class: 'meta' }, h('span', {}, String(d.os || d.plat).toUpperCase()), h('span', {}, '')),
      h('div', { class: 'meta' }, h('span', {}, sum)),
      tabs.length ? h('div', { class: 'devtabs' }, ...tabs.map((x) => h('button', { title: x.u, onclick: () => { openUrl(x.u, { newTabForce: true }); v1CloseOverview(); } }, x.t || hostOf(x.u)))) : null,
      d.me ? null : h('div', { class: 'acts' },
        act && /^https?:/.test(act.url || '') && typeof phSend === 'function' ? h('button', { class: 'b pri', onclick: () => phSend(d, act.url, act.title) }, 'Send this tab') : null,
        d.kind === 'phone' && typeof v1Phone === 'function' ? h('button', { class: 'b', onclick: () => { v1CloseOverview(); v1Phone(); } }, 'Open phone') : null)));
  card.addEventListener('mouseleave', () => galaxyHideDeviceSoon());
  SKY.layer.appendChild(card);
  SKY.dcard = card;
  galaxyPlaceDevice();
}
function galaxyPlaceDevice() {
  const card = SKY.dcard; if (!card) return;
  const d = (SKY.devs || []).find((x) => x.id === card.dataset.dev); if (!d) return;
  const cw = card.offsetWidth || 268, chh = card.offsetHeight || 200;
  let top = d.sy - 40 - chh; if (top < 66) top = Math.min(d.sy + 40, SKY.h - chh - 12);
  card.style.left = `${clamp(d.sx - cw / 2, 8, SKY.w - cw - 8)}px`; card.style.top = `${top}px`;
}
function galaxyHideDevice() { clearTimeout(SKY.dcardHide); if (SKY.dcard) { SKY.dcard.remove(); SKY.dcard = null; } }
function galaxyHideDeviceSoon() { clearTimeout(SKY.dcardHide); SKY.dcardHide = setTimeout(() => { if (!SKY.dcard || !SKY.dcard.matches(':hover')) { galaxyHideDevice(); SKY.hoverDev = null; } }, 260); }

function galaxyDraw(now) {
  const c = SKY.ctx; if (!c || !SKY.gal) return;
  const { w, h, dpr } = SKY, z = SKY.cam.z, T = SKY.turn;
  const SERIF = 'Georgia,"Times New Roman",serif';
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  skyBackdrop(c);
  const [cx, cy] = skyToScreen(0, 0);
  // the galaxy itself, tilted and turned (one picture, made once)
  const pic = galaxySprite(SKY.gal.offs, SKY.gal.rMax);
  c.save(); c.translate(cx, cy); c.scale(z, z * GAL.TILT); c.rotate(T);
  c.drawImage(pic.cv, -pic.R, -pic.R, pic.R * 2, pic.R * 2);
  c.restore();
  // your devices circle it; 音 sits in its bright middle
  galaxyDrawDevices(c, now);
  c.textAlign = 'center'; c.fillStyle = '#2A2118'; c.font = `${Math.round(clamp(24 * z, 16, 28))}px ${SERIF}`; c.fillText('音', cx, cy + 8 * Math.min(1, z));
  skyDrawWarp(c, w, h, now);
  galaxyPlaceDevice();
}

/** One tab's star, as on Android: a four-pointed star with a soft glow (warm for the tab you're on, which also gets a
 *  cream ring), a cyan ◆ when pinned, a dimmer smaller star while asleep, and its name in small capitals. */
function skyPaintTab(c, t, x, y, now, { labels = true, up = false, dim = false, maxW = 165 } = {}) {
  const MONO = 'ui-monospace,Consolas,"DejaVu Sans Mono",monospace';
  const act = activeTab();
  const on = !!(act && act.id === t.id), hov = SKY.hover === t.id, sel = SKY.sel === t.id;
  const v = V.get(t.id), asleep = !v || v.frozen;
  const base = (dim || !skyMatch(t)) ? 0.25 : 1;
  c.globalAlpha = base * (SKY.drag && SKY.drag.id === t.id && SKY.drag.moved ? 0.25 : 1) * (SKY.dive && SKY.dive.id !== t.id ? 1 - SKY.dive.p * 0.7 : 1);
  const twk = skyMotion() ? 0.84 + 0.16 * Math.sin(now / 650 + (skyHash(t.id) % 100) + x * 0.013) : 1;
  const size = on ? 3.5 : hov || sel ? 3.2 : asleep ? 2.1 : 2.6;
  skyStar(c, x, y, size * (0.94 + 0.06 * twk), (asleep && !on && !hov && !sel ? 0.55 : 1) * twk, on);
  const win = (SKY.winA && SKY.winA.get(t.id)) || 0;
  if (on) { c.strokeStyle = `rgba(236,232,225,${1 - win})`; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 15, 0, 7); c.stroke(); }
  if (sel && !on) { c.strokeStyle = 'rgba(236,232,225,.95)'; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y, 15, 0, 7); c.stroke(); c.setLineDash([]); }
  else if (hov && !on && !win) { c.strokeStyle = 'rgba(236,232,225,.5)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 15, 0, 7); c.stroke(); }
  if (t.pinned) { const q = 3.4, dx = x + 11, dy = y - 11; c.fillStyle = '#7FE3FF'; c.beginPath(); c.moveTo(dx, dy - q); c.lineTo(dx + q, dy); c.lineTo(dx, dy + q); c.lineTo(dx - q, dy); c.closePath(); c.fill(); }
  if (labels || on || hov || sel) {
    const strong = on || hov || sel;
    c.font = `${strong ? '600 ' : ''}12px ${MONO}`; c.textAlign = 'center';
    if (c.letterSpacing !== undefined) c.letterSpacing = '1px';
    c.fillStyle = strong ? '#FFF8EC' : asleep ? 'rgba(236,232,225,.55)' : 'rgba(236,232,225,.88)';
    c.fillText(skyEll(c, String(t.title || prettyUrl(t.url)).toUpperCase(), maxW), x, up ? y - 17 : y + 32);
    if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
  }
  c.globalAlpha = 1;
}

// ------------------------------------------------------------------ the small windows that show what's inside a star
// As on Android: zoom in and every star you can see gets a little HUD window above it with the page as you left it
// (the cached picture), its TAB number and site, LIVE or ASLEEP, a × to close it, and a click on it opens the tab.
// Windows never cover each other: the tab you're on and the ones nearest the middle go first.
const SKY_PIC = new Map(); // tab id → { url, img }
function skyPic(id) {
  const cc = typeof V1P !== 'undefined' ? V1P.cache.get(id) : null;
  if (!cc) return null;
  let p = SKY_PIC.get(id);
  if (!p || p.url !== cc.url) { const img = new Image(); p = { url: cc.url, img, ok: false }; img.onload = () => { p.ok = true; if (SKY.on) skyDraw(); }; img.src = cc.url; SKY_PIC.set(id, p); }
  return p.ok ? p.img : null;
}
const SKY_WIN = { W: 214, H: 158 };
function skyWinRect(x, y) {
  const { W, H } = SKY_WIN;
  let top = y - 34 - H, below = false;
  if (top < 66) { top = y + 34; below = true; }
  const left = clamp(x - W / 2, 8, SKY.w - W - 8);
  return { x0: left, y0: top, x1: left + W, y1: top + H, below };
}
function skyWindows(c, now) {
  SKY.winHit = [];
  if (!SKY.winA) SKY.winA = new Map();
  const z = SKY.cam.z, act = activeTab(), motion = skyMotion();
  const cardId = SKY.card ? SKY.card.dataset.id : null;
  const want = new Set();
  const rects = [];
  if (cardId) { const r = SKY.card.getBoundingClientRect(), b = SKY.canvas.getBoundingClientRect(); rects.push({ x0: r.left - b.left, y0: r.top - b.top, x1: r.right - b.left, y1: r.bottom - b.top }); }
  if (z >= 1.25 && !SKY.dive && !SKY.drag && !SKY.trans && !SKY.warp) { // (not during a jump: they'd smear)
    const cx = SKY.w / 2, cy = SKY.h / 2;
    const vis = [...SKY.starById.values()].map((st) => { const [x, y] = skyToScreen(st.x, st.y); return { st, x, y }; })
      .filter(({ x, y }) => x > 20 && x < SKY.w - 20 && y > 70 && y < SKY.h - 40)
      .filter(({ st }) => { const t = tabById(st.id); return t && skyMatch(t) && st.id !== cardId; })
      .sort((a, b) => ((act && b.st.id === act.id) - (act && a.st.id === act.id)) || Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    for (const v of vis) {
      const r = skyWinRect(v.x, v.y);
      if (rects.some((o) => r.x0 < o.x1 + 10 && r.x1 > o.x0 - 10 && r.y0 < o.y1 + 10 && r.y1 > o.y0 - 10)) continue;
      // a window doesn't sit on top of another star either
      if ([...SKY.starById.values()].some((o) => { if (o.id === v.st.id) return false; const [ox, oy] = skyToScreen(o.x, o.y); return ox > r.x0 - 6 && ox < r.x1 + 6 && oy > r.y0 - 6 && oy < r.y1 + 6; })) continue;
      rects.push(r); want.add(v.st.id);
    }
  }
  for (const id of want) if (!SKY.winA.has(id)) SKY.winA.set(id, motion ? 0.01 : 1);
  for (const [id, a0] of SKY.winA) {
    const st = SKY.starById.get(id), t = tabById(id);
    const goal = want.has(id) ? 1 : 0;
    const a = !motion || Math.abs(goal - a0) < 0.04 ? goal : a0 + (goal - a0) * 0.28;
    if (a <= 0.01 || !st || !t) { SKY.winA.delete(id); continue; }
    SKY.winA.set(id, a);
    const [x, y] = skyToScreen(st.x, st.y);
    skyDrawWindow(c, t, st, x, y, a, now);
  }
  // the window of the star you're pointing at (the one with buttons) is joined to its star the same way
  if (cardId) { const st = SKY.starById.get(cardId); if (st) { const [x, y] = skyToScreen(st.x, st.y); const r = SKY.card.getBoundingClientRect(), b = SKY.canvas.getBoundingClientRect(); skyConnector(c, x, y, { x0: r.left - b.left, y0: r.top - b.top, x1: r.right - b.left, y1: r.bottom - b.top, below: r.top - b.top > y }, 1); } }
}
/** The line from a window to its star (down to a small node, then across), and targeting ticks round the star. */
function skyConnector(c, x, y, r, a) {
  c.strokeStyle = `rgba(231,223,209,${0.45 * a})`; c.lineWidth = 1;
  const nx = clamp(x - 30, r.x0 + 12, r.x1 - 12), ey = r.below ? r.y0 : r.y1, step = r.below ? -10 : 10;
  c.beginPath(); c.moveTo(nx, ey); c.lineTo(nx, ey + step); c.lineTo(x - 6 * Math.sign(x - nx || 1), y + (r.below ? 6 : -6)); c.stroke();
  c.fillStyle = `rgba(236,232,225,${a})`; c.fillRect(nx - 2, ey + step - 2, 4, 4);
  c.strokeStyle = `rgba(236,232,225,${a})`; c.lineWidth = 1.2;
  const rr = 16, tk = 5;
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.beginPath(); c.moveTo(x + dx * rr, y + dy * (rr - tk)); c.lineTo(x + dx * rr, y + dy * rr); c.lineTo(x + dx * (rr - tk), y + dy * rr); c.stroke(); }
}
function skyDrawWindow(c, t, st, x, y, a, now) {
  const MONO = 'ui-monospace,Consolas,"DejaVu Sans Mono",monospace';
  const R = skyWinRect(x, y);
  const unfold = Math.max(0.06, a * a * (3 - 2 * a));
  const flick = a < 0.7 && Math.floor(now / 40) % 3 === 0 ? 0.45 : 1;
  const al = a * flick;
  const mid = (R.y0 + R.y1) / 2, y0 = mid - (mid - R.y0) * unfold, y1 = mid + (R.y1 - mid) * unfold, x0 = R.x0, x1 = R.x1, cut = 10;
  skyConnector(c, x, y, { ...R, y0, y1 }, al);
  // the body, two corners cut off
  c.beginPath(); c.moveTo(x0 + cut, y0); c.lineTo(x1, y0); c.lineTo(x1, y1 - cut); c.lineTo(x1 - cut, y1); c.lineTo(x0, y1); c.lineTo(x0, y0 + cut); c.closePath();
  c.fillStyle = `rgba(6,8,10,${0.92 * al})`; c.fill(); c.strokeStyle = `rgba(231,223,209,${0.38 * al})`; c.lineWidth = 1; c.stroke();
  // brackets on the other two corners
  c.strokeStyle = `rgba(236,232,225,${al})`; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(x1 - 12, y0 - 3); c.lineTo(x1 + 3, y0 - 3); c.lineTo(x1 + 3, y0 + 12); c.stroke();
  c.beginPath(); c.moveTo(x0 - 3, y1 - 12); c.lineTo(x0 - 3, y1 + 3); c.lineTo(x0 + 12, y1 + 3); c.stroke();
  if (unfold < 0.5) return;
  const v = V.get(t.id), live = v && !v.frozen;
  // readout: TAB 03 // SITE, LIVE or ASLEEP with its light, and × (◆ for a pinned tab: unpin it first)
  c.font = `10px ${MONO}`; if (c.letterSpacing !== undefined) c.letterSpacing = '1.2px';
  const xb = { x0: x1 - 19, y0: y0 + 3, x1: x1 - 4, y1: y0 + 17 };
  if (t.pinned) { const q = 3.4, mx = (xb.x0 + xb.x1) / 2, my = (xb.y0 + xb.y1) / 2; c.fillStyle = `rgba(127,227,255,${al})`; c.beginPath(); c.moveTo(mx, my - q); c.lineTo(mx + q, my); c.lineTo(mx, my + q); c.lineTo(mx - q, my); c.closePath(); c.fill(); }
  else {
    const mx = (xb.x0 + xb.x1) / 2, my = (xb.y0 + xb.y1) / 2, k = 4; c.strokeStyle = `rgba(236,232,225,${al})`; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(mx - k, my - k); c.lineTo(mx + k, my + k); c.moveTo(mx - k, my + k); c.lineTo(mx + k, my - k); c.stroke();
  }
  const stTxt = live ? 'LIVE' : 'ASLEEP', stCol = live ? '127,227,255' : '231,223,209';
  c.textAlign = 'right'; c.fillStyle = `rgba(${stCol},${(live ? 1 : 0.75) * al})`; c.fillText(stTxt, xb.x0 - 6, y0 + 13);
  const sw = c.measureText(stTxt).width;
  c.fillStyle = `rgba(${stCol},${al * (0.6 + 0.4 * Math.sin(now / 300))})`; c.beginPath(); c.arc(xb.x0 - 6 - sw - 7, y0 + 10, 2.2, 0, 7); c.fill();
  const n = S.tabs.indexOf(t) + 1;
  c.textAlign = 'left'; c.fillStyle = `rgba(239,231,216,${al})`;
  c.fillText(skyEll(c, `TAB ${String(n).padStart(2, '0')} // ${(hostOf(t.url) || prettyUrl(t.url) || 'oto').toUpperCase()}`, x1 - x0 - sw - 50), x0 + 12, y0 + 13);
  c.fillStyle = `rgba(231,223,209,${0.25 * al})`; c.fillRect(x0 + 6, y0 + 19, x1 - x0 - 12, 1);
  // the picture, with scanlines and a scan line sweeping down
  const p = { x0: x0 + 6, y0: y0 + 23, x1: x1 - 6, y1: y1 - 17 };
  c.save(); c.beginPath(); c.rect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0); c.clip();
  const img = skyPic(t.id);
  c.globalAlpha = al;
  if (img) { const sc = (p.x1 - p.x0) / img.width; c.drawImage(img, p.x0, p.y0, p.x1 - p.x0, img.height * sc); }
  else {
    c.fillStyle = '#0A0B0C'; c.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    const letter = ((hostOf(t.url) || '').match(/[a-z0-9]/i) || ['音'])[0].toUpperCase();
    c.font = '34px Georgia,serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(236,232,225,.25)'; c.fillText(letter, (p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2 + 8);
    c.font = `9px ${MONO}`; c.fillStyle = 'rgba(236,232,225,.7)'; c.fillText('NO SIGNAL · OPEN IT ONCE', (p.x0 + p.x1) / 2, p.y1 - 7);
  }
  c.globalAlpha = 1;
  c.fillStyle = `rgba(127,227,255,${0.05 * al})`; c.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
  c.fillStyle = `rgba(0,0,0,${0.22 * al})`; for (let yy = p.y0; yy < p.y1; yy += 3) c.fillRect(p.x0, yy, p.x1 - p.x0, 1);
  const sy = p.y0 + (p.y1 - p.y0) * ((now % 2600) / 2600);
  const g = c.createLinearGradient(0, sy - 14, 0, sy); g.addColorStop(0, 'rgba(127,227,255,0)'); g.addColorStop(1, `rgba(127,227,255,${0.22 * al})`);
  c.fillStyle = g; c.fillRect(p.x0, sy - 14, p.x1 - p.x0, 14); c.fillStyle = `rgba(127,227,255,${0.5 * al})`; c.fillRect(p.x0, sy, p.x1 - p.x0, 1);
  c.restore();
  // footer
  c.font = `9.5px ${MONO}`; c.textAlign = 'left'; c.fillStyle = `rgba(231,223,209,${0.85 * al})`;
  c.fillText(t.pinned ? '◆ PINNED  ▸ OPEN' : '▸ CLICK TO OPEN', x0 + 12, y1 - 5);
  c.textAlign = 'right'; c.fillStyle = `rgba(231,223,209,${0.6 * al})`;
  c.fillText(`${String(Math.abs(Math.round(st.x)) % 1000).padStart(3, '0')}:${String(Math.abs(Math.round(st.y)) % 1000).padStart(3, '0')}`, x1 - 14, y1 - 5);
  if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
  if (a > 0.5) SKY.winHit.push({ id: t.id, x0, y0, x1, y1, close: t.pinned ? null : { x0: xb.x0 - 8, y0: y0 - 6, x1: x1 + 6, y1: xb.y1 + 6 } });
}
function skyWindowAt(x, y) { return (SKY.winHit || []).slice().reverse().find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) || null; }

/** Drawn over everything: the dive into a star, and a star being dragged. */
function skyOverlays(c, w, h) {
  const SANS = '"Inter","Segoe UI",system-ui,sans-serif', MONO = 'ui-monospace,Consolas,"DejaVu Sans Mono",monospace';
  // diving into a star: brackets lock on, the rest of the sky fades, its light fills the screen
  if (SKY.dive) {
    const s = SKY.starById.get(SKY.dive.id);
    if (s) {
      const [x, y] = skyToScreen(s.x, s.y), p = SKY.dive.p, lk = SKY.dive.lock || 0;
      if (p > 0) { c.fillStyle = `rgba(7,8,11,${Math.min(0.85, p * 1.2)})`; c.fillRect(0, 0, w, h); }
      const rr = 60 - 42 * (1 - Math.pow(1 - lk, 2)), tk = 7;
      c.save(); c.translate(x, y); c.rotate((1 - lk) * Math.PI / 4);
      c.strokeStyle = `rgba(236,232,225,${1 - p})`; c.lineWidth = 1.4;
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.beginPath(); c.moveTo(sx * rr, sy * (rr - tk)); c.lineTo(sx * rr, sy * rr); c.lineTo(sx * (rr - tk), sy * rr); c.stroke(); }
      c.restore();
      if (lk >= 1 && p < 0.5) {
        const t = tabById(SKY.dive.id);
        c.font = `11px ${MONO}`; c.textAlign = 'center'; c.fillStyle = `rgba(236,232,225,${1 - p * 2})`;
        if (c.letterSpacing !== undefined) c.letterSpacing = '2px';
        c.fillText(`OPENING // ${((t && hostOf(t.url)) || 'OTO').toUpperCase()}`, x, y + 46);
        if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
      }
      const rad = Math.max(w, h) * (0.08 + 1.1 * p);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(255,246,232,${0.25 + 0.6 * p})`); g.addColorStop(0.45, `rgba(241,238,232,${0.35 * p})`); g.addColorStop(1, 'rgba(7,8,11,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
  }
  // a star being dragged
  if (SKY.drag && SKY.drag.moved) {
    const t = tabById(SKY.drag.id), d = SKY.drag;
    if (SKY.mode === 'galaxy') { skyStar(c, d.mx, d.my, 3.4, 1, false); c.strokeStyle = 'rgba(236,232,225,.9)'; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.beginPath(); c.arc(d.mx, d.my, 15, 0, 7); c.stroke(); c.setLineDash([]); }
    let hint;
    if (SKY.mode === 'galaxy') { const to = d.over && d.over !== d.ws ? skyWs(d.over) : null; hint = to ? (to.ess ? 'Add to Essentials' : `Move to ${to.name}`) : null; }
    else if (d.over) { const o = tabById(d.over); hint = `Connect to ${(o && (o.title || prettyUrl(o.url))) || 'this star'}`; }
    else if (d.link) hint = 'Drop on a star to connect';
    c.font = `600 13px ${SANS}`; c.textAlign = 'center'; c.fillStyle = hint ? '#7FE3FF' : SKY_C.tx;
    if (hint || SKY.mode === 'galaxy') c.fillText(skyEll(c, hint || (t && t.title) || '', 230), d.mx, d.my + (SKY.mode === 'galaxy' ? 32 : 50));
  }
}

/** A tab's star: a four-pointed star with a soft glow (warmer for the tab you're on), like on Oto for Android. */
function skyStar(c, x, y, s, a, warm) {
  const keep = c.globalAlpha;
  c.globalAlpha = keep * a;
  const col = warm ? '255,243,220' : '232,238,255';
  const g = c.createRadialGradient(x, y, 0, x, y, s * 4.5);
  g.addColorStop(0, `rgba(${col},1)`); g.addColorStop(0.22, `rgba(${col},.35)`); g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 4.5, 0, 7); c.fill();
  c.fillStyle = '#FFFAF2'; c.beginPath();
  c.moveTo(x, y - s * 2.6); c.quadraticCurveTo(x, y, x + s * 2.6, y); c.quadraticCurveTo(x, y, x, y + s * 2.6); c.quadraticCurveTo(x, y, x - s * 2.6, y); c.quadraticCurveTo(x, y, x, y - s * 2.6);
  c.fill();
  c.globalAlpha = keep;
}
function skyEll(c, t, max) {
  t = String(t || '');
  if (c.measureText(t).width <= max) return t;
  let lo = 0, hi = t.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (c.measureText(`${t.slice(0, mid)}…`).width <= max) lo = mid; else hi = mid - 1; }
  return `${t.slice(0, lo)}…`;
}

// ------------------------------------------------------------------ finding things under the pointer
function skyStarAt(x, y, skip = null) {
  let best = null, bd = 18;
  for (const s of SKY.starById.values()) {
    if (s.id === skip) continue; const [sx, sy] = skyToScreen(s.x, s.y); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = s; } }
  return best;
}
function skySpaceAt(x, y) {
  if (SKY.mode === 'galaxy') return null; // (no Spaces in the Galaxy since 1.7.10)
  if (!SKY.lay.spaces.length) return null;
  const [wx, wy] = skyToWorld(x, y);
  let best = null, bd = Infinity;
  for (const s of SKY.lay.spaces) { const d = ((wx - s.cx) / s.rx) ** 2 + ((wy - s.cy) / s.ry) ** 2; if (d <= 1.15 && d < bd) { bd = d; best = s.id; } }
  return best;
}

// ------------------------------------------------------------------ actions (the same ones the sidebar uses)
function skyOpenNow(t) {
  if (!t.essential && t.ws !== S.activeWs) switchWorkspace(t.ws, { activate: false });
  activate(t.id);
}
/** Open a tab: a quantum jump into its star, the same as to a device in the Galaxy (1.7.11): the view turns to face it,
 *  brackets lock on, the sky stretches into streaks as you speed up into it, and under the flash the tab opens and the
 *  overview fades away (with reduce-motion: straight away). */
function skyOpen(id) {
  const t = tabById(id); if (!t) return;
  const s = SKY.starById.get(id);
  if (!skyMotion() || !s || !SKY.layer || SKY.dive || SKY.warp) { v1CloseOverview(); skyOpenNow(t); return; }
  skyHideCard();
  if (SKY.help) { SKY.help.remove(); SKY.help = null; }
  const from = { ...SKY.cam }, layer = SKY.layer;
  skyQuantum({
    wx: s.x, wy: s.y, label: ((t && hostOf(t.url)) || 'OTO').toUpperCase(),
    arrive: () => {
      skyOpenNow(t);
      // the flash fades with the overview, onto the page
      layer.style.transition = 'opacity .3s ease'; layer.style.opacity = '0';
      // (next time the overview opens where you were looking, not zoomed into this star)
      setTimeout(() => { SKY.warp = null; SKY.fly = null; Object.assign(SKY.cam, from); skySaveCam(); if (layer.isConnected) v1CloseOverview(); }, 320);
    },
  });
}
function skyMove(id, toWs) {
  const t = tabById(id); if (!t) return;
  if (toWs === '__essentials') { if (!t.essential) toggleEssential(t.id); }
  else {
    if (!t.essential && t.ws === toWs) return;
    if (S.active[t.ws] === t.id) delete S.active[t.ws];
    if (t.id === (activeTab() || {}).id) { delete S.active[S.activeWs]; showNothing(); }
    t.ws = toWs; t.essential = false;
    toast(`Moved to ${(skyWs(toWs) || {}).name || 'Space'}`, { icon: 'layers', timeout: 1500 });
  }
  save(); render(); skyRelayout(); skyDraw();
}
function skyClose(id) {
  skyHideCard();
  closeTab(id);
  setTimeout(() => { if (SKY.on) { skyRelayout(); skyDraw(); } }, 420);
}

// ------------------------------------------------------------------ the free sky: put stars anywhere, join them into groups
function skySetPos(id, wx, wy) { if (!S.sky || !S.sky.pos) return; S.sky.pos[id] = [Math.round(wx), Math.round(wy)]; save(); skyRelayout(); skyDraw(); }
/** A free spot about one star-step from (tx, ty), towards angle a first. */
function skySpotNear(tx, ty, a, skip) {
  const others = [...SKY.starById.values()].filter((st) => st.id !== skip);
  for (let ring = 1; ring < 8; ring++) for (let k = 0; k < 12; k++) {
    const ang = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6), r = 100 * ring;
    const x = tx + Math.cos(ang) * r, y = ty + Math.sin(ang) * r;
    if (others.every((o) => Math.hypot(o.x - x, o.y - y) >= 90)) return [x, y];
  }
  return [tx + Math.cos(a) * 100, ty + Math.sin(a) * 100];
}
function skyConnect(a, b) {
  if (!S.sky || a === b || !tabById(a) || !tabById(b)) return;
  const e = a < b ? [a, b] : [b, a];
  if (!S.sky.edges.some(([x, y]) => x === e[0] && y === e[1])) { S.sky.edges.push(e); save(); }
  skyRelayout(); skyDraw();
  const st = SKY.starById.get(a);
  if (st && st.g && !st.g.lone) toast(`Joined: ${st.g.name}`, { icon: 'star', timeout: 1500 });
}
function skyUnlink(a, b) { if (!S.sky) return; S.sky.edges = S.sky.edges.filter(([x, y]) => !((x === a && y === b) || (x === b && y === a))); save(); SKY.hoverEdge = null; skyRelayout(); skyDraw(); }
function skyDisconnect(id) { if (!S.sky) return; S.sky.edges = S.sky.edges.filter(([x, y]) => x !== id && y !== id); delete S.sky.names[id]; save(); skyRelayout(); skyDraw(); }
function skyBreakGroup(g) { if (!S.sky) return; const set = new Set(g.ids); S.sky.edges = S.sky.edges.filter(([x, y]) => !set.has(x) && !set.has(y)); for (const id of g.ids) delete S.sky.names[id]; save(); skyRelayout(); skyDraw(); }
async function skyRenameGroup(g) {
  const n = typeof v1AskText === 'function' ? await v1AskText('Rename constellation', 'Give this group of stars a name.') : null;
  if (!n || !n.trim() || !S.sky) return;
  for (const id of g.ids) S.sky.names[id] = n.trim().slice(0, 40);
  save(); if (SKY.on) { skyRelayout(); skyDraw(); }
}
/** Start drawing a line from a star: the next star you click is joined to it (Esc or a click on empty sky stops). */
function skyStartLink(id, mx, my) { SKY.linking = { id, mx, my, over: null }; if (SKY.canvas) SKY.canvas.style.cursor = 'crosshair'; skyDraw(); }
function skyEdgeAt(x, y) {
  if (SKY.mode !== 'sky' || !SKY.lay || !SKY.lay.edges) return null;
  let best = null, bd = 6;
  for (const e of SKY.lay.edges) {
    const a = SKY.starById.get(e[0]), b = SKY.starById.get(e[1]); if (!a || !b) continue;
    const [ax, ay] = skyToScreen(a.x, a.y), [bx, by] = skyToScreen(b.x, b.y);
    const L = (bx - ax) ** 2 + (by - ay) ** 2; if (L < 1) continue;
    const k = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L, 0, 1);
    if (k < 0.12 || k > 0.88) continue; // (near the stars themselves the star wins)
    const d = Math.hypot(x - (ax + (bx - ax) * k), y - (ay + (by - ay) * k));
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function skyNameAt(x, y) { return SKY.mode === 'sky' ? (SKY.nameHit || []).find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) || null : null; }

// ------------------------------------------------------------------ the preview window (cached pictures only)
function skyShowCard(id) {
  const t = tabById(id), s = SKY.starById.get(id); if (!t || !s) return;
  if (SKY.card && SKY.card.dataset.id === id) return;
  skyHideCard();
  const v = V.get(t.id), act = activeTab();
  const status = act && act.id === t.id ? 'ACTIVE' : v && !v.frozen ? 'LIVE' : 'ASLEEP';
  const ws = skyWs(t.essential ? '__essentials' : t.ws);
  const img = h('div', { class: 'img' });
  const moveBtn = h('button', { class: 'b', onclick: (e) => { e.stopPropagation(); skyMoveMenu(t, e.clientX, e.clientY); } }, 'Move to Space ▾');
  const n = S.tabs.indexOf(t) + 1;
  const card = h('div', { class: 'sky-card', 'data-id': id, role: 'dialog', 'aria-label': `Preview: ${t.title || prettyUrl(t.url)}` },
    h('div', { class: 'bd' },
      h('div', { class: 'hd' },
        h('span', { class: 'tag' }, `TAB ${String(n).padStart(2, '0')} // ${(hostOf(t.url) || prettyUrl(t.url) || 'oto').toUpperCase()}`),
        h('span', { class: `st ${status.toLowerCase()}` }, status),
        h('button', { class: 'x', title: 'Close tab', 'aria-label': 'Close tab', onclick: (e) => { e.stopPropagation(); skyClose(id); }, html: icon('x') })),
      img,
      h('div', { class: 'tt' }, favEl(t, null, true), h('b', {}, t.title || prettyUrl(t.url))),
      h('div', { class: 'meta' }, h('span', {}, `${((ws && ws.name) || '').toUpperCase()} // ${String(s.g.name || '').toUpperCase()}`), h('span', { class: 'age' }, '')),
      h('div', { class: 'acts' },
        h('button', { class: 'b pri', onclick: (e) => { e.stopPropagation(); skyOpen(id); } }, 'Open'),
        t.essential ? null : h('button', { class: 'b', onclick: (e) => { e.stopPropagation(); togglePin(id); skyShowCardRefresh(id); } }, t.pinned ? 'Unpin' : 'Pin'),
        moveBtn)));
  card.addEventListener('mouseenter', () => clearTimeout(SKY.cardHide));
  card.addEventListener('mouseleave', () => skyHideCardSoon());
  SKY.layer.append(card);
  SKY.card = card;
  skyPlaceCard();
  // the picture: the cached one, retaken only for a loaded tab and at most every 30 s (one at a time)
  const cache = typeof V1P !== 'undefined' ? V1P.cache : (SKY.cache || (SKY.cache = new Map()));
  const c = cache.get(t.id);
  const age = card.querySelector('.age');
  const showPic = (cc) => { img.style.backgroundImage = `url(${cc.url})`; img.classList.remove('none'); age.textContent = skyAgo(cc.at); };
  if (c) showPic(c);
  if (v && !v.frozen && (!c || Date.now() - c.at > 30000) && !SKY.capturing) {
    SKY.capturing = true;
    v.wv.capturePage().then((im) => {
      if (!im.isEmpty()) { const cc = { url: im.resize({ width: 560 }).toDataURL(), at: Date.now() }; cache.set(t.id, cc); if (SKY.card === card) showPic(cc); }
      else if (!c) { img.classList.add('none'); }
    }).catch(() => { if (!c) img.classList.add('none'); }).finally(() => { SKY.capturing = false; });
  } else if (!c) { img.classList.add('none'); img.dataset.why = v ? 'No picture yet' : 'Asleep — open it to load'; }
}
function skyShowCardRefresh(id) { skyHideCard(); setTimeout(() => { if (SKY.on) { skyShowCard(id); skyDraw(); } }, 30); }
function skyAgo(at) { const s = Math.round((Date.now() - at) / 1000); return s < 10 ? 'JUST NOW' : s < 60 ? `${s} S AGO` : `${Math.round(s / 60)} MIN AGO`; }
function skyPlaceCard(quiet) {
  const card = SKY.card; if (!card) return;
  const s = SKY.starById.get(card.dataset.id); if (!s) return;
  const [x, y] = skyToScreen(s.x, s.y);
  const cw = card.offsetWidth || 268, chh = card.offsetHeight || 290;
  let top = y - 34 - chh;
  if (top < 66) top = Math.min(y + 34, SKY.h - chh - 12);
  const left = clamp(x - cw / 2, 8, SKY.w - cw - 8);
  card.style.left = `${left}px`; card.style.top = `${top}px`;
  if (!quiet) skyDraw();
}
function skyHideCard() { clearTimeout(SKY.cardHide); if (SKY.card) { SKY.card.remove(); SKY.card = null; } }
function skyHideCardSoon() { clearTimeout(SKY.cardHide); SKY.cardHide = setTimeout(() => { if (!SKY.card || !SKY.card.matches(':hover')) skyHideCard(); }, 260); }

function skyMoveMenu(t, x, y) {
  const items = [{ header: 'Move to Space' },
    ...S.workspaces.filter((w) => t.essential || w.id !== t.ws).map((w) => ({ label: w.name, icon: 'layers', run: () => skyMove(t.id, w.id) })),
    t.essential ? null : { label: 'Essentials', icon: 'star', run: () => skyMove(t.id, '__essentials') }];
  showMenu(x, y, items);
}
function skyStarMenu(t, x, y) {
  skyHideCard();
  const st = SKY.starById.get(t.id), sky = SKY.mode === 'sky';
  const inGroup = sky && st && st.g && !st.g.lone;
  const r = SKY.canvas.getBoundingClientRect();
  showMenu(x, y, [
    { label: 'Open', icon: 'tab', run: () => skyOpen(t.id) },
    t.essential ? null : { label: t.pinned ? 'Unpin' : 'Pin', icon: 'pin', run: () => { togglePin(t.id); skyDraw(); } },
    '-',
    sky ? { label: 'Connect to another star…', icon: 'route', run: () => skyStartLink(t.id, x - r.left, y - r.top) } : null,
    inGroup ? { label: 'Rename group…', icon: 'edit', run: () => skyRenameGroup(st.g) } : null,
    inGroup ? { label: 'Take out of the group', icon: 'x', run: () => skyDisconnect(t.id) } : null,
    sky ? '-' : null,
    { header: 'Move to Space' },
    ...S.workspaces.filter((w) => t.essential || w.id !== t.ws).map((w) => ({ label: w.name, icon: 'layers', run: () => skyMove(t.id, w.id) })),
    '-',
    { label: 'Close tab', icon: 'trash', danger: true, run: () => skyClose(t.id) },
  ]);
}

// ------------------------------------------------------------------ mounting into the space overview
function skyMount(layer, search, mode = 'sky') {
  SKY.mode = mode === 'galaxy' ? 'galaxy' : 'sky'; SKY.turn = SKY.turn || 0; SKY.lastT = 0; SKY.trans = null; SKY.pull = null;
  if (!S.sky) S.sky = { cam: null, gcam: null };
  SKY.on = true; SKY.layer = layer; SKY.hover = null; SKY.sel = null; SKY.drag = null; SKY.pan = null; SKY.gdrag = null; SKY.linking = null; SKY.hoverEdge = null;
  SKY.query = search.value.trim(); SKY.words = typeof words === 'function' ? words(SKY.query) : SKY.query.toLowerCase().split(/\s+/).filter(Boolean);
  document.body.classList.add('v1-sky-open');
  const box = h('div', { class: 'sky-box' });
  const canvas = h('canvas', { class: 'sky-canvas', tabindex: '0', 'aria-label': SKY.mode === 'galaxy'
    ? 'Galaxy view: the galaxy, with the devices signed in to your Oto account circling it. Click a device to go to it; zoom in to come down to your tabs.'
    : 'Sky View: your tabs as stars. Use the search box, or arrow keys to move between tabs and Enter to open one.' });
  box.append(canvas);
  layer.append(box);
  SKY.canvas = canvas; SKY.ctx = canvas.getContext('2d');
  const size = () => {
    const r = box.getBoundingClientRect(); SKY.dpr = Math.min(2, devicePixelRatio || 1);
    SKY.w = r.width; SKY.h = r.height; canvas.width = Math.round(r.width * SKY.dpr); canvas.height = Math.round(r.height * SKY.dpr);
    canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`; skyDraw();
  };
  skyRelayout();
  size();
  SKY.ro = new ResizeObserver(size); SKY.ro.observe(box);
  // where you were looking last time, else the tab you're on, else everything
  const saved = S.sky && S.sky[mode === 'galaxy' ? 'gcam' : 'cam'];
  const act = activeTab();
  // (the first time: every Space at once, so it's clear which Space holds what)
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.z)) Object.assign(SKY.cam, { x: saved.x, y: saved.y, z: clamp(saved.z, 0.25, 2.5) });
  else Object.assign(SKY.cam, skyFitAll());
  // a fresh picture of the tab you were just looking at
  if (act && V.get(act.id) && typeof V1P !== 'undefined') V.get(act.id).wv.capturePage().then((im) => { if (!im.isEmpty()) V1P.cache.set(act.id, { url: im.resize({ width: 560 }).toDataURL(), at: Date.now() }); }).catch(() => {});

  // pointer: drag empty sky to pan, drag a star to move it (into another Space, or to a new spot), wheel to zoom
  canvas.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (e.button !== 0 || SKY.fly) return;
    canvas.focus({ preventScroll: true });
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const win = skyWindowAt(x, y);
    if (win) { // a star's window: × closes the tab, anywhere else opens it
      if (win.close && x >= win.close.x0 && x <= win.close.x1 && y >= win.close.y0 && y <= win.close.y1) skyClose(win.id); else skyOpen(win.id);
      return;
    }
    const s = skyStarAt(x, y);
    if (SKY.linking) { // drawing a line: a star joins it, anything else stops
      const from = SKY.linking.id; SKY.linking = null; canvas.style.cursor = '';
      if (s && s.id !== from) skyConnect(from, s.id); else skyDraw();
      return;
    }
    const nm = !s && skyNameAt(x, y);
    if (s) { const t = tabById(s.id); SKY.drag = { id: s.id, ws: t && t.essential ? '__essentials' : t && t.ws, x0: x, y0: y, mx: x, my: y, moved: false, over: null, link: SKY.mode === 'sky' && e.shiftKey }; skyHideCard(); }
    else if (nm) SKY.gdrag = { ids: nm.g.ids, g: nm.g, x0: x, y0: y, dx: 0, dy: 0, moved: false };
    else if (SKY.mode === 'galaxy' && galaxyDevAt(x, y)) galaxyFlyTo(galaxyDevAt(x, y)); // a device: fly to it (a dark one shows its window)
    else SKY.pan = { x0: x, y0: y, cx: SKY.cam.x, cy: SKY.cam.y, moved: false };
  });
  // (pointer moves only ask for a frame: the drawing happens once per screen refresh, however fast the mouse reports)
  SKY.onMove = (e) => {
    if (!SKY.on || SKY.fly) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (SKY.pan) {
      if (Math.hypot(x - SKY.pan.x0, y - SKY.pan.y0) > 3) SKY.pan.moved = true;
      SKY.cam.x = SKY.pan.cx - (x - SKY.pan.x0) / SKY.cam.z; SKY.cam.y = SKY.pan.cy - (y - SKY.pan.y0) / SKY.cam.z;
      skyHideCard(); galaxyHideDevice(); skyKick(); return;
    }
    if (SKY.gdrag) { // moving a whole group by its name
      if (Math.hypot(x - SKY.gdrag.x0, y - SKY.gdrag.y0) > 4) SKY.gdrag.moved = true;
      SKY.gdrag.dx = (x - SKY.gdrag.x0) / SKY.cam.z; SKY.gdrag.dy = (y - SKY.gdrag.y0) / SKY.cam.z;
      canvas.style.cursor = 'grabbing'; skyKick(); return;
    }
    if (SKY.drag) {
      if (Math.hypot(x - SKY.drag.x0, y - SKY.drag.y0) > 5) SKY.drag.moved = true;
      SKY.drag.mx = x; SKY.drag.my = y;
      if (SKY.mode === 'galaxy') SKY.drag.over = skySpaceAt(x, y);
      else { const o = skyStarAt(x, y, SKY.drag.id); SKY.drag.over = o ? o.id : null; }
      canvas.style.cursor = SKY.drag.link ? 'crosshair' : 'grabbing'; skyKick(); return;
    }
    if (SKY.linking) { const o = skyStarAt(x, y, SKY.linking.id); SKY.linking.mx = x; SKY.linking.my = y; SKY.linking.over = o ? o.id : null; skyKick(); return; }
    if (e.target !== canvas) return;
    if (skyWindowAt(x, y)) { canvas.style.cursor = 'pointer'; return; }
    if (!skyStarAt(x, y)) {
      const ed = skyEdgeAt(x, y), nm = skyNameAt(x, y);
      if (ed !== SKY.hoverEdge) { SKY.hoverEdge = ed; skyKick(); }
      if (ed || nm) { canvas.style.cursor = nm ? 'grab' : 'context-menu'; if (SKY.hover) { SKY.hover = null; skyKick(); skyHideCardSoon(); } return; }
    } else if (SKY.hoverEdge) { SKY.hoverEdge = null; skyKick(); }
    const s = skyStarAt(x, y);
    const id = s ? s.id : null;
    if (SKY.mode === 'galaxy' && !s) { // your devices
      const dv = galaxyDevAt(x, y), did = dv ? dv.id : null;
      if (did !== SKY.hoverDev) {
        SKY.hoverDev = did; skyKick(); clearTimeout(SKY.hoverDevT);
        if (dv) SKY.hoverDevT = setTimeout(() => { if (SKY.hoverDev === did) galaxyShowDevice(dv); }, 160); else galaxyHideDeviceSoon();
      }
      if (dv) { canvas.style.cursor = 'pointer'; if (SKY.hover) { SKY.hover = null; skyHideCardSoon(); } return; }
    }
    canvas.style.cursor = s ? 'pointer' : 'grab';
    if (id !== SKY.hover) {
      SKY.hover = id; skyKick();
      clearTimeout(SKY.hoverT);
      if (id) SKY.hoverT = setTimeout(() => { if (SKY.hover === id) skyShowCard(id); }, 160);
      else skyHideCardSoon();
    }
  };
  SKY.onUp = (e) => {
    if (!SKY.on) return;
    if (SKY.pan) {
      const moved = SKY.pan.moved, x0 = SKY.pan.x0, y0 = SKY.pan.y0; SKY.pan = null; skySaveCam();
      if (!moved) { SKY.sel = null; const sp = skySpaceAt(x0, y0); if (sp) skyGoSpace(sp, 420); else skyDraw(); }
      return;
    }
    if (SKY.gdrag) {
      const g = SKY.gdrag; SKY.gdrag = null; canvas.style.cursor = '';
      if (g.moved && S.sky && S.sky.pos) { for (const id of g.ids) { const q = S.sky.pos[id]; if (q) S.sky.pos[id] = [Math.round(q[0] + g.dx), Math.round(q[1] + g.dy)]; } save(); skyRelayout(); skyDraw(); }
      else if (!g.moved) { skyGlideTo(skyFitStars(g.ids.map((id) => SKY.starById.get(id)).filter(Boolean)), 420); setTimeout(() => { skyUpdateZoom(); skySaveCam(); }, 440); }
      return;
    }
    if (SKY.drag) {
      const d = SKY.drag; SKY.drag = null; canvas.style.cursor = '';
      if (!d.moved) { if (e.button === 0) skyOpen(d.id); return; }
      if (SKY.mode === 'galaxy') { if (d.over && d.over !== d.ws) skyMove(d.id, d.over); skyDraw(); return; }
      if (d.over) { // dropped on another star: joined to it (and, if it was moved, set down right next to it)
        if (!d.link) { const tg = SKY.starById.get(d.over), me = SKY.starById.get(d.id); if (tg && me && S.sky) { const sp = skySpotNear(tg.x, tg.y, Math.atan2(me.y - tg.y, me.x - tg.x), d.id); S.sky.pos[d.id] = [Math.round(sp[0]), Math.round(sp[1])]; } }
        skyConnect(d.id, d.over);
      } else if (!d.link) { const [wx, wy] = skyToWorld(d.mx, d.my); skySetPos(d.id, wx, wy); } // anywhere you like
      else skyDraw();
    }
  };
  addEventListener('mousemove', SKY.onMove);
  addEventListener('mouseup', SKY.onUp);
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; const s = skyStarAt(x, y);
    if (SKY.linking) { SKY.linking = null; canvas.style.cursor = ''; skyDraw(); return; }
    const t = s && tabById(s.id); if (t) { skyStarMenu(t, e.clientX, e.clientY); return; }
    const ed = skyEdgeAt(x, y);
    if (ed) { showMenu(e.clientX, e.clientY, [{ label: 'Remove this line', icon: 'x', run: () => skyUnlink(ed[0], ed[1]) }]); return; }
    const nm = skyNameAt(x, y);
    if (nm) showMenu(e.clientX, e.clientY, [{ label: 'Rename group…', icon: 'edit', run: () => skyRenameGroup(nm.g) }, { label: 'Break up the group', icon: 'x', run: () => skyBreakGroup(nm.g) }]);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (SKY.fly) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const [wx, wy] = skyToWorld(x, y);
    const want = SKY.cam.z * Math.exp(-e.deltaY * 0.0015);
    const zMin = SKY.mode === 'galaxy' ? 0.22 : 0.25, zMax = SKY.mode === 'galaxy' ? 1.8 : 2.5;
    if (SKY.mode === 'sky' && e.deltaY > 0 && want < zMin && SKY.cam.z <= zMin + 0.01) { skyEdgePull('out', x, y); return; }
    if (SKY.mode === 'galaxy' && e.deltaY < 0 && want > zMax && SKY.cam.z >= zMax - 0.01) { skyEdgePull('in', x, y); return; }
    const z = clamp(want, zMin, zMax);
    SKY.cam.z = z;
    SKY.cam.x = wx - (x - SKY.w / 2) / z; SKY.cam.y = wy - (y - SKY.h / 2) / z;
    skyHideCard(); skyKick(); skySaveCamSoon(); skyUpdateZoom();
  }, { passive: false });
  canvas.addEventListener('mouseleave', () => { if (SKY.hover) { SKY.hover = null; skyDraw(); skyHideCardSoon(); } });
  canvas.addEventListener('keydown', (e) => { if (e.key === 'Escape' && SKY.linking) { e.preventDefault(); e.stopPropagation(); SKY.linking = null; canvas.style.cursor = ''; skyDraw(); return; } skyKey(e); });

  // corner controls: zoom, back to the tab you're on, reset layout, help
  const zoomTxt = h('span', { class: 'zt' }, '100%');
  SKY.zoomTxt = zoomTxt;
  const ctl = h('div', { class: 'sky-ctl' },
    h('button', { title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => skyZoomBy(1 / 1.25) }, '−'),
    zoomTxt,
    h('button', { title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => skyZoomBy(1.25) }, '+'),
    h('button', { title: 'Show everything', 'aria-label': 'Show everything', onclick: () => skyGlideTo(skyFitAll()), html: icon('grid') }),
    h('button', { class: 'me', hidden: SKY.mode === 'galaxy', title: 'Back to the tab you’re on', 'aria-label': 'Back to the tab you’re on', onclick: () => { const a = activeTab(); if (a) skyFocusStar(a.id, 1); } }, '◎'),
    h('button', { class: 'rst', hidden: SKY.mode === 'galaxy', title: 'Sort the stars by site again (you can undo it)', 'aria-label': 'Sort the stars by site again', onclick: () => skyResetLayout() }, '⟲'),
    h('button', { class: 'q', title: 'How to use Sky View', 'aria-label': 'How to use Sky View', onclick: () => skyHelp(true) }, '?'));
  layer.append(ctl);
  skyUpdateZoom();
  skyHelp(false);
  if (skyMotion()) { const to = { ...SKY.cam }; SKY.cam.z = to.z * 0.82; skyGlideTo(to, 380); }
  skyKick();
}

function skyUpdateZoom() { if (SKY.zoomTxt) SKY.zoomTxt.textContent = `${Math.round(SKY.cam.z * 100)}%`; }
function skyZoomBy(f) {
  if (SKY.mode === 'sky' && f < 1 && SKY.cam.z <= 0.26) return skySwitchMode('galaxy', { ws: skySpaceAt(SKY.w / 2, SKY.h / 2) || S.activeWs });
  if (SKY.mode === 'galaxy' && f > 1 && SKY.cam.z >= 1.79) { SKY.pull = { dir: 'in', n: 1, t: performance.now() }; return skyEdgePull('in', SKY.w / 2, SKY.h / 2); }
  skyGlideTo({ x: SKY.cam.x, y: SKY.cam.y, z: clamp(SKY.cam.z * f, SKY.mode === 'galaxy' ? 0.22 : 0.25, SKY.mode === 'galaxy' ? 1.8 : 2.5) }, 200); setTimeout(() => { skyUpdateZoom(); skySaveCam(); }, 220); }
function skySaveCam() { if (S.sky) { S.sky[SKY.mode === 'galaxy' ? 'gcam' : 'cam'] = { x: Math.round(SKY.cam.x), y: Math.round(SKY.cam.y), z: +SKY.cam.z.toFixed(3) }; save(); } }
function skySaveCamSoon() { clearTimeout(SKY.camT); SKY.camT = setTimeout(skySaveCam, 400); }
function skyResetLayout() {
  const before = JSON.parse(JSON.stringify(S.sky || {}));
  S.sky = { cam: null, gcam: before.gcam || null }; // (sorted again by site, the way a new sky starts)
  skyRelayout(); skyGlideTo(skyFitAll());
  toast('Stars sorted by site and scattered again', { icon: 'reload', timeout: 6000, action: { label: 'Undo', run: () => { S.sky = before; save(); if (SKY.on) { skyRelayout(); skyGlideTo(skyFitAll()); } } } });
}

/** The controls, shown the first few times (then only behind the ? button). */
function skyHelp(force) {
  if (SKY.help) { SKY.help.remove(); SKY.help = null; if (force) return; }
  const key = SKY.mode === 'galaxy' ? 'galaxyHelpSeen2' : 'skyHelpSeen'; // (new tips for the Galaxy in 1.7.10)
  const seen = S.settings[key] || 0;
  if (!force && seen >= 3) return;
  if (!force) { S.settings[key] = seen + 1; save(); }
  const tips = SKY.mode === 'galaxy'
    ? [['Your devices', 'are its stars'], ['Click one', 'go to it'], ['Dark', 'its app isn’t open'], ['Zoom in', 'down to your tabs']]
    : [['Drag a star', 'put it anywhere'], ['Drop on a star', 'join them'], ['Shift-drag', 'draw a line'], ['Right-click', 'more']];
  SKY.help = h('div', { class: 'sky-help' }, ...tips.map(([k, t]) => h('span', {}, h('kbd', {}, k), t)),
    h('button', { class: 'ok', onclick: () => { S.settings[key] = 3; save(); if (SKY.help) { SKY.help.remove(); SKY.help = null; } } }, 'Got it'));
  SKY.layer.append(SKY.help);
}

/** Keyboard: arrows move between tabs (nearest star that way), Enter opens, Home goes back to the tab you're on. */
function skyKey(e) {
  if (!SKY.on) return false;
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (dirs[e.key]) {
    e.preventDefault();
    const from = SKY.starById.get(SKY.sel) || SKY.starById.get((activeTab() || {}).id) || [...SKY.starById.values()][0];
    if (!from) return true;
    if (!SKY.sel) { SKY.sel = from.id; skyFocusStar(from.id); skyDraw(); return true; }
    const [dx, dy] = dirs[e.key];
    let best = null, bs = Infinity;
    for (const s of SKY.starById.values()) {
      if (s.id === from.id) continue;
      const t = tabById(s.id); if (!t || !skyMatch(t)) continue;
      const vx = s.x - from.x, vy = s.y - from.y, along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const side = Math.abs(vx * dy - vy * dx);
      const score = along + side * 2.2;
      if (score < bs) { bs = score; best = s; }
    }
    if (best) { SKY.sel = best.id; skyFocusStar(best.id); skyShowCard(best.id); skyDraw(); }
    return true;
  }
  if (e.key === 'Enter') { const id = SKY.sel || skyFirstMatch(); if (id) { e.preventDefault(); skyOpen(id); } return true; }
  if (e.key === 'Home') { e.preventDefault(); const a = activeTab(); if (a) { SKY.sel = a.id; skyFocusStar(a.id, 1); } return true; }
  if (e.key === 'Delete' && SKY.sel) { e.preventDefault(); const t = tabById(SKY.sel); if (t && !t.pinned) skyClose(t.id); return true; }
  return false;
}
function skyFirstMatch() {
  if (!SKY.words.length) return null;
  const hit = S.tabs.filter(skyMatch).sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))[0];
  return hit ? hit.id : null;
}

/** The search box: matching tabs stay bright, the rest dim, and the sky flies to the best match. */
function skySearch(q) {
  if (!SKY.on) return;
  SKY.query = q; SKY.words = typeof words === 'function' ? words(q) : q.toLowerCase().split(/\s+/).filter(Boolean);
  const id = skyFirstMatch();
  SKY.sel = id;
  if (id) skyFocusStar(id); else skyDraw();
}

/** Pictures for the preview window: the tab you're looking at is pictured every 30 s while Oto is in front (only that
 *  one, small, kept in memory with the sidebar's peek pictures; never saved to disk). Background tabs are hidden, so
 *  they keep the picture from when you last looked at them. */
function skyPictureTick() {
  try {
    const t = activeTab(), v = t && V.get(t.id);
    if (!t || !v || v.frozen || document.hidden || !document.hasFocus() || typeof V1P === 'undefined' || SKY.capturing) return;
    const c = V1P.cache.get(t.id);
    if (c && Date.now() - c.at < 25000) return;
    SKY.capturing = true;
    v.wv.capturePage().then((im) => { if (!im.isEmpty()) V1P.cache.set(t.id, { url: im.resize({ width: 560 }).toDataURL(), at: Date.now() }); })
      .catch(() => {}).finally(() => { SKY.capturing = false; });
  } catch { SKY.capturing = false; }
}
if (typeof setInterval === 'function' && typeof document !== 'undefined') setInterval(skyPictureTick, 30000);

function skyUnmount() {
  galaxyHideDevice(); SKY.hoverDev = null; SKY.fly = null; SKY.warp = null;
  if (!SKY.on) return;
  skySaveCam();
  SKY.on = false;
  removeEventListener('mousemove', SKY.onMove);
  removeEventListener('mouseup', SKY.onUp);
  if (SKY.ro) SKY.ro.disconnect();
  clearTimeout(SKY.twinkle); clearTimeout(SKY.hoverT); clearTimeout(SKY.camT);
  if (SKY.raf) cancelAnimationFrame(SKY.raf); SKY.raf = 0;
  skyHideCard();
  if (SKY.help) { SKY.help.remove(); SKY.help = null; }
  SKY.canvas = null; SKY.ctx = null; SKY.layer = null;
  document.body.classList.remove('v1-sky-open');
}

