'use strict';
const {validResume}=require('./storage-lifecycle');
function setResume(store,{snapshot,expectedRevision}){
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||store.revision('@meta','raceResume')!==expectedRevision)throw Error('Recovery revision conflict. Reload before saving.');
  if(snapshot!==null&&!validResume(snapshot))throw Error('Invalid race recovery snapshot.');
  if(snapshot?.race?.resources)throw Error('Resource recovery must use its atomic ledger command.');
  if(snapshot&&require('./sqlite-finalization').saved(store,snapshot.race.storageRunId))return {revision:store.revision('@meta','raceResume')};
  store.replace('@meta','raceResume',snapshot);store.checkpoint('recovery-written');
  return {revision:store.revision('@meta','raceResume')};
}
function diagnostics(store){
  const now=Date.now();if(store.lifecycleStats&&now-store.lifecycleStats.at<60000)return store.lifecycleStats.value;
  const pageSize=store.statement('PRAGMA page_size').get().page_size,pages=store.statement('PRAGMA page_count').get().page_count;
  const tables=store.statement('SELECT entity name,count(*) records FROM records GROUP BY entity ORDER BY records DESC LIMIT 5').all();
  const media=store.statement('SELECT count(*) count,coalesce(sum(length(bytes)),0) bytes FROM assets').get();
  const recovery=store.statement("SELECT 1 FROM records r WHERE r.entity='@meta' AND r.id='raceResume' AND NOT EXISTS(SELECT 1 FROM fields f WHERE f.entity=r.entity AND f.id=r.id AND f.path='[]' AND f.json='null')").get();
  const value={backend:'sqlite',database:{backend:'sqlite',physicalBytes:pageSize*pages,media,tables},save:{backend:'sqlite',persistentRecovery:!!recovery}};
  store.lifecycleStats={at:now,value};return value;
}
module.exports={setResume,diagnostics};
