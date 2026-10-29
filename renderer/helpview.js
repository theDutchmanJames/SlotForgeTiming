// Help navigation and learning examples. The source articles stay in help.js.
(function(root){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plain=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&(amp|lt|gt|quot|#39|nbsp);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",nbsp:' '}[x])).replace(/\s+/g,' ').trim();
  const normal=s=>plain(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/pit\s*stops?/g,'pitstop').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const GROUPS=[
    ['events','Race setups & events',['home','setups','setupwords','types','distance','comparedist','heatraces','heatplan','rotation','teams','endurance','heatresults','heatfinals','totaltime']],
    ['systems','Race Systems',['fuel','tyrewear','tyretemperature','customtyres','weather','pushsave','safetycar','damage','carfailures','penaltytiers','bop','servicestop','resources','resourcerecovery','multiclass','classlabels','classpoints','virtualrivals','rivalracing','tokens','championships','championshippoints','systemforms','systemformsmore']],
    ['widgets','Race screens & widgets',[]],
    ['audio','Audio & appearance',['audio','ambient','audioconditions','audiocategories','audioevents','look']],
    ['hardware','Timing hardware',['hardware','arduino','arduinoracelock','interfacepages','parallel','phidget']],
    ['results','Results & race control',['results','start','screen','sectors','director','lanecards']],
    ['settings','Database & app settings',['database','settingsnavigation','copyandorder','calculations','performance','transfer']],
    ['network','Screens & network',['live','driverstats','network']]
  ];
  // Only these known destinations can navigate out of Help; articles never supply commands.
  const ROUTES={setups:{tab:'setup',setupSub:'setups'},fuel:{tab:'setup',setupSub:'fuel'},hardware:{tab:'settings',settingsSub:'hardware'},layouts:{tab:'custom',customSub:'layouts'},calculations:{tab:'settings',settingsSub:'calculations'}};
  const RELATED={fuel:['servicestop','pushsave','calculations'],laphighlights:['laphighlightbehaviour','widgetstatecolours','widgetappearance'],tyrewear:['customtyres','tyretemperature','servicestop'],hardware:['parallel','phidget','arduino'],widgetcomposer:['widgetfreecanvas','widgetcomposeroptions','widgetappearance']};
  function fuelExample(tank,burn,rate){
    const v=[tank,burn,rate].map(x=>typeof x==='string'&&x.trim()===''?NaN:Number(x));
    if(v.some(x=>!Number.isFinite(x)||x<=0)||v[0]>10000||v[1]>1000||v[2]>1000)return null;
    return {laps:v[0]/v[1],seconds:v[0]/v[2]};
  }
  function create(source){
    const topics=source.folders(),byId=new Map(topics.map(t=>[t.id,t]));
    const assigned=new Set(GROUPS.flatMap(g=>g[2]));
    const groups=GROUPS.map(([id,title,ids])=>({id,title,ids:(id==='widgets'?topics.filter(t=>!assigned.has(t.id)).map(t=>t.id):ids).filter(id=>byId.has(id))}));
    const groupOf=id=>groups.find(g=>g.ids.includes(id));
    const index=topics.map(t=>({...t,text:plain(t.body),titleKey:normal(t.title),key:normal(t.title+' '+t.note+' '+t.body+(t.id.startsWith('laphighlight')?' flash glow':''))}));
    const state={topic:'start-guide',query:'',mobile:false,opened:new Set(),articleOpened:new Set(),fuel:{tank:100,burn:2,rate:10}};
    function search(query){
      const q=normal(String(query||'').slice(0,200)),terms=q.split(' ').filter(Boolean);if(!terms.length)return [];
      return index.filter(t=>terms.every(w=>t.key.includes(w))).map(t=>({...t,score:t.titleKey===q?3:t.titleKey.includes(q)?2:terms.some(w=>t.titleKey.includes(w))?1:0})).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
    }
    const tone=id=>source.tones?.[id]||'';
    const attr=id=>tone(id)?` data-system="${tone(id)}"`:'';
    function select(id){if(id!=='start-guide'&&!byId.has(id))return false;state.topic=id;state.query='';state.mobile=false;state.opened.clear();const g=groupOf(id);if(g)state.opened.add(g.id);return true;}
    const links=ids=>ids.filter(id=>byId.has(id)).map(id=>`<button class="btn" type="button" data-help-topic="${id}">${esc(byId.get(id).title)} →</button>`).join('');
    function rail(){return `<button type="button" class="help-topic help-start" data-help-topic="start-guide"${state.topic==='start-guide'&&!state.query?' aria-current="page"':''}>Start here · Your first race</button><button class="btn help-browse" type="button" data-help-browse aria-expanded="${state.mobile}" aria-controls="help-groups">Browse help topics ▾</button><div id="help-groups" class="help-groups${state.mobile?' expanded':''}">${groups.map(g=>`<details data-help-group="${g.id}"${state.opened.has(g.id)?' open':''}><summary>${esc(g.title)}</summary>${g.ids.map(id=>`<button type="button" class="help-topic" data-help-topic="${id}"${attr(id)}${state.topic===id&&!state.query?' aria-current="page"':''}>${esc(byId.get(id).title)}</button>`).join('')}</details>`).join('')}</div><p class="help-offline">Available offline<br>${topics.length} topics · All themes</p>`;}
    const route=(id,label)=>`<button class="btn help-open" type="button" data-help-route="${id}">${esc(label)} ↗</button>`;
    function reader(){
      const q=state.query.trim();
      if(q){const hits=search(q);return `<div class="help-crumb">Help / Search</div><h3 tabindex="-1">Find an answer</h3><p class="muted" role="status">${hits.length} ${hits.length===1?'topic':'topics'} matching “${esc(q)}”</p>${hits.map(t=>`<button type="button" class="help-hit" data-help-topic="${t.id}"><strong>${esc(t.title)}</strong><small>${esc(groupOf(t.id)?.title)} · ${esc(t.note)}</small><span>${esc(snippet(t.text,q))}</span></button>`).join('')||'<p>No matching topics. Try “fuel”, “sensor” or “layout”.</p>'}`;}
      if(state.topic==='start-guide')return `<div class="help-crumb">Help / Start here</div>${source.WELCOME}<div class="help-actions">${route('setups','Open Race Setups')}<button class="btn" type="button" data-help-topic="hardware">Connect timing hardware →</button></div><h4>What would you like to do next?</h4><div class="help-related">${links(['fuel','widgetappearance','audio','laphighlights'])}</div>`;
      const t=byId.get(state.topic),id=t.id,g=groupOf(id);
      let content=`<div class="help-plain"><b>In plain words</b><p>${esc(t.note)}.</p></div><div class="help-article-body">${t.body}</div>`;
      if(id==='fuel')content=`<div class="help-plain"><b>In plain words</b><p>Cars use virtual fuel as they race. The tank size and consumption determine how far they can go; the refuel speed determines how long a stop takes.</p></div><h4>Try a base-fuel example</h4><div class="help-example"><div class="help-fields">${[['tank','Tank size · litres',10000],['burn','Use per lap · litres',1000],['rate','Refuel speed · litres/s',1000]].map(([key,label,max])=>`<label>${label}<input type="number" data-help-fuel="${key}" min="0.1" max="${max}" step="0.1" value="${state.fuel[key]}"></label>`).join('')}</div><div class="help-fuel-result" aria-live="polite">${fuelResult()}</div><p class="help-note">Learning example only. Race settings are not changed. Push &amp; Save and other active modifiers can change actual consumption.</p></div><div class="help-actions">${route('fuel','Open Fuel Systems')}</div>${more(t,'How the settings work together')}`;
      if(id==='laphighlights')content=`<div class="help-plain"><b>In plain words</b><p>A short inward glow shows that a lap registered. Green celebrates a personal best; purple celebrates a track record. You can change these colours.</p></div><h4>See the difference</h4><div class="help-example"><div class="help-lap-demo"><small>LAP TIME · LANE 1</small><strong>8.402</strong></div><div class="help-actions">${[['lap','Lap recorded'],['pb','Personal best'],['record','Track record']].map(([key,label])=>`<button class="btn" type="button" data-help-flash="${key}">${label}</button>`).join('')}</div></div><h4>Where to change it</h4><p><b>Layout Editor → Widget appearance → Race states &amp; Lap Highlights</b> sets the layout defaults. Select a widget and open the same folder to override them.</p><div class="help-actions">${route('layouts','Open Layouts')}</div>${more(t,'Colours, duration and per-widget settings')}`;
      if(id==='hardware')content+=`<div class="help-actions">${route('hardware','Open Timing Hardware')}</div>`;
      if(id==='calculations')content+=`<div class="help-actions">${route('calculations','Open Calculations')}</div>`;
      return `<article class="help-article"${attr(id)}><div class="help-crumb">Help / ${esc(g?.title)}</div><h3 tabindex="-1">${esc(id==='fuel'?'Fuel Systems':t.title)}</h3><p class="help-lead">${esc(t.note)}</p>${content}<h4>Related guides</h4><div class="help-related">${links(RELATED[id]||g.ids.filter(x=>x!==id).slice(0,3))}</div></article>`;
    }
    function more(t,title){return `<details class="help-more" data-help-more="${t.id}"${state.articleOpened.has(t.id)?' open':''}><summary>${title}</summary><div class="help-article-body">${t.body}</div></details>`;}
    function snippet(text,q){const terms=String(q).toLowerCase().split(/\s+/);const at=Math.max(0,terms.map(w=>text.toLowerCase().indexOf(w)).find(n=>n>=0)||0),start=Math.max(0,at-45);return (start?'…':'')+text.slice(start,start+190)+(text.length>start+190?'…':'');}
    function fuelResult(){const r=fuelExample(state.fuel.tank,state.fuel.burn,state.fuel.rate),fmt=n=>Number(n.toFixed(1)).toLocaleString();return r?`<div><small>Base range · tank ÷ use</small><strong>${fmt(r.laps)} laps</strong></div><div><small>Empty to full · tank ÷ rate</small><strong>${fmt(r.seconds)} seconds</strong></div>`:'Enter a positive value within each field’s range.';}
    function html(){return `<section class="help-hub" aria-label="Help and Guides"><header class="help-header"><div class="help-heading"><h2>Help &amp; Guides</h2><p>From your first lap to your own race experience.</p></div><label class="help-search">Find an answer<input type="search" data-help-search maxlength="200" placeholder="Try “pit stop”, “tyres” or “flash”…" value="${esc(state.query)}" aria-controls="help-reader"></label></header><div class="help-shell"><nav class="help-rail" aria-label="Help topics">${rail()}</nav><div id="help-reader" class="help-reader">${reader()}</div></div></section>`;}
    function render(box,options={}){
      box.innerHTML=html();
      const watch=()=>{box.querySelectorAll?.('[data-help-group]').forEach(el=>{el.ontoggle=()=>{if(el.isConnected===false)return;if(el.open){state.opened.clear();state.opened.add(el.dataset.helpGroup);box.querySelectorAll('[data-help-group]').forEach(other=>{if(other!==el)other.open=false;});}else state.opened.delete(el.dataset.helpGroup);};});box.querySelectorAll?.('[data-help-more]').forEach(el=>{el.ontoggle=()=>{if(el.isConnected===false)return;if(el.open)state.articleOpened.add(el.dataset.helpMore);else state.articleOpened.delete(el.dataset.helpMore);};});};
      const repaint=(focus=false)=>{const r=box.querySelector?.('#help-reader'),n=box.querySelector?.('.help-rail');if(!r||!n)return;r.innerHTML=reader();n.innerHTML=rail();watch();if(focus){r.querySelector('h3')?.focus({preventScroll:true});r.scrollIntoView?.({block:'nearest'});}};
      box.onclick=e=>{const b=e.target?.closest?.('button');if(!b)return;
        if(b.dataset.helpTopic&&select(b.dataset.helpTopic)){const input=box.querySelector?.('[data-help-search]');if(input)input.value='';repaint(true);}
        if(b.hasAttribute?.('data-help-browse')){state.mobile=!state.mobile;box.querySelector('.help-groups')?.classList.toggle('expanded',state.mobile);b.setAttribute('aria-expanded',String(state.mobile));}
        if(b.dataset.helpRoute&&ROUTES[b.dataset.helpRoute]&&options.onNavigate)Promise.resolve().then(()=>options.onNavigate({...ROUTES[b.dataset.helpRoute]})).catch(()=>{if(box.isConnected){const r=box.querySelector('#help-reader');if(r)r.insertAdjacentHTML('beforeend','<p role="alert">Could not open that page. Please try its tab.</p>');}});
        if(b.dataset.helpFlash){const demo=box.querySelector('.help-lap-demo'),L=typeof module!=='undefined'?require('./laphighlights'):root.LapHighlights;L?.pulse(demo,{appearance:{lapDuration:700}}, {},b.dataset.helpFlash==='lap'?'':b.dataset.helpFlash);}
      };
      box.oninput=e=>{if(e.target?.hasAttribute?.('data-help-search')){state.query=e.target.value.slice(0,200);repaint();}const key=e.target?.dataset?.helpFuel;if(['tank','burn','rate'].includes(key)){state.fuel[key]=e.target.value;const result=box.querySelector('.help-fuel-result');if(result)result.innerHTML=fuelResult();}};
      box.onkeydown=e=>{if(e.key==='Escape'&&e.target?.hasAttribute?.('data-help-search')){state.query='';e.target.value='';repaint();}};
      watch();
    }
    return {html,render,search,groups,select,state};
  }
  const api={create,plain,normal,fuelExample,ROUTES};root.HelpView=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
