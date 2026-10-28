# Parallel Port — 1.81.0

App Settings → Timing Hardware → Parallel Port implements the approved setup design. Select **Parallel Port** as the timing hardware in use when it should count race laps. Configuring or monitoring another interface does not select it for racing.

## Requirements

- Windows desktop, with .NET Framework 4.x available. The compiled AnyCPU helper is included; rebuilding it requires the framework's C# compiler (`npm run parallel:build`). No Node native addon or new npm dependency is needed.
- A native LPT port or a compatible expansion card exposing byte-addressable I/O registers. An ordinary USB printer cable cannot supply this interface. Memory-mapped-only cards are unsupported.
- A separately installed **and running** compatible InpOut driver exposing `\\.\inpoutx64` on 64-bit Windows or `\\.\inpout32` on 32-bit Windows. The app does not load an InpOut DLL, install or start a service, request elevation, or alter Windows driver protections. Another application holding the driver's exclusive handle must be closed. Older HWInterface-named drivers are not covered.

InpOut is legacy software; its maintainer does not confirm Windows 11 compatibility. A missing, blocked or incompatible driver produces a visible error. This release does not establish compatibility with any particular PC, driver installation or track.

## Setup and pin assignments

LPT1 `378`, LPT2 `278` and LPT3 `3BC` are historical hexadecimal presets. Use Device Manager's actual **I/O range start** for a manual address. “Check port” opens the existing driver and reads the status/control registers without writing to the port. A successful read establishes access, not the existence of an LPT card at that address: the live sensor checks still matter.

Status pins 10, 11, 12, 13 and 15 support up to five independent inputs shared by laps, pits and track call. Pins 1, 14, 16 and 17 can be additional inputs only on compatible hardware. Enable the explicit control-input option and check each sensor; readback of a control register alone cannot prove external sensing. Those input pins are released high when connecting. Data pins 2–9 are outputs. Control pins can instead be outputs; an assigned pin cannot be both. Pins 18–25 are signal grounds.

The connector view looks into the PC's DB25 socket. A cable's solder side is mirrored. Race Coordinator's four-lane preset is L1=10, L2=11, L3=12, L4=13; the SlotTrak preset is L1=15, L2=13, L3=12, L4=10. Presets specify wiring only. Pin 11 and control-register inversions are normalized before the user's High/Low setting is applied.

Save settings, connect, clear the track and use **Calibrate clear sensors** if the active polarity is unknown. Save the calibration and reconnect. Pass a car over each sensor. A sensor active when the connection or race begins, or when racing resumes, must clear before it can count a new crossing or pit entry. Existing pit stops retain release tracking across a pause. Draft edits disconnect before any new configuration is applied; unsaved drafts survive navigation within the app.

## Timing and race behaviour

The native helper polls status/control registers with a Windows multimedia timer, requesting 1 ms by default. It records every observed state change using `Stopwatch.GetTimestamp` (QPC), with 20 ms heartbeats while unchanged. A separate writer buffers samples; the app aligns the helper clock using the smallest round-trip delay of seven clock exchanges. The renderer converts that epoch alignment to its performance clock. UI redraws do not replace crossing timestamps with arrival time.

The interval is a request, not a real-time guarantee. The monitor reports the largest measured gap. Pulses shorter than a polling gap can be missed. The optional active-pulse filter confirms duration but retains the first edge timestamp. Optional clear-state rearming rejects repeated triggers until the input has cleared for the selected duration. The race engine retains its existing minimum-lap rule.

The race binder calls the same `crossCar`, pit and track-call actions as other timing interfaces. Shared sensors count one crossing and report a held pit at the race setup's hold time, preserving the original arrival timestamp. Separate pits report entry/exit; counting their entry as a lap is optional for a pit lane bypassing the finish sensor. Time Token sessions receive crossings without pit events; unpaid or expired lanes do not receive configured lane power. Heats and rotations use the current engine cars' lane assignments.

Master power, lane power, start lights, GO, flags and buzzer follow race state. Retired and disqualified lanes are inactive. The one timing source selected for the race owns the events. A kept race also owns configuration and output access while parked behind another tab. A race lease prevents late cleanup from an old race from switching off a new race's outputs. Loss of timing pauses the race under red and cancels a countdown. The race keeps its configuration reservation through disconnect. Reconnect from this setup page using the same saved configuration, then manually resume the race. Reconnection and restored paused races keep track power off until resume.

## Outputs and diagnostics

Only assigned output bits are written. Unrelated register bits are preserved, including IRQ state. The data-direction bit is cleared only when using data outputs. Active-low and active-high circuits each have their own inactive value. Track voltage must use suitable interface/relay circuitry; never connect track power directly to PC signal pins.

Output tests require enabling, are forbidden while a race owns the interface, and automatically return inactive after 1.5 seconds. Disconnect, EOF, helper failure and a missing app heartbeat request the assigned inactive values. The native watchdog stops after 1.8 seconds without the main process heartbeat. The main process also closes the helper if the main window stops responding for about 3 seconds (checked every 400 ms). This is software protection, not an independent hardware interlock: process termination, PC power loss or hardware failure can prevent the final write.

The monitor and exported log show actual readings. Detailed logging adds raw status/control transitions, sequence numbers and measured gaps; the log is bounded. Buffer overflow, invalid packets or sequence loss stop the connection instead of silently continuing timing.

## Sources and validation boundary

- [InpOut maintainer and source downloads](https://vps.highrez.co.uk/downloads/InpOut32/default.htm), version 1.5.0.1: device names and 8-bit read/write IOCTL packet format. Copyright and MIT notice are in `native/parallel/NOTICE-InpOut.txt`. SlotForge uses the protocol directly and distributes no third-party driver or DLL.
- [Microsoft multimedia timer API](https://learn.microsoft.com/en-us/previous-versions/dd757634(v=vs.85)) for requested interval and resolution; [high-resolution timestamps](https://learn.microsoft.com/en-us/windows/win32/sysinfo/acquiring-high-resolution-time-stamps).
- Local Race Coordinator 1.15.3.0 installation was inspected without running its timing code: requested 1 ms multimedia polling, QPC timestamps, edge detection, and separate 125 ms pit processing. SlotTrak 9 Help supplied the alternative wiring preset.

Automated tests use synthetic samples or the compiled helper's explicit in-memory `--simulate` mode. The production controller never requests that mode and rejects a simulated helper handshake. Actual LPT electrical behaviour, short-pulse detection, driver/OS compatibility, relay circuitry and a physical phone remain untested. See `VALIDATION-1.81.0.md`.

## Follow-up audit — 27 October 2026

See [Parallel Port audit](PARALLEL-PORT-AUDIT.md) for repaired connection, ownership, power recovery, filtering and asynchronous lifecycle defects. All 160 commands in `npm test` passed, together with actual Electron checks for Parallel Port, Phidget and Service Stops using isolated databases and simulated hardware. Physical hardware remains unverified.
