const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);

console.log('Lines 220-310 of guard.js:');
for (let i = 219; i < 310; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
