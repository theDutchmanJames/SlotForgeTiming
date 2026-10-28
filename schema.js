// One definition per kind of item. To add a field, add one line to its `fields` list;
// forms, lists and the database file pick it up automatically (old data stays valid).
// A field with unit: 'm' or 'mm' holds a length (kept in metres or millimetres). When the distance unit is feet and miles (1.27.0) it is typed in feet or inches; labelFt and hintFt are its words then.
// type: text | longtext | number | date | choice | country | image | tracklength (metres, with a calculator) | gallery (extra pictures)
// the kinds of session that are raced (a Time Token Session has no start lights, laps, fuel or penalties)
const RACING = [{ sessionType: ['practice', 'qualifying', 'race', 'heats', 'endurance'] }];
// the same, in a race setup that has no safety car system (a system replaces the Yellow flag settings: 1.53.0)
const NO_SAFETYCAR = [{ sessionType: ['practice', 'qualifying', 'race', 'heats', 'endurance'], safetyCar: [''] }];
// a heat-based race: a Heat-based race, or an Endurance Race that is heat-based (extra: the other conditions that must match)
const HEATED = (extra = {}) => [{ sessionType: ['heats'], ...extra }, { sessionType: ['endurance'], enduranceBy: ['heats'], ...extra }];
// a race that is limited by a distance (1.35.0): a race, heats or an Endurance Race (one long race, or heat-based) set to Distance (extra: the other conditions that must match)
const DIST = (extra = {}) => [{ sessionType: ['race'], raceBy: ['distance'], ...extra }, { sessionType: ['heats'], heatBy: ['distance'], ...extra }, { sessionType: ['endurance'], enduranceBy: ['distance'], ...extra }, { sessionType: ['endurance'], enduranceBy: ['heats'], heatBy: ['distance'], ...extra }];
const Wx = require('./renderer/weather.js'); // the tyres, the standard settings and the hindrance table of a weather system (one place for them)
const Tw = require('./renderer/tyrewear.js'); // the standard numbers of a tyre wear system (one place for them)
const Sc = require('./renderer/safetycar.js'); // the standard numbers of a safety car system (one place for them)
const Ps = require('./renderer/pushsave.js'); // the standard numbers and the ready-made systems of a push and save system (one place for them)
// the 12 numbers of the hindrance table of a weather system: the weather state by the kind of tyre
const WX_TABLE = [];
Wx.STATES.forEach(([state, stateName]) => Wx.CLASSES.forEach(cls => WX_TABLE.push({ key: Wx.HKEYS[state + '/' + cls], group: 'hinder', ui: 'cell', type: 'number', min: 0, default: Wx.TABLE[state][cls],
  label: `${stateName} weather, ${cls === 'dry' ? 'dry' : cls === 'inter' ? 'Intermediate' : 'Wet'} tyres (% hindered)`, showIf: [{ hinder: ['on'] }] })));
// The conditions on the track for every weather state (track temperature, air temperature, wind speed, wind direction): the Track Conditions widget shows them and the audio says them
const WX_COND = [{ key: 'units', group: 'conditions', label: 'Units', ui: 'seg', type: 'select', default: Wx.DEFAULTS.units, options: [['metric', 'Celsius and km/h'], ['imperial', 'Fahrenheit and mph']],
  hint: 'The numbers below are in these units (changing the units does not convert them). A Track Conditions widget can show the other units.' }];
Wx.STATES.forEach(([state, stateName]) => Wx.COND_ITEMS.forEach(([item, , itemName]) => WX_COND.push({ key: Wx.CKEYS[state + '/' + item], group: 'conditions', ui: 'cell', type: 'number', ...(item === 'wind' ? { min: 0 } : item === 'dir' ? { min: 0, max: 359 } : {}), default: Wx.COND[state][item],
  label: `${stateName}: ${itemName.toLowerCase()}${item === 'dir' ? ' (degrees, where the wind comes from)' : ''}`, ...(item === 'dir' && state === 'dry' ? { hint: 'Where the wind comes from: 0 is north, 90 east, 180 south, 270 west.' } : {}) })));
module.exports = {
  tracks: {
    label: 'Track', plural: 'Tracks', title: ['name'], image: 'picture', card: ['lanes', 'scale', 'surface', 'targetLap'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, number of lanes, scale and surface', open: true },
      { id: 'length', title: 'Length and lanes', note: 'How long the track is, and how the lanes differ in length', open: true },
      { id: 'sectors', title: 'Sectors', note: 'Parts of the track, to say where a car that did not finish was last seen' },
      { id: 'laps', title: 'Lap timing', note: 'A fuel reference lap time, faulty triggers and very slow laps' },
      { id: 'extras', title: 'Picture and notes', note: 'A picture for the lists and cards, and your own notes' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text' },
      { key: 'lanes', group: 'basics', label: 'Number of lanes', type: 'number', min: 1, step: 1 },
      { key: 'scale', group: 'basics', label: 'Scale', type: 'choice', options: ['1:24', '1:32', '1:43', 'HO'], allowOther: true },
      { key: 'surface', group: 'basics', label: 'Track Surface', type: 'text' },
      { key: 'length', group: 'length', label: 'Track length (metres)', labelFt: 'Track length (feet)', unit: 'm', type: 'tracklength', optional: true, hint: 'The length of the outside lane if you use the Lane length modifier below, otherwise the length of every lane.' },
      { key: 'laneModifier', group: 'length', label: 'Lane length modifier', type: 'select', default: 'none', options: [['none', 'None: every lane has the track length'], ['bends', 'Calculated from the bends (loop, or enter the full turns)'], ['measured', 'Measured: I enter the length of every lane']], optional: true, hint: 'The lanes of a track are not equally long. The speed uses the length of the car\'s own lane.' },
      { key: 'outsideLane', group: 'length', label: 'The track length is that of', type: 'select', default: 'last', options: [['last', 'The last lane (the outside lane)'], ['first', 'The first lane (the outside lane)']], optional: true, showIf: [{ laneModifier: ['bends'] }] },
      { key: 'laneSpacing', group: 'length', label: 'Distance between the lanes (millimetres, centre to centre)', labelFt: 'Distance between the lanes (inches, centre to centre)', unit: 'mm', type: 'number', min: 0, default: 100, optional: true, showIf: [{ laneModifier: ['bends'] }], hint: 'Each lane further in is 2 \u00d7 \u03c0 (about 6.3) times this distance shorter for every full turn of the track: 100 mm gives 0.63 m shorter per lane on a loop.', hintFt: 'Each lane further in is 2 \u00d7 \u03c0 (about 6.3) times this distance shorter for every full turn of the track: 4 inches gives about 2 feet shorter per lane on a loop.' },
      { key: 'netTurns', group: 'length', label: 'Full turns the track makes (left bends minus right bends)', type: 'number', min: 0, step: 1, default: 1, optional: true, showIf: [{ laneModifier: ['bends'] }], hint: 'It is the angle of the bends that counts, not how many there are: a circuit that does not cross itself is 1 turn, whatever the mix of left and right bends. 0 is a figure-eight (all lanes equally long), 2 is for instance two loops the same way round that cross over each other with a bridge.' },
      { key: 'laneLengths', group: 'length', label: 'Length of every lane (metres), lane 1 first', labelFt: 'Length of every lane (feet), lane 1 first', unit: 'm', type: 'numberlist', default: '', optional: true, showIf: [{ laneModifier: ['measured'] }], hint: 'One number per lane, separated by commas, with a dot for decimals: for example 15.4, 15.8, 16.2. Use this when the lanes swap sides, the spacing is not the same everywhere, or you measured them.', hintFt: 'One number per lane, separated by commas, with a dot for decimals: for example 50.5, 51.8, 53.1. Use this when the lanes swap sides, the spacing is not the same everywhere, or you measured them.' },
      { key: 'sectors', group: 'sectors', label: 'Number of sectors', type: 'number', min: 0, max: 12, step: 1, optional: true,
        hint: 'Sector 1 starts at the timing line, and the sectors follow in the order the cars drive them. When a race ends before every car has finished (the lead car finished, or the Race Director stopped it), the review before Finalize lets you say in which sector each car that did not finish was last seen: of two cars with the same laps, the one in the later sector ranks higher. Empty, 0 or 1 = no sectors.' },
      { key: 'sectorNames', group: 'sectors', label: 'Names of the sectors (optional)', type: 'text', optional: true,
        hint: 'One name per sector, in driving order, separated by commas: Start straight, Hairpin, Back straight. A sector without a name is called Sector 3 and so on.' },
      { key: 'targetLap', group: 'laps', label: 'Fuel reference lap time', type: 'number', suffix: 'seconds', min: 0, optional: true, hint: 'A typical clean lap on this track. Used by the Track target calculation in App Settings, by setup previews, and by Fuel Systems for legacy Push & Save. It never rejects, slows or otherwise changes a measured lap. Leave empty when this track has no reference yet.' },
      { key: 'minLap', group: 'laps', label: 'Minimum lap time (seconds)', type: 'number', min: 0, optional: true, hint: 'A crossing sooner than this after the last one is ignored (faulty trigger).' },
      { key: 'maxLap', group: 'laps', label: 'Maximum lap time (seconds)', type: 'number', min: 0, optional: true, hint: 'A slower lap still counts as a lap, but not for best laps and records.' },
      { key: 'deslotTime', group: 'laps', label: 'Deslot time (seconds)', type: 'number', min: 0, optional: true, hint: 'A lap slower than this counts as a deslot. In a race with a Damage System a deslot gives the car damage points (set under Race Setup > Damage Systems). Empty or 0 = no automatic deslots.' },
      { key: 'picture', group: 'extras', label: 'Picture', type: 'image', optional: true },
      { key: 'notes', group: 'extras', label: 'Notes', type: 'longtext', optional: true }
    ]
  },
  slotcars: {
    label: 'Slot car', plural: 'Slotcars', title: ['brand', 'manufacturer', 'model'], image: 'picture', gallery: 'extraPictures', card: ['scale', 'motor', 'tyres', 'lapsDriven'], // (1.30.0: the Statistics folder has the service interval, Laps Driven, Laps Since Last Interval, Last Serviced and (in the form) the Mileage)
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Brand, manufacturer, model and scale', open: true },
      { id: 'technical', title: 'Technical details', note: 'Motor, tyres, gearing and weight', open: true },
      { id: 'pictures', title: 'Pictures', note: 'The main picture, and more pictures of the chassis and parts' },
      { id: 'stats', title: 'Statistics', note: 'The service interval, the services done, and the laps, mileage, wins and best laps counted from your races' }
    ],
    fields: [
      { key:'raceClass',group:'basics',label:'Race Class',type:'ref',ref:'raceclasses',createClass:true,blank:'No class selected',hint:'Label this car, for example GT3 or Prototype. Choose a class or create one here. Multi-Class setups list the classes used by your slotcars, then assign drivers to them. On Home, a driver can only choose a car in their assigned class.' },
      { key: 'brand', group: 'basics', label: 'Brand', type: 'text' },
      { key: 'manufacturer', group: 'basics', label: 'Manufacturer', type: 'text' },
      { key: 'model', group: 'basics', label: 'Model', type: 'text' },
      { key: 'scale', group: 'basics', label: 'Scale', type: 'choice', options: ['1:24', '1:32', '1:43', 'HO'], allowOther: true },
      { key: 'motor', group: 'technical', label: 'Motor', type: 'text' },
      { key: 'tyres', group: 'technical', label: 'Tyres', type: 'text' },
      { key: 'tyreCompound', group: 'technical', label: 'Tyre choice (for the Weather System)', type: 'select', default: Wx.DEFAULT_TYRE, options: Wx.TYRES.map(t => [t.code, `${t.name} (${t.code})`]),
        hint: 'The tyre this car races on (when the track is dry, in a race with a Weather System). There a pit stop changes it to Wet (or Intermediate) when it rains, and back to this one when the track is dry again. The Race Director can give a car another tyre during any race (in the Tyre Change folder), for that race only or here too.' },
      { key: 'damageFactor', group: 'technical', label: 'Damage factor (for the Damage System)', type: 'number', min: 0, step: 'any', default: 1, optional: true,
        hint: '1 = like the other cars. A fragile car collects damage points faster (1.5: half as many again), a sturdy one slower (0.5); 0 = it never takes damage. Only used in a race with a Damage System.' },
      { key: 'failureFactor', group: 'technical', label: 'Failure factor (for Car Failures)', type: 'number', min: 0, step: 'any', default: 1, optional: true,
        hint: '1 = like the other cars. A tired old car has more failures (2: twice the chance of every failure), a reliable one fewer (0.5); 0 = it never has a failure. Only used in a race with a Damage System that has Car Failures switched on.' },
      { key: 'gearing', group: 'technical', label: 'Gearing', type: 'text' },
      { key: 'weight', group: 'technical', label: 'Weight', type: 'text' },
      { key: 'picture', group: 'pictures', label: 'Main picture', type: 'image', optional: true },
      { key: 'extraPictures', group: 'pictures', label: 'More pictures (chassis, parts list…)', type: 'gallery', optional: true },
      { key: 'serviceInterval', group: 'stats', label: 'Service Interval', type: 'number', min: 1, step: 1, optional: true,
        hint: 'The number of laps after which this car needs servicing. Leave it empty for no service interval.' },
      { key: 'lapsDriven', group: 'stats', label: 'Laps Driven', type: 'number', min: 0, step: 1, default: 0,
        hint: 'Every lap saved with this car is counted from your races. You can also type the number yourself, for example for an old car that has driven laps already: it counts on from there. Laps Since Last Interval and the mileage do not change with it.' },
      { key: 'lapsSinceService', group: 'stats', label: 'Laps Since Last Interval', type: 'number', automatic: true, reset: true,
        hint: 'The laps saved with this car since it was last serviced. Press Reset when you have serviced the car: the count starts again at 0 (when you save).' },
      { key: 'serviceDate', group: 'stats', label: 'Last Serviced', type: 'datetime', automatic: true, hint: 'The day you pressed Reset (Never until then).' },
      { key: 'servicesDone', group: 'stats', label: 'Services Done', type: 'number', automatic: true, hint: 'How many times you pressed Reset when you saved. A car that was serviced before this count existed counts as 1.' }
    ]
  },
  drivers: {
    label: 'Driver', plural: 'Drivers', title: ['name'], image: 'avatar', card: ['nickname', 'callsign', 'flag'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, nickname and the three-letter callsign', open: true },
      { id: 'virtualrival', title: 'Virtual Rival', note: 'The recorded sequence loaded when this virtual driver is selected', open: true },
      { id: 'personal', title: 'Personal details', note: 'Date of birth and country flag', open: true },
      { id: 'avatar', title: 'Avatar', note: 'The picture on driver cards and timing screens' }
    ],
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text' },
      { key: 'nickname', group: 'basics', label: 'Nickname', type: 'text' },
      { key: 'callsign', group: 'basics', label: 'Callsign (3 letters)', type: 'text', maxLength: 3, uppercase: true },
      { key: 'driverType', group: 'basics', label: 'Driver type', type: 'select', default: 'human', options: [['human', 'Human'], ['virtual', 'Virtual']], hint: 'Choose a virtual driver in a Home lane row, then choose its Rival Setup instead of a car. Its replay ignores sensor input. Use a separate identity to keep human records unchanged.' },
      { key:'raceClass',group:'basics',label:'Default racing class (physical racing)',type:'ref',ref:'raceclasses',showIf:[{driverType:['human','']}],hint:'Used by Multi-Class Systems that assign classes by driver. Virtual replays do not earn class points.' },
      { key: 'virtualRivalSystem', group: 'virtualrival', label: 'Virtual Rival System', type: 'ref', ref: 'virtualrivalsystems', showIf: [{ driverType: ['virtual'] }], hint: 'Selecting this driver on Home loads this system. Create or edit systems under Race Setup > Virtual Rival Systems.' },
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
      {key:'raceClass',group:'basics',label:'Default racing class',type:'ref',ref:'raceclasses',blank:'Choose on Home',hint:'Used by Multi-Class Systems that assign classes by team.'},
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
      { id: 'heats', title: 'Heats', note: 'Who races, how the heats are planned and when they start', open: true },
      { id: 'length', title: 'Race Settings', note: 'Race length, winner, starts, pit entry and the Track Call button', open: true },
      { id: 'endurance', title: 'Driver swaps', note: 'When a team swaps drivers in the pits, who steps in, and what a swap that is not made costs' },
      { id: 'service', title: 'Service Stop', note: 'An optional timed stop for working on the car, even without any race systems' },
      { id: 'rules', title: 'Rules and Systems', note: 'Choose the systems for this race, then turn each one on or off' },
      { id: 'screens', title: 'Race UI and Audio', note: 'Timing Page layouts and the Audio Set' },
      { id: 'trackmate', title: 'Timing hardware', note: 'Track power at the start; Track Call is set in Race Settings' },
      { id: 'box', title: 'SlotForge box (Arduino)', note: 'Pit stops, lane power, beeps and lane lights, when a SlotForge box is connected' }
    ],
    // The form of a race setup has a rail (1.71.0, renderer/railform.js): the sections that the person sees, in this order. A section is made of one or more of the groups above (Advanced holds four: the
    // timing hardware and the SlotForge box). ask: what the section answers, shown while it is open; icon: the picture on its row; open: open when the form opens;
    // optional: it is listed under "Only if you need it". Nothing here changes where a setting is stored: a setting still says which group it is in.
    rail: [
      { id: 'session', title: 'Session', ask: 'What are you setting up?', icon: 'racesetups', open: true, groups: ['session'] },
      { id: 'heats', title: 'Heats', ask: 'Who races, and when?', icon: 'layers', open: true, groups: ['heats'] },
      { id: 'length', title: 'Race Settings', ask: 'How does this race run, start and respond to Track Call?', icon: 'board', open: true, groups: ['length'] },
      { id: 'endurance', title: 'Driver swaps', ask: 'When do the drivers of a team swap?', icon: 'rotation', groups: ['endurance'] },
      { id: 'rules', title: 'Rules and Systems', ask: 'Which systems are selected and enabled?', icon: 'shield', groups: ['rules'] },
      { id: 'service', title: 'Service Stop', ask: 'Can the car be removed for service?', icon: 'sliders', groups: ['service'] },
      { id: 'screens', title: 'Race UI and Audio', ask: 'What do the race screens show and say?', icon: 'screen', groups: ['screens'] },
      { id: 'advanced', title: 'Advanced', ask: 'Timing hardware and the SlotForge box.', icon: 'sliders', optional: true, groups: ['trackmate', 'box'] }
    ],
    // showIf: the field is shown when ANY listed condition matches (each condition: all its keys match).
    fields: [
      { key: 'name', group: 'session', label: 'Name', type: 'text', placeholder: 'Name this race setup' },
      { key: 'sessionType', group: 'session', label: 'Session type', ask: 'Kind of session', ui: 'kind', type: 'select', default: 'race',
        options: [['practice', 'Free practice'], ['qualifying', 'Qualifying'], ['race', 'Race'], ['heats', 'Heat-based race'], ['endurance', 'Endurance Race'], ['tokens', 'Time Token Session']],
        hint: 'A Time Token Session is not a race: each lane is switched on with paid time and turns red when the time is up (its settings are in Race Setup > Time Tokens). With Heats and swaps, every heat is a race with driver swaps of its own; the drivers who start a heat are chosen as in a heat race with teams.' },
      { key: 'track', group: 'session', label: 'Track', type: 'ref', ref: 'tracks', featured: true,
        hint: 'The track decides how many lanes there are. Its lane count is shown right below your choice.' },
      { key: 'rotation', group: 'heats', label: 'Rotation setup', type: 'ref', ref: 'rotationsetups', blank: 'None: plan the heats from the settings below', showIf: HEATED(),
        hint: 'A heat plan that you made yourself in Race Setup > Rotation Setups: which participant races in which heat and in which lane. With one chosen, the settings that plan the heats (up to "Who races together") are not used. Everything about how the result is counted still is.' },
      { key: 'participants', group: 'heats', label: 'The heats are raced by', ui: 'seg', type: 'select', default: 'drivers', options: [['drivers', 'Drivers'], ['teams', 'Teams']], showIf: [{ sessionType: ['heats'], rotation: [''] }],
        hint: 'Teams are made under Database > Teams. On Home you choose a team and a car for every team, and the drivers of a team take turns, one driver in every heat. With a rotation setup the rotation says whether the participants are drivers or teams.' },
      { key: 'teamDriver', group: 'heats', label: 'Which driver of a team drives a heat', ui: 'seg', type: 'select', default: 'order', options: [['order', 'In turn'], ['random', 'By lot'], ['chosen', 'I choose']], showIf: HEATED(),
        hint: 'In turn follows the order of the team in the database. By lot picks the driver who drove the fewest heats. I choose lets you pick before every heat (the next one in turn is suggested). Only used when the participants are teams.' },
      { key: 'heatPlan', group: 'heats', label: 'How the heats are planned', ui: 'cards', type: 'select', default: 'manual',
        options: [['manual', 'A number I choose', 'You set how many heats there are.'], ['perdriver', 'Same for every driver', 'You set how many heats each driver races.'], ['roundrobin', 'Everyone meets everyone', 'Round robin: every pair of drivers races together.'], ['rotation', 'Every lane once', 'Every driver races once in every lane.']], showIf: HEATED({ rotation: [''] }),
        hint: 'The plan is shown on the Home tab before you start, and that is the plan that is raced.' },
      { key: 'heats', group: 'heats', label: 'Number of heats', type: 'number', default: 3, showIf: HEATED({ rotation: [''], heatPlan: ['manual'] }),
        hint: 'The drivers are spread over the heats, so every driver races about the same number of heats: if the heats do not divide evenly over the drivers, some drivers race one heat more (the Home tab shows who).' },
      { key: 'heatsEach', group: 'heats', label: 'Heats per driver', type: 'number', default: 3, min: 1, showIf: HEATED({ rotation: [''], heatPlan: ['perdriver'] }),
        hint: 'Every driver races exactly this many heats. The number of heats follows: with 7 drivers on 4 lanes and 3 heats each there are 6 heats (21 places), some of them with one car fewer.' },
      { key: 'heatEven', group: 'heats', label: 'Give everyone the same number of heats', ui: 'switch', on: 'yes', type: 'select', default: 'no', options: [['no', 'No'], ['yes', 'Yes']], showIf: HEATED({ rotation: [''], heatPlan: ['roundrobin'] }),
        hint: 'Off: the fewest heats that make every pair meet. A round robin often gives some drivers one heat more than others, and the overall result adds the heats up. On adds a few heats until everyone has raced as many as the busiest driver.' },
      { key: 'heatSeeding', group: 'heats', label: 'Who races together', ui: 'seg', full: true, type: 'select', default: 'random', options: [['random', 'Shuffled'], ['mixed', 'Mixed fast and slow'], ['speed', 'Fastest together, best heat last']], showIf: HEATED({ rotation: [''], heatPlan: ['manual', 'perdriver'] }),
        hint: 'Mixed fast and slow and Fastest together use the latest qualifying on this track (Home tells you when there is none: then the drivers are shuffled). Drivers who did not take part come last. Round robin and lane rotation always shuffle.' },
      { key: 'breakSeconds', group: 'heats', label: 'Break between heats (seconds)', type: 'number', default: 0, min: 0, showIf: HEATED(),
        hint: 'After a heat the race waits this long before the next heat can start, and counts down on the race screen (the Race Info widget and the phone page show "next heat in 1:30"). 0 is no break timer: the race just waits until you press Start, as before. Start (or Space) always starts the next heat at once, also during the break.' },
      { key: 'breakAuto', group: 'heats', label: 'The start lights begin by themselves when the break is over', ui: 'switch', on: 'yes', type: 'select', default: 'no', options: [['no', 'No'], ['yes', 'Yes']], showIf: HEATED(),
        hint: 'Off: you press Start for the next heat. Only used when there is a break (above). On runs the same start as pressing Start: the pre-race call (if the race has an audio set) and the lights. Stop still ends the race.' },
      { key: 'raceBy', group: 'length', label: 'The race is over after', ui: 'seg', type: 'select', default: 'laps', options: [['laps', 'Laps'], ['time', 'Time'], ['distance', 'Distance']], showIf: [{ sessionType: ['race'] }],
        hint: 'Time: every car finishes on its next crossing of the line after the time is up (that lap still counts), and the most laps wins (with equal laps, the lowest total time). Distance needs the lane lengths of the track (Database > Tracks): a car in a shorter lane drives more laps.' },
      { key: 'enduranceBy', group: 'length', label: 'The race is over after', ui: 'seg', offer: ['laps', 'time', 'distance'], type: 'select', default: 'time',
        options: [['time', 'Time'], ['laps', 'Laps'], ['distance', 'Distance'], ['heats', 'Heats (the Format Heats)']], showIf: [{ sessionType: ['endurance'], enduranceBy: ['time', 'laps', 'distance', ''] }],
        hint: 'In a race with driver swaps the participants are teams. The drivers of a team swap in the pits and drive the same car. The team races from start to finish and swaps as often as the rules under Driver swaps say. (A race in heats with swaps is the Format Heats.)' },
      { key: 'heatBy', group: 'length', label: 'Each heat is over after', ui: 'seg', type: 'select', default: 'laps',
        options: [['laps', 'Laps'], ['time', 'Time'], ['distance', 'Distance']], showIf: HEATED(),
        hint: 'Time: every heat runs for the same time. Distance needs the lane lengths of the track (Database > Tracks): a car in a shorter lane drives more laps.' },
      { key: 'laps', group: 'length', label: 'Number of laps', type: 'number', default: 10,
        showIf: [{ sessionType: ['race'], raceBy: ['laps', ''] }, { sessionType: ['endurance'], enduranceBy: ['laps'] }, ...HEATED({ heatBy: ['laps'] })] },
      { key: 'distance', group: 'length', label: 'Distance of the race (metres)', labelFt: 'Distance of the race (feet)', unit: 'm', type: 'number', default: 100, min: 1, showIf: DIST(),
        hint: 'What every car drives (in a heat race: every heat). The laps follow from the length of the lane: a lane of 10 m drives 10 laps for 100 m. The race ends for a car at the line it crosses after it has driven the distance.' },
      { key: 'distanceMode', group: 'length', label: 'The lanes drive', type: 'select', default: 'same', showIf: DIST(),
        options: [['same', 'The same distance (a shorter lane drives more laps)'], ['laps', 'The same number of laps (from the distance and the track length)'], ['manual', 'A distance I set for each lane']],
        hint: 'The same distance: the fairest, because the lanes of a track are never exactly as long. The same number of laps: every lane drives the laps that the distance takes on a lane of the track length, so a longer lane drives a little further. A distance for each lane: you type them below.' },
      { key: 'laneDistances', group: 'length', label: 'Distance of every lane (metres), lane 1 first', labelFt: 'Distance of every lane (feet), lane 1 first', unit: 'm', type: 'numberlist', default: '', optional: true, showIf: DIST({ distanceMode: ['manual'] }),
        hint: 'For instance 100, 105, 110. A lane without a distance here drives the distance of the race above.' },
      { key: 'distanceRound', group: 'length', label: 'A distance that is not a whole number of laps', type: 'select', default: 'up', showIf: DIST(),
        options: [['up', 'Drive on to the line after it (at least the distance)'], ['nearest', 'Round to the nearest lap (a little more or less than the distance)']],
        hint: 'A car is only seen when it crosses the line, so it drives whole laps. At least the distance: 100 m on a lane of 10.5 m is 10 laps (105 m). The nearest lap: 9.52 laps is 10 laps, and 9.4 laps is 9.' },
      { key: 'distanceMax', group: 'length', label: 'The race may take at most (minutes, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: DIST(),
        hint: 'A safety net: when the time is up every car finishes at its next crossing of the line, and the cars are ranked by the distance they have driven. 0 means the race lasts until the distance is driven.' },
      { key: 'duration', group: 'length', label: 'Duration (minutes)', type: 'number', default: 5,
        showIf: [{ sessionType: ['qualifying'] }, { sessionType: ['race'], raceBy: ['time'] }, { sessionType: ['endurance'], enduranceBy: ['time'] }, ...HEATED({ heatBy: ['time'] })] },
      { key: 'compareBy', group: 'length', label: 'Cars are compared by', ui: 'seg', type: 'select', default: 'laps',
        options: [['laps', 'Laps'], ['distance', 'Distance']],
        showIf: [{ sessionType: ['race'], raceBy: ['time'] }, { sessionType: ['endurance'], enduranceBy: ['time'] }, ...HEATED({ heatBy: ['time'] })],
        hint: 'Laps: the car with the most laps wins. Distance: the car that drove the furthest wins (laps times the length of the lane, so every lane needs a length in the Database), which is fair when the lanes differ. With the same laps or distance, the shortest time wins.' },
      { key: 'endRule', group: 'length', label: 'The race ends', ui: 'seg', full: true, type: 'select', default: 'all',
        options: [['all', 'When every car has finished'], ['leader', 'When the leader has finished']],
        showIf: [{ sessionType: ['race'], raceBy: ['laps', 'distance', ''] }, { sessionType: ['endurance'], enduranceBy: ['laps', 'distance'] }, ...HEATED({ heatBy: ['laps', 'distance'] })] },
      { key: 'resultBy', group: 'length', label: 'The overall winner is', ui: 'cards', offer: ['points', 'laps', 'time'], type: 'select', default: 'laps',
        options: [['laps', 'Most laps', 'The total laps over the heats that count.'], ['points', 'Most points', 'Points for the position in every heat.'], ['time', 'Lowest total time', 'The shortest time over the heats that count (for the laps or the distance of the heats).']], showIf: HEATED({ heatBy: ['laps', 'distance', ''] }),
        hint: 'Lowest total time is for the laps or the distance of the heats (the winner of a heat is the first to finish); a heat that is not finished ranks below the finished ones, by laps. Most laps is not for heats by distance: choose total time or points. How the heats are added up, and what decides a tie, is set below.' },
      { key: 'resultByTime', group: 'length', label: 'The overall winner is', ui: 'cards', offer: ['points', 'lapstime', 'laps'], type: 'select', default: 'lapstime',
        options: [['lapstime', 'Most laps, then total time', 'The most laps (or the furthest distance) over the heats; with equal laps, the lowest total time.'], ['laps', 'Most laps', 'Only the laps count. A tie is decided by the setting below.'], ['points', 'Most points', 'Points for the position in every heat.']], showIf: HEATED({ heatBy: ['time'] }),
        hint: 'Heats of a set time. The driver with the most laps (or the furthest distance) over the heats wins, and only when those are equal does the lowest total time decide. Most points: every heat gives points for the position. A tie in Most laps is decided by the setting A tie is decided by. How the heats are added up is set below.' },
      { key: 'unfinished', group: 'length', label: 'A heat that is not finished', type: 'select', default: 'below',
        options: [['below', 'The driver ranks below the drivers who finished (by laps)'], ['estimate', 'The finish time is estimated from the average lap of the driver']], showIf: HEATED({ heatBy: ['laps'], resultBy: ['time'] }),
        hint: 'A heat can end before every car has finished its laps (the race ends when the lead car finishes, you stop it, or a car runs out of fuel). Ranks below: a driver who did not finish every heat that counts is ranked after those who did, by laps. Estimated: the time the driver still needed is the laps that were left at their own average lap, and that estimated time counts like any other (it is marked as an estimate). A car without a lap, that ran out of fuel or that is disqualified has no estimate and ranks below.' },
      { key: 'points', group: 'length', label: 'Points per position', ui: 'boxes', type: 'numberlist', default: '10, 8, 6, 5, 4, 3, 2, 1',
        showIf: [...HEATED({ heatBy: ['laps', 'distance', ''], resultBy: ['points'] }), ...HEATED({ heatBy: ['time'], resultByTime: ['points'] })],
        hint: 'One box for each position, 1st first. For example 10, 8, 6 gives the winner of a heat 10 points, the second 8 and the third 6. Positions further down get nothing. Use + and - to add or take away a position.' },
      { key: 'fastestBonus', group: 'length', label: 'Bonus points for the fastest lap of a heat', type: 'number', default: 0, min: 0, showIf: [...HEATED({ heatBy: ['laps', 'distance', ''], resultBy: ['points'] }), ...HEATED({ heatBy: ['time'], resultByTime: ['points'] })],
        hint: 'The driver with the fastest lap of a heat gets these extra points in that heat (0 is no bonus). The bonus is part of the points of the heat, so it also counts when you drop the worst heat or count only the best heats.' },
      { key: 'countBy', group: 'length', label: 'How the heats are added up', ui: 'seg', type: 'select', default: 'total',
        options: [['total', 'Total'], ['average', 'Average'], ['best', 'Best heats']], showIf: HEATED(),
        hint: 'Total: a driver who races a heat more has an advantage. Average is fair when drivers race a different number of heats (the Home tab shows when they do). Best heats: every driver counts the best few of their heats (you choose how many below), so a bad heat does not matter.' },
      { key: 'bestHeats', group: 'length', label: 'Heats that count', type: 'number', default: 2, min: 1, showIf: HEATED({ countBy: ['best'] }),
        hint: 'The best heats of every driver that count: the best by laps (or by points, for a result by points). A driver who raced fewer heats than this has them all counted, which is less than the others.' },
      { key: 'dropWorst', group: 'length', label: 'Drop the worst heat', ask: 'Drop the worst heat of every driver', ui: 'switch', on: 'yes', type: 'select', default: 'no', options: [['no', 'No'], ['yes', 'Yes']], showIf: HEATED(),
        hint: 'Off: every heat counts. On takes away the worst heat of every driver who raced at least two heats, before the rest is counted. A worse heat is one with fewer laps (or fewer points). It is fairest when everybody races the same number of heats.' },
      { key: 'tieBreak', group: 'length', label: 'A tie is decided by', type: 'select', default: 'default',
        options: [['default', 'The other measure (laps or points), then the fastest lap'], ['bestlap', 'The fastest lap first'], ['wins', 'The most heat wins first'], ['time', 'The lowest total time first']], showIf: HEATED(),
        hint: 'Drivers with the same result are put in this order. The lowest total time is the time of the heats that count, which is only fair for drivers who drove the same number of laps. If they are still equal, the other things follow in the order of the standard.' },
      { key: 'finals', group: 'length', label: 'Finals after the heats', ui: 'seg', type: 'select', default: 'none',
        options: [['none', 'None'], ['a', 'A final'], ['ab', 'A and B final']], showIf: HEATED(),
        hint: 'None: the heats are the race. After the last heat the best drivers race a final, with as many drivers as the track has lanes. A B final is the next group and is raced before the A final. The best-placed driver chooses a lane first. Who is in a final is only known after the heats, so the Home tab shows a note and no names.' },
      { key: 'finalMode', group: 'length', label: 'What the finals decide', type: 'select', default: 'places',
        options: [['places', 'The finals decide the final places: the heat result only decides who is in which final'], ['added', 'The result of the final is added to the heat result']], showIf: HEATED({ finals: ['a', 'ab'] }),
        hint: 'The first: the final A decides places 1 to 4 (or as many as the track has lanes), the B final the places after them, the others follow in the order of the heats. The second: what a driver scores in the final (laps, or points from the same list as a heat) is added to the result of the heats. It is not averaged and never dropped. In both cases the drivers of the A final stay above the drivers of the B final.' },
      { key: 'finalLaps', group: 'length', label: 'Laps in a final (0 = as many as a heat)', type: 'number', default: 0, min: 0, showIf: HEATED({ heatBy: ['laps'], finals: ['a', 'ab'] }),
        hint: 'Every final has this many laps. 0 is the same number of laps as a heat.' },
      { key: 'finalDuration', group: 'length', label: 'Duration of a final in minutes (0 = as long as a heat)', type: 'number', default: 0, min: 0, showIf: HEATED({ heatBy: ['time'], finals: ['a', 'ab'] }),
        hint: 'Every final runs this long. 0 is the same time as a heat.' },
      { key: 'finalDistance', group: 'length', label: 'Distance of a final (metres, 0 = the same as a heat)', labelFt: 'Distance of a final (feet, 0 = the same as a heat)', unit: 'm', type: 'number', default: 0, min: 0, showIf: HEATED({ heatBy: ['distance'], finals: ['a', 'ab'] }),
        hint: 'Every final drives this distance, in the way the lanes drive it in a heat. 0 is the same distance as a heat.' },
      { key: 'swapUnit', group: 'endurance', label: 'The swaps are counted in', ui: 'seg', type: 'select', default: 'minutes', options: [['minutes', 'Minutes'], ['laps', 'Laps'], ['distance', 'Distance']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'Every length below (the swap interval, the moments, the shortest and longest stint, the least and most a driver drives, the warning) is in minutes, in laps or in distance, as chosen here. A distance is worked out from the laps a car has driven and the length of its lane (the lane lengths are in the Database, under Tracks).' },
      { key: 'swapWhere', group: 'endurance', label: 'A swap by distance is due', type: 'select', default: 'line', options: [['line', 'At the line: when the car crosses the line having driven the distance'], ['anywhere', 'Anywhere on the track: at the distance itself (estimated between two crossings of the line)']], showIf: [{ sessionType: ['endurance'], swapUnit: ['distance'] }],
        hint: 'At the line: the distance is counted from the laps (exact), and the swap is due when the car crosses the line after the distance. Anywhere: the swap signal comes at the distance itself, wherever the car is; the car is placed between two crossings from the time since the last one and the average of its last laps.' },
      { key: 'swapMode', group: 'endurance', label: 'A swap is needed', type: 'select', default: 'every', options: [['every', 'Every so often (for instance every 30 minutes)'], ['moments', 'At fixed moments of the race (for instance after 30 minutes and after 2 hours)'], ['free', 'When the team chooses, within the shortest and longest stint']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'Every so often: a swap is due when a driver has been at the wheel that long. Fixed moments: a swap is due at each moment in the list. Free: the team swaps when it wants to, as long as the shortest stint is over; a swap is due only when the longest stint (or the most a driver may drive) is reached.' },
      { key: 'swapEvery', group: 'endurance', label: 'A swap is needed every (minutes or laps)', type: 'number', default: 30, min: 1, showIf: [{ sessionType: ['endurance'], swapMode: ['every'], swapUnit: ['minutes', 'laps', ''] }] },
      { key: 'swapEveryDist', group: 'endurance', label: 'A swap is needed every (metres)', labelFt: 'A swap is needed every (feet)', unit: 'm', type: 'number', default: 50, min: 0.1, showIf: [{ sessionType: ['endurance'], swapMode: ['every'], swapUnit: ['distance'] }] },
      { key: 'swapMoments', group: 'endurance', label: 'A swap is needed at these moments of the race', type: 'text', default: '30, 1:00:00, 2:00:00', showIf: [{ sessionType: ['endurance'], swapMode: ['moments'], swapUnit: ['minutes', 'laps', ''] }],
        hint: 'Separated by commas. In minutes a number is minutes (30), m:ss is minutes and seconds, h:mm:ss is hours, minutes and seconds (2:00:00 is 2 hours). In laps only whole lap numbers count (a swap is due after that lap).' },
      { key: 'swapMomentsDist', group: 'endurance', label: 'A swap is needed at these distances of the race (metres)', labelFt: 'A swap is needed at these distances of the race (feet)', unit: 'm', type: 'numberlist', default: '100, 200', showIf: [{ sessionType: ['endurance'], swapMode: ['moments'], swapUnit: ['distance'] }],
        hint: 'Separated by commas, for instance 100, 200, 300: the distance the car has driven since the start of the race.' },
      { key: 'stintMin', group: 'endurance', label: 'Shortest time at the wheel (minutes or laps, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['minutes', 'laps', ''] }],
        hint: 'A swap before the shortest stint is over is a swap that is too early: it is allowed or it costs points, as set below.' },
      { key: 'stintMinDist', group: 'endurance', label: 'Shortest distance at the wheel (metres, 0 = no limit)', labelFt: 'Shortest distance at the wheel (feet, 0 = no limit)', unit: 'm', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['distance'] }],
        hint: 'A swap before the shortest stint is over is a swap that is too early: it is allowed or it costs points, as set below.' },
      { key: 'stintMax', group: 'endurance', label: 'Longest time at the wheel (minutes or laps, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['minutes', 'laps', ''] }],
        hint: 'When a driver has been at the wheel this long, a swap is due, whatever else is set.' },
      { key: 'stintMaxDist', group: 'endurance', label: 'Longest distance at the wheel (metres, 0 = no limit)', labelFt: 'Longest distance at the wheel (feet, 0 = no limit)', unit: 'm', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['distance'] }],
        hint: 'When a driver has been at the wheel this long, a swap is due, whatever else is set.' },
      { key: 'totalMin', group: 'endurance', label: 'Least a driver has to drive in the whole race (minutes or laps, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['minutes', 'laps', ''] }],
        hint: 'A fairness rule: the swap screen tells you which drivers have not driven enough yet, and the results say who drove too little.' },
      { key: 'totalMinDist', group: 'endurance', label: 'Least a driver has to drive in the whole race (metres, 0 = no limit)', labelFt: 'Least a driver has to drive in the whole race (feet, 0 = no limit)', unit: 'm', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['distance'] }],
        hint: 'A fairness rule: the swap screen tells you which drivers have not driven enough yet, and the results say who drove too little.' },
      { key: 'totalMax', group: 'endurance', label: 'Most a driver may drive in the whole race (minutes or laps, 0 = no limit)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['minutes', 'laps', ''] }],
        hint: 'When a driver has driven this much in total, a swap is due, and that driver is not chosen again.' },
      { key: 'totalMaxDist', group: 'endurance', label: 'Most a driver may drive in the whole race (metres, 0 = no limit)', labelFt: 'Most a driver may drive in the whole race (feet, 0 = no limit)', unit: 'm', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['distance'] }],
        hint: 'When a driver has driven this much in total, a swap is due, and that driver is not chosen again.' },
      { key: 'swapWarn', group: 'endurance', label: 'Warn this long before a swap is due (minutes or laps, 0 = no warning)', type: 'number', default: 1, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['minutes', 'laps', ''] }],
        hint: 'The Swap Timer widget turns amber, and the audio call "swap soon" is said (it is off in the audio set until you switch it on).' },
      { key: 'swapWarnDist', group: 'endurance', label: 'Warn this far before a swap is due (metres, 0 = no warning)', labelFt: 'Warn this far before a swap is due (feet, 0 = no warning)', unit: 'm', type: 'number', default: 10, min: 0, showIf: [{ sessionType: ['endurance'], swapUnit: ['distance'] }],
        hint: 'The Swap Timer widget turns amber, the Swap Signal widget shows the warning, and the audio call "swap soon" is said (it is off in the audio set until you switch it on).' },
      { key: 'swapConfirm', group: 'endurance', label: 'The swap is made when', type: 'select', default: 'both', options: [['both', 'The car stops on the pit sensor, or the Swap done button is pressed'], ['sensor', 'The car stops on the pit sensor'], ['button', 'The Swap done button is pressed (Race Director, or a phone)']], showIf: [{ sessionType: ['endurance'] }] },
      { key: 'swapSeconds', group: 'endurance', label: 'The car has to stand on the pit sensor this long to swap (seconds)', type: 'number', default: 10, min: 0, showIf: [{ sessionType: ['endurance'], swapConfirm: ['both', 'sensor'] }],
        hint: 'Like a Stop-and-Go: once the swap is due, the car has to stay on the pit sensor this long. A car that drives on in time does not swap.' },
      { key: 'swapNext', group: 'endurance', label: 'The driver who steps in is', type: 'select', default: 'order', options: [['order', 'The next one in the order of the team'], ['chosen', 'Chosen at every swap (the next one in the order is suggested)'], ['random', 'Picked by lot (a driver who is not at the wheel of another car)']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'A driver who is at the wheel of another car in the same race is never chosen. The swap screen shows who has driven the longest, so a team can swap fairly.' },
      { key: 'swapGrace', group: 'endurance', label: 'Seconds to make the swap once it is due', type: 'number', default: 30, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'When the swap is not made within this time, the team is late: the penalty and the lap counting below apply.' },
      { key: 'swapLate', group: 'endurance', label: 'While a swap is not made', type: 'select', default: 'count', options: [['count', 'The laps keep counting'], ['stop', 'The laps stop counting (they count again once the swap is made)']], showIf: [{ sessionType: ['endurance'] }] },
      { key: 'swapPenalty', group: 'endurance', label: 'Penalty points for a swap that is not made in time (0 = none)', type: 'number', default: 0, min: 0, step: 1, showIf: [{ sessionType: ['endurance'] }],
        hint: 'Given when the grace time is over. It needs a penalty system (under Rules and systems); without one nothing is added, but the team is still called out.' },
      { key: 'swapRepeat', group: 'endurance', label: 'Give the penalty again every (seconds, 0 = once)', type: 'number', default: 0, min: 0, showIf: [{ sessionType: ['endurance'] }],
        hint: 'A team that keeps driving gets the penalty again after this many seconds, for as long as the swap is not made.' },
      { key: 'swapEarly', group: 'endurance', label: 'A swap before the shortest stint is over', type: 'select', default: 'allow', options: [['allow', 'Is allowed'], ['penalty', 'Costs the penalty points of a swap that is not made']], showIf: [{ sessionType: ['endurance'] }],
        hint: 'Only when a shortest stint is set above. A swap before it is over is logged as too early. It needs a penalty system (under Rules and systems).' },
      { key: 'minPenalty', group: 'endurance', label: 'Penalty points for every driver who drove less than the least (0 = none)', type: 'number', default: 0, min: 0, step: 1, showIf: [{ sessionType: ['endurance'] }],
        hint: 'Given to the team when the race is over, for each driver who did not drive the least set above (a driver who did not drive at all too). A race that is stopped early gives none. It needs a penalty system.' },
      { key: 'lightsMin', group: 'length', label: 'Start Lights Off Timer — shortest before off (seconds)', type: 'number', default: 1, showIf: RACING,
        hint: 'The lights always follow the racing flags after the start: green while racing, yellow under Yellow and red under Red.' },
      { key: 'lightsMax', group: 'length', label: 'Start Lights Off Timer — longest before off (seconds)', type: 'number', default: 5, showIf: RACING,
        hint: 'The App picks a random wait between the shortest and longest values every time the start lights run.' },
      { key: 'redFlagSeconds', group: 'length', label: 'Red Flag Protection — add result time per car (seconds)', type: 'number', default: 0, min: 0, max: 3600, showIf: RACING,
        hint: 'Always on: a lap interrupted by Red still counts for race distance and order, but is automatically invalid and cannot count as a Personal Best or Track Record. Set an optional number of seconds to add to every active car’s result when Red is called. Measured lap times and the race-duration clock stay unchanged. 0 adds no time.' },
      { key: 'restartAfterRed', group: 'length', label: 'Red Flag Restart Behaviour', type: 'select', default: 'countdown',
        options: [['resume', 'Start immediately'], ['countdown', 'Countdown Timer']], showIf: RACING },
      { key: 'firstLap', group: 'length', label: 'First Lap Behaviour', type: 'select', default: 'skip',
        options: [['skip', 'Formation Lap — starts timing only'], ['count', 'First Trigger counts as a lap']], showIf: RACING },
      { key: 'pitHold', group: 'length', label: 'Sensor must be blocked for this long to start a pit stop (seconds)', type: 'number', default: 2, min: 0, showIf: RACING,
        hint: 'This prevents a passing car from being mistaken for a pit stop. It applies whether Service Stop is on or off.' },
      { key: 'trackCallAction', group: 'length', label: 'Track Call Button Behaviour', type: 'select', default: 'yellowred',
        options: [['yellowred', 'Yellow, then Red'], ['yellow', 'Yellow flag'], ['red', 'Red flag'], ['power', 'Track power'], ['none', 'Disabled']],
        hint: 'This applies to the Trackmate, Parallel Port and SlotForge box Track Call buttons. Yellow, then Red uses a second press within the window below.' },
      { key: 'trackCallYellowPower', group: 'length', label: 'Track power during Yellow', ui: 'switch', on: 'on', type: 'select', default: 'on', options: [['on', 'On'], ['off', 'Off']], showIf: [{ trackCallAction: ['yellow', 'yellowred'] }] },
      { key: 'trackCallRedPower', group: 'length', label: 'Track power during Red', ui: 'switch', on: 'on', type: 'select', default: 'on', options: [['on', 'On'], ['off', 'Off']], showIf: [{ trackCallAction: ['red', 'yellowred'] }] },
      { key: 'trackcallWindow', group: 'length', label: 'Yellow then Red — second-press window (seconds)', type: 'number', default: 3, min: 0.1, showIf: [{ trackCallAction: ['yellowred'] }] },
      { key: 'fuelRules', group: 'rules', label: 'Fuel System', type: 'ref', ref: 'fuelrules', blank: 'No fuel', tone: 'fuel', showIf: RACING },
      { key: 'penaltySystem', group: 'rules', label: 'Penalty System', type: 'ref', ref: 'penaltysystems', blank: 'No penalties', tone: 'penalty', showIf: RACING },
      { key: 'damageSystem', group: 'rules', label: 'Damage System', type: 'ref', ref: 'damagesystems', blank: 'No damage', tone: 'damage', showIf: [{ sessionType: ['race', 'heats', 'endurance'] }],
        hint: 'Damage points, and the stop in the pits that repairs them. Make damage systems under Race Setup > Damage Systems. Only for races (a number of laps or a duration), not for practice or qualifying. Penalty points for a late or an early stop need a Penalty system above.' },
      { key: 'safetyCar', group: 'rules', label: 'Safety Car System', type: 'ref', ref: 'safetycarsystems', blank: 'No safety car', tone: 'safetycar', showIf: RACING,
        hint: 'The Safety Car is out while the yellow flag is up. It replaces the Yellow flag settings with its target pace, penalty points and pit-work reduction.' },
      { key: 'tyreWear', group: 'rules', label: 'Tyre Wear System', type: 'ref', ref: 'tyrewearsystems', blank: 'No tyre wear', tone: 'tyrewear', showIf: RACING,
        hint: 'Tyres that wear out during the race and a fresh set in every pit stop. Every heat starts on fresh tyres.' },
      { key: 'weather', group: 'rules', label: 'Weather System', type: 'ref', ref: 'weathersystems', blank: 'No weather', tone: 'weather', showIf: [{ sessionType: ['race', 'heats', 'endurance'] }],
        hint: 'A spell of rain with a forecast, and tyres to change in the pits. Make weather systems under Race Setup > Weather Systems. Only for races (a number of laps or a duration), not for practice or qualifying. Hindering the cars needs a Fuel system above; the tyres and the penalty points do not.' },
      {key:'resourceSystem',group:'rules',label:'Resource System',type:'ref',ref:'resourcesystems',blank:'Off — use existing system limits',showIf:RACING,hint:'Allocate tyre sets, repair credits and replacement components to a driver, slotcar or team. Balances last for a race, event or championship.'},
      { key:'multiClass',group:'rules',label:'Multi-Class System',type:'ref',ref:'multiclasssystems',blank:'Off — one overall classification',showIf:RACING,hint:'Separate class positions and points alongside the overall race. Assign each entry on Home. Locked while racing.' },
      { key: 'pushSave', group: 'rules', label: 'Push & Save System', type: 'ref', ref: 'pushsavesystems', blank: 'No push and save', tone: 'pushsave', showIf: RACING,
        hint: 'How hard a driver drives changes how fast tyres and fuel are used: faster than their selected benchmark costs more, slower saves. It works independently for tyres and fuel. Make Push & Save Systems under Race Setup > Push and Save Systems.' },
      { key: 'bop', group: 'rules', label: 'Balance of Power', ui: 'switch', on: 'on', type: 'select', default: 'off', tone: 'bop', options: [['off', 'Off'], ['on', 'On']], showIf: [{ sessionType: ['race', 'heats', 'endurance'] }],
        hint: 'On: hinder the fastest car and help the slowest. Works through the Fuel System.' },
      { key: 'disabledSystems', group: 'rules', label: 'Turn selected systems on or off', type: 'text', default: '', showIf: RACING, hint: 'A system keeps its settings when turned off. These are the defaults for a new race; the Race Director can change them during the race.' },
      { key: 'serviceStop', group: 'service', label: 'Service Stop', type: 'select', ui: 'switch', on: 'on', default: 'off', options: [['off', 'Off'], ['on', 'On']], showIf: RACING,
        hint: 'Off: follow the sensor and the normal pit rules. On: keep the stop active while the car is removed. Works without fuel, tyres, damage or any other race system. Lap and pit triggers for that lane are ignored until release; raw hardware monitoring stays active.' },
      { key: 'pitHoldMode', group: 'service', label: 'Release car', type: 'select', default: 'auto', options: [['auto', 'Automatically after the timer'], ['manual', 'Manually with Release car']], showIf: [{ sessionType: ['practice', 'qualifying', 'race', 'heats', 'endurance'], serviceStop: ['on'] }] },
      { key: 'pitServiceWork', group: 'service', label: 'Fuel, tyres and repairs', type: 'select', default: 'systems', options: [['systems', 'Use each system’s setting'], ['overlap', 'At the same time — longest timer wins'], ['add', 'One after another — add the timers']], showIf: [{ sessionType: ['practice', 'qualifying', 'race', 'heats', 'endurance'], serviceStop: ['on'] }],
        hint: 'The service sequence is fitted into the fixed time below, even if the normal combined time is longer. With no systems enabled, the timer simply gives you time to work on the real car. Penalties always add time after service. Driver swaps keep their own rules.' },
      { key: 'pitHoldSeconds', group: 'service', label: 'Fixed service time (seconds)', type: 'number', default: 30, min: 1, max: 86400, showIf: [{ sessionType: ['practice', 'qualifying', 'race', 'heats', 'endurance'], serviceStop: ['on'] }],
        hint: 'Starts once pit entry is confirmed. Pausing the race pauses this timer. Automatic mode releases after this time when the sensor is clear. Manual mode waits for Release car; put the car back before releasing it.' },
      { key: 'pitHoldReturn', group: 'service', label: 'Wait for car to return', type: 'select', default: 'yes', options: [['yes', 'Yes'], ['no', 'No']], showIf: [{ sessionType: ['practice', 'qualifying', 'race', 'heats', 'endurance'], serviceStop: ['on'], pitHoldMode: ['auto'] }],
        hint: 'After service, cover the pit sensor with the car, then drive off it to release the stop. If the car is already on the sensor when service finishes, just drive off. Turn off to release at the end of service if the sensor is already clear. Button-only pits need Release car.' },
      { key: 'layout', group: 'screens', label: 'Timing Page/Race Screen — Main', type: 'ref', ref: 'layouts', blank: 'Default layout' },
      { key: 'layout2', group: 'screens', label: 'Timing Page/Race Screen — Second Display', type: 'ref', ref: 'layouts', blank: 'Same as main screen' },
      { key: 'audioSet', group: 'screens', label: 'Audio Set (announcements)', type: 'ref', ref: 'audiosets', blank: 'No audio' },
      { key: 'startPower', group: 'trackmate', label: 'Track power when a race starts (Trackmate relay)', ask: 'The track has power while the start lights count down', ui: 'switch', on: 'on', type: 'select', default: 'on',
        options: [['on', 'On'], ['off', 'Off']], hint: 'Off: the power comes on when the lights go out.' },
      { key: 'trackCallSummary', group: 'trackmate', label: 'Track Call Button', type: 'trackcallsummary', transient: true,
        hint: 'Set its behaviour in Race Settings. The same setting is used by Trackmate, Parallel Port and the SlotForge box.' },
      // the SlotForge box (Arduino): read by renderer/arduinorace.js. The track power at the start and the call buttons are the Trackmate choices above (they serve both).
      { key: 'boxPit', group: 'box', label: 'A pit stop starts when', type: 'select', default: 'both',
        options: [['both', 'The pit sensor sees the car, or the Pit button is pressed'], ['sensor', 'The pit sensor sees the car (the button does nothing)'], ['button', 'The Pit button is pressed (the sensor does nothing)']],
        hint: 'The pit sensor of a lane is set up on the Arduino page (Timing Hardware).', showIf: RACING },
      { key: 'boxLanePower', group: 'box', label: 'Lane power', type: 'select', default: 'retired',
        options: [['retired', 'The power of a lane is cut when its car retires or is disqualified'], ['off', 'Never: the lanes keep their power']],
        hint: 'Needs the lane power relays on the box (Arduino page).', showIf: RACING },
      { key: 'boxBeeps', group: 'box', label: 'The box beeps the countdown and GO', ui: 'switch', on: 'yes', type: 'select', default: 'yes',
        options: [['yes', 'Yes'], ['no', 'No']], hint: 'A short beep for every light and a long one at GO. Off: silent.', showIf: RACING },
      { key: 'boxLaneLights', group: 'box', label: 'The status pixel of each lane shows the lane colour', ui: 'switch', on: 'yes', type: 'select', default: 'no',
        options: [['no', 'No'], ['yes', 'Yes']],
        hint: 'Needs "A status pixel per lane" on the Arduino page.', showIf: RACING }
    ]
  },
  // Fuel rules: tank, a fixed use per lap, refuelling, and an optional pace reference for Push & Save. Chosen per race setup.
  fuelrules: {
    label: 'Fuel system', plural: 'Fuel systems', title: ['name'], extra: false, linked: false, list: ['name', 'tank', 'perLap', 'rate'], card: ['tank', 'perLap', 'rate'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, tank size, fuel used per lap and refuelling speed', open: true },
      { id: 'pace', title: 'Pace reference', note: 'An optional Track or Manual reference for Push & Save', open: true },
      { id: 'empty', title: 'Empty tank', note: 'What happens when the fuel runs out', open: true }
    ],
    // The form of a fuel system has a rail, as the forms of the other systems do. The three metric inputs sit together on one row.
    rail: [
      { id: 'basics', title: 'Basics', ask: 'How much fuel is used, and how quickly can it be put back?', icon: 'fuel', open: true, live: true, cols: 3, groups: ['basics'] },
      { id: 'pace', title: 'Pace reference', ask: 'Should Push & Save use a track or manual reference?', icon: 'gauge', open: true, live: true, groups: ['pace'] },
      { id: 'empty', title: 'Empty tank', ask: 'What happens when there is no fuel left?', icon: 'alert', open: true, groups: ['empty'] }
    ],
    used: { entity: 'racesetups', key: 'fuelRules' },
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text', placeholder: 'Name this fuel system' },
      { key: 'tank', group: 'basics', label: 'Tank capacity', type: 'number', suffix: 'litres', default: 120, icon: 'fuel' },
      { key: 'perLap', group: 'basics', label: 'Fuel consumption', type: 'number', suffix: 'litres per lap', default: 2, icon: 'drop' },
      { key: 'rate', group: 'basics', label: 'Refuel speed', type: 'number', suffix: 'litres per second', default: 10, icon: 'gauge', hint: 'From empty, a full tank takes tank capacity divided by this speed. Balance of Power, weather and tyre effects can alter an individual stop.' },
      { key: 'fuelMath', group: 'basics', label: 'Fuel maths', type: 'fuelmath', transient: true, full: true },
      { key: 'paceSource', group: 'pace', label: 'Legacy Push & Save reference', ui: 'cards', type: 'select', default: 'constant', icons: { constant: 'drop', track: 'racesetups', manual: 'clock' },
        options: [['constant', 'No custom reference', 'Legacy Push & Save uses the driver’s record or best race lap.'], ['track', 'Track target time', 'Use the fuel reference time saved on a Track.'], ['manual', 'Manual target time', 'Enter a reference time just for this Fuel System.']],
        hint: 'Base fuel use is fixed per lap; enabled racing effects can change it. Current Push & Save uses the benchmark chosen in App Settings > Calculations. This reference applies only to legacy Push & Save systems.' },
      { key: 'paceTrack', group: 'pace', label: 'Track', type: 'ref', ref: 'tracks', blank: 'Choose a track…', preview: 'fueltrack', full: true, showIf: [{ paceSource: ['track'] }], hint: 'Its Fuel reference lap time is used only by legacy Push & Save. Changing that Track later changes this reference for future races. Current Push & Save uses App Settings > Calculations.' },
      { key: 'paceManual', group: 'pace', label: 'Manual reference lap time', type: 'number', suffix: 'seconds', min: 0, showIf: [{ paceSource: ['manual'] }], hint: 'Used only by the legacy Push & Save model. The App Settings benchmark model ignores this reference.' },
      { key: 'empty', group: 'empty', label: 'When the fuel runs out', ui: 'cards', type: 'select', default: 'retire', icons: { retire: 'ban', stop: 'clock', warn: 'arrow' },
        options: [['retire', 'The car retires from the race'], ['stop', 'Laps stop counting until it has refuelled'], ['warn', 'The car carries on', 'A penalty system can add points for it.']] },
    ]
  },
  // Penalty systems: penalty points unlock consequences. Chosen per race setup.
  penaltysystems: {
    label: 'Penalty system', plural: 'Penalty systems', title: ['name'], extra: false, linked: false, list: ['name', 'ruleMode', 'dqPoints'], card: ['ruleMode', 'dqPoints'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, and what a driver’s growing point total does', open: true },
      { id: 'special', title: 'Special penalties', note: 'Named penalties the Race Director can give straight away', open: true },
      { id: 'limits', title: 'Disqualification and automatic points', note: 'When a driver is out, and points for an empty tank' }
    ],
    // The form of a penalty system has a rail, as the form of a race setup has (1.73.0, renderer/railform.js, words in renderer/systemwords.js): a section for every group, in the colour of the system.
    // See racesetups.rail for what the parts mean; live: the section has a note under its settings that follows what is typed. used: where this system is chosen (the race setups that use it).
    rail: [
      { id: 'basics', title: 'Basics', ask: 'What does a driver’s total number of points cause?', icon: 'clock', open: true, live: true, groups: ['basics'] },
      { id: 'special', title: 'Special penalties', ask: 'Which named penalties can the Race Director give?', icon: 'racesetups', open: true, groups: ['special'] },
      { id: 'limits', title: 'Disqualification and automatic points', ask: 'When is a driver out, and what does an empty tank cost?', icon: 'ban', optional: true, groups: ['limits'] }
    ],
    used: { entity: 'racesetups', key: 'penaltySystem' },
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text', placeholder: 'Name this penalty system' },
      { key: 'ruleMode', group: 'basics', label: 'Point consequences', ui: 'cards', type: 'select', default: 'custom', icons: { time: 'clock', laps: 'flag', pit: 'pit', custom: 'sliders' },
        options: [['time', 'Add time', 'Set a time total for each point level.'], ['laps', 'Deduct scoring laps', 'Set the scoring-lap total lost at each level.'], ['pit', 'Force pit stops', 'Set the mandatory stop at each level.'], ['custom', 'Custom rules', 'Mix time, scoring laps and mandatory pit stops in one ladder.']] },
      { key: 'rules', group: 'basics', label: 'Penalty ladder', type: 'penaltyrules', full: true, hint: 'Each row is the total consequence from that point level onwards. A higher row replaces the earlier total; it does not add it again.' },
      { key: 'types', group: 'special', label: 'Special penalties', type: 'penaltytypes', optional: true },
      { key: 'dqOn', group: 'limits', label: 'Disqualify at a point limit', ui: 'switch', on: 'on', type: 'select', default: 'off', options: [['off', 'Off'], ['on', 'On']] },
      { key: 'dqPoints', group: 'limits', label: 'Disqualify at this many points', type: 'number', min: 1, suffix: 'points', default: 10, showIf: [{ dqOn: ['on'] }] },
      { key: 'dqUnserved', group: 'limits', label: 'Disqualify if a mandatory penalty stop is unserved at the finish', ui: 'switch', on: 'on', type: 'select', default: 'off', options: [['off', 'Off'], ['on', 'On']] },
      { key: 'fuelPoints', group: 'limits', label: 'Penalty points for every lap driven on an empty tank', type: 'number', suffix: 'points', optional: true, hint: 'Only for fuel systems where the car carries on when the fuel runs out. Empty or 0 = no points.' }
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
      { id: 'failures', title: 'Car Failures', note: 'Failures that strike a car at random during a race (off to begin with)' },
      { id: 'fines', title: 'Penalty points', note: 'For a stop that is late, and for leaving too early' }
    ],
    // The form of a damage system has a rail (1.73.0), as the form of a penalty system does; see there.
    rail: [
      { id: 'basics', title: 'Basics', ask: 'How does the stop work, and what does a deslot cost?', icon: 'garage', open: true, groups: ['basics'] },
      { id: 'levels', title: 'Levels', ask: 'How much damage asks for which stop in the pits?', icon: 'stairs', open: true, groups: ['levels'] },
      { id: 'incidents', title: 'Incidents', ask: 'What buttons does the Race Director get?', icon: 'bolt', open: true, groups: ['incidents'] },
      { id: 'failures', title: 'Car failures', ask: 'Should cars have failures at random moments?', icon: 'cog', optional: true, groups: ['failures'] },
      { id: 'fines', title: 'Penalty points', ask: 'What do a late stop and leaving early cost?', icon: 'penalty', optional: true, groups: ['fines'] }
    ],
    used: { entity: 'racesetups', key: 'damageSystem' },
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text', placeholder: 'Name this damage system' },
      { key: 'stop', group: 'basics', label: 'Repair and the other work in the stop', ui: 'cards', type: 'select', default: 'overlap', icons: { overlap: 'parallel', add: 'arrow' },
        options: [['overlap', 'At the same time', 'The longest job counts: a repair of 15 seconds and refuelling for 8 seconds is 15 seconds.'], ['add', 'One after the other', 'The repair starts when the other work in the stop is done.']],
        hint: 'Repairs can overlap refuelling or follow it. Tyre changes have their own duration and order in Tyre Wear. An enabled fixed Service Stop fits ordinary work into its timer; penalty time is additional.' },
      { key: 'deslotPoints', group: 'basics', label: 'Damage points for a deslot', type: 'number', suffix: 'points', min: 0, default: 1,
        hint: 'A lap slower than the deslot time of the track (Tracks > Lap time limits) gives this many damage points. 0 = none.' },
      { key: 'levels', group: 'levels', label: 'Levels', type: 'damagelevels', optional: true },
      { key: 'incidents', group: 'incidents', label: 'Incidents', type: 'damageincidents', optional: true },
      { key: 'failuresOn', group: 'failures', label: 'Car Failures', ask: 'Cars get failures at random during a race', ui: 'switch', on: 'on', type: 'select', default: 'off', options: [['off', 'Off'], ['on', 'On: cars get failures at random during a race']],
        hint: 'A failure (a slow puncture, brakes that do not work, an engine that gives up) strikes a car at a random moment, without a hit. It asks a stop in the pits, like a level of damage, and adds no damage points. Cars are rolled when the race starts, every heat again.' },
      { key: 'failures', group: 'failures', label: 'The failures', type: 'carfailures', optional: true, showIf: [{ failuresOn: ['on'] }] },
      { key: 'failFrom', group: 'failures', label: 'Earliest moment of a failure (% of the race)', type: 'number', min: 0, max: 100, default: 10, showIf: [{ failuresOn: ['on'] }],
        hint: 'A failure never comes before this part of the race (of its laps, or of its time).' },
      { key: 'failTo', group: 'failures', label: 'Latest moment of a failure (% of the race)', type: 'number', min: 0, max: 100, default: 90, showIf: [{ failuresOn: ['on'] }],
        hint: 'A failure never comes after this part of the race. A failure never comes in the first lap or the last one.' },
      { key: 'failMax', group: 'failures', label: 'Failures for a car in a race, at most', type: 'number', min: 1, default: 1, showIf: [{ failuresOn: ['on'] }],
        hint: 'When more failures come up for a car than this, a few are kept at random. A car has one failure at a time: the next comes after the stop that cleared the first.' },
      { key: 'latePoints', group: 'fines', label: 'Penalty points for every lap after the deadline of a level', type: 'number', suffix: 'points', min: 0, default: 1,
        hint: 'A level can say the car must be in the pits within some laps. It needs a penalty system in the race setup; without one the late lap is only called out. 0 = none.' },
      { key: 'earlyPoints', group: 'fines', label: 'Penalty points for leaving before the repair is done', type: 'number', suffix: 'points', min: 0, default: 1,
        hint: 'The damage stays. It needs a penalty system in the race setup. 0 = none.' }
    ]
  },
  // Tyre wear systems (1.40.0): tyres lose life from 100% to 0% while a car drives, a pit stop gives a fresh set, and the life helps or hinders the car. Chosen per race setup.
  tyrewearsystems: {
    label: 'Tyre wear system', plural: 'Tyre wear systems', title: ['name'], extra: false, linked: false, list: ['name', 'unit', 'zero', 'changeSeconds'], card: ['unit', 'zero', 'changeSeconds'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, whether the wear is counted per lap or per distance, and where it applies', open: true },
      { id: 'tyres', title: 'The tyres', note: 'Choose the compounds and set how long a fresh set lasts at its normal pace', open: true },
      { id: 'temperature', title: 'Temperature & Warm-Up', note: 'Optional simulated temperature, working ranges and extra wear', open: false },
      { id: 'pace', title: 'Pace-sensitive wear', note: 'Faster laps than the selected pace benchmark wear more; slower laps wear less', open: true },
      { id: 'effect', title: 'What worn tyres do', note: 'Helping and hindering the car through the fuel rules, and what happens at 0%', open: true },
      { id: 'pit', title: 'Pit stops', note: 'How long changing tyres takes' },
      { id: 'weather', title: 'Wear in the weather', note: 'How much faster or slower a tyre wears in dry, cloudy, wet and clearing weather (only used in a race with a Weather System)' },
      { id: 'mand', title: 'Mandatory stops', note: 'Stops for tyres, and two different dry tyres, that every car must have made by the finish' },
      { id: 'sets', title: 'Sets of tyres', note: 'How many sets of every tyre a car or a team has, and what the Race Director can queue for the next stop' },
      { id: 'warn', title: 'Warnings', note: 'Where the life of the tyres turns amber and red on the widgets, and when the audio set speaks' }
    ],
    // The form of a tyre wear system has a rail (1.75.0), as the forms of the other systems do; see penaltysystems.rail. The old group Where it applies (practice and qualifying) is part of Basics now.
    // cols: 3 puts three settings on a row (the three switches of What worn tyres do, the two places of Basics).
    rail: [
      { id: 'basics', title: 'Basics', ask: 'Per lap or per distance, and where does it count?', icon: 'clock', open: true, live: true, cols: 3, groups: ['basics'] },
      { id: 'tyres', title: 'The tyres', ask: 'How long should each fresh tyre set last at normal pace?', icon: 'tyre', open: true, groups: ['tyres'] },
      { id: 'temperature', title: 'Temperature & Warm-Up', ask: 'How do tyres warm up and cool down?', icon: 'tyre', optional: true, live: true, groups: ['temperature'] },
      { id: 'pace', title: 'Pace-sensitive wear', ask: 'Should faster laps use up tyres more quickly?', icon: 'gauge', open: true, live: true, cols: 3, groups: ['pace'] },
      { id: 'effect', title: 'What worn tyres do', ask: 'Do they change the car, and what happens at 0%?', icon: 'gauge', open: true, cols: 3, groups: ['effect'] },
      { id: 'pit', title: 'Pit stops', ask: 'How long does changing tyres take?', icon: 'garage', groups: ['pit'] },
      { id: 'weather', title: 'Wear in the weather', ask: 'How much faster or slower does a tyre wear in each kind of weather?', icon: 'weather', optional: true, groups: ['weather'] },
      { id: 'mand', title: 'Mandatory stops', ask: 'Must every car make stops for tyres, or use two kinds?', icon: 'racesetups', optional: true, groups: ['mand'] },
      { id: 'sets', title: 'Sets of tyres', ask: 'How many sets of every tyre does a car or a team have?', icon: 'layers', optional: true, groups: ['sets'] },
      { id: 'warn', title: 'Warnings', ask: 'When do the widgets turn amber and red, and when does the audio set speak?', icon: 'bell', optional: true, live: true, groups: ['warn'] }
    ],
    used: { entity: 'racesetups', key: 'tyreWear' },
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text', placeholder: 'Name this tyre wear system' },
      { key: 'unit', group: 'basics', label: 'Wear is counted per', ui: 'seg', full: true, type: 'select', default: Tw.DEFAULTS.unit, options: [['lap', 'Lap'], ['distance', 'Distance']],
        hint: 'Distance counts the wear per 100 m, or per 100 ft when the distance unit of the app is feet. It uses the lane length of the track, so a longer lane wears the tyres more per lap. Choose it for Distance Racing: the numbers below are then per 100 m (100 ft), and the widgets say how many metres (feet) of tyre are left. A lane without a length counts every lap as the distance.' },
      { key: 'practice', group: 'basics', label: 'Tyres also wear in practice', ask: 'Tyres also wear in practice', ui: 'switch', on: 'on', third: true, type: 'select', default: Tw.DEFAULTS.practice, options: [['off', 'No tyre wear'], ['on', 'Tyre wear']] },
      { key: 'qualifying', group: 'basics', label: 'Tyres also wear in qualifying', ask: 'Tyres also wear in qualifying', ui: 'switch', on: 'on', third: true, type: 'select', default: Tw.DEFAULTS.qualifying, options: [['off', 'No tyre wear'], ['on', 'Tyre wear']] },
      { key: 'tyres', group: 'tyres', label: 'Tyres', type: 'tyretable' },
      { key: 'tempOn', group: 'temperature', label: 'Simulate tyre temperature', ask: 'Simulate tyre temperature', ui: 'switch', on: 'on', type: 'select', default: 'off', options: [['off','Off'],['on','On']], hint: 'Optional gameplay model. Cold and hot tyres add wear once, alongside existing pace and weather effects. Measured lap times and hardware outputs are unchanged.' },
      { key: 'temperature', group: 'temperature', label: 'Compound temperatures', type: 'tyretemperature', full: true, showIf: [{tempOn:['on']}] },
      { key: 'paceWear', group: 'pace', label: 'Use pace-sensitive tyre wear', ask: 'Pace-sensitive tyre wear', ui: 'switch', on: 'on', type: 'select', default: Tw.DEFAULTS.paceWear, options: [['off', 'Off'], ['on', 'On']],
        hint: 'App Settings > Calculations selects the Tyre Wear benchmark, history and minimum samples. A faster lap wears more and a slower lap wears less. Pit, yellow, red-interrupted and very slow laps never move the reference. Existing saved systems keep fixed wear until you turn this on.' },
      { key: 'paceStrength', group: 'pace', label: 'How strongly pace changes wear', ui: 'cards', type: 'select', default: Tw.DEFAULTS.paceStrength, showIf: [{ paceWear: ['on'] }],
        options: [['gentle', 'Gentle', 'A small change around the selected benchmark.'], ['normal', 'Normal', 'Wear changes in proportion to the pace difference.'], ['strong', 'Strong', 'A larger pace effect, capped for safety.']],
        hint: 'The multiplier is capped between half and one-and-a-half times normal wear, so a single exceptional lap cannot ruin a tyre.' },
      { key: 'effect', group: 'effect', label: 'Hinder or help the car through the fuel rules', ask: 'Hinder or help the car through the fuel rules', ui: 'switch', on: 'on', type: 'select', default: Tw.DEFAULTS.effect, options: [['on', 'Yes (needs a Fuel system)'], ['off', 'No']],
        hint: 'Needs a Fuel system in the race setup. The grip curve of every tyre (in The tyres) decides how much. It works like Balance of Power: a hindered car uses more fuel a lap and refuels slower, and together with Balance of Power and the weather the percentages are added (never more than 90%). Lap times and records are never changed.' },
      { key: 'eUse', group: 'effect', label: 'The fuel used in a lap', ask: 'The fuel used in a lap', ui: 'switch', on: 'on', third: true, type: 'select', default: Tw.DEFAULTS.eUse, options: [['on', 'Yes'], ['off', 'No']], showIf: [{ effect: ['on'] }] },
      { key: 'eRate', group: 'effect', label: 'The refuelling speed', ask: 'The refuelling speed', ui: 'switch', on: 'on', third: true, type: 'select', default: Tw.DEFAULTS.eRate, options: [['on', 'Yes'], ['off', 'No']], showIf: [{ effect: ['on'] }] },
      { key: 'eTank', group: 'effect', label: 'The size of the tank', ask: 'The size of the tank', ui: 'switch', on: 'on', third: true, type: 'select', default: Tw.DEFAULTS.eTank, options: [['off', 'No'], ['on', 'Yes']], showIf: [{ effect: ['on'] }] },
      { key: 'zero', group: 'effect', label: 'When the tyres reach 0%', ui: 'cards', type: 'select', default: Tw.DEFAULTS.zero,
        options: [['none', 'Nothing, only show it', 'The tyres are shown as worn out and the car races on.'], ['points', 'Penalty points every lap', 'Every lap on worn out tyres adds penalty points.'], ['lap', 'The lap does not count', 'Laps are not counted until the car has been in the pits for new tyres.'], ['retire', 'The car retires', 'The car is out of the race.']],
        hint: 'Works without Fuel too. It applies from the lap after the one that wore the tyres out, until the car has been in the pits for new tyres. Nothing: the car races on. The lap does not count: the car drives on, but its laps are not counted until it has been in the pits for new tyres.' },
      { key: 'zeroPoints', group: 'effect', label: 'Penalty points every lap', type: 'number', suffix: 'points', min: 0, default: Tw.DEFAULTS.zeroPoints, showIf: [{ zero: ['points'] }],
        hint: 'Needs a penalty system in the race setup. Without one nothing is added.' },
      { key: 'changeSeconds', group: 'pit', label: 'Changing tyres takes', type: 'number', suffix: 'seconds', min: 0, default: Tw.DEFAULTS.changeSeconds,
        hint: '0 means no time: the new set is on when the pit stop starts. A car must stand on the sensor in the pits that long; one that leaves earlier keeps its worn tyres (and it is logged). The seconds count from the moment the car stopped on the sensor.' },
      { key: 'stop', group: 'pit', label: 'Together with the other work in the stop (refuelling, repair, driver swap)', ui: 'cards', type: 'select', default: Tw.DEFAULTS.stop, icons: { overlap: 'parallel', add: 'arrow' },
        options: [['overlap', 'At the same time', 'The longest job counts.'], ['add', 'One after the other', 'The times of the jobs add up.']] },
      { key: 'mult', group: 'weather', label: 'Wear in the weather', type: 'wxmult' },
      { key: 'mandStops', group: 'mand', label: 'Stops for tyres every car must make (0 = none)', type: 'number', suffix: 'stops', min: 0, max: 20, default: Tw.DEFAULTS.mandStops,
        hint: 'A stop counts when tyres were fitted in it (a car that leaves before the tyre change is done, or finds no set left, has not made one). Judged when a car finishes, or when the race ends; a race that is stopped by the Race Director is not judged. A car that retires or is disqualified is not judged. Every heat of a heat race is judged on its own. Only in a race, a timed race, heats and an Endurance Race, never in practice or qualifying.' },
      { key: 'mandTwo', group: 'mand', label: 'Two different dry tyres must be used', ask: 'Two different dry tyres must be used', ui: 'switch', on: 'on', type: 'select', default: Tw.DEFAULTS.mandTwo, options: [['off', 'No'], ['on', 'Yes']],
        hint: 'As in Formula 1: a car must have driven laps on at least two different dry tyres (Hard, Medium, Soft, Supersoft). A car that raced on Intermediate or Wet tyres has kept the rule, as in a wet race.' },
      { key: 'mandPenalty', group: 'mand', label: 'A car that did not keep the rule gets', ui: 'cards', type: 'select', default: Tw.DEFAULTS.mandPenalty,
        options: [['none', 'Only noted', 'It shows in the results, nothing else happens.'], ['time', 'Seconds added', 'Added to the race time of the car, whatever the penalty system says.'], ['points', 'Penalty points', 'Needs a penalty system in the race setup.'], ['dq', 'Disqualified', 'The car is put last, out of the race.']],
        hint: 'Only used when a rule above is set. Without a penalty system, penalty points give nothing (and the result says so).' },
      { key: 'mandSeconds', group: 'mand', label: 'Seconds added to the race time', type: 'number', suffix: 'seconds', min: 0, max: 3600, default: Tw.DEFAULTS.mandSeconds, showIf: [{ mandPenalty: ['time'] }] },
      { key: 'mandPoints', group: 'mand', label: 'Penalty points', type: 'number', suffix: 'points', min: 0, max: 100, default: Tw.DEFAULTS.mandPoints, showIf: [{ mandPenalty: ['points'] }] },
      { key: 'setsMode', group: 'sets', label: 'The sets belong to', ui: 'cards', type: 'select', default: Tw.DEFAULTS.setsMode,
        options: [['none', 'No limit', 'Every stop gives a fresh set of the same tyre.'], ['car', 'Each car has its own', 'A car has its own box of sets.'], ['team', 'The team shares them', 'All the cars of a team take their sets from one box (a car with no team has a box of its own).']],
        hint: 'With no limit the Race Director can still queue another tyre for the next stop.' },
      { key: 'sets', group: 'sets', label: 'Sets of every tyre', type: 'tyresets', showIf: [{ setsMode: ['car', 'team'] }],
        hint: 'The set a car starts on counts as one. 0 means that tyre is not allowed in this race. A set that was taken off is not used again, and a tyre with no sets left can not be fitted or queued: the car then gets its own tyre, or a dry tyre that is left (and keeps its worn tyres when there is nothing left to fit). In a race with weather the rain brings Intermediate or Wet tyres at the next stop, from their sets, before a tyre the Race Director queued.' },
      { key: 'warn', group: 'warn', label: 'Warning (amber) at this life or less', type: 'number', suffix: '%', min: 0, max: 100, default: Tw.DEFAULTS.warn },
      { key: 'crit', group: 'warn', label: 'Critical (red) at this life or less', type: 'number', suffix: '%', min: 0, max: 100, default: Tw.DEFAULTS.crit },
      { key: 'call1', group: 'warn', label: 'Audio call at this life: first level', type: 'number', suffix: '%', min: 1, max: 99, default: Tw.DEFAULTS.call1,
        hint: 'The audio set says "tyres at 50 percent" when the tyres have this much life left or less (the call "A car\'s tyres reach a wear level" in the group Tyre wear). Each of the three levels is said once for every set of tyres. Empty = no call at this level.' },
      { key: 'call2', group: 'warn', label: 'Audio call at this life: second level', type: 'number', suffix: '%', min: 1, max: 99, default: Tw.DEFAULTS.call2 },
      { key: 'call3', group: 'warn', label: 'Audio call at this life: third level', type: 'number', suffix: '%', min: 1, max: 99, default: Tw.DEFAULTS.call3 }
    ]
  },
  // Safety car systems (1.53.0): a few settings bundled in one record, chosen per race setup (Rules and systems). The Safety Car is out while the yellow flag is up (see safetycar.js).
  safetycarsystems: {
    label: 'Safety car system', plural: 'Safety car systems', title: ['name'], extra: false, linked: false, list: ['name', 'target', 'pitPercent'], card: ['target', 'pitPercent'],
    // 1.76.0: Basics, Lap times and Pit stops are one group, Behind the Safety Car (the board has them in one card); the random flags are three groups in one section (bare: the group has no heading of its own)
    groups: [
      { id: 'behind', title: 'Behind the Safety Car', note: 'The Safety Car follows the yellow flag and Track Call. Set the target pace, its consequence and pit work here.', open: true },
      { id: 'random', title: 'Random Flags', note: 'Safety Car periods at random moments, as if another car on track caused them', open: false, bare: true },
      { id: 'when', title: 'When', note: 'Between which moments in the race a flag can come, and how far apart', bare: false },
      { id: 'ends', title: 'How long', note: 'How a flag ends, how long it lasts and a warning before it comes', bare: true }
    ],
    // The form of a safety car system has a rail (1.76.0), as the forms of the other systems do; see penaltysystems.rail. cols: 3 puts three settings on a row.
    rail: [
      { id: 'behind', title: 'Behind the Safety Car', ask: 'What applies whenever yellow or Track Call brings out the Safety Car?', icon: 'safetycar', open: true, live: true, cols: 3, groups: ['behind'] },
      { id: 'flags', title: 'Random Flags', ask: 'Should Safety Car periods come at random moments?', icon: 'dice', optional: true, cols: 3, groups: ['random', 'when', 'ends'] }
    ],
    used: { entity: 'racesetups', key: 'safetyCar' },
    fields: [
      { key: 'name', group: 'behind', label: 'Name', type: 'text', placeholder: 'Name this safety car system' },
      { key: 'safetyTrack', group: 'behind', label: 'Reference Track', type: 'ref', ref: 'tracks', blank: 'No reference track', preview: 'safetytrack', tone: 'safetycar', hint: 'For setup only: its saved Fuel reference lap is shown beside your Safety Car target. It never changes a race by itself.' },
      { key: 'targetOn', group: 'behind', label: 'Enforce Safety Car target pace', ui: 'switch', on: 'on', type: 'select', default: 'on', tone: 'safetycar', options: [['off', 'Off'], ['on', 'On']],
        hint: 'Applies whenever the yellow flag is up: from the Yellow button, Track Call, a marshal call or a Random Flag.' },
      { key: 'target', group: 'behind', label: 'Target lap time', type: 'number', suffix: 'seconds', min: 0, max: 3600, default: Sc.DEFAULTS.target, tone: 'safetycar', showIf: [{ targetOn: ['on'] }],
        hint: 'A full lap behind the Safety Car must take at least this long. A too fast lap partly before the Safety Car came out does not count. Use the reference Track above as a guide; 0 means no limit.' },
      { key: 'pointsOn', group: 'behind', label: 'Penalty points for failing target lap time', ui: 'switch', on: 'on', type: 'select', default: 'on', tone: 'safetycar', options: [['off', 'Off'], ['on', 'On']], showIf: [{ targetOn: ['on'] }],
        hint: 'Off: a fast Safety Car lap is still called out and marked, but no penalty points are given.' },
      { key: 'points', group: 'behind', label: 'Points for each failed target lap', type: 'number', suffix: 'points', min: 0, max: 100, default: Sc.DEFAULTS.points, tone: 'safetycar', showIf: [{ targetOn: ['on'], pointsOn: ['on'] }],
        hint: 'Given for every full Safety Car lap that is faster than the target. It needs a penalty system in the Race Setup.' },
      { key: 'pitOn', group: 'behind', label: 'Reduce service work in the pits', ui: 'switch', on: 'on', type: 'select', default: 'on', tone: 'safetycar', options: [['off', 'Off'], ['on', 'On']],
        hint: 'Applies to refuelling, repairs and tyre changes when the car enters the pits while the Safety Car is out.' },
      { key: 'pitPercent', group: 'behind', label: 'Service work reduction', type: 'number', suffix: 'percent', min: 0, max: Sc.MAX_PIT, default: Sc.DEFAULTS.pitPercent, tone: 'safetycar', showIf: [{ pitOn: ['on'] }],
        hint: '50% makes a 10 second tyre change take 5 seconds. Fixed when a car comes in: Driver swaps, served penalties and pit-entry timing are not shortened.' },
      { key: 'rndOn', group: 'random', label: 'Random Flags', ask: 'Random Flags', ui: 'switch', on: 'on', type: 'select', default: Sc.RND_DEFAULTS.on, options: [['off', 'Off'], ['on', 'On']],
        hint: 'On: the yellow flag, with the Safety Car rules above, comes at random moments as if another car caused it. The Race Director can still lift a flag early.' },
      { key: 'rndPitExit', group: 'random', label: 'Hold cars at pit exit during a Random Flag', ui: 'switch', on: 'on', type: 'select', default: 'off', options: [['off', 'Off'], ['on', 'On']], showIf: [{ rndOn: ['on'] }],
        hint: 'Cars already in the pits, and cars that enter while that Random Flag is active, wait until it ends. This is enforced when the Race Setup has Service Stop on; otherwise it is shown as a Race Director instruction.' },
      { key: 'rndNote', group: 'random', label: 'Race Director instruction', type: 'text', maxLength: 180, placeholder: 'For example: pit lane closed — hold at exit', showIf: [{ rndOn: ['on'] }],
        hint: 'A short custom rule shown in the event log whenever a Random Flag begins. It informs the Race Director; it does not invent an untested automatic rule.' },
      { key: 'rndLine', group: 'random', label: 'Where in the race a flag can come', type: 'sctimeline', hint: 'It follows the numbers below', showIf: [{ rndOn: ['on'] }] }, // (the bar: drawn by the form, not a setting)
      { key: 'rndMode', group: 'random', label: 'How many flags', ui: 'cards', type: 'select', default: Sc.RND_DEFAULTS.mode, options: Sc.RND_MODES, showIf: [{ rndOn: ['on'] }],
        hint: 'Exactly N, a number from N to M (any number in between is as likely), or at least N: after the N each further flag has the chance below, one after the other. More than 20 in a race is never drawn.' },
      { key: 'rndMin', group: 'random', label: 'Number of flags (N)', type: 'number', min: 0, max: Sc.MAX_FLAGS, default: Sc.RND_DEFAULTS.min, showIf: [{ rndOn: ['on'] }], hint: '0 to 20. When the flags do not fit in the race (see the earliest and latest moment and the time between), there are fewer.' },
      { key: 'rndMax', group: 'random', label: 'Up to (M)', type: 'number', min: 0, max: Sc.MAX_FLAGS, default: Sc.RND_DEFAULTS.max, showIf: [{ rndOn: ['on'], rndMode: ['range'] }], hint: 'Never less than N.' },
      { key: 'rndMore', group: 'random', label: 'Chance of one more flag', type: 'number', suffix: 'percent', min: 0, max: 100, default: Sc.RND_DEFAULTS.more, showIf: [{ rndOn: ['on'], rndMode: ['atleast'] }],
        hint: 'After the N flags: 30 means that three races in ten get an extra flag, and then three in ten of those get one more, and so on. 0 = exactly N.' },
      { key: 'rndChance', group: 'random', label: 'Chance that a race has random flags', type: 'number', suffix: 'percent', min: 0, max: 100, default: Sc.RND_DEFAULTS.chance, showIf: [{ rndOn: ['on'] }],
        hint: '100 = every race has them. 60 = six races in ten do; the other four are drawn without any (with a heat race, every heat is drawn for itself).' },
      { key: 'rndFrom', group: 'when', label: 'Earliest moment', type: 'number', suffix: '% of the race', min: 0, max: 100, default: Sc.RND_DEFAULTS.from, showIf: [{ rndOn: ['on'] }],
        hint: 'No flag before this part of the race has been driven (the laps of the leader, or the time on the clock). In a race by laps never in the first lap or the last. If the two moments are typed the other way round, they swap.' },
      { key: 'rndTo', group: 'when', label: 'Latest moment', type: 'number', suffix: '% of the race', min: 0, max: 100, default: Sc.RND_DEFAULTS.to, showIf: [{ rndOn: ['on'] }], hint: 'No flag comes up after this part of the race (one that has come up may last longer).' },
      { key: 'rndGap', group: 'when', label: 'At least this long between two flags', type: 'number', suffix: 'seconds', min: 0, max: 600, default: Sc.RND_DEFAULTS.gap, showIf: [{ rndOn: ['on'] }],
        hint: 'From the end of one flag to the start of the next. A flag that is due while another flag is up (one a marshal or the Race Director raised, or a red flag) waits for it to end and for this time to pass.' },
      { key: 'rndFree', group: 'when', label: 'Free practice: spread the flags over', type: 'number', suffix: 'minutes', min: 1, max: 240, default: Sc.RND_DEFAULTS.free, showIf: [{ rndOn: ['on'] }],
        hint: 'A free practice has no end, so there is no part of it to take a percentage of. The flags are drawn in this many minutes from the start; the earliest and latest moment count in them too.' },
      { key: 'rndEnd', group: 'ends', label: 'How a flag ends', ui: 'seg', full: true, type: 'select', default: Sc.RND_DEFAULTS.end, options: Sc.RND_ENDS, showIf: [{ rndOn: ['on'] }],
        hint: 'By itself: the flag comes down when its time is up (and the Race Director can lift it earlier). Only when the Race Director lifts it: it stays up until he presses the yellow flag button, like a flag he raised himself.' },
      { key: 'rndLenMode', group: 'ends', label: 'How long a flag lasts', ui: 'seg', full: true, type: 'select', default: Sc.RND_DEFAULTS.lenMode, options: Sc.RND_LENGTHS, showIf: [{ rndOn: ['on'], rndEnd: ['timer'] }], hint: 'Every flag lasts the same time, or a time between two limits that is drawn for each flag when the race starts.' },
      { key: 'rndLen', group: 'ends', label: 'Seconds', type: 'number', suffix: 'seconds', min: 5, max: 600, default: Sc.RND_DEFAULTS.len, showIf: [{ rndOn: ['on'], rndEnd: ['timer'] }], hint: '5 to 600. With two times, the shortest.' },
      { key: 'rndLenMax', group: 'ends', label: 'Up to', type: 'number', suffix: 'seconds', min: 5, max: 600, default: Sc.RND_DEFAULTS.lenMax, showIf: [{ rndOn: ['on'], rndEnd: ['timer'], rndLenMode: ['range'] }], hint: 'Every flag gets a time between the two, drawn when the race starts.' },
      { key: 'rndWarn', group: 'ends', label: 'Warn before a flag comes (0 = no warning)', type: 'number', suffix: 'seconds', min: 0, max: 60, default: Sc.RND_DEFAULTS.warn, showIf: [{ rndOn: ['on'] }],
        hint: 'A heads-up: the Race Flag widget flashes the yellow flag, and the call "Yellow flag soon" is said (Audio Settings). In a race by laps it needs a lap of the leader to know how long a lap takes. 0 = the flag just comes.' }
    ]
  },
  // Push and save systems: faster and slower laps change tyre wear and/or fuel use. New systems use each driver's median green lap; older records keep their original reference rules.
  pushsavesystems: {
    label: 'Push and save system', plural: 'Push and save systems', title: ['name'], extra: false, linked: false, list: ['name', 'pushAt', 'saveAt'], card: ['pushAt', 'saveAt'],
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, a ready-made system, and whether pace changes tyres, fuel or both', open: true },
      { id: 'pace', title: 'Pace', note: 'App Settings selects the pace benchmark; use a Track here only to preview the times', open: true },
      { id: 'wear', title: 'Wear', note: 'How much more or less the tyres and fuel are used up at full push and full save', open: true },
      { id: 'laps', title: 'Which laps count', note: 'The start of the race, very slow laps and the yellow flag' }
    ],
    // The form of a push and save system has a rail (1.76.0), as the forms of the other systems do; see penaltysystems.rail. cols: 3 puts three settings on a row (a switch and its two numbers in Wear).
    rail: [
      { id: 'basics', title: 'Basics', ask: 'Does pace change tyres, fuel, or both?', icon: 'sliders', open: true, groups: ['basics'] },
      { id: 'pace', title: 'Pace', ask: 'Where do full push and full saving begin around the selected benchmark?', icon: 'pushsave', open: true, live: true, groups: ['pace'] },
      { id: 'wear', title: 'Wear', ask: 'How much more or less are the tyres and the fuel used up?', icon: 'tyre', open: true, cols: 3, groups: ['wear'] },
      { id: 'laps', title: 'Which laps count', ask: 'The start of the race, very slow laps and the yellow flag', icon: 'flag', optional: true, groups: ['laps'] }
    ],
    used: { entity: 'racesetups', key: 'pushSave' },
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text', placeholder: 'Name this push and save system' },
      { key: 'presets', group: 'basics', label: 'Start from', type: 'pspresets' },
      { key: 'tyres', group: 'basics', label: 'Pace changes tyre wear', ask: 'On tyres', ui: 'switch', on: 'on', third: true, type: 'select', default: Ps.DEFAULTS.tyres, options: [['on', 'On'], ['off', 'Off: tyres wear as usual']] },
      { key: 'fuel', group: 'basics', label: 'Pace changes fuel use', ask: 'On fuel', ui: 'switch', on: 'on', third: true, type: 'select', default: Ps.DEFAULTS.fuel, options: [['on', 'On'], ['off', 'Off: fuel is used as usual']] },
      { key: 'mode', group: 'pace', label: 'Pace benchmark', ui: 'cards', type: 'select', default: Ps.DEFAULTS.mode, options: [['median', 'App Settings pace benchmark', 'Recommended. Uses the method, history and sample requirement in App Settings > Calculations.'], ['legacy', 'Best-lap reference', 'Compatibility mode for an earlier Push & Save system.']] },
      { key: 'previewTrack', group: 'pace', label: 'Preview Track', type: 'ref', ref: 'tracks', blank: 'No preview track', tone: 'pushsave', showIf: [{ mode: ['median'] }], hint: 'For setting up the pace bar only. Its Target Lap Time is shown as the example benchmark in the middle; it never changes the race.' },
      { key: 'paceLine', group: 'pace', label: 'Pace curve', type: 'pstimeline', hint: 'Drag the limits around the benchmark, or use the precise values below.' }, // (the bar: drawn by the form, not a setting)
      { key: 'pushAt', group: 'pace', label: 'Full push: faster than the benchmark by', type: 'number', suffix: '%', min: 0.1, max: 50, default: Ps.DEFAULTS.pushAt, showIf: [{ mode: ['median'] }],
        hint: 'At the benchmark, use and wear are normal. Moving this much faster reaches the full Push value; in between, the effect is smooth.' },
      { key: 'saveAt', group: 'pace', label: 'Full save: slower than the benchmark by', type: 'number', suffix: '%', min: 0.1, max: 100, default: Ps.DEFAULTS.saveAt, showIf: [{ mode: ['median'] }, { mode: ['legacy'] }],
        hint: 'At this much slower than the benchmark, the full Save value applies. Slower laps stay at that value.' },
      { key: 'normal', group: 'pace', label: 'Normal pace: the best lap plus', type: 'number', suffix: '%', min: 0, max: 50, default: Ps.DEFAULTS.normal, showIf: [{ mode: ['legacy'] }],
        hint: 'A lap this much slower than the driver\'s best lap is a normal race lap: the usual wear. Faster is pushing, slower is saving. Driving at the best lap itself (flat out) wears the most. 3 means a driver with a best lap of 10.000 is at normal pace on 10.300.' },
      { key: 'tyreExtra', group: 'wear', label: 'Tyres: wear when flat out is more by', type: 'number', suffix: '%', min: 0, max: 500, default: Ps.DEFAULTS.tyreExtra,
        hint: 'At the Full Push threshold, tyre wear increases by this percentage. In the legacy model, full push means the reference lap. 40 makes 4.5% a lap 6.3% a lap. It needs a Tyre wear system in the race setup.' },
      { key: 'tyreSave', group: 'wear', label: 'Tyres: wear at the most saving pace is less by', type: 'number', suffix: '%', min: 0, max: 90, default: Ps.DEFAULTS.tyreSave,
        hint: 'A lap at the most saving pace (or slower) wears the tyres this many percent less.' },
      { key: 'fuelExtra', group: 'wear', label: 'Fuel: use when flat out is more by', type: 'number', suffix: '%', min: 0, max: 500, default: Ps.DEFAULTS.fuelExtra,
        hint: 'At the Full Push threshold, fuel use increases by this percentage. In the legacy model, full push means the reference lap. It needs a Fuel System in the Race Setup; Push & Save owns all pace-related fuel variation.' },
      { key: 'fuelSave', group: 'wear', label: 'Fuel: use at the most saving pace is less by', type: 'number', suffix: '%', min: 0, max: 90, default: Ps.DEFAULTS.fuelSave,
        hint: 'A lap at the most saving pace (or slower) uses this many percent less.' },
      { key: 'from', group: 'laps', label: 'The effect starts at lap', type: 'number', suffix: 'lap', min: 1, max: 100, default: Ps.DEFAULTS.from,
        hint: 'Laps before this number use normal fuel and wear. The chosen benchmark must also have enough eligible earlier laps; Track target needs no history.' },
      { key: 'slow', group: 'laps', label: 'A lap slower than this is not pace', type: 'number', suffix: '% of the reference lap', min: 101, max: 1000, default: Ps.DEFAULTS.slow,
        hint: 'A lap like a deslot, a long stop or a car that was picked up takes much longer than a driver\'s pace: it wears as usual. 150 means slower than 1.5 times the selected reference lap.' },
      { key: 'yellowSave', group: 'laps', label: 'Laps under the yellow flag or the Safety Car', ui: 'cards', type: 'select', default: Ps.DEFAULTS.yellowSave, options: [['on', 'Count as saving', 'A slow lap there is saving.'], ['off', 'Normal use and wear (legacy: normal pace rules)']],
        hint: 'In the App Settings benchmark model, a full yellow lap uses the maximum configured savings when enabled, after the starting-lap limit. Off means normal use and wear. Yellow laps never teach the normal benchmark. Legacy systems keep their pace-based yellow behaviour.' }
    ]
  },
  // Weather systems: a spell of rain with a forecast, the tyres to change in the pits, and what the wrong tyres cost. Chosen per race setup.
  weathersystems: {
    label: 'Weather system', plural: 'Weather systems', title: ['name'], extra: false, linked: false, list: ['name', 'unit', 'startMode', 'rainMode'], card: ['unit', 'startMode', 'rainMode'],
    // The form shows the fields in these collapsible groups, in this order (a field says which group it is in); a group whose fields are all hidden is hidden too.
    groups: [
      { id: 'basics', title: 'Basics', note: 'Name, and whether the weather is counted in laps or in minutes', open: true },
      { id: 'forecast', title: 'The rain', note: 'When it starts and how long it lasts, with the clouds before and the drying after', open: true },
      { id: 'tyres', title: 'Tyres and penalties', note: 'Which tyres a pit stop gives, and the points for staying on the wrong tyres' },
      { id: 'hinder', title: 'Hindering the cars', note: 'The fuel-strategy cost of the wrong tyres: fuel use, refuelling and tank size', open: true },
      { id: 'conditions', title: 'Track conditions', note: 'Track and air temperature, wind speed and direction for every weather state (shown by the Track Conditions widget, said by the audio)' }
    ],
    // The form of a weather system has a rail (1.74.0), as the forms of the Penalty and Damage systems do; see penaltysystems.rail. cols: 3 puts three settings on a row (the three switches of Hindering the cars).
    rail: [
      { id: 'basics', title: 'Basics', ask: 'Is the weather counted in laps or in minutes?', icon: 'clock', open: true, groups: ['basics'] },
      { id: 'forecast', title: 'The rain', ask: 'When does it start, and how long does it last?', icon: 'weather', open: true, groups: ['forecast'] },
      { id: 'tyres', title: 'Tyres and penalties', ask: 'Which tyres does a pit stop give, and what does staying on the wrong ones cost?', icon: 'tyre', groups: ['tyres'] },
      { id: 'hinder', title: 'Hindering the cars', ask: 'What fuel-strategy cost do the wrong tyres create?', icon: 'wind', optional: true, open: true, cols: 3, groups: ['hinder'] },
      { id: 'conditions', title: 'Track conditions', ask: 'How warm and how windy is it in each kind of weather?', icon: 'thermo', optional: true, groups: ['conditions'] }
    ],
    used: { entity: 'racesetups', key: 'weather' },
    fields: [
      { key: 'name', group: 'basics', label: 'Name', type: 'text', placeholder: 'Name this weather system' },
      { key: 'unit', group: 'basics', label: 'Counted in', ui: 'seg', type: 'select', default: 'laps', options: [['laps', 'Laps of the leader'], ['time', 'Minutes of racing']],
        hint: 'Laps: the weather changes when the leading car has driven that many laps. Minutes: it changes at that time in the race (a paused race does not count). Every number below that says laps or minutes follows this choice.' },
      { key: 'wxLine', group: 'forecast', label: 'The weather of this race', type: 'wxtimeline', hint: 'It follows the numbers you type' }, // (the bar: drawn by the form, not a setting)
      { key: 'startMode', group: 'forecast', label: 'The rain starts', ui: 'cards', type: 'select', default: 'point', icons: { point: 'clock', random: 'dice', director: 'racesetups' },
        options: [['point', 'At a set moment', 'You choose the moment. It is the same every race.'], ['random', 'At a random moment', 'Somewhere between two limits you choose.'], ['director', 'Only when the Race Director says so', 'Nobody knows when it comes.']],
        hint: 'A set or random moment: the forecast decides, and the Race Director only watches. Only when the Race Director says so: nothing happens by itself, he sets Dry, Cloudy, Wet or Clearing with the buttons on the Director page.' },
      { key: 'startAt', group: 'forecast', label: 'The rain starts after', ui: 'sentence', sentence: ['The rain starts after', '{unit}', '', ''], type: 'number', min: 0, default: Wx.DEFAULTS.startAt, showIf: [{ startMode: ['point'] }],
        hint: 'Rain after 8 laps means after the leading car has completed 8 laps. 0 is rain from the start.' },
      { key: 'startFrom', group: 'forecast', label: 'The rain starts at the earliest after', ui: 'sentence', sentence: ['The rain starts at the earliest after', '{unit}', 'and at the latest after', '{unit}'], with: 'startTo', type: 'number', min: 0, default: Wx.DEFAULTS.startFrom, showIf: [{ startMode: ['random'] }] },
      { key: 'startTo', group: 'forecast', label: 'The rain starts at the latest after', ui: 'with', type: 'number', min: 0, default: Wx.DEFAULTS.startTo, showIf: [{ startMode: ['random'] }] },
      { key: 'rainMode', group: 'forecast', label: 'The rain lasts', ui: 'seg', type: 'select', default: 'fixed', options: [['fixed', 'A set time'], ['random', 'A random time (between two limits)']], showIf: [{ startMode: ['point', 'random'] }] },
      { key: 'rainFor', group: 'forecast', label: 'The rain lasts', ui: 'sentence', sentence: ['The rain lasts', '{unit}', '', ''], type: 'number', min: 1, default: Wx.DEFAULTS.rainFor, showIf: [{ startMode: ['point', 'random'], rainMode: ['fixed'] }] },
      { key: 'rainMin', group: 'forecast', label: 'The rain lasts at least', ui: 'sentence', sentence: ['The rain lasts at least', '{unit}', 'and at most', '{unit}'], with: 'rainMax', type: 'number', min: 1, default: Wx.DEFAULTS.rainMin, showIf: [{ startMode: ['point', 'random'], rainMode: ['random'] }] },
      { key: 'rainMax', group: 'forecast', label: 'The rain lasts at most', ui: 'with', type: 'number', min: 1, default: Wx.DEFAULTS.rainMax, showIf: [{ startMode: ['point', 'random'], rainMode: ['random'] }] },
      { key: 'cloudyFor', group: 'forecast', label: 'Cloudy before the rain (0 = none)', type: 'number', min: 0, suffix: '{unit}', default: Wx.DEFAULTS.cloudyFor, showIf: [{ startMode: ['point', 'random'] }],
        hint: 'The warning: the sky clouds over before the rain starts. A pit stop in Cloudy puts Wet (or Intermediate) tyres on the car. If the rain starts sooner than this, it is cloudy from the start.' },
      { key: 'clearingFor', group: 'forecast', label: 'Clearing after the rain (0 = none)', type: 'number', min: 0, suffix: '{unit}', default: Wx.DEFAULTS.clearingFor, showIf: [{ startMode: ['point', 'random'] }],
        hint: 'The rain has stopped and the track is drying. A pit stop in Clearing puts the dry tyres back (or Intermediate). Cars do not have to change yet.' },
      { key: 'sameInHeats', group: 'forecast', label: 'In every heat', ui: 'seg', type: 'select', default: 'same', options: [['same', 'The same weather in every heat'], ['new', 'New random weather in every heat']], showIf: [{ startMode: ['random'] }, { startMode: ['point'], rainMode: ['random'] }],
        hint: 'Only used when something is random. The same weather keeps the heats fair.' },
      { key: 'cloudyTyre', group: 'tyres', label: 'A pit stop in Cloudy gives', ui: 'seg', type: 'select', default: 'wet', options: [['wet', 'Wet tyres'], ['inter', 'Intermediate tyres']] },
      { key: 'clearingTyre', group: 'tyres', label: 'A pit stop in Clearing gives', ui: 'seg', type: 'select', default: 'dry', options: [['dry', 'The tyres of the car (dry)'], ['inter', 'Intermediate tyres']] },
      { key: 'react', group: 'tyres', label: 'Laps to change tyres when the weather asks for it', full: true, type: 'number', min: 0, suffix: 'laps', default: Wx.DEFAULTS.react,
        hint: 'When it rains a car on dry tyres has to come into the pits within this many laps; when it is dry again a car on Wet or Intermediate tyres has to. A car that does not is given the points below. Cloudy and Clearing ask for nothing.' },
      { key: 'wetPoints', group: 'tyres', label: 'Penalty points for not switching to Wet tyres', type: 'number', min: 0, suffix: 'points', default: Wx.DEFAULTS.wetPoints, hint: 'Needs a penalty system in the race setup. Without one the car is only called out and hindered. 0 = no points.' },
      { key: 'dryPoints', group: 'tyres', label: 'Penalty points for not switching back to dry tyres', type: 'number', min: 0, suffix: 'points', default: Wx.DEFAULTS.dryPoints },
      { key: 'repeat', group: 'tyres', label: 'The points are given', full: true, ui: 'seg', type: 'select', default: 'once', options: [['once', 'Once'], ['every', 'For every lap until the car has changed tyres']] },
      { key: 'hinder', group: 'hinder', label: 'Apply a wrong-tyre fuel handicap', ask: 'Apply a wrong-tyre fuel handicap', ui: 'switch', on: 'on', type: 'select', default: 'on', options: [['on', 'Yes: they use more fuel and refuel slower (needs a Fuel system)'], ['off', 'No']],
        hint: 'This changes fuel strategy, not measured lap times: cars can use more fuel, refuel slower and have a smaller tank. It works like Balance of Power: percentages are added per enabled effect (never more than 90%). It stops when the car has the right tyres. Cars that are hindered are shown on the Director page.' },
      { key: 'hUse', group: 'hinder', label: 'Hinder the fuel use', ask: 'Hinder the fuel use', ui: 'switch', on: 'on', third: true, type: 'select', default: 'on', options: [['on', 'Yes'], ['off', 'No']], showIf: [{ hinder: ['on'] }] },
      { key: 'hRate', group: 'hinder', label: 'Hinder the refuelling speed', ask: 'Hinder the refuelling speed', ui: 'switch', on: 'on', third: true, type: 'select', default: 'on', options: [['on', 'Yes'], ['off', 'No']], showIf: [{ hinder: ['on'] }] },
      { key: 'hTank', group: 'hinder', label: 'Make the tank smaller', ask: 'Make the tank smaller', ui: 'switch', on: 'on', third: true, type: 'select', default: 'off', options: [['off', 'No'], ['on', 'Yes']], showIf: [{ hinder: ['on'] }] },
      { key: 'wxHinder', group: 'hinder', label: 'Wrong-tyre fuel handicap map', type: 'wxhinder', showIf: [{ hinder: ['on'] }] }, // (the table of the 12 numbers: drawn by the form, the numbers are the settings below)
      ...WX_TABLE,
      WX_COND[0],
      { key: 'wxCond', group: 'conditions', label: 'The conditions in every kind of weather', type: 'wxcond' }, // (the table of the 16 numbers: drawn by the form)
      ...WX_COND.slice(1)
    ]
  },
  // Timing page layouts, built in the layout editor (Customization > Layout Editor).
  layouts: { label: 'Layout', plural: 'Layouts', title: ['name'], internal: true, fields: [] },
  raceclasses: { label: 'Racing class', plural: 'Racing classes', title: ['name'], fields: [
    {key:'name',label:'Class name',type:'text'}, {key:'color',label:'Class colour',type:'color',default:'#63b9db'},
    {key:'icon',label:'Class icon',type:'select',default:'car',options:[['car','Car'],['driver','Driver'],['layers','Team'],['none','No icon'],['racesetups','Flag']]}] },
  resourcesystems: {label:'Resource System',plural:'Resource Systems',title:['name'],internal:true,fields:[]},
  multiclasssystems: { label:'Multi-Class System',plural:'Multi-Class Systems',title:['name'],internal:true,fields:[] },
  virtualrivalsystems: { label: 'Virtual Rival System', plural: 'Virtual Rival Systems', title: ['name'], internal: true, fields: [] },
  // Picture sets for the Fuel and Race flag widgets, made in Customization > Image Settings and chosen in the widget.
  audiosets: { label: 'Audio set', plural: 'Audio sets', title: ['name'], internal: true, fields: [] },
  customwidgets: { label: 'Custom widget', plural: 'Custom widgets', title: ['name'], internal: true, fields: [] },
  imagesets: { label: 'Image set', plural: 'Image sets', title: ['name'], internal: true, fields: [] },
  // Rotation setups (1.6.0): a heat plan made by hand, in Race Setup > Rotation Setups, and chosen in a race setup (see rotation.js).
  rotationsetups: { label: 'Rotation setup', plural: 'Rotation setups', title: ['name'], internal: true, fields: [] },
  // Championships (1.55.0): rounds with their sessions, and a roster of drivers, made in Race Setup > Championships (see championship.js). A session that counts for one carries the tag of it (session.champ).
  championships: { label: 'Championship', plural: 'Championships', title: ['name'], internal: true, fields: [] },
  // Leaderboard row designs, built in Customization > Leaderboard Editor.
  chartdesigns: { label: 'Chart design', plural: 'Chart designs', title: ['name'], internal: true, fields: [] },
  rowdesigns: { label: 'Row design', plural: 'Row designs', title: ['name'], internal: true, fields: [] },
  // Saved by the app itself while racing; never edited through forms.
  sessions: { label: 'Session', plural: 'Sessions', title: ['setupName'], internal: true, fields: [] },
  laps: { label: 'Lap', plural: 'Laps', title: ['lapNumber'], internal: true, fields: [] }
};
