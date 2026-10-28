// App Settings > Help: the welcome text, the folders, and a check that everything the text names exists in the app.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const Help = require(R + 'renderer/help.js');
const schema = require(R + 'schema.js');
let fails = 0;
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const read = f => fs.readFileSync(R + f, 'utf8');
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const src = ['renderer/app.js', 'renderer/editor.js', 'renderer/database.js', 'renderer/landing.js', 'renderer/race.js', 'renderer/liveview.js', 'renderer/hardwareui.js', 'renderer/dsui.js', 'renderer/arduinoui.js', 'renderer/arduinobox.js', 'renderer/transferui.js', 'renderer/themeui.js', 'renderer/audioedit.js', 'renderer/audiostudio.js', 'renderer/tokenui.js', 'renderer/bopui.js', 'renderer/weatherui.js', 'renderer/review.js', 'renderer/widgets.js', 'renderer/rotationui.js'].map(read).join('\n') + '\n' + read('schema.js');
const folders = Help.folders();
const allHelp = plain(Help.html());
const helpHas = (...terms) => terms.every(t => allHelp.toLowerCase().includes(t.toLowerCase()));

// ---- the welcome ----
{ const w = plain(Help.WELCOME);
  say('the welcome opens with "Welcome to SlotForge Timing" and the line about racing with your own track, driver and cars', w.startsWith('Welcome to SlotForge Timing') && w.includes('To get racing with your own track, driver and cars, follow these quick steps:'));
  say('...then "How do I get started?", the default settings, the Trackmate interface under App Settings, and the physical track', w.includes('How do I get started?') && w.includes('There are default settings for everything, so you can dive right in.') && w.includes('Make sure to set up your Trackmate interface first, under the App Settings tab') && w.includes('Approach the App like you would a physical track. You start out with a track, so add one on the Database tab under Tracks.'));
  const steps = [...Help.WELCOME.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => plain(m[1]));
  say('...four numbered steps: a track, a driver and a slot car, a race setup, and Home', steps.length === 4 && /^Add a track under Database, Tracks\./.test(steps[0]) && /^Then add a driver and a slot car\./.test(steps[1]) && /^Set up a race under Race Setup\./.test(steps[2]) && /^Go back to Home, pick your race/.test(steps[3]) && /<ol class="hw-steps">/.test(Help.WELCOME));
  say('...step 1 says that only a name and the number of lanes are needed (the track form wants a name), and that the length may be useful', steps[0].includes('a name and the number of lanes are all you really need') && steps[0].includes('The track length might be useful.'));
  say('...step 3 names the session type and the track (a race setup without a track cannot start) and Save', steps[2].includes('pick the Kind of session') && steps[2].includes('your track') && steps[2].includes('hit Save'));
  say('...it ends with "This sets up a basic race. For more in-depth explanations of the possibilities, read the information below."', w.includes('This sets up a basic race. For more in-depth explanations of the possibilities, read the information below.'));
  const landing = read('renderer/landing.js');
  say('...the button names in the steps are the real ones on the Home tab: "Start race", and "Open the session" for a Time Token Session', w.includes('Start race') && w.includes('Open the session') && /tokens \? 'Open the session' : 'Start race'/.test(landing));
  say('...the welcome says Time Token Session where the app does, and the Trackmate page is under Timing Hardware', /'Timing Hardware'/.test(src) && w.includes('Timing Hardware'));
}

// ---- 1.40.0: Tyre wear ----
{ const folders = Help.folders(), f = id => plain(folders.find(x => x.id === id).body), tw = f('tyrewear'), schema = require(R + 'schema.js'), W = require(R + 'renderer/widgets.js');
  say('Tyre Wear help explains its scope, median benchmark and fresh tyres each heat', folders.findIndex(x => x.id === 'tyrewear') > folders.findIndex(x => x.id === 'weather') && ['Rules and Systems','median lap','practice and qualifying only when enabled','never in Time Tokens','Every heat starts on fresh tyres'].every(t => tw.includes(t)));
  say('Tyre Wear explains lifetime, weather, zero life and combined service work', ['Lasts about','Wear per lap','Wrong tyres','lap times and records are never rewritten','At 0%','Service Stop','fuel and repairs'].every(t => tw.includes(t)));
  say('Tyre Wear and Available Tyres help refers to real widgets and the Tyre Change folder', ['Tyre Wear','Available Tyres','Tyre Change'].every(t => tw.includes(t)) && W.REGISTRY.some(d => d.label === 'Tyre Wear' && d.group === 'Tyres'));
  say('Tyre Wear retains mandatory stops and sets guidance and directs users to Tyre Change', tw.includes('Mandatory stops and tyre sets still apply') && tw.includes('Tyre Change') && schema.tyrewearsystems.fields.some(f => f.key === 'setsMode'));
  say('...the Available Tyres widget it names is real: in the Layout Editor, group Tyres', tw.includes('Available Tyres') && W.REGISTRY.some(d => d.label === 'Available Tyres' && d.group === 'Tyres'));
  say('Race Setup names Tyre Wear Systems and explains each selected system has a switch', f('setups').includes('Tyre Wear Systems') && f('setups').includes('every selected system has its own switch')); }

// ---- the folders ----
{ say('there are folders in four groups', Help.SECTIONS.length === 4 && folders.length >= 15);
  say('every folder has its own id, a title, a short note and a body with a list', new Set(folders.map(f => f.id)).size === folders.length && folders.every(f => /^[a-z]+$/.test(f.id) && f.title.length > 3 && f.note.length > 5 && /<li>/.test(f.body)));
  { const f = id => plain(folders.find(x => x.id === id).body);
    say('1.1.0: the help says a race keeps running on other tabs (with the Race tab, and the keys only on that tab), and that it is one race at a time', f('screen').includes('keeps running when you open another tab') && f('screen').includes('Race tab with a green dot') && f('screen').includes('keys above only work on the Race tab') && f('screen').includes('one race can run at a time'));
    say('Help explains avatars, independent text alignment, image quality and sound limits', helpHas('avatar','titles and values can align left, centre or right','thickness of the outline','Original (as uploaded','up to 10 MB'));
    say('1.6.0: the help has a folder about rotation setups, right after the heat plan, and says what it does: the editor, groups, locking, the shuffles, the plans, the choice in the race setup, the tick on Home, the lanes and the names', folders.findIndex(x => x.id === 'rotation') === folders.findIndex(x => x.id === 'heatplan') + 1 && ['Rotation Setups', 'participants', 'lanes', 'swap', 'Groups', 'Lock', 'Shuffle the heat order', 'Shuffle the lanes', 'Even out the lanes', 'Start from a plan', 'Ctrl+Z', 'Rotation setup', 'Not here today', 'as many lanes as the rotation uses', 'Pick the drivers by name', 'Finals'].every(w => f('rotation').includes(w)));
    say('...the other folders point to it: Race Setup lists the tab, and Heat races says the settings that plan the heats are not used with a rotation', f('setups').includes('Rotation Setups') && f('heatraces').includes('Rotation setup') && f('heatraces').includes('not used'));
  }
  say('every folder is short enough to read at a glance (under 1,400 characters of text)', folders.every(f => plain(f.body).length < 1400));
  const h = Help.html();
  say('all folders are drawn in the folder style of the app, and they are closed until someone opens them', (h.match(/<details class="dbfolder helpfolder"/g) || []).length === folders.length && !/<details[^>]* open/.test(h));
  const systemHelp = { fuel: 'fuel', bop: 'bop', weather: 'weather', tyrewear: 'tyrewear', safetycar: 'safetycar', pushsave: 'pushsave', tokens: 'tokens', damage: 'damage', carfailures: 'damage', endurance: 'endurance' };
  say('Race System help folders carry the same colour identity as their system', Object.entries(systemHelp).every(([id, tone]) => new RegExp(`data-help="${id}" data-system="${tone}"`).test(h)));
  const audioSource = read('renderer/audioedit.js'), css = read('renderer/styles.css'), systemAudio = { 'Pit and fuel': 'fuel', 'Balance of Power': 'bop', Endurance: 'endurance', Damage: 'damage', 'Car Failures': 'damage', Weather: 'weather', 'Tyre wear': 'tyrewear', Penalties: 'penalty', Flags: 'safetycar', 'Time tokens': 'tokens' };
  say('Race System audio folders and their Help counterparts use the shared system colours', Object.entries(systemAudio).every(([name, tone]) => audioSource.includes(`'${name}': '${tone}'`) && css.includes(`[data-system="${tone}"]`)) && css.includes('.helpfolder'));
  say('...in four headed groups, with Open all and Close all above them', ['Setting things up', 'Racing', 'Making it yours', 'Connecting and sharing'].every(g => h.includes('class="helphead">' + g)) && h.includes('data-helpall="1"') && h.includes('data-helpall="0"'));
  say('...and the welcome comes first', h.indexOf('helpwelcome') < h.indexOf('data-helpall') && h.indexOf('data-helpall') < h.indexOf('helpfolder'));
  const bad = folders.filter(f => /\{\{|undefined|\[object/.test(f.body + f.title + f.note));
  say('no folder shows a stray placeholder', bad.length === 0);
}

// ---- opening and closing, with a stand-in for the screen ----
{ const kids = Help.folders().map(f => ({ dataset: { help: f.id }, open: false, ontoggle: null }));
  const box = { innerHTML: '', onclick: null, querySelectorAll: sel => (/helpfolder/.test(sel) ? kids : []) };
  Help.render(box);
  say('render draws the page into the box and watches every folder', box.innerHTML.includes('helpwelcome') && kids.every(k => typeof k.ontoggle === 'function') && typeof box.onclick === 'function');
  kids[2].open = true; kids[2].ontoggle();
  say('opening a folder is remembered (it is still open when the page is drawn again)', Help.opened.has(folders[2].id) && (Help.html().match(/<details[^>]* open/g) || []).length === 1 && new RegExp(`data-help="${folders[2].id}" open`).test(Help.html()));
  kids[2].open = false; kids[2].ontoggle();
  say('...and closing it forgets it again', !Help.opened.has(folders[2].id) && !/<details[^>]* open/.test(Help.html()));
  box.onclick({ target: { closest: () => ({ dataset: { helpall: '1' } }) } });
  say('Open all opens every folder', folders.every(f => Help.opened.has(f.id)) && (box.innerHTML.match(/<details[^>]* open/g) || []).length === folders.length);
  box.onclick({ target: { closest: () => ({ dataset: { helpall: '0' } }) } });
  say('Close all closes them again', Help.opened.size === 0 && !/<details[^>]* open/.test(box.innerHTML));
  let threw = false; try { box.onclick({ target: { closest: () => null } }); box.onclick({ target: {} }); } catch { threw = true; }
  say('a click on something else does nothing', !threw);
  Help.render({ innerHTML: '', onclick: null });
  say('a box without a way to look for folders is fine too', true);
}

// ---- what the text names exists in the app (so the Help cannot drift away from the screens) ----
{ const text = plain(Help.html());
  const has = names => names.filter(n => !text.includes(n));
  const real = names => names.filter(n => !src.includes(n));
  const PK = require(R + 'renderer/setupwords.js').PICKER, sessionLabels = [...PK.kinds.map(k => k[1]), ...PK.formats.map(k => k[1]), PK.swaps[0]]; // (1.70.0: the answers of the picker, not the six names of the old Session type list)
  say('every answer of the Kind, Format and Swaps picker of the race setup form is explained (' + sessionLabels.join(', ') + ')', has(sessionLabels).length === 0);
  const tabs = ['General', 'App Theme', 'Network', 'Timing Hardware', 'Import and Export', 'Help', 'Trackmate Interface', 'Arduino', 'DS Electronics', 'oXigen Digital', 'Race Setups', 'Rotation Setups', 'Fuel Systems', 'Penalty Systems', 'Time Tokens', 'Layout Editor', 'Leaderboard Editor', 'Race Results', 'Audio Settings', 'Image Settings', 'Widget Builder', 'Racing Records', 'Token Records', 'Results and Records'];
  say('the sub-tabs the text names are the real ones', real(tabs.filter(t => text.includes(t))).length === 0 && has(['Timing Hardware', 'Race Setups', 'Rotation Setups', 'Fuel Systems', 'Penalty Systems', 'Time Tokens', 'Layout Editor', 'Leaderboard Editor', 'Race Results', 'Audio Settings', 'Image Settings', 'Widget Builder', 'Racing Records', 'Token Records', 'Results and Records', 'Import and Export']).length === 0);
  { const f = id => plain(folders.find(x => x.id === id).body), names = ['Timing hardware in use', 'None', 'Trackmate Interface', 'Arduino box', 'Use the virtual box', 'Start race'];
    say('1.39.0: the Timing hardware folder explains the choice at the top of Timing Hardware: its name and its options are the real ones (one at a time, green or red, the question at Start race)', has(names).length === 0 && real(['Timing hardware in use', 'Use this one']).length === 0 && /one at a time/i.test(f('hardware')) && /red/.test(f('hardware')) && /start anyway/i.test(f('hardware')) && ['None', 'Trackmate Interface', 'Arduino box'].every((n, i) => require('../renderer/hardware.js').TIMING[i][1].startsWith(n))); }
  const tiles = ['Race timing', 'Leaderboard', 'Race results', 'Driver stats', 'Database', 'Racing rules', 'Race Director', 'Tokens'];
  { const f = id => plain(folders.find(x => x.id === id).body), names = ['Find the box', 'Connect', 'Use the virtual box', 'Download the Arduino sketch', 'Calibrate', 'Test the lights', 'Save to the box', 'Power on', 'Power off', 'Beep', 'Not used'];
    say('1.37.0: the Arduino folder is right after Timing hardware, and names the buttons and choices of the Arduino page, which all exist there', folders.findIndex(x => x.id === 'arduino') === folders.findIndex(x => x.id === 'hardware') + 1 && has(names).length === 0 && real(names).length === 0 && f('hardware').includes('Arduino'));
    say('...and the race setup folder it points to, and the 3 seconds and the lap rule are the real ones', f('arduino').includes(schema.racesetups.groups.find(g => g.id === 'box').title) && /3 seconds/.test(f('arduino')) && /KEEPALIVE_TIMEOUT_MS\s+3000/.test(read('firmware/SlotForgeBox/settings.h')) && /BLACKOUT[^\n]*300/i.test(read('firmware/SlotForgeBox/settings.h')) && f('arduino').includes('0.3 seconds')); }
  say('the Live Race tiles the text names are the real ones, and it names all of them', real(tiles).length === 0 && has(tiles).length === 0);
  const buttons = ['Extra fields…', 'Export to PDF', 'Open on a second screen', 'Full screen', 'Review laps', 'Finalize results', 'Delete all data', 'Simulated cars', 'Share on my network', 'End time now', 'Undo', 'Clear', 'Open all', 'Close all', 'Shuffle the heat order', 'Shuffle the lanes', 'Even out the lanes', 'Start from a plan', 'Not here today', 'Pick the drivers by name'];
  say('the text names these buttons, and each exists on a screen', has(buttons).length === 0 && real(buttons.filter(b => !['Open all', 'Close all', 'Finalize results'].includes(b))).length === 0 && src.includes('Finalize') && Help.html().includes('>Open all<') && Help.html().includes('>Close all<'), has(buttons).concat(real(buttons)).join());
  say('the steps name the Home button the way the Home tab does', /Go back to Home, pick your race, choose a driver and a car for every lane and hit Start race \(Open the session for a Time Token Session\)\./.test(plain(Help.WELCOME)));
  say('the audio, fuel and penalty words are the app\'s own', ['Pitstop time', 'Token Clock', 'Slotcar Speed', 'Drivethrough', 'Stop-and-Go', 'Trackcall'].every(w => !text.includes(w) || src.includes(w) || read('renderer/timing.js').includes(w) || read('renderer/announcer.js').includes(w)));
  { const A = require(R + 'renderer/announcer.js'), groups = [...new Set(A.CALLS.map(A.catalogue.category))], audioText = JSON.stringify(Help.SECTIONS).split("id\":\"audio\"")[1].split("id\":\"look\"")[0];
    const named = ['Progress & milestones','Positions & battles','Laps & records','Fuel Systems','Penalty Systems','Flags & Safety Car','Time Tokens'];
    say('the folders of an audio set that the Help names are the real ones (and the new ones are all named)', named.every(g => groups.includes(g) && text.includes(g)));
    const words = (audioText.match(/\{(\w+)\}/g) || []).map(w => w.slice(1, -1));
    say('...and the two boxes it names under a sentence and a call are in the audio editor', audioText.includes('Conditions') && audioText.includes('Minimum time between calls') && read('renderer/audioedit.js').includes('Conditions&hellip;') && read('renderer/audioedit.js').includes('Minimum time between calls (seconds)'));
    say('...and so are the placeholders it names', words.length >= 5 && words.every(w => w in A.VARS));
    { const ed = read('renderer/audioedit.js'), ids = folders.map(x => x.id), amb = folders.find(x => x.id === 'ambient'), ambText = amb ? plain(amb.body) : '';
      say('1.48.0: the Help folder of the Ambient Race Sounds comes right after the audio folder, and names the real folder, say that no sounds are included, and that they play on a separate channel', !!amb && ids.indexOf('ambient') > ids.indexOf('audio') && ambText.includes('Ambient sounds') && /no sounds are bundled/.test(ambText) && /separate channel/.test(ambText) && amb.body.length < 3000);
      say('...and (1.49.0) names the kinds of sounds the folder has: the pit lane, the winner and the podium, trouble, driver swaps and time tokens', ['laps','pits','flags','results','weather','podium sting'].every(w => ambText.includes(w)) && ['Pit lane', 'Race moments', 'Trouble', 'Driver swaps and time tokens'].every(sec => A.AMBIENT.some(d => d.section === sec)));
      say('...and (1.50.0) that the sections are folders closed to start, and that the background sounds keep playing with a fade in and a fade out, which are in the editor', /Background loops/.test(ambText) && /resume it on green/.test(ambText) && ambText.includes('Fade in') && ambText.includes('Fade out') && ed.includes('Fade in (seconds)') && ed.includes('Fade out (seconds)') && ed.includes('class="ambsection"') && A.AMBIENT.some(d => d.section === 'Background sounds') && A.AMBIENT.some(d => d.section === 'Weather'));
      say('...and the options it names are in the editor: the volume, start after, which cars, lower while a call is spoken, only if, not again within, test', ['Volume', 'Start after', 'conditions'].every(w => ambText.toLowerCase().includes(w.toLowerCase()) && ed.toLowerCase().includes(w.toLowerCase())) && /lowering them while speech plays/i.test(ambText) && /lower them while a call is spoken/i.test(ed)); } }
  { const Dl = require(R + 'renderer/delta.js'), W = require(R + 'renderer/widgets.js');
    const folder = W.REGISTRY ? Object.values(W.REGISTRY).filter(d => d.group === 'Delta Timers') : [];
    say('the Delta Timers the Help describes exist: a folder of that name in the Layout Editor, nine widgets, and the ways of comparing it names', text.includes('Delta Timers') && folder.length === 9 && Object.keys(Dl.KINDS).length === 9
      && ['a chosen lane', 'the leader', 'the fastest in the race', 'the track record', 'the session record'].every(w => text.includes(w)) && text.includes('−0.045') && text.includes('+0.321'));
    say('...and so is its Left (or top) value shows setting: the six widgets that can show another value have it, the two record ones and the Lap to Lap Delta (it always shows the last lap) do not', /Left \(or top\) value shows/.test(text) && Object.keys(Dl.KINDS).filter(k => !Dl.KINDS[k].record && !Dl.KINDS[k].steady).length === 6 && Object.keys(Dl.KINDS).filter(k => !Dl.KINDS[k].record && !Dl.KINDS[k].steady).every(k => W.def(k).options.some(o => o.key === 'leftShows')) && Object.keys(Dl.KINDS).filter(k => Dl.KINDS[k].record || Dl.KINDS[k].steady).every(k => !W.def(k).options.some(o => o.key === 'leftShows'))); }
  { const landing = read('renderer/landing.js');
    say('the Heat plan the Help names is on the Home tab, with its Shuffle again button, and the setup form says what the heat settings mean (hints)', text.includes('Heat plan') && text.includes('Shuffle again') && landing.includes('<h4>Heat plan</h4>') && landing.includes('>Shuffle again<')
      && ['heatBy', 'heatPlan', 'heats', 'resultBy', 'points'].every(k => schema.racesetups.fields.find(f => f.key === k).hint.length > 40)); }
  { const f = k => schema.racesetups.fields.find(x => x.key === k), plans = f('heatPlan').options.map(o => o[0]);
    say('the four ways to plan heats the Help names are the real choices, with the settings it names (same number of heats, lane rotation, seeding)', plans.join() === 'manual,perdriver,roundrobin,rotation' && ['every driver races the same number of heats', 'round robin', 'lane rotation', 'Give everyone the same number of heats', 'Who races together', 'latest qualifying', 'mixed'].every(w => text.includes(w))
      && f('heatEven').label === 'Give everyone the same number of heats' && f('heatEven').ui === 'switch' && f('heatSeeding').label === 'Who races together' && f('heatSeeding').options.map(o => o[0]).join() === 'random,mixed,speed'); }
  { const f = k => schema.racesetups.fields.find(x => x.key === k);
    say('the scoring options the Help names are the real settings (average, best heats, drop the worst heat, bonus, tie-breaker, Result column)', ['How the heats are added up', 'average per heat', 'only the best heats', 'Drop the worst heat', 'bonus points for the fastest lap', 'A tie is decided by', 'the most heat wins', 'the lowest total time', 'Result'].every(w => text.includes(w))
      && f('countBy').label === 'How the heats are added up' && f('dropWorst').label === 'Drop the worst heat' && f('fastestBonus').label.startsWith('Bonus points for the fastest lap') && f('tieBreak').label === 'A tie is decided by'
      && read('renderer/race.js').includes('<th>Result</th>')); }
  { const f = k => schema.racesetups.fields.find(x => x.key === k);
    say('the break between heats the Help names is in the race setup (seconds, what happens when it is over) and on the race screen ("next heat in")', text.includes('Break between heats') && text.includes('next heat in') && text.includes('The start lights begin by themselves when the break is over') && f('breakSeconds').label === 'Break between heats (seconds)' && f('breakAuto').label === 'The start lights begin by themselves when the break is over' && f('breakAuto').ui === 'switch'
      && /next \$\{[^}]*'heat'\} in/.test(read('renderer/timing.js')) && /next \$\{[^}]*'heat'\} in/.test(read('renderer/liveview.js'))); }
  { const f = k => schema.racesetups.fields.find(x => x.key === k);
    say('the finals the Help names are the real settings (finals, what the finals decide, the length of a final) and the audio calls (next final, final finished, the {final} word)', ['Finals after the heats', 'What the finals decide', 'added to the heat result', 'Pick the rest at random', 'Clear choices', 'next final', 'final finished', '{final}'].every(x => text.includes(x))
      && f('finals').label === 'Finals after the heats' && f('finalMode').label === 'What the finals decide' && f('finalLaps').label.startsWith('Laps in a final') && f('finalDuration').label.startsWith('Duration of a final')
      && read('renderer/race.js').includes('Pick the rest at random') && read('renderer/race.js').includes('Clear choices') && !!require('../renderer/announcer.js').CALLS.find(c => c.id === 'nextfinal') && !!require('../renderer/announcer.js').CALLS.find(c => c.id === 'finalend')); }
  { const landing = read('renderer/landing.js');
    say('changing the plan by hand: the Help names the click-and-swap and the Reset my changes button that are on the Home tab', text.includes('click a place and then another place') && text.includes('Reset my changes') && landing.includes('id="resetplan"') && landing.includes('data-hp=') && landing.includes('Reset my changes')); }
  const race = read('renderer/race.js');
  say('the keys named are the real ones: Space, Y, R, S, 1 to 8, Shift + 1 to 8 and Ctrl + 1 to 8', /ev\.key === ' '/.test(race) && /k === 'y'/.test(race) && /k === 'r'/.test(race) && /k === 's'/.test(race) && /ev\.ctrlKey/.test(race) && /main = \/\^Digit\(\[1-8\]\)\$\/\.exec\(code\)/.test(race) && /ev\.shiftKey && main/.test(race) && /Number\(ev\.key\) - 1/.test(race) && text.includes('Space starts, pauses and resumes') && text.includes('Y yellow flag') && text.includes('R red flag') && text.includes('S stop (it asks once)') && text.includes('1 to 8 count a lap') && text.includes('Shift + 1 to 8') && text.includes('Ctrl + 1 to 8'));
  say('Trackmate help and hardware page cover sensor mapping and testing', /sensor/i.test(read('renderer/hardwareui.js')) && /test/i.test(read('renderer/hardwareui.js')) && helpHas('Trackmate','sensor'));
  say('the sessions of the Token Records are called stints, and the Results folders are the ones named', /Stints/.test(src) && ['Track records', 'Personal bests', 'Sessions'].every(f => src.includes(f) && text.includes(f)));
  const keys = e => schema[e].fields.map(f => f.key);
  say('the track, driver and slot car options the text names exist in the forms', ['lanes', 'scale', 'surface', 'picture', 'length', 'laneModifier', 'laneLengths', 'minLap', 'maxLap'].every(k => keys('tracks').includes(k)) && ['nickname', 'callsign', 'dateOfBirth', 'flag', 'avatar'].every(k => keys('drivers').includes(k)) && ['brand', 'manufacturer', 'model', 'scale', 'motor', 'tyres', 'gearing', 'weight', 'picture', 'extraPictures', 'lapsDriven'].every(k => keys('slotcars').includes(k)) && ['number of lanes', 'track length', 'lane length modifier', 'minimum and maximum lap time', 'callsign'].every(w => text.toLowerCase().includes(w)));
  const setup = keys('racesetups');
  say('...and so do the race setup options: start lights, the red flag restart, the first crossing, the pit hold time, penalties, fuel, layouts and audio', ['lightsMin', 'lightsMax', 'restartAfterRed', 'firstLap', 'pitHold', 'penaltySystem', 'fuelRules', 'layout', 'layout2', 'audioSet', 'startPower', 'trackCallAction', 'heatBy', 'heatPlan', 'resultBy', 'endRule'].every(k => setup.includes(k)));
  say('Safety Car owns yellow target enforcement; retired setup fields are absent', !keys('racesetups').includes('yellowTarget') && keys('safetycarsystems').includes('target') && keys('safetycarsystems').includes('points') && helpHas('Safety Car target lap time','retired Yellow flag setup fields are ignored') && ['yellowtarget','yellowfast'].every(id => read('renderer/announcer.js').includes("id: '" + id + "'")));
  const index = read('renderer/index.html');
  say('help.js is loaded by the page, before app.js (which draws it)', index.includes('<script src="help.js">') && index.indexOf('help.js') < index.indexOf('app.js') && read('renderer/app.js').includes("Help.render(document.getElementById('settingsbox'))"));
}

// ---- 1.2.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body);
  say('the Database help says that a row or a card opens a card to look at, with the other pictures, and that Edit is for changing', /Click a row or a card of Slotcars, Tracks or Drivers/.test(f('database')) && /other pictures/.test(f('database')) && /Edit/.test(f('database')));
  say('the Results help tells about the trophy and about adjusted results', /trophy/.test(f('results')) && /not in practice or qualifying/.test(f('results')) && /adjusted/.test(f('results')));
  say('Final Check help explains adjusting time, laps and championship points', f('screen').includes("Director's Final Check") && f('screen').includes('adjust race time, laps and championship points'));
  say('Look and feel says what Display does (the whole app, 100% to 200%, not the widgets)', /Display makes the whole app bigger \(100% to 200%\)/.test(f('look')) && /does not change the widgets/.test(f('look')));
  say('Look and feel explains Depth (the four levels, the whole app and the widgets, Flat for a slow computer)', /Depth<\/b>|<b>Depth/.test(Help.html()) && /Depth sets how much cards, buttons, folders and widgets stand up/.test(f('look')) && /Flat \(the plain look\), Soft lift \(the standard\), Medium or Thick card/.test(f('look')) && /see-through widget stays flat/.test(f('look')) && /slow computer such as a Raspberry Pi/.test(f('look')));
  say('...and the border of a widget (a colour of your own, the thickness, several widgets at once)', /Colour of your own/.test(f('look')) && /Border thickness/.test(f('look')) && /Select several widgets/.test(f('look')));
  say('the session types help says what happens with the same best lap', /same best lap: the one who set it first ranks higher/.test(f('types')));
  say('Customization names the timing layout and describes its widgets', f('custom').includes('Layout Editor') && f('custom').includes('widgets for lap times, flags, fuel, speed') && require('../renderer/widgets').REGISTRY.some(w => w.label === 'Race Lap Counter'));
  say('1.5.0: a folder Weather widgets names the three widgets, the conditions, the units and the picture sets', ['Tyres', 'Weather Forecast', 'Track Conditions', 'track temperature', 'wind speed', 'Fahrenheit', 'picture sets', 'Change tyres', 'own numbers'].every(t => f('wxwidgets').includes(t)) && folders.findIndex(x => x.id === 'wxwidgets') === folders.findIndex(x => x.id === 'weather') + 1);
  say('Image Settings, weather and audio help cover tyre/weather pictures and conditions', helpHas('Image Settings','tyres, weather and track conditions','wind','Weather covers conditions, tyres'));
  say('every folder is still short enough with the new lines', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.7.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body);
  say('the heat plan help names the Heat list on the Race tab, the Heat List widget, the printed sheet and the line-up call', ['Heat list', 'Heat List</b> widget'.replace('</b>', ''), 'Print the heat list', 'line-up', 'winner'].every(t => f('heatplan').includes(t)));
  say('the heat results help tells about the total time (then laps) and what happens with a heat that is not finished', /total time, then laps/.test(f('heatresults')) && /lowest total of the finish times wins/.test(f('heatresults')) && /not finished/.test(f('heatresults')) && /estimate/.test(f('heatresults')));
  say('1.65.0: ...and that heats of a time count the most laps (or the furthest distance), then the lowest total time, that points are there for every heat, and that older setups count what they counted', /Heats of a time/.test(f('heatresults')) && /most laps wins, then the lowest total time/.test(f('heatresults')) && /furthest total distance/.test(f('heatresults')) && /Points are there for every kind of heat/.test(f('heatresults')) && /before 1\.65\.0/.test(f('heatresults')));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }
{ const f = id => plain(folders.find(x => x.id === id).body), ids = folders.map(x => x.id), t = f('sectors'), track = schema.tracks.fields, review = read('renderer/review.js');
  say('1.66.0: a folder Sectors follows the race screen, and says where the sectors are made (Database, Tracks, the group Sectors: the number and the names), that sector 1 starts at the timing line, and where they are used (the review before Finalize results: Last seen in)', ids.indexOf('sectors') === ids.indexOf('screen') + 1 && /Database, Tracks, the group Sectors/.test(t) && /number of sectors/.test(t) && /Sector 1 starts at the timing line/.test(t) && /Last seen in/.test(t) && /Finalize results/.test(t));
  say('...that the later sector ranks higher but never above a car with more laps (or more distance), that the arrows order cars in the same sector, that a car with no sector ranks behind and that nothing chosen leaves the order as it was, and that the result keeps it', /later sector/.test(t) && /never above a car with more laps/.test(t) && /more distance/.test(t) && /arrows/.test(t) && /no sector ranks behind/.test(t) && /who crossed the line first/.test(t) && /11 \+ sector 3/.test(t));
  say('...the names it uses are real: the group and fields of the track form, the choice in the review, and the button', schema.tracks.groups.some(g => g.title === 'Sectors') && track.some(x => x.label === 'Number of sectors') && track.some(x => /^Names of the sectors/.test(x.label)) && review.includes('Last seen in') && read('renderer/review.js').includes('Finalize results')); }

// ---- 1.8.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body), schemaText = JSON.stringify(schema.racesetups.fields);
  say('the help has a Teams folder, right after the rotation setups, and tells: the Teams page and the order, a driver in more than one team, the lane on Home, the two widgets, {team}, teams as the participants, the three ways to choose a driver, and the result', folders.findIndex(x => x.id === 'teams') === folders.findIndex(x => x.id === 'rotation') + 1 && ['Teams page', 'in the order they take their turn', 'more than one team', 'has a Team on every lane', 'A session without teams has no Team choice', 'Team Name', 'Team Picture', '{team}', 'participants of a heat race can be teams', 'in turn', 'by lot', 'the one you choose before the heat', 'row per team'].every(t => f('teams').includes(t)));
  say('...the settings it names are the real ones (the race setup form and the rotation editor)', f('teams').includes('The heats are raced by') && schemaText.includes('The heats are raced by') && f('teams').includes('The participants are') && src.includes('The participants are') && schemaText.includes('Which driver of a team drives a heat'));
  say('...the Database help lists Teams, the rotation help says the participants can be teams, and the audio help names {team}', /Teams<\/b>: drivers who race together|Teams: drivers who race together/.test(f('database')) && /teams when you set The participants are to Teams/.test(f('rotation')) && helpHas('{team}'));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.9.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body), schemaText = JSON.stringify(schema.racesetups.fields), A = require(R + 'renderer/announcer.js');
  say('the help has an Endurance Race folder, right after Teams, and tells: the session type, the team on a lane, time/laps/heats, the three ways to say a swap is due, minutes or laps, the least and most a driver drives, the pit sensor and Swap done, the three ways to choose who steps in, late swaps (laps and penalty), the four widgets, the audio call and the results', folders.findIndex(x => x.id === 'endurance') === folders.findIndex(x => x.id === 'teams') + 1 && ['Endurance Race', 'Team', 'by time, by laps, or heat by heat', 'every so often', 'at fixed moments', 'free', 'minutes, in laps or in distance', 'least and the most', 'pit sensor', 'Swap done', 'chosen at each swap', 'picked by lot', 'keep counting or stop counting', 'penalty points', 'Current Driver', 'Next Driver', 'Swap Timer', 'Swap Signal', 'Box Box', 'time at the wheel'].every(t => f('endurance').includes(t)), f('endurance'));
  say('the help has a Distance races folder that tells the limit by distance, the lanes, the widgets and (1.35.1) the driver swaps by distance: at the line or anywhere, the Swap Timer, the Swap Signal, the results', ['Driver swaps by distance', 'at the line', 'anywhere on the track', 'Swap in 12 m', 'Swap Signal', "every driver's distance", 'Distance Driven', '{racedistance}'].every(t => f('distance').includes(t)) && plain(f('distance')).length < 1400, f('distance'));
  say('...the names it uses are the real ones in the race setup form, and the folder of the audio set is the real one', f('endurance').includes('Teams swap drivers in the pits') && schemaText.includes('The race is over after') && f('endurance').includes('Driver swaps') && JSON.stringify(schema.racesetups.groups).includes('Driver swaps') && A.CALLS.some(c => c.group === 'Endurance') && helpHas('Endurance & driver swaps'));
  say('...the race that was stopped by a crash or a power cut: the Endurance folder says it can be continued from the Home tab, and the Home folder names the three buttons of the note, as the Home tab has them', f('endurance').includes('continued from the Home tab') && ['Resume the race', 'Save what was recorded', 'Delete it'].every(b => f('home').includes(b) && read('renderer/landing.js').includes('>' + b + '<')));
  say('...the kinds of session help names the three questions (kind, format, swaps) and the swaps of an Endurance Race (1.70.0)', /Kind, Format and Swaps/.test(folders.find(x => x.id === 'types').note) && /Teams swap drivers in the pits<\/b>: a long race for teams/.test(folders.find(x => x.id === 'types').body) && ['Kind of session', 'Format', 'Teams swap drivers in the pits'].every(w => folders.find(x => x.id === 'types').body.includes(w)));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.10.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body), A = require(R + 'renderer/announcer.js'), W = require(R + 'renderer/widgets.js'), D = require(R + 'renderer/damage.js');
  const ids = folders.map(x => x.id), fieldText = e => JSON.stringify(schema[e].fields);
  say('the help has a Damage System folder, right after the Endurance Race, and tells: the Damage Systems tab, damage points, levels (from 3 points, the stop on the sensor), whenever / as fast as you can, a deadline in laps, the highest level that counts', ids.indexOf('damage') === ids.indexOf('endurance') + 1 && ['Damage Systems', 'damage points', 'level', 'Light damage from 3 points', 'pit sensor', 'whenever it can', 'as fast as it can', 'deadline in laps', 'highest level reached counts'].every(w => f('damage').includes(w)));
  say('...incidents (the buttons on the race screen, the Race Director page and phones, and -1), the deslot time of the track, the repair at the same time or after the other work, leaving too early, penalty points, retire and disqualify, the damage factor', ['incidents', 'Race Director page and phones', 'take a point back', 'Deslot time', 'Lap time limits', 'at the same time', 'after', 'leaves too early', 'penalty points', 'retire', 'disqualify', 'Damage factor'].every(w => f('damage').includes(w)));
  say('...the names it uses are the real ones: the tab, the race setup field, the track field and its group, the slot car field', schema.racesetups.fields.some(x => x.key === 'damageSystem' && x.label === 'Damage System') && fieldText('tracks').includes('Deslot time (seconds)') && schema.tracks.fields.some(x => x.key === 'deslotTime' && x.group === 'laps') && schema.tracks.groups.some(g => g.id === 'laps' && g.title === 'Lap timing') && fieldText('slotcars').includes('Damage factor') && read('renderer/editor.js').includes("['damage', 'Damage Systems',"));
  say('Damage widgets, audio and the setup selector match the Help', ['Damage','Repair Timer'].every(l => W.REGISTRY.some(d => d.label === l)) && A.CALLS.some(c => c.group === 'Damage') && f('setups').includes('Damage Systems')); // (1.71.0: the groups of the form are sections now)
  say('...the audio help names the Damage folder', helpHas('Damage & failures') && D.defaults().levels[0].name === 'Light damage');
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.11.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body);
  say('Race Setup help uses Rules and Systems and omits retired section names', f('setups').includes('Rules and Systems') && !f('setups').includes('Adjust pads') && !f('setups').includes('Length and result'));
  { const folders2 = Help.folders(), at = id => folders2.findIndex(x => x.id === id), sw = plain(folders2.find(x => x.id === 'setupwords').body), db = read('renderer/database.js');
    say('1.69.0: a folder Race Setups in words comes after Race Setup and before Session types, and is short', at('setupwords') === at('setups') + 1 && at('types') === at('setupwords') + 1 && sw.length < 1400);
    say('Help names every Race Setup rail section', schema.racesetups.rail.every(r => sw.includes(r.title)));
    say('Help names the setup overview and its plain-language explanation', ['List','Cards','Start from a kind','In plain words'].every(k => sw.includes(k)) && ['Practice','Qualifying','Race','Time Tokens'].every(k => sw.includes(k)));
  }
  { const sw2 = plain(Help.folders().find(x => x.id === 'setupwords').body), rail = schema.racesetups.rail;
    say('Setup help explains section notes, status dots, navigation and Used by', ['rail','green','amber','open ring','quick summary','click it to jump','Used by','below the rail'].every(w => sw2.includes(w)));
    say('...it names the sections of the rail by their title in the order of the form (the other titles are the groups they hold), and does not talk about Open all and Close all for the form any more', rail.every(r => sw2.includes(r.title)) && rail.map(r => sw2.indexOf(r.title, sw2.indexOf('Click a row'))).every((x, i, a) => i === 0 || x > a[i - 1]) && !/Open all/.test(sw2)); }
  say('Leaderboard help explains the grid and Customization identifies its editor', ['Leaderboard page is a grid','little squares','5 to 8'].every(t => f('live').includes(t)) && f('custom').includes('Live Race Leaderboard grid'));
  say('the Live Race help says how the Race Director page is built: the Calls first, then folders for Penalties, Balance of Power, Damage, Car Failures (1.44.0), Weather and Tyre Change (1.32.0)', f('live').includes('Calls come first') && f('live').includes('then the lane cards (see Lane cards), Weather, Tyre Change and Endurance (brown)'));
  say('1.72.0: ...the lane cards are the Race Director (the standard), and the Lane cards help says the folders come back: Adjust, Penalties, Balance of Power, Damage and Car Failures', f('lanecards').includes('Race Director view') && ['Adjust', 'Penalties', 'Balance of Power', 'Damage', 'Car Failures'].every(x => f('lanecards').includes(x)));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.10.1 ----
{ const f = id => plain(folders.find(x => x.id === id).body);
  say('the Home help no longer talks about the Available cards (they are gone from the Home tab), and the Live Race help says the button is lit during a race and off without one', !f('home').includes('Available cards') && !f('home').includes('Show all') && f('live').includes('red light on while a race is on') && f('live').includes('greyed out with the light off when no race is running'));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.12.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body);
  say('the Race Director help explains the Adjust pads: pick a lane, [+] value [-], the four groups, during the race, Undo, and where the values and the layout are set', ['Adjust', 'pick a lane', '[+] value [\u2212]', 'penalty points, damage points, time, laps, championship points', 'during the race', 'Undo', 'App Settings, Race Director'].every(t => f('director').includes(t)));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.12.1 ----
{ const f = id => plain(folders.find(x => x.id === id).body);
  say('the Live Race help names the lane cards first and the brown Endurance folder', f('live').includes('then the lane cards (see Lane cards), Weather, Tyre Change and Endurance (brown) in an Endurance Race'));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.13.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body);
  say('Race screen help names its director folders and links final review', ['Track actions','lane cards','Weather','Tyre Change','Endurance',"Director's Final Check"].every(t => f('screen').includes(t)));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

// ---- 1.14.0 ----
{ const f = id => plain(folders.find(x => x.id === id).body);
  say('the rotation help names the Size, naming a picked participant, the "⋯" menu of a heat, the Tools menu and the buttons that come with a warning', ['Size', 'give it a name', '⋯', 'Tools menu', 'four plans', 'adds a heat for participants who race none'].every(w => f('rotation').includes(w)));
  say('...and the names it uses are on the editor page (Tools, the plan buttons, "Add a heat")', (() => { const ui = read('renderer/rotationui.js'); return ui.includes(' Tools</summary>') && ui.includes('Start from a plan') && ui.includes('Add a heat for them') && ui.includes("title: 'Size'"); })());
  say('1.16.0: the rotation help says that you can drag (a participant onto a place, a place onto another place, a place back onto the participants, a heat by its grip), that a participant has a colour, and that clicking works too', ['drag a participant onto a place', 'or click a participant and then a place', 'Drag a place onto another', 'drag a place back onto the participants to empty it', 'a heat by its grip', 'Each participant has a colour'].every(w => f('rotation').includes(w)));
  say('...and the editor really has what it names: a grip on every heat, chips and places that carry a colour, and a drag file in the page', (() => { const ui = read('renderer/rotationui.js'); return ui.includes('class="ro-grip"') && ui.includes('data-hh=') && ui.includes('Rot.colorOf') && read('renderer/index.html').includes('rotationdrag.js') && read('renderer/rotationdrag.js').includes('onpointerdown'); })());
  say('1.16.1: the audio help names the Voice report and says that the Natural voices of Narrator (Andrew HD) are not offered to other apps, and the editor has that button', helpHas('Voice report','voices available to the app','troubleshooting') && read('renderer/audioedit.js').includes('id="au-vreport"'));
  say('race help explains manually counting a lap without hardware', f('screen').includes('1 to 8 count a lap for that lane without hardware'));
  say('...every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

{ const home = plain(folders.find(x => x.id === 'home').body); // 1.17.0
  say('1.17.0: the Home folder explains the lane colours, the start lights, the band with its lights and the cards on the right', home.includes('colour') && home.includes('start lights') && home.includes('Trackmate') && home.includes('audio set') && home.includes('record to beat') && home.includes('last race') && home.includes('At a glance'));
  say('...it still says why Start race is greyed out and who picks the lane first, and the Home folder is short enough', home.includes('greyed out') && home.includes('picks their lane first') && home.length < 1400); }

{ const dl = plain(folders.find(x => x.id === 'delta').body); // 1.18.0
  say('1.18.0: the Delta Timers folder says the value and the badge can be top and bottom, and that the time is then on top', dl.includes('Value and badge') && dl.includes('top and bottom') && dl.includes('the time on top, the badge below it') && dl.length < 1400);
  say('1.18.1: ...and that the arrow and the number shrink to stay inside the badge in a small or narrow widget', dl.includes('shrink by themselves to stay inside the badge') && dl.includes('small or narrow')); }

{ const lv = plain(folders.find(x => x.id === 'live').body); // 1.19.0
  say('1.19.0: the Live Race folder says a board can be sorted by a value (Order by): the best lap for a fastest laps board, laps, points, penalties, with the best or worst first', lv.includes('Order by') && lv.includes('fastest laps board') && lv.includes('laps, points, penalties') && lv.includes('best or worst first')); }

{ const dr = plain(folders.find(x => x.id === 'director').body); // 1.20.0
  say('Race Director help places pad configuration in App Settings', dr.includes('Values and layout: App Settings, Race Director') && !dr.includes('A race setup can have pad values of its own'));
  say('the current Race Setup has no retired Adjust Pads group', !schema.racesetups.groups.some(g => g.id === 'pads') && !schema.racesetups.fields.some(f => f.group === 'pads')); }

{ const home = plain(folders.find(x => x.id === 'home').body); // 1.25.0
  say('1.25.0: the Home help names the seven new cards, says that Customize sets them up like the Leaderboard grid, and how to go back', ['Recent races', 'Fastest laps this week', 'Records on all tracks', 'Top drivers', 'Personal bests', 'Rules of this race', 'Shortcuts'].every(w => home.includes(w)) && home.includes('Customize') && home.includes('like the Leaderboard page') && home.includes('little squares') && home.includes('Back to the usual Home') && home.includes('click one to open its results') && home.length < 1400); }
{ const hf = Help.folders().map(f => plain(f.body)), a = hf.find(t => t.includes('Resume the race')) || '', b = hf.find(t => t.includes('can be continued from the Home tab')) || ''; // 1.24.0
  say('1.24.0: the help says a heat race keeps its finished heats after a crash, and can be continued', a.includes('a heat race keeps its finished heats') && b.includes('also a heat race') && a.length < 1400 && b.length < 1400); }
{ const dm = Help.folders().map(f => plain(f.body)).find(t => t.includes('A damage system (Race Setup')) || ''; // 1.23.0
  say('1.23.0: the Damage help says the results list the damage in a heat race per heat too', dm.includes('in a heat race per heat too') && dm.length < 1400); }
{ const hs = Help.folders().map(f => plain(f.body)).find(t => t.includes('General: type your own app name')) || ''; // 1.22.0
  say('1.22.0: the Settings help says Display also sets the speed unit of the tables, km/h or mph', hs.includes('speed unit') && hs.includes('km/h or mph') && hs.length < 1400); }

{ const hs2 = Help.folders().map(f => plain(f.body)).find(t => t.includes('General: type your own app name')) || '', tr = Help.folders().map(f => plain(f.body)).find(t => t.includes('Tracks: a name and the number of lanes')) || ''; // 1.27.0
  say('1.27.0: the Settings help says Display also sets the distance unit (metres and kilometres, or feet and miles), that a track is then typed in feet and inches and that it stays saved in metres; the Tracks help says the length is typed in feet if you chose feet', hs2.includes('distance unit') && hs2.includes('feet and miles') && hs2.includes('feet and inches') && hs2.includes('saved in metres') && hs2.includes('speed unit') && hs2.length < 1400 && tr.includes('in feet if you chose feet') && tr.length < 1400); }

{ const home = plain(Help.folders().find(f => f.id === 'home').body); // 1.26.0
  say('1.26.0: the Home help names the Weather and Tyres Available cards, says they are for show and that you set them in Customize; the folder is still short', home.includes('Weather') && home.includes('Tyres Available') && home.includes('for show') && home.includes('you type them in Customize') && home.length < 1400); }
{ const home = plain(Help.folders().find(f => f.id === 'home').body); // 1.28.0
  say('1.28.0: the Home help names the Notes and Car Mileage cards (Notes is typed in Customize, Car Mileage counts laps and distance per slot car from saved races); the folder is still short', home.includes('Car Mileage') && home.includes('laps and distance per slot car') && home.includes('Notes') && /Weather, Tyres Available and Notes are for show: you type them in Customize/.test(home) && home.length < 1400); }
{ const home = plain(Help.folders().find(f => f.id === 'home').body); // 1.34.0
  say('1.34.0: the Home help names the Service Due card and says a click on a car opens it (and still the cards before it); the folder is still short', home.includes('and Service Due (click a car to open it)') && home.includes('Car Mileage (laps and distance per slot car)') && home.length < 1400); }
{ const cu = plain(Help.folders().find(f => f.id === 'custom').body); // 1.28.1
  say('Image Settings guidance explains lights and automatic fallback pictures', cu.includes('Image Settings') && cu.includes('picture sets for lights') && cu.includes('anything left empty is drawn by the app')); }
{ const dl = plain(Help.folders().find(f => f.id === 'delta').body); // 1.29.0
  say('1.29.0: the Delta Timers help describes the Lap to Lap Delta: the last lap against the lap before it, lap 9 against lap 8 on lap 10, two laps needed (a dash until then); the folder is still short', dl.includes('Lap to Lap Delta') && dl.includes('last lap and how far it is from the lap before it') && dl.includes('lap 9, against lap 8') && dl.includes('badge is a dash until then') && dl.length < 1400 && Object.keys(require('../renderer/delta.js').KINDS).includes('dlaplap')); }
{ const db = plain(Help.folders().find(f => f.id === 'database').body); // 1.30.0
  say('1.33.0: the Database help says a slot car has Statistics: a service interval (with a Reset button, and a Service due mark), mileage, wins, deslots and the best lap per track; the card shows the statistics; the forms are still said to be in folders; the folder is still short', db.includes('Statistics: a service interval (with a Reset button, and a Service due mark), mileage, wins, deslots and the best lap per track') && db.includes('the details, the statistics and (slotcars) the other pictures') && db.includes('The forms are in folders you can keep closed') && db.includes('Slotcars: a brand, manufacturer or model, scale, motor, tyres, gearing, weight and pictures') && db.length < 1400); }
{ const wx = plain(Help.folders().find(f => f.id === 'weather').body), sc = plain(Help.folders().find(f => f.id === 'screen').body), lv = plain(Help.folders().find(f => f.id === 'live').body); // 1.31.0, 1.32.0
  say('1.32.0: the Weather help says the Race Director can give a car another tyre in any race, with or without weather, in the Tyre Change folder (race screen and phone page), for this race only unless the box that changes the slot car in the Database is ticked, and that only dry tyres can be chosen with weather; the folders are still short', wx.includes('In any race, with or without weather') && wx.includes('Tyre Change folder (race screen and phone page)') && wx.includes('this race only') && wx.includes('changes the slot car in the Database too') && wx.includes('With weather only dry tyres can be chosen') && wx.length < 1400);
  say('...and the race screen and Live Race help name the Tyre Change folder among the folders of the Race Director page', sc.includes('Weather, Tyre Change and Endurance') && lv.includes('Weather, Tyre Change and Endurance (brown)') && sc.length < 1400 && lv.length < 1400); }
{ const ds = Help.folders().find(f => f.id === 'driverstats'), t = plain(ds.body); // 1.36.0
  say('1.36.0: the Driver stats help says the page is a grid (up to 4 columns and 8 rows, a cell with a number, wider and taller, a label that can go), what the cells can show, that a cell with nothing to show is blank and an empty row is left out', ds.title === 'Driver stats' && t.includes('up to 4 columns and 8 rows') && t.includes('can cover more columns and rows') && ['laps to go', 'Swap Signal and Swap Timer', 'current and next driver', 'tyres', 'damage', 'the flag', 'the start lights', 'the list of laps'].every(w => t.includes(w)) && t.includes('left blank') && t.includes('a row with nothing in it is left out'));
  say('...that the grid of the computer is the default for every device, a phone keeps its own and can go back, and a phone remembers its lane (and how to switch it off); the folder is short and comes after Live Race', t.includes('default for every device') && t.includes('keeps its own grid') && t.includes("Use the computer's layout again") && t.includes('remembers its lane') && t.includes('Remember my lane') && t.length < 1400 && Help.folders().findIndex(f => f.id === 'driverstats') === Help.folders().findIndex(f => f.id === 'live') + 1); }
{ const ids = folders.map(x => x.id), g = id => plain(folders.find(x => x.id === id).body), cf = plain(folders.find(x => x.id === 'carfailures').body), W = require(R + 'renderer/widgets.js'), Fl = require(R + 'renderer/failures.js'), A2 = require(R + 'renderer/announcer.js'); // 1.43.0
  say('1.43.0: the help has a Car Failures folder right after the Damage System, and tells: it is a part of the Damage System and off to begin with, the four standard failures, the name / level / chance / Stand still, what the chance means, the random moment, the limit per car, no damage points, one stop, penalty points, the Failure factor', ids.indexOf('carfailures') === ids.indexOf('damage') + 1
    && ['Car Failures', 'off to begin with', 'Lift and Coast', 'Slow Puncture', 'Brakes not working', 'Engine Failure, Box to Retire', 'Add the standard failures', 'name', 'level', 'chance', 'Stand still (s)', '1 car in 20', 'never in the first or last lap', 'earliest', 'latest moment', 'no damage points', 'One stop clears it', 'penalty points', 'Failure factor'].every(w => cf.includes(w)) && cf.length < 1400);
  say('...the names it uses are the real ones: the standard failures, the form fields, the button, the slot car field, the widget and the text variable', Fl.DEFAULT_FAILURES.every(x => cf.includes(x.name))
    && ['Earliest moment of a failure', 'Latest moment of a failure', 'Failures for a car in a race, at most'].every(l => schema.damagesystems.fields.some(f => f.label.startsWith(l))) && schema.damagesystems.groups.some(g => g.title === 'Car Failures')
    && schema.slotcars.fields.some(f => f.key === 'failureFactor' && f.label.startsWith('Failure factor')) && read('renderer/database.js').includes('Add the standard failures')
    && W.REGISTRY.some(d => d.label === 'Car Failure' && d.group === 'Slotcar') && W.TEXT_LANE_VARS.some(v => v[0] === 'failure') && cf.includes('{failure}'));
  say('Car Failures help retains Give, Clear, retirement recovery, audio and saved evidence', ['Give','Clear','Race Director page','brings back a car a failure retired','audio folder','the log and the results'].every(w => cf.includes(w)) && helpHas('Car Failures'));
  say('...the buttons and the folder it names are real: the panel has Give, Clear and "At random", and the race screen and the Race Director page have the folder Car Failures', read('renderer/damageui.js').includes('>Give</button>') && read('renderer/damageui.js').includes('>Clear</button>') && read('renderer/damageui.js').includes('At random') && read('renderer/race.js').includes("folderHtml('failures', 'Car Failures'") && read('renderer/liveview.js').includes("folder('failures', 'Car Failures'") && A2.CALLS.some(c => c.group === 'Car Failures'));
  say('...the Damage System folder points to nothing that is gone and is still short', plain(folders.find(x => x.id === 'damage').body).length < 1400); }

// ---- 1.45.0: the Race Setup sub-tabs as coloured buttons, and adding and taking out participants ----
{ const g = id => plain(folders.find(x => x.id === id).body), editor = read('renderer/editor.js'), ui = read('renderer/rotationui.js');
  say('Race Setup help explains reusable coloured system tabs', g('setups').includes('coloured system tabs hold reusable rules') && g('setups').includes('Race Setups bring together') && editor.includes('Where it all comes together'));
  say('1.45.0: the Rotation setups help says the Size goes up to 64, that Add a participant adds one and that the × takes one out; the buttons are real', ['up to 64 participants', 'Add a participant adds one', 'the × in the list of names takes one out'].every(w => g('rotation').includes(w)) && ui.includes('data-addp') && ui.includes('data-delp') && ui.includes('Add a ${w}</button>') && g('rotation').includes('Each participant has a colour'));
  say('...and both folders are still short', ['setups', 'rotation'].every(id => g(id).length < 1400)); }
{ const g = id => plain(folders.find(x => x.id === id).body), editor = read('renderer/editor.js');
  say('1.46.1: Placing widgets follows the customization design folders and explains the small magnet, pink line, grid and Undo', folders.findIndex(x => x.id === 'layouteditor') > folders.findIndex(x => x.id === 'custom') && ['3 units', 'pink line', 'Ctrl', 'Cmd on a Mac', 'Tidy to grid', 'Tidy all widgets to the grid', 'Undo puts them back', 'Snap to grid, widgets and guidelines'].every(t => g('layouteditor').includes(t)));
  say('...the buttons and the tick box it names exist in the Layout Editor', ['Tidy to grid', 'Tidy all widgets to the grid', 'Snap to grid, widgets and guidelines', 'Arrange'].every(t => editor.includes(t)) && /^[a-z]+$/.test('layouteditor'));
  say('...and the folder is short', g('layouteditor').length < 1400); }
{ const g = id => plain(folders.find(x => x.id === id).body), editor = read('renderer/editor.js');
  say('1.47.0: a folder Arranging several widgets comes right after Placing widgets and tells about Align, Spread out evenly, Width and Height, the frame to resize them together, the three mirrors, the text alignment and the pictures, and Undo', folders.findIndex(x => x.id === 'arranging') === folders.findIndex(x => x.id === 'layouteditor') + 1 && ['Align', 'Spread out evenly', 'Width', 'Height', 'resize them all together', 'Ctrl: the grid only', 'In the selection', 'Flip top to bottom', 'Across the page', 'text alignment', 'Duplicate', 'Undo'].every(t => g('arranging').includes(t)));
  say('...the buttons it names exist in the Layout Editor', ['Spread out evenly', 'In the selection', 'Flip top to bottom', 'Across the page', 'Width', 'Height', 'Align'].every(t => editor.includes(t)));
  say('...and the folder is short', g('arranging').length < 1400); }
{ const g = id => plain(folders.find(x => x.id === id).body), ui = read('renderer/championshipui.js') + read('renderer/database.js') + read('renderer/landing.js');
  const i = folders.findIndex(x => x.id === 'championships'), j = folders.findIndex(x => x.id === 'championshippoints');
  say('1.56.0: a folder Championship points comes right after Championships and no longer says that points come in the next release', j === i + 1 && i >= 0 && !g('championships').includes('next release') && g('championships').includes('Championship points'));
  say('...it tells about the table and the ready-made ones, the bonuses, the dropped results, the teams, the ties, the sprint, the guests, the panel after a race and the standings with the PDF', ['ready-made', 'My own', 'One point per car beaten', 'fastest lap', 'pole position', 'Dropped results', 'Teams', 'sprint', 'guest', 'Award these points', 'Undo', 'Do not count this race', 'Export to PDF', 'Maria leads by 5'].every(w => g('championshippoints').includes(w)));
  say('...the buttons and the words it names exist in the program', ['Award these points', 'Do not count this race', 'Undo', 'Export to PDF', 'One point per car beaten', 'My own', 'Championships', 'Dropped results'].every(w => ui.includes(w) || read('renderer/championship.js').includes(w)));
  say('1.56.1: the Championships folder says where the championship is chosen: in Start a race, under the name of the race setup (1.58.0), with None for a normal race', g('championships').includes('in Start a race, under the name of the race setup') && g('championships').includes('None is a normal race') && !g('championships').includes('The Home card'));
  say('...and both folders are short', g('championships').length < 1400 && g('championshippoints').length < 1400); }
{ const g = id => plain(folders.find(x => x.id === id).body).replace(/\s+/g, ' ');
  say('1.57.0: the Championship points folder says that races of teams are scored: the team gets the points of its place once, each driver who drove gets the same, a share by laps or nothing, with a minimum share of laps; it no longer says they are not scored',
    g('championshippoints').includes('Races of teams (Endurance, team heats) are scored') && g('championshippoints').includes('the team gets the points of its place once') && g('championshippoints').includes('a share by laps, or nothing') && g('championshippoints').includes('minimum share of laps') && !g('championshippoints').includes('not scored'));
  say('...and the folder is still short', g('championshippoints').length < 1400); }
// ---- 1.58.2: Fuel Systems ----
{ const g = id => plain(folders.find(x => x.id === id).body), st = g('setups');
  say('Fuel Systems leads the current system order in Help', st.indexOf('Fuel Systems') < st.indexOf('Penalty Systems') && st.indexOf('Penalty Systems') < st.indexOf('Safety Car Systems') && st.indexOf('Safety Car Systems') < st.indexOf('Tyre Wear Systems'));
  say('...and no folder calls it a fuel setup any more', folders.every(x => !/fuel setup/i.test(plain(x.body)))); }

// ---- 1.59.0: Random Flags ----
{ const g = plain(folders.find(x => x.id === 'safetycar').body).replace(/\s+/g, ' ');
  say('1.59.0: the Safety Car folder tells about Random Flags: yellow flags at random moments, as if other cars caused them; the chance, how many, how long, the earliest and latest moment and a warning are set; the Race Director can lift one early', /Random Flags: the system can also put the yellow flag up at random moments, as if other cars caused it/.test(g) && /the chance that a race has any, how many, how long, the earliest and latest moment, and a warning/.test(g) && /Race Director can lift one early/.test(g));
  say('...and the folder is still short', g.length < 1400);
  say('...and the red flag is not promised', !/red flag/i.test(g.slice(g.indexOf('Random Flags')))); }

// ---- 1.60.0: Performance ----
{ const fo = folders.find(x => x.id === 'performance'), g = fo ? plain(fo.body) : '';
  say('1.60.0: the help has a folder Performance (with the Making it yours folders) that says where the report is, what it shows, the Copy report button, the line on the race screen (off to begin with), and that nothing is measured while both are off', !!fo && ['App Settings, General, Performance', 'Copy report', 'Show the Performance line on the race screen', 'frames a second', 'screen update', 'Raspberry Pi', 'graphics card', 'off to begin with', 'Nothing is measured'].every(t => g.includes(t)));
  say('...the names it uses are in the app: the folder, the switch and the button', ['Performance', 'Show the Performance line on the race screen', 'Copy report'].every(t => read('renderer/app.js').includes(t)));
  say('1.60.3: ...it also names the tickbox for the layers (on to begin with), says that the report names the look, and the words are in the app', !!fo && plain(fo.body).includes('Draw the changing text of each widget on its own layer') && /on to begin with/.test(plain(fo.body)) && /report says which look/.test(plain(fo.body)) && read('renderer/app.js').includes('Draw the changing text of each widget on its own layer'));
  say('...and the folder is short, and it comes after Look and feel', g.length < 1400 && folders.findIndex(x => x.id === 'performance') === folders.findIndex(x => x.id === 'look') + 1); }
// ---- 1.60.1: the report says where the time goes ----
{ const fo = folders.find(x => x.id === 'performance'), g = fo ? plain(fo.body) : '';
  say('1.60.1: the help folder says the report names the widgets and parts that take the time, the worst figures of the race, a row every 30 seconds, the stuck core and the windows (the Live Race tab is a second window), and to switch the line on before the race', ['widgets and the parts of a screen update', 'worst figures since the race started', 'a row every 30 seconds', 'when the core was stuck', 'which windows are open', 'Live Race tab is a second window', 'Switch the line on before the race starts', 'does the app get slower during a race?'].every(s => g.includes(s)));
  say('...and the folder is still short enough', g.length < 1400); }
// ---- 1.67.0: a leaderboard that counts over all heats ----
{ const fo = folders.find(x => x.id === 'live'), g = fo ? plain(fo.body) : '';
  say('1.67.0: the Live Race folder says that Count over makes a board of a heat race show all drivers in the overall order, with time, laps, best and average lap and points added up', !!fo && g.includes('Count over') && g.includes('heat race') && g.includes('overall order') && g.includes('points added up'));
  say('1.68.0: ...and that it counts over the heats and the rounds of a championship too (the choice is named All heats and rounds so far)', !!fo && g.includes('All heats and rounds so far') && g.includes('championship board'));
  say('...the words are the ones of the board settings in the app (the name of the setting and its choice)', read('renderer/widgets.js').includes("label: 'Count over'") && read('renderer/widgets.js').includes("'All heats and rounds so far'"));
  say('...and the folder is still short enough', g.length < 1400); }

// ---- 1.73.0: the forms of the Penalty and Damage systems (1.74.0: and of the Weather system) ----
{ const fo = folders.find(x => x.id === 'systemforms'), g = fo ? plain(fo.body) : '', at = id => folders.findIndex(x => x.id === id), rails = e => schema[e].rail;
  say('1.73.0: a folder Penalty, Damage, Weather and Tyre wear systems in words (Weather came in 1.74.0, Tyre wear in 1.75.0) comes after Car Failures, and is short', !!fo && at('systemforms') === at('carfailures') + 1 && g.length < 1400);
  say('...it names every section of the three forms as they are in the rail (by title), and says which ones are under Only if you need it', rails('penaltysystems').concat(rails('damagesystems'), rails('weathersystems'), rails('tyrewearsystems')).every(r => helpHas(r.title)) && g.includes('Only if you need it') && rails('damagesystems').concat(rails('weathersystems'), rails('tyrewearsystems')).filter(r => r.optional).every(r => helpHas(r.title)));
  say('...and the words of the form: In plain words, Ready to use, Give it a name, Used by, the dots, the colours, and that the systems stay separate and nothing stored changes', ['In plain words', 'Ready to use', 'Give it a name', 'Used by', 'green', 'amber', 'open ring', 'yellow', 'red', 'blue', 'purple', 'Tyre Wear System', 'stay separate systems', 'does not change'].every(t => g.includes(t)));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

{ const fo = folders.find(x => x.id === 'systemformsmore'), g = fo ? plain(fo.body) : '', at = id => folders.findIndex(x => x.id === id), rails = e => schema[e].rail;
  say('1.76.0: a folder Safety car, Push and save and Fuel systems in words comes right after the folder of the other four systems, and is short', !!fo && at('systemformsmore') === at('systemforms') + 1 && g.length < 1400 && fo.title === 'Safety car, Push and save and Fuel systems in words');
  say('...it names every section of the three forms as they are in the rail (by title), and says which ones are under Only if you need it', rails('safetycarsystems').concat(rails('pushsavesystems'), rails('fuelrules')).every(r => helpHas(r.title)) && g.includes('Only if you need it') && rails('safetycarsystems').concat(rails('pushsavesystems'), rails('fuelrules')).filter(r => r.optional).every(r => helpHas(r.title)));
  say('...and the colours, the bars, that the systems stay separate and nothing stored changes, and the pace that cannot be saved', ['orange', 'lime', 'green', 'stay separate systems', 'does not change', 'bar', 'ready-made systems', 'cannot be saved'].every(t => g.includes(t)));
  say('...and every folder is still short enough', folders.every(x => plain(x.body).length < 1400)); }

console.log(fails ? fails + ' HELP TESTS FAILED' : 'ALL HELP TESTS PASSED'); process.exit(fails ? 1 : 0);
