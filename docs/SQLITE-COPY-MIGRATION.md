# SQLite worker and copy migration

3 November 2026. Phase 2 copy-conversion checkpoint. The application still uses
its JSON database. Nothing in main.js selects this worker or discovers/migrates a
personal database. No release, version bump or network contract change is included.

Subsequent checkpoint: [domain transactions on separate working forks](SQLITE-TRANSACTIONS-REVIEW.md).
The immutable migration bundles described here remain read-only. The newer worker
exposes typed writes only after explicitly opening a separate working fork.

## What is implemented

- A persistent worker with serialized operations, bounded request queue, progress,
  timeout/cancellation handling, graceful shutdown and error propagation.
- SQLite format identification, schema version checks, foreign keys for stored
  fields/assets/index ownership, WAL and synchronous FULL during import.
- Records with stable IDs/order, separately addressable scalar/custom values,
  original object-key order, and bounded JSON leaves for arrays. Laps remain whole
  historical records with indexed session/car/driver/track/timing columns.
- Separate binary media and on-demand reads. Noncanonical data URIs additionally
  retain their original string so reconstruction preserves existing hashes.
- Single-record, single-field, bounded identity-page and session-lap queries.
  Metadata reads do not transfer media bytes. The read-only worker has no SQL or
  unrestricted field-mutation endpoint.
- Explicit conversion of a raw database JSON copy into a NEW bundle directory.
  Existing destinations are refused, never overwritten or resumed implicitly.

## Migration sequence and preservation

1. Read the explicitly supplied JSON. Read its adjacent `.settings.json` and
   `race-resume.json` if present. The settings sidecar overrides embedded settings,
   matching the current application's precedence.
2. Write and flush exact recovery copies. Parse/validate in the worker. Do not run
   the production Database constructor against the source: it normalizes and saves.
3. Import into `staging.sqlite` in one transaction. Preserve unknown fields,
   custom definitions/values, layouts, signed captures, delivery queues, source
   identity, corrections, withdrawals and resource metadata.
4. Check SQLite integrity and owned references; reconstruct and compare every
   record/metadata item using ordered JSON; verify every media hash. Compare source
   and recovery-file hashes again, detecting source changes and newly appearing
   sidecars. The initial copy must be offline/stable, not a live editing source.
5. Close, reopen and repeat verification from disk. Only then publish
   `timing.sqlite` and finally `manifest.json`. The manifest is the completion
   marker. Errors/interruption leave no readable completed bundle.
6. Opening a copy requires the manifest, matching SQLite hash and supported format.
   Unexpected WAL writes and altered copies are refused. Opens are read-only.

Recovery files retain their exact original bytes, including original embedded
settings. The SQLite data preserves the parsed effective database, including the
settings-sidecar override. No legacy defaults/upgrades are silently introduced by
this importer. Their controlled application remains part of eventual activation.
The race-resume file is preserved as a separate recovery artifact, not interpreted
as an already converted running-race checkpoint.

Missing/duplicate record IDs, duplicate custom definition IDs, future formats,
malformed collections, corrupt settings/recovery JSON and unsupported numbers stop
conversion. Historical laps whose session is absent are retained and reported as
warnings: existing manual/deleted-history records must not disappear. This is not
yet a full domain-reference audit or authorization to activate warning-bearing data.

Full Backup and item Export JSON packages are deliberately refused by this raw
database converter. They have envelopes and different semantics. A future UI may
route them through an explicit validated adapter; it must not silently interpret
the envelope as an empty database.

## Developer use (copies only)

From the Timing source directory, with Node 24:

```powershell
node.exe tools/sqlite-copy.cjs "C:\Timing Test Copies\database.json" "C:\Timing Test Copies\conversion-001"
```

The source folder and destination parent must exist; `conversion-001` must not.
Keep the corresponding `database.settings.json` beside the JSON if it exists.
Use another destination after a failed attempt; incomplete bundles are retained
for diagnosis. Do not mistake a staging database for a verified result. Cancellation
or a lost worker response may occur after publication, so inspect the bundle before
retrying; the tool never replays automatically.

```powershell
npm.cmd run test:sqlite
npm.cmd run test:storage
npm.cmd run test:sqlite:asar
```

The ASAR probe currently launches Windows Electron; native macOS/Linux runtime
qualification is still outstanding. Normal automated tests use temporary fixtures.

## Review and evidence

Tests cover exact ordered reconstruction, settings precedence, recovery copies,
custom values, media in arrays, unusual data URI spelling, special property names,
missing/null/empty distinctions, bounded queries, current JSON compatibility,
real Paddock result fixtures (normal, correction, withdrawal, endurance and heats),
source-change detection, existing output protection, malformed/duplicate input,
SQLite disk-full rollback, interrupted publication, corruption, future versions,
worker termination, request serialization failure, timeout, shutdown, queue recovery
and observer exceptions. They use disposable data; the personal database was not read.

Review fixes included:

- Graceful close must drain already accepted requests even with a full queue.
- Media-bearing field reads need asset references; a null placeholder alone is
  ambiguous with an actual null custom value.
- Reopening requires a published bundle hash, not only a marker inside SQLite.
- Extra/unreferenced stored fields must fail reconstruction verification.
- Immutable laps should not create one SQL row per scalar. Keeping one snapshot
  plus indexes reduced the 100,000-lap fixture from roughly 100 MB to 51 MB.
- Fixed SQL statements are reused rather than reparsed for every imported lap.
- Windows test cleanup must close workers before removing temporary SQLite files.

Evidence is outside the repository in `outputs/sqlite-conversion/`: migration and
integration test logs, legacy-regression.log, ASAR runtime result directories and
synthetic scale runs. The scale check uses 10,000/100,000 laps and 128 generated WAV
assets (about 16 MiB raw). Every record and asset is checked, and a main-thread
timer keeps running. These are single warm-disk samples, not p95 benchmarks, actual
UI frame rates, physical timing accuracy or multi-gigabyte capacity claims.

Final checkpoint: 28 new migration tests passed. The combined migration,
repository and Paddock run passed 93 tests with five external-source tests skipped
(`phase2-reviewed-tests.log`). Legacy database, backup, transfer and packaging
checks passed separately (`legacy-regression.log`). The final Electron/ASAR worker
probe passed. No physical Paddock host or macOS/Linux runtime was tested here.

The final source-hashed scale evidence is `scale-reviewed-final.log`, with fixture
and result files under `scale-pIzvld`. Earlier `scale.log`, `scale-final.log` and
`scale-reviewed.log` are superseded diagnostics. The final 100,000-lap conversion
took about 9.7 seconds including repeated verification, stored 50,626,560 bytes,
and preserved all 100,330 records/metadata items and 128 assets. This measures an
initial conversion, not ordinary edits, full app startup or network throughput.

## Remaining phase 2 gates before activation

- Typed domain mutations and atomic race/lap/counter/resource/delivery operations.
  No generic field writes or a second writable master are exposed here.
- Durable versions/receipts/journal, conflict/ABA tests and retry semantics for
  those mutations. Importing an existing delivery queue is not implementing its
  SQLite-backed delivery writer.
- Explicit schema upgrades and complete relationship validation on migrated copies.
- Conversion of remaining direct db.data consumers and legacy compatibility paths.
- Application activation/recovery/downgrade procedure, consistent streamed backups,
  packaged platform qualification and broader interruption/restore tests.

The copy format is provisional until these gates pass. It is not a writable
production database, a new backup format or permission to delete the JSON original.
The raw JSON parser still holds the legacy document in worker memory (up to a 1 GiB
input guard); this phase does not claim bounded-memory multi-gigabyte imports.

Implementation references: [Node 24 SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
and [SQLite WAL](https://www.sqlite.org/wal.html). The synchronous database API is
confined to the worker; WAL files are not shared between PCs.
