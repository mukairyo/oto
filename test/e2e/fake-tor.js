'use strict';
// A stand-in for Tor in Oto's end-to-end tests (main/vpn.js runs it when OTO_TOR_FAKE points here): it reads the
// torrc Oto wrote, prints Tor-like progress lines, and runs a small SOCKS5 proxy on the SocksPort that sends every
// *.site name to the test web server and logs it, so the tests can see which pages went through "Tor".
const fs = require('fs');
const net = require('net');
const rc = fs.readFileSync(process.argv[process.argv.indexOf('-f') + 1], 'utf8');
const port = Number((/^SocksPort 127\.0\.0\.1:(\d+)$/m.exec(rc) || [])[1]);
const exit = (/^ExitNodes \{(\w+)\}$/m.exec(rc) || [])[1] || 'auto';
const LOG = process.env.OTO_FAKE_TOR_LOG, PID = process.env.OTO_FAKE_TOR_PID;
const HTTP = Number(process.env.OTO_E2E_HTTP);
if (PID) fs.writeFileSync(PID, String(process.pid));
const log = (s) => { if (LOG) fs.appendFileSync(LOG, `${s}\n`); };
log(`start exit=${exit}`);

const srv = net.createServer((c) => {
  c.once('data', (hello) => {
    if (hello[0] !== 5) return c.destroy();
    c.write(Buffer.from([5, 0])); // no auth
    c.once('data', (req) => {
      let host = '', i = 4;
      if (req[3] === 3) { const n = req[4]; host = req.slice(5, 5 + n).toString(); i = 5 + n; } else if (req[3] === 1) { host = [...req.slice(4, 8)].join('.'); i = 8; } else return c.destroy();
      const p = req.readUInt16BE(i);
      log(`connect ${host}:${p}`);
      if (!/\.site$/.test(host)) { c.end(Buffer.from([5, 2, 0, 1, 0, 0, 0, 0, 0, 0])); return; }
      const up = net.connect(HTTP, '127.0.0.1', () => { c.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0])); up.pipe(c); c.pipe(up); });
      up.on('error', () => c.destroy()); c.on('error', () => up.destroy());
    });
  });
  c.on('error', () => {});
});
srv.listen(port, '127.0.0.1', () => {
  let n = 0;
  const steps = [5, 30, 75, 100];
  const t = setInterval(() => { console.log(`[notice] Bootstrapped ${steps[n]}% (fake): step`); if (++n >= steps.length) clearInterval(t); }, 120);
});
