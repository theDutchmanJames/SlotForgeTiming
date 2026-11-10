# Changelog

## 2.2.0 — 2026-11-10

### Shared car library and racing history
- Use a common same-computer car library with Paddock for car browsing, editing and race selection. Preserve Timing identities and race history when bringing existing collections together.
- Save finalised results, corrections and withdrawals through durable operations with retry, acknowledgement and restore protection. Support resumable history uploads and explicit historical approval in compatible Paddock versions.
- Respect car merges and source-specific simulation settings, reject stale or retired selections, and retain original raced identities and historical evidence.
- Restore the original Results and Records presentation and track/personal-best grouping. Preserve recorded dates, totals, penalties and lap details without duplicate history panels.

### Storage and reliability
- Read paginated SQLite lap history and indexed per-car/session statistics without loading full histories. Repair disposable indexes and summaries while preserving authoritative records.
- Retain editor-save identities across lost replies and reloads, fence stale writes after restore, and drain accepted writes safely when closing.
- Fix Layout Editor opening failures caused by oversized unrelated records; load targeted choices and preview assets.

### Interface and race systems
- Compact Race Setup cards with system icons, expose frequently used system tabs, and improve Home lane/class spacing and Database navigation.
- Make Push & Save the sole pace-related tyre-wear control for new races, preserve frozen legacy race rules, and clarify temperature wear modifiers.
- Update theme-aware SlotForge header/footer branding and related Help guidance.

### Distribution
- Exclude local handoffs, audit reports and design previews from release source and desktop packages. Keep build tools, regression tests, licences and user guides.

## 2.1.0 — 2026-11-03

### Database and performance

- New installations use SQLite. Existing users can convert from App Settings → General → Database storage, request a reminder, or keep JSON. Conversion verifies a separate copy before activation and preserves the original JSON files.
- Read catalogue pages, selected records, race history and Home statistics through a background database worker. Prepare race screens from their referenced assets instead of loading whole collections. Maintain indexed lap summaries and Home totals as results change.
- Store identical image/audio bodies once while preserving each reference's original representation. Bound catalogue thumbnail caches and retain full-quality originals for editing and export. Show database size, shared-media savings, reusable space and available disk space.
- Add verified native SQLite backup and restore for larger collections, retain legacy export/import support, and check available space before staging storage operations. Restore into a separate generation before switching.
- Make finalization, resource recovery and Paddock delivery durable across restarts. Keep correction and acknowledgement identities, reject stale writes, and preserve retry state without duplicating race results or resource spending.

### Paddock integration

- Use incremental catalogue updates and lazy photo loading, preserving offline browsing, signed configuration data and local race settings.
- Include reviewed race context and adjustment information in result delivery. Show Paddock's public technical specifications and installed components in a read-only, grouped view without replacing Timing's simpler local editor.

### Appearance and reliability

- Add the collection-style header with Timing's icon, SlotForge wordmark and “EVERY LAP COUNTS”. Place a 120 × 22 px SlotForge footer on main-menu pages, selecting artwork for light, dark and custom backgrounds, and update the Racing Rules credits.
- Add storage migration, disk-full, abrupt-exit, recovery, media, integration and UI regressions. Require explicit completion from single-process UI checks and block accidental test relaunches.
- Allow a slower cold start of the Windows Phidget helper without relaxing race heartbeat or output-safety deadlines.

## 2.0.0 — 2026-11-02

- Improve DS Electronics capture diagnostics using PC Lap Counter's documented settings and installed DS interface: add 56000 baud, explicit model-specific starting points, DS-0045 capture selection and comparison guidance. DS remains capture-only; no unverified race decoder or control commands are enabled.
- Preserve capture model/connection metadata, report omitted log lines, bound and throttle the monitor, retain connection errors and close ended read streams. Add an offline SlotForge log integrity check, Help guidance and serial lifecycle/UI regression tests.
- Review DS diagnostics: distinguish payload text from capture metadata, validate long rows and omission counts, retain failed-close ownership with Retry disconnect, guard pending port/model changes and stale asynchronous results, and use 4800 as the DS-200 reference starting point. Update legacy screen tests for batched painting, locked models and explicit cleared-log markers. Protocol research remains outside the shipped app.

## 1.99.9 — 2026-11-02

- Follow-up Arduino review: switch removed lane-relay outputs off using their previous polarity; reject out-of-range or malformed options before storage conversions; discard oversized diagnostic messages without interpreting their contents as race events; validate explicit release durations.
- Include Arduino Sketch 1.0.7 with matching embedded download and virtual-device behavior. Validate numeric settings in the UI and widen output inputs so full values remain visible.
- Run Nano/Mega firmware regression tests in the Linux desktop release job, in addition to application regressions and packaged-app checks.
- Make the independent sketch ZIP test report unavailable Python as skipped and genuine extraction errors as failures.

## 1.99.8 — 2026-11-01

- Rename the Arduino setup and hardware labels to Arduino Sketch. Verify the implementation against RCAI's Arduino reference while retaining SlotForge's existing protocol and saved settings.
- Ship Arduino firmware 1.0.6: discard oversized serial commands, clear old sensor assignments, release disabled plain LEDs, and prevent shared Nano LED/relay pin configurations. Use explicit sensor release in Timing so short blackout settings do not merge separate laps; show board-specific pin labels and read back changed output settings. Add firmware, parser, simulator and actual-app regression checks; compile for Nano and Mega.

- Review and repair Circuit integration: fit coloured lanes independently of invisible table/scenery bounds, prevent saving a previous design during file loading, and remove repeated geometry regeneration. Verify file-read failures, retry/cancel, animation projection and legacy import behaviour.

- Update Live Tracker to accept SlotForge Circuit 0.3.16 exports, including routed tracks, flowing curves, FreeForm circuits and lane squeezes. Preserve older Track Builder exports and saved layouts.
- Keep both coloured lanes and Circuit artwork following the same 2D paths with existing lap-time and imported tuning-profile pace choices.
- Clarify FreeForm sensor positioning and refresh import, chart and Help labels for Circuit. Add legacy compatibility, new geometry, persistence, second-display and actual-app visual checks.

## 1.99.7 — 2026-11-01

- Rename the Paddock connection field to Dealership password and accept 4–128 characters, preserving legacy Timing credentials and existing browsing/results behaviour. Update connection guidance for remembered Dealership passwords.
- Replace the application icon with the approved SlotForge red chequered-flag design, including Windows icon sizes and main/Live Race window icons.

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
