'use strict';
// Frutiger Aero (1.9.3): a second theme in Settings › Appearance › Theme, on the same layout as the Oto look.
module.exports = async (t) => {
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  let a = await J("return { skins: Object.keys(SKINS), now: skinOf() };");
  t.check('Settings offers two themes, Oto and Frutiger Aero (Oto unless picked)', JSON.stringify(a.skins) === '["ryokutunes","aero"]' && a.now === 'ryokutunes', JSON.stringify(a));
  await t.js("(openSettings('appearance'), 1)"); await t.sleep(300);
  await t.js("([...document.querySelectorAll('#settings .skin-pick')].find((b) => b.classList.contains('sk-aero')).click(), 1)"); await t.sleep(400);
  a = await J(`const b = document.body, e = document.getElementById('empty'); return { skin: S.settings.skin, aero: b.classList.contains('skin-aero'), rt: b.classList.contains('skin-rt'),
    bubbles: document.querySelectorAll('#aeroSky i').length, sky: /#0a56b0/i.test(getComputedStyle(document.documentElement).getPropertyValue('--bg-image')),
    picked: !!document.querySelector('#settings .skin-pick.sk-aero.on'), font: /Segoe UI/.test(getComputedStyle(b).fontFamily) };`);
  t.check('picking Frutiger Aero dresses Oto in it: the sky, the bubbles, Segoe UI, and the card shows as picked', a.skin === 'aero' && a.aero && a.rt && a.bubbles >= 8 && a.sky && a.picked && a.font, JSON.stringify(a));
  await t.js("([...document.querySelectorAll('#settings .skin-pick')].find((b) => b.classList.contains('sk-ryokutunes')).click(), 1)"); await t.sleep(400);
  a = await J("return { aero: document.body.classList.contains('skin-aero'), rt: document.body.classList.contains('skin-rt'), bubblesShown: !!(document.getElementById('aeroSky') && getComputedStyle(document.getElementById('aeroSky')).display !== 'none') };");
  t.check('…and picking Oto puts the near-black look back', !a.aero && a.rt && !a.bubblesShown, JSON.stringify(a));
  await t.js('(closeSettings(), 1)');
};
