const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const Database = require('../db.js'), T = require('../transfer.js');
let fails = 0; const ok = (n, c) => { if (c) console.log('ok  ', n); else { console.log('FAIL', n); fails++; } };
const tmp = () => new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'));

const a = tmp();
const track = a.add('tracks', { name: 'Monza', lanes: 2 }), d1 = a.add('drivers', { name: 'Alex', custom: {} }), car = a.add('slotcars', { brand: 'NSR', model: 'GT40', lapsDriven: 2 });
const set = a.add('imagesets', { name: 'Fuel bar', kind: 'fuel', images: ['data:x'] });
const design = a.add('rowdesigns', { name: 'Board', widgets: [{ type: 'name', opt: { imageSet: set.id } }] });
const layout = a.add('layouts', { name: 'Main', widgets: [{ type: 'fuel', opt: { imageSet: set.id } }, { type: 'leaderboard', opt: { design: design.id } }] });
const audio = a.add('audiosets', { name: 'Voice' }), fuel = a.add('fuelrules', { name: 'Fuel 120' });
const setup = a.add('racesetups', { name: 'Friday', track: track.id, layout: layout.id, layout2: '', audioSet: audio.id, fuelRules: fuel.id, penaltySystem: '' });
const field = a.addCustomField('drivers', { label: 'Club', type: 'text' }); a.update('drivers', d1.id, { custom: { [field.id]: 'MSC' } });
const sid = a.saveSession({ setupName: 'Friday', trackId: track.id, date: '2026-10-01', standings: [{ driverId: d1.id, carId: car.id }] }, [{ driverId: d1.id, carId: car.id, trackId: track.id, time: 5000, lapNumber: 1 }]);

const b1 = T.collect(a.data, { racesetups: [setup.id] }, true);
ok('a race setup brings its track, layout, picture set, row design, audio set and fuel rule', ['racesetups', 'tracks', 'layouts', 'imagesets', 'rowdesigns', 'audiosets', 'fuelrules'].every(e => (b1.items[e] || []).length === 1) && !b1.items.drivers);
ok('without "include what it uses" only the item is taken', Object.keys(T.collect(a.data, { racesetups: [setup.id] }, false).items).join() === 'racesetups');
const b2 = T.collect(a.data, { sessions: [sid] }, false);
ok('a session always brings its laps, track, driver and car', b2.items.sessions.length === 1 && b2.items.laps.length === 1 && b2.items.tracks.length === 1 && b2.items.drivers.length === 1 && b2.items.slotcars.length === 1);
ok('custom field definitions travel with the rows that use them', b2.customFields.drivers.length === 1 && b2.customFields.drivers[0].label === 'Club');
ok('the check accepts our file and describes it', T.check(b1).ok && T.check(b1).summary.layouts.names[0] === 'Main');
ok('the check refuses other files', !T.check({}).ok && !T.check(null).ok && !T.check({ ...b1, format: 'x' }).ok && !T.check({ ...b1, fileVersion: 99 }).ok && !T.check({ format: T.FORMAT, fileVersion: 1, items: { tracks: [{ name: 'no id' }] } }).ok && !T.check({ format: T.FORMAT, fileVersion: 1, items: {} }).ok);

const dp = T.dependencies(a.data, { racesetups: [setup.id] });
ok('dependencies lists what a race setup uses, not itself, and not required by a session', ['tracks', 'layouts', 'imagesets', 'rowdesigns', 'audiosets', 'fuelrules'].every(e => dp[e] && dp[e].length === 1 && dp[e][0].required === false) && !dp.racesetups && !dp.laps);
const dp2 = T.dependencies(a.data, { sessions: [sid] });
ok('what a session needs is marked required', dp2.tracks[0].required && dp2.drivers[0].required && dp2.slotcars[0].required && !dp2.sessions);
ok('picking an item and leaving out some of its dependencies exports just those', (() => { const x = T.collect(a.data, { racesetups: [setup.id], imagesets: [set.id] }, false); return Object.keys(x.items).sort().join() === 'imagesets,racesetups'; })());
const b = tmp(); b.add('tracks', { name: 'Monza', lanes: 4 });
const counts = T.apply(b, JSON.parse(JSON.stringify(b1)));
ok('import adds the items as copies and reports counts', counts.racesetups === 1 && counts.layouts === 1 && b.data.layouts.length === 1);
ok('a clash of names gets (imported); the existing track is untouched', b.data.tracks.length === 2 && b.data.tracks.some(t => t.name === 'Monza (imported)') && b.data.tracks.find(t => t.name === 'Monza').lanes === 4);
const s2 = b.data.racesetups[0], l2 = b.data.layouts[0];
ok('imported items get new ids and keep their links', s2.id !== setup.id && s2.track === b.data.tracks.find(t => t.name === 'Monza (imported)').id && s2.layout === l2.id && s2.audioSet === b.data.audiosets[0].id && s2.fuelRules === b.data.fuelrules[0].id && s2.layout2 === '');
ok('links inside layouts follow (picture set and row design)', l2.widgets[0].opt.imageSet === b.data.imagesets[0].id && l2.widgets[1].opt.design === b.data.rowdesigns[0].id && b.data.rowdesigns[0].widgets[0].opt.imageSet === b.data.imagesets[0].id);
const before = JSON.stringify(a.data); T.collect(a.data, { racesetups: [setup.id] }); ok('exporting does not change the source', JSON.stringify(a.data) === before);

{ // a Start lights set with the picture grid travels in an export and a backup with every picture under its own key
  const x = tmp(), grid = { on: 'data:ON', off: 'data:OFF', yellow: 'data:Y', yellow_3: 'data:Y3', red_1: 'data:R1' };
  const gs = x.add('imagesets', { name: 'Gantry', kind: 'lights', images: grid }), gl = x.add('layouts', { name: 'Lights', widgets: [{ type: 'lights', opt: { imageSet: gs.id } }] });
  const out = JSON.parse(JSON.stringify(T.collect(x.data, { layouts: [gl.id] }, true))), y = tmp(); T.apply(y, out);
  ok('a lights grid set is exported with the layout that uses it and imported with every picture under its own key', y.data.imagesets.length === 1 && JSON.stringify(y.data.imagesets[0].images) === JSON.stringify(grid) && y.data.layouts[0].widgets[0].opt.imageSet === y.data.imagesets[0].id);
}
const c = tmp(); c.addCustomField('drivers', { label: 'Club', type: 'text' });
T.apply(c, JSON.parse(JSON.stringify(b2)));
ok('a session comes with its laps, linked to the imported driver, car and track', c.data.sessions.length === 1 && c.data.laps.length === 1 && c.data.laps[0].sessionId === c.data.sessions[0].id && c.data.laps[0].driverId === c.data.drivers[0].id && c.data.laps[0].carId === c.data.slotcars[0].id && c.data.sessions[0].standings[0].driverId === c.data.drivers[0].id && c.data.sessions[0].trackId === c.data.tracks[0].id);
ok('custom values go to the matching custom field (no duplicate field)', c.data.customFields.drivers.length === 1 && c.data.drivers[0].custom[c.data.customFields.drivers[0].id] === 'MSC');
const d = tmp(); const only = JSON.parse(JSON.stringify(T.collect(a.data, { racesetups: [setup.id] }, false))); T.apply(d, only);
ok('links to items that were not exported are emptied', d.data.racesetups[0].track === '' && d.data.racesetups[0].layout === '' && d.data.racesetups[0].audioSet === '');
ok('importing the same file twice makes two copies', (T.apply(d, JSON.parse(JSON.stringify(only))), d.data.racesetups.length === 2 && d.data.racesetups[1].name === 'Friday (imported)'));
const e = tmp(); T.apply(e, JSON.parse(JSON.stringify(b1))); const reread = new Database(e.file); ok('the import is saved to the file', reread.data.layouts.length === 1);
// a damaged file fails as a whole: nothing of it stays behind, in memory or in the file
{
  const f = tmp(); f.add('tracks', { name: 'Mine', lanes: 2 }); f.addCustomField('drivers', { label: 'Mine', type: 'text' });
  const before = JSON.stringify(f.data), onDisk = fs.readFileSync(f.file, 'utf8');
  const bad = { format: T.FORMAT, fileVersion: 1, customFields: { drivers: [{ id: 'q1', label: 'New field', type: 'text' }] }, items: { tracks: [{ id: 't1', name: 'Good track' }], drivers: [{ id: 'd1', name: 'Good driver', custom: { q1: 'x' } }], layouts: [{ id: 'l1', name: 'Broken', widgets: 'not a list' }] } };
  let msg = ''; try { T.apply(f, bad); } catch (x) { msg = x.message; }
  ok('a damaged file is refused with a clear message', /Nothing was imported/.test(msg));
  ok('...and nothing of it is left behind (items and custom fields)', JSON.stringify(f.data) === before);
  ok('...also not in the file', fs.readFileSync(f.file, 'utf8') === onDisk);
  ok('...and the same file without the broken item imports fine', (delete bad.items.layouts, T.apply(f, bad), f.data.tracks.length === 2 && f.data.drivers.length === 1 && f.data.customFields.drivers.length === 2));
  const g = tmp();
  ok('empty entries in the custom field list are skipped', (T.apply(g, { format: T.FORMAT, fileVersion: 1, customFields: { drivers: [null, 5] }, items: { drivers: [{ id: 'd1', name: 'A' }] } }), g.data.drivers.length === 1 && g.data.customFields.drivers.length === 0));
  const h = tmp(); h.save = () => { throw new Error('disk full'); };
  let m2 = ''; try { T.apply(h, { format: T.FORMAT, fileVersion: 1, items: { tracks: [{ id: 't', name: 'X' }] } }); } catch (x) { m2 = x.message; }
  ok('if saving fails the import is undone and the real reason is reported', m2 === 'disk full' && h.data.tracks.length === 0);
}
// the group of an extra field travels with it (0.75.0)
{ const src = tmp(), car2 = src.add('slotcars', { brand: 'Scalextric', model: 'Mini' });
  const g1 = src.addCustomField('slotcars', { label: 'Chassis', type: 'text', group: 'technical' }), g2 = src.addCustomField('slotcars', { label: 'Owner', type: 'text' });
  src.update('slotcars', car2.id, { custom: { [g1.id]: 'Plastic', [g2.id]: 'Dutch' } });
  const file = JSON.parse(JSON.stringify(T.collect(src.data, { slotcars: [car2.id] }, false)));
  ok('the export carries the group of the extra fields it uses', file.customFields.slotcars.find(x => x.label === 'Chassis').group === 'technical' && file.customFields.slotcars.find(x => x.label === 'Owner').group === '');
  const dst = tmp(); T.apply(dst, JSON.parse(JSON.stringify(file)));
  ok('...and the import creates the fields in that group (More stays More)', dst.data.customFields.slotcars.find(x => x.label === 'Chassis').group === 'technical' && dst.data.customFields.slotcars.find(x => x.label === 'Owner').group === '');
  const mine = tmp(); const own = mine.addCustomField('slotcars', { label: 'Chassis', type: 'text', group: 'pictures' }); T.apply(mine, JSON.parse(JSON.stringify(file)));
  ok('a field you already have keeps the group you gave it (no second field is made)', mine.data.customFields.slotcars.filter(x => x.label === 'Chassis').length === 1 && mine.data.customFields.slotcars.find(x => x.label === 'Chassis').group === 'pictures' && mine.data.slotcars[0].custom[own.id] === 'Plastic');
  const odd = JSON.parse(JSON.stringify(file)); odd.customFields.slotcars[0].group = 'a-group-of-a-newer-version'; odd.customFields.slotcars[1].group = 42;
  const o2 = tmp(); T.apply(o2, odd);
  ok('a group this version does not have, or that is not text, becomes More', o2.data.customFields.slotcars.every(x => x.group === ''));
  const older = JSON.parse(JSON.stringify(file)); older.customFields.slotcars.forEach(x => { delete x.group; });
  const o3 = tmp(); T.apply(o3, older);
  ok('a file made before groups existed imports into More', o3.data.customFields.slotcars.length === 2 && o3.data.customFields.slotcars.every(x => x.group === ''));
  const wrong = JSON.parse(JSON.stringify(file)); wrong.customFields.slotcars[0].group = 'length';
  const o4 = tmp(); T.apply(o4, wrong);
  ok('the group has to be a group of that kind of item (a track group does not work for slot cars)', o4.data.customFields.slotcars.find(x => x.label === 'Chassis').group === ''); }
{ // a Time Token stint of a Guest (no driver, no car) travels like any other session
  const g = tmp(), tr = g.add('tracks', { name: 'Club', lanes: 2 }), day = '2026-10-02';
  const gs = g.saveSession({ setupName: 'Club night', sessionType: 'tokens', trackId: tr.id, date: day, token: { stint: 1, lane: 1, bought: 600000, carried: 0, left: 1000 }, standings: [{ pos: 1, driverId: '', carId: '', driverName: 'Guest', carName: '', laps: 1, lateLaps: 1, best: 4000, lane: 1 }] },
    [{ driverId: '', carId: '', trackId: tr.id, token: true, stint: 1, lane: 1, lapNumber: 1, time: 4000, date: day }, { driverId: '', carId: '', trackId: tr.id, token: true, stint: 1, lane: 1, lapNumber: 2, time: 3900, date: day, late: true, invalid: true, noTrackRecord: true, noPersonalBest: true }]);
  const f = T.collect(g.data, { sessions: [gs] }, false);
  ok('a Guest stint exports with its track and laps, and asks for no driver or car', f.items.sessions.length === 1 && f.items.laps.length === 2 && f.items.tracks.length === 1 && !f.items.drivers && !f.items.slotcars && T.check(f).ok);
  const h = tmp(); T.apply(h, JSON.parse(JSON.stringify(f)));
  const hs = h.data.sessions[0], hl = h.data.laps.slice().sort((x, y) => x.lapNumber - y.lapNumber);
  ok('...it arrives as a token stint with its time bought, and its laps stay token laps of a Guest', h.data.sessions.length === 1 && hs.sessionType === 'tokens' && hs.token.bought === 600000 && hs.standings[0].driverName === 'Guest' && hl.length === 2 && hl.every(l => l.token === true && l.driverId === '' && l.sessionId === hs.id && l.trackId === h.data.tracks[0].id));
  ok('...the late lap is still late and out of the records', hl[1].late === true && hl[1].invalid === true && hl[1].noTrackRecord === true && hl[0].late === undefined); }
// ---------- 0.89.0: a sentence that is only for one driver ----------
{ const x = tmp(), kim = x.add('drivers', { name: 'Kim', custom: {} }), lee = x.add('drivers', { name: 'Lee', custom: {} });
  const voice = x.add('audiosets', { name: 'Conditions', calls: { newleader: { on: true, cooldown: 20, coolFor: 'driver', lines: [{ text: '{driver} leads', file: '' }, { text: 'Kim is back in front!', file: '', only: { driver: kim.id, top: 2 } }] }, winner: { on: true, lines: [{ text: 'Lee wins', file: '', only: { driver: lee.id } }, { text: 'Anyone wins', file: '' }] } } });
  const bundle = T.collect(x.data, { audiosets: [voice.id] }, true);
  ok('an audio set brings the drivers its sentences are for', (bundle.items.drivers || []).map(d => d.name).sort().join() === 'Kim,Lee');
  ok('...and not when the dependencies are left out', !T.collect(x.data, { audiosets: [voice.id] }, false).items.drivers);
  ok('...the list of what it uses names them', T.dependencies(x.data, { audiosets: [voice.id] }).drivers.length === 2);
  const y = tmp(); y.add('drivers', { name: 'Zed', custom: {} }); T.apply(y, JSON.parse(JSON.stringify(bundle)));
  const got = y.data.audiosets[0], ykim = y.data.drivers.find(d => d.name === 'Kim'), ylee = y.data.drivers.find(d => d.name === 'Lee');
  ok('after import the sentences are for the imported drivers (the links follow)', got.calls.newleader.lines[1].only.driver === ykim.id && got.calls.winner.lines[0].only.driver === ylee.id && ykim.id !== kim.id);
  ok('...the other conditions, the sentences without conditions and the wait come along unchanged', got.calls.newleader.lines[1].only.top === 2 && !('only' in got.calls.newleader.lines[0]) && got.calls.newleader.cooldown === 20 && got.calls.newleader.coolFor === 'driver' && !('only' in got.calls.winner.lines[1]));
  ok('...and the original is untouched', x.data.audiosets[0].calls.newleader.lines[1].only.driver === kim.id);
  const z = tmp(); T.apply(z, JSON.parse(JSON.stringify({ ...bundle, items: { audiosets: bundle.items.audiosets } })));
  ok('an export without the drivers still imports (the sentence stays "for a driver that is gone", so it is not said for everybody)', z.data.audiosets.length === 1 && z.data.audiosets[0].calls.winner.lines[0].only.driver === 'gone' && z.data.audiosets[0].calls.winner.lines[1].only === undefined);
}
{ // 1.4.0: a weather system travels with the race setup that uses it
  const x = tmp(), w = x.add('weathersystems', { name: 'Showers', startAt: 4 }), s = x.add('racesetups', { name: 'Wet', weather: w.id });
  const out = T.collect(x.data, { racesetups: [s.id] }, true), dpx = T.dependencies(x.data, { racesetups: [s.id] });
  ok('a race setup brings its weather system, and the dependencies list it', (out.items.weathersystems || []).length === 1 && out.items.weathersystems[0].name === 'Showers' && dpx.weathersystems && dpx.weathersystems.length === 1 && dpx.weathersystems[0].required === false);
  const y = tmp(); y.add('weathersystems', { name: 'Showers' }); T.apply(y, JSON.parse(JSON.stringify(out)));
  const imp = y.data.weathersystems.find(q => q.name === 'Showers (imported)'), st = y.data.racesetups[0];
  ok('...an import keeps the link (to the imported copy, with a new id), and the clash of names is marked', y.data.weathersystems.length === 2 && imp && imp.startAt === 4 && st.weather === imp.id && imp.id !== w.id);
  ok('...a weather system can also be exported on its own', (T.collect(x.data, { weathersystems: [w.id] }, false).items.weathersystems || []).length === 1); }
{ // 1.10.0: a damage system travels with the race setup that uses it
  const x = tmp(), d = x.add('damagesystems', { name: 'Club damage', stop: 'add', levels: [{ name: 'Light', from: 3, seconds: 10 }] }), s = x.add('racesetups', { name: 'Hard', damageSystem: d.id });
  const out = T.collect(x.data, { racesetups: [s.id] }, true), dpx = T.dependencies(x.data, { racesetups: [s.id] });
  ok('a race setup brings its damage system (with its levels), and the dependencies list it', (out.items.damagesystems || []).length === 1 && out.items.damagesystems[0].levels[0].seconds === 10 && dpx.damagesystems && dpx.damagesystems.length === 1 && dpx.damagesystems[0].required === false);
  const y = tmp(); y.add('damagesystems', { name: 'Club damage' }); T.apply(y, JSON.parse(JSON.stringify(out)));
  const imp = y.data.damagesystems.find(q => q.name === 'Club damage (imported)'), st = y.data.racesetups[0];
  ok('...an import keeps the link (to the imported copy, with a new id), and the clash of names is marked', y.data.damagesystems.length === 2 && imp && imp.stop === 'add' && imp.levels.length === 1 && st.damageSystem === imp.id && imp.id !== d.id);
  ok('...a damage system can also be exported on its own', (T.collect(x.data, { damagesystems: [d.id] }, false).items.damagesystems || []).length === 1); }
{ // 1.6.0: a rotation setup travels with the race setup that uses it
  const x = tmp(), r = x.add('rotationsetups', { name: 'Club night', participants: 4, lanes: 2, names: ['Piet'], heats: [{ label: 'A', locked: false, places: [{ p: 0, lane: 0 }] }] }), s = x.add('racesetups', { name: 'Heats', sessionType: 'heats', rotation: r.id });
  const out = T.collect(x.data, { racesetups: [s.id] }, true), dpx = T.dependencies(x.data, { racesetups: [s.id] });
  ok('a race setup brings its rotation setup, and the dependencies list it', (out.items.rotationsetups || []).length === 1 && out.items.rotationsetups[0].names[0] === 'Piet' && dpx.rotationsetups && dpx.rotationsetups.length === 1 && dpx.rotationsetups[0].required === false);
  ok('...without its dependencies the race setup comes alone', !(T.collect(x.data, { racesetups: [s.id] }, false).items.rotationsetups));
  const y = tmp(); y.add('rotationsetups', { name: 'Club night' }); T.apply(y, JSON.parse(JSON.stringify(out)));
  const imp = y.data.rotationsetups.find(q => q.name === 'Club night (imported)'), st = y.data.racesetups[0];
  ok('...an import keeps the link (to the imported copy, with a new id), the heats come along and the clash of names is marked', y.data.rotationsetups.length === 2 && imp && imp.heats[0].label === 'A' && imp.lanes === 2 && st.rotation === imp.id && imp.id !== r.id);
  const z = tmp(); T.apply(z, JSON.parse(JSON.stringify({ ...out, items: { racesetups: out.items.racesetups } })));
  ok('...a race setup imported without its rotation has no rotation (the plan is made from its own settings)', z.data.racesetups[0].rotation === '');
  ok('...a rotation setup can also be exported on its own, and is checked in the file', (T.collect(x.data, { rotationsetups: [r.id] }, false).items.rotationsetups || []).length === 1 && T.check(JSON.parse(JSON.stringify(T.collect(x.data, { rotationsetups: [r.id] }, false)))).ok === true && T.check(JSON.parse(JSON.stringify(T.collect(x.data, { rotationsetups: [r.id] }, false)))).summary.rotationsetups.count === 1); }
if (fails) { console.log(fails + ' TRANSFER TESTS FAILED'); process.exit(1); } console.log('transfer: all PASSED');
