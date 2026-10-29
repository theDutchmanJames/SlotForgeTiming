const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../renderer/plugindisplayclient.js'),'utf8');
let now=0,calls=[],settle;
const c={console,Date,performance:{now:()=>now},document:{hidden:true},setInterval:()=>1,PluginDisplay:{snapshot:S=>({session:S.raceId})},api:{pluginDisplayCatalog:async()=>[],pluginDisplayRender:async(s,req)=>{calls.push({s,req});return Object.fromEntries(req.map(r=>[r.key,{view:{kind:'text',text:r.key}}]));}}};c.window=c;vm.createContext(c);vm.runInContext(source,c);const client=c.PluginDisplayClient;
const req=(key,kind='widgets')=>({key,kind,plugin:'test.views',item:'view',lane:0,settings:{}}),state={raceId:'race-1'};
(async()=>{
 for(let i=0;i<100;i++)client.read(req('same'),state);await client.tick();assert.equal(calls.length,1);assert.equal(calls[0].req.length,1,'100 identical widgets share one worker request');
 client.read(req('private-page','pages'),state);now=500;await client.tick();assert(!Object.hasOwn(client.raceViews('race-1'),'private-page'),'Page output is never broadcast as race widgets');
 now=1801;await client.tick();assert.equal(Object.keys(client.raceViews('race-1')).length,0,'Hidden/unused demands and cache expire');assert.equal(calls.length,2);
 for(let i=0;i<40;i++)client.read(req(String(i)),state);now=2000;await client.tick();assert.equal(calls.at(-1).req.length,32);assert.match(client.read(req('39'),state).error,/32 distinct/);
 let entered=0;c.api.pluginDisplayRender=async()=>{entered++;return new Promise(r=>{settle=r;});};now=2500;const pending=client.tick();await Promise.resolve();const previous=calls.length;await client.tick();assert.equal(entered,1,'Overlapping refresh skips work');settle({});await pending;
 assert.equal(Object.keys(client.raceViews('race-2')).length,0,'New race never reads prior race results');
 console.log('PLUGIN DISPLAY CLIENT PASSED: deduplication, bounded batches, hidden demand expiry, page privacy, overlap and race isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
