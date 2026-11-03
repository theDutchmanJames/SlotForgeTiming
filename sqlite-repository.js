'use strict';
// Opt-in async adapter for working copies. Callers retain commandId across uncertain retries.
class SqliteRepository {
  constructor(client) { this.client = client; }
  execute(commandId, type, values) {
    if (typeof commandId !== 'string' || !commandId) throw Error('Retain a stable commandId before submitting a write.');
    return this.client.command({ ...values, id: commandId, type });
  }
  get(entity, id, includeMedia = false) { return this.client.snapshot(entity,id,includeMedia); }
  homeStatistics(options) { return this.client.homeStatistics(options); }
  homeSessions(options) { return this.client.homeSessions(options); }
  raceSeason(options) { return this.client.raceSeason(options); }
  raceCharts(ids) { return this.client.raceCharts(ids); }
  raceInputs(options) { return this.client.raceInputs(options); }
  referencePage(entity,options) { return this.client.referencePage(entity,options); }
  referenceDetails(entity,ids,revision) { return this.client.referenceDetails(entity,ids,revision); }
  historyPage(pool,options) { return this.client.historyPage(pool,options); }
  historySession(pool,id,options) { return this.client.historySession(pool,id,options); }
  carStatistics(id) { return this.client.carStatistics(id); }
  catalogue(entity,options) { return this.client.catalogue(entity,options); }
  cataloguePicture(entity,id,revision) { return this.client.cataloguePicture(entity,id,revision); }
  add(entity,item,{commandId}) { return this.execute(commandId,'addRecord',{entity,item}); }
  update(entity,recordId,patch,{commandId,expectedRevision}) { return this.execute(commandId,'updateRecord',{entity,recordId,patch,expectedRevision}); }
  remove(entity,recordId,{commandId,expectedRevision}) { return this.execute(commandId,'removeRecord',{entity,recordId,expectedRevision}); }
  resetService(carId,{commandId,expectedRevision}) { return this.execute(commandId,'resetService',{carId,expectedRevision}); }
  settings(patch,{commandId,expectedRevision}) { return this.execute(commandId,'setSettings',{patch,expectedRevision}); }
  addCustomField(entity,field,{commandId,expectedRevision}) { return this.execute(commandId,'addCustomDefinition',{entity,field,expectedRevision}); }
  removeCustomField(entity,fieldId,{commandId,expectedRevision}) { return this.execute(commandId,'removeCustomDefinition',{entity,fieldId,expectedRevision}); }
  setCustomFieldGroup(entity,fieldId,group,{commandId,expectedRevision}) { return this.execute(commandId,'setCustomGroup',{entity,fieldId,group,expectedRevision}); }
  awards(edits,{commandId}) { return this.execute(commandId,'setChampionshipAwards',{edits}); }
  saveSession(session,laps,{commandId,...resourceOptions}) { return this.execute(commandId,'finalizeSession',{session,laps,...resourceOptions}); }
  beginResources(profileId,context) { return this.client.resourceBegin(profileId,context); }
  resources() { return this.client.resourceState(); }
  checkpoint(snapshot,{commandId,expectedRevision}) { return this.execute(commandId,'resourceCheckpoint',{snapshot,expectedRevision}); }
  clearResources(runId,{commandId,expectedRevision}) { return this.execute(commandId,'resourceClear',{runId,expectedRevision}); }
  paddockConnection(connection,{commandId,expectedRevision}) { return this.execute(commandId,'setPaddockConnection',{connection,expectedRevision}); }
  linkPaddock(profile,{commandId,localId,expectedRevision}) {
    return this.execute(commandId,'linkPaddockCar',{profile,...(localId ? {localId,expectedRevision} : {})});
  }
  applyPaddockCatalogue(databaseId,cache,updates,{commandId,expectedRevision}) { return this.execute(commandId,'applyPaddockCatalogue',{databaseId,cache,updates,expectedRevision}); }
  cacheConfigurations(updates,{commandId}) { return this.execute(commandId,'cachePaddockConfigurations',{updates}); }
}
module.exports = SqliteRepository;
