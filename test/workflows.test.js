'use strict';
// Aegis 9: GitHub Actions supply-chain rules, checked on every change.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '.github', 'workflows');
const flows = fs.readdirSync(DIR).filter((f) => f.endsWith('.yml')).map((f) => [f, fs.readFileSync(path.join(DIR, f), 'utf8')]);

test('every action is pinned to an exact commit (no moving tags)', () => {
  for (const [f, s] of flows) for (const m of s.matchAll(/uses:\s*([^\s#]+)/g)) {
    if (m[1].startsWith('./')) continue;
    assert.match(m[1], /@[0-9a-f]{40}$/, `${f}: ${m[1]}`);
  }
});

test('every workflow declares its permissions, read-only unless a job needs more', () => {
  for (const [f, s] of flows) {
    assert.match(s, /^permissions:/m, `${f} has top-level permissions`);
    const top = s.match(/^permissions:\n((?: {2}.+\n)+)/m)[1];
    if (!['chromium-update.yml', 'android-engine.yml'].includes(f)) assert.doesNotMatch(top, /: write/, `${f}: write access only per job`);
  }
});

test('release: tests before building, verification after publishing, and only the release job can publish', () => {
  const rel = flows.find(([f]) => f === 'release.yml')[1];
  const build = rel.indexOf('electron-builder --win');
  for (const step of ['npm test', 'npm run lint', 'npm audit --omit=dev --audit-level=high', 'npm run test:e2e']) {
    assert.ok(rel.indexOf(step) > 0 && rel.indexOf(step) < build, `${step} runs before the installer is built`);
  }
  assert.doesNotMatch(rel, /continue-on-error:\s*true/, 'no check is allowed to fail quietly');
  assert.match(rel, /verify:\n {4}needs: release/);
  const verify = rel.slice(rel.indexOf('  verify:'), rel.indexOf('  notes:'));
  assert.doesNotMatch(verify, /contents: write|id-token: write/, 'the verify job can’t change anything');
});

test('secrets are only passed to the steps that need them, never echoed', () => {
  for (const [f, s] of flows) {
    assert.doesNotMatch(s, /echo .*\$\{\{\s*secrets\./, `${f}: a secret is printed`);
    assert.doesNotMatch(s, /pull_request_target/, `${f}: pull_request_target runs untrusted code with secrets`);
  }
});

test('every push runs the end-to-end tests on Linux and Windows, and nothing is allowed to fail quietly', () => {
  const ci = flows.find(([f]) => f === 'ci.yml')[1];
  assert.match(ci, /e2e-linux:[\s\S]*npm run test:e2e/);
  assert.match(ci.slice(ci.indexOf('windows-build:')), /npm run test:e2e/);
  assert.match(ci, /npm audit --omit=dev --audit-level=high/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
});
