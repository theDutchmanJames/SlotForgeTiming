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
  console.log(`PADDOCK AUDIT TESTS PASSED (${groups} checks)`);
})().catch(e => { console.error(e); process.exit(1); });
