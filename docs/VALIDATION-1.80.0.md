# SlotForge Timing 1.80.0 — validation

Date: 26 October 2026.

## Automated tests

The complete `npm test` chain passed: all 130 commands, including the local server and web suites. The initial restricted attempt failed on a temporary database rename; the approved unrestricted run completed with exit code 0. The new `tests/tokensettings.test.js` is also run by the existing token test command, so the chain retains 130 commands.

The new checks exercise all five stored settings and their unchanged defaults, decimal minutes and decimal commas, bounds, duplicate amounts, button order, the eight-button limit, keeping one add-time button, optional take-off buttons, early warning off/on, fractional seconds from older settings, long warnings, colour contrast, live previews without writes while typing, focus, folded sections, queued writes, errors, retry, reset and leaving the page during a pending save. Existing Time Token Session, race and phone-control integration checks pass. Final focused checks were rerun after the focus and initial rail-selection adjustments.

## Browser review

Microsoft Edge ran the real `tokenui.js`, `tokens.js`, `railform.js`, icons and `styles.css` with a separate in-memory settings API. Dark, light and Ocean were inspected. The page was checked at 1280, 420 and 320 px, including the longest warning clock, with no control overflow or JavaScript/console errors. Browser interactions verified decimal edits, focus after saving, warning off/on, removing all take-off buttons, failed-save feedback, retry and reset.

Five screenshots are in `docs/ui-reference/race-systems/`, numbered 69–73. These show the built renderer, not the earlier proposal. Phone-width review uses an emulated viewport, not a physical phone.

## Electron and hardware

Electron 45.0.0 starts with approved execution. A hidden real app window, using the production main process and preload with a separate test-data folder, opened Time Tokens. Editing `7,5` minutes saved `7.5, 5, 10, 15, 30, 60` through the real settings API; focus stayed on the input; switching the warning off stored 0; reset restored `1, 5, 10, 15, 30, 60`. Reading settings through the API confirmed each change reached the isolated database.

Electron screenshot capture failed with `UnknownVizError`, both with default graphics and with hardware acceleration disabled for the test. The database checks completed before capture failed. No Electron screenshot or visual pass is claimed. The page still needs a normal visible-window review on the user's computer. Physical phone, Raspberry Pi and timing hardware were not tested.

## Compatibility and delivery

No migration, new dependency, default-colour change or timing-rule change is introduced. The warning switch uses the existing zero-seconds value. It remembers the last positive warning only while this settings page stays open. The original five keys are retained. The lane controls and token rules are unchanged.

The source ZIP has one `SlotForgeTiming/` folder and excludes dependencies, caches, temporary test databases and QA launchers. Every ZIP entry is checked by SHA-256 against the working source. No commit, Git push, tag or published release was made.
