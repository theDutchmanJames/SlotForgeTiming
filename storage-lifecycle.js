'use strict';
// Settings and recovery are storage operations, not renderer-owned cached database objects.
const {randomUUID}=require('node:crypto');
const copy=value=>structuredClone(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validResume=value=>plain(value)&&value.v===1&&plain(value.race)&&(plain(value.eng)||plain(value.heat)&&plain(value.heat.state));
function settingsPatch(value){
  if(!plain(value)||!Object.keys(value).every(k=>!['__proto__','constructor','prototype'].includes(k)))throw Error('Invalid settings patch.');
  const normalized=JSON.parse(JSON.stringify(value));if(!plain(normalized))throw Error('Invalid settings patch.');return normalized;
}
class JsonLifecycleBackend {
  constructor(db){this.db=db;}
  settings(){return copy(this.db.getSettings());}
  async saveSettings(patch){
    await this.db.sw.whenIdle();
    const next={...this.db.getSettings(),...patch};
    // Publish to memory only after the sidecar is durable. A rejected edit remains rejected on screen.
    await this.db.sw.write(JSON.stringify(next,null,2));this.db.data.settings=next;
    return copy(next);
  }
  async resume(){await this.db.resumeIdle();return copy(this.db.getResume());}
  saveResume(snapshot){return this.db.saveResumeAsync(snapshot);}
  async clearResume(){if(!await this.db.clearResumeAsync())throw Error('Could not remove the race recovery file.');return true;}
  pending(){return this.db.writesPending();}
  idle(){return this.db.writesIdle();}
  diagnostics(){return {backend:'json',database:this.db.dbStats(),save:this.db.resumeStats()};}
}
class SqliteLifecycleBackend {
  constructor(client){this.client=client;}
  async settings(){return (await this.client.snapshot('@meta','settings',true)).record?.value||{theme:'dark'};}
  async saveSettings(patch,id){
    const snapshot=await this.client.snapshot('@meta','settings');
    await this.client.command({id,type:'setSettings',patch,expectedRevision:snapshot.revision});
    return this.settings();
  }
  async resume(){const record=(await this.client.snapshot('@meta','raceResume',true)).record;return validResume(record?.value)?record.value:null;}
  async writeResume(snapshot,id){
    const before=await this.client.snapshot('@meta','raceResume');
    await this.client.command({id,type:'setRaceResume',snapshot,expectedRevision:before.revision});return true;
  }
  saveResume(snapshot,id){return this.writeResume(snapshot,id);}
  clearResume(id){return this.writeResume(null,id);}
  pending(){return this.client.pending.size>0;}
  idle(){return this.client.lifecycleBarrier();}
  close(){return this.client.close();}
  diagnostics(){return this.client.lifecycleDiagnostics();}
}
class StorageLifecycle {
  constructor(backend,{resources=null}={}){
    this.backend=backend;this.resources=resources;this.settingsTail=Promise.resolve();this.resumeTail=Promise.resolve();this.pendingCount=0;this.stopping=false;this.cached=null;
  }
  async initialize(){this.cached=await this.backend.settings();return this;}
  settings(){if(!this.cached)throw Error('Storage settings are not ready.');return copy(this.cached);}
  queue(kind,fn){
    if(this.stopping)return Promise.reject(Error('Storage is shutting down.'));
    if(this.pendingCount>=32)return Promise.reject(Error('Storage queue is full. Wait for pending saves.'));
    this.pendingCount++;
    const job=this[kind].catch(()=>{}).then(fn).finally(()=>this.pendingCount--);this[kind]=job;return job;
  }
  updateSettings(value){const patch=settingsPatch(value),id=randomUUID();return this.queue('settingsTail',async()=>{const next=await this.backend.saveSettings(patch,id);this.cached=copy(next);return copy(next);});}
  refreshSettings(){return this.queue('settingsTail',async()=>{this.cached=await this.backend.settings();return this.settings();});}
  resume(){return this.queue('resumeTail',async()=>{const ledger=this.resources?await this.resources.read():null;return copy(ledger?.checkpoint||await this.backend.resume());});}
  saveResume(value){
    if(!validResume(value))return Promise.resolve(false);
    let snapshot;try{snapshot=JSON.parse(JSON.stringify(value));}catch{return Promise.resolve(false);}if(!validResume(snapshot))return Promise.resolve(false);const id=randomUUID();
    return this.queue('resumeTail',()=>snapshot.race.resources&&this.resources?this.resources.save(snapshot):this.backend.saveResume(snapshot,id));
  }
  clearResume(){const id=randomUUID();return this.queue('resumeTail',async()=>{if(this.resources)await this.resources.clear();return this.backend.clearResume(id);});}
  pending(){return this.pendingCount>0||this.backend.pending()||!!this.resources?.pending;}
  async idle(){await Promise.all([this.settingsTail.catch(()=>{}),this.resumeTail.catch(()=>{}),this.resources?.idle()]);await this.backend.idle();}
  shutdown(){this.stopping=true;return this.closing ||= (async()=>{await this.idle();await this.backend.close?.();})();}
  diagnostics(){return this.backend.diagnostics();}
}
module.exports={StorageLifecycle,JsonLifecycleBackend,SqliteLifecycleBackend,validResume};
