'use strict';
// Synthetic databases only. Compare the previous overview read with the new
// projection, including serialization, separately from full selected-set reads.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const Database=require('../../db'),Repository=require('../../data-repository'),{migrateCopy}=require('../../sqlite-migration'),{forkCopy,WorkingStore}=require('../../sqlite-working'),{SqliteCompatibilityReads}=require('../../compatibility-read'),UI=require('../../renderer/editordata');
const out=path.resolve(__dirname,'../../../outputs/media-read-review');fs.mkdirSync(out,{recursive:true});
const median=a=>a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)];
async function measure(fn,repetitions){
 await fn();const reads=[],serializations=[];let bytes,items;
 for(let n=0;n<repetitions;n++){const start=performance.now(),value=await fn(),read=performance.now(),encoded=JSON.stringify(value),end=performance.now();reads.push(read-start);serializations.push(end-read);bytes=Buffer.byteLength(encoded);items=Array.isArray(value)?value.length:1;}
 return {readMedianMs:median(reads),serializationMedianMs:median(serializations),returnedBytes:bytes,items,repetitions};
}
(async()=>{
 const results=[];
 for(const spec of [{name:'small',sets:4,assetKiB:16,laps:100},{name:'large',sets:64,assetKiB:256,laps:20000}]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-media-benchmark-'));let store,db;
  try{
   db=new Database(path.join(dir,'source.json'));
   const media=(type,n)=>'data:'+type+';base64,'+Buffer.alloc(spec.assetKiB*1024,n).toString('base64');
   db.data.imagesets=Array.from({length:spec.sets},(_,i)=>({id:'im-'+i,name:'Pictures '+i,kind:'fuel',steps:4,images:[media('image/png',1),media('image/png',2),'',media('image/png',3)]}));
   db.data.audiosets=Array.from({length:spec.sets},(_,i)=>{const set=require('../../renderer/sound').defaultSet('Audio '+i);set.id='au-'+i;set.calls.prerace={on:true,lines:[{text:'Ready',file:media('audio/wav',4)}]};return set;});
   db.data.sessions=[{id:'s',date:'2026-11-15T10:00:00Z',standings:[]}];db.data.laps=Array.from({length:spec.laps},(_,i)=>({id:'lap-'+i,sessionId:'s',time:7000+i%100,carId:'c',driverId:'d',trackId:'t',lapNumber:i+1}));
   db.saveNow();const hash=()=>require('node:crypto').createHash('sha256').update(fs.readFileSync(db.file)).digest('hex'),before=hash();
   migrateCopy({source:db.file,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(dir,'work'));store=new WorkingStore(path.join(dir,'work'));
   const json=new Repository(db),sqlite=new SqliteCompatibilityReads({compatibilityRead:(...args)=>store.compatibilityRead(...args)});
   for(const [backend,repo,read] of [['json',json,(...args)=>json.editorRead(...args)],['sqlite',sqlite,(...args)=>store.editorRead(...args)]])for(const entity of ['imagesets','audiosets']){
    const previous=await measure(()=>repo.list(entity),3),overview=await measure(()=>UI.choices({editorRead:read},entity,'media'),3),selected=await measure(()=>repo.get(entity,entity==='imagesets'?'im-0':'au-0'),3);
    results.push({fixture:spec,backend,entity,previous,overview,selected});console.log(spec.name,backend,entity,JSON.stringify({previous,overview,selected}));
   }
   assert.equal(hash(),before);assert.equal(store.statement('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{store?.close();await db?.writesIdle();fs.rmSync(dir,{recursive:true,force:true});}
 }
 fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify({date:new Date().toISOString(),node:process.version,platform:process.platform,notes:'Warm medians, three samples after warmup. Read and JSON serialization measured separately; not full UI/startup latency. Synthetic media payloads, disposable profiles. No write-path changes.',results},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
