const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);

console.log('Total lines:', lines.length);

function findText(pattern) {
  console.log(`\nSearching for pattern: "${pattern}"`);
  lines.forEach((line, idx) => {
    if (line.includes(pattern)) {
      console.log(`Match at line ${idx + 1}: ${line}`);
    }
  });
}

findText('SUBMIT_SUB_PAYMENT');
findText('renderSubPaymentForm');
findText('renderPaymentForm');
findText('renderClosureSummary');
findText('getExchangeRate');
findText('subPaymentMethod');
findText('bs-equivalent');
