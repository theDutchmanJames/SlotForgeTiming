#pragma once
#include <stdint.h>
#define NEO_GRB 0
#define NEO_KHZ800 0
struct Adafruit_NeoPixel { Adafruit_NeoPixel(uint16_t n, uint8_t, int) : n(n) {} uint16_t n; void begin() {} void show() {} void clear() {} void setBrightness(uint8_t) {} void setPixelColor(uint16_t, uint32_t) {}
  uint16_t numPixels() { return n; } uint32_t Color(uint8_t r, uint8_t g, uint8_t b) { return ((uint32_t)r << 16) | ((uint32_t)g << 8) | b; } };
