// Shared presentation only: saved font references never contain local font files.
(function(root){
  'use strict';
  const FAMILIES={
    theme:{label:'Original / theme',family:'"Segoe UI", system-ui, sans-serif',weights:[400,700]},
    inter:{label:'Inter — clear and versatile',family:'"SF Inter", sans-serif',weights:[100,200,300,400,500,600,700,800,900]},
    highvis:{label:'High Visibility — Inter Black',family:'"SF Inter", sans-serif',weights:[900]},
    condensed:{label:'Barlow Condensed — compact',family:'"SF Barlow Condensed", sans-serif',weights:[400,700,900]},
    mono:{label:'Roboto Mono — timing figures',family:'"SF Roboto Mono", monospace',weights:[100,200,300,400,500,600,700]}
  };
  const roles=['title','value','support'], local=new Map(), loads=new Map(), states=new Map(), bindings=new WeakMap(), settled=new Set();
  const loadKey=(id,weight,italic)=>id+':'+weight+':'+!!italic;
  const ready=(id,weight,italic)=>id==='theme'||!root.document?.fonts||settled.has(loadKey(id,weight,italic));
  const notifications=new Map();let notificationFrame=null;
  function notify(el,binding){
    notifications.set(el,binding);if(notificationFrame!==null)return;
    notificationFrame=root.requestAnimationFrame(()=>{
      notificationFrame=null;const elements=[];
      for(const [node,b]of notifications)if(node.isConnected&&bindings.get(node)===b){b.refit?.();elements.push(node);}
      notifications.clear();
      if(elements.length)root.dispatchEvent(new root.CustomEvent('widget-fonts-ready',{detail:{elements}}));
    });
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const quote=v=>'"'+String(v).replace(/[\\"]/g,'\\$&')+'"';
  const valid=id=>typeof id==='string'&&(Object.hasOwn(FAMILIES,id)||/^local:[^\x00-\x1f\x7f"'<>;{}\\]{1,120}$/.test(id));
  function clean(raw){const out={};for(const role of roles){const id=raw?.[role];if(valid(id)||(role==='support'&&id==='same'))out[role]=id;const w=Number(raw?.[role+'Weight']);if(Number.isInteger(w)&&w>=100&&w<=900&&w%100===0)out[role+'Weight']=w;}return out;}
  const enabled=(w,l)=>Object.keys(clean(w?.fonts)).length+Object.keys(clean(l?.widgetFonts)).length>0;
  const family=id=>FAMILIES[id]?.family||(valid(id)?quote(id.slice(6))+', "SF Inter", sans-serif':FAMILIES.theme.family);
  const weights=id=>FAMILIES[id]?.weights||local.get(id)?.weights||[100,200,300,400,500,600,700,800,900];
  function resolve(w={},l={}){
    const own=clean(w.fonts), base=clean(l.widgetFonts), r={...base,...own};
    for(const role of roles){let id=r[role]||(role==='support'?'same':'theme');if(id==='same')id=r.value||'theme';r[role]=id;
      const requested=r[role+'Weight'];r[role+'Weight']=id==='highvis'?900:requested?(id.startsWith('local:')?requested:weights(id).reduce((a,b)=>Math.abs(b-requested)<Math.abs(a-requested)?b:a)):null;}
    return r;
  }
  const status=id=>id?.startsWith('local:')?(states.get(id)||'Checking this device…'):'';
  function updateStatus(){if(!root.document)return;root.document.querySelectorAll('[data-wf-status]').forEach(e=>e.textContent=status(e.dataset.wfStatus));}
  function load(id,weight=400,italic=false){
    if(!root.document?.fonts||id==='theme')return Promise.resolve();
    const key=loadKey(id,weight,italic);if(loads.has(key))return loads.get(key);
    const p=(async()=>{
      if(id.startsWith('local:')){
        try{await new root.FontFace('sf-local-probe',`local(${quote(id.slice(6))})`).load();states.set(id,'Available on this device. Other devices may use Inter.');}
        catch{states.set(id,'Not available here — using bundled Inter. Saved selection is kept.');}
        await root.document.fonts.load(`${italic?'italic ':''}${weight} 24px "SF Inter"`);
      }
      await root.document.fonts.load(`${italic?'italic ':''}${weight} 24px ${family(id)}`);
    })().catch(()=>{states.set(id,'Font could not load. Using the fallback font.');}).then(()=>root.document.fonts.ready).finally(()=>{settled.add(key);updateStatus();});
    loads.set(key,p);return p;
  }
  function declarations(w,l){if(!enabled(w,l))return '';const r=resolve(w,l);return roles.map(role=>`--wf-${role}-font:${family(r[role])}${r[role+'Weight']?';--wf-'+role+'-weight:'+r[role+'Weight']:''}`).join(';');}
  function configured(w,l){const raw={...clean(l?.widgetFonts),...clean(w?.fonts)};return {title:!!raw.title,value:!!raw.value,support:raw.support&&raw.support!=='same'?true:!!raw.value};}
  function attributes(w,l,header=false){if(!enabled(w,l))return '';const flags=configured(w,l),r=resolve(w,l);return ' data-wf'+roles.map(role=>(flags[role]?' data-wf-'+role+'-font':'')+(r[role+'Weight']?' data-wf-'+role+'-weight':'')).join('')+(header?' data-wf-header':'');}
  function apply(el,w,l,refit){
    if(!el?.style)return;const on=enabled(w,l),r=resolve(w,l),flags=configured(w,l);
    const key=JSON.stringify([r,flags,!!w.valueItalic,!!w.titleItalic]),prior=bindings.get(el);
    if(on&&prior?.key===key){if(refit)prior.refit=refit;return;}
    el.toggleAttribute('data-wf',on);
    for(const role of roles){el.toggleAttribute('data-wf-'+role+'-font',on&&flags[role]);el.toggleAttribute('data-wf-'+role+'-weight',on&&!!r[role+'Weight']);for(const [suffix,value]of [['font',family(r[role])],['weight',r[role+'Weight']]]){const key='--wf-'+role+'-'+suffix;if(on&&value)el.style.setProperty(key,String(value));else el.style.removeProperty(key);}}
    if(!on){bindings.delete(el);return;}
    const binding={key,refit:refit||prior?.refit};bindings.set(el,binding);
    const requests=roles.map(role=>[r[role],r[role+'Weight']||(role==='title'?(w.titleBold?700:400):w.valueBold===false?400:700),role==='title'?w.titleItalic:w.valueItalic]);
    // The caller fits synchronously after applying these styles. A cached,
    // already-loaded font needs no second fit merely because a node is new.
    if(requests.every(args=>ready(...args)))return;
    Promise.all(requests.map(args=>load(...args))).then(()=>{
      if(!el.isConnected||bindings.get(el)!==binding)return;
      notify(el,binding);
    });
  }
  // Used by leaderboard HTML, which is also rendered without a live canvas.
  function rowStyle(w,l,header=false){if(!enabled(w,l))return '';const r=resolve(w,l),role=header?'title':'value';roles.forEach(k=>load(r[k],r[k+'Weight']||400));return esc(`;font-family:${family(r[role])}${r[role+'Weight']?';font-weight:'+r[role+'Weight']:''};${declarations(w,l)}`);}
  async function scan(){
    if(typeof root.queryLocalFonts!=='function')throw Error('Installed-font browsing is unavailable here. Use the desktop app, or choose a bundled font.');
    let timeout;
    const fonts=await Promise.race([root.queryLocalFonts(),new Promise((_,reject)=>{timeout=root.setTimeout(()=>reject(Error('Font browsing did not respond. Keep the app window active and try again; bundled fonts remain available.')),15000);})]).finally(()=>root.clearTimeout(timeout));local.clear();
    for(const f of fonts){const id='local:'+f.family;if(!valid(id))continue;const entry=local.get(id)||{label:f.family,weights:[]};const style=f.style.toLowerCase();const weight=/black|heavy/.test(style)?900:/extra.?bold|ultra.?bold/.test(style)?800:/semi.?bold|demi/.test(style)?600:/bold/.test(style)?700:/medium/.test(style)?500:/extra.?light|ultra.?light/.test(style)?200:/light/.test(style)?300:/thin/.test(style)?100:400;if(!entry.weights.includes(weight))entry.weights.push(weight);entry.weights.sort((a,b)=>a-b);local.set(id,entry);}
    return local.size;
  }
  function panel(w,l,selection=[w],defaults=false){
    const own=clean(w.fonts), resolved=resolve(w,l);
    if(enabled(w,l))roles.forEach(role=>load(resolved[role],resolved[role+'Weight']||400));
    const controls=roles.map(role=>{
      const mixed=selection.some(x=>clean(x.fonts)[role]!==own[role]);const selected=own[role]||'';
      const opts=[['',defaults?'Original / default': 'Follow layout'],...(role==='support'?[['same','Same as value']]:[]),...Object.entries(FAMILIES).map(([id,f])=>[id,f.label]),...Array.from(local,([id,f])=>[id,f.label]).sort((a,b)=>a[1].localeCompare(b[1]))];
      if(selected.startsWith('local:')&&!local.has(selected))opts.push([selected,selected.slice(6)+' (saved font)']);
      const option=([id,label])=>`<option value="${esc(id)}"${!mixed&&selected===id?' selected':''}>${esc(label)}</option>`;
      const installed=opts.filter(([id])=>id.startsWith('local:'));
      const menu=opts.filter(([id])=>!id||id==='same').map(option).join('')+'<optgroup label="Bundled / original">'+opts.filter(([id])=>Object.hasOwn(FAMILIES,id)).map(option).join('')+'</optgroup>'+(installed.length?'<optgroup label="Installed on this computer / saved selection">'+installed.map(option).join('')+'</optgroup>':'');
      const name={title:'Title',value:'Value',support:'Supporting text'}[role];
      const weightKey=role+'Weight', weightMixed=selection.some(x=>clean(x.fonts)[weightKey]!==own[weightKey]);
      return `<label class="ws-control"><span>${name} font</span><select data-ws="fonts" data-key="${role}" aria-label="${name} font">${mixed?'<option selected disabled value="">Different values</option>':''}${menu}</select></label><label class="ws-control"><span>${name} weight</span><select data-ws="fonts" data-key="${weightKey}">${weightMixed?'<option selected disabled value="">Different values</option>':''}<option value=""${!weightMixed&&!own[weightKey]?' selected':''}>${resolved[role]==='highvis'?'Black (900)':'Follow layout / original'}</option>${weights(resolved[role]).map(n=>`<option value="${n}"${!weightMixed&&own[weightKey]===n?' selected':''}>${({400:'Regular',500:'Medium',600:'Semibold',700:'Bold',800:'Extra bold',900:'Black'})[n]||'Light'} (${n})</option>`).join('')}</select></label>${resolved[role].startsWith('local:')?`<small class="wf-status" data-wf-status="${esc(resolved[role])}">${esc(status(resolved[role]))}</small>`:''}`;
    }).join('');
    return `<section class="ws-section" data-ws-group="fonts"><h4>Fonts</h4><div class="ws-fields">${controls}</div><div class="wf-preview" style="${esc(declarations(w,l))}" data-wf><small>BEST LAP · James</small><strong>01:23.456</strong><span>Tyres 75% · +0.250</span></div><div class="row"><button type="button" class="btn" data-ws-action="font-scan">Browse installed fonts</button><button type="button" class="btn" data-ws-action="font-highvis">High Visibility fonts</button><button type="button" class="btn" data-ws-action="font-reset">Use ${defaults?'original':'layout'} fonts</button></div><p class="muted hint">Bundled fonts work offline on every display. Installed fonts stay on this computer; other devices use Inter if missing. Fonts change lettering, not widget size. Text sizing and Shrink to fit still apply. Digital clock segments and icon artwork keep their design.</p></section>`;
  }
  function change(w,key,value){const next=clean(w.fonts);if(value==='')delete next[key];else next[key]=value;if(roles.includes(key))delete next[key+'Weight'];w.fonts=clean(next);if(!Object.keys(w.fonts).length)delete w.fonts;}
  function highVisibility(w){w.fonts={title:'highvis',value:'highvis',support:'inter',supportWeight:700};}
  const api={FAMILIES,clean,enabled,resolve,family,weights,apply,rowStyle,attributes,panel,change,scan,load,status,highVisibility};root.WidgetFonts=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
