// The firmware host: runs SlotForgeBox.ino (unmodified, any board) on a desktop against a simulated clock. Used by run.js, built by it with
//   g++ -DINO_PATH="<the .ino>" [-D__AVR_ATmega2560__] -I shim -I <the firmware folder> host.cpp
// stdin (the script, one line each, times in microseconds of simulated time):
//   adc <t> <pin> <value>     from t on, analogRead(A0+pin) gives value
//   rx <t> <hex>              the PC sends these bytes (they arrive at 9600 baud, one every 1.04 ms)
//   btn <t> <2|3>             a falling edge on the interrupt pin 2 (Start) or 3 (Track call)
//   end <t>                   stop
// stdout: tx <t> <byte> (a byte that has left the UART, i.e. when the PC has it), pin <t> <pin> mode|write <v>, strip <t> <pixels>, tone <t> <hz> <ms>
// argv[1]: an EEPROM image to start with (optional), argv[2]: where to write the EEPROM at the end (optional).
// What is modelled: millis()/micros() from the simulated time; analogRead takes 112 us (the Arduino's default ADC clock); the UART at 9600 8N1 with the AVR's 64-byte
// transmit buffer, so Serial.write blocks when the buffer is full; NeoPixel show() takes 300 us + 30 us per pixel; delay(); EEPROM; the two button interrupts
// (fired between loop calls and inside analogRead/available). Not modelled: ADC channel carry-over, electrical behaviour, the AVR compiler, interrupts at any instruction.
#ifndef INO_PATH
#error "build with -DINO_PATH=\"path/to/SlotForgeBox.ino\" (run.js does)"
#endif
#include INO_PATH
#include <vector>
#include <deque>
#include <string>
#include <algorithm>
uint64_t sim_us = 0; uint32_t sim_extra_us = 0;
unsigned char sim_eeprom[1024]; EEPROMT EEPROM; HardwareSerial Serial;
struct Ev { uint64_t t; int kind; int a; int b; std::string s; };   // kind 0 adc, 1 rx, 2 btn
static std::vector<Ev> evs; static size_t evi = 0; static uint64_t endAt = 0;
static int adcv[32]; static std::deque<std::pair<uint64_t, uint8_t>> rxq;   // (available at, byte)
static void (*isr[8])() = {};
static std::deque<uint64_t> txdone; static uint64_t lastDone = 0;
static bool inIsr = false;
static void apply_events() {
  while (evi < evs.size() && evs[evi].t <= sim_us) {
    Ev &e = evs[evi++];
    if (e.kind == 0) adcv[e.a] = e.b;
    else if (e.kind == 1) { uint64_t t = e.t; for (unsigned char c : e.s) { rxq.push_back({t, c}); t += 1042; } }
    else if (e.kind == 2) { if (isr[e.a] && !inIsr) { inIsr = true; isr[e.a](); inIsr = false; } }
  }
}
void sim_advance(uint64_t us) { sim_us += us; }
void sim_pin_log(uint8_t pin, const char *what, int v) { printf("pin %llu %d %s %d\n", (unsigned long long)sim_us, pin, what, v); }
void sim_strip(const uint32_t *px, int n) { printf("strip %llu", (unsigned long long)sim_us); for (int i = 0; i < n; i++) printf(" %06x", px[i]); printf("\n"); }
void pinMode(uint8_t pin, uint8_t m) { sim_pin_log(pin, "mode", m); }
void digitalWrite(uint8_t pin, uint8_t v) { sim_pin_log(pin, "write", v); }
int digitalRead(uint8_t) { return 1; }
int analogRead(uint8_t pin) { apply_events(); sim_us += 112; int i = pin - A0; return i >= 0 && i < 32 ? adcv[i] : 0; }
unsigned long millis() { return (unsigned long)((sim_us / 1000) & 0xFFFFFFFFull); }
unsigned long micros() { return (unsigned long)(sim_us & 0xFFFFFFFFull); }
void delay(unsigned long ms) { sim_us += ms * 1000ull; }
void tone(uint8_t, unsigned int f, unsigned long d) { printf("tone %llu %u %lu\n", (unsigned long long)sim_us, f, d); }
void attachInterrupt(uint8_t n, void (*f)(), int) { if (n < 8) isr[n] = f; }
int HardwareSerial::available() { apply_events(); return (!rxq.empty() && rxq.front().first <= sim_us) ? 1 : 0; }
int HardwareSerial::availableForWrite() { while (!txdone.empty() && txdone.front() <= sim_us) txdone.pop_front(); int used = txdone.size() > 0 ? (int)txdone.size() - 1 : 0; return 63 - used; }
int HardwareSerial::read() { if (available()) { int c = rxq.front().second; rxq.pop_front(); return c; } return -1; }
size_t HardwareSerial::write(uint8_t b) {
  while (!txdone.empty() && txdone.front() <= sim_us) txdone.pop_front();
  while (txdone.size() >= 65) { sim_us = std::max(sim_us, txdone.front()); txdone.pop_front(); }   // the 64-byte buffer is full: write() blocks
  uint64_t start = std::max(sim_us, lastDone); lastDone = start + 1042; txdone.push_back(lastDone);
  printf("tx %llu %d\n", (unsigned long long)lastDone, b); return 1;
}
int main(int argc, char **argv) {
  char kind[16]; unsigned long long t;
  while (scanf("%15s", kind) == 1) {
    if (!strcmp(kind, "adc")) { int p, v; if (scanf("%llu %d %d", &t, &p, &v) == 3) evs.push_back({t, 0, p, v, ""}); }
    else if (!strcmp(kind, "rx")) { char h[512]; if (scanf("%llu %511s", &t, h) == 2) { std::string s; for (size_t i = 0; h[i] && h[i + 1]; i += 2) { char b[3] = { h[i], h[i + 1], 0 }; s += (char)strtol(b, 0, 16); } evs.push_back({t, 1, 0, 0, s}); } }
    else if (!strcmp(kind, "btn")) { int p; if (scanf("%llu %d", &t, &p) == 2) evs.push_back({t, 2, p, 0, ""}); }
    else if (!strcmp(kind, "end")) { if (scanf("%llu", &t) == 1) endAt = t; }
  }
  std::stable_sort(evs.begin(), evs.end(), [](const Ev &a, const Ev &b) { return a.t < b.t; });
  for (int i = 0; i < 32; i++) adcv[i] = 1023;
  memset(sim_eeprom, 0xFF, sizeof sim_eeprom);
  if (argc > 1) { FILE *f = fopen(argv[1], "rb"); if (f) { size_t n = fread(sim_eeprom, 1, sizeof sim_eeprom, f); (void)n; fclose(f); } }
  setup();
  while (sim_us < endAt) { apply_events(); loop(); sim_us += 6; }
  if (argc > 2) { FILE *f = fopen(argv[2], "wb"); if (f) { fwrite(sim_eeprom, 1, sizeof sim_eeprom, f); fclose(f); } }
  return 0;
}
