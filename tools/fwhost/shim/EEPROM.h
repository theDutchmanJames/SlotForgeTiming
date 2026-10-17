#pragma once
#include <string.h>
extern unsigned char sim_eeprom[1024];
struct EEPROMT { template <class T> void get(int a, T &t) { memcpy(&t, sim_eeprom + a, sizeof(T)); } template <class T> void put(int a, const T &t) { memcpy(sim_eeprom + a, &t, sizeof(T)); } };
extern EEPROMT EEPROM;
