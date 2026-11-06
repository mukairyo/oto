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
  if (live && !small) {
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
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"${anim || live ? ` class="${anim ? 'vortex-anim' : ''}${live ? ' vortex-live' : ''}"` : ''}><defs>
    <radialGradient id="vxb${n}" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#161618"/><stop offset="1" stop-color="#0b0b0c"/></radialGradient>
    <radialGradient id="vxg${n}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#fff6e8" stop-opacity=".95"/><stop offset=".6" stop-color="#e7dfd1" stop-opacity=".35"/><stop offset="1" stop-color="#e7dfd1" stop-opacity="0"/></radialGradient>
    <clipPath id="vxc${n}"><rect width="64" height="64" rx="15"/></clipPath>
    <filter id="vxh${n}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="1.4"/></filter>
    <filter id="vxf${n}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${bg ? `<rect width="64" height="64" rx="15" fill="url(#vxb${n})"/>` : ''}
    <g${live ? '' : ` clip-path="url(#vxc${n})"`}>${field}<g class="vss">${streaks}</g>${stars ? `<g class="vsts">${stars}</g>` : ''}<g transform="rotate(-6 ${cx} ${cy})"><g fill="none" filter="url(#vxf${n})" class="vrs">${rings}</g>${galaxy}${dots}
    <ellipse class="vcore" cx="${cx}" cy="${cy}" rx="${small ? 9 : 10}" ry="${small ? 7 : 6.5}" fill="url(#vxg${n})"/><circle class="vdot" cx="${cx}" cy="${cy}" r="${small ? 2.4 : 1.8}" fill="#fff"/></g></g></svg>`;
}

// Startup "stars passing by": a 3D warp field drawn on a canvas. Stars fly out of the white hole toward you
// and stretch into streaks as they pass. Pure function of time, so it looks the same on every PC.
//   z(t) = z0 − S(t),  S = A·τ·(1 − e^−(t−T0)/τ) + B·(t − T0)   (a burst on the boom, then a calm drift)
function vortexWarp(canvas, { T0 = 0.7, A = 3.4, tau = 0.3, B = 0.22, fadeIn = 0.1, outAt = 1.45, outLen = 0.45, n = 140 } = {}) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = Array.from({ length: n }, () => {
    let x, y; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; } while (Math.hypot(x, y) < 0.06 || Math.hypot(x, y) > 1);
    return { x, y, z0: rnd(), w: 0.6 + rnd() * 0.8, warm: rnd() };
  });
  const S = (t) => (t <= T0 ? 0 : A * tau * (1 - Math.exp(-(t - T0) / tau)) + B * (t - T0));
  return function draw(t, cx, cy) {
    const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const env = Math.max(0, Math.min(1, (t - T0 + 0.02) / fadeIn)) * Math.max(0, Math.min(1, 1 - (t - outAt) / outLen));
    if (env <= 0) return;
    const f = Math.max(W, H) * 0.42, s1 = S(t), s0 = S(t - 0.045);
    ctx.lineCap = 'round';
    for (const p of stars) {
      const z1 = 0.03 + ((((p.z0 - s1) % 1) + 1) % 1) * 0.97, z0 = 0.03 + ((((p.z0 - s0) % 1) + 1) % 1) * 0.97;
      if (z0 < z1) continue; // just wrapped back to the far end
      const x1 = cx + (p.x / z1) * f, y1 = cy + (p.y / z1) * f * 0.8, x0 = cx + (p.x / z0) * f, y0 = cy + (p.y / z0) * f * 0.8;
      if (x0 < -50 || x0 > W + 50 || y0 < -50 || y0 > H + 50) continue;
      const near = 1 - z1, d = Math.hypot(x1 - cx, y1 - cy);
      const a = 0.8 * env * Math.min(1, near * 1.5) * Math.min(1, d / 150);
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(255,${Math.round(240 + p.warm * 10)},${Math.round(222 + p.warm * 18)},${a.toFixed(3)})`;
      ctx.lineWidth = p.w * (0.35 + near * 1.8);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  };
}
