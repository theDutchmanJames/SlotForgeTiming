'use strict';
// Public scalable-v1 only. Cursors are opaque and published by the caller's
// catalogue transaction; downloading a page never acknowledges it locally.
const {createHash}=require('node:crypto');
const ROOT='/v1/scalable',MAX=8*1024*1024,PHOTO=12*1024*1024;
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const cursor=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,512}$/.test(x);
function check(ok){if(!ok)throw Error('Invalid Paddock scalable response; the previous catalogue was kept.');}
function media(value,carId){
 if(value===null)return null;
 check(value&&/^[a-f0-9]{64}$/.test(value.hash)&&['image/png','image/jpeg','image/webp'].includes(value.mime)&&Number.isSafeInteger(value.size)&&value.size>0&&value.size<=PHOTO&&value.encoding==='utf8-data-uri'&&value.url===`${ROOT}/cars/${carId}/media/${value.hash}`);
 return {hash:value.hash,mime:value.mime,size:value.size,encoding:value.encoding,url:value.url};
}
function car(c){
 check(c&&id(c.id)&&Number.isSafeInteger(c.revision)&&c.revision>=0&&typeof c.archived==='boolean');
 check(['name','maker','marque','model','scale','raceClass','availability'].every(k=>typeof c[k]==='string'&&c[k].length<=10000));
 return {id:c.id,revision:c.revision,...Object.fromEntries(['name','maker','marque','model','scale','raceClass','availability','archived'].map(k=>[k,c[k]])),media:media(c.media,c.id)};
}
class Scalable {
 constructor(call,databaseId){this.call=(route)=>call(route,undefined,MAX);this.databaseId=databaseId;this.photos=new Map();this.bytes=0;this.pending=new Map();}
 base(v){if(v?.databaseId!==this.databaseId)throw Object.assign(Error('Paddock database identity changed.'),{code:'DATABASE_MISMATCH'});check(v&&v.version===1);return v;}
 async listing(attempt=0){
  const cars=[],seen=new Set();let offset=0,snapshot,applied,total=0;
  try{for(let n=0;n<201;n++){
   const v=this.base(await this.call(ROOT+'/cars'+(offset?'?offset='+offset+'&snapshot='+encodeURIComponent(snapshot):'')));
   check(cursor(v.snapshot)&&cursor(v.cursor)&&v.snapshot===v.cursor&&(!snapshot||v.snapshot===snapshot)&&Array.isArray(v.cars)&&v.cars.length<=50);
   snapshot=v.snapshot;applied=v.cursor;total+=Buffer.byteLength(JSON.stringify(v));check(total<=200*1024*1024);
   for(const raw of v.cars){const c=car(raw);check(!seen.has(c.id));seen.add(c.id);cars.push(c);}check(cars.length<=10000);
   if(v.nextOffset===null)return {cars,cursor:applied};
   check(v.cars.length>0&&v.nextOffset===offset+v.cars.length);offset=v.nextOffset;
  }}catch(e){if(e.code==='SNAPSHOT_CHANGED'&&attempt===0)return this.listing(1);throw e;}
  throw Error('Paddock catalogue exceeds the supported page count.');
 }
 async changes(applied){
  check(cursor(applied));const entries=new Map();let next=applied;
  for(let n=0;n<16;n++){
   const v=this.base(await this.call(ROOT+'/changes?kind=cars&cursor='+encodeURIComponent(next)));
   check(v.kind==='cars'&&cursor(v.cursor)&&typeof v.resetRequired==='boolean'&&typeof v.more==='boolean'&&Array.isArray(v.entries)&&v.entries.length<=512);
   if(v.resetRequired)return {reset:true};
   check(!v.more||v.cursor!==next);
   for(const e of v.entries){check(e&&id(e.carId)&&['remove','invalidate'].includes(e.operation));entries.set(e.carId,e.operation);}
   next=v.cursor;if(!v.more)return {entries,cursor:next};
  }
  throw Error('Paddock is changing too quickly. Refresh again shortly.');
 }
 async profile(carId){
  check(id(carId));const v=await this.call(ROOT+'/cars/'+carId+'/profile'),p=v?.profile;
  if(p&&p.databaseId!==this.databaseId)throw Object.assign(Error('Paddock database identity changed.'),{code:'DATABASE_MISMATCH'});
  check(v?.version===1&&p?.integrationVersion===1&&p.databaseId===this.databaseId&&p.car?.id===carId&&p.car.picture===''&&p.configuration?.carId===carId&&p.configuration.databaseId===this.databaseId&&/^[a-f0-9]{64}$/.test(p.configuration.signature)&&Number.isFinite(Date.parse(p.configuration.capturedAt)));
  const ref=media(v.media,carId);
  car({...p.car,revision:p.configuration.carRevision,media:ref});
  return {...p,media:ref};
 }
 cached(ref){if(!ref)return '';const p=this.photos.get(ref.hash);if(!p)return '';this.photos.delete(ref.hash);this.photos.set(ref.hash,p);return p;}
 async picture(ref){
  if(!ref)return '';const cached=this.cached(ref);if(cached)return cached;
  const key=ref.url;if(this.pending.has(key))return this.pending.get(key);
  const work=this.download(ref);this.pending.set(key,work);try{return await work;}finally{this.pending.delete(key);}
 }
 async download(ref){
  const chunks=[];let offset=0;
  while(offset<ref.size){
   const v=this.base(await this.call(ref.url+'?offset='+offset));
   check(v.hash===ref.hash&&v.offset===offset&&v.size===ref.size&&typeof v.data==='string'&&v.data.length<=349528&&/^[A-Za-z0-9+/]+={0,2}$/.test(v.data));
   const chunk=Buffer.from(v.data,'base64');check(chunk.length>0&&chunk.length<=262144&&chunk.toString('base64')===v.data&&offset+chunk.length<=ref.size);
   offset+=chunk.length;check(v.nextOffset===(offset===ref.size?null:offset));chunks.push(chunk);
  }
  const bytes=Buffer.concat(chunks),picture=bytes.toString('utf8');
  check(createHash('sha256').update(bytes).digest('hex')===ref.hash&&Buffer.from(picture,'utf8').equals(bytes)&&picture.startsWith('data:'+ref.mime+';base64,')&&/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(picture));
  // Bounded shared-photo cache; linked cars retain their durable offline image.
  if(!this.photos.has(ref.hash)){this.photos.set(ref.hash,picture);this.bytes+=bytes.length;}
  while(this.bytes>32*1024*1024){const key=this.photos.keys().next().value;this.bytes-=Buffer.byteLength(this.photos.get(key));this.photos.delete(key);}
  return picture;
 }
}
module.exports={Scalable,car,media,ROOT,MAX};
