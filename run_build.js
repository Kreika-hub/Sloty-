import { execSync } from 'child_process';
try {
  console.log('=== AUDIT TEST SUITE: Static Check ===');
  const files = [
    'src/modules/admin/admin-store.js',
    'src/modules/admin.js',
    'src/modules/admin/admin-users.js',
    'src/modules/admin/admin-finance.js',
    'src/modules/admin/admin-dashboard.js',
    'src/modules/admin/admin-guards.js',
    'src/modules/admin/admin-settings.js',
    'src/modules/admin/admin-structure.js',
    'src/modules/master.js',
    'src/modules/onboarding.js',
    'src/modules/guard.js',
    'src/main.js',
    'src/db.js'
  ];

  files.forEach(f => {
    execSync(`node --check ${f}`);
    console.log(`✓ ${f} static check PASSED`);
  });

  console.log('\n=== AUDIT TEST SUITE: Production Build ===');
  const build = execSync('npm run build', { encoding: 'utf8' });
  console.log(build);

  console.log('\n=== AUDIT TEST SUITE: Git Commit & Push ===');
  execSync('git add src/ run_build.js');
  const commitRes = execSync('git commit -m "fix(security & resilience): sanitize dynamic HTML interpolations, add offline enqueueSync for expenses and abonos, and harden numeric validations"', { encoding: 'utf8' });
  console.log(commitRes);

  const pushRes = execSync('git push origin main', { encoding: 'utf8' });
  console.log(pushRes);

  const finalStatus = execSync('git status -uno', { encoding: 'utf8' });
  console.log('Final Status:\n', finalStatus);
} catch (e) {
  console.log('Audit Error / Result:');
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log(e.message);
}
setTimeout(() => { console.log('Done'); }, 2000);
