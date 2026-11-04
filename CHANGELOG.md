# Changelog

What's new and what got fixed in each version of Oto. Oto updates itself — you'll see
"Oto x.y.z is ready — Restart" a few seconds after opening it when a new version is out.

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
