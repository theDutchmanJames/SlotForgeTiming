'use strict';
// (2.4.0, speed) The checks of a new backup copy, in a thread of their own: see snapshotAside in sqlite-bulk.js.
const { parentPort, workerData } = require('node:worker_threads');
const Bulk = require('./sqlite-bulk');
try {
  const counts = Bulk.verify(workerData.file);
  parentPort.postMessage({ counts, sha256: Bulk.digest(workerData.file) });
} catch (e) {
  parentPort.postMessage({ error: { message: e.message, code: e.code } });
}
