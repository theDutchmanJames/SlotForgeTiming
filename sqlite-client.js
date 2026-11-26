'use strict';
const { Worker } = require('node:worker_threads');
const path = require('node:path');
// One persistent worker; synchronous SQLite work stays off the main event loop.
class SqliteClient {
  constructor({ timeoutMs = 600000, onProgress = () => {} } = {}) {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000) throw Error('Invalid worker timeout.');
    this.timeoutMs = timeoutMs;
    this.onProgress = onProgress;
    this.pending = new Map();
    this.sequence = 0;
    this.closing = null;
    this.failure = null;
    this.opened = null; // (audit 2026-11: the database the worker has open, so a new worker can open it again after a crash or a timeout)
    this.reviving = null;
    this.spawn();
  }
  spawn() {
    const worker = new Worker(path.join(__dirname, 'sqlite-worker.js'));
    this.worker = worker;
    worker.on('message', message => {
      if (worker !== this.worker) return;
      const job = this.pending.get(message.id);
      if (!job) return;
      if (message.started) {
        if (!job.timer) this.arm(job);
        return;
      }
      if (message.progress) {
        try {
          this.onProgress(message.progress);
        } catch {
          /* Observers cannot change storage outcome. */
        }
        return;
      }
      this.pending.delete(message.id);
      clearTimeout(job.timer);
      if (message.error) job.reject(Object.assign(Error(message.error.message), { code: message.error.code }));
      else job.resolve(message.value);
    });
    worker.on('error', error => {
      if (worker === this.worker) this.fail(error);
    });
    worker.on('exit', code => {
      if (worker === this.worker && !this.closing)
        this.fail(Error(`SQLite worker exited (${code}); reopen and check the command receipt or migration manifest before retrying.`));
    });
  }
  // (audit 2026-11) after a crash or a timeout the next request starts a new worker and opens the same database again, instead of every request failing
  // until the app is restarted (the final save of a race too). What was uncertain stays so: a save is idempotent by its key, a receipt can be checked.
  revive() {
    // (no more than three new workers a minute: a database that keeps failing is reported, not tried for ever)
    const t = Date.now();
    this.revivals = (this.revivals || []).filter(x => t - x < 60000);
    if (!this.reviving && this.revivals.length >= 3) return Promise.reject(this.failure);
    if (!this.reviving) this.revivals.push(t);
    if (!this.reviving)
      this.reviving = (async () => {
        const old = this.worker;
        this.worker = null;
        try {
          await old.terminate();
        } catch {
          /* it may be gone already */
        }
        this.failure = null;
        this.spawn();
        if (this.opened) await this.send(this.opened.operation, this.opened.args);
      })().finally(() => {
        this.reviving = null;
      });
    return this.reviving;
  }
  arm(job) {
    job.timer = setTimeout(() => {
      this.fail(
        Error(
          'SQLite operation timed out; its outcome is uncertain. Reopen and check the command receipt or migration manifest before retrying.'
        )
      );
      if (this.worker) void this.worker.terminate();
    }, this.timeoutMs);
  }
  fail(error) {
    this.failure ||= error;
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      job.reject(this.failure);
    }
    this.pending.clear();
  }
  request(operation, ...args) {
    if (this.closing) return Promise.reject(this.failure || Error('SQLite worker is closing.'));
    if (this.failure || this.reviving) {
      if (operation === 'close') return Promise.reject(this.failure);
      const before = this.failure;
      return this.revive().then(
        () => this.request(operation, ...args),
        () => Promise.reject(before || this.failure)
      );
    }
    if (operation === 'open' || operation === 'openWorking') this.opened = { operation, args };
    return this.send(operation, args);
  }
  send(operation, args) {
    if (operation !== 'close' && this.pending.size >= 32) return Promise.reject(Error('SQLite request queue is full.'));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence,
        job = { resolve, reject, timer: null };
      // (2.4.0 review) a request behind others is timed from when the worker begins it; one sent to an idle worker at once
      if (!this.pending.size) this.arm(job);
      this.pending.set(id, job);
      try {
        this.worker.postMessage({ id, operation, args });
      } catch (error) {
        clearTimeout(job.timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  migrate(source, destination) {
    return this.request('migrate', { source, destination });
  }
  open(destination) {
    return this.request('open', destination);
  }
  forkCopy(source, destination) {
    return this.request('forkCopy', source, destination);
  }
  openWorking(destination) {
    return this.request('openWorking', destination);
  }
  command(command) {
    return this.request('command', command);
  }
  compatibilityRead(kind, entity, value) {
    return this.request('compatibilityRead', kind, entity, value);
  }
  lifecycleBarrier() {
    return this.request('lifecycleBarrier');
  }
  lifecycleDiagnostics() {
    return this.request('lifecycleDiagnostics');
  }
  bulkCollect(picks, deps = true, info = {}) {
    return this.request('bulkCollect', picks, deps, info);
  }
  bulkDependencies(picks) {
    return this.request('bulkDependencies', picks);
  }
  inspectImport(file) {
    return this.request('inspectImport', file);
  }
  bulkImport(file, commandId, digest) {
    return this.request('bulkImport', file, commandId, digest);
  }
  backupSnapshot(destination, info = {}) {
    return this.request('backupSnapshot', destination, info);
  }
  restoreSnapshot(source, destination) {
    return this.request('restoreSnapshot', source, destination);
  }
  exportLegacy(file, info = {}) {
    return this.request('exportLegacy', file, info);
  }
  restoreLegacy(file, destination) {
    return this.request('restoreLegacy', file, destination);
  }
  receipt(id) {
    return this.request('receipt', id);
  }
  editorScope() {
    return this.request('editorScope');
  }
  revision(entity, id) {
    return this.request('revision', entity, id);
  }
  fieldVersion(entity, id, parts) {
    return this.request('fieldVersion', entity, id, parts);
  }
  changes(after, limit) {
    return this.request('changes', after, limit);
  }
  outbox(databaseId, options) {
    return this.request('outbox', databaseId, options);
  }
  homeStatistics(options) {
    return this.request('homeStatistics', options);
  }
  homeSessions(options) {
    return this.request('homeSessions', options);
  }
  raceSeason(options) {
    return this.request('raceSeason', options);
  }
  raceCharts(ids) {
    return this.request('raceCharts', ids);
  }
  raceInputs(options) {
    return this.request('raceInputs', options);
  }
  editorRead(kind, entity, value) {
    return this.request('editorRead', kind, entity, value);
  }
  referencePage(entity, options) {
    return this.request('referencePage', entity, options);
  }
  referenceDetails(entity, ids, revision) {
    return this.request('referenceDetails', entity, ids, revision);
  }
  historyReferences(rows) {
    return this.request('historyReferences', rows);
  }
  historyKnown(ids) {
    return this.request('historyKnown', ids);
  }
  historyPage(pool, options) {
    return this.request('historyPage', pool, options);
  }
  historySession(pool, id, options) {
    return this.request('historySession', pool, id, options);
  }
  carStatistics(id) {
    return this.request('carStatistics', id);
  }
  driverProgress(id) {
    return this.request('driverProgress', id);
  }
  catalogue(entity, options) {
    return this.request('catalogue', entity, options);
  }
  cataloguePicture(entity, id, revision) {
    return this.request('cataloguePicture', entity, id, revision);
  }
  deliveryPayload(key, token) {
    return this.request('deliveryPayload', key, token);
  }
  deliverySnapshot(key, options) {
    return this.request('deliverySnapshot', key, options);
  }
  snapshot(entity, id, includeMedia = false) {
    return this.request('snapshot', entity, id, includeMedia);
  }
  paddockRead(kind, options) {
    return this.request('paddockRead', kind, options);
  }
  resourceState() {
    return this.request('resourceState');
  }
  resourceBegin(profileId, context) {
    return this.request('resourceBegin', profileId, context);
  }
  get(entity, id, includeMedia = false) {
    return this.request('get', entity, id, includeMedia);
  }
  field(entity, id, parts) {
    return this.request('field', entity, id, parts);
  }
  page(entity, after, limit) {
    return this.request('page', entity, after, limit);
  }
  sessionLaps(id, after, limit) {
    return this.request('sessionLaps', id, after, limit);
  }
  asset(entity, id, parts) {
    return this.request('asset', entity, id, parts);
  }
  close() {
    if (this.reviving && !this.closing) return this.reviving.catch(() => {}).then(() => this.close()); // (a new worker is starting: close it when it is there)
    // (audit 2.2.5) After a failure (a time-out, a crash) the worker can not answer any more: closing just stops it. SQLite rolls back whatever it had not
    // committed when the database is opened again, so this is safe, and the app can always quit.
    if (!this.closing && this.failure)
      this.closing = (this.worker ? this.worker.terminate() : Promise.resolve()).then(
        () => undefined,
        () => undefined
      );
    if (!this.closing)
      this.closing = this.request('close').then(
        async value => {
          await this.worker.terminate();
          return value;
        },
        error => {
          this.closing = null;
          throw error;
        }
      );
    return this.closing;
  }
  cancel() {
    this.fail(
      Error(
        'SQLite worker cancelled; its outcome is uncertain. Reopen and check the command receipt or migration manifest before retrying.'
      )
    );
    return this.worker.terminate();
  }
}
module.exports = SqliteClient;
