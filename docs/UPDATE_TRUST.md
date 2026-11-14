# How Oto trusts its updates

Aegis Phase 8. What each protection proves, what it doesn't, and why Oto's next step is Windows code signing through
the SignPath Foundation instead of a home-made signing key.

## Five different questions

"Is this update safe?" is really five questions. They're easy to mix up, so Oto keeps them apart:

| Question | Protection | What it proves | What it does NOT prove | Oto today |
| --- | --- | --- | --- | --- |
| **Download integrity**: did the file arrive intact? | SHA-512 in `latest.yml`, checked by electron-updater; `SHA256SUMS.txt` | The file matches what the release lists. | Who made the release. The checksum sits next to the file, so anyone who can replace one can replace both. | ✅ automatic |
| **Release provenance**: was it built from this repository by Oto's own workflow? | GitHub build attestation (Sigstore), checked by `main/attest.js` before install | The exact file was built by `release.yml` on `main`/`v1` of `mukairyo/oto`, signed through Sigstore's public CA and recorded in its public log. | That the source code itself is harmless, or that nobody pushed bad code to `main`. | ✅ automatic, fails closed |
| **Publisher authenticity**: is it really from Oto's developer? | Today: provenance (above) plus GitHub account security (2FA). Later: an Authenticode signature. | That the build came from the repository the developer controls. | It can't tell a hijacked GitHub account from the real developer. | ⚠️ partly: tied to GitHub account security |
| **Code signing**: does Windows recognise the publisher? | Authenticode certificate | Windows shows a verified publisher name and checks the file wasn't changed after signing. | That the software is good, only who signed it. | ❌ not yet (see SignPath below) |
| **Malware reputation**: does Windows trust it? | Microsoft SmartScreen (reputation of the file and its signer) | That many people ran it without problems. | Nothing about how it was built. | ❌ new unsigned builds show a SmartScreen warning |

Oto never hides or bypasses SmartScreen to remove the warning. It goes away only with code signing and reputation.

## What happens on every update

1. electron-updater asks GitHub Releases (HTTPS only, `github.com/mukairyo/oto`; the update address can't be changed by
   settings or by websites). `allowDowngrade` is off: never an older version.
2. It downloads the installer into a temporary file and checks its SHA-512 against `latest.yml`. A mismatch is refused.
   Broken metadata (unreadable `latest.yml`, no checksum) is refused by the library (tested: `test/updates.test.js`).
3. Oto itself then checks the installer's GitHub build record (`main/attest.js`): Sigstore CA chain, Oto's own workflow
   and branch, signature over the exact SHA-256, and Sigstore's transparency-log promise. Only then is the update
   "ready", and only then can it install (button or on quit). Right before it installs, Oto hashes the file again: if
   it isn't exactly the file that passed, it's deleted and nothing installs (since 1.6.6).
4. If the check fails, the file is deleted and that version is never downloaded again in this session. If GitHub can't be
   reached, the file is kept, nothing installs, and Oto tries again in 10 minutes.

Failure cases, all tested in `test/updates.test.js`: corrupted metadata, checksum mismatch, interrupted download (tried
again on the next check), disk full, failed build record, GitHub unreachable. In none of them does anything install.
If the installer itself fails partway, your data (in `%APPDATA%`) is untouched, and running the installer again
(from the release page) repairs Oto.

## Signed update metadata with Oto's own key: investigated, not adopted (for now)

The idea: sign `latest.yml` with a private key kept outside GitHub, and put the public key inside Oto, so a hijacked
GitHub account couldn't publish an update Oto accepts.

Why not now:

- **Where would the key live?** If it's a GitHub Actions secret, a hijacked account can use it, so it adds nothing
  beyond the build attestation. If it lives only on Ryo's PC, every release needs a manual signing step on that PC, and
  losing the key (or the PC) means users can never update again without a reinstall. For a one-person project, that
  trade is worse than today's.
- **The attestation already covers the main attack.** Replacing release files isn't enough: only a run of Oto's own
  workflow can produce a record that passes. What's left is "someone takes over the GitHub account and runs the
  workflow on bad code". That's the same risk for any key that CI can use.
- **The real fix for that is account security and code signing:** 2FA with a hardware key or passkey on GitHub, branch
  protection on `main`/`v1`, and (when possible) Authenticode signing with a manual approval per release (SignPath does
  this).

Revisit if Oto gets a second maintainer or an offline signing setup: an Ed25519 key, used only on an offline machine,
with the public key in `main/updates.js` and a rotation plan.

## Windows code signing without paying: SignPath Foundation

[SignPath Foundation](https://signpath.org) signs open-source Windows software for free. The certificate is issued to
SignPath Foundation, and each release is signed only after a manual approval. Its terms
([signpath.org/terms](https://signpath.org/terms)) ask for:

| Requirement | Oto today |
| --- | --- |
| OSI-approved license for all components, no commercial dual-licensing | ⚠️ `package.json` says MIT, but there's **no LICENSE file**. Ryo decides the license. Open question: the castlabs Widevine build. The Widevine CDM is downloaded at run time by Chromium's component updater, not shipped in the installer, but this needs confirming with SignPath. |
| No proprietary components in the signed package | ⚠️ same Widevine question; everything else is open source |
| Actively maintained, already released in the form to be signed | ✅ |
| Built from source by automated CI | ✅ `release.yml`, with build attestations |
| Product name and version metadata consistent in every build | ✅ (electron-builder) |
| Team roles (authors, reviewers, approvers) and MFA for everyone | ⚠️ one person: Ryo is all three; turn on 2FA everywhere |
| Privacy policy and a "Code signing policy" section on the home and download pages | ⚠️ `PRIVACY.md` exists; the code signing policy section still has to be written |
| No malware or PUPs, uninstall provided | ✅ (NSIS uninstaller) |
| "A certain verifiable reputation" for executable programs | ❓ not defined; apply and see |

Steps when Ryo wants to apply:

1. Add a LICENSE file (MIT, matching `package.json`, if that's the intent).
2. Add a "Code signing policy" section to README (team: Ryo as author, reviewer and approver; privacy: link `PRIVACY.md`;
   attribution to SignPath.io and SignPath Foundation).
3. Turn on 2FA on GitHub (already needed for the attestation trust).
4. Apply at signpath.org; ask about the Widevine component.
5. After approval: a signing step in `release.yml` (SignPath GitHub action, manual approval per release). Keep
   `SHA256SUMS.txt` and the build attestations. Oto's attestation check stays as it is (it checks the file as built,
   so the signing step has to come before the attestation, or the record has to cover the signed file).

Until then: unsigned installers, a SmartScreen warning on new versions, and the provenance check above, which works
whether or not the file is signed.

## How the release workflow keeps build tools away from release rights (since 1.6.6)

`release.yml` has two jobs. **build** runs everything that executes other people's code (`npm ci`, the tests, the
EVS tool, electron-builder) with read-only access. **release** runs none of it: it takes the files from build, checks
them against build's `SHA256SUMS.txt`, makes the build record and publishes. Only release has `contents: write` and the
build-record token, so a bad package during the build can't push to the repository, edit other releases or make build
records for other files. It can still change the installer it builds, which is why the tools are pinned (lockfile
integrity for npm, exact versions with SHA-256 in `.github/requirements-evs.txt` for EVS) and why Chromium updates wait
for review.

