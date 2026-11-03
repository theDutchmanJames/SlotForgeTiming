'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),Repo=require('../data-repository'),Client=require('../sqlite-client'),{migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working');
const D=require('../dashboard-read'),Home=require('../renderer/homestats'),C=require('../catalogue-read');
// Count grouping changes only floating-point accumulation order, below a micrometre.
const equivalent=(a,b)=>assert.deepEqual(JSON.parse(JSON.stringify(a, (k,v)=>k==='distance'&&typeof v==='number'?Math.round(v*1e6)/1e6:v)),JSON.parse(JSON.stringify(b,(k,v)=>k==='distance'&&typeof v==='number'?Math.round(v*1e6)/1e6:v)));
const now='2026-11-03T12:00:00.000Z',media='data:image/png;base64,'+Buffer.alloc(10000,7).toString('base64');
function fixture(t,mutate=()=>{}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-dashboard-')),db=new Database(path.join(dir,'source.json'));
 db.data.tracks=[{id:'t',name:'Circuit',length:20,lanes:2,laneLengths:[19,21],picture:media},{id:'other',name:'Other track',length:0}];
 db.data.drivers=[{id:'d',name:'James',avatar:media},{id:'mate',name:'Mate',avatar:media},{id:'unused',name:'Unused',avatar:media},{id:'rival',name:'Virtual',driverType:'virtual',avatar:media}];
 db.data.slotcars=[{id:'c',model:'GT3',picture:media,paddock:{name:'Paddock GT3',configuration:{picture:media}}},{id:'unused',model:'Unused',picture:media}];
 db.data.teams=[{id:'team',name:'Team',drivers:['d','mate'],picture:media}];
 for(const e of ['layouts','audiosets','fuelrules','tyrewearsystems'])db.data[e]=[{id:'chosen',name:'Chosen',unknown:{preserve:true},picture:media},{id:'unused',name:'Unused',picture:media}];
 db.data.layouts[0].laneColors=[{bg:'#123456'}];db.data.layouts[0].widgets=[{type:'fuel'}];db.data.audiosets[0].calls={lap:{sound:media}};
 db.data.sessions=Array.from({length:30},(_,i)=>({id:'s'+i,date:i%2?'2026-11-02':'2025-10-03',setupName:'Session '+i,trackId:i%2?'t':'other',trackName:'Circuit',sessionType:i%7===0?'tokens':i%5===0?'qualifying':'race',resultBy:i%2?'points':'time',champ:i%4===0?{id:'champ',roundId:'round',off:false}:undefined,standings:[{pos:1,driverId:'d',driverName:'James old',carId:'c',laps:i%3,points:10,best:5000,asTeam:i%4===0,teamId:'team',teamName:'The team',dq:i%9===0,retired:i%11===0}],paddockJournal:{photo:media},heatResults:[{note:'preserve championship details'}]}));
 db.data.laps=Array.from({length:1600},(_,i)=>({id:'l'+i,sessionId:'s'+i%30,trackId:['t','other','deleted'][i%3],driverId:['d','mate','gone',''][i%4],carId:i%7?'c':'missing',time:i%97===0?0:i%103===0?'bad':4000+(i%31)*101,lane:i%2+1,date:i%3?'2026-11-03':undefined,token:i%13===0,noTrackRecord:i%17===0,noPersonalBest:i%19===0,invalid:i%23===0,tooSlow:i%29===0,late:i%37===0,pit:i%11===0}));db.data=JSON.parse(JSON.stringify(db.data));mutate(db);db.saveNow();
 const copy=path.join(dir,'copy'),work=path.join(dir,'working');migrateCopy({source:db.file,destination:copy});forkCopy(copy,work);const store=new WorkingStore(work),repo=new Repo(db);t.after(async()=>{store.close();await db.writesIdle();fs.rmSync(dir,{recursive:true,force:true});});return {db,store,repo,work,dir};}
const request=()=>({trackId:'t',now,driverIds:['d','mate'],grid:[{driverId:'d',color:'#fff'},{driverId:'mate',color:'#f00'},{driverId:'d',color:'#fff'}],boards:D.CARDS.map(key=>({key,count:5,period:'all',scope:'all'}))});
function expected(db,o){const ctx={laps:db.data.laps,sessions:db.data.sessions,tracks:db.data.tracks,trackId:o.trackId,driverIds:o.driverIds,grid:o.grid,now:new Date(o.now),driverName:id=>db.data.drivers.find(x=>x.id===id&&x.driverType!=='virtual')?.name||'',carName:id=>{const c=db.data.slotcars.find(x=>x.id===id);return c?c.paddock?.name||[c.brand,c.manufacturer,c.model].filter(Boolean).join(' ')||'(unnamed)':'';},trackName:id=>db.data.tracks.find(x=>x.id===id)?.name||'(deleted)'};const cards={};for(const b of o.boards){const c={...ctx,count:b.count,scope:b.scope,since:b.period==='year'?Home.yearStart(ctx.now):null};cards[b.key]=b.key==='record'?{rec:o.trackId?Home.recordCard(c):null}:b.key==='glance'?{glance:Home.glance(c)}:b.key==='recent'?{recent:Home.recent(c)}:b.key==='fastest'?{fastestScope:b.scope,fastest:Home.fastestWeek(c)}:b.key==='records'?{records:Home.allRecords(c)}:b.key==='top'?{topPeriod:b.period,top:Home.winners(c).slice(0,b.count)}:b.key==='mileage'?{mileage:Home.mileage(c).slice(0,b.count)}:{bests:Home.gridBests(c)};}return {last:Home.lastRace(ctx),cards};}
test('every Home statistic matches the original functions for all/year and track/all including eligibility and teams',t=>{const {db,repo,store}=fixture(t);for(const period of ['all','year'])for(const scope of ['all','track']){const o=request();o.boards.forEach(b=>{b.period=period;b.scope=scope;});const want=expected(db,o);assert.deepEqual(repo.homeStatistics(o),want);equivalent(store.homeStatistics(o),want);assert(!JSON.stringify(want).includes('base64'));}});
test('Home navigation includes only qualifying choices and the selected championship, retaining full championship metadata',t=>{const {db,repo,store}=fixture(t);for(const champId of ['','champ']){const o={trackId:'t',champId};assert.deepEqual(store.homeSessions(o),repo.homeSessions(o));const got=repo.homeSessions(o);assert(got.every(s=>s.champ?.id===champId||s.sessionType==='qualifying'&&s.trackId==='t'));assert(!JSON.stringify(got).includes('base64'));if(champId)assert(got.find(s=>s.champ?.id===champId).heatResults);}});
const race=()=>({trackId:'t',championship:false,setup:{sessionType:'race',layout:'chosen',layout2:'chosen',audioSet:'chosen',fuelRules:'chosen',tyreWear:'chosen'},rows:[{driverId:'d',carId:'c',teamId:'team'}]});
test('race inputs preserve full selected assets, Paddock captures and team avatars but omit unrelated media and laps',t=>{const {db,repo,store}=fixture(t),o=race();const got=repo.raceInputs(o);assert.deepEqual(store.raceInputs(o),got);for(const e of ['layouts','audiosets','fuelrules','tyrewearsystems'])assert.deepEqual(got.collections[e],[db.data[e][0]]);assert.deepEqual(got.collections.slotcars,[db.data.slotcars[0]]);assert.equal(got.collections.drivers.find(d=>d.id==='unused').avatar,undefined);assert.equal(got.collections.drivers.find(d=>d.id==='mate').avatar,media);assert.deepEqual(got.collections.laps,[]);});
test('Time Token guest changes retain every driver avatar, use separate records, and championship callers use separate history reads',t=>{const {db,repo,store}=fixture(t);const o=race();o.setup.sessionType='tokens';o.rows=[];o.championship=true;const got=repo.raceInputs(o);assert.deepEqual(store.raceInputs(o),got);assert.equal(got.collections.drivers.find(d=>d.id==='unused').avatar,media);assert.deepEqual(got.collections.laps,[]);const token=db.data.laps.filter(l=>l.trackId==='t'&&l.token&&!l.noTrackRecord).reduce((a,l)=>l.time<a?l.time:a,Infinity);assert.equal(got.records.track,token);});
test('invalid query contracts fail closed',t=>{const {repo,store}=fixture(t);for(const reader of [repo,store]){assert.throws(()=>reader.homeStatistics({...request(),boards:[{key:'unknown'}]}),/Invalid/);assert.throws(()=>reader.homeSessions({trackId:'t'}),/Invalid/);assert.throws(()=>reader.raceInputs({...race(),rows:[{carId:{}}]}),/Invalid/);}});
test('persistent worker delivers dashboard summaries and selected race assets',async t=>{const {repo,work}=fixture(t),client=new Client();try{await client.openWorking(work);equivalent(await client.homeStatistics(request()),repo.homeStatistics(request()));assert.deepEqual(await client.raceInputs(race()),repo.raceInputs(race()));}finally{await client.close();}});

test('empty history returns no invented races, records or mileage',()=>{const source={sessions:()=>[],laps:()=>[],meta:()=>[]};const result=D.home(source,request());assert.equal(result.last,null);assert.deepEqual(result.cards.glance.glance,{races:0,laps:0,distance:null,wins:null});assert.deepEqual(result.cards.mileage.mileage,[]);assert.deepEqual(result.cards.record.rec,{record:null,line:''});});
test('ordinary race preparation rejects a changed catalogue revision on both backends',t=>{const {repo,store}=fixture(t);for(const reader of [repo,store]){const o=race();o.revision=reader.referencePage('tracks').revision;assert(reader.raceInputs(o).collections.layouts.length);o.revision+='stale';assert.throws(()=>reader.raceInputs(o),{code:'CATALOGUE_CHANGED'});}});
test('large lap histories are consumed once and only summarized rows leave the reader',()=>{let seen=0,passes=0;const source={sessions:()=>[{id:'s',sessionType:'race',date:now,standings:[{pos:1,driverId:'d',driverName:'Driver',laps:100000}]}],meta:e=>e==='drivers'?[{id:'d',name:'Driver'}]:e==='tracks'?[{id:'t',name:'Track',length:20}]:[{id:'c',model:'Car'}],*laps(){passes++;for(let i=0;i<100000;i++){seen++;yield {id:'l'+i,sessionId:'s',trackId:'t',driverId:'d',carId:'c',time:5000+i%50,date:now};}}};const result=D.home(source,request());assert.equal(seen,100000);assert.equal(passes,1);assert.equal(result.cards.glance.glance.laps,100000);assert.equal(result.cards.glance.glance.distance,2000000);assert.equal(result.cards.mileage.mileage[0].laps,100000);assert(Buffer.byteLength(JSON.stringify(result))<4000);});
test('tied qualifying picks preserve the former UI order',()=>{const rows=[{id:'empty',sessionType:'qualifying',trackId:'t',date:now,standings:[]},{id:'q1',sessionType:'qualifying',trackId:'t',date:now,standings:[{driverId:'d'}]},{id:'q2',sessionType:'qualifying',trackId:'t',date:now,standings:[{driverId:'mate'}]}];const source={sessions:()=>rows,laps:()=>[],meta:()=>[]};assert.deepEqual(D.navigation(source,{trackId:'t',champId:''}).map(s=>s.id),['q2']);});

test('Home statistics never reconstruct full SQLite records or load media blobs',t=>{const {repo,store}=fixture(t);store.get=store.asset=()=>{throw Error('Unexpected full record/blob read');};equivalent(store.homeStatistics(request()),repo.homeStatistics(request()));});
test('Home labels retain unnamed records and Paddock display names',()=>{const source={sessions:()=>[{id:'s',sessionType:'race',date:now,standings:[]}],laps:()=>[{trackId:'t',sessionId:'s',driverId:'d',carId:'c',time:5000,date:now}],meta:e=>e==='drivers'?[{id:'d',name:''}]:e==='tracks'?[{id:'t',name:''}]:[{id:'c',model:'Fallback',paddock:{name:'Dealer name'}}]};const got=D.home(source,request());assert.equal(got.cards.record.rec.record.driver,'(unnamed)');assert.equal(got.cards.record.rec.record.car,'Dealer name');assert.equal(got.cards.records.records[0].trackName,'(unnamed)');});

test('SQLite Home parses only winning lap records, not its full history',t=>{
 const {store}=fixture(t); // Count complete lap projections, excluding typed SQL aggregates.
 const catalogue=require('../sqlite-catalogue'),original=catalogue.read;let parsed=0;
 const mock=t.mock.method(catalogue,'read',(...args)=>{if(args[1]==='laps')parsed++;return original(...args);});
 store.homeStatistics({...request(),boards:[{key:'glance',count:5,scope:'all',period:'all'}]});assert(parsed<=1);parsed=0;
 store.homeStatistics(request());assert(parsed<30);mock.mock.restore();
});

test('Home index changes atomically with results, eligibility, metadata and deletion',t=>{
 const {db,store,work}=fixture(t),check=()=>equivalent(store.homeStatistics(request()),expected(db,request()));
 const command={id:'new-result',type:'finalizeSession',session:{date:now,setupName:'Latest',sessionType:'race',trackId:'t',standings:[]},laps:[{trackId:'t',driverId:'d',carId:'c',time:3000,lane:2,date:now}]};
 const before=store.homeStatistics(request());store.checkpoint=p=>{if(p==='before-commit')throw Error('full disk');};assert.throws(()=>store.command(command),/full disk/);assert.deepEqual(store.homeStatistics(request()),before);store.checkpoint=()=>{};
 const saved=store.command(command);assert.deepEqual(store.command(command),saved);
 db.data.sessions.push(store.get('sessions',saved.sessionId,true).value);db.data.laps.push(...store.lapsFor(saved.sessionId));check();
 const lap=store.lapsFor(saved.sessionId)[0];store.command({id:'exclude-new',type:'setLapEligibility',lapId:lap.id,expectedRevision:store.revision('laps',lap.id),flags:{noTrackRecord:true,noPersonalBest:true}});Object.assign(db.data.laps.find(x=>x.id===lap.id),{noTrackRecord:true,noPersonalBest:true});check();
 const patch={name:'Renamed',laneModifier:'measured',laneLengths:[12.5,17.5]};store.command({id:'track-length',type:'updateRecord',entity:'tracks',recordId:'t',expectedRevision:store.revision('tracks','t'),patch});Object.assign(db.data.tracks[0],patch);check();
 store.command({id:'delete-new',type:'deleteSession',sessionId:saved.sessionId,expectedRevision:store.revision('sessions',saved.sessionId)});db.data.sessions=db.data.sessions.filter(x=>x.id!==saved.sessionId);db.data.laps=db.data.laps.filter(x=>x.sessionId!==saved.sessionId);check();
 store.close();const reopened=new WorkingStore(work);try{equivalent(reopened.homeStatistics(request()),expected(db,request()));}finally{reopened.close();}
});

test('Home index rebuilds after older writers and rolls back an interrupted upgrade',t=>{
 const {store,db,work}=fixture(t);store.db.exec("DELETE FROM home_laps;UPDATE info SET value='old' WHERE key='homeIndexSequence'");
 const original=store.statement.bind(store),mock=t.mock.method(store,'statement',sql=>{if(sql==='INSERT INTO home_laps VALUES(?,?,?,?,?,?,?,?,?,?)')throw Error('upgrade interrupted');return original(sql);});
 assert.throws(()=>require('../sqlite-home').upgrade(store),/upgrade interrupted/);mock.mock.restore();assert.equal(store.statement('SELECT count(*) n FROM home_laps').get().n,0);
 store.close();const reopened=new WorkingStore(work);try{equivalent(reopened.homeStatistics(request()),expected(db,request()));}finally{reopened.close();}
});

test('Home weekly and yearly cutoffs are evaluated anew as time advances',t=>{
 const {store,db}=fixture(t);for(const date of ['2026-11-02T00:00:00.000Z','2026-11-09T12:00:00.000Z','2027-01-01T12:00:00.000Z']){const o={...request(),now:date};o.boards.forEach(b=>b.period='year');equivalent(store.homeStatistics(o),expected(db,o));}
});

test('tied grid personal bests follow lap order, independent of driver selection order',t=>{
 const {store,db}=fixture(t,db=>{db.data.laps=[{id:'a',sessionId:'s1',trackId:'t',driverId:'d',carId:'c',time:3000,noTrackRecord:true},{id:'b',sessionId:'s1',trackId:'t',driverId:'mate',carId:'c',time:3000,noTrackRecord:true},{id:'record',sessionId:'s1',trackId:'t',driverId:'gone',carId:'c',time:5000}];});
 const o={...request(),driverIds:['mate','d'],grid:[{driverId:'mate',color:'#fff'},{driverId:'d',color:'#fff'}]};equivalent(store.homeStatistics(o),expected(db,o));
});

test('weekly fallback dates, numeric lap strings and invalid-lap flags retain their meaning',t=>{
 const {store,db}=fixture(t,db=>{db.data.laps=[
  {id:'a',sessionId:'s1',trackId:'t',driverId:'d',carId:'c',time:'3000',lane:'2'},
  {id:'b',sessionId:'s1',trackId:'t',driverId:'mate',carId:'c',time:2000,date:'bad',noPersonalBest:true},
  {id:'c',sessionId:'s1',trackId:'t',driverId:'mate',carId:'c',time:1000,date:now,invalid:'false'},
  {id:'d',sessionId:'s1',trackId:'t',driverId:'d',carId:'c',time:500,date:now,token:true},
  {id:'e',sessionId:'missing',trackId:'t',driverId:'mate',carId:'c',time:2500,date:''}];});
 for(const period of ['all','year']){const o=request();o.boards.forEach(b=>b.period=period);equivalent(store.homeStatistics(o),expected(db,o));}
});

test('abrupt exit during Home index rebuilding preserves history and rebuilds on reopen',t=>{
 const {store,db,work}=fixture(t);store.db.exec("DELETE FROM info WHERE key='homeIndexVersion'");store.close();
 const script="const S=require(process.argv[1]).SqliteStore,p=S.prototype.statement;S.prototype.statement=function(sql){const q=p.call(this,sql);if(sql.startsWith('INSERT INTO home_laps VALUES'))return {run(...args){q.run(...args);process.exit(73)}};return q};new(require(process.argv[2]).WorkingStore)(process.argv[3]);";
 const r=require('node:child_process').spawnSync(process.execPath,['-e',script,require.resolve('../sqlite-store'),require.resolve('../sqlite-working'),work],{stdio:'pipe',windowsHide:true,timeout:30000});assert.equal(r.status,73,String(r.stderr));
 const reopened=new WorkingStore(work);try{equivalent(reopened.homeStatistics(request()),expected(db,request()));assert.equal(reopened.statement('PRAGMA integrity_check').get().integrity_check,'ok');}finally{reopened.close();}
});

test('native backup and restore retain accurate Home totals and permit subsequent writes',t=>{
 const {store,db,dir}=fixture(t),Bulk=require('../sqlite-bulk'),backup=path.join(dir,'home-backup'),restored=path.join(dir,'home-restored');Bulk.snapshot(store,backup);Bulk.restore(backup,restored);
 const copy=new WorkingStore(restored);try{equivalent(copy.homeStatistics(request()),expected(db,request()));copy.command({id:'remove',type:'deleteSession',sessionId:'s1',expectedRevision:copy.revision('sessions','s1')});db.data.sessions=db.data.sessions.filter(x=>x.id!=='s1');db.data.laps=db.data.laps.filter(x=>x.sessionId!=='s1');equivalent(copy.homeStatistics(request()),expected(db,request()));}finally{copy.close();}
});
