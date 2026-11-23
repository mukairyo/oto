// Oto — the Library remade in the space look (1.8.3, from the approved design). While the space look is on
// (body.space-home), every Library page gets the wide glass sidebar (name + count per page, storage line), a header
// (LIBRARY / PAGE, big serif title, one line, the glowing search), and History and Downloads are redrawn:
// History as a timeline of days with a week chart and the most-visited sites; Downloads as a big ring card for what's
// downloading and file cards for what landed. Without the space look the Library is exactly as before.
/* global S, LIB, LIB_PAGES, LIB_RENDER, DL_LIVE, renderLibrary, closeLibrary, dlList, dlSub, fmtBytes, fmtWhen,
   groupByDay, libRow, libBtn, libEmpty, matchQ, favEl, hostOf, prettyUrl, newTab, save, oto, openDownload, renderDlCard,
   v1Level, v1Stats, V1_BADGES, h, $, icon, esc, SPACE_STAR, media, V, rtBarcode, animOn, applyLayout:writable, closeLibrary:writable */

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
const SLIB_DOTS = ['#f87171', '#fbbf24', '#bef264', '#3ecf8e', '#fdba74', '#a78bfa', '#f9a8d4', '#e5e7eb'];
const slibDot = (s) => { let n = 0; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return SLIB_DOTS[n % SLIB_DOTS.length]; };
const slibTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); // 4:20 PM, like the start page

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
const SLIB_EXT = { zip: '#e5e7eb', rar: '#e5e7eb', '7z': '#e5e7eb', pdf: '#f87171', png: '#a78bfa', jpg: '#a78bfa', jpeg: '#a78bfa', gif: '#a78bfa', webp: '#a78bfa', svg: '#a78bfa', mp4: '#fbbf24', mov: '#fbbf24', mkv: '#fbbf24', webm: '#fbbf24', mp3: '#f9a8d4', wav: '#f9a8d4', flac: '#f9a8d4', exe: '#bef264', msi: '#bef264', apk: '#bef264' };
function slibFileCard(r) {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(r.name || '') || [])[1] || 'file';
  const col = SLIB_EXT[ext.toLowerCase()] || '#e5e7eb';
  const ok = r.state === 'completed' && !r.missing;
  const meta = r.missing ? 'File moved or deleted' : r.state === 'completed' ? `${fmtBytes(r.total || r.received || 0)} · ${fmtWhen(r.startedAt)}` : `${r.state === 'cancelled' ? 'Cancelled' : 'Stopped'} · ${fmtWhen(r.startedAt)}`;
  const card = h('article', { class: `sl-file${ok ? '' : ' off'}`, title: ok ? 'Drag it out to your desktop or another app' : r.url || '' },
    h('div', { class: 'sl-file-top' },
      h('span', { class: 'sl-tag', style: `--tag:${col}` }, ext.toUpperCase().slice(0, 4)),
      h('div', { class: 'lib-txt' }, h('b', {}, r.name), h('small', {}, meta)),
      r.url ? libBtn('reload', 'Download again', () => newTab(r.url, { background: true })) : null,
      libBtn('trash', 'Remove from list', () => { S.downloads = dlList().filter((x) => x !== r); save(); renderLibrary(); })),
    ok ? h('div', { class: 'sl-file-btns' }, h('button', { class: 'btn', onclick: () => openDownload(r) }, 'Open'), h('button', { class: 'btn', onclick: () => oto.showInFolder(r.path) }, 'Show in folder')) : null);
  if (ok && oto.dlDrag) { // drag the file itself out of Oto (1.8.6)
    card.draggable = true;
    card.addEventListener('dragstart', (e) => { if (e.target.closest('button')) return; e.preventDefault(); oto.dlDrag(r.path); });
  }
  return card;
}

// the empty Downloads page (1.8.6): the star landing, where files go (open it, or pick another folder), and three tips
const SLIB_DLF = { info: null, asked: false };
function slibDlEmpty() {
  if (!SLIB_DLF.asked && oto.dlFolder) { SLIB_DLF.asked = true; oto.dlFolder().then((f) => { SLIB_DLF.info = f; if (LIB.open && LIB.page === 'downloads') renderLibrary(); }).catch(() => {}); }
  const f = SLIB_DLF.info;
  const set = (p) => p.then((x) => { if (x) { SLIB_DLF.info = x; renderLibrary(); } }).catch(() => {});
  const art = `<svg width="420" height="170" viewBox="0 0 420 170" aria-hidden="true"><defs><linearGradient id="sldt" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
    <path class="trail" d="M20 40 Q170 -10 262 96" fill="none" stroke="url(#sldt)" stroke-width="10" stroke-linecap="round" opacity=".18"/>
    <path class="trail" d="M20 40 Q170 -10 262 96" fill="none" stroke="url(#sldt)" stroke-width="2.6" stroke-linecap="round"/>
    <g class="star" transform="translate(262 96) rotate(18) scale(1.2)"><path d="M0-12 3.1-4.2 11.4-3.7 5-1.4 7.1 9.7 0 4.2-7.1 9.7-5-1.4-11.4-3.7-3.1-4.2z" fill="#14151a" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></g>
    <g transform="translate(300 118)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".85"><path d="M-30 0v22h60V0"/><path d="M0-22v26M-11-7 0 4 11-7"/></g>
    <circle cx="300" cy="118" r="44" fill="none" stroke="#fff" stroke-opacity=".12"/><circle cx="90" cy="30" r="1.5" fill="#fff"/><circle cx="150" cy="60" r="1" fill="#fff"/><circle cx="200" cy="40" r="1.3" fill="#fff"/></svg>`;
  const anim = S.settings.dlAnim || 'star';
  const animName = { star: 'Neon star', file: 'A little file', orb: 'Glowing orb', off: 'Nothing' }[anim] || 'Neon star';
  return h('div', { class: 'sl-dlempty' },
    h('div', { class: 'art', html: art }),
    h('h2', {}, 'Nothing has landed yet'),
    h('p', {}, anim === 'off' ? 'Start a download and it shows up here as a card, newest first.' : 'Start a download and a star flies here from where you clicked. Your files will show up as cards, newest first.'),
    h('div', { class: 'sl-dlfolder' }, h('span', { class: 'k' }, 'Saving to'), h('code', { title: f ? f.path : '' }, f ? f.path : 'Your Downloads folder'),
      oto.dlFolderOpen ? h('button', { class: 'btn primary', onclick: () => oto.dlFolderOpen() }, 'Open folder') : null,
      oto.dlFolderPick ? h('button', { class: 'btn', onclick: () => set(oto.dlFolderPick()) }, 'Change') : null,
      f && f.custom && oto.dlFolderReset ? h('button', { class: 'btn ghost', title: 'Go back to Windows’ Downloads folder', onclick: () => set(oto.dlFolderReset()) }, 'Reset') : null),
    h('div', { class: 'sl-tips' },
      h('div', {}, h('b', {}, 'Find any file fast'), h('small', {}, 'Press ', h('kbd', {}, 'CTRL'), ' ', h('kbd', {}, 'J'), ' to jump here from anywhere.')),
      h('div', {}, h('b', {}, 'Drag it out'), h('small', {}, 'Drag a file card onto your desktop or into another app.')),
      h('div', {}, h('b', {}, `Your animation: ${animName}`), h('small', {}, 'Change it in Settings › General › Downloads.'))));
}
function slibLiveCard(r) {
  const pct = r.total ? Math.min(100, (r.received / r.total) * 100) : 0, R = 46, C = 2 * Math.PI * R;
  return h('section', { class: `sl-live${r.state === 'paused' ? ' paused' : ''}`, 'aria-label': `Downloading ${r.name}` },
    h('span', { class: 'sl-comet', 'aria-hidden': 'true', html: '<svg width="260" height="80" viewBox="0 0 260 80"><defs><linearGradient id="slc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs><path d="M10 70 C80 60 160 30 236 12" fill="none" stroke="url(#slc)" stroke-width="2.4" stroke-linecap="round"/><circle cx="238" cy="11" r="4" fill="#fff"/><circle cx="238" cy="11" r="10" fill="#FFFFFF" fill-opacity=".3"/></svg>' }),
    h('span', { class: 'sl-ring', role: 'img', 'aria-label': `${Math.round(pct)}%`, html: `<svg width="108" height="108" viewBox="0 0 108 108"><circle cx="54" cy="54" r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="5"/><circle cx="54" cy="54" r="${R}" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-dasharray="${((C * (r.total ? pct : 30)) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 54 54)"/><text x="54" y="60" text-anchor="middle" font-size="20" font-weight="600" fill="#ece8e1">${r.total ? `${Math.round(pct)}%` : '…'}</text></svg>` }),
    h('div', { class: 'sl-live-txt' }, h('span', { class: 'k' }, r.state === 'paused' ? 'PAUSED' : 'DOWNLOADING NOW'), h('b', {}, r.name), h('span', {}, dlSub(r))),
    h('div', { class: 'sl-live-btns' },
      h('button', { class: 'btn', onclick: () => oto.dlAction(r.id, r.state === 'paused' ? 'resume' : 'pause') }, r.state === 'paused' ? 'Resume' : 'Pause'),
      h('button', { class: 'btn', onclick: () => oto.dlAction(r.id, 'cancel') }, 'Cancel')));
}
function slibDownloads(orig) {
  const list = dlList().filter((r) => matchQ(r.name, r.url));
  if (!list.length) return [LIB.q ? libEmpty('download', 'No downloads match your search.') : slibDlEmpty()];
  orig(); // (the original also checks which finished files still exist; its result redraws this page)
  const live = list.filter((r) => DL_LIVE.has(r.id)), done = list.filter((r) => !DL_LIVE.has(r.id));
  const tools = h('div', { class: 'sl-dltools' },
    h('button', { class: 'btn', onclick: () => (oto.dlFolderOpen ? oto.dlFolderOpen() : oto.showInFolder(list.find((r) => r.path)?.path || '')) }, 'Open downloads folder'),
    h('button', { class: 'btn', onclick: () => { S.downloads = dlList().filter((x) => DL_LIVE.has(x.id)); save(); renderLibrary(); renderDlCard(); } }, 'Clear list'));
  return [
    ...live.map(slibLiveCard),
    tools,
    ...groupByDay(done, 'startedAt').map((g) => h('section', { class: 'sl-dlgroup' }, h('h5', {}, `LANDED · ${g.label.toUpperCase()}`), h('div', { class: 'sl-files' }, ...g.items.map(slibFileCard)))),
  ];
}

// ---------------------------------------------------------------- the Oto Card's badges, as a grid (1.8.6)
// Unlocked badges glow; locked ones show what to do and, where it counts up, how close you are. The secret stays secret.
const SLIB_BADGE_HOW = {
  week: ['Use Oto on 7 days', (s) => [s.days, 7]], month: ['Use Oto on 30 days', (s) => [s.days, 30]],
  blocker: ['Block 1,000 ads', (s) => [s.blocked, 1000]], wall: ['Block 10,000 ads', (s) => [s.blocked, 10000]],
  spaces: ['Make 3 spaces', (s) => [s.spaces, 3]], split: ['Open two tabs side by side'], avocado: ['Try Avocado mode'],
  folder: ['Make a tab folder'], shot: ['Take a screenshot'], theme: ['Open the theme maker'], wrapped: ['Open your Wrapped'],
  owl: ['Browse late at night'], secret: ['Keep exploring…'], note: ['Write a note on a site'], focus: ['Finish a focus session'],
};
function slibBadges() {
  if (typeof V1_BADGES === 'undefined') return null;
  const got = S.v1Badges || {}, ids = Object.keys(V1_BADGES);
  let st = { days: 1, blocked: 0, spaces: 1 };
  try { st = v1Stats(); } catch { /* defaults */ }
  let next = null;
  const tiles = ids.map((id) => {
    const [label, ic] = V1_BADGES[id], on = !!got[id], how = SLIB_BADGE_HOW[id] || ['Keep using Oto'];
    const secret = id === 'secret' && !on;
    const prog = !on && how[1] ? how[1](st) : null;
    if (prog) { const pct = Math.min(0.999, prog[0] / prog[1]); if (!next || pct > next.pct) next = { id, pct, have: prog[0], need: prog[1] }; }
    return h('div', { class: `sl-badge${on ? ' on' : ''}`, title: on ? `${label} — unlocked ${new Date(got[id]).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}` : how[0] },
      h('span', { class: 'ic' }, secret ? h('span', { html: slibStar('#ece8e1', 16) }) : ic),
      h('b', {}, secret ? '???' : label),
      on ? h('small', { class: 'got' }, 'Unlocked · +15 XP')
        : prog ? [h('span', { class: 'bar' }, h('i', { style: `width:${Math.max(3, Math.min(100, (prog[0] / prog[1]) * 100)).toFixed(0)}%` })), h('small', {}, `${Math.min(prog[0], prog[1]).toLocaleString()} / ${prog[1].toLocaleString()}`)]
          : h('small', {}, how[0]));
  });
  const n = ids.filter((id) => got[id]).length;
  let nextEl = null;
  if (next) {
    const left = next.need - next.have;
    const per = { week: 1, month: 1, blocker: st.blocked / Math.max(1, st.days), wall: st.blocked / Math.max(1, st.days) }[next.id];
    const eta = per > 0 ? Math.ceil(left / per) : 0;
    const unit = next.id === 'spaces' ? `space${left === 1 ? '' : 's'}` : next.id === 'week' || next.id === 'month' ? `day${left === 1 ? '' : 's'}` : '';
    const line = `${left.toLocaleString()}${unit ? ` ${unit}` : ''} to go${eta && next.id !== 'week' && next.id !== 'month' ? ` — about ${eta} day${eta === 1 ? '' : 's'} of normal browsing` : ''}.`;
    nextEl = h('div', { class: 'sl-next' }, h('span', { class: 'ic' }, V1_BADGES[next.id][1]),
      h('div', {}, h('b', {}, `Next up: ${V1_BADGES[next.id][0]}`), h('small', {}, line)),
      h('span', { class: 'bar' }, h('i', { style: `width:${(next.pct * 100).toFixed(0)}%` })));
  }
  return h('section', { class: 'sl-badges' },
    h('div', { class: 'sl-bh' }, h('h3', {}, 'Badges'), h('span', { class: 'n' }, `${n} OF ${ids.length} UNLOCKED`)),
    h('p', {}, 'Each badge gives +15 XP. Locked ones show what to do and how close you are.'),
    h('div', { class: 'sl-bgrid' }, ...tiles), nextEl);
}
function slibCardBadges(root) {
  const row = [...root.querySelectorAll('.row2')].find((r) => (r.querySelector('.lab') || {}).textContent === 'Badges');
  if (!row || row.dataset.space) return;
  const grid = slibBadges();
  if (!grid) return;
  row.dataset.space = '1';
  row.replaceChildren(grid);
  row.classList.add('sl-badges-row');
  const form = row.closest('.card-form');
  if (form) form.append(row); // after the card's own options, since it's big now
}

// ---------------------------------------------------------------- the Library menu in the sidebar (1.8.9)
// Opening the Library opens the sidebar fully (a thin strip or a hidden sidebar opens for as long as the Library is
// open) and the sidebar becomes the Library menu, in the sidebar's own style; the menu inside the page goes away.
// The menu rises in from below with a little bounce, one item after another; each page rises in the same way; and
// "Back to your tabs" (or Esc) drops the menu away and gives the sidebar back exactly as it was.
const SLIB_SB_GROUPS = [['SAVED', ['downloads', 'history', 'passwords', 'media']], ['YOUR OTO', ['spaces', 'boosts', 'routing', 'card', 'phone']]];
const SLIB_SB = { took: [], t: 0 };
function slibSidebarMenu(first) {
  const sb = $('#sidebar');
  if (!sb) return;
  const counts = slibCounts();
  let i = 0, n = 0;
  const kids = [
    h('button', { class: 'sbl-back', style: `--i:${i++}`, title: 'Back to your tabs (Esc)', onclick: () => closeLibrary() }, h('span', { class: 'ic', html: icon('back') }), h('span', {}, 'Back to your tabs'), h('kbd', {}, 'ESC')),
    h('div', { class: 'sbl-ws', style: `--i:${i++}` }, h('span', { class: 'g' }, '音'), h('div', {}, h('b', {}, 'LIBRARY'), h('small', {}, 'OTO // EVERYTHING YOU KEEP'))),
  ];
  SLIB_SB_GROUPS.forEach(([g, ks], gi) => {
    kids.push(h('div', { class: 'sbl-sec', style: `--i:${i++}` }, `${String(gi + 1).padStart(2, '0')}   ${g}`));
    for (const k of ks) {
      const p = LIB_PAGES.find((x) => x[0] === k);
      if (!p) continue;
      n++;
      kids.push(h('button', { class: `sbl-it${LIB.page === k ? ' on' : ''}`, style: `--i:${i++}`, 'aria-current': LIB.page === k ? 'page' : null,
        onclick: () => { if (LIB.page === k) return; LIB.page = k; LIB.q = ''; renderLibrary(true); } },
      h('span', { class: 'n' }, String(n).padStart(2, '0')), h('span', { class: 'ic', html: icon(p[2]) }), h('span', { class: 't' }, p[1]), h('em', {}, counts[k] || '')));
    }
  });
  kids.push(h('div', { class: 'sbl-foot', style: `--i:${i++}`, 'aria-hidden': 'true' }, h('div', { class: 'r' }, h('span', {}, 'OTO // LIBRARY'), h('span', {}, 'LIVE')),
    h('div', { class: 'bc', style: typeof rtBarcode === 'function' ? `background-image:${rtBarcode()}` : '' }), h('div', { class: 's' }, 'OTO — DESKTOP')));
  let el = $('#sbLib');
  const fresh = !el;
  if (!el) { el = h('nav', { id: 'sbLib', 'aria-label': 'Library' }); const head = $('#sbHead'); if (head) head.after(el); else sb.prepend(el); }
  el.replaceChildren(...kids);
  if (fresh && first && animOn()) { el.classList.add('rise'); setTimeout(() => el.classList.remove('rise'), 1400); }
}
function slibSidebarOpen(first) {
  const b = document.body;
  b.classList.remove('sb-lib-out', 'sb-lib-back');
  if (!b.classList.contains('sb-lib')) {
    // a thin strip or a hidden sidebar opens fully while the Library is open (put back exactly on close)
    SLIB_SB.took = ['rail', 'compact'].filter((c) => b.classList.contains(c));
    b.classList.remove('rail', 'compact', 'rail-open', 'peek');
    b.classList.add('sb-lib');
    if (SLIB_SB.took.length && animOn()) { b.classList.add('sb-lib-grow'); setTimeout(() => b.classList.remove('sb-lib-grow'), 420); }
  }
  slibSidebarMenu(first);
}
function slibSidebarClose() {
  const b = document.body;
  if (!b.classList.contains('sb-lib')) return;
  const finish = () => {
    if (LIB.open) return; // opened again meanwhile
    const el = $('#sbLib'); if (el) el.remove();
    b.classList.remove('sb-lib', 'sb-lib-out');
    const give = () => { for (const c of SLIB_SB.took) b.classList.add(c); SLIB_SB.took = []; };
    if (animOn()) {
      b.classList.add('sb-lib-back');
      setTimeout(() => b.classList.remove('sb-lib-back'), 900);
      if (SLIB_SB.took.length) { b.classList.add('sb-lib-shrink'); setTimeout(() => { b.classList.remove('sb-lib-shrink'); if (!LIB.open) give(); }, 260); } else give();
    } else give();
  };
  if (animOn() && $('#sbLib')) { b.classList.add('sb-lib-out'); clearTimeout(SLIB_SB.t); SLIB_SB.t = setTimeout(finish, 300); } else finish();
}

let slibReady = false;
function initSpaceLibrary() {
  if (slibReady) return;
  slibReady = true;
  const _rl = renderLibrary;
  renderLibrary = function (first) {
    const out = _rl.apply(this, arguments);
    if (slibOn() && LIB.open) {
      slibSidebarOpen(first);
      const main = document.querySelector('#library .lib-main');
      if (main && first && animOn()) main.classList.add('sl-rise'); // each page rises in with a little bounce
    }
    slibDecorate(); if (slibOn() && LIB.page === 'card') setTimeout(() => { const r = $('#library'); if (r && slibOn() && LIB.page === 'card') slibCardBadges(r); }, 0); return out; }; // the badges wait for the card panel, which is also added a moment later
  const _cl = closeLibrary;
  closeLibrary = function () { const was = LIB.open; const r = _cl.apply(this, arguments); if (was && !LIB.open) slibSidebarClose(); return r; };
  // if the layout is re-applied while the Library has the sidebar (a settings change), keep it open until close
  if (typeof applyLayout === 'function') {
    const _al = applyLayout;
    applyLayout = function () {
      const r = _al.apply(this, arguments);
      const b = document.body;
      if (b.classList.contains('sb-lib')) { const now = ['rail', 'compact'].filter((c) => b.classList.contains(c)); if (now.length) { SLIB_SB.took = now; b.classList.remove('rail', 'compact', 'rail-open', 'peek'); } }
      return r;
    };
  }
  const _h = LIB_RENDER.history, _d = LIB_RENDER.downloads;
  LIB_RENDER.history = function () { return slibOn() ? slibHistory() : _h.apply(this, arguments); };
  LIB_RENDER.downloads = function () { return slibOn() ? slibDownloads(() => _d.apply(this, arguments)) : _d.apply(this, arguments); };
}
if (typeof spaceReady !== 'undefined' && spaceReady) initSpaceLibrary();
