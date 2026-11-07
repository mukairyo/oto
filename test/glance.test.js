'use strict';
// 1.3.1 follow-up N09: Glance only ever opens validated http/https addresses taken out of redirect links.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// The page helper is a template string in src/extras.js; take its redirect part out and run it here.
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'extras.js'), 'utf8');
const helper = eval(src.match(/const PAGE_HELPER = (`[\s\S]*?`);/)[1]); // eslint-disable-line no-eval
const part = helper.slice(helper.indexOf('  const REDIRECTS'), helper.indexOf('  const otherSite'));
const realUrl = new Function(`${part}; return realUrl;`)(); // eslint-disable-line no-new-func

test('the page helper is valid JavaScript', () => { assert.doesNotThrow(() => new Function(helper)); });

test('YouTube, Google and Facebook redirects give the real address', () => {
  assert.strictEqual(realUrl('https://www.youtube.com/redirect?event=video_description&q=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1&v=x'), 'https://example.com/a?b=1');
  assert.strictEqual(realUrl('https://www.google.com/url?sa=t&url=https://b.org/'), 'https://b.org/');
  assert.strictEqual(realUrl('https://l.facebook.com/l.php?u=https%3A%2F%2Fc.net%2F&h=AT0'), 'https://c.net/');
});

test('unsafe or odd targets are never unwrapped', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'file:///C:/x', 'ftp://x.org/', '', 'not a url', `https://e.com/${'a'.repeat(9000)}`]) {
    const href = `https://www.youtube.com/redirect?q=${encodeURIComponent(bad)}`;
    assert.strictEqual(realUrl(href), new URL(href).href, bad.slice(0, 30));
  }
});

test('nested redirects are followed (3 deep at most), double encoding handled', () => {
  const inner = 'https://www.google.com/url?q=' + encodeURIComponent('https://final.example/');
  assert.strictEqual(realUrl('https://www.youtube.com/redirect?q=' + encodeURIComponent(inner)), 'https://final.example/');
  assert.strictEqual(realUrl('https://www.youtube.com/redirect?q=' + encodeURIComponent(encodeURIComponent('https://twice.example/'))), 'https://twice.example/');
  let loop = 'https://www.youtube.com/redirect?q=https%3A%2F%2Fwww.youtube.com%2Fwatch';
  for (let i = 0; i < 6; i++) loop = 'https://www.youtube.com/redirect?q=' + encodeURIComponent(loop);
  assert.doesNotThrow(() => realUrl(loop));
});

test('ordinary links and lookalike hosts are left alone', () => {
  assert.strictEqual(realUrl('https://www.youtube.com/watch?v=1&q=https://x.com/'), 'https://www.youtube.com/watch?v=1&q=https://x.com/');
  assert.strictEqual(realUrl('https://youtube.com.evil.example/redirect?q=https%3A%2F%2Fx.com'), 'https://youtube.com.evil.example/redirect?q=https%3A%2F%2Fx.com');
});
