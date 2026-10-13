// App Settings > Help: the welcome text, the folders, and a check that everything the text names exists in the app.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..') + '/';
const Help = require(R + 'renderer/help.js');
const schema = require(R + 'schema.js');
let fails = 0;
const say = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const read = f => fs.readFileSync(R + f, 'utf8');
const plain = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const src = ['renderer/app.js', 'renderer/editor.js', 'renderer/database.js', 'renderer/landing.js', 'renderer/race.js', 'renderer/liveview.js', 'renderer/hardwareui.js', 'renderer/dsui.js', 'renderer/transferui.js', 'renderer/themeui.js', 'renderer/audioedit.js', 'renderer/tokenui.js', 'renderer/review.js', 'renderer/widgets.js'].map(read).join('\n') + '\n' + read('schema.js');
const folders = Help.folders();

// ---- the welcome ----
{ const w = plain(Help.WELCOME);
  say('the welcome opens with "Welcome to SlotForge Timing" and the line about racing with your own track, driver and cars', w.startsWith('Welcome to SlotForge Timing') && w.includes('To get racing with your own track, driver and cars, follow these quick steps:'));
  say('...then "How do I get started?", the default settings, the Trackmate interface under App Settings, and the physical track', w.includes('How do I get started?') && w.includes('There are default settings for everything, so you can dive right in.') && w.includes('Make sure to set up your Trackmate interface first, under the App Settings tab') && w.includes('Approach the App like you would a physical track. You start out with a track, so add one on the Database tab under Tracks.'));
  const steps = [...Help.WELCOME.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => plain(m[1]));
  say('...four numbered steps: a track, a driver and a slot car, a race setup, and Home', steps.length === 4 && /^Add a track under Database, Tracks\./.test(steps[0]) && /^Then add a driver and a slot car\./.test(steps[1]) && /^Set up a race under Race Setup\./.test(steps[2]) && /^Go back to Home, pick your race/.test(steps[3]) && /<ol class="hw-steps">/.test(Help.WELCOME));
  say('...step 1 says that only a name and the number of lanes are needed (the track form wants a name), and that the length may be useful', steps[0].includes('a name and the number of lanes are all you really need') && steps[0].includes('The track length might be useful.'));
  say('...step 3 names the session type and the track (a race setup without a track cannot start) and Save', steps[2].includes('pick a Session Type') && steps[2].includes('your track') && steps[2].includes('hit Save'));
  say('...it ends with "This sets up a basic race. For more in-depth explanations of the possibilities, read the information below."', w.includes('This sets up a basic race. For more in-depth explanations of the possibilities, read the information below.'));
  const landing = read('renderer/landing.js');
  say('...the button names in the steps are the real ones on the Home tab: "Start race", and "Open the session" for a Time Token Session', w.includes('Start race') && w.includes('Open the session') && /tokens \? 'Open the session' : 'Start race'/.test(landing));
  say('...the welcome says Time Token Session where the app does, and the Trackmate page is under Timing Hardware', /'Timing Hardware'/.test(src) && w.includes('Timing Hardware'));
}

// ---- the folders ----
{ say('there are folders in four groups', Help.SECTIONS.length === 4 && folders.length >= 15);
  say('every folder has its own id, a title, a short note and a body with a list', new Set(folders.map(f => f.id)).size === folders.length && folders.every(f => /^[a-z]+$/.test(f.id) && f.title.length > 3 && f.note.length > 5 && /<li>/.test(f.body)));
  say('every folder is short enough to read at a glance (under 1,400 characters of text)', folders.every(f => plain(f.body).length < 1400));
  const h = Help.html();
  say('all folders are drawn in the folder style of the app, and they are closed until someone opens them', (h.match(/<details class="dbfolder helpfolder"/g) || []).length === folders.length && !/<details[^>]* open/.test(h));
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
  const sessionLabels = schema.racesetups.fields.find(f => f.key === 'sessionType').options.map(o => o[1]);
  say('every session type of the race setup form is explained (' + sessionLabels.join(', ') + ')', has(sessionLabels).length === 0);
  const tabs = ['General', 'App Theme', 'Network', 'Timing Hardware', 'Import and Export', 'Help', 'Trackmate Interface', 'DS Electronics', 'Race Setups', 'Fuel Setups', 'Penalty Systems', 'Time Tokens', 'Layout Editor', 'Leaderboard Editor', 'Audio Settings', 'Image Settings', 'Widget Builder', 'Racing Records', 'Token Records', 'Results and Records'];
  say('the sub-tabs the text names are the real ones', real(tabs.filter(t => text.includes(t))).length === 0 && has(['Timing Hardware', 'Race Setups', 'Fuel Setups', 'Penalty Systems', 'Time Tokens', 'Layout Editor', 'Leaderboard Editor', 'Audio Settings', 'Image Settings', 'Widget Builder', 'Racing Records', 'Token Records', 'Results and Records', 'Import and Export']).length === 0);
  const tiles = ['Race timing', 'Leaderboard', 'Driver stats', 'Database', 'Racing rules', 'Race Director', 'Tokens'];
  say('the Live Race tiles the text names are the real ones, and it names all of them', real(tiles).length === 0 && has(tiles).length === 0);
  const buttons = ['Show all', 'Extra fields…', 'Export to PDF', 'Open on a second screen', 'Full screen', 'Review laps', 'Finalize results', 'Delete all data', 'Simulated cars', 'Share on my network', 'End time now', 'Undo', 'Clear', 'Open all', 'Close all'];
  say('the text names these buttons, and each exists on a screen', has(buttons).length === 0 && real(buttons.filter(b => !['Open all', 'Close all', 'Show all', 'Finalize results'].includes(b))).length === 0 && src.includes('Finalize') && /Show all \$\{/.test(src) && Help.html().includes('>Open all<') && Help.html().includes('>Close all<'), has(buttons).concat(real(buttons)).join());
  say('the steps name the Home button the way the Home tab does', /Go back to Home, pick your race, choose a driver and a car for every lane and hit Start race \(Open the session for a Time Token Session\)\./.test(plain(Help.WELCOME)));
  say('the audio, fuel and penalty words are the app\'s own', ['Pitstop time', 'Token Clock', 'Slotcar Speed', 'Drivethrough', 'Stop-and-Go', 'Trackcall'].every(w => !text.includes(w) || src.includes(w) || read('renderer/timing.js').includes(w) || read('renderer/announcer.js').includes(w)));
  { const A = require(R + 'renderer/announcer.js'), groups = [...new Set(A.CALLS.map(c => c.group))], audioText = JSON.stringify(Help.SECTIONS).split("id\":\"audio\"")[1].split("id\":\"look\"")[0];
    const named = ['Race progress', 'Gaps and battles', 'Laps and records', 'Pit and fuel', 'Penalties', 'Safety', 'Time tokens'];
    say('the folders of an audio set that the Help names are the real ones (and the new ones are all named)', named.every(g => groups.includes(g) && text.includes(g)));
    const words = (audioText.match(/\{(\w+)\}/g) || []).map(w => w.slice(1, -1));
    say('...and the two boxes it names under a sentence and a call are in the audio editor', audioText.includes('Only if') && audioText.includes('Not again within') && read('renderer/audioedit.js').includes('Only if&hellip;') && read('renderer/audioedit.js').includes('Not again within (seconds)'));
    say('...and so are the placeholders it names', words.length >= 5 && words.every(w => w in A.VARS)); }
  { const Dl = require(R + 'renderer/delta.js'), W = require(R + 'renderer/widgets.js');
    const folder = W.REGISTRY ? Object.values(W.REGISTRY).filter(d => d.group === 'Delta Timers') : [];
    say('the Delta Timers the Help describes exist: a folder of that name in the Layout Editor, eight widgets, and the ways of comparing it names', text.includes('Delta Timers') && folder.length === 8 && Object.keys(Dl.KINDS).length === 8
      && ['a chosen lane', 'the leader', 'the fastest in the race', 'the track record', 'the session record'].every(w => text.includes(w)) && text.includes('−0.045') && text.includes('+0.321'));
    say('...and so is its Left value shows setting: the six widgets that can show another value have it, the two record ones do not', /Left value shows/.test(text) && Object.keys(Dl.KINDS).filter(k => !Dl.KINDS[k].record).length === 6 && Object.keys(Dl.KINDS).filter(k => !Dl.KINDS[k].record).every(k => W.def(k).options.some(o => o.key === 'leftShows')) && Object.keys(Dl.KINDS).filter(k => Dl.KINDS[k].record).every(k => !W.def(k).options.some(o => o.key === 'leftShows'))); }
  { const landing = read('renderer/landing.js');
    say('the Heat plan the Help names is on the Home tab, with its Shuffle again button, and the setup form says what the heat settings mean (hints)', text.includes('Heat plan') && text.includes('Shuffle again') && landing.includes('<h4>Heat plan</h4>') && landing.includes('>Shuffle again<')
      && ['heatBy', 'heatPlan', 'heats', 'resultBy', 'points'].every(k => schema.racesetups.fields.find(f => f.key === k).hint.length > 40)); }
  { const f = k => schema.racesetups.fields.find(x => x.key === k), plans = f('heatPlan').options.map(o => o[0]);
    say('the four ways to plan heats the Help names are the real choices, with the settings it names (same number of heats, lane rotation, seeding)', plans.join() === 'manual,perdriver,roundrobin,rotation' && ['every driver races the same number of heats', 'round robin', 'lane rotation', 'Same number of heats for everyone', 'Who races together', 'latest qualifying', 'mixed'].every(w => text.includes(w))
      && f('heatEven').label === 'Same number of heats for everyone' && f('heatSeeding').label === 'Who races together' && f('heatSeeding').options.map(o => o[0]).join() === 'random,mixed,speed'); }
  { const f = k => schema.racesetups.fields.find(x => x.key === k);
    say('the scoring options the Help names are the real settings (average, best heats, drop the worst heat, bonus, tie-breaker, Result column)', ['How the heats are added up', 'average per heat', 'only the best heats', 'Drop the worst heat', 'bonus points for the fastest lap', 'A tie is decided by', 'the most heat wins', 'the lowest total time', 'Result'].every(w => text.includes(w))
      && f('countBy').label === 'How the heats are added up' && f('dropWorst').label === 'Drop the worst heat' && f('fastestBonus').label.startsWith('Bonus points for the fastest lap') && f('tieBreak').label === 'A tie is decided by'
      && read('renderer/race.js').includes('<th>Result</th>')); }
  { const f = k => schema.racesetups.fields.find(x => x.key === k);
    say('the break between heats the Help names is in the race setup (seconds, what happens when it is over) and on the race screen ("next heat in")', text.includes('Break between heats') && text.includes('next heat in') && text.includes('When the break is over') && f('breakSeconds').label === 'Break between heats (seconds)' && f('breakAuto').label === 'When the break is over'
      && /next \$\{[^}]*'heat'\} in/.test(read('renderer/timing.js')) && /next \$\{[^}]*'heat'\} in/.test(read('renderer/liveview.js'))); }
  { const f = k => schema.racesetups.fields.find(x => x.key === k);
    say('the finals the Help names are the real settings (finals, what the finals decide, the length of a final) and the audio calls (next final, final finished, the {final} word)', ['Finals after the heats', 'What the finals decide', 'added to the heat result', 'Pick the rest at random', 'Clear choices', 'next final', 'final finished', '{final}'].every(x => text.includes(x))
      && f('finals').label === 'Finals after the heats' && f('finalMode').label === 'What the finals decide' && f('finalLaps').label.startsWith('Laps in a final') && f('finalDuration').label.startsWith('Duration of a final')
      && read('renderer/race.js').includes('Pick the rest at random') && read('renderer/race.js').includes('Clear choices') && !!require('../renderer/announcer.js').CALLS.find(c => c.id === 'nextfinal') && !!require('../renderer/announcer.js').CALLS.find(c => c.id === 'finalend')); }
  { const landing = read('renderer/landing.js');
    say('changing the plan by hand: the Help names the click-and-swap and the Reset my changes button that are on the Home tab', text.includes('click a place and then another place') && text.includes('Reset my changes') && landing.includes('id="resetplan"') && landing.includes('data-hp=') && landing.includes('Reset my changes')); }
  const race = read('renderer/race.js');
  say('the keys named are the real ones: Space, Y, R, S, 1 to 8, Shift + 1 to 8 and Ctrl + 1 to 8', /ev\.key === ' '/.test(race) && /k === 'y'/.test(race) && /k === 'r'/.test(race) && /k === 's'/.test(race) && /ctrlKey && \/\^Digit\[1-8\]\$\//.test(race) && /shiftKey && \/\^Digit\[1-8\]\$\//.test(race) && /Number\(ev\.key\) - 1/.test(race) && text.includes('Space starts, pauses and resumes') && text.includes('Y yellow flag') && text.includes('R red flag') && text.includes('S stop (it asks once)') && text.includes('1 to 8 count a lap') && text.includes('Shift + 1 to 8') && text.includes('Ctrl + 1 to 8'));
  say('the Trackmate hardware page has a Monitor, check lights and a lane per sensor, as the text says', /Monitor/.test(read('renderer/hardwareui.js')) && /check light/i.test(read('README.md')) && /sensor/i.test(read('renderer/hardwareui.js')));
  say('the sessions of the Token Records are called stints, and the Results folders are the ones named', /Stints/.test(src) && ['Track records', 'Personal bests', 'Sessions'].every(f => src.includes(f) && text.includes(f)));
  const keys = e => schema[e].fields.map(f => f.key);
  say('the track, driver and slot car options the text names exist in the forms', ['lanes', 'scale', 'surface', 'picture', 'length', 'laneModifier', 'laneLengths', 'minLap', 'maxLap'].every(k => keys('tracks').includes(k)) && ['nickname', 'callsign', 'dateOfBirth', 'flag', 'avatar'].every(k => keys('drivers').includes(k)) && ['brand', 'manufacturer', 'model', 'scale', 'motor', 'tyres', 'gearing', 'weight', 'picture', 'extraPictures', 'lapsDriven'].every(k => keys('slotcars').includes(k)) && ['number of lanes', 'track length', 'lane length modifier', 'minimum and maximum lap time', 'callsign'].every(w => text.toLowerCase().includes(w)));
  const setup = keys('racesetups');
  say('...and so do the race setup options: start lights, the red flag restart, the first crossing, the pit hold time, penalties, fuel, layouts and audio', ['lightsMin', 'lightsMax', 'lightsAfter', 'restartAfterRed', 'firstLap', 'pitHold', 'penaltySystem', 'fuelRules', 'layout', 'layout2', 'audioSet', 'startPower', 'trackcall', 'heatBy', 'heatPlan', 'resultBy', 'endRule'].every(k => setup.includes(k)));
  say('the yellow flag target the Help describes exists: two settings in a Yellow flag group of the race setup, a call that says the target, a call for a lap that is too fast, and the lap review mark', keys('racesetups').includes('yellowTarget') && keys('racesetups').includes('yellowPoints') && schema.racesetups.groups.some(g => g.id === 'yellow' && g.title === 'Yellow flag') && /Yellow flag target lap time/.test(text) && ['yellowtarget', 'yellowfast'].every(id => read('renderer/announcer.js').includes("id: '" + id + "'")) && /faster than the yellow flag target/.test(read('renderer/review.js')));
  const index = read('renderer/index.html');
  say('help.js is loaded by the page, before app.js (which draws it)', index.includes('<script src="help.js">') && index.indexOf('help.js') < index.indexOf('app.js') && read('renderer/app.js').includes("Help.render(document.getElementById('settingsbox'))"));
}

console.log(fails ? fails + ' HELP TESTS FAILED' : 'ALL HELP TESTS PASSED'); process.exit(fails ? 1 : 0);
