# Privacy

Short version: Oto has **no telemetry, no analytics and no crash reporting**. Your browsing stays on your PC unless you
turn on sync, and sync is encrypted before it leaves your PC.

## What stays on your PC

- History, open tabs, Spaces, bookmarks, settings, themes, Oto Card and downloads list.
- Saved passwords, encrypted with Windows' data protection (DPAPI).
- Oto Shield's blocked-ads counts and per-site settings.
- Site permissions (camera, microphone, location, cookies…).

All of it lives in Oto's folder in `%APPDATA%`. Private windows (Avocado) keep cookies, site storage and cache in memory
only, never write them to disk, and wipe them when the last private window closes. Private tabs don't go into your
history or saved tabs. (Before 1.3.3, private tabs wrongly used the normal saved session. That's fixed and tested.)

## What leaves your PC, and why

| What | Sent to | When |
| --- | --- | --- |
| The pages you visit | those websites | when you browse (like any browser) |
| What you type in the address bar | your search engine's suggestion service (DuckDuckGo, Google, Brave or Bing) | while you type, if suggestions are on |
| Ad/tracker filter lists (download only) | GitHub (`raw.githubusercontent.com`, uBlock Origin / EasyList lists) | about once a week |
| Malware and phishing lists (download only) | `malware-filter.gitlab.io`, `curbengh.github.io` or `malware-filter.pages.dev` | at most twice a day (checked hourly, downloaded when 12 hours old) |
| Update check (download only) | GitHub (`github.com`, `api.github.com`) | at start, then every 30 minutes |
| Widevine (protected video) | Google's component server | once, so Netflix/Spotify can play |
| **Sync (only if you sign in)** | Supabase (`supabase.co`), Oto's account server | after changes, and every few minutes |

The filter, malware and update downloads don't send anything about you or the pages you visit. The dangerous-site check
happens **on your PC** against the downloaded list. No website addresses are sent anywhere for it.

## Oto Accounts (sync)

- Optional. Without an account, nothing is synced.
- Before upload, your settings, Spaces, bookmarks, themes, Oto Card and (if you choose) passwords are encrypted on your PC
  with a key made from your account password. The server stores only the encrypted blob, your email address, the device
  name and when it last synced. **The server can't read your data.** Not even Oto's developer can.
- Deleted passwords leave a small marker (site and username, never the password) so a deletion reaches your other
  devices. Markers don't expire; Oto keeps the newest 5,000. Only a device that stayed offline while more than 5,000
  other logins were deleted could bring back one of the oldest.
- If you reset your account password by email, data encrypted with the old password can't be read any more.
- Sending a tab to your phone stores the link (encrypted) until the phone picks it up.
- To delete your cloud data: Settings → Account & sync → **Delete cloud data**. This PC keeps its own copy.

## Protection features, honestly

- **Oto Shield** blocks ads and trackers with uBlock Origin's lists plus Oto's own. It doesn't make a site "safe".
- **Fingerprint protection** adds tiny random changes to canvas, WebGL and audio readings, different for every site and
  every session. It makes tracking harder, but it doesn't make you anonymous. It's switched off inside "are you human?"
  checks (Cloudflare, hCaptcha, reCAPTCHA) so they let you through.
- **Global Privacy Control** and **Do Not Track** signals are sent to every site.

## Backups

A `.oto` backup made **with** a backup password is fully encrypted (everything in it, plus your saved passwords). A
backup made **without** a password is readable by anyone who opens the file and never contains passwords. Oto warns you
before saving one.

## "Clear when Oto closes"

Oto clears when you close it (up to 5 seconds). If Oto is killed, crashes or the PC loses power before that finishes,
Oto clears at the next start, before you browse. A forced close can't run any code, so until that next start the data
is still on disk.

Questions: open an issue on [GitHub](https://github.com/mukairyo/oto/issues).
