

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const apk = process.argv[2] || 'mobile/android/app/build/outputs/apk/release/app-release.apk';
if (!fs.existsSync(apk)) {
  console.error(`APK nicht gefunden: ${apk}`);
  process.exit(2);
}

const buf = fs.readFileSync(apk);
const size = buf.length;

const names = [];
for (let i = 0; i < buf.length - 4; i++) {
  if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x01 && buf[i + 3] === 0x02) {
    const nameLen = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const commentLen = buf.readUInt16LE(i + 32);
    const start = i + 46;
    if (nameLen > 0 && nameLen < 512 && start + nameLen <= buf.length) {
      names.push(buf.slice(start, start + nameLen).toString('utf8'));
      i = start + nameLen + extraLen + commentLen - 1;
    }
  }
}

const libs = names.filter((n) => n.startsWith('lib/'));
const abis = [...new Set(libs.map((n) => n.split('/')[1]))].sort();
const hasBundle = names.some((n) => n.endsWith('assets/index.android.bundle'));
const hasHermes = libs.some((n) => /hermes/i.test(n));

const bad = [];
if (!abis.includes('arm64-v8a')) bad.push('arm64-v8a fehlt');
if (!abis.includes('armeabi-v7a')) bad.push('armeabi-v7a fehlt');
if (abis.includes('x86') || abis.includes('x86_64')) bad.push('x86-Bibliotheken enthalten');
if (!hasBundle) bad.push('index.android.bundle fehlt');

const secrets = [
  { name: 'Service-Role-JWT', re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Personal-Access-Token', re: /sbp_[a-f0-9]{20,}/ },
  { name: 'OpenRouter-Key', re: /sk-or-v1-[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI-Key', re: /sk-proj-[A-Za-z0-9_-]{20,}/ },
];
const textTargets = names.filter((n) => n.endsWith('index.android.bundle') || n === 'AndroidManifest.xml');
for (const target of textTargets) {
  
  const raw = buf.toString('latin1');
  for (const s of secrets) {
    if (s.re.test(raw)) bad.push(`Geheimnis gefunden: ${s.name}`);
  }
  break;
}

console.log(`APK: ${path.resolve(apk)}`);
console.log(`Größe: ${(size / 1048576).toFixed(1)} MB`);
console.log(`ABIs: ${abis.join(', ') || 'keine'}`);
console.log(`Bundle: ${hasBundle ? 'ja' : 'nein'}${hasHermes ? ' (Hermes)' : ''}`);
console.log(`Dateien im APK: ${names.length}`);
if (bad.length) {
  console.log('FEHLER:');
  for (const b of bad) console.log(' - ' + b);
  process.exit(1);
}
console.log('OK: APK sieht gut aus (ABIs, Bundle, keine Geheimnisse).');
void zlib;
