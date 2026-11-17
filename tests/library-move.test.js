'use strict';
// Paddock moves the shared library to another folder while Timing runs (2.3.1, shared-library-relocation.js): Timing follows it without a restart.
// With the real engine: a library with a car, a handle opened before the move, the move itself (the engine's own relocate), then the same handle.
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { open } = require('../vendor/slotforge-library/index.cjs'),
  L = require('../vendor/slotforge-library/engine/src/shared-library-location.cjs'),
  { relocatable } = require('../shared-library-relocation.js');
const identity = s => ({ databaseId: s.databaseId, recoveryId: s.recoveryId });
const names = async h => (await h.catalogue()).cars.map(c => c.fields.name).sort();

test('a handle opened before the move follows the library, and a write made after it lands in the new file', async t => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'timing-move-')),
    root = path.join(base, 'registration'),
    opts = { application: 'SlotForge Timing', installationId: 'Timing', sharedRoot: root, legacyProfiles: [] };
  const seed = await open(opts),
    s = await seed.status();
  await seed.carWrite({ ...identity(s), operationId: 'seed', action: 'create', set: { name: 'Before the move' } });
  await seed.close();
  const moves = [];
  const h = relocatable(await open(opts), () => open(opts), { onMoved: info => moves.push(info) });
  t.after(async () => {
    await h.close().catch(() => {});
    fs.rmSync(base, { recursive: true, force: true });
  });
  assert.deepEqual(await names(h), ['Before the move']);
  const dest = path.join(base, 'new folder');
  await L.relocate(root, { file: s.file, databaseId: s.databaseId, folder: dest });
  // three calls meet the move together: one reopening serves them all
  const [cat, status, again] = await Promise.all([names(h), h.status(), names(h)]);
  assert.deepEqual(cat, ['Before the move']);
  assert.deepEqual(again, ['Before the move']);
  assert.equal(fs.realpathSync(status.file), fs.realpathSync(path.join(dest, 'library.sqlite')), 'now on the new file');
  assert.equal(status.databaseId, s.databaseId, 'the same library');
  assert.equal(moves.length, 1);
  assert.equal(path.resolve(moves[0].movedTo), path.resolve(path.join(dest, 'library.sqlite')));
  const now = await h.status();
  await h.carWrite({ ...identity(now), operationId: 'after', action: 'create', set: { name: 'After the move' } });
  assert.deepEqual(await names(h), ['After the move', 'Before the move']);
  const fresh = await open(opts);
  try {
    assert.deepEqual(await names(fresh), ['After the move', 'Before the move'], 'a new start sees the write: it went to the new file');
  } finally {
    await fresh.close();
  }
});

test('while a move is going on (LIBRARY_BUSY) a call waits and tries again; other errors and closing stop it', async () => {
  let n = 0,
    waited = 0;
  const fake = {
    status: async () => {
      if (++n <= 2) throw Object.assign(Error('A move is in progress.'), { code: 'LIBRARY_BUSY' });
      return { ok: true };
    },
    catalogue: async () => {
      throw Object.assign(Error('nope'), { code: 'SOMETHING_ELSE' });
    },
    close: async () => {}
  };
  const h = relocatable(fake, async () => fake, { wait: async () => waited++ });
  assert.deepEqual(await h.status(), { ok: true });
  assert.equal(waited, 2);
  await assert.rejects(h.catalogue(), e => e.code === 'SOMETHING_ELSE');
  const stuck = relocatable(
    {
      status: async () => {
        throw Object.assign(Error('busy'), { code: 'LIBRARY_BUSY' });
      },
      close: async () => {}
    },
    async () => null,
    { wait: async () => {}, busyTries: 3 }
  );
  await assert.rejects(stuck.status(), e => e.code === 'LIBRARY_BUSY', 'it gives up after a while instead of waiting for ever');
});

test('the library client of Timing uses it', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'shared-library-client.js'), 'utf8');
  assert(src.includes("handle = require('./shared-library-relocation').relocatable("));
});
