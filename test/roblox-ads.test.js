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
