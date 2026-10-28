const fs = require('fs'), os = require('os'), path = require('path');
const Database = require('../db.js'), B = require('../backup.js');
let fails = 0; const ok = (n, c) => { if (c) console.log('ok  ', n); else { console.log('FAIL', n); fails++; } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slt-bk-')), file = n => path.join(dir, n);

const a = new Database(file('a.json'));
const track = a.add('tracks', { name: 'Monza', lanes: 2 }), drv = a.add('drivers', { name: 'Alex' }), car = a.add('slotcars', { brand: 'NSR', model: 'GT40', lapsDriven: 0 });
a.add('layouts', { name: 'Main', widgets: [{ type: 'fuel' }] }); a.add('imagesets', { name: 'Flags', kind: 'flag', images: ['data:x'] }); a.add('customwidgets', { name: 'Mine', type: 'textlane', text: '{speed}' });
a.addCustomField('drivers', { label: 'Club', type: 'text' }); a.setSettings({ theme: 'light', rules: 'No pushing.' });
a.saveSession({ trackId: track.id, setupName: 'Friday', date: '2026-10-11', standings: [{ driverId: drv.id, carId: car.id }] }, [{ driverId: drv.id, carId: car.id, trackId: track.id, ms: 5000 }, { driverId: drv.id, carId: car.id, trackId: track.id, ms: 5100 }]);

const bundle = B.make(a.data, { version: '0.44.0' }), c = B.check(JSON.parse(JSON.stringify(bundle)));
ok('a backup is recognised and counted', c.ok && c.counts.tracks === 1 && c.counts.layouts === 1 && c.counts.sessions === 1 && c.laps === 2 && c.appVersion === '0.44.0' && !!c.date);
ok('...only kinds with items are listed', c.counts.penaltysystems === undefined);

const b = new Database(file('b.json')); b.add('drivers', { name: 'Someone else' }); b.add('tracks', { name: 'Old track' });
b.replaceAll(JSON.parse(JSON.stringify(bundle)).data);
ok('restoring replaces everything: nothing of the old data is left', b.list('drivers').length === 1 && b.list('drivers')[0].name === 'Alex' && b.list('tracks').length === 1 && b.list('tracks')[0].name === 'Monza');
ok('...layouts, picture sets, custom widgets, custom fields, settings, sessions and laps come back', b.list('layouts').length === 1 && b.list('imagesets')[0].images[0] === 'data:x' && b.list('customwidgets')[0].text === '{speed}' && b.listCustomFields('drivers')[0].label === 'Club' && b.getSettings().theme === 'light' && b.getSettings().rules === 'No pushing.' && b.list('sessions').length === 1 && b.data.laps.length === 2);
ok('...ids stay the same, so every link still works', b.list('tracks')[0].id === track.id && b.data.laps[0].driverId === drv.id && b.data.sessions[0].trackId === track.id);
ok('...and it is saved to the file', (r => r.drivers.length === 1 && r.drivers[0].name === 'Alex')(JSON.parse(fs.readFileSync(file('b.json'), 'utf8'))));
const b2 = new Database(file('b.json')); ok('...so opening the app again shows the restored data', b2.list('tracks')[0].name === 'Monza' && b2.data.laps.length === 2);

ok('the backup is a copy: changing the database afterwards does not change the file contents', (() => { const copy = JSON.parse(JSON.stringify(bundle)); const r = new Database(file('c.json')); r.replaceAll(copy.data); r.add('drivers', { name: 'New' }); return copy.data.drivers.length === 1; })());
const old = new Database(file('d.json')); old.replaceAll({ drivers: [{ id: 'x', name: 'Old', custom: {} }] });
ok('an older or partial backup is completed with defaults', old.list('tracks').length === 0 && old.getSettings().theme === 'dark' && old.list('drivers')[0].name === 'Old' && Array.isArray(old.data.laps));

ok('an item export is not accepted as a backup', !B.check({ app: 'slot-lap-timer-export', items: {} }).ok && /not a backup/.test(B.check({ items: {} }).error));
ok('rubbish is rejected', !B.check(null).ok && !B.check('x').ok && !B.check({ app: B.MARK }).ok && !B.check({ app: B.MARK, data: [] }).ok);
ok('a damaged list is rejected', !B.check({ app: B.MARK, data: { tracks: 'no' } }).ok && !B.check({ app: B.MARK, data: { settings: [] } }).ok);
ok('a backup made under the old name still restores', B.check({ app: 'slot-lap-timer-backup', data: {} }).ok && B.MARK === 'slotforge-timing-backup');
ok('an empty backup is allowed', B.check({ app: B.MARK, data: {} }).ok);
ok('the custom fields of our own backup pass the check', B.check(JSON.parse(JSON.stringify(bundle))).ok && a.data.customFields.drivers.length === 1);
const withFields = list => ({ app: B.MARK, data: { customFields: { drivers: list } } });
ok('a custom field whose id could add HTML to a screen is rejected', !B.check(withFields([{ id: 'a"><img src=x onerror=alert(1)>', label: 'Club', type: 'text' }])).ok && !B.check(withFields([{ label: 'No id' }])).ok && !B.check(withFields([{ id: 5 }])).ok);
ok('custom fields that are not lists of fields are rejected', !B.check({ app: B.MARK, data: { customFields: { drivers: 'x' } } }).ok && !B.check({ app: B.MARK, data: { customFields: { drivers: [null] } } }).ok && !B.check({ app: B.MARK, data: { customFields: [] } }).ok);
ok('...and no custom fields at all is fine', B.check(withFields([])).ok && B.check({ app: B.MARK, data: { customFields: {} } }).ok);
ok('a list with an item that is not an item is rejected', !B.check({ app: B.MARK, data: { racesetups: [null] } }).ok && !B.check({ app: B.MARK, data: { tracks: [5] } }).ok && !B.check({ app: B.MARK, data: { drivers: [[]] } }).ok && B.check({ app: B.MARK, data: { drivers: [] } }).ok);
{ // a restore that fails halfway changes nothing: not in memory, not in the file
  const r = new Database(file('r.json')); r.add('drivers', { name: 'Keep me' }); const kept = fs.readFileSync(file('r.json'), 'utf8');
  let msg = ''; try { r.replaceAll({ drivers: [{ id: 'x', name: 'New' }], racesetups: [null] }); } catch (x) { msg = x.message; }
  ok('a restore that cannot be used is refused and leaves the database as it was', msg !== '' && r.list('drivers').length === 1 && r.list('drivers')[0].name === 'Keep me' && fs.readFileSync(file('r.json'), 'utf8') === kept);
  ok('...and the database still works afterwards', (r.add('drivers', { name: 'Next' }), new Database(file('r.json')).list('drivers').length === 2));
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? fails + ' BACKUP TESTS FAILED' : 'ALL BACKUP TESTS PASSED'); process.exit(fails ? 1 : 0);
