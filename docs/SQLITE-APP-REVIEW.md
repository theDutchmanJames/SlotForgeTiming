# SQLite application startup and write-adapter review

3 November 2026. This phase uses generated databases and explicitly marked test
profiles. The personal database was not opened or converted. No push or release.

## What changed

`sqlite-app-repository.js` adapts the typed command repository to the existing
renderer API. Editors receive saved records, custom-field controls receive their
saved definitions, and race finalization receives a session ID. A bounded queue
captures input before waiting, obtains current revisions and drains accepted writes
on shutdown. Failed commands do not prevent later writes. The worker still owns
validation, transactions, receipts, linked-car ownership and cascades.
Revision checks query the version directly instead of reconstructing a record just
to obtain its version; a regression assertion covers that boundary.

The existing renderer has two special history edits: excluding a lap from records
and changing championship awards. These now dispatch to domain commands rather
than unsupported generic session/lap edits. The lap command validates boolean flags,
revises the owning session and Paddock delivery when present, and supports imported
orphan laps. Resource sessions use the shared ResourceStore and retain run-based
deduplication. Local-car choices use metadata without loading pictures.

`sqlite-runtime.js` composes records, resources, lifecycle, bulk operations and
Paddock around one SQLite worker. Main uses that composition only with an explicit
`--sqlite-test-profile=<directory>` development argument. The directory must carry
`sqlite-test-profile.json` with format `slotforge-sqlite-test-profile`, version 1,
and a valid `working/working.sqlite` fork. It rejects packaged releases, the normal
profile, unmarked profiles, profiles containing `slotforge-timing.json`, and
redirected working directories. There is no JSON fallback after a SQLite failure.

The ordinary app still uses the existing JSON profile and migration path. Test
startup skips that legacy migration. Plugins, hardware settings and Chromium files
belong to the isolated test profile. Settings and ordinary/resource checkpoints
use the worker lifecycle; finalization continues to schedule Paddock delivery only
after durable saving. The existing shutdown timeout is unchanged.

Selected imports/exports use the worker bulk adapter. The app's JSON backup dialog
uses the reviewed streamed legacy export. Export destinations inside the test
profile are refused, including aliases through directory junctions. In-place
SQLite restore is explicitly unavailable in this development mode; restoring into
a separate working copy remains supported by the earlier worker tools. No live
database replacement is attempted.

## Review and validation

- 243 storage tests pass, including eight new runtime tests. Coverage includes
  saved return shapes, custom values/media, settings, shutdown drain, rejected late
  writes, invalid profiles, damaged database refusal, protected export destinations,
  orphan-lap eligibility, championship awards and counters.
- Resource recovery survives runtime reopening. Duplicate resource finalization
  returns the same session ID without spending twice or retaining a checkpoint.
- A synthetic Paddock host receives a result saved through the application adapter;
  its acknowledgement remains delivered after closing and reopening SQLite.
- Three separate launches run the real main/preload/renderer stack: create a race,
  record a lap and pause; reopen, resume and finalize; reopen again and verify
  settings, history, eligibility, awards and car counters. Import/export and backup
  also pass through actual IPC, and the unavailable in-place restore reports its
  explicit error. Original generated JSON files remain byte-identical and no JSON
  database is created in the SQLite profile.
- Screenshots of the paused race, Home recovery and saved Slotcar statistics were
  inspected at 1280 × 900. The existing light Home/database and dark race views
  render with the saved data. This is not a new all-theme visual audit.
- Windows Electron ASAR checks pass for application CRUD and the existing worker,
  resource, Paddock, lifecycle and native-backup integrations.
- The ordinary JSON app independently passes actual import/export, backup/restore,
  settings refresh, paused recovery and finalization in a generated profile.
- The complete pretest/application regression sequence passed after updating the
  two source assertions described below. The run was continued from each affected
  test rather than repeating earlier passing tests; its final continuation exited
  with code 0. The final 243-test storage run and actual-app/ASAR probes were rerun
  after the direct-revision lookup improvement and also passed.

During review, export protection was strengthened to resolve junctions. Two older
source assertions expected the former unconditional JSON initialization spelling;
they now check the explicit normal-profile/background-save branches. Their storage
and migration behaviour tests remain in place.

Evidence under `../outputs/sqlite-conversion`: `app-storage.log`,
`app-focused.log`, `app-full-suite.log`, `app-suite-continuation.log`,
`app-suite-final.log`, `app-asar.log`, `app-ui/`, and `bulk-ui/`.
Launchers write diagnostics to files to avoid detached-console EPIPE popups.
Run the complete app probe with `npm.cmd run test:sqlite:app`.

## Remaining gates

Production activation is not enabled. This phase verified graceful shutdown and
reopen, not a crash-stop qualification of every renderer save sequence. Ordinary
and Time Token finalization still have separate renderer recovery/settings updates;
abrupt-exit reconciliation at those boundaries remains a release gate.
Next work is explicit migration/activation
and restore orchestration: verified backup, durable backend selection, interrupted
activation recovery, restart and downgrade guidance. SQLite performance-report
presentation, large-volume startup/memory measurements, disk failure qualification
and packaged macOS/Linux testing also remain. Existing bounded compatibility lists
retain their explicit size limits; this phase does not remove all legacy full-list
readers or claim unlimited collection sizes. Physical LAN/hardware verification
was not performed in this phase.
