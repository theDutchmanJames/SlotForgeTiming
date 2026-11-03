// Reproducible scale check, synthetic records only. Not a JSON-vs-SQLite benchmark.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const Client = require('../../sqlite-client');
const root = path.resolve(__dirname, '../../../outputs/sqlite-conversion');
fs.mkdirSync(root, { recursive: true });
const dir = fs.mkdtempSync(path.join(root, 'scale-'));
const crypto = require('node:crypto');
const sources = () => Object.fromEntries(['sqlite-store.js', 'sqlite-migration.js', 'sqlite-client.js', 'sqlite-worker.js'].map(name => [name,
  crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', name))).digest('hex')]));
function wav(seed) {
  const pcm = Buffer.alloc(128 * 1024, seed), h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(pcm.length + 36, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(22050, 24); h.writeUInt32LE(44100, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return 'data:audio/wav;base64,' + Buffer.concat([h, pcm]).toString('base64');
}
async function main() {
  const measuredSources = sources();
  const rows = [];
  for (const size of [10000, 100000]) {
    const source = path.join(dir, size + '.json'), destination = path.join(dir, 'converted-' + size);
    const data = { version: 1, settings: { theme: 'dark' },
      drivers: Array.from({ length: 100 }, (_, i) => ({ id: 'd' + i, name: 'Driver ' + i, custom: { club: 'Club ' + i } })),
      sessions: Array.from({ length: 100 }, (_, i) => ({ id: 's' + i, name: 'Session ' + i })),
      laps: Array.from({ length: size }, (_, i) => ({ id: 'l' + i, sessionId: 's' + (i % 100), driverId: 'd' + (i % 100), time: 5000 + i % 500, valid: true, pit: false })),
      audiosets: Array.from({ length: 128 }, (_, i) => ({ id: 'a' + i, sound: wav(i) })) };
    fs.writeFileSync(source, JSON.stringify(data));
    const client = new Client();
    let ticks = 0, maxGap = 0, previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - previous); previous = now; ticks++; }, 10);
    try {
      const start = performance.now(), report = await client.migrate(source, destination), durationMs = performance.now() - start;
      await client.open(destination);
      assert.equal((await client.field('drivers', 'd1', ['custom', 'club'])).value, 'Club 1');
      let count = 0, after = -1;
      for (;;) { const page = await client.sessionLaps('s1', after, 100); if (!page.length) break; count += page.length; after = page.at(-1).ordinal; }
      assert.equal(count, size / 100);
      assert.equal(report.verification.assets, 128); assert(report.verification.exactOrderedJson);
      rows.push({ laps: size, sourceBytes: fs.statSync(source).size, sqliteBytes: fs.statSync(path.join(destination, 'timing.sqlite')).size,
        durationMs, timerTicks: ticks, maximumTimerGapMs: maxGap, verification: report.verification });
    } finally { clearInterval(timer); await client.close(); }
  }
  assert.deepEqual(sources(), measuredSources, 'Measured source changed during scale check');
  const report = { node: process.version, platform: process.platform, measuredSources, rows,
    note: 'One sample per size, warm local disk; timer gaps are a responsiveness proxy, not UI frame rate or timing accuracy.' };
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ dir, ...report }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
