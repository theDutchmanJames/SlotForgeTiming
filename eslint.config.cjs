'use strict';
// ESLint finds real mistakes (names that exist nowhere, duplicate keys, unreachable code, ...); it does not restyle anything.
// Run: npm run lint
// The renderer's scripts are classic <script> files that share one global scope (renderer/index.html loads them in order), so a
// name declared at the top of one file is used by the others. Those names are collected here from the files themselves, so a
// name that exists nowhere is still reported.
const fs = require('node:fs'), path = require('node:path'), globals = require('globals');
const R = path.join(__dirname, 'renderer');

function rendererGlobals() {
  const names = new Set();
  for (const f of fs.readdirSync(R).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(R, f), 'utf8');
    // top-level declarations (no indentation)
    for (const m of src.matchAll(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^class\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    for (const m of src.matchAll(/^(?:const|let|var)\s+([^;=]+?)\s*=/gm)) for (const n of m[1].split(',')) { const k = n.trim().match(/^[A-Za-z_$][\w$]*$/); if (k) names.add(k[0]); }
    for (const m of src.matchAll(/^(?:const|let|var)\s+(.+)$/gm)) for (const part of m[1].split(/,(?![^([{]*[)\]}])/)) { const k = part.trim().match(/^([A-Za-z_$][\w$]*)\s*(?:=|;|$)/); if (k) names.add(k[1]); }
    // modules that hang themselves on the window: root.X = / window.X = / globalThis.X =
    for (const m of src.matchAll(/\b(?:root|window|globalThis|self)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) names.add(m[1]);
  }
  return Object.fromEntries([...names].map(n => [n, 'writable']));
}

const MISTAKES = {
  'no-undef': 'error', 'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-dupe-class-members': 'error', 'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error', 'no-unreachable': 'error', 'no-self-assign': 'error', 'no-self-compare': 'error', 'use-isnan': 'error',
  'valid-typeof': 'error', 'no-unsafe-negation': 'error', 'no-unsafe-finally': 'error', 'no-func-assign': 'error', 'no-import-assign': 'error',
  'no-const-assign': 'error', 'no-class-assign': 'error', 'no-obj-calls': 'error', 'no-invalid-regexp': 'error',
  'no-loss-of-precision': 'error', 'no-unsafe-optional-chaining': 'error', 'no-compare-neg-zero': 'error', 'getter-return': 'error',
  'no-setter-return': 'error', 'no-async-promise-executor': 'error', 'no-constant-binary-expression': 'error', 'no-unused-private-class-members': 'error',
  'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
};

module.exports = [
  // (not linted: the QA probes are snippets that run inside the app's page, not files of their own)
  { ignores: ['tools/qa/*probe*.js', 'tools/qa/*-checks.js', 'tools/qa/*-visual.js', 'tools/qa/tyre-repairs-fixtures.js', 'vendor/**', 'node_modules/**', 'dist/**', '.tmp-test/**', 'tests/fixtures/**', 'tools/fixtures/**', 'tools/qa/fixtures/**', 'firmware/**', 'renderer/fonts/**', 'renderer/assets/**'] },
  { // the app's pages: classic scripts in the browser, sharing their top-level names; most also export themselves for node tests
    files: ['renderer/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser, ...rendererGlobals(), module: 'writable', require: 'readonly', process: 'readonly', Buffer: 'readonly', __dirname: 'readonly', global: 'readonly' } },
    rules: MISTAKES,
  },
  { files: ['renderer/shared-thumbnail-worker.js'], languageOptions: { globals: { ...globals.worker } } },
  { // the main process, preload, tests and tools: CommonJS in node
    files: ['*.js', '*.cjs', 'tests/**/*.js', 'tests/**/*.cjs', 'tools/**/*.js', 'tools/**/*.cjs', 'integration/**/*.cjs', 'integration/**/*.js', 'native/**/*.js', 'build/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
    rules: MISTAKES,
  },
  { // some tests load the renderer's scripts into their own global scope, and some checks compare a value with itself on purpose
    files: ['tests/**/*.js'], languageOptions: { globals: rendererGlobals() }, rules: { 'no-self-compare': 'off', 'no-constant-binary-expression': 'off' },
  },
  { files: ['**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser } }, rules: MISTAKES },
];
