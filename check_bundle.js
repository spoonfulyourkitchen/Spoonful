const fs = require('fs');
const path = require('path');

const zlib = require('zlib');

const apkPath = 'D:/Spoonful/mobile/android/app/build/outputs/apk/release/app-release.apk';
const buf = fs.readFileSync(apkPath);

const content = buf.toString('binary');

const checks = [
  'tracker-local',
  'water.add',
  'weight.add', 
  'recipe.remove',
  'saved.save',
  'community.like',
  'ai_usage_consume',
  'runPublicQuery',
  'library_count',
  'libraryCount'
];

console.log('APK size:', (buf.length / 1024 / 1024).toFixed(1), 'MB');
console.log('--- String search in raw APK ---');
for (const check of checks) {
  const found = content.includes(check);
  console.log(`${check}: ${found ? 'JA' : 'NEIN'}`);
}

const oldPatterns = [
  'addWaterLog',
  'addWeightLog',
  'deleteRecipe',
  'toggleSaved',
  'toggleFavorite',
  'addComment',
  'incrementLikeCount'
];
console.log('--- Old server-only patterns ---');
for (const check of oldPatterns) {
  const found = content.includes(check);
  console.log(`${check}: ${found ? 'VORHANDEN (alt)' : 'nicht gefunden'}`);
}
