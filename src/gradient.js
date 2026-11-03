'use strict';
/* Oto — Zen-style gradient themes: colour maths + the colour-wheel picker */

const GRAD_PRESETS = [
  ['#a78bfa', '#f0abfc'], ['#818cf8', '#38bdf8'], ['#fda4af', '#fdba74'], ['#5eead4', '#93c5fd'],
  ['#fcd34d', '#f9a8d4'], ['#86efac', '#67e8f9'], ['#c4b5fd'], ['#f87171', '#fb923c', '#facc15'],
  ['#818cf8', '#e879f9', '#fb7185'], ['#2dd4bf', '#a3e635'], ['#fca5a5', '#c4b5fd', '#93c5fd'], ['#94a3b8'],
];

function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

// Position on the wheel (unit circle, y down) <-> colour.
// Angle = hue (clockwise from top), distance from centre = how vivid.
function posToHex(x, y) {
  const r = Math.min(1, Math.hypot(x, y));
  const hue = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
  return hslToHex(hue, 22 + 72 * r, 84 - 26 * r);
}
function hexToPos(hex) {
  const [hue, s] = hexToHsl(hex);
  const r = clamp((s - 22) / 72, 0.14, 1);
  const a = hue * Math.PI / 180;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}

function accentFrom(hex, dark) {
  const [hue, s, l] = hexToHsl(hex);
  if (s < 12) return hslToHex(hue, s, dark ? 66 : 46);
  return hslToHex(hue, Math.max(s, 58), dark ? clamp(l, 58, 70) : clamp(l, 46, 60));
}

function noiseLayer(grain) {
  if (!grain) return '';
  // Dark grain: black speckles whose strength follows the noise, so it adds texture and
  // depth without washing the colours out (grey noise used to lighten everything).
  const a = grain * 0.42;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${(a * 2.2).toFixed(3)} 0 0 0 ${(-a * 0.75).toFixed(3)}'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function themeOf(ws) {
  const colors = (Array.isArray(ws.colors) && ws.colors.length ? ws.colors : [ws.color || '#8b7cf6']).slice(0, 3);
  return { colors, intensity: ws.intensity ?? 0.5, grain: ws.grain ?? 0 };
}

// Turns a theme into the window background (gradient stops, accent, grain).
function buildBackground(theme, dark) {
  const base = dark ? '#141417' : '#f2f1f6';
  // Like Zen: colours are used close to full strength; Intensity blends toward the base.
  const amt = clamp(theme.intensity, 0.05, 1) * 0.94;
  let stops = theme.colors.map((c) => mix(base, c, amt));
  if (stops.length === 1) stops = [stops[0], mix(base, theme.colors[0], amt * 0.55)];
  const avg = stops.reduce((acc, c) => { const v = hexToRgb(c); return acc.map((x, i) => x + v[i] / stops.length); }, [0, 0, 0]);
  const avgHex = `#${avg.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
  const noise = noiseLayer(theme.grain);
  const grad = `linear-gradient(135deg, ${stops.join(', ')})`;
  return {
    stops,
    bg: avgHex,
    image: noise ? `${noise}, ${grad}` : grad,
    size: noise ? '220px 220px, 100vw 100vh' : '100vw 100vh',
    accent: accentFrom(theme.colors[0], dark),
  };
}

// Colour of a 135° gradient at window point (x, y): t = (x + y) / (W + H).
function colorAtPoint(stops, x, y) {
  const t = clamp((x + y) / (innerWidth + innerHeight), 0, 1);
  const n = stops.length - 1;
  const p = t * n;
  const i = Math.min(n - 1, Math.floor(p));
  return mix(stops[i], stops[i + 1], p - i);
}

/**
 * Colour-wheel picker. `model` = { colors, intensity, grain } is edited in place;
 * onChange(model) fires on every change (for live preview).
 */
function createGradientPicker(model, onChange, { wide = false } = {}) {
  const dots = model.colors.map((c) => ({ c, ...hexToPos(c) }));
  let raf = 0;
  const emit = () => {
    model.colors = dots.map((d) => d.c);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => onChange(model));
  };

  const wheel = h('div', { class: 'gp-wheel', title: 'Click to add a colour' });
  const SCALE = 0.88; // keep dots inside the rim

  function placeDot(el, d) {
    el.style.left = `${50 + d.x * 50 * SCALE}%`;
    el.style.top = `${50 + d.y * 50 * SCALE}%`;
    el.style.background = d.c;
  }
  function posFromEvent(e) {
    const r = wheel.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2 * SCALE);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2 * SCALE);
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }
  function paintDots() {
    wheel.querySelectorAll('.gp-dot').forEach((n) => n.remove());
    dots.forEach((d, i) => {
      const el = h('div', { class: `gp-dot${i === 0 ? ' primary' : ''}`, title: dots.length > 1 ? 'Drag · double-click to remove' : 'Drag to change' });
      placeDot(el, d);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
        const move = (ev) => { Object.assign(d, posFromEvent(ev)); d.c = posToHex(d.x, d.y); placeDot(el, d); emit(); };
        const up = () => { el.classList.remove('dragging'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
      });
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (dots.length > 1) { dots.splice(i, 1); paintDots(); emit(); }
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (dots.length > 1) { dots.splice(i, 1); paintDots(); emit(); }
      });
      wheel.append(el);
    });
    wheel.classList.toggle('full', dots.length >= 3);
  }
  wheel.addEventListener('pointerdown', (e) => {
    if (e.target !== wheel || dots.length >= 3) return;
    const p = posFromEvent(e);
    dots.push({ ...p, c: posToHex(p.x, p.y) });
    paintDots(); emit();
  });

  const presets = h('div', { class: 'gp-presets' }, ...GRAD_PRESETS.map((p) => h('button', {
    class: 'gp-preset', title: 'Use this preset',
    style: `background:${p.length > 1 ? `linear-gradient(135deg, ${p.join(', ')})` : p[0]}`,
    onclick: () => { dots.length = 0; p.forEach((c) => dots.push({ c, ...hexToPos(c) })); paintDots(); emit(); },
  })));

  const slider = (label, key, min, max, fmt) => {
    const out = h('span', { class: 'gp-val' }, fmt(model[key]));
    const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round((model[key] - min) / (max - min) * 100) });
    input.addEventListener('input', () => {
      model[key] = min + (max - min) * (input.value / 100);
      out.textContent = fmt(model[key]);
      emit();
    });
    return h('label', { class: 'gp-slider' }, h('span', { class: 'gp-lbl' }, label, out), input);
  };

  const side = h('div', { class: 'gp-side' },
    h('div', { class: 'gp-sub' }, 'Presets'),
    presets,
    slider('Intensity', 'intensity', 0.1, 1, (v) => `${Math.round(v * 100)}%`),
    slider('Grain', 'grain', 0, 1, (v) => (v < 0.02 ? 'Off' : `${Math.round(v * 100)}%`)),
    h('div', { class: 'gp-hint' }, 'Click the wheel to add up to 3 colours. Drag to move, double-click to remove.'),
  );

  paintDots();
  return h('div', { class: `gp${wide ? ' wide' : ''}` }, h('div', { class: 'gp-wheel-wrap' }, wheel), side);
}

// Relative luminance (WCAG) — decides whether the sidebar/top text is light or dark.
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
