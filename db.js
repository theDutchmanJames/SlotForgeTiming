// The database: one JSON file on the user's PC, kept behind this small interface
// so the storage underneath can change later without touching the rest of the app.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const schema = require('./schema');

const VERSION = 1;

class Database {
  constructor(file) {
    this.file = file;
    this.data = this.load();
    this.ensure();
    this.save();
  }
  load() {
    let text; try { text = fs.readFileSync(this.file, 'utf8'); } catch { return {}; } // no file yet: a fresh start
    try { const d = JSON.parse(text); if (d && typeof d === 'object' && !Array.isArray(d)) return d; } catch { /* damaged, see below */ }
    // The file exists but cannot be read: keep it (the app would otherwise overwrite it with an empty database) and start fresh
    try { fs.copyFileSync(this.file, this.file.replace(/\.json$/, '') + '.damaged-' + Date.now() + '.json'); } catch { /* nothing more to do */ }
    return {};
  }
  ensure() {
    const d = this.data;
    d.version = d.version || VERSION;
    d.settings = Object.assign({ theme: 'dark' }, d.settings);
    d.customFields = d.customFields || {};
    for (const name of Object.keys(schema)) {
      d[name] = d[name] || [];
      d.customFields[name] = d.customFields[name] || [];
    }
    // older race setups had their fuel settings inside the setup: turn them into a fuel rule
    for (const r of d.racesetups) {
      if (r.fuel === 'on' && !r.fuelRules) {
        const rule = { id: crypto.randomUUID(), custom: {}, name: `${r.name || 'Race setup'} fuel`, tank: r.fuelTank ?? 120, perLap: r.fuelPerLap ?? 1, targetLap: '', maxExtra: 25, maxSaving: 30, empty: r.fuelEmpty || 'retire', rate: r.fuelRate ?? 10 };
        d.fuelrules.push(rule); r.fuelRules = rule.id;
      }
      if (r.firstLap === undefined) r.firstLap = 'skip'; // new in 0.32: the lap from the grid is not counted
      ['fuel', 'fuelTank', 'fuelPerLap', 'fuelEmpty', 'fuelRate'].forEach(k => { delete r[k]; });
    }
  }
  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // write-then-rename so a crash can't corrupt the file
  }
  check(entity) {
    if (!schema[entity]) throw new Error('Unknown item type: ' + entity);
  }
  list(entity) { this.check(entity); return this.data[entity]; }
  add(entity, item) {
    this.check(entity);
    const row = Object.assign({ custom: {} }, item, { id: crypto.randomUUID() });
    this.data[entity].push(row);
    this.save();
    return row;
  }
  update(entity, id, patch) {
    this.check(entity);
    const row = this.data[entity].find(r => r.id === id);
    if (!row) throw new Error('Not found');
    Object.assign(row, patch, { id });
    this.save();
    return row;
  }
  // Laps are removed together with whatever they belong to; cars' laps-driven counters follow.
  removeLapsWhere(pred) {
    const gone = this.data.laps.filter(pred);
    this.data.laps = this.data.laps.filter(l => !pred(l));
    for (const l of gone) {
      const car = this.data.slotcars.find(c => c.id === l.carId);
      if (car) car.lapsDriven = Math.max(0, (car.lapsDriven || 0) - 1);
    }
  }
  linkedLaps(entity, id) {
    const key = { tracks: 'trackId', drivers: 'driverId', slotcars: 'carId' }[entity];
    return key ? this.data.laps.filter(l => l[key] === id).length : 0;
  }
  remove(entity, id) {
    this.check(entity);
    const d = this.data;
    if (entity === 'tracks') {
      this.removeLapsWhere(l => l.trackId === id);
      d.sessions = d.sessions.filter(s => s.trackId !== id);
      d.racesetups.forEach(r => { if (r.track === id) r.track = ''; });
    }
    if (entity === 'fuelrules') d.racesetups.forEach(r => { if (r.fuelRules === id) r.fuelRules = ''; });
    if (entity === 'audiosets') d.racesetups.forEach(r => { if (r.audioSet === id) r.audioSet = ''; });
    if (entity === 'weathersystems') d.racesetups.forEach(r => { if (r.weather === id) r.weather = ''; });
    if (entity === 'rotationsetups') d.racesetups.forEach(r => { if (r.rotation === id) r.rotation = ''; });
    if (entity === 'penaltysystems') d.racesetups.forEach(r => { if (r.penaltySystem === id) r.penaltySystem = ''; });
    if (entity === 'damagesystems') d.racesetups.forEach(r => { if (r.damageSystem === id) r.damageSystem = ''; });
    if (entity === 'layouts') d.racesetups.forEach(r => { if (r.layout === id) r.layout = ''; if (r.layout2 === id) r.layout2 = ''; });
    if (entity === 'drivers') {
      d.teams.forEach(t => { if (Array.isArray(t.drivers)) t.drivers = t.drivers.filter(x => x !== id); });
      this.removeLapsWhere(l => l.driverId === id);
      d.sessions.forEach(s => { s.standings = s.standings.filter(x => x.driverId !== id); });
    }
    if (entity === 'slotcars') {
      this.removeLapsWhere(l => l.carId === id);
      d.sessions.forEach(s => { s.standings = s.standings.filter(x => x.carId !== id); });
    }
    d[entity] = d[entity].filter(r => r.id !== id);
    this.save();
  }
  // One finished session with all of its laps, saved in a single write.
  saveSession(session, laps) {
    const s = { ...session, id: crypto.randomUUID() };
    this.data.sessions.push(s);
    for (const l of laps) {
      this.data.laps.push({ ...l, id: crypto.randomUUID(), sessionId: s.id });
      const car = this.data.slotcars.find(c => c.id === l.carId);
      if (car) car.lapsDriven = (car.lapsDriven || 0) + 1;
    }
    this.save();
    return s.id;
  }
  removeSession(id) {
    this.removeLapsWhere(l => l.sessionId === id);
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    this.save();
  }
  listCustomFields(entity) { this.check(entity); return this.data.customFields[entity]; }
  // The group of the form a field is shown in: one of the groups of that form, or '' for More (also when the group is not known).
  groupOf(entity, group) {
    return typeof group === 'string' && (schema[entity].groups || []).some(g => g.id === group) ? group : '';
  }
  addCustomField(entity, { label, type, options, group }) {
    this.check(entity);
    const field = { id: crypto.randomUUID().slice(0, 8), label, type, options: options || [], group: this.groupOf(entity, group) };
    this.data.customFields[entity].push(field);
    this.save();
    return field;
  }
  setCustomFieldGroup(entity, id, group) {
    this.check(entity);
    const field = this.data.customFields[entity].find(f => f.id === id);
    if (!field) throw new Error('Unknown extra field');
    field.group = this.groupOf(entity, group);
    this.save();
    return field;
  }
  removeCustomField(entity, id) {
    this.check(entity);
    this.data.customFields[entity] = this.data.customFields[entity].filter(f => f.id !== id);
    for (const row of this.data[entity]) if (row.custom) delete row.custom[id];
    this.save();
  }
  // Restoring a backup: everything is replaced by the data from the file (missing parts get their defaults).
  replaceAll(data) {
    const old = this.data;
    try { this.data = JSON.parse(JSON.stringify(data)); this.ensure(); this.save(); } catch (x) { this.data = old; throw x; } // a file that cannot be used leaves what is there untouched
  }
  getSettings() { return this.data.settings; }
  setSettings(patch) { Object.assign(this.data.settings, patch); this.save(); return this.data.settings; }
  // A race that is running is kept in a file of its own (1.9.0), so that a crash or a power cut does not lose it: the race screen saves a snapshot every few seconds and the Home tab offers to carry on.
  // The file sits next to the database and is written whole, then renamed, so a cut in the middle leaves the earlier snapshot.
  resumeFile() { return path.join(path.dirname(this.file), 'race-resume.json'); }
  getResume() {
    try { const x = JSON.parse(fs.readFileSync(this.resumeFile(), 'utf8')); return x && x.v === 1 && x.eng && x.race ? x : null; } catch { return null; }
  }
  setResume(snap) {
    if (!snap || typeof snap !== 'object' || snap.v !== 1) return false;
    const tmp = this.resumeFile() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(snap));
    fs.renameSync(tmp, this.resumeFile());
    return true;
  }
  clearResume() { try { fs.unlinkSync(this.resumeFile()); } catch { /* nothing was kept */ } return true; }
}

module.exports = Database;
