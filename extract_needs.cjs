const fs = require('fs');

const adminLines = fs.readFileSync('src/modules/admin.js', 'utf8').split('\n');
console.log('--- ADMIN WELCOME MSG ---');
console.log(adminLines.slice(335, 350).join('\n'));

const guardLines = fs.readFileSync('src/modules/guard.js', 'utf8').split(/\r?\n/);

console.log('\n--- GUARD CONFIRM ENTRY ---');
let startConfirm = guardLines.findIndex(l => l.includes('CONFIRM_ENTRY: () => {'));
if (startConfirm !== -1) {
  let open = 0;
  for(let i = startConfirm; i < guardLines.length; i++) {
    console.log(guardLines[i]);
    if (guardLines[i].includes('{')) open += (guardLines[i].match(/\{/g) || []).length;
    if (guardLines[i].includes('}')) open -= (guardLines[i].match(/\}/g) || []).length;
    if (open === 0 && i !== startConfirm) break;
  }
}

console.log('\n--- GUARD PAUSE SHIFT ---');
let startPause = guardLines.findIndex(l => l.includes('PAUSE_SHIFT: () => {'));
if (startPause !== -1) {
  let open = 0;
  for(let i = startPause; i < guardLines.length; i++) {
    console.log(guardLines[i]);
    if (guardLines[i].includes('{')) open += (guardLines[i].match(/\{/g) || []).length;
    if (guardLines[i].includes('}')) open -= (guardLines[i].match(/\}/g) || []).length;
    if (open === 0 && i !== startPause) break;
  }
}

console.log('\n--- GUARD INCIDENT BUTTON ---');
// Let's find incident handling
let incStart = guardLines.findIndex(l => l.includes('Reportar Incidente'));
if (incStart !== -1) {
    console.log(guardLines.slice(Math.max(0, incStart - 20), incStart + 20).join('\n'));
}

console.log('\n--- GUARD INCIDENT SUBMIT BUTTON ---');
let incSubmitStart = guardLines.findIndex(l => l.includes('NUEVO INCIDENTE') || l.includes('data-action="SUBMIT_INCIDENT"'));
if (incSubmitStart !== -1) {
    console.log(guardLines.slice(Math.max(0, incSubmitStart - 20), incSubmitStart + 20).join('\n'));
}

