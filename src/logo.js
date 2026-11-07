'use strict';
/* live = no tile, edges fade into whatever is behind it, and it keeps slowly swirling (Oto theme UI). */
/* Oto's logo: the Vortex — rings of light (x = r·cos t, y = k·r·sin t) spinning around a white hole,
   with light streaks flying out. Drawn from the same numbers every time. small = a simpler version
   for tiny sizes (sidebar, tabs). */
let vortexSeq = 0;
function vortexSvg({ small = false, bg = true, anim = false, live = false } = {}) {
  const n = ++vortexSeq;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const col = (t) => [Math.round(255 - 30 * t), Math.round(250 - 40 * t), Math.round(240 - 55 * t)];
  const f = (v) => v.toFixed(2);
  const cx = 32, cy = 31, k = 0.46, N = small ? 6 : 11;
  let rings = '', streaks = '', dots = '';
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), r = (small ? 7 : 6.5) + t * (small ? 19 : 21), rx = r, ry = r * k;
    const [R, G, B] = col(t), op = (small ? 1 : 0.95) - t * 0.45;
    const circ = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const dashes = small ? '' : Array.from({ length: 3 }, () => `${f(circ * (0.18 + rnd() * 0.2))} ${f(circ * (0.03 + rnd() * 0.05))}`).join(' ');
    const off = rnd() * circ;
    rings += `<ellipse class="vr" style="--i:${i};--c:${f(circ)};--o:${f(off)}" cx="${cx}" cy="${cy}" rx="${f(rx)}" ry="${f(ry)}" stroke="rgb(${R},${G},${B})" stroke-opacity="${f(op)}" stroke-width="${f(small ? 2.2 - t * 1.2 : 1.05 - t * 0.55)}" stroke-linecap="round"${dashes ? ` stroke-dasharray="${dashes}" stroke-dashoffset="${f(off)}"` : ''}/>`;
    if (!small) for (let q = 0; q < 2; q++) { const a = rnd() * Math.PI * 2; dots += `<circle class="vd" cx="${f(cx + rx * Math.cos(a))}" cy="${f(cy + ry * Math.sin(a))}" r="${f(0.25 + rnd() * 0.35)}" fill="#fff" opacity="${f(0.4 + rnd() * 0.6)}"/>`; }
  }
  if (!small) for (let q = 0; q < 26; q++) {
    const a = rnd() * Math.PI * 2, r1 = 25 + rnd() * 6, r2 = r1 + 3 + rnd() * 9, [R, G, B] = col(0.7 + rnd() * 0.3);
    streaks += `<path class="vs" style="--i:${q % 9}" d="M${f(cx + r1 * Math.cos(a))} ${f(cy + r1 * Math.sin(a) * 0.8)} L${f(cx + r2 * Math.cos(a))} ${f(cy + r2 * Math.sin(a) * 0.8)}" stroke="rgb(${R},${G},${B})" stroke-opacity="${f(0.25 + rnd() * 0.4)}" stroke-width=".55" stroke-linecap="round"/>`;
  }
  // live: stars pushed out of the white hole, drifting past (own seed so the logo itself never changes)
  let stars = '';
  if (false) { // old drifting stars — replaced by the warp streaks (vortexWarp)
    let s2 = 97; const r2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
    for (let q = 0; q < 22; q++) {
      const a = r2() * Math.PI * 2, r0 = 3 + r2() * 4, r1 = 34 + r2() * 10, dur = 2.4 + r2() * 2.6;
      const x0 = cx + r0 * Math.cos(a), y0 = cy + r0 * Math.sin(a) * 0.62;
      stars += `<circle class="vst" cx="${f(x0)}" cy="${f(y0)}" r="${f(0.22 + r2() * 0.38)}" fill="#fff6e8" style="--x:${f((r1 - r0) * Math.cos(a))};--y:${f((r1 - r0) * Math.sin(a) * 0.62)};--t:${f(dur)}s;--d:${f(-r2() * dur)}s"/>`;
    }
  }
  // live: a galaxy — two spiral arms of star dust (r = a·e^(bθ)) turning slowly in the tilted disc, plus far-off field stars
  let galaxy = '', field = '';
  if (live && !small) {
    let s3 = 4242; const r3 = () => ((s3 = (s3 * 16807) % 2147483647) / 2147483647);
    const gauss = () => { let u = 0; for (let j = 0; j < 4; j++) u += r3(); return (u - 2) / 1.15; };
    const A = 1.5, Bp = 0.3, RM = 27, TM = Math.log(RM / A) / Bp;
    const tone = (t) => { const w = Math.min(1, t); return `rgb(${Math.round(255 - 40 * w)},${Math.round(246 - 22 * w)},${Math.round(232 - 2 * w)})`; };
    let haze = '';
    for (let arm = 0; arm < 2; arm++) {
      const off = arm * Math.PI;
      let d = '';
      for (let k2 = 0; k2 <= 48; k2++) { const t = (k2 / 48) * TM * 0.95 + 0.6, r = A * Math.exp(Bp * t); d += `${k2 ? 'L' : 'M'}${f(r * Math.cos(t + off))} ${f(r * Math.sin(t + off))}`; }
      haze += `<path d="${d}" fill="none" stroke="#efe6d6" stroke-opacity=".17" stroke-width="5.5" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff3df" stroke-opacity=".26" stroke-width="1.8" stroke-linecap="round"/>`;
      for (let q = 0; q < 210; q++) {
        const t = Math.pow(r3(), 0.85) * TM, r = A * Math.exp(Bp * t) * (1 + gauss() * 0.07), w = r / RM;
        const a = t + off + gauss() * (0.16 + 0.12 * w);
        galaxy += `<circle cx="${f(r * Math.cos(a))}" cy="${f(r * Math.sin(a))}" r="${f((0.16 + r3() * 0.42) * (1 - 0.35 * w))}" fill="${tone(w)}" opacity="${f((0.45 + r3() * 0.55) * (1 - 0.45 * w))}"/>`;
      }
    }
    for (let q = 0; q < 110; q++) { // disc dust between the arms
      const r = Math.min(RM, -Math.log(1 - r3() * 0.98) * 7), a = r3() * Math.PI * 2, w = r / RM;
      galaxy += `<circle cx="${f(r * Math.cos(a))}" cy="${f(r * Math.sin(a))}" r="${f(0.12 + r3() * 0.22)}" fill="${tone(w)}" opacity="${f((0.25 + r3() * 0.4) * (1 - 0.5 * w))}"/>`;
    }
    galaxy = `<g transform="translate(${cx} ${cy}) scale(1 ${k})"><g class="vgal"><ellipse rx="9" ry="9" fill="url(#vxg${n})" opacity=".55"/><g filter="url(#vxh${n})">${haze}</g>${galaxy}</g></g>`;
    for (let q = 0; q < 26; q++) {
      const x = r3() * 64, y = r3() * 64;
      if (Math.hypot((x - cx) / 1.6, y - cy) < 13) continue;
      field += `<circle class="vfs" cx="${f(x)}" cy="${f(y)}" r="${f(0.15 + r3() * 0.3)}" fill="#fff" opacity="${f(0.25 + r3() * 0.5)}" style="--d:${f(-r3() * 4)}s"/>`;
    }
  }
  // live: the white hole becomes a sun — a warm disc, a soft corona and slowly turning rays
  const sun = false; // Ryo: keep it a white hole (the sun version is kept here in case)
  let rays = '';
  if (sun) {
    let s4 = 313; const r4 = () => ((s4 = (s4 * 16807) % 2147483647) / 2147483647);
    for (let q = 0; q < 14; q++) {
      const a = (q / 14) * Math.PI * 2 + r4() * 0.2, L = 4.5 + r4() * 5.5, w = 0.35 + r4() * 0.35, ca = Math.cos(a), sa = Math.sin(a);
      const x0 = 2.4 * ca, y0 = 2.4 * sa, x1 = (2.4 + L) * ca, y1 = (2.4 + L) * sa, nx = -sa * w, ny = ca * w;
      rays += `<path d="M${f(x0 + nx)} ${f(y0 + ny)} L${f(x1)} ${f(y1)} L${f(x0 - nx)} ${f(y0 - ny)}Z" fill="#ffe2a8" opacity="${f(0.25 + r4() * 0.3)}"/>`;
    }
  }
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"${anim || live ? ` class="${anim ? 'vortex-anim' : ''}${live ? ' vortex-live' : ''}"` : ''}><defs>
    <radialGradient id="vxb${n}" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#161618"/><stop offset="1" stop-color="#0b0b0c"/></radialGradient>
    <radialGradient id="vxg${n}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#fff6e8" stop-opacity=".95"/><stop offset=".6" stop-color="#e7dfd1" stop-opacity=".35"/><stop offset="1" stop-color="#e7dfd1" stop-opacity="0"/></radialGradient>
    <clipPath id="vxc${n}"><rect width="64" height="64" rx="15"/></clipPath>
    <radialGradient id="vxs${n}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".16" stop-color="#fff6e0"/><stop offset=".3" stop-color="#ffe2a4" stop-opacity=".85"/><stop offset=".55" stop-color="#ffbe6e" stop-opacity=".32"/><stop offset=".8" stop-color="#ff9a4a" stop-opacity=".08"/><stop offset="1" stop-color="#ff9a4a" stop-opacity="0"/></radialGradient>
    <radialGradient id="vxd${n}" cx=".45" cy=".42" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#fff3d2"/><stop offset=".85" stop-color="#ffd58a"/><stop offset="1" stop-color="#ffb35a"/></radialGradient>
    <filter id="vxh${n}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="1.4"/></filter>
    <filter id="vxf${n}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${bg ? `<rect width="64" height="64" rx="15" fill="url(#vxb${n})"/>` : ''}
    <g${live ? '' : ` clip-path="url(#vxc${n})"`}>${field}<g class="vss">${streaks}</g>${stars ? `<g class="vsts">${stars}</g>` : ''}<g transform="rotate(-6 ${cx} ${cy})"><g fill="none" filter="url(#vxf${n})" class="vrs">${rings}</g>${galaxy}${dots}
    ${sun ? `<g transform="translate(${cx} ${cy}) rotate(6)"><g class="vrays">${rays}</g></g>
    <ellipse class="vcore" cx="${cx}" cy="${cy}" rx="10.5" ry="9" fill="url(#vxs${n})"/><circle class="vdot vsun" cx="${cx}" cy="${cy}" r="2.6" fill="url(#vxd${n})"/>`
    : `<ellipse class="vcore" cx="${cx}" cy="${cy}" rx="${small ? 9 : 10}" ry="${small ? 7 : 6.5}" fill="url(#vxg${n})"/><circle class="vdot" cx="${cx}" cy="${cy}" r="${small ? 2.4 : 1.8}" fill="#fff"/>`}</g></g></svg>`;
}

// Startup "stars passing by": a 3D warp field drawn on a canvas. Stars fly out of the white hole toward you
// and stretch into streaks as they pass. Pure function of time, so it looks the same on every PC.
//   z(t) = z0 − S(t),  S = A·τ·(1 − e^−(t−T0)/τ) + B·(t − T0)   (a burst on the boom, then a calm drift)
function vortexWarp(canvas, { T0 = 0.7, A = 3.4, tau = 0.3, B = 0.22, fadeIn = 0.1, outAt = 1.45, outLen = 0.45, n = 140, loop = 0, scale = 0.42, alpha = 0.8, clear = 140, widthK = 1, fit = 'max' } = {}) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = Array.from({ length: n }, () => {
    let x, y; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; } while (Math.hypot(x, y) < 0.06 || Math.hypot(x, y) > 1);
    return { x, y, z0: rnd(), w: 0.6 + rnd() * 0.8, warm: rnd() };
  });
  // loop = a calm, endless drift at that speed (About, update card); otherwise the one-off burst of the startup
  const S = loop ? (t) => loop * t : (t) => (t <= T0 ? 0 : A * tau * (1 - Math.exp(-(t - T0) / tau)) + B * (t - T0));
  return function draw(t, cx, cy) {
    const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const env = loop ? Math.min(1, t / 0.8) : Math.max(0, Math.min(1, (t - T0 + 0.02) / fadeIn)) * Math.max(0, Math.min(1, 1 - (t - outAt) / outLen));
    if (env <= 0) return;
    const f = (fit === 'min' ? Math.min(W, H) : Math.max(W, H)) * scale, s1 = S(t), s0 = S(t - 0.045);
    ctx.lineCap = 'round';
    for (const p of stars) {
      const z1 = 0.03 + ((((p.z0 - s1) % 1) + 1) % 1) * 0.97, z0 = 0.03 + ((((p.z0 - s0) % 1) + 1) % 1) * 0.97;
      if (z0 < z1) continue; // just wrapped back to the far end
      const x1 = cx + (p.x / z1) * f, y1 = cy + (p.y / z1) * f * 0.8, x0 = cx + (p.x / z0) * f, y0 = cy + (p.y / z0) * f * 0.8;
      if (x0 < -50 || x0 > W + 50 || y0 < -50 || y0 > H + 50) continue;
      const near = 1 - z1, d = Math.hypot(x1 - cx, y1 - cy);
      const a = alpha * env * Math.min(1, near * 1.5) * Math.min(1, d / clear);
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(255,${Math.round(240 + p.warm * 10)},${Math.round(222 + p.warm * 18)},${a.toFixed(3)})`;
      ctx.lineWidth = p.w * (0.35 + near * 1.8) * widthK;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  };
}

// Endless gentle warp behind a logo (About page, update card). The canvas fills its box; stars come out of the logo's centre.
function vortexWarpAround(host, canvas, opts = {}) {
  if (document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const draw = vortexWarp(canvas, { loop: 0.2, n: 120, fit: 'min', scale: 0.3, alpha: 0.9, clear: 34, widthK: 0.8, ...opts }), t0 = performance.now();
  const frame = () => {
    if (!canvas.isConnected) return;
    const sv = host.querySelector('svg'), cr = canvas.getBoundingClientRect(), r = sv ? sv.getBoundingClientRect() : cr;
    if (cr.width) draw((performance.now() - t0) / 1000, r.left - cr.left + r.width / 2, r.top - cr.top + r.height * 0.484);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// A galaxy to sit behind things (startup, About, update card): the Milky Way band with dust lanes,
// faint nebulae and a few hundred stars. Drawn from the same numbers every time.
let galaxyBgSeq = 0;
function galaxyBg({ w = 1600, h = 1000, stars = 420, band = true } = {}) {
  const n = ++galaxyBgSeq;
  let seed = 2026; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const f = (v) => v.toFixed(1);
  const bandAt = (x) => h * 0.62 - (x / w) * h * 0.34; // the band runs low-left to high-right
  let st = '', tw = '';
  for (let i = 0; i < stars; i++) {
    const x = r() * w;
    const inBand = band && r() < 0.55;
    const y = inBand ? bandAt(x) + (r() + r() + r() - 1.5) * h * 0.16 : r() * h;
    const big = r() < 0.04, rad = big ? 1.1 + r() * 1.1 : 0.35 + r() * 0.75;
    const warm = r(), col = warm < 0.2 ? '#ffe7c4' : warm > 0.85 ? '#dfe8ff' : '#fffaf2';
    const el = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="${col}" opacity="${f(0.35 + r() * 0.6)}"${big ? ` filter="url(#gbg${n})"` : ''}/>`;
    if (r() < 0.16) tw += el.replace('<circle ', `<circle class="gtw" style="--d:${f(-r() * 5)}s" `); else st += el;
  }
  const blob = (cx, cy, rx, ry, rot, col, op) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${rot} ${f(cx)} ${f(cy)})" fill="${col}" opacity="${op}"/>`;
  const ang = -Math.atan2(h * 0.34, w) * 180 / Math.PI;
  const neb = [
    blob(w * 0.5, bandAt(w * 0.5), w * 0.62, h * 0.13, ang, '#e9dcc6', 0.10),
    blob(w * 0.52, bandAt(w * 0.52), w * 0.42, h * 0.06, ang, '#fff1d8', 0.11),
    blob(w * 0.22, bandAt(w * 0.22) + h * 0.05, w * 0.2, h * 0.12, ang + 8, '#7d5f9c', 0.16),
    blob(w * 0.78, bandAt(w * 0.78) - h * 0.04, w * 0.22, h * 0.11, ang - 6, '#3f6f86', 0.16),
    blob(w * 0.62, bandAt(w * 0.62) + h * 0.06, w * 0.14, h * 0.08, ang, '#9c6a48', 0.12),
  ].join('');
  const dust = [
    blob(w * 0.45, bandAt(w * 0.45) + h * 0.015, w * 0.34, h * 0.022, ang + 1, '#060607', 0.55),
    blob(w * 0.7, bandAt(w * 0.7) - h * 0.01, w * 0.18, h * 0.016, ang - 2, '#060607', 0.45),
  ].join('');
  return `<svg class="galaxy-bg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>
    <radialGradient id="gbv${n}" cx=".5" cy=".46" r=".75"><stop offset="0" stop-color="#121216"/><stop offset="1" stop-color="#070708"/></radialGradient>
    <filter id="gbn${n}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(h * 0.045)}"/></filter>
    <filter id="gbd${n}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(h * 0.012)}"/></filter>
    <filter id="gbg${n}" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${band ? `<rect width="${w}" height="${h}" fill="url(#gbv${n})"/>` : ''}
    ${band ? `<g filter="url(#gbn${n})">${neb}</g><g filter="url(#gbd${n})">${dust}</g>` : ''}
    <g>${st}</g><g>${tw}</g></svg>`;
}
