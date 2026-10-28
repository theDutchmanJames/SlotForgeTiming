# Changelog

## 1.99.1 — 2026-10-28

Initial source snapshot for this repository's fresh Git history.

### Included

- Lap timing and race management for practice, qualifying, races, heats, championships and team endurance events.
- Configurable Race Systems, Multi-Class racing, Virtual Rivals, Resource Systems and simulated tyre temperature.
- Custom timing layouts, leaderboards, charts, results screens, audio and the free-canvas Widget Builder.
- Trackmate, SlotForge Arduino, Parallel Port and Phidget interface implementations, with the documented platform and hardware-validation limits. DS Electronics remains capture-only; oXigen Digital is not implemented.
- Updated App Settings and interface pages, setup copying and alphabetical driver, car and track databases.

### Repairs included in this snapshot

- Arduino configuration and output tests respect race ownership; pending light tests are cancelled when a race opens. Emergency power-off remains available without resuming an existing red flag.
- Charts embedded in custom widgets animate through the shared update loop, fit their allocated boxes and retain their state when repeated in leaderboard/results rows.
- Updated regression assertions and reviewed CSS fixtures, with independent option and surface checks retained.

### Validation

- Complete `npm test` regression chain passed.
- Eleven Electron/performance suites passed, including 24 focused repair checks and visual inspection in Electron.
- Physical timing hardware has not been validated for the new interface implementations. See the relevant documentation in `docs/`.
