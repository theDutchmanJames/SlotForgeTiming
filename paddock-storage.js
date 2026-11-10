'use strict';
const {randomUUID}=require('node:crypto');
const Records=require('./paddockrecords');
const {hash,profilePatch,validateProfile,COPY_FIELDS,receiptWarnings}=require('./paddock');
const copy=x=>structuredClone(x);
const fields=['id','brand','manufacturer','model','raceClass','paddock'];
function project(row){return Object.fromEntries(fields.filter(k=>Object.hasOwn(row,k)).map(k=>[k,copy(row[k])]));}
function version(row){return hash(project(row));}
function deliverySummary(d){return {format:d.payload?.format||'timing-v1',key:require('./delivery-key').keyOf(d.payload),sessionId:d.payload?.sessionId||d.sessionId||'',name:d.name||d.payload?.name||'Saved session',revision:d.payload?.revision,status:d.status,error:d.error||'',databaseId:d.payload?.databaseId||d.databaseId,receivedAt:d.receipt?.receivedAt,warnings:receiptWarnings(d),receiptCheckedAt:d.receiptCheckedAt,receiptCheckError:d.receiptCheckError||''};}
class JsonPaddockStorage {
 collectionAdapter(){const M=require('./paddock-collection-store'),d=this.db.data;return {
  connection:()=>this.state().connection,source:()=>this.state().sourceId,catalog:()=>this.state().catalogue,
  car:id=>d.slotcars.find(c=>c.id===id),get:id=>(d[M.ROOT]||[]).find(r=>r.id===id)||null,
  put:row=>{d[M.ROOT]=[...(d[M.ROOT]||[]),copy(row)];},
  patch:(id,parts,value)=>{d[M.ROOT]=(d[M.ROOT]||[]).map(row=>{if(row.id!==id)return row;const next=copy(row);let p=next;for(const k of parts.slice(0,-1))p=p[k];p[parts.at(-1)]=copy(value);return next;});},
  counts:()=>({cars:d.slotcars.length,sessions:d.sessions.length}),
  inventory:()=>({cars:d.slotcars.map(c=>({id:c.id,...Object.fromEntries(['name','brand','manufacturer','model','reference'].map(k=>[k,c[k]||''])),paddock:c.paddock?{databaseId:c.paddock.databaseId,carId:c.paddock.carId}:null})),sessions:d.sessions.map(s=>({id:s.id,name:s.setupName||s.id,delivered:!!s.paddockDelivery})),laps:d.laps.length})
 };}
 collectionRead(o){return copy(require('./paddock-collection-store').read(this.collectionAdapter(),o));}
 async collectionChange(o){const M=require('./paddock-collection-store'),d=this.db.data,before=d[M.ROOT];let after;try{let value;try{value=M.change(this.collectionAdapter(),o);}finally{after=d[M.ROOT];}await this.commit();return value;}catch(e){if(d[M.ROOT]===after){if(before===undefined)delete d[M.ROOT];else d[M.ROOT]=before;}throw e;}}
 historicalAdapter(){const S=require('./paddock-historical-store'),E=require('./paddock-historical-evidence'),d=this.db.data;return {
  connection:()=>this.state().connection,source:()=>this.state().sourceId,
  mappings:id=>require('./paddock-collection-store').mappings(this.collectionAdapter(),id),
  evidence:id=>E.capture(d.sessions.find(s=>s.id===id),d.laps.filter(l=>l.sessionId===id)),
  list:()=>[...(d[S.ROOT]||[])].reverse().map(S.summary),get:(id,full=false)=>{const row=(d[S.ROOT]||[]).find(r=>r.id===id);if(!row)return null;if(full)return copy(row);const {evidence,request,upload,...light}=row;return copy({...light,request:row.identity});},
  put:row=>{const old=(d[S.ROOT]||[]).find(r=>r.id===row.id);const next=old?{...old,...row,request:old.request}:copy(row);d[S.ROOT]=[...(d[S.ROOT]||[]).filter(r=>r.id!==row.id),{...next,summary:S.summary(next)}];}

 };}
 historicalRead(o){return require('./paddock-historical-store').read(this.historicalAdapter(),o);}
 async historicalChange(o){const S=require('./paddock-historical-store'),d=this.db.data,before=d[S.ROOT];let after;try{let r;try{r=S.change(this.historicalAdapter(),o);}finally{after=d[S.ROOT];}await this.commit();return r;}catch(e){if(d[S.ROOT]===after){if(before===undefined)delete d[S.ROOT];else d[S.ROOT]=before;}throw e;}}

 historySyncAdapter(){const data=this.db.data;return {
  connection:()=>this.state().connection,field:(table,id,path)=>path.reduce((v,k)=>v?.[k],(data[table]||[]).find(r=>r.id===id)),get:(table,id)=>copy((data[table]||[]).find(r=>r.id===id)||null),
  rows:(table,db)=>(data[table]||[]).filter(r=>r.databaseId===db).map(r=>({id:r.id,route:r.route,stageId:r.stageId})),
  put:(table,row)=>{data[table]=[...(data[table]||[]).filter(r=>r.id!==row.id),copy(row)];},
  erase:(table,id)=>{data[table]=(data[table]||[]).filter(r=>r.id!==id);}
 };}
 async historySyncRead(o){return require('./paddock-history-sync-store').read(this.historySyncAdapter(),o);}
 async historySyncChange(input){
  const S=require('./paddock-history-sync-store'),keys=[S.STATE,S.STAGE,'paddockHistoryCache'],data=this.db.data,before=keys.map(k=>data[k]);let after;
  try{let value;try{value=S.apply(this.historySyncAdapter(),input);}finally{after=keys.map(k=>data[k]);}await this.commit();return value;}
  catch(e){keys.forEach((k,i)=>{if(data[k]===after[i]){if(before[i]===undefined)delete data[k];else data[k]=before[i];}});throw e;}
 }

 async historyMatches(rows,databaseId){const H=require('./paddock-history');return Object.fromEntries(rows.map(r=>{const d=this.db.data.sessions.find(s=>s.id===r.sessionId)?.paddockDelivery;return [JSON.stringify([r.sourceId,r.sessionId]),d?H.matches(r,[deliverySummary(d)],databaseId):null];}));}
 async historyCacheGet(id){return copy((this.db.data.paddockHistoryCache||[]).find(r=>r.id===id)||null);}
 async historyCachePut(row){
  const prior=this.db.data.paddockHistoryCache;
  const next=[...(prior||[]).filter(r=>r.id!==row.id),copy(row)];this.db.data.paddockHistoryCache=next;
  try{await this.commit();return {cached:true};}catch(e){if(this.db.data.paddockHistoryCache===next){if(prior===undefined)delete this.db.data.paddockHistoryCache;else this.db.data.paddockHistoryCache=prior;}throw e;}
 }

 async sharedRead(o){const S=require('./paddock-shared-store'),data=this.db.data;if(o.kind==='policy')return copy(data[S.POLICY]||{});const rows=data[S.ROOT]||[];return copy(o.kind==='get'?rows.find(r=>r.id===o.id)||null:rows.map(S.summary));}
 async sharedChange(input){const S=require('./paddock-shared-store'),data=this.db.data,before=data[S.ROOT],policy=data[S.POLICY];let after,afterPolicy;try{const result=S.change({get:id=>(data[S.ROOT]||[]).find(r=>r.id===id),put:row=>{data[S.ROOT]=[...(data[S.ROOT]||[]).filter(r=>r.id!==row.id),copy(row)];},policy:v=>{data[S.POLICY]=v;}},input);after=data[S.ROOT];afterPolicy=data[S.POLICY];await this.commit();return result;}catch(e){if(data[S.ROOT]===after){if(before===undefined)delete data[S.ROOT];else data[S.ROOT]=before;}if(data[S.POLICY]===afterPolicy){if(policy===undefined)delete data[S.POLICY];else data[S.POLICY]=policy;}throw e;}}

 localAdapter(){const T=require('./paddock-local-transfers'),db=this.db.data;return {
  connection:()=>this.state().connection,sourceId:()=>this.state().sourceId,
  car:id=>db.slotcars.find(c=>c.id===id),revision:()=>null,className:id=>db.raceclasses.find(c=>c.id===id)?.name||'',
  linked:(databaseId,carId)=>db.slotcars.find(c=>c.paddock?.databaseId===databaseId&&c.paddock.carId===carId),
  get:(id,full=false)=>{const x=db[T.ROOT]?.find(x=>x.id===id);return x?{...x,request:full?x.request:x.identity}:null;},list:()=>(db[T.ROOT]||[]).map(x=>copy(x.summary)),
  put:(id,x)=>{db[T.ROOT]=[...(db[T.ROOT]||[]),{id,...x}];},part:(id,key,x)=>{db[T.ROOT]=db[T.ROOT].map(row=>row.id===id?{...row,[key]:x}:row);},
  link:(p,id)=>{const row=db.slotcars.find(c=>c.id===id);if(!row||row.paddock||db.slotcars.some(c=>c.paddock?.databaseId===p.databaseId&&c.paddock.carId===p.car.id))throw Error('This physical car already has a link.');Object.assign(row,profilePatch(p,db.raceclasses));this.db.touch(row);}
 };}
 async localRead(options){const a=this.localAdapter();if(options.kind==='source')return a.sourceId();if(options.kind==='list')return a.list();if(options.kind==='preview')return require('./paddock-local-transfers').preview(a,options.id);if(options.kind==='get')return copy(a.get(options.id,options.full===true));throw Error('Invalid local transfer read.');}
 async localChange(input){
  const T=require('./paddock-local-transfers'),db=this.db.data,before=db[T.ROOT],classes=new Set(db.raceclasses.map(c=>c.id));
  const id=before?.find(x=>x.id===input.transferId)?.summary.localId,row=input.action==='apply'?db.slotcars.find(c=>c.id===id):null,saved=row?{...row}:null;
  let after,afterRow,created=[];
  try{let value;try{value=T.change(this.localAdapter(),input);}finally{after=db[T.ROOT];afterRow=row?{...row}:null;created=db.raceclasses.filter(c=>!classes.has(c.id)).map(c=>c.id);}await this.commit();return value;}
  catch(e){
   if(db[T.ROOT]===after){if(before===undefined)delete db[T.ROOT];else db[T.ROOT]=before;}
   if(row&&saved){for(const k of [...COPY_FIELDS,'paddock'])if(row[k]===afterRow[k]){if(Object.hasOwn(saved,k))row[k]=saved[k];else delete row[k];}this.db.touch(row);}
   db.raceclasses=db.raceclasses.filter(c=>!created.includes(c.id));throw e;
  }
 }
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
 collectionRead(o){return this.client.paddockRead('collectionMigration',o);}
 collectionChange(input){return this.repo.execute(randomUUID(),'collectionMigration',{input});}
 historicalRead(o){return this.client.paddockRead('historicalReview',o);}
 historicalChange(o){return this.repo.execute(randomUUID(),'historicalReview',{input:o});}

 historySyncRead(o){return this.client.paddockRead('historySync',o);}
 historySyncChange(input){return this.repo.execute(randomUUID(),'syncPaddockHistory',input);}

 historyMatches(rows,databaseId){return this.client.paddockRead('historyMatches',{rows,databaseId});}
 historyCacheGet(id){return this.client.paddockRead('historyCache',{id});}
 historyCachePut(row){return this.repo.execute(randomUUID(),'cachePaddockHistory',{row});}

 sharedRead(options){return this.client.paddockRead('sharedOperations',options);}
 sharedChange(input){return this.repo.execute(randomUUID(),'sharedCarOperation',input);}

 localRead(options){return this.client.paddockRead('localTransfers',options);}
 localChange(input){return this.repo.execute(randomUUID(),'localLibraryTransfer',input);}
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
