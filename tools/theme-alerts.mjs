/**
 * 3.3.0: Codemod — ersetzt `Alert` aus 'react-native' durch den gestalteten
 * Wrapper `lib/alert`, damit alle Meldungen in der App im Theme-Design kommen.
 * Läuft einmal über alle Screens/Komponenten.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = new URL('../mobile/src', import.meta.url).pathname.replace(/^\//, '');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

let touched = 0;

for (const file of walk(SRC)) {
  let source = readFileSync(file, 'utf8');
  if (file.endsWith(`${sep}alert.ts`)) continue;
  /* Alert aus react-native importieren? */
  const importRe = /import\s*\{([\s\S]*?)\}\s*from\s*'react-native';/;
  const match = importRe.exec(source);
  if (!match) continue;
  const names = match[1]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  if (!names.includes('Alert')) continue;

  const kept = names.filter((n) => n !== 'Alert');
  const isMultiline = match[0].includes('\n');
  const replacement = isMultiline
    ? `import {\n  ${kept.join(',\n  ')},\n} from 'react-native';`
    : `import { ${kept.join(', ')} } from 'react-native';`;
  source = source.replace(match[0], replacement);

  /* Pfad zum Wrapper */
  const depth = relative(SRC, file).split(sep).length - 1;
  const prefix = depth ? '../'.repeat(depth) : './';
  const wrapperPath = `${prefix}lib/alert`;
  if (!source.includes(wrapperPath)) {
    /* direkt nach dem react-native-Import einfügen */
    const insertAt = source.indexOf(replacement) + replacement.length;
    source = `${source.slice(0, insertAt)}\n/* 3.3.0: Meldungen im App-Design statt System-Dialog */\nimport { Alert } from '${wrapperPath}';${source.slice(insertAt)}`;
  }
  writeFileSync(file, source);
  touched += 1;
}

console.log(`${touched} Dateien auf den gestalteten Alert umgestellt`);
