# Changelog

## 1.99.6 — 2026-11-01

- Reduce Paddock-related stalls by preserving serialization caches for unchanged photos, laps and sessions. Keep durable saves and rollback behaviour for links, captures and delivery receipts.
- Send lightweight catalogue metadata to the window and load photographs one at a time for the visible page. Unchanged checks preserve cards and decoded images.
- Avoid redundant photo copies during catalogue refresh, use measured response bytes for transfer limits, and keep connection-dialog car lists paginated with photo-free local selectors.
- Add targeted persistence tests and a photo-heavy actual-app performance check covering search, pagination, changed pictures, narrow layouts and cleanup.
- Restore local-car detail navigation after browsing Paddock; bypass local photo-table reads when entering the remote database view and validating a selected race car.
- Preserve keyboard focus during background catalogue checks and finish a queued car-selection click using the refreshed data.
- Restore linked-car state after a failed archive save, and use explicit missing/archived error codes rather than matching arbitrary error text.
- Group catalogue Help under Database & app settings and clarify Paddock 0.19.0 compatibility and the exact limits of native release smoke tests.

## 1.99.5 — 2026-11-01

- Add separate Local Database and connected Paddock Database views, with direct race-car selection and automatic profile caching.
- Check catalogue revisions every 30 seconds while browsing; download only changed catalogues, retain complete caches after failures and back off retries. Empty result queues no longer poll the network.
- Preserve linked car identities and race history across renames, refresh public specifications and race classes, and retain pinned configurations for recorded races.
- Keep previously selected cars available offline, including upgrades without a full catalogue cache; prevent newly archived or reclassified cars from silently entering an unsuitable race.
- Preserve Multi-Class car filtering and the existing reviewed-results, corrections and withdrawals workflow.
- Add a Paddock host handoff for an optional public catalogue revision, with compatibility fallback to the current API.
- Add regression tests, updated Help and actual-app verification across all themes and narrow layouts.

## 1.99.4 download refresh — 2026-11-01

- Add native GitHub Actions desktop builds for Windows, universal macOS and Linux, with regression tests, packaged-app smoke checks and verified release uploads.
- Display Paddock receipt warnings and check previously delivered results on demand without resending them.
- Refresh the bundled Paddock v0.18.0 handoff schema, fixtures and guidance.
- Accept generated Paddock Timing codes and custom case-sensitive passwords without storing credentials.
- Respect authentication cooldowns across connection attempts, catalogue requests and result delivery; show the remaining wait while preserving queued results.
- Clarify independent Paddock JSON imports versus live links, with compatibility coverage for car specifications, photographs, race classes and repeat imports.

## 1.99.4 — 2026-10-31

### SlotForge Paddock integration

- Added a local-network Paddock connection under Database → Slotcars, with discovery, pairing, car linking, catalogue refresh and delivery status. Requires Paddock's Timing v1 API.
- Linked cars keep their Timing identity and race history. Paddock owns catalogue specifications and Race Class; Timing retains local simulation and service settings.
- Capture signed car configurations before racing, use dated cached configurations offline, and queue finalized results with corrections and withdrawals. Virtual rivals do not contribute physical mileage.
- Repaired lap timestamps and driver attribution after review deletion, fractional-clock boundaries, late sensor input, network retries, persistence failures, incomplete catalogues and error-state presentation.
- Fixed local Endurance stint counts, distance boundaries and driver attribution after lap deletion while preserving actual swap times.
- Improved automatic discovery with four attempts over about four seconds, per-adapter sockets, a local subnet broadcast fallback and clearer search/error messages.
- Added regression coverage and actual-app checks across all themes and at 600px. Two-PC Windows LAN connection is user-verified; the discovery retry fix still needs confirmation on that setup.

### SlotForge Track Builder integration

- Import track profiles, lane lengths, transparent artwork and supported route/tuning data into the Track Database.
- Live Track follows imported layouts with either coloured lanes or the imported artwork, including profile-based estimated movement.
- Repaired imported-track selection, validation, drawing and scrolling workflows.

### Licence

- Adopted the SlotForge source-available licence used by Track Builder. See LICENSE for the terms applying to this release.

## 1.99.3 — 2026-10-29

### Plugins

- Added separately installed JavaScript plugins with generated settings, commands, persistent data, supervised background processes, logs, safe startup, updates and rollback.
- Added plugin timing interfaces with sensor assignments and acknowledged power/light controls through the shared timing path.
- Added plugin widgets, pages and tools using app-rendered controls and existing widget styling, including shared race screens.
- Added bounded race-rule contributions for fuel use, tyre wear, time consequences and competition points. Rules are frozen before racing and preserved with recovery and results; Time Token sessions are not supported by this API.
- Improved the Plugins page with clearer feature groups, relevant navigation shortcuts and explanations of installation, settings resets, recovery and rollback.

### Content Packs and integration repairs

- Added versioned Content Packs under Import and Export for sharing reusable content and themes, with dependency handling, preview, updates and rollback. Content Packs remain separate from executable plugins.
- Fixed plugin recovery validation, package-manifest integrity checks, missing timing-event detection, tool execution/re-entry handling and display sample indexes.
- Fixed Content Pack rollback identity validation and native heat disqualification metadata; reduced race-rule lap-history processing.
- Added developer API documentation, example fixtures and automated integration tests. Physical timing hardware was not available for validation.

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
