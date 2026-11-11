'use strict';
// Performance budgets: generous limits that catch a real slowdown (not tiny noise), and the measured numbers in the
// report so they can be compared between versions and between Linux and Windows.
const { app } = require('electron');
const path = require('path');
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const ms = (n) => `${n.toFixed(1)} ms`;
module.exports = async (t) => {
  // opening a page (local test site, so this is Oto's own overhead plus Chromium)
  const opens = [];
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    await t.js(`(openUrl('http://fine.site/?p=${i}', { newTabForce: true }), 1)`);
    while (Date.now() - t0 < 10000) { if (await t.js("(() => { const v = V.get(activeTab().id); return !!(v && v.wv && v.wv.getURL().includes('fine.site') && !v.wv.isLoading()); })()")) break; await t.sleep(20); }
    opens.push(Date.now() - t0);
  }
  t.check('opening a page stays fast (median under 2 s)', median(opens) < 2000, `median ${ms(median(opens))}, all: ${opens.join(', ')} ms`);

  // saving tabs and history the way Oto does (flushed to disk), on this machine's real disk, with a big profile
  const store = require(path.join(__dirname, '..', '..', '..', 'main', 'store.js'))((n) => path.join(app.getPath('userData'), n));
  const big = {
    tabs: Array.from({ length: 80 }, (_, i) => ({ id: `t${i}`, url: `https://example.com/page/${i}?q=${'x'.repeat(60)}`, title: `Some page title ${i}`, favicon: `data:image/png;base64,${'A'.repeat(800)}` })),
    history: Array.from({ length: 3000 }, (_, i) => ({ u: `https://site${i}.com/a/b?x=${i}`, t: `Title of page ${i}`, at: Date.now() - i * 1000 })),
  };
  const saves = [];
  for (let i = 0; i < 15; i++) { const a = process.hrtime.bigint(); store.writeJSON('perf-test.json', big); saves.push(Number(process.hrtime.bigint() - a) / 1e6); }
  // the background save Oto uses for tabs and history: what it costs the main thread (the flush runs elsewhere)
  const bg = [];
  for (let i = 0; i < 15; i++) { const a = process.hrtime.bigint(); const p = store.writeJSONAsync('perf-test.json', big); bg.push(Number(process.hrtime.bigint() - a) / 1e6); await p; }
  t.check('a background save of the same profile blocks Oto for under 15 ms', median(bg) < 15, `main thread: median ${ms(median(bg))}, max ${ms(Math.max(...bg))}`);
  require('fs').unlinkSync(path.join(app.getPath('userData'), 'perf-test.json'));
  // Waiting for the disk (the "flush") is the slow part and depends on the machine: 8 ms to 90 ms on the same kind of
  // Windows test machine. Oto doesn't wait for it while you browse (the background save above), so this is a sanity
  // limit that only catches a real slowdown; the measured time is in the report.
  t.check('saving a big profile straight to disk (80 tabs, 3,000 history entries, flushed) stays under 500 ms', median(saves) < 500, `median ${ms(median(saves))}, max ${ms(Math.max(...saves))}, ${(JSON.stringify(big).length / 1024).toFixed(0)} KB`);

  // a round trip from Oto's window to its core (through the IPC gatekeeper and its checks)
  const trips = [];
  for (let i = 0; i < 30; i++) { const a = process.hrtime.bigint(); await t.js("oto.shield.state('https://fine.site/')"); trips.push(Number(process.hrtime.bigint() - a) / 1e6); }
  t.check('a message to Oto’s core and back stays under 25 ms', median(trips) < 25, `median ${ms(median(trips))}`);

  // memory with 5 tabs open (all Oto processes together)
  const mem = Math.round(app.getAppMetrics().reduce((n, p) => n + p.memory.workingSetSize, 0) / 1024);
  t.check('memory with a few tabs open stays under 3 GB', mem < 3072, `${mem} MB in ${app.getAppMetrics().length} processes`);
};
