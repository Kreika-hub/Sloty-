const fs = require('fs');
const content = fs.readFileSync('src/modules/admin.js', 'utf8');
const lines = content.split('\n');
for (let i = 1480; i <= 1500; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}
