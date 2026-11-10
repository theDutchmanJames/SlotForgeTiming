'use strict';
// Local orchestration only. Existing transfer/import journals own wire identities.
const {hash}=require('./paddock'),{randomUUID}=require('node:crypto');
const ROOT='paddockCollectionMigration';
const key=db=>'collection-'+hash(db).slice(0,48);
const name=c=>c.name||[c.brand,c.manufacturer,c.model].filter(Boolean).join(' ')||c.id;
const normalize=v=>String(v||'').trim().toLocaleLowerCase();
function inventory(a){
 const c=a.connection();if(c?.mode!=='local')return {available:false};
 const data=a.inventory(),catalog=a.catalog()?.cars||[];
 const cars=data.cars.map(car=>({...car,name:name(car),matches:car.paddock?[]:catalog.filter(p=>!p.archived&&(
  normalize(p.name)===normalize(name(car))||normalize(car.model)&&normalize(p.model)===normalize(car.model)||
  car.reference&&normalize(car.reference)===normalize(p.reference))).map(p=>({id:p.id,name:p.name,revision:p.revision}))}));
 return {available:true,databaseId:c.databaseId,recoveryId:c.historyGuard?.recoveryId||null,cars,sessions:data.sessions,
  revision:hash([c.databaseId,c.historyGuard?.recoveryId,cars,data.sessions]),laps:data.laps};
}
function summary(plan){
 if(!plan)return null;const items=Object.values(plan.items),counts={cars:{},sessions:{}};
 for(const i of items){const group=counts[i.kind==='car'?'cars':'sessions'];group[i.state]=(group[i.state]||0)+1;}
 return {id:plan.id,databaseId:plan.databaseId,state:plan.state,error:plan.error||'',counts,total:items.length,
  items:items.filter(i=>['attention','excluded'].includes(i.state)).slice(0,100),createdAt:plan.createdAt};
}
function read(a,o={}){
 const c=a.connection(),plan=c?.mode==='local'?a.get(key(c.databaseId)):null;
 if(o.kind==='get')return plan;
 if(o.kind==='preview')return inventory(a);
 if(o.kind==='status'){
  if(plan)return {available:true,plan:summary(plan)};
  if(c?.mode!=='local')return {available:false};
  const counts=a.counts();return {available:true,counts,plan:null};
 }
 throw Error('Invalid collection migration read.');
}
function change(a,o){
 const c=a.connection();if(c?.mode!=='local'||c.automatic===false)throw Error('Reconnect the original local collection.');
 let plan=a.get(key(c.databaseId));
 if(o.action==='start'){
  if(plan)return summary(plan); // An interrupted start never creates another plan.
  const p=inventory(a);if(p.revision!==o.revision||!p.recoveryId)throw Error('Collection changed. Review the migration preview again.');
  const choices=o.choices||{},targets=new Set(),items={};
  for(const car of p.cars){
   const choice=choices[car.id],id='car-'+hash(car.id).slice(0,48);let state='waiting',target;
   if(car.paddock){state=car.paddock.databaseId===c.databaseId?'linked':'excluded';}
   else if(choice?.action==='skip')state='excluded';
   else if(choice?.action==='link'){
    target=car.matches.find(m=>m.id===choice.carId);if(!target||!Number.isSafeInteger(target.revision))throw Error('Refresh and explicitly select the existing physical car.');
    if(targets.has(target.id)||p.cars.some(x=>x.paddock?.databaseId===c.databaseId&&x.paddock.carId===target.id))throw Error('Two Timing cars cannot silently become the same physical car.');targets.add(target.id);
   }else if(car.matches.length&&choice?.action!=='create')throw Error('Choose whether each possible match is the same physical car, a new car, or should stay local.');
   items[id]={id,kind:'car',localId:car.id,name:car.name,state,...(target?{target:{carId:target.id,revision:target.revision}}:{}),...(state==='linked'?{carId:car.paddock.carId}:{}),...(state==='excluded'?{error:'Kept local by choice or linked to another collection.'}:{})};
  }
  for(const s of p.sessions){const id='session-'+hash(s.id).slice(0,48);items[id]={id,kind:'session',localId:s.id,name:s.name,state:s.delivered?'excluded':'waiting',...(s.delivered?{error:'Already has a result delivery identity; existing Result Delivery remains responsible.'}:{})};}
  plan={id:key(c.databaseId),migrationId:randomUUID(),databaseId:c.databaseId,recoveryId:p.recoveryId,sourceId:a.source(),state:'running',items,createdAt:new Date().toISOString()};a.put(plan);return summary(plan);
 }
 if(!plan)throw Error('Start the collection migration first.');
 if(o.action==='pause'){a.patch(plan.id,['state'],'paused');return summary({...plan,state:'paused'});}
 if(o.action==='resume'){
  if(plan.recoveryId!==c.historyGuard?.recoveryId||plan.sourceId!==a.source())throw Error('The collection was restored or the source changed. Automatic migration stays blocked.');
  for(const i of Object.values(plan.items))if(i.state==='attention')a.patch(plan.id,['items',i.id],{...i,state:'waiting',error:''});
  a.patch(plan.id,['state'],'running');return summary({...plan,state:'running'});
 }
 if(o.action==='block'){a.patch(plan.id,['state'],'blocked');a.patch(plan.id,['error'],String(o.error||'Collection identity changed.').slice(0,1000));return;}
 if(o.action==='item'){
  if(!plan.items[o.id]||!['waiting','queued','linked','complete','excluded','attention'].includes(o.patch?.state))throw Error('Invalid migration item.');
  const next={...plan.items[o.id],...o.patch};a.patch(plan.id,['items',o.id],next);return next;
 }
 if(o.action==='finish'){
  if(Object.values(plan.items).some(i=>['waiting','queued'].includes(i.state)))throw Error('Migration is still in progress.');
  a.patch(plan.id,['state'],'complete');return;
 }
 throw Error('Invalid collection migration operation.');
}
function mappings(a,migrationId){
 const c=a.connection(),plan=c&&a.get(key(c.databaseId));
 if(!plan||plan.migrationId!==migrationId||plan.state!=='running'||plan.recoveryId!==c.historyGuard?.recoveryId||plan.sourceId!==a.source())throw Error('Migration identity changed.');
 const out={};for(const i of Object.values(plan.items))if(i.kind==='car'&&i.state==='linked'){
  const car=a.car(i.localId);if(car?.paddock?.databaseId!==c.databaseId||car.paddock.carId!==i.carId)throw Error('An approved car link changed.');out[i.localId]=i.carId;
 }return out;
}
function sqlAdapter(s){const C=require('./sqlite-catalogue'),read=(e,id,k)=>C.read(s,e,id,[k]),ids=e=>s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(e);return {
 connection:()=>read('@meta','paddock','connection'),source:()=>read('@meta','paddock','sourceId'),catalog:()=>read('@meta','paddock','catalogue'),
 car:id=>({paddock:{databaseId:C.read(s,'slotcars',id,['paddock','databaseId']),carId:C.read(s,'slotcars',id,['paddock','carId'])}}),get:id=>s.get(ROOT,id,true)?.value||null,
 put:row=>s.insert(ROOT,row),patch:(id,parts,value)=>require('./sqlite-records').setPath(s,ROOT,id,parts,value),
 counts:()=>({cars:s.statement("SELECT COUNT(*) n FROM records WHERE entity='slotcars'").get().n,sessions:s.statement("SELECT COUNT(*) n FROM records WHERE entity='sessions'").get().n}),
 inventory:()=>({cars:ids('slotcars').map(({id})=>({id,...Object.fromEntries(['name','brand','manufacturer','model','reference'].map(k=>[k,read('slotcars',id,k)||''])),paddock:C.read(s,'slotcars',id,['paddock','databaseId'])?{databaseId:C.read(s,'slotcars',id,['paddock','databaseId']),carId:C.read(s,'slotcars',id,['paddock','carId'])}:null})),
 sessions:ids('sessions').map(({id})=>({id,name:read('sessions',id,'setupName')||id,delivered:!!C.read(s,'sessions',id,['paddockDelivery','status'])})),laps:s.statement('SELECT COUNT(*) n FROM lap_index').get().n})
};}
module.exports={ROOT,key,read,change,summary,mappings,sqlAdapter};
