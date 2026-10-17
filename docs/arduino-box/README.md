# SlotForge Timing — the SlotForge box (Arduino) package

An Arduino sensor-and-lights box for analog tracks, with SlotForge as the race master, written against SlotForge Timing 1.31.0, re-checked against 1.36.0 (the hooks are unchanged; the package's tests pass inside it), and in its style.
Both halves are in here: the **firmware** (an Arduino sketch for Nano and Mega) and the **app side** (a link, a virtual box, race glue, the Timing Hardware
page "Arduino" with a button that hands out the sketch). Nothing in the package changes an existing file; the hooks are in INTEGRATION.md.

Read in this order: this file, INTEGRATION.md, then the top comment of each file. DESIGN.md is the design document the package was built from.

## What is in the package

| File | What it is |
|---|---|
| firmware/SlotForgeBox/*.ino, *.h | The sketch: `SlotForgeBox.ino` (the loop and the commands), `settings.h` (board, pin maps, the Settings struct kept in EEPROM), `sensing.h` (ADC poll loop, two-threshold detection, calibration, blackout), `protocol.h` (the serial protocol), `lights.h` (WS2812 strip or plain LEDs), `power.h` (relays, buzzer), `buttons.h` (Start/Pause, Track call, the call-button ladder). MIT. |
| renderer/arduinobox.js | The protocol's mirror image and the link: Trackmate stream + bracketed events → `hit`, `call`, `pit`, `button`, `trap`, `reading`, `calibrated`, `version`, `safe`, `option`, `message`. The command builders (`ArduinoBox.C`). Pure. |
| renderer/arduinosim.js | The virtual box: four imaginary cars, Trackmate mode until V, then the extras; pit sensors, speed trap, readings, calibration, settings, the keep-alive rule with buffered laps. Poses as a Web Serial port (asPort()). |
| renderer/arduinorace.js | The race glue: events in (laps, pits, calls, jump starts during the countdown, the speed trap), the lights / power / buzzer out, following the race. Pure. |
| renderer/arduinoui.js | App Settings > Timing Hardware > Arduino: connection, the pins table with live readings and thresholds, calibrate, lights, power, buttons, "Save to the box", the monitor, **Download the Arduino sketch**. |
| renderer/arduinosketch.js | GENERATED: the sketch embedded as strings, so the page can hand it out without reading files. `node tools/pack-sketch.js` regenerates it; a test fails when it is out of step. |
| renderer/zipfile.js | A 40-line zip writer (stored, CRC32) for the download. |
| tests/*.test.js | 76 checks: protocol and link (arduinobox), the virtual box end to end incl. the streams (arduinosim), the race glue (arduinorace), the embedded sketch and the zip, opened and verified by Python (arduinosketch). |
| tools/pack-sketch.js, tools/check-firmware.sh, tools/arduino-stubs/ | Regenerate the embedded sketch; syntax-check the firmware for Nano and Mega with a desktop g++ (no Arduino toolchain needed). |
| tools/fwhost/ | **The firmware test bench** (written by the reviewing Claude): compiles the unmodified sketch with g++ against a stand-in Arduino (simulated clock, scripted ADC with real conversion time, 64-byte 9600-baud serial buffer, button interrupts, NeoPixel timing, EEPROM in a file), plays cars over the sensors and reads the box through the app's own parser. `node tools/fwhost/run.js` inside the app (3 s); `--strict` fails on known issues too. Run it after every firmware change. |
| smoke/ | A headless-Chromium run of the page against the virtual box (needs playwright). |

## The protocol in one paragraph

The box talks at 9600 baud and starts as a Trackmate: `A`..`H` while a lane sensor is covered (every 50 ms), `W` for the buttons, and a tick (`<ms>` LF CR) every
200 ms and right before every event, so events carry the box's clock and USB jitter never reaches a lap time. It understands the Trackmate commands (A<n>, C, D, I0,
S, E/R). When SlotForge sends `V`, the box switches to SlotForge mode and adds bracketed events: `[P2+]`/`[P2-]` pit sensor, `[K3]` call button, `[T1 48]` the car covered
the sensor for 48 ms (the speed trap), `[Z0 512]` a reading, `[C0 851 723 511]` a calibration, `[S+]`/`[S-]` safe state, `[B2 4000]` a lap buffered while the PC was away,
`[O ...]` settings, `[E ...]` messages, `[!]` the answer to a keep-alive (when the answers stop while the ticks go on, the box has rebooted into Trackmate mode and the page sets it up again). Commands: `!` keep-alive (every second; 3 s without one = safe state: lights STOP, power to the safe position, laps buffered),
`L<c>` lights (0..5, G, S, Y), `B<n>` beep, `M<0|1>` main power, `Q<lane><0|1>` lane power, `N<lane> RRGGBB` status pixel, `X` calibrate, `H<pin> arm trig`,
`P<pin> L1|P2|K|N kind` pin role, `O key value` options, `W` save to EEPROM, `?` list, `Z<0|1>` readings stream, `G` back to Trackmate mode. The full list is in
firmware/SlotForgeBox/protocol.h. Digits never appear outside brackets except in ticks, so the Trackmate parser is never confused.

## What a race gets from it

- Laps with the box's timestamps; **real pit stops** from pit sensors (block/unblock, so fuel, tyres, repairs, served penalties and endurance swaps work as with a sensor);
  the Track call and Start buttons as the Trackcall; **call buttons per lane** as calls; **jump starts** (a crossing during the countdown) for the false-start handling;
  the **speed trap** (how long the car covered the sensor) for a widget and a column.
- The **start lights follow the app's countdown** (its random lights-out included), GO at lights out, caution under yellow, STOP under red, paused and at the end; the
  countdown beeps and GO on the buzzer; the **track power** follows the startPower setting and the race's power cuts; a retired or disqualified car loses its **lane power**.
- The virtual box, so all of it can be tried without an Arduino.

## Hardware, briefly (DESIGN.md has the full picture and the pin maps)

Nano (reference, 4 lanes, about €25–30) or Mega (8 lanes with pit sensors and lane relays, about €60). Sensors on the analog pins: light sensors (TCRT5000 under the
track or an IR pair across the slot) or contacts (reed, dead strip through an optocoupler); a car must pull the reading DOWN. D2 Start/Pause, D3 Track call, D4 main
relay, D5 buzzer, D6 WS2812 strip (or plain LEDs on D7..D13), lane relays on D7..D13 (Nano) or D22..D29 (Mega). Logic from USB; a long strip, many emitters or an
8-relay module need their own 5 V supply with a common ground. The relays switch the DC output of the track's supply, never mains.

## Safety of the sketch (read this)

- A sketch cannot damage an Arduino by itself: an upload replaces it, and a sketch that misbehaves is fixed by uploading another. Damage to a board comes from
  **wiring** (a pin driven as an output into a short or into 12 V, track voltage on an input, a relay coil without a module's driver), not from code. The
  BUILD-GUIDE's rules exist for that: dead strips through an optocoupler, relays as modules, all grounds common, only low-voltage DC switched.
- What the sketch does with pins: D2/D3 are inputs with pull-ups (safe to short to GND); D4, D5, D6 and the lane-relay / plain-LED pins are outputs driven
  LOW or HIGH. Never wire an output pin to 5 V or GND directly, and never wire a relay coil to a pin without a relay module (it has the driver transistor).
- The **hardware watchdog is off by default** (SFB_WATCHDOG in SlotForgeBox.ino). On a Nano with the old bootloader a watchdog reset can leave the board in a
  reset loop that only an ISP programmer fixes. Turn it on only with the Optiboot bootloader.
- `delay()` is used once (150 ms, the double beep from the page's Beep button, never during a race). Everything else is non-blocking.
- EEPROM is written only on "Save to the box" (`W`), never in the loop, so the EEPROM's write endurance is not an issue.

## Compared against Race Coordinator's sketches (1.0 and the 2026 "AI" v2.1)
Same choices: hardware timestamps sent before the event so PC latency never touches a lap time; the watchdog off by default ("not all boards support it"); debouncing on the board; a keep-alive. Copied from them after the comparison: the keep-alive is answered (`[!]`) so a rebooted box is noticed and set up again, and a pass ends only after the reading has stayed above the arm threshold for 8 ms (RELEASE_MS) so a bouncing contact gives one crossing and a sane duration. Not copied: their microsecond resolution (the Trackmate stream and the app work in milliseconds) and their push of race state, standings and fuel to the board for LED displays (a later idea: the `N` lane pixel command is the small version of it).

## Review of 2026-10-17 (the other Claude compiled the firmware on a desktop with a simulated clock, ADC and serial buffer): fixed in 1.0.1
1. The readings stream ran during races and, on a Mega with 16 pins, overflowed the 64-byte serial buffer so the sensors were not read (48 of 72 laps). Now: the page streams only while it is on screen and never while a race is bound; the firmware sends one pin every 30 ms and only when the buffer has room.
2. Boot calibration overwrote saved thresholds (an Arduino resets at every connect; a car over a sensor then taught it a wrong empty level). Now: the box calibrates by itself only on a fresh EEPROM; otherwise the saved thresholds are used, and Calibrate is a button.
3. A4..A7 defaulted to pit sensors; unwired pins float and gave phantom pit stops. Now: not used by default.
4. A button press could print a tick of 4294967295 ms (millis() in the handler ran a ms ahead of the loop's clock). Now: one clock per loop pass, and a tick can never be negative.
5. Also: each analog pin is read twice and the second value kept (channel carry-over with high-impedance sensors); the double beep no longer uses delay(); `main.js` needs `backgroundThrottling: false` (INTEGRATION step 4).

## Second review, fixed in 1.0.2 (all four were "known" lines in the bench; they pass in `--strict` now)
1. Short passes (a guide blade through a beam, 3-6 ms) were missed, badly on a Mega with 16 sensors: the first sample only armed, the second confirmed. Now a pin arms and confirms in the same sample (his patch). Bench: Nano 100 % from 2 ms, Mega 100 % from 4 ms. `SFB_FAST_ADC` (prescaler 32) is an opt-in for the board test if 2-3 ms passes matter on a Mega.
2. A lane whose empty level had fallen below the saved arm level (ambient light) stayed covered for ever. Now: a confirmed pass whose reading stays above the trigger for 1 s is a drift: the pass ends and the pin re-learns its empty level (`[E pin N re-learned ...]` + a `[C..]` line, so the page updates). A reading below the trigger for 3 s is a blocked sensor: the pass ends, thresholds untouched, `[E pin N blocked for 3 s]`.
3. The speed-trap figure included the 8 ms release time. Now it is the pass itself.
4. Two cars 0.42 s apart on one lane counted as one lap. The box link now treats a lane as free 250 ms after its last letter (the box ends passes itself and its blackout is 300 ms), so they count as two.

## Third review, fixed in 1.0.3 (found by the other Claude with the bench; his patch, applied as is)
A car stalled on a sensor (or a sensor blocked) counted a lap every 3.3 s: the 1.0.2 "blocked for 3 s" rule ended the pass but let the pin re-arm after the blackout while the car was still there. Now a pin whose pass was ended that way stays `blocked` until its reading is back above the arm level; only then does the blackout start. Bench: a 10 s stall = 2 laps (arrival, and the next car), a 20 s block = 1 lap, the `[E pin N blocked for 3 s]` message once. The bench has the check (item 8) and passes in `--strict`.
Noted for the board test, no action: the drift rule re-learns the empty level from a single sample; a car hovering between the two thresholds for a second would lower a pin's thresholds until the next Calibrate (the `[C..]` line on the page shows it).

## Not verified on hardware yet

The firmware syntax-checks for both boards with g++ (tools/check-firmware.sh) and its behaviour is mirrored by the virtual box, but it has not been compiled by the
Arduino IDE nor run on a board. The first hardware checkpoint (INTEGRATION.md step 8): compile, flash a Nano, connect, see readings, calibrate, cover a sensor
by hand, see the letter and the trap figure. Things most likely to need a tweak on real hardware: the default thresholds (85 % / 60 % of the empty level), the
blackout (300 ms), the ladder's resistor table, and the 1.8 s wait after opening the port (an Arduino resets when the port opens).
