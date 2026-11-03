# SQLite lifecycle phase review

3 November 2026. Production still opens the existing JSON database. SQLite tests
use disposable, explicitly created copies. No personal database was opened or
converted, and no GitHub push or release was performed.

## Implemented

- `storage-lifecycle.js` provides shared settings, recovery, pending-write,
  diagnostics and shutdown operations with JSON and SQLite adapters. Settings
  and recovery each have a serial queue; the combined queue accepts at most 32
  pending operations. Inputs are copied before queueing. Shutdown rejects new
  operations and waits for accepted operations before closing the SQLite worker.
- Main-process settings reads use the service's small settings cache. Writes
  publish to that cache only after persistence. Content Pack theme application
  uses the same service. A complete JSON restore explicitly refreshes the cache.
  Existing hardware ownership/connected/racing checks remain in place.
- Ordinary recovery and resource recovery share the service's recovery queue.
  Resource checkpoints still use the existing atomic resource-ledger command.
  Reads prefer a resource checkpoint; clear waits for resource and ordinary
  recovery clearing. Only the main window may save or clear recovery.
- `setRaceResume` is a revision-checked SQLite command with an idempotent receipt
  and transactional rollback. Ordinary snapshots live in `@meta/raceResume`.
  Resource snapshots are rejected by this command to prevent bypassing the ledger.
- Creating a working fork verifies the preserved `race-resume.json` checksum and
  imports it into the fork, without changing the verified migration source.
  Conflicting embedded/sidecar snapshots stop publication. Native backups and
  SQLite-to-SQLite legacy backup restores now retain ordinary recovery too.
- Performance collection can await backend diagnostics. SQLite diagnostics use
  aggregate queries rather than reconstructing history, photos or recovery data.
  Expensive aggregates are cached for up to a minute. Production JSON report
  fields are unchanged.
- Shutdown retains the existing three-second save window and plugin cleanup.
  In-flight Paddock delivery is awaited before the storage service drains/closes.

## Findings repaired

1. JSON settings could become visible before a failed settings-file write was
   acknowledged. The new production path publishes only after the sidecar write.
2. JSON recovery deletion swallowed access/disk failures and returned success.
   Only an absent file is now accepted as already cleared; other failures are
   counted and surfaced by the lifecycle service.
3. Ordinary recovery was preserved outside SQLite in migration copies, so native
   working-copy backups did not include it. Fork creation now imports it safely.
4. The generic record patch helper skipped a settings extension named `id`.
   Settings now update all permitted fields through the typed settings command.
5. Direct source-string checks in older tests still expected JSON-owned handlers.
   Updated those boundary assertions and the Phidget/Parallel Port test fixtures, while retaining
   the behavioural checks and adding lifecycle failure/ordering coverage.

## Validation

- **224 storage tests passed**, including **17 new lifecycle tests**: JSON/SQLite
  parity, failed writes, unknown settings, caller isolation, queue bound, shutdown,
  ordinary/between-heat recovery, invalid/resource snapshots, revision conflicts,
  retry receipts, rollback, backup restore and migration-sidecar tampering.
- Dedicated database, async recovery and performance diagnostics regression
  tests cover the production boundary. Diagnostics tests forbid legacy reads
  when the service is supplied and tolerate a closed worker.
- Packaged Windows Electron ASAR probe passed settings save, ordinary recovery,
  native backup/restore and worker close alongside existing resource/Paddock checks.
- Actual Electron app, isolated profile: selected export/import, complete backup,
  safety copy, settings-cache refresh and reload passed. An ordinary simulated
  race recorded a lap, appeared on Home, resumed paused with the lap intact,
  finalized into session history and cleared its recovery entry.
- Actual resource-race suite passed failure/retry, stock persistence, recovery,
  heat rotation, finalization and duplicate-finalization checks.
- Inspected Home recovery and Import/Export screenshots in dark/light themes.
  Evidence is under `../outputs/sqlite-conversion/bulk-ui` and `../outputs/resources`.
  One capture attempt failed with Electron `UnknownVizError`; a fresh isolated
  run completed and its screenshots were inspected. No app workaround was added.
- The full regression chain passed across the initial run, corrected boundary
  tests and continuation through the final Pit Widgets suite (exit 0). No tests
  were removed or skipped.
- Full regression evidence: `lifecycle-full-suite.log`, `lifecycle-db.log`,
  `lifecycle-suite-continuation.log`, `lifecycle-storage.log` and
  `lifecycle-diagnostics.log` in `../outputs/sqlite-conversion`.

## Remaining gates

This is lifecycle plumbing, not permission to activate SQLite. Specialized
editors, compatibility/full-list and network endpoints still need an explicit
backend strategy. Startup selection, migration activation, crash/reopen recovery,
large-volume qualification and packaged macOS/Linux checks remain.

The existing app may stop waiting for saves after three seconds; a hung/slow disk
is not guaranteed to finish at shutdown. A settings/recovery error already
reported to its caller is not retried implicitly. Resource-ledger clearing and
ordinary-recovery clearing remain separate operations, not one cross-service
transaction. SQLite diagnostics need presentation work before enabling them in
the production performance UI.

Legacy JSON export retains embedded recovery metadata, but older JSON-only builds
do not automatically resume that embedded field: they use their sidecar. Native
SQLite backups retain it; a complete downgrade/recovery UX is still an activation
gate. Old experimental forks created before this phase are not silently modified
to acquire a missing sidecar; create a fresh verified working fork when testing.
