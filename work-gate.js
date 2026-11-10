'use strict';
// Track the entire accepted operation, including awaits before it reaches storage.
class WorkGate {
  constructor(){this.closing=false;this.jobs=new Set();}
  run(fn){
    if(this.closing)return Promise.reject(Object.assign(Error('Timing is closing. Reopen it before trying again.'),{code:'APP_CLOSING'}));
    const job=Promise.resolve().then(fn);this.jobs.add(job);
    job.then(()=>this.jobs.delete(job),()=>this.jobs.delete(job));return job;
  }
  stop(){this.closing=true;}
  async idle(){while(this.jobs.size)await Promise.allSettled([...this.jobs]);}
}
// A failed drain stays closed to new work, but may be retried. Never force a
// process exit on a timer while an accepted operation is still running.
class Shutdown {
  constructor({gate,quiesce,drain}){Object.assign(this,{gate,quiesce,drain});this.ready=false;this.job=null;}
  run(){
    if(this.ready)return Promise.resolve();
    if(this.job)return this.job;
    this.gate.stop();
    this.job=Promise.resolve().then(()=>this.quiesce()).then(()=>this.drain()).then(()=>{this.ready=true;}).finally(()=>{this.job=null;});
    return this.job;
  }
}
module.exports={WorkGate,Shutdown};
