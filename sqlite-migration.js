'use strict';
// Verified copy conversion; production activation selects it only after verification.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { SqliteStore, FORMAT, hash, object } = require('./sqlite-store');
// Parsing still requires one V8 string. Never advertise a bound the runtime cannot read.
const MAX_JSON_BYTES = Math.min(1024 * 1024 * 1024, require('node:buffer').constants.MAX_STRING_LENGTH);
function hashFile(file) {
  const fd = fs.openSync(file, 'r'), buffer = Buffer.allocUnsafe(65536), digest = crypto.createHash('sha256');
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return digest.digest('hex');
}
function read(file, optional = false) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_JSON_BYTES) throw Error('Source must be a regular JSON file within the runtime legacy size limit ('+MAX_JSON_BYTES+' bytes). The original database has not been changed.');
    const bytes = fs.readFileSync(file);
    if (bytes.length > MAX_JSON_BYTES) throw Error('Source grew beyond the migration limit.');
    return { file, bytes, digest: hash(bytes) };
  } catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
}
function writeNew(file, value) {
  const fd = fs.openSync(file, 'wx');
  try { fs.writeFileSync(fd, value); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function parse(bytes, name) {
  let value;
  try { value = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')); } catch { throw Error(`${name} is not valid JSON.`); }
  if (!object(value)) throw Error(`${name} must contain an object.`);
  const finite = v => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw Error(`${name} contains an unsupported number.`);
    if (v && typeof v === 'object') for (const x of Object.values(v)) finite(x);
  };
  finite(value); return value;
}
function migrateCopy({ source, destination }, progress = () => {}, hooks = {}) {
  if (typeof source !== 'string' || typeof destination !== 'string' || !source.toLowerCase().endsWith('.json')) throw Error('Choose a source JSON copy and a new destination directory.');
  source = path.resolve(source); destination = path.resolve(destination);
  // Exclusive reservation: an existing directory, file or symlink is never reused.
  fs.mkdirSync(destination);
  let store;
  try {
    const main = read(source);
    const settingsPath = source.replace(/\.json$/i, '') + '.settings.json';
    const resumePath = path.join(path.dirname(source), 'race-resume.json');
    const settings = read(settingsPath, true), resume = read(resumePath, true);
    const inputs = [['source.json', main], ['source.settings.json', settings], ['race-resume.json', resume]];
    for (const [name, input] of inputs) if (input) writeNew(path.join(destination, name), input.bytes);
    const data = parse(main.bytes, 'Database');
    if (settings) data.settings = parse(settings.bytes, 'Settings');
    if (resume) parse(resume.bytes, 'Race recovery');
    progress({ phase: 'import', records: 0 });
    const stage = path.join(destination, 'staging.sqlite');
    store = new SqliteStore(stage, { create: true });
    hooks.beforeImport?.(store);
    store.import(data, count => { hooks.record?.(count); if (count % 1000 === 0) progress({ phase: 'import', records: count }); });
    hooks.afterImport?.(store);
    progress({ phase: 'verify' });
    const verification = store.verify(data);
    // Verify the exact backup bytes, and refuse an inconsistent/live source pair.
    hooks.beforeSourceCheck?.();
    for (const [name, input] of inputs) {
      const original = input?.file || (name === 'source.settings.json' ? settingsPath : resumePath);
      let digest = null;
      try { digest = hashFile(original); } catch (error) { if (input || error.code !== 'ENOENT') throw error; }
      if (digest !== (input?.digest || null)) throw Error('Source changed during migration. Use a stable offline copy.');
      if (input && hashFile(path.join(destination, name)) !== input.digest) throw Error('Recovery copy verification failed.');
    }
    store.markVerified();
    store.close(); store = null;
    // Closing the sole writer checkpoints WAL. Reopen and verify from disk before publication.
    const reopened = new SqliteStore(stage);
    try { reopened.verify(data); } finally { reopened.close(); }
    hooks.beforePublish?.();
    const report = { format: FORMAT, state: 'verified-copy', createdAt: new Date().toISOString(), sqliteSha256: hashFile(stage),
      verification, sources: inputs.filter(([, input]) => input).map(([name, input]) => ({ name, sha256: input.digest, bytes: input.bytes.length })),
      settingsSidecarApplied: !!settings, resumePreserved: !!resume,
      warnings: verification.danglingSessions ? ['Historical laps with missing sessions were preserved; review before activation.'] : [] };
    // The manifest is the publication marker. A terminated/failed conversion has none.
    fs.renameSync(stage, path.join(destination, 'timing.sqlite'));
    writeNew(path.join(destination, 'manifest.pending'), JSON.stringify(report, null, 2));
    fs.renameSync(path.join(destination, 'manifest.pending'), path.join(destination, 'manifest.json'));
    return { destination, ...report };
  } catch (error) {
    if (store) { try { store.close(); } catch { /* Preserve the original failure. */ } }
    // Leave staging/recovery files available for diagnosis. Never remove the source.
    throw error;
  }
}
function openCopy(destination) {
  const manifest = JSON.parse(fs.readFileSync(path.join(destination, 'manifest.json'), 'utf8'));
  if (manifest.format !== FORMAT || manifest.state !== 'verified-copy') throw Error('Unsupported or incomplete migration bundle.');
  const file = path.join(destination, 'timing.sqlite');
  if (fs.existsSync(file + '-wal') && fs.statSync(file + '-wal').size) throw Error('Verified copy has unexpected pending writes.');
  if (hashFile(file) !== manifest.sqliteSha256) throw Error('SQLite copy hash mismatch. Reconvert from the preserved source.');
  return new SqliteStore(file);
}
module.exports = { migrateCopy, openCopy, MAX_JSON_BYTES };
