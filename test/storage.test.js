'use strict';
// Saves that matter must never fail silently (1.3.3, follow-up to the account.json finding).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = ['main.js', 'account.js', ...fs.readdirSync(path.join(ROOT, 'main')).map((f) => `main/${f}`)];
const IMPORTANT = /writeJSON\(\s*'(state|permissions|shield|shield-allow|account|passwords|exit-clear)\.json'/;

test('important files are never written with errors silently ignored', () => {
  for (const f of files) {
    fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
      if (IMPORTANT.test(line) && /catch\s*\{\s*\}/.test(line) && !/exit-clear/.test(line)) assert.fail(`${f}:${i + 1} ignores a failed save: ${line.trim().slice(0, 120)}`);
    });
  }
});

test('saveOrWarn tells the window once when a save fails, and recovers', () => {
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const src = main.slice(main.indexOf('const saveWarned'), main.indexOf('\n}\n', main.indexOf('function saveOrWarn')) + 3);
  const sent = [];
  let fail = true;
  const saveOrWarn = new Function('writeJSON', 'send', `${src}; return saveOrWarn;`)( // eslint-disable-line no-new-func
    () => { if (fail) { const e = new Error('ENOSPC'); e.code = 'ENOSPC'; throw e; } }, (ch, d) => sent.push([ch, d]));
  const warn = console.warn; console.warn = () => {};
  try {
    assert.strictEqual(saveOrWarn('state.json', {}, 'your tabs'), false);
    assert.strictEqual(saveOrWarn('state.json', {}, 'your tabs'), false);
    assert.deepStrictEqual(sent, [['save-failed', { what: 'your tabs', code: 'ENOSPC' }]], 'told once, not on every save');
    fail = false;
    assert.strictEqual(saveOrWarn('state.json', {}, 'your tabs'), true);
  } finally { console.warn = warn; }
});

test('starting Oto can’t crash on a full disk (clear-on-close marker)', () => {
  const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  const setup = main.slice(main.indexOf('function setupSession('), main.indexOf('// ---------------------------------------------------------------- IPC'));
  assert.doesNotMatch(setup, /^\s*writeJSON\('exit-clear\.json'/m, 'unguarded write at startup');
});
