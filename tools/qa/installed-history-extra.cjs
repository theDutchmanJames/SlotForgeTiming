'use strict';
// Copied beside Paddock's adapted drivers in a disposable package directory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root,js,until,start,stop,command,pass,checks,run,capture}=require('./qualify-installed-history.cjs');
const source=JSON.parse(fs.readFileSync(path.resolve(root,'../../source.json')));
async function request(code){for(let n=0;;n++){try{return await js('timing',code);}catch(e){if(n===5||!e.message.includes('Wait for the current Paddock operation.'))throw e;await new Promise(r=>setTimeout(r,250*(n+1)));}}}
async function ready(){await until('timing','!!state.schema.slotcars');await until('timing','!(await api.paddockStatus()).busy');}
async function stats(){return request("return (await api.paddockHistory({kind:'statistics',carId:'car-a',protocol:'shared'})).value");}
async function view(id,revision){
 await request("state.tab='database';state.sub='results';state.resultsSub='racing';await render();");
 await until('timing',`[...document.querySelectorAll('.central-session')].some(x=>x.textContent.includes('Interrupted measured qualification')&&x.textContent.includes('revision ${revision}'))`);
 await request("[...document.querySelectorAll('.central-session')].find(x=>x.textContent.includes('Interrupted measured qualification')).open=true;");
 await until('timing','!!document.querySelector(".central-session[open] [data-central-laps] table")');
 await capture('timing','reader-revision-'+revision);
}
async function main(){
 await start('paddock');await until('paddock',"typeof db!=='undefined'&&!!db.id");await start('timing');await ready();
 assert.equal((await js('timing','return await api.paddockStatus()')).connection.historyGuard.richWrites,true);
 const before=await stats(),car=await request("return api.paddockLink('car-a')"),captured=await request(`return api.paddockPrepare([${JSON.stringify(car.id)}])`);
 const e=structuredClone(require(path.join(source.paddock,'tests/fixtures/timing-production-mapper/race.json')).evidence),j=e.session.paddockJournal,h=j.heats[0],entry=h.entries[0],n=4000;
 e.session.id='interrupted-rich-'+Date.now();e.session.setupName='Interrupted measured qualification';j.captures=captured.captures;entry.carId=car.id;h.endedAt=h.startedAt+n*10000;
 entry.laps=Array.from({length:n},(_,i)=>({...entry.laps[0],number:i+1,time:10000,at:h.startedAt+(i+1)*10000}));j.classifiedTimes={[car.id]:n*10000};Object.assign(e.session.standings[0],{carId:car.id,laps:n,total:n*10000,best:10000});
 e.laps=entry.laps.map((l,i)=>({carId:car.id,driverId:'driver',driverName:'Synthetic driver',lane:1,lapNumber:i+1,time:l.time,valid:true,pit:false}));
 await command('timing','arm-upload-interruption');
 const id=await js('timing',`return api.saveSession(${JSON.stringify(e.session)},${JSON.stringify(e.laps)})`);
 let interrupted;for(let i=0;i<200;i++){interrupted=(await command('timing','status')).uploadInterrupted;if(interrupted)break;await new Promise(r=>setTimeout(r,100));}
 assert(interrupted&&interrupted.status===200,'An actual accepted chunk response was withheld');
 const readyInfo=JSON.parse(fs.readFileSync(path.join(root,'control/timing/ready.json')));
 // Kill only the PID returned by this disposable executable's own handshake.
 assert(readyInfo.exe.startsWith(root+path.sep)&&readyInfo.packaged);process.kill(readyInfo.pid);
 await new Promise(r=>setTimeout(r,1000));
 // Query the host directly while Timing is down: partial bytes are not history.
 const discovery=path.join(root,'isolated-local/SlotForge/local-libraries/v1'),file=fs.readdirSync(discovery).find(x=>/^[a-f0-9]{64}\.json$/.test(x)),d=JSON.parse(fs.readFileSync(path.join(discovery,file)));
 const response=await fetch(d.address+'/v1/shared-history/cars/car-a/statistics',{headers:{Authorization:'Bearer '+d.token,'X-SlotForge-Instance':d.instanceId,'X-SlotForge-Database':d.databaseId},signal:AbortSignal.timeout(10000)});assert.equal(response.status,200);const partial=await response.json();assert.equal(partial.acceptedSessions,before.acceptedSessions);assert.equal(partial.distanceM,before.distanceM);
 pass('Killed the packaged Timing process after an acknowledged first chunk; partial upload changed no history/statistics');
 await start('timing');await ready();await request('return api.paddockRetry()');
 await until('timing',`(await api.paddockStatus()).deliveries.some(r=>r.sessionId===${JSON.stringify(id)}&&r.status==='sent')`);
 const resumed=await command('timing','status');assert(resumed.uploadRequests.length>0);assert(resumed.uploadRequests.every(p=>!p.endsWith('/chunks/0')),'The accepted chunk was not uploaded again');
 const accepted=await stats();assert.equal(accepted.acceptedSessions,before.acceptedSessions+1);assert.equal(accepted.distanceM,before.distanceM+n*20);
 pass('Restart resumed only missing chunks and committed one 4,000-lap rich session');
 await view(id,1);
 const evidence=await js('timing',`return api.historySession('racing',${JSON.stringify(id)},{exportAll:true})`);assert.equal(evidence.total,n);
 await js('timing',`return api.update('laps',${JSON.stringify(evidence.laps[0].id)},{noTrackRecord:true})`);await request('return api.paddockRetry()');await view(id,2);
 const corrected=await stats();assert.equal(corrected.trackRecordLaps,accepted.trackRecordLaps-1);assert.equal(corrected.personalRecordLaps,accepted.personalRecordLaps);assert.equal(corrected.distanceM,accepted.distanceM);
 pass('Normal Results reader refresh displayed revision 2; corrected track-record eligibility changed without changing personal best or distance');
 await js('timing',`return api.removeSession(${JSON.stringify(id)})`);await request('return api.paddockRetry()');
 await request("state.tab='database';state.sub='results';state.resultsSub='racing';await render()");await until('timing',"[...document.querySelectorAll('.central-session')].some(x=>x.textContent.includes('Interrupted measured qualification')&&x.textContent.includes('Withdrawn'))");
 const withdrawn=await stats();assert.equal(withdrawn.distanceM,before.distanceM);assert.equal(withdrawn.acceptedSessions,before.acceptedSessions);
 await capture('timing','reader-withdrawn');pass('Reader refresh shows withdrawn history and its accepted contribution is removed');
 for(const role of ['paddock','timing'])assert.deepEqual((await command(role,'status')).errors,[]);
 await stop('timing');await stop('paddock');fs.writeFileSync(path.join(root,'extra-result.json'),JSON.stringify({passed:true,checks,interrupted,statistics:{before,partial,accepted,corrected,withdrawn}},null,2));
}
void run(main,'extra');
