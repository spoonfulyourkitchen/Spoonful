

import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const gradle = read('mobile/android/app/build.gradle');
const gradleVersion = /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? '(fehlt)';
const gradleCode = /versionCode\s+(\d+)/.exec(gradle)?.[1] ?? '(fehlt)';
const config = read('mobile/src/config.ts');
const appVersion = /APP_VERSION\s*=\s*'([^']+)'/.exec(config)?.[1] ?? '(fehlt)';
const notes = `RELEASE_NOTES-v${gradleVersion}.md`;
// Die Notizen liegen je nach Ablage im Repo-Root oder im Ordner `Realeses`.
const notePaths = [notes, `Realeses/${notes}`, `Releases/${notes}`];
const notesFound = notePaths.find((p) => existsSync(new URL(`../${p}`, import.meta.url)));

const checks = [
  ['build.gradle versionName == config.ts APP_VERSION', gradleVersion === appVersion],
  ['Versions-Notizen vorhanden', !!notesFound],
  ['versionCode ist eine Zahl', /^\d+$/.test(gradleCode)],
];

console.log(`versionName   : ${gradleVersion}`);
console.log(`versionCode   : ${gradleCode}`);
console.log(`APP_VERSION   : ${appVersion}`);
console.log(`Notizen       : ${notesFound ?? notes + ' (fehlt)'}\n`);

let ok = true;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'OK  ' : 'FEHL'} ${name}`);
  if (!passed) ok = false;
}
process.exit(ok ? 0 : 1);
