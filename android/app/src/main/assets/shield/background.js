'use strict';
// Oto Shield for Android: Oto's own blocker, a small extension built into the app (no outside code).
// It stops requests to known ad, tracker, telemetry and session-recorder addresses (when another site loads them)
// and to ad scripts, next to the engine's own
// tracking protection. The lists are Oto's (rules.js, written from trackers.js and blocklist.js by build.js).
// Common ad boxes are hidden with hide.css. Switched on and off with the Shield switch in the app.
/* global OTO_RULES, browser */

function makeDecide(rules) {
  const third = new Set(rules.third), scripts = rules.scripts || [];
  const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/\.+$/, ''); } catch { return ''; } };
  // the part of an address that names the site: example.com, example.co.uk
  const siteOf = (h) => { const p = h.split('.'); return p.length > 2 && /^(co|com|org|net|ac|gov|edu)$/.test(p[p.length - 2]) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const listed = (set, h) => { while (h) { if (set.has(h)) return true; const i = h.indexOf('.'); if (i < 0) return false; h = h.slice(i + 1); } return false; };
  // true = this request is stopped
  return function decide(d) {
    if (!d || d.type === 'main_frame') return false; // never the page you asked for
    const page = hostOf(d.documentUrl || d.originUrl || '').replace(/^www\./, '');
    if (!page) return false; // not asked for by a web page (Oto itself)
    let u;
    try { u = new URL(d.url); } catch { return false; }
    if (!/^(https?|wss?):$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase().replace(/\.+$/, '');
    if (d.type === 'script') for (const r of scripts) if (u.pathname.includes(r.has) && (!r.site || page === r.site || page.endsWith(`.${r.site}`))) return true;
    // listed addresses are stopped when ANOTHER site loads them; a company's own site keeps working
    return siteOf(host) !== siteOf(page) && listed(third, host);
  };
}

if (typeof browser !== 'undefined' && typeof OTO_RULES !== 'undefined') {
  const decide = makeDecide(OTO_RULES);
  browser.webRequest.onBeforeRequest.addListener((d) => (decide(d) ? { cancel: true } : {}), { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, ['blocking']);
}
if (typeof module !== 'undefined') module.exports = { makeDecide };
