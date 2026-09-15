/**
 * Prüft, ob die Version überall gleich ist (Punkt 95 der Stabilitäts-Liste).
 *
 * Aufruf:  node tools/check-version.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const gradle = read('mobile/android/app/build.gradle');
const gradleVersion = /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? '(fehlt)';
const gradleCode = /versionCode\s+(\d+)/.exec(gradle)?.[1] ?? '(fehlt)';
const config = read('mobile/src/config.ts');
const appVersion = /APP_VERSION\s*=\s*'([^']+)'/.exec(config)?.[1] ?? '(fehlt)';
const notes = `RELEASE_NOTES-v${gradleVersion}.md`;

const checks = [
  ['build.gradle versionName == config.ts APP_VERSION', gradleVersion === appVersion],
  ['Versions-Notizen vorhanden', existsSync(new URL(`../${notes}`, import.meta.url))],
  ['versionCode ist eine Zahl', /^\d+$/.test(gradleCode)],
];

console.log(`versionName   : ${gradleVersion}`);
console.log(`versionCode   : ${gradleCode}`);
console.log(`APP_VERSION   : ${appVersion}`);
console.log(`Notizen       : ${notes}\n`);

let ok = true;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'OK  ' : 'FEHL'} ${name}`);
  if (!passed) ok = false;
}
process.exit(ok ? 0 : 1);
