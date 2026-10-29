# Changelog

## 1.99.2 — 2026-10-29

### Widget customization and live feedback

- Added reusable appearance styles with linking, copying, updates and import/export; independent padding and content spacing; number formatting; text outlines and shadows; and All-in-One arrangements.
- Added conditional appearance rules for race state, driver status and numerical thresholds, with matching behaviour on the main and shared screens.
- Added configurable inward Lap Highlights for completed laps, personal bests and track records, including lane colours, intensity and duration.
- Added horizontal and vertical Fuel Bar and Tyre Wear bar display styles, including digital segments, plus revised flat tyre icons for current and historical compounds.
- Fixed units-below alignment, missing formatting on supported values, numeric driver names, text-colour restoration, specialised widget padding, imported-style validation and shared-screen threshold precision. Existing saved layouts retain their settings.

### Navigation, guidance and race setup

- Redesigned Audio Sets with a side rail for Race Calls, Ambient Sounds and Voice & Playback, preserving existing calls and settings.
- Redesigned Help & Guides with grouped navigation, search, clearer explanations and all 97 existing topics.
- Added responsive Race Setup comparison cards, consistent system controls, session-type sorting and matching editor colours. Fuel, Tyre Wear and Penalty Systems remain directly accessible.
- Clarified Tyre Performance, system guidance and calculation options, with linked visual explanations.

### Pit overviews and fixes


- Added independent Needs Attention and Recent Events widgets under Pit Stops, with lane/category filters, shared styling, readable compact layouts and second-display support. Flag changes and fuel warning transitions are logged independently of audio, with pause-safe race timestamps.
- Fuel Bar widgets now blend from green when full through yellow to red as fuel runs low, independently of the app theme. Saved warning and critical colours and thresholds remain supported.
- Audited the new overviews: added weather tyre deadlines, mandatory stops, overheating, endurance swaps, resource shortages and Service Stop release states; completed the event mappings and second-screen data. Fixed repeated resource warnings after pauses, missed fuel recovery on sensor exit, warning state on lane restart, duplicate tyre-fit history, oversized-title overlap and clipped row backgrounds. Shared history sorting now runs only when the journal changes.

### Validation

- Complete `npm test` chain passed: 184 commands.
- Focused Electron checks passed for widget customization, Audio Sets, Help, Lap Highlights and Race Setup across themes and narrow layouts.
- Physical timing hardware remains untested; see the interface documentation for requirements and limitations.

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
