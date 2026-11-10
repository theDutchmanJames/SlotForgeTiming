'use strict';
const H=require('./history-read'),D=require('./dashboard-read'),Home=require('./renderer/homestats'),E=require('./renderer/engine'),C=require('./catalogue-read');
const scoped=(source,id,own)=>source===own?id:'shared:'+JSON.stringify([source,id]);
const tokenString=v=>JSON.stringify(v);
function decode(v){try{const r=JSON.parse(v);if(!r||typeof r.private!=='string'||!r.shared)throw Error();return r;}catch{throw Error('Invalid shared history page.');}}
async function read(client,options){try{const before=await client.status(),result=await client.handle.timingRead(options);if(result.databaseId!==before.databaseId||result.recoveryId!==before.recoveryId)throw C.stale();return result;}catch(e){if(['QUERY_CHANGED','SNAPSHOT_CHANGED'].includes(e.code))throw C.stale();throw e;}}
function mappedRecord(r,client){return {id:r.sourceId===client.installationId&&r.originLapId?r.originLapId:'shared:'+JSON.stringify([r.sourceId,r.sessionId,r.lapId]),readOnly:r.sourceId!==client.installationId||!r.originLapId,sessionId:scoped(r.sourceId,r.sessionId,client.installationId),trackId:scoped(r.sourceId,r.trackId,client.installationId),driverId:scoped(r.sourceId,r.driverId,client.installationId),carId:client.localId(r.carId),lane:r.lane,lapNumber:r.lapNumber,time:r.durationMs,date:r.startedAt||r.savedAt||'',dateBasis:r.startedAt?'started':r.savedAt?'saved':null,noPersonalBest:false,noTrackRecord:false};}
async function historyPage(base,client,pool,options={}){
 const o=H.options(pool,options),active=Object.values(o).filter(Boolean),expected=active.length?decode(active[0].revision):null;
 if(active.some(c=>c.revision!==active[0].revision))throw C.stale();
 const local=await base.historyPage(pool);if(expected&&local.revision!==expected.private)throw C.stale();
 let token=expected?.shared;const sections={},refs=local.refs;
 if(!token)token=(await read(client,{kind:'resultSessions',limit:1})).token;
 for(const section of ['tracks','personal']){
  if(pool==='tokens')continue;
  const page=await read(client,{kind:'records',grouping:'timing',scope:section==='tracks'?'track':'personal',offset:o[section]?.offset||0,limit:40,token});token=page.token;
  sections[section]={items:page.rows.map(r=>mappedRecord(r,client)),nextOffset:page.nextOffset};
  for(const r of page.rows){const m=mappedRecord(r,client),[track,car]=await base.historyReferences([{entity:'tracks',id:r.sourceId===client.installationId?r.trackId:''},{entity:'slotcars',id:m.carId}]);refs.tracks.push({...H.pick(track,H.TRACK),id:m.trackId,name:r.trackName});refs.drivers.push({id:m.driverId,name:r.driverName||'Unknown driver'});refs.slotcars.push({...H.pick(car,['scale']),id:m.carId,name:r.carName,model:r.carName});refs.sessions.push({id:m.sessionId,setupName:r.sessionName});}
 }
 if(pool==='tokens'){
  const p=await base.historyPage(pool,Object.fromEntries(['tracks','personal'].map(k=>[k,o[k]?{...o[k],revision:local.revision}:null])));
  sections.tracks=p.tracks;sections.personal=p.personal;Object.keys(refs).forEach(k=>refs[k].push(...p.refs[k]||[]));
 }
 const sessions=await require('./shared-library-results').sessions(base,client,pool,o.sessions,local.revision,token,read);
 const revision=tokenString({private:local.revision,shared:token});
 for(const section of ['tracks','personal']){const p=sections[section];if(pool==='tokens'){if(p.next)p.next={...p.next,revision};}else{p.next=p.nextOffset===null?null:{pool,section,revision,offset:p.nextOffset};delete p.nextOffset;}}
 if(sessions.next)sessions.next={...sessions.next,pool,section:'sessions',revision};
 return {...local,...sections,sessions,revision,refs};
}
async function historySession(base,client,pool,id,options={}){
 const revision=options.revision|| (await historyPage(base,client,pool)).revision,r=decode(revision);
 return require('./shared-library-results').detail(base,client,pool,id,options,r,read);
}
async function carStatistics(client,id,car){
 const carId=car.sharedLibrary?.carId||client.canonicalId(id),page=await read(client,{kind:'carStatistics',carId,limit:100}),s=page.summary;
 const since=car.serviceDate&&Number.isFinite(Date.parse(car.serviceDate))?(await read(client,{kind:'carStatistics',carId,from:new Date(car.serviceDate).toISOString(),limit:1,token:page.token})).summary:s;
 const distance=x=>x.distanceComplete?x.distanceM:null;
 const tracks=page.tracks.rows.map(r=>({trackId:scoped(r.sourceId,r.trackId,client.installationId),name:r.trackName,laps:r.validLaps,best:r.bestPersonalLapMs??r.bestTrackLapMs,avg:r.averageLapMs}));
 const fast=tracks.filter(r=>r.best!==null).sort((a,b)=>a.best-b.best)[0];
 return {mileage:{laps:s.recordedLaps,distance:distance(s)},mileageSince:{laps:since.recordedLaps,distance:distance(since)},lastDriven:s.lastDrivenAt||'',sessions:s.acceptedSessions,wins:s.overallWins,deslots:null,fastest:fast?{time:fast.best,trackId:fast.trackId,trackName:fast.name}:null,tracks,tracksTotal:page.tracks.total,shared:true};
}
async function homeStatistics(base,client,options){
 const o=D.options(options),now=new Date(o.now),week=Home.weekStart(now).toISOString(),own=client.installationId;
 const global=await read(client,{kind:'home',weekStart:week}),token=global.token,drivers=await base.list('drivers'),driverName=id=>drivers.find(d=>d.id===id)?.name||'Unknown driver',cards={};
 const needYear=o.boards.some(b=>b.period==='year'&&['top','mileage'].includes(b.key)),year=needYear?await read(client,{kind:'home',from:Home.yearStart(now).toISOString(),weekStart:week,token}):global;
 const recordRows=o.trackId?(await read(client,{kind:'records',scope:'track',sort:'time',sourceId:own,trackId:o.trackId,limit:100,token})).rows:[];
 const best=recordRows.sort((a,b)=>a.durationMs-b.durationMs)[0];
 const grid=[];for(const g of o.grid){if(grid.some(r=>r.driverId===g.driverId)||!g.driverId)continue;const p=o.trackId?await read(client,{kind:'records',scope:'personal',sort:'time',sourceId:own,trackId:o.trackId,driverId:g.driverId,limit:100,token}):{rows:[]};const r=p.rows.sort((a,b)=>a.durationMs-b.durationMs)[0];grid.push({driverId:g.driverId,name:driverName(g.driverId),color:g.color,time:r?.durationMs??null,text:r?E.fmtTime(r.durationMs):'–'});}
 for(const b of o.boards){
  const view=b.period==='year'?year:global;
  if(b.key==='glance')cards[b.key]={glance:{races:global.summary.acceptedSessions,laps:global.summary.recordedLaps,distance:global.summary.distanceComplete?global.summary.distanceM:null,wins:global.topWinners?.length?{name:global.topWinners[0].teamName||global.topWinners[0].driverName,count:global.topWinners[0].wins}:null}};
  if(b.key==='bests')cards[b.key]={bests:grid};
  if(b.key==='record'){const nearest=grid.filter(x=>x.time!==null).sort((a,b)=>a.time-b.time)[0];cards[b.key]={rec:!o.trackId?null:{record:best?{time:best.durationMs,text:E.fmtTime(best.durationMs),driver:best.driverName||driverName(best.driverId),car:best.carName,date:best.startedAt||best.savedAt||'',dateBasis:best.startedAt?'started':best.savedAt?'saved':null,setupName:best.sessionName||''}:null,line:best&&nearest?(nearest.time<=best.durationMs?nearest.name+' is on the grid and holds the record.':`Closest on the grid: ${nearest.name}, ${E.fmtTime(nearest.time)} (+${E.fmtTime(nearest.time-best.durationMs)}).`):''}};}
  if(b.key==='mileage')cards[b.key]={mileage:view.topDistanceCars.slice(0,b.count).map(c=>({carId:client.localId(c.carId),name:c.carName,picture:'',laps:c.recordedLaps,distance:c.unknownDistanceLaps?null:c.distanceM}))};
  if(b.key==='top')cards[b.key]={topPeriod:b.period,top:(view.topWinners||[]).slice(0,b.count).map(w=>({name:w.teamName||w.driverName,count:w.wins,date:w.lastWinAt||''}))};
  if(b.key==='recent')cards[b.key]={recent:global.recentSessions.slice(0,b.count).map(s=>({id:scoped(s.sourceId,s.sessionId,own),date:s.startedAt||s.savedAt||'',dateBasis:s.startedAt?'started':s.savedAt?'saved':null,name:s.name,kind:s.sessionType||'Race',result:s.winnerName?s.winnerName+' won':''}))};
  if(b.key==='records'){const p=await read(client,{kind:'records',scope:'track',limit:Math.min(100,b.count*4),token});cards[b.key]={records:p.rows.slice(0,b.count).map(r=>({trackId:scoped(r.sourceId,r.trackId,own),trackName:r.trackName,time:r.durationMs,text:E.fmtTime(r.durationMs),driver:r.driverName,car:r.carName,date:r.startedAt||r.savedAt||'',dateBasis:r.startedAt?'started':r.savedAt?'saved':null}))};}
  if(b.key==='fastest'){const p=await read(client,{kind:'records',scope:'personal',sort:'time',from:week,...(b.scope!=='all'&&o.trackId?{sourceId:own,trackId:o.trackId}:{}),limit:100,token});const tracks=new Map();for(const r of p.rows){const id=scoped(r.sourceId,r.trackId,own);if(!tracks.has(id))tracks.set(id,{trackId:id,trackName:r.trackName,rows:[]});const rows=tracks.get(id).rows,driverId=scoped(r.sourceId,r.driverId,own),old=rows.find(x=>x.driverId===driverId);if(!old||r.durationMs<old.time){if(old)rows.splice(rows.indexOf(old),1);rows.push({driverId,driver:r.driverName,time:r.durationMs,text:E.fmtTime(r.durationMs)});}}cards[b.key]={fastestScope:b.scope,fastest:{since:week,tracks:[...tracks.values()].map(t=>({...t,rows:t.rows.sort((a,b)=>a.time-b.time).slice(0,b.count)}))}};}
 }
 const s=global.recentSessions[0],last=s?{label:'Last session',date:s.startedAt||s.savedAt||'',dateBasis:s.startedAt?'started':s.savedAt?'saved':null,setupName:s.name,trackName:s.trackName,podium:[],fastest:null}:null;
 if(last){const head=await client.handle.historyRead({kind:'detail',sourceId:s.sourceId,sessionId:s.sessionId}),body=head.body;
  if(body?.race){const entries=new Map(body.race.participants.map(p=>[p.id,p]));last.podium=(body.context?.classification||[]).filter(a=>a.scope==='overall'&&a.position!==null&&a.status!=='disqualified').sort((a,b)=>a.position-b.position).slice(0,3).map(a=>({pos:a.position,name:entries.get(a.participantId)?.displayName||entries.get(a.participantId)?.carName||'Unknown driver',detail:a.laps===null?'':a.laps+' laps'}));}
  last.emptyReason='No verified classification was supplied for this session.';
  await read(client,{kind:'home',limit:1,token});
 }
 return {last,cards};
}
module.exports={read,scoped,mappedRecord,historyPage,historySession,carStatistics,homeStatistics};
