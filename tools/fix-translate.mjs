

import { readFileSync, writeFileSync } from 'node:fs';

const BASE = new URL('../mobile/src/screens/', import.meta.url);
const WRITE = process.argv.includes('--write');
const FILES = ['AuthScreen.tsx', 'ResetPasswordScreen.tsx', 'ThemeScreen.tsx'];

let count = 0;
for (const name of FILES) {
  const url = new URL(name, BASE);
  let text = readFileSync(url, 'utf8');
  const before = text.split("t('s.x").length - 1;
  if (before === 0) {
    console.log(`${name}: nichts zu tun`);
    continue;
  }
  text = text.split("t('s.x").join("translate('s.x");
  if (!text.includes("from '../lib/i18n'")) {
    text = text.replace(/^import React/m, "import { translate } from '../lib/i18n';\nimport React");
  }
  if (WRITE) writeFileSync(url, text, 'utf8');
  count += before;
  console.log(`${name}: ${before} Stellen umgestellt`);
}
console.log(`\n${count} Stellen ${WRITE ? 'geschrieben' : 'gefunden'}.`);
