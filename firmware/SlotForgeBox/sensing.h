// SlotForge box - sensing: the ADC poll loop, two-threshold detection, calibration and the blackout.
// Every analog pin with a role (lane or pit sensor) is read in turn, about 1000 times a second each. A pass is: the reading drops below `arm`
// (the pass is armed, samples are counted), then below `trig` (the car is confirmed: this is the crossing, reported at once), then back above `arm`
// (the pass is over: its duration is reported). A contact sensor reads 0 or 1023 and goes through the same logic.
// Light sensors: a car over a reflective sensor makes the reading go UP, over a beam sensor DOWN. The box always works with "lower = car":
// a reflective sensor is wired so that its output falls (or the app sets the kind to "light, inverted", which flips the reading here).
#pragma once
#include "settings.h"

struct SensorState {
  uint16_t raw;          // last reading (after inversion)
  uint16_t base;         // the empty level learned by calibration
  bool armed;            // below arm
  bool confirmed;        // below trig since armed
  bool covered;          // what the protocol reports: a confirmed pass in progress (or in its blackout)
  uint32_t armedAt;      // ms when armed
  uint32_t confirmedAt;  // ms of the crossing
  uint32_t freeAt;       // ms when the sensor became free again (for the blackout)
  uint32_t aboveSince;   // ms since when the reading has been above arm during a pass (0 = it is below)
  uint32_t aboveTrigSince; // ms since when the reading has been above trig during a confirmed pass (0 = it is below)
  bool blocked;          // a pass was ended by STUCK_MS: no new pass until the reading is back above arm (else a stalled car counts a lap every STUCK_MS)
  uint32_t calibSum;     // calibration accumulator
  uint16_t calibN;
};

class Sensing {
public:
  Settings *S;
  SensorState st[SFB_ANALOG_PINS];
  bool calibrating = false;
  uint32_t calibUntil = 0;
  // callbacks set by the sketch
  void (*onCross)(uint8_t pin, uint32_t atMs) = nullptr;          // a confirmed crossing (lane or pit: the sketch looks at the role)
  void (*onFree)(uint8_t pin, uint32_t atMs, uint32_t durMs) = nullptr; // the pass is over, with its duration
  void (*onCalibrated)(uint8_t pin, uint16_t base) = nullptr;
  void (*onRelearn)(uint8_t pin, uint16_t base) = nullptr;   // a drifted pass was ended and the pin's empty level re-learned
  void (*onStuck)(uint8_t pin) = nullptr;                    // a sensor has been blocked for STUCK_MS (PIT_STUCK_MS for a pit sensor): the pass was ended, thresholds untouched

  void begin(Settings *s) { S = s; for (uint8_t i = 0; i < SFB_ANALOG_PINS; i++) { st[i] = SensorState(); st[i].raw = 1023; st[i].base = 1023; } }

  void calibrate(uint32_t now) { calibrating = true; calibUntil = now + CALIB_MS; for (uint8_t i = 0; i < SFB_ANALOG_PINS; i++) { st[i].calibSum = 0; st[i].calibN = 0; } }

  // one reading of one pin; called round-robin from loop()
  void sample(uint8_t pin, uint32_t now) {
    PinSetting &p = S->pins[pin]; if (p.role != ROLE_LANE && p.role != ROLE_PIT) return;
    analogRead(A0 + pin); uint16_t r = analogRead(A0 + pin); // (twice: the first read after another channel can carry that channel's value with a high-impedance sensor)
    if (p.kind == KIND_CONTACT) r = r < 512 ? 0 : 1023;   // a contact: closed = car (wired to pull the input low)
    SensorState &x = st[pin]; x.raw = r;
    if (calibrating) { x.calibSum += r; x.calibN++; if ((int32_t)(now - calibUntil) >= 0) finishCalib(); return; }
    if (x.blocked) { if (r >= p.arm) { x.blocked = false; x.freeAt = now; } return; } // still blocked: wait until the sensor is free
    if (!x.armed) { // arm, and go on to the confirm check in the SAME sample: a short pass (a guide blade through a beam, 3-6 ms) is seen on its first sample
      if (r < p.arm && now - x.freeAt >= S->blackoutMs) { x.armed = true; x.confirmed = false; x.armedAt = now; }
      else return;
    }
    if (!x.confirmed && r < p.trig) { x.confirmed = true; x.confirmedAt = now; x.covered = true; x.aboveSince = 0; x.aboveTrigSince = 0; if (onCross) onCross(pin, now); }
    if (x.confirmed) {
      // the car is gone (above the trigger) but the pass cannot end because the empty level has fallen below arm (ambient light, a nudged sensor): after DRIFT_MS end it and learn the new level
      if (r >= p.trig) { if (!x.aboveTrigSince) x.aboveTrigSince = now ? now : 1; } else x.aboveTrigSince = 0;
      if (x.aboveTrigSince && now - x.aboveTrigSince >= DRIFT_MS) {
        uint32_t endedAt = x.aboveTrigSince; x.armed = false; x.confirmed = false; x.covered = false; x.aboveSince = 0; x.aboveTrigSince = 0; x.freeAt = now;
        x.base = r; p.arm = (uint16_t)((uint32_t)r * 85 / 100); p.trig = (uint16_t)((uint32_t)r * 60 / 100);
        if (onFree) onFree(pin, now, endedAt - x.confirmedAt);
        if (onRelearn) onRelearn(pin, r);
        return;
      }
      // something blocks the sensor (below the trigger for STUCK_MS): end the pass so the lane is not covered for ever; the thresholds are left alone (a blocked sensor must not re-learn a wrong level)
      if (now - x.confirmedAt > (p.role == ROLE_PIT ? PIT_STUCK_MS : STUCK_MS)) { x.armed = false; x.confirmed = false; x.covered = false; x.aboveSince = 0; x.aboveTrigSince = 0; x.freeAt = now; x.blocked = true; if (onStuck) onStuck(pin); return; }
    }
    if (r >= p.arm) { // above arm: the pass is over once it has stayed there RELEASE_MS (a bounce dips below again and the pass goes on)
      if (!x.aboveSince) x.aboveSince = now ? now : 1;
      if (now - x.aboveSince >= RELEASE_MS) {
        uint32_t endedAt = x.aboveSince; x.armed = false; x.aboveSince = 0;
        if (x.confirmed) { x.covered = false; x.freeAt = now; if (onFree) onFree(pin, now, endedAt - x.confirmedAt); } // (the duration is the pass itself, without the release time)
        x.confirmed = false;
      }
    } else x.aboveSince = 0;
  }

  // the calibration time is up: every sensor gets its empty level and thresholds from the samples taken
  void finishCalib() {
    calibrating = false;
    for (uint8_t pin = 0; pin < SFB_ANALOG_PINS; pin++) {
      SensorState &x = st[pin]; PinSetting &p = S->pins[pin];
      if ((p.role != ROLE_LANE && p.role != ROLE_PIT) || !x.calibN) continue;
      x.base = x.calibSum / x.calibN; p.arm = (uint16_t)((uint32_t)x.base * 85 / 100); p.trig = (uint16_t)((uint32_t)x.base * 60 / 100);
      x.armed = false; x.confirmed = false; x.covered = false; x.blocked = false;
      if (onCalibrated) onCalibrated(pin, x.base);
    }
  }
};
