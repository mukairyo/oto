'use strict';
// Oto — is safeStorage's lock a real one? (1.9.4)
// On Windows it's DPAPI and on macOS the Keychain. On Linux it's the desktop's keyring (GNOME Keyring / libsecret,
// KWallet) — but with no keyring running, Electron falls back to "basic_text": a fixed key that's the same on every
// computer, so anything "locked" with it can be read by any program. An installed Oto treats that as no lock at all.
// (Running from source for development and the tests, the fallback is allowed so those can run without a keyring.)
function strongLock(safeStorage, { platform = process.platform, packaged = true } = {}) {
  try {
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) return false;
    if (platform === 'linux' && packaged) {
      const backend = typeof safeStorage.getSelectedStorageBackend === 'function' ? String(safeStorage.getSelectedStorageBackend()) : 'unknown';
      if (/^(basic_text|unknown)$/.test(backend)) return false;
    }
    return true;
  } catch { return false; }
}
module.exports = { strongLock };
