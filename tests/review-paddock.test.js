'use strict';
// 2.4.0 review: the Paddock integration and shared car library fixes (F1-F11).
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto');
const { code, has } = require('./source.cjs');

test('F1: a refused service save does not lock the car for later saves', async () => {
  const S = require('../paddock-shared-store'),
    rows = new Map(),
    a = { get: id => rows.get(id), put: r => rows.set(r.id, structuredClone(r)), policy() {} },
    storage = {
      sharedRead: async o => (o.kind === 'get' ? structuredClone(rows.get(o.id) || null) : [...rows.values()].map(S.summary)),
      sharedChange: async i => S.change(a, i)
    };
  const { SharedLibraryClient } = require('../shared-library-client');
  const handle = {
    status: async () => ({ databaseId: 'db', recoveryId: 'rc' }),
    receipt: async () => {
      throw Object.assign(Error('not found'), { code: 'OPERATION_NOT_FOUND' });
    },
    serviceWrite: async () => {
      throw Object.assign(Error('stale'), { code: 'REVISION_CONFLICT' });
    }
  };
  const client = new SharedLibraryClient(handle, 'inst', storage),
    input = { databaseId: 'db', recoveryId: 'rc', carId: 'car1', expectedRevision: 1, expectedCarRevision: 1, action: 'set' };
  const first = await client.stateSave('serviceWrite', input);
  assert.equal(first.state, 'blocked');
  handle.serviceWrite = async () => ({ carId: 'car1', service: { revision: 3 }, carRevision: 3 });
  const second = await client.stateSave('serviceWrite', { ...input, expectedRevision: 2, expectedCarRevision: 2 });
  assert.equal(second.state, 'committed');
  // a pending save still holds the car
  handle.serviceWrite = async () => {
    throw Error('lost');
  };
  const pending = await client.stateSave('serviceWrite', { ...input, expectedRevision: 3, expectedCarRevision: 3 });
  assert.equal(pending.state, 'pending');
  await assert.rejects(client.stateSave('serviceWrite', input), /Resolve the earlier retained save/);
});

test('F2: a long car change backlog becomes a full listing; a failed catalogue refresh does not stop the local sync', async () => {
  const { Scalable } = require('../paddock-scalable');
  let page = 0;
  const s = new Scalable(async () => {
    page++;
    return {
      version: 1,
      databaseId: 'db',
      kind: 'cars',
      cursor: 'c' + page,
      resetRequired: false,
      more: true,
      entries: [{ carId: 'car' + page, operation: 'invalidate' }]
    };
  }, 'db');
  assert.deepEqual(await s.changes('c0'), { reset: true });
  const local = code('paddock-local.js');
  assert(has(local, 'try { await this.browseScalable(status);'));
  assert(has(local, 'this.catalogueError = safeError(e);'));
});

test('F3: a value hashes the same before and after it is saved as JSON; plain JSON hashes as before', () => {
  const H = require('../paddock-value-hash'),
    P = require('../paddock').hash;
  const v = { a: 1, b: undefined, c: [undefined, 2, { d: undefined, e: 'x' }], when: new Date(0) };
  const saved = JSON.parse(JSON.stringify(v));
  assert.equal(H(v), H(saved));
  assert.equal(P(v), P(saved));
  // plain JSON data: the canonical text (and so every stored hash) is unchanged
  const plain = { z: [1, null, 'a'], a: { y: true, b: 0.5 } },
    old = x =>
      Array.isArray(x)
        ? '[' + x.map(old).join(',') + ']'
        : x && typeof x === 'object'
          ? '{' +
            Object.keys(x)
              .sort()
              .map(k => JSON.stringify(k) + ':' + old(x[k]))
              .join(',') +
            '}'
          : JSON.stringify(x);
  const sha = t => require('node:crypto').createHash('sha256').update(t).digest('hex');
  assert.equal(H(plain), sha(old(plain)));
  assert.equal(P(plain), sha(old(plain)));
});

test('F4: after a move the new handle is opened first (waiting while busy), then the old one is closed', async () => {
  const { relocatable } = require('../shared-library-relocation');
  const order = [];
  const old = {
      status: async () => {
        throw Object.assign(Error('moved'), { code: 'LIBRARY_MOVED' });
      },
      close: async () => order.push('close old')
    },
    fresh = { status: async () => 'ok', close: async () => {} };
  let tries = 0;
  const h = relocatable(
    old,
    async () => {
      if (tries++ === 0) throw Object.assign(Error('busy'), { code: 'LIBRARY_BUSY' });
      order.push('open new');
      return fresh;
    },
    { wait: async () => {} }
  );
  assert.equal(await h.status(), 'ok');
  assert.deepEqual(order, ['open new', 'close old']);
  // an open that fails keeps the old handle open and usable for the next try
  const order2 = [];
  let fail = true;
  const old2 = {
      status: async () => {
        throw Object.assign(Error('moved'), { code: 'LIBRARY_MOVED' });
      },
      close: async () => order2.push('close old')
    },
    h2 = relocatable(old2, async () => {
      if (fail) throw Object.assign(Error('locked'), { code: 'LIBRARY_LOCKED' });
      return fresh;
    });
  await assert.rejects(h2.status(), /locked/);
  assert.deepEqual(order2, []);
  fail = false;
  assert.equal(await h2.status(), 'ok');
});

test('F5/F6: a local tick keeps its credential after an ordinary error, and keeps one timer chain', () => {
  const local = code('paddock-local.js');
  assert(has(local, 'if (credentialCodes.includes(e.code)) { this.localDescriptor = null;'));
  assert(has(local, "const credentialCodes = ['UNAUTHENTICATED', 'INSTANCE_CHANGED', 'DATABASE_MISMATCH', 'LOCAL_UNAVAILABLE'];"));
  assert(has(local, 'clearTimeout(this.localTimer); if (!this.stopped && !this.quiescing) this.localTimer = setTimeout('));
});

test('F7: racing a car while its transfer is reviewed is no conflict; an edit of what was sent still is', () => {
  const T = require('../paddock-local-transfers'),
    { hash } = require('../paddock');
  const rows = new Map(),
    car = { id: 'car1', brand: 'Brand', model: 'Model', lapsDriven: 0, custom: {} };
  let linked = false;
  const a = {
    connection: () => ({ mode: 'local', databaseId: 'db' }),
    sourceId: () => 'src',
    car: id => (id === car.id ? car : null),
    revision: () => null,
    className: () => '',
    linked: () => null,
    get: id => rows.get(id) || null,
    list: () => [...rows.values()].map(x => x.summary),
    put: (id, x) => rows.set(id, { id, ...x }),
    part: (id, key, x) => (rows.get(id)[key] = x),
    link: () => (linked = true)
  };
  const approve = id => {
    rows.get(id).receipt = { cars: [{ status: 'approved', present: true, archived: false, paddockCarId: 'pcar' }] };
  };
  const profile = {
    integrationVersion: 1,
    databaseId: 'db',
    car: { id: 'pcar', name: 'P' },
    configuration: { carId: 'pcar', databaseId: 'db', signature: 'a'.repeat(64), capturedAt: new Date().toISOString() }
  };
  const [made] = T.change(a, { action: 'create', databaseId: 'db', selections: [{ localId: 'car1' }] });
  approve(made.id);
  car.lapsDriven = 25; // (a race with the car)
  assert.equal(T.change(a, { action: 'apply', transferId: made.id, profile }).state, 'linked');
  assert(linked);
  // an older transfer (saved with the former revision) still matches
  rows.get(made.id).summary.state = 'approved';
  rows.get(made.id).localRevision = hash([car, '', null]);
  assert.equal(T.change(a, { action: 'apply', transferId: made.id, profile }).state, 'linked');
  // a changed model is a conflict
  const fresh = { ...car, id: 'car2' };
  a.car = id => (id === 'car2' ? fresh : id === car.id ? car : null);
  const [second] = T.change(a, { action: 'create', databaseId: 'db', selections: [{ localId: 'car2' }] });
  approve(second.id);
  fresh.model = 'Changed';
  assert.equal(T.change(a, { action: 'apply', transferId: second.id, profile }).state, 'conflict');
});

test('F8: a DNF in a shared classification is shown as retired', () => {
  assert(has(code('shared-library-results.js'), "retired: a?.status === 'dnf' || a?.status === 'retired'"));
});

test('F9: an approved car that is already linked elsewhere needs attention instead of a retry at every tick', () => {
  assert(
    has(code('paddock-storage.js'), "throw Object.assign(Error('This physical car already has a link.'), { code: 'LINK_CONFLICT' });")
  );
  const local = code('paddock-local.js');
  assert(has(local, "'LINK_CONFLICT' ].includes(e.code) || /already (has a link|linked)/.test(e.message || '');"));
});

test('F10: a held restore whose staging folder was removed does not block reading the journal', t => {
  const R = require('../shared-library-restore');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'review-paddock-')),
    id = randomUUID();
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));
  const source = path.join(fs.realpathSync(profile), 'shared-library-restores', id, 'source.sfpbackup');
  fs.writeFileSync(
    path.join(profile, 'shared-library-restore.json'),
    JSON.stringify({ format: R.FORMAT, version: 1, phase: 'held', request: { operationId: id, source }, sha256: 'a'.repeat(64) })
  );
  assert.equal(R.read(profile).phase, 'held');
});

test('F11: records of races still on their way are merged into every records page', () => {
  const reads = code('shared-library-reads.js');
  assert(!has(reads, 'if (!(o[section]?.offset > 0)) {'));
  assert(has(reads, 'if (page.nextOffset === null && o[section]?.offset > 0) {'));
  const { mergeRecords } = require('../shared-library-reads');
  const page2 = [{ trackId: 't', time: 9000 }];
  assert.equal(mergeRecords('tracks', page2, [{ trackId: 't', time: 8000, pendingLibrary: true }], false)[0].time, 8000);
});
