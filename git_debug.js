import { execSync } from 'child_process';

try {
  console.log('--- GIT REMOTE ---');
  execSync('git remote -v', { stdio: 'inherit' });

  console.log('\n--- GIT BRANCH ---');
  execSync('git branch -a', { stdio: 'inherit' });

  console.log('\n--- LAST COMMIT INFO ---');
  execSync('git show --stat HEAD', { stdio: 'inherit' });

  console.log('\n--- LAST COMMIT DIFF FOR GUARD.JS ---');
  execSync('git diff HEAD~1 HEAD -- src/modules/guard.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error debugging Git:', error.message);
}
