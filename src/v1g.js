'use strict';
/* Oto v1 — Oto Shield: a uBlock-style menu for Oto's blocker (which uses uBlock Origin's filter lists).
   Big power button per site, blocked counts, element zapper / picker, annoyance lists, your own filters. */

const V1SH = { st: null };

// In-page element zapper / picker. Zap = remove now; pick = remove and hide on this site from now on.
const v1PickJs = (mode) => `(() => {
  if (window.__otoPick) { window.__otoPick.stop(); }
  const zap = ${mode === 'zap'};
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #f43f5e;background:rgba(244,63,94,.18);border-radius:4px;transition:all .06s;display:none';
  const tip = document.createElement('div');
  tip.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:14px;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:#111;color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none';
  tip.textContent = zap ? 'Click anything to remove it  ·  Esc to stop' : 'Click something to hide it on this site for good  ·  Esc to stop';
  document.documentElement.append(box, tip);
  let cur = null;
  const sel = (el) => {
    if (el.id && /^[A-Za-z][\\w-]{1,40}$/.test(el.id) && !/\\d{4,}/.test(el.id) && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const parts = [];
    for (let n = el, d = 0; n && n.nodeType === 1 && n !== document.documentElement && d < 5; n = n.parentElement, d++) {
      let p = n.tagName.toLowerCase();
      if (n.id && /^[A-Za-z][\\w-]{1,40}$/.test(n.id) && !/\\d{4,}/.test(n.id)) { parts.unshift('#' + CSS.escape(n.id) + (parts.length ? '' : '')); break; }
      const cls = [...n.classList].filter((c) => /^[A-Za-z][\\w-]{1,30}$/.test(c) && !/\\d{3,}/.test(c)).slice(0, 2);
      if (cls.length) p += '.' + cls.map((c) => CSS.escape(c)).join('.');
      const sib = n.parentElement ? [...n.parentElement.children].filter((x) => x.tagName === n.tagName) : [];
      if (sib.length > 1 && !cls.length) p += ':nth-of-type(' + (sib.indexOf(n) + 1) + ')';
      parts.unshift(p);
      const s = parts.join(' > ');
      try { if (document.querySelectorAll(s).length === 1) return s; } catch {}
    }
    return parts.join(' > ');
  };
  const move = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY); if (!el || el === box || el === tip || el === document.body || el === document.documentElement) { box.style.display = 'none'; cur = null; return; } cur = el; const r = el.getBoundingClientRect(); Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); };
  const click = (e) => { if (!cur) return; e.preventDefault(); e.stopPropagation(); const s = sel(cur); cur.remove(); box.style.display = 'none';
    if (!zap) { console.log('__oto_pick__' + JSON.stringify({ sel: s })); stop(); } };
  const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); stop(); } };
  const stop = () => { removeEventListener('mousemove', move, true); removeEventListener('click', click, true); removeEventListener('keydown', key, true); box.remove(); tip.remove(); window.__otoPick = null; };
  addEventListener('mousemove', move, true); addEventListener('click', click, true); addEventListener('keydown', key, true);
  window.__otoPick = { stop };
})()`;

function v1ShieldPick(mode) {
  const v = activeView();
  if (!v) return;
  v1ClosePop();
  try { v.wv.focus(); } catch {}
  v.wv.executeJavaScript(v1PickJs(mode)).catch(() => {});
}

async function v1ShieldMenu() {
  const t = activeTab(), v = activeView();
  if (!t || !v || !/^https?:/.test(t.url)) return toast('Open a website to use Oto Shield', { icon: 'shield', timeout: 1800 });
  v1ClosePop();
  const st = await oto.shield.state(t.url);
  V1SH.st = st;
  const globalOn = S.settings.blockTrackers !== false;
  const siteOn = globalOn && !st.allowed;
  const anchor = $('#btnShield').getBoundingClientRect();
  const layer = v1Layer(v1ClosePop); v1Pop = layer;
  const total = (S.stats && S.stats.blocked) || 0;
  const since = new Date(S.since || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const reload = () => { const vv = activeView(); if (vv) wv(vv, (w) => w.reloadIgnoringCache()); };
  const pop = h('div', { class: 'v1-pop v1-shield' },
    h('div', { class: 'hd' }, h('b', {}, 'Oto Shield'), h('small', {}, 'uBlock Origin filter lists')),
    h('button', { class: `power${siteOn ? ' on' : ''}${globalOn ? '' : ' off-all'}`, title: siteOn ? 'Turn blocking off for this site' : 'Turn blocking on for this site', onclick: async () => {
      if (!globalOn) { setPref('blockTrackers', true); INFO.blocking = await oto.setBlocking(true); }
      else await oto.shield.site(t.url, siteOn);
      v1ClosePop(); reload();
      toast(siteOn ? `Blocking is off on ${st.host}` : `Blocking is on for ${st.host}`, { icon: 'shield', timeout: 2000 });
    } }, h('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v9"/><path d="M6.3 6.6a8 8 0 1 0 11.4 0"/></svg>' })),
    h('div', { class: 'site' }, h('b', {}, st.host), h('small', {}, !globalOn ? 'Blocking is off everywhere — click to turn it on' : siteOn ? 'Blocking ads & trackers here' : 'Blocking is off on this site')),
    h('div', { class: 'nums' },
      h('div', {}, h('b', {}, String(siteOn ? (v.blocked || 0) : 0)), h('small', {}, 'on this page')),
      h('div', {}, h('b', {}, total > 9999 ? `${Math.round(total / 1000)}K` : total.toLocaleString()), h('small', {}, `since ${since}`))),
    h('div', { class: 'tools' },
      h('button', { title: 'Click anything on the page to remove it (until you reload)', onclick: () => v1ShieldPick('zap') }, h('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>' }), 'Zap'),
      h('button', { title: 'Pick something to hide on this site for good', onclick: () => v1ShieldPick('pick') }, h('span', { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>' }), 'Hide'),
      h('button', { title: 'Reload the page', onclick: () => { v1ClosePop(); reload(); } }, h('span', { html: icon('reload') }), 'Reload')),
    h('label', { class: 'opt' }, h('span', {}, h('b', {}, 'Block annoyances'), h('small', {}, 'Cookie banners, newsletter popups, “turn off your adblocker” walls')),
      h('button', { class: `switch${st.annoy ? ' on' : ''}`, role: 'switch', onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; b.classList.toggle('on');
        const r = await oto.shield.annoy(!st.annoy); st.annoy = r.annoy; b.disabled = false;
        toast(r.annoy ? 'Annoyance lists on — reload pages to see it' : 'Annoyance lists off', { icon: 'shield', timeout: 2200 });
      } })),
    h('div', { class: 'ft' },
      h('button', { onclick: () => { v1ClosePop(); v1ShieldFilters(); } }, `My filters${st.filters ? ` (${st.filters})` : ''}…`),
      h('button', { onclick: () => { v1ClosePop(); openSettings('privacy'); } }, 'Settings')));
  pop.style.left = `${clamp(anchor.left + anchor.width / 2 - 150, 8, innerWidth - 308)}px`;
  pop.style.top = `${anchor.bottom + 10}px`;
  pop.style.setProperty('--arrow-x', `${clamp(anchor.left + anchor.width / 2 - (parseFloat(pop.style.left)), 20, 280)}px`);
  layer.append(pop);
}

async function v1ShieldFilters() {
  const d = await oto.shield.filters();
  v1ClosePop();
  const layer = v1Layer(v1ClosePop); v1Pop = layer;
  const ta = h('textarea', { class: 'flt', spellcheck: 'false', placeholder: '! One rule per line, uBlock Origin syntax\n||ads.example.com^\nexample.com##.sponsored\n@@||good-site.com^$document' });
  ta.value = d.text || '';
  const off = (d.allow || []);
  layer.append(h('div', { class: 'v1-pop v1-shield-flt' },
    h('div', { class: 'hd' }, h('b', {}, 'My filters'), h('small', {}, 'uBlock Origin syntax — blocked addresses, hidden elements (site##selector) and exceptions (@@). Lines starting with ! are notes.')),
    ta,
    off.length ? h('div', { class: 'allow' }, h('small', {}, 'Blocking is off on:'), ...off.map((host) => h('span', { class: 'chip' }, host, h('button', { title: 'Turn blocking back on', onclick: async (e) => { await oto.shield.site(`https://${host}/`, false); e.currentTarget.parentElement.remove(); } }, '×')))) : null,
    h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: v1ClosePop }, 'Cancel'),
      h('button', { class: 'btn primary', onclick: async () => { const r = await oto.shield.filters(ta.value); v1ClosePop(); toast(`Saved ${r.count} filter${r.count === 1 ? '' : 's'} — reload pages to apply`, { icon: 'check', timeout: 2200 }); } }, 'Save'))));
  setTimeout(() => ta.focus(), 30);
}

function initV1g() {
  const btn = $('#btnShield');
  if (btn) btn.onclick = v1ShieldMenu;
  ACTIONS.push({ name: 'Oto Shield', kw: 'ublock adblock blocker shield filters zap element picker', icon: 'shield', run: v1ShieldMenu },
    { name: 'Zap an element', kw: 'remove element zapper ublock', icon: 'shield', run: () => v1ShieldPick('zap') },
    { name: 'My filters', kw: 'ublock custom filters rules adblock', icon: 'shield', run: v1ShieldFilters });
  // picker results → hide on this site for good
  const _bind = bindView;
  bindView = function (tab, v) {
    _bind.apply(this, arguments);
    v.wv.addEventListener('console-message', async (e) => {
      const m = e.message || '';
      if (!m.startsWith('__oto_pick__')) return;
      try {
        const { sel } = JSON.parse(m.slice(12));
        const t = tabById(tab.id);
        if (sel && t && await oto.shield.pick(t.url, sel)) toast(`Hidden on ${hostOf(t.url)} — it stays hidden`, { icon: 'shield', timeout: 2600, action: { label: 'Undo', run: async () => { const d = await oto.shield.filters(); await oto.shield.filters(d.text.split('\n').filter((l) => l.trim() !== `${hostOf(t.url)}##${sel}`).join('\n')); const vv = V.get(tab.id); if (vv) wv(vv, (w) => w.reload()); } } });
      } catch {}
    });
  };
  // shield icon: crossed out when blocking is off on this site
  const _setShield = setShield;
  setShield = function (v) {
    _setShield.apply(this, arguments);
    const t = activeTab(), b = $('#btnShield');
    if (!t || !b || !/^https?:/.test(t.url)) return;
    oto.shield.state(t.url).then((st) => { if ((activeTab() || {}).id === t.id) b.classList.toggle('site-off', !!st.allowed); }).catch(() => {});
  };
}
