'use strict';
// npm run format: formats the files listed in tools/formatted.json with Prettier (.prettierrc.json).
const { spawnSync } = require('node:child_process'),
  path = require('node:path');
const root = path.join(__dirname, '..'),
  { files } = require('./formatted.json');
const r = spawnSync(process.execPath, [path.join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs'), '--write', ...files], {
  cwd: root,
  stdio: 'inherit'
});
process.exit(r.status === null ? 1 : r.status);
