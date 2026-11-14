# Security maintenance

How Oto stays patched with as little manual work as possible, without ignoring new problems. This is a standing
policy, not a one-time audit: a serious new browser-engine vulnerability triggers a review even right after an audit.

## What runs by itself

| What | When | What happens | Workflow |
| --- | --- | --- | --- |
| **Chromium/Electron security updates** | daily | A newer castlabs Electron in Oto's major version is prepared on its own branch (package files + changelog entry) and a **pull request** is opened. Nothing is released until Ryo merges it (since 1.6.6: an upstream build can't ship itself). Merging starts the release, which only publishes if every check below passes. A new major version opens an issue instead. Oto can only be as current as castlabs' build: when castlabs is behind the official Electron, so is Oto (see "When an engine vulnerability is announced"). | `chromium-update.yml` |
| **Unfinished releases** | daily | If the version on `main` has no finished release and none is running (a download failed, a test machine was slow), the release is started again and an issue is opened. | `chromium-update.yml` |
| **Android engine and libraries** | daily (engine), weekly (libraries) | A newer GeckoView raises Oto for Android's version and ships a new APK. Dependabot opens pull requests on the `android` branch for the build's actions and libraries; each one builds the app. | `android-engine.yml`, `.github/dependabot.yml` |
| **Unit tests, security rules, audit** | every push and pull request, every branch | `npm test`, `scripts/lint.js` (sandbox, no Node in pages, no unsafe settings), `npm audit --omit=dev --audit-level=high` | `ci.yml` → checks |
| **End-to-end tests of the real app** | every push and pull request | Oto runs against local test sites on **Linux and Windows**: sandbox, IPC gatekeeper, private windows, Spaces, cookies and storage separation, downloads (Windows: Mark of the Web), certificate and dangerous-site warnings, passwords (Windows: DPAPI), Shield, extensions. | `ci.yml` → e2e-linux, windows-build |
| **Windows packaging check** | every push | Builds the unpacked app, checks Oto's files are inside and tests, scripts, keys and exports are not. | `ci.yml` → windows-build |
| **Release gate** | every release | All of the above again on Windows **before** the installer is built. Any failure stops the release. After publishing, the installer is downloaded like a user would and its checksum and build record are verified. | `release.yml` |
| **Dependency updates** | weekly; security fixes as soon as an advisory exists | Dependabot pull requests (npm and GitHub Actions), small updates grouped, major versions separate. Each runs all checks. **Nothing is merged automatically.** | `.github/dependabot.yml` |
| **Accounts server access check** | weekly, and when account code changes | Anonymous users can't read or change any sync table; with the two test accounts configured, one account can't touch the other's rows. | `backend-check.yml` |

Turn on in the repository settings (free): Dependabot alerts and security updates, private vulnerability reporting,
and branch protection on `main` and `v1` requiring the **Checks** workflow.

## What needs a person

### Weekly (5 minutes)

- Look at open Dependabot pull requests. Green checks + patch/minor → merge. Major version → read its changelog first
  (especially Electron Builder, electron-updater, electron-chrome-extensions/-web-store, adm-zip, the ad blocker).
- Glance at the Actions tab for red runs (the Chromium update, the backend check).

### When an engine vulnerability is announced

If Chrome's release notes or a security advisory mention a Chromium or V8 bug **exploited in the wild** (or rated
critical):

1. Check whether castlabs has an Electron build with the fix (`castlabs/electron-releases`). The daily workflow picks it
   up within a day and opens a pull request; merge it to release. Run **Chromium updates** by hand (Actions → Run
   workflow) to go faster.
2. If the fix is only in a newer **major** Electron, the workflow opens an issue. Do that upgrade the same week: bump,
   run all checks, and test on Windows (the end-to-end job does most of it).
3. If no fixed build exists yet: note it in the issue, and consider a release note telling users what to avoid.
4. Release. Users get it through the updater within 30 minutes (Stable) of opening Oto.

Same for a critical advisory in a shipped dependency (`npm audit --omit=dev` turns red in CI): update it, or replace it
if the project is abandoned. Never `npm audit fix --force`, and never an `overrides` entry that breaks a package's
declared version range.

### Accepted risks (reviewed with every audit)

| Risk | Why accepted | Review trigger |
| --- | --- | --- |
| 6 moderate `minimatch` advisories (GHSA-g3hv-75wg-m249) in Electron Builder, build time only | Not shipped (`npm ls minimatch --omit=dev` is empty). Only Oto's own fixed glob patterns reach it. npm's only "fix" downgrades Electron Builder to 24. | An Electron Builder release that updates `@electron/universal`; Dependabot will open it. |
| No Windows code signature | No free certificate yet. Builds carry GitHub build attestations that Oto checks before installing. | SignPath Foundation application (see `docs/UPDATE_TRUST.md`). |
| Two-account backend check not running | Needs two dedicated test accounts as repository secrets. The anonymous check runs. | When the secrets are added. |

## Releasing

1. Branch, change, push: CI must be green (unit, lint, audit, end-to-end on Linux and Windows, packaging).
2. Bump `version` and `otoVersion`, add the CHANGELOG section. The updater's number (`version`) is the release
   times 100: Oto 1.4.2 is `"version": "1.4.200"`, `"otoVersion": "1.4.2"`. That leaves room for the automatic
   engine updates in between (1.4.201 = Oto 1.4.2.1). A plain `1.4.2` would count as older than `1.4.101` and nobody
   on that update would get it. `main/version.js` has the rule; `npm test` and the release itself refuse a wrong
   number.
3. Fast-forward `main` (and then `v1`). `release.yml` re-runs every check on Windows, builds, publishes, attests, then
   downloads the published installer and verifies its checksum and build record (`verify` job).
4. A red step anywhere = no release. Fix it; don't skip it. No `continue-on-error` in release or check workflows (a
   test enforces this).

## Security regression tests

- Every confirmed bug gets a test that fails without the fix (unit tests in `test/`, runtime checks in `test/e2e/`).
- Run locally: `npm test` (seconds), `npm run test:e2e` (a few minutes; Linux needs `xvfb-run`).
- Tests don't touch real accounts or real files: the end-to-end tests use a throwaway profile, a private Downloads
  folder and local test sites only.

## Reporting a vulnerability

Privately, through GitHub: **[Report a vulnerability](https://github.com/mukairyo/oto/security/advisories/new)**. See
`SECURITY.md`. Please don't open a public issue for a security problem.
