// SlotForge box - settings: the board, the pin maps and the defaults.
// Pick the board with ONE define below (or in the Arduino IDE: Tools > Board, the sketch reads the board macros).
// Everything the app can change at run time (pin roles, thresholds, lights kind, relays, safe state) lives in the Settings struct and is kept in EEPROM.
#pragma once
#include <Arduino.h>

#define SFB_VERSION "1.0.4"

// ---- the board ----
#if defined(__AVR_ATmega2560__)
  #define SFB_BOARD "mega"
  #define SFB_ANALOG_PINS 16            // A0..A15: lanes, pit sensors, the call-button ladder
  #define SFB_LANE_RELAY_PINS { 22, 23, 24, 25, 26, 27, 28, 29 }
  #define SFB_PLAIN_LED_PINS { 30, 31, 32, 33, 34, 35, 36 }   // 5 reds, GO, caution
#else
  #define SFB_BOARD "nano"
  #define SFB_ANALOG_PINS 8             // A0..A7
  #define SFB_LANE_RELAY_PINS { 7, 8, 9, 10, 11, 12, 13, 255 } // 255 = no pin: an 8th lane relay does not fit a Nano with the buzzer
  #define SFB_PLAIN_LED_PINS { 7, 8, 9, 10, 11, 12, 13 }       // (shares D7..D13 with the lane relays: the app refuses both at once)
#endif

// fixed pins, both boards
#define PIN_START   2   // Start / Pause button (external interrupt)
#define PIN_CALL    3   // Track call button (external interrupt)
#define PIN_RELAY   4   // main track power relay
#define PIN_BUZZER  5   // passive buzzer
#define PIN_STRIP   6   // WS2812 strip (lights kind "strip")

#define MAX_LANES   8
#define MAX_PITS    8
#define TICK_MS     200     // the Trackmate tick
#define LETTER_MS   50      // how often a covered sensor repeats its letter
#define KEEPALIVE_TIMEOUT_MS 3000
#define CALIB_MS    2000
#define RELEASE_MS  8       // a pass is over only after the reading has stayed above arm this long (a bouncing contact or a flickering light sensor)
#define DRIFT_MS    1000    // during a pass the reading stays above the trigger this long: the car is gone and the empty level has moved below arm (ambient light); the pass is ended and the level re-learned
#define STUCK_MS    3000    // a pass longer than this with the reading below the trigger: something blocks the sensor; the pass is ended (thresholds untouched) and the PC is told
#define PIT_STUCK_MS 120000UL // the same for a PIT sensor: a car stands there for a refuel, so it may be covered much longer (2 minutes); then the PC is told the car left ([P<n>-]) so the pit does not stay occupied
#define BUFFERED_LAPS 32    // crossings kept while the PC is away
#define READING_GAP_MS 30   // the readings stream sends ONE pin every 30 ms (8 sensors = a full set every 240 ms) and only when the serial buffer has room, so it never blocks the sensors

// what an analog pin is used for
enum PinRole : uint8_t { ROLE_NONE = 0, ROLE_LANE = 1, ROLE_PIT = 2, ROLE_LADDER = 3 };
enum SensorKind : uint8_t { KIND_LIGHT = 0, KIND_CONTACT = 1 };
enum LightsKind : uint8_t { LIGHTS_NONE = 0, LIGHTS_STRIP = 1, LIGHTS_PINS = 2 };

struct PinSetting {
  uint8_t role;      // PinRole
  uint8_t index;     // lane 1..8 or pit 1..8 (1-based, as the protocol speaks)
  uint8_t kind;      // SensorKind
  uint16_t arm;      // two-threshold: below this the pass is armed
  uint16_t trig;     // below this the car is confirmed
};

struct Settings {
  uint16_t magic;                 // 0x5FB1 when the EEPROM holds settings
  uint8_t version;                // layout version of this struct
  PinSetting pins[SFB_ANALOG_PINS];
  uint16_t blackoutMs;            // a sensor is "free" again this long after a pass
  uint8_t lightsKind;             // LightsKind
  uint8_t pixels;                 // strip length (>= 7)
  uint8_t brightness;             // 0..255
  uint8_t lanePixels;             // 1 = one status pixel per lane after the first 7
  uint8_t relayNC;                // 1 = the main relay is wired normally closed
  uint8_t laneRelays;             // number of per-lane relays (0..8)
  uint8_t laneRelaysNC;           // 1 = lane relays normally closed
  uint8_t buzzer;                 // 1 = buzzer present
  uint8_t safePowerOff;           // 1 = cut the track power when the PC goes away
  uint8_t ladderPresent;          // 1 = a call-button ladder is on the pin with ROLE_LADDER
};

#define SETTINGS_MAGIC 0x5FB1
#define SETTINGS_VERSION 1

// the defaults: 4 lanes on A0..A3 as light sensors, A4..A7 not used (an unwired pin floats and would give phantom pit stops), strip lights with 8 pixels, one main relay, buzzer, power off when the PC is gone
inline void defaultSettings(Settings &s) {
  s.magic = SETTINGS_MAGIC; s.version = SETTINGS_VERSION;
  for (uint8_t i = 0; i < SFB_ANALOG_PINS; i++) {
    s.pins[i].role = i < 4 ? ROLE_LANE : ROLE_NONE;
    s.pins[i].index = i < 4 ? i + 1 : 0;
    s.pins[i].kind = KIND_LIGHT; s.pins[i].arm = 700; s.pins[i].trig = 500;
  }
  s.blackoutMs = 300; s.lightsKind = LIGHTS_STRIP; s.pixels = 8; s.brightness = 64; s.lanePixels = 0;
  s.relayNC = 0; s.laneRelays = 0; s.laneRelaysNC = 0; s.buzzer = 1; s.safePowerOff = 1; s.ladderPresent = 0;
}
