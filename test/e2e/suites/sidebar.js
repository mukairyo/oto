'use strict';
// The sidebar's modes: in the icon strip everything fits inside the strip, also after Ctrl+B hides and shows it again.
module.exports = async (t) => {
  await t.open('http://fine.site/');
  await t.sleep(800);
  const look = () => t.js(`JSON.stringify((() => {
    const sb = document.querySelector('#sidebar').getBoundingClientRect(), ess = document.querySelector('.essentials');
    const tiles = [...ess.querySelectorAll('.ess')].map((e) => e.getBoundingClientRect());
    const col = document.querySelector('#column').getBoundingClientRect();
    return { mode: sidebarMode(), sbRight: Math.round(sb.right), colLeft: Math.round(col.left),
      tilesInside: tiles.length > 0 && tiles.every((r) => r.right <= sb.right + 0.5 && r.left >= sb.left - 0.5),
      heading: getComputedStyle(ess, '::before').display, skin: document.body.classList.contains('skin-rt') };
  })())`);
  await t.js('setSidebarMode("expanded"), 1'); await t.sleep(700);
  await t.js('toggleCollapsed(), 1'); await t.sleep(900);
  let a = JSON.parse(await look());
  t.check('icon strip: every essential fits inside the strip', a.mode === 'collapsed' && a.tilesInside, JSON.stringify(a));
  t.check('icon strip: the section heading is hidden (no room for it)', !a.skin || a.heading === 'none', JSON.stringify(a));
  t.check('icon strip: the page starts where the strip ends', a.colLeft >= a.sbRight - 1, JSON.stringify(a));
  await t.js('toggleCompact(), 1'); await t.sleep(900);
  t.check('Ctrl+B hides the sidebar', JSON.parse(await look()).mode === 'hidden');
  await t.js('toggleCompact(), 1'); await t.sleep(1100);
  a = JSON.parse(await look());
  t.check('Ctrl+B again brings the icon strip back with everything inside it', a.mode === 'collapsed' && a.tilesInside && (!a.skin || a.heading === 'none') && a.colLeft >= a.sbRight - 1, JSON.stringify(a));
  await t.js('setSidebarMode("expanded"), 1'); await t.sleep(900);
  a = JSON.parse(await look());
  t.check('expanded again: the heading is back', a.mode === 'expanded' && (!a.skin || a.heading === 'block') && a.tilesInside, JSON.stringify(a));
};
