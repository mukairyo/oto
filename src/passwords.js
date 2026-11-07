'use strict';
/* Oto — password manager: offer to save logins, fill them when you pick an account, manage them in the Library */

// The page helpers (notice a login being sent, show saved accounts under a login box) are built and injected
// by Oto's main process (main/pw-page.js). This window can only ask for them by name — it can't send code.

// ---- per-page wiring
const pwPending = new Map(); // tab id -> { u, p, at, origin }
const pwSitesCache = { at: 0, origins: new Set() };
async function pwRefreshCache() {
  const list = await oto.pwList().catch(() => []);
  pwSitesCache.origins = new Set(list.map((e) => e.origin));
  pwSitesCache.at = Date.now();
  updateKeyButton();
}
const originOf = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.origin : null; } catch { return null; } };
const pwNever = () => (S.settings.pwNever = S.settings.pwNever || []);

async function pwInject(tab, v) {
  const url = wv(v, (w) => w.getURL(), tab.url);
  if (!originOf(url)) return;
  if (!v.wcId) mapWebContents(tab, v);
  if (!v.wcId) return;
  v.pwNonce = null;
  const capture = S.settings.pwOffer !== false && !pwNever().includes(originOf(url));
  const r = await oto.pwArm(v.wcId, { capture, fill: S.settings.pwFill !== false }).catch(() => null);
  v.pwNonce = r && r.nonce ? r.nonce : null;
}
// The password goes from Oto's main process straight into the page's login box (in the hidden world),
// only if the page is still on the site the login belongs to. It never passes through this window.
async function pwFill(tab, id) {
  const v = V.get(tab.id);
  if (!v || !v.wcId) return;
  const r = await oto.pwFillInto(v.wcId, id).catch(() => null);
  if (r && r.needPin) return toast('Unlock Oto to use saved passwords', { timeout: 2000 });
  if (r && r.ok && !r.user && !r.pass) toast('No login box found on this page', { timeout: 1800 });
}

function pwBindView(tab, v) {
  const el = v.wv;
  el.addEventListener('dom-ready', () => pwInject(tab, v));
  el.addEventListener('console-message', (e) => {
    const m = e.message || '';
    if (!v.pwNonce) return;
    const fillTag = `__oto_pwfill__${v.pwNonce}:`, saveTag = `__oto_pw__${v.pwNonce}`;
    if (m.startsWith(fillTag)) { pwFill(tab, m.slice(fillTag.length)); return; }
    if (!m.startsWith(saveTag)) return;
    let c;
    try { c = JSON.parse(m.slice(saveTag.length)); } catch { return; }
    if (!c || !c.p || typeof c.p !== 'string') return;
    const origin = originOf(tab.url);
    if (!origin || S.settings.pwOffer === false || pwNever().includes(origin)) return;
    pwPending.set(tab.id, { u: String(c.u || ''), p: c.p, at: Date.now(), origin });
    // Wait for the login to go through (the page navigates), or a moment for single-page apps.
    clearTimeout(v.pwTimer);
    v.pwTimer = setTimeout(() => pwOffer(tab), 2500);
  });
  const onNav = () => { if (pwPending.has(tab.id)) { clearTimeout(v.pwTimer); v.pwTimer = setTimeout(() => pwOffer(tab), 600); } if (isActiveTab(tab)) updateKeyButton(); };
  el.addEventListener('did-navigate', onNav);
  el.addEventListener('did-navigate-in-page', (e) => { if (e.isMainFrame) onNav(); });
}
const isActiveTab = (tab) => S.active[S.activeWs] === tab.id;

async function pwOffer(tab) {
  const c = pwPending.get(tab.id);
  pwPending.delete(tab.id);
  if (!c || Date.now() - c.at > 20000) return;
  const st = await oto.pwCheck(c.origin, c.u, c.p);
  if (st === 'same' || st === 'invalid') return;
  showPwBar(tab, c, st === 'update');
}
function showPwBar(tab, c, isUpdate) {
  let bar = $('#pwBar');
  if (!bar) { bar = h('div', { id: 'pwBar' }); $('#content').append(bar); }
  const site = (() => { try { return new URL(c.origin).hostname.replace(/^www\./, ''); } catch { return c.origin; } })();
  const close = () => { bar.classList.add('leaving'); setTimeout(() => { bar.hidden = true; bar.classList.remove('leaving'); }, 160); };
  bar.hidden = false;
  bar.replaceChildren(
    h('span', { class: 'pwb-ic', html: icon('key') }),
    h('div', { class: 'pwb-txt' },
      h('b', {}, isUpdate ? `Update your password for ${site}?` : `Save your password for ${site}?`),
      h('small', {}, c.u ? `${c.u} · ${'•'.repeat(Math.min(12, c.p.length))}` : '•'.repeat(Math.min(12, c.p.length)))),
    !isUpdate ? h('button', { class: 'btn', onclick: () => { pwNever().push(c.origin); save(); close(); toast(`Oto won’t offer to save passwords for ${site}`, { timeout: 2200 }); } }, 'Never for this site') : null,
    h('button', { class: 'btn', onclick: close }, 'Not now'),
    h('button', {
      class: 'btn primary',
      onclick: async () => {
        const res = await oto.pwSave(c.origin, c.u, c.p);
        close();
        if (res === 'noenc') return toast('Not saved: Windows can’t encrypt passwords right now, and Oto never stores them unencrypted', { timeout: 4000 });
        toast(isUpdate ? 'Password updated' : 'Password saved', { icon: 'key', timeout: 1600 });
        pwRefreshCache();
        if (LIB.open && LIB.page === 'passwords') renderLibrary();
      },
    }, isUpdate ? 'Update' : 'Save'));
  clearTimeout(bar.timer);
  bar.timer = setTimeout(() => { if (!bar.matches(':hover')) close(); }, 25000);
}

// Key button in the address row when the current site has saved logins.
function updateKeyButton() {
  const b = $('#btnKey');
  if (!b) return;
  const t = activeTab();
  const o = t && originOf(t.url);
  b.hidden = !o || !pwSitesCache.origins.has(o);
}
async function keyMenu(x, y) {
  const t = activeTab();
  if (!t) return;
  const list = await oto.pwForOrigin(t.url);
  showMenu(x, y, [
    { header: 'Saved logins' },
    ...list.map((e) => ({ label: e.username || '(no username)', icon: 'key', run: () => pwFill(t, e.id) })),
    '-',
    ...list.slice(0, 3).map((e) => ({ label: `Copy password${list.length > 1 ? ` — ${e.username}` : ''}`, icon: 'copy', run: async () => { const c = await (typeof v1PwGet === 'function' ? v1PwGet(e.id) : oto.pwGet(e.id)); if (c) { oto.copy(c.password); toast('Password copied', { icon: 'copy', timeout: 1400 }); } } })),
    { label: 'Manage passwords…', icon: 'settings', run: () => openLibrary('passwords') },
  ]);
}

// ---- Library page
function genPassword(n = 18) {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*?-_'];
  const all = sets.join('');
  const rnd = (m) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % m; };
  const out = sets.map((s) => s[rnd(s.length)]);
  while (out.length < n) out.push(all[rnd(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}
const PWS = { list: null, status: null, revealed: {}, editing: null, adding: false };
async function pwLoadLib() {
  [PWS.list, PWS.status] = await Promise.all([oto.pwList(), oto.pwStatus()]);
  if (LIB.open && LIB.page === 'passwords') renderLibrary();
}
function pwForm(entry, done) {
  const urlIn = h('input', { class: 'lib-input', placeholder: 'Website, e.g. https://github.com', value: entry ? entry.origin : (originOf((activeTab() || {}).url || '') || ''), spellcheck: 'false' });
  const userIn = h('input', { class: 'lib-input', placeholder: 'Username or email', value: entry ? entry.username : '', spellcheck: 'false' });
  const passIn = h('input', { class: 'lib-input', type: 'text', placeholder: entry ? 'New password (leave empty to keep)' : 'Password', spellcheck: 'false', autocomplete: 'off' });
  const go = async () => {
    let url = urlIn.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    if (!originOf(url)) { urlIn.focus(); return; }
    if (entry) await oto.pwUpdate(entry.id, { url, username: userIn.value, password: passIn.value });
    else { if (!passIn.value) { passIn.focus(); return; } await oto.pwSave(url, userIn.value, passIn.value); }
    done(); pwRefreshCache(); pwLoadLib();
  };
  return h('div', { class: 'pw-form' }, urlIn, userIn,
    h('div', { class: 'pw-pass-row' }, passIn, h('button', { class: 'btn', title: 'Make a strong password', onclick: () => { passIn.value = genPassword(); } }, 'Generate')),
    h('div', { class: 'pw-form-btns' }, h('button', { class: 'btn', onclick: done }, 'Cancel'), h('button', { class: 'btn primary', onclick: go }, entry ? 'Save changes' : 'Add password')));
}
LIB_RENDER.passwords = function passwords() {
  if (!PWS.list) { pwLoadLib(); return [libEmpty('key', 'Loading…')]; }
  const list = PWS.list.filter((e) => matchQ(e.site, e.username, e.origin));
  const tools = h('div', { class: 'lib-tools' },
    h('button', { class: 'btn primary', onclick: () => { PWS.adding = true; PWS.editing = null; renderLibrary(); } }, 'Add password'),
    h('button', { class: 'btn', onclick: async () => { const r = await oto.pwImport(); if (!r) return; if (r.error) toast(r.error, { timeout: 3000 }); else { toast(`Imported ${r.added} new, ${r.updated} updated`, { icon: 'key', timeout: 2400 }); pwRefreshCache(); pwLoadLib(); } } }, 'Import…'),
    // Oto itself asks before exporting (a Windows dialog that explains the risk), so nothing can export silently.
    h('button', { class: 'btn', onclick: async () => { const r = await oto.pwExport(); if (r === true) toast('Passwords exported — delete the file once you’ve imported it', { timeout: 3200 }); } }, 'Export…'));
  const intro = h('p', { class: 'lib-intro' }, PWS.status && !PWS.status.encrypted
    ? '⚠ This system doesn’t offer encryption, so passwords are stored unprotected.'
    : 'Saved on this PC and encrypted with Windows’ own protection. When you click a login box, Oto shows your accounts for that site.');
  const out = [intro, tools];
  if (PWS.adding) out.push(pwForm(null, () => { PWS.adding = false; renderLibrary(); }));
  if (!list.length && !PWS.adding) {
    out.push(libEmpty('key', LIB.q ? 'No passwords match your search.' : 'No saved passwords yet. Log in to a site and Oto will offer to save it — or import them from Chrome, Edge or Firefox (export a CSV there first).'));
    return out;
  }
  out.push(h('div', { class: 'lib-group' }, ...list.map((e) => {
    if (PWS.editing === e.id) return pwForm(e, () => { PWS.editing = null; renderLibrary(); });
    const shown = PWS.revealed[e.id];
    return libRow({ cls: 'pw-row', title: e.origin },
      favEl({ url: e.origin, title: e.site, favicon: '' }, null, true),
      h('div', { class: 'lib-txt' }, h('b', {}, e.site), h('small', {}, e.username || '(no username)')),
      h('code', { class: 'pw-dots' }, shown || '••••••••••'),
      libBtn(shown ? 'eyeoff' : 'eye', shown ? 'Hide' : 'Show password', async () => { if (shown) delete PWS.revealed[e.id]; else { const c = await (typeof v1PwGet === 'function' ? v1PwGet(e.id) : oto.pwGet(e.id)); if (c) PWS.revealed[e.id] = c.password; } renderLibrary(); }),
      libBtn('copy', 'Copy password', async () => { const c = await (typeof v1PwGet === 'function' ? v1PwGet(e.id) : oto.pwGet(e.id)); if (c) { oto.copy(c.password); toast('Password copied', { icon: 'copy', timeout: 1400 }); } }),
      libBtn('edit', 'Edit', () => { PWS.editing = e.id; PWS.adding = false; renderLibrary(); }),
      libBtn('trash', 'Delete', async () => { if (!confirm(`Delete the saved password for ${e.username || e.site}?`)) return; await oto.pwDelete(e.id); pwRefreshCache(); pwLoadLib(); }));
  })));
  if ((S.settings.pwNever || []).length) {
    out.push(h('div', { class: 'lib-group' }, h('h5', {}, 'Never saved for'), ...S.settings.pwNever.map((o) => libRow({},
      favEl({ url: o, title: o, favicon: '' }, null, true),
      h('div', { class: 'lib-txt' }, h('b', {}, o.replace(/^https?:\/\/(www\.)?/, ''))),
      libBtn('trash', 'Remove from this list', () => { S.settings.pwNever = S.settings.pwNever.filter((x) => x !== o); save(); renderLibrary(); })))));
  }
  return out;
};

function initPasswords() {
  const actions = $('#pageActions');
  if (actions && !$('#btnKey')) {
    const b = h('button', { id: 'btnKey', class: 'icon-btn', title: 'Saved logins for this site', html: icon('key'), hidden: true });
    b.onclick = () => { const r = b.getBoundingClientRect(); keyMenu(r.left, r.bottom + 4); };
    actions.prepend(b);
  }
  pwRefreshCache();
}
