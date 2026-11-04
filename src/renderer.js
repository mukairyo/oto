'use strict';
/* Oto — browser UI */

// ================================================================ helpers
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const ICONS = {
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  fwd: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  reload: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  shield: '<path d="M12 21.5s7.5-3.6 7.5-9.5V5.5L12 2.8 4.5 5.5V12c0 5.9 7.5 9.5 7.5 9.5z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  pin: '<path d="M12 17v4.5M8.5 3.5h7l-1 5.5 3 3.5v1.5h-11v-1.5l3-3.5z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tab: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h8"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="m11.3 11.7 8.2-8.2M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 6.1c.5-.1.9-.1 1.4-.1 6 0 9.5 6 9.5 6a17 17 0 0 1-2.9 3.6M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2.5h6.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
  card: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M5 11c3-2 11-2 14 0"/><path d="M8.5 15h7M8.5 18h4"/>',
  shuffle: '<path d="M3 7h3.5c4 0 6 10 11 10H21M3 17h3.5c1.6 0 2.8-1.6 3.9-3.6M14 8.3C15 7.4 16 7 17.5 7H21"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/>',
  library: '<path d="M4 4v16M8.5 4v16"/><rect x="12" y="4" width="4" height="16" rx="1"/><path d="m18 5.2 2.8.8-3.8 14-2.6-.8"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 4v16"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  pip: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="12" y="11" width="7" height="6" rx="1.2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  vol: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.5 9.5 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  sleep: '<path d="M4 6h6l-6 7h6M14 12h5l-5 6h5"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
  move: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4"/>',
  find: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5M8.5 11h5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.6-1.4-.6-2.2 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.9 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  offline: '<path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M5 12.5a10 10 0 0 1 4.5-2.2M19 12.5a10 10 0 0 0-2-1.4M8.5 16a5 5 0 0 1 6.6-.6M12 20h.01M3 3l18 18"/>',
};
const icon = (n) =>
  `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
const iconEl = (n) => h('span', { class: 'ic-slot', html: icon(n) });
// The little arrow next to the space name — its look is a setting.
const SPACE_ARROWS = {
  chevron: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  triangle: '<svg class="i" viewBox="0 0 24 24"><path d="M6.5 9h11l-5.5 6.5z" fill="currentColor"/></svg>',
  arrow: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  plus: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
  dots: '<svg class="i" viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>',
  spark: '<svg class="i" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/></svg>',
  none: '',
};
function applySpaceArrow() {
  const el = document.querySelector('#wsTitle .ws-chev');
  if (!el) return;
  const k = S && S.settings.spaceArrow in SPACE_ARROWS ? S.settings.spaceArrow : 'chevron';
  el.innerHTML = SPACE_ARROWS[k];
  el.hidden = k === 'none';
  el.dataset.style = k;
  el.style.color = S && S.settings.spaceArrowColor === 'accent' ? 'var(--accent)' : '';
}

let logoSeq = 0;
function logoSvg() {
  if (S && typeof iconSvg === 'function') return iconSvg(S.settings.appIcon);
  return logoSvgClassic();
}
// Oto's mark: a glowing ring with an infinity inside (the two o's of "Oto").
// c = three stroke-gradient colours, bg = [centre, edge] of the rounded-square background.
function otoMarkSvg(c = ['#a855f7', '#6366f1', '#22d3ee'], bg = ['#1c1833', '#08080e'], glow = true) {
  const n = ++logoSeq;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="og${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
    <radialGradient id="ob${n}" cx=".5" cy=".45" r=".72"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient>
    <filter id="of${n}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs><rect width="64" height="64" rx="15" fill="url(#ob${n})"/>
    <g fill="none" stroke="url(#og${n})" stroke-linecap="round"${glow ? ` filter="url(#of${n})"` : ''}>
      <path d="M44.5 15.2 A21 21 0 1 0 49.6 21.3" stroke-width="3.4"/>
      <g transform="translate(32 32) scale(.84) translate(-32 -32)">
        <path d="M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z" stroke-width="4"/>
      </g></g></svg>`;
}
function logoSvgClassic() { return otoMarkSvg(); }

function hexToRgb(hex) {
  let m = String(hex).replace('#', '');
  if (m.length === 3) m = m.split('').map((c) => c + c).join('');
  const n = parseInt(m, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `#${A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join('')}`;
}
function letterColor(s) {
  let n = 0;
  for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${n % 360} 55% 52%)`;
}

function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function prettyUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol === 'http:' || x.protocol === 'https:') return x.hostname.replace(/^www\./, '') + (x.pathname === '/' ? '' : x.pathname);
    return u;
  } catch { return u || ''; }
}

// ================================================================ config
const PALETTE = ['#8b7cf6', '#f472b6', '#fb923c', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#94a3b8'];
const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=%s' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s' },
};
const DEFAULT_SETTINGS = {
  theme: 'system', engine: 'duckduckgo', suggestions: true, blockTrackers: true, compact: false, sidebarWidth: 256,
  sidebarSide: 'left', pageStyle: 'floating', urlDisplay: 'path', startup: 'continue', downloadsAsk: false,
  archiveAfter: 'never', unloadAfter: 'never', newTabPos: 'top', tabCycle: 'order',
  gpc: true, clearOnExit: false, appIcon: 'classic',
  // performance
  freezeAfter: '5m', hwAccel: true, smoothScroll: true, reduceMotion: false,
  // look & layout
  uiFont: 'segoe-variable', uiScale: 1, tabDensity: 'default', radius: 12, pageGap: 8, urlAlign: 'center',
  showNav: true, showReload: true, showCopy: true, showShield: true,
  // new tab page
  clockFormat: 'auto', showClock: true, showGreeting: true, userName: '', showHints: true,
  // search shortcuts ("yt cats" searches YouTube)
  searchShortcuts: [
    { key: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
    { key: 'w', name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=%s' },
    { key: 'gh', name: 'GitHub', url: 'https://github.com/search?q=%s' },
    { key: 'r', name: 'Reddit', url: 'https://www.reddit.com/search/?q=%s' },
    { key: 'maps', name: 'Maps', url: 'https://www.openstreetmap.org/search?query=%s' },
  ],
  keymap: {}, mods: {}, userCss: '',
  // layout & motion
  toolbarLayout: 'single', autohideTop: false, showBookmarks: true, animations: 'smooth',
  animCurve: [0.2, 0.8, 0.2, 1], animDuration: 280, // custom animation curve (cubic-bezier) and speed
  // sidebar behaviour
  railWidth: 52, snapRail: 150, snapHide: 26, hoverDelay: 110, closeDelay: 260, stayOpen: false,
  navWhenCollapsed: 'sidebar', // keep the Zen layout when the sidebar is collapsed/hidden ('top' moves navigation up)
  collapsed: true, // Zen-style dynamic sidebar: icons only, slides open on hover
};
const ZOOMS = [0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

function defaultState() {
  const ws = { id: uid(), name: 'Home', emoji: '', color: '#a78bfa', colors: ['#a78bfa', '#f0abfc'], intensity: 0.75, grain: 0 };
  const ess = (url, title) => ({ id: uid(), url, title, favicon: '', ws: ws.id, pinned: false, essential: true });
  return {
    v: 8,
    settings: { ...DEFAULT_SETTINGS, unloadAfter: '1h' },
    workspaces: [ws],
    activeWs: ws.id,
    tabs: [
      ess('https://www.youtube.com/', 'YouTube'),
      ess('https://github.com/', 'GitHub'),
      ess('https://en.wikipedia.org/', 'Wikipedia'),
    ],
    active: {},
    history: [],
    archive: [],
    boosts: [],
    bookmarks: [],
    onboarded: false,
  };
}

function migrate(s) {
  if (!s || !Array.isArray(s.workspaces) || !s.workspaces.length) return defaultState();
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  if (!ENGINES[s.settings.engine] && !String(s.settings.engine).startsWith('sc:')) s.settings.engine = 'duckduckgo';
  if ((s.v || 1) < 2) {
    if (s.settings.unloadAfter === 'never') s.settings.unloadAfter = '1h';
    s.v = 2;
  }
  if (s.v < 3) { s.settings.toolbarLayout = 'single'; s.v = 3; }
  if (s.v < 4) {
    for (const w of s.workspaces) if (w.intensity <= 0.5) w.intensity = 0.75; // Zen-strength colours
    s.settings.collapsed = true;
    s.v = 4;
  }
  // 0.9.1: the Low memory preset no longer switches animations off (they cost almost nothing).
  if (s.v < 5) {
    if (s.settings.reduceMotion && s.settings.unloadAfter === '15m' && s.settings.freezeAfter === '1m') s.settings.reduceMotion = false;
    s.v = 5;
  }
  // 0.9.6: Alt + click Glance is off by default — clicks are normal clicks (it can be turned back on in Settings).
  if (s.v < 6) { s.settings.glanceMode = 'off'; delete s.settings.glanceAlt; s.v = 6; }
  // 0.9.7: "every link" Glance made each video click open a Glance — switch it to "links to other sites".
  if (s.v < 7) { if (s.settings.glanceMode === 'click') s.settings.glanceMode = 'external'; s.v = 7; }
  // 0.9.8: no space switcher at the bottom and no "New space" in the space menu (both can be turned back on).
  if (s.v < 8) { s.settings.showSpaceSwitcher = false; s.settings.spaceMenuNew = false; s.v = 8; }
  s.tabs = Array.isArray(s.tabs) ? s.tabs.filter((t) => t && t.id && t.url) : [];
  const wsIds = new Set(s.workspaces.map((w) => w.id));
  for (const t of s.tabs) if (!wsIds.has(t.ws)) t.ws = s.workspaces[0].id;
  if (!wsIds.has(s.activeWs)) s.activeWs = s.workspaces[0].id;
  s.active = s.active && typeof s.active === 'object' ? s.active : {};
  s.history = Array.isArray(s.history) ? s.history.slice(0, 3000) : [];
  for (const w of s.workspaces) {
    if (!Array.isArray(w.colors) || !w.colors.length) w.colors = [w.color || PALETTE[0]];
    w.color = w.colors[0];
    if (typeof w.intensity !== 'number') w.intensity = 0.5;
    if (typeof w.grain !== 'number') w.grain = 0;
  }
  s.onboarded = !!s.onboarded;
  s.archive = Array.isArray(s.archive) ? s.archive : [];
  s.boosts = Array.isArray(s.boosts) ? s.boosts : [];
  s.bookmarks = Array.isArray(s.bookmarks) ? s.bookmarks : [];
  const now = Date.now();
  for (const t of s.tabs) if (!t.lastActive) t.lastActive = now;
  return s;
}

// ================================================================ state
let S;                       // persisted state
let INFO = {};
const V = new Map();         // tabId -> runtime view { wv, loading, blocked, ... }
const wcToTab = new Map();   // webContentsId -> tabId
const earlyBlocked = new Map();
const closedStack = [];

const currentWs = () => S.workspaces.find((w) => w.id === S.activeWs) || S.workspaces[0];
const tabById = (id) => S.tabs.find((t) => t.id === id);
const activeTab = () => tabById(S.active[S.activeWs]);
const activeView = () => { const t = activeTab(); return t ? V.get(t.id) : null; };
const essentials = () => S.tabs.filter((t) => t.essential);
const wsTabs = (wsId = S.activeWs) => S.tabs.filter((t) => !t.essential && t.ws === wsId);
const navOrder = () => [...essentials(), ...wsTabs().filter((t) => t.pinned), ...wsTabs().filter((t) => !t.pinned)];

function persistable() {
  return {
    ...S,
    tabs: S.tabs.map(({ id, url, title, favicon, ws, pinned, essential, lastActive }) =>
      ({ id, url, title, favicon, ws, pinned, essential, lastActive })),
  };
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => oto.saveState(persistable()), 400);
}
window.addEventListener('beforeunload', () => { clearTimeout(saveTimer); oto.saveStateSync(persistable()); });

function wv(v, fn, fallback) { try { return fn(v.wv); } catch { return fallback; } }
function focusView(v) { if (v && v.wv && v.wv.isConnected) wv(v, (w) => w.focus()); }

// ================================================================ theme
const mq = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => S.settings.theme === 'dark' || (S.settings.theme === 'system' && mq.matches);

let themePreview = null;     // set while the colour picker is open
let themeNow = null;
function applyTheme() {
  const dark = isDark();
  const theme = themePreview || themeOf(currentWs());
  const b = buildBackground(theme, dark);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  // Sidebar + top strip text adapts to the gradient itself (white on vivid/dark colours).
  root.dataset.chrome = luminance(b.bg) < 0.36 ? 'dark' : 'light';
  root.style.setProperty('--bg', b.bg);
  root.style.setProperty('--bg-image', b.image);
  root.style.setProperty('--bg-size', b.size);
  root.style.setProperty('--accent', b.accent);
  root.style.setProperty('--accent-soft', mix(dark ? '#1f1f24' : '#fdfdff', b.accent, dark ? 0.28 : 0.15));
  themeNow = { stops: b.stops, dark, grain: theme.grain || 0 };
  updateOverlay();
  if (S.settings.appIcon === 'space' && typeof applyAppIcon === 'function') applyAppIcon();
}
function updateOverlay() {
  return; // Oto draws its own window buttons now — nothing to colour-match.
  // eslint-disable-next-line no-unreachable
  if (!themeNow) return;
  // Windows' caption buttons sit top-right; match the gradient colour there.
  let c = colorAtPoint(themeNow.stops, innerWidth - 70, 22);
  // The grain texture is mid-grey noise on top of the gradient; blend it in so the
  // caption-button strip matches the rest of the top bar.
  if (themeNow.grain) c = mix(c, '#808080', themeNow.grain * 0.2);
  const symbol = themeNow.dark ? '#e9e9ee' : '#25252b';
  const height = topbarHeight();
  oto.setOverlay(c, symbol, height);   // instant best guess…
  clearTimeout(sampleTimer);
  sampleTimer = setTimeout(() => sampleOverlay(symbol, height), 220); // …then match the real pixels
}
let sampleTimer;
const topbarHeight = () => 44;
async function sampleOverlay(symbol, height) {
  const url = await oto.captureStrip(height);
  if (!url) return;
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { return; }
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data; // always RGBA
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  if (!n) return;
  const hex = `#${[r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('')}`;
  oto.setOverlay(hex, symbol, height);
  window.__otoOverlay = hex;
}
let overlayTimer;
window.addEventListener('resize', () => { clearTimeout(overlayTimer); overlayTimer = setTimeout(updateOverlay, 120); });
mq.addEventListener('change', () => { if (S) applyTheme(); });

function setTheme(t) {
  S.settings.theme = t;
  oto.setTheme(t);
  // nativeTheme updates the media query asynchronously
  setTimeout(applyTheme, 30);
  applyTheme();
  save();
}

// Toolbar parts move between the sidebar and the top strip; keep direct references so
// they're never lost while detached during a move.
const PARTS = {};
// Zen layout keeps navigation in the sidebar — but when the sidebar is collapsed to icons or hidden
// there's no room there, so (like Zen) back/forward, reload and the address move up to the top bar.
const navInTopBar = () => S.settings.toolbarLayout === 'top'
  || (S.settings.navWhenCollapsed === 'top' && (!!S.settings.compact || !!S.settings.collapsed));
function placeParts() {
  const single = !navInTopBar();
  for (const id of ['wsTitle', 'btnMenu', 'btnCompact', 'btnShowSidebar', 'navGroup', 'urlPill', 'pageActions', 'bmbar', 'headSpacer',
    'sbHead', 'sbUrlRow', 'sbWsRow', 'tsMain', 'bmRow']) {
    if (!PARTS[id]) PARTS[id] = document.getElementById(id);
  }
  const P = (id) => PARTS[id];
  const head = P('sbHead');
  if (single) {
    head.replaceChildren(P('btnMenu'), P('btnCompact'), P('headSpacer'), P('navGroup'));
    P('sbUrlRow').replaceChildren(P('urlPill'), P('pageActions'));
    P('sbWsRow').replaceChildren(P('wsTitle'));
    P('tsMain').replaceChildren(P('btnShowSidebar'), P('bmbar'));
    P('bmRow').replaceChildren();
  } else {
    head.replaceChildren(P('wsTitle'), P('btnCompact'));
    P('sbUrlRow').replaceChildren();
    P('sbWsRow').replaceChildren();
    P('tsMain').replaceChildren(P('btnShowSidebar'), P('btnMenu'), P('navGroup'), P('urlPill'), P('pageActions'));
    P('bmRow').replaceChildren(P('bmbar'));
  }
}
// Where the page column starts — lets the auto-hidden top bar line its gradient up with the window.
function updateColumnX() {
  const col = document.getElementById('column');
  if (col) document.documentElement.style.setProperty('--col-x', `${Math.round(col.getBoundingClientRect().left)}px`);
}
window.addEventListener('resize', () => requestAnimationFrame(updateColumnX));
function applyLayout() {
  const b = document.body;
  b.classList.toggle('layout-single', !navInTopBar());
  b.classList.toggle('layout-top', navInTopBar());
  b.classList.toggle('autohide-top', !!S.settings.autohideTop);
  b.classList.toggle('show-bm', !!S.settings.showBookmarks);
  b.classList.toggle('rail', !!S.settings.collapsed && !S.settings.compact);
  if (!S.settings.collapsed || S.settings.compact) b.classList.remove('rail-open');
  const sbBtn = document.getElementById('btnCompact');
  if (sbBtn) sbBtn.title = S.settings.collapsed ? 'Expand sidebar' : 'Collapse sidebar to icons';
  placeParts();
  document.body.classList.toggle('compact', !!S.settings.compact);
  document.body.classList.toggle('sb-right', S.settings.sidebarSide === 'right');
  document.body.classList.toggle('flat', S.settings.pageStyle === 'flat');
  const minW = clamp(+S.settings.snapRail || 150, 100, 240);
  document.documentElement.style.setProperty('--sbw', `${clamp(S.settings.sidebarWidth || 256, minW, 420)}px`);
  document.documentElement.style.setProperty('--rail-w', `${clamp(+S.settings.railWidth || 52, 40, 96)}px`);
  if (typeof applyCustomization === 'function') applyCustomization();
  // The sidebar runs the full window height now; nothing sits above it.
  document.documentElement.style.setProperty('--strip-real', '0px');
  requestAnimationFrame(updateColumnX);
  if (typeof renderBookmarks === 'function') renderBookmarks();
}

// ================================================================ input → url
function resolveInput(q) {
  q = String(q || '').trim();
  if (!q) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(q) || /^(about|data|mailto|view-source):/i.test(q)) return { url: q, search: false };
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/.*)?$/i.test(q)) return { url: `http://${q}`, search: false };
  if (!/\s/.test(q) && /^[^\s/?#]+\.[a-z]{2,63}(:\d+)?([/?#].*)?$/i.test(q)) return { url: `https://${q}`, search: false };
  const sc = shortcutFor(q);
  if (sc) return { url: sc.url, search: true, shortcut: sc };
  return { url: searchUrl(q), search: true };
}
function currentEngine() {
  const e = S.settings.engine;
  if (String(e).startsWith('sc:')) {
    const sc = (S.settings.searchShortcuts || []).find((x) => x.key === e.slice(3));
    if (sc) return { name: sc.name, url: sc.url };
  }
  return ENGINES[e] || ENGINES.duckduckgo;
}
const searchUrl = (q) => currentEngine().url.replace('%s', encodeURIComponent(q));
function shortcutFor(q) {
  const m = String(q).trim().match(/^(\S+)\s+(.+)$/);
  if (!m) return null;
  const sc = (S.settings.searchShortcuts || []).find((x) => x.key && x.key.toLowerCase() === m[1].toLowerCase());
  return sc ? { sc, query: m[2], url: sc.url.replace('%s', encodeURIComponent(m[2])) } : null;
}

// ================================================================ views (webviews)
function ensureView(tab) {
  let v = V.get(tab.id);
  if (v) return v;
  const el = document.createElement('webview');
  el.setAttribute('partition', 'persist:oto');
  el.setAttribute('allowpopups', '');
  el.setAttribute('plugins', '');
  el.setAttribute('src', tab.url);
  v = { wv: el, loading: true, ready: false, blocked: 0, error: null, wcId: null, audible: false, muted: false, zoom: 1 };
  V.set(tab.id, v);
  bindView(tab, v);
  $('#views').append(el);
  return v;
}

function destroyView(id) {
  const v = V.get(id);
  if (!v) return;
  if (v.wcId) wcToTab.delete(v.wcId);
  v.wv.remove();
  V.delete(id);
}

function mapWebContents(tab, v) {
  if (v.wcId) return;
  const id = wv(v, (w) => w.getWebContentsId(), null);
  if (!id) return;
  v.wcId = id;
  wcToTab.set(id, tab.id);
  if (earlyBlocked.has(id)) { v.blocked += earlyBlocked.get(id); earlyBlocked.delete(id); }
  if (tab.extReq) { oto.extTabReady(tab.extReq, id); delete tab.extReq; }
  if (S.active[S.activeWs] === tab.id) oto.extActive(id);
}

function bindView(tab, v) {
  const el = v.wv;
  const isActive = () => S.active[S.activeWs] === tab.id;
  const refresh = () => { render(); if (isActive()) updateChrome(); };

  el.addEventListener('did-attach', () => mapWebContents(tab, v));
  extrasBindView(tab, v);
  pwBindView(tab, v);
  el.addEventListener('dom-ready', () => {
    v.ready = true; mapWebContents(tab, v);
    applyBoosts(tab, v);
    if (isActive()) updateChrome();
  });
  el.addEventListener('did-start-loading', () => { v.loading = true; v.error = null; refresh(); });
  el.addEventListener('did-stop-loading', () => { v.loading = false; refresh(); });
  el.addEventListener('did-start-navigation', (e) => {
    if (e.isMainFrame && !e.isInPlace) {
      v.blocked = 0;
      if (hostOf(e.url) !== hostOf(tab.url)) tab.favicon = '';
    }
  });
  el.addEventListener('did-navigate', (e) => {
    tab.url = e.url;
    addHistory(e.url, tab.title);
    save(); refresh();
  });
  el.addEventListener('did-navigate-in-page', (e) => {
    if (!e.isMainFrame) return;
    tab.url = e.url;
    addHistory(e.url, tab.title);
    save(); if (isActive()) updateChrome();
  });
  el.addEventListener('page-title-updated', (e) => {
    tab.title = e.title;
    const last = S.history[0];
    if (last && last.u === tab.url) last.t = e.title;
    save(); refresh();
  });
  el.addEventListener('page-favicon-updated', (e) => {
    const f = (e.favicons || []).find((x) => /^(https?|data):/.test(x));
    if (f && f !== tab.favicon) { tab.favicon = f; save(); render(); }
  });
  el.addEventListener('did-fail-load', (e) => {
    if (!e.isMainFrame || e.errorCode === -3) return; // -3 = aborted (user navigated away)
    v.error = { code: e.errorCode, desc: e.errorDescription, url: e.validatedURL || tab.url };
    if (isActive()) updateChrome();
  });
  el.addEventListener('update-target-url', (e) => { if (isActive()) showStatus(e.url); });
  el.addEventListener('found-in-page', (e) => {
    const r = e.result || {};
    if (isActive() && r.matches != null) $('#findCount').textContent = r.matches ? `${r.activeMatchOrdinal}/${r.matches}` : '0/0';
  });
  el.addEventListener('media-started-playing', () => { v.audible = true; render(); });
  el.addEventListener('media-paused', () => { v.audible = false; render(); });
  el.addEventListener('focus', () => { if (S.settings.stayOpen) closeSlidingSidebar(); });
  el.addEventListener('enter-html-full-screen', () => document.body.classList.add('fs'));
  el.addEventListener('leave-html-full-screen', () => document.body.classList.remove('fs'));
  el.addEventListener('close', () => closeTab(tab.id));
}

function loadIn(tab, url) {
  const v = V.get(tab.id);
  tab.url = url;
  if (!v) return;
  v.error = null;
  if (v.ready) wv(v, (w) => w.loadURL(url).catch(() => {}));
  else v.wv.setAttribute('src', url);
}

// ================================================================ tabs
function insertTab(tab, after) {
  if (after && !after.essential && after.ws === tab.ws && !after.pinned) {
    S.tabs.splice(S.tabs.indexOf(after) + 1, 0, tab);
    return;
  }
  const pos = S.settings.newTabPos;
  const cur = activeTab();
  if (pos === 'next' && cur && !cur.essential && !cur.pinned && cur.ws === tab.ws) {
    S.tabs.splice(S.tabs.indexOf(cur) + 1, 0, tab);
    return;
  }
  if (pos === 'bottom') {
    const last = S.tabs.reduce((i, t, idx) => (!t.essential && t.ws === tab.ws ? idx : i), -1);
    S.tabs.splice(last + 1, 0, tab);
    return;
  }
  // Default: top of the unpinned list (Arc / Zen style).
  const first = S.tabs.findIndex((t) => !t.essential && !t.pinned && t.ws === tab.ws);
  if (first < 0) S.tabs.push(tab); else S.tabs.splice(first, 0, tab);
}

let justOpened = null;
function newTab(url, { background = false, opener = null } = {}) {
  const tab = { id: uid(), url, title: prettyUrl(url), favicon: '', ws: S.activeWs, pinned: false, essential: false, lastActive: Date.now() };
  insertTab(tab, opener);
  justOpened = tab.id;
  if (background) {
    ensureView(tab);
    render();
    toast(`Opened in background — ${hostOf(url) || url}`, { icon: 'tab', timeout: 1800 });
  } else {
    activate(tab.id);
  }
  save();
  return tab;
}

function activate(id, { focus = true } = {}) {
  const tab = tabById(id);
  if (!tab) return;
  if (!tab.essential && tab.ws !== S.activeWs) switchWorkspace(tab.ws, { activate: false });
  const prev = activeTab();
  if (prev && prev.id !== id && V.get(prev.id)) V.get(prev.id).hiddenAt = Date.now();
  S.active[S.activeWs] = id;
  tab.lastActive = Date.now();
  if (LIB.open) closeLibrary();
  const v = ensureView(tab);
  v.hiddenAt = 0;
  if (v.frozen) thawView(v);
  for (const [tid, rv] of V) rv.wv.classList.toggle('on', tid === id);
  applySplit();
  $('#empty').classList.add('gone');
  closeFind();
  render();
  updateChrome();
  if (focus) setTimeout(() => focusView(v), 0);
  if (v.wcId) oto.extActive(v.wcId);
  save();
}

function pickNextAfterClose(order, idx) {
  const rest = order.filter((_, i) => i !== idx);
  // Prefer a neighbour in the same group before jumping into Essentials.
  return rest[idx] || rest[idx - 1] || null;
}

function showNothing() {
  for (const rv of V.values()) rv.wv.classList.remove('on');
  document.body.classList.remove('split');
  if ($('#splitBar')) $('#splitBar').hidden = true;
  $('#empty').classList.remove('gone');
  updateClock();
  closeFind();
  render();
  updateChrome();
}

function closeTab(id) {
  const row = document.querySelector(`.tab[data-id="${id}"]`);
  const t = tabById(id);
  if (row && t && !t.essential && animOn()) {
    if (row.classList.contains('leaving')) return;
    row.classList.add('leaving');
    setTimeout(() => closeTabNow(id), animMs() * 0.6);
    return;
  }
  closeTabNow(id);
}
const animOn = () => !S.settings.reduceMotion && S.settings.animations !== 'off';
const animMs = () => (typeof motionOf === 'function' ? motionOf().ms : 280);
function closeTabNow(id) {
  const tab = tabById(id);
  if (!tab) return;
  if (tab.essential) { unloadTab(id); return; }
  const order = navOrder();
  const idx = order.findIndex((t) => t.id === id);
  const wasActive = S.active[S.activeWs] === id;
  closedStack.push({ tab: { ...tab }, index: S.tabs.indexOf(tab) });
  if (closedStack.length > 30) closedStack.shift();
  archiveTab(tab);
  S.tabs = S.tabs.filter((t) => t.id !== id);
  destroyView(id);
  for (const k of Object.keys(S.active)) if (S.active[k] === id) delete S.active[k];
  if (wasActive) {
    const next = pickNextAfterClose(order, idx);
    if (next) activate(next.id); else showNothing();
  } else render();
  save();
}

function unloadTab(id) {
  const tab = tabById(id);
  if (!tab || !V.has(id)) return;
  const wasActive = S.active[S.activeWs] === id;
  destroyView(id);
  if (wasActive) {
    const others = wsTabs().filter((t) => t.id !== id).sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    delete S.active[S.activeWs];
    if (others[0]) activate(others[0].id); else showNothing();
  } else render();
  save();
}

function reopenClosed() {
  const item = closedStack.pop();
  if (!item) return toast('No recently closed tabs', { timeout: 1500 });
  const t = item.tab;
  if (!S.workspaces.some((w) => w.id === t.ws)) t.ws = S.activeWs;
  S.tabs.splice(clamp(item.index, 0, S.tabs.length), 0, t);
  justOpened = t.id;
  activate(t.id);
}

function duplicateTab(id) {
  const t = tabById(id);
  if (t) newTab(t.url, { opener: t });
}

function clearTabs() {
  const victims = wsTabs().filter((t) => !t.pinned);
  if (!victims.length) return;
  const activeGone = victims.some((t) => t.id === S.active[S.activeWs]);
  for (const t of victims) {
    closedStack.push({ tab: { ...t }, index: S.tabs.indexOf(t) });
    archiveTab(t);
    destroyView(t.id);
  }
  const ids = new Set(victims.map((t) => t.id));
  S.tabs = S.tabs.filter((t) => !ids.has(t.id));
  if (activeGone) {
    delete S.active[S.activeWs];
    const p = wsTabs()[0];
    if (p) activate(p.id); else showNothing();
  } else render();
  save();
  toast(`Cleared ${victims.length} tab${victims.length > 1 ? 's' : ''}`, { action: { label: 'Undo', run: () => { for (let i = 0; i < victims.length; i++) reopenClosed(); } } });
}

function togglePin(id = S.active[S.activeWs]) {
  const t = tabById(id);
  if (!t || t.essential) return;
  t.pinned = !t.pinned;
  render(); save();
  toast(t.pinned ? 'Pinned' : 'Unpinned', { icon: 'pin', timeout: 1200 });
}

function toggleEssential(id = S.active[S.activeWs]) {
  const t = tabById(id);
  if (!t) return;
  t.essential = !t.essential;
  t.pinned = false;
  if (!t.essential) t.ws = S.activeWs;
  render(); save();
  toast(t.essential ? 'Added to Essentials' : 'Removed from Essentials', { icon: 'star', timeout: 1200 });
}

function moveToWorkspace(id, wsId) {
  const t = tabById(id);
  if (!t || t.ws === wsId && !t.essential) return;
  const wasActive = S.active[S.activeWs] === id;
  t.essential = false; t.ws = wsId;
  if (wasActive) delete S.active[S.activeWs];
  S.active[wsId] = id;
  switchWorkspace(wsId);
}

function cycle(d) {
  let order = navOrder();
  if (!order.length) return;
  if (S.settings.tabCycle === 'recent') {
    order = [...order].sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    const pick = d > 0 ? order[1] : order[order.length - 1];
    if (pick) activate(pick.id);
    return;
  }
  const i = order.findIndex((t) => t.id === S.active[S.activeWs]);
  activate(order[(i + d + order.length) % order.length].id);
}

function gotoIndex(n) {
  const order = navOrder();
  const t = n === 9 ? order[order.length - 1] : order[n - 1];
  if (t) activate(t.id);
}

function openUrl(input, { newTabForce = false, background = false, opener = null } = {}) {
  const r = resolveInput(input);
  if (!r) return;
  const cur = activeTab();
  if (!newTabForce && cur) { loadIn(cur, r.url); activate(cur.id); return; }
  newTab(r.url, { background, opener });
}

// ================================================================ history
function addHistory(u, t) {
  if (!/^https?:/i.test(u)) return;
  const h0 = S.history[0];
  if (h0 && h0.u === u) { h0.ts = Date.now(); if (t) h0.t = t; return; }
  S.history.unshift({ u, t: t || '', ts: Date.now() });
  bumpStat('pages');
  if (S.history.length > 3000) S.history.length = 3000;
}

// ================================================================ workspaces (spaces)
let wsAnimDir = 0;
function switchWorkspace(id, { activate: act = true } = {}) {
  const ws = S.workspaces.find((w) => w.id === id);
  if (!ws) return;
  const oldIdx = S.workspaces.findIndex((w) => w.id === S.activeWs);
  const newIdx = S.workspaces.indexOf(ws);
  wsAnimDir = newIdx === oldIdx ? 0 : newIdx > oldIdx ? 1 : -1;
  S.activeWs = id;
  applyTheme();
  if (act) {
    const t = activeTab() || wsTabs().find((x) => x.pinned) || wsTabs()[0];
    if (t) activate(t.id, { focus: false }); else showNothing();
  }
  render(); updateChrome(); save();
}

let wsEdit = null;
function openWsDialog(ws = null, { focusColours = false } = {}) {
  closeMenu();
  if (ws && ws.id !== S.activeWs) switchWorkspace(ws.id);
  const preset = GRAD_PRESETS[S.workspaces.length % GRAD_PRESETS.length];
  wsEdit = ws
    ? { id: ws.id, name: ws.name, emoji: ws.emoji || '', image: ws.image || '', ...JSON.parse(JSON.stringify(themeOf(ws))) }
    : { id: null, name: '', emoji: '', image: '', colors: [...preset], intensity: 0.75, grain: 0 };
  $('#wsDialogTitle').textContent = ws ? 'Edit space' : 'New space';
  $('#wsNameInput').value = wsEdit.name;
  $('#wsEmojiInput').value = wsEdit.emoji;
  paintWsIconPreview();
  const preview = () => { themePreview = { colors: wsEdit.colors, intensity: wsEdit.intensity, grain: wsEdit.grain }; applyTheme(); };
  $('#wsPicker').replaceChildren(createGradientPicker(wsEdit, preview));
  preview();
  $('#wsDialog').hidden = false;
  if (!focusColours) setTimeout(() => $('#wsNameInput').focus(), 20);
}
// ---- space icons: a gradient dot, an emoji, or your own image file
function paintWsIcon(el, w) {
  el.classList.toggle('img', !!w.image);
  el.classList.toggle('emoji', !w.image && !!w.emoji);
  el.textContent = !w.image && w.emoji ? w.emoji : '';
  el.style.background = w.image ? `center / cover no-repeat url("${w.image}")` : w.emoji ? '' : wsSwatch(w);
}
function paintWsIconPreview() {
  if (!wsEdit) return;
  const prev = $('#wsIconPreview');
  paintWsIcon(prev, { ...wsEdit, emoji: $('#wsEmojiInput').value.trim(), colors: wsEdit.colors });
  $('#wsImageClear').hidden = !wsEdit.image;
}
// Images are shrunk to a small square so state stays light; small animated GIFs are kept as-is.
function readSpaceImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || '') && !/\.(ico|svg)$/i.test(file.name)) { reject(new Error('not an image')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const url = String(fr.result);
      if (/image\/gif/.test(file.type) && file.size < 400 * 1024) { resolve(url); return; }
      const img = new Image();
      img.onload = () => {
        const S2 = 128;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S2;
        const x = cv.getContext('2d');
        const sc = Math.max(S2 / img.naturalWidth || 1, S2 / img.naturalHeight || 1);
        const w = (img.naturalWidth || S2) * sc, hgt = (img.naturalHeight || S2) * sc;
        x.drawImage(img, (S2 - w) / 2, (S2 - hgt) / 2, w, hgt);
        resolve(cv.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('could not read image'));
      img.src = url;
    };
    fr.readAsDataURL(file);
  });
}
function closeWsDialog() {
  $('#wsDialog').hidden = true;
  themePreview = null;
  applyTheme();
}
function saveWsDialog() {
  const name = $('#wsNameInput').value.trim() || 'Space';
  const emoji = $('#wsEmojiInput').value.trim();
  const image = wsEdit.image || '';
  const theme = { colors: [...wsEdit.colors], color: wsEdit.colors[0], intensity: wsEdit.intensity, grain: wsEdit.grain };
  themePreview = null;
  $('#wsDialog').hidden = true;
  if (wsEdit.id) {
    Object.assign(S.workspaces.find((w) => w.id === wsEdit.id), { name, emoji, image, ...theme });
    applyTheme(); render(); save();
  } else {
    const ws = { id: uid(), name, emoji, image, ...theme };
    S.workspaces.push(ws);
    switchWorkspace(ws.id);
  }
}
function deleteWorkspace(id) {
  if (S.workspaces.length < 2) return toast('You need at least one space', { timeout: 1600 });
  const ws = S.workspaces.find((w) => w.id === id);
  for (const t of wsTabs(id)) destroyView(t.id);
  S.tabs = S.tabs.filter((t) => t.essential || t.ws !== id);
  S.workspaces = S.workspaces.filter((w) => w.id !== id);
  delete S.active[id];
  if (S.activeWs === id) switchWorkspace(S.workspaces[0].id); else { render(); save(); }
  toast(`Deleted “${ws.name}”`, { icon: 'trash', timeout: 1800 });
}

// ================================================================ sidebar render
let renderQueued = false;
function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderNow(); renderMedia(); });
}

function favEl(t, v, big = false) {
  if (v && v.loading && !big) return h('span', { class: 'spinner' });
  const letter = () => h('span', { class: 'fav-letter', style: `background:${letterColor(hostOf(t.url) || t.title)}` },
    (hostOf(t.url) || t.title || '?').charAt(0));
  let src = t.favicon;
  if (!src) { try { const u = new URL(t.url); if (/^https?:$/.test(u.protocol)) src = `${u.origin}/favicon.ico`; } catch {} }
  if (!src) return letter();
  const img = h('img', { class: 'fav', src, alt: '', draggable: 'false' });
  img.addEventListener('error', () => img.replaceWith(letter()), { once: true });
  return img;
}

function renderNow() {
  const ws = currentWs();
  $('#wsName').textContent = ws.name;
  $('#wsTitle').title = `${ws.name} — space options`;
  paintWsIcon($('#wsDot'), ws);

  const activeId = S.active[S.activeWs];
  const ess = essentials();
  const essBox = $('#essentials');
  essBox.classList.toggle('empty', !ess.length);
  essBox.replaceChildren(...ess.map((t) => essTile(t, t.id === activeId)));

  const tabs = wsTabs();
  $('#pinned').replaceChildren(...tabs.filter((t) => t.pinned).map((t) => tabRow(t, t.id === activeId)));
  $('#tabs').replaceChildren(...tabs.filter((t) => !t.pinned).map((t) => tabRow(t, t.id === activeId)));
  $('#btnClear').classList.toggle('show', tabs.some((t) => !t.pinned));

  document.body.classList.toggle('no-ws-switch', !S.settings.showSpaceSwitcher);
  $('#wsSwitch').replaceChildren(
    ...S.workspaces.map((w, i) => wsButton(w, i)),
    h('button', { class: 'ws-btn ws-add', title: 'New space', html: icon('plus'), onclick: () => openWsDialog() }),
  );

  if (wsAnimDir && S.settings.reduceMotion) wsAnimDir = 0;
  if (wsAnimDir) {
    $('#tabsWrap').animate(
      [{ opacity: 0, transform: `translateX(${wsAnimDir * 14}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    wsAnimDir = 0;
  }
  justOpened = null;
}

function essTile(t, active) {
  const v = V.get(t.id);
  const el = h('div', {
    class: `ess${active ? ' active' : ''}${v ? '' : ' asleep'}`, draggable: 'true', title: t.title || t.url,
    onclick: () => activate(t.id),
    onauxclick: (e) => { if (e.button === 1) unloadTab(t.id); },
    oncontextmenu: (e) => { e.preventDefault(); tabMenu(t, e.clientX, e.clientY); },
  }, favEl(t, null, true));
  if (v && v.audible && !v.muted) el.append(h('span', { class: 'audio-dot' }));
  bindDrag(el, t, 'ess');
  return el;
}

function tabRow(t, active) {
  const v = V.get(t.id);
  const row = h('div', {
    'data-id': t.id,
    class: `tab${active ? ' active' : ''}${inSplit(t.id) ? ' in-split' : ''}${v ? '' : ' asleep'}${v && v.frozen ? ' frozen' : ''}${justOpened === t.id ? ' enter' : ''}`,
    draggable: 'true', title: `${t.title || ''}\n${t.url}${v ? (v.frozen ? '\nFrozen to save CPU' : '') : '\nSleeping to save memory'}`,
    onclick: () => activate(t.id),
    onauxclick: (e) => { if (e.button === 1) closeTab(t.id); },
    oncontextmenu: (e) => { e.preventDefault(); tabMenu(t, e.clientX, e.clientY); },
  },
  favEl(t, v),
  h('span', { class: 'title' }, t.title || prettyUrl(t.url)));
  if (v && (v.audible || v.muted)) {
    row.append(h('button', {
      class: 'audio', title: v.muted ? 'Unmute tab' : 'Mute tab', html: icon(v.muted ? 'mute' : 'vol'),
      onclick: (e) => { e.stopPropagation(); toggleMute(t.id); },
    }));
  }
  row.append(h('button', {
    class: 'x', title: t.pinned ? 'Close pinned tab' : 'Close tab (Ctrl+W)', html: icon('x'),
    onclick: (e) => { e.stopPropagation(); closeTab(t.id); },
  }));
  bindDrag(row, t, 'list');
  return row;
}

function wsButton(w, i) {
  const btn = h('button', {
    class: `ws-btn${w.id === S.activeWs ? ' active' : ''}${w.image ? ' img' : w.emoji ? ' emoji' : ''}`,
    title: `${w.name}  (Ctrl+Shift+${i + 1})`, style: `--ws-color:${w.color}`,
    onclick: () => switchWorkspace(w.id),
    oncontextmenu: (e) => { e.preventDefault(); wsMenu(w, e.clientX, e.clientY); },
  }, (() => { const d = h('span', { class: 'ws-dot' }); paintWsIcon(d, w); return d; })());
  btn.addEventListener('dragover', (e) => { if (dragId) { e.preventDefault(); btn.classList.add('drop'); } });
  btn.addEventListener('dragleave', () => btn.classList.remove('drop'));
  btn.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); if (dragId) moveToWorkspace(dragId, w.id); });
  return btn;
}

function toggleMute(id) {
  const v = V.get(id);
  if (!v) return;
  v.muted = !v.muted;
  wv(v, (w) => w.setAudioMuted(v.muted));
  render();
}

// ---- drag & drop
let dragId = null;
function clearDropMarks() {
  document.querySelectorAll('.drop-before,.drop-after,.ws-btn.drop').forEach((n) => n.classList.remove('drop-before', 'drop-after', 'drop'));
}
function bindDrag(el, t, zone) {
  el.addEventListener('dragstart', (e) => {
    dragId = t.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', t.url);
    el.classList.add('drag-src');
    requestAnimationFrame(() => document.body.classList.add('dragging'));
  });
  el.addEventListener('dragend', () => {
    dragId = null;
    document.body.classList.remove('dragging');
    clearDropMarks();
    render();
  });
  el.addEventListener('dragover', (e) => {
    if (!dragId || dragId === t.id) return;
    e.preventDefault(); e.stopPropagation();
    const r = el.getBoundingClientRect();
    const after = zone === 'ess' ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
    clearDropMarks();
    el.classList.add(after ? 'drop-after' : 'drop-before');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    const after = el.classList.contains('drop-after');
    if (dragId) moveTab(dragId, t.id, after);
  });
}
function moveTab(id, targetId, after) {
  if (id === targetId) return;
  const t = tabById(id), target = tabById(targetId);
  if (!t || !target) return;
  S.tabs.splice(S.tabs.indexOf(t), 1);
  S.tabs.splice(S.tabs.indexOf(target) + (after ? 1 : 0), 0, t);
  t.essential = target.essential;
  t.pinned = target.essential ? false : target.pinned;
  if (!target.essential) t.ws = target.ws;
  render(); save();
}
function bindZone(el, apply) {
  el.addEventListener('dragover', (e) => { if (dragId) e.preventDefault(); });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    const t = dragId && tabById(dragId);
    if (!t) return;
    S.tabs.splice(S.tabs.indexOf(t), 1);
    S.tabs.push(t);
    apply(t);
    render(); save();
  });
}

// ---- Closing a slid-open sidebar / top bar ------------------------------------------------
// Signals that the mouse has left: the sidebar's own mouseleave, any mouse movement inside a web
// page (reported by the main process — on Windows pages swallow mouse events, so this is the
// reliable one), or the cursor leaving the window. Coming back over the sidebar cancels it.
let sbCloseT = null;
let topCloseT = null;
const sbIsOpen = () => document.body.classList.contains('rail-open') || (document.body.classList.contains('peek') && S.settings.compact);
const topIsOpen = () => document.body.classList.contains('peek-top') && S.settings.autohideTop;
const blockReason = () => [document.body.classList.contains('resizing') && 'resizing', !$('#menuLayer').hidden && 'menu open', dragId && 'dragging',
  !$('#wsDialog').hidden && 'space dialog', !$('#settings').hidden && 'settings open', !$('#cmdk').hidden && 'command bar open'].filter(Boolean).join(', ');
const closingBlocked = () => document.body.classList.contains('resizing') || !$('#menuLayer').hidden || !!dragId
  || !$('#wsDialog').hidden || !$('#settings').hidden || !$('#cmdk').hidden;
// Before closing, ask where the cursor really is: still over it, or parked at that screen edge
// (inside the window's resize border, where the page can't see the mouse) means stay open.
// A page reporting mouse movement right now is the strongest signal of all — the page never sits
// under the sidebar or top bar — so it wins over the system cursor (which can be off on some
// Windows display-scaling / multi-monitor setups).
let lastPageMouse = 0;
const pageHasMouse = () => Date.now() - lastPageMouse < 260;
async function cursorKeepsOpen(el, edge) {
  if (pageHasMouse()) return false;
  const c = window.__testCursor || await oto.cursor();
  if (pageHasMouse()) return false;
  if (!c) return el.matches(':hover');
  const r = el.getBoundingClientRect();
  diag('cursor', { x: Math.round(c.x), y: Math.round(c.y), el: el.id, l: Math.round(r.left), r: Math.round(r.right), edge });
  if (c.x >= r.left - 6 && c.x <= r.right + 6 && c.y >= r.top - 6 && c.y <= r.bottom + 6) return true;
  if (edge === 'top') return c.y >= -2 && c.y <= 10 && c.x >= -2 && c.x <= innerWidth + 2;
  if (edge === 'left') return c.x >= -2 && c.x <= 10 && c.y >= -2 && c.y <= innerHeight + 2;
  if (edge === 'right') return c.x >= innerWidth - 10 && c.x <= innerWidth + 2 && c.y >= -2 && c.y <= innerHeight + 2;
  return false;
}
function scheduleSidebarClose() {
  if (!sbIsOpen() || S.settings.stayOpen || sbCloseT) return;
  diag('sidebar', 'close scheduled');
  sbCloseT = setTimeout(async () => {
    sbCloseT = null;
    if (!sbIsOpen()) return;
    if (closingBlocked()) { diag('sidebar', `not closing: ${blockReason()}`); return; }
    const edge = S.settings.compact ? (S.settings.sidebarSide === 'right' ? 'right' : 'left') : null;
    if (await cursorKeepsOpen($('#sidebar'), edge)) { diag('sidebar', 'kept open (cursor over it or at edge)'); return; }
    diag('sidebar', 'closing');
    document.body.classList.remove('rail-open', 'peek');
  }, clamp(+S.settings.closeDelay || 260, 50, 5000));
}
function cancelSidebarClose() { if (sbCloseT) diag('sidebar', 'close cancelled (mouse back over it)'); clearTimeout(sbCloseT); sbCloseT = null; }
function scheduleTopClose() {
  if (!topIsOpen() || topCloseT) return;
  topCloseT = setTimeout(async () => {
    topCloseT = null;
    if (!topIsOpen() || closingBlocked()) return;
    if (await cursorKeepsOpen($('#topstrip'), 'top')) return;
    document.body.classList.remove('peek-top');
  }, 350);
}
function cancelTopClose() { clearTimeout(topCloseT); topCloseT = null; }

// Safety net: if the cursor leaves the window entirely while something is slid open, close it.
let hoverWatch = null;
function startHoverWatch() {
  if (hoverWatch) return;
  hoverWatch = setInterval(async () => {
    if (!sbIsOpen() && !topIsOpen()) { clearInterval(hoverWatch); hoverWatch = null; return; }
    const c = window.__testCursor || await oto.cursor();
    if (!c) return;
    const outsideWindow = c.x < 0 || c.y < 0 || c.x > innerWidth || c.y > innerHeight;
    if (outsideWindow) { scheduleSidebarClose(); scheduleTopClose(); }
  }, 150);
}
// Remember when each one opened: page mouse reports that were generated *before* that moment
// (the mouse crossing the page on its way to the edge) must not close it again.
let sbOpenedAt = 0;
let topOpenedAt = 0;
let sbWasOpen = false;
let topWasOpen = false;
new MutationObserver(() => {
  const so = sbIsOpen(), to = topIsOpen();
  if (so && !sbWasOpen) { sbOpenedAt = Date.now(); cancelSidebarClose(); }
  if (to && !topWasOpen) { topOpenedAt = Date.now(); cancelTopClose(); }
  sbWasOpen = so; topWasOpen = to;
  if (so || to) startHoverWatch();
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

// A sidebar that slid open (icon strip or hidden mode) goes back when you use the page.
function closeSlidingSidebar() {
  if (document.body.classList.contains('resizing')) return;
  if ($('#sidebar').matches(':hover')) return; // you're still using it (e.g. just clicked a tab)
  document.body.classList.remove('rail-open', 'peek');
}

// ================================================================ toolbar
function updateChrome() {
  if (typeof updateStar === 'function') updateStar();
  if (typeof updateKeyButton === 'function') updateKeyButton();
  const t = activeTab();
  document.body.classList.toggle('no-page', !t || !V.get(t.id));
  const v = t && V.get(t.id);
  const pill = $('#urlPill');
  const back = $('#btnBack'), fwd = $('#btnFwd'), rel = $('#btnReload');

  if (!t || !v) {
    pill.innerHTML = `${icon('search')}<span class="ph">Search or enter address</span>`;
    back.disabled = fwd.disabled = rel.disabled = true;
    $('#btnCopy').disabled = true;
    $('#progress').classList.remove('on');
    $('#error').hidden = true;
    setShield(null);
    document.title = 'Oto';
    return;
  }

  let u = null;
  try { u = new URL(t.url); } catch {}
  if (u && /^https?:$/.test(u.protocol)) {
    const mode = S.settings.urlDisplay;
    const path = mode === 'domain' ? '' : (u.pathname === '/' ? '' : u.pathname) + u.search + (mode === 'full' ? u.hash : '');
    const host = mode === 'full' ? u.hostname : u.hostname.replace(/^www\./, '');
    const secure = u.protocol === 'https:';
    pill.innerHTML = `<span class="ic-slot${secure ? '' : ' notsecure'}" title="${secure ? 'Secure connection' : 'Not secure'}">${icon(secure ? 'lock' : 'unlock')}</span>`;
    pill.append(h('span', { class: 'addr' }, mode === 'full' ? h('span', { class: 'path' }, `${u.protocol}//`) : null,
      h('span', { class: 'host' }, host), h('span', { class: 'path' }, path)));
  } else {
    pill.innerHTML = icon('globe');
    pill.append(h('span', { class: 'path' }, t.url));
  }

  back.disabled = !wv(v, (w) => w.canGoBack(), false);
  fwd.disabled = !wv(v, (w) => w.canGoForward(), false);
  rel.disabled = false;
  rel.innerHTML = icon(v.loading ? 'x' : 'reload');
  rel.title = v.loading ? 'Stop' : 'Reload (Ctrl+R)';
  $('#btnCopy').disabled = false;
  $('#progress').classList.toggle('on', !!v.loading);
  setShield(v);
  renderError(v);
  document.title = `${t.title || prettyUrl(t.url)} — Oto`;
}

function setShield(v) {
  const b = $('#btnShield');
  const on = S.settings.blockTrackers;
  const n = v ? v.blocked : 0;
  b.classList.toggle('has', on && n > 0);
  b.classList.toggle('off', !on);
  b.innerHTML = icon('shield') + (on && n ? `<span>${n > 999 ? '999+' : n}</span>` : '');
  b.title = on ? `${n} tracker${n === 1 ? '' : 's'} & ads blocked on this page` : 'Tracker blocking is off';
}

const ERRORS = {
  '-105': ['Couldn’t find this site', (u) => `Check the spelling of ${hostOf(u) || 'the address'} — the server couldn’t be found.`],
  '-106': ['You’re offline', () => 'Check your internet connection and try again.'],
  '-102': ['Connection refused', (u) => `${hostOf(u) || 'The site'} refused to connect.`],
  '-118': ['Connection timed out', (u) => `${hostOf(u) || 'The site'} took too long to respond.`],
  '-200': ['Your connection isn’t private', (u) => `The certificate for ${hostOf(u)} isn’t trusted, so Oto stopped loading it.`],
};
function renderError(v) {
  const e = v && v.error;
  $('#error').hidden = !e;
  if (!e) return;
  const known = ERRORS[String(e.code)] || (e.code <= -200 && e.code > -300 ? ERRORS['-200'] : null);
  $('#errIcon').innerHTML = icon(e.code === -106 ? 'offline' : 'globe');
  $('#errTitle').textContent = known ? known[0] : 'This page can’t be reached';
  $('#errMsg').textContent = known ? known[1](e.url) : `${e.desc || 'Something went wrong'} (${e.code})`;
}

let statusTimer;
function showStatus(url) {
  const s = $('#status');
  clearTimeout(statusTimer);
  if (url) { s.textContent = url; s.classList.add('on'); }
  else statusTimer = setTimeout(() => s.classList.remove('on'), 120);
}

// ================================================================ command bar
const C = { open: false, mode: 'new', items: [], sel: 0, sugg: [], seq: 0 };

const ACTIONS = [
  { name: 'New space', icon: 'plus', run: () => openWsDialog() },
  { name: 'Change space colours', kw: 'theme gradient color colour', icon: 'palette', run: () => openWsDialog(currentWs(), { focusColours: true }) },
  { name: 'Split view', kw: 'side by side two tabs', icon: 'split', run: () => toggleSplit() },
  { name: 'Library', kw: 'downloads history spaces media', icon: 'library', run: () => openLibrary() },
  { name: 'Downloads', kw: 'files', icon: 'download', run: () => openLibrary('downloads') },
  { name: 'History', kw: 'visited pages', icon: 'clock', run: () => openLibrary('history') },
  { name: 'My Oto Card', kw: 'card profile share', icon: 'card', run: () => openLibrary('card') },
  { name: 'Passwords', kw: 'logins saved password manager', icon: 'key', run: () => openLibrary('passwords') },
  { name: 'What’s new in Oto', kw: 'changelog release notes update version', icon: 'star', run: () => showWhatsNew({ all: true }) },
  { name: 'Routing — send sites to a space', kw: 'route rules air traffic', icon: 'route', run: () => openLibrary('routing') },
  { name: 'Picture in picture', kw: 'pip video pop out', icon: 'pip', run: () => pictureInPicture() },
  { name: 'Report a problem', kw: 'bug log feedback', icon: 'flag', run: () => openSettings('about') },
  { name: 'Toggle compact mode', kw: 'sidebar hide show', icon: 'sidebar', run: () => toggleCompact() },
  { name: 'Open settings', kw: 'preferences options', icon: 'settings', run: () => openSettings() },
  { name: 'Archived tabs', kw: 'archive closed restore', icon: 'clock', run: () => openSettings('archive') },
  { name: 'Boosts — restyle this site', kw: 'css custom style boost', icon: 'bolt', run: () => openSettings('boosts') },
  { name: 'Change app icon', kw: 'icon taskbar', icon: 'star', run: () => openSettings('icon') },
  { name: 'Move sidebar to the other side', kw: 'left right sidebar position', icon: 'sidebar', run: () => { S.settings.sidebarSide = S.settings.sidebarSide === 'right' ? 'left' : 'right'; applyLayout(); save(); } },
  { name: 'Make Oto the default browser', kw: 'default', icon: 'globe', run: () => oto.makeDefaultBrowser() },
  { name: 'Dark theme', kw: 'night mode', icon: 'moon', run: () => setTheme('dark') },
  { name: 'Light theme', kw: 'day mode', icon: 'sun', run: () => setTheme('light') },
  { name: 'System theme', kw: 'auto', icon: 'settings', run: () => setTheme('system') },
  { name: 'Copy current link', kw: 'url address', icon: 'copy', run: () => copyUrl() },
  { name: 'Pin or unpin current tab', icon: 'pin', run: () => togglePin() },
  { name: 'Add or remove from Essentials', kw: 'favorite', icon: 'star', run: () => toggleEssential() },
  { name: 'Reopen closed tab', kw: 'undo restore', icon: 'reload', run: () => reopenClosed() },
  { name: 'Find in page', icon: 'find', run: () => openFind() },
  { name: 'Clear tabs in this space', kw: 'close all', icon: 'x', run: () => clearTabs() },
  { name: 'Clear browsing history', icon: 'trash', run: () => { S.history = []; save(); toast('History cleared', { timeout: 1500 }); } },
  { name: 'Developer tools', kw: 'inspect devtools', icon: 'code', run: () => CMDS.devtools() },
];

function openCmd(mode = 'new') {
  const t = activeTab();
  if (mode === 'current' && !t) mode = 'new';
  C.mode = mode; C.open = true; C.sugg = []; C.seq++;
  closeMenu();
  $('#cmdk').hidden = false;
  updateOverlay();
  const inp = $('#cmdInput');
  inp.value = mode === 'current' ? t.url : '';
  inp.placeholder = mode === 'current' ? 'Edit address or search' : 'Search or enter address';
  computeItems();
  inp.focus();
  inp.select();
}
function closeCmd(refocus = true) {
  if (!C.open) return;
  C.open = false;
  $('#cmdk').hidden = true;
  updateOverlay();
  if (refocus) { const v = activeView(); if (v) focusView(v); }
}

const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
const matchAll = (hay, ws) => { hay = hay.toLowerCase(); return ws.every((w) => hay.includes(w)); };

function computeItems() {
  const raw = $('#cmdInput').value;
  const q = raw.trim();
  const ws = words(q);
  const cur = activeTab();
  const items = [];
  const openUrls = new Set(S.tabs.map((t) => t.url));

  if (q && !(C.mode === 'current' && cur && q === cur.url)) {
    const r = resolveInput(q);
    items.push(r.search
      ? (r.shortcut
        ? { g: '', icon: 'bolt', t: r.shortcut.query, s: `— Search ${r.shortcut.sc.name}`, hint: 'Search', run: (nt) => go(r.url, nt) }
        : { g: '', icon: 'search', t: q, s: `— Search ${currentEngine().name}`, hint: 'Search', run: (nt) => go(r.url, nt) })
      : { g: '', icon: 'globe', t: r.url, s: '', hint: 'Open', run: (nt) => go(r.url, nt) });

    S.tabs.filter((t) => t.id !== (cur && cur.id) && matchAll(`${t.title} ${t.url}`, ws)).slice(0, 4)
      .forEach((t) => items.push({ g: 'Tabs', tab: t, t: t.title || prettyUrl(t.url), s: prettyUrl(t.url), hint: 'Switch to tab', run: () => { closeCmd(false); activate(t.id); } }));

    const seen = new Set();
    for (const hi of S.history) {
      if (items.filter((i) => i.g === 'History').length >= 5) break;
      if (seen.has(hi.u) || openUrls.has(hi.u) || !matchAll(`${hi.t} ${hi.u}`, ws)) continue;
      seen.add(hi.u);
      items.push({ g: 'History', hist: hi, t: hi.t || prettyUrl(hi.u), s: prettyUrl(hi.u), hint: 'Open', run: (nt) => go(hi.u, nt) });
    }

    (S.archive || []).filter((a) => !openUrls.has(a.url) && !seen.has(a.url) && matchAll(`${a.title} ${a.url}`, ws)).slice(0, 3)
      .forEach((a) => items.push({ g: 'Archived', hist: { u: a.url, t: a.title }, t: a.title, s: prettyUrl(a.url), hint: 'Restore', run: () => { closeCmd(false); restoreArchived(a.id); } }));

    C.sugg.filter((s) => s.toLowerCase() !== q.toLowerCase()).slice(0, 4)
      .forEach((s) => items.push({ g: 'Suggestions', icon: 'search', t: s, s: '', hint: 'Search', run: (nt) => go(searchUrl(s), nt) }));

    ACTIONS.filter((a) => matchAll(`${a.name} ${a.kw || ''}`, ws)).slice(0, 4)
      .forEach((a) => items.push({ g: 'Actions', icon: a.icon, t: a.name, s: '', hint: 'Run', run: () => { closeCmd(false); a.run(); } }));
  } else {
    const others = S.tabs.filter((t) => t.id !== (cur && cur.id) && V.has(t.id))
      .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0)).slice(0, 5);
    others.forEach((t) => items.push({ g: 'Open tabs', tab: t, t: t.title || prettyUrl(t.url), s: prettyUrl(t.url), hint: 'Switch to tab', run: () => { closeCmd(false); activate(t.id); } }));
    const seen = new Set();
    for (const hi of S.history) {
      if (seen.size >= 5) break;
      if (seen.has(hi.u) || openUrls.has(hi.u)) continue;
      seen.add(hi.u);
      items.push({ g: 'Recent', hist: hi, t: hi.t || prettyUrl(hi.u), s: prettyUrl(hi.u), hint: 'Open', run: (nt) => go(hi.u, nt) });
    }
  }
  C.items = items;
  C.sel = 0;
  renderCmd();
}

function go(url, forceNew = false) {
  const mode = C.mode;
  closeCmd(false);
  const cur = activeTab();
  if (mode === 'current' && cur && !forceNew) { loadIn(cur, url); activate(cur.id); } else newTab(url);
}

function cmdIcon(it) {
  if (it.tab) return favEl(it.tab, null, true);
  if (it.hist) {
    const host = hostOf(it.hist.u);
    const fake = { url: it.hist.u, title: it.hist.t, favicon: (S.tabs.find((t) => hostOf(t.url) === host && t.favicon) || {}).favicon || '' };
    return fake.favicon ? favEl(fake, null, true) : h('span', { class: 'ic-slot', html: icon('clock') });
  }
  return h('span', { class: 'ic-slot', html: icon(it.icon || 'globe') });
}

function renderCmd() {
  const list = $('#cmdList');
  const nodes = [];
  let lastG = null;
  C.items.forEach((it, i) => {
    if (it.g && it.g !== lastG) nodes.push(h('div', { class: 'cmdk-group' }, it.g));
    lastG = it.g;
    nodes.push(h('div', {
      class: `cmdk-item${i === C.sel ? ' sel' : ''}`, 'data-i': i,
      onmousemove: () => { if (C.sel !== i) { C.sel = i; paintSel(); } },
      onmousedown: (e) => { e.preventDefault(); it.run(e.altKey || e.button === 1); },
    },
    h('span', { class: 'ico' }, cmdIcon(it)),
    h('span', { class: 'txt' }, h('span', { class: 't' }, it.t), it.s ? h('span', { class: 's' }, it.s) : null),
    h('span', { class: 'hint' }, `${it.hint} ↵`)));
  });
  list.replaceChildren(...nodes);
  const r = resolveInput($('#cmdInput').value);
  $('#cmdIcon').innerHTML = icon(r && !r.search ? 'globe' : 'search');
}
function paintSel() {
  document.querySelectorAll('.cmdk-item').forEach((el) => el.classList.toggle('sel', +el.dataset.i === C.sel));
  const el = document.querySelector('.cmdk-item.sel');
  if (el) el.scrollIntoView({ block: 'nearest' });
}

let suggTimer;
function fetchSuggest() {
  clearTimeout(suggTimer);
  const q = $('#cmdInput').value.trim();
  C.sugg = [];
  if (!S.settings.suggestions || !q || resolveInput(q).search === false) return;
  const seq = ++C.seq;
  suggTimer = setTimeout(async () => {
    const res = await oto.suggest(S.settings.engine, q);
    if (seq !== C.seq || !C.open) return;
    C.sugg = res || [];
    const sel = C.sel;
    computeItems();
    C.sel = Math.min(sel, C.items.length - 1);
    paintSel();
  }, 130);
}

// ================================================================ find in page
function openFind() {
  const v = activeView();
  if (!v) return;
  $('#findbar').hidden = false;
  const i = $('#findInput');
  i.focus(); i.select();
  if (i.value) doFind(true, true);
}
function closeFind() {
  if ($('#findbar').hidden) return;
  $('#findbar').hidden = true;
  $('#findCount').textContent = '';
  const v = activeView();
  if (v) { wv(v, (w) => w.stopFindInPage('clearSelection')); focusView(v); }
}
function doFind(forward = true, fresh = false) {
  const v = activeView();
  if (!v) return;
  const q = $('#findInput').value;
  if (!q) { wv(v, (w) => w.stopFindInPage('clearSelection')); $('#findCount').textContent = ''; return; }
  wv(v, (w) => w.findInPage(q, { forward, findNext: fresh }));
}

// ================================================================ menus, toasts, permissions
function showMenu(x, y, items) {
  const menu = $('#menu');
  menu.replaceChildren(...items.filter(Boolean).map((it) => {
    if (it === '-') return h('div', { class: 'msep' });
    if (it.header) return h('div', { class: 'mh' }, it.header);
    return h('button', {
      class: `mi${it.danger ? ' danger' : ''}`,
      onclick: () => { closeMenu(); it.run(); },
    }, it.fav ? favEl(it.fav, null, true) : it.icon ? iconEl(it.icon) : h('span', { style: 'width:14px' }), h('span', { class: 'ml' }, it.label), it.k ? h('span', { class: 'k' }, it.k) : null);
  }));
  $('#menuLayer').hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${clamp(x, 6, innerWidth - r.width - 6)}px`;
  menu.style.top = `${clamp(y, 6, innerHeight - r.height - 6)}px`;
}
function closeMenu() { $('#menuLayer').hidden = true; }

function tabMenu(t, x, y) {
  const v = V.get(t.id);
  const others = S.workspaces.filter((w) => t.essential || w.id !== t.ws);
  showMenu(x, y, [
    !t.essential && { label: t.pinned ? 'Unpin tab' : 'Pin tab', icon: 'pin', k: 'Ctrl+D', run: () => togglePin(t.id) },
    { label: t.essential ? 'Remove from Essentials' : 'Add to Essentials', icon: 'star', run: () => toggleEssential(t.id) },
    t.id !== (activeTab() || {}).id && !inSplit(t.id) && { label: 'Split with current tab', icon: 'split', run: () => { const cur = activeTab(); if (cur) { startSplit(t.id); } } },
    inSplit(t.id) && { label: 'Close split view', icon: 'split', run: () => endSplit() },
    { label: 'Duplicate', icon: 'dup', run: () => duplicateTab(t.id) },
    { label: 'Copy link', icon: 'copy', run: () => { oto.copy(t.url); toast('Link copied', { icon: 'copy', timeout: 1200 }); } },
    v && { label: 'Reload', icon: 'reload', run: () => wv(v, (w) => w.reload()) },
    v && { label: v.muted ? 'Unmute' : 'Mute', icon: v.muted ? 'vol' : 'mute', run: () => toggleMute(t.id) },
    v && { label: 'Unload to save memory', icon: 'sleep', run: () => unloadTab(t.id) },
    others.length ? '-' : null,
    others.length ? { header: 'Move to space' } : null,
    ...others.map((w) => ({ label: w.name, icon: 'move', run: () => moveToWorkspace(t.id, w.id) })),
    '-',
    t.essential
      ? { label: 'Remove', icon: 'trash', danger: true, run: () => { toggleEssential(t.id); closeTab(t.id); } }
      : { label: 'Close tab', icon: 'x', danger: true, k: 'Ctrl+W', run: () => closeTab(t.id) },
  ]);
}

function wsSwatch(w) {
  const c = themeOf(w).colors;
  return c.length > 1 ? `linear-gradient(135deg, ${c.join(', ')})` : c[0];
}

function wsMenu(w, x, y) {
  showMenu(x, y, [
    { label: 'Change colours…', icon: 'palette', run: () => openWsDialog(w, { focusColours: true }) },
    { label: 'Edit space…', icon: 'edit', run: () => openWsDialog(w) },
    S.settings.spaceMenuNew ? { label: 'New space…', icon: 'plus', run: () => openWsDialog() } : null,
    S.workspaces.length > 1 ? '-' : null,
    S.workspaces.length > 1 ? { label: 'Delete space', icon: 'trash', danger: true, run: () => deleteWorkspace(w.id) } : null,
  ]);
}

function toast(text, { icon: ic = null, action = null, timeout = 3200 } = {}) {
  const el = h('div', { class: 'toast' }, ic ? iconEl(ic) : null, h('span', {}, text));
  if (action) el.append(h('button', { class: 'btn', onclick: () => { action.run(); kill(); } }, action.label));
  const box = $('#toasts');
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  function kill() { el.classList.add('out'); setTimeout(() => el.remove(), 220); }
  setTimeout(kill, timeout);
}

const permQueue = [];
const PERM_TEXT = {
  geolocation: 'know your location',
  notifications: 'show notifications',
  midi: 'use your MIDI devices', midiSysex: 'use your MIDI devices',
  'clipboard-read': 'see text and images you copy',
  pointerLock: 'lock your mouse pointer',
  keyboardLock: 'capture keyboard shortcuts',
  'display-capture': 'see your screen',
  'idle-detection': 'know when you’re away',
  'storage-access': 'use cookies across sites', 'top-level-storage-access': 'use cookies across sites',
  hid: 'use HID devices', serial: 'use serial ports', usb: 'use USB devices',
  fileSystem: 'edit files on your computer',
  'speaker-selection': 'choose audio outputs',
};
function permLabel(p) {
  if (p.permission === 'media') {
    const m = p.mediaTypes || [];
    if (m.includes('video') && m.includes('audio')) return 'use your camera and microphone';
    if (m.includes('video')) return 'use your camera';
    return 'use your microphone';
  }
  if (p.permission === 'openExternal') return `open ${p.externalURL ? `“${p.externalURL.split(':')[0]}” links in another app` : 'another app'}`;
  return PERM_TEXT[p.permission] || `use “${p.permission}”`;
}
function showNextPerm() {
  const p = permQueue[0];
  if (!p) { $('#permBar').hidden = true; return; }
  const text = $('#permText');
  text.replaceChildren(h('b', {}, hostOf(p.origin) || p.origin), ` wants to ${permLabel(p)}`);
  $('#permBar').hidden = false;
}
function answerPerm(allow) {
  const p = permQueue.shift();
  if (p) oto.replyPermission(p.id, allow);
  showNextPerm();
}

// ================================================================ settings
// ================================================================ extension toolbar
function mountExtensionBar() {
  const bar = $('#extbar');
  if (!customElements.get('browser-action-list')) return;
  if (!bar.querySelector('browser-action-list')) {
    const el = document.createElement('browser-action-list');
    el.setAttribute('partition', 'persist:oto');
    el.setAttribute('alignment', 'bottom left');
    bar.append(el);
  }
}

// ================================================================ misc commands
function toggleCompact() {
  const sb = $('#sidebar');
  const hiding = !S.settings.compact;
  const side = S.settings.sidebarSide === 'right' ? 'marginRight' : 'marginLeft';
  const w = `-${sb.getBoundingClientRect().width}px`;
  void sb; void side; void w;
  S.settings.compact = hiding;
  document.body.classList.remove('peek');
  applyLayout(); save();
}

// One place that decides the sidebar's mode — used by buttons, shortcuts and drag-to-resize.
function setSidebarMode(mode) {
  S.settings.compact = mode === 'hidden';
  S.settings.collapsed = mode === 'collapsed';
  document.body.classList.remove('peek', 'rail-open');
  applyLayout();
}
const sidebarMode = () => (S.settings.compact ? 'hidden' : S.settings.collapsed ? 'collapsed' : 'expanded');
function toggleCollapsed() {
  if (S.settings.compact) { S.settings.compact = false; }
  S.settings.collapsed = !S.settings.collapsed;
  document.body.classList.remove('rail-open');
  applyLayout(); save();
}
function toggleAutohideTop() {
  S.settings.autohideTop = !S.settings.autohideTop;
  document.body.classList.remove('peek-top');
  applyLayout(); save();
  toast(S.settings.autohideTop ? 'Top bar hides — move to the top edge to show it' : 'Top bar always visible', { timeout: 1800 });
}

function mainMenu(x, y) {
  const t = activeTab();
  const bm = t && typeof findBookmark === 'function' && findBookmark(t.url);
  showMenu(x, y, [
    { label: 'New tab', icon: 'plus', k: 'Ctrl+T', run: () => openCmd('new') },
    { label: 'New space', icon: 'palette', run: () => openWsDialog() },
    { label: 'Library', icon: 'library', k: 'Ctrl+Shift+O', run: () => openLibrary() },
    { label: 'Downloads', icon: 'download', k: 'Ctrl+J', run: () => openLibrary('downloads') },
    '-',
    t && { label: bm ? 'Remove bookmark' : 'Bookmark this page', icon: 'star', run: () => toggleBookmark() },
    t && { label: 'Copy link', icon: 'copy', k: 'Ctrl+Shift+C', run: () => copyUrl() },
    t && { label: 'Find in page', icon: 'find', k: 'Ctrl+F', run: () => openFind() },
    t && { label: splitShowing() ? 'Close split view' : 'Split view', icon: 'split', k: 'Ctrl+Shift+S', run: () => toggleSplit() },
    splitShowing() && { label: 'Swap sides', icon: 'move', run: () => swapSplit() },
    t && { label: 'Picture in picture', icon: 'pip', k: 'Ctrl+Shift+P', run: () => pictureInPicture() },
    t && { label: 'Print…', icon: 'copy', run: () => withView((w) => w.print()) },
    t && { label: 'Zoom in', icon: 'plus', k: 'Ctrl+=', run: () => zoom(1) },
    t && { label: 'Zoom out', icon: 'x', k: 'Ctrl+-', run: () => zoom(-1) },
    t ? '-' : null,
    { label: S.settings.collapsed ? 'Expand sidebar' : 'Collapse sidebar to icons', icon: 'sidebar', run: () => toggleCollapsed() },
    { label: S.settings.compact ? 'Show sidebar' : 'Hide sidebar completely', icon: 'sidebar', k: 'Ctrl+B', run: () => toggleCompact() },
    { label: S.settings.autohideTop ? 'Always show top bar' : 'Auto-hide top bar', icon: 'up', run: () => toggleAutohideTop() },
    '-',
    { label: 'Extensions', icon: 'bolt', run: () => openSettings('extensions') },
    { label: 'Bookmarks', icon: 'star', run: () => openSettings('bookmarks') },
    { label: 'Archive & history', icon: 'clock', run: () => openSettings('archive') },
    { label: 'Settings', icon: 'settings', k: 'Ctrl+,', run: () => openSettings() },
  ]);
}
function copyUrl() {
  const t = activeTab();
  if (!t) return;
  oto.copy(t.url);
  toast('Link copied', { icon: 'copy', timeout: 1300 });
}
function zoom(dir) {
  const v = activeView();
  if (!v) return;
  const cur = wv(v, (w) => w.getZoomFactor(), 1);
  let next = 1;
  if (dir > 0) next = ZOOMS.find((z) => z > cur + 0.001) || ZOOMS[ZOOMS.length - 1];
  if (dir < 0) next = [...ZOOMS].reverse().find((z) => z < cur - 0.001) || ZOOMS[0];
  wv(v, (w) => w.setZoomFactor(next));
  toast(`Zoom ${Math.round(next * 100)}%`, { timeout: 900 });
}

const withView = (fn) => { const v = activeView(); if (v) wv(v, fn); };
const CMDS = {
  newTab: () => openCmd('new'),
  focusUrl: () => openCmd('current'),
  history: () => toggleLibrary('history'),
  downloads: () => toggleLibrary('downloads'),
  library: () => toggleLibrary(),
  closeTab: () => { const t = activeTab(); if (t) closeTab(t.id); },
  reopen: reopenClosed,
  nextTab: () => cycle(1),
  prevTab: () => cycle(-1),
  reload: () => withView((w) => w.reload()),
  hardReload: () => withView((w) => w.reloadIgnoringCache()),
  back: () => withView((w) => { if (w.canGoBack()) w.goBack(); }),
  forward: () => withView((w) => { if (w.canGoForward()) w.goForward(); }),
  toggleSidebar: toggleCompact,
  togglePin: () => togglePin(),
  toggleEssential: () => toggleEssential(),
  find: openFind,
  findNext: () => { if ($('#findbar').hidden) openFind(); else doFind(true); },
  copyUrl,
  zoomIn: () => zoom(1),
  zoomOut: () => zoom(-1),
  zoomReset: () => zoom(0),
  devtools: () => withView((w) => (w.isDevToolsOpened() ? w.closeDevTools() : w.openDevTools())),
  settings: openSettings,
  toggleTop: () => toggleAutohideTop(),
  bookmark: () => toggleBookmark(),
  splitView: () => toggleSplit(),
  pip: () => pictureInPicture(),
};

// ================================================================ clock / empty state
function updateClock() {
  const d = new Date();
  const st = S.settings;
  const fmt = { hour: 'numeric', minute: '2-digit' };
  if (st.clockFormat === '24h') fmt.hourCycle = 'h23';
  if (st.clockFormat === '12h') fmt.hour12 = true;
  $('#clock').textContent = d.toLocaleTimeString([], fmt);
  $('#clock').hidden = !st.showClock;
  const hr = d.getHours();
  const hi = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  $('#greet').textContent = st.userName ? `${hi}, ${st.userName}` : hi;
  $('#greet').hidden = !st.showGreeting;
  $('#emptyHints').hidden = !st.showHints;
}

// ================================================================ wiring
const WIN_ICONS = {
  min: '<svg viewBox="0 0 10 10"><path d="M0 5.5h10" stroke="currentColor" stroke-width="1"/></svg>',
  max: '<svg viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
  restore: '<svg viewBox="0 0 10 10"><path d="M2.5 2.5V.5h7v7h-2" fill="none" stroke="currentColor" stroke-width="1"/><rect x=".5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
  close: '<svg viewBox="0 0 10 10"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1.05"/></svg>',
};
function wire() {
  $('#winMin').innerHTML = WIN_ICONS.min;
  $('#winMax').innerHTML = WIN_ICONS.max;
  $('#winClose').innerHTML = WIN_ICONS.close;
  $('#winMin').onclick = () => oto.winMin();
  $('#winMax').onclick = () => oto.winMax();
  $('#winClose').onclick = () => oto.winClose();
  $('#topstrip').addEventListener('dblclick', (e) => { if (e.target.closest('button, .bm, browser-action-list')) return; });
  oto.on('win-state', ({ maximized }) => {
    $('#winMax').innerHTML = maximized ? WIN_ICONS.restore : WIN_ICONS.max;
    $('#winMax').title = maximized ? 'Restore' : 'Maximise';
  });
  $('#btnMenu').innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';
  $('#btnMenu').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); mainMenu(r.left, r.bottom + 4); };
  $('#btnStar').innerHTML = icon('star');
  $('#btnStar').onclick = () => toggleBookmark();
  $('#btnExtensions').innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5a2 2 0 1 1 4 0V6h4a1 1 0 0 1 1 1v4h-1.5a2 2 0 1 0 0 4H18v4a1 1 0 0 1-1 1h-4v-1.5a2 2 0 1 0-4 0V20H5a1 1 0 0 1-1-1v-4h1.5a2 2 0 1 0 0-4H4V7a1 1 0 0 1 1-1h4z"/></svg>';
  $('#btnExtensions').onclick = () => openSettings('extensions');
  applySpaceArrow();
  $('#wsEmojiInput').addEventListener('input', paintWsIconPreview);
  $('#wsImageBtn').onclick = () => $('#wsImageFile').click();
  $('#wsImageClear').innerHTML = icon('x');
  $('#wsImageClear').onclick = () => { wsEdit.image = ''; paintWsIconPreview(); };
  $('#wsImageFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    try { wsEdit.image = await readSpaceImage(f); paintWsIconPreview(); } catch { toast('That file isn’t an image Oto can use', { timeout: 2000 }); }
  });

  // auto-hiding top strip
  let topTimer;
  $('#peekTop').addEventListener('mouseenter', () => { clearTimeout(topTimer); document.body.classList.add('peek-top'); });
  // Backup for edges Windows keeps for resizing: anything near the top of Oto's own UI opens it too.
  document.addEventListener('mousemove', (e) => {
    if (S.settings.autohideTop && e.clientY <= 10 && !document.body.classList.contains('peek-top')) {
      clearTimeout(topTimer); document.body.classList.add('peek-top');
    }
  });
  $('#topstrip').addEventListener('mouseenter', () => { clearTimeout(topTimer); cancelTopClose(); });
  $('#topstrip').addEventListener('mousemove', cancelTopClose);
  $('#topstrip').addEventListener('mouseleave', () => scheduleTopClose());
  // mouse moving inside a web page = definitely outside the sidebar and the top bar
  oto.on('page-mouse', (ts) => {
    const t = ts || Date.now();
    if (t > sbOpenedAt + 60 || t > topOpenedAt + 60) lastPageMouse = Date.now();
    if (t > sbOpenedAt + 60) scheduleSidebarClose();
    if (t > topOpenedAt + 60) scheduleTopClose();
  });

  // extension API → Oto tabs
  oto.on('ext:create-tab', ({ id, url, active }) => {
    const t = newTab(url, { background: !active, opener: activeTab() });
    const v = V.get(t.id) || ensureView(t);
    t.extReq = id;
    if (v.wcId) { oto.extTabReady(id, v.wcId); delete t.extReq; }
  });
  oto.on('ext:select-tab', (wcId) => { const id = wcToTab.get(wcId); if (id) activate(id); });
  oto.on('ext:remove-tab', (wcId) => { const id = wcToTab.get(wcId); if (id) closeTab(id); });
  oto.on('ext:changed', () => { mountExtensionBar(); if (!$('#settings').hidden && settingsTab === 'extensions') renderSettings(); });

  $('#btnCompact').innerHTML = icon('sidebar');
  $('#btnShowSidebar').innerHTML = icon('sidebar');
  $('#btnSettings').innerHTML = icon('settings');
  $('#btnBack').innerHTML = icon('back');
  $('#btnFwd').innerHTML = icon('fwd');
  $('#btnReload').innerHTML = icon('reload');
  $('#btnCopy').innerHTML = icon('copy');
  $('#btnNewTab .ic-slot').innerHTML = icon('plus');
  $('#emptySearch .ic-slot').innerHTML = icon('search');
  $('#emptyLogo').innerHTML = logoSvg();
  $('#emptyHints').replaceChildren(
    h('span', {}, h('kbd', {}, 'Ctrl B'), 'sidebar'),
    h('span', {}, h('kbd', {}, 'Ctrl Shift 1…9'), 'spaces'),
    h('span', {}, h('kbd', {}, 'Ctrl D'), 'pin'),
  );
  $('#findPrev').innerHTML = icon('up');
  $('#findNext').innerHTML = icon('down');
  $('#findClose').innerHTML = icon('x');
  $('#settingsClose').innerHTML = icon('x');

  $('#btnCompact').onclick = () => (S.settings.compact ? toggleCompact() : toggleCollapsed());
  $('#btnShowSidebar').onclick = toggleCompact;
  $('#btnSettings').onclick = openSettings;
  $('#btnNewTab').onclick = () => openCmd('new');
  $('#btnClear').onclick = clearTabs;
  $('#wsTitle').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); wsMenu(currentWs(), r.left, r.bottom + 4); };
  $('#btnBack').onclick = CMDS.back;
  $('#btnFwd').onclick = CMDS.forward;
  $('#btnReload').onclick = () => { const v = activeView(); if (!v) return; if (v.loading) wv(v, (w) => w.stop()); else wv(v, (w) => w.reload()); };
  $('#btnCopy').onclick = copyUrl;
  $('#urlPill').onclick = () => openCmd('current');
  $('#emptySearch').onclick = () => openCmd('new');
  $('#btnShield').onclick = () => {
    const v = activeView();
    if (!S.settings.blockTrackers) return openSettings();
    toast(`Oto blocked ${v ? v.blocked : 0} ads & trackers on this page`, { icon: 'shield', action: { label: 'Settings', run: openSettings } });
  };
  $('#errRetry').onclick = () => { const t = activeTab(), v = activeView(); if (t && v) { const u = (v.error && v.error.url) || t.url; v.error = null; updateChrome(); loadIn(t, u); } };

  // command bar
  const inp = $('#cmdInput');
  inp.addEventListener('input', () => { computeItems(); fetchSuggest(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); C.sel = (C.sel + 1) % Math.max(1, C.items.length); paintSel(); }
    else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); C.sel = (C.sel - 1 + C.items.length) % Math.max(1, C.items.length); paintSel(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const it = C.items[C.sel];
      if (it) it.run(e.altKey);
      else if (C.mode === 'current') closeCmd();
    } else if (e.key === 'Escape') { e.preventDefault(); closeCmd(); }
  });
  $('#cmdk').addEventListener('mousedown', (e) => { if (e.target.id === 'cmdk') closeCmd(); });

  // find
  const fi = $('#findInput');
  fi.addEventListener('input', () => doFind(true, true));
  fi.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doFind(!e.shiftKey); }
    if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  $('#findPrev').onclick = () => doFind(false);
  $('#findNext').onclick = () => doFind(true);
  $('#findClose').onclick = closeFind;

  // permissions
  $('#permAllow').onclick = () => answerPerm(true);
  $('#permBlock').onclick = () => answerPerm(false);

  // settings & dialogs
  $('#settingsClose').onclick = closeSettings;
  $('#settings').addEventListener('mousedown', (e) => { if (e.target.id === 'settings') closeSettings(); });
  $('#wsCancel').onclick = closeWsDialog;
  $('#wsSave').onclick = saveWsDialog;
  $('#wsDialog').addEventListener('mousedown', (e) => { if (e.target.id === 'wsDialog') closeWsDialog(); });
  $('#wsDialog').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'range') saveWsDialog(); });
  $('#menuLayer').addEventListener('mousedown', (e) => { if (e.target.id === 'menuLayer') closeMenu(); });
  $('#menuLayer').addEventListener('contextmenu', (e) => { e.preventDefault(); closeMenu(); });

  $('#main').addEventListener('mousedown', () => { if (S.settings.stayOpen) closeSlidingSidebar(); else { scheduleSidebarClose(); scheduleTopClose(); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (document.body.classList.contains('rail-open') || document.body.classList.contains('peek'))) closeSlidingSidebar();
    if (e.key !== 'Escape') return;
    if (!$('#menuLayer').hidden) closeMenu();
    else if (!$('#wsDialog').hidden) closeWsDialog();
    else if (!$('#settings').hidden) closeSettings();
    else if (!$('#findbar').hidden) closeFind();
  });

  // drop zones
  bindZone($('#essentials'), (t) => { t.essential = true; t.pinned = false; });
  bindZone($('#pinned'), (t) => { t.essential = false; t.pinned = true; t.ws = S.activeWs; });
  bindZone($('#tabs'), (t) => { t.essential = false; t.pinned = false; t.ws = S.activeWs; });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  // dynamic (collapsed) sidebar: slide open on hover, close when the mouse leaves
  let railTimer;
  const sb = $('#sidebar');
  sb.addEventListener('mouseenter', () => {
    cancelSidebarClose();
    if (!document.body.classList.contains('rail') || document.body.classList.contains('resizing')) return;
    clearTimeout(railTimer);
    railTimer = setTimeout(() => document.body.classList.add('rail-open'), clamp(+S.settings.hoverDelay || 0, 0, 1000));
  });
  sb.addEventListener('mousemove', cancelSidebarClose);
  sb.addEventListener('mouseleave', () => {
    if (!document.body.classList.contains('rail-open')) clearTimeout(railTimer); // left before it opened
    scheduleSidebarClose();
  });

  // compact peek
  let peekTimer;
  $('#peek').addEventListener('mouseenter', () => {
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => document.body.classList.add('peek'), clamp(+S.settings.hoverDelay || 0, 0, 1000));
  });
  $('#peek').addEventListener('mouseleave', (e) => {
    // Sliding into the window's resize border (the outermost pixels) isn't really leaving.
    const towardEdge = S.settings.sidebarSide === 'right' ? e.clientX >= innerWidth - 12 : e.clientX <= 12;
    if (!document.body.classList.contains('peek') && !towardEdge) clearTimeout(peekTimer);
  });

  // Edge watcher: when the sidebar is hidden or the top bar auto-hides, check the real cursor
  // position (from the system, which still reports it inside the window's resize border) so
  // touching the very edge always opens them — even with a quick flick.
  let edgeSince = { left: 0, top: 0 };
  setInterval(async () => {
    const st = S.settings;
    const b = document.body;
    if (!(st.compact || st.autohideTop) || b.classList.contains('resizing')) return;
    if (!$('#settings').hidden || !$('#cmdk').hidden || !$('#menuLayer').hidden) return;
    const c = window.__testCursor || await oto.cursor();
    // Only when Oto is the active window (asked from the system — the page holding focus is fine).
    if (!c || c.focused === false) return;
    const now = Date.now();
    const inY = c.y >= -2 && c.y <= innerHeight + 2;
    const inX = c.x >= -2 && c.x <= innerWidth + 2;
    const atSide = st.sidebarSide === 'right' ? c.x >= innerWidth - 10 && c.x <= innerWidth + 2 : c.x >= -2 && c.x <= 10;
    if (st.compact && !b.classList.contains('peek') && inY && atSide) {
      if (!edgeSince.left) edgeSince.left = now;
      if (now - edgeSince.left >= clamp(+st.hoverDelay || 0, 0, 1000)) b.classList.add('peek');
    } else edgeSince.left = 0;
    if (st.autohideTop && !b.classList.contains('peek-top') && inX && c.y >= -2 && c.y <= 10) {
      b.classList.add('peek-top');
    }
  }, 70);
  $('#sidebar').addEventListener('mouseenter', () => clearTimeout(peekTimer));

  // sidebar resize — drag the edge. Narrow it past a point and it snaps to the icon strip;
  // keep going and it snaps away completely. Drag back out to bring it back.
  const snapRail = () => clamp(+S.settings.snapRail || 150, 100, 240); // narrower than this → icon strip
  const snapHide = () => clamp(+S.settings.snapHide || 26, 0, 80);     // narrower than this → hidden
  const startResize = (e, fromWidth) => {
    e.preventDefault();
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}
    document.body.classList.add('resizing');
    document.body.classList.remove('rail-open');
    const startX = e.clientX;
    const dir = S.settings.sidebarSide === 'right' ? -1 : 1;
    let mode = sidebarMode();
    const snapTo = (m) => {
      if (m === mode) return;
      mode = m;
      document.body.classList.add('snapping');      // animate the jump between snap points
      setSidebarMode(m);
      clearTimeout(startResize.t);
      startResize.t = setTimeout(() => document.body.classList.remove('snapping'), animMs() + 60);
    };
    const move = (ev) => {
      const raw = fromWidth + dir * (ev.clientX - startX);
      if (raw < snapHide()) snapTo('hidden');
      else if (raw < snapRail()) snapTo('collapsed');
      else {
        snapTo('expanded');
        S.settings.sidebarWidth = clamp(raw, snapRail(), 420);
        document.documentElement.style.setProperty('--sbw', `${S.settings.sidebarWidth}px`);
        updateColumnX();
      }
    };
    const up = () => {
      document.body.classList.remove('resizing');
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      updateColumnX();
      save();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  const handle = $('#sbResize');
  handle.addEventListener('pointerdown', (e) => {
    const m = sidebarMode();
    const w = m === 'expanded' || document.body.classList.contains('peek') || document.body.classList.contains('rail-open')
      ? S.settings.sidebarWidth : m === 'collapsed' ? (+S.settings.railWidth || 52) : 0;
    startResize(e, w);
  });
  // From hidden: grab the screen edge and pull the sidebar back out.
  $('#peek').addEventListener('pointerdown', (e) => startResize(e, 0));
  handle.addEventListener('dblclick', () => { S.settings.sidebarWidth = 256; setSidebarMode('expanded'); save(); });

  // events from the main process
  oto.on('cmd', (name) => {
    if (name.startsWith('tab:')) return gotoIndex(+name.slice(4));
    if (name.startsWith('ws:')) { const w = S.workspaces[+name.slice(3) - 1]; if (w) switchWorkspace(w.id); return; }
    const fn = CMDS[name];
    if (fn) fn();
  });
  oto.on('tab:open', ({ url, background }) => {
    if (!url) return;
    routedOpen(url, { background, opener: activeTab() });
  });
  oto.on('search', (text) => newTab(searchUrl(text), { opener: activeTab() }));
  oto.on('blocked', (wcId, n) => {
    const id = wcToTab.get(wcId);
    const v = id && V.get(id);
    if (!v) { earlyBlocked.set(wcId, (earlyBlocked.get(wcId) || 0) + n); return; }
    v.blocked += n;
    if (id === S.active[S.activeWs]) setShield(v);
  });
  oto.on('perm:ask', (p) => { permQueue.push(p); if (permQueue.length === 1) showNextPerm(); });
  oto.on('perm:cancel', (id) => {
    const i = permQueue.findIndex((p) => p.id === id);
    if (i >= 0) { permQueue.splice(i, 1); if (i === 0) showNextPerm(); }
  });
  oto.on('window-fullscreen', () => {});

  setInterval(() => { if (!$('#empty').classList.contains('gone')) updateClock(); }, 10000);
}

// ================================================================ boot
(async function boot() {
  const [saved, info] = await Promise.all([oto.loadState(), oto.info()]);
  INFO = info || {};
  S = migrate(saved);
  oto.setTheme(S.settings.theme);
  syncMainSettings();
  if (S.settings.startup === 'fresh') {
    const loose = S.tabs.filter((t) => !t.essential && !t.pinned);
    for (const t of loose) archiveTab(t);
    const gone = new Set(loose.map((t) => t.id));
    S.tabs = S.tabs.filter((t) => !gone.has(t.id));
    for (const k of Object.keys(S.active)) if (gone.has(S.active[k])) delete S.active[k];
  }
  applyTheme();
  wire();
  initExtras();
  initLibrary();
  initPasswords();
  applyLayout();
  mountExtensionBar();
  applyAppIcon();
  housekeeping();
  setInterval(housekeeping, 5 * 60 * 1000);
  setInterval(freezeTick, 30 * 1000);
  updateClock();
  const t = activeTab();
  if (t) activate(t.id, { focus: false }); else showNothing();
  render();
  updateChrome();
  if (INFO.launchUrl) routedOpen(INFO.launchUrl);
  // Freshly (re)installed? Run the welcome setup once — your tabs, bookmarks and settings are kept.
  if (INFO.installMarker && S.installMarker !== INFO.installMarker) { S.installMarker = INFO.installMarker; S.onboarded = false; save(); }
  if (!S.onboarded) runSetup();
  checkWhatsNew();
})();
