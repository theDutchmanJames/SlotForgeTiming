'use strict';
const {randomUUID}=require('node:crypto');
const purchasing=require('./purchasing.cjs');
const add=(map,id,quantity)=>map.set(id,(map.get(id)||0)+quantity);
function buildDemand(draft){const totals=new Map();for(const row of draft.data.parts)add(totals,row.partId,row.quantity);return totals;}
function jobDemand(db,job){
 const totals=new Map();
 if(job.status==='active'&&job.kind!=='general')for(const row of require('./jobs.cjs').model(db,job.id,[],{choices:false,requirementsOnly:true}).rows)if(!row.done&&row.kind==='part')add(totals,row.partId,row.quantity);
 return totals;
}
function inventory(db){
 const parts=new Map(db.parts.map(p=>[p.id,p])),available=new Map(db.parts.map(p=>[p.id,p.quantity])),assembled=new Set();
 for(const i of db.installations)if(!i.removed)add(available,i.partId,-i.quantity);
 for(const a of db.assemblies)if(!a.dismantled)for(const c of a.components){assembled.add(c.partId);if(!a.carId)add(available,c.partId,-c.quantity);}
 return {parts,available,assembled};
}
function sync(db,origin,totals,stamp,state='active',stock=inventory(db)){
 purchasing.upgrade(db);
 const matches=line=>origin.kind==='build'?line.buildId===origin.id:!line.buildId&&line.purchase?.requirement?.kind==='job'&&line.purchase.requirement.id===origin.id;
 const existing=db.planning.shopping.filter(matches),parts=stock.parts;
 // Retain every receipt and order even if older data contains duplicate requirements.
 for(const partId of new Set([...totals.keys(),...existing.map(l=>l.partId)])){
  const part=parts.get(partId),demand=totals.get(partId)||0;
  let needed=state==='active'&&part?Math.max(0,demand-stock.available.get(partId)):0;
  // An individual identity cannot be purchased twice. Transfers/substitutes require a user's choice.
  if(part?.tracking==='individual')needed=Math.min(needed,Math.max(0,1-part.quantity-db.planning.shopping.filter(l=>l.partId===partId&&!matches(l)).reduce((n,l)=>n+l.quantity-l.received,0)));
  if(stock.assembled.has(partId))needed=0;
  const lines=existing.filter(l=>l.partId===partId);
  let line=lines[0];
  if(!line&&needed){
   line={id:randomUUID(),partId,jobId:origin.jobId||'',...(origin.kind==='build'?{buildId:origin.id,buildName:origin.name}:{}),quantity:needed,received:0,notes:'',supplier:'',date:'',created:stamp,updated:stamp};
   db.planning.shopping.push(line);purchasing.upgrade(db);lines.push(line);
  }
  if(!line)continue;
  const ordered=lines.reduce((n,l)=>n+l.purchase.ordered,0);
  for(const [index,l] of lines.entries()){
   // Outstanding orders cover a requirement once, including orders on older duplicate lines.
   const target=l.purchase.ordered+(index===0?Math.max(0,needed-ordered):0);
   const metadata={kind:origin.kind,id:origin.id,needed:index===0?needed:0,state:state==='active'&&!demand?(origin.kind==='job'?'satisfied':'removed'):state};
   if(l.quantity!==l.received+target||JSON.stringify(l.purchase.requirement)!==JSON.stringify(metadata)){
    purchasing.requirement(l,target,stamp);l.purchase.requirement=metadata;
   }
   if(origin.kind==='build')l.buildName=origin.name;
  }
 }
 db.planning.shopping=db.planning.shopping.filter(l=>!matches(l)||l.quantity>0||require('./purchase-orders.cjs').history(l));
 // Only generated list names follow their project; manually chosen lists stay intact.
 for(const list of db.planning.shoppingLists){
  if(origin.kind==='build'&&!origin.jobId&&list.source.kind==='build'&&list.source.id===origin.id)list.name=origin.name;
  if(origin.jobId&&list.source.kind==='job'&&list.source.id===origin.jobId){const j=db.jobs.find(j=>j.id===origin.jobId),c=j&&db.cars.find(c=>c.id===j.carId);if(j)list.name=[c?.name,j.name].filter(Boolean).join(' · ').slice(0,200);}
 }
}
function build(db,draft,stamp,state='active',stock){sync(db,{kind:'build',id:draft.id,jobId:draft.data.rebuild?.jobId||'',name:draft.data.name||'Untitled build'},state==='active'?buildDemand(draft):new Map(),stamp,state,stock);}
function job(db,j,stamp,stock){if(db.planning.shoppingLists)for(const list of db.planning.shoppingLists)if(list.source.kind==='job'&&list.source.id===j.id)list.name=[db.cars.find(c=>c.id===j.carId)?.name,j.name].filter(Boolean).join(' · ').slice(0,200);if(j.shoppingRequirements)sync(db,{kind:'job',id:j.id,jobId:j.id,name:j.name},jobDemand(db,j),stamp,j.status==='active'?'active':j.status,stock);}
function refresh(db,stamp){const jobs=db.jobs.filter(j=>j.shoppingRequirements&&j.status==='active');if(!db.buildDrafts.length&&!jobs.length)return;const stock=inventory(db);for(const draft of db.buildDrafts)build(db,draft,stamp,'active',stock);for(const j of jobs)job(db,j,stamp,stock);}
function conflicts(db){
 const demands=new Map();
 const collect=(name,totals)=>{for(const [id,quantity]of totals){let d=demands.get(id);if(!d){d={quantity:0,plans:[]};demands.set(id,d);}d.quantity+=quantity;d.plans.push(name);}};
 for(const draft of db.buildDrafts)collect(draft.data.name||'Untitled build',buildDemand(draft));
 for(const j of db.jobs)if(j.shoppingRequirements&&j.status==='active')collect(j.name,jobDemand(db,j));
 const result=[],stock=inventory(db);
 for(const part of db.parts){const d=demands.get(part.id);if(!d||d.plans.length<2)continue;const available=stock.available.get(part.id);if(d.quantity>available)result.push({partId:part.id,name:part.name,required:d.quantity,available,plans:d.plans});}
 return result;
}
const affects=action=>['part.save','part.install','part.remove','assembly.create','assembly.replace','assembly.install','assembly.remove','assembly.dismantle','setup.apply','build.draft.save','build.draft.delete','build.create','job.fit','job.remove','job.complete','job.cancel','job.edit','car.delete'].includes(action);
module.exports={build,job,refresh,conflicts,buildDemand,jobDemand,affects};
