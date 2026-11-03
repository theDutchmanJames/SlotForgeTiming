// Disposable synthetic workload. Not an application startup or hardware timing benchmark.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const Client = require('../../sqlite-client');
const { hash } = require('../../sqlite-store');
async function main() {
  const out = path.resolve(__dirname, '../../../outputs/sqlite-conversion'); fs.mkdirSync(out, { recursive: true });
  const dir = fs.mkdtempSync(path.join(out, 'writes-')), source = path.join(dir, 'source.json'), copy = path.join(dir, 'copy'), work = path.join(dir, 'work');
  const files = ['sqlite-store.js', 'sqlite-working.js', 'sqlite-worker.js', 'sqlite-client.js', 'resource-checkpoint.js'];
  const hashes = Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(path.resolve(__dirname, '../..', file)))]));
  // Decodable PCM WAV media: 64 unique 256 KiB files.
  const sounds = Array.from({ length: 64 }, (_, i) => {
    const b = Buffer.alloc(44 + 256 * 1024, i); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(b.length - 44, 40);
    return { id: 'sound-' + i, clip: 'data:audio/wav;base64,' + b.toString('base64') };
  });
  const lapCount = 100000;
  const data = { version: 1, drivers: [{ id: 'driver', custom: { club: 'Old' } }], slotcars: [{ id: 'car', lapsDriven: lapCount }],
    sessions: [{ id: 'history' }], laps: Array.from({ length: lapCount }, (_, i) => ({ id: 'lap-' + i, sessionId: 'history', carId: 'car', time: 10000 + i % 100 })),
    audiosets: sounds, customFields: { drivers: [{ id: 'club', type: 'text' }] } };
  fs.writeFileSync(source, JSON.stringify(data)); const originalHash = hash(fs.readFileSync(source));
  const client = new Client(), reopened = new Client(); let timer;
  try {
    await client.migrate(source, copy); await client.forkCopy(copy, work); await client.openWorking(work);
    const mediaBefore = await client.asset('audiosets', 'sound-0', ['clip']);
    let previous = performance.now(), maxGapMs = 0;
    timer = setInterval(() => { const now = performance.now(); maxGapMs = Math.max(maxGapMs, now - previous); previous = now; }, 10);
    const start = performance.now(), command = { id: 'scale-finalize', type: 'finalizeSession', session: { setupName: 'Large result', standings: [] },
      laps: Array.from({ length: 10000 }, (_, i) => ({ carId: 'car', driverId: 'driver', time: 10000 + i % 50, lapNumber: i + 1 })) };
    const result = await client.command(command), finalizeMs = performance.now() - start;
    const editStart = performance.now();
    for (let i = 0; i < 100; i++) await client.command({ id: 'edit-' + i, type: 'setCustomValue', entity: 'drivers', recordId: 'driver', fieldId: 'club', value: 'Club ' + i, expectedVersion: i });
    const edit100Ms = performance.now() - editStart;
    clearInterval(timer);
    assert.deepEqual(await client.command(command), result);
    assert.equal((await client.field('slotcars', 'car', ['lapsDriven'])).value, 110000);
    const mediaAfter = await client.asset('audiosets', 'sound-0', ['clip']); assert.deepEqual(mediaAfter, mediaBefore);
    await client.close(); await reopened.openWorking(work);
    assert.deepEqual(await reopened.receipt(command.id), result);
    assert.equal((await reopened.field('drivers', 'driver', ['custom', 'club'])).value, 'Club 99');
    await reopened.close(); assert.equal(hash(fs.readFileSync(source)), originalHash);
    for (const file of files) assert.equal(hash(fs.readFileSync(path.resolve(__dirname, '../..', file))), hashes[file], 'Code changed during workload');
    const report = { dir, hashes, node: process.versions.node, existingLaps: lapCount, newLaps: 10000, audioAssets: 64,
      audioBytes: 64 * (44 + 256 * 1024), finalizeMs, edit100Ms, maxMainThreadTimerGapMs: maxGapMs,
      sourceUnchanged: true, receiptSurvivedReopen: true, unchangedMediaVerified: true };
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { clearInterval(timer); await client.close().catch(() => {}); await reopened.close().catch(() => {}); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
