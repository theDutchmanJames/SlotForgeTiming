(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./geometry.cjs'));else root.Forge=factory(root.Geometry);})(typeof globalThis!=='undefined'?globalThis:this,function(G){
'use strict';
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),wrap=a=>((a+180)%360+360)%360-180;
const uid=()=>globalThis.crypto?.randomUUID?.()||'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function point(p,t){const a=rad(t.angle),y=p[1]*(t.flip?-1:1);return[t.x+p[0]*Math.cos(a)-y*Math.sin(a),t.y+p[0]*Math.sin(a)+y*Math.cos(a)];}
function direction(a,t){return wrap(t.angle+(t.flip?-a:a));}
function pose(def,x=0,y=0){return{id:uid(),definitionId:def.id,x,y,angle:0,flip:false};}
function ports(p,defs){const d=defs[p.definitionId];return d.geometry.connectors.map((c,i)=>({pieceId:p.id,index:i,position:point(c.position,p),angle:direction(c.outwardAngleDeg,p),lanes:c.lanes.map(l=>point(l.position,p)),family:d.family,width:d.parameters.widthMm}));}
function compatible(a,b){
 if(a.family!==b.family||Math.abs(a.width-b.width)>=.1||a.lanes.length!==b.lanes.length)return false;
 const offsets=p=>p.lanes.map(l=>dist(l,p.position)).sort((x,y)=>x-y),aa=offsets(a),bb=offsets(b);
 return aa.every((d,i)=>Math.abs(d-bb[i])<.1);
}
function join(p,def,portIndex,target){const c=def.geometry.connectors[portIndex];const angle=wrap(target.angle+180-(p.flip?-c.outwardAngleDeg:c.outwardAngleDeg));const n={...p,x:0,y:0,angle},q=point(c.position,n);n.x=target.position[0]-q[0];n.y=target.position[1]-q[1];return n;}
function slotsMatch(a,b,tolerance=.15){if(a.lanes.length!==b.lanes.length)return false;const remaining=b.lanes.slice();return a.lanes.every(l=>{const i=remaining.findIndex(t=>dist(l,t)<tolerance);if(i<0)return false;remaining.splice(i,1);return true;});}
function connections(items,defs,tolerance=.15){
 const all=items.flatMap(p=>ports(p,defs)),links=new Map(),ambiguous=new Set(),buckets=new Map();
 const key=p=>p.pieceId+':'+p.index,cell=p=>p.position.map(v=>Math.floor(v/tolerance));
 for(const p of all){const k=cell(p).join(',');if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p);}
 for(const a of all){const [x,y]=cell(a),matches=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const b of buckets.get((x+dx)+','+(y+dy))||[])
   if(a.pieceId!==b.pieceId&&dist(a.position,b.position)<tolerance&&Math.abs(Math.abs(wrap(a.angle-b.angle))-180)<.1&&compatible(a,b)&&slotsMatch(a,b,tolerance))matches.push(b);
  if(matches.length===1)links.set(key(a),matches[0]);else if(matches.length>1)ambiguous.add(key(a));
 }
 for(const[k,b]of [...links])if(!links.has(key(b))||key(links.get(key(b)))!==k)links.delete(k);
 return{all,links,ambiguous,open:all.filter(p=>!links.has(key(p)))};
}
function snap(moving,items,defs,threshold=60,portIndices=null,openTargets=null){const remaining=items.filter(p=>p.id!==moving.id),targets=openTargets||connections(remaining,defs).open;let best=null;for(const a of ports(moving,defs).filter(p=>!portIndices||portIndices.includes(p.index)))for(const b of targets){if(!compatible(a,b))continue;const distance=dist(a.position,b.position),turn=Math.abs(wrap(b.angle+180-a.angle));if(distance<=threshold&&turn<=65){const joined=join(moving,defs[moving.definitionId],a.index,b),jp=ports(joined,defs)[a.index];if(!slotsMatch(jp,b,.1))continue;const score=distance+turn*.3;if(!best||score<best.score)best={pose:join(moving,defs[moving.definitionId],a.index,b),score,target:b};}}return best;}
function outline(def){const p=def.parameters;if(p.type==='reference'||p.type.startsWith('straight'))return[[0,0],[p.lengthMm,0],[p.lengthMm,p.widthMm],[0,p.widthMm]];const n=Math.max(2,Math.ceil(p.angleDeg/1));return Array.from({length:n+1},(_,i)=>G.pt(p.innerRadiusMm+p.widthMm,rad(p.angleDeg*i/n))).concat(Array.from({length:n+1},(_,i)=>G.pt(p.innerRadiusMm,rad(p.angleDeg*(1-i/n)))));}
function bounds(items,defs){if(!items.length)return[0,0,1000,700];const ps=items.flatMap(p=>outline(defs[p.definitionId]).map(v=>point(v,p)));let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const[x,y]of ps){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}return[minX,minY,maxX-minX,maxY-minY];}
// Apply the same rigid motion (including reflection) to an entire selection.
function repositionGroup(items,from,to){
 const turn=rad(-from.angle),reflect=from.flip!==to.flip;
 return items.map(p=>{const dx=p.x-from.x,dy=p.y-from.y;
  const local=[dx*Math.cos(turn)-dy*Math.sin(turn),dx*Math.sin(turn)+dy*Math.cos(turn)];
  const origin=point(local,{...to,flip:reflect});
  return{...p,x:origin[0],y:origin[1],angle:wrap(to.angle+(reflect?-1:1)*(p.angle-from.angle)),flip:p.flip!==reflect};
 });
}
// Test the actual sampled footprint, so selecting empty space inside a bend
// does not accidentally select that bend's rectangular bounding box.
function inSelectionBox(p,def,a,b){
 const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
 const polygon=outline(def).map(q=>point(q,p)),corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
 if(polygon.some(([x,y])=>x>=x0&&x<=x1&&y>=y0&&y<=y1))return true;
 const inside=([x,y])=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
 }return hit;};
 if(corners.some(inside))return true;
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const intersects=(a,b,c,d)=>Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
 return polygon.some((q,i)=>corners.some((c,j)=>intersects(q,polygon[(i+1)%polygon.length],c,corners[(j+1)%4])));
}
function samples(p,def,lane,reverse=false){const l=def.geometry.lanePaths[lane],s=l.segments[0];let list;if(s.type==='line')list=[{p:s.from,d:0,k:0},{p:s.to,d:l.lengthMm,k:0}];else{const n=Math.min(128,Math.max(2,Math.ceil(l.lengthMm/12)));list=Array.from({length:n+1},(_,i)=>{const a=rad(s.startAngleDeg+s.sweepDeg*i/n);return{p:[s.center[0]+s.radiusMm*Math.cos(a),s.center[1]+s.radiusMm*Math.sin(a)],d:l.lengthMm*i/n,k:(p.flip?-1:1)/s.radiusMm};});}list=list.map(q=>({...q,p:point(q.p,p)}));if(reverse)list=list.reverse().map(q=>({...q,d:l.lengthMm-q.d,k:-q.k}));return list;}
function routes(items,defs){const roads=items.filter(p=>defs[p.definitionId].geometry.connectors.length===2),net=connections(roads,defs);if(!roads.length||net.open.length||net.ambiguous.size)return{closed:false,openEnds:net.open.length,routes:[],reason:roads.length?'Connect every road end to preview a closed circuit.':'Add road pieces to begin.'};const byId=Object.fromEntries(roads.map(p=>[p.id,p])),start=roads[0],order=[],seen=new Set();let cur=start,entry=0;while(!seen.has(cur.id)){seen.add(cur.id);order.push({p:cur,entry});const next=net.links.get(cur.id+':'+(1-entry));if(!next)return{closed:false,openEnds:1,routes:[],reason:'Unconnected road end.'};cur=byId[next.pieceId];entry=next.index;}if(cur.id!==start.id||entry!==0||seen.size!==roads.length)return{closed:false,openEnds:0,routes:[],reason:'Use one connected circuit for preview; separate loops are present.'};
 const first=ports(start,defs)[0],result=[];for(let startLane=0;startLane<first.lanes.length;startLane++){let lane=startLane,total=0,list=[],sections=[];for(let i=0;i<order.length;i++){const{p,entry}=order[i],def=defs[p.definitionId],part=samples(p,def,lane,entry===1),len=def.geometry.lanePaths[lane].lengthMm;sections.push({pieceId:p.id,laneIndex:lane,reverse:entry===1,startMm:total,lengthMm:len});list.push(...part.map(q=>({...q,d:q.d+total})));total+=len;const end=part.at(-1).p,next=order[(i+1)%order.length],nextPorts=ports(next.p,defs)[next.entry];lane=nextPorts.lanes.findIndex(l=>dist(l,end)<.2);if(lane<0)return{closed:false,openEnds:0,routes:[],reason:'Slot positions do not match at a connection.'};}if(lane!==startLane)return{closed:false,openEnds:0,routes:[],reason:'Lane-swapping routes are not supported in this iteration.'};const route={id:'lane-'+(startLane+1),lengthMm:total,points:list,sections};route.segments=worldSegments(route,items,defs);result.push(route);}return{closed:true,openEnds:0,routes:result,reason:'One closed circuit'};}
function at(route,d){d=((d%route.lengthMm)+route.lengthMm)%route.lengthMm;if(route.segments){
 const sections=route.sections;let lo=0,hi=sections.length;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(sections[mid].startMm<=d)lo=mid;else hi=mid;}
 const segment=route.segments[lo],fraction=(d-sections[lo].startMm)/sections[lo].lengthMm;
 if(segment.type==='line')return{x:segment.from[0]+(segment.to[0]-segment.from[0])*fraction,y:segment.from[1]+(segment.to[1]-segment.from[1])*fraction,heading:deg(Math.atan2(segment.to[1]-segment.from[1],segment.to[0]-segment.from[0])),curvature:0};
 const angle=segment.startAngleDeg+segment.sweepDeg*fraction;
 return{x:segment.center[0]+segment.radiusMm*Math.cos(rad(angle)),y:segment.center[1]+segment.radiusMm*Math.sin(rad(angle)),heading:angle+(segment.sweepDeg>0?90:-90),curvature:Math.sign(segment.sweepDeg)/segment.radiusMm};
 }const ps=route.points;let lo=0,hi=ps.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(ps[m].d<=d)lo=m;else hi=m;}while(hi<ps.length-1&&ps[hi].d<=ps[lo].d)hi++;const a=ps[lo],b=ps[hi],f=(d-a.d)/(b.d-a.d||1);return{x:a.p[0]+(b.p[0]-a.p[0])*f,y:a.p[1]+(b.p[1]-a.p[1])*f,heading:deg(Math.atan2(b.p[1]-a.p[1],b.p[0]-a.p[0])),curvature:a.k};}
const presets={Relaxed:{speed:800,acceleration:700,brake:1300,corner:.48,drift:5},Balanced:{speed:1200,acceleration:1300,brake:2200,corner:.57,drift:10},Aggressive:{speed:1800,acceleration:2200,brake:3200,corner:.68,drift:16}};
function speedPlan(route,profile){const count=Math.min(20000,Math.max(40,Math.ceil(route.lengthMm/15))),ds=route.lengthMm/count;const speeds=Array.from({length:count},(_,i)=>{const k=Math.abs(at(route,i*ds).curvature);return k?Math.min(profile.speed,profile.speed*profile.corner*Math.sqrt((1/k)/350)):profile.speed;});for(let pass=0;pass<5;pass++){for(let i=count*2-1;i>=0;i--){const j=i%count;speeds[j]=Math.min(speeds[j],Math.sqrt(speeds[(j+1)%count]**2+2*profile.brake*ds));}for(let i=0;i<count*2;i++){const j=i%count;speeds[j]=Math.min(speeds[j],Math.sqrt(speeds[(j+count-1)%count]**2+2*profile.acceleration*ds));}}return d=>{const u=((d/route.lengthMm%1)+1)%1*count,i=Math.floor(u),f=u-i;return Math.sqrt(speeds[i]**2*(1-f)+speeds[(i+1)%count]**2*f);};}
function validateDefinition(raw){if(!raw||typeof raw!=='object'||typeof raw.id!=='string'||!/^[-\w:.]{1,100}$/.test(raw.id))throw Error('A piece needs a valid unique ID.');if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>100)throw Error('Piece names must be 1–100 characters.');const p=raw.parameters;if(!p||Array.isArray(p)||typeof p!=='object'||!['straight','curve','straight-border','curve-border','reference'].includes(p.type))throw Error('Only straight, curve, border and reference templates are supported.');for(const[k,v]of Object.entries(p))if(typeof v==='number'&&(!Number.isFinite(v)||Math.abs(v)>10000))throw Error('Dimensions must be finite and no larger than 10,000 mm.');if(p.laneCount>8)throw Error('At most 8 lanes are supported.');for(const key of ['widthMm',...(p.type==='reference'||p.type.startsWith('straight')?['lengthMm']:['innerRadiusMm','angleDeg'])])if(!Number.isFinite(p[key])||p[key]<.01||p[key]>10000)throw Error(key+' must be between 0.01 and 10,000.');
 const clean={type:p.type,widthMm:p.widthMm};if(p.type==='reference'||p.type.startsWith('straight'))clean.lengthMm=p.lengthMm;else{clean.innerRadiusMm=p.innerRadiusMm;clean.angleDeg=p.angleDeg;}if(p.type==='reference'){}else if(p.type.endsWith('border'))clean.side=p.side;else if(p.laneOffsetsMm!==undefined){if(!Array.isArray(p.laneOffsetsMm))throw Error('Invalid lane offsets.');if(p.laneSpacingMm!==undefined||p.laneCount!==undefined&&p.laneCount!==p.laneOffsetsMm.length)throw Error('Use explicit lane offsets or uniform lane spacing, without conflicting lane counts.');if(!Array.isArray(p.laneOffsetsMm)||p.laneOffsetsMm.length>8)throw Error('Invalid lane offsets.');clean.laneOffsetsMm=[...p.laneOffsetsMm];}else{clean.laneCount=p.laneCount;clean.laneSpacingMm=p.laneSpacingMm;}if(!clean.type.endsWith('border')&&!clean.laneOffsetsMm&&(clean.laneCount-1)*(clean.laneSpacingMm||0)>=clean.widthMm)throw Error('The slots must fit inside the road. Reduce slot spacing or increase surface width.');if(p.laneChange!==undefined){clean.laneChange=p.laneChange;clean.switchStartMm=p.switchStartMm;clean.switchEndMm=p.switchEndMm;}if(p.type==='reference'&&p.laneChange!==undefined)throw Error('Reference pictures cannot define slot routes.');if(p.type==='reference'&&raw.referenceImage!==undefined&&(typeof raw.referenceImage!=='string'||raw.referenceImage.length>500000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(raw.referenceImage)))throw Error('Reference artwork must be an embedded PNG smaller than 500 KB.');const geometry=G.derive(clean);const family=typeof raw.family==='string'&&/^[-\w:.]{1,100}$/.test(raw.family)?raw.family:'custom';return{id:raw.id,name:raw.name.trim(),pack:typeof raw.pack==='string'?raw.pack.slice(0,100):'Custom',family,parameters:clean,geometry,color:/^#[0-9a-f]{6}$/i.test(raw.color)?raw.color:'#343a40',status:p.type==='reference'?'reference-only':raw.status==='nominal'?'nominal':'user-defined',...(p.type==='reference'&&raw.referenceImage?{referenceImage:raw.referenceImage}:{}),sku:typeof raw.sku==='string'?raw.sku.slice(0,80):'',mirror:raw.mirror!==false};}
function validateLayout(raw){if(raw?.format!=='slotforge.layout'||raw.version!==1)throw Error('Choose a SlotForge v1 layout JSON file.');if(!Array.isArray(raw.definitions)||raw.definitions.length>500||!Array.isArray(raw.pieces)||raw.pieces.length>500)throw Error('Layouts support up to 500 pieces and definitions.');const defs=Object.create(null);for(const d of raw.definitions){const def=validateDefinition(d);if(defs[def.id])throw Error('Duplicate definition ID.');defs[def.id]=def;}const ids=new Set();const pieces=raw.pieces.map(p=>{if(!p||typeof p!=='object'||typeof p.definitionId!=='string')throw Error('Invalid placed piece.');if(!defs[p.definitionId])throw Error('A placed piece has no embedded definition.');if(typeof p.id!=='string'||ids.has(p.id)||!/^[\w-]{1,100}$/.test(p.id))throw Error('Invalid or duplicate placement ID.');ids.add(p.id);if(p.flip!==undefined&&typeof p.flip!=='boolean')throw Error('Reflection must be true or false.');if(p.flip&&!defs[p.definitionId].mirror)throw Error('This definition does not support reflection.');for(const k of['x','y','angle'])if(!Number.isFinite(p[k])||Math.abs(p[k])>1000000)throw Error('Invalid placement coordinates.');return{id:p.id,definitionId:p.definitionId,x:p.x,y:p.y,angle:wrap(p.angle),flip:!!p.flip};});const profile={...presets.Balanced};for(const[k,limits]of Object.entries({speed:[200,3000],acceleration:[100,4000],brake:[100,5000],corner:[.2,.95],drift:[0,30]})){const v=raw.profile?.[k];if(Number.isFinite(v))profile[k]=Math.max(limits[0],Math.min(limits[1],v));}return{title:typeof raw.title==='string'?raw.title.slice(0,100):'Imported circuit',pieces,definitions:defs,profile};}

function mergeDefinitions(incoming,pieces,existing){
 const additions=Object.create(null),remap=new Map();
 const signature=d=>JSON.stringify([d.name,d.sku||'',d.pack,d.family,d.color,d.status,d.mirror!==false,G.resolve(d.parameters),d.referenceImage||'']);
 for(const d of Object.values(incoming)){
  const old=existing[d.id];let id=d.id;
  if(old&&signature(old)!==signature(d))do{id='import:'+uid();}while(existing[id]||incoming[id]||additions[id]);
  remap.set(d.id,id);if(!old||id!==d.id)additions[id]={...d,id};
 }
 return{definitions:additions,pieces:pieces.map(p=>({...p,definitionId:remap.get(p.definitionId)||p.definitionId}))};
}
// Plan border placement without changing the layout. Smaller compatible border
// segments can tile one road edge (for example two 22.5° borders on a 45° road).
// Keep an edge continuous across connectors. In a closed circuit, winding
// determines the inside; open chains inherit the side of a connected bend.
function borderSideMap(items,defs){
 const roads=items.filter(p=>defs[p.definitionId].geometry.connectors.length===2).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),byId=new Map(roads.map(p=>[p.id,p])),net=connections(roads,defs),seen=new Set(),inside=new Map();let fallback=false;
 for(const seed of roads){if(seen.has(seed.id))continue;const component=[],queue=[seed];
  while(queue.length){const p=queue.pop();if(seen.has(p.id))continue;seen.add(p.id);component.push(p);for(let i=0;i<2;i++){const next=net.links.get(p.id+':'+i);if(next&&!seen.has(next.pieceId))queue.push(byId.get(next.pieceId));}}
  const circuit=routes(component,defs),route=circuit.routes[0],turn=route?.segments.reduce((sum,s)=>sum+(s.type==='arc'?s.sweepDeg:0),0)||0;
  if(circuit.closed&&Math.abs(Math.abs(turn)-360)<1){
   for(const s of route.sections){const p=byId.get(s.pieceId),right=turn*(s.reverse?-1:1)*(p.flip?-1:1)>0;inside.set(p.id,right);}continue;
  }
  fallback=true;const anchor=component.filter(p=>defs[p.definitionId].parameters.type==='curve').sort((a,b)=>a.id<b.id?-1:1)[0]||seed,local=new Map([[anchor.id,true]]),pending=[anchor];let conflict=false;
  while(pending.length){const p=pending.pop();for(let i=0;i<2;i++){const next=net.links.get(p.id+':'+i);if(!next)continue;const q=byId.get(next.pieceId),sign=(i===1?1:-1)*(next.index===0?1:-1)*(p.flip?-1:1)*(q.flip?-1:1),right=sign===1?local.get(p.id):!local.get(p.id);if(local.has(q.id)){if(local.get(q.id)!==right)conflict=true;}else{local.set(q.id,right);pending.push(q);}}}
  for(const p of component)inside.set(p.id,conflict?true:local.get(p.id));
 }
 return{inside,fallback};
}
function planBorders(roads,existing,defs,sides=['inner','outer']){
 const near=(a,b)=>Math.abs(a-b)<.01,added=[],missing=[],catalogue=Object.values(defs).filter(d=>d.parameters.type.endsWith('border'));
 const context=borderSideMap(existing,defs),sideMode=context.fallback?'connected-or-local':'circuit';
 const signature=p=>outline(defs[p.definitionId]).map(v=>point(v,p).map(n=>Math.round(n*100)).join(',')).sort().join(';');
 const occupied=new Set(existing.filter(p=>defs[p.definitionId].parameters.type.endsWith('border')).map(signature));
 let duplicates=0;
 for(const road of roads){const d=defs[road.definitionId],r=d.parameters;if(!['straight','curve'].includes(r.type))continue;
  for(const requestedSide of sides){
   const right=context.inside.get(road.id)??true,insideSide=r.type==='straight'?(right?'outer':'inner'):(right?'inner':'outer');
   const side=requestedSide==='inner'?insideSide:(insideSide==='inner'?'outer':'inner');
   const candidates=catalogue.filter(border=>{const b=border.parameters;
    if(border.family!==d.family||b.type!==r.type+'-border')return false;
    const size=r.type==='straight'?r.lengthMm:r.angleDeg,step=r.type==='straight'?b.lengthMm:b.angleDeg,count=Math.round(size/step);
    if(count<1||count>500||!near(count*step,size))return false;
    if(r.type==='curve'&&(b.side!==side||!near(side==='inner'?b.innerRadiusMm+b.widthMm:b.innerRadiusMm,side==='inner'?r.innerRadiusMm:r.innerRadiusMm+r.widthMm)))return false;
    const localFlip=r.type==='straight'&&(side==='inner')===(b.side==='outer');
    return border.mirror!==false||road.flip===localFlip;
   }).sort((a,b)=>((b.parameters.lengthMm||b.parameters.angleDeg)-(a.parameters.lengthMm||a.parameters.angleDeg))||a.id.localeCompare(b.id));
   const border=candidates[0];if(!border){missing.push({pieceId:road.id,name:d.name,side:requestedSide});continue;}
   const b=border.parameters,count=Math.round((r.lengthMm||r.angleDeg)/(b.lengthMm||b.angleDeg));
   for(let i=0;i<count;i++){
    let p={...pose(border),x:road.x,y:road.y,angle:road.angle,flip:road.flip};
    if(r.type==='curve')p.angle=wrap(road.angle+(road.flip?-1:1)*i*b.angleDeg);
    else{const flip=(side==='inner')===(b.side==='outer'),y=side==='inner'?(flip?0:-b.widthMm):(flip?r.widthMm+b.widthMm:r.widthMm),origin=point([i*b.lengthMm,y],road);p.x=origin[0];p.y=origin[1];p.flip=road.flip!==flip;}
    const key=signature(p);if(occupied.has(key)){duplicates++;continue;}occupied.add(key);added.push(p);if(existing.length+added.length>500)return{added,missing,duplicates,overflow:true,sideMode};
   }
  }
 }
 return{added,missing,duplicates,sideMode};
}
function alternateRoutes(items,defs){
 return items.flatMap(p=>(defs[p.definitionId].geometry.alternateLanePaths||[]).map(route=>({pieceId:p.id,id:route.id,fromLaneIndex:route.fromLaneIndex,toLaneIndex:route.toLaneIndex,lengthMm:route.lengthMm,segments:route.segments.map(segment=>{const result={...segment};for(const key of ['from','to','control1','control2'])if(segment[key])result[key]=point(segment[key],p);return result;})})));
}
// Trusted, generated markings for buildable starting-grid variants.
// Reuse these in the canvas, print report and portable picture renderer.
function surfaceMarkings(def,print=false){
 const p=def.parameters;if(p.type==='reference'){const label=Math.max(8,Math.min(p.widthMm/8,p.lengthMm/10)),image=def.referenceImage?`<image href="${G.attrs(def.referenceImage)}" width="${p.lengthMm}" height="${p.widthMm}" preserveAspectRatio="none"/>`:'';return image+`<path d="${def.geometry.outlineSvgPath}" fill="none" stroke="${print?'#555':'#d6b163'}" stroke-width="2" stroke-dasharray="8 5"/><text x="4" y="${label+3}" font-size="${label}" fill="${print?'#333':'#ffd38b'}" stroke="${print?'#fff':'#171c23'}" stroke-width="1" paint-order="stroke">REFERENCE</text>`;}if(p.type!=='straight')return '';
 const ninco=def.family.includes('ninco')&&def.sku==='10114',scalextric=def.family.includes('scalextric')&&def.sku==='C7018';
 if(ninco||scalextric){const width=ninco?180:156,length=ninco?200:175,stroke=print?'#555555':'#eeeee5',mark=ninco?48:42;let body=`<g data-artwork="${ninco?'ninco':'scalextric'}-start-grid" transform="scale(${p.lengthMm/length} ${p.widthMm/width})">`;for(const[x,y]of(ninco?[[35,45],[110,135]]:[[35,39],[105,117]]))body+=G.path(`M ${x} ${y-24} h ${mark} v 48 h ${-mark}`,'none',stroke,2);if(ninco)body+=G.path('M 0 90 H 200','none',stroke,2,'stroke-dasharray="24 17"');return body+'</g>';}
 if(!def.family.includes('scaleauto')||!['SC-10001C','SC-10001D'].includes(def.sku))return '';
 const light=print?'#f5f5f5':'#e5e7df',dark=print?'#333333':'#343d3a';
 let body=`<g data-artwork="scaleauto-start-grid" transform="scale(${p.lengthMm/400} ${p.widthMm/200})"><rect x="28" y="0" width="20" height="200" fill="${light}"/>`;
 for(let y=0;y<200;y+=20)for(let i=0;i<2;i++)if((y/20+i)%2===0)body+=`<rect x="${28+i*10}" y="${y}" width="10" height="20" fill="${dark}"/>`;
 body+=G.path('M 54 0 V 200 M 94 0 V 200','none',print?'#777777':'#e38324',2)+`<rect x="60" y="75" width="27" height="50" fill="${print?'#bbbbbb':'#454e49'}"/>`;
 for(const[x,y]of[[130,50],[230,150]])body+=G.path(`M ${x} ${y-29} H ${x+80} V ${y+29} H ${x}`,'none',light,2)+G.path(`M ${x-8} ${y} h 16`,'none',print?'#777777':'#e3d851',2);
 if(def.sku==='SC-10001D')body+=`<rect x="63" y="77" width="21" height="46" fill="${print?'#999999':'#4f8a6d'}"/>`;
 return body+'</g>';
}
// SVG paints in array order. Keep the relative order within each group intact.
function arrange(items,selectedIds,position){
 const selected=new Set(selectedIds),chosen=items.filter(p=>selected.has(p.id)),rest=items.filter(p=>!selected.has(p.id));
 return position==='front'?[...rest,...chosen]:position==='back'?[...chosen,...rest]:items.slice();
}
function shortcut(e){
 const key=e.key.toLowerCase();
 if(e.altKey)return null;
 if(e.ctrlKey||e.metaKey)return({a:'selectAll',z:e.shiftKey?'redo':'undo',y:'redo',d:'duplicate',s:'save'})[key]||null;
 return({r:e.shiftKey?'rotateBack':'rotate',m:'mirror',delete:'remove',backspace:'remove',escape:'escape'})[key]||null;
}
function animationLoop(request,cancel,render){
 let active=false,handle=null;
 const tick=t=>{handle=null;if(!active)return;render(t);if(active)handle=request(tick);};
 return{start(){if(active)return;active=true;handle=request(tick);},stop(){active=false;if(handle!==null)cancel(handle);handle=null;}};
}
function worldSegments(route,items,defs){
 const byId=new Map(items.map(p=>[p.id,p]));
 return route.sections.flatMap(section=>{
  const placement=byId.get(section.pieceId),lane=defs[placement.definitionId].geometry.lanePaths[section.laneIndex];
  return lane.segments.map(segment=>{
   if(segment.type==='line')return{type:'line',from:point(section.reverse?segment.to:segment.from,placement),to:point(section.reverse?segment.from:segment.to,placement),lengthMm:section.lengthMm};
   let startAngleDeg=direction(segment.startAngleDeg,placement),sweepDeg=segment.sweepDeg*(placement.flip?-1:1);
   if(section.reverse){startAngleDeg+=sweepDeg;sweepDeg=-sweepDeg;}
   return{type:'arc',center:point(segment.center,placement),radiusMm:segment.radiusMm,startAngleDeg,sweepDeg,lengthMm:section.lengthMm};
  });
 });
}

return{surfaceMarkings,arrange,alternateRoutes,planBorders,mergeDefinitions,shortcut,animationLoop,worldSegments,slotsMatch,G,rad,deg,dist,wrap,uid,point,direction,pose,ports,compatible,join,connections,snap,outline,bounds,repositionGroup,inSelectionBox,routes,at,presets,speedPlan,validateDefinition,validateLayout};
});
