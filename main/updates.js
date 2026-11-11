'use strict';
// Oto — updates from GitHub Releases, update channels and the owner key (moved out of main.js).
const { app, ipcMain, net, safeStorage } = require('electron');
const fs = require('fs');

module.exports = function createUpdates(ctx) {
  const { readJSON, writeJSON, userFile, send, OTO_VERSION, displayVersion } = ctx;

  // New versions are published as releases on github.com/mukairyo/oto. Oto checks a few seconds after
  // launch, every 2 minutes on the Owner/test channels (30 on Stable) and when you come back to the window;
  // downloads in the background and installs when you restart.
  let updater = null;
  let updateState = { state: 'idle' };
  function setUpdate(st) {
    updateState = { ...st, at: Date.now() };
    send('update', updateState);
  }
  function setupUpdates() {
    ipcMain.handle('update:status', () => ({ ...updateState, packaged: app.isPackaged, version: OTO_VERSION, channel: updateChannel(), owner: ownerOn }));
    ipcMain.handle('owner:unlock', (_e, key) => ownerUnlock(key));
    // Locking must really remove the saved key: if the file can't be deleted, it's overwritten; if neither works,
    // the UI is told (owner mode is off for this session either way).
    ipcMain.handle('owner:lock', () => {
      ownerOn = false; ownerKey = null;
      const f = userFile('owner.json');
      try { fs.unlinkSync(f); return true; } catch (e) {
        if (e && e.code === 'ENOENT') return true;
        try { writeJSON('owner.json', {}); return true; } catch { return false; }
      }
    });
    // The UI asks the main process every time — a page or the UI itself can't just say "I'm the owner".
    ipcMain.handle('owner:status', () => ({ owner: ownerOn }));
    ipcMain.handle('owner:proof', (_e, msg) => ownerSign(`oto-founder|${String(msg || '').slice(0, 64)}`));
    ipcMain.handle('update:check', () => checkForUpdates(true));
    ipcMain.on('update:install', () => {
      if (!updater || updateState.state !== 'ready') return;
      setImmediate(() => updater.quitAndInstall(true, true));
    });
    if (!app.isPackaged) { updateState = { state: 'dev' }; return; }
    // Before an update may install, its GitHub build record is checked here (main/attest.js): signed by Sigstore for
    // Oto's own release workflow, about exactly this file, and in Sigstore's public log. If GitHub can't be reached
    // it waits and tries again; if the check fails, the download is deleted and nothing is installed.
    const { verifyInstaller } = require('./attest.js');
    const fetchJson = async (url) => {
      const r = await net.fetch(url, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': `Oto/${OTO_VERSION}` }, redirect: 'error' });
      if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
      return r.json();
    };
    let verifyTimer = null;
    const refused = new Set(); // versions whose file failed the check: never downloaded again this session
    async function verifyDownloaded(i) {
      clearTimeout(verifyTimer);
      const version = displayVersion(i.version), file = i.downloadedFile;
      setUpdate({ state: 'verifying', version });
      try {
        await verifyInstaller(file, fetchJson);
        updater.autoInstallOnAppQuit = true;
        setUpdate({ state: 'ready', version, verified: true });
      } catch (err) {
        updater.autoInstallOnAppQuit = false;
        if (err && err.transient) {
          setUpdate({ state: 'error', version, message: `Update ${version} is downloaded but not checked yet (${err.message}). Oto tries again in 10 minutes.` });
          verifyTimer = setTimeout(() => verifyDownloaded(i), 10 * 60 * 1000);
        } else {
          refused.add(i.version);
          try { fs.unlinkSync(file); } catch {}
          setUpdate({ state: 'error', version, message: `Update ${version} failed Oto’s security check and was not installed (${err && err.message}).` });
        }
      }
    }
    try { updater = require('electron-updater').autoUpdater; } catch (err) { updateState = { state: 'error', message: err.message }; return; }
    updater.autoDownload = false; // downloaded below, unless this exact version already failed the security check
    // Nothing installs (not even when you quit) until the downloaded file passes the build-record check below.
    updater.autoInstallOnAppQuit = false;
    updater.logger = null;
    configureChannel(updateChannel());
    updater.on('checking-for-update', () => setUpdate({ state: 'checking' }));
    updater.on('update-available', (i) => {
      if (refused.has(i.version)) { setUpdate({ state: 'error', version: displayVersion(i.version), message: `Update ${displayVersion(i.version)} failed Oto’s security check and was not installed. Oto waits for a newer one.` }); return; }
      setUpdate({ state: 'downloading', version: displayVersion(i.version), percent: 0 });
      updater.downloadUpdate().catch(() => {});
    });
    updater.on('update-not-available', () => setUpdate({ state: 'latest' }));
    updater.on('download-progress', (p) => setUpdate({ state: 'downloading', version: updateState.version, percent: Math.round(p.percent || 0) }));
    updater.on('update-downloaded', (i) => verifyDownloaded(i));
    updater.on('error', (err) => {
      const m = String((err && err.message) || err);
      // No releases yet / repo not created yet: not worth bothering anyone about.
      const quiet = /404|Unable to find latest version|No published versions|HttpError: 4/i.test(m);
      setUpdate({ state: quiet ? 'none-published' : 'error', message: m.split('\n')[0].slice(0, 200) });
    });
    setTimeout(() => checkForUpdates(false), 8000);
    // Look again regularly while Oto stays open (every 15 min on the Owner/test channels, hourly on Stable)
    // and when you come back to the window — before, it only looked every 6 hours, so new versions
    // waited until you checked in Settings.
    // Quick look: GitHub's release feed is tiny, so on the Owner/test channels Oto peeks at it every 30 seconds
    // and starts the real update the moment a newer build for its channel is listed (Stable: every 10 minutes).
    const peekEvery = () => (updateChannel() === 'stable' ? 600 : 30) * 1000;
    let lastPeek = 0, peeking = false;
    const peek = async () => {
      if (peeking || ctx.prefs.autoUpdate === false || ['checking', 'downloading', 'verifying', 'ready'].includes(updateState.state)) return;
      peeking = true; lastPeek = Date.now();
      try {
        const res = await net.fetch(`https://github.com/mukairyo/oto/releases.atom?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache', Accept: 'application/atom+xml' } });
        if (res.ok) {
          const xml = await res.text(), ch = updateChannel();
          const tags = [...xml.matchAll(/\/releases\/tag\/v?([0-9][^"<\s]*)/g)].map((m) => decodeURIComponent(m[1]));
          const mine = (t) => (ch === 'stable' ? !t.includes('-') : t.includes(`-${ch}.`) || !t.includes('-'));
          // tags are the names people see (1.4.2, 1.4.2.1); the running version is the updater's number (1.4.200, 1.4.201)
          const newest = tags.filter(mine).map(require('./version.js').fromTag).sort((a, b) => verCmpMain(b, a))[0];
          if (newest && verCmpMain(newest, app.getVersion()) > 0) checkForUpdates(false);
        }
      } catch {} finally { peeking = false; }
    };
    setInterval(() => { if (Date.now() - lastPeek >= peekEvery() - 500) peek(); }, 10 * 1000);
    // Owner/test channels: every 2 minutes (and whenever you come back to the window after a minute away),
    // so a new build shows up by itself within a couple of minutes. Stable: every 30 minutes.
    const every = () => (updateChannel() === 'stable' ? 30 : 2) * 60 * 1000;
    const due = () => Date.now() - lastUpdateCheck > every();
    setInterval(() => {
      // a check that never answered (network hiccup) must not block the next ones until a restart
      if (updateState.state === 'checking' && Date.now() - (updateState.at || 0) > 90 * 1000) setUpdate({ state: 'idle' });
      if (due()) checkForUpdates(false);
    }, 60 * 1000);
    app.on('browser-window-focus', () => { peek(); if (Date.now() - lastUpdateCheck > (updateChannel() === 'stable' ? 10 * 60 : 60) * 1000) checkForUpdates(false); });
  }
  // Update channels: Stable (everyone), Beta (testers get new versions early), Alpha (newest
  // experiments). Testers also still get every stable update — if their channel has nothing newer,
  // Oto checks the stable channel too. Oto never goes back to an older version on its own.
  const UPDATE_CHANNELS = ['stable', 'beta', 'alpha'];
  // Owner channel: Ryo's own test builds (1.0.0-owner.N). Hidden until the private owner key is entered
  // (Settings → About → tap "Oto version" 7 times). Only a hash of the key is in the code.
  // Security: the main process is the only judge. Being the owner needs the real key — the PC keeps it
  // encrypted with Windows (safeStorage/DPAPI, tied to this Windows account) and checks it against the hash
  // at every launch, so copying a hash or editing owner.json / the UI / browser storage unlocks nothing.
  // The Founder card carries an Ed25519 signature that only the key can make (public key below).
  const OWNER_HASH = '5d3daf57d0126aea9114a57a08c97450bdcb786f6e40f7ef8b69858042d77fb0';
  const FOUNDER_PUB = 'WmJ86hyoGeSlG3YLv6exZFvVpqepEfJk5B6HdY8k2eM';
  const normKey = (key) => String(key || '').trim().toUpperCase();
  const ownerHash = (key) => require('crypto').createHash('sha256').update(`oto-owner|${normKey(key)}`).digest('hex');
  const safeEq = (a, b) => { const A = Buffer.from(String(a)), B = Buffer.from(String(b)); return A.length === B.length && require('crypto').timingSafeEqual(A, B); };
  let ownerOn = false, ownerKey = null;
  const ownerTries = { n: 0, until: 0 };
  function ownerLoad() {
    try {
      const j = readJSON('owner.json', {}) || {};
      if (!j.k || !safeStorage.isEncryptionAvailable()) return;
      const key = safeStorage.decryptString(Buffer.from(j.k, 'base64'));
      if (safeEq(ownerHash(key), OWNER_HASH)) { ownerOn = true; ownerKey = normKey(key); }
    } catch {}
  }
  function ownerUnlock(key) {
    const now = Date.now();
    if (now < ownerTries.until) return { ok: false, wait: Math.ceil((ownerTries.until - now) / 1000) };
    if (!safeEq(ownerHash(key), OWNER_HASH)) {
      ownerTries.n++;
      if (ownerTries.n >= 5) ownerTries.until = now + Math.min(3600e3, 60e3 * 2 ** (ownerTries.n - 5));
      return false;
    }
    ownerTries.n = 0; ownerOn = true; ownerKey = normKey(key);
    try { if (safeStorage.isEncryptionAvailable()) writeJSON('owner.json', { k: safeStorage.encryptString(ownerKey).toString('base64') }); } catch {}
    return true;
  }
  function ownerSign(msg) {
    if (!ownerOn || !ownerKey) return null;
    try {
      const c = require('crypto');
      const seed = c.createHash('sha256').update(`oto-founder-seed|${ownerKey}`).digest();
      const priv = c.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
      return { msg, sig: c.sign(null, Buffer.from(msg), priv).toString('base64url'), pub: FOUNDER_PUB };
    } catch { return null; }
  }
  const updateChannel = () => {
    if (ctx.prefs.updateChannel === 'owner') return ownerOn ? 'owner' : 'stable';
    return UPDATE_CHANNELS.includes(ctx.prefs.updateChannel) ? ctx.prefs.updateChannel : 'stable';
  };
  function configureChannel(ch) {
    updater.channel = ch === 'stable' ? 'latest' : ch;
    updater.allowPrerelease = ch !== 'stable';
    updater.allowDowngrade = false;
  }
  let lastUpdateCheck = 0;
  // semver order without a library: 1.0.0-owner.35 > 1.0.0-owner.9 > 0.9.10; a release (no "-") beats its pre-releases
  function verCmpMain(a, b) {
    const [am, ap] = String(a).split('-', 2).length > 1 ? [String(a).slice(0, String(a).indexOf('-')), String(a).slice(String(a).indexOf('-') + 1)] : [String(a), ''];
    const [bm, bp] = String(b).split('-', 2).length > 1 ? [String(b).slice(0, String(b).indexOf('-')), String(b).slice(String(b).indexOf('-') + 1)] : [String(b), ''];
    const an = am.split('.').map(Number), bn = bm.split('.').map(Number);
    for (let i = 0; i < 3; i++) { const d = (an[i] || 0) - (bn[i] || 0); if (d) return d > 0 ? 1 : -1; }
    if (!ap && !bp) return 0; if (!ap) return 1; if (!bp) return -1;
    const ai = ap.split('.'), bi = bp.split('.');
    for (let i = 0; i < Math.max(ai.length, bi.length); i++) {
      if (ai[i] === undefined) return -1; if (bi[i] === undefined) return 1;
      const x = /^\d+$/.test(ai[i]), y = /^\d+$/.test(bi[i]);
      if (x && y) { const d = Number(ai[i]) - Number(bi[i]); if (d) return d > 0 ? 1 : -1; }
      else if (x !== y) return x ? -1 : 1;
      else if (ai[i] !== bi[i]) return ai[i] > bi[i] ? 1 : -1;
    }
    return 0;
  }
  async function checkForUpdates(manual) {
    if (!updater) return updateState;
    if (!manual && ctx.prefs.autoUpdate === false) return updateState;
    if (['checking', 'downloading', 'verifying', 'ready'].includes(updateState.state)) return updateState;
    lastUpdateCheck = Date.now();
    const ch = updateChannel();
    let found = false;
    const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60 * 1000))]);
    try { configureChannel(ch); const r = await withTimeout(updater.checkForUpdates()); found = !!(r && r.isUpdateAvailable); } catch {}
    if (!found && ch !== 'stable') { try { configureChannel('stable'); await withTimeout(updater.checkForUpdates()); } catch {} }
    if (updateState.state === 'checking') setUpdate({ state: 'idle' });
    return updateState;
  }

  return {
    setupUpdates, ownerLoad, checkForUpdates, updateChannel,
    get ownerOn() { return ownerOn; }, get updateState() { return updateState; }, get updater() { return updater; },
  };
};
