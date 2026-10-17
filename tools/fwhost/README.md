# fwhost: run the box firmware on a desktop

`node tools/fwhost/run.js` compiles `firmware/SlotForgeBox/SlotForgeBox.ino` (unmodified) with g++ against a stand-in for the Arduino, plays cars over the sensors, and reads what the box sends with the app's own parser (`renderer/arduinobox.js`). About 3 seconds. Run it after every change in the firmware. `--strict` also fails on the "known" lines.

Needs: node and a desktop `g++`. Without g++ it prints `SKIPPED` and exits 0.

## Where it expects things (relative to this folder)

| What | Path | Override |
|---|---|---|
| the sketch folder | `../../firmware/SlotForgeBox/` | env `SFB_FIRMWARE` |
| the app's parser | `../../renderer/arduinobox.js` | env `SFB_RENDERER` (a folder) |
| the Trackmate parser and helpers that `arduinobox.js` loads | `../../renderer/hardware.js`, `trackmate.js` | same folder: these two are the app's, not the package's. Inside the package, point `SFB_RENDERER` at an app checkout's `renderer/` that also holds `arduinobox.js` |

## What is modelled

- A simulated clock; `millis()`/`micros()` only move when the sketch spends time.
- The ADC: a scripted voltage per pin and time; every `analogRead` costs 112 us (the Arduino default ADC clock), so the sweep of 16 sensors takes as long as it does on a Mega.
- The serial port: 9600 8N1, a 64-byte transmit buffer, `Serial.write` blocks when it is full, `availableForWrite()` works. The bytes reach the app with their arrival time (+ optional USB jitter, 1 to 12 ms).
- The two button interrupts (Start, Track call), the NeoPixel strip (`show()` blocks the loop for 300 us + 30 us per pixel, interrupts off), the relay pins, the buzzer, EEPROM (kept in a file between runs).

## What is not modelled

The AVR compiler and its integer sizes (an `int` is 32 bit here, 16 on the board), RAM use, electrical behaviour (crosstalk between ADC channels, sensor noise, ambient light), real USB timing. Compile in the Arduino IDE and test on the board as well.

## Files

- `host.cpp`: the Arduino stand-in and the script reader. The script language is explained at the top.
- `drive.js`: builds scripts (`Scen`: `pass`, `adc`, `rx`, `btn`, ...), compiles (`build`), runs (`runBox`) and sends the output through the app's link (`throughLink`).
- `run.js`: the checks.
- `shim/`: `Arduino.h`, `EEPROM.h`, `Adafruit_NeoPixel.h`, `avr/wdt.h`.

## What the checks do

1. Four lanes, six laps each: every lap counted, lap times within 10 ms of the truth, version answer, keep-alive answers, a speed-trap figure per pass.
2. Twenty Start/Track-call presses while cars lap: all arrive, no tick above 1000 (a negative delta shows as 4294967295), laps still exact.
3. The readings stream on (Nano 8 sensors, Mega 16): every 12 ms pass still counted.
4. Pass-length sweep (2 to 15 ms) for Nano and Mega. Prints the table.
5. The PC goes away: safe state after 3 s, relay off, laps buffered with their own times, delivered when the PC is back.
6. EEPROM: a new box calibrates once; a saved box keeps its thresholds and is not blind after power-up.

"known" lines are written-down problems that are not fixed yet (they print, but do not fail): the speed-trap figure reads 6 to 9 ms too long (the box reports `now - confirmedAt` at release time, the 8 ms RELEASE_MS is in it; `aboveSince - confirmedAt` would be the pass); a lane whose empty level falls below the saved arm level stays covered; two cars less than 0.5 s apart count as one lap (the app's QUIET rule); a Mega with 16 sensors misses part of the 4 to 6 ms passes. When one is fixed its line says so; move it into a normal check then.

## How it was checked

Against 1.0.1 it passes. Against 1.0.0 it fails four checks: the tick underflow, the 16-sensor readings stream, and the two EEPROM ones (a saved box recalibrates and is blind at power-up).
