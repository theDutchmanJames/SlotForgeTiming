#pragma once
struct EEPROMT { template <class T> void get(int, T&) {} template <class T> void put(int, const T&) {} };
static EEPROMT EEPROM;
