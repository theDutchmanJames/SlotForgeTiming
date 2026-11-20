'use strict';
// 2.4.0 review: the app shell, Home and the Database pages. The More menu of a sheet keeps working when the list is drawn again, asks before it
// drops unsaved changes, a Paddock car's form opens, Home offers no retired driver, Duplicate keeps the extra fields, a delete names what uses
// the record, the avatars of Home follow a change, App Settings leaves a page that was left, a class without a name, the setup guide's cars,
// and a phone's command that failed.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { code, has } = require('./source.cjs');

test('F1: the More menu of a sheet hands the whole record over, so a list drawn again does not drop Track design and Duplicate', () => {
  const db = code('renderer/database.js'),
    mgr = code('renderer/database/manager.js');
  assert(has(db, 'return manager.act(act, item, item);'));
  assert(has(mgr, 'const gxAct = async (act, it, given = null) => {'));
  assert(has(mgr, 'const track = given || (await fullItem(it.id));'));
  assert(has(mgr, 'const full = given || (await fullItem(it.id));'));
});

test('F5: the More menu of a sheet asks before it closes a form with unsaved changes', () => {
  const db = code('renderer/database.js');
  assert(has(db, 'const sheetNow = () => JSON.stringify([formValues(), members, imgs, gal]);'));
  assert(has(db, 'if (sheet) sheetStart = sheetNow();'));
  assert(has(db, 'sheetStart !== null && sheetNow() !== sheetStart && !(await Dialog.confirm('));
  // the question comes before the form is closed
  const at = db.indexOf('sheetNow() !== sheetStart'),
    close = db.indexOf('dlg.close();', at);
  assert(at > 0 && close > at);
});

test('F2: the form of a Paddock car puts its specifications in the rail form (no .formgrid there)', () => {
  const db = code('renderer/database.js');
  assert(has(db, "const into = byId('frm').querySelector('.rsmain') || byId('frm').querySelector('.formgrid');"));
  assert(has(db, 'if (into) into.prepend(holder);'));
  assert(!has(db, "byId('frm').querySelector('.formgrid').prepend(holder);"));
  assert(has(code('renderer/railform.js'), '<div class="rsmain">'), 'the rail form has the place');
});

test('F3: Home offers no retired driver in a race of single drivers, and takes one off a lane', () => {
  const home = code('renderer/landing.js');
  assert(has(home, 'const laneDrivers = allowRival ? allDrivers.filter(d => !d.retired) : drivers;'));
  assert(has(home, 'driverId: known(allDrivers.filter(d => !d.retired), r.driverId),'));
});

test('F4: Duplicate keeps the extra fields, the track pieces and what is not a field of the form', () => {
  const db = code('renderer/database.js');
  assert(has(db, 'const customStart = (item ? item.custom : preset && preset.custom) || {};'));
  assert(has(db, 'custom = { ...customStart };'));
  assert(has(db, '(item && item.lengthPieces) || (!item && preset && preset.lengthPieces) || []'));
  assert(has(db, 'api.add(e, { ...presetExtra(), ...built, custom })'));
  const G = code('renderer/database/garageactions.js');
  assert(has(G, 'if (full && full.custom) out.custom = { ...full.custom };'), 'the copy carries them');
});

test('F6: the delete question names the race setups or championships that use the record', () => {
  const mgr = code('renderer/database/manager.js');
  assert(has(mgr, 'const usedText = list => {'));
  assert(has(mgr, '${extra}${usedText([it])}'));
  assert(has(mgr, '${extra}${usedText(list)}${retire}'));
  assert(has(mgr, '(state.refs[s.used.entity] || []).filter(r => r && ids.has(r[s.used.key]))'));
  assert(has(mgr, '(r.sessions || []).some(x => ids.has(x.setup))'));
});

test('F7: the avatars of Home are read again after a driver is saved, and paint into the Home on screen', () => {
  const home = code('renderer/landing.js'),
    db = code('renderer/database.js');
  assert(has(home, '.catch(() => homeAvatarCache.delete(id));'));
  assert(!has(home, 'if (pic && draw === homeDraw)'));
  assert(has(db, "if (e === 'drivers' && item && typeof homeAvatarCache !== 'undefined') homeAvatarCache.delete(item.id);"));
});

test('F9: a page of App Settings that was left while it read the storage does not wire the controls of the next one', () => {
  const app = code('renderer/app.js');
  const at = app.indexOf('async function renderGeneralSettings'),
    part = app.slice(at, at + 2000);
  assert(
    has(part, "const storage = api.storageStatus ? await api.storageStatus() : { backend: 'json' }; if (box.isConnected === false) return;")
  );
});

test('F10: a race class without a name breaks neither Create class nor the shared cars on Home', () => {
  assert(
    has(code('renderer/database.js'), "list.find(c => String(c.name || '').trim().toLocaleLowerCase() === label.toLocaleLowerCase())")
  );
  const home = code('renderer/landing.js');
  assert(
    has(home, "classDefs.find(x => String(x.name || '').trim().toLocaleLowerCase() === (c.raceClass || '').trim().toLocaleLowerCase())")
  );
  assert(!has(home, 'x.name.trim()') && !has(home, 'c.name.trim()'));
});

test('F11: the setup guide keeps the car of every driver at that driver, also when one was deleted meanwhile', () => {
  const w = code('renderer/setupwizard.js');
  assert(has(w, 'return d ? { ...d, _k: k } : null;'));
  assert(has(w, 'data-wzcarpick="${d._k}"'));
  assert(has(w, 'data-wzcar="${d._k}"'));
  assert(has(w, 'p.carIds[d._k]'));
  const W = require('../renderer/setupwizard.js');
  // the rows a race starts with: a driver and the car kept at the same place
  assert.deepEqual(W.assignmentRows(3, ['a', 'b', 'c'], ['x', '', 'z']), [
    { driverId: 'a', carId: 'x' },
    { driverId: 'b', carId: '' },
    { driverId: 'c', carId: 'z' }
  ]);
});

test('F13: a command from a phone that did not reach the timing computer is said', () => {
  const w = code('renderer/webapi.js');
  assert(has(w, "else if (typeof Dialog !== 'undefined') Dialog.alert('This did not reach the timing computer: '"));
});
