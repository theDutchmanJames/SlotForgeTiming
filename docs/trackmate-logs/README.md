# Trackmate logs with a car held on the sensor

Two logs made with the Trackmate Interface on 19 October 2026 (Windows and Linux), saved from the monitor of Timing hardware. In both, a normal crossing was made first, then a car (a hand) was held on a lane sensor
for a few seconds, as a pit stop.

What they show: while a sensor is covered the Trackmate sends the same letter again and again, about every 256 ms (a tick of 200 ms, then a tick of 56 ms and the letter). It stops when the car is gone.
`tests/trackmate.test.js` plays both logs through the link: the first letter is the lap, a sensor that stays covered for the pit hold time is a car in the pits (`block`), and the end of the letters is the car leaving (`free`).

Each line: seconds since connecting, `<-` for data from the device and `->` for commands to it, the bytes in hex, a short explanation and the bytes as text.
