const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);

console.log('Lines 1-15 of guard.js:');
for (let i = 0; i < 15; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
