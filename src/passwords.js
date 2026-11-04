'use strict';
/* Oto — password manager: offer to save logins, fill them when you pick an account, manage them in the Library */

// Injected into pages: notices a login being sent (form submit, Enter in a password box, clicking a
// submit button) and reports the username + password to Oto, which then offers to save them.
// Also remembers the username typed on step one of two-step logins (like Google's).
const PW_CAPTURE = `(() => {
  if (window.__otoPw) return; window.__otoPw = 1;
  const textish = (x) => x && x.tagName === 'INPUT' && /^(text|email|tel|)$/i.test(x.getAttribute('type') || '');
  const userish = (x) => textish(x) && /user|mail|login|identifier|account|phone|name/i.test((x.name || '') + ' ' + (x.id || '') + ' ' + (x.autocomplete || '') + ' ' + (x.placeholder || ''));
  try { window.__otoLastUser = sessionStorage.getItem('__otoLastUser') || ''; } catch (_) {}
  const grab = (root) => {
    const pws = [...(root.querySelectorAll ? root : document).querySelectorAll('input[type=password]')].filter((x) => x.value);
    if (!pws.length) return null;
    const p = pws.length > 1 ? (pws.find((x) => x.autocomplete === 'new-password') || pws[pws.length - 1]) : pws[0];
    const inputs = [...(p.form || document).querySelectorAll('input')];
    let u = '';
    for (let i = inputs.indexOf(p) - 1; i >= 0; i--) { const x = inputs[i]; if (textish(x) && x.value && x.offsetParent !== null) { u = x.value; break; } }
    return { u: u || window.__otoLastUser || '', p: p.value, isNew: p.autocomplete === 'new-password' || pws.length > 1 };
  };
  let last = '';
  const send = (root) => {
    const c = grab(root || document);
    if (!c || !c.p) return;
    const k = c.u + '\\n' + c.p;
    if (k === last) return;
    last = k;
    console.debug('__oto_pw__' + JSON.stringify(c));
  };
  document.addEventListener('submit', (e) => send(e.target), true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.type === 'password') send(e.target.form || document); }, true);
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('button, input[type=submit], [role=button]');
    if (!b) return;
    const f = b.form || b.closest('form') || document;
    if (f.querySelector('input[type=password]')) setTimeout(() => send(f), 0);
  }, true);
  document.addEventListener('change', (e) => {
    const x = e.target;
    if (userish(x) && x.value) { window.__otoLastUser = x.value; try { sessionStorage.setItem('__otoLastUser', x.value); } catch (_) {} }
  }, true);
})();`;

// Injected into pages that have saved logins: when you click a username or password box, a small
// list of your saved accounts appears under it. Picking one asks Oto to fill it — the password only
// enters the page at that moment.
const PW_CHOOSER = `(() => {
  if (window.__otoFill) return; window.__otoFill = 1;
  const logins = () => window.__otoLogins || [];
  const textish = (x) => x && x.tagName === 'INPUT' && /^(text|email|tel|)$/i.test(x.getAttribute('type') || '');
  const isPass = (x) => x && x.tagName === 'INPUT' && x.type === 'password' && x.autocomplete !== 'new-password';
  const hasPass = (x) => !!(x.form ? x.form.querySelector('input[type=password]') : document.querySelector('input[type=password]'));
  const userish = (x) => textish(x) && (x.autocomplete === 'username' || /user|mail|login|identifier|account|phone/i.test((x.name || '') + ' ' + (x.id || '') + ' ' + (x.autocomplete || '') + ' ' + (x.placeholder || '')));
  let host = null, field = null;
  const hide = () => { if (host) { host.remove(); host = null; field = null; } };
  const show = (el) => {
    if (host && field === el) return;
    hide();
    const list = logins();
    if (!list.length) return;
    field = el;
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;z-index:2147483647;inset:auto;';
    const sh = host.attachShadow({ mode: 'closed' });
    const r = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:' + Math.max(4, r.left) + 'px;top:' + (r.bottom + 4) + 'px;min-width:' + Math.max(220, r.width) + 'px;max-width:360px;background:#1b1a22;color:#f4f2fb;border-radius:12px;padding:6px;box-shadow:0 12px 32px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.08);font:13px "Segoe UI",system-ui,sans-serif;';
    const head = document.createElement('div');
    head.textContent = 'Oto · saved logins';
    head.style.cssText = 'font-size:11px;opacity:.6;padding:4px 8px 6px;';
    box.appendChild(head);
    for (const l of list.slice(0, 6)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:8px;border-radius:8px;cursor:pointer;';
      b.onmouseenter = () => { b.style.background = 'rgba(255,255,255,.1)'; };
      b.onmouseleave = () => { b.style.background = 'none'; };
      const key = document.createElement('span');
      key.textContent = '🔑';
      const t = document.createElement('span');
      t.textContent = l.u || '(no username)';
      t.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      b.append(key, t);
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); hide(); console.debug('__oto_pwfill__' + l.id); });
      box.appendChild(b);
    }
    sh.appendChild(box);
    document.documentElement.appendChild(host);
  };
  document.addEventListener('focusin', (e) => { const t = e.target; if (isPass(t) || (userish(t) && hasPass(t)) || (userish(t) && window.__otoLoginPage)) show(t); else if (!host || !host.contains(t)) hide(); }, true);
  document.addEventListener('mousedown', (e) => { if (host && e.target !== host && e.target !== field) hide(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); else if (host && e.key.length === 1) hide(); }, true);
  addEventListener('scroll', hide, true);
  addEventListener('resize', hide);
  const a = document.activeElement;
  if (a && (isPass(a) || (userish(a) && hasPass(a)))) show(a);
})();`;

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
  const url = tab.url;
  if (!originOf(url)) return;
  if (S.settings.pwOffer !== false && !pwNever().includes(originOf(url))) wv(v, (w) => w.executeJavaScript(PW_CAPTURE).catch(() => {}));
  if (S.settings.pwFill === false) return;
  const list = await oto.pwForOrigin(url).catch(() => []);
  if (!list.length) return;
  wv(v, (w) => w.executeJavaScript(`window.__otoLogins = ${JSON.stringify(list.map((e) => ({ id: e.id, u: e.username })))};${PW_CHOOSER}`).catch(() => {}));
}
async function pwFill(tab, id) {
  const v = V.get(tab.id);
  const cred = await oto.pwGet(id);
  if (!v || !cred) return;
  if (originOf(tab.url) !== cred.origin) return; // never fill a login into a different site
  const r = await wv(v, (w) => w.executeJavaScript(pwFillCode(cred.username, cred.password)).catch(() => null), null);
  if (r && !r.user && !r.pass) toast('No login box found on this page', { timeout: 1800 });
}

function pwBindView(tab, v) {
  const el = v.wv;
  el.addEventListener('dom-ready', () => pwInject(tab, v));
  el.addEventListener('console-message', (e) => {
    const m = e.message || '';
    if (m.startsWith('__oto_pwfill__')) { pwFill(tab, m.slice(14)); return; }
    if (!m.startsWith('__oto_pw__')) return;
    let c;
    try { c = JSON.parse(m.slice(10)); } catch { return; }
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
        await oto.pwSave(c.origin, c.u, c.p);
        close();
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
    h('button', { class: 'btn', onclick: async () => { if (!confirm('Export saves all your passwords in a plain, unencrypted file. Anyone who opens that file can read them. Continue?')) return; let r = await oto.pwExport(); if (r && r.needPin && typeof v1AskSecret === 'function') { const sec = await v1AskSecret('Type your PIN to export passwords', ((V1A.st || {}).lock || {}).kind); if (sec == null) return; const v = await oto.lock.verify(sec); if (!v.ok) { toast('Wrong PIN', { timeout: 1600 }); return; } r = await oto.pwExport(); } if (r === true) toast('Passwords exported', { timeout: 1800 }); } }, 'Export…'));
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
