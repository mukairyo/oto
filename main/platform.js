'use strict';
// Oto — small facts about the system Oto runs on (1.9.5).
// Wayland (Hyprland, GNOME and KDE on Wayland…) doesn't tell an app where the mouse is outside its own window, or even
// where its window is on screen, so screen.getCursorScreenPoint() is stale or measured from the wrong corner there.
// Oto then relies only on the mouse events it gets itself (its edge strip, the sidebar) to slide the sidebar and top
// bar open and closed. With a stale position the hidden sidebar kept opening and closing ("glitchy" on Linux).
function cursorTrusted({ platform = process.platform, env = process.env } = {}) {
  if (platform !== 'linux') return true;
  const wayland = String(env.XDG_SESSION_TYPE || '').toLowerCase() === 'wayland' || !!env.WAYLAND_DISPLAY;
  const forcedX11 = /(^|\s)--ozone-platform=x11(\s|$)/.test(String(env.ELECTRON_OZONE_PLATFORM_HINT_ARGS || '')) || String(env.ELECTRON_OZONE_PLATFORM_HINT || '').toLowerCase() === 'x11';
  return !wayland || forcedX11;
}
// (1.9.8) On Wayland desktops the system picks what to share (its own screen/window picker, through the desktop
// portal): asking it twice, for screens and for windows, opened two pickers. There, Oto asks once and uses the answer.
function onWayland({ platform = process.platform, env = process.env } = {}) { return platform === 'linux' && !cursorTrusted({ platform, env }); }
// (1.9.8) Passwords on Hyprland, Sway, niri and other window managers: Chromium only looks for the desktop's keyring on
// the desktops it knows (GNOME, KDE, Xfce…). Everywhere else it went straight to its "basic_text" fallback, which
// installed Oto rightly refuses (main/keyring.js) — so saved passwords didn't work even with GNOME Keyring or
// KeePassXC running. There Oto asks Chromium to use the Secret Service (libsecret) keyring; with no keyring running
// it still falls back, and Oto still refuses that. A --password-store you pass yourself always wins.
const KNOWN_DESKTOPS = /gnome|unity|pantheon|xfce|cinnamon|deepin|ukui|kde|plasma|lxqt|lxde|budgie|mate|cosmic/;
function passwordStore({ platform = process.platform, env = process.env, argv = process.argv } = {}) {
  if (platform !== 'linux') return null;
  if ((argv || []).some((a) => /^--password-store(=|$)/.test(String(a)))) return null;
  const de = `${env.XDG_CURRENT_DESKTOP || ''}:${env.XDG_SESSION_DESKTOP || ''}:${env.DESKTOP_SESSION || ''}`.toLowerCase();
  if (KNOWN_DESKTOPS.test(de)) return null; // Chromium finds the right keyring there itself
  return 'gnome-libsecret';
}
// Is a Secret Service keyring running, or startable on demand (GNOME Keyring, KWallet's, KeePassXC…)? Asked of the
// session bus with dbus-send (part of every Linux desktop). Without one, Oto doesn't ask Chromium for it: a missing
// keyring would leave Chromium with no lock at all instead of its fallback.
function secretServiceThere(run = require('child_process').execFileSync, exists = require('fs').existsSync) {
  const bin = ['/usr/bin/dbus-send', '/bin/dbus-send'].find((p) => { try { return exists(p); } catch { return false; } });
  if (!bin) return false;
  for (const m of ['ListNames', 'ListActivatableNames']) {
    try {
      const out = String(run(bin, ['--session', '--dest=org.freedesktop.DBus', '--type=method_call', '--print-reply', '/org/freedesktop/DBus', `org.freedesktop.DBus.${m}`], { timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }));
      if (/"org\.freedesktop\.secrets"/.test(out)) return true;
    } catch {}
  }
  return false;
}
module.exports = { cursorTrusted, onWayland, passwordStore, secretServiceThere };
