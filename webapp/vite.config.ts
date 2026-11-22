import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every build gets its own id. It is written into builds as __SPOONFUL_BUILD__
 * and served next to them as version.json; the running app compares both and
 * reloads when a newer build is online.
 */
const buildId =
  process.env.SPOONFUL_BUILD_ID || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

function buildVersionPlugin(id: string): Plugin {
  return {
    name: 'spoonful-build-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: id }),
      });
    },
  };
}
const r = (...parts: string[]) => path.resolve(here, ...parts);
const shim = (file: string) => r('src', 'shims', file);

/**
 * Packages that webapp/ installs itself. They are resolved from webapp/node_modules
even when the importing file lives in mobile/src, so the web app does not need
mobile/node_modules at all.
 */
const WEBAPP_PACKAGES = [
  '@react-navigation/native',
  '@react-navigation/bottom-tabs',
  '@react-navigation/native-stack',
  '@supabase/supabase-js',
  'react-native-screens',
];

function webappPackages(): Plugin {
  return {
    name: 'spoonful-webapp-packages',
    enforce: 'pre',
    async resolveId(source, importer) {
      const wanted = WEBAPP_PACKAGES.some((pkg) => source === pkg || source.startsWith(`${pkg}/`));
      if (!wanted) return null;
      return (await this.resolve(source, r('index.html'), { skipSelf: true })) ?? null;
    },
  };
}

/**
 * The React Native source uses `require('../assets/logo-mark.png')`.
 * Browsers get the hashed asset URL through `new URL(..., import.meta.url)`.
 */
function assetRequire(): Plugin {
  const pattern = /require\((['"])([^'"]+\.(?:png|jpe?g|webp|gif|svg|mp4|ttf|otf))\1\)/g;
  return {
    name: 'spoonful-asset-require',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replace(/\\/g, '/');
      if (!normalized.includes('/mobile/src/')) return null;
      if (!pattern.test(code)) return null;
      pattern.lastIndex = 0;
      return {
        code: code.replace(
          pattern,
          (_match, _quote: string, spec: string) => `new URL(${JSON.stringify(spec)}, import.meta.url).href`,
        ),
        map: null,
      };
    },
  };
}

// Hosting under a subfolder (e.g. "Spoonful" on the community site) sets
// SPOONFUL_BASE at build time. Local dev and plain builds stay at the root.
const subFolder = (process.env.SPOONFUL_BASE || '').replace(/^\/+|\/+$/g, '');
const base = subFolder ? `/${subFolder}/` : '/';

export default defineConfig({
  base,
  plugins: [buildVersionPlugin(buildId), webappPackages(), assetRequire(), react()],
  resolve: {
    alias: [
      // React Native -> React Native Web (+ browser fallbacks for native APIs)
      { find: /^react-native$/, replacement: shim('react-native.tsx') },
      { find: /^react-native-svg$/, replacement: shim('svg.tsx') },
      { find: /^react-native-webview$/, replacement: shim('webview.tsx') },
      { find: /^react-native-image-picker$/, replacement: shim('image-picker.ts') },
      { find: /^@notifee\/react-native$/, replacement: shim('notifee.ts') },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: shim('async-storage.ts') },
      { find: /^react-native-safe-area-context$/, replacement: shim('safe-area.tsx') },
      { find: /^react-native-url-polyfill\/auto$/, replacement: shim('noop.ts') },
      { find: /^lucide-react-native$/, replacement: r('node_modules', 'lucide-react') },
      // a single React instance for app code and renderer
      { find: /^react$/, replacement: r('node_modules', 'react') },
      { find: /^react\/jsx-runtime$/, replacement: r('node_modules', 'react', 'jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: r('node_modules', 'react', 'jsx-dev-runtime.js') },
      { find: /^react-dom$/, replacement: r('node_modules', 'react-dom') },
      { find: /^react-dom\/client$/, replacement: r('node_modules', 'react-dom', 'client.js') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  define: {
    __DEV__: 'true',
    global: 'globalThis',
    __SPOONFUL_BUILD__: JSON.stringify(buildId),
  },
  // A tsconfig string keeps Vite from parsing mobile/tsconfig.json (which
  // extends a package that only exists inside mobile/node_modules).
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        target: 'es2020',
        useDefineForClassFields: false,
        experimentalDecorators: true,
      },
    }),
  },
  optimizeDeps: {
    include: ['react-native-web'],
    esbuildOptions: {
      resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
      loader: { '.js': 'jsx' },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
    fs: { allow: [here, r('..', 'mobile')] },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
