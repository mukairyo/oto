'use strict';
// Oto — what each sensitive message from Oto's window may contain (Aegis 2.2). Checked by main/ipc-guard.js after
// the sender check and size limit, before the handler runs. A message that doesn't match is refused.
// Also, for every channel: no "__proto__", "constructor" or "prototype" keys anywhere (prototype pollution).
const str = (max) => (v) => typeof v === 'string' && v.length <= max;
const optStr = (max) => (v) => v == null || str(max)(v);
const int = (v) => Number.isSafeInteger(v);
const bool = (v) => typeof v === 'boolean';
const obj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const optObj = (v) => v == null || obj(v);
const id = (v) => str(128)(v) || int(v);
const permVal = (v) => v === null || v === undefined || typeof v === 'boolean' || str(16)(v);
const URL_ = str(8192), EMAIL = str(320), PASS = str(1024);

const SCHEMAS = {
  // passwords
  'pw:save': [URL_, optStr(512), str(4096)],
  'pw:check': [URL_, optStr(512), str(4096)],
  'pw:get': [str(128), optStr(16)],
  'pw:update': [str(128), obj],
  'pw:delete': [str(128)],
  'pw:arm': [int, optObj],
  'pw:fillInto': [int, str(128)],
  'pw:forOrigin': [URL_],
  'pw:export': [], 'pw:import': [], 'pw:list': [], 'pw:status': [],
  // permissions and site data
  'perm:set': [str(9000), permVal],
  'perm:reply': [id, permVal],
  'perm:reset': [optStr(9000)],
  'site:clear': [URL_],
  'data:clear': [],
  // account
  'account:signin': [EMAIL, PASS], 'account:signup': [EMAIL, PASS],
  'account:changePassword': [PASS, PASS], 'account:oldPassword': [PASS],
  'account:resetWithCode': [EMAIL, str(64), PASS], 'account:confirmWithCode': [EMAIL, str(64), optStr(1024)],
  'account:forgot': [EMAIL], 'account:resendConfirm': [optStr(320)],
  'account:push': [optObj, optObj], 'account:pull': [optObj], 'account:deleteCloud': [], 'account:signout': [],
  // owner key
  'owner:unlock': [str(64)], 'owner:proof': [optStr(64)], 'owner:lock': [],
  // extensions, downloads, files
  'ext:remove': [str(64)],
  'dl:open': [str(32768)], 'dl:action': [id, str(16)],
  'shot:open': [optStr(32768)], 'shot:show': [optStr(32768)], 'shot:save': [str(256 * 1024 * 1024)],
  'app:open': [URL_], 'app:install': [URL_, optStr(512), optStr(16 * 1024 * 1024)],
  // backups, clipboard, devices
  'backup:save': [obj, optStr(1024)], 'backup:unlock': [optStr(1024)], 'backup:restore': [optStr(1024)], 'backup:open': [],
  'clipboard:write': [str(8 * 1024 * 1024)],
  'devices:send': [str(128), URL_, optStr(1024)],
  // Oto Shield
  'shield:site': [URL_, bool], 'shield:pick': [URL_, str(4096)], 'shield:dangerAllow': [str(512)],
  'shield:filters': [optStr(4 * 1024 * 1024)], 'shield:level': [optStr(16)],
  // saved state
  'state:save': [obj], 'state:save-sync': [obj],
};

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// true if any object inside has a key that could change prototypes when merged (Object.assign, spread into targets)
function pollutes(args) {
  const stack = [...args], seen = new Set();
  while (stack.length) {
    const v = stack.pop();
    if (!v || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    if (Buffer.isBuffer(v) || ArrayBuffer.isView(v)) continue;
    for (const k of Object.keys(v)) { if (BAD_KEYS.has(k)) return true; stack.push(v[k]); }
    if (Object.prototype.hasOwnProperty.call(v, '__proto__')) return true;
  }
  return false;
}

// '' = fine, otherwise the reason it was refused.
function checkArgs(channel, args) {
  if (pollutes(args)) return 'prototype keys';
  const schema = SCHEMAS[channel];
  if (!schema) return '';
  if (args.length > schema.length && args.slice(schema.length).some((a) => a !== undefined)) return 'too many arguments';
  for (let i = 0; i < schema.length; i++) if (!schema[i](args[i])) return `argument ${i + 1}`;
  return '';
}

module.exports = { checkArgs, pollutes, SCHEMAS };
