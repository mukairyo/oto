'use strict';
// Fingerprint protection, measured: what a script can read from canvas, WebGL and audio is the same every time on one
// site (so pages work normally), different on another site, and different again after Oto restarts (so the readings
// can't be used to follow you from site to site or from day to day). The same holds inside a frame that a third site
// embeds, which is where trackers usually run, and inside the page's background workers. CPU cores and languages
// get common answers that say the same thing everywhere (page, frames, workers, request headers).
const fs = require('fs');
const path = require('path');
const { webContents } = require('electron');
const SESSION_FILE = path.join(path.dirname(process.env.OTO_E2E_OUT || path.join(require('os').tmpdir(), 'x')), path.basename(process.env.OTO_E2E_OUT || 'oto-e2e-x-0.json').replace(/^oto-e2e-[a-z0-9]+-/, 'oto-e2e-fpsession-'));
module.exports = async (t) => {
  const read = async (url) => { await t.open(url, 7000); return JSON.parse((await t.page('JSON.stringify(window.__res)')) || 'null'); };
  const a1 = await read('http://fp.site/'), b = await read('http://fp2.site/'), a2 = await read('http://fp.site/');
  t.check('the test page produced readings', !!(a1 && a1.page && b && b.page && a2 && a2.page), JSON.stringify(a1).slice(0, 300));
  if (!(a1 && a1.page && b && b.page && a2 && a2.page)) return;
  const noisy = ['canvasUrl', 'canvasPixels', 'canvasBlob', 'offscreenPixels', 'offscreenBlob', 'audioData', 'audioCopy', ...(a1.page.webglPixels ? ['webglPixels', 'webglUrl'] : [])];
  const show = (o) => noisy.map((k) => `${k}=${o[k]}`).join(' ');
  t.check('one site, read twice in a row: the same', a1.page.canvasUrl === a1.page.canvasUrlAgain, `${a1.page.canvasUrl} / ${a1.page.canvasUrlAgain}`);
  t.check('one site, visited again: every reading is the same', noisy.every((k) => a1.page[k] === a2.page[k]), `${show(a1.page)} | ${show(a2.page)}`);
  t.check('audio: both ways of reading the sound give the same answer', a1.page.audioData === a1.page.audioCopy, `${a1.page.audioData} / ${a1.page.audioCopy}`);
  const same = noisy.filter((k) => a1.page[k] === b.page[k]);
  t.check('another site: every canvas, off-screen canvas and audio reading is different', same.length === 0, `still the same on both sites: ${same.join(', ') || 'none'} | ${show(a1.page)} | ${show(b.page)}`);
  t.check(a1.page.webglPixels ? 'WebGL readings are covered too' : 'WebGL readings: not measured (no WebGL on this test machine)', true, a1.page.webgl || '');
  // inside a frame from a third site (the same frame on both sites): protected, and tied to the site you are on
  const f1 = a1.frame, f2 = b.frame;
  t.check('a frame from another site gets readings too (control)', !!(f1 && f2), JSON.stringify(f1).slice(0, 200));
  if (f1 && f2) {
    const fsame = noisy.filter((k) => f1[k] === f2[k]);
    t.check('the same embedded frame reads different values on two sites (it can\'t link them)', fsame.length === 0, `still the same: ${fsame.join(', ') || 'none'} | ${show(f1)} | ${show(f2)}`);
    t.check('…and the frame sees what the page around it sees (one consistent answer per site)', noisy.every((k) => f1[k] === a1.page[k]), `${show(f1)} | ${show(a1.page)}`);
    t.check('no Node.js or Electron inside a frame', f1.node === 'undefined/undefined/undefined/undefined/undefined', f1.node);
    // Chromium keeps a frame's storage apart per site that embeds it; Oto relies on that instead of rules of its own
    t.check('storage of an embedded frame is not shared between the two sites that embed it (Chromium\'s partitioning is on)', f1.sawStorage === 'empty' && f2.sawStorage === 'empty', `${f1.sawStorage} / ${f2.sawStorage}`);
  }
  t.check('no Node.js or Electron in the page', a1.page.node === 'undefined/undefined/undefined/undefined/undefined', a1.page.node);
  t.check('replaced functions look like the browser\'s own (name, arguments, source)', a1.page.looks === 'toDataURL/0/true/get contentWindow/true', a1.page.looks);
  // Background workers (scripts without a page): the same protection as the page they belong to (main/worker-guard.js)
  const workersOf = (r) => [['worker', r.page.worker], ['worker started by a worker', r.page.worker && r.page.worker.nested], ['worker made from a blob:', r.page.blobWorker], ['worker of the embedded frame', r.frame && r.frame.worker], ['worker started by that one', r.frame && r.frame.worker && r.frame.worker.nested]];
  const wk = ['offscreenPixels', 'offscreenBlob', ...(a1.page.webglPixels ? ['webglPixels'] : []), 'cores', 'langs'];
  const wshow = (o) => (o ? wk.map((k) => `${k}=${o[k]}`).join(' ') : 'no readings');
  const pageW = (r) => ({ ...r.page, offscreenBlob: (r.page.worker || {}).offscreenBlob }); // the page can't make the worker's blob the same way, compare it between workers
  const off = workersOf(a1).filter(([, o]) => !o || wk.some((k) => k !== 'offscreenBlob' && o[k] !== a1.page[k]) || o.offscreenBlob !== a1.page.worker.offscreenBlob);
  t.check('workers read exactly what their page reads (off-screen canvas, WebGL, CPU cores, languages): a page never sees two answers', off.length === 0, off.length ? off.map(([n, o]) => `${n}: ${wshow(o)}`).join(' | ') + ` | page: ${wshow(pageW(a1))}` : wshow(a1.page.worker));
  const wsame = wk.filter((k) => !['cores', 'langs'].includes(k) && a1.page.worker && b.page.worker && a1.page.worker[k] === b.page.worker[k]);
  t.check('…and a worker on another site reads different canvas values (workers can\'t link two sites either)', !!(a1.page.worker && b.page.worker) && wsame.length === 0, `still the same: ${wsame.join(', ') || 'none'} | ${wshow(a1.page.worker)} | ${wshow(b.page.worker)}`);
  t.check('…the changed parts look built in inside workers too, and workers have no Node.js', !!a1.page.worker && a1.page.worker.looks === 'getImageData/4/true/get hardwareConcurrency/true' && a1.page.worker.node === 'undefined/undefined/undefined/undefined', a1.page.worker ? `${a1.page.worker.looks} ${a1.page.worker.node}` : 'no worker');
  // CPU cores: a common number per site (4 or 8, never more than this PC has); page, frame and workers agree
  const real = require('os').cpus().length, coreOk = (n) => (real < 4 ? n === real : real < 8 ? n === 4 : n === 4 || n === 8);
  t.check(`CPU cores: a common number (this PC has ${real}: ${real < 4 ? 'it keeps its own' : real < 8 ? 'every site gets 4' : 'each site gets 4 or 8'}), the same in the page, its frame and its workers`, coreOk(a1.page.cores) && coreOk(b.page.cores) && a1.page.cores === a1.page.workerCores && a1.page.cores === a2.page.cores && (!f1 || f1.cores === a1.page.cores), `${a1.page.cores} / worker ${a1.page.workerCores} / again ${a2.page.cores} / frame ${f1 && f1.cores} / other site ${b.page.cores}`);
  // Languages: only the main one, everywhere, matching what the request headers send
  t.check('languages: only the main one, the same in the page, its frame, its workers and the request headers', !a1.page.langs.includes(',') && a1.page.langs === a1.page.langHeader.split(',')[0].split(';')[0] && a1.page.langsSameObject === true && (!f1 || f1.langs === a1.page.langs), `page ${a1.page.langs} / header ${a1.page.langHeader} / frame ${f1 && f1.langs} / same list object ${a1.page.langsSameObject}`);
  // Service workers get it through their own preload; shared workers are the one kind Oto can't reach yet
  // Worker protection shares Chromium's debugging connection with full-page screenshots, freezing background tabs and
  // DevTools: all of them keep working, and workers stay protected afterwards
  await t.open('http://fp.site/', 7000);
  const tabWc = await t.js('V.get(activeTab().id).wcId'), tabC = webContents.fromId(tabWc);
  const shot = await t.js(`oto.shotFull(${tabWc}).then((d) => d.length)`);
  const froze = await t.js(`oto.freezeTab(${tabWc}, true)`), thawed = await t.js(`oto.freezeTab(${tabWc}, false)`);
  tabC.openDevTools({ mode: 'detach' }); await t.sleep(1500);
  await t.page('location.reload()'); await t.sleep(7000);
  const after = JSON.parse((await t.page('JSON.stringify(window.__res)')) || 'null');
  try { tabC.closeDevTools(); } catch {}
  t.check('full-page screenshot, freezing a tab and DevTools still work, and workers stay protected after them', shot > 1000 && froze === true && thawed === true && tabC.debugger.isAttached() && !!(after && after.page.worker) && after.page.worker.offscreenPixels === a1.page.offscreenPixels, `screenshot ${shot} chars, freeze ${froze}/${thawed}, connected ${tabC.debugger.isAttached()}, worker ${after && after.page.worker && after.page.worker.offscreenPixels} / page ${a1.page.offscreenPixels}`);
  // (service workers only exist on secure pages: localhost counts as one)
  await t.open(`http://localhost:${t.ports.http}/fpworkers.html`, 9000);
  const sw = JSON.parse((await t.page('JSON.stringify(window.__res)')) || 'null');
  t.check('a service worker reads what its site\'s pages read', !!(sw && sw.service && sw.service.offscreenPixels) && sw.service.offscreenPixels === sw.offscreenPixels && sw.service.offscreenPixels !== a1.page.offscreenPixels && sw.service.cores === sw.cores, sw ? `service ${wshow(sw.service)} | its page ${sw.offscreenPixels} ${sw.cores} | another site ${a1.page.offscreenPixels}` : 'no readings');
  t.check(`shared workers: ${sw && sw.shared && sw.shared.offscreenPixels !== sw.offscreenPixels ? 'still read real values (known limit, see docs/PRIVACY_PROTECTION.md)' : 'protected too'}`, true, sw && sw.shared ? wshow(sw.shared) : 'no shared worker');
  t.check('the plugin list is the standard Chrome one (same five names, same order)', a1.page.plugins === 'PDF Viewer|Chrome PDF Viewer|Chromium PDF Viewer|Microsoft Edge PDF Viewer|WebKit built-in PDF', a1.page.plugins);
  // the plugins' internal file name: per site and session, one answer however a script reaches a plugin
  t.check('plugin file name: differs between two sites, the same again on a second visit, 32 letters a to p', /^[a-p]{32}$/.test(a1.page.pluginFile) && a1.page.pluginFile !== b.page.pluginFile && a1.page.pluginFile === a2.page.pluginFile, `${a1.page.pluginFile} / ${b.page.pluginFile} / ${a2.page.pluginFile}`);
  t.check('…every way of reaching a plugin gives that one answer, and the frame agrees with its page', a1.page.pluginFiles === a1.page.pluginFile && (!f1 || f1.pluginFile === a1.page.pluginFile), `${a1.page.pluginFiles}${f1 ? ' / frame ' + f1.pluginFile : ''}`);
  t.check('…plugins stay the browser\'s own objects and the changed part looks built in', a1.page.pluginLooks === 'get filename/0/true/true/true/5/TypeError', a1.page.pluginLooks);
  // What EFF's Cover Your Tracks compares between two sites: canvas, WebGL, audio, plugin details, CPU cores.
  // It says "randomized fingerprint" when at least 4 of the 5 differ. (CPU cores stay real, see the check above.)
  const eff = [['canvas', a1.page.canvasUrl !== b.page.canvasUrl], ['WebGL', !!a1.page.webglUrl && a1.page.webglUrl !== b.page.webglUrl], ['audio', a1.page.audioData !== b.page.audioData], ['plugin details', a1.page.pluginDetails !== b.page.pluginDetails], ['CPU cores', a1.page.cores !== b.page.cores]];
  const effDiffer = eff.filter((x) => x[1]).map((x) => x[0]);
  t.check(a1.page.webglUrl ? 'of the 5 things Cover Your Tracks compares between sites, at least 4 differ' : 'of the 5 things Cover Your Tracks compares, 3 differ here (this test machine has no WebGL; with WebGL it is 4)', effDiffer.length >= (a1.page.webglUrl ? 4 : 3), `differ: ${effDiffer.join(', ')}`);
  t.check('the browser name sent to sites has no Oto or Electron in it', !/oto|electron/i.test(a1.page.agent), a1.page.agent);
  // battery, on a secure page: the answer of a desktop PC on mains power, from a real BatteryManager
  const sec = await read(`http://localhost:${t.ports.http}/fp`);
  t.check('battery: every site gets "plugged in, full" (a desktop PC\'s answer)', !!sec && sec.page.battery === 'true/1/0/Infinity' && sec.page.batteryIs === true, sec ? `${sec.page.battery} ${sec.page.batteryIs}` : 'no readings');
  // for the next start of Oto: these readings must have changed by then (the "fingerprint2" suite runs after this one)
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ page: a1.page, noisy }));

  // Calls (WebRTC): what a page may learn about your network follows the level and the per-site switch
  const policy = async (url) => { await t.open(url, 2500); const id = await t.js('V.get(activeTab().id).wcId'); return webContents.fromId(id).getWebRTCIPHandlingPolicy(); };
  t.check('WebRTC, Standard: only the connection your traffic uses', (await policy('http://fp.site/')) === 'default_public_and_private_interfaces');
  const strict = JSON.parse(await t.js("oto.shield.level('strict').then((r) => JSON.stringify(r))"));
  t.check('Strict level: cookie-banner lists, recorders, fingerprint protection, WebRTC public address only', strict.protection === 'strict' && strict.level === 'strict' && strict.features.recorders && strict.features.fp && strict.features.webrtc === 'public', JSON.stringify(strict));
  t.check('WebRTC, Strict: applied to open pages at once', (await t.js('V.get(activeTab().id).wcId').then((id) => webContents.fromId(id).getWebRTCIPHandlingPolicy())) === 'default_public_interface_only');
  // Strict also refuses the keyboard layout and lists only read-aloud voices in your main language
  const st = await read(`http://localhost:${t.ports.http}/fp`); // the keyboard API only exists on secure pages
  t.check('Strict: the keyboard layout is refused (Standard leaves it alone)', !!st && !!sec && st.page.keyboard === 'SecurityError' && sec.page.keyboard !== 'SecurityError', `Strict: ${st && st.page.keyboard} / Standard: ${sec && sec.page.keyboard}`);
  const main = (st && st.page.langs || '').split('-')[0];
  t.check('Strict: read-aloud voices only in your main language', !!st && (st.page.voices === '' || st.page.voices.split(',').every((l) => l.split(/[-_]/)[0] === main) || st.page.voices.split(',').length === 1), `Strict: ${st && (st.page.voices || 'none on this test machine')} / Standard: ${a1.page.voices || 'none on this test machine'}`);
  // Custom: one switch at a time
  const noFp = JSON.parse(await t.js("oto.shield.feature('fp', false).then((r) => JSON.stringify(r))"));
  t.check('switching one protection off makes the level Custom and keeps the rest', noFp.protection === 'custom' && noFp.features.fp === false && noFp.features.recorders === true && noFp.features.annoyances === true && noFp.features.webrtc === 'public', JSON.stringify(noFp));
  const rawA = await read('http://fp.site/'), rawB = await read('http://fp2.site/');
  t.check('with fingerprint protection off, two sites read the same (real) values: the difference came from Oto', noisy.every((k) => rawA.page[k] === rawB.page[k]) && rawA.page.canvasUrl !== a1.page.canvasUrl, `${show(rawA.page)} | ${show(rawB.page)}`);
  t.check('…and the plugin file name is Chrome\'s own again', rawA.page.pluginFile === 'internal-pdf-viewer' && rawA.page.pluginFiles === 'internal-pdf-viewer' && rawA.page.pluginDetails === rawB.page.pluginDetails, rawA.page.pluginFiles);
  t.check('…and workers read the real values too (the same on both sites, the same as the page)', !!(rawA.page.worker && rawB.page.worker) && ['offscreenPixels', 'cores'].every((k) => rawA.page.worker[k] === rawB.page.worker[k] && rawA.page.worker[k] === rawA.page[k]) && rawA.page.worker.cores === real, `${wshow(rawA.page.worker)} | ${wshow(rawB.page.worker)} | page ${rawA.page.offscreenPixels} ${rawA.page.cores}`);
  t.check('…the file name is the only plugin detail Oto changes', a1.page.pluginDetails.split(a1.page.pluginFile).join('internal-pdf-viewer') === rawA.page.pluginDetails, a1.page.pluginDetails.slice(0, 160));
  const std = JSON.parse(await t.js("oto.shield.level('standard').then((r) => JSON.stringify(r))"));
  t.check('"Restore defaults" is Standard with everything back on', std.protection === 'standard' && std.features.fp && std.features.trackers && std.features.recorders && !std.features.annoyances && std.features.webrtc === 'route', JSON.stringify(std));
  // per-site exception: Shield off for a site also switches the changes off there (real readings, for a site that needs them)
  await t.js("oto.shield.site('http://fp.site/', true)"); await t.sleep(400);
  const exc = await read('http://fp.site/');
  t.check('Shield off for one site: that site reads the real values', noisy.every((k) => exc.page[k] === rawA.page[k]), `${show(exc.page)} | ${show(rawA.page)}`);
  t.check('…and its calls get Chromium\'s default; other sites keep their protection', webContents.fromId(await t.js('V.get(activeTab().id).wcId')).getWebRTCIPHandlingPolicy() === 'default' && (await policy('http://fp2.site/')) === 'default_public_and_private_interfaces');
  const other = await read('http://fp2.site/');
  t.check('…while another site still gets changed readings', noisy.every((k) => other.page[k] === b.page[k]) && other.page.canvasUrl !== rawB.page.canvasUrl, `${show(other.page)} | ${show(b.page)}`);
};
