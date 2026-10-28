# Phidget Interface

Status: software integration tested with simulated channels; no physical hardware has been tested.

## Installation and supported connection

The first implementation uses local USB in the Windows 64-bit desktop app. Install the official 64-bit Phidget22 Windows libraries from https://www.phidgets.com/docs/OS_-_Windows. The helper loads `C:\Program Files\Phidgets\Phidget22\phidget22.dll` (resolved through Windows' Program Files directory). SlotForge does not install a driver, need a COM port, use a network server, or require users to install Node.js.

The API channels supported are DigitalInput, VoltageInput, VoltageRatioInput and DigitalOutput. This includes compatible InterfaceKits and VINT devices. Selection is by device/hub serial, channel, hub port and hub-port-device flag. There is no claim that every board/revision is electrically equivalent or physically verified. A relay-only board cannot serve as a lap input. Multiple devices can supply different assigned channels. Linux/macOS return an explicit unsupported-platform message for this initial connection implementation.

Scan while disconnected. Close any Phidget Control Panel channel-test windows first. Manual channel entries are available for offline preparation, not as a substitute for a successful attachment. Settings cannot rewire a connected device or open race, including a disconnected race awaiting recovery. A VINT hub port cannot simultaneously be assigned as a direct hub sensor and an attached VINT device. Switching hardware disconnects the old provider.

## Timing and inputs

Native callbacks are timestamped with a monotonic Stopwatch clock, before IPC. A seven-sample clock exchange aligns helper time to the main process; the renderer converts that time to its performance origin. The alignment uncertainty is diagnostic, not a hardware-accuracy estimate. The standard Phidget DigitalInput event contains no on-board crossing timestamp. Device filtering, reporting and USB/OS delivery can affect timing.

1018_2/1018_3 digital inputs specify 125 updates/s, minimum LOW 4 ms and HIGH 15 ms. 1012_3 specifies 125/s, LOW 16 ms and HIGH 4 ms. Analogue sampling is a separate facility. Voltage and ratio channels use their minimum supported data interval and a zero change trigger; hysteresis is applied by SlotForge. Do not wire track supply directly to an input.

The first value seeds presence only. On start or resume, inputs covered outside running must clear before a new crossing or pit entry; an already recognized pit retains its release tracking. One accepted leading edge counts once; a held input must clear to rearm. Optional clear time rejects short bounce intervals. Shared lap/pit input holds use Race Setup's pit hold; separate pit inputs can optionally count a lap. Presence is independently supplied to the existing Service Stop engine so removal/return and penalties follow the same rules as other timing hardware. Minimum lap time, red-flag invalidation, fuel, tyres, weather, Push & Save, championships and results stay in the existing engine.

## Outputs and loss of connection

Only assigned outputs are opened. They start at FALSE. Output wiring must be inactive at API FALSE: inverted output assignments are rejected because closing a Phidget channel resets its state. Where a board supports a FALSE failsafe, the helper enables it and services it on heartbeats. Software cannot guarantee power off on disconnected hardware or unsupported failsafes; physical relay selection and wiring remain the installer's responsibility.

Output tests are deliberately armed, limited to 1.2 s, and locked during a race. Races hold an output lease. Disconnect invalidates its output commands but retains the race reservation until the race is left. Reconnection requires the same saved configuration and reacquires a fresh lease. Restored paused races keep track power off until manual resume. A dropped channel, error, lost stream sequence, helper crash, or unresponsive main window closes the connection. During racing this invokes the existing red-flag flow; countdowns are cancelled. Reconnecting does not resume automatically, and covered inputs must clear before another crossing. No output tests or channel edits are allowed from the second display.

## Build and verification

`npm run phidget:build` rebuilds the C# helper using Windows' .NET Framework 4 compiler. Its own source and executable are packaged; Electron unpacks the executable from ASAR. No Phidget SDK files are redistributed by SlotForge. API signatures and enum values were checked against the official Phidget22 Windows development header downloaded on 2026-10-27.

`npm run test:phidget` exercises decoding, service-stop integration and the compiled helper. The helper has an explicit `--simulate` test mode; the production controller rejects its handshake. Test dependency injection is confined to test processes. `--library <absolute-path>` is a helper-only SDK smoke-test argument, never available over renderer IPC. Neither test option is used by the app.

References: https://www.phidgets.com/docs/Using_Events ; https://www.phidgets.com/docs/Addressing_Phidgets ; https://www.phidgets.com/docs/Closing_a_Channel ; https://www.phidgets.com/docs/Failsafe_Guide . Implementation is independent of Race Coordinator source code.

## Verification completed for this implementation

- Full `npm test` after the audit: 159 test commands passed. Backup and localhost-server tests ran outside the restricted tool sandbox with isolated temporary data.
- 17 existing Electron checks passed, covering the existing Parallel Port adapter, Service Stops, race controls, results, charts, calculations, widgets, audio and custom tyres.
- `npm run test:phidget:electron` passed using the real page, preload, main controller and compiled helper in explicitly injected simulation mode. It verifies saved settings, lap input, a parked race, ownership locks, disconnect/red flag, manual reconnect/restart, power recovery and cleanup. The audit expanded it with restored-race power gating, disconnected-race settings locks, pit-listener disposal and ratio-threshold save preservation. Screens were captured in dark/light and at 600 px with no horizontal overflow.
- The official x64 Phidget22 library loaded and completed a manager scan with no attached devices. Creation, local addressing and event-handler registration for the four channel classes reached the expected missing-device timeout.
- The helper and adapter regression tests cover malformed streams, clock alignment, initial states, polarity, hysteresis, Service Stops, race-system parity and heartbeat failures. Physical wiring and timing remain unverified.

For an optional native-library smoke test, run `node tools/qa/phidget-library.cjs <absolute-path-to-official-x64-phidget22.dll>`. It scans and tries an intentionally nonexistent serial number; it does not install the library or activate actual devices.

## Follow-up audit

See [Phidget implementation audit](phidget-audit.md) for six repaired findings and additional cleanup. The complete 159-command suite passed after the fixes; focused tests were rerun after final cleanup. The final helper rebuild passed the real Electron Phidget check and the official-library smoke check. Existing Parallel Port and Service Stop Electron checks also passed. No physical hardware was used.
