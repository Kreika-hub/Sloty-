const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);

console.log('Searching for BCV-related terms...');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('rate') || line.toLowerCase().includes('bcv') || line.toLowerCase().includes('exchange') || line.toLowerCase().includes('dolar') || line.toLowerCase().includes('bolivar')) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
