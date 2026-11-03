# Shared media and storage management — phase 4

Implemented and reviewed locally on 3 November 2026.

## Changes

- SQLite working format 6 stores each distinct binary media body once by SHA-256. Individual references retain their MIME type and exact noncanonical data-URI spelling. Images and audio can share identical bytes without changing their meaning or export representation.
- Existing working databases upgrade transactionally on open. Verified conversion copies remain in their original format. The upgrade checks body hashes and original URI integrity before publishing the new format. A failed or interrupted upgrade leaves the legacy asset table recoverable and can retry.
- All existing storage readers and writers retain their seven-column `assets` interface through a view and write triggers. Foreign keys protect references; the last reference deletion removes the body inside the same transaction. Conflicting bytes under an existing hash abort the write.
- Native backups include shared media, references and replay protection. Verification hashes shared bodies once, then validates reference paths and exact original URI spelling. Legacy exports reconstruct the original values. Restoring older formats upgrades the new working copy.
- Local catalogue and Paddock list previews use at most 512-pixel PNG/JPEG/WebP thumbnails. Each preview cache is bounded to 128 entries and 12 MiB of string storage, coalesces concurrent requests, and retries failures. Revision-qualified keys prevent stale local previews; Paddock caches are scoped to the browser instance and photo key. Originals remain available for full views, editing, racing and export. Unsupported/failed thumbnail conversions retain the original display; oversized results are not cached.
- Conversion, working-copy creation, shared-media upgrade, backup and restore have free-space preflights with a 32 MiB reserve. Estimates are conservative, not reservations or guarantees. Unsupported space probes do not block operation; transaction rollback still protects data if space disappears afterward.
- App Settings → General → Database storage now shows unique media bytes, references, deduplication savings, reusable database pages and free volume space. Diagnostics reports include the same information. Values refresh once a minute and explicitly exclude additional recovery copies/backups.
- The disposable refresh journal retains the latest 10,000 changes, with up to 127 additional changes between periodic trims. Startup also trims it. Expired cursors require a refresh instead of silently returning an incomplete history. Command receipts, finalization/resource identities and delivery records are retained; cleanup cannot authorize replay of old operations. Latest revision sequences remain monotonic.

## Review fixes

1. Existing upgrade fixtures simulated older schemas by changing only their format number. They now reconstruct the actual legacy asset table before exercising old-format upgrades.
2. Old write-isolation guards targeted the former `assets` table. They now guard `asset_refs`, preserving the tests that small field changes and result delivery must not rewrite photos.
3. The old disk-full fixture could reuse pages freed by deduplication. It now compacts its generated database before imposing a page limit. Separate tests cover SQLite FULL during the upgrade itself.
4. Native backup validation initially hashed the same body at each reference. It now hashes each shared body once while retaining per-reference validation.
5. A secondary Paddock image map could retain previews outside the bounded cache. With the thumbnail service active, only that bounded cache retains them.
6. Small media totals initially rounded to zero MiB. The settings panel now selects bytes, KiB, MiB or GiB appropriately and labels unavailable space separately.

## Validation and evidence

- Final storage regression: **332 tests passed**, including 12 shared-media/storage-management tests and two thumbnail-cache tests.
- **112 Paddock integration tests passed**, including JSON/SQLite signed configurations, scalable catalogue/photo transfer, delivery and result context.
- Existing screen, performance/diagnostics, package and both Help checks passed. All 111 Help topics remain available.
- Fault tests covered thrown interruptions, abrupt child-process exit during schema migration, disk-full rollback and successful retry, corrupt bodies/original URIs, digest collisions, transaction rollback, last-reference deletion, reopen, snapshot restore and exact legacy export.
- A synthetic fixture with 33 references to a 256 KiB image/audio body stored one 256 KiB body, avoiding 8 MiB of duplicate bodies. Its compact native snapshot was less than one quarter the original verified SQLite copy's size. Existing working files can retain freed pages for reuse; this is not a promise of immediate file shrinkage.
- Actual Windows/Electron checks exercised 1024-pixel originals rendered as bounded list thumbnails, unchanged originals after editing, pagination/search/stale revisions, all four catalogues, all nine theme selections and 600-pixel controls. The new storage panel was inspected at 600 pixels.
- Actual-app scalable Paddock browsing, offline specifications/local editing and backup/restore passed. The packaged ASAR worker probe passed with the new storage modules included.

Logs are under the parent workspace's `outputs/sqlite-conversion/media-*.log`. Screenshots and app reports are in `catalogue-ui/`, `bulk-ui/`, `outputs/paddock-specs/` and `outputs/paddock-scalable/`.

## Safety and remaining boundaries

### Post-review correction: backup UI harness restart loop

The original phase 4 `run-bulk-storage.cjs` zero exit was not a valid completion. Its JSON-specific harness created a fresh profile, which now defaults to SQLite. Restoring triggered a real relaunch before the assertions finished; the relaunched harness made another fresh profile and repeated the cycle. The user reported the repeated windows, and the remaining QA process was stopped. Personal profiles were not involved.

The harness now seeds an isolated JSON database, explicitly keeps that backend, asserts it before testing, and blocks any unexpected `app.relaunch`. Its launcher requires a unique per-run success marker written only after every assertion; zero exit or a stale result is insufficient. Two regression tests verify these guards. The repaired actual-app run completed in nine seconds, including JSON restore/reload and ordinary race recovery/finalization, and a process check confirmed no Timing QA process remained. See `outputs/sqlite-conversion/bulk-loop-fix.log` and `bulk-ui/completion.json`. The earlier general backup/restore claim should be read with this correction; the SQLite automated snapshot/restore tests and ASAR probe were separate checks and remain valid.

All tests used generated databases and isolated profiles. The personal database and Paddock source were not read or changed. No GitHub push or release was made. On a future launch, an active SQLite profile will upgrade its working schema transactionally; retained JSON/recovery copies stay unchanged. Older builds that do not understand working format 6 must not open the upgraded database; use a compatible backup/export for moving between builds.

Native Linux/macOS runners were not rerun for this phase. Windows tests include the packaged Electron SQLite worker; the earlier native-platform qualification remains evidence for earlier phases only. Physical power-loss and a new two-PC acceptance run were not performed.

Exact noncanonical URI text remains per reference, so savings describe shared binary bodies rather than every byte of encoding metadata. Full original images still cross the existing lazy catalogue IPC before client-side thumbnail creation; this improves repeated preview decoding and retention, not that initial transfer. Existing public API bounds and JSON import/export limits remain unchanged. No arbitrary custom-field, championship/class or workshop-maintenance exchange protocol was added.
