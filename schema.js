// One definition per kind of item. To add a field, add one line to its `fields` list;
// forms, lists and the database file pick it up automatically (old data stays valid).
// type: text | longtext | number | date | choice | country | image | tracklength (metres, with a calculator) | gallery (extra pictures)
// the kinds of session that are raced (a Time Token Session has no start lights, laps, fuel or penalties)
const RACING = [{ sessionType: ['practice', 'qualifying', 'race', 'timed', 'heats'] }];
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
  racesetups: {
    label: 'Race setup', plural: 'Race setups', title: ['name'], extra: false, linked: false,
    // short list view, and grid cards that show the picture of the setup's track ('@limit' = laps or time, worked out by the screen)
    list: ['name', 'track', 'sessionType', '@limit'], card: ['sessionType', 'track', '@limit'], imageFrom: 'track',
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'session', title: 'Session', note: 'Name, kind of session and track', open: true },
      { id: 'length', title: 'Length and result', note: 'Laps or time, heats, how the race ends and is counted', open: true },
      { id: 'start', title: 'Start', note: 'Start lights, restarts and the first lap' },
      { id: 'rules', title: 'Penalties, fuel and pits', note: 'Penalty system, fuel setup and the pit stop sensor' },
      { id: 'screens', title: 'Screens and sound', note: 'Timing page layouts and the audio set' },
      { id: 'trackmate', title: 'Trackmate', note: 'Track power at the start and the Trackcall button' }
    ],
    // showIf: the field is shown when ANY listed condition matches (each condition: all its keys match).
    fields: [
      { key: 'name', group: 'session', label: 'Name', type: 'text' },
      { key: 'sessionType', group: 'session', label: 'Session type', type: 'select', default: 'race',
        options: [['practice', 'Free practice'], ['qualifying', 'Qualifying'], ['race', 'Race by laps'], ['timed', 'Timed race'], ['heats', 'Heat-based race'], ['tokens', 'Time Token Session']],
        hint: 'A Time Token Session runs for as long as you like. Each lane is switched on with paid time and turns red when the time is up. Its settings are in Race Setup > Time Tokens.' },
      { key: 'track', group: 'session', label: 'Track (sets the number of lanes)', type: 'ref', ref: 'tracks' },
      { key: 'heatBy', group: 'length', label: 'Each heat is limited by', type: 'select', default: 'laps',
        options: [['laps', 'Number of laps'], ['time', 'Duration']], showIf: [{ sessionType: ['heats'] }],
        hint: 'Number of laps: a heat ends when the cars have driven that many laps. Duration: every heat runs for the same time.' },
      { key: 'heatPlan', group: 'length', label: 'How the heats are planned', type: 'select', default: 'manual',
        options: [['manual', 'I choose the number of heats'], ['perdriver', 'Every driver races the same number of heats (I choose how many)'], ['roundrobin', 'Round robin: every driver meets every other driver'], ['rotation', 'Lane rotation: every driver races once in every lane']], showIf: [{ sessionType: ['heats'] }],
        hint: 'I choose: the drivers are spread over the number of heats you type below. Same number of heats: you say how many heats every driver races, and the number of heats follows from that. Round robin: as many heats as it takes for every pair of drivers to race in the same heat at least once. Lane rotation: every driver races once in every lane, against as many different drivers as possible. The plan is shown on the Home tab before you start, and that is the plan that is raced.' },
      { key: 'heats', group: 'length', label: 'How many heats', type: 'number', default: 3, showIf: [{ sessionType: ['heats'], heatPlan: ['manual'] }],
        hint: 'The drivers are spread over the heats, so every driver races about the same number of heats: if the heats do not divide evenly over the drivers, some drivers race one heat more (the Home tab shows who).' },
      { key: 'heatsEach', group: 'length', label: 'Heats for every driver', type: 'number', default: 3, min: 1, showIf: [{ sessionType: ['heats'], heatPlan: ['perdriver'] }],
        hint: 'Every driver races exactly this many heats. The number of heats follows: with 7 drivers on 4 lanes and 3 heats each there are 6 heats (21 places), some of them with one car fewer.' },
      { key: 'heatEven', group: 'length', label: 'Same number of heats for everyone', type: 'select', default: 'no', options: [['no', 'No: the fewest heats that make every pair meet'], ['yes', 'Yes: add a few heats until everyone has raced as many as the busiest driver']], showIf: [{ sessionType: ['heats'], heatPlan: ['roundrobin'] }],
        hint: 'A round robin often gives some drivers one heat more than others, and the overall result adds the heats up. Yes adds the few heats that make it equal.' },
      { key: 'heatSeeding', group: 'length', label: 'Who races together', type: 'select', default: 'random', options: [['random', 'Shuffled'], ['mixed', 'Mixed by the latest qualifying: every heat has fast and slow drivers'], ['speed', 'By the latest qualifying: the fastest drivers race together, the best heat last']], showIf: [{ sessionType: ['heats'], heatPlan: ['manual', 'perdriver'] }],
        hint: 'Mixed and By qualifying use the latest qualifying on the track of this setup (Home tells you when there is none: then the drivers are shuffled). Drivers who did not take part in it are placed last. Round robin and lane rotation always shuffle: they choose the heats to make everybody meet.' },
      { key: 'laps', group: 'length', label: 'Number of laps', type: 'number', default: 10,
        showIf: [{ sessionType: ['race'] }, { sessionType: ['heats'], heatBy: ['laps'] }] },
      { key: 'duration', group: 'length', label: 'Duration (minutes)', type: 'number', default: 5,
        showIf: [{ sessionType: ['qualifying', 'timed'] }, { sessionType: ['heats'], heatBy: ['time'] }] },
      { key: 'endRule', group: 'length', label: 'The race ends', type: 'select', default: 'all',
        options: [['all', 'When every car has finished'], ['leader', 'When the lead car finishes']],
        showIf: [{ sessionType: ['race'] }, { sessionType: ['heats'], heatBy: ['laps'] }] },
      { key: 'resultBy', group: 'length', label: 'Overall result counted by', type: 'select', default: 'laps',
        options: [['laps', 'Total laps'], ['points', 'Points']], showIf: [{ sessionType: ['heats'] }],
        hint: 'Total laps: the driver with the most laps wins. Points: every heat gives points for the position, and the most points wins. How the heats are added up, and what decides a tie, is set below.' },
      { key: 'points', group: 'length', label: 'Points per position (1st first, separated by commas)', type: 'numberlist', default: '10, 8, 6, 5, 4, 3, 2, 1',
        showIf: [{ sessionType: ['heats'], resultBy: ['points'] }],
        hint: 'For example 10, 8, 6 gives the winner of a heat 10 points, the second 8 and the third 6. Positions further down get nothing.' },
      { key: 'countBy', group: 'length', label: 'How the heats are added up', type: 'select', default: 'total',
        options: [['total', 'All heats added up'], ['average', 'The average per heat'], ['best', 'Only the best heats of every driver count']], showIf: [{ sessionType: ['heats'] }],
        hint: 'All heats added up: a driver who races a heat more has an advantage. The average per heat is fair when drivers race a different number of heats (the Home tab shows when they do). Only the best heats: every driver counts the best few of their heats (you choose how many below), so a bad heat does not matter.' },
      { key: 'bestHeats', group: 'length', label: 'Heats that count', type: 'number', default: 2, min: 1, showIf: [{ sessionType: ['heats'], countBy: ['best'] }],
        hint: 'The best heats of every driver that count: the best by laps (or by points, for a result by points). A driver who raced fewer heats than this has them all counted, which is less than the others.' },
      { key: 'dropWorst', group: 'length', label: 'Drop the worst heat', type: 'select', default: 'no', options: [['no', 'No: every heat counts'], ['yes', 'Yes: the worst heat of every driver does not count']], showIf: [{ sessionType: ['heats'] }],
        hint: 'Takes away the worst heat of every driver who raced at least two heats, before the rest is counted. A worse heat is one with fewer laps (or fewer points). It is fairest when everybody races the same number of heats.' },
      { key: 'fastestBonus', group: 'length', label: 'Bonus points for the fastest lap of a heat', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['heats'], resultBy: ['points'] }],
        hint: 'The driver with the fastest lap of a heat gets these extra points in that heat (0 is no bonus). The bonus is part of the points of the heat, so it also counts when you drop the worst heat or count only the best heats.' },
      { key: 'tieBreak', group: 'length', label: 'A tie is decided by', type: 'select', default: 'default',
        options: [['default', 'The other measure (laps or points), then the fastest lap'], ['bestlap', 'The fastest lap first'], ['wins', 'The most heat wins first'], ['time', 'The lowest total time first']], showIf: [{ sessionType: ['heats'] }],
        hint: 'Drivers with the same result are put in this order. The lowest total time is the time of the heats that count, which is only fair for drivers who drove the same number of laps. If they are still equal, the other things follow in the order of the standard.' },
      { key: 'finals', group: 'length', label: 'Finals after the heats', type: 'select', default: 'none',
        options: [['none', 'No finals: the heats are the race'], ['a', 'A final (the best drivers of the heats)'], ['ab', 'A final and a B final (the next drivers, who race first)']], showIf: [{ sessionType: ['heats'] }],
        hint: 'After the last heat the best drivers of the heat result race a final, with as many drivers as the track has lanes. A B final is the next group (when at least two drivers are left) and is raced before the A final. In a final the best-placed driver chooses a lane first, then the next one, and so on. Who is in a final is only known after the heats, so the Home tab shows a note about the finals and no names.' },
      { key: 'finalMode', group: 'length', label: 'What the finals decide', type: 'select', default: 'places',
        options: [['places', 'The finals decide the final places: the heat result only decides who is in which final'], ['added', 'The result of the final is added to the heat result']], showIf: [{ sessionType: ['heats'], finals: ['a', 'ab'] }],
        hint: 'The first: the final A decides places 1 to 4 (or as many as the track has lanes), the B final the places after them, the others follow in the order of the heats. The second: what a driver scores in the final (laps, or points from the same list as a heat) is added to the result of the heats. It is not averaged and never dropped. In both cases the drivers of the A final stay above the drivers of the B final.' },
      { key: 'finalLaps', group: 'length', label: 'Laps in a final (0 = as many as a heat)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['heats'], heatBy: ['laps'], finals: ['a', 'ab'] }],
        hint: 'Every final has this many laps. 0 is the same number of laps as a heat.' },
      { key: 'finalDuration', group: 'length', label: 'Duration of a final in minutes (0 = as long as a heat)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['heats'], heatBy: ['time'], finals: ['a', 'ab'] }],
        hint: 'Every final runs this long. 0 is the same time as a heat.' },
      { key: 'breakSeconds', group: 'length', label: 'Break between heats (seconds)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['heats'] }],
        hint: 'After a heat the race waits this long before the next heat can start, and counts down on the race screen (the Race Info widget and the phone page show "next heat in 1:30"). 0 is no break timer: the race just waits until you press Start, as before. Start (or Space) always starts the next heat at once, also during the break.' },
      { key: 'breakAuto', group: 'length', label: 'When the break is over', type: 'select', default: 'no', options: [['no', 'Wait: I press Start for the next heat'], ['yes', 'The start lights begin by themselves']], showIf: [{ sessionType: ['heats'] }],
        hint: 'Only used when there is a break (above). "The start lights begin by themselves" runs the same start as pressing Start: the pre-race call (if the race has an audio set) and the lights. Stop still ends the race.' },
      { key: 'lightsMin', group: 'start', label: 'Start lights: shortest wait before lights out (seconds)', type: 'number', default: 1, showIf: RACING },
      { key: 'lightsMax', group: 'start', label: 'Start lights: longest wait before lights out (seconds)', type: 'number', default: 5, showIf: RACING },
      { key: 'lightsAfter', group: 'start', label: 'Start lights after the race has started', type: 'select', default: 'out',
        options: [['out', 'They go out'], ['flags', 'They follow the race flag: green while racing, yellow after a yellow flag, red after a red flag']], showIf: RACING },
      { key: 'restartAfterRed', group: 'start', label: 'Restarting after a red flag', type: 'select', default: 'countdown',
        options: [['countdown', 'The start lights count down again, then the race goes on'], ['resume', 'The race goes on at once']], showIf: RACING },
      { key: 'firstLap', group: 'start', label: 'First crossing of the start line', type: 'select', default: 'skip',
        options: [['skip', 'Only starts the timing: the short lap from the grid is not counted'], ['count', 'Counts as a lap']], showIf: RACING },
      { key: 'penaltySystem', group: 'rules', label: 'Penalty system', type: 'ref', ref: 'penaltysystems', blank: 'No penalties', showIf: RACING },
      { key: 'fuelRules', group: 'rules', label: 'Fuel setup', type: 'ref', ref: 'fuelrules', blank: 'No fuel', showIf: RACING },
      { key: 'pitHold', group: 'rules', label: 'Pit stop: the sensor must be blocked this long to start a stop (seconds)', type: 'number', default: 2, showIf: RACING },
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
  // Timing page layouts, built in the layout editor (Customization > Layout Editor).
  layouts: { label: 'Layout', plural: 'Layouts', title: ['name'], internal: true, fields: [] },
  // Picture sets for the Fuel and Race flag widgets, made in Customization > Image Settings and chosen in the widget.
  audiosets: { label: 'Audio set', plural: 'Audio sets', title: ['name'], internal: true, fields: [] },
  customwidgets: { label: 'Custom widget', plural: 'Custom widgets', title: ['name'], internal: true, fields: [] },
  imagesets: { label: 'Image set', plural: 'Image sets', title: ['name'], internal: true, fields: [] },
  // Leaderboard row designs, built in Customization > Leaderboard Editor.
  rowdesigns: { label: 'Row design', plural: 'Row designs', title: ['name'], internal: true, fields: [] },
  // Saved by the app itself while racing; never edited through forms.
  sessions: { label: 'Session', plural: 'Sessions', title: ['setupName'], internal: true, fields: [] },
  laps: { label: 'Lap', plural: 'Laps', title: ['lapNumber'], internal: true, fields: [] }
};
