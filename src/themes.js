'use strict';
/* Oto — theme packs. "RyokuTunes": a near-black, editorial theme in the style of the RyokuTunes
   music app — thin lines, serif headings, small mono labels, 音 accents and a cream highlight. */

// For now the near-black editorial look IS the Oto theme (the older bright Oto look is hidden).
// Avocado windows keep their own green look, which is built on the older theme.
// Frutiger Aero (1.9.3): the same layout as Oto, dressed in the glossy, sky-blue, late-2000s look: glass panels,
// green hills, bubbles, light ribbons and shiny aqua buttons. Everything is drawn in CSS; no images from anywhere.
const SKINS = { ryokutunes: 'Oto', aero: 'Frutiger Aero' };
const SKIN_AVOCADO = /[?&]avocado=1/.test(location.search);
const skinOf = () => (SKIN_AVOCADO ? 'oto' : (typeof S !== 'undefined' && S && S.settings && S.settings.skin === 'aero') ? 'aero' : 'ryokutunes');
const skinIsRt = () => skinOf() !== 'oto'; // Frutiger Aero is built on the Oto layout
const skinIsAero = () => skinOf() === 'aero';

const hexA = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

// Near-black window with a faint glow of the space's colour in the corner and fine grain.
function rtBackground(theme) {
  if (skinIsAero()) return aeroBackground();
  const c = theme.colors[0];
  const c2 = theme.colors[theme.colors.length - 1];
  const noise = noiseLayer(Math.max(theme.grain || 0, 0.3));
  const glow = `radial-gradient(90% 70% at 100% 0%, ${hexA(c, 0.09)}, transparent 62%), radial-gradient(70% 60% at 0% 100%, ${hexA(c2, 0.05)}, transparent 60%)`;
  return {
    stops: ['#0b0b0c', '#0b0b0c'],
    bg: '#0b0b0c',
    image: `${noise}, ${glow}, linear-gradient(#0b0b0c, #0b0b0c)`,
    size: '220px 220px, 100vw 100vh, 100vw 100vh, 100vw 100vh',
    accent: '#e7dfd1',
  };
}

// Frutiger Aero's window: a deep-to-pale sky, a glow of sun up right, two soft light ribbons and green hills.
function aeroBackground() {
  const layers = [
    ['radial-gradient(38% 30% at 80% 8%, rgba(255,255,255,.85), rgba(255,255,255,.25) 45%, transparent 72%)', '100vw 100vh'],
    ['linear-gradient(112deg, transparent 38%, rgba(255,255,255,.22) 46%, rgba(255,255,255,.04) 52%, transparent 58%)', '100vw 100vh'],
    ['linear-gradient(104deg, transparent 52%, rgba(190,255,240,.18) 58%, transparent 66%)', '100vw 100vh'],
    ['radial-gradient(70% 34% at 22% 112%, #5cc23a 0, #8ee05a 55%, rgba(142,224,90,0) 72%)', '100vw 100vh'],
    ['radial-gradient(80% 30% at 82% 116%, #3fae35 0, #74d04a 52%, rgba(116,208,74,0) 70%)', '100vw 100vh'],
    ['linear-gradient(180deg, #0a56b0 0%, #1d84de 34%, #42aaee 60%, #74c6f6 80%, #b0e2ff 93%)', '100vw 100vh'],
  ];
  return { stops: ['#0b5fbf', '#bfe9ff'], bg: '#1d7fd6', image: layers.map((l) => l[0]).join(', '), size: layers.map((l) => l[1]).join(', '), accent: '#ffffff' };
}

// A barcode as an SVG data URL (deterministic, so it looks the same every launch).
function rtBarcode() {
  let s = 7, x = 0, bars = '';
  while (x < 200) { s = (s * 1103515245 + 12345) >>> 0; const w = 1 + (s % 3); if ((s >> 4) % 3) bars += `<rect x='${x}' y='0' width='${w}' height='14'/>`; x += w + 1 + ((s >> 7) % 2); }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='200' height='14' fill='%23e7dfd1'>${bars}</svg>`).replace(/%2523/g, '%23')}")`;
}

// Theme-only decorations (hidden by CSS unless RyokuTunes is on).
function ensureSkinDecor() {
  if (!$('#rtFoot')) {
    const foot = document.querySelector('#sidebar .sb-foot');
    if (foot) {
      foot.before(h('div', { id: 'rtFoot', 'aria-hidden': 'true' },
        h('div', { class: 'rt-foot-row' }, h('span', {}, 'OTO // BROWSER'), h('span', {}, 'LIVE')),
        h('div', { class: 'rt-barcode', style: `background-image:${rtBarcode()}` }),
        h('div', { class: 'rt-foot-sub' }, 'OTO — DESKTOP')));
    }
  }
  if (!$('#rtCrumb')) {
    const inner = document.querySelector('#empty .empty-inner');
    if (inner) {
      inner.prepend(h('div', { id: 'rtCrumb', class: 'rt-crumb', 'aria-hidden': 'true' },
        h('span', { class: 'rt-dash' }), h('span', { class: 'rt-kanji' }, '音'), h('span', {}, 'HOME / BROWSE'), h('span', { class: 'rt-rule' }), h('span', {}, '01')));
      const greet = $('#greet');
      if (greet) greet.after(h('div', { id: 'rtSub', class: 'rt-sub' }, 'Pick up where you left off, or find the next thing worth reading.'));
    }
  }
}

// Glossy bubbles drifting up behind the start page (only in Frutiger Aero; still when motion is reduced)
function ensureAeroBubbles() {
  const host = document.getElementById('empty');
  if (!host || document.getElementById('aeroSky')) return;
  const sky = h('div', { id: 'aeroSky', 'aria-hidden': 'true' });
  [[8, 70, 64, 0], [18, 30, 28, 6], [27, 82, 40, 11], [41, 55, 22, 3], [58, 76, 52, 9], [69, 40, 30, 14], [80, 66, 70, 2], [90, 24, 26, 8], [50, 90, 36, 16], [34, 18, 18, 12]]
    .forEach(([x, y, size, delay], i) => sky.append(h('i', { style: `left:${x}%;top:${y}%;width:${size}px;height:${size}px;animation-delay:-${delay}s;animation-duration:${18 + (i % 4) * 5}s` })));
  host.prepend(sky);
}
function applySkin() {
  ensureSkinDecor();
  document.body.classList.toggle('skin-rt', skinIsRt());
  document.body.classList.toggle('skin-aero', skinIsAero());
  if (skinIsAero()) ensureAeroBubbles();
}
