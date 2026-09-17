/**
 * 3.3.1: Einmal-Skript — entfernt Reste des entfernten „zweiten Gerichts"
 * (unbenutzte Farbtabelle und Abfrage) aus dem Kochmodus.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../mobile/src/screens/CookingScreen.tsx', import.meta.url);
let text = readFileSync(file, 'utf8');

/* Unbenutzte Farbtabelle */
text = text.replace(
  /\/\*\* Farben der Schritt-Kennzeichnung[\s\S]*?void STEP_GROUP_COLORS;\n/,
  '',
);
/* Unbenutzte Abfrage der gespeicherten Rezepte (nur für das zweite Gericht) */
text = text.replace(/\n\s*const savedRecipes = useQuery\(api\.savedRecipes\.list\) as any\[\] \| undefined;\n/, '\n');

writeFileSync(file, text);
console.log('Reste entfernt');
