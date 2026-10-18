// SlotForge box - the serial protocol. 9600 baud, 8N1 (the Trackmate's speed, so the box works wherever a Trackmate works).
//
// The box starts in TRACKMATE MODE and sends exactly what a Trackmate sends:
//   A..H         a lane's sensor is covered (repeated every 50 ms while it is)
//   W            the Track call button
//   <ms>LF CR    a tick: the milliseconds since the previous tick, every 200 ms and right before every event (so events carry the box's clock)
// and understands the Trackmate commands: A<n> lanes, C0/C1 contact type, D<n> debounce (blackout = n x 50 ms), I0, S start, E power on, R power off.
//
// When the PC sends "V" the box switches to SLOTFORGE MODE: the Trackmate stream continues unchanged, and extra events arrive in square brackets
// (never a digit outside brackets except in ticks, so a Trackmate parser that ignores brackets still works):
//   [V 1.0.0 nano 8]      version, board, number of analog pins (the answer to V)
//   [P<n>+] [P<n>-]       pit sensor n covered / freed
//   [K<n>]                call button of lane n
//   [T<n> <ms>]           lane n's pass is over: it covered the sensor for <ms> (the speed trap)
//   [Z<pin> <raw>]        a reading of analog pin <pin> (0..1023), when the readings stream is on
//   [C<pin> <base> <arm> <trig>]   calibration result of a pin
//   [S+] [S-]             safe state entered (no keep-alive for 3 s) / left
//   [B<n> <ms>]           a crossing of lane n buffered while the PC was away, <ms> before the tick sent right before this event (sent when the PC is back; up to 1.0.4 it was the absolute box time)
//   [O <key> <value...>]  a setting (the answer to ?)
//   [E <text>]            a message for the log
// Commands in SlotForge mode (each a line ending in LF or CR):
//   !            keep-alive (send every second; answered with [!] so the PC notices a reboot: a rebooted box is back in Trackmate mode and stays silent)
//   L<c>         lights: 0..5 reds, G go, S stop, Y caution
//   B<n>         beep 1 short, 2 double, 3 long         M<0|1> main track power off / on
//   Q<lane><0|1> lane power off / on                    N<lane> <RRGGBB>  status pixel of a lane
//   X            calibrate (2 s, track empty)           H<pin> <arm> <trig>  thresholds of a pin
//   P<pin> <role><index> <kind>   pin role: L1..L8 lane, P1..P8 pit sensor, K ladder, N none; kind 0 light, 1 contact
//   O <key> <value>  option: blackout, lights (0 none 1 strip 2 pins), pixels, bright, lanepix, relaync, lanerelays, lanerelaysnc, buzzer, safeoff, ladder
//   W            write the settings to EEPROM          ?      list the settings       Z<0|1>  readings stream off / on
//   G            back to Trackmate mode
#pragma once
#include "settings.h"

class Protocol {
public:
  bool slotforge = false;
  uint32_t lastTickAt = 0;
  char line[64]; uint8_t len = 0;

  void begin(uint32_t now) { Serial.begin(9600); lastTickAt = now; }

  // the tick: the ms since the previous tick, LF CR (exactly the Trackmate's)
  void tick(uint32_t now) { int32_t d = (int32_t)(now - lastTickAt); Serial.print(d > 0 ? (uint32_t)d : 0UL); Serial.write('\n'); Serial.write('\r'); if (d > 0) lastTickAt = now; } // (never a negative delta: an event stamped a ms before the last tick gives 0; a signed difference, so it also works when millis() wraps after 49.7 days)
  // every event is preceded by a tick, so its time is the box clock
  void letter(char c, uint32_t now) { tick(now); Serial.write(c); }
  void ev(const char *s, uint32_t now) { if (!slotforge) return; tick(now); Serial.write('['); Serial.print(s); Serial.write(']'); }
  void ev2(const char *s, long a, uint32_t now) { if (!slotforge) return; tick(now); Serial.write('['); Serial.print(s); Serial.write(' '); Serial.print(a); Serial.write(']'); }
  void pit(uint8_t n, bool in, uint32_t now) { if (!slotforge) return; tick(now); Serial.write('['); Serial.write('P'); Serial.print(n); Serial.write(in ? '+' : '-'); Serial.write(']'); }
  void lane1(char tag, uint8_t n, uint32_t now) { if (!slotforge) return; tick(now); Serial.write('['); Serial.write(tag); Serial.print(n); Serial.write(']'); }
  void laneVal(char tag, uint8_t n, long v, uint32_t now) { if (!slotforge) return; tick(now); Serial.write('['); Serial.write(tag); Serial.print(n); Serial.write(' '); Serial.print(v); Serial.write(']'); }
  void laneValU(char tag, uint8_t n, uint32_t v, uint32_t now) { if (!slotforge) return; tick(now); Serial.write('['); Serial.write(tag); Serial.print(n); Serial.write(' '); Serial.print(v); Serial.write(']'); } // (an unsigned value: a box time above 2^31 ms, 24.8 days, must not turn negative)
  void option(const char *key, long a, long b = -1, long c = -1, long d = -1) {
    Serial.print("[O "); Serial.print(key); Serial.write(' '); Serial.print(a);
    if (b >= 0) { Serial.write(' '); Serial.print(b); } if (c >= 0) { Serial.write(' '); Serial.print(c); } if (d >= 0) { Serial.write(' '); Serial.print(d); }
    Serial.write(']');
  }
  void version() { Serial.print("[V " SFB_VERSION " " SFB_BOARD " "); Serial.print(SFB_ANALOG_PINS); Serial.write(']'); }
  void msg(const char *t) { if (!slotforge) return; Serial.print("[E "); Serial.print(t); Serial.write(']'); }

  // collects a line from the PC; returns true when one is complete (in `line`, NUL-terminated, without the end)
  bool read() {
    while (Serial.available()) {
      char c = (char)Serial.read();
      if (c == '\n' || c == '\r') { if (len) { line[len] = 0; len = 0; return true; } continue; }
      if (len < sizeof(line) - 1) line[len++] = c;
    }
    return false;
  }
};
