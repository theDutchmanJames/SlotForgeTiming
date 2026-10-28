# Resource Systems validation

## Rules and scope

Resource profiles are selected in Race Setup. The frozen profile applies to the current event. Time Token Sessions are excluded; Virtual Rivals do not consume physical supplies.

An account is identified by profile, duration scope, owner type and stable owner ID. Race scope adds the heat index. Event scope uses a generated run ID; championship scope uses the loaded championship ID. A team owns shared stock regardless of who is driving. Driver-owned stock follows the current driver; car-owned stock follows the selected car.

Each race/heat starts on fresh tyres, consistent with the existing engine. The starting set consumes one allocation. Completed tyre changes consume one set of the fitted compound. Resource tyre limits replace the older set limit when enabled. Wear, weather, mandatory stops, pit timing and penalties retain their existing rules.

Completed damage repairs cost one repair credit. Completed failure repairs cost one credit plus one replacement component when those limits are enabled. A replacement is a generic allowance, not inventory for specific physical parts. Insufficient stock prevents that work and charges none of its partial cost. Other work can finish. Exhausted tyre stops require another stop after stock is granted; blocked repairs can resume in the same stop.

Director changes require an integer quantity and a reason, and cannot create negative balances. Fitted-compound corrections exchange the recorded set without restoring tyre life. Initial grants are not repeated when a profile is edited. Points approval/reversal, result deletion and discarded races do not refund supplies.

## Persistence

`resource-store.js` serializes operations. Ledger changes and the authoritative race checkpoint are committed together in the existing database writer. Transaction IDs are scoped to a run and append in order. Repeated checkpoints do not charge again; stale states and negative balances are rejected. Failed writes roll back the ledger in memory and pause racing. Retry commits the pending transactions once.

Completed results retain resource usage. Resource runs identify repeated final saves so they cannot duplicate the session. Full backups contain the ledger; selective setup exports do not export balances. Restoring a backup requires closing the current resource event first. Closing the app waits for pending resource operations within the existing shutdown timeout.

## Automated checks

- `tests/resources.test.js`: 22 integration groups covering starting-grid atomicity, shared owners, legacy set limits, effective widget allowances and sharing labels, tyre completion/early exit/exhaustion, custom compounds, weather-only changes, driver/car/team ownership, heat scopes, recovery, repair/component costs, reasoned adjustments, shortage audio deduplication, championship carry-over, replay rejection and simulated storage failure.
- Existing pretest/test chain: 163 commands exercised. Updated assertions cover the extra setup navigation, field, icon, audio definition and resource-aware persistence routes. Windows file/loopback permission failures were rechecked separately.
- Existing tests for timing hardware, pit sensors, Service Stop, tyres, failures, endurance, championship scoring, Virtual Rivals, Multi-Class, selective transfer, backups and shared displays remain part of the regression chain.

## Actual Electron checks

`tools/qa/resources-electron.cjs` launches the real app using an isolated database. It creates and reopens an allocation, starts from Home, completes a pit stop, adjusts stock, reconstructs the shared display, simulates a failed write, retries, resumes from Home and finalizes results. It also runs two heats with a lane rotation and recovery between heats. The test verifies no duplicate service charges or final sessions.

The setup, tyre cards, repair cards, history and live balances were rendered and inspected at 1200 px and 600 px, including the light theme. Screenshots are under `outputs/resources/` in the parent workspace.

No physical hardware was available. The integration uses the existing engine/pit-sensor paths; hardware confidence comes from automated interface tests rather than a connected track.

## Audit repairs — 27 October 2026

Fitted-compound corrections now exchange the set against the account that supplied it, even after an endurance driver swap. A real pit change still charges the current owner. Supply provenance survives recovery; an old checkpoint with no provenance refuses a correction rather than refunding the wrong account.

Incomplete ownership returns zero available stock in widgets and blocks race start with guidance. Starting a race registers all participating accounts, including unused and zero allocations, so a later championship round cannot replace their original allowance after a profile edit. Checkpoints validate every account and roll back on failed persistence.

Resource Systems are directly selectable in the export picker. Selective exports contain profiles, not private balances. `tests/systemsaudit.test.js` covers these repairs, including the real endurance swap path, checkpoint replay, unused championship allowances, and simulated write failure.
