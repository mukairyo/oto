// Oto feedback service: one request = one message. The database and Gmail are handed in (index.ts gives the real
// ones; Oto's tests give stand-ins), so this file has no imports beyond check.mjs.
import { check, mailFor } from './check.mjs';

export const LIMIT_HOUR = 5, LIMIT_DAY = 20, BODY_MAX = 100000;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// deps: { db: { count(ipHash, sinceIso), insert(row) -> id, markEmailed(id) }, sendMail(mail) | null, hash(text), emailAll, now() }
export function makeHandler(deps) {
  const now = deps.now || (() => Date.now());
  return async function handle(req) {
    if (req.method !== 'POST') return json(405, { ok: false, error: 'Use POST.' });
    const raw = await req.text();
    if (raw.length > BODY_MAX) return json(413, { ok: false, error: 'That\'s too big.' });
    let body;
    try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'That isn\'t valid.' }); }
    const c = check(body);
    if (!c.ok) return json(400, c);
    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '').split(',')[0].trim() || 'unknown';
    const ipHash = await deps.hash(ip);
    const t = now();
    try {
      if (await deps.db.count(ipHash, new Date(t - 3600e3).toISOString()) >= LIMIT_HOUR) return json(429, { ok: false, error: 'Too many messages from here: try again in an hour.' });
      if (await deps.db.count(ipHash, new Date(t - 86400e3).toISOString()) >= LIMIT_DAY) return json(429, { ok: false, error: 'Too many messages from here today: try again tomorrow.' });
    } catch (e) { console.error('count', e); return json(500, { ok: false, error: 'Oto\'s feedback service has a problem right now. Try again later.' }); }
    const v = c.value;
    let id;
    try {
      id = await deps.db.insert({ kind: v.kind, message: v.message, contact: v.contact || null, oto_version: v.version || null, os: v.os || null, report: v.report || null, ip_hash: ipHash });
    } catch (e) { console.error('insert', e); return json(500, { ok: false, error: 'Oto\'s feedback service couldn\'t save that. Try again later.' }); }
    // bug reports are emailed to Oto's maker (everything, if FEEDBACK_EMAIL_ALL is on); the rest stays saved
    let emailed = false;
    if (deps.sendMail && (v.kind === 'bug' || deps.emailAll)) {
      try { await deps.sendMail(mailFor(v, id)); emailed = true; await deps.db.markEmailed(id); } catch (e) { console.error('email', e && e.message); }
    }
    return json(200, { ok: true, id, emailed });
  };
}
