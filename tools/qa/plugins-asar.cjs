// Verify the worker entry point from an ASAR archive, as in a packaged build.
const {app,utilityProcess}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Store}=require('../../pluginstore'),{Runtime}=require('../../pluginruntime'),P=require('../../pluginpackage');
const root=path.resolve(__dirname,'../../.tmp-test/plugin-asar-'+process.pid);fs.mkdirSync(root,{recursive:true});app.setPath('userData',path.join(root,'app'));app.disableHardwareAcceleration();
setTimeout(()=>app.exit(2),30000).unref();
app.whenReady().then(async()=>{
 let host;
 try{
  const src=path.join(root,'source'),archive=path.join(root,'app.asar');fs.mkdirSync(src);fs.copyFileSync(path.resolve(__dirname,'../../pluginworker.js'),path.join(src,'pluginworker.js'));
  fs.copyFileSync(path.resolve(__dirname,'../../plugintimingworker.js'),path.join(src,'plugintimingworker.js'));
  fs.mkdirSync(path.join(src,'renderer'));fs.copyFileSync(path.resolve(__dirname,'../../renderer/plugindisplay.js'),path.join(src,'renderer/plugindisplay.js'));
  fs.copyFileSync(path.resolve(__dirname,'../../renderer/ruleplugin.js'),path.join(src,'renderer/ruleplugin.js'));
  await require('@electron/asar').createPackage(src,archive);
  const store=new Store(path.join(root,'plugins'),'1.99.2');store.install({format:P.FORMAT,apiVersion:1,manifest:{id:'test.asar',name:'ASAR worker',version:'1.0.0',author:'Tests',license:'MIT',minAppVersion:'1.99.2',runtime:'node',commands:[{id:'read',label:'Read'}]},entry:'main.cjs',files:{'main.cjs':Buffer.from(`exports.commands={read:()=>42};`).toString('base64')}});
  host=new Runtime(store,init=>utilityProcess.fork(path.join(archive,'pluginworker.js'),[],{cwd:init.dataDir,stdio:'pipe'}));
  await host.start('test.asar');assert.equal(await host.command('test.asar','read'),'42');
  const pack=require('../fixtures/timing-plugin.cjs').make();store.install(pack);
  const timing=new (require('../../plugintiming').TimingHost)(host,{selected:()=>true});await host.start(pack.manifest.id);
  await timing.connect(require('../../renderer/timingplugin').config({id:pack.manifest.id}));assert(timing.connected);
  const {lease}=await timing.race(true,2);await timing.simulate({kind:'lap',channel:0,on:true});await timing.race(false,2,lease);
  const displayPack=require('../fixtures/display-plugin.cjs').make();store.install(displayPack);await host.start(displayPack.manifest.id);
  const display=new (require('../../plugindisplayhost').DisplayHost)(host);assert.match(JSON.stringify(await display.tool({plugin:displayPack.manifest.id,item:'estimate',settings:{target:10,laps:60}})),/10.0 minutes/);
  const rulePack=require('../fixtures/rule-plugin.cjs').make();store.install(rulePack);await host.start(rulePack.manifest.id);
  const rules=new (require('../../pluginrulehost').RuleHost)(host);assert.equal((await rules.prepare(rulePack.manifest.id)).plan.fuelMultiplier,1.2);
  await host.shutdown();assert.equal(fs.existsSync(host.marker),false);
  console.log('PLUGIN ASAR PASSED: archived worker and timing helper load external plugins, execute commands, connect sensors and shut down cleanly.');app.quit();
 }catch(e){console.error(e);if(host)await host.shutdown();app.exit(1);}
});
