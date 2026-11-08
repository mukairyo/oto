'use strict';
// Passwords: encrypted at rest (DPAPI on Windows), http not offered, and a failed disk write never reports success.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
module.exports = async (t) => {
  const file = path.join(app.getPath('userData'), 'passwords.json');
  if (process.platform === 'win32') t.check('Windows encryption (DPAPI) is available', safeStorage.isEncryptionAvailable());
  const loc = `http://localhost:${t.ports.http}/`;
  t.check('saving on http://localhost works (developers)', (await t.js(`oto.pwSave(${JSON.stringify(loc)}, 'me@example.com', 'E2e-secret-123')`)) === 'saved');
  t.check('saving on plain http is refused', (await t.js("oto.pwSave('http://login.site/', 'me', 'x')")) === 'invalid');
  const disk = fs.readFileSync(file, 'utf8');
  t.check('the password is not readable in the file', !disk.includes('E2e-secret-123') && !disk.includes(Buffer.from('E2e-secret-123').toString('base64')));
  t.check('the list shows the login', (await t.js('oto.pwList().then((l) => l.map((x) => x.username).join(","))')).includes('me@example.com'));
  // make the next write fail for real: the file's place on disk is taken by a folder
  fs.renameSync(file, `${file}.moved`); fs.mkdirSync(file);
  const r = await t.js(`oto.pwSave(${JSON.stringify(loc)}, 'second@example.com', 'E2e-other-456')`);
  t.check('a failed disk write never reports “saved”', r === 'diskerror', r);
  t.check('…and nothing changed in memory', !(await t.js('oto.pwList().then((l) => l.map((x) => x.username).join(","))')).includes('second@example.com'));
  fs.rmdirSync(file); fs.renameSync(`${file}.moved`, file);
};
