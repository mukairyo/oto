'use strict';
// Oto Accounts (Supabase) + the PC lock. Runs in the main process.
//
// Privacy: everything is encrypted on this PC (AES-256-GCM, key = scrypt of your account password +
// a random salt) before it goes to Supabase, so the server only ever stores scrambled data. The
// derived key and the login tokens are kept locally with Windows' own encryption (safeStorage/DPAPI).
// Passwords are handled only here in the main process — the UI never receives them during sync.
//
// The PC lock is a PIN or password (scrypt hash). While Oto is locked the UI is covered, pages are
// hidden and muted, and saved passwords / sync refuse to work. Showing or copying a saved password
// asks for it again.

const crypto = require('crypto');

// Public project settings — safe to ship (row level security means people only reach their own row).
// The service_role key must never be put here.
const SUPABASE_URL = process.env.OTO_SUPABASE_URL || 'https://lshiexrntuvueizntvky.supabase.co';
const SUPABASE_KEY = process.env.OTO_SUPABASE_KEY || 'sb_publishable__7WNQA_K0zOmZfFDaSnhNw_4Kebnwtd';

module.exports = function setupAccount(ctx) {
  const { ipcMain, app, safeStorage, net, powerMonitor, readJSON, writeJSON, send, pwLoad, pwDec, pwUpsert, OTO_VERSION } = ctx;
  const configured = () => !!(SUPABASE_URL && SUPABASE_KEY);
  const canSeal = () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } };
  const seal = (s) => (canSeal() ? { e: safeStorage.encryptString(String(s)).toString('base64') } : { p: Buffer.from(String(s)).toString('base64') });
  const unseal = (o) => { try { if (!o) return null; if (o.e) return safeStorage.decryptString(Buffer.from(o.e, 'base64')); if (o.p) return Buffer.from(o.p, 'base64').toString(); } catch {} return null; };
  const device = () => { try { return require('os').hostname().slice(0, 40); } catch { return 'PC'; } };

  // ------------------------------------------------------------ account file
  let A = readJSON('account.json', null) || {};
  const saveA = () => { try { writeJSON('account.json', A); } catch {} };
  const signedIn = () => !!(A.userId && A.refresh);
  const status = () => ({
    configured: configured(), signedIn: signedIn(), email: A.email || '', lastSync: A.lastSync || 0, lastRemote: A.lastRemote || 0,
    syncing: !!busy, error: lastError, lock: lockStatus(),
  });
  let busy = null, lastError = '';
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
    if (!signedIn()) throw Object.assign(new Error('Not signed in'), { code: 'auth' });
    if (Date.now() < (A.expires || 0)) { const t = unseal(A.access); if (t) return t; }
    const r = unseal(A.refresh);
    if (!r) throw Object.assign(new Error('Please sign in again'), { code: 'auth' });
    try { takeSession(await api('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: r } })); }
    catch (e) { if (e.status === 400 || e.status === 401) { signOutLocal(); tell(); throw Object.assign(new Error('Your sign-in expired — please sign in again'), { code: 'auth' }); } throw e; }
    return unseal(A.access);
  }
  function signOutLocal() { A = { email: A.email }; saveA(); }

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

  // ------------------------------------------------------------ passwords in the sync payload
  const pwExport = () => pwLoad().entries.map((e) => ({ o: e.origin, u: e.username, p: pwDec(e), up: e.updated || e.created || 0 })).filter((e) => e.p);
  function pwMerge(list) {
    let n = 0;
    const local = pwLoad().entries;
    for (const r of list || []) {
      if (!r || !r.o || !r.p) continue;
      const ex = local.find((e) => e.origin === r.o && e.username === r.u);
      if (ex && (ex.updated || 0) >= (r.up || 0)) continue;
      const res = pwUpsert(r.o, r.u || '', r.p);
      if (res !== 'same') n++;
    }
    return n;
  }

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
      if (r && r.access_token) { takeSession(r); const out = await afterAuth(password); tell(); return out; }
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
      const out = await afterAuth(password);
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
  ipcMain.handle('account:changePassword', async (_e, current, next) => {
    try {
      if (String(next || '').length < 8) return { ok: false, error: 'Use at least 8 characters.' };
      await api('POST', '/auth/v1/token?grant_type=password', { body: { email: A.email, password: String(current) } }).then(takeSession);
      const row = await getRow();
      const payload = row ? decrypt(row.blob, dataKey()) : null;
      await api('PUT', '/auth/v1/user', { token: await token(), body: { password: String(next) } });
      const salt = crypto.randomBytes(16).toString('base64');
      const key = deriveKey(next, salt);
      if (payload) await putRow(encrypt(payload, key), salt);
      A.salt = salt; A.key = seal(key.toString('base64')); saveA();
      return { ok: true };
    } catch (e) { return { ok: false, error: /invalid/i.test(e.message) ? 'Your current password is wrong.' : e.message }; }
  });
  ipcMain.handle('account:deleteCloud', async () => {
    try { await api('DELETE', `/rest/v1/oto_sync?user_id=eq.${encodeURIComponent(A.userId)}`, { token: await token() }); A.lastSync = 0; A.lastRemote = 0; saveA(); tell(); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  // ------------------------------------------------------------ push / pull
  // push: the UI sends its sections (settings, themes, spaces, bookmarks, card); passwords are added here.
  ipcMain.handle('account:push', async (_e, sections, summary) => {
    if (lockLocked) return { ok: false, error: 'Oto is locked' };
    if (!signedIn() || !dataKey()) return { ok: false, error: 'Not signed in' };
    if (busy) return { ok: false, error: 'busy' };
    busy = 'push'; tell();
    try {
      const payload = { v: 1, at: Date.now(), app: OTO_VERSION, device: device(), summary, sections, passwords: (sections && sections._pw === false) ? undefined : pwExport() };
      if (payload.sections) delete payload.sections._pw;
      await putRow(encrypt(payload, dataKey()), A.salt);
      A.lastSync = payload.at; A.lastRemote = payload.at; lastError = ''; saveA();
      return { ok: true, at: payload.at };
    } catch (e) { lastError = e.message; return { ok: false, error: e.message, code: e.code }; } finally { busy = null; tell(); }
  });
  // pull: returns the sections to the UI; passwords are merged straight into this PC's password store.
  ipcMain.handle('account:pull', async (_e, { passwords = true } = {}) => {
    if (lockLocked) return { ok: false, error: 'Oto is locked' };
    if (!signedIn() || !dataKey()) return { ok: false, error: 'Not signed in' };
    if (busy) return { ok: false, error: 'busy' };
    busy = 'pull'; tell();
    try {
      const row = await getRow();
      if (!row) { lastError = ''; return { ok: true, empty: true }; }
      const payload = decrypt(row.blob, dataKey());
      const pw = passwords ? pwMerge(payload.passwords) : 0;
      A.lastRemote = payload.at || Date.parse(row.updated_at); A.lastSync = Date.now(); lastError = ''; saveA();
      return { ok: true, at: A.lastRemote, device: payload.device, sections: payload.sections || {}, passwords: pw };
    } catch (e) { lastError = e.message === 'format' || /auth/i.test(e.message) ? 'Couldn’t read your cloud data' : e.message; return { ok: false, error: lastError, code: e.code }; } finally { busy = null; tell(); }
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

  // ------------------------------------------------------------ the PC lock
  let L = readJSON('lock.json', null) || {};
  let lockLocked = !!L.hash; // locked at every start when a lock is set
  let revealUntil = 0;
  const lockTries = { n: 0, until: 0 };
  const saveL = () => { try { writeJSON('lock.json', L); } catch {} };
  const lockHash = (secret, salt) => crypto.scryptSync(String(secret), Buffer.from(salt, 'base64'), 32, { N: 1 << 14 }).toString('base64');
  function lockCheck(secret) {
    if (!L.hash) return true;
    const now = Date.now();
    if (now < lockTries.until) return { wait: Math.ceil((lockTries.until - now) / 1000) };
    const a = Buffer.from(lockHash(secret, L.salt), 'base64'), b = Buffer.from(L.hash, 'base64');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) { lockTries.n = 0; return true; }
    lockTries.n++;
    if (lockTries.n >= 5) lockTries.until = now + Math.min(15 * 60e3, 30e3 * 2 ** (lockTries.n - 5));
    return false;
  }
  function lockStatus() { return { enabled: !!L.hash, locked: lockLocked, kind: L.kind || 'pin', idle: L.idle || 0, onSleep: L.onSleep !== false, reveal: L.reveal !== false }; }
  function lockNow() { if (!L.hash || lockLocked) return; lockLocked = true; send('lock:state', lockStatus()); }
  ipcMain.handle('lock:status', () => lockStatus());
  ipcMain.handle('lock:set', (_e, secret, kind, current) => {
    if (L.hash && lockCheck(current) !== true) return { ok: false, error: 'Your current PIN / password is wrong.' };
    const s = String(secret || '');
    if (kind === 'pin' ? !/^\d{4,12}$/.test(s) : s.length < 6) return { ok: false, error: kind === 'pin' ? 'Use 4 to 12 numbers.' : 'Use at least 6 characters.' };
    const salt = crypto.randomBytes(16).toString('base64');
    L = { ...L, hash: lockHash(s, salt), salt, kind: kind === 'pin' ? 'pin' : 'password' };
    saveL(); lockLocked = false; return { ok: true, lock: lockStatus() };
  });
  ipcMain.handle('lock:options', (_e, current, opts = {}) => {
    if (!L.hash) return { ok: false };
    if ('idle' in opts) L.idle = Math.max(0, Math.min(240, +opts.idle || 0));
    if ('onSleep' in opts) L.onSleep = !!opts.onSleep;
    if ('reveal' in opts) { if (!opts.reveal && lockCheck(current) !== true) return { ok: false, error: 'Wrong PIN / password.' }; L.reveal = !!opts.reveal; }
    saveL(); return { ok: true, lock: lockStatus() };
  });
  ipcMain.handle('lock:remove', (_e, current) => {
    const r = lockCheck(current);
    if (r !== true) return { ok: false, error: r && r.wait ? `Too many tries — wait ${r.wait} s.` : 'Wrong PIN / password.' };
    L = {}; saveL(); lockLocked = false; send('lock:state', lockStatus()); return { ok: true };
  });
  ipcMain.handle('lock:unlock', (_e, secret) => {
    const r = lockCheck(secret);
    if (r !== true) return { ok: false, wait: r && r.wait };
    lockLocked = false; revealUntil = Date.now() + 60000; send('lock:state', lockStatus()); return { ok: true };
  });
  ipcMain.handle('lock:verify', (_e, secret) => { const r = lockCheck(secret); if (r === true) { revealUntil = Date.now() + 60000; return { ok: true }; } return { ok: false, wait: r && r.wait }; });
  ipcMain.on('lock:now', () => lockNow());
  // auto-lock: after N idle minutes, and when Windows locks / the PC sleeps
  setInterval(() => { try { if (L.hash && L.idle && !lockLocked && powerMonitor.getSystemIdleTime() >= L.idle * 60) lockNow(); } catch {} }, 20000);
  try { powerMonitor.on('lock-screen', () => { if (L.onSleep !== false) lockNow(); }); powerMonitor.on('suspend', () => { if (L.onSleep !== false) lockNow(); }); } catch {}

  return {
    status,
    // used by the password IPC: nothing while locked; showing/copying needs a fresh PIN when that's on
    pwAllowed: (purpose) => {
      if (!L.hash) return true;
      if (lockLocked) return false;
      if (purpose === 'reveal' && L.reveal !== false && Date.now() > revealUntil) return 'pin';
      return true;
    },
  };
};
