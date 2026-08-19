import { execSync } from 'child_process';
try {
  console.log('=== STEP 1: Static Module Verification ===');
  const files = [
    'src/modules/admin/admin-store.js',
    'src/modules/admin.js',
    'src/modules/admin/admin-users.js',
    'src/modules/admin/admin-finance.js',
    'src/modules/master.js',
    'src/modules/onboarding.js',
    'src/main.js'
  ];

  files.forEach(f => {
    execSync(`node --check ${f}`);
    console.log(`✓ ${f} is valid JavaScript`);
  });

  console.log('\n=== STEP 2: Running Vite Build ===');
  const build = execSync('npm run build', { encoding: 'utf8' });
  console.log(build);

  console.log('\n=== STEP 3: Git Status & Commit ===');
  execSync('git add src/ run_build.js package.json');
  const commitRes = execSync('git commit -m "feat: complete SaaS finance suite, expenses with net balance, dynamic feature flags, and resident debt tracking"', { encoding: 'utf8' });
  console.log(commitRes);

  console.log('\n=== STEP 4: Git Push to Remote ===');
  const pushRes = execSync('git push origin main', { encoding: 'utf8' });
  console.log(pushRes);

  const finalStatus = execSync('git status -uno', { encoding: 'utf8' });
  console.log('Final Status:\n', finalStatus);
} catch (e) {
  console.log('Verification Error / Output:');
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log(e.message);
}
setTimeout(() => { console.log('Done'); }, 2000);
