const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);

console.log('Lines 750-950 of guard.js:');
for (let i = 749; i < 950; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
