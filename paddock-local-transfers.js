'use strict';
// Durable, reviewed one-car envelopes. Small envelopes make uncertain retries and
// cancellation independent, and never require resplitting an already-sent batch.
const {randomUUID}=require('node:crypto');
const {hash,validateProfile}=require('./paddock');
const ROOT='localLibraryTransfers',ID=/^[A-Za-z0-9_-]{1,100}$/;
const validId=value=>typeof value==='string'&&ID.test(value);
const FIELDS=['id','name','brand','manufacturer','model','scale','reference','motor','gearing','weight','tyres','raceClass','picture'];
const terminal=new Set(['linked','rejected','cancelled']);
const carRevision=(a,car,version=a.revision(car.id))=>hash([car,a.className(car.raceClass),version]);
function carExport(car){
 const out={};for(const k of FIELDS)if(Object.hasOwn(car,k)&&car[k]!==null){if(!['string','number'].includes(typeof car[k]))throw Error('Unsupported car field: '+k);out[k]=car[k];}
 out.name=String(out.name||[car.brand,car.manufacturer,car.model].filter(Boolean).join(' ')||'Unnamed car');return out;
}
function receipt(value,request,previous,requestHash=hash(request)){
 const cars=request.export.items.slotcars;
 const bad=()=>{throw Object.assign(Error('Paddock transfer receipt does not match the saved request. No car was linked.'),{code:'LOCAL_RECEIPT_MISMATCH'});};
 if(!value||value.version!==1||value.databaseId!==request.databaseId||value.sourceId!==request.sourceId||value.transferId!==request.transferId||value.hash!==requestHash||!validId(value.submissionId)||!['pending','reviewed'].includes(value.status)||!Array.isArray(value.cars)||value.cars.length!==cars.length)bad();
 const items=new Set();value.cars.forEach((c,i)=>{
  const target=request.targets?.find(t=>t.timingCarId===cars[i].id),old=previous?.cars[i];
  if(!c||c.index!==i||c.timingCarId!==cars[i].id||!validId(c.itemId)||items.has(c.itemId)||!validId(c.paddockCarId)||c.action!==(target?'link':'create')||target&&c.paddockCarId!==target.paddockCarId||!['pending','approved','rejected','cancelled'].includes(c.status)||typeof c.present!=='boolean'||typeof c.archived!=='boolean')bad();
  if(c.decision!==(c.status==='approved'?'accept':['rejected','cancelled'].includes(c.status)?'reject':'pending'))bad();
  if(c.status==='approved'&&(!Number.isSafeInteger(c.carRevision)||c.carRevision<0||!Number.isFinite(Date.parse(c.reviewedAt))))bad();
  if(old&&(c.itemId!==old.itemId||c.paddockCarId!==old.paddockCarId||old.status!=='pending'&&c.status!==old.status)||previous&&value.submissionId!==previous.submissionId)bad();
  items.add(c.itemId);
 });
 if(value.status!==(value.cars.some(c=>c.status==='pending')?'pending':'reviewed'))bad();
 return structuredClone(value);
}
function local(a,databaseId){const c=a.connection();if(c?.mode!=='local'||c.databaseId!==databaseId)throw Error('Select this transfer’s original local Paddock library.');return c;}
function entry(a,id){if(!ID.test(id))throw Error('Invalid transfer ID.');const x=a.get(id);if(!x)throw Error('Transfer journal not found.');local(a,x.request.databaseId);return x;}
function summary(x){return {...x.summary};}
function writeSummary(a,x,patch){const next={...x.summary,...patch,updatedAt:new Date().toISOString()};a.part(x.request.transferId,'summary',next);return next;}
function create(a,{databaseId,selections}){
 local(a,databaseId);
 if(!Array.isArray(selections)||!selections.length||selections.length>25||new Set(selections.map(c=>c.localId)).size!==selections.length)throw Error('Choose 1–25 distinct Timing cars.');
 const existing=a.list(),active=existing.filter(s=>!terminal.has(s.state));if(active.length+selections.length>200)throw Error('Finish pending car reviews before sending more cars.');
 const targets=new Set(),created=[];
 for(const choice of selections){
  if(!choice||typeof choice.localId!=='string')throw Error('Invalid Timing car selection.');
  const car=a.car(choice.localId);if(!car||car.paddock)throw Error('Choose an unlinked local Timing car.');
  if(existing.some(s=>s.localId===car.id&&!['cancelled','rejected'].includes(s.state)))throw Error('This car already has a transfer. Resume its existing review.');
  if(choice.target){
   if(!ID.test(choice.target.carId)||!Number.isSafeInteger(choice.target.revision)||choice.target.revision<0)throw Error('Refresh the selected Paddock car before requesting a link.');
   if(targets.has(choice.target.carId)||a.linked(databaseId,choice.target.carId)||existing.some(s=>s.databaseId===databaseId&&s.targetId===choice.target.carId&&!['cancelled','rejected'].includes(s.state)))throw Error('This physical Paddock car already has a link or a pending transfer.');
   targets.add(choice.target.carId);
  }
  const transferId=randomUUID(),className=a.className(car.raceClass),request={version:1,databaseId,sourceId:a.sourceId(),transferId,export:{format:'slotforge-timing-export',fileVersion:1,exported:new Date().toISOString(),items:{slotcars:[carExport(car)],...(className?{raceclasses:[{id:car.raceClass,name:className}]}:{})}},...(choice.target?{targets:[{timingCarId:car.id,paddockCarId:choice.target.carId,expectedRevision:choice.target.revision}]}:{})};
  if(Buffer.byteLength(JSON.stringify(request))>8388608)throw Error('This car and its picture exceed Paddock’s 8 MiB transfer limit. Reduce the picture before creating a new transfer. Nothing was sent.');
  const identity={...request,export:{...request.export,items:{slotcars:[{id:car.id}]}}};
  const x={request,identity,recoveryId:a.connection()?.historyGuard?.recoveryId||null,requestHash:hash(request),localRevision:carRevision(a,car),versioned:a.revision(car.id)!==null,receipt:null,cancelRequested:false,summary:{id:transferId,databaseId,localId:car.id,name:request.export.items.slotcars[0].name,targetId:choice.target?.carId||'',action:choice.target?'link':'create',state:'queued',error:'',updatedAt:new Date().toISOString()}};
  created.push(x);
 }
 for(const x of created)a.put(x.request.transferId,x);return created.map(summary);
}
function change(a,input){
 if(input.action==='create')return create(a,input);
 const x=entry(a,input.transferId);
 if(input.action==='receipt'){
  const r=receipt(input.receipt,x.request,x.receipt,x.requestHash);a.part(input.transferId,'receipt',r);
  return writeSummary(a,x,{state:x.summary.state==='linked'?'linked':r.cars[0].status,targetId:r.cars[0].paddockCarId,error:''});
 }
 if(input.action==='cancel'){if(!terminal.has(x.summary.state))a.part(input.transferId,'cancelRequested',true);return summary(x);}
 if(input.action==='acceptChanged'){
  if(x.receipt?.cars[0].status!=='approved'||x.summary.state!=='conflict')throw Error('Choose an approved transfer that needs review.');
  const car=a.car(x.summary.localId);if(!car||car.paddock||carRevision(a,car)!==input.expected)throw Error('The Timing car changed again. Reopen the comparison.');
  a.part(input.transferId,'localRevision',input.expected);a.part(input.transferId,'versioned',a.revision(car.id)!==null);return writeSummary(a,x,{state:'approved',error:''});
 }
 // Receipt availability cannot undo a committed link or terminal review decision.
 if(input.action==='error')return writeSummary(a,x,{state:input.attention&&!terminal.has(x.summary.state)?'attention':x.summary.state,error:String(input.message||'Unable to reach Paddock.').slice(0,500)});
 if(input.action==='apply'){
  const r=x.receipt?.cars[0];if(x.summary.state==='linked')return summary(x);
  if(r?.status!=='approved')throw Error('Paddock approval is required before linking.');
  if(!r.present||r.archived)return writeSummary(a,x,{state:'unavailable',error:'The approved Paddock car is deleted or archived. Restore it in Paddock before linking.'});
  const car=a.car(x.summary.localId);
  if(!car||carRevision(a,car,x.versioned?a.revision(car.id):null)!==x.localRevision)return writeSummary(a,x,{state:'conflict',error:'This Timing car changed after transfer. Review the saved and current details before using the approved Paddock car.'});
  validateProfile(input.profile);
  if(input.profile.databaseId!==x.request.databaseId||input.profile.car.id!==r.paddockCarId||input.profile.car.archived)throw Error('Approved car identity changed.');
  a.link(input.profile,car.id);return writeSummary(a,x,{state:'linked',error:''});
 }
 throw Error('Unsupported local transfer operation.');
}
function sqlAdapter(s){
 const {setPath}=require('./sqlite-records'),{subtree}=require('./sqlite-paddock-read'),C=require('./sqlite-catalogue');
 const read=(id,parts)=>subtree(s,ROOT,id,parts);
 return {
  connection:()=>C.read(s,'@meta','paddock',['connection']),sourceId:()=>C.read(s,'@meta','paddock',['sourceId']),
  car:id=>s.get('slotcars',id,true)?.value,revision:id=>s.revision('slotcars',id),className:id=>id?C.read(s,'raceclasses',id,['name'])||'':'',
  linked:(db,id)=>s.statement(`SELECT a.id FROM fields a JOIN fields b ON a.entity=b.entity AND a.id=b.id WHERE a.entity='slotcars' AND a.path='["paddock","databaseId"]' AND a.json=? AND b.path='["paddock","carId"]' AND b.json=?`).get(JSON.stringify(db),JSON.stringify(id)),
  get:(id,full=false)=>{if(!read(id,['summary']))return null;const x=Object.fromEntries(['recoveryId','requestHash','localRevision','versioned','receipt','cancelRequested','summary'].map(k=>[k,read(id,[k])]));x.request=read(id,[full?'request':'identity']);return x;},
  list:()=>s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(ROOT).map(({id})=>C.read(s,ROOT,id,['summary'])),
  put:(id,x)=>s.insert(ROOT,{id,...x}),
  part:(id,key,x)=>setPath(s,ROOT,id,[key],x),
  link:(p,id)=>require('./sqlite-paddock').commands.linkPaddockCar(s,{profile:p,localId:id,expectedRevision:s.revision('slotcars',id)})
 };
}
function preview(a,id){const x=entry(a,id),car=a.car(x.summary.localId);if(!car)throw Error('The original Timing car was deleted. Its race history is unchanged.');const original=a.get(id,true).request.export.items.slotcars[0];const clean=c=>Object.fromEntries(FIELDS.filter(k=>k!=='picture').map(k=>[k,c[k]??'']));return {original:clean(original),current:clean(car),expected:carRevision(a,car)};}
function sqlRead(s,o){const a=sqlAdapter(s);if(o.kind==='source')return a.sourceId();if(o.kind==='list')return a.list();if(o.kind==='preview')return preview(a,o.id);if(o.kind==='get'){entry(a,o.id);return a.get(o.id,o.full===true);}throw Error('Invalid transfer read.');}
function sqlCommand(s,input){return change(sqlAdapter(s),input);}
module.exports={ROOT,FIELDS,receipt,change,sqlRead,sqlCommand,terminal,carExport,preview};
