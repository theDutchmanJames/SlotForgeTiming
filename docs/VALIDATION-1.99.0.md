# 1.99.0 — Chart Editor and chart widgets

## Delivered

- A separate Customization → Chart Editor with saved, named designs, duplication and deletion.
- Lap Trend, Driver Comparison and Delta Trend; lap/best/average/median values; all/selected/single lanes; history; cumulative/recent aggregates; track/record/PB/manual references; pit eligibility; excluded markers; legend, patterns, points, thickness and fixed/automatic ranges.
- Layout Editor retains its existing role. Charts → Race Chart selects a saved design, with the existing positioning, sizing and layering controls.
- Shared designs update the active race and its second display. Chart designs are included in static race data. Pit-lap indices now accompany dynamic race data, so both displays exclude the same laps.
- Export/import follows chart references and remaps imported IDs. Existing database/backup initialization creates the new internal chartdesigns collection.
- Help and README include the workflow and filtering rules.

## Automated verification

`node tests/chartwidgets.test.js`: **13 groups passed**. Covers all styles and aggregates, independent median reference, invalid/red/removed/interrupted/pit filtering, historical windows, missing references, empty/missing lanes, safe text, lone samples, 20,000-lap data, drawing reduction, fixed ranges, storage/reopen, export/import, missing designs, real-engine events and second-display parity. Cache tests exercise same-length corrections, invalidation/undo, design changes and resize. The chart computation does not mutate race state.

`electron tools/qa/chart-editor-electron.cjs`: **passed**, using isolated app data. Checks create/save/reopen, settings, invalid ranges, each style at 1200 and 600 pixels, palette/selector/layout persistence, a running production race, refreshed shared designs, unchanged recorded laps, and actual LiveCanvas rendering in dark and light themes. No runtime errors. Screenshots are in `outputs/chart-editor/` at the workspace root. Desktop and narrow captures were visually inspected.

Affected widget registry, Delta, strategy widgets, current Help, picture preparation, performance-screen and installer/package checks passed after fixes.

## Regression repairs (27 October 2026)

The earlier 147-command audit exposed stale expectations from approved rewrites and three implementation regressions. The repair pass keeps the current Race Setup, Fuel, Penalty, Safety Car, Tyre Wear and Push & Save behavior, while checking legacy saved configurations explicitly.

- **Push & Save:** median-mode Push and Save thresholds are independent distances from the benchmark. A Save threshold of 2.3% is no longer raised to 4% by a hidden legacy normal value of 3%. Database validation, cleaning and shared engine reconstruction agree. Regression checks exercise 0.1% Push / 2.3% Save through form persistence, engine configuration and actual fuel/tyre multipliers; legacy normal/save ordering remains enforced.
- **Final Check:** unfinished cars in the same sector regain their ordering arrows. The new card view uses the same controls and commands as the older table. Applied time/lap/point adjustments remain visible when their editor is collapsed.
- **Time Tokens:** a lap after purchased time expires stays automatically late and ineligible. It is no longer also stored as a manual invalidation, which caused duplicate/ambiguous review state. Existing late-lap and correction tests cover the distinction.
- **Regression fixtures:** retired standalone Yellow Flag targets now test Safety Car behavior; removed setup controls, expanded tyres, redesigned pages and current widget folders are checked against their approved replacements. Help describes the current controls. The screen settings mock now returns merged settings, matching `settings:set`, rather than dropping unrelated settings such as Grid view.
- **Timing limits:** the old per-command audit limit of 90 seconds was too short for the deliberately timed live-race scenarios. The full npm chain has no such per-command limit; the optional diagnostic runner now allows ten minutes per command.

`electron tools/qa/regression-repairs-electron.cjs` passed against an isolated production app. It saves and reloads the small median thresholds, clicks the restored sector ordering arrows, changes sectors, checks the persistent adjustment summary, and renders the Final Check at 1200 and 600 pixels. No runtime errors or horizontal overflow. All three captures in `outputs/regression-repairs/` were visually inspected.

**Full verification: `npm test` passed, exit 0 — all 147 pretest/test commands, 13,152 successful checks, no failures.** The final log is `outputs/chart-regressions/full-suite.log`. After the final test-harness edits, `screens.test.js` also passed independently; the additional focused live red-flag scenario passed, including the live PB/track-record/highlight caches. Push & Save model and screen suites passed with the new threshold regressions.

One service-badge assertion failed intermittently during the first full-chain attempt, then passed in isolation and in the successful full chain. Inspection found that the screen-test settings mock returned only the latest patch, unlike the real API, and could lose Grid view. It now returns merged settings; the screen suite passes with that correction. A failure-only diagnostic records card state if this check fails again.

Detailed logs remain in `outputs/chart-regressions/`; `final-verification.json` records the current result. The old `summary.json` describes the initial audit and is not the current status.

## Practical limits

- No physical hardware testing, as agreed. Hardware/timing regression commands are included. No physical-device compatibility claim is made from simulated checks. The follow-up fixes Time Token review bookkeeping; chart calculations do not alter timing or scoring.
- No installer/portable build or source zip was produced.
- Charts request more space below their readable size rather than shrinking all text. Long histories reduce plotted detail while retaining statistical calculations and local extrema/gaps.
- Chart references use the race track's existing `targetLap` field (currently labelled Fuel reference lap time in Database → Tracks). Missing references stay unavailable.


## Code-audit repair pass (27 October 2026)

Approved scope includes full custom compound creation and replacement of an earlier unserved automatic pit tier by a higher tier.

- Corrected-lap sample identity is preserved across checkpoints and reconciled for future Push & Save / tyre-pace calculations. Consumed fuel and wear are not rewritten. Shared viewers receive the authoritative calculated pace reference.
- Lane stripes share one rounded-border decoration across editor/live widgets and both leaderboard formats, independent of ordinary border settings. Median-mode gauge/bar positions agree with state and asymmetric thresholds. Legacy layouts and pace modes remain supported. Obsolete winner-card CSS was removed.
- Custom tyres belong to their Tyre Wear System, with stable codes, a name, standard icon/colour, weather category, lifespan, performance profile and set allowance. Engine weather/pit/inventory/mandatory rules, slotcar choices, widgets, audio, shared views, result/PDF statistics and dependency export/import use those definitions. Blank names are rejected; long names wrap. Deleting a definition makes an unavailable starting compound fall back to Medium in future races.
- Tyre wear keeps six-decimal precision. Profile selection updates both its fields and curve; lifespan editing does not silently select another profile.
- Higher unserved automatic pit tiers replace lower ones, preserving elapsed service. Completed stops and independent Special Penalties remain separate. Recrossing lower thresholds does not create duplicate stops.
- Unique excluded-lap counts avoid double counting. Unavailable points stay unavailable. Comparison bars show actual proportions from zero. New finalized races, heat results and token results retain versioned starting engine rules; historical results are not backfilled.
- Help explains the new behavior and existing tyre-pace / Push & Save multiplier stacking. Calculations now distinguishes its editable Push & Save benchmark from other systems' own settings.

**Verification:** `npm test` passed, exit 0, **151 commands** (12 pretest + 139 main). The final statistics/name and dependency-export refinements were followed by passing custom-tyre, stats, tyre-call, transfer and Help tests. The custom-tyre suite now has six behavioral integration groups; audit repairs have nine.

`npm run test:release:electron` passed all eight isolated production-app harnesses. Additional final runs passed custom form creation/save/reopen/rename/delete, matching profile controls, 600px controls and 60-character names; results at 1200/600px including finalization persistence; and the widget stripe/gauge audit. The compiled Parallel Port simulation passed race laps, source isolation, race ownership, output lockout and separate pit input. Its intentional rejected output-test request is expected evidence, not a failed run.

Actual production screenshots were inspected for stripe geometry and border variants, both leaderboard formats, gauge states, custom tyre forms and results at desktop/narrow widths. Evidence is in the workspace's `outputs/code-audit/repairs.html`, `repair-verification.json`, `full-repair-final.log` and accompanying images/logs.

No physical hardware testing, installer build, source zip or publication was performed in this pass.


## Calculations expansion — 27 October 2026

App Settings now contains six coloured sections and 25 formula cards, independent Push & Save and Tyre Wear method/history/minimum settings, live previews, shared Fuel and Balance of Power edits and access to the original system editors. Tyre pace now uses the chosen method. Existing defaults and legacy Push & Save behaviour are retained. Resumed races use their saved pace policies. Consistency documentation distinguishes the existing result-card population deviation from database sample deviation.

All **151 regression commands passed across the main run and follow-up**: 12 pretest and 95 main commands before the outdated Push & Save wording assertion, then the corrected command and all 43 subsequent commands. Updated expectations retain strict checks for the new labels and canonical policy fields. Main-run exit was 1 at that old assertion; the final 44-command continuation exited 0. Logs: `outputs/code-audit/calculations-full-test.log` and `calculations-remaining-tests.log` in the parent workspace.

All **nine isolated Electron integration harnesses passed**. The final Calculations harness also passed legacy-curve validation, actual app race preparation, settings changes leaving an existing race unchanged, and interrupted-race policy restoration. Actual screenshots at 1200px, 600px and 420px were inspected; dark and light themes retain readable controls and no horizontal page overflow. The independent policy regression tests cover combined fuel/tyre consumption, corrections, checkpoints and authoritative shared-screen references.

Review and machine-readable evidence: `outputs/code-audit/calculations.html` and `calculations-verification.json`. No physical hardware testing, installer build or publication in this follow-up.


## Final audit follow-ups — 27 October 2026

Consistency now uses one shared population standard deviation function in Race Results, saved Statistics and reports, with matching eligible-lap exclusions and a two-lap minimum. Existing saved lap records are unchanged; derived consistency is recalculated on display. This supersedes the population/sample distinction documented in the earlier Calculations pass.

Results comparisons now have a numerical axis in seconds, laps or points. Bars preserve actual proportions, support negative points around zero and keep all-zero results finite. Active Results CSS is consolidated; superseded grid overrides and unused comparison/winner selectors are removed.

**All 151 regression commands passed across the main run and its continuation:** 12 pretest and 129 main commands passed before an outdated CSS-section marker stopped the shadow test. That test was updated to locate the consolidated Results section without relaxing its shadow checks. It and all nine remaining commands passed, continuation exit 0. The main-run exit was 1 at the old marker, not a single uninterrupted pass. Logs: `outputs/code-audit/followup-full-test.log` and `followup-remaining-tests.log` in the parent workspace.

**All ten Electron release harnesses passed, exit 0.** The new results follow-up harness compares computed podium/card styles before and after CSS consolidation: 12 cases (2, 4 and 6 drivers at 1200, 900, 600 and 420px), zero differences. It separately checks axis/bar alignment, tick fit, close-value proportions and horizontal overflow. Actual screenshots were visually inspected at 1200px, 600px and light-theme 420px. Focused Results, Statistics, report, home/car statistics, Help and lane-style tests also passed.

Review and evidence: `outputs/code-audit/followups.html`, `followups-verification.json`, `results-css-comparison.json` and `followup-release-electron.log`. No physical hardware test, installer build or publication was performed.


## All-in-One widgets — 27 October 2026

Added seven complete cards to Customization → Layout Editor → All-in-One: Lane Card, Timing Bar, Driver Dashboard, Pit & Service Card, Race Overview, Strategy Card and Driver Results Card. Presets initialize optional fields; individual overrides persist. Automatic, Wide and Stacked arrangements use the existing widget frame and stripe implementation. These are layout widgets, excluded from leaderboard row cells.

The shared presentation reads existing timing and system views: corrected legal best/average laps, paused clocks, custom compounds, enabled/disabled systems, fuel-range estimates, held and sensor-controlled pit stops, additive penalties and championship/heat points. Results remain provisional until finalized. No engine or hardware rules were changed. Help documents configuration and readable sizing.

**Full `npm test` passed, exit 0: 152 commands (13 pretest + 139 main).** Two existing registry-count assertions were updated from 80 to 87; behavior assertions were retained. The earlier stopped run is historical; `outputs/all-in-one/full-test-final.log` is the successful full run.

All 11 isolated production Electron release harnesses completed successfully (`outputs/all-in-one/release-electron.log`). The All-in-One harness verifies palette controls, preset changes, individual overrides, save/reopen, shared rendering, 28 width/theme cases, long names and minimum-size recovery. A final follow-up also verifies all seven actual default dimensions, numerical column fit and optional title separation. Visual review caught adjacent Strategy Card values at its default size; the fitting logic now checks each numerical column, reduces spacing/size within the readable style, and requests more space if it still cannot fit. The final 10-group unit suite and full All-in-One Electron harness both passed after that refinement.

Actual Electron captures were inspected for all seven default cards, larger variants and narrow/light layouts. Evidence and clickable screenshots are in the parent workspace's `outputs/all-in-one/review.html`, with `verification.json` and logs alongside it. No physical hardware test, installer build or publication was performed.
