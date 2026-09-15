/**
 * Fügt einen einzelnen i18n-Schlüssel in alle Sprachen von
 * `i18n-texts-extra.ts` ein (kompakte Zeilen).
 *
 * Aufruf: node tools/add-i18n-key.mjs xReadyToServe [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.argv[2] ?? 'xReadyToServe';
const WRITE = process.argv.includes('--write');

const TABLES = {
  xReadyToServe: {
    de: '{title} ist servierfertig.',
    en: '{title} is ready to serve.',
    ar: '{title} جاهز للتقديم.',
    fr: '{title} est pret a servir.',
    es: '{title} esta listo para servir.',
    it: '{title} e pronto da servire.',
    tr: '{title} servise hazir.',
    pt: '{title} esta pronto a servir.',
    nl: '{title} is klaar om te serveren.',
    ru: '{title} готово к подаче.',
  },
  xValidUntil: {
    de: 'gültig bis {date}',
    en: 'valid until {date}',
    ar: 'ساري حتى {date}',
    fr: 'valable jusqu au {date}',
    es: 'valido hasta {date}',
    it: 'valido fino al {date}',
    tr: '{date} tarihine kadar gecerli',
    pt: 'valido ate {date}',
    nl: 'geldig tot {date}',
    ru: 'действует до {date}',
  },
};

const VALUES = TABLES[KEY];

const url = new URL('../mobile/src/lib/i18n-texts-extra.ts', import.meta.url);
const lines = readFileSync(url, 'utf8').split(/\r?\n/);
let changed = 0;

const out = lines.map((line) => {
  const match = /^(\s*)([a-z]{2}): \{ s: \{/.exec(line);
  if (!match || !line.trimEnd().endsWith('} },')) return line;
  const lang = match[2];
  const value = VALUES[lang];
  if (!value || line.includes(`${KEY}:`)) return line;
  changed += 1;
  return `${line.trimEnd().slice(0, -4)}, ${KEY}: '${value}' } },`;
});

if (WRITE) writeFileSync(url, out.join('\n'), 'utf8');
console.log(`${changed} Sprachen ${WRITE ? 'aktualisiert' : 'gefunden'} für ${KEY}`);
