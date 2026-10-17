# avrcheck: compile the box firmware for the real AVR chips, without the Arduino IDE

`tools/avrcheck/setup.sh` once (git clones, about 120 MB), then `tools/avrcheck/check.sh` (a few seconds). Needs `clang` with the AVR target (Ubuntu: `apt install clang`; on a Mac `brew install llvm`) and `git`. Without a clang that has AVR it prints SKIPPED and exits 0.

It compiles the unmodified `firmware/SlotForgeBox/SlotForgeBox.ino` for the **ATmega328P (Nano)** and the **ATmega2560 (Mega)** against the real Arduino AVR core headers, the real avr-libc 2.0.0 headers and the real Adafruit NeoPixel library, so `int` is 16 bit, the types are the real ones and a wrong use of the Arduino or NeoPixel API fails. Warnings in the sketch's own files fail the check. It also compiles the core files the sketch uses and the NeoPixel library, and prints the sizes.

## What it is not
- It is **clang**, not avr-gcc (the compiler of the Arduino IDE). Something avr-gcc rejects and clang accepts would slip through; that is rare, so treat a green check as "very probably compiles in the IDE", and press Verify in the IDE once as well.
- It does not link, so there is no real flash/RAM figure. The printed sizes add up the object files without removing unused code (flash is an upper bound; clang's AVR code is usually a little bigger than avr-gcc's). Static RAM is exact for the sketch and the core; the stack and the NeoPixel buffer (3 bytes a pixel, on the heap) come on top.
- Three things are replaced because clang cannot parse the gcc-only parts: the watchdog macros (`pre.h`: the names and arguments are the real ones), the exact `_delay_us` builtin (not used by the sketch), and a few headers avr-libc normally generates (`setup.sh`).
- Timing is not tested here: that is what `tools/fwhost` does (on the desktop, with a simulated clock).

## What it caught while it was made
Nothing wrong in the sketch: it compiles for both boards with no warnings in its own files (SlotForge box 1.0.3). On the Nano: static RAM 882 of 2048 bytes, flash at most 24036 of 30720. On the Mega: 1222 of 8192 and 25560 of 253952. A deliberate API error, an unused variable and a constant that overflows a 16-bit `int` (`300 * 300`, fine on the desktop bench where `int` is 32 bit) all make the check fail.

`SFB_FIRMWARE=<folder>` checks another copy of the sketch folder.
