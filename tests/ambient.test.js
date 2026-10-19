// Ambient Race Sounds (1.48.0): sound files the user brings, played on a channel of their own, next to the spoken calls.
// The list (Announcer.AMBIENT), the event of a lap, the channel (Sound.ambientFor and what say() does with it): played, cut, ducked, held back.
const { createRace } = require('../renderer/engine.js');
const A = require('../renderer/announcer.js');
const Sound = require('../renderer/sound.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const S = Sound.state, FILE = 'data:audio/wav;base64,AAAA', FILE2 = 'data:audio/wav;base64,BBBB';

// ---- the list ----
{
  const ids = A.AMBIENT.map(d => d.id), callIds = A.CALLS.map(c => c.id);
  ok('thirty-seven ambient sounds (15 from release 1, 17 from release 2, 5 from release 3), with their own ids (none is the id of a spoken call)', A.AMBIENT.length === 37 && new Set(ids).size === 37 && ids.every(i => !callIds.includes(i)) && ids.every(i => /^amb[a-z]+$/.test(i)));
  const known = e => callIds.includes(e) || e === 'lapdone' || /^weatherconditions:(dry|cloudy|wet|clearing)$/.test(e); // (a moment is a call, the lap of a car, or the state the weather is said to be in)
  ok('each starts on an event of the race: a spoken call, the lap event or a state of the weather', A.AMBIENT.every(d => d.on.length > 0 && d.on.every(known)));
  ok('...and what ends it is the same kind of moment', A.AMBIENT.every(d => (d.stop || []).every(known)));
  ok('a sound that has a moment to end it is a pit crew (it stops with the car) or a loop (it plays until then)', A.AMBIENT.filter(d => (d.stop || []).length).map(d => d.id).join() === 'ambpitwork,ambparaddock,ambcrowd,ambrain,ambdry' && A.AMBIENT.filter(d => d.loop).map(d => d.id).join() === 'ambparaddock,ambcrowd,ambrain,ambdry' && A.AMBIENT.filter(d => d.loop).every(d => (d.opts || []).includes('fade') && !d.cool && !(d.opts || []).includes('who')));
  ok('each has a label, a section and variables the announcer knows', A.AMBIENT.every(d => d.label && d.section && d.vars.every(v => A.VARS[v])));
  ok('the options are the ones the editor knows (which cars, stop at the pit exit)', A.AMBIENT.every(d => (d.opts || []).every(o => o === 'who' || o === 'cut' || o === 'fade')) && A.AMBIENT.find(d => d.id === 'ambpass').opts.includes('who') && A.AMBIENT.find(d => d.id === 'ambpitwork').opts.includes('cut'));
  ok('the sections come in a row (a section is one heading in the folder)', (() => { const seen = []; A.AMBIENT.forEach(d => { if (seen[seen.length - 1] !== d.section) seen.push(d.section); }); return new Set(seen).size === seen.length && seen.join('|') === 'On the track|Pit lane|The start|Flags|Race moments|The crowd|Trouble|Driver swaps and time tokens|Background sounds|Weather'; })());
  ok('the folder has its name', A.AMBIENT_GROUP === 'Ambient Race Sounds' && !A.CALLS.some(c => c.group === A.AMBIENT_GROUP));
  ok('the sounds that can repeat quickly have a "not again within" (the pass of a car, a new leader, the fastest lap, a move up, a hit, a penalty)', A.AMBIENT.filter(d => d.cool).map(d => d.id).join() === 'ambpass,ambleader,ambfastest,ambovertake,ambdamagehit,ambpenalty');
}

// ---- the lap event: only when the set wants it ----
{
  const ent = [{ lane: 0, driverId: 'a', driverName: 'Alex' }, { lane: 1, driverId: 'b', driverName: 'Sam' }];
  const run = o => { const eng = createRace({ type: 'race', laps: 5, minLap: 1000, entries: ent }), an = A.create(o), out = [];
    an.observe(eng, { phase: 'ready' }); eng.start(0); out.push(...an.observe(eng, { phase: 'running' }));
    eng.cross(0, 5000); out.push(...an.observe(eng, { phase: 'running' })); eng.cross(1, 5800); out.push(...an.observe(eng, { phase: 'running' })); eng.cross(0, 10000); out.push(...an.observe(eng, { phase: 'running' })); return out; };
  ok('without the option there is no lap event (what was said before is the same)', !run({}).some(e => e.call === 'lapdone') && !run({ lapSound: false }).some(e => e.call === 'lapdone'));
  const ev = run({ lapSound: true }), laps = ev.filter(e => e.call === 'lapdone');
  ok('with it, every car that crosses the line makes one (with the driver, the lane and the lap)', laps.length === 3 && laps.map(e => e.vars.driver + e.vars.lap).join() === 'Alex1,Sam1,Alex2' && laps[1].vars.lane === 2);
  ok('...with the place of the car, the gap to the car in front and the time that the car behind is late', laps[0].facts.place === 1 && laps[1].facts.place === 2 && laps[1].facts.gap === 800 && laps[2].facts.behind === 800 && laps[0].facts.behind === null);
  ok('...and it comes before the spoken news of that lap', ev.findIndex(e => e.call === 'lapdone') < ev.findIndex(e => e.call === 'firstlap'));
  const same = run({}).map(e => e.call).join() === ev.filter(e => e.call !== 'lapdone').map(e => e.call).join();
  ok('the other events are the same with or without it', same);
  const e2 = createRace({ type: 'race', laps: 5, minLap: 1000, entries: ent }), a2 = A.create({ lapSound: true }); a2.observe(e2, { phase: 'ready' });
  ok('no lap event before the start', !a2.observe(e2, { phase: 'countdown', lights: 2 }).some(e => e.call === 'lapdone'));
}

// ---- the channel ----
const fake = () => { // the ambient player, the voice, and the clock of the delay: all in the test
  const plays = [], spoken = [], waiting = [], timers = []; let clock = 1000;
  S.ambBackend = { play(url, vol, ended, o) { const h = { url, vol, ended, loop: !!(o && o.loop), stopped: false, stop() { h.stopped = true; }, volume(v) { h.vol = v; } }; plays.push(h); return h; } };
  S.backend = { speak(text, o, done) { spoken.push(text); waiting.push(done); }, file(url, o, done) { spoken.push('file'); waiting.push(done); }, stop() { waiting.length = 0; } };
  S.later = (fn, ms) => { timers.push({ fn, ms, off: false }); return timers.length - 1; }; S.unlater = t => { if (timers[t]) timers[t].off = true; };
  S.now = () => clock; S.queue = []; S.busy = false; S.cool = new Map(); S.amb.items = []; S.amb.pending = []; S.amb.duck = false; S.amb.log = [];
  return { plays, spoken, waiting, timers, tick: ms => { clock += ms; }, fire: n => { const t = timers[n]; if (t && !t.off) { t.off = true; t.fn(); } } };
};
const setOf = (calls, extra) => ({ name: 'T', ...extra, calls: { ...Object.fromEntries(A.CALLS.map(c => [c.id, { on: true, lines: [{ text: 'x', file: '' }] }])), ...calls } });
const snd = (...files) => ({ on: true, lines: files.map(f => ({ text: '', file: f })) });
const alive = f => f.plays.filter(h => !h.stopped);
const rnd0 = () => 0;

{
  const f = fake(), set = setOf({ ambpass: snd(FILE) });
  Sound.say(set, 'lapdone', { driver: 'Alex', lane: 1, lap: 1 }, rnd0, undefined, { driverId: 'a', place: 1 });
  ok('a lap event plays the sound file at once, and says nothing (the lap event is not a spoken call)', f.plays.length === 1 && f.plays[0].url === FILE && f.spoken.length === 0);
  ok('the volume is the one of the set (a new set: 80 percent)', Math.abs(f.plays[0].vol - 0.8) < 1e-9 && Math.abs(Sound.defaultSet('x').ambVolume - 0.8) < 1e-9);
  Sound.stop();
}
{ // a spoken call and the sound at the same time
  const f = fake(), set = setOf({ ambleader: snd(FILE) });
  const said = Sound.say(set, 'newleader', { driver: 'Alex' }, rnd0, undefined, { driverId: 'a', place: 1 });
  ok('a spoken call and its sound start together: the voice speaks, the sound plays', !!said && f.spoken.length === 1 && f.plays.length === 1);
  Sound.say(set, 'fastestlap', { driver: 'Sam' }, rnd0, undefined, { driverId: 'b', place: 2 });
  ok('...a second call waits for the voice (one voice at a time) but the sounds are not in that queue', f.spoken.length === 1 && S.queue.length === 1);
  Sound.stop();
}
{ // the spoken call is off or has no sentence: the sound still plays
  const f = fake(), set = setOf({ newleader: { on: false, lines: [{ text: 'x', file: '' }] }, ambleader: snd(FILE) });
  const said = Sound.say(set, 'newleader', { driver: 'Alex' }, rnd0, undefined, { driverId: 'a', place: 1 });
  ok('a spoken call that is off does not stop its sound', said === null && f.spoken.length === 0 && f.plays.length === 1);
  Sound.stop();
}
{ // an urgent call does not cut the sounds; Stop does
  const f = fake(), set = setOf({ ambpass: snd(FILE), ambyellow: snd(FILE2) });
  Sound.say(set, 'lapdone', { driver: 'Alex', lane: 1 }, rnd0, undefined, { driverId: 'a', place: 1 });
  Sound.say(set, 'yellowflag', {}, rnd0, undefined, {});
  ok('a flag call (urgent: it cuts the voice and clears the queue) does not cut a sound that plays; its own sound starts as well', f.plays.length === 2 && alive(f).length === 2 && f.spoken.length === 1);
  Sound.stop();
  ok('Stop (leaving the race, a new race, the Back button) ends all sounds', alive(f).length === 0);
}
{ // off, no file, a spoken sentence only
  const f = fake();
  Sound.say(setOf({ ambpass: { on: false, lines: [{ text: '', file: FILE }] } }), 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, { driverId: 'a', place: 1 });
  Sound.say(setOf({ ambpass: snd('') }), 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, { driverId: 'a', place: 1 });
  Sound.say(setOf({ ambpass: { on: true, lines: [{ text: 'vroom', file: '' }] } }), 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, { driverId: 'a', place: 1 });
  Sound.say(setOf({}), 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, { driverId: 'a', place: 1 });
  ok('a sound that is off, has no file (or only text), or that the set does not know yet, is silent: and the voice stays quiet', f.plays.length === 0 && f.spoken.length === 0);
  Sound.stop();
}
{ // which cars
  const f = fake(), at = (set, facts) => { const n = f.plays.length; Sound.say(set, 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, facts); return f.plays.length > n; };
  const lead = setOf({ ambpass: { ...snd(FILE), who: 'leader' } }), close = setOf({ ambpass: { ...snd(FILE), who: 'close' } }), close1 = setOf({ ambpass: { ...snd(FILE), who: 'close', near: 1 } });
  ok('"only the leader": plays for the car in first place, not for the others', at(lead, { place: 1 }) && !at(lead, { place: 2 }) && !at(lead, {}));
  ok('"only cars close together": the gap to the car in front, or the time the car behind is late, is under 3 seconds', at(close, { gap: 2000 }) && at(close, { behind: 2900 }) && !at(close, { gap: 3500, behind: 4000 }) && !at(close, { gap: null, behind: null }) && !at(close, {}));
  ok('...the limit can be set (1 second: 2 seconds is too far)', at(close1, { gap: 900 }) && !at(close1, { gap: 2000 }) && at(close1, { gap: 0 }));
  ok('"every car" (the default) plays for all', at(setOf({ ambpass: snd(FILE) }), { place: 5 }) && at(setOf({ ambpass: snd(FILE) }), {}));
  Sound.stop();
}
{ // not again within
  const f = fake(), set = setOf({ ambpass: { ...snd(FILE), cooldown: 10 } }), setD = setOf({ ambpass: { ...snd(FILE), cooldown: 10, coolFor: 'driver' } });
  const go = (s, who) => { const n = f.plays.length; Sound.say(s, 'lapdone', { driver: who, lane: 1 }, rnd0, undefined, { driverId: who }); return f.plays.length > n; };
  ok('"not again within 10 seconds": a second sound within that time is held back, one after it plays', go(set, 'a') && !go(set, 'b') && (f.tick(11000), go(set, 'b')));
  f.tick(11000);
  ok('...counted for each driver: another driver is not held back by the first', go(setD, 'a') && go(setD, 'b') && !go(setD, 'a'));
  Sound.stop();
}
{ // volume
  const f = fake();
  Sound.say(setOf({ ambpass: { ...snd(FILE), vol: 50 } }, { ambVolume: 0.5 }), 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {});
  Sound.say(setOf({ ambpass: { ...snd(FILE), vol: 0 } }), 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {});
  ok('the volume of the sound (percent) counts with the volume of the set: 50 percent of 0.5 is 0.25; 0 percent is silent', Math.abs(f.plays[0].vol - 0.25) < 1e-9 && f.plays[1].vol === 0);
  ok('the settings have limits and a way out of nothing (a set from before: 80 percent, ducking on to 35 percent, 6 at once)', (() => { const o = Sound.ambientOf({}), p = Sound.ambientOf({ ambVolume: 5, ambDuckLevel: -4, ambMax: 100, ambDuck: false }); return o.volume === 0.8 && o.duck && o.level === 0.35 && o.max === 6 && p.volume === 1 && p.level === 0 && p.max === 16 && !p.duck; })());
  Sound.stop();
}
{ // ducking
  const f = fake(), set = setOf({ ambpass: snd(FILE), ambleader: snd(FILE2) }), plain = setOf({ ambpass: snd(FILE) }, { ambDuck: false });
  Sound.say(set, 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {});
  ok('a sound that plays before a call is spoken is at the full volume', Math.abs(f.plays[0].vol - 0.8) < 1e-9);
  Sound.say(set, 'newleader', { driver: 'Alex' }, rnd0, undefined, { driverId: 'a', place: 1 });
  ok('...while a call is spoken it is lowered (35 percent of it), and so is a sound that starts then', Math.abs(f.plays[0].vol - 0.8 * 0.35) < 1e-9 && Math.abs(f.plays[1].vol - 0.8 * 0.35) < 1e-9);
  f.waiting.shift()();
  ok('...when the voice is done they are back at the volume of the set', Math.abs(f.plays[0].vol - 0.8) < 1e-9 && Math.abs(f.plays[1].vol - 0.8) < 1e-9);
  Sound.say(set, 'newleader', { driver: 'Alex' }, rnd0, undefined, { driverId: 'a', place: 1 }); Sound.say(set, 'fastestlap', { driver: 'Alex' }, rnd0, undefined, { driverId: 'a', place: 1 });
  f.waiting.shift()();
  ok('...they stay lowered while a second call waits for its turn', Math.abs(f.plays[0].vol - 0.8 * 0.35) < 1e-9);
  f.waiting.shift()();
  ok('...and are back when the queue is empty', Math.abs(f.plays[0].vol - 0.8) < 1e-9);
  Sound.stop();
  const g = fake(); Sound.say(plain, 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {}); Sound.say(plain, 'newleader', { driver: 'Alex' }, rnd0, undefined, {});
  ok('ducking can be turned off in the set: the volume does not change while a call is spoken', Math.abs(g.plays[0].vol - 0.8) < 1e-9);
  Sound.stop();
  const h = fake(); Sound.say(set, 'newleader', { driver: 'Alex' }, rnd0, undefined, {}); Sound.stop();
  Sound.say(set, 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {});
  ok('Stop ends the ducking too (a sound after it is at the full volume)', Math.abs(h.plays[h.plays.length - 1].vol - 0.8) < 1e-9);
  Sound.stop();
}
{ // most at once
  const f = fake(), set = setOf({ ambpass: snd(FILE) }, { ambMax: 2 });
  for (let n = 1; n <= 3; n++) Sound.say(set, 'lapdone', { driver: 'A' + n, lane: n }, rnd0, undefined, {});
  ok('"most sounds at once": the oldest one makes room for a new one', f.plays.length === 3 && f.plays[0].stopped && !f.plays[1].stopped && !f.plays[2].stopped && S.amb.items.length === 2);
  f.plays[2].ended();
  ok('a sound that has ended is gone from the list (it does not take a place)', S.amb.items.length === 1);
  Sound.stop();
}
{ // start after
  const f = fake(), set = setOf({ ambpass: { ...snd(FILE), delay: 2.5 } });
  Sound.say(set, 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {});
  ok('"start after 2.5 seconds": nothing plays at once, a wait of 2500 ms is set', f.plays.length === 0 && f.timers.length === 1 && f.timers[0].ms === 2500);
  f.fire(0);
  ok('...and the sound plays when the wait is over', f.plays.length === 1);
  Sound.stop();
  const g = fake(); Sound.say(set, 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {}); Sound.stop();
  ok('Stop ends a wait that is not over (the sound does not play afterwards)', g.timers[0].off === true && g.plays.length === 0);
}
{ // the pit crew stops when the car leaves
  const f = fake(), set = setOf({ ambpitin: snd(FILE), ambpitwork: snd(FILE2), ambpitout: snd(FILE) });
  Sound.say(set, 'pitin', { driver: 'Alex', lane: 1 }, rnd0, undefined, { driverId: 'a' }); Sound.say(set, 'pitin', { driver: 'Sam', lane: 2 }, rnd0, undefined, { driverId: 'b' });
  ok('a car in the pits: the braking and the pit crew start (two cars: four sounds)', f.plays.length === 4 && f.plays.filter(h => h.url === FILE2).length === 2);
  Sound.say(set, 'pitout', { driver: 'Alex', lane: 1 }, rnd0, undefined, { driverId: 'a' });
  const work = f.plays.filter(h => h.url === FILE2);
  ok('the car leaves: the pit crew of that car stops, the other car\'s goes on, the braking is not cut, the pull-away starts', work[0].stopped && !work[1].stopped && !f.plays[0].stopped && f.plays.length === 5 && f.plays[4].url === FILE);
  Sound.stop();
  const g = fake(), keep = setOf({ ambpitwork: { ...snd(FILE2), cut: false } });
  Sound.say(keep, 'pitin', { driver: 'Alex', lane: 1 }, rnd0, undefined, {}); Sound.say(keep, 'pitout', { driver: 'Alex', lane: 1 }, rnd0, undefined, {});
  ok('"stop it when the car leaves the pits" off: it plays to its end', g.plays.length === 1 && !g.plays[0].stopped);
  Sound.stop();
  const h = fake(), late = setOf({ ambpitwork: { ...snd(FILE2), delay: 4 } });
  Sound.say(late, 'pitin', { driver: 'Alex', lane: 1 }, rnd0, undefined, {}); Sound.say(late, 'pitout', { driver: 'Alex', lane: 1 }, rnd0, undefined, {}); h.fire(0);
  ok('a pit stop that is over before the pit crew sound was due: it does not start late', h.plays.length === 0);
  Sound.stop();
  const k = fake(), later = setOf({ ambpitwork: { ...snd(FILE2), delay: 4 } });
  Sound.say(later, 'pitin', { driver: 'Alex', lane: 1 }, rnd0, undefined, {}); Sound.say(later, 'pitin', { driver: 'Sam', lane: 2 }, rnd0, undefined, {}); Sound.say(later, 'pitout', { driver: 'Alex', lane: 1 }, rnd0, undefined, {}); k.fire(0); k.fire(1);
  ok('...and it is the pit crew of that car only that is not started: the other car\'s sound is still due', k.plays.length === 1);
  Sound.stop();
}
{ // several files, conditions
  const f = fake(), set = setOf({ ambpass: { on: true, lines: [{ text: '', file: FILE, only: { driver: 'a' } }, { text: '', file: FILE2 }] } });
  Sound.say(set, 'lapdone', { driver: 'Alex', lane: 1 }, rnd0, undefined, { driverId: 'a' }); Sound.say(set, 'lapdone', { driver: 'Sam', lane: 2 }, rnd0, undefined, { driverId: 'b' });
  ok('a file can be for one driver only (the "Only if" box): his own file for him, the other file for the rest', f.plays[0].url === FILE && f.plays[1].url === FILE2);
  const g = fake(), two = setOf({ ambpass: snd(FILE, FILE2) });
  Sound.say(two, 'lapdone', { driver: 'A', lane: 1 }, () => 0, undefined, {}); Sound.say(two, 'lapdone', { driver: 'A', lane: 1 }, () => 0.99, undefined, {});
  ok('with several files one is picked at random', g.plays[0].url === FILE && g.plays[1].url === FILE2);
  Sound.stop();
}
{ // does the set want the lap event?
  ok('the lap event is made only when a sound with a file waits for it', !Sound.wantsLaps(setOf({})) && !Sound.wantsLaps(setOf({ ambpass: snd('') })) && Sound.wantsLaps(setOf({ ambpass: snd(FILE) })) && !Sound.wantsLaps(setOf({ ambpass: { ...snd(FILE), on: false } })) && !Sound.wantsLaps(null));
}
{ // the Test button
  const f = fake(), set = setOf({ ambpass: { ...snd(FILE), vol: 50 } }, { ambVolume: 1 });
  ok('Test plays a file with the volume of the set and of the sound; no file: nothing', Sound.ambientTest(set, 'ambpass', FILE) === true && Math.abs(f.plays[0].vol - 0.5) < 1e-9 && Sound.ambientTest(set, 'ambpass', '') === false && f.plays.length === 1);
  Sound.stop();
}
{ // a player that fails never stops the race or the voice
  const f = fake(); S.ambBackend = { play() { throw new Error('no sound card'); } };
  let said = null, threw = false; try { said = Sound.say(setOf({ ambleader: snd(FILE) }), 'newleader', { driver: 'Alex' }, rnd0, undefined, {}); } catch (e) { threw = true; }
  ok('a player that cannot play: the call is still said, nothing is left in the list', !threw && !!said && f.spoken.length === 1 && S.amb.items.length === 0);
  Sound.stop();
  const g = fake(); S.ambBackend = { play(url, vol, ended) { ended(); return null; } };
  Sound.say(setOf({ ambpass: snd(FILE) }), 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {});
  ok('a file that cannot be read (the browser says it has ended at once) takes no place', S.amb.items.length === 0 && g.plays.length === 0);
  Sound.stop();
}
{ // a set without any ambient setting works as before
  const f = fake(), set = { name: 'Old', calls: { newleader: { on: true, lines: [{ text: '{driver} leads', file: '' }] } } };
  const said = Sound.say(set, 'newleader', { driver: 'Alex' }, rnd0, undefined, { driverId: 'a' });
  ok('a set from before 1.48.0 says its calls as before and plays no sound', !!said && f.spoken.join() === 'Alex leads' && f.plays.length === 0 && Sound.ambientFor(set, 'lapdone', {}, {}).length === 0);
  Sound.stop();
}

// ---- release 2: the trouble sounds, the pit-work sounds, the winner and the podium, the heat horn, the swaps and the time tokens ----
{
  const by = id => A.AMBIENT.find(d => d.id === id), fs = require('fs'), ann = fs.readFileSync(__dirname + '/../renderer/announcer.js', 'utf8'), race = fs.readFileSync(__dirname + '/../renderer/race.js', 'utf8'), body = ann.slice(ann.indexOf('function create'));
  const sec = n => A.AMBIENT.filter(d => d.section === n).map(d => d.id).join();
  ok('the section Trouble: a hit, a critical state, a failure, low fuel, out of fuel, a penalty, a car that is out', sec('Trouble') === 'ambdamagehit,ambdamagecrit,ambfailure,ambfuellow,ambnofuel,ambpenalty,ambout');
  ok('...Pit lane has the pit-work sounds after the stop sounds, Race moments the winner, the podium and the heat horn, and the last section the swaps and the tokens', sec('Pit lane') === 'ambpitin,ambpitwork,ambpitout,ambrefuel,ambtyres,ambrepair' && sec('Race moments') === 'amblastlap,ambfinish,ambwinner,ambpodium,ambnextheat' && sec('Driver swaps and time tokens') === 'ambswapdue,ambswapdone,ambtokenwarn,ambtokenout');
  const table = { ambdamagehit: 'damagehit', ambdamagecrit: 'damagecritical,failurecritical', ambfailure: 'failure,failurecritical', ambfuellow: 'fuellow', ambnofuel: 'outoffuel', ambpenalty: 'penalty,specialpenalty', ambout: 'damageout,failureout,damagedq,failuredq,disqualified',
    ambrefuel: 'refuelled', ambtyres: 'tyrenew,tyrechange', ambrepair: 'repaired,failurerepaired', ambwinner: 'winner', ambpodium: 'podium', ambnextheat: 'nextheat,nextfinal', ambswapdue: 'swapdue', ambswapdone: 'swapdone', ambtokenwarn: 'tokenwarning', ambtokenout: 'tokenout' };
  ok('each of the 17 new sounds waits for exactly the moments it says (the table of release 2)', Object.keys(table).length === 17 && Object.keys(table).every(id => by(id) && by(id).on.join() === table[id]));
  ok('a critical state and a critical failure give the alarm; a failure of any kind gives the bang (both for a critical failure)', by('ambdamagecrit').on.join() === 'damagecritical,failurecritical' && by('ambfailure').on.join() === 'failure,failurecritical');
  ok('a car that is out: retired by damage or a failure, thrown out by damage or a failure, or disqualified', by('ambout').on.join() === 'damageout,failureout,damagedq,failuredq,disqualified');
  ok('a time token sound has an Only if box without places and gaps (a Time Token Session has none); the winner has them', !A.conditionsOf(by('ambtokenwarn')).top && !A.conditionsOf(by('ambtokenout')).gap && A.conditionsOf(by('ambtokenwarn')).driver && A.conditionsOf(by('ambwinner')).top && A.conditionsOf(by('ambwinner')).gap);
  ok('the heat horn is for the next heat and for the next final; the tokens have the lane as a word', by('ambnextheat').on.join() === 'nextheat,nextfinal' && by('ambtokenwarn').vars.includes('lane') && by('ambtokenout').vars.includes('lane'));
  ok('every moment a sound waits for is really made: by the announcer (an event of its own) or by the race screen (the tokens, the pre-race call)', A.AMBIENT.every(d => d.on.map(e => e.split(':')[0]).every(e => /^countdown[1-5]$/.test(e) ? /ev\('countdown' \+/.test(body) : /^weather(cloudy|wet|clearing|dry)$/.test(e) ? new RegExp("WEATHER_CALL = \\{[^}]*'" + e + "'").test(ann) && /ev\(WEATHER_CALL\[e\.state\]/.test(body) : new RegExp("ev\\([^\\n]*'" + e + "'").test(body) || new RegExp("said\\.push\\(\\['" + e + "'|Sound\\.say\\(audioSet, '" + e + "'").test(race))) && A.AMBIENT.every(d => (d.stop || []).map(e => e.split(':')[0]).every(e => new RegExp("ev\\([^\\n]*'" + e + "'").test(body) || new RegExp("Sound\\.say\\(audioSet, '" + e + "'").test(race))));
  // a short race: what the announcer says goes through the channel, and the sounds of that moment play
  const { createRace } = require('../renderer/engine.js');
  const ent = [{ lane: 0, driverId: 'a', driverName: 'Alex' }, { lane: 1, driverId: 'b', driverName: 'Sam' }], eng = createRace({ type: 'race', laps: 2, minLap: 1000, entries: ent }), an = A.create({ lapSound: true, lapLimit: 2 }), evs = [];
  const obs = ctx => an.observe(eng, ctx).forEach(e => evs.push(e));
  obs({ phase: 'ready' }); for (let n = 1; n <= 5; n++) obs({ phase: 'countdown', lights: n });
  eng.start(0); obs({ phase: 'running' }); eng.cross(0, 5000); obs({ phase: 'running' }); eng.cross(1, 5800); obs({ phase: 'running' }); eng.cross(0, 10000); obs({ phase: 'running' }); eng.cross(1, 11000); obs({ phase: 'running' }); obs({ phase: 'finished' });
  const f = fake(), every = setOf(Object.fromEntries(A.AMBIENT.map(d => [d.id, snd(FILE)])), { ambMax: 16 });
  evs.forEach(e => Sound.say(every, e.call, e.vars, rnd0, undefined, e.facts));
  const count = id => f.plays.filter(h => h.id === id).length, played = {}; S.amb.log.forEach(x => { played[x.id] = (played[x.id] || 0) + 1; });
  ok('a short race goes through the channel: five start lights, lights out, a sound for each of the four laps, the crowd that begins at lights out, the finish, the winner and the podium; and not the sounds of what did not happen', played.ambbeep === 5 && played.amblightsout === 1 && played.ambpass === 4 && played.ambfinish === 1 && played.ambwinner === 1 && played.ambpodium === 1 && played.amblastlap === 1 && played.ambcrowd === 1 && !played.ambparaddock && !played.ambrain && !played.ambpitin && !played.ambdamagehit && !played.ambout && !played.ambtokenout && !played.ambnextheat);
  Sound.stop();
}

// ---- release 3: sounds that keep playing (loops), with a fade in and a fade out, and the weather ----
{
  const drain = f => { for (let i = 0; i < f.timers.length && i < 2000; i++) f.fire(i); }; // (every timer, also the ones that the fades make on the way)
  const lset = (calls, extra) => setOf(calls, { ambDuck: false, ...extra }), /* (the voice that speaks the call of the same moment would lower the loop: that is tested on its own) */ near = (a, b) => Math.abs(a - b) < 1e-9, say = (set, ev, vars) => Sound.say(set, ev, vars || {}, rnd0, undefined, {});
  {
    const f = fake(), set = lset({ ambcrowd: snd(FILE) });
    say(set, 'lightsout');
    ok('a loop starts at its moment, as a loop, and silent (it fades in: 2 seconds when not set)', f.plays.length === 1 && f.plays[0].loop === true && f.plays[0].vol === 0 && f.timers.length === 1 && f.timers[0].ms === 100);
    for (let i = 0; i < 5; i++) f.fire(i);
    ok('...a quarter of the way after half a second (5 of 20 steps)', near(f.plays[0].vol, 0.8 * 0.25));
    drain(f);
    ok('...and at the volume of the set (80 percent) when the fade is over', near(f.plays[0].vol, 0.8) && !f.plays[0].stopped);
    say(set, 'lightsout');
    ok('the moment comes again while it plays: it goes on, and does not start a second time', f.plays.length === 1 && S.amb.items.length === 1);
    say(set, 'finished');
    ok('its stop moment: it fades out (3 seconds when not set) and is not stopped before that', !f.plays[0].stopped && S.amb.items.length === 1);
    const mid = f.timers.length; for (let i = 0; i < 15; i++) f.fire(mid - 1 + i);
    ok('...half way after one and a half seconds', near(f.plays[0].vol, 0.4) && !f.plays[0].stopped);
    drain(f);
    ok('...and it is stopped and gone from the list when the fade is over', f.plays[0].stopped && S.amb.items.length === 0 && f.plays[0].vol === 0);
    Sound.stop();
  }
  { // the stop moment comes twice (the end of a heat, then the finish): the fade goes on as it was
    const f = fake(), set = lset({ ambcrowd: { ...snd(FILE), fadeIn: 0, fadeOut: 3 } });
    say(set, 'lightsout'); say(set, 'finished'); const t0 = f.timers.length - 1; for (let i = 0; i < 10; i++) f.fire(t0 + i);
    say(set, 'heatend'); for (let i = 10; i < 15; i++) f.fire(t0 + i);
    ok('a second stop moment while it fades out does not start the fade again (half way after one and a half seconds, as before)', near(f.plays[0].vol, 0.4) && S.amb.items.length === 1);
    Sound.stop();
  }
  { // fades of your own, none at all
    const f = fake(), set = lset({ ambcrowd: { ...snd(FILE), fadeIn: 1, fadeOut: 0 } });
    say(set, 'lightsout');
    ok('a fade in of 1 second takes ten steps of a tenth of a second', f.plays[0].vol === 0 && f.timers.length === 1 && (() => { let n = 0; for (let i = 0; i < f.timers.length; i++) { if (!f.timers[i].off) { f.fire(i); n++; } } return n === 10 && near(f.plays[0].vol, 0.8); })());
    say(set, 'finished');
    ok('no fade out: it stops at once', f.plays[0].stopped && S.amb.items.length === 0);
    const g = fake(), none = lset({ ambcrowd: { ...snd(FILE), fadeIn: 0 } });
    say(none, 'lightsout');
    ok('no fade in: it starts at the volume at once, and nothing is waited for', near(g.plays[0].vol, 0.8) && g.timers.length === 0);
    Sound.stop();
  }
  { // the volume of the sound counts, and the voice lowers a loop
    const f = fake(), set = setOf({ ambcrowd: { ...snd(FILE), vol: 50, fadeIn: 0 }, newleader: { on: true, lines: [{ text: 'x', file: '' }] } });
    say(set, 'lightsout'); Sound.say(set, 'newleader', { driver: 'Alex' }, rnd0, undefined, {});
    ok('a loop is lowered while a call is spoken (the volume of the sound, 50 percent, of the set, 80: 0.4; lowered to 35 percent of that)', near(f.plays[0].vol, 0.4 * 0.35));
    f.waiting.shift()(); f.waiting.shift()(); // (the call of lights out, then the new leader)
    ok('...and comes back when the voice is done', near(f.plays[0].vol, 0.4));
    Sound.stop();
  }
  { // the loops are not counted in "most sounds at once"
    const f = fake(), set = lset({ ambcrowd: { ...snd(FILE), fadeIn: 0 }, ambpass: snd(FILE2) }, { ambMax: 1 });
    say(set, 'lightsout'); Sound.say(set, 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {}); Sound.say(set, 'lapdone', { driver: 'B', lane: 2 }, rnd0, undefined, {});
    ok('"most sounds at once" is for the other sounds: the loop is never the one that makes room, and does not take a place', f.plays.length === 3 && !f.plays[0].stopped && f.plays[1].stopped && !f.plays[2].stopped);
    Sound.stop();
  }
  { // it comes back while it fades out
    const f = fake(), set = lset({ ambrain: { ...snd(FILE), fadeIn: 0, fadeOut: 4 } });
    say(set, 'weatherconditions', { weather: 'wet' }); say(set, 'weatherconditions', { weather: 'clearing' });
    for (let i = 0; i < 10; i++) f.fire(i);
    ok('a loop that is fading out when its moment comes again is not stopped: it fades back in', f.plays.length === 1 && f.plays[0].vol < 0.8 && f.plays[0].vol > 0.5 && !f.plays[0].stopped);
    say(set, 'weatherconditions', { weather: 'wet' }); drain(f);
    ok('...and plays at the full volume, once', f.plays.length === 1 && !f.plays[0].stopped && near(f.plays[0].vol, 0.8) && S.amb.items.length === 1);
    Sound.stop();
  }
  { // a very short fade has its steps too; rain that goes straight to dry weather ends too
    const f = fake(), set = lset({ ambrain: { ...snd(FILE), fadeIn: 0.2, fadeOut: 0.1 } });
    say(set, 'weatherconditions', { weather: 'wet' });
    ok('a fade in of 0.2 seconds has two steps: half the volume after the first, all of it after the second', f.plays[0].vol === 0 && (f.fire(0), near(f.plays[0].vol, 0.4)) && (f.fire(1), near(f.plays[0].vol, 0.8)));
    say(set, 'weatherconditions', { weather: 'dry' });
    ok('rain that goes straight to dry weather (no clearing in between) ends as well; a fade out of 0.1 seconds has one step', !f.plays[0].stopped && (f.fire(f.timers.length - 1), f.plays[0].stopped));
    Sound.stop();
  }
  { // a wait before it starts
    const f = fake(), set = lset({ ambcrowd: { ...snd(FILE), delay: 3 } });
    say(set, 'lightsout'); say(set, 'lightsout');
    ok('"start after 3 seconds" for a loop: one wait, not two (the moment came twice)', f.plays.length === 0 && f.timers.length === 1 && f.timers[0].ms === 3000);
    say(set, 'finished');
    ok('...and the stop moment ends the wait before the loop has started', f.timers[0].off === true && f.plays.length === 0);
    Sound.stop();
  }
  { // Stop ends a loop at once, also in the middle of a fade
    const f = fake(), set = lset({ ambcrowd: snd(FILE) });
    say(set, 'lightsout'); f.fire(0); f.fire(1); Sound.stop();
    ok('Stop (a new race, Back) ends a loop at once, and the rest of its fade does not run', f.plays[0].stopped && S.amb.items.length === 0 && f.timers.every(t => t.off || t === f.timers[f.timers.length - 1]) && (() => { const n = f.plays.length, v = f.plays[0].vol; drain(f); return f.plays.length === n && f.plays[0].vol === v; })());
  }
  { // the paddock and the crowd: heat after heat
    const f = fake(), set = lset({ ambparaddock: snd(FILE), ambcrowd: snd(FILE2) });
    say(set, 'prerace', { track: 'T' }); drain(f);
    ok('the paddock starts with the pre-race call', f.plays.length === 1 && f.plays[0].url === FILE && near(f.plays[0].vol, 0.8));
    say(set, 'lightsout');
    ok('lights out: the paddock fades out and the crowd fades in', f.plays.length === 2 && f.plays[1].url === FILE2 && f.plays[1].loop);
    drain(f);
    ok('...when the fades are over only the crowd plays', f.plays[0].stopped && !f.plays[1].stopped && near(f.plays[1].vol, 0.8) && S.amb.items.length === 1);
    say(set, 'heatend'); drain(f);
    ok('the end of a heat: the crowd ends and the paddock is back (until the lights go out again)', f.plays[1].stopped && f.plays.length === 3 && f.plays[2].url === FILE && !f.plays[2].stopped);
    say(set, 'lightsout'); drain(f); say(set, 'finalend'); drain(f);
    ok('the end of the final too (and the last race, "finished", ends the crowd and starts nothing)', f.plays.length === 5 && f.plays[3].stopped === true && !f.plays[4].stopped);
    say(set, 'lightsout'); say(set, 'finished'); drain(f);
    ok('the end of the last race ends the crowd, and nothing comes after it', f.plays.filter(h => !h.stopped).length === 0);
    Sound.stop();
  }
  { // the weather
    const f = fake(), set = lset({ ambthunder: snd(FILE), ambrain: { ...snd(FILE2), fadeIn: 0 }, ambdry: { ...snd(FILE), fadeIn: 0 } });
    say(set, 'weatherconditions', { weather: 'dry' });
    ok('the conditions at lights out, dry: the dry weather sound starts (and not the rain)', f.plays.length === 1 && f.plays[0].url === FILE && f.plays[0].loop);
    say(set, 'weathercloudy', { weather: 'cloudy' }); say(set, 'weatherconditions', { weather: 'cloudy' }); drain(f);
    ok('clouds: the dry weather sound ends, nothing starts', f.plays[0].stopped && f.plays.length === 1);
    say(set, 'weatherwet', { weather: 'wet' }); say(set, 'weatherconditions', { weather: 'wet' });
    ok('rain: the thunder plays once (not a loop) and the rain loop starts', f.plays.length === 3 && f.plays[1].url === FILE && !f.plays[1].loop && f.plays[2].url === FILE2 && f.plays[2].loop);
    say(set, 'weatherclearing', { weather: 'clearing' }); say(set, 'weatherconditions', { weather: 'clearing' }); drain(f);
    ok('the rain stops: the rain loop ends (the thunder is not touched)', f.plays[2].stopped && f.plays.length === 3);
    say(set, 'weatherdry', { weather: 'dry' }); say(set, 'weatherconditions', { weather: 'dry' });
    ok('dry again: the dry weather sound starts again', f.plays.length === 4 && f.plays[3].loop && !f.plays[3].stopped);
    say(set, 'finished'); drain(f);
    ok('the end of the race ends it', f.plays[3].stopped);
    Sound.stop();
  }
  { // the player of the browser: a loop is set to loop, the others are not
    const made = [], saved = globalThis.Audio, keep = S.ambBackend;
    globalThis.Audio = class { constructor(url) { this.url = url; this.volume = 1; this.loop = false; made.push(this); } play() { return Promise.resolve(); } pause() { this.paused = true; } };
    S.ambBackend = null; S.amb.items = []; S.amb.pending = []; S.amb.duck = false;
    const set = lset({ ambcrowd: { ...snd(FILE), fadeIn: 0 }, ambpass: snd(FILE2) });
    say(set, 'lightsout'); Sound.say(set, 'lapdone', { driver: 'A', lane: 1 }, rnd0, undefined, {});
    ok('the player of the browser: a loop is an audio element that loops, at the volume of the set; another sound is not', made.length === 2 && made[0].loop === true && made[1].loop === false && near(made[0].volume, 0.8) && near(made[1].volume, 0.8));
    Sound.stop();
    ok('...and Stop pauses them', made.every(a => a.paused === true));
    globalThis.Audio = saved; S.ambBackend = keep;
  }
  { // Test plays a loop once
    const f = fake(), set = lset({ ambcrowd: snd(FILE) });
    Sound.ambientTest(set, 'ambcrowd', FILE);
    ok('Test plays a loop sound once, at the volume it will have (no loop, no fade)', f.plays.length === 1 && f.plays[0].loop === false && near(f.plays[0].vol, 0.8));
    Sound.stop();
  }
}

// ---- the race hands its events to the channel ----
{ const fs = require('fs'), race = fs.readFileSync(__dirname + '/../renderer/race.js', 'utf8'), html = fs.readFileSync(__dirname + '/../renderer/index.html', 'utf8');
  ok('the race asks the announcer for the lap event when the audio set has a sound for it (in mkAnn, so every heat and every final has it)', /mkAnn = \(\) => Announcer\.create\(\{[^]*?lapSound: audioSet \? Sound\.wantsLaps\(audioSet\) : false/.test(race));
  ok('...every event goes through Sound.say, which hands it to the ambient channel (with its facts: the place, the gaps)', /said\.forEach\(\(\[id, vars, facts\]\) => \{ try \{ Sound\.say\(audioSet, id, vars, undefined, undefined, facts\)/.test(race));
  ok('a new race ends the sounds of the one before (Sound.stop ends the ambient sounds too)', /if \(live\) \{[^\n]*Sound\.stop\(\);/.test(race));
  const css = fs.readFileSync(__dirname + '/../renderer/styles.css', 'utf8');
  ok('the folder has its styles: the note and the settings row on top, the sections as folders (a lighter header, a smaller arrow that turns when open, the keyboard focus), and the options row of a sound (the tick boxes in the colour of the page)', /\.ambintro\{[^}]*padding/.test(css) && /\.ambgroup\{overflow:hidden\}/.test(css) && /\.ambsection>summary\{[^}]*cursor:pointer[^}]*list-style:none/.test(css) && /\.ambsection>summary::-webkit-details-marker\{display:none\}/.test(css) && /\.ambsection\[open\]>summary::before\{transform:rotate\(45deg\)/.test(css) && /\.ambsection>summary:focus-visible\{outline:2px solid var\(--accent\)/.test(css) && /\.ambsection>\.audcall\{[^}]*border-top:1px solid var\(--line\)/.test(css) && /\.ambset\{[^}]*align-items:center/.test(css) && /\.ambset input\[type=checkbox\]\{accent-color:var\(--accent\)/.test(css) && /\.ambcall \.ambopts\{[^}]*margin-top/.test(css));
  ok('the announcer is loaded before the sound player, which needs its list', html.indexOf('announcer.js') > 0 && html.indexOf('announcer.js') < html.indexOf('sound.js'));
}

console.log(fails ? `${fails} FAILED` : 'ambient: all PASSED'); process.exit(fails ? 1 : 0);
