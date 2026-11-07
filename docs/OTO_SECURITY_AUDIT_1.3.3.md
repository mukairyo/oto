# Oto 1.3.3 — Security Audit Report

**Version:** 1.3.3 (from 1.3.2) · **Date:** 2026-11-08 · **Branch:** `oto-1.3.3` · **Electron:** 45.2.1+wvcus (castlabs) · **Electron Builder:** 26.18.0

**Scope:** the 12 tasks in the 1.3.3 security hardening brief, the 1.3.2 code review, and Oto's own testing in eight
areas: passwords, IPC/sandbox, extensions, Oto Shield, downloads, updates, automated tests and privacy.

**Method:**
- Code review of the main process, preload scripts and UI.
- Unit tests in Node.
- End-to-end runs of the real castlabs Electron 45.2.1 build against local test sites (Linux, Xvfb).
- GitHub Actions on Windows for packaging.

Each suspected issue was reproduced before it was fixed. Where possible, the fix was also checked against the 1.3.2
code to confirm the issue really existed there.

> Passing tests don't prove a browser is secure. Section 9 lists what still needs manual or independent testing.

---

## 1. Summary

| | |
|---|---|
| Confirmed vulnerabilities fixed | **6** (1 critical, 2 high, 2 medium, 1 low/regression) |
| Reliability/safety defects fixed | 7 |
| Unit tests | **63 pass, 0 fail** (35 in 1.3.2) |
| Lint / security rules | 47 files pass |
| `npm audit --omit=dev` (what Oto ships) | **0 vulnerabilities** |
| `npm audit` (incl. build tools) | 6 moderate, all one build-time-only library. See §6 |
| Windows x64 unpacked build (GitHub Actions, `windows-latest`) | **Success**: 1,482 files in `app.asar`, contents check passed |
| End-to-end runs on the Widevine Electron build | all pass (§5.2) |
| Code signing | not configured (budget). Checksums and build attestations are kept |

---

## 2. Confirmed vulnerabilities

Each one was reproduced on 1.3.2 and fixed in 1.3.3, and each has a regression test.

### V1 — CRITICAL: private windows weren't private

**Problem:** Avocado (private) tabs ran in the normal saved session (`persist:oto`). Cookies, localStorage and
IndexedDB written in a private tab were stored on disk, stayed after the window closed, and were visible to normal
tabs.

**Cause:**
- `src/v1c.js` `v1PartitionFor()` deliberately returned `persist:oto` in private mode, relying on the main process to
  override it in `will-attach-webview` (`params.partition = AVOCADO`).
- Electron 45 ignores changes to `params.partition`, so the override silently did nothing.
- Present at least since the switch to Electron 45 (1.2.0).

**Reproduced:** in a private tab the webview's `session.getStoragePath()` was `…/Partitions/oto`. A cookie set
there showed up in a normal tab.

**Fix:**
- The UI requests `avocado` in private mode.
- Glance previews use the same session as the tab they were opened from.
- Fail-safe: both windows' `will-attach-webview` now **refuse** any page whose session isn't allowed. A private window
  only accepts `avocado`; a normal window only accepts `persist:oto` or a Space's `persist:oto-ws-*`. A bug can now
  only fail closed (the page doesn't load), never leak.
- Private-window downloads get the same safety checks as normal downloads.

**Verified:**
- Storage path is `null` (memory only).
- The cookie exists only while the window is open and is gone after closing.
- Normal tabs see nothing, and the private URL never reaches history or saved state.
- Glance opened from a Space uses that Space's session.

**Test:** `electron-config.test.js` › *private (Avocado) pages only ever run in the in-memory session*, plus the
end-to-end `avoclean` and `glsp` runs.

### V2 — HIGH: dangerous-site check bypass with a trailing dot

**Problem:** `http://evil.example./` (trailing dot) opens the same site, but the malware/phishing list lookup compared
the text exactly, so the page opened with no warning.

**Reproduced on 1.3.2:** the run "trailing dot: opened `http://evil.site./`".

**Fix:** `main/shield.js` normalises the host (lower case, trailing dots and IPv6 brackets removed) before every list
lookup. It does the same in the built-in fallback block list and in per-site exceptions.

**Verified:** these are now blocked:
- redirect, double redirect;
- trailing dot, uppercase, subdomain;
- phishing pages;
- dangerous content inside a normal page.

Tracker blocking (Ghostery engine) already held against trailing-dot, uppercase, explicit-port and encoded-path tricks.

### V3 — HIGH: account password change could make synced data unrecoverable

**Problem:** `account:changePassword` changed the server password first, then uploaded data re-encrypted with the new
key, unconditionally. If the second step failed, the server already had the new password but the cloud data still
needed the old one. The old key was thrown away. It also didn't run in the sync queue, so it could race a push or pull.

**Fix (`account.js`):** a resumable key-rotation job.
1. The new key is derived and saved **encrypted (DPAPI)** in `A.rotation`. The old key stays as the recovery path.
2. The server password is changed.
   - If the server rejects it, the job is dropped and nothing has changed.
   - If no answer comes back, the new password is kept sealed. On the next sync Oto signs in with it to find out
     whether the change happened before touching any data.
3. The cloud row is re-encrypted with a compare-and-swap write, retried if another device wrote in between.
4. Only once the cloud copy is confirmed under the new key is the old key dropped.

An unfinished job resumes automatically at the start of the next push or pull. The whole operation runs in the same
queue as sync.

**Tests:**
- normal change;
- upload fails after the password changed (finished on the next sync, data readable with the new password);
- answer lost, change went through;
- answer lost, change never reached the server (data left under the real key);
- runs after a running sync, never overlapping.

### V4 — MEDIUM: password saves could fail silently, and a damaged file could be overwritten

**Problems:**
- `pwSave()` swallowed write errors. A save, edit, delete or import could report success when nothing reached disk,
  and memory and disk could disagree.
- `readJSON` returned an empty store for an unreadable `passwords.json`, so the next save would overwrite it,
  permanently losing those passwords.

**Fix (`main/passwords.js`):**
- Every change runs in a transaction (`pwTx`). Memory is changed, then the file is written atomically (temp file plus
  rename, `writeJSON`). If the write fails, memory is rolled back and the caller gets `diskerror` or `{ ok: false }`.
- Imports and sync merges are one transaction each: all or nothing.
- An unreadable file is moved aside as `passwords.json.damaged-<time>` and the Library tells the user.
- The UI now checks every result and keeps the form open with the reason on failure.
- Still true: no new password is ever stored as Base64. Old Base64 entries migrate when DPAPI is available.
- CSV import refuses files over 20 MB or 100,000 rows and explains read errors. It reads asynchronously.

**Tests:**
- full disk (`ENOSPC`) on save, edit, delete and sync merge: nothing reports success, and memory and the file are
  unchanged;
- works again once the disk is fine;
- damaged file kept aside with its contents and reported;
- huge or unreadable CSV.

### V5 — MEDIUM: IPC size limit only checked the top level on "big" channels

**Problem:** for channels allowed large payloads, only the number of top-level keys was checked, so a 100 MB string
inside a one-key object passed.

**Fix (`main/ipc-guard.js`):**
- A bounded walk measures the whole message: strings at 2 bytes per character, binary data and keys included.
- It stops as soon as the limit is exceeded and refuses nesting deeper than 64 levels or more than 2 million nodes.
- It refuses functions, symbols and bigints.
- No re-serialisation.

**Tests:** a 100 MB string hidden at the top level and deep inside, a 3 MB message on a normal channel, 100 levels of
nesting, and a normal 2,000-tab state that must still fit.

### V6 — LOW (functional regression from 1.3.2): large screenshots refused

**Problem:** 1.3.2's 1 MB default limit also applied to `shot:save`, so full-page screenshots over about 1 MB were
refused. **Reproduced** with 1.3.2's gatekeeper: a 4 MB screenshot was `REFUSED`.

**Fix:** per-channel limits for every channel that carries images or whole-state data (`shot:save`,
`clipboard:image`, `app:install`, `app:icon`, `shield:filters`, `devices:beat` …).

**Test:** *large screenshots, images and saved state still get through*.

---

## 3. Other hardening in 1.3.3

These are verified improvements without a confirmed exploit behind them.

| Area | Change | File(s) |
|---|---|---|
| Downloads | Every finished download gets Windows' Mark of the Web (`Zone.Identifier`, ZoneId=3), so SmartScreen and Office Protected View apply. | `main.js` |
| Downloads | Opening programs, scripts, shortcuts or disk images (`.exe .msi .bat .cmd .ps1 .vbs .js .lnk .iso .hta .jar .reg …`) from Oto always asks first, with Cancel as the default. Oto never opens downloads automatically. | `main.js` |
| Downloads | Downloads whose URL chain touches a known malware/phishing host are cancelled and the user is told (normal and private windows). | `main.js`, `src/library.js` |
| Downloads | Independent filename check: basename only, no control, Windows-illegal or bidi characters, no trailing dots/spaces, no device names (CON, NUL, COM1…), length capped, always inside Downloads, never overwrites. | `main/download-name.js` |
| Extensions | Chrome Web Store installs now show the requested permissions (same summary as file/folder installs). Store extensions auto-update and the library checks each CRX signature. Private windows run no extensions. | `main/extensions.js` |
| Updates | New `verify` job after each release: downloads the published installer exactly as the public gets it, then checks `sha256sum -c SHA256SUMS.txt`, `gh attestation verify --signer-workflow …release.yml`, and that `latest.yml`'s SHA-512 matches the installer. The live 1.3.2 release passes the same checks. | `.github/workflows/release.yml` |
| CI | Windows packaging job on every push: `npm run pack` on `windows-latest`, then an `app.asar` contents check (Oto's code present; no `test/`, `scripts/`, `docs/`, keys or exports). | `.github/workflows/ci.yml` |
| Logs | The gatekeeper's "refused" log keeps only the sender's origin (full URLs can hold tokens). The problem report holds layout events only; a test enforces it. | `main/ipc-guard.js` |
| Docs | SECURITY.md: PowerShell `Get-FileHash` check with a version placeholder, what the updater verifies automatically versus by hand, download, extension and private-window protections, and the one case a password reaches the UI (show/copy in the Library). PRIVACY.md: deletion markers (no time limit, newest 5,000), private-window fix. | `SECURITY.md`, `PRIVACY.md` |

---

## 4. Brief checklist — where each requirement stands

| # | Requirement | Status |
|---|---|---|
| 1 | Password-change safety | **Fixed** (V3). The old key is kept until the new encryption is confirmed. Keys are only stored sealed by DPAPI (or in memory if DPAPI is unavailable). Tests for interruption, invalid credentials and failed re-encryption. |
| 2 | Password manager reliability | **Fixed** (V4). No silent failures, atomic writes plus rollback, damaged-file protection, no Base64 for new entries, migration kept. Tests for full disk and failed writes. Permission errors behave like full disk (same code path). |
| 3 | IPC security | **Fixed/hardened** (V5, V6). Sender identity is checked by `ipc-guard`: top frame of Oto's own `index.html` only (since 1.3.0). Nested size limits are new. Library channels left open are reviewed and documented. The generic code-injection channel was removed in 1.3.0. |
| 4 | Electron configuration | **Audited**. 12 automated config tests (§5.1). The one exception, Oto's own UI windows running `sandbox: false` for the extension toolbar, is documented in code and SECURITY.md (§8). |
| 5 | Extension security | **Hardened**. Archive validation (traversal, links, size, count; tested since 1.3.0), permission prompts for store and file installs, file access off, signed auto-updates from the store only. |
| 6 | Private browsing and Spaces | **Fixed** (V1). Crash cleanup for clear-on-close since 1.3.2 (tested by killing the process). Site-data clearing across all Spaces verified. Log redaction done. |
| 7 | Downloads and navigation | **Hardened** (§3). Websites can't navigate to `file:`, `view-source:`, `chrome:` and the like (since 1.3.0, tested). Certificate checks are never disabled (test). V2 fixed. |
| 8 | Dependencies | **Investigated** (§6). Shipped: 0. Build-only: 6 moderate in `minimatch`, with no safe upstream fix. Documented, not forced. |
| 9 | Secure updates | **Verified + strengthened** (§7). |
| 10 | Security tests | **63 tests** (§5). |
| 11 | Project checks | `npm test` ✔ · `npm run lint` ✔ · `npm audit` (6 moderate, build-only) · `npm audit --omit=dev` ✔ 0 · `npm run pack` ✔ on Windows (GitHub Actions) |
| 12 | Release readiness | See §9 and §10. |

---

## 5. Test results

### 5.1 Unit tests (`npm test`, Node 22): 63 pass, 0 fail

| File | Covers |
|---|---|
| `test/passwords.test.js` (16) | Encryption-only storage, refusing without DPAPI, Base64 migration, http not saved, no code-injection channel, export confirmation, deletion sync, re-adding, atomic edit, duplicate prevention, remote timestamps, permanent markers, CSV http count, **full-disk rollback**, **damaged file set aside**, **CSV size/read errors** |
| `test/account.test.js` (8) | Token re-encryption, memory-only without DPAPI, PC lock gone, compare-and-swap sync, **password change: normal / failed upload / lost answer (both cases) / no overlap with sync** |
| `test/ipc-guard.test.js` (7) | Oto's window allowed; pages, frames, app windows and extensions refused; library channels open; oversized refused; shared ad-blocker handlers; **nested limits**; **large screenshots still pass** |
| `test/electron-config.test.js` (12) | No Node, isolation or web-security weakening; only UI windows unsandboxed and they only load local files; webviews forced into the sandbox; UI can't navigate or open popups (both windows); websites can't reach local/internal pages; permission handlers set; strict CSP; preload exposes only via contextBridge with fixed channel names; website preload asks one flags-only question; gatekeeper first; no downgrades and GitHub-only updates; **private sessions** |
| `test/downloads.test.js` (7) | **Filename tricks**, **downloads stay in Downloads and never overwrite**, risky types prompt before opening with Cancel as default, never auto-open, Mark of the Web and danger checks (both windows), **certificate checks never disabled**, **report/log privacy**, **release verification steps present** |
| `test/glance.test.js` (5) | Redirect unwrapping, unsafe schemes refused, nesting/double encoding, lookalike hosts ignored |
| `test/safe-unzip.test.js` (6) | Valid extension unpacks; `../`, absolute, drive-letter and backslash paths refused; symlinks refused; size, count and file limits; no manifest or damaged archive |
| `test/page-helpers.test.js` (2) | Password page helpers compile and carry the nonce; tracker list |

Several tests were checked against 1.3.2's code to make sure they fail there: passwords, account, gatekeeper size and
trailing dot.

### 5.2 End-to-end runs (castlabs Electron 45.2.1, local test sites)

All of these pass on 1.3.3:

| Run | What |
|---|---|
| `avoclean` | Private-window cleanup and isolation (V1) |
| `glsp` | Glance session inside a Space |
| `avo`, `space2` | Tracker blocking on, off and on again in the main window, a Space and a private window |
| `space` | Clear site data and block cookies inside a Space |
| `shield2`, `shield3` | Dangerous-site check vs redirect, double redirect, trailing dot (also run on 1.3.2: bypass confirmed), uppercase, subdomain, phishing, embedded content |
| `bypass` | Tracker blocking vs trailing dot, uppercase, port, encoded path |
| `dlx` | Risky-file prompt: Cancel opens nothing, Open anyway opens, a picture opens without a prompt |
| `dlreal` | Real downloads: saved in Downloads, `report.pdf` then `report (1).pdf` |
| `reg2` | Passwords: https save, http refused, page script can't see or trigger the chooser, real-click fill |
| `ytg2` | Glance redirect links with real clicks |
| `scrnav`, `scrcancel` | Screen-share picker closes on navigation; Cancel gives the site a clean refusal |
| `sh`, `danger`, `dangeroff` | Shield page, YouTube options, autoplay/cookies, danger warnings with Shield on and off |
| `crash1-3` (1.3.2 feature) | Clear-on-close after a forced kill: cleared at the next start; the control run without the marker kept the cookie |

### 5.3 GitHub Actions

On push `37d9e31`, both jobs succeeded:
- **Checks:** 63 tests pass, lint passes, `npm audit --omit=dev --audit-level=high` finds 0 vulnerabilities.
- **Windows build:** success.

---

## 6. Dependency audit

```
npm audit --omit=dev   → found 0 vulnerabilities
npm audit              → 6 moderate (GHSA-g3hv-75wg-m249, minimatch 7.0.0–11.0.0, ReDoS via globparts)
```

**Where the advisories come from:**
- `electron-builder 26.18.0` → `app-builder-lib` → `@electron/universal 2.0.3` → `minimatch 9.0.9`.
- The other five entries are the parent packages in that same chain: `app-builder-lib`, `dmg-builder`,
  `electron-builder-squirrel-windows`, `electron-builder` and the root `minimatch`.

**Shipped?** No. `npm ls minimatch --omit=dev` is empty. Only packaging tools use it, and only with Oto's own glob
patterns from `package.json` (trusted input). `@electron/universal` is for macOS universal builds and isn't used for
Windows packages.

**Upstream fix?**
- `electron-builder` 26.18.0 is the newest release.
- npm's only offered fix is `electron-builder@24.13.3`, a major downgrade, which the brief rules out.
- Forcing `minimatch` 11 into `@electron/universal` breaks its dependency range (`ELSPROBLEMS`, as already seen).

**Decision:** no override. Revisit when `electron-builder` or `@electron/universal` updates (Dependabot opens a PR
automatically). The one override Oto does have, `adm-zip ^0.6.1`, fixes a *shipped* library within the API that
`electron-chrome-web-store` uses; it has been tested since 1.3.0.

---

## 7. Update security (task 9)

| Requirement | How |
|---|---|
| Only authorised sources | electron-updater `provider: github`, owner `mukairyo`, repo `oto` (a test enforces this). HTTPS only. |
| Integrity | electron-updater refuses an installer whose SHA-512 doesn't match `latest.yml`. The new release `verify` job checks the published files, the attestation and `latest.yml` after every release. |
| Corrupted or modified files | Rejected by the SHA-512 check. A **compromised GitHub account** could replace both files; only code signing or an attestation check inside the updater would catch that (§8). |
| Insecure redirects | GitHub downloads redirect to `objects.githubusercontent.com` over HTTPS. electron-updater doesn't follow redirects to plain HTTP. |
| Downgrades | `allowDowngrade = false` on every channel (test). |
| Failed updates | NSIS installs only after a full, verified download, at quit or restart. A failed or corrupted download leaves the current version untouched. There's no automatic rollback if a *verified* new version crashes on start; recovery is reinstalling the previous release from GitHub. |
| Signing | Not available (budget). `SHA256SUMS.txt` and GitHub build attestations are kept, and SECURITY.md explains how to check them. |

---

## 8. Remaining unresolved issues

| # | Issue | Severity | Why it isn't fixed in 1.3.3 |
|---|---|---|---|
| R1 | **Installer not Authenticode-signed.** SmartScreen warns, and the updater trusts GitHub as the only root. | High for a broad launch | Budget. Free option: SignPath Foundation (open-source program, application needed). |
| R2 | **Oto's own UI windows run `sandbox: false`.** | Medium | Needed by the extension toolbar's preload (`electron-chrome-extensions/browser-action`). Mitigations: strict CSP (`script-src 'self'`), local files only, no navigation or popups, `contextIsolation`, IPC gatekeeper, HTML escaping audit. Proper fix: move the toolbar into its own isolated view so the UI can be sandboxed. That's a larger refactor, planned separately. |
| R3 | Updater doesn't verify attestations itself | Medium | Needs signing (R1) or a custom check against GitHub's attestation API at update time. |
| R4 | Sync conflicts merge by section and per password; the same setting edited on two offline devices goes to whichever section is newer. | Low | Fine-grained, per-field merging is a design change. Nothing is overwritten silently (compare-and-swap). |
| R5 | Deletion markers are capped at the newest 5,000. | Low | Documented in PRIVACY.md. |
| R6 | Supabase row-level security not independently tested | Unknown | Needs two test accounts (offered). |
| R7 | Clear-on-close can't run during a forced kill. | Low | It runs at the next start (tested). Until then the data is on disk. Documented. |
| R8 | 6 moderate build-only advisories | Low | §6. |

No confirmed critical or high issue remains open in the code. R1 is a distribution and trust gap, not a code defect.

---

## 9. Needs manual or independent testing

These can't be proven by unit tests or by this Linux environment:

1. **Windows-only behaviour:**
   - Mark of the Web on real downloads: SmartScreen prompt, Office Protected View;
   - DPAPI availability, and permission-denied writes in `%APPDATA%`;
   - the risky-file dialog;
   - installer, update and restart.
2. **Two real PCs and sync:**
   - simultaneous offline edits and deletions;
   - account password change on one PC while the other syncs;
   - clock skew.
3. **Real sites:** Google/Microsoft sign-in, Cloudflare, hCaptcha, reCAPTCHA, banking sign-ins, Meet/Discord screen
   sharing, Netflix/Spotify (Widevine), Chrome Web Store installs and updates.
4. **Update failure paths:** offline, proxy, interrupted download, tampered `latest.yml` (test release), disk full
   during an update.
5. **Accessibility and display:** screen reader, keyboard only, 125–250 % scaling, multiple monitors.
6. **Backend:** Supabase RLS (R6).
7. **Independent review:** an external Electron security review, ideally including electronegativity and a manual
   pass over the remaining renderer `innerHTML` uses.

---

## 10. Recommendations before a public release

1. Release 1.3.3 (it fixes V1, the critical private-window leak).
2. Apply for SignPath Foundation code signing (R1), free for open source.
3. Run the Windows checklist in §9 on a clean Windows 10 and 11 PC.
4. Test RLS with two throwaway accounts (R6).
5. Plan the extension-toolbar isolation so the UI can be sandboxed (R2).
6. Keep "beta" on the download page until 2–5 are done.

---

## 11. Files changed (1.3.2 → 1.3.3)

| File | Change |
|---|---|
| `main.js` | Session allowlists in both `will-attach-webview` (V1); private-window download safety; Mark of the Web; risky-file prompt; danger-chain download check; checked download paths |
| `src/v1c.js` | Private windows request the `avocado` session (V1) |
| `src/extras.js` | Glance uses the tab's session (V1) |
| `main/shield.js` | Host normalisation (V2); `dangerOf` exported for downloads |
| `account.js` | Resumable password rotation; serialised with sync (V3) |
| `main/passwords.js` | Transactions, rollback, damaged-file protection, CSV limits, accurate header comment (V4) |
| `src/passwords.js` | Result checking and messages for save, edit, delete and import; accurate encryption notice; damaged-file notice |
| `main/ipc-guard.js` | Full nested measurement (V5); per-channel limits (V6); origin-only refusal log |
| `main/download-name.js` | **new**: download filename and path checks |
| `main/extensions.js` | Web Store permission summary |
| `main/safe-unzip.js` | BOM written as an explicit escape (no behaviour change) |
| `src/library.js` | Message for downloads blocked as dangerous |
| `.github/workflows/release.yml` | Post-release `verify` job; job outputs |
| `.github/workflows/ci.yml` | Windows packaging and contents check |
| `test/*` | 28 new tests (see §5.1); test helpers extended |
| `SECURITY.md`, `PRIVACY.md`, `CHANGELOG.md` | Documentation |
| `package.json`, `package-lock.json` | Version 1.3.3 |
| `docs/OTO_SECURITY_AUDIT_1.3.3.md` | **new**: this report |
