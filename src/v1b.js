'use strict';
/* Oto v1 — Alpha 2: pictures 9–16 (Health, Quick window, privacy, everyday helpers, Oto Night,
   space overview, Avocado, Oto Apps + Send to phone). initV1() calls v1Board9…v1Board16. */

const V1B_ICONS = {
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  battery: '<rect x="3" y="7.5" width="16" height="9" rx="2.5"/><path d="M21 10.5v3"/><path d="M6 10.5h7v3H6z" fill="currentColor"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.5 3-5.5 3.5-9 2 1.5 3 3.5 3 5 1-1 1.5-2.5 1.5-3.5 2.5 2 5 4.5 5 7.5 0 3.4-2.6 6-6.5 6z"/>',
  avo: '<path d="M12 3c-2.4 0-3.7 2.5-4.4 5-.8 2.6-3.1 4.3-3.1 7.6C4.5 19 7.8 21 12 21s7.5-2 7.5-5.4c0-3.3-2.3-5-3.1-7.6C15.7 5.5 14.4 3 12 3z"/><circle cx="12" cy="15" r="2.8"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
  app: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M3.5 8.5h17"/><circle cx="6.5" cy="6.5" r=".5"/>',
  loop: '<path d="M17 4l3 3-3 3M4 11V9.5A2.5 2.5 0 0 1 6.5 7H20M7 20l-3-3 3-3M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H4"/>',
  cam2: '<path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
  save: '<path d="M5 4.5h11l3 3V19a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 19z"/><path d="M8 4.5v5h7v-5M8 19.5v-6h8v6"/>',
  game: '<rect x="3" y="8" width="18" height="10" rx="5"/><path d="M8 11v4M6 13h4M15.5 12h.01M17.5 14h.01"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V5.5h6v2M3.5 12.5h17"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  book: '<path d="M5 5.5A2 2 0 0 1 7 3.5h12v15H7a2 2 0 0 0-2 2z"/><path d="M5 20.5V5.5"/>',
};
const AVOCADO_MODE = /[?&]avocado=1/.test(location.search);

// ================================================================ 9 · Oto Health + battery saver
const V1H = { mem: new Map(), cpu: new Map(), saved: 0, open: false, timer: 0, bat: null, saver: false };
async function v1Metrics() {
  try {
    const { procs, pages } = await oto.metrics();
    const byPid = new Map(procs.map((p) => [p.pid, p]));
    for (const pg of pages) {
      const id = wcToTab.get(pg.wcId);
      const p = byPid.get(pg.pid);
      if (id && p) { V1H.mem.set(id, p.mem); V1H.cpu.set(id, p.cpu); }
    }
    const total = procs.reduce((a, p) => a + p.mem, 0);
    return { total, procs };
  } catch { return { total: 0, procs: [] }; }
}
const v1Mb = (mb) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`);

async function v1Health() {
  v1ClosePop();
  const { total } = await v1Metrics();
  const open = S.tabs.filter((t) => V.has(t.id)).map((t) => ({ t, mem: V1H.mem.get(t.id) || 0, cpu: V1H.cpu.get(t.id) || 0 })).sort((a, b) => b.mem - a.mem);
  const sleeping = S.tabs.filter((t) => !V.has(t.id));
  const savedNow = sleeping.reduce((a, t) => a + (V1H.mem.get(t.id) || 90), 0);
  const heavy = open.find((x) => x.cpu > 25 && activeTab() && x.t.id !== activeTab().id);
  const max = Math.max(1, ...open.map((x) => x.mem));
  const tabsMem = open.reduce((a, x) => a + x.mem, 0);
  const layer = v1Layer(v1ClosePop); v1Pop = layer;
  const sw = h('button', { class: `switch${S.settings.v1Saver === 'on' || (S.settings.v1Saver !== 'off' && V1H.saver) ? ' on' : ''}`, role: 'switch', onclick: () => {
    const on = !sw.classList.contains('on');
    S.settings.v1Saver = on ? 'on' : 'off'; save(); v1ApplySaver(); sw.classList.toggle('on', on);
  } });
  const pct = Math.min(1, tabsMem / Math.max(total, 1));
  const panel = h('div', { class: 'v1-pop v1-health' },
    h('div', { class: 'ht', html: `${icon('pulse')}<b>Oto Health</b><span class="lv ${heavy ? 'warn' : ''}">● ${heavy ? 'One tab is busy' : 'Running smooth'}</span>` }),
    h('div', { class: 'hero' }, h('span', { class: 'donut', style: `--p:${pct}` }),
      h('div', {}, h('div', { class: 'big' }, v1Mb(total)), h('small', {}, `used by Oto right now · ${open.length} open tab${open.length === 1 ? '' : 's'}`),
        h('div', { class: 'sv', html: `${icon('leaf')}<span>${sleeping.length ? `About ${v1Mb(savedNow)} saved by ${sleeping.length} sleeping tab${sleeping.length === 1 ? '' : 's'}` : 'No sleeping tabs right now'}</span>` }))),
    h('div', { class: 'rows' }, ...open.slice(0, 7).map((x) => h('button', { class: 'tr', title: 'Go to tab', onclick: () => { v1ClosePop(); activate(x.t.id); } },
      favEl(x.t, null, true), h('span', { class: 'nm' }, x.t.title || prettyUrl(x.t.url)),
      h('span', { class: 'bar' }, h('i', { style: `width:${Math.max(2, (x.mem / max) * 100)}%`, class: x.cpu > 25 ? 'hot' : '' })),
      h('span', { class: 'mb' }, x.mem ? v1Mb(x.mem) : '—'))),
    sleeping.length ? h('div', { class: 'tr dim' }, h('span', { class: 'ic-slot', html: icon('sleep') }), h('span', { class: 'nm' }, `${sleeping.length} sleeping tabs`), h('span', { class: 'bar' }), h('span', { class: 'mb' }, '0 MB')) : null),
    heavy ? h('div', { class: 'warn' }, h('span', { class: 'wi', html: icon('flame') }), h('div', {}, h('b', {}, `${heavy.t.title || hostOf(heavy.t.url)} is working hard`), h('small', {}, `${Math.round(heavy.cpu)}% CPU`)),
      h('button', { onclick: () => { unloadTab(heavy.t.id); v1ClosePop(); toast('Put to sleep', { icon: 'sleep', timeout: 1500 }); } }, 'Put to sleep')) : null,
    h('div', { class: 'bs' }, h('div', { class: 'bh', html: `${icon('battery')}<span>Battery saver</span>` }, sw),
      h('small', {}, V1H.bat ? (V1H.bat.charging ? `Plugged in · ${Math.round(V1H.bat.level * 100)}% — turns on by itself when you unplug` : `On battery · ${Math.round(V1H.bat.level * 100)}%`) : 'Turns on by itself when a laptop runs on battery'),
      h('ul', {}, h('li', {}, 'Background tabs sleep after 5 minutes'), h('li', {}, 'Fewer animations'), h('li', {}, 'Videos in background tabs pause'))));
  layer.append(panel);
  const b = $('#v1HealthBtn');
  const r = b ? b.getBoundingClientRect() : { left: 20, top: innerHeight - 40, width: 20 };
  panel.style.left = `${clamp(r.left - 20, 8, innerWidth - 460)}px`;
  panel.style.bottom = `${innerHeight - r.top + 10}px`;
}
function v1Flames() {
  document.querySelectorAll('#tabs .tab, #pinned .tab').forEach((row) => {
    const id = row.dataset.id;
    const hot = (V1H.cpu.get(id) || 0) > 25 && activeTab() && activeTab().id !== id;
    let f = row.querySelector('.v1-flame');
    if (hot && !f) { f = h('span', { class: 'v1-flame', title: 'Using a lot of CPU — Oto Health', html: icon('flame') }); row.querySelector('.title').after(f); }
    else if (!hot && f) f.remove();
    row.title = row.title.replace(/\n\d+ MB$/, '') + (V1H.mem.get(id) ? `\n${V1H.mem.get(id)} MB` : '');
  });
}
// Battery saver: on when the laptop is unplugged (or always / never, from the Health panel).
function v1ApplySaver() {
  const mode = S.settings.v1Saver || 'auto';
  V1H.saver = mode === 'on' || (mode === 'auto' && V1H.bat && !V1H.bat.charging);
  document.body.classList.toggle('v1-saver', V1H.saver);
  const pill = $('#v1Batt');
  if (pill) {
    const show = V1H.bat && !V1H.bat.charging;
    pill.hidden = !show;
    if (show) pill.innerHTML = `${icon('battery')}<span>${Math.round(V1H.bat.level * 100)}%${V1H.saver ? ' · Battery saver on' : ''}</span>`;
  }
}
function v1SaverTick() {
  if (!V1H.saver) return;
  const now = Date.now(), act = activeTab();
  for (const t of S.tabs) {
    const v = V.get(t.id);
    if (!v || (act && t.id === act.id) || v.audible || t.pinned) continue;
    if (now - (t.lastActive || now) > 5 * 60 * 1000) unloadTab(t.id);
    else wv(v, (w) => w.executeJavaScript('document.querySelectorAll("video").forEach(v=>{if(!v.paused&&!document.pictureInPictureElement)v.pause()})').catch(() => {}));
  }
}
function v1Board9() {
  const foot = document.querySelector('#sidebar .sb-foot');
  if (foot) {
    const b = h('button', { id: 'v1HealthBtn', class: 'icon-btn', title: 'Oto Health (Shift+Esc)', html: icon('pulse'), onclick: v1Health });
    const ver = $('#v1Ver');
    if (ver) ver.before(b); else foot.append(b);
  }
  const pill = h('div', { id: 'v1Batt', class: 'v1-batt nodrag', hidden: true, onclick: v1Health });
  $('#topstrip').append(pill);
  CMDS.health = () => (v1Pop ? v1ClosePop() : v1Health());
  ACTIONS.push({ name: 'Oto Health — memory & battery', kw: 'ram memory cpu task manager battery saver', icon: 'pulse', run: v1Health });
  setInterval(async () => { await v1Metrics(); v1Flames(); }, 20000);
  setInterval(v1SaverTick, 60000);
  if (navigator.getBattery) navigator.getBattery().then((b) => { V1H.bat = b; v1ApplySaver(); b.addEventListener('chargingchange', v1ApplySaver); b.addEventListener('levelchange', v1ApplySaver); }).catch(() => {});
  v1ApplySaver();
}

// ================================================================ 10 · Quick window + loading line
function v1Board10() {
  // Links from other apps (Oto as the default browser) open in a floating Glance window.
  oto.on('quick:open', (url) => {
    if (!url) return;
    if (S.settings.v1Quick === false || AVOCADO_MODE) routedOpen(url, { opener: activeTab() });
    else openGlance(url);
  });
}
const V1B = { quickSkip: null };

// ================================================================ 11 · privacy: clean links, cookie popups, dark sites
const V1_TRACK = /^(utm_[a-z]+|fbclid|gclid|gclsrc|dclid|msclkid|mc_eid|mc_cid|igshid|igsh|si|ref_src|ref_url|_hsenc|_hsmi|vero_id|yclid|twclid|wickedid|oly_enc_id|oly_anon_id|spm|scm|share_id|s_cid)$/i;
function v1CleanUrl(u) {
  try {
    const x = new URL(u);
    let n = 0;
    for (const k of [...x.searchParams.keys()]) if (V1_TRACK.test(k)) { x.searchParams.delete(k); n++; }
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(x.hostname) && x.searchParams.has('pp')) { x.searchParams.delete('pp'); n++; }
    return { url: n ? x.toString().replace(/\?$/, '') : u, removed: n };
  } catch { return { url: u, removed: 0 }; }
}
function v1CopyLink(u) {
  const c = S.settings.v1Clean === false ? { url: u, removed: 0 } : v1CleanUrl(u);
  oto.copy(c.url);
  toast(c.removed ? `Copied clean link · ${c.removed} tracker${c.removed === 1 ? '' : 's'} removed` : 'Link copied', { icon: 'copy', timeout: 1600 });
}
// Cookie popups: press "Reject all" for you, or hide the popup when there's only "Accept".
const V1_COOKIE_JS = `(() => { if (window.__otoCookie) return; window.__otoCookie = 1; let done = false, tries = 0;
  const sels = ['#onetrust-reject-all-handler', '#CybotCookiebotDialogBodyButtonDecline', '#didomi-notice-disagree-button', '.qc-cmp2-summary-buttons button[mode="secondary"]',
    'button[aria-label="Reject all"]', 'button[aria-label="Alle ablehnen"]', '[data-testid="uc-deny-all-button"]', '.cmpboxbtnno', '#truste-consent-required', '.fc-cta-do-not-consent', '#tarteaucitronAllDenied2', '.cc-deny', '.js-reject-cookies'];
  const words = /^(reject all|reject|decline all|decline|deny all|deny|only necessary|necessary only|use necessary cookies only|refuse all|alle ablehnen|tout refuser|rechazar todo|rifiuta tutto|απόρριψη όλων)$/i;
  const box = /cookie|consent|gdpr|cmp|privacy-banner|cc-window|onetrust|usercentrics|didomi/i;
  const hideSel = '#onetrust-banner-sdk, #onetrust-consent-sdk, #CybotCookiebotDialog, .qc-cmp2-container, #didomi-host, .cc-window, #usercentrics-root, .cmpbox, #truste-consent-track';
  const tick = () => { if (done || tries++ > 20) return;
    for (const s of sels) { const b = document.querySelector(s); if (b && b.offsetParent !== null) { b.click(); done = true; console.log('__oto_cookie__reject'); return; } }
    for (const b of document.querySelectorAll('button, a[role="button"], [role="button"]')) { const t = (b.innerText || '').trim(); if (t.length < 40 && words.test(t)) { let p = b, ok = false; for (let i = 0; i < 8 && p; i++, p = p.parentElement) { if (box.test((p.id || '') + ' ' + (p.className || ''))) { ok = true; break; } } if (ok) { b.click(); done = true; console.log('__oto_cookie__reject'); return; } } }
    const hb = document.querySelector(hideSel); if (hb && hb.offsetParent !== null) { const st = document.createElement('style'); st.textContent = hideSel + '{display:none!important} html,body{overflow:auto!important}'; document.documentElement.appendChild(st); done = true; console.log('__oto_cookie__hide'); return; }
    setTimeout(tick, tries < 6 ? 500 : 1500); };
  setTimeout(tick, 400); })()`;
const V1_DARK_CSS = 'html{filter:invert(.92) hue-rotate(180deg)!important;background:#fff!important} img,video,picture,canvas,iframe,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}';
const v1DarkOn = (url) => { const host = hostOf(url); return !!host && (S.settings.v1DarkAll === true ? !(S.v1Light || {})[host] : !!(S.v1Dark || {})[host]); };
function v1SetDark(host, on) {
  S.v1Dark = S.v1Dark || {}; S.v1Light = S.v1Light || {};
  if (S.settings.v1DarkAll) { if (on) delete S.v1Light[host]; else S.v1Light[host] = true; } else if (on) S.v1Dark[host] = true; else delete S.v1Dark[host];
  save();
  for (const t of S.tabs) if (hostOf(t.url) === host) { const v = V.get(t.id); if (v) v1ApplyDark(t, v); }
}
function v1ApplyDark(t, v) {
  const on = v1DarkOn(t.url);
  wv(v, (w) => {
    if (on && !v.v1DarkKey) w.insertCSS(V1_DARK_CSS).then((k) => { v.v1DarkKey = k; }).catch(() => {});
    else if (!on && v.v1DarkKey) { w.removeInsertedCSS(v.v1DarkKey).catch(() => {}); v.v1DarkKey = null; }
  });
}

// ================================================================ 12 · backup, space templates, video tools, search inside tabs, secrets
const V1_TEMPLATES = [
  { name: 'Gaming', icon: 'game', emoji: '🎮', colors: ['#22c55e', '#0ea5e9'], note: 'Green → blue' },
  { name: 'School', icon: 'book', emoji: '📚', colors: ['#f59e0b', '#ef4444'], note: 'Warm colours' },
  { name: 'Work', icon: 'briefcase', emoji: '💼', colors: ['#334155', '#6366f1'], note: 'Calm and dark' },
  { name: 'Music', icon: 'music', emoji: '🎵', colors: ['#ec4899', '#8b5cf6'], note: 'Pink → purple' },
];
function v1NewSpaceFrom(tpl) {
  const ws = { id: uid(), name: tpl.name, emoji: tpl.emoji, image: '', color: tpl.colors[0], colors: [...tpl.colors], intensity: 0.8, grain: 0.15 };
  S.workspaces.push(ws); save();
  switchWorkspace(ws.id);
  toast(`New space: ${tpl.name}`, { icon: 'plus', timeout: 1800 });
}
function v1TemplateMenu(x, y) {
  showMenu(x, y, [{ header: 'New space from a template' }, ...V1_TEMPLATES.map((t) => ({ label: `${t.name} — ${t.note}`, icon: t.icon, run: () => v1NewSpaceFrom(t) })), '-', { label: 'Blank space…', icon: 'plus', run: () => openWsDialog() }]);
}

function v1BackupSection() {
  const status = h('small', { class: 'v1-bkst' }, 'Spaces, tabs, Essentials, bookmarks, settings, themes, Oto Card, boosts and history.');
  const pass = h('input', { class: 'lib-input', type: 'password', placeholder: 'Backup password (optional, for passwords)', style: 'width:250px' });
  return section('Backup & restore',
    row('Back up Oto', status, h('div', { style: 'display:flex;gap:6px;align-items:center' }, pass, h('button', { class: 'btn primary', onclick: async () => {
      const r = await oto.backupSave(persistable(), pass.value || null);
      if (r && r.ok) { status.textContent = `Saved ${r.path.split(/[\\/]/).pop()} (${v1Mb(r.size / 1048576)})${r.passwords ? ` with ${r.passwords} passwords` : ''}`; toast('Backup saved', { icon: 'check', timeout: 1800 }); }
    } }, 'Save backup'))),
    row('Restore from a backup', 'Replaces your spaces, tabs and settings with the ones in the file, then restarts Oto.', h('button', { class: 'btn', onclick: v1RestoreFlow }, 'Restore…')));
}
async function v1RestoreFlow() {
  const info = await oto.backupOpen();
  if (!info || !info.ok) { if (info && info.error) toast(info.error, { timeout: 2600 }); return; }
  const when = info.created ? new Date(info.created).toLocaleString() : 'unknown date';
  if (!confirm(`Restore this backup from ${when}?\n\n${info.spaces} spaces · ${info.tabs} tabs · ${info.bookmarks} bookmarks${info.passwords ? ` · ${info.passwords} passwords` : ''}\n\nYour current spaces, tabs and settings will be replaced and Oto restarts.`)) return;
  let pass = null;
  if (info.passwords) {
    pass = await v1AskText('Backup password', 'Type the password you chose when you made this backup to bring back your saved passwords. Leave it empty to skip them.', true);
  }
  const r = await oto.backupRestore(pass);
  if (!r || !r.ok) toast((r && r.error) || 'Couldn’t restore', { timeout: 2600 });
  else toast(`Restored${r.passwords ? ` with ${r.passwords} passwords` : ''} — restarting…`, { icon: 'check', timeout: 3000 });
}
function v1AskText(title, sub, secret = false) {
  return new Promise((resolve) => {
    const inp = h('input', { class: 'lib-input', type: secret ? 'password' : 'text', style: 'width:100%;margin:12px 0' });
    const done = (v) => { layer.remove(); resolve(v); };
    const layer = h('div', { class: 'v1-ask' }, h('div', { class: 'v1-pop', style: 'position:static;width:380px;padding:18px' },
      h('b', { style: 'font-size:15px' }, title), h('p', { style: 'color:var(--fg-2);margin:6px 0 0' }, sub), inp,
      h('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, h('button', { class: 'btn', onclick: () => done(null) }, 'Skip'), h('button', { class: 'btn primary', onclick: () => done(inp.value) }, 'OK'))));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(inp.value); if (e.key === 'Escape') done(null); });
    document.body.append(layer);
    setTimeout(() => inp.focus(), 30);
  });
}

// Video tools: speed, loop, screenshot and picture-in-picture on any video (shown on hover).
const V1_VIDEO_JS = `(() => { if (window.__otoVid) return; window.__otoVid = 1;
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;z-index:2147483646;display:none;pointer-events:auto';
  const sh = host.attachShadow({ mode: 'closed' });
  sh.innerHTML = '<style>.b{display:flex;gap:3px;align-items:center;padding:4px;border-radius:12px;background:rgba(15,12,24,.82);font:600 12px system-ui,sans-serif;color:#eee;box-shadow:0 8px 20px rgba(0,0,0,.4)}button{all:unset;cursor:pointer;height:26px;min-width:26px;padding:0 7px;border-radius:8px;display:grid;place-items:center}button:hover{background:rgba(255,255,255,.14)}button.on{background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff}i{width:1px;height:16px;background:rgba(255,255,255,.2)}svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}</style><div class="b"><button data-s="1">1×</button><button data-s="1.5">1.5×</button><button data-s="2">2×</button><i></i><button data-a="loop" title="Loop"><svg viewBox="0 0 24 24"><path d="M17 4l3 3-3 3M4 11V9.5A2.5 2.5 0 0 1 6.5 7H20M7 20l-3-3 3-3M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H4"/></svg></button><button data-a="shot" title="Screenshot"><svg viewBox="0 0 24 24"><path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/></svg></button><button data-a="pip" title="Picture in picture"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="12" y="11.5" width="6.5" height="5" rx="1.2"/></svg></button></div>';
  document.documentElement.appendChild(host);
  let cur = null, hideT = 0;
  const paint = () => { if (!cur) return; sh.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', Math.abs(cur.playbackRate - +b.dataset.s) < .01)); sh.querySelector('[data-a=loop]').classList.toggle('on', cur.loop); };
  const place = (v) => { const r = v.getBoundingClientRect(); if (r.width < 220 || r.height < 120) { host.style.display = 'none'; return; } host.style.display = 'block'; host.style.top = Math.max(4, r.top + 10) + 'px'; host.style.left = Math.min(innerWidth - 270, r.right - 262) + 'px'; };
  document.addEventListener('mousemove', (e) => { const v = [...document.querySelectorAll('video')].find(v => { const r = v.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
    if (v) { cur = v; place(v); paint(); clearTimeout(hideT); hideT = setTimeout(() => { if (!host.matches(':hover')) host.style.display = 'none'; }, 2500); }
    else if (!host.contains(e.target) && e.target !== host) { clearTimeout(hideT); hideT = setTimeout(() => { if (!host.matches(':hover')) host.style.display = 'none'; }, 400); } }, { passive: true });
  sh.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || !cur) return; e.stopPropagation();
    if (b.dataset.s) cur.playbackRate = +b.dataset.s;
    if (b.dataset.a === 'loop') cur.loop = !cur.loop;
    if (b.dataset.a === 'pip') { if (document.pictureInPictureElement) document.exitPictureInPicture(); else cur.requestPictureInPicture().catch(() => {}); }
    if (b.dataset.a === 'shot') { const r = cur.getBoundingClientRect(); host.style.display = 'none'; setTimeout(() => console.log('__oto_vshot__' + JSON.stringify({ x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(r.width, innerWidth), h: Math.min(r.height, innerHeight) })), 60); }
    paint(); }); })()`;

async function v1ShotRect(v, rect) {
  try {
    const img = await v.wv.capturePage({ x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.w), height: Math.round(rect.h) });
    const url = img.toDataURL();
    await oto.copyImage(url);
    toast('Screenshot copied', { icon: 'check', timeout: 1600 });
    return url;
  } catch { toast('Couldn’t take a screenshot here', { timeout: 1800 }); return null; }
}

// Search inside your open tabs (words on the page, not just titles).
const V1T = { seq: 0, hits: [], q: '' };
async function v1SearchTabs(q) {
  const seq = ++V1T.seq;
  V1T.q = q; V1T.hits = [];
  if (q.length < 3 || /^\//.test(q)) return;
  const needle = q.toLowerCase();
  const jobs = S.tabs.filter((t) => V.has(t.id)).slice(0, 20).map(async (t) => {
    const v = V.get(t.id);
    try {
      const snip = await v.wv.executeJavaScript(`(() => { const t = (document.body && document.body.innerText || '').replace(/\\s+/g, ' '); const i = t.toLowerCase().indexOf(${JSON.stringify(needle)}); return i < 0 ? null : t.slice(Math.max(0, i - 40), i + ${needle.length} + 60); })()`);
      if (snip) V1T.hits.push({ t, snip });
    } catch {}
  });
  await Promise.all(jobs);
  if (seq !== V1T.seq || !C.open) return;
  const sel = C.sel;
  computeItems();
  C.sel = Math.min(sel, C.items.length - 1);
  paintSel();
}

function v1GlitchArt(W, H, id) {
  let out = `<defs><filter id="${id}g"><feTurbulence baseFrequency=".02 .4" numOctaves="1" seed="3"/><feDisplacementMap in="SourceGraphic" scale="14"/></filter></defs>`;
  for (let i = 0; i < 14; i++) out += `<rect x="0" y="${(i * H) / 14}" width="${W}" height="${H / 30}" fill="rgba(255,255,255,${0.04 + (i % 3) * 0.05})"/>`;
  out += `<g filter="url(#${id}g)"><rect x="${-W * 0.1}" y="${H * 0.38}" width="${W * 1.2}" height="${H * 0.1}" fill="rgba(236,72,153,.65)" transform="skewY(-8)"/><rect x="${-W * 0.05}" y="${H * 0.55}" width="${W * 1.2}" height="${H * 0.035}" fill="rgba(34,211,238,.8)" transform="skewY(-8)"/></g>`;
  out += `<text x="${W * 0.08}" y="${H * 0.9}" font-family="ui-monospace,Consolas,monospace" font-weight="700" font-size="${H * 0.1}" fill="#fff" style="paint-order:stroke" stroke="rgba(236,72,153,.6)" stroke-width="2">GL1TCH</text>`;
  return out;
}

function v1Board11() {
  if (typeof copyUrl === 'function') copyUrl = function () { const t = activeTab(); if (t) v1CopyLink(t.url); };
  const _ctx = v1PageMenu;
  v1PageMenu = function (c) {
    _ctx.apply(this, arguments);
    const m = document.querySelector('.v1-menu');
    if (!m) return;
    m.querySelectorAll('.mi').forEach((b) => {
      const label = (b.querySelector('.ml') || {}).textContent;
      if (label === 'Copy link' && c.linkURL) { const nb = b.cloneNode(true); nb.onclick = () => { v1ClosePop(); v1CopyLink(c.linkURL); }; b.replaceWith(nb); }
      if (label === 'Copy page address') { const nb = b.cloneNode(true); nb.onclick = () => { v1ClosePop(); v1CopyLink(c.pageURL); }; b.replaceWith(nb); }
    });
  };
  // site panel: a "Dark page" switch
  const _site = v1SitePanel;
  v1SitePanel = async function () {
    await _site.apply(this, arguments);
    const panel = document.querySelector('.v1-site');
    const t = activeTab();
    if (!panel || !t) return;
    const host = hostOf(t.url);
    const on = v1DarkOn(t.url);
    const sw = h('button', { class: `switch${on ? ' on' : ''}`, role: 'switch', onclick: () => { const n = !sw.classList.contains('on'); sw.classList.toggle('on', n); v1SetDark(host, n); } });
    const sec = panel.querySelectorAll('.sec')[0];
    if (sec) sec.append(h('div', { class: 'v1-prow' }, iconEl('moon'), h('span', { class: 'l' }, 'Dark page'), sw));
    const ck = (S.stats && S.stats.cookies) || 0;
    const stat = panel.querySelector('.stat');
    if (stat && ck) stat.append(h('div', {}, h('b', {}, String(ck)), h('small', {}, 'cookie popups handled')));
  };
}

function v1Board12() {
  ACTIONS.push(
    { name: 'New space from a template', kw: 'gaming school work music space', icon: 'plus', run: () => v1TemplateMenu(innerWidth / 2 - 120, 140) },
    { name: 'Back up Oto', kw: 'backup export save restore new pc', icon: 'download', run: () => openSettings('general') },
    { name: 'Open an Avocado window', kw: 'private incognito avocado', icon: 'eyeoff', run: () => oto.openAvocado() },
  );
  // space templates on the "+" / right-click of the New Tab button area
  $('#wsTitle').addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); v1TemplateMenu(e.clientX, e.clientY); });
  // secret card art
  const _art = cardArt;
  cardArt = function (m, cols, W, H, id) { return m.art === 'glitch' ? v1GlitchArt(W, H, id) : _art.apply(this, arguments); };
  if ((S.v1Secrets || []).includes('glitch')) CARD_ART.glitch = 'Glitch ★';
  // command bar: search inside tabs + /otooto
  const _compute = computeItems;
  computeItems = function () {
    const q = $('#cmdInput').value.trim();
    if (q.toLowerCase() === '/otooto') {
      C.items = [{ g: 'Commands', icon: 'star', t: '/otooto', s: '…what does this do?', hint: 'Run', run: () => {
        closeCmd(false);
        S.v1Secrets = [...new Set([...(S.v1Secrets || []), 'glitch'])]; CARD_ART.glitch = 'Glitch ★';
        if (S.card) S.card.art = 'glitch';
        save(); openLibrary('card'); toast('SECRET UNLOCKED — a rare Glitch card art 🤫', { icon: 'star', timeout: 3500 });
      } }];
      C.sel = 0; renderCmd(); return;
    }
    _compute.apply(this, arguments);
    if (q.length >= 3 && V1T.q === q && V1T.hits.length && !q.startsWith('/') && (V1C.f === 'all' || V1C.f === 'tabs')) {
      const items = V1T.hits.slice(0, 4).map(({ t, snip }) => ({ g: 'Inside tabs', tab: t, t: t.title || prettyUrl(t.url), s: `…${snip}…`, hint: 'Show', run: () => {
        closeCmd(false); activate(t.id);
        setTimeout(() => { const v = V.get(t.id); if (v) wv(v, (w) => w.findInPage(q)); }, 250);
      } }));
      const at = C.items.findIndex((it) => it.g !== '' && it.g !== 'Quick answer' && it.g !== 'Tabs' && it.g !== 'Open tabs');
      C.items.splice(at < 0 ? C.items.length : at, 0, ...items);
      renderCmd();
    }
  };
  let tabT = 0;
  $('#cmdInput').addEventListener('input', () => { clearTimeout(tabT); const q = $('#cmdInput').value.trim(); tabT = setTimeout(() => v1SearchTabs(q), 260); });
  // general settings: backup section
  const _render = renderSettings;
  renderSettings = function () {
    _render.apply(this, arguments);
    const pane = document.querySelector('.set-pane');
    if (pane && settingsTab === 'general' && !V1S.q && !AVOCADO_MODE) pane.append(v1BackupSection());
  };
}

// page hooks for 11 + 12: cookie popups, dark sites, video tools, screenshots
function v1PageHooks() {
  const _bind = bindView;
  bindView = function (tab, v) {
    _bind.apply(this, arguments);
    const el = v.wv;
    el.addEventListener('dom-ready', () => {
      v.v1DarkKey = null;
      v1ApplyDark(tab, v);
      if (S.settings.v1Cookies !== false) el.executeJavaScript(V1_COOKIE_JS).catch(() => {});
      if (S.settings.v1Video !== false) el.executeJavaScript(V1_VIDEO_JS).catch(() => {});
    });
    el.addEventListener('console-message', (e) => {
      const m = e.message || '';
      if (m.startsWith('__oto_cookie__')) { bumpStat('cookies'); }
      if (m.startsWith('__oto_vshot__')) { try { v1ShotRect(v, JSON.parse(m.slice(13))); } catch {} }
    });
  };
}

// ================================================================ 13 · Oto Night
// Off / On / Follow Windows / After sunset (19:00–07:00). "On" is Oto's dark theme with deeper space colours.
function v1NightTick() {
  if (S.settings.v1Night !== 'sunset') return;
  const hr = new Date().getHours();
  const want = hr >= 19 || hr < 7 ? 'dark' : 'light';
  if (S.settings.theme !== want) setTheme(want);
}
function v1NightMode() {
  const m = S.settings.v1Night;
  if (m === 'sunset') return 'sunset';
  return S.settings.theme === 'dark' ? 'on' : S.settings.theme === 'system' ? 'windows' : 'off';
}
function v1SetNight(m) {
  S.settings.v1Night = m === 'sunset' ? 'sunset' : '';
  if (m === 'on') setTheme('dark'); else if (m === 'off') setTheme('light'); else if (m === 'windows') setTheme('system'); else v1NightTick();
  save();
}
function v1Board13() {
  setInterval(v1NightTick, 5 * 60 * 1000);
  v1NightTick();
  const _render = renderSettings;
  renderSettings = function () {
    _render.apply(this, arguments);
    const pane = document.querySelector('.set-pane');
    if (!pane || settingsTab !== 'appearance' || V1S.q) return;
    const sec = section('Oto Night', row('Dark mode', 'Deep space colours, light text and a dark new tab — easy on the eyes at night.',
      seg([['off', 'Off'], ['on', 'On'], ['windows', 'Follow Windows'], ['sunset', 'After sunset']], v1NightMode(), (v) => v1SetNight(v))));
    const first = pane.querySelector('.set-section');
    if (first) first.after(sec); else pane.append(sec);
  };
  ACTIONS.push({ name: 'Oto Night', kw: 'dark night mode sunset', icon: 'moon', run: () => v1SetNight(v1NightMode() === 'on' ? 'off' : 'on') });
}

// ================================================================ 14 · space overview (Ctrl+Shift+Space)
const V1O = { open: false, q: '', drag: null };
function v1Overview() {
  if (V1O.open) return v1CloseOverview();
  V1O.open = true; V1O.q = '';
  const layer = h('div', { id: 'v1Ov', class: 'v1-ov' });
  const search = h('input', { placeholder: 'Find a tab in any space…', spellcheck: 'false' });
  const grid = h('div', { class: 'grid' });
  const paint = () => {
    const ws = words(V1O.q);
    grid.replaceChildren(...S.workspaces.map((w, i) => {
      const th = themeOf(w);
      const tabs = S.tabs.filter((t) => !t.essential && t.ws === w.id);
      const shown = ws.length ? tabs.filter((t) => matchAll(`${t.title} ${t.url}`, ws)) : tabs;
      const mem = tabs.reduce((a, t) => a + (V.has(t.id) ? (V1H.mem.get(t.id) || 0) : 0), 0);
      const card = h('div', { class: `spc${w.id === S.activeWs ? ' cur' : ''}`, style: `background:linear-gradient(135deg, ${th.colors.join(', ')})` },
        h('div', { class: 'sh' }, (() => { const d = h('span', { class: 'ws-dot' }); paintWsIcon(d, w); return d; })(), h('b', {}, w.name), h('kbd', {}, String(i + 1))),
        h('div', { class: 'tl' }, ...shown.slice(0, 6).map((t) => {
          const row2 = h('div', { class: `ot${V.has(t.id) ? '' : ' slp'}`, draggable: 'true', title: t.url, onclick: (e) => { e.stopPropagation(); v1CloseOverview(); switchWorkspace(w.id); activate(t.id); } }, favEl(t, null, true), h('span', {}, t.title || prettyUrl(t.url)));
          row2.addEventListener('dragstart', (e) => { V1O.drag = t.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.url); row2.classList.add('dragging'); });
          row2.addEventListener('dragend', () => { V1O.drag = null; paint(); });
          return row2;
        }), shown.length > 6 ? h('div', { class: 'more' }, `+${shown.length - 6} more`) : null, !tabs.length ? h('div', { class: 'more' }, 'No tabs') : null),
        h('div', { class: 'ft' }, h('span', {}, `${tabs.length} tab${tabs.length === 1 ? '' : 's'}`), h('span', {}, mem ? v1Mb(mem) : tabs.length ? 'asleep' : '')));
      card.addEventListener('click', () => { v1CloseOverview(); switchWorkspace(w.id); });
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); v1CloseOverview(); wsMenu(w, e.clientX, e.clientY); });
      card.addEventListener('dragover', (e) => { if (V1O.drag) { e.preventDefault(); card.classList.add('drop'); } });
      card.addEventListener('dragleave', () => card.classList.remove('drop'));
      card.addEventListener('drop', (e) => {
        e.preventDefault(); card.classList.remove('drop');
        const t = tabById(V1O.drag);
        if (!t || t.ws === w.id) return;
        if (S.active[t.ws] === t.id) delete S.active[t.ws];
        if (t.id === (activeTab() || {}).id) { delete S.active[S.activeWs]; showNothing(); }
        t.ws = w.id; t.essential = false; t.pinned = false;
        save(); render(); paint();
        toast(`Moved to ${w.name}`, { icon: 'layers', timeout: 1500 });
      });
      return card;
    }), h('button', { class: 'spc new', onclick: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); v1CloseOverview(); v1TemplateMenu(r.left + 20, r.top + 20); } },
      h('span', { class: 'big', html: icon('plus') }), h('b', {}, 'New space'), h('small', {}, 'from a template or blank')));
  };
  search.addEventListener('input', () => { V1O.q = search.value.trim(); paint(); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); v1CloseOverview(); }
    if (/^[1-9]$/.test(e.key) && !search.value) { e.preventDefault(); const w = S.workspaces[+e.key - 1]; if (w) { v1CloseOverview(); switchWorkspace(w.id); } }
    if (e.key === 'Enter') { const first = grid.querySelector('.ot'); if (first) first.click(); }
  });
  layer.append(h('div', { class: 'top' }, h('label', { class: 'srch', html: icon('search') }, search)), grid,
    h('div', { class: 'foot', html: '<span><kbd>Ctrl Shift Space</kbd> open / close</span><span><kbd>1</kbd>…<kbd>9</kbd> jump to a space</span><span>Drag tabs between spaces</span><span>Right-click a space to edit it</span>' }));
  layer.addEventListener('mousedown', (e) => { if (e.target === layer || e.target === grid) v1CloseOverview(); });
  document.body.append(layer);
  paint();
  setTimeout(() => search.focus(), 30);
}
function v1CloseOverview() { V1O.open = false; const l = $('#v1Ov'); if (l) l.remove(); }
function v1Board14() {
  CMDS.overview = v1Overview;
  ACTIONS.push({ name: 'Space overview', kw: 'all spaces grid mission', icon: 'grid', run: v1Overview });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && V1O.open) { e.stopPropagation(); v1CloseOverview(); } }, true);
  $('#wsTitle').addEventListener('dblclick', (e) => { e.preventDefault(); v1Overview(); });
}

// ================================================================ 15 · Avocado (private window)
function v1AvocadoInit() {
  if (!AVOCADO_MODE) return;
  document.body.classList.add('avocado');
  document.title = 'Avocado — Oto';
  const ws = { id: 'avocado', name: 'Avocado', emoji: '🥑', image: '', color: '#65a30d', colors: ['#1d3310', '#0e110b'], intensity: 0.9, grain: 0.2 };
  S.workspaces = [ws]; S.activeWs = ws.id; S.tabs = []; S.active = {}; S.history = []; S.archive = []; S.splits = {};
  S.onboarded = true; S.lastSeenVersion = INFO.version;
  save = function () {};
  addHistory = function () {};
  S.settings.skin = 'oto';
  setTimeout(() => applyTheme(), 0);
  // the Avocado new tab
  const inner = document.querySelector('#empty .empty-inner');
  if (inner) {
    inner.prepend(h('div', { class: 'avo-hero' },
      h('div', { class: 'avo-ic', html: '<svg viewBox="0 0 62 74" width="56" height="66"><path d="M31 2C21 2 16 12 13.5 21 10 30 3 36 3 48c0 14 12 24 28 24s28-10 28-24C59 36 52 30 48.5 21 46 12 41 2 31 2z" fill="#1e3a0e"/><path d="M31 7c-7.5 0-11.5 8-13.5 15.5C14.5 31 8 36.5 8 47.5 8 59 18 67 31 67s23-8 23-19.5C54 36.5 47.5 31 44.5 22.5 42.5 15 38.5 7 31 7z" fill="#d9f99d"/><path d="M31 12c-6 0-9 6.5-10.5 12.5C18 32 13 37 13 47c0 9 8 15.5 18 15.5S49 56 49 47c0-10-5-15-7.5-22.5C40 18.5 37 12 31 12z" fill="#bef264"/><circle cx="31" cy="46" r="11.5" fill="#92400e"/><circle cx="27.5" cy="42.5" r="3.5" fill="#c2702f" opacity=".8"/></svg>' }),
      h('h2', {}, 'You’re in Avocado'),
      h('p', {}, 'Close this window and Oto forgets everything you did here. Like an avocado, it keeps the secret inside. 🥑'),
      h('div', { class: 'avo-two' },
        h('div', { class: 'g' }, h('b', {}, 'FORGOTTEN'), h('span', {}, '✓ History and searches'), h('span', {}, '✓ Cookies and logins'), h('span', {}, '✓ What you typed in forms')),
        h('div', { class: 'r' }, h('b', {}, 'STILL VISIBLE TO'), h('span', {}, '• Sites you log in to'), h('span', {}, '• Your school or work network'), h('span', {}, '• Files you download (kept)')))));
  }
  const foot = document.querySelector('#sidebar .sb-foot');
  if (foot) foot.after(h('button', { class: 'avo-forget', onclick: () => oto.winClose(), html: `${icon('flame')}<span>Close &amp; forget</span>` }));
  const head = $('#sbWsRow');
  if (head) head.append(h('span', { class: 'avo-badge', html: `${icon('avo')}<b>Avocado</b><small>NOTHING SAVED</small>` }));
}
function v1Board15() {
  CMDS.avocado = () => oto.openAvocado();
  v1AvocadoInit();
}

// ================================================================ 16 · Oto Apps + Send to phone
async function v1InstallApp(t) {
  if (!t) return;
  let u; try { u = new URL(t.url); } catch { return; }
  if (!/^https?:$/.test(u.protocol)) return toast('Only websites can be installed as apps', { timeout: 1800 });
  const name = (t.title || u.hostname).split(/ [-–|•·] /)[0].slice(0, 40);
  if (!confirm(`Install “${name}” as an app?\n\n• Its own window, no sidebar\n• Its own icon in the Start menu and taskbar\n• Links to other sites open back in Oto`)) return;
  let icon64 = '';
  try { if (t.favicon) icon64 = await v1ImgToDataUrl(t.favicon); } catch {}
  const r = await oto.installApp(u.origin + '/', name, icon64);
  S.v1Apps = (S.v1Apps || []).filter((a) => a.origin !== u.origin).concat({ origin: u.origin, name, favicon: t.favicon || '' });
  save();
  toast(r && r.shortcut ? `${name} installed — find it in the Start menu` : `${name} opened as an app`, { icon: 'check', timeout: 2600 });
}
function v1ImgToDataUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 256, 256); resolve(c.toDataURL('image/png')); } catch { resolve(''); } };
    img.onerror = () => resolve('');
    img.src = src;
  });
}
async function v1SendToPhone(url) {
  if (!url) return;
  v1ClosePop();
  const svg = await oto.qrSvg(url);
  const layer = v1Layer(v1ClosePop); v1Pop = layer;
  const box = h('div', { class: 'v1-pop v1-qr' },
    h('b', {}, 'Send to your phone'), h('small', {}, 'Scan with your phone’s camera'),
    h('div', { class: 'qbox', html: svg || '' }, h('span', { class: 'lg', html: logoSvg() })),
    h('div', { class: 'u' }, prettyUrl(url)),
    h('div', { class: 'row3' }, h('button', { onclick: () => v1CopyLink(url), html: `${icon('copy')}<span>Copy link</span>` })));
  layer.append(box);
  box.style.left = `${innerWidth / 2 - 170}px`; box.style.top = `${Math.max(60, innerHeight / 2 - 230)}px`;
}
function v1Board16() {
  ACTIONS.push(
    { name: 'Install this site as an app', kw: 'app pwa window taskbar start menu', icon: 'tab', run: () => v1InstallApp(activeTab()) },
    { name: 'Send this page to my phone', kw: 'qr code phone mobile share', icon: 'phone', run: () => { const t = activeTab(); if (t) v1SendToPhone(t.url); } },
  );
  // apps in the command bar
  const _compute = computeItems;
  computeItems = function () {
    _compute.apply(this, arguments);
    const q = $('#cmdInput').value.trim();
    if (!q || q.startsWith('/')) return;
    const ws = words(q);
    const apps = (S.v1Apps || []).filter((a) => matchAll(`${a.name} ${a.origin} app`, ws));
    if (!apps.length || (V1C.f !== 'all' && V1C.f !== 'actions')) return;
    C.items.push(...apps.map((a) => ({ g: 'Apps', hist: { u: a.origin, t: a.name }, t: a.name, s: 'Oto app', hint: 'Open', run: () => { closeCmd(false); oto.openApp(`${a.origin}/`); } })));
    renderCmd();
  };
  // site panel + right-click menu entries
  const _site = v1SitePanel;
  v1SitePanel = async function () {
    await _site.apply(this, arguments);
    const panel = document.querySelector('.v1-site');
    const t = activeTab();
    if (!panel || !t) return;
    const secs = panel.querySelectorAll('.sec');
    const last = secs[secs.length - 1];
    if (last) last.prepend(
      h('button', { class: 'v1-prow', onclick: () => { v1ClosePop(); v1SendToPhone(t.url); } }, iconEl('phone'), h('span', { class: 'l' }, 'Send to phone')),
      h('button', { class: 'v1-prow', onclick: () => { v1ClosePop(); v1InstallApp(t); } }, iconEl('tab'), h('span', { class: 'l' }, 'Install as app')));
  };
  const _menu = v1PageMenu;
  v1PageMenu = function (c) {
    _menu.apply(this, arguments);
    const m = document.querySelector('.v1-menu');
    if (!m || c.isEditable) return;
    const url = c.linkURL || c.pageURL;
    const insp = [...m.querySelectorAll('.mi')].find((b) => (b.querySelector('.ml') || {}).textContent === 'Inspect');
    const b = h('button', { class: 'mi', onclick: () => { v1ClosePop(); v1SendToPhone(url); } }, iconEl('phone'), h('span', { class: 'ml' }, c.linkURL ? 'Send link to phone' : 'Send page to phone'));
    if (insp) insp.before(b, h('div', { class: 'msep' })); else m.append(b);
  };
}

// ================================================================ Alpha 2 init
function initV1b() {
  Object.assign(ICONS, V1B_ICONS);
  if (typeof COMMANDS !== 'undefined') COMMANDS.push(['health', 'Oto Health', ['Shift+Escape']], ['overview', 'Space overview', ['Ctrl+Shift+ ']], ['avocado', 'New Avocado window', ['Ctrl+Shift+N']], ['screenshot', 'Screenshot', ['Ctrl+Shift+X']]);
  v1PageHooks();
  for (const f of [v1Board9, v1Board10, v1Board11, v1Board12, v1Board13, v1Board14, v1Board15, v1Board16]) { try { f(); } catch (e) { console.error('v1b', f.name, e); } }
}
