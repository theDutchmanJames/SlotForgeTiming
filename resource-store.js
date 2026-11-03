// Serialize resource recovery through an explicit asynchronous storage boundary.
const {JsonResources,commandId}=require('./resource-backends');
class ResourceStore{
 constructor(db,{backend}={}){this.backend=backend||new JsonResources(db);this.tail=Promise.resolve();this.pending=0;}
 queue(fn){this.pending++;const p=this.tail.catch(()=>{}).then(fn).finally(()=>{this.pending--;});this.tail=p;return p;}
 async idle(){await this.tail.catch(()=>{});}
 begin(profileId,context){context=structuredClone(context);return this.queue(async()=>(await this.backend.begin(profileId,context)).state);}
 read(){return this.queue(async()=>(await this.backend.read()).ledger);}
 save(snap){snap=structuredClone(snap);const id=commandId();return this.queue(async()=>{const {revision}=await this.backend.read();await this.backend.checkpoint(snap,{commandId:id,expectedRevision:revision});return true;});}
 saveSession(session,laps){session=structuredClone(session);laps=structuredClone(laps);const id=commandId();return this.queue(async()=>{const {revision}=await this.backend.read();return this.backend.finalize(session,laps,{commandId:id,expectedRevision:revision});});}
 clear(){const id=commandId();return this.queue(async()=>{const {ledger,revision}=await this.backend.read(),runId=ledger.checkpoint?.race?.resources?.runId;if(runId)await this.backend.clear(runId,{commandId:id,expectedRevision:revision});return true;});}
}
module.exports=ResourceStore;
