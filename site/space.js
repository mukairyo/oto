// Oto website: the space around the page. A galaxy backdrop that drifts a little as you scroll, and an optional
// ambient "space" sound made live in the browser (no audio files): a slow drone chord, a soft space wind and a
// far-off shimmer now and then. Sound starts only when the visitor turns it on (button, bottom right).
(() => {
  // backdrop parallax
  const bg = document.querySelector('.spacebg');
  if (bg && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let tick = false;
    const move = () => { tick = false; bg.style.transform = `translate3d(0, ${-Math.min(scrollY, 20000) * 0.035}px, 0)`; };
    addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(move); } }, { passive: true });
  }

  // a shooting star now and then
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
    (bg || document.body.firstChild).after(cv);
    const c = cv.getContext('2d');
    let meteor = null;
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; c.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    const launch = () => {
      const fromLeft = Math.random() < 0.5, a = (fromLeft ? 0.35 : Math.PI - 0.35) + (Math.random() - 0.5) * 0.4;
      meteor = { x: innerWidth * (fromLeft ? Math.random() * 0.6 : 0.4 + Math.random() * 0.6), y: innerHeight * Math.random() * 0.45, a, v: 900 + Math.random() * 600, life: 0, max: 0.9 + Math.random() * 0.5 };
      setTimeout(launch, 5000 + Math.random() * 9000);
    };
    setTimeout(launch, 2500 + Math.random() * 3000);
    let last = performance.now();
    const frame = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      c.clearRect(0, 0, innerWidth, innerHeight);
      if (meteor) {
        const m = meteor; m.life += dt; m.x += Math.cos(m.a) * m.v * dt; m.y += Math.sin(m.a) * m.v * dt;
        const k = m.life / m.max, fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, len = 140 + 80 * fade;
        const tx = m.x - Math.cos(m.a) * len, ty = m.y - Math.sin(m.a) * len;
        const g = c.createLinearGradient(m.x, m.y, tx, ty); g.addColorStop(0, `rgba(255,248,236,${0.9 * fade})`); g.addColorStop(1, 'rgba(255,248,236,0)');
        c.strokeStyle = g; c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(tx, ty); c.stroke();
        c.fillStyle = `rgba(255,252,245,${fade})`; c.beginPath(); c.arc(m.x, m.y, 1.3, 0, 6.283); c.fill();
        if (k >= 1) meteor = null;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  const btn = document.getElementById('sound');
  if (!btn) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { btn.hidden = true; return; }
  let ctx = null, master, lowpass, wind, verb, on = false, pingTimer = 0, sleepTimer = 0, dive = 0;

  function build() {
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    // a big, dark room: generated reverb tail (~5 s)
    verb = ctx.createConvolver();
    const len = Math.round(ctx.sampleRate * 5), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.6; verb.connect(wet); wet.connect(master);
    lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 650; lowpass.Q.value = 0.5;
    const dry = ctx.createGain(); dry.gain.value = 0.55; lowpass.connect(dry); dry.connect(master); lowpass.connect(verb);
    // the drone: A–E–A–E–B, each voice swelling on its own slow cycle
    [55, 82.41, 110, 164.81, 246.94].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 10;
      const g = ctx.createGain(); const level = i < 2 ? 0.17 : 0.045; g.gain.value = level;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.025 + Math.random() * 0.05;
      const depth = ctx.createGain(); depth.gain.value = level * 0.85; lfo.connect(depth); depth.connect(g.gain);
      o.connect(g); g.connect(lowpass); o.start(); lfo.start();
    });
    const fl = ctx.createOscillator(); fl.frequency.value = 0.035; const fd = ctx.createGain(); fd.gain.value = 260; fl.connect(fd); fd.connect(lowpass.frequency); fl.start();
    // space wind: brown noise through a slowly wandering band-pass
    const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), nd = nb.getChannelData(0);
    let last = 0; for (let i = 0; i < nd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 360; bp.Q.value = 0.7;
    const bl = ctx.createOscillator(); bl.frequency.value = 0.05; const bd = ctx.createGain(); bd.gain.value = 140; bl.connect(bd); bd.connect(bp.frequency); bl.start();
    wind = ctx.createGain(); wind.gain.value = 0.22;
    src.connect(bp); bp.connect(wind); wind.connect(lowpass); src.start();
  }

  // a far-off shimmer: one soft high note from a calm scale, mostly echo
  function ping() {
    if (!on || !ctx) return;
    const scale = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77];
    const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1), t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03 + dive * 0.02, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 7);
    o.connect(g); g.connect(verb); o.start(t); o.stop(t + 7.2);
    pingTimer = setTimeout(ping, (dive > 0.3 ? 1800 : 3500) + Math.random() * 5000);
  }

  function set(next) {
    on = next;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Turn space sound off' : 'Turn space sound on');
    btn.querySelector('.lbl').textContent = on ? 'Sound on' : 'Sound';
    clearTimeout(pingTimer); clearTimeout(sleepTimer);
    if (on) {
      if (!ctx) build();
      ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);
      pingTimer = setTimeout(ping, 2500);
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
      sleepTimer = setTimeout(() => ctx.suspend(), 2000);
    }
  }
  btn.addEventListener('click', () => set(!on));

  // the home page's dive into the vortex opens the sound up a little (0 = calm, 1 = deep in)
  window.otoSound = {
    dive(v) {
      dive = Math.max(0, Math.min(1, v));
      if (!ctx || !on) return;
      lowpass.frequency.setTargetAtTime(650 + dive * 1700, ctx.currentTime, 0.25);
      wind.gain.setTargetAtTime(0.22 + dive * 0.5, ctx.currentTime, 0.25);
    },
  };
})();
