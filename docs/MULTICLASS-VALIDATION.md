# Multi-Class validation — 27 October 2026

## Implemented behaviour

Multi-Class is a classification layer over the physical race engine. It does not change sensor routing, lap acceptance, clocks, fuel, tyres, weather, penalties, Service Stop or power control. Class definitions and entry assignments freeze at event start and remain with entries through lane rotation, driver swaps, checkpoints and saved results.

The setup supports database defaults from slotcars, drivers or teams; Home overrides; mixed or separate class heats; and independent overall/class scoring. Heat and championship calculations reuse existing scoring rules. Leaderboard designs can inherit the system view, show overall standings, filter one class, or group classes. Five class widgets, class winners, historical/PDF classifications and optional audio calls are included.

Finished multi-class heat events send compact aggregate results to the shared display. The overall podium, comparison chart and class winners use the whole event, rather than the last heat. Event summaries do not transmit another full lap history.

## Automated verification

- Executed the complete existing 161-command regression list and the new Multi-Class command, now included in `npm test` (162 commands total). Initial failures were corrected and the failing/affected commands rerun successfully.
- Updated exact catalogue/schema/tab assertions for the additional widgets, calls, classes and setup page. Found and repaired a real transfer regression that remapped saved participant references twice.
- Added 15 focused integration groups in `tests/multiclass.test.js`: defaults/overrides, frozen definitions, validation, class ranking/gaps, timing parity, virtual-rival isolation, lane exposure, heat bonuses/drops, class-only points, championship points, recovery, safe rendering, manual adjustments, team allocation, import identities, distance gaps, complete event results and class audio.
- Rechecked affected timing, shared-screen, leaderboard, heat recovery, scoring, championship, team, result, report, Help, web and packaging tests. Windows temporarily refused a test database rename during two runs; the isolated database/transfer reruns passed. No production database was used.

## Actual Electron verification

`npm run test:multiclass:electron` runs against a separate temporary app-data directory with timing hardware disabled. It passed the following workflow:

1. Create, save and reopen the system and its database classes.
2. Inspect the setup at 1200 px and 600 px, including the scrolled narrow-screen fields; check for horizontal overflow.
3. Resolve database defaults on Home, start a real renderer race, complete laps and review both classifications.
4. Mount the actual shared Live Race view and verify reconstructed class results.
5. Save the session, award class-only championship points, confirm overall points remain zero, and open class standings.
6. Save/reopen a class-filtered Leaderboard Editor design.
7. Run separate class heats, return through Home and resume the between-heat checkpoint.
8. Verify saved event points, overall podium, both class winners and the class-filtered all-heats leaderboard on the shared view.
9. Confirm no captured renderer exceptions.

Screenshots and logs are in the workspace `outputs/multiclass/` and `outputs/multiclass-electron*.log`.

## Explicit boundaries

- Separate class heats cannot use overall A/B finals. The app blocks this combination and explains why; mixed heats retain the existing finals rules.
- All classes share the race clock and finish condition. Virtual rivals are comparison-only in multi-class events. Time Token Sessions do not use Multi-Class.
- Physical timing hardware was not available and was not tested. The existing hardware/simulation regression tests passed.
- Crowded result pages retain the existing responsive, scrollable layout. Class badges supplement lane colours rather than replacing them.

## Car labels and assigned drivers

New profiles use `assignment: roster` with a `driverClasses` list of stable driver/class IDs. Race Class is a shared database reference on the Slotcar. Users create labels directly in its editor; matching names reuse existing labels. The setup lists labels actually used by cars and selects a subset. Home filters drivers and cars and validates saved assignments. Fresh race entry validates again; recovery retains frozen class assignments. Team/endurance rosters must all share one selected class. Existing profiles retain their previous assignment mode until explicitly converted in the editor. Export/import remaps driver assignments and class IDs.

Disqualified heat contributions are zeroed for scoring and excluded from best laps and bonuses. They remain the worst heat for dropped-result rules and count as zero in lap/point averages. An entry with no eligible attempt is unclassified and receives no class award. Valid results in other heats remain eligible.

`tests/systemsaudit.test.js` covers all seven audit repairs and class selection/transfer rules. `tools/qa/multiclass-roster-electron.cjs` verifies label creation/reuse, five available classes with two selected, driver assignments, filtered car choices, stale selection rejection, save/reopen and a completed race in actual Electron, including 600-pixel layout.

Repair validation: 165/165 regression commands pass across a full run and targeted reruns, including 13 focused audit groups. Both the new driver-assignment Electron workflow and the legacy heat/championship/recovery/shared-display workflow passed. Final evidence is in the workspace `outputs/systems-repairs/` folder. No physical hardware was connected.
