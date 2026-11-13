'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const fixture=require('./support/shared-library-merge-fixture'),engine=require('../vendor/slotforge-library/index.cjs');
function png(width,height,colour=37){
 const chunk=(type,body)=>{const name=Buffer.from(type),b=Buffer.alloc(body.length+12);b.writeUInt32BE(body.length);name.copy(b,4);body.copy(b,8);b.writeUInt32BE(zlib.crc32(Buffer.concat([name,body])),b.length-4);return b;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const pixels=Buffer.alloc((width*4+1)*height,colour);for(let y=0;y<height;y++)pixels[y*(width*4+1)]=0;
 return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
const original=png(1400,800),thumbnail=png(512,293);
for(const backend of ['json','sqlite']){
 test(backend+': one overview read preserves fields and coalesces duplicate catalogue requests',async t=>{
  const {client,db,worker,peer}=await fixture(t,backend,d=>{d.slotcars[0].picture=original;d.slotcars[0].extraPictures=[original];for(let n=0;n<55;n++)d.slotcars.push({id:'car-'+n,brand:'NSR',model:'Car '+String(n).padStart(2,'0'),picture:original,tyreCompound:'H',damageFactor:1.2,custom:{keep:n}});});
  const base=worker?new(require('../sqlite-app-repository'))(worker):new(require('../data-repository'))(db),records=require('../shared-library-records').wrap(base,client);
  let reads=0;const read=client.handle.catalogueOverview;client.handle.catalogueOverview=o=>{reads++;return read(o);};
  const pages=await Promise.all(Array.from({length:20},()=>records.catalogue('slotcars',{limit:48})));
  assert.equal(reads,1);assert.equal(pages[0].items.length,48);assert(pages[0].next);
  const row=pages[0].items.find(r=>r.record.id==='car-0');assert.equal(row.record.tyreCompound,'H');assert.equal(row.record.damageFactor,1.2);assert.equal(row.record.custom.keep,'0');assert(row.hasPicture);assert(!JSON.stringify(pages).includes('data:image'));
  const next=await records.catalogue('slotcars',{limit:48,cursor:pages[0].next});assert.equal(next.items.length,8);
  const detail=await records.get('slotcars','old-car');assert.equal(detail.picture,original);assert.deepEqual(detail.extraPictures,[original]);
  const s=await peer.status(),car=await client.car('old-car');await peer.carWrite({databaseId:s.databaseId,recoveryId:s.recoveryId,operationId:'change-car',action:'patch',carId:car.id,expectedRevision:car.revision,set:{name:'Updated car'},clear:[]});
  await assert.rejects(records.catalogue('slotcars',{limit:48,cursor:pages[0].next}),/changed/i);
  await Promise.all(Array.from({length:90},()=>client.handle.status()));
 });
 test(backend+': persisted thumbnails are shared across handles and reopen; originals and revisions stay unchanged',async t=>{
  const {client,options}=await fixture(t,backend,d=>{d.slotcars[0].picture=original;d.slotcars[0].extraPictures=[png(1000,700,45)];});
  let encodes=0;const opts={application:'thumbnail QA',installationId:'thumb-test',sharedRoot:options.sharedRoot,legacyProfiles:[],thumbnailEncoder:async source=>{encodes++;assert.equal(source,original);await new Promise(r=>setTimeout(r,30));return thumbnail;}};
  const a=await engine.open(opts),b=await engine.open(opts),carId=client.canonicalId('old-car'),before=await a.status();
  try{
   assert.deepEqual(await Promise.all([a.thumbnail({carId}),b.thumbnail({carId}),a.thumbnail({carId})]),[thumbnail,thumbnail,thumbnail]);assert.equal(encodes,1);
   assert.deepEqual(await a.status(),before);assert.equal((await a.car(carId,{includeMedia:true})).picture,original);
  }finally{await a.close();await b.close();}
  const reopened=await engine.open({...opts,thumbnailEncoder:()=>{throw Error('A cache hit must not decode the original.');}});
  try{assert.equal(await reopened.thumbnail({carId}),thumbnail);}finally{await reopened.close();}
  // A damaged derivative is rebuilt, without touching a canonical car or photo.
  const cache=new(require('node:sqlite').DatabaseSync)(path.join(options.sharedRoot,'thumbnails/png-512-v1/cache.sqlite'));cache.exec("UPDATE thumbnails SET data='damaged'");cache.close();
  const repaired=await engine.open(opts);try{assert.equal(await repaired.thumbnail({carId}),thumbnail);assert.equal(encodes,2);}finally{await repaired.close();}
 });
}
test('changed and removed photos cannot reuse stale thumbnails',async t=>{
 const {client,options}=await fixture(t,'json',d=>{d.slotcars[0].picture=original;});let encodes=0;
 const a=await engine.open({application:'thumbnail QA',installationId:'thumb-test',sharedRoot:options.sharedRoot,legacyProfiles:[],thumbnailEncoder:async()=>{encodes++;return thumbnail;}}),carId=client.canonicalId('old-car');
 try{
  await a.thumbnail({carId});const car=await a.car(carId),s=await a.status();
  const store=new(require('../vendor/slotforge-library/engine/src/store.cjs').Store)(client.bootstrap.file,{deferred:true});store.mutate('car.save',{id:carId,revision:car.revision,data:{picture:png(1400,800,66)}},{snapshot:false});
  await a.thumbnail({carId});assert.equal(encodes,2);
  const newer=await a.car(carId);const changed=new(require('../vendor/slotforge-library/engine/src/store.cjs').Store)(client.bootstrap.file,{deferred:true});changed.mutate('car.save',{id:carId,revision:newer.revision,data:{picture:''}},{snapshot:false});
  assert.equal(await a.thumbnail({carId}),null);
 }finally{await a.close();}
});
test('thumbnail validation rejects originals, invalid identifiers and oversize previews',()=>{
 const cache=require('../vendor/slotforge-library/engine/src/shared-thumbnails.cjs');assert(cache.valid(thumbnail));assert(!cache.valid(original));assert(!cache.valid('not an image'));assert.throws(()=>cache.storeResult('unused',{key:'../outside',lease:'x',data:thumbnail}));
});
test('abandoned leases expire; old encoders cannot overwrite a newer thumbnail',async t=>{
 const {client,options}=await fixture(t,'json',d=>{d.slotcars[0].picture=original;});
 const cache=require('../vendor/slotforge-library/engine/src/shared-thumbnails.cjs'),Store=require('../vendor/slotforge-library/engine/src/store.cjs').Store;
 const input={carId:client.canonicalId('old-car')},read=()=>cache.read(new Store(client.bootstrap.file,{deferred:true}),options.sharedRoot,input);
 const first=read();assert(first.source);assert(read().pending);
 const db=new(require('node:sqlite').DatabaseSync)(path.join(options.sharedRoot,'thumbnails/png-512-v1/cache.sqlite'));db.exec('UPDATE thumbnails SET expires=0');db.close();
 const second=read();assert(second.lease!==first.lease);assert.equal(cache.storeResult(options.sharedRoot,{...first,data:thumbnail}).stored,false);
 assert.equal(cache.storeResult(options.sharedRoot,{...second,data:thumbnail}).stored,true);assert.equal(read().data,thumbnail);assert.equal(read().source,undefined);
});
test('failed encoders release their claim and the next client can generate the preview',async t=>{
 const {client,options}=await fixture(t,'json',d=>{d.slotcars[0].picture=original;});const carId=client.canonicalId('old-car');
 const a=await engine.open({application:'QA failed codec',installationId:'codec-test',sharedRoot:options.sharedRoot,legacyProfiles:[],thumbnailEncoder:async()=>{throw Error('decode failed');}});
 try{await assert.rejects(a.thumbnail({carId}),/decode failed/);}finally{await a.close();}
 const b=await engine.open({application:'QA good codec',installationId:'codec-test',sharedRoot:options.sharedRoot,legacyProfiles:[],thumbnailEncoder:async()=>thumbnail});
 try{assert.equal(await b.thumbnail({carId}),thumbnail);}finally{await b.close();}
});
test('snapshot changes reject thumbnail reads without serving the wrong picture',async t=>{
 const {client,peer}=await fixture(t,'json',d=>{d.slotcars[0].picture=original;});const page=await peer.catalogue({limit:1}),carId=client.canonicalId('old-car'),car=await peer.car(carId),s=await peer.status();
 await peer.carWrite({databaseId:s.databaseId,recoveryId:s.recoveryId,operationId:'change-for-token',action:'patch',carId,expectedRevision:car.revision,set:{name:'Changed'},clear:[]});
 await assert.rejects(peer.thumbnail({carId,token:page.token}),e=>e.code==='QUERY_CHANGED');
});
module.exports={png};
