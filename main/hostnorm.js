'use strict';
// Oto — one way to turn a host name into what Oto Shield compares against its lists. No Electron here, so it can be
// unit-tested. The same site must always give the same text, however the address was written:
//   EVIL.example → evil.example · evil.example. (trailing dot) → evil.example · [::1] → ::1
//   bücher.example → xn--bcher-kva.example (international names, as browsers send them)
//   2130706433 / 0x7f.0.0.1 / 0177.0.0.1 → 127.0.0.1 (other ways of writing an IPv4 address)
const { domainToASCII } = require('url');

function normHost(host) {
  let h = String(host == null ? '' : host).trim().toLowerCase();
  if (!h || h.length > 1024) return '';
  h = h.replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (!h) return '';
  if (h.includes(':')) return /^[0-9a-f:.]+$/.test(h) ? h : ''; // IPv6
  if (/[^\x00-\x7f]/.test(h)) { const a = domainToASCII(h); if (!a) return ''; h = a; }
  if (/^[0-9a-fx.]+$/.test(h)) { try { const u = new URL(`http://${h}/`); if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return u.hostname; } catch {} }
  return /^[a-z0-9_.-]+$/.test(h) ? h : '';
}
const isIP = (h) => h.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(h);
// The host and every parent domain (sub.evil.example → sub.evil.example, evil.example, example). IPs match only exactly.
function hostAndParents(host) {
  const h = normHost(host);
  if (!h) return [];
  if (isIP(h)) return [h];
  const out = [];
  for (let x = h; x.includes('.'); x = x.slice(x.indexOf('.') + 1)) out.push(x);
  return out.length ? out : [h];
}
// Turns a downloaded list (one host per line, # or ! comments, hosts-file style "0.0.0.0 host" too) into clean hosts.
// Returns null if it doesn't look like a real list (too big, or too few valid lines).
function parseHostList(text, { maxBytes = 64 * 1024 * 1024, maxHosts = 3e6, minHosts = 100 } = {}) {
  if (typeof text !== 'string' || text.length > maxBytes) return null;
  const out = new Set();
  for (const raw of text.split(/\r?\n/)) {
    let l = raw.trim();
    if (!l || l[0] === '#' || l[0] === '!') continue;
    const parts = l.split(/\s+/);
    if (parts.length === 2 && /^(0\.0\.0\.0|127\.0\.0\.1|::1?)$/.test(parts[0])) l = parts[1]; // hosts-file line
    else if (parts.length !== 1) continue;
    const h = normHost(l);
    if (h && h.includes('.') || (h && h.includes(':'))) out.add(h);
    if (out.size > maxHosts) return null;
  }
  return out.size >= minHosts ? [...out] : null;
}
module.exports = { normHost, hostAndParents, parseHostList, isIP };
