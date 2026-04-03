const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test-output-all.json', 'utf8'));
const target = data.filter(d => d.messaging.some(m => ['9', '4', '2'].includes(m.value)));
fs.writeFileSync('results.md', JSON.stringify(target, null, 2));
console.log('Done.');
