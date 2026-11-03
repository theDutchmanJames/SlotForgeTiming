# SQLite import/export and backup/restore review

3 November 2026. This phase operates on explicit experimental working copies.
Production still selects the JSON backend. No personal database was opened,
converted or restored, and no GitHub push or release was performed.

## Implemented

- `sqlite-bulk.js` resolves selected export dependencies through storage queries,
  including indexed session laps, frozen race classes, custom tyres, custom-field
  definitions and embedded images/audio. Unrelated car/photo/history collections
  are not loaded. The existing transfer rules remain shared with JSON.
- Imports reuse the existing reference remapping, duplicate-name handling and
  legacy upgrades. New records, media, indexes, custom fields and the retry receipt
  commit in one SQLite transaction. File imports require the hash returned by
  review, so replacing a selected file cannot silently change the import.
- Native backups are versioned directories containing `snapshot.sqlite` and a
  final `manifest.json`. `VACUUM INTO` includes committed WAL contents. Verification
  checks SQLite integrity, foreign keys, record reconstruction and media hashes;
  the manifest includes a whole-file SHA-256 checksum. Files are flushed before
  publication. There is no raw copy of an active database's main file.
- Native restore copies into a new exclusive directory, verifies the copied file,
  then publishes `working.sqlite`. It never overwrites or activates a database.
  This preserves command receipts, delivery acknowledgements, resource-run
  identities, field versions and indexes as well as ordinary data and media.
- Legacy full JSON backup export writes one record at a time under a consistent
  SQLite transaction in the worker. Legacy restore validates and normalizes copied
  data, preserves the exact original backup, creates a verified recovery migration
  and forks a separate working database.
- `bulk-storage.js` provides explicit JSON/SQLite adapters. Production item
  transfers, backup/restore and content-pack copies/creation use the JSON boundary.
  SQLite content-pack creation uses the same validator and dependency rules.
  Installed pack/plugin libraries remain separate from database backups.

## Review findings and repairs

1. The production restore safety copy silently ignored copy failures and could
   omit current sidecar settings. It now writes a unique, restorable complete JSON
   backup with current settings, flushes it and propagates failure before restore.
2. Bulk IPC lacked the pack manager's main-window and concurrent-operation guards.
   Imports/restores now reject other windows, overlapping mutations and active
   races/review. The race guard is rechecked after asynchronous preparation.
   Cancelled file selection clears the old pending review in both main and UI.
3. Export dialogs could target an active database/settings/recovery filename.
   These targets are now refused.
4. Duplicate imported IDs could map references ambiguously. Validation rejects
   them before writing, and identity maps safely handle unusual legacy names such
   as `__proto__`.
5. Shared session imports retained local resource-run deduplication identities.
   Copied sessions now drop that operational identity, just as they drop Paddock
   ownership/delivery state. Full backups retain both. This avoids duplicate run
   identities when a later JSON backup is converted to SQLite.
6. Export traversal used repeated array shifting. It now walks the queue by index,
   avoiding that growing cost when exporting many laps.
7. Windows requires a writable descriptor for the snapshot flush; corrected and
   verified in Node and Electron. The test cleanup also closes failed workers.
8. The full suite exposed a reused-PID directory collision in the existing plugin
   rules test. It now allocates a unique temporary directory. Old source-pattern
   checks were updated to recognize the guarded storage boundary; behavioural
   tests cover the actual durability and recovery paths.

## Verification

- 20 new bulk-storage tests cover JSON/SQLite parity, linked sessions and media,
  custom fields, frozen classes/custom tyres, duplicate IDs, retry/reopen,
  transactional failure, WAL snapshots, corrupted files/media, future formats,
  invalid media paths/original data URIs, saved layouts and linked chart designs,
  interrupted publication, worker termination during snapshot and streaming
  export, legacy/defaulted restore, original-file preservation, size limits,
  active-file protection and IPC ownership/race/concurrency guards.
- All 207 storage tests passed, along with existing JSON transfer/backup/content-pack tests.
- Actual packaged ASAR worker: snapshot/restore, legacy export and preservation of
  delivered Paddock receipts, alongside the earlier resource/Paddock integration.
- Actual Electron main/preload/renderer: export, review/import, backup, sidecar
  settings, safety-copy contents, restore and reload, on a generated app profile.
  Inspected light and dark screenshots at 1280 x 900; controls remain readable.
- Full regression chain passed across the initial run and continuation after
  correcting obsolete assertions. The earlier failure logs identify the replaced
  source-pattern assertions; the continuation exited successfully. Logs and
  screenshots are under `outputs/sqlite-conversion` outside the source repository.

## Deliberate boundaries before activation

- There is still no production SQLite switch or in-place SQLite restore. The
  regular app continues to read and write JSON. Lifecycle/settings/network and
  remaining compatibility consumers still need their conversion and review.
- Native snapshots back up SQLite-managed state, not independent plugin/pack
  installations or the legacy non-resource race-resume sidecar. Those belong to
  the remaining lifecycle/release qualification work.
- Legacy selected packages are limited to 48 MiB in the SQLite worker; generic
  commands retain their existing 64 MiB limit. Native snapshots avoid that JSON
  package limit. Legacy full JSON exports/restores have a 1 GiB guard; parsing a
  legacy import still requires memory proportional to that file and can hit the
  runtime's lower string/memory limit. They are a compatibility path, not the
  multi-gigabyte storage format.
- A single unusually large record or media asset is still reconstructed at once.
  Selected exports return bounded JSON over worker IPC; complete backup exports
  stay in the worker. Large-file streaming import remains a future extension.
- Backup needs room for another SQLite file. Restore needs room for another
  working copy; legacy restore also keeps source and recovery copies. Failure or
  cancellation may leave clearly unpublished staging files for diagnosis.
  Tests inject disk failure; they do not physically fill the user's disk or
  simulate storage-controller power loss. Multi-gigabyte peak-space and additional
  filesystem/platform qualification remain rollout gates.
- Legacy export publishes using an exclusive hard link, tested on local Windows
  storage. Filesystems without hard-link support fail rather than overwrite a
  destination; removable/network filesystem support needs qualification.
- Native backup preserves operational SQLite receipts; legacy JSON preserves
  domain data but cannot encode every SQLite revision/command-receipt table.
  Existing JSON restore still uses its legacy two-file persistence implementation;
  the new recovery backup does not make that backend transactionally atomic.

## Explicit developer commands

Run from the source directory, and use only disposable working copies:

```text
node tools/sqlite-bulk.cjs backup <working-copy-directory> <new-backup-directory>
node tools/sqlite-bulk.cjs restore <backup-directory> <new-working-directory>
node tools/sqlite-bulk.cjs export-json <working-copy-directory> <new-backup.json>
node tools/sqlite-bulk.cjs restore-json <backup.json> <new-restoration-directory>
```

`restore-json` reports the separate restored working directory. Nothing is activated
in the regular app. Do not point these development commands at personal app data.
