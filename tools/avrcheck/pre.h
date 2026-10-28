// Compile check only (see README.md). clang checks the inline-asm operand constraints of avr/wdt.h even in branches that avr-gcc throws away, so the three watchdog
// calls the sketch uses are replaced here; their names and arguments are the real ones, so a misuse in the sketch still fails to compile.
#define _AVR_WDT_H_
#define WDTO_15MS 0
#define WDTO_30MS 1
#define WDTO_60MS 2
#define WDTO_120MS 3
#define WDTO_250MS 4
#define WDTO_500MS 5
#define WDTO_1S 6
#define WDTO_2S 7
#define WDTO_4S 8
#define WDTO_8S 9
#define wdt_reset() __asm__ __volatile__("wdr")
#define wdt_enable(value) ((void)(unsigned char)(value))
#define wdt_disable() ((void)0)
