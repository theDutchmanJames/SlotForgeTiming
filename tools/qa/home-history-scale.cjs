'use strict';
// Copy only a completed synthetic fixture. Never open the user's profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../outputs/sqlite-conversion'),fixture=fs.realpathSync(process.argv[2]);
assert.equal(path.dirname(fixture),fs.realpathSync(root));assert(path.basename(fixture).startsWith('volume-'));
const seed=JSON.parse(fs.readFileSync(path.join(fixture,'result.json')));assert.equal(seed.status,'passed');assert.equal(seed.dir,fixture);
const selected=require('../../storage-activation').selected(path.join(fixture,'profile')),out=fs.mkdtempSync(path.join(root,'home-performance-')),working=path.join(out,'working');fs.mkdirSync(working);
const source=path.join(selected.directory,'working','working.sqlite');assert(!fs.existsSync(source+'-wal')||fs.statSync(source+'-wal').size===0);
fs.copyFileSync(source,path.join(working,'working.sqlite'));
const {performance}=require('node:perf_hooks'),D=require('../../dashboard-read'),{WorkingStore}=require('../../sqlite-working');
let start=performance.now(),s=new WorkingStore(working);const upgradeMs=performance.now()-start;console.log('Index built in '+upgradeMs+' ms');
const src=require('../../sqlite-dashboard').source(s),tracks=src.meta('tracks'),drivers=src.meta('drivers');
const request={trackId:tracks[0]?.id||'',driverIds:drivers.map(x=>x.id),grid:drivers.map(x=>({driverId:x.id,color:'#fff'})),now:new Date().toISOString(),boards:['record','glance'].map(key=>({key,count:5,period:'all',scope:'all'}))};
start=performance.now();const baseline=D.home({...src,homeSummary:undefined},request),baselineMs=performance.now()-start;
const timings=[];let result;for(let i=0;i<3;i++){start=performance.now();result=s.homeStatistics(request);timings.push(performance.now()-start);}
// Compare distance to a millimetre: grouped multiplication avoids accumulated addition error.
const round=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='distance'&&typeof v==='number'?Math.round(v*1e3)/1e3:v));assert.deepEqual(round(result),round(baseline));
const all={...request,boards:D.CARDS.map(key=>({key,count:5,period:'all',scope:'all'}))};start=performance.now();const allResult=s.homeStatistics(all),allCardsMs=performance.now()-start;
s.close();start=performance.now();s=new WorkingStore(working);const reopenMs=performance.now()-start;assert.deepEqual(round(s.homeStatistics(request)),round(baseline));s.close();
const report={out,working,source,platform:process.platform,upgradeMs,baselineMs,homeMs:timings,allCardsMs,reopenMs,laps:seed.laps,resultBytes:Buffer.byteLength(JSON.stringify(allResult)),status:'passed'};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
