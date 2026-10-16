// One definition per kind of item. To add a field, add one line to its `fields` list;
// forms, lists and the database file pick it up automatically (old data stays valid).
// type: text | longtext | number | date | choice | country | image | tracklength (metres, with a calculator) | gallery (extra pictures)
// the kinds of session that are raced (a Time Token Session has no start lights, laps, fuel or penalties)
const RACING = [{ sessionType: ['practice', 'qualifying', 'race', 'timed', 'heats', 'endurance'] }];
// a heat-based race: a Heat-based race, or an Endurance Race that is heat-based (extra: the other conditions that must match)
const HEATED = (extra = {}) => [{ sessionType: ['heats'], ...extra }, { sessionType: ['endurance'], enduranceBy: ['heats'], ...extra }];
const Wx = require('./renderer/weather.js'); // the tyres, the standard settings and the hindrance table of a weather system (one place for them)
// the 12 numbers of the hindrance table of a weather system: the weather state by the kind of tyre
const WX_TABLE = [];
Wx.STATES.forEach(([state, stateName]) => Wx.CLASSES.forEach(cls => WX_TABLE.push({ key: Wx.HKEYS[state + '/' + cls], group: 'hinder', type: 'number', min: 0, default: Wx.TABLE[state][cls],
  label: `${stateName} weather, ${cls === 'dry' ? 'dry' : cls === 'inter' ? 'Intermediate' : 'Wet'} tyres (% hindered)`, showIf: [{ hinder: ['on'] }] })));
// The conditions on the track for every weather state (track temperature, air temperature, wind speed, wind direction): the Track Conditions widget shows them and the audio says them
const WX_COND = [{ key: 'units', group: 'conditions', label: 'Units', type: 'select', default: Wx.DEFAULTS.units, options: [['metric', 'Degrees Celsius and kilometres per hour'], ['imperial', 'Degrees Fahrenheit and miles per hour']],
  hint: 'The numbers below are in these units (changing the units does not convert them). A Track Conditions widget can show the other units.' }];
Wx.STATES.forEach(([state, stateName]) => Wx.COND_ITEMS.forEach(([item, , itemName]) => WX_COND.push({ key: Wx.CKEYS[state + '/' + item], group: 'conditions', type: 'number', ...(item === 'wind' ? { min: 0 } : item === 'dir' ? { min: 0, max: 359 } : {}), default: Wx.COND[state][item],
  label: `${stateName}: ${itemName.toLowerCase()}${item === 'dir' ? ' (degrees, where the wind comes from)' : ''}`, ...(item === 'dir' && state === 'dry' ? { hint: 'Where the wind comes from: 0 is north, 90 east, 180 south, 270 west.' } : {}) })));
module.exports = {
  tracks: {
    label: 'Track', plural: 'Tracks', title: ['name'], image: 'picture', card: ['lanes', 'scale', 'surface'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, number of lanes, scale and surface', open: true },
      { id: 'length', title: 'Length and lanes', note: 'How long the track is, and how the lanes differ in length', open: true },
      { id: 'laps', title: 'Lap time limits', note: 'Ignore faulty triggers and very slow laps' },
      { id: 'extras', title: 'Picture and notes', note: 'A picture for the lists and cards, and your own notes' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text' },
      { key: 'lanes', group: 'basics', label: 'Number of lanes', type: 'number', min: 1, step: 1 },
      { key: 'scale', group: 'basics', label: 'Scale', type: 'choice', options: ['1:24', '1:32', '1:43', 'HO'], allowOther: true },
      { key: 'surface', group: 'basics', label: 'Track Surface', type: 'text' },
      { key: 'length', group: 'length', label: 'Track length (metres)', type: 'tracklength', optional: true, hint: 'The length of the outside lane if you use the Lane length modifier below, otherwise the length of every lane.' },
      { key: 'laneModifier', group: 'length', label: 'Lane length modifier', type: 'select', default: 'none', options: [['none', 'None: every lane has the track length'], ['bends', 'Calculated from the bends (loop, or enter the full turns)'], ['measured', 'Measured: I enter the length of every lane']], optional: true, hint: 'The lanes of a track are not equally long. The speed uses the length of the car\'s own lane.' },
      { key: 'outsideLane', group: 'length', label: 'The track length is that of', type: 'select', default: 'last', options: [['last', 'The last lane (the outside lane)'], ['first', 'The first lane (the outside lane)']], optional: true, showIf: [{ laneModifier: ['bends'] }] },
      { key: 'laneSpacing', group: 'length', label: 'Distance between the lanes (millimetres, centre to centre)', type: 'number', min: 0, default: 100, optional: true, showIf: [{ laneModifier: ['bends'] }], hint: 'Each lane further in is 2 \u00d7 \u03c0 (about 6.3) times this distance shorter for every full turn of the track: 100 mm gives 0.63 m shorter per lane on a loop.' },
      { key: 'netTurns', group: 'length', label: 'Full turns the track makes (left bends minus right bends)', type: 'number', min: 0, step: 1, default: 1, optional: true, showIf: [{ laneModifier: ['bends'] }], hint: 'It is the angle of the bends that counts, not how many there are: a circuit that does not cross itself is 1 turn, whatever the mix of left and right bends. 0 is a figure-eight (all lanes equally long), 2 is for instance two loops the same way round that cross over each other with a bridge.' },
      { key: 'laneLengths', group: 'length', label: 'Length of every lane (metres), lane 1 first', type: 'numberlist', default: '', optional: true, showIf: [{ laneModifier: ['measured'] }], hint: 'One number per lane, separated by commas, with a dot for decimals: for example 15.4, 15.8, 16.2. Use this when the lanes swap sides, the spacing is not the same everywhere, or you measured them.' },
      { key: 'minLap', group: 'laps', label: 'Minimum lap time (seconds)', type: 'number', min: 0, optional: true, hint: 'A crossing sooner than this after the last one is ignored (faulty trigger).' },
      { key: 'maxLap', group: 'laps', label: 'Maximum lap time (seconds)', type: 'number', min: 0, optional: true, hint: 'A slower lap still counts as a lap, but not for best laps and records.' },
      { key: 'deslotTime', group: 'laps', label: 'Deslot time (seconds)', type: 'number', min: 0, optional: true, hint: 'A lap slower than this counts as a deslot. In a race with a Damage System a deslot gives the car damage points (set under Race Setup > Damage Systems). Empty or 0 = no automatic deslots.' },
      { key: 'picture', group: 'extras', label: 'Picture', type: 'image', optional: true },
      { key: 'notes', group: 'extras', label: 'Notes', type: 'longtext', optional: true }
    ]
  },
  slotcars: {
    label: 'Slot car', plural: 'Slotcars', title: ['brand', 'manufacturer', 'model'], image: 'picture', gallery: 'extraPictures', card: ['scale', 'motor', 'tyres', 'lapsDriven'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Brand, manufacturer, model and scale', open: true },
      { id: 'technical', title: 'Technical details', note: 'Motor, tyres, gearing and weight', open: true },
      { id: 'pictures', title: 'Pictures', note: 'The main picture, and more pictures of the chassis and parts' },
      { id: 'stats', title: 'Statistics', note: 'Laps driven, counted automatically from your races' }
    ],
    fields: [
      { key: 'brand', group: 'basics', label: 'Brand', type: 'text' },
      { key: 'manufacturer', group: 'basics', label: 'Manufacturer', type: 'text' },
      { key: 'model', group: 'basics', label: 'Model', type: 'text' },
      { key: 'scale', group: 'basics', label: 'Scale', type: 'choice', options: ['1:24', '1:32', '1:43', 'HO'], allowOther: true },
      { key: 'motor', group: 'technical', label: 'Motor', type: 'text' },
      { key: 'tyres', group: 'technical', label: 'Tyres', type: 'text' },
      { key: 'tyreCompound', group: 'technical', label: 'Tyre choice (for the Weather System)', type: 'select', default: Wx.DEFAULT_TYRE, options: Wx.TYRES.map(t => [t.code, `${t.name} (${t.code})`]),
        hint: 'The tyre this car races on when the track is dry. In a race with a Weather System a pit stop changes it to Wet (or Intermediate) when it rains, and back to this one when the track is dry again.' },
      { key: 'damageFactor', group: 'technical', label: 'Damage factor (for the Damage System)', type: 'number', min: 0, step: 'any', default: 1, optional: true,
        hint: '1 = like the other cars. A fragile car collects damage points faster (1.5: half as many again), a sturdy one slower (0.5); 0 = it never takes damage. Only used in a race with a Damage System.' },
      { key: 'gearing', group: 'technical', label: 'Gearing', type: 'text' },
      { key: 'weight', group: 'technical', label: 'Weight', type: 'text' },
      { key: 'picture', group: 'pictures', label: 'Main picture', type: 'image', optional: true },
      { key: 'extraPictures', group: 'pictures', label: 'More pictures (chassis, parts list…)', type: 'gallery', optional: true },
      { key: 'lapsDriven', group: 'stats', label: 'Laps driven', type: 'number', automatic: true }
    ]
  },
  drivers: {
    label: 'Driver', plural: 'Drivers', title: ['name'], image: 'avatar', card: ['nickname', 'callsign', 'flag'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, nickname and the three-letter callsign', open: true },
      { id: 'personal', title: 'Personal details', note: 'Date of birth and country flag', open: true },
      { id: 'avatar', title: 'Avatar', note: 'The picture on driver cards and timing screens' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text' },
      { key: 'nickname', group: 'basics', label: 'Nickname', type: 'text' },
      { key: 'callsign', group: 'basics', label: 'Callsign (3 letters)', type: 'text', maxLength: 3, uppercase: true },
      { key: 'dateOfBirth', group: 'personal', label: 'Date of birth', type: 'date' },
      { key: 'flag', group: 'personal', label: 'Country flag', type: 'country' },
      { key: 'avatar', group: 'avatar', label: 'Avatar', type: 'image' }
    ]
  },
  // Teams (1.8.0): a group of drivers with a name and a picture. A driver can be in more than one team. A team races in a lane, or in a heat, instead of a single driver.
  teams: {
    label: 'Team', plural: 'Teams', title: ['name'], image: 'picture', card: ['drivers'],
    groups: [
      { id: 'basics', title: 'Basics', note: 'The name and the drivers of the team', open: true },
      { id: 'picture', title: 'Picture', note: 'The team picture on the timing screens' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Team name', type: 'text' },
      { key: 'drivers', group: 'basics', label: 'Drivers of the team', type: 'members', ref: 'drivers', hint: 'In the order they take their turn. A driver can be in more than one team.' },
      { key: 'picture', group: 'picture', label: 'Team picture', type: 'image' }
    ]
  },
  racesetups: {
    label: 'Race setup', plural: 'Race setups', title: ['name'], extra: false, linked: false,
    // short list view, and grid cards that show the picture of the setup's track ('@limit' = laps or time, worked out by the screen)
    list: ['name', 'track', 'sessionType', '@limit'], card: ['sessionType', 'track', '@limit'], imageFrom: 'track',
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'session', title: 'Session', note: 'Name, kind of session and track', open: true },
      { id: 'length', title: 'Length and result', note: 'Laps or time, heats, how the race ends and is counted', open: true },
      { id: 'endurance', title: 'Endurance: driver swaps', note: 'When a team swaps drivers in the pits, who steps in, and what a swap that is not made costs' },
      { id: 'start', title: 'Start', note: 'Start lights, restarts and the first lap' },
      { id: 'rules', title: 'Penalties, fuel and pits', note: 'Penalty system, fuel setup and the pit stop sensor' },
      { id: 'yellow', title: 'Yellow flag', note: 'A target lap time while the yellow flag is up' },
      { id: 'screens', title: 'Screens and sound', note: 'Timing page layouts and the audio set' },
      { id: 'trackmate', title: 'Trackmate', note: 'Track power at the start and the Trackcall button' }
    ],
    // showIf: the field is shown when ANY listed condition matches (each condition: all its keys match).
    fields: [
      { key: 'name', group: 'session', label: 'Name', type: 'text' },
      { key: 'sessionType', group: 'session', label: 'Session type', type: 'select', default: 'race',
        options: [['practice', 'Free practice'], ['qualifying', 'Qualifying'], ['race', 'Race by laps'], ['timed', 'Timed race'], ['heats', 'Heat-based race'], ['endurance', 'Endurance Race'], ['tokens', 'Time Token Session']],
        hint: 'A Time Token Session runs for as long as you like. Each lane is switched on with paid time and turns red when the time is up. Its settings are in Race Setup > Time Tokens. An Endurance Race is a long race in which the drivers of a team swap in the pits and drive the same car; its swap rules are in the Endurance folder below.' },
      { key: 'track', group: 'session', label: 'Track (sets the number of lanes)', type: 'ref', ref: 'tracks' },
      { key: 'enduranceBy', group: 'length', label: 'The Endurance Race is', type: 'select', default: 'time',
        options: [['time', 'One long race of a set time'], ['laps', 'One long race of a number of laps'], ['heats', 'Heat-based: a series of heats, planned by a rotation setup or by the settings below']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'In an Endurance Race the participants are teams. The drivers of a team swap in the pits and drive the same car. One long race: the team races from start to finish and swaps as often as the rules below say. Heat-based: every heat is an endurance race of its own, with swaps; the drivers who start a heat are chosen as in a heat-based race with teams.' },
      { key: 'heatBy', group: 'length', label: 'Each heat is limited by', type: 'select', default: 'laps',
        options: [['laps', 'Number of laps'], ['time', 'Duration']], showIf: HEATED(),
        hint: 'Number of laps: a heat ends when the cars have driven that many laps. Duration: every heat runs for the same time.' },
      { key: 'rotation', group: 'length', label: 'Rotation setup', type: 'ref', ref: 'rotationsetups', blank: 'None: plan the heats from the settings below', showIf: HEATED(),
        hint: 'A heat plan that you made yourself in Race Setup > Rotation Setups: which participant races in which heat and in which lane. With one chosen, the settings that plan the heats (up to "Who races together") are not used. Everything about how the result is counted still is.' },
      { key: 'participants', group: 'length', label: 'The participants of the heats are', type: 'select', default: 'drivers', options: [['drivers', 'Drivers'], ['teams', 'Teams (made under Database > Teams)']], showIf: [{ sessionType: ['heats'], rotation: [''] }],
        hint: 'Teams: on Home you choose a team and a car for every participant. The drivers of a team take turns, one driver in every heat. With a rotation setup the rotation says whether the participants are drivers or teams.' },
      { key: 'teamDriver', group: 'length', label: 'Which driver of a team drives a heat', type: 'select', default: 'order', options: [['order', 'In turn: the order of the team in the database'], ['random', 'By lot: the driver who drove the fewest heats first'], ['chosen', 'I choose before every heat (the next one in turn is suggested)']], showIf: HEATED(),
        hint: 'Only used when the participants are teams. A driver who is in two teams that race in the same heat drives for one of them only.' },
      { key: 'heatPlan', group: 'length', label: 'How the heats are planned', type: 'select', default: 'manual',
        options: [['manual', 'I choose the number of heats'], ['perdriver', 'Every driver races the same number of heats (I choose how many)'], ['roundrobin', 'Round robin: every driver meets every other driver'], ['rotation', 'Lane rotation: every driver races once in every lane']], showIf: HEATED({ rotation: [''] }),
        hint: 'I choose: the drivers are spread over the number of heats you type below. Same number of heats: you say how many heats every driver races, and the number of heats follows from that. Round robin: as many heats as it takes for every pair of drivers to race in the same heat at least once. Lane rotation: every driver races once in every lane, against as many different drivers as possible. The plan is shown on the Home tab before you start, and that is the plan that is raced.' },
      { key: 'heats', group: 'length', label: 'How many heats', type: 'number', default: 3, showIf: HEATED({ rotation: [''], heatPlan: ['manual'] }),
        hint: 'The drivers are spread over the heats, so every driver races about the same number of heats: if the heats do not divide evenly over the drivers, some drivers race one heat more (the Home tab shows who).' },
      { key: 'heatsEach', group: 'length', label: 'Heats for every driver', type: 'number', default: 3, min: 1, showIf: HEATED({ rotation: [''], heatPlan: ['perdriver'] }),
        hint: 'Every driver races exactly this many heats. The number of heats follows: with 7 drivers on 4 lanes and 3 heats each there are 6 heats (21 places), some of them with one car fewer.' },
      { key: 'heatEven', group: 'length', label: 'Same number of heats for everyone', type: 'select', default: 'no', options: [['no', 'No: the fewest heats that make every pair meet'], ['yes', 'Yes: add a few heats until everyone has raced as many as the busiest driver']], showIf: HEATED({ rotation: [''], heatPlan: ['roundrobin'] }),
        hint: 'A round robin often gives some drivers one heat more than others, and the overall result adds the heats up. Yes adds the few heats that make it equal.' },
      { key: 'heatSeeding', group: 'length', label: 'Who races together', type: 'select', default: 'random', options: [['random', 'Shuffled'], ['mixed', 'Mixed by the latest qualifying: every heat has fast and slow drivers'], ['speed', 'By the latest qualifying: the fastest drivers race together, the best heat last']], showIf: HEATED({ rotation: [''], heatPlan: ['manual', 'perdriver'] }),
        hint: 'Mixed and By qualifying use the latest qualifying on the track of this setup (Home tells you when there is none: then the drivers are shuffled). Drivers who did not take part in it are placed last. Round robin and lane rotation always shuffle: they choose the heats to make everybody meet.' },
      { key: 'laps', group: 'length', label: 'Number of laps', type: 'number', default: 10,
        showIf: [{ sessionType: ['race'] }, { sessionType: ['endurance'], enduranceBy: ['laps'] }, ...HEATED({ heatBy: ['laps'] })] },
      { key: 'duration', group: 'length', label: 'Duration (minutes)', type: 'number', default: 5,
        showIf: [{ sessionType: ['qualifying', 'timed'] }, { sessionType: ['endurance'], enduranceBy: ['time'] }, ...HEATED({ heatBy: ['time'] })] },
      { key: 'endRule', group: 'length', label: 'The race ends', type: 'select', default: 'all',
        options: [['all', 'When every car has finished'], ['leader', 'When the lead car finishes']],
        showIf: [{ sessionType: ['race'] }, { sessionType: ['endurance'], enduranceBy: ['laps'] }, ...HEATED({ heatBy: ['laps'] })] },
      { key: 'resultBy', group: 'length', label: 'Overall result counted by', type: 'select', default: 'laps',
        options: [['laps', 'Total laps'], ['points', 'Points'], ['time', 'Total race time (heats limited by laps)']], showIf: HEATED(),
        hint: 'Total laps: the driver with the most laps wins. Points: every heat gives points for the position, and the most points wins. Total race time: the driver with the lowest time for the laps of the heats wins (the winner of a heat is the first to finish), which needs heats that are limited by laps. How the heats are added up, and what decides a tie, is set below.' },
      { key: 'unfinished', group: 'length', label: 'A heat that is not finished', type: 'select', default: 'below',
        options: [['below', 'The driver ranks below the drivers who finished (by laps)'], ['estimate', 'The finish time is estimated from the average lap of the driver']], showIf: HEATED({ heatBy: ['laps'], resultBy: ['time'] }),
        hint: 'A heat can end before every car has finished its laps (the race ends when the lead car finishes, you stop it, or a car runs out of fuel). Ranks below: a driver who did not finish every heat that counts is ranked after those who did, by laps. Estimated: the time the driver still needed is the laps that were left at their own average lap, and that estimated time counts like any other (it is marked as an estimate). A car without a lap, that ran out of fuel or that is disqualified has no estimate and ranks below.' },
      { key: 'points', group: 'length', label: 'Points per position (1st first, separated by commas)', type: 'numberlist', default: '10, 8, 6, 5, 4, 3, 2, 1',
        showIf: HEATED({ resultBy: ['points'] }),
        hint: 'For example 10, 8, 6 gives the winner of a heat 10 points, the second 8 and the third 6. Positions further down get nothing.' },
      { key: 'countBy', group: 'length', label: 'How the heats are added up', type: 'select', default: 'total',
        options: [['total', 'All heats added up'], ['average', 'The average per heat'], ['best', 'Only the best heats of every driver count']], showIf: HEATED(),
        hint: 'All heats added up: a driver who races a heat more has an advantage. The average per heat is fair when drivers race a different number of heats (the Home tab shows when they do). Only the best heats: every driver counts the best few of their heats (you choose how many below), so a bad heat does not matter.' },
      { key: 'bestHeats', group: 'length', label: 'Heats that count', type: 'number', default: 2, min: 1, showIf: HEATED({ countBy: ['best'] }),
        hint: 'The best heats of every driver that count: the best by laps (or by points, for a result by points). A driver who raced fewer heats than this has them all counted, which is less than the others.' },
      { key: 'dropWorst', group: 'length', label: 'Drop the worst heat', type: 'select', default: 'no', options: [['no', 'No: every heat counts'], ['yes', 'Yes: the worst heat of every driver does not count']], showIf: HEATED(),
        hint: 'Takes away the worst heat of every driver who raced at least two heats, before the rest is counted. A worse heat is one with fewer laps (or fewer points). It is fairest when everybody races the same number of heats.' },
      { key: 'fastestBonus', group: 'length', label: 'Bonus points for the fastest lap of a heat', type: 'number', default: 0, min: 0, showIf: HEATED({ resultBy: ['points'] }),
        hint: 'The driver with the fastest lap of a heat gets these extra points in that heat (0 is no bonus). The bonus is part of the points of the heat, so it also counts when you drop the worst heat or count only the best heats.' },
      { key: 'tieBreak', group: 'length', label: 'A tie is decided by', type: 'select', default: 'default',
        options: [['default', 'The other measure (laps or points), then the fastest lap'], ['bestlap', 'The fastest lap first'], ['wins', 'The most heat wins first'], ['time', 'The lowest total time first']], showIf: HEATED(),
        hint: 'Drivers with the same result are put in this order. The lowest total time is the time of the heats that count, which is only fair for drivers who drove the same number of laps. If they are still equal, the other things follow in the order of the standard.' },
      { key: 'finals', group: 'length', label: 'Finals after the heats', type: 'select', default: 'none',
        options: [['none', 'No finals: the heats are the race'], ['a', 'A final (the best drivers of the heats)'], ['ab', 'A final and a B final (the next drivers, who race first)']], showIf: HEATED(),
        hint: 'After the last heat the best drivers of the heat result race a final, with as many drivers as the track has lanes. A B final is the next group (when at least two drivers are left) and is raced before the A final. In a final the best-placed driver chooses a lane first, then the next one, and so on. Who is in a final is only known after the heats, so the Home tab shows a note about the finals and no names.' },
      { key: 'finalMode', group: 'length', label: 'What the finals decide', type: 'select', default: 'places',
        options: [['places', 'The finals decide the final places: the heat result only decides who is in which final'], ['added', 'The result of the final is added to the heat result']], showIf: HEATED({ finals: ['a', 'ab'] }),
        hint: 'The first: the final A decides places 1 to 4 (or as many as the track has lanes), the B final the places after them, the others follow in the order of the heats. The second: what a driver scores in the final (laps, or points from the same list as a heat) is added to the result of the heats. It is not averaged and never dropped. In both cases the drivers of the A final stay above the drivers of the B final.' },
      { key: 'finalLaps', group: 'length', label: 'Laps in a final (0 = as many as a heat)', type: 'number', default: 0, min: 0, showIf: HEATED({ heatBy: ['laps'], finals: ['a', 'ab'] }),
        hint: 'Every final has this many laps. 0 is the same number of laps as a heat.' },
      { key: 'finalDuration', group: 'length', label: 'Duration of a final in minutes (0 = as long as a heat)', type: 'number', default: 0, min: 0, showIf: HEATED({ heatBy: ['time'], finals: ['a', 'ab'] }),
        hint: 'Every final runs this long. 0 is the same time as a heat.' },
      { key: 'breakSeconds', group: 'length', label: 'Break between heats (seconds)', type: 'number', default: 0, min: 0, showIf: HEATED(),
        hint: 'After a heat the race waits this long before the next heat can start, and counts down on the race screen (the Race Info widget and the phone page show "next heat in 1:30"). 0 is no break timer: the race just waits until you press Start, as before. Start (or Space) always starts the next heat at once, also during the break.' },
      { key: 'breakAuto', group: 'length', label: 'When the break is over', type: 'select', default: 'no', options: [['no', 'Wait: I press Start for the next heat'], ['yes', 'The start lights begin by themselves']], showIf: HEATED(),
        hint: 'Only used when there is a break (above). "The start lights begin by themselves" runs the same start as pressing Start: the pre-race call (if the race has an audio set) and the lights. Stop still ends the race.' },
      { key: 'swapUnit', group: 'endurance', label: 'The swaps are counted in', type: 'select', default: 'minutes', options: [['minutes', 'Minutes'], ['laps', 'Laps']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'Every time below (the swap interval, the moments, the shortest and longest stint, the least and most a driver drives, the warning) is in minutes or in laps, as chosen here.' },
      { key: 'swapMode', group: 'endurance', label: 'A swap is needed', type: 'select', default: 'every', options: [['every', 'Every so often (for instance every 30 minutes)'], ['moments', 'At fixed moments of the race (for instance after 30 minutes and after 2 hours)'], ['free', 'When the team chooses, within the shortest and longest stint']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'Every so often: a swap is due when a driver has been at the wheel that long. Fixed moments: a swap is due at each moment in the list. Free: the team swaps when it wants to, as long as the shortest stint is over; a swap is due only when the longest stint (or the most a driver may drive) is reached.' },
      { key: 'swapEvery', group: 'endurance', label: 'A swap is needed every (minutes or laps)', type: 'number', default: 30, min: 1, showIf: [{ sessionType: ['endurance'], swapMode: ['every'] }] },
      { key: 'swapMoments', group: 'endurance', label: 'A swap is needed at these moments of the race', type: 'text', default: '30, 1:00:00, 2:00:00', showIf: [{ sessionType: ['endurance'], swapMode: ['moments'] }],
        hint: 'Separated by commas. In minutes a number is minutes (30), m:ss is minutes and seconds, h:mm:ss is hours, minutes and seconds (2:00:00 is 2 hours). In laps only whole lap numbers count (a swap is due after that lap).' },
      { key: 'stintMin', group: 'endurance', label: 'Shortest time at the wheel (minutes or laps, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'A swap before the shortest stint is over is a swap that is too early: it is allowed or it costs points, as set below.' },
      { key: 'stintMax', group: 'endurance', label: 'Longest time at the wheel (minutes or laps, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'When a driver has been at the wheel this long, a swap is due, whatever else is set.' },
      { key: 'totalMin', group: 'endurance', label: 'Least a driver has to drive in the whole race (minutes or laps, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'A fairness rule: the swap screen tells you which drivers have not driven enough yet, and the results say who drove too little.' },
      { key: 'totalMax', group: 'endurance', label: 'Most a driver may drive in the whole race (minutes or laps, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'When a driver has driven this much in total, a swap is due, and that driver is not chosen again.' },
      { key: 'swapWarn', group: 'endurance', label: 'Warn this long before a swap is due (minutes or laps, 0 = no warning)', type: 'number', default: 1, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'The Swap Timer widget turns amber, and the audio call "swap soon" is said (it is off in the audio set until you switch it on).' },
      { key: 'swapConfirm', group: 'endurance', label: 'The swap is made when', type: 'select', default: 'both', options: [['both', 'The car stops on the pit sensor, or the Swap done button is pressed'], ['sensor', 'The car stops on the pit sensor'], ['button', 'The Swap done button is pressed (Race Director, or a phone)']], showIf: [{ sessionType: ['endurance'] }] },
      { key: 'swapSeconds', group: 'endurance', label: 'The car has to stand on the pit sensor this long to swap (seconds)', type: 'number', default: 10, min: 0, showIf: [{ sessionType: ['endurance'], swapConfirm: ['both', 'sensor'] }],
        hint: 'Like a Stop-and-Go: once the swap is due, the car has to stay on the pit sensor this long. A car that drives on in time does not swap.' },
      { key: 'swapNext', group: 'endurance', label: 'The driver who steps in is', type: 'select', default: 'order', options: [['order', 'The next one in the order of the team'], ['chosen', 'Chosen at every swap (the next one in the order is suggested)'], ['random', 'Picked by lot (a driver who is not at the wheel of another car)']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'A driver who is at the wheel of another car in the same race is never chosen. The swap screen shows who has driven the longest, so a team can swap fairly.' },
      { key: 'swapGrace', group: 'endurance', label: 'Seconds to make the swap once it is due', type: 'number', default: 30, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'When the swap is not made within this time, the team is late: the penalty and the lap counting below apply.' },
      { key: 'swapLate', group: 'endurance', label: 'While a swap is not made', type: 'select', default: 'count', options: [['count', 'The laps keep counting'], ['stop', 'The laps stop counting (they count again once the swap is made)']], showIf: [{ sessionType: ['endurance'] }] },
      { key: 'swapPenalty', group: 'endurance', label: 'Penalty points for a swap that is not made in time (0 = none)', type: 'number', default: 0, min: 0, step: 1, showIf: [{ sessionType: ['endurance'] }],
        hint: 'Given when the grace time is over. It needs a penalty system (under Penalties, fuel and pits); without one nothing is added, but the team is still called out.' },
      { key: 'swapRepeat', group: 'endurance', label: 'Give the penalty again every (seconds, 0 = once)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'A team that keeps driving gets the penalty again after this many seconds, for as long as the swap is not made.' },
      { key: 'swapEarly', group: 'endurance', label: 'A swap before the shortest stint is over', type: 'select', default: 'allow', options: [['allow', 'Is allowed'], ['penalty', 'Costs the penalty points of a swap that is not made']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'Only when a shortest stint is set above. A swap before it is over is logged as too early. It needs a penalty system (under Penalties, fuel and pits).' },
      { key: 'minPenalty', group: 'endurance', label: 'Penalty points for every driver who drove less than the least (0 = none)', type: 'number', default: 0, min: 0, step: 1, showIf: [{ sessionType: ['endurance'] }],
        hint: 'Given to the team when the race is over, for each driver who did not drive the least set above (a driver who did not drive at all too). A race that is stopped early gives none. It needs a penalty system.' },
      { key: 'lightsMin', group: 'start', label: 'Start lights: shortest wait before lights out (seconds)', type: 'number', default: 1, showIf: RACING },
      { key: 'lightsMax', group: 'start', label: 'Start lights: longest wait before lights out (seconds)', type: 'number', default: 5, showIf: RACING },
      { key: 'lightsAfter', group: 'start', label: 'Start lights after the race has started', type: 'select', default: 'out',
        options: [['out', 'They go out'], ['flags', 'They follow the race flag: green while racing, yellow after a yellow flag, red after a red flag']], showIf: RACING },
      { key: 'restartAfterRed', group: 'start', label: 'Restarting after a red flag', type: 'select', default: 'countdown',
        options: [['countdown', 'The start lights count down again, then the race goes on'], ['resume', 'The race goes on at once']], showIf: RACING },
      { key: 'firstLap', group: 'start', label: 'First crossing of the start line', type: 'select', default: 'skip',
        options: [['skip', 'Only starts the timing: the short lap from the grid is not counted'], ['count', 'Counts as a lap']], showIf: RACING },
      { key: 'penaltySystem', group: 'rules', label: 'Penalty system', type: 'ref', ref: 'penaltysystems', blank: 'No penalties', showIf: RACING },
      { key: 'damageSystem', group: 'rules', label: 'Damage system', type: 'ref', ref: 'damagesystems', blank: 'No damage', showIf: [{ sessionType: ['race', 'timed', 'heats', 'endurance'] }],
        hint: 'Damage points, and the stop in the pits that repairs them. Make damage systems under Race Setup > Damage Systems. Only for races (a number of laps or a duration), not for practice or qualifying. Penalty points for a late or an early stop need a Penalty system above.' },
      { key: 'fuelRules', group: 'rules', label: 'Fuel setup', type: 'ref', ref: 'fuelrules', blank: 'No fuel', showIf: RACING },
      { key: 'bop', group: 'rules', label: 'Balance of Power', type: 'select', default: 'off', options: [['off', 'Off'], ['on', 'On: hinder the fastest car and help the slowest (set it up under Race Setup > Balance of Power)']], showIf: [{ sessionType: ['race', 'timed', 'heats', 'endurance'] }],
        hint: 'Works through the fuel rules, so it needs a Fuel setup above. Only for races (a number of laps or a duration), not for practice or qualifying.' },
      { key: 'weather', group: 'rules', label: 'Weather system', type: 'ref', ref: 'weathersystems', blank: 'No weather', showIf: [{ sessionType: ['race', 'timed', 'heats', 'endurance'] }],
        hint: 'A spell of rain with a forecast, and tyres to change in the pits. Make weather systems under Race Setup > Weather Systems. Only for races (a number of laps or a duration), not for practice or qualifying. Hindering the cars needs a Fuel setup above; the tyres and the penalty points do not.' },
      { key: 'pitHold', group: 'rules', label: 'Pit stop: the sensor must be blocked this long to start a stop (seconds)', type: 'number', default: 2, showIf: RACING },
      { key: 'yellowTarget', group: 'yellow', label: 'Yellow flag: target lap time (seconds, 0 = none)', type: 'number', default: 0, min: 0, showIf: RACING,
        hint: 'While the yellow flag is up, drivers must drive slower than this. Say your normal lap is 7.500 and you set 15.000: a full lap under yellow that is faster than 15.000 is a lap that was too fast, and it is called out. A lap that was partly before the yellow flag does not count. 0 means no target.' },
      { key: 'yellowPoints', group: 'yellow', label: 'Yellow flag: penalty points for a lap that is too fast', type: 'number', default: 1, min: 0, showIf: RACING,
        hint: 'Given to the driver for every full lap under yellow that is faster than the target. It needs a penalty system (under Penalties, fuel and pits); without one the lap is only called out and marked in the lap review. 0 gives no points. Not used without a target above.' },
      { key: 'layout', group: 'screens', label: 'Timing page layout (main screen)', type: 'ref', ref: 'layouts', blank: 'Default layout' },
      { key: 'layout2', group: 'screens', label: 'Timing page layout (second screen)', type: 'ref', ref: 'layouts', blank: 'Same as main screen' },
      { key: 'audioSet', group: 'screens', label: 'Audio set (announcements)', type: 'ref', ref: 'audiosets', blank: 'No audio' },
      { key: 'startPower', group: 'trackmate', label: 'Track power when a race starts (Trackmate relay)', type: 'select', default: 'on',
        options: [['on', 'On: the track has power while the lights count down'], ['off', 'Off: the power comes on when the lights go out']] },
      { key: 'trackcall', group: 'trackmate', label: 'Trackmate Trackcall button', type: 'select', default: 'yellowred',
        options: [['yellowred', 'One press: yellow flag. Two quick presses: red flag'],
          ['yellowredcut', 'One press: yellow flag, power stays on. Two quick presses: red flag, power off'],
          ['yellow', 'Each press switches the yellow flag on or off'], ['yellowcut', 'Each press switches the yellow flag on or off; a yellow flag turns the power off'],
          ['red', 'Each press stops or restarts the race (red flag)'], ['redcut', 'Each press stops or restarts the race (red flag); the red flag turns the power off'],
          ['power', 'Each press switches the track power off or on (the Trackmate relay), no flags'], ['none', 'Does nothing']] },
      { key: 'trackcallWindow', group: 'trackmate', label: 'Trackcall: seconds within which a second press counts as a double press', type: 'number', default: 3, showIf: [{ trackcall: ['yellowred', 'yellowredcut'] }] }
    ]
  },
  // Fuel rules: tank, use per lap (changing with the lap time) and refuelling. Chosen per race setup.
  fuelrules: {
    label: 'Fuel setup', plural: 'Fuel setups', title: ['name'], extra: false, linked: false, list: ['name', 'tank', 'perLap', 'targetLap'], card: ['tank', 'perLap', 'targetLap'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, tank size and the fuel used per lap', open: true },
      { id: 'empty', title: 'Empty tank and refuelling', note: 'What happens when the fuel runs out, and the refuelling speed', open: true },
      { id: 'fast', title: 'Fast and slow laps', note: 'How much more fuel a fast lap uses, and how much a slow lap saves' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text' },
      { key: 'tank', group: 'basics', label: 'Tank size (litres)', type: 'number', default: 120 },
      { key: 'perLap', group: 'basics', label: 'Fuel used per lap at the target lap time (litres)', type: 'number', default: 2 },
      { key: 'targetLap', group: 'basics', label: 'Target lap time (seconds)', type: 'number', optional: true, hint: 'A lap at the target time uses the amount above. Faster laps use more, slower laps less. Empty = every lap uses the same.' },
      { key: 'empty', group: 'empty', label: 'When the fuel runs out', type: 'select', default: 'retire',
        options: [['retire', 'The car retires from the race'], ['stop', 'Laps stop counting until it has refuelled'], ['warn', 'The car carries on (a penalty system can add points for it)']] },
      { key: 'rate', group: 'empty', label: 'Refuelling speed in the pits (litres per second)', type: 'number', default: 10 },
      { key: 'maxExtra', group: 'fast', label: 'Most extra fuel a fast lap can use (%)', type: 'number', default: 25, hint: 'Fuel used = litres per lap x target time / lap time, never more than this many percent above the litres per lap.' },
      { key: 'maxSaving', group: 'fast', label: 'Most fuel a slow lap can save (%)', type: 'number', default: 30, hint: '...and never more than this many percent below it.' }
    ]
  },
  // Penalty systems: how penalty points turn into time penalties. Chosen per race setup.
  penaltysystems: {
    label: 'Penalty system', plural: 'Penalty systems', title: ['name'], extra: false, linked: false, list: ['name', 'timeRule', 'dqPoints'], card: ['timeRule', 'dqPoints'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, and how penalty points turn into time', open: true },
      { id: 'special', title: 'Special penalties', note: 'Penalties the Race Director can give, such as a Stop-and-Go or a Drivethrough', open: true },
      { id: 'limits', title: 'Disqualification and fuel', note: 'When a driver is disqualified, and points for an empty tank' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text' },
      { key: 'timeRule', group: 'basics', label: 'Points turn into time', type: 'select', default: 'every', options: [['every', 'Every X points add Y seconds'], ['steps', 'Steps I define (a table)']] },
      { key: 'everyPoints', group: 'basics', label: 'Every how many points', type: 'number', default: 5, showIf: [{ timeRule: ['every'] }] },
      { key: 'everySeconds', group: 'basics', label: 'adds how many seconds', type: 'number', default: 5, showIf: [{ timeRule: ['every'] }] },
      { key: 'steps', group: 'basics', label: 'Steps: points=seconds, separated by commas (5=5, 10=12, 15=30). The highest step reached counts.', type: 'text', default: '5=5, 10=12, 15=30', showIf: [{ timeRule: ['steps'] }] },
      { key: 'types', group: 'special', label: 'Special penalties', type: 'penaltytypes', optional: true },
      { key: 'dqPoints', group: 'limits', label: 'Disqualify at this many points (empty = never)', type: 'number', optional: true },
      { key: 'fuelPoints', group: 'limits', label: 'Penalty points for every lap driven on an empty tank', type: 'number', optional: true, hint: 'Only for fuel setups where the car carries on when the fuel runs out. Empty or 0 = no points.' }
    ]
  },
  // Damage systems: the levels of damage a car can have, what each level asks of the pit stop, and the incidents the Race Director can give. Chosen per race setup.
  damagesystems: {
    label: 'Damage system', plural: 'Damage systems', title: ['name'], extra: false, linked: false, list: ['name', 'stop', 'deslotPoints'], card: ['stop', 'deslotPoints'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, the stop in the pits and the damage of a deslot', open: true },
      { id: 'levels', title: 'Levels', note: 'How much damage asks for which stop in the pits', open: true },
      { id: 'incidents', title: 'Incidents', note: 'What the Race Director can give a car with a button', open: true },
      { id: 'fines', title: 'Penalty points', note: 'For a stop that is late, and for leaving too early' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text' },
      { key: 'stop', group: 'basics', label: 'Repair and the other work in the stop', type: 'select', default: 'overlap',
        options: [['overlap', 'At the same time: the longest job counts (a repair of 15 seconds and refuelling for 8 seconds is 15 seconds)'], ['add', 'One after the other: the repair starts when the other work in the stop is done']],
        hint: 'The other work is refuelling and a driver swap by the sensor. Changing tyres takes no time.' },
      { key: 'deslotPoints', group: 'basics', label: 'Damage points for a deslot', type: 'number', min: 0, default: 1,
        hint: 'A lap slower than the deslot time of the track (Tracks > Lap time limits) gives this many damage points. 0 = none.' },
      { key: 'levels', group: 'levels', label: 'Levels', type: 'damagelevels', optional: true },
      { key: 'incidents', group: 'incidents', label: 'Incidents', type: 'damageincidents', optional: true },
      { key: 'latePoints', group: 'fines', label: 'Penalty points for every lap after the deadline of a level', type: 'number', min: 0, default: 1,
        hint: 'A level can say the car must be in the pits within some laps. It needs a penalty system in the race setup; without one the late lap is only called out. 0 = none.' },
      { key: 'earlyPoints', group: 'fines', label: 'Penalty points for leaving before the repair is done', type: 'number', min: 0, default: 1,
        hint: 'The damage stays. It needs a penalty system in the race setup. 0 = none.' }
    ]
  },
  // Weather systems: a spell of rain with a forecast, the tyres to change in the pits, and what the wrong tyres cost. Chosen per race setup.
  weathersystems: {
    label: 'Weather system', plural: 'Weather systems', title: ['name'], extra: false, linked: false, list: ['name', 'unit', 'startMode', 'rainMode'], card: ['unit', 'startMode', 'rainMode'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, and whether the weather is counted in laps or in minutes', open: true },
      { id: 'forecast', title: 'The rain', note: 'When it starts and how long it lasts, with the clouds before and the drying after', open: true },
      { id: 'tyres', title: 'Tyres and penalties', note: 'Which tyres a pit stop gives, and the points for staying on the wrong tyres', open: true },
      { id: 'hinder', title: 'Hindering the cars', note: 'How much slower the wrong tyres make a car (through its fuel use, refuelling and tank)' },
      { id: 'conditions', title: 'Track conditions', note: 'Track and air temperature, wind speed and direction for every weather state (shown by the Track Conditions widget, said by the audio)' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text' },
      { key: 'unit', group: 'basics', label: 'Counted in', type: 'select', default: 'laps', options: [['laps', 'Laps of the leader'], ['time', 'Minutes of racing']],
        hint: 'Laps: the weather changes when the leading car has driven that many laps. Minutes: it changes at that time in the race (a paused race does not count). Every number below is in laps or in minutes, as chosen here.' },
      { key: 'startMode', group: 'forecast', label: 'The rain starts', type: 'select', default: 'point', options: [['point', 'At a set moment'], ['random', 'At a random moment (between two limits)'], ['director', 'Only when the Race Director says so']],
        hint: 'A set or random moment: the forecast decides, and the Race Director only watches. Only when the Race Director says so: nothing happens by itself, he sets Dry, Cloudy, Wet or Clearing with the buttons on the Director page.' },
      { key: 'startAt', group: 'forecast', label: 'The rain starts after (laps or minutes)', type: 'number', min: 0, default: Wx.DEFAULTS.startAt, showIf: [{ startMode: ['point'] }],
        hint: 'Rain after 8 laps means after the leading car has completed 8 laps. 0 is rain from the start.' },
      { key: 'startFrom', group: 'forecast', label: 'The rain starts at the earliest after (laps or minutes)', type: 'number', min: 0, default: Wx.DEFAULTS.startFrom, showIf: [{ startMode: ['random'] }] },
      { key: 'startTo', group: 'forecast', label: 'The rain starts at the latest after (laps or minutes)', type: 'number', min: 0, default: Wx.DEFAULTS.startTo, showIf: [{ startMode: ['random'] }] },
      { key: 'rainMode', group: 'forecast', label: 'The rain lasts', type: 'select', default: 'fixed', options: [['fixed', 'A set time'], ['random', 'A random time (between two limits)']], showIf: [{ startMode: ['point', 'random'] }] },
      { key: 'rainFor', group: 'forecast', label: 'The rain lasts (laps or minutes)', type: 'number', min: 1, default: Wx.DEFAULTS.rainFor, showIf: [{ startMode: ['point', 'random'], rainMode: ['fixed'] }] },
      { key: 'rainMin', group: 'forecast', label: 'The rain lasts at least (laps or minutes)', type: 'number', min: 1, default: Wx.DEFAULTS.rainMin, showIf: [{ startMode: ['point', 'random'], rainMode: ['random'] }] },
      { key: 'rainMax', group: 'forecast', label: 'The rain lasts at most (laps or minutes)', type: 'number', min: 1, default: Wx.DEFAULTS.rainMax, showIf: [{ startMode: ['point', 'random'], rainMode: ['random'] }] },
      { key: 'cloudyFor', group: 'forecast', label: 'Cloudy before the rain (laps or minutes, 0 = none)', type: 'number', min: 0, default: Wx.DEFAULTS.cloudyFor, showIf: [{ startMode: ['point', 'random'] }],
        hint: 'The warning: the sky clouds over before the rain starts. A pit stop in Cloudy puts Wet (or Intermediate) tyres on the car. If the rain starts sooner than this, it is cloudy from the start.' },
      { key: 'clearingFor', group: 'forecast', label: 'Clearing after the rain (laps or minutes, 0 = none)', type: 'number', min: 0, default: Wx.DEFAULTS.clearingFor, showIf: [{ startMode: ['point', 'random'] }],
        hint: 'The rain has stopped and the track is drying. A pit stop in Clearing puts the dry tyres back (or Intermediate). Cars do not have to change yet.' },
      { key: 'sameInHeats', group: 'forecast', label: 'In every heat', type: 'select', default: 'same', options: [['same', 'The same weather in every heat'], ['new', 'New random weather in every heat']], showIf: [{ startMode: ['random'] }, { startMode: ['point'], rainMode: ['random'] }],
        hint: 'Only used when something is random. The same weather keeps the heats fair.' },
      { key: 'cloudyTyre', group: 'tyres', label: 'A pit stop in Cloudy gives', type: 'select', default: 'wet', options: [['wet', 'Wet tyres'], ['inter', 'Intermediate tyres']] },
      { key: 'clearingTyre', group: 'tyres', label: 'A pit stop in Clearing gives', type: 'select', default: 'dry', options: [['dry', 'The tyres of the car (dry)'], ['inter', 'Intermediate tyres']] },
      { key: 'react', group: 'tyres', label: 'Laps to change tyres when the weather asks for it', type: 'number', min: 0, default: Wx.DEFAULTS.react,
        hint: 'When it rains a car on dry tyres has to come into the pits within this many laps; when it is dry again a car on Wet or Intermediate tyres has to. A car that does not is given the points below. Cloudy and Clearing ask for nothing.' },
      { key: 'wetPoints', group: 'tyres', label: 'Penalty points for not switching to Wet tyres', type: 'number', min: 0, default: Wx.DEFAULTS.wetPoints, hint: 'Needs a penalty system in the race setup. Without one the car is only called out and hindered. 0 = no points.' },
      { key: 'dryPoints', group: 'tyres', label: 'Penalty points for not switching back to dry tyres', type: 'number', min: 0, default: Wx.DEFAULTS.dryPoints },
      { key: 'repeat', group: 'tyres', label: 'The points are given', type: 'select', default: 'once', options: [['once', 'Once'], ['every', 'For every lap until the car has changed tyres']] },
      { key: 'hinder', group: 'hinder', label: 'Hinder cars on the wrong tyres', type: 'select', default: 'on', options: [['on', 'Yes: they use more fuel and refuel slower (needs a Fuel setup)'], ['off', 'No']],
        hint: 'Works like Balance of Power: a hindered car uses more fuel a lap and refuels slower, and together with Balance of Power the percentages are added (never more than 90%). It stops when the car has the right tyres. Cars that are hindered are shown on the Director page.' },
      { key: 'hUse', group: 'hinder', label: 'Hinder the fuel use', type: 'select', default: 'on', options: [['on', 'Yes'], ['off', 'No']], showIf: [{ hinder: ['on'] }] },
      { key: 'hRate', group: 'hinder', label: 'Hinder the refuelling speed', type: 'select', default: 'on', options: [['on', 'Yes'], ['off', 'No']], showIf: [{ hinder: ['on'] }] },
      { key: 'hTank', group: 'hinder', label: 'Make the tank smaller', type: 'select', default: 'off', options: [['off', 'No'], ['on', 'Yes']], showIf: [{ hinder: ['on'] }] },
      ...WX_TABLE,
      ...WX_COND
    ]
  },
  // Timing page layouts, built in the layout editor (Customization > Layout Editor).
  layouts: { label: 'Layout', plural: 'Layouts', title: ['name'], internal: true, fields: [] },
  // Picture sets for the Fuel and Race flag widgets, made in Customization > Image Settings and chosen in the widget.
  audiosets: { label: 'Audio set', plural: 'Audio sets', title: ['name'], internal: true, fields: [] },
  customwidgets: { label: 'Custom widget', plural: 'Custom widgets', title: ['name'], internal: true, fields: [] },
  imagesets: { label: 'Image set', plural: 'Image sets', title: ['name'], internal: true, fields: [] },
  // Rotation setups (1.6.0): a heat plan made by hand, in Race Setup > Rotation Setups, and chosen in a race setup (see rotation.js).
  rotationsetups: { label: 'Rotation setup', plural: 'Rotation setups', title: ['name'], internal: true, fields: [] },
  // Leaderboard row designs, built in Customization > Leaderboard Editor.
  rowdesigns: { label: 'Row design', plural: 'Row designs', title: ['name'], internal: true, fields: [] },
  // Saved by the app itself while racing; never edited through forms.
  sessions: { label: 'Session', plural: 'Sessions', title: ['setupName'], internal: true, fields: [] },
  laps: { label: 'Lap', plural: 'Laps', title: ['lapNumber'], internal: true, fields: [] }
};
