

import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../mobile/src', import.meta.url).pathname.replace(/^\
const KAV = "<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function tagEnd(source, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

let touchedFiles = 0;
let wrapped = 0;

for (const file of walk(ROOT)) {
  let source = readFileSync(file, 'utf8');
  if (!source.includes('<Modal') || !source.includes('TextInput')) continue;

  let index = source.indexOf('<Modal');
  let changed = false;
  while (index !== -1) {
    const open = tagEnd(source, index);
    if (open === -1) break;
    if (source.slice(open, open + 40).includes('KeyboardAvoidingView')) {
      index = source.indexOf('<Modal', open);
      continue;
    }
    
    let depth = 1;
    let cursor = open + 1;
    let close = -1;
    while (depth > 0) {
      const nextOpen = source.indexOf('<Modal', cursor);
      const nextClose = source.indexOf('</Modal>', cursor);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        cursor = nextOpen + 6;
      } else {
        depth -= 1;
        if (depth === 0) close = nextClose;
        cursor = nextClose + 8;
      }
    }
    if (close === -1) break;

    const indent = ' '.repeat(Math.max(0, source.lastIndexOf('\n', index) + 1 === index ? 0 : 0) + 8);
    const inner = source.slice(open + 1, close);
    const shifted = inner
      .split('\n')
      .map((line, i) => (i === 0 || line.trim() === '' ? line : `  ${line}`))
      .join('\n');
    source = `${source.slice(0, open + 1)}\n${indent}${KAV}${shifted}\n${indent}</KeyboardAvoidingView>${source.slice(close)}`;
    wrapped += 1;
    changed = true;
    index = source.indexOf('<Modal', open + 1);
  }

  if (!changed) continue;

  
  const importLine = /import \{([^}]*)\} from 'react-native';/.exec(source);
  if (importLine) {
    const names = importLine[1].split(',').map((n) => n.trim()).filter(Boolean);
    for (const need of ['KeyboardAvoidingView', 'Platform']) {
      if (!names.includes(need)) names.push(need);
    }
    names.sort((a, b) => a.localeCompare(b));
    source = source.replace(importLine[0], `import {\n  ${names.join(',\n  ')},\n} from 'react-native';`);
  }

  writeFileSync(file, source);
  touchedFiles += 1;
}

console.log(`${wrapped} Modals in ${touchedFiles} Dateien umgebaut`);
