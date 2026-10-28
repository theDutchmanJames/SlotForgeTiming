# Widget options and remaining engine work — 28 October 2026

Reviewed all 92 registry definitions, their 390 content-option declarations (including explanatory notes), the shared appearance/text controls, and the remaining performance/preview/cleanup recommendations. Confirmed defects below are repaired. This is not a claim that every possible combination of saved options, race state and screen size has been exhaustively tested.

## Repairs

1. **Hidden Tyre Wear facts stay hidden.** Number-only no longer restores the percentage when it is unchecked. The tyre name or grip can be the only selected fact.
2. **Tyre bars honour selected details.** Name, grip and temperature appear below the bar. A vertical bar keeps its short value inside and puts selected laps-left beneath it. Bar height is constrained to its allocated row, preventing overlap with those details.
3. **Only relevant controls are offered.** Picture sets appear for the tyre picture-with-ring view; Available Tyres hides picture/dimming/hide-empty controls in number-only view. Push & Save wear-only hides badge/reference/state-colour controls. Stored values are retained when switching views. Shrink to fit appears in Manual sizing, since Automatic always fits.
4. **More content reaches the shared fitter.** Fuel's number/bar text and Driver Swap Signal were incorrectly classified as pictures. Formatted text and flow widgets now reach the text fitter too. Fuel and swap samples previously contained text as small as 4.2–8.4 screen pixels in the audited geometry; the corrected cases pass readable-size checks.
5. **Complete gauge fitting.** Added tyre temperature, tyre number-only, bar labels and wear-only multipliers to the fitting targets and manual text roles. Tyre/gauge media retain a usable allocation while text shrinks to its readable minimum. Explicit smaller picture-size overrides remain possible. Default titles retain an 11px minimum; explicit title settings remain supported.
6. **Production-backed previews for ten families.** Clock, lights, damage, Balance of Power, speed, current/next driver, swap timer/signal and championship points use isolated deterministic engine fixtures and the real Timing formatter. Their old duplicate sample strings/calculations were removed. The Layout Editor also applies these preview state colours. No live race or user database supplies this simulation.
7. **Virtual Rival widget integration.** Gap now honours Time / Estimated laps / Both. Classification exposes the existing numeric gap so a physical car behind a virtual leader uses the correct leader, without parsing formatted strings. Distance and practice comparisons retain their established units when a lap estimate is unavailable. Rival Last Laps formats only the visible tail. Average/median calculations are lazy, so displaying a rival name does not scan lap history. Total Time honours its display scope; unrecorded cumulative rival heat time displays a dash rather than pretending the current heat is the all-heats total.
8. **Help updated.** Added guidance for view-dependent controls, readable fitting, sample states and rival total-time availability.

## Remaining architectural recommendations

| Earlier recommendation | Review outcome |
|---|---|
| More selective dynamic updates | Removed unnecessary rival statistics and full-history formatting. Retained conservative per-frame formatting elsewhere: a safe broader cache needs complete dependency/revision keys for lap edits, exclusions, system changes, flags and recovered state. No lap-count-only cache was added. |
| Unified preview race | Ten stateful widget families now share the production-backed path. Other families still use their deterministic family samples; charts and leaderboards retain saved-design previews. Full migration and a user-facing scenario selector remain optional follow-up work. |
| Deeper cleanup | Removed the replaced sample implementations. Retained legacy styling/aliases still used by old layouts, row cells and custom Builder content. A wider CSS consolidation is maintenance work, not a confirmed unresolved defect from this pass. |
| Longer heap profiling | Ran 300 cycles of 40 widgets after warm-up: 12,000 mount/fit/resize/dispose operations over 322.7 seconds. One document, 623 DOM nodes and eight event listeners at every collected checkpoint. Retained JS heap moved from 3.62 MB to 3.80 MB, peaking at 3.87 MB; final checkpoints settled. No accumulating DOM/listener leak was observed. This does not prove overnight memory stability or hardware timing accuracy. |

## Verification and limits

- Real Electron editor: **1,906 checks / 905 option variants**, all 92 panels. Exercised actual input/change handlers, conditional fields, selected row/chart/image designs, image upload/removal, picture zoom/pan/reset and real database save/reopen. Notes are inventory entries, not editable controls.
- New `tests/widgetoptions.test.js`: **689 checks** covering repaired semantics, production/sample parity, non-mutation and rival gaps/performance/scope. Existing family suites cover their state-dependent runtime behaviour. Control persistence alone is not treated as proof of runtime correctness.
- All **169 declared pretest/test commands pass with targeted rechecks**. The initial run had three failures: changed sample names, a VM test manifest missing the new preview module, and a substring-based script-order assertion matching `widgetpreview.js` as `review.js`. Their corrected rechecks pass; original logs are retained.
- Actual Electron: **139 engine/lifecycle/adapter checks**, **102 shared geometry checks**, and **24 focused readable-text geometry cases** at 280/400px. Inspected captures, including tyre/bar supporting-text separation and minimum picture size. Actual editor/fullscreen captures at 1920/1200/600px and a real second Live Race window passed.
- Shared appearance suite: 92 option panels, 276 gradient/depth/accent cases and 30 live shared cases. Builder suite: controls, persistence, undo/redo, components and 12 width/theme cases. Font suite: installed/bundled font handling, six viewport/theme cases and second-window rendering. All pass.
- One second-window screenshot attempt failed with Electron `UnknownVizError`. The renderer checks had passed. Added bounded capture retries and reran successfully; the screenshot failure was not counted as a visual pass.
- Dense layouts can still require larger widgets or fewer facts. Warning colours only activate in their corresponding states. Unsupported virtual-rival systems/records remain unavailable by design. No physical hardware test was performed.

Evidence: `../../outputs/widget-options-review/review.html`, inventory, control matrix, geometry results, memory samples and original/final test logs in that directory. Reproduce with `node tests/widgetoptions.test.js`, `node tools/qa/widget-engine-suite.cjs ../outputs/widget-options-review/tests`, and the Electron QA scripts `widget-options-electron.cjs` / `widget-memory-electron.cjs`.

## Preview migration and CSS follow-up completed — 28 October 2026

All 87 content-widget definitions now route through WidgetPreview and Timing; five control labels remain static. Layout, row, chart and Builder previews share isolated production-engine fixtures and typed values, with selected designs/assets passed through. Registry sample implementations and the separate Builder engine were removed. Row previews use production ordering/ranges, and chart previews bypass only the live refresh cache for immediate edits. The Chart Editor caption reflects the new history fixture.

Consolidated tyre temperature/bar rules, gauge containment, manual supporting-text rules and All-in-One meter colour. Kept compatibility selectors for old layouts and Builder content. Actual inspection also found weather's shrink-only fitter and tiny default titles on specialized adapters; shared fitting/title bounds now cover these cases without changing explicit title sizes.

Verification: all 170 declared commands pass with the final team-picture assertion rechecked; 311 new preview checks and 4,373 option checks; actual Electron controls 1,906 checks/905 variants; 1,104 CSS equivalence cases with 14,832,378 identical computed values; engine 139 checks and geometry 102 checks; actual Builder, saved layouts and second-window integration passed. Inspected 600/1200px captures, active system gauges in the second window and all three Chart Editor styles. Public family sample helpers remain compatibility/unit-fixture APIs, not production editor routing. No saved-layout schema migration was introduced.

Evidence and limits: [preview migration review](../../outputs/widget-preview-migration/review.html). Earlier selective live-update caching and overnight/hardware profiling remain separate recommendations, not part of this preview/CSS task.


## Layout Editor performance completed — 28 October 2026

The editor now keeps mounted widget elements, updates geometry directly while moving/resizing, and reconciles only changed content for option edits. Pointer movements are coalesced into one animation-frame update; releasing, cancellation, loss of focus, saving, undo and editor teardown flush the last pending movement and dispose listeners. Existing geometry and snapping functions remain authoritative. Group operations, layer order and row previews retain their previous semantics.

Font bindings batch completion notifications and skip redundant notifications for loaded fonts. Resize preserves font variables and accent/corner geometry. Weather fitting resets the previous inner shrink factor before measuring again, so retained and freshly rendered widgets agree. No persistence migration or visual-quality reduction was introduced.

On the saved 64-widget JamesUI v2 layout, median dragging CPU work fell from 106.2ms to approximately 0.4ms; resizing fell from 103.2ms to below 1ms with snapping enabled (unchanged dimensions skip fitting). These hidden Electron measurements include the deferred frame callback, not on-screen FPS. A warm-font full redraw now fits 64 widgets instead of 4,160.

Verification: all 171 declared commands pass including final rechecks; 133 Electron editor checks cover gestures, undo, persistence and 92 stock widgets plus Builder resize parity with configured fonts; 1,906 option checks pass. Live integration passed 139 lifecycle checks, 102 geometry checks, legacy/modern saved layouts and the real second display. Inspected heavy-layout, 1200/600px editor and second-display captures. Dense chart/Builder widgets retain the existing enlarge guidance.

Evidence: [implementation review](../../outputs/layout-editor-performance/review.html). Reproduce focused unit coverage with `node tests/editorperformance.test.js`; actual-app performance and control checks with `electron tools/qa/layout-editor-performance.cjs --verify --controls` (requires the local saved JamesUI v2 fixture and reads it without modifying the user's database).


## Widget surfaces and independent labels completed — 28 October 2026

Gradient colour/source and opacity are independent of the background colour. The gradient fades into the chosen base, including custom white surfaces in dark themes. Surface opacity applies to the complete result; automatic contrast and race-state text use the same colour model. Existing stored strength values resolve to their corresponding opacity, and all new properties support layout defaults, overrides, copy/paste, group resets and database round trips.

Titles use matching 12px side insets and a 6px top inset. Shared value bounds are symmetric and do not depend on title or lane-label dimensions. Removed the older title-offset paths from clocks, charts and All-in-One cards. Track/session record values have their own centred column, with the holder beside them. Editor lane badges are separate overlay nodes, moved with the widget and removed/replaced with it; they do not enter live markup or persisted layout data.

Verification: all 172 declared test commands pass (sandbox-limited database/server tests rerun with the required access); 137 new Electron surface/control/geometry checks include title toggles across all 92 registered widgets. Existing 133 editor checks, 1,906 option checks and the 64-widget performance fixture pass. Final lifecycle/second-display verification and 102 geometry checks are recorded in the linked report. Actual editor/live captures at 1200px and 600px were inspected. Very small composite cards retain their existing enlarge guidance; arbitrary dense content is not reduced to unreadable text. No timing engine changes or user-database writes were made by verification.

Evidence: [surface implementation review](../../outputs/widget-surface-implementation/review.html). Reproduce with `node tests/widgetsurface.test.js` and `electron tools/qa/widget-surface-electron.cjs`.
