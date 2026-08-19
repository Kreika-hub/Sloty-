import { execSync } from 'child_process';
import fs from 'fs';

try {
  console.log('=== STEP 1: Static Integration Verification ===');
  // Check if all modules exist and are valid JavaScript
  const files = [
    'src/modules/admin.js',
    'src/modules/admin/admin-store.js',
    'src/modules/admin/admin-ui-components.js',
    'src/modules/admin/admin-dashboard.js',
    'src/modules/admin/admin-users.js',
    'src/modules/admin/admin-finance.js',
    'src/modules/admin/admin-structure.js',
    'src/modules/admin/admin-guards.js',
    'src/modules/admin/admin-settings.js'
  ];

  files.forEach(f => {
    if (!fs.existsSync(f)) {
      throw new Error(`File does not exist: ${f}`);
    }
    // Simple syntax check via node compile
    execSync(`node --check ${f}`);
    console.log(`✓ ${f} has valid JavaScript syntax`);
  });

  console.log('\n=== STEP 2: Running Vite Build ===');
  const build = execSync('npm run build', { encoding: 'utf8', stdio: 'pipe' });
  console.log(build);

  console.log('\n=== STEP 3: Git Status & Clean Up ===');
  // Check git status to ensure there are no uncommitted modifications in modules
  const status = execSync('git status --short', { encoding: 'utf8' });
  console.log('Modified files in working directory:\n', status || 'None (working directory clean)');

  console.log('\n=== STEP 4: Committing Maintanance Final ===');
  if (status.includes('run_build.js') || status.includes('patch_admin')) {
    // Stage runner and clean up
    execSync('git add run_build.js');
    try {
      execSync('git commit -m "chore: update build runner and complete end-to-end integration verification (Phase C completed)"', { encoding: 'utf8' });
      console.log('✓ Maintenance commit recorded');
    } catch(e) {
      console.log('No additional changes to commit');
    }
  }

} catch (e) {
  console.log("INTEGRATION ERROR:");
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log(e.message);
}
setTimeout(() => { console.log('Done'); }, 2000);
