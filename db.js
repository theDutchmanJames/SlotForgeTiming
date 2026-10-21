// The database: one JSON file on the user's PC, kept behind this small interface
// so the storage underneath can change later without touching the rest of the app.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const schema = require('./schema');
const CarStats = require('./renderer/carstats.js'); // the slotcar statistics (1.30.0): which laps count since the last service

const VERSION = 1;

// Written whole to a file of its own, flushed to the disk, then renamed over the real file: a crash or a power cut leaves the earlier version, never half of a new one.
function writeAtomic(file, text) {
  const tmp = file + '.tmp', fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, text); try { fs.fsyncSync(fd); } catch { /* not every file system can flush */ } } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}

// The same, without making the program wait for the disk (1.60.0): the writing and the flushing are done by the system's helper threads. The race save is written like this every
// few seconds in a race: on an SD card (a Raspberry Pi) flushing to the disk can take a long time, and a program that waits for it makes the window stutter.
async function writeAtomicAsync(file, text) {
  const tmp = file + '.tmp', fh = await fs.promises.open(tmp, 'w');
  try { await fh.writeFile(text); try { await fh.sync(); } catch { /* not every file system can flush */ } } finally { await fh.close(); }
  await fs.promises.rename(tmp, file);
}

// 1.61.2: the text of the database file is made and written in pieces (a picture in an item can be megabytes). A big text is cut in slices of a million characters, and a slice never
// ends between the two halves of a character that is made of two (an emoji): the file would get a wrong character there.
const SLICE = 1000000;
function* slicesOf(s, size = SLICE) {
  for (let p = 0; p < s.length;) {
    let e = Math.min(p + size, s.length);
    if (e < s.length) { const c = s.charCodeAt(e - 1); if (c >= 0xD800 && c <= 0xDBFF) e++; }
    yield s.slice(p, e); p = e;
  }
}

// The pieces written one after the other, in the program's own time (the start, a restore, an import): the same file as writeAtomic gives for the pieces put together.
function writeChunksSync(file, chunks) {
  const tmp = file + '.tmp', fd = fs.openSync(tmp, 'w');
  try { for (const c of chunks) for (const s of slicesOf(c)) fs.writeSync(fd, s); try { fs.fsyncSync(fd); } catch { /* not every file system can flush */ } } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}

// The pieces written in the background, by the system's helper threads. The file gets a name of its own while it is written ('.bg.tmp'), so a save in the program's own time can never
// write into it. The last step, the rename over the old file, is done by the helper threads too (the system frees the old file's space in that call: about 65 ms for a file of 150 MB,
// too long for the core). Right before it the question 'is this still the newest?' (current()) is asked, and renaming(true/false) tells while the rename is on its way.
async function writeChunksAsync(file, chunks, current, renaming) {
  const tmp = file + '.bg.tmp', fh = await fs.promises.open(tmp, 'w');
  let done = false;
  try { for (const c of chunks) for (const s of slicesOf(c)) await fh.writeFile(s); try { await fh.sync(); } catch { /* not every file system can flush */ } done = true; } finally {
    await fh.close();
    if (!done) { try { fs.unlinkSync(tmp); } catch { /* nothing to clean up */ } }
  }
  if (!current()) { try { fs.unlinkSync(tmp); } catch { /* already gone */ } return false; }
  renaming(true);
  try { await fs.promises.rename(tmp, file); } finally { renaming(false); }
  return true;
}

// 1.61.0: a file that is written in the background, one write at a time. While one write is on its way only the newest text waits for its turn (the file only ever holds the latest
// state), and everyone who asked for a write that was replaced is answered when the newer text is on the disk (or told that it could not be written). Used for the settings file.
class LatestWriter {
  constructor(file) { this.file = file; this.running = false; this.next = null; this.idle = []; this.written = null; this.stats = { writes: 0, lastMs: 0, maxMs: 0, failed: 0 }; }
  pending() { return this.running || !!this.next; }
  // asking for the text that is already in the file, with nothing on its way, is answered at once (nothing is written)
  write(text) {
    if (!this.pending() && text === this.written) return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      const job = this.next || (this.next = { text, waiters: [] });
      job.text = text; job.waiters.push({ resolve, reject });
      if (!this.running) this.run();
    });
  }
  // at once, in the program's own time: for the moments nothing else is writing (the start of the program, a restore). Gives false when a write is on its way (then ask write() instead).
  writeNow(text) {
    if (this.pending()) return false;
    if (text !== this.written) { writeAtomic(this.file, text); this.written = text; }
    return true;
  }
  async run() {
    this.running = true;
    while (this.next) {
      const job = this.next; this.next = null; let err = null; const t0 = process.hrtime.bigint();
      try { await writeAtomicAsync(this.file, job.text); this.written = job.text; this.stats.writes++; const ms = Math.round(Number(process.hrtime.bigint() - t0) / 1e5) / 10; this.stats.lastMs = ms; this.stats.maxMs = Math.max(this.stats.maxMs, ms); }
      catch (x) { err = x || new Error('The file could not be written.'); this.stats.failed++; }
      job.waiters.forEach(w => (err ? w.reject(err) : w.resolve(true)));
    }
    this.running = false;
    this.idle.splice(0).forEach(r => r());
  }
  // resolves when nothing is being written or waiting to be
  whenIdle() { return this.pending() ? new Promise(r => this.idle.push(r)) : Promise.resolve(); }
}

// 1.61.0: about how many characters a piece of data takes in the file, found by adding up the lengths of its texts (a picture is one text: no copying, no turning it into text)
function approxSize(v) {
  if (typeof v === 'string') return v.length + 2;
  if (typeof v === 'number') return 8;
  if (typeof v === 'boolean') return 5;
  if (v === null || v === undefined) return 4;
  if (Array.isArray(v)) { let n = 2; for (let i = 0; i < v.length; i++) n += approxSize(v[i]) + 2; return n; }
  if (typeof v === 'object') { let n = 2; for (const k in v) n += k.length + 5 + approxSize(v[k]); return n; }
  return 0;
}

// The settings are kept in a file of their own next to the database (1.61.0), 'name.settings.json' for 'name.json': a setting is changed all over the program, and the database
// holds every picture and sound, so writing it whole for each change stalled the core of the program for a third of a second to more than a second.
const settingsFileOf = file => String(file).replace(/\.json$/, '') + '.settings.json';

class Database {
  constructor(file) {
    this.file = file;
    this.settingsPath = settingsFileOf(file);
    this.sw = new LatestWriter(this.settingsPath);
    this.stats = { saves: 0, lastMs: 0, maxMs: 0, textMs: 0, fileMs: 0, bytes: 0, failed: 0, background: false, bgSaves: 0, bgMaxMs: 0 }; // the full saves of the database file (the Performance report shows them)
    this.sizes = { at: 0, list: [] };
    this.onSave = null; // (1.61.1: the program may ask to be told about every full save: how long it took; main.js uses it for the Performance report)
    // 1.61.2: the text of each item as it stands in the file, so a save only makes the text again of what changed (an item is a row of a table: a driver, a slotcar, a lap ...). Whoever
    // changes an item must say so (touch, touchAll): an item that is not touched keeps the text it had, also in the file.
    this.texts = new WeakMap();
    this.bg = false; // true: a change is written in the background (main.js switches it on); false: in the program's own time, the change waits for the disk (the tests, and the choice 'off')
    this.fsave = { running: false, again: false, renaming: false, waiters: [], idle: [] };
    this.syncGen = 0; // counts the saves in the program's own time: a background write that started before one of them must not replace its file
    this.lastSave = null; // the answer of the newest change that is written in the background (saved() gives it)
    this.undo = new Map(); // how to take a finished race out again when it could not be written in the background (see saveSessionAsync)
    try { fs.unlinkSync(file + '.bg.tmp'); } catch { /* nothing was left by a stopped program */ }
    this.data = this.load();
    this.loadSettingsFile();
    this.ensure();
    this.save();
    try { this.sw.writeNow(this.settingsText()); } catch { /* the database file holds the settings too; every change is written to the settings file again */ }
  }
  // The settings file, when there is one, holds the latest settings (every change is written there before anything else could be older). No file yet (the first start of
  // 1.61.0): the settings of the database file are used, and the file is made. A file that cannot be understood is kept under another name, as for the database.
  loadSettingsFile() {
    let text;
    try { text = fs.readFileSync(this.settingsPath, 'utf8'); } catch (x) {
      if (x && x.code === 'ENOENT') return;
      throw new Error('The settings file cannot be read (' + (x && x.code || x) + '): ' + this.settingsPath + '. Close other programs that use it and start SlotForge Timing again. Nothing was changed.');
    }
    try { const s = JSON.parse(text); if (s && typeof s === 'object' && !Array.isArray(s)) { this.data.settings = s; this.sw.written = text; return; } } catch { /* damaged, see below */ }
    try { fs.copyFileSync(this.settingsPath, this.settingsPath.replace(/\.json$/, '') + '.damaged-' + Date.now() + '.json'); } catch (x) {
      throw new Error('The settings file is damaged and a copy of it could not be kept (' + (x && x.code || x) + '): ' + this.settingsPath + '. Nothing was changed.');
    }
  }
  settingsText() { return JSON.stringify(this.data.settings, null, 2); }
  load() {
    let text;
    try { text = fs.readFileSync(this.file, 'utf8'); } catch (x) {
      if (x && x.code === 'ENOENT') return {}; // no file yet: a fresh start
      // The file is there but cannot be read right now (locked by a virus scanner or a backup program, no permission): starting "fresh" would overwrite it with an empty database on the next save
      throw new Error('The database file cannot be read (' + (x && x.code || x) + '): ' + this.file + '. Close other programs that use it and start SlotForge Timing again. Nothing was changed.');
    }
    try { const d = JSON.parse(text); if (d && typeof d === 'object' && !Array.isArray(d)) return d; } catch { /* damaged, see below */ }
    // The file exists but cannot be understood: keep it (the app would otherwise overwrite it with an empty database) and start fresh
    try { fs.copyFileSync(this.file, this.file.replace(/\.json$/, '') + '.damaged-' + Date.now() + '.json'); } catch (x) {
      throw new Error('The database file is damaged and a copy of it could not be kept (' + (x && x.code || x) + '): ' + this.file + '. Nothing was changed.'); // (no copy, no overwrite)
    }
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
    // new in 1.30.0: the laps since the last service. A car from before that has had no service yet, so every lap it has driven counts.
    for (const c of d.slotcars) if (!Number.isFinite(c.lapsSinceService)) c.lapsSinceService = CarStats.sinceOf(c);
  }
  // 1.61.2: say that an item was changed in place (its text in the file has to be made again), or that anything may have been changed (every text is made again)
  touch(item) { this.texts.delete(item); } // (a WeakMap says 'no' to anything that is not an object)
  touchAll() { this.texts = new WeakMap(); }
  // The file as a list of pieces of text, which put together are exactly JSON.stringify(this.data, null, 2): the same layout as before, so every older version reads it. A table (a list
  // of items) is written item by item and the text of an item that was not touched is taken from the last time; everything else (the settings, the extra fields, the version) is made
  // again every time. This takes the core a few milliseconds when little changed, and as long as the old way when everything has to be made again.
  fileChunks() {
    const d = this.data, texts = this.texts, out = ['{'], isObj = x => x !== null && typeof x === 'object';
    let first = true, chars = 1;
    const push = s => { out.push(s); chars += s.length; };
    for (const key of Object.keys(d)) {
      const v = d[key];
      if (Array.isArray(v) && v.length) {
        push((first ? '\n  ' : ',\n  ') + JSON.stringify(key) + ': ['); first = false;
        let group = '';
        for (let i = 0; i < v.length; i++) {
          const item = v[i]; let t = texts.get(item);
          if (t === undefined) { t = (JSON.stringify(item, null, 2) ?? 'null').replace(/\n/g, '\n    '); if (isObj(item)) texts.set(item, t); }
          const piece = (i ? ',\n    ' : '\n    ') + t;
          if (piece.length > 200000) { if (group) { push(group); group = ''; } push(piece); } else { group += piece; if (group.length > 500000) { push(group); group = ''; } }
        }
        if (group) push(group);
        push('\n  ]');
      } else {
        const t = JSON.stringify(v, null, 2);
        if (t === undefined) continue; // (a value that has no text in JSON: left out, as JSON.stringify does)
        push((first ? '\n  ' : ',\n  ') + JSON.stringify(key) + ': ' + t.replace(/\n/g, '\n  ')); first = false;
      }
    }
    push(first ? '}' : '\n}');
    return { chunks: out, chars };
  }
  // What the program calls when it has changed something and does not say what: every text is made again, and the change is written (in the background when that is switched on)
  save() { this.touchAll(); return this.commit(); }
  // The same, in the program's own time whatever is switched on (an import, a restore): it throws when the disk will not take it, and nothing else is writing at the same time
  saveNow() { this.touchAll(); this.saveSync(); }
  // A change is done in memory; now it has to get to the file. In the background (bg): the answer is a promise that is kept when the file has it, or broken with the reason; saved() gives
  // the newest of these. In the program's own time: it is written before this returns, and a disk that will not take it is an error here.
  commit() {
    if (!this.bg) { this.lastSave = null; this.saveSync(); return null; }
    const p = this.saveBg(); p.catch(() => { /* whoever waits for saved() gets the reason; the others look at the failed count in the report */ }); this.lastSave = p; return p;
  }
  saved() { return this.lastSave || Promise.resolve(true); }
  saveSync() {
    this.syncGen++;
    const t0 = process.hrtime.bigint(), { chunks, chars } = this.fileChunks(), t1 = process.hrtime.bigint(), st = this.stats;
    try { writeChunksSync(this.file, chunks); } catch (x) { st.failed++; throw x; }
    const t2 = process.hrtime.bigint();
    // (a write in the background that is just renaming its older text over the file would put that older text back: it writes the newest state once more right after)
    if (this.fsave.renaming) this.fsave.again = true;
    this.noteSave({ text: t1 - t0, file: t2 - t1, chars, background: false });
  }
  // the numbers of a full save (the Performance report shows them). ms = how long the core was busy: all of it in the program's own time, only the making of the text in the background
  noteSave({ text, file, chars, background }) {
    const ms = d => Math.round(Number(d) / 1e5) / 10, st = this.stats;
    st.saves++; st.textMs = ms(text); st.fileMs = ms(file); st.lastMs = background ? st.textMs : ms(text + file); st.maxMs = Math.max(st.maxMs, st.lastMs); st.bytes = chars; st.background = background;
    if (background) { st.bgSaves++; st.bgMaxMs = Math.max(st.bgMaxMs, st.textMs); }
    if (this.onSave) { try { this.onSave({ ms: st.lastMs, textMs: st.textMs, fileMs: st.fileMs, bytes: st.bytes, background }); } catch { /* a note for the report must never stop a save */ } }
  }
  // In the background, one write at a time: while one is on its way, the changes that come are written together by the next one (the file only ever holds the newest state). The text is made
  // in one go at the start of a write (so the file is always one state of the database, never half of two), the writing is done by the system's helper threads.
  saveBg() {
    const f = this.fsave;
    return new Promise((resolve, reject) => { f.waiters.push({ resolve, reject }); f.again = true; if (!f.running) this.runSave(); });
  }
  async runSave() {
    const f = this.fsave; f.running = true;
    try {
      while (f.again) {
        f.again = false; const batch = f.waiters.splice(0), gen = this.syncGen, st = this.stats; let err = null;
        try {
          const t0 = process.hrtime.bigint(), { chunks, chars } = this.fileChunks(), t1 = process.hrtime.bigint();
          const renamed = await writeChunksAsync(this.file, chunks, () => this.syncGen === gen, on => { f.renaming = on; }), t2 = process.hrtime.bigint();
          if (renamed) this.noteSave({ text: t1 - t0, file: t2 - t1, chars, background: true });
        } catch (x) { err = x || new Error('The database file could not be written.'); st.failed++; console.error('[database]', err && err.message || err); }
        batch.forEach(w => (err ? w.reject(err) : w.resolve(true)));
      }
    } finally {
      f.running = false; f.idle.splice(0).forEach(r => r());
    }
  }
  filePending() { return this.fsave.running; } // (a change that asks for another round while a write is running is picked up by that same run)
  // resolves when no change is on its way to the database file
  fileIdle() { return this.filePending() ? new Promise(r => this.fsave.idle.push(r)) : Promise.resolve(); }
  check(entity) {
    if (!schema[entity]) throw new Error('Unknown item type: ' + entity);
  }
  list(entity) { this.check(entity); return this.data[entity]; }
  add(entity, item) {
    this.check(entity);
    const row = Object.assign({ custom: {} }, item, { id: crypto.randomUUID() });
    this.data[entity].push(row);
    this.commit();
    return row;
  }
  update(entity, id, patch) {
    this.check(entity);
    const row = this.data[entity].find(r => r.id === id);
    if (!row) throw new Error('Not found');
    Object.assign(row, patch, { id });
    this.touch(row);
    this.commit();
    return row;
  }
  // Laps are removed together with whatever they belong to; cars' laps-driven counters follow.
  removeLapsWhere(pred) {
    const gone = this.data.laps.filter(pred), sessionDate = new Map(this.data.sessions.map(s => [s.id, s.date]));
    this.data.laps = this.data.laps.filter(l => !pred(l));
    for (const l of gone) {
      const car = this.data.slotcars.find(c => c.id === l.carId);
      if (car) {
        if (CarStats.afterService(car, l, sessionDate.get(l.sessionId))) car.lapsSinceService = Math.max(0, CarStats.sinceOf(car) - 1); // (a lap from before the last service was not in that count)
        car.lapsDriven = Math.max(0, (car.lapsDriven || 0) - 1);
        this.touch(car);
      }
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
    if (entity === 'tracks') d.championships.forEach(c => (c.rounds || []).forEach(r => { if (r.track === id) r.track = ''; })); // (a round with no track uses the track of its race setup)
    if (entity === 'teams') d.championships.forEach(c => (c.roster || []).forEach(x => { if (x.team === id) x.team = ''; }));
    if (entity === 'drivers') d.championships.forEach(c => { if (Array.isArray(c.roster)) c.roster = c.roster.filter(x => x.driver !== id); });
    if (entity === 'fuelrules') d.racesetups.forEach(r => { if (r.fuelRules === id) r.fuelRules = ''; });
    if (entity === 'audiosets') d.racesetups.forEach(r => { if (r.audioSet === id) r.audioSet = ''; });
    if (entity === 'weathersystems') d.racesetups.forEach(r => { if (r.weather === id) r.weather = ''; });
    if (entity === 'tyrewearsystems') d.racesetups.forEach(r => { if (r.tyreWear === id) r.tyreWear = ''; });
    if (entity === 'safetycarsystems') d.racesetups.forEach(r => { if (r.safetyCar === id) r.safetyCar = ''; });
    if (entity === 'pushsavesystems') d.racesetups.forEach(r => { if (r.pushSave === id) r.pushSave = ''; });
    if (entity === 'rotationsetups') d.racesetups.forEach(r => { if (r.rotation === id) r.rotation = ''; });
    if (entity === 'penaltysystems') d.racesetups.forEach(r => { if (r.penaltySystem === id) r.penaltySystem = ''; });
    if (entity === 'damagesystems') d.racesetups.forEach(r => { if (r.damageSystem === id) r.damageSystem = ''; });
    if (entity === 'layouts') d.racesetups.forEach(r => { if (r.layout === id) r.layout = ''; if (r.layout2 === id) r.layout2 = ''; });
    if (entity === 'drivers') {
      d.teams.forEach(t => { if (Array.isArray(t.drivers)) t.drivers = t.drivers.filter(x => x !== id); });
      this.removeLapsWhere(l => l.driverId === id);
      d.sessions.forEach(s => { if (Array.isArray(s.standings)) s.standings = s.standings.filter(x => x.driverId !== id); });
    }
    if (entity === 'slotcars') {
      this.removeLapsWhere(l => l.carId === id);
      d.sessions.forEach(s => { if (Array.isArray(s.standings)) s.standings = s.standings.filter(x => x.carId !== id); });
    }
    d[entity] = d[entity].filter(r => r.id !== id);
    this.touchAll(); // (a removal changes items of other tables too: every text is made again, as before 1.61.2)
    this.commit();
  }
  // One finished session with all of its laps, saved in a single write.
  saveSession(session, laps) {
    const s = { ...session, id: crypto.randomUUID() }, before = new Map(), added = [];
    this.data.sessions.push(s);
    for (const l of laps) {
      const row = { ...l, id: crypto.randomUUID(), sessionId: s.id };
      this.data.laps.push(row); added.push(row);
      const car = this.data.slotcars.find(c => c.id === l.carId);
      if (car) {
        if (!before.has(car)) before.set(car, { since: car.lapsSinceService, driven: car.lapsDriven });
        if (CarStats.afterService(car, l, s.date)) car.lapsSinceService = CarStats.sinceOf(car) + 1; // (sinceOf is every lap driven for a car that was never counted that way)
        car.lapsDriven = (car.lapsDriven || 0) + 1;
        this.touch(car);
      }
    }
    // The disk would not take it (full, locked): take the session out again, so that saving it once more does not leave two copies, and the counters stay true
    const takeOut = () => {
      const gone = new Set(added);
      this.data.laps = this.data.laps.filter(l => !gone.has(l));
      this.data.sessions = this.data.sessions.filter(q => q !== s);
      for (const [car, b] of before) { car.lapsSinceService = b.since; car.lapsDriven = b.driven; this.touch(car); }
    };
    let p;
    try { p = this.commit(); } catch (x) { takeOut(); throw x; }
    if (p) this.undo.set(s.id, takeOut); // (written in the background: saveSessionAsync takes the session out when the write fails)
    return s.id;
  }
  // 1.61.2: the same, answered when the file has it. A write in the background that fails takes the session out again, as the write in the program's own time does.
  async saveSessionAsync(session, laps) {
    const id = this.saveSession(session, laps);
    try { await this.saved(); } catch (x) { const out = this.undo.get(id); this.undo.delete(id); if (out) out(); throw x; }
    this.undo.delete(id);
    return id;
  }
  removeSession(id) {
    this.removeLapsWhere(l => l.sessionId === id);
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    this.touchAll();
    this.commit();
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
    this.commit();
    return field;
  }
  setCustomFieldGroup(entity, id, group) {
    this.check(entity);
    const field = this.data.customFields[entity].find(f => f.id === id);
    if (!field) throw new Error('Unknown extra field');
    field.group = this.groupOf(entity, group);
    this.commit();
    return field;
  }
  removeCustomField(entity, id) {
    this.check(entity);
    this.data.customFields[entity] = this.data.customFields[entity].filter(f => f.id !== id);
    for (const row of this.data[entity]) if (row.custom) delete row.custom[id];
    this.touchAll();
    this.commit();
  }
  // Restoring a backup: everything is replaced by the data from the file (missing parts get their defaults).
  replaceAll(data) {
    const old = this.data;
    try { this.data = JSON.parse(JSON.stringify(data)); this.ensure(); this.saveNow(); this.putSettings(); } catch (x) { this.data = old; throw x; } // a file that cannot be used leaves what is there untouched
  }
  getSettings() { return this.data.settings; }
  // The settings file gets the settings as they are now: at once when nothing is being written to it, else after what is on its way (the newest text is the last one written).
  putSettings() {
    const text = this.settingsText();
    if (!this.sw.writeNow(text)) this.sw.write(text).catch(x => console.error('[settings]', x && x.message || x));
  }
  // A setting is changed in the settings file only (1.61.0), in the background: the program does not wait for the disk. The answer comes when the file is written (or with the
  // reason it could not be); the settings in memory are changed at once.
  setSettingsAsync(patch) {
    Object.assign(this.data.settings, patch);
    return this.sw.write(this.settingsText()).then(() => this.data.settings);
  }
  // The same, in the program's own time (tests, and anything that cannot wait): the settings file is written before this returns, unless a write is on its way, then after it.
  setSettings(patch) { Object.assign(this.data.settings, patch); this.putSettings(); return this.data.settings; }
  // A race that is running is kept in a file of its own (1.9.0), so that a crash or a power cut does not lose it: the race screen saves a snapshot every few seconds and the Home tab offers to carry on.
  // The file sits next to the database and is written whole, then renamed, so a cut in the middle leaves the earlier snapshot.
  resumeFile() { return path.join(path.dirname(this.file), 'race-resume.json'); }
  getResume() {
    // (a heat race that waits between two races has no engine, only the state of its heats: 1.24.0)
    try { const x = JSON.parse(fs.readFileSync(this.resumeFile(), 'utf8')); return x && x.v === 1 && x.race && (x.eng || (x.heat && x.heat.state)) ? x : null; } catch { return null; }
  }
  setResume(snap) {
    if (!snap || typeof snap !== 'object' || snap.v !== 1) return false;
    writeAtomic(this.resumeFile(), JSON.stringify(snap));
    return true;
  }
  clearResume() { try { fs.unlinkSync(this.resumeFile()); } catch { /* nothing was kept */ } return true; }
  // The same three, as the program uses them while a race is running (1.60.0): saving and clearing are done in the background, one at a time and in the order they came.
  // When a newer save or clear comes while one is being written, only the newest is done after it (the file only ever holds the latest state), and the ones it replaced
  // are answered when it is done. A save that was asked before a clear can never bring the file back after it.
  // The answer of a save is true when it was written (false: it is not a snapshot, or the writing failed).
  saveResumeAsync(snap) {
    if (!snap || typeof snap !== 'object' || snap.v !== 1) return Promise.resolve(false);
    let text; try { text = JSON.stringify(snap); } catch { return Promise.resolve(false); }
    return this.queueResume({ op: 'write', text });
  }
  clearResumeAsync() { return this.queueResume({ op: 'clear' }); }
  queueResume(job) {
    const q = this.rq || (this.rq = { running: false, next: null, waiters: [], idle: [], stats: { writes: 0, lastMs: 0, maxMs: 0, failed: 0 } });
    return new Promise(resolve => {
      if (q.next) { job.waiters = q.next.waiters; } else job.waiters = [];
      job.waiters.push(resolve); q.next = job;
      if (!q.running) this.runResume();
    });
  }
  async runResume() {
    const q = this.rq; q.running = true;
    while (q.next) {
      const job = q.next; q.next = null; let ok = true; const t0 = process.hrtime.bigint();
      try {
        if (job.op === 'write') { await writeAtomicAsync(this.resumeFile(), job.text); q.stats.writes++; const ms = Number(process.hrtime.bigint() - t0) / 1e6; q.stats.lastMs = Math.round(ms * 10) / 10; q.stats.maxMs = Math.max(q.stats.maxMs, q.stats.lastMs); }
        else { try { await fs.promises.unlink(this.resumeFile()); } catch { /* nothing was kept */ } }
      } catch (x) { ok = false; q.stats.failed++; console.error('[race save]', x && x.message || x); }
      job.waiters.forEach(r => r(job.op === 'write' ? ok : true));
    }
    q.running = false;
    q.idle.splice(0).forEach(r => r());
  }
  resumePending() { const q = this.rq; return !!q && (q.running || !!q.next); }
  // resolves when nothing is being written or waiting to be (a read of the file waits for this, so it never sees a file that is half way)
  resumeIdle() { return this.resumePending() ? new Promise(r => this.rq.idle.push(r)) : Promise.resolve(); }
  // 1.61.0: anything on its way to a file in the background (the race save, the settings file; since 1.61.2 the database file too): closing the program waits for it
  writesPending() { return this.resumePending() || this.sw.pending() || this.filePending(); }
  writesIdle() { return Promise.all([this.resumeIdle(), this.sw.whenIdle(), this.fileIdle()]).then(() => undefined); }
  // how the database goes (the Performance report shows it): the size of the file and the full saves, the settings file, and the biggest tables by a count of their texts (kept for a minute)
  dbStats() {
    const now = Date.now();
    if (now - this.sizes.at > 60000 || now < this.sizes.at) {
      const list = Object.keys(this.data).map(k => ({ name: k, bytes: approxSize(this.data[k]) })).filter(x => x.bytes > 0).sort((a, b) => b.bytes - a.bytes);
      this.sizes = { at: now, list, total: list.reduce((t, x) => t + x.bytes, 0) };
    }
    const w = this.sw.stats;
    return { file: { ...this.stats, on: !!this.bg }, settings: { bytes: this.sw.written ? this.sw.written.length : 0, writes: w.writes, lastMs: w.lastMs, maxMs: w.maxMs, failed: w.failed }, tables: this.sizes.list.slice(0, 5), total: this.sizes.total || 0 };
  }
  // how the saving of the race goes: the number of saves, how long the last and the slowest took, and how many failed (the Performance line shows it)
  resumeStats() { return this.rq ? { ...this.rq.stats } : { writes: 0, lastMs: 0, maxMs: 0, failed: 0 }; }
}

Database.writeAtomic = writeAtomic; Database.LatestWriter = LatestWriter; Database.approxSize = approxSize; Database.settingsFileOf = settingsFileOf; Database.slicesOf = slicesOf; // (the backups, exports and PDFs that main.js writes are written the same way)
module.exports = Database;
