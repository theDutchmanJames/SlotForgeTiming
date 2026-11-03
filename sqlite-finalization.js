'use strict';
// Finalization identities outlive deleted results so stale recovery cannot re-create them.
function upgrade(s){s.transaction(()=>{
  const version=s.statement("SELECT value FROM info WHERE key='workingFormat'").get().value;
  if(['5','6'].includes(version)){s.statement('SELECT saveKey,sessionId FROM session_finalizations LIMIT 0').all();return;}
  if(version!=='4')throw Error('Unsupported finalization format.');
  s.db.exec('CREATE TABLE session_finalizations(saveKey TEXT PRIMARY KEY,sessionId TEXT NOT NULL)');
  for(const row of s.statement("SELECT id,json FROM fields WHERE entity='sessions' AND path='[\"saveKey\"]'").all()){
    const key=JSON.parse(row.json);if(typeof key==='string'&&key)s.statement('INSERT INTO session_finalizations VALUES(?,?)').run(key,row.id);
  }
  s.statement("UPDATE info SET value='5' WHERE key='workingFormat'").run();
  // Opening an older working format has no command context yet. Track internal
  // revision updates while reconciling, without manufacturing a user command.
  const changed=s.changed;s.changed=new Map();
  try{reconcile(s);}finally{s.changed=changed;}
});}
function saved(s,key){return typeof key==='string'?s.statement('SELECT sessionId FROM session_finalizations WHERE saveKey=?').get(key):null;}
function tokenSettings(s,all){
  if(!all||typeof all!=='object'||Array.isArray(all))return all;
  const next=structuredClone(all);
  for(const [id,run] of Object.entries(next)){
    if(!run?.storageRunId||!Array.isArray(run.data?.closed))continue;
    run.data.closed=run.data.closed.filter(stint=>!saved(s,run.storageRunId+':'+stint.id));
    if(!run.data.closed.length&&Array.isArray(run.data.lanes)&&run.data.lanes.every(l=>!l?.stint))delete next[id];
  }
  return next;
}
function complete(s,key,id){
  if(typeof key!=='string'||!key||key.length>200)throw Error('Invalid finalization identity.');
  s.statement('INSERT INTO session_finalizations VALUES(?,?)').run(key,id);
  reconcile(s);
  s.checkpoint('finalization-reconciled');
}
function reconcile(s){
  const resume=s.field('@meta','raceResume',['race','storageRunId']);
  if(saved(s,resume.value))s.replace('@meta','raceResume',null);
  const tokens=s.get('@meta','settings')?.value?.tokenSessions;
  if(tokens!==undefined){const next=tokenSettings(s,tokens);if(JSON.stringify(next)!==JSON.stringify(tokens))require('./sqlite-records').setPath(s,'@meta','settings',['tokenSessions'],next);}
}
module.exports={upgrade,saved,tokenSettings,complete};
