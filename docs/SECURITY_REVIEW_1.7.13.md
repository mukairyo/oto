# Oto 1.7.13 — response to the "remaining security work" note on 1.7.12

Baseline: 1.7.12 (`b98a5e3`). Order followed: investigate → confirm → fix → test → document. "Fixed" = changed, with a
test that fails on 1.7.12 and passes now. Every result below was produced on the machines named; nothing listed as
"open" has been claimed done. 1.7.12's fixes (`SECURITY_REVIEW_1.7.12.md`) are kept, with their tests.

## A. Summary

- Two real defects fixed: a permission "yes" could be saved for a site you had already left; and Web Store extension
  updates were loaded silently even when they asked for more access.
- The failed Windows check on `b98a5e3` was a test-fixture defect (window focus), not a product defect: diagnosed,
  reproduced, fixed in the test.
- Release gates hardened: Linux end-to-end tests and the live two-account backend check now gate every release;
  the backend check fails closed.
- IPC: full inventory of every channel (`docs/IPC_INVENTORY.md`, kept current by a test); every sensitive channel has an
  argument schema; listeners added through `addListener`/`prependListener` can no longer skip the gatekeeper.
- New runtime boundary tests (navigation, frames, popups, Space separation), extra update-verifier negative tests.
- Not done (needs the owner, real Windows hardware or money): Windows-backed password re-authentication, Authenticode
  signing, the backend test accounts. Release recommendation in section E.

## B. Findings

| # | Severity | File / component | Root cause | Evidence | Fix | Test |
|---|---|---|---|---|---|---|
| 1 | Medium | `main.js`, permission request handler | A pending question was only dropped when its tab closed. If the tab moved to another site, the question still said "A wants…" over site B's page, and a yes was saved for A. | New e2e check fails on 1.7.12: `questions left: 1`, saved `{"http://news.site|pointerLock":true}` | Question dropped (never answered) when the tab's main frame navigates to another origin | `test/e2e/suites/permissions.js` (3 new checks), Linux: pass |
| 2 | Medium | `main/extensions.js` + electron-chrome-web-store auto-update | The library downloads updates (signature-checked by Oto) and loads them at once, even with new permissions; Chrome disables such an extension and asks. | Read in the library: `updateExtension` → `removeExtension` + `loadExtension`, no hook | `main/ext-perms.js`: approvals recorded on install; a Web Store version asking for anything new is unloaded on `extension-loaded` and Oto asks ("Keep it off" is the default) | `test/ext-perms.test.js` (logic + wiring) |
| 3 | Low | `main/ipc-guard.js` | Only `on/once/handle/handleOnce` were wrapped; `addListener`/`prependListener` are separate properties, so a library using them would bypass the sender/size/schema checks. Oto's own code doesn't use them. | `test/ipc-guard.test.js` new case fails on 1.7.12 | Wrapped too | `test/ipc-guard.test.js` |
| 4 | Low (assurance) | `main/ipc-schema.js` | 35 sensitive channels had no argument schema (allowed through after the sender check) | Inventory | Schemas added (most take no arguments) | `test/ipc-inventory.test.js` fails if a sensitive channel lacks one |
| 5 | Process | `scripts/rls-check.js` | Missing test accounts printed SKIP and could exit 0 | Read; new test | Exit 2 when the two-account part can't run, 3 when the backend is unreachable, 1 on any leak; `--anonymous-only` for local use only, labelled as partial; both directions; unique per-run rows; cleanup in `finally`; forged/damaged/unsigned tokens and a signed-out refresh token checked | `test/rls-check.test.js` (fake backend) |
| 6 | Process | `.github/workflows/release.yml` | The release ran unit tests and Windows e2e, but not Linux e2e or the backend check | Read | `e2e-linux` and `backend` jobs added; `release` needs both. Backend job runs plain Node only (no npm packages next to the secrets) | Workflow parses; runs on next release |
| 7 | Test defect | `test/e2e/suites/permissions.js` | Chromium refuses pointer lock from an unfocused window before Oto is asked. On a busy runner Oto's window had lost focus. | Checks #270 (`b98a5e3`) failed once, passed three times on the same commit; reproduced on Linux by blurring the window (`question=null, page=error`) | Test focuses the window and reports focus state if it fails | Linux: pass, also from a blurred start |

### Checked, no defect found

- Extension packages: every main-process GET is inspected (1.7.12); updates go through the same path; ID mismatch
  refused by the library; non-CRX bodies can't install.
- Update verifier: fails closed; re-hashes before installing; deletes refused files; no downgrades. New negative cases:
  malformed/unsupported bundle, missing certificate, wrong payload type, broken signature, wrong digest forms, and an
  installer changed after verification (deleted, not installed) with an unchanged control (installs).
- Password storage: encrypted only, Base64 legacy migrated on load (migration is retried if the save fails, nothing
  lost), damaged files set aside, failed writes report failure (existing tests).
- `oto:worker` (service-worker IPC): returns only the worker's own fingerprint seed. electron-chrome-extensions'
  service-worker `crx-*` channels: the library's own routing (as in the 1.3.2 review).

## C. Test evidence (commit of this release)

| Suite | OS | Result |
|---|---|---|
| Unit tests (`npm test`) | Linux | 242 pass, 0 fail |
| End-to-end (`test/e2e/run.js`, incl. new `boundaries` suite) | Linux (xvfb) | 292/292 + new checks pass |
| Unit tests | Windows (GitHub runner, Checks run 44373908528) | 242 pass, 0 fail |
| End-to-end incl. `boundaries` and the new `permissions` checks | Windows (GitHub runner, Checks run 44373908528) | 294/294 pass |
| `npm audit --omit=dev --audit-level=high` | Linux | 0 vulnerabilities |
| `npm audit` (all) | Linux | 6 moderate, all in electron-builder's build-time chain (minimatch ReDoS); npm's "fix" is a downgrade to electron-builder 24.13.3 (breaking). Build-only, not shipped: accepted, revisit when electron-builder updates. |
| Backend check | GitHub runner (Backend access check run 44373908533) | 12/12 anonymous checks pass against the live backend; exit 2 "not run" for the two-account part (no test accounts yet), so the workflow fails, as designed |

## D. Remaining limitations

| Item | Status | Needs |
|---|---|---|
| Windows-backed password re-authentication | Not implemented. Reveal is still a confirmation (Cancel default, 1 minute, cleared on lock/minimise). | Owner's choice of fallback for PCs without Windows Hello, and testing on real Windows with and without Hello. |
| Authenticode signing | Not done | Owner picks a provider (paid certificate, or SignPath Foundation's free open-source programme) and completes their identity checks. |
| Backend two-account test | Script and release gate ready; **releases fail until the secrets exist** | Owner creates two test-only Oto accounts and adds `OTO_RLS_A_EMAIL/_PASSWORD`, `OTO_RLS_B_EMAIL/_PASSWORD` as repository secrets. |
| Access-token revocation | Supabase access tokens stay valid until they expire (up to an hour) after sign-out; refresh tokens are revoked (checked). | Platform property; documented. |
| Extension update window | Between the library loading a new version and Oto unloading it there is a moment (milliseconds) where it runs. | Upstream hook in electron-chrome-web-store. |
| Local tampering | Per-user install: code running as the user can change Oto's files; checks inside those files can't prevent that. The update file is re-hashed right before launch, but the moment between hash and launch isn't closed. | Machine-wide install option + signing. |
| Packaged-build runtime tests | The boundary tests run on the unpacked app in CI (Linux and Windows), not on the installed, signed app. | Clean-machine install testing on Windows. |
| SBOM | Each release now ships `oto-sbom.cdx.json` (CycloneDX, npm packages from the lockfile). Electron itself (castlabs 45.2.1 build, Chromium 156) is a build-time dependency and not listed in it. | — |

## E. Release decision

- Development builds: approved.
- Public beta: approved, with the limits above stated (don't rely on Oto as the only password manager for
  high-value accounts yet). Note: until the backend test accounts exist, the release workflow stops at the backend gate.
- High-security production: **not approved** — Windows re-authentication, signing, the two-account backend run and an
  independent review are still missing.

## F. Since 1.7.12

Changes: findings 1–7, `docs/IPC_INVENTORY.md`, release SBOM. New regression coverage: `test/rls-check.test.js`,
`test/ipc-inventory.test.js`, `test/ext-perms.test.js`, new cases in `test/ipc-guard.test.js`, `test/attest.test.js`,
`test/updates.test.js`, e2e `boundaries` and `permissions`. New risk introduced: an extension update asking for more
now stops working until approved (intended). Release blockers: section D.
