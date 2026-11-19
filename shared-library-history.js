'use strict';
// Durable local-engine intent, created in the same transaction as Timing's
// recoverable race evidence. Never uses a network connection or activation gate.
const { randomUUID } = require('node:crypto');
const R = require('./paddock-rich-delivery'),
  H = require('./paddock-history-write');
const id = v => typeof v === 'string' && /^[\w-]{1,100}$/.test(v);
function context(s) {
  const c = s.paddockJournal?.sharedLibrary;
  if (c?.version !== 1 || !['databaseId', 'recoveryId', 'sourceId'].every(k => id(c[k])))
    throw Error('Missing original shared-library race identity.');
  return c;
}
// (audit 2.2.5, #14) The restore generation a new operation is written for. A race keeps the generation it was raced under; after the shared
// library was restored, Timing stores the library's current generation (db.paddock.sharedLibraryGuard). A new correction or withdrawal of an
// older race is then written for the current generation: it still names the version of the race it expects, so a restored library that holds
// another version refuses it. Changes made before the restore that were never confirmed stay held, as the restore design requires.
const HELD =
  'This race has changes from before the shared library was restored that were never confirmed. They are held and will not be sent to the restored library. Compare this race in Paddock.';
function generation(s, old, db) {
  const c = context(s),
    g = db?.paddock?.sharedLibraryGuard;
  if (
    g?.version !== 1 ||
    g.databaseId !== c.databaseId ||
    !id(g.recoveryId) ||
    g.recoveryId === c.recoveryId ||
    !Array.isArray(g.older) ||
    !g.older.includes(c.recoveryId)
  )
    return c; // (only a race of a generation known to be older)
  const waiting = old && old.status !== 'sent' ? old.guard?.operations || [] : [];
  if (waiting.some(o => o.recoveryId !== g.recoveryId)) throw Error(HELD);
  return { ...c, recoveryId: g.recoveryId };
}
function append(s, p, old, rawOriginal, current) {
  const c = current || context(s),
    base = old?.payload || old?.previousPayload;
  if (base && (!R.isRich(base) || base.databaseId !== c.databaseId || base.source.id !== c.sourceId || base.sessionId !== s.id))
    throw Error('The original shared result identity changed.');
  if (old?.guardBlocked) throw Error(old.guardBlocked);
  if (old && !old.baseline && (!base || old.transport !== 'engine' || !old.guard?.operations?.length))
    throw Error('The earlier shared result needs recovery before correction.');
  const expected = old?.baseline?.expected || (base ? R.tuple(base) : null);
  if (old?.status === 'sent') require('./paddock').checkedReceipt(old.receipt, base);
  p.revision = (expected?.revision || 0) + 1;
  const op = {
    version: 1,
    databaseId: c.databaseId,
    recoveryId: c.recoveryId,
    operationId: randomUUID(),
    editor: { installationId: c.sourceId, application: 'SlotForge Timing', name: 'Timing Race Director' },
    sourceId: c.sourceId,
    sessionId: s.id,
    expected,
    reason: expected ? 'Race Director review in Timing.' : 'Finalised in Timing.',
    action: p.state === 'withdrawn' ? 'withdraw' : expected ? 'replace' : 'create'
  };
  if (p.state === 'withdrawn') op.withdrawalReason = p.reason;
  else op.bundle = structuredClone(p.bundle);
  const previous = old?.status === 'sent' ? [] : old?.guard?.operations || [];
  if (previous.some(o => o.recoveryId !== c.recoveryId)) throw Error('The original shared recovery generation changed.');
  const operations = [...previous, op];
  if (operations.length > 16 || Buffer.byteLength(JSON.stringify(operations)) > 48 * 1024 * 1024)
    throw Error('Recover pending shared results before adding more corrections.');
  const originals = { ...(old?.status === 'sent' ? {} : old?.engineOriginals), [op.operationId]: rawOriginal };
  const delivery = {
    transport: 'engine',
    name: s.setupName || 'Saved session',
    payload: p,
    status: 'pending',
    error: '',
    receipt: null,
    guard: { version: 1, operations },
    engineOriginals: originals
  };
  R.preflight(delivery);
  return delivery;
}
// (audit 2.2.5) A preparation that failed keeps the delivery it started from ("prior", without the operations and original evidence, which the blocked
// delivery keeps itself). The next preparation or a withdrawal starts again from there, so one failure no longer blocks the race for good.
function before(old) {
  if (!old?.guardBlocked || !Object.hasOwn(old, 'prior')) return old;
  if (!old.prior) return null;
  const p = {
    ...old.prior,
    payload: old.prior.hadPayload ? old.previousPayload : null,
    guard: old.guard || null,
    engineOriginals: old.engineOriginals || {}
  };
  delete p.hadPayload;
  return p;
}
// (its payload is the blocked delivery's previousPayload: not kept twice)
function kept(old) {
  if (!old) return null;
  const p = { ...old, hadPayload: !!old.payload };
  delete p.payload;
  delete p.guard;
  delete p.engineOriginals;
  delete p.prior;
  return p;
}
function original(s, rows) {
  const session = structuredClone(s);
  delete session.paddockDelivery;
  return { session, laps: structuredClone(rows) };
}
function prepare(s, rows, blocked, db) {
  const old = before(blocked);
  try {
    const c = generation(s, old, db);
    if (
      s.sessionType === 'tokens' ||
      old?.baseline?.originalOnly ||
      require('./shared-library-original-history').isOriginal(old?.payload)
    ) {
      s.paddockDelivery = require('./shared-library-original-history').append(
        s,
        rows,
        old,
        'save',
        'Corrected original race evidence in Timing.',
        c
      );
      return;
    }
    const historical = old?.baseline?.provenance === 'historical' || old?.payload?.bundle?.provenance?.kind === 'historical';
    const bundle = historical
      ? require('./paddock-historical-evidence').nativeBundle(original(s, rows), c.databaseId, s.paddockJournal.adoptedCarIds || {})
      : require('./paddock-rich-mapper').measured(s, rows, c.databaseId).bundle;
    const p = {
      format: 'history-v1',
      databaseId: c.databaseId,
      source: { id: c.sourceId },
      sessionId: s.id,
      revision: 1,
      state: 'active',
      reason: '',
      bundle
    };
    s.paddockDelivery = append(s, p, old, original(s, rows), c);
  } catch (e) {
    s.paddockDelivery = {
      transport: 'engine',
      name: s.setupName || 'Saved session',
      sessionId: s.id,
      databaseId: s.paddockJournal?.sharedLibrary?.databaseId || '',
      payload: null,
      previousPayload: old?.payload || old?.previousPayload || null,
      status: 'attention',
      error: e.message,
      guardBlocked: e.message,
      guard: old?.guard || null,
      engineOriginals: old?.engineOriginals || {},
      receipt: old?.receipt || null,
      prior: kept(old)
    };
  }
}
function revise(db, s) {
  if (s.paddockDelivery?.status === 'withdrawn') return;
  prepare(
    s,
    db.laps.filter(l => l.sessionId === s.id),
    s.paddockDelivery,
    db
  );
}
function withdraw(db, s, reason) {
  const blocked = s.paddockDelivery;
  if (!blocked || blocked.status === 'withdrawn') return;
  const old = before(blocked);
  if (!old) return; // (a race whose first preparation failed was never shared: nothing to withdraw)
  const base = old.payload || old.previousPayload;
  // Never delete the only evidence for a failed/uncertain mapping.
  if ((!base && !old.baseline) || old.guardBlocked)
    throw Error('Resolve this shared history save before deleting its local recovery evidence.');
  const prior = base || {
    format: 'history-v1',
    databaseId: context(s).databaseId,
    source: { id: context(s).sourceId },
    sessionId: s.id,
    revision: old.baseline.expected.revision,
    state: old.baseline.expected.state
  };
  let c;
  try {
    c = generation(s, old, db);
  } catch {
    const w = old.status !== 'sent' ? old.guard?.operations || [] : [];
    c = w.length ? { ...context(s), recoveryId: w[0].recoveryId } : context(s);
  } // (held changes: the withdrawal stays with them, in their generation, held too, as before; deleting the race still works)
  const d =
    old.baseline?.originalOnly || require('./shared-library-original-history').isOriginal(base)
      ? require('./shared-library-original-history').append(s, [], old, 'withdraw', reason, c)
      : append(s, R.withdrawal(prior, reason), old, undefined, c);
  delete d.engineOriginals[d.guard.operations.at(-1).operationId];
  const state = require('./paddockrecords').state(db);
  (state.withdrawals || (state.withdrawals = [])).push(d);
  s.paddockDelivery = { ...old, status: 'withdrawn' };
}
// (2.4.0) App Settings > Connections > Shared Library. A race whose conversion failed (its first preparation, or a correction) holds no result to
// send: Retry prepares it again from the saved race, so a fix in a later version reaches it. Remove takes a race that never reached the library
// off the list (it stays in Timing, only not shared); a race the library already holds is corrected or deleted in Timing instead.
// (a block saved by an older version has no "prior": when nothing of the race was ever sent, it is prepared again from the start, else it would
// only repeat its own error)
const failed = d => d?.transport === 'engine' && d.status === 'attention' && !d.payload;
const neverShared = d => failed(d) && !d.prior && !d.previousPayload && !d.guard?.operations?.length && !d.receipt && !d.baseline;
function reconvert(db, s) {
  const d = s.paddockDelivery;
  if (!failed(d)) return false;
  if (neverShared(d))
    prepare(
      s,
      db.laps.filter(l => l.sessionId === s.id),
      undefined,
      db
    );
  else revise(db, s);
  return true;
}
function dismiss(s) {
  const d = s.paddockDelivery;
  if (!neverShared(d)) throw Error('This race is already in the shared library. Correct or delete the race in Timing instead.');
  s.paddockDelivery = {
    transport: 'engine',
    name: d.name,
    sessionId: d.sessionId,
    databaseId: d.databaseId,
    payload: null,
    status: 'withdrawn',
    dismissed: true,
    error: d.error,
    receipt: null
  };
}
module.exports = { prepare, revise, withdraw, context, generation, HELD, failed, neverShared, reconvert, dismiss };
