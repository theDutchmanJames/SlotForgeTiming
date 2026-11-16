'use strict';
// Audit 2.2.5, phase 5: Paddock shared-library history (#12, #13).
const assert = require('node:assert/strict');
const H = require('../shared-library-history');
const saved = '2026-10-25T12:34:56.789Z';
let groups = 0; const done = m => { groups++; console.log('ok   ' + m); };
function fixture(){return {session:{id:'native-race',sessionType:'qualifying',date:saved,setupName:'Qualifying',trackId:'track',trackName:'Club',standings:[{carId:'car',driverId:'driver',driverName:'James',laps:3,best:6795,pos:1}]},laps:[7021,6795,30302].map((time,i)=>({id:'lap-'+i,sessionId:'native-race',carId:'car',driverId:'driver',trackId:'track',lane:2,lapNumber:i+1,time,date:saved,...(i===2?{tooSlow:true,noTrackRecord:true,noPersonalBest:true}:{})}))};}
const lib = () => ({ sharedLibrary: { version: 1, databaseId: 'library', recoveryId: 'epoch', sourceId: 'source' }, adoptedCarIds: { car: 'canonical-car' } });
const adopted = () => ({ transport: 'engine', status: 'adopted', baseline: { version: 1, provenance: 'historical', expected: { revision: 1, state: 'active', contentHash: 'a'.repeat(64) } } });
const db = e => ({ laps: e.laps, paddock: { withdrawals: [] } });
const lastWithdrawal = d => d.paddock.withdrawals.at(-1);
{ // #12 a withdrawn race stays withdrawn
  const e = fixture(); e.session.paddockJournal = lib(); H.prepare(e.session, e.laps, adopted());
  assert.equal(e.session.paddockDelivery.status, 'pending', e.session.paddockDelivery.error);
  const d = db(e); H.withdraw(d, e.session, 'Session deleted in Timing.');
  const w = e.session.paddockDelivery; assert.equal(w.status, 'withdrawn'); assert.equal(lastWithdrawal(d).guard.operations.at(-1).action, 'withdraw');
  const before = JSON.stringify(w); e.laps[0].noTrackRecord = true; H.revise(d, e.session);
  assert.equal(JSON.stringify(e.session.paddockDelivery), before); assert.equal(d.paddock.withdrawals.length, 1);
  done('a withdrawn shared-library race is not brought back by a later edit');
}
{ // #13 one failed preparation does not block the race for good
  const e = fixture(); e.session.paddockJournal = lib(); const old = adopted();
  e.session.paddockJournal.sharedLibrary.recoveryId = 'not valid!'; H.prepare(e.session, e.laps, old);
  const b = e.session.paddockDelivery; assert.equal(b.status, 'attention'); assert.ok(b.guardBlocked); assert.deepEqual(b.prior.baseline, old.baseline);
  H.prepare(e.session, e.laps, b); const b2 = e.session.paddockDelivery; assert.ok(b2.guardBlocked); assert.deepEqual(b2.prior.baseline, old.baseline);
  done('a failed preparation keeps the delivery it started from (also when it fails again)');
  e.session.paddockJournal.sharedLibrary.recoveryId = 'epoch'; H.revise(db(e), e.session);
  const d = e.session.paddockDelivery; assert.equal(d.status, 'pending', d.error); assert.ok(!d.guardBlocked); assert.ok(!('prior' in d));
  assert.equal(d.guard.operations.length, 1); assert.equal(d.guard.operations[0].action, 'replace'); assert.deepEqual(d.guard.operations[0].expected, old.baseline.expected);
  done('...and the next edit prepares the race again from there (the same correction as without the failure)');
}
{ // #13 a blocked race can still be deleted
  const e = fixture(); e.session.paddockJournal = lib(); H.prepare(e.session, e.laps, adopted());
  const sent = e.session.paddockDelivery; const ops = sent.guard.operations.length;
  e.session.paddockJournal.sharedLibrary.recoveryId = 'bad id!'; H.revise(db(e), e.session); assert.ok(e.session.paddockDelivery.guardBlocked);
  e.session.paddockJournal.sharedLibrary.recoveryId = 'epoch';
  const d = db(e); H.withdraw(d, e.session, 'Session deleted in Timing.');
  assert.equal(e.session.paddockDelivery.status, 'withdrawn'); const wo = lastWithdrawal(d).guard.operations;
  assert.equal(wo.length, ops + 1); assert.equal(wo.at(-1).action, 'withdraw'); assert.deepEqual(wo.slice(0, ops), sent.guard.operations);
  done('a race with a failed preparation can be withdrawn (deleted); its earlier unsent operation travels along');
  const f = fixture(); f.session.paddockJournal = lib(); f.session.paddockJournal.sharedLibrary.recoveryId = 'bad id!'; H.prepare(f.session, f.laps, undefined);
  assert.ok(f.session.paddockDelivery.guardBlocked); assert.equal(f.session.paddockDelivery.prior, null);
  assert.doesNotThrow(() => H.withdraw(db(f), f.session, 'Session deleted in Timing.'));
  done('...a race whose very first preparation failed was never shared: deleting it needs no withdrawal');
  const g = { transport: 'engine', status: 'attention', guardBlocked: 'Older block', payload: null, previousPayload: null, guard: null };
  const s = fixture().session; s.paddockJournal = lib(); s.paddockDelivery = g;
  assert.throws(() => H.withdraw({ laps: [] }, s, 'x'), /Resolve this shared history save/);
  done('...a block saved by an older version (without its prior delivery) is still refused, as before');
}
{ // #14 option A: after a restore of the shared library, new changes of older races are written for its current generation
  const restored = (d, older = ['epoch']) => ({ ...d, paddock: { withdrawals: [], sharedLibraryGuard: { version: 1, databaseId: 'library', recoveryId: 'epoch2', older } } });
  { const e = fixture(); e.session.paddockJournal = lib(); const old = adopted(); e.session.paddockDelivery = old;
    H.revise(restored(db(e)), e.session); const d = e.session.paddockDelivery;
    assert.equal(d.status, 'pending', d.error); assert.equal(d.guard.operations.length, 1); assert.equal(d.guard.operations[0].recoveryId, 'epoch2'); assert.deepEqual(d.guard.operations[0].expected, old.baseline.expected);
    assert.equal(e.session.paddockJournal.sharedLibrary.recoveryId, 'epoch');
    done('#14: a correction of a race from before a restore is written for the restored library (the race keeps its own record of where it was raced)');
    H.revise(restored(db(e)), e.session); const d2 = e.session.paddockDelivery;
    assert.equal(d2.guard.operations.length, 2); assert.ok(d2.guard.operations.every(o => o.recoveryId === 'epoch2'));
    done('...and a second correction travels with the first one, both for the restored library'); }
  { const e = fixture(); e.session.paddockJournal = lib(); H.prepare(e.session, e.laps, adopted()); const waiting = e.session.paddockDelivery; assert.equal(waiting.guard.operations[0].recoveryId, 'epoch');
    e.laps[0].noTrackRecord = true; H.revise(restored(db(e)), e.session); const b = e.session.paddockDelivery;
    assert.ok(b.guardBlocked); assert.equal(b.error, H.HELD); assert.deepEqual(b.guard.operations, waiting.guard.operations);
    done('#14: changes from before the restore that were never confirmed stay held, with their own message');
    const r = restored(db(e)); H.withdraw(r, e.session, 'Session deleted in Timing.'); assert.equal(e.session.paddockDelivery.status, 'withdrawn');
    const wo = r.paddock.withdrawals.at(-1).guard.operations; assert.equal(wo.length, 2); assert.ok(wo.every(o => o.recoveryId === 'epoch'));
    done('...such a race can still be deleted: its withdrawal stays with the held changes (held too), as before'); }
  { const e = fixture(); e.session.paddockJournal = lib(); e.session.paddockDelivery = adopted();
    const other = { laps: e.laps, paddock: { withdrawals: [], sharedLibraryGuard: { version: 1, databaseId: 'another-library', recoveryId: 'x' } } };
    H.revise(other, e.session); assert.equal(e.session.paddockDelivery.guard.operations[0].recoveryId, 'epoch');
    const e2 = fixture(); e2.session.paddockJournal = lib(); e2.session.paddockDelivery = adopted(); H.revise({ laps: e2.laps, paddock: { withdrawals: [] } }, e2.session); assert.equal(e2.session.paddockDelivery.guard.operations[0].recoveryId, 'epoch');
    done('#14: the stored generation of another library, or none, changes nothing');
    const e3 = fixture(); e3.session.paddockJournal = lib(); e3.session.paddockJournal.sharedLibrary.recoveryId = 'epoch3'; e3.session.paddockDelivery = adopted();
    H.revise(restored(db(e3)), e3.session); assert.equal(e3.session.paddockDelivery.guard.operations[0].recoveryId, 'epoch3');
    done('#14: a race of a generation that is not known to be older (a restore while Timing runs, a stored value that could not be updated) keeps its own generation'); }
  { // a second restore: the race was corrected for epoch2 (still waiting), then the library was restored again to epoch4
    const e = fixture(); e.session.paddockJournal = lib(); e.session.paddockDelivery = adopted(); H.revise(restored(db(e)), e.session);
    assert.equal(e.session.paddockDelivery.guard.operations[0].recoveryId, 'epoch2');
    const again = { laps: e.laps, paddock: { withdrawals: [], sharedLibraryGuard: { version: 1, databaseId: 'library', recoveryId: 'epoch4', older: ['epoch', 'epoch2'] } } };
    e.laps[0].noTrackRecord = true; H.revise(again, e.session); assert.equal(e.session.paddockDelivery.error, H.HELD);
    H.withdraw(again, e.session, 'Session deleted in Timing.'); assert.equal(e.session.paddockDelivery.status, 'withdrawn');
    const wo = again.paddock.withdrawals.at(-1).guard.operations; assert.equal(wo.length, 2); assert.ok(wo.every(o => o.recoveryId === 'epoch2'));
    done('#14: after a second restore a race with a waiting correction is held, and can still be deleted (its withdrawal goes with the held correction, in its generation)'); }
  { const P = require('../paddock-storage');
    assert.deepEqual(P.nextGuard(undefined, { databaseId: 'library', recoveryId: 'e1' }, ['e0', 'e1', 'e0', 'bad id!']), { version: 1, databaseId: 'library', recoveryId: 'e1', older: ['e0'] });
    assert.deepEqual(P.nextGuard({ version: 1, databaseId: 'library', recoveryId: 'e1', older: ['e0'] }, { databaseId: 'library', recoveryId: 'e2' }, []), { version: 1, databaseId: 'library', recoveryId: 'e2', older: ['e0', 'e1'] });
    assert.deepEqual(P.nextGuard({ version: 1, databaseId: 'other', recoveryId: 'x', older: ['y'] }, { databaseId: 'library', recoveryId: 'e2' }, []), { version: 1, databaseId: 'library', recoveryId: 'e2', older: [] });
    done('#14: the older generations are the earlier stored ones and those of the races found when the library opens (another library starts afresh)'); }
  { const e = fixture(); e.session.paddockJournal = lib(); e.session.sessionType = 'tokens'; H.prepare(e.session, e.laps, undefined, restored(db(e)));
    const d = e.session.paddockDelivery; assert.equal(d.status, 'pending', d.error); assert.equal(d.guard.operations[0].recoveryId, 'epoch2');
    done('#14: the original-history path (Time Token sessions) uses the current generation too'); }
}
(async () => {
  { // #27 the local library is not looked for again at every poll
    const fs = require('fs'), os = require('os'), path = require('path'), Database = require('../db'), { Paddock } = require('../paddock');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-')), db = new Database(path.join(dir, 'timing.json')), p = new Paddock(db), key = 'a'.repeat(64) + '.json';
    let descriptor = { format: 'slotforge-local-library', version: 1, instanceId: 'instance-1', pid: 1, address: 'http://127.0.0.1:51000', token: 't'.repeat(43), databaseId: 'library-1', name: 'Test library', key }, scans = 0;
    p.localScan = async () => { scans++; return descriptor ? [{ ...descriptor }] : []; };
    let offered = true; p.localStill = async d => offered && !!descriptor && ['instanceId', 'token', 'address', 'databaseId', 'pid'].every(k => descriptor[k] === d[k]);
    const sentTo = []; 
    p.hostRequest = async (base, route, code, dbId, body, limit, instance) => { sentTo.push(base);
      if (!descriptor || base !== descriptor.address || code !== descriptor.token || instance !== descriptor.instanceId) throw Object.assign(Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      if (route === '/v1/status') return { id: descriptor.databaseId, name: 'Test library', localInstanceId: descriptor.instanceId, permissions: { browse: true }, capabilities: { localLibrary: { version: 1, imports: '/v1/local-library/imports' } } };
      throw Object.assign(Error('Unexpected ' + route), { code: 'NOT_FOUND' });
    };
    const c = { mode: 'local', localKey: key, databaseId: 'library-1', automatic: true };
    await p.ensureLocal(c); await p.ensureLocal(c); await p.ensureLocal(c);
    assert.equal(scans, 1);
    done('the local Paddock library is looked up once, then asked directly (no discovery scan, so no PowerShell, at every poll)');
    descriptor = { ...descriptor, token: 'u'.repeat(43), instanceId: 'restarted', address: 'http://127.0.0.1:51001' };
    await p.ensureLocal(c); assert.equal(scans, 2); assert.equal(p.code, 'u'.repeat(43)); assert.equal(p.localDescriptor.instanceId, 'restarted');
    done('...and looked up again when it no longer answers (Paddock restarted, new credentials)');
    { const keep = descriptor; descriptor = null; const before = sentTo.length; await assert.rejects(p.ensureLocal(c), e => e.code === 'LOCAL_UNAVAILABLE'); assert.equal(sentTo.length, before); descriptor = keep;
      done('...and when Paddock no longer offers it (its descriptor is gone), nothing is sent to the old address: the token stays home'); }
    await p.ensureLocal(c);
    descriptor = { ...descriptor, databaseId: 'replacement', token: 'v'.repeat(43) };
    await assert.rejects(p.ensureLocal(c), /different database/);
    descriptor = null; p.localDescriptor = null; await assert.rejects(p.ensureLocal(c), e => e.code === 'LOCAL_UNAVAILABLE');
    done('...a different database or a missing library is still found out');
    p.stop?.(); await p.idle?.(); await db.writesIdle(); fs.rmSync(dir, { recursive: true, force: true });
  }
  { // #27 the plain check of a remembered descriptor
    const fs = require('fs'), os = require('os'), path = require('path'), D = require('../paddock-local-discovery');
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-disc-')); fs.chmodSync(folder, 0o700); const key = 'b'.repeat(64) + '.json';
    const d = { format: 'slotforge-local-library', version: 1, instanceId: 'i1', pid: 7, address: 'http://127.0.0.1:51000', token: 't'.repeat(43), databaseId: 'lib', name: 'L' };
    const file = path.join(folder, key); fs.writeFileSync(file, JSON.stringify(d), { mode: 0o600 });
    assert.equal(await D.still({ ...d, key }, { folder }), true);
    assert.equal(await D.still({ ...d, key, token: 'u'.repeat(43) }, { folder }), false);
    fs.writeFileSync(file, JSON.stringify({ ...d, instanceId: 'i2' }), { mode: 0o600 }); assert.equal(await D.still({ ...d, key }, { folder }), false);
    fs.writeFileSync(file, JSON.stringify(d), { mode: 0o600 }); if (process.platform !== 'win32') { fs.chmodSync(file, 0o644); assert.equal(await D.still({ ...d, key }, { folder }), false); fs.chmodSync(file, 0o600); }
    fs.rmSync(file); assert.equal(await D.still({ ...d, key }, { folder }), false);
    assert.equal(await D.still({ ...d, key: '../x.json' }, { folder }), false);
    fs.rmSync(folder, { recursive: true, force: true });
    done('a remembered library counts as offered only while its own descriptor file is there, private and unchanged');
  }
  { // #28 a delivery that keeps failing waits longer each time
    const D = require('../shared-library-delivery');
    assert.deepEqual([0, 1, 2, 3, 4, 5, 50, undefined].map(D.retryAfter), [60000, 120000, 240000, 480000, 900000, 900000, 900000, 60000]);
    const commands = [];
    const store = {
      outbox: async (_db, { after }) => after ? [] : [{ key: 'k', sequence: 1, attempts: 3, status: 'pending' }],
      deliverySnapshot: async () => ({ transport: 'engine', payloadHash: 'h', guardBlocked: 'Blocked for the test' }),
      command: async c => { commands.push(c); return c.type === 'claimDelivery' ? { attemptToken: 'a', payloadHash: 'h' } : { applied: true }; },
    };
    await assert.rejects(new D({ status: async () => ({ databaseId: 'library' }) }, store).run(), /Blocked for the test/);
    assert.equal(commands.find(c => c.type === 'failDelivery').retryAfterMs, 480000);
    done('a shared-library delivery that keeps failing waits 1, 2, 4, 8 and then 15 minutes, not 1 minute every time');
  }
  { // #14 storage: the generation is kept in JSON and SQLite, and reaches the preparation
    const fs = require('fs'), os = require('os'), path = require('path'), Database = require('../db'), { JsonPaddockStorage } = require('../paddock-storage');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-gen-')), file = path.join(dir, 'slotforge-timing.json'), db = new Database(file), st = new JsonPaddockStorage(db);
    assert.deepEqual(await st.setSharedLibraryGuard({ databaseId: 'library', recoveryId: 'epoch2' }), { changed: true });
    assert.deepEqual(await st.setSharedLibraryGuard({ databaseId: 'library', recoveryId: 'epoch2' }), { changed: false });
    await assert.rejects(st.setSharedLibraryGuard({ databaseId: 'library', recoveryId: 'bad id!' }), /Invalid shared library identity/);
    assert.deepEqual(new Database(file).data.paddock.sharedLibraryGuard, { version: 1, databaseId: 'library', recoveryId: 'epoch2', older: [] });
    done('#14: JSON storage keeps the generation (checked, and only written when it changes)');
    const { migrateCopy } = require('../sqlite-migration'), { forkCopy, WorkingStore } = require('../sqlite-working');
    migrateCopy({ source: file, destination: path.join(dir, 'copy') }); forkCopy(path.join(dir, 'copy'), path.join(dir, 'work'));
    const w = new WorkingStore(path.join(dir, 'work'));
    assert.deepEqual(w.paddockState().paddock.sharedLibraryGuard, { version: 1, databaseId: 'library', recoveryId: 'epoch2', older: [] });
    assert.deepEqual(w.command({ id: 'g1', type: 'setSharedLibraryGuard', guard: { databaseId: 'library', recoveryId: 'epoch3' } }), { changed: true });
    assert.deepEqual(w.paddockState().paddock.sharedLibraryGuard, { version: 1, databaseId: 'library', recoveryId: 'epoch3', older: ['epoch2'] });
    assert.throws(() => w.command({ id: 'g2', type: 'setSharedLibraryGuard', guard: { databaseId: '', recoveryId: 'x' } }), /Invalid shared library identity/);
    w.close(); await db.writesIdle(); fs.rmSync(dir, { recursive: true, force: true });
    done('#14: the conversion to SQLite keeps it, SQLite storage sets it, and its preparation state includes it');
  }
  { // #14 Retry for shared race results, and delivery to the restored library
    const D = require('../shared-library-delivery'), commands = [];
    const rows = [{ key: 'a', sequence: 1, status: 'attention', payloadHash: 'ha' }, { key: 'b', sequence: 2, status: 'attention', payloadHash: 'hb' }, { key: 'c', sequence: 3, status: 'attention', payloadHash: 'hc' }, { key: 'd', sequence: 4, status: 'sent', payloadHash: 'hd' }];
    rows.push({ key: 'e', sequence: 5, status: 'attention', payloadHash: 'he' });
    const snaps = { a: { transport: 'engine', guard: { operations: [{ databaseId: 'library', recoveryId: 'now' }] } }, b: { transport: 'engine', guardBlocked: H.HELD }, c: { transport: 'network' }, e: { transport: 'engine', guard: { operations: [{ databaseId: 'library', recoveryId: 'before-restore' }] } } };
    const store = { outbox: async (_db, { status, after }) => status === 'pending' ? [] : rows.filter(r => r.sequence > after), deliverySnapshot: async k => snaps[k], command: async c => { commands.push(c); return {}; } };
    const r = await new D({ status: async () => ({ databaseId: 'library', recoveryId: 'now' }) }, store).retry();
    assert.deepEqual(commands.map(c => [c.type, c.deliveryKey, c.expectedHash]), [['retryDelivery', 'a', 'ha']]); assert.equal(r.offered, 1);
    done('#14: Retry offers the shared-library race results that need attention again; held (also those written before a restore), blocked and network results are left alone');
    const cmds = [], two = [{ key: 'x', sequence: 1, status: 'pending', payloadHash: 'h', attempts: 0 }, { key: 'y', sequence: 2, status: 'pending', payloadHash: 'h', attempts: 0 }];
    const st2 = { outbox: async (_db, { after }) => two.filter(r => r.sequence > after), deliverySnapshot: async k => ({ transport: 'engine', payloadHash: 'h', ...(k === 'x' ? { guardBlocked: 'first fails' } : {}), payload: null, guard: { operations: [] } }), command: async c => { cmds.push(c); return c.type === 'claimDelivery' ? { attemptToken: 't', payloadHash: 'h' } : {}; } };
    await assert.rejects(new D({ status: async () => ({ databaseId: 'library', recoveryId: 'now' }) }, st2).run(), /first fails/);
    assert.deepEqual(cmds.filter(c => c.type === 'claimDelivery').map(c => c.deliveryKey), ['x', 'y']);
    done('...and one result that fails no longer stops the others in the same run (the first failure is still reported)');
  }
  console.log(`PADDOCK AUDIT TESTS PASSED (${groups} checks)`);
})().catch(e => { console.error(e); process.exit(1); });
