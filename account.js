'use strict';
// Oto Accounts (Supabase). Runs in the main process.
//
// Privacy: everything is encrypted on this PC (AES-256-GCM, key = scrypt of your account password +
// a random salt) before it goes to Supabase, so the server only ever stores scrambled data. The
// derived key and the login tokens are kept locally with Windows' own encryption (safeStorage/DPAPI).
// Passwords are handled only here in the main process — the UI never receives them during sync.

const crypto = require('crypto');

// Public project settings — safe to ship (row level security means people only reach their own row).
// The service_role key must never be put here.
const SUPABASE_URL = process.env.OTO_SUPABASE_URL || 'https://lshiexrntuvueizntvky.supabase.co';
const SUPABASE_KEY = process.env.OTO_SUPABASE_KEY || 'sb_publishable__7WNQA_K0zOmZfFDaSnhNw_4Kebnwtd';

module.exports = function setupAccount(ctx) {
  const { ipcMain, app, safeStorage, net, readJSON, writeJSON, send, pwSyncExport, pwSyncMerge, OTO_VERSION } = ctx;
  const saveOrWarn = ctx.saveOrWarn || ((n, d) => { try { writeJSON(n, d); return true; } catch { return false; } });
  const configured = () => !!(SUPABASE_URL && SUPABASE_KEY);
  const canSeal = () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } };
  // Login tokens, the sync key and a pending password are only written to disk encrypted by Windows (DPAPI).
  // If Windows can't encrypt (rare), they stay in memory for this session only: you're signed in until Oto
  // closes, and nothing readable is left on disk. ({ p: … } is the old readable format, only read to migrate.)
  const MEM = new Map();
  const seal = (s) => {
    if (canSeal()) return { e: safeStorage.encryptString(String(s)).toString('base64') };
    const m = crypto.randomBytes(9).toString('hex'); MEM.set(m, String(s)); return { m };
  };
  const unseal = (o) => { try { if (!o) return null; if (o.e) return safeStorage.decryptString(Buffer.from(o.e, 'base64')); if (o.m) return MEM.has(o.m) ? MEM.get(o.m) : null; if (o.p) return Buffer.from(o.p, 'base64').toString(); } catch {} return null; };
  const device = () => { try { return require('os').hostname().slice(0, 40); } catch { return 'PC'; } };

  // ------------------------------------------------------------ account file
  let A = readJSON('account.json', null) || {};
  // Returns whether account.json really reached the disk. Everyday saves (sign-in tokens, sync times) tell you once if
  // they fail and keep working until Oto closes; the password change refuses to start unless its save succeeds.
  const saveA = () => saveOrWarn('account.json', A, 'your Oto account sign-in');
  // Older versions could save these readable (Base64) when encryption was unavailable: re-protect them now.
  { let moved = false; for (const k of ['access', 'refresh', 'key', 'pendingPw']) if (A[k] && A[k].p) { const v = unseal(A[k]); if (v == null) delete A[k]; else A[k] = seal(v); moved = true; } if (moved) saveA(); }
  // Signed in = tokens AND the data key (the key comes from your password; without it sync can't work).
  const signedIn = () => !!(A.userId && A.refresh && A.key);
  const status = () => ({
    configured: configured(), signedIn: signedIn(), email: A.email || '', lastSync: A.lastSync || 0, lastRemote: A.lastRemote || 0,
    syncing: !!busy, error: lastError, lock: lockStatus(),
  });
  let busy = null, lastError = '';
  // push and pull wait for each other instead of failing with "busy"
  let chain = Promise.resolve();
  const queue = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  const tell = () => send('account:status', status());

  // ------------------------------------------------------------ HTTP
  async function api(method, path, { body, token, headers = {} } = {}) {
    if (!configured()) throw Object.assign(new Error('Oto Accounts aren’t set up yet.'), { code: 'config' });
    const h = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    let res;
    try { res = await net.fetch(`${SUPABASE_URL}${path}`, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) }); }
    catch { throw Object.assign(new Error('Can’t reach Oto Accounts — check your internet.'), { code: 'net' }); }
    const txt = await res.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
    if (!res.ok) {
      const msg = (data && (data.msg || data.error_description || data.message || data.error)) || `Error ${res.status}`;
      const pg = data && data.code;
      if (pg === '42P01' || pg === 'PGRST205' || pg === '42501' || pg === 'PGRST106') throw Object.assign(new Error('The Oto server isn’t fully set up yet (sync table missing or not allowed).'), { status: res.status, code: pg });
      throw Object.assign(new Error(String(msg)), { status: res.status, code: data && (data.error_code || data.code) });
    }
    return data;
  }
  function takeSession(s) {
    A.userId = s.user && s.user.id; A.email = (s.user && s.user.email) || A.email;
    A.access = seal(s.access_token); A.refresh = seal(s.refresh_token);
    A.expires = Date.now() + (s.expires_in || 3600) * 1000 - 60000;
    saveA();
  }
  async function token() {
    if (!(A.userId && A.refresh)) throw Object.assign(new Error('Not signed in'), { code: 'auth' });
    if (Date.now() < (A.expires || 0)) { const t = unseal(A.access); if (t) return t; }
    // One refresh at a time: Supabase refresh tokens work once, so two at the same moment signed you out.
    if (!refreshing) {
      refreshing = (async () => {
        const r = unseal(A.refresh);
        if (!r) throw Object.assign(new Error('Please sign in again'), { code: 'auth' });
        try { takeSession(await api('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: r } })); }
        catch (e) { if (e.status === 400 || e.status === 401) { signOutLocal(); tell(); throw Object.assign(new Error('Your sign-in expired — please sign in again'), { code: 'auth' }); } throw e; }
      })().finally(() => { refreshing = null; });
    }
    await refreshing;
    return unseal(A.access);
  }
  let refreshing = null;
  function signOutLocal() { A = { email: A.email, deviceId: A.deviceId }; saveA(); }

  // ------------------------------------------------------------ encryption
  const deriveKey = (password, salt) => crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const dataKey = () => { const k = unseal(A.key); return k ? Buffer.from(k, 'base64') : null; };
  function encrypt(obj, key) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
    return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${data.toString('base64')}`;
  }
  function decrypt(blob, key) {
    const [v, iv, tag, data] = String(blob).split('.');
    if (v !== 'v1') throw new Error('format');
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'));
  }

  // ------------------------------------------------------------ rows
  async function getRow() {
    const rows = await api('GET', `/rest/v1/oto_sync?user_id=eq.${encodeURIComponent(A.userId)}&select=blob,salt,updated_at,device`, { token: await token() });
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }
  async function putRow(blob, salt) {
    await api('POST', '/rest/v1/oto_sync?on_conflict=user_id', {
      token: await token(), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { user_id: A.userId, blob, salt, updated_at: new Date().toISOString(), device: device() },
    });
  }

  // Write only if the cloud row is still the one this PC last saw (compare-and-swap on updated_at). If another
  // device wrote in between, nothing is overwritten: the caller pulls and merges first, then tries again.
  async function putRowIfUnchanged(blob, salt, seen) {
    const body = { blob, salt, updated_at: new Date().toISOString(), device: device() };
    const t = await token();
    if (!seen) { // no row yet: create it, but never replace one that appeared meanwhile
      try { await api('POST', '/rest/v1/oto_sync', { token: t, headers: { Prefer: 'return=representation' }, body: { user_id: A.userId, ...body } }); }
      catch (e) { if (e.status === 409 || e.code === '23505') return null; throw e; }
      return body.updated_at;
    }
    const rows = await api('PATCH', `/rest/v1/oto_sync?user_id=eq.${encodeURIComponent(A.userId)}&updated_at=eq.${encodeURIComponent(seen)}`, { token: t, headers: { Prefer: 'return=representation' }, body });
    return Array.isArray(rows) && rows[0] ? rows[0].updated_at : null;
  }

  // ------------------------------------------------------------ passwords in the sync payload
  // Passwords (and markers for deleted ones) are packed and merged by main/passwords.js.
  // ------------------------------------------------------------ sign up / in / out
  async function afterAuth(password) {
    const row = await getRow();
    if (row) {
      const key = deriveKey(password, row.salt);
      try {
        const payload = decrypt(row.blob, key);
        A.salt = row.salt; A.key = seal(key.toString('base64')); saveA();
        return { ok: true, remote: { exists: true, at: payload.at || Date.parse(row.updated_at), device: row.device, summary: payload.summary || null } };
      } catch {
        // Saved with an older password (e.g. after "forgot password").
        A.pendingPw = seal(password); saveA();
        return { ok: true, oldData: true, remote: { exists: true, at: Date.parse(row.updated_at), device: row.device } };
      }
    }
    const salt = crypto.randomBytes(16).toString('base64');
    A.salt = salt; A.key = seal(deriveKey(password, salt).toString('base64')); saveA();
    return { ok: true, remote: { exists: false } };
  }
  ipcMain.handle('account:status', () => status());
  ipcMain.handle('account:signup', async (_e, email, password) => {
    try {
      if (String(password || '').length < 8) return { ok: false, error: 'Use at least 8 characters for your password.' };
      const r = await api('POST', '/auth/v1/signup', { body: { email: String(email).trim(), password: String(password) } });
      if (r && r.access_token) { takeSession(r); let out; try { out = await afterAuth(password); } catch (e) { signOutLocal(); tell(); return { ok: false, error: e.message }; } tell(); return out; }
      A.email = String(email).trim(); saveA();
      return { ok: true, confirm: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  const signinTries = { n: 0, until: 0 };
  ipcMain.handle('account:signin', async (_e, email, password) => {
    if (Date.now() < signinTries.until) return { ok: false, error: `Too many tries — wait ${Math.ceil((signinTries.until - Date.now()) / 1000)} s.` };
    try {
      const r = await api('POST', '/auth/v1/token?grant_type=password', { body: { email: String(email).trim(), password: String(password) } });
      signinTries.n = 0;
      takeSession(r);
      let out;
      try { out = await afterAuth(password); } catch (e2) { signOutLocal(); tell(); return { ok: false, error: e2.message }; }
      tell();
      return out;
    } catch (e) {
      if (e.status === 400) { signinTries.n++; if (signinTries.n >= 5) signinTries.until = Date.now() + 30000 * 2 ** (signinTries.n - 5); }
      const m = /confirm/i.test(e.message) ? 'Please confirm your email first — check your inbox.' : /invalid/i.test(e.message) ? 'Wrong email or password.' : e.message;
      return { ok: false, error: m };
    }
  });
  ipcMain.handle('account:oldPassword', async (_e, oldPassword) => {
    // Read data saved with an older password, then re-save it with the current one.
    try {
      const row = await getRow();
      const payload = decrypt(row.blob, deriveKey(oldPassword, row.salt));
      const cur = unseal(A.pendingPw);
      const salt = crypto.randomBytes(16).toString('base64');
      const key = deriveKey(cur, salt);
      await putRow(encrypt(payload, key), salt);
      A.salt = salt; A.key = seal(key.toString('base64')); delete A.pendingPw; saveA();
      return { ok: true, remote: { exists: true, at: payload.at, summary: payload.summary || null } };
    } catch { return { ok: false, error: 'That old password didn’t work.' }; }
  });
  ipcMain.handle('account:startFresh', async () => {
    try {
      const cur = unseal(A.pendingPw);
      const salt = crypto.randomBytes(16).toString('base64');
      A.salt = salt; A.key = seal(deriveKey(cur, salt).toString('base64')); delete A.pendingPw; saveA();
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('account:signout', async () => {
    try { const t = unseal(A.access); if (t) await api('POST', '/auth/v1/logout', { token: t }).catch(() => {}); } catch {}
    signOutLocal(); tell(); return true;
  });
  ipcMain.handle('account:forgot', async (_e, email) => {
    try { await api('POST', '/auth/v1/recover', { body: { email: String(email).trim() } }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
  });
  // Forgot password → the email has a code (Supabase "Reset password" template uses {{ .Token }}).
  // Check the code, set the new password and sign in — no web page needed.
  const resetTries = { n: 0, until: 0 };
  ipcMain.handle('account:resetWithCode', async (_e, email, code, password) => {
    if (Date.now() < resetTries.until) return { ok: false, error: `Too many tries — wait ${Math.ceil((resetTries.until - Date.now()) / 1000)} s.` };
    const c = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(c)) return { ok: false, error: 'Type the code from the email (numbers only).' };
    if (String(password || '').length < 8) return { ok: false, error: 'Use at least 8 characters for your new password.' };
    let r;
    try { r = await api('POST', '/auth/v1/verify', { body: { type: 'recovery', email: String(email).trim(), token: c } }); }
    catch (e) {
      resetTries.n++; if (resetTries.n >= 5) resetTries.until = Date.now() + 30000 * 2 ** (resetTries.n - 5);
      return { ok: false, error: /expired|invalid|otp|token/i.test(e.message) ? 'That code is wrong or has expired. Check the newest email, or send a new code.' : e.message };
    }
    resetTries.n = 0;
    if (!r || !r.access_token) return { ok: false, error: 'Couldn’t check the code — try again.' };
    // 1) set the new password with the short-lived reset session
    try {
      takeSession(r);
      await api('PUT', '/auth/v1/user', { token: await token(), body: { password: String(password) } });
    } catch (e) { signOutLocal(); tell(); return { ok: false, error: /same|different/i.test(e.message) ? 'Pick a password you haven’t used for this account before.' : e.message }; }
    // 2) sign in normally with the new password (the reset session isn't used for sync)
    try {
      takeSession(await api('POST', '/auth/v1/token?grant_type=password', { body: { email: String(email).trim(), password: String(password) } }));
      const out = await afterAuth(String(password));
      tell();
      return out;
    } catch (e) { signOutLocal(); tell(); return { ok: false, changed: true, error: `Your password is changed ✓ — now sign in with the new one. (${e.message})` }; }
  });
  // New account → the email has a code (Supabase "Confirm signup" template uses {{ .Token }}).
  ipcMain.handle('account:confirmWithCode', async (_e, email, code, password) => {
    if (Date.now() < resetTries.until) return { ok: false, error: `Too many tries — wait ${Math.ceil((resetTries.until - Date.now()) / 1000)} s.` };
    const c = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(c)) return { ok: false, error: 'Type the code from the email (numbers only).' };
    let r;
    try { r = await api('POST', '/auth/v1/verify', { body: { type: 'signup', email: String(email).trim(), token: c } }); }
    catch (e) {
      resetTries.n++; if (resetTries.n >= 5) resetTries.until = Date.now() + 30000 * 2 ** (resetTries.n - 5);
      return { ok: false, error: /expired|invalid|otp|token/i.test(e.message) ? 'That code is wrong or has expired. Check the newest email, or send a new code.' : e.message };
    }
    resetTries.n = 0;
    if (!r || !r.access_token) return { ok: true, signIn: true };
    try { takeSession(r); const out = await afterAuth(String(password)); tell(); return out; }
    catch (e) { signOutLocal(); tell(); return { ok: false, error: e.message }; }
  });
  ipcMain.handle('account:resendConfirm', async (_e, email) => {
    try { await api('POST', '/auth/v1/resend', { body: { type: 'signup', email: String(email).trim() } }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
  });
  // Changing your account password re-encrypts your cloud data with a key made from the new password. That takes two
  // server steps (change the password, then upload the re-encrypted data), so it's done as a job that can't be left
  // half-done: the new key is saved first (encrypted), the old key is kept until the cloud copy is confirmed under the
  // new one, and if anything breaks in between, the next sync finishes the job. It runs in the same queue as sync,
  // so it never overlaps a push or pull.
  const keyOf = (sealed) => { const k = unseal(sealed); return k ? Buffer.from(k, 'base64') : null; };
  async function finishRotation() {
    const R = A.rotation;
    if (!R) return;
    if (R.pw) { // we don't know yet whether the server took the new password (the answer got lost)
      try { takeSession(await api('POST', '/auth/v1/token?grant_type=password', { body: { email: A.email, password: unseal(R.pw) } })); }
      catch (e) { if (e.status === 400) { delete A.rotation; saveA(); return; } throw e; } // 400: it didn't change, nothing to do
      delete R.pw; saveA();
    }
    const newKey = keyOf(R.key), oldKey = keyOf(R.oldKey);
    if (!newKey) { delete A.rotation; saveA(); return; } // key was memory-only and Oto restarted: signing in again fixes it
    for (let i = 0; i < 3; i++) {
      const row = await getRow();
      const done = (stamp) => { A.key = R.key; A.salt = R.salt; if (stamp) A.seenStamp = stamp; delete A.rotation; saveA(); };
      if (!row) return done(null);
      if (row.salt === R.salt) return done(row.updated_at); // already re-encrypted
      let payload;
      try { payload = decrypt(row.blob, oldKey); } catch { throw Object.assign(new Error('Couldn’t read your cloud data with the old password'), { code: 'rotation' }); }
      const stamp = await putRowIfUnchanged(encrypt(payload, newKey), R.salt, row.updated_at);
      if (stamp) return done(stamp);
      // another device wrote in between: read again and re-encrypt its newer copy
    }
    throw Object.assign(new Error('Your other device kept syncing — try again in a moment'), { code: 'conflict' });
  }
  ipcMain.handle('account:changePassword', async (_e, current, next) => queue(async () => {
    try {
      if (String(next || '').length < 8) return { ok: false, error: 'Use at least 8 characters.' };
      if (A.rotation) await finishRotation(); // an earlier change still finishing
      // The job must survive a restart, so it needs Windows encryption (DPAPI) and a successful save to disk.
      if (!canSeal()) return { ok: false, error: 'Windows can’t encrypt right now, so Oto won’t change your password (it couldn’t finish safely if interrupted). Try again after restarting Oto.' };
      await api('POST', '/auth/v1/token?grant_type=password', { body: { email: A.email, password: String(current) } }).then(takeSession);
      const salt = crypto.randomBytes(16).toString('base64');
      // Everything needed to finish (or safely undo) is saved BEFORE the server password changes: the new key, the old
      // key, and — until the server confirms — the new password, all encrypted by Windows.
      A.rotation = { salt, key: seal(deriveKey(next, salt).toString('base64')), oldKey: A.key, pw: seal(String(next)), at: Date.now() };
      if (!saveA()) { delete A.rotation; return { ok: false, error: 'Oto couldn’t save to disk (is it full?), so your password was not changed.' }; }
      try { await api('PUT', '/auth/v1/user', { token: await token(), body: { password: String(next) } }); }
      catch (e) {
        if (e.status) { delete A.rotation; saveA(); throw e; } // the server said no: nothing changed
        return { ok: false, pending: true, error: 'No answer from Oto Accounts — Oto will finish this when you’re back online.' }; // next sync checks which password is real
      }
      delete A.rotation.pw; saveA(); // confirmed (if this save fails, the next start re-checks with the saved password — still safe)
      try { await finishRotation(); } catch (e) { return { ok: true, pending: true, note: 'Password changed. Your synced data finishes re-encrypting on the next sync.' }; }
      return { ok: true };
    } catch (e) { return { ok: false, error: /invalid/i.test(e.message) ? 'Your current password is wrong.' : e.message }; }
  }));
  ipcMain.handle('account:deleteCloud', async () => {
    try { await api('DELETE', `/rest/v1/oto_sync?user_id=eq.${encodeURIComponent(A.userId)}`, { token: await token() }); A.lastSync = 0; A.lastRemote = 0; saveA(); tell(); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  // ------------------------------------------------------------ push / pull
  // push: the UI sends its sections (settings, themes, spaces, bookmarks, card); passwords are added here.
  ipcMain.handle('account:push', async (_e, sections, summary) => {
    if (!signedIn() || !dataKey()) { tell(); return { ok: false, error: 'Please sign in again', code: 'auth' }; }
    return queue(async () => {
    busy = 'push'; tell();
    try {
      if (A.rotation) await finishRotation(); // finish an interrupted password change before writing
      const pwOn = !(sections && sections._pw === false);
      const pw = pwOn ? pwSyncExport() : null;
      const payload = { v: 1, at: Date.now(), app: OTO_VERSION, device: device(), summary, sections, passwords: pw ? pw.entries : undefined, pwDeleted: pw ? pw.deleted : undefined };
      if (payload.sections) delete payload.sections._pw;
      // Changed in the cloud since this PC last synced? Merge first (the UI pulls, then pushes again).
      const row = await getRow();
      if (row && row.updated_at !== A.seenStamp) return { ok: false, code: 'conflict', error: 'Your other device synced first' };
      const stamp = await putRowIfUnchanged(encrypt(payload, dataKey()), A.salt, row ? row.updated_at : null);
      if (!stamp) return { ok: false, code: 'conflict', error: 'Your other device synced first' };
      A.seenStamp = stamp; A.lastSync = payload.at; A.lastRemote = payload.at; lastError = ''; saveA();
      return { ok: true, at: payload.at };
    } catch (e) { lastError = e.message; return { ok: false, error: e.message, code: e.code }; } finally { busy = null; tell(); }
    });
  });
  // pull: returns the sections to the UI; passwords are merged straight into this PC's password store.
  ipcMain.handle('account:pull', async (_e, { passwords = true } = {}) => {
    if (!signedIn() || !dataKey()) { tell(); return { ok: false, error: 'Please sign in again', code: 'auth' }; }
    return queue(async () => {
    busy = 'pull'; tell();
    try {
      if (A.rotation) await finishRotation(); // finish an interrupted password change before reading
      const row = await getRow();
      if (!row) { lastError = ''; return { ok: true, empty: true }; }
      const payload = decrypt(row.blob, dataKey());
      const pw = passwords ? pwSyncMerge(payload.passwords, payload.pwDeleted) : 0;
      A.lastRemote = payload.at || Date.parse(row.updated_at); A.seenStamp = row.updated_at; A.lastSync = Date.now(); lastError = ''; saveA();
      return { ok: true, at: A.lastRemote, device: payload.device, sections: payload.sections || {}, passwords: pw };
    } catch (e) { lastError = e.message === 'format' ? 'Couldn’t read your cloud data' : e.message; return { ok: false, error: lastError, code: e.code }; } finally { busy = null; tell(); }
    });
  });
  ipcMain.handle('account:peek', async () => {
    // Is there something newer in the cloud than what this PC last saw?
    try {
      if (!signedIn()) return { ok: false };
      const rows = await api('GET', `/rest/v1/oto_sync?user_id=eq.${encodeURIComponent(A.userId)}&select=updated_at,device`, { token: await token() });
      const r = Array.isArray(rows) && rows[0];
      return { ok: true, at: r ? Date.parse(r.updated_at) : 0, device: r ? r.device : '', newer: !!(r && Date.parse(r.updated_at) > (A.lastRemote || 0) + 2000 && r.device !== device()) };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ------------------------------------------------------------ linked devices (your phone ⇄ this PC)
  // Every Oto (PC or phone) signed in to the same account keeps one row in oto_devices. What's inside
  // (name, model, battery, open tabs) is encrypted with a key made from your sync key, so the server only
  // sees scrambled text. Tabs sent to a device wait in oto_inbox until that device picks them up.
  if (!A.deviceId) { A.deviceId = crypto.randomUUID(); saveA(); }
  const devKey = () => { const k = dataKey(); return k ? crypto.createHmac('sha256', k).update('oto-devices-v1').digest() : null; };
  const devErr = (e) => ({ ok: false, error: e.message, code: e.code === 'auth' ? 'auth' : /42P01|PGRST205|42501|PGRST106/.test(String(e.code)) ? 'setup' : e.code });
  let lastBeat = { at: 0, sig: '' };
  ipcMain.handle('devices:beat', async (_e, info = {}) => {
    if (!signedIn() || !devKey()) return { ok: false, code: 'auth' };
    try {
      const t = await token(), key = devKey(), uid = encodeURIComponent(A.userId);
      const tabs = (Array.isArray(info.tabs) ? info.tabs : []).slice(0, 40).map((x) => ({ t: String(x.t || '').slice(0, 140), u: String(x.u || '').slice(0, 1000) })).filter((x) => /^https?:/i.test(x.u));
      const me = { name: device(), kind: 'pc', os: `Windows ${require('os').release()}`, app: OTO_VERSION, tabs, active: String(info.active || '').slice(0, 1000) };
      const sig = JSON.stringify(me);
      // write this PC's row when something changed, and at least every 2 minutes (that's "online")
      if (sig !== lastBeat.sig || Date.now() - lastBeat.at > 120000 || info.force) {
        await api('POST', '/rest/v1/oto_devices?on_conflict=user_id,device_id', {
          token: t, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: { user_id: A.userId, device_id: A.deviceId, kind: 'pc', blob: encrypt({ ...me, at: Date.now() }, key), updated_at: new Date().toISOString() },
        });
        lastBeat = { at: Date.now(), sig };
      }
      const rows = await api('GET', `/rest/v1/oto_devices?user_id=eq.${uid}&select=device_id,kind,blob,updated_at&order=updated_at.desc`, { token: t });
      const devices = (rows || []).filter((r) => r.device_id !== A.deviceId).map((r) => {
        let d = null; try { d = decrypt(r.blob, key); } catch {}
        return { id: r.device_id, kind: r.kind, seen: Date.parse(r.updated_at), locked: !d, ...(d || {}) };
      });
      // tabs sent to this PC
      const box = await api('GET', `/rest/v1/oto_inbox?user_id=eq.${uid}&to_device=eq.${encodeURIComponent(A.deviceId)}&select=id,blob,created_at&order=id.asc`, { token: t });
      const inbox = [];
      for (const m of box || []) { try { inbox.push({ ...decrypt(m.blob, key), at: Date.parse(m.created_at) }); } catch {} }
      if ((box || []).length) await api('DELETE', `/rest/v1/oto_inbox?user_id=eq.${uid}&to_device=eq.${encodeURIComponent(A.deviceId)}&id=lte.${box[box.length - 1].id}`, { token: t }).catch(() => {});
      return { ok: true, me: { id: A.deviceId, name: device() }, devices, inbox };
    } catch (e) { return devErr(e); }
  });
  ipcMain.handle('devices:send', async (_e, deviceId, url, title) => {
    if (!signedIn() || !devKey()) return { ok: false, code: 'auth' };
    if (!/^https?:/i.test(String(url || ''))) return { ok: false, error: 'Only web pages can be sent.' };
    try {
      await api('POST', '/rest/v1/oto_inbox', {
        token: await token(), headers: { Prefer: 'return=minimal' },
        body: { user_id: A.userId, to_device: String(deviceId), blob: encrypt({ u: String(url).slice(0, 2000), t: String(title || '').slice(0, 200), from: device() }, devKey()) },
      });
      return { ok: true };
    } catch (e) { return devErr(e); }
  });
  ipcMain.handle('devices:forget', async (_e, deviceId) => {
    if (!signedIn()) return { ok: false, code: 'auth' };
    try { await api('DELETE', `/rest/v1/oto_devices?user_id=eq.${encodeURIComponent(A.userId)}&device_id=eq.${encodeURIComponent(String(deviceId))}`, { token: await token() }); return { ok: true }; }
    catch (e) { return devErr(e); }
  });

  // ------------------------------------------------------------ the PC lock (removed)
  // The PC lock was removed in owner.16. It is NOT a barrier any more: a saved lock file from an older version is
  // deleted, and nothing in Oto offers or claims it. Use Windows' own sign-in to keep others out of your PC.
  try { require('fs').unlinkSync(require('path').join(app.getPath('userData'), 'lock.json')); } catch {}
  function lockStatus() { return { enabled: false, locked: false }; }
  ipcMain.handle('lock:status', () => lockStatus());

  return {
    status,
    pwAllowed: () => true,
  };
};
