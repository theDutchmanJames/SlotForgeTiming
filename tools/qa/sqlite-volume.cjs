// Synthetic data only. Large mode needs 16 GiB free and retains its evidence directory.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const Client=require('../../sqlite-client'),Activation=require('../../storage-activation');
const large=process.argv.includes('--large'),laps=large?1000000:20000,assetPairs=large?128:2;
const root=path.resolve(__dirname,'../../../outputs/sqlite-conversion');fs.mkdirSync(root,{recursive:true});
const free=fs.statfsSync(root);assert(free.bavail*free.bsize>(large?16:1)*1024**3,'Insufficient free space for isolated qualification');
const dir=fs.mkdtempSync(path.join(root,'volume-')),profile=path.join(dir,'profile');fs.mkdirSync(profile);
const source=path.join(profile,'slotforge-timing.json');
const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function chunk(name,b){const type=Buffer.from(name),data=Buffer.concat([type,b]);let crc=0xffffffff;for(const v of data)crc=crcTable[(crc^v)&255]^(crc>>>8);const out=Buffer.alloc(b.length+12);out.writeUInt32BE(b.length);data.copy(out,4);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;}
function png(seed){const w=1024,h=large?2048:128,pixels=Buffer.alloc((w*4+1)*h,seed);for(let y=0;y<h;y++)pixels[y*(w*4+1)]=0;const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(pixels,{level:0})),chunk('IEND',Buffer.alloc(0))]);}
function wav(seed){const b=Buffer.alloc(44+(large?8*1024*1024:512*1024),seed);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(22050,24);b.writeUInt32LE(44100,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);return b;}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const measuredSources=Object.fromEntries(fs.readdirSync(path.resolve(__dirname,'../..')).filter(f=>/^(sqlite-|storage-activation)/.test(f)&&f.endsWith('.js')).map(f=>[f,hash(fs.readFileSync(path.resolve(__dirname,'../..',f)))]));
const report={platform:process.platform,arch:process.arch,node:process.version,sqlite:process.versions.sqlite,large,laps,assetPairs,dir,measuredSources,timings:[],reads:[],peakRss:0,maxMainTimerGapMs:0};
const save=()=>fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(report,null,2));
async function measured(name,fn){const start=performance.now(),value=await fn();report.timings.push({name,ms:performance.now()-start});console.log(name+': '+Math.round(report.timings.at(-1).ms)+' ms');save();return value;}
async function main(){
 fs.writeFileSync(source,JSON.stringify({version:1,settings:{theme:'dark'},drivers:[{id:'d',name:'Volume driver'}],slotcars:[{id:'c',model:'Volume car',lapsDriven:0}],tracks:[{id:'t',name:'Volume circuit',lanes:2,length:20}],sessions:[],laps:[]}));const original=await Activation.digest(source);
 Activation.request(profile);const selected=await measured('production activation',()=>Activation.startup(profile));let client=new Client({timeoutMs:3600000});
 let last=performance.now();const timer=setInterval(()=>{const now=performance.now();report.maxMainTimerGapMs=Math.max(report.maxMainTimerGapMs,now-last);last=now;report.peakRss=Math.max(report.peakRss,process.memoryUsage().rss);},20);
 const assets=[];
 try{
  await measured('open',()=>client.openWorking(path.join(selected.directory,'working')));
  await measured('finalize lap history',async()=>{const batch=large?50000:10000;for(let start=0;start<laps;start+=batch){const rows=Array.from({length:Math.min(batch,laps-start)},(_,i)=>({carId:'c',driverId:'d',trackId:'t',lane:1,lapNumber:i+1,time:5000+i%1000,valid:true,pit:false,date:'2026-11-03'}));await client.command({id:'race-'+start,type:'finalizeSession',session:{saveKey:'run-'+start,trackId:'t',sessionType:'race',date:'2026-11-03',standings:[]},laps:rows});console.log('laps committed '+(start+rows.length));}});
  await measured('store image and audio collection',async()=>{for(let i=0;i<assetPairs;i++){for(const kind of ['image','audio']){const bytes=kind==='image'?png(i):wav(i),entity=kind==='image'?'imagesets':'audiosets',mime=kind==='image'?'image/png':'audio/wav';const result=await client.command({id:kind+i,type:'addRecord',entity,item:{name:kind+' '+i,fixtureMedia:'data:'+mime+';base64,'+bytes.toString('base64')}});assets.push({entity,id:result.recordId,sha256:hash(bytes),size:bytes.length});}if(i%16===0)console.log('asset pairs committed '+(i+1));}});
  report.assetBytes=assets.reduce((n,a)=>n+a.size,0);
  for(let i=0;i<5;i++){let start=performance.now();const page=await client.catalogue('slotcars',{limit:50});assert.equal(page.items.length,1);assert(!JSON.stringify(page).includes('base64'));report.reads.push({name:'catalogue page',ms:performance.now()-start,bytes:Buffer.byteLength(JSON.stringify(page))});}
  await measured('single field edits x100',async()=>{for(let i=0;i<100;i++)await client.command({id:'edit-'+i,type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:await client.revision('drivers','d'),patch:{name:'Driver '+i}});});
  assert.equal((await client.field('slotcars','c',['lapsDriven'])).value,laps);
  for(const a of [assets[0],assets.at(-1)])assert.equal(hash((await client.asset(a.entity,a.id,['fixtureMedia'])).bytes),a.sha256);
  const backup=path.join(dir,'snapshot');await measured('native snapshot and full verification',()=>client.backupSnapshot(backup));
  const restored=path.join(dir,'restored');await measured('restore native snapshot and full verification',()=>client.restoreSnapshot(backup,restored));
  await client.close();client=new Client({timeoutMs:3600000});await measured('reopen restored',()=>client.openWorking(restored));
  assert.equal((await client.field('drivers','d',['name'])).value,'Driver 99');assert.equal((await client.field('slotcars','c',['lapsDriven'])).value,laps);assert(await client.receipt('race-0'));
  for(const a of [assets[0],assets.at(-1)])assert.equal(hash((await client.asset(a.entity,a.id,['fixtureMedia'])).bytes),a.sha256);
  report.databaseBytes=fs.statSync(path.join(restored,'working.sqlite')).size;
  assert.equal(await Activation.digest(source),original);report.sourceUnchanged=true;report.status='passed';
 }catch(e){report.status='failed';report.error=e.stack;throw e;}finally{clearInterval(timer);await client.close().catch(()=>{});save();}
 console.log('VOLUME PASS '+dir);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
