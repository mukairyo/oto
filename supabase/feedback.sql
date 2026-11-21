-- Oto feedback (1.8.1): run once in Supabase → SQL Editor. Messages from Oto's Feedback page are saved here by the
-- oto-feedback Edge Function. Nobody else can read or write this table: row level security is on with no rules, and
-- the public keys have no access. You can read it in Supabase → Table Editor → feedback.
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('bug', 'idea', 'other')),
  message     text not null check (char_length(message) between 10 and 4000),
  contact     text check (contact is null or char_length(contact) <= 254),
  oto_version text check (oto_version is null or char_length(oto_version) <= 40),
  os          text check (os is null or char_length(os) <= 80),
  report      text check (report is null or char_length(report) <= 60000),
  ip_hash     text not null check (char_length(ip_hash) = 64),
  emailed     boolean not null default false
);
alter table public.feedback enable row level security;
revoke all on table public.feedback from anon, authenticated;
create index if not exists feedback_ip_time on public.feedback (ip_hash, created_at desc);

-- Spam limits only need the last day: forget the scrambled IP after 30 days (run now and then, or schedule it).
-- update public.feedback set ip_hash = repeat('0', 64) where created_at < now() - interval '30 days';
