/**
 * Findet feste Texte in der Oberfläche (die eigentlich i18n-Tags sein müssten).
 *
 * Aufruf:  node tools/find-hardcoded.mjs
 *
 * Gesucht wird nach:
 *  - JSX-Text zwischen Tags ("<Text>Hallo Welt</Text>")
 *  - Attributen wie title="…", message="…", placeholder="…", label="…",
 *    accessibilityLabel="…" mit festem Text
 *  - Alert.alert('…') mit festem Text als erster Wert
 *
 * Daten-Dateien (Übersetzungen selbst, Rezept-Kataloge, Prompts) werden
 * übersprungen, sonst meldet das Skript hunderttausende Treffer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../mobile/src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SKIP = /(i18n|recipe-translate|recipe-catalog|coach-tips|step-meta|fonts|countries|seasonal|foodFacts|video-recipe|deals|admin-login|supabase|convex-auth|api\.ts|theme)/i;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const looksLikeText = (value) => {
  const v = value.trim();
  if (v.length < 3) return false;
  if (!/[A-Za-z]{3}/.test(v)) return false; // braucht echte Wörter
  if (/^https?:|^mailto:|^[\w.+-]+@[\w-]+\.\w+$/.test(v)) return false; // URL/E-Mail
  if (/^[#0-9a-fA-F()%,.\s-]+$/.test(v)) return false; // Farben/Zahlen/Styles
  if (/^[a-z][a-zA-Z0-9]*$/.test(v)) return false; // camelCase-Schlüssel
  if (/^(\/|\?|&)/.test(v)) return false;
  return true;
};

const hits = [];

for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP.test(rel)) continue;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const at = `${rel}:${index + 1}`;
    if (/\bt\(|t\(|pick\(|translate\(/.test(line) && !/(title|message|subtitle|label|placeholder|accessibilityLabel)="[A-Za-z]/.test(line)) {
      // Zeile benutzt schon i18n — nur JSX-Text unten prüfen
    }
    // 1) Attribute mit festem Text
    const attr = /(title|message|subtitle|label|placeholder|accessibilityLabel)="([^"{][^"]{2,})"/g;
    let m;
    while ((m = attr.exec(line))) {
      if (looksLikeText(m[2])) hits.push({ at, kind: m[1], text: m[2].trim(), line: line.trim() });
    }
    // 2) Alert.alert mit festem Text
    const alert = /Alert\.alert\(\s*'([^']{3,})'|Alert\.alert\(\s*"([^"]{3,})"/.exec(line);
    if (alert) {
      const text = alert[1] ?? alert[2];
      if (looksLikeText(text)) hits.push({ at, kind: 'Alert', text, line: line.trim() });
    }
    // 3) JSX-Text zwischen Tags
    const jsx = />([^<>{}\n]{4,80})</g;
    while ((m = jsx.exec(line))) {
      const value = m[1].replace(/\s+/g, ' ').trim();
      if (looksLikeText(value)) hits.push({ at, kind: 'JSX', text: value, line: line.trim() });
    }
  });
}

const unique = new Map();
for (const hit of hits) {
  const key = `${hit.text}`;
  if (!unique.has(key)) unique.set(key, hit);
}

console.log(`Feste Texte gefunden: ${hits.length} Stellen, ${unique.size} verschiedene Texte\n`);
for (const hit of hits) {
  console.log(`${hit.at} [${hit.kind}] ${hit.text}`);
}
console.log(`\n--- verschiedene Texte (${unique.size}) ---`);
for (const [text, hit] of unique) console.log(`- ${text}   (${hit.at})`);
