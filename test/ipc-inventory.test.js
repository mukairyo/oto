'use strict';
// Every IPC channel Oto registers is listed in docs/IPC_INVENTORY.md, answers only Oto's window unless it is one of the
// reviewed exceptions, and every sensitive channel has its arguments written down (1.7.13).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../scripts/ipc-inventory.js');
const rows = I.describe(I.scan());

test('docs/IPC_INVENTORY.md is up to date (run node scripts/ipc-inventory.js)', () => {
  assert.strictEqual(fs.readFileSync(path.join(__dirname, '..', 'docs', 'IPC_INVENTORY.md'), 'utf8'), I.markdown(rows));
});

test('only the reviewed channels skip the "Oto\'s window only" rule', () => {
  const open = rows.filter((r) => !r.sender.startsWith("Oto's window")).map((r) => r.channel).sort();
  assert.deepStrictEqual(open, ['oto:page', 'oto:worker', 'oto:yt-wall'], 'a new open channel needs a review in docs/SECURITY_REVIEW_1.7.13.md');
});

test('every sensitive channel has an argument schema', () => {
  const SENSITIVE = /^(pw|account|backup|owner|update|ext|dl|site|perm|state|app|data|devices|shield|shot|clipboard|tab|vpn):/;
  const missing = rows.filter((r) => SENSITIVE.test(r.channel) && r.schema !== 'yes').map((r) => r.channel);
  assert.deepStrictEqual(missing, []);
});

test('the scan finds Oto\'s channels (not an empty list by mistake)', () => {
  assert.ok(rows.length > 100);
  for (const ch of ['pw:get', 'pw:export', 'account:push', 'update:install', 'oto:page']) assert.ok(rows.some((r) => r.channel === ch), ch);
});
