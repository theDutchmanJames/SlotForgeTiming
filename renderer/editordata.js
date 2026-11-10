(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EditorData=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 async function choices(api,entity){
  if(!api.editorRead)return api.list(entity);
  for(let attempt=0;attempt<3;attempt++){
   try{const items=[];let cursor=null;do{const page=await api.editorRead('page',entity,{cursor});items.push(...page.items);cursor=page.next;}while(cursor);return items;}
   catch(error){if(attempt===2||!(error.code==='CATALOGUE_CHANGED'||/catalogue changed/i.test(error.message)))throw error;}
  }
 }
 function needed(ed){
  const images=new Set(),rows=new Set(),charts=new Set();
  const scan=value=>{if(!value||typeof value!=='object')return;if(typeof value.imageSet==='string'&&value.imageSet&&value.imageSet!=='none')images.add(value.imageSet);if(typeof value.chartDesign==='string')charts.add(value.chartDesign);if(value.type==='leaderboard'&&value.opt?.design)rows.add(value.opt.design);if(value.kind==='component'&&value.component==='leaderboard'&&value.options?.design)rows.add(value.options.design);for(const v of Object.values(value))if(typeof v==='object')scan(v);};
  scan(ed.draft);for(const id of rows)scan(ed.rowDesigns?.find(r=>r.id===id));return {images,track:[...charts].some(id=>ed.chartDesigns?.find(c=>c.id===id)?.style==='track')};
 }
 async function refresh(api,ed){
  if(!api.editorRead)return false;
  ed.previewLoads ||= new Map();const loads=ed.previewLoads,before=ed.previewVersion||0;
  const load=async(key,fetch,apply)=>{
   if(loads.has(key)){await loads.get(key);return;}
   const task=Promise.resolve().then(fetch).then(value=>{if(ed.previewLoads!==loads)return;apply(value);ed.previewVersion=(ed.previewVersion||0)+1;}).catch(error=>{loads.delete(key);throw error;});loads.set(key,task);await task;
  };
  const dependencies=needed(ed);
  for(const id of dependencies.images){
   if(!ed.imageSets.some(s=>s.id===id))continue;
   await load('image:'+id,()=>api.getRecord('imagesets',id),row=>{if(row)ed.imageSets=ed.imageSets.map(s=>s.id===id?row:s);});
  }
  const id=ed.previewTrackId;
  if(dependencies.track&&id&&ed.previewTracks.some(t=>t.id===id))await load('track:'+id,()=>api.editorRead('track','tracks',id),row=>{if(row)ed.previewTracks=ed.previewTracks.map(t=>t.id===id?{...t,...row}:t);});
  return ed.previewLoads===loads&&(ed.previewVersion||0)!==before;
 }
 async function load(api,ed,raceTrackId){
  ed.classDefs=await api.list('raceclasses');
  ed.rowDesigns=await api.list('rowdesigns');ed.chartDesigns=await api.list('chartdesigns');ed.customWidgets=await api.list('customwidgets');
  ed.previewTracks=await choices(api,'tracks');ed.imageSets=await choices(api,'imagesets');ed.teams=await choices(api,'teams');
  const sample=entity=>api.editorRead?api.editorRead('sample',entity):api.list(entity);
  ed.drivers=await sample('drivers');ed.cars=await sample('slotcars');
  const teams=await sample('teams');ed.teams=ed.teams.map(t=>({...t,...teams.find(s=>s.id===t.id)}));
  if(ed.previewTrackId===undefined)ed.previewTrackId=(ed.previewTracks.find(t=>t.id===raceTrackId&&(t.hasTrackDesign||t.trackDesign))||ed.previewTracks.find(t=>t.hasTrackDesign||t.trackDesign))?.id||'';
  ed.previewLoads=new Map();await refresh(api,ed);
 }
 return {choices,needed,refresh,load};
});
