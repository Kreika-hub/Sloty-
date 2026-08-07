const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8').replace(/\r\n/g, '\n');

// Let's print some lines to see how they look
console.log('--- raw renderPaymentForm start ---');
const idxPay = content.indexOf('const renderPaymentForm');
if (idxPay !== -1) {
  console.log(content.substring(idxPay, idxPay + 400));
} else {
  console.log('not found');
}

console.log('--- raw renderSubPaymentForm start ---');
const idxSub = content.indexOf('const renderSubPaymentForm');
if (idxSub !== -1) {
  console.log(content.substring(idxSub, idxSub + 400));
} else {
  console.log('not found');
}

console.log('--- raw renderClosureSummary start ---');
const idxCl = content.indexOf('const renderClosureSummary');
if (idxCl !== -1) {
  // search for RECAUDO TOTAL
  const idxRt = content.indexOf('RECAUDO TOTAL', idxCl);
  if (idxRt !== -1) {
    console.log(content.substring(idxRt - 200, idxRt + 200));
  }
}
