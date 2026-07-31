const fs = require('fs');
const [,, file, start, end] = process.argv;
if (!file) {
  console.log('Usage: node read_file.js <file_path> [start_line] [end_line]');
  process.exit(1);
}
try {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const startIdx = start ? parseInt(start) : 1;
  const endIdx = end ? parseInt(end) : lines.length;
  for (let i = startIdx; i <= Math.min(endIdx, lines.length); i++) {
    console.log(`${i}: ${lines[i-1]}`);
  }
} catch (e) {
  console.error('Error reading file:', e.message);
}

