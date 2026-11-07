'use strict';
// Oto — saved logins (moved out of main.js). Each password is encrypted with Windows' own data protection
// (Electron safeStorage = DPAPI, the same thing Chrome uses). Nothing leaves the PC. The UI only ever gets
// usernames; a password goes from here straight into the page's login box (in a hidden world of the page).
const { app, ipcMain, dialog, safeStorage, webContents } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function createPasswords(ctx) {
  const { readJSON, writeJSON } = ctx;
  const PW_FILE = 'passwords.json';

  const pwOk = (purpose) => (ctx.account ? ctx.account.pwAllowed(purpose) : true);
  let PW = null;
  const pwCanEncrypt = () => { try { return safeStorage.isEncryptionAvailable(); } catch { return false; } };
  function pwLoad() {
    if (PW) return PW;
    const d = readJSON(PW_FILE, null);
    PW = d && Array.isArray(d.entries) ? d : { v: 1, entries: [] };
    return PW;
  }
  function pwSave() { try { writeJSON(PW_FILE, PW); } catch {} }
  function pwEnc(plain) {
    if (pwCanEncrypt()) return { enc: safeStorage.encryptString(String(plain)).toString('base64') };
    return { plain: Buffer.from(String(plain), 'utf8').toString('base64') }; // only where the OS offers no encryption
  }
  function pwDec(e) {
    try {
      if (e.enc) return safeStorage.decryptString(Buffer.from(e.enc, 'base64'));
      if (e.plain) return Buffer.from(e.plain, 'base64').toString('utf8');
    } catch {}
    return '';
  }
  const pwOrigin = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x.origin : null; } catch { return null; } };
  const pwSite = (origin) => { try { return new URL(origin).hostname.replace(/^www\./, ''); } catch { return origin; } };
  const pwPublic = (e) => ({ id: e.id, origin: e.origin, site: pwSite(e.origin), username: e.username, created: e.created, updated: e.updated, lastUsed: e.lastUsed || 0 });
  function pwFind(origin, username) { return pwLoad().entries.find((e) => e.origin === origin && e.username === username); }
  function pwUpsert(origin, username, password) {
    const d = pwLoad();
    const now = Date.now();
    const ex = pwFind(origin, username);
    if (ex) {
      if (pwDec(ex) === password) { ex.lastUsed = now; pwSave(); return 'same'; }
      delete ex.enc; delete ex.plain;
      Object.assign(ex, pwEnc(password), { updated: now, lastUsed: now });
      pwSave(); return 'updated';
    }
    d.entries.push({ id: `pw${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`, origin, username, ...pwEnc(password), created: now, updated: now, lastUsed: now });
    pwSave(); return 'saved';
  }
  function csvParse(text) {
    const rows = []; let row = []; let f = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; continue; }
      if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  const csvCell = (v) => (/[",\n\r]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const pwFillCode = (u, p) => `((u, p) => {
    const vis = (x) => x && x.offsetParent !== null && !x.disabled && !x.readOnly;
    const set = (el, v) => { if (!el) return; const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const a = document.activeElement;
    const pass = a && a.type === 'password' ? a : [...document.querySelectorAll('input[type=password]')].find(vis);
    const scope = (pass && pass.form) || (a && a.form) || document;
    const texts = [...scope.querySelectorAll('input')].filter((x) => vis(x) && /^(text|email|tel|)$/i.test(x.getAttribute('type') || ''));
    let user = null;
    if (a && texts.includes(a)) user = a;
    else if (pass) { const all = [...scope.querySelectorAll('input')]; const i = all.indexOf(pass); user = texts.filter((x) => all.indexOf(x) < i).pop() || null; }
    else user = texts.find((x) => /user|mail|login|identifier|account|phone/i.test((x.name || '') + (x.id || '') + (x.autocomplete || ''))) || texts[0] || null;
    if (user && u) set(user, u);
    if (pass) { set(pass, p); pass.focus(); }
    return { user: !!user, pass: !!pass };
  })(${JSON.stringify(u)}, ${JSON.stringify(p)})`;
  function setupPasswordIPC() {
    ipcMain.handle('pw:status', () => ({ encrypted: pwCanEncrypt(), count: pwLoad().entries.length }));
    ipcMain.handle('pw:list', () => pwOk() !== true ? [] : pwLoad().entries.map(pwPublic).sort((a, b) => a.site.localeCompare(b.site) || a.username.localeCompare(b.username)));
    ipcMain.handle('pw:forOrigin', (_e, url) => { if (pwOk() !== true) return []; const o = pwOrigin(url); return o ? pwLoad().entries.filter((e) => e.origin === o).sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0)).map(pwPublic) : []; });
    ipcMain.handle('pw:check', (_e, url, username, password) => {
      const o = pwOrigin(url);
      if (!o || !password) return 'invalid';
      const ex = pwFind(o, String(username || ''));
      if (!ex) return 'new';
      return pwDec(ex) === password ? 'same' : 'update';
    });
    ipcMain.handle('pw:save', (_e, url, username, password) => { const o = pwOrigin(url); return o && password ? pwUpsert(o, String(username || ''), String(password)) : 'invalid'; });
    ipcMain.handle('pw:get', (_e, id, purpose) => { const ok = pwOk(purpose); if (ok === 'pin') return { needPin: true }; if (ok !== true) return null; const e = pwLoad().entries.find((x) => x.id === id); if (!e) return null; e.lastUsed = Date.now(); pwSave(); return { username: e.username, password: pwDec(e), origin: e.origin }; });
    ipcMain.handle('pw:update', (_e, id, patch) => {
      const e = pwLoad().entries.find((x) => x.id === id);
      if (!e || !patch) return false;
      if (typeof patch.username === 'string') e.username = patch.username;
      if (typeof patch.url === 'string' && pwOrigin(patch.url)) e.origin = pwOrigin(patch.url);
      if (typeof patch.password === 'string' && patch.password) { delete e.enc; delete e.plain; Object.assign(e, pwEnc(patch.password)); }
      e.updated = Date.now(); pwSave(); return true;
    });
    // Password helpers run in a hidden world of the page (world 1077): page scripts can't see or fake them.
    const PW_WORLD = 1077;
    const pageWc = (e, wcId) => { if (!e.sender || e.sender.getType() !== 'window') return null; const wc = webContents.fromId(Number(wcId)); return wc && !wc.isDestroyed() && wc.getType() === 'webview' ? wc : null; };
    ipcMain.handle('pw:inject', (e, wcId, code) => { const wc = pageWc(e, wcId); if (!wc || typeof code !== 'string') return false; return wc.executeJavaScriptInIsolatedWorld(PW_WORLD, [{ code }]).then(() => true, () => false); });
    ipcMain.handle('pw:fillInto', async (e, wcId, id) => {
      const wc = pageWc(e, wcId);
      if (!wc) return { ok: false };
      const ok = pwOk(); if (ok === 'pin') return { needPin: true }; if (ok !== true) return { ok: false };
      const cred = pwLoad().entries.find((x) => x.id === id);
      if (!cred || pwOrigin(wc.getURL()) !== cred.origin) return { ok: false }; // never fill a login into a different site
      cred.lastUsed = Date.now(); pwSave();
      const r = await wc.executeJavaScriptInIsolatedWorld(PW_WORLD, [{ code: pwFillCode(cred.username, pwDec(cred)) }]).catch(() => null);
      return { ok: true, user: !!(r && r.user), pass: !!(r && r.pass) };
    });
    ipcMain.handle('pw:delete', (_e, id) => { const d = pwLoad(); const n = d.entries.length; d.entries = d.entries.filter((x) => x.id !== id); pwSave(); return d.entries.length < n; });
    ipcMain.handle('pw:import', async () => {
      const r = await dialog.showOpenDialog(ctx.win, { title: 'Import passwords (CSV from Chrome, Edge, Brave, Opera or Firefox)', filters: [{ name: 'CSV', extensions: ['csv'] }], properties: ['openFile'] });
      if (r.canceled || !r.filePaths[0]) return null;
      const rows = csvParse(fs.readFileSync(r.filePaths[0], 'utf8').replace(/^﻿/, ''));
      if (!rows.length) return { added: 0, updated: 0 };
      const head = rows[0].map((x) => x.trim().toLowerCase());
      const col = (...names) => head.findIndex((h) => names.includes(h));
      const iu = col('url', 'origin', 'login_uri', 'website'), iuser = col('username', 'login_username', 'login', 'user'), ip = col('password', 'login_password');
      if (iu < 0 || ip < 0) return { error: 'This file doesn’t look like a password export (it needs url and password columns).' };
      let added = 0, updated = 0;
      for (const row of rows.slice(1)) {
        const o = pwOrigin(row[iu]); const pass = row[ip];
        if (!o || !pass) continue;
        const res = pwUpsert(o, iuser >= 0 ? row[iuser] || '' : '', pass);
        if (res === 'saved') added++; else if (res === 'updated') updated++;
      }
      return { added, updated };
    });
    ipcMain.handle('pw:export', async () => {
      { const ok = pwOk('reveal'); if (ok === 'pin') return { needPin: true }; if (ok !== true) return false; }
      const r = await dialog.showSaveDialog(ctx.win, { title: 'Export passwords', defaultPath: path.join(app.getPath('documents'), 'Oto Passwords.csv'), filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (r.canceled || !r.filePath) return false;
      const lines = ['name,url,username,password', ...pwLoad().entries.map((e) => [pwSite(e.origin), e.origin, e.username, pwDec(e)].map(csvCell).join(','))];
      fs.writeFileSync(r.filePath, lines.join('\n'));
      return true;
    });
  }

  return { pwOk, pwLoad, pwDec, pwUpsert, setupPasswordIPC };
};
