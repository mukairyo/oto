// Run before a release is built: stops a release that nobody would receive. Oto's updater only offers a version
// whose number is HIGHER than the one people have, and Oto's numbering has a trap (main/version.js): after an
// automatic engine update (1.4.101, shown as 1.4.1.1) a plain "1.4.2" would count as older. This compares the
// version in package.json with the newest published release (its latest.yml, the file the updater reads).
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import ver from '../../main/version.js';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let published = '';
try {
  const yml = execSync(`gh release download --repo "${process.env.GITHUB_REPOSITORY}" --pattern latest.yml --output -`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  published = (/^version:\s*['"]?([^\s'"]+)/m.exec(yml) || [])[1] || '';
} catch { /* no release yet, or GitHub didn't answer: only the package.json check below runs */ }

const problem = ver.releaseProblem(pkg, published);
if (problem) { console.error(`::error::${problem}`); process.exit(1); }
console.log(`Oto ${pkg.otoVersion} (updater number ${pkg.version}) is not older than ${published ? `the published ${published}` : 'anything published'}: fine.`);
