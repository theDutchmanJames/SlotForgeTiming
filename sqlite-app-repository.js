'use strict';
const {randomUUID}=require('node:crypto');
const {SqliteCompatibilityReads}=require('./compatibility-read');
const Repository=require('./sqlite-repository');
const json=value=>JSON.parse(JSON.stringify(value));
// Renderer-facing results with the worker's typed mutation/receipt contracts.
class SqliteAppRepository extends SqliteCompatibilityReads {
  constructor(client,{resources,afterSession=async()=>{}}={}){super(client);this.commands=new Repository(client);this.resources=resources;this.afterSession=afterSession;this.tail=Promise.resolve();this.pending=0;this.stopping=false;}
  queue(fn){
    if(this.stopping)return Promise.reject(Error('Storage is shutting down.'));
    if(this.pending>=32)return Promise.reject(Error('Storage queue is full.'));
    this.pending++;const job=this.tail.catch(()=>{}).then(fn).finally(()=>this.pending--);this.tail=job;return job;
  }
  idle(){return this.tail.catch(()=>{});}
  stop(){this.stopping=true;}
  version(entity,id){return this.client.revision(entity,id);}
  editorScope(){return this.client.editorScope();}
  editorSave(request){const input=json(request);return this.queue(async()=>{
    let result;
    try { result=await this.client.command({...input,type:'editorSave'}); }
    catch(error){
      if(error.code==='EDITOR_GENERATION_CHANGED')return {ok:false,error:error.message,code:error.code,retain:true};
      // Only a readable, absent receipt proves this attempt did not commit.
      // Worker loss, timeout and lost acknowledgements retain the caller's ID.
      if(!await this.client.receipt(input.id))return {ok:false,error:String(error.message||error)};
      throw error;
    }
    const value=['add','update'].includes(input.operation)?await this.get(input.args[0],result.recordId):result.field;
    return {ok:true,value};
  });}
  add(entity,value){const item=json(value),commandId=randomUUID();return this.queue(async()=>{const result=await this.commands.add(entity,item,{commandId});return this.get(entity,result.recordId);});}
  update(entity,id,value){const patch=json(value),commandId=randomUUID();return this.queue(async()=>{
    const expectedRevision=await this.version(entity,id);
    if(entity==='sessions'){
      if(Object.keys(patch).length!==1||!Object.hasOwn(patch,'champ'))throw Error('Only championship awards may be edited on a saved session.');
      await this.commands.awards([{sessionId:id,champ:patch.champ,expectedRevision}],{commandId});
    }else if(entity==='laps')await this.commands.execute(commandId,'setLapEligibility',{lapId:id,flags:patch,expectedRevision});
    else await this.commands.update(entity,id,patch,{commandId,expectedRevision});
    return this.get(entity,id);
  });}
  remove(entity,id){const commandId=randomUUID();return this.queue(async()=>{const before=await this.client.snapshot(entity,id);if(!before.record)return;await this.commands.remove(entity,id,{commandId,expectedRevision:before.revision});});}
  removeSession(id){return this.remove('sessions',id);}
  affectedSharedSessions(entity,id){return this.client.request('affectedSharedSessions',entity,id);}
  attachSharedHistory(input){return this.queue(()=>this.client.command({...json(input),id:randomUUID(),type:'attachSharedHistory'}));}
  importSharedPrepared(input){return this.queue(()=>this.client.command({...json(input),type:'importSharedPrepared'}));}
  saveSession(value,rows){const session=json(value),laps=json(rows),commandId=randomUUID();return this.queue(async()=>{
    if(session.resourceRunId&&!this.resources)throw Error('Resource storage is not ready.');
    const id=session.resourceRunId?await this.resources.saveSession(session,laps):(await this.commands.saveSession(session,laps,{commandId})).sessionId;
    await this.afterSession();return id;
  });}
  addCustomField(entity,value){const field=json(value),commandId=randomUUID();return this.queue(async()=>(await this.commands.addCustomField(entity,field,{commandId,expectedRevision:await this.version('@meta','customFields')})).field);}
  setCustomFieldGroup(entity,id,group){const commandId=randomUUID();return this.queue(async()=>(await this.commands.setCustomFieldGroup(entity,id,group,{commandId,expectedRevision:await this.version('@meta','customFields')})).field);}
  removeCustomField(entity,id){const commandId=randomUUID();return this.queue(async()=>{await this.commands.removeCustomField(entity,id,{commandId,expectedRevision:await this.version('@meta','customFields')});});}
  localCars(){return this.collect('slotcars','cars');}
}
for(const name of ['homeStatistics','homeSessions','raceSeason','raceCharts','raceInputs','editorRead','referencePage','referenceDetails','historyReferences','historyPage','historySession','carStatistics','catalogue','cataloguePicture'])SqliteAppRepository.prototype[name]=function(...args){return this.client[name](...args);};
module.exports=SqliteAppRepository;
