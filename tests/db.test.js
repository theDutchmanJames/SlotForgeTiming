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
console.log(fails ? fails + ' DB TESTS FAILED' : 'ALL DB TESTS PASSED'); process.exit(fails ? 1 : 0);
