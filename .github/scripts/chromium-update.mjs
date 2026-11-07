// Keeps Oto's Chromium up to date: finds the newest Electron release in the major version Oto uses,
// updates package.json + the lockfile, bumps Oto's small-update number and adds a changelog entry.
// A newer *major* Electron is only reported (it can need code changes), never applied automatically.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const out = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); console.log(`${k}=${v}`); };
const npm = (args) => JSON.parse(execSync(`npm view ${args} --json`, { encoding: 'utf8' }));
const parts = (v) => String(v).replace(/^[^\d]*/, '').split('-')[0].split('.').map(Number);
const cmp = (a, b) => { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
const display = (v) => { const [M, m, p] = parts(v); if (p < 100) return `${M}.${m}.${p}`; const b = Math.floor(p / 100), s = p % 100; return s ? `${M}.${m}.${b}.${s}` : `${M}.${m}.${b}`; };

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
// A tester build (e.g. 0.10.0-beta.1) is on main right now — leave it alone; the next stable release picks up Electron fixes.
if (String(pkg.version).includes('-')) { out('changed', 'false'); console.log('tester build on main, skipping'); process.exit(0); }
// Oto runs on castlabs' Electron for Content Security (Electron + Widevine, for Spotify/Netflix…),
// installed from GitHub as "github:castlabs/electron-releases#vX.Y.Z+wvcus".
const dep = String(pkg.devDependencies.electron);
const ECS = /castlabs\/electron-releases/.test(dep);
const current = parts(ECS ? dep.split('#v')[1].split('+')[0] : dep).join('.');
const major = parts(current)[0];
let sameMajor, latest;
if (ECS) {
  const tags = execSync('git ls-remote --tags https://github.com/castlabs/electron-releases', { encoding: 'utf8' })
    .split('\n').map((l) => (l.match(/refs\/tags\/v(\d+\.\d+\.\d+)\+wvcus$/) || [])[1]).filter(Boolean).sort(cmp);
  sameMajor = tags.filter((v) => parts(v)[0] === major).pop();
  latest = tags.pop();
} else {
  sameMajor = [].concat(npm(`"electron@^${major}" version`)).filter((v) => !String(v).includes('-')).sort(cmp).pop();
  latest = npm('electron dist-tags').latest;
}
if (latest && parts(latest)[0] > major) out('major', latest);

if (!sameMajor || cmp(sameMajor, current) <= 0) { out('changed', 'false'); process.exit(0); }

if (ECS) {
  execSync(`npm install "https://github.com/castlabs/electron-releases#v${sameMajor}+wvcus" --save-dev --save-exact --package-lock-only --ignore-scripts`, { stdio: 'inherit' });
  // npm writes the git source as ssh; CI has no ssh key, so use https.
  fs.writeFileSync('package-lock.json', fs.readFileSync('package-lock.json', 'utf8').replaceAll('git+ssh://git@github.com/castlabs/', 'git+https://github.com/castlabs/'));
} else {
  execSync(`npm install electron@${sameMajor} --save-dev --save-exact --package-lock-only --ignore-scripts`, { stdio: 'inherit' });
}
const p2 = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const [M, m, p] = parts(p2.version);
const next = p < 100 ? p * 100 + 1 : p + 1; // small update: 0.9.900 (0.9.9) -> 0.9.901 (0.9.9.1)
p2.version = `${M}.${m}.${next}`;
p2.otoVersion = display(p2.version);
fs.writeFileSync('package.json', `${JSON.stringify(p2, null, 2)}\n`);

let chrome = '';
try { const rel = await (await fetch('https://releases.electronjs.org/releases.json')).json(); chrome = (rel.find((r) => r.version === sameMajor) || {}).chrome || ''; } catch {}
const date = new Date().toISOString().slice(0, 10);
const entry = `## ${p2.otoVersion} — ${date}\n\n**Security**\n- Updated Oto's engine to Electron ${sameMajor}${chrome ? ` (Chromium ${chrome})` : ''} with the latest security fixes from Chrome. This update was made automatically.\n\n`;
const log = fs.readFileSync('CHANGELOG.md', 'utf8');
const i = log.indexOf('\n## ');
fs.writeFileSync('CHANGELOG.md', i < 0 ? log + '\n' + entry : log.slice(0, i + 1) + entry + log.slice(i + 1));

out('changed', 'true');
out('electron', sameMajor);
out('chrome', chrome);
out('version', p2.otoVersion);
