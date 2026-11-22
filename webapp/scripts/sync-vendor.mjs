/**
 * Copies browser assets that come from the React Native project so a fresh
 * `npm install && npm run build` in webapp/ works on its own.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const mobile = path.resolve(root, '..', 'mobile');

function firstExisting(paths) {
  return paths.find((candidate) => existsSync(candidate));
}

const zxing = firstExisting([
  path.join(root, 'node_modules', '@zxing', 'library', 'umd', 'index.min.js'),
  path.join(mobile, 'node_modules', '@zxing', 'library', 'umd', 'index.min.js'),
]);
const vendorDir = path.join(root, 'public', 'vendor');
mkdirSync(vendorDir, { recursive: true });
if (zxing) {
  copyFileSync(zxing, path.join(vendorDir, 'zxing.min.js'));
} else if (!existsSync(path.join(vendorDir, 'zxing.min.js'))) {
  console.warn('[spoonful] zxing UMD bundle not found - barcode scanning will not work.');
}

// The app icon (the mark on cream) is committed in public/ and must not be
// replaced by the transparent wordmark, which only sits inside the app.
