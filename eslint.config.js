// ESLint fuer Salati TV — nach dem Muster von apps/mobile/eslint.config.js.
//
// Bis 2026-07-29 hatte apps/tv gar keine ESLint-Konfiguration: `pnpm lint`
// existierte nicht, und keine der TV-Quellen wurde je gelint. Diese Datei
// schliesst die Luecke.
//
// Kein eslint/config-defineConfig()-Helper (siehe Begruendung in
// apps/mobile/eslint.config.js): ein reines Flat-Config-Array laeuft mit jeder
// ESLint-9-Version.
const expoConfig = require('eslint-config-expo/flat');

// Node-Globals von Hand statt ueber das `globals`-Paket — dieselbe Begruendung
// wie in apps/mobile: das Paket haengt hier nicht als direkte Abhaengigkeit.
const NODE_GLOBALS = {
  Buffer: 'readonly',
  process: 'readonly',
  console: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'writable',
  require: 'readonly',
  exports: 'writable',
  global: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  AbortController: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
};

module.exports = [
  ...expoConfig,
  {
    // scripts/ (Play-Upload, Quiz-Build) und die Config-Dateien laufen in Node,
    // nicht in React Native.
    files: ['scripts/**/*.{js,mjs,cjs}', 'plugins/**/*.js', '*.config.js', 'jest.setup.js', 'index.js'],
    languageOptions: {
      globals: { ...NODE_GLOBALS, jest: 'readonly' },
    },
  },
  {
    // Generierte Paritaetstabelle (scripts/…): Inhalt kommt aus der Handy-App,
    // Formatierung ist maschinell.
    files: ['src/lib/parity-table.generated.ts'],
    rules: { 'no-irregular-whitespace': 'off' },
  },
  {
    ignores: ['android/**', '.expo/**', 'coverage/**', 'screenshots/**', 'store/**'],
  },
];
