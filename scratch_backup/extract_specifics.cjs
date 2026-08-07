const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);
let out = '';

function logBlock(title, startFunc, lineCount) {
  out += `\n\n===========================================\n`;
  out += `=== BLOCK: ${title} ===\n`;
  out += `===========================================\n`;
  const idx = lines.findIndex(l => l.includes(startFunc));
  if (idx === -1) {
    out += `[NOT FOUND MATCHING "${startFunc}"]\n`;
    return;
  }
  const start = Math.max(0, idx - 15);
  const end = Math.min(lines.length - 1, idx + lineCount);
  for (let i = start; i <= end; i++) {
    out += `L${i + 1}: ${lines[i]}\n`;
  }
}

// Let's add multiple blocks
logBlock('PAUSE_SHIFT', 'PAUSE_SHIFT', 60);
logBlock('CONFIRM_ENTRY definition', 'CONFIRM_ENTRY:', 60);
logBlock('CONFIRM_ENTRY assignment / usage', 'btnConfirm', 40);
logBlock('REPORT_INCIDENT definition', 'REPORT_INCIDENT:', 80);
logBlock('REPORT_INCIDENT submit button', 'SUBMIT_INCIDENT', 40);
logBlock('NEW ENTRY Form rendering', 'NUEVO INGRESO', 80);
logBlock('window.handleAction', 'window.handleAction =', 40);

fs.writeFileSync('extracted_specifics.txt', out, 'utf8');
console.log('Saved to extracted_specifics.txt');
