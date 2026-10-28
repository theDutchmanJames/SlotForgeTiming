# 1.83.0 validation — Service Stop

Date: 26 October 2026.

## Behaviour

Race Setup has a separate Service Stop section with its own On/Off switch. Missing values and new setups default to Off, preserving normal sensor-controlled pits and race-system timers. On works without any race system in practice, qualifying, races, heats and endurance. Time Token Sessions remain excluded. Turning Off retains the saved settings.

The fixed service timer starts at confirmed pit entry. Fuel, tyre and repair jobs retain their overlap/order, or use the Race Setup override, with their schedule fitted into that duration. Standing Stop-and-Go penalties add sequential time afterward, even beyond the fixed timer; result penalties and driver-swap rules retain their normal meaning. Removal/replacement is observed without counting additional laps or opening another pit. Automatic/manual release, the return guard, sensor rearming, paused clocks, restored races, race finish and logged early overrides are handled in the common engine.

The Pit stops controls show remaining time. Existing Pitstop Time widgets, deltas and timing variables keep their elapsed/recorded pit-duration meaning.

## Automated checks

`npm test` completed with exit code 0: **137 sequential test commands**, the existing 135 plus the two suites below. The complete local log is `work/test-1.83.0.log`. This includes engine/race systems, hardware/protocols, database, transfer, packaging, layout/viewer, reports, recovery and native-helper simulation checks. Windows temporary-file and localhost checks ran with normal execution permissions.

New suites:

- `tests/pithold.test.js`: 16 groups covering defaults, bounds, independent operation, manual and automatic release, required return, delayed ticks, pauses/red flags, interruption recovery, unknown sensors, fixed service order/overlap, fuel/repair/tyre completion, additive multiple/new penalties, early release, mandatory tyre stops/set availability, stale observations and race finish.
- `tests/pitsensors.test.js`: 6 groups using the real Trackmate and Arduino parsers and race bindings, real Parallel Port link/binding with shared and separate pits, filter/rearm settings, disconnects, and authenticated HTTP release commands with valid/invalid lanes. Raw sensor hits continue while held engine laps remain suppressed.

Existing tests that asserted exact Race Setup field/group/rail counts now include the five optional Service Stop settings and their section. The `pitHold` key/default is retained under its clearer label. Relay tests now require state messages to include same-window viewers. Existing timing/delta tests pass with their original metrics.

## Electron

All three checks passed with production main/preload/renderer code and separate temporary databases:

- `npm run test:pit-stop:electron`: real form save/reopen, independent service with no systems, pause freeze, lap suppression, manual release, shared Race Director, early-release IPC, live state update after release, and switching Off through the form while retaining settings.
- `npm run test:parallel:electron`: existing production page/database, real IPC and compiled helper in explicit in-memory simulation mode, race laps, parked races, exclusion of other timing sources, output-test locking, lease release and separate pits without extra laps. The expected rejection of an output test during a race is part of the check.
- `npm run test:lane-style:electron`: existing editor/database, copy/reopen, Undo/Redo, shared viewer and computed stripe styles.

The Service Stop check exposed and corrected an existing routing issue: messages excluded their sending window, preventing the main window's Live Race controls from reaching its parked race. State and commands now reach that window as well. Renderer listeners do not resend those IPC messages.

Electron checks ran hidden. No visible Electron screenshot/review is claimed; hidden-window capture was unavailable on this host. No physical timing hardware was opened.

## Browser visuals

Eight screenshots of the real form/control renderer are in `docs/ui-reference/service-stop/`: setup and pit controls in dark, light and Ocean, and pit controls at 420 and 320 px. Headless Edge used an isolated profile and memory-only fixtures. On/Off visibility and retained values were checked. There was no horizontal overflow and zero browser JavaScript/console errors. Unavailable release buttons are dimmed; cars without an active stop have no release actions. Narrow widths are emulated, not a physical-phone check.

## Delivery and limits

No new dependency or database migration is needed. Source packaging excludes dependencies, generated builds, logs, caches, temporary databases and development previews. The archive has one `SlotForgeTiming/` root; every entry is checked against the source using SHA-256.

No Git commit, push, tag or hosted release was made. Physical LPT/serial/electrical behaviour and a physical phone remain untested, as agreed. The user checks the actual app each release.
