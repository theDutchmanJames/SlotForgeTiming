# Service Stop — 1.83.0

## Setup

Race Setup has a separate **Service Stop** section. **Off** is the default for both existing and new setups and retains normal sensor-controlled pits and the original race-system timers. Turning it off retains the saved service settings. No race system is needed to turn it on; it works in practice, qualifying and races, including heats and endurance. Time Token Sessions have no pits and do not offer it.

- **Pit entry: sensor confirmation time** retains the existing `pitHold` setting (default 2 seconds), now in this section. The fixed service countdown starts after this confirmation.
- **Service Stop**: Off / On.
- **Release car**: Automatically after the timer / Manually with Release car.
- **Fuel, tyres and repairs**: Use each system's setting / At the same time, longest timer wins / One after another, add the timers.
- **Fixed service time**: default 30 seconds; 1–86,400 seconds.
- **Wait for car to return**: default Yes, shown for automatic release.

## Service and penalties

The service schedule uses the active jobs and their normal durations (including the car's applicable fuel factors), preserving sequential or overlapping work. It scales that schedule to the fixed service window. A normal 45-second sequence therefore completes within a chosen 30 seconds. Fuel fills progressively; scheduled repairs and tyre changes finish at their scaled points. Existing tyre availability, mandatory-stop counting, weather tyre choices and damage/failure outcomes remain applicable. No tyre sets are invented and retirement/disqualification rules are not turned into repairs. Without service systems, the same timer simply reserves time for work on the real car.

Penalty time is outside that window. Each pending Stop-and-Go adds its full seconds after service, one after another, even when several are pending or another is assigned during the stop. A Drivethrough adds no standing-time seconds. For example: pit confirmation 2 seconds, service 30 seconds, then a 10-second penalty means release is available 42 seconds after arrival. Penalty points and result-time adjustments keep affecting the result under their normal rules. Driver-swap rules and confirmation remain independent.

## Release and sensors

Once pit entry is confirmed, removing/replacing the car cannot finish/restart its stop or count another lap. Its raw hardware data and diagnostic monitoring continue. Other lanes and track-call buttons keep working.

Automatic release with the return guard waits until the complete service-plus-penalty timer has elapsed, then requires the car to cover and clear the relevant sensor. A car returned before expiry and still covering the sensor at expiry can simply drive off. A return and departure both before expiry do not release the stop. Without the guard, an already clear sensor releases at expiry; a covered sensor waits for clearance. Unknown/disconnected sensor state cannot automatically release a car.

Manual mode waits for **Release car** after the complete timer. Put the car back first. The director can also explicitly release an automatic stop that is waiting for a sensor, including a button-only pit. If a known sensor is still covered at release, the lane ignores further hits until it clears. **Release early…** asks for confirmation, logs an override, retains unfinished service, and applies the existing early-departure penalty rules.

The same Pit stops panel appears on Race and the authenticated Race Director, including a phone browser. Release commands require the existing director authentication and validate lane bounds. The Pitstop Time widget and its delta keep showing the elapsed/recorded pit duration. The separate Pit stops controls show the countdown.

## Clock, recovery and implementation

Pausing/red flags freeze the timer. Elapsed-race-time latch state is part of car snapshots, so resume shifts the clock without losing remaining service or penalty time. Recovery waits for fresh sensor evidence. Stopping/finishing a race closes each pit once and prevents another release.

`pithold.js` contains settings, schedule fitting and the presence state machine. `engine.js` applies the hold and owns service, penalties, release and lap suppression. `pitsensors.js` adds presence-only subscriptions to the existing Trackmate, Arduino and Parallel Port paths. Trackmate uses its existing quiet/leave timing; Parallel Port respects its configured trigger filter and clear rearm duration. Firmware, native polling, physical pin assignments and output control are unchanged.

See `VALIDATION-1.83.0.md` for checks and limits. Physical hardware testing is deferred; the user checks the real app each release.
