'use strict';
// Saved passwords and the owner key are only locked with a real lock (main/keyring.js, 1.9.4).
const test = require('node:test');
const assert = require('node:assert');
const { strongLock } = require('../main/keyring.js');
const ss = (available, backend) => ({ isEncryptionAvailable: () => available, getSelectedStorageBackend: () => backend });

test('installed Oto on Linux refuses the no-keyring fallback (same key on every computer)', () => {
  assert.strictEqual(strongLock(ss(true, 'basic_text'), { platform: 'linux', packaged: true }), false);
  assert.strictEqual(strongLock(ss(true, 'unknown'), { platform: 'linux', packaged: true }), false);
  assert.strictEqual(strongLock({ isEncryptionAvailable: () => true }, { platform: 'linux', packaged: true }), false, 'no way to tell = no');
});
test('…and uses a real keyring', () => {
  for (const b of ['gnome_libsecret', 'kwallet5', 'kwallet6']) assert.strictEqual(strongLock(ss(true, b), { platform: 'linux', packaged: true }), true, b);
});
test('Windows (DPAPI) is a real lock; no encryption at all never is', () => {
  assert.strictEqual(strongLock(ss(true, 'unknown'), { platform: 'win32', packaged: true }), true);
  assert.strictEqual(strongLock(ss(false, 'gnome_libsecret'), { platform: 'linux', packaged: true }), false);
  assert.strictEqual(strongLock(null), false);
  assert.strictEqual(strongLock({ isEncryptionAvailable: () => { throw new Error('x'); } }), false);
});
test('running from source (development, tests) may use the fallback', () => {
  assert.strictEqual(strongLock(ss(true, 'basic_text'), { platform: 'linux', packaged: false }), true);
});
