'use strict';
// Live check of Oto VPN's Tor setup against the real Tor network (the "Tor live" job in ci.yml; needs tor and curl):
// starts Tor with the exact torrc Oto writes (main/vpn.js), waits for it to connect, then asks
// check.torproject.org through it whether the request came from Tor, and checks a chosen exit country really holds.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { torrc, bootstrapOf, countryOfIp } = require('../main/vpn.js');

const TOR = process.env.OTO_TOR_PATH || 'tor';
const GEOIP = ['/usr/share/tor/geoip', '/usr/local/share/tor/geoip'].find((f) => fs.existsSync(f)) || '';

function run(country, port) {
  return new Promise((ok, fail) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-tor-live-'));
    fs.writeFileSync(path.join(dir, 'torrc'), torrc({ socksPort: port, dataDir: path.join(dir, 'data'), geoip: GEOIP, country }));
    const p = spawn(TOR, ['-f', path.join(dir, 'torrc'), '--ignore-missing-torrc'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const end = (fn, v) => { clearTimeout(timer); p.kill(); setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 500); fn(v); };
    const timer = setTimeout(() => end(fail, new Error(`${country}: Tor didn't connect in 3 minutes`)), 180000);
    let buf = '';
    p.stdout.on('data', (d) => {
      buf += d; const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) {
        const pct = bootstrapOf(l); if (pct !== null) console.log(`  ${country}: ${pct}%`);
        if (pct === 100) {
          try {
            // (an exit relay sometimes drops a connection: up to 3 tries, each on a fresh circuit; Tor gives every
            // SOCKS username its own circuit, like "New address" in Oto)
            let j, err;
            for (let i = 1; i <= 3 && !j; i++) {
              try { j = JSON.parse(execFileSync('curl', ['-sS', '--max-time', '60', '--socks5-hostname', `127.0.0.1:${port}`, '--proxy-user', `try${i}:x`, 'https://check.torproject.org/api/ip'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()); } catch (e) { err = e; console.log(`  ${country}: try ${i} failed (${String(e.stderr || e.message).trim().split('\n')[0]})`); }
            }
            if (!j) throw err;
            const cc = GEOIP ? countryOfIp(j.IP, fs.readFileSync(GEOIP, 'utf8')) : '';
            end(ok, { country, isTor: j.IsTor === true, ip: j.IP, cc });
          } catch (e) { end(fail, e); }
          return;
        }
      }
    });
    p.on('exit', (code) => end(fail, new Error(`${country}: Tor exited (${code})`)));
  });
}

(async () => {
  const a = await run('auto', 39150);
  console.log(JSON.stringify(a));
  if (!a.isTor) throw new Error('check.torproject.org says the request did not come through Tor');
  const de = await run('de', 39151);
  console.log(JSON.stringify(de));
  if (!de.isTor) throw new Error('not through Tor with a chosen country');
  if (GEOIP && de.cc !== 'de') throw new Error(`asked for exits in de, got ${de.cc || 'unknown'}`);
  console.log('Tor live check passed');
})().catch((e) => { console.error(e.message); process.exit(1); });
