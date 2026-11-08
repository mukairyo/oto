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

**Pages are kept away from Oto itself.** Every website runs in Chromium's sandbox with no access to Node.js. Since
1.3.3, so do Oto's own windows: the extension toolbar module is built into the window's preload
(`scripts/build-preload.js`), so no window runs unsandboxed. Oto's core only accepts messages from Oto's own window: one gatekeeper (`main/ipc-guard.js`) refuses messages from web pages, frames,
extension pages and app windows before any handler runs.

**Saved passwords** are encrypted with Windows' own data protection (DPAPI, the same thing Chrome uses). If Windows
can't encrypt, Oto refuses to save passwords rather than storing a readable copy. A password only enters a page when you
pick an account, only on the site it was saved for, and in a hidden script world the page can't read. The only time a
password reaches Oto's own window is when you press show or copy on a saved login in the Library. Oto only offers to
save logins on secure (https) pages. Exporting to CSV always asks first, because the file is unencrypted. Saving is
all-or-nothing: if the disk write fails, Oto says so and nothing changes. A passwords file that can't be read is set
aside, never overwritten.

**Oto Accounts / sync** encrypt everything on your PC (AES-256-GCM, key from your account password with scrypt)
before it's uploaded, so the server only stores scrambled data. Login tokens on your PC are encrypted with DPAPI too.

**Updates** come only from this repository's GitHub releases. What is checked automatically, and what you can check
yourself:

- **Automatic (every update):** Oto's updater (electron-updater) downloads only from `github.com/mukairyo/oto` releases
  over HTTPS, and refuses an installer whose SHA-512 doesn't match the one in that release's `latest.yml`.
  Both files come from the same release, so this alone catches broken downloads but not swapped release files.
- **Automatic, since 1.3.3 (every update):** before an update may install, Oto checks its GitHub build record itself
  (`main/attest.js`).
  - The record must be signed through Sigstore's public CA. Its root certificates are built into Oto.
  - It must name Oto's own release workflow (`release.yml` on `main` or `v1`), authenticated by GitHub Actions.
  - It must describe exactly the downloaded file's SHA-256.
  - It must be vouched for by Sigstore's public transparency log.

  A file that fails is deleted and not installed. If GitHub can't be reached, Oto waits and tries again. It never
  installs unchecked. Only a run of Oto's own release workflow can produce a record that passes, so uploading a changed
  installer to a release isn't enough.
- **Not automatic:** `SHA256SUMS.txt` (for people to check by hand). There is no Windows code signature yet
  (Authenticode needs a paid or sponsored certificate).
- **By hand:** check a download came from this repository's own build. In PowerShell, in the folder with the file
  (replace `X.Y.Z` with the version you downloaded):

```powershell
(Get-FileHash .\Oto-Setup-X.Y.Z.exe -Algorithm SHA256).Hash   # compare with the line in SHA256SUMS.txt
gh attestation verify .\Oto-Setup-X.Y.Z.exe --repo mukairyo/oto # needs the GitHub CLI
```

- **After every release:** a separate job downloads the installer exactly as the public gets it and checks its
  SHA-256, the build attestation, and that `latest.yml` (what the updater trusts) describes that exact file.

**Downloads:** every finished download is tagged by Windows as "from the internet" (Mark of the Web), so SmartScreen
and Office warn before running or editing it. Opening a program, script, shortcut or disk image from Oto always asks
first. Downloads from (or redirected through) known malware or phishing sites are stopped. Oto never opens a download
by itself.

**Extensions** from the Chrome Web Store show what they can access before you add them, and Oto keeps them updated
from the Web Store, checking each update's signature. Private windows run no extensions.

**Known limits (being worked on):**

- **The installer is not code-signed yet**, so Windows SmartScreen warns the first time. Use the checksums or the
  attestation above to check your download.
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

Both run on every push to every branch (main included, version bump or not), on every pull request, and again before
every release build; a failure stops the release.

**Channels the gatekeeper leaves open** (they are meant for pages or libraries, and each checks its own callers):
`oto:page` (returns only on/off flags for the frame that asks), `crx-*` (electron-chrome-extensions: extension APIs,
routed by extension ID), `@ghostery/*` (cosmetic filters for the asking frame's URL), `chromeWebstore.*` / `chrome.*`
(electron-chrome-web-store: refuses any sender that isn't `chromewebstore.google.com`).
