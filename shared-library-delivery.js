'use strict';
const { randomUUID } = require('node:crypto'),
  H = require('./paddock-history-write'),
  R = require('./paddock-rich-delivery');
const fault = (code, message) => Object.assign(Error(message), { code });
const O = require('./shared-library-original-history');
// (audit 2.2.5) A delivery that keeps failing waits longer each time: 1, 2, 4, 8 minutes, then every 15 minutes (attempts: the tries before this one).
const retryAfter = attempts => Math.min(15 * 60000, 60000 * 2 ** Math.min(4, Math.max(0, Number.isSafeInteger(attempts) ? attempts : 0)));
// Uses the existing JSON/SQLite durable outbox but never the HTTP sender.
class SharedLibraryDelivery {
  constructor(client, store, { isRacing = () => false } = {}) {
    this.client = client;
    this.store = store;
    this.isRacing = isRacing;
    this.running = null;
    this.closed = false;
  }
  flush() {
    if (this.running) return this.running;
    if (this.closed || this.isRacing()) return Promise.resolve({ deferred: true, sent: 0 });
    this.running = this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  async run() {
    let after = 0,
      sent = 0,
      failed = null;
    const state = await this.client.status(); // (2.2.5: one result that fails no longer stops the others; the first failure is reported at the end)
    for (;;) {
      const rows = await this.store.outbox(state.databaseId, { status: 'pending', after, limit: 50 });
      if (!rows.length) break;
      for (const row of rows) {
        if (this.closed || this.isRacing()) return { deferred: true, sent };
        const snap = await this.store.deliverySnapshot(row.key, { engineOriginals: true });
        if (snap.transport !== 'engine') continue;
        let attempt;
        try {
          attempt = await this.store.command({
            id: randomUUID(),
            type: 'claimDelivery',
            deliveryKey: row.key,
            databaseId: state.databaseId,
            transport: 'engine'
          });
        } catch (e) {
          if (e.code === 'DELIVERY_NOT_READY') continue;
          throw e;
        }
        try {
          if (attempt.payloadHash !== snap.payloadHash)
            throw fault('HISTORY_REVIEW_REQUIRED', 'The saved result changed while claiming delivery.');
          if (snap.guardBlocked) throw fault('HISTORY_REVIEW_REQUIRED', snap.guardBlocked);
          const original = O.isOriginal(snap.payload);
          (original ? O : R).preflight(snap);
          let receipt;
          for (const op of snap.guard.operations) {
            const now = await this.client.status();
            if (now.databaseId !== op.databaseId) throw fault('DATABASE_MISMATCH', 'The result belongs to another shared library.');
            if (now.recoveryId !== op.recoveryId)
              throw fault('RECOVERY_CHANGED', 'The library was restored. Retain this result for deliberate recovery.');
            if (op.sourceId !== this.client.installationId || (!original && op.editor.installationId !== this.client.installationId))
              throw fault('HISTORY_REVIEW_REQUIRED', 'This result belongs to another Timing installation.');
            let r;
            try {
              r = await this.client.handle.receipt({ operationId: op.operationId, databaseId: op.databaseId, recoveryId: op.recoveryId });
            } catch (e) {
              if (e.code !== 'OPERATION_NOT_FOUND') throw e;
            }
            if (!r) {
              const rawOriginal = snap.engineOriginals?.[op.operationId];
              if (!['withdraw', 'restore'].includes(op.action) && !rawOriginal)
                throw fault('HISTORY_REVIEW_REQUIRED', 'Original race evidence is missing.');
              r = original
                ? await this.client.handle.originalHistoryWrite(O.request(op, rawOriginal))
                : await this.client.handle.historyWrite({ ...op, ...(rawOriginal ? { rawOriginal } : {}) });
            }
            receipt = original ? O.receipt(r, op) : H.receipt(r, op, R.fromOperation(op));
          }
          const applied = await this.store.command({
            id: randomUUID(),
            type: 'acknowledgeDelivery',
            deliveryKey: row.key,
            attemptToken: attempt.attemptToken,
            receipt: (original ? O : H).legacy(receipt, snap.payload),
            guardReceipt: receipt,
            checkError: original ? '' : H.notice(receipt)
          });
          if (applied.applied) sent++;
        } catch (e) {
          await this.store.command({
            id: randomUUID(),
            type: 'failDelivery',
            deliveryKey: row.key,
            attemptToken: attempt.attemptToken,
            code: String(e.code || '').slice(0, 100),
            message: String(e.message).slice(0, 2000),
            retryAfterMs: retryAfter(row.attempts)
          });
          failed ??= e;
        }
      }
      after = rows.at(-1).sequence;
    }
    if (failed) throw failed;
    return { sent };
  }
  // (audit 2.2.5, #14) Retry for the shared-library race results that need attention (the Retry of the network sender leaves these alone):
  // each one is offered for sending again, then a delivery run starts. A held or blocked result is not retried: it needs a new edit or a review.
  async retry() {
    if (this.closed) throw Error('The shared library is closing.');
    const state = await this.client.status();
    let after = 0,
      offered = 0;
    for (;;) {
      const rows = await this.store.outbox(state.databaseId, { status: 'all', after, limit: 50 });
      if (!rows.length) break;
      for (const row of rows) {
        if (!['attention', 'pending'].includes(row.status)) continue;
        const snap = await this.store.deliverySnapshot(row.key);
        if (snap.transport !== 'engine' || snap.guardBlocked) continue;
        if ((snap.guard?.operations || []).some(op => op.databaseId !== state.databaseId || op.recoveryId !== state.recoveryId)) continue; // (held: written for a library before a restore, or for another library)
        try {
          await this.store.command({ id: randomUUID(), type: 'retryDelivery', deliveryKey: row.key, expectedHash: row.payloadHash });
          offered++;
        } catch (e) {
          if (e.code !== 'DELIVERY_NOT_READY') throw e;
        }
      }
      after = rows.at(-1).sequence;
    }
    const result = await this.flush();
    return { offered, ...result };
  }
  async close() {
    this.closed = true;
    await this.running;
  }
}
module.exports = SharedLibraryDelivery;
module.exports.retryAfter = retryAfter;
