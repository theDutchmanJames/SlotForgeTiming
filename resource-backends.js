'use strict';
const {randomUUID,createHash}=require('node:crypto'),Resources=require('./renderer/resources');
const copy=x=>structuredClone(x);
class JsonResources {
 constructor(db){this.db=db;}
 ledger(){return this.db.data.resourceLedger||{v:1,accounts:{},runs:{},history:[],checkpoint:null};}
 revision(){return createHash('sha256').update(JSON.stringify(this.ledger())).digest('hex');}
 async read(){return {ledger:copy(this.ledger()),revision:this.revision()};}
 async begin(id,context){const {ledger,revision}=await this.read();if(ledger.checkpoint)throw Error('Resume or discard the unfinished resource race first.');return {state:Resources.prepare(this.db.list('resourcesystems').find(p=>p.id===id),context,ledger),revision};}
 async write(next,expectedRevision){if(expectedRevision!==this.revision())throw Error('Resource ledger changed. Reload the saved race before continuing.');const old=this.db.data.resourceLedger;this.db.data.resourceLedger=next;try{await this.db.commit();}catch(e){this.db.data.resourceLedger=old;throw e;}}
 async checkpoint(snapshot,{expectedRevision}){await this.write(require('./resource-checkpoint').applyCheckpoint(this.ledger(),snapshot),expectedRevision);}
 async clear(runId,{expectedRevision}){const next=copy(this.ledger());if(next.checkpoint?.race?.resources?.runId!==runId)throw Error('Resource checkpoint belongs to another run or is already closed.');const run=Object.hasOwn(next.runs,runId)&&next.runs[runId];if(next.v!==1||!run||typeof run!=='object'||!Number.isSafeInteger(run.count)||run.count<0)throw Error('Invalid resource run state.');run.closed=true;next.checkpoint=null;await this.write(next,expectedRevision);}
 async finalize(session,laps){const old=this.db.list('sessions').find(s=>s.resourceRunId===session.resourceRunId);if(old){await this.db.saved();return old.id;}return this.db.saveSessionAsync(session,laps);}
}
class SqliteResources {
 constructor(repository){this.repo=repository;}
 read(){return this.repo.resources();}
 begin(id,context){return this.repo.beginResources(id,context);}
 checkpoint(snapshot,options){return this.repo.checkpoint(snapshot,options);}
 clear(id,options){return this.repo.clearResources(id,options);}
 async finalize(session,laps,{expectedRevision,commandId}){return (await this.repo.saveSession(session,laps,{commandId,expectedResourceRevision:expectedRevision})).sessionId;}
}
module.exports={JsonResources,SqliteResources,commandId:randomUUID};
