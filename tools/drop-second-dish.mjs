/**
 * 3.3.1: Einmal-Skript — entfernt das Feature „zweites Gericht parallel kochen"
 * vollständig aus dem Kochmodus (Zustand, Laden/Speichern, Auswahl-Popup).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../mobile/src/screens/CookingScreen.tsx', import.meta.url);
const lines = readFileSync(file, 'utf8').split('\n');
const out = [];
let removed = 0;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  /* 1) Auswahl-Popup (Modal bis zum passenden </Modal>) */
  if (/zweites Gericht wählen/.test(line)) {
    let depth = 0;
    let j = i;
    for (; j < lines.length; j += 1) {
      const open = (lines[j].match(/<Modal\b/g) ?? []).length;
      const close = (lines[j].match(/<\/Modal>/g) ?? []).length;
      depth += open - close;
      if (depth === 0 && close > 0 && j > i) {
        j += 1;
        break;
      }
    }
    removed += j - i;
    i = j - 1;
    continue;
  }
  /* 2) Einzelne Zeilen rund um das Feature */
  if (
    /const \[pickerOpen, setPickerOpen\] = useState/.test(line) ||
    /const \[second, setSecond\] = useState/.test(line) ||
    /zweites Gericht im Parallel-Modus/.test(line) ||
    /loadSecondRecipe|saveSecondRecipe/.test(line) ||
    /const startSecond = /.test(line) ||
    /const advanceSecond = /.test(line) ||
    /const dropSecond = /.test(line) ||
    /const \[savedRecipes, setSavedRecipes\]/.test(line)
  ) {
    /* Bei Funktionsblöcken: bis zur schließenden Zeile überspringen */
    if (/=> \{$|\(r: any\) => \{|\(delta: number\) => \{|\(\) => \{/.test(line) || /^const \w+ = \(.*\) => \{$/.test(line)) {
      let j = i;
      let depth = 0;
      for (; j < lines.length; j += 1) {
        depth += (lines[j].match(/\{/g) ?? []).length - (lines[j].match(/\}/g) ?? []).length;
        if (depth <= 0 && j > i) break;
      }
      removed += j - i + 1;
      i = j;
      continue;
    }
    removed += 1;
    continue;
  }
  out.push(line);
}

writeFileSync(file, out.join('\n'));
console.log(`${removed} Zeilen rund um „zweites Gericht" entfernt`);
