# Service Stop

## Setup

Enable Service Stop in a Race Setup to use a fixed stop timer. Off retains the normal sensor-controlled pit behaviour and race-system timers. Service Stop works in practice, qualifying, heats and endurance. Time Token Sessions do not offer pits.

- **Pit entry: sensor confirmation time** confirms arrival before the service countdown starts.
- **Fixed service time:** 30 seconds by default, from 1 to 86,400 seconds. This time is the same for every lane.
- **Timer ends pit stop:** release automatically at the deadline.
- **Race Director ends pit stop:** wait for the director's Release car action.
- **Driver ends pit stop:** remove the car, return it to the sensor, then drive off to end the stop regardless of the remaining timer. Requires hardware that reports sensor presence; button-only pits use director release.
- **Fuel, tyres and repairs:** retain each system's sequencing, run together, or run one after another.

## Actual service work

Work keeps its normal duration; it is not stretched or compressed to fit the timer. For example, 15 seconds of refuelling followed by a two-second tyre change takes 17 seconds. A 30-second automatic stop still holds the car for the remaining 13 seconds.

Early release retains fuel already added and completed work. An unfinished tyre change or repair leaves that item unchanged. Unserved penalties remain outstanding. Tyre availability, mandatory-stop counting, driver swaps, weather choices and retirement/disqualification rules continue to apply.

Stop-and-Go penalties add their standing time to automatic release. Drivethroughs add no standing time. Existing penalty points and result-time adjustments retain their normal rules.

## Release and sensors

The Race Director can release a car in any mode, including before work or the timer has finished. Random Flag pit-exit holds must clear first. In driver mode, removing or returning the car alone does not release it: departure after the return is required. Raw sensor monitoring continues during service, while lap counting suppresses the service movements.

After release, a covered sensor must clear before it rearms. Unknown or disconnected sensor state cannot establish a driver departure. Use director release when the hardware cannot report presence.

The Race and authenticated Race Director pages expose the same release controls. Recorded pit duration includes the entry-confirmation period. Timer-based release uses its actual deadline, so a delayed UI update does not add extra standing time to one lane.

## Pause and recovery

Pauses and red flags freeze race time and the service countdown. Saved recovery state preserves remaining service and penalty time; sensor-driven release requires fresh sensor evidence. Ending a race closes each pit once.

Software regressions cover release modes, interrupted work, pauses, penalties, recovery, sensor transitions and delayed updates. Physical hardware timing accuracy still requires testing on the track.
