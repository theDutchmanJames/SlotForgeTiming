'use strict';
const crypto = require('node:crypto');
const schema = require('./schema');
const { encode, object } = require('./sqlite-store');
const TrackDesign = require('./renderer/trackdesign');
const CarStats = require('./renderer/carstats');
const Cascades = require('./record-cascades');
const { COPY_FIELDS } = require('./paddock');

function entity(name, history = false) {
  if (!Object.hasOwn(schema, name) || !history && ['laps', 'sessions'].includes(name)) throw Error('Use a supported record type or a dedicated history command.');
}
function revision(value) { if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid expected revision.'); }
function expectMeta(s, id, expected) {
  revision(expected); if (s.revision('@meta', id) !== expected) throw Error('Metadata revision conflict. Reload before saving.');
}
function ensureMeta(s, id) { if (!s.get('@meta', id)) s.replace('@meta', id, {}); }

// Replace just one subtree, including its media. Other BLOBs are never read or rewritten.
function setPath(s, table, id, parts, value, remove = false) {
  const row = s.statement('SELECT shape FROM records WHERE entity=? AND id=?').get(table, id);
  if (!row || !parts.length || parts.some(p => typeof p !== 'string')) throw Error('Invalid record field path.');
  const shape = JSON.parse(row.shape); let node = shape;
  for (const key of parts.slice(0, -1)) {
    if (node[0] !== 'object') throw Error('Cannot edit through a non-object field.');
    let member = node[1].find(([k]) => k === key);
    if (!member) { if (remove) return; member = [key, ['object', []]]; node[1].push(member); }
    node = member[1];
  }
  if (node[0] !== 'object') { if (remove) return; throw Error('Cannot edit through a non-object field.'); }
  const key = parts.at(-1), index = node[1].findIndex(([k]) => k === key);
  if (remove && index < 0) return;
  const matches = encoded => { const path = JSON.parse(encoded); return parts.every((p, i) => path[i] === p); };
  const previous = s.statement('SELECT path FROM fields WHERE entity=? AND id=?').all(table, id).filter(r => matches(r.path)).map(r => r.path);
  const oldAssets = s.statement('SELECT path FROM assets WHERE entity=? AND id=?').all(table, id).filter(r => matches(r.path));
  for (const path of previous) s.statement('DELETE FROM fields WHERE entity=? AND id=? AND path=?').run(table, id, path);
  for (const a of oldAssets) s.statement('DELETE FROM assets WHERE entity=? AND id=? AND path=?').run(table, id, a.path);
  let leaves = [];
  if (remove) node[1].splice(index, 1);
  else {
    let wrapper = value; for (const part of parts.toReversed()) wrapper = Object.fromEntries([[part, wrapper]]);
    const encoded = encode(wrapper); leaves = encoded.leaves;
    let branch = encoded.shape; for (const part of parts) branch = branch[1].find(([k]) => k === part)[1];
    if (index < 0) node[1].push([key, branch]); else node[1][index][1] = branch;
    for (const [path, json] of leaves) s.statement('INSERT INTO fields VALUES(?,?,?,?)').run(table, id, path, json);
    for (const [path, a] of encoded.assets) s.statement('INSERT INTO assets VALUES(?,?,?,?,?,?,?)').run(table, id, path, a.mime, a.bytes, a.digest, a.original);
  }
  for (const path of new Set([...previous, ...leaves.map(l => l[0])]))
    s.statement('INSERT INTO field_versions VALUES(?,?,?,1) ON CONFLICT(entity,id,path) DO UPDATE SET version=version+1').run(table, id, path);
  s.statement('UPDATE records SET shape=? WHERE entity=? AND id=?').run(JSON.stringify(shape), table, id); s.touch(table, id);
}
function patchRecord(s, table, id, patch) { for (const [key, value] of Object.entries(patch)) if (key !== 'id') setPath(s, table, id, [key], value); }
function trackPatch(table, patch) { return table === 'tracks' && Object.hasOwn(patch, 'trackDesign') ? { ...patch, trackDesign: TrackDesign.validateSaved(patch.trackDesign) } : patch; }
function addRecord(s, { entity: table, item }) {
  entity(table); if (!object(item)) throw Error('Invalid record.');
  item = trackPatch(table, { ...item }); if (table === 'slotcars') delete item.paddock;
  const row = { custom: {}, ...item, id: crypto.randomUUID() }; s.insert(table, row);
  return { recordId: row.id, revision: s.revision(table, row.id) };
}
function updateRecord(s, { entity: table, recordId, patch, expectedRevision }) {
  entity(table); s.expect(table, recordId, expectedRevision); if (!object(patch)) throw Error('Invalid record patch.');
  patch = trackPatch(table, { ...patch }); delete patch.id;
  if (table === 'slotcars') {
    delete patch.paddock;
    if (s.get(table, recordId).value.paddock) for (const key of COPY_FIELDS) delete patch[key];
  }
  patchRecord(s, table, recordId, patch);
  return { recordId, revision: s.revision(table, recordId) };
}
function resetService(s, { carId, expectedRevision }) {
  s.expect('slotcars', carId, expectedRevision);
  const car = Object.fromEntries(['servicesDone', 'serviceDate'].map(k => [k, s.field('slotcars', carId, [k]).value]));
  patchRecord(s, 'slotcars', carId, { lapsSinceService: 0, servicesDone: CarStats.servicesOf(car) + 1, serviceDate: new Date(s.clock()).toISOString() });
  return { recordId: carId, revision: s.revision('slotcars', carId) };
}
function setSettings(s, { patch, expectedRevision }) {
  expectMeta(s, 'settings', expectedRevision); if (!object(patch)) throw Error('Invalid settings patch.');
  if(Object.hasOwn(patch,'tokenSessions'))patch={...patch,tokenSessions:require('./sqlite-finalization').tokenSettings(s,patch.tokenSessions)};
  ensureMeta(s, 'settings'); for(const [key,value] of Object.entries(patch))setPath(s,'@meta','settings',[key],value);
  return { revision: s.revision('@meta', 'settings') };
}
function definitions(s, table) { entity(table); return s.field('@meta', 'customFields', [table]).value || []; }
function group(table, value) { return typeof value === 'string' && schema[table].groups?.some(g => g.id === value) ? value : ''; }
function addCustomDefinition(s, { entity: table, field, expectedRevision }) {
  entity(table); expectMeta(s, 'customFields', expectedRevision);
  if (!object(field) || typeof field.label !== 'string' || !field.label.trim() || field.label.length > 200 || !['text', 'number', 'date', 'list'].includes(field.type)) throw Error('Invalid custom-field definition.');
  const options = field.type === 'list' ? field.options : [];
  if (!Array.isArray(options) || options.length > 500 || options.some(v => typeof v !== 'string' || !v || v.length > 1000) || field.type === 'list' && !options.length) throw Error('Invalid custom-field choices.');
  const list = definitions(s, table); let id;
  do { id = crypto.randomUUID().slice(0, 8); } while (list.some(f => f.id === id));
  const saved = { id, label: field.label, type: field.type, options, group: group(table, field.group) };
  ensureMeta(s, 'customFields'); setPath(s, '@meta', 'customFields', [table], [...list, saved]);
  return { field: saved, revision: s.revision('@meta', 'customFields') };
}
function setCustomGroup(s, { entity: table, fieldId, group: selected, expectedRevision }) {
  expectMeta(s, 'customFields', expectedRevision); const list = definitions(s, table), field = list.find(f => f.id === fieldId);
  if (!field) throw Error('Unknown extra field'); field.group = group(table, selected);
  setPath(s, '@meta', 'customFields', [table], list);
  return { field, revision: s.revision('@meta', 'customFields') };
}
function removeCustomDefinition(s, { entity: table, fieldId, expectedRevision }) {
  expectMeta(s, 'customFields', expectedRevision); const list = definitions(s, table);
  if (!list.some(f => f.id === fieldId)) throw Error('Unknown extra field');
  setPath(s, '@meta', 'customFields', [table], list.filter(f => f.id !== fieldId));
  for (const row of s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(table)) setPath(s, table, row.id, ['custom', fieldId], null, true);
  return { revision: s.revision('@meta', 'customFields') };
}
function setChampionshipAwards(s, { edits }) {
  if (!Array.isArray(edits) || !edits.length || edits.length > 10000 || new Set(edits.map(e => e.sessionId)).size !== edits.length) throw Error('Invalid championship award batch.');
  for (const edit of edits) {
    s.expect('sessions', edit.sessionId, edit.expectedRevision);
    if (!object(edit.champ)) throw Error('Invalid championship award.');
    setPath(s, 'sessions', edit.sessionId, ['champ'], edit.champ);
    const session=s.get('sessions',edit.sessionId,true).value;
    if(session.paddockDelivery?.transport==='engine'){require('./paddockrecords').revise({...s.paddockState(),laps:s.lapsFor(session.id)},session);s.replace('sessions',session.id,session);}
  }
  return { updated: edits.map(e => ({ sessionId: e.sessionId, revision: s.revision('sessions', e.sessionId) })) };
}

function removeRecord(s, { entity: table, recordId, expectedRevision }) {
  entity(table, true); if (table === 'sessions') return s.deleteSession({ sessionId: recordId, expectedRevision });
  s.expect(table, recordId, expectedRevision);
  const deps = new Set(Cascades.dependencies(table));
  const data = Object.fromEntries(Object.keys(schema).map(k => [k, []])), before = new Map();
  // Only dependency tables are read; images/audio remain separate and untouched.
  for (const dep of deps) {
    if (dep === 'laps') continue;
    data[dep] = s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(dep).map(r => s.get(dep, r.id, ['sessions','championships','multiclasssystems'].includes(dep)).value);
    before.set(dep, structuredClone(data[dep]));
  }
  const lapKey = { tracks: 'trackId', drivers: 'driverId', slotcars: 'carId', laps: 'id' }[table];
  if (lapKey) {
    const where = table === 'tracks' ? "l.trackId=? OR l.sessionId IN (SELECT id FROM fields WHERE entity='sessions' AND path='[\"trackId\"]' AND json=?)" : `l.${lapKey}=?`;
    const args = table === 'tracks' ? [recordId,JSON.stringify(recordId)] : [recordId];
    data.laps = s.statement(`SELECT l.id FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id WHERE ${where} ORDER BY r.ordinal`).all(...args).map(r => s.get('laps', r.id, true).value);
  }
  const state = s.paddockState(); data.paddock = state.paddock; const paddockBefore = JSON.stringify(data.paddock);
  Cascades.remove(data, table, recordId, predicate => {
    const removed = data.laps.filter(predicate);
    // Preserve original order and each lap's session-date fallback.
    s.counters(removed,new Map(data.sessions.map(session=>[session.id,session.date])),-1);
    for (const lap of removed) s.erase('laps', lap.id);
    data.laps = data.laps.filter(l => !predicate(l));
  });
  if (table === 'laps') s.erase('laps', recordId);
  for (const [dep, oldRows] of before) {
    const survivors = new Map(data[dep].map(row => [row.id, row]));
    for (const old of oldRows) {
      const next = survivors.get(old.id);
      if (!next) { s.erase(dep, old.id); continue; }
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        if (JSON.stringify(old[key]) === JSON.stringify(next[key])) continue;
        setPath(s, dep, old.id, [key], next[key], !Object.hasOwn(next, key));
      }
    }
  }
  s.savePaddock({ paddock: data.paddock }, paddockBefore); s.checkpoint('cascade-written');
  return { recordId, deleted: true };
}
const commands = { addRecord, updateRecord, removeRecord, resetService, setSettings, addCustomDefinition, setCustomGroup, removeCustomDefinition, setChampionshipAwards };
module.exports = { commands, setPath, patchRecord, expectMeta };
