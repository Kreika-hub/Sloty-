import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// ── Step 0: Copy favicon/apple-touch-icon from PWA 192x192 icon ───
const srcIcon = 'public/icons/pwa-192x192.png';
if (existsSync(srcIcon)) {
  mkdirSync('public/icons', { recursive: true });
  copyFileSync(srcIcon, 'public/favicon.ico');
  copyFileSync(srcIcon, 'public/favicon.png');
  copyFileSync(srcIcon, 'public/apple-touch-icon.png');
  copyFileSync(srcIcon, 'public/icons/apple-touch-icon-180x180.png');
  copyFileSync(srcIcon, 'public/icons/favicon.ico');
  console.log('✓ Favicons copied from pwa-192x192.png');
}

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
