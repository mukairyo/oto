# Oto 1.7.12 — response to the 1.7.11 security remediation note

A reviewer's note (November 18, 2026) audited Oto 1.7.11 (commit `5a805b7`). This file records what was checked
against that exact source, what was changed, and what is still open. "Fixed" means changed and covered by a test that
fails on 1.7.11. Nothing here claims Oto is fully secure; the open items below are real release blockers for a
high-security production release.

## Fixed (confirmed weaknesses)

| # | Finding | What was true in 1.7.11 | Change in 1.7.12 | Test |
|---|---|---|---|---|
| P0 | uBOL scriptlets downloaded without authenticity | Confirmed. `main/ubol.js` fetched uBOL files daily from the mutable `main` branch of uBOL-home and ran its scriptlets in every page; the only checks were shape and size. | Live downloads removed (owner's choice: rules come only with Oto updates, which are attested, see `UPDATE_TRUST.md`). Sets downloaded by older versions are deleted on start and never read. `vendor-ubol/HASHES.json` records every shipped file's SHA-256. | `test/ubol.test.js`: nothing downloaded; old set and a path-traversal `current.json` ignored and deleted; shipped files match the hashes |
| P0 | Cached generated preload reused by file name | Confirmed. `preloadFile()` ran an existing `ubol-preload-*.js` without checking it. | The preload is rebuilt from Oto's copy on every start and compared; a changed file, a link or a folder in its place is replaced (atomic write, the link's target is untouched). Version and level are checked against strict patterns before any path is built. | `test/ubol.test.js`: tampered preload rewritten; symlink replaced; bad level refused |
| P0 (found in this review, not in the note) | Oto Shield mode had the same supply-chain shape | The adblocker library downloads its scriptlets/redirect resources (`resources.json`, code that runs in pages) from GitHub `master` with the lists, without authenticity. Downloaded lists could also use uBO's "trusted" scriptlets, which can inject arbitrary code. | `main/shield-trust.js`: the engine's resources are replaced by a bundled copy pinned to the library's version tag (`vendor-ghostery/`, SHA-256 checked before use; on mismatch Shield runs no scriptlets). Rules from downloaded lists can't use `trusted-*` scriptlets. Lists (data) still update daily. | `test/shield-resources.test.js`: a downloaded resource file's code no longer runs; trusted rules dropped; tampered bundle refused |
| P1 | Popup title could be page-controlled only | Confirmed. `siteOf('about:blank')` (and unparsable URLs) returned `''`, so `popupTitle()` returned the page's title alone. | Every popup title starts with Oto's own label: `Blank page (no address)`, `data: page (no address)`, `Unknown address`, `Local file`, `<host> (blob)`, plus `· opened by <site>` when the opener is a real site. IDNs show as stored (`xn--…`). Redirects update the title. | `test/security-hardening.test.js` (blank, data, malformed, blob, IDN look-alike, HTTP pretending HTTPS, opener) |
| P1 | Password reveal defaulted to "Show" | Confirmed (`defaultId: 1`, 5-minute grant). | `defaultId: 0` (Cancel); grant is 1 minute and ends when Oto's window is minimised/hidden/closed or the computer locks or sleeps. Export already defaulted to Cancel and asks every time. | `test/security-hardening.test.js` |
| P1 | Web Store install defaulted to "Add" | Confirmed (`defaultId: 0` on `['Add extension','Cancel']`). | `defaultId: 1` (Cancel). | `test/security-hardening.test.js` |

## Hardened (risk was smaller than feared)

- **Extension download check (P1 item 5).** Checked rather than assumed: a non-CRX answer can't reach installation,
  because electron-chrome-web-store's `parseCrx` refuses anything without the `Cr24` header, and it checks the
  extension ID against the expected one (first install and updates both go through `downloadExtensionFromURL`, so
  both pass Oto's signature check, `main/crx-verify.js`, which needs the developer's and the Web Store's signatures).
  The real weakness was memory: every main-process GET was read whole. `main/crx-guard.js` now reads 4 bytes to tell,
  streams everything else on untouched, and caps packages at 256 MB. Interception stays on every GET on purpose: Web
  Store updates come from hosts Google chooses, and narrowing by URL could let an update skip the signature check.
  Tests: `test/crx-guard.test.js`.

## Checked, no change needed

- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities (November 18, 2026).
- README's SmartScreen step already asks to verify the checksum or attestation first.

## Open — not done in this pass, with reasons

| Item | Why it's open | What it needs |
|---|---|---|
| Windows-backed re-authentication for passwords (P1 item 4) | Electron has no Windows Hello API; doing it through WinRT/PowerShell can't be tested on the build machines (Linux) and fails on PCs without Hello set up. The reveal is still only a confirmation. | Build and test on a real Windows PC with Windows Hello. |
| Authenticode signing (P1 item 11) | Needs a certificate (cost, or SignPath Foundation's free open-source programme). | Owner decision. Attestation checks stay either way. |
| Two-account backend isolation test (P1 item 7) | Needs two dedicated test accounts as GitHub secrets. | Owner creates the accounts; the workflow then runs and should block releases. |
| IPC, sandbox, session/partition, permission audits (P1 items 8–9, P2 13–14) | Covered by earlier audits (`OTO_SECURITY_AUDIT_1.3.3.md`, `1.4.0.md`) and existing tests, but not re-done line by line for 1.7.12. Not classified as vulnerabilities. | A dedicated pass enumerating every IPC channel against `main/ipc-schema.js`, with runtime tests. |
| Update attestation edge cases (P1 item 10) | Existing checks kept; the specific forged/wrong-workflow fixtures listed in the note weren't added in this pass. | Fixture-based tests in `test/attest*.test.js`. |
| Local tampering of the install or profile folder | Oto installs per user, so anything running as the user can change Oto's own files; checks inside those files can't stop that. Time between the preload check and Electron loading it is not closed. | OS-level protection (signing, an admin-only install location), out of scope here. |

## Side effects to know

- uBOL rules are as fresh as the installed Oto (no daily uBOL update).
- Shield's Strict level no longer clicks away cookie banners through "trusted" scriptlets (2,235 such rules in Strict,
  185 in Balanced); element hiding still hides most banners. On YouTube, uBOL's bundled scriptlets keep working.

## Assessment

Better than 1.7.11: no code downloaded at run time runs in pages any more, and the confirmed P1 defaults are fixed.
Still **not ready for a high-security production release** until the open items above are done and independently
reviewed. Fine for continued public testing.
