'use strict';
const M=require('./paddock-collection-store');
const stopped=p=>p.stopped||p.quiescing||p.isRacing?.();
const terminal=new Set(['linked','complete','excluded','attention']);
module.exports={
 collectionMigration(o={}){
  if(o.action==='status')return this.storage.collectionRead({kind:'status'});
  return this.exclusive(async()=>{
   if(stopped(this))throw Error('Finish the race before migrating your collection.');
   const c=(await this.connection()).connection;if(c?.mode!=='local'||c.automatic===false)throw Error('Connect to the local Paddock collection first.');
   if(o.action==='pause'){await this.storage.collectionChange(o);return this.storage.collectionRead({kind:'status'});}
   const host=await this.ensureLocal(c);
   if(o.action==='preview'){if(this.scalable)await this.browseScalable(host);else throw Error('Update Paddock before starting collection migration.');return this.storage.collectionRead({kind:'preview'});}
   if(!['start','pause','resume'].includes(o.action))throw Error('Invalid collection action.');
   if(o.action!=='pause'&&this.historyCapability?.features?.historicalReview!==true)throw Error('Update Paddock to support the collection history review.');
   await this.storage.collectionChange(o);this.startLocal();return this.storage.collectionRead({kind:'status'});
  });
 },
 async syncCollectionMigration(){
  this.collectionPending=false;
  if(stopped(this))return;
  let plan=await this.storage.collectionRead({kind:'get'});if(!plan||plan.state!=='running')return;
  const c=(await this.connection()).connection;
  if(c?.mode!=='local'||c.automatic===false)return;
  if(c.databaseId!==plan.databaseId||c.historyGuard?.recoveryId!==plan.recoveryId||await this.storage.localRead({kind:'source'})!==plan.sourceId){await this.storage.collectionChange({action:'block',error:'The collection was restored or its identity changed. Original journals are retained; automatic migration stopped.'});return;}
  const transfers=await this.localTransfers(),history=await this.storage.historicalRead({kind:'list'});
  let budget=5;
  const update=async(i,patch)=>{if(Object.entries(patch).every(([k,v])=>i[k]===v))return;await this.storage.collectionChange({action:'item',id:i.id,patch});Object.assign(i,patch);};
  for(const i of Object.values(plan.items).filter(i=>i.kind==='car'&&!terminal.has(i.state))){
   if(stopped(this)||budget<=0)break;
   let row=transfers.find(t=>t.localId===i.localId&&t.databaseId===plan.databaseId);
   try{
    if(!row){budget--;const made=await this.storage.localChange({action:'create',databaseId:plan.databaseId,selections:[{localId:i.localId,...(i.target?{target:i.target}:{})}]});row=made[0];transfers.push(row);this.collectionPending=true;}
    if(row.state==='linked')await update(i,{state:'linked',ref:row.id,carId:row.targetId,error:''});
    else if(['rejected','cancelled'].includes(row.state))await update(i,{state:'excluded',ref:row.id,error:'Paddock review '+row.state+'. Original Timing car stays local.'});
    else if(['attention','conflict','unavailable'].includes(row.state))await update(i,{state:'attention',ref:row.id,error:row.error||'Resolve this car in Share Timing cars, then resume the collection.'});
    else await update(i,{state:'queued',ref:row.id,error:row.error||''});
   }catch(e){await update(i,{state:'attention',error:e.message});}
  }
  // Refresh summaries after the regular receipt worker; no new history before
  // all participating car reviews settle, so identity cannot race an approval.
  if(Object.values(plan.items).some(i=>i.kind==='car'&&['waiting','queued'].includes(i.state)))return;
  for(const i of Object.values(plan.items).filter(i=>i.kind==='session'&&!terminal.has(i.state))){
   if(stopped(this)||budget<=0)break;
   let row=history.find(r=>r.sessionId===i.localId&&r.databaseId===plan.databaseId);
   try{
    if(!row){
     budget--;const p=await this.storage.historicalRead({kind:'preview',sessionId:i.localId,migrationId:plan.migrationId});
     if(p.participants.some(p=>p.kind==='physical'&&!p.carId))throw Error('Some historical cars are missing or were not approved. This session stays local; resolve the cars before resuming.');
     row=await this.storage.historicalChange({action:'create',...p,migrationId:plan.migrationId});history.push(row);this.collectionPending=true;
    }else if(!i.ref&&row.migrationId!==plan.migrationId){await update(i,{state:'excluded',error:'A prior Historical Review already owns this session. Use its existing decision/recovery controls.'});continue;}
    if(row.state==='complete')await update(i,{state:row.items.every(x=>x.status==='approved')?'complete':'excluded',ref:row.id,error:row.items.every(x=>x.status==='approved')?'':'Historical review did not approve this session. Original evidence stays local.'});
    else if(row.state==='blocked')await update(i,{state:'attention',ref:row.id,error:row.error||'Historical submission requires reconciliation.'});
    else await update(i,{state:'queued',ref:row.id,error:row.error||''});
   }catch(e){await update(i,{state:'attention',error:e.message});}
  }
  this.collectionPending ||= Object.values(plan.items).some(i=>i.state==='waiting')||history.some(r=>r.state==='queued'&&r.nextAttempt<=Date.now());
  if(Object.values(plan.items).every(i=>terminal.has(i.state)))await this.storage.collectionChange({action:'finish'});
 }
};
