'use strict';
// The linter finds no errors (names that exist nowhere, duplicate keys, unreachable code, ...). Warnings (unused names) do not fail.
// The same check by hand: npm run lint
const { spawnSync } = require('node:child_process'),
  path = require('node:path');
const bin = path.join(__dirname, '..', 'node_modules', 'eslint', 'bin', 'eslint.js');
const r = spawnSync(process.execPath, [bin, '--quiet', '.'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024
});
if (r.status !== 0) {
  console.log(r.stdout + r.stderr);
  console.log('LINT FAILED');
  process.exit(1);
}
console.log('LINT PASSED: no errors');
