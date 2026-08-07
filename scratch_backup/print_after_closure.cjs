const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8').replace(/\r\n/g, '\n');
const lines = content.split('\n');

console.log('Lines 1045-1065:');
for (let i = 1044; i < 1065; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
