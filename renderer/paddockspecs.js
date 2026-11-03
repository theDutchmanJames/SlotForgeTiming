// Read-only public Timing v1 projection. Never edit or normalize the signed source.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PaddockSpecs=api;})(globalThis,()=>{
  const groups=[
    ['body','Body & chassis','#6baab1',[['body','Body'],['bodyMaterial','Body material'],['bodySettings','Body settings'],['chassis','Chassis'],['wheelbase','Wheelbase'],['pod','Motor pod'],['podSettings','Motor pod settings'],['suspension','Suspension'],['fasteners','Fasteners']]],
    ['motor','Motor & performance','#b49ad3',[['motor','Motor'],['motorType','Motor type'],['motorLayout','Motor layout'],['ratedRpm','Rated RPM'],['ratedVoltage','Rated RPM voltage (V)'],['measuredRpm','Measured RPM'],['measuredVoltage','Measured RPM voltage (V)'],['measuredDate','Measurement date'],['motorTorque','Motor torque (gf·cm)'],['torqueVoltage','Torque voltage (V)'],['torqueType','Torque type']]],
    ['gearing','Gearing','#c8a268',[['pinion','Pinion'],['gear','Gear'],['gearType','Gear type'],['pinionPart','Pinion part'],['gearPart','Gear part']]],
    ['front','Front axle & tyres','#76a789',[['frontAxle','Front axle'],['frontBearings','Front bearings'],['frontWheels','Front wheels'],['frontTyres','Front tyres'],['frontDiameter','Front tyre diameter (mm)'],['frontAxlePlay','Front axle play'],['frontWidth','Front width']]],
    ['rear','Rear axle & tyres','#7b9ec4',[['rearAxle','Rear axle'],['rearBearings','Rear bearings'],['rearWheels','Rear wheels'],['rearTyres','Rear tyres'],['rearDiameter','Rear tyre diameter (mm)'],['rearAxlePlay','Rear axle play'],['rearWidth','Rear width']]],
    ['electrical','Guide & electrics','#b194c7',[['guide','Guide'],['braids','Braids'],['wiring','Wiring'],['lights','Lights'],['digitalSystem','Digital system'],['chip','Digital chip']]],
    ['balance','Weight & setup','#c39286',[['weight','Weight'],['ballast','Ballast'],['magnets','Magnets'],['clearance','Ground clearance']]]
  ];
  const labels=Object.fromEntries(groups.flatMap(g=>g[3])),PAGE=50;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const publicText=v=>typeof v==='string'?v:'';
  function model(item){
    const link=item?.paddock;if(!link)return null;const c=link.configuration;
    if(!c)return {groups:[],components:[],capturedAt:'',message:'No saved Paddock configuration is available. Connect and refresh this linked car to load its specifications.'};
    if(typeof link.carId!=='string'||!link.carId||typeof link.databaseId!=='string'||!link.databaseId||c.carId!==link.carId||c.databaseId!==link.databaseId)return {groups:[],components:[],capturedAt:'',message:'The saved configuration does not match this linked car. Reconnect to the correct Paddock database and refresh the car.'};
    const technical=c.technical&&typeof c.technical==='object'&&!Array.isArray(c.technical)?c.technical:{};
    return {capturedAt:typeof c.capturedAt==='string'&&Number.isFinite(Date.parse(c.capturedAt))?c.capturedAt:'',message:'',
      groups:groups.map(([id,title,color,fields])=>({id,title,color,fields:fields.filter(([key])=>typeof technical[key]==='string'&&technical[key].trim()).map(([key,label])=>({key,label,value:technical[key]}))})).filter(g=>g.fields.length),
      components:(Array.isArray(c.components)?c.components:[]).slice(0,1000).filter(x=>x&&typeof x.name==='string'&&x.name.trim()&&Number.isSafeInteger(x.quantity)&&x.quantity>0&&x.quantity<=1000000).map(x=>({name:x.name,quantity:x.quantity,field:Object.hasOwn(labels,x.field)?labels[x.field]:'',position:publicText(x.position)}))};
  }
  function componentHtml(m,page){
    const rows=m.components.slice(page*PAGE,(page+1)*PAGE);
    return `<ul class="pcs-parts">${rows.map(x=>`<li><strong>${esc(x.name)}</strong><span>Quantity: ${x.quantity}</span>${x.field||x.position?`<span class="muted">${esc([x.field,x.position].filter(Boolean).join(' · '))}</span>`:''}</li>`).join('')}</ul>${m.components.length>PAGE?`<div class="pcs-pages"><button type="button" class="btn" data-pcs-page="${page-1}" ${page===0?'disabled':''}>Previous components</button><span>Page ${page+1} of ${Math.ceil(m.components.length/PAGE)}</span><button type="button" class="btn" data-pcs-page="${page+1}" ${(page+1)*PAGE>=m.components.length?'disabled':''}>Next components</button></div>`:''}`;
  }
  function html(item){const m=model(item);if(!m)return '';
    const captured=m.capturedAt?new Date(m.capturedAt).toLocaleString():'Date unavailable';
    return `<section class="paddock-specs" aria-label="Paddock specifications"><h3>Paddock specifications <span class="badge">Read only</span></h3><p class="muted">Saved configuration · ${esc(captured)}. This date describes the saved copy, not the connection status.</p><p>Manage these details in Paddock. Use <b>Connection &amp; results → Refresh linked cars</b> to update the saved copy. Timing’s simulation settings and service history remain local.</p>${m.message?`<p role="status">${esc(m.message)}</p>`:''}${m.groups.map(g=>`<details class="pcs-group" style="--pcs-colour:${g.color}"><summary>${esc(g.title)} <span>${g.fields.length} fields</span></summary><dl>${g.fields.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl></details>`).join('')}${m.components.length?`<details class="pcs-group" style="--pcs-colour:#91a8b8"><summary>Installed components <span>${m.components.length} items</span></summary><div data-pcs-components>${componentHtml(m,0)}</div></details>`:''}${!m.message&&!m.groups.length&&!m.components.length?'<p class="muted">No public specifications or installed components are filled in for this saved configuration.</p>':''}</section>`;
  }
  function mount(section,item){if(!section)return;const m=model(item);if(!m)return;section.addEventListener('click',e=>{const button=e.target.closest('[data-pcs-page]');if(!button||!section.contains(button))return;e.preventDefault();const page=Number(button.dataset.pcsPage);if(!Number.isInteger(page)||page<0||page>=Math.ceil(m.components.length/PAGE))return;const target=section.querySelector('[data-pcs-components]');target.innerHTML=componentHtml(m,page);target.querySelector('[data-pcs-page]:not(:disabled)')?.focus({preventScroll:true});});}
  return {groups,model,html,mount};
});
