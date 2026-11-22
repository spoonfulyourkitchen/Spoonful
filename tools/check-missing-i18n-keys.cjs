const fs = require('fs');
const path = require('path');
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
};
walk('mobile/src');
files.push('mobile/App.tsx');
const used = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /\b(?:t|tr|translate)\(\s*'([A-Za-z0-9_.]+)'/g;
  let m;
  while ((m = re.exec(s))) used.add(m[1]);
}
const dictFiles = fs
  .readdirSync('mobile/src/lib')
  .filter((n) => n.startsWith('i18n'))
  .map((n) => path.join('mobile/src/lib', n));
let blob = '';
for (const f of dictFiles) blob += fs.readFileSync(f, 'utf8');
const missing = [...used].filter((k) => {
  const leaf = k.split('.').pop();
  const esc = leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !new RegExp('(^|[^A-Za-z0-9_])' + esc + '\\s*:').test(blob);
});
console.log('USED KEYS:', used.size);
console.log('MISSING KEYS:', missing.length);
console.log(missing.join('\n'));
