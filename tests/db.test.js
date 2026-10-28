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
ok('a setup with fuel on gets a rewritten Fuel System with its values', rules.length === 1 && a.fuelRules === rules[0].id && rules[0].tank === 80 && rules[0].perLap === 3 && rules[0].empty === 'stop' && rules[0].rate === 5 && rules[0].paceSource === 'constant' && rules[0].paceTrack === '' && rules[0].paceManual === '');
ok('the old inline fuel settings are gone, other setups get no rule', !('fuel' in a) && !('fuelTank' in a) && !b.fuelRules && !('fuel' in b));
db = new Database(file);
ok('opening the file again does not make another rule', db.list('fuelrules').length === 1);
{ const legacyFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-fuel-legacy-')), 'db.json');
  fs.writeFileSync(legacyFile, JSON.stringify({ fuelrules: [{ id: 'old-fuel', name: 'Old fuel', tank: 90, perLap: 3, rate: 6, targetLap: 8, maxExtra: 20, maxSaving: 25, empty: 'retire' }] }));
  const legacyRule = new Database(legacyFile).list('fuelrules')[0];
  ok('an existing Fuel System with retired fast/slow settings is migrated as a visible legacy rule without changing its calculations', legacyRule.paceSource === 'manual' && legacyRule.paceManual === 8 && legacyRule.legacyPace === true && legacyRule.maxExtra === 20 && legacyRule.maxSaving === 25);
}
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
  const lap = { carId: car.id, driverId: 'x', lapNo: 1, time: 5000 }, real = d.saveSync;
  d.saveSync = () => { throw new Error('disk full'); }; // (1.61.2: the one place that writes in the program's own time)
  let err = null; try { d.saveSession({ date: '2026-10-18', standings: [] }, [lap, { ...lap, lapNo: 2 }]); } catch (x) { err = x; }
  d.saveSync = real;
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
    const t2 = tmpDb('db.json', {}), d2 = new Database(t2.f), realSave = d2.saveSync; d2.saveSync = () => { throw new Error('disk full'); };
    let e = null; try { d2.replaceAll({ settings: { rules: 'x' } }); } catch (x) { e = x; } d2.saveSync = realSave;
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
  { // 1.61.1: a full save tells how long it took (the Performance report makes a note of the slow ones)
    const t = tmpDb('db.json', {}), d = new Database(t.f), got = [];
    ok('1.61.1: no one is told about a save unless the program asks (the hook is empty)', d.onSave === null);
    d.onSave = info => got.push(info);
    const row = d.add('drivers', { name: 'A' }); d.update('drivers', row.id, { name: 'B' });
    ok('...every full save tells the time, the part that made the text, the part that wrote the file and the size of the file', got.length === 2 && got.every(g => g.ms >= 0 && g.textMs >= 0 && g.fileMs >= 0 && g.ms >= g.textMs && g.bytes === read(t.f).length));
    const n = got.length; d.setSettings({ a: 1 }); await d.setSettingsAsync({ a: 2 });
    ok('...a change of a setting is not a full save and tells nothing', got.length === n);
    const realH = process.hrtime.bigint, seq = [0n, 100000000n, 300000000n]; let k = 0; process.hrtime.bigint = () => seq[k++];
    try { d.save(); } finally { process.hrtime.bigint = realH; }
    const g = got[got.length - 1];
    ok('...the figures are those of the clock: 300 ms in all, 100 of them for the text and 200 for the file', g.ms === 300 && g.textMs === 100 && g.fileMs === 200 && g.bytes === d.stats.bytes);
    const realRename = fs.renameSync, m = got.length; fs.renameSync = () => { throw new Error('locked'); }; let e = null; try { d.save(); } catch (x) { e = x; } finally { fs.renameSync = realRename; }
    ok('...a save that fails tells nothing (and the error is still raised)', e && e.message === 'locked' && got.length === m);
    d.onSave = () => { throw new Error('the note failed'); }; let e2 = null; try { d.add('drivers', { name: 'C' }); } catch (x) { e2 = x; }
    ok('...a hook that fails never stops a save: the file has the new driver and no error is raised', e2 === null && readJ(t.f).drivers.some(x => x.name === 'C'));
    const t2 = tmpDb('db.json', {}); let told = 0; const d2 = new Database(t2.f); d2.onSave = () => told++;
    ok('...the save at the start of the program is made before anyone can ask, so it tells nothing', told === 0 && d2.stats.saves >= 1);
    // together with the collector of the Performance report, as main.js puts them
    const { createCollector, createWatcher } = require('../perfstats.js'), clock = { t: 7000000 };
    const K = createCollector({ app: { getAppMetrics: () => [], getGPUFeatureStatus: () => ({}), getGPUInfo: async () => ({}) }, screen: { getPrimaryDisplay: () => ({ size: { width: 1, height: 1 }, scaleFactor: 1 }), getAllDisplays: () => [] }, os: { platform: () => 'win32', arch: () => 'x64', release: () => '1', cpus: () => [], totalmem: () => 1, freemem: () => 1, loadavg: () => [0, 0, 0] }, process: { env: {}, argv: [], versions: {} }, db: d2, version: 'x', readText: async () => { throw new Error('x'); }, now: () => clock.t, setInterval: () => ({ unref() {} }), clearInterval: () => {} });
    d2.onSave = i => createWatcher({ mark: K.mark, sizeOf: Database.approxSize }).saved(i);
    const h = process.hrtime.bigint, sq = [0n, 183000000n, 349000000n, 0n, 1000000n, 2000000n]; let q = 0; process.hrtime.bigint = () => sq[q++];
    try { d2.add('drivers', { name: 'Slow' }); clock.t += 50; d2.add('drivers', { name: 'Quick' }); } finally { process.hrtime.bigint = h; }
    const marks = (await K.collect()).marks;
    ok('...the slow save is in the notes of the report with its clock time, the quick one is not', marks.length === 1 && marks[0].at === 7000000 && /^Saved the whole database: 349 ms \(making the text 183, writing the file 166\), \d+(\.\d)? KB$/.test(marks[0].text), JSON.stringify(marks));
  }
  { // main.js: the handler waits for the settings file, closing waits for what is on its way, and the core tells the figures
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), ps = fs.readFileSync(path.join(__dirname, '..', 'perfstats.js'), 'utf8');
    ok('1.61.0: main.js writes a setting with setSettingsAsync (not the synchronous one), and closing waits for the settings file as well as the race save', /ipcMain\.handle\('settings:set', async \(_e, patch\) => \{[\s\S]*?const p = db\.setSettingsAsync\(patch\); db\.bg = backgroundOn\(db\.getSettings\(\)\); const s = await p;/.test(main) && !/db\.setSettings\(/.test(main) && /db\.writesPending\(\)/.test(main) && /db\.writesIdle\(\)/.test(main));
    ok('...the core tells the report about the database (dbStats)', /out\.database = d\.db && d\.db\.dbStats \? d\.db\.dbStats\(\) : \{\}/.test(ps));
  }
  // ===== 1.61.2: the whole database is written in the background, and only the items that changed are made into text again =====
  const BIG = 'data:image/png;base64,' + 'A'.repeat(1200000), JS = d => JSON.stringify(d.data, null, 2);
  const odd = 'Zoë "quoted" \\ back\nline\ttab   \u0007 😀 \ud800 lone';
  const fixture = () => ({ version: 1, settings: { theme: 'dark', big: { deep: [1, 2, { x: null }] } }, customFields: { drivers: [] }, notes: ['a', null, 5, { x: 1 }, [], {}], emptyThing: {}, zero: 0,
    drivers: [{ id: 'd1', name: odd, custom: {}, n: [0, -0, 1e21, 5.5], nothing: null, e: [], o: {} }, { id: 'd2', name: 'Plain', custom: {} }], slotcars: [{ id: 'c1', name: 'Red', picture: BIG, custom: {} }, { id: 'c2', name: 'Blue', custom: {} }],
    tracks: [{ id: 't1', name: 'Oval', custom: {} }], racesetups: [{ id: 'r1', name: 'Race', track: 't1', custom: {} }], teams: [{ id: 'tm1', name: 'Team', drivers: ['d1', 'd2'], custom: {} }],
    laps: Array.from({ length: 3000 }, (_, i) => ({ id: 'l' + i, sessionId: 'old', carId: 'c2', driverId: 'd2', time: 10000 + i, note: 'x'.repeat(120) })), sessions: [{ id: 'old', date: '2026-01-01', standings: [] }] });
  const chunksText = d => d.fileChunks().chunks.join('');
  // 1. the pieces put together are exactly JSON.stringify(data, null, 2): odd values, empty things, a picture of 1.2 million characters, thousands of small items
  {
    const t = tmpDb('db.json', fixture()), d = new Database(t.f), atStart = read(t.f) === JS(d);
    d.data.drivers[1].gone = undefined; d.data.notes.push(undefined, () => 1, Symbol('s')); d.data.ghost = undefined; d.data.fn = () => 2; d.data.sparse = new Array(3);
    d.touchAll();
    ok('1.61.2: the pieces of the file put together are exactly JSON.stringify(data, null, 2) (odd characters, undefined, empty lists and objects, a picture of 1.2 million characters, 3000 small items)', chunksText(d) === JS(d) && d.fileChunks().chars === JS(d).length);
    ok('...the file written at the start of the program is that text too (the first save makes every text)', atStart && read(t.f).length > 1200000);
    const e = tmpDb('e.json'), de = new Database(e.f);
    ok('...a database with nothing in it (only the empty tables) too', chunksText(de) === JS(de) && read(e.f) === JS(de));
    const z = tmpDb('z.json'), dz = new Database(z.f); dz.data = {}; dz.touchAll();
    ok('...and the data with nothing at all is {}', chunksText(dz) === '{}' && JSON.stringify({}, null, 2) === '{}');
    const big = new Array(1500).fill(0).map((_, i) => ({ id: 'x' + i, v: 'y'.repeat(700) })), dx = new Database(tmpDb('x.json').f); dx.data.many = big; dx.touchAll();
    ok('...a table that is many items of 700 characters (written in groups) and one item of 300 000 characters (written alone)', (dx.data.one = [{ id: 'q', v: 'z'.repeat(300000) }], dx.touchAll(), chunksText(dx) === JS(dx)));
  }
  // 2. the text of an item that was not touched is not made again; a touched one is; an item changed in place and not touched keeps its old text (the rule for whoever changes an item)
  {
    const d = new Database(tmpDb('db.json', fixture()).f); let looks = 0;
    Object.defineProperty(d.data.drivers[1], 'watch', { enumerable: true, configurable: true, get() { looks++; return 'w'; } });
    d.touchAll(); chunksText(d); const first = looks;
    chunksText(d); chunksText(d);
    ok('1.61.2: an item that was not touched is not made into text again (saved three times, looked at once)', first === 1 && looks === 1);
    d.touch(d.data.drivers[1]); chunksText(d);
    ok('...touch(item) makes that one again, once', looks === 2);
    d.touch(d.data.drivers[0]); chunksText(d);
    ok('...touching another item does not', looks === 2);
    d.touchAll(); chunksText(d);
    ok('...touchAll makes every item again', looks === 3);
    d.data.drivers[0].name = 'Changed in place'; const stale = chunksText(d) !== JS(d); d.touch(d.data.drivers[0]);
    ok('...an item changed in place and not touched keeps its old text in the file (so whoever changes an item must touch it); touched, the text is right', stale && chunksText(d) === JS(d));
    ok('...touch ignores things that are not items', (d.touch(null), d.touch(undefined), d.touch('x'), d.touch(5), true));
  }
  // 3. after every kind of change the file is exactly the data, in the program's own time (bg = false) and in the background (bg = true)
  const scenario = async mode => {
    const t = tmpDb('db.json', fixture()), d = new Database(t.f), bad = [], bg = mode === 'bg'; d.bg = bg;
    const check = async label => { if (bg) await d.saved(); if (read(t.f) !== JS(d) || chunksText(d) !== JS(d)) bad.push(label); };
    const drv = d.add('drivers', { name: 'Anna "A" 😀', picture: BIG }); await check('add a driver');
    const car = d.add('slotcars', { name: 'Green', picture: BIG + 'B' }); await check('add a slotcar');
    d.update('drivers', drv.id, { name: 'Anna B', nick: 'ab' }); await check('update a driver');
    d.update('slotcars', car.id, { name: 'Green 2', picture: 'small' }); await check('update a slotcar');
    d.update('slotcars', 'c1', { name: 'Red 2' }); await check('update a slotcar that has a big picture');
    d.add('tracks', { name: 'Track 2' }); d.add('racesetups', { name: 'Race 2', track: 't1' }); await check('add a track and a race setup');
    const sid = d.saveSession({ date: '2026-10-20', standings: [{ driverId: drv.id, carId: car.id }] }, [{ carId: car.id, driverId: drv.id, lapNo: 1, time: 5000 }, { carId: 'c1', driverId: drv.id, lapNo: 2, time: 5100 }]); await check('save a finished race');
    d.update('slotcars', car.id, { note: 'after the race' }); await check('update the car whose counters the race changed');
    d.removeSession(sid); await check('remove a session (the counters of the cars follow)');
    const f1 = d.addCustomField('drivers', { label: 'Shoe', type: 'text' }); d.update('drivers', drv.id, { custom: { [f1.id]: '44' } }); await check('add an extra field and use it');
    d.setCustomFieldGroup('drivers', f1.id, ''); await check('move an extra field to another group');
    d.removeCustomField('drivers', f1.id); await check('remove an extra field (the items lose their value)');
    d.remove('tracks', 't1'); await check('remove a track (its race setups lose it)');
    d.remove('drivers', 'd2'); await check('remove a driver (teams, laps and races follow)');
    d.remove('slotcars', car.id); await check('remove a slotcar');
    d.setSettings({ zoom: 3 }); d.add('drivers', { name: 'After settings' }); await check('a change of the settings is in the file at the next save');
    d.replaceAll({ drivers: [{ id: 'z1', name: 'Restored', custom: {} }], settings: { theme: 'light' } }); await check('restore a backup');
    d.add('drivers', { name: 'After restore' }); await check('add after a restore');
    d.data.drivers.push({ id: 'direct', name: 'Pushed straight into the data', custom: {} }); d.data.drivers[0].name = 'Changed in place'; d.save(); await check('save() after changes made straight in the data (every text is made again)');
    d.data.drivers[0].name = 'Again'; d.saveNow(); await check('saveNow() the same, at once');
    return { bad, d, t };
  };
  for (const mode of ['sync', 'bg']) {
    const r = await scenario(mode);
    if (r.bad.length) console.log('   not the same as the data after: ' + r.bad.join(' | '));
    ok(`1.61.2: after every kind of change (add, update, remove with its follow-ups, a race, a removed race, extra fields, settings, a restore, save, saveNow) the file is exactly the data, ${mode === 'bg' ? 'written in the background' : 'in the program\'s own time'}`, r.bad.length === 0);
    ok('...and no temporary file is left behind', leftovers(r.t.dir).length === 0);
    ok('...and a new Database reads the same data back', JSON.stringify(new Database(r.t.f).data) === JSON.stringify(r.d.data));
  }
  // 4. in the background: the change is in memory at once and in the file when saved() is kept; changes that come while one is written are written together
  {
    const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.bg = true; const before = read(t.f);
    const row = d.add('drivers', { name: 'Quick' });
    ok('1.61.2: in the background the change is in memory at once and the file still has the old state until the write is done', d.list('drivers').some(x => x.id === row.id) && read(t.f) === before && d.writesPending() === true);
    await d.saved();
    ok('...saved() is kept when the file has it', read(t.f) === JS(d) && read(t.f).includes('"Quick"') && d.writesPending() === false);
    const w0 = d.stats.bgSaves;
    for (let i = 0; i < 10; i++) d.update('drivers', row.id, { name: 'Quick ' + i });
    await d.saved();
    ok('...ten quick changes are written by two writes (the first, then one with all the rest), and the file has the last', d.stats.bgSaves - w0 === 2 && read(t.f).includes('"Quick 9"') && read(t.f) === JS(d));
    ok('...saved() when nothing is on its way is kept at once', (await Promise.race([d.saved().then(() => 'kept'), new Promise(r => setTimeout(() => r('late'), 500))])) === 'kept');
    d.add('drivers', { name: 'Third' }); let midTmp = false, whole = true; const t0 = Date.now();
    while (d.writesPending() && Date.now() - t0 < 5000) { if (fs.existsSync(t.f + '.bg.tmp')) midTmp = true; try { JSON.parse(read(t.f)); } catch { whole = false; } await new Promise(r => setImmediate(r)); }
    ok('...while it is written the file has a name of its own and the real file is always a whole database (never half written)', midTmp && whole);
    await d.writesIdle();
    ok('...writesPending/writesIdle (closing) include the database file', d.writesPending() === false && read(t.f) === JS(d) && !fs.existsSync(t.f + '.bg.tmp'));
    const realRename = fs.promises.rename; let renameCalls = 0;
    fs.promises.rename = async (...a) => { renameCalls++; if (renameCalls === 1) throw Object.assign(new Error('locked'), { code: 'EPERM' }); return realRename.apply(fs.promises, a); };
    try { d.add('drivers', { name: 'Locked once' }); await d.saved(); } finally { fs.promises.rename = realRename; }
    ok('...a brief Windows file lock while renaming is retried and the new database is kept', renameCalls === 2 && read(t.f) === JS(d) && !fs.existsSync(t.f + '.bg.tmp'));
    ok('...the numbers: saves counted, the last one was in the background, the core was busy only for the text', d.stats.background === true && d.stats.bgSaves >= 3 && d.stats.lastMs === d.stats.textMs && d.stats.fileMs > 0 && d.dbStats().file.on === true && d.stats.bgMaxMs >= d.stats.textMs);
    d.bg = false; d.add('drivers', { name: 'Own time' });
    ok('...with the background off the change is in the file before add returns, and saved() is kept', read(t.f).includes('"Own time"') && d.stats.background === false && d.dbStats().file.on === false && (await d.saved()) === true);
  }
  // 5. a save in the program's own time (an import, a restore) while a write in the background is on its way: the older text never replaces the newer
  {
    const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.bg = true;
    d.add('drivers', { name: 'A (in the background)' });
    d.data.tracks.push({ id: 'tB', name: 'B (straight in, saved at once)', custom: {} }); d.saveNow();
    await d.writesIdle();
    ok('1.61.2: a save in the program\'s own time while a background write is on its way is not replaced by the older text of that write', read(t.f) === JS(d) && read(t.f).includes('B (straight in, saved at once)') && read(t.f).includes('A (in the background)') && !fs.existsSync(t.f + '.bg.tmp') && !fs.existsSync(t.f + '.tmp'));
    d.add('drivers', { name: 'C' }); d.bg = false; d.add('drivers', { name: 'D (own time, switched off meanwhile)' }); await d.writesIdle();
    ok('...switching the background off while a write is on its way is the same', read(t.f) === JS(d) && read(t.f).includes('"D (own time, switched off meanwhile)"') && read(t.f).includes('"C"'));
  }
  // 5b. the same, when the save in the program's own time comes while the background write is just renaming (the rename is slowed down here to be sure to hit that moment)
  {
    const realRename = fs.promises.rename; let renames = 0;
    fs.promises.rename = async (...a) => { renames++; await new Promise(r => setTimeout(r, 150)); return realRename.apply(fs.promises, a); };
    try {
      const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.bg = true; const b0 = d.stats.bgSaves;
      d.add('drivers', { name: 'A (older text, being renamed over the file)' });
      const t0 = Date.now(); while (!d.fsave.renaming && Date.now() - t0 < 5000) await new Promise(r => setImmediate(r));
      const sawRenaming = d.fsave.renaming === true;
      d.data.tracks.push({ id: 'tC', name: 'C (straight in, saved at once while the rename is on its way)', custom: {} }); d.saveNow();
      const againSet = d.fsave.again === true;
      await d.writesIdle();
      ok('1.61.2: a save in the program\'s own time while the background write is renaming its older text: the newest state is written once more right after, so the file ends right', sawRenaming && againSet && read(t.f) === JS(d) && read(t.f).includes('C (straight in') && d.stats.bgSaves - b0 === 2 && renames === 2 && !fs.existsSync(t.f + '.bg.tmp') && d.fsave.renaming === false);
      const u = tmpDb('u.json', fixture()), du = new Database(u.f); du.bg = true; du.add('drivers', { name: 'plain' }); await du.saved();
      ok('...a save in the program\'s own time when nothing is being renamed does not start another write', du.fsave.renaming === false && (du.saveNow(), du.fsave.again === false && du.writesPending() === false));
    } finally { fs.promises.rename = realRename; }
  }
  // 6. a write in the background that fails: the error reaches whoever waits, the numbers count it, and the next write brings everything
  {
    const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.bg = true; const good = d.file; d.file = path.join(t.dir, 'nodir', 'db.json'); const msgs = []; const logged = console.error; console.error = (...a) => msgs.push(a.join(' '));
    let err = null; try { d.add('drivers', { name: 'Not written' }); await d.saved(); } catch (x) { err = x; } console.error = logged;
    ok('1.61.2: a background write that fails: saved() is broken with the reason, the failed count goes up, the change stays in memory and nothing is left running', !!err && d.stats.failed === 1 && d.list('drivers').some(x => x.name === 'Not written') && d.writesPending() === false && msgs.some(m => m.includes('[database]')));
    d.file = good; d.add('drivers', { name: 'Written' }); await d.saved();
    ok('...the next write brings the change that failed too', read(t.f).includes('"Not written"') && read(t.f).includes('"Written"') && read(t.f) === JS(d));
    ok('...a failure nobody waits for is no unhandled error (the process is still here)', (d.file = path.join(t.dir, 'nodir', 'db.json'), console.error = () => {}, d.add('drivers', { name: 'Nobody waits' }), await new Promise(r => setTimeout(r, 100)), console.error = logged, d.file = good, true));
    await d.writesIdle();
  }
  // 7. a finished race in the background: written, or taken out again when the write fails
  {
    const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.bg = true; const car = d.list('slotcars')[1], good = d.file;
    const id = await d.saveSessionAsync({ date: '2026-10-21', standings: [] }, [{ carId: car.id, driverId: 'd1', lapNo: 1, time: 5000 }, { carId: car.id, driverId: 'd1', lapNo: 2, time: 5100 }]);
    ok('1.61.2: saveSessionAsync answers the id when the file has the race', typeof id === 'string' && d.list('sessions').some(s => s.id === id) && JSON.parse(read(t.f)).sessions.some(s => s.id === id) && car.lapsDriven === 2 && d.undo.size === 0);
    d.file = path.join(t.dir, 'nodir', 'db.json'); const logged = console.error; console.error = () => {};
    let err = null; const sessionsBefore = d.list('sessions').length, lapsBefore = d.data.laps.length;
    try { await d.saveSessionAsync({ date: '2026-10-22', standings: [] }, [{ carId: car.id, driverId: 'd1', lapNo: 1, time: 4000 }]); } catch (x) { err = x; } console.error = logged;
    ok('...when the write fails the race is taken out again, the counters are as before and the error reaches the caller', !!err && d.list('sessions').length === sessionsBefore && d.data.laps.length === lapsBefore && car.lapsDriven === 2 && d.undo.size === 0);
    d.file = good; await d.saveSessionAsync({ date: '2026-10-22', standings: [] }, [{ carId: car.id, driverId: 'd1', lapNo: 1, time: 4000 }]);
    ok('...and trying again gives one more race and one more lap, not two', d.list('sessions').length === sessionsBefore + 1 && d.data.laps.length === lapsBefore + 1 && car.lapsDriven === 3 && read(t.f) === JS(d));
    const s2 = tmpDb('s.json', fixture()), ds = new Database(s2.f); const id2 = await ds.saveSessionAsync({ date: '2026-10-23', standings: [] }, [{ carId: 'c2', driverId: 'd1', lapNo: 1, time: 1 }]);
    ok('...with the background off it is the same call (written before it answers)', JSON.parse(read(s2.f)).sessions.some(s => s.id === id2) && ds.undo.size === 0);
  }
  // 8. the slices of a big text never cut a character that is made of two (an emoji) in half, and the file is right when an emoji sits at the cut
  {
    const sl = Database.slicesOf, join = a => [...a].join('');
    ok('1.61.2: slices put together give the text back', join(sl('abcdefghij', 3)) === 'abcdefghij' && [...sl('abcdefghij', 3)].length === 4 && [...sl('', 3)].length === 0 && [...sl('ab', 5)].length === 1);
    const e = 'ab😀cd', parts = [...sl(e, 3)];
    ok('...a slice does not end between the two halves of an emoji (it takes both)', parts.length === 2 && parts[0] === 'ab😀' && parts[1] === 'cd' && parts.every(x => !/[\ud800-\udbff]$/.test(x)));
    ok('...also at every position of an emoji around the cut', [0, 1, 2, 3, 4, 5, 6].every(k => { const s = 'x'.repeat(k) + '😀' + 'y'.repeat(6 - k) + '😀' + 'z'.repeat(4); const ps = [...sl(s, 4)]; return ps.join('') === s && ps.every(x => !/[\ud800-\udbff]$/.test(x)); }));
    for (const mode of ['sync', 'bg']) {
      const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.bg = mode === 'bg';
      // the name sits in an item at 4 spaces + '"id": "e1",' + ... : find the offset so that an emoji starts at the last character of the first slice of that item
      for (let pad = 0; pad < 4; pad++) { d.add('drivers', { name: 'a'.repeat(999960 + pad) + '😀' + 'b'.repeat(50) }); if (d.bg) await d.saved(); }
      ok(`1.61.2: ${mode === 'bg' ? 'in the background' : 'in the program\'s own time'} the file is right when an emoji sits at the cut of a slice (four positions)`, read(t.f) === JS(d) && !read(t.f).includes('�'));
    }
  }
  // 9. a stopped program may have left a file of the background write: the next start removes it
  {
    const t = tmpDb('db.json', fixture()); fs.writeFileSync(t.f + '.bg.tmp', 'half a file'); new Database(t.f);
    ok('1.61.2: a half written file of the background write that a stopped program left is removed at the start', !fs.existsSync(t.f + '.bg.tmp'));
  }
  // 10. the figures that are told: in the program's own time the core is busy for all of it, in the background for the text only
  {
    const t = tmpDb('db.json', fixture()), d = new Database(t.f), seen = []; d.onSave = i => seen.push(i);
    d.add('drivers', { name: 'Own' }); d.bg = true; d.add('drivers', { name: 'Back' }); await d.saved();
    ok('1.61.2: onSave tells in the program\'s own time ms = text + file (background false), in the background ms = the text only (background true) and the time of the file apart', seen.length === 2 && seen[0].background === false && Math.abs(seen[0].ms - (seen[0].textMs + seen[0].fileMs)) < 0.2 && seen[1].background === true && seen[1].ms === seen[1].textMs && seen[1].fileMs > 0 && seen[1].bytes === JS(d).length);
  }
  // 11. what the check with deliberate breaks found (1.61.2): the edges of the slices, how the pieces are cut, what a failed write leaves behind, and the small bookkeeping
  {
    const sl = Database.slicesOf, ends = ps => ps.every(x => !/[\ud800-\udbff]$/.test(x));
    const lo = [...sl('abc𐀀de', 4)], hi = [...sl('abc􏿿de', 4)];
    ok('1.61.2: a slice also keeps the two halves together at the very first and the very last character that is made of two (U+10000 and U+10FFFF)', lo.length === 2 && lo[0] === 'abc𐀀' && ends(lo) && hi.length === 2 && hi[0] === 'abc􏿿' && ends(hi));
    // how the pieces are cut: items over 200000 characters alone, the others together until the group passes 500000
    const t = tmpDb('db.json', fixture()), d = new Database(t.f);
    d.data.tracks = Array.from({ length: 10 }, (_, i) => ({ id: 'T' + i, name: 'n'.repeat(120000), custom: {} })); d.touchAll();
    const grp = d.fileChunks().chunks.filter(c => c.includes('"id": "T')), count = c => (c.match(/"id": "T\d"/g) || []).length;
    ok('...small items are grouped until the group is over 500000 characters (ten items of 120000 make two groups of five)', grp.length === 2 && grp.every(c => count(c) === 5) && chunksText(d) === JS(d));
    d.data.tracks = [{ id: 's1', name: 'small', custom: {} }, { id: 's2', name: 'small', custom: {} }, { id: 'bigone', name: 'n'.repeat(300000), custom: {} }, { id: 's3', name: 'small', custom: {} }]; d.touchAll();
    const ch = d.fileChunks().chunks, withBig = ch.find(c => c.includes('"bigone"'));
    ok('...an item of over 200000 characters is a piece of its own, and the items before and after it keep their places', !!withBig && !/"id": "s[123]"/.test(withBig) && ch.join('') === JS(d) && ch.some(c => c.includes('"s1"') && c.includes('"s2"')) && ch.some(c => c.includes('"s3"')));
    // what is written, and how: no more than a slice at a time, every file closed, flushed once, and nothing left behind by a write that fails
    const seen = { sync: 0, async: 0, opens: 0, closes: 0, syncs: 0, calls: 0 }, realWriteSync = fs.writeSync, realOpen = fs.promises.open; let failAt = 0;
    const sy = { opens: [], closes: 0, fsyncs: 0, calls: 0 }, realOpenSync = fs.openSync, realCloseSync = fs.closeSync, realFsyncSync = fs.fsyncSync; let failSyncAt = 0;
    fs.openSync = (p, ...r) => { sy.opens.push(String(p)); return realOpenSync.call(fs, p, ...r); };
    fs.closeSync = fd => { sy.closes++; return realCloseSync.call(fs, fd); };
    fs.fsyncSync = fd => { sy.fsyncs++; return realFsyncSync.call(fs, fd); };
    fs.writeSync = (fd, str, ...r) => { sy.calls++; if (failSyncAt && sy.calls >= failSyncAt) throw new Error('disk says no (own time)'); if (typeof str === 'string') seen.sync = Math.max(seen.sync, str.length); return realWriteSync.call(fs, fd, str, ...r); };
    fs.promises.open = async (...a) => {
      const fh = await realOpen.apply(fs.promises, a); seen.opens++; const w = fh.writeFile.bind(fh), c = fh.close.bind(fh), y = fh.sync.bind(fh);
      fh.writeFile = s => { seen.calls++; if (failAt && seen.calls >= failAt) return Promise.reject(new Error('disk says no')); if (typeof s === 'string') seen.async = Math.max(seen.async, s.length); return w(s); };
      fh.close = () => { seen.closes++; return c(); }; fh.sync = () => { seen.syncs++; return y(); }; return fh;
    };
    const logged = console.error; console.error = () => {};
    try {
      const u = tmpDb('u.json', fixture()), du = new Database(u.f), o1 = sy.opens.length, c1 = sy.closes, f1 = sy.fsyncs; du.add('drivers', { name: 'a'.repeat(2500000) });
      ok('1.61.2: in the program\'s own time no piece of more than a million characters is handed to the disk at once, the file has a name of its own while it is written, and it is flushed and closed', seen.sync > 100000 && seen.sync <= 1000001 && sy.opens.length - o1 === 1 && sy.opens[o1] === u.f + '.tmp' && sy.closes - c1 === 1 && sy.fsyncs - f1 === 1);
      const before = read(u.f), o2 = sy.opens.length, c2 = sy.closes; failSyncAt = sy.calls + 2; let e3 = null; try { du.add('drivers', { name: 'fails in the program\'s own time' }); } catch (x) { e3 = x; } failSyncAt = 0;
      ok('...a write in the program\'s own time that fails halfway: an error, the file is closed, the failure is counted and the real file is exactly as it was', !!e3 && /disk says no/.test(e3.message) && read(u.f) === before && sy.opens.length - o2 === 1 && sy.closes - c2 === 1 && du.stats.failed === 1);
      du.bg = true; du.add('drivers', { name: 'b'.repeat(2500000) }); await du.saved();
      ok('...in the background the same, every file is closed and flushed, and nothing is left behind', seen.async > 100000 && seen.async <= 1000001 && seen.opens >= 1 && seen.closes === seen.opens && seen.syncs === seen.opens && !fs.existsSync(u.f + '.bg.tmp') && read(u.f) === JS(du));
      const o0 = seen.opens, c0 = seen.closes; failAt = seen.calls + 3; du.add('drivers', { name: 'c' }); let err = null; try { await du.saved(); } catch (x) { err = x; }
      ok('...a write that fails halfway: the error reaches the caller, the file is closed, the half written file is removed and the real file is untouched', !!err && /disk says no/.test(err.message) && seen.opens - o0 === 1 && seen.closes - c0 === 1 && !fs.existsSync(u.f + '.bg.tmp') && JSON.parse(read(u.f)).drivers.every(x => x.name !== 'c'));
      failAt = 0; fs.promises.open = async () => { throw undefined; }; du.add('drivers', { name: 'd' }); let err2 = null; try { await du.saved(); } catch (x) { err2 = x; }
      ok('...a failure that comes without a reason still reaches the caller as an error', err2 instanceof Error && /could not be written/.test(err2.message));
    } finally { fs.writeSync = realWriteSync; fs.openSync = realOpenSync; fs.closeSync = realCloseSync; fs.fsyncSync = realFsyncSync; fs.promises.open = realOpen; console.error = logged; }
  }
  {
    // save() gives the answer of the write; the answer of an older failed write is gone once the program writes in its own time again
    const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.bg = true; const p = d.save(), good = d.file;
    ok('1.61.2: save() in the background gives the answer of the write (kept when the file has it), in the program\'s own time it has written before it returns', !!p && typeof p.then === 'function' && (await p) === true && read(t.f) === JS(d) && (d.bg = false, d.save() === null));
    d.bg = true; d.file = path.join(t.dir, 'nodir', 'db.json'); const logged = console.error; console.error = () => {};
    d.add('drivers', { name: 'fails' }); try { await d.saved(); } catch { /* the failure is the point */ } console.error = logged;
    d.file = good; d.bg = false; d.add('drivers', { name: 'written in the program\'s own time' });
    ok('...and after a failed write in the background, a change written in the program\'s own time is answered as kept (the old failure does not come back)', (await d.saved().then(() => 'kept', () => 'broken')) === 'kept' && read(t.f) === JS(d));
    d.saveSession({ date: '2026-10-24', standings: [] }, [{ carId: 'c2', driverId: 'd1', lapNo: 1, time: 1 }]);
    ok('...a race saved in the program\'s own time leaves nothing to take it out again', d.undo.size === 0);
  }
  {
    // a write in the background that a save in the program's own time has replaced is not counted, and starts no second write
    const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.bg = true; const s0 = d.stats.saves, b0 = d.stats.bgSaves;
    d.add('drivers', { name: 'A' }); d.data.tracks.push({ id: 'tZ', name: 'Z', custom: {} }); d.saveNow(); await d.writesIdle();
    ok('1.61.2: a background write that was replaced by a save in the program\'s own time is not counted as a save and starts no second write', d.stats.saves === s0 + 1 && d.stats.bgSaves === b0 && d.fsave.again === false && read(t.f) === JS(d));
    // the waiters of a finished write are gone
    d.add('drivers', { name: 'B' }); const idle = d.fileIdle(); await d.saved(); await idle;
    ok('...whoever waited for a write is let go of afterwards (no list that only grows)', d.fsave.waiters.length === 0 && d.fsave.idle.length === 0 && d.filePending() === false);
    // the figures: the slowest time the core was busy in the background is the text, and it stays when a quicker one follows
    const b1 = d.stats.bgSaves; d.noteSave({ text: 50000000n, file: 900000000n, chars: 10, background: true }); d.noteSave({ text: 10000000n, file: 20000000n, chars: 10, background: true });
    ok('...the slowest background save is kept as the text time (not the file time) and the last one is shown as it was', d.stats.bgSaves === b1 + 2 && d.stats.bgMaxMs === 50 && d.stats.lastMs === 10 && d.stats.textMs === 10 && d.stats.fileMs === 20);
  }
  {
    // the pieces that follow a direct call of removeLapsWhere, the undo of a race that could not be written, and a restore that fails in the background mode
    const t = tmpDb('db.json', fixture()), d = new Database(t.f); d.update('slotcars', 'c2', { lapsDriven: 7 }); d.removeLapsWhere(l => l.id === 'l0'); d.commit();
    ok('1.61.2: removeLapsWhere says by itself that the cars changed (the file has the new counter although nothing else was touched)', d.list('slotcars')[1].lapsDriven === 6 && read(t.f) === JS(d) && read(t.f).includes('"lapsDriven": 6'));
    const u = tmpDb('u.json', fixture()), du = new Database(u.f); du.bg = true; const good = du.file, car = du.list('slotcars')[1]; du.update('slotcars', 'c2', { lapsDriven: 2 }); await du.saved();
    du.file = path.join(u.dir, 'nodir', 'db.json'); const logged = console.error; console.error = () => {};
    try { await du.saveSessionAsync({ date: '2026-10-22', standings: [] }, [{ carId: 'c2', driverId: 'd1', lapNo: 1, time: 4000 }]); } catch { /* taken out again */ } console.error = logged;
    du.file = good; du.add('tracks', { name: 'after the undo' }); await du.saved();
    ok('...a race that could not be written is taken out again so completely that the next write has the old counters (not the text made for the race)', car.lapsDriven === 2 && read(u.f) === JS(du) && read(u.f).includes('"lapsDriven": 2') && !read(u.f).includes('"lapsDriven": 3'));
    const v = tmpDb('v.json', fixture()), dv = new Database(v.f); dv.bg = true; const old = dv.data; dv.file = path.join(v.dir, 'nodir', 'db.json'); let threw = false; const lg = console.error; console.error = () => {};
    try { dv.replaceAll({ drivers: [{ id: 'new', name: 'New', custom: {} }] }); } catch { threw = true; } console.error = lg;
    ok('1.61.2: a restore with the background save on is written at once: when the disk will not take it, it is an error and what was there is still there', threw && dv.data === old && dv.writesPending() === false);
    dv.file = v.f; dv.replaceAll({ drivers: [{ id: 'new', name: 'New', custom: {} }] });
    ok('...and when it can, the file has it before the call returns', dv.writesPending() === false && read(v.f) === JS(dv) && read(v.f).includes('"New"') && dv.data.drivers.length === 1);
  }
  { // main.js: the background save is switched on from the settings, every change waits for the file, the restore waits for what is on its way, the setting switches it
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), tr = fs.readFileSync(path.join(__dirname, '..', 'transfer.js'), 'utf8');
    ok('1.61.2: main.js switches the background save on from the settings (on unless backgroundSave is false) and the tickbox switches it at once', /const backgroundOn = s => !\(s && typeof s === 'object' && s\.backgroundSave === false\);\s*db\.bg = backgroundOn\(db\.getSettings\(\)\);/.test(main) && /db\.bg = backgroundOn\(db\.getSettings\(\)\); const s = await p;/.test(main));
    ok('...every change to the database answers when the file has it (add, update, remove, race, remove race, extra fields)', /'db:add', async \(_e, entity, item\) => \{ const row = db\.add\(entity, item\); await db\.saved\(\); return row; \}/.test(main) && /'db:update', async [^\n]*await db\.saved\(\); return row;/.test(main) && /'db:remove', async [^\n]*await db\.saved\(\);/.test(main) && /'session:save', async [^\n]*return db\.saveSessionAsync\(session, laps\)/.test(main) && /'session:remove', async [^\n]*await db\.saved\(\);/.test(main) && /'custom:add', async [^\n]*await db\.saved\(\);/.test(main) && /'custom:remove', async [^\n]*await db\.saved\(\);/.test(main) && /'custom:group', async [^\n]*await db\.saved\(\);/.test(main) && !/db\.saveSession\(/.test(main));
    ok('...a restore waits for a write that is on its way before it copies the file, and an import is saved at once (all or nothing)', /'backup:restore', async \(\) => \{[^]*?await db\.fileIdle\(\);[^]*?db\.replaceAll\(/.test(main) && /\(db\.saveNow \|\| db\.save\)\.call\(db\)/.test(tr) && /'transfer:apply', async \(\) => \{[^\n]*await db\.fileIdle\(\); if \(!pendingImport\) throw new Error\('No file chosen\.'\); const counts = transfer\.apply\(db, pendingImport\)/.test(main));
  }
  console.log(fails ? fails + ' DB TESTS FAILED' : 'ALL DB TESTS PASSED'); process.exit(fails ? 1 : 0);
};
asyncTests().catch(x => { console.error(x); process.exit(1); });

