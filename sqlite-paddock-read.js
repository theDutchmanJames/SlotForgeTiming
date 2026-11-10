'use strict';
const C=require('./sqlite-catalogue');
const {fields,deliverySummary}=require('./paddock-storage');
function subtree(s,entity,id,parts){
 // Signed configurations are opaque: preserve empty objects and arrays using
 // their recorded shape, rather than reconstructing only existing scalar leaves.
 const record=s.statement('SELECT shape FROM records WHERE entity=? AND id=?').get(entity,id);if(!record)return undefined;
 let shape=JSON.parse(record.shape);for(const key of parts){if(shape?.[0]!=='object')return undefined;shape=shape[1].find(([k])=>k===key)?.[1];}if(!shape)return undefined;
 const build=shape=>shape[0]==='field'?JSON.parse(s.statement('SELECT json FROM fields WHERE entity=? AND id=? AND path=?').get(entity,id,shape[1]).json):Object.fromEntries(shape[1].map(([key,child])=>[key,build(child)]));
 let value=build(shape);const prefix=JSON.stringify(parts).slice(0,-1);
 for(const a of s.statement('SELECT path,mime,bytes,original FROM assets WHERE entity=? AND id=? AND substr(path,1,?)=?').all(entity,id,prefix.length,prefix)){
  const p=JSON.parse(a.path);if(!parts.every((x,i)=>p[i]===x))continue;const tail=p.slice(parts.length),uri=a.original??`data:${a.mime};base64,${Buffer.from(a.bytes).toString('base64')}`;
  if(!tail.length)value=uri;else{let target=value;for(const k of tail.slice(0,-1))target=target[k];Object.defineProperty(target,tail.at(-1),{value:uri,enumerable:true,writable:true,configurable:true});}
 }return value;
}
function read(s,kind,o={}){return s.transaction(()=>{
 if(kind==='collectionMigration'){const M=require('./paddock-collection-store');return M.read(M.sqlAdapter(s),o);}
 if(kind==='historicalReview'){const S=require('./paddock-historical-store');return S.read(S.sqlAdapter(s),o);}
 if(kind==='historySync'){const S=require('./paddock-history-sync-store');return S.read(S.sqlAdapter(s),o);}
 if(kind==='historyMatches'){
  if(!Array.isArray(o.rows)||o.rows.length>50)throw Error('Invalid history identity page.');
  return Object.fromEntries(o.rows.map(r=>{const read=tail=>C.read(s,'sessions',r.sessionId,['paddockDelivery',...tail]);
   const payload={databaseId:read(['payload','databaseId']),source:{id:read(['payload','source','id'])},sessionId:read(['payload','sessionId']),revision:read(['payload','revision']),state:read(['payload','state'])};
   const d={format:read(['payload','format'])||'timing-v1',key:require('./delivery-key').keyOf(payload),status:read(['status']),sessionId:r.sessionId};
   return [JSON.stringify([r.sourceId,r.sessionId]),require('./paddock-history').matches(r,[d],o.databaseId)];
  }));
 }
 if(kind==='historyCache'){if(!/^[a-f0-9]{64}$/.test(o.id))throw Error('Invalid history cache key.');return s.get('paddockHistoryCache',o.id,true)?.value||null;}
 if(kind==='sharedOperations')return require('./paddock-shared-store').sqlRead(s,o);
 if(kind==='localTransfers')return require('./paddock-local-transfers').sqlRead(s,o);
 const connection=C.read(s,'@meta','paddock',['connection'])||null;
 if(kind==='connection')return {connection,revision:s.revision('@meta','paddock')};
 if(kind==='cache')return C.read(s,'@meta','paddock',['catalogue']);
 if(kind==='picture'){
  if(typeof o.id!=='string'||typeof o.key!=='string')throw Error('Invalid Paddock picture.');
  const digest=s.statement("SELECT digest FROM assets WHERE entity=? AND id=? AND path=? AND mime IN ('image/png','image/jpeg','image/webp')").get('slotcars',o.id,'["picture"]')?.digest;
  return digest===o.key?subtree(s,'slotcars',o.id,['picture']):'';
 }
 if(kind==='cars'){
  if(o.ids&&(!Array.isArray(o.ids)||o.ids.length>32||o.ids.some(x=>typeof x!=='string')))throw Error('Invalid selected cars.');
  const revision=C.revision(s);if(o.revision&&o.revision!==revision)throw Error('Paddock cars changed while reading. Retry the operation.');
  const where=['entity=\'slotcars\'','id>?'],args=[o.after||''];
  if(o.ids){where.push('id IN ('+o.ids.map(()=>'?').join(',')+')');args.push(...o.ids);}
  else {where.push(`id IN (SELECT id FROM fields WHERE entity='slotcars' AND path='["paddock","databaseId"]'${o.databaseId?' AND json=?':''})`);if(o.databaseId)args.push(JSON.stringify(o.databaseId));}
  if(o.carId){where.push(`id IN (SELECT id FROM fields WHERE entity='slotcars' AND path='["paddock","carId"]' AND json=?)`);args.push(JSON.stringify(o.carId));}
  const rows=s.statement(`SELECT id FROM records WHERE ${where.join(' AND ')} ORDER BY id LIMIT 200`).all(...args).map(({id})=>{
   const value={};for(const key of fields){if(key==='paddock'&&!o.details){const databaseId=C.read(s,'slotcars',id,['paddock','databaseId']);if(databaseId)value.paddock={databaseId,carId:C.read(s,'slotcars',id,['paddock','carId']),name:C.read(s,'slotcars',id,['paddock','name']),archived:C.read(s,'slotcars',id,['paddock','archived']),mediaHash:C.read(s,'slotcars',id,['paddock','mediaHash']),configuration:{capturedAt:C.read(s,'slotcars',id,['paddock','configuration','capturedAt'])}};}else{const v=subtree(s,'slotcars',id,[key]);if(v!==undefined)value[key]=v;}}
   return {value,revision:s.revision('slotcars',id),raceClassName:value.raceClass?C.read(s,'raceclasses',value.raceClass,['name'])||'':'',pictureKey:s.statement("SELECT digest FROM assets WHERE entity=? AND id=? AND path=? AND mime IN ('image/png','image/jpeg','image/webp')").get('slotcars',id,'["picture"]')?.digest||''};
  });return {rows,revision};
 }
 if(kind==='summary'){
  const linked=s.statement(`SELECT id FROM fields WHERE entity='slotcars' AND path='["paddock","databaseId"]'`).all().map(({id})=>{const p=C.read(s,'slotcars',id,['paddock']);return {id,name:['brand','manufacturer','model'].map(k=>C.read(s,'slotcars',id,[k])).filter(Boolean).join(' '),databaseId:p.databaseId,carId:p.carId,archived:!!p.archived,capturedAt:p.configuration?.capturedAt};});
  const deliveries=s.statement(`SELECT DISTINCT id FROM fields WHERE entity='sessions' AND substr(path,1,19)='["paddockDelivery",'`).all().map(({id})=>{const get=path=>C.read(s,'sessions',id,['paddockDelivery',...path]);const d=Object.fromEntries(['name','sessionId','databaseId','status','error','receipt','receiptCheckedAt','receiptCheckError'].map(k=>[k,get([k])]));d.payload=Object.fromEntries(['format','databaseId','sessionId','name','revision','state'].map(k=>[k,get(['payload',k])]));d.payload.source={id:get(['payload','source','id'])};if(d.receipt?.warnings?.length)d.payload.participants=get(['payload','participants']);return d;}).filter(d=>d&&d.status!=='withdrawn');
  deliveries.push(...(C.read(s,'@meta','paddock',['withdrawals'])||[]));return {connection,linked,deliveries:deliveries.map(deliverySummary)};
 }
 throw Error('Unsupported Paddock read.');
});}
module.exports={read,subtree};
