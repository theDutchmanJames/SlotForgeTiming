// Explicit developer tool. The normal application does not select this backend.
const path = require('node:path');
const Client = require('../sqlite-client');
async function main() {
  const [source, destination, ...extra] = process.argv.slice(2);
  if (!source || !destination || extra.length) throw Error('Usage: node tools/sqlite-copy.cjs <offline-database-copy.json> <new-output-directory>');
  const client = new Client({ onProgress: p => console.log(JSON.stringify(p)) });
  try { console.log(JSON.stringify(await client.migrate(path.resolve(source), path.resolve(destination)), null, 2)); }
  finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
