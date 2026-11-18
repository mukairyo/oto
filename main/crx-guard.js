'use strict';
// Oto — the check on extension packages downloaded in the main process (1.7.12, from main/extensions.js).
// Every GET answer is looked at, so a package from any address is checked (Chrome Web Store updates come from hosts
// Google picks, and electron-chrome-web-store itself only checks the package's key against its ID, never its
// signatures). Only the first 4 bytes are read to tell: anything that isn't a package streams on as it came, instead
// of being read whole into memory. A package ("Cr24") is read whole, capped in size, and must pass verify() before
// anything else sees it; otherwise the answer becomes a 403 and nothing is installed or updated.
const MAX_CRX = 256 * 1024 * 1024;

function crxGuard(orig, { verify, onRefuse = () => {}, max = MAX_CRX }) {
  const refuse = (msg) => { onRefuse(msg); return new Response(null, { status: 403, statusText: 'Refused by Oto' }); };
  return async (input, init) => {
    const res = await orig(input, init);
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'GET' || !res.ok || res.status === 204 || !res.body) return res;
    const reader = res.body.getReader();
    const head = []; let got = 0, done = false;
    while (got < 4) { const r = await reader.read(); if (r.done) { done = true; break; } head.push(Buffer.from(r.value)); got += r.value.length; }
    const first = Buffer.concat(head);
    if (!(first.length >= 4 && first.toString('latin1', 0, 4) === 'Cr24')) {
      const body = new ReadableStream({
        start(c) { if (first.length) c.enqueue(new Uint8Array(first)); if (done) c.close(); },
        async pull(c) { const r = await reader.read(); if (r.done) c.close(); else c.enqueue(r.value); },
        cancel(why) { return reader.cancel(why); },
      });
      return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
    }
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > max) { try { await reader.cancel(); } catch {} return refuse('too big'); }
    const parts = [first]; let size = first.length;
    while (!done) {
      const r = await reader.read(); if (r.done) break;
      size += r.value.length;
      if (size > max) { try { await reader.cancel(); } catch {} return refuse('too big'); }
      parts.push(Buffer.from(r.value));
    }
    const buf = Buffer.concat(parts);
    try { verify(buf); } catch (err) { return refuse(String((err && err.message) || err)); }
    return new Response(buf, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
}
module.exports = { crxGuard, MAX_CRX };
