'use strict';
// Fingerprint protection, part 2: after Oto restarts, the same site reads different values than before, so a site
// can't recognise you tomorrow by them. Runs after the "fingerprint" suite (a new start of Oto) and compares with it.
const fs = require('fs');
const path = require('path');
const SESSION_FILE = path.join(path.dirname(process.env.OTO_E2E_OUT || path.join(require('os').tmpdir(), 'x')), path.basename(process.env.OTO_E2E_OUT || 'oto-e2e-x-0.json').replace(/^oto-e2e-[a-z0-9]+-/, 'oto-e2e-fpsession-'));
module.exports = async (t) => {
  let before = null;
  try { before = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); fs.unlinkSync(SESSION_FILE); } catch {}
  if (!before) { t.check('new session, different readings: not measured (run the "fingerprint" suite first in the same run)', true); return; }
  await t.open('http://fp.site/', 7000);
  const now = JSON.parse((await t.page('JSON.stringify(window.__res)')) || 'null');
  t.check('the test page produced readings', !!(now && now.page));
  if (!(now && now.page)) return;
  const same = before.noisy.filter((k) => now.page[k] === before.page[k]);
  t.check('after a restart of Oto, the same site reads different canvas, off-screen canvas and audio values', same.length === 0, `still the same as last session: ${same.join(', ') || 'none'}`);
  t.check('…and a different plugin file name', now.page.pluginFile !== before.page.pluginFile && /^[a-p]{32}$/.test(now.page.pluginFile), `${before.page.pluginFile} / ${now.page.pluginFile}`);
  t.check('what should not change did not (plugin names, browser name, languages)', now.page.plugins === before.page.plugins && now.page.agent === before.page.agent && now.page.langs === before.page.langs);
  t.check('…and the worker reads what the page reads in the new session too', !!now.page.worker && now.page.worker.offscreenPixels === now.page.offscreenPixels && now.page.worker.cores === now.page.cores, now.page.worker ? `${now.page.worker.offscreenPixels} / ${now.page.offscreenPixels}` : 'no worker');
};
