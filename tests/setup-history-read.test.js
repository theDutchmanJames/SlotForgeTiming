'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),Repository=require('../data-repository'),Client=require('../sqlite-client'),{migrateCopy}=require('../sqlite-migration'),{forkCopy,WorkingStore}=require('../sqlite-working'),UI=require('../renderer/editordata'),H=require('../setup-history-read'),V=require('../renderer/virtualrival'),C=require('../renderer/championship'),P=require('../renderer/champpoints');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-setup-history-')),db=new Database(path.join(dir,'source.json')),seed=require('./fixtures/setup-history.cjs')(db);db.saveNow();const original=fs.readFileSync(db.file),copy=path.join(dir,'copy'),work=path.join(dir,'work');migrateCopy({source:db.file,destination:copy});forkCopy(copy,work);const store=new WorkingStore(work),repo=new Repository(db);t.after(async()=>{store.close();await db.writesIdle();assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(dir,{recursive:true,force:true});});return {db,store,repo,work,...seed};}
const read=(source,kind,opts)=>UI.setupHistory({editorRead:(...args)=>source.editorRead(...args)},kind,opts);

test('championship screens discard superseded selections and detached editor reads',async()=>{
 const vm=require('node:vm'),context=vm.createContext({}),pending=[];
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/championshipui.js'),'utf8'),context);
 context.pending=pending;context.box={innerHTML:'original',isConnected:true};
 vm.runInContext('champData=selection=>new Promise(resolve=>pending.push({selection,resolve}));champView.id="cup";',context);
 const first=vm.runInContext('renderChampStandings(box)',context);
 vm.runInContext('champView.id="other"',context);
 const second=vm.runInContext('renderChampStandings(box)',context);
 assert.equal(pending[0].selection.champId,'cup');assert.equal(pending[1].selection.champId,'other');
 pending[1].resolve({champs:[]});await second;context.box.innerHTML='latest selection';
 pending[0].resolve({champs:[{id:'cup'}]});await first;assert.equal(context.box.innerHTML,'latest selection');
 const detached=vm.runInContext('renderChampStandings(box)',context);context.box.isConnected=false;
 pending[2].resolve({champs:[]});await detached;assert.equal(context.box.innerHTML,'latest selection');
 context.api={list:async()=>[]};context.box.isConnected=true;
 vm.runInContext('champLists=()=>new Promise(resolve=>pending.push({resolve}));chEd={id:"cup"}',context);
 const editor=vm.runInContext('renderChampionships(box)',context);await new Promise(setImmediate);
 vm.runInContext('chEd={id:"other"}',context);pending[3].resolve({sessions:[]});await editor;
 assert.equal(context.box.innerHTML,'latest selection');assert.equal(vm.runInContext('chEd.lists',context),undefined);
});
test('source choices preserve physical/token eligibility and original session order without lap payloads',async t=>{
 const {db,repo,store}=fixture(t),ids=new Set(db.data.laps.filter(l=>!l.virtualRival&&!l.token).map(l=>l.sessionId));
 const expected=db.data.sessions.filter(s=>ids.has(s.id)).map(s=>require('../history-read').pick(s,H.RIVAL));
 for(const source of [repo,store]){const p=await read(source,'rival-sources');assert.deepEqual(p.items,expected);assert(!JSON.stringify(p).includes('base64'));assert(!p.items.some(s=>s.id==='virtual-only'||s.id==='token-only'||s.id==='empty'));}
});
test('selected recordings page all laps without changing order, replay, heat identity or lane lengths',async t=>{
 const {db,repo,store}=fixture(t);
 for(const source of [repo,store]){const p=await read(source,'rival-laps',{id:'recording'});assert.equal(p.items.length,1201);assert.deepEqual(p.items,db.data.laps.filter(l=>l.sessionId==='recording').map(l=>require('../history-read').pick(l,H.LAP)));
  for(const driver of ['d','b'])for(const heat of ['0','1','']){const before=V.capture(db.data.sessions[1],db.data.laps,driver,heat),after=V.capture(p.session,p.items,driver,heat);assert.deepEqual(after,before);for(const speed of [80,100,120])for(const includePits of [true,false])assert.deepEqual(V.sequence({...after,speed,includePits}),V.sequence({...before,speed,includePits}));}
  assert.deepEqual(p.track.laneLengths,[20,22]);assert.equal((await read(source,'rival-laps',{id:'deleted'})).session,null);
 }
});
test('championship progress, awards, reruns, team and class standings match full-history calculations',async t=>{
 const {db,repo,store,cup}=fixture(t),ctx={drivers:db.data.drivers,teams:db.data.teams,setups:db.data.racesetups};
 for(const source of [repo,store]){
  const summaries=(await read(source,'champ-progress',{champIds:['cup']})).items,selected=(await read(source,'champ-sessions',{champIds:['cup']})).items;
  assert.equal(selected.length,5);assert(!summaries.some(s=>'standings' in s));assert.deepEqual(C.progress(cup,summaries).rounds,C.progress(cup,db.data.sessions).rounds);assert.deepEqual(C.progress(cup,summaries).next,C.progress(cup,db.data.sessions).next);
  for(const overrides of [{},{drops:1},{teamRace:'split'},{teamRace:'team'}])for(const classId of ['', 'gt3'])assert.deepEqual(P.standings({...cup,...overrides},selected,{...ctx,classId}),P.standings({...cup,...overrides},db.data.sessions,{...ctx,classId}));
  for(const s of selected){assert.deepEqual(P.awardView(cup,s,selected,ctx),P.awardView(cup,s,db.data.sessions,ctx));for(const mode of ['award','undo','on','off'])assert.deepEqual(P.awardPatches(selected,s,mode,'now'),P.awardPatches(db.data.sessions,s,mode,'now'));}
  assert.deepEqual((await read(source,'champ-sessions',{sessionIds:['recording','deleted']})).items,selected);assert.deepEqual((await read(source,'champ-sessions',{champIds:[]})).items,[]);
 }
});
test('SQLite reads only selected session metadata and selected lap rows; lookup indexes remain in use',async t=>{
 const {store}=fixture(t),statement=store.statement.bind(store),loaded=[];store.get=()=>{throw Error('Full record loaded');};store.asset=()=>{throw Error('Media loaded');};
 store.statement=sql=>{const stmt=statement(sql);return new Proxy(stmt,{get(target,key){const fn=target[key];if(typeof fn!=='function')return fn;return (...args)=>{if(sql.startsWith('SELECT json FROM fields')&&args[0]==='sessions')loaded.push(args[1]);return fn.apply(target,args);};}});};
 await read(store,'champ-sessions',{champIds:['cup']});assert(loaded.length);assert(loaded.every(id=>!id.startsWith('other-')));
 const p=await read(store,'rival-laps',{id:'recording'});assert(p.items.every(l=>l.sessionId==='recording'));
 assert(statement("EXPLAIN QUERY PLAN SELECT id FROM history_sessions WHERE json_extract(summary,'$.champ.id') IN (SELECT value FROM json_each(?)) AND ordinal>? ORDER BY ordinal LIMIT ?").all('["cup"]',-1,101).some(r=>r.detail.includes('history_championship')));
 assert(statement('EXPLAIN QUERY PLAN SELECT id FROM lap_index WHERE sessionId=?').all('recording').some(r=>r.detail.includes('lap_session')));
});
test('invalid, cross-selection and stale history cursors are refused',t=>{
 const {repo,store}=fixture(t);for(const source of [repo,store]){
  const p=source.editorRead('rival-laps','laps',{id:'recording'});assert(p.next);
  assert.throws(()=>source.editorRead('rival-laps','laps',{id:'other-0',cursor:p.next}),/cursor/);
  assert.throws(()=>source.editorRead('rival-laps','laps',{id:'recording',cursor:{...p.next,revision:'stale'}}),e=>e.code==='CATALOGUE_CHANGED');
  for(const [kind,entity,o] of [['rival-laps','sessions',{id:'recording'}],['rival-laps','laps',{id:''}],['champ-sessions','sessions',{champIds:[{}]}],['rival-sources','sessions',{cursor:{ordinal:-1}}]])assert.throws(()=>source.editorRead(kind,entity,o));
 }
});
test('worker transport returns the same bounded projections as JSON',async t=>{
 const {repo,work}=fixture(t),client=new Client();try{await client.openWorking(work);for(const [kind,o] of [['rival-sources',{}],['rival-laps',{id:'recording'}],['champ-progress',{champIds:['cup']}],['champ-sessions',{sessionIds:['recording']}]]){const a=await read(client,kind,o),b=await read(repo,kind,o);delete a.revision;delete b.revision;assert.deepEqual(a,b);}}finally{await client.close();}
});
test('a changed paged read restarts without mixing recordings or partial scores',async()=>{
 let n=0;const api={editorRead:async()=>{n++;if(n===2)throw Object.assign(Error('changed'),{code:'CATALOGUE_CHANGED'});return n===1?{items:['old'],session:{id:'old'},next:{}}:n===3?{items:['new'],session:{id:'new'},next:{}}:{items:['last'],next:null};}};
 assert.deepEqual((await UI.setupHistory(api,'rival-laps',{id:'s'})).items,['new','last']);assert.equal(n,4);
});
test('JSON source eligibility cache follows revisions, corrections and replacement arrays',async t=>{
 const {db,repo}=fixture(t);assert(!(await read(repo,'rival-sources')).items.some(s=>s.id==='virtual-only'));
 const lap=db.data.laps.find(l=>l.id==='virtual');lap.virtualRival=false;db.touch(lap);
 assert((await read(repo,'rival-sources')).items.some(s=>s.id==='virtual-only'));
 db.data.laps=db.data.laps.filter(l=>l.id!=='virtual');
 assert(!(await read(repo,'rival-sources')).items.some(s=>s.id==='virtual-only'));
});
test('selected final lap pages drive joins from the session index, never the complete ordinal history',t=>{
 const {store}=fixture(t),statement=store.statement.bind(store),queries=[];
 store.statement=sql=>{if(sql.includes('CROSS JOIN records'))queries.push(sql);return statement(sql);};
 const first=store.editorRead('rival-laps','laps',{id:'recording'});store.editorRead('rival-laps','laps',{id:'recording',cursor:first.next});assert.equal(queries.length,2);
 const plan=statement('EXPLAIN QUERY PLAN '+queries[1]).all('recording',500,501).map(r=>r.detail);
 assert(plan[0].includes('SEARCH l USING COVERING INDEX lap_session (sessionId=?)'),plan.join('\n'));assert(!plan.some(p=>p.startsWith('SCAN r')),plan.join('\n'));
});
