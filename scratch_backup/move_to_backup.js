const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'scratch_backup');

const TARGET_FILES = [
  'patch_guard.py',
  'commit.bat',
  'commit_new.bat',
  'debug.cjs',
  'debug_encoding.txt',
  'debug_git.bat',
  'debug_patch_guard.txt',
  'debug_patch_main.txt',
  'extract.js',
  'extract_needs.cjs',
  'extract_specifics.cjs',
  'find_line_numbers.cjs',
  'fix_and_push.bat',
  'git_debug.js',
  'git_helper.bat',
  'git_push.bat',
  'git_save.bat',
  'git_sync.js',
  'guard1.txt',
  'guard2.txt',
  'modify_guard.cjs',
  'modify_guard.js',
  'modify_guard_sections.cjs',
  'msg.txt',
  'normalize-fonts.js',
  'patch_guard.js',
  'patch_recent_movs.js',
  'print_actions_sub.cjs',
  'print_after_closure.cjs',
  'print_exit_amount_block.cjs',
  'print_exit_and_payment_forms.cjs',
  'print_exit_form_top.cjs',
  'print_head.cjs',
  'print_pay_const.cjs',
  'print_rate_usage.cjs',
  'print_raw_sub_form.cjs',
  'print_sub_and_closure.cjs',
  'read.js',
  'read_file.js',
  'read_sections.cjs',
  'read_sections.js',
  'rebase_push.bat',
  'run_final.bat',
  'search_lines.cjs',
  'sync.bat',
  'sync_guard.bat'
];

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
  console.log('Created directory:', BACKUP_DIR);
}

for (const file of TARGET_FILES) {
  const oldPath = path.join(__dirname, file);
  const newPath = path.join(BACKUP_DIR, file);

  if (fs.existsSync(oldPath)) {
    try {
      fs.renameSync(oldPath, newPath);
      console.log(`Moved successfully: ${file} -> scratch_backup/`);
    } catch (err) {
      console.error(`Failed to move ${file}:`, err.message);
    }
  }
}
console.log('All targeted temporary files processed.');

try {
  fs.unlinkSync(__filename);
  console.log('Self-deleted move_to_backup.js successfully!');
} catch (err) {}
