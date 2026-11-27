'use strict';
// Oto VPN (1.8.0): browsing through Tor, built into Oto, free.
//
// Oto starts its own copy of Tor (shipped with Oto, checked against the Tor Project's signature when Oto is built:
// scripts/fetch-tor.js) and points the browsing sessions you chose at it: every tab, or only private windows, or one
// Space that has its own logins. Oto's own background traffic (updates, Shield lists, Oto Accounts) does not go
// through it. While it's on:
//  - pages, DNS (names are resolved at the Tor exit: Chromium sends host names to SOCKS5 proxies) and WebRTC calls go
//    through Tor; WebRTC that can't go through the proxy is turned off for those tabs (no address leak);
//  - "block pages if it drops" (on by default): if Tor stops, the sessions keep pointing at it, so pages fail instead
//    of quietly loading with your real address, while Oto starts Tor again;
//  - a country picks Tor exits in that country (ExitNodes), by restarting Tor with the new setting.
// Nothing here can make a page reach Oto: Tor only listens on 127.0.0.1, on a port chosen at start.
const fs = require('fs');
const path = require('path');
const net = require('net');

const COUNTRIES = ['auto', 'nl', 'de', 'ch', 'se', 'gb', 'us', 'jp', 'fr', 'ca', 'fi', 'no', 'at', 'ro'];
const SCOPES = /^(all|private|space:persist:oto-ws-[\w-]{1,40})$/;
const DEFAULTS = { on: false, country: 'auto', scope: 'all', killSwitch: true };

/** torrc text for these settings (pure, tested). */
function torrc({ socksPort, dataDir, geoip, geoip6, country }) {
  // (a path is quoted, with no quote marks or line breaks of its own: it can't add settings)
  const q = (p) => `"${String(p).replace(/\\/g, '/').replace(/["\r\n\0]/g, '')}"`;
  const lines = [
    `SocksPort 127.0.0.1:${socksPort}`,
    `DataDirectory ${q(dataDir)}`,
    'ClientOnly 1',
    'AvoidDiskWrites 1',
    'SafeSocks 0', // Chromium sends host names, never bare IPs it resolved itself
    'Log notice stdout',
  ];
  if (geoip) lines.push(`GeoIPFile ${q(geoip)}`);
  if (geoip6) lines.push(`GeoIPv6File ${q(geoip6)}`);
  if (country && country !== 'auto') lines.push(`ExitNodes {${country}}`, 'StrictNodes 1');
  return `${lines.join('\n')}\n`;
}

/** Tor's progress from one line of its log, or null. */
function bootstrapOf(line) {
  const m = /Bootstrapped (\d{1,3})%/.exec(String(line));
  return m ? Math.min(100, Number(m[1])) : null;
}

/** The country of an IPv4 address from Tor's geoip file ("low,high,CC" per line), or ''. */
function countryOfIp(ip, geoipText) {
  const p = String(ip).split('.').map(Number);
  if (p.length !== 4 || p.some((x) => !(x >= 0 && x <= 255))) return '';
  const n = ((p[0] * 256 + p[1]) * 256 + p[2]) * 256 + p[3];
  for (const line of String(geoipText || '').split('\n')) {
    if (!line || line[0] === '#') continue;
    const [lo, hi, cc] = line.split(',');
    if (n >= Number(lo) && n <= Number(hi)) return String(cc || '').trim().toLowerCase();
  }
  return '';
}

function freePort() {
  return new Promise((ok, no) => { const s = net.createServer(); s.unref(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); }); });
}

function createVpn({ userFile, readJSON, writeJSON, send, sessions, appDir, resourcesPath, spawn = require('child_process').spawn, onRtc = () => {},
  systemTor = process.platform === 'linux' ? [['/usr/bin/tor', '/usr/share/tor'], ['/usr/local/bin/tor', '/usr/local/share/tor']] : [] }) {
  let conf = { ...DEFAULTS, ...sanitize(readJSON('vpn.json', {})) };
  const st = { phase: 'off', progress: 0, error: '', exitIp: '', exitCc: '', since: 0 };
  let proc = null, socksPort = 0, restartTimer = null, tries = 0, stopping = false, startToken = 0;

  function sanitize(c) {
    const o = {};
    if (c && typeof c === 'object') {
      if (typeof c.on === 'boolean') o.on = c.on;
      if (COUNTRIES.includes(c.country)) o.country = c.country;
      if (typeof c.scope === 'string' && SCOPES.test(c.scope)) o.scope = c.scope;
      if (typeof c.killSwitch === 'boolean') o.killSwitch = c.killSwitch;
    }
    return o;
  }

  // Where Tor is: shipped with Oto (resources/tor), or vendor-tor/ when running from source, or OTO_TOR_PATH (tests).
  function torFiles() {
    // (tests only: a stand-in Tor, ahead of a real one a developer may have in vendor-tor/)
    if (process.env.OTO_TOR_FAKE && fs.existsSync(process.env.OTO_TOR_FAKE)) return { bin: process.env.OTO_TOR_FAKE, fake: process.env.OTO_TOR_FAKE, geoip: '', geoip6: '' };
    const exe = process.platform === 'win32' ? 'tor.exe' : 'tor';
    const dirs = [process.env.OTO_TOR_DIR, resourcesPath && path.join(resourcesPath, 'tor'), path.join(appDir, 'vendor-tor')].filter(Boolean);
    for (const d of dirs) {
      const bin = [path.join(d, exe), path.join(d, 'tor', exe)].find((f) => fs.existsSync(f));
      if (bin) {
        const data = [path.join(d, 'data'), path.join(path.dirname(bin), '..', 'data')].find((x) => fs.existsSync(path.join(x, 'geoip')));
        return { bin, geoip: data ? path.join(data, 'geoip') : '', geoip6: data ? path.join(data, 'geoip6') : '' };
      }
    }
    if (process.env.OTO_TOR_PATH && fs.existsSync(process.env.OTO_TOR_PATH)) return { bin: process.env.OTO_TOR_PATH, geoip: '', geoip6: '' };
    // (1.9.4) Linux: Oto doesn't ship Tor there; it uses the system's own tor package (Arch: pacman -S tor). Only these
    // fixed places, never a name looked up on PATH, so nothing in a writable folder can stand in for it.
    for (const [bin, data] of systemTor) {
      if (fs.existsSync(bin)) return { bin, geoip: fs.existsSync(path.join(data, 'geoip')) ? path.join(data, 'geoip') : '', geoip6: fs.existsSync(path.join(data, 'geoip6')) ? path.join(data, 'geoip6') : '' };
    }
    return null;
  }

  const view = () => ({ ...conf, ...st, available: !!torFiles(), countries: COUNTRIES });
  const tell = () => { try { send('vpn', view()); } catch {} };
  const save = () => { try { writeJSON('vpn.json', conf); } catch {} };

  // Which sessions go through Tor right now
  function covered() {
    const all = sessions();
    if (conf.scope === 'all') return all.map((x) => x.ses);
    if (conf.scope === 'private') return all.filter((x) => x.part === 'avocado').map((x) => x.ses);
    const part = conf.scope.slice('space:'.length);
    return all.filter((x) => x.part === part).map((x) => x.ses);
  }
  async function route(viaTor) {
    const mine = new Set(covered());
    await Promise.all(sessions().map(async ({ ses }) => {
      const rules = viaTor && mine.has(ses) ? { proxyRules: `socks5://127.0.0.1:${socksPort}`, proxyBypassRules: '<-loopback>' } : { mode: 'direct' };
      try { await ses.setProxy(rules); await ses.closeAllConnections(); } catch (e) { console.warn('[oto] VPN: could not set a session\'s route:', e && e.message); }
    }));
    onRtc();
  }
  /** True when this page's session goes through the VPN right now (for the WebRTC policy). */
  function covers(ses) { return (st.phase === 'on' || (st.phase === 'dropped' && conf.killSwitch) || st.phase === 'starting') && conf.on && covered().includes(ses); }

  async function start() {
    const files = torFiles();
    if (!files) { st.phase = 'error'; st.error = 'Tor isn’t included in this copy of Oto.'; tell(); return; }
    clearTimeout(restartTimer);
    const token = ++startToken;
    stopping = false;
    st.phase = 'starting'; st.progress = 0; st.error = ''; st.exitIp = ''; st.exitCc = ''; tell();
    socksPort = await freePort();
    if (token !== startToken) return;
    // with the kill switch, pages wait at Tor's port from the first moment (nothing loads directly meanwhile)
    if (conf.killSwitch) await route(true);
    const dataDir = userFile('tor-data');
    fs.mkdirSync(dataDir, { recursive: true });
    const rc = userFile('torrc');
    fs.writeFileSync(rc, torrc({ socksPort, dataDir, geoip: files.geoip, geoip6: files.geoip6, country: conf.country }));
    let p;
    // (tests only: OTO_TOR_FAKE is a stand-in Tor script, run with Oto's own Node)
    const fake = files.fake ? [files.fake] : [];
    const env = files.fake ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' } : process.env;
    try { p = spawn(files.fake ? process.execPath : files.bin, [...fake, '-f', rc, '--ignore-missing-torrc'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env }); } catch (e) { return failed(`Tor couldn’t start (${e.message})`); }
    proc = p;
    let buf = '';
    const onData = (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        const b = bootstrapOf(line);
        if (b !== null && proc === p) {
          st.progress = b;
          if (b >= 100 && st.phase !== 'on') { st.phase = 'on'; st.since = Date.now(); tries = 0; route(true).then(() => { tell(); checkExit(); }); }
          tell();
        }
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('error', (e) => { if (proc === p) failed(`Tor couldn’t start (${e.message})`); });
    p.on('exit', () => { if (proc !== p) return; proc = null; if (!stopping && conf.on) dropped(); });
  }
  function failed(msg) { proc = null; st.phase = 'error'; st.error = msg; tell(); if (conf.on) dropped(true); }
  // Tor stopped while the VPN is on: with the kill switch, pages keep pointing at the dead port (they fail, nothing
  // leaks); without it they go direct. Either way Oto starts Tor again, waiting longer each time.
  function dropped(keepError) {
    if (!keepError) { st.phase = 'dropped'; st.error = ''; }
    route(conf.killSwitch).then(tell);
    tries++;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => { if (conf.on) start().catch((e) => failed(e.message)); }, Math.min(60000, 2000 * 2 ** Math.min(tries, 5)));
  }
  async function stop() {
    stopping = true; startToken++;
    clearTimeout(restartTimer);
    const p = proc; proc = null;
    if (p) { try { p.kill(); } catch {} }
    st.phase = 'off'; st.progress = 0; st.exitIp = ''; st.exitCc = ''; st.since = 0;
    await route(false);
    tell();
  }
  // Which address sites see (asked through Tor itself), and its country from Tor's own geoip file
  async function checkExit() {
    try {
      const ses = covered()[0]; if (!ses || st.phase !== 'on') return;
      const r = await ses.fetch('https://check.torproject.org/api/ip', { cache: 'no-store' });
      const j = await r.json();
      if (j && typeof j.IP === 'string' && /^[\d.:a-f]{3,45}$/i.test(j.IP)) {
        st.exitIp = j.IP;
        const f = torFiles();
        try { st.exitCc = f && f.geoip ? countryOfIp(j.IP, fs.readFileSync(f.geoip, 'utf8')) : ''; } catch {}
        tell();
      }
    } catch {}
  }

  async function set(patch) {
    const before = { ...conf };
    conf = { ...conf, ...sanitize(patch) };
    save();
    const needRestart = conf.on && before.on && conf.country !== before.country;
    if (conf.on && !before.on) await start();
    else if (!conf.on && before.on) await stop();
    else if (needRestart) { stopping = true; const p = proc; proc = null; if (p) { try { p.kill(); } catch {} } await start(); }
    else if (conf.on && (conf.scope !== before.scope || conf.killSwitch !== before.killSwitch)) await route(st.phase === 'on' || conf.killSwitch);
    tell();
    return view();
  }
  /** A new Tor circuit (and with it, usually a new exit address): restart Tor. */
  async function renew() { if (!conf.on) return view(); stopping = true; const p = proc; proc = null; if (p) { try { p.kill(); } catch {} } await start(); return view(); }

  /** A session Oto just made (a Space with its own logins, a private window): give it the route it should have. */
  async function newSession() { if (conf.on) await route(st.phase === 'on' || conf.killSwitch); }

  function setupIPC(ipcMain) {
    ipcMain.handle('vpn:state', () => view());
    ipcMain.handle('vpn:set', (_e, patch) => set(patch));
    ipcMain.handle('vpn:renew', () => renew());
  }
  function boot() { if (conf.on) start().catch((e) => failed(e.message)); }
  function quit() { stopping = true; clearTimeout(restartTimer); if (proc) { try { proc.kill(); } catch {} proc = null; } }

  return { setupIPC, boot, quit, covers, newSession, view, set, renew, _st: st };
}

module.exports = { createVpn, torrc, bootstrapOf, countryOfIp, COUNTRIES, SCOPES };
