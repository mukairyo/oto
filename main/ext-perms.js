'use strict';
// Oto — what a Chrome Web Store extension is allowed to do, remembered when you approve it (1.7.13).
// electron-chrome-web-store updates extensions by itself and loads the new version straight away, even when the update
// asks for more than you approved (Chrome would switch such an extension off and ask). Oto compares each loaded
// version with what you approved; anything new switches it off until you say yes.
const fs = require('fs');

/** Everything a manifest asks for that matters: API permissions, site access (host permissions and content scripts). */
function permsOf(m) {
  m = m && typeof m === 'object' ? m : {};
  const out = new Set(), list = (v) => (Array.isArray(v) ? v : []);
  for (const p of list(m.permissions)) if (typeof p === 'string') out.add(/[:/*]/.test(p) || p === '<all_urls>' ? `site:${p}` : `api:${p}`);
  for (const h of list(m.host_permissions)) if (typeof h === 'string') out.add(`site:${h}`);
  for (const c of list(m.content_scripts)) for (const h of list(c && c.matches)) if (typeof h === 'string') out.add(`site:${h}`);
  return [...out].sort();
}
/** What `now` asks for that `approved` didn't have. */
const added = (approved, now) => { const a = new Set(approved || []); return (now || []).filter((p) => !a.has(p)); };

function store(file) {
  const read = () => { try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
  return {
    get: (id) => { const v = read()[id]; return Array.isArray(v) ? v : null; },
    set: (id, perms) => { const all = read(); all[id] = perms; const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(all)); fs.renameSync(tmp, file); },
  };
}
module.exports = { permsOf, added, store };
