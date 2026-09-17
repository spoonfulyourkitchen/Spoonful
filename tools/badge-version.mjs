/** 3.3.1: „Neu in …" nennt immer die installierte Version (Platzhalter {v}). */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../mobile/src/lib/i18n-212.ts', import.meta.url);
let text = readFileSync(file, 'utf8');
let count = 0;
text = text.replace(/(badge:\s*')([^']*)(2\.1\.2)([^']*)(')/g, (_m, a, before, _ver, after, z) => {
  count += 1;
  return `${a}${before}{v}${after}${z}`;
});
writeFileSync(file, text);
console.log(`${count} Sprachvarianten des Badges auf {v} umgestellt`);
