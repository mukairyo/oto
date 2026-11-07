// electron-builder afterSign hook: production Widevine VMP signature (castlabs EVS) for the Windows app.
// It must run AFTER electron-builder edits Oto.exe (icon/version info) and code-signs it — any change to
// the exe afterwards breaks the VMP signature (that's why Spotify still skipped songs in owner.11/12).
// Needed for Netflix and other streaming services. Runs only when the EVS account is set as CI secrets
// (EVS_ACCOUNT_NAME / EVS_PASSWD); without them the build still works with ECS's development signature.
const { execFileSync } = require('child_process');

exports.default = async function vmpSign(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { EVS_ACCOUNT_NAME: user, EVS_PASSWD: pass } = process.env;
  if (!user || !pass) { console.log('  • VMP: no EVS account set (EVS_ACCOUNT_NAME / EVS_PASSWD) — skipping production Widevine signing'); return; }
  const py = process.platform === 'win32' ? 'python' : 'python3';
  console.log(`  • VMP: signing ${context.appOutDir} with castlabs EVS`);
  execFileSync(py, ['-m', 'castlabs_evs.vmp', '-n', 'sign-pkg', '-A', user, '-P', pass, context.appOutDir], { stdio: 'inherit' });
  execFileSync(py, ['-m', 'castlabs_evs.vmp', '-n', 'verify-pkg', context.appOutDir], { stdio: 'inherit' });
};
