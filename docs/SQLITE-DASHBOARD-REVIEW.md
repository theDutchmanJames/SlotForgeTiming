# Home statistics and race preparation — 3 November 2026

This checkpoint adds targeted reads behind the existing repository boundary.
JSON remains production storage. SQLite tests use disposable working copies;
desktop checks use generated app profiles. No personal data was migrated and no
release or push is part of this checkpoint.

## What changed

### Home

`homeStatistics` returns the data needed by the configured Home cards: last race,
record to beat, totals, recent races, fastest laps this week, records on all tracks,
top drivers, car mileage and personal bests on the grid. Existing service counters,
weather/tyre artwork and selected picture reads remain in their existing paths.

The shared calculation makes one pass through saved laps. It retains record and
weekly candidates and counters per car/track, rather than retaining every lap.
SQLite reads lap rows through an iterator inside its worker transaction. Finished
card data crosses IPC, not the underlying lap list. Home layouts containing only
non-history cards skip the history-statistics request entirely.

`homeSessions` supplies qualifying choices for the selected track and complete,
media-free results for the selected championship. It keeps both the newest
qualifying result and newest qualifying result with standings: the existing UI
uses those for different controls. Ties keep the previous UI ordering. The SQLite
reader filters session summaries before reconstructing relevant results.

The compatibility path remains for older renderer test adapters without these
methods. It is not used by the shipping preload. Failed statistics requests show
a retry message rather than presenting fabricated zero totals.

### Race preparation

`raceInputs` loads complete selected cars, both layouts, the audio set and linked
fuel, penalty, damage, weather, tyre, safety-car and Push & Save systems. Selected
Paddock captures and unknown fields are preserved. All driver metadata remains
available for record-holder names; full driver data is loaded for racing drivers
and every member of a participating team. Time Token sessions deliberately retain
all driver avatars because a new driver can be assigned during the session.

Ordinary races receive compact personal/track/pace records instead of all saved
laps. Token and physical-racing records keep their existing separate eligibility.
The startup query checks the catalogue revision obtained with the complete Circuit
track. Navigation and overlapping asynchronous draws cannot initialize an obsolete
race. Preparation errors return to Home with an explanation.

SQLite adds an auxiliary `history_track_start(trackId, ordinal)` index on explicit
working copies. Authoritative record shapes and working format 4 remain unchanged.
Existing format-4 copies create the index on their next working open; new copies
create it alongside the history indexes.

## Review findings and fixes

- Removed nested SQLite transactions when projecting metadata inside the new
  transaction. Projection now has a shared transaction-free helper; public page
  reads retain their own transaction.
- Preserved Paddock display names and unnamed record labels instead of replacing
  them with a generic schema-derived name.
- Preserved team substitute avatars, Time Token reassignment data, and complete
  selected primary/secondary layouts and audio.
- Kept a blank track-record holder when there is no record, rather than inventing
  a Guest record. Kept original record eligibility and qualifying tie behavior.
- Added startup revision checks and cancellation guards for pending reads.
- Fixed the existing plugin runtime test's process-ID-based temporary directory.
  Windows reused a PID and the test found a previously installed fixture plugin.
  It now uses a unique generated directory. No production plugin behavior changed.

## Verification

- Twelve new tests compare every Home aggregate with the existing HomeStats
  functions, across all-time/year and selected-track/all-track options. Fixtures
  include invalid, late, too-slow, pit and Token laps; deleted records; team wins;
  Paddock labels; empty histories; tied qualifying and championship metadata.
- Complete selected-record parity is tested between JSON, SQLite and its persistent
  worker, including layout widgets, audio, Paddock captures and team avatars.
- A guard makes full SQLite record/blob reads throw during Home statistics.
- The complete storage suite passes **151 tests**.
- A generated **100,000-lap** iterator is consumed once. The test returns under
  **4 KB** of card data and the exact 100,000-lap/2,000,000-metre totals. This is a
  structural/payload test, not an end-to-end application latency benchmark.
- Actual Electron app checks pass with renderer full-list calls for laps, sessions,
  drivers, cars, tracks, teams, layouts, audio and image sets blocked. They cover
  Home cards, photos, selected artwork, 205 driver choices, team selectors, stale
  startup rejection, navigation cancellation, complete Circuit track/lane lengths,
  saved record seeds and a two-driver race using the selected widget layout.
  Every history-backed Home card was rendered and checked separately. A weather-only
  layout was verified with the statistics API forced to throw if called. Overlapping
  race preparations retain the newest engine after the older response arrives.
- Home captures were produced across all nine themes. Dark/light Home and the
  race layout were visually inspected. No layout CSS was changed here.
- The packaged ASAR SQLite worker passes dashboard and race-input queries in
  addition to previous storage and delivery checks. GUI launchers use file-backed
  logs and wait for the child process, avoiding broken-pipe dialogs.
- The full application `npm test` suite completed with exit 0 after correcting
  the fixture-directory collision. Final actual-app verification, syntax checks
  and the CRLF-aware Git whitespace check pass.

Commands: `npm run test:storage`, `npm run test:dashboard:electron`,
`npm run test:sqlite:asar`, `npm test`.
Evidence: `../outputs/sqlite-conversion/dashboard-*.log` and
`../outputs/sqlite-conversion/dashboard-ui/result.json`.

## Limits and next work

The JSON backend still owns the full database in memory and computes its summaries
in the main process. The SQLite implementation performs this work in its worker,
but still scans history for aggregate calculations. Session metadata/standings and
candidate maps grow with the number of sessions, cars, drivers and tracks. These
are not constant-memory or constant-time queries; only the full lap array and
unrelated media are removed from this path. All-track cards still return a row per
track, matching the existing UI.

Championship race initialization intentionally retains complete history until
`Season.past` has a dedicated aggregate adapter. Row/chart designs, image sets and
team artwork also retain their complete race-display contract: arbitrary widget
references and live chart refresh need an explicit dependency adapter. This work
does not guess which of those resources a custom design might use.

Next: championship aggregates and the remaining display dependency reads, then
lifecycle/integration writers and bulk import/export/backup qualification. Do not
activate production SQLite before those gates and recovery checks pass.
