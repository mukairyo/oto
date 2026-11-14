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

   Saved in S.sky: cells (Space → place in the sky), groups (Space|constellation → place in its Space), slots (tab →
   place in its constellation), offsets (tab → where you dragged its star), cam (where you were looking). */

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
if (typeof module !== 'undefined') module.exports = { skyLayout, skyAssign, skySlots, skyShape, skySpiral, SKY_L, galaxyLayout, GAL };

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
  const spaces = S.workspaces.map((w) => ({ id: w.id }));
  // Essentials belong to every Space: they get a small region of their own, "Essentials"
  const ESS = '__essentials';
  if (essentials().length) spaces.unshift({ id: ESS });
  const tabs = S.tabs.map((t) => ({ id: t.id, ws: t.essential ? ESS : t.ws, ...skyTabInfo(t) }));
  SKY.lay = skyLayout(tabs, spaces, S.sky || {});
  S.sky = SKY.lay.state; save();
  SKY.starById = new Map();
  for (const g of SKY.lay.groups) for (const s of g.stars) SKY.starById.set(s.id, { ...s, g });
  SKY.spaceById = new Map(SKY.lay.spaces.map((s) => [s.id, s]));
}

function galaxyRelayout() {
  const act = activeTab();
  const tabs = S.tabs.map((t) => ({ id: t.id, ws: t.ws, essential: !!t.essential, active: !!(act && act.id === t.id), lastActive: t.lastActive || 0 }));
  SKY.gal = galaxyLayout(tabs, S.workspaces.map((w) => ({ id: w.id })), Date.now());
  // star dust along each arm (the same every time for a Space)
  for (const arm of SKY.gal.arms) {
    const r = skyRng(skyHash(arm.ws) ^ 0x9e37);
    arm.dust = Array.from({ length: 150 }, () => [GAL.R0 + r() * (arm.end - GAL.R0), (r() - 0.5) * 0.3, 0.6 + r() * 0.9, 0.2 + r() * 0.4, r() < 0.25]);
  }
  SKY.lay = { spaces: [], groups: [] };
  SKY.spaceById = new Map();
  SKY.starById = new Map();
  for (const st of SKY.gal.stars) SKY.starById.set(st.id, { ...st, x: 0, y: 0, g: { name: (skyWs(st.ws) || {}).name || '' } });
  galaxyPlace();
}
/** Where the stars are now that the galaxy has turned. */
function galaxyPlace() {
  for (const s of SKY.starById.values()) { s.x = Math.cos(s.th + SKY.turn) * s.r; s.y = Math.sin(s.th + SKY.turn) * s.r * GAL.TILT; }
}
/** Which arm (Space) a screen point is on: the arm passing nearest to it at that distance from the middle. */
function galaxyArmAt(x, y) {
  const [wx, wy] = skyToWorld(x, y);
  const r = Math.hypot(wx, wy / GAL.TILT), ang = Math.atan2(wy / GAL.TILT, wx);
  if (r < 95) return essentials().length ? '__essentials' : null;
  let best = null, bd = 0.75;
  for (const arm of SKY.gal.arms) {
    if (r > arm.end + 80) continue;
    let d = (ang - galTh(r, arm.off) - SKY.turn) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < bd) { bd = Math.abs(d); best = arm.ws; }
  }
  return best;
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
  const sp = SKY.lay.spaces;
  if (!sp.length) return { x: 0, y: 0, z: 1 };
  const x0 = Math.min(...sp.map((s) => s.cx - s.rx)), x1 = Math.max(...sp.map((s) => s.cx + s.rx));
  const y0 = Math.min(...sp.map((s) => s.cy - s.ry)), y1 = Math.max(...sp.map((s) => s.cy + s.ry));
  const z = clamp(Math.min((SKY.w - 80) / (x1 - x0), (SKY.h - 60) / (y1 - y0)), 0.3, 1.1);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z };
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
  const sp = SKY.spaceById.get(id); if (sp) { skyGlideTo({ x: sp.cx, y: sp.cy, z: clamp(Math.min((SKY.w - 80) / (sp.rx * 2), (SKY.h - 140) / (sp.ry * 2)), 0.4, 1.4) }, ms); setTimeout(() => { skyUpdateZoom(); skySaveCam(); }, ms + 20); } }
function skyFocusStar(id, z) { const s = SKY.starById.get(id); if (s) skyGlideTo({ x: s.x, y: s.y, z: z || Math.max(SKY.cam.z, 0.9) }); }

// ------------------------------------------------------------------ drawing
function skyKick() { if (!SKY.raf) SKY.raf = requestAnimationFrame(skyFrame); }
function skyFrame(now) {
  SKY.raf = 0;
  if (!SKY.on) return;
  if (SKY.glide) SKY.glide(now);
  if (SKY.mode === 'galaxy') {
    const dt = SKY.lastT ? Math.min(100, now - SKY.lastT) : 0; SKY.lastT = now;
    if (skyMotion() && !SKY.hover && !SKY.card && !SKY.drag && !SKY.pan && !SKY.dive && !SKY.sel) { SKY.turn += dt * (Math.PI * 2) / 360000; galaxyPlace(); } // one turn every 6 minutes
  }
  skyDraw(now);
  if (SKY.glide) skyKick();
  else if (skyMotion() && !document.hidden) { clearTimeout(SKY.twinkle); SKY.twinkle = setTimeout(skyKick, 50); } // gentle twinkle, ~20 fps
}

function skyDraw(now = performance.now()) {
  if (SKY.mode === 'galaxy') return galaxyDraw(now);
  const c = SKY.ctx; if (!c || !SKY.lay) return;
  const { w, h, dpr } = SKY;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  const z = SKY.cam.z;
  const act = activeTab();
  const SANS = '"Inter","Segoe UI",system-ui,sans-serif', MONO = 'ui-monospace,Consolas,"DejaVu Sans Mono",monospace', SERIF = 'Georgia,"Times New Roman",serif';
  const tw = skyMotion();
  // Spaces: a soft light in the Space's own colour, a faint outline, and its name
  for (const sp of SKY.lay.spaces) {
    const col = skySpaceColor(sp.id);
    const [x, y] = skyToScreen(sp.cx, sp.cy);
    const rx = sp.rx * z, ry = sp.ry * z;
    if (x + rx < -50 || x - rx > w + 50 || y + ry < -50 || y - ry > h + 50) continue;
    const hot = SKY.drag && SKY.drag.over === sp.id && SKY.drag.ws !== sp.id;
    c.save(); c.translate(x, y); c.scale(rx / ry, 1);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, ry);
    g.addColorStop(0, skyRgba(col, hot ? 0.3 : 0.15)); g.addColorStop(0.7, skyRgba(col, hot ? 0.12 : 0.055)); g.addColorStop(1, skyRgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, ry, 0, 7); c.fill(); c.restore();
    c.strokeStyle = skyRgba(col, hot ? 0.7 : 0.24); c.lineWidth = hot ? 1.6 : 1; c.setLineDash([2, 7]);
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.stroke(); c.setLineDash([]);
    const ws = skyWs(sp.id); const n = S.tabs.filter((t) => (sp.id === '__essentials' ? t.essential : !t.essential && t.ws === sp.id)).length;
    const i = S.workspaces.findIndex((x2) => x2.id === sp.id);
    const ty = y - ry + Math.max(20, 40 * z);
    c.textAlign = 'center';
    c.font = `${Math.max(11, 12 * Math.min(1, z + 0.2))}px ${MONO}`; c.fillStyle = skyRgba(col, 0.95);
    if (c.letterSpacing !== undefined) c.letterSpacing = '1.6px';
    c.fillText(`${sp.id === '__essentials' ? 'ALWAYS HERE' : `SPACE ${String(i + 1).padStart(2, '0')}`}  ·  ${n} TAB${n === 1 ? '' : 'S'}${sp.id === S.activeWs ? '  ·  CURRENT' : ''}`, x, ty);
    if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
    c.font = `${Math.round(clamp(34 * z, 20, 40))}px ${SERIF}`; c.fillStyle = SKY_C.tx;
    c.fillText((ws && ws.name) || 'Space', x, ty + Math.max(26, 38 * z));
  }
  // constellations: lines only between tabs that belong together, the constellation's name, the stars
  const labels = z >= 0.55;
  for (const g of SKY.lay.groups) {
    const pts = g.stars.map((s) => skyToScreen(s.x, s.y));
    if (pts.every(([x, y]) => x < -150 || x > w + 150 || y < -100 || y > h + 100)) continue;
    const dimG = SKY.words.length && !g.stars.some((s) => { const t = tabById(s.id); return t && skyMatch(t); });
    c.globalAlpha = dimG ? 0.25 : 1;
    c.strokeStyle = 'rgba(241,238,232,.42)'; c.lineWidth = 1.1; c.setLineDash([2, 5]); c.lineCap = 'round';
    g.stars.forEach((s, k) => { if (s.parent < 0) return; const a = pts[s.parent], b = pts[k]; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); });
    c.setLineDash([]);
    if (z >= 0.3) {
      const top = Math.min(...pts.map((p, k) => p[1] - (g.stars[k].up ? 30 : 0))), mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
      c.font = `italic ${Math.round(clamp(19 * z, 13, 22))}px ${SERIF}`; c.fillStyle = 'rgba(241,238,232,.86)'; c.textAlign = 'center';
      c.fillText(g.name, mx, top - Math.max(22, 34 * z));
    }
    g.stars.forEach((s, k) => { const t = tabById(s.id); if (t) skyPaintTab(c, t, pts[k][0], pts[k][1], now, { labels, up: s.up, dim: dimG }); });
    c.globalAlpha = 1;
  }
  skyOverlays(c, w, h);
}

function galaxyDraw(now) {
  const c = SKY.ctx; if (!c || !SKY.gal) return;
  const { w, h, dpr } = SKY, z = SKY.cam.z, T = SKY.turn;
  const MONO = 'ui-monospace,Consolas,"DejaVu Sans Mono",monospace', SERIF = 'Georgia,"Times New Roman",serif';
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const P = (r, th) => skyToScreen(Math.cos(th + T) * r, Math.sin(th + T) * r * GAL.TILT);
  const [cx, cy] = skyToScreen(0, 0);
  // time rings: 1 hour, 1 day, 1 week
  for (const [label, r] of SKY.gal.rings) {
    c.strokeStyle = 'rgba(241,238,232,.10)'; c.lineWidth = 1; c.setLineDash([2, 8]);
    c.beginPath(); c.ellipse(cx, cy, r * z, r * z * GAL.TILT, 0, 0, 7); c.stroke(); c.setLineDash([]);
    c.font = `12px ${MONO}`; c.fillStyle = 'rgba(170,168,165,.75)'; c.textAlign = 'left';
    if (c.letterSpacing !== undefined) c.letterSpacing = '1.4px';
    c.fillText(label, cx + r * z + 8, cy + 4); // on the right-hand edge of its ring
    if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
  }
  // the arms: a soft band and a thin line in the Space's colour, star dust, its name at the far end
  SKY.gal.arms.forEach((arm, i) => {
    const col = skySpaceColor(arm.ws);
    const hot = SKY.drag && SKY.drag.moved && SKY.drag.over === arm.ws && SKY.drag.ws !== arm.ws;
    for (let pass = 0; pass < 2; pass++) {
      c.beginPath();
      for (let r = GAL.R0; r <= arm.end; r += 6) { const [x, y] = P(r, galTh(r, arm.off)); if (r === GAL.R0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.strokeStyle = skyRgba(col, pass ? (hot ? 0.7 : 0.32) : (hot ? 0.18 : 0.075)); c.lineWidth = pass ? (hot ? 2 : 1.2) : 34 * z; c.lineCap = 'round'; c.stroke();
    }
    for (const [r, dth, sz, a, warm] of arm.dust) {
      const [x, y] = P(r, galTh(r, arm.off) + dth);
      if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
      c.fillStyle = warm ? `rgba(255,231,196,${a})` : `rgba(232,238,255,${a})`; c.beginPath(); c.arc(x, y, sz * Math.min(1.4, z + 0.3), 0, 7); c.fill();
    }
    const [nx, ny] = P(arm.end + 70, galTh(arm.end, arm.off));
    const ws = skyWs(arm.ws), n = S.tabs.filter((t) => !t.essential && t.ws === arm.ws).length;
    c.textAlign = 'center';
    c.font = `${Math.max(11, Math.round(12 * Math.min(1, z + 0.3)))}px ${MONO}`; c.fillStyle = skyRgba(col, 0.95);
    if (c.letterSpacing !== undefined) c.letterSpacing = '1.6px';
    c.fillText(`SPACE ${String(i + 1).padStart(2, '0')}  ·  ${n} TAB${n === 1 ? '' : 'S'}${arm.ws === S.activeWs ? '  ·  CURRENT' : ''}`, nx, ny - Math.max(22, 30 * z));
    if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
    c.font = `${Math.round(clamp(30 * z, 18, 36))}px ${SERIF}`; c.fillStyle = SKY_C.tx;
    c.fillText((ws && ws.name) || 'Space', nx, ny);
  });
  // the core: now
  const coreR = 130 * z;
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  g.addColorStop(0, 'rgba(255,246,232,.5)'); g.addColorStop(0.3, 'rgba(231,223,209,.16)'); g.addColorStop(1, 'rgba(7,8,11,0)');
  c.save(); c.translate(cx, cy); c.scale(1, GAL.TILT); c.translate(-cx, -cy); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, coreR, 0, 7); c.fill(); c.restore();
  c.textAlign = 'center'; c.fillStyle = SKY_C.tx; c.font = `${Math.round(clamp(24 * z, 16, 28))}px ${SERIF}`; c.fillText('音', cx, cy + 8 * Math.min(1, z));
  c.font = `12px ${MONO}`; c.fillStyle = SKY_C.tx2;
  if (c.letterSpacing !== undefined) c.letterSpacing = '2px';
  c.fillText('NOW', cx, cy + 28 * Math.min(1, z) + 4);
  if (essentials().length) { c.fillStyle = 'rgba(231,223,209,.85)'; c.fillText('ESSENTIALS', cx, cy - GAL.CORE * z * GAL.TILT - 18); }
  if (c.letterSpacing !== undefined) c.letterSpacing = '0px';
  // the tabs. Names go under their star; one that would run into a name already placed goes above it, and if that's
  // taken too it waits until you zoom in or point at it (the tab you're on, and the one you point at, always get one).
  const labels = z >= 0.45;
  const act = activeTab();
  const boxes = [];
  const free = (bx, by) => !boxes.some((b) => Math.abs(b[0] - bx) < 160 && Math.abs(b[1] - by) < 22);
  const list = [...SKY.starById.values()].map((s) => { const [x, y] = skyToScreen(s.x, s.y); return { s, x, y }; })
    .filter(({ x, y }) => x > -120 && x < w + 120 && y > -60 && y < h + 60);
  const strongFirst = (a) => (act && a.s.id === act.id) || SKY.hover === a.s.id || SKY.sel === a.s.id ? 0 : 1;
  list.sort((a, b) => strongFirst(a) - strongFirst(b) || a.s.r - b.s.r);
  for (const { s, x, y } of list) {
    const t = tabById(s.id); if (!t) continue;
    let up = false, show = labels && s.ws !== '__essentials';
    const strong = strongFirst({ s }) === 0;
    if (show || strong) {
      if (free(x, y + 26)) boxes.push([x, y + 26]);
      else if (free(x, y - 26)) { up = true; boxes.push([x, y - 26]); }
      else if (!strong) show = false;
    }
    skyPaintTab(c, t, x, y, now, { labels: show, up, maxW: 160 });
  }
  skyOverlays(c, w, h);
}

/** One tab's star: active (cyan ring + dot), selected (dashed ring), hovered, pinned (◇), asleep (hollow circle). */
function skyPaintTab(c, t, x, y, now, { labels = true, up = false, dim = false, maxW = 190 } = {}) {
  const SANS = '"Inter","Segoe UI",system-ui,sans-serif';
  const act = activeTab();
  const on = !!(act && act.id === t.id), hov = SKY.hover === t.id, sel = SKY.sel === t.id;
  const v = V.get(t.id), asleep = !v || v.frozen;
  c.globalAlpha = (dim || !skyMatch(t)) ? 0.25 : 1;
  if (SKY.drag && SKY.drag.id === t.id && SKY.drag.moved) c.globalAlpha = 0.25;
  const twk = skyMotion() ? 0.86 + 0.14 * Math.sin(now / 650 + (skyHash(t.id) % 100)) : 1;
  if (asleep && !on) { // asleep (not loaded): a hollow circle, so it's told apart by shape, not colour
    c.strokeStyle = 'rgba(232,238,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 3.8, 0, 7); c.stroke();
  } else skyStar(c, x, y, on ? 3.6 : hov || sel ? 3.2 : 2.5, (on || hov || sel ? 1 : 0.82) * twk, on);
  if (on) { c.strokeStyle = SKY_C.hi; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 15, 0, 7); c.stroke(); c.fillStyle = SKY_C.hi; c.beginPath(); c.arc(x + 11, y - 11, 3, 0, 7); c.fill(); }
  if (sel && !on) { c.strokeStyle = SKY_C.tx; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y, 15, 0, 7); c.stroke(); c.setLineDash([]); }
  else if (hov && !on) { c.strokeStyle = 'rgba(241,238,232,.55)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 15, 0, 7); c.stroke(); }
  if (t.pinned) { const q = 4, dx = x + 13, dy = y - 13; c.strokeStyle = SKY_C.tx; c.lineWidth = 1.3; c.beginPath(); c.moveTo(dx, dy - q); c.lineTo(dx + q, dy); c.lineTo(dx, dy + q); c.lineTo(dx - q, dy); c.closePath(); c.stroke(); }
  if (labels || on || hov || sel) {
    const strong = on || hov || sel;
    c.font = `${strong ? '600 ' : ''}${strong ? 15 : 13}px ${SANS}`; c.textAlign = 'center';
    c.fillStyle = strong ? SKY_C.tx : asleep ? 'rgba(241,238,232,.58)' : 'rgba(241,238,232,.85)';
    c.fillText(skyEll(c, t.title || prettyUrl(t.url), maxW), x, up ? y - 22 : y + 30);
  }
  c.globalAlpha = 1;
}

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
      c.strokeStyle = `rgba(168,231,243,${1 - p})`; c.lineWidth = 1.6;
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.beginPath(); c.moveTo(sx * rr, sy * (rr - tk)); c.lineTo(sx * rr, sy * rr); c.lineTo(sx * (rr - tk), sy * rr); c.stroke(); }
      c.restore();
      if (lk >= 1 && p < 0.5) { c.font = `600 12px ${MONO}`; c.textAlign = 'center'; c.fillStyle = `rgba(168,231,243,${1 - p * 2})`; c.fillText('OPENING', x, y + 48); }
      const rad = Math.max(w, h) * (0.08 + 1.1 * p);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(255,246,232,${0.25 + 0.6 * p})`); g.addColorStop(0.45, `rgba(241,238,232,${0.35 * p})`); g.addColorStop(1, 'rgba(7,8,11,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
  }
  // a star being dragged
  if (SKY.drag && SKY.drag.moved) {
    const t = tabById(SKY.drag.id);
    skyStar(c, SKY.drag.mx, SKY.drag.my, 3.4, 1, false);
    c.strokeStyle = SKY_C.hi; c.lineWidth = 1.2; c.setLineDash([3, 3]); c.beginPath(); c.arc(SKY.drag.mx, SKY.drag.my, 15, 0, 7); c.stroke(); c.setLineDash([]);
    const to = SKY.drag.over && SKY.drag.over !== SKY.drag.ws ? skyWs(SKY.drag.over) : null;
    c.font = `600 13px ${SANS}`; c.textAlign = 'center'; c.fillStyle = to ? SKY_C.hi : SKY_C.tx;
    c.fillText(to ? (to.ess ? 'Add to Essentials' : `Move to ${to.name}`) : skyEll(c, (t && t.title) || '', 190), SKY.drag.mx, SKY.drag.my + 32);
  }
}

function skyStar(c, x, y, s, a, warm) {
  c.globalAlpha *= 1; const keep = c.globalAlpha;
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
function skyStarAt(x, y) {
  let best = null, bd = 18;
  for (const s of SKY.starById.values()) { const [sx, sy] = skyToScreen(s.x, s.y); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = s; } }
  return best;
}
function skySpaceAt(x, y) {
  if (SKY.mode === 'galaxy') return galaxyArmAt(x, y);
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
/** Open a tab: the view flies to its star, locks on and dives in until its light fills the screen, then the tab opens
 *  and Sky View fades away (with reduce-motion: straight away). */
function skyOpen(id) {
  const t = tabById(id); if (!t) return;
  const s = SKY.starById.get(id);
  if (!skyMotion() || !s || !SKY.layer || SKY.dive) { v1CloseOverview(); skyOpenNow(t); return; }
  skyHideCard();
  if (SKY.help) { SKY.help.remove(); SKY.help = null; }
  const from = { ...SKY.cam }, t0 = performance.now(), layer = SKY.layer;
  const z1 = Math.max(from.z, 1);
  SKY.dive = { id, t0, p: 0 };
  SKY.glide = (now) => {
    const e = now - t0;
    if (e < 220) { // fly to it
      const p = e / 220, k = 1 - Math.pow(1 - p, 3);
      SKY.cam.x = from.x + (s.x - from.x) * k; SKY.cam.y = from.y + (s.y - from.y) * k; SKY.cam.z = from.z + (z1 - from.z) * k;
      SKY.dive.lock = p; SKY.dive.p = 0;
    } else { // dive in
      const p = Math.min(1, (e - 220) / 420), k = p * p * p;
      SKY.cam.x = s.x; SKY.cam.y = s.y; SKY.cam.z = z1 + (7 - z1) * k;
      SKY.dive.lock = 1; SKY.dive.p = p;
      if (p >= 1) {
        SKY.glide = null;
        skyOpenNow(t);
        layer.style.transition = 'opacity .18s ease'; layer.style.opacity = '0';
        setTimeout(() => { SKY.dive = null; if (layer.isConnected) v1CloseOverview(); }, 190);
      }
    }
  };
  skyKick();
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
  if (S.sky) { delete S.sky.offsets[id]; delete S.sky.slots[id]; }
  save(); render(); skyRelayout(); skyDraw();
}
function skyClose(id) {
  skyHideCard();
  closeTab(id);
  setTimeout(() => { if (SKY.on) { skyRelayout(); skyDraw(); } }, 420);
}

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
  const card = h('div', { class: 'sky-card', 'data-id': id, role: 'dialog', 'aria-label': `Preview: ${t.title || prettyUrl(t.url)}` },
    h('div', { class: 'hd' }, favEl(t, null, true),
      h('div', { class: 'tt' }, h('b', {}, t.title || prettyUrl(t.url)), h('small', {}, hostOf(t.url) || prettyUrl(t.url))),
      h('span', { class: `st ${status.toLowerCase()}` }, status),
      h('button', { class: 'x', title: 'Close tab', 'aria-label': 'Close tab', onclick: (e) => { e.stopPropagation(); skyClose(id); }, html: icon('x') })),
    img,
    h('div', { class: 'meta' }, h('span', {}, `${(ws && ws.name) || ''} · ${s.g.name}`), h('span', { class: 'age' }, '')),
    h('div', { class: 'acts' },
      h('button', { class: 'b pri', onclick: (e) => { e.stopPropagation(); skyOpen(id); } }, 'Open'),
      t.essential ? null : h('button', { class: 'b', onclick: (e) => { e.stopPropagation(); togglePin(id); skyShowCardRefresh(id); } }, t.pinned ? 'Unpin' : 'Pin'),
      moveBtn));
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
function skyPlaceCard() {
  const card = SKY.card; if (!card) return;
  const s = SKY.starById.get(card.dataset.id); if (!s) return;
  const [x, y] = skyToScreen(s.x, s.y);
  const cw = 300, chh = card.offsetHeight || 250;
  let left = x + 40, top = y - chh + 40;
  if (left + cw > SKY.w - 12) left = x - cw - 40;
  top = clamp(top, 70, SKY.h - chh - 70);
  card.style.left = `${left}px`; card.style.top = `${top}px`;
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
  showMenu(x, y, [
    { label: 'Open', icon: 'tab', run: () => skyOpen(t.id) },
    t.essential ? null : { label: t.pinned ? 'Unpin' : 'Pin', icon: 'pin', run: () => { togglePin(t.id); skyDraw(); } },
    '-',
    { header: 'Move to Space' },
    ...S.workspaces.filter((w) => t.essential || w.id !== t.ws).map((w) => ({ label: w.name, icon: 'layers', run: () => skyMove(t.id, w.id) })),
    { label: 'Put its star back in place', icon: 'reload', run: () => { if (S.sky) delete S.sky.offsets[t.id]; skyRelayout(); skyDraw(); } },
    '-',
    { label: 'Close tab', icon: 'trash', danger: true, run: () => skyClose(t.id) },
  ]);
}

// ------------------------------------------------------------------ mounting into the space overview
function skyMount(layer, search, mode = 'sky') {
  SKY.mode = mode === 'galaxy' ? 'galaxy' : 'sky'; SKY.turn = SKY.turn || 0; SKY.lastT = 0;
  if (!S.sky) S.sky = { cells: {}, groups: {}, slots: {}, offsets: {}, cam: null, gcam: null, v: 1 };
  SKY.on = true; SKY.layer = layer; SKY.hover = null; SKY.sel = null; SKY.drag = null; SKY.pan = null;
  SKY.query = search.value.trim(); SKY.words = typeof words === 'function' ? words(SKY.query) : SKY.query.toLowerCase().split(/\s+/).filter(Boolean);
  document.body.classList.add('v1-sky-open');
  const box = h('div', { class: 'sky-box' });
  box.innerHTML = typeof galaxyBg === 'function' ? galaxyBg({ w: 1600, h: 1000, stars: 360, band: false }) : '';
  const canvas = h('canvas', { class: 'sky-canvas', tabindex: '0', 'aria-label': SKY.mode === 'galaxy'
    ? 'Galaxy view: your tabs as stars on spiral arms, one arm per Space; the middle is now, further out is longer ago. Use the search box, or arrow keys to move between tabs and Enter to open one.'
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
    if (e.button !== 0) return;
    canvas.focus({ preventScroll: true });
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const s = skyStarAt(x, y);
    if (s) { const t = tabById(s.id); SKY.drag = { id: s.id, ws: t && t.essential ? '__essentials' : t && t.ws, x0: x, y0: y, mx: x, my: y, moved: false, over: null }; skyHideCard(); }
    else SKY.pan = { x0: x, y0: y, cx: SKY.cam.x, cy: SKY.cam.y, moved: false };
  });
  SKY.onMove = (e) => {
    if (!SKY.on) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (SKY.pan) {
      if (Math.hypot(x - SKY.pan.x0, y - SKY.pan.y0) > 3) SKY.pan.moved = true;
      SKY.cam.x = SKY.pan.cx - (x - SKY.pan.x0) / SKY.cam.z; SKY.cam.y = SKY.pan.cy - (y - SKY.pan.y0) / SKY.cam.z;
      skyHideCard(); skyDraw(); return;
    }
    if (SKY.drag) {
      if (Math.hypot(x - SKY.drag.x0, y - SKY.drag.y0) > 5) SKY.drag.moved = true;
      SKY.drag.mx = x; SKY.drag.my = y; SKY.drag.over = skySpaceAt(x, y);
      canvas.style.cursor = 'grabbing'; skyDraw(); return;
    }
    if (e.target !== canvas) return;
    const s = skyStarAt(x, y);
    const id = s ? s.id : null;
    canvas.style.cursor = s ? 'pointer' : 'grab';
    if (id !== SKY.hover) {
      SKY.hover = id; skyDraw();
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
    if (SKY.drag) {
      const d = SKY.drag; SKY.drag = null; canvas.style.cursor = '';
      if (!d.moved) { if (e.button === 0) skyOpen(d.id); return; }
      if (d.over && d.over !== d.ws) skyMove(d.id, d.over);
      else if (d.over === d.ws && SKY.mode !== 'galaxy') {
        // dropped inside its own Space: its star stays where you put it (saved)
        const s = SKY.starById.get(d.id);
        if (s && S.sky) {
          const [wx, wy] = skyToWorld(d.mx, d.my);
          const o = S.sky.offsets[d.id] || [0, 0];
          S.sky.offsets[d.id] = [Math.round(o[0] + wx - s.x), Math.round(o[1] + wy - s.y)];
          save(); skyRelayout();
        }
      }
      skyDraw();
    }
  };
  addEventListener('mousemove', SKY.onMove);
  addEventListener('mouseup', SKY.onUp);
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = canvas.getBoundingClientRect(); const s = skyStarAt(e.clientX - r.left, e.clientY - r.top);
    const t = s && tabById(s.id); if (t) skyStarMenu(t, e.clientX, e.clientY);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const [wx, wy] = skyToWorld(x, y);
    const z = clamp(SKY.cam.z * Math.exp(-e.deltaY * 0.0015), 0.25, 2.5);
    SKY.cam.z = z;
    SKY.cam.x = wx - (x - SKY.w / 2) / z; SKY.cam.y = wy - (y - SKY.h / 2) / z;
    skyHideCard(); skyDraw(); skySaveCamSoon(); skyUpdateZoom();
  }, { passive: false });
  canvas.addEventListener('mouseleave', () => { if (SKY.hover) { SKY.hover = null; skyDraw(); skyHideCardSoon(); } });
  canvas.addEventListener('keydown', (e) => skyKey(e));

  // corner controls: zoom, back to the tab you're on, reset layout, help
  const zoomTxt = h('span', { class: 'zt' }, '100%');
  SKY.zoomTxt = zoomTxt;
  const ctl = h('div', { class: 'sky-ctl' },
    h('button', { title: 'Zoom out', 'aria-label': 'Zoom out', onclick: () => skyZoomBy(1 / 1.25) }, '−'),
    zoomTxt,
    h('button', { title: 'Zoom in', 'aria-label': 'Zoom in', onclick: () => skyZoomBy(1.25) }, '+'),
    h('button', { title: 'Show everything', 'aria-label': 'Show everything', onclick: () => skyGlideTo(skyFitAll()), html: icon('grid') }),
    h('button', { title: 'Back to the tab you’re on', 'aria-label': 'Back to the tab you’re on', onclick: () => { const a = activeTab(); if (a) skyFocusStar(a.id, 1); } }, '◎'),
    SKY.mode === 'galaxy' ? null : h('button', { title: 'Reset layout', 'aria-label': 'Reset layout', onclick: () => skyResetLayout() }, '⟲'),
    h('button', { class: 'q', title: 'How to use Sky View', 'aria-label': 'How to use Sky View', onclick: () => skyHelp(true) }, '?'));
  layer.append(ctl);
  skyUpdateZoom();
  skyHelp(false);
  if (skyMotion()) { const to = { ...SKY.cam }; SKY.cam.z = to.z * 0.82; skyGlideTo(to, 380); }
  skyKick();
}

function skyUpdateZoom() { if (SKY.zoomTxt) SKY.zoomTxt.textContent = `${Math.round(SKY.cam.z * 100)}%`; }
function skyZoomBy(f) { skyGlideTo({ x: SKY.cam.x, y: SKY.cam.y, z: clamp(SKY.cam.z * f, 0.25, 2.5) }, 200); setTimeout(() => { skyUpdateZoom(); skySaveCam(); }, 220); }
function skySaveCam() { if (S.sky) { S.sky[SKY.mode === 'galaxy' ? 'gcam' : 'cam'] = { x: Math.round(SKY.cam.x), y: Math.round(SKY.cam.y), z: +SKY.cam.z.toFixed(3) }; save(); } }
function skySaveCamSoon() { clearTimeout(SKY.camT); SKY.camT = setTimeout(skySaveCam, 400); }
function skyResetLayout() {
  S.sky = { cells: {}, groups: {}, slots: {}, offsets: {}, cam: null, v: 1 };
  skyRelayout(); skyGlideTo(skyFitAll()); toast('Layout reset', { icon: 'reload', timeout: 1400 });
}

/** The controls, shown the first few times (then only behind the ? button). */
function skyHelp(force) {
  if (SKY.help) { SKY.help.remove(); SKY.help = null; if (force) return; }
  const key = SKY.mode === 'galaxy' ? 'galaxyHelpSeen' : 'skyHelpSeen';
  const seen = S.settings[key] || 0;
  if (!force && seen >= 3) return;
  if (!force) { S.settings[key] = seen + 1; save(); }
  const tips = SKY.mode === 'galaxy'
    ? [['The middle', 'is now'], ['Further out', 'longer ago'], ['Each arm', 'is a Space'], ['Hover', 'preview'], ['Drag a star', 'to another arm']]
    : [['Scroll', 'zoom'], ['Drag', 'pan'], ['Hover', 'preview'], ['Right-click', 'options'], ['Drag a star', 'move it to another Space']];
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

