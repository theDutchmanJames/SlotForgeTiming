# SQLite compatibility and network phase review

3 November 2026. Production remains JSON. All SQLite operations in this phase
used generated test data or copies of generated profiles. Personal data was not
opened or converted. No release or GitHub push was performed.

## Changes

- `compatibility-read.js` gives older editor readers the existing array, record,
  custom-field and linked-lap-count shapes using a SQLite worker. It is separate
  from `SqliteRepository`, whose command API deliberately returns revision-bearing
  responses and requires stable command identities.
- `sqlite-compatibility.js` reads complete records in insertion order, including
  original embedded media and unknown/custom values. Pages contain up to 64 rows,
  normally up to 4 MiB. A larger single record can occupy its own page. Records
  above 64 MiB are refused, with a preflight check before reconstructing full
  records/media. Aggregate compatibility lists stop with an explicit error above
  100,000 rows or 256 MiB. They never silently truncate results.
- Every page carries the database identity and revision. A change between pages
  invalidates the entire read. These are bounded compatibility reads, not a claim
  that all older editors are now scalable. Existing targeted/paged readers remain
  the preferred path for large histories and collections.
- Main-process list IPC awaits the repository before measuring or returning its
  rows. The network server awaits list/custom-field reads. Main wires network
  reads through the repository instead of directly to the JSON database. Existing
  response arrays, readable-entity restrictions, authentication and command checks
  remain unchanged. No new public metadata or mutation endpoint was added.
- Content Pack choices use a names-and-IDs projection on both backends, avoiding
  loading the contents of image/audio sets. The bridge accepts explicit repository,
  bulk, lifecycle, pack-library path and idle-wait dependencies. It can operate with
  SQLite and no JSON database object. The pack library itself remains a separate
  file, preserving its existing installation, enable/disable and rollback design.
- Pack creation awaits asynchronous collection before opening the save dialog,
  rechecks the race lock, and releases its action lock on failure. Copy commands
  supply a command identity to the SQLite importer. Main transfer collection and
  restore calls also await their storage adapters.

## Review and repairs

The principal incompatibilities were unawaited reads: promises would otherwise be
sent to the network as empty objects or handed to list diagnostics as if they were
rows. Content Pack creation likewise needed to await its prepared bundle, while
the picker was unnecessarily loading media-heavy full records.

Checked cursor ownership, insertion order, empty lists, exact image strings,
custom-field options, linked valid/invalid laps, missing records, invalid entity
names, worker failure, race-lock changes during preparation and action-lock
release. Metadata/prototype entity names are rejected before querying. SQLite
linked-lap counts use the existing lap index rather than reconstructing history.

Old IPC/diagnostics tests required their expected handlers to be asynchronous.
Their assertions were updated; behavioural coverage was retained. The initial
new Content Pack fixture used invalid image data and was corrected to a real PNG
in the existing image-set format. A restricted-sandbox temporary-file rename
failure was rerun outside that restriction against disposable fixtures.

## Validation

- **235 storage tests passed**, including **11 compatibility tests** covering
  JSON/SQLite read parity, multi-page media preservation, stale-page rejection,
  private entities, metadata-only choices, size limits, real loopback HTTP,
  asynchronous production IPC and Content Pack import/export without JSON.
- Focused database, Content Pack, network, web, package, diagnostics, transfer,
  backup, Race Setup and chart regressions passed (exit 0). Evidence is in
  `compatibility-final-regressions.log` under `../outputs/sqlite-conversion`.
- Packaged Windows Electron ASAR passed compatibility reads alongside existing
  settings, recovery, backup, resource and Paddock checks.
- Actual app/preload/renderer, isolated profile: a QA-only read-only probe routes
  compatibility calls to a SQLite copy. Race Setups, Content Pack choices and
  network reads passed. Database writes are explicitly refused during this probe,
  and the source JSON is checked byte-for-byte afterward.
- Inspected the populated Race Setup screen and Content Pack choices in dark/light
  themes. The initial Race Setup capture preceded Chromium painting; the helper
  now waits for painting and the completed capture was inspected.
- The ordinary production JSON app also passed export/import, backup/safety copy,
  restore/settings refresh, Home recovery, paused resume and finalization in a
  separate generated profile.

Evidence: `compatibility-storage.log`, `compatibility-final-regressions.log`,
`compatibility-ui/`, `bulk-ui/` and the ASAR runtime logs under
`../outputs/sqlite-conversion`. Safe launchers use file-backed diagnostics to avoid
the previously observed detached-console EPIPE errors.

## Next gate

No production SQLite activation flag was added. The UI read probe is not a full
SQLite application run. The remaining work is the application-facing write
contract (record return shapes, revisions and session operations), composition of
the storage services, and complete startup/reopen/restore activation on isolated
profiles. Storage selection, migration recovery, downgrade behaviour, large-volume
qualification and packaged macOS/Linux validation remain before personal migration.

Compatibility limits are deliberately explicit for the experimental backend.
An older editor that exceeds them still needs a targeted query; raising the cap
is not a scalability fix. Network responses remain complete JSON arrays and may
still be expensive for large collections. This phase does not alter the Paddock
protocol or claim physical two-PC network qualification.
