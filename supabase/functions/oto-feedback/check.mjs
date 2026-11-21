// Oto feedback service: checking what arrives, and the email for Oto's maker. No imports, so the same file runs in
// the Supabase Edge Function (Deno) and in Oto's tests (Node). Mirrors main/feedback.js in the app.
export const KINDS = ['bug', 'idea', 'other'];
export const MIN = 10, MAX = 4000, REPORT_MAX = 60000;
const EMAIL_RE = /^[^\s@<>()",;:\\]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const text = (v) => String(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
const line = (v, max) => String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export function check(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Nothing to send.' };
  if (!KINDS.includes(body.kind)) return { ok: false, error: 'Pick Bug, Idea or Other.' };
  if (typeof body.message !== 'string') return { ok: false, error: 'Write a message.' };
  const message = text(body.message).trim();
  if (message.length < MIN || message.length > MAX) return { ok: false, error: `The message must be ${MIN} to ${MAX} characters.` };
  const contact = typeof body.contact === 'string' ? line(body.contact, 300) : '';
  if (contact && (contact.length > 254 || !EMAIL_RE.test(contact))) return { ok: false, error: 'That email address doesn\'t look right.' };
  const report = typeof body.report === 'string' ? text(body.report).slice(0, REPORT_MAX) : '';
  const version = typeof body.version === 'string' ? line(body.version, 40) : '';
  const os = typeof body.os === 'string' ? line(body.os, 80) : '';
  return { ok: true, value: { kind: body.kind, message, contact, report, version, os } };
}

const LABEL = { bug: 'Bug', idea: 'Idea', other: 'Other' };

// The email Oto's Gmail sends to Oto's maker.
export function mailFor(v, id) {
  const first = line(v.message.split('\n')[0], 70);
  return {
    subject: `${v.kind === 'bug' ? '🐞 Oto bug' : v.kind === 'idea' ? '💡 Oto idea' : '✉️ Oto feedback'}: ${first}`,
    text: [
      `Kind: ${LABEL[v.kind]}`,
      `Oto: ${v.version || '?'} · ${v.os || '?'}`,
      `Reply to: ${v.contact || 'no address given'}`,
      `Feedback #${id}`,
      '',
      v.message,
      '',
      v.report ? '(The technical report is attached as report.txt.)' : '(No technical report.)',
      '',
      '— Sent by Oto\'s feedback form. Reply to this email to answer the person, if they gave an address.',
    ].join('\n'),
    replyTo: v.contact || undefined,
    attachments: v.report ? [{ filename: 'report.txt', content: v.report, contentType: 'text/plain; charset=utf-8' }] : [],
  };
}
