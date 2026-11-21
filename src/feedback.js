// Oto — Feedback page in Settings (1.8.1). Bug / Idea / Other, a message, an optional reply address and (for bugs)
// the small technical report from About. "Send to Oto" goes to Oto's feedback service (main/feedback.js), which
// emails bug reports to Oto's maker; "Post on GitHub" opens a filled-in GitHub issue in a new tab instead.
/* global PAGES, PAGE_RENDER, ACTIONS, ICONS, h, icon, oto, section, renderSettings, openSettings, newTab, toast, buildReport */

const FB = { kind: 'bug', message: '', contact: '', report: true, busy: false, note: null, info: null };
const FB_KINDS = [
  ['bug', 'Bug', 'Something broke or acts strangely'],
  ['idea', 'Idea', 'Something you\'d like Oto to do'],
  ['other', 'Other', 'Anything else'],
];
const FB_HINT = {
  bug: 'What happened? What did you expect instead? If you can, how to make it happen again.',
  idea: 'What would you like Oto to do, and why would it help you?',
  other: 'What\'s on your mind?',
};
const FB_MIN = 10, FB_MAX = 4000;

ICONS.fbBug = '<path d="M5 21V4M5 4.5h11l-2 3.5 2 3.5H5"/>';
ICONS.fbIdea = '<path d="M9 17h6M10 20.5h4M8.2 13.6A5.5 5.5 0 1 1 15.8 13.6c-.8.8-1.3 1.6-1.3 2.4h-5c0-.8-.5-1.6-1.3-2.4z"/>';
ICONS.feedback = '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 9h7M8.5 12h4"/>';

async function fbPayload() {
  return { kind: FB.kind, message: FB.message, contact: FB.contact, report: FB.kind === 'bug' && FB.report ? await buildReport().catch(() => '') : '' };
}

async function fbSend() {
  if (FB.busy) return;
  FB.busy = true; FB.note = null; renderSettings();
  let r;
  try { r = await oto.feedback.send(await fbPayload()); } catch { r = { ok: false, error: 'Something went wrong sending it. Try again.' }; }
  FB.busy = false;
  if (r && r.ok) {
    FB.note = { ok: true, text: FB.kind === 'bug' ? 'Thanks! Your bug report was sent to Oto\'s maker.' : 'Thanks! Your message was sent to Oto\'s maker.' };
    FB.message = ''; FB.contact = '';
    toast('Feedback sent, thank you', { icon: 'check', timeout: 2200 });
  } else {
    FB.note = { ok: false, text: (r && r.error) || 'Couldn\'t send it. Try again.' };
  }
  renderSettings();
}

async function fbGithub() {
  const url = await oto.feedback.github({ kind: FB.kind, message: FB.message });
  if (typeof url === 'string' && url.startsWith('https://github.com/mukairyo/oto/issues/new?')) newTab(url);
}

PAGES.splice(PAGES.findIndex((p) => p[0] === 'about'), 0, ['feedback', 'Feedback', 'feedback']);
PAGE_RENDER.feedback = function feedbackPage() {
  if (!FB.info) oto.feedback.info().then((i) => { FB.info = i; if (document.querySelector('.set-pane[data-page="feedback"]')) renderSettings(); }).catch(() => {});
  const n = FB.message.trim().length;
  const count = h('span', { class: `fb-count${n > FB_MAX ? ' over' : ''}` }, n < FB_MIN ? `${FB_MIN - n} more to go` : `${n} / ${FB_MAX}`);
  const msg = h('textarea', { class: 'fb-msg', placeholder: FB_HINT[FB.kind], maxlength: String(FB_MAX + 200), 'aria-label': 'Your message', spellcheck: 'true' });
  msg.value = FB.message;
  const ready = () => FB.message.trim().length >= FB_MIN && FB.message.trim().length <= FB_MAX;
  const sendBtn = h('button', { class: 'btn primary fb-send', disabled: FB.busy || !ready(), onclick: fbSend }, FB.busy ? 'Sending…' : 'Send to Oto');
  const ghBtn = h('button', { class: 'btn fb-gh', disabled: !ready(), onclick: fbGithub, title: 'Opens a filled-in issue on GitHub in a new tab. It will be public.' }, 'Post on GitHub instead');
  msg.addEventListener('input', () => {
    FB.message = msg.value;
    const m = FB.message.trim().length;
    count.textContent = m < FB_MIN ? `${FB_MIN - m} more to go` : `${m} / ${FB_MAX}`;
    count.classList.toggle('over', m > FB_MAX);
    sendBtn.disabled = FB.busy || !ready(); ghBtn.disabled = !ready();
  });
  const mail = h('input', { class: 'text fb-mail', type: 'email', value: FB.contact, placeholder: 'you@example.com', spellcheck: 'false', autocomplete: 'email', 'aria-label': 'Your email (optional)' });
  mail.addEventListener('input', () => { FB.contact = mail.value.trim(); });
  const info = FB.info ? `Oto ${FB.info.version} · ${FB.info.os}` : '';
  return [
    h('p', { class: 'set-lead' }, 'Found a bug, or have an idea? Tell Oto\'s maker. Every message is read.'),
    h('div', { class: 'fb-kinds', role: 'radiogroup', 'aria-label': 'What is it?' }, ...FB_KINDS.map(([k, label, sub]) =>
      h('button', { class: `fb-kind${FB.kind === k ? ' on' : ''}`, role: 'radio', 'aria-checked': String(FB.kind === k), onclick: () => { FB.kind = k; FB.note = null; renderSettings(); } },
        h('span', { class: 'fb-kind-ic', html: icon(k === 'bug' ? 'fbBug' : k === 'idea' ? 'fbIdea' : 'feedback') }), h('b', {}, label), h('small', {}, sub)))),
    section(null,
      h('div', { class: 'fb-box' }, msg, count),
      h('label', { class: 'fb-field' }, h('span', {}, 'Your email, if you\'d like a reply'), h('small', {}, 'Optional. Only used to answer you.'), mail),
      FB.kind === 'bug' ? h('label', { class: 'fb-check' },
        h('input', { type: 'checkbox', checked: FB.report, onchange: (e) => { FB.report = e.target.checked; } }),
        h('span', {}, h('b', {}, 'Include the technical report'), h('small', {}, 'What the sidebar, top bar and window did recently, and your layout settings. Nothing about the sites you visit.'))) : null),
    FB.note ? h('div', { class: `fb-note ${FB.note.ok ? 'ok' : 'bad'}`, role: 'status' }, h('span', { html: icon(FB.note.ok ? 'check' : 'triangle') }), FB.note.text) : null,
    h('div', { class: 'fb-actions' }, h('span', { class: 'fb-info' }, info ? `Also sent: ${info}` : ''), h('div', { class: 'btn-pair' }, ghBtn, sendBtn)),
    h('p', { class: 'set-note' }, '"Send to Oto" goes privately to Oto\'s maker. "Post on GitHub" opens a public issue that anyone can see and add to (you need a GitHub account).'),
  ];
};

ACTIONS.push({ name: 'Send feedback', kw: 'feedback bug report idea suggestion contact', icon: 'feedback', run: () => openSettings('feedback') });
