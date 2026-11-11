'use strict';
// Fingerprint protection, measured: what a script can read from canvas, WebGL and audio is the same every time on one
// site (so pages work normally), different on another site, and different again after Oto restarts (so the readings
// can't be used to follow you from site to site or from day to day). The same holds inside a frame that a third site
// embeds, which is where trackers usually run. Hardware answers are left real and say the same thing everywhere.
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
  }
  t.check('no Node.js or Electron in the page', a1.page.node === 'undefined/undefined/undefined/undefined/undefined', a1.page.node);
  t.check('replaced functions look like the browser\'s own (name, arguments, source)', a1.page.looks === 'toDataURL/0/true/get contentWindow/true', a1.page.looks);
  // hardware answers are real and consistent: a page and its background worker never disagree
  t.check('CPU cores: the page and its worker give the same answer', a1.page.cores === a1.page.workerCores && b.page.cores === a1.page.cores, `${a1.page.cores} / ${a1.page.workerCores}`);
  t.check('the plugin list is the standard Chrome one', a1.page.plugins === 'PDF Viewer|Chrome PDF Viewer|Chromium PDF Viewer|Microsoft Edge PDF Viewer|WebKit built-in PDF', a1.page.plugins);
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
  // Custom: one switch at a time
  const noFp = JSON.parse(await t.js("oto.shield.feature('fp', false).then((r) => JSON.stringify(r))"));
  t.check('switching one protection off makes the level Custom and keeps the rest', noFp.protection === 'custom' && noFp.features.fp === false && noFp.features.recorders === true && noFp.features.annoyances === true && noFp.features.webrtc === 'public', JSON.stringify(noFp));
  const rawA = await read('http://fp.site/'), rawB = await read('http://fp2.site/');
  t.check('with fingerprint protection off, two sites read the same (real) values: the difference came from Oto', noisy.every((k) => rawA.page[k] === rawB.page[k]) && rawA.page.canvasUrl !== a1.page.canvasUrl, `${show(rawA.page)} | ${show(rawB.page)}`);
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
