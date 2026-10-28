#!/bin/sh
# Syntax-checks the sketch with a desktop g++ and the Arduino stubs (no toolchain needed). A real build still needs the Arduino IDE.
set -e
cd "$(dirname "$0")/.."
for BOARD in nano mega; do
  DEF=""; [ "$BOARD" = mega ] && DEF="-D__AVR_ATmega2560__"
  g++ -std=gnu++11 -fsyntax-only -Wall -Wextra -Wno-unused-parameter $DEF -I tools/arduino-stubs -x c++ firmware/SlotForgeBox/SlotForgeBox.ino && echo "firmware syntax ok ($BOARD)"
done
