'use strict';
/* Oto v1 — Alpha 6: Oto Accounts (sign in + encrypted sync). The network, encryption,
   tokens and passwords all live in the main process (account.js); this file is the UI and decides
   which parts of the state are synced. */

const V1A = { st: null, form: 'signin', email: '', msg: '', err: '', busy: false, pushT: 0, peekT: 0, pwForm: false, ask: null };
const V1_SYNC = [['settings', 'Settings & themes', 'All settings, your saved themes and shortcuts'], ['spaces', 'Bookmarks & spaces', 'Bookmarks, spaces, pinned tabs, folders and site notes'],
  ['card', 'Card, level & badges', 'Oto Card, XP, badges, cosmetics and music history'], ['passwords', 'Saved passwords', 'Encrypted on this PC before upload']];
const V1_SYNC_SKIP = ['updateChannel', 'v1Sync', 'autoUpdate'];
const v1SyncOn = () => ({ settings: true, spaces: true, card: true, passwords: true, ...(S.settings.v1Sync || {}) });
const v1Hash = (o) => { const s = JSON.stringify(o) || ''; let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x.toString(36); };
const v1Clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

// ================================================================ what gets synced
function v1SectionData(name) {
  if (name === 'settings') {
    const st = {}; for (const [k, v] of Object.entries(S.settings)) if (!V1_SYNC_SKIP.includes(k)) st[k] = v;
    return { settings: st, themes: S.v1Themes || [] };
  }
  if (name === 'spaces') {
    return { workspaces: S.workspaces, bookmarks: S.bookmarks || [], folders: S.v1Folders || [], notes: S.v1Notes || {},
      pinned: S.tabs.filter((t) => t.pinned || t.essential).map(({ url, title, favicon, ws, pinned, essential, v1f }) => ({ url, title, favicon, ws, pinned, essential, v1f })) };
  }
  if (name === 'card') {
    return { card: S.card || {}, badges: S.v1Badges || {}, xpBonus: S.v1XpBonus || 0, since: S.since || 0, stats: S.stats || {}, music: (S.v1Music || []).slice(0, 30), time: S.v1Time || null };
  }
  return null;
}
function v1Sections() {
  const on = v1SyncOn();
  S.v1SyncMeta = S.v1SyncMeta || {};
  const out = { _pw: !!on.passwords };
  for (const [name] of V1_SYNC) {
    if (name === 'passwords' || !on[name]) continue;
    const data = v1SectionData(name);
    const hsh = v1Hash(data);
    const meta = S.v1SyncMeta[name] || {};
    if (meta.h !== hsh) S.v1SyncMeta[name] = { h: hsh, at: Date.now() };
    out[name] = { at: S.v1SyncMeta[name].at, data };
  }
  return out;
}
function v1Summary() {
  return { spaces: S.workspaces.length, bookmarks: typeof allBookmarks === 'function' ? allBookmarks().length : 0, badges: Object.keys(S.v1Badges || {}).length, level: v1Level().cur.name, card: (S.card || {}).name || '' };
}
// apply a section from the cloud
function v1ApplySection(name, data, { replace = false } = {}) {
  if (!data) return;
  if (name === 'settings') {
    const keep = Object.fromEntries(V1_SYNC_SKIP.map((k) => [k, S.settings[k]]));
    S.settings = { ...S.settings, ...v1Clone(data.settings || {}), ...keep };
    if (Array.isArray(data.themes)) S.v1Themes = v1Clone(data.themes);
    try { applyTheme(); applyCustomization(); syncMainSettings(); } catch {}
  } else if (name === 'spaces') {
    if (Array.isArray(data.workspaces) && data.workspaces.length) {
      S.workspaces = v1Clone(data.workspaces);
      if (!S.workspaces.some((w) => w.id === S.activeWs)) S.activeWs = S.workspaces[0].id;
      for (const t of S.tabs) if (!S.workspaces.some((w) => w.id === t.ws)) t.ws = S.activeWs;
    }
    if (Array.isArray(data.bookmarks)) S.bookmarks = v1Clone(data.bookmarks);
    if (Array.isArray(data.folders)) S.v1Folders = v1Clone(data.folders);
    if (data.notes) S.v1Notes = replace ? v1Clone(data.notes) : { ...(S.v1Notes || {}), ...v1Clone(data.notes) };
    const have = new Set(S.tabs.filter((t) => t.pinned || t.essential).map((t) => t.url));
    for (const p of data.pinned || []) {
      if (!p.url || have.has(p.url)) continue;
      S.tabs.push({ id: uid(), url: p.url, title: p.title || prettyUrl(p.url), favicon: p.favicon || '', ws: S.workspaces.some((w) => w.id === p.ws) ? p.ws : S.activeWs, pinned: !!p.pinned, essential: !!p.essential, v1f: p.v1f, lastActive: 0 });
    }
  } else if (name === 'card') {
    // the card merges: never lose XP, badges or stats from either PC
    if (data.card) S.card = { ...(S.card || {}), ...v1Clone(data.card) };
    S.v1Badges = { ...(data.badges || {}), ...(S.v1Badges || {}) };
    for (const [k, t] of Object.entries(data.badges || {})) if (S.v1Badges[k] > t) S.v1Badges[k] = t;
    S.v1XpBonus = Math.max(S.v1XpBonus || 0, data.xpBonus || 0);
    if (data.since && (!S.since || data.since < S.since)) S.since = data.since;
    S.stats = S.stats || {};
    for (const [k, v] of Object.entries(data.stats || {})) if (typeof v === 'number' && v > (S.stats[k] || 0)) S.stats[k] = v;
    const seen = new Set((S.v1Music || []).map((m) => `${m.title}|${m.artist}`));
    S.v1Music = [...(S.v1Music || []), ...(data.music || []).filter((m) => !seen.has(`${m.title}|${m.artist}`))].sort((a, b) => b.at - a.at).slice(0, 30);
    if (data.time && (!S.v1Time || (data.time.total || 0) > (S.v1Time.total || 0))) S.v1Time = v1Clone(data.time);
  }
}

// ================================================================ sync engine
async function v1Push({ quiet = true } = {}) {
  clearTimeout(V1A.pushT);
  if (AVOCADO_MODE || !V1A.st || !V1A.st.signedIn) return;
  const secs = v1Sections();
  const hsh = v1Hash(secs);
  if (quiet && hsh === V1A.lastHash && Date.now() - (V1A.lastPushAt || 0) < 10 * 60 * 1000) return { ok: true, same: true };
  let r = await oto.account.push(secs, v1Summary());
  // Another device synced in between: bring its changes in first (merged per section and per password), then push.
  for (let i = 0; i < 2 && r && r.code === 'conflict'; i++) { await v1Pull({ quiet: true }); r = await oto.account.push(v1Sections(), v1Summary()); }
  if (r.ok) { V1A.lastHash = v1Hash(v1Sections()); V1A.lastPushAt = Date.now(); }
  _v1SaveNoSync();
  if (!quiet) toast(r.ok ? 'Synced ✓' : `Couldn’t sync — ${r.error}`, { icon: r.ok ? 'check' : 'x', timeout: 2000 });
  return r;
}
async function v1Pull({ all = false, quiet = true } = {}) {
  if (AVOCADO_MODE || !V1A.st || !V1A.st.signedIn) return;
  const r = await oto.account.pull({ passwords: v1SyncOn().passwords });
  if (!r.ok) { if (!quiet) toast(`Couldn’t sync — ${r.error}`, { icon: 'x', timeout: 2400 }); return r; }
  if (r.empty) return r;
  S.v1SyncMeta = S.v1SyncMeta || {};
  const on = v1SyncOn();
  let changed = 0;
  for (const [name, sec] of Object.entries(r.sections || {})) {
    if (!sec || !on[name]) continue;
    const local = S.v1SyncMeta[name] || {};
    const remoteH = v1Hash(sec.data);
    if (remoteH === local.h) continue;
    if (all || name === 'card' || (sec.at || 0) > (local.at || 0)) {
      v1ApplySection(name, sec.data, { replace: all });
      S.v1SyncMeta[name] = { h: v1Hash(v1SectionData(name)), at: Math.max(sec.at || 0, local.at || 0) };
      changed++;
    }
  }
  _v1SaveNoSync();
  if (changed) { try { render(); } catch {} }
  if (!quiet) toast(changed || r.passwords ? `Synced from ${r.device || 'the cloud'} ✓` : 'Everything is up to date ✓', { icon: 'check', timeout: 2000 });
  return { ...r, changed };
}
async function v1SyncNow() {
  if (V1A.busy) return;
  V1A.busy = true; v1AccRender();
  const a = await v1Pull({ quiet: true });
  const b = await v1Push({ quiet: true });
  V1A.busy = false;
  if ((b && b.code === 'auth') || (a && a.code === 'auth')) { V1A.st = await oto.account.status(); toast('Please sign in again to sync', { icon: 'key', timeout: 2600 }); }
  else toast(a && a.ok !== false && b && b.ok ? 'Synced ✓' : `Couldn’t sync — ${(b && b.error) || (a && a.error) || 'unknown error'}`, { icon: b && b.ok ? 'check' : 'x', timeout: 2600 });
  v1AccRender();
}
let _v1SaveNoSync = () => {};
function v1SyncSoon() {
  if (AVOCADO_MODE || !V1A.st || !V1A.st.signedIn || S.settings.v1SyncAuto === false) return;
  clearTimeout(V1A.pushT);
  V1A.pushT = setTimeout(() => v1Push(), 20000);
}
async function v1Peek() {
  if (AVOCADO_MODE || !V1A.st || !V1A.st.signedIn || S.settings.v1SyncAuto === false) return;
  const p = await oto.account.peek();
  if (p && p.newer) await v1Pull();
}

// ================================================================ account UI (Settings → Account & sync)
const v1Ago2 = (t) => { if (!t) return 'never'; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString(); };
function v1AccRender() { if (!$('#settings').hidden && settingsTab === 'account') renderSettings(); if (V1HUB && V1HUB.el) v1HubRender(); }
function v1Field(type, ph, val, oninput, attrs = {}) {
  const i = h('input', { class: 'text v1-in', type, placeholder: ph, value: val || '', spellcheck: 'false', autocomplete: 'off', ...attrs });
  i.addEventListener('input', () => oninput(i.value));
  return i;
}
async function v1AfterSignIn(r) {
  V1A.st = await oto.account.status();
  if (r.oldData) { V1A.ask = 'old'; v1AccRender(); return; }
  if (r.remote && r.remote.exists) { V1A.ask = { remote: r.remote }; v1AccRender(); return; }
  await v1Push(); toast('Signed in — this PC’s data is now saved to your account ✓', { icon: 'check', timeout: 3000 });
  v1AccRender();
}
async function v1SendResetCode() {
  const email = (V1A.reset && V1A.reset.email) || V1A.email;
  V1A.err = ''; V1A.msg = ''; V1A.busy = true; v1AccRender();
  const r = await oto.account.forgot(email);
  V1A.busy = false;
  if (!r.ok) { V1A.err = /rate|seconds|limit/i.test(r.error || '') ? 'Too many emails — wait a minute and try again.' : r.error; return v1AccRender(); }
  V1A.reset = { email, sentAt: Date.now() };
  V1A.msg = 'Code sent — check your inbox (and spam).';
  v1AccRender();
}
function v1AccountPage() {
  const st = V1A.st || {};
  const out = [];
  const err = V1A.err ? h('p', { class: 'v1-acc-err' }, V1A.err) : null;
  const msg = V1A.msg ? h('p', { class: 'v1-acc-msg' }, V1A.msg) : null;
  if (!st.configured) {
    out.push(section('Oto Account', h('div', { class: 'v1-acc-card' }, h('b', {}, 'Accounts aren’t connected yet'), h('p', {}, 'Oto Accounts need the Oto server. Once it’s connected you can sign in here and your settings, bookmarks, spaces, card and passwords follow you to any PC.'))));
  } else if (V1A.ask === 'old') {
    let old = '';
    out.push(section('Your cloud data uses an older password', h('div', { class: 'v1-acc-card' },
      h('p', {}, 'Your data was saved with your old password (before a reset). Type the old password to keep it, or start fresh — the old cloud data can’t be read without it.'),
      v1Field('password', 'Old password', '', (v) => { old = v; }),
      h('div', { class: 'v1-acc-btns' },
        h('button', { class: 'btn primary', onclick: async () => { const r = await oto.account.oldPassword(old); if (!r.ok) { V1A.err = r.error; return v1AccRender(); } V1A.ask = { remote: r.remote }; V1A.err = ''; v1AccRender(); } }, 'Use old password'),
        h('button', { class: 'btn', onclick: async () => { await oto.account.startFresh(); V1A.ask = null; await v1Push(); toast('Started fresh — this PC’s data is saved to your account', { timeout: 2600 }); v1AccRender(); } }, 'Start fresh')), err)));
  } else if (V1A.ask && V1A.ask.remote) {
    const rm = V1A.ask.remote, sm = rm.summary || {};
    out.push(section('Welcome back!', h('div', { class: 'v1-acc-card' },
      h('p', {}, `Your account already has data from ${rm.device || 'another PC'} (saved ${v1Ago2(rm.at)}${sm.spaces != null ? ` · ${sm.spaces} spaces · ${sm.bookmarks} bookmarks · ${sm.level} card` : ''}).`),
      h('p', { class: 'sm' }, 'Your card, badges and passwords are always merged — nothing from either PC is lost there.'),
      h('div', { class: 'v1-acc-btns' },
        h('button', { class: 'btn primary', onclick: async () => { V1A.ask = null; const r = await v1Pull({ all: true }); if (r && r.ok) { S.onboarded = true; _v1SaveNoSync(); await v1Push(); toast('Your Oto is back ✓', { icon: 'check', timeout: 2400 }); setTimeout(() => location.reload(), 600); } else { V1A.err = (r && r.error) || 'Couldn’t load'; v1AccRender(); } } }, 'Use my cloud data'),
        h('button', { class: 'btn', onclick: async () => { V1A.ask = null; await v1Pull({ all: false }); S.v1SyncMeta = {}; await v1Push(); toast('This PC’s data is saved to your account ✓', { icon: 'check', timeout: 2400 }); v1AccRender(); } }, 'Keep this PC’s data')), err)));
  } else if (!st.signedIn && V1A.confirm) {
    // New account: type the code from the email to confirm it, right here in Oto.
    let code = '';
    const go = async () => {
      V1A.err = ''; V1A.msg = ''; V1A.busy = true; v1AccRender();
      const r = await oto.account.confirmWithCode(V1A.confirm.email, code, V1A.confirm.pw);
      V1A.busy = false;
      if (!r.ok) { V1A.err = r.error; return v1AccRender(); }
      V1A.confirm = null;
      if (r.signIn) { V1A.form = 'signin'; V1A.msg = 'Email confirmed ✓ — sign in now.'; return v1AccRender(); }
      await v1AfterSignIn(r);
    };
    const codeIn = v1Field('text', 'Code from the email', '', (v) => { code = v; }, { onkeydown: (e) => { if (e.key === 'Enter') go(); }, inputmode: 'numeric', maxlength: '10', class: 'text v1-in v1-code', autocomplete: 'one-time-code' });
    out.push(section('Confirm your email', h('div', { class: 'v1-acc-card form' },
      h('p', {}, 'We emailed a code to ', h('b', {}, V1A.confirm.email), '. Type it below to finish creating your Oto account.'),
      codeIn,
      h('div', { class: 'v1-acc-btns' },
        h('button', { class: 'btn primary', disabled: V1A.busy, onclick: go }, V1A.busy ? 'Please wait…' : 'Confirm'),
        h('button', { class: 'lnk', onclick: async () => { const r = await oto.account.resendConfirm(V1A.confirm.email); V1A.msg = r.ok ? 'New code sent.' : ''; V1A.err = r.ok ? '' : (/rate|seconds|limit/i.test(r.error || '') ? 'Too many emails — wait a minute and try again.' : r.error); v1AccRender(); } }, 'Send a new code'),
        h('button', { class: 'lnk', onclick: () => { V1A.confirm = null; V1A.err = ''; V1A.msg = ''; v1AccRender(); } }, 'Back')),
      err, msg)));
    setTimeout(() => codeIn.focus(), 30);
  } else if (!st.signedIn && V1A.reset) {
    // Forgot password: type the code from the email and a new password, right here in Oto.
    let code = '', pw = '', pw2 = '';
    const go = async () => {
      V1A.err = ''; V1A.msg = '';
      if (pw !== pw2) { V1A.err = 'The passwords don’t match.'; return v1AccRender(); }
      V1A.busy = true; v1AccRender();
      const r = await oto.account.resetWithCode(V1A.reset.email, code, pw);
      V1A.busy = false;
      if (!r.ok) { if (r.changed) { V1A.reset = null; V1A.form = 'signin'; } V1A.err = r.error; return v1AccRender(); }
      V1A.reset = null;
      toast('Password changed — you’re signed in ✓', { icon: 'check', timeout: 2600 });
      await v1AfterSignIn(r);
    };
    const enter = { onkeydown: (e) => { if (e.key === 'Enter') go(); } };
    const wait = Math.max(0, 60 - Math.round((Date.now() - V1A.reset.sentAt) / 1000));
    const codeIn = v1Field('text', 'Code from the email', '', (v) => { code = v; }, { ...enter, inputmode: 'numeric', maxlength: '10', class: 'text v1-in v1-code', autocomplete: 'one-time-code' });
    out.push(section('Reset your password', h('div', { class: 'v1-acc-card form' },
      h('p', {}, `We emailed a code to `, h('b', {}, V1A.reset.email), `. Type it below with a new password. The code works for about an hour.`),
      codeIn,
      v1Field('password', 'New password (8+ characters)', '', (v) => { pw = v; }, enter),
      v1Field('password', 'Type the new password again', '', (v) => { pw2 = v; }, enter),
      h('p', { class: 'sm warn' }, '⚠ Your synced data was encrypted with your old password. After the reset, Oto asks for the old password to keep that data — or you can start fresh with what’s on this PC.'),
      h('div', { class: 'v1-acc-btns' },
        h('button', { class: 'btn primary', disabled: V1A.busy, onclick: go }, V1A.busy ? 'Please wait…' : 'Reset password'),
        h('button', { class: 'lnk', disabled: wait > 0, onclick: () => v1SendResetCode() }, wait > 0 ? `Send a new code (${wait} s)` : 'Send a new code'),
        h('button', { class: 'lnk', onclick: () => { V1A.reset = null; V1A.err = ''; V1A.msg = ''; v1AccRender(); } }, 'Back to sign in')),
      err, msg)));
    setTimeout(() => codeIn.focus(), 30);
    if (wait > 0) {
      clearTimeout(V1A.resetTick);
      const tick = () => {
        if (!V1A.reset) return;
        const b = [...document.querySelectorAll('#settings .lnk')].find((x) => /new code/.test(x.textContent));
        const w = Math.max(0, 60 - Math.round((Date.now() - V1A.reset.sentAt) / 1000));
        if (!b) return;
        b.textContent = w > 0 ? `Send a new code (${w} s)` : 'Send a new code'; b.disabled = w > 0;
        if (w > 0) V1A.resetTick = setTimeout(tick, 1000);
      };
      V1A.resetTick = setTimeout(tick, 1000);
    }
  } else if (!st.signedIn) {
    const isUp = V1A.form === 'signup';
    let pw = '', pw2 = '';
    const go = async () => {
      V1A.err = ''; V1A.msg = '';
      if (!/^\S+@\S+\.\S+$/.test(V1A.email)) { V1A.err = 'Type your email address.'; return v1AccRender(); }
      if (isUp && pw !== pw2) { V1A.err = 'The passwords don’t match.'; return v1AccRender(); }
      V1A.busy = true; v1AccRender();
      const r = isUp ? await oto.account.signup(V1A.email, pw) : await oto.account.signin(V1A.email, pw);
      V1A.busy = false;
      if (!r.ok) { V1A.err = r.error; return v1AccRender(); }
      if (r.confirm) { V1A.confirm = { email: V1A.email, pw, sentAt: Date.now() }; V1A.msg = 'Code sent — check your inbox (and spam).'; return v1AccRender(); }
      await v1AfterSignIn(r);
    };
    const enter = { onkeydown: (e) => { if (e.key === 'Enter') go(); } };
    out.push(section('', h('div', { class: 'v1-acc-hero' },
      h('div', { class: 'ic', html: skinIsRt() ? logoSvg() : icon('key') }),
      h('div', {}, h('b', {}, 'Your Oto, on every PC'), h('p', {}, 'Sign in to save your settings, themes, bookmarks, spaces, Oto Card and passwords. Everything is encrypted on this PC with your password before it’s uploaded.')))),
    section(isUp ? 'Create your Oto account' : 'Sign in', h('div', { class: 'v1-acc-card form' },
      h('div', { class: 'seg' }, h('button', { class: isUp ? '' : 'on', onclick: () => { V1A.form = 'signin'; V1A.err = ''; v1AccRender(); } }, 'Sign in'), h('button', { class: isUp ? 'on' : '', onclick: () => { V1A.form = 'signup'; V1A.err = ''; v1AccRender(); } }, 'Create account')),
      v1Field('email', 'Email', V1A.email, (v) => { V1A.email = v.trim(); }, enter),
      v1Field('password', isUp ? 'Password (8+ characters)' : 'Password', '', (v) => { pw = v; }, enter),
      isUp ? v1Field('password', 'Type the password again', '', (v) => { pw2 = v; }, enter) : null,
      isUp ? h('p', { class: 'sm warn' }, '⚠ Remember this password. It also unlocks your encrypted data — if you reset it by email, the data saved before can’t be read.') : null,
      h('div', { class: 'v1-acc-btns' }, h('button', { class: 'btn primary', disabled: V1A.busy, onclick: go }, V1A.busy ? 'Please wait…' : isUp ? 'Create account' : 'Sign in'),
        !isUp ? h('button', { class: 'lnk', onclick: () => { if (!/^\S+@\S+\.\S+$/.test(V1A.email)) { V1A.err = 'Type your email first, then click Forgot password.'; return v1AccRender(); } v1SendResetCode(); } }, 'Forgot password?') : null),
      err, msg)));
  } else {
    const on = v1SyncOn();
    out.push(section('', h('div', { class: 'v1-acc-hero in' },
      h('div', { class: 'av' }, (st.email || '?')[0].toUpperCase()),
      h('div', {}, h('b', {}, st.email), h('p', {}, st.syncing ? 'Syncing…' : st.error ? `⚠ ${st.error}` : `Synced ${v1Ago2(st.lastSync)}`)),
      h('button', { class: 'btn primary', disabled: V1A.busy || st.syncing, onclick: v1SyncNow }, V1A.busy || st.syncing ? 'Syncing…' : 'Sync now'))),
    section('What to sync', ...V1_SYNC.map(([k, label, sub]) => row(label, sub, sw(on[k], (v) => { S.settings.v1Sync = { ...on, [k]: v }; save(); }))),
      row('Sync automatically', 'Saves changes about 20 seconds after you make them and checks for changes from your other PCs every few minutes.', sw(S.settings.v1SyncAuto !== false, (v) => setPref('v1SyncAuto', v)))),
    section('Account',
      V1A.pwForm ? (() => { let a = '', b = ''; return h('div', { class: 'v1-acc-card form' }, v1Field('password', 'Current password', '', (v) => { a = v; }), v1Field('password', 'New password (8+ characters)', '', (v) => { b = v; }),
        h('div', { class: 'v1-acc-btns' }, h('button', { class: 'btn primary', onclick: async () => { const r = await oto.account.changePassword(a, b); V1A.err = r.ok ? '' : r.error; if (r.ok) { V1A.pwForm = false; toast('Password changed — your data was re-encrypted ✓', { icon: 'check', timeout: 2600 }); } v1AccRender(); } }, 'Change password'), h('button', { class: 'btn', onclick: () => { V1A.pwForm = false; v1AccRender(); } }, 'Cancel')), err); })()
        : row('Password', 'Changing it re-encrypts your cloud data with the new one.', h('button', { class: 'btn', onclick: () => { V1A.pwForm = true; V1A.err = ''; v1AccRender(); } }, 'Change…')),
      row('Sign out', 'Your data stays on this PC and in your account.', h('button', { class: 'btn', onclick: async () => { await oto.account.signout(); V1A.st = await oto.account.status(); toast('Signed out', { timeout: 1400 }); v1AccRender(); } }, 'Sign out')),
      row('Delete cloud data', 'Removes everything saved in your account. This PC keeps its own data.', h('button', { class: 'btn danger', onclick: async (e) => { const b = e.currentTarget; if (b.dataset.sure) { const r = await oto.account.deleteCloud(); toast(r.ok ? 'Cloud data deleted' : r.error, { timeout: 2000 }); V1A.st = await oto.account.status(); v1AccRender(); } else { b.dataset.sure = '1'; b.textContent = 'Click again to delete'; } } }, 'Delete…')), err));
  }
  return out;
}

// Shows a saved password in the Library (the PC lock that used to guard this was removed in owner.16).
async function v1PwGet(id) {
  const c = await oto.pwGet(id, 'reveal');
  return c && !c.needPin ? c : null;
}

// ================================================================ init
async function initV1f() {
  PAGES.splice(1, 0, ['account', 'Account & sync', 'key']);
  PAGE_RENDER.account = v1AccountPage;
  // About: protected content (Widevine) status, install and a real test inside the current page
  const _about = PAGE_RENDER.about;
  PAGE_RENDER.about = function () {
    const out = _about.apply(this, arguments);
    const d = V1A.drm;
    const cdm = d && d.status && Object.values(d.status)[0];
    const ok = !!(cdm && cdm.version);
    const txt = !d || !d.available ? 'Not available in this build' : V1A.drmBusy ? 'Installing… (up to a minute)' : ok ? `Installed · Widevine ${cdm.version}` : `Not installed yet${cdm && cdm.status ? ` (${cdm.status})` : ''}${d.error ? ` — ${d.error}` : ''}`;
    out.push(section('Protected content',
      row('Widevine (Spotify, Netflix, Disney+ …)', txt, h('div', { style: 'display:flex;gap:6px' },
        !ok && d && d.available ? h('button', { class: 'btn primary', disabled: !!V1A.drmBusy, onclick: async () => { V1A.drmBusy = true; renderSettings(); V1A.drm = await oto.drmInstall(); V1A.drmBusy = false; renderSettings(); } }, 'Install now') : null,
        h('button', { class: 'btn', onclick: async () => { V1A.drm = await oto.drmStatus(); renderSettings(); } }, 'Check'))),
      row('Test in the current page', V1A.drmTest || 'Open Spotify (or any site), then press Test.', h('button', { class: 'btn', onclick: async () => {
        const v = activeView();
        if (!v) { V1A.drmTest = 'Open a page first.'; return renderSettings(); }
        try {
          V1A.drmTest = await v.wv.executeJavaScript(`(navigator.requestMediaKeySystemAccess ? navigator.requestMediaKeySystemAccess('com.widevine.alpha', [{ initDataTypes: ['cenc'], audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] }]).then(() => 'Works ✓ — this page can play protected content').catch((e) => 'Doesn’t work: ' + e.message) : Promise.resolve('This page isn’t secure (needs https)'))`, true);
        } catch (e) { V1A.drmTest = `Couldn’t test: ${e.message}`; }
        renderSettings();
      } }, 'Test'))));
    return out;
  };
  oto.drmStatus().then((d) => { V1A.drm = d; }).catch(() => {});
  ACTIONS.push({ name: 'Oto Account & sync', kw: 'login sign in account sync cloud save data', icon: 'key', run: () => openSettings('account') });
  // Widevine (protected content) finished installing after Oto opened: offer to reload a streaming tab
  oto.on('drm:ready', () => {
    const t = activeTab();
    if (t && /(^|\.)(spotify|netflix|disneyplus|primevideo|amazon|max|hbomax|hulu|tidal|deezer|crunchyroll|paramountplus|peacocktv|tv\.apple|music\.apple)\./.test(hostOf(t.url) + '.')) {
      toast('Protected content is ready — reload to play', { icon: 'reload', timeout: 8000, action: { label: 'Reload', run: () => { const v = activeView(); if (v) wv(v, (w) => w.reload()); } } });
    }
  });
  oto.on('account:status', (st) => { const was = V1A.st && V1A.st.signedIn; V1A.st = st; if (was !== st.signedIn) v1AccRender(); });
  try { V1A.st = await oto.account.status(); } catch { V1A.st = { configured: false }; }
  V1A.email = V1A.st.email || '';
  // auto sync: push ~20 s after changes, check the cloud at start and every 5 minutes
  const _save = save;
  _v1SaveNoSync = () => _save();
  save = function () { const r = _save.apply(this, arguments); v1SyncSoon(); return r; };
  if (!AVOCADO_MODE) {
    setTimeout(() => v1Peek().then(() => v1SyncSoon()), 5000);
    V1A.peekT = setInterval(v1Peek, 5 * 60 * 1000);
    addEventListener('beforeunload', () => { if (V1A.pushT && V1A.st && V1A.st.signedIn) { clearTimeout(V1A.pushT); oto.account.push(v1Sections(), v1Summary()); } });
  }
  // Hub: account chip in the header
  const _hr = v1HubRender;
  v1HubRender = function () {
    _hr.apply(this, arguments);
    const hh = V1HUB.el && V1HUB.el.querySelector('.hh');
    if (!hh || hh.querySelector('.acc')) return;
    const st = V1A.st || {};
    hh.insertBefore(h('button', { class: 'acc', title: st.signedIn ? `Signed in as ${st.email}` : 'Sign in to save your Oto', onclick: () => { v1HubClose(); openSettings('account'); } },
      st.signedIn ? h('span', { class: 'av' }, (st.email || '?')[0].toUpperCase()) : h('span', { class: 'av off', html: icon('key') }), h('span', {}, st.signedIn ? (st.syncing ? 'Syncing…' : 'Synced') : 'Sign in')), hh.querySelector('.x'));
  };
}
