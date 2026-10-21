// The database file: older race setups with inline fuel settings become fuel rules.
const fs = require('fs'), os = require('os'), path = require('path');
const Database = require('../db.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json');
fs.writeFileSync(file, JSON.stringify({ racesetups: [
  { id: 's1', name: 'Fuel race', fuel: 'on', fuelTank: 80, fuelPerLap: 3, fuelEmpty: 'stop', fuelRate: 5 }, { id: 's2', name: 'No fuel', fuel: 'off', fuelTank: 120 } ] }));
let db = new Database(file);
const [a, b] = db.list('racesetups'), rules = db.list('fuelrules');
ok('a setup with fuel on gets a fuel rule with its values', rules.length === 1 && a.fuelRules === rules[0].id && rules[0].tank === 80 && rules[0].perLap === 3 && rules[0].empty === 'stop' && rules[0].rate === 5 && rules[0].maxExtra === 25 && rules[0].maxSaving === 30);
ok('the old inline fuel settings are gone, other setups get no rule', !('fuel' in a) && !('fuelTank' in a) && !b.fuelRules && !('fuel' in b));
db = new Database(file);
ok('opening the file again does not make another rule', db.list('fuelrules').length === 1);
db.remove('fuelrules', rules[0].id);
ok('deleting a fuel rule clears it from the setups', db.list('racesetups')[0].fuelRules === '');
db.add('penaltysystems', { name: 'P' }); db.remove('penaltysystems', db.list('penaltysystems')[0].id);
ok('penalty systems can be added and removed', db.list('penaltysystems').length === 0);
{ const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slt-dmg-')), f = path.join(dir, 'db.json');
  fs.writeFileSync(f, '{"drivers":[{"id":"a","name":"Alex"}'); // cut off in the middle
  const d = new Database(f), kept = fs.readdirSync(dir).filter(n => n.includes('damaged'));
  ok('a damaged database file is kept under another name instead of being overwritten', d.list('drivers').length === 0 && kept.length === 1 && fs.readFileSync(path.join(dir, kept[0]), 'utf8').includes('Alex'));
  fs.writeFileSync(f, '[1,2]'); const d2 = new Database(f);
  ok('a file that holds something else than a database is treated the same way', d2.list('tracks').length === 0 && fs.readdirSync(dir).filter(n => n.includes('damaged')).length >= 1);
  const f3 = path.join(dir, 'new.json'); new Database(f3);
  ok('a missing file just starts a fresh database, nothing is kept', fs.existsSync(f3) && fs.readdirSync(dir).filter(n => n.startsWith('new') && n.includes('damaged')).length === 0); }
// 1.39.1: a database that is there but cannot be read is never replaced by an empty one
{ const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slt-unr-')), f = path.join(dir, 'db.json');
  fs.mkdirSync(f); // (reading it fails with EISDIR, as a locked or unreadable file fails with EBUSY or EACCES)
  let err = null; try { new Database(f); } catch (x) { err = x; }
  ok('a database file that cannot be read stops the start instead of beginning with an empty one', err && /cannot be read/.test(err.message) && fs.statSync(f).isDirectory());
  const f2 = path.join(dir, 'bad.json'); fs.writeFileSync(f2, '{"drivers":[');
  const realCopy = fs.copyFileSync; fs.copyFileSync = () => { throw Object.assign(new Error('no space'), { code: 'ENOSPC' }); };
  let err2 = null; try { new Database(f2); } catch (x) { err2 = x; } finally { fs.copyFileSync = realCopy; }
  ok('a damaged file that cannot be kept is not overwritten either', err2 && /damaged/.test(err2.message) && fs.readFileSync(f2, 'utf8') === '{"drivers":[');
}
// 1.39.1: a failed save of a finished race leaves nothing half done (saving it again must not make two copies)
{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-fail-')), 'db.json'), d = new Database(f);
  const car = d.add('slotcars', { name: 'Red' });
  const lap = { carId: car.id, driverId: 'x', lapNo: 1, time: 5000 }, real = d.save;
  d.save = () => { throw new Error('disk full'); };
  let err = null; try { d.saveSession({ date: '2026-10-18', standings: [] }, [lap, { ...lap, lapNo: 2 }]); } catch (x) { err = x; }
  d.save = real;
  ok('when the disk refuses the session it is taken out again and the error reaches the caller', err && err.message === 'disk full' && d.list('sessions').length === 0 && d.data.laps.length === 0);
  ok('...and the lap counter of the car is as before', !d.list('slotcars')[0].lapsDriven);
  d.saveSession({ date: '2026-10-18', standings: [] }, [lap, { ...lap, lapNo: 2 }]);
  ok('...so a second try gives one session and two laps', d.list('sessions').length === 1 && d.data.laps.length === 2 && d.list('slotcars')[0].lapsDriven === 2);
  ok('a save leaves no temporary file behind', !fs.existsSync(f + '.tmp') && JSON.parse(fs.readFileSync(f, 'utf8')).sessions.length === 1);
}
// 1.39.1: a session saved without its standings does not stop a driver or a car from being deleted
{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-nost-')), 'db.json'), d = new Database(f);
  const dr = d.add('drivers', { name: 'A' }), car = d.add('slotcars', { name: 'R' });
  d.data.sessions.push({ id: 's1', date: '2026-01-01' });
  let err = null; try { d.remove('drivers', dr.id); d.remove('slotcars', car.id); } catch (x) { err = x; }
  ok('deleting a driver or a car works when an old session has no standings', !err && d.list('drivers').length === 0 && d.list('slotcars').length === 0);
}
// extra fields and the group of the form they are shown in (0.75.0)
{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-grp-')), 'db.json'), d = new Database(f);
  const tech = d.addCustomField('slotcars', { label: 'Chassis', type: 'text', group: 'technical' }), plain = d.addCustomField('slotcars', { label: 'Owner', type: 'text' });
  ok('an extra field is stored with the group it was given', tech.group === 'technical' && d.listCustomFields('slotcars')[0].group === 'technical');
  ok('without a group it goes to More (an empty group)', plain.group === '' && d.listCustomFields('slotcars')[1].group === '');
  ok('a group that the form does not have, or that is not text, becomes More', ['nonsense', '_more', 5, null, undefined, {}].every((g, i) => d.addCustomField('slotcars', { label: 'X' + i, type: 'text', group: g }).group === '') && d.addCustomField('slotcars', { label: 'Other', type: 'text', group: 'length' }).group === '');
  ok('each form has its own groups ("length" is a group of tracks, not of slot cars)', d.addCustomField('tracks', { label: 'Banking', type: 'text', group: 'length' }).group === 'length' && d.addCustomField('drivers', { label: 'Club', type: 'text', group: 'personal' }).group === 'personal');
  const moved = d.setCustomFieldGroup('slotcars', plain.id, 'pictures');
  ok('the group of a field can be changed, and the field comes back from the list that way', moved.group === 'pictures' && d.listCustomFields('slotcars').find(x => x.id === plain.id).group === 'pictures' && d.listCustomFields('slotcars').find(x => x.id === plain.id).label === 'Owner');
  d.setCustomFieldGroup('slotcars', plain.id, '');
  ok('...back to More with an empty group', d.listCustomFields('slotcars').find(x => x.id === plain.id).group === '');
  d.setCustomFieldGroup('slotcars', tech.id, 'zzz');
  ok('...a group that is not known is More again', d.listCustomFields('slotcars').find(x => x.id === tech.id).group === '');
  const snap = JSON.stringify(d.listCustomFields('slotcars')); let err = ''; try { d.setCustomFieldGroup('slotcars', 'nope', 'basics'); } catch (x) { err = x.message; }
  ok('an unknown field cannot be moved, and nothing else changes', err === 'Unknown extra field' && JSON.stringify(d.listCustomFields('slotcars')) === snap);
  let err2 = ''; try { d.setCustomFieldGroup('nothing', tech.id, 'basics'); } catch (x) { err2 = x.message; }
  ok('an unknown kind of item is refused', /Unknown item type/.test(err2));
  d.setCustomFieldGroup('slotcars', tech.id, 'pictures');
  ok('a group that was changed is saved in the file by itself', new Database(f).listCustomFields('slotcars').find(x => x.id === tech.id).group === 'pictures');
  d.addCustomField('drivers', { label: 'Second', type: 'text', group: 'avatar' });
  const again = new Database(f);
  ok('a new field is saved in the file with its group', again.listCustomFields('drivers').map(x => x.group).join() === 'personal,avatar');
  const old = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-old-')), 'db.json');
  fs.writeFileSync(old, JSON.stringify({ customFields: { slotcars: [{ id: 'a1', label: 'Old field', type: 'text', options: [] }] } }));
  const o = new Database(old);
  ok('a field saved before groups existed has no group: it is shown in More, and it can be moved', o.listCustomFields('slotcars')[0].group === undefined && o.setCustomFieldGroup('slotcars', 'a1', 'technical').group === 'technical'); }
{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'), w = new Database(f);
  const sys = w.add('weathersystems', { name: 'Showers' }), setup = w.add('racesetups', { name: 'Wet race', weather: sys.id }), other = w.add('racesetups', { name: 'Dry race' });
  ok('weather systems can be added, and are kept in the file', w.list('weathersystems').length === 1 && new Database(f).list('weathersystems')[0].name === 'Showers');
  w.remove('weathersystems', sys.id);
  ok('deleting a weather system clears it from the setups (and leaves the others alone)', w.list('weathersystems').length === 0 && w.list('racesetups').find(r => r.id === setup.id).weather === '' && w.list('racesetups').find(r => r.id === other.id).weather === undefined); }
{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'), w = new Database(f); // 1.40.0: tyre wear systems
  const sys = w.add('tyrewearsystems', { name: 'Club tyres', tyres: { S: { wear: 6 } } }), setup = w.add('racesetups', { name: 'Tyre race', tyreWear: sys.id, weather: 'w1' }), other = w.add('racesetups', { name: 'Dry race' });
  ok('tyre wear systems can be added, and are kept in the file with their tyre table', w.list('tyrewearsystems').length === 1 && new Database(f).list('tyrewearsystems')[0].tyres.S.wear === 6);
  w.remove('tyrewearsystems', sys.id);
  ok('deleting a tyre wear system clears it from the setups (and leaves the other settings and setups alone)', w.list('tyrewearsystems').length === 0 && w.list('racesetups').find(r => r.id === setup.id).tyreWear === '' && w.list('racesetups').find(r => r.id === setup.id).weather === 'w1' && w.list('racesetups').find(r => r.id === other.id).tyreWear === undefined); }
{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'), w = new Database(f); // 1.10.0: damage systems
  const sys = w.add('damagesystems', { name: 'Club damage', levels: [{ name: 'Light', from: 3 }] }), setup = w.add('racesetups', { name: 'Hard race', damageSystem: sys.id }), other = w.add('racesetups', { name: 'Easy race' });
  ok('damage systems can be added, and are kept in the file with their levels', w.list('damagesystems').length === 1 && new Database(f).list('damagesystems')[0].levels[0].from === 3 && Array.isArray(new Database(f).list('damagesystems')[0].levels));
  w.remove('damagesystems', sys.id);
  ok('deleting a damage system clears it from the setups (and leaves the others alone)', w.list('damagesystems').length === 0 && w.list('racesetups').find(r => r.id === setup.id).damageSystem === '' && w.list('racesetups').find(r => r.id === other.id).damageSystem === undefined); }
{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'), w = new Database(f); // 1.6.0: rotation setups
  const rot = w.add('rotationsetups', { name: 'Club night', participants: 8, lanes: 4, heats: [] }), setup = w.add('racesetups', { name: 'Heats', sessionType: 'heats', rotation: rot.id }), other = w.add('racesetups', { name: 'Other', rotation: 'x' });
  ok('rotation setups can be added, and are kept in the file', w.list('rotationsetups').length === 1 && new Database(f).list('rotationsetups')[0].name === 'Club night' && new Database(f).list('rotationsetups')[0].participants === 8);
  w.update('rotationsetups', rot.id, { name: 'Friday' }); ok('...and changed', new Database(f).list('rotationsetups')[0].name === 'Friday');
  w.remove('rotationsetups', rot.id);
  ok('deleting a rotation setup clears it from the race setups that use it (and leaves the others alone)', w.list('rotationsetups').length === 0 && w.list('racesetups').find(r => r.id === setup.id).rotation === '' && w.list('racesetups').find(r => r.id === other.id).rotation === 'x'); }
// 1.30.0: the statistics of a slotcar: Laps Driven and Laps Since Last Interval are counted when a session is saved, and follow when laps are removed
{ const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-svc-')), 'db.json');
  fs.writeFileSync(f, JSON.stringify({ slotcars: [{ id: 'old', brand: 'Old', lapsDriven: 40 }, { id: 'new0', brand: 'Fresh' }, { id: 'kept', brand: 'Kept', lapsDriven: 40, lapsSinceService: 7 }] }));
  let w = new Database(f); const car = id => w.list('slotcars').find(c => c.id === id);
  ok('a car from before 1.30.0 has had no service yet: the laps since the last one are all of its laps (and a car with a count keeps it)', car('old').lapsSinceService === 40 && car('new0').lapsSinceService === 0 && car('kept').lapsSinceService === 7);
  ok('...it is saved in the file by itself', new Database(f).list('slotcars').find(c => c.id === 'old').lapsSinceService === 40);
  const lap = (carId, date) => ({ carId, time: 5, date });
  w.saveSession({ date: '2026-02-01T10:00:00.000Z' }, [lap('old', '2026-02-01T10:00:00.000Z'), lap('old', '2026-02-01T10:00:00.000Z'), lap('new0', '2026-02-01T10:00:00.000Z'), lap('', '2026-02-01T10:00:00.000Z'), lap('gone', '2026-02-01T10:00:00.000Z')]);
  ok('a saved session adds its laps to Laps Driven and to the laps since the last service', car('old').lapsDriven === 42 && car('old').lapsSinceService === 42 && car('new0').lapsDriven === 1 && car('new0').lapsSinceService === 1 && car('kept').lapsSinceService === 7);
  // the car is serviced (what the form does when Reset is pressed and the form is saved)
  w.update('slotcars', 'old', { lapsSinceService: 0, serviceDate: '2026-03-01T12:00:00.000Z' });
  ok('after a service the count is 0 and Laps Driven is as it was', car('old').lapsSinceService === 0 && car('old').lapsDriven === 42 && car('old').serviceDate === '2026-03-01T12:00:00.000Z');
  w.saveSession({ date: '2026-03-02T10:00:00.000Z' }, [lap('old', '2026-03-02T10:00:00.000Z'), lap('old', '2026-03-02T10:00:00.000Z'), lap('old', '2026-03-02T10:00:00.000Z')]);
  ok('the laps of the next session count from 0 again', car('old').lapsDriven === 45 && car('old').lapsSinceService === 3);
  w.saveSession({ date: '2026-02-20T10:00:00.000Z' }, [lap('old', undefined)]);
  ok('a lap saved with the date of its session: a session from before the service does not count for the laps since (it counts for Laps Driven)', car('old').lapsDriven === 46 && car('old').lapsSinceService === 3);
  w.saveSession({ date: '2026-03-05T10:00:00.000Z' }, [lap('old', undefined)]);
  ok('...and one from after it does', car('old').lapsDriven === 47 && car('old').lapsSinceService === 4);
  // removing laps: the counts follow, but a lap from before the service was never in the laps since
  const dateOfSession = new Map(w.data.sessions.map(s => [s.id, s.date])), when = l => l.date || dateOfSession.get(l.sessionId);
  ok('the laps are in the file (three from before the service, one of them without a date of its own, and four after it)', w.data.laps.filter(l => l.carId === 'old' && when(l) < '2026-03-01').length === 3 && w.data.laps.filter(l => l.carId === 'old' && when(l) > '2026-03-01').length === 4);
  w.removeLapsWhere(l => l.carId === 'old' && when(l) < '2026-03-01');
  ok('removing laps from before the service lowers Laps Driven, not the laps since the last service (a lap without a date has the date of its session)', car('old').lapsDriven === 44 && car('old').lapsSinceService === 4);
  w.removeLapsWhere(l => l.carId === 'old' && l.date === '2026-03-02T10:00:00.000Z');
  ok('removing laps from after it lowers both', car('old').lapsDriven === 41 && car('old').lapsSinceService === 1);
  w.removeLapsWhere(l => l.carId === 'old');
  ok('...to the 40 laps it had driven before they were counted, and the laps since the last service back to 0', car('old').lapsDriven === 40 && car('old').lapsSinceService === 0);
  w.update('slotcars', 'old', { lapsDriven: 0 }); w.data.laps.push({ id: 'x1', carId: 'old', time: 5, date: '2026-05-01T00:00:00Z' }); w.removeLapsWhere(l => l.id === 'x1');
  ok('...and neither goes below 0', car('old').lapsDriven === 0 && car('old').lapsSinceService === 0);
  w.removeLapsWhere(l => l.carId === 'new0');
  ok('a car that was never serviced loses laps from both counts', car('new0').lapsDriven === 0 && car('new0').lapsSinceService === 0);
  const bare = w.add('slotcars', { brand: 'Bare', lapsDriven: 10 }); // (a car that was added without the count, for example from an older backup)
  w.saveSession({ date: '2026-04-01T10:00:00.000Z' }, [lap(bare.id, '2026-04-01T10:00:00.000Z')]);
  ok('a car without a count of its own starts it from all the laps it had driven when a session is saved (10 + 1)', car(bare.id).lapsDriven === 11 && car(bare.id).lapsSinceService === 11);
  const added = w.add('slotcars', { brand: 'Added', lapsDriven: 0, lapsSinceService: 0 });
  w.saveSession({ date: '2026-04-01T10:00:00.000Z' }, [{ carId: added.id, time: 5 }]);
  ok('a lap without a date counts for the laps since the last service of a car that was never serviced', car(added.id).lapsSinceService === 1);
  w.saveSession({ date: '2026-04-01T10:00:00.000Z' }, [{ carId: 'kept', time: 5, date: '2026-04-01T10:00:00.000Z' }]);
  ok('the service interval is kept by the database like any other setting', (w.update('slotcars', 'kept', { serviceInterval: 300 }), new Database(f).list('slotcars').find(c => c.id === 'kept').serviceInterval === 300) && car('kept').lapsSinceService === 8);
  w.removeSession(w.data.sessions[w.data.sessions.length - 1].id);
  ok('removing a session takes its laps out of the counts', car('kept').lapsSinceService === 7 && car('kept').lapsDriven === 40);
  // 1.51.0: Laps Driven can be set by hand (an old car that has driven laps already): the count goes on from that number, and the laps since the last service are not touched
  w.update('slotcars', 'kept', { lapsDriven: 5000 });
  ok('1.51.0: a number typed in Laps Driven is kept in the file, and the laps since the last service stay as they were', new Database(f).list('slotcars').find(c => c.id === 'kept').lapsDriven === 5000 && car('kept').lapsSinceService === 7);
  w.saveSession({ date: '2026-05-01T10:00:00.000Z' }, [lap('kept', '2026-05-01T10:00:00.000Z'), lap('kept', '2026-05-01T10:00:00.000Z')]);
  ok('1.51.0: the next laps count on from it (5000 + 2), and the laps since the last service count too (7 + 2)', car('kept').lapsDriven === 5002 && car('kept').lapsSinceService === 9);
  w.removeSession(w.data.sessions[w.data.sessions.length - 1].id);
  ok('1.51.0: removing that session takes the two laps off again (5000), as before', car('kept').lapsDriven === 5000 && car('kept').lapsSinceService === 7);
}
// 1.61.0: the settings are kept in a file of their own ('name.settings.json' next to 'name.json') and written in the background
const tmpDb = (name = 'db.json', text) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slt-set-')), f = path.join(dir, name); if (text !== undefined) fs.writeFileSync(f, typeof text === 'string' ? text : JSON.stringify(text)); return { dir, f, sf: path.join(dir, name.replace(/\.json$/, '') + '.settings.json') }; };
const read = f => fs.readFileSync(f, 'utf8'), readJ = f => JSON.parse(read(f)), leftovers = dir => fs.readdirSync(dir).filter(n => n.endsWith('.tmp'));
{ // the first start of this version: the settings of the database file are used, and the settings file is made
  const t = tmpDb('db.json', { settings: { theme: 'light', rules: 'Be kind.', liveGrid: { a: 1 } }, drivers: [{ id: 'd1', name: 'Alex' }] });
  const d = new Database(t.f);
  ok('1.61.0: with no settings file the settings of the database file are used, and the settings file is made at once', d.getSettings().theme === 'light' && d.getSettings().rules === 'Be kind.' && fs.existsSync(t.sf) && readJ(t.sf).rules === 'Be kind.' && readJ(t.sf).liveGrid.a === 1);
  ok('...the file is named after the database (name.settings.json), and no temporary file is left', path.basename(t.sf) === 'db.settings.json' && Database.settingsFileOf('/x/slotforge-timing.json') === '/x/slotforge-timing.settings.json' && leftovers(t.dir).length === 0);
  ok('...the database file keeps the settings too (a complete copy, for an older version)', readJ(t.f).settings.rules === 'Be kind.' && readJ(t.f).drivers[0].name === 'Alex');
}
{ // the next start: the settings file is as it should be, so it is not written again
  const t = tmpDb('db.json', { settings: { theme: 'light' } }); new Database(t.f);
  const realOpen = fs.openSync, opened = []; fs.openSync = function (p, fl, ...r) { opened.push([String(p), fl]); return realOpen.call(this, p, fl, ...r); };
  let d; try { d = new Database(t.f); } finally { fs.openSync = realOpen; }
  ok('1.61.0: a start with a settings file that holds just what the settings are does not write it again (the database file is written, as before)', d.getSettings().theme === 'light' && !opened.some(o => o[0].startsWith(t.sf) && o[1] !== 'r') && opened.some(o => o[0].startsWith(t.f) && o[1] !== 'r'));
}
{ // the settings file wins
  const t = tmpDb('db.json', { settings: { theme: 'light', old: 1 }, drivers: [] }); fs.writeFileSync(t.sf, JSON.stringify({ theme: 'dark', newer: 2 }));
  const d = new Database(t.f);
  ok('1.61.0: when there is a settings file it holds the settings: those of the database file are not mixed in', d.getSettings().theme === 'dark' && d.getSettings().newer === 2 && d.getSettings().old === undefined);
  const t2 = tmpDb('db.json', { drivers: [] }); fs.writeFileSync(t2.sf, '{"rules":"x"}');
  const d2 = new Database(t2.f);
  ok('...a setting the file does not have gets its default (theme dark), and the file is made complete', d2.getSettings().theme === 'dark' && d2.getSettings().rules === 'x' && readJ(t2.sf).theme === 'dark');
}
{ // a settings file that cannot be understood is kept under another name, as for the database
  const t = tmpDb('db.json', { settings: { theme: 'light', rules: 'From the database.' } }); fs.writeFileSync(t.sf, '{"theme":"da');
  const d = new Database(t.f), kept = fs.readdirSync(t.dir).filter(n => n.includes('settings.damaged-'));
  ok('1.61.0: a damaged settings file is kept under another name, the settings of the database file are used, and a good settings file is made', d.getSettings().rules === 'From the database.' && kept.length === 1 && read(path.join(t.dir, kept[0])) === '{"theme":"da' && readJ(t.sf).rules === 'From the database.');
  const t2 = tmpDb('db.json', { settings: { theme: 'light' } }); fs.writeFileSync(t2.sf, '[1,2]');
  const d2 = new Database(t2.f);
  ok('...a file that holds something else than settings is treated the same way', d2.getSettings().theme === 'light' && fs.readdirSync(t2.dir).filter(n => n.includes('settings.damaged-')).length === 1 && !Array.isArray(readJ(t2.sf)));
  const t3 = tmpDb('db.json', { settings: { theme: 'light' } }); fs.mkdirSync(t3.sf);
  let err = null; try { new Database(t3.f); } catch (x) { err = x; }
  ok('...a settings file that is there but cannot be read stops the start (nothing is changed)', err && /settings file cannot be read/.test(err.message) && fs.statSync(t3.sf).isDirectory());
  const t4 = tmpDb('db.json', { settings: { theme: 'light' } }); fs.writeFileSync(t4.sf, '{"theme"');
  const realCopy = fs.copyFileSync; fs.copyFileSync = () => { throw Object.assign(new Error('no space'), { code: 'ENOSPC' }); };
  let err2 = null; try { new Database(t4.f); } catch (x) { err2 = x; } finally { fs.copyFileSync = realCopy; }
  ok('...one that is damaged and cannot be kept is not overwritten', err2 && /settings file is damaged/.test(err2.message) && read(t4.sf) === '{"theme"');
}
{ // a change is written to the settings file only
  const t = tmpDb('db.json', { drivers: [{ id: 'd1', name: 'Alex' }] }), d = new Database(t.f), before = read(t.f);
  const realStringify = JSON.stringify; let whole = 0; JSON.stringify = function (v, ...r) { if (v === d.data) whole++; return realStringify.call(this, v, ...r); };
  const realOpen = fs.openSync, opened = []; fs.openSync = function (p, ...r) { opened.push(String(p)); return realOpen.call(this, p, ...r); };
  let got; try { got = d.setSettings({ theme: 'light', uiScale: 1.25 }); } finally { JSON.stringify = realStringify; fs.openSync = realOpen; }
  ok('1.61.0: setSettings changes the settings at once and writes the settings file before it returns', got === d.getSettings() && got.theme === 'light' && readJ(t.sf).theme === 'light' && readJ(t.sf).uiScale === 1.25);
  ok('...it does not turn the whole database into text and does not touch the database file', whole === 0 && read(t.f) === before && !opened.some(p => p.startsWith(t.f)) && opened.some(p => p.startsWith(t.sf)));
  ok('...and nothing is left behind, and the next start has the settings', leftovers(t.dir).length === 0 && new Database(t.f).getSettings().uiScale === 1.25);
}
const asyncTests = async () => {
  { const t = tmpDb('db.json', { drivers: [{ id: 'd1', name: 'Alex' }] }), d = new Database(t.f), before = read(t.f);
    const realStringify = JSON.stringify; let whole = 0; JSON.stringify = function (v, ...r) { if (v === d.data) whole++; return realStringify.call(this, v, ...r); };
    let p; try { p = d.setSettingsAsync({ depth: 55 }); } finally { JSON.stringify = realStringify; }
    ok('1.61.0: setSettingsAsync changes the settings in memory at once, and the write is on its way (the program does not wait for the disk)', d.getSettings().depth === 55 && d.writesPending() === true && !fs.existsSync(t.sf + '.never') && whole === 0);
    const s = await p;
    ok('...the answer is the settings, given when the file is written; the database file is not touched', s === d.getSettings() && readJ(t.sf).depth === 55 && read(t.f) === before && d.writesPending() === false && leftovers(t.dir).length === 0);
    const w0 = d.dbStats().settings.writes; await d.setSettingsAsync({ depth: 55 });
    ok('...a setting set to the value it has is not written again', d.dbStats().settings.writes === w0 && readJ(t.sf).depth === 55);
  }
  { // several changes at once: written one at a time, the newest text wins, everybody is answered
    const t = tmpDb('db.json', {}), d = new Database(t.f), order = [];
    const ps = [1, 2, 3, 4, 5].map(i => d.setSettingsAsync({ n: i, ['k' + i]: i }).then(() => order.push(i)));
    await Promise.all(ps);
    ok('1.61.0: five changes in a row are all answered, in the order they were asked, and the file holds all of them with the last value', order.join() === '1,2,3,4,5' && readJ(t.sf).n === 5 && [1, 2, 3, 4, 5].every(i => readJ(t.sf)['k' + i] === i));
    ok('...and they were not five writes (what waited while one was on its way was put together)', d.dbStats().settings.writes <= 2, JSON.stringify(d.dbStats().settings));
    const d2 = new Database(t.f);
    ok('...the next start has the last state', d2.getSettings().n === 5 && d2.getSettings().k3 === 3);
  }
  { // a write that fails: everyone who waited for it is told, the settings in memory stay, and the next write is done (with everything)
    const t = tmpDb('db.json', {}), d = new Database(t.f), realOpen = fs.promises.open;
    fs.promises.open = async () => { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); };
    const r = [d.setSettingsAsync({ a: 1 }), d.setSettingsAsync({ b: 2 })].map(p => p.then(() => 'ok', x => x.message));
    let res; try { res = await Promise.all(r); } finally { fs.promises.open = realOpen; }
    ok('1.61.0: when the disk refuses, the callers are told why (the ones that waited together too), and the settings in memory are as asked', res[0] === 'disk full' && res[1] === 'disk full' && d.getSettings().a === 1 && d.getSettings().b === 2 && d.dbStats().settings.failed >= 1 && !d.writesPending());
    ok('...nothing half is left, and the file is as it was', leftovers(t.dir).length === 0 && readJ(t.sf).a === undefined);
    await d.setSettingsAsync({ c: 3 });
    ok('...the next change writes everything that was asked for since', readJ(t.sf).a === 1 && readJ(t.sf).b === 2 && readJ(t.sf).c === 3);
  }
  { // asking again for the text that is in the file, while a newer one is on its way, is not answered early
    const t = tmpDb('db.json', {}), d = new Database(t.f);
    await d.setSettingsAsync({ z: 1 });
    const p2 = d.setSettingsAsync({ z: 2 }), p3 = d.setSettingsAsync({ z: 1 });
    await Promise.all([p2, p3]);
    ok('1.61.0: a setting put back to the value the file has, while a write of another value is on its way, is written after it (the file ends with what was asked last)', readJ(t.sf).z === 1 && d.getSettings().z === 1 && new Database(t.f).getSettings().z === 1);
  }
  { // the sync version while a background write is on its way: after it, so the file ends with the newest
    const t = tmpDb('db.json', {}), d = new Database(t.f);
    const p = d.setSettingsAsync({ v: 1 }); d.setSettings({ v: 2 }); d.setSettings({ v: 3 });
    await p; await d.writesIdle();
    ok('1.61.0: a synchronous change made while a background write is on its way is written after it (the file ends with the newest value)', readJ(t.sf).v === 3 && d.getSettings().v === 3 && leftovers(t.dir).length === 0);
  }
  { // a restore replaces the settings file too, and a full save keeps the database file complete
    const t = tmpDb('db.json', {}), d = new Database(t.f); d.setSettings({ rules: 'old', keep: 1 });
    d.replaceAll({ settings: { theme: 'light', rules: 'restored' }, drivers: [{ id: 'x', name: 'Back' }] });
    ok('1.61.0: restoring a backup writes the settings of the backup to the settings file (the old settings file would otherwise win at the next start)', readJ(t.sf).rules === 'restored' && readJ(t.sf).keep === undefined && new Database(t.f).getSettings().rules === 'restored' && new Database(t.f).list('drivers')[0].name === 'Back');
    d.setSettings({ liveGrid: { z: 1 } }); d.add('drivers', { name: 'New' });
    ok('...a full save writes the settings as they are into the database file too', readJ(t.f).settings.liveGrid.z === 1 && readJ(t.f).drivers.length === 2);
    const t2 = tmpDb('db.json', {}), d2 = new Database(t2.f), realSave = d2.save; d2.save = () => { throw new Error('disk full'); };
    let e = null; try { d2.replaceAll({ settings: { rules: 'x' } }); } catch (x) { e = x; } d2.save = realSave;
    ok('...a restore that cannot be saved changes nothing: not the settings in memory and not the settings file', e && e.message === 'disk full' && d2.getSettings().rules === undefined && readJ(t2.sf).rules === undefined);
  }
  { // closing waits for what is on its way
    const t = tmpDb('db.json', {}), d = new Database(t.f);
    ok('1.61.0: nothing on its way: nothing to wait for', d.writesPending() === false && await d.writesIdle() === undefined);
    { const p0 = d.setSettingsAsync({ only: 1 });
      ok('...a setting on its way is waited for (nothing else is)', d.writesPending() === true && d.sw.pending() === true && d.resumePending() === false);
      await d.writesIdle(); ok('...and when it is idle the setting is on the disk', d.writesPending() === false && readJ(t.sf).only === 1); await p0; }
    { const q0 = d.saveResumeAsync({ v: 1, race: { a: 1 }, eng: {} });
      ok('...a race save on its way is waited for (nothing else is)', d.writesPending() === true && d.resumePending() === true && d.sw.pending() === false);
      await d.writesIdle(); ok('...and when it is idle the race save is on the disk', d.writesPending() === false && readJ(path.join(t.dir, 'race-resume.json')).race.a === 1); await q0; }
    const p = d.setSettingsAsync({ q: 1 }), q = d.saveResumeAsync({ v: 1, race: {}, eng: {} });
    ok('...both on their way are waited for', d.writesPending() === true && d.sw.pending() === true && d.resumePending() === true);
    await d.writesIdle();
    ok('...and when it is idle both are on the disk', d.writesPending() === false && readJ(t.sf).q === 1 && readJ(path.join(t.dir, 'race-resume.json')).v === 1);
    await Promise.all([p, q]);
  }
  { // the writer on its own
    const t = tmpDb('w.txt'), W = Database.LatestWriter, w = new W(t.f);
    ok('1.61.0: LatestWriter: a new text is written and answered, the same text again is answered without a write', await w.write('one') === true && read(t.f) === 'one' && w.stats.writes === 1 && await w.write('one') === true && w.stats.writes === 1);
    const a = w.write('two'), b = w.write('three');
    ok('...writeNow does not go in front of a write that is on its way', w.writeNow('four') === false && w.pending() === true);
    await Promise.all([a, b]);
    ok('...the first text goes at once, and what arrived while it was on its way is one write with the newest text (three writes in all, not four)', read(t.f) === 'three' && w.stats.writes === 3 && w.writeNow('four') === true && read(t.f) === 'four' && w.written === 'four' && w.writeNow('four') === true);
    { const realOpen = fs.openSync; let opens = 0; fs.openSync = function (...r) { opens++; return realOpen.apply(this, r); };
      let same; try { same = w.writeNow('four'); } finally { fs.openSync = realOpen; }
      ok('...writeNow with the text that is in the file does not touch the disk', same === true && opens === 0); }
    { const realH = process.hrtime.bigint, seq = [0n, 300000000n, 0n, 2000000n]; let k = 0; process.hrtime.bigint = () => seq[k++];
      try { await w.write('slow'); await w.write('quick'); } finally { process.hrtime.bigint = realH; }
      ok('...the time of the last write and of the slowest are kept (a quick one after a slow one does not hide it)', w.stats.lastMs === 2 && w.stats.maxMs === 300); }
    let idle = false; const c = w.write('five'); w.whenIdle().then(() => { idle = true; });
    ok('...whenIdle waits for it', idle === false); await c; await new Promise(r => setImmediate(r));
    ok('...and is answered when it is done', idle === true && w.pending() === false);
  }
  { // the figures for the Performance report
    const t = tmpDb('db.json', { drivers: [{ id: 'a', picture: 'data:image/png;base64,' + 'A'.repeat(1500000) }], tracks: [{ id: 't', name: 'x' }] }), d = new Database(t.f);
    d.add('tracks', { name: 'T2' }); d.setSettings({ k: 1 });
    const st = d.dbStats();
    ok('1.61.0: dbStats: the file (size, saves, last and slowest time, the time of the text and of the file), the settings file, the biggest tables', st.file.bytes > 1500000 && st.file.saves >= 2 && st.file.lastMs >= 0 && st.file.maxMs >= st.file.lastMs && st.file.textMs >= 0 && st.file.fileMs >= 0 && st.file.failed === 0 && st.settings.bytes > 0 && st.settings.writes === 0);
    { const d3 = new Database(tmpDb('db.json', {}).f), realH = process.hrtime.bigint, seq = [0n, 100000000n, 300000000n, 0n, 1000000n, 2000000n]; let k = 0, f0s = d3.dbStats().file.saves;
      process.hrtime.bigint = () => seq[k++]; try { d3.save(); d3.save(); } finally { process.hrtime.bigint = realH; }
      const f = d3.dbStats().file;
      ok('...the times of a save: the last (making the text, writing the file), and the slowest, which is kept when a quick one follows', f.saves === f0s + 2 && f.lastMs === 2 && f.textMs === 1 && f.fileMs === 1 && f.maxMs === 300); }
    ok('...the biggest table comes first (counted, not turned into text), at most five', st.tables[0].name === 'drivers' && st.tables[0].bytes > 1500000 && st.tables.length <= 5 && st.tables.every((x, i, a) => i === 0 || a[i - 1].bytes >= x.bytes) && st.total >= st.tables[0].bytes);
    d.add('drivers', { name: 'More', picture: 'data:image/png;base64,' + 'B'.repeat(900000) });
    ok('...the count is kept for a minute (it is not made at every question)', d.dbStats().tables[0].bytes === st.tables[0].bytes);
    const realNow = Date.now; Date.now = () => realNow() + 61000; let later; try { later = d.dbStats(); } finally { Date.now = realNow; }
    d.add('drivers', { name: 'Third', picture: 'data:image/png;base64,' + 'C'.repeat(700000) }); d.sizes.at = Date.now() + 5e6;
    ok('...and when the clock was put back it is made again too (a count from the future is not trusted)', d.dbStats().tables[0].bytes > later.tables[0].bytes + 600000);
    { const g = d.dbStats(); g.file.saves = 999; g.settings.writes = 999; g.tables.length = 0;
      ok('...the figures that are given out are a copy for the file (changing them changes nothing)', d.dbStats().file.saves !== 999); }
    ok('...and made again after that', later.tables[0].bytes > st.tables[0].bytes + 800000);
    const f0 = d.stats.failed, realWrite = d.save, realRename = fs.renameSync; fs.renameSync = () => { throw new Error('locked'); }; let e = null; try { d.save(); } catch (x) { e = x; } finally { fs.renameSync = realRename; }
    ok('...a save that fails is counted (and the error still reaches the caller)', e && e.message === 'locked' && d.dbStats().file.failed === f0 + 1);
    ok('Database.approxSize: a text is its length and two quotes, null 4, empty list and object 2, and a number or a flag is a few characters', Database.approxSize('abc') === 5 && Database.approxSize(null) === 4 && Database.approxSize(undefined) === 4 && Database.approxSize([]) === 2 && Database.approxSize({}) === 2 && Database.approxSize(7) > 0 && Database.approxSize(true) > 0 && Database.approxSize(() => 1) === 0);
    const big = { settings: { a: 1, theme: 'dark', liveGrid: { x: [1, 2, 3] } }, drivers: Array.from({ length: 50 }, (_, i) => ({ id: 'd' + i, name: 'Driver ' + i, picture: 'data:image/png;base64,' + 'A'.repeat(20000) })), laps: Array.from({ length: 2000 }, (_, i) => ({ id: 'l' + i, t: 12.345 + i, lane: i % 2, driver: 'd' + (i % 50) })) };
    const ratio = Database.approxSize(big) / JSON.stringify(big, null, 2).length;
    ok('...and on a database with pictures it comes within a few percent of the size of the file (' + ratio.toFixed(2) + ')', ratio > 0.85 && ratio < 1.15);
  }
  { // main.js: the handler waits for the settings file, closing waits for what is on its way, and the core tells the figures
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), ps = fs.readFileSync(path.join(__dirname, '..', 'perfstats.js'), 'utf8');
    ok('1.61.0: main.js writes a setting with setSettingsAsync (not the synchronous one), and closing waits for the settings file as well as the race save', /ipcMain\.handle\('settings:set', async \(_e, patch\) => \{ const s = await db\.setSettingsAsync\(patch\);/.test(main) && !/db\.setSettings\(/.test(main) && /db\.writesPending\(\)/.test(main) && /db\.writesIdle\(\)/.test(main));
    ok('...the core tells the report about the database (dbStats)', /out\.database = d\.db && d\.db\.dbStats \? d\.db\.dbStats\(\) : \{\}/.test(ps));
  }
  console.log(fails ? fails + ' DB TESTS FAILED' : 'ALL DB TESTS PASSED'); process.exit(fails ? 1 : 0);
};
asyncTests().catch(x => { console.error(x); process.exit(1); });

