// Ledger and recovery snapshot are one database commit. Replayed transactions are not spent again.
const Resources=require('./renderer/resources');
class ResourceStore{
  constructor(db){this.db=db;this.tail=Promise.resolve();this.pending=0;}
  queue(fn){this.pending++;const p=this.tail.catch(()=>{}).then(fn).finally(()=>{this.pending--;});this.tail=p;return p;}
  async idle(){await this.tail.catch(()=>{});}
  ledger(){return this.db.data.resourceLedger||{v:1,accounts:{},runs:{},history:[],checkpoint:null};}
  async write(next){const old=this.db.data.resourceLedger;this.db.data.resourceLedger=next;try{await this.db.commit();}catch(e){this.db.data.resourceLedger=old;throw e;}}
  begin(profileId,context){return this.queue(async()=>{if(this.ledger().checkpoint)throw Error('Resume or discard the unfinished resource race first.');const p=this.db.list('resourcesystems').find(x=>x.id===profileId);return Resources.prepare(p,context,this.ledger());});}
  read(){return this.queue(()=>JSON.parse(JSON.stringify(this.ledger())));}
  save(snap){return this.queue(async()=>{
    const state=snap?.race?.resources;if(!state||state.v!==1||!Array.isArray(state.events))throw Error('Invalid resource checkpoint.');
    const next=JSON.parse(JSON.stringify(this.ledger())),run=next.runs[state.runId]||{count:0,closed:false};
    if(run.closed)throw Error('This resource event has already ended.');
    if(next.checkpoint&&next.checkpoint.race.resources.runId!==state.runId)throw Error('Another resource event is awaiting recovery.');
    if(state.events.length<run.count)throw Error('Resource recovery would lose recorded spending.');
    // Initial allocations are durable even when nothing has been spent yet.
    for(const [key,src] of Object.entries(state.accounts||{})){
      if(src.profileId!==state.profile.id||src.key!==key)throw Error('Invalid resource account.');
      if(!next.accounts[key])next.accounts[key]={...JSON.parse(JSON.stringify(src)),balance:{...src.initial}};
    }
    for(let i=run.count;i<state.events.length;i++){
      const e=state.events[i],src=state.accounts[e.account];
      if(e.id!==state.runId+':'+(i+1)||!src||src.profileId!==state.profile.id)throw Error('Invalid resource transaction.');
      let a=next.accounts[e.account];if(!a)a=next.accounts[e.account]={...JSON.parse(JSON.stringify(src)),balance:{...src.initial}};
      for(const[k,n]of Object.entries(e.delta)){if(!Number.isInteger(n)||Math.abs(n)>100000||(a.balance[k]||0)+n<0)throw Error('Resource balance conflict. Reload the saved race before continuing.');a.balance[k]=(a.balance[k]||0)+n;}
      next.history.push({...e,runId:state.runId,date:new Date().toISOString(),ownerName:a.name,profileId:a.profileId});
    }
    // A checkpoint may be saved again without new spending. The engine balance must still agree.
    for(const [key,b] of Object.entries(state.accounts)){const a=next.accounts[key];for(const k of new Set([...Object.keys(a.balance),...Object.keys(b.balance)]))if(a.balance[k]!==b.balance[k])throw Error('Resource balances do not match the ledger.');}
    next.runs[state.runId]={count:state.events.length,closed:false};next.checkpoint=snap;await this.write(next);return true;
  });}
  saveSession(session,laps){return this.queue(async()=>{
    const old=this.db.list('sessions').find(s=>s.resourceRunId===session.resourceRunId);
    if(old){await this.db.saved();return old.id;}
    return this.db.saveSessionAsync(session,laps);
  });}
  clear(){return this.queue(async()=>{const next=JSON.parse(JSON.stringify(this.ledger()));const id=next.checkpoint?.race?.resources?.runId;if(id){next.runs[id].closed=true;next.checkpoint=null;await this.write(next);}return true;});}
}
module.exports=ResourceStore;
