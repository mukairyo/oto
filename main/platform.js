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
module.exports = { cursorTrusted };
