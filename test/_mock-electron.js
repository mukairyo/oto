'use strict';
// Test helper: a tiny stand-in for the parts of Electron Oto's main-process modules use, so they can be tested
// with plain Node (no window, no Chromium). Encryption is faked with a reversible marker — only for tests.
const Module = require('module');

function fakeIpcMain() {
  const handlers = new Map(), listeners = new Map();
  return {
    handlers, listeners,
    handle(ch, fn) { handlers.set(ch, fn); }, handleOnce(ch, fn) { handlers.set(ch, fn); }, removeHandler(ch) { handlers.delete(ch); },
    on(ch, fn) { listeners.set(ch, fn); }, once(ch, fn) { listeners.set(ch, fn); },
    invoke(ch, e, ...a) { return handlers.get(ch)(e, ...a); },
    emit(ch, e, ...a) { return listeners.get(ch)(e, ...a); },
  };
}

function install({ canEncrypt = true } = {}) {
  const state = { canEncrypt, dialogs: [], dialogAnswer: 1 };
  const electron = {
    ipcMain: fakeIpcMain(),
    app: { getPath: () => require('os').tmpdir() },
    safeStorage: {
      isEncryptionAvailable: () => state.canEncrypt,
      encryptString: (s) => Buffer.from(`ENC:${s}`),
      decryptString: (b) => { const t = b.toString(); if (!t.startsWith('ENC:')) throw new Error('bad'); return t.slice(4); },
    },
    dialog: {
      showMessageBox: async (_w, o) => { state.dialogs.push(o); return { response: state.dialogAnswer }; },
      showSaveDialog: async () => ({ canceled: true }), showOpenDialog: async () => ({ canceled: true }),
    },
    webContents: { fromId: () => null },
    nativeImage: {}, session: {},
  };
  const orig = Module._load;
  Module._load = function (req, ...rest) { return req === 'electron' ? electron : orig.call(this, req, ...rest); };
  return { electron, state, restore: () => { Module._load = orig; } };
}

// In-memory JSON files for ctx.readJSON / ctx.writeJSON
function memFiles(init = {}) {
  const files = JSON.parse(JSON.stringify(init));
  const api = {
    files,
    readJSON: (n, d) => (n in files ? JSON.parse(JSON.stringify(files[n])) : d),
    writeJSON: (n, v) => { if (api.failWrites) { const e = new Error('ENOSPC: no space left on device'); e.code = 'ENOSPC'; throw e; } files[n] = JSON.parse(JSON.stringify(v)); },
  };
  return api;
}

module.exports = { install, memFiles, fakeIpcMain };
