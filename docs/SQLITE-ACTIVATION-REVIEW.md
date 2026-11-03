# SQLite production activation and abrupt-exit review

3 November 2026. Local implementation; no release or GitHub push. The user's
existing database was not opened, migrated or modified. All execution tests used
generated disposable profiles or copies beneath the QA output directory.

## What is available

App Settings > General > Database storage offers **Convert to SQLite and restart**.
It is explicit and optional. Unselected profiles keep using JSON. The main window
owns the operation; an active race, Paddock operation or reserved plugin timing
connection prevents conversion. The application rechecks after confirmation and
after draining accepted writes.

On restart, the worker copies and validates JSON, its settings sidecar and race
recovery, creates a separate working generation, opens it, and verifies that the
legacy source hashes still match. Only then is `storage-backend.json` published.
Failed attempts and originals remain intact. A selected SQLite database that
cannot be opened produces an error, never a silent fallback to obsolete JSON.

The existing backup UI exports complete compatibility backups. Restoring one to
SQLite stages the exact reviewed input, checks its hash again, keeps a native
before-restore snapshot and the previous generation, and verifies a new generation
before switching on restart. Pending conversion/restore failures offer retry or
cancel-and-reopen; cancellation removes only the pending request. Published
generations are never removed by cancellation.

Settings show the active backend and file. SQLite disables the legacy background
JSON save option and has its own performance-report wording. Help describes
conversion, retained files, recovery limits and exporting a current backup before
downgrading. Older builds cannot see changes made only in SQLite.

## Review findings repaired

- Ordinary sessions lacked a durable cross-process save identity. A renderer exit
  after commit but before clearing recovery could otherwise save results twice.
  Each race now keeps a stable identity through recovery and finalization.
- Results, laps, counters, Paddock outbox entries and recovery reconciliation now
  commit together. A retry returns the original result ID. Deleted-result
  tombstones prevent a stale checkpoint recreating a deliberately removed result.
  Corrections continue through the separate correction commands.
- Finalization writes a current recovery checkpoint first. Failed checkpoint
  writes leave results available for retry rather than claiming completion.
- Completed heat races keep all heat results without retaining the last engine
  as an unrecorded heat. Reopening before commit does not replay the final heat or
  attempt to construct a nonexistent next heat.
- Time Token stints have stable identities, persist their pending list before
  finalization and remove saved stints atomically. Late settings writes cannot
  resurrect them. The initial crash test exposed an object/leaf lookup mistake in
  this reconciliation; it was fixed and the before/after-commit tests now pass.
- SQLite working format 5 seeds identities from existing session records and
  reconciles stale legacy recovery on the new copy. Upgrade reconciliation now
  supplies its own revision-tracking context; a dedicated migration test covers it.
- The lifecycle settings cache refreshes after finalization. Already accepted
  finalizations still acknowledge successfully during shutdown, without trying
  to enqueue a new refresh after the lifecycle has stopped accepting work.
- Restore rechecks race ownership, pending selection, Paddock and plugin timing
  after asynchronous staging. Backup input changes after review are rejected.
- Shared session exports/imports strip local finalization identities. Native
  snapshot restore preserves deleted-result tombstones.

## Verification

- The storage suite passed 268 tests; an additional native snapshot/tombstone
  test was added and verified in the final focused run (269 storage cases total).
- Activation tests terminate child processes at six conversion stages, four
  restore stages, five transaction stages and before/after Time Token commits.
  They verify source bytes, selected generation, all-or-none results and outbox,
  recovery state, counter accuracy and retry deduplication.
- The complete existing pretest/main regression chain was exercised. Failures
  were repaired and the affected suite and remaining chain rerun. Two old mocks
  now return the documented boolean recovery acknowledgement; the old test that
  expected finalization despite failed recovery now checks the explicit retry
  state. The heat-resume suite includes recovery of completed heats before commit.
- The actual production startup path (no SQLite test flag) passed five Electron
  launches: JSON conversion through the real button; lap/paused-race abrupt exit;
  resume and finalization followed by exit before renderer cleanup; reopen with
  exactly one result/lap/counter increment; restore to a new generation and reopen.
- Dark and light theme screenshots were visually inspected in the actual app.
  The long database path wraps and the conversion guidance/control remain readable.
- The packaged ASAR worker probe passed activation and working-runtime access.
  The JSON Electron backup/import/restore and race-recovery probe also passed.
  One run hit a Chromium screenshot `UnknownVizError`; a clean rerun passed.
- Existing marked development-profile SQLite startup/reopen remains supported
  and was rechecked separately. No network calls to a real Paddock database were
  needed; outbox crash tests use synthetic capture and connection data.

Evidence: `../outputs/sqlite-conversion/activation-*.log`, `activation-ui/run-*`,
`bulk-ui` and the ASAR/runtime probe directories. Earlier review reports remain
historical records of their individual phases.

## Remaining qualification and limits

This phase tests abrupt process termination, not physical power loss, faulty disks
or operating-system crashes. Windows publication uses a flushed file and rename;
Unix additionally flushes the parent directory. No claim of hardware-level
power-cut qualification is made. Disk-full and multi-gigabyte stress qualification,
plus macOS/Linux execution, remain separate release gates.

The existing conversion/input and compatibility limits still apply: 1 GiB legacy
input, bounded compatibility reads, 64 MiB worker commands and 100,000 laps per
finalization command. This is not an unlimited-history bulk command. Recovery
restores the latest durable checkpoint; laps since it may need director review.
Shutdown drains accepted work within the existing application timeout.

Failed conversion directories and old generations are intentionally retained and
can consume disk space. There is no automatic cleanup or automatic activation.
The next phase should qualify volume/filesystem/platform behavior and recovery
tools before changing rollout defaults.
