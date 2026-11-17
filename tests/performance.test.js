'use strict';
// Performance (2.3.1): with a few hundred races and some sixty cars the shared library made Home take ~4 s on every visit, Results and Records ~10 s,
// and the start ~5 s. These check the fixes: the details of each car are asked for once per library revision (and kept in a file for the next start),
// and the records of races that did not reach the library are found from the delivery list of this computer, without a question per race.
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const SR = require('../shared-library-reads.js'),
  Records = require('../shared-library-records.js');

function fakeLibrary(cars, revision = 1) {
  const calls = { catalogue: 0, settings: 0, custom: 0, service: 0 };
  const client = {
    installationId: 'me',
    merges: { binding: async () => null, refresh: async () => {} },
    revision,
    async catalogue(o = {}) {
      calls.catalogue++;
      const off = o.offset || 0,
        lim = o.limit || 200;
      return {
        cars: cars.slice(off, off + lim),
        nextOffset: off + lim < cars.length ? off + lim : null,
        token: { id: 'db', revision: client.revision, epoch: 'e' }
      };
    },
    async currentSettings(id) {
      calls.settings++;
      return { localCarId: 'local-' + id, effective: { tyreCompound: 'M' }, bindingToken: 'b-' + id, revision: 1, mergeRevision: 1 };
    },
    localId: id => 'local-' + id,
    canonicalId: id => id,
    handle: {
      customRead: async () => (calls.custom++, { definitions: [], values: {} }),
      serviceRead: async () => (calls.service++, { service: { lastServicedAt: '', servicesDone: 0, lapsDriven: 42, lapsSinceService: 7 } }),
      timingRead: async () => ({ rows: [], token: 't', nextOffset: null })
    },
    status: async () => ({ databaseId: 'db', recoveryId: 'rc', revision: client.revision })
  };
  const base = { list: async () => [], referencePage: async () => ({ items: [] }) };
  return { client, base, calls };
}
const car = (id, revision = 1) => ({
  id,
  revision,
  archived: false,
  fields: { name: 'Car ' + id, maker: 'NSR', model: 'GT', raceClass: '' }
});

test('the details of each car are asked for once per library revision, not on every list', async () => {
  const { client, base, calls } = fakeLibrary([car('a'), car('b'), car('c')]);
  const R = Records.wrap(base, client);
  const one = await R.referencePage('slotcars', {});
  assert.equal(one.items.length, 3);
  assert.equal(one.items[0].lapsDriven, 42, 'the service figures are there');
  assert.equal(one.items[0].tyreCompound, 'M', 'and the Timing settings');
  assert.equal(calls.settings, 3);
  await R.referencePage('slotcars', {});
  await R.referencePage('slotcars', {});
  assert.equal(calls.settings, 3, 'the same revision: no new requests per car');
  assert.equal(calls.service, 3);
  client.revision = 2; // (a race result, a car or a setting changed in the library)
  await R.referencePage('slotcars', {});
  assert.equal(calls.settings, 6, 'a new revision: asked again');
});

test('the details are kept in a file for the next start, and only used for the same revision', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-carcache-')),
    cacheFile = path.join(dir, 'library-car-cache.json');
  const first = fakeLibrary([car('a'), car('b')]);
  await Records.wrap(first.base, first.client, { cacheFile }).referencePage('slotcars', {});
  for (let i = 0; i < 40 && !fs.existsSync(cacheFile); i++) await new Promise(r => setTimeout(r, 50));
  assert(fs.existsSync(cacheFile), 'written a moment after the list');
  const next = fakeLibrary([car('a'), car('b')]);
  const items = (await Records.wrap(next.base, next.client, { cacheFile }).referencePage('slotcars', {})).items;
  assert.equal(next.calls.settings, 0, 'the next start at the same revision asks nothing per car');
  assert.equal(items[1].lapsDriven, 42);
  const changed = fakeLibrary([car('a'), car('b')], 9);
  await Records.wrap(changed.base, changed.client, { cacheFile }).referencePage('slotcars', {});
  assert.equal(changed.calls.settings, 2, 'another revision: the file is not used');
  fs.writeFileSync(cacheFile, '{ not json');
  const broken = fakeLibrary([car('a')]);
  assert.equal(
    (await Records.wrap(broken.base, broken.client, { cacheFile }).referencePage('slotcars', {})).items.length,
    1,
    'a damaged file is ignored'
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('records of races not yet in the library come from the delivery list; with nothing waiting, local records are not even read', async () => {
  let pages = 0,
    asked = 0;
  const read = [];
  const lap = (id, sessionId, trackId) => ({ id, sessionId, trackId, driverId: 'd', time: 4000 });
  const base = {
    historyPage: async () => (
      pages++,
      {
        revision: 'r',
        tracks: { items: [lap('1', 'held', 't1'), lap('2', 'sent', 't2')], next: null },
        personal: { items: [lap('3', 'held', 't1')], next: null },
        refs: { tracks: [], drivers: [], slotcars: [], sessions: [] }
      }
    ),
    historySession: async (pool, id) => (
      read.push(id),
      {
        laps: id === 'held' ? [lap('1', 'held', 't1'), { ...lap('4', 'held', 't1'), time: 4500 }] : [lap('2', 'sent', 't2')],
        refs: { tracks: [{ id: id === 'held' ? 't1' : 't2' }], drivers: [], slotcars: [], sessions: [{ id }] }
      }
    )
  };
  const deliveries = [
    { sessionId: 'held', status: 'attention', transport: 'engine' },
    { sessionId: 'sent', status: 'delivered', transport: 'engine' }
  ];
  const client = {
    installationId: 'me',
    status: async () => ({ databaseId: 'db', recoveryId: 'rc' }),
    handle: { timingRead: async () => (asked++, { databaseId: 'db', recoveryId: 'rc', row: null }) },
    storage: { summary: async () => ({ deliveries }) }
  };
  const r = await SR.undeliveredRecords(base, client, 'racing', 'tok');
  assert.deepEqual(
    r.tracks.map(x => x.id),
    ['1']
  );
  assert.deepEqual(
    r.personal.map(x => x.id),
    ['1']
  );
  assert.deepEqual(read, ['held'], 'only the race that waits is read');
  assert.equal(pages, 0, 'not every local record');
  assert.equal(asked, 0, 'no question to the library per race');
  deliveries[0].status = 'delivered';
  pages = 0;
  const none = await SR.undeliveredRecords(base, client, 'racing', 'tok');
  assert.deepEqual(none.tracks, []);
  assert.equal(pages, 0, 'nothing waits: the local records are not read');
});

test('developers can trace how long the core takes for every request (SF_IPC_TRACE), and it costs nothing when it is off', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert(main.includes('const ipcTrace = process.env.SF_IPC_TRACE'));
  assert(main.includes('if (!ipcTrace) return appWork.run(() => handler(...args));'));
});
