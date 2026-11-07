'use strict';
// Oto — the two password helpers that run inside web pages, in a hidden JavaScript world (world 1077) that
// page scripts can't see. They're built here in the main process (moved from src/passwords.js in 1.3.0) so
// the window UI can only ask for them by name: no code ever travels from the UI into a page.
// Injected into pages: notices a login being sent (form submit, Enter in a password box, clicking a
// submit button) and reports the username + password to Oto, which then offers to save them.
// Also remembers the username typed on step one of two-step logins (like Google's).
// Runs in a separate, hidden JavaScript world (page scripts can't see it or fake its messages:
// every message carries a secret made fresh for each page).
const PW_CAPTURE = (nonce) => `(() => {
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
    console.debug('__oto_pw__${nonce}' + JSON.stringify(c));
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
// Also in the hidden world: only a real click (not a script) on one of these buttons asks Oto to fill.
const PW_CHOOSER = (nonce, list) => `(() => {
  const LOGINS = ${JSON.stringify(list)};
  if (window.__otoFill) { window.__otoFill(LOGINS); return; }
  let current = LOGINS;
  window.__otoFill = (l) => { current = l; };
  const logins = () => current;
  const insecure = location.protocol === 'http:' && !/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname);
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
    head.textContent = insecure ? 'Oto · saved logins · ⚠ this page isn’t secure' : 'Oto · saved logins';
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
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (!e.isTrusted) return; hide(); console.debug('__oto_pwfill__${nonce}:' + l.id); });
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

module.exports = { PW_CAPTURE, PW_CHOOSER };
