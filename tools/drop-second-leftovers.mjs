

import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../mobile/src/screens/CookingScreen.tsx', import.meta.url);
let text = readFileSync(file, 'utf8');

text = text.replace(
  /\/\*\* Farben der Schritt-Kennzeichnung[\s\S]*?void STEP_GROUP_COLORS;\n/,
  '',
);

text = text.replace(/\n\s*const savedRecipes = useQuery\(api\.savedRecipes\.list\) as any\[\] \| undefined;\n/, '\n');

writeFileSync(file, text);
console.log('Reste entfernt');
