'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const Database=require('../../db'),Repository=require('../../data-repository'),{migrateCopy}=require('../../sqlite-migration'),{forkCopy,WorkingStore}=require('../../sqlite-working'),{SqliteCompatibilityReads}=require('../../compatibility-read'),UI=require('../../renderer/editordata');
const out=path.resolve(__dirname,'../../../outputs/setup-history-review');fs.mkdirSync(out,{recursive:true});const median=a=>a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)];
async function measure(fn){await fn();const reads=[],serial=[];let bytes;for(let i=0;i<3;i++){const start=performance.now(),value=await fn(),mid=performance.now(),text=JSON.stringify(value),end=performance.now();reads.push(mid-start);serial.push(end-mid);bytes=Buffer.byteLength(text);}return {readMedianMs:median(reads),serializationMedianMs:median(serial),returnedBytes:bytes};}
(async()=>{const results=[];for(const spec of [{name:'small',unrelated:10,lapsPerOther:10},{name:'large',unrelated:900,lapsPerOther:100}]){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-history-benchmark-'));let db,store;try{
  db=new Database(path.join(dir,'source.json'));require('../../tests/fixtures/setup-history.cjs')(db,{unrelated:spec.unrelated,lapCount:600});
  for(let i=0;i<spec.unrelated;i++)for(let n=0;n<spec.lapsPerOther;n++)db.data.laps.push({id:'volume-'+i+'-'+n,sessionId:'other-'+i,driverId:'d',lapNumber:n+2,time:7000+n,lane:1});db.saveNow();
  const checksum=()=>require('node:crypto').createHash('sha256').update(fs.readFileSync(db.file)).digest('hex'),before=checksum();migrateCopy({source:db.file,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(dir,'work'));store=new WorkingStore(path.join(dir,'work'));
  const json=new Repository(db),sqlite=new SqliteCompatibilityReads({compatibilityRead:(...args)=>store.compatibilityRead(...args)});sqlite.editorRead=(...args)=>store.editorRead(...args);
  for(const [backend,repo] of [['json',json],['sqlite',sqlite]]){
   const previousRival=await measure(async()=>({sessions:await repo.list('sessions'),laps:await repo.list('laps')})),choices=await measure(()=>UI.setupHistory(repo,'rival-sources')),selected=await measure(()=>UI.setupHistory(repo,'rival-laps',{id:'recording'}));
   const previousChamp=await measure(()=>repo.list('sessions')),progress=await measure(()=>UI.setupHistory(repo,'champ-progress',{champIds:['cup','other']})),championship=await measure(()=>UI.setupHistory(repo,'champ-sessions',{champIds:['cup']}));
   const result={fixture:{...spec,sessions:db.data.sessions.length,laps:db.data.laps.length},backend,previousRival,choices,selected,previousChamp,progress,championship};results.push(result);console.log(JSON.stringify(result));
  }
  assert.equal(checksum(),before);assert.equal(store.statement('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{store?.close();await db?.writesIdle();fs.rmSync(dir,{recursive:true,force:true});}
}fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify({date:new Date().toISOString(),node:process.version,platform:process.platform,notes:'Synthetic profiles only. Three warm samples after warmup; read and JSON serialization measured separately, not total screen latency. Previous Rival loads all sessions/laps even on list; the new Rival list performs no history reads. Choices and selected reads are editor-only. No scoring or write changes.',results},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
