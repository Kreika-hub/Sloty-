import { execSync } from 'child_process';

try {
  console.log('Staging changes...');
  execSync('git add .', { stdio: 'inherit' });

  console.log('Committing changes...');
  // Escape quotes for cmd/sh execution safely
  execSync('git commit -m "fix: env variables and visitors fallback"', { stdio: 'inherit' });

  console.log('Fetching remote changes...');
  execSync('git fetch', { stdio: 'inherit' });
  
  console.log('Pulling remote changes with rebase...');
  execSync('git pull --rebase', { stdio: 'inherit' });
  
  console.log('Pushing local commits to remote...');
  execSync('git push', { stdio: 'inherit' });
  
  console.log('Git synchronization completed successfully!');
} catch (error) {
  console.error('Error synchronizing with Git:', error.message);
  process.exit(1);
}
