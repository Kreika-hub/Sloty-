const fs = require('fs');

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);

const sections = [
  { name: 'Variables', start: 15, end: 40 },
  { name: 'Actions part 1', start: 320, end: 395 },
  { name: 'Actions part 2 / Exit rate', start: 495, end: 515 },
  { name: 'Actions part 3 / Exit rate', start: 560, end: 575 },
  { name: 'renderExitForm and renderPaymentForm', start: 1370, end: 1445 },
  { name: 'renderSubPaymentForm', start: 1490, end: 1575 },
  { name: 'Closure summary', start: 1600, end: 1630 }
];

sections.forEach(s => {
  console.log(`\n--- SECTION: ${s.name} (Lines ${s.start}-${s.end}) ---`);
  for (let i = s.start - 1; i < s.end; i++) {
    if (lines[i] !== undefined) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
});
