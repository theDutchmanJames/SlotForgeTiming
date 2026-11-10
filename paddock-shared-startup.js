'use strict';
const Discovery=require('./paddock-local-discovery'),Launcher=require('./paddock-local-launch');
module.exports={
 async registeredLibraries(){return this.launcherScan?this.launcherScan():this.localScan?[]:Launcher.scan();},
 async localChoices(){
  const live=await (this.localScan||Discovery.scan)();let registered;try{registered=await this.registeredLibraries();}catch(e){if(!live.length)throw e;registered=[];}
  const choices=new Map(registered.map(x=>[x.key,{...x,registered:true}]));for(const x of live)choices.set(x.key,{...x,live:true});return [...choices.values()];
 },
 async launchSelected(selection){
  const launches=await this.registeredLibraries(),entry=launches.find(x=>x.key===selection.localKey&&x.databaseId===selection.databaseId);
  if(this.stopped||this.quiescing||this.isRacing?.())throw Error('Local library startup paused.');
  if(!entry)throw Error('Open Paddock once and enable Local library access to register this library.');
  this.launchAttempts??=new Set();if(this.launchAttempts.has(entry.key))throw Error('Paddock did not become available. Use Retry connection, or open Paddock.');this.launchAttempts.add(entry.key);
  await (this.localLaunch||Launcher.launch)(entry);
  const until=Date.now()+(this.launchWaitMs??30000);
  do{
   if(this.stopped||this.quiescing||this.isRacing?.())throw Error('Local library startup paused.');
   const live=await (this.localScan||Discovery.scan)();const d=live.find(x=>x.key===selection.localKey);
   if(d){if(d.databaseId!==selection.databaseId)throw Error('Paddock now contains a different database. Reconnect deliberately.');try{await this.ensureLocal(selection);return;}catch(e){if(e.code==='DATABASE_MISMATCH')throw e;}}
   await new Promise(resolve=>setTimeout(resolve,this.launchPollMs??750));
  }while(Date.now()<until);
  throw Error('Paddock did not become ready within 30 seconds. Open Paddock or retry the connection.');
 },
 async startSharedLibrary(retry=false){
  if(this.sharedStarting)return this.sharedStarting;
  if(this.sharedStartupDone&&!retry)return;
  this.sharedStartupDone=true;if(retry)this.launchAttempts=new Set();
  this.sharedStarting=(async()=>{
   try{
    if(this.stopped||this.quiescing||this.isRacing?.())return;
    const c=(await this.connection()).connection,policy=await this.storage.sharedRead({kind:'policy'});
    if(c&&(c.mode!=='local'||c.automatic===false)||!c&&policy.disabled)return;
    const choices=await this.localChoices();
    if(!c&&choices.length!==1){if(choices.length>1)this.error='Several local Paddock libraries are available. Choose one in Connection & results.';return;}
    const chosen=c||{mode:'local',localKey:choices[0].key,databaseId:choices[0].databaseId,automatic:true};
    if(this.stopped||this.quiescing||this.isRacing?.())return;
    await this.connectLocal({key:chosen.localKey,databaseId:chosen.databaseId});
    await this.catalogue(true,false);
   }catch(e){this.error=e.message;}finally{this.sharedStarting=null;}
  })();return this.sharedStarting;
 }
};
