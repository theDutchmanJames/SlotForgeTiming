# SQLite and Paddock final qualification

Prepared 3 November 2026. This is release preparation, not a published release.
The qualification snapshot lives on `codex/sqlite-qualification`; the default
branch, existing tags and downloads are unchanged. The package version remains
2.0.0 until the next release version is chosen.

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

The user-facing release notes are the Unreleased section of `CHANGELOG.md`.

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

Final qualification results are recorded after the native runs complete. The
workflow covers full regressions, bounded volume and backup/restore, production
activation and abrupt exits, rollout choices, startup/reopen, the ASAR worker,
catalogue thumbnails, specifications, Paddock delivery, and legacy JSON restore.
Evidence uploads are limited to small logs, screenshots and result markers;
database files and synthetic media collections are excluded.

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
