'use strict';
const crypto = require('node:crypto');
const { object } = require('./sqlite-store');
const { address, profilePatch, validateProfile:validate } = require('./paddock');
const { setPath, patchRecord, expectMeta } = require('./sqlite-records');
function ensure(s) {
  if (!s.get('@meta','paddock')) s.replace('@meta','paddock',{sourceId:crypto.randomUUID(),connection:null,withdrawals:[]});
}
function connected(s,databaseId) {
  if (!databaseId || s.field('@meta','paddock',['connection','databaseId']).value !== databaseId) throw Error('Paddock database identity changed.');
}
function setPaddockConnection(s,{connection,expectedRevision}) {
  expectMeta(s,'paddock',expectedRevision);
  if (connection !== null && (!object(connection) || typeof connection.databaseId !== 'string' || !connection.databaseId || typeof connection.name !== 'string' || typeof connection.timing !== 'boolean' || typeof connection.results !== 'boolean')) throw Error('Invalid Paddock connection.');
  const old = s.field('@meta','paddock',['connection','databaseId']).value;
  if (connection && old && old !== connection.databaseId) throw Error('Forget the old Paddock connection before choosing another database.');
  ensure(s);
  const value = connection && {address:address(connection.address),databaseId:connection.databaseId,name:connection.name,timing:connection.timing,results:connection.results};
  setPath(s,'@meta','paddock',['connection'],value);
  return {revision:s.revision('@meta','paddock')};
}
function linkPaddockCar(s,{profile,localId,expectedRevision,preservePicture=false}) {
  validate(profile); connected(s,profile.databaseId);
  if (profile.car.archived) throw Error('This car is archived in Paddock.');
  const linked = s.statement(`SELECT a.id FROM fields a JOIN fields b ON a.entity=b.entity AND a.id=b.id
    WHERE a.entity='slotcars' AND a.path='["paddock","databaseId"]' AND a.json=? AND b.path='["paddock","carId"]' AND b.json=?`).get(JSON.stringify(profile.databaseId),JSON.stringify(profile.car.id));
  if (linked && localId && linked.id !== localId) throw Error('This Paddock car is already linked to another Timing car.');
  const id = localId || linked?.id;
  const row = id ? s.get('slotcars',id)?.value : null;
  if (id) s.expect('slotcars',id,expectedRevision);
  if (row?.paddock && (row.paddock.databaseId !== profile.databaseId || row.paddock.carId !== profile.car.id)) throw Error('This Timing car is already linked.');
  const classes = s.statement("SELECT id,json FROM fields WHERE entity='raceclasses' AND path='[\"name\"]'").all().map(c=>({id:c.id,name:JSON.parse(c.json)})), known = new Set(classes.map(c=>c.id));
  const patch = profilePatch(profile,classes);
  if(preservePicture&&row){
    delete patch.picture;patch.paddock.mediaHash=row.paddock?.mediaHash||'';
    // One-time upgrade of a legacy inline-photo link. Hash in the worker, without
    // returning its BLOB or rewriting it as part of the catalogue command.
    if(!Object.hasOwn(row.paddock||{},'mediaHash')){
      const a=s.statement('SELECT mime,bytes,original FROM assets WHERE entity=? AND id=? AND path=?').get('slotcars',id,'["picture"]');
      if(a)patch.paddock.mediaHash=crypto.createHash('sha256').update(a.original??`data:${a.mime};base64,${Buffer.from(a.bytes).toString('base64')}`).digest('hex');
    }
  }
  for (const item of classes) if (!known.has(item.id)) s.insert('raceclasses',item);
  let recordId = id;
  if (row) patchRecord(s,'slotcars',id,patch);
  else { recordId = crypto.randomUUID(); s.insert('slotcars',{id:recordId,custom:{},lapsDriven:0,...patch}); }
  s.checkpoint('paddock-car-written'); return {recordId,revision:s.revision('slotcars',recordId)};
}
function applyPaddockCatalogue(s,{databaseId,cache,updates,expectedRevision}) {
  expectMeta(s,'paddock',expectedRevision); connected(s,databaseId);
  if (!object(cache) || cache.databaseId !== databaseId || !Array.isArray(cache.cars) || !Number.isSafeInteger(cache.revision) || cache.revision<0 || cache.cars.length>10000 || !Array.isArray(updates) || updates.length > 10000) throw Error('Invalid Paddock catalogue batch.');
  const ids = new Set();
  for (const row of cache.cars) {
    if (!object(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw Error('Invalid or duplicate catalogue car.'); ids.add(row.id);
  }
  if (new Set(updates.map(u=>u.recordId)).size !== updates.length) throw Error('Duplicate linked-car update.');
  for (const update of updates) {
    s.expect('slotcars',update.recordId,update.expectedRevision);
    if (s.field('slotcars',update.recordId,['paddock','databaseId']).value !== databaseId) throw Error('Linked car belongs to another Paddock database.');
    if (update.profile) {
      if (update.profile.databaseId !== databaseId) throw Error('Profile belongs to another Paddock database.');
      linkPaddockCar(s,{profile:update.profile,localId:update.recordId,expectedRevision:update.expectedRevision,preservePicture:update.preservePicture===true});
    } else if (update.catalogueCar) {
      const car=update.catalogueCar,row=s.get('slotcars',update.recordId,true).value;
      if(car.id!==row.paddock.carId||typeof car.name!=='string'||['maker','marque','model','scale','raceClass','picture','availability'].some(k=>car[k]!=null&&typeof car[k]!=='string')||car.picture&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(car.picture))throw Error('Catalogue car identity changed.');
      const classes=s.statement("SELECT id,json FROM fields WHERE entity='raceclasses' AND path='[\"name\"]'").all().map(c=>({id:c.id,name:JSON.parse(c.json)})),known=new Set(classes.map(c=>c.id));
      const patch=profilePatch({databaseId,car,configuration:{technical:car.technical}},classes);
      if(row.paddock.configuration)patch.paddock.configuration=row.paddock.configuration;else delete patch.paddock.configuration;
      for(const item of classes)if(!known.has(item.id))s.insert('raceclasses',item);
      if(!require('node:util').isDeepStrictEqual(Object.fromEntries(Object.keys(patch).map(k=>[k,row[k]])),patch))patchRecord(s,'slotcars',update.recordId,patch);
    } else if (update.archived === true) setPath(s,'slotcars',update.recordId,['paddock','archived'],true);
    else throw Error('Invalid linked-car update.');
  }
  setPath(s,'@meta','paddock',['catalogue'],cache); s.checkpoint('catalogue-written');
  return {revision:s.revision('@meta','paddock')};
}
function cachePaddockConfigurations(s,{updates}) {
  if (!Array.isArray(updates) || updates.length > 32 || new Set(updates.map(u=>u.recordId)).size !== updates.length) throw Error('Invalid capture batch.');
  let databaseId;
  for (const update of updates) {
    const p = update.profile; validate(p); connected(s,p.databaseId); s.expect('slotcars',update.recordId,update.expectedRevision);
    if (databaseId && databaseId !== p.databaseId) throw Error('Choose cars from one Paddock database.'); databaseId = p.databaseId;
    if (p.car.archived || s.field('slotcars',update.recordId,['paddock','carId']).value !== p.car.id || s.field('slotcars',update.recordId,['paddock','databaseId']).value !== p.databaseId) throw Error('Captured car identity changed.');
    const classId=s.field('slotcars',update.recordId,['raceClass']).value;
    const name=classId?s.field('raceclasses',classId,['name']).value||'':'';
    if (name.trim().toLocaleLowerCase() !== (p.car.raceClass||'').trim().toLocaleLowerCase()) throw Error('Refresh the changed race class before starting.');
    setPath(s,'slotcars',update.recordId,['paddock','configuration'],p.configuration);
  }
  return {updated:updates.map(u=>({recordId:u.recordId,revision:s.revision('slotcars',u.recordId)}))};
}
function archivePaddockCar(s,{recordId,expectedRevision}){s.expect('slotcars',recordId,expectedRevision);const id=s.field('slotcars',recordId,['paddock','databaseId']).value;connected(s,id);setPath(s,'slotcars',recordId,['paddock','archived'],true);return {revision:s.revision('slotcars',recordId)};}
module.exports={commands:{setPaddockConnection,linkPaddockCar,applyPaddockCatalogue,cachePaddockConfigurations,archivePaddockCar}};
