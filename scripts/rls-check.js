#!/usr/bin/env node
'use strict';
// Oto Accounts (Supabase) access check: Row-Level Security must keep every account's rows private.
// Runs on GitHub Actions (.github/workflows/backend-check.yml), weekly and on demand. Plain Node 22, no packages.
//
// Part 1, always: with only the public (publishable) key and no sign-in, nobody can read, add, change or delete rows
// in oto_sync, oto_devices or oto_inbox.
// Part 2, when the two TEST accounts are configured as repository secrets (OTO_RLS_A_EMAIL / _PASSWORD and
// OTO_RLS_B_EMAIL / _PASSWORD): account B can't read, change, delete or impersonate account A's rows (and can't move
// its own rows to A). Use dedicated test accounts only: the check writes and then removes small test rows in them.
//
// Exit code 1 if any check fails. Never prints passwords, tokens or row contents.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const src = fs.readFileSync(path.join(__dirname, '..', 'account.js'), 'utf8');
const URL_ = process.env.OTO_SUPABASE_URL || src.match(/SUPABASE_URL = process\.env\.OTO_SUPABASE_URL \|\| '([^']+)'/)[1];
const KEY = process.env.OTO_SUPABASE_KEY || src.match(/SUPABASE_KEY = process\.env\.OTO_SUPABASE_KEY \|\| '([^']+)'/)[1];
const TABLES = ['oto_sync', 'oto_devices', 'oto_inbox'];
const results = [];
const record = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

async function call(method, p, { token, body, prefer } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(URL_ + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: r.status, json };
}
// "denied" = the server refused (401/403, or Postgres permission/RLS error 42501), or nothing came back / was touched
const refused = (r) => r.status === 401 || r.status === 403 || (r.json && (r.json.code === '42501' || /row-level security|permission denied/i.test(r.json.message || '')));
const emptyOrRefused = (r) => refused(r) || (r.status >= 200 && r.status < 300 && Array.isArray(r.json) && r.json.length === 0);
const testRow = (table, uid) => ({
  oto_sync: { user_id: uid, blob: 'rls-test', salt: 'rls-test', updated_at: new Date().toISOString(), device: 'rls-test' },
  oto_devices: { user_id: uid, device_id: 'rls-test-device', kind: 'pc', blob: 'rls-test', updated_at: new Date().toISOString() },
  oto_inbox: { user_id: uid, to_device: 'rls-test-device', blob: 'rls-test' },
}[table]);

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

async function signIn(email, password) {
  const r = await call('POST', '/auth/v1/token?grant_type=password', { body: { email, password } });
  if (r.status !== 200 || !r.json || !r.json.access_token) throw new Error(`sign-in failed for a test account (HTTP ${r.status})`);
  return { token: r.json.access_token, uid: r.json.user.id };
}

async function twoAccounts() {
  const env = process.env;
  if (!(env.OTO_RLS_A_EMAIL && env.OTO_RLS_A_PASSWORD && env.OTO_RLS_B_EMAIL && env.OTO_RLS_B_PASSWORD)) {
    console.log('SKIP  two-account checks: set OTO_RLS_A_EMAIL/_PASSWORD and OTO_RLS_B_EMAIL/_PASSWORD (dedicated test accounts) as repository secrets');
    return false;
  }
  const A = await signIn(env.OTO_RLS_A_EMAIL, env.OTO_RLS_A_PASSWORD);
  const B = await signIn(env.OTO_RLS_B_EMAIL, env.OTO_RLS_B_PASSWORD);
  record('the two test accounts are different users', A.uid !== B.uid);
  // A writes its own test rows (allowed)
  await call('POST', '/rest/v1/oto_sync?on_conflict=user_id', { token: A.token, body: testRow('oto_sync', A.uid), prefer: 'resolution=merge-duplicates,return=minimal' });
  await call('POST', '/rest/v1/oto_devices?on_conflict=user_id,device_id', { token: A.token, body: testRow('oto_devices', A.uid), prefer: 'resolution=merge-duplicates,return=minimal' });
  await call('POST', '/rest/v1/oto_inbox', { token: A.token, body: testRow('oto_inbox', A.uid), prefer: 'return=minimal' });
  for (const t of TABLES) {
    const own = await call('GET', `/rest/v1/${t}?user_id=eq.${A.uid}&select=user_id`, { token: A.token });
    record(`A can read its own ${t} rows`, own.status === 200 && Array.isArray(own.json) && own.json.length > 0, `HTTP ${own.status}`);
    const read = await call('GET', `/rest/v1/${t}?user_id=eq.${A.uid}&select=*`, { token: B.token });
    record(`B can't read A's ${t}`, emptyOrRefused(read), `HTTP ${read.status}`);
    const all = await call('GET', `/rest/v1/${t}?select=user_id&limit=1000`, { token: B.token });
    record(`B sees only its own rows in ${t}`, all.status === 200 && Array.isArray(all.json) && all.json.every((r) => r.user_id === B.uid), `HTTP ${all.status}`);
    const upd = await call('PATCH', `/rest/v1/${t}?user_id=eq.${A.uid}`, { token: B.token, body: { blob: 'tampered' }, prefer: 'return=representation' });
    record(`B can't change A's ${t}`, emptyOrRefused(upd), `HTTP ${upd.status}`);
    const del = await call('DELETE', `/rest/v1/${t}?user_id=eq.${A.uid}`, { token: B.token, prefer: 'return=representation' });
    record(`B can't delete A's ${t}`, emptyOrRefused(del), `HTTP ${del.status}`);
    const ins = await call('POST', `/rest/v1/${t}`, { token: B.token, body: { ...testRow(t, A.uid), ...(t === 'oto_devices' ? { device_id: 'rls-b-as-a' } : {}) }, prefer: 'return=minimal' });
    record(`B can't add rows as A in ${t}`, refused(ins) || ins.status >= 400, `HTTP ${ins.status}`);
    // privilege escalation: B moves its own row to A
    await call('POST', `/rest/v1/${t}${t === 'oto_sync' ? '?on_conflict=user_id' : t === 'oto_devices' ? '?on_conflict=user_id,device_id' : ''}`, { token: B.token, body: testRow(t, B.uid), prefer: t === 'oto_inbox' ? 'return=minimal' : 'resolution=merge-duplicates,return=minimal' });
    const move = await call('PATCH', `/rest/v1/${t}?user_id=eq.${B.uid}`, { token: B.token, body: { user_id: A.uid }, prefer: 'return=representation' });
    record(`B can't move its rows to A in ${t}`, emptyOrRefused(move) || move.status >= 400, `HTTP ${move.status}`);
    const still = await call('GET', `/rest/v1/${t}?user_id=eq.${A.uid}&select=blob`, { token: A.token });
    record(`A's ${t} rows are untouched`, Array.isArray(still.json) && still.json.every((r) => r.blob === 'rls-test'), `HTTP ${still.status}`);
  }
  // clean up both test accounts' rows
  for (const who of [A, B]) for (const t of TABLES) await call('DELETE', `/rest/v1/${t}?user_id=eq.${who.uid}${t === 'oto_sync' ? '&device=eq.rls-test' : t === 'oto_devices' ? '&device_id=eq.rls-test-device' : '&to_device=eq.rls-test-device'}`, { token: who.token });
  return true;
}

(async () => {
  console.log(`Oto Accounts access check: ${URL_.replace(/^https:\/\//, '')}\n`);
  const settings = await call('GET', '/auth/v1/settings');
  if (settings.json) console.log(`info  sign-up ${settings.json.disable_signup ? 'disabled' : 'open'}, email confirmation ${settings.json.mailer_autoconfirm ? 'OFF (auto-confirm)' : 'required'}\n`);
  await anonymous();
  let both = false;
  try { both = await twoAccounts(); } catch (e) { record('two-account checks could run', false, e.message); }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed${both ? '' : ' (anonymous checks only)'}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Oto Accounts access check\n\n| Check | Result |\n|---|---|\n${results.map((r) => `| ${r.name} | ${r.pass ? '✅' : '❌'} ${r.detail} |`).join('\n')}\n`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('check could not run:', e.message); process.exit(1); });
