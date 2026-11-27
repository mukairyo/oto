'use strict';
// Oto VPN core (main/vpn.js, 1.8.0): torrc, Tor's progress, routing sessions, the kill switch, scopes.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { createVpn, torrc, bootstrapOf, countryOfIp } = require('../main/vpn.js');

test('torrc: Tor listens only on this PC, keeps its data in Oto\'s folder, exits in the chosen country', () => {
  const t = torrc({ socksPort: 9150, dataDir: 'C:\\Users\\r\\AppData\\Oto\\tor-data', geoip: '/x/geoip', country: 'nl' });
  assert.match(t, /^SocksPort 127\.0\.0\.1:9150$/m);
  assert.match(t, /^DataDirectory "C:\/Users\/r\/AppData\/Oto\/tor-data"$/m);
  assert.match(t, /^ExitNodes \{nl\}$/m);
  assert.match(t, /^ClientOnly 1$/m);
  assert.doesNotMatch(t, /ControlPort|0\.0\.0\.0/, 'nothing listens beyond the one local port');
  assert.doesNotMatch(torrc({ socksPort: 1, dataDir: '/d', country: 'auto' }), /ExitNodes/);
  assert.doesNotMatch(torrc({ socksPort: 1, dataDir: '/d"\nControlPort 9051' }), /^ControlPort/m, 'a path can\'t add lines');
});

test('Tor\'s progress is read from its log', () => {
  assert.strictEqual(bootstrapOf('Nov 18 12:00:00.000 [notice] Bootstrapped 45% (requesting_descriptors): Asking for relay descriptors'), 45);
  assert.strictEqual(bootstrapOf('Bootstrapped 100% (done): Done'), 100);
  assert.strictEqual(bootstrapOf('[notice] Opening Socks listener'), null);
});

test('the exit\'s country comes from Tor\'s geoip file', () => {
  const geo = '# comment\n16777216,16777471,au\n3232235520,3232301055,nl\n';
  assert.strictEqual(countryOfIp('192.168.1.1', geo), 'nl');
  assert.strictEqual(countryOfIp('1.0.0.5', geo), 'au');
  assert.strictEqual(countryOfIp('8.8.8.8', geo), '');
  assert.strictEqual(countryOfIp('not-an-ip', geo), '');
});

function rig(conf = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-vpn-'));
  fs.mkdirSync(path.join(dir, 'vendor-tor'));
  fs.writeFileSync(path.join(dir, 'vendor-tor', process.platform === 'win32' ? 'tor.exe' : 'tor'), '');
  const mk = (part) => { const s = { part, proxy: null, closed: 0, setProxy: async (r) => { s.proxy = r; }, closeAllConnections: async () => { s.closed++; } }; return s; };
  const S = { main: mk('persist:oto'), priv: mk('avocado') };
  const files = { 'vpn.json': conf };
  const procs = [];
  const spawn = () => { const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.kill = () => { p.killed = true; setImmediate(() => p.emit('exit', 0)); }; procs.push(p); return p; };
  const sent = [];
  const vpn = createVpn({
    userFile: (n) => path.join(dir, n), readJSON: (n, d) => files[n] || d, writeJSON: (n, v) => { files[n] = v; }, send: (ch, v) => sent.push(v),
    sessions: () => [{ part: S.main.part, ses: S.main }, { part: S.priv.part, ses: S.priv }], appDir: dir, resourcesPath: '', spawn, systemTor: [], // never the test machine's own tor
  });
  const boot = (p, pct = 100) => p.stdout.emit('data', Buffer.from(`[notice] Bootstrapped ${pct}% (done): Done\n`));
  const tick = () => new Promise((r) => setTimeout(r, 10));
  return { vpn, S, files, procs, sent, boot, tick, dir };
}

test('turning it on: pages wait at Tor\'s port, then go through it once Tor is ready; off goes direct', async () => {
  const r = rig();
  await r.vpn.set({ on: true });
  assert.strictEqual(r.vpn.view().phase, 'starting');
  assert.match(r.S.main.proxy.proxyRules, /^socks5:\/\/127\.0\.0\.1:\d+$/, 'kill switch: pages point at Tor from the start');
  r.boot(r.procs[0], 40); await r.tick();
  assert.strictEqual(r.vpn.view().progress, 40);
  r.boot(r.procs[0]); await r.tick();
  assert.strictEqual(r.vpn.view().phase, 'on');
  assert.match(r.S.priv.proxy.proxyRules, /^socks5:\/\//, 'all tabs, private ones too');
  assert.ok(r.vpn.covers(r.S.main), 'its tabs get the WebRTC "through the proxy only" rule');
  assert.strictEqual(r.files['vpn.json'].on, true, 'remembered');
  await r.vpn.set({ on: false });
  assert.deepStrictEqual(r.S.main.proxy, { mode: 'direct' });
  assert.ok(r.procs[0].killed, 'Tor stopped');
  assert.ok(!r.vpn.covers(r.S.main));
});

test('if Tor stops: with the kill switch pages keep failing at Tor\'s port (no leak), without it they go direct; Oto restarts Tor', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = rig();
  await r.vpn.set({ on: true }); r.boot(r.procs[0]); await Promise.resolve(); await Promise.resolve();
  r.procs[0].emit('exit', 1);
  await Promise.resolve(); await Promise.resolve();
  assert.strictEqual(r.vpn.view().phase, 'dropped');
  assert.match(r.S.main.proxy.proxyRules, /^socks5:/, 'still pointed at Tor: pages fail instead of leaking');
  t.mock.timers.tick(5000);
  for (let i = 0; i < 200 && r.procs.length < 2; i++) await new Promise((ok) => setImmediate(ok)); // (finding a free port is real network work)
  assert.ok(r.procs.length >= 2, 'Tor started again');
  t.mock.timers.reset();
  await r.vpn.set({ on: false });
  const r2 = rig({ killSwitch: false });
  await r2.vpn.set({ on: true }); r2.boot(r2.procs[0]); await r2.tick();
  r2.procs[0].emit('exit', 1); await r2.tick();
  assert.deepStrictEqual(r2.S.main.proxy, { mode: 'direct' }, 'without the kill switch: direct while Tor is down');
  await r2.vpn.set({ on: false });
});

test('"private windows only" routes only the private session', async () => {
  const r = rig({ scope: 'private' });
  await r.vpn.set({ on: true }); r.boot(r.procs[0]); await r.tick();
  assert.deepStrictEqual(r.S.main.proxy, { mode: 'direct' });
  assert.match(r.S.priv.proxy.proxyRules, /^socks5:/);
  assert.ok(!r.vpn.covers(r.S.main) && r.vpn.covers(r.S.priv));
  await r.vpn.set({ on: false });
});

test('changing the country restarts Tor with that exit country', async () => {
  const r = rig();
  await r.vpn.set({ on: true }); r.boot(r.procs[0]); await r.tick();
  await r.vpn.set({ country: 'de' });
  assert.ok(r.procs[0].killed && r.procs.length === 2);
  assert.match(fs.readFileSync(path.join(r.dir, 'torrc'), 'utf8'), /ExitNodes \{de\}/);
  await r.vpn.set({ on: false });
});

test('settings from the window are checked field by field', async () => {
  const r = rig();
  await r.vpn.set({ country: 'xx', scope: 'space:../../evil', killSwitch: 'yes', on: 'true', extra: 1 });
  assert.deepStrictEqual(r.files['vpn.json'], { on: false, country: 'auto', scope: 'all', killSwitch: true });
  await r.vpn.set({ scope: 'space:persist:oto-ws-abc123' });
  assert.strictEqual(r.files['vpn.json'].scope, 'space:persist:oto-ws-abc123');
});

test('without Tor in this copy of Oto it says so and doesn\'t pretend to connect', async () => {
  const r = rig(); fs.rmSync(path.join(r.dir, 'vendor-tor'), { recursive: true });
  const saved = process.env.OTO_TOR_FAKE; delete process.env.OTO_TOR_FAKE;
  await r.vpn.set({ on: true });
  assert.strictEqual(r.vpn.view().phase, 'error');
  assert.strictEqual(r.vpn.view().available, false);
  if (saved) process.env.OTO_TOR_FAKE = saved;
});

test('real Tor accepts the torrc Oto writes (skipped without tor installed)', { skip: (() => { try { require('child_process').execFileSync('tor', ['--version'], { stdio: 'ignore' }); return false; } catch { return 'no tor'; } })() }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-torrc-'));
  for (const country of ['auto', 'de']) {
    fs.writeFileSync(path.join(d, 'torrc'), torrc({ socksPort: 39150, dataDir: path.join(d, 'data'), country }));
    const out = require('child_process').execFileSync('tor', ['--verify-config', '-f', path.join(d, 'torrc')]).toString();
    assert.match(out, /Configuration was valid/);
  }
  fs.rmSync(d, { recursive: true, force: true });
});

test('on Linux it uses the system\'s tor package, from fixed places only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-systor-'));
  const bin = path.join(dir, 'bin', 'tor'); fs.mkdirSync(path.dirname(bin)); fs.writeFileSync(bin, '');
  fs.mkdirSync(path.join(dir, 'share')); fs.writeFileSync(path.join(dir, 'share', 'geoip'), '');
  const saved = process.env.OTO_TOR_FAKE; delete process.env.OTO_TOR_FAKE;
  const vpn = createVpn({ userFile: (n) => path.join(dir, n), readJSON: (n, d) => d, writeJSON: () => {}, send: () => {}, sessions: () => [], appDir: dir, resourcesPath: '',
    spawn: () => { throw new Error('not started here'); }, systemTor: [[path.join(dir, 'nope', 'tor'), dir], [bin, path.join(dir, 'share')]] });
  assert.strictEqual(vpn.view().available, true);
  if (saved) process.env.OTO_TOR_FAKE = saved;
});
