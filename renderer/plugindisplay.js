// Display API 1. Data only: this module never evaluates plugin HTML, CSS or JS.
(function(root){
  const fail=m=>{throw Error(m);}, obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const check=(v,m)=>{if(!v)fail(m);};
  const keys=(v,allowed)=>{check(obj(v),'Expected an object.');check(Object.keys(v).every(k=>allowed.includes(k)),'Unsupported display field.');};
  const text=(v,max=200)=>{check(typeof v==='string'&&v.length<=max&&!/[\x00-\x08\x0b-\x1f]/.test(v),'Invalid display text.');return v;};
  const id=v=>{check(typeof v==='string'&&/^[a-z][a-z0-9_-]{0,39}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v),'Invalid contribution ID.');return v;};
  const num=(v,min,max)=>{check(Number.isFinite(v)&&v>=min&&v<=max,'Display number outside range.');return v;};
  function fields(raw=[]){check(Array.isArray(raw)&&raw.length<=12,'Too many input fields.');const seen=new Set();return raw.map(f=>{
    keys(f,['id','label','type','default','min','max','choices']);const n={id:id(f.id),label:text(f.label,80),type:f.type};check(n.label.trim().length>0,'Input label is empty.');check(!seen.has(n.id),'Duplicate input ID.');seen.add(n.id);
    check(['text','number','boolean','select'].includes(n.type),'Unsupported input type.');
    if(n.type==='number'){n.min=num(f.min,-1e9,1e9);n.max=num(f.max,n.min,1e9);}
    if(n.type==='select'){check(Array.isArray(f.choices)&&f.choices.length>0&&f.choices.length<=24,'Invalid input choices.');n.choices=f.choices.map(v=>text(v,100));check(new Set(n.choices).size===n.choices.length,'Duplicate choices.');}
    n.default=value(n,f.default);return n;
  });}
  function value(f,v){if(f.type==='text')return text(v,200);if(f.type==='number')return num(v,f.min,f.max);if(f.type==='boolean'){check(typeof v==='boolean','Expected on or off.');return v;}check(f.choices.includes(v),'Unknown choice.');return v;}
  function inputs(schema,raw={}){keys(raw,schema.map(f=>f.id));return Object.fromEntries(schema.map(f=>[f.id,value(f,raw[f.id]===undefined?f.default:raw[f.id])]));}
  function descriptor(raw){keys(raw,['api','widgets','pages','tools']);check(raw.api===1,'Unsupported display API.');const result={api:1};
    for(const kind of ['widgets','pages','tools']){const list=raw[kind]||[];check(Array.isArray(list)&&list.length<=12,'Too many contributions.');const seen=new Set();result[kind]=list.map(d=>{
      keys(d,kind==='widgets'?['id','label','description','scope','settings']:['id','label','description','settings']);const n={id:id(d.id),label:text(d.label,80),description:text(d.description||'',500),settings:fields(d.settings)};
      check(n.label.trim().length>0,'Contribution label is empty.');check(!seen.has(n.id),'Duplicate contribution ID.');seen.add(n.id);if(kind==='widgets'){check(['lane','race'].includes(d.scope),'Choose lane or race widget scope.');n.scope=d.scope;}return n;
    });}return result;
  }
  const tones=['normal','muted','green','amber','red','blue','purple','lane'];
  function view(raw){let count=0;function visit(n,depth){check(++count<=64&&depth<=6,'Display is too complex.');keys(n,['kind','text','label','value','min','max','tone','children','points']);check(['text','metric','bar','row','column','line'].includes(n.kind),'Unknown display block.');const o={kind:n.kind};
    if(n.tone!==undefined){check(tones.includes(n.tone),'Unknown display tone.');o.tone=n.tone;}
    if(['text','metric'].includes(n.kind))o.text=text(n.text,500);
    if(n.label!==undefined)o.label=text(n.label,120);
    if(n.kind==='bar'){o.min=num(n.min??0,-1e9,1e9);o.max=num(n.max??100,-1e9,1e9);check(o.max>o.min,'A bar needs a positive range.');o.value=num(n.value,o.min,o.max);}
    if(n.kind==='line'){check(Array.isArray(n.points)&&n.points.length>=2&&n.points.length<=120,'A line needs 2–120 points.');o.points=n.points.map(p=>num(p,-1e9,1e9));}
    if(['row','column'].includes(n.kind)){check(Array.isArray(n.children)&&n.children.length>0&&n.children.length<=16,'Invalid display children.');o.children=n.children.map(x=>visit(x,depth+1));}
    return o;
  }const result=visit(raw,0);check(JSON.stringify(result).length<=16000,'Display is too large.');return result;}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function html(raw){const draw=n=>{const label=n.label?`<small>${esc(n.label)}</small>`:'',cls=`pd-block pd-${n.kind} pd-${n.tone||'normal'}`;
    if(n.children)return `<div class="${cls}">${n.children.map(draw).join('')}</div>`;
    if(n.kind==='bar')return `<div class="${cls}">${label}<div class="pd-track" role="meter" aria-label="${esc(n.label||'Value')}" aria-valuemin="${n.min}" aria-valuemax="${n.max}" aria-valuenow="${n.value}"><i style="width:${100*(n.value-n.min)/(n.max-n.min)}%"></i></div></div>`;
    if(n.kind==='line'){const lo=Math.min(...n.points),hi=Math.max(...n.points),span=hi-lo||1;return `<div class="${cls}">${label}<svg viewBox="0 0 300 80" role="img" aria-label="${esc(n.label||'Trend')}"><polyline fill="none" stroke="currentColor" stroke-width="3" points="${n.points.map((v,i)=>`${3+i*294/(n.points.length-1)},${77-(v-lo)*74/span}`).join(' ')}"/></svg><small>${esc(lo)} – ${esc(hi)}</small></div>`;}
    return `<div class="${cls}">${label}<span>${esc(n.text)}</span></div>`;
  };return `<div class="plugin-view">${draw(view(raw))}</div>`;}
  const TYPES=new Set(['pluginlane','pluginrace']);
  function request(w){const source=String(w.opt?.pluginView||''),split=source.lastIndexOf('/');if(split<1)return null;const plugin=source.slice(0,split),item=source.slice(split+1),settings=Object.fromEntries(Object.entries(w.opt||{}).filter(([k])=>k.startsWith('plugin_')).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k.slice(7),v]));const lane=w.type==='pluginlane'?w.lane:null;return {key:JSON.stringify([source,lane,settings]),plugin,item,lane,settings,kind:'widgets'};}
  function content(w,S){const req=request(w);if(!req)return {html:html({kind:'text',text:'Choose a plugin widget in Content settings.',tone:'muted'})};
    const entry=S.pluginViews!==undefined?S.pluginViews[req.key]:root.PluginDisplayClient?.read(req,S);
    try{return {html:entry?.view?html(entry.view).replace('class="plugin-view"',`class="plugin-view" style="--pd-lane:${/^#[0-9a-f]{6}$/i.test(S.layout?.laneColors?.[w.lane]?.bg||'')?S.layout.laneColors[w.lane].bg:'currentColor'}"`):html({kind:'text',text:entry?.error||'Plugin unavailable — start it in App Settings → Plugins.',tone:'muted'})};}catch{return {html:html({kind:'text',text:'Invalid plugin display',tone:'red'})};}
  }
  function snapshot(S){const scalar=v=>Object.fromEntries(Object.entries(v).filter(([,x])=>x===null||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x)||typeof x==='string'&&x.length<=500));const T=root.Timing||(typeof module!=='undefined'?require('./timing'):null),now=S.now;
    return {api:1,session:String(S.raceId||'preview'),preview:!!S.preview,phase:String(S.phase||'ready'),elapsedMs:Math.max(0,S.eng.elapsed(now)),track:String(S.track?.name||'').slice(0,200),race:scalar(T.composeValues(S,null,now)),lanes:Array.from({length:8},(_,lane)=>{const c=S.carByLane(lane);return c?{lane,values:scalar(T.composeValues(S,c,now)),lapStartIndex:Math.max(0,(c.laps||[]).length-100),lapTimesMs:(c.laps||[]).slice(-100),invalidLapIndices:(c.invalid||[]).filter(i=>i>=Math.max(0,(c.laps||[]).length-100)&&i<(c.laps||[]).length).slice(-100)}:null;}).filter(Boolean)};
  }
  function cleanSnapshot(s){keys(s,['api','session','preview','phase','elapsedMs','track','race','lanes']);check(s.api===1&&typeof s.preview==='boolean','Invalid snapshot.');text(s.session,100);text(s.phase,40);text(s.track,200);num(s.elapsedMs,0,1e15);const scalars=v=>{check(obj(v)&&Object.keys(v).length<=180,'Invalid snapshot values.');for(const [k,x] of Object.entries(v)){check(/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k)&&!['constructor','prototype'].includes(k),'Invalid value name.');check(x===null||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x)||typeof x==='string'&&x.length<=500,'Invalid snapshot value.');}};scalars(s.race);check(Array.isArray(s.lanes)&&s.lanes.length<=8,'Invalid lanes.');const seen=new Set();s.lanes.forEach(l=>{keys(l,['lane','values','lapTimesMs','invalidLapIndices','lapStartIndex']);if(l.lapStartIndex!==undefined)check(Number.isSafeInteger(l.lapStartIndex)&&l.lapStartIndex>=0,'Invalid lap sample origin.');check(Number.isInteger(l.lane)&&l.lane>=0&&l.lane<8&&!seen.has(l.lane),'Invalid lane.');seen.add(l.lane);scalars(l.values);for(const k of ['lapTimesMs','invalidLapIndices']){check(Array.isArray(l[k])&&l[k].length<=100,'Invalid lap samples.');l[k].forEach(n=>{num(n,0,1e15);if(k==='invalidLapIndices')check(Number.isSafeInteger(n)&&(l.lapStartIndex===undefined||n>=l.lapStartIndex&&n<l.lapStartIndex+l.lapTimesMs.length),'Invalid lap index.');});}});check(JSON.stringify(s).length<=64000,'Snapshot too large.');return JSON.parse(JSON.stringify(s));}
  const api={descriptor,fields,inputs,view,html,request,content,snapshot,cleanSnapshot,TYPES,esc};root.PluginDisplay=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
