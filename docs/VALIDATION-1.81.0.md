# 1.81.0 validation — Parallel Port

Date: 26 October 2026. The approved Parallel Port setup design is implemented in App Settings → Timing Hardware. No physical hardware was accessed for these checks.

## Automated regression

`npm test` completed with exit code 0: **134 sequential test commands**, comprising the existing 130-command chain plus four Parallel Port suites. The full log is retained locally in `work/test-1.81.0.log`. Windows database rename tests required normal execution permissions; the initial sandbox attempt failed on temporary-file rename permissions.

New coverage includes configuration validation; register inversions and both active polarities; one crossing per edge; initial held sensors; pulse filtering with original timestamps; clear-state rearming; shared and separate pits; optional pit-lap counting; track-call edges; malformed/disconnected/out-of-order samples; actual polling-gap statistics; output ownership masks and inactive polarity; real race-engine timestamps; countdown, flags, retirement, Time Tokens, reconnects and asynchronous race leases.

The actual compiled helper ran only with explicit in-memory `--simulate` ports. Checks cover handshake and clock alignment, sample sequences, output-test gating and expiry, masked writes, inactive output values on STOP, watchdog expiry, driver-protocol errors, cancellation during opening and clean shutdown. The production controller's rejection of a simulated helper was also verified. Actual IPC handlers were exercised with stand-ins to reject other windows, subframes and output writes for another selected timing source.

Existing Trackmate, Arduino, engine, race-system, database, network and packaging tests pass. The old `blockCar` path is retained for keys and Arduino; Parallel Port uses timestamped pit occupancy without an implicit crossing. The timing-source choice test was extended for the new fourth option; a database-handler assertion now allows validation before the existing awaited asynchronous write. Package checks verify the helper, source and notice are included and the executable is unpacked from ASAR.

## Browser review

Microsoft Edge rendered the production page modules and shared app styles against isolated in-memory settings and port events. Dark, light and Ocean were reviewed. The page, connector view and expanded optional sections fit at 1280, 420 and 320 px without control overflow. The automated review reported zero JavaScript/console errors.

Interactions verify driver-check feedback, live edge counts, calibration and saving, duplicate pins, invalid hex addresses, explicit control-input capability selection, fixed ground pins, failed-save feedback and retry, and settings/connection locking during a kept race. Screenshots of the built renderer are in `docs/ui-reference/parallel-port/`, numbered 01–05. The preview's port events are simulated; these images do not establish electrical operation.

## Electron integration

`npm run test:parallel:electron` passed using the production main process, preload, page, settings database, race screen and compiled helper. The QA launcher replaces only the helper launch with `--simulate` and explicitly enables that handshake for the test controller. Each run uses its own `.tmp-test/parallel-electron-<pid>/` database. The normal application never requests simulation.

The check saved through the real setup page and database, counted native helper transitions, acquired race ownership, counted two engine laps including a parked race, ignored Trackmate events while Parallel Port was selected, rejected an output-test request during that race, and released the race lease on leaving. A second race confirmed a separate pit input starts/ends occupancy without adding a lap. The expected output-test denial is printed by Electron's IPC handler; the check asserts that rejection. No normal visible-window review or Electron screenshot is claimed; the user reviews the real app each release.

## Dependencies and remaining checks

There is no new npm dependency. The Windows helper was compiled with the installed .NET Framework compiler. Its SHA-256 is `9E07C1AA39C056447B2768A85112478CDEED35D58C0DEE0082F4B56A3C56B259`. Source and the rebuild command are included.

Physical LPT ports, expansion cards, InpOut driver installations, Windows driver compatibility, short sensor pulses, sensor circuits, relays/lights and a real phone were not tested. No kernel driver, service or security-setting change was installed or applied. Native timestamps and requested polling are tested in simulation; no physical timing accuracy is claimed. Software output shutdown cannot replace a hardware interlock. See `PARALLEL-PORT.md` for setup, sources and limitations.

## Delivery

The source ZIP contains one `SlotForgeTiming/` folder, including the compiled helper, source, tests and documentation. It excludes installed npm dependencies, caches, temporary databases, development previews and logs. Archive entries are checked by SHA-256 against the working files. No Git commit, push, tag or hosted release was made.
