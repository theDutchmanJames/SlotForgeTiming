# The SlotForge box — design (draft 3, as built on 2026-10-17)

This is the design document the package was built from (draft 2 lived in the SlotForge Timing 2.0 project). Two things changed while building; both are
deliberate and the rest stands:

1. **The extensions do not live in trackmate.js.** The Trackmate's tick is "digits LF CR", so any extension line with digits on the same stream would corrupt a
   tick. The box therefore starts in a pure Trackmate-compatible mode (it works on the Trackmate page and with other software) and switches to the extended,
   bracketed format only when SlotForge sends `V`. The extended stream is read by its own parser in `arduinobox.js`; nothing in trackmate.js changes.
2. **Jump starts are decided by the app, not the box.** The box does not know the countdown; the race glue treats a crossing while the app's phase is
   "countdown" as a jump start (`onJump`). So there is no `J` message. The box can still chirp on it with the `B` command.

Also: the sketch is embedded in the app (`renderer/arduinosketch.js`, generated from `firmware/`) and handed out by the **Download the Arduino sketch**
button on the Arduino page, as the user asked; no pre-built .hex is produced yet (that needs the Arduino toolchain).

## 1. Sensors
- Two kinds per analog pin: **light** (IR emitter + phototransistor, beam across the slot or reflective from below) and **contact** (reed switch, dead strip through an optocoupler, microswitch). Chosen per pin on the Arduino page, sent to the box (`P<pin> L1 0`), kept in its EEPROM (`W`).
- One input path: every pin with a role is read by the **ADC poll loop** (one pin per loop pass, ~1 kHz per sensor). A contact reads 0/1023 and goes through the same logic.
- **Two-threshold detection**: below *arm* the pass is armed; below *trigger* the car is confirmed (the crossing, reported at once); back above *arm* the pass is over and its **duration** is reported (`[T<lane> <ms>]`, the speed trap). A **blackout** (300 ms, `O blackout`) stops a car sitting on the sensor from counting twice. A car must make the reading go DOWN. A pin arms and confirms in the same sample (short passes). A confirmed pass whose reading stays above the trigger for 1 s is a drifted empty level: the pass ends and the level is re-learned; below the trigger for 3 s is a blocked sensor: the pass ends, thresholds untouched.

## 2. Calibration and live readings
- `X` (and the first power-up, when the EEPROM holds no settings yet): 2 s of sampling with the track empty; arm = 85 %, trigger = 60 % of the empty level, reported as `[C<pin> base arm trig]`; adjustable per pin (`H<pin> arm trig`).
- `Z1` turns on a readings stream (`[Z<pin> <raw>]` every 250 ms per sensor pin) while the Arduino page is open: a live bar per pin with both thresholds drawn in. `Z0` turns it off (the page does when it disconnects).

## 3. When the PC goes away (as Race Coordinator)
- In SlotForge mode the app sends `!` every second (the page and the race glue both do; two are harmless). 3 s without any line → **safe state**: lights STOP, a short beep, the main relay to the safe position (`O safeoff 1` = power off, default). Crossings are buffered (32) and sent as `[B<lane> <ms>]` when the next line arrives, after `[S-]`.
- The AVR watchdog (2 s) is available but OFF by default (old-bootloader Nanos can get stuck in a reset loop after a watchdog reset); with Optiboot it may be enabled. Settings live in EEPROM, so a reset box behaves the same; the app re-sends `V`, `?`, `Z1` when it connects.
- In Trackmate mode there is no keep-alive (Trackmate software sends none).

## 4. Hardware
- **Nano** (reference) or **Mega** (same sketch; the board macro picks the pin map in settings.h).
- Analog pins are a pool: Nano A0–A7 (default: lanes 1–4 on A0–A3, pit sensors 1–4 on A4–A7), Mega A0–A15. Roles: lane n, pit sensor n, the call-button ladder, none.
- **Lights**: a WS2812 strip/stick on D6 (pixels 0–4 red, 5 GO, 6 caution, 7+ one status pixel per lane) or plain LEDs on D7–D13 (Nano) / D30–D36 (Mega). A setting (`O lights 1|2`). No MAX7219.
- **Power**: main relay on D4 (`M0/M1`, `O relaync`); per-lane relays on D7–D13 (Nano: up to 7 pins, shared with the plain LEDs) or D22–D29 (Mega) (`Q<lane><0|1>`, `O lanerelays n`, `O lanerelaysnc`).
- **Buttons**: Start/Pause D2 and Track call D3 on external interrupts (both are reported as `W`: the race setup's Trackcall choice decides what W does); the ladder: 8 buttons through 0/1k/2.2k/3.9k/6.8k/12k/22k/47k to GND on one analog pin with 1k to 5 V (`[K<lane>]`); buzzer on D5 (`B1` short, `B2` double, `B3` long).
- Power: logic from USB; a long strip, many emitters or an 8-relay module from their own 5 V with a common ground. The relays switch the DC output of the track's supply.
- Pin budget (Nano): 12 free digital − 5 fixed = 7 for lane relays or plain LEDs, so 6 lanes with everything, 8 lanes without the buzzer; the 8th lane relay has no pin on a Nano (255 in the map).

## 5. Firmware structure
`firmware/SlotForgeBox/`: `SlotForgeBox.ino` (loop, commands, EEPROM, the keep-alive), `settings.h`, `sensing.h`, `protocol.h`, `lights.h`, `power.h`, `buttons.h`. No race logic. Syntax-checked for Nano and Mega with g++ (`tools/check-firmware.sh`); not yet compiled by the Arduino IDE or run on a board.

## 6. Delivery
The sketch is inside the app and downloaded as a zip from the Arduino page (with a README.txt of flashing steps). Flashing with the Arduino IDE (or a .hex flasher later). The page shows the box's firmware version against the one the app ships. MIT.

## 7. Virtual box
`arduinosim.js`: four cars, Trackmate mode until V, pit sensors, traps, readings, calibration, settings, the keep-alive rule with buffered laps; `asPort()` makes it a Web Serial port, so the page and the race run on it unchanged.

## 8. The app side: App Settings > Timing Hardware > Arduino
Connection (find, connect, auto-connect, virtual box, firmware version), **Download the Arduino sketch**, the pins table (role, number, sensor kind, live bar with thresholds, arm/trigger inputs), Calibrate, blackout, the letter-to-lane map with check lights, lights (kind, pixels, brightness, lane pixels, test), power (main relay NO/NC, lane relays, safe state, power on/off), buttons and buzzer (present, beep), Save to the box, the monitor. In the race: `arduinorace.js` (laps, pit sensors, calls, jump starts, trap in; lights, power, lane power, beeps out).

## 9. Still to do after the hardware pass
Pre-built .hex files; wiring diagrams; the speed-trap widget and column (needs a car length on the slotcar); the jump-start handling shared with the Carrera design; a check on the page that a chosen combination fits the board's pins; the Mega's 16-pin table on the page (it already follows `pins` from `[V ...]`).
