'use strict';
// Oto feedback (1.8.1): the Feedback page in Settings sends a bug report, an idea or anything else to Oto's own
// feedback service (a Supabase Edge Function, supabase/functions/oto-feedback). That service saves it and emails bug
// reports to Oto's maker from Oto's Gmail. The Gmail password lives only in that service's settings, never in Oto.
//
// What's sent: the kind, what you wrote, a reply address only if you give one, Oto's version and Windows version,
// and (only if you tick it) the small technical report from About → Report a problem, which has nothing about the
// sites you visit. The window can't choose the address it goes to, and every field is checked again here.
const os = require('os');

const KINDS = ['bug', 'idea', 'other'];
const MIN = 10, MAX = 4000, REPORT_MAX = 60000;
const EMAIL_RE = /^[^\s@<>()",;:\\]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const NOTE_GAP = 30 * 1000, DAY_MAX = 10;

// (no control characters except line breaks and tabs in what you wrote; none at all in one-line fields)
const text = (v) => String(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
const line = (v) => String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

// Returns { ok: true, value } or { ok: false, error } (error is a short sentence for the window).
function clean(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Nothing to send.' };
  const kind = KINDS.includes(input.kind) ? input.kind : null;
  if (!kind) return { ok: false, error: 'Pick Bug, Idea or Other.' };
  const message = text(input.message == null ? '' : input.message).trim();
  if (message.length < MIN) return { ok: false, error: `Write a little more (at least ${MIN} characters).` };
  if (message.length > MAX) return { ok: false, error: `That's too long (at most ${MAX} characters).` };
  const contact = line(input.contact == null ? '' : input.contact);
  if (contact && (contact.length > 254 || !EMAIL_RE.test(contact))) return { ok: false, error: 'That email address doesn\'t look right (or leave it empty).' };
  let report = input.report == null ? '' : text(input.report);
  if (report.length > REPORT_MAX) report = `${report.slice(0, REPORT_MAX - 40)}\n… (report cut to fit)`;
  return { ok: true, value: { kind, message, contact, report } };
}

// GitHub issue in Oto's repository, filled in with the same text (for people who'd rather post in public).
function githubIssueUrl({ kind, message, version, osName }) {
  const k = KINDS.includes(kind) ? kind : 'other';
  const first = text(message || '').trim().split('\n')[0].slice(0, 70);
  const title = `${k === 'bug' ? '[Bug] ' : k === 'idea' ? '[Idea] ' : ''}${first}`;
  const body = `${text(message || '').trim().slice(0, 3000)}\n\n---\nOto ${line(version || '?')} · ${line(osName || '?')}`;
  const q = new URLSearchParams({ title, body, labels: k === 'bug' ? 'bug' : k === 'idea' ? 'idea' : '' });
  if (!q.get('labels')) q.delete('labels');
  return `https://github.com/mukairyo/oto/issues/new?${q.toString()}`;
}

function osName() {
  if (process.platform !== 'win32') return `${process.platform} ${os.release()}`;
  const build = Number(os.release().split('.')[2] || 0);
  return `Windows ${build >= 22000 ? '11' : '10'} (build ${build || os.release()})`;
}

function createFeedback({ net, url, key, version, now = Date.now }) {
  const sent = []; // times of sends today, for a gentle limit here (the service has its own)
  async function send(input) {
    const c = clean(input);
    if (!c.ok) return c;
    const t = now();
    while (sent.length && t - sent[0] > 24 * 3600 * 1000) sent.shift();
    if (sent.length && t - sent[sent.length - 1] < NOTE_GAP) return { ok: false, error: 'You just sent one: wait a few seconds.' };
    if (sent.length >= DAY_MAX) return { ok: false, error: 'That\'s a lot for one day: please try again tomorrow.' };
    if (!url) return { ok: false, error: 'Feedback isn\'t set up in this copy of Oto.' };
    const body = JSON.stringify({ ...c.value, version, os: osName() });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 20000);
    let res;
    try {
      res = await net.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key }, body, signal: ac.signal });
    } catch { return { ok: false, error: 'Couldn\'t reach Oto\'s feedback service. Check your connection and try again.' }; } finally { clearTimeout(timer); }
    let j = {};
    try { j = await res.json(); } catch { /* not JSON */ }
    if (res.status === 429) return { ok: false, error: 'Too many messages from here right now: try again later.' };
    if (!res.ok || !j.ok) return { ok: false, error: typeof j.error === 'string' && j.error.length < 200 ? j.error : `Oto's feedback service said no (${res.status}).` };
    sent.push(t);
    return { ok: true, emailed: !!j.emailed };
  }
  return {
    send,
    info: () => ({ version, os: osName(), configured: !!url }),
    githubUrl: (input) => githubIssueUrl({ ...(input || {}), version, osName: osName() }),
    setupIPC(ipcMain) {
      ipcMain.handle('feedback:send', (_e, input) => send(input));
      ipcMain.handle('feedback:info', () => ({ version, os: osName(), configured: !!url }));
      ipcMain.handle('feedback:github', (_e, input) => githubIssueUrl({ ...(input || {}), version, osName: osName() }));
    },
  };
}

module.exports = { createFeedback, clean, githubIssueUrl, KINDS, MIN, MAX, REPORT_MAX };
