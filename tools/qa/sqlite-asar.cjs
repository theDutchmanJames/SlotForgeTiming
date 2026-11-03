// Package the actual worker and its local dependency graph for an ASAR runtime probe.
const fs = require('node:fs'), path = require('node:path'), asar = require('@electron/asar');
const { spawn } = require('node:child_process');
async function main() {
  const root = path.resolve(__dirname, '../..'), out = path.resolve(root, '../outputs/sqlite-conversion');
  fs.mkdirSync(out, { recursive: true });
  const dir = fs.mkdtempSync(path.join(out, 'asar-')), src = path.join(dir, 'source'); fs.mkdirSync(src);
  const seen = new Set(), queue = ['storage-activation.js', 'sqlite-runtime.js', 'sqlite-app-repository.js', 'compatibility-read.js', 'sqlite-client.js', 'sqlite-worker.js', 'sqlite-repository.js', 'sqlite-delivery.js', 'resource-store.js', 'resource-backends.js'];
  while (queue.length) {
    const rel = queue.shift(); if (seen.has(rel)) continue; seen.add(rel);
    const text = fs.readFileSync(path.join(root, rel), 'utf8'), dest = path.join(src, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, text);
    for (const m of text.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
      let next = path.normalize(path.join(path.dirname(rel), m[1])); if (!path.extname(next)) next += '.js';
      queue.push(next);
    }
  }
  const archive = path.join(dir, 'storage.asar'); await asar.createPackage(src, archive);
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const fd=fs.openSync(path.join(dir,'launcher.log'),'w');
  const child = spawn(require('electron'), [path.join(__dirname, 'sqlite-copy-electron.cjs'), archive, ...(process.platform==='linux'&&process.env.CI?['--no-sandbox']:[])], { env, stdio: ['ignore',fd,fd], windowsHide: true });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('close', code => { fs.closeSync(fd);console.log('ASAR runtime exit: '+code+'; '+dir);process.exitCode = code ?? 1; });
}
main().catch(error => { console.error(error); process.exitCode = 1; });
