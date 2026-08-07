const fs = require('fs');
const path = './src/modules/admin.js';
let code = fs.readFileSync(path, 'utf8');

// Normalizing typography scale
const replaces = [
  ['0.45rem', '0.6rem'],
  ['0.5rem;', '0.6rem;'],
  ['0.5rem"', '0.6rem"'],
  ['0.55rem', '0.6rem'],
  ['0.65rem', '0.7rem'],
  ['0.75rem', '0.8rem'],
  ['0.85rem', '0.9rem'],
  ['0.95rem', '1.0rem'],
];

let changedCount = 0;
for (const [oldVal, newVal] of replaces) {
  const parts = code.split(oldVal);
  if (parts.length > 1) {
    changedCount += (parts.length - 1);
    code = parts.join(newVal);
  }
}

fs.writeFileSync(path, code);
console.log(`Typography normalized. Made ${changedCount} replacements.`);
