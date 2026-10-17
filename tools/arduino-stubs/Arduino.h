// Minimal Arduino API stubs: enough to syntax-check the SlotForge box sketch with a desktop g++. Not a simulator.
#pragma once
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define FALLING 2
#define A0 14
static unsigned char ADCSRA = 0x87;
#define constrain(x,a,b) ((x)<(a)?(a):((x)>(b)?(b):(x)))
inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t, uint8_t) {}
inline int digitalRead(uint8_t) { return 1; }
inline int analogRead(uint8_t) { return 1023; }
inline unsigned long millis() { return 0; }
inline void delay(unsigned long) {}
inline void tone(uint8_t, unsigned int, unsigned long = 0) {}
inline void attachInterrupt(uint8_t, void (*)(), int) {}
inline uint8_t digitalPinToInterrupt(uint8_t p) { return p; }
struct SerialT { void begin(long) {} int available() { return 0; } int read() { return -1; } int availableForWrite() { return 63; } size_t write(uint8_t) { return 1; } size_t write(char c) { return write((uint8_t)c); }
  template <class T> size_t print(T) { return 1; } template <class T> size_t println(T) { return 1; } };
static SerialT Serial;
