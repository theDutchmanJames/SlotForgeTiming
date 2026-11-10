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
test('stored car statistics preserve existing calculations including pits, service dates and missing tracks',t=>{
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
 require('./fixtures/legacy-media.cjs')(store);store.db.exec("DROP TABLE history_laps;DROP TABLE session_finalizations; DROP TABLE history_sessions;DROP TABLE history_wins;UPDATE info SET value='3' WHERE key='workingFormat'");store.close();
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

test('SQL lap pages read only the requested rows, use the ordered index and preserve ties and complete figures',t=>{
 const {repo,store}=fixture(t,db=>{db.data.laps=Array.from({length:1207},(_,i)=>({id:'l'+i,sessionId:'s26',trackId:'t'+i%45,carId:'c',driverId:'d',time:5000+i,heat:i%3,lapNumber:Math.floor(i/7),pit:i%11===0,invalid:i%17===0,lane:1}));});
 const original=store.statement.bind(store),reads=[];
 store.statement=sql=>{const q=original(sql);if(!sql.startsWith('SELECT f.json FROM history_detail_laps'))return q;return {all(...args){const rows=q.all(...args);reads.push({sql,rows:rows.length});return rows;}};};
 for(const offset of [0,100,1200,1300]){
  reads.length=0;const actual=store.historySession('racing','s26',{offset});assert.deepEqual(withoutRevision(actual),withoutRevision(repo.historySession('racing','s26',{offset})));
  assert.equal(reads.length,1);assert.equal(reads[0].rows,Math.max(0,Math.min(100,1207-offset)));assert.match(reads[0].sql,/LIMIT 100 OFFSET/);
 }
 const plan=original('EXPLAIN QUERY PLAN '+reads[0].sql).all('s26',0,100).map(x=>x.detail).join('\n');assert.match(plan,/history_detail_order/);assert.doesNotMatch(plan,/TEMP B-TREE/);
 reads.length=0;assert.deepEqual(withoutRevision(store.historySession('racing','s26',{exportAll:true,offset:100})),withoutRevision(repo.historySession('racing','s26',{exportAll:true,offset:100})));assert.equal(reads[0].rows,1207);
});

test('summary dependencies update geometry and scale, while names and car counters do not reread old laps',t=>{
 const {repo,store,db}=fixture(t),original=store.statement.bind(store);let read=0,sessionReads=0;
 store.statement=sql=>{const q=original(sql);if(sql==="SELECT shape FROM records WHERE entity='sessions' AND id=?")return {get(...args){sessionReads++;return q.get(...args);}};if(!sql.startsWith('SELECT f.json FROM history_detail_laps'))return q;return {all(...args){const rows=q.all(...args);read+=rows.length;return rows;}};};
 function edit(entity,id,patch){store.command({id:'edit-'+entity+'-'+store.revision(entity,id),type:'updateRecord',entity,recordId:id,expectedRevision:store.revision(entity,id),patch});db.update(entity,id,patch);}
 edit('tracks','t0',{name:'Renamed track'});edit('drivers','d',{name:'Renamed driver'});edit('slotcars','c',{model:'Renamed car'});assert.equal(read,0);assert.equal(sessionReads,0,'irrelevant edits must not load old session bodies either');
 assert.deepEqual(withoutRevision(store.historySession('racing','s26')),withoutRevision(repo.historySession('racing','s26')));
 read=0;edit('tracks','t0',{length:40,laneLengths:[42,44]});assert.equal(read,241,'racing and token sessions share the changed track');
 assert.deepEqual(withoutRevision(store.historySession('racing','s26')),withoutRevision(repo.historySession('racing','s26')));
 read=0;edit('slotcars','c',{scale:'1:24'});assert.equal(read,241);
 assert.deepEqual(withoutRevision(store.historySession('racing','s26')),withoutRevision(repo.historySession('racing','s26')));
 read=0;sessionReads=0;store.command({id:'new-race',type:'finalizeSession',session:{trackId:'t0',sessionType:'race',standings:[{driverId:'d',carId:'c'}]},laps:[{carId:'c',driverId:'d',trackId:'t0',time:7000,lane:1}]});assert.equal(read,1,'mileage updates must not recalculate all previous races');assert.equal(sessionReads,1,'only the new session body is needed');
});

test('detail summaries, ordering and revisions roll back together, correct and delete without stale pages',t=>{
 const {store,repo,db}=fixture(t),before=store.historySession('racing','s26');
 const command={id:'correct-history',type:'setRecordEligibility',sessionId:'s26',expectedRevision:0,edits:[{lapId:'l1',flags:{noTrackRecord:true,noPersonalBest:true}}]};
 store.checkpoint=phase=>{if(phase==='before-commit')throw Error('injected failure');};assert.throws(()=>store.command(command),/injected/);assert.deepEqual(store.historySession('racing','s26'),before);assert.equal(store.receipt(command.id),null);store.checkpoint=()=>{};
 store.command(command);db.update('laps','l1',{noTrackRecord:true,noPersonalBest:true});assert.throws(()=>store.historySession('racing','s26',{revision:before.revision}),{code:'CATALOGUE_CHANGED'});
 assert.deepEqual(withoutRevision(store.historySession('racing','s26',{offset:100})),withoutRevision(repo.historySession('racing','s26',{offset:100})));
 store.command({id:'delete-history',type:'deleteSession',sessionId:'s26',expectedRevision:store.revision('sessions','s26')});
 for(const table of ['history_details','history_detail_refs','history_detail_laps'])assert.equal(store.statement(`SELECT count(*) n FROM ${table} WHERE ${table==='history_details'?'id':'sessionId'}=?`).get('s26').n,0);
 assert.equal(store.historySession('racing','s26'),null);
});

test('existing and older-writer databases rebuild detail projections atomically and preserve source JSON',t=>{
 const {store,db,work}=fixture(t),source=fs.readFileSync(db.file),before=store.historySession('racing','s26'),Detail=require('../sqlite-history-detail');
 store.db.exec("DELETE FROM info WHERE key='historyDetailVersion'");const statement=store.statement.bind(store);
 store.statement=sql=>{if(sql==='INSERT INTO history_details VALUES(?,?,?,?)')throw Error('index build interrupted');return statement(sql);};
 assert.throws(()=>Detail.upgrade(store),/interrupted/);store.statement=statement;assert.deepEqual(store.historySession('racing','s26'),before);
 Detail.upgrade(store);assert.deepEqual(store.historySession('racing','s26'),before);
 // A prior application version may write authoritative records without updating
 // this optional projection. Its change sequence forces a rebuild on reopen.
 store.db.exec("UPDATE history_details SET total=999; UPDATE info SET value='-1' WHERE key='historyDetailSequence'");store.close();
 const reopened=new WorkingStore(work);try{assert.deepEqual(reopened.historySession('racing','s26'),before);assert.deepEqual(fs.readFileSync(db.file),source);}finally{reopened.close();}
});

test('native backup restore retains complete token and team history and full exports',t=>{
 const {store,dir}=fixture(t,db=>{db.data.sessions[26].standings[0].asTeam=true;db.data.sessions[26].standings[0].teamId='team';db.data.laps.forEach(l=>{l.teamId='team';});});
 const expected=store.historySession('racing','s26',{exportAll:true}),tokens=store.historySession('tokens','s0');
 const backup=path.join(dir,'backup'),restored=path.join(dir,'restored');store.backupSnapshot(backup);require('../sqlite-bulk').restore(backup,restored);
 const reopened=new WorkingStore(restored);try{assert.deepEqual(reopened.historySession('racing','s26',{exportAll:true}),expected);assert.deepEqual(reopened.historySession('tokens','s0'),tokens);assert.equal(reopened.historySession('racing','s25',{offset:500}).laps.length,0);}finally{reopened.close();}
});

const roundedCar=value=>JSON.parse(JSON.stringify(value,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v));
function carOracle(s,id){const data=Object.fromEntries(['slotcars','tracks','sessions','laps'].map(entity=>[entity,s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(entity).map(r=>s.get(entity,r.id,true).value)]));return require('../history-read').jsonCar({data},id);}
function sameCars(f){for(const id of ['c','other','empty','missing'])assert.deepEqual(roundedCar(f.store.carStatistics(id)),roundedCar(f.repo.carStatistics(id)),id);}
function carFixture(t){return fixture(t,db=>{
 db.data.slotcars.push({id:'other',model:'Other'},{id:'empty',model:'Unused'});
 db.data.tracks[0].laneLengths=[22.13,23.57];db.data.tracks[1].name=db.data.tracks[0].name;
 db.data.laps=Array.from({length:1503},(_,i)=>({id:'many'+i,carId:i%5===0?'other':'c',trackId:i%7===0?'deleted':'t'+i%3,sessionId:i%31===0?undefined:'s'+i%27,time:i%19===0?'Infinity':4000+i%123,lane:i%2+1,date:i%3===0?'2026-10-02':undefined,pit:i%13===0,invalid:i%17===0,tooSlow:i%23===0,late:i%29===0,token:i%37===0}));
});}

test('car totals merge many interleaved sessions, orphan laps, dates and unknown tracks without changing rules',t=>{
 const f=carFixture(t);sameCars(f);
 assert.equal(f.store.carStatistics('empty').mileage.distance,0);
 const original=f.store.statement.bind(f.store),calls=[];
 f.store.statement=sql=>{assert.doesNotMatch(sql,/FROM (?:car_stat_laps|car_stat_parts|lap_index)|f\.json|SELECT shape/,'car reads must not load laps, session contributions or broad bodies');calls.push(sql);return original(sql);};
 sameCars(f);assert.equal(calls.filter(sql=>sql==='SELECT summary FROM car_stat_totals WHERE carId=?').length,3);
 const plan=original('EXPLAIN QUERY PLAN SELECT summary FROM car_stat_totals WHERE carId=?').all('c').map(r=>r.detail).join('\n');assert.match(plan,/SEARCH car_stat_totals/);
 const cached=JSON.parse(original('SELECT summary FROM car_stat_totals WHERE carId=?').get('c').summary);assert.equal(cached.sessions.length,0,'totals do not grow with session IDs');
});

test('car writes read only affected session contributions and ignore names, counters and delivery metadata',t=>{
 const f=carFixture(t),s=f.store,original=s.statement.bind(s);let reads=[];
 s.statement=sql=>{const q=original(sql);if(!sql.startsWith('SELECT f.json,h.ordinal FROM car_stat_laps'))return q;return {iterate(...args){reads.push(args);return q.iterate(...args);}};};
 const edit=(entity,id,patch)=>{s.command({id:'car-edit-'+entity+'-'+s.revision(entity,id),type:'updateRecord',entity,recordId:id,expectedRevision:s.revision(entity,id),patch});f.db.update(entity,id,patch);};
 edit('tracks','t0',{name:'A new track name'});edit('slotcars','c',{model:'New model',lapsDriven:9000});assert.deepEqual(reads,[]);sameCars(f);
 s.command({id:'car-race',type:'finalizeSession',session:{trackId:'t0',sessionType:'race',date:'2026-11-03',standings:[{carId:'c',driverId:'d',pos:1}]},laps:[{carId:'c',trackId:'t0',time:4000,lane:1}]});
 assert.equal(reads.length,1);assert.equal(reads[0][0],'c');assert.ok(!/^s\d+$/.test(reads[0][1]),'only the new race is read');
 reads=[];edit('tracks','t0',{laneLengths:[30,31],deslotTime:4});assert.ok(reads.length>0);assert.ok(reads.every(([carId])=>['c','other'].includes(carId)));
 // Compare the changed fixture cars separately from the newly finalized race.
 assert.deepEqual(roundedCar(s.carStatistics('c')),roundedCar(carOracle(s,'c')));
 reads=[];edit('slotcars','c',{serviceDate:'2026-10-05'});assert.ok(reads.length>0);assert.ok(reads.every(([id])=>id==='c'));
 assert.deepEqual(roundedCar(s.carStatistics('c')),roundedCar(carOracle(s,'c')));
});

test('car statistics correct eligibility, remove winners and fastest laps, and reset service through production commands',t=>{
 const f=fixture(t,db=>{for(const session of db.data.sessions)delete session.paddockDelivery;}),s=f.store;const compare=()=>assert.deepEqual(roundedCar(s.carStatistics('c')),roundedCar(carOracle(s,'c')));
 s.command({id:'car-flags',type:'setLapEligibility',lapId:'l1',expectedRevision:0,flags:{noTrackRecord:true,noPersonalBest:true}});compare();
 s.command({id:'car-lap-remove',type:'removeRecord',entity:'laps',recordId:'l2',expectedRevision:0});compare();
 s.clock=()=>Date.parse('2026-11-03');s.command({id:'car-service',type:'resetService',carId:'c',expectedRevision:s.revision('slotcars','c')});compare();assert.equal(s.carStatistics('c').mileageSince.distance,0);
 s.command({id:'car-session-remove',type:'deleteSession',sessionId:'s26',expectedRevision:s.revision('sessions','s26')});compare();assert.equal(s.carStatistics('c').sessions,0);
 assert.equal(s.statement('SELECT count(*) n FROM car_stat_totals').get().n,0);
});

test('car summary failures roll back source, receipts and derived statistics atomically',t=>{
 const f=fixture(t),s=f.store,before=s.carStatistics('c'),source=fs.readFileSync(f.db.file);
 s.db.exec("CREATE TRIGGER fail_car_summary BEFORE UPDATE ON car_stat_totals BEGIN SELECT RAISE(ABORT,'injected car summary failure'); END");
 const command={id:'failed-car-service',type:'resetService',carId:'c',expectedRevision:0};
 assert.throws(()=>s.command(command),/injected car summary failure/);assert.deepEqual(s.carStatistics('c'),before);assert.equal(s.receipt(command.id),null);assert.equal(s.revision('slotcars','c'),0);
 s.db.exec('DROP TRIGGER fail_car_summary');s.command(command);assert.equal(s.carStatistics('c').mileageSince.laps,0);assert.deepEqual(fs.readFileSync(f.db.file),source);
});

test('car projection upgrade, older-writer recovery and native restore preserve source and statistics',t=>{
 const f=carFixture(t),s=f.store,Car=require('../sqlite-car-statistics'),before=s.carStatistics('c'),source=fs.readFileSync(f.db.file),original=s.statement.bind(s);
 s.db.exec("DELETE FROM info WHERE key='carStatisticsVersion'");
 s.statement=sql=>{if(sql==='INSERT INTO car_stat_parts VALUES(?,?,?)')throw Error('car upgrade interrupted');return original(sql);};
 assert.throws(()=>Car.upgrade(s),/interrupted/);s.statement=original;assert.deepEqual(s.carStatistics('c'),before);Car.upgrade(s);sameCars(f);
 const backup=path.join(f.dir,'car-backup'),restored=path.join(f.dir,'car-restored');s.backupSnapshot(backup);require('../sqlite-bulk').restore(backup,restored);
 s.db.exec("UPDATE car_stat_totals SET summary='{}'; UPDATE info SET value='-1' WHERE key='carStatisticsSequence'");s.close();
 for(const dir of [f.work,restored]){const reopened=new WorkingStore(dir);try{assert.deepEqual(reopened.carStatistics('c'),before);}finally{reopened.close();}}
 assert.deepEqual(fs.readFileSync(f.db.file),source);
});

test('car dependencies handle lap reassignment, session dates and removed track metadata',t=>{
 const f=carFixture(t),s=f.store,Car=require('../sqlite-car-statistics');
 // Exercise the shared projection boundary with corrected imported records,
 // including identity changes the ordinary lap-eligibility editor forbids.
 function replace(entity,id,patch){s.transaction(()=>{s.changed=new Map();s.replace(entity,id,{...s.get(entity,id,true).value,...patch});require('../sqlite-history').sync(s);require('../sqlite-history-detail').sync(s);Car.sync(s);});}
 replace('laps','many1',{carId:'other',sessionId:'s24',trackId:'t2',time:1000});
 replace('sessions','s24',{date:'2026-12-01'});
 for(const id of ['c','other'])assert.deepEqual(roundedCar(s.carStatistics(id)),roundedCar(carOracle(s,id)));
 replace('tracks','t2',{length:0,laneLengths:[],deslotTime:0});
 for(const id of ['c','other'])assert.deepEqual(roundedCar(s.carStatistics(id)),roundedCar(carOracle(s,id)));
 assert.equal(s.carStatistics(undefined),null);
 const sql="SELECT f.json,h.ordinal FROM car_stat_laps h JOIN fields f ON f.entity='laps' AND f.id=h.id AND f.path='[]' WHERE h.carId=? AND h.sessionId=? ORDER BY h.ordinal";
 const plan=s.statement('EXPLAIN QUERY PLAN '+sql).all('other','s24').map(r=>r.detail).join('\n');assert.match(plan,/car_stat_lap_order/);assert.doesNotMatch(plan,/TEMP B-TREE/);
});

test('missing disposable tables and indexes repair on reopen without changing authoritative data or identity',t=>{
 const f=fixture(t),expected=f.store.carStatistics('c'),history=withoutRevision(f.store.historyPage('racing')),source=fs.readFileSync(f.db.file);
 const snapshot=s=>Object.fromEntries(['records','fields','revisions','command_receipts','changes'].map(name=>[name,s.statement(`SELECT * FROM ${name}`).all()]));
 const before=snapshot(f.store),identity=f.store.statement("SELECT value FROM info WHERE key='catalogueIdentity'").get().value;
 let s=f.store;
 const tables=['car_stat_totals','car_stat_parts','car_stat_laps','car_stat_refs','history_details','history_detail_laps','history_detail_refs','history_wins','history_sessions','history_laps','home_totals','home_dates','home_laps','catalogue_index'];
 try{for(const name of tables){s.db.exec('DROP TABLE '+name);s.close();s=new WorkingStore(f.work);assert.deepEqual(s.carStatistics('c'),expected,name);assert.deepEqual(withoutRevision(s.historyPage('racing')),history,name);assert.deepEqual(snapshot(s),before,name);assert.equal(s.statement("SELECT value FROM info WHERE key='catalogueIdentity'").get().value,identity);}
  const indexes=['car_stat_lap_order','car_stat_dependency','history_detail_order','history_detail_dependency','history_track','history_personal','history_championship','history_track_start','history_session_order','home_last','home_group','home_week','catalogue_order'];
  for(const name of indexes)s.db.exec('DROP INDEX '+name);s.close();s=new WorkingStore(f.work);
  for(const name of indexes)assert.ok(s.statement("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(name),name);
  assert.deepEqual(snapshot(s),before);assert.deepEqual(fs.readFileSync(f.db.file),source);
 }finally{s.close();}
});

test('record eligibility updates record lists and receipts without touching numerical projections',t=>{
 const {store:s}=fixture(t),before=s.carStatistics('c'),figures=s.historySession('racing','s26').figures;
 const original=s.statement.bind(s);s.statement=sql=>{assert.ok(!sql.startsWith('SELECT f.json FROM history_detail_laps')&&!sql.startsWith('SELECT f.json,h.ordinal FROM car_stat_laps'),'no old lap statistics reads');return original(sql);};
 for(const table of ['car_stat_totals','car_stat_parts','history_details','home_laps'])for(const op of ['INSERT','UPDATE','DELETE'])s.db.exec(`CREATE TRIGGER block_${table}_${op} BEFORE ${op} ON ${table} BEGIN SELECT RAISE(ABORT,'unnecessary numeric write'); END`);
 s.command({id:'record-flags-only',type:'setLapEligibility',lapId:'l1',expectedRevision:0,flags:{noTrackRecord:true,noPersonalBest:true}});
 assert.deepEqual(s.carStatistics('c'),before);assert.ok(s.receipt('record-flags-only'));assert.equal(s.statement('SELECT track,personal FROM history_laps WHERE id=?').get('l1').track,0);
 s.statement=original;assert.deepEqual(s.historySession('racing','s26').figures,figures);assert.equal(s.historySession('racing','s26').laps.find(l=>l.id==='l1').noPersonalBest,true);
});

test('transaction-local lap effects retain first inputs and invalidate only actual dependencies',t=>{
 const {store:s}=fixture(t),Effects=require('../sqlite-lap-effects'),old=s.get('laps','l1',true).value;
 s.transaction(()=>{
  s.changed=new Map();s.replace('laps','l1',{...old,time:9000});s.replace('laps','l1',{...old,noTrackRecord:true});
  for(const kind of ['detail','car','home'])assert.equal(Effects.changed(s,'l1',kind),false);
 });
 s.transaction(()=>{s.changed=new Map();s.replace('laps','l1',{...old,date:'2026-12-01'});assert.equal(Effects.changed(s,'l1','detail'),false);assert.equal(Effects.changed(s,'l1','car'),true);assert.equal(Effects.changed(s,'l1','home'),true);});
 s.transaction(()=>{s.changed=new Map();s.erase('laps','l1');for(const kind of ['detail','car','home'])assert.equal(Effects.changed(s,'l1',kind),true);});
});

test('shared session figures group once and retain team, missing-ID, scale and original-order behavior',()=>{
 const Stats=require('../renderer/stats'),track={id:'track',length:20,lanes:2},cars=[{id:'a',scale:'1:32'},{id:'b',scale:'1:24'}];
 const laps=Array.from({length:2400},(_,i)=>({sessionId:i%7===0?'other':i%11===0?undefined:'race',driverId:'d'+i%24,teamId:'team'+i%3,time:4000+i%900,lane:i%2+1,heat:i%4,pit:i%23===0,invalid:i%29===0}));
 laps.push({time:5000},{driverId:'d0',time:6000,sessionId:null},{driverId:'d0',time:7000,sessionId:'race'});
 const standings=[...Array.from({length:24},(_,i)=>({driverId:'d'+i,carId:'a',pits:i,penaltyPoints:i*2})),{asTeam:true,teamId:'team0',carId:'a'},{asTeam:true,teamId:'team1',carId:'b'},{asTeam:true,teamId:'',carId:'a'},{carId:'a'},{driverId:'d0',carId:'b'},{driverId:'d0',carId:'a',pits:100}];
 const session={id:'race',trackId:'track',standings};
 const expected=standings.map(x=>({...Stats.figures(Stats.ownLaps(x,laps).filter(l=>l.sessionId===undefined||l.sessionId===session.id),track,cars.find(c=>c.id===x.carId)?.scale),pits:x.pits,pitTime:x.pitTime,penalty:x.penaltyPoints,tyres:undefined}));
 let walks=0;const iterable={[Symbol.iterator]:function*(){walks++;yield* laps;}};
 const actual=Stats.forSession(session,iterable,[track],cars);assert.equal(walks,1);assert.deepEqual(actual,expected);
 actual[0].avg=-1;assert.notEqual(actual.at(-1).avg,-1,'rows cannot share mutable result objects');
});


test('session existence and result references stay bounded and exclude media and delivery payloads',async t=>{
 const {repo,store,work}=fixture(t,db=>{db.data.sessions[26].paddockDelivery.status='pending';});
 const request=[{entity:'tracks',id:'t0'},{entity:'slotcars',id:'c'},{entity:'tracks',id:'missing'}];
 for(const reader of [repo,store]){
  const selected=reader.historySession('racing','s26',{summaryOnly:true});assert.equal(selected.session.id,'s26');assert.equal(selected.deliveryStatus,'pending');assert.equal(selected.laps,undefined);assert.equal(selected.figures,undefined);assert(!JSON.stringify(selected).includes('payload'));
  const refs=reader.historyReferences(request);assert.equal(refs[0].length,20);assert.equal(refs[1].scale,'1:32');assert.equal(refs[2],null);assert(!JSON.stringify(refs).includes('picture'));assert(!JSON.stringify(refs).includes('trackDesign'));assert.throws(()=>reader.historyReferences([{entity:'sessions',id:'s26'}]),/Invalid/);
 }
 const client=new Client();try{await client.openWorking(work);assert.equal((await client.historyReferences(request))[0].length,20);assert.equal((await client.historySession('racing','s26',{summaryOnly:true})).deliveryStatus,'pending');}finally{await client.close();}
});
