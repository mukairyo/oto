# Oto 1.4.0 — Project Aegis: Security Audit Report

| | |
| --- | --- |
| Version | 1.3.4 → **1.4.0** |
| Date | 2026-11-08 |
| Branch | `oto-1.4.0` |
| Scope | Aegis phases 1–13 (the spec arrived cut off at the Phase 13 heading; see §9) |
| Method | Every finding verified against the code; every confirmed bug has a test that fails without the fix |

## 1. Summary

1.4.0 fixes **8 confirmed problems** (2 high, 4 medium, 2 low), adds an **end-to-end test system that runs the real
app on Linux and Windows** on every change, and makes every release depend on all checks passing.

- **Tests:** 136 unit tests (was 63 in 1.3.3, 111 at the start of this work), also run on Windows. The end-to-end suites run 71 checks on Linux
  and the same plus the Windows-only checks on Windows. All pass.
- **Shipped dependencies:** 0 known vulnerabilities. 6 moderate advisories remain in a build-only tool, documented (§6).
- **Pending (needs Ryo):** two test accounts for the cross-account database check, hands-on tests on a Windows 10/11
  desktop, and the SignPath application (§8).

## 2. Confirmed problems fixed in 1.4.0

### A1 — HIGH: the dangerous-site check was off while Oto Shield started

**Where:** `main/shield.js`, `enableBlocking()`. **Found by:** the new end-to-end tests (an intermittent miss).

When Shield starts (or the protection level changes), it builds its engine, downloading filter lists first. Until that
finished, the session had **no request hook at all**: no ad blocking and no malware/phishing check. Tabs restored at
startup, or a link opened from another app at launch, could load a known-dangerous site. With a slow or blocked list
server, the gap lasted until the download failed.

**Fix:** the built-in list and the dangerous-site check are installed immediately and stay until the full engine takes
over (the existing hand-over code removes them).
**Tests:** `test/shield.test.js` holds the engine startup open and checks a listed site is refused during the wait,
after the engine takes over, and with blocking turned off (fails without the fix). End-to-end: `https` suite, 6 runs
in a row stable.

### A2 — HIGH: Chrome Web Store packages were never signature-checked

**Where:** `electron-chrome-web-store` (dependency). Oto's dialog said "each update's signature is checked", which wasn't true.

The library only checks that the public key inside a `.crx` hashes to the extension's ID. It never verifies a
signature. A package with a copied (public) key, any contents and a junk signature passes. It also accepts the old CRX2
format with no check at all. In practice downloads come over HTTPS from Google only (update source fixed to
`clients2.google.com`), which limits who could exploit this, but the protection didn't match the claim.

**Fix:** `main/crx-verify.js`, written to Chromium's own rules (`components/crx_file/crx_verifier.cc`): CRX3 only,
every signature must verify over the signed header and the whole archive, the extension's own key must be present, and
for the store, **Google's Chrome Web Store key** (SHA-256 `61f7f2a6…67cf`, from Chromium) must have signed too. Every
package the library downloads (installs and updates) passes through it before reaching the disk. A refusal is shown to
the user. No new dependencies.
**Tests:** `test/extensions.test.js` uses Chromium's own test packages (publisher-signed passes; developer-only,
unsigned and CRX2 refused, as in Chrome), flips bytes, and builds forged packages: copied key with another key's
signature, junk signature, valid extra signer hiding a bad one, contents changed after signing. All refused.

### A3 — MEDIUM: removing an extension added from a file didn't remove it

**Where:** `main/extensions.js`. `path.startsWith(userFile('Extensions'))` also matched `Extensions-files`.

File-installed extensions were taken for Web Store ones: listed as "store", and **Remove** went down the Web Store path.
That path didn't take them off Oto's list, so an untrusted extension the user removed **loaded again at the next start**.

**Fix:** a real "inside this folder" check (`path.relative`).
**Test:** `test/extensions.test.js`: listed as "file", Remove deletes it from the list and deletes its unpacked copy.

### A4 — MEDIUM: damaged data files could be overwritten; saves weren't crash-safe

**Where:** settings, permissions, Shield, account and passwords files (Aegis 1.1–1.4).

An unreadable file could be treated as empty and saved over. Saves wrote the file in place, so a crash or power cut
mid-save could leave it half-written.

**Fix:** `main/store.js`. A damaged file is renamed aside (`name.damaged-<time>`). If that fails, the file becomes
read-only for the session and is never written. Saves write a temporary file, flush it to disk, then swap it in.
Failures are reported to the user (once) instead of silently ignored. Passwords: read-only mode when the damaged file
can't be moved.
**Tests:** `test/store.test.js`, `test/passwords.test.js`, `test/storage.test.js`: disk full, rename failing, unreadable
(locked) file, interrupted write, durability (flush before swap).

### A5 — MEDIUM: an unfinished account password change was lost on sign-out

**Where:** `account.js`. Signing out (or an expired sign-in) during a pending password change threw away the recovery
keys, so the cloud copy could stay encrypted under a key nothing could recreate.

**Fix:** the pending change survives sign-out, expired sign-ins and restarts, belongs to one account (signing in as
someone else drops it), and finishes on the next sign-in.
**Tests:** `test/account.test.js` (#4, #15, #20 of Phase 11).

### A6 — MEDIUM: a device with its clock far ahead could make deletions beat later edits

**Where:** `main/passwords.js`, sync merge. Found by a clock-skew test.

**Fix:** other devices' times are capped at "now + 60 s", a deletion marker keeps its first time, and a local save
always beats an existing marker. Markers kept: 20,000 newest (documented limit in `PRIVACY.md`).
**Tests:** `test/passwords.test.js`.

### A7 — LOW: the dangerous-site warning sometimes didn't appear in a new tab

**Where:** `src/v1j.js`, `src/renderer.js`. The site was blocked, but a brand-new tab could link to its page after the
warning's two timers fired, so the tab stayed blank.
**Fix:** the warning is also applied when the stopped load ends, and forgotten when a real page loads in that tab.
**Tests:** end-to-end (`https` suite, including "same tab opens a normal site afterwards").

### A8 — LOW: a sign-in the server stopped accepting early broke sync for up to an hour

**Where:** `account.js`, `api()`. A 401 on a data request (revoked or rotated token) failed every sync until Oto's own
expiry time.
**Fix:** refresh once and retry (a refused request changed nothing). A refused refresh still signs out cleanly, and a
repeating 401 doesn't loop.
**Tests:** `test/account.test.js`.

## 3. Hardening (not a confirmed exploit, done anyway)

- **IPC (Phase 2):** per-channel rules for 44+ channels (value kinds, nested sizes) and refusal of `__proto__`,
  `constructor`, `prototype` keys on every channel, checked before any handler runs (`main/ipc-schema.js`).
- **Hosts (Phase 7):** one normal form for Shield lookups, lists and allow-entries: case, trailing dots, IDN to punycode,
  IPv4 spellings, IPv6 (`main/hostnorm.js`). Downloaded lists are validated, and a list that shrank to under 25 % of a
  big previous one is refused.
- **Updates (Phase 8):** test coverage for every failure path; nothing installs in any of them (§5).
- **CI and releases (Phases 9–10):** actions pinned to commits, per-job permissions, Dependabot with groups, a test that
  enforces both, and releases gated on unit, lint, audit and end-to-end checks.

## 4. Checklist by phase

| Phase | Status |
| --- | --- |
| 1 Data integrity | ✅ A4, A5. All failed saves report failure (tested). |
| 2 Electron / IPC | ✅ All windows sandboxed (1.3.4), IPC rules + pollution refusal, verified end-to-end on Linux and Windows. |
| 3 Passwords / account / sync | ✅ A5, A6, A8. DPAPI-only storage verified on Windows CI. |
| 4 Supabase RLS | ⚠️ **Half done.** Anonymous access refused on all 3 tables (12/12, live, weekly). The two-account check is written and scheduled but needs 2 test accounts (§8). Policies themselves aren't in the repo (§8). The service key isn't in Oto (only the publishable key; `scripts/lint.js` + review). |
| 5 Private / Spaces / privacy | ✅ Private: no cookies, storage, IndexedDB or session folder on disk, a new window starts empty, nothing in history (Linux + Windows CI). Spaces: separate cookies, storage and cache; clearing reaches every Space. By design: **history and site permissions are shared across Spaces** (one Oto profile), documented here. No telemetry or crash reporting; logs and the problem report carry no addresses or secrets (tested). |
| 6 Extensions | ✅ A2, A3. Never run in private windows or own-login Spaces, can't list those tabs, no Oto API on extension pages (end-to-end). Archive extraction limits from 1.3.3 (path traversal, links, size, file count) still tested. |
| 7 Downloads / Shield | ✅ A1, A7. Downloads: no overwrite, no traversal, programs ask first, Mark of the Web verified on Windows. |
| 8 Update trust | ✅ `docs/UPDATE_TRUST.md`: the five trust questions, signed-metadata decision (not now, with reasons), SignPath plan. Tests for every failure path. |
| 9 Dependencies / Actions | ✅ 0 shipped vulnerabilities; build-only advisories documented, not forced (§6). |
| 10 Maintenance | ✅ Dependabot, CI on every push, end-to-end on Linux + Windows, release gate, `SECURITY_MAINTENANCE.md`. |
| 11 Regression list | ✅ All 20 covered (§5.3) plus log privacy. |
| 12 Windows release | ⚠️ Automated parts done on GitHub's Windows machines. Hands-on desktop items pending (§8). |
| 13 Performance | ✅ Measured, no slowdown; restored tab faster; automatic limits (§9). The spec text for this phase was cut off. |

## 5. Test results

### 5.1 Unit tests (`npm test`, Node 22, Linux and Windows): 136 pass, 0 fail

New in 1.4.0: `store`, `shield`, `updates`, `extensions`, `hostnorm`, `workflows`, plus additions to `account`,
`passwords`, `ipc-guard` and `storage`.

### 5.2 End-to-end (`npm run test:e2e`, castlabs Electron 45.2.1, local test sites only)

| Suite | Checks | Linux (local + CI) | Windows (GitHub CI) |
| --- | --- | --- | --- |
| isolation | sandbox, no Node, gatekeeper, local-file blocks | ✅ | ✅ |
| private | in-memory only, gone after close, new window empty, no history | ✅ | ✅ |
| spaces | separate cookies/storage, clearing everywhere | ✅ | ✅ |
| downloads | Downloads folder, no overwrite, programs ask first; **Mark of the Web** (Windows) | ✅ | ✅ |
| https | certificate warning; dangerous sites (direct, trailing dot, uppercase, redirect, Shield off) | ✅ | ✅ |
| passwords | http refused, encrypted at rest, disk failure; **DPAPI** (Windows) | ✅ | ✅ |
| shield | blocking in main, Space and private sessions; off/on everywhere; with a control | ✅ | ✅ |
| extensions | not in private/Spaces, can't list those tabs, no Oto API | ✅ | ✅ |
| performance | page open, saves, IPC round trip, memory | ✅ | ✅ |

Linux: 71/71. Windows: 73/73 (the same plus DPAPI and Mark of the Web). Every
"can't" check has a matching "can" control, so a broken probe can't pass by accident (this caught one: real tracker
hosts are HTTPS-only in Chromium, so the first Shield probe failed for the wrong reason).

### 5.3 Phase 11 failure conditions

| # | Condition | Test |
| --- | --- | --- |
| 1 | Disk full, account save | account: failed everyday save; store: disk full |
| 2 | Disk full, password save | passwords: P1-02; store: disk full |
| 3 | Backup rename fails | passwords: read-only mode; store: rename fails |
| 4 | Interrupted password rotation | account: upload fails / answer lost / survives sign-out |
| 5 | Crash during a transaction | store: crash before the swap |
| 6 | Invalid IPC sender | ipc-guard: pages, frames, app windows, extension pages refused |
| 7 | Oversized nested IPC | ipc-guard: P1-03 |
| 8 | Malformed extension archive | safe-unzip: traversal, links, limits, no manifest; extensions: damaged CRX |
| 9 | Private session leakage | e2e private |
| 10 | Cross-Space cookies | e2e spaces |
| 11 | Corrupted update metadata | updates: corrupted metadata, real library refusal |
| 12 | Interrupted update download | updates: interrupted, disk full |
| 13 | Malicious redirect normalisation | glance tests; e2e https redirect |
| 14 | Unapproved download path | downloads: names and folder |
| 15 | Expired token | account: #15 |
| 16 | Backend authorisation failure | account: RLS refusal, 401 refresh-and-retry, no loop |
| 17 | Two-device sync conflict | account: N04; passwords: deletion vs edit |
| 18 | Missing encryption | account and passwords: no DPAPI, nothing readable |
| 19 | Unreadable settings | store: #19 |
| 20 | Restart after interrupted recovery | account: rotation across sign-out and restart |
| + | Sensitive data in logs | downloads: problem report and logs carry no addresses, page data or secrets |

## 6. Dependencies

- `npm audit --omit=dev`: **0 vulnerabilities** (what Oto ships). Enforced in CI and before every release.
- `npm audit` (including build tools): 6 moderate, all GHSA-g3hv-75wg-m249 in `minimatch` 9.x via Electron Builder
  26.18.0 → `@electron/universal`. Not shipped. 26.18.0 is the newest Electron Builder, and npm's only "fix" downgrades
  it to 24. Accepted and listed in `SECURITY_MAINTENANCE.md`; Dependabot will offer the real fix when it exists.
- No new dependencies in 1.4.0.

## 7. Update trust

See `docs/UPDATE_TRUST.md`. In short: integrity (SHA-512) and provenance (Sigstore build attestation, checked before
install, fails closed) are automatic. Publisher authenticity rests on GitHub account security until code signing.
A separate signing key was investigated and not adopted: a key CI can use adds nothing over the attestation, and an
offline key is a single point of failure for one maintainer. Free code signing: SignPath Foundation. Steps are listed,
including adding a LICENSE file and a code signing policy section, and the open Widevine question.

## 8. Pending (can't be done or verified from here)

1. **Two-account database check:** create two dedicated test accounts in Oto (email confirmation is required, so I
   can't), then add the repository secrets `OTO_RLS_A_EMAIL`, `OTO_RLS_A_PASSWORD`, `OTO_RLS_B_EMAIL`,
   `OTO_RLS_B_PASSWORD`. The weekly check then also proves one account can't read, change, delete, impersonate or move
   rows to the other.
2. **Policies on record:** in the Supabase SQL editor run
   `select tablename, policyname, cmd, roles, qual, with_check from pg_policies where tablename like 'oto_%';` and save
   the result as `docs/supabase-policies.md`. It reads policy definitions only, no user data.
3. **Windows 10/11 desktop, by hand** (GitHub's Windows Server machines cover the automated parts): fresh install,
   launch, browsing and sign-in on real sites, extension install from the Web Store, sync between two PCs, camera and
   microphone prompts, **update install from 1.3.4 to 1.4.0**, restart, uninstall. The PC link was offline during this
   work.
4. **SignPath:** LICENSE file and policy section first (Ryo's decision), then apply.
5. **Repository settings:** branch protection on `main`/`v1` requiring Checks; Dependabot security updates; 2FA.

## 9. Performance (Phase 13)

The spec arrived cut off at the Phase 13 heading, so this phase was done as a measured check that 1.4.0 isn't slower,
plus automatic limits so a slowdown is caught later. Measured on Linux with castlabs Electron 45.2.1, 1.3.4 vs 1.4.0
(same profile: 30 tabs, 3,000 history entries; median of 4–5 starts):

| | 1.3.4 | 1.4.0 |
| --- | --- | --- |
| Window ready after start | ~360 ms | ~370 ms (same) |
| Restored tab shown | 1.5–2.5 s | **~0.5 s** |
| Memory, all processes | ~635 MB | ~632 MB (same) |
| IPC checks per message | – | 0.5 ms for the full state save, <1 µs typical |
| Saving a 390 KB profile | 1.5 ms (not flushed) | 2.0 ms (flushed, crash-safe) |
| Same save on Windows (CI), main thread | – | immediate: 12–15 ms median, up to 87 ms → background: **~1 ms** |

The faster restored tab comes from A1's fix: Shield attached its request hook only once its engine was built, and
attaching a hook restarts page loads already in progress, so the first page loaded twice. Confirmed by applying only
that fix to 1.3.4 (same ~0.5 s).

Found by the Windows numbers: the flushed save of tabs and history (several times a minute) blocked Oto's main process
for up to 87 ms. It now flushes in the background (`writeJSONAsync` in `main/store.js`); only the instant swap runs on
the main thread, writes are numbered so an older background save can never replace newer data (such as the save when
Oto closes; tested, and the test fails without the guard), and piled-up saves are merged. The save on close stays
immediate.

New `performance` end-to-end suite (Linux and Windows, every push and before every release): opening a page (limit 2 s
median; measured ~0.1 s), a flushed save of a big profile on the real disk (limit 60 ms; ~2.4 ms on Linux), a message to
Oto's core and back (limit 25 ms; ~0.2 ms), memory with 5 tabs (limit 2 GB). The numbers are in every run's report.

## 10. Files changed (1.3.4 → 1.4.0)

**New:** `main/store.js`, `main/ipc-schema.js`, `main/hostnorm.js`, `main/crx-verify.js`, `scripts/rls-check.js`,
`test/e2e/` (runner, harness, local test server, 8 suites), `test/{store,shield,updates,extensions,hostnorm,workflows}.test.js`,
`test/fixtures/crx/` (Chromium test packages, BSD), `.github/workflows/backend-check.yml`, `SECURITY_MAINTENANCE.md`,
`docs/UPDATE_TRUST.md`, this report.
**Changed:** `main.js`, `account.js`, `main/{passwords,shield,extensions,updates,ipc-guard}.js`, `preload.js` (+ bundle),
`src/{renderer,v1j,library,passwords,settings,v1d}.js`, workflows (`ci`, `release`, `chromium-update`), `dependabot.yml`,
`PRIVACY.md`, `CHANGELOG.md`, `package.json`.
