# Timing plugins — API 1

Timing plugins run in the trusted background runtime described in [PLUGIN-RUNTIME.md](PLUGIN-RUNTIME.md). One optional timing contribution per plugin registers a driver in **App Settings → Timing Hardware → Plugin Interface**. Installed plugins are discovered from their manifests; no edit to SlotForge's source is required.

The app supplies the styled setup page, lane mapping, digital-level decoder and race adapter. Plugin authors supply device communication. Lap inputs go through the existing race engine, including formation laps, minimum-lap filtering, fuel, tyres, penalties, flags, Service Stop, race review and records. Virtual Rival lanes do not acquire physical cars or lane relay outputs. Results and resume checkpoints record the plugin ID, version, package digest, settings digest and lane configuration. Settings values themselves are not copied into that provenance record.

This is a software integration API, not certification for any device. Physical hardware and timing accuracy have not been tested. Runtime API 1 packages support JavaScript and assets; packaged native `.node`, DLL and executable dependencies are not supported. Pure JavaScript/network drivers can use Node APIs. A driver that requires an external library or service must document and verify that dependency separately. Rich plugin-rendered pages and dynamic discovery pickers are later work; this version uses the existing text, number, checkbox and choice setting schemas.

## Connect a driver

1. In **Plugins**, install its `.slotforge-plugin` package. Installation does not run it.
2. Review the author and code, then explicitly start the trusted plugin. Node code has your operating-system access; the worker is not a security sandbox.
3. In **Timing Hardware**, choose **Plugin interface** as the hardware in use.
4. Open **Plugin Interface**, select the driver, choose lane count and channel assignments, then **Save settings**.
5. Choose **Connect**, and check covered/clear states under **Diagnostics**. Channels start at zero. A sensor already covered at connection must clear before it can count a crossing.
6. Choose shared, separate or no pit sensors. Pit hold time, Service Stop, minimum lap time and track-call behaviour still come from Race Setup.

Connection is explicit, even when the trusted plugin starts automatically. Disconnect and stop the plugin before changing its own generated settings. Save, start it again in Plugins, then reconnect. Lane assignments cannot change while connected. Plugin mutation and timing-source changes are locked while a race owns the interface, including the ready screen and results review.

After device loss or worker failure, the app requests outputs off and pauses a running race under red. **Reconnect does not resume the race or restore power.** Reconnect the same package, settings and lane configuration, then restart manually. Reconnect may restart that previously trusted driver after a worker crash; safe mode still blocks it. A restored race with timing provenance cannot start with a different driver/configuration.

## Manifest contribution

Add this optional field to the existing plugin manifest:

```json
"timing": {
  "api": 1,
  "label": "My network timer",
  "channels": 4,
  "inputs": ["lap", "pit", "call"],
  "outputs": ["master", "go", "yellow", "red", "relay1", "relay2", "relay3", "relay4"],
  "simulation": false
}
```

- `channels`: integer 1–8. Each declared `lap` or `pit` kind has channels `0..channels-1`.
- `inputs`: unique kinds; `lap` is required, `pit` and `call` optional. `call` has channel **0 only**.
- `outputs`: unique supported roles, or `[]` for input-only hardware. Supported roles: `master`, `power`, `go`, `yellow`, `red`, `buzzer`, `start1`–`start5`, `relay1`–`relay8`.
- `simulation`: required boolean. Only `true` exposes the simulator controls. Do not label real hardware as simulation.

Existing packages without `timing` keep the same normalized manifest and fingerprint. The plugin still uses runtime API 1, its `.cjs` entry point, platform/architecture constraints and ordinary settings schema.

## Driver exports

The entry point exports `timing` alongside optional lifecycle/command exports:

```js
exports.timing = {
  async connect(context, session) { /* open device; return input snapshot */ },
  async arm(context, session, { active, lanes }) { /* change session; return snapshot */ },
  async outputs(context, { values, expiresInMs }) { /* write and acknowledge */ return true; },
  async disconnect(context) { /* close device; safe to call more than once */ }
};
```

`outputs` is required only if the manifest declares outputs. `connect`, `arm` and `disconnect` are always required. `connect` and `arm` must return a complete array of `{kind, channel, on}` for every declared input, including unused channels. `on` is a boolean meaning covered/pressed, after device polarity conversion. These snapshots establish a baseline; they do not create laps. Keep reading actual levels while idle so arming can return current state.

`arm` supplies a **new session** when a race acquires/releases the interface. Replace your current session reference before emitting subsequent events. Do not reset physical readings to clear artificially. `active` denotes a race reservation, not the green flag; use output roles for flag/power state. The worker serializes device connect, arm, output writes/renewals and disconnect operations. Device callbacks may arrive asynchronously.

The session exposes:

```js
session.sensor('lap', 0, true, session.now());  // covered edge
session.sensor('lap', 0, false, session.now()); // clear edge
session.disconnected('Connection to the timer was lost');
```

`session.now()` is the worker's monotonic `performance.now()` in **milliseconds**. Capture it at the start of the device callback, before buffering or parsing work. Omitting the timestamp captures it at the `sensor` call. Do not pass `Date.now()`, device uptime or renderer time. Device timestamps need a driver-specific conversion into this clock; the API does not calibrate device clocks. Emit in capture order; do not back-date across newer events.

The wrapper attaches connection/generation IDs and a sequence number. The main process synchronizes the worker clock using a round-trip midpoint; connection is refused above 250 ms round-trip time. Diagnostics shows the measured uncertainty. Samples older than two seconds, implausibly future-dated samples and out-of-order capture timestamps disconnect the interface. Old sessions and duplicate sequences are ignored. A gap in the current sensor sequence disconnects the interface rather than guessing whether a crossing or release was lost. This bounds delivery faults; it does not prove sensor or USB/network latency accuracy. Drivers must keep callbacks quick and avoid noisy repeated states. The supervisor allows 512 messages or 128 KB per second for timing plugins, including logs, responses and heartbeats; overload stops the worker.

## Power and output acknowledgement

`values` contains only declared roles, each boolean; missing or disabled roles are false. Lane relays follow the race's physical car assignments, eligibility and flags. `master`/`power` request overall track power; other roles describe lights/buzzer. A driver may map these roles to its own configured channels. Use suitable hardware circuits: the API does not define electrical polarity or current ratings.

Return **exactly `true`** only after the write is acknowledged as far as the device protocol permits. Rejection, timeout or another return value faults the connection. Drivers must document whether acknowledgement is from a device or merely its transport. Acknowledgement is not proof that a physical relay moved.

The worker renews output writes about every 400 ms while the main window's heartbeat is healthy. Normal writes carry `expiresInMs: 1500`; disconnect sends all false with zero expiry. A renewal taking over one second fails the worker. Race commands require a current, unguessable ownership lease; released or previous-race commands cannot control outputs. The main process and worker each expire a missing heartbeat after 1.5 seconds (plus timer scheduling delay).

**A physical output controller must implement an appropriate watchdog/failsafe.** If a process freezes, a cable disconnects or a PC loses power, software cannot guarantee that a remote relay switches off. A driver must arrange device expiry where supported, report failures and close its own connections/timers. Safe-mode startup, uninstall and runtime shutdown never claim physical power-off verification.

## Separately installed simulator

From a terminal in the folder containing `package.json`:

```powershell
node.exe tools/fixtures/timing-plugin.cjs simulated-timing.slotforge-plugin
```

Install the resulting file using Plugins, then follow the connection steps above. Its full source is [tools/fixtures/timing-plugin.cjs](../tools/fixtures/timing-plugin.cjs). It is an example/test fixture, not an installed default driver or a physical device implementation.

In **Diagnostics**, each simulated sensor button alternates covered/clear; the disconnect button tests recovery. **Those buttons affect a running race**, including laps and pit stops. Simulated drivers additionally export `simulate(context, session, event)`; events are `lap`, `pit`, `call` levels or `{kind:'disconnect'}`. Real drivers never receive this API.

## Verification

- `tests/plugintiming.test.js`: manifest/configuration, clock conversion, complete baselines, stale messages, race ownership, identity checks and failed acknowledgements.
- `tests/plugintimingworker.test.js`: real child process, simulated sensors, heartbeat renewal/expiry, device loss and explicit crash recovery.
- `tests/plugintimingrace.test.js`: shared race adapter, mapped lanes, formation/minimum laps, system effects, shared/separate Service Stop, red-flag invalidation and checkpoint handling.
- `tools/qa/plugin-timing-electron.cjs`: isolated actual app, UI save/connect, utility process, race inputs, source exclusion, settings locks, pause/recovery, resume provenance and all eight themes at 1440/600 px.
- `tools/qa/plugins-asar.cjs`: worker and timing helper loaded from an ASAR archive, as in packaged builds.

Existing hardware, race-system and layout regression tests remain in `npm test`. No physical hardware is required for these checks; third-party driver/device combinations still need their own validation.
