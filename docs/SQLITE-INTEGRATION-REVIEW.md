# Paddock delivery and resource recovery review

3 November 2026. Production storage remains JSON. SQLite was opened only on
generated fixtures, migrated copies and separate experimental working forks.
The personal database was not opened or migrated. No release or GitHub push.

## Completed integration

- `delivery-service.js` is the common asynchronous delivery pump. The production
  Paddock controller uses `json-delivery-store.js`; the SQLite worker implements
  the same query/command boundary. `sqlite-delivery.js` remains a compatibility
  export. Shared delivery identity does not load SQLite into the JSON path.
- A result is claimed durably before upload. Claims have attempt tokens and
  leases; retry deadlines survive reopening. A retry cannot steal a live claim.
  Successful receipts must match the database, source, session, revision, state
  and payload hash. Late acknowledgements cannot mark a corrected result sent.
- Race finalization schedules delivery only after the local save succeeds.
  Existing race holds, credentials, HTTP routes, immutable captures, result
  revisions and withdrawal semantics remain in place. Stopping the client blocks
  further work while allowing an already-issued upload's acknowledgement to save.
- ResourceStore now queues operations against explicit JSON or SQLite resource
  backends. It clones caller inputs before queueing, checks ledger revisions and
  uses the shared checkpoint validation. Begin, checkpoint, resume, discard and
  finalization work through this boundary. Replays cannot spend supplies twice.
- Main-process recovery and the restore guard read the asynchronous resource
  service. Shutdown waits for delivery/resource work before waiting for database
  writes, within the existing three-second save limit. A request longer than that
  can still require retry after restart; the durable claim makes that recoverable.

## Review findings repaired

1. A queued resource save could otherwise observe later edits to the caller's
   snapshot. Inputs are now copied when the request arrives.
2. Manual retry must not clear a live delivery lease. Both backends enforce that
   rule while allowing an explicit retry to clear a pending backoff deadline.
3. Completed/failed JSON attempts retained tokens. Tokens are now cleared when
   acknowledging or recording failure, preventing reuse of an obsolete attempt.
4. An empty delivery queue could falsely mark an unavailable host connected.
   Connection recovery now requires an actually verified host response.
5. Stopping during pairing could restore credentials or connected status when
   asynchronous work returned. Checks cover both the network and persistence waits.
6. Resource discard needs to reject unsupported ledger/run state before writing.
   Validation preserves the original file when it fails.
7. Existing Paddock tests assumed synchronous delivery reads and immediate retries;
   they now exercise the asynchronous boundary, persisted backoff and real storage
   failure injection. The shutdown fixture now includes Paddock and verifies the
   ordering between delivery completion and the final database flush.
8. JSON outbox enumeration was hashing payloads outside the requested page. It now
   hashes only that batch; a regression test counts payload encodings explicitly.

## Verification

- Full **`npm test` passed**, including its pretest checks and the existing race,
  hardware, widget, layout, import/export and integration regressions. Final storage
  and targeted delivery runs additionally cover the last review fixes.
- All **175 storage tests passed**, including actual SQLite workers, migration
  safety, version conflicts, recovery, idempotent finalization and delivery.
- Final targeted Paddock/storage run: **103 passed, 5 skipped**, no failures. The
  skipped cases require a separate Paddock host source. Loopback HTTP tests verify
  a lost acknowledgement retries the same payload without duplicate host records.
- All **22 resource integration groups passed**.
- Packaged ASAR Electron worker probe passed, including the shared resource
  facade, checkpoint, read and discard, alongside delivery commands.
- Actual application resource QA passed on an isolated generated profile: completed
  tyre services, director adjustments, simulated disk failure, automatic pause,
  save retry, Home resume, finalization, repeat finalization, two-heat continuity
  and live viewer updates. No renderer errors were reported.
- Actual application delivery QA passed against a synthetic loopback HTTP host:
  session-save IPC automatically triggers delivery, the result appears as Delivered,
  and Check Paddock result fetches the receipt without uploading again. This checks
  the real renderer, IPC, scheduler, storage adapter and HTTP client; it is not a
  test of the current external Paddock application or a physical LAN.
- Screenshots were inspected at 1200px in dark theme and 600px in light theme.
  Resource balances, delivery receipt actions, controls and text remain readable; the narrow page scrolls
  normally without horizontal overflow. No production UI redesign was introduced.

Evidence: `../outputs/sqlite-conversion/integration-storage.log`,
`integration-final-targeted.log`, `integration-resources.log`, `integration-asar.log`,
`integration-full-suite.log`, and `../outputs/resources/diagnostics.log` with
`race-resources.png` and `repairs-light-600.png`. Delivery UI evidence is in
`../outputs/sqlite-conversion/delivery-ui/diagnostics.log`, `delivered-1200.png`
and `delivered-light-600.png`.

## Remaining boundaries

This is not full SQLite activation. Paddock catalogue/cache, linking, captured
profiles and status readers still directly use JSON. Their typed SQLite commands
exist, but the controller consumers still need adaptation. JSON delivery enumeration
still scans its in-memory collection; bounded batches do not make that scan indexed.
JSON resource revisions likewise hash the ledger; no new scalability claim is made
for that transitional backend.

Bulk import/export, backup/restore, settings and remaining direct consumers must
be qualified before activating SQLite. There was no physical two-PC Paddock test
in this pass. Personal-data conversion and cross-platform release qualification
remain later gates.
