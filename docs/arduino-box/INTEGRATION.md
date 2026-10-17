# Integrating the SlotForge box package into SlotForge Timing

Written against 1.31.0 and re-checked against 1.36.0 (every anchor below exists unchanged there; the line numbers are from 1.36.0 and may move again). Every step is small. After each one the app still starts and the existing
tests still pass. The Trackmate page is not changed; the box also works there, as a Trackmate.

## 1. Copy the files

```
firmware/SlotForgeBox/            (the whole folder: SlotForgeBox.ino and the .h files)
renderer/arduinobox.js  renderer/arduinosim.js  renderer/arduinorace.js  renderer/arduinoui.js  renderer/arduinosketch.js  renderer/zipfile.js
tests/arduinobox.test.js  tests/arduinosim.test.js  tests/arduinorace.test.js  tests/arduinosketch.test.js
tools/pack-sketch.js  tools/check-firmware.sh  tools/arduino-stubs/  tools/fwhost/  tools/avrcheck/
```

`package.json`:
- `test`: add `&& node tests/arduinobox.test.js && node tests/arduinosim.test.js && node tests/arduinorace.test.js && node tests/arduinosketch.test.js` (after the trackmate test).
- `build.files`: nothing to add for the app (`renderer/**` takes the embedded sketch along). The `firmware/` folder is source only; it does not need to be in the installer.
- Convenience scripts: `"sketch": "node tools/pack-sketch.js"` and `"fwtest": "node tools/fwhost/run.js --strict"`. Rule: after any change in firmware/SlotForgeBox, run both (the arduinosketch test fails when the embedded sketch is stale; the bench needs a desktop g++ and prints SKIPPED without one). `tools/check-firmware.sh` and `tools/avrcheck/check.sh` are **developer tools, not npm scripts and not part of `npm test`**: they are bash and need g++ / clang with the AVR target and git, which a Windows build machine has only with Git Bash installed. Run them by hand on a machine that has them (`bash tools/avrcheck/setup.sh` once, then `bash tools/avrcheck/check.sh`) before a firmware release. `tools/avrcheck/deps/` and `out/` are in its .gitignore.

## 2. Load the scripts (renderer/index.html)

After `<script src="hardwareui.js"></script>` (line 80):

```html
<script src="zipfile.js"></script>
<script src="arduinosketch.js"></script>
<script src="arduinobox.js"></script>
<script src="arduinosim.js"></script>
<script src="arduinorace.js"></script>
<script src="arduinoui.js"></script>
```

(`hardware.js` and `trackmate.js` must come before them, as they do: arduinobox.js uses `Hardware.cmd`/`line`/`describe` and `Trackmate.laneMap`/`swapLane`/`ledsOn`.)

## 3. The Timing Hardware sub-tab (renderer/app.js, renderHardwareArea, about line 83)

```js
renderTabs(document.getElementById('hwtabs'), [['trackmate', 'Trackmate Interface'], ['arduino', 'Arduino'], ['ds', 'DS Electronics'], ['other', 'Other']], state.hwSub, id => { state.hwSub = id; renderHardwareArea(box); });
if (state.hwSub === 'other') return;
if (state.hwSub === 'arduino') return renderArduinoSettings(document.getElementById('hwbox'));
if (state.hwSub === 'ds') return renderDsSettings(document.getElementById('hwbox'));
```

## 4. Connect at startup (renderer/app.js, about line 338)

```js
if (api.onHwChoose && typeof tmAutoConnect === 'function') tmAutoConnect();
if (typeof abAutoConnect === 'function') abAutoConnect(); // the remembered SlotForge box, or the virtual one when that is chosen
```

`main.js`: the serial device picker and permissions of the Trackmate serve the box, but ONE setting is needed on the main window: `backgroundThrottling: false`
in its `webPreferences` (next to the existing ones, about line 28). Without it Chromium slows the window's timers to once a minute after about five minutes
minimized, the keep-alive stops and the box goes to its safe state (lights STOP, track power off). The Live Race window does not need it.

## 5. The race (renderer/race.js)

Next to the Trackmate block (`live.offTm = Trackmate.link.on(...)`, about line 745):

```js
// ---- the SlotForge box (Arduino): laps, pit sensors, buttons and the speed trap come in; the start lights, the power and the buzzer follow the race ----
if (typeof ArduinoRace !== 'undefined' && ArduinoBox.link.connected) {
  live.box = ArduinoRace.bind({ link: ArduinoBox.link, cars: () => eng.cars, crossCar, blockCar, unblockCar, actions, trackcall, phase: () => live.phase, lights: () => live.lights, flag: () => eng.flag, setup,
    onJump: (lane, at) => { /* a crossing during the countdown: see step 6 */ },
    onTrap: (lane, ms) => { const i = eng.cars.findIndex(c => c.lane === lane); if (i >= 0) eng.cars[i].trapMs = ms; } });
}
```

Make the lights, the lane power and the flags follow: one line at the start of `update()`:

```js
if (live.box) live.box.sync(); // (sends only when something changed)
```

The track power: the race already has a `power(on)` helper (line 726) that switches the Trackmate relay. Make it switch the box too:

```js
const power = on => { if (Trackmate.link.connected && typeof tmPower === 'function') tmPower(on); if (live.box) live.box.power(on); };
```

This covers `startPower` (on / off; 1.36 no longer has the 'go' choice) and the Trackcall power cuts (`live.powerFollow`) without further changes.

In `live.leave` (about line 811) and the clean-up at the top of the race screen (line 75), next to `live.offTm`:

```js
if (live.box) { live.box.off(); live.box = null; }
```

The status chip: where `tmWord()` builds "Trackmate connected" (line 722), add e.g. `typeof abConnected === 'function' && abConnected() ? ' · Arduino box connected' : ''`;
the same for the Home chips (landing.js line 166) if wanted.

## 6. Jump starts (optional now, shared with the Carrera design later)

`onJump(lane, at)` fires for a crossing while `live.phase === 'countdown'`. The simplest first version: the Race Director decides. Keep the lane in `live.jumped`
(a Set), show it on the race screen ("Jump start: Lane 2") with a button "Restart" (cancel the countdown and start it again) and one "Ignore". The complete design
(restart automatically / Race Director decides / both, as a race setup setting) is in the Carrera design doc and should be built once for both systems.

## 7. Settings (IN: add them; small, and all have defaults)

Race setup fields read by arduinorace.js, for a folder "SlotForge box" in `schema.js` racesetups (next to the Trackmate folder; the existing `startPower` and
`trackcall` are shared with the Trackmate):

| key | type | default | label |
|---|---|---|---|
| boxPit | select `both` / `sensor` / `button` | both | A pit stop starts when: the pit sensor sees the car or the Pit button is pressed / the sensor only / the button only |
| boxLanePower | select `retired` / `off` | retired | Lane power: cut a lane's power when its car retires or is disqualified / never |
| boxBeeps | checkbox | true | The box beeps the countdown and GO |
| boxLaneLights | checkbox | false | The status pixel of each lane shows the lane colour (needs "A status pixel per lane" on the Arduino page) |

App settings written by arduinoui.js: `abAuto`, `abDevice`, `abVirtual`, `abLaneMap`. Saved through `api.setSettings` like the Trackmate's; nothing to declare.

The speed trap: `eng.cars[i].trapMs` (step 5) is the newest crossing duration. A "Speed trap" widget and leaderboard column = `carLength / trapMs`, scaled: the
slotcar has no length field yet; add `length` (mm, optional, default 130 for 1:32) to the slotcar schema and use `Speed.js` for the scaled km/h. Left for a later batch.

## 8. Try it

1. App Settings > Timing Hardware > Arduino: tick "Use the virtual box". The pins fill in (the virtual box has A0..A3 lanes and A4..A7 pit sensors wired; a real box starts with A0..A3 lanes only), the readings move, the check lights blink as cars pass. Press Calibrate; the thresholds change. Press "Test the lights".
2. Press "Download the Arduino sketch": `SlotForgeBox-1.0.3.zip` lands in Downloads. Open it: the sketch folder and a README.
3. Home: a race setup on a 4-lane track, four drivers, Start. The laps come from the virtual box (leave "Simulated cars" off); the countdown is sent to the box as L1..L5, GO at lights out, Y under the yellow flag, S under red; pit stops happen when the virtual cars use the pit sensors.
4. With a real Nano: open the downloaded sketch in the Arduino IDE, install "Adafruit NeoPixel", pick the board, upload. Untick the virtual box, "Find the box", choose the port, Connect. The firmware version appears; readings appear for the pins with a role; cover a sensor with a finger: the letter in the log, the check light, the trap figure. This is the first hardware checkpoint (README, "Not verified on hardware yet").

## 9. Help text

`tests/help.test.js` checks that names used in the Help exist in the app. Names on this page: "Find the box", "Connect", "Use the virtual box", "Download the Arduino sketch", "Calibrate", "Test the lights", "Save to the box", "Power on", "Power off", "Beep".

## Added after 1.37.x (app side only, the package is not affected)
- **1.38.1**: the Arduino page answers the main process's COM port list (`#ab-pick`, `abChoose`, `abDrawPick`), as the Trackmate and DS pages do. Without it `navigator.serial.requestPort()` never gets a choice in Electron.
- **1.39.0**: the box is only bound to a race (`ArduinoRace.bind` in `race.js`) and only connects by itself (`abAutoConnect`) when it is the timing hardware in use (`Hardware.timingChosen(state.settings) === 'arduino'`; setting `timingHw`: none, trackmate or arduino). Ticking the virtual box sets it. A race opened while the box is not connected is not bound later (the Start race question is there to avoid that).
