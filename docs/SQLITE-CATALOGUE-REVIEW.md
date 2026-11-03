# Bounded catalogue reads — implementation and review

3 November 2026. First group of phase-3 UI consumers. **The live application still
uses JSON. No personal database was opened or converted during development.**
Tests used generated fixtures and isolated Electron profiles under outputs.

## Changes

Tracks, Drivers, Teams and the **local** Slotcars list now request at most 48
summaries per page. Search matches names (the car's brand/manufacturer/model).
Case and accents are folded, numbers sort naturally, and IDs break ties so duplicate
names cannot disappear between pages. Search treats `%` and `_` as literal text.
The Paddock Database browser remains separate and keeps its existing API.

Summaries include schema fields, custom values, picture availability, frame metadata
and gallery counts. They exclude picture bytes, galleries, track geometry, historical
captures and unknown large record payloads. Full records are fetched on selection
before opening a view, editor or track-design dialog. Saving never uses a truncated
summary as the source record. Home can still open a car beyond the current page.

Pictures load only near the viewport, with a **global four-request limit** across
page transitions. Old responses cannot paint into a newer page. No unbounded image
cache was introduced. Existing images and framing remain unchanged. These are lazy
original-image reads; off-thread thumbnail generation remains a later step.

Search and page state are retained separately for each entity. Navigation appears
above and below the records. A catalogue change invalidates continuation cursors;
the UI explains the refresh and returns to page one rather than mixing revisions.
Selected-record requests also discard older completions. These new reads do not
automatically refresh or replace an open, unsaved editor.

## Backend contract

`catalogue-read.js` defines validation, summary projection, name ordering and the
JSON adapter. The JSON implementation still scans/sorts in-memory metadata; it
reduces cloning/IPC/rendering work, not JSON startup memory or all main-thread work.
The ephemeral JSON revision/identity token is not written into the user database.

`sqlite-catalogue.js` adds an index to experimental working format **3**, with
transactional upgrade from format 2. Recovery migration format 1 is unchanged.
The index is maintained within each domain write transaction, including Paddock
linking and deletion. Normal pages seek by `(sortKey, id)`; substring search may
scan the small label index but never reconstructs the whole collection. Only the
selected rows' metadata and requested images are read. The worker exposes these
operations explicitly; read-only recovery bundles do not gain write capability.

Each page has a database-specific revision token. A cursor or image request from
another database or an older revision is refused. A single page is consistent;
this is revision checking between requests, not an indefinitely pinned snapshot.

The current renderer uses JSON's repository through two new preload/IPC methods.
The SQLite client and repository implement equivalent methods on test copies.
Production SQLite activation, write-IPC adaptation and recovery remain separate
gates. We do not dual-write JSON and SQLite.

## Review fixes

- Older page requests could reset state belonging to a newer search. Stale responses
  are discarded before changing the current page; duplicate navigation clicks are
  guarded while loading.
- A slow full-record request could overwrite a more recent selection. Detail
  requests now have their own generation check.
- Per-page image concurrency could exceed four during rapid navigation. The limit
  is now shared across pages; queued work from the old page is abandoned.
- Cursors initially distinguished revisions but not databases. They now include a
  per-database identity, with regression coverage at identical revision numbers.
- Empty legacy Paddock metadata needs the same exclusion as JSON's local-car view.
  The index checks the stored shape without loading the captured configuration.
- Returned JSON frame metadata initially shared objects with the source record.
  Summary values are now detached before returning them.
- The first SQL cursor predicate could prevent an index seek. Cursor bounds are now
  part of the query only when present; empty searches omit the substring predicate.
- Preserved the synchronous compatibility view path used by existing adapters and
  screen fixtures. New paged views retain asynchronous stale-response protection.
- Updated the packaging integration check to recognize both preload call helpers.

## Verification

- Final combined storage/repository/catalogue run: **119 passed, zero failed or
  skipped**. Includes migration, write adapters and delivery acknowledgement tests.
  Log: `../outputs/sqlite-conversion/catalogue-storage-final.log`.
- Twelve new catalogue/QA tests cover parity, natural ordering, duplicate names,
  literal search, pagination, stale/cross-database cursors, selected media, complete
  detail retention, rollback/reopen, format-2 upgrade, Paddock ownership and globally
  bounded stale-safe image loading.
- Actual Electron main/preload/renderer checks passed with 125 generated drivers,
  plus tracks, teams and cars: next/previous, search, stale-page recovery, full-record
  edit/save, unknown-field and image preservation, full track notes, List and Grid,
  all nine themes and an additional light Custom palette. The 600px viewport is
  explicitly asserted after removing the test window's minimum-size constraint.
  Evidence: `../outputs/sqlite-conversion/catalogue-ui/result.json` and PNGs beside it.
- The actual worker and dependency graph passed inside an Electron ASAR, including
  the new catalogue query and the previous finalization/delivery checks:
  `../outputs/sqlite-conversion/asar-wepJr2/storage.asar`.
- Broad regression logs are `catalogue-full-suite.log`,
  `catalogue-full-suite-continuation.log` and `catalogue-screens-continuation.log`
  under `../outputs/sqlite-conversion`. The run was continued from each corrected
  failure instead of repeating already passing, unaffected checks. The corrected
  checks and all remaining tests completed successfully (final continuation exit 0).

### Test-launcher incident

An initial direct PowerShell launch let the isolated Electron QA process outlive
its console pipe. Logging to that closed pipe raised `EPIPE` and generated repeated
native error dialogs. The user's screenshot identified `catalogue-electron.cjs`.
No SQLite or personal database error was indicated. Process inspection confirmed
that the leftover helper was gone before verification resumed.

`run-catalogue.cjs` now waits for the GUI child and supplies real log-file descriptors.
QA-only `file-diagnostics.cjs` preserves diagnostics, tolerates closed console pipes,
and fails the helper on other uncaught errors without displaying native dialogs.
The broken-pipe regression and subsequent full UI probe passed. This handling is
confined to QA helpers; production exceptions are not swallowed. Run the probe with
`npm run test:catalogue:electron`, not by starting the GUI executable directly.

## Next steps and limits

- Results/session history, track records and selected-car statistics still use legacy
  full-list reads. Reference pickers (including team drivers), system setup lists,
  Home, race preparation and network consumers are not all bounded yet.
- Local names use deterministic case/accent-folded natural ordering rather than a
  locale-specific collator. Stored order and record contents are not changed.
- Large custom values and unusually large member lists can still enlarge a summary.
  Row count is bounded; this is not a hard byte limit for arbitrary imported data.
- Thumbnail generation, bounded reference search, aggregates, snapshot export,
  activation/rollback and native macOS/Linux qualification remain outstanding.
- No performance percentile or whole-app memory improvement is claimed from these
  functional checks. The original JSON stays authoritative until the later gates pass.
