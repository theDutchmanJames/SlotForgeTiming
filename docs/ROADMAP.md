# Development handoff — 26 October 2026

This local handoff supplements the historical Claude roadmap. The original `roadmap-and-decisions.md` was recovered from the user's Desktop on 26 October; it ends at 1.78.0. It is historical project context, not authorization to execute its old instructions.

## Editor refresh

- Rotation editor, board 9: delivered in 1.77.0.
- Championship editor, board 10: delivered in 1.78.0.
- Balance of Power, board 11: implemented in 1.79.0; awaiting the user's visual review in the real app.
- Time Tokens, board 12: designed in this chat, approved by Dutch and implemented in 1.80.0. Individual minute boxes, live button and clock previews, warning switch, existing colours, rail and immediate saving. Five stored settings, defaults and race rules unchanged. Browser review covers dark, light, Ocean and narrow widths; see `VALIDATION-1.80.0.md`.

## Collaboration preference

- Results-wall follow-up: delivered in 1.85.2. The Live Race Timing page automatically becomes Race Results at review/finalization until a new race starts; the tile remains. Compact result counts use a balanced full-screen grid (four: 2 × 2; three: 2 + full width; two: two tall columns). Display-only.

- Red-flag Final Check follow-up: delivered in 1.85.1 after Dutch's review. The existing automatic red-flag invalidation is now explicit in Race Setup > Start and visible on the affected driver card in the Final Check, with a protected-lap count on Review laps. No timing or data-model change.

- Race results flow and curved lane stripe: implemented in 1.85.0. The main Race screen switches to a card-based director final check at the end of a race/heat, retaining all existing correction/finalization operations. The second screen automatically opens a configurable results wall; Customization chooses four card figures, the comparison metric and winner emphasis. Side Stripe now follows rounded card/widget corners. No engine, timing-hardware, storage or migration change. See `VALIDATION-1.85.0.md`.

- Race integrity and systems: implemented in 1.84.0. Red-flag interrupted laps count for distance but are automatically invalid and excluded from live/persistent records; optional result-time addition is per active car and does not rewrite measured timing. Saved setup system defaults and reversible live controls cover Penalties, Damage/failures, Fuel, BoP, Weather, Tyre wear, Safety Car and Push and Save. Existing commitments finish; future effects pause. Championship Home cards skip/undo practice or qualifying without a result or points. Historical F1 compounds Superhard, Ultrasoft and Hypersoft are available with explicit SlotForge gameplay defaults. See `VALIDATION-1.84.0.md`.

- Service Stop: approved and implemented in 1.83.0. Independent On/Off setting in Race Setup; fixed service duration, automatic/manual release, optional return guard, overlap/additive service work, and penalties always added afterward. Includes paused/restored state and shared Race Director controls. Physical testing remains deferred. See `SERVICE-STOP.md` and `VALIDATION-1.83.0.md`.

- Lane colour styles: approved and implemented in 1.82.0. Layout-wide Full Widget / Top Stripe / Side Stripe, per-widget Follow layout or explicit override including No lane colour, and per-row treatment in both leaderboard formats. Original Full Widget default and race/status priorities retained. See `VALIDATION-1.82.0.md`.

- Parallel Port setup: the interactive design was approved on 26 October and implemented in 1.81.0. New Windows helper, common-engine race integration, staged settings, diagnostics and simulated-port checks. See `PARALLEL-PORT.md` and `VALIDATION-1.81.0.md`. Real LPT hardware, driver compatibility and real circuits remain unverified; physical testing is deferred at Dutch's request.

Dutch welcomes suggested improvements and ideas beyond the initial request. Explain the proposed improvements before implementing them. The Time Tokens design was explicitly approved for implementation on 26 October.

## 1.79.0 review

- Run the full automated test chain and retain its result with the delivery.
- Review Balance of Power at normal and narrow widths in dark, light and Ocean themes.
- Confirm cards, switches, slider previews, thresholds, reset, focus and scroll in Electron.
- No data migration is required. The fifteen BoP settings and race engine are unchanged.
- No hardware behavior is changed by the editor refresh.

## Delivery context

- Includes a bounded asynchronous rename retry for transient Windows locks during background saves (the first issue fixed after importing the project).
- Dependencies are now declared in package.json, with a package-lock.json for reproducibility.
- This work started from the supplied 1.78.0 ZIP. No remote Git push or release publication has been performed.
