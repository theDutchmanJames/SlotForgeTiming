# Widget Builder review — 27 October 2026

Reviewed the composition model, production timing values, editor controls and persistence, embedded widgets, shared appearance, leaderboard cells, transfer dependencies, packaging, and shared viewers. All confirmed findings below were repaired in the working source.

## Findings and repairs

| Finding | Impact | Repair and evidence |
| --- | --- | --- |
| Crowding hint collided with the lane-accent pseudo-element | A long-name preview could be completely covered by a solid panel, despite its values remaining in the DOM | Removed the overlay; feedback stays outside the widget. Reproduced visually, then captured readable long-name output and added a transparent-decoration regression assertion. |
| Malformed imported compositions could throw | Null rules, invalid roots or non-array children could break rendering/library browsing | Defensive normalization of nodes, rules and conditions; regression cases render without throwing. |
| Incomplete numeric catalogue and legacy display dashes | Championship points, speed and damage counters could not be used correctly in numeric rules; absent systems could appear available | Numeric metadata and values agree; missing readings become null; non-finite readings cannot produce invalid meter geometry. Weather and distance strings retain their existing displayed units. |
| Heat championship points omitted the current placing | Composed points could disagree with the standard Championship Points widget | Use the live placing for ordinary participants as well as aggregate participants. Regression checks 12 previous + 25 provisional = 37 and equality with the standard widget. Season totals retain their dedicated path. |
| Standard component options were silently unavailable | Picture sets, selected teams, size sliders, uploaded pictures and image framing could not be configured in the Builder | Added applicable controls, conditional visibility, numeric bounds and explicit missing-reference labels. Electron checks all offered component option panels and exercises team, avatar/frame and gauge controls. |
| Embedded warning text lost its background | A yellow-flag component could retain black text without its yellow warning panel | Preserve the renderer's paired background/text output. Regression compares it with the standard flag widget. |
| Icon replacement text required existing default text | A rule could not add text to an otherwise icon-only badge | Render matching replacement text independently; regression included. |
| Rule/condition limits silently discarded additions | A thirteenth rule or ninth condition disappeared during normalization | Stop at the limit with visible feedback; Electron checks both limits. Imported single-block roots can also accept new blocks safely. |
| Avatar suppression was mistaken for a database reference | Import could erase the special `none` avatar setting | Preserve the sentinel. Actual database export/import tests check picture sets and teams in custom widgets, layouts and row designs. |
| Appearance CSS affected ancestor leaderboards and wrapping | Adding a composition could change outer leaderboard padding; long text inherited nowrap; shared spacing was overridden | Scope the content rule to the direct composition, restore wrapping and shared padding. Electron checks nested row padding and long text. |
| Layout component samples did not resolve saved image sets | Layout preview could differ from the Builder/live view | Resolve component options against the Layout Editor's saved picture sets and club logo. |

Service status now distinguishes a disabled service stop from “Not in pits”; paused drivers are labelled Paused. Unknown replacement-text variables and empty rules receive validation feedback.

## Verification

- Complete `npm test`: **155 commands passed**, including timing, race systems, hardware simulations, import/export, packaging and screen tests. Log: `../../outputs/composer-audit-full-suite.log`.
- Composer model/integration tests: **21 groups passed**. Includes legal-lap calculations, pause behaviour, system switches, aggregate rows, current and season points, all offered component renderers, dependency remapping, and equality of all typed fields across serialized viewers.
- Real Electron checks passed: create/edit/save/reopen, undo/redo, independent layout copies, component controls, limit messages, shared appearance, composed leaderboard cells, and **12 width/theme combinations** (1540, 1000, 600, 420 pixels × dark, light, Ocean).
- A separate Electron window loaded the real `#live` page with the production preload and received static/dynamic race messages. Its composed content and right accent were verified. Visual capture uses that same LiveView/IPC path in the established test window because a never-shown window did not provide a usable screenshot surface on this machine.
- Screenshots inspected: `../../outputs/widget-composer/dark-1540.png`, `light-600.png`, `strategy.png`, `long-names.png`, and `second-screen.png`. The blank long-name capture was investigated and led to the crowding-overlay fix, not accepted as a passing visual check.
- The final CSS repairs were verified with the expanded Electron regression after the full suite. Help/documentation checks were run after the wording updates.

## Deliberate boundaries and untested environments

No physical timing hardware was exercised, as agreed. The composer remains read-only and does not alter sensor handling or race rules. Separate Windows versions and physical remote devices were not tested. Packaging inclusion was tested; a new installer was not built in this review.

Arbitrary JavaScript, nested custom widgets, control buttons and embedded leaderboards remain excluded from compositions. Each layout keeps its independent copy; editing a library widget does not update placed copies. Complex compositions still require enough room for readable content.

## Windows compatibility

This checkout declares Electron `^45.0.0` and has Electron 45.0.0 installed. The local build environment is x64, with NSIS installer and portable targets and no explicit architecture override.

The expected desktop targets are **64-bit Windows 10 and Windows 11**. Windows 7, 8 and 8.1 are unsupported by Electron 23 and newer; XP/Vista are also outside the supported range. A 64-bit executable does not run on 32-bit Windows. This is the framework/platform requirement, not a claim of testing every Windows release. Hardware-specific drivers have their own compatibility requirements, especially the Parallel Port helper's separately installed InpOut driver.

Official references: [Electron platform support](https://github.com/electron/electron#platform-support), [Windows 7/8/8.1 retirement](https://www.electronjs.org/blog/windows-7-to-8-1-deprecation-notice).
