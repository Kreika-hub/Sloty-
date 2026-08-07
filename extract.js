const fs = require('fs');
const content = fs.readFileSync('src/modules/guard.js', 'utf8');

// Write pieces to a text file
const lines = content.split(/\r?\n/);
let output = '';

output += '=== TOTAL LINES: ' + lines.length + ' ===\n\n';

function extractRange(startStr, endStr, title) {
  output += `\n\n--- ${title} ---\n`;
  let found = false;
  lines.forEach((line, idx) => {
    if (line.includes(startStr)) {
      found = true;
      for (let i = Math.max(0, idx - 10); i < Math.min(lines.length, idx + 80); i++) {
        output += `${i + 1}: ${lines[i]}\n`;
      }
    }
  });
  if (!found) output += `[NOT FOUND ${startStr}]\n`;
}

extractRange('PAUSE_SHIFT', 'PAUSE_SHIFT', 'PAUSE_SHIFT ACTION');
extractRange('CONFIRM_ENTRY', 'CONFIRM_ENTRY', 'CONFIRM_ENTRY ACTION');
extractRange('REPORT_INCIDENT', 'REPORT_INCIDENT', 'REPORT_INCIDENT ACTION');
extractRange('SUBMIT_INCIDENT', 'SUBMIT_INCIDENT', 'SUBMIT_INCIDENT ACTION');
extractRange('initGuard', 'initGuard', 'INIT GUARD FUNCTION');
extractRange('pausedAt', 'pausedAt', 'PAUSED AT');
extractRange('renderShiftStatus', 'renderShiftStatus', 'RENDER SHIFT STATUS');
extractRange('resume_shift', 'RESUME_SHIFT', 'RESUME SHIFT');

fs.writeFileSync('extracted_guard.txt', output, 'utf8');
console.log('Done extracting!');
