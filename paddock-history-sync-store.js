'use strict';
const H=require('./paddock-history');
const STATE='paddockHistorySync',STAGE='paddockHistoryStage';
const stateId=db=>H.key(db,'sync-state');
const base=db=>({id:stateId(db),databaseId:db,version:0,cursor:null,work:null,updatedAt:''});
const sessionRoute=route=>/^\/v1\/(?:scalable\/results|shared-history\/sessions)\/([A-Za-z0-9_-]{1,100})\/([A-Za-z0-9_-]{1,100})(?:\?|\/laps\/)/.exec(route||'');
function tracked(rows){const map=new Map();for(const row of rows){const m=sessionRoute(row.route);if(m)map.set(JSON.stringify([m[1],m[2]]),{sourceId:m[1],sessionId:m[2],...(row.route.startsWith('/v1/shared-history/')?{protocol:'shared'}:{})});}return [...map.values()];}
function apply(a,input){
 const {databaseId,expected,next,action}=input,current=a.get(STATE,stateId(databaseId))||base(databaseId);
 if(current.version!==expected)throw Error('History synchronisation state changed. Retry from the saved checkpoint.');
 if(!next||next.databaseId!==databaseId||next.id!==stateId(databaseId)||!['begin','stage','publish','finish','discard'].includes(action))throw Error('Invalid history synchronisation update.');
 if(a.connection()?.databaseId!==databaseId)throw Error('History connection changed.');
 if(action!=='finish'&&next.cursor!==current.cursor)throw Error('Only a completed batch may advance the history cursor.');
 if(action==='begin'&&(current.work||!next.work||next.work.next!==0||next.work.active||!Array.isArray(next.work.entries)))throw Error('Invalid history batch start.');
 if(action==='discard'&&next.work!==null)throw Error('Invalid history discard.');
 if(['stage','publish'].includes(action)&&(!current.work||next.work?.id!==current.work.id||next.work.target!==current.work.target||JSON.stringify(next.work.entries)!==JSON.stringify(current.work.entries)))throw Error('History batch identity changed.');
 const eraseWhere=(table,test)=>{for(const row of a.rows(table,databaseId))if(test(row))a.erase(table,row.id);};
 if(action==='begin'||action==='discard')eraseWhere(STAGE,()=>true);
 if(action==='stage'){
  const row=input.row,item=current.work.entries[current.work.next],active=next.work.active;
  if(!item||next.work.next!==current.work.next||!active||active.sourceId!==item.sourceId||active.sessionId!==item.sessionId)throw Error('Staged session identity changed.');
  const route=row?.route,kind=route?.includes('/laps/')?'laps':'head',u=new URL('http://localhost'+route);
  const request={kind,...active,participantId:u.pathname.split('/').at(-1),offset:Number(u.searchParams.get('offset')||0)};
  if(route!==H.route(request))throw Error('Invalid staged history route.');
  H.validate(row?.value,request,databaseId);
  if(!row||row.databaseId!==databaseId||row.stageId!==next.work?.active?.id||row.id!==H.key(databaseId,row.stageId+row.route)||Buffer.byteLength(JSON.stringify(row))>9*1024*1024)throw Error('Invalid staged history page.');
  a.put(STAGE,row);
 }
 if(action==='publish'){
  const item=current.work?.entries[current.work.next];
  if(next.work.next!==current.work.next+1||next.work.active)throw Error('Invalid completed history item.');
  if(!item)throw Error('No history item is ready to publish.');
  const same=row=>{const m=sessionRoute(row.route);return m&&m[1]===item.sourceId&&m[2]===item.sessionId;};
  const stages=a.rows(STAGE,databaseId).filter(r=>r.stageId===current.work.active?.id);
  if(!input.removed){
   const active=current.work.active;
   if(!active||active.participant!==active.counts.length)throw Error('Staged history is incomplete.');
   const expected=new Set([H.route({kind:'head',...active})]);
   for(const count of active.counts){let offset=0,ended=false;for(const page of active.pages.filter(p=>p.participantId===count.participantId)){if(ended||page.offset!==offset)throw Error('Staged lap sequence is incomplete.');expected.add(H.route({kind:'laps',...active,participantId:count.participantId,offset}));ended=page.nextOffset===null;offset=page.nextOffset;}if(!ended)throw Error('Staged lap sequence is incomplete.');}
   if(stages.length!==expected.size||stages.some(r=>!expected.has(r.route)))throw Error('Staged history pages are missing.');
  }else if(current.work.active)throw Error('Cannot remove a partially staged session.');
  eraseWhere(H.CACHE,same);
  for(const item of stages){const row=a.get(STAGE,item.id),copy={id:H.key(databaseId,row.route),databaseId,route:row.route,value:row.value,checkedAt:row.checkedAt,complete:true};a.put(H.CACHE,copy);a.erase(STAGE,item.id);}
 }
 if(action==='finish'){
  if(current.work?.next!==current.work?.entries.length||next.cursor!==current.work.target||next.work!==null)throw Error('History cursor cannot advance before cache work completes.');
  const row=input.row;if(!row||row.databaseId!==databaseId||!['/v1/scalable/results','/v1/shared-history/sessions?limit=50'].includes(row.route)||row.id!==H.key(databaseId,row.route))throw Error('Missing history listing.');
  H.validate(row.value,{kind:'list',...(row.route.startsWith('/v1/shared-history/')?{protocol:'shared'}:{})},databaseId);
  eraseWhere(H.CACHE,r=>!sessionRoute(r.route));a.put(H.CACHE,row);
 }
 const saved={...next,version:current.version+1,updatedAt:new Date().toISOString()};a.put(STATE,saved);return saved;
}
function sqlAdapter(s){const C=require('./sqlite-catalogue');return {
 connection:()=>C.read(s,'@meta','paddock',['connection']),field:(table,id,path)=>C.read(s,table,id,path),get:(table,id)=>s.get(table,id,true)?.value||null,
 rows:(table,db)=>s.statement(`SELECT d.id,r.json route,j.json stageId FROM fields d
  LEFT JOIN fields r ON r.entity=d.entity AND r.id=d.id AND r.path='["route"]'
  LEFT JOIN fields j ON j.entity=d.entity AND j.id=d.id AND j.path='["stageId"]'
  WHERE d.entity=? AND d.path='["databaseId"]' AND d.json=?`).all(table,JSON.stringify(db)).map(r=>({id:r.id,route:r.route?JSON.parse(r.route):undefined,stageId:r.stageId?JSON.parse(r.stageId):undefined})),
 put:(table,row)=>s.statement('SELECT 1 FROM records WHERE entity=? AND id=?').get(table,row.id)?s.replace(table,row.id,row):s.insert(table,row),erase:(table,id)=>s.erase(table,id)
};}
function read(a,o){if(o.kind==='hint'){const id=stateId(o.databaseId);return {cursor:a.field(STATE,id,['cursor'])||null,pending:!!a.field(STATE,id,['work','id'])||!!a.field(STATE,id,['more'])};}if(o.kind==='state')return a.get(STATE,stateId(o.databaseId))||base(o.databaseId);if(o.kind==='tracked')return tracked(a.rows(H.CACHE,o.databaseId));if(o.kind==='stage')return a.get(STAGE,o.id);throw Error('Invalid history synchronisation read.');}
module.exports={STATE,STAGE,base,tracked,sessionRoute,apply,sqlAdapter,read};
