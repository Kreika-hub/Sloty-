import { execSync } from 'child_process';
try {
  console.log('=== VERIFICATION: Static Syntax Check ===');
  const files = [
    'src/db.js',
    'src/utils/notifier.js',
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
    'src/main.js'
  ];

  files.forEach(f => {
    execSync(`node --check ${f}`);
    console.log(`✓ ${f} static check PASSED`);
  });

  console.log('\n=== VERIFICATION: Vite Production Build ===');
  const build = execSync('npm run build', { encoding: 'utf8' });
  console.log(build);

  console.log('\n=== VERIFICATION: Git Commit & Push ===');
  execSync('git add src/ run_build.js');
  const commitRes = execSync('git commit -m "feat: implement unalterable audit log, telegram master notifications, live sync connectivity badges, and printable financial statements"', { encoding: 'utf8' });
  console.log(commitRes);

  const pushRes = execSync('git push origin main', { encoding: 'utf8' });
  console.log(pushRes);

  const finalStatus = execSync('git status -uno', { encoding: 'utf8' });
  console.log('Final Status:\n', finalStatus);
} catch (e) {
  console.log('Build / Verification Output:');
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log(e.message);
}
setTimeout(() => { console.log('Done'); }, 2000);
