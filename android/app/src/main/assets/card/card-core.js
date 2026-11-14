'use strict';
/* Oto Card drawing — copied unchanged from Oto for Windows (main @ 87b0ffe, src/library.js, src/renderer.js,
 * src/gradient.js, src/v1d.js) so the phone shows exactly the card you made on your PC. Regenerate from those files
 * when the card changes there. Uses the global S (filled by card.js from your synced card). */
var V1D = { founder: null }; // the Founder edition needs a signature from the owner key: shown as standard here
// hexToRgb (src/renderer.js)
function hexToRgb(hex) {
  let m = String(hex).replace('#', '');
  if (m.length === 3) m = m.split('').map((c) => c + c).join('');
  const n = parseInt(m, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// mix (src/renderer.js)
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `#${A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join('')}`;
}

// themeOf (src/gradient.js)
function themeOf(ws) {
  const colors = (Array.isArray(ws.colors) && ws.colors.length ? ws.colors : [ws.color || '#8b7cf6']).slice(0, 3);
  return { colors, intensity: ws.intensity ?? 0.5, grain: ws.grain ?? 0 };
}

// currentWs (src/renderer.js)
const currentWs = () => S.workspaces.find((w) => w.id === S.activeWs) || S.workspaces[0];

// CARD_ART (src/library.js)
const CARD_ART = {
  orbit: 'Orbit', waves: 'Waves', bloom: 'Bloom', rings: 'Rings', grid: 'Dots', aurora: 'Aurora', peaks: 'Peaks',
};

// CARD_STYLES (src/library.js)
const CARD_STYLES = { night: 'Neon', holo: 'Holo', tinted: 'Tinted', paper: 'Ivory' };

// CARD_FONTS (src/library.js)
const CARD_FONTS = {
  sans: ['Modern', '"Segoe UI Variable Display", "Segoe UI", Inter, system-ui, sans-serif'],
  mono: ['Mono', '"Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace'],
  serif: ['Serif', 'Georgia, "Times New Roman", serif'],
  tech: ['Tech', 'Bahnschrift, "DIN Alternate", "Segoe UI", sans-serif'],
};

// CARD_TITLES (src/library.js)
const CARD_TITLES = ['Calm Explorer', 'Tab Tamer', 'Space Cadet', 'Night Surfer', 'Pixel Pilot', 'Bookmark Hoarder', 'Ad Slayer', 'Gradient Wizard', 'Speed Demon', 'Quiet Genius'];

// CARD_STATS (src/library.js)
const CARD_STATS = { days: 'Days with Oto', blocked: 'Ads blocked', pages: 'Pages visited', spaces: 'Spaces', bookmarks: 'Bookmarks', tabs: 'Open tabs' };

// cardModel (src/library.js)
function cardModel() {
  S.card = S.card || {};
  const c = S.card;
  if (!c.no) c.no = String(1 + Math.floor(Math.random() * 9998)).padStart(4, '0');
  if (c.seed == null) c.seed = Math.floor(Math.random() * 1e6);
  return {
    name: c.name ?? (S.settings.userName || 'Oto user'),
    title: c.title ?? 'Calm Explorer',
    colors: c.colors || null, // null = match the current space
    design: c.design || 'keycard', art: c.art || 'orbit', style: c.style || 'night', font: c.font || (c.design === 'classic' || c.design === 'shiny' ? 'sans' : 'tech'),
    grain: c.grain ?? 0.35, stats: c.stats || ['days', 'blocked', 'spaces'], showStats: c.showStats !== false,
    seed: c.seed, no: c.no,
  };
}

// cardStatValue (src/library.js)
function cardStatValue(k) {
  const st = S.stats || {};
  switch (k) {
    case 'days': return Math.max(1, Math.ceil((Date.now() - (S.since || Date.now())) / 864e5));
    case 'blocked': return st.blocked || 0;
    case 'pages': return (st.pages || 0) || (S.history || []).length;
    case 'spaces': return S.workspaces.length;
    case 'bookmarks': return typeof allBookmarks === 'function' ? allBookmarks().length : 0;
    case 'tabs': return S.tabs.length;
    default: return 0;
  }
}

// compact (src/library.js)
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}k` : String(n));

// esc (src/library.js)
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// rng (src/library.js)
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// cardVortex (src/library.js)
function cardVortex(stroke, sw = 3) {
  const rings = [10, 16, 22, 28].map((r, i) => `<ellipse cx="32" cy="32" rx="${r}" ry="${(r * 0.46).toFixed(1)}" stroke-width="${(sw * (1 - i * 0.18)).toFixed(2)}" opacity="${(1 - i * 0.2).toFixed(2)}"/>`).join('');
  return `<g fill="none" stroke="${stroke}" transform="rotate(-6 32 32)">${rings}</g><circle cx="32" cy="32" r="${(sw * 1.5).toFixed(1)}" fill="${stroke}"/>`;
}

// cardArt (src/library.js)
function cardArt(m, cols, W, H, id) {
  const r = rng(m.seed);
  const white = (o) => `rgba(255,255,255,${o})`;
  switch (m.art) {
    case 'orbit': {
      const cx = W * (0.55 + r() * 0.15), cy = H * (0.5 + r() * 0.1), R = H * 0.62;
      const inf = 'M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z';
      return `<g fill="none" stroke="${white(0.55)}" stroke-linecap="round">
        <circle cx="${cx}" cy="${cy}" r="${R}" stroke-width="10" stroke-dasharray="${R * 5.2} ${R * 1.1}" transform="rotate(${-40 + r() * 30} ${cx} ${cy})"/>
        <circle cx="${cx}" cy="${cy}" r="${R * 0.78}" stroke-width="2" opacity=".6"/>
        </g><g transform="translate(${cx - R * 0.9} ${cy - R * 0.9}) scale(${(R * 1.8) / 64})">${cardVortex(white(0.75), 1.6)}</g>`;
    }
    case 'waves': {
      let out = '';
      for (let i = 0; i < 6; i++) {
        const y = H * (0.25 + i * 0.13), a = 10 + r() * 22, ph = r() * W;
        let d = `M0 ${y}`;
        for (let x = 0; x <= W; x += 12) d += ` L${x} ${(y + Math.sin((x + ph) / (38 + i * 6)) * a).toFixed(1)}`;
        out += `<path d="${d} L${W} ${H} L0 ${H}Z" fill="${white(0.08 + i * 0.025)}"/>`;
      }
      return out;
    }
    case 'bloom': {
      let out = `<defs><filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter></defs><g filter="url(#${id}b)">`;
      for (let i = 0; i < 5; i++) out += `<circle cx="${r() * W}" cy="${r() * H}" r="${40 + r() * 70}" fill="${cols[i % cols.length]}" opacity=".9"/>`;
      return `${out}<circle cx="${r() * W}" cy="${r() * H}" r="60" fill="#fff" opacity=".35"/></g>`;
    }
    case 'rings': {
      const cx = r() * W, cy = H * (0.2 + r() * 0.6);
      let out = '<g fill="none">';
      for (let i = 1; i < 12; i++) out += `<circle cx="${cx}" cy="${cy}" r="${i * 22}" stroke="${white(0.42 - i * 0.03)}" stroke-width="${i % 3 ? 1.5 : 4}"/>`;
      return `${out}</g>`;
    }
    case 'grid': {
      let out = '';
      const ox = r() * W, oy = r() * H;
      for (let y = 10; y < H; y += 16) for (let x = 10; x < W; x += 16) {
        const d = Math.hypot(x - ox, y - oy);
        const s = Math.max(0.6, 4.2 - d / 55);
        out += `<circle cx="${x}" cy="${y}" r="${s.toFixed(2)}" fill="${white(0.55)}"/>`;
      }
      return out;
    }
    case 'aurora': {
      let out = `<defs><linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="${id}f"><feGaussianBlur stdDeviation="6"/></filter></defs><g filter="url(#${id}f)">`;
      for (let i = 0; i < 9; i++) { const x = r() * W, w = 8 + r() * 26; out += `<rect x="${x}" y="${-20 + r() * 30}" width="${w}" height="${H * (0.7 + r() * 0.5)}" rx="${w / 2}" fill="url(#${id}a)" opacity="${0.4 + r() * 0.5}" transform="skewX(${-18 + r() * 10})"/>`; }
      return `${out}</g>`;
    }
    case 'peaks': {
      let out = '';
      for (let i = 0; i < 4; i++) {
        const base = H * (0.55 + i * 0.12);
        let d = `M0 ${H} L0 ${base}`;
        let x = 0;
        while (x < W) { const nx = x + 30 + r() * 50; d += ` L${(x + nx) / 2} ${base - 20 - r() * (70 - i * 12)} L${nx} ${base}`; x = nx; }
        out += `<path d="${d} L${W} ${H}Z" fill="${i % 2 ? 'rgba(0,0,0,.14)' : white(0.16 + i * 0.05)}"/>`;
      }
      return out;
    }
    default: return '';
  }
}

// cardSvgClassic (src/library.js)
function cardSvgClassic(m = cardModel(), { scale = 1 } = {}) {
  const W = 320, H = 460, P = 18;
  const id = `oc${Math.floor(Math.random() * 1e6)}`;
  const cols = (m.colors && m.colors.length ? m.colors : themeOf(currentWs()).colors).slice(0, 3);
  const c3 = cols.length === 1 ? [cols[0], mix(cols[0], '#ffffff', 0.35)] : cols;
  const theme = {
    paper: { bg: '#fbf8f1', ink: '#1d1b26', sub: '#5d5a6b', line: 'rgba(29,27,38,.18)' },
    night: { bg: '#111019', ink: '#f6f4ff', sub: '#a8a3c2', line: 'rgba(255,255,255,.16)' },
    tinted: { bg: mix(c3[0], '#ffffff', 0.86), ink: mix(c3[0], '#111111', 0.82), sub: mix(c3[0], '#333333', 0.55), line: 'rgba(0,0,0,.14)' },
  }[m.style === 'holo' ? 'paper' : m.style] || {};
  const font = (CARD_FONTS[m.font] || CARD_FONTS.sans)[1].replace(/"/g, "'");
  const mono = CARD_FONTS.mono[1].replace(/"/g, "'");
  const AW = W - P * 2, AH = 232;
  const stops = c3.map((c, i) => `<stop offset="${(i / (c3.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const nameSize = m.name.length > 16 ? 24 : m.name.length > 11 ? 29 : 34;
  const since = new Date(S.since || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const stats = m.showStats ? m.stats.slice(0, 3).map((k, i) => {
    const x = P + i * (AW / 3);
    return `<text x="${x}" y="368" font-family="${font}" font-size="20" font-weight="700" fill="${theme.ink}">${esc(compact(cardStatValue(k)))}</text>
      <text x="${x}" y="384" font-family="${mono}" font-size="8.5" letter-spacing=".8" fill="${theme.sub}">${esc(CARD_STATS[k].toUpperCase())}</text>`;
  }).join('') : '';
  const mark = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 64})">${cardVortex(theme.ink, 4)}</g>`;
  const grain = m.grain > 0.02 ? `<rect x="${P}" y="${P}" width="${AW}" height="${AH}" rx="14" filter="url(#${id}n)" opacity="${(m.grain * 0.9).toFixed(2)}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
    <clipPath id="${id}c"><rect x="${P}" y="${P}" width="${AW}" height="${AH}" rx="14"/></clipPath>
    <filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.32"/></filter>
  </defs>
  <rect width="${W}" height="${H}" rx="22" fill="${theme.bg}"/>
  <g clip-path="url(#${id}c)">
    <rect x="${P}" y="${P}" width="${AW}" height="${AH}" fill="url(#${id}g)"/>
    <g transform="translate(${P} ${P})">${cardArt(m, c3, AW, AH, id)}</g>
    ${grain}
  </g>
  <text x="${P}" y="${P + AH + 46}" font-family="${font}" font-size="${nameSize}" font-weight="700" letter-spacing="-.5" fill="${theme.ink}">${esc(m.name || ' ')}</text>
  <text x="${P}" y="${P + AH + 66}" font-family="${mono}" font-size="11" letter-spacing="2" fill="${theme.sub}">${esc((m.title || '').toUpperCase())}</text>
  ${stats}
  <line x1="${P}" y1="404" x2="${W - P}" y2="404" stroke="${theme.line}"/>
  <rect x="${P}" y="418" width="${Math.round(56 + `SINCE ${since}`.length * 6.25)}" height="24" rx="6" fill="none" stroke="${theme.ink}" stroke-opacity=".75"/>
  <text x="${P + 9}" y="434" font-family="${mono}" font-size="10" font-weight="700" fill="${theme.ink}">OTO</text>
  <line x1="${P + 38}" y1="418" x2="${P + 38}" y2="442" stroke="${theme.ink}" stroke-opacity=".5"/>
  <text x="${P + 46}" y="434" font-family="${mono}" font-size="10" fill="${theme.ink}">SINCE ${esc(since.toUpperCase())}</text>
  <text x="${W - P - 30}" y="434" text-anchor="end" font-family="${mono}" font-size="10" fill="${theme.sub}">Nº ${esc(m.no)}</text>
  ${mark(W - P - 24, 418, 24)}
</svg>`;
}

// cardSvgShiny (src/library.js)
function cardSvgShiny(m = cardModel(), { scale = 1 } = {}) {
  const W = 320, H = 460;
  const id = `os${Math.floor(Math.random() * 1e6)}`;
  const cols = (m.colors && m.colors.length ? m.colors : themeOf(currentWs()).colors).slice(0, 3);
  const c3 = cols.length === 1 ? [cols[0], mix(cols[0], '#ffffff', 0.35)] : cols;
  const frames = {
    night: ['#3a3d4a', '#d9dce6', '#5b5f70', '#f4f6ff', '#2c2f3a'],
    holo: ['#ff9de2', '#9df3ff', '#c5ff9d', '#ffd79d', '#d6a8ff'],
    tinted: [mix(c3[0], '#000', 0.3), mix(c3[0], '#fff', 0.55), c3[0], mix(c3[c3.length - 1], '#fff', 0.6), mix(c3[c3.length - 1], '#000', 0.25)],
    paper: ['#8a6a1f', '#f6e7a6', '#c9a24a', '#fff4c9', '#9c7a2a'],
  };
  const fr = frames[m.style] || frames.night;
  const ink = '#ffffff', sub = 'rgba(255,255,255,.75)';
  const font = (CARD_FONTS[m.font] || CARD_FONTS.sans)[1].replace(/"/g, "'");
  const mono = CARD_FONTS.mono[1].replace(/"/g, "'");
  const r = rng(m.seed + 13);
  const stops = c3.map((c, i) => `<stop offset="${(i / (c3.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const AX = 22, AY = 62, AW = W - 44, AH = 206;
  const name = m.name || ' ';
  const nameSize = name.length > 16 ? 17 : name.length > 11 ? 20 : 23;
  const stars = Math.min(5, 1 + Math.floor(Math.log10(1 + cardStatValue('blocked'))) + (S.workspaces.length > 2 ? 1 : 0));
  const since = new Date(S.since || Date.now()).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const star4 = (x, y, s, o) => `<path d="M${x} ${y - s}C${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}C${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}C${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}C${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z" fill="#fff" opacity="${o}"/>`;
  let sparkles = '';
  for (let i = 0; i < 9; i++) sparkles += star4(AX + r() * AW, AY + r() * AH, 3 + r() * 7, (0.5 + r() * 0.5).toFixed(2));
  const rows = m.showStats ? m.stats.slice(0, 3).map((k, i) => {
    const y = 318 + i * 26;
    return `<circle cx="34" cy="${y - 4}" r="7" fill="url(#${id}f)"/><text x="48" y="${y}" font-family="${font}" font-size="12.5" font-weight="600" fill="${ink}">${esc(CARD_STATS[k])}</text>
      <text x="${W - 30}" y="${y}" text-anchor="end" font-family="${font}" font-size="15" font-weight="800" fill="${ink}">${esc(compact(cardStatValue(k)))}</text>
      ${i < Math.min(3, m.stats.length) - 1 ? `<line x1="28" y1="${y + 9}" x2="${W - 28}" y2="${y + 9}" stroke="rgba(255,255,255,.18)"/>` : ''}`;
  }).join('') : `<text x="${W / 2}" y="350" text-anchor="middle" font-family="${font}" font-size="13" font-style="italic" fill="${sub}">“A calm browser for a busy web.”</text>`;
  const markPath = 'M44.5 15.2 A21 21 0 1 0 49.6 21.3';
  const infPath = 'M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z';
  const grain = m.grain > 0.02 ? `<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" filter="url(#${id}n)" opacity="${(m.grain * 0.9).toFixed(2)}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}">
  <defs>
    <linearGradient id="${id}fr" x1="0" y1="0" x2="1" y2="1">${fr.map((c, i) => `<stop offset="${(i / (fr.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c3[0], '#0b0a14', 0.55)}"/><stop offset="1" stop-color="${mix(c3[c3.length - 1], '#07060d', 0.7)}"/></linearGradient>
    <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9de2"/><stop offset=".33" stop-color="#9df3ff"/><stop offset=".66" stop-color="#c5ff9d"/><stop offset="1" stop-color="#ffd79d"/></linearGradient>
    <linearGradient id="${id}foil" x1="0" y1="0" x2="1" y2=".6" spreadMethod="repeat" gradientTransform="scale(.35)">
      <stop offset="0" stop-color="#ff7ad9"/><stop offset=".2" stop-color="#7af0ff"/><stop offset=".4" stop-color="#b4ff7a"/><stop offset=".6" stop-color="#ffe27a"/><stop offset=".8" stop-color="#c58bff"/><stop offset="1" stop-color="#ff7ad9"/></linearGradient>
    <linearGradient id="${id}shine" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".1"/><stop offset=".56" stop-color="#fff" stop-opacity=".35"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}a"><rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="10"/></clipPath>
    <clipPath id="${id}c"><rect width="${W}" height="${H}" rx="20"/></clipPath>
    <filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.32"/></filter>
  </defs>
  <g clip-path="url(#${id}c)">
    <rect width="${W}" height="${H}" rx="20" fill="url(#${id}fr)"/>
    <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="14" fill="url(#${id}bg)"/>
    <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="14" fill="url(#${id}foil)" opacity=".14" style="mix-blend-mode:color-dodge"/>
    <rect x="9.5" y="9.5" width="${W - 19}" height="${H - 19}" rx="13.5" fill="none" stroke="rgba(255,255,255,.35)"/>
    <text x="24" y="44" font-family="${font}" font-size="${nameSize}" font-weight="800" fill="${ink}">${esc(name)}</text>
    <g transform="translate(${W - 24} 30)">${Array.from({ length: 5 }, (_, i) => `<path transform="translate(${-i * 13 - 6} 0) scale(.55)" d="M0-10 2.9-3.1 10-3.1 4.3 1.2 6.4 8.1 0 4 -6.4 8.1 -4.3 1.2 -10-3.1 -2.9-3.1Z" fill="${4 - i < stars ? 'url(#' + id + 'f)' : 'rgba(255,255,255,.22)'}"/>`).join('')}</g>
    <text x="${W - 24}" y="51" text-anchor="end" font-family="${mono}" font-size="7.5" letter-spacing="2" fill="${sub}">HOLO · Nº ${esc(m.no)}</text>
    <g clip-path="url(#${id}a)">
      <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}g)"/>
      <g transform="translate(${AX} ${AY})">${cardArt(m, c3, AW, AH, id)}</g>
      ${grain}
      <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}foil)" opacity=".38" style="mix-blend-mode:overlay"/>
      ${sparkles}
    </g>
    <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="10" fill="none" stroke="url(#${id}fr)" stroke-width="3"/>
    <rect x="${W / 2 - 78}" y="${AY + AH - 2}" width="156" height="22" rx="11" fill="url(#${id}fr)"/>
    <text x="${W / 2}" y="${AY + AH + 13}" text-anchor="middle" font-family="${mono}" font-size="9.5" font-weight="700" letter-spacing="1.6" fill="#14121f">${esc((m.title || 'Oto user').toUpperCase().slice(0, 22))}</text>
    ${rows}
    <line x1="24" y1="${H - 50}" x2="${W - 24}" y2="${H - 50}" stroke="rgba(255,255,255,.2)"/>
    <text x="24" y="${H - 30}" font-family="${mono}" font-size="8.5" letter-spacing="1.4" fill="${sub}">OTO · SINCE ${esc(since)}</text>
    <g transform="translate(${W - 46} ${H - 44}) scale(${22 / 64})">${cardVortex(`url(#${id}f)`, 4.5)}</g>
    <rect width="${W}" height="${H}" fill="url(#${id}shine)" style="mix-blend-mode:soft-light" opacity=".9"/>
    <rect width="${W}" height="${H}" fill="url(#${id}shine)" opacity=".25"/>
  </g>
</svg>`;
}

// CARD_DESIGNS (src/library.js)
const CARD_DESIGNS = { keycard: 'Keycard', classic: 'Classic', shiny: 'Shiny' };

// cardSvg (src/library.js)
function cardSvg(m = cardModel(), opts = {}) {
  if (m.design === 'classic') return cardSvgClassic(m, opts);
  if (m.design === 'shiny') return cardSvgShiny(m, opts);
  return cardSvgKeycard(m, opts);
}

// cardSvgKeycard (src/library.js)
function cardSvgKeycard(m = cardModel(), { scale = 1 } = {}) {
  const W = 320, H = 504, P = 18, C = 28, R = 10;
  const id = `oc${Math.floor(Math.random() * 1e6)}`;
  const cols = (m.colors && m.colors.length ? m.colors : themeOf(currentWs()).colors).slice(0, 3);
  const c3 = cols.length === 1 ? [cols[0], mix(cols[0], '#ffffff', 0.35)] : cols;
  const neonA = c3[0], neonB = c3[c3.length - 1];
  const T = {
    night: { bg1: '#0e0d1a', bg2: '#05050a', ink: '#ecfbff', sub: 'rgba(205,228,255,.62)', line: 'rgba(255,255,255,.12)', grid: 'rgba(255,255,255,.035)', glow: true, glitch: true },
    holo: { bg1: '#e6ecff', bg2: '#f7e3ff', ink: '#14121f', sub: 'rgba(20,18,31,.6)', line: 'rgba(20,18,31,.16)', grid: 'rgba(20,18,31,.05)', glow: true, glitch: true, holo: true },
    tinted: { bg1: mix(c3[0], '#0a0a12', 0.78), bg2: mix(neonB, '#050508', 0.9), ink: '#ffffff', sub: 'rgba(255,255,255,.66)', line: 'rgba(255,255,255,.15)', grid: 'rgba(255,255,255,.04)', glow: true, glitch: true },
    paper: { bg1: '#f1eee6', bg2: '#e6e2d6', ink: '#16141f', sub: 'rgba(22,20,31,.58)', line: 'rgba(22,20,31,.16)', grid: 'rgba(22,20,31,.04)', glow: false, glitch: false },
  }[m.style] || {};
  const font = (CARD_FONTS[m.font] || CARD_FONTS.tech)[1].replace(/"/g, "'");
  const mono = CARD_FONTS.mono[1].replace(/"/g, "'");
  const r = rng(m.seed + 7);
  const shape = `M${R} 0H${W - C}L${W} ${C}V${H - R}Q${W} ${H} ${W - R} ${H}H${C}L0 ${H - C}V${R}Q0 0 ${R} 0Z`;
  // artwork window with its own cut corner
  const AX = P, AY = 56, AW = W - P * 2, AH = 196, AC = 18;
  const art = `M${AX + AC} ${AY}H${AX + AW}V${AY + AH}H${AX}V${AY + AC}Z`;
  const stops = c3.map((c, i) => `<stop offset="${(i / (c3.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  const name = (m.name || ' ').toUpperCase();
  const nameSize = name.length > 15 ? 22 : name.length > 11 ? 27 : 32;
  const d = new Date(S.since || Date.now());
  const since = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
  // barcode from the name + seed
  let bars = '';
  let hsh = [...(m.name || 'oto')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, m.seed >>> 0);
  for (let x = 0; x < 150;) { hsh = (hsh * 1103515245 + 12345) >>> 0; const w = 1 + (hsh % 3); if ((hsh >> 3) % 3) bars += `<rect x="${P + x}" y="440" width="${w}" height="30"/>`; x += w + 1 + ((hsh >> 5) % 2); }
  const statsY = 378;
  const stats = m.showStats ? m.stats.slice(0, 3).map((k, i) => {
    const bw = (AW - 12) / 3, x = P + i * (bw + 6);
    return `<g><path d="M${x} ${statsY}h${bw - 8}l8 8v${30 - 8}H${x}Z" fill="none" stroke="${T.line}"/>
      <text x="${x + 7}" y="${statsY + 12}" font-family="${mono}" font-size="6.8" letter-spacing="1" fill="${T.sub}">${esc(CARD_STATS[k].toUpperCase())}</text>
      <text x="${x + 7}" y="${statsY + 27}" font-family="${mono}" font-size="13" font-weight="700" fill="${T.ink}">${esc(String(compact(cardStatValue(k))).padStart(3, '0'))}</text></g>`;
  }).join('') : `<text x="${P}" y="${statsY + 20}" font-family="${mono}" font-size="9" letter-spacing="2" fill="${T.sub}">// CLEARANCE GRANTED</text>`;
  const markPath = 'M44.5 15.2 A21 21 0 1 0 49.6 21.3';
  const infPath = 'M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z';
  const mark = (x, y, sz, stroke) => `<g transform="translate(${x} ${y}) scale(${sz / 64})">${cardVortex(stroke, 4)}</g>`;
  const grain = m.grain > 0.02 ? `<path d="${art}" filter="url(#${id}n)" opacity="${(m.grain * 0.9).toFixed(2)}"/>` : '';
  const nameY = 334;
  const glitch = T.glitch ? `<text x="${P - 1.6}" y="${nameY}" font-family="${font}" font-size="${nameSize}" font-weight="800" letter-spacing="1" fill="#22d3ee" opacity=".55">${esc(name)}</text>
    <text x="${P + 1.6}" y="${nameY + 0.6}" font-family="${font}" font-size="${nameSize}" font-weight="800" letter-spacing="1" fill="#f0f" opacity=".42">${esc(name)}</text>` : '';
  const ticks = Array.from({ length: 14 }, (_, i) => `<rect x="${W - 7}" y="${150 + i * 9}" width="${i % 4 ? 3 : 5}" height="1.4" fill="${T.sub}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}">
  <defs>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
    <linearGradient id="${id}bg" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${T.bg1}"/><stop offset="1" stop-color="${T.bg2}"/></linearGradient>
    <linearGradient id="${id}edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${neonA}"/><stop offset=".5" stop-color="${mix(neonA, neonB, 0.5)}"/><stop offset="1" stop-color="${neonB}"/></linearGradient>
    <linearGradient id="${id}chip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e3a1"/><stop offset=".5" stop-color="#c9a24a"/><stop offset="1" stop-color="#f3d98b"/></linearGradient>
    <linearGradient id="${id}holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9de2"/><stop offset=".33" stop-color="#9df3ff"/><stop offset=".66" stop-color="#c5ff9d"/><stop offset="1" stop-color="#ffd79d"/></linearGradient>
    <pattern id="${id}scan" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".22"/></pattern>
    <pattern id="${id}grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="${T.grid}"/></pattern>
    <clipPath id="${id}a"><path d="${art}"/></clipPath>
    <mask id="${id}m"><rect width="${W}" height="${H}" fill="#fff"/><rect x="${W / 2 - 30}" y="13" width="60" height="10" rx="5" fill="#000"/></mask>
    <filter id="${id}glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.32"/></filter>
  </defs>
  <g mask="url(#${id}m)">
    ${T.glow ? `<path d="${shape}" fill="none" stroke="url(#${id}edge)" stroke-width="4" filter="url(#${id}glow)" opacity=".85"/>` : ''}
    <path d="${shape}" fill="url(#${id}bg)"/>
    ${T.holo ? `<path d="${shape}" fill="url(#${id}holo)" opacity=".35"/>` : ''}
    <path d="${shape}" fill="url(#${id}grid)"/>
    <path d="${shape}" fill="none" stroke="url(#${id}edge)" stroke-width="1.6"/>
    <rect x="${W / 2 - 34}" y="9" width="68" height="18" rx="9" fill="none" stroke="${T.line}"/>
    <text x="${P}" y="44" font-family="${mono}" font-size="9" font-weight="700" letter-spacing="2.4" fill="${T.ink}">OTO//ACCESS</text>
    <text x="${W - P - 8}" y="44" text-anchor="end" font-family="${mono}" font-size="9" letter-spacing="1.6" fill="${neonB}">LVL·${String(1 + (m.seed % 9)).padStart(2, '0')}</text>
    <g clip-path="url(#${id}a)">
      <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}g)"/>
      <g transform="translate(${AX} ${AY})">${cardArt(m, c3, AW, AH, id)}</g>
      ${grain}
      <rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" fill="url(#${id}scan)"/>
      <rect x="${AX}" y="${AY + AH * (0.25 + r() * 0.5)}" width="${AW}" height="2" fill="#fff" opacity=".25"/>
    </g>
    <path d="${art}" fill="none" stroke="url(#${id}edge)" stroke-width="1.2"/>
    <path d="M${AX + AW - 14} ${AY + AH + 6}h14v-14M${AX} ${AY + AH + 6}v-0" fill="none" stroke="${neonB}" stroke-width="1.4"/>
    <text x="${AX + 8}" y="${AY + AH - 8}" font-family="${mono}" font-size="7.5" letter-spacing="1.4" fill="#fff" opacity=".85">REC ● ${String(m.no)}</text>
    <g transform="translate(${P} 268)">
      <rect width="40" height="30" rx="5" fill="url(#${id}chip)"/>
      <path d="M0 10h13M0 20h13M27 10h13M27 20h13M13 0v30M27 0v30M13 15h14" stroke="#8a6a24" stroke-width="1" opacity=".7"/>
    </g>
    <g transform="translate(${P + 52} 270)" font-family="${mono}" font-size="7.5" letter-spacing="1.2" fill="${T.sub}">
      <text y="9">ID Nº ${esc(m.no)}-OTO</text><text y="21">ISSUED ${esc(since)}</text>
    </g>
    <circle cx="${W - P - 20}" cy="283" r="20" fill="url(#${id}holo)" opacity=".95"/>
    <circle cx="${W - P - 20}" cy="283" r="20" fill="none" stroke="#fff" stroke-opacity=".6"/>
    ${mark(W - P - 33, 270, 26, 'rgba(20,18,31,.75)')}
    ${glitch}
    <text x="${P}" y="${nameY}" font-family="${font}" font-size="${nameSize}" font-weight="800" letter-spacing="1" fill="${T.ink}">${esc(name)}</text>
    <text x="${P}" y="${nameY + 20}" font-family="${mono}" font-size="11" letter-spacing="1.6" fill="${neonA}">&gt; ${esc((m.title || '').toUpperCase())}_</text>
    ${stats}
    <g fill="${T.ink}" opacity=".85">${bars}</g>
    <text x="${P}" y="482" font-family="${mono}" font-size="7.5" letter-spacing="2" fill="${T.sub}">${esc((m.no + (m.name || '').replace(/\s+/g, '').toUpperCase()).slice(0, 16).padEnd(16, '0'))}</text>
    <text x="${W - P}" y="452" text-anchor="end" font-family="${mono}" font-size="8" letter-spacing="1.6" fill="${T.sub}">SINCE</text>
    <text x="${W - P}" y="468" text-anchor="end" font-family="${mono}" font-size="13" font-weight="700" letter-spacing="1" fill="${T.ink}">${esc(since)}</text>
    <g transform="translate(${W - 56} 476)">${Array.from({ length: 6 }, (_, i) => `<path d="M${i * 7} 14l7-14h3l-7 14z" fill="${neonB}" opacity="${0.35 + i * 0.1}"/>`).join('')}</g>
    ${ticks}
  </g>
</svg>`;
}

// V1_LEVELS (src/v1d.js)
const V1_LEVELS = [
  { id: 'rookie', name: 'Rookie', xp: 0, color: '#94a3b8', title: 'Fresh Start' },
  { id: 'bronze', name: 'Bronze', xp: 100, color: '#c2773d', title: 'Trail Starter' },
  { id: 'silver', name: 'Silver', xp: 300, color: '#cbd5e1', title: 'Space Walker' },
  { id: 'gold', name: 'Gold', xp: 700, color: '#f5c542', title: 'Gold Navigator' },
  { id: 'holo', name: 'Holo', xp: 1500, color: '#a78bfa', title: 'Holo Voyager' },
  { id: 'mythic', name: 'Mythic', xp: 3000, color: '#22d3ee', title: 'Mythic Wanderer' },
];

// V1_BADGES (src/v1d.js)
const V1_BADGES = {
  week: ['7 days with Oto', '📅'], month: ['30 days with Oto', '🗓️'], blocker: ['1,000 ads blocked', '🛡️'], wall: ['10,000 ads blocked', '🏰'],
  spaces: ['3 spaces', '🪐'], split: ['First split view', '◫'], avocado: ['Went Avocado', '🥑'], folder: ['First tab folder', '🗂️'],
  shot: ['First screenshot', '📸'], theme: ['Theme maker', '🎨'], wrapped: ['Opened Wrapped', '🎁'], owl: ['Night owl', '🦉'],
  secret: ['Found a secret', '🤫'], note: ['First site note', '📝'], focus: ['Focus session', '🎯'],
};

// v1Stats (src/v1d.js)
function v1Stats() {
  const st = S.stats || {};
  const days = Math.max(1, Math.ceil((Date.now() - (S.since || Date.now())) / 864e5));
  return { days, blocked: st.blocked || 0, pages: st.pages || 0, spaces: S.workspaces.length };
}

// v1Xp (src/v1d.js)
function v1Xp() {
  const s = v1Stats();
  return s.days * 10 + Math.floor(s.blocked / 50) + s.spaces * 20 + Math.floor(s.pages / 20) + Object.keys(S.v1Badges || {}).length * 15 + (S.v1XpBonus || 0);
}

// v1Level (src/v1d.js)
function v1Level(xp = v1Xp()) {
  let i = 0;
  V1_LEVELS.forEach((l, k) => { if (xp >= l.xp) i = k; });
  const cur = V1_LEVELS[i], next = V1_LEVELS[i + 1];
  return { i, cur, next, xp, pct: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}

// v1Edition (src/v1d.js)
const v1Edition = () => {
  const e = (S.card || {}).edition;
  if (e === 'founder' && !(V1D.founder && V1D.founder.ok)) return 'standard'; // only with a signature from the owner key
  return e === 'og' || e === 'founder' ? e : 'standard';
};

// v1CardId (src/v1d.js)
const v1CardId = () => { let h2 = 7; for (const ch of String(S.since || 0)) h2 = (h2 * 31 + ch.charCodeAt(0)) >>> 0; return String(h2 % 10000).padStart(4, '0'); };

// v1CardOG (src/v1d.js)
function v1CardOG(m) {
  const W = 320, H = 504;
  const name = esc(String(m.name || 'You').toUpperCase().slice(0, 18));
  const since = new Date(S.since || Date.now()).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ogb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
  <radialGradient id="ogg" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" rx="22" fill="url(#ogb)"/><rect width="${W}" height="${H}" rx="22" fill="url(#ogg)"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="16" fill="none" stroke="#fff" stroke-opacity=".45" stroke-dasharray="2 5"/>
  <text x="26" y="44" font-family="ui-monospace,Consolas,monospace" font-size="11" letter-spacing="2.5" fill="#fff" fill-opacity=".85">OTO · ORIGINAL USER</text>
  <g transform="translate(${W / 2} 190)" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"><circle cx="-26" cy="0" r="44"/><circle cx="26" cy="0" r="44" stroke-opacity=".8"/></g>
  <text x="${W / 2}" y="296" text-anchor="middle" font-family="'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif" font-weight="800" font-size="30" fill="#fff">${name}</text>
  <text x="${W / 2}" y="320" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="11" letter-spacing="2" fill="#fff" fill-opacity=".85">BEFORE 1.0 · KEPT FOREVER</text>
  <rect x="26" y="${H - 104}" width="${W - 52}" height="1" fill="#fff" fill-opacity=".35"/>
  <text x="26" y="${H - 74}" font-family="ui-monospace,Consolas,monospace" font-size="10" fill="#fff" fill-opacity=".75">CARD Nº</text><text x="26" y="${H - 52}" font-family="ui-monospace,Consolas,monospace" font-size="20" font-weight="700" fill="#fff">${v1CardId()}</text>
  <text x="${W - 26}" y="${H - 74}" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="10" fill="#fff" fill-opacity=".75">SINCE</text><text x="${W - 26}" y="${H - 52}" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="15" font-weight="700" fill="#fff">${esc(since)}</text>
  <text x="${W / 2}" y="${H - 24}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="9" letter-spacing="3" fill="#fff" fill-opacity=".6">★ OG EDITION ★</text></svg>`;
}

// v1BackSkin (src/v1d.js)
function v1BackSkin(m) {
  const ed = v1Edition();
  const mono = 'ui-monospace,Consolas,monospace';
  const cols = (m.colors && m.colors.length ? m.colors : themeOf(currentWs()).colors).slice(0, 3);
  const c3 = cols.length === 1 ? [cols[0], mix(cols[0], '#ffffff', 0.35)] : cols;
  const stops = (arr) => arr.map((c, i) => `<stop offset="${(i / Math.max(1, arr.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  if (ed === 'founder') {
    const W = 320, H = 504;
    return { W, H, mono, ink: 'url(#bkG)', sub: '#d4a017', ring: '#d4a017', on: 'rgba(212,160,23,.14)',
      defs: `<linearGradient id="bkG" x1="0" y1="0" x2="1" y2="1">${stops(['#fde68a', '#d4a017', '#fff3c4', '#b8860b'])}</linearGradient><radialGradient id="bkB" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#1c1a14"/><stop offset="1" stop-color="#050505"/></radialGradient>`,
      base: `<rect width="${W}" height="${H}" rx="22" fill="url(#bkB)"/><rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="16" fill="none" stroke="url(#bkG)" stroke-width="2"/><rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="12" fill="none" stroke="url(#bkG)" stroke-width=".6" stroke-opacity=".6"/>
        <text x="${W / 2}" y="300" text-anchor="middle" font-family="'Yu Mincho','MS Mincho',serif" font-weight="700" font-size="260" fill="#d4a017" fill-opacity=".05">力</text>` };
  }
  if (ed === 'og') {
    const W = 320, H = 504;
    return { W, H, mono, ink: '#ffffff', sub: 'rgba(255,255,255,.72)', ring: '#ffffff', on: 'rgba(255,255,255,.2)',
      defs: `<linearGradient id="bkO" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>`,
      base: `<rect width="${W}" height="${H}" rx="22" fill="url(#bkO)"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="16" fill="none" stroke="#fff" stroke-opacity=".45" stroke-dasharray="2 5"/>
        <g transform="translate(${W / 2} ${H / 2})" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="10"><circle cx="-50" r="90"/><circle cx="50" r="90"/></g>` };
  }
  if (m.design === 'classic') {
    const W = 320, H = 460;
    const T = { paper: ['#fbf8f1', '#1d1b26', '#5d5a6b'], night: ['#111019', '#f6f4ff', '#a8a3c2'], tinted: [mix(c3[0], '#ffffff', 0.86), mix(c3[0], '#111111', 0.82), mix(c3[0], '#333333', 0.55)] }[m.style === 'holo' ? 'paper' : m.style] || ['#fbf8f1', '#1d1b26', '#5d5a6b'];
    return { W, H, mono, ink: T[1], sub: T[2], ring: T[1], on: `${c3[0]}33`,
      defs: `<linearGradient id="bkC" x1="0" y1="0" x2="1" y2="0">${stops(c3)}</linearGradient>`,
      base: `<rect width="${W}" height="${H}" rx="22" fill="${T[0]}"/><rect x="18" y="18" width="${W - 36}" height="8" rx="4" fill="url(#bkC)"/><rect x="18" y="${H - 26}" width="${W - 36}" height="8" rx="4" fill="url(#bkC)"/>` };
  }
  if (m.design === 'shiny') {
    const W = 320, H = 460;
    const fr = { night: ['#3a3d4a', '#d9dce6', '#5b5f70', '#f4f6ff', '#2c2f3a'], holo: ['#ff9de2', '#9df3ff', '#c5ff9d', '#ffd79d', '#d6a8ff'], paper: ['#8a6a1f', '#f6e7a6', '#c9a24a', '#fff4c9', '#9c7a2a'],
      tinted: [mix(c3[0], '#000', 0.3), mix(c3[0], '#fff', 0.55), c3[0], mix(c3[c3.length - 1], '#fff', 0.6), mix(c3[c3.length - 1], '#000', 0.25)] }[m.style] || ['#3a3d4a', '#d9dce6', '#5b5f70', '#f4f6ff', '#2c2f3a'];
    return { W, H, mono, ink: '#ffffff', sub: 'rgba(255,255,255,.72)', ring: '#ffffff', on: 'rgba(255,255,255,.18)',
      defs: `<linearGradient id="bkF" x1="0" y1="0" x2="1" y2="1">${stops(fr)}</linearGradient><linearGradient id="bkS" x1="0" y1="0" x2="1" y2="1">${stops(c3)}</linearGradient>`,
      base: `<rect width="${W}" height="${H}" rx="18" fill="url(#bkF)"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="12" fill="#14121c"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="12" fill="url(#bkS)" opacity=".35"/>` };
  }
  // keycard (default)
  const W = 320, H = 504, C = 28, R = 10;
  const T = { night: ['#0e0d1a', '#05050a', '#ecfbff', 'rgba(205,228,255,.62)'], holo: ['#e6ecff', '#f7e3ff', '#14121f', 'rgba(20,18,31,.6)'],
    tinted: [mix(c3[0], '#0a0a12', 0.78), mix(c3[c3.length - 1], '#050508', 0.9), '#ffffff', 'rgba(255,255,255,.66)'], paper: ['#f1eee6', '#e6e2d6', '#16141f', 'rgba(22,20,31,.58)'] }[m.style] || ['#0e0d1a', '#05050a', '#ecfbff', 'rgba(205,228,255,.62)'];
  const shape = `M${C} 0H${W - R}Q${W} 0 ${W} ${R}V${H - C}L${W - C} ${H}H${R}Q0 ${H} 0 ${H - R}V${C}Z`; // mirrored cut corners, like turning the card over
  return { W, H, mono, ink: T[2], sub: T[3], ring: c3[0], on: `${c3[0]}2e`,
    defs: `<linearGradient id="bkK" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T[0]}"/><stop offset="1" stop-color="${T[1]}"/></linearGradient><linearGradient id="bkN" x1="0" y1="0" x2="1" y2="1">${stops(c3)}</linearGradient>`,
    base: `<path d="${shape}" fill="url(#bkK)"/><path d="${shape}" fill="none" stroke="url(#bkN)" stroke-width="2"/><rect x="${W / 2 - 34}" y="14" width="68" height="10" rx="5" fill="none" stroke="${T[3]}"/>` };
}

// v1CardBack (src/v1d.js)
function v1CardBack(m = cardModel()) {
  const k = v1BackSkin(m);
  const { W, H, mono } = k;
  const got = S.v1Badges || {};
  const ids = Object.keys(V1_BADGES);
  const top = 92, step = (H - top - 70) / 5;
  let cells = '';
  ids.forEach((id, n) => {
    const cx = 62 + (n % 3) * 98, cy = top + Math.floor(n / 3) * step + 20;
    const on = !!got[id];
    cells += `<circle cx="${cx}" cy="${cy}" r="21" fill="${on ? k.on : 'none'}" stroke="${k.ring}" stroke-opacity="${on ? 0.75 : 0.22}" ${on ? '' : 'stroke-dasharray="3 4"'}/>
      <text x="${cx}" y="${cy + 6.5}" text-anchor="middle" font-size="${on ? 18 : 15}" ${on ? '' : `font-family="${mono}" fill="${k.sub}"`}>${on ? V1_BADGES[id][1] : '?'}</text>
      <text x="${cx}" y="${cy + 38}" text-anchor="middle" font-family="system-ui,'Segoe UI',sans-serif" font-size="8.5" fill="${on ? k.ink : k.sub}" fill-opacity="${on ? 0.95 : 0.6}">${on ? esc(V1_BADGES[id][0]) : 'Hidden'}</text>`;
  });
  const L = v1Level();
  const ed = v1Edition();
  const foot = ed === 'founder' && V1D.founder && V1D.founder.ok ? `✓ SIGNED ${esc(V1D.founder.sig.slice(0, 8))}…` : `Nº ${esc(m.no || v1CardId())}`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${k.defs}</defs>${k.base}
  <text x="28" y="52" font-family="${mono}" font-size="11" letter-spacing="2.5" fill="${k.ink}">BADGES</text>
  <text x="${W - 28}" y="52" text-anchor="end" font-family="${mono}" font-size="11" fill="${k.ink}">${Object.keys(got).length}/${ids.length}</text>
  <rect x="28" y="64" width="${W - 56}" height=".8" fill="${k.sub}" opacity=".5"/>
  ${cells}
  <rect x="28" y="${H - 58}" width="${W - 56}" height=".8" fill="${k.sub}" opacity=".5"/>
  <text x="28" y="${H - 36}" font-family="${mono}" font-size="10" letter-spacing="1.5" fill="${k.ink}">${esc(L.cur.name.toUpperCase())} · ${L.xp.toLocaleString()} XP</text>
  <text x="${W - 28}" y="${H - 36}" text-anchor="end" font-family="${mono}" font-size="9" letter-spacing="1" fill="${k.sub}">${foot}</text></svg>`;
}

