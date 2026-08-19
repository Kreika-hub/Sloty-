import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('=== STEP 1: Static Module Verification ===');
  const files = [
    'src/db.js',
    'src/main.js',
    'src/modules/admin.js',
    'src/modules/admin/admin-store.js',
    'src/modules/admin/admin-users.js',
    'src/modules/guard.js',
    'src/modules/onboarding.js',
    'src/modules/master.js'
  ];

  files.forEach(f => {
    execSync(`node --check ${f}`);
    console.log(`✓ ${f} is valid JavaScript`);
  });

  console.log('\n=== STEP 2: Running Vite Build ===');
  const build = execSync('npm run build', { encoding: 'utf8' });
  console.log(build);

  console.log('\n=== STEP 3: Git Status Verification ===');
  const status = execSync('git status --short', { encoding: 'utf8' });
  console.log(status);

  console.log('\n=== STEP 4: Git Commit & Push ===');
  execSync('git add src/ run_build.js');
  try {
    const commitRes = execSync('git commit -m "feat: implement live BCV audit conversions, admin onboarding wizard, and master panel feature flags"', { encoding: 'utf8' });
    console.log(commitRes);
  } catch (e) {
    console.log('Commit note:', e.message);
  }

  try {
    const pushRes = execSync('git push', { encoding: 'utf8' });
    console.log(pushRes);
  } catch (e) {
    console.log('Git push note (offline/no remote configured):', e.message);
  }

} catch (e) {
  console.log("VERIFICATION ERROR:");
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log(e.message);
}
setTimeout(() => { console.log('Done'); }, 2000);
