# Setting up Oto feedback (one time)

Oto's Feedback page (Settings → Feedback, or About → Send feedback) sends messages to a small service on Oto's
Supabase project. The service saves every message and emails **bug reports** to you from Oto's Gmail.

Gmail's password lives only in Supabase's secret settings. It is never in Oto, in this repository, or in a chat.

## 1. Make the table

Supabase → **SQL Editor** → New query → paste all of [`supabase/feedback.sql`](../supabase/feedback.sql) → **Run**.

This makes the `feedback` table. Only the service can read or write it. You can read it yourself in
**Table Editor → feedback**.

## 2. Make a Gmail app password for Oto's Gmail

1. Sign in to Google as otosupportofficial@gmail.com.
2. Turn on **2-Step Verification**, if it's off: Google Account → Security.
3. Go to Google Account → Security → **App passwords**. Make one named "Oto feedback".
4. Google shows a 16-letter password once. Keep that page open for step 3. Don't paste it anywhere else.

## 3. Add the secrets

Supabase → **Edge Functions** → **Secrets** → add these:

| Name | Value |
| --- | --- |
| `GMAIL_USER` | `otosupportofficial@gmail.com` |
| `GMAIL_APP_PASSWORD` | the 16-letter app password from step 2 (spaces don't matter) |
| `FEEDBACK_TO` | your personal email, where bug reports should arrive |
| `FEEDBACK_SALT` | any long random text, for example 40 letters and numbers mashed on the keyboard |
| `FEEDBACK_EMAIL_ALL` | *optional*: `1` to also email ideas and other messages, not only bugs |

## 4. Deploy the function

Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**:

1. Name it exactly `oto-feedback`.
2. Replace the example code with all of [`supabase/oto-feedback.bundle.ts`](../supabase/oto-feedback.bundle.ts).
3. Click **Deploy**.
4. Open the function's **Settings** (or Details), turn **Verify JWT** (also called "Enforce JWT verification")
   **off**, and save.

   Oto signs in to Supabase with a publishable key, not a JWT. The function checks every message itself and
   limits how many can come from one place: 5 per hour and 20 per day.

If you use the Supabase CLI instead: `supabase functions deploy oto-feedback` (the setting is in
`supabase/config.toml`).

## 5. Try it

In Oto: Settings → **Feedback** → Bug → write something → **Send to Oto**.

- You should get an email titled "🐞 Oto bug: …" from Oto Feedback.
- **Reply** answers the person, if they gave their address.
- The message also appears in Table Editor → feedback.

If the email doesn't come, open Edge Functions → oto-feedback → **Logs**. A line starting with `email` shows
Gmail's reason, for example a wrong app password. The message is still saved even when the email fails.

## What is saved

The kind, the message, a reply address (only if the person gave one), Oto's version, the Windows version and the
optional technical report.

The service never saves the sender's IP address, only a scrambled form of it for the spam limit.
`supabase/feedback.sql` has a line to blank those out after 30 days.

To change the code: edit `supabase/functions/oto-feedback/`, run `node scripts/feedback-bundle.js`, then deploy
the new bundle.
