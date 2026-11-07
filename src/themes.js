'use strict';
/* Oto — theme packs. "RyokuTunes": a near-black, editorial theme in the style of the RyokuTunes
   music app — thin lines, serif headings, small mono labels, 音 accents and a cream highlight. */

// For now the near-black editorial look IS the Oto theme (the older bright Oto look is hidden).
// Avocado windows keep their own green look, which is built on the older theme.
const SKINS = { ryokutunes: 'Oto' };
const SKIN_AVOCADO = /[?&]avocado=1/.test(location.search);
const skinOf = () => (SKIN_AVOCADO ? 'oto' : 'ryokutunes');
const skinIsRt = () => skinOf() === 'ryokutunes';

const hexA = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

// Near-black window with a faint glow of the space's colour in the corner and fine grain.
function rtBackground(theme) {
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

function applySkin() {
  ensureSkinDecor();
  document.body.classList.toggle('skin-rt', skinIsRt());
}
