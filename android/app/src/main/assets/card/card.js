'use strict';
// Oto for Android — your Oto Card page. The app opens this page with your card (fetched from your synced Oto data and
// decrypted on the phone) in the address after "#d=". Without it (not signed in) a new card is shown with how to get
// yours. Nothing is sent anywhere from here.
(function () {
  let d = null;
  try {
    const m = location.hash.match(/[#&]d=([^&]+)/);
    if (m) { const b = m[1].replace(/-/g, '+').replace(/_/g, '/'); d = JSON.parse(decodeURIComponent(escape(atob(b)))); }
  } catch (e) { d = null; }
  const ws = (d && Array.isArray(d.workspaces) && d.workspaces.length) ? d.workspaces : [{ id: 'phone', colors: ['#7c6cf0', '#22d3ee'] }];
  window.S = {
    card: (d && d.card) || {}, badges: undefined, v1Badges: (d && d.badges) || {}, v1XpBonus: (d && d.xpBonus) || 0,
    since: (d && d.since) || Date.now(), stats: (d && d.stats) || {}, workspaces: ws, activeWs: ws[0].id,
    settings: { userName: (d && d.userName) || '' }, tabs: [], history: [],
  };
  const el = document.getElementById('card');
  const front = cardSvg(cardModel());
  let back = '';
  try { back = v1CardBack(cardModel()); } catch (e) { back = ''; }
  const flipOn = { v: false };
  const draw = () => { el.innerHTML = flipOn.v && back ? back : front; };
  draw();
  el.addEventListener('click', () => { if (!back) return; flipOn.v = !flipOn.v; draw(); });
  if (!back) document.getElementById('hint').hidden = true;
  const L = v1Level();
  const lv = document.getElementById('lvl');
  lv.innerHTML = '';
  const t = document.createElement('div'); t.className = 't';
  const nm = document.createElement('span'); nm.textContent = L.cur.name.toUpperCase();
  const lvB = document.createElement('b'); lvB.textContent = `Level ${L.i + 1} · ${L.xp.toLocaleString()} XP`;
  t.append(nm, lvB);
  const bar = document.createElement('div'); bar.className = 'bar';
  const fill = document.createElement('i'); fill.style.width = `${Math.round(L.pct * 100)}%`; bar.append(fill);
  const sm = document.createElement('small');
  sm.textContent = L.next ? `${(L.next.xp - L.xp).toLocaleString()} XP to ${L.next.name}` : 'Mythic — the top level';
  lv.append(t, bar, sm);
  const note = document.getElementById('note');
  if (d) {
    const when = d.at ? new Date(d.at).toLocaleString() : '';
    note.textContent = `Your card from your PC${when ? ` (synced ${when})` : ''}. Change its look on your PC in Library › Oto Card; it shows here the next time you open it.`;
  } else {
    note.textContent = 'Sign in with your Oto account (⋯ → Oto account) to see the card you made on your PC, with your level and badges.';
  }
})();
