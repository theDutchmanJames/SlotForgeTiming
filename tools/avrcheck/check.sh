#!/bin/bash
# usage: tools/avrcheck/check.sh [nano] [mega]   (both when none is given)
# Compiles the unmodified sketch for the ATmega328P (Nano) and the ATmega2560 (Mega) with clang's AVR backend, against the real Arduino AVR core headers, the real
# avr-libc 2.0.0 headers and the real Adafruit NeoPixel library (so ints are 16 bit, the real types and the real library API). Warnings in the sketch's own files
# fail the check. It also compiles the core files and the NeoPixel library and prints the sizes (an upper bound: clang's AVR code is usually larger than avr-gcc's).
# It is NOT the Arduino IDE: avr-gcc is another compiler, and it does not link. Verify in the Arduino IDE as well.
H=$(cd "$(dirname "$0")"; pwd); FW=${SFB_FIRMWARE:-$H/../../firmware/SlotForgeBox}; D=$H/deps
if ! clang --print-targets 2>/dev/null | grep -q " avr "; then echo "SKIPPED: no clang with the AVR target on this machine (apt install clang / brew install llvm)"; exit 0; fi
[ -d $D/inc ] || { echo "run tools/avrcheck/setup.sh first"; exit 1; }
BOARDS=${@:-nano mega}; FAIL=0
for B in $BOARDS; do
  if [ "$B" = mega ]; then MCU=atmega2560; VAR=mega; DEFB=-DARDUINO_AVR_MEGA2560; FLASH=253952; RAM=8192; else MCU=atmega328p; VAR=eightanaloginputs; DEFB=-DARDUINO_AVR_NANO; FLASH=30720; RAM=2048; fi
  OUT=$H/out/$B; rm -rf $OUT; mkdir -p $OUT; C=$D/ArduinoCore-avr/cores/arduino
  COMMON="--target=avr -mmcu=$MCU -DF_CPU=16000000L -DARDUINO=10819 -DARDUINO_ARCH_AVR $DEFB -Os -ffunction-sections -fdata-sections -fno-exceptions -include $H/pre.h -I$D/inc -I$C -I$D/ArduinoCore-avr/variants/$VAR -I$D/ArduinoCore-avr/libraries/EEPROM/src -I$D/Adafruit_NeoPixel"
  cp $FW/SlotForgeBox.ino $OUT/SlotForgeBox.cpp
  clang++ $COMMON -Wall -Wextra -Wno-unused-parameter -std=gnu++11 -include Arduino.h -I$FW -c $OUT/SlotForgeBox.cpp -o $OUT/sketch.o > $OUT/sketch.log 2>&1; RC=$?
  MINE=$(grep -E "(SlotForgeBox\.cpp|SlotForgeBox/[a-z]+\.h):[0-9]+:[0-9]+: (warning|error)" $OUT/sketch.log)
  if [ $RC -ne 0 ] || [ -n "$MINE" ]; then echo "FAIL $B: the sketch does not compile cleanly with clang/AVR"; echo "$MINE" | head -10; grep -m5 error $OUT/sketch.log; FAIL=1; continue; fi
  echo "ok   $B ($MCU): the sketch compiles, no warnings in its own files"
  OBJ="$OUT/sketch.o"
  for f in main.cpp abi.cpp new.cpp hooks.c wiring.c wiring_digital.c wiring_analog.c WInterrupts.c HardwareSerial.cpp HardwareSerial0.cpp Print.cpp Stream.cpp; do
    if [[ $f == *.cpp ]]; then clang++ $COMMON -w -std=gnu++11 -c $C/$f -o $OUT/$f.o 2>$OUT/$f.err; else clang $COMMON -w -std=gnu11 -c $C/$f -o $OUT/$f.o 2>$OUT/$f.err; fi
    [ -s $OUT/$f.o ] && OBJ="$OBJ $OUT/$f.o" || { echo "FAIL $B: the Arduino core file $f does not compile with clang/AVR (not the sketch's fault, check the log in $OUT)"; }
  done
  clang++ $COMMON -w -std=gnu++11 -c $D/Adafruit_NeoPixel/Adafruit_NeoPixel.cpp -o $OUT/neopixel.o 2>$OUT/neopixel.err && OBJ="$OBJ $OUT/neopixel.o" || echo "FAIL $B: Adafruit_NeoPixel.cpp does not compile with clang/AVR"
  llvm-size $OBJ | awk -v b=$B -v fl=$FLASH -v ram=$RAM 'NR>1{t+=$1;d+=$2;s+=$3} END{printf "     %s: flash at most %d of %d bytes (%d%%), static RAM %d of %d bytes (%d%%) + the pixels (3 bytes each) and the stack\n", b, t+d, fl, 100*(t+d)/fl, d+s, ram, 100*(d+s)/ram}'
done
exit $FAIL
