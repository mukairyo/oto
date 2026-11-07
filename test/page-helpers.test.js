'use strict';
// The password page helpers are valid JavaScript and carry the secret Oto made, and the tracker list works.
const test = require('node:test');
const assert = require('node:assert');
const { PW_CAPTURE, PW_CHOOSER } = require('../main/pw-page.js');
const { trackerOf, extraFilters } = require('../trackers.js');

test('page helpers compile and embed the nonce', () => {
  const c = PW_CAPTURE('abc123'), f = PW_CHOOSER('abc123', [{ id: 'p1', u: '"quote</script>' }]);
  assert.doesNotThrow(() => new Function(c)); assert.doesNotThrow(() => new Function(f));
  assert.ok(c.includes('__oto_pw__abc123') && f.includes('__oto_pwfill__abc123'));
});

test('tracker lookup and the extra block list', () => {
  assert.strictEqual(trackerOf('www.google-analytics.com'), 'Google Analytics');
  assert.strictEqual(trackerOf('example.com'), '');
  assert.ok(extraFilters('balanced').includes('||adtago.s3.amazonaws.com^'));
  assert.ok(!extraFilters('balanced').includes('||extmaps-api.yandex.net^'));
  assert.ok(extraFilters('strict').includes('||extmaps-api.yandex.net^'));
});
