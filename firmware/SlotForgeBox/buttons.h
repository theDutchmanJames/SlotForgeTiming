// SlotForge box - buttons: Start/Pause and Track call on the two external-interrupt pins (a press is never missed, however busy the loop is), and the
// optional call-button ladder: up to 8 buttons on one analog pin through resistors, each giving its own voltage. The ladder pin is the one with ROLE_LADDER.
// Ladder wiring (the build guide draws it): 5V -> 1k -> pin, and from the pin to GND through a button in series with 0 (button 1), 1k, 2.2k, 3.9k, 6.8k, 12k, 22k, 47k.
// The reading with no button is 1023; the table below says which button a reading belongs to (midpoints, with 40 counts of slack).
#pragma once
#include "settings.h"

static volatile uint8_t sfbStartPressed = 0, sfbCallPressed = 0;
static volatile uint32_t sfbStartAt = 0, sfbCallAt = 0;
static void sfbIsrStart() { uint32_t n = millis(); if (n - sfbStartAt > 150) { sfbStartPressed = 1; sfbStartAt = n; } }
static void sfbIsrCall() { uint32_t n = millis(); if (n - sfbCallAt > 150) { sfbCallPressed = 1; sfbCallAt = n; } }

class Buttons {
public:
  Settings *S;
  int8_t ladderPin = -1;
  uint8_t ladderDown = 0;        // the button currently held (1..8), 0 = none
  uint32_t ladderChangedAt = 0;
  void (*onStart)() = nullptr;
  void (*onCall)() = nullptr;
  void (*onLane)(uint8_t lane1) = nullptr;

  void begin(Settings *s) {
    S = s;
    pinMode(PIN_START, INPUT_PULLUP); pinMode(PIN_CALL, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PIN_START), sfbIsrStart, FALLING);
    attachInterrupt(digitalPinToInterrupt(PIN_CALL), sfbIsrCall, FALLING);
    ladderPin = -1; for (uint8_t i = 0; i < SFB_ANALOG_PINS; i++) if (S->pins[i].role == ROLE_LADDER) ladderPin = i;
  }
  // readings (no button = 1023) for buttons 1..8 with the resistor values above, 1k on top: 0, 512, 703, 814, 892, 945, 978, 1002
  uint8_t ladderButton(uint16_t r) {
    static const uint16_t mid[8] = { 0, 512, 703, 814, 892, 945, 978, 1002 };
    if (r > 1012) return 0;
    uint8_t best = 1; uint16_t bd = 1023;
    for (uint8_t i = 0; i < 8; i++) { uint16_t d = r > mid[i] ? r - mid[i] : mid[i] - r; if (d < bd) { bd = d; best = i + 1; } }
    return bd <= 40 ? best : 0;
  }
  void poll(uint32_t now) {
    if (sfbStartPressed) { sfbStartPressed = 0; if (onStart) onStart(); }
    if (sfbCallPressed) { sfbCallPressed = 0; if (onCall) onCall(); }
    if (ladderPin >= 0 && S->ladderPresent) {
      uint8_t b = ladderButton(analogRead(A0 + ladderPin));
      if (b != ladderDown && now - ladderChangedAt > 30) { ladderChangedAt = now; if (b && onLane) onLane(b); ladderDown = b; }
    }
  }
};
