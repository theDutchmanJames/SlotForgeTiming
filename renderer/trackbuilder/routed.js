(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./geometry.cjs'),require('./routed-spline.js'),require('./table-shape.js'));else root.RoutedTracks=factory(root.Geometry,root.RoutedSpline,root.TableShape);})(typeof globalThis!=='undefined'?globalThis:this,function(G,S,T){
'use strict';
const ID='slotforge.routed',FAMILY='slotforge.routed.v1';
const defaults={laneCount:2,laneSpacingMm:100,innerClearanceMm:100,outerClearanceMm:100,slotWidthMm:3.2,slotDepthMm:8,conductor:'braid',conductorWidthMm:6,conductorGapMm:1,conductorThicknessMm:.5,adhesiveThicknessMm:.1,recessDepthMm:.8,boardThicknessMm:12,minRadiusMm:250,allowancePct:10};
const limits={laneSpacingMm:[10,300],innerClearanceMm:[10,1000],outerClearanceMm:[10,1000],slotWidthMm:[.5,10],slotDepthMm:[1,30],conductorWidthMm:[1,20],conductorGapMm:[0,15],conductorThicknessMm:[.01,5],adhesiveThicknessMm:[0,3],recessDepthMm:[0,8],boardThicknessMm:[3,50],minRadiusMm:[10,3000],allowancePct:[0,100]};
function settings(raw=defaults){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid routed-track profile.');
 const s={};if(raw.constructionMode!==undefined&&!['sections','table'].includes(raw.constructionMode))throw Error('Choose Individual piece or Tabletop routing.');if(raw.constructionMode==='table')s.constructionMode='table';s.laneCount=raw.laneCount??defaults.laneCount;if(!Number.isInteger(s.laneCount)||s.laneCount<1||s.laneCount>8)throw Error('Choose 1–8 routed lanes.');
 for(const[k,[lo,hi]]of Object.entries(limits)){const v=raw[k]??defaults[k];if(!Number.isFinite(v)||v<lo||v>hi)throw Error(k+' must be between '+lo+' and '+hi+'.');s[k]=v;}
 s.conductor=raw.conductor??defaults.conductor;if(!['braid','tape'].includes(s.conductor))throw Error('Choose braid or copper tape.');
 if(s.slotDepthMm>=s.boardThicknessMm||s.recessDepthMm>=s.boardThicknessMm)throw Error('Slot and recess depths must be less than the board thickness.');
 const half=s.slotWidthMm/2+s.conductorGapMm+s.conductorWidthMm;
 if(s.constructionMode!=='table'&&Math.min(s.innerClearanceMm,s.outerClearanceMm)<=half)throw Error('Edge clearance must contain the complete slot and conductor.');
 if(s.laneCount>1&&s.laneSpacingMm<=2*half)throw Error('Lane spacing must leave room between adjacent conductors.');
 return s;
}
function workspace(raw){if(raw==null)return{settings:settings(),display:'surface'};if(typeof raw!=='object'||Array.isArray(raw)||!['surface','conductors','slots'].includes(raw.display??'surface'))throw Error('Invalid routed workspace.');return{settings:settings(raw.settings),display:raw.display??'surface'};}
function width(s){const edges=S.clearances(s);return(s.laneCount-1)*s.laneSpacingMm+edges.first+edges.last;}
function parameters(s,shape={type:'straight',lengthMm:1000}){
 s=settings(s);if(shape?.squeeze!==undefined&&shape.type!==S.TYPE)throw Error('Squeeze requires a flowing routed section.');if(!shape||!['straight','curve',S.TYPE].includes(shape.type))throw Error('Choose a routed straight, circular corner or flowing curve.');
 const p={type:shape.type,widthMm:width(s),laneOffsetsMm:Array.from({length:s.laneCount},(_,i)=>S.clearances(s).first+i*s.laneSpacingMm),routed:s};
 if(shape.type===S.TYPE){p.controlPointsMm=S.curve(shape.controlPointsMm);if(shape.squeeze!==undefined)p.squeeze=S.squeezeSettings(shape.squeeze,s);S.validate(p);return p;}if(shape.type==='straight')p.lengthMm=shape.lengthMm;else{if(!Number.isFinite(shape.slotRadiusMm)||shape.slotRadiusMm<=S.clearances(s).first)throw Error(s.constructionMode==='table'?'The innermost slot radius must leave room for its slot and conductor.':'The innermost slot radius must exceed the inner clearance.');p.innerRadiusMm=shape.slotRadiusMm-S.clearances(s).first;p.angleDeg=shape.angleDeg;}
 G.derive(p);if((p.lengthMm||p.innerRadiusMm)>10000||p.widthMm>10000)throw Error('Routed dimensions must not exceed 10,000 mm.');return p;
}
function validateParameters(p){
 const s=settings(p.routed);if(p.squeeze!==undefined&&p.type!==S.TYPE)throw Error('Squeeze requires a flowing routed section.');if(!['straight','curve',S.TYPE].includes(p.type)||p.laneChange)throw Error('Routed sections support straight, circular and flowing through-slots.');
 const expected=parameters(s,p.type===S.TYPE?{type:S.TYPE,controlPointsMm:p.controlPointsMm,...(p.squeeze!==undefined?{squeeze:p.squeeze}:{})}:p.type==='straight'?{type:'straight',lengthMm:p.lengthMm}:{type:'curve',slotRadiusMm:p.innerRadiusMm+S.clearances(s).first,angleDeg:p.angleDeg});
 const offsets=G.resolve(p).laneOffsetsMm;
 if(Math.abs(expected.widthMm-p.widthMm)>1e-6||offsets.length!==expected.laneOffsetsMm.length||offsets.some((v,i)=>Math.abs(v-expected.laneOffsetsMm[i])>1e-6))throw Error('Routed profile disagrees with the surface width or slot offsets.');return s;
}
function geometry(p){if(p.type===S.TYPE)return S.geometry(p);const g=G.derive(p);for(const c of g.connectors){const ps=c.lanes.map(l=>l.position);c.position=[(ps[0][0]+ps.at(-1)[0])/2,(ps[0][1]+ps.at(-1)[1])/2];}return g;}
function definition(s,shape,id='routed:section',name){const p=parameters(s,shape);return{id,name:name||(p.type===S.TYPE?'Routed flowing curve':p.type==='straight'?'Routed straight · '+p.lengthMm+' mm':'Routed corner · R'+shape.slotRadiusMm+' / '+p.angleDeg+'°'),sku:'',pack:'Routed wood',family:FAMILY,parameters:p,geometry:geometry(p),color:'#b59870',status:'user-defined',mirror:true};}
function pack(s){s=settings(s);const base=Math.max(300,s.innerClearanceMm+50);return{id:ID,name:'Routed wood',gallery:'#routed',pieces:[1000,500,250].map(lengthMm=>definition(s,{type:'straight',lengthMm},'routed:template-straight-'+lengthMm)).concat([base,base+150,base+300].flatMap(slotRadiusMm=>[45,90].map(angleDeg=>definition(s,{type:'curve',slotRadiusMm,angleDeg},'routed:template-curve-'+slotRadiusMm+'-'+angleDeg)))).concat(['bend','s-bend','transition'].map(name=>definition(s,{type:S.TYPE,controlPointsMm:S.preset(name,s)},'routed:template-'+name,name==='s-bend'?'Routed S-bend':name==='transition'?'Routed straight transition':'Routed sweeping corner'))),trackSystem:'routed'};}
function draw(d,print=false,mode='surface'){
 const p=d.parameters,s=p.routed,g=d.geometry;
 let body=G.path(g.outlineSvgPath,s.constructionMode==='table'?'transparent':print?'#f4f1e9':mode==='surface'?d.color:'transparent',s.constructionMode==='table'?'none':print?'#777':mode==='surface'?'#847052':'none',.8);
 if(p.type==='freeform')return (typeof module==='object'&&module.exports?require('./freeform.js'):globalThis.FreeForm).draw(d,print,mode);if(p.type===S.TYPE){for(const [i,lane]of g.lanePaths.entries()){if(mode!=='slots'||print)for(const d of g.conductors[i])body+=G.path(d,'none',print?'#a8a8a0':s.conductor==='braid'?'#b8b9ad':'#b77844',s.conductorWidthMm);body+=G.path(lane.d,'none',print?'#262626':'#272522',s.slotWidthMm);}return body;}
 const centerPath=offset=>p.type==='straight'?`M 0 ${offset} H ${p.lengthMm}`:`M 0 ${-(p.innerRadiusMm+offset)} A ${p.innerRadiusMm+offset} ${p.innerRadiusMm+offset} 0 0 1 ${G.pt(p.innerRadiusMm+offset,p.angleDeg*Math.PI/180)}`;
 for(const offset of p.laneOffsetsMm){
  if(mode!=='slots'||print){const delta=s.slotWidthMm/2+s.conductorGapMm+s.conductorWidthMm/2;for(const sign of[-1,1])body+=G.path(centerPath(offset+sign*delta),'none',print?'#a8a8a0':s.conductor==='braid'?'#b8b9ad':'#b77844',s.conductorWidthMm);}
  body+=G.path(centerPath(offset),'none',print?'#262626':'#272522',s.slotWidthMm);
 }
 return body;
}
function materials(items,defs){
 const routed=items.filter(p=>defs[p.definitionId].parameters.routed),lanes=new Map();let tableRoutingSections=0,slotMm=0,braidMm=0,tapeMm=0,orderBraidMm=0,orderTapeMm=0,areaMm2=0;
 for(const item of routed){const d=defs[item.definitionId],p=d.parameters,s=p.routed,total=d.geometry.lanePaths.reduce((n,l)=>n+l.lengthMm,0);slotMm+=total;const metal=d.geometry.conductorLengthMm??2*total,order=metal*(1+s.allowancePct/100);if(s.conductor==='braid'){braidMm+=metal;orderBraidMm+=order;}else{tapeMm+=metal;orderTapeMm+=order;}
  if(s.constructionMode==='table')tableRoutingSections++;else areaMm2+=p.type===S.TYPE?d.geometry.surfaceAreaMm2:p.type==='straight'?p.lengthMm*p.widthMm:Math.PI*p.angleDeg/360*((p.innerRadiusMm+p.widthMm)**2-p.innerRadiusMm**2);
  for(const [i,l]of d.geometry.lanePaths.entries()){const k='Section lane '+(i+1);lanes.set(k,(lanes.get(k)||0)+l.lengthMm);}
 }
 return{sections:routed.length,tableRoutingSections,slotMm,braidMm,tapeMm,orderBraidMm,orderTapeMm,sectionAreaMm2:areaMm2,localLaneTotals:[...lanes].map(([label,lengthMm])=>({label,lengthMm}))};
}
function tableBounds(bounds,g){if(!g||g.kind!=='table')return bounds;const x=Math.min(bounds[0],g.x),y=Math.min(bounds[1],g.y);return[x,y,Math.max(bounds[0]+bounds[2],g.x+g.lengthMm)-x,Math.max(bounds[1]+bounds[3],g.y+g.widthMm)-y];}
function drawTable(g,print=false){return g?.kind==='table'?`<g data-table="routed"><path d="${T.path(g)}" fill="${print?'#fcfaf5':'#dbc8a6'}" stroke="${print?'#aaa':'#a38c66'}" stroke-width="2"/><text x="${g.x+15}" y="${g.y+32}" font-size="20" fill="#655945">Table · ${T.description(g)}</text></g>`:'';}
function shapeOf(p){return p.type===S.TYPE?{type:S.TYPE,controlPointsMm:p.controlPointsMm.map(v=>v.slice()),...(p.squeeze!==undefined?{squeeze:structuredClone(p.squeeze)}:{})}:p.type==='straight'?{type:'straight',lengthMm:p.lengthMm}:{type:'curve',slotRadiusMm:p.innerRadiusMm+S.clearances(p.routed).first,angleDeg:p.angleDeg};}
function minimumRadii(d){return [S.TYPE,'freeform'].includes(d.parameters.type)?d.geometry.minRadiiMm:d.parameters.type==='curve'?d.geometry.lanePaths.map(l=>l.segments[0].radiusMm):d.geometry.lanePaths.map(()=>null);}
// Circles number lanes from inside out. A negative reference turn plus the
// opposite placement reflection preserves those lane and edge assignments.
function flowingFromCurve(s,shape,flip=false){s=settings(s);parameters(s,shape);const radius=shape.slotRadiusMm+(s.laneCount-1)*s.laneSpacingMm/2,a=shape.angleDeg*Math.PI/180,k=4/3*Math.tan(a/4),end=[radius*Math.sin(a),-radius*(1-Math.cos(a))],next={type:S.TYPE,controlPointsMm:[[0,0],[radius*k,0],[end[0]-radius*k*Math.cos(a),end[1]+radius*k*Math.sin(a)],end]};parameters(s,next);return{shape:next,flip:!flip};}
return{Table:T,Spline:S,ID,FAMILY,defaults,limits,settings,workspace,width,parameters,validateParameters,geometry,definition,pack,draw,materials,tableBounds,drawTable,shapeOf,minimumRadii,flowingFromCurve};
});
