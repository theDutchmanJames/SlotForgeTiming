// SlotForge box - track power: the main relay on PIN_RELAY and up to 8 per-lane relays. "on" always means "the track has power"; whether that is a HIGH
// or a LOW pin depends on how the relay is wired (normally open or normally closed), which is a setting. The buzzer lives here too (it is an output).
#pragma once
#include "settings.h"

class Power {
public:
  Settings *S;
  bool mainOn = false;
  bool laneOn[MAX_LANES];
  uint8_t lanePins[MAX_LANES] = SFB_LANE_RELAY_PINS;
  uint32_t secondBeepAt = 0;

  void begin(Settings *s) {
    S = s; for (uint8_t i = 0; i < MAX_LANES; i++) laneOn[i] = true;
    configure(); setMain(false); for (uint8_t i = 0; i < MAX_LANES; i++) setLane(i + 1, true);
  }
  // the pin modes after a settings change: the power stays as it is (a brightness change must never cut the track)
  void configure() {
    pinMode(PIN_RELAY, OUTPUT);
    for (uint8_t i = 0; i < MAX_LANES; i++) if (i < S->laneRelays && lanePins[i] != 255) pinMode(lanePins[i], OUTPUT);
    if (S->buzzer) pinMode(PIN_BUZZER, OUTPUT);
    setMain(mainOn); for (uint8_t i = 0; i < MAX_LANES; i++) setLane(i + 1, laneOn[i]);
  }
  void setMain(bool on) { mainOn = on; digitalWrite(PIN_RELAY, (on != (S->relayNC == 1)) ? HIGH : LOW); }
  // lane1: 1..8
  void setLane(uint8_t lane1, bool on) {
    if (lane1 < 1 || lane1 > MAX_LANES) return;
    laneOn[lane1 - 1] = on; uint8_t i = lane1 - 1;
    if (i < S->laneRelays && lanePins[i] != 255) digitalWrite(lanePins[i], (on != (S->laneRelaysNC == 1)) ? HIGH : LOW);
  }
  // beep patterns: 1 short, 2 double, 3 long (GO)
  void beep(uint8_t pattern, uint32_t now) {
    if (!S->buzzer) return;
    uint16_t f = pattern == 3 ? 1200 : 880, d = pattern == 3 ? 600 : 120;
    tone(PIN_BUZZER, f, d);
    if (pattern == 2) secondBeepAt = now + 270; // (the second beep is played by tick(): nothing in the sketch blocks)
  }
  void tick(uint32_t now) { if (secondBeepAt && (int32_t)(now - secondBeepAt) >= 0) { secondBeepAt = 0; if (S->buzzer) tone(PIN_BUZZER, 880, 120); } }
};
