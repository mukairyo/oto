// Oto — the Library remade in the space look (1.8.3, from the approved design). While the space look is on
// (body.space-home), every Library page gets the wide glass sidebar (name + count per page, storage line), a header
// (LIBRARY / PAGE, big serif title, one line, the glowing search), and History and Downloads are redrawn:
// History as a timeline of days with a week chart and the most-visited sites; Downloads as a big ring card for what's
// downloading and file cards for what landed. Without the space look the Library is exactly as before.
/* global S, LIB, LIB_PAGES, LIB_RENDER, DL_LIVE, renderLibrary, closeLibrary, dlList, dlSub, fmtBytes, fmtWhen,
   groupByDay, libRow, libBtn, libEmpty, matchQ, favEl, hostOf, prettyUrl, newTab, save, oto, openDownload, renderDlCard,
   v1Level, h, $, icon, esc, SPACE_STAR, media, V */

const SLIB = { hf: 'all' };
const SLIB_DESC = {
  downloads: 'Everything you saved, caught as it lands.',
  history: "Everywhere you've been, day by day.",
  passwords: 'Your saved sign-ins, locked to this PC.',
  media: 'Tabs playing music or video, with controls.',
  spaces: 'Your spaces, each with its own tabs and look.',
  boosts: 'Your own touches on the sites you use.',
  routing: 'Which space each site opens in.',
  card: 'Your card, your level, your badges.',
  phone: 'Oto on your phone.',
};
const slibOn = () => document.body.classList.contains('space-home');
const slibStar = (fill = '#E8F9FF', size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SPACE_STAR}" fill="${fill}"/></svg>`;
const SLIB_DOTS = ['#f87171', '#fbbf24', '#bef264', '#3ecf8e', '#7FE3FF', '#a78bfa', '#f9a8d4', '#e5e7eb'];
const slibDot = (s) => { let n = 0; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return SLIB_DOTS[n % SLIB_DOTS.length]; };
const slibTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function slibCounts() {
  const n = (x) => (x ? Number(x).toLocaleString() : '');
  let lv = '';
  try { lv = `LV ${v1Level().i + 1}`; } catch { /* no card yet */ }
  const playing = (S.tabs || []).filter((t) => { const v = V.get(t.id); return v && (v.audible || (media && media.tabId === t.id)); }).length;
  return {
    downloads: n(dlList().length), history: n((S.history || []).length), passwords: '', media: n(playing),
    spaces: n((S.workspaces || []).length), boosts: n((S.boosts || []).length), routing: n((S.routes || []).length), card: lv, phone: '',
  };
}

// the frame: sidebar, header
function slibDecorate() {
  const root = $('#library');
  if (!root) return;
  root.classList.toggle('space-lib', slibOn());
  if (!slibOn()) return;
  const nav = root.querySelector('.lib-nav');
  if (nav) {
    if (!nav.querySelector('.sl-brand')) nav.prepend(h('div', { class: 'sl-brand', 'aria-hidden': 'true' }, h('span', {}, '音'), ' OTO // LIBRARY'));
    const counts = slibCounts();
    nav.querySelectorAll(':scope > button').forEach((b, i) => {
      const k = LIB_PAGES[i] && LIB_PAGES[i][0];
      if (k && !b.querySelector('.sl-n')) b.append(h('span', { class: 'sl-n' }, counts[k] || ''));
    });
    const foot = nav.querySelector('.lib-nav-foot');
    if (foot && !foot.querySelector('.sl-store')) {
      const bytes = dlList().filter((r) => r.state === 'completed' && !r.missing).reduce((a, r) => a + (r.total || r.received || 0), 0);
      foot.prepend(h('div', { class: 'sl-store' }, h('span', { class: 'k' }, 'ON THIS PC'), h('span', {}, `${fmtBytes(bytes)} of downloads`)));
    }
  }
  const head = root.querySelector('.lib-head');
  if (head && !head.querySelector('.sl-top')) {
    const page = LIB_PAGES.find((p) => p[0] === LIB.page) || ['', ''];
    const extra = SLIB_EXTRA[LIB.page] ? SLIB_EXTRA[LIB.page]() : null;
    head.prepend(h('div', { class: 'sl-top' },
      h('div', { class: 'sl-title' }, h('div', { class: 'sl-crumb' }, 'LIBRARY ', h('i', {}, '/'), ` ${page[1].toUpperCase()}`), h('h1', {}, page[1]), h('p', {}, SLIB_DESC[LIB.page] || '')),
      extra));
    const h2 = head.querySelector(':scope > h2');
    if (h2) h2.remove();
    const sw = head.querySelector('.lib-search-wrap');
    if (sw && !sw.dataset.star) { sw.dataset.star = '1'; const ic = sw.querySelector('span'); if (ic) ic.innerHTML = slibStar('#E8F9FF', 15); sw.append(h('kbd', {}, 'CTRL F')); }
  }
}

// things on the right of a page's title
const SLIB_EXTRA = {
  history: () => ((S.history || []).length ? h('button', { class: 'btn sl-clear', onclick: () => { if (!confirm('Clear all browsing history?')) return; S.history = []; save(); renderLibrary(); } }, h('span', { html: icon('trash') }), 'Clear history') : null),
  downloads: () => {
    const all = dlList(), bytes = all.filter((r) => r.state === 'completed' && !r.missing).reduce((a, r) => a + (r.total || r.received || 0), 0);
    return h('div', { class: 'sl-stats' }, h('span', {}, h('b', {}, all.length.toLocaleString()), all.length === 1 ? 'FILE' : 'FILES'), h('span', {}, h('b', {}, fmtBytes(bytes)), 'ON THIS PC'));
  },
};

// ---------------------------------------------------------------- History: a timeline of days
function slibHistory() {
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const t0 = day0.getTime();
  let list = (S.history || []).filter((x) => matchQ(x.t, x.u));
  if (SLIB.hf === 'today') list = list.filter((x) => x.ts >= t0);
  else if (SLIB.hf === 'week') list = list.filter((x) => x.ts >= t0 - 6 * 864e5);
  list = list.slice(0, 400);
  const chips = h('div', { class: 'sl-chips', role: 'group', 'aria-label': 'Show' }, ...[['all', 'All'], ['today', 'Today'], ['week', 'This week']].map(([k, l]) =>
    h('button', { class: `sl-chip${SLIB.hf === k ? ' on' : ''}`, 'aria-pressed': String(SLIB.hf === k), onclick: () => { SLIB.hf = k; renderLibrary(); } }, l)));
  const timeline = list.length
    ? h('div', { class: 'sl-timeline' }, ...groupByDay(list, 'ts').map((g, gi) => h('section', { class: `sl-day${gi === 0 ? ' first' : ''}` },
      h('span', { class: 'sl-node', html: slibStar(gi === 0 ? '#E8F9FF' : 'rgba(236,232,225,.45)') }),
      h('h5', {}, g.label.toUpperCase(), h('span', {}, ` · ${g.items.length} VISIT${g.items.length === 1 ? '' : 'S'}`)),
      ...g.items.map((x) => libRow({ cls: 'sl-visit', title: x.u, onclick: (e) => (e.ctrlKey ? newTab(x.u, { background: true }) : (newTab(x.u), closeLibrary())) },
        h('span', { class: 'sl-orb', style: `--dot:${slibDot(hostOf(x.u))}` }, favEl({ url: x.u, title: x.t, favicon: '' }, null, true)),
        h('div', { class: 'lib-txt' }, h('b', {}, x.t || prettyUrl(x.u)), h('small', {}, hostOf(x.u))),
        h('span', { class: 'sl-time' }, slibTime(x.ts)),
        libBtn('trash', 'Remove', () => { S.history = S.history.filter((y) => y !== x); save(); renderLibrary(); }))))))
    : libEmpty('clock', LIB.q ? 'Nothing in your history matches.' : SLIB.hf === 'all' ? 'Pages you visit show up here.' : 'Nothing here yet for this time.');
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = t0 - (6 - i) * 864e5;
    return { n: (S.history || []).filter((x) => x.ts >= start && x.ts < start + 864e5).length, label: new Date(start).toLocaleDateString([], { weekday: 'narrow' }) };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  const week = h('section', { class: 'sl-box' }, h('h3', {}, 'THIS WEEK'),
    h('div', { class: 'sl-bars' }, ...days.map((d, i) => h('span', { class: `sl-bar${i === 6 ? ' now' : ''}`, title: `${d.n} visit${d.n === 1 ? '' : 's'}` }, h('i', { style: `height:${Math.max(4, Math.round((d.n / max) * 88))}px` }), h('small', {}, d.label)))));
  const hosts = {};
  for (const x of S.history || []) { const k = hostOf(x.u); if (k) hosts[k] = (hosts[k] || 0) + 1; }
  const top = Object.entries(hosts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const brightest = top.length ? h('section', { class: 'sl-box' }, h('h3', {}, 'BRIGHTEST STARS · MOST VISITED'),
    h('ul', { class: 'sl-top5' }, ...top.map(([k, n]) => h('li', {}, h('button', { onclick: () => { newTab(`https://${k}/`); closeLibrary(); } }, h('span', { class: 'dot', style: `--dot:${slibDot(k)}` }), h('span', { class: 'nm' }, k), h('span', { class: 'ct' }, n.toLocaleString())))))) : null;
  return [chips, h('div', { class: 'sl-hist' }, timeline, h('aside', { class: 'sl-aside' }, week, brightest))];
}

// ---------------------------------------------------------------- Downloads: a ring card for what's coming in, cards for what landed
const SLIB_EXT = { zip: '#7FE3FF', rar: '#7FE3FF', '7z': '#7FE3FF', pdf: '#f87171', png: '#a78bfa', jpg: '#a78bfa', jpeg: '#a78bfa', gif: '#a78bfa', webp: '#a78bfa', svg: '#a78bfa', mp4: '#fbbf24', mov: '#fbbf24', mkv: '#fbbf24', webm: '#fbbf24', mp3: '#f9a8d4', wav: '#f9a8d4', flac: '#f9a8d4', exe: '#bef264', msi: '#bef264', apk: '#bef264' };
function slibFileCard(r) {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(r.name || '') || [])[1] || 'file';
  const col = SLIB_EXT[ext.toLowerCase()] || '#e5e7eb';
  const ok = r.state === 'completed' && !r.missing;
  const meta = r.missing ? 'File moved or deleted' : r.state === 'completed' ? `${fmtBytes(r.total || r.received || 0)} · ${fmtWhen(r.startedAt)}` : `${r.state === 'cancelled' ? 'Cancelled' : 'Stopped'} · ${fmtWhen(r.startedAt)}`;
  return h('article', { class: `sl-file${ok ? '' : ' off'}`, title: r.url || '' },
    h('div', { class: 'sl-file-top' },
      h('span', { class: 'sl-tag', style: `--tag:${col}` }, ext.toUpperCase().slice(0, 4)),
      h('div', { class: 'lib-txt' }, h('b', {}, r.name), h('small', {}, meta)),
      r.url ? libBtn('reload', 'Download again', () => newTab(r.url, { background: true })) : null,
      libBtn('trash', 'Remove from list', () => { S.downloads = dlList().filter((x) => x !== r); save(); renderLibrary(); })),
    ok ? h('div', { class: 'sl-file-btns' }, h('button', { class: 'btn', onclick: () => openDownload(r) }, 'Open'), h('button', { class: 'btn', onclick: () => oto.showInFolder(r.path) }, 'Show in folder')) : null);
}
function slibLiveCard(r) {
  const pct = r.total ? Math.min(100, (r.received / r.total) * 100) : 0, R = 46, C = 2 * Math.PI * R;
  return h('section', { class: `sl-live${r.state === 'paused' ? ' paused' : ''}`, 'aria-label': `Downloading ${r.name}` },
    h('span', { class: 'sl-comet', 'aria-hidden': 'true', html: '<svg width="260" height="80" viewBox="0 0 260 80"><defs><linearGradient id="slc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#38bdf8" stop-opacity="0"/><stop offset="1" stop-color="#7FE3FF"/></linearGradient></defs><path d="M10 70 C80 60 160 30 236 12" fill="none" stroke="url(#slc)" stroke-width="2.4" stroke-linecap="round"/><circle cx="238" cy="11" r="4" fill="#fff"/><circle cx="238" cy="11" r="10" fill="#7FE3FF" fill-opacity=".3"/></svg>' }),
    h('span', { class: 'sl-ring', role: 'img', 'aria-label': `${Math.round(pct)}%`, html: `<svg width="108" height="108" viewBox="0 0 108 108"><circle cx="54" cy="54" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="5"/><circle cx="54" cy="54" r="${R}" fill="none" stroke="#7FE3FF" stroke-width="5" stroke-linecap="round" stroke-dasharray="${((C * (r.total ? pct : 30)) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 54 54)"/><text x="54" y="60" text-anchor="middle" font-size="20" font-weight="600" fill="#ece8e1">${r.total ? `${Math.round(pct)}%` : '…'}</text></svg>` }),
    h('div', { class: 'sl-live-txt' }, h('span', { class: 'k' }, r.state === 'paused' ? 'PAUSED' : 'DOWNLOADING NOW'), h('b', {}, r.name), h('span', {}, dlSub(r))),
    h('div', { class: 'sl-live-btns' },
      h('button', { class: 'btn', onclick: () => oto.dlAction(r.id, r.state === 'paused' ? 'resume' : 'pause') }, r.state === 'paused' ? 'Resume' : 'Pause'),
      h('button', { class: 'btn', onclick: () => oto.dlAction(r.id, 'cancel') }, 'Cancel')));
}
function slibDownloads(orig) {
  const list = dlList().filter((r) => matchQ(r.name, r.url));
  if (!list.length) return [libEmpty('download', LIB.q ? 'No downloads match your search.' : 'Files you download land here, with a shooting star.')];
  orig(); // (the original also checks which finished files still exist; its result redraws this page)
  const live = list.filter((r) => DL_LIVE.has(r.id)), done = list.filter((r) => !DL_LIVE.has(r.id));
  const tools = h('div', { class: 'sl-dltools' },
    h('button', { class: 'btn', onclick: () => oto.showInFolder(list.find((r) => r.path)?.path || '') }, 'Open Downloads folder'),
    h('button', { class: 'btn', onclick: () => { S.downloads = dlList().filter((x) => DL_LIVE.has(x.id)); save(); renderLibrary(); renderDlCard(); } }, 'Clear list'));
  return [
    ...live.map(slibLiveCard),
    tools,
    ...groupByDay(done, 'startedAt').map((g) => h('section', { class: 'sl-dlgroup' }, h('h5', {}, `LANDED · ${g.label.toUpperCase()}`), h('div', { class: 'sl-files' }, ...g.items.map(slibFileCard)))),
  ];
}

let slibReady = false;
function initSpaceLibrary() {
  if (slibReady) return;
  slibReady = true;
  const _rl = renderLibrary;
  renderLibrary = function () { const out = _rl.apply(this, arguments); slibDecorate(); return out; };
  const _h = LIB_RENDER.history, _d = LIB_RENDER.downloads;
  LIB_RENDER.history = function () { return slibOn() ? slibHistory() : _h.apply(this, arguments); };
  LIB_RENDER.downloads = function () { return slibOn() ? slibDownloads(() => _d.apply(this, arguments)) : _d.apply(this, arguments); };
}
if (typeof spaceReady !== 'undefined' && spaceReady) initSpaceLibrary();
