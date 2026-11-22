
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../mobile/src/screens/ShoppingScreen.tsx', import.meta.url);
const lines = readFileSync(file, 'utf8').split('\n');
const header = [
  '/**',
  ' * 3.2.0/3.3.0: Einkaufsliste — bewusst einfach und schnell.',
  ' *',
  ' *   * oben eingeben (oder über "Add to shopping list" bei einem Rezept füllen)',
  ' *   * Liste nach Rezept gruppiert; neben jeder Gruppe steht "Zum Haushalt"',
  ' *   * pro Haushalt höchstens ZWEI Listen; danach kommt ein Hinweis',
  ' *   * keine Filter-Chips, keine Extras, kein Rezept-Import-Knopf',
  ' *',
  ' * 3.3.0: Die Anzeige kommt aus dem lokalen Speicher (sofort, offline) und jede',
  ' * Zeile ist memoisiert, damit das Abhaken nur die betroffene Zeile neu zeichnet.',
  ' */',
];
const rest = lines.slice(lines.findIndex((l) => l.startsWith("import React,")));
rest[0] = "import React, { useCallback, useEffect, useMemo, useState } from 'react';";
writeFileSync(file, [...header, ...rest].join('\n'));
console.log('Kopf + Import korrigiert');
