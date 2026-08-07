import fs from 'fs';

const content = fs.readFileSync('src/modules/guard.js', 'utf8');
const lines = content.split(/\r?\n/);

const sections = [
  { name: 'renderClosureSummary Definition (Lines 1570-1640)', start: 1570, end: 1640 }
];

sections.forEach(s => {
  console.log(`\n--- SECTION: ${s.name} ---`);
  for (let i = s.start - 1; i < s.end; i++) {
    if (lines[i] !== undefined) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
});
