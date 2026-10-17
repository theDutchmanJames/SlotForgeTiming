/*
  SlotForge box - an Arduino sensor-and-lights box for analog slot car tracks, driven by SlotForge Timing (the PC is the race controller).
  Nano or Mega. Lane and pit sensors on the analog pins, a start light tree (WS2812 strip or plain LEDs), track power relays, a buzzer,
  Start/Pause and Track call buttons, and optional call buttons per lane. No race logic in here: laps are counted and timed on the PC.

  It speaks the Trackmate protocol at 9600 baud until SlotForge asks for more (see protocol.h), so it also works with the Trackmate page
  of SlotForge and with other race software that knows the Trackmate.

  Libraries: Adafruit NeoPixel (only for the strip lights; build with -DSFB_NO_STRIP to leave it out).
  Board: pick Arduino Nano or Arduino Mega 2560 in the IDE; settings.h reads the board macros.
  Licence: MIT. (c) SlotForge Timing.
*/
#include <EEPROM.h>
#include <avr/wdt.h>
#include "settings.h"

// The hardware watchdog is OFF by default. On a Nano with the OLD bootloader (most clones) a watchdog reset can leave the board in an endless reset loop
// that only an ISP programmer gets it out of. Only with the Optiboot bootloader (Tools > Processor: "ATmega328P", not "Old Bootloader") is it safe:
// then you may uncomment the next line. Without it the box still works; a hung sketch is recovered by unplugging the USB cable.
// #define SFB_WATCHDOG

// Faster analog reads (an ADC conversion in about 26 us instead of about 104 us): more samples per sensor, so very short passes (a guide blade through a beam)
// are caught more surely, at the cost of a little precision (about 8 bits instead of 10: plenty for thresholds). Try it on the board: uncomment, and if the
// readings on the Arduino page look noisier than before, leave it out.
// #define SFB_FAST_ADC
#include "sensing.h"
#include "lights.h"
#include "power.h"
#include "buttons.h"
#include "protocol.h"

Settings S;
Sensing sensing;
Lights lights;
Power power;
Buttons buttons;
Protocol proto;

uint32_t lastLetterAt = 0, lastReadingAt = 0, lastFromPcAt = 0, loopNow = 0;
bool readings = false, away = false, started = false, freshSettings = false;
uint8_t readingPin = 0;
uint8_t compatLanes = MAX_LANES;   // the A<n> command of the Trackmate protocol: lanes above it are not reported
uint8_t nextPin = 0;
struct Buffered { uint8_t lane; uint32_t at; } buffered[BUFFERED_LAPS]; uint8_t bufN = 0;

// ---- settings in EEPROM ----
void loadSettings() {
  EEPROM.get(0, S);
  freshSettings = S.magic != SETTINGS_MAGIC || S.version != SETTINGS_VERSION;
  if (freshSettings) defaultSettings(S);
}
void saveSettings() { EEPROM.put(0, S); }

// ---- the sensors speak ----
void onCross(uint8_t pin, uint32_t now) {
  PinSetting &p = S.pins[pin];
  if (p.role == ROLE_LANE) {
    if (p.index < 1 || p.index > compatLanes) return;
    if (away) { if (bufN < BUFFERED_LAPS) { buffered[bufN].lane = p.index; buffered[bufN].at = now; bufN++; } return; }
    proto.letter((char)('A' + (p.index - 1)), now); lastLetterAt = now;
  } else if (p.role == ROLE_PIT) proto.pit(p.index, true, now);
}
void onFree(uint8_t pin, uint32_t now, uint32_t dur) {
  PinSetting &p = S.pins[pin];
  if (p.role == ROLE_LANE) proto.laneVal('T', p.index, (long)dur, now);
  else if (p.role == ROLE_PIT) proto.pit(p.index, false, now);
}
void onRelearn(uint8_t pin, uint16_t base) {
  if (!proto.slotforge) return;
  Serial.print("[E pin "); Serial.print(pin); Serial.print(" re-learned: empty level "); Serial.print(base); Serial.write(']');
  Serial.print("[C"); Serial.print(pin); Serial.write(' '); Serial.print(base); Serial.write(' '); Serial.print(S.pins[pin].arm); Serial.write(' '); Serial.print(S.pins[pin].trig); Serial.write(']');
}
void onStuck(uint8_t pin) { if (proto.slotforge) { Serial.print("[E pin "); Serial.print(pin); Serial.print(" blocked for 3 s]"); } }
void onCalibrated(uint8_t pin, uint16_t base) {
  if (!proto.slotforge) return;
  Serial.print("[C"); Serial.print(pin); Serial.write(' '); Serial.print(base); Serial.write(' '); Serial.print(S.pins[pin].arm); Serial.write(' '); Serial.print(S.pins[pin].trig); Serial.write(']');
}
// ---- the buttons speak ----
// (loopNow, not millis(): an event stamped later than the loop's own clock would make the next tick negative)
void onStart() { proto.letter('W', loopNow); }                   // (the Trackmate has one button; Start/Pause is reported as the Track call too, the app decides what W does)
void onCall() { proto.letter('W', loopNow); }
void onLaneButton(uint8_t lane1) { proto.lane1('K', lane1, loopNow); }

// ---- commands from the PC ----
long num(const char *s) { return atol(s); }
void applyPinRole(uint8_t pin, const char *spec, uint8_t kind) { // spec: L1..L8, P1..P8, K, N
  if (pin >= SFB_ANALOG_PINS) return;
  PinSetting &p = S.pins[pin]; p.kind = kind;
  if (spec[0] == 'L') { p.role = ROLE_LANE; p.index = (uint8_t)num(spec + 1); }
  else if (spec[0] == 'P') { p.role = ROLE_PIT; p.index = (uint8_t)num(spec + 1); }
  else if (spec[0] == 'K') { p.role = ROLE_LADDER; p.index = 0; }
  else { p.role = ROLE_NONE; p.index = 0; }
}
void listSettings() {
  for (uint8_t i = 0; i < SFB_ANALOG_PINS; i++) { Serial.print("[O pin "); Serial.print(i); Serial.write(' '); Serial.print(S.pins[i].role); Serial.write(' '); Serial.print(S.pins[i].index); Serial.write(' '); Serial.print(S.pins[i].kind); Serial.write(' '); Serial.print(S.pins[i].arm); Serial.write(' '); Serial.print(S.pins[i].trig); Serial.write(']'); }
  proto.option("blackout", S.blackoutMs); proto.option("lights", S.lightsKind, S.pixels, S.brightness, S.lanePixels);
  proto.option("relay", S.relayNC, S.laneRelays, S.laneRelaysNC); proto.option("buzzer", S.buzzer); proto.option("safeoff", S.safePowerOff); proto.option("ladder", S.ladderPresent);
}
void setOption(const char *key, const char *val) {
  long v = num(val);
  if (!strcmp(key, "blackout")) S.blackoutMs = (uint16_t)v; else if (!strcmp(key, "lights")) S.lightsKind = (uint8_t)v; else if (!strcmp(key, "pixels")) S.pixels = (uint8_t)v;
  else if (!strcmp(key, "bright")) S.brightness = (uint8_t)v; else if (!strcmp(key, "lanepix")) S.lanePixels = (uint8_t)v; else if (!strcmp(key, "relaync")) S.relayNC = (uint8_t)v;
  else if (!strcmp(key, "lanerelays")) S.laneRelays = (uint8_t)v; else if (!strcmp(key, "lanerelaysnc")) S.laneRelaysNC = (uint8_t)v; else if (!strcmp(key, "buzzer")) S.buzzer = (uint8_t)v;
  else if (!strcmp(key, "safeoff")) S.safePowerOff = (uint8_t)v; else if (!strcmp(key, "ladder")) S.ladderPresent = (uint8_t)v;
  else { proto.msg("unknown option"); return; }
  // only what changed is reconfigured, and the track power is left as it is
  if (!strcmp(key, "lights") || !strcmp(key, "pixels") || !strcmp(key, "bright") || !strcmp(key, "lanepix")) lights.begin(&S);
  else if (!strcmp(key, "relaync") || !strcmp(key, "lanerelays") || !strcmp(key, "lanerelaysnc") || !strcmp(key, "buzzer")) power.configure();
  else if (!strcmp(key, "ladder")) buttons.begin(&S);
}
void handle(char *l, uint32_t now) {
  lastFromPcAt = now;
  if (away) { away = false; proto.ev("S-", now); for (uint8_t i = 0; i < bufN; i++) proto.laneVal('B', buffered[i].lane, (long)buffered[i].at, now); bufN = 0; }
  char c = l[0]; char *rest = l + 1; while (*rest == ' ') rest++;
  switch (c) {
    // Trackmate commands
    case 'A': compatLanes = (uint8_t)constrain(num(rest), 1, MAX_LANES); break;
    case 'C': break;                                   // contact type: the box uses its per-pin kind instead
    case 'D': if (!proto.slotforge) S.blackoutMs = (uint16_t)(constrain(num(rest), 0, 9) * 50); break;
    case 'I': break;
    case 'S': started = true; break;
    case 'E': power.setMain(true); break;
    case 'R': power.setMain(false); break;
    // SlotForge commands
    case 'V': proto.slotforge = true; started = true; proto.version(); break;
    case 'G': proto.slotforge = false; readings = false; break;
    case '!': if (proto.slotforge) Serial.print("[!]"); break; // (the answer lets the PC see that the box is alive and still in SlotForge mode)
    case 'L': lights.set(rest[0] ? rest[0] : '0'); break;
    case 'B': power.beep((uint8_t)constrain(num(rest), 1, 3), now); break;
    case 'M': power.setMain(num(rest) == 1); break;
    case 'Q': if (strlen(rest) >= 2) power.setLane((uint8_t)(rest[0] - '0'), rest[1] == '1'); break;
    case 'N': { uint8_t lane = (uint8_t)num(rest); char *sp = strchr(rest, ' '); if (sp) lights.lane(lane, (uint32_t)strtol(sp + 1, nullptr, 16)); break; }
    case 'X': sensing.calibrate(now); proto.msg("calibrating"); break;
    case 'H': { uint8_t pin = (uint8_t)num(rest); char *a = strchr(rest, ' '); char *b = a ? strchr(a + 1, ' ') : nullptr; if (a && b && pin < SFB_ANALOG_PINS) { S.pins[pin].arm = (uint16_t)num(a + 1); S.pins[pin].trig = (uint16_t)num(b + 1); } break; }
    case 'P': { uint8_t pin = (uint8_t)num(rest); char *a = strchr(rest, ' '); char *b = a ? strchr(a + 1, ' ') : nullptr; if (a) { if (b) *b = 0; applyPinRole(pin, a + 1, b ? (uint8_t)num(b + 1) : (uint8_t)KIND_LIGHT); buttons.begin(&S); } break; }
    case 'O': { char *sp = strchr(rest, ' '); if (sp) { *sp = 0; setOption(rest, sp + 1); } break; }
    case 'W': saveSettings(); proto.msg("saved"); break;
    case '?': listSettings(); break;
    case 'Z': readings = num(rest) == 1; break;
    default: break;
  }
}

void setup() {
  wdt_disable(); // (always: clears a watchdog left armed by a previous reset)
  loadSettings();
  uint32_t now = millis();
  proto.begin(now);
  sensing.begin(&S); sensing.onCross = onCross; sensing.onFree = onFree; sensing.onCalibrated = onCalibrated; sensing.onRelearn = onRelearn; sensing.onStuck = onStuck;
#if defined(SFB_FAST_ADC) && defined(__AVR__)
  ADCSRA = (ADCSRA & ~7) | 5; // ADC prescaler 32
#endif
  lights.begin(&S); power.begin(&S);
  buttons.begin(&S); buttons.onStart = onStart; buttons.onCall = onCall; buttons.onLane = onLaneButton;
  lights.set('S');
  // Saved thresholds are kept: the box calibrates by itself only when the EEPROM holds no settings yet (the first power-up). An Arduino resets every time
  // the port opens, and a car standing over a sensor at that moment would teach it the wrong empty level. Press Calibrate in the app for a new calibration.
  if (freshSettings) sensing.calibrate(now + 500);
  lastFromPcAt = now;
#ifdef SFB_WATCHDOG
  wdt_enable(WDTO_2S);
#endif
}

void loop() {
#ifdef SFB_WATCHDOG
  wdt_reset();
#endif
  uint32_t now = loopNow = millis();
  power.tick(now);
  // one sensor per pass, round-robin: ~1 kHz per sensor with 8 of them
  sensing.sample(nextPin, now); nextPin = (nextPin + 1) % SFB_ANALOG_PINS;
  buttons.poll(now);
  if (proto.read()) handle(proto.line, now);
  // the Trackmate tick every 200 ms, and the letters of covered lanes every 50 ms
  if (now - proto.lastTickAt >= TICK_MS) proto.tick(now);
  if (now - lastLetterAt >= LETTER_MS) {
    for (uint8_t i = 0; i < SFB_ANALOG_PINS; i++) if (S.pins[i].role == ROLE_LANE && sensing.st[i].covered && S.pins[i].index >= 1 && S.pins[i].index <= compatLanes && !away) { Serial.write((uint8_t)('A' + (S.pins[i].index - 1))); }
    lastLetterAt = now;
  }
  // the readings stream: one sensor pin every READING_GAP_MS, and only when the serial buffer can take it, so the sensors are never held up (a Mega has 16 pins)
  if (readings && proto.slotforge && now - lastReadingAt >= READING_GAP_MS && Serial.availableForWrite() >= 12) {
    for (uint8_t n = 0; n < SFB_ANALOG_PINS; n++) {
      uint8_t i = readingPin; readingPin = (readingPin + 1) % SFB_ANALOG_PINS;
      if (S.pins[i].role == ROLE_LANE || S.pins[i].role == ROLE_PIT) { Serial.print("[Z"); Serial.print(i); Serial.write(' '); Serial.print(sensing.st[i].raw); Serial.write(']'); break; }
    }
    lastReadingAt = now;
  }
  // the PC went away (SlotForge mode only: Trackmate software sends no keep-alive)
  if (proto.slotforge && !away && now - lastFromPcAt > KEEPALIVE_TIMEOUT_MS) {
    away = true; lights.set('S'); if (S.safePowerOff) power.setMain(false); power.beep(1, now); proto.ev("S+", now);
  }
}
