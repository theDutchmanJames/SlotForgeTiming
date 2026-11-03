'use strict';

// Application boundary during the storage conversion. Legacy full-list reads
// remain explicit; writes still use the established JSON domain operations.
// This is not a second database, transaction engine or network patch endpoint.
class DataRepository {
  constructor(db, { getResourceStore = () => null } = {}) {
    this.db = db;
    this.getResourceStore = getResourceStore;
  }
  list(entity) { return this.db.list(entity); }
  choices(entity) { return this.db.list(entity).map(r=>({id:r.id,name:r.name||'Untitled'})); }
  homeStatistics(options) { return require('./dashboard-read').home(require('./dashboard-read').jsonSource(this.db),options); }
  homeSessions(options) { return require('./dashboard-read').navigation(require('./dashboard-read').jsonSource(this.db),options); }
  raceSeason(options) { const S=require('./season-read');return S.read(S.jsonSource(this.db),options); }
  raceCharts(ids) { return require('./display-read').charts(require('./race-read').jsonSource(this.db),ids); }
  raceInputs(options) { return require('./race-read').read(require('./race-read').jsonSource(this.db),options); }
  referencePage(entity,options) { return require('./reference-read').jsonPage(this.db,entity,options); }
  referenceDetails(entity,ids,revision) { return require('./reference-read').jsonDetails(this.db,entity,ids,revision); }
  historyPage(pool,options) { return require('./history-read').jsonPage(this.db,pool,options); }
  historySession(pool,id,options) { return require('./history-read').jsonSession(this.db,pool,id,options); }
  carStatistics(id) { return require('./history-read').jsonCar(this.db,id); }
  catalogue(entity, options) { return require('./catalogue-read').jsonPage(this.db,entity,options); }
  cataloguePicture(entity,id,revision) { return require('./catalogue-read').jsonPicture(this.db,entity,id,revision); }
  get(entity, id) { return this.db.getRecord(entity, id); }
  localCars() { return this.db.localCarSummaries(); }
  linkedLaps(entity, id) { return this.db.linkedLaps(entity, id); }
  customFields(entity) { return this.db.listCustomFields(entity); }
  async add(entity, item) {
    const row = this.db.add(entity, item);
    await this.db.saved();
    return row;
  }
  async update(entity, id, patch) {
    if (entity === 'slotcars') {
      // Paddock owns linked catalogue fields. Local race/maintenance fields
      // remain editable, exactly as in the former main-process handler.
      patch = { ...patch };
      delete patch.paddock;
      if (this.db.isPaddockLinkedCar(id))
        for (const key of require('./paddock').COPY_FIELDS) delete patch[key];
    }
    const row = this.db.update(entity, id, patch);
    await this.db.saved();
    return row;
  }
  async remove(entity, id) { this.db.remove(entity, id); await this.db.saved(); }
  async saveSession(session, laps) {
    if (session.resourceRunId) {
      const resources = this.getResourceStore();
      if (!resources) throw new Error('Resource storage is not ready.');
      return resources.saveSession(session, laps);
    }
    return this.db.saveSessionAsync(session, laps);
  }
  async removeSession(id) { this.db.removeSession(id); await this.db.saved(); }
  async addCustomField(entity, field) {
    const result = this.db.addCustomField(entity, field);
    await this.db.saved();
    return result;
  }
  async removeCustomField(entity, id) { this.db.removeCustomField(entity, id); await this.db.saved(); }
  async setCustomFieldGroup(entity, id, group) {
    const result = this.db.setCustomFieldGroup(entity, id, group);
    await this.db.saved();
    return result;
  }
}

module.exports = DataRepository;
