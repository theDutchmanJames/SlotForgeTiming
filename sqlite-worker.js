'use strict';
const { parentPort } = require('node:worker_threads');
const { migrateCopy, openCopy } = require('./sqlite-migration');
const { WorkingStore, forkCopy } = require('./sqlite-working');
let store = null,
  closed = false;
const reads = new Set(['get', 'field', 'page', 'sessionLaps', 'asset']);
parentPort.on('message', ({ id, operation, args }) => {
  parentPort.postMessage({ id, started: true }); // (2.4.0 review) the client times a request from here, not while it waits its turn
  try {
    if (closed) throw Error('SQLite worker is closed.');
    let value;
    if (operation === 'close') {
      store?.close();
      store = null;
      closed = true;
      value = true;
    } else if (operation === 'migrate') {
      if (store) throw Error('Close the open database before migrating.');
      value = migrateCopy(args[0], progress => parentPort.postMessage({ id, progress }));
    } else if (['inspectImport', 'restoreSnapshot', 'restoreLegacy'].includes(operation)) {
      const bulk = require('./sqlite-bulk');
      value = bulk[{ inspectImport: 'inspect', restoreSnapshot: 'restore', restoreLegacy: 'restoreLegacy' }[operation]](...args);
    } else if (operation === 'open') {
      if (store) throw Error('A database is already open.');
      store = openCopy(args[0]);
      value = true;
    } else if (operation === 'forkCopy') {
      if (store) throw Error('Close the open database before creating a working fork.');
      value = forkCopy(...args);
    } else if (operation === 'openWorking') {
      if (store) throw Error('A database is already open.');
      store = new WorkingStore(args[0]);
      value = true;
    } else {
      const working =
        store instanceof WorkingStore &&
        [
          'affectedSharedSessions',
          'compatibilityRead',
          'lifecycleBarrier',
          'lifecycleDiagnostics',
          'bulkCollect',
          'bulkDependencies',
          'bulkImport',
          'backupSnapshot',
          'exportLegacy',
          'command',
          'editorScope',
          'receipt',
          'revision',
          'fieldVersion',
          'changes',
          'outbox',
          'deliveryPayload',
          'deliverySnapshot',
          'snapshot',
          'resourceState',
          'resourceBegin',
          'catalogue',
          'cataloguePicture',
          'historyReferences',
          'historyKnown',
          'historyPage',
          'historySession',
          'carStatistics',
          'driverProgress',
          'editorRead',
          'referencePage',
          'referenceDetails',
          'homeStatistics',
          'homeSessions',
          'raceInputs',
          'raceSeason',
          'raceCharts',
          'paddockRead'
        ].includes(operation);
      if (!reads.has(operation) && !working) throw Error('Unsupported SQLite worker operation.');
      if (!store) throw Error('No SQLite copy is open.');
      // (2.4.0, speed) a backup through the worker is checked in a helper thread
      value =
        operation === 'backupSnapshot' && store instanceof WorkingStore ? store.backupSnapshotAside(...args) : store[operation](...args);
    }
    // (2.4.0, speed) a request that finishes later (a backup being checked in a helper thread): the worker answers others meanwhile
    if (value && typeof value.then === 'function')
      return value.then(
        v => parentPort.postMessage({ id, value: v }),
        error => parentPort.postMessage({ id, error: { message: error.message, code: error.code } })
      );
    parentPort.postMessage({ id, value });
  } catch (error) {
    parentPort.postMessage({ id, error: { message: error.message, code: error.code } });
  }
});
