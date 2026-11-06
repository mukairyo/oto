'use strict';
/* Oto — Arc-style settings window, tab archive, Boosts (per-site CSS), app icons */

// ================================================================ app icons
const DARK_BG = ['#1c1833', '#08080e'];
const ICON_STYLES = {
  classic: { name: 'Neon', c: ['#a855f7', '#6366f1', '#22d3ee'] },
  cream: { name: 'Cream', c: ['#f6f1e8', '#e7dfd1', '#cbbfae'], bg: ['#1a1a1d', '#0b0b0c'], glow: false },
  sunset: { name: 'Sunset', c: ['#fb923c', '#ec4899', '#a855f7'] },
  mint: { name: 'Mint', c: ['#34d399', '#10b981', '#22d3ee'] },
  rose: { name: 'Rose', c: ['#fb7185', '#f472b6', '#fda4af'] },
  ember: { name: 'Ember', c: ['#ef4444', '#f97316', '#facc15'] },
  ocean: { name: 'Ocean', c: ['#3b82f6', '#0ea5e9', '#22d3ee'] },
  graphite: { name: 'Graphite', c: ['#f4f4f5', '#a1a1aa', '#71717a'], bg: ['#27272a', '#09090b'] },
  paper: { name: 'Paper', c: ['#7c3aed', '#4f46e5', '#0891b2'], bg: ['#ffffff', '#e7e5e4'], glow: false },
  space: { name: 'Match space', c: null },
};
function iconPalette(style) {
  // The Oto theme (near-black) shows the mark in cream instead of neon.
  if ((!style || style === 'classic') && typeof skinIsRt === 'function' && skinIsRt()) style = 'cream';
  const s = ICON_STYLES[style] || ICON_STYLES.classic;
  if (s.c) return { c: s.c, bg: s.bg || DARK_BG, glow: s.glow !== false };
  const cols = themeOf(currentWs()).colors.map((c) => accentFrom(c, true));
  return { c: [cols[0], cols[Math.floor(cols.length / 2)], cols[cols.length - 1]], bg: DARK_BG, glow: true };
}
function iconSvg(style) {
  const { c, bg, glow } = iconPalette(style);
  return otoMarkSvg(c, bg, glow);
}
// The taskbar/window icon: the same SVG drawn onto a canvas.
function iconDataUrl(style, size = 256) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      cv.getContext('2d').drawImage(img, 0, 0, size, size);
      try { resolve(cv.toDataURL('image/png')); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    const svg = iconSvg(style).replace('<svg ', `<svg width="${size}" height="${size}" `);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
let iconTimer;
function applyAppIcon() {
  clearTimeout(iconTimer);
  iconTimer = setTimeout(() => {
    iconDataUrl(S.settings.appIcon).then((u) => { if (u) oto.setAppIcon(u); });
    const logo = $('#emptyLogo');
    if (logo) logo.innerHTML = iconSvg(S.settings.appIcon);
  }, 60);
}

// ================================================================ archive (Arc-style)
const ARCHIVE_AFTER = { '12h': 12 * 36e5, '24h': 24 * 36e5, '7d': 7 * 864e5, '30d': 30 * 864e5 };
const UNLOAD_AFTER = { '15m': 15 * 6e4, '1h': 36e5, '4h': 4 * 36e5 };

function archiveTab(t) {
  if (!t || t.essential || !/^(https?|file):/i.test(t.url)) return;
  S.archive = (S.archive || []).filter((a) => a.url !== t.url);
  S.archive.unshift({ id: uid(), url: t.url, title: t.title || prettyUrl(t.url), favicon: t.favicon || '', ws: t.ws, at: Date.now() });
  if (S.archive.length > 300) S.archive.length = 300;
}
function restoreArchived(id) {
  const a = (S.archive || []).find((x) => x.id === id);
  if (!a) return;
  S.archive = S.archive.filter((x) => x.id !== id);
  if (a.ws && a.ws !== S.activeWs && S.workspaces.some((w) => w.id === a.ws)) switchWorkspace(a.ws, { activate: false });
  newTab(a.url);
}
const isActiveAnywhere = (id) => Object.values(S.active).includes(id) || inSplit(id);

function housekeeping() {
  const now = Date.now();
  // Auto-archive unpinned tabs you haven't looked at in a while.
  const ttl = ARCHIVE_AFTER[S.settings.archiveAfter];
  if (ttl) {
    const old = S.tabs.filter((t) => !t.essential && !t.pinned && !isActiveAnywhere(t.id) && now - (t.lastActive || now) > ttl);
    if (old.length) {
      for (const t of old) { archiveTab(t); destroyView(t.id); }
      const ids = new Set(old.map((t) => t.id));
      S.tabs = S.tabs.filter((t) => !ids.has(t.id));
      render(); save();
      toast(`Archived ${old.length} inactive tab${old.length > 1 ? 's' : ''}`, { icon: 'clock', action: { label: 'View', run: () => openSettings('archive') } });
    }
  }
  // Memory saver: put background tabs to sleep.
  const idle = UNLOAD_AFTER[S.settings.unloadAfter];
  if (idle) {
    for (const [id, v] of V) {
      const t = tabById(id);
      if (!t || isActiveAnywhere(id) || mediaBusy(id, v)) continue;
      const since = v.hiddenAt || t.lastActive || now;
      if (now - since > idle) destroyView(id);
    }
    render();
  }
}

// ================================================================ Boosts (Arc-style per-site CSS)
const BOOST_TEMPLATES = [
  { name: 'Blank', css: '/* Your CSS here — applies to this site */\n' },
  { name: 'Hide YouTube Shorts', host: 'youtube.com', css: 'ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer,\nytd-guide-entry-renderer:has(a[title="Shorts"]),\nytd-mini-guide-entry-renderer[aria-label="Shorts"] { display: none !important; }\n' },
  { name: 'YouTube focus mode', host: 'youtube.com', css: '#related, #comments, ytd-watch-next-secondary-results-renderer { display: none !important; }\n' },
  { name: 'Force dark mode', css: 'html { filter: invert(1) hue-rotate(180deg) !important; background: #fff; }\nimg, video, picture, canvas, iframe, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }\n' },
  { name: 'Nicer font', css: 'p, li, a, h1, h2, h3, h4, h5, td, th, label, input, textarea, blockquote {\n  font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif !important;\n}\n' },
  { name: 'Hide sticky headers', css: 'header[style*="sticky"], [class*="sticky"], [class*="Sticky"] { position: static !important; }\n' },
];
const boostMatches = (b, url) => { const host = hostOf(url); return !!host && !!b.host && (host === b.host || host.endsWith(`.${b.host}`)); };

async function applyBoosts(tab, v) {
  if (!v) return;
  for (const key of v.boostKeys || []) await wv(v, (w) => w.removeInsertedCSS(key).catch(() => {}));
  v.boostKeys = [];
  for (const b of S.boosts || []) {
    if (!b.on || !boostMatches(b, tab.url)) continue;
    const key = await wv(v, (w) => w.insertCSS(b.css).catch(() => null), null);
    if (key) v.boostKeys.push(key);
  }
}
function reapplyBoosts() {
  for (const [id, v] of V) { const t = tabById(id); if (t && v.ready) applyBoosts(t, v); }
}

// ================================================================ efficiency: freezing background tabs
// A music/video tab counts as playing for 10 minutes after its last sound, so the short gap between
// songs (or a quick pause) never gets it frozen or put to sleep — that used to stop the next song.
const mediaBusy = (id, v) => v.audible || (v.audibleAt && Date.now() - v.audibleAt < 10 * 60 * 1000) || (typeof media !== 'undefined' && media && media.tabId === id && !media.dismissed);
const FREEZE_AFTER = { '1m': 6e4, '5m': 3e5, '15m': 9e5 };
function freezeTick() {
  const ttl = FREEZE_AFTER[S.settings.freezeAfter];
  if (!ttl) return;
  const now = Date.now();
  for (const [id, v] of V) {
    if (v.frozen || !v.ready || !v.wcId || mediaBusy(id, v) || v.loading || isActiveAnywhere(id)) continue;
    const t = tabById(id);
    const since = v.hiddenAt || (t && t.lastActive);
    if (!since || now - since < ttl) continue;
    v.frozen = true;
    oto.freezeTab(v.wcId, true).then((ok) => { if (!ok) v.frozen = false; render(); });
  }
}
function thawView(v) {
  v.frozen = false;
  if (v.wcId) oto.freezeTab(v.wcId, false);
}
function thawAll() { for (const v of V.values()) if (v.frozen) thawView(v); render(); }

// ================================================================ customisation
const UI_FONTS = {
  'segoe-variable': ['Segoe UI Variable', '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif', '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif'],
  segoe: ['Segoe UI', '"Segoe UI", system-ui, sans-serif'],
  bahnschrift: ['Bahnschrift', 'Bahnschrift, "Segoe UI", sans-serif'],
  cascadia: ['Cascadia (mono)', '"Cascadia Code", "Cascadia Mono", Consolas, monospace'],
  georgia: ['Georgia (serif)', 'Georgia, "Times New Roman", serif'],
  verdana: ['Verdana', 'Verdana, Tahoma, sans-serif'],
  system: ['System default', 'system-ui, sans-serif'],
};
const TAB_HEIGHTS = { compact: 28, default: 34, roomy: 40 };

const MODS = [
  { id: 'pillTabs', name: 'Pill-shaped tabs', css: '.tab,.new-tab{border-radius:999px}' },
  { id: 'glowTab', name: 'Glowing active tab', css: '.tab.active{box-shadow:0 0 0 1px var(--accent),0 6px 18px -6px var(--accent)}' },
  { id: 'boldTitles', name: 'Bold tab titles', css: '.tab .title{font-weight:600}' },
  { id: 'monoFav', name: 'Monochrome favicons', desc: 'Colour returns on hover and on the active tab.', css: '.tab:not(:hover):not(.active) .fav,.ess:not(:hover):not(.active) .fav{filter:grayscale(1);opacity:.7}' },
  { id: 'noClose', name: 'Hide tab close buttons', desc: 'Middle-click or Ctrl+W still closes tabs.', css: '.tab .x{display:none}' },
  { id: 'bigEss', name: 'Large Essentials', css: '.essentials{grid-template-columns:repeat(auto-fill,minmax(64px,1fr))}.ess{height:58px}.ess .fav,.ess .fav-letter{width:26px;height:26px}' },
  { id: 'hideNewTab', name: 'Hide the “New Tab” button', desc: 'Use Ctrl+T instead.', css: '#btnNewTab{display:none}' },
  { id: 'hideWsName', name: 'Hide the space name', css: '#wsName{display:none}' },
  { id: 'thinScroll', name: 'Hide the sidebar scrollbar', css: '.sb-scroll::-webkit-scrollbar{display:none}' },
  { id: 'accentRing', name: 'Accent outline around pages', css: '#content{box-shadow:0 0 0 2px var(--accent),var(--card-shadow)!important}' },
  { id: 'noShadow', name: 'No page shadow', css: '#content{box-shadow:0 0 0 1px var(--card-border)!important}' },
  { id: 'accentPill', name: 'Tinted address bar', css: '.url-pill{background:color-mix(in srgb,var(--accent) 18%,transparent)}' },
];

function applyCustomization() {
  const st = S.settings;
  const root = document.documentElement;
  const b = document.body;
  const f = UI_FONTS[st.uiFont] || UI_FONTS['segoe-variable'];
  root.style.setProperty('--font', f[1]);
  root.style.setProperty('--font-display', f[2] || f[1]);
  root.style.setProperty('--ui-zoom', String(clamp(+st.uiScale || 1, 0.8, 1.3)));
  root.style.setProperty('--radius', `${clamp(+st.radius, 0, 28)}px`);
  root.style.setProperty('--gap', `${clamp(+st.pageGap, 0, 24)}px`);
  root.style.setProperty('--tab-h', `${TAB_HEIGHTS[st.tabDensity] || 34}px`);
  b.classList.toggle('reduce-motion', !!st.reduceMotion);
  const anim = st.reduceMotion ? 'off' : (st.animations || 'smooth');
  for (const a of ['off', 'smooth', 'playful', 'custom']) b.classList.toggle(`anim-${a}`, anim === a);
  const mo = motionOf();
  b.style.setProperty('--ease-ui', `cubic-bezier(${mo.curve.join(', ')})`);
  b.style.setProperty('--dur', `${mo.ms}ms`);
  b.classList.toggle('hide-nav', !st.showNav);
  b.classList.toggle('hide-reload', !st.showReload);
  b.classList.toggle('hide-copy', !st.showCopy);
  b.classList.toggle('hide-shield', !st.showShield);
  b.classList.toggle('url-left', st.urlAlign === 'left');
  let style = document.getElementById('otoMods');
  if (!style) { style = document.createElement('style'); style.id = 'otoMods'; document.head.append(style); }
  const mods = st.mods || {};
  style.textContent = `${MODS.filter((m) => mods[m.id]).map((m) => m.css).join('\n')}\n/* your CSS */\n${st.userCss || ''}`;
  if ($('#empty') && !$('#empty').classList.contains('gone')) updateClock();
  updateOverlay();
}

// ================================================================ motion: curve editor + live preview
const MOTION_PRESETS = {
  smooth: { name: 'Smooth', curve: [0.2, 0.8, 0.2, 1], ms: 280 },
  playful: { name: 'Playful', curve: [0.34, 1.56, 0.64, 1], ms: 420 },
  snappy: { name: 'Snappy', curve: [0.16, 1, 0.3, 1], ms: 200 },
  gentle: { name: 'Gentle', curve: [0.45, 0, 0.25, 1], ms: 450 },
  bouncy: { name: 'Bouncy', curve: [0.68, -0.55, 0.27, 1.55], ms: 560 },
  linear: { name: 'Linear', curve: [0, 0, 1, 1], ms: 250 },
};
function motionOf() {
  const st = S.settings;
  const p = MOTION_PRESETS[st.animations];
  if (p && st.animations !== 'custom') return { curve: p.curve, ms: p.ms };
  const c = Array.isArray(st.animCurve) && st.animCurve.length === 4 ? st.animCurve.map(Number) : MOTION_PRESETS.smooth.curve;
  return { curve: c, ms: clamp(+st.animDuration || 280, 80, 1500) };
}
let previewTimer = null;
function stopMotionPreview() { clearTimeout(previewTimer); previewTimer = null; }

function motionEditor() {
  const st = S.settings;
  const mo = motionOf();
  let [x1, y1, x2, y2] = mo.curve;
  // drawing area: x 0..1 across, y from -0.5 (below the bottom line) to 1.5 (above the top line)
  const W = 260, H = 260, PX = 30, X0 = PX, X1 = W - PX, YT = 1.5, YB = -0.5;
  const px = (x) => X0 + x * (X1 - X0);
  const py = (y) => 20 + ((YT - y) / (YT - YB)) * (H - 40);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'curve-svg' });
  svg.append(
    el('line', { x1: px(0) - 14, y1: py(1), x2: px(1) + 14, y2: py(1), class: 'curve-rail' }),
    el('line', { x1: px(0) - 14, y1: py(0), x2: px(1) + 14, y2: py(0), class: 'curve-rail' }),
  );
  const h1 = el('line', { class: 'curve-arm' });
  const h2 = el('line', { class: 'curve-arm' });
  const path = el('path', { class: 'curve-path' });
  const k1 = el('circle', { r: 9, class: 'curve-knob' });
  const k2 = el('circle', { r: 9, class: 'curve-knob' });
  svg.append(h1, h2, path, el('circle', { cx: px(0), cy: py(0), r: 4, class: 'curve-end' }), el('circle', { cx: px(1), cy: py(1), r: 4, class: 'curve-end' }), k1, k2);
  const readout = h('code', { class: 'curve-code' });

  const draw = () => {
    path.setAttribute('d', `M ${px(0)} ${py(0)} C ${px(x1)} ${py(y1)}, ${px(x2)} ${py(y2)}, ${px(1)} ${py(1)}`);
    h1.setAttribute('x1', px(0)); h1.setAttribute('y1', py(0)); h1.setAttribute('x2', px(x1)); h1.setAttribute('y2', py(y1));
    h2.setAttribute('x1', px(1)); h2.setAttribute('y1', py(1)); h2.setAttribute('x2', px(x2)); h2.setAttribute('y2', py(y2));
    k1.setAttribute('cx', px(x1)); k1.setAttribute('cy', py(y1));
    k2.setAttribute('cx', px(x2)); k2.setAttribute('cy', py(y2));
    readout.textContent = `cubic-bezier(${[x1, y1, x2, y2].join(', ')})`;
  };
  const commit = () => {
    st.animCurve = [x1, y1, x2, y2];
    st.animations = 'custom';
    st.reduceMotion = false;
    applyCustomization();
    save();
    markPreset();
  };
  const dragKnob = (knob, which) => {
    knob.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { knob.setPointerCapture(e.pointerId); } catch {}
      knob.classList.add('dragging');
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const sx = (ev.clientX - r.left) * (W / r.width);
        const sy = (ev.clientY - r.top) * (H / r.height);
        const x = Math.round(clamp((sx - X0) / (X1 - X0), 0, 1) * 100) / 100;
        const y = Math.round(clamp(YT - ((sy - 20) / (H - 40)) * (YT - YB), YB, YT) * 100) / 100;
        if (which === 1) { x1 = x; y1 = y; } else { x2 = x; y2 = y; }
        draw();
      };
      const up = () => { knob.classList.remove('dragging'); knob.removeEventListener('pointermove', move); knob.removeEventListener('pointerup', up); commit(); };
      knob.addEventListener('pointermove', move);
      knob.addEventListener('pointerup', up);
    });
  };
  dragKnob(k1, 1); dragKnob(k2, 2);
  draw();

  // presets
  const chips = h('div', { class: 'motion-presets' });
  const markPreset = () => {
    for (const c of chips.children) {
      const p = MOTION_PRESETS[c.dataset.k];
      c.classList.toggle('on', p.curve.every((v, i) => v === [x1, y1, x2, y2][i]) && p.ms === motionOf().ms);
    }
  };
  for (const [k, p] of Object.entries(MOTION_PRESETS)) {
    chips.append(h('button', {
      class: 'chip', 'data-k': k, title: `cubic-bezier(${p.curve.join(', ')}) · ${p.ms} ms`,
      onclick: () => {
        [x1, y1, x2, y2] = p.curve;
        st.animDuration = p.ms;
        speed.querySelector('input').value = p.ms;
        speed.querySelector('.range-val').textContent = `${p.ms} ms`;
        draw(); commit();
      },
    }, p.name));
  }

  const speed = slider(mo.ms, 80, 1200, 10, (v) => `${v} ms`, (v) => { st.animDuration = v; st.animations = 'custom'; applyCustomization(); markPreset(); });

  // live preview: a dot travelling with the curve, and a mini window whose sidebar opens and closes
  const dot = h('span', { class: 'mp-dot' });
  const track = h('div', { class: 'mp-track' }, dot);
  const miniSide = h('span', { class: 'mp-side' });
  const mini = h('div', { class: 'mp-window' }, miniSide, h('span', { class: 'mp-page' }));
  let open = false;
  const tick = () => {
    if (!dot.isConnected) { stopMotionPreview(); return; }
    const m = motionOf();
    const easing = `cubic-bezier(${m.curve.join(', ')})`;
    open = !open;
    dot.animate([{ transform: `translateX(${open ? 0 : 196}px)` }, { transform: `translateX(${open ? 196 : 0}px)` }], { duration: m.ms, easing, fill: 'forwards' });
    miniSide.animate([{ width: open ? '18%' : '46%' }, { width: open ? '46%' : '18%' }], { duration: m.ms, easing, fill: 'forwards' });
    previewTimer = setTimeout(tick, m.ms + 650);
  };
  stopMotionPreview();
  previewTimer = setTimeout(tick, 200);

  markPreset();
  return h('div', { class: 'motion-editor' },
    h('div', { class: 'motion-left' }, svg, readout),
    h('div', { class: 'motion-right' },
      h('div', { class: 'gp-sub' }, 'Presets'), chips,
      h('div', { class: 'gp-sub' }, 'Speed'), speed,
      h('div', { class: 'gp-sub' }, 'Preview'), track, mini,
      h('p', { class: 'set-note' }, 'Drag the two handles to shape how things speed up and slow down. Pull a handle past the lines for a bounce.')));
}

// ================================================================ keyboard shortcuts (remappable)
const COMMANDS = [
  ['newTab', 'New tab / command bar', ['Ctrl+T', 'Ctrl+N', 'Ctrl+K']],
  ['focusUrl', 'Edit address', ['Ctrl+L', 'Alt+D', 'F6']],
  ['closeTab', 'Close tab', ['Ctrl+W', 'Ctrl+F4']],
  ['reopen', 'Reopen closed tab', ['Ctrl+Shift+T']],
  ['nextTab', 'Next tab', ['Ctrl+Tab', 'Ctrl+PageDown']],
  ['prevTab', 'Previous tab', ['Ctrl+Shift+Tab', 'Ctrl+PageUp']],
  ['back', 'Back', ['Alt+ArrowLeft']],
  ['forward', 'Forward', ['Alt+ArrowRight']],
  ['reload', 'Reload', ['Ctrl+R', 'F5']],
  ['hardReload', 'Reload without cache', ['Ctrl+Shift+R', 'Ctrl+F5']],
  ['toggleSidebar', 'Hide / show sidebar', ['Ctrl+B']],
  ['togglePin', 'Pin tab', ['Ctrl+D']],
  ['toggleEssential', 'Add to Essentials', ['Ctrl+Shift+D']],
  ['find', 'Find in page', ['Ctrl+F']],
  ['copyUrl', 'Copy link', ['Ctrl+Shift+C']],
  ['zoomIn', 'Zoom in', ['Ctrl+=', 'Ctrl+Shift+=']],
  ['zoomOut', 'Zoom out', ['Ctrl+-']],
  ['zoomReset', 'Reset zoom', ['Ctrl+0']],
  ['history', 'History', ['Ctrl+H']],
  ['downloads', 'Downloads', ['Ctrl+J']],
  ['library', 'Library', ['Ctrl+Shift+O']],
  ['settings', 'Settings', ['Ctrl+,']],
  ['fullscreen', 'Full screen', ['F11']],
  ['devtools', 'Developer tools', ['F12', 'Ctrl+Shift+I']],
  ['toggleTop', 'Auto-hide top bar on / off', ['Ctrl+Shift+B']],
  ['bookmark', 'Bookmark this page', []],
  ['splitView', 'Split view on / off', ['Ctrl+Shift+S']],
  ['pip', 'Picture in picture', ['Ctrl+Shift+P']],
];
const combosFor = (cmd) => {
  const o = S.settings.keymap || {};
  if (cmd in o) return o[cmd] ? [o[cmd]] : [];
  return (COMMANDS.find((c) => c[0] === cmd) || [, , []])[2];
};
function keyCombo(e) {
  let k = e.key;
  if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
  else if (/^(Digit|Numpad)\d$/.test(e.code)) k = e.code.slice(-1);
  else if (e.code === 'Equal' || e.code === 'NumpadAdd') k = '=';
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract') k = '-';
  else if (e.code === 'Comma') k = ',';
  return (e.ctrlKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.altKey ? 'Alt+' : '') + k;
}
const prettyCombo = (c) => c.replace(/\+/g, ' ').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace(/ = ?$/, ' =');
let recording = null;
function startRecording(cmd) {
  stopRecording();
  recording = cmd;
  oto.pauseKeys(true);
  renderSettings();
  const onKey = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    if (e.key === 'Escape') { stopRecording(); renderSettings(); return; }
    const km = { ...(S.settings.keymap || {}) };
    if (e.key === 'Backspace' || e.key === 'Delete') km[cmd] = '';
    else {
      const combo = keyCombo(e);
      if (!/^(Ctrl|Alt|F\d+)/.test(combo)) { toast('Use Ctrl, Alt or a function key', { timeout: 1600 }); return; }
      // Take the combo away from any other command that had it.
      for (const [other] of COMMANDS) {
        if (other === cmd || !combosFor(other).includes(combo)) continue;
        const rest = combosFor(other).filter((c) => c !== combo);
        km[other] = rest[0] || '';
      }
      km[cmd] = combo;
    }
    S.settings.keymap = km;
    save(); syncMainSettings();
    stopRecording(); renderSettings();
  };
  window.addEventListener('keydown', onKey, true);
  recording = { cmd, onKey };
}
function stopRecording() {
  if (recording && recording.onKey) window.removeEventListener('keydown', recording.onKey, true);
  recording = null;
  oto.pauseKeys(false);
}

// ================================================================ settings window
let settingsTab = 'general';
let boostEdit = null;
let perfTimer = null;
let needsRestart = false;
const PAGES = [
  ['general', 'General', 'settings'],
  ['appearance', 'Appearance', 'palette'],
  ['sidebar', 'Sidebar', 'sidebar'],
  ['newtab', 'New tab', 'plus'],
  ['search', 'Search', 'search'],
  ['tabs', 'Tabs', 'tab'],
  ['performance', 'Performance', 'reload'],
  ['privacy', 'Privacy', 'shield'],
  ['extensions', 'Extensions', 'bolt'],
  ['bookmarks', 'Bookmarks', 'star'],
  ['boosts', 'Boosts', 'edit'],
  ['mods', 'Mods', 'sidebar'],
  ['archive', 'Archive', 'clock'],
  ['icon', 'App icon', 'star'],
  ['shortcuts', 'Shortcuts', 'code'],
  ['about', 'About', 'globe'],
];

function openSettings(tab) {
  closeCmd(false); closeMenu();
  if (tab) settingsTab = tab;
  boostEdit = null;
  renderSettings();
  $('#settings').hidden = false;
  updateOverlay();
}
function closeSettings() {
  stopRecording();
  stopMotionPreview();
  clearInterval(perfTimer); perfTimer = null;
  $('#settings').hidden = true;
  updateOverlay();
  const v = activeView();
  if (v) focusView(v);
}

function seg(options, value, onPick) {
  return h('div', { class: 'seg' }, ...options.map(([val, label]) =>
    h('button', { class: val === value ? 'on' : '', onclick: () => { onPick(val); renderSettings(); } }, label)));
}
function sw(on, onToggle) {
  return h('button', { class: `switch${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(on), onclick: () => { onToggle(!on); renderSettings(); } });
}
function row(label, sub, control) {
  return h('div', { class: 'set-row' }, h('div', { class: 'lbl' }, h('span', {}, label), sub ? h('small', {}, sub) : null), control);
}
function select(options, value, onPick) {
  return h('select', { onchange: (e) => { onPick(e.target.value); renderSettings(); } },
    ...options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
}
function slider(value, min, max, step, fmt, onInput) {
  const out = h('span', { class: 'range-val' }, fmt(value));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { out.textContent = fmt(+input.value); onInput(+input.value); });
  input.addEventListener('change', () => save());
  return h('div', { class: 'range' }, input, out);
}
function textInput(value, placeholder, onChange, attrs = {}) {
  const el = h('input', { class: 'text', value: value || '', placeholder, spellcheck: 'false', ...attrs });
  el.addEventListener('change', () => onChange(el.value.trim()));
  return el;
}
const section = (title, ...kids) => h('div', { class: 'set-section' }, title ? h('h4', {}, title) : null, ...kids);
function setPref(key, val) {
  S.settings[key] = val;
  save();
  syncMainSettings();
}
const setLook = (key) => (val) => { S.settings[key] = val; applyCustomization(); save(); };
function syncMainSettings() {
  const st = S.settings;
  oto.syncSettings({ downloadsAsk: !!st.downloadsAsk, gpc: !!st.gpc, clearOnExit: !!st.clearOnExit, autoUpdate: st.autoUpdate !== false, updateChannel: st.updateChannel || 'stable', v1Menu: st.v1Menu !== false, keymap: st.keymap || {} });
}

const PERF_PRESETS = {
  balanced: { name: 'Balanced', desc: 'Sleep after 1 hour, freeze after 5 minutes', set: { unloadAfter: '1h', freezeAfter: '5m' } },
  lean: { name: 'Low memory', desc: 'Sleep after 15 minutes, freeze after 1 minute', set: { unloadAfter: '15m', freezeAfter: '1m' } },
  off: { name: 'Keep everything running', desc: 'Never sleep or freeze tabs', set: { unloadAfter: 'never', freezeAfter: 'never' } },
};
const activePreset = () => Object.entries(PERF_PRESETS).find(([, p]) => Object.entries(p.set).every(([k, v]) => S.settings[k] === v))?.[0];

const PAGE_RENDER = {
  general() {
    const st = S.settings;
    return [
      section('Default browser',
        row('Make Oto your default browser', 'Opens Windows Settings — choose Oto for web links.',
          h('button', { class: 'btn', onclick: async () => { const r = await oto.makeDefaultBrowser(); if (r === 'set') toast('Oto is now your default browser'); } }, 'Set as default'))),
      section('Startup',
        row('When Oto starts', null, seg([['continue', 'Continue where I left off'], ['fresh', 'Start fresh']], st.startup, (v) => setPref('startup', v))),
        h('p', { class: 'set-note' }, 'Start fresh moves your unpinned tabs to the Archive on launch. Pinned tabs and Essentials stay.')),
      section('Downloads',
        row('Ask where to save each file', 'Otherwise files go straight to your Downloads folder.', sw(st.downloadsAsk, (on) => setPref('downloadsAsk', on))),
        row('When a download starts', 'What flies from your cursor into the downloads button.', seg([['file', 'A little file'], ['orb', 'Glowing orb'], ['off', 'Nothing']], st.dlAnim || 'file', (v) => { setPref('dlAnim', v); if (v !== 'off') setTimeout(() => dlFly({ x: innerWidth / 2, y: innerHeight / 2 }, 'preview.zip'), 80); })),
        row('Downloads button icon', null, h('div', { class: 'seg arrow-seg dlicon-seg' }, ...Object.keys(DL_ICONS).map((k) => h('button', {
          class: (st.dlIcon || 'tray') === k ? 'on' : '', title: k[0].toUpperCase() + k.slice(1), html: DL_ICONS[k],
          onclick: () => { setPref('dlIcon', k); renderDlButton(); renderSettings(); },
        }))))),
    ];
  },

  appearance() {
    const st = S.settings;
    return [
      section('Theme',
        row('Theme', 'Oto’s look: near-black, editorial, with serif headings, small mono labels and a cream highlight.', h('div', { class: 'skin-picks' }, ...Object.entries(SKINS).map(([k, l]) => h('button', {
          class: `skin-pick sk-${k}${skinOf() === k ? ' on' : ''}`, onclick: () => { setPref('skin', k); applyTheme(); renderSettings(); },
        }, h('span', { class: 'sp-art' }, h('i'), h('i'), h('i')), h('b', {}, l))))),
        skinIsRt() ? null : row('Appearance', 'Websites follow this too, where they support it.', seg([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], st.theme, setTheme)),
        row('Space colours', 'Each space has its own gradient. Right-click a space dot to change it.',
          h('button', { class: 'btn', onclick: () => { closeSettings(); openWsDialog(currentWs(), { focusColours: true }); } }, 'Change colours'))),
      section('Text & size',
        row('Interface font', 'Only changes Oto itself, not websites.', select(Object.entries(UI_FONTS).map(([k, f]) => [k, f[0]]), st.uiFont, setLook('uiFont'))),
        row('Interface size', null, slider(st.uiScale, 0.8, 1.3, 0.05, (v) => `${Math.round(v * 100)}%`, setLook('uiScale'))),
        row('Tab height', null, seg([['compact', 'Compact'], ['default', 'Default'], ['roomy', 'Roomy']], st.tabDensity, setLook('tabDensity')))),
      section('Layout',
        row('Toolbar', 'Zen puts back/forward and the address in the sidebar. Classic keeps them along the top.',
          seg([['single', 'Zen'], ['top', 'Classic']], st.toolbarLayout, (v) => { setPref('toolbarLayout', v); applyLayout(); updateChrome(); })),
        row('Auto-hide the top bar', 'It slides away; move your mouse to the top edge to bring it back. (Ctrl+Shift+B)', sw(st.autohideTop, (on) => { setPref('autohideTop', on); applyLayout(); })),
        row('Bookmarks bar', null, sw(st.showBookmarks, (on) => { setPref('showBookmarks', on); applyLayout(); })),
        row('Sidebar', 'Width, icon strip, snapping and hover timing have their own page.', h('button', { class: 'btn', onclick: () => { settingsTab = 'sidebar'; renderSettings(); } }, 'Sidebar settings')),
        row('Page style', 'Floating gives pages a margin and shadow, like Zen and Arc.', seg([['floating', 'Floating'], ['flat', 'Edge to edge']], st.pageStyle, (v) => { setPref('pageStyle', v); applyLayout(); })),
        row('Page corners', null, slider(st.radius, 0, 28, 1, (v) => (v ? `${v}px` : 'Square'), setLook('radius'))),
        row('Space around pages', null, slider(st.pageGap, 0, 24, 1, (v) => `${v}px`, setLook('pageGap')))),
      section('Motion',
        row('Animations', 'How the sidebar, top bar, snaps, tabs and menus move.', seg([['off', 'Off'], ['smooth', 'Smooth'], ['playful', 'Playful'], ['custom', 'Custom']], st.reduceMotion ? 'off' : st.animations,
          (v) => {
            S.settings.reduceMotion = v === 'off';
            S.settings.animations = v;
            if (MOTION_PRESETS[v]) { S.settings.animCurve = [...MOTION_PRESETS[v].curve]; S.settings.animDuration = MOTION_PRESETS[v].ms; }
            applyCustomization(); save();
          })),
        st.reduceMotion || st.animations === 'off' ? null : motionEditor()),
      section('Toolbar',
        row('Address bar (classic layout)', null, seg([['center', 'Centred'], ['left', 'Full width']], st.urlAlign, setLook('urlAlign'))),
        row('Address shows', null, seg([['domain', 'Domain'], ['path', 'Domain + path'], ['full', 'Full URL']], st.urlDisplay, (v) => { setPref('urlDisplay', v); updateChrome(); })),
        row('Back & forward buttons', null, sw(st.showNav, setLook('showNav'))),
        row('Reload button', null, sw(st.showReload, setLook('showReload'))),
        row('Tracker counter', null, sw(st.showShield, setLook('showShield'))),
        ),
    ];
  },

  sidebar() {
    const st = S.settings;
    const mode = st.compact ? 'hidden' : st.collapsed ? 'collapsed' : 'expanded';
    const live = (key, after) => (v) => { S.settings[key] = v; applyLayout(); if (after) after(v); };
    return [
      section('Mode',
        row('Sidebar', 'Collapsed shows just icons and grows when you hover it. Hidden tucks it away until you touch the screen edge. (Ctrl+B)',
          seg([['expanded', 'Expanded'], ['collapsed', 'Collapsed'], ['hidden', 'Hidden']], mode, (v) => { setSidebarMode(v); save(); })),
        row('Position', null, seg([['left', 'Left'], ['right', 'Right']], st.sidebarSide, (v) => { setPref('sidebarSide', v); applyLayout(); })),
        row('When collapsed or hidden', 'Zen keeps back/forward and the address in the sidebar — they appear when it slides open. Or move them to the top bar so they’re always visible.',
          seg([['sidebar', 'Keep Zen layout'], ['top', 'Move to top bar']], st.navWhenCollapsed || 'sidebar', (v) => { setPref('navWhenCollapsed', v); applyLayout(); updateChrome(); }))),
      section('Space header',
        row('Arrow next to the space name', null, h('div', { class: 'seg arrow-seg' }, ...Object.keys(SPACE_ARROWS).map((k) => h('button', {
          class: (st.spaceArrow || 'chevron') === k ? 'on' : '', title: k[0].toUpperCase() + k.slice(1),
          html: SPACE_ARROWS[k] || 'None', onclick: () => { setPref('spaceArrow', k); applySpaceArrow(); renderSettings(); },
        })))),
        row('Arrow colour', null, seg([['text', 'Like the text'], ['accent', 'Accent colour']], st.spaceArrowColor || 'text', (v) => { setPref('spaceArrowColor', v); applySpaceArrow(); })),
        row('Space switcher at the bottom', 'The dots and + under your tabs. Without it, switch spaces with Ctrl+Shift+1…9, the command bar (Ctrl+T) or Library → Spaces.', sw(!!st.showSpaceSwitcher, (on) => { setPref('showSpaceSwitcher', on); render(); })),
        row('“New space” in the space menu', 'Adds New space… to the menu when you click the space name.', sw(!!st.spaceMenuNew, (on) => setPref('spaceMenuNew', on))),
                row('Space icon', 'Use an emoji or your own image file — right-click a space → Edit space, or press the button.', h('button', { class: 'btn', onclick: () => { closeSettings(); openWsDialog(currentWs()); } }, 'Edit this space'))),
      section('Size',
        row('Width', 'You can also drag the sidebar’s edge.', slider(clamp(st.sidebarWidth, st.snapRail, 420), clamp(+st.snapRail || 150, 100, 240), 420, 2, (v) => `${v}px`, live('sidebarWidth'))),
        row('Icon strip width', 'How small the collapsed sidebar is.', slider(st.railWidth, 40, 96, 2, (v) => `${v}px`, live('railWidth')))),
      section('Snapping (when you drag the edge)',
        row('Snap to icons when narrower than', 'Lower it to keep a narrow sidebar without snapping.', slider(st.snapRail, 100, 240, 5, (v) => `${v}px`, live('snapRail'))),
        row('Hide completely when narrower than', 'Set to 0 to never hide by dragging.', slider(st.snapHide, 0, 80, 2, (v) => (v ? `${v}px` : 'Never'), live('snapHide')))),
      section('Hover (collapsed and hidden modes)',
        row('Open after hovering for', null, slider(st.hoverDelay, 0, 800, 10, (v) => (v ? `${v} ms` : 'Instantly'), live('hoverDelay'))),
        row('Stay open', 'Keep it open until you click the page or press Esc, instead of closing when the mouse leaves.', sw(st.stayOpen, (on) => setPref('stayOpen', on))),
        st.stayOpen ? null : row('Go back after the mouse leaves', null, slider(st.closeDelay, 50, 3000, 50, (v) => (v < 1000 ? `${v} ms` : `${(v / 1000).toFixed(1)} s`), live('closeDelay')))),
      h('div', { class: 'set-actions' }, h('button', {
        class: 'btn', onclick: () => {
          Object.assign(S.settings, { sidebarWidth: 256, railWidth: 52, snapRail: 150, snapHide: 26, hoverDelay: 110, closeDelay: 260, stayOpen: false });
          applyLayout(); save(); renderSettings();
        },
      }, 'Reset sidebar settings')),
    ];
  },

  newtab() {
    const st = S.settings;
    const look = (k) => (v) => { S.settings[k] = v; save(); updateClock(); };
    return [
      h('p', { class: 'set-lead' }, 'What you see when a space has no open tabs.'),
      section('Clock',
        row('Show clock', null, sw(st.showClock, look('showClock'))),
        row('Format', null, seg([['auto', 'Automatic'], ['12h', '12-hour'], ['24h', '24-hour']], st.clockFormat, look('clockFormat')))),
      section('Greeting',
        row('Show greeting', null, sw(st.showGreeting, look('showGreeting'))),
        row('Your name', 'Shown as “Good evening, name”.', textInput(st.userName, 'Optional', look('userName'), { maxlength: 30 }))),
      section('Extras',
        row('Show shortcut hints', null, sw(st.showHints, look('showHints')))),
    ];
  },

  search() {
    const st = S.settings;
    const list = st.searchShortcuts || [];
    const engines = [...Object.entries(ENGINES).map(([k, e]) => [k, e.name]), ...list.map((x) => [`sc:${x.key}`, `${x.name} (shortcut)`])];
    const draft = { key: '', name: '', url: '' };
    return [
      section('Default search',
        row('Search engine', 'Pick a built-in engine or any of your shortcuts below.', select(engines, st.engine, (v) => setPref('engine', v))),
        row('Search suggestions', 'Sends what you type to your search engine as you type.', sw(st.suggestions, (on) => setPref('suggestions', on)))),
      section('Search shortcuts',
        h('p', { class: 'set-note' }, 'Type a keyword, a space, then your search in the command bar — e.g. “yt lofi beats” searches YouTube. Use %s where the search goes.'),
        ...list.map((x, i) => h('div', { class: 'sc-row' },
          h('kbd', {}, x.key), h('span', { class: 'ph' }, h('b', {}, x.name), h('small', {}, x.url)),
          h('button', { class: 'icon-btn sm', title: 'Remove', html: icon('x'), onclick: () => { list.splice(i, 1); setPref('searchShortcuts', [...list]); renderSettings(); } }))),
        h('div', { class: 'sc-add' },
          textInput('', 'Keyword', (v) => { draft.key = v; }, { maxlength: 12 }),
          textInput('', 'Name', (v) => { draft.name = v; }),
          textInput('', 'https://example.com/search?q=%s', (v) => { draft.url = v; }),
          h('button', {
            class: 'btn', onclick: (e) => {
              const box = e.currentTarget.parentElement;
              const [k, n, u] = [...box.querySelectorAll('input')].map((x) => x.value.trim());
              if (!k || !u.includes('%s') || !/^https?:\/\//.test(u)) { toast('Add a keyword and a URL containing %s', { timeout: 2000 }); return; }
              setPref('searchShortcuts', [...list.filter((x) => x.key !== k), { key: k, name: n || k, url: u }]);
              renderSettings();
            },
          }, 'Add'))),
    ];
  },

  tabs() {
    const st = S.settings;
    return [
      section('Archive',
        row('Archive unpinned tabs after', 'Like Arc: tabs you haven’t opened in a while are tidied away. Find them in the Archive.',
          select([['never', 'Never'], ['12h', '12 hours'], ['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days']], st.archiveAfter, (v) => { setPref('archiveAfter', v); housekeeping(); }))),
      section('Behaviour',
        row('Open new tabs', null, seg([['top', 'At the top'], ['next', 'Below current'], ['bottom', 'At the bottom']], st.newTabPos, (v) => setPref('newTabPos', v))),
        row('Ctrl+Tab switches to', null, seg([['order', 'Next in sidebar'], ['recent', 'Last used tab']], st.tabCycle, (v) => setPref('tabCycle', v)))),
      section('Glance & split view',
        row('Open links in Glance', 'Glance shows a link in a floating window over the page — open it as a tab or in split view from there. You can always right-click a link → Open link in Glance.',
          seg([['off', 'Never'], ['alt', 'Alt + click'], ['external', 'Links to other sites'], ['click', 'Every link']], glanceMode(), (v) => { setPref('glanceMode', v); applyGlanceMode(); })),
        h('p', { class: 'set-note' }, glanceMode() === 'external' ? 'Links within the same site — like another YouTube video — open normally. Only links that take you to a different site open in Glance.'
          : glanceMode() === 'click' ? 'Every link you click opens in Glance, even ones on the same site.' : glanceMode() === 'alt' ? 'Hold Alt to see which link will open, then click it.' : 'Clicking a link just opens it.'),
        row('Split view', 'Two tabs side by side. Right-click a tab → Split with current tab, or press Ctrl+Shift+S.', h('button', { class: 'btn', onclick: () => { closeSettings(); toggleSplit(); } }, splitShowing() ? 'Close split view' : 'Split now'))),
    ];
  },

  performance() {
    const st = S.settings;
    const cur = activePreset();
    const tm = h('div', { class: 'tm' }, h('p', { class: 'set-note' }, 'Measuring…'));
    const refresh = async () => {
      if (settingsTab !== 'performance' || $('#settings').hidden) { clearInterval(perfTimer); perfTimer = null; return; }
      const { procs, pages } = await oto.metrics();
      const byPid = new Map(procs.map((p) => [p.pid, p]));
      const rows = [];
      const used = new Set();
      for (const pg of pages) {
        const id = wcToTab.get(pg.wcId);
        const t = id && tabById(id);
        const p = byPid.get(pg.pid);
        if (!t || !p || used.has(p.pid)) continue;
        used.add(p.pid);
        rows.push({ t, name: t.title || prettyUrl(t.url), mem: p.mem, cpu: p.cpu, v: V.get(id) });
      }
      const sys = { Browser: 'Oto (main)', GPU: 'Graphics', Utility: 'Services', Tab: 'Oto interface & helpers' };
      const other = {};
      for (const p of procs) {
        if (used.has(p.pid)) continue;
        const k = sys[p.type] || p.type;
        other[k] = other[k] || { mem: 0, cpu: 0 };
        other[k].mem += p.mem; other[k].cpu += p.cpu;
      }
      const total = procs.reduce((a, p) => a + p.mem, 0);
      const totalCpu = procs.reduce((a, p) => a + p.cpu, 0);
      rows.sort((a, b) => b.mem - a.mem);
      const sleeping = S.tabs.filter((t) => !V.has(t.id)).length;
      tm.replaceChildren(
        h('div', { class: 'tm-total' },
          h('div', {}, h('b', {}, `${total} MB`), h('small', {}, 'memory')),
          h('div', {}, h('b', {}, `${Math.round(totalCpu)}%`), h('small', {}, 'CPU')),
          h('div', {}, h('b', {}, String(rows.length)), h('small', {}, 'pages running')),
          h('div', {}, h('b', {}, String(sleeping)), h('small', {}, 'tabs sleeping'))),
        h('div', { class: 'tm-head' }, h('span', {}, 'Page'), h('span', {}, 'Memory'), h('span', {}, 'CPU'), h('span', {})),
        ...rows.map((r) => h('div', { class: 'tm-row' },
          h('span', { class: 'tm-name' }, favEl(r.t, null, true), h('span', {}, r.name), r.v && r.v.frozen ? h('em', { class: 'tag' }, 'frozen') : null),
          h('span', {}, `${r.mem} MB`), h('span', {}, `${r.cpu}%`),
          isActiveAnywhere(r.t.id) ? h('span', { class: 'tm-act muted' }, 'open') :
            h('button', { class: 'btn sm', onclick: () => { unloadTab(r.t.id); refresh(); } }, 'Sleep'))),
        ...Object.entries(other).map(([k, o]) => h('div', { class: 'tm-row sys' },
          h('span', { class: 'tm-name' }, iconEl('settings'), h('span', {}, k)), h('span', {}, `${o.mem} MB`), h('span', {}, `${Math.round(o.cpu * 10) / 10}%`), h('span', {}))),
      );
    };
    clearInterval(perfTimer);
    perfTimer = setInterval(refresh, 2000);
    setTimeout(refresh, 0);
    return [
      section('Mode',
        h('div', { class: 'preset-row' }, ...Object.entries(PERF_PRESETS).map(([k, p]) => h('button', {
          class: `preset${cur === k ? ' on' : ''}`,
          onclick: () => { Object.assign(S.settings, p.set); applyCustomization(); save(); if (k === 'off') thawAll(); housekeeping(); renderSettings(); },
        }, h('b', {}, p.name), h('small', {}, p.desc))))),
      section('Tabs in the background',
        row('Freeze background tabs after', 'Frozen tabs stop using CPU completely and wake up instantly when you open them. Tabs playing sound are never frozen.',
          select([['never', 'Never'], ['1m', '1 minute'], ['5m', '5 minutes'], ['15m', '15 minutes']], st.freezeAfter, (v) => { setPref('freezeAfter', v); if (v === 'never') thawAll(); })),
        row('Put tabs to sleep after', 'Sleeping tabs free their memory and reload when you click them.',
          select([['never', 'Never'], ['15m', '15 minutes'], ['1h', '1 hour'], ['4h', '4 hours']], st.unloadAfter, (v) => { setPref('unloadAfter', v); housekeeping(); }))),
      section('Interface',
        row('Reduce animations', 'Turns off Oto’s own animations.', sw(st.reduceMotion, setLook('reduceMotion')))),
      section('Engine (restart needed)',
        row('Use hardware acceleration', 'Uses your graphics card for smoother video and scrolling. Turn off if you see glitches or black screens.', sw(st.hwAccel !== false, (on) => { setPref('hwAccel', on); needsRestart = true; })),
        row('Smooth scrolling', 'Off makes scrolling snap instantly and uses slightly less CPU.', sw(st.smoothScroll !== false, (on) => { setPref('smoothScroll', on); needsRestart = true; })),
        needsRestart ? h('div', { class: 'restart-bar' }, h('span', {}, 'Restart Oto to apply these changes.'), h('button', { class: 'btn primary', onclick: () => { save(); oto.saveStateSync(persistable()); oto.relaunch(); } }, 'Restart now')) : null),
      section('Task manager', tm),
    ];
  },

  privacy() {
    const st = S.settings;
    const permBox = h('div', { class: 'perm-list' }, h('p', { class: 'set-note' }, 'Loading…'));
    oto.listPermissions().then((perms) => {
      const keys = Object.keys(perms || {});
      if (!keys.length) { permBox.replaceChildren(h('p', { class: 'set-note' }, 'No sites have asked for permissions yet.')); return; }
      permBox.replaceChildren(...keys.sort().map((key) => {
        const [origin, perm] = key.split('|');
        const label = permLabel({ permission: perm, mediaTypes: ['audio', 'video'] });
        return h('div', { class: 'perm-row' },
          h('span', { class: 'ph' }, h('b', {}, hostOf(origin) || origin), h('small', {}, label)),
          h('span', { class: `perm-state ${perms[key] ? 'ok' : 'no'}` }, perms[key] ? 'Allowed' : 'Blocked'),
          h('button', { class: 'icon-btn sm', title: 'Forget — ask again next time', html: icon('x'), onclick: async () => { await oto.resetPermission(key); renderSettings(); } }));
      }));
    });
    return [
      section('Passwords',
        row('Offer to save passwords', 'When you log in to a site, Oto asks whether to save the password (encrypted on this PC).', sw(st.pwOffer !== false, (on) => setPref('pwOffer', on))),
        row('Show saved logins when you click a login box', 'Pick an account to fill it in.', sw(st.pwFill !== false, (on) => setPref('pwFill', on))),
        row('Saved passwords', 'See, edit, import or export them in the Library.', h('button', { class: 'btn', onclick: () => { closeSettings(); openLibrary('passwords'); } }, 'Manage passwords'))),
      section('Tracking',
        row('Block ads & trackers', INFO.blocking === 'basic' ? 'Using the built-in list (full lists load when online).' : 'EasyList & EasyPrivacy, the same lists uBlock Origin uses.',
          sw(st.blockTrackers, async (on) => {
            setPref('blockTrackers', on);
            INFO.blocking = await oto.setBlocking(on);
            updateChrome(); renderSettings();
            toast(on ? 'Blocking on — reload pages to apply' : 'Blocking off', { icon: 'shield', timeout: 1800 });
          })),
        row('Ask sites not to sell or share my data', 'Sends the Global Privacy Control and Do Not Track signals.', sw(st.gpc, (on) => setPref('gpc', on)))),
      section('Site permissions', permBox),
      section('Browsing data',
        row('Clear cookies & site data when Oto closes', 'You’ll be signed out of websites each time.', sw(st.clearOnExit, (on) => setPref('clearOnExit', on))),
        row('Clear history', `${S.history.length} pages visited`, h('button', { class: 'btn', onclick: () => { S.history = []; save(); renderSettings(); toast('History cleared', { timeout: 1500 }); } }, 'Clear history')),
        row('Clear all browsing data', 'Cookies, cache, site permissions and history.', h('button', {
          class: 'btn danger', onclick: async () => {
            if (!confirm('Clear cookies, cache, site permissions and history? You’ll be signed out of websites.')) return;
            await oto.clearData();
            S.history = []; save(); renderSettings();
            toast('Browsing data cleared', { icon: 'trash' });
          },
        }, 'Clear…'))),
    ];
  },

  extensions() {
    const listBox = h('div', {}, h('p', { class: 'set-note' }, 'Loading…'));
    oto.extList().then((exts) => {
      if (!exts.length) { listBox.replaceChildren(h('div', { class: 'empty-note' }, iconEl('bolt'), h('span', {}, 'No extensions yet. Get some from the Chrome Web Store below.'))); return; }
      listBox.replaceChildren(...exts.map((x) => h('div', { class: 'ext-row' },
        (() => { const img = h('img', { src: x.icon || `crx://extension-icon/${x.id}/32/2?partition=persist%3Aoto`, alt: '' }); img.addEventListener('error', () => img.replaceWith(h('span', { class: 'ext-ic', html: icon('bolt') })), { once: true }); return img; })(),
        h('span', { class: 'ph' }, h('b', {}, `${x.name}`), h('small', {}, `${x.version}${x.source === 'store' ? ' · Chrome Web Store' : ' · from file'}${x.description ? ` · ${x.description}` : ''}`)),
        x.options ? h('button', { class: 'btn sm', onclick: () => { closeSettings(); newTab(`chrome-extension://${x.id}/${x.options.replace(/^\//, '')}`); } }, 'Options') : null,
        h('button', {
          class: 'icon-btn sm', title: 'Remove', html: icon('trash'),
          onclick: async () => { if (!confirm(`Remove “${x.name}”?`)) return; await oto.extRemove(x.id); renderSettings(); toast(`Removed ${x.name}`, { timeout: 1500 }); },
        }))));
    });
    const store = (url) => () => { closeSettings(); newTab(url); };
    const fromFile = async (fn) => {
      const r = await fn();
      if (r.ok) { toast(`Added ${r.name}`, { icon: 'bolt' }); renderSettings(); } else if (r.error) toast(`Couldn’t add it — ${r.error}`, { timeout: 4000 });
    };
    return [
      h('p', { class: 'set-lead' }, 'Oto runs Chrome extensions. Opera add-ons are the same kind, and most Firefox add-ons also have a Chrome version.'),
      section('Get extensions', h('div', { class: 'get-ext' },
        h('button', { onclick: store('https://chromewebstore.google.com/category/extensions') }, h('b', {}, 'Chrome Web Store'), h('small', {}, 'Click “Add to Chrome” on any extension — it installs into Oto.')),
        h('button', { onclick: store('https://addons.opera.com/extensions/') }, h('b', {}, 'Opera add-ons'), h('small', {}, 'Most are also on the Chrome Web Store. Have a .crx file? Use “Add from file”.')),
        h('button', { onclick: store('https://addons.mozilla.org/firefox/extensions/') }, h('b', {}, 'Firefox add-ons'), h('small', {}, 'Click “Download file” on an add-on’s page, then “Add from file”.'))),
      h('div', { class: 'set-actions', style: 'margin-top:10px' },
        h('button', { class: 'btn', onclick: () => fromFile(oto.extInstallFile) }, 'Add from file (.crx, .xpi, .zip)'),
        h('button', { class: 'btn', onclick: () => fromFile(oto.extLoadFolder) }, 'Load unpacked folder'))),
      section('Installed', listBox),
      h('p', { class: 'set-note' }, 'Pinned extension buttons appear in the top bar, next to the window buttons. Firefox-only add-ons that rely on Firefox features may not work.'),
    ];
  },

  bookmarks() {
    const st = S.settings;
    const srcBox = h('div', { class: 'btn-pair wrap' }, h('span', { class: 'set-note' }, 'Looking for other browsers…'));
    oto.bookmarkSources().then((srcs) => {
      srcBox.replaceChildren(...(srcs.length ? srcs.map((x) => h('button', { class: 'btn', onclick: async () => { await importFromBrowser(x.id, x.name); renderSettings(); } }, x.name))
        : [h('span', { class: 'set-note' }, 'No other browsers found on this PC.')]));
    });
    const htmlInput = h('input', { type: 'file', accept: '.html,.htm', style: 'display:none' });
    htmlInput.addEventListener('change', async () => {
      const f = htmlInput.files[0];
      if (!f) return;
      const tree = parseBookmarkHtml(await f.text());
      if (!tree.length) { toast('No bookmarks found in that file', { timeout: 2000 }); return; }
      mergeImported(tree, f.name.replace(/\.html?$/i, ''));
      renderSettings();
    });
    const rows = [];
    const walk = (list, depth) => {
      for (const b of list) {
        const name = h('input', { class: 'text', value: b.title, spellcheck: 'false', style: 'flex:1' });
        name.addEventListener('change', () => { b.title = name.value.trim() || b.title; save(); renderBookmarks(); });
        rows.push(h('div', { class: `bm-manage-row${depth ? ' child' : ''}`, style: depth ? `padding-left:${6 + depth * 22}px` : '' },
          isFolder(b) ? iconEl('sidebar') : favEl({ url: b.url, title: b.title, favicon: b.favicon }, null, true),
          name,
          h('button', { class: 'icon-btn sm', title: 'Remove', html: icon('x'), onclick: () => { removeBookmark(b.id); save(); renderBookmarks(); updateStar(); renderSettings(); } })));
        if (isFolder(b) && depth < 2) walk(b.children, depth + 1);
      }
    };
    walk(S.bookmarks || [], 0);
    return [
      section('Bookmarks bar',
        row('Show the bookmarks bar', st.toolbarLayout === 'top' ? 'Appears under the top toolbar.' : 'Appears in the top strip, like Zen.', sw(st.showBookmarks, (on) => { setPref('showBookmarks', on); applyLayout(); }))),
      section('Import',
        h('p', { class: 'set-note' }, 'Bring your bookmarks over from another browser on this PC:'),
        srcBox,
        h('div', { class: 'set-actions', style: 'margin-top:8px' },
          h('button', { class: 'btn', onclick: () => htmlInput.click() }, 'Import an HTML bookmarks file…'), htmlInput)),
      section(`Your bookmarks (${allBookmarks().length})`,
        rows.length ? h('div', {}, ...rows) : h('p', { class: 'set-note' }, 'Nothing here yet — click ☆ next to the address to bookmark a page.'),
        rows.length ? h('div', { class: 'set-actions' }, h('button', { class: 'btn danger', onclick: () => { if (confirm('Remove all bookmarks?')) { S.bookmarks = []; save(); renderBookmarks(); updateStar(); renderSettings(); } } }, 'Remove all')) : null),
    ];
  },

  boosts() {
    if (boostEdit) return boostEditor();
    const list = S.boosts || [];
    const cur = activeTab();
    return [
      h('p', { class: 'set-lead' }, 'Boosts restyle any website with your own CSS — hide distractions, change fonts, or force dark mode. They apply automatically every time you visit.'),
      h('div', { class: 'set-actions' },
        h('button', { class: 'btn primary', onclick: () => { boostEdit = { id: null, name: '', host: cur ? hostOf(cur.url) : '', css: BOOST_TEMPLATES[0].css, on: true }; renderSettings(); } }, cur && hostOf(cur.url) ? `New boost for ${hostOf(cur.url)}` : 'New boost')),
      list.length
        ? section('Your boosts', ...list.map((b) => h('div', { class: 'boost-row' },
          h('button', { class: `switch${b.on ? ' on' : ''}`, onclick: () => { b.on = !b.on; save(); reapplyBoosts(); renderSettings(); } }),
          h('span', { class: 'ph' }, h('b', {}, b.name || 'Untitled boost'), h('small', {}, b.host || 'no site')),
          h('button', { class: 'btn', onclick: () => { boostEdit = { ...b }; renderSettings(); } }, 'Edit'),
          h('button', { class: 'icon-btn sm', title: 'Delete', html: icon('trash'), onclick: () => { S.boosts = list.filter((x) => x.id !== b.id); save(); reapplyBoosts(); renderSettings(); } }))))
        : h('div', { class: 'empty-note' }, iconEl('bolt'), h('span', {}, 'No boosts yet. Open a site, then create one here.')),
    ];
  },

  mods() {
    const st = S.settings;
    const mods = st.mods || {};
    const css = h('textarea', { class: 'code', spellcheck: 'false', placeholder: '/* Restyle Oto itself, e.g.\n.tab.active { background: var(--accent-soft); }\n#topbar { height: 40px; } */' });
    css.value = st.userCss || '';
    return [
      h('p', { class: 'set-lead' }, 'Mods change how Oto itself looks — like Zen Mods. Toggle the built-in ones, or write your own CSS below.'),
      section('Built-in mods', h('div', { class: 'mod-grid' }, ...MODS.map((m) => h('div', { class: `mod${mods[m.id] ? ' on' : ''}` },
        h('span', { class: 'ph' }, h('b', {}, m.name), m.desc ? h('small', {}, m.desc) : null),
        h('button', {
          class: `switch${mods[m.id] ? ' on' : ''}`,
          onclick: () => { st.mods = { ...mods, [m.id]: !mods[m.id] }; applyCustomization(); save(); renderSettings(); },
        }))))),
      section('Your CSS (userChrome)',
        h('p', { class: 'set-note' }, 'Useful variables: --accent, --bg, --fg, --card, --radius, --gap, --tab-h, --sbw. Elements: #sidebar, #topbar, .tab, .ess, .url-pill, #content.'),
        css,
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn', onclick: () => { css.value = ''; st.userCss = ''; applyCustomization(); save(); } }, 'Clear'),
          h('button', { class: 'btn primary', onclick: () => { st.userCss = css.value; applyCustomization(); save(); toast('Mods applied', { icon: 'sidebar', timeout: 1200 }); } }, 'Apply'))),
    ];
  },

  archive() {
    const list = S.archive || [];
    if (!list.length) return [h('div', { class: 'empty-note' }, iconEl('clock'), h('span', {}, 'Closed and archived tabs show up here, so nothing is ever really lost.'))];
    const day = (ts) => {
      const d = new Date(ts), t = new Date();
      const diff = Math.floor((new Date(t.toDateString()) - new Date(d.toDateString())) / 864e5);
      return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    };
    const groups = [];
    for (const a of list) {
      const g = day(a.at);
      if (!groups.length || groups[groups.length - 1][0] !== g) groups.push([g, []]);
      groups[groups.length - 1][1].push(a);
    }
    return [
      h('div', { class: 'set-actions spread' },
        h('p', { class: 'set-lead' }, `${list.length} archived tab${list.length > 1 ? 's' : ''}. Click one to bring it back.`),
        h('button', { class: 'btn danger', onclick: () => { S.archive = []; save(); renderSettings(); } }, 'Clear archive')),
      ...groups.map(([g, items]) => section(g, ...items.map((a) => h('div', {
        class: 'arch-row', onclick: () => { restoreArchived(a.id); closeSettings(); },
      },
      favEl({ url: a.url, title: a.title, favicon: a.favicon }, null, true),
      h('span', { class: 'ph' }, h('b', {}, a.title), h('small', {}, prettyUrl(a.url))),
      h('span', { class: 'arch-time' }, new Date(a.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })),
      h('button', { class: 'icon-btn sm', title: 'Remove', html: icon('x'), onclick: (e) => { e.stopPropagation(); S.archive = S.archive.filter((x) => x.id !== a.id); save(); renderSettings(); } }))))),
    ];
  },

  icon() {
    return [
      h('p', { class: 'set-lead' }, 'Pick the icon Oto shows in your taskbar while it’s open.'),
      h('div', { class: 'icon-grid' }, ...Object.entries(ICON_STYLES).map(([k, s]) => h('button', {
        class: `icon-pick${S.settings.appIcon === k ? ' on' : ''}`,
        onclick: () => { setPref('appIcon', k); applyAppIcon(); renderSettings(); },
      }, h('span', { class: 'icon-art', html: iconSvg(k) }), h('span', {}, s.name)))),
      h('p', { class: 'set-note' }, 'A pinned taskbar shortcut keeps the original icon until you unpin and re-pin Oto.'),
    ];
  },

  shortcuts() {
    const km = S.settings.keymap || {};
    return [
      h('div', { class: 'set-actions spread' },
        h('p', { class: 'set-lead' }, 'Click a shortcut to change it, then press the new keys. Backspace removes it, Esc cancels.'),
        Object.keys(km).length ? h('button', { class: 'btn', onclick: () => { S.settings.keymap = {}; save(); syncMainSettings(); renderSettings(); } }, 'Reset all') : null),
      section(null, ...COMMANDS.map(([cmd, label]) => {
        const rec = recording && recording.cmd === cmd;
        const combos = combosFor(cmd);
        return h('div', { class: `key-row${rec ? ' rec' : ''}` },
          h('span', { class: 'key-lbl' }, label, cmd in km ? h('em', { class: 'tag' }, 'custom') : null),
          h('button', { class: 'key-btn', onclick: () => (rec ? (stopRecording(), renderSettings()) : startRecording(cmd)) },
            rec ? h('span', { class: 'key-wait' }, 'Press keys…') : (combos.length ? combos.map((c) => h('kbd', {}, prettyCombo(c))) : h('span', { class: 'key-wait' }, 'Not set'))),
          cmd in km ? h('button', { class: 'icon-btn sm', title: 'Back to default', html: icon('reload'), onclick: () => { const n = { ...km }; delete n[cmd]; S.settings.keymap = n; save(); syncMainSettings(); renderSettings(); } }) : h('span', { class: 'key-spacer' }));
      })),
      h('p', { class: 'set-note' }, 'Always on: Ctrl+1…9 jumps to a tab, Ctrl+Shift+1…9 switches space.'),
    ];
  },

  about() {
    const exportAll = () => {
      const data = { oto: 1, exported: new Date().toISOString(), settings: S.settings, boosts: S.boosts, workspaces: S.workspaces.map(({ id, name, emoji, color, colors, intensity, grain }) => ({ id, name, emoji, color, colors, intensity, grain })) };
      const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: 'oto-settings.json' });
      document.body.append(a); a.click(); a.remove();
    };
    const importInput = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    importInput.addEventListener('change', async () => {
      const f = importInput.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || data.oto !== 1) throw new Error('not an Oto file');
        S.settings = { ...DEFAULT_SETTINGS, ...data.settings };
        if (Array.isArray(data.boosts)) S.boosts = data.boosts;
        if (Array.isArray(data.workspaces)) {
          for (const w of data.workspaces) { const mine = S.workspaces.find((x) => x.id === w.id || x.name === w.name); if (mine) Object.assign(mine, { ...w, id: mine.id }); }
        }
        save(); syncMainSettings(); oto.setTheme(S.settings.theme); applyTheme(); applyLayout(); applyAppIcon(); reapplyBoosts(); updateChrome(); render(); renderSettings();
        toast('Settings imported', { icon: 'check' });
      } catch (err) { toast(`Couldn’t import that file (${err.message})`, { timeout: 2500 }); }
    });
    return [
      h('div', { class: 'about-hero' }, h('span', { class: 'icon-art', html: iconSvg(S.settings.appIcon) }),
        h('div', {}, h('h3', {}, 'Oto'), h('div', { class: 'about' }, `Version ${INFO.version || ''} · Chromium ${INFO.chrome || ''} · Electron ${INFO.electron || ''}`))),
      section(null,
        row('Back up your setup', 'Saves settings, space colours, Boosts, Mods and shortcuts to a file.', h('div', { class: 'btn-pair' },
          h('button', { class: 'btn', onclick: exportAll }, 'Export'),
          h('button', { class: 'btn', onclick: () => importInput.click() }, 'Import'), importInput)),
        row('Reset settings', 'Puts every setting back to its default. Your tabs and spaces stay.', h('button', {
          class: 'btn danger', onclick: () => {
            if (!confirm('Reset all settings to their defaults?')) return;
            S.settings = { ...DEFAULT_SETTINGS };
            save(); syncMainSettings(); oto.setTheme(S.settings.theme); applyTheme(); applyLayout(); applyAppIcon(); updateChrome(); renderSettings();
          },
        }, 'Reset'))),
      updatesSection(),
      section('Report a problem',
        row('Something not working right?', 'Saves a small report of what the sidebar, top bar and mouse did recently, plus your layout settings. Nothing about the sites you visit is included. Send the file to whoever is helping you.',
          h('div', { class: 'btn-pair' },
            h('button', { class: 'btn', onclick: () => saveReport() }, 'Save report'),
            h('button', { class: 'btn', onclick: () => copyReport() }, 'Copy')))),
    ];
  },
};

function boostEditor() {
  const b = boostEdit;
  const name = h('input', { value: b.name, placeholder: 'e.g. Hide YouTube Shorts', spellcheck: 'false' });
  const host = h('input', { value: b.host, placeholder: 'youtube.com', spellcheck: 'false' });
  const css = h('textarea', { spellcheck: 'false', class: 'code' });
  css.value = b.css;
  const tpl = h('select', {
    onchange: (e) => {
      const t = BOOST_TEMPLATES[+e.target.value];
      if (!t) return;
      css.value = t.css;
      if (t.host) host.value = t.host;
      if (!name.value || BOOST_TEMPLATES.some((x) => x.name === name.value)) name.value = t.name === 'Blank' ? '' : t.name;
    },
  }, h('option', { value: '' }, 'Start from a template…'), ...BOOST_TEMPLATES.map((t, i) => h('option', { value: i }, t.name)));
  const commit = () => {
    const data = { id: b.id || uid(), name: name.value.trim() || 'Untitled boost', host: host.value.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''), css: css.value, on: b.on !== false };
    S.boosts = S.boosts || [];
    const i = S.boosts.findIndex((x) => x.id === data.id);
    if (i >= 0) S.boosts[i] = data; else S.boosts.push(data);
    boostEdit = null;
    save(); reapplyBoosts(); renderSettings();
    toast('Boost saved', { icon: 'bolt', timeout: 1400 });
  };
  return [
    h('div', { class: 'boost-editor' },
      h('div', { class: 'field-row wide' },
        h('label', { class: 'field' }, h('span', {}, 'Name'), name),
        h('label', { class: 'field' }, h('span', {}, 'Site'), host)),
      h('div', { class: 'field' }, h('span', {}, 'CSS'), tpl, css),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', onclick: () => { boostEdit = null; renderSettings(); } }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: commit }, 'Save boost'))),
  ];
}

function renderSettings() {
  stopMotionPreview();
  const body = $('#settingsBody');
  const scroll = body.querySelector('.set-pane');
  const keep = scroll && scroll.dataset.page === settingsTab ? scroll.scrollTop : 0;
  if (settingsTab !== 'performance') { clearInterval(perfTimer); perfTimer = null; }
  const nav = h('nav', { class: 'set-nav' }, ...PAGES.map(([k, label, ic]) => h('button', {
    class: `set-tab${k === settingsTab ? ' on' : ''}`,
    onclick: () => { settingsTab = k; boostEdit = null; stopRecording(); renderSettings(); },
  }, iconEl(ic), h('span', {}, label), k === 'archive' && (S.archive || []).length ? h('span', { class: 'count' }, String(S.archive.length)) : null)));
  const title = (PAGES.find((p) => p[0] === settingsTab) || PAGES[0])[1];
  const pane = h('div', { class: 'set-pane', 'data-page': settingsTab }, h('h2', { class: 'set-title' }, title), ...(PAGE_RENDER[settingsTab] || PAGE_RENDER.general)());
  body.replaceChildren(nav, pane);
  pane.scrollTop = keep;
}
