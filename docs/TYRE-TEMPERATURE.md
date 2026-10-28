# Tyre Temperature & Warm-Up

Enable **Race Setup → Tyre Wear Systems → Temperature & Warm-Up**. It is off for new and existing systems until explicitly enabled. Select that Tyre Wear System in the Race Setup as usual. Practice/qualifying use the existing Tyre Wear opt-ins; Time Tokens and Virtual Rivals have no physical tyre-temperature simulation.

Each standard or custom compound has a fresh-set temperature, working range, warm-up degrees per eligible lap, cooling degrees per minute, and maximum cold/hot extra wear. All simulated temperatures are Celsius. The editor uses the production formula for its Normal, full Push and full Save preview.

## Model

At normal pace the target is the middle of the working range. Push & Save supplies intensity from −1 (full Save) to +1 (full Push), scaled continuously against its configured pace thresholds. With no active system or eligible reference, intensity is zero.

`target = midpoint + 0.75 × range width × intensity + 0.5 × (current ambient − dry ambient)`

An eligible completed lap moves the temperature toward that target by at most the configured warm-up increment. Pit laps, red-interrupted/resumed laps, very slow laps and yellow laps do not heat tyres. Pits and yellow/red pauses approach ambient according to elapsed time. Disabling Tyre Wear freezes thermal state; re-enabling does not simulate missed cooling.

Weather mode inherits the active Weather System's **air** temperature, converting Fahrenheit to Celsius. Manual mode uses this profile's own ambient values. Without active Weather, the dry fallback applies. The setup preview uses the profile's fallback/manual values because a reusable Tyre Wear System is not linked to one Weather System.

Within the working range, temperature wear is ×1. Outside it:

- Cold fraction: `clamp((low − T) / (low + 20), 0, 1)`.
- Hot fraction: `clamp((T − high) / (180 − high), 0, 1)`.
- Multiplier: `1 + fraction × configured maximum extra wear / 100`.

The lap uses the mean temperature before/after its warming step. Its multiplier is applied once alongside base wear, weather, distance, pace wear and Push & Save. It neither changes measured lap times nor creates hardware output commands. Initial tyre lifespan estimates remain baseline estimates, not forecasts of future temperatures. Widgets show the multiplier at the current temperature.

## Lifecycle and integration

- Every heat starts fresh. A completed tyre change resets the temperature once, including zero-time changes and fixed Service Stop completion. Early exits and exhausted stock do not reset it.
- Resource ownership and consumption remain separate. A driver swap does not replace the tyres or reset their temperature.
- The engine snapshot includes the temperature and its last thermal update. Recovery freezes offline time, so an app restart does not manufacture cooling. Shared displays use the authoritative thermal values and clock; reading a widget does not modify them.
- The Tyre Change panel displays the simulated state. The Tyre Wear widget has **Show simulated temperature and wear effect**, off by default, for picture, ring, number and bar styles. Its editor preview shows example temperatures.
- Help and App Settings → Calculations explain the model and point to the editable settings. Existing full backup/selective setup transfer preserves the profile with the other Tyre Wear settings.

## Verification

`npm run test:temperature` has 22 passing integration groups covering cleaning and bounds, disabled compatibility, cold/working/hot states, gradual pace intensity, wear and unchanged lap times, real Push & Save, weather unit conversion/manual overrides, tick-independent cooling, red pauses, offline recovery, toggles, completed/aborted/exhausted pit changes, fixed Service Stop, custom compounds and read-only shared displays/widget styles.

The pretest/test regression chain exercised 164 commands. Tests with explicit browser script lists were updated for the two new scripts, and form assertions now include the temperature folder and fields. All initially failing commands passed their targeted reruns; local loopback/backup permission failures were rerun outside the sandbox. This was a full chain followed by targeted reruns, not a second uninterrupted full-chain run.

`npm run test:temperature:electron` uses an isolated real Electron app. It edits and reopens settings, adds a custom tyre, checks the production preview, starts a race through Home and verifies live wear and the shared display. It captures 1200 px/600 px setup views, light/dark styling and four widget appearances; it checks overflow and uncaught errors. Images are in the workspace's `outputs/temperature/` folder.

No physical hardware was available. This is a deterministic gameplay model, not a validated physical tyre model.

## Audit repairs — 27 October 2026

System toggles settle the previous thermal state before changing the enabled or weather policy, including during a red pause. Cooling therefore does not depend on checkpoint frequency, and disabled intervals do not cool the tyres. The recovery-freeze flag is shared with viewer engines so the second screen agrees with the director screen until racing resumes. These cases have deterministic integration regressions in `tests/systemsaudit.test.js`.
