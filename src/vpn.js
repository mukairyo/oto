'use strict';
// Oto VPN panel (1.8.0): the space-themed panel from the approved design (docs: Oto VPN — design canvas).
// The work happens in the main process (main/vpn.js); this file only shows its state and sends your choices.
// Pieces: a "VPN" pill in the page actions (next to Shield), a line at the bottom of the sidebar while it's on, and
// the panel (main view, star map, route).

const VPN_NAMES = { auto: 'Fastest for you', nl: 'Netherlands', de: 'Germany', ch: 'Switzerland', se: 'Sweden', gb: 'United Kingdom', us: 'United States', jp: 'Japan', fr: 'France', ca: 'Canada', fi: 'Finland', no: 'Norway', at: 'Austria', ro: 'Romania' };
// rough places on the star map (x, y in a 384 x 250 box)
const VPN_MAP = { us: [52, 150], ca: [70, 96], gb: [158, 104], fr: [172, 150], nl: [196, 112], de: [222, 128], ch: [204, 168], at: [240, 160], se: [236, 58], no: [208, 50], fi: [268, 52], ro: [282, 172], jp: [344, 150] };
const VPN_LINKS = [['gb', 'nl'], ['nl', 'de'], ['de', 'ch'], ['de', 'at'], ['de', 'se'], ['se', 'no'], ['se', 'fi'], ['fr', 'ch'], ['gb', 'fr'], ['at', 'ro'], ['us', 'ca'], ['ca', 'gb'], ['de', 'jp']];
const VPN = { st: null, view: 'main', open: false, pick: null };
const vpnStar = (k, fill = '#FFFAF2') => `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><path d="M20 ${20 - k} Q20 20 ${20 + k} 20 Q20 20 20 ${20 + k} Q20 20 ${20 - k} 20 Q20 20 20 ${20 - k}Z" fill="${fill}"/></svg>`;
const vpnBrackets = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" fill="none" stroke="#7FE3FF" stroke-width="1.3"><path d="M4 10V4H10M30 4H36V10M36 30V36H30M10 36H4V30"/></svg>';
const vpnOn = (st) => !!(st && st.on);
const vpnCc = (st) => (st && st.exitCc) || (st && st.country !== 'auto' ? st.country : '');

function vpnScopes() {
  const out = [['all', 'All tabs'], ['private', 'Private windows only']];
  const ws = typeof S !== 'undefined' && S.workspaces && S.workspaces.find((w) => w.id === S.activeWs);
  if (ws && ws.v1Own) out.push([`space:persist:oto-ws-${String(ws.id).replace(/[^\w-]/g, '').slice(0, 40)}`, `Only “${ws.name}”`]);
  return out;
}
async function vpnSet(patch) {
  try { VPN.st = await oto.vpn.set(patch); } catch (e) { toast('Couldn’t change the VPN', { icon: 'x' }); }
  vpnRender();
}

// ------------------------------------------------------------------ the pill and the sidebar line
function vpnPill() {
  let b = document.getElementById('btnVpn');
  if (!b) {
    const acts = document.getElementById('pageActions'); if (!acts) return;
    b = h('button', { id: 'btnVpn', class: 'vpn-pill', onclick: (e) => { e.stopPropagation(); vpnToggle(); } });
    acts.prepend(b);
  }
  const st = VPN.st || {}, on = vpnOn(st), cc = vpnCc(st);
  b.className = `vpn-pill${on ? ` on ph-${st.phase}` : ''}`;
  const word = !on ? '' : st.phase === 'on' ? `VPN${cc ? ` ${cc.toUpperCase()}` : ''}` : st.phase === 'starting' ? `VPN ${st.progress || 0}%` : 'RECONNECTING';
  b.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 Q12 12 22 12 Q12 12 12 22 Q12 12 2 12 Q12 12 12 2Z" fill="currentColor"/></svg>${word ? `<span>${word}</span>` : ''}`;
  const label = !on ? 'Oto VPN: off' : st.phase === 'on' ? `Oto VPN: on${cc ? `, ${VPN_NAMES[cc] || cc}` : ''}` : st.phase === 'starting' ? 'Oto VPN: connecting' : 'Oto VPN: reconnecting';
  b.title = label; b.setAttribute('aria-label', `${label}. Open VPN`);
}
function vpnSideLine() {
  const foot = document.querySelector('#sidebar .sb-foot'); if (!foot) return;
  let row = document.getElementById('vpnRow');
  const st = VPN.st || {};
  // (shown only while the VPN is on, except in the narrow icon sidebar ("rail"), where the address bar and its VPN
  // pill are hidden: there it stays as an icon, so the VPN can always be opened; vpn.css)
  if (!row) { row = h('button', { id: 'vpnRow', class: 'vpn-row', onclick: () => vpnToggle(true) }); foot.before(row); }
  const cc = vpnCc(st), on = vpnOn(st);
  // (1.8.2) when the VPN star is one of the sidebar's own buttons (next to Library, Notifications…), it shows the
  // state there, and the separate line appears only while connected in the wide sidebar
  const fb = document.querySelector('#sidebar .v1-fb[data-k="vpn"]');
  if (fb) {
    fb.classList.toggle('vpn-on', on && st.phase === 'on');
    fb.classList.toggle('vpn-busy', on && st.phase !== 'on');
    fb.title = !on ? 'Oto VPN: off' : st.phase === 'on' ? `Oto VPN: on${cc ? `, ${VPN_NAMES[cc] || cc}` : ''}` : 'Oto VPN: connecting';
  }
  row.className = `vpn-row ph-${on ? st.phase : 'off'}${fb ? ' has-foot' : ''}`;
  const label = !on ? 'Oto VPN: off' : st.phase === 'on' ? `Oto VPN: on${cc ? `, ${VPN_NAMES[cc] || cc}` : ''}` : st.phase === 'starting' ? 'Oto VPN: connecting' : 'Oto VPN: reconnecting';
  row.title = label; row.setAttribute('aria-label', `${label}. Open VPN`);
  row.innerHTML = '';
  row.append(h('span', { class: 'vpn-row-star', html: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 Q12 12 21 12 Q12 12 12 21 Q12 12 3 12 Q12 12 12 3Z" fill="currentColor"/></svg>' }),
    h('span', { class: 'vpn-row-t' }, !on ? 'VPN · OFF' : st.phase === 'on' ? `VPN · ${(VPN_NAMES[cc] || 'CONNECTED').toUpperCase()}` : st.phase === 'starting' ? `VPN · CONNECTING ${st.progress || 0}%` : 'VPN · RECONNECTING'),
    h('span', { class: 'vpn-row-r' }, 'Tor'));
}

// ------------------------------------------------------------------ the panel
function vpnToggle(force) {
  if (VPN.open && force !== true) return vpnClose();
  VPN.open = true; VPN.view = 'main';
  vpnRender();
  const p = document.getElementById('vpnPanel'); if (p) { const f = p.querySelector('.vpn-power'); if (f) f.focus(); }
}
function vpnClose() { VPN.open = false; const p = document.getElementById('vpnPanel'); if (p) p.remove(); const s = document.getElementById('vpnScrim'); if (s) s.remove(); }

function vpnHead(title, back) {
  return h('div', { class: 'vpn-hd' },
    back ? h('button', { class: 'vpn-back', 'aria-label': 'Back', onclick: () => { VPN.view = 'main'; vpnRender(); }, html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>' }) : null,
    h('span', { class: 'vpn-crumb' }, title),
    back ? null : h('span', { class: `vpn-status${vpnOn(VPN.st) ? ' on' : ''}` }, h('i'), !vpnOn(VPN.st) ? 'NO LINK' : VPN.st.phase === 'on' ? 'QUANTUM LINK' : VPN.st.phase === 'starting' ? 'LINKING' : 'RECONNECTING'));
}

function vpnMain(st) {
  const on = vpnOn(st), cc = vpnCc(st), linked = on && st.phase === 'on';
  const big = !on ? 'Not connected' : linked ? (VPN_NAMES[cc] || 'Connected') : st.phase === 'starting' ? 'Connecting…' : st.phase === 'error' ? 'Couldn’t connect' : 'Reconnecting…';
  const sub = !on ? 'Sites see your real address. Connect to hide it behind a star somewhere else.'
    : linked ? `Sites see a Tor address${cc ? ` in ${VPN_NAMES[cc] || cc.toUpperCase()}` : ''}, not yours. Only Oto’s browsing goes through it.`
      : st.phase === 'starting' ? `Linking to the Tor network… ${st.progress || 0}%`
        : st.error || (st.killSwitch ? 'The link dropped. Pages wait until it’s back, so your address doesn’t slip out.' : 'The link dropped. Pages load directly until it’s back.');
  const kicker = !on ? 'TAP THE STAR TO CONNECT' : linked ? `LOCKED ON // ${(st.exitIp ? 'TOR EXIT' : (VPN_NAMES[st.country] || 'TOR')).toUpperCase()}` : st.phase === 'starting' ? 'SPOOLING UP' : 'SIGNAL LOST';
  const mins = linked && st.since ? Math.max(0, Math.round((Date.now() - st.since) / 60000)) : 0;
  const scopeSel = h('select', { 'aria-label': 'Use the VPN for', onchange: (e) => vpnSet({ scope: e.target.value }) },
    vpnScopes().map(([v, t]) => h('option', { value: v, selected: st.scope === v ? true : null }, t)));
  return h('div', { class: 'vpn-body' },
    vpnHead('OTO // VPN'),
    h('div', { class: `vpn-hero${on ? ' on' : ''}${st.phase === 'starting' ? ' spin' : ''}` },
      on ? h('div', { class: 'vpn-orbit', 'aria-hidden': 'true' }) : null,
      h('button', { class: 'vpn-power', 'aria-label': on ? 'Turn the VPN off' : 'Turn the VPN on', disabled: st.available === false ? true : null, onclick: () => vpnSet({ on: !on }) },
        h('span', { class: 'vpn-glow', 'aria-hidden': 'true' }),
        h('span', { class: 'vpn-star', html: vpnStar(on ? 13 : 8, on ? '#FFFAF2' : 'rgba(236,232,225,.45)') }),
        linked ? h('span', { class: 'vpn-brackets', html: vpnBrackets }) : null),
      h('div', { class: 'vpn-kicker' }, kicker),
      h('div', { class: 'vpn-big' }, big),
      h('div', { class: 'vpn-sub' }, st.available === false ? 'Tor isn’t included in this copy of Oto. It comes with the installed version.' : sub)),
    h('div', { class: 'vpn-card' },
      h('button', { class: 'vpn-row-btn', onclick: () => { VPN.view = 'map'; VPN.pick = st.country; vpnRender(); } },
        h('span', { class: 'vpn-ic', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 4 Q12 12 20 12 Q12 12 12 20 Q12 12 4 12 Q12 12 12 4Z"/></svg>' }),
        h('span', { class: 'vpn-tt' }, h('b', {}, 'Location'), h('small', {}, VPN_NAMES[st.country] || 'Fastest for you')),
        h('span', { class: 'vpn-go' }, 'STAR MAP ›')),
      h('button', { class: 'vpn-row-btn', onclick: () => { VPN.view = 'route'; vpnRender(); } },
        h('span', { class: 'vpn-ic', html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="4" cy="16" r="1.6"/><circle cx="12" cy="8" r="1.6"/><circle cx="20" cy="14" r="1.6"/><path d="M5.2 14.8l5.6-5.6M13.5 8.9l5 4"/></svg>' }),
        h('span', { class: 'vpn-tt' }, h('b', {}, 'Route'), h('small', {}, 'Tor · 3 hops, run by volunteers')),
        h('span', { class: 'vpn-go' }, '›'))),
    h('div', { class: 'vpn-card pad' },
      h('label', { class: 'vpn-opt' },
        h('span', { class: 'vpn-tt' }, h('b', {}, 'Block pages if the link drops'), h('small', {}, 'Nothing loads without it, so your address never slips out')),
        h('input', { type: 'checkbox', checked: st.killSwitch !== false ? true : null, 'aria-label': 'Block pages if the VPN drops', onchange: (e) => vpnSet({ killSwitch: e.target.checked }) })),
      h('label', { class: 'vpn-opt' },
        h('span', { class: 'vpn-tt' }, h('b', {}, 'Use it for'), h('small', {}, 'All tabs, private windows, or a Space with its own logins')),
        scopeSel)),
    h('div', { class: 'vpn-foot' },
      h('span', {}, on ? 'WEBRTC + DNS GO THROUGH IT TOO' : 'COVERS OTO ONLY, NOT OTHER APPS'),
      linked ? h('button', { class: 'vpn-link', onclick: () => oto.vpn.renew().then((s) => { VPN.st = s; vpnRender(); }) }, 'NEW ADDRESS') : h('span', {}, mins ? `LINKED ${mins} MIN` : '')));
}

function vpnMap(st) {
  const pick = VPN.pick || st.country || 'auto';
  const lines = VPN_LINKS.map(([a, b]) => `M${VPN_MAP[a][0]} ${VPN_MAP[a][1]}L${VPN_MAP[b][0]} ${VPN_MAP[b][1]}`).join('');
  const stars = Object.entries(VPN_MAP).map(([cc, [x, y]]) => {
    const sel = cc === pick;
    return h('button', { class: `vpn-mstar${sel ? ' sel' : ''}`, style: `left:${x - 20}px;top:${y - 20}px`, 'aria-label': VPN_NAMES[cc], 'aria-pressed': sel ? 'true' : 'false', onclick: () => { VPN.pick = cc; vpnRender(); } },
      h('span', { class: 'vpn-mglow', 'aria-hidden': 'true' }),
      h('span', { class: 'vpn-mpt', html: vpnStar(sel ? 8 : 6) }),
      sel ? h('span', { class: 'vpn-mbr', html: vpnBrackets }) : null,
      h('span', { class: 'vpn-mlbl' }, cc.toUpperCase()));
  });
  return h('div', { class: 'vpn-body' },
    vpnHead('OTO // VPN // STAR MAP', true),
    h('div', { class: 'vpn-map' }, h('span', { class: 'vpn-mlines', html: `<svg width="384" height="250" viewBox="0 0 384 250" aria-hidden="true" fill="none" stroke="rgba(236,232,225,.22)" stroke-dasharray="2 4"><path d="${lines}"/></svg>` }), stars),
    h('div', { class: 'vpn-lock' },
      h('span', { class: 'vpn-tt' }, h('span', { class: 'vpn-k' }, pick === 'auto' ? 'ANY EXIT' : 'LOCKED ON'), h('span', { class: 'vpn-lbig' }, VPN_NAMES[pick] || pick), h('small', {}, pick === 'auto' ? 'Tor picks a fast exit for you' : 'Tor exits in this country only')),
      h('button', { class: 'vpn-jump', onclick: () => { vpnSet({ country: pick, on: true }); VPN.view = 'main'; } }, 'JUMP')),
    h('div', { class: 'vpn-row2' },
      h('button', { class: 'vpn-chip', onclick: () => { VPN.pick = 'auto'; vpnRender(); } }, 'Fastest for you')),
    h('div', { class: 'vpn-foot soft' }, h('span', {}, 'Tor has fewer exits in some countries: those can be slower.')));
}

function vpnRoute() {
  const card = (title, tag, body, svg, live) => h('div', { class: `vpn-route${live ? ' sel' : ''}` },
    h('span', { class: 'vpn-rsvg', html: svg }),
    h('span', { class: 'vpn-tt' },
      h('span', { class: 'vpn-rtop' }, h('b', {}, title), h('span', { class: 'vpn-tag' }, tag)),
      h('small', {}, body)));
  const S3 = '<svg width="74" height="58" viewBox="0 0 74 58" aria-hidden="true"><path d="M8 46L28 18L48 40L66 12" fill="none" stroke="rgba(127,227,255,.6)" stroke-dasharray="2 3"/><circle cx="8" cy="46" r="6" fill="rgba(127,227,255,.25)"/><circle cx="28" cy="18" r="6" fill="rgba(127,227,255,.25)"/><circle cx="48" cy="40" r="6" fill="rgba(127,227,255,.25)"/><circle cx="66" cy="12" r="6" fill="rgba(127,227,255,.25)"/></svg>';
  const S2 = '<svg width="74" height="58" viewBox="0 0 74 58" aria-hidden="true"><path d="M12 40L62 18" fill="none" stroke="rgba(236,232,225,.3)" stroke-dasharray="2 3"/><circle cx="12" cy="40" r="6" fill="rgba(232,238,255,.14)"/><circle cx="62" cy="18" r="6" fill="rgba(232,238,255,.14)"/></svg>';
  const S5 = '<svg width="74" height="58" viewBox="0 0 74 58" aria-hidden="true"><path d="M37 29L10 12M37 29L64 14M37 29L14 48M37 29L62 46" fill="none" stroke="rgba(236,232,225,.3)" stroke-dasharray="2 3"/><circle cx="37" cy="29" r="10" fill="rgba(232,238,255,.14)"/></svg>';
  return h('div', { class: 'vpn-body' },
    vpnHead('OTO // VPN // ROUTE', true),
    h('div', { class: 'vpn-rhead' }, h('div', { class: 'vpn-big sm' }, 'Whose stars carry it'), h('div', { class: 'vpn-sub' }, 'Oto VPN is free, through Tor. Faster routes are on the way.')),
    h('div', { class: 'vpn-routes' },
      card('Tor', 'FREE · ON', 'Built into Oto. Three hops through volunteers’ relays, no account. Very private; slower, and some sites ask for more captchas.', S3, true),
      card('Your own VPN', 'SOON', 'A VPN you already pay for: drop in its WireGuard file.', S2, false),
      card('Oto VPN Plus', 'SOON', 'Oto’s own fast servers, one star per country, for a monthly price.', S5, false)));
}

function vpnRender() {
  vpnPill(); vpnSideLine();
  if (!VPN.open) return;
  const st = VPN.st || { on: false, phase: 'off', country: 'auto', scope: 'all', killSwitch: true };
  let p = document.getElementById('vpnPanel');
  if (!p) {
    document.body.append(h('div', { id: 'vpnScrim', class: 'vpn-scrim', onclick: vpnClose }));
    p = h('div', { id: 'vpnPanel', class: 'vpn-panel', role: 'dialog', 'aria-label': 'Oto VPN', onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); vpnClose(); } } });
    document.body.append(p);
  }
  p.replaceChildren(VPN.view === 'map' ? vpnMap(st) : VPN.view === 'route' ? vpnRoute() : vpnMain(st));
  // next to the pill when it's on screen, else in the top right
  const b = document.getElementById('btnVpn'), r = b && b.getBoundingClientRect();
  if (r && r.width) { p.style.top = `${Math.round(r.bottom + 8)}px`; p.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - 428, r.left - 20)))}px`; p.style.right = 'auto'; } else { p.style.top = '56px'; p.style.right = '16px'; p.style.left = 'auto'; }
}

function vpnInit() {
  if (typeof oto === 'undefined' || !oto.vpn) return;
  oto.vpn.state().then((s) => { VPN.st = s; vpnRender(); }).catch(() => {});
  oto.on('vpn', (s) => { VPN.st = s; vpnRender(); });
  setInterval(() => { if (VPN.open && vpnOn(VPN.st) && VPN.st.phase === 'on' && VPN.view === 'main') vpnRender(); }, 30000); // "linked N min"
}
