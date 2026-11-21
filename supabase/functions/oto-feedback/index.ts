// Oto feedback service (Supabase Edge Function "oto-feedback"). Receives messages from Oto's Feedback page, saves them
// in the feedback table and emails bug reports to Oto's maker from Oto's Gmail. Setup: docs/FEEDBACK_SETUP.md.
//
// Secrets (Supabase → Edge Functions → Secrets; never in Oto or the repository):
//   GMAIL_USER          Oto's Gmail address (the sender)
//   GMAIL_APP_PASSWORD  a Google "app password" for that Gmail
//   FEEDBACK_TO         where reports go (your personal email)
//   FEEDBACK_SALT       any long random text (spam limits keep only a scrambled form of the sender's IP)
//   FEEDBACK_EMAIL_ALL  optional: "1" to email ideas and other messages too, not only bugs
// SUPABASE_URL and the project's keys (SUPABASE_SECRET_KEYS) are provided by Supabase inside the function itself.
import nodemailer from 'npm:nodemailer@6';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { makeHandler } from './handler.mjs';

const env = (k: string) => Deno.env.get(k) || '';
// The project's secret key (Supabase's new keys, given to the function as SUPABASE_SECRET_KEYS; the old
// service_role key is only a fallback, as Supabase is retiring it). It stays inside Supabase.
function secretKey() {
  try { const k = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}'); if (k && typeof k.default === 'string' && k.default) return k.default; } catch { /* not set */ }
  return env('SUPABASE_SERVICE_ROLE_KEY');
}
const db = createClient(env('SUPABASE_URL'), secretKey(), { auth: { persistSession: false } });

// Gmail over port 465 (Edge Functions can't use port 587 or 25)
const gmail = env('GMAIL_USER') && env('GMAIL_APP_PASSWORD') && env('FEEDBACK_TO')
  ? nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: env('GMAIL_USER'), pass: env('GMAIL_APP_PASSWORD') } })
  : null;
if (!gmail) console.warn('oto-feedback: GMAIL_USER, GMAIL_APP_PASSWORD or FEEDBACK_TO not set: messages are saved but not emailed');

async function hash(text: string) {
  const data = new TextEncoder().encode(`${env('FEEDBACK_SALT') || 'oto-feedback'}|${text}`);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (b) => b.toString(16).padStart(2, '0')).join('');
}

const handle = makeHandler({
  hash,
  emailAll: env('FEEDBACK_EMAIL_ALL') === '1',
  sendMail: gmail ? (m: Record<string, unknown>) => gmail.sendMail({ from: `"Oto Feedback" <${env('GMAIL_USER')}>`, to: env('FEEDBACK_TO'), ...m }) : null,
  db: {
    async count(ipHash: string, since: string) {
      const { count, error } = await db.from('feedback').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since);
      if (error) throw error;
      return count || 0;
    },
    async insert(row: Record<string, unknown>) {
      const { data, error } = await db.from('feedback').insert(row).select('id').single();
      if (error) throw error;
      return data.id;
    },
    async markEmailed(id: number) {
      const { error } = await db.from('feedback').update({ emailed: true }).eq('id', id);
      if (error) throw error;
    },
  },
});

Deno.serve((req) => handle(req));
