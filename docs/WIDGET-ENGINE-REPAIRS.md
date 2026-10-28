# Widget engine repairs — 28 October 2026

Implements the repair sequence in [the original review](WIDGET-ENGINE-REVIEW.md). The race engine, timing hardware contracts and saved layout schema are unchanged.

## Completed changes

1. **Contain failures.** Each live widget's content generation, DOM update, appearance and fit run inside one error boundary. Failed widgets show a local retry message, retry after a short backoff, and only commit their output cache after success. Other widgets continue updating.
2. **Fix row accents and lifecycle.** Leaderboard rows now pass their lane identity to Frame. Legacy and current lane accents agree for left, right and top edges. A live canvas owns one observer per widget and provides `update`, `resize` and `dispose` on its existing node array. Rebuilding, closing fullscreen, leaving a race and navigating/resetting the Live Race viewer disconnect observers and cancel pending fits. This is verified resource cleanup, not a measured retained-heap claim.
3. **Separate writes.** Content, colour/theme and disabled-state changes are compared independently. Changing a colour or control state does not replace unchanged SVG, images or child elements.
4. **Share presentation.** `widgetview.js` owns common frame markup/styles and dispatches explicit registry adapters. Live widgets, Layout Editor previews, leaderboard cells and Builder components use that dispatch. Media and charts retain their CSS/SVG sizing; weather, delta timers and clocks retain their specialised layout functions. The outer renderer no longer searches HTML strings to choose a fitter. Preview data remains the existing deterministic sample contract, including saved chart/row selections.
5. **Reduce repeated work safely.** A paint-scoped WeakMap shares filtered lap lists and lazy means/medians. It is discarded each paint, so equal-count lap edits, invalidation, pit exclusions, removals and restored races cannot retain old statistics. Stable driver identity widgets declare identity dependencies and skip unchanged formatting; other widgets conservatively update each frame. Last Laps formats only the visible tail of the history, preserving lap numbers and column ordering. No cross-frame statistics cache based only on lap count was introduced.
6. **Remove confirmed leftovers.** Removed the unused `WidgetFonts.fit` forwarding export, stopped writing obsolete `titleSpace` on new widgets, renamed the editor fitting function to reflect its wider purpose, and expanded the dense Builder composition/studio modules into reviewable formatting. Old `titleSpace` data is tolerated, the `side` stripe alias is retained, and old appearance fields still resolve through Frame. The simple Builder and compatibility CSS remain because they are still used.

## Ownership for future changes

| Concern | Owner |
|---|---|
| Race state and cross-window reconstruction | Engine and LiveShare; unchanged |
| Values, text and state colours | Timing and family formatters |
| Widget identity, default options and adapter selection | Widgets registry |
| Common frame markup/style and fitting dispatch | WidgetView |
| Appearance normalisation, title/padding and text fitting | Frame |
| Live updates, failure containment and observer disposal | LiveCanvas |
| Compound internals | Family adapter inside the allocated value box |

Add a registry adapter when a new widget needs different geometry. Do not add another HTML-string detector or a second post-fit pass to a host page. Call `dispose` before replacing a host; a hidden, still-running race is deliberately retained.

## Verification

- Ran all **168 commands** from `pretest` and `test`. Four suites initially failed because their old assertions/test DOMs expected wholesale content writes, direct inline-style assignments or the previous source layout. After updating those fixtures and assertions, all four passed on targeted recheck. Affected timing, rows, registry and new lifecycle tests also passed after the last changes.
- New `tests/widgetview.test.js` covers registry dispatch, failure containment/backoff/recovery, cache commit timing, colour-only DOM retention, observer/animation cleanup, same-count lap edits and exclusions, persistence non-mutation, and bounded Last Laps formatting with identical output.
- Actual Electron: **139 checks** for lifecycle, adapter coverage, stripes and long-race work, plus **102 geometry checks**. Five two-widget rebuilds and a fullscreen open/close created 12 observers and explicitly disconnected all 12.
- Real app database save/reopen retained both legacy and current widget records. All 83 non-hidden/non-control default widget samples exercised their declared adapters without exceptions.
- Inspected Layout Editor screenshots at 1200 and 600 px, fullscreen widget screenshots at 1920/1200/600 px across Dark, Light and Ocean, and the actual separate Live Race window at 1200 px. The second window received real LiveShare snapshots; leaving its timing page disposed its nodes.
- Existing Electron Builder, appearance and font suites passed: Builder controls/rules/save/reopen/undo/redo and 12 width/theme cases; 92 widget option panels, 276 registry appearance cases, 30 live shared cases; installed-font fallback, six font viewport/theme cases and a separate window.
- Long-race probe: 2/4/8 lanes, 12/24/48 widgets, 1,000 historical laps per lane, 120 measured paints after warmup. It verifies at most one average-lap filter per driver per paint. Timings are in the JSON evidence; they are local renderer measurements with software rendering, not a hardware latency guarantee or a controlled before/after benchmark.

## Practical limits

Automatic fitting retains minimum readable text sizes. An intentionally dense seven-lap/two-column card can become too small when an entire desktop layout is squeezed to 600 px. The existing “Enlarge widget or show fewer fields” state appears instead of clipping or unreadably shrinking the text. Larger cards, fewer entries or a layout intended for that screen remain necessary.

No physical timing hardware was available. Hardware integration regression suites ran, but physical input timing and device-driver behaviour were not tested. No claim is made that every possible saved layout and combination of options has been exhaustively checked.

## Reproducing the checks

- `node tests/widgetview.test.js`
- `node tools/qa/widget-engine-suite.cjs` — runs all declared commands and records each result.
- Launch `tools/qa/widget-engine-repairs-electron.cjs` with the project's Electron binary. It uses a separate test profile and never the user's database.
- Existing `widget-composer-electron.cjs`, `widget-settings-electron.cjs`, `widget-fonts-electron.cjs` cover the surrounding editors and integrations.

Evidence and inspected captures: `../../outputs/widget-engine-repairs/review.html`. Original failing logs are retained separately from the final rechecks.

## Follow-up option audit

The remaining recommendations and every widget’s declared options were reviewed in [Widget options and remaining engine work](WIDGET-OPTIONS-REVIEW.md). It records additional repairs, actual-app evidence and the architectural follow-ups that remain.
