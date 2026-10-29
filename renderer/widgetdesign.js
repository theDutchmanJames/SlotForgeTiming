// Optional presentation tools. Never write to the timing engine or race data.
(function(root) {
  const frame=()=>root.Frame||(typeof require==='function'?require('./frame.js'):null);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v));
  const num=(v,min,max,fallback)=>finite(v)?Math.min(max,Math.max(min,Number(v))):fallback;
  const FORMAT_TYPES=new Set(['laptime','lastlap','bestlap','avglap','medlap','recordlap','sessionrecord','trackrecord','gap','totaltime','lap','racelaps','lapstogo','position','fuel','tyrelife','pace','pitstop','speed','distance','distleft','clock','tokenclock','champpoints','classpoints','classposition','classgap','classbest', 'aiolane','aiotiming','aiodriver','aiopit','aiorace','aiostrategy','aioresults']);
  function formatOptions(raw={}) {return {digits:Math.round(num(raw.digits,-1,3,-1)),units:['beside','below','hidden'].includes(raw.units)?raw.units:'beside',fraction:Math.round(num(raw.fraction,50,100,100)),sign:raw.sign===true,clock:raw.clock===true};}
  function formatValue(text,raw={}) {
    const f=formatOptions(raw);
    const ratio=/^(\d+)\/(\d+)$/.exec(String(text).trim());if(ratio)return formatValue(ratio[1],{...f,clock:false})+' / '+formatValue(ratio[2],{...f,sign:false,clock:false});
    const m=/^([+−-]?)(\d+(?::\d{1,2})*(?:\.\d+)?)(\s*(?:%|s|ms|L|l|laps?|m|km|ft|mi|mph|km\/h))?$/.exec(String(text).trim());
    if(!m)return null;
    const parts=m[2].split(':'),isClock=parts.length>1,originalDigits=(parts.at(-1).split('.')[1]||'').length;
    const digits=f.digits<0?Math.min(20,originalDigits):f.digits;
    let value=parts.reduce((n,p)=>n*60+Number(p),0),body;
    if(!Number.isFinite(value))return null;
    // Round before splitting minutes so 59.999 -> 01:00.00, never 00:60.00.
    value=Number(value.toFixed(digits));
    if(isClock||f.clock){const minutes=Math.floor(value/60),seconds=(value-minutes*60).toFixed(digits).padStart(digits?digits+3:2,'0');body=(parts.length>2?String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0'):String(minutes).padStart(2,'0'))+':'+seconds;}
    else body=value.toFixed(digits);
    const sign=m[1]||(f.sign&&value>0?'+':''),split=body.split('.');
    const fraction=split[1]===undefined?'':`<span class="wd-fraction" style="font-size:${f.fraction}%">.${split[1]}</span>`;
    const unit=(m[3]||'').trim();
    const reading=`<span class="wd-number">${esc(sign+split[0])}${fraction}</span>${unit&&f.units!=='hidden'?`<span class="wd-unit${f.units==='below'?' wd-unit-below':''}">${esc(unit)}</span>`:''}`;
    // Keep number and unit in one flex item; display:block on the unit alone
    // cannot put it below a sibling when the widget value is a flex container.
    return unit&&f.units==='below'?`<span class="wd-value">${reading}</span>`:reading;
  }
  const formatted=new WeakMap();
  function formatDOM(el,w) {
    if(!el?.querySelectorAll||!FORMAT_TYPES.has(w.type))return;
    // Digital clocks own their segment geometry; their original formatting remains explicit.
    if(w.type==='clock'&&w.opt?.style&&w.opt.style!=='classic')return;
    const val=el.querySelector(':scope > .lw-val');if(!val)return;
    if(w.numberFormat)for(const node of [val,...val.querySelectorAll('.lli,.aio-laprow strong')]){if(!node.children.length)continue;for(const child of [...node.childNodes])if(child.nodeType===3&&formatValue(child.textContent,w.numberFormat)!==null){const span=node.ownerDocument.createElement('span');span.className='wd-reading';span.textContent=child.textContent;child.replaceWith(span);}}
    const targets=[val,...val.querySelectorAll('.wd-reading,.record-value,.lli,.aio-fact b,.aio-laprow strong,.aio-system strong,.aio-foot b:not([data-wd-identity]),.aio-foot .aio-line strong,.aio-line [data-wd-numeric],.ftxt,.fnum,.fg-value,.twpct,.twvalue,.psp')];
    for(const node of targets){
      const old=formatted.get(node),unchanged=old&&node.innerHTML===old.html;
      const source=unchanged?old.source:node.children.length?null:node.textContent;
      if(source===null)continue;
      if(!w.numberFormat){if(unchanged)node.textContent=old.source;formatted.delete(node);continue;}
      const html=formatValue(source,w.numberFormat);if(html===null)continue;
      if(node.innerHTML!==html)node.innerHTML=html;
      formatted.set(node,{source,html:node.innerHTML});
    }
  }
  const FIELDS=[['fuelpct','Fuel remaining (%)','number'],['tyrelife','Tyre remaining (%)','number'],['penpoints','Penalty points','number'],['damage','Damage points','number'],['position','Position','number'],['laps','Completed laps','number'],['last','Last lap (seconds)','number'],['best','Best lap (seconds)','number'],['pacedelta','Pace difference (%)','number'],['pending','Unserved pit penalties','number'],['inpit','In pits','boolean'],['driverstatus','Driver status','text'],['flag','Race flag / state','text']];
  const OPS=[['lt','Less than'],['lte','At most'],['eq','Equals'],['gte','At least'],['gt','Greater than']];
  const TARGETS=[['border','Border'],['text','Text'],['text-border','Text + Border'],['accent','Accent stripe'],['background','Background']];
  function cleanRules(raw) {return (Array.isArray(raw)?raw:[]).slice(0,12).filter(r=>r&&FIELDS.some(f=>f[0]===r.field)).map(r=>({field:r.field,op:OPS.some(o=>o[0]===r.op)?r.op:'lt',value:String(r.value??'').slice(0,60),target:TARGETS.some(t=>t[0]===r.target)?r.target:'border',color:frame().hex(r.color)||'#ffbd45',enabled:r.enabled!==false}));}
  function evaluate(raw,values={}) {
    const rules=cleanRules(raw);
    for(let index=0;index<rules.length;index++){
      const r=rules[index],v=values[r.field],type=FIELDS.find(f=>f[0]===r.field)[2];if(!r.enabled||v==null)continue;
      let matches=false;
      if(type==='number'&&finite(v)&&finite(r.value)) {const a=Number(v),b=Number(r.value);matches={lt:a<b,lte:a<=b,eq:a===b,gte:a>=b,gt:a>b}[r.op];}
      else if(type==='boolean'&&['true','false'].includes(r.value))matches=r.op==='eq'&&v===(r.value==='true');
      else if(type==='text')matches=r.op==='eq'&&String(v).toLowerCase()===r.value.toLowerCase();
      if(matches)return {...r,index};
    }
    return null;
  }
  function decorate(el,w,out={},layout={}) {
    if(!el?.style||!el.querySelector)return;
    const t=frame().typography(w),val=el.querySelector(':scope > .lw-val'),title=el.querySelector(':scope > .lw-title');
    for(const node of [val,title])if(node){node.style.textShadow=t.shadow==='soft'?'0 1px 3px '+t.effectColor:t.shadow==='strong'?'0 2px 4px '+t.effectColor:'';node.style.webkitTextStroke=t.outline?`${t.outline}px ${t.effectColor}`:'';node.style.paintOrder=t.outline?'stroke fill':'';}
    formatDOM(el,w);
    const rule=out.designRule;
    if(!rule){delete el.dataset.designRule;return;}
    el.dataset.designRule=String(rule.index);
    if(rule.target==='text'||rule.target==='text-border'){el.style.color=rule.color;el.dataset.wsStateText='';el.style.setProperty('--ws-state-ink',rule.color);}
    if(rule.target==='border'||rule.target==='text-border'){el.style.borderColor=rule.color;el.style.borderWidth='max(2px, .2cqw)';}
    if(rule.target==='background'){el.style.background=rule.color;el.style.color=frame().inkFor({...w,appearance:{source:'custom',baseColor:rule.color,fill:'solid',surfaceOpacity:100}},{});if(el.dataset.wsStateText!==undefined)el.style.setProperty('--ws-state-ink',el.style.color);}
    if(rule.target==='accent'){el.classList.remove('lcstripe-top','lcstripe-side','lcstripe-right');el.classList.add('lcstripe-'+(frame().appearance(w,layout).edge==='left'?'side':frame().appearance(w,layout).edge));el.style.setProperty('--lane-stripe',rule.color);el.style.setProperty('--lane-size','max(3px, .4cqw)');}
  }
  const STYLE_KEYS=['appearance','typography','fonts','textColor','titleAlign','valueAlign','titleBold','valueBold','valueItalic'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  function snapshot(w,l) {const a=frame().appearance(w,l);if(a.radiusPixels===null){const r=frame().cornerPct(w.radius)??frame().cornerPct(l?.radius);if(r!==null)a.radiusPixels=r*Math.min(w.w,w.h)/100;}return {...Object.fromEntries(STYLE_KEYS.filter(k=>k!=='appearance'&&w[k]!==undefined).map(k=>[k,clone(w[k])])),appearance:frame().cleanAppearance(a),typography:frame().typography(w),fonts:(root.WidgetFonts||(typeof require==='function'?require('./widgetfonts.js'):null))?.clean({...l?.widgetFonts,...w.fonts})||{}};}
  function cleanStyle(raw) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
    const out={},F=frame();
    if(raw.appearance&&typeof raw.appearance==='object'&&!Array.isArray(raw.appearance))out.appearance=F.cleanAppearance(raw.appearance);
    if(raw.typography&&typeof raw.typography==='object'&&!Array.isArray(raw.typography)){
      const clean=F.typography({typography:raw.typography});
      out.typography=Object.fromEntries(Object.keys(clean).filter(k=>Object.hasOwn(raw.typography,k)).map(k=>[k,clean[k]]));
    }
    if(raw.fonts&&typeof raw.fonts==='object'&&!Array.isArray(raw.fonts))out.fonts=(root.WidgetFonts||(typeof require==='function'?require('./widgetfonts.js'):null))?.clean(raw.fonts)||{};
    if(F.hex(raw.textColor)||raw.textColor==='')out.textColor=F.hex(raw.textColor)||'';
    for(const k of ['titleAlign','valueAlign'])if(['left','center','right'].includes(raw[k]))out[k]=raw[k];
    for(const k of ['titleBold','valueBold','valueItalic'])if(typeof raw[k]==='boolean')out[k]=raw[k];
    return out;
  }
  function cleanStyles(raw) {const seen=new Set();return (Array.isArray(raw)?raw:[]).slice(0,50).flatMap(s=>{
    if(!s||typeof s.id!=='string'||!s.id||s.id.length>=100||seen.has(s.id))return [];
    const style=cleanStyle(s.style);if(!Object.keys(style).length)return [];
    seen.add(s.id);return [{id:s.id,name:String(s.name||'Untitled style').slice(0,80),style}];
  });}
  function applyStyle(w,s,linked=false){for(const key of STYLE_KEYS){if(Object.hasOwn(s.style,key))w[key]=clone(s.style[key]);else delete w[key];}if(linked)w.appearanceStyle=s.id;else delete w.appearanceStyle;}
  function saveStyle(l,w,name){const styles=cleanStyles(l.widgetStyles),id='style-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);if(styles.length>=50)return null;const s={id,name:String(name||'New style').trim().slice(0,80)||'New style',style:snapshot(w,l)};l.widgetStyles=[...styles,s];return s;}
  function updateStyle(l,w,id){const styles=cleanStyles(l.widgetStyles),s=styles.find(s=>s.id===id);if(!s)return false;s.style=snapshot(w,l);l.widgetStyles=styles;for(const widget of l.widgets||[])if(widget.appearanceStyle===id)applyStyle(widget,s,true);return true;}
  function deleteStyle(l,id){l.widgetStyles=cleanStyles(l.widgetStyles).filter(s=>s.id!==id);for(const w of l.widgets||[])if(w.appearanceStyle===id)delete w.appearanceStyle;}
  const select=(data,value,choices)=>`<select ${data}>${choices.map(([v,n])=>`<option value="${esc(v)}"${String(v)===String(value)?' selected':''}>${esc(n)}</option>`).join('')}</select>`;
  const field=(label,body)=>`<label class="ws-control"><span>${label}</span>${body}</label>`;
  function panels(w,l){
    const f=formatOptions(w.numberFormat),styles=cleanStyles(l?.widgetStyles),r=cleanRules(w.designRules);
    return {
      format:FORMAT_TYPES.has(w.type)?field('Decimal places',select('data-wd-format="digits"',f.digits,[[-1,'Original'],[0,'0'],[1,'1'],[2,'2'],[3,'3']]))+field('Units',select('data-wd-format="units"',f.units,[['beside','Beside value'],['below','Below value'],['hidden','Hidden']]))+field('Fractional digit size (%)',`<input type="number" min="50" max="100" data-wd-format="fraction" value="${f.fraction}">`)+field('Show + for positive values',`<input type="checkbox" data-wd-format="sign" ${f.sign?'checked':''}>`)+(['clock','totaltime','pitstop','tokenclock'].includes(w.type)?field('Leading minutes (00:00)',`<input type="checkbox" data-wd-format="clock" ${f.clock?'checked':''}>`):'')+'<p class="muted hint">Presentation only. Stored timing precision stays unchanged. Applies to numeric values, not driver names or chart axes. Digital and Pit Wall clocks keep their own display.</p><button class="btn" data-wd-action="format-reset">Original formatting</button>':'',
      styles:field('Saved style',select('data-wd-style',w.appearanceStyle||'', [['','Choose a style'],...styles.map(s=>[s.id,s.name])]))+field('Style name (save or rename)','<input data-wd-name maxlength="80" placeholder="Club timing">')+'<div class="row"><button class="btn" data-wd-action="save-style">Save new style</button><button class="btn" data-wd-action="apply-style">Apply copy</button><button class="btn" data-wd-action="link-style">Apply & link</button></div><details class="wd-style-tools"><summary>Manage saved styles</summary><div class="row"><button class="btn" data-wd-action="rename-style">Rename selected style</button><button class="btn" data-wd-action="update-style">Update linked widgets</button><button class="btn" data-wd-action="detach-style">Unlink selection</button><button class="btn danger" data-wd-action="delete-style">Delete style</button><button class="btn" data-wd-action="export-style">Export style</button><label class="btn">Import style<input type="file" data-wd-import accept=".json" hidden></label></div></details>'+`<p class="muted hint">${w.appearanceStyle?'Linked to a saved style. Updating that style replaces the appearance of every linked widget in this layout.':'Apply a copy for independent editing, or link for shared updates.'} Styles include fonts, text effects and spacing, but never content, number formats, rules, lanes or position. They travel with this layout when exported. Export a style separately to reuse it in another layout. Deleting a style keeps its widgets looking the same.</p>`,
      rules:'<p class="muted hint">First matching enabled rule wins, from top to bottom. Put urgent thresholds first. These override ongoing state colours; Lap Highlights still pulse above them. Missing values never match. Fuel and tyre rules need their system enabled; recorded points remain available.</p>'+r.map((rule,i)=>`<fieldset class="wd-rule"><legend>Rule ${i+1}</legend>${field('Enabled',`<input type="checkbox" data-wd-rule="${i}" data-key="enabled" ${rule.enabled?'checked':''}>`)}${field('When',select(`data-wd-rule="${i}" data-key="field"`,rule.field,FIELDS))}${field('Comparison',select(`data-wd-rule="${i}" data-key="op"`,rule.op,FIELDS.find(f=>f[0]===rule.field)[2]==='number'?OPS:[['eq','Equals']]))}${field('Value',rule.field==='inpit'?select(`data-wd-rule="${i}" data-key="value"`,rule.value,[['true','Yes'],['false','No']]):rule.field==='driverstatus'?select(`data-wd-rule="${i}" data-key="value"`,rule.value,['Ready','On track','In pits','Paused','Finished','Retired','Disqualified','Virtual replay'].map(v=>[v,v])):rule.field==='flag'?select(`data-wd-rule="${i}" data-key="value"`,rule.value,['Racing','Yellow flag','Safety Car','Red flag','Finished','Ready','Paused','Countdown','Heat finished'].map(v=>[v,v])):`<input data-wd-rule="${i}" data-key="value" type="number" step="any" value="${esc(rule.value)}">`)}${field('Apply colour to',select(`data-wd-rule="${i}" data-key="target"`,rule.target,TARGETS))}${field('Colour',`<input type="color" data-wd-rule="${i}" data-key="color" value="${rule.color}">`)}<div class="row"><button class="btn" data-wd-action="rule-up" data-index="${i}" ${!i?'disabled':''}>Move up</button><button class="btn" data-wd-action="rule-down" data-index="${i}" ${i===r.length-1?'disabled':''}>Move down</button><button class="btn" data-wd-action="rule-preview" data-index="${i}">Preview colour</button><button class="btn" data-wd-action="rule-delete" data-index="${i}">Remove</button></div></fieldset>`).join('')+`<button class="btn" data-wd-action="rule-add" ${r.length>=12?'disabled':''}>Add appearance rule</button><div class="wd-rule-preview">Rule colour preview · 10.423</div>`
    };
  }
  function input(w,t){if(t.dataset.wdFormat){w.numberFormat=formatOptions({...w.numberFormat,[t.dataset.wdFormat]:t.type==='checkbox'?t.checked:t.value});return true;}if(t.dataset.wdRule!==undefined){const rules=cleanRules(w.designRules),r=rules[Number(t.dataset.wdRule)];if(!r)return false;r[t.dataset.key]=t.type==='checkbox'?t.checked:t.value;if(t.dataset.key==='field'){r.op=FIELDS.find(f=>f[0]===r.field)[2]==='number'?'lt':'eq';r.value=r.field==='inpit'?'true':r.field==='driverstatus'?'Finished':r.field==='flag'?'Red flag':'20';}w.designRules=cleanRules(rules);return true;}return false;}
  function action(name,sel,l,box,index){const w=sel[0],id=box.querySelector('[data-wd-style]')?.value,s=cleanStyles(l.widgetStyles).find(s=>s.id===id);
    if(name==='save-style'){const saved=saveStyle(l,w,box.querySelector('[data-wd-name]')?.value);return saved?'Saved style: '+saved.name:'This layout already has 50 styles.';}
    if(['apply-style','link-style','update-style','delete-style','rename-style'].includes(name)&&!s)return 'Choose a saved style first.';
    if(name==='apply-style'||name==='link-style')sel.forEach(w=>applyStyle(w,s,name==='link-style'));
    if(name==='rename-style'){const name=box.querySelector('[data-wd-name]')?.value?.trim();if(!name)return 'Enter a style name first.';l.widgetStyles=cleanStyles(l.widgetStyles).map(style=>style.id===id?{...style,name:name.slice(0,80)}:style);}
    if(name==='update-style')updateStyle(l,w,id);
    if(name==='delete-style')deleteStyle(l,id);
    if(name==='detach-style')sel.forEach(w=>delete w.appearanceStyle);
    if(name==='format-reset')sel.forEach(w=>delete w.numberFormat);
    if(name.startsWith('rule-'))for(const w of sel){const r=cleanRules(w.designRules);if(name==='rule-add'&&r.length<12)r.push({field:'fuelpct',op:'lt',value:'20',target:'border',color:'#ffbd45',enabled:true});if(name==='rule-delete')r.splice(index,1);const to=name==='rule-up'?index-1:name==='rule-down'?index+1:-1;if(to>=0&&to<r.length)[r[index],r[to]]=[r[to],r[index]];w.designRules=r;}
    return 'Widget design updated.';
  }
  const api={FORMAT_TYPES,formatOptions,formatValue,formatDOM,FIELDS,OPS,TARGETS,cleanRules,evaluate,decorate,snapshot,cleanStyle,cleanStyles,applyStyle,saveStyle,updateStyle,deleteStyle,panels,input,action};root.WidgetDesign=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
