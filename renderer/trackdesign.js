// Track Builder adapter. Imported geometry is always regenerated from bounded templates.
(function(root){
  'use strict';
  const I=typeof module!=='undefined'?require('./trackbuilder/integration.js'):root.SlotForgeIntegration;
  const MAX_BYTES=5*1024*1024;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalize(raw){
    const json=typeof raw==='string'?raw:JSON.stringify(raw);
    if(typeof json!=='string'||new TextEncoder().encode(json).length>MAX_BYTES)throw Error('Choose a Track Builder JSON file no larger than 5 MiB.');
    const doc=I.prepare(typeof raw==='string'?JSON.parse(raw):raw,undefined,false);
    if(!doc.pieces.length)throw Error('The design contains no pieces.');
    // Check PNG dimensions before the browser allocates a decoder. Bad artwork is
    // replaced by the Builder reference placeholder; road geometry is unaffected.
    let referencePixels=0;
    for(const d of doc.definitions)if(d.referenceImage){
      try{
        const b=typeof atob==='function'?atob(d.referenceImage.split(',')[1]):Buffer.from(d.referenceImage.split(',')[1],'base64').toString('binary');
        const u=n=>((b.charCodeAt(n)*16777216)+(b.charCodeAt(n+1)<<16)+(b.charCodeAt(n+2)<<8)+b.charCodeAt(n+3));
        const w=u(16),h=u(20);
        if(b.slice(12,16)!=='IHDR'||!(w>0&&h>0&&w<=4096&&h<=4096&&w*h<=8388608)||referencePixels+w*h>33554432)delete d.referenceImage;
        else referencePixels+=w*h;
      }catch{delete d.referenceImage;}
    }
    return I.prepare(doc,undefined,false);
  }
  function configure(document,laneRoutes,confirmed=false){
    const doc=normalize(document),ids=new Set(doc.track.lanes.map(l=>l.id));
    if(!Array.isArray(laneRoutes)||laneRoutes.length>8||laneRoutes.some(id=>typeof id!=='string'||id&&!ids.has(id)))throw Error('Choose a valid design route for each lane.');
    if(new Set(laneRoutes.filter(Boolean)).size!==laneRoutes.filter(Boolean).length)throw Error('Each timing lane must use a different design route.');
    if(confirmed&&(!doc.timing.startFinish||laneRoutes.some(id=>!id)||!laneRoutes.length||doc.compatibility.liveTracker!=='through-routes'||doc.timing.startFinishOffsets.length!==doc.track.lanes.length))throw Error('Confirm a closed circuit, timing line and every lane mapping before enabling Live Tracker.');
    return {version:1,document:doc,laneRoutes:laneRoutes.slice(),confirmedMappingRevision:confirmed?doc.timing.routeMappingRevision:null};
  }
  function restoreMapping(doc,previous,count){
    const ids=doc.track.lanes.map(l=>l.id),known=previous?.document?.design?.id===doc.design.id&&Array.isArray(previous.laneRoutes);
    const n=Math.min(8,Math.max(1,Math.floor(Number(count)||1)));
    const laneRoutes=Array.from({length:n},(_,i)=>known?(ids.includes(previous.laneRoutes[i])?previous.laneRoutes[i]:''):ids[i]||'');
    const confirmed=!!(known&&previous.confirmedMappingRevision&&previous.confirmedMappingRevision===doc.timing.routeMappingRevision&&
      JSON.stringify(previous.document.timing.startFinish)===JSON.stringify(doc.timing.startFinish)&&previous.document.timing.direction===doc.timing.direction&&
      laneRoutes.length===previous.laneRoutes.length&&laneRoutes.every(Boolean));
    return {laneRoutes,confirmed};
  }
  function validateSaved(raw){
    if(raw==null)return null;
    if(raw.version!==1)throw Error('Unsupported saved track design version.');
    const next=configure(raw.document,raw.laneRoutes||[],false);
    if(raw.confirmedMappingRevision===next.document.timing.routeMappingRevision&&raw.confirmedMappingRevision){
      return configure(next.document,next.laneRoutes,true);
    }
    return next;
  }
  function patch(existing,saved,options={}){
    const design=validateSaved(saved),doc=design.document,out={trackDesign:design};
    if(!existing||options.name)out.name=doc.title;
    if(!existing||options.lanes)out.lanes=design.laneRoutes.length||doc.track.laneCount||doc.track.slotCountsInDrawing[0]||1;
    const n=Number(out.lanes??existing?.lanes);
    if(n!==design.laneRoutes.length)throw Error('The lane mapping must match the Track Database lane count.');
    if(options.lengths){
      const lengths=design.laneRoutes.map(id=>doc.track.lanes.find(l=>l.id===id)?.lengthMm/1000);
      if(lengths.length!==n||lengths.some(v=>!Number.isFinite(v)||v<=0))throw Error('Nominal lengths need a closed route mapped to every timing lane.');
      out.laneModifier='measured';out.laneLengths=lengths.map(v=>Number(v.toFixed(6))).join(', ');out.length=Number(Math.max(...lengths).toFixed(6));
      out.laneLengthSource='track-builder-nominal';
    }
    if(options.picture&&/^data:image\/png;base64,/.test(options.png||'')){out.picture=options.png;out.pictureFrame=null;}
    return out;
  }
  const cache=new WeakMap();
  function runtime(saved,laneCount){
    if(!saved||typeof saved!=='object')return null;
    let value=cache.get(saved);
    if(value===undefined){
      try{
        const c=validateSaved(saved),doc=I.prepare(c.document),routes=doc.preparedGeometry.routes;
        if(!c.confirmedMappingRevision)throw Error('Confirm lane mapping and timing line in Database → Tracks → Track design.');
        const plans=routes.map(r=>{
          const offset=doc.timing.startFinishOffsets.find(o=>o.routeId===r.id)?.offsetMm;
          if(!Number.isFinite(offset))throw Error('Timing line unavailable.');
          const speed=I.travelPlan(r,doc.profile,offset,doc.timing.direction),count=Math.min(4096,Math.max(128,Math.ceil(r.lengthMm/10))),step=r.lengthMm/count,times=[0];
          for(let n=0;n<count;n++)times.push(times[n]+step/Math.max(1,speed((n+.5)*step)));
          // Cache a bounded route outline once; animation only moves the cars.
          const path=Array.from({length:count+1},(_,n)=>{const q=I.atTravel(r,n*step,offset,doc.timing.direction);return (n?'L':'M')+q.x.toFixed(3)+' '+q.y.toFixed(3);}).join('')+'Z';
          return {route:r,offset,times,step,total:times[count],path};
        });
        value={config:c,doc,plans,picture:I.picture(doc,{maxDimension:1600})};
      }catch(e){value={error:e.message};}
      cache.set(saved,value);
    }
    if(!value.error&&value.config.laneRoutes.length!==Number(laneCount))return {error:'Track lane count changed. Confirm the lane mapping in Database → Tracks.'};
    return value;
  }
  function lapDuration(rt,lane){
    if(!rt||rt.error)return null;
    const seconds=rt.plans.find(p=>p.route.id===rt.config.laneRoutes[lane])?.total;
    return Number.isFinite(seconds)&&seconds>0?seconds*1000:null;
  }
  function pose(rt,lane,fraction){
    const id=rt.config.laneRoutes[lane],p=rt.plans.find(p=>p.route.id===id);if(!p)return null;
    const target=Math.min(1,Math.max(0,fraction))*p.total,a=p.times;let lo=0,hi=a.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(a[mid]<=target)lo=mid;else hi=mid;}
    const distance=(lo+(target-a[lo])/(a[hi]-a[lo]))*p.step;
    const q=I.atTravel(p.route,distance,p.offset,rt.doc.timing.direction);
    return {...q,angle:q.heading};
  }
  function fit(rt,w,h){
    // Picture viewBox already contains padding, borders and reference artwork.
    const b=rt.picture.svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number),scale=Math.min((w-24)/b[2],(h-24)/b[3]);
    return {x:(w-b[2]*scale)/2-b[0]*scale,y:(h-b[3]*scale)/2-b[1]*scale,scale};
  }
  function point(rt,lane,p,w,h){const q=pose(rt,lane,p);if(!q)return null;const f=fit(rt,w,h);return {...q,x:f.x+q.x*f.scale,y:f.y+q.y*f.scale};}
  function drawing(rt,w,h,lanes){
    const f=fit(rt,w,h),body=lanes ? lanes.map(s=>{
      const p=rt.plans.find(p=>p.route.id===rt.config.laneRoutes[s.lane]);
      return p?`<path data-track-lane="${s.lane}" d="${p.path}" fill="none" stroke="${esc(s.color)}" stroke-opacity=".65" stroke-width="2" vector-effect="non-scaling-stroke"/>`:'';
    }).join('') : rt.picture.svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
    const lines=rt.plans.map(p=>{const q=I.atTravel(p.route,0,p.offset,rt.doc.timing.direction);return `<g transform="translate(${q.x} ${q.y}) rotate(${q.heading})"><path d="M0 -18V18" stroke="#fff" stroke-width="6"/><path d="M0 -18V18" stroke="#15191d" stroke-width="6" stroke-dasharray="6 6"/></g>`;}).join('');
    return `<g transform="translate(${f.x} ${f.y}) scale(${f.scale})">${body}${lines}</g>`;
  }
  async function thumbnail(document){
    const doc=structuredClone(document);
    const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Image cannot be decoded'));img.src=src;});
    for(const d of doc.definitions)if(d.referenceImage)try{await load(d.referenceImage);}catch{delete d.referenceImage;}
    const picture=I.picture(doc,{maxDimension:1200}),url=URL.createObjectURL(new Blob([picture.svg],{type:'image/svg+xml'}));
    try{const img=await load(url),canvas=globalThis.document.createElement('canvas');canvas.width=picture.width;canvas.height=picture.height;canvas.getContext('2d').drawImage(img,0,0);return canvas.toDataURL('image/png');}finally{URL.revokeObjectURL(url);}
  }
  const api={MAX_BYTES,normalize,configure,restoreMapping,validateSaved,patch,runtime,lapDuration,pose,point,drawing,thumbnail,esc};
  if(typeof module!=='undefined')module.exports=api;else root.TrackDesign=api;
})(typeof globalThis!=='undefined'?globalThis:this);
