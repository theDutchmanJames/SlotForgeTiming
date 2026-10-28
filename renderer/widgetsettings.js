// Presentation controls only. Racing data, lane bindings and widget options are never copied.
const WidgetSettings = (() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels = {solid:'Solid',gradient:'Gradient',none:'None',theme:'Theme',lane:'Lane colour',custom:'Custom',shade:'Shade of background',subtle:'Subtle',medium:'Medium',strong:'Strong',top:'Top',left:'Left',right:'Right',follow:'Follow app','0':'Flat','35':'Soft lift','55':'Medium','75':'Thick card',legacy:'Original spacing',compact:'Compact',comfortable:'Comfortable',auto:'Automatic',manual:'Manual',wrap:'Wrap',fit:'Fit on one line',ellipsis:'Shorten with …'};
  const directions = [[135,'↘ Top left → bottom right'],[180,'↓ Top → bottom'],[225,'↙ Top right → bottom left'],[270,'← Right → left'],[315,'↖ Bottom right → top left'],[0,'↑ Bottom → top'],[45,'↗ Bottom left → top right'],[90,'→ Left → right']];
  const resetKeys = {
    background:['fill','source','baseColor','gradientSource','gradientColor','gradientOpacity','strength','angle','surfaceOpacity'],
    border:['border','borderColor','borderShade','borderWidth','borderOpacity'],
    accent:['accent','accentColor','accentShade','edge','accentWidth','accentOpacity']
  };
  const icon = name => typeof Icons!=='undefined' ? Icons.svg(name,{size:17}) : '';
  const folderIcons = {arrange:'move',place:'move',opts:'lines',title:'text',text:'alignleft',frame:'custom',advanced:'sliders',status:'flag'};
  const folderHeading = (name,label) => icon(folderIcons[name]||'sliders')+`<span>${esc(label)}</span>`;
  function section(name,label,body,iconName='sliders',footer='') {
    return body.trim()?`<section class="ws-section" data-ws-group="${name}" aria-label="${esc(label)}"><h4>${icon(iconName)}<span>${esc(label)}</span></h4><div class="ws-fields">${body}</div>${footer}</section>`:'';
  }
  // Removing a group only clears its new overrides. Original widget fields and
  // layout defaults stay intact, as do every other appearance group and content.
  function resetGroup(w,name) {
    if(!Object.hasOwn(resetKeys,name)||!w.appearance)return;
    const next={...w.appearance};for(const key of resetKeys[name])delete next[key];
    if(Object.keys(next).length)w.appearance=next;else delete w.appearance;
  }
  function panel(w,layout,selection=[w],{defaults=false}={}) {
    const a=Frame.appearance(w,layout),t=Frame.typography(w);
    const composite=/^aio/.test(w.type),picture=composite||['pace','tyrelife','avatar','carpicture','teampicture','image'].includes(w.type),special=['racechart','leaderboard'].includes(w.type);
    const control=(scope,key,label,choices,hint='')=>{
      const source=scope==='appearance'?a:t, values=selection.map(x=>(scope==='appearance'?Frame.appearance(x,layout):Frame.typography(x))[key]),mixed=values.some(v=>v!==values[0]),v=source[key],data=`data-ws="${scope}" data-key="${key}"`;
      let field;
      if(choices)field=`<select ${data}>${mixed?'<option value="" disabled selected>Different values</option>':''}${choices.map(item=>{const [value,name]=Array.isArray(item)?item:[item,labels[item]||item];return `<option value="${esc(value)}"${!mixed&&String(value)===String(v)?' selected':''}>${esc(name)}</option>`;}).join('')}</select>`;
      else if(typeof v==='boolean')field=`<input type="checkbox" ${data} ${v?'checked':''}>`;
      else if(key.endsWith('Color'))field=`<input type="color" ${data} value="${esc(v)}">`;
      else {const [min,max,step=1]=(scope==='appearance'?Frame.APP_NUMBERS:Frame.TYPE_NUMBERS)[key];field=`<input type="number" ${data} min="${min}" max="${max}" step="${step}" value="${mixed||v==null?'':esc(v)}" placeholder="${mixed?'Different values':'Original'}">`;}
      const compact=['fill','source','strength','angle','borderShade','borderWidth','edge','accentWidth','valueSize','supportSize','labelSize','depth','radiusPixels'].includes(key)&&!hint;
      return `<label class="ws-control${compact?' ws-compact':''}"><span>${esc(label)}</span>${field}${hint?`<small>${esc(hint)}</small>`:''}</label>${scope==='appearance'&&!Object.values(resetKeys).some(keys=>keys.includes(key))&&selection.some(x=>Object.hasOwn(x.appearance||{},key))?`<button class="btn ws-inherit" data-ws-action="inherit" data-key="${key}">Use layout / original</button>`:''}${key==='iconSize'&&selection.some(x=>Object.hasOwn(x.typography||{},key))?'<button class="btn ws-inherit" data-ws-action="icon-reset">Use original picture sizing</button>':''}`;
    };
    const ap=(k,label,choices,hint)=>control('appearance',k,label,choices,hint),ty=(k,label,choices,hint)=>control('typography',k,label,choices,hint);
    const colours=(key,label)=>ap(key,label,Frame.APP_CHOICES[key])+ (a[key]==='custom'?ap(key+'Color','Custom colour'):a[key]==='shade'?ap(key+'Shade','Shade (%)',null,'Negative darkens; positive lightens.'): '') + (a[key]!=='none'?ap(key+'Width','Thickness (layout units)'):'');
    const reset = name => `<button type="button" class="btn ws-group-reset" data-ws-action="reset-group" data-group="${name}"${selection.some(x=>resetKeys[name].some(k=>Object.hasOwn(x.appearance||{},k)))?'':' disabled'}>Use ${defaults?'original':'layout / original'} ${name}</button>`;
    const background=ap('fill','Fill style',Frame.APP_CHOICES.fill)+(a.fill!=='none'?ap('source','Background colour',Frame.APP_CHOICES.source)+(a.source==='custom'?ap('baseColor','Custom background colour'):''):'')+
      (a.fill==='gradient'?ap('gradientSource','Gradient colour',Frame.APP_CHOICES.gradientSource)+(a.gradientSource==='custom'?ap('gradientColor','Custom gradient colour'):'')+ap('gradientOpacity','Gradient opacity (%)',null,'Fades from this opacity to transparent over your chosen background colour.')+ap('angle','Angle (degrees)',null,'0° points up, 90° right, 180° down, 270° left.')+`<label class="ws-control">Direction preset<select data-ws="appearance" data-key="angle"><option value="" disabled${directions.some(x=>x[0]===a.angle)?'':' selected'}>Custom angle</option>${directions.map(([v,n])=>`<option value="${v}"${a.angle===v?' selected':''}>${n}</option>`).join('')}</select></label><button type="button" class="btn" data-ws-action="reverse">Reverse direction</button>`:'')+ap('surfaceOpacity','Background opacity (%)');
    return {
      fonts:typeof WidgetFonts!=='undefined'?WidgetFonts.panel(w,layout,selection,defaults):'',
      titleSize:ty('titleSize','Title size'),
      text:section('sizing','Text sizing',(special?'<p class="muted hint">Chart and leaderboard contents use their own saved designs and sizing controls.</p>':ty('mode','Text sizing',['auto','manual'])+(t.mode==='manual'?ty('valueSize','Primary value size')+(composite||['pace','tyrelife'].includes(w.type)?ty('supportSize','Supporting text size'):'')+(composite?ty('labelSize','Label size'):''):'')+(t.mode==='manual'?ty('shrink','Shrink to fit'):'')+ty('minSize','Minimum value size',null,'Screen pixels for primary values; supporting text keeps an 11px minimum. Enlarge the widget or show fewer fields when it cannot fit.'))+(!special?ty('longText','Long names and descriptions',['wrap','fit','ellipsis']):'')+'<p class="muted hint">Manual sizes use a 1000-unit layout width. Automatic fits the available space; lists use one consistent size and cards preserve their text hierarchy.</p>','text')+
        (picture?section('pictures','Pictures and gauges',ty('iconSize','Picture / avatar / gauge size',null,'Layout units; scales with the page. Overrides the picture or gauge size under Content once changed.'),'screen'):'')+
        section('textcolour','Text colour',ty('textSource','Colour source',[['auto','Automatic contrast'],['theme','Theme'],['custom','Custom']])+(t.textSource==='custom'?'<label class="ws-control">Custom text colour<input type="color" data-color="textColor" value="'+esc(Frame.hex(w.textColor)||'#ffffff')+'"></label>':''),'custom'),
      appearance:section('background','Background',background,'paint',reset('background'))+
        section('border','Border',colours('border','Border colour')+ap('borderOpacity','Border opacity (%)'),'square',reset('border'))+
        section('accent','Accent stripe',colours('accent','Accent colour')+(a.accent!=='none'?ap('edge','Accent position',Frame.APP_CHOICES.edge):'')+ap('accentOpacity','Accent opacity (%)'),'stripe',reset('accent'))+
        '<p class="muted hint">Lane colour uses this widget’s lane. Without a saved lane palette, the standard lane colours are used. Global widgets use the theme background and have no lane accent.</p>',
      advanced:section('shape','Shape and depth',ap('depth','Depth',Frame.APP_CHOICES.depth)+ap('radiusPixels','Corner radius (layout units)',null,'Empty retains the original radius. Accents follow the same curve.'),'layers')+
        section('spacing','Content spacing',ap('spacing','Content spacing',Frame.APP_CHOICES.spacing)+(a.spacing==='custom'?ap('padding','Padding (layout units)'):''),'sliders')+
        (defaults?'':section('reuse','Reuse appearance','<div class="row"><button type="button" class="btn" data-ws-action="copy">Copy appearance</button><button type="button" class="btn" data-ws-action="paste">Paste appearance</button><button type="button" class="btn" data-ws-action="reset">Reset appearance overrides</button></div><p class="muted hint">Copy includes colours, border, accent, depth and spacing. Lane, content and text settings stay unchanged.</p>','layers')),
      status:section('warnings','Warnings and events',ap('highlights','Show race-state colours',null,'Highlights existing warnings and event flashes. Values, state badges and warning icons remain visible when this is off.')+ap('highlightTarget','Apply state colours to',[['background','Background'],['text','Text'],['text-border','Text + Border']],a.highlightTarget==='background'?'Temporarily replaces the background, as before.':'Keeps your background and gradient. State text temporarily overrides your text colour and adjusts for contrast.'+(a.highlightTarget==='text-border'?' Also shows a visible state border, even when the normal border is off.':'')),'flag')
    };
  }
  function change(w,scope,key,value) {
    if(scope==='fonts'&&typeof WidgetFonts!=='undefined'){WidgetFonts.change(w,key,value);}
    else if(scope==='appearance') {const next={...w.appearance};if(value==='')delete next[key];else next[key]=value;w.appearance=Frame.cleanAppearance(next);}
    else if(scope==='typography'){const next={...w.typography,[key]:value};const clean=Frame.typography({typography:next});w.typography=Object.fromEntries(Object.keys(next).filter(k=>Object.hasOwn(clean,k)).map(k=>[k,clean[k]]));if(key==='textSource'&&value==='custom'&&!Frame.hex(w.textColor))w.textColor='#ffffff';}
  }
  // Whitelist legacy fields as well so copying an original widget is useful.
  let clipboard=null;
  function copy(w,layout){const a=Frame.appearance(w,layout);if(a.radiusPixels===null){const r=Frame.cornerPct(w.radius)??Frame.cornerPct(layout?.radius);if(r!==null)a.radiusPixels=r*Math.min(w.w,w.h)/100;}clipboard={appearance:Frame.cleanAppearance(a)};return true;}
  function paste(w){if(!clipboard)return false;w.appearance=JSON.parse(JSON.stringify(clipboard.appearance));return true;}
  return {panel,change,copy,paste,directions,section,folderHeading,resetGroup};
})();
if(typeof module!=='undefined')module.exports=WidgetSettings;
