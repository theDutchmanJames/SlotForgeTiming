#!/bin/bash
# Fetches what the compile check needs into tools/avrcheck/deps (git only, about 120 MB): the Arduino AVR core, the Adafruit NeoPixel library and avr-libc 2.0.0
# (the version the Arduino IDE ships), and generates the three headers that avr-libc normally builds at install time. Run once.
set -e; cd "$(dirname "$0")"; mkdir -p deps; cd deps
[ -d ArduinoCore-avr ] || git clone -q --depth 1 https://github.com/arduino/ArduinoCore-avr
[ -d Adafruit_NeoPixel ] || git clone -q --depth 1 https://github.com/adafruit/Adafruit_NeoPixel
[ -d avr-libc ] || git clone -q --depth 1 --branch avr-libc-2_0_0-release https://github.com/avrdudes/avr-libc
rm -rf inc; mkdir inc; cp -r avr-libc/include/* inc/
for f in avr/builtins avr/version util/delay; do sed -e 's/@[A-Za-z_]*@/1/g' inc/$f.h.in > inc/$f.h; done
sed -i 's/#    define __HAS_DELAY_CYCLES 1/#    define __HAS_DELAY_CYCLES 0/' inc/util/delay.h   # (the builtin that makes delay.h exact is gcc only)
echo "avrcheck: ready"
