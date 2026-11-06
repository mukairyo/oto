'use strict';
/* Oto — first-launch custom setup (Zen-style): import, layout, colours, feel, speed, privacy, Essentials */

const SETUP_SITES = [
  ['YouTube', 'https://www.youtube.com/'], ['Gmail', 'https://mail.google.com/'], ['GitHub', 'https://github.com/'],
  ['Wikipedia', 'https://en.wikipedia.org/'], ['Reddit', 'https://www.reddit.com/'], ['X', 'https://x.com/'],
  ['Discord', 'https://discord.com/app'], ['Spotify', 'https://open.spotify.com/'], ['Twitch', 'https://www.twitch.tv/'],
  ['Roblox', 'https://www.roblox.com/'], ['WhatsApp', 'https://web.whatsapp.com/'], ['Claude', 'https://claude.ai/'],
];
const ENGINE_NOTES = {
  duckduckgo: 'Private — doesn’t track your searches',
  google: 'The biggest index',
  brave: 'Independent and private',
  bing: 'Microsoft’s search',
  startpage: 'Google results, without the tracking',
};

// A tiny drawing of the Oto window, used to preview layout choices.
function setupMock({ layout = 'single', mode = 'expanded', side = 'left', flat = false } = {}) {
  const sb = h('div', { class: 'mk-sb' },
    layout === 'single' && mode === 'expanded' ? h('div', { class: 'mk-nav' }, h('i'), h('i'), h('i')) : null,
    layout === 'single' && mode === 'expanded' ? h('div', { class: 'mk-url' }) : null,
    h('div', { class: 'mk-ess' }, h('i'), h('i'), h('i')),
    h('div', { class: 'mk-tab on' }), h('div', { class: 'mk-tab' }), h('div', { class: 'mk-tab' }));
  const top = h('div', { class: 'mk-top' }, layout === 'top' ? [h('i'), h('i'), h('div', { class: 'mk-url' })] : [h('b'), h('b'), h('b')]);
  return h('div', { class: `mk mk-${mode} mk-l-${layout}${side === 'right' ? ' mk-right' : ''}${flat ? ' mk-flat' : ''}` },
    sb, h('div', { class: 'mk-main' }, top, h('div', { class: 'mk-page' }, h('span'), h('span'), h('span'))));
}

function runSetup() {
  if (document.getElementById('setup')) return;
  closeCmd(false); closeMenu();
  $('#settings').hidden = true;

  const st = S.settings;
  // Oto theme: Zen layout only, and no gradient colours step — the theme decides the look.
  const RT = typeof skinIsRt === 'function' && skinIsRt();
  if (RT && st.toolbarLayout === 'top') { st.toolbarLayout = 'single'; save(); }
  const ws = currentWs();
  const model = JSON.parse(JSON.stringify(themeOf(ws)));
  const picked = new Set(essentials().map((t) => hostOf(t.url)).filter((x) => SETUP_SITES.some(([, u]) => hostOf(u) === x)));
  const imported = new Set();
  let sources = null;
  let step = 0;
  let reached = 0;

  const STEPS = [
    ['welcome', 'Welcome'], ['import', 'Bring your stuff'], ['layout', 'Layout'], ['colours', 'Colours'],
    ['feel', 'Look & feel'], ['speed', 'Speed'], ['privacy', 'Search & privacy'], ['essentials', 'Essentials'], ['done', 'Done'],
  ].filter(([k]) => !(RT && k === 'colours'));

  const body = h('div', { class: 'setup-body' });
  const rail = h('div', { class: 'setup-steps' });
  const back = h('button', { class: 'btn', onclick: () => go(step - 1) }, 'Back');
  const next = h('button', { class: 'btn primary', onclick: () => go(step + 1) }, 'Continue');
  const skip = h('button', { class: 'setup-skip', onclick: finish }, 'Skip setup');
  const progress = h('div', { class: 'setup-progress' }, h('span'));
  const side = h('div', { class: 'setup-side' },
    h('div', { class: 'setup-brand' }, h('span', { class: 'setup-mark', html: logoSvg() }), h('b', {}, 'Oto'), RT ? h('span', { class: 'k' }, '音') : null), rail,
    h('div', { class: 'setup-side-foot' }, 'You can change everything later in Settings'));
  const card = h('div', { class: 'setup-card' }, side,
    h('div', { class: 'setup-main' }, progress, body, h('div', { class: 'setup-foot' }, skip, h('div', { class: 'setup-nav' }, back, next))));
  const winBtns = h('div', { class: 'setup-win nodrag' },
    h('button', { title: 'Minimise', html: WIN_ICONS.min, onclick: () => oto.winMin() }),
    h('button', { title: 'Maximise', html: WIN_ICONS.max, onclick: () => oto.winMax() }),
    h('button', { class: 'close', title: 'Close', html: WIN_ICONS.close, onclick: () => oto.winClose() }));
  const root = h('div', { id: 'setup' }, h('div', { class: 'setup-drag drag' }), winBtns, card);
  document.body.append(root);

  // ---- small controls that repaint the setup (the Settings versions repaint Settings)
  const seg = (opts, val, pick) => h('div', { class: 'seg' }, ...opts.map(([v, l]) => h('button', { class: v === val ? 'on' : '', onclick: () => { pick(v); paint(); } }, l)));
  const sw = (on, toggle) => h('button', { class: `switch${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(on), onclick: () => { toggle(!on); paint(); } });
  const line = (label, sub, control) => h('div', { class: 'set-row' }, h('div', { class: 'lbl' }, h('span', {}, label), sub ? h('small', {}, sub) : null), control);
  const range = (value, min, max, stepv, fmt, onInput) => {
    const out = h('span', { class: 'range-val' }, fmt(value));
    const input = h('input', { type: 'range', min, max, step: stepv, value });
    input.addEventListener('input', () => { out.textContent = fmt(+input.value); onInput(+input.value); });
    input.addEventListener('change', () => save());
    return h('div', { class: 'range' }, input, out);
  };
  const choice = (on, onclick, art, label, sub) => h('button', { class: `setup-choice${on ? ' on' : ''}`, onclick: () => { onclick(); paint(); } },
    art, h('span', { class: 'sc-l' }, h('b', {}, label), sub ? h('small', {}, sub) : null), h('span', { class: 'tick', html: icon('check') }));
  const title = (t, sub) => [h('h1', {}, t), sub ? h('p', { class: 'setup-sub' }, sub) : null];
  const sub = (t) => h('div', { class: 'setup-h' }, t);

  const applyLook = () => {
    Object.assign(ws, { colors: [...model.colors], color: model.colors[0], intensity: model.intensity, grain: model.grain });
    applyTheme(); render();
    const m = root.querySelector('.setup-mark');
    if (m && st.appIcon === 'space') m.innerHTML = logoSvg();
  };
  const layoutPref = (key, v) => { st[key] = v; save(); applyLayout(); updateChrome(); };
  const mockOpts = (o = {}) => ({ layout: st.toolbarLayout, mode: sidebarMode(), side: st.sidebarSide, flat: st.pageStyle === 'flat', ...o });

  const views = {
    welcome: () => h('div', { class: 'setup-welcome' },
      h('div', { class: 'logo-big', html: RT ? vortexSvg({ anim: true, bg: false }) : logoSvg() }),
      ...title('Welcome to Oto', 'A calm browser with vertical tabs, spaces and built-in ad blocking. Let’s make it yours — it takes about two minutes.'),
      RT ? h('div', { class: 'setup-tags' }, ...['Layout', 'Look', 'Speed', 'Privacy'].map((t, i) => h('span', {}, h('i', {}, String(i + 1).padStart(2, '0')), t)))
        : h('div', { class: 'setup-pills' }, ...(RT ? ['Your layout', 'Your look', 'Your speed', 'Your privacy'] : ['Your layout', 'Your colours', 'Your speed', 'Your privacy']).map((t) => h('span', {}, t)))),

    import: () => {
      if (!sources) oto.bookmarkSources().then((s) => { sources = s || []; if (STEPS[step][0] === 'import') paint(); });
      return h('div', {},
        ...title('Bring your stuff', 'Import bookmarks from the browser you use now, and make Oto the one that opens your links.'),
        typeof V1A !== 'undefined' && V1A.st && V1A.st.configured && !V1A.st.signedIn ? line('Already have an Oto account?', 'Sign in and your settings, bookmarks, spaces, card and passwords come back.',
          h('button', { class: 'btn primary', onclick: () => { finish(); setTimeout(() => openSettings('account'), 260); } }, 'Sign in')) : null,
        sub('Bookmarks'),
        sources == null ? h('p', { class: 'setup-note' }, 'Looking for other browsers…')
          : !sources.length ? h('p', { class: 'setup-note' }, 'No other browsers found on this PC. You can import an exported bookmarks file later in Settings → Bookmarks.')
            : h('div', { class: 'setup-import' }, ...sources.map((s) => h('div', { class: 'setup-imp' },
              h('span', { class: 'imp-ic', html: icon('globe') }), h('b', {}, s.name),
              imported.has(s.id) ? h('span', { class: 'imp-done', html: `${icon('check')} Imported` })
                : h('button', { class: 'btn', onclick: async () => { await importFromBrowser(s.id, s.name); imported.add(s.id); paint(); } }, 'Import')))),
        sub('Default browser'),
        line('Make Oto your default browser', 'Links from other apps will open in Oto. Windows asks you to confirm.',
          h('button', { class: 'btn', onclick: async () => { const r = await oto.makeDefaultBrowser(); if (r === 'set') toast('Oto is now your default browser'); } }, 'Set as default')),
        line('Show the bookmarks bar', 'Your bookmarks at the top of the window.', sw(st.showBookmarks, (on) => { layoutPref('showBookmarks', on); renderBookmarks(); })));
    },

    layout: () => h('div', {},
      ...title('Choose your layout', 'Pick how Oto is arranged. The little previews show what you get.'),
      RT ? null : sub('Toolbar'),
      RT ? null : h('div', { class: 'setup-choices two' },
        choice(st.toolbarLayout !== 'top', () => layoutPref('toolbarLayout', 'single'), setupMock(mockOpts({ layout: 'single', mode: 'expanded' })), 'Zen', 'Address and buttons live in the sidebar'),
        choice(st.toolbarLayout === 'top', () => layoutPref('toolbarLayout', 'top'), setupMock(mockOpts({ layout: 'top', mode: 'expanded' })), 'Classic', 'A toolbar across the top, like Chrome')),
      sub('Sidebar'),
      h('div', { class: 'setup-choices three' },
        ...[['expanded', 'Full', 'Tabs with titles'], ['collapsed', 'Icons', 'Slim — grows when you hover'], ['hidden', 'Hidden', 'Slides in from the edge']].map(([m, l, d]) =>
          choice(sidebarMode() === m, () => { setSidebarMode(m); save(); updateChrome(); }, setupMock(mockOpts({ mode: m })), l, d))),
      h('div', { class: 'setup-rows' },
        line('Sidebar side', null, seg([['left', 'Left'], ['right', 'Right']], st.sidebarSide, (v) => layoutPref('sidebarSide', v))),
        line('Pages', 'Floating gives pages a margin and soft shadow.', seg([['floating', 'Floating'], ['flat', 'Edge to edge']], st.pageStyle, (v) => layoutPref('pageStyle', v))),
        line('Auto-hide the top bar', 'More room for pages — touch the top edge to bring it back.', sw(st.autohideTop, (on) => layoutPref('autohideTop', on))))),

    colours: () => h('div', {},
      ...title('Pick your colours', 'Every space gets its own gradient. Drag the dots on the wheel or tap a preset — the window changes as you go.'),
      h('div', { class: 'setup-theme-row' }, h('span', {}, 'Appearance'),
        seg([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], st.theme, (v) => setTheme(v))),
      createGradientPicker(model, applyLook, { wide: true })),

    feel: () => {
      const cur = st.reduceMotion ? 'off' : st.animations;
      return h('div', {},
        ...title('Look & feel', 'How Oto moves and how big things are.'),
        sub('Animations'),
        h('div', { class: 'setup-choices three' },
          ...[['off', 'Off', 'Instant'], ['smooth', 'Smooth', 'Calm and quick'], ['playful', 'Playful', 'A little bounce']].map(([v, l, d]) =>
            choice(cur === v, () => {
              st.reduceMotion = false; st.animations = v;
              if (MOTION_PRESETS[v]) { st.animCurve = [...MOTION_PRESETS[v].curve]; st.animDuration = MOTION_PRESETS[v].ms; }
              applyCustomization(); save();
            }, h('div', { class: `setup-anim a-${v}` }, h('i')), l, d))),
        h('div', { class: 'setup-rows' },
          line('Interface size', null, range(st.uiScale || 1, 0.8, 1.3, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => { st.uiScale = v; applyCustomization(); })),
          line('Corner roundness', null, range(st.radius ?? 12, 0, 24, 1, (v) => `${v}px`, (v) => { st.radius = v; applyCustomization(); })),
          line('Tab height', null, seg([['compact', 'Compact'], ['default', 'Normal'], ['roomy', 'Roomy']], st.tabDensity, (v) => { st.tabDensity = v; applyCustomization(); save(); })),
          line('Font', null, h('select', { onchange: (e) => { st.uiFont = e.target.value; applyCustomization(); save(); } },
            ...Object.entries(UI_FONTS).map(([k, f]) => h('option', { value: k, selected: k === st.uiFont }, f[0]))))));
    },

    speed: () => {
      const cur = activePreset();
      return h('div', {},
        ...title('How fast should Oto be?', 'Oto can put tabs you’re not using to sleep, so your PC stays quick even with lots of tabs open.'),
        h('div', { class: 'setup-choices col' },
          ...[['balanced', 'leaf', 'Recommended for most PCs'], ['lean', 'bolt', 'Best for older PCs or laptops on battery'], ['off', 'play', 'Every tab stays live — uses the most memory']].map(([k, art, hint]) =>
            choice(cur === k, () => { Object.assign(st, PERF_PRESETS[k].set); applyCustomization(); save(); if (k === 'off') thawAll(); housekeeping(); },
              h('span', { class: `setup-speed s-${k}` }, h('i'), h('i'), h('i')), PERF_PRESETS[k].name, `${PERF_PRESETS[k].desc}. ${hint}.`))),
        h('p', { class: 'setup-note' }, 'Tabs playing sound are never put to sleep. A sleeping tab wakes up instantly when you open it.'));
    },

    privacy: () => h('div', {},
      ...title('Search & privacy', 'Choose where your searches go and how private Oto should be.'),
      h('div', { class: 'setup-engines' }, ...Object.entries(ENGINES).map(([k, e]) => h('button', {
        class: `setup-engine${st.engine === k ? ' on' : ''}`,
        onclick: () => { st.engine = k; save(); paint(); },
      }, h('span', { class: 'radio' }), h('span', { class: 'en' }, h('b', {}, e.name), h('small', {}, ENGINE_NOTES[k] || ''))))),
      h('div', { class: 'setup-toggles' },
        line('Block ads & trackers', 'Uses the same filter lists as uBlock Origin.', sw(st.blockTrackers, async (on) => { st.blockTrackers = on; save(); INFO.blocking = await oto.setBlocking(on); })),
        line('Ask sites not to sell my data', 'Sends Global Privacy Control and Do Not Track.', sw(st.gpc, (on) => setPref('gpc', on))),
        line('Search suggestions', 'Shows suggestions while you type.', sw(st.suggestions, (on) => { st.suggestions = on; save(); })),
        line('Clear cookies when Oto closes', 'Most private — you’ll be signed out of sites each time.', sw(st.clearOnExit, (on) => setPref('clearOnExit', on))))),

    essentials: () => h('div', {},
      ...title('Choose your Essentials', 'Your favourite sites, always one click away at the top of the sidebar — in every space.'),
      h('div', { class: 'setup-sites' }, ...SETUP_SITES.map(([name, url]) => {
        const host = hostOf(url);
        const on = picked.has(host);
        return h('button', {
          class: `setup-site${on ? ' on' : ''}`,
          onclick: () => { if (on) picked.delete(host); else picked.add(host); paint(); },
        }, favEl({ url, title: name, favicon: '' }, null, true), h('span', {}, name), h('span', { class: 'tick', html: icon('check') }));
      })),
      h('p', { class: 'setup-note' }, `${picked.size} selected`)),

    done: () => h('div', { class: 'setup-welcome' },
      h('div', { class: 'logo-big', html: RT ? vortexSvg({ anim: true, bg: false }) : logoSvg() }),
      ...title('You’re all set', 'A few shortcuts worth knowing:'),
      h('div', { class: 'setup-tips' },
        ...[['Ctrl T', 'Search, open a site or jump to a tab'], ['Ctrl B', 'Hide or show the sidebar'], ['Right-click a link', 'Open it in Glance — a floating preview'],
          ['Ctrl Shift S', 'Split view — two tabs side by side'], ['Ctrl Shift 1…9', 'Switch spaces'], ['Ctrl ,', 'All settings']]
          .map(([k, t]) => h('div', { class: 'setup-tip' }, h('kbd', {}, k), h('span', {}, t))))),
  };

  function paint() {
    const key = STEPS[step][0];
    const scroll = body.scrollTop;
    const view = views[key]();
    if (RT) {
      const n = String(step + 1).padStart(2, '0'), all = String(STEPS.length).padStart(2, '0');
      view.prepend(h('div', { class: 'rt-crumb' }, h('span', { class: 'rt-dash' }), h('span', { class: 'rt-kanji' }, '音'),
        h('span', {}, `SETUP / ${STEPS[step][1].toUpperCase()}`), h('span', { class: 'rt-rule' }), h('span', {}, `${n} / ${all}`)));
    }
    body.replaceChildren(view);
    body.className = `setup-body step-${key}`;
    body.scrollTop = scroll;
    rail.replaceChildren(...STEPS.map(([k, label], i) => h('button', {
      class: `${i === step ? 'on' : ''}${i < step ? ' done' : ''}`, disabled: i > reached,
      onclick: () => go(i),
    }, h('span', { class: 'st-dot', html: i < step ? icon('check') : String(i + 1) }), label)));
    progress.firstChild.style.width = `${(step / (STEPS.length - 1)) * 100}%`;
    back.style.visibility = step === 0 ? 'hidden' : 'visible';
    next.textContent = step === 0 ? 'Get started' : step === STEPS.length - 1 ? 'Start browsing' : 'Continue';
    skip.style.visibility = step === STEPS.length - 1 ? 'hidden' : 'visible';
  }
  function go(n) {
    if (n >= STEPS.length) return finish();
    const dir = n > step ? 1 : -1;
    step = clamp(n, 0, STEPS.length - 1);
    reached = Math.max(reached, step);
    body.scrollTop = 0;
    paint();
    body.animate([{ opacity: 0, transform: `translateX(${dir * 18}px)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function applyEssentials() {
    const listHosts = new Set(SETUP_SITES.map(([, u]) => hostOf(u)));
    for (const t of essentials()) {
      if (listHosts.has(hostOf(t.url)) && !picked.has(hostOf(t.url))) {
        destroyView(t.id);
        S.tabs = S.tabs.filter((x) => x.id !== t.id);
        for (const k of Object.keys(S.active)) if (S.active[k] === t.id) delete S.active[k];
      }
    }
    const have = new Set(essentials().map((t) => hostOf(t.url)));
    const lastEss = S.tabs.reduce((i, t, idx) => (t.essential ? idx : i), -1);
    const add = SETUP_SITES.filter(([, u]) => picked.has(hostOf(u)) && !have.has(hostOf(u)))
      .map(([name, url]) => ({ id: uid(), url, title: name, favicon: '', ws: S.activeWs, pinned: false, essential: true }));
    S.tabs.splice(lastEss + 1, 0, ...add);
  }

  function finish() {
    applyEssentials();
    S.onboarded = true;
    save();
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => root.remove();
    if (!activeTab()) showNothing(); else render();
    updateChrome();
  }

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !['INPUT', 'BUTTON', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); go(step + 1); }
  });
  paint();
  setTimeout(() => next.focus(), 50);
}
