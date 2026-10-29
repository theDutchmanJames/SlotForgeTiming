const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../pluginpackage'),{Store}=require('../pluginstore'),Packs=require('../contentpacks'),D=require('../renderer/plugindisplay'),E=require('../renderer/engine');
const root=path.resolve(__dirname,'../.tmp-test/plugin-audit-'+process.pid);fs.mkdirSync(root,{recursive:true});

test('rule pace statistics use the latest eligible laps without copying an entire endurance history',()=>{
 const Rules=require('../renderer/ruleplugin'),car={laps:Array.from({length:220},(_,i)=>5000+i),bad:[],invalid:[219,215],removed:[218],pitLaps:[217]};car.bad[216]=true;
 const expected=car.laps.filter((_,i)=>!car.bad[i]&&!car.invalid.includes(i)&&!car.removed.includes(i)&&!car.pitLaps.includes(i)).slice(-100).sort((a,b)=>a-b),ctx=Rules.context(car);
 assert.equal(ctx.averageMs,expected.reduce((a,b)=>a+b,0)/100);assert.equal(ctx.medianMs,(expected[49]+expected[50])/2);assert.equal(ctx.bestMs,expected[0]);assert.equal(ctx.lap,220);
 let reads=0;const history=new Proxy(Array(100000).fill(5000),{get(target,key){if(/^\d+$/.test(String(key)))reads++;return target[key];}});
 assert.equal(Rules.context({laps:history}).medianMs,5000);assert(reads<=100,'A clean long race needs only the latest 100 lap values');
});

test('verified package and registry must describe the same plugin',()=>{
 const store=new Store(path.join(root,'metadata'),'1.99.2'),pack=require('../tools/fixtures/display-plugin.cjs').make();store.install(pack);
 const disk=JSON.parse(fs.readFileSync(store.file,'utf8'));disk.plugins[0].current.manifest.name='Altered manifest';fs.writeFileSync(store.file,JSON.stringify(disk));
 const loaded=new Store(store.root,'1.99.2');assert.equal(loaded.error,'');
 assert.throws(()=>loaded.verify(pack.manifest.id),/manifest|metadata/i);
});

test('content-pack rollback cannot change pack identity',()=>{
 const store=new Packs.Store(path.join(root,'packs.json'),'1.99.2');
 const pack={format:Packs.FORMAT,apiVersion:1,manifest:{id:'test.pack',name:'Test',version:'1.0.0',author:'Test',license:'MIT',minAppVersion:'1.99.2'},items:{},themes:[{id:'theme',name:'Theme',colors:require('../renderer/theme').customOf({})}]};
 store.install(pack);store.install({...pack,manifest:{...pack.manifest,version:'1.1.0'}});
 const disk=JSON.parse(fs.readFileSync(store.file,'utf8'));disk.packs[0].previous.manifest.id='another.pack';fs.writeFileSync(store.file,JSON.stringify(disk));
 const loaded=new Packs.Store(store.file,'1.99.2');assert.match(loaded.error,/rollback identity/i);assert.throws(()=>loaded.rollback('test.pack'));
});

test('truncated display laps retain an explicit absolute index origin',()=>{
 const S=require('../renderer/widgetpreview').state({}),car=S.carByLane(0);car.laps=Array.from({length:130},(_,i)=>10000+i);car.invalid=[29,30,129];
 const sample=D.cleanSnapshot(D.snapshot(S)).lanes[0];
 assert.equal(sample.lapStartIndex,30);assert.equal(sample.lapTimesMs[0],10030);assert.deepEqual(sample.invalidLapIndices,[30,129]);
 const old=D.snapshot(S);old.lanes.forEach(l=>delete l.lapStartIndex);assert.doesNotThrow(()=>D.cleanSnapshot(old),'Older API 1 senders still accepted');
 const fractional=D.snapshot(S);fractional.lanes[0].invalidLapIndices=[30.5];assert.throws(()=>D.cleanSnapshot(fractional));
 const outside=D.snapshot(S);outside.lanes[0].invalidLapIndices=[130];assert.throws(()=>D.cleanSnapshot(outside));
});

test('native disqualified heats do not acquire plugin score fields',()=>{
 const entries=[{driverId:'a',driverName:'James'},{driverId:'b',driverName:'Sam'}];
 const heat=E.createHeatRace({participants:entries,schedule:[[{p:0,lane:0},{p:1,lane:1}]],lanes:2,resultBy:'points',points:[10,8]});
 const race=E.createRace({type:'race',laps:20,entries:heat.entries()});race.start(0);race.cross(0,10000);race.cross(1,11000);race.stop(11000);race.cars[0].dq=true;heat.record(race);
 assert(heat.overall().every(row=>!Object.hasOwn(row,'pluginPoints')));
});

test('tool remains locked through display refresh and empty numeric input stays empty',async()=>{
 let callbacks,finish,calls=0,lastRequest;
 const field={value:''},button={disabled:false,dataset:{},hasAttribute:k=>k==='data-run'},status={},message={},output={innerHTML:''};
 const box={isConnected:true,innerHTML:'',querySelector:s=>s==='[data-run]'?button:s==='[data-page-runtime]'?status:s==='[data-page-message]'?message:s==='.pd-page-output'?output:field};
 const catalog=[{id:'test.tool',name:'Tool',state:'running',display:{pages:[],tools:[{id:'estimate',label:'Estimate',settings:[{id:'number',type:'number',min:0,max:10,default:1}]}]}}];
 const c={PluginDisplay:D,PluginDisplayClient:{refresh:async()=>{},catalog:()=>catalog,setPage:v=>callbacks=v},WidgetPreview:{state:()=>({preview:true})},PluginsPage:{field:()=>''},api:{pluginDisplayTool:r=>{calls++;lastRequest=r;return new Promise(resolve=>{finish=resolve;});}}};vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/pluginpages.js'),'utf8'),c);await c.renderPluginPages(box);
 const running=box.onclick({target:{closest:()=>button}});callbacks.paint();
 assert.equal(button.disabled,true,'Refresh must not unlock a pending tool');
 await box.onclick({target:{closest:()=>button}});assert.equal(calls,1);assert.equal(lastRequest.settings.number,null,'Blank is not numeric zero');
 finish({kind:'text',text:'Done'});await running;assert.equal(button.disabled,false);assert.match(output.innerHTML,/Done/);
 field.value='1';const again=box.onclick({target:{closest:()=>button}});
 assert(!output.innerHTML.includes('Done'),'A new run clears the previous result');
 await box.onclick({target:{closest:()=>({dataset:{page:'0'},hasAttribute:()=>false})}});callbacks.paint();assert(button.disabled);
 finish({kind:'text',text:'Old page result'});await again;assert(!output.innerHTML.includes('Old page result'),'Returning to a page must not insert an obsolete run');
 c.api.pluginDisplayTool=async()=>{throw Error('Tool failed');};await box.onclick({target:{closest:()=>button}});assert(!button.disabled);assert.match(output.innerHTML,/Tool failed/);
 c.WidgetPreview.state=()=>({preview:false,phase:'paused'});callbacks.paint();assert(button.disabled,'Race lock still applies after a tool finishes');
});

test('missing timing sequence faults the connection while retaining race ownership',async()=>{
 const {TimingHost}=require('../plugintiming'),C=require('../renderer/timingplugin'),pack=P.validate(require('../tools/fixtures/timing-plugin.cjs').make()),descriptor=pack.manifest.timing;
 const events=[],calls=[],config=C.config({id:pack.manifest.id});let now=10000;
 const runtime={store:{state:{plugins:[{current:{manifest:pack.manifest,digest:'abc',settings:{}}}]}},state:()=>({state:'running'}),hardware:async(id,op)=>{calls.push(op);return op==='clock'?{now}:['arm','connect'].includes(op)?{at:now,inputs:C.channels(descriptor).map(x=>({...x,on:false}))}:{ack:true};}};
 const host=new TimingHost(runtime,{clock:()=>now,selected:()=>true,emit:e=>events.push(e)});
 try{await host.connect(config);const {lease}=await host.race(true,2);now++;
  host.receive(pack.manifest.id,{type:'timing-input',connection:host.connection,generation:host.generation,sequence:2,kind:'lap',channel:0,on:true,at:now});
  assert.equal(host.connected,false);assert.match(host.error,/sequence/i);assert.equal(host.reservation.lease,lease);assert(!events.some(e=>e.type==='sample'));await host.tail;assert(calls.includes('disconnect'));
  const hardware=runtime.hardware;runtime.hardware=async(id,op)=>{
   if(op==='connect')for(const sequence of [1,2])host.receive(id,{type:'timing-input',connection:host.connection,generation:host.generation,sequence,kind:'lap',channel:0,on:sequence===1,at:now});
   return hardware(id,op);
  };
  await host.connect(config);assert(host.connected);assert.equal(host.sequence,2,'Snapshot covers buffered input messages');now++;
  host.receive(pack.manifest.id,{type:'timing-input',connection:host.connection,generation:host.generation,sequence:3,kind:'lap',channel:0,on:true,at:now});assert.equal(events.at(-1).type,'sample');
 }finally{await host.shutdown();}
});
