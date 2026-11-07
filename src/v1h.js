'use strict';
/* Oto — your phone on your PC.
   Oto for Android signs in to the same Oto account and reports itself (name, battery, open tabs).
   This panel shows it as a 3D phone you can turn, lists its tabs, and sends tabs both ways.
   The data is end-to-end encrypted in account.js; the 3D model of your own phone stays on this PC. */

const PH = { devices: [], me: null, err: '', code: '', at: 0, sel: null, open: null, timer: 0, seenInbox: new Set() };
const phPhones = () => PH.devices.filter((d) => d.kind === 'phone');
const phOnline = (d) => d && Date.now() - (d.seen || 0) < 100000;
function phAgo(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const phHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

// ---------------------------------------------------------------- talking to the account
function phTabsNow() {
  return S.tabs.filter((t) => /^https?:/i.test(t.url || '') && !t.private && !t.incognito).slice(0, 40).map((t) => ({ t: t.title || '', u: t.url }));
}
async function phBeat(force) {
  if (typeof AVOCADO_MODE !== 'undefined' && AVOCADO_MODE) return;
  if (!V1A.st || !V1A.st.signedIn) { PH.devices = []; PH.code = 'auth'; return; }
  const a = activeTab();
  let r;
  try { r = await (PH.api || oto.account).devicesBeat({ tabs: phTabsNow(), active: a && /^https?:/.test(a.url || '') ? a.url : '', force: !!force }); } catch (e) { r = { ok: false, error: e.message }; }
  PH.at = Date.now();
  if (!r || !r.ok) { PH.err = (r && r.error) || ''; PH.code = (r && r.code) || 'err'; return; }
  PH.err = ''; PH.code = ''; PH.devices = r.devices || []; PH.me = r.me;
  for (const m of r.inbox || []) {
    const key = `${m.u}|${m.at}`;
    if (PH.seenInbox.has(key)) continue;
    PH.seenInbox.add(key);
    openUrl(m.u, { newTabForce: true, background: true });
    toast(`From ${m.from || 'your phone'}: ${m.t || phHost(m.u)}`, { icon: 'phone', timeout: 4200 });
  }
}
function phLoop() {
  clearTimeout(PH.timer);
  const next = PH.open ? 8000 : 30000;
  PH.timer = setTimeout(async () => { await phBeat(); if (PH.open) PH.open.paint(); phLoop(); }, next);
}
async function phSend(d, url, title) {
  if (!url || !/^https?:/.test(url)) return toast('Only web pages can be sent', { timeout: 2200 });
  const r = await (PH.api || oto.account).devicesSend(d.id, url, title || '');
  if (r && r.ok) toast(phOnline(d) ? `Sent to ${d.name || 'your phone'} ✓` : `Sent — it opens next time Oto is open on ${d.name || 'your phone'}`, { icon: 'check', timeout: 2800 });
  else toast((r && r.error) || 'Couldn’t send', { timeout: 2800 });
}

// ---------------------------------------------------------------- the 3D phone
let ph3dLoading = null;
function ph3dLib() {
  if (window.OTO3D) return Promise.resolve(window.OTO3D);
  if (!ph3dLoading) ph3dLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/three.min.js'; s.onload = () => res(window.OTO3D); s.onerror = rej; document.head.append(s); });
  return ph3dLoading;
}
// The picture on the Oto phone's screen: the phone's real battery and the page open on it.
function phScreenCanvas(cv, d) {
  const W = cv.width, H = cv.height, x = cv.getContext('2d');
  x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, W, H);
  let s = 77; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) { x.globalAlpha = 0.15 + r() * 0.5; x.fillStyle = '#fffaf2'; x.beginPath(); x.arc(r() * W, r() * H, 0.6 + r() * 1.4, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  const mono = (sz, w = 600) => `${w} ${sz}px "Roboto Mono", Consolas, monospace`;
  x.fillStyle = 'rgba(236,232,225,.75)'; x.font = mono(22);
  x.fillText(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), 40, 58);
  const b = d && d.battery != null ? Math.round(d.battery) : null;
  if (b != null) { x.textAlign = 'right'; x.fillText(`${b}%`, W - 40, 58); x.textAlign = 'left'; }
  // crumb
  const cy = H * 0.34;
  x.strokeStyle = 'rgba(236,232,225,.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(40, cy); x.lineTo(70, cy); x.stroke();
  x.fillStyle = '#ece8e1'; x.font = '400 26px "Noto Serif JP", "Yu Mincho", serif'; x.fillText('音', 82, cy + 9);
  x.fillStyle = 'rgba(236,232,225,.6)'; x.font = mono(17); x.fillText('HOME / BROWSE', 122, cy + 6);
  const hr = new Date().getHours();
  x.fillStyle = '#ece8e1'; x.font = '400 64px "Instrument Serif", Georgia, serif';
  x.fillText(hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : hr < 22 ? 'Good evening' : 'Good night', 40, cy + 96);
  // search pill
  const py = cy + 140;
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2; x.beginPath(); x.roundRect(40, py, W - 80, 74, 10); x.stroke();
  x.fillStyle = 'rgba(236,232,225,.4)'; x.font = '400 24px system-ui, sans-serif'; x.fillText('Search or enter address', 76, py + 46);
  // what's open on the phone
  const act = d && (d.tabs || []).find((t) => t.u === d.active) || (d && (d.tabs || [])[0]);
  if (act) {
    const ny = py + 120;
    x.fillStyle = 'rgba(255,255,255,.04)'; x.beginPath(); x.roundRect(40, ny, W - 80, 120, 10); x.fill();
    x.fillStyle = 'rgba(236,232,225,.5)'; x.font = mono(15); x.fillText('NOW OPEN', 64, ny + 36);
    x.fillStyle = '#ece8e1'; x.font = '600 25px system-ui, sans-serif';
    let t = act.t || phHost(act.u); while (x.measureText(t).width > W - 130 && t.length > 4) t = `${t.slice(0, -2)}…`;
    x.fillText(t, 64, ny + 74);
    x.fillStyle = 'rgba(236,232,225,.45)'; x.font = '400 19px system-ui, sans-serif'; x.fillText(phHost(act.u), 64, ny + 102);
  }
  // bottom bar
  x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, H - 120, W, 1);
  x.strokeStyle = 'rgba(236,232,225,.7)'; x.lineWidth = 3;
  const bx = [W * 0.14, W * 0.32, W * 0.5, W * 0.68, W * 0.86];
  x.beginPath(); x.moveTo(bx[0] + 8, H - 72); x.lineTo(bx[0] - 6, H - 60); x.lineTo(bx[0] + 8, H - 48); x.stroke();
  x.beginPath(); x.moveTo(bx[1] - 8, H - 72); x.lineTo(bx[1] + 6, H - 60); x.lineTo(bx[1] - 8, H - 48); x.stroke();
  x.beginPath(); x.arc(bx[2], H - 60, 12, 0, 7); x.stroke();
  x.beginPath(); x.roundRect(bx[3] - 12, H - 72, 24, 24, 5); x.stroke();
  x.beginPath(); for (const yy of [-8, 0, 8]) { x.moveTo(bx[4] - 11, H - 60 + yy); x.lineTo(bx[4] + 11, H - 60 + yy); } x.stroke();
  x.fillStyle = 'rgba(236,232,225,.55)'; x.fillRect(W / 2 - 70, H - 22, 140, 5);
}
// Oto's own phone: an original shape (rounded slab, glass screen, a camera pill and the vortex rings).
function phOtoPhone(T, data) {
  const g = new T.Group();
  const W = 0.78, H = 1.66, D = 0.07, R = 0.11, BV = 0.014;
  const rr = (w, h, r) => { const s = new T.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const body = new T.ExtrudeGeometry(rr(W - BV * 2, H - BV * 2, R), { depth: D, bevelEnabled: true, bevelThickness: BV, bevelSize: BV, bevelSegments: 6, curveSegments: 24 });
  body.translate(0, 0, -D / 2);
  const frame = new T.MeshPhysicalMaterial({ color: 0x2a2a2e, metalness: 0.85, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  g.add(new T.Mesh(body, frame));
  const zf = D / 2 + BV;
  // back glass with the vortex rings
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 1090;
  { const x = bc.getContext('2d'); const grd = x.createLinearGradient(0, 0, 512, 1090); grd.addColorStop(0, '#1b1b1f'); grd.addColorStop(1, '#0e0e11'); x.fillStyle = grd; x.fillRect(0, 0, 512, 1090);
    x.translate(256, 600); x.rotate(-0.1);
    for (let i = 0; i < 7; i++) { const rr2 = 30 + i * 17; x.strokeStyle = `rgba(231,223,209,${0.55 - i * 0.065})`; x.lineWidth = 2.2 - i * 0.2; x.beginPath(); x.ellipse(0, 0, rr2, rr2 * 0.46, 0, 0, 7); x.stroke(); }
    x.fillStyle = '#e7dfd1'; x.beginPath(); x.ellipse(0, 0, 9, 9, 0, 0, 7); x.fill();
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = 'rgba(231,223,209,.5)'; x.font = '600 20px "Roboto Mono", Consolas, monospace'; x.textAlign = 'center'; x.fillText('O T O', 256, 990); }
  const backTex = new T.CanvasTexture(bc); backTex.colorSpace = T.SRGBColorSpace; backTex.anisotropy = 8;
  const plate = (w, h, r, mat, z, flip) => { const geo = new T.ShapeGeometry(rr(w, h, r), 24); const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (flip ? -p.getX(i) : p.getX(i)) / w + 0.5, p.getY(i) / h + 0.5); const m = new T.Mesh(geo, mat); m.position.z = z; if (flip) m.rotation.y = Math.PI; return m; };
  g.add(plate(W - 0.03, H - 0.03, R - 0.012, new T.MeshPhysicalMaterial({ map: backTex, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }), -zf - 0.0006, true));
  // screen: black glass border + the live picture
  g.add(plate(W - 0.02, H - 0.02, R - 0.008, new T.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.06, metalness: 0, clearcoat: 1 }), zf + 0.0004));
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 1092;
  phScreenCanvas(sc, data);
  const scTex = new T.CanvasTexture(sc); scTex.colorSpace = T.SRGBColorSpace; scTex.anisotropy = 8;
  const screen = plate(W - 0.07, H - 0.07, R - 0.03, new T.MeshBasicMaterial({ map: scTex, toneMapped: false }), zf + 0.0012);
  g.add(screen);
  // front camera dot
  const dot = new T.Mesh(new T.CircleGeometry(0.014, 24), new T.MeshBasicMaterial({ color: 0x000000 })); dot.position.set(0, H / 2 - 0.075, zf + 0.002); g.add(dot);
  // camera pill on the back
  const pill = new T.Mesh(new T.CapsuleGeometry(0.075, 0.19, 8, 24), new T.MeshPhysicalMaterial({ color: 0x141417, metalness: 0.7, roughness: 0.25, clearcoat: 1 }));
  pill.scale.z = 0.25; pill.position.set(-W / 2 + 0.16, H / 2 - 0.27, -zf - 0.01); g.add(pill);
  for (const dy of [0.095, -0.095]) {
    const ring = new T.Mesh(new T.TorusGeometry(0.052, 0.009, 12, 40), new T.MeshPhysicalMaterial({ color: 0xcfc6b6, metalness: 1, roughness: 0.25 }));
    ring.position.set(-W / 2 + 0.16, H / 2 - 0.27 + dy, -zf - 0.03); g.add(ring);
    const lens = new T.Mesh(new T.CircleGeometry(0.046, 32), new T.MeshPhysicalMaterial({ color: 0x030306, roughness: 0.02, metalness: 0.3, clearcoat: 1, iridescence: 0.6 }));
    lens.position.copy(ring.position); lens.position.z -= 0.004; lens.rotation.y = Math.PI; g.add(lens);
  }
  // side buttons
  const btn = new T.MeshPhysicalMaterial({ color: 0x3a3a3f, metalness: 0.9, roughness: 0.3 });
  for (const [y, h2] of [[0.36, 0.2], [0.1, 0.11]]) { const m = new T.Mesh(new T.CapsuleGeometry(0.009, h2, 4, 12), btn); m.position.set(W / 2 + 0.003, y, 0); g.add(m); }
  g.userData.screen = { canvas: sc, tex: scTex };
  return g;
}
function phStage(canvas, getData) {
  let alive = true, raf = 0, renderer, scene, cam, holder, model = null, env;
  const st = { yaw: -0.45, pitch: 0.08, vy: 0, drag: null, t0: performance.now(), userModel: false };
  const api = {
    async setModel(useOwn) {
      const T = (await ph3dLib()).THREE;
      if (!alive) return;
      if (model) { holder.remove(model); model.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); model = null; }
      let m = null;
      if (useOwn) {
        const buf = await oto.phoneModel();
        if (buf && buf.byteLength) {
          try {
            const { GLTFLoader } = window.OTO3D;
            const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            const gl = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
            m = gl.scene;
            const box = new T.Box3().setFromObject(m), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
            m.position.sub(c);
            const wrap = new T.Group(); wrap.add(m);
            // stand it up: the longest side is the phone's height
            if (size.z > size.y && size.z >= size.x) wrap.rotation.x = -Math.PI / 2;
            else if (size.x > size.y) wrap.rotation.z = Math.PI / 2;
            const k = 1.66 / Math.max(size.x, size.y, size.z);
            wrap.scale.setScalar(k);
            m = wrap;
          } catch (e) { toast('Couldn’t open that 3D model', { timeout: 2400 }); m = null; }
        }
      }
      st.userModel = !!m;
      if (!m) m = phOtoPhone(T, getData());
      model = m; holder.add(m);
      st.t0 = performance.now();
      return st.userModel;
    },
    refreshScreen() { const s = model && model.userData.screen; if (s) { phScreenCanvas(s.canvas, getData()); s.tex.needsUpdate = true; } },
    get userModel() { return st.userModel; },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      try { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); } } catch {}
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    },
  };
  const move = (e) => { if (!st.drag) return; const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y; st.drag.x = e.clientX; st.drag.y = e.clientY; st.yaw += dx * 0.01; st.vy = dx * 0.01; st.pitch = clamp(st.pitch + dy * 0.006, -0.6, 0.6); };
  const up = () => { if (st.drag) { st.drag = null; canvas.classList.remove('grab'); } };
  canvas.addEventListener('pointerdown', (e) => { st.drag = { x: e.clientX, y: e.clientY }; st.vy = 0; canvas.classList.add('grab'); });
  addEventListener('pointermove', move); addEventListener('pointerup', up);
  (async () => {
    const L = await ph3dLib();
    if (!alive) return;
    const T = L.THREE;
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = T.SRGBColorSpace;
    scene = new T.Scene();
    const pm = new T.PMREMGenerator(renderer); env = pm.fromScene(new L.RoomEnvironment(), 0.04).texture; scene.environment = env; pm.dispose();
    const key = new T.DirectionalLight(0xfff3e0, 1.6); key.position.set(2, 3, 4); scene.add(key);
    const rim = new T.DirectionalLight(0xe7dfd1, 2.2); rim.position.set(-3, 1, -3); scene.add(rim);
    cam = new T.PerspectiveCamera(28, 1, 0.1, 50); cam.position.set(0, 0, 4.4);
    holder = new T.Group(); scene.add(holder);
    await api.setModel(!!S.settings.phoneOwnModel);
    const size = () => { const r = canvas.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); };
    size();
    let last = performance.now();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      size();
      // entrance: comes out of the white hole spinning, then settles into a slow turn
      const e = Math.min(1, (now - st.t0) / 1500), ease = 1 - (1 - e) ** 3;
      if (!st.drag) { st.vy *= 0.94; st.yaw += st.vy + (reduce ? 0 : dt * 0.32); }
      holder.rotation.set(st.pitch + Math.sin(now / 2400) * 0.03, st.yaw + (1 - ease) * -5.5, 0);
      holder.scale.setScalar(0.25 + 0.75 * ease);
      holder.position.y = Math.sin(now / 1800) * 0.025;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  })().catch((e) => { console.warn('[oto phone 3d]', e && e.message); canvas.closest('.ph-stage')?.classList.add('no3d'); });
  return api;
}

// ---------------------------------------------------------------- the panel
async function v1Phone() {
  if (PH.open) return;
  v1ClosePop();
  const layer = v1Layer(() => close());
  const box = h('div', { class: 'v1-ph enter' });
  const stage = h('div', { class: 'ph-stage' },
    h('div', { class: 'sky', html: galaxyBg({ w: 520, h: 640, stars: 260, band: false }) }),
    h('i', { class: 'glow' }),
    h('canvas', { class: 'ph3d' }),
    h('div', { class: 'cap' }, h('span', {}, 'DRAG TO TURN'), h('span', { class: 'r' }), h('span', { class: 'mdl' })));
  const info = h('div', { class: 'ph-info' });
  box.append(stage, info, h('button', { class: 'ph-x', title: 'Close', html: icon('close'), onclick: () => close() }));
  layer.append(box);
  const cur = () => phPhones().find((d) => d.id === PH.sel) || phPhones()[0] || null;
  const st3 = phStage(stage.querySelector('canvas'), cur);
  const mdlRow = () => {
    const el = stage.querySelector('.mdl');
    el.replaceChildren(S.settings.phoneOwnModel
      ? h('span', {}, h('button', { onclick: async () => { S.settings.phoneOwnModel = false; save(); await st3.setModel(false); mdlRow(); } }, 'USE OTO PHONE'), ' · ', h('button', { onclick: async () => { const r = await oto.phonePickModel(); if (r.ok) { await st3.setModel(true); mdlRow(); } else if (r.error) toast(r.error, { timeout: 2600 }); } }, 'CHANGE MODEL'))
      : h('button', { onclick: async () => { const r = await oto.phonePickModel(); if (!r.ok) { if (r.error) toast(r.error, { timeout: 2600 }); return; } S.settings.phoneOwnModel = true; save(); const ok = await st3.setModel(true); if (!ok) { S.settings.phoneOwnModel = false; save(); } mdlRow(); } }, 'USE MY OWN 3D MODEL'));
  };
  mdlRow();
  const crumb = (txt, n) => h('div', { class: 'ph-crumb' }, h('i', {}), h('b', {}, '音'), h('span', {}, txt), h('em', {}), h('span', {}, n));
  const paint = () => {
    const st = V1A.st || {};
    const phones = phPhones(), d = cur();
    stage.classList.toggle('waiting', !d);
    const out = [];
    if (!st.signedIn) {
      out.push(crumb('PHONE / LINK', '01'), h('h1', {}, 'Link your phone'),
        h('p', { class: 'sub' }, 'Sign in to your Oto account here and in Oto on your Android phone. Your phone then shows up here: its battery, its open tabs, and tabs you send both ways.'),
        h('div', { class: 'ph-acts' }, h('button', { class: 'pri', onclick: () => { close(); openSettings('account'); } }, 'SIGN IN')));
    } else if (PH.code === 'setup') {
      out.push(crumb('PHONE / LINK', '01'), h('h1', {}, 'Almost there'),
        h('p', { class: 'sub' }, 'The Oto server needs the phone tables (oto_devices and oto_inbox) before your phone can link. Run the phone SQL in Supabase, then come back.'));
    } else if (!d) {
      out.push(crumb('PHONE / LINK', '01'), h('h1', {}, 'No phone yet'),
        h('p', { class: 'sub' }, 'Oto on your phone shows up here a few seconds after it signs in.'),
        h('ol', { class: 'ph-steps' },
          h('li', {}, h('b', {}, '01'), h('span', {}, 'Install Oto for Android on your phone')),
          h('li', {}, h('b', {}, '02'), h('span', {}, `Open the menu → Oto account, and sign in as ${st.email || 'you'}`)),
          h('li', {}, h('b', {}, '03'), h('span', {}, 'Keep Oto open on the phone. It appears here'))),
        PH.err ? h('p', { class: 'ph-err' }, PH.err) : null);
    } else {
      const on = phOnline(d);
      const bat = d.battery != null ? Math.round(d.battery) : null;
      out.push(crumb('PHONE / LINKED', String(phones.length).padStart(2, '0')));
      if (phones.length > 1) out.push(h('div', { class: 'ph-pick' }, ...phones.map((p) => h('button', { class: p.id === d.id ? 'on' : '', onclick: () => { PH.sel = p.id; paint(); st3.refreshScreen(); } }, p.name || 'Phone'))));
      out.push(h('h1', {}, d.locked ? 'Your phone' : (d.name || 'Your phone')));
      out.push(h('div', { class: 'ph-meta' },
        h('span', { class: `st${on ? ' on' : ''}` }, h('i', {}), on ? 'ONLINE' : `SEEN ${phAgo(d.seen).toUpperCase()}`),
        bat != null ? h('span', { class: 'bat' }, h('i', { style: `--b:${bat}`, class: d.charging ? 'chg' : '' }), `${bat}%${d.charging ? ' · CHARGING' : ''}`) : null,
        d.os ? h('span', {}, d.os.toUpperCase()) : null,
        d.app ? h('span', {}, `OTO ${d.app}`) : null));
      if (d.locked) out.push(h('p', { class: 'ph-err' }, 'Sign in again in Oto on your phone. Your password changed, so this PC can’t read it yet.'));
      const a = activeTab();
      out.push(h('div', { class: 'ph-acts' },
        h('button', { class: 'pri', disabled: !(a && /^https?:/.test(a.url || '')) || d.locked, onclick: () => phSend(d, a.url, a.title) }, 'SEND THIS TAB TO PHONE'),
        h('button', { onclick: () => v1SendToPhoneQR(a && a.url) }, 'QR CODE')));
      const tabs = d.tabs || [];
      out.push(h('div', { class: 'ph-lbl' }, h('span', {}, `ON YOUR PHONE · ${tabs.length} ${tabs.length === 1 ? 'TAB' : 'TABS'}`), h('em', {})));
      out.push(h('div', { class: 'ph-tabs' }, ...(tabs.length ? tabs.slice(0, 30).map((t) => h('button', { class: `tb${t.u === d.active ? ' act' : ''}`, title: `Open on this PC\n${t.u}`, onclick: () => { openUrl(t.u, { newTabForce: true }); toast('Opened on this PC', { timeout: 1600 }); } },
        h('span', { class: 'fv' }, phHost(t.u).slice(0, 1).toUpperCase()), h('span', { class: 'tt' }, h('b', {}, t.t || phHost(t.u)), h('small', {}, phHost(t.u))), t.u === d.active ? h('em', {}, 'NOW') : null))
        : [h('p', { class: 'none' }, 'No tabs open on the phone')])));
      out.push(h('div', { class: 'ph-foot' }, h('span', {}, 'END-TO-END ENCRYPTED WITH YOUR OTO PASSWORD'),
        h('button', { onclick: async () => { const r = await oto.account.devicesForget(d.id); if (r && r.ok) { PH.devices = PH.devices.filter((x) => x.id !== d.id); paint(); toast('Phone removed. It comes back if it signs in again', { timeout: 2600 }); } } }, 'FORGET')));
    }
    info.replaceChildren(...out.filter(Boolean));
  };
  function close() {
    if (!PH.open) return;
    st3.destroy(); layer.remove(); PH.open = null; if (v1Pop && v1Pop.isPhone) v1Pop = null; phLoop();
  }
  PH.open = { paint: () => { paint(); st3.refreshScreen(); }, close };
  v1Pop = { isPhone: true, remove: close };
  paint();
  await phBeat(true);
  if (PH.open) { paint(); st3.refreshScreen(); }
  phLoop();
}

let v1SendToPhoneQR = null;
function initV1h() {
  // keep the QR popup, and put "send to <your phone>" on top of it when a phone is linked
  v1SendToPhoneQR = v1SendToPhone;
  const _qr = v1SendToPhone;
  v1SendToPhone = async function (url) {
    await _qr.apply(this, arguments);
    const qbox = document.querySelector('.v1-qr');
    const phones = phPhones().filter((d) => !d.locked);
    if (!qbox || !phones.length || !/^https?:/.test(url || '')) return;
    const t = S.tabs.find((x) => x.url === url);
    qbox.querySelector('b').after(h('div', { class: 'ph-direct' }, ...phones.map((d) => h('button', { onclick: () => { v1ClosePop(); phSend(d, url, t && t.title); } }, iconEl('phone'), h('span', {}, `Send to ${d.name || 'phone'}`), h('i', { class: phOnline(d) ? 'on' : '' })))));
  };
  V1_FOOT.myphone = ['phone', 'My phone', () => v1Phone()];
  if (!V1_FOOT_DEFAULT.includes('myphone')) V1_FOOT_DEFAULT.push('myphone');
  // 1.0.1: Oto Health and Settings left the bottom of the sidebar (still in Customize buttons, the ⋯ menu and their shortcuts)
  if (Array.isArray(S.settings.v1Foot) && !S.settings.v1Foot101) { S.settings.v1Foot = S.settings.v1Foot.filter((k) => k !== 'health' && k !== 'settings'); S.settings.v1Foot101 = true; save(); }
  // people who customised their buttons get it once, too
  if (Array.isArray(S.settings.v1Foot) && !S.settings.v1PhoneBtn) { if (!S.settings.v1Foot.includes('myphone')) S.settings.v1Foot.splice(Math.min(2, S.settings.v1Foot.length), 0, 'myphone'); S.settings.v1PhoneBtn = true; save(); }
  try { v1RenderFoot(); } catch {}
  ACTIONS.push({ name: 'My phone', kw: 'phone android mobile linked device send tab 3d', icon: 'phone', run: () => v1Phone() });
  setTimeout(async () => { await phBeat(); phLoop(); }, 6000);
}
