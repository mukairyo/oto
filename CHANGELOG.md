# Changelog

What's new and what got fixed in each version of Oto. Oto updates itself — you'll see
"Oto x.y.z is ready — Restart" a few seconds after opening it when a new version is out.

## 1.6.7 — 2026-11-14

**Fixed**
- **YouTube hover previews** in the list next to a video now play right on top of their thumbnail. With the ambient light on, they used to appear too low. The glow now lies under the page, so YouTube's own layout stays exactly as YouTube makes it.
- **The icon-strip sidebar** (collapsed, and after Ctrl+B brings it back) shows only its icons again. The "01 ESSENTIALS" heading no longer squeezes in and pushes the icons past the edge of the strip.

## 1.6.6 — 2026-11-14

*Security update. Nothing to do: it updates itself.*

**Security**
- **Popup windows show the real site.** When a website opens a popup (sign-in windows and similar), the popup's title bar now always starts with the site it's really on, so a page can't pretend to be another site's sign-in window. Popups also get the same protections as tabs: no way to local files, fingerprint protection in their background workers, and links they open as tabs go to the same Oto window.
- **Showing or copying a saved password asks first.** A Windows dialog asks before a password is shown or copied in the Library. One yes covers the next 5 minutes. Filling a login into a page works as before.
- **A login is never filled into a page that just changed to another site.** The site is checked again inside the page at the moment of filling.
- **Extensions added from a folder:** if their files change on disk after you added them, Oto asks before loading the changed version at the next start.
- **Chrome Web Store messages** are only accepted from the real Web Store address. Before, a look-alike address (one that starts with the Web Store's) could reach them.
- **Updates are checked again right before they install**, and the downloaded file must still be exactly the one that passed Oto's build-record check. Also fixed: a checked update now really installs when you close Oto (before, it waited for the Restart button).
- **How Oto is built:** the step that runs packages, tests and the build no longer has the right to publish releases or make build records; a short separate step does that. The Widevine signing tool is pinned to exact, checked versions. Automatic Chromium updates now wait for review instead of releasing themselves.

## 1.6.5 — 2026-11-14

*Small update. Nothing to do: it updates itself.*

**Fixed**
- **YouTube's top bar turned flat grey over the ambient light.** Its frosted-glass layer blurred the colourful light into grey. While ambient light is on, the top bar now lets the light through, with a soft dark shade at the very top so the logo and buttons stay readable. To keep YouTube's own top bar, switch off "Top bar lets the light through" (Shield › YouTube › More settings).
- **Dark wedges in the page's corners** while the glow lit Oto's window: the light left a square gap around the page, and the page's rounded corners didn't fill it. The light now follows the page's rounded corners.

## 1.6.4 — 2026-11-14

*Small update. Nothing to do: it updates itself.*

**Changed**
- **YouTube ambient light is now built the way the "Ambient light for YouTube" extension builds it**, so it looks the same:
  - The light is the video drawn several times, each copy a little bigger than the last (12% steps), smaller copies on top. Just outside the video you see its own edge colours carried outward, ring by ring, instead of colours from further inside the picture.
  - It reaches equally far on every side (before, it reached further sideways than up and down).
  - Blur is a share of the video's height, so it looks the same in a small player and in theatre mode. The default blur is 30%, like the extension.
  - The fade-out follows a curve with an adjustable start and shape: new "Edge size", "Fade start" and "Fade curve" settings under More settings.
  - A sharper picture of the video (256 points across instead of 64), so the light isn't blocky at low blur.
- The glow around Oto's window uses the same copies and fade, so it matches the light in the page.
- Thanks to Wessel Kroos, whose MIT-licensed extension showed how the light is built. Oto's code is its own.

## 1.6.3 — 2026-11-14

*Small update. Nothing to do: it updates itself.*

**Changed**
- **YouTube ambient light now looks like the extension:** the glow is the video's own picture stretched out past the player and fading to nothing towards its outer edges, so it never ends in a hard edge, even with blur at 0.
- **Spread uses the extension's scale:** 100% reaches half the video's size past each edge (before: about a tenth), up to 400%. The same number now looks the same as in the extension. The glow still stays inside the page.
- **The glow around Oto is the same glow, carried on:** instead of one flat colour per side, Oto draws the video's glow past the page into its sidebar, top bar and edges, lined up with the video and blurred the same. Oto only takes a tiny picture (at most 128 by 72 points) from the page, checks it, and always blurs it at least 24 px.
- **Oto's window reacts to the glow where the light reaches:** near the video, the top bar, sidebar and edges take the video's colours, easing back to Oto's normal look further away, like real light. Only the colour changes, so Oto's text and icons stay as readable as before.
- The light fades out gradually at its edges (no visible line where it ends).
- Oto's older, simpler glow (an even light all around the page while a tab plays sound) steps aside on YouTube while ambient light is on, so the far edges of the window no longer light up where no light reaches.

## 1.6.2 — 2026-11-14

*Small update. Nothing to do: it updates itself.*

**Fixed**
- **YouTube ambient light looked wrong on Windows:** a sharp, blocky patch of the video (or stretched stripes) instead of a soft glow all around. The glow's canvas used a low-latency mode that lets Windows show it without the blur. It's an ordinary canvas now, so the blur always applies, as it does in Chrome.
- **A hard bright line at the right edge of the page** where the glow was cut off. The glow now stays inside the page and always fades out softly.

**New**
- **Spread goes up to 400%** (was 200%), in Oto's settings and in the player panel.
- **Glow around Oto:** while a YouTube video with ambient light is the tab you're looking at, Oto's sidebar, top bar and the edges around the page take the video's colours too. Switch it off under Shield › YouTube › "Glow around Oto". Oto only asks the page for the glow's four edge colours, and checks they are real colours.

## 1.6.1 — 2026-11-14

*Small update. Nothing to do: it updates itself.*

**New**
- **YouTube ambient light, built in.** A soft glow in the video's own colours spreads around the player and over the page, and follows the picture as it changes, like the "Ambient light for YouTube" extension, without needing it. On by default.
- **A button in the player**, next to captions and settings, opens a small panel right on the video: switch it on or off, strength, blur, spread and brightness. Changes are saved in Oto. **G** switches the glow off and on in that tab.
- **All settings** on Oto's YouTube page (Shield › YouTube): strength, blur, spread, fade-in, player sizes (normal, theatre or both), YouTube's light theme, and under "More settings": brightness, colours, detail, updates per second, ignore black bars (films), a shadow around the video, text shadows, see-through buttons and boxes, thumbnail brightness, and an immersive theatre mode (the top bar and the page fade away until you scroll or point at them).
- In theatre mode the bars beside the video fill with the glow too.
- Written for Oto, not taken from the extension. The video is drawn onto the screen; the only thing read back is a tiny copy about once a second to find black bars. Nothing is sent anywhere, and the page gets no access to Oto: Oto collects changes from the player panel itself and checks every value before saving it.

**Good to know**
- Not in fullscreen (the video fills the screen), not in the mini-player, and not for videos with copy protection (films you rent or buy draw black). It pauses while the tab is in the background.
- If you keep the extension, switch one of them off: two glows on top of each other look muddy.

## 1.6.0 — 2026-11-13

*Stronger fingerprint protection. Nothing to do: it updates itself. Details and limits are in docs/PRIVACY_PROTECTION.md.*

**Fixed**
- **Fingerprint scripts could get the real values by running in a background worker** (a script without a page). Workers now get exactly the same protection as their page: canvas, off-screen canvas, WebGL, CPU cores and languages. This covers workers made by the page, by frames from other sites inside it, by other workers, and service workers.
- **On a page that hides where its requests come from, a tracker loaded by the very first page of a new tab could sometimes get through** (the address of the page wasn't known yet at that moment). Oto now remembers the page each tab is opening. The same fix makes "Shield off for this site" apply from the very first request of a new tab. Found by the automated tests, which failed about one run in three; now ten runs out of ten pass.

**New**
- **CPU cores:** each site sees 4 or 8 (never more than your PC has), the same in the page and its workers. A PC with 4 to 7 always says 4.
- **Languages:** sites see only your main language, like Brave. The full list was rarer, so it made you easier to pick out.
- **Strict level:** sites can't read your keyboard layout, and only read-aloud voices in your main language are listed.
- **Cover Your Tracks now says "randomized fingerprint"** instead of "unique fingerprint" on a PC where WebGL works. That test wants 4 of 5 values to differ between sites. Oto now varies canvas, WebGL, audio and plugin details, and CPU cores too on PCs with 8 or more. (The plugin details on their own hide nothing, because every Chrome user has the same list. They are varied because the test counts them; Brave does the same.)

**Good to know**
- One rarer kind of worker (shared workers, used by a site across several tabs) still reads real values. Screen size, time zone, fonts, memory and the graphics-card name stay real, because changing them breaks sites or "are you human?" checks. Your IP address is the strongest identifier: use a VPN to hide it.
- Programs in the browser that size their work by the number of CPU cores (video editors, compression) may run a little slower on big PCs.
- Tested with automated tests in the real app (Linux here, Windows when the release is built), including the Cover Your Tracks test's own published code on two local sites. Not yet on a long list of real websites. If a site misbehaves, switch Shield off for that site and report it.

## 1.5.0 — 2026-11-12

*Privacy upgrade. Nothing to do: it updates itself. Details and limits are in docs/PRIVACY_PROTECTION.md.*

**Fixed**
- **Trackers could get past Oto Shield on pages that hide where requests come from.** Most tracker rules only apply when a tracker is loaded by another site. Oto worked out "which site is asking" from a header that a page can switch off, and then those rules never applied. With Oto's real lists, a page like that let 35 of 47 well-known session recorders through; now 5. Oto asks the browser which frame made the request instead.
- **Fingerprint protection did not run inside frames from other sites.** A tracker embedded in a page read the real canvas and audio values. Protection now runs in every frame; a frame gets the changes of the site you are on.
- **Two ways around fingerprint protection are closed:** drawing on an off-screen canvas, and one way of reading audio.
- **Oto's own extra rules no longer break the companies' own sites.** Addresses like `ads.tiktok.com` and `app.bugsnag.com` were blocked everywhere, also on the dashboards people log in to. They are now blocked on other sites only.

**New**
- **Session recorders are blocked and counted on their own.** Products that record your mouse, scrolling, clicks and typing so a visit can be replayed (Hotjar, FullStory, Microsoft Clarity, LogRocket and about 15 more). The privacy dashboard shows how many were stopped this week.
- **Protection levels: Standard, Strict and Custom.** Standard is what Balanced was, plus the new protections. Strict adds cookie-banner and popup blocking and tells calls less about your network. Custom has a switch for each protection, and Restore defaults. Your old setting keeps its meaning.
- **Calls can't bypass a VPN.** WebRTC now only uses the connection your traffic really uses (Standard), or only its public address (Strict).
- **Click identifiers are removed from links** when you open a page (`fbclid`, `gclid`, `msclkid` and similar). Campaign labels and affiliate codes are left alone.
- **Battery level is no longer readable by sites;** every site gets a desktop PC's answer.
- The dashboard shows the protection level, what is switched on, and how many sites have Shield off.

**Good to know**
- Cover Your Tracks will still say "unique fingerprint". It says "randomized" only when 4 of 5 things differ between sites; Oto varies 3 (canvas, WebGL, audio). The other two are the plugin list, which is identical for every Chrome user so varying it hides nothing, and CPU cores, which Oto can't vary without pages seeing two different answers.
- Some entries on blocker test pages stay "not blocked" in Oto and in Brave: the lists swap those scripts for an empty stand-in so sites don't break. The real tracker never loads.
- A page with many embedded frames loads a little slower (about 5 ms per frame on the test machine), because protection now runs in each frame.
- This release was tested with automated tests (136 checks in the real app on Windows and Linux), not yet on a long list of real websites. If a site misbehaves, switch Shield off for that site (Shield menu) and report it.
- **Oto for Android 0.2.3** blocks session recorders too, and no longer blocks a company's addresses on its own site. Download **Oto-Android-0.2.3-arm64.apk** below, or update from inside the app. Its blocker is tested in a desktop build of the same engine, not yet on a phone.

## 1.4.2 — 2026-11-11

*A check-up release: everything was gone through again. Nothing to do: it updates itself.*

**Fixed**
- **Oto could close completely because of a leftover question.** When a site asked to lock your mouse or keyboard (games do this) and you closed that tab while Oto's question was still open, answering the question afterwards — or just waiting 90 seconds — crashed all of Oto. The question now goes away with its tab and is never answered for a page that is gone. Found while checking the fixes in the next engine version; tested.
- **The red warning for a dangerous site could be missing in a brand-new tab on a slow PC.** The site was blocked, but the tab stayed blank instead of showing the warning. It now always shows, and a late warning can't land on a different page you've moved on to.

**Oto Shield**
- **Ad scripts are now also stopped by where they sit on a site.** Oto's filter lists stop ad scripts by the address they come from. An ad-block test page (adblock.turtlecute.org) serves two harmless stand-in ad scripts from its own site to see whether a blocker can stop a script at all, and Oto let both through: "Ad Scripts Loading" was red. Oto now blocks ad widget scripts (`/widget/ads.…`) on every site, and the tester's own `pagead.js` on that tester. These are the two rules the tester asks blockers to add; the second one only does something on the tester's page. Only scripts are affected, never pictures or data.
- **A tracker company's own website keeps working.** Whole company sites on Oto's extra list (Mouseflow, Freshmarketer, Samsung Ads) are now blocked on other sites only, not when you visit them yourself. The Basic protection level now also blocks all of Mouseflow's addresses.
- **Oto for Android 0.2.2 has Oto's own blocker.** On Android, Shield was only the engine's tracking protection, which can't stop a script by its path or hide an ad box, so the same test page showed the script and "cosmetic" checks as failed. Oto for Android now has its own small blocker built in (no outside code): it stops Oto's list of ad, tracker and telemetry addresses and the ad scripts above, and hides common ad boxes. It follows the Shield switch. Download **Oto-Android-0.2.2-arm64.apk** below, or update from inside the app.
- Tested: Oto for Windows passes all four page checks on a local copy of the test page, and with its real filter lists blocks 126 of the tester's 126 addresses on Balanced and Strict (125 on Basic). The Android blocker passes the same checks in a desktop build of its engine; it has not been run on a phone yet.

**Updates**
- **Automatic security updates and normal updates can no longer block each other.** Oto gives the small automatic engine updates a fourth number (like 1.4.2.1). The way those were counted, the first one could have had the same number as a later normal update, or made the next normal update look *older* — and then Oto would have stopped updating for everyone on it. It hadn't happened yet. The numbering is fixed, and a release with a number that people wouldn't receive is now refused before it is built.
- **A release that fails for a passing reason is tried again.** If GitHub doesn't serve a file or a test machine is slow, the daily check starts the release again and reports it, so a security update can't sit unfinished unnoticed.
- Oto notices a new version sooner after an automatic update (it compared version names the wrong way round in one place).

**Behind the scenes**
- The build tools on GitHub were updated to their current versions, and the Android build now uses fixed, checked versions of its tools too. Oto for Android's libraries are now watched for updates like the Windows ones.
- Two tests that sometimes failed for no real reason (one could have stopped a release) were made reliable.
- Checked again: all libraries Oto ships are on their newest versions with no known vulnerabilities. Oto's engine is the newest one castlabs offers (Electron 45.2.1, Chromium 156); a newer one is installed automatically the day it comes out.

## 1.4.1 — 2026-11-09

*A small fix. Nothing to do: it updates itself.*

- **Downloads no longer leave a white, empty tab behind.** When a download link opened in a new tab, the file downloaded but the new tab stayed open with nothing in it — just a white page. Oto now closes that tab by itself, the way Chrome does, and takes you back to the tab you clicked from. The download keeps going in the Downloads panel. If Oto asks where to save, the tab closes once you've picked a place (or cancelled). Normal download links on a page you're reading never close that page, and the empty tab isn't offered in "Reopen closed tab" (that would only start the download again).
- Tested: a download link that opens a new tab, a download that's still running when its tab closes, and a normal download link.

## 1.4.0 — 2026-11-08

*Project Aegis: a security and reliability release. No new features. Nothing to do: it updates itself.*

**Dangerous-site protection**
- **While Oto Shield was starting up, the dangerous-site check was off.** Shield downloads its filter lists when it starts (and when you change the protection level), and until it finished, pages loaded with no check at all, so a tab restored at startup could open a known malware or phishing site. Oto's built-in list and the dangerous-site check now run from the first moment until the full engine takes over. Found by the new end-to-end tests.
- The red warning page sometimes didn't appear in a brand-new tab (the site was blocked, but the tab stayed blank). It now always shows.
- Hosts are compared in one normal form everywhere: uppercase, trailing dots, international names, and other ways of writing an IP address (like `0x7f.1` or `2130706433`) can't slip past the lists. Downloaded lists are checked, and a new list that suddenly shrank is refused (the old one is kept).
- Tested: dangerous sites are blocked directly, with a trailing dot, in uppercase, after a redirect, and with ad blocking turned off.

**Extensions**
- **Chrome Web Store extensions are now checked for genuine signatures.** The library Oto uses only checked that an extension's public key matched its ID, never the signatures, so a changed package with a copied key would have been accepted. Every package (install and update) must now be signed by its developer and by the Chrome Web Store, the way Chrome checks it, before it reaches the disk. Tested with Chromium's own test packages and with forged ones.
- **Removing an extension added from a file didn't really remove it.** Oto took it for a Web Store extension, so it came back at the next start (and was listed as from the Web Store). Fixed.
- Tested: extensions never run in private windows or in Spaces with their own logins, and can't see those tabs.

**Your data on disk**
- A damaged settings or passwords file is set aside (or, if that fails, left alone and read-only) and never overwritten. Before, an unreadable file could be replaced by an empty one.
- Saves go through a temporary file that's flushed to disk before it replaces the old one, so a crash or power cut mid-save can't leave a half-written file.
- Oto tells you when a save fails or a file was damaged, instead of failing silently.

**Accounts and sync**
- An unfinished account password change survives signing out, an expired sign-in and a restart, and finishes when you sign in again.
- If the server stops accepting your sign-in early, Oto refreshes it once and retries, instead of failing every sync for up to an hour.
- A device whose clock is far ahead can no longer make its deletions win over later edits. Deletion markers kept: up to 20,000.

**Oto's core**
- Every message from Oto's window to its core is checked against rules for that message (the kinds of values, sizes inside nested data, no `__proto__`-style keys) before anything runs.

**Updates**
- Tested: corrupted release metadata, damaged or interrupted downloads, a full disk, a failed build record and GitHub being unreachable. In none of these does anything install. The update source can't be redirected.

**Faster first page after starting**
- A restored tab shows up to several times faster at startup when Oto Shield's lists are slow to load (about 0.5 s instead of 1.5–2.5 s in tests). Shield used to attach to your pages only once its engine was ready, which restarted pages that were already loading. Startup time and memory are otherwise unchanged; Oto's new checks cost under 1 ms.
- No more small stutters while Oto saves your tabs and history: the save now finishes in the background (on Windows it could hold Oto up for up to ~90 ms; now about 1 ms).

**Automatic checks**
- New end-to-end tests run the real Oto against local test sites on every change, on Linux and on Windows (including Windows' password encryption and the "downloaded from the internet" mark). A release is only built if all checks pass, including a known-vulnerability check of what Oto ships, and performance limits (opening a page, saving, Oto's internal messages, memory).
- Weekly checks of Oto's account server (strangers can't read or change sync data), weekly dependency updates (never merged automatically), daily Chromium security updates.
- New: `SECURITY_MAINTENANCE.md` (how Oto stays patched) and `docs/UPDATE_TRUST.md` (what each update check proves, and the plan for free Windows code signing).

## 1.3.4 — 2026-11-08

*Security release: the last part of the 1.3.3 security work, finished after 1.3.3 was published. Nothing to do: it updates itself.*

**Every window is now sandboxed, Oto's own included**
- Oto's own windows (main and private) ran without Chromium's sandbox, because the extension toolbar needed it. The toolbar module is now built into the window's preload (`preload.bundle.js`, generated by `scripts/build-preload.js`, no new dependencies), so every Oto window runs sandboxed like web pages. Tested: the window works as before, the toolbar shows extension buttons, and all end-to-end suites pass. A test fails the build if the generated file ever falls out of date.

**Updates are checked against GitHub's signed build record before installing**
- Before an update may install, Oto now checks its GitHub build record itself: signed through Sigstore's public CA for Oto's own release workflow, about exactly the downloaded file, and vouched for by Sigstore's public log. Before, the updater only compared the file with `latest.yml` from the same release.
- A file that fails is deleted and never installed. If GitHub can't be reached, Oto waits and retries. Nothing installs unchecked, not even when you quit Oto.
- Tested against the real record of the published 1.3.2 installer (passes), and with tampered records, files, certificates, log entries and other workflows or branches (all refused). Also tested inside Electron against GitHub's live service.

**Saving safely**
- Your account sign-in data (`account.json`) is no longer saved silently. A password change refuses to start unless its recovery data (new key, old key, encrypted by Windows) is safely on disk, or when Windows can't encrypt. Then nothing changes on the server or in the cloud. Tested with a full disk.
- Other important saves (your tabs and settings, site permissions, Oto Shield settings and exceptions) now tell you once if the disk is full or not writable, instead of failing silently. A full disk can also no longer stop Oto from starting.

## 1.3.3 — 2026-11-08

*Security release (security-focused development phase): fixes from the 1.3.2 code review plus Oto's own security testing across 8 areas. No new features.*

**Privacy: private windows are private again**
- **Private (Avocado) tabs were using your normal, saved session.** Cookies and site data from a private tab stayed after closing, and normal tabs could see them. Electron 45 ignores the switch Oto used to move private tabs into their in-memory session. Private tabs now ask for the private session themselves, and Oto's core refuses to load a page in any other session, so a mistake can never leak again. Tested: a cookie set in a private tab exists only while the window is open, is gone after closing, and normal tabs never see it. Nothing goes to history.
- Glance now uses the same logins as the tab it was opened from (private windows and Spaces with their own logins included). Before, it always used the main session.

**Password protection**
- Changing your Oto account password can no longer leave your synced data unreadable. The re-encryption is now a job that finishes even if the internet drops halfway: the next sync completes it. If the server's answer gets lost, Oto checks which password is really in use before touching anything. A password change also waits for a running sync instead of overlapping it.
- Saving, editing, deleting or importing passwords is all-or-nothing on disk. If the file can't be written (disk full, no permission), Oto says so and nothing changes. Before, it could say "saved" when it wasn't.
- A saved-passwords file that can't be read is set aside under a new name, never overwritten, and the Library tells you.
- CSV import: files over 20 MB or 100,000 rows are refused with a clear message, and read errors are explained.

**Oto Shield**
- **Fixed a bypass:** an address with a trailing dot (`evil.example.`) opens the same site, but slipped past the dangerous-site check. Now blocked. Tested against redirects, double redirects, uppercase, subdomains, phishing and dangerous content inside normal pages (all blocked). Tracker blocking also holds against trailing-dot, uppercase, port and encoded-path tricks.

**Download protection**
- Every finished download is tagged by Windows as "from the internet" (Mark of the Web), so SmartScreen and Office warn before running or editing it.
- Opening a program, script, shortcut or disk image (.exe, .msi, .bat, .ps1, .lnk, .iso …) from Oto now always asks first, with Cancel as the default.
- Downloads from (or redirected through) known malware/phishing sites are stopped and you're told why. Private-window downloads get the same checks.
- Download file names get a second, independent check (on top of Chromium's): never a path, no Windows device names (CON, NUL …), no hidden trailing dots or right-to-left tricks that disguise `.exe` as `.jpg`, always inside Downloads, never overwriting an existing file.

**Extensions**
- Installing from the Chrome Web Store now shows what the extension can access, the same as files and folders. Oto keeps Web Store extensions updated and checks each update's signature.

**Messages between the window and Oto's core**
- Size limits now measure the whole message, however deeply nested. Before, a huge string inside a small object could slip through.
- **Fixed a 1.3.2 regression:** saving a large (full-page) screenshot was refused by the new size limit.

**Secure updates**
- After every release, a separate check downloads the installer exactly as the public gets it and confirms its SHA-256, its signed build record, and that the file the updater trusts (`latest.yml`) describes that exact installer. (The published 1.3.2 installer was checked the same way and passes.)

**Logs**
- The only log line that could hold an address (a refused message) now keeps just the site's origin, since full addresses can contain tokens. The problem report was checked: it holds layout events only, with no addresses, page data or secrets (now enforced by a test).

**Automated security tests**
- New Electron security audit (12 tests) that fails the build if anyone weakens a setting: Node in web pages, isolation, web security, sandboxing, unsafe navigation, popups, permission handling, the UI's Content Security Policy, the preload API, private-window sessions or update downgrades. Plus download, certificate and log-privacy tests. 63 tests in total (was 35).
- Every push now also builds the Windows app on GitHub and checks what's packaged: Oto's code is in it, and tests, scripts, keys or exports never are.
- Dependencies: what Oto ships has 0 known vulnerabilities. The 6 moderate advisories are all in one library (`minimatch`) used only by Electron Builder while packaging, never shipped. The only "fix" npm offers is downgrading Electron Builder to 24, so they're documented instead of forced.

**Docs**
- SECURITY.md: a copy-paste PowerShell check for downloads (with a version placeholder), the new download and extension protections, and exactly when a password reaches Oto's window (only when you press show or copy). PRIVACY.md: deletion markers have no time limit (newest 5,000 kept), and the private-window fix.

## 1.3.2 — 2026-11-07

*Fixes from the follow-up review of 1.3.1.*

**Sync**
- **Sync can't overwrite another device's newer changes any more.** Before writing, Oto checks that the cloud copy is still the one it last saw. If your other device synced in between, Oto first merges those changes in (per section, per password), then writes. Before, an automatic sync could replace newer changes, including deleted passwords.
- Passwords synced from another device keep the time they were really changed, so the newest edit keeps winning on every device.
- Deleted-password markers no longer expire after a year, so a device that was offline for a very long time can't bring a deleted login back.

**Passwords**
- Editing a saved login is now all-or-nothing: if anything fails (like Windows encryption being unavailable), nothing changes. An edit also can't silently turn one login into a duplicate of another.
- Importing a CSV now tells you how many logins were for sites without https.

**Clearing data**
- "Clear site data" and "Clear all browsing data" only say "done" if every Space was really cleared, and warn you if one wasn't.
- "Clear when Oto closes" now also happens after a crash, forced close or power cut: if clearing didn't finish, Oto does it at the next start. Tested by killing Oto mid-session.

**Glance**
- Redirect links: a redirect inside a redirect is followed (up to 3 deep), double-encoded addresses work, and only real web addresses (http/https, up to 8 KB) are ever opened. Tested against unsafe and lookalike links.

**Quality**
- Checks now run on **every** push to every branch, main included, even without a version change. Before, a change pushed to main without a new version number could skip them.
- The security checks now scan every folder, with new rules (no `eval`, no unsandboxed windows besides Oto's own, fixed-address `openExternal`, screen-share refusals). 35 unit tests (was 24).
- Messages between Oto's window and its core have a size limit per channel: 1 MB normally, larger only for saving state, backups and images.
- SECURITY.md now says exactly what the updater checks automatically (download address, SHA-512) and what you can check by hand (checksums, build attestation). PRIVACY.md now gives the real malware-list schedule and explains clear-on-close after a crash. The README says how Chromium security fixes arrive.

## 1.3.1 — 2026-11-07

**Fixed**
- Glance on YouTube: with "Links to other sites", links in video descriptions and comments opened a new tab instead of Glance. YouTube sends them through its own redirect page (youtube.com/redirect?q=…), so they looked like YouTube links. Oto now reads the real address inside redirect links (YouTube, Google, Facebook, Instagram, Reddit, Steam, VK, LinkedIn), opens them in Glance, and goes straight to the real site, skipping the tracking redirect.

## 1.3.0 — 2026-11-07

*Security release: fixes from the independent 1.2.2 code review (59 items). Nothing to do — it updates itself.*

**Passwords**
- Saved passwords are **only ever stored encrypted**. Before, if Windows couldn't encrypt (rare), Oto kept a readable copy; now it refuses to save and tells you. Old readable copies are encrypted the moment you open Oto.
- Oto only offers to save logins on secure (https) pages, not plain http (http://localhost still works for developers).
- **Deleting a password now syncs**: it stays deleted on your other devices instead of coming back with the next sync.
- Exporting passwords to CSV now asks in a Windows dialog that explains the file is unencrypted and how to handle it.
- The helpers that watch login forms and show your saved accounts are now built inside Oto's protected core. The window can only ask for them by name, so no code can be slipped into a page through it.

**Oto itself**
- One gatekeeper now guards every channel between Oto's window and its core: only Oto's own window gets answers. Web pages, frames, extension pages and app windows are refused before anything runs.
- Sign-in tokens and the sync key are never stored readable. If Windows can't encrypt, you stay signed in until Oto closes, and nothing readable is left on disk.
- Tabs sent from your phone only open if they're normal web links (http/https).
- Websites can't send you to local files or browser-internal pages (`file:`, `view-source:` …). Only you can open those, by typing them.
- Oto-app windows only stay in the window for the app's own site and real sign-in pages (Google, Microsoft, Apple, GitHub …). Every other link opens in Oto.
- Screen sharing: the picker is tied to the page that asked. If that page navigates away or closes, the picker closes and nothing is shared. Pressing Cancel now gives the site a clear "no". Before, Electron threw an error there, so the site kept waiting and the picker could stay open.
- Leftovers of the old PC lock (removed in owner.16) are gone: its hidden settings, lock screen and code. Oto doesn't lock itself, so use Windows sign-in for that.

**Extensions**
- Extension files (.crx / .xpi / .zip) are checked before unpacking. Oto refuses files that try to write outside their folder, contain links, or unpack to more than 500 MB / 10,000 files.
- Before adding an extension from a file or folder, Oto shows what it asks for ("read and change everything on every website", "see your open tabs" …). These extensions no longer get access to local files.

**Spaces and Oto Shield**
- **Spaces with their own logins weren't blocking ads and trackers at all** (since 1.0). The blocker can only register its page helpers once, so its setup stopped halfway in every session after the first. Spaces and private windows now block like the main window does (tested: tracker blocked in the main window, a Space and a private window).
- Turning Oto Shield on or off now applies to every Space and private window at once (before, only the main session changed, and turning it back on failed with an error).
- With Shield off, dangerous-site warnings now keep working in every Space and when Oto starts.
- "Block cookies" for a site, "Clear site data", "Clear browsing data" and "Clear when Oto closes" now work in every Space's separate logins, not just the main one.

**Backups**
- A backup made with a backup password is now **fully encrypted** (history, tabs, bookmarks, settings and passwords). A backup without a password asks first, because anyone could read it. Old backups still restore.

**Under the hood**
- Automated tests (`npm test`: passwords, sync deletions, the gatekeeper, extension files, account secrets) and security checks (`npm run lint`) run on every change and before every release. A failure stops the release.
- Every release now comes with `SHA256SUMS.txt` and a signed GitHub build attestation, so you can check your download really came from this repository (see SECURITY.md).
- GitHub Actions are pinned to exact versions, Dependabot watches for vulnerable packages, and `.gitignore` keeps keys and exports out of the repository.
- The Chrome Web Store helper bundled an old unzip library with known security problems; every part of Oto now uses the fixed version (`npm audit`: 0 vulnerabilities in what Oto ships).
- New **SECURITY.md** (how to report a problem privately, what Oto protects and what it doesn't yet) and **PRIVACY.md** (exactly what leaves your PC: no telemetry, no analytics).

## 1.2.3 — 2026-11-07

**Fixed**
- ChatGPT and other sites behind an "are you human?" check (Cloudflare, hCaptcha, reCAPTCHA) kept you out. Two parts of fingerprint protection looked like a bot to them: a made-up graphics-card name, and a CPU core count that was changed on the page but not in the page's background workers. Both now show the real values, like Brave does at its standard level. Canvas, WebGL and audio noise still protect you.
- Fingerprint protection is now switched off inside the "are you human?" boxes themselves, so the check can finish.

## 1.2.2 — 2026-11-07

*Behind the scenes: Oto's main code is split into smaller parts. Nothing changes for you.*

**Changed**
- The main process is now `main.js` plus five parts in `main/`: Oto Shield (`shield.js`), updates (`updates.js`), passwords (`passwords.js`), extensions (`extensions.js`) and bookmark import (`bookmarks.js`). Each file is small enough for security scanners like ElectroNG to read (it skipped `main.js` once it grew past 100 KB), and problems are quicker to find and fix.

## 1.2.1 — 2026-11-07

*Security hardening after an Electronegativity (ElectroNG) scan.*

**Security**
- **Opening files is locked down** — Oto only opens or shows files it downloaded or saved itself, or files in your Downloads and Oto Screenshots folders. Before, the "open download" and "open screenshot" buttons would open any path they were given.
- **Stricter rules for Oto's own window** — its Content Security Policy now also blocks plugins, base-URL tricks and form posts (`object-src`, `base-uri` and `form-action` set to `'none'`).

## 1.2.0 — 2026-11-07

*A security release: a newer engine, dangerous-site warnings, safer passwords and screen sharing.*

**Security**
- **Newer engine** — Oto now runs on Electron 45 with Chromium 156 (was Chromium 152), with every security fix since. Small engine updates keep arriving by themselves every day.
- **Dangerous-site warnings** — like Chrome's Safe Browsing: Oto stops known malware and phishing sites before they open and shows a warning page (you can still continue if you're sure). The lists come from URLhaus (abuse.ch) and are updated twice a day; the check happens on your PC and nothing is sent anywhere. Works even with ad blocking turned off. Switch in Oto Shield → *Blocking*.
- **Saved passwords are safer** — Oto's save and fill helpers now run in a hidden, separate part of the page that the website's own scripts can't see or fake, and a password is only filled after a real click on your account. Before, a script on a login page could ask Oto to fill a saved password without you clicking. Logins on pages without HTTPS now show a warning in the account list.

**New**
- **Screen sharing** — Google Meet, Discord, Zoom, Teams and other sites can share your screen or a window now, with Oto's own picker (and "Share sound too" on Windows).
- **Ad boxes added after the page loads** are hidden now too (the common Google ad boxes and friends), not only the ones there from the start.
- **Settings → About → Versions** — every version in one place: Oto (and whether an update is downloading or ready), Chromium, Electron, Widevine, Node and V8, when the filter lists and the dangerous-site list were last updated, the newest Oto for Android and your Windows version. *Copy* puts it all on the clipboard for bug reports.

**Fixed**
- **YouTube no longer gets stuck before a video** — sometimes the player waited for an ad that Oto had blocked and showed nothing until you reloaded. Oto now removes the ads from YouTube's player data before the player reads it, and skips any ad that still starts.

## 1.1.0 — 2026-11-07

*Oto Shield grows up: a privacy dashboard, protection levels, YouTube switches and one page for every site's permissions.*

**New**
- **Privacy dashboard** — how many ads and trackers Oto blocked today, this week and in total, a 14-day chart, every website that tried to track you (and with what), and the tracking companies seen most. Counted on your PC only. Open it from the Oto Shield button → *Dashboard*, or type "privacy" in the command bar.
- **Protection levels** — *Basic* (ads only), *Balanced* (ads and trackers, the default) or *Strict* (also cookie banners, popups and "turn off your adblocker" walls). Switch right in the Oto Shield button.
- **Update filter lists now** — one click downloads the newest uBlock Origin lists (they still update by themselves every week). Zap, Hide for good, My filters and the sites where blocking is off are all on the same page.
- **YouTube switches** — hide Shorts, comments, suggested videos, end screens, live chat, the home feed, hover previews, promos, Explore and the bell. Open Shorts in the normal player. No filters to write; changes show right away.
- **Site permissions page** — camera, microphone, location, notifications, cookies and autoplay for every website in one place, with defaults for all sites ("block every notification request", "no autoplay anywhere").
- **Cookies per site** — Allow, Block, or *Clear on close*. **Autoplay per site** — Block means video and sound wait until you click the page.
- **Fingerprint protection** (on by default) — canvas, WebGL and audio give every site slightly different answers that change each session, and the graphics card and CPU look like everyone else's. Sites can't recognise your PC by them anymore. Switch it in Oto Shield → *Blocking*.
- **Oto's extra block list** — on top of uBlock Origin's lists: Yahoo, Yandex, Unity, TikTok, Facebook and X ad servers, error trackers, and phone-maker telemetry (Apple, Samsung, Xiaomi, Huawei, Oppo, Realme, OnePlus) that the lists missed. Adblock testers go from about 92 of 132 blocked to all of them.

**Changed**
- Camera and microphone are now separate permissions (your old choices are kept).
- The site panel (click the lock) has Cookies and Autoplay too, plus a link to all site permissions.

**Fixed**
- The close button on the My phone panel was invisible.

## 1.0.1 — 2026-11-07

*Bug fixes, and the Oto theme everywhere.*

**Fixed**
- **Oto Health opens again** — it was opening above the top of the window, so nothing seemed to happen. Open it with `Shift+Esc` or from the command bar.
- **Fewer buttons at the bottom of the sidebar** — Library, Notifications and My phone. Settings is in the ⋯ menu (`Ctrl+,`), and you can add any button back with right-click → *Customize buttons*.

**Changed**
- **The Oto theme everywhere** — the offline and error pages (with the white hole instead of the old logo, and Ring Run in space), Oto Health, Notifications, Oto Hub, Oto Wrapped, the shortcut sheet, space overview, Send to phone, Oto Shield, site notes (cream paper now), the theme maker, Customize buttons, zoom and screenshots.
- **The Oto Card** shows the white hole instead of the old ∞.
- **Oto for Android 0.1.1** — the address bar no longer shows the old address under what you type. Download **Oto-Android-0.1.1-arm64.apk** below, or update from inside the app.

## 1.0.0 — 2026-11-07

*Oto v1 — the biggest update yet. A new look, Oto Accounts, Oto Shield, streaming, and your phone linked to your PC.*

**A new Oto**
- **The Oto theme** — near-black, cream text, mono labels and 音. A calm editorial look across the sidebar, new tab, settings, menus and setup.
- **A new logo** — a living galaxy around a white hole. Oto opens with a short warp through the stars and a deep startup sound (change the volume or turn it off in Settings).
- **New setup** — pick your layout, speed and privacy in about two minutes, or sign in to bring your Oto with you. Open it again any time from Settings → General.
- **New installer** in the same look.

**Your Oto everywhere**
- **Oto Accounts** (Settings → *Account & sync*) — your settings, themes, bookmarks, spaces, card and passwords follow you to any PC. Everything is encrypted on your PC with your password before it's uploaded.
- **Forgot your password?** Oto emails you a code, and you type it right in Oto.
- **My phone** — Oto for Android signs in with the same account. Your phone shows up in Windows Oto in 3D, with its battery and open tabs. Send tabs to your phone and back. You can use your own 3D model of your phone, and it stays on your PC.
- **Oto for Android 0.1** — download **Oto-Android-0.1-arm64.apk** below on your phone and open it to install.

**Browsing**
- **Oto Shield** — ad and tracker blocking using uBlock Origin's lists. Zap or hide anything, turn it off per site, block cookie banners and annoyances, and write your own filters.
- **Spotify, Netflix, Disney+, Prime Video and more** play now (Widevine).
- **Command bar** with filters, sums, slash commands and search inside your open tabs; **split view** by dragging a tab onto the page; **Glance**, **tab folders**, **site notes**, **space overview**, **space templates**.
- **Site panel** — permissions, dark page, zoom, sound, *Always open in* a space, clear site data.
- **No more cookie popups**, **clean links** when you copy, **video tools** (speed, loop, picture-in-picture).
- **Oto Health** and **battery saver**, **notification center** with Do not disturb, **screenshots** with drawing and blur, **Avocado** private window, **Oto Apps**, **Oto Night**, comfort options, swipe to go back.
- **Make it yours** — customize the sidebar buttons, theme maker, Oto sounds, separate logins per space.
- **Updates show up by themselves** — a card in the sidebar while the update downloads, then *Restart now*.

## 1.0.0-owner.36 — 2026-11-07

*Owner test build of Oto v1 — your phone.*

**New**
- **My phone** — a phone button at the bottom of the sidebar. Sign in to the same Oto account in Oto for Android and your phone shows up as a 3D phone you can turn, with its battery, Android version and open tabs. Click a tab to open it on the PC, or send this tab to the phone. End-to-end encrypted.
- **Use your own 3D model** of your phone (.glb). It stays on this PC.
- **Send to phone** sends straight to your linked phone, with the QR code still there.

**Changed**
- **The installer is in the Oto theme** — dark pages with the galaxy artwork, and its "Oto is ready" page finally shows Oto's own text.

## 1.0.0-owner.35 — 2026-11-07

*Owner test build of Oto v1 — instant update notice.*

**Changed**
- **New versions show up almost right away** — on the Owner/test channels Oto peeks at the release list every 30 seconds (it's tiny) and the moment a newer build is out it starts downloading. Coming back to the window peeks too. (Stable peeks every 10 minutes.)
- **The update card appears as soon as the download starts** — "UPDATE ——— ● NEW", "DOWNLOADING · 37%" and a thin cream progress line along the box; when it's done it turns into "READY" with LATER / RESTART NOW.

## 1.0.0-owner.34 — 2026-11-07

*Owner test build of Oto v1 — updates show up by themselves.*

**Fixed**
- **New versions show up without restarting** — on the Owner (and Beta/Alpha) channel Oto now looks every 2 minutes and again whenever you come back to the window after a minute away (Stable: every 30 minutes). Before it was every 15 minutes, so you often restarted to find an update. A check that never answers no longer blocks the next ones.

**Changed**
- **The update card matches the sidebar** — an "UPDATE ——— ● READY" label like "01 TABS", a HOME-style box with the galaxy logo and "OTO 1.0.0-OWNER.N" in spaced capitals, and LATER / RESTART NOW buttons (Restart now is a cream block like the open tab). No serif title or stars in the card.

## 1.0.0-owner.33 — 2026-11-07

*Owner test build of Oto v1 — space.*

**Changed**
- **Space behind the startup** — deep black space full of stars (some twinkle) fades up behind the galaxy and drifts closer while the warp streaks rush past.
- **About is in space too** — the header is full of stars, the galaxy forms and the white hole ignites (with a small shockwave) every time you open the page, and warp stars keep flying out of it. Bigger logo, serif "Oto".
- **The update card is remade in the Oto theme** — dark hairline panel full of stars, the galaxy logo forming and igniting when it appears, a serif title, a small "RESTART TO INSTALL" label and a cream Restart now button. It slides in softly. (The old purple card and its pop are gone.) The "is ready" toast only shows when the card can't be seen.
- The old little drifting stars around the logo are gone — the warp streaks replace them.

## 1.0.0-owner.32 — 2026-11-07

*Owner test build of Oto v1 — warp.*

**Changed**
- **Stars rush past you in the startup** — on the boom, stars fly out of the white hole toward you and stretch into streaks as they pass the edges of the screen (a real 3D star field: near stars are brighter and thicker), then slow down and fade just before Oto opens. Replaces the little dots from owner.31.

## 1.0.0-owner.31 — 2026-11-07

*Owner test build of Oto v1 — a new start.*

**Changed**
- **New startup animation: a galaxy forms** — star dust swirls in from far out and settles into two spiral arms, the orbits appear from the middle out, then the white hole ignites right on the boom of the startup sound. A thin shockwave and a rush of stars fly out past you, and 音 and OTO settle in underneath. About two seconds.

## 1.0.0-owner.30 — 2026-11-07

*Owner test build of Oto v1 — the logo becomes a galaxy.*

**Changed**
- **The living logo is a spiral galaxy** — two glowing arms of star dust (drawn from the spiral r = a·e^(bθ)) turn slowly around the bright white-hole core, with dust between the arms and far-off stars twinkling around it. The rings stay as faint orbits and stars still drift out past the edge.

## 1.0.0-owner.29 — 2026-11-07

*Owner test build of Oto v1 — stars.*

**Changed**
- **Stars drift past the living logo** — tiny stars are pushed out of the white hole and stream outward past the rings, fading as they leave.

## 1.0.0-owner.28 — 2026-11-07

*Owner test build of Oto v1 — a living logo.*

**Changed**
- **The Oto logo inside Oto is alive** — the rings keep slowly swirling (each a little slower than the one inside it), the white hole breathes and the light streaks twinkle. No tile behind it any more: its edges fade into whatever is behind. On the About page, the account card, setup, the update card and What's new. (The taskbar icon stays still.)
- **The account card matches the Oto theme** — dark hairline panel, serif heading and the living vortex instead of the rainbow key and glowing border.
- Turning on "Reduce motion" stops the swirl.

## 1.0.0-owner.27 — 2026-11-07

*Owner test build of Oto v1 — fix.*

**Fixed**
- **Reset password with a code finishes properly** — after the new password is set, Oto signs in with it the normal way instead of using the short-lived reset session, which the sync server refused ("The Oto server isn't fully set up yet"). If anything still goes wrong after the password is changed, Oto says so and takes you back to Sign in.

## 1.0.0-owner.26 — 2026-11-07

*Owner test build of Oto v1 — codes instead of email links.*

**Changed**
- **Forgot password now uses a code** — Oto emails a code; you type it in Settings → Account & sync together with your new password and you're signed in. No more link to a web page.
- **New accounts are confirmed with a code too** — after "Create account", type the code from the email right in Oto.
- "Send a new code" (once a minute) and "Back" on both screens. Wrong codes are slowed down after a few tries.

## 1.0.0-owner.25 — 2026-11-06

*Owner test build of Oto v1 — new-look setup.*

**Changed**
- **The welcome setup is redesigned in the Oto theme** — full window instead of a floating card. The steps run down the left as numbered mono labels (the current one in cream, like an open tab), each page has the "— 音 SETUP / LAYOUT —— 03 / 08" line, big serif headings, hairline boxes that turn cream when picked, and a thin cream progress line.
- **The vortex spins up on the Welcome and "You're all set" pages.**
- **App icon is gone from Settings** — the Oto vortex is always the icon now.

## 1.0.0-owner.24 — 2026-11-06

*Owner test build of Oto v1 — setup follows the Oto theme.*

**New**
- **Open the welcome setup again any time** — Settings → General → Welcome setup → Open setup. You can also type "Welcome setup" in the command bar (Ctrl+T).

**Changed**
- **The setup only shows what fits the Oto theme** — the Colours step (rainbow gradient wheel) is gone, and so is the Classic toolbar choice. Oto is the Zen layout: address and buttons in the sidebar, bookmarks in the top strip.
- **The layout previews in setup look like the Oto theme** — near-black window with cream lines instead of the old white and purple drawings.
- The Classic toolbar is also gone from Settings → Appearance. If you had it on, Oto switches to the Zen layout.

## 1.0.0-owner.23 — 2026-11-06

*Owner test build of Oto v1 — startup sound.*

**New**
- **Startup sound** — a deep, pulsing rumble swells while the vortex spins up, then a heavy boom with a bright crackle when the light bursts out, fading with a faint shimmer. Made for Oto (3 seconds).
- Turn it off, change the volume or play it in **Settings → Appearance → Oto sounds**, next to Startup animation.

## 1.0.0-owner.22 — 2026-11-06

*Owner test build of Oto v1 — fix.*

**Fixed**
- **The light in the startup animation is in the middle of the vortex again** — the rings were turning around the wrong point while they spun up, so they slid down-left and the light ended up off-centre.

## 1.0.0-owner.21 — 2026-11-06

*Owner test build of Oto v1 — the new Oto logo.*

**Changed**
- **New Oto logo: the white-hole vortex** — cream rings drawn from maths (ellipses x = r·cos t, y = k·r·sin t, each turned a little more than the last), with light pouring out of the centre instead of falling in.
- **New startup animation** — the rings spin up from the centre, the core flashes and light streaks burst outward, then 音 and OTO appear underneath.
- **New app icon** — on the taskbar, Start menu, desktop shortcut and installer. A simpler version with fewer rings is used at the tiny sizes so it stays clear.
- The logo in setup, About and the update card is the vortex too. "Vortex" is also in Settings → App icon if you switch away and want it back.

## 1.0.0-owner.20 — 2026-11-06

*Owner test build of Oto v1 — the start in the new theme.*

**Changed**
- **New startup animation in the Oto theme** — near-black, the Oto ring and ∞ draw in cream, then 音 appears between two thin lines with OTO underneath.
- **The welcome setup matches the theme** — plain near-black background instead of the purple glow, and no Light/Dark choice (the Oto theme is always dark).
- **The Oto logo is cream** in the new theme (was neon purple) — in setup, the update card and the window icon. You can still pick another icon style in Settings.
- The window opens near-black, so there's no light flash when Oto starts.

## 1.0.0-owner.19 — 2026-11-05

*Owner test build of Oto v1 — fix.*

**Fixed**
- **New versions didn't show up on their own** — while Oto stayed open it only looked for updates every 6 hours, so you had to check in Settings. Now it looks every 15 minutes on the Owner channel (hourly on Stable) and when you come back to the window, downloads in the background and shows "Oto … is ready — Restart".

## 1.0.0-owner.18 — 2026-11-05

*Owner test build of Oto v1 — Oto Shield.*

**New**
- **Oto Shield menu** — click the shield next to the address. It works like uBlock Origin's menu (Oto's blocker uses uBlock Origin's filter lists):
  - a big **power button** to turn blocking off or on for the site you're on (the page reloads),
  - **blocked counts** for this page and since you started using Oto,
  - **Zap** — click anything on the page to remove it until you reload,
  - **Hide** — pick something to hide on that site for good (Undo in the message),
  - **Block annoyances** — adds uBlock's lists for cookie banners, newsletter popups and "turn off your adblocker" walls,
  - **My filters** — your own rules in uBlock syntax (`||ads.example.com^`, `example.com##.sponsored`, `@@` exceptions) and the list of sites where blocking is off.
- The shield shows crossed out on sites where blocking is off.

## 1.0.0-owner.17 — 2026-11-05

*Owner test build of Oto v1 — sync fix.*

**Fixed**
- **"Couldn't sync — Not signed in".** Two things could leave Oto half signed in: signing in to Supabase worked but reading your saved data failed, or two refreshes of your sign-in happened at the same moment (Supabase only accepts each refresh once, so you got signed out). Oto now refreshes your sign-in one at a time, cleans up a failed sign-in, and if it ever needs your password again it shows the sign-in form instead of an error. Sync now and the automatic sync also wait for each other instead of failing with "busy".

## 1.0.0-owner.16 — 2026-11-05

*Owner test build of Oto v1.*

**Removed**
- **The PC lock / lock screen is gone.** Oto never asks for a PIN anymore — if you had set one, it's cleared — and saved passwords show without a PIN. Oto Account sign-in and sync stay.

## 1.0.0-owner.15 — 2026-11-05

*Owner test build of Oto v1 — fixes.*

**Fixed**
- **The window couldn't be dragged.** The bookmarks strip covered the whole top bar; its empty part moves the window again (bookmarks stay clickable).
- **Google wouldn't let you sign in** ("This browser or app may not be secure"). On Google's sign-in page Oto now looks like Chrome to Google, so signing in works.
- **The new tab page is centred** — greeting, search box, card and shortcuts.

## 1.0.0-owner.14 — 2026-11-04

*Owner test build of Oto v1 — fix.*

**Fixed**
- With the sidebar at its smallest width, the reload button and the star next to the shield stuck out of the sidebar onto the top bar. The address box now shrinks and the buttons get a little smaller so everything fits.

## 1.0.0-owner.13 — 2026-11-04

*Owner test build of Oto v1 — Spotify fix and the Oto theme.*

**Fixed**
- **Spotify skipped every song** ("Spotify can't play this right now"). The Widevine signature was made before the installer builder changed Oto.exe (its icon and version info), which broke the signature. Oto is now signed as the very last step, and every build checks the signature.

**Changed**
- **The near-black editorial look is now the Oto theme** (it was called RyokuTunes). The older bright theme is hidden for now.
- The theme uses **音** (oto, "sound") instead of 力.

## 1.0.0-owner.12 — 2026-11-04

*Owner test build of Oto v1 — fixes.*

**Fixed**
- **Music stopped after one song** when its tab was in the background. In the short gap between songs Oto thought the tab was quiet and froze it to save CPU, so the next song couldn't start. A music or video tab now counts as playing for 10 minutes after its last sound, and the tab in the media card is never frozen or put to sleep.
- The media card looks like it used to again (with the song's artwork and title).
- The Oto Card editor has levels, editions, titles and badges back in it, like before — no "Open Oto Hub" button. The Hub is still there with `Ctrl+Shift+H` or `/hub`.

**New**
- Settings → About → *Protected content*: shows if Widevine is installed, an **Install now** button, and **Test** to check if the page you're on can play protected content.

## 1.0.0-owner.11 — 2026-11-04

*Owner test build of Oto v1 — signed for Widevine.*

**Fixed**
- Oto is now production-signed for Widevine (castlabs EVS), which Netflix, Disney+ and other strict streaming services need.

## 1.0.0-owner.10 — 2026-11-04

*Owner test build of Oto v1 — Spotify, Netflix and other streaming.*

**Fixed**
- **Spotify songs wouldn't play** (and Netflix, Disney+, Prime Video, Tidal, Deezer… showed "protected content" errors). Oto now runs on Electron for Content Security, which adds Google's Widevine — the same module Chrome uses for protected music and video. It installs itself on first start (needs internet, about a minute), then keeps itself updated. If a streaming tab was already open, Oto offers *Reload*.
- Settings → About shows whether protected content is ready.

**Changed**
- Oto's engine moved to Electron 44 for Content Security (Chromium 152), and the daily security updates now follow those releases.

## 1.0.0-owner.9 — 2026-11-04

*Owner test build of Oto v1 — Oto Accounts are switched on.*

**New**
- **Oto Accounts are live** — Settings → *Account & sync* → *Create account*. Your settings, themes, bookmarks, spaces, card and passwords are encrypted on your PC and saved to your account.
- Clearer message if the Oto server isn't fully set up.

## 1.0.0-owner.8 — 2026-11-04

*Owner test build of Oto v1 — Alpha 6: Oto Accounts and the PC lock.*

**New**
- **Oto Account** (Settings → *Account & sync*, or the account chip in the Oto Hub) — create an account or sign in, and Oto saves your **settings & themes**, **bookmarks & spaces** (pinned tabs, folders, site notes), **Oto Card, level & badges** and **saved passwords** to it. Sign in on another PC and choose *Use my cloud data* to get it all back.
  - **Encrypted on your PC first** — everything is locked with your account password before it's uploaded; the server only stores scrambled data.
  - **Syncs automatically** about 20 seconds after you change something, and checks for changes from your other PCs every few minutes. *Sync now* any time; choose what to sync.
  - Your card, badges and passwords always **merge** — nothing from either PC is lost.
  - Change password (re-encrypts your data), sign out, or delete your cloud data.
  - New installs: *Already have an Oto account? Sign in* in the welcome setup.
- **PC lock** (Settings → *Account & sync* → PC lock) — a PIN or password that Oto asks for when it starts, after you've been away (5 min – 1 hour), when Windows locks or sleeps, and before showing, copying or exporting a saved password. *Lock now* with `Ctrl+Alt+L`. While locked, pages are hidden and muted and saved passwords and sync are blocked. Too many wrong tries wait longer each time.

**Note:** accounts switch on as soon as the Oto server is connected (next owner build).

## 1.0.0-owner.7 — 2026-11-04

*Owner test build of Oto v1 — Alpha 5: the Oto Hub and Founder security.*

**New**
- **Oto Hub** (`Ctrl+Shift+H`, `/hub`, or tap the card on the new tab page) — one place for your card, music, achievements, browser milestones and cosmetics:
  - **My card**: your card (tilt it, flip it, save it), level, milestones and badges together.
  - **Music**: what's playing now with big artwork and a live waveform, plus *Recently played* (kept only on this PC, never in Avocado).
  - **Achievements**: every badge with the day you got it, and hints for the hidden ones.
  - **Milestones**: days with Oto, ads blocked, pages, hours browsing, spaces and badges, each with its next goal.
  - **Cosmetics**: editions, card designs, level frames and titles — equip what you've unlocked.
- **The card back matches the front** — same shape, colours and frame as your edition and design (Founder back is black and gold, OG back is the indigo → sky gradient, Keycard, Classic and Shiny each have their own).
- **Now Playing in the Oto card look** — dark glass with a holographic rounded border that slowly turns while music plays.

**Security**
- The owner key is now checked only by Oto's main process. The PC keeps the key encrypted with Windows (tied to your Windows account) and re-checks it at every start, so editing files, browser storage or the interface can't unlock owner features.
- The Founder card is signed with the owner key (Ed25519) and only shows with a valid signature.
- Too many wrong keys lock the key box for a while (1 minute, then longer).
- The interface's developer tools only open on the owner's PC in release builds.
- **After this update, enter your owner key once more** (Settings → About → tap "Oto version" 7 times) — the old saved unlock is no longer accepted.

## 1.0.0-owner.6 — 2026-11-04

*Owner test build of Oto v1 — Alpha 4: the held ideas, card levels and the Owner panel.*

**New**
- **Card levels** — your Oto Card now levels up: Rookie → Bronze → Silver → Gold → Holo → Mythic. XP comes from days with Oto, ads blocked, spaces, pages and badges. A progress bar shows how far to the next level, each level unlocks a title and a glowing frame (Holo shimmers, Mythic gets a moving aurora), and a flip animation plays when you level up.
- **Badges** — 15 hidden badges (7 days with Oto, 1,000 ads blocked, first split view, went Avocado, night owl…). Press *Flip* on your card to see them on the back.
- **OG card** — the original two-ring logo on the first indigo → sky gradient, "ORIGINAL USER", your card number and the day you started.
- **Founder card** — black and gold with a big 力, "OWNER · Nº 0000 · ONE OF ONE", signed Ryo. Only unlocks on a PC with the owner key.
- **Owner panel** — type `/admin` in the command bar, or Settings → About → *Owner panel* (owner key only): card XP and badge controls, test screens (welcome setup, what's new, startup animation, offline page, update card, Wrapped), switches for every v1 feature, quick info and *Check for updates*.
- **Now Playing** — the media card shows the song's artwork, title and artist, with a moving waveform while it plays.
- **New tab widgets** — your card level and progress, and shortcuts to the sites you visit most.
- **Space switch animation** — the new space's colours melt in with its name big in the middle.
- **Tab peek** — rest the mouse on a tab to see a preview, its address and how much memory it uses.
- **Ambient glow** — while a video or music plays, a soft glow in the page's colours shines around it.
- **Focus mode** — `/focus` (or `/focus 50`): hides everything but the page, mutes the other tabs and runs a timer. Includes **Reader view** for clean, easy-to-read articles (`/reader`).
- **Breathing background** — the space colours gently pulse while music plays.
- **Smarter command bar** — unit conversions (`5 km`, `70 kg`, `30 c`) and timers (`timer 10 min`).

## 1.0.0-owner.5 — 2026-11-04

*Owner test build of Oto v1 — bug fixes.*

**Fixed**
- In dark mode the space colours showed as stripes / bands down the sidebar instead of one smooth gradient.
- The `Ctrl L` hint no longer squashes the address box in a narrow sidebar (it shows when you hover).
- Note and flame icons no longer crowd tabs in the icon-only sidebar.

## 1.0.0-owner.4 — 2026-11-04

*Owner test build of Oto v1 — bug fixes.*

**Fixed**
- Pressing a keyboard shortcut showed "A JavaScript error occurred in the main process" (Cannot read properties of null — getOwnerBrowserWindow). Shortcuts work again everywhere: on pages, in the sidebar and in Avocado windows.
- Links opened from other apps didn't use the Quick window — they now open in a floating Glance window.

## 1.0.0-owner.3 — 2026-11-04

*Owner test build of Oto v1 — Alpha 3 (pictures 17–23). All 23 pictures are in now.*

**New**
- **Make the buttons yours** — right-click the bottom of the sidebar → *Customize buttons…*: add or remove Library, Notifications, Oto Health, Settings, Split view, Screenshot, Space overview, Theme maker, Site note, Oto Night, Avocado, Send to phone, Oto Wrapped or Extensions; drag to reorder; icons, hover labels or text; small, medium or large.
- **Notification center** (bell at the bottom of the sidebar) — every site's notifications in one list, grouped by site, with *Do not disturb* for 1 hour, until tomorrow morning, or until you turn it off.
- **Comfort** (Settings → Appearance) — text size for all websites, high contrast, reduce motion, bigger buttons and a warm night light after 21:00.
- **Swipe to go back** — two fingers left or right on a touchpad goes back or forward.
- **Theme maker** — change your space's colours live, try Glossy / Pastel / Deep / Mono, strength and grain, save themes, and share them with a short code like `OTO-…` that friends can paste.
- **Tab folders** — right-click a tab → *Add to new folder…*; open and close folders, rename, recolour, ungroup. Closed folders show small stacked icons and a count. Drag tabs onto a folder to add them.
- **Site notes** — a sticky note for a page or a whole site (site panel, right-click a tab, or the command bar). A yellow note icon shows in the address box and on the tab.
- **Screenshots** (`Ctrl+Shift+X`) — drag an area, the visible part, or the whole long page; draw with pen, arrows and boxes, add text, blur private stuff; copy, or save to *Pictures › Oto Screenshots*.
- **Oto Wrapped** — a story of how you use Oto: time on pages, top sites, your personality (Night Owl, Early Bird…), and what Oto blocked for you. Copy it as a picture. Counted only on your PC.
- **Startup animation** — the ring draws itself when Oto opens (under a second, off with animations).
- **Oto sounds (音)** — Soft, Typewriter or Bubbles sounds for new tab, close tab, download done and switching spaces. Off by default.
- **Separate logins per space** — right-click a space → *Give this space its own logins*: use a different account on the same site in each space.

## 1.0.0-owner.2 — 2026-11-04

*Owner test build of Oto v1 — Alpha 2 (pictures 9–16).*

**New**
- **Oto Health** (`Shift+Esc`, or the heartbeat button at the bottom of the sidebar) — how much memory Oto uses, every open tab sorted by memory, about how much sleeping tabs save, and a warning with *Put to sleep* when a background tab works the CPU hard. Busy tabs get a small flame in the sidebar.
- **Battery saver** — turns on by itself when a laptop is unplugged (or switch it on/off in Oto Health): background tabs sleep after 5 minutes, background videos pause, fewer animations, and a battery pill in the top bar.
- **Quick window** — links you click in other apps open in a floating Glance window. Keep it as a tab or close it.
- **Loading line** in your space colours across the top while a page loads.
- **Clean links** — copying a link removes tracking parts like `utm_…` and `fbclid` and tells you how many it removed.
- **No more cookie popups** — Oto presses *Reject all* for you, or hides the popup when there's only *Accept*.
- **Dark page** — a switch in the site panel turns any bright site dark (pictures keep their colours), remembered per site.
- **Backup & restore** (Settings → General) — save everything to one `.oto` file and restore it on a new PC. Add a backup password to include your saved passwords (encrypted).
- **Space templates** — Gaming, School, Work and Music (right-click the space name, or the command bar).
- **Video tools** — hover a video for 1× / 1.5× / 2×, loop, screenshot and picture-in-picture.
- **Search inside your tabs** — the command bar finds words on the pages you have open and jumps right to them.
- **A secret** for people who like typing slash commands. 🤫
- **Oto Night** (Settings → Appearance) — Off, On, Follow Windows or After sunset.
- **Space overview** (`Ctrl+Shift+Space`, or double-click the space name) — every space as a card with its tabs; search all spaces, drag tabs between spaces, or make a new one.
- **Avocado** 🥑 (`Ctrl+Shift+N`) — Oto's private window, with its own green look. Nothing is saved, and closing it wipes cookies and site data.
- **Oto Apps** — install a site as its own app window with its own Start-menu entry (site panel → *Install as app*).
- **Send to phone** — a QR code of the page (site panel or right-click).

## 1.0.0-owner.1 — 2026-11-04

*Owner test build of Oto v1 — Alpha 1. Only shows up for the Owner update channel.*

**New**
- **Cleaner main window** — the page name sits in the middle of the top bar, a glass address box with `Ctrl L`, bigger Essentials with a coloured line under the open one and a red dot when a site has something new, *Pinned* and *Today* sections, a glowing line on the tab you're on, a moving sound wave on tabs playing audio, sleeping tabs marked *zz*, and the version number at the bottom.
- **Warmer new tab** — the date, a thin clock in your space colours, your name in colour, a bigger search box and *Jump back in* with the last pages you visited.
- **Site panel** — click the lock: ads & trackers blocked, Location / Camera & mic / Notifications as Ask · Allow · Block, sound on/off, zoom, *Always open in* a space, and *Clear site data*.
- **New right-click menu** — back, forward, reload and bookmark as big buttons on top, plus Glance, split view and *Open in space…*.
- **Command bar** — filters (All, Tabs, History, Bookmarks, Actions, Spaces) with counts, `Tab` to switch filters, matches in bold, shortcuts next to actions, instant answers to sums like `12*4.5+30`, and slash commands: `/space`, `/theme`, `/card`, `/closed`, `/shortcuts` and more.
- **Settings** — search every setting, pages sorted into Basics · Browsing · Make it yours · Oto, settings in soft cards, and a *Saved · Undo* pill after each change.
- **Drag a tab onto the page to split** — drop it on the left or right half. Each half gets a small header with swap and close.
- **Oto's own error pages** — *You're offline* (tries again by itself, and you can play **Ring Run** while you wait), *This site isn't safe right now*, *This tab crashed*, and a small bar when a page doesn't exist.
- **Small stuff** — find bar with *Match case* and yellow marks on the right edge for every match, a zoom pill in the middle, dark message pills, permission asks that come out of the address box, an *Update ready* card in the sidebar, and recently closed tabs (right-click *New Tab* or `/closed`).
- **Hold Ctrl** for a second to see every shortcut. Let go to close it.
- **Owner channel** — Settings → About: tap *Oto version* 7 times and enter your owner key.

## 0.9.10.1 — 2026-11-04

**New**
- **Become a tester** — Settings → About → Updates → **Update channel**: *Stable* (everyone), *Beta* (new versions before everyone else) or *Alpha* (the newest experiments). Testers still get every stable update too, and Oto never goes back to an older version on its own.

## 0.9.10 — 2026-11-04

**New**
- **RyokuTunes theme** (Settings → Appearance → Theme) — a near-black, editorial look in the style of the RyokuTunes music app: hairline borders, a big serif "Good morning" on the new tab page, small mono labels like `01  ESSENTIALS`, 力 accents, numbered tabs with a cream highlight for the one you're on, outlined buttons and a barcode footer. Your space's colour glows faintly in the corner. Switch any time — or type "RyokuTunes" in the command bar.

## 0.9.9.1 — 2026-11-04

**Security**
- Updated Oto's engine to Electron 45.2.2 (Chromium 156.0.8078.80) with the latest security fixes from Chrome. This update was made automatically.

## 0.9.9 — 2026-11-04

**New**
- **Passwords** — when you log in, Oto offers to save the password (encrypted on your PC with Windows' own protection). Next time, click the login box and pick your account to fill it in. A key button in the address row shows saved logins for the site.
- **Passwords page** in the Library: search, show, copy, edit, add (with a strong-password generator), delete, and import from Chrome, Edge, Brave, Opera or Firefox. Settings → Privacy → Passwords.
- **What's new** — after an update, this window shows what changed since the version you had. Open it any time from Settings → About or the command bar.
- **Automatic Chromium updates** — Oto now checks every day for security fixes to its Chromium engine and releases them as small updates by itself.
- **Fresh installs start with the welcome setup** — uninstall and install Oto again and it walks you through setup (your tabs and bookmarks are kept).

**Changed**
- The "Run setup" button is gone from Settings → About — the setup runs by itself after a fresh install.

## 0.9.8.1 — 2026-11-04

**New**
- **Oto Phone** page in the Library, under Oto Card — a model of the phone version that's coming one day, with your Oto Card in the phone's wallet. Marked *Coming soon*.
- **Small updates get their own numbers** — like 0.9.8.1, 0.9.8.2 — while big updates stay 0.9.9, 1.0 and so on.

## 0.9.8 — 2026-11-04

**Changed**
- **Cleaner sidebar**: the space switcher (dots and +) at the bottom is gone, and the menu on the space name now only has *Change colours* and *Edit space*. Switch or create spaces with `Ctrl+Shift+1…9`, the command bar (`Ctrl+T`) or Library → Spaces.
- Both can be turned back on in Settings → Sidebar → Space header.

## 0.9.7 — 2026-11-04

**New**
- **Glance for links to other sites** (Settings → Tabs → Open links in Glance → *Links to other sites*): like Arc's Peek, clicking a link that leaves the site opens it in Glance, while links within the same site open normally.

**Fixed**
- With *Every link click*, each new YouTube video opened in a Glance window. Anyone using that setting is moved to *Links to other sites*, so videos on the same site open normally again.

## 0.9.6 — 2026-11-04

**Changed**
- **Alt + click no longer opens Glance** — clicking a link just opens it, like any browser. Glance is still there: right-click a link → **Open link in Glance**.
- New setting **Settings → Tabs → Open links in Glance**: *Never — normal clicks* (default), *Alt + click*, or *Every link click* if you want every link to open in a Glance window.

## 0.9.5 — 2026-11-04

**New**
- **Choose your card design**: **Keycard** (cyberpunk), **Classic** (the original card is back) or the new **Shiny** card.
- **Shiny card** — a holographic trading card with a Chrome, Rainbow, Colour or Gold frame, foil artwork with sparkles, rarity stars, your title on a ribbon and your stats as a list.
- **The card preview tilts toward your mouse** with a moving glare — and on the Shiny card the rainbow foil follows the mouse.

**Fixed**
- **Glance is stricter**: Alt + click only opens it when you press *and* release on the same real link, with Alt actually held on that page. Clicks made by page scripts, stray Alt after Alt+Tab, video players and big link-wrapped areas no longer open it.

## 0.9.4 — 2026-11-04

**New**
- **Oto Card is now a cyberpunk keycard** — chamfered corners, lanyard slot, neon edge glow, gold chip, holo sticker with the Oto mark, scanlines over the artwork, glitchy name, data readout and a barcode made from your name. Styles: **Neon**, **Holo**, **Tinted** and **Ivory**; all the other options (artwork, colours, font, grain, stats) still work.
- **Your own image as a space icon** — Edit space → Icon → **Image…** (PNG, JPG, GIF, SVG, WebP). It shows next to the space name, in the space switcher and in the Library.
- **Choose the arrow next to the space name** — chevron, triangle, arrow, plus, dots, spark or none, in the text or accent colour (Settings → Sidebar → Space header).
- **Choose what flies when a download starts** — a little file showing its type (new default), the glowing orb, or nothing — and pick the downloads button icon: tray, arrow, cloud or box (Settings → General → Downloads).
- **Holding Alt outlines the link** that Alt + click will open in Glance.

**Fixed**
- **Alt + click only opens Glance on real links** — not on video players, ad overlays or whole areas wrapped in a link (like the YouTube player opening an ad).

## 0.9.3 — 2026-11-04

**New**
- **Downloads button** at the bottom of the sidebar — a tray with an arrow inside a progress ring that fills as files download, a count badge when several are running, and a tick that draws itself when one finishes. Right-click for the Downloads folder.
- **Download animation** — when a download starts, a glowing orb bursts at your cursor and arcs into the downloads button with a trail of sparks; the button catches it with a bounce and a ripple. Skipped when animations are off.

**Fixed**
- A failed download now shows on the button (red arrow with a shake) instead of only a message.

## 0.9.2 — 2026-11-04

**New**
- **Library** (`Ctrl+Shift+O`): Downloads, History, Media, Spaces, Boosts, Routing and your Oto Card in one panel, with search.
- **Download card** at the bottom of the sidebar: file, size, speed, time left, pause/cancel, open and show in folder.
- **Routing**: send a site to a space (e.g. youtube.com → Fun) so links to it always open there.
- **Oto Card**: your own customisable card — name, title, 7 artworks, colours, Paper/Night/Tinted styles, 4 fonts, grain and stats. Shuffle it, save it as an image or copy it.
- Shortcuts: `Ctrl+J` downloads, `Ctrl+H` history.

**Fixed**
- With "Ask where to save" on, downloads never showed as started.
- A stray "null" appeared on the download card.
- The Oto Card page could crash when opened for the first time.
- The date on the card overflowed its box.

## 0.9.1 — 2026-11-04

**New**
- **Auto-update** from GitHub Releases: checks shortly after launch and every 6 hours, downloads in the background, installs on restart. Settings → About → Updates.
- Problem reports now say *why* the sidebar stayed open (e.g. "settings open", "mouse back over it").

**Fixed**
- The **Low memory** speed preset was quietly switching animations off — it doesn't any more, and Oto turns them back on if that happened.

## 0.9.0 — 2026-11-04

**New**
- **Custom setup**: 9 steps — import bookmarks, default browser, layout (Zen/Classic, sidebar Full/Icons/Hidden, left/right) with live previews, colours, look & feel, speed, search & privacy, Essentials.
- **Branded installer** with Oto's logo and artwork, desktop shortcut, and "Open Oto now" at the end.
- **Split view** (`Ctrl+Shift+S`): two tabs side by side with a draggable divider.
- **Glance**: `Alt + click` a link to preview it in a floating window; open it as a tab or in split view.
- **Media controls** in the sidebar — play/pause, mute, picture-in-picture (`Ctrl+Shift+P`).
- **Report a problem** (Settings → About) saves a log of what the sidebar, top bar and mouse did.

## 0.8.6 — 2026-11-03

**New**
- New logo: a glowing ring with a gap and an infinity sign, in purple → cyan. Used for the app, taskbar, installer and all App icon colour styles.

## 0.8.5 — 2026-11-03

**Fixed**
- The slid-open sidebar now closes as soon as the mouse moves onto the page, even on Windows setups that report the cursor position wrongly.
- Oto's own interface is locked at 100% zoom, so Ctrl+scroll over the sidebar can't throw off the layout.

## 0.8.4 and earlier

- Zen-style look: full-strength space gradients, darker grain, sidebar and top bar connected into one surface, text that switches light/dark automatically.
- Dynamic sidebar (icon strip that grows on hover), drag-to-resize with snap points, auto-hiding top bar and sidebar, sidebar timing settings.
- Animations Off / Smooth / Playful / Custom with a curve editor and live preview.
- Extensions from the Chrome Web Store, plus .crx, .xpi and unpacked folders.
- Bookmarks bar with folders and overflow; import from Chrome, Edge, Brave, Opera, Vivaldi, Zen and Firefox.
- Arc-style settings, Boosts, Mods, Archive, performance presets and a task manager.
- Fixes: window buttons that matched the theme instead of turning blue, the top bar not opening on hover, the bookmarks bar getting cut off, and the sidebar closing only on click.
