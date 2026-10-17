#pragma once
#include <stdint.h>
#include "Arduino.h"
#define NEO_GRB 0
#define NEO_KHZ800 0
extern void sim_strip(const uint32_t *px, int n);
struct Adafruit_NeoPixel {
  uint16_t n; uint32_t px[64] = {}; 
  Adafruit_NeoPixel(uint16_t n_, uint8_t, int) : n(n_ > 64 ? 64 : n_) {}
  void begin() {} void clear() { for (int i = 0; i < 64; i++) px[i] = 0; } void setBrightness(uint8_t) {}
  void show() { sim_advance(300 + 30ull * n); sim_strip(px, n); }   // interrupts are off for about 30 us per pixel
  void setPixelColor(uint16_t i, uint32_t c) { if (i < 64) px[i] = c; }
  uint16_t numPixels() { return n; }
  uint32_t Color(uint8_t r, uint8_t g, uint8_t b) { return ((uint32_t)r << 16) | ((uint32_t)g << 8) | b; }
};
