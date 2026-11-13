#!/usr/bin/env node
'use strict';
// Oto end-to-end tests (npm run test:e2e): runs the real Oto against local test sites and checks the results.
// Each suite gets a fresh profile. Linux needs a display (uses xvfb-run when there isn't one); Windows runs as is.
// Usage: node test/e2e/run.js [suite ...]     Env: OTO_E2E_ELECTRON (binary), OTO_E2E_SEED (profile files to copy in)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { start } = require('./server.js');

const SUITES = fs.readdirSync(path.join(__dirname, 'suites')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
const want = process.argv.slice(2).length ? process.argv.slice(2) : SUITES;
const electron = process.env.OTO_E2E_ELECTRON || require('electron');

function run(cmd, args, env, timeout) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', error = null;
    p.stdout.on('data', (d) => { stdout += d; if (stdout.length > 2e6) stdout = stdout.slice(-1e6); });
    p.stderr.on('data', (d) => { stderr += d; if (stderr.length > 2e6) stderr = stderr.slice(-1e6); });
    const timer = setTimeout(() => { error = new Error(`timed out after ${timeout / 1000} s`); try { p.kill('SIGKILL'); } catch {} }, timeout);
    p.on('error', (e) => { error = e; });
    p.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr, error }); });
  });
}

(async () => {
  const srv = await start();
  const all = [];
  for (const suite of want) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), `oto-e2e-${suite}-`));
    const mod = require(path.join(__dirname, 'suites', `${suite}.js`));
    // every profile starts as "already set up" (first-run setup and intro skipped), like a normal user's second start
    fs.writeFileSync(path.join(profile, 'state.json'), JSON.stringify({ onboarded: true, lastSeenVersion: require('../../package.json').otoVersion, settings: { v1Intro: false, showWhatsNew: false, v1IntroSound: false } }));
    for (const [f, make] of Object.entries(mod.seed || {})) fs.writeFileSync(path.join(profile, f), make()); // files the suite needs before Oto starts
    const out = path.join(profile, '..', `oto-e2e-${suite}-${process.pid}.json`);
    const env = { ...process.env, OTO_E2E_SUITE: suite, OTO_E2E_PROFILE: profile, OTO_E2E_OUT: out, OTO_E2E_RULES: srv.rules, OTO_E2E_HTTP: String(srv.httpPort), OTO_E2E_HTTPS: String(srv.httpsPort) };
    delete env.HTTPS_PROXY; delete env.https_proxy; delete env.HTTP_PROXY; delete env.http_proxy; delete env.ELECTRON_RUN_AS_NODE;
    const args = [path.join(__dirname, 'harness.js'), '--no-sandbox', ...String(process.env.OTO_E2E_FLAGS || '').split(' ').filter(Boolean)]; // OTO_E2E_FLAGS: extra Chromium flags, e.g. software WebGL on a machine without a graphics card
    const useXvfb = process.platform === 'linux' && !process.env.DISPLAY;
    const t0 = Date.now();
    // async on purpose: the test web server runs in this process and must keep answering while Oto runs
    const r = await run(useXvfb ? 'xvfb-run' : electron, useXvfb ? ['-a', '-s', '-screen 0 1400x860x24', electron, ...args] : args, env, 180000);
    if (process.env.OTO_E2E_VERBOSE) console.log(String(r.stdout || '').split('\n').filter((l) => /\[oto\]|refused|Error|error/.test(l)).slice(0, 30).join('\n'));
    let res = [];
    try { res = JSON.parse(fs.readFileSync(out, 'utf8')); } catch { res = [{ name: 'suite produced results', pass: false, detail: (r.error && r.error.message) || String(r.stderr || '').slice(-400) }]; }
    // Oto ends a suite itself with exit code 0. Anything else means it crashed or hung part-way: the checks after
    // that point never ran, so the suite must not count as passed just because the ones before it did.
    if (r.code !== 0 || r.error) res.push({ name: 'Oto ran to the end of the suite without crashing', pass: false, detail: `${r.error ? r.error.message : `exit code ${r.code}${r.signal ? `, signal ${r.signal}` : ''}`} after ${res.length} check(s). ${String(r.stderr || '').split('\n').filter((l) => /crash|fatal|check failed|segv|signal|error/i.test(l)).slice(-3).join(' | ').slice(0, 240)}` });
    console.log(`\n${suite} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    for (const x of res) console.log(`  ${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.detail ? `  — ${x.detail}` : ''}`);
    all.push(...res.map((x) => ({ suite, ...x })));
  }
  srv.close();
  const failed = all.filter((x) => !x.pass);
  console.log(`\n${all.length - failed.length}/${all.length} checks passed on ${process.platform}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Oto end-to-end (${process.platform})\n\n| Suite | Check | Result |\n|---|---|---|\n${all.map((x) => `| ${x.suite} | ${x.name} | ${x.pass ? '✅' : '❌'} ${String(x.detail || '').replace(/\|/g, '/')} |`).join('\n')}\n`);
  process.exit(failed.length ? 1 : 0);
})();
