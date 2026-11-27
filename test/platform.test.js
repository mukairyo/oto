'use strict';
// On Wayland the system's cursor position is stale, so Oto doesn't use it to slide the sidebar (main/platform.js, 1.9.5).
const test = require('node:test');
const assert = require('node:assert');
const { cursorTrusted } = require('../main/platform.js');

test('Windows and Linux on X11 use the system cursor position', () => {
  assert.strictEqual(cursorTrusted({ platform: 'win32', env: {} }), true);
  assert.strictEqual(cursorTrusted({ platform: 'linux', env: { XDG_SESSION_TYPE: 'x11', DISPLAY: ':0' } }), true);
});
test('Linux on Wayland (Hyprland, GNOME, KDE) does not', () => {
  assert.strictEqual(cursorTrusted({ platform: 'linux', env: { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-1' } }), false);
  assert.strictEqual(cursorTrusted({ platform: 'linux', env: { WAYLAND_DISPLAY: 'wayland-0' } }), false);
});
test('…unless Oto was started on X11 under Wayland (XWayland)', () => {
  assert.strictEqual(cursorTrusted({ platform: 'linux', env: { WAYLAND_DISPLAY: 'wayland-1', ELECTRON_OZONE_PLATFORM_HINT: 'x11' } }), true);
});
