import { execSync } from 'child_process';

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (out) console.log(out.trim());
  } catch (err) {
    if (err.stdout) console.log(err.stdout.toString().trim());
    if (err.stderr) console.log(err.stderr.toString().trim());
    if (!err.stdout && !err.stderr) console.log(err.message);
  }
};

run('node scratch/test_db_phase1.js');
run('node C:/Users/HP/.gemini/antigravity/brain/4ee8b4d6-e313-4374-87b2-20c4dad48e0f/scratch/test_phase2_suite.js');
run('node C:/Users/HP/.gemini/antigravity/brain/4ee8b4d6-e313-4374-87b2-20c4dad48e0f/scratch/test_phase3_suite.js');
run('node --check src/db.js');
run('npm run build');
run('git status');
