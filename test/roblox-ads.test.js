'use strict';
// Classic Roblox's old ads (1.9.0): only pictures from the wiki's image host are taken, by shape, and kept.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRobloxAds, kindOf, goodImageUrl } = require('../main/roblox-ads.js');

test('ads go where their shape fits: tall beside the page, wide on top, boxy at the bottom', () => {
  assert.strictEqual(kindOf(160, 600), 'sky'); assert.strictEqual(kindOf(728, 90), 'board'); assert.strictEqual(kindOf(300, 250), 'rect');
  assert.strictEqual(kindOf(500, 250), ''); assert.strictEqual(kindOf(0, 10), '');
});
test('only https pictures from the wiki image host are taken', () => {
  assert.ok(goodImageUrl('https://static.wikia.nocookie.net/roblox/images/8/87/Advertisement.png/revision/latest?cb=1'));
  for (const u of ['http://static.wikia.nocookie.net/roblox/images/x.png', 'https://evil.example/roblox/images/x.png', 'https://static.wikia.nocookie.net.evil.example/roblox/images/x.png', 'https://static.wikia.nocookie.net/other/images/x.png', 'javascript:alert(1)']) assert.ok(!goodImageUrl(u), u);
});
test('the gallery list is read, filtered, kept, and a picture is fetched once and then reused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-rbx-'));
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f3a7ef0000000049454e44ae426082', 'hex');
  const calls = [];
  const pages = { a: { imageinfo: [{ url: 'https://static.wikia.nocookie.net/roblox/images/1/1a/Sky.png/revision/latest', width: 160, height: 600, mime: 'image/png', size: 900 }] },
    b: { imageinfo: [{ url: 'https://static.wikia.nocookie.net/roblox/images/2/2b/Board.png/revision/latest', width: 728, height: 90, mime: 'image/png', size: 900 }] },
    c: { imageinfo: [{ url: 'https://evil.example/roblox/images/3/3c/Bad.png', width: 160, height: 600, mime: 'image/png', size: 900 }] },
    d: { imageinfo: [{ url: 'https://static.wikia.nocookie.net/roblox/images/4/4d/Huge.png', width: 160, height: 600, mime: 'image/png', size: 9e6 }] } };
  const fetch = async (u) => {
    calls.push(u);
    if (u.startsWith('https://roblox.fandom.com/api.php?')) return { ok: true, json: async () => ({ query: { pages } }) };
    return { ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => png };
  };
  const ads = createRobloxAds({ dir, fetch });
  const l = await ads.getList();
  assert.deepStrictEqual(l.items.map((x) => x.kind).sort(), ['board', 'sky']);
  const p1 = await ads.pick();
  assert.match(p1.sky1, /^data:image\/png;base64,/); assert.match(p1.board, /^data:image\/png;base64,/);
  assert.strictEqual(p1.sky2, null, 'two different tall ads, and there is only one'); assert.strictEqual(p1.rect, null);
  const before = calls.length;
  await createRobloxAds({ dir, fetch }).pick(); // a new start: the list and the pictures come from the disk
  assert.strictEqual(calls.length, before, 'nothing fetched again');
  assert.ok(!calls.some((u) => u.includes('evil.example') || u.includes('Huge')), 'bad or huge pictures are never fetched');
});
test('something that is not a picture is refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-rbx-'));
  const pages = { a: { imageinfo: [{ url: 'https://static.wikia.nocookie.net/roblox/images/1/1a/Sky.png', width: 160, height: 600, mime: 'image/png', size: 900 }] } };
  const fetch = async (u) => (u.includes('api.php') ? { ok: true, json: async () => ({ query: { pages } }) } : { ok: true, headers: { get: () => 'text/html' }, arrayBuffer: async () => Buffer.from('<script>') });
  const p = await createRobloxAds({ dir, fetch }).pick();
  assert.strictEqual(p.sky1, null);
});
test('your own ad pictures: a zip is read in memory, only real pictures are kept (by their bytes), and then used instead of the wiki', async () => {
  const AdmZip = require('adm-zip');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oto-rbx-'));
  const pngOf = (w, h) => { const b = Buffer.alloc(64); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  const webpOf = (w, h) => { const b = Buffer.alloc(40); b.write('RIFF', 0, 'latin1'); b.write('WEBP', 8, 'latin1'); b.write('VP8 ', 12, 'latin1'); b.writeUInt16LE(w, 26); b.writeUInt16LE(h, 28); return b; };
  const zip = new AdmZip();
  zip.addFile('sky.png', pngOf(160, 600)); zip.addFile('banner.jpg', webpOf(728, 90)); zip.addFile('box.png', pngOf(300, 250));
  zip.addFile('../../evil.exe', Buffer.from('MZ not a picture at all, just some bytes here')); zip.addFile('odd.png', pngOf(500, 250));
  const zf = path.join(dir, 'ads.zip'); zip.writeZip(zf);
  let fetched = 0;
  const ads = createRobloxAds({ dir: path.join(dir, 'data'), fetch: async () => { fetched++; throw new Error('no web'); } });
  const r = ads.importFrom(zf);
  assert.deepStrictEqual([r.added, r.sky, r.board, r.rect], [3, 1, 1, 1]);
  const files = fs.readdirSync(path.join(dir, 'data', 'imported')).sort();
  assert.ok(files.every((f) => /^([a-f0-9]{24}\.(png|webp)|list\.json)$/.test(f)), files.join());
  assert.ok(!fs.existsSync(path.join(dir, 'evil.exe')) && !fs.existsSync(path.join(dir, 'data', 'evil.exe')));
  const p = await ads.pick();
  assert.match(p.sky1, /^data:image\/png;base64,/); assert.match(p.board, /^data:image\/webp;base64,/); assert.match(p.rect, /^data:image\/png;base64,/);
  assert.strictEqual(fetched, 0, 'the wiki is not asked when you have your own pictures');
  assert.strictEqual(ads.importFrom(zf).added, 0, 'importing the same pictures again adds nothing');
  assert.strictEqual(ads.clearImported().total, 0);
});
