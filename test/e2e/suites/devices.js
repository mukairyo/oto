'use strict';
// Device pickers (1.9.0): a site asking for a serial, USB or HID device (Web Serial covers Bluetooth earbuds too)
// gets Oto's own picker; cancelling answers the page with "nothing picked"; a site blocked from devices isn't asked.
module.exports = async (t) => {
  const J = async (code) => JSON.parse(await t.js(`JSON.stringify((() => { ${code} })())`));
  const page = () => "[...document.querySelectorAll('webview')].find((x) => x.offsetParent)";
  const ask = (code) => t.js(`(() => { ${page()}.executeJavaScript(${JSON.stringify(code)}, true).catch(() => {}); return 1; })()`);
  const read = (expr) => t.js(`${page()}.executeJavaScript(${JSON.stringify(expr)})`);
  const origin = `http://localhost:${t.ports.http}`;
  await t.open(`${origin}/`, 1500);

  await ask("window.__dev = 'waiting'; navigator.serial.requestPort().then(() => { window.__dev = 'got'; }, (e) => { window.__dev = e.name; })");
  await t.sleep(900);
  let a = await J("const b = document.querySelector('.v1-dev'); return { pick: !!b, crumb: b && b.querySelector('.sh-crumb span').textContent, sub: b && b.querySelector('.sub').textContent, items: b ? b.querySelectorAll('.dv-item, .dv-empty').length : 0 };");
  t.check('a site asking for a serial device (earbuds over Bluetooth, boards…) gets Oto’s device picker', a.pick && a.crumb === 'CONNECT / SERIAL' && /localhost/.test(a.sub) && a.items > 0, JSON.stringify(a));
  t.check('…and the page waits for your choice', (await read('window.__dev')) === 'waiting');
  await t.js("([...document.querySelectorAll('.v1-dev button')].find((b) => b.textContent === 'CANCEL').click(), 1)"); await t.sleep(500);
  t.check('…Cancel tells the page nothing was picked (no device given)', (await read('window.__dev')) === 'NotFoundError', String(await read('window.__dev')));

  await ask("window.__usb = 'waiting'; navigator.usb.requestDevice({ filters: [] }).then(() => { window.__usb = 'got'; }, (e) => { window.__usb = e.name; })");
  await t.sleep(900);
  a = await J("const b = document.querySelector('.v1-dev'); return { pick: !!b, crumb: b && b.querySelector('.sh-crumb span').textContent };");
  t.check('USB devices get the same picker', a.pick && a.crumb === 'CONNECT / USB', JSON.stringify(a));
  await t.js("([...document.querySelectorAll('.v1-dev button')].find((b) => b.textContent === 'CANCEL').click(), 1)"); await t.sleep(400);

  await ask("window.__hid = 'waiting'; navigator.hid.requestDevice({ filters: [] }).then((d) => { window.__hid = 'got:' + d.length; }, (e) => { window.__hid = e.name; })");
  await t.sleep(900);
  a = await J("const b = document.querySelector('.v1-dev'); return { pick: !!b, crumb: b && b.querySelector('.sh-crumb span').textContent };");
  t.check('controllers and other HID devices get it too', a.pick && a.crumb === 'CONNECT / HID', JSON.stringify(a));
  await t.js("([...document.querySelectorAll('.v1-dev button')].find((b) => b.textContent === 'CANCEL').click(), 1)"); await t.sleep(400);

  // a site you blocked from devices in its site settings isn't asked at all
  await t.js(`oto.setPermission('${origin}|serial', false)`); await t.sleep(200);
  await ask("window.__dev = 'waiting'; navigator.serial.requestPort().then(() => { window.__dev = 'got'; }, (e) => { window.__dev = e.name; })");
  await t.sleep(900);
  a = await J("return { pick: !!document.querySelector('.v1-dev') };");
  const res = await read('window.__dev');
  t.check('a site blocked from devices is refused without a picker', !a.pick && res !== 'waiting' && res !== 'got', JSON.stringify({ ...a, res }));
  await t.js(`oto.resetPermission('${origin}|serial')`);
};
