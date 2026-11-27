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

// (1.9.8) the keyring on window managers Chromium doesn't know, and the one-picker screen share on Wayland
const { onWayland, passwordStore } = require('../main/platform.js');
test('Hyprland, Sway and other window managers get the Secret Service keyring', () => {
  assert.strictEqual(passwordStore({ platform: 'linux', env: { XDG_CURRENT_DESKTOP: 'Hyprland' }, argv: ['oto'] }), 'gnome-libsecret');
  assert.strictEqual(passwordStore({ platform: 'linux', env: { XDG_CURRENT_DESKTOP: 'sway' }, argv: ['oto'] }), 'gnome-libsecret');
  assert.strictEqual(passwordStore({ platform: 'linux', env: {}, argv: ['oto'] }), 'gnome-libsecret');
});
test('…not where Chromium already finds the keyring, not on Windows, and never over your own --password-store', () => {
  assert.strictEqual(passwordStore({ platform: 'linux', env: { XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' }, argv: ['oto'] }), null);
  assert.strictEqual(passwordStore({ platform: 'linux', env: { XDG_CURRENT_DESKTOP: 'KDE' }, argv: ['oto'] }), null);
  assert.strictEqual(passwordStore({ platform: 'win32', env: {}, argv: ['oto'] }), null);
  assert.strictEqual(passwordStore({ platform: 'linux', env: { XDG_CURRENT_DESKTOP: 'Hyprland' }, argv: ['oto', '--password-store=kwallet6'] }), null);
});
test('Wayland is told apart from X11 and Windows', () => {
  assert.strictEqual(onWayland({ platform: 'linux', env: { WAYLAND_DISPLAY: 'wayland-1', XDG_SESSION_TYPE: 'wayland' } }), true);
  assert.strictEqual(onWayland({ platform: 'linux', env: { XDG_SESSION_TYPE: 'x11', DISPLAY: ':0' } }), false);
  assert.strictEqual(onWayland({ platform: 'win32', env: {} }), false);
});
test('…only when a Secret Service keyring is running or can be started (asked on the session bus)', () => {
  const { secretServiceThere } = require('../main/platform.js');
  const there = (out) => secretServiceThere(() => out, () => true);
  assert.strictEqual(there('array [ string "org.freedesktop.DBus" string "org.freedesktop.secrets" ]'), true);
  assert.strictEqual(there('array [ string "org.freedesktop.DBus" ]'), false);
  assert.strictEqual(secretServiceThere(() => { throw new Error('no bus'); }, () => true), false);
  assert.strictEqual(secretServiceThere(() => 'string "org.freedesktop.secrets"', () => false), false); // no dbus-send
});
