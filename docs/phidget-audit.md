# Phidget implementation audit — 27 October 2026

Scope: Phidget configuration and setup UI, native USB helper, main-process ownership and IPC, renderer event decoding, shared race binding, Service Stops, saved races, reconnect behaviour and regression coverage. No physical hardware was available.

## Findings repaired

| Priority | Finding and impact | Repair and evidence |
| --- | --- | --- |
| P1 | An output test could finish its asynchronous write after a race acquired the interface, then schedule a delayed OFF command. The compiled-helper reproduction showed that command cutting across the race's output request. | Test epochs invalidate pending tests and their timers whenever ownership changes. A regression overlaps test/acquisition and checks that no OFF command appears after 1.35 seconds. |
| P1 | Helper failure cleared the backend race reservation. Settings and test locks could disappear while the race still existed. | Keep the race reservation across connection loss, invalidate only the active output lease, require the same configuration for reconnect, and reacquire a fresh lease. Old commands/releases cannot control the new lease. Tests cover disconnect, reconnect, stale tokens, failed acquisition and leaving while disconnected. |
| P1 | Restoring a paused race with Start Power On could request power before the director resumed. | A Phidget power gate applies during restoration and recovery. The actual Electron app now verifies paused/off, manual resume/on and subsequent disconnect/release. |
| P2 | A sensor covered during countdown could later become a shared-sensor pit entry after green, despite its crossing being ignored. | Rearm on transition into running. Inputs already covered must clear and trigger again. Preserve release tracking for a pit recognized before a pause. Both cases are regression-tested. |
| P2 | Configuration accepted incompatible uses of one VINT hub port: a direct hub-port sensor/output and a connected VINT device. | Validate mode consistently per serial and hub port; reject mixed assignments while retaining valid multiple channels on a VINT device. |
| P2 | Selecting another ratio-input channel reset the user's thresholds. Entering ratio mode also supplied invalid defaults for above-threshold detection. | Preserve thresholds when changing between ratio channels. Choose direction-appropriate defaults only on entering ratio mode. Actual Electron form editing and saved settings verify preservation. |

## Additional cleanup and hardening

- Race exit explicitly disposes and clears the pit-sensor subscription. Electron checks verify cleanup, including leaving after hardware loss.
- Duplicate releases are harmless and cannot disarm later idle output tests.
- Failed initial ownership acquisition rolls back its reservation; cancelled acquisition cannot revive a released race.
- Stale output-write failures cannot close a newer helper generation.
- Native callback state visibility is explicit (`volatile Seen`). Command decoding and event encoding use separate JSON serializer instances.
- Removed unused native getter imports and unused channel type storage. Rebuilt the packaged helper from source.
- Help and interface documentation describe start/resume input rearming, restoration power behaviour and retained reconnect locks.

## Verification

All 159 commands in `npm test` completed successfully (exit 0). Focused Phidget, shared race-binding and Help checks were rerun after final cleanup. The final rebuilt helper passed the Electron Phidget test and official-library smoke test. Existing Parallel Port and Service Stop Electron checks also passed. The captured 600 px settings page was visually inspected and has no horizontal overflow.

See `phidget-interface.md` and the logs under `outputs/phidget-research/` in the workspace parent: `audit-full-tests.log`, `audit-electron.log`, `audit-parallel-electron.log`, `audit-pit-stop-electron.log` and `audit-library.log`.

The new automated regression suite is `tests/phidgetaudit.test.js`, included in both `npm test` and `npm run test:phidget`. The Electron Phidget test exercises the actual settings page, database, preload, IPC controller and compiled helper with explicit simulated channels. Shared Parallel Port and Service Stop Electron checks verify affected integrations. Native-library smoke checks use the official x64 DLL and an intentionally nonexistent device serial.

No hardware activation, physical wiring, sensor pulse capture, relay fail-safe operation or end-to-end timing accuracy was verified. Software tests cannot establish those properties. These remain validation limits, not claims of tested hardware compatibility.
