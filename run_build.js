import { execSync } from 'child_process';
try {
  console.log('=== STEP 1: Git Add Graphify & Build ===');
  // Add graphify files and run_build script
  console.log(execSync('git add run_build.js graphify-out/', { encoding: 'utf8' }));
  
  console.log('=== STEP 2: Git Commit ===');
  console.log(execSync('git commit -m "chore: update build runner, clean up workspace, and refresh graphify knowledge graph"', { encoding: 'utf8' }));
} catch (e) {
  console.log("GIT ERROR:");
  console.log(e.stdout || '');
  console.log(e.stderr || '');
  console.log(e.message);
}
setTimeout(() => { console.log('Done'); }, 2000);
