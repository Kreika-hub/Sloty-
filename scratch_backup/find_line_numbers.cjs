const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8').replace(/\r\n/g, '\n');
const lines = content.split('\n');

console.log('--- FINDING FUNCTIONS ---');
lines.forEach((line, idx) => {
  if (line.includes('const renderPaymentForm')) {
    console.log(`renderPaymentForm starts at line ${idx + 1}`);
  }
  if (line.includes('const renderSubPaymentForm')) {
    console.log(`renderSubPaymentForm starts at line ${idx + 1}`);
  }
  if (line.includes('const renderClosureSummary')) {
    console.log(`renderClosureSummary starts at line ${idx + 1}`);
  }
});
