# Parallel Port audit — 27 October 2026

Scope: configuration, pin decoding, native polling and masked output writes, main-process ownership/IPC, renderer connection lifetime, settings UI, saved races, Service Stops and shared race integration. No physical LPT port or timing hardware was used.

## Findings and repairs

| Priority | Finding | Repair and verification |
| --- | --- | --- |
| P1 | Native timing loss did not pause the race. A helper crash could leave the clock running with no crossings. Start/resume also lacked an interface-readiness check. | Parallel Port now uses the same guarded start, red-flag pause and countdown cancellation flow as Phidget. The actual Electron test kills the helper while racing and verifies paused/red, no restart while disconnected, and no lap counting until manual resume. |
| P1 | Output ownership could be taken by a second acquisition request, and a crash cleared the backend race lock. | Reject a second owner, preserve the race reservation across faults, require the saved configuration for reconnect and issue a fresh output lease. Stale output commands/releases cannot control the new connection. Compiled-helper tests reproduce takeover and crash/reconnect sequences. |
| P1 | Restoring a paused race with Start Power On could request power before the director resumed. Reconnection lacked a complete recovery interlock. | Keep track power off during restoration/recovery. Electron verifies restored paused/off, manual resume/on, and reconnect remaining paused/off. |
| P1 | The native watchdog monitored the main process only. A frozen race window could stop handling timing while the main process continued sending keep-alives and outputs remained requested. | Add main-window heartbeats. The main process requests helper shutdown after about 3 seconds without a response, checked every 400 ms. Tests cover missing heartbeats and a responsive window. Native main-process watchdog remains 1.8 seconds. |
| P2 | Clear-time filtering allowed the first crossing too soon after connection. Some short unaccepted pulses also left rearming enabled. | Every rising edge now checks the actual preceding clear duration. Tests exercise initial clear time, rejected short pulses and a subsequent valid crossing. |
| P2 | Rearming left an accepted held pulse eligible for a later pit hold. Countdown coverage could become an unwanted pit after green. | Reset acceptance at start/resume and require clear/new trigger, while preserving release tracking for an already recognized pit. Regression cases verify both paths. |
| P2 | A late acquisition response after disconnect could release the race reservation or install a stale output lease. A reconnect while acquisition was pending could be missed. | Shared binder tracks connection versions, retains ownership through a late reply, and reacquires when necessary. Tests cover reconnect before/after the reply. Disposed binders ignore late failures. Both Parallel Port and Phidget Electron tests pass with the shared fix. |
| P2 | The settings page disabled Connect whenever a race was open, preventing recovery without leaving the race. | Allow reconnect using unchanged saved settings while keeping editing, testing and Disconnect locked. Electron reconnects using the actual setup-page button. |

## Additional fixes and cleanup

- Settings IPC validates Parallel Port configuration, restricts assignment edits to the main window and requires disconnect before rewiring.
- Check Port no longer reports an existing connection as verification of a different requested address. Repeated Connect cannot silently replace a live connection.
- Synchronous helper-launch and command-send failures are consumed cleanly instead of leaving unhandled rejected handshake promises; both have injected-failure tests.
- Output-write failures transition to a failed connection; duplicate releases do not disturb idle output tests.
- The in-memory native test port incorrectly used address modulo eight. This broke simulation of the supported LPT3 base `3BC`. Simulation now uses offsets from the selected base and has an explicit LPT3 regression. This was a test-harness defect, not a physical-port addressing defect.
- Parallel Port and Phidget share the recovery helpers instead of duplicating the flag/start/power logic.
- Updated Help and `PARALLEL-PORT.md` to explain reconnection, sensor rearming and the two watchdogs.

## Verification

New regression suite: `tests/parallelaudit.test.js`, included in `npm test`. It uses production decoding/binding functions and the compiled helper with explicit in-memory simulation. Production rejects simulation handshakes.

Electron QA uses isolated databases and actual page, preload, IPC, controller and helper code. Checks include settings save, parked races, other-hardware exclusion, ownership locks, disconnect/red flag, reconnection through the page, manual resume, saved-race restoration and separate pit sensors. Shared Phidget and Service Stop checks also run.

Verification completed:

- Full `npm test`: all **160 test commands passed**, exit 0.
- Final Parallel Port Electron check passed, including reconnection via the setup-page button and restored-race power gating.
- Phidget Electron and Service Stop Electron checks passed.
- Final targeted audit and backend checks passed, including injected command-send failure, native watchdog, masked outputs and inactive polarity.
- Native helper rebuilt successfully from the reviewed source.

The first full run exposed a test-fixture boundary assumption when the new heartbeat IPC handler was added. That fixture was corrected and the complete suite rerun successfully. No failing checks remain from this review.

Logs are in the workspace parent at `outputs/parallel-audit/`: `full-tests.log`, `parallel-electron.log`, `phidget-electron.log` and `pit-stop-electron.log`. Expected permission/ownership errors in Electron stderr come from deliberate rejection tests.

## Physical validation boundary

The implementation detects helper, driver and protocol failures; it cannot identify every disconnected sensor cable from register readings. No software test establishes LPT electrical compatibility, relay wiring, short-pulse capture, real timing accuracy or driver support on a particular PC. A requested 1 ms poll interval is not a real-time guarantee. Pulses shorter than a polling gap can be missed. Process termination, power loss or inaccessible hardware can prevent a final output-off write; software watchdogs are not independent hardware interlocks. These limitations remain documented.
