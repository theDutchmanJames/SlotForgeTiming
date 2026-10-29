const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fork}=require('node:child_process');
const P=require('../pluginpackage'),{Store}=require('../pluginstore'),{Runtime}=require('../pluginruntime');
const root=path.resolve(__dirname,'../.tmp-test/plugins-runtime-'+process.pid);const store=new Store(root,'1.99.2');
const make=(id,code)=>({format:P.FORMAT,apiVersion:1,manifest:{id,name:id,version:'1.0.0',author:'Tests',license:'MIT',minAppVersion:'1.99.2',runtime:'node',commands:[{id:'run',label:'Run'}]},entry:'index.cjs',files:{'index.cjs':Buffer.from(code).toString('base64')}});
const launch=init=>{const c=fork(path.resolve(__dirname,'../pluginworker.js'),[],{cwd:init.dataDir,stdio:['ignore','pipe','pipe','ipc']});c.postMessage=m=>c.send(m);return c;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const host=new Runtime(store,launch,{startMs:1800,heartbeatMs:900,commandMs:700,stopMs:100});
 try{
  store.install(make('test.good',`exports.activate=c=>c.log('Ready');exports.commands={run:c=>{const n=(c.storage.get('count')||0)+1;c.storage.set('count',n);c.status('Count '+n);return n;}};`));
  await host.start('test.good');assert.equal(host.state('test.good').state,'running');assert.equal(await host.command('test.good','run'),'1');await host.stop('test.good');assert.equal(store.get('test.good').enabled,false);
  await host.start('test.good');assert.equal(await host.command('test.good','run'),'2');assert.throws(()=>host.command('test.good','unknown'));
  await host.shutdown();assert.equal(fs.existsSync(host.marker),false);assert.equal(store.get('test.good').enabled,true);
  const safe=new Runtime(store,()=>{throw Error('Must not launch');},{disabled:true});await safe.boot();await assert.rejects(()=>safe.start('test.good'));await safe.shutdown();
  const racing=new Runtime(store,()=>{throw Error('Must not launch during race');},{canStart:()=>false});await racing.boot();await assert.rejects(()=>racing.start('test.good'),/Finish the race/);await racing.shutdown();
  fs.writeFileSync(path.join(root,'session-active.json'),'unclean');const recovery=new Runtime(store,()=>{throw Error('Must not auto-start after crash');});assert.equal(recovery.recovery,true);await recovery.boot();await recovery.shutdown();
  const auto=new Runtime(store,launch);await auto.boot();assert.equal(auto.state('test.good').state,'running');await auto.disableAll();await auto.shutdown();
  // Use a fresh supervisor after testing clean shutdown and startup guards.
  const faults=new Runtime(store,launch,{startMs:1300,heartbeatMs:800,commandMs:650,stopMs:100});
  try{
   store.install(make('test.crash',`exports.activate=()=>{throw Error('Deliberate crash');};exports.commands={run:()=>0};`));await assert.rejects(()=>faults.start('test.crash'),/Deliberate crash/);await wait(150);assert.equal(store.get('test.crash').enabled,false);assert.equal(faults.state('test.crash').state,'failed');
   store.install(make('test.freeze',`exports.activate=()=>{while(true){}};exports.commands={run:()=>0};`));await assert.rejects(()=>faults.start('test.freeze'),/timed out/);await wait(150);assert.equal(store.get('test.freeze').enabled,false);
   store.install(make('test.command',`exports.commands={run:()=>new Promise(()=>{})};`));await faults.start('test.command');const cmd=faults.command('test.command','run');assert.throws(()=>faults.command('test.command','run'),/already running/);await assert.rejects(()=>cmd,/timed out/);await wait(150);assert.equal(store.get('test.command').enabled,false);
   store.install(make('test.heartbeat',`exports.commands={run:()=>0};exports.activate=()=>setTimeout(()=>{while(true){}},600);`));await faults.start('test.heartbeat');await wait(1800);assert.equal(store.get('test.heartbeat').enabled,false);
   store.install(make('test.flood',`exports.commands={run:()=>0};exports.activate=c=>{for(let i=0;i<200;i++)c.log('message');};`));await assert.rejects(()=>faults.start('test.flood'),/limit/);
   // Healthy plugin remains usable after other processes fail.
   await faults.start('test.good');assert.equal(await faults.command('test.good','run'),'3');await faults.disableAll();assert.equal(faults.workers.size,0);
   await faults.start('test.good');const original=store.enable;store.enable=()=>{throw Error('Disk full');};try{await assert.rejects(()=>faults.stop('test.good'),/Disk full/);assert.equal(faults.workers.size,0,'Disk failure must not prevent stopping code');}finally{store.enable=original;}
   await faults.shutdown();assert.ok(fs.existsSync(faults.marker),'Unpersisted disable keeps recovery marker');
  }finally{await faults.shutdown();}
  console.log('PLUGIN RUNTIME PASSED: real child processes; storage, commands, auto-start, safe startup, crash recovery, startup/command/heartbeat timeouts, flood limits and shutdown.');
 }finally{await host.shutdown();}
})().catch(e=>{console.error(e);process.exitCode=1;});
