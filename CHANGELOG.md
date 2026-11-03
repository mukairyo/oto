# Changelog

What's new and what got fixed in each version of Oto. Oto updates itself — you'll see
"Oto x.y.z is ready — Restart" a few seconds after opening it when a new version is out.

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
