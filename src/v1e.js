'use strict';
/* Oto v1 — Alpha 5: the Oto Hub (card, music, achievements, milestones, cosmetics), the signed
   Founder card and the music log. Loaded after v1d.js. */

// ================================================================ Founder signature
// The main process signs with the owner key; the UI checks that signature against the Founder public
// key below. Without the real key there is no valid signature, so no Founder card.
const V1_FOUNDER_PUB = 'WmJ86hyoGeSlG3YLv6exZFvVpqepEfJk5B6HdY8k2eM';
async function v1VerifyFounder(msg, sig) {
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: V1_FOUNDER_PUB }, { name: 'Ed25519' }, false, ['verify']);
    const b = atob(sig.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((sig.length + 3) % 4));
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, Uint8Array.from(b, (c) => c.charCodeAt(0)), new TextEncoder().encode(msg));
  } catch { return false; }
}
async function v1OwnerRefresh() {
  V1D.founder = null;
  if (AVOCADO_MODE) return;
  try {
    const st = await oto.ownerStatus();
    UPD.owner = !!(st && st.owner);
    if (!UPD.owner) return;
    const p = await oto.ownerProof('0000');
    if (p && p.sig && await v1VerifyFounder(p.msg, p.sig)) V1D.founder = { ok: true, sig: p.sig };
  } catch {}
}

// ================================================================ frames, milestones, music log
const v1FrameId = () => {
  const L = v1Level();
  const f = (S.card || {}).frame;
  const k = V1_LEVELS.findIndex((l) => l.id === f);
  return k >= 0 && k <= L.i ? f : L.cur.id;
};
const V1_HINTS = {
  week: 'Come back on 7 different days', month: 'A whole month with Oto', blocker: 'Let the blocker do its thing', wall: 'A lot of ads… a LOT', spaces: 'Make a few spaces',
  split: 'Two pages, one window', avocado: 'Go somewhere private', folder: 'Tidy tabs together', shot: 'Capture the screen', theme: 'Design your own look', wrapped: 'Look back at your year',
  owl: 'Browse when everyone sleeps', secret: 'Oto hides things', note: 'Leave yourself a note on a site', focus: 'Finish a focus session',
};
function v1Milestones() {
  const s = v1Stats();
  const hours = Math.floor(((S.v1Time || {}).total || 0) / 60);
  return [
    ['Days with Oto', s.days, [7, 30, 100, 365, 1000], 'clock'],
    ['Ads blocked', s.blocked, [100, 1000, 10000, 100000, 1000000], 'shield'],
    ['Pages visited', s.pages, [100, 1000, 10000, 50000, 250000], 'globe'],
    ['Hours browsing', hours, [1, 10, 100, 500, 2000], 'clock'],
    ['Spaces', s.spaces, [2, 3, 5, 8, 12], 'layers'],
    ['Badges', Object.keys(S.v1Badges || {}).length, [3, 6, 10, 15], 'star'],
  ].map(([name, val, goals, ic]) => {
    const next = goals.find((g) => val < g);
    const prev = [...goals].reverse().find((g) => val >= g) || 0;
    return { name, val, next, prev, ic, done: goals.filter((g) => val >= g).length, of: goals.length, pct: next ? (val - prev) / (next - prev) : 1 };
  });
}
function v1LogMusic(m, t) {
  if (AVOCADO_MODE || !m || !m.title || S.settings.v1MusicLog === false) return;
  S.v1Music = S.v1Music || [];
  const top = S.v1Music[0];
  if (top && top.title === m.title && top.artist === m.artist) { top.at = Date.now(); return; }
  S.v1Music.unshift({ title: String(m.title).slice(0, 120), artist: String(m.artist || '').slice(0, 80), art: /^https?:/.test(m.art || '') ? m.art : '', url: t ? t.url : '', host: t ? hostOf(t.url) : '', at: Date.now() });
  S.v1Music = S.v1Music.slice(0, 30);
  save();
}

// ================================================================ Oto Hub
const V1HUB = { tab: 'card', el: null };
function v1HubClose() { if (V1HUB.el) { V1HUB.el.remove(); V1HUB.el = null; V1D.back = false; } }
function v1Hub(tab) {
  if (tab) V1HUB.tab = tab;
  if (typeof LIB !== 'undefined' && LIB.open) { try { closeLibrary(); } catch {} }
  v1ClosePop();
  if (!V1HUB.el) {
    V1HUB.el = h('div', { class: 'v1-hub' });
    V1HUB.el.addEventListener('mousedown', (e) => { if (e.target === V1HUB.el) v1HubClose(); });
    V1HUB.el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); v1HubClose(); } });
    V1HUB.el.tabIndex = -1;
    document.body.append(V1HUB.el);
    setTimeout(() => { try { V1HUB.el.focus({ preventScroll: true }); } catch {} }, 0);
  }
  v1HubRender();
}
function v1HubCard() {
  const m = cardModel();
  const art = h('div', { class: 'card-art-svg', html: cardSvg(m) });
  const pv = h('div', { class: `card-preview design-${m.design} v1-lvl-${v1FrameId()} v1-ed-${v1Edition()}${V1D.back ? ' v1-back' : ''}` }, h('div', { class: 'card-tilt' }, art, h('div', { class: 'card-foil' }), h('div', { class: 'card-glare' })));
  const tilt = pv.firstChild;
  pv.addEventListener('pointermove', (e) => {
    const b = tilt.getBoundingClientRect();
    const x = clamp((e.clientX - b.left) / b.width, 0, 1), y = clamp((e.clientY - b.top) / b.height, 0, 1);
    tilt.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(2)}deg`); tilt.style.setProperty('--ry', `${((x - 0.5) * 18).toFixed(2)}deg`);
    tilt.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`); tilt.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    tilt.classList.add('on');
  });
  pv.addEventListener('pointerleave', () => { tilt.classList.remove('on'); tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg'); });
  const flip = () => { V1D.back = !V1D.back; tilt.classList.add('v1-flipping'); setTimeout(() => { art.innerHTML = cardSvg(cardModel()); pv.classList.toggle('v1-back', V1D.back); tilt.classList.remove('v1-flipping'); }, 200); };
  pv.addEventListener('dblclick', flip);
  return h('div', { class: 'hc' }, pv,
    h('div', { class: 'acts' },
      h('button', { class: 'btn', onclick: flip, title: 'Turn the card over (or double-click it)' }, '↻ Flip'),
      h('button', { class: 'btn', onclick: () => { v1HubClose(); openLibrary('card'); } }, h('span', { html: icon('palette') }), 'Edit card'),
      h('button', { class: 'btn', onclick: () => saveCard() }, h('span', { html: icon('download') }), 'Save')));
}
function v1HubLevel() {
  const L = v1Level();
  return h('div', { class: 'hl', style: `--lc:${L.cur.color}` },
    h('div', { class: 'top' }, h('span', { class: 'chip' }, L.cur.name.toUpperCase()), h('b', {}, `Level ${L.i + 1}`), h('small', {}, `${L.xp.toLocaleString()} XP`)),
    h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(L.pct * 100)}%` })),
    h('small', { class: 'nx' }, L.next ? `${(L.next.xp - L.xp).toLocaleString()} XP to ${L.next.name}` : 'Mythic — the very top'),
    h('div', { class: 'steps' }, ...V1_LEVELS.map((l, k) => h('span', { class: k <= L.i ? 'on' : '', style: `--c:${l.color}`, title: `${l.name} · ${l.xp.toLocaleString()} XP` }))));
}
function v1HubMusic() {
  const t = typeof media !== 'undefined' && media && tabById(media.tabId);
  const v = t && V.get(t.id);
  const m = V1NP.meta && V1NP.tabId === (t || {}).id ? V1NP.meta : null;
  const now = t && v ? h('div', { class: `np${media.playing ? ' on' : ''}` },
    m && m.art ? h('img', { class: 'art', src: m.art, alt: '', onerror: (e) => e.target.replaceWith(h('div', { class: 'art none', html: icon('music') })) }) : h('div', { class: 'art none', html: icon('play') }),
    h('div', { class: 'tx' }, h('span', { class: 'k' }, media.playing ? 'NOW PLAYING' : 'PAUSED'), h('b', {}, (m && m.title) || t.title || prettyUrl(t.url)), h('small', {}, (m && m.artist) || hostOf(t.url)),
      h('div', { class: 'wave' }, ...Array.from({ length: 28 }, () => h('i'))),
      h('div', { class: 'bt' },
        h('button', { class: 'btn primary', onclick: async () => { await mediaToggle(); setTimeout(v1HubRender, 150); } }, media.playing ? 'Pause' : 'Play'),
        h('button', { class: 'btn', onclick: () => { activate(t.id); v1HubClose(); } }, 'Go to tab'),
        h('button', { class: 'btn', onclick: () => pictureInPicture(t.id) }, 'Picture in picture'))))
    : h('div', { class: 'np empty' }, h('div', { class: 'art none', html: icon('play') }), h('div', { class: 'tx' }, h('span', { class: 'k' }, 'NOTHING PLAYING'), h('b', {}, 'Play some music or a video'), h('small', {}, 'It shows up here with its artwork.')));
  const list = (S.v1Music || []);
  return h('div', { class: 'hs music' }, now,
    h('div', { class: 'sh' }, h('b', {}, 'Recently played'), list.length ? h('button', { class: 'lnk', onclick: () => { S.v1Music = []; save(); v1HubRender(); } }, 'Clear') : null),
    list.length ? h('div', { class: 'rp' }, ...list.slice(0, 14).map((it) => h('button', { class: 'ri', title: it.url, onclick: () => { if (it.url) { openUrl(it.url, { newTabForce: true }); v1HubClose(); } } },
      it.art ? h('img', { src: it.art, alt: '', onerror: (e) => e.target.replaceWith(h('span', { class: 'ph' }, '♪')) }) : h('span', { class: 'ph' }, '♪'),
      h('span', { class: 't' }, h('b', {}, it.title), h('small', {}, [it.artist, it.host].filter(Boolean).join(' · '))), h('span', { class: 'ago' }, v1Ago(it.at)))))
      : h('p', { class: 'muted' }, 'Songs you play on sites like YouTube Music, Spotify or SoundCloud are listed here — only on this PC, never in Avocado.'));
}
function v1HubBadges() {
  const got = S.v1Badges || {};
  const ids = Object.keys(V1_BADGES);
  return h('div', { class: 'hs' },
    h('div', { class: 'sh' }, h('b', {}, `Achievements · ${Object.keys(got).length}/${ids.length}`), h('small', {}, 'Each badge gives 15 XP')),
    h('div', { class: 'bg' }, ...ids.map((id) => {
      const on = got[id];
      return h('div', { class: `b${on ? ' on' : ''}` }, h('span', { class: 'ic' }, on ? V1_BADGES[id][1] : '?'),
        h('b', {}, on ? V1_BADGES[id][0] : 'Hidden badge'), h('small', {}, on ? `Unlocked ${new Date(on).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}` : `Hint: ${V1_HINTS[id] || 'keep exploring'}`));
    })));
}
function v1HubMilestones() {
  const fmt = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString();
  return h('div', { class: 'hs' },
    h('div', { class: 'sh' }, h('b', {}, 'Browser milestones'), h('small', {}, `Using Oto since ${new Date(S.since || Date.now()).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}`)),
    h('div', { class: 'ms' }, ...v1Milestones().map((x) => h('div', { class: 'mi' },
      h('div', { class: 'r1' }, h('span', { class: 'ic', html: icon(x.ic) }), h('small', {}, x.name), h('span', { class: 'pips' }, ...Array.from({ length: x.of }, (_, k) => h('i', { class: k < x.done ? 'on' : '' })))),
      h('b', {}, fmt(x.val)),
      h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(x.pct * 100)}%` })),
      h('small', { class: 'nx' }, x.next ? `Next: ${fmt(x.next)}` : 'All milestones done ✓')))));
}
function v1HubCosmetics() {
  S.card = S.card || {};
  const L = v1Level();
  const ed = v1Edition();
  const founder = !!(V1D.founder && V1D.founder.ok);
  const equip = (fn) => () => { fn(); save(); v1HubRender(); };
  const item = (label, sub, on, locked, run, sw) => h('button', { class: `co${on ? ' on' : ''}${locked ? ' locked' : ''}`, disabled: !!locked, title: locked || '', onclick: run },
    h('span', { class: 'sw', style: sw || '' }), h('b', {}, locked ? `🔒 ${label}` : label), h('small', {}, locked || sub), on ? h('span', { class: 'eq' }, 'Equipped') : null);
  return h('div', { class: 'hs' },
    h('div', { class: 'sh' }, h('b', {}, 'Editions')),
    h('div', { class: 'cg' },
      item('Standard', 'Your design and colours', ed === 'standard', null, equip(() => { S.card.edition = 'standard'; }), `background:linear-gradient(135deg, ${themeOf(currentWs()).colors.join(', ')})`),
      item('OG ★', 'Original two-ring logo', ed === 'og', null, equip(() => { S.card.edition = 'og'; }), 'background:linear-gradient(135deg,#4f46e5,#38bdf8)'),
      item('Founder 力', 'Black & gold · signed', ed === 'founder', founder ? null : 'Only Ryo’s PC (owner key)', equip(() => { S.card.edition = 'founder'; }), 'background:linear-gradient(135deg,#050505,#1c1a14);box-shadow:inset 0 0 0 2px #d4a017')),
    h('div', { class: 'sh' }, h('b', {}, 'Card designs'), h('small', {}, ed !== 'standard' ? 'Used by the Standard edition' : '')),
    h('div', { class: 'cg' }, ...Object.entries(CARD_DESIGNS).map(([k, l]) => item(l, k === 'keycard' ? 'Cyber access card' : k === 'classic' ? 'Clean and simple' : 'Holo trading card', (S.card.design || 'keycard') === k, null, equip(() => { S.card.design = k; }), { keycard: 'background:linear-gradient(180deg,#0e0d1a,#05050a);box-shadow:inset 0 0 0 2px #22d3ee', classic: 'background:#fbf8f1;box-shadow:inset 0 -8px 0 #a78bfa', shiny: 'background:linear-gradient(135deg,#ff9de2,#9df3ff,#c5ff9d,#ffd79d,#d6a8ff)' }[k]))),
    h('div', { class: 'sh' }, h('b', {}, 'Frames'), h('small', {}, 'A glow around your card — one per level')),
    h('div', { class: 'cg' }, ...V1_LEVELS.map((l, k) => item(l.name, k ? `${l.xp.toLocaleString()} XP` : 'Starter', v1FrameId() === l.id, k > L.i ? `Reach ${l.name}` : null, equip(() => { S.card.frame = l.id; }), `background:${l.color}`))),
    h('div', { class: 'sh' }, h('b', {}, 'Titles')),
    h('div', { class: 'cg' }, ...V1_LEVELS.map((l, k) => item(`“${l.title}”`, `${l.name} title`, (S.card.title || '') === l.title, k > L.i ? `Reach ${l.name}` : null, equip(() => { S.card.title = l.title; }), `background:${l.color}`))));
}
function v1HubRender() {
  const box = V1HUB.el;
  if (!box) return;
  const tabs = [['card', 'My card'], ['music', 'Music'], ['badges', 'Achievements'], ['milestones', 'Milestones'], ['cosmetics', 'Cosmetics']];
  const body = { card: () => h('div', { class: 'ov' }, v1HubLevel(), v1HubMilestones(), v1HubBadges()), music: v1HubMusic, badges: v1HubBadges, milestones: v1HubMilestones, cosmetics: v1HubCosmetics }[V1HUB.tab] || v1HubMusic;
  const scroll = box.querySelector('.main');
  const y = scroll ? scroll.scrollTop : 0;
  box.replaceChildren(h('div', { class: 'hub' },
    h('div', { class: 'hh' },
      h('div', { class: 'logo' }, h('span', { class: 'mk', html: (typeof skinIsRt === 'function' && skinIsRt() && typeof vortexSvg === 'function') ? vortexSvg({ bg: false, live: true }) : '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M44.5 15.2 A21 21 0 1 0 49.6 21.3"/><g transform="translate(32 32) scale(.84) translate(-32 -32)"><path d="M32 32 C28.5 26.5 24.5 24.5 20.8 24.5 C16.7 24.5 13.6 27.8 13.6 32 C13.6 36.2 16.7 39.5 20.8 39.5 C24.5 39.5 28.5 37.5 32 32 C35.5 26.5 39.5 24.5 43.2 24.5 C47.3 24.5 50.4 27.8 50.4 32 C50.4 36.2 47.3 39.5 43.2 39.5 C39.5 39.5 35.5 37.5 32 32 Z"/></g></svg>' }), h('b', {}, 'Oto Hub')),
      h('nav', {}, ...tabs.map(([id, label]) => h('button', { class: V1HUB.tab === id ? 'on' : '', onclick: () => { V1HUB.tab = id; v1HubRender(); } }, label))),
      h('button', { class: 'x', html: icon('x'), title: 'Close (Esc)', onclick: v1HubClose })),
    h('div', { class: 'bd' },
      h('aside', {}, v1HubCard(), V1HUB.tab !== 'card' ? v1HubLevel() : null),
      h('div', { class: 'main' }, body()))));
  const sc = box.querySelector('.main'); if (sc) sc.scrollTop = y;
}

// ================================================================ init
function initV1e() {
  v1OwnerRefresh().then(() => { if (document.querySelector('.card-preview')) try { renderLibrary(); } catch {} });
  const _onUpd = onUpdate;
  onUpdate = function (u) { const was = !!UPD.owner; _onUpd.apply(this, arguments); if (u && 'owner' in u && !!u.owner !== was) v1OwnerRefresh(); };
  // music log + live Hub refresh
  const _rm = renderMedia;
  renderMedia = function () {
    _rm.apply(this, arguments);
    const t = typeof media !== 'undefined' && media && tabById(media.tabId);
    if (t && V1NP.meta && V1NP.tabId === t.id) v1LogMusic(V1NP.meta, t);
    const card = $('#mediaCard');
    if (card) card.classList.toggle('v1-np', !!(V1NP.meta && V1NP.meta.art));
    if (V1HUB.el && V1HUB.tab === 'music') v1HubRender();
  };
  // entry points
  CMDS.hub = () => v1Hub();
  ACTIONS.push({ name: 'Oto Hub', kw: 'hub card level badges achievements music milestones cosmetics frames', icon: 'card', run: () => v1Hub() });
  if (typeof V1_FOOT !== 'undefined') V1_FOOT.hub = ['card', 'Oto Hub', () => v1Hub()];
  if (typeof COMMANDS !== 'undefined') COMMANDS.push(['hub', 'Oto Hub', ['Ctrl+Shift+H']]);
  const _slash = v1Slash;
  v1Slash = function (q) {
    const items = _slash.apply(this, arguments);
    const cmd = (q.slice(1).split(/\s+/)[0] || '').toLowerCase();
    if ('hub'.startsWith(cmd) && !items.some((it) => it.t === '/hub')) items.unshift({ g: 'Commands', icon: 'card', t: '/hub', s: 'Oto Hub — card, music, achievements', hint: 'Run', run: () => { closeCmd(false); v1Hub(); } });
    return items;
  };
}
