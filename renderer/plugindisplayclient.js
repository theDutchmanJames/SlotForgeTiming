// Only the main renderer asks the supervised worker for views. Remote displays
// receive the resulting data through LiveShare; they never execute plugin code.
const PluginDisplayClient=(()=>{
 const D=PluginDisplay,demands=new Map(),cache=new Map();let catalog=[],busy=false,timer=null,catalogAt=0,page=null;
 const session=S=>String(S.raceId||(S.preview?'preview':'race'));
 function read(req,S){const owner=session(S),key=owner+'|'+req.key;demands.set(key,{req,S,owner,at:performance.now()});return cache.get(key);}
 async function refresh(){if(typeof api.pluginDisplayCatalog!=='function')return;try{catalog=await api.pluginDisplayCatalog();catalogAt=Date.now();}catch{catalog=[];}}
 function options(w){const scope=w.type==='pluginlane'?'lane':'race',entries=catalog.flatMap(p=>p.display.widgets.filter(d=>d.scope===scope).map(d=>({p,d,key:p.id+'/'+d.id}))),selected=entries.find(x=>x.key===w.opt?.pluginView),choices=[['','Choose a plugin widget'],...entries.map(x=>[x.key,x.p.name+' · '+x.d.label+(x.p.state==='running'?'':' (stopped)')])];
  if(w.opt?.pluginView&&!selected)choices.push([w.opt.pluginView,'Missing plugin — saved selection']);
  return [{key:'pluginView',label:'Plugin widget',type:'select',choices,default:'',rerender:true,hint:'Install and start code plugins under App Settings → Plugins. Settings remain saved if a plugin is missing.'},...(selected?.d.settings||[]).map(f=>({key:'plugin_'+f.id,label:f.label,type:f.type==='boolean'?'checkbox':f.type,default:f.default,min:f.min,max:f.max,step:'any',...(f.choices?{choices:f.choices.map(v=>[v,v])}:{})}))];
 }
 function demandLayout(layout,S){for(const w of layout?.widgets||[])if(D.TYPES.has(w.type)){const r=D.request(w);if(r)read(r,S);}}
 function raceViews(id){const out={};for(const [k,v] of cache)if(k.startsWith(id+'|')&&demands.get(k)?.req.kind==='widgets')out[k.slice(id.length+1)]=v;return out;}
 function editor(){if(typeof state==='undefined'||!state.editing||!document.getElementById('canvas'))return;const ed=state.editing;
  for(const el of document.querySelectorAll('#canvas .lw[data-i]')){const w=ed.draft.widgets[Number(el.dataset.i)];if(!w||!D.TYPES.has(w.type))continue;const val=el.querySelector(':scope > .lw-val');if(!val)continue;const S=WidgetPreview.state(w,{layout:ed.draft}),out=Timing.content(w,S);if(val.innerHTML!==out.html){val.innerHTML=out.html;WidgetView.fit({el,val,w,layout:ed.draft},out);}}
 }
 async function tick(){if(busy||typeof api.pluginDisplayRender!=='function')return;
  if(!document.hidden){editor();page?.demand();}
  const now=performance.now();for(const [k,v] of demands)if(now-v.at>1200){demands.delete(k);cache.delete(k);}
  if(!demands.size)return;busy=true;
  try{if(Date.now()-catalogAt>5000)await refresh();
   // One bounded batch per context, at most two contexts (race + preview).
   const owners=[...new Set([...demands.values()].map(v=>v.owner))].slice(0,2);
   for(const owner of owners){const all=[...demands.values()].filter(v=>v.owner===owner),batch=all.slice(0,32);for(const x of all.slice(32))cache.set(owner+'|'+x.req.key,{error:'Limit: 32 distinct plugin displays per race or preview.'});if(!batch.length)continue;
    // Different contexts use alternating ticks so IPC is never a tight loop.
    if(owners.length>1&&owner!==owners[Math.floor(now/500)%owners.length])continue;
    const S=batch.at(-1).S;let result;try{result=await api.pluginDisplayRender(D.snapshot(S),batch.map(x=>x.req));}catch(e){result=Object.fromEntries(batch.map(x=>[x.req.key,{error:String(e.message||e).slice(0,300)}]));}
    for(const x of batch){const k=owner+'|'+x.req.key;if(demands.get(k)?.owner===owner)cache.set(k,result[x.req.key]||{error:'No plugin display returned.'});}
   }
   if(!document.hidden){editor();page?.paint();}
  }finally{busy=false;}
 }
 function init(){if(timer||typeof api.pluginDisplayRender!=='function')return;refresh();timer=setInterval(()=>tick().catch(()=>{}),500);}
 return {init,refresh,read,options,demandLayout,raceViews,catalog:()=>catalog,setPage:p=>{page=p;},tick};
})();
window.PluginDisplayClient=PluginDisplayClient;
