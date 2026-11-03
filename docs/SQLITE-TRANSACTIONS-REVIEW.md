# SQLite domain transactions — implementation and review

3 November 2026. This is an experimental backend checkpoint, not activation.
The application still uses JSON. Tests and measurements use disposable fixtures;
the personal database and its recovery files were not opened or converted.

Later checkpoint: [write adapters and delivery acknowledgements](SQLITE-WRITE-ADAPTERS-REVIEW.md)
implements the next mutation/outbox work and upgrades working forks to format 2.
The measurements and remaining-work list below describe this earlier checkpoint.

## What is implemented

`sqlite-working.js` creates an explicit **working fork** of a verified migration
bundle. It refuses an existing destination, checks the copied file hash, adds its
transaction schema in one transaction and publishes `working.sqlite` only after
closing successfully. The original JSON, recovery copy and immutable migration
manifest remain unchanged. Unsupported working formats and duplicate imported
resource-run identities are refused. Working schema version 1 is independent of
the underlying copy-storage format version 1.

The existing persistent worker now supports opening these forks and a closed set
of domain commands. No renderer IPC or `main.js` backend switch is enabled.

| Command | Atomic effect |
| --- | --- |
| `finalizeSession` | New session and measured laps, service/lifetime counters, captured Paddock delivery intent, resource-run identity, optional final resource checkpoint and closure |
| `setRecordEligibility` | Only `noTrackRecord` and `noPersonalBest` flags, with the session's rebuilt Paddock correction/revision |
| `deleteSession` | Session/lap removal, counter decrements and pending Paddock withdrawal; consumed resources are never refunded |
| `setCustomValue` | One scalar custom value on a local driver/car/track, checked against its definition and field version |
| `resourceCheckpoint` | Resource spending and its recovery checkpoint together |
| `resourceClear` | Close the explicitly named recovery run without refunding its stock |

Each command requires a stable `id`. Its canonical input hash, result receipt,
record revisions and private change-journal entry commit in the same SQLite
transaction. An exact retry returns the original result after reopening, without
duplicating laps or spending. Reusing an ID with different content is refused.
Failed commands leave no receipt or journal entry. An uncertain response must be
resolved by looking up the receipt or retrying the same command ID and content.
Do not generate a replacement command ID after a timeout.

Imported resource runs have no historical input fingerprint: retries return the
existing session, matching the JSON backend. New runs also reject conflicting
content. Deleted runs retain a tombstone and cannot silently recreate results.

Custom edits use per-field versions, so different fields can be changed
independently. Same-field conflicts and changed-away-and-back edits are rejected.
Session corrections/deletions check a record revision. Resource mutations check a
ledger revision. These checks occur inside the write transaction, including when
two worker connections compete. New record ordinals are monotonic after deletion.

## Compatibility and bounded work

- Existing `paddockrecords.js` builds payloads, corrections and withdrawals. Frozen
  configuration signatures, source identity and historical session data retain
  their representation. No host API, authentication or upload implementation is
  changed.
- Existing `CarStats.afterService` and `sinceOf` rules govern counters. Laps are
  processed in their original saved order, including older missing-counter cases.
- Counter writes load only counter/service fields. Result commands read only
  Paddock source/withdrawal state, not its entire catalogue. Tests install SQL
  triggers to refuse accidental asset deletion or catalogue rewriting.
- Custom edits update one leaf and its shape/version; unchanged BLOBs are not
  loaded or replaced. Linked Paddock car catalogue values remain protected.
- Missing, empty and null custom values remain distinct. Text, number, date and
  pick-list definitions are validated. Custom definition creation/deletion and
  media editing need their own future commands.
- Commands are bounded experimentally at 64 MiB of canonical JSON and 100,000
  laps. This is not a new production limit or permission to enlarge existing IPC
  limits. Large sessions still require further memory/streaming qualification.
- Resource ledger storage still uses its existing aggregate representation.
  Normalizing large account/history collections is a remaining scalability task.
- The private journal stores at most 128 changed identities per command, per-entity
  totals and an explicit `requiresRefresh` flag, not field values or photos. Readers
  must refresh affected entities when that flag is set. It is not a public Paddock
  change feed. Retention/compaction remain future work.

## Review fixes

1. Kept writable forks separate from hash-verified immutable recovery bundles.
2. Changed deletion traversal from UUID order to saved lap order, preserving the
   legacy service-counter fallback. Added a JSON differential regression.
3. Removed full Paddock-state and car reads from counter/result transactions.
4. Extracted the resource transition into `resource-checkpoint.js`, shared with
   the JSON `ResourceStore`, rather than maintaining two copies of its rules.
5. Added comparison of the already-recorded resource event prefix: a checkpoint
   cannot rewrite old spending merely because its ending balance still matches.
6. Detached resource snapshots from caller-owned mutable objects and used own-key
   lookups when updating keyed resource accounts/runs.
7. Refused sparse/nonfinite command values and mismatched custom-field types.
8. Bounded large-race journal entries and validated resource-run state before
   closing an imported checkpoint, including inherited object keys/future formats.
9. Updated worker cancellation/timeout messages to explain checking a durable
   command receipt as well as the migration manifest.

The shared resource helper is the only new behaviour used by the existing JSON
application in this phase. Its persistence queue and database commit mechanism
remain unchanged. Resource lifecycle/engine regressions cover the extraction.

## Verification

31 new transaction tests cover JSON parity, exact Paddock payloads, correction and
withdrawal, duplicate retries, close/reopen, custom-field conflicts, resource
spending/closure, deletion tombstones, unchanged source/media, unsupported formats,
SQLite-full rollback, forced worker termination inside a transaction and competing
worker connections. Faults injected after session/lap/counter writes and before
commit verify that dependent writes, receipts and journal entries roll back.

Combined storage/repository/Paddock/resource run: **125 passed, 5 skipped, 0 failed**
(130 test-runner entries; the resource script also reports 22 integration groups).
The five skips require a separate actual Paddock host fixture; they are not passes.
Evidence: `../outputs/sqlite-conversion/transactions-review-final.log`.

The full application `npm test` (including `pretest`) completed successfully,
covering existing widgets/layouts, race systems, hardware-interface simulations,
imports/exports and database behaviour. Log:
`../outputs/sqlite-conversion/transactions-full-suite.log`. The targeted suite and
ASAR probe were rerun after the final review fixes.

The actual worker and its dependency graph also passed from a generated ASAR in
Windows Electron 45. The probe migrates a fixture, creates a working fork, writes
a session, closes/reopens and retries without creating a duplicate. It uses an
isolated profile, not the open application's data. Evidence archive:
`../outputs/sqlite-conversion/asar-parmQ6/storage.asar`.

Synthetic scale check: 100,000 existing laps, 64 unique PCM WAV assets (16,780,032
bytes of decoded audio), then a 10,000-lap finalization and 100 custom-value edits.
One warm local run recorded 438 ms for finalization and 52 ms for all 100 edits;
maximum gap on the main process's 10 ms timer was 20 ms. Receipt survival, unchanged
source bytes and one unchanged audio BLOB were verified. These are neither UI
frame-rate measurements nor cold-start/p95 claims. The result stores source hashes:
`../outputs/sqlite-conversion/writes-tJJs3k/result.json`.

## Remaining gates before activation

This does **not** complete every phase-2 domain conversion. Still required:

- Remaining record CRUD, custom-definition changes, cascade deletions, service
  resets, settings and integration-specific mutations through typed commands.
- Paddock delivery-attempt/acknowledgement transactions and indexed outbox queries;
  the current production upload path still writes to JSON.
- Resource begin/recovery UI adapters and remaining direct `db.data` consumers.
- Explicit activation, rollback/downgrade and consistent backup/restore workflows.
- Bounded UI readers, lazy media and revision-consistent pagination. Current
  ordinal pages are not a multi-page snapshot guarantee.
- Larger workloads, retention, complete schema migration policy and native
  macOS/Linux packaged checks. No physical LAN or power-loss test is claimed.

The next checkpoint should convert the remaining mutation adapters and outbox
acknowledgements, with differential tests, before switching any screen or personal
database to SQLite. No release or GitHub push is included in this work.
