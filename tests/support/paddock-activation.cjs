'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const Database=require('../../db'),Client=require('../../sqlite-client'),Records=require('../../paddockrecords'),R=require('../../paddock-rich-delivery'),H=require('../../paddock-history-write');
const {evidence}=require('../../tools/qa/rich-mapper-fixtures.cjs');
const [root,flag]=process.argv.slice(2),enabled=flag==='true';
assert(root&&path.dirname(path.resolve(root))===path.resolve(require('node:os').tmpdir())&&path.basename(root).startsWith('timing-activation-'),'Only a disposable activation profile is allowed');
assert(['false','true'].includes(flag));
const capability={version:1,features:{guardedWrites:true},formats:['timing-v1','history-v1'],writeScope:'trusted-local',operations:H.ROOT+'/operations',receipt:H.ROOT+'/operations/{installationId}/{operationId}',recovery:H.ROOT+'/status'};
async function main(){
 assert.equal(require('../../paddock-rich-gate').enabled(),enabled);
 for(const kind of ['json','sqlite'])for(const mode of ['local','network'])for(const hostEnabled of [false,true]){
  const dir=path.join(root,`${kind}-${mode}-${hostEnabled}`);fs.mkdirSync(dir);
  const file=path.join(dir,'source.json');let db=new Database(file),client;
  db.data.paddock={sourceId:'timing-test',withdrawals:[],connection:{mode,databaseId:'paddock-demo',...(mode==='local'?{historyGuard:{version:1,databaseId:'paddock-demo',recoveryId:'original-generation',richWrites:hostEnabled}}:{})}};
  db.saveNow();const original=fs.readFileSync(file),work=path.join(dir,'work');
  try{
   if(kind==='sqlite'){require('../../sqlite-migration').migrateCopy({source:file,destination:path.join(dir,'copy')});require('../../sqlite-working').forkCopy(path.join(dir,'copy'),work);client=new Client();await client.openWorking(work);}
   const e=evidence(),id=client?(await client.command({id:randomUUID(),type:'finalizeSession',session:e.session,laps:e.laps})).sessionId:await db.saveSessionAsync(e.session,e.laps);
   async function snapshot(){return client?(await client.snapshot('sessions',id,true)).record.value.paddockDelivery:db.data.sessions.find(s=>s.id===id).paddockDelivery;}
   const first=await snapshot(),rich=enabled&&mode==='local'&&hostEnabled;
   assert.equal(R.isRich(first.payload),rich,`${kind}/${mode}/${hostEnabled}: ${first.error}`);assert.equal(first.status,'pending');
   if(client){await client.close();client=new Client();await client.openWorking(work);}else{await db.writesIdle();db=new Database(file);}
   assert.deepEqual(await snapshot(),first,'reopening does not remap queued results');
   // Activating or downgrading never changes an existing identity's format.
   const selection={paddock:{connection:{mode:'local',historyGuard:{richWrites:true}}}};
   for(const status of ['pending','sent','attention']){
    assert.equal(R.select(selection,{payload:first.payload,status}),rich);
    assert.equal(R.select(selection,{previousPayload:first.payload,status}),rich);
   }
   assert.equal(R.select(selection,{status:'attention'}),false);
   if(rich){
    let calls=0;await assert.rejects(H.send(async()=>{calls++;},first,()=>false,{capability:{...capability,formats:['timing-v1']}}),{code:'HISTORY_REVIEW_REQUIRED'});assert.equal(calls,0,'host downgrade never falls back to legacy');
    R.preflight(first);assert.equal(first.guard.operations[0].recoveryId,'original-generation');
    // A rollback to a closed release must preserve bytes, not resend legacy.
    const gatePath=require.resolve('../../paddock-rich-gate'),saved=require.cache[gatePath].exports;
    require.cache[gatePath].exports={enabled:()=>false,assertEnabled:()=>{throw Object.assign(Error('Closed'),{code:'HISTORY_REVIEW_REQUIRED'});}};
    try{await assert.rejects(H.send(async()=>{calls++;},first,()=>false,{capability}),{code:'HISTORY_REVIEW_REQUIRED'});assert.equal(calls,0);}finally{require.cache[gatePath].exports=saved;}
    assert.deepEqual(await snapshot(),first);
   }
  }finally{await client?.close();await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(file),original);}
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
