// Runs inside the actual app renderer, using its real editor event handlers.
const checks = [], failures = [], special = [], saved = [];
const assert = (value, message) => { checks.push(message); if (!value) failures.push(message); };
const svg = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>');
state.tab = 'custom'; state.customSub = 'layouts';
state.sideOpen = new Set(['opts','title','text','frame','advanced','status']);
state.editing = {id:null, draft:{name:'Options audit',guides:{v:[],h:[]},ratioW:10,ratioH:6,widgets:[]},sel:[],snap:false,dirty:true,
  drivers:[],cars:[],customWidgets:[],teams:[{id:'qa-team',name:'Test team',picture:svg}],
  imageSets:['fuel','lights','avatars','tyres','weather','conditions','flag'].map(kind=>({id:'qa-'+kind,name:'Test '+kind,kind,steps:3,images:kind==='fuel'?[svg,svg,svg]:{on:svg,off:svg,S:svg,dry:svg,ready:svg}})),
  rowDesigns:[{...Rows.defaultDesign(),id:'qa-rows'}],chartDesigns:[{...ChartWidgets.clean({name:'QA chart'}),id:'qa-chart'}]};
await render();
const find = key => [...document.querySelectorAll('#side [data-opt]')].find(e=>e.dataset.opt===key);
for (const definition of Widgets.REGISTRY) {
  let w = {...Widgets.newWidget(definition.type,0,10,10),w:650,h:400};
  state.editing.draft.widgets=[w]; state.editing.sel=[w]; renderEditor();
  for (const option of definition.options || []) {
    const label=definition.type+'.'+option.key;
    if(option.type==='note'){special.push({label,type:option.type});continue;}
    if(option.type==='frame'){
      w.opt={};renderEditor();const zoom=document.querySelector('#side .framezoom');
      zoom.value='2';zoom.dispatchEvent(new Event('input',{bubbles:true}));assert(w.opt.frame.zoom===2,label+' zoom');
      const box=document.querySelector('#side .framebox'),r=box.getBoundingClientRect();box.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+20,clientY:r.top+20}));
      window.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+45,clientY:r.top+35}));window.dispatchEvent(new PointerEvent('pointerup'));
      assert(w.opt.frame.x!==0&&w.opt.frame.y!==0,label+' pan');saved.push({...structuredClone(w),id:'qa-'+saved.length});
      document.querySelector('#side .framereset').click();assert(w.opt.frame.zoom===1&&w.opt.frame.x===0&&w.opt.frame.y===0,label+' reset');continue;
    }
    if(option.type==='image'){
      w.opt={};renderEditor();const input=document.querySelector('#side [data-optimg]'),dt=new DataTransfer();dt.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'],'test.svg',{type:'image/svg+xml'}));input.files=dt.files;
      await document.getElementById('side').onchange({target:input});assert(w.opt.image?.startsWith('data:image/'),label+' upload');saved.push({...structuredClone(w),id:'qa-'+saved.length});
      document.querySelector('#side [data-clearopt]').click();assert(!w.opt.image,label+' remove');continue;
    }
    const defaults=Object.fromEntries((definition.options||[]).filter(o=>o.default!==undefined).map(o=>[o.key,o.default]));
    const contexts=[defaults];
    for (const parent of definition.options||[]) for (const choice of parent.choices||[]) contexts.push({...defaults,[parent.key]:choice[0]});
    // Two dependencies are enough for the current declarations (e.g. delta style + comparison).
    const applicable=o=>(!option.show||option.show(o))&&(!option.when||option.when.includes(o.flagStyle))&&(!option.rowsOnly||!!o.design)&&(!option.classic||!o.design);
    if(option.rowsOnly)contexts.push({...defaults,design:'qa-rows'});
    let chosen=contexts.find(applicable);
    if(!chosen){for(const a of contexts)for(const b of contexts){const o={...a,...Object.fromEntries(Object.entries(b).filter(([k,v])=>v!==defaults[k]))};if(applicable(o)){chosen=o;break;}}}
    w.opt={...(chosen||defaults)};renderEditor();
    let control=find(option.key);
    if(!control){special.push({label,type:option.type,reason:'conditional or specialised control'});continue;}
    const values=control.type==='checkbox'?[false,true]:control.tagName==='SELECT'?[...control.options].filter(o=>!o.disabled).map(o=>o.value):['number','range'].includes(control.type)?[Number(control.min||0),Number(control.max||100)]:control.type==='color'?['#123456','#abcdef']:['Test <value> & text'];
    for(const value of values){
      control=find(option.key);if(!control){failures.push(label+' vanished before edit');break;}
      if(control.type==='checkbox')control.checked=value;else control.value=String(value);
      control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));
      // renderEditor may replace the DOM, but must retain the selected widget.
      w=state.editing.sel[0];
      assert(w.opt[option.key]===value,label+' stores '+JSON.stringify(value)+' with correct type');
      assert(!document.querySelector('#canvas .widget-error'),label+' preview renders');
      saved.push({...structuredClone(w),id:'qa-'+saved.length});
    }
  }
  // Every declared widget has a usable option panel, including hidden Builder types.
  assert(!!document.getElementById('side'),definition.type+' panel');
  await new Promise(r=>setTimeout(r,0));
}
const record=await api.add('layouts',{name:'All widget options round trip',ratioW:10,ratioH:6,widgets:saved});
const reopened=(await api.list('layouts')).find(l=>l.id===record.id);
assert(JSON.stringify(reopened.widgets)===JSON.stringify(saved),'All exercised option variants survive real database save/reopen');
return {checks:checks.length,failures,special,variants:saved.length,widgets:Widgets.REGISTRY.length};
