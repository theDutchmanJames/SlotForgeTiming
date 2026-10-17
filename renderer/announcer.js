// Works out WHAT to announce during a race. Pure: observe() is given the race now and returns the calls that just happened
// (new leader, fastest lap, flags...), each with the values its sentences can use ({driver}, {time}...). Nothing here plays sound.
(function (root) {
  const WxT = typeof module !== 'undefined' ? require('./weather.js') : root.Wx; // the names of the tyres
  const EnT = typeof module !== 'undefined' ? require('./endurance.js') : root.Endurance; // the Endurance Race (words for the swaps)
  // The calls of the first audio version. vars: the placeholders a line of that call can use. lines: the default sentences.
  const CALLS = [
    { id: 'prerace', group: 'Start', label: 'Before the start: said when Start is pressed (the start lights wait until it is finished)', vars: ['heat', 'heats', 'final', 'track'], lines: ['Drivers, get ready. The race is about to start!'] },
    { id: 'countdown5', group: 'Start', label: 'Light 1 comes on: 5', vars: [], lines: ['5'] },
    { id: 'countdown4', group: 'Start', label: 'Light 2 comes on: 4', vars: [], lines: ['4'] },
    { id: 'countdown3', group: 'Start', label: 'Light 3 comes on: 3', vars: [], lines: ['3'] },
    { id: 'countdown2', group: 'Start', label: 'Light 4 comes on: 2', vars: [], lines: ['2'] },
    { id: 'countdown1', group: 'Start', label: 'Light 5 comes on: 1', vars: [], lines: ['1'] },
    { id: 'lightsout', group: 'Start', label: 'Lights out, the race starts', vars: ['heat', 'heats', 'final'], lines: ['Go go go!', 'Lights out and away we go', 'Green light, race!'] },
    { id: 'newleader', group: 'Positions', label: 'A new leader', vars: ['driver', 'other'], lines: ['{driver} takes the lead', '{driver} is the new leader', 'New leader: {driver}'] },
    { id: 'overtake', group: 'Positions', label: 'A driver moves up a place', vars: ['driver', 'other', 'position'], lines: ['{driver} passes {other} for position {position}', '{driver} overtakes {other}'] },
    // Race progress: how far the race is, and the heats. Said by the race itself, not about one driver.
    { id: 'lapstogo', group: 'Race progress', label: 'Laps to go in a race by laps (you choose how many)', vars: ['driver', 'left', 'laps'], lines: ['{left} to go, {driver} leads', '{left} to go'] },
    { id: 'timetogo', group: 'Race progress', label: 'Minutes to go in a timed race or a qualifying (you choose how many)', vars: ['driver', 'left'], lines: ['{left} to go, {driver} leads', '{left} left'] },
    { id: 'distance', group: 'Race progress', label: 'Race distance reached (you choose the distances)', vars: ['percent', 'driver', 'left', 'laps'], lines: ['{percent} percent of the race done, {driver} leads', '{percent} percent distance, {left} to go'] },
    { id: 'lastlap', group: 'Race progress', label: 'The leader starts the last lap', vars: ['driver', 'laps'], lines: ['Last lap! {driver} leads', 'Final lap', 'Last lap, {driver} is in front'] },
    { id: 'lastlapother', group: 'Race progress', defaultOn: false, label: 'Another driver starts the last lap (not the leader)', vars: ['driver', 'laps'], lines: ['{driver} starts the last lap', '{driver} is on the last lap'] },
    { id: 'nextheat', group: 'Race progress', label: 'The next heat is ready (a heat-based race)', vars: ['heat', 'heats'], lines: ['Next up: heat {heat} of {heats}', 'Heat {heat} is ready'] },
    { id: 'nextfinal', group: 'Race progress', label: 'The next final is ready (a heat-based race with finals)', vars: ['final'], lines: ['Next up: final {final}', 'Final {final} is ready'] },
    { id: 'lineup', group: 'Race progress', defaultOn: false, label: 'The line-up of the next heat or final is read (said after the call that the next heat is ready)', vars: ['heat', 'heats', 'final', 'lineup'], lines: ['{lineup}', 'On the grid: {lineup}'] },
    { id: 'heatend', group: 'Race progress', label: 'A heat is finished (said instead of the finished call, except after the last heat)', vars: ['heat', 'heats'], lines: ['Heat {heat} of {heats} is finished', 'End of heat {heat}'] },
    { id: 'finalend', group: 'Race progress', label: 'A final is finished (said instead of the finished call, except after the last final)', vars: ['final'], lines: ['Final {final} is finished', 'End of final {final}'] },
    // Gaps and battles: worked out from the times of the laps, said when a lap is completed
    { id: 'closing', group: 'Gaps and battles', defaultOn: false, label: 'A driver closes in on the car in front (you choose how close)', vars: ['driver', 'other', 'gap', 'position'], lines: ['{driver} is {gap} behind {other}', '{driver} is closing in on {other}'] },
    { id: 'battle', group: 'Gaps and battles', defaultOn: false, label: 'A battle for a place: two drivers stay close for several laps', vars: ['driver', 'other', 'gap', 'position'], lines: ['A battle for {position} place between {driver} and {other}', '{driver} is right behind {other}, who will give way?'] },
    { id: 'lapped', group: 'Gaps and battles', defaultOn: false, label: 'A driver is lapped by the leader', vars: ['driver', 'other', 'lapsdown'], lines: ['{driver} is lapped by {other}', '{driver} goes a lap down'] },
    { id: 'fastestlap', group: 'Laps and records', label: 'Fastest lap of the race', vars: ['driver', 'time', 'lap', 'improved', 'record'], lines: ['Fastest lap of the race for {driver}, {time}', '{driver} sets the fastest lap, {time}'] },
    { id: 'trackrecord', group: 'Laps and records', label: 'New track record', vars: ['driver', 'time', 'lap', 'improved', 'record'], lines: ['New track record! {driver}, {time}', 'Track record for {driver}, {time}'] },
    { id: 'personalbest', group: 'Laps and records', label: 'Personal best', vars: ['driver', 'time', 'lap', 'improved', 'record'], lines: ['Personal best for {driver}, {time}', '{driver} improves their best lap, {time}'] },
    { id: 'firstlap', group: 'Laps and records', defaultOn: false, label: 'A driver completes the first lap', vars: ['driver', 'time', 'lap'], lines: ['{driver} completes the first lap, {time}', 'First lap done for {driver}, {time}'] },
    { id: 'nearrecord', group: 'Laps and records', defaultOn: false, label: 'A lap close to the track record (you choose how close)', vars: ['driver', 'time', 'lap', 'record', 'off'], lines: ['{driver} is {off} off the track record', 'Just {off} short of the record for {driver}'] },
    { id: 'pitin', group: 'Pit and fuel', label: 'A car stops in the pits', vars: ['driver'], lines: ['{driver} is in the pits', '{driver} pits'] },
    { id: 'pitout', group: 'Pit and fuel', label: 'A car leaves the pits', vars: ['driver', 'pit', 'fuel'], lines: ['{driver} is back on track', '{driver} leaves the pits'] },
    { id: 'fuelhalf', group: 'Pit and fuel', defaultOn: false, label: 'A car has used half of its fuel', vars: ['driver', 'fuel'], lines: ['{driver} is at half tank', '{driver} has half a tank left'] },
    { id: 'fuellow', group: 'Pit and fuel', label: 'A car is low on fuel', vars: ['driver', 'fuel'], lines: ['{driver} is low on fuel', '{driver}, fuel is getting low'] },
    { id: 'outoffuel', group: 'Pit and fuel', label: 'A car is out of fuel', vars: ['driver'], lines: ['{driver} is out of fuel', '{driver} has run dry'] },
    { id: 'refuelled', group: 'Pit and fuel', defaultOn: false, label: 'A car has refuelled (said when the pit stop is over)', vars: ['driver', 'refuelled', 'fuel', 'pit'], lines: ['{driver} has refuelled, {refuelled} litres', '{driver} takes on {refuelled} litres'] },
    { id: 'bopon', group: 'Balance of Power', label: 'Balance of Power is applied to a car (hindered or helped)', vars: ['driver', 'bop', 'effect'], lines: ['Balance of Power for {driver}', '{driver} has Balance of Power'] },
    { id: 'bopoff', group: 'Balance of Power', label: 'Balance of Power is taken off a car', vars: ['driver'], lines: ['Balance of Power for {driver} removed!', '{driver}, Balance of Power removed'] },
    { id: 'swapsoon', group: 'Endurance', defaultOn: false, label: 'A driver swap is coming up (said at the warning of the race setup)', vars: ['driver', 'nextdriver', 'swapin'], lines: ['{team}, a driver swap is coming up', '{team}, get ready to swap with {nextdriver}'] },
    { id: 'swapdue', group: 'Endurance', label: 'A team has to swap drivers (the swap is due)', vars: ['driver', 'nextdriver'], lines: ['{team} needs to swap positions! Box Box!', 'Box box, {team}! Time to change drivers', '{team}, swap drivers now'] },
    { id: 'swapdone', group: 'Endurance', label: 'A swap is made: the driver who came in ({driver}) and the driver who took over ({nextdriver})', vars: ['driver', 'nextdriver'], lines: ['{driver} has come in, {nextdriver} takes over for {team}', '{nextdriver} steps in for {driver}', 'New driver for {team}: {nextdriver} replaces {driver}'] },
    { id: 'swaplate', group: 'Endurance', label: 'A team has not swapped within the grace time', vars: ['driver', 'nextdriver'], lines: ['{team} has not swapped yet! Come in now', '{team}, you must swap drivers'] },
    { id: 'swappenalty', group: 'Endurance', label: 'A team gets penalty points for not swapping (said instead of the call above)', vars: ['driver', 'nextdriver', 'points'], lines: ['Penalty for {team}, the swap was not made', '{team} is penalised for not swapping'] },
    { id: 'damagehit', group: 'Damage', defaultOn: false, label: 'A car gets damage points (a hit or a deslot)', vars: ['driver', 'damage', 'level'], lines: ['{driver} has damage, {damage} points', '{driver} takes a hit'] },
    { id: 'damagelevel', group: 'Damage', label: 'A car reaches a level of damage that asks for a repair in the pits', vars: ['driver', 'damage', 'level', 'repair', 'when'], lines: ['{driver}, {level}! Pit {when}', '{driver} has {level}, come in {when} for {repair}'] },
    { id: 'damagecritical', group: 'Damage', label: 'A car reaches a level of damage that ends its race (the car is retired or disqualified when it stops in the pits)', vars: ['driver', 'damage', 'level', 'when'], lines: ['{driver}, {level}! Come into the pits, your car is finished', '{driver}, the car is too damaged, box box'] },
    { id: 'damagelate', group: 'Damage', label: 'A car is late for the pits with its damage (also when it gets penalty points for it)', vars: ['driver', 'damage', 'level', 'points'], lines: ['{driver}, come in for the repair now', '{driver} is late for the pits, {level}'] },
    { id: 'repairearly', group: 'Damage', label: 'A car leaves the pits before the repair is done (the damage stays)', vars: ['driver', 'damage', 'level', 'repair', 'points'], lines: ['{driver} left too early, the damage is not repaired', '{driver}, you left before the repair was done'] },
    { id: 'repaired', group: 'Damage', label: 'A car is repaired (said when the repair is done)', vars: ['driver', 'level', 'repair'], lines: ['{driver} is repaired', '{driver}, the damage is repaired, you can go'] },
    { id: 'damageout', group: 'Damage', label: 'A car is retired because of its damage', vars: ['driver', 'damage', 'level'], lines: ['{driver} is out with damage', '{driver} retires, the car is too damaged'] },
    { id: 'damagedq', group: 'Damage', label: 'A car is disqualified because of its damage', vars: ['driver', 'damage', 'level'], lines: ['{driver} is disqualified, the car is too damaged', 'Disqualified for damage: {driver}'] },
    { id: 'weathercloudy', group: 'Weather', label: 'The sky clouds over (the weather becomes Cloudy: rain is coming)', vars: ['weather', 'tracktemp', 'airtemp', 'windspeed', 'winddir'], lines: ['It is getting cloudy, rain is on its way', 'Clouds are building up'] },
    { id: 'weatherwet', group: 'Weather', label: 'It starts to rain (the weather becomes Wet)', vars: ['weather', 'tracktemp', 'airtemp', 'windspeed', 'winddir'], lines: ['It is raining! Wet tyres', 'The rain has started'] },
    { id: 'weatherclearing', group: 'Weather', label: 'The rain has stopped and the track is drying (Clearing)', vars: ['weather', 'tracktemp', 'airtemp', 'windspeed', 'winddir'], lines: ['The rain has stopped, the track is drying', 'The skies are clearing'] },
    { id: 'weatherdry', group: 'Weather', label: 'The track is dry again', vars: ['weather', 'tracktemp', 'airtemp', 'windspeed', 'winddir'], lines: ['The track is dry again', 'Dry weather, back to normal tyres'] },
    { id: 'weatherconditions', group: 'Weather', label: 'The conditions on the track (said at lights out, and after every change of the weather)', vars: ['weather', 'tracktemp', 'airtemp', 'windspeed', 'winddir'], lines: ['Track temperature {tracktemp}, air temperature {airtemp}, wind {windspeed} from the {winddir}', 'Conditions: track {tracktemp}, air {airtemp}, wind {windspeed}, {winddir}'] },
    { id: 'tyrechange', group: 'Weather', label: 'A car has new tyres (said when the pit stop starts)', vars: ['driver', 'tyre', 'weather'], lines: ['{driver} is on {tyre} tyres', '{driver} changes to {tyre} tyres'] },
    { id: 'wrongtyres', group: 'Weather', label: 'A car did not change tyres in time (when there are no penalty points for it)', vars: ['driver', 'tyre', 'weather'], lines: ['{driver} is on the wrong tyres', '{driver} stays out on {tyre} tyres'] },
    { id: 'tyrepenalty', group: 'Weather', label: 'A car gets penalty points for the wrong tyres (said instead of the penalty call)', vars: ['driver', 'points', 'tyre', 'weather'], lines: ['Penalty for {driver}, wrong tyres', '{driver} is penalised for the tyres'] },
    { id: 'penalty', group: 'Penalties', label: 'Penalty points given', vars: ['driver', 'points'], lines: ['Penalty for {driver}', '{driver} gets a penalty'] },
    { id: 'specialpenalty', group: 'Penalties', label: 'A special penalty (drivethrough, stop and go...)', vars: ['driver', 'penalty'], lines: ['{driver}, {penalty}', '{penalty} for {driver}'] },
    { id: 'penaltyserved', group: 'Penalties', defaultOn: false, label: 'A special penalty has been served', vars: ['driver', 'penalty'], lines: ['{driver} has served the {penalty}', '{penalty} served by {driver}'] },
    { id: 'penaltyforgiven', group: 'Penalties', defaultOn: false, label: 'A special penalty is forgiven (by the Race Director, also in the review after the race)', vars: ['driver', 'penalty'], lines: ['The {penalty} for {driver} is forgiven', '{driver} is let off the {penalty}'] },
    { id: 'penaltytime', group: 'Penalties', defaultOn: false, label: 'Time is added to a driver (by the Race Director, also in the review after the race)', vars: ['driver', 'added'], lines: ['{added} added to the time of {driver}', '{driver} gets a time penalty of {added}'] },
    { id: 'disqualified', group: 'Penalties', label: 'A driver is disqualified', vars: ['driver'], lines: ['{driver} is disqualified', 'Disqualified: {driver}'] },
    { id: 'yellowflag', group: 'Flags', label: 'Yellow flag', vars: [], lines: ['Yellow flag, take care', 'Yellow flag'] },
    { id: 'yellowtarget', group: 'Flags', label: 'The yellow flag target lap time (said after the yellow flag call, when the race has a target)', vars: ['target'], lines: ['Target lap time is {target}', 'Yellow flags, target lap time is {target}'] },
    { id: 'yellowfast', group: 'Flags', label: 'A driver is faster than the yellow flag target (a full lap under yellow)', vars: ['driver', 'time', 'lap', 'target'], lines: ['{driver}, too fast under yellow', '{driver}, slow down, the yellow flag is up'] },
    { id: 'redflag', group: 'Flags', label: 'Red flag', vars: [], lines: ['Red flag, the race is stopped', 'Red flag'] },
    { id: 'greenflag', group: 'Flags', label: 'Green flag (the yellow or red flag is over)', vars: [], lines: ['Green flag, racing again', 'Back to green'] },
    { id: 'lanecall', group: 'Safety', defaultOn: false, label: 'A lane calls for the marshal (the Call button)', vars: ['driver', 'lane'], lines: ['{driver} calls for the marshal', 'Marshal call from lane {lane}'] },
    { id: 'nolap', group: 'Safety', defaultOn: false, label: 'A car has not completed a lap for a while (you choose how long)', vars: ['driver', 'lane', 'seconds'], lines: ['No lap from {driver} for {seconds} seconds', 'Is {driver} stuck? Lane {lane}'] },
    { id: 'trackmatelost', group: 'Safety', defaultOn: false, label: 'The Trackmate connection is lost (during a race)', vars: [], lines: ['Trackmate connection lost', 'Lost contact with the Trackmate'] },
    { id: 'trackmateback', group: 'Safety', defaultOn: false, label: 'The Trackmate is connected again (during a race)', vars: [], lines: ['Trackmate is back', 'Trackmate connected again'] },
    { id: 'finished', group: 'Finish', label: 'The race is finished', vars: ['heat', 'heats', 'final'], lines: ['The race is finished', 'Chequered flag'] },
    { id: 'podium', group: 'Finish', label: 'Second and third place', vars: ['driver', 'position', 'laps'], lines: ['{driver} finishes {position}', 'In {position} place, {driver}'] },
    { id: 'winner', group: 'Finish', label: 'The winner', vars: ['driver', 'name', 'nickname', 'callsign', 'laps'], lines: ['{driver} wins the race!', 'Victory for {driver}'] },
    { id: 'tokenwarning', group: 'Time tokens', label: 'A lane\'s paid time is almost up (a Time Token Session)', vars: ['driver', 'lane', 'seconds'], lines: ['Lane {lane}, your time is almost up', '{driver}, your time is almost up'] },
    { id: 'tokenout', group: 'Time tokens', label: 'A lane\'s paid time is up (a Time Token Session)', vars: ['driver', 'lane'], lines: ['Time is up on lane {lane}', '{driver}, your time is up. Please stop driving'] },
    { id: 'tokenadded', group: 'Time tokens', defaultOn: false, label: 'Time is added to a lane (a Time Token Session)', vars: ['driver', 'lane', 'added', 'seconds'], lines: ['{added} added to lane {lane}', 'Lane {lane} has {added} more'] },
    { id: 'tokenfree', group: 'Time tokens', defaultOn: false, label: 'A lane is freed (a Time Token Session)', vars: ['driver', 'lane'], lines: ['Lane {lane} is free', 'Lane {lane} is free for the next driver'] }
  ];
  // the values a placeholder can have, in the order they are shown to the user
  const VARS = { driver: 'The driver, as the set says (name, nickname or callsign)', name: 'The driver\'s name', nickname: 'The driver\'s nickname', callsign: 'The driver\'s callsign', team: 'The name of the team of the car (empty when the car races without a team)',
    other: 'The other driver involved (the one who was passed, or the leader before)', time: 'The lap time, as spoken', position: 'The position, as a word', lap: 'The lap number the time was set in',
    laps: 'The number of laps of the race (the laps driven so far when there is no lap limit)', percent: 'The race distance reached, in percent', left: 'What is left of the race: laps or minutes',
    lane: 'The number of the lane', seconds: 'The seconds of paid time that are left (in the time-added call: the seconds that were added; in the no-lap call: how long)',
    fuel: 'Litres of fuel left (empty when the race has no fuel)', points: 'The driver\'s penalty points (in the penalty call: the points just given)', penalty: 'The name of the special penalty',
    gap: 'The gap to the car in front, as spoken (0.8 seconds)', lapsdown: 'How many laps a lapped driver is behind (1 lap)', heat: 'The number of the heat (empty when it is not a heat-based race, and in a final)', heats: 'The number of heats of the race (empty in a final)', final: 'The letter of the final, A or B (empty when it is not a final)', lineup: 'The drivers of the next heat or final with their lanes (Alex in lane 1, Sam in lane 2 and Kim in lane 3)',
    nextdriver: 'The driver who steps in at the next swap, as the set says (name, nickname or callsign; in the swap call: the driver who took over, and the driver is then the one who came in)', swapin: 'How long before the swap the warning is said, as spoken (1 minute, 2 laps)',
    car: 'The driver\'s slot car', best: 'The driver\'s best lap of this race, as spoken', track: 'The name of the track',
    target: 'The yellow flag target lap time, as spoken (7.5 seconds)',
    gapahead: 'The gap to the car in front right now, as spoken (empty for the leader)', record: 'The track record, as spoken (empty when the track has none; in the track record call: the old record)',
    improved: 'How much better the lap was than the best before it (0.12 seconds)', off: 'How far a lap was from the track record (0.04 seconds)',
    pit: 'How long the pit stop took, as spoken (7.4 seconds)', refuelled: 'Litres of fuel put in during the pit stop', added: 'The time that was added, as spoken (5 minutes, 30 seconds)',
    bop: 'The Balance of Power percentage the car got, as a number (20)', effect: 'What Balance of Power does to the car: hindered or helped',
    tyre: 'The tyres of the car, as a word (Wet, Soft, Intermediate...)', weather: 'The weather now: dry, cloudy, wet or clearing',
    damage: 'The damage points the car has now', level: 'The name of the damage level of the car (Light damage, Heavy damage...)', repair: 'How long the repair takes, as spoken (10 seconds; empty when the level has no time)', when: 'How soon the driver should pit: whenever you can, or as fast as you can',
    tracktemp: 'The track temperature in the weather, as spoken (24 degrees)', airtemp: 'The air temperature, as spoken (20 degrees)', windspeed: 'The wind speed, as spoken (16 kilometres per hour)', winddir: 'Where the wind comes from, as spoken (south west)' };
  const SAMPLE = { nextdriver: 'Sam', swapin: '1 minute', target: '15 seconds', team: 'Red Racers', driver: 'Alex', name: 'Alex', nickname: 'Speedy', callsign: 'ALX', other: 'Sam', time: '5.12', position: 'second', percent: '50', left: '5 laps', fuel: '12', lane: '2', seconds: '60', points: '2', penalty: 'drivethrough', lap: '4', laps: '10', gap: '0.8 seconds', lapsdown: '1 lap', heat: '2', heats: '3', final: 'A', lineup: 'Alex in lane 1, Sam in lane 2 and Kim in lane 3', car: 'Porsche 956', best: '5.10', track: 'Living room', gapahead: '0.8 seconds', record: '5.01', improved: '0.12 seconds', off: '0.04 seconds', pit: '7.4 seconds', refuelled: '8', added: '5 minutes', bop: '20', effect: 'hindered', tyre: 'Wet', weather: 'wet', damage: '6', level: 'Medium damage', repair: '15 seconds', when: 'whenever you can', tracktemp: '17 degrees', airtemp: '15 degrees', windspeed: '22 kilometres per hour', winddir: 'west' };
  const condVars = (eng, state) => (eng.weather ? WxT.condSpeech(WxT.conditionsFor(eng.weather, state || 'dry', null, '')) : {}); // the conditions of a weather state of this race, as spoken
  const WEATHER_CALL = { cloudy: 'weathercloudy', wet: 'weatherwet', clearing: 'weatherclearing', dry: 'weatherdry' }; // the call for each state the weather becomes
  const ORD = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
  const ordinal = n => ORD[n] || `${n}th`;
  // a lap time as it is spoken: 5.12 (two decimals), or 1 minute 5.12
  function speakTime(ms) {
    if (!Number.isFinite(ms)) return '';
    const s = ms / 1000; if (s < 60) return s.toFixed(2);
    const m = Math.floor(s / 60);
    return `${m} minute${m === 1 ? '' : 's'} ${(s - m * 60).toFixed(2)}`;
  }
  // a gap as it is spoken: 0.8 seconds, 1 second, 12 seconds
  function speakGap(ms) {
    if (!Number.isFinite(ms)) return '';
    const s = ms / 1000; if (s >= 9.95) return `${Math.round(s)} seconds`;
    const t = Math.round(s * 10) / 10; return t === 1 ? '1 second' : Number.isInteger(t) ? `${t} seconds` : `${t.toFixed(1)} seconds`;
  }
  // which conditions the sentences of a call can have: the driver the call is about, his position, the lap time (calls that say a time), the gap to the car in front
  const conditionsOf = call => {
    const v = (call && call.vars) || [], driver = v.includes('driver'), tokens = !!call && call.group === 'Time tokens'; // (a Time Token Session has no positions or gaps)
    return { driver, top: driver && !tokens, time: v.includes('time'), gap: driver && !tokens };
  };
  const lapsText = n => `${n} lap${n === 1 ? '' : 's'}`;
  // a small difference as it is spoken: 0.12 seconds, 1 second (two decimals, because lap times are)
  function speakDiff(ms) {
    if (!Number.isFinite(ms)) return '';
    const s = Math.abs(ms) / 1000; if (s >= 60) return speakTime(Math.abs(ms));
    const t = s.toFixed(2); return t === '1.00' ? '1 second' : `${t} seconds`;
  }
  // a stretch of time as it is spoken, in whole seconds: 30 seconds, 5 minutes, 1 minute 30 seconds
  function speakSpan(ms) {
    const t = Math.round(Number(ms) / 1000); if (!(t > 0)) return '';
    const m = Math.floor(t / 60), sec = t % 60;
    return [m ? `${m} minute${m === 1 ? '' : 's'}` : '', sec ? `${sec} second${sec === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
  }
  // a target lap time as it is spoken, without useless zeros: 15 seconds, 7.5 seconds, 1 minute 30 seconds
  function speakTarget(ms) {
    if (!(Number(ms) > 0)) return '';
    const s = ms / 1000; if (s >= 60 && Number.isInteger(s)) return speakSpan(ms);
    const t = String(Number(s.toFixed(3)));
    return `${t} second${t === '1' ? '' : 's'}`;
  }
  // the variables that every call about a driver has, and the ones every call has (the table in the audio editor says so)
  const EVERY_DRIVER = ['driver', 'name', 'nickname', 'callsign', 'team', 'car', 'best', 'lane', 'points', 'fuel', 'gapahead'], EVERY_CALL = ['track', 'record'];
  // a line with its placeholders filled in; an unknown placeholder is left out
  const fill = (text, vars) => String(text ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : '')).replace(/\s+/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();

  // o: { driverBy: 'name' | 'nickname' | 'callsign', lapLimit: laps of a race by laps (0 = none), base: { personal: Map(driverId -> ms), track: ms },
  //      distances: [percent], lapsToGo: [laps left] (2 or more), minutesToGo: [minutes left], closeGap: seconds, battleLaps: laps, nearRecord: seconds (0 = no calls),
  //      noLapSeconds: seconds (0 = no calls), trackName }
  function create(o = {}) {
    const whole = (v, lo) => (Array.isArray(v) ? v : []).map(Number).filter(n => Number.isInteger(n) && n >= lo).sort((a, b) => a - b);
    const lapsToGo = whole(o.lapsToGo, 2), minutesToGo = whole(o.minutesToGo, 1), trackName = String(o.trackName || '');
    const nearRecord = Number(o.nearRecord) > 0 ? Math.min(5, Number(o.nearRecord)) : 0, noLap = Number(o.noLapSeconds) > 0 ? Math.min(600, Number(o.noLapSeconds)) : 0;
    const closeGap = Number(o.closeGap) > 0 ? Math.min(30, Number(o.closeGap)) : 0, battleLaps = Math.max(2, Math.min(20, Math.floor(Number(o.battleLaps)) || 3));
    const dists = (Array.isArray(o.distances) ? o.distances : [50]).map(Number).filter(n => n > 0 && n < 100).sort((a, b) => a - b), by = ['name', 'nickname', 'callsign'].includes(o.driverBy) ? o.driverBy : 'name', lapLimit = Number(o.lapLimit) || 0;
    const limitFor = (eng, c) => (eng && eng.distance && eng.limitOf ? eng.limitOf(c) : lapLimit); // the laps this car has to drive: in a Distance Race the laps of its lane, else the laps of the race (0: none)
    const base = o.base || {}, best = { all: Infinity, by: new Map(), personal: new Map(base.personal || []), track: Number.isFinite(base.track) ? base.track : Infinity };
    const S = { phase: null, flag: '', leader: null, laps: [], pos: [], lastLapDone: false, distDone: [], ev: -1, low: [], finished: false, ready: false, togoDone: [], minDone: [], lastOther: [], lastCar: -1, down: [], near: [], half: [], stuck: [], tm: undefined };
    // the race that is looked at now (for the words every driver call has: the fuel and the gap to the car in front)
    const cur = { eng: null, info: null, st: null };
    const gapMs = c => { // the gap to the car in front right now, in ms (null: nobody in front, or not known)
      const e = cur.eng, i = e ? e.cars.indexOf(c) : -1; if (i < 0 || typeof e.gapInfo !== 'function') return null;
      if (!cur.info) cur.info = e.gapInfo() || [];
      const g = cur.info[i]; return g && g.ahead !== null && g.ahead !== undefined ? g.ahead : null;
    };
    const gapAhead = c => { const m = gapMs(c); return m === null ? '' : speakGap(m); };
    const placeOf = c => { // the position of a car in the race right now (1 = leader), null when not known
      const e = cur.eng; if (!e || typeof e.standings !== 'function') return null;
      if (!cur.st) cur.st = e.standings() || [];
      const i = cur.st.findIndex(x => x.car === c); return i < 0 ? null : i + 1;
    };
    // what a sentence's conditions are checked against: the driver, his position, the lap time and the gap to the car in front (the words of the sentence do not carry them)
    const factsOf = (c, time) => ({ driverId: c && c.driverId !== undefined && c.driverId !== null ? c.driverId : '', place: c ? placeOf(c) : null, time: Number.isFinite(time) ? time : null, gap: c ? gapMs(c) : null });
    const who = c => { const name = c.driverName || '', nick = c.nickname || name, call = c.callsign || name; return { driver: by === 'nickname' ? nick : by === 'callsign' ? call : name, name, nickname: nick, callsign: call, team: c.teamName || '', car: c.carName || '', best: Number.isFinite(c.best) ? speakTime(c.best) : '',
      lane: Number.isInteger(c.lane) ? c.lane + 1 : '', points: c.points || 0, fuel: cur.eng && cur.eng.fuel && cur.eng.fuel.on && Number.isFinite(c.fuel) ? Math.round(c.fuel) : '', gapahead: gapAhead(c), _c: c }; };

    // a driver of the roster of a team (Endurance Race), spoken as the set says
    const rosterWho = (c, id) => { const r = (c.roster || []).find(x => x.id === id); if (!r) return { name: '', nickname: '', callsign: '', spoken: '' }; const name = r.name || '', nick = r.nickname || name, call = r.callsign || name; return { name, nickname: nick, callsign: call, spoken: by === 'nickname' ? nick : by === 'callsign' ? call : name }; };

    // eng: the race engine; ctx: { phase: 'ready' | 'countdown' | 'running' | 'paused' | 'review' | 'finished'..., lights }
    function observe(eng, ctx = {}) {
      // every call can say the track, and in a heat-based race the heat (the number of the heat that is racing, or is next while the race waits between two heats)
      const hv = ctx.heat && ctx.heat.count > 0 ? (ctx.heat.final ? { heat: '', heats: '', final: ctx.heat.final } : { heat: ctx.heat.idx + 1, heats: ctx.heat.count, final: '' }) : { heat: '', heats: '', final: '' }; // (a final has no heat number)
      cur.eng = eng; cur.info = null; cur.st = null;
      const out = [], cars = eng.cars, ev = (call, vars) => {
        const { _c, _time, ...words } = vars || {};
        out.push({ call, vars: { track: trackName, record: Number.isFinite(best.track) ? speakTime(best.track) : '', ...hv, ...words }, facts: factsOf(_c, _time) });
      };
      const phase = ctx.phase;
      if (phase !== S.phase) {
        if (phase === 'running' && S.phase === 'countdown') { ev('lightsout', {}); if (eng.weather && S.condFor !== eng) { S.condFor = eng; ev('weatherconditions', { weather: eng.wxState || 'dry', ...condVars(eng, eng.wxState) }); } } // (the conditions are said once in a race, not again after a restart)
        if (phase === 'between' && ctx.heat) {
          ev(ctx.heat.final ? 'nextfinal' : 'nextheat', {});
          const grid = Array.isArray(ctx.lineup) ? ctx.lineup : [];
          if (grid.length) { // the drivers of the heat that is next, each with the lane (named as the audio set says: name, nickname or callsign)
            const parts = grid.map(g => `${by === 'nickname' ? g.nickname || g.name : by === 'callsign' ? g.callsign || g.name : g.name}${Number.isInteger(g.lane) && g.lane >= 0 ? ' in lane ' + (g.lane + 1) : ''}`);
            ev('lineup', { lineup: parts.length < 2 ? parts.join('') : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] });
          }
        }
        S.phase = phase; S.lights = 0;
      }
      if (phase === 'countdown') { // each new light says its number: 5, 4, 3, 2, 1
        const n = Number(ctx.lights) || 0;
        if (n > S.lights && n >= 1 && n <= 5) ev('countdown' + (6 - n), {});
        S.lights = n;
      }
      if (!S.laps.length) { S.laps = cars.map(c => c.laps.length); S.pos = cars.map((_, i) => i); }
      // the Trackmate connection (the race screen tells us; only a drop or a return during a race is said, not the first connection before the start)
      if (typeof ctx.trackmate === 'boolean') {
        if (S.tm !== undefined && S.tm !== ctx.trackmate && (phase === 'countdown' || phase === 'running' || phase === 'paused')) ev(ctx.trackmate ? 'trackmateback' : 'trackmatelost', {});
        S.tm = ctx.trackmate;
      }
      // flags
      const flag = eng.flag || '';
      if (flag !== S.flag) {
        if (flag === 'yellow') { ev('yellowflag', {}); if (eng.yellow && eng.yellow.target > 0) ev('yellowtarget', { target: speakTarget(eng.yellow.target) }); } else if (flag === 'red') ev('redflag', {}); else if (S.flag) ev('greenflag', {});
        S.flag = flag;
      }
      // things the engine logged: pits, fuel, penalties (only while racing; later review changes are not announced)
      if (S.ev < 0) S.ev = eng.events.length;
      const live = phase === 'running' || phase === 'paused';
      for (; S.ev < eng.events.length; S.ev++) {
        const e = eng.events[S.ev], c = cars[e.car];
        if (e.type === 'weather') { if (live && e.was && WEATHER_CALL[e.state]) { ev(WEATHER_CALL[e.state], { weather: e.state, ...condVars(eng, e.state) }); ev('weatherconditions', { weather: e.state, ...condVars(eng, e.state) }); } continue; } // (a race-wide event: no car; the weather the race starts with is not said)
        if (!c) continue;
        // the Race Director's decisions are also said in the review after the race (they change the result); everything else only while racing
        if (!live && !(phase === 'review' && (e.type === 'forgiven' || e.type === 'timeadded'))) continue;
        const pen = String(e.name || 'penalty').toLowerCase();
        if (e.type === 'pitstart') ev('pitin', who(c));
        else if (e.type === 'pitend') {
          if (e.refuelled > 0) ev('refuelled', { ...who(c), refuelled: Math.round(e.refuelled * 10) / 10, pit: speakGap(e.duration) });
          ev('pitout', { ...who(c), pit: speakGap(e.duration) });
        }
        else if (e.type === 'yellowfast') ev('yellowfast', { ...who(c), time: speakTime(e.ms), _time: e.ms, lap: e.lap, target: speakTarget(e.target) });
        else if (e.type === 'call') ev('lanecall', who(c));
        else if (e.type === 'served') ev('penaltyserved', { ...who(c), penalty: pen });
        else if (e.type === 'forgiven') ev('penaltyforgiven', { ...who(c), penalty: pen });
        else if (e.type === 'timeadded') ev('penaltytime', { ...who(c), added: speakSpan(e.ms) });
        else if (e.type === 'outoffuel') ev('outoffuel', who(c));
        else if (e.type === 'bopon' || (e.type === 'bopchange' && e.was * e.pct < 0)) ev('bopon', { ...who(c), bop: Math.abs(e.pct), effect: e.pct < 0 ? 'hindered' : 'helped' }); // (a car that goes from hindered to helped, or the other way, is told again; a change of the percentage alone is not said)
        else if (e.type === 'bopoff') ev('bopoff', who(c));
        else if (e.type === 'tyres') ev('tyrechange', { ...who(c), tyre: WxT.tyreName(e.tyre), weather: e.state });
        else if (e.type === 'tyredue') ev(e.points > 0 ? 'tyrepenalty' : 'wrongtyres', { ...who(c), tyre: WxT.tyreName(e.tyre), weather: eng.wxState || '', points: e.points });
        else if (e.type === 'penalty' && e.delta > 0 && e.why !== 'tyres' && e.why !== 'swaplate' && e.why !== 'damage' && e.why !== 'damagelate') ev('penalty', { ...who(c), points: e.delta }); // (penalty points for the tyres, for a swap that is not made and for the damage rules are said by their own calls)
        else if (e.type === 'assigned') ev('specialpenalty', { ...who(c), penalty: pen });
        else if (e.type === 'disqualified') ev('disqualified', who(c));
        else if (e.type === 'swapsoon') ev('swapsoon', { ...who(c), nextdriver: rosterWho(c, e.next).spoken, swapin: eng.endurance ? EnT.spokenSpan(eng.endurance, eng.endurance.warn) : '' });
        else if (e.type === 'swapdue') ev('swapdue', { ...who(c), nextdriver: rosterWho(c, e.next).spoken });
        else if (e.type === 'swapdone') { const from = rosterWho(c, e.from), to = rosterWho(c, e.to); ev('swapdone', { ...who(c), driver: from.spoken, name: from.name, nickname: from.nickname, callsign: from.callsign, nextdriver: to.spoken }); }
        else if (e.type === 'swaplate') ev(e.points > 0 ? 'swappenalty' : 'swaplate', { ...who(c), nextdriver: rosterWho(c, e.next).spoken, points: e.points });
        else if (e.type === 'damage' && e.delta > 0) ev('damagehit', { ...who(c), damage: e.points, level: e.name || '' });
        else if (e.type === 'damagelevel') { const v = { ...who(c), damage: e.points, level: e.name, repair: speakTarget(e.seconds * 1000), when: e.urgent ? 'as fast as you can' : 'whenever you can' }; ev(e.action === 'repair' ? 'damagelevel' : 'damagecritical', v); }
        else if (e.type === 'damagelate') ev('damagelate', { ...who(c), damage: c.dmg, level: e.name || '', points: e.points });
        else if (e.type === 'repairearly') ev('repairearly', { ...who(c), damage: e.points, level: e.name || '', repair: '', points: e.extra });
        else if (e.type === 'repaired') ev('repaired', { ...who(c), level: e.name || '', repair: speakGap(e.ms) });
        else if (e.type === 'damageout') ev(e.how === 'dq' ? 'damagedq' : 'damageout', { ...who(c), damage: e.points, level: e.name || '' });
      }
      if (live && eng.fuel && eng.fuel.on && eng.fuel.tank > 0) cars.forEach((c, i) => { // low on fuel: once, until the tank is filled up again
        if (c.done || c.outOfFuel) return;
        const tank = eng.tankOf ? eng.tankOf(i) : eng.fuel.tank; // (the tank of this car: it can be smaller or bigger with Balance of Power)
        if (S.half[i] === undefined) S.half[i] = c.fuel <= tank * 0.5; // (a car that starts with half a tank or less is not told so)
        else if (c.fuel > tank * 0.5) S.half[i] = false;
        else if (!S.half[i]) { S.half[i] = true; ev('fuelhalf', { ...who(c), fuel: Math.round(c.fuel) }); }
        if (c.fuel > tank * 0.5) S.low[i] = false;
        else if (c.fuel <= tank * 0.25 && !S.low[i]) { S.low[i] = true; ev('fuellow', { ...who(c), fuel: Math.round(c.fuel) }); }
      });
      // no lap for a while: said once for each stretch without a lap (a car in the pits, out of the race or without paid time is not asked about)
      if (phase === 'running' && noLap > 0 && ctx.now !== undefined) cars.forEach((c, i) => {
        if (c.done || c.retired || c.dq || c.outOfFuel || c.blockAt !== null || c.pit || (typeof ctx.idle === 'function' && ctx.idle(c, i))) return;
        if (S.stuck[i] !== c.last && ctx.now - c.last >= noLap * 1000) { S.stuck[i] = c.last; ev('nolap', { ...who(c), seconds: noLap }); }
      });
      // laps completed since the last look
      const done = [];
      cars.forEach((c, i) => { for (let n = S.laps[i]; n < c.laps.length; n++) done.push([i, n]); S.laps[i] = c.laps.length; });
      done.sort((a, b) => cars[a[0]].total - cars[b[0]].total);
      done.forEach(([i, n]) => {
        const c = cars[i], time = c.laps[n]; if (c.bad && c.bad[n]) return; // too slow laps never count
        const id = c.driverId, prevAll = best.all, prevPers = Math.min(best.personal.get(id) ?? Infinity, best.by.get(id) ?? Infinity), prevTrack = best.track;
        best.all = Math.min(best.all, time); best.by.set(id, Math.min(best.by.get(id) ?? Infinity, time));
        const v = { ...who(c), time: speakTime(time), _time: time, lap: n + 1, laps: limitFor(eng, c) || n + 1 };
        if (Number.isFinite(prevTrack) && time < prevTrack) { best.track = time; ev('trackrecord', { ...v, improved: speakDiff(prevTrack - time), record: speakTime(prevTrack) }); }
        else {
          if (Number.isFinite(prevAll) && time < prevAll) ev('fastestlap', { ...v, improved: speakDiff(prevAll - time) });
          else if (Number.isFinite(prevPers) && time < prevPers) ev('personalbest', { ...v, improved: speakDiff(prevPers - time) });
          if (nearRecord > 0 && Number.isFinite(prevTrack) && time - prevTrack <= nearRecord * 1000) ev('nearrecord', { ...v, off: speakDiff(time - prevTrack) });
        }
        if (n === 0) ev('firstlap', v);
      });
      // the order after those laps: a new leader, or a driver who moved up
      if (done.length && !S.finished) {
        const st = eng.standings(), order = st.map(x => cars.indexOf(x.car)), lead = order[0];
        if (st[0] && st[0].car.laps.length > 0) {
          if (S.leader !== null && lead !== S.leader) ev('newleader', { ...who(cars[lead]), other: who(cars[S.leader]).driver, laps: limitFor(eng, cars[lead]) });
          S.leader = lead;
        }
        let moves = 0;
        order.forEach((ci, p) => {
          const was = S.pos.indexOf(ci);
          if (p >= 1 && was > p && cars[ci].laps.length > 0 && moves < 2) { // moved up (not into the lead: that is a new leader)
            // the driver passed = the one who was directly in front before and is now behind. A car that went into the pits, retired or was disqualified is not "passed".
            const o = S.pos[was - 1], oc = cars[o];
            if (o !== undefined && order.indexOf(o) > p && oc.blockAt === null && !oc.dq && !oc.retired && !oc.done) { moves++; ev('overtake', { ...who(cars[ci]), other: who(oc).driver, position: ordinal(p + 1) }); }
          }
        });
        S.pos = order;
        // the leader starts the last lap of a race by laps
        const leadLimit = limitFor(eng, st[0].car);
        if (leadLimit && !S.lastLapDone && st[0].car.laps.length === leadLimit - 1 && st[0].car.laps.length > 0) { S.lastLapDone = true; S.lastCar = lead; ev('lastlap', { ...who(st[0].car), laps: leadLimit }); }
        // another driver starts the last lap (the car the last lap call was about is not called again)
        done.forEach(([i, n]) => { const lim = limitFor(eng, cars[i]); if (lim >= 2 && n + 1 === lim - 1 && !S.lastOther[i] && i !== S.lastCar) { S.lastOther[i] = true; ev('lastlapother', { ...who(cars[i]), laps: lim }); } });
        // gaps and battles, worked out for every car that completed a lap, from the times of the laps (only while racing)
        if (live) {
          const info = typeof eng.gapInfo === 'function' ? eng.gapInfo() : [], leadName = who(st[0].car).driver, seen = new Set(), thr = closeGap * 1000; let said = 0;
          done.forEach(([i]) => {
            if (seen.has(i)) return; seen.add(i);
            const c = cars[i], g = info[i];
            if (!g) { S.near[i] = null; return; }
            if (g.down > (S.down[i] || 0)) { S.down[i] = g.down; ev('lapped', { ...who(c), other: leadName, lapsdown: lapsText(g.down) }); }
            const front = g.pos > 1 ? st[g.pos - 2].car : null, fi = front ? cars.indexOf(front) : -1;
            if (!front || g.ahead === null || front.blockAt !== null || front.dq || front.retired || front.done || c.blockAt !== null || c.done) { S.near[i] = null; return; }
            // close to the car in front: counted per car in front, said once per approach (it starts again when the gap has grown to one and a half times the limit)
            const n = S.near[i] && S.near[i].other === fi ? S.near[i] : { other: fi, laps: 0, said: false, battle: false };
            if (g.ahead > thr * 1.5) { n.laps = 0; n.said = false; n.battle = false; } else if (g.ahead < thr) n.laps++; else n.laps = 0;
            S.near[i] = n;
            if (thr > 0 && g.ahead < thr && said < 2) {
              const v = { ...who(c), other: who(front).driver, gap: speakGap(g.ahead), position: ordinal(g.pos - 1) };
              if (n.laps >= battleLaps && !n.battle) { n.battle = true; n.said = true; said++; ev('battle', v); }
              else if (!n.said) { n.said = true; said++; ev('closing', v); }
            }
          });
        }
      }
      // race distance: at each distance chosen in the set (percent of the laps, or of the time of a timed race). If several are passed at once only the last is called.
      if (live && !S.finished && dists.length) {
        const lead = eng.standings()[0], timed = eng.type === 'timed' && Number(eng.cfg.duration) > 0 && ctx.now !== undefined;
        const leadLim = lead ? limitFor(eng, lead.car) : 0, total = timed ? Number(eng.cfg.duration) * 60000 : leadLim, done = timed ? eng.elapsed(ctx.now) : lead ? lead.car.laps.length : 0;
        if (total > 0 && lead) {
          const hit = dists.filter(d => !S.distDone.includes(d) && done > 0 && done >= total * d / 100 - 1e-9);
          if (hit.length) {
            hit.forEach(d => S.distDone.push(d));
            const left = timed ? Math.max(1, Math.round((total - done) / 60000)) : Math.max(0, total - done), pc = hit[hit.length - 1];
            ev('distance', { ...who(lead.car), percent: pc, left: timed ? `${left} minute${left === 1 ? '' : 's'}` : `${left} lap${left === 1 ? '' : 's'}`, laps: timed ? '' : leadLim });
          }
        }
      }
      // laps or minutes to go: at each number chosen in the set (if several are passed at once, the smallest is called)
      if (live && !S.finished && (lapsToGo.length || minutesToGo.length)) {
        const lead = eng.standings()[0], total = Number(eng.cfg.duration) * 60000;
        const togoLim = lead ? limitFor(eng, lead.car) : 0;
        if (lead && togoLim && lapsToGo.length) {
          const have = lead.car.laps.length, hit = lapsToGo.filter(k => k < togoLim && !S.togoDone.includes(k) && have > 0 && have >= togoLim - k);
          if (hit.length) { hit.forEach(k => S.togoDone.push(k)); ev('lapstogo', { ...who(lead.car), left: lapsText(hit[0]), laps: togoLim }); }
        }
        if (lead && minutesToGo.length && ctx.now !== undefined && (eng.type === 'timed' || eng.type === 'qualifying') && total > 0) {
          const spent = eng.elapsed(ctx.now), hit = minutesToGo.filter(m => m * 60000 < total && !S.minDone.includes(m) && spent > 0 && total - spent > 0 && total - spent <= m * 60000);
          if (hit.length) { hit.forEach(m => S.minDone.push(m)); ev('timetogo', { ...who(lead.car), left: `${hit[0]} minute${hit[0] === 1 ? '' : 's'}` }); }
        }
      }
      // the end of the race (a heat that is not the last one says that the heat is finished instead)
      if (eng.status === 'finished' && !S.finished && cars.some(c => c.laps.length)) {
        S.finished = true; ev(ctx.heat && ctx.heat.idx + 1 < (ctx.heat.total || ctx.heat.count) ? (ctx.heat.final ? 'finalend' : 'heatend') : 'finished', {});
        const st = eng.standings(), w = st[0]; if (w) ev('winner', { ...who(w.car), laps: w.car.laps.length });
        st.slice(1, 3).forEach((x, k) => { if (x.car.laps.length) ev('podium', { ...who(x.car), position: ordinal(k + 2), laps: x.car.laps.length }); });
      }
      return out;
    }
    return { observe };
  }
  const api = { CALLS, VARS, SAMPLE, EVERY_DRIVER, EVERY_CALL, conditionsOf, ordinal, speakTime, speakGap, speakDiff, speakSpan, speakTarget, fill, create };
  root.Announcer = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
