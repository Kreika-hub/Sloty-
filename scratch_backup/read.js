const fs = require('fs');
const filePath = 'src/modules/guard.js';

if (!fs.existsSync(filePath)) {
  console.log('File does not exist');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const start = parseInt(process.argv[2]) || 320;
const end = parseInt(process.argv[3]) || 395;

for (let i = start; i <= end; i++) {
  if (lines[i - 1] !== undefined) {
    console.log(`${i}: ${lines[i - 1]}`);
  }
}
