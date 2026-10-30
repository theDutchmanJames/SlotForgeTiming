(()=>{
// Geometry authoring utilities, not an application/editor.
// Coordinates are mm; +x right, +y down. Curves turn clockwise for positive angles.
const n=v=>Number(v.toFixed(6));
const pt=(r,t)=>[n(r*Math.sin(t)),n(-r*Math.cos(t))];
const attrs=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function positive(v,name){if(!Number.isFinite(v)||v<=0)throw Error(`${name} must be a positive finite number`);}
function resolve(input){const p=structuredClone(input);if(p.type==='reference')return p;if(typeof p.type!=='string')throw Error('A dimension template type is required');if(p.laneOffsetsMm!==undefined){if(p.laneCount!==undefined&&p.laneCount!==p.laneOffsetsMm.length)throw Error('laneCount disagrees with explicit offsets');if(p.laneSpacingMm!==undefined)throw Error('Use either explicit lane offsets or uniform lane spacing');}if(!p.type.endsWith('border')&&p.laneOffsetsMm===undefined){if(!Number.isInteger(p.laneCount)||p.laneCount<1||p.laneCount>16)throw Error('laneCount must be an integer from 1 to 16');if(p.laneCount>1)positive(p.laneSpacingMm,'laneSpacingMm');const span=(p.laneCount-1)*(p.laneSpacingMm||0),margin=p.edgeMarginMm??(p.widthMm-span)/2;p.laneOffsetsMm=Array.from({length:p.laneCount},(_,i)=>margin+i*(p.laneSpacingMm||0));delete p.laneSpacingMm;}return p;}
function validate(p){
 if(p.type==='reference'){positive(p.widthMm,'widthMm');positive(p.lengthMm,'lengthMm');return p;}
 if(!['straight','curve','straight-border','curve-border'].includes(p.type))throw Error('Unsupported dimension template');
 positive(p.widthMm,'widthMm');
 if(p.type.startsWith('straight'))positive(p.lengthMm,'lengthMm');
 if(p.type.startsWith('curve')){positive(p.innerRadiusMm,'innerRadiusMm');positive(p.angleDeg,'angleDeg');if(p.angleDeg>180)throw Error('Use multiple segments for angles above 180 degrees');}
 if(!p.type.endsWith('border')){if(!Array.isArray(p.laneOffsetsMm)||!p.laneOffsetsMm.length)throw Error('Provide explicit lane offsets from the inner/top edge');let prev=0;for(const y of p.laneOffsetsMm){positive(y,'lane offset');if(y<=prev||y>=p.widthMm)throw Error('Lane offsets must be ordered, distinct and inside the surface');prev=y;}}
 if(p.type.endsWith('border')&&!['inner','outer'].includes(p.side))throw Error('Border side must be inner or outer');
 if(p.laneChange!==undefined){
  if(p.type!=='straight'||!['left','right','both'].includes(p.laneChange)||p.laneOffsetsMm.length!==2)throw Error('Lane changers need a straight surface and exactly two lanes');
  if(!Number.isFinite(p.switchStartMm)||!Number.isFinite(p.switchEndMm)||p.switchStartMm<0||p.switchEndMm>p.lengthMm||p.switchEndMm-p.switchStartMm<.01)throw Error('Switch start must be before switch end, both within the piece length');
 }
 return p;
}
function switchingPaths(p){
 if(!p.laneChange)return[];
 const pairs=p.laneChange==='both'?[[0,1],[1,0]]:p.laneChange==='left'?[[1,0]]:[[0,1]];
 return pairs.map(([fromLaneIndex,toLaneIndex])=>{
  const y0=p.laneOffsetsMm[fromLaneIndex],y1=p.laneOffsetsMm[toLaneIndex],x0=p.switchStartMm,x1=p.switchEndMm,mid=(x0+x1)/2;
  const from=[x0,y0],control1=[mid,y0],control2=[mid,y1],to=[x1,y1];
  // Adaptive Simpson integration of the cubic derivative gives the route
  // length without substituting the straight-line distance between slots.
  const speed=t=>Math.hypot(3*(1-t)**2*(mid-x0)+3*t*t*(x1-mid),6*(1-t)*t*(y1-y0));
  const integrate=(a,b,fa,fm,fb,whole,epsilon,depth)=>{const m=(a+b)/2,l=speed((a+m)/2),r=speed((m+b)/2),left=(m-a)*(fa+4*l+fm)/6,right=(b-m)*(fm+4*r+fb)/6,delta=left+right-whole;return depth===0||Math.abs(delta)<15*epsilon?left+right+delta/15:integrate(a,m,fa,l,fm,left,epsilon/2,depth-1)+integrate(m,b,fm,r,fb,right,epsilon/2,depth-1);};
  const fa=speed(0),fm=speed(.5),fb=speed(1),switchLength=integrate(0,1,fa,fm,fb,(fa+4*fm+fb)/6,1e-6,14);
  const switchSvgPath=`M ${from} C ${control1} ${control2} ${to}`;
  return{id:`change-${fromLaneIndex+1}-to-${toLaneIndex+1}`,fromLaneIndex,toLaneIndex,start:[0,y0],end:[p.lengthMm,y1],switchSvgPath,d:`M 0 ${y0} L ${from} C ${control1} ${control2} ${to} L ${p.lengthMm} ${y1}`,lengthMm:x0+switchLength+p.lengthMm-x1,segments:[{type:'line',from:[0,y0],to:from,lengthMm:x0},{type:'cubic',from,control1,control2,to,lengthMm:switchLength},{type:'line',from:to,to:[p.lengthMm,y1],lengthMm:p.lengthMm-x1}].filter(s=>s.lengthMm>0)};
 });
}
function derive(input){const p=validate(resolve(input));if(p.type==='reference')return{outlineSvgPath:`M 0 0 H ${p.lengthMm} V ${p.widthMm} H 0 Z`,boundsMm:[0,0,p.lengthMm,p.widthMm],lanePaths:[],connectors:[],centrelineLengthMm:0};const isCurve=p.type.startsWith('curve'),isBorder=p.type.endsWith('border');let outline,paths=[],bounds,connectors=[];const w=p.widthMm;
 if(!isCurve){outline=`M 0 0 H ${p.lengthMm} V ${w} H 0 Z`;bounds=[0,0,p.lengthMm,w];if(!isBorder){paths=p.laneOffsetsMm.map((y,i)=>({id:`lane-${i+1}`,start:[0,y],end:[p.lengthMm,y],segments:[{type:'line',from:[0,y],to:[p.lengthMm,y]}],lengthMm:p.lengthMm,d:`M 0 ${y} H ${p.lengthMm}`}));connectors=[{id:'a',position:[0,w/2],outwardAngleDeg:180},{id:'b',position:[p.lengthMm,w/2],outwardAngleDeg:0}];}}
 else {const r=p.innerRadiusMm,ro=r+w,a=p.angleDeg*Math.PI/180;const [ox,oy]=pt(ro,a),[ix,iy]=pt(r,a);outline=`M 0 ${-ro} A ${ro} ${ro} 0 0 1 ${ox} ${oy} L ${ix} ${iy} A ${r} ${r} 0 0 0 0 ${-r} Z`;const xs=[0,ox,ix];if(p.angleDeg>=90)xs.push(ro);const ys=[-ro,-r,oy,iy];bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)];if(!isBorder){paths=p.laneOffsetsMm.map((y,i)=>{const lr=r+y;return{id:`lane-${i+1}`,start:pt(lr,0),end:pt(lr,a),segments:[{type:'arc',center:[0,0],radiusMm:lr,startAngleDeg:-90,sweepDeg:p.angleDeg}],lengthMm:lr*a,d:`M 0 ${-lr} A ${lr} ${lr} 0 0 1 ${pt(lr,a)}`}});connectors=[{id:'a',position:pt(r+w/2,0),outwardAngleDeg:180},{id:'b',position:pt(r+w/2,a),outwardAngleDeg:p.angleDeg}];}}
 for(const c of connectors)c.lanes=paths.map(l=>({pathId:l.id,position:c.id==='a'?l.start:l.end}));
 return{outlineSvgPath:outline,boundsMm:bounds,lanePaths:paths,connectors,centrelineLengthMm:isBorder?0:isCurve?(p.innerRadiusMm+w/2)*p.angleDeg*Math.PI/180:p.lengthMm,...(p.laneChange?{alternateLanePaths:switchingPaths(p),previewRouting:'straight-through-only'}:{})};
}
const defs='<defs><pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#242425"/><circle cx="1" cy="2" r=".5" fill="#363638"/><circle cx="5" cy="6" r=".45" fill="#171719"/></pattern></defs>';
const path=(d,fill='none',stroke='none',width=1,extra='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
const rail=d=>path(d,'none','#858b90',10)+path(d,'none','#d9dbdc',7)+path(d,'none','#0b0c0e',2.8);
function render(input){const p=resolve(input),g=derive(p),border=p.type.endsWith('border');let body=path(g.outlineSvgPath,'url(#grain)','#676a6e');if(!border){for(const lane of g.lanePaths)body+=rail(lane.d);for(let i=0;i<p.laneOffsetsMm.length-1;i++){const y=(p.laneOffsetsMm[i]+p.laneOffsetsMm[i+1])/2;const d=p.type==='straight'?`M 0 ${y} H ${p.lengthMm}`:`M 0 ${-(p.innerRadiusMm+y)} A ${p.innerRadiusMm+y} ${p.innerRadiusMm+y} 0 0 1 ${pt(p.innerRadiusMm+y,p.angleDeg*Math.PI/180)}`;body+=path(d,'none','#e8e6e1',2.5,'stroke-dasharray="26 20"');}}
 else {const k=Math.min(23,p.widthMm);if(p.type==='straight-border'){const y=p.side==='outer'?0:p.widthMm-k;for(let x=0,i=0;x<p.lengthMm;x+=28,i++)body+=`<rect x="${x}" y="${y}" width="${Math.min(28,p.lengthMm-x)}" height="${k}" fill="${i%2?'#eeeae4':'#d52b32'}"/>`;}
 else {const kr=p.side==='outer'?p.innerRadiusMm:p.innerRadiusMm+p.widthMm-k;const angle=p.angleDeg*Math.PI/180,N=Math.max(2,Math.ceil((kr+k/2)*angle/28));for(let i=0;i<N;i++){const a=i*angle/N,b=(i+1)*angle/N;body+=path(`M ${pt(kr+k,a)} A ${kr+k} ${kr+k} 0 0 1 ${pt(kr+k,b)} L ${pt(kr,b)} A ${kr} ${kr} 0 0 0 ${pt(kr,a)} Z`,i%2?'#eeeae4':'#d52b32');}}}
 for(const route of g.alternateLanePaths||[])body+=rail(route.switchSvgPath);
 return{...g,body};
}
function svg(body,bounds,title,description=''){const [x,y,w,h]=bounds;return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x-6} ${y-6} ${w+12} ${h+12}" role="img"><title>${attrs(title)}</title><desc>${attrs(description)}</desc>${defs}${body}</svg>`;}

window.Geometry={validate,resolve,derive,render,svg,path,rail,pt,defs,attrs};
})();
