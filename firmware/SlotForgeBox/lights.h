// SlotForge box - the start lights: a WS2812 strip on PIN_STRIP (kind "strip") or plain LEDs on pins (kind "pins"), chosen in the settings.
// States, as the app sends them with the L command: 0 = all off, 1..5 = that many red lights on (the countdown), G = green GO, S = red STOP, Y = yellow caution.
// On a strip: pixels 0..4 are the five reds, 5 is GO (green), 6 is caution (yellow); pixels 7.. are one status pixel per lane when lanePixels is on
// (the app sets their colour with the N command). Plain pins: the same seven, one LED each.
// The strip needs the Adafruit NeoPixel library (Library Manager: "Adafruit NeoPixel"). Without it, build with -DSFB_NO_STRIP and only plain pins work.
#pragma once
#include "settings.h"
#ifndef SFB_NO_STRIP
  #include <Adafruit_NeoPixel.h>
#endif

class Lights {
public:
  Settings *S;
  char state = 0;
  uint32_t laneColor[MAX_LANES] = {};
#ifndef SFB_NO_STRIP
  Adafruit_NeoPixel *strip = nullptr;
#endif
  uint8_t plainPins[7] = SFB_PLAIN_LED_PINS;

  void begin(Settings *s) {
    S = s;
    if (S->lightsKind == LIGHTS_PINS) { for (uint8_t i = 0; i < 7; i++) { pinMode(plainPins[i], OUTPUT); digitalWrite(plainPins[i], LOW); } }
#ifndef SFB_NO_STRIP
    if (strip) { strip->clear(); strip->show(); delete strip; strip = nullptr; } // (a settings change makes a new strip object: free the old one, a Nano has 2 KB)
    if (S->lightsKind == LIGHTS_STRIP) { strip = new Adafruit_NeoPixel(S->pixels < 7 ? 7 : S->pixels, PIN_STRIP, NEO_GRB + NEO_KHZ800); strip->begin(); strip->setBrightness(S->brightness); strip->show(); }
#endif
    set(state == 0 ? '0' : state); // (keeps what was shown; the first call shows nothing)
  }
  // c: '0'..'5', 'G', 'S', 'Y'
  void set(char c) {
    state = c; bool red[5] = { false, false, false, false, false }, go = false, caution = false;
    if (c >= '1' && c <= '5') { for (uint8_t i = 0; i < (uint8_t)(c - '0'); i++) red[i] = true; }
    else if (c == 'S') { for (uint8_t i = 0; i < 5; i++) red[i] = true; }
    else if (c == 'G') go = true;
    else if (c == 'Y') caution = true;
    if (S->lightsKind == LIGHTS_PINS) { for (uint8_t i = 0; i < 5; i++) digitalWrite(plainPins[i], red[i] ? HIGH : LOW); digitalWrite(plainPins[5], go ? HIGH : LOW); digitalWrite(plainPins[6], caution ? HIGH : LOW); }
#ifndef SFB_NO_STRIP
    if (strip) {
      for (uint8_t i = 0; i < 5; i++) strip->setPixelColor(i, red[i] ? strip->Color(255, 0, 0) : 0);
      strip->setPixelColor(5, go ? strip->Color(0, 255, 0) : 0); strip->setPixelColor(6, caution ? strip->Color(255, 180, 0) : 0);
      if (S->lanePixels) for (uint8_t l = 0; l < MAX_LANES && 7 + l < strip->numPixels(); l++) strip->setPixelColor(7 + l, laneColor[l]);
      strip->show();
    }
#endif
  }
  // the status pixel of a lane (1-based), colour as 0xRRGGBB
  void lane(uint8_t lane1, uint32_t rgb) { if (lane1 >= 1 && lane1 <= MAX_LANES) { laneColor[lane1 - 1] = rgb; set(state); } }
};
