const fs=require('node:fs'),path=require('node:path'),P=require('./pluginpackage');
const {Store}=require('./pluginstore'),{Runtime}=require('./pluginruntime');
function register({ipcMain,dialog,BrowserWindow,app,utilityProcess,getMain,isRacing,appVersion,root,launch,getSettings=()=>({}),onTiming=()=>{}}){
 const store=new Store(root,appVersion);
 const runtime=new Runtime(store,launch||((init)=>utilityProcess.fork(path.join(__dirname,'pluginworker.js'),[],{cwd:init.dataDir,stdio:'pipe',serviceName:'SlotForge plugin: '+init.manifest.id})),{disabled:process.argv.includes('--disable-plugins'),canStart:()=>!isRacing()});
 const timing=new (require('./plugintiming').TimingHost)(runtime,{emit:onTiming,selected:()=>getSettings().timingHw==='plugin',isRacing});
 const display=new (require('./plugindisplayhost').DisplayHost)(runtime);runtime.displays=display;
 const rules=new (require('./pluginrulehost').RuleHost)(runtime);
 let pending=null,busy=false;
 const idle=()=>{if(isRacing()||timing.reservation)throw Error('Finish the race and finalise its results before changing or running plugins.');if(runtime.closing)throw Error('SlotForge is shutting down.');};
 const handle=(name,fn,mutation=false)=>ipcMain.handle('plugins:'+name,async(e,...args)=>{
  const win=getMain();if(!win||win.isDestroyed()||e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame)throw Error('Manage plugins in the main app window.');
  if(mutation){idle();if(busy)throw Error('Another plugin operation is in progress.');busy=true;}
  try{return await fn(e,...args);}finally{if(mutation)busy=false;}
 });
 handle('list',()=>({...runtime.list(),raceLocked:isRacing()||!!timing.reservation,appVersion}));
 handle('displayCatalog',()=>display.catalog());
 handle('ruleCatalog',()=>rules.catalog());
 handle('rulePrepare',(_e,id,saved)=>rules.prepare(id,saved),true);
 handle('displayRender',(_e,snapshot,requests)=>display.render(snapshot,requests));
 handle('displayTool',(_e,request)=>display.tool(request),true);
 handle('open',async e=>{
  pending=null;const r=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{properties:['openFile'],filters:[{name:'SlotForge code plugin',extensions:['slotforge-plugin']}]});idle();
  if(r.canceled||!r.filePaths.length)return {canceled:true};const file=r.filePaths[0];P.ok(fs.statSync(file).size<=P.MAX_BYTES,'Plugin exceeds 32 MB.');
  const candidate=P.validate(JSON.parse(fs.readFileSync(file,'utf8')),appVersion),previousVersion=store.state.plugins.find(r=>r.current.manifest.id===candidate.manifest.id)?.current.manifest.version||'';
  P.ok(!previousVersion||P.compare(candidate.manifest.version,previousVersion)>0,'Choose a newer version, or use Roll back.');pending=candidate;return {...P.summary(pending),previousVersion};
 },true);
 handle('cancel',()=>{pending=null;});
 handle('install',async()=>{P.ok(pending,'Choose and review a plugin first.');const reviewed=pending,id=reviewed.manifest.id;if(store.state.plugins.some(r=>r.current.manifest.id===id))await runtime.stop(id);idle();const result=store.install(reviewed);pending=null;return result;},true);
 handle('start',async(_e,id,digest,trust)=>{P.ok(trust===true,'Confirm that you trust this plugin to run with your operating-system access.');P.ok(store.get(id).current.digest===digest,'Plugin changed. Review it again.');return runtime.start(id);},true);
 handle('stop',(_e,id)=>runtime.stop(id),true);
 handle('settings',(_e,id,values)=>{P.ok(!runtime.workers.has(id),'Stop the plugin before changing its settings.');store.saveSettings(id,values);},true);
 handle('command',(_e,id,command)=>{P.ok(!timing.uses(id),'Disconnect the timing interface before running general plugin commands.');return runtime.command(id,command);},true);
 handle('rollback',async(_e,id)=>{await runtime.stop(id);idle();store.rollback(id);},true);
 handle('remove',async(_e,id,deleteData)=>{P.ok(typeof deleteData==='boolean','Choose whether to remove saved plugin data.');await runtime.stop(id);idle();store.remove(id,deleteData);},true);
 handle('disableAll',()=>runtime.disableAll(),true);
 handle('restartSafe',()=>{app.relaunch({args:[...process.argv.slice(1).filter(a=>a!=='--disable-plugins'),'--disable-plugins']});app.quit();},true);
 handle('timingList',()=>({...timing.state(),entries:timing.entries(),saved:getSettings().pluginTiming||null}));
 handle('timingConnect',(_e,value)=>{P.ok(JSON.stringify(timing.validate(value))===JSON.stringify(timing.validate(getSettings().pluginTiming)),'Save the lane configuration before connecting.');return timing.connect(value);});
 handle('timingClose',()=>timing.disconnect());
 handle('timingAlive',()=>timing.alive());
 handle('timingRace',(_e,on,lanes,lease)=>timing.race(on,lanes,lease));
 handle('timingOutputs',(_e,value,lease)=>timing.outputs(value,lease));
 handle('timingSimulate',(_e,value)=>timing.simulate(value));
 // Timing drivers use the controller above; they cannot call arbitrary app IPC.

 runtime.boot().catch(e=>{runtime.error='Plugin startup failed: '+e.message;});
 return runtime;
}
module.exports={register};
