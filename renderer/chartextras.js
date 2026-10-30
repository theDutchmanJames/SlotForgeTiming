// Additional chart adapters. Pure statistics; live motion only changes marker attributes.
(function(root){
  const Track=typeof module!=='undefined'?require('./trackdesign.js'):root.TrackDesign;
  const styles=['track','box','hist','position','heat'];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const quantile=(sorted,p)=>{if(!sorted.length)return null;const n=(sorted.length-1)*p,i=Math.floor(n);return sorted[i]+(sorted[Math.ceil(n)]-sorted[i])*(n-i);};
  function spread(values,whisker){
    const a=values.slice().sort((a,b)=>a-b);if(!a.length)return null;
    const q1=quantile(a,.25),q3=quantile(a,.75),med=quantile(a,.5),iqr=q3-q1;
    const inside=whisker==='iqr'?a.filter(v=>v>=q1-1.5*iqr&&v<=q3+1.5*iqr):a;
    return {min:inside[0],max:inside.at(-1),q1,q3,median:med,n:a.length,outliers:whisker==='iqr'?a.filter(v=>v<inside[0]||v>inside.at(-1)):[]};
  }
  function histogram(groups,width){
    let lo=Infinity,hi=-Infinity;groups.forEach(a=>a.forEach(v=>{lo=Math.min(lo,v);hi=Math.max(hi,v);}));
    if(!Number.isFinite(lo))return {start:0,width,counts:groups.map(()=>[]),size:0};
    // Pathological slow laps must not allocate millions of buckets.
    let step=width;if((hi-lo)/step>80)step=Math.ceil((hi-lo)/80/width)*width;
    const start=Math.floor(lo/step+1e-9)*step,size=Math.max(1,Math.floor((hi-start)/step+1e-9)+1);
    return {start,width:step,size,counts:groups.map(a=>{const bins=Array(size).fill(0);a.forEach(v=>bins[Math.min(size-1,Math.max(0,Math.floor((v-start)/step+1e-9)))]++);return bins;})};
  }
  function eligible(c,pits=false){const no=new Set([...(c.invalid||[]),...(c.removed||[]),...(c.redLaps||[]),...(!pits?c.pitLaps||[]:[])]);return (c.laps||[]).filter((v,i)=>v>0&&Number.isFinite(v)&&!no.has(i)&&!c.bad?.[i]);}
  function model(d,series,cars,S){
    const samples=series.map(s=>s.points.filter(p=>p.value!==null).map(p=>p.value));
    if(d.style==='box')return {spreads:samples.map(a=>spread(a,d.whisker))};
    if(d.style==='hist')return {histogram:histogram(samples,Number(d.bin))};
    if(d.style==='heat')return {baselines:samples.map((a,i)=>d.heatReference==='track'?(Number(S.track?.targetLap)>0?Number(S.track.targetLap):null):quantile(a.slice().sort((a,b)=>a-b),.5))};
    if(d.style==='position')return {positions:positions(cars,d.history)};
    if(d.style==='track'){
      let design=Track.runtime(S.track?.trackDesign,S.track?.lanes);
      const reason=(S.track?.trackDesign||d.trackDrawing==='design')?(!design?'No imported design on '+(S.track?.name||'the selected race track')+' — choose or import it in Database → Tracks':design.error||(!cars.every(c=>design.config.laneRoutes[c.lane])?'Some displayed drivers have no mapped design route':'')):'';
      if(reason)design=null;
      return {design,designNote:reason,track:cars.map(c=>{
      const a=eligible(c,d.pits).slice(-5),p=c.profile;
      let ms=d.pace==='profile'?Track.lapDuration(design,c.lane):d.pace==='track'?Number(S.track?.targetLap)*1000:d.pace==='last'?a.at(-1):d.pace==='average'?a.reduce((s,v)=>s+v,0)/a.length:quantile(a.slice().sort((a,b)=>a-b),.5);
      if(c.virtualRival&&p){const V=typeof module!=='undefined'?require('./virtualrival.js'):root.VirtualRival;const seq=V.sequence(p),n=c.laps.length;ms=seq[n]?.time??(p.end==='repeat'?seq[n%seq.length]?.time:p.end==='reference'?p.reference*1000*100/p.speed:null);}
      const track={lane:c.lane,ms:Number.isFinite(ms)&&ms>0?ms:null};
      if(S.preview)track.preview=progress(track,c,S,d);return track;
    })};}
    return {};
  }
  // The engine's total contains the formation-lap offset; subtracting lap
  // durations recovers each crossing on the paused-time-free race clock.
  // This is recorded lap-count order, deliberately not a reconstructed verdict.
  function positions(cars,history){
    const events=[],counts=cars.map(()=>0),last=cars.map(()=>Infinity),rows=cars.map(()=>[]);
    cars.forEach((c,i)=>{if(c.comparisonOnly)return;let time=Math.max(0,(Number(c.total)||0)-(c.laps||[]).reduce((s,v)=>s+v,0));(c.laps||[]).forEach((ms,n)=>{time+=ms;if(Number.isFinite(time))events.push({i,time:time/1000,n:n+1});});});
    events.sort((a,b)=>a.time-b.time||a.i-b.i);
    const limit=history==='all'?Infinity:Number(history)*Math.max(1,cars.length),from=Math.max(0,events.length-limit);
    let end=0;
    for(let k=0;k<events.length;){const at=events[k].time;let next=k;while(next<events.length&&events[next].time===at){const e=events[next++];counts[e.i]=e.n;last[e.i]=at;}
      if(next>from){const order=cars.map((_,i)=>i).filter(i=>!cars[i].comparisonOnly).sort((a,b)=>counts[b]-counts[a]||last[a]-last[b]||a-b);order.forEach((i,r)=>{if(!rows[i].length||rows[i].at(-1).rank!==r+1)rows[i].push({time:at,rank:r+1});});end=at;}k=next;
    }
    rows.forEach(row=>{if(row.length&&row.at(-1).time<end)row.push({time:end,rank:row.at(-1).rank});});
    return {rows,start:Math.min(...rows.map(r=>r[0]?.time??Infinity)),end};
  }
  function thinSteps(row,pixels){
    const step=Math.max(1,Math.ceil(row.length/Math.max(1,pixels))),out=[];
    for(let i=0;i<row.length;i+=step){const end=Math.min(row.length,i+step);let low=i,high=i;for(let j=i+1;j<end;j++){if(row[j].rank<row[low].rank)low=j;if(row[j].rank>row[high].rank)high=j;}
      [...new Set([i,low,high,end-1])].sort((a,b)=>a-b).forEach(j=>out.push(row[j]));}
    return out;
  }
  function progress(track,c,S,d){
    if(!c)return {p:0,state:'Unavailable'};
    if(c.dq||c.retired)return {p:0,state:c.dq?'DQ':'Retired'};
    if(c.done)return {p:0,state:'Finished'};
    if(S.eng.status==='ready'||(!c.virtualRival&&c.started===false))return {p:0,state:'Waiting for start'};
    if(c.blockAt!=null||c.pitHold)return {p:0,state:'In pits'};
    if(!track.ms)return {p:0,state:'No pace reference'};
    if(d.motion==='0')return {p:0,state:'Crossings only'};
    const ms=c.virtualRival?Math.max(0,S.eng.elapsed(S.now)-c.total):Math.max(0,S.eng.status==='finished'?S.eng.endAt-c.last:S.eng.lapElapsed(S.eng.cars.indexOf(c),S.now));
    return {p:Math.min(.96,ms/track.ms),state:S.eng.status==='finished'?'Stopped':ms>=track.ms?'Awaiting crossing':S.eng.status==='paused'?'Paused':c.virtualRival?'Replay':'Estimated'};
  }
  function geometry(w,h,i,n){
    // Keep an oval even in tall/narrow cards; never let the semicircles overlap.
    const outer=Math.max(12,Math.min((h-24)/2,(w-24)/4)),gap=Math.min(12,Math.max(0,(outer-26)/Math.max(1,n-1))),inset=12+i*gap,r=outer-i*gap;
    return {left:inset+r,right:w-inset-r,top:h/2-r,r,cy:h/2};
  }
  function point(g,p,direction){
    const {left,right,top,r,cy}=g,straight=Math.max(0,right-left),length=2*straight+2*Math.PI*r;
    let s=(((direction==='ccw'?-p:p)%1+1)%1*length+straight/2)%length;
    if(s<straight)return {x:left+s,y:top,angle:0};s-=straight;
    if(s<Math.PI*r){const a=-Math.PI/2+s/r;return {x:right+Math.cos(a)*r,y:cy+Math.sin(a)*r,angle:s/r*180/Math.PI};}s-=Math.PI*r;
    if(s<straight)return {x:right-s,y:cy+r,angle:180};s-=straight;
    const a=Math.PI/2+s/r;return {x:left+Math.cos(a)*r,y:cy+Math.sin(a)*r,angle:180+s/r*180/Math.PI};
  }
  const text=(x,y,v,anchor='start',attrs='')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" ${attrs}>${esc(v)}</text>`;
  const line=(x1,y1,x2,y2,attrs='class="chart-grid"')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
  const short=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
  function html(m,w,h){
    const {d,series}=m,n=series.length,legendRows=d.legend?Math.ceil(n/Math.max(1,Math.floor(w/130))):0,H=h-28-legendRows*22;
    const empty=s=>`<div class="race-chart-empty">${esc(s)}</div>`;
    if(H<110||(['box','hist','heat'].includes(d.style)&&H<70+n*(d.style==='hist'?52:24)))return empty('Enlarge chart or select fewer drivers');
    const L=d.style==='position'?42:Math.min(82,w*.23),R=d.style==='box'&&w>=480?88:16,T=26,B=H-30,P=w-L-R,parts=[];let note='';
    const values=series.flatMap(s=>s.points.filter(p=>p.value!==null).map(p=>p.value));
    if(!values.length&&!['track','position'].includes(d.style))return empty('Waiting for eligible completed laps');
    const axis=(lo,hi)=>{[0,.5,1].forEach(k=>{const x=L+k*P;parts.push(line(x,T,x,B),text(x,B+19,(lo+k*(hi-lo)).toFixed(2),'middle'));});};
    if(d.style==='track'){
      if(H<100+n*9||w<180+n*14)return empty('Enlarge Live Track or select fewer drivers');
      if(m.design)parts.push(Track.drawing(m.design,w,H,d.trackDrawing==='design'?null:series));
      series.forEach((s,i)=>{
        const g=geometry(w,H,i,n),q=m.design?Track.point(m.design,s.lane,m.track[i]?.preview?.p||0,w,H):point(g,m.track[i]?.preview?.p||0,d.direction);
        if(!m.design)parts.push(`<path d="M${g.left} ${g.top}H${g.right}a${g.r} ${g.r} 0 0 1 0 ${g.r*2}H${g.left}a${g.r} ${g.r} 0 0 1 0 ${-g.r*2}" fill="none" stroke="${s.color}" stroke-opacity=".65" stroke-width="2"/>`);
        parts.push(`<g data-track-marker="${i}" transform="translate(${q.x} ${q.y}) rotate(${q.angle})">${m.design?`<g data-track-body><rect x="-15" y="-5" width="21" height="10" rx="3" fill="${s.color}" stroke="var(--bg)" stroke-width="2"/></g><circle r="1.8" fill="white"/>`:`<rect x="-9" y="-5" width="18" height="10" rx="3" fill="${s.color}" stroke="var(--bg)" stroke-width="2"/>`}<title>${esc(s.name)} · waiting</title></g>`);
      });
      if(!m.design)parts.push(line(w/2,geometry(w,H,0,n).top-5,w/2,geometry(w,H,n-1,n).top+8,'stroke="currentColor" stroke-width="3" stroke-dasharray="3 3"'),text(w/2,H/2-5,'START / FINISH','middle'),text(w/2,H/2+14,d.direction==='cw'?'Clockwise →':'← Counterclockwise','middle'));
      note=(m.design?(d.trackDrawing==='design'?'Track Builder artwork · ':'Coloured lanes · imported layout · '):m.designNote?'Oval fallback: '+m.designNote+' · ':'')+(d.pace==='profile'?'Tuning-profile pace · ':'')+'Estimated positions · only crossings count laps';
    }else if(d.style==='box'){
      let lo=Infinity,hi=-Infinity;values.forEach(v=>{lo=Math.min(lo,v);hi=Math.max(hi,v);});const pad=Math.max(.05,(hi-lo)*.05);lo-=pad;hi+=pad;const x=v=>L+(v-lo)/(hi-lo)*P;axis(lo,hi);
      m.spreads.forEach((a,i)=>{const y=T+(i+.5)*(B-T)/n,s=series[i];parts.push(text(3,y+4,short(s.name,Math.floor(L/7))));if(!a){parts.push(text(L,y+4,'No eligible laps'));return;}
        if(w>=480)parts.push(text(w-3,y+4,a.median.toFixed(3)+' s','end'));
        parts.push(line(x(a.min),y,x(a.max),y,`stroke="${s.color}" stroke-width="2"`),`<rect x="${x(a.q1)}" y="${y-8}" width="${Math.max(2,x(a.q3)-x(a.q1))}" height="16" rx="3" fill="${s.color}" fill-opacity=".45"><title>${esc(s.name)}: median ${a.median.toFixed(3)} s; middle 50% ${a.q1.toFixed(3)}–${a.q3.toFixed(3)}; ${a.n} laps</title></rect>`,line(x(a.median),y-11,x(a.median),y+11,`stroke="${s.color}" stroke-width="2"`));
        [...new Map(a.outliers.map(v=>[Math.round(x(v)),v])).values()].forEach(v=>parts.push(`<circle cx="${x(v)}" cy="${y}" r="3" fill="${s.color}"><title>Outlier: ${v.toFixed(3)} s (included)</title></circle>`));
      });note=`Seconds · median / middle 50% · ${d.whisker==='iqr'?'1.5 × IQR whiskers; dots are outliers':'fastest–slowest whiskers'}`;
    }else if(d.style==='hist'){
      const g=m.histogram,rows=g.counts.map(a=>{const total=a.reduce((x,y)=>x+y,0);return a.map(v=>d.frequency==='percent'?(total?100*v/total:0):v);});
      let max=1;rows.forEach(a=>a.forEach(v=>max=Math.max(max,v)));axis(g.start,g.start+g.size*g.width);
      rows.forEach((a,i)=>{const row=(B-T)/n,y=T+(i+1)*row-5,s=series[i];parts.push(text(3,y-row/2+4,short(s.name,Math.floor(L/7))),line(L,y,L+P,y),text(L,y-row+13,`0–${max.toFixed(d.frequency==='percent'?1:0)}${d.frequency==='percent'?'%':' laps'}`));a.forEach((v,k)=>{const height=v/max*Math.max(5,row-22);parts.push(`<rect x="${L+k*P/g.size}" y="${y-height}" width="${Math.max(.2,P/g.size-1)}" height="${height}" fill="${s.color}" fill-opacity=".8"><title>${(g.start+k*g.width).toFixed(3)} to ${(g.start+(k+1)*g.width).toFixed(3)} s: ${g.counts[i][k]} laps${d.frequency==='percent'?' ('+v.toFixed(1)+'%)':''}</title></rect>`);});});
      note=`Shared axes from zero · ${g.width.toFixed(2)} s bins${g.width>Number(d.bin)?' (widened for range)':''}`;
    }else if(d.style==='heat'){
      const columns=Math.max(1,Math.floor(P/(d.labels?52:18))),from=Math.max(m.from,m.last-columns+1),count=Math.max(1,m.last-from+1),cell=P/count;
      let span=.05;series.forEach((s,i)=>s.points.forEach(p=>{if(p.lap>=from&&p.value!==null&&m.baselines[i])span=Math.max(span,Math.abs(p.value-m.baselines[i]));}));
      series.forEach((s,i)=>{const y=T+i*(B-T)/n,hh=(B-T)/n-3,base=m.baselines[i];parts.push(text(3,y+hh/2+4,short(s.name,Math.floor(L/7))));for(let lap=from;lap<=m.last;lap++){const p=s.points[lap-m.from],v=p?.value,x=L+(lap-from)*cell,diff=v!=null&&base?v-base:null;const fill=diff===null?'var(--line)':diff<0?'#289cc8':'#e1a345',opacity=diff===null?.45:.14+.72*Math.abs(diff)/span;parts.push(`<rect x="${x+1}" y="${y}" width="${Math.max(1,cell-2)}" height="${hh}" rx="3" fill="${fill}" fill-opacity="${opacity}"><title>Lap ${lap}: ${v==null?p?.reason||'No lap':v.toFixed(3)+' s'}${base?' · reference '+base.toFixed(3)+' s':' · no reference'}</title></rect>`);if(d.labels)parts.push(text(x+cell/2,y+hh/2+4,v==null?'—':v.toFixed(3),'middle'));else if(v==null&&d.excluded)parts.push(text(x+cell/2,y+hh/2+4,'×','middle'));}});
      [from,...(count>1?[m.last]:[])].forEach(l=>parts.push(text(L+(l-from+.5)*cell,B+19,l,'middle')));note=`Laps ${from}–${m.last} · blue faster / amber slower · ${d.heatReference==='track'?'track target':'driver median'}${m.baselines.some(v=>!v)?' unavailable':''}`;
    }else if(d.style==='position'){
      const p=m.positions;if(!Number.isFinite(p.start))return empty('Waiting for confirmed crossings');
      const x=t=>L+(t-p.start)/Math.max(.001,p.end-p.start)*P,y=r=>T+(r-1)/Math.max(1,n-1)*(B-T);
      for(let r=1;r<=n;r++)parts.push(line(L,y(r),w-R,y(r)),text(L-10,y(r)+4,r,'end'));
      [0,.5,1].forEach(k=>parts.push(text(L+k*P,B+19,(p.start+k*(p.end-p.start)).toFixed(1),'middle')));
      p.rows.forEach((fullRow,i)=>{const row=thinSteps(fullRow,Math.floor(P));let path='',last=null;const s=series[i];row.forEach((v,k)=>{const px=x(v.time),py=y(v.rank);if(!k)path=`M${px} ${py}`;else if(v.rank!==last.rank||k===row.length-1)path+=`H${px}V${py}`;last=v;});if(path)parts.push(`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="${d.thickness}" stroke-dasharray="${d.patterns?['','6 3','2 3','10 3 2 3'][i%4]:''}"><title>${esc(s.name)}</title></path>`, `<circle cx="${x(row.at(-1).time)}" cy="${y(row.at(-1).rank)}" r="3" fill="${s.color}"/>`);});
      note='Race seconds · crossing order · excludes penalties / review / comparison rivals';
    }
    return `<div class="race-chart chart-extra" role="group" aria-label="${esc(d.name)}"><svg viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="${esc(d.name)}"><title>${esc(d.name)}</title>${parts.join('')}</svg>${d.legend?`<div class="chart-legend">${series.map((s,i)=>`<span title="${esc(s.name)}"><i style="background:${s.color}"></i>${esc(s.name)}${s.dq?' · DQ':''}${d.style==='track'?` <b data-track-status="${i}"></b>`:''}</span>`).join('')}</div>`:''}<div class="chart-note" title="${esc(note)}">${esc(note)}</div></div>`;
  }
  // Reuses the existing shared LiveCanvas paint loop: no timer per chart.
  function update(node,m,S){
    if(node.disposed||S.preview||typeof document==='undefined'||document.hidden||!node.el.isConnected)return;
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,d=reduced?{...m.d,motion:'0'}:m.d;
    const cars=[...(S.eng.cars||[]),...(S.eng.rivals||[])],now=typeof performance!=='undefined'?performance.now():Date.now();
    const stamp=m.track.map(t=>{const c=cars.find(c=>c.lane===t.lane);return [c?.laps.length,c?.done,c?.dq,c?.retired,c?.blockAt!=null,!!c?.pitHold,c?.started].join(':');}).join('|')+S.eng.status+S.eng.flag;
    const svg=node.val.querySelector('svg');if(!svg)return;
    const viewBox=svg.getAttribute('viewBox');
    const old=node.chartTrackFrame;if(old&&old.svg===svg&&old.viewBox===viewBox&&old.motion===d.motion&&old.model===m&&old.stamp===stamp&&(d.motion==='0'||S.eng.status!=='running'||now-old.at<1000/Number(d.motion)))return;
    const rect=node.el.getBoundingClientRect();if(rect.bottom<0||rect.right<0||rect.top>innerHeight||rect.left>innerWidth)return;
    const [,,w,h]=viewBox.split(' ').map(Number);
    m.track.forEach((t,i)=>{const marker=node.val.querySelector(`[data-track-marker="${i}"]`);if(!marker)return;const c=cars.find(c=>c.lane===t.lane),v=progress(t,c,S,d),q=m.design?Track.point(m.design,t.lane,v.p,w,h):point(geometry(w,h,i,m.track.length),v.p,d.direction);marker.setAttribute('transform',`translate(${q.x.toFixed(2)} ${q.y.toFixed(2)}) rotate(${q.angle.toFixed(1)})`);const body=marker.querySelector('[data-track-body]');if(body)body.setAttribute('transform',`rotate(${m.design?Math.max(-1,Math.min(1,(q.curvature||0)*350))*m.design.doc.profile.drift:0})`);marker.querySelector('title').textContent=`${c?.driverName||'Driver'} · ${v.state} · ${Math.round(v.p*100)}%`;const label=node.val.querySelector(`[data-track-status="${i}"]`);if(label)label.textContent=v.state==='Estimated'||v.state==='Replay'?`${Math.round(v.p*100)}%`:v.state;});
    node.chartTrackFrame={model:m,stamp,at:now,svg,viewBox,motion:d.motion};
  }
  const api={styles,quantile,spread,histogram,model,positions,thinSteps,progress,geometry,point,html,update};
  if(typeof module!=='undefined')module.exports=api;else root.ChartExtras=api;
})(typeof globalThis!=='undefined'?globalThis:this);
