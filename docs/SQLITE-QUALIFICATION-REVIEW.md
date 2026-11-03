# SQLite volume, failure and platform qualification

Reviewed 3 November 2026. All local databases used here are generated fixtures under outputs/sqlite-conversion or temporary test directories. The personal database was not opened, migrated or modified. Conversion remains an explicit user action. The default branch and releases are unchanged; GitHub qualification uses codex/sqlite-qualification only.

## Repairs made

1. **Legacy JSON size validation:** the previous 1 GiB allowance exceeded the runtime string limit. Migration and legacy backup reads/exports now share the smaller runtime limit (536,870,888 bytes on the tested Node 24 runtime, just under 512 MiB). Oversized input is rejected before copying/parsing; interrupted exports are not published. This is a compatibility limit, not a SQLite database limit. JSON parsing still requires memory proportional to the file.
2. **Import/Export media loading:** its selection list previously requested complete collections, including pictures and audio. Both repositories now expose title/ID-only transfer choices. SQLite reads scalar fields without reconstructing media-heavy records. The actual app opened the large fixture and rendered the page with zero full-collection IPC reads and only 18,271 bytes of choices.
3. **Large-database backup access:** Import and Export now offers native backup and restore folders when SQLite is active. Backups are verified snapshots; restore stages and hashes a separate copy, retains the current generation and a before-restore snapshot, verifies on restart and publishes selection last. JSON compatibility controls remain available. Source corruption, disk-full staging, a race starting during staging, and interrupted publication do not select an incomplete restore. JSON restore now also awaits asynchronous final checks.
4. **Native QA portability:** ASAR checks use the installed Electron executable on each OS. Linux CI uses Xvfb and a QA-only sandbox override. Evidence is collected inside the checkout before upload, fixing an invalid parent-directory artifact glob. Native backup controls and a six-launch conversion/crash/JSON/native-restore sequence are included in app QA.

## Windows large-volume result

Generated 1,000,000 laps through twenty 50,000-lap finalizations, plus 128 unique PNG and 128 WAV assets. This tests growth of an activated SQLite database, not conversion of a multi-gigabyte JSON file. Media bytes: 2,147,923,328; resulting database: 3,169,873,920 bytes. Integrity, counters, receipts, sampled asset hashes, verified snapshot, restored copy, reopen and unchanged original JSON all passed.

| Operation | Measured time |
| --- | ---: |
| Finalize all one million laps | 250.9 seconds |
| Store the image/audio collection | 43.8 seconds |
| 100 single-field edits | 97.1 ms total |
| Small catalogue page, first / warm | 7.0 ms / 0.43–0.58 ms |
| Native snapshot and full verification | 127.6 seconds |
| Native restore and full verification | 114.5 seconds |
| Reopen restored repository | 97.4 ms |

Windows x64, Node 24.21.0, SQLite 3.53.4. Process RSS peaked at about 616 MiB. Maximum main-thread timer gap was 196 ms during bulk work; this includes fixture creation/serialization and is not a frame-rate or race-hardware latency guarantee. No percentile or universal performance claim is made from one run.

Evidence: ../outputs/sqlite-conversion/volume-P2ah35/result.json and app-result.json, app-transfer.png. Source hashes at benchmark start are retained in result.json. Later repairs changed transfer choices, legacy limits and app backup orchestration; they do not retroactively change those benchmark measurements. The final app was reopened against this same large fixture and the repaired UI checked again. Warm transfer choices took 7 ms; the first call waited about eight seconds behind initial Home work. Initial Home aggregation still scans history in the worker and took several seconds at this size. Improving that aggregate is a separate performance opportunity; no claim of constant-time startup is made.

## Failure tests and review

The full storage regression command passed **289 tests** locally, including **19 resilience tests**. Package and Help checks passed. The production app passed conversion, forced process exit, recovery/finalization, JSON restore, native backup, native restore and reopen on isolated profiles.

Real SQLITE_FULL is produced with SQLite's max_page_count limit, including a failure after domain writes. Tests verify rollback of receipts, revisions, counters, finalization identities and recovery, then an exact retry without duplicate charges/results. Filesystem ENOSPC is injected at copy, write, flush, link and rename boundaries. No host disk was filled. Checksum corruption, Unicode/spaced paths and abrupt exits before/after native restore selection are covered. Sources and prior generations are retained.

Review covered worker ownership and shutdown, write transactions and retries, backup publication, staged restore selection, IPC ownership/race guards, renderer reads, package paths and CI artifact safety. Native restore checks pending resource events and active Paddock/timing operations before staging and again before publication. The snapshot itself is validated in the worker before activation. Failed staging may retain unselected diagnostic copies; these never become active automatically.

SQLite documents the page cap and resulting full error at [max_page_count](https://www.sqlite.org/pragma.html#pragma_max_page_count) and [SQLITE_FULL](https://www.sqlite.org/rescode.html#full).

## Native platform checks

[Baseline qualification run](https://github.com/theDutchmanJames/SlotForgeTiming/actions/runs/41650457662) passed on Windows Server 2022, Ubuntu 22.04 and Intel macOS 15: storage regressions, 20,000-lap/approximately 2 MiB media workload, actual production activation/recovery, application reopen and an ASAR-packaged worker. The [final qualification run](https://github.com/theDutchmanJames/SlotForgeTiming/actions/runs/41651974420) also passed on all three platforms at source revision d68ba7a126598e3ef8a4abd379f0523bcffe6dd0: 289 storage tests per OS, volume smoke, all six app launches including native restore, and ASAR execution. Native backup controls were visually inspected in the captured Windows, Linux and macOS app screens.

[Qualification branch runs](https://github.com/theDutchmanJames/SlotForgeTiming/actions?query=branch%3Acodex%2Fsqlite-qualification). The workflow has read-only repository permissions, uploads small QA evidence for seven days, and has no release or publishing job. The first run had an artifact-path failure after tests passed and an unavailable Apple Silicon runner; the repaired workflow uses the established Intel runner. Apple Silicon is not qualified here.

## Remaining limits

- The million-lap/2 GiB-media workload ran on Windows only. Linux/macOS use bounded CI fixtures, not the full volume benchmark.
- No physical power cut, faulty hardware, real full filesystem, live timing hardware or real Paddock host was tested in this phase. Process termination and injected failures are narrower evidence.
- A native backup needs substantial temporary disk space, as does keeping both old and restored generations. Native folders require a SQLite-capable Timing build; legacy builds need a current JSON backup within its size limit.
- Selected-content transfer retains its existing bounded format. This work does not make every legacy collection reader unlimited, nor change the default storage backend.
