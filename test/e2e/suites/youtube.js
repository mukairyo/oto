'use strict';
// YouTube's ad-blocker wall (page-preload.js otoYouTubeAds). The real youtube.com can't be served here, so Oto's own
// code runs in a stand-in watch page (yt.site) and is checked piece by piece: the player's data loses its ads as text
// (fetch and XMLHttpRequest), YouTube's "abnormality detected" callback never runs, its 17-second penalty wait is cut
// short (other timers are left alone), and the wall's pop-up is closed so the video goes on.
const fs = require('fs');
const path = require('path');

module.exports = async (t) => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'page-preload.js'), 'utf8').match(/function otoYouTubeAds\(\) \{[\s\S]*?\n\}\n/);
  t.check('the YouTube code is found in page-preload.js', !!src);
  if (!src) return;
  await t.open('http://yt.site/watch', 2500);
  await t.page(`(${src[0]})(); 1`);
  const P = async (code) => JSON.parse(await t.page(`(async () => JSON.stringify(await (async () => { ${code} })()))()`));

  let a = await P("const j = await (await fetch('/youtubei/v1/player')).json(); return { keys: Object.keys(j), status: j.playabilityStatus.status, id: j.videoDetails.videoId };");
  t.check('fetch: the player data has no ads, everything else is there', !a.keys.includes('adPlacements') && !a.keys.includes('adSlots') && !a.keys.includes('playerAds') && a.status === 'OK' && a.id === 'abc', JSON.stringify(a));
  a = await P("const s = await (await fetch('/youtubei/v1/player')).text(); return { ads: s.includes('\"adPlacements\"') || s.includes('\"adSlots\"'), noAds: s.includes('\"no_ads\"') };");
  t.check('fetch as text: "adPlacements" and "adSlots" read as "no_ads"', !a.ads && a.noAds, JSON.stringify(a));
  a = await P("return await new Promise((res) => { const x = new XMLHttpRequest(); x.open('GET', '/youtubei/v1/player'); x.onload = () => res({ ads: x.responseText.includes('\"adPlacements\"'), noAds: x.responseText.includes('\"no_ads\"') }); x.send(); });");
  t.check('XMLHttpRequest: the same', !a.ads && a.noAds, JSON.stringify(a));
  a = await P("const s = await (await fetch('/echo-lang')).text(); return { same: typeof s === 'string' && s.length > 0 };");
  t.check('other requests are left exactly as they are', a.same, JSON.stringify(a));

  a = await P("window.__abn = 0; const cb = function onAbnormalityDetected() { window.__abn++; }; Promise.resolve(1).then(cb); Promise.resolve(2).then((v) => { window.__ok = v; }); await new Promise((r) => setTimeout(r, 50)); return { abn: window.__abn, ok: window.__ok };");
  t.check('YouTube’s “abnormality detected” callback never runs (other callbacks do)', a.abn === 0 && a.ok === 2, JSON.stringify(a));

  a = await P("const t0 = performance.now(); let other = false; setTimeout(() => { other = true; }, 17000); const ms = await new Promise((r) => setTimeout(function () { r(performance.now() - t0); }.bind(null), 17000)); return { ms: Math.round(ms), other };");
  t.check('the 17-second wait is cut short, other timers are not', a.ms < 2000 && a.other === false, JSON.stringify(a));

  a = await P("const d = document.createElement('tp-yt-paper-dialog'); d.innerHTML = '<ytd-enforcement-message-view-model>Ad blockers violate YouTube’s Terms of Service</ytd-enforcement-message-view-model>'; document.body.append(d, document.createElement('tp-yt-iron-overlay-backdrop')); const v = document.querySelector('video'); v.pause(); await new Promise((r) => setTimeout(r, 900)); return { pop: !!document.querySelector('ytd-enforcement-message-view-model'), backdrop: !!document.querySelector('tp-yt-iron-overlay-backdrop'), playing: !v.paused };");
  t.check('the wall’s pop-up is closed and the video goes on', !a.pop && !a.backdrop && a.playing, JSON.stringify(a));

  a = await P("return { parse: Function.prototype.toString.call(JSON.parse).includes('[native code]'), then: Function.prototype.toString.call(Promise.prototype.then).includes('[native code]'), timer: Function.prototype.toString.call(setTimeout).includes('[native code]'), text: Function.prototype.toString.call(Response.prototype.text).includes('[native code]'), ts: Function.prototype.toString.call(Function.prototype.toString).includes('[native code]'), name: Promise.prototype.then.name };");
  t.check('the changed functions still look like the browser’s own', a.parse && a.then && a.timer && a.text && a.ts && a.name === 'then', JSON.stringify(a));
};
