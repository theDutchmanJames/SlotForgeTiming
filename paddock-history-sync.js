'use strict';
const {randomUUID}=require('node:crypto'),H=require('./paddock-history');
const ROOT='/v1/scalable',ID=/^[A-Za-z0-9_-]{1,100}$/,CURSOR=/^[A-Za-z0-9_-]{1,512}$/;
function check(ok){if(!ok)throw Object.assign(Error('Invalid history change feed. The saved cursor was not advanced.'),{code:'HISTORY_INVALID'});}
function changes(v,db,from){
 check(v?.version===1&&v.databaseId===db&&v.kind==='results'&&typeof v.cursor==='string'&&CURSOR.test(v.cursor)&&typeof v.more==='boolean'&&typeof v.resetRequired==='boolean'&&Array.isArray(v.entries)&&v.entries.length<=512);
 check((!v.more&&!v.entries.length)||v.cursor!==from);const seen=new Map();
 for(const e of v.entries){check(e&&typeof e.sourceId==='string'&&typeof e.sessionId==='string'&&ID.test(e.sourceId)&&ID.test(e.sessionId)&&['invalidate','remove'].includes(e.operation));seen.set(JSON.stringify([e.sourceId,e.sessionId]),e);}
 check(!v.resetRequired||(!v.more&&!v.entries.length));return {...v,entries:[...seen.values()]};
}
const pageRoute=(a,participantId,offset)=>H.route({kind:'laps',protocol:a.protocol,sourceId:a.sourceId,sessionId:a.sessionId,token:a.token,participantId,offset});
module.exports={changes,methods:{
 async historySyncState(){const c=(await this.connection()).connection;return c?.mode==='local'?this.storage.historySyncRead({kind:'state',databaseId:c.databaseId}):null;},
 // Caller holds the existing Paddock exclusive gate. Four HTTP requests per
 // turn, with each staged page checkpointed; no unbounded startup lap download.
 async syncHistory({budget=4}={}){
  budget=Math.max(1,Math.min(4,Number.isInteger(budget)?budget:4));this.historySyncPending=false;
  const c=(await this.connection()).connection;if(c?.mode!=='local'||!c.results||!this.code||!this.scalable||this.stopped||this.quiescing||this.isRacing?.())return;
  let state=await this.storage.historySyncRead({kind:'state',databaseId:c.databaseId});
  const save=async(action,next,extra={})=>{state=await this.storage.historySyncChange({action,databaseId:c.databaseId,expected:state.version,next,...extra});};
  const get=async route=>{if(budget<=0)throw Error('History request budget exhausted.');budget--;this.active();if(this.quiescing||this.isRacing?.())throw Error('History refresh paused during racing.');return this.call(route,undefined,8*1024*1024);};
  const tracked=()=>this.storage.historySyncRead({kind:'tracked',databaseId:c.databaseId});
  const startReset=async()=>{
   const status=await get(ROOT+'/status');check(status?.version===1&&status.databaseId===c.databaseId&&typeof status.cursor==='string'&&CURSOR.test(status.cursor));
   const entries=(await tracked()).map(e=>({sourceId:e.sourceId,sessionId:e.sessionId,...(c.historyGuard?.reads?{protocol:'shared'}:{}),operation:'invalidate'}));check(entries.length<=100000);
   await save('begin',{...state,work:{id:randomUUID(),target:status.cursor,entries,next:0,active:null,reset:true}});
  };
  try{
   if(state.work&&!c.historyGuard?.reads&&state.work.entries.some(e=>e.protocol==='shared'))await save('discard',{...state,work:null});
   if(!state.work){
    if(!state.cursor)await startReset();
    else {
     let delta;try{delta=changes(await get(ROOT+'/changes?kind=results&cursor='+encodeURIComponent(state.cursor)),c.databaseId,state.cursor);}catch(e){if(e.code!=='INVALID_CURSOR')throw e;delta={resetRequired:true};}
     if(delta.resetRequired){if(!budget)return;await startReset();}
     else if(delta.cursor!==state.cursor||delta.entries.length){
      const known=new Set((delta.entries.length?await tracked():[]).map(e=>JSON.stringify([e.sourceId,e.sessionId])));
      await save('begin',{...state,work:{id:randomUUID(),target:delta.cursor,more:delta.more,entries:delta.entries.filter(e=>known.has(JSON.stringify([e.sourceId,e.sessionId]))).map(e=>({...e,...(c.historyGuard?.reads?{protocol:'shared'}:{})})),next:0,active:null,reset:false}});
     }else{this.historySyncError='';return;}
    }
   }
   let steps=0;
   while(steps++<8&&state.work&&budget>0&&!this.stopped&&!this.quiescing&&!this.isRacing?.()){
    const w=state.work,item=w.entries[w.next];
    if(!item){
     const options={kind:'list',...(c.historyGuard?.reads?{protocol:'shared'}:{})},route=H.route(options);const value=H.validate(await get(route),options,c.databaseId);
     await save('finish',{...state,cursor:w.target,work:null,more:!!w.more},{row:H.cacheRow(c.databaseId,route,value)});break;
    }
    const advance=()=>({...state,work:{...state.work,next:state.work.next+1,active:null}});
    if(item.operation==='remove'){await save('publish',advance(),{removed:true});continue;}
    let a=w.active;
    if(!a){
     let head;
     try{head=await get((item.protocol==='shared'?'/v1/shared-history/sessions':ROOT+'/results')+'/'+item.sourceId+'/'+item.sessionId);}catch(e){if(e.code==='SESSION_NOT_FOUND'){await save('publish',advance(),{removed:true});continue;}throw e;}
     head=H.validate(head,{kind:'head',...item,token:head.resultToken},c.databaseId);
     a={id:randomUUID(),...(item.protocol?{protocol:item.protocol}:{}),sourceId:item.sourceId,sessionId:item.sessionId,token:head.resultToken,format:head.body?.format||'timing-v1',counts:head.payload.state==='active'?head.lapCounts:[],participant:0,offset:0,pages:[],bytes:Buffer.byteLength(JSON.stringify(head))};
     const route=H.route({kind:'head',...item,token:a.token}),row={...H.cacheRow(c.databaseId,route,head),stageId:a.id};row.id=H.key(c.databaseId,a.id+route);
     await save('stage',{...state,work:{...w,active:a}},{row});continue;
    }
    const count=a.counts[a.participant];
    if(count){
     const route=pageRoute(a,count.participantId,a.offset);
     const page=H.validate(await get(route),{kind:'laps',...a,participantId:count.participantId,offset:a.offset},c.databaseId);
     check(page.total===count.count&&(page.format||'timing-v1')===(a.format||'timing-v1')); const bytes=a.bytes+Buffer.byteLength(JSON.stringify(page));check(bytes<=64*1024*1024);
     const next={...a,bytes,pages:[...a.pages,{participantId:count.participantId,offset:a.offset,nextOffset:page.nextOffset}],participant:page.nextOffset===null?a.participant+1:a.participant,offset:page.nextOffset??0};
     const row={...H.cacheRow(c.databaseId,route,page),stageId:a.id};row.id=H.key(c.databaseId,a.id+route);
     await save('stage',{...state,work:{...w,active:next}},{row});continue;
    }
    // Final token check before one transaction replaces the head AND all laps.
    H.validate(await get(a.protocol==='shared'?require('./paddock-history-read-v1').route({kind:'head',...a},true):H.route({kind:'head',...a})),{kind:'head',...a},c.databaseId);
    await save('publish',advance());
   }
   this.historySyncError='';
  }catch(e){
   this.historySyncError=String(e.message||e).slice(0,500);
   // A correction or restoration during staging invalidates only the unfinished
   // job. Old visible cache and cursor survive; replay/reset discovers the truth.
   if(['RECOVERY_CHANGED','RESULT_CHANGED','SESSION_WITHDRAWN','SESSION_NOT_FOUND','SNAPSHOT_CHANGED'].includes(e.code)&&state.work)await save('discard',{...state,work:null});
   if(['UNAUTHENTICATED','INSTANCE_CHANGED','DATABASE_MISMATCH'].includes(e.code))throw e;
  }finally{this.historySyncPending=!!state.work||!!state.more;}
 }
}};
