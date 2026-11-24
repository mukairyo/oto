'use strict';
// Sound bars (1.9.0): a tab playing sound measures it (page-preload.js) and its sidebar bars follow it — here a
// generated kick drum, so the bars should jump on each beat and fall back between beats.
module.exports = async (t) => {
  await t.open(`http://localhost:${t.ports.http}/`, 1500);
  const play = `(() => { const sr = 44100, sec = 6, n = sr * sec, buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, sr, true); d.setUint32(28, sr * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const tt = i / sr, beat = tt % 0.5, env = beat < 0.12 ? Math.exp(-beat * 30) : 0; d.setInt16(44 + i * 2, Math.sin(2 * Math.PI * 60 * tt) * env * 0.9 * 32767, true); }
    const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))); a.loop = true; document.body.append(a); window.__a = a; return a.play().then(() => 'playing', (e) => 'err ' + e.name); })()`;
  const page = "[...document.querySelectorAll('webview')].find((x) => x.offsetParent)";
  const r = await t.js(`${page}.executeJavaScript(${JSON.stringify(play)}, true)`);
  if (r !== 'playing') { t.check('a generated beat plays (skipped: no audio on this machine)', true, String(r)); return; }
  const seen = [];
  for (let k = 0; k < 16; k++) { await t.sleep(150); seen.push(await t.js("(V.get(activeTab().id) || {}).bars || ''")); }
  const vals = seen.filter(Boolean).map((b) => +b[0]);
  t.check('the tab’s sound bars follow the sound: they jump on the kick and fall back between beats',
    vals.length >= 6 && Math.max(...vals) >= 7 && Math.min(...vals) <= 4, seen.join(' '));
  t.check('…the bars in the sidebar switch from the normal animation to the measured heights', await t.js("!!document.querySelector('.tab .v1-wave.live')"));
  await t.js(`${page}.executeJavaScript('window.__a.pause(), 1')`); await t.sleep(700);
  t.check('…and pausing stops it', (await t.js("(V.get(activeTab().id) || {}).bars || ''")) === '');
};
