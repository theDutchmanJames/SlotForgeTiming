const assert=require('node:assert/strict'),path=require('node:path'),{fork}=require('node:child_process');
const D=require('../renderer/plugindisplay'),P=require('../pluginpackage'),W=require('../renderer/widgets'),T=require('../renderer/timing'),Preview=require('../renderer/widgetpreview');
const {Store}=require('../pluginstore'),{Runtime}=require('../pluginruntime'),{DisplayHost}=require('../plugindisplayhost'),{make}=require('../tools/fixtures/display-plugin.cjs');
const pack=P.validate(make());assert.deepEqual(P.validate(pack),pack);
const legacy=make();delete legacy.manifest.display;assert(!Object.hasOwn(P.validate(legacy).manifest,'display'),'Legacy manifest digest has no new default field');
for(const change of [d=>d.widgets.push(d.widgets[0]),d=>d.widgets[0].scope='host',d=>d.api=2,d=>d.pages[0].settings.push({...d.pages[0].settings[0],id:'__proto__'}),d=>d.tools[0].settings[0].default=Infinity]){const p=make();change(p.manifest.display);assert.throws(()=>P.validate(p));}
for(const v of [{kind:'html',text:'<script>'},{kind:'text',text:'a',style:'color:red'},{kind:'bar',value:101},{kind:'line',points:[1]},{kind:'text',text:'x'.repeat(501)}])assert.throws(()=>D.view(v));
let deep={kind:'text',text:'x'};for(let i=0;i<7;i++)deep={kind:'column',children:[deep]};assert.throws(()=>D.view(deep));
assert(!D.html({kind:'text',text:'<img src=x onerror=alert(1)>'}).includes('<img'));
assert.throws(()=>D.view({kind:'bar',value:1e9,min:1e9,max:1e9}),/positive range/);
const S=Preview.state({}),snapshot=D.cleanSnapshot(D.snapshot(S));assert.equal(snapshot.lanes.length,8);assert.equal(snapshot.lanes[0].values.name,'James');assert(!JSON.stringify(snapshot).includes('dataDir'));assert.throws(()=>D.cleanSnapshot({...snapshot,settings:{}}));
const widget={...W.newWidget('pluginlane',0,0,0),opt:{pluginView:'example.race-display/pace',plugin_target:12,plugin_heading:'My pace'}};
const req=D.request(widget);assert.equal(req.settings.target,12);assert.match(T.content(widget,{...S,pluginViews:{}}).html,/unavailable/);
assert.deepEqual(D.request(JSON.parse(JSON.stringify(widget))),req,'Saved layouts retain stable selection and options');
const root=path.resolve(__dirname,'../.tmp-test/plugin-display-'+process.pid),store=new Store(root,'1.99.2');
const DB=require('../db'),Transfer=require('../transfer'),Packs=require('../contentpacks');
const source=new DB(path.join(root,'source.json')),target=new DB(path.join(root,'target.json'));
const layout=source.add('layouts',{name:'Plugin layout',ratioW:10,ratioH:6,widgets:[widget]});
const bundle=Transfer.collect(source.data,{layouts:[layout.id]});Transfer.apply(target,bundle);
assert.deepEqual(target.data.layouts.at(-1).widgets[0].opt,widget.opt,'Export/import preserves plugin selection and settings without installation');
const contentPack=Packs.create(source.data,{layouts:[layout.id]},{id:'test.plugin-layout',name:'Plugin layout',author:'Tests',license:'MIT',version:'1.0.0',minAppVersion:'1.99.2'},[],'1.99.2');assert.deepEqual(contentPack.items.layouts[0].widgets[0].opt,widget.opt);assert(!contentPack.files,'Content sharing contains no executable plugin');
const launch=init=>{const c=fork(path.resolve(__dirname,'../pluginworker.js'),[],{cwd:init.dataDir,stdio:['ignore','pipe','pipe','ipc']});c.postMessage=m=>c.send(m);return c;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const runtime=new Runtime(store,launch),host=new DisplayHost(runtime);try{
 store.install(pack);assert.equal(host.catalog()[0].state,'stopped');await runtime.start(pack.manifest.id);
 const views=await host.render(snapshot,[req]);assert.match(T.content(widget,{...S,pluginViews:views}).html,/My pace/);assert.match(D.html(views[req.key].view),/12.000/);
 const old={...req,settings:{...req.settings,retired_option:'kept'}};assert(!Object.hasOwn(host.resolve(old).settings,'retired_option'));assert.equal(old.settings.retired_option,'kept','Removed inputs remain available for layout rollback');
 await assert.rejects(()=>host.render(snapshot,[req]),/refresh/);await wait(210);
 const bad={...req,key:'missing',item:'gone'},wrongLane={...req,key:'lane',lane:9};const errors=await host.render(snapshot,[bad,wrongLane]);assert.match(errors.missing.error,/missing/);assert.match(errors.lane.error,/lane/);
 const tool=await host.tool({plugin:pack.manifest.id,item:'estimate',settings:{target:10,laps:60}});assert.match(D.html(tool),/10.0 minutes/);assert.throws(()=>host.resolve({...req,settings:{target:999}}));
 runtime.timing={uses:()=>true};await assert.rejects(()=>host.tool({plugin:pack.manifest.id,item:'estimate',settings:{}}),/Disconnect/);delete runtime.timing;
 // Rendering and sensor commands have separate pending requests in one worker.
 const combined=require('../tools/fixtures/timing-plugin.cjs').make();combined.manifest.id='test.combined';combined.manifest.display={api:1,widgets:[{id:'slow',label:'Slow async view',scope:'race'}]};const entry=combined.entry;combined.files[entry]=Buffer.from(Buffer.from(combined.files[entry],'base64').toString()+`\nexports.widgets={slow:async()=>{await new Promise(r=>setTimeout(r,150));return {kind:'text',text:'Ready'};}};`).toString('base64');store.install(combined);await runtime.start(combined.manifest.id);
 const timing=new (require('../plugintiming').TimingHost)(runtime,{selected:()=>true});await timing.connect(require('../renderer/timingplugin').config({id:combined.manifest.id}));
 const pending=runtime.display(combined.manifest.id,{snapshot,requests:[{kind:'widgets',item:'slow',settings:{},lane:null}]});await timing.simulate({kind:'lap',channel:0,on:true});assert(timing.connected);assert.equal((await pending)[0].text,'Ready');await timing.disconnect();await runtime.stop(combined.manifest.id);
 await runtime.stop(pack.manifest.id);await wait(210);const stopped=await host.render(snapshot,[req]);assert.match(stopped[req.key].error,/not running/);assert.equal(widget.opt.pluginView,'example.race-display/pace');
 const hang=make();hang.manifest.id='test.display-timeout';hang.files['index.cjs']=Buffer.from(`exports.widgets={pace:()=>new Promise(()=>{}),field:()=>({kind:'text',text:'ok'})};exports.pages={overview:()=>({kind:'text',text:'ok'})};exports.tools={estimate:()=>({kind:'text',text:'ok'})};`).toString('base64');store.install(hang);await runtime.start(hang.manifest.id);await assert.rejects(()=>runtime.display(hang.manifest.id,{snapshot,requests:[req]}),/timed out/);assert.throws(()=>runtime.display(hang.manifest.id,{}),/Restart/);assert.equal(runtime.state(hang.manifest.id).state,'running','Async display timeout does not kill timing/background worker');
 console.log('PLUGIN DISPLAY PASSED: schema, escaping, bounds, saved layouts, snapshots, worker rendering, tools, lifecycle and timeout isolation.');
}finally{await runtime.shutdown();}})().catch(e=>{console.error(e);process.exitCode=1;});
