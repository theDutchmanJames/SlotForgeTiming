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
console.log(fails ? fails + ' DB TESTS FAILED' : 'ALL DB TESTS PASSED'); process.exit(fails ? 1 : 0);
