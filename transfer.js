// Export and import of items as a file: pick items (and what they use), write them to a file, add them to another database as copies.
// Pure functions over the database's data object, so they can be tested without Electron.
const crypto = require('crypto');
const schema = require('./schema');

const FORMAT = 'slotforge-timing-export', OLD_FORMATS = ['slot-lap-timer-export'], FILE_VERSION = 1; // exports made before the rename are still accepted
// the order rows are added in on import (what is used comes before what uses it)
const ORDER = ['tracks', 'slotcars', 'drivers', 'teams', 'fuelrules', 'penaltysystems', 'damagesystems', 'tyrewearsystems', 'weathersystems', 'rotationsetups', 'imagesets', 'audiosets', 'customwidgets', 'rowdesigns', 'layouts', 'racesetups', 'sessions', 'laps'];
const clone = x => JSON.parse(JSON.stringify(x));
// the group of a form that an extra field is shown in: a group of that form in this version, otherwise '' (More)
const groupOf = (e, g) => typeof g === 'string' && (schema[e].groups || []).some(x => x.id === g) ? g : '';

// Every link from one row to another: { entity: what it points to, get(), set(id) }
function refsOf(entity, row) {
  const out = [], field = (key, target) => { if (row[key] !== undefined && row[key] !== '' && row[key] !== null) out.push({ entity: target, get: () => row[key], set: v => { row[key] = v; } }); };
  const widgets = (list, withDesign) => (list || []).forEach(w => {
    const o = w && w.opt; if (!o) return;
    if (o.imageSet) out.push({ entity: 'imagesets', get: () => o.imageSet, set: v => { o.imageSet = v; } });
    if (withDesign && o.design) out.push({ entity: 'rowdesigns', get: () => o.design, set: v => { o.design = v; } });
  });
  if (entity === 'racesetups') { field('track', 'tracks'); field('layout', 'layouts'); field('layout2', 'layouts'); field('penaltySystem', 'penaltysystems'); field('damageSystem', 'damagesystems'); field('fuelRules', 'fuelrules'); field('tyreWear', 'tyrewearsystems'); field('weather', 'weathersystems'); field('rotation', 'rotationsetups'); field('audioSet', 'audiosets'); }
  if (entity === 'audiosets') Object.values(row.calls || {}).forEach(c => ((c && c.lines) || []).forEach(l => { if (l && l.only && l.only.driver) out.push({ entity: 'drivers', get: () => l.only.driver, set: v => { l.only.driver = v || 'gone'; } }); })); // ("only for this driver" in a sentence; a driver that did not come along stays a name nobody has, so the sentence is not said for everybody)
  if (entity === 'teams') (Array.isArray(row.drivers) ? row.drivers : []).forEach((id, i) => { if (id) out.push({ entity: 'drivers', get: () => row.drivers[i], set: v => { row.drivers[i] = v; } }); }); // (a driver that did not come along leaves the team)
  if (entity === 'layouts') widgets(row.widgets, true);
  if (entity === 'rowdesigns') widgets(row.widgets, false);
  if (entity === 'sessions') { field('trackId', 'tracks'); (row.standings || []).forEach(s => { if (s.driverId) out.push({ entity: 'drivers', get: () => s.driverId, set: v => { s.driverId = v; } }); if (s.carId) out.push({ entity: 'slotcars', get: () => s.carId, set: v => { s.carId = v; } }); if (s.teamId) out.push({ entity: 'teams', get: () => s.teamId, set: v => { s.teamId = v; } }); }); }
  if (entity === 'laps') { field('sessionId', 'sessions'); field('trackId', 'tracks'); field('driverId', 'drivers'); field('carId', 'slotcars'); field('teamId', 'teams'); } // (the laps of a team race carry the team: the results of that team are made of them)
  return out;
}

// picks: { entity: [ids] }. withDeps: also take what the picked items use. Sessions always take theirs and their laps.
function collect(data, picks, withDeps = true, info = {}) {
  const have = {}, queue = [];
  const take = (entity, row, deps) => { const s = have[entity] || (have[entity] = new Map()); if (s.has(row.id)) return; s.set(row.id, row); queue.push([entity, row, deps]); };
  Object.entries(picks || {}).forEach(([entity, ids]) => { if (!schema[entity] || !data[entity]) return; (ids || []).forEach(id => { const row = data[entity].find(r => r.id === id); if (row) take(entity, row, withDeps || entity === 'sessions'); }); });
  while (queue.length) {
    const [entity, row, deps] = queue.shift();
    if (entity === 'sessions') (data.laps || []).filter(l => l.sessionId === row.id).forEach(l => take('laps', l, true));
    if (!deps) continue;
    refsOf(entity, row).forEach(r => { const t = (data[r.entity] || []).find(x => x.id === r.get()); if (t) take(r.entity, t, true); });
  }
  const items = {}, customFields = {};
  ORDER.forEach(e => {
    if (!have[e]) return;
    items[e] = [...have[e].values()].map(clone);
    const used = new Set(); items[e].forEach(r => Object.keys(r.custom || {}).forEach(k => used.add(k)));
    const defs = ((data.customFields || {})[e] || []).filter(f => used.has(f.id));
    if (defs.length) customFields[e] = clone(defs);
  });
  return { format: FORMAT, fileVersion: FILE_VERSION, app: info.app || 'SlotForge Timing', appVersion: info.version || '', exported: info.date || new Date().toISOString(), items, customFields };
}

// What the picked items use (transitively), apart from the picked items themselves: { entity: [{ id, required }] }. Laps are not listed (they belong to their session).
// required: a picked session cannot do without it.
function dependencies(data, picks) {
  const all = collect(data, picks, true).items, forced = collect(data, { sessions: (picks && picks.sessions) || [] }, false).items, out = {};
  ORDER.forEach(e => {
    if (e === 'laps' || !all[e]) return;
    const mine = new Set((picks && picks[e]) || []), need = new Set((forced[e] || []).map(r => r.id)), list = all[e].filter(r => !mine.has(r.id)).map(r => ({ id: r.id, required: need.has(r.id) }));
    if (list.length) out[e] = list;
  });
  return out;
}

const titleOf = (entity, row) => { const k = schema[entity] && schema[entity].title; return k ? k.map(x => row[x]).filter(x => x !== undefined && x !== '').join(' ') : ''; };

// is this a file of ours? -> { ok, error, summary: { entity: { count, names } } }
function check(bundle) {
  if (!bundle || typeof bundle !== 'object' || bundle.format !== FORMAT && !OLD_FORMATS.includes(bundle.format)) return { ok: false, error: 'This is not an export file from this app.' };
  if (!(bundle.fileVersion <= FILE_VERSION)) return { ok: false, error: 'This file comes from a newer version of the app. Update the app first.' };
  if (!bundle.items || typeof bundle.items !== 'object') return { ok: false, error: 'The file is empty.' };
  const summary = {};
  for (const e of ORDER) { const list = bundle.items[e]; if (list === undefined) continue; if (!Array.isArray(list) || list.some(r => !r || typeof r !== 'object' || !r.id)) return { ok: false, error: `The file is damaged (${e}).` }; if (e === 'sessions' && list.some(r => !Array.isArray(r.standings))) return { ok: false, error: 'The file is damaged (sessions without results).' }; if (list.length) summary[e] = { count: list.length, names: list.slice(0, 12).map(r => titleOf(e, r)) }; }
  return Object.keys(summary).length ? { ok: true, summary } : { ok: false, error: 'The file has nothing to import.' };
}

// Adds everything in the bundle to the database as new copies (new ids; links between the copies are kept; a clash of names gets "(imported)").
// All or nothing: a damaged file that fails halfway leaves the database as it was.
function apply(db, bundle) {
  const c = check(bundle); if (!c.ok) throw new Error(c.error);
  const d = db.data, map = {}, counts = {}, had = {};
  ORDER.forEach(e => { map[e] = {}; had[e] = d[e].length; });
  const hadFields = Object.entries(d.customFields).map(([e, list]) => [e, list.length]);
  const rollback = () => { ORDER.forEach(e => { d[e].length = had[e]; }); hadFields.forEach(([e, n]) => { d.customFields[e].length = n; }); };
  try {
    const fieldMap = {}; // custom field ids of the file -> ours
    Object.entries(bundle.customFields || {}).forEach(([e, defs]) => {
      if (!schema[e] || !Array.isArray(defs)) return;
      defs.forEach(f => {
        if (!f || typeof f !== 'object') return;
        const mine = d.customFields[e].find(x => x.label === f.label && x.type === f.type) || (d.customFields[e].push({ id: crypto.randomUUID().slice(0, 8), label: f.label, type: f.type, options: clone(f.options || []), group: groupOf(e, f.group) }), d.customFields[e][d.customFields[e].length - 1]);
        (fieldMap[e] = fieldMap[e] || {})[f.id] = mine.id;
      });
    });
    for (const e of ORDER) {
      for (const src of bundle.items[e] || []) {
        const row = clone(src); const oldId = row.id; row.id = crypto.randomUUID(); map[e][oldId] = row.id;
        refsOf(e, row).forEach(r => r.set(map[r.entity] && map[r.entity][r.get()] !== undefined ? map[r.entity][r.get()] : ''));
        if (e === 'teams') row.drivers = (Array.isArray(row.drivers) ? row.drivers : []).filter(Boolean);
        if (row.custom) { const m = {}; Object.entries(row.custom).forEach(([k, v]) => { if (fieldMap[e] && fieldMap[e][k]) m[fieldMap[e][k]] = v; }); row.custom = m; } else row.custom = {};
        // a clash of titles (the whole title: a car is brand + make + model) is marked on the last part that has text
        const parts = e === 'sessions' || e === 'laps' ? [] : (schema[e].title || []).filter(k => typeof row[k] === 'string' && row[k] !== ''), title = parts.length ? titleOf(e, row) : '';
        if (title && d[e].some(x => titleOf(e, x) === title)) row[parts[parts.length - 1]] += ' (imported)';
        d[e].push(row); counts[e] = (counts[e] || 0) + 1;
      }
    }
  } catch { rollback(); throw new Error('Nothing was imported: the file is damaged.'); }
  try { db.save(); } catch (x) { rollback(); throw x; }
  if (counts.laps === undefined) delete counts.laps;
  return counts;
}

module.exports = { FORMAT, collect, dependencies, check, apply, titleOf };
