// 1.62.0: a Race can be limited by a time (next to laps and a distance), the old session type Timed race becomes a Race limited by a time, and the Next Heat widget.
const fs = require('fs'), os = require('os'), path = require('path');
const RL = require('../renderer/racelimit.js'), En = require('../renderer/endurance.js'), Wd = require('../renderer/widgets.js'), Hs = require('../renderer/homestats.js'), Ds = require('../renderer/distance.js');
const Database = require('../db.js'), T = require('../transfer.js'), schema = require('../schema.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// ---- what limits a race ----
{ const old = { sessionType: 'timed', duration: 7, name: 'Old', laps: 9 };
  ok('a Timed race of before 1.62.0 is a Race limited by a time, with the same minutes and nothing else changed', RL.upgrade(old) === true && old.sessionType === 'race' && old.raceBy === 'time' && old.duration === 7 && old.name === 'Old' && old.laps === 9);
  ok('...and doing it twice changes nothing more', RL.upgrade(old) === false && old.sessionType === 'race' && old.raceBy === 'time');
  ok('any other setup is left alone (a race by laps, a heat race by time, qualifying, nothing at all)', (() => { const l = [{ sessionType: 'race', raceBy: 'laps' }, { sessionType: 'heats', heatBy: 'time' }, { sessionType: 'qualifying' }, {}, null, undefined, 'x'];
    return l.every(s => RL.upgrade(s) === false) && l[0].sessionType === 'race' && l[1].sessionType === 'heats'; })());
  ok('a race is limited by a time when it says so, and a Timed race as the race screen works with it is too', RL.isTime({ sessionType: 'race', raceBy: 'time' }) && RL.isTime({ sessionType: 'timed' }) && !RL.isTime({ sessionType: 'race', raceBy: 'distance' }) && !RL.isTime({ sessionType: 'race' }) && !RL.isTime({ sessionType: 'heats', heatBy: 'time' }) && !RL.isTime(null));
  const s = { sessionType: 'race', raceBy: 'time', duration: 4, laps: 20 }, e = RL.effective(s);
  ok('the race screen works with a Timed race, and the setup itself is not changed', e.sessionType === 'timed' && e.duration === 4 && e.raceBy === 'time' && s.sessionType === 'race' && RL.effective({ sessionType: 'race', raceBy: 'laps' }).sessionType === 'race' && RL.effective(null) === null);
  ok('...also through the Endurance Race function the race screen and Home use (an Endurance Race by time is still a timed race, one by laps still a race)', En.effective(s).sessionType === 'timed' && En.effective(s).duration === 4
    && En.effective({ sessionType: 'endurance', enduranceBy: 'time' }).sessionType === 'timed' && En.effective({ sessionType: 'endurance', enduranceBy: 'laps' }).sessionType === 'race' && En.effective({ sessionType: 'race', raceBy: 'distance' }).sessionType === 'race');
  ok('a Race limited by a time is no race by distance', !Ds.isOn(s) && !Ds.isOn(En.effective(s)));
}

// ---- the setup form ----
const F = schema.racesetups, field = k => F.fields.find(f => f.key === k);
const shown = (f, vals) => !f.showIf || f.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(vals[k] ?? '')));
const keys = vals => F.fields.filter(f => shown(f, vals)).map(f => f.key);
ok('the session types: no Timed race any more, and the Race is just "Race"', field('sessionType').options.map(o => o[0]).join() === 'practice,qualifying,race,heats,endurance,tokens' && field('sessionType').options.find(o => o[0] === 'race')[1] === 'Race');
ok('"The race is over after" (1.69.0: it was "The race is limited by") has a time next to laps and a distance, in the order laps, time, distance, and the hint says how a time race is decided', field('raceBy').label === 'The race is over after' && field('raceBy').options.map(o => o[0]).join() === 'laps,time,distance' && field('raceBy').options.find(o => o[0] === 'time')[1] === 'Time' && /most laps/.test(field('raceBy').hint) && /lowest total time/.test(field('raceBy').hint));
ok('a race limited by a time asks for the minutes and not for the laps, the distance or the rule about the lead car', (() => { const k = keys({ sessionType: 'race', raceBy: 'time' });
  return k.includes('duration') && !k.includes('laps') && !k.includes('endRule') && !k.includes('distance') && !k.includes('distanceMode') && !k.includes('distanceMax'); })());
ok('...a race by laps asks for the laps and the lead car rule and not for the minutes (as before), also when raceBy was never saved', ['laps', ''].every(r => { const k = keys({ sessionType: 'race', raceBy: r }); return k.includes('laps') && k.includes('endRule') && !k.includes('duration'); }));
ok('...a race by a distance asks for the distance and the lead car rule', (() => { const k = keys({ sessionType: 'race', raceBy: 'distance' }); return k.includes('distance') && k.includes('endRule') && !k.includes('duration') && !k.includes('laps'); })());
ok('...all the rules of a race (penalties, fuel, damage, weather, Balance of Power, safety car...) are asked for a race limited by a time too', (() => { const t = keys({ sessionType: 'race', raceBy: 'time' }), l = keys({ sessionType: 'race', raceBy: 'laps' });
  return ['penaltySystem', 'fuelRules', 'damageSystem', 'weather', 'bop', 'lightsMin', 'safetyCar', 'trackCallAction'].every(k => t.includes(k) === l.includes(k) && t.includes(k)); })());
ok('qualifying, a heat race by time and an Endurance Race by time still ask for their minutes', keys({ sessionType: 'qualifying' }).includes('duration') && keys({ sessionType: 'heats', heatBy: 'time' }).includes('duration') && keys({ sessionType: 'endurance', enduranceBy: 'time' }).includes('duration')
  && !keys({ sessionType: 'practice' }).includes('duration') && !keys({ sessionType: 'heats', heatBy: 'laps' }).includes('duration'));
ok('a heat is over after laps, a time or a distance, with the same words as a race (1.69.0: it was "Each heat is limited by" with "A time")', field('heatBy').label === 'Each heat is over after' && field('heatBy').options.map(o => o.join(':')).join() === 'laps:Laps,time:Time,distance:Distance' && /Time: every heat runs for the same time/.test(field('heatBy').hint));

// ---- old data ----
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-'));
{ const f = path.join(tmpDir, 'old.json');
  fs.writeFileSync(f, JSON.stringify({ version: '1.61.2', racesetups: [{ id: 'a', name: 'Club night', sessionType: 'timed', duration: 12, track: '' }, { id: 'b', name: 'Sprint', sessionType: 'race', raceBy: 'laps', laps: 10 }, { id: 'c', name: 'Heats', sessionType: 'heats', heatBy: 'time', duration: 3 }] }));
  const d = new Database(f), by = id => d.data.racesetups.find(r => r.id === id);
  ok('a database from before 1.62.0: the Timed race setup is a Race limited by a time, with its minutes', by('a').sessionType === 'race' && by('a').raceBy === 'time' && by('a').duration === 12 && by('a').name === 'Club night');
  ok('...the other setups are the same as they were', by('b').sessionType === 'race' && by('b').raceBy === 'laps' && by('b').laps === 10 && by('c').sessionType === 'heats' && by('c').heatBy === 'time' && by('c').duration === 3);
  d.add('racesetups', { name: 'New', sessionType: 'race', raceBy: 'time', duration: 5 }); d.saveNow();
  const d2 = new Database(f), again = d2.data.racesetups.find(r => r.id === 'a');
  ok('...saved and read again it stays a Race limited by a time', again.sessionType === 'race' && again.raceBy === 'time' && again.duration === 12 && d2.data.racesetups.length === 4 && d2.data.racesetups.filter(r => r.sessionType === 'timed').length === 0);
}
{ // a file made by an older version holds a Timed race: it comes in as a Race limited by a time
  const mk = () => new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rl-')), 'db.json')), a = mk(), b = mk();
  const s1 = a.add('racesetups', { name: 'Friday', sessionType: 'race', raceBy: 'laps', laps: 5 }), s2 = a.add('racesetups', { name: 'Timed Friday', sessionType: 'race', raceBy: 'time', duration: 9 });
  const bundle = T.collect(a.data, { racesetups: [s1.id, s2.id] }, false); bundle.items.racesetups.find(r => r.name === 'Timed Friday').sessionType = 'timed'; delete bundle.items.racesetups.find(r => r.name === 'Timed Friday').raceBy; // (as an export of 1.61.2 has it)
  T.apply(b, bundle);
  const t = b.data.racesetups.find(r => r.name === 'Timed Friday'), r = b.data.racesetups.find(x => x.name === 'Friday');
  ok('an export file of an older version: its Timed race is imported as a Race limited by a time', !!t && t.sessionType === 'race' && t.raceBy === 'time' && t.duration === 9 && !!r && r.sessionType === 'race' && r.raceBy === 'laps' && r.laps === 5);
}

// ---- the words on Home ----
{ const rules = (s, n) => Object.fromEntries(Hs.rules(s, { typeLabel: 'Race', distUnit: 'm', ...n }));
  ok('the rules on Home say the minutes of a race limited by a time, and the laps or the distance of the other races', rules({ sessionType: 'race', raceBy: 'time', duration: 12, laps: 20 }).Length === '12 minutes' && rules({ sessionType: 'race', raceBy: 'laps', laps: 20 }).Length === '20 laps'
    && rules({ sessionType: 'race', laps: 8 }).Length === '8 laps' && rules({ sessionType: 'race', raceBy: 'distance', distance: 100 }).Length === '100 m' && rules({ sessionType: 'race', raceBy: 'time' }).Length === '5 minutes');
  ok('...and a race limited by a time has the rules of a race (penalties, damage, weather, Balance of Power)', (() => { const r = rules({ sessionType: 'race', raceBy: 'time', duration: 3 }); return 'Penalties' in r && 'Damage' in r && 'Weather' in r && 'Balance of Power' in r; })());
}

ok('the lists on Home name the kinds of session "Race" and "Timed race" (a race limited by a time is saved as a Timed race)', Hs.recent({ sessions: [{ id: 'a', sessionType: 'race', date: '2026-10-01T10:00:00Z', standings: [] }, { id: 'b', sessionType: 'timed', date: '2026-10-02T10:00:00Z', standings: [] }], count: 10 }).map(r => r.kind).sort().join() === 'Race,Timed race');

// ---- the Next Heat widget ----
const heat = (idx, more = {}) => ({ idx, count: 3, by: 'points', list: [
  { name: 'Heat 1', drivers: [{ lane: 0, name: 'Alex' }, { lane: 1, name: 'Sam' }] },
  { name: 'Heat 2', drivers: [{ lane: 1, name: 'Alex' }, { lane: 0, name: 'Kim' }] },
  { name: 'Heat 3', drivers: [{ lane: 0, name: 'Sam' }, { lane: 1, name: 'Kim' }] }], ...more });
const N = (h, phase, opt = {}) => Wd.nextHeatHtml(h, phase, opt), text = html => html.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
ok('the widget is in the Race folder, with its settings', (() => { const d = Wd.REGISTRY.find(x => x.type === 'nextheat'); return !!d && d.label === 'Next Heat' && d.group === 'Race' && !d.perLane && d.options.map(o => o.key).join() === 'howmany,title,lanes,layout,countdown'; })());
ok('before the start the next heat is the first one, with the drivers by lane', text(N(heat(0), 'ready')) === '|Next: Heat 1 of 3|1: Alex|2: Sam|');
ok('the lanes are in order, whatever the order of the list', text(N(heat(1), 'ready')) === '|Next: Heat 2 of 3|1: Kim|2: Alex|');
ok('while a heat is racing (countdown, running, paused) or is checked after the finish (review), the next heat is the one after it', ['countdown', 'running', 'paused', 'review'].every(p => text(N(heat(0), p)) === '|Next: Heat 2 of 3|1: Kim|2: Alex|'));
ok('between two heats the heat that has been counted is done, so the next heat is the one at the index', text(N(heat(1), 'between')) === '|Next: Heat 2 of 3|1: Kim|2: Alex|');
ok('the break counts down while the next heat waits ("Starts in 1:30"), and not in any other phase', text(N(heat(1, { breakLeft: 90 }), 'between')) === '|Next: Heat 2 of 3|1: Kim|2: Alex|Starts in 1:30|' && !N(heat(1, { breakLeft: 90 }), 'running').includes('Starts in') && !N(heat(1, { breakLeft: 0 }), 'between').includes('Starts in') && N(heat(1, { breakLeft: 3725 }), 'between').includes('Starts in 1:02:05'));
ok('...and the countdown can be turned off', !N(heat(1, { breakLeft: 90 }), 'between', { countdown: false }).includes('Starts in'));
ok('in the last heat there is no next heat, and after the last heat the race is finished', text(N(heat(2), 'running')) === '|This is the last heat|' && text(N(heat(2), 'review')) === '|This is the last heat|' && text(N(heat(3), 'finished')) === '|Race finished|' && text(N(heat(3), 'between')) === '|Race finished|');
ok('a final has its own name and no "of 3"; the heats before it do', (() => { const h = { idx: 2, count: 3, total: 5, list: [...heat(0).list, { name: 'Final B', drivers: [{ lane: 0, name: 'Lee' }] }, { name: 'Final A', drivers: [{ lane: 0, name: 'Alex' }, { lane: 1, name: 'Sam' }] }] };
  return text(N(h, 'running', { howmany: '3' })) === '|Next: Final B|1: Lee|Final A|1: Alex|2: Sam|' && text(N({ ...h, idx: 1 }, 'ready')) === '|Next: Heat 2 of 3|1: Kim|2: Alex|'; })());
ok('the number of heats shown: one, two or three, and never more than are left', (() => { const t = n => (N(heat(0), 'ready', { howmany: n }).match(/class="nhw-b"/g) || []).length;
  return t('1') === 1 && t('2') === 2 && t('3') === 3 && t(undefined) === 1 && t('9') === 3 && t('x') === 1 && (N(heat(1), 'ready', { howmany: '3' }).match(/class="nhw-b"/g) || []).length === 2; })());
ok('the number of heats shown is also limited when more are left (a list of five heats: three at most), and a number below one is one heat', (() => { const five = { idx: 0, count: 5, list: Array.from({ length: 5 }, (_, i) => ({ name: 'Heat ' + (i + 1), drivers: [{ lane: 0, name: 'A' + i }] })) }, t = n => (N(five, 'ready', { howmany: n }).match(/class="nhw-b"/g) || []).length;
  return t('9') === 3 && t('4') === 3 && t('3') === 3 && t('2') === 2 && t('-2') === 1 && t('0') === 1 && t(2) === 2; })());
ok('the countdown of the break is with the next heat only (never with the heats after it), and a break of one second is shown, a fraction of a second is rounded', ((N(heat(0, { breakLeft: 90 }), 'between', { howmany: '3' }).match(/Starts in/g) || []).length === 1) && N(heat(0, { breakLeft: 90 }), 'between', { howmany: '3' }).split('Heat 2')[0].includes('Starts in') && N(heat(1, { breakLeft: 1 }), 'between').includes('Starts in 0:01') && N(heat(1, { breakLeft: 89.6 }), 'between').includes('Starts in 1:30') && N(heat(1, { breakLeft: 59.4 }), 'between').includes('Starts in 0:59'));
ok('a lane that is not chosen yet (-1) comes after the lanes that are, and the names of the heats are made safe too', text(N({ idx: 0, count: 1, list: [{ name: 'H<1>', drivers: [{ lane: -1, name: 'Zed' }, { lane: 0, name: 'Abe' }, { lane: -1, name: 'Yan' }] }] }, 'ready')) === '|Next: H&lt;1&gt; of 1|1: Abe|Zed|Yan|' && N({ idx: 0, count: 1, list: [{ name: 'H<1>', drivers: [] }] }, 'ready').includes('H&lt;1&gt;'));
ok('the note about lanes that are picked before the start is with the heat that is waiting for its lanes, and not while another heat races', (() => { const h = { idx: 3, count: 3, total: 4, picking: true, list: [...heat(0).list, { name: 'Final A', drivers: [{ lane: -1, name: 'Alex' }] }] };
  return N(h, 'between').includes('The lanes are picked') && !N(h, 'running').includes('The lanes are picked') && !N({ ...h, picking: false }, 'between').includes('The lanes are picked') && N({ ...h, idx: 2 }, 'running').includes('Final A') && !N({ ...h, idx: 2 }, 'running').includes('The lanes are picked'); })());
ok('the name of the heat, the lane numbers and the layout can be changed', text(N(heat(0), 'ready', { title: false })) === '|1: Alex|2: Sam|' && text(N(heat(0), 'ready', { lanes: false })) === '|Next: Heat 1 of 3|Alex|Sam|'
  && N(heat(0), 'ready', { layout: 'line' }).includes('<div class="nhw-d">1: Alex · 2: Sam</div>') && !N(heat(0), 'ready', { layout: 'line' }).includes('nhw-list') && N(heat(0), 'ready').includes('nhw-list'));
ok('a final whose lanes are not picked yet shows the names without lane numbers, and says so', (() => { const h = { idx: 3, count: 3, total: 4, picking: true, list: [...heat(0).list, { name: 'Final A', drivers: [{ lane: -1, name: 'Alex' }, { lane: -1, name: 'Sam' }] }] };
  return text(N(h, 'between')) === '|Next: Final A|Alex|Sam|The lanes are picked before the start|'; })());
ok('names are made safe', N({ idx: 0, count: 1, list: [{ name: 'H<1>', drivers: [{ lane: 0, name: '<b>x</b>' }] }] }, 'ready').includes('&lt;b&gt;x&lt;/b&gt;') && !N({ idx: 0, count: 1, list: [{ name: 'H<1>', drivers: [{ lane: 0, name: '<b>x</b>' }] }] }, 'ready').includes('<b>'));
ok('a race that is no heat race, or a heat race without heats, shows a dash', N(null, 'running') === '–' && N({ idx: 0, list: [] }, 'running') === '–' && N({ idx: 0 }, 'running') === '–' && N(undefined, 'ready') === '–');
ok('the sample on the layout page shows a heat with its drivers and the countdown of the break', (() => { const d = Wd.REGISTRY.find(x => x.type === 'nextheat'), s = d.sample(0, { opt: {} }); return s.includes('Next: Heat 2 of 3') && s.includes('Starts in 1:30') && d.sample(0, { opt: { howmany: '2' } }).includes('Heat 3 of 3'); })());

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(fails ? fails + ' RACE LIMIT TESTS FAILED' : 'ALL RACE LIMIT TESTS PASSED'); process.exit(fails ? 1 : 0);
