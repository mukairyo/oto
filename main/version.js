'use strict';
// Oto's version numbers, in one place (the app, the daily engine update and the release check all use this file).
//
// The updater needs three-part numbers that only ever go up. Oto also ships small automatic updates between
// releases (a newer engine with Chrome's security fixes), shown with a fourth number: 1.4.2.1. So the last part of
// the updater's number carries both:
//
//     last part = release × 100 + small update        1.4.200 = "1.4.2"    1.4.201 = "1.4.2.1"    1.5.3 = "1.5.0.3"
//
// Releases up to 1.4.1 were numbered plainly (1.4.1 = "1.4.1") and keep their names. From 1.4.2 on, a release is
// always a multiple of 100. A plain "1.4.2" would be OLDER than the automatic update 1.4.101 ("1.4.1.1") to the
// updater, and nobody on that update would ever get it. test/version.test.js and the release check guard this.

const parse = (v) => { const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2], +m[3]] : null; };
// which of two updater numbers is newer (ignores tester suffixes like -beta.1)
const cmp = (a, b) => { const x = parse(a) || [0, 0, 0], y = parse(b) || [0, 0, 0]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const plain = ([M, m, p]) => p < 100 && cmp(`${M}.${m}.${p}`, '1.4.1') <= 0; // numbered before the rule above

// updater number -> the name people see
function display(v) {
  const s = String(v || ''), t = parse(s);
  if (!t) return s;
  if (s.includes('-')) return s; // tester builds keep their full name, e.g. 0.10.0-beta.1
  const [M, m, p] = t;
  if (plain(t)) return `${M}.${m}.${p}`;
  const big = Math.floor(p / 100), small = p % 100;
  return small ? `${M}.${m}.${big}.${small}` : `${M}.${m}.${big}`;
}

// the name people see -> updater number ("1.4.2" -> "1.4.200", "1.4.2.1" -> "1.4.201", "1.4.1" -> "1.4.1")
function fromDisplay(name) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(name || ''));
  if (!m) return null;
  const [M, mi, big, small] = [+m[1], +m[2], +m[3], m[4] === undefined ? null : +m[4]];
  if (small === null && big < 100 && cmp(`${M}.${mi}.${big}`, '1.4.1') <= 0) return `${M}.${mi}.${big}`;
  if (big > 99 || (small || 0) > 99) return null;
  return `${M}.${mi}.${big * 100 + (small || 0)}`;
}

// the next small automatic update after this version
function nextSmall(v) {
  const t = parse(v);
  if (!t || String(v).includes('-')) throw new Error(`not a release version: ${v}`);
  const [M, m, p] = t;
  if (plain(t)) { if (!p) throw new Error(`${v} has no room for a small update`); return `${M}.${m}.${p * 100 + 1}`; }
  if (p % 100 === 99) throw new Error(`${v} already had 99 small updates: make a normal release`);
  return `${M}.${m}.${p + 1}`;
}

// a release tag ("v1.4.2", "1.4.2.1", "1.5.0-beta.1") -> updater number, to compare with the running version
function fromTag(tag) {
  const t = String(tag || '').replace(/^v/, ''), i = t.indexOf('-');
  const n = fromDisplay(i < 0 ? t : t.slice(0, i));
  return n ? n + (i < 0 ? '' : t.slice(i)) : t;
}

// Checked before every release: '' when fine, otherwise what is wrong (in words for the build log).
// published = the updater number of the newest release people already have ('' when there is none).
function releaseProblem(pkg, published) {
  const v = String((pkg && pkg.version) || ''), name = String((pkg && pkg.otoVersion) || '');
  if (!parse(v)) return `package.json "version" (${v}) is not a version number`;
  if (v.includes('-')) return ''; // tester builds are named as they are
  if (display(v) !== name) return `package.json says "version": "${v}" and "otoVersion": "${name}", but ${v} is shown as ${display(v)}. For Oto ${name} use "version": "${fromDisplay(name) || '?'}" (see main/version.js).`;
  if (published && parse(published) && cmp(v, published) < 0) return `Oto ${name} has the updater number ${v}, which is OLDER than ${published} (Oto ${display(published)}), the release people already have. Nobody would receive this update. Use a number above ${published} (see main/version.js).`;
  return '';
}

module.exports = { parse, cmp, display, fromDisplay, fromTag, nextSmall, releaseProblem };
