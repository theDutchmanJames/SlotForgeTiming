'use strict';

// Application boundary during the storage conversion. Legacy full-list reads
// remain explicit; writes still use the established JSON domain operations.
// This is not a second database, transaction engine or network patch endpoint.
class DataRepository {
  constructor(db, { getResourceStore = () => null } = {}) {
    this.db = db;
    this.getResourceStore = getResourceStore;
  }
  list(entity) {
    return this.db.list(entity);
  }
  choices(entity) {
    return this.db.list(entity).map(r => ({ id: r.id, name: r.name || 'Untitled' }));
  }
  transferChoices(entity) {
    const keys = entity === 'sessions' ? ['setupName', 'date'] : require('./schema')[entity]?.title;
    if (!keys) throw Error('Unknown item type.');
    return this.db.list(entity).map(r => ({ id: r.id, ...Object.fromEntries(keys.filter(k => r[k] !== undefined).map(k => [k, r[k]])) }));
  }
  homeStatistics(options) {
    return require('./dashboard-read').home(require('./dashboard-read').jsonSource(this.db), options);
  }
  homeSessions(options) {
    return require('./dashboard-read').navigation(require('./dashboard-read').jsonSource(this.db), options);
  }
  raceSeason(options) {
    const S = require('./season-read');
    return S.read(S.jsonSource(this.db), options);
  }
  raceCharts(ids) {
    return require('./display-read').charts(require('./race-read').jsonSource(this.db), ids);
  }
  raceInputs(options) {
    return require('./race-read').read(require('./race-read').jsonSource(this.db), options);
  }
  editorRead(kind, entity, value) {
    const history = require('./setup-history-read');
    return history.KINDS.includes(kind)
      ? history.json(this.db, kind, entity, value)
      : require('./editor-read').read(require('./editor-read').jsonSource(this.db), kind, entity, value);
  }
  referencePage(entity, options) {
    return require('./reference-read').jsonPage(this.db, entity, options);
  }
  referenceDetails(entity, ids, revision) {
    return require('./reference-read').jsonDetails(this.db, entity, ids, revision);
  }
  historyReferences(rows) {
    return require('./history-read').jsonReferences(this.db, rows);
  }
  historyPage(pool, options) {
    return require('./history-read').jsonPage(this.db, pool, options);
  }
  historySession(pool, id, options) {
    return require('./history-read').jsonSession(this.db, pool, id, options);
  }
  carStatistics(id) {
    return require('./history-read').jsonCar(this.db, id);
  }
  driverProgress(id) {
    return require('./driver-progress').jsonDriver(this.db, id);
  }
  catalogue(entity, options) {
    return require('./catalogue-read').jsonPage(this.db, entity, options);
  }
  cataloguePicture(entity, id, revision) {
    return require('./catalogue-read').jsonPicture(this.db, entity, id, revision);
  }
  get(entity, id) {
    return this.db.getRecord(entity, id);
  }
  localCars() {
    return this.db.localCarSummaries();
  }
  linkedLaps(entity, id) {
    return this.db.linkedLaps(entity, id);
  }
  customFields(entity) {
    return this.db.listCustomFields(entity);
  }
  affectedSharedSessions(entity, id) {
    return require('./shared-library-cascade').json(this.db.data, entity, id);
  }
  async attachSharedHistory(input) {
    const old = this.db.data.sessions.find(s => s.id === input.sessionId),
      next = require('./shared-library-adopted-history').attach(
        old,
        this.db.data.laps.filter(l => l.sessionId === input.sessionId),
        input
      );
    const index = this.db.data.sessions.indexOf(old);
    this.db.data.sessions[index] = next;
    this.db.touch(next);
    try {
      await this.db.commit();
      await this.db.saved();
    } catch (e) {
      this.db.data.sessions[index] = old;
      this.db.touch(old);
      throw e;
    }
  }
  async importSharedPrepared({ items }) {
    const before = Object.fromEntries(require('./transfer').ORDER.map(e => [e, this.db.data[e].length])),
      fields = this.db.data.customFields;
    try {
      require('./shared-library-import').applyPrivate(this.db.data, items);
      await this.db.commit();
      await this.db.saved();
    } catch (e) {
      for (const [key, length] of Object.entries(before)) this.db.data[key].length = length;
      this.db.data.customFields = fields;
      throw e;
    }
  }
  // (audit 2.2.5) a background write that fails takes the change back (db.guard / takeUndo)
  async undone(change) {
    const result = change(),
      undo = this.db.takeUndo?.();
    try {
      await this.db.saved();
    } catch (x) {
      if (undo) undo();
      throw x;
    }
    return result;
  }
  async add(entity, item) {
    return this.undone(() => this.db.add(entity, item));
  }
  async update(entity, id, patch) {
    if (entity === 'slotcars') {
      // Paddock owns linked catalogue fields. Local race/maintenance fields
      // remain editable, exactly as in the former main-process handler.
      patch = { ...patch };
      delete patch.paddock;
      if (this.db.isPaddockLinkedCar(id)) for (const key of require('./paddock').COPY_FIELDS) delete patch[key];
    }
    return this.undone(() => this.db.update(entity, id, patch));
  }
  async libraryResult(sessionId, action) {
    return this.undone(() => this.db.libraryResult(sessionId, action));
  }
  async remove(entity, id) {
    if (entity === 'sessions') return this.removeSession(id);
    await this.undone(() => this.db.remove(entity, id));
  } // (a session takes its laps and the cars' lap counters with it, as on SQLite)
  async mergeDrivers(fromId, intoId) {
    return this.undone(() => this.db.mergeDrivers(fromId, intoId));
  }
  async saveSession(session, laps) {
    if (session.resourceRunId) {
      const resources = this.getResourceStore();
      if (!resources) throw new Error('Resource storage is not ready.');
      return resources.saveSession(session, laps);
    }
    return this.db.saveSessionAsync(session, laps);
  }
  async removeSession(id) {
    await this.undone(() => this.db.removeSession(id));
  }
  async addCustomField(entity, field) {
    return this.undone(() => this.db.addCustomField(entity, field));
  }
  async removeCustomField(entity, id) {
    await this.undone(() => this.db.removeCustomField(entity, id));
  }
  async setCustomFieldGroup(entity, id, group) {
    return this.undone(() => this.db.setCustomFieldGroup(entity, id, group));
  }
}

module.exports = DataRepository;
