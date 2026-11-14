'use strict';
// Oto for Android: starts the YouTube ambient light (yt-ambient.js) with settings made for phones: a lighter glow
// (fewer, bigger rings, 128 points across, at most 15 updates a second) so it's easy on the battery. No player button,
// G key or window glow here (those talk to Oto for Windows).
(function () {
  const go = () => { try { otoYtAmbient({ on: true, res: 'low', fps: 15, step: 20, spread: 100, blur: 30, strength: 85, button: false, key: false, frame: false, header: false, immersive: false }); } catch (e) {} };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
})();
