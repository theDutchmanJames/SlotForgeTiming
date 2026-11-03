# SQLite and Paddock final qualification

Prepared 3 November 2026. This records phase 5 qualification, before the authorized
2.1.0 release and rollout. The original qualification snapshot lives on
`codex/sqlite-qualification`; phase 5 did not change the default branch or publish
downloads. Version 2.1.0 was subsequently chosen for the qualified changes.

## What will change for users

- New installations use SQLite. Existing JSON users choose conversion, a reminder,
  or continued JSON use. Conversion verifies a separate generation before selecting
  it. Original JSON files remain available but stop receiving updates after conversion.
- Catalogue, history and Home reads are targeted. Shared image/audio bodies reduce
  duplication, while previews use a bounded thumbnail cache. Full originals remain
  available for editing and export.
- Results, resource recovery and Paddock delivery use durable identities and queued
  acknowledgements. The richer Paddock view preserves ownership and signed data.
- Native SQLite backups include the current database state. Restores are verified
  into a separate generation. Older builds need a compatible export or backup;
  they must not open an unsupported working schema directly.

The user-facing release notes are the 2.1.0 section of `CHANGELOG.md`.

## Findings repaired during qualification

1. Concurrent first opens could both observe schema 5 before taking the write
   lock. After the first upgraded to schema 6, the second attempted to rename the
   compatibility view as a table. The media upgrader now rechecks the version
   inside `BEGIN IMMEDIATE`. A deterministic two-connection regression covers the
   sequence, alongside the existing concurrent worker test.
2. The Mac plugin-rule fixture used the `/var` temporary-directory alias. Plugin
   symlink protections correctly rejected it. The fixture now resolves its physical
   path; plugin protections are unchanged.
3. Single-process catalogue, specifications and delivery UI launchers now require
   a unique completion marker written after all assertions and prohibit relaunch.
   The JSON backup harness also repaints its window after reload before capturing
   screenshots, avoiding a missing Chromium compositor surface.
4. The Unreleased changelog contained intermediate claims that production still
   used JSON. It now describes the final conversion choices and storage behaviour.
5. The temporary qualification index initially omitted executable bits on the four
   desktop build scripts. The snapshot now retains their existing Git modes; the
   native build-script regressions check them after checkout.
6. A cold Windows Phidget helper exceeded its four-second handshake allowance.
   Initial startup now allows twelve seconds, with a deterministic delayed-start
   and no-start test. Race heartbeats, output acknowledgements and native watchdogs
   retain their existing deadlines. The compiled simulator checks also run locally.

## Evidence and limits

The qualified application candidate is `91c08412c8fb9be0fcb8b2409253ba9141ecdfc7`.
All three native jobs passed in [run 41685131810](https://github.com/theDutchmanJames/SlotForgeTiming/actions/runs/41685131810).

| Native runner | Full regressions | Bounded volume/backup | Actual app and ASAR checks |
| --- | --- | --- | --- |
| Windows Server 2022 x64 | Passed | Passed | Passed |
| Ubuntu 22.04 x64 | Passed | Passed | Passed |
| macOS 15 Intel | Passed | Passed | Passed |

There are no unresolved failures from this qualification. Evidence artifacts are
attached to the run with seven-day retention. The Linux artifact was downloaded,
its SHA-256 verified, and its 600 px storage and delivered-results views inspected.
Any subsequent documentation-only qualification commit does not change the tested
application candidate above.

The workflow covers full regressions, bounded volume and backup/restore, production
activation and abrupt exits, rollout choices, startup/reopen, the ASAR worker,
catalogue thumbnails, specifications, Paddock delivery, and legacy JSON restore.
Evidence uploads are limited to small logs, screenshots and result markers;
database files and synthetic media collections are excluded.

Local evidence under the parent workspace's `outputs/sqlite-conversion/`:

- `phase5-regression.log`: complete `npm test` passed. The subsequent changed
  storage tests passed all 336 cases in `phase5-storage-final.log`; the changed
  plugin-rule fixture and Phidget audit/backend tests passed separately.
- `phase5-paddock-contract.log`: all 110 Paddock tests passed, with no skips, using
  the available Paddock source. Native CI skips source-dependent Paddock checks
  because that separate local checkout is unavailable; loopback integration runs
  on all platforms.
- `phase5-volume.log` and `volume-2FZRZ2/result.json`: 1,000,000 laps and
  2,147,923,328 bytes of unique media; restored database 3,409,293,312 bytes.
  Backup verification took 136.3 seconds and restore verification 122.0 seconds.
  Reopen took 75 ms; five small catalogue reads took 0.36–3.97 ms. These are fixture
  observations, not general latency guarantees. Peak parent RSS was about 558 MiB,
  and the largest parent timer gap was 360 ms during bulk work.
  Original JSON bytes and selected media hashes remained unchanged. This volume
  run began before the concurrency guard was added to `sqlite-media.js`; the
  final guard is covered by the deterministic regression and native bounded runs.
- `phase5-package.log` and `phase5-packaged-app.log`: unpublished Windows x64
  directory package built successfully. Its actual packaged `app.asar` was loaded
  through Electron in an isolated profile, created SQLite without JSON, preserved
  record/settings writes across a second process, and rendered the database page.
  This does not test installer execution or OS installation prompts.
- `catalogue-ui/`, `delivery-ui/`, `bulk-ui/` and `outputs/paddock-specs/`:
  completed app assertions and captured views. The local catalogue/specification
  checks exercise all nine theme selections and 600 px layouts. Storage usage,
  specifications and packaged database screenshots were visually inspected.

The last local process check found no remaining Timing QA Electron process.

All local runs use generated databases and disposable profiles. The personal
Timing database and Paddock database are not opened or converted. Paddock source
is read only by the local contract tests, whose hosts use generated collections.

Native qualification targets Windows x64, Linux x64 and Intel macOS. It does not
qualify Apple Silicon, physical timing hardware, physical power cuts or another
two-PC network acceptance run. Disk-full tests use SQLite page limits and injected
filesystem errors, rather than filling the user's disk. The large media/history
fixture runs locally on Windows; native CI uses a smaller fixture.

## Publication steps, after approval

1. Choose the next version; update package and lockfile versions, and finalize the
   changelog heading. Preserve the qualified application code or rerun affected checks.
2. Merge/push the reviewed changes to the default branch and tag that exact source.
3. Build the Windows portable/installer, Linux packages and the chosen Mac target.
   Run packaged-app smoke checks and verify source/archive contents and checksums.
4. Publish only completed, verified downloads. Keep Apple Silicon explicitly
   unqualified unless its own build and runtime checks pass.
5. Include conversion, backup and downgrade guidance with the release. A successful
   test branch run is not evidence that installer downloads have already been built.
