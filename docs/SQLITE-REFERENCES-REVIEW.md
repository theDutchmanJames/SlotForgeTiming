# Reference reads review — 3 November 2026

This checkpoint converts Home and ordinary database reference selectors to a
shared JSON/SQLite metadata contract. Production remains JSON. All SQLite and
desktop checks use generated disposable databases; personal data is untouched.

## Implementation

- `referencePage` returns at most 200 metadata rows per call, in existing stored
  order, with an entity-specific revision-bound cursor. Seven supported collections:
  tracks, drivers, slotcars, teams, layouts, audio sets and image sets.
- Retain names, classes, driver type/rival link, team members, track dimensions and
  lap limits, service counters and layout lane colours. Omit photos, galleries,
  track geometry, widget definitions, audio payloads and Paddock captures from choices.
  Linked-car ownership and archived status remain available without the capture.
- `referenceDetails` retrieves complete selected records, including unknown/custom
  values and media, for up to 32 unique IDs. Revisions must match. Missing IDs
  return null. SQLite executes both contracts through its persistent worker and
  existing format-4 indexes, without a new migration.
- Renderer retries stale pages and mixed reference revisions with a bounded retry
  count. It drops partial results before retrying, so it cannot duplicate choices.
- Home loads selected weather/tyre image sets and only pictures needed by visible
  mileage/service rows. Picture concurrency is limited to four. Late results cannot
  repaint a different Home draw or a page opened after navigation.
- Before starting, Home fetches the complete selected track. Imported Circuit
  geometry/artwork/tuning are retained. A changed catalogue rejects the launch with
  a refresh message. Leaving Home while the request is pending cancels the launch.
- Database ref/member fields use the shared metadata reader. A schema's image-from
  reference deliberately retains its legacy read so setup card artwork survives.
  Complete editor records and mutation paths are unchanged.

## Review and verification

- Seven new tests cover all seven collections, 425 drivers across several pages,
  JSON/SQLite metadata and complete-record parity, omitted media, Paddock ownership,
  stale cursors/selections, invalid/oversized requests, detached results, worker
  round trips, bounded renderer retries and legacy fallback.
- All 139 storage tests pass. A guard test makes full SQLite record/blob reads
  throw during reference projection. With the synthetic 32-KB avatar fixture, the
  first metadata page is below 1% of the full driver collection's serialized size;
  this is payload evidence, not an application speed benchmark.
- Actual Electron application: 205 drivers (206 choices including blank), Home
  references with full-list reads blocked, selected image set only, visible car
  pictures only, archived Paddock filtering, team member selectors, stale launch
  rejection, navigation cancellation, and successful two-driver race initialization
  with the complete saved Circuit track and lane lengths.
- Home captures reviewed in all nine themes, including loaded photos and selected
  image-set artwork. A narrow capture respects the app's existing minimum width;
  it is not a 600-pixel layout certification. At that minimum width, the existing
  long welcome heading can overlap Customize; this storage change does not alter
  Home layout CSS.
- The initial desktop probe checked a nonexistent `live.eng` property; the actual
  race had initialized. Corrected it to the app's `live.engine()` accessor and
  reran successfully. Theme captures now wait for repaint before being recorded.
- Packaged ASAR worker verification passes, including reference page and complete
  selected-record queries. Safe waiting Node launchers keep console output attached
  to real log files, avoiding broken-pipe error dialogs.
- Full application `npm test` completed with exit 0. The final storage rerun also
  passed all 139 tests. Syntax checks and the CRLF-aware Git whitespace check pass.

Commands: `npm run test:storage`, `npm run test:references:electron`,
`npm run test:sqlite:asar`, `npm test`. Evidence is under
`../outputs/sqlite-conversion/reference-*.log` and `reference-ui/result.json`.

## Remaining scope

This is bounded transport, not a virtualized native dropdown: selectors still
collect all metadata options. The active JSON backend still holds the whole
database in memory and uses its existing save behavior. No overall latency claim
is made for that backend.

Home still reads sessions and laps for its aggregate cards. Race initialization,
championship-wide readers and specialized screens retain existing bulk reads.
Settings/lifecycle, production Paddock delivery, import/export and backup/restore
also require their remaining adapters and recovery qualification before activation.

Next: move Home/history aggregates and race initialization onto targeted queries,
while retaining complete selected race configuration. No push or release here.
