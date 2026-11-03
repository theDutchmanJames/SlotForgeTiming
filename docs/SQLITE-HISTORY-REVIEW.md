# Results, lap history and selected-car statistics

3 November 2026. **JSON remains the application's storage backend.** No personal
database was opened, migrated or converted. SQLite tests use generated data in
explicit working copies; desktop tests use separate application profiles.

## Implemented

- Results requests 12 session headings, 40 track records and 40 personal bests per
  page. Each section has independent navigation. Summary responses exclude photos,
  track artwork and Paddock delivery payloads.
- Opening a session loads its saved results and 100 lap times. The existing rich
  rendering remains: physical and Virtual Rival standings, teams, heats, class
  results, resources, adjustments, tyre stints, weather and championship controls.
- Average, median, consistency, speed and distance always use the complete selected
  session. Display pagination never changes those figures. PDF export explicitly
  requests every lap of the selected session, with a revision check.
- Slotcar statistics no longer transfer all laps, sessions and tracks to the
  renderer. They aggregate the selected car's history. SQLite streams matching
  laps through its car index; reference reads exclude media and host configurations.
- Working format 4 adds session order, record eligibility and car-win indexes.
  Upgrades run transactionally on working forks, leaving the verified recovery
  copy untouched. Domain commands update indexes in the same transaction.
- Cursor revisions prevent mixing pages from different database states. The UI
  refreshes stale pages; retries are bounded. Full-list fallback remains for legacy
  test adapters. Current production preload uses the new methods.
- Help explains paging and complete-session statistics/PDF behaviour.

## Findings repaired during review

1. The experimental repository had two `catalogue` methods. Its Paddock write method
   silently replaced its read method. The write is now `applyPaddockCatalogue`;
   tests exercise both dispatch paths.
2. Delayed car statistics could populate a different dialog after switching cars.
   Responses now check the exact target element before writing.
3. Large PDF exports repeatedly calculated best laps for every row, with an
   argument-spread limit on long histories. Best laps are now computed once per
   driver. A 140,000-lap export regression passes.
4. The first 600px desktop check caught overflowing history controls. Controls now
   wrap; wide session tables scroll inside their body instead of stretching the page.
5. Electron's context bridge drops custom Error properties. Actual-app stale-cursor
   testing caught this; recovery recognizes the established error message as well
   as its code, matching catalogue handling.
6. Reference projections retain Paddock's display name without transferring its
   full configuration. Session summaries respect Virtual Rival classification.
7. Hand-made/older sessions without a standings array remain openable. Record keys
   cannot collide when IDs contain `|`. Invalid/nonpositive timing values cannot
   become fastest records. Equal valid times retain earliest saved eligibility.
8. Lazy-loading initially reopened the Sessions folder after Close all. Selection
   reveal now happens only when requested; real-app tests cover both folder controls.

## Verification

- **132 storage tests passed**, including 13 new history tests covering JSON/SQLite parity, independent
  paging, complete statistics, PDF reads, token isolation, record removal, rollback,
  reopen, working-format upgrade, deletion, Paddock names, Virtual Rival winners,
  team/heat metadata and missing historical references.
- A 200,000-lap selected-car aggregate avoids argument-spread limits.
- Actual worker and packaged ASAR checks exercise catalogue/history reads,
  finalization, restart and delivery acknowledgements.
- Actual Electron app: 12 headings, lazy details, 100-lap pages, complete PDF,
  stale-page refresh, token stints and selected-car statistics. Nine themes and
  actual 600px overview/open-session windows. Screenshots inspected; runtime
  error collection empty. Evidence: `../outputs/sqlite-conversion/history-ui`.
- The full application `npm test` suite completed with exit 0. Packaged ASAR worker
  probe completed with exit 0 (`asar-OEK7lD`). Final syntax and diff checks passed.
- QA GUI processes use waiting Node launchers and real log-file descriptors.
  File diagnostics capture failures without recurring broken-console-pipe dialogs.

Commands: `npm run test:storage`, `npm run test:history:electron`,
`npm run test:sqlite:asar`, and the application regression suite `npm test`.
Logs are under `../outputs/sqlite-conversion/history-*.log`.

## Limits and next work

This improves IPC payloads and DOM work; it does not make the active JSON database
incremental. JSON still holds the complete database and scans history for overview
records and selected-car statistics in the main process. SQLite performs those
queries in its worker, but record winners still require an indexed history scan.
Offset paging is revision-bound, not a claim of constant-time deep pagination.

Selected-session figures still materialize that session's laps to preserve exact
median/consistency semantics. PDF export intentionally constructs the entire report.
Extremely large individual sessions need a later streaming/export memory budget.

Next: migrate remaining reference pickers and Home/live/championship aggregates;
then adapt lifecycle, integrations and bulk import/export/backup before activation.
Do not enable production SQLite until those gates and recovery qualification pass.
These changes have not been pushed or released.
