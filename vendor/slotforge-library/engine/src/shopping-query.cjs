'use strict';
const purchasing=require('./purchasing.cjs');
// Compact descriptors only: page filters never materialise catalogue photographs.
function project(db,filters={}){
 const state={...db.planning,shopping:db.planning.shopping.map(s=>({...s})),shoppingLists:db.planning.shoppingLists?.map(l=>({...l}))};
 if(db.planning.shoppingLists===undefined)delete state.shoppingLists;
 purchasing.upgrade({jobs:db.jobs,cars:db.cars,planning:state});
 const parts=new Map(db.parts.map(p=>[p.id,p])),supplies=new Map(db.supplies.map(p=>[p.id,p]));
 const rows=state.shopping.map(line=>{const item=line.purchase.item,stock=item.kind==='part'?parts.get(item.id):item.kind==='supply'?supplies.get(item.id):item;
  return {line,name:stock?.name||'Unavailable item',maker:stock?.maker||'',reference:stock?.reference||'',source:line.jobId?'job':line.buildId?'build':'general',...purchasing.counts(line)};});
 const unique=values=>[...new Map(values.filter(Boolean).map(v=>[v.toLowerCase(),v])).values()].sort((a,b)=>a.localeCompare(b));
 const makers=unique(rows.map(r=>r.maker)),suppliers=unique(rows.map(r=>r.line.supplier));
 const base=rows.filter(r=>(!filters.listId||r.line.purchase.listId===filters.listId)&&(!filters.maker||r.maker.toLowerCase()===filters.maker.toLowerCase())&&(!filters.supplier||r.line.supplier.toLowerCase()===filters.supplier.toLowerCase())&&(!filters.source||r.source===filters.source)&&[r.name,r.maker,r.reference,r.line.notes,r.line.supplier,r.line.buildName].join(' ').toLowerCase().includes((filters.query||'').toLowerCase()));
 const matches=(r,status)=>status==='received'?r.received===r.line.quantity:status==='ordered'?r.ordered>0:status==='toBuy'?r.toBuy>0:r.line.received<r.line.quantity;
 const counts=Object.fromEntries(['outstanding','toBuy','ordered','received'].map(s=>[s,base.filter(r=>matches(r,s)).length]));
 let visible=base.filter(r=>matches(r,filters.status||'outstanding')).map(r=>r.line);if(filters.groupBySupplier)visible.sort((a,b)=>a.supplier.toLowerCase().localeCompare(b.supplier.toLowerCase())||a.id.localeCompare(b.id));
 return {totals:require('./purchase-orders.cjs').totals(visible),allLines:rows.map(r=>r.line),lines:visible,lists:state.shoppingLists,makers,suppliers,counts};
}
module.exports={project};
