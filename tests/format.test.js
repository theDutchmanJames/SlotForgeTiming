'use strict';
// The files listed in tools/formatted.json stay formatted (Prettier, .prettierrc.json). Fix with: npm run format
const { spawnSync } = require('node:child_process'),
  path = require('node:path');
const root = path.join(__dirname, '..'),
  { files } = require('../tools/formatted.json');
const bin = path.join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
const r = spawnSync(process.execPath, [bin, '--check', ...files], { cwd: root, encoding: 'utf8' });
if (r.status !== 0) {
  console.log(r.stdout + r.stderr);
  console.log('FORMAT CHECK FAILED: run npm run format');
  process.exit(1);
}
console.log(`FORMAT CHECK PASSED: ${files.length} files formatted`);
