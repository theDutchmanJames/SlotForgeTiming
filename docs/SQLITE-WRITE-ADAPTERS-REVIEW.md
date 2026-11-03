# SQLite write adapters and delivery acknowledgements

3 November 2026. Implemented and reviewed on disposable copies. **The application
still uses JSON; the personal database was not opened, converted or changed.**
No storage activation, GitHub push or release is included in this checkpoint.

## Implemented

- Typed record add/update/delete, service reset, settings, custom definitions and
  groups, and atomic championship-award batches. Expected revisions are checked
  inside the write transaction. Session/lap changes retain their dedicated domain
  commands rather than allowing generic edits to measured history.
- `sqlite-repository.js` provides explicit asynchronous adapters for these writes,
  finalization and resource begin/checkpoint/recovery. Callers must retain a stable
  command ID across uncertain retries; committed receipts return the original result.
  Reads expose the record and revision together. This is not a drop-in replacement
  for synchronous callers or the legacy renderer's record shape.
- Subtree updates preserve unknown fields and untouched media BLOBs. Custom values
  remain individually addressable. Catalogue-owned Paddock fields remain protected;
  locally owned custom fields on linked cars remain editable.
- Shared deletion rules keep JSON and SQLite cascades aligned. SQLite loads the
  relevant dependency tables and indexed matching laps, applies domain rules, then
  commits changed records, lap counters, withdrawals and command receipt together.
- Typed Paddock connection, car-link, catalogue/cache and configuration-capture
  writes preserve source identity, local statistics, captured race history and
  result payload signatures. Passwords are excluded from stored connection data.
  Class creation and catalogue changes roll back together on failure.
- Working format 2 adds an indexed outbox. Claims persist an attempt token, lease,
  retry deadline and attempt count before sending. Acknowledgements validate the
  exact database/source/session/revision/state/content hash, then durably commit
  receipt and delivery status. Corrections and withdrawals supersede earlier
  versions; late replies cannot mark the new result delivered.
- `sqlite-delivery.js` uses an injected authenticated Paddock transport. It checks
  host identity/permission, race holds and bounded queue pages. Lost responses retry
  the same result version. Terminal errors require review. Receipt checks retain
  delivery status and the original receipt if a later check fails or mismatches.
- The persistent worker exposes only an explicit operation/command allowlist.
  Format 1 working forks upgrade transactionally; verified recovery copies remain
  read-only and byte-unchanged. Unknown or malformed formats fail closed.

## Review findings repaired

1. Current deletion rules missed references added by newer systems: resource and
   multi-class setup links, Virtual Rival driver links, and preview-track references.
   Schema-defined references now share one cleanup path; driver/class assignments
   also clear correctly. Frozen historical settings are retained.
2. Deleting individual laps could leave car counters stale. Shared removal now
   adjusts totals and service counters, without refunding historical resources.
3. Inconsistent old track/session/lap labels could leave orphan laps or a result
   that Paddock still considered valid. Removal follows both identities and queues
   withdrawals for every affected session.
4. Large history deletion initially rewrote counters for every lap. It now batches
   them per affected car, while retaining each lap's session-date fallback. A SQL
   trigger regression verifies two counter writes for a 500-lap, one-car deletion.
5. Local custom fields on linked cars were over-restricted by the earlier SQLite
   adapter. Their local ownership is now preserved. Definition removal also handles
   legacy `custom: null` containers without damaging media.
6. Two workers opening a fresh working fork could race during schema upgrade or
   fail during the preliminary read-only validation. Upgrade rechecks the version
   inside the transaction; validation now uses the same bounded lock wait.
7. Failed result conversions could disappear from outbox browsing. They now remain
   visible as attention-required entries and cannot be sent without correction.
8. Invalid responses to a receipt check now persist a check error while retaining
   the previously acknowledged delivery and receipt. In-flight checks against a
   superseded revision are ignored.

Tests also verify rollback after dependent writes and before acknowledgement
commit, stale versions/tokens, interrupted attempts, manual retry, deleted-session
withdrawals, exact payload hashing, preserved originals, untouched media and
configuration history, resource recovery, and malformed working schemas.

## Verification

- Final combined storage/repository/Paddock/resource run: **165 passed, 5 skipped,
  0 failed** (170 runner entries). The five skips need a separate actual Paddock
  host fixture; they are not passes. The resource script additionally reports its
  22 integration groups. Log: `../outputs/sqlite-conversion/write-adapters-combined.log`.
- Full application `npm test`, including pretest, completed successfully. It covers
  existing widgets/layouts, race systems, database behaviour and integrations.
  Log: `../outputs/sqlite-conversion/write-adapters-full-suite.log`. Final storage
  fixes were checked again in the combined suite after that run.
- The JSON database regression suite was rerun after the final shared deletion
  change and passed: `../outputs/sqlite-conversion/write-adapters-json-parity.log`.
- Concurrent first-open regression: **20/20 fresh disposable copies passed**.
- Packaged Windows Electron 45 ASAR probe passed with an isolated profile: migrate,
  fork, update, finalize, claim, acknowledge, reopen/retry and check a receipt.
  It runs the actual worker and packaged dependency graph, not a mock SQLite engine.
  Final archive: `../outputs/sqlite-conversion/asar-CLhYmx/storage.asar`.
- A loopback HTTP stand-in drops the first acknowledgement after accepting a result.
  Retrying sends the identical payload and leaves one host record. This exercises
  Timing's actual HTTP transport, but is not a physical two-PC Paddock validation.

No new performance percentile, frame-rate or real-hardware durability claim is made.
Previous benchmark reports retain their original code hashes and measurements.

## Remaining work before changing the live database

1. Adapt remaining direct consumers and lifecycle operations to async, versioned
   commands. Wire transport scheduling and connection exclusivity centrally; do
   not operate the JSON and SQLite writers together against production data.
2. Migrate screens to bounded summaries, indexed filters, revision-aware pagination
   and lazy media. Current pages are not a snapshot across multiple page requests.
3. Complete import/export, content packs, consistent backup/restore and explicit
   activation/recovery. Audit shutdown, resume, settings and plugin boundaries.
4. Qualify Windows/macOS/Linux packages and a real Paddock LAN connection, plus
   interrupted migration/restore and realistic collection sizes before rollout.

Deletion still scans relevant dependency-table metadata; complex records can
contain arrays. Withdrawals and resource state retain aggregate representations.
These adapters do not establish constant-memory behaviour for every operation or
make whole-collection renderer consumers disappear automatically.

Eventually SQLite becomes the authoritative database and normal screens query
only the required records/fields/media. The original JSON is retained for recovery
during migration. JSON remains useful as an interchange/export format and for small
configuration files; removing every JSON file is not the objective.
