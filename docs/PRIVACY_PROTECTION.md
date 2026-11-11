# Oto Shield: tracking and fingerprint protection

What Oto Shield does from 1.5.0, how to set it, what was measured, and what it does not protect against.
Everything here runs on your PC. Nothing about your browsing is sent anywhere.

## Protection levels

Settings → Oto Shield → Blocking. Three levels; each protection is also a switch of its own.

| | Standard (default) | Strict | Custom |
|---|---|---|---|
| Ads | blocked | blocked | always blocked while Shield is on |
| Trackers and analytics | blocked | blocked | switch |
| Session recorders | blocked | blocked | switch |
| Cookie banners, popups, "turn off your adblocker" walls | left | blocked | switch |
| Fingerprint protection | on | on | switch |
| Calls and your network (WebRTC) | only the connection your traffic uses | public address only | Off / Standard / Strict |
| Click identifiers removed from links | yes | yes | follows the Trackers switch |

- **Changing a switch** moves the level to Custom. **Restore defaults** goes back to Standard.
- **Per site:** "Shield off for this site" (Shield menu, or the list at the bottom of Blocking) switches all of the
  above off for that site only: blocking, fingerprint changes, link cleaning, and the WebRTC setting.
- **Settings from before 1.5.0 keep their meaning.** Balanced is now called Standard, Strict stays Strict. Basic
  ("ads only") and anyone who had switched fingerprint protection off become Custom with the same protections as before.
- **Strict can break sites.** Cookie-banner lists sometimes hide a consent box a site insists on, and calls between two
  devices on the same Wi-Fi may connect slower. If a site misbehaves, switch Shield off for that site.

## Blocking

Oto uses uBlock Origin's filter lists (EasyList, EasyPrivacy, uBlock filters, Peter Lowe's list) through the Ghostery
filter engine, plus a small list of its own (`trackers.js`). One blocking listener per session; normal tabs, Spaces
and private windows are all covered (end-to-end tested).

### The gap that was fixed in 1.5.0

Most tracker rules in the lists only apply when a tracker is loaded by *another* site, so that a company's own website
keeps working. Oto learned "which site is asking" from the `Referer` header. A page can switch that header off
(`Referrer-Policy: no-referrer` or `same-origin`, `referrerPolicy` on one request, blank frames, workers). Then every
tracker looked like part of the site itself and none of those rules applied.

Measured with Oto's real lists on about 150 well-known tracker scripts, as a page that sends no Referer:

| | Before | After |
|---|---|---|
| Session recorders | 12 of 47 | 42 of 47 |
| Analytics | 14 of 42 | 31 of 42 |
| Ad networks | 19 of 40 | 32 of 40 |

Now the asking page comes from the frame that makes the request (`main/request-source.js`), whatever the header says.
The end-to-end suite `thirdparty` asks for a recorder from another site in every way a page can (script, fetch, fetch
without referrer, XHR, image, beacon, frame, blank frame, worker) on a normal page and on pages that hide the Referer.
It fails 8 of 14 checks on Oto 1.4.2 and passes now.

### Session recorders

Products that record what you do on a page (mouse, scrolling, clicks, typing) for replay: Hotjar, FullStory, Microsoft
Clarity, LogRocket, Mouseflow, Smartlook, Lucky Orange, Inspectlet, Crazy Egg, Contentsquare, Glassbox, Quantum Metric,
SessionCam, Medallia, OpenReplay, UXCam, LiveSession, SessionStack, Yandex Webvisor, and the replay part of PostHog.
Blocked when another site loads them; the vendor's own website keeps working. Counted on their own in the dashboard.

Not classed as recorders on purpose, because sites need them to work: error reporting (Sentry, Datadog), in-app guides
(Pendo, Userpilot), chat (Intercom), and the rest of PostHog.

### What "not blocked" on a test page can mean

The lists replace some scripts (Google Analytics, Google Tag Manager, Google's ad tag, Amazon's ad tag) with an empty
stand-in instead of blocking them, because sites break when the script is missing. The real tracker never loads, but a
test that only asks "did something come back?" counts it as not blocked. Brave does the same.

### Click identifiers in links

`fbclid`, `gclid`, `msclkid` and about 30 similar parameters are removed from an address when you open a page
(`main/clean-url.js`). Campaign labels (`utm_…`), affiliate parameters and everyday names are left alone.

## Fingerprint protection

A site can recognise a PC by small differences in how it draws pictures and plays sound. With protection on:

- **Canvas** (also off-screen canvas), **WebGL pictures** and **audio** readouts get tiny changes. They are the same on
  one site during one session, so pages work normally, and different on every other site and after every restart of
  Oto. A site can't use them to follow you to another site or recognise you tomorrow.
- A **frame from another site** inside a page gets the changes of the site you are on. Before 1.5.0 protection did not
  run inside such frames at all, and an embedded tracker read the real values.
- Which pixels change depends on the picture too, so a script can't learn the pattern from a test picture and undo it.
- **Battery** answers are those of a desktop PC on mains power.
- "Are you human?" boxes (Cloudflare, hCaptcha, reCAPTCHA) get the real values: changed readings there look like a
  bot and lock you out.

Measured by the end-to-end suites `fingerprint` and `fingerprint2` (28 checks): same site twice, another site, the same
embedded frame on two sites, after a restart, with protection off, with Shield off for one site.

### What it does not do (read this before trusting a score)

- **It does not make you look like everyone else.** Screen size, time zone, languages, installed fonts, the
  graphics-card name, CPU cores and memory stay real. Together they can still identify a PC. Hiding them breaks sites
  (wrong layout, wrong time, missing fonts) or needs changes inside the browser engine itself.
- **CPU cores and the plugin list are not varied per site.** Brave varies both. Oto can't vary CPU cores
  consistently: background workers would still report the real number, and a page that sees two different answers
  treats the browser as a bot. The plugin list is the same five entries for every Chrome user, so shuffling it hides
  nothing; it would only change a test's verdict.
- **So Cover Your Tracks still says "unique fingerprint".** That test says "randomized" when at least 4 of these 5
  differ between two sites: canvas, WebGL, audio, plugin list, CPU cores. Oto varies the first three.
- **Workers are not covered.** A script can draw on an off-screen canvas inside a background worker and read the real
  values. Closing this needs engine changes.
- **Your IP address** is not hidden. Use a VPN for that; the WebRTC setting stops a call from bypassing it.

## Cookies and storage

- Storage of an embedded frame (localStorage, IndexedDB, caches) is kept apart per site that embeds it. That is
  Chromium's own partitioning; Oto relies on it and the test suite checks it is on.
- Third-party cookies are **not** blocked across the board. Doing that breaks embedded sign-ins and some payment
  frames; it is the main thing left to do (see below). Per-site "Cookies: Block" in Site permissions still works.

## Security review of the 1.5.0 changes

- Pages and frames stay sandboxed, context-isolated and without Node.js. `nodeIntegrationInSubFrames` (Electron's name
  for "run the session's page scripts in frames too") is new; the `fingerprint` suite checks that neither a page nor a
  frame can see `require`, `process`, `module`, `global` or `Buffer`.
- One new message channel from Oto's own window (`shield:feature`), checked by the same gatekeeper and schema as the
  others. No new channel is open to web pages.
- No new dependencies, no remote code, `webSecurity` untouched, certificate checks untouched, update path untouched.
- Request blocking still has exactly one listener per session.

## Performance (same test machine, before → after)

| | 1.4.2 | 1.5.0 |
|---|---|---|
| Opening a page (median) | 119 ms | 119 ms |
| Memory with a few tabs | 1362 MB | 1344 MB |
| A page that loads 30 frames from another site | 417 ms | about 555 ms |
| Reading a 1280×720 canvas | 5.1 ms | 7.1 ms |

The frame cost is page protection now running in each frame; the canvas cost is the picture-dependent change.

## Not tested from the development machine

Real websites (Google, YouTube, GitHub, Spotify, Discord, shops, sign-ins, calls), the real test sites
(adblock.turtlecute.org, coveryourtracks.eff.org, tabulaapp.com, browserleaks.com), Brave on the same PC, and WebGL
readings (the Linux test machine has no WebGL). These need a person with the test build on Windows.

## Left to do

1. Third-party cookie blocking with exceptions for sign-in and payment frames.
2. Protection inside workers and for CPU cores / memory (needs engine-level support).
3. Bounce tracking (a link that passes through a tracker's address before the real page).
4. Font and screen-size protection as a Strict option, if a way is found that doesn't break layouts.
