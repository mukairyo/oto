'use strict';
// Oto — Oto Shield (moved out of main.js): ad & tracker blocking with uBlock Origin's filter lists, protection
// levels, Oto's extra list, the privacy dashboard stats, dangerous-site warnings and the fingerprint seed.
const { ipcMain, net, webContents } = require('electron');
const fs = require('fs');

const { normHost, hostAndParents, parseHostList } = require('./hostnorm.js');
module.exports = function createShield(ctx) {
  const { readJSON, writeJSON, userFile, sendVia } = ctx;

  let blocker = null;
  const fallbackSessions = new WeakSet(); // sessions using the small built-in list (each session has its own)
  let blockingMode = 'off';
  const pendingBlocked = new Map();
  let blockedFlush = null;

  // ---- Privacy dashboard: what was blocked, per day and per website (stays on this PC)
  const { trackerOf, recorderOf, extraFilters, extraScriptBlocked } = require('../trackers.js');
  const PSTATS = Object.assign({ v: 1, days: {}, sites: {}, total: 0, since: Date.now() }, readJSON('privacy-stats.json', {}) || {});
  let pstatsTimer = null;
  const dayKey = (t = new Date()) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const regDomain = (h) => { const p = String(h || '').split('.'); return p.length > 2 && /^(co|com|org|net|ac|gov|edu)$/.test(p[p.length - 2]) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  function pstatsSave(now) {
    clearTimeout(pstatsTimer); pstatsTimer = null;
    const old = dayKey(new Date(Date.now() - 400 * 864e5));
    for (const k of Object.keys(PSTATS.days)) if (k < old) delete PSTATS.days[k];
    const sites = Object.entries(PSTATS.sites);
    if (sites.length > 500) { sites.sort((a, b) => b[1].last - a[1].last); PSTATS.sites = Object.fromEntries(sites.slice(0, 500)); }
    for (const s of Object.values(PSTATS.sites)) { const by = Object.entries(s.by || {}); if (by.length > 40) { s.by = Object.fromEntries(by.sort((a, b) => b[1] - a[1]).slice(0, 40)); if (s.co) for (const k of Object.keys(s.co)) if (!(k in s.by)) delete s.co[k]; } }
    try { writeJSON('privacy-stats.json', PSTATS); } catch {}
  }
  function recordBlocked(wcId, url, domain) {
    let host = '';
    try { host = new URL(url).hostname; } catch {}
    // a = ads, t = trackers, r = how many of those trackers were session recorders (they record what you do on a page)
    const rec = recorderOf(url);
    const co = rec || trackerOf(host);
    const d = PSTATS.days[dayKey()] || (PSTATS.days[dayKey()] = { a: 0, t: 0 });
    if (co) d.t++; else d.a++;
    if (rec) d.r = (d.r || 0) + 1;
    PSTATS.total++;
    const site = pageHostOf(wcId);
    if (site) {
      const s = PSTATS.sites[site] || (PSTATS.sites[site] = { a: 0, t: 0, last: 0, by: {} });
      if (co) s.t++; else s.a++;
      if (rec) s.r = (s.r || 0) + 1;
      s.last = Date.now();
      const k = domain || regDomain(host);
      if (k) { s.by[k] = (s.by[k] || 0) + 1; if (co) (s.co || (s.co = {}))[k] = co; }
    }
    if (!pstatsTimer) pstatsTimer = setTimeout(pstatsSave, 5000);
  }
  function pstatsView() {
    const sites = Object.entries(PSTATS.sites).map(([host, s]) => {
      const by = Object.entries(s.by || {}).sort((a, b) => b[1] - a[1]);
      return { host, a: s.a, t: s.t, r: s.r || 0, last: s.last, by: by.slice(0, 14).map(([d, n]) => ({ d, n, co: (s.co && s.co[d]) || trackerOf(d) })) };
    }).sort((a, b) => (b.t * 4 + b.a) - (a.t * 4 + a.a));
    const cos = new Map();
    for (const s of sites) for (const b of s.by) if (b.co) { const c = cos.get(b.co) || { name: b.co, n: 0, sites: new Set() }; c.n += b.n; c.sites.add(s.host); cos.set(b.co, c); }
    return {
      days: PSTATS.days, total: PSTATS.total, since: PSTATS.since, sites: sites.slice(0, 200),
      companies: [...cos.values()].map((c) => ({ name: c.name, n: c.n, sites: c.sites.size, top: [...c.sites].slice(0, 4) })).sort((a, b) => b.sites - a.sites || b.n - a.n).slice(0, 40),
    };
  }

  function notifyBlocked(wcId, url, domain) {
    if (!wcId) return;
    try { if (url) recordBlocked(wcId, url, domain); } catch {}
    pendingBlocked.set(wcId, (pendingBlocked.get(wcId) || 0) + 1);
    if (blockedFlush) return;
    blockedFlush = setTimeout(() => {
      blockedFlush = null;
      for (const [id, n] of pendingBlocked) { let wc = null; try { wc = webContents.fromId(id); } catch {} sendVia(wc, 'blocked', id, n); }
      pendingBlocked.clear();
    }, 250);
  }

  function enableFallback(ses) {
    const list = new Set(require('../blocklist.js'));
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => {
      if (dangerCheck(d)) return cb({ cancel: true });
      if (d.resourceType === 'mainFrame') return cb({});
      let h;
      try { h = new URL(d.url).hostname.toLowerCase().replace(/\.+$/, ''); } catch { return cb({}); }
      const pageHost = pageHostOf(d.webContentsId);
      if (shieldAllowed(pageHost)) return cb({});
      if (extraScriptBlocked(d.url, pageHost, d.resourceType)) { notifyBlocked(d.webContentsId, d.url); return cb({ cancel: true }); }
      while (h) {
        if (list.has(h)) { notifyBlocked(d.webContentsId, d.url); return cb({ cancel: true }); }
        const i = h.indexOf('.');
        if (i < 0) break;
        h = h.slice(i + 1);
      }
      cb({});
    });
    fallbackSessions.add(ses);
  }

  // ---------------------------------------------------------------- Oto Shield (uBlock-style controls)
  // The engine uses uBlock Origin's own filter lists. On top: a per-site off switch, your own filters
  // (uBlock syntax, incl. "example.com##.banner" from the element picker), and optional annoyance lists
  // (cookie banners, newsletter popups…).
  const SHIELD = {
    allow: new Set(readJSON('shield-allow.json', [])),
    conf: readJSON('shield.json', {}) || {},
    custom: (() => { try { return fs.readFileSync(userFile('shield-filters.txt'), 'utf8'); } catch { return ''; } })(),
    applied: [],
  };
  // Protection level: Basic = ads, Balanced = ads + trackers, Strict = everything incl. annoyances & cookie banners.
  const SHIELD_LEVELS = { basic: ['fromPrebuiltAdsOnly', 'adblock-engine-ads.bin'], balanced: ['fromPrebuiltAdsAndTracking', 'adblock-engine.bin'], strict: ['fromPrebuiltFull', 'adblock-engine-full.bin'] };
  const shieldLevel = () => (SHIELD_LEVELS[SHIELD.conf.level] ? SHIELD.conf.level : SHIELD.conf.annoy ? 'strict' : 'balanced');
  const shieldListsAt = () => { try { return fs.statSync(userFile(SHIELD_LEVELS[shieldLevel()][1])).mtimeMs; } catch { return 0; } };
  const FP_SESSION = require('crypto').randomBytes(16).toString('hex');
  const shieldHost = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/\.+$/, '').replace(/^www\./, ''); } catch { return ''; } };
  const shieldAllowed = (host) => { if (!host) return false; let h = host; while (h) { if (SHIELD.allow.has(h)) return true; const i = h.indexOf('.'); if (i < 0) break; h = h.slice(i + 1); } return false; };
  const pageHostOf = (wcId) => { try { const wc = webContents.fromId(wcId); return wc ? shieldHost(wc.getURL()) : ''; } catch { return ''; } };
  const shieldLines = () => SHIELD.custom.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('!') && !l.startsWith('#'));
  function shieldApplyCustom() {
    if (!blocker) return 0;
    const lines = [...new Set([...extraFilters(shieldLevel()), ...shieldLines()])];
    const added = lines.filter((l) => !SHIELD.applied.includes(l));
    const removed = SHIELD.applied.filter((l) => !lines.includes(l));
    try { if (added.length || removed.length) blocker.updateFromDiff({ added, removed }); } catch (e) { console.warn('[oto] custom filters:', e && e.message); }
    SHIELD.applied = lines;
    return shieldLines().length;
  }
  const { withSource } = require('./request-source.js');
  const pageUrlOf = (wcId) => { try { const wc = wcId && webContents.fromId(wcId); return wc ? wc.getURL() : ''; } catch { return ''; } };
  function shieldPatch(b) {
    const ob = b.onBeforeRequest, oh = b.onHeadersReceived, oc = b.onInjectCosmeticFilters;
    // withSource: the engine learns which page asks from the real frame when the page sends no Referer (request-source.js)
    b.onBeforeRequest = (d, cb) => (dangerCheck(d) ? cb({ cancel: true }) : shieldAllowed(pageHostOf(d.webContentsId)) ? cb({}) : ob(withSource(d, () => pageUrlOf(d.webContentsId)), cb));
    b.onHeadersReceived = (d, cb) => (shieldAllowed(pageHostOf(d.webContentsId)) ? cb({}) : oh(withSource(d, () => pageUrlOf(d.webContentsId)), cb));
    b.onInjectCosmeticFilters = async (ev, url, msg) => {
      if (shieldAllowed(shieldHost(ev.sender && ev.sender.getURL ? ev.sender.getURL() : url))) return;
      return oc(ev, url, msg);
    };
  }
  // ---- Dangerous sites (like Chrome's Safe Browsing): known malware and phishing hosts from URLhaus (abuse.ch)
  // and the phishing filter by malware-filter. Updated twice a day; the check happens on this PC, nothing is sent anywhere.
  const DANGER = { malware: new Set(), phishing: new Set(), allow: new Set(), at: 0 };
  const DANGER_LISTS = {
    malware: ['https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-domains.txt', 'https://curbengh.github.io/malware-filter/urlhaus-filter-domains.txt', 'https://malware-filter.pages.dev/urlhaus-filter-domains.txt'],
    phishing: ['https://malware-filter.gitlab.io/malware-filter/phishing-filter-domains.txt', 'https://curbengh.github.io/malware-filter/phishing-filter-domains.txt', 'https://malware-filter.pages.dev/phishing-filter-domains.txt'],
  };
  (() => { const d = readJSON('danger-lists.json', null); if (d) { const clean = (a) => new Set((Array.isArray(a) ? a : []).map(normHost).filter(Boolean)); DANGER.malware = clean(d.malware); DANGER.phishing = clean(d.phishing); DANGER.at = d.at || 0; } })();
  async function dangerUpdate(force) {
    if (!force && Date.now() - DANGER.at < 12 * 3600e3) return false;
    const out = {};
    for (const [kind, urls] of Object.entries(DANGER_LISTS)) {
      for (const u of urls) {
        try {
          const r = await net.fetch(u, { cache: 'no-store' });
          if (!r.ok || Number(r.headers.get('content-length') || 0) > 64 * 1024 * 1024) continue;
          const list = parseHostList(await r.text()); // clean hosts only; null if it doesn't look like a real list
          // A list that suddenly shrank to a fraction of the one Oto has is treated as broken or tampered: keep the old one.
          const prev = DANGER[kind] ? DANGER[kind].size : 0;
          if (list && !(prev > 1000 && list.length < prev * 0.25)) { out[kind] = list; break; }
        } catch {}
      }
    }
    if (!out.malware && !out.phishing) return false;
    if (out.malware) DANGER.malware = new Set(out.malware);
    if (out.phishing) DANGER.phishing = new Set(out.phishing);
    DANGER.at = Date.now();
    try { writeJSON('danger-lists.json', { at: DANGER.at, malware: [...DANGER.malware], phishing: [...DANGER.phishing] }); } catch (e) { console.warn('[oto] could not cache dangerous-site lists:', e && e.code); } // a cache: Oto re-downloads it
    return true;
  }
  function dangerOf(host) {
    // One normal form for every way of writing the same host (main/hostnorm.js): case, trailing dots, international
    // names, other IPv4 spellings, IPv6. Then the host and each parent domain are checked (IPs only exactly).
    const all = hostAndParents(host);
    if (!all.length || DANGER.allow.has(all[0])) return '';
    for (const h of all) { if (DANGER.phishing.has(h)) return 'phishing'; if (DANGER.malware.has(h)) return 'malware'; }
    return '';
  }
  // true = cancel this request. A page that is itself dangerous gets Oto's warning page instead.
  function dangerCheck(d) {
    if (SHIELD.conf.danger === false || (!DANGER.malware.size && !DANGER.phishing.size)) return false;
    let host = '';
    try { const u = new URL(d.url); if (!/^(https?|wss?):$/.test(u.protocol)) return false; host = u.hostname; } catch { return false; }
    const kind = dangerOf(host);
    if (!kind) return false;
    if (d.resourceType === 'mainFrame') { let wc = null; try { wc = webContents.fromId(d.webContentsId); } catch {} sendVia(wc, 'danger', { wcId: d.webContentsId, url: d.url, host, kind }); }
    return true;
  }
  const dangerOnly = (d, cb) => cb(dangerCheck(d) ? { cancel: true } : {});

  const blockerSessions = new Set();
  let blockerP = null;
  async function enableBlocking(ses) {
    blockerSessions.add(ses);
    // While the full engine starts (it may download its lists first), the session isn't left without a request hook:
    // the built-in list and the dangerous-site check run until the engine takes over (1.4.0 fix).
    if (!blocker && !fallbackSessions.has(ses)) enableFallback(ses);
    if (!blocker && blockerP) { try { await blockerP; } catch {} }
    if (blocker) { if (fallbackSessions.has(ses)) { ses.webRequest.onBeforeRequest(null); fallbackSessions.delete(ses); } if (!blocker.isBlockingEnabled(ses)) blocker.enableBlockingInSession(ses); return (blockingMode = 'full'); }
    try {
      blockerP = (async () => {
        const { ElectronBlocker } = require('@ghostery/adblocker-electron');
        const [maker, file] = SHIELD_LEVELS[shieldLevel()];
        const cache = userFile(file);
        try { if (Date.now() - fs.statSync(cache).mtimeMs > 7 * 864e5) fs.unlinkSync(cache); } catch {}
        const fetchFn = (url, opts) => net.fetch(url, opts);
        const opts = { path: cache, read: fs.promises.readFile, write: fs.promises.writeFile };
        const b = await ElectronBlocker[maker](fetchFn, opts);
        b.on('request-blocked', (req) => notifyBlocked(req.tabId, req.url, req.domain));
        b.on('request-redirected', (req) => notifyBlocked(req.tabId, req.url, req.domain)); // trackers swapped for harmless stubs
        shieldPatch(b);
        return b;
      })();
      blocker = await blockerP;
      SHIELD.applied = [];
      shieldApplyCustom();
      for (const x of blockerSessions) if (fallbackSessions.has(x)) { x.webRequest.onBeforeRequest(null); fallbackSessions.delete(x); }
      for (const x of blockerSessions) { try { if (!blocker.isBlockingEnabled(x)) blocker.enableBlockingInSession(x); } catch {} }
      return (blockingMode = 'full');
    } catch (err) {
      console.warn('[oto] full blocker unavailable, using built-in list:', err && err.message);
      if (!fallbackSessions.has(ses)) enableFallback(ses);
      return (blockingMode = 'basic');
    } finally { blockerP = null; }
  }
  // Switch lists (annoyances on/off): rebuild the engine and put it back in every session.
  async function shieldRebuild() {
    const sess = [...blockerSessions].filter((x) => blocker && blocker.isBlockingEnabled(x));
    for (const x of sess) { try { blocker.disableBlockingInSession(x); } catch {} }
    blocker = null;
    for (const x of sess) await enableBlocking(x);
  }

  function disableBlocking(ses) {
    if (blocker && blocker.isBlockingEnabled(ses)) blocker.disableBlockingInSession(ses);
    blockerSessions.delete(ses);
    if (fallbackSessions.has(ses)) { ses.webRequest.onBeforeRequest(null); fallbackSessions.delete(ses); }
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, dangerOnly); // dangerous-site warnings stay on with blocking off
    blockingMode = 'off';
    return blockingMode;
  }

  // Oto Shield menu and page (settings, levels, lists, stats)
  function setupShieldIPC() {
    ipcMain.handle('shield:state', (_e, url) => {
      const host = shieldHost(url);
      return { host, allowed: shieldAllowed(host), fp: SHIELD.conf.fp !== false, danger: SHIELD.conf.danger !== false, dangerAt: DANGER.at, dangerCount: DANGER.malware.size + DANGER.phishing.size, annoy: shieldLevel() === 'strict', level: shieldLevel(), listsAt: shieldListsAt(), mode: blockingMode, filters: shieldLines().length, allow: [...SHIELD.allow].sort() };
    });
    ipcMain.handle('shield:site', (_e, url, allow) => {
      const host = shieldHost(url);
      if (!host) return false;
      if (allow) SHIELD.allow.add(host);
      else { let h = host; while (h) { SHIELD.allow.delete(h); const i = h.indexOf('.'); if (i < 0) break; h = h.slice(i + 1); } }
      (ctx.saveOrWarn || writeJSON)('shield-allow.json', [...SHIELD.allow], 'Oto Shield site exceptions');
      return shieldAllowed(host);
    });
    // Your own filter rules (and elements you hid with the picker): saved all-or-nothing; a failure is reported.
    const saveFilters = () => (ctx.saveTextOrWarn ? ctx.saveTextOrWarn('shield-filters.txt', SHIELD.custom, 'your Oto Shield filter rules') : (() => { try { fs.writeFileSync(userFile('shield-filters.txt'), SHIELD.custom); return true; } catch { return false; } })());
    ipcMain.handle('shield:filters', (_e, text) => {
      let saved = true;
      if (typeof text === 'string') {
        SHIELD.custom = text.slice(0, 200000);
        saved = saveFilters();
        shieldApplyCustom();
      }
      return { text: SHIELD.custom, count: shieldLines().length, allow: [...SHIELD.allow], saved };
    });
    ipcMain.handle('shield:pick', (_e, url, selector) => {
      const host = shieldHost(url);
      const sel = String(selector || '').replace(/[\r\n]/g, '').slice(0, 500);
      if (!host || !sel) return false;
      const line = `${host}##${sel}`;
      if (!shieldLines().includes(line)) { SHIELD.custom = `${SHIELD.custom.replace(/\s*$/, '')}\n${line}\n`.replace(/^\n/, ''); saveFilters(); shieldApplyCustom(); }
      return true;
    });
    const setLevel = async (lvl) => {
      if (!SHIELD_LEVELS[lvl]) lvl = 'balanced';
      const changed = lvl !== shieldLevel();
      SHIELD.conf.level = lvl; SHIELD.conf.annoy = lvl === 'strict';
      (ctx.saveOrWarn || writeJSON)('shield.json', SHIELD.conf, 'Oto Shield settings');
      if (changed && blocker) await shieldRebuild();
      return { annoy: lvl === 'strict', level: shieldLevel(), mode: blockingMode, listsAt: shieldListsAt() };
    };
    ipcMain.handle('shield:annoy', (_e, on) => setLevel(on ? 'strict' : 'balanced'));
    ipcMain.handle('shield:level', (_e, lvl) => setLevel(String(lvl || '')));
    // Download fresh filter lists now (they also refresh by themselves every 7 days). Keeps the old ones if offline.
    ipcMain.handle('shield:update', async () => {
      if (!blocker) return { ok: false, off: true, listsAt: shieldListsAt(), mode: blockingMode };
      const f = userFile(SHIELD_LEVELS[shieldLevel()][1]), bak = `${f}.old`;
      try { fs.renameSync(f, bak); } catch {}
      await shieldRebuild();
      const ok = blockingMode === 'full' && fs.existsSync(f);
      if (ok) { try { fs.unlinkSync(bak); } catch {} } else { try { fs.renameSync(bak, f); } catch {} await shieldRebuild(); }
      return { ok, listsAt: shieldListsAt(), mode: blockingMode };
    });
    ipcMain.handle('shield:danger', (_e, on) => { SHIELD.conf.danger = !!on; (ctx.saveOrWarn || writeJSON)('shield.json', SHIELD.conf, 'Oto Shield settings'); return SHIELD.conf.danger; });
    ipcMain.handle('shield:dangerAllow', (_e, host) => { const h = normHost(host); if (h) DANGER.allow.add(h); return true; }); // until Oto restarts
    ipcMain.handle('shield:dangerUpdate', async () => { const ok = await dangerUpdate(true); return { ok, dangerAt: DANGER.at, dangerCount: DANGER.malware.size + DANGER.phishing.size }; });
    ipcMain.handle('shield:fp', (_e, on) => { SHIELD.conf.fp = !!on; (ctx.saveOrWarn || writeJSON)('shield.json', SHIELD.conf, 'Oto Shield settings'); return SHIELD.conf.fp; });
    ipcMain.handle('shield:stats', () => pstatsView());
    ipcMain.handle('shield:statsReset', () => { PSTATS.days = {}; PSTATS.sites = {}; PSTATS.total = 0; PSTATS.since = Date.now(); pstatsSave(); return pstatsView(); });
  }

  return {
    enableBlocking, disableBlocking, shieldHost, shieldAllowed, shieldLevel, shieldListsAt, regDomain, dangerUpdate, setupShieldIPC,
    dangerOf: (host) => (SHIELD.conf.danger === false ? '' : dangerOf(host)),
    SHIELD, DANGER, FP_SESSION,
    mode: () => blockingMode,
    flushStats() { if (pstatsTimer) pstatsSave(); },
  };
};
