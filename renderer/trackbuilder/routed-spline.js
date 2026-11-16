(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RoutedSpline=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// A cubic describes the middle of the slot bundle. All slots and verges are
// evaluated on its unit normal, never by scaling the cubic's control points.
const TYPE='routed-spline',EPS=.025,rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function clearances(s){const metal=s.slotWidthMm/2+s.conductorGapMm+s.conductorWidthMm;return s.constructionMode==='table'?{first:metal,last:metal}:{first:s.innerClearanceMm,last:s.outerClearanceMm};}
function curve(raw){
 if(!Array.isArray(raw)||raw.length!==4||raw.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||Math.abs(v)>10000)))throw Error('A flowing curve needs four finite control points within ±10,000 mm.');
 const points=raw.map(p=>p.slice());if(distance(points[0],[0,0])>1e-9)throw Error('The flowing curve must start at its local origin.');
 if(distance(points[0],points[1])<1||distance(points[2],points[3])<1||distance(points[0],points[3])<1)throw Error('Separate the ends and give both direction handles at least 1 mm of length.');return points;
}
function evaluate(c,t){
 const u=1-t,p=[0,1].map(i=>u*u*u*c[0][i]+3*u*u*t*c[1][i]+3*u*t*t*c[2][i]+t*t*t*c[3][i]);
 const v=[0,1].map(i=>3*u*u*(c[1][i]-c[0][i])+6*u*t*(c[2][i]-c[1][i])+3*t*t*(c[3][i]-c[2][i]));
 const a=[0,1].map(i=>6*u*(c[2][i]-2*c[1][i]+c[0][i])+6*t*(c[3][i]-2*c[2][i]+c[1][i]));
 const speed=Math.hypot(...v);if(speed<.001)throw Error('The curve doubles back to a stationary point. Move its handles apart.');
 const jerk=[0,1].map(i=>6*(c[3][i]-3*c[2][i]+3*c[1][i]-c[0][i])),crossVA=v[0]*a[1]-v[1]*a[0];
 return{t,p,speed,normal:[-v[1]/speed,v[0]/speed],heading:deg(Math.atan2(v[1],v[0])),curvature:crossVA/speed**3,curvatureDerivative:(v[0]*jerk[1]-v[1]*jerk[0])/speed**4-3*crossVA*(v[0]*a[0]+v[1]*a[1])/speed**6};
}
const offset=(q,d)=>[q.p[0]+q.normal[0]*d,q.p[1]+q.normal[1]*d];
const path=points=>'M '+points.map(p=>p.map(v=>Number(v.toFixed(6))).join(' ')).join(' L ');
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function intersects(a,b,c,d){
 if(Math.max(a[0],b[0])<Math.min(c[0],d[0])-1e-7||Math.max(c[0],d[0])<Math.min(a[0],b[0])-1e-7||Math.max(a[1],b[1])<Math.min(c[1],d[1])-1e-7||Math.max(c[1],d[1])<Math.min(a[1],b[1])-1e-7)return false;
 return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;
}
function simple(poly,closed){const n=poly.length-(closed?0:1);for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(closed&&i===0&&j===n-1)continue;if(intersects(poly[i],poly[(i+1)%poly.length],poly[j],poly[(j+1)%poly.length]))return false;}return true;}
function samples(c,lo,hi,s){
 const cache=new Map(),at=t=>{if(!cache.has(t))cache.set(t,evaluate(c,t));return cache.get(t);};
 // Dense curvature checks catch folds between visible handles. Adaptive normal
 // sampling then bounds drawing/chord error and avoids speed jumps at vertices.
 let worst=null;for(let i=0;i<=2048;i++){const q=at(i/2048);for(const [side,d]of [['first',lo],['last',hi]]){const factor=1-d*q.curvature;if(!worst||factor<worst.factor)worst={side,offsetMm:d,factor,t:q.t,curvature:q.curvature};}}
 if(worst.factor<=.002){const lane=worst.side==='first'?1:s.laneCount,edges=clearances(s),clearanceMm=worst.side==='first'?edges.first:edges.last,slotRadiusMm=1/Math.abs(worst.curvature)-(s.laneCount-1)*s.laneSpacingMm/2,kind=slotRadiusMm<=0?'slot':s.constructionMode==='table'?'conductor':'surface',message=kind==='slot'?`Lane ${lane} folds inside this bend. Widen the curve or reduce lane spacing.`:kind==='conductor'?`The conductor beside Lane ${lane} pinches or folds inside this bend. Widen the curve or reduce lane spacing; tabletop routing still needs room for the slot and conductor.`:`The piece edge beyond Lane ${lane} pinches or folds: the slot radius there is ${slotRadiusMm.toFixed(1)} mm, but that edge clearance is ${clearanceMm} mm. Widen the curve, shorten this clearance, or choose Tabletop routing if this section belongs to one continuous board.`;const error=Error(message);error.code='ROUTED_OFFSET_FOLD';error.fold={...worst,lane,clearanceMm,slotRadiusMm,kind};throw error;}
 const out=[at(0)];
 function split(a,b,depth){
  const mid=(a.t+b.t)/2,m=at(mid);let error=0;
  for(const d of[lo,0,hi]){const pa=offset(a,d),pb=offset(b,d);for(const f of[.25,.5,.75]){const q=offset(at(a.t+(b.t-a.t)*f),d);error=Math.max(error,distance(q,[pa[0]+(pb[0]-pa[0])*f,pa[1]+(pb[1]-pa[1])*f]));}}
  const turn=Math.max(Math.abs(Math.atan2(Math.sin(rad(m.heading-a.heading)),Math.cos(rad(m.heading-a.heading)))),Math.abs(Math.atan2(Math.sin(rad(b.heading-m.heading)),Math.cos(rad(b.heading-m.heading)))));
  if(b.t-a.t>1/32||error>EPS||turn>rad(1)){if(depth===0)throw Error('This curve is too complex to sample accurately. Spread its handles.');split(a,m,depth-1);split(m,b,depth-1);}else out.push(b);
 }
 split(at(0),at(1),14);if(out.length>4097)throw Error('Use shorter sections for this flowing curve.');return out;
}
function polyline(qs,d){
 const points=qs.map(q=>offset(q,d)),distancesMm=[0];for(let i=1;i<points.length;i++)distancesMm.push(distancesMm[i-1]+distance(points[i-1],points[i]));
 return{type:'polyline',samplingTargetMm:EPS,points,distancesMm,headingsDeg:qs.map(q=>q.heading),curvaturesPerMm:qs.map(q=>q.curvature/(1-d*q.curvature)),lengthMm:distancesMm.at(-1)};
}
const cache=new Map();
function derive(p){
 const key=JSON.stringify([p.controlPointsMm,p.routed,p.squeeze,p.referenceOffsetMm,p.deferIntersections,p.squeezeDomain]);if(cache.has(key))return cache.get(key);
 if(p.squeeze!==undefined){const g=squeezed(p);if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,g);return g;}
 const c=curve(p.controlPointsMm),s=p.routed,edges=clearances(s),span=(s.laneCount-1)*s.laneSpacingMm,shift=p.referenceOffsetMm||0,lo=-span/2-edges.first+shift,hi=span/2+edges.last+shift,qs=samples(c,lo,hi,s),reference=polyline(qs,0),fractions=reference.distancesMm.map(d=>d/reference.lengthMm);
 const first=qs.map(q=>offset(q,lo)),last=qs.map(q=>offset(q,hi)),outline=first.concat(last.slice().reverse());
 if(!p.deferIntersections&&!simple(outline,true))throw Error('The flowing surface crosses itself. Separate its ends or spread its handles.');
 const lanePaths=Array.from({length:s.laneCount},(_,i)=>{const d=-span/2+i*s.laneSpacingMm+shift,segment={...polyline(qs,d),referenceFractions:fractions};if(!p.deferIntersections&&!simple(segment.points,false))throw Error('A slot crosses itself. Open up this curve.');return{id:'lane-'+(i+1),start:segment.points[0],end:segment.points.at(-1),segments:[segment],lengthMm:segment.lengthMm,d:path(segment.points)};});
 const conductors=lanePaths.map((l,i)=>{const d=-span/2+i*s.laneSpacingMm+shift,delta=s.slotWidthMm/2+s.conductorGapMm+s.conductorWidthMm/2;return[-1,1].map(sign=>path(qs.map(q=>offset(q,d+sign*delta))));});
 const minRadiiMm=lanePaths.map((l,i)=>{const d=-span/2+i*s.laneSpacingMm+shift;let max=0;for(let j=0;j<=2048;j++){const k=evaluate(c,j/2048).curvature;max=Math.max(max,Math.abs(k/(1-d*k)));}return max?1/max:null;});
 const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);let area=0;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];area+=a[0]*b[1]-b[0]*a[1];}
 const g={outlineSvgPath:path(outline)+' Z',sampledOutline:outline,boundsMm:[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)],lanePaths,centrelineLengthMm:polyline(qs,(lo+hi)/2).lengthMm,reference,parametersT:qs.map(q=>q.t),conductors,minRadiiMm,surfaceAreaMm2:Math.abs(area)/2,samplingToleranceMm:EPS,connectors:[{id:'a',position:[0,0],outwardAngleDeg:qs[0].heading+180},{id:'b',position:c[3].slice(),outwardAngleDeg:qs.at(-1).heading}]};
 for(const port of g.connectors)port.lanes=lanePaths.map(l=>({pathId:l.id,position:port.id==='a'?l.start:l.end}));
 if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,g);return g;
}
// Both squeeze profiles use reference arc length, with zero first and second
// derivatives at the section ends. Legacy ramps retain their exact behaviour.
function squeezeSettings(raw,s){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||![1,2].includes(raw.version))throw Error('Unsupported or malformed routed squeeze settings.');
 const apex=raw.version===2,keys=apex?['version','shape','spacingMm','anchorLane']:['version','spacingMm','transitionMm','anchorLane'];
 if(Object.keys(raw).some(k=>!keys.includes(k))||apex&&raw.shape!=='apex')throw Error('Unsupported or malformed routed squeeze settings.');
 if(s.laneCount<2)throw Error('Squeeze needs at least two lanes.');
 const metal=s.slotWidthMm/2+s.conductorGapMm+s.conductorWidthMm;
 if(!Number.isFinite(raw.spacingMm)||raw.spacingMm<=2*metal||raw.spacingMm>s.laneSpacingMm)throw Error('Squeezed spacing must leave room between conductors and must not exceed the normal slot spacing.');
 if(!apex&&(!Number.isFinite(raw.transitionMm)||raw.transitionMm<10||raw.transitionMm>10000))throw Error('Squeeze transition length must be between 10 and 10,000 mm.');
 if(raw.anchorLane!=='centre'&&(!Number.isInteger(raw.anchorLane)||raw.anchorLane<1||raw.anchorLane>s.laneCount))throw Error('Choose the bundle centre or an existing lane as the squeeze anchor.');
 return apex?{version:2,shape:'apex',spacingMm:raw.spacingMm,anchorLane:raw.anchorLane}:{version:1,spacingMm:raw.spacingMm,transitionMm:raw.transitionMm,anchorLane:raw.anchorLane};
}
function arcMeasure(c){
 const n=2048,values=[0],speed=t=>evaluate(c,t).speed;
 const integrate=(a,b)=>(b-a)*(speed(a)+4*speed((a+b)/2)+speed(b))/6;
 for(let i=1;i<=n;i++)values.push(values[i-1]+integrate((i-1)/n,i/n));
 return{length:values[n],at(t){const i=Math.min(n-1,Math.floor(t*n));return values[i]+integrate(i/n,t);},parameter(s){let a=0,b=1;for(let i=0;i<40;i++){const m=(a+b)/2;if(this.at(m)<s)a=m;else b=m;}return(a+b)/2;}};
}
function squeezed(p){
 const c=curve(p.controlPointsMm),s=p.routed,z=squeezeSettings(p.squeeze,s),arc=arcMeasure(c),domain=p.squeezeDomain||[0,1],L=arc.length/(domain[1]-domain[0]),shift=p.referenceOffsetMm||0,apex=z.version===2,T=apex?L/2:z.transitionMm,edges=clearances(s),span=(s.laneCount-1)*s.laneSpacingMm;
 if(2*T>L+1e-6)throw Error('Each squeeze transition must be no longer than half this section ('+(L/2).toFixed(1)+' mm). Use a shorter transition or a longer section.');
 const anchor=z.anchorLane==='centre'?(s.laneCount-1)/2:z.anchorLane-1,metal=s.slotWidthMm/2+s.conductorGapMm+s.conductorWidthMm;
 function ramp(at){
  if(apex){
   // One continuous bell, not two short ramps joined to a plateau.
   // w = 64*u^3*(1-u)^3; w(0)=w(1)=0 and w(1/2)=1.
   const u=Math.max(0,Math.min(1,at/L)),v=1-u;
   return{w:64*u**3*v**3,d:192*u*u*v*v*(1-2*u)/L,dd:384*u*v*(1-5*u+5*u*u)/(L*L)};
  }
  const end=at>L/2,x=Math.max(0,Math.min(1,(end?L-at:at)/T));return{w:x*x*x*(10+x*(-15+6*x)),d:(end?-1:1)*30*x*x*(1-x)*(1-x)/T,dd:60*x*(1-x)*(1-2*x)/(T*T)};
 }
 const memo=new Map();
 function at(t){
  if(memo.has(t))return memo.get(t);const q=evaluate(c,t),r=ramp(arc.at(t)+domain[0]*L),tangent=[q.normal[1],-q.normal[0]];
  const lanes=Array.from({length:s.laneCount},(_,i)=>{const change=(i-anchor)*(z.spacingMm-s.laneSpacingMm),d=-span/2+i*s.laneSpacingMm+shift+change*r.w,ds=change*r.d,dss=change*r.dd,A=1-q.curvature*d,B=ds;
   if(A<=.002)throw Error('A squeezed slot folds inside this bend. Widen the curve or reduce the squeeze.');
   const v=[A*tangent[0]+B*q.normal[0],A*tangent[1]+B*q.normal[1]],speed=Math.hypot(...v),a=-q.curvatureDerivative*d-2*q.curvature*ds,b=q.curvature*A+dss,k=(A*b-B*a)/speed**3;
   const lane={p:offset(q,d),normal:[-v[1]/speed,v[0]/speed],heading:deg(Math.atan2(v[1],v[0])),curvature:k};
   for(const edge of[-(i===0?edges.first:metal),i===s.laneCount-1?edges.last:metal])if(1-edge*k<=.002)throw Error(apex?'A squeezed conductor or piece edge folds. Use a longer or wider section, reduce the squeeze, or shorten the piece clearance.':'A squeezed conductor or piece edge folds in the transition. Lengthen the transition, reduce the squeeze, or shorten the piece clearance.');
   return lane;
  });
  const points=[offset(lanes[0],-edges.first),offset(lanes.at(-1),edges.last),...lanes.flatMap(l=>[-metal,0,metal].map(d=>offset(l,d)))],result={t,q,lanes,points};memo.set(t,result);return result;
 }
 // A dense independent pass catches narrow curvature peaks before drawing.
 const minCurvatures=Array(s.laneCount).fill(0);for(let i=0;i<=2048;i++)at(i/2048).lanes.forEach((l,j)=>minCurvatures[j]=Math.max(minCurvatures[j],Math.abs(l.curvature)));
 const qs=[at(0)];
 function split(a,b,depth){const checks=[.25,.5,.75].map(f=>at(a.t+(b.t-a.t)*f));let error=0,turn=0;
  for(let j=0;j<a.points.length;j++)for(let k=0;k<3;k++){const f=(k+1)/4;error=Math.max(error,distance(checks[k].points[j],a.points[j].map((v,i)=>v+(b.points[j][i]-v)*f)));}
  for(let j=0;j<s.laneCount;j++)for(const q of checks)turn=Math.max(turn,Math.abs(Math.atan2(Math.sin(rad(q.lanes[j].heading-a.lanes[j].heading)),Math.cos(rad(q.lanes[j].heading-a.lanes[j].heading)))));
  if(b.t-a.t>1/32||error>EPS||turn>rad(1)){if(!depth)throw Error('This squeeze is too abrupt to sample. Use a longer or gentler section.');split(a,checks[1],depth-1);split(checks[1],b,depth-1);}else qs.push(b);
 }
 const breaks=[0,...[T,L-T].map(v=>v-domain[0]*L).filter(v=>v>0&&v<arc.length).map(v=>arc.parameter(v)),1].sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>1e-10);for(let i=1;i<breaks.length;i++)split(at(breaks[i-1]),at(breaks[i]),14);
 if(qs.length>4097)throw Error('Use a longer, gentler squeeze or shorter routed sections.');
 function line(points,headings,curvatures){const distancesMm=[0];for(let i=1;i<points.length;i++)distancesMm.push(distancesMm.at(-1)+distance(points[i-1],points[i]));return{type:'polyline',samplingTargetMm:EPS,points,distancesMm,headingsDeg:headings,curvaturesPerMm:curvatures,lengthMm:distancesMm.at(-1)};}
 qs.forEach(q=>q.lanes.forEach((l,i)=>minCurvatures[i]=Math.max(minCurvatures[i],Math.abs(l.curvature))));
 const reference=polyline(qs.map(v=>v.q),0),fractions=reference.distancesMm.map(d=>d/reference.lengthMm),lanePaths=Array.from({length:s.laneCount},(_,i)=>{const ls=qs.map(v=>v.lanes[i]),segment={...line(ls.map(v=>v.p),ls.map(v=>v.heading),ls.map(v=>v.curvature)),referenceFractions:fractions};if(!p.deferIntersections&&!simple(segment.points,false))throw Error('A squeezed slot crosses itself. Open up the curve.');return{id:'lane-'+(i+1),start:segment.points[0],end:segment.points.at(-1),segments:[segment],lengthMm:segment.lengthMm,d:path(segment.points)};});
 const surfaceFirst=qs.map(v=>offset(v.lanes[0],-edges.first)),surfaceLast=qs.map(v=>offset(v.lanes.at(-1),edges.last)),outline=surfaceFirst.concat(surfaceLast.slice().reverse());
 if(!p.deferIntersections&&!simple(outline,true))throw Error('The squeezed surface crosses itself. Widen the curve or reduce the squeeze.');
 const ribbons=lanePaths.map((_,i)=>{const sides=[-metal,metal].map(d=>qs.map(v=>offset(v.lanes[i],d)));return sides[0].concat(sides[1].reverse());});
 if(!p.deferIntersections)for(let i=0;i<ribbons.length;i++){const a=ribbons[i];if(!simple(a,true))throw Error('A squeezed conductor footprint overlaps itself. Widen the curve or reduce the squeeze.');for(let j=0;j<i;j++){const b=ribbons[j];for(let x=0;x<a.length;x++)for(let y=0;y<b.length;y++)if(intersects(a[x],a[(x+1)%a.length],b[y],b[(y+1)%b.length]))throw Error('Conductors of adjacent squeezed lanes overlap. Increase spacing or use a longer, gentler section.');}}
 const delta=s.slotWidthMm/2+s.conductorGapMm+s.conductorWidthMm/2;let conductorLengthMm=0;
 const conductors=lanePaths.map((_,i)=>[-delta,delta].map(d=>{const points=qs.map(v=>offset(v.lanes[i],d));for(let j=1;j<points.length;j++)conductorLengthMm+=distance(points[j-1],points[j]);return path(points);}));
 const xs=outline.map(p=>p[0]),ys=outline.map(p=>p[1]);let area=0;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];area+=a[0]*b[1]-b[0]*a[1];}
 const centre=surfaceFirst.map((v,i)=>v.map((n,j)=>(n+surfaceLast[i][j])/2)),g={outlineSvgPath:path(outline)+' Z',sampledOutline:outline,boundsMm:[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)],lanePaths,centrelineLengthMm:line(centre,[],[]).lengthMm,reference,parametersT:qs.map(q=>q.t),conductors,conductorLengthMm,minRadiiMm:minCurvatures.map(k=>k?1/k:null),surfaceAreaMm2:Math.abs(area)/2,samplingToleranceMm:EPS,connectors:[{id:'a',position:[0,0],outwardAngleDeg:qs[0].q.heading+180},{id:'b',position:c[3].slice(),outwardAngleDeg:qs.at(-1).q.heading}]};
 for(const port of g.connectors)port.lanes=lanePaths.map(l=>({pathId:l.id,position:port.id==='a'?l.start:l.end}));return g;
}
// Shared by CAD export: boundaries follow the actual slot normal, including ramps.
function edgePoints(p,g,offsetMm){
 if(p.squeeze===undefined){const delta=offsetMm-p.laneOffsetsMm[0]-(p.routed.laneCount-1)*p.routed.laneSpacingMm/2;return g.parametersT.map(t=>offset(evaluate(p.controlPointsMm,t),delta));}
 let lane=0;for(let i=1;i<p.laneOffsetsMm.length;i++)if(Math.abs(offsetMm-p.laneOffsetsMm[i])<Math.abs(offsetMm-p.laneOffsetsMm[lane]))lane=i;
 const delta=offsetMm-p.laneOffsetsMm[lane],seg=g.lanePaths[lane].segments[0];return seg.points.map((v,i)=>[v[0]-Math.sin(rad(seg.headingsDeg[i]))*delta,v[1]+Math.cos(rad(seg.headingsDeg[i]))*delta]);
}
function geometry(p){return structuredClone(derive(p));}
function validate(p){derive(p);}
function interval(values,value){let lo=0,hi=values.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(values[mid]<=value)lo=mid;else hi=mid;}return{lo,hi,f:(value-values[lo])/(values[hi]-values[lo]||1)};}
function at(segment,d){const {lo,hi,f}=interval(segment.distancesMm,Math.max(0,Math.min(segment.lengthMm,d))),a=segment.points[lo],b=segment.points[hi],ha=segment.headingsDeg[lo],hb=segment.headingsDeg[hi],turn=deg(Math.atan2(Math.sin(rad(hb-ha)),Math.cos(rad(hb-ha))));return{x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,heading:ha+turn*f,curvature:segment.curvaturesPerMm[lo]*(1-f)+segment.curvaturesPerMm[hi]*f};}
function distanceAtFraction(segment,fraction){const {lo,hi,f}=interval(segment.referenceFractions,Math.max(0,Math.min(1,fraction)));return segment.distancesMm[lo]+(segment.distancesMm[hi]-segment.distancesMm[lo])*f;}
function crossSection(p,g,fraction){const {lo,hi,f}=interval(g.reference.distancesMm,fraction*g.reference.lengthMm);if(p.squeeze!==undefined)return[0,p.widthMm].map(d=>{const pts=edgePoints(p,g,d);return pts[lo].map((v,i)=>v+(pts[hi][i]-v)*f);});const t=g.parametersT[lo]+(g.parametersT[hi]-g.parametersT[lo])*f,q=evaluate(p.controlPointsMm,t),s=p.routed,edges=clearances(s),span=(s.laneCount-1)*s.laneSpacingMm;return[offset(q,-span/2-edges.first),offset(q,span/2+edges.last)];}
function preset(name,s){const r=Math.max(600,((s.laneCount-1)*s.laneSpacingMm+s.innerClearanceMm+s.outerClearanceMm)*1.1),k=.5522847498307936;if(name==='s-bend')return[[0,0],[r*.65,r*.3],[r*1.35,-r*.3],[r*2,0]];if(name==='transition')return[[0,0],[r*.6,0],[r*1.4,0],[r*2,0]];return[[0,0],[r*k,0],[r,r*(1-k)],[r,r]];}
return{arcMeasure,TYPE,EPS,clearances,curve,evaluate,offset,path,geometry,validate,at,distanceAtFraction,crossSection,preset,squeezeSettings,edgePoints};
});
