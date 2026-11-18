'use strict';
// Oto — the "uBlock Origin Lite" mode of Oto Shield (1.7.6).
//
// uBlock Origin Lite (uBOL, by Raymond Hill, GPLv3, https://github.com/uBlockOrigin/uBOL-home) is uBlock Origin made
// into ready-made rules: network rules in Chrome's declarativeNetRequest format, and "scriptlets" (the small page
// fixes that get past sites fighting ad blockers, YouTube's included) bundled as plain scripts. Electron doesn't run
// declarativeNetRequest rules, so Oto runs them itself:
//   - network: every uBOL rule is turned into the same filter syntax Shield's engine reads (toFilters below), so the
//     blocking is uBOL's own rules, matched by Shield's engine;
//   - scriptlets: uBOL's own bundles run in every frame before the page's scripts, exactly as uBOL registers them
//     (main world and isolated world, framework begin + rulesets + end);
//   - element hiding: the same filter lists (Shield's cosmetic filters), because uBOL's are made from them too.
// A copy of uBOL's rules ships with Oto (vendor-ubol/, see scripts/vendor-ubol.js); Oto downloads the newest from
// uBOL's GitHub once a day into its own folder and switches only to a complete, checked set.
const fs = require('fs');
const path = require('path');

// Which uBOL rulesets each protection level uses (uBOL's own defaults are the "balanced" set).
const RULESETS = {
  basic: ['ublock-filters', 'easylist', 'ublock-badware', 'urlhaus-full'],
  balanced: ['ublock-filters', 'easylist', 'easyprivacy', 'pgl', 'ublock-badware', 'urlhaus-full'],
  strict: ['ublock-filters', 'easylist', 'easyprivacy', 'pgl', 'ublock-badware', 'urlhaus-full', 'annoyances-cookies', 'annoyances-overlays', 'annoyances-others', 'annoyances-notifications', 'annoyances-social', 'annoyances-widgets'],
};
const ALL_IDS = [...new Set([...RULESETS.strict, 'ubol-tests'])];
// uBOL's test rules (they only act on localhost and uBOL's own test page) are used by Oto's tests only.
const idsFor = (level) => [...(RULESETS[level] || RULESETS.balanced), ...(process.env.OTO_UBOL_TESTS === '1' ? ['ubol-tests'] : [])];

// The files of one complete set, relative to uBOL's chromium/ folder.
function filesOf(details) {
  const out = ['manifest.json', 'LICENSE.txt', 'rulesets/scriptlet-details.json'];
  for (const id of ALL_IDS) out.push(`rulesets/main/${id}.json`, `rulesets/regex/${id}.json`);
  for (const world of ['main', 'isolated']) {
    out.push(`rulesets/scripting/scriptlet/${world}/scriptlet-begin.js`, `rulesets/scripting/scriptlet/${world}/scriptlet-end.js`);
    for (const id of ALL_IDS) if (hasWorld(details, id, world)) out.push(`rulesets/scripting/scriptlet/${world}/${id}.js`);
  }
  return out;
}
function hasWorld(details, id, world) {
  const d = (details || []).find((x) => Array.isArray(x) && x[0] === id);
  return !!(d && d[1] && d[1][world.toUpperCase()]);
}

// ---- uBOL network rules → Shield's filter syntax
const TYPES = { main_frame: 'document', sub_frame: 'subdocument', stylesheet: 'stylesheet', script: 'script', image: 'image', font: 'font', object: 'object', xmlhttprequest: 'xmlhttprequest', ping: 'ping', csp_report: 'other', media: 'media', websocket: 'websocket', webtransport: 'other', webbundle: 'other', other: 'other' };
function toFilters(rule) {
  const c = (rule && rule.condition) || {}, a = (rule && rule.action) || {};
  const opts = [];
  if (Array.isArray(c.resourceTypes)) opts.push(...new Set(c.resourceTypes.map((t) => TYPES[t] || 'other')));
  if (Array.isArray(c.excludedResourceTypes)) opts.push(...new Set(c.excludedResourceTypes.map((t) => `~${TYPES[t] || 'other'}`)));
  if (c.domainType === 'thirdParty') opts.push('third-party'); else if (c.domainType === 'firstParty') opts.push('first-party');
  const doms = [...(c.initiatorDomains || []), ...(c.excludedInitiatorDomains || []).map((d) => `~${d}`)];
  if (doms.length) opts.push(`domain=${doms.join('|')}`);
  if (Array.isArray(c.excludedRequestDomains) && c.excludedRequestDomains.length) opts.push(`denyallow=${c.excludedRequestDomains.join('|')}`);
  if (Array.isArray(c.requestMethods) && c.requestMethods.length) opts.push(`method=${c.requestMethods.join('|')}`);
  let pre = '';
  if (a.type === 'allow') pre = '@@';
  else if (a.type === 'allowAllRequests') { pre = '@@'; if (!opts.includes('document')) opts.push('document'); }
  else if (a.type === 'redirect') {
    const r = a.redirect || {};
    if (r.extensionPath) opts.push(`redirect=${String(r.extensionPath).split('/').pop()}`);
    else if (r.transform && r.transform.queryTransform && Array.isArray(r.transform.queryTransform.removeParams)) { for (const q of r.transform.queryTransform.removeParams) opts.push(`removeparam=${q}`); }
    else return [];
  } else if (a.type === 'modifyHeaders') {
    const csp = (a.responseHeaders || []).find((h) => /^content-security-policy$/i.test(h.header || '') && h.operation === 'append');
    if (!csp) return [];
    opts.push(`csp=${csp.value}`);
  } else if (a.type !== 'block') return [];
  if (a.type === 'block' && (rule.priority || 1) > 1) opts.push('important'); // uBOL's "important" rules beat exceptions
  const tail = opts.length ? `$${opts.join(',')}` : '';
  const pats = [];
  if (c.regexFilter) pats.push(`/${c.regexFilter}/`);
  else if (c.urlFilter && Array.isArray(c.requestDomains)) { if (!c.urlFilter.startsWith('||')) for (const d of c.requestDomains) pats.push(`||${d}^*${c.urlFilter.replace(/^\|/, '')}`); }
  else if (c.urlFilter) pats.push(c.urlFilter);
  else if (Array.isArray(c.requestDomains)) for (const d of c.requestDomains) pats.push(`||${d}^`);
  else pats.push('*');
  return pats.map((p) => `${pre}${p}${tail}`);
}

// A file in a set must look like uBOL's: JSON rules that parse, scripts that start with uBOL's notice and are
// framework pieces (nothing else is ever run in pages).
function looksRight(rel, buf) {
  if (!buf || !buf.length || buf.length > 24 * 1024 * 1024) return false;
  const s = buf.toString('utf8');
  if (rel.endsWith('.json')) { try { const v = JSON.parse(s); return rel.startsWith('rulesets/main/') || rel.startsWith('rulesets/regex/') ? Array.isArray(v) : !!v; } catch { return false; } }
  if (rel.endsWith('.js')) return s.includes('uBlock Origin Lite') && /\(function uBOL_(scriptlets|scriptletFrameworkBegin|scriptletFrameworkEnd)\(/.test(s);
  return rel.endsWith('LICENSE.txt') ? s.includes('GNU GENERAL PUBLIC LICENSE') : false;
}

module.exports = function createUbol({ appDir, userFile }) {
  const BUNDLED = path.join(appDir, 'vendor-ubol');
  const LIVE = () => userFile('ubol');
  const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
  const versionOf = (dir) => { const m = readJ(path.join(dir, 'manifest.json'), null); return m && typeof m.version === 'string' ? m.version : ''; };
  // (1.7.12) uBOL's rules come only with Oto: the copy in Oto's own files, which every Oto release proves it built
  // (docs/UPDATE_TRUST.md). Oto used to download newer rules from uBOL's GitHub every day and run their scriptlets in
  // pages without any proof they were uBOL's; that's gone, and any rules downloaded before are deleted.
  let cleaned = false;
  function current() {
    if (!cleaned) { cleaned = true; try { fs.rmSync(LIVE(), { recursive: true, force: true }); } catch {} }
    return { dir: BUNDLED, version: versionOf(BUNDLED), at: 0, bundled: true };
  }
  const read = (dir, rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { return ''; } };

  /** uBOL's network rules for a protection level, as filter lines for Shield's engine. */
  function networkLines(level) {
    const { dir } = current(), lines = [];
    for (const id of idsFor(level)) for (const sub of ['main', 'regex']) {
      let rules = [];
      try { rules = JSON.parse(read(dir, `rulesets/${sub}/${id}.json`) || '[]'); } catch {}
      for (const r of rules) { try { lines.push(...toFilters(r)); } catch {} }
    }
    return lines;
  }

  /** The scriptlets of a level as one script per world: uBOL's framework begin, the rulesets, and its end. */
  function scriptlets(level) {
    const { dir } = current();
    let details = [];
    try { details = JSON.parse(read(dir, 'rulesets/scriptlet-details.json') || '[]'); } catch {}
    const out = {};
    for (const world of ['main', 'isolated']) {
      const parts = idsFor(level).filter((id) => hasWorld(details, id, world)).map((id) => read(dir, `rulesets/scripting/scriptlet/${world}/${id}.js`)).filter(Boolean);
      out[world] = parts.length ? [read(dir, `rulesets/scripting/scriptlet/${world}/scriptlet-begin.js`), ...parts, read(dir, `rulesets/scripting/scriptlet/${world}/scriptlet-end.js`)].join('\n;\n') : '';
    }
    return out;
  }

  /**
   * The preload that runs uBOL's scriptlets in every frame, before the page's own scripts: written once per uBOL
   * version and level into Oto's folder. It asks Oto (oto:page, flags only) whether this frame gets them: not with
   * Shield off, not on a site where you turned Shield off, not in the other mode.
   */
  function preloadFile(level) {
    const { version } = current();
    if (!/^\d{4}\.\d{1,4}\.\d{1,4}$/.test(version) || !RULESETS[level]) throw new Error('uBOL: unexpected version or level');
    const tests = process.env.OTO_UBOL_TESTS === '1' ? '-t' : '';
    const file = userFile(`ubol-preload-${version}-${level}${tests}.js`);
    // (made from Oto's own copy of uBOL every time and compared with the file: a file that was changed, or isn't a
    // plain file, is replaced, never run as it is)
    {
      const s = scriptlets(level);
      const body = [
        "'use strict';",
        '// Oto — uBlock Origin Lite\'s scriptlets (GPLv3, https://github.com/uBlockOrigin/uBOL-home), made by main/ubol.js.',
        `// uBOL ${version}, ${level} rules. The two functions below are uBOL's own files, unchanged.`,
        'try {',
        "  const { ipcRenderer, contextBridge, webFrame } = require('electron');",
        "  const site = ipcRenderer.sendSync('oto:page', location.origin) || {};",
        '  if (site.ubol) {',
        s.main ? `    const uBOLMain = function () {\n${s.main}\n};\n    if (contextBridge && contextBridge.executeInMainWorld) contextBridge.executeInMainWorld({ func: uBOLMain }); else if (webFrame) webFrame.executeJavaScript(\`(\${uBOLMain.toString()})()\`);` : '',
        s.isolated ? `    (function uBOLIsolated() {\n${s.isolated}\n})();` : '',
        '  }',
        '} catch (e) {}',
        '',
      ].join('\n');
      try { for (const f of fs.readdirSync(path.dirname(file))) if (/^ubol-preload-.*\.js$/.test(f) && f !== path.basename(file)) { try { fs.rmSync(path.join(path.dirname(file), f), { force: true }); } catch {} } } catch {}
      let same = false;
      try { const st = fs.lstatSync(file); same = st.isFile() && fs.readFileSync(file, 'utf8') === body; } catch {}
      if (!same) {
        try { fs.rmSync(file, { force: true, recursive: true }); } catch {} // (a link or folder in its place goes, not what it points at)
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, body, { flag: 'wx' });
        fs.renameSync(tmp, file);
      }
    }
    return file;
  }

  /** (Before 1.7.12 this downloaded uBOL's newest rules. They come with Oto updates now; kept so callers still work.) */
  function update() { return Promise.resolve(false); }

  return { current, networkLines, scriptlets, preloadFile, update, RULESETS };
};
module.exports.toFilters = toFilters;
module.exports.looksRight = looksRight;
module.exports.filesOf = filesOf;
module.exports.RULESETS = RULESETS;
