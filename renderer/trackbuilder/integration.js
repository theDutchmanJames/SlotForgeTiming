(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.SlotForgeIntegration=factory(root.Forge);})(typeof globalThis!=='undefined'?globalThis:this,function(F){
'use strict';
const VERSION='0.3.16',CONTRACT='1.0.0-draft.2',ROUTED_CONTRACT='1.0.0-draft.3',FLOWING_CONTRACT='1.0.0-draft.4',TABLETOP_CONTRACT='1.0.0-draft.5',SQUEEZE_CONTRACT='1.0.0-draft.6',APEX_CONTRACT='1.0.0-draft.7',FREEFORM_CONTRACT='1.0.0-draft.8',ELEVATION_CONTRACT='1.0.0-draft.9',SHAPES_CONTRACT='1.0.0-draft.10';
const compare=(a,b)=>a<b?-1:a>b?1:0;
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
// Synchronous SHA-256 keeps offline browser autosave and Node exports identical.
function hash(text){
 const primes=[];for(let n=2;primes.length<64;n++)if(!primes.some(p=>p*p<=n&&n%p===0))primes.push(n);
 const h=primes.slice(0,8).map(p=>(Math.sqrt(p)%1*2**32)|0),k=primes.map(p=>(Math.cbrt(p)%1*2**32)|0),bytes=new TextEncoder().encode(text),size=Math.ceil((bytes.length+9)/64)*64,b=new Uint8Array(size);b.set(bytes);b[bytes.length]=128;
 const view=new DataView(b.buffer);view.setUint32(size-8,Math.floor(bytes.length/2**29));view.setUint32(size-4,(bytes.length*8)>>>0);
 const rotr=(x,n)=>(x>>>n)|(x<<(32-n)),w=new Int32Array(64);
 for(let offset=0;offset<size;offset+=64){for(let i=0;i<16;i++)w[i]=view.getInt32(offset+4*i);for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))|0;}let[a,c,d,e,f,g,j,l]=h;for(let i=0;i<64;i++){const t1=(l+(rotr(f,6)^rotr(f,11)^rotr(f,25))+((f&g)^(~f&j))+k[i]+w[i])|0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&c)^(a&d)^(c&d)))|0;l=j;j=g;g=f;f=(e+t1)|0;e=d;d=c;c=a;a=(t1+t2)|0;}[a,c,d,e,f,g,j,l].forEach((v,i)=>h[i]=(h[i]+v)|0);}
 return h.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}
function newState(){return{designId:F.uid(),direction:1,startFinish:null,routeLabels:{},routeMappingRevision:null,requiresLaneRemap:false};}
function validateEnvelope(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Choose a SlotForge v1 layout JSON object.');
 if(Object.hasOwn(raw,'units')&&raw.units!=='mm')throw Error('Unsupported layout units. Only "mm" is supported; no unit conversion is performed.');
 if(!Object.hasOwn(raw,'integration'))return;
 const meta=raw.integration;
 if(!meta||typeof meta!=='object'||Array.isArray(meta))throw Error('Invalid integration metadata: expected an object.');
 if(Object.hasOwn(meta,'contractVersion')){
  if(typeof meta.contractVersion!=='string'||!meta.contractVersion.trim())throw Error('Invalid integration contract version: expected a non-empty string.');
  if(![CONTRACT,ROUTED_CONTRACT,FLOWING_CONTRACT,TABLETOP_CONTRACT,SQUEEZE_CONTRACT,APEX_CONTRACT,FREEFORM_CONTRACT,ELEVATION_CONTRACT,SHAPES_CONTRACT,'1.0.0-draft.1'].includes(meta.contractVersion))throw Error('Unsupported integration contract version. Supported versions: 1.0.0-draft.1, '+CONTRACT+' and '+ROUTED_CONTRACT+', '+FLOWING_CONTRACT+', '+TABLETOP_CONTRACT+', '+SQUEEZE_CONTRACT+', '+APEX_CONTRACT+', '+FREEFORM_CONTRACT+', '+ELEVATION_CONTRACT+', '+SHAPES_CONTRACT+'.');
 }
 for(const key of ['target','status','profilePurpose','image'])if(Object.hasOwn(meta,key)&&(typeof meta[key]!=='string'||!meta[key].trim()||meta[key].length>200))throw Error('Invalid integration metadata: '+key+' must be a non-empty string of at most 200 characters.');
}
function readState(raw){
 validateEnvelope(raw);
 const state=newState();if(raw.design!==undefined){if(!raw.design||typeof raw.design.id!=='string'||!/^[-\w]{1,100}$/.test(raw.design.id))throw Error('Invalid design ID.');state.designId=raw.design.id;}
 if(raw.timing===undefined)return state;const t=raw.timing;
 if(!t||t.version!==1||![1,-1].includes(t.direction))throw Error('Unsupported timing metadata or direction.');
 state.direction=t.direction;
 if(t.startFinish!=null){const s=t.startFinish;if(typeof s.pieceId!=='string'||!/^[-\w]{1,100}$/.test(s.pieceId)||!Number.isFinite(s.fraction)||s.fraction<0||s.fraction>1)throw Error('Invalid timing line reference.');state.startFinish={pieceId:s.pieceId,fraction:s.fraction};}
 if(t.routeLabels!==undefined){if(!t.routeLabels||Array.isArray(t.routeLabels)||typeof t.routeLabels!=='object'||Object.keys(t.routeLabels).length>64)throw Error('Invalid lane labels.');for(const[id,label]of Object.entries(t.routeLabels)){if(!/^route-[a-f0-9]{64}$/.test(id)||typeof label!=='string'||label.length>100)throw Error('Invalid lane label.');state.routeLabels[id]=label;}}
 if(t.routeMappingRevision!=null){if(!/^[a-f0-9]{64}$/.test(t.routeMappingRevision))throw Error('Invalid route mapping revision.');state.routeMappingRevision=t.routeMappingRevision;}
 if(t.requiresLaneRemap!==undefined&&typeof t.requiresLaneRemap!=='boolean')throw Error('Invalid remapping flag.');state.requiresLaneRemap=!!t.requiresLaneRemap;return state;
}
function network(pieces,defs){
 const net=F.routes([...pieces].sort((a,b)=>compare(a.id,b.id)),defs);
 for(const r of net.routes){const d=defs[pieces.find(p=>p.id===r.sections[0].pieceId).definitionId];r.id='route-'+hash(canonical(d.parameters.type==='freeform'?['freeform',d.parameters.freeform.id,d.parameters.freeform.laneIds[r.sections[0].laneIndex]]:r.sections.map(s=>[s.pieceId,s.laneIndex,s.reverse])));}
 const routeIds=net.routes.map(r=>r.id);if(pieces.some(p=>defs[p.definitionId].parameters.type==='freeform'))routeIds.sort();net.mappingRevision=net.closed?hash(canonical(routeIds)):null;return net;
}
function reconcile(state,net){const next=structuredClone(state);if(net.mappingRevision){if(next.routeMappingRevision&&next.routeMappingRevision!==net.mappingRevision)next.requiresLaneRemap=true;next.routeMappingRevision=net.mappingRevision;next.routeLabels=Object.fromEntries(net.routes.filter(r=>Object.hasOwn(next.routeLabels,r.id)).map(r=>[r.id,next.routeLabels[r.id]]));}return next;}
function offsets(net,startFinish){if(!net.closed||!startFinish)return[];return net.routes.flatMap(r=>{const s=r.sections.find(s=>s.pieceId===startFinish.pieceId);return s?[{routeId:r.id,offsetMm:(s.startMm+(r.segments[r.sections.indexOf(s)]?.type==='polyline'?F.Routed.Spline.distanceAtFraction(r.segments[r.sections.indexOf(s)],s.reverse?1-startFinish.fraction:startFinish.fraction):(s.reverse?1-startFinish.fraction:startFinish.fraction)*s.lengthMm))%r.lengthMm}]:[];});}
function atTravel(route,distance,offset=0,direction=1){const q=F.at(route,offset+direction*distance);return{...q,heading:q.heading+(direction===-1?180:0),curvature:q.curvature*direction};}
function travelPlan(route,profile,offset=0,direction=1){
 // Reversing a speed lookup would reverse braking too. Plan on travel geometry.
 const sections=[],segments=[];let total=0;
 const order=direction===1?route.sections.map((s,i)=>i):route.sections.map((s,i)=>i).reverse();
 for(const i of order){const s=route.sections[i],old=route.segments[i],seg=structuredClone(old);if(direction===-1){if(seg.type==='line')[seg.from,seg.to]=[seg.to,seg.from];else if(seg.type==='polyline'){seg.points.reverse();seg.distancesMm=seg.distancesMm.slice().reverse().map(d=>seg.lengthMm-d);seg.referenceFractions=seg.referenceFractions.slice().reverse().map(v=>1-v);seg.headingsDeg=seg.headingsDeg.reverse().map(a=>a+180);seg.curvaturesPerMm=seg.curvaturesPerMm.reverse().map(k=>-k);}else{seg.startAngleDeg+=seg.sweepDeg;seg.sweepDeg=-seg.sweepDeg;}}sections.push({...s,startMm:total});segments.push(seg);total+=s.lengthMm;}
 const speed=F.speedPlan({...route,sections,segments},profile);return d=>speed(d+direction*offset);
}
function compatibility(pieces,defs,net,startFinish){
 const issues=[],roads=pieces.filter(p=>defs[p.definitionId].geometry.connectors.length||defs[p.definitionId].parameters.type==='freeform'),con=F.connections(roads,defs),visited=new Set();let components=0;
 for(const p of roads){if(visited.has(p.id))continue;components++;const queue=[p.id];while(queue.length){const id=queue.pop();if(visited.has(id))continue;visited.add(id);for(let i=0;i<2;i++){const q=con.links.get(id+':'+i);if(q&&!visited.has(q.pieceId))queue.push(q.pieceId);}}}
 const add=(code,severity,message)=>issues.push({code,severity,message});
 if(!roads.length)add('empty-layout','error','Add road pieces before using Live Tracker.');
 if(con.open.length)add('open-circuit','error','Unconnected road ends: no usable lap lengths are exported.');
 if(components>1)add('disconnected-circuits','error','This integration supports one connected circuit only.');
 if(con.ambiguous.size)add('ambiguous-connections','error','More than one road matches a connector.');
 if(roads.length&&!net.closed&&!con.open.length&&components===1&&!con.ambiguous.size)add('unsupported-route-geometry','error',net.reason);
 if(pieces.some(p=>defs[p.definitionId].parameters.type==='reference'))add('reference-artwork','warning','Reference pictures have approximate display sizes and no slot routes. They count in inventory, but not slot lengths or slot-circuit closure. Optional planning magnets only align estimated surfaces.');
 if(pieces.some(p=>defs[p.definitionId].parameters.type==='freeform'))add('freeform-runtime','warning','FreeForm uses draft.8. Timing needs the FreeForm-aware runtime; open or invalid drafts do not supply racing routes.');
 if(pieces.some(p=>defs[p.definitionId].parameters.routed)&&!pieces.some(p=>defs[p.definitionId].parameters.type==='freeform'))add('routed-runtime','warning',pieces.some(p=>defs[p.definitionId].parameters.squeeze?.version===2)?'Smooth apex squeezes use integration contract 1.0.0-draft.7. Timing needs the apex-aware runtime to preserve the gradual spacing profile.':pieces.some(p=>defs[p.definitionId].parameters.squeeze)?'Squeezed lanes use integration contract 1.0.0-draft.6. Timing needs the squeeze-aware shared runtime; slot spacing varies along the section.':pieces.some(p=>defs[p.definitionId].parameters.routed?.constructionMode==='table')?'Tabletop routing uses integration contract 1.0.0-draft.5. Timing needs the tabletop-aware runtime; wood clearances apply to the table boundary.':pieces.some(p=>defs[p.definitionId].parameters.type==='routed-spline')?'Flowing curves use integration contract 1.0.0-draft.4. Timing needs the flowing-curve runtime; normal offsets use adaptive sampled geometry.':'Routed layouts use integration contract 1.0.0-draft.3. Timing needs the routed-aware shared runtime; lengths follow user-entered geometry.');
 if(pieces.some(p=>defs[p.definitionId].parameters.laneChange))add('lane-changing-branches','warning','Branches are drawn and preserved; Live Tracker follows through routes. Digital switching and pit tracking are unsupported.');
 if(F.Elevation.active(pieces,defs)){add('elevation-planning','warning','Surface heights and sampled clearance checks are preserved. Lengths and CAD remain plan-view measurements; ramp buildability and car/support clearance are not verified.');for(const issue of F.Elevation.checks(pieces,defs,F))add(issue.code,'warning',issue.message);}else add('elevation-order-unavailable','warning','This is a flat drawing. Elevation, bridges and crossing order are not modelled.');
 if(!roads.some(p=>p.id===startFinish?.pieceId)||offsets(net,startFinish).length!==net.routes.length)add('start-finish-unset','warning','Set or confirm a timing line before Live Tracker playback in Timing.');
 return{liveTracker:net.closed?'through-routes':'unavailable',components,openEnds:pieces.some(p=>defs[p.definitionId].parameters.type==='freeform')?net.openEnds:con.open.length,ambiguousEnds:con.ambiguous.size,issues};
}
function definition(d){return{id:d.id,name:d.name,sku:d.sku,pack:d.pack,family:d.family,parameters:d.parameters,color:d.color,status:d.status,mirror:d.mirror,...(d.referenceImage?{referenceImage:d.referenceImage}:{})};}
function prepare(raw,state,withGeometry=true){
 const incoming=readState(raw),clean=F.validateLayout(raw),pieces=clean.pieces,defs=clean.definitions,net=network(pieces,defs),s=reconcile(state||incoming,net);
 const timing={version:1,direction:s.direction,directionConvention:'canonical-route-distance',startFinish:s.startFinish,routeLabels:s.routeLabels,routeMappingRevision:s.routeMappingRevision,requiresLaneRemap:s.requiresLaneRemap,startFinishOffsets:offsets(net,s.startFinish)};
 const model={format:'slotforge.layout',version:1,title:clean.title,pieces,definitions:Object.values(defs).sort((a,b)=>compare(a.id,b.id)).map(definition),profile:clean.profile,units:'mm',precision:pieces.some(p=>['routed-spline','freeform'].includes(defs[p.definitionId].parameters.type))?'User-entered geometry; flowing normal offsets use adaptive samples (0.025 mm target); not verified construction measurements.':'Nominal or user-entered dimensions; not verified mould measurements.',timing};
 // Array order controls surface paint order, so it participates in the design revision.
 const tabletop=pieces.some(p=>defs[p.definitionId].parameters.routed?.constructionMode==='table'),guide=clean.workspace?.spaceGuide,physicalTable=guide?.kind==='table'?{x:guide.x,y:guide.y,lengthMm:guide.lengthMm,widthMm:guide.widthMm,...(guide.shape?{shape:guide.shape}:{})}:null;
 const revision=hash(canonical({designId:s.designId,...model,...(tabletop?{table:physicalTable}:{})}));
 const result={...model,...(clean.workspace?{workspace:clean.workspace}:{}),design:{id:s.designId,revision},producer:{name:'SlotForge Circuit',version:VERSION},integration:{target:'SlotForge Timing',contractVersion:(clean.workspace?.spaceGuide?.shape||model.definitions.some(d=>d.parameters.freeform?.nodes.some(n=>n.squeeze)))?SHAPES_CONTRACT:(pieces.some(p=>p.elevation!==undefined)||model.definitions.some(d=>d.parameters.freeform?.elevation!==undefined||d.parameters.freeform?.nodes.some(n=>n.heightMm!==undefined)))?ELEVATION_CONTRACT:model.definitions.some(d=>d.parameters.type==='freeform')?FREEFORM_CONTRACT:model.definitions.some(d=>d.parameters.squeeze?.version===2)?APEX_CONTRACT:model.definitions.some(d=>d.parameters.squeeze)?SQUEEZE_CONTRACT:(clean.workspace?.routed?.settings.constructionMode==='table'||model.definitions.some(d=>d.parameters.routed?.constructionMode==='table'))?TABLETOP_CONTRACT:model.definitions.some(d=>d.parameters.type==='routed-spline')?FLOWING_CONTRACT:model.definitions.some(d=>d.parameters.routed)?ROUTED_CONTRACT:CONTRACT,status:'draft-for-coordination',profilePurpose:'illustrative-animation',image:'optional-separate-png'},compatibility:compatibility(pieces,defs,net,s.startFinish),track:{laneCount:net.closed?net.routes.length:null,slotCountsInDrawing:[...new Set(pieces.map(p=>defs[p.definitionId].geometry.lanePaths.length).filter(Boolean))].sort((a,b)=>a-b),validClosedRouteCount:net.routes.length,lanes:net.routes.map((r,i)=>({id:r.id,label:s.routeLabels[r.id]||'Lane '+(i+1),lengthMm:r.lengthMm}))}};
 if(withGeometry)result.preparedGeometry={closed:net.closed,boundsMm:F.bounds(pieces,defs),surfaces:pieces.map(p=>({pieceId:p.id,outline:defs[p.definitionId].geometry.outlineSvgPath,transform:{x:p.x,y:p.y,angleDeg:p.angle,reflectY:p.flip},kind:defs[p.definitionId].parameters.type})),routes:net.routes.map(r=>({id:r.id,lengthMm:r.lengthMm,segments:r.segments,sections:r.sections})),alternateRoutes:F.alternateRoutes(pieces,defs)};
 return result;
}
function importLayout(raw){const state=readState(raw),clean=F.validateLayout(raw);return{...clean,state:reconcile(state,network(clean.pieces,clean.definitions))};}
function picture(raw,{borders=true,maxDimension=1600,padding=24}={}){
 validateEnvelope(raw);
 const clean=F.validateLayout(raw),defs=clean.definitions,pieces=clean.pieces.filter(p=>borders||!defs[p.definitionId].parameters.type.endsWith('border'));
 if(!pieces.length)throw Error('Add pieces before exporting a track picture.');
 const limit=Math.floor(Math.max(64,Math.min(2048,Number.isFinite(maxDimension)?maxDimension:1600))),pad=Math.max(4,Math.min(64,(limit-1)/2,Number.isFinite(padding)?padding:24)),table=pieces.some(p=>defs[p.definitionId].parameters.routed)?clean.workspace?.spaceGuide:null,b=F.Routed.tableBounds(F.bounds(pieces,defs),table),scale=(limit-2*pad)/Math.max(b[2],b[3],1),width=Math.min(limit,Math.max(1,Math.ceil(b[2]*scale+2*pad))),height=Math.min(limit,Math.max(1,Math.ceil(b[3]*scale+2*pad)));
 let body=F.Routed.drawTable(table);for(const p of pieces){const d=defs[p.definitionId];body+=`<g transform="translate(${p.x} ${p.y}) rotate(${p.angle}) scale(1 ${p.flip?-1:1})">${F.drawBody(d)}</g>`;}
 return{width,height,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${b[0]-pad/scale} ${b[1]-pad/scale} ${width/scale} ${height/scale}">${body}</svg>`};
}
return{SHAPES_CONTRACT,ELEVATION_CONTRACT,VERSION,CONTRACT,ROUTED_CONTRACT,FLOWING_CONTRACT,TABLETOP_CONTRACT,SQUEEZE_CONTRACT,APEX_CONTRACT,FREEFORM_CONTRACT,canonical,hash,newState,readState,network,reconcile,offsets,atTravel,travelPlan,compatibility,prepare,importLayout,picture};
});
