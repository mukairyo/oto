'use strict';
// Oto Shield startup: a session is never without the dangerous-site check, even while the full ad-block engine is
// still starting (downloading lists can take a while or fail). Found by the 1.4.0 end-to-end tests.
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const os = require('os');
const path = require('path');
const { install, memFiles } = require('./_mock-electron.js');

function fakeSession() {
  const ses = { handler: null, webRequest: { onBeforeRequest: (filter, fn) => { ses.handler = typeof filter === 'function' ? filter : fn; }, onHeadersReceived() {} } };
  ses.ask = (url, resourceType = 'subFrame') => new Promise((res) => (ses.handler ? ses.handler({ url, resourceType, webContentsId: 0 }, res) : res('no hook')));
  return ses;
}

test('a dangerous site is refused while the full blocker is still starting, and after it takes over', async () => {
  const m = install();
  m.electron.net = { fetch: async () => { throw new Error('offline'); } };
  let release;
  const engineReady = new Promise((r) => { release = r; });
  const enabled = new Set();
  const fakeBlocker = {
    on() {}, onBeforeRequest: (_d, cb) => cb({}), onHeadersReceived: (_d, cb) => cb({}), onInjectCosmeticFilters: async () => {},
    isBlockingEnabled: (s) => enabled.has(s), disableBlockingInSession: (s) => enabled.delete(s), updateFromDiff() {},
    enableBlockingInSession(s) { enabled.add(s); s.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (d, cb) => fakeBlocker.onBeforeRequest(d, cb)); },
  };
  const orig = Module._load;
  Module._load = function (req, ...rest) {
    if (req === '@ghostery/adblocker-electron') return { ElectronBlocker: { fromPrebuiltAdsAndTracking: async () => { await engineReady; return fakeBlocker; } } };
    return orig.call(this, req, ...rest);
  };
  try {
    delete require.cache[require.resolve('../main/shield.js')];
    const files = memFiles({ 'danger-lists.json': { at: Date.now(), malware: ['evil.example'], phishing: [] } });
    const dir = require('fs').mkdtempSync(path.join(os.tmpdir(), 'oto-shield-'));
    const SH = require('../main/shield.js')({ readJSON: files.readJSON, writeJSON: files.writeJSON, userFile: (n) => path.join(dir, n), sendVia() {} });
    const ses = fakeSession();
    const starting = SH.enableBlocking(ses);
    // engine not ready yet
    assert.deepStrictEqual(await ses.ask('http://evil.example/x.js'), { cancel: true }, 'dangerous site refused during startup');
    assert.deepStrictEqual(await ses.ask('http://fine.example/'), {}, 'normal sites load');
    release();
    assert.strictEqual(await starting, 'full');
    assert.deepStrictEqual(await ses.ask('http://evil.example/x.js'), { cancel: true }, 'still refused by the full engine');
    // turning blocking off keeps the dangerous-site check
    SH.disableBlocking(ses);
    assert.deepStrictEqual(await ses.ask('http://evil.example/x.js'), { cancel: true }, 'still refused with blocking off');
    assert.deepStrictEqual(await ses.ask('http://fine.example/'), {});
  } finally { Module._load = orig; m.restore(); }
});
