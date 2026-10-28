# Building a SlotForge box (first version, text only; diagrams follow after the hardware pass)

## Parts, 4-lane Nano reference (about €25–30)
- Arduino Nano (ATmega328P; a clone is fine; most clones need "Processor: ATmega328P (Old Bootloader)" in the IDE)
- 4 lane sensors: TCRT5000 reflective modules (one per lane, under a hole in the track between the rails), or IR LED + phototransistor pairs across the slot
- optional 4 pit sensors (same parts) in the pit lane, or 4 push buttons + 8 resistors for the call-button ladder
- a WS2812 LED stick with 8 pixels (or 7 plain LEDs with 220 Ω resistors)
- a 1-channel 5 V relay module (10 A contacts) for the track power; optional a 4-channel module for the lane relays
- a passive buzzer, 2 push buttons (Start/Pause, Track call), perfboard, headers, wire, a box

## Wiring (Nano)
| What | Pin | Notes |
|---|---|---|
| Lane sensors 1–4 | A0–A3 | signal to the pin, VCC 5 V, GND. A car must make the reading go DOWN. TCRT5000 modules: use the analog output (A0 on the module). |
| Pit sensors 1–4 (or the ladder) | A4–A7 | same. A6/A7 are analog-only, which is fine here. |
| Start/Pause button | D2 → GND | the sketch uses the internal pull-up |
| Track call button | D3 → GND | idem |
| Main relay IN | D4 | relay VCC 5 V, GND; the relay's contacts in the + wire from the track's power supply to the track |
| Buzzer | D5 → GND | passive buzzer |
| WS2812 stick DIN | D6 | stick 5 V and GND; put a 300–500 Ω resistor in DIN and a 1000 µF capacitor across the stick's 5 V/GND if the strip is long |
| Lane relays 1–4 | D7–D10 | optional; a 4-channel module, IN1..IN4; its contacts in each lane's power feed |
| Plain LEDs (instead of the stick) | D7–D13 | 5 red, GO green, caution yellow, each with 220 Ω to GND. Not together with lane relays on a Nano. |

Rules: all grounds together (the Nano, the sensors, the relay module, the strip and any extra 5 V supply). Switch only the DC output of the track's supply with
the relays, never mains. Keep sensor wires away from the motor wires or use shielded wire if the readings jump when cars run.

## Dead strips
A dead strip sits at track voltage. Do not connect it to the Nano directly: a PC817 optocoupler per lane, its LED side across the strip (with a 2.2 kΩ resistor),
its transistor side between the analog pin and GND with the pin's reading pulled up (10 kΩ to 5 V). Set the pin's sensor kind to "Contact" on the Arduino page.

## The call-button ladder
5 V → 1 kΩ → the ladder pin (an analog pin with the role "Call buttons"). From the pin to GND, one button each in series with: 0 Ω (button 1), 1 kΩ, 2.2 kΩ, 3.9 kΩ,
6.8 kΩ, 12 kΩ, 22 kΩ, 47 kΩ (buttons 2–8). The sketch's table (buttons.h) expects these values; other values need the table changed.

## Flashing
1. Install the Arduino IDE from arduino.cc. Sketch > Include Library > Manage Libraries: install "Adafruit NeoPixel".
2. In SlotForge: App Settings > Timing Hardware > Arduino > "Download the Arduino sketch". Unzip; open `SlotForgeBox/SlotForgeBox.ino`.
3. Tools > Board: Arduino Nano (and the processor) or Arduino Mega 2560. Tools > Port: the board. Upload.
4. Without the strip library, add `#define SFB_NO_STRIP` at the top of `SlotForgeBox.ino` (plain LEDs only).

## First run
Order matters: wire the sensors first, connect, press **Calibrate** with the track empty, then **Save to the box**. (A brand-new box calibrates once by itself at its first power-up; with nothing wired yet that learns junk, and Save would keep it.) On a 2- or 3-lane track set the unused pins (A2, A3) to "Not used": an unwired pin floats and could count laps.
Connect in SlotForge. With the track empty press Calibrate. Cover a lane sensor with a finger: its bar drops below the red trigger line, the check light turns green,
the log shows the letter and a "covered for ... ms" figure. If a sensor never triggers, lower its trigger threshold or check that a car makes the reading go DOWN
(swap the sensor's wiring or choose a module with the right output). If a car standing on a sensor counts twice, raise the Blackout (PC Lap Counter's sketch uses 3000 ms by default for reflective sensors; 300 ms is the box's default). Press "Save to the box" so the box keeps the settings without the app.
