'use strict';
const { Worker } = require('node:worker_threads');
const path = require('node:path');
// One persistent worker; synchronous SQLite work stays off the main event loop.
class SqliteClient {
  constructor({ timeoutMs = 600000, onProgress = () => {} } = {}) {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000) throw Error('Invalid worker timeout.');
    this.timeoutMs = timeoutMs; this.onProgress = onProgress;
    this.pending = new Map(); this.sequence = 0; this.closing = null; this.failure = null;
    this.worker = new Worker(path.join(__dirname, 'sqlite-worker.js'));
    this.worker.on('message', message => {
      const job = this.pending.get(message.id); if (!job) return;
      if (message.progress) { try { this.onProgress(message.progress); } catch { /* Observers cannot change storage outcome. */ } return; }
      this.pending.delete(message.id); clearTimeout(job.timer);
      if (message.error) job.reject(Object.assign(Error(message.error.message), { code: message.error.code }));
      else job.resolve(message.value);
    });
    this.worker.on('error', error => this.fail(error));
    this.worker.on('exit', code => this.fail(Error(`SQLite worker exited (${code}); reopen and check the command receipt or migration manifest before retrying.`)));
  }
  fail(error) {
    this.failure ||= error;
    for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(this.failure); }
    this.pending.clear();
  }
  request(operation, ...args) {
    if (this.failure || this.closing) return Promise.reject(this.failure || Error('SQLite worker is closing.'));
    if (operation !== 'close' && this.pending.size >= 32) return Promise.reject(Error('SQLite request queue is full.'));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.fail(Error('SQLite operation timed out; its outcome is uncertain. Reopen and check the command receipt or migration manifest before retrying.'));
        void this.worker.terminate();
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.worker.postMessage({ id, operation, args }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  migrate(source, destination) { return this.request('migrate', { source, destination }); }
  open(destination) { return this.request('open', destination); }
  forkCopy(source, destination) { return this.request('forkCopy', source, destination); }
  openWorking(destination) { return this.request('openWorking', destination); }
  command(command) { return this.request('command', command); }
  compatibilityRead(kind,entity,value) { return this.request('compatibilityRead',kind,entity,value); }
  lifecycleBarrier() { return this.request('lifecycleBarrier'); }
  lifecycleDiagnostics() { return this.request('lifecycleDiagnostics'); }
  bulkCollect(picks,deps=true,info={}) { return this.request('bulkCollect',picks,deps,info); }
  bulkDependencies(picks) { return this.request('bulkDependencies',picks); }
  inspectImport(file) { return this.request('inspectImport',file); }
  bulkImport(file,commandId,digest) { return this.request('bulkImport',file,commandId,digest); }
  backupSnapshot(destination,info={}) { return this.request('backupSnapshot',destination,info); }
  restoreSnapshot(source,destination) { return this.request('restoreSnapshot',source,destination); }
  exportLegacy(file,info={}) { return this.request('exportLegacy',file,info); }
  restoreLegacy(file,destination) { return this.request('restoreLegacy',file,destination); }
  receipt(id) { return this.request('receipt', id); }
  editorScope() { return this.request('editorScope'); }
  revision(entity, id) { return this.request('revision', entity, id); }
  fieldVersion(entity, id, parts) { return this.request('fieldVersion', entity, id, parts); }
  changes(after, limit) { return this.request('changes', after, limit); }
  outbox(databaseId, options) { return this.request('outbox', databaseId, options); }
  homeStatistics(options) { return this.request('homeStatistics',options); }
  homeSessions(options) { return this.request('homeSessions',options); }
  raceSeason(options) { return this.request('raceSeason',options); }
  raceCharts(ids) { return this.request('raceCharts',ids); }
  raceInputs(options) { return this.request('raceInputs',options); }
  editorRead(kind,entity,value) { return this.request('editorRead',kind,entity,value); }
  referencePage(entity,options) { return this.request('referencePage',entity,options); }
  referenceDetails(entity,ids,revision) { return this.request('referenceDetails',entity,ids,revision); }
  historyReferences(rows) { return this.request('historyReferences',rows); }
  historyPage(pool,options) { return this.request('historyPage',pool,options); }
  historySession(pool,id,options) { return this.request('historySession',pool,id,options); }
  carStatistics(id) { return this.request('carStatistics',id); }
  catalogue(entity, options) { return this.request('catalogue',entity,options); }
  cataloguePicture(entity,id,revision) { return this.request('cataloguePicture',entity,id,revision); }
  deliveryPayload(key, token) { return this.request('deliveryPayload', key, token); }
  deliverySnapshot(key,options) { return this.request('deliverySnapshot', key,options); }
  snapshot(entity, id, includeMedia = false) { return this.request('snapshot', entity, id, includeMedia); }
  paddockRead(kind, options) { return this.request('paddockRead',kind,options); }
  resourceState() { return this.request('resourceState'); }
  resourceBegin(profileId, context) { return this.request('resourceBegin', profileId, context); }
  get(entity, id, includeMedia = false) { return this.request('get', entity, id, includeMedia); }
  field(entity, id, parts) { return this.request('field', entity, id, parts); }
  page(entity, after, limit) { return this.request('page', entity, after, limit); }
  sessionLaps(id, after, limit) { return this.request('sessionLaps', id, after, limit); }
  asset(entity, id, parts) { return this.request('asset', entity, id, parts); }
  close() {
    if (!this.closing) this.closing = this.request('close').then(async value=>{await this.worker.terminate();return value;},error=>{this.closing=null;throw error;});
    return this.closing;
  }
  cancel() { this.fail(Error('SQLite worker cancelled; its outcome is uncertain. Reopen and check the command receipt or migration manifest before retrying.')); return this.worker.terminate(); }
}
module.exports = SqliteClient;
