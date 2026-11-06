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
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"${anim || live ? ` class="${anim ? 'vortex-anim' : ''}${live ? ' vortex-live' : ''}"` : ''}><defs>
    <radialGradient id="vxb${n}" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#161618"/><stop offset="1" stop-color="#0b0b0c"/></radialGradient>
    <radialGradient id="vxg${n}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#fff6e8" stop-opacity=".95"/><stop offset=".6" stop-color="#e7dfd1" stop-opacity=".35"/><stop offset="1" stop-color="#e7dfd1" stop-opacity="0"/></radialGradient>
    <clipPath id="vxc${n}"><rect width="64" height="64" rx="15"/></clipPath>
    <filter id="vxf${n}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${bg ? `<rect width="64" height="64" rx="15" fill="url(#vxb${n})"/>` : ''}
    <g${live ? '' : ` clip-path="url(#vxc${n})"`}><g class="vss">${streaks}</g><g transform="rotate(-6 ${cx} ${cy})"><g fill="none" filter="url(#vxf${n})" class="vrs">${rings}</g>${dots}
    <ellipse class="vcore" cx="${cx}" cy="${cy}" rx="${small ? 9 : 10}" ry="${small ? 7 : 6.5}" fill="url(#vxg${n})"/><circle class="vdot" cx="${cx}" cy="${cy}" r="${small ? 2.4 : 1.8}" fill="#fff"/></g></g></svg>`;
}
