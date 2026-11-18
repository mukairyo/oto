#!/usr/bin/env node
'use strict';
// Oto Accounts (Supabase) access check: Row-Level Security must keep every account's rows private.
// Runs on GitHub Actions (.github/workflows/backend-check.yml), weekly and on demand. Plain Node 22, no packages.
//
// Part 1, always: with only the public (publishable) key and no sign-in, nobody can read, add, change or delete rows
// in oto_sync, oto_devices or oto_inbox.
// Part 2, the two TEST accounts (repository secrets OTO_RLS_A_EMAIL / _PASSWORD and OTO_RLS_B_EMAIL / _PASSWORD), in
// both directions: neither account can read, change, delete or impersonate the other's rows, or move its own rows to
// the other; each can use its own. Plus: a forged or damaged token is refused, and a signed-out session's refresh
// token can't be used again. Use dedicated test accounts only: the check writes small test rows (unique to this run)
// and removes them afterwards, even when a check fails.
//
// (1.7.13) Fails closed. Exit codes: 0 every check ran and passed; 1 a check failed (access that should be denied was
// allowed, or the reverse); 2 the two-account part couldn't run: test accounts not configured, or sign-in failed;
// 3 the backend couldn't be reached (inconclusive, never a pass). For a quick local look without test accounts:
// `node scripts/rls-check.js --anonymous-only` (says so in its result, and is never used by CI or releases).
// Never prints passwords, tokens or row contents.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const src = fs.readFileSync(path.join(__dirname, '..', 'account.js'), 'utf8');
const URL_ = process.env.OTO_SUPABASE_URL || src.match(/SUPABASE_URL = process\.env\.OTO_SUPABASE_URL \|\| '([^']+)'/)[1];
const KEY = process.env.OTO_SUPABASE_KEY || src.match(/SUPABASE_KEY = process\.env\.OTO_SUPABASE_KEY \|\| '([^']+)'/)[1];
const TABLES = ['oto_sync', 'oto_devices', 'oto_inbox'];
const ANON_ONLY = process.argv.includes('--anonymous-only');
const RUN = crypto.randomBytes(4).toString('hex'); // this run's test rows
class Unreachable extends Error {}
class NotConfigured extends Error {}
const results = [];
const record = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

async function call(method, p, { token, body, prefer } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  let r;
  try { r = await fetch(URL_ + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) }); } catch (e) { throw new Unreachable(`backend not reachable (${e.name})`); }
  if (r.status >= 500) throw new Unreachable(`backend error HTTP ${r.status} on ${method} ${p.split('?')[0]}`);
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: r.status, json };
}
// "denied" = the server refused (401/403, or Postgres permission/RLS error 42501), or nothing came back / was touched
const refused = (r) => r.status === 401 || r.status === 403 || (r.json && (r.json.code === '42501' || /row-level security|permission denied/i.test(r.json.message || '')));
const emptyOrRefused = (r) => refused(r) || (r.status >= 200 && r.status < 300 && Array.isArray(r.json) && r.json.length === 0);
const DEV = `rls-test-${RUN}`;
const testRow = (table, uid, tag = 'rls-test') => ({
  oto_sync: { user_id: uid, blob: tag, salt: 'rls-test', updated_at: new Date().toISOString(), device: DEV },
  oto_devices: { user_id: uid, device_id: DEV, kind: 'pc', blob: tag, updated_at: new Date().toISOString() },
  oto_inbox: { user_id: uid, to_device: DEV, blob: tag },
}[table]);
const ownRows = (t, uid) => `/rest/v1/${t}?user_id=eq.${uid}&${t === 'oto_sync' ? 'device' : t === 'oto_devices' ? 'device_id' : 'to_device'}=eq.${DEV}`;

async function anonymous() {
  const fake = crypto.randomUUID();
  for (const t of TABLES) {
    const read = await call('GET', `/rest/v1/${t}?select=*&limit=5`);
    record(`anonymous can't read ${t}`, emptyOrRefused(read), `HTTP ${read.status}${Array.isArray(read.json) ? `, ${read.json.length} rows` : ''}`);
    const ins = await call('POST', `/rest/v1/${t}`, { body: testRow(t, fake), prefer: 'return=minimal' });
    record(`anonymous can't add to ${t}`, refused(ins) || ins.status >= 400, `HTTP ${ins.status}`);
    const upd = await call('PATCH', `/rest/v1/${t}?user_id=not.is.null`, { body: { blob: 'x' }, prefer: 'return=representation' });
    record(`anonymous can't change ${t}`, emptyOrRefused(upd), `HTTP ${upd.status}`);
    const del = await call('DELETE', `/rest/v1/${t}?user_id=not.is.null`, { prefer: 'return=representation' });
    record(`anonymous can't delete from ${t}`, emptyOrRefused(del), `HTTP ${del.status}`);
  }
}

async function signIn(email, password, label = 'a') {
  const r = await call('POST', '/auth/v1/token?grant_type=password', { body: { email, password } });
  // the reason Supabase gives (a code like email_not_confirmed or invalid_credentials), never the address or password
  const why = r.json && (r.json.error_code || r.json.code || r.json.error) ? `, ${String(r.json.error_code || r.json.code || r.json.error).replace(/[^\w-]/g, '').slice(0, 40)}` : '';
  if (r.status !== 200 || !r.json || !r.json.access_token) throw new NotConfigured(`sign-in failed for test account ${label} (HTTP ${r.status}${why})`);
  return { token: r.json.access_token, refresh: r.json.refresh_token, uid: r.json.user.id };
}

async function twoAccounts() {
  const env = process.env;
  if (!(env.OTO_RLS_A_EMAIL && env.OTO_RLS_A_PASSWORD && env.OTO_RLS_B_EMAIL && env.OTO_RLS_B_PASSWORD)) {
    if (ANON_ONLY) { console.log('NOTE  --anonymous-only: the two-account checks were not run'); return false; }
    throw new NotConfigured('test accounts not configured: set OTO_RLS_A_EMAIL/_PASSWORD and OTO_RLS_B_EMAIL/_PASSWORD (dedicated test accounts) as repository secrets');
  }
  const A = await signIn(env.OTO_RLS_A_EMAIL, env.OTO_RLS_A_PASSWORD, 'A');
  const B = await signIn(env.OTO_RLS_B_EMAIL, env.OTO_RLS_B_PASSWORD, 'B');
  A.name = 'A'; B.name = 'B';
  record('the two test accounts are different users', A.uid !== B.uid);
  if (A.uid === B.uid) return true;
  try {
    for (const [me, other] of [[A, B], [B, A]]) await oneWay(me, other);
    await tokens(A);
  } finally {
    // this run's rows only, in both accounts, whatever happened above
    for (const who of [A, B]) for (const t of TABLES) { try { await call('DELETE', ownRows(t, who.uid), { token: who.token }); } catch {} }
  }
  return true;
}

// `other` tries everything against `me`'s rows; `me` keeps full use of its own.
async function oneWay(me, other) {
  const X = me.name, Y = other.name;
  const upsert = (who, t, tag) => call('POST', `/rest/v1/${t}${t === 'oto_sync' ? '?on_conflict=user_id' : t === 'oto_devices' ? '?on_conflict=user_id,device_id' : ''}`, { token: who.token, body: testRow(t, who.uid, tag), prefer: t === 'oto_inbox' ? 'return=minimal' : 'resolution=merge-duplicates,return=minimal' });
  for (const t of TABLES) {
    const put = await upsert(me, t, `rls-${X}`);
    record(`${X} can write its own ${t} row`, put.status >= 200 && put.status < 300, `HTTP ${put.status}`);
    const own = await call('GET', `${ownRows(t, me.uid)}&select=user_id,blob`, { token: me.token });
    record(`${X} can read its own ${t} row`, own.status === 200 && Array.isArray(own.json) && own.json.some((r) => r.blob === `rls-${X}`), `HTTP ${own.status}`);
    const read = await call('GET', `/rest/v1/${t}?user_id=eq.${me.uid}&select=*`, { token: other.token });
    record(`${Y} can't read ${X}'s ${t}`, emptyOrRefused(read), `HTTP ${read.status}`);
    const all = await call('GET', `/rest/v1/${t}?select=user_id&limit=1000`, { token: other.token });
    record(`${Y} sees only its own rows in ${t}`, all.status === 200 && Array.isArray(all.json) && all.json.every((r) => r.user_id === other.uid), `HTTP ${all.status}`);
    const upd = await call('PATCH', `/rest/v1/${t}?user_id=eq.${me.uid}`, { token: other.token, body: { blob: 'tampered' }, prefer: 'return=representation' });
    record(`${Y} can't change ${X}'s ${t}`, emptyOrRefused(upd), `HTTP ${upd.status}`);
    const del = await call('DELETE', `/rest/v1/${t}?user_id=eq.${me.uid}`, { token: other.token, prefer: 'return=representation' });
    record(`${Y} can't delete ${X}'s ${t}`, emptyOrRefused(del), `HTTP ${del.status}`);
    const ins = await call('POST', `/rest/v1/${t}`, { token: other.token, body: { ...testRow(t, me.uid, 'forged'), ...(t === 'oto_devices' ? { device_id: `${DEV}-forged` } : {}) }, prefer: 'return=minimal' });
    record(`${Y} can't add rows as ${X} in ${t}`, refused(ins) || ins.status >= 400, `HTTP ${ins.status}`);
    // privilege escalation: the other account moves its own row to me
    await upsert(other, t, `rls-${Y}`);
    const move = await call('PATCH', `${ownRows(t, other.uid)}`, { token: other.token, body: { user_id: me.uid }, prefer: 'return=representation' });
    record(`${Y} can't move its rows to ${X} in ${t}`, emptyOrRefused(move) || move.status >= 400, `HTTP ${move.status}`);
    // the database itself, read back by the owners: nothing of X's changed, nothing was added as X, Y's row is still Y's
    const still = await call('GET', `/rest/v1/${t}?user_id=eq.${me.uid}&select=blob`, { token: me.token });
    record(`${X}'s ${t} rows are untouched and nothing was added in its name`, still.status === 200 && Array.isArray(still.json) && still.json.length > 0 && still.json.every((r) => r.blob !== 'tampered' && r.blob !== 'forged' && r.blob !== `rls-${Y}`), `HTTP ${still.status}`);
    const theirs = await call('GET', `${ownRows(t, other.uid)}&select=blob`, { token: other.token });
    record(`${Y}'s own ${t} row is still its own`, theirs.status === 200 && Array.isArray(theirs.json) && theirs.json.some((r) => r.blob === `rls-${Y}`), `HTTP ${theirs.status}`);
  }
}

// Tokens: forged or damaged ones are refused; a signed-out session's refresh token is dead.
async function tokens(A) {
  const parts = A.token.split('.');
  const flip = (x) => x.slice(0, -2) + (x.slice(-2) === 'AA' ? 'AB' : 'AA');
  const damaged = [parts[0], parts[1], flip(parts[2])].join('.');
  for (const [name, tok] of [['a damaged token', damaged], ['a made-up token', 'not.a.token'], ['an unsigned token claiming A', `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${parts[1]}.`]]) {
    const r = await call('GET', `/rest/v1/oto_sync?user_id=eq.${A.uid}&select=user_id`, { token: tok });
    record(`${name} is refused`, refused(r) || r.status === 401 || (r.status >= 400 && r.status < 500) || (r.status === 200 && Array.isArray(r.json) && r.json.length === 0), `HTTP ${r.status}`);
  }
  // a second session for A, signed out: its refresh token can't make new tokens any more
  const s2 = await signIn(process.env.OTO_RLS_A_EMAIL, process.env.OTO_RLS_A_PASSWORD, 'A (second session)');
  const out = await call('POST', '/auth/v1/logout?scope=local', { token: s2.token });
  record('signing a session out works', out.status === 204 || out.status === 200, `HTTP ${out.status}`);
  const again = await call('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s2.refresh } });
  record('a signed-out session\'s refresh token is refused', again.status >= 400 && again.status < 500, `HTTP ${again.status}`);
  // (an access token stays valid until it expires, up to an hour: Supabase access tokens are not checked against
  // sign-outs. Documented in docs/SECURITY_REVIEW_1.7.13.md.)
}

(async () => {
  console.log(`Oto Accounts access check: ${URL_.replace(/^https:\/\//, '')}  (run ${RUN})\n`);
  let code = 0, both = false;
  try {
    const settings = await call('GET', '/auth/v1/settings');
    if (settings.json) console.log(`info  sign-up ${settings.json.disable_signup ? 'disabled' : 'open'}, email confirmation ${settings.json.mailer_autoconfirm ? 'OFF (auto-confirm)' : 'required'}\n`);
    await anonymous();
    both = await twoAccounts();
  } catch (e) {
    if (e instanceof Unreachable) { console.log(`INCONCLUSIVE  ${e.message}`); code = 3; }
    else if (e instanceof NotConfigured) { console.log(`NOT RUN  ${e.message}`); code = 2; }
    else { console.log(`FAIL  the check broke: ${e.message}`); code = 1; }
  }
  const failed = results.filter((r) => !r.pass);
  if (failed.length) code = 1;
  const what = both ? 'anonymous + two accounts, both directions' : ANON_ONLY ? 'anonymous checks only (--anonymous-only, not a full result)' : 'INCOMPLETE: the two-account checks did not run';
  console.log(`\n${results.length - failed.length}/${results.length} passed — ${what}${code ? ` — exit ${code}` : ''}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Oto Accounts access check\n\n**${code === 0 && both ? '✅ full check passed' : code === 0 ? '⚠️ anonymous only' : code === 2 ? '❌ not run: test accounts missing or sign-in failed' : code === 3 ? '❌ inconclusive: backend unreachable' : '❌ failed'}** (${what})\n\n| Check | Result |\n|---|---|\n${results.map((r) => `| ${r.name} | ${r.pass ? '✅' : '❌'} ${r.detail} |`).join('\n')}\n`);
  }
  process.exit(code);
})();
