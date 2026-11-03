'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),Repository=require('../data-repository'),Client=require('../sqlite-client'),SqliteRepository=require('../sqlite-repository');
const {migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working'),CarStats=require('../renderer/carstats');
function fixture(t,mutate=()=>{}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-history-')),db=new Database(path.join(dir,'source.json'));
 db.data.tracks=Array.from({length:45},(_,i)=>({id:'t'+i,name:'Track '+i,length:20+i,lanes:2,deslotTime:9,picture:'data:image/png;base64,AAAA',trackDesign:{large:'omit'}}));
 db.data.drivers=[{id:'d',name:'Driver',avatar:'data:image/png;base64,AAAA'}];db.data.slotcars=[{id:'c',model:'Car',scale:'1:32',serviceDate:'2026-10-03',picture:'data:image/png;base64,AAAA'}];
 db.data.sessions=Array.from({length:27},(_,i)=>({id:'s'+i,setupName:'Race '+i,date:'2026-10-04',sessionType:i===0?'tokens':'race',trackId:'t0',trackName:'Track 0',standings:[{pos:1,driverId:'d',driverName:'Driver',carId:'c',carName:'Car',laps:240,best:5000,total:1200000}],paddockDelivery:{state:'pending',payload:{bulky:'private'}}}));
 db.data.laps=Array.from({length:240},(_,i)=>({id:'l'+i,sessionId:'s26',trackId:'t'+i%45,carId:'c',driverId:'d',time:5000+i,lapNumber:i+1,lane:1,heat:1,date:'2026-10-04',pit:i%13===0,invalid:i%19===0,noTrackRecord:i%19===0,noPersonalBest:i%19===0}));
 db.data.laps.push({id:'token',token:true,sessionId:'s0',trackId:'t0',driverId:'',time:4000,lapNumber:1});mutate(db);db.saveNow();
 const copy=path.join(dir,'copy'),work=path.join(dir,'work');migrateCopy({source:db.file,destination:copy});forkCopy(copy,work);const store=new WorkingStore(work),repo=new Repository(db);
 t.after(async()=>{store.close();await db.writesIdle();fs.rmSync(dir,{recursive:true,force:true});});return {dir,db,store,repo,work};
}
const withoutRevision=p=>{p=structuredClone(p);delete p.revision;for(const k of ['sessions','tracks','personal'])if(p[k]?.next)delete p[k].next.revision;return p;};
test('bounded history pages match both backends, retain record order, and omit media/delivery payloads',t=>{
 const {repo,store}=fixture(t);
 for(const pool of ['racing','tokens']){const a=repo.historyPage(pool),b=store.historyPage(pool);assert.deepEqual(withoutRevision(a),withoutRevision(b));assert.ok(!JSON.stringify(b).includes('base64'));assert.ok(!JSON.stringify(b).includes('paddockDelivery'));}
 const a=repo.historyPage('racing'),b=store.historyPage('racing');assert.equal(b.sessions.items.length,12);assert.equal(b.tracks.items.length,40);
 assert.deepEqual(withoutRevision(repo.historyPage('racing',{sessions:a.sessions.next,tracks:a.tracks.next})),withoutRevision(store.historyPage('racing',{sessions:b.sessions.next,tracks:b.tracks.next})));
 assert.equal(store.historyPage('tokens').personal.items.length,0);
});
test('selected session statistics use all laps while lap pages and complete PDF request differ',t=>{
 const {repo,store}=fixture(t);
 for(const offset of [0,100,200]){const a=repo.historySession('racing','s26',{offset}),b=store.historySession('racing','s26',{offset});assert.deepEqual(withoutRevision(a),withoutRevision(b));assert.equal(b.laps.length,offset===200?40:100);assert.equal(b.total,240);assert.ok(b.figures[0].avg>5100);assert.ok(!('paddockDelivery' in b.session));}
 assert.equal(store.historySession('racing','s26',{exportAll:true}).laps.length,240);assert.equal(store.historySession('tokens','s26'),null);
});
test('streaming car statistics preserve existing calculations including pits, service dates and missing tracks',t=>{
 const {repo,store,db}=fixture(t,db=>{db.data.laps.push({id:'unknown',carId:'c',sessionId:'s1',trackId:'deleted',time:9900,lapNumber:1},{id:'late',carId:'c',sessionId:'s1',trackId:'t0',time:11000,late:true});});
 const expected=CarStats.details(db.data.slotcars[0],db.data.laps,db.data.sessions,db.data.tracks);
 const rounded=x=>JSON.parse(JSON.stringify(x,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v));assert.deepEqual(rounded(repo.carStatistics('c')),rounded(expected));assert.deepEqual(rounded(store.carStatistics('c')),rounded(expected));assert.equal(store.carStatistics('missing'),null);
});
test('cursors and selected session snapshots reject mutations, and indexes roll back with writes',t=>{
 const {repo,store,db,work}=fixture(t),page=store.historyPage('racing'),json=repo.historyPage('racing');
 store.checkpoint=step=>{if(step==='before-commit')throw Error('fault');};
 assert.throws(()=>store.command({id:'fail',type:'setRecordEligibility',sessionId:'s26',expectedRevision:0,edits:[{lapId:'l1',flags:{noTrackRecord:true}}]}),/fault/);
 assert.equal(store.historyPage('racing').revision,page.revision);store.checkpoint=()=>{};
 store.command({id:'change',type:'setRecordEligibility',sessionId:'s26',expectedRevision:0,edits:[{lapId:'l1',flags:{noTrackRecord:true}}]});db.update('laps','l1',{noTrackRecord:true});
 assert.throws(()=>store.historyPage('racing',{sessions:page.sessions.next}),{code:'CATALOGUE_CHANGED'});assert.throws(()=>repo.historySession('racing','s26',{revision:json.revision}),{code:'CATALOGUE_CHANGED'});
 assert.deepEqual(withoutRevision(repo.historyPage('racing')),withoutRevision(store.historyPage('racing')));
 store.close();const reopened=new WorkingStore(work);try{assert.deepEqual(withoutRevision(reopened.historyPage('racing')),withoutRevision(repo.historyPage('racing')));}finally{reopened.close();}
});
test('working format 3 upgrade is atomic and leaves the verified recovery copy untouched',t=>{
 const {store,dir,work}=fixture(t),file=path.join(dir,'copy','timing.sqlite'),before=fs.readFileSync(file);
 store.db.exec("DROP TABLE history_laps;DROP TABLE session_finalizations; DROP TABLE history_sessions;DROP TABLE history_wins;UPDATE info SET value='3' WHERE key='workingFormat'");store.close();
 const reopened=new WorkingStore(work);try{assert.equal(reopened.historyPage('racing').sessions.items.length,12);assert.deepEqual(fs.readFileSync(file),before);}finally{reopened.close();}
});
test('worker and adapter expose history and catalogue reads without overriding Paddock writes',async t=>{
 const f=fixture(t),client=new Client();try{await client.openWorking(f.work);const repo=new SqliteRepository(client);assert.equal((await repo.catalogue('drivers')).items.length,1);assert.equal((await repo.historyPage('racing')).sessions.items.length,12);assert.equal((await repo.historySession('racing','s26')).laps.length,100);assert.equal((await repo.carStatistics('c')).sessions,1);}finally{await client.close();}
 const calls=[],repo=new SqliteRepository({command:c=>calls.push(c)});repo.applyPaddockCatalogue('host',{},[],{commandId:'cache',expectedRevision:0});assert.equal(calls[0].type,'applyPaddockCatalogue');
});
test('overview and car queries do not reconstruct whole records or access image blobs',t=>{
 const {store}=fixture(t);store.get=store.asset=()=>{throw Error('Unexpected broad read');};assert.equal(store.historyPage('racing').sessions.items.length,12);assert.equal(store.carStatistics('c').sessions,1);
});
test('large car histories avoid argument-spread limits',()=>{
 const H=require('../history-read');function* laps(){for(let i=0;i<200000;i++)yield {carId:'c',trackId:'t',sessionId:'s',time:5000,lapNumber:i};}
 const result=H.carDetails({id:'c'},laps(),()=>({name:'Track',length:20}),()=>null,0);assert.equal(result.tracks[0].laps,200000);assert.equal(result.mileage.distance,4000000);
});
test('Paddock names and Virtual Rival winners survive light summaries without copying host configurations',t=>{
 const {repo,store}=fixture(t,db=>{db.data.slotcars[0].paddock={name:'Host car name',configuration:{photos:['large']}};Object.assign(db.data.sessions[26],{virtualRivals:[{driverId:'v',driverName:'Virtual',carName:'Replay',pos:1,laps:250}],rivalClassification:[{driverId:'v',virtualRival:true,pos:1},{driverId:'d',physicalPos:1,pos:2}]});});
 for(const reader of [repo,store]){const p=reader.historyPage('racing');assert.equal(p.sessions.items[0].standings[0].driverName,'Virtual');assert.deepEqual(p.refs.slotcars[0].paddock,{name:'Host car name'});assert.ok(!JSON.stringify(p).includes('configuration'));const s=reader.historySession('racing','s26');assert.equal(s.session.rivalClassification.length,2);}
});
test('record ties retain earliest saved eligibility and per-driver records do not collide on delimiters',t=>{
 const {repo,store}=fixture(t,db=>{db.data.laps=[{id:'a',trackId:'t0',driverId:'one|two',sessionId:'s26',time:1000},{id:'b',trackId:'t0|one',driverId:'two',sessionId:'s26',time:1000},{id:'c',trackId:'t0',driverId:'one|two',sessionId:'s26',time:1000},{id:'d',trackId:'t0',time:0}];});
 for(const reader of [repo,store]){const p=reader.historyPage('racing');assert.equal(p.personal.items.length,2);assert.ok(p.tracks.items.some(l=>l.id==='a'));assert.ok(!p.tracks.items.some(l=>l.id==='c'||l.id==='d'));}
});
test('full selected history retains team/heat metadata and complete statistics across pages',t=>{
 const Stats=require('../renderer/stats');const {repo,store,db}=fixture(t,db=>{const s=db.data.sessions[26];s.sessionType='endurance';s.standings[0].asTeam=true;s.standings[0].teamId='team';s.heatResults=[{heat:1,rows:[{pos:1,driverName:'James',laps:120}]}];s.classStandings=[{name:'GT3',rows:[]}];s.resourceSummary={tyresUsed:2};db.data.laps.forEach((l,i)=>{l.teamId='team';l.heat=i<120?1:2;});});
 for(const reader of [repo,store]){const d=reader.historySession('racing','s26',{offset:100});assert.deepEqual(d.session.heatResults,db.data.sessions[26].heatResults);assert.deepEqual(d.session.classStandings,db.data.sessions[26].classStandings);assert.deepEqual(d.figures,Stats.forSession(db.data.sessions[26],db.data.laps.filter(l=>!l.token),db.data.tracks,db.data.slotcars));}
});
test('large PDF lap tables compute best laps once per driver without spread overflow',()=>{
 const Report=require('../renderer/report'),laps=Array.from({length:140000},(_,i)=>({driverId:'d',lapNumber:i+1,time:i===0?4999:5000}));
 const html=Report.sessionHtml({session:{setupName:'Large race',sessionType:'race',standings:[{pos:1,driverId:'d',driverName:'Driver',laps:140000}]},laps,options:{results:false,tyres:false,heats:false}});assert.ok(html.includes('<td>140000</td>'));assert.ok(html.includes('<b>4.999</b>'));
});
test('older sessions without standings remain openable and deleting a session removes its history index and wins',t=>{
 const {repo,store,db}=fixture(t,db=>{delete db.data.sessions[25].standings;});
 for(const reader of [repo,store])assert.deepEqual(reader.historySession('racing','s25').session.standings,[]);
 store.command({id:'remove',type:'deleteSession',sessionId:'s26',expectedRevision:0});db.removeSession('s26');
 assert.equal(store.historySession('racing','s26'),null);assert.deepEqual(withoutRevision(repo.historyPage('racing')),withoutRevision(store.historyPage('racing')));assert.equal(store.carStatistics('c').wins,24);
});
