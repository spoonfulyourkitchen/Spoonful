/**
 * 3.2.3: einmaliges Hilfsskript — entfernt die MONSTR-Schritte aus der Tour,
 * nachdem die MONSTR-Seite wieder aus der App genommen wurde.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../mobile/src/lib/tutorial-steps.ts', import.meta.url);
const before = readFileSync(file, 'utf8');
let text = before;
text = text.replace(/\{\r?\n\s*id: 'nav-monstr',[\s\S]*?\r?\n  \},\r?\n/g, '');
text = text.replace(/\{\r?\n\s*id: 'monstr-load',[\s\S]*?\r?\n  \},\r?\n/g, '');
text = text.replace(/\* {2}tut-tab-Tracker, tut-tab-Community, tut-tab-Household, tut-tab-Monstr\r?\n/, '*  tut-tab-Tracker, tut-tab-Community, tut-tab-Household\n');
text = text.replace(/ \* {2}tut-mon-load[\s\S]*?MonstrScreen\)\r?\n/, '');
writeFileSync(file, text);
console.log(`-${before.length - text.length} Zeichen, monstr-Schritte übrig: ${(text.match(/monstr/gi) ?? []).length}`);
