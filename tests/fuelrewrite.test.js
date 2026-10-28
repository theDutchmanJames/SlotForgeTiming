// Fuel System rewrite (1.87.0): Track references, fixed base consumption and
// Push & Save ownership. These are deliberately focused checks of the joins
// between the Track form, Fuel System, engine and the words in the editor.
const schema = require('../schema.js');
const E = require('../renderer/engine.js');
const P = require('../renderer/pushsave.js');
const W = require('../renderer/systemwords.js');
let fails = 0;
const ok = (name, value) => { console.log((value ? 'ok   ' : 'FAIL ') + name); if (!value) fails++; };
const words = d => d.say.map(x => x.t).join('');

const track = { id: 'club', name: 'Club Circuit', targetLap: 8 };
const rule = { name: 'Club fuel', tank: 120, perLap: 2, rate: 10, paceSource: 'track', paceTrack: 'club', paceManual: '', empty: 'retire' };

ok('the Track database has an optional Fuel reference lap time', schema.tracks.fields.some(f => f.key === 'targetLap' && f.group === 'laps' && f.optional));
ok('the Fuel System has the three rewritten sections and has retired Fast and slow laps', schema.fuelrules.groups.map(g => g.id).join(',') === 'basics,pace,empty' && !schema.fuelrules.fields.some(f => ['targetLap', 'maxExtra', 'maxSaving'].includes(f.key)));
ok('the three pace choices are constant, Track and Manual', schema.fuelrules.fields.find(f => f.key === 'paceSource').options.map(x => x[0]).join(',') === 'constant,track,manual');

const F = E.fuelConfig({}, rule, track);
ok('a Track target resolves into the Fuel config but does not make ordinary fuel use vary', F.paceSource === 'track' && F.paceTarget === 8000 && F.target === 0 && E.fuelUse(F, 4000) === 2 && E.fuelUse(F, 16000) === 2);
ok('a Manual target resolves without needing a Track', E.fuelConfig({}, { ...rule, paceSource: 'manual', paceManual: 7.25 }, null).paceTarget === 7250);
ok('a Track with no target stays safe and has no pace reference', E.fuelConfig({}, rule, { ...track, targetLap: '' }).paceTarget === 0);

const old = E.fuelConfig({}, { tank: 20, perLap: 2, rate: 10, targetLap: 8, maxExtra: 25, maxSaving: 30, empty: 'retire' });
ok('an unmigrated legacy rule still keeps its old fast/slow calculation', old.legacyPace && old.target === 8000 && E.fuelUse(old, 4000) === 2.5);
const oldWords = W.describe('fuelrules', { name: 'Old club fuel', tank: 20, perLap: 2, rate: 10, targetLap: 8, maxExtra: 25, maxSaving: 30, legacyPace: true });
ok('a migrated legacy rule is identified in plain words rather than pretending it uses the new Push & Save hand-off', words(oldWords).includes('fast and slow lap fuel behaviour') && W.rail('fuelrules', { name: 'Old club fuel', tank: 20, perLap: 2, rate: 10, targetLap: 8, maxExtra: 25, maxSaving: 30, legacyPace: true }).pace.rail === 'Legacy pace · 8 seconds');

const R = E.createRace({ type: 'race', laps: 5, fuel: F, pushsave: P.clean({}), entries: [{ lane: 0, driverName: 'Alex', psRec: 5000 }] });
R.start(0); R.cross(0, 8000);
ok('Push & Save uses the selected Track reference rather than replacing it with a personal best', R.psRef(R.cars[0]).ms === 8000 && R.psRef(R.cars[0]).src === 'track');

const d = W.describe('fuelrules', rule, { track });
const rail = W.rail('fuelrules', rule, { track, defaults: { tank: 120, perLap: 2, rate: 10, paceSource: 'constant', paceTrack: '', paceManual: '', empty: 'retire' } });
ok('In plain words gives the full-tank and empty-to-full estimates plus the Track reference', words(d).includes('about 60 laps') && words(d).includes('about 12 seconds') && words(d).includes('Club Circuit at 8 seconds'));
ok('the rail has Basics, Pace reference and Empty tank', Object.keys(rail).join(',') === 'basics,pace,empty' && rail.pace.rail.includes('Club Circuit'));
ok('a selected Track without its reference is visibly incomplete', W.describe('fuelrules', rule, { track: { ...track, targetLap: '' } }).notes.pace.tone === 'warn');

if (fails) process.exitCode = 1;
