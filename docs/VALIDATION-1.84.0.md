# 1.84.0 validation — race integrity and Racing systems

Date: 26 October 2026.

## Behaviour

When Red is called, each active car has the lap in progress marked as a red-flag interruption. The next accepted crossing keeps that lap for distance/race order but saves it invalid and excludes it from fastest-lap, Personal Best and Track Record calculations. The optional Race Setup addition is applied once per active car per Red call to result time only; the raw lap sample and paused duration clock remain unchanged.

Race Setup stores comma-separated defaults for selected Racing systems. The Race page and shared Race Director can reverse them for the active race. Disabling keeps values and history, prevents new effects and pauses applicable schedules. Existing penalty obligations and pit jobs retain their captured work. Re-enabling shifts time/lap schedules by the disabled period instead of catching up. A compact system-change audit is saved only for races/heats where a live switch changed.

Championship practice and qualifying can be skipped or restored from Home. A skipped session advances progression but makes no race session, lap record or points. Races and already driven sessions cannot be skipped. The historical dry compounds Superhard, Ultrasoft and Hypersoft join the tyre registry and default tyre-wear settings; their gameplay values are intentionally app defaults, not real-world performance data.

## Automated checks

Focused node checks passed for the changed race engine, setup forms, words, weather/tyre registry, tyre wear/sets/widgets, Home card, screen integration and performance screen. The standard `npm test` chain contains **139 sequential commands**; its long-running full unattended execution should be repeated in the release build environment. New suites:

- `tests/raceupdates.test.js`: 9 groups for red-flag invalidation/result additions/recovery, skip/undo semantics and the nine-compound tyre registry.
- `tests/racesystems.test.js`: 10 groups for saved/live reversible switches, retained values, paused weather/damage schedules, pit commitments, recovery and final-race safety.

The focused checks also confirm that all nine tyre compounds appear in the setup form, tyre choices, tyre sets/widgets and Home's **Tyres Available** card.

Four isolated Electron checks passed with temporary app data and no timing hardware:

- `npm run test:pit-stop:electron`
- `npm run test:parallel:electron` (built-in Parallel Port simulation; its expected locked-output rejection is part of the test)
- `npm run test:lane-style:electron`
- `npm run test:race-updates:electron` (real setup save, main Race and shared Race Director switching, and protected red lap)

## Limits

No database migration or dependency was added. No physical timing interface, electrical sensor, actual Parallel Port device or physical phone was opened/tested. The user performs actual-app review per release as agreed. The historical tyre colours/names follow Pirelli/F1 materials, while their wear defaults are SlotForge gameplay settings.
