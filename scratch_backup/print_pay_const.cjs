const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);

console.log('Searching for "PAY" definition...');
lines.forEach((line, idx) => {
  if (line.includes('const PAY')) {
    console.log(`L${idx + 1}: ${line}`);
    // Print 10 lines after
    for (let j = 1; j <= 10; j++) {
      console.log(`  L${idx + 1 + j}: ${lines[idx + j]}`);
    }
  }
});
