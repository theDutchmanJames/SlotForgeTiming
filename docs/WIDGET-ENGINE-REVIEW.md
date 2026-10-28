# Widget renderer review — 28 October 2026

**Follow-up:** the approved repair pass is implemented and verified. See [Widget engine repairs](WIDGET-ENGINE-REPAIRS.md) for changes, test results and remaining practical limits. The findings and reproductions below describe the pre-repair state.

## Conclusion

The foundation is worth keeping. SlotForge already separates race rules, shared race data, content formatting and appearance reasonably well. The principal weakness is that **responsibility for constructing and fitting a widget is distributed across too many places**. The recent shared fitting pass improves that situation, but has not finished the consolidation. A wholesale rewrite or a new UI framework is not justified by this review.

This was a source review plus targeted reproductions in the actual Electron app. It is not a proof that every widget, option combination and hardware configuration is fault-free. Renderer findings below remain open; this task implements only Race Class deletion and its related integration safeguards.

## How a widget reaches the screen

1. **Saved design.** A layout contains widget records: type, lane, rectangle, content options, fonts, typography and appearance. Layout coordinates use a 1,000-unit-wide design space. Height follows the page aspect ratio. This makes a design portable between screen sizes, but design units and actual screen pixels are different quantities.
2. **Registry — `renderer/widgets.js`.** `REGISTRY` defines available types, labels, option controls, initial dimensions and samples. `newWidget()` creates the saved record. A Builder widget is copied into a layout when added; it is not a live reference to the Builder original. Row and chart designs have their own references.
3. **Race view model — `renderer/liveshare.js`.** `makeShared()` exposes the engine, standings, lane lookup, records, system data and related designs. The main race screen and viewers use this interface. Static assets and changing race data are sent separately; sequence numbers and state recovery protect viewers from missing updates.
4. **Content — `renderer/timing.js`.** `content(widget, sharedState)` produces HTML and state colours, sometimes button state. Family modules handle tyres, pace, weather, all-in-one cards, strategy cards, charts and delta timers. The renderer mostly reads engine state rather than owning race rules. It nevertheless performs derived formatting/statistics work, including repeated averages and medians.
5. **Live mounting/updating — `renderer/canvas.js`.** `build()` creates the frame, title and value nodes. `paint()` formats every widget, compares the result with its previous output, and writes changed output. The main timing page, fullscreen view and Live Race timing viewer reuse this module.
6. **Appearance and fitting — `renderer/frame.js`.** Frame resolves old/new appearance settings, lane colour, gradient, border, accent, depth and typography. The shared fitter reserves a title row and content margins, measures real text bounds and searches for a fitting font size. Compound cards allocate space between their text and pictures. An explicit too-small state replaces unreadably small text. Family-specific fitting still exists.
7. **Other surfaces.** The Layout Editor builds frames separately in `editor.js`. Leaderboard cells are built by `rows.js`. Structured Builder previews use `widgetstudio.js` and `widgetcompose.js`. These share pieces of the live renderer, but not one complete mounting and layout lifecycle.

The ordinary race timer updates roughly every 100 ms, faster in accelerated simulation. HTML generation and browser layout therefore deserve care even when the page looks unchanged. The rendering and race-update code share the renderer thread: performance claims should include update latency, not just an attractive screenshot.

## What is built well

- Reusable, largely pure content formatters make output testable independently of hardware and screen size.
- Registry-driven options and saved JSON layouts allow substantial customisation without changing the race engine.
- Main and remote displays use shared race-state reconstruction rather than separately invented calculations.
- Existing output comparisons avoid unchanged DOM writes; image preparation, specialised delta fitting and performance instrumentation show deliberate attention to hot paths.
- Appearance normalisation, escaped text, bounded Builder nesting and safe image handling provide useful input boundaries.
- The newer fitter uses actual text bounds, has bounded searches and a cache, and accounts for font loading. It no longer solves ordinary overflow by scaling an entire card into tiny text.
- Compatibility paths preserve existing layouts. Their age alone does not make them dead code.

## Findings

### 1. A fitting failure escapes the per-widget error boundary

**P2 · reproduced · `renderer/canvas.js:55–81`**

Only `Timing.content()` is caught. DOM updates, family fitting and `Frame.fit()` run outside that boundary. Injecting a sizing failure in the first of two real widgets throws out of `paint()` and leaves the second widget unchanged. `n.last` has already been advanced, so an unchanged next frame can also skip retrying the failed fit.

**Repair:** isolate the entire update for each widget; commit its successful-output cache after completion; provide a local error state and a controlled retry. Add a test that a failure in one widget cannot stop its neighbours. This was an injected fault demonstrating containment, not a claim that a normal widget currently throws on every race.

### 2. Modern appearance can remove leaderboard lane stripes

**P2 · reproduced · `renderer/rows.js:120`, `renderer/frame.js:63–75`**

`rowStripe()` receives the lane but does not include it in the object passed to `Frame.laneStripe()`. The old branch accepts the supplied colour directly. The modern branch resolves a lane colour from `w.lane`, which is absent.

The same two-row production sample rendered **two left stripes with legacy options and zero with modern lane-accent options**. This is a missing integration value, not a reason to redraw the stripe shape again.

**Repair:** carry lane identity through the row adapter and cover legacy/modern appearance, all three stripe edges, custom lane palettes and row preview/live parity.

### 3. A colour-only change replaces all content nodes

**P2 · reproduced inefficiency · `renderer/canvas.js:59–65`**

The output comparison combines HTML, colour, background and disabled state. Any difference leads to `innerHTML = out.html`. In a real DOM probe, changing only the background replaced the existing child node even though its HTML was identical. This needlessly reconstructs nested text, images, SVG and composite cards.

**Repair:** compare content, appearance and control state separately. Replace children only when content changes. This finding proves unnecessary DOM work; it does not quantify a frame-rate improvement.

### 4. Live canvases have no explicit observer disposal

**P2 · lifecycle gap, not a measured memory leak · `renderer/canvas.js:40–45, 87–104`**

Each widget creates a ResizeObserver; some families create another. The handles are not retained. Rebuilding clears the DOM, and closing fullscreen removes its root, but neither operation explicitly disconnects the observers. Five two-widget builds and one fullscreen open/close created **12 observers and made zero disconnect calls**.

The general callback checks `isConnected`, which prevents some late work. That does not provide a complete lifecycle contract. This review did not establish growing retained heap memory; browser garbage collection must not be guessed from observer counts.

**Repair:** return a canvas handle with `update()`, `resize()` and `dispose()`. Dispose observers and pending work whenever a canvas is replaced or closed. Test repeated mount/unmount and inspect heap behaviour separately.

### 5. Shared fitting still depends on family markup and inconsistent pass ordering

**Architecture concern · source traced and coverage measured**

`Frame.fit()` recognises selectors such as `.ll`, `.twav`, `.wc-root`, selected widget types and the all-in-one class. `LiveCanvas` also detects family HTML with string tests. The editor applies shared fitting, then all-in-one fitting and composition/chart-specific updates. Builder previews have another ordering; rows discard most widget identity when invoking the shared fitter as `rowcell`.

In actual Electron boxes, **55 of 83 non-control, non-hidden registered default samples entered the shared fitting path**. The other 28 include images, lights, flags, charts, weather and delta widgets. This is a coverage description, not 28 failures: images and charts legitimately need different layout strategies. Options can also change a widget's markup and fitting path.

**Repair:** give each registry entry an explicit layout adapter rather than infer it from HTML strings. One frame owner should reserve title/padding and apply final geometry. Content adapters should arrange only the space allocated to them. Use the same sequence in live, editor, rows and Builder previews.

### 6. The unchanged-output cache avoids writes, but not content calculation

**Performance opportunity · reproduced, no speedup claimed**

Two unchanged paints of two widgets called the formatter four times while retaining their DOM nodes. The comparison necessarily happens after generating HTML. `timing.js` also calculates averages/medians in individual output paths. A large leaderboard or several widgets for the same driver can repeat work.

**Repair:** first measure with the existing performance tools. Then compute immutable per-frame driver statistics once and let widgets declare update dependencies: clock tick, lap/review revision, driver identity, flags, system state, options, size and theme. Invalidated or edited laps must invalidate statistics too. Never cache solely on lap count.

### 7. Accumulated code needs classification, not indiscriminate deletion

**Maintainability concern · repository usage traced**

- `WidgetFonts.fit()` is now a delegating export with no production callers found in the renderer. It is a candidate for removal after a compatibility/test check.
- New widget records still write `titleSpace:false`; rendering deliberately ignores it. Stop emitting this obsolete property while tolerating it in old layouts.
- The old simple text/image Builder is **still reachable from a current button**. Keep it unless intentionally retiring that feature.
- Stored lane style `side` is a compatibility alias for Left Stripe. Keep reading it; a rename without migration would break saved layouts.
- Legacy background/border options remain fallbacks when new appearance fields are absent. Consolidate them in one normaliser rather than deleting their behaviour.
- `fitChartEditorSamples()` now fits much more than charts; its name obscures its responsibility.
- Large compressed functions make defects harder to review: `widgetcompose.js` has eight lines longer than 500 characters, and `widgetstudio.js` has twelve. Expand these functions and split data conversion, rules, rendering and measurement into named steps.
- CSS has global, family and newer typography/appearance layers. Do not label older selectors unused without checking legacy layouts, alternative widget looks, rows and remote views. Move ownership into documented layers, then remove overrides with regression evidence.

## Specifically: the stripe

The current widget stripe is a shared `::after` border in `renderer/styles.css:165–169`. It uses `border-radius:inherit`, so it follows the actual widget corner geometry. Top, left and right use the corresponding border edge. This is a sound primitive and substantially simpler than accumulating independent decorative shapes.

`Frame` has two colour/size resolution branches for saved-layout compatibility. Modern colour resolution needs lane identity, which exposes the row bug above. The results cards have a separate stripe rule; they are another visual surface, not evidence of several competing stripe implementations inside every widget.

I recommend keeping the shared curved-border primitive and correcting its adapters. Add screenshot checks at several corner radii, widget sizes, themes, all-in-one cards and leaderboard rows. The prior visual fixes did not establish exhaustive coverage of those combinations.

## Recommended sequence

1. Fix error containment, cache commit timing and the confirmed row stripe defect.
2. Add explicit canvas disposal and separate content writes from colour/control changes.
3. Introduce a small registry adapter contract for mount, content, layout and disposal. Migrate one family at a time; keep the current race data interface and saved layouts.
4. Make editor previews use the same mount/layout path with deterministic sample race state. Then consolidate row and Builder component adapters.
5. Remove confirmed obsolete fields/wrappers and format the dense modules. Centralise legacy normalisation without silently migrating user files.
6. Profile representative long races, 2/4/8 lanes, charts, long names, fonts and frequent state changes. Add visual/geometry checks, failure injection and lifecycle checks to the existing unit tests. Separate hardware verification remains a future activity.

## Implemented addition: Race Class deletion

- Added **Race Class labels** on the Multi-Class systems list, including unused labels.
- Added **Delete class** to each class row in the editor; unchecking a class still only excludes it from that system.
- Confirmation states the impact on slotcars, driver/team defaults and systems, and that deletion is immediate.
- Backend removal clears current database links and system driver assignments. A system left without classes cannot start a new race until repaired. Stale Home selections ignore deleted class IDs.
- Unrelated draft changes survive deletion; deleting a draft-only class does not call database removal.
- Saved sessions and recovery snapshots retain their frozen classes. Historical session exports include missing class definitions so import can preserve identities and points.
- Help now has a separate short folder explaining class-label management.

## Validation and evidence

15 targeted suites passed: raceclassdelete, multiclass, systemsaudit, db, transfer, homegrid, startcard, homecards, help-current, help, widgetfit, frame, rows, timing and widgetcompose. This was a scoped regression run, not a fresh execution of every repository test.

Real Electron checks covered catalogue access, cancel, impact counts, used/unused deletion, draft preservation, saving without resurrection, unsaved legacy classes and narrow-screen geometry. Desktop and 600 px screenshots were inspected. Data tests additionally covered disk reopen, unchanged history/recovery and exporting/importing results after all catalogue classes were removed. User data and hardware were not used.

Reproducible tools:
- `tools/qa/raceclass-delete-electron.cjs`
- `tools/qa/widget-engine-review-probe.js`
- `tests/raceclassdelete.test.js`

Evidence: `../outputs/widget-engine-review/` contains the report, screenshots, test output and renderer reproduction JSON. The diagnostic probe intentionally records the existing renderer weaknesses; it must not become a regression test that requires those weaknesses to remain.
