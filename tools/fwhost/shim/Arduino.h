// A functional desktop shim of the Arduino API, just enough to RUN the SlotForge box sketch against a clock, a scripted ADC, a 9600 baud UART with
// the AVR's 64-byte transmit buffer, and the two button interrupts. Written for the review, not part of the package.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define FALLING 2
#ifdef __AVR_ATmega2560__
#define A0 54
#else
#define A0 14
#endif
#define constrain(x,a,b) ((x)<(a)?(a):((x)>(b)?(b):(x)))
extern uint64_t sim_us;                      // the simulated time
extern uint32_t sim_extra_us;                // time added by things the shim models (ADC conversions, blocking, show())
void sim_advance(uint64_t us);
void sim_pin_log(uint8_t pin, const char *what, int v);
void pinMode(uint8_t pin, uint8_t m);
void digitalWrite(uint8_t pin, uint8_t v);
int digitalRead(uint8_t);
int analogRead(uint8_t pin);
unsigned long millis();
unsigned long micros();
void delay(unsigned long ms);
void tone(uint8_t pin, unsigned int f, unsigned long d = 0);
void attachInterrupt(uint8_t n, void (*f)(), int mode);
inline uint8_t digitalPinToInterrupt(uint8_t p) { return p; }
// Print semantics of the Arduino core: char prints a character, uint8_t prints a number.
struct HardwareSerial {
  void begin(long) {}
  int available(); int read(); int availableForWrite();
  size_t write(uint8_t b);
  size_t write(char c) { return write((uint8_t)c); }
  size_t print(const char *s) { size_t n = 0; while (*s) { write((uint8_t)*s++); n++; } return n; }
  size_t print(char c) { return write((uint8_t)c); }
  size_t printn(unsigned long long v, bool neg) { char b[24]; int i = 0; if (!v) b[i++] = '0'; while (v) { b[i++] = '0' + v % 10; v /= 10; } if (neg) write('-'); size_t n = i; while (i) write((uint8_t)b[--i]); return n; }
  size_t print(unsigned char v) { return printn(v, false); }
  size_t print(int v) { return printn(v < 0 ? -(long long)v : v, v < 0); }
  size_t print(unsigned int v) { return printn(v, false); }
  size_t print(long v) { return printn(v < 0 ? -(long long)v : v, v < 0); }
  size_t print(unsigned long v) { return printn(v, false); }
};
extern HardwareSerial Serial;
