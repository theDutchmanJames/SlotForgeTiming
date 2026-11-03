'use strict';
const {randomUUID}=require('node:crypto');
const Records=require('./paddockrecords');
const {hash,profilePatch,validateProfile,COPY_FIELDS,receiptWarnings}=require('./paddock');
const copy=x=>structuredClone(x);
const fields=['id','brand','manufacturer','model','raceClass','paddock'];
function project(row){return Object.fromEntries(fields.filter(k=>Object.hasOwn(row,k)).map(k=>[k,copy(row[k])]));}
function version(row){return hash(project(row));}
function deliverySummary(d){return {key:require('./delivery-key').keyOf(d.payload),sessionId:d.payload?.sessionId||d.sessionId||'',name:d.name||d.payload?.name||'Saved session',revision:d.payload?.revision,status:d.status,error:d.error||'',databaseId:d.payload?.databaseId||d.databaseId,receivedAt:d.receipt?.receivedAt,warnings:receiptWarnings(d),receiptCheckedAt:d.receiptCheckedAt,receiptCheckError:d.receiptCheckError||''};}
class JsonPaddockStorage {
 constructor(db){this.db=db;this.pictures=new WeakMap();this.pictureSequence=0;Records.state(db.data);}
 state(){return Records.state(this.db.data);}
 async commit(rows=[]){rows.forEach(r=>this.db.touch(r));await this.db.commit();await this.db.saved();}
 connection(){const c=this.state().connection,cache=this.state().catalogue;return {connection:copy(c),revision:hash([c,cache?.databaseId||null,cache?.revision??null,cache?.updatedAt||null])};}
 cache(){return copy(this.state().catalogue);}
 pictureToken(c){if(!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(c?.picture||''))return '';let p=this.pictures.get(c);if(!p||p.source!==c.picture){p={source:c.picture,key:String(++this.pictureSequence)};this.pictures.set(c,p);}return p.key;}
 cars({databaseId,ids,carId,details=false}={}){return this.db.data.slotcars.filter(c=>ids?ids.includes(c.id):c.paddock&&(!databaseId||c.paddock.databaseId===databaseId)&&(!carId||c.paddock.carId===carId)).map(c=>({value:details?project(c):{...Object.fromEntries(fields.filter(k=>k!=='paddock'&&Object.hasOwn(c,k)).map(k=>[k,c[k]])),...(c.paddock?{paddock:{databaseId:c.paddock.databaseId,carId:c.paddock.carId,name:c.paddock.name,archived:c.paddock.archived,mediaHash:c.paddock.mediaHash,configuration:{capturedAt:c.paddock.configuration?.capturedAt}}}:{})},revision:version(c),raceClassName:this.db.data.raceclasses.find(k=>k.id===c.raceClass)?.name||'',pictureKey:this.pictureToken(c)}));}
 picture(id,revision){const c=this.db.data.slotcars.find(c=>c.id===id);return c?.picture&&this.pictureToken(c)===revision?c.picture:'';}
 summary(){return {connection:this.connection().connection,linked:this.db.data.slotcars.filter(c=>c.paddock).map(c=>({id:c.id,name:[c.brand,c.manufacturer,c.model].filter(Boolean).join(' '),databaseId:c.paddock.databaseId,carId:c.paddock.carId,archived:!!c.paddock.archived,capturedAt:c.paddock.configuration?.capturedAt})),deliveries:[...this.db.data.sessions.map(s=>s.paddockDelivery).filter(d=>d&&d.status!=='withdrawn'),...this.state().withdrawals].map(deliverySummary)};}
 check(id,expected){const row=this.db.data.slotcars.find(c=>c.id===id);if(!row||version(row)!==expected)throw Error('Linked car changed. Refresh and try again.');return row;}
 connected(id){if(this.state().connection?.databaseId!==id)throw Error('Paddock database identity changed.');}
 async setConnection(connection,revision){if(this.connection().revision!==revision)throw Error('Paddock connection changed.');const before=this.state().connection;this.state().connection=copy(connection);try{await this.commit();}catch(e){this.state().connection=before;throw e;}}
 async mutate(work){const changes=[],created=[],classes=new Set(this.db.data.raceclasses.map(c=>c.id));let createdClasses=[];const remember=row=>{if(!changes.some(x=>x.row===row))changes.push({row,before:{...row}});};
  try{let value;try{value=work(remember,created);}finally{createdClasses=this.db.data.raceclasses.filter(c=>!classes.has(c.id)).map(c=>c.id);for(const x of changes)x.after={...x.row};}await this.commit([...changes.map(x=>x.row),...created]);return value;}
  catch(e){for(const {row,before,after}of changes){for(const key of [...COPY_FIELDS,'paddock'])if(row[key]===after[key]){if(Object.hasOwn(before,key))row[key]=before[key];else delete row[key];}this.db.touch(row);}this.db.data.slotcars=this.db.data.slotcars.filter(c=>!created.includes(c));this.db.data.raceclasses=this.db.data.raceclasses.filter(c=>!createdClasses.includes(c.id));throw e;}
 }
 async link(profile,localId,revision){this.connected(profile.databaseId);const existing=this.db.data.slotcars.find(c=>c.paddock?.databaseId===profile.databaseId&&c.paddock.carId===profile.car.id);if(existing&&localId&&existing.id!==localId)throw Error('This Paddock car is already linked to another Timing car.');const id=localId||existing?.id;const row=id?this.check(id,revision):null;if(row?.paddock&&(row.paddock.databaseId!==profile.databaseId||row.paddock.carId!==profile.car.id))throw Error('This Timing car is already linked.');return this.mutate((remember,created)=>{const patch=profilePatch(profile,this.db.data.raceclasses);if(row){remember(row);Object.assign(row,patch);return row;}const result={id:randomUUID(),custom:{},lapsDriven:0,...patch};this.db.data.slotcars.push(result);created.push(result);return result;});}
 async catalogue(databaseId,cache,updates,revision){this.connected(databaseId);if(this.connection().revision!==revision)throw Error('Paddock connection changed.');const before=this.state().catalogue;try{return await this.mutate(remember=>{for(const u of updates){const row=this.check(u.recordId,u.expectedRevision);if(u.profile){validateProfile(u.profile);if(u.profile.databaseId!==databaseId||u.profile.car.id!==row.paddock.carId)throw Error("Profile identity changed.");remember(row);const patch=profilePatch(u.profile,this.db.data.raceclasses);if(u.preservePicture){delete patch.picture;patch.paddock.mediaHash=row.paddock.mediaHash??(row.picture?require("node:crypto").createHash("sha256").update(row.picture).digest("hex"):"");}Object.assign(row,patch);}else if(u.archived){remember(row);row.paddock={...row.paddock,archived:true};}else{const patch=profilePatch({databaseId,car:u.catalogueCar,configuration:{technical:u.catalogueCar.technical}},this.db.data.raceclasses);if(row.paddock.configuration)patch.paddock.configuration=row.paddock.configuration;else delete patch.paddock.configuration;if(COPY_FIELDS.every(k=>row[k]===patch[k])&&require('node:util').isDeepStrictEqual(row.paddock,patch.paddock))continue;remember(row);Object.assign(row,patch);}}this.state().catalogue=copy(cache);});}catch(e){this.state().catalogue=before;throw e;}}
 async archive(id,revision){return this.mutate(remember=>{const row=this.check(id,revision);this.connected(row.paddock?.databaseId);remember(row);row.paddock={...row.paddock,archived:true};});}
 async capture(updates){return this.mutate(remember=>{for(const u of updates){this.connected(u.profile.databaseId);const row=this.check(u.recordId,u.expectedRevision);if(row.paddock?.databaseId!==u.profile.databaseId||row.paddock.carId!==u.profile.car.id||row.paddock.archived||u.profile.car.archived)throw Error('Captured car identity changed.');const name=this.db.data.raceclasses.find(c=>c.id===row.raceClass)?.name||'';if(name.trim().toLocaleLowerCase()!==(u.profile.car.raceClass||'').trim().toLocaleLowerCase())throw Error('Refresh the changed race class before starting.');remember(row);row.paddock={...row.paddock,configuration:copy(u.profile.configuration)};}});}
}
class SqlitePaddockStorage {
 constructor(repository){this.repo=repository;this.client=repository.client;}
 connection(){return this.client.paddockRead('connection');}
 cache(){return this.client.paddockRead('cache');}
 async cars(options={}){let after='',rows=[],revision;for(;;){const page=await this.client.paddockRead('cars',{...options,after,revision});revision=page.revision;rows.push(...page.rows);if(page.rows.length<200)return rows;after=page.rows.at(-1).value.id;}}
 picture(id,key){return this.client.paddockRead('picture',{id,key});}
 summary(){return this.client.paddockRead('summary');}
 setConnection(connection,expectedRevision){return this.repo.paddockConnection(connection,{commandId:randomUUID(),expectedRevision});}
 async link(profile,localId,expectedRevision){const r=await this.repo.linkPaddock(profile,{commandId:randomUUID(),localId,expectedRevision});return (await this.repo.get('slotcars',r.recordId,true)).record.value;}
 catalogue(databaseId,cache,updates,expectedRevision){return this.repo.applyPaddockCatalogue(databaseId,cache,updates,{commandId:randomUUID(),expectedRevision});}
 archive(recordId,expectedRevision){return this.repo.execute(randomUUID(),'archivePaddockCar',{recordId,expectedRevision});}
 capture(updates){return this.repo.cacheConfigurations(updates,{commandId:randomUUID()});}
}
module.exports={JsonPaddockStorage,SqlitePaddockStorage,deliverySummary,fields};
