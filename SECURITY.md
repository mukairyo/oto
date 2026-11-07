# Security

Oto is a young browser made by one developer and is still **beta**. Please read this before trusting it with logins
you can't afford to lose, and report anything that looks wrong.

## Reporting a problem

Please **don't** open a public issue for a security problem. Use GitHub's private report instead:
**[Report a vulnerability](https://github.com/mukairyo/oto/security/advisories/new)** (Security tab → "Report a vulnerability").

Include what you did, what happened, and the Oto version (Settings → About). You'll get an answer as soon as possible,
and credit in the changelog if you'd like it.

## Supported versions

Only the newest release gets fixes. Oto updates itself, so restarting Oto when it says an update is ready is usually
all you need.

| Version | Supported |
| --- | --- |
| Newest release | ✅ |
| Anything older | ❌ — please update |

## How Oto protects you (and what it doesn't)

**Pages are kept away from Oto itself.** Every website runs in Chromium's sandbox with no access to Node.js. Oto's own
window only accepts messages from itself: one gatekeeper (`main/ipc-guard.js`) refuses messages from web pages, frames,
extension pages and app windows before any handler runs.

**Saved passwords** are encrypted with Windows' own data protection (DPAPI, the same thing Chrome uses). If Windows
can't encrypt, Oto refuses to save passwords rather than storing a readable copy. A password only enters a page when you
pick an account, only on the site it was saved for, and in a hidden script world the page can't read. Oto only offers to
save logins on secure (https) pages. Exporting to CSV always asks first, because the file is unencrypted.

**Oto Accounts / sync** encrypt everything on your PC (AES-256-GCM, key from your account password with scrypt)
before it's uploaded, so the server only stores scrambled data. Login tokens on your PC are encrypted with DPAPI too.

**Updates** come only from this repository's GitHub releases. Each release has a `SHA256SUMS.txt` and a signed GitHub
build attestation, so you can check a download really came from this repository's build:

```
gh attestation verify Oto-Setup-1.3.0.exe --repo mukairyo/oto
```

**Known limits (being worked on):**

- **The installer is not code-signed yet**, so Windows SmartScreen warns the first time. Use the checksums or the
  attestation above to check your download.
- Oto's own window UI runs without Chromium's sandbox (websites are sandboxed). It needs that for the extension toolbar.
- The PC lock was removed in owner.16. Oto doesn't lock itself — use Windows sign-in to keep other people out of your PC.
- Oto Shield's dangerous-site warnings use public malware and phishing lists. That helps, but it isn't the same as
  Google Safe Browsing.
- Fingerprint protection makes tracking harder. It does not make you anonymous.
- Extensions added from files or folders haven't been reviewed by any store. Oto shows what they ask for before adding
  them, and doesn't give them access to local files.

## For developers

```
npm ci
npm test       # unit tests (passwords, sync deletions, IPC gatekeeper, extension archives, account secrets)
npm run lint   # every file parses + security rules (no Base64 secrets, no code-injection channel, …)
```

Both run on every pull request and before every release; a failure stops the release.
