// Read-only compositions: shared presentation for editor samples and every timing viewer.
// Values come from Timing's existing fields and the engine's public views; no race rules live here.
(function(root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const Tw = typeof module !== 'undefined' ? require('./tyrewear.js') : root.TyreWear;
  const Ps = typeof module !== 'undefined' ? require('./pushsave.js') : root.PushSave;
  const Sw = typeof module !== 'undefined' ? require('./strategywidgets.js') : root.StrategyWidgets;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEFINITIONS = [
    ['aiolane','Lane Card',340,175,['avatar','car','gap']],
    ['aiotiming','Timing Bar',440,145,['last']],
    ['aiodriver','Driver Dashboard',450,360,['avatar','car','fuel','tyres','pace','last']],
    ['aiopit','Pit & Service Card',360,310,['repairs','penalties','mandatory']],
    ['aiorace','Race Overview',620,185,['track','weather','leader']],
    ['aiostrategy','Strategy Card',380,260,['multipliers']],
    ['aioresults','Driver Results Card',400,285,['avatar','car','total','points']]
  ];
  const TYPES = new Set(DEFINITIONS.map(x=>x[0]));
  const LABELS = {avatar:'Driver avatar',car:'Slotcar description',gap:'Gap to leader',last:'Last and average lap',fuel:'Fuel',tyres:'Tyre condition',pace:'Push & Save',repairs:'Repair status',penalties:'Pit penalties',mandatory:'Mandatory stops',track:'Track name',weather:'Weather',leader:'Race leader',multipliers:'Consumption multipliers',total:'Total time (including penalties)',points:'Championship / heat points'};
  function defaults(preset) { const compact=preset==='compact',detailed=preset==='detailed'; return Object.fromEntries(Object.keys(LABELS).map(k=>[k,['last','points'].includes(k)?detailed:k==='penalties'||k==='gap'||k==='leader'?true:!compact])); }
  function clean(opt={}) { opt=opt||{}; const preset=['compact','standard','detailed'].includes(opt.preset)?opt.preset:'standard',d=defaults(preset);return {...d,...Object.fromEntries(Object.keys(d).filter(k=>typeof opt[k]==='boolean').map(k=>[k,opt[k]])),preset,iconLayout:['left','above','none'].includes(opt.iconLayout)?opt.iconLayout:'left',arrangement:['auto','wide','stacked','compact'].includes(opt.arrangement)?opt.arrangement:'auto',gapTo:opt.gapTo==='ahead'?'ahead':'leader'}; }
  function options(type) { const d=DEFINITIONS.find(x=>x[0]===type);return [
    {key:'preset',label:'Detail preset',type:'select',default:'standard',choices:[['compact','Compact'],['standard','Standard'],['detailed','Detailed']],rerender:true,hint:'Applies a set of optional fields. You can adjust each field below.'},
    {key:'arrangement',label:'Arrangement',type:'select',default:'auto',choices:[['auto','Automatic (follows widget width)'],['wide','Wide'],['stacked','Stacked'],['compact','Compact']]},
    ...(['aiolane','aiodriver','aioresults'].includes(type)?[{key:'iconLayout',label:'Identity arrangement',type:'select',default:'left',choices:[['left','Avatar beside name'],['above','Avatar above name'],['none','Text only (keep position)']],hint:'Uses the existing Driver avatar switch. Text-only hides the picture but keeps the driver and position.'}]:[]),
    ...(['aiotiming','aiodriver'].includes(type)?[{key:'gapTo',label:'Gap compares with',type:'select',default:'leader',choices:[['leader','Leader'],['ahead','Car ahead']]}]:[]),
    ...d[4].map(key=>({key,label:LABELS[key],type:'checkbox',default:defaults('standard')[key],defaultOf:raw=>clean(raw)[key]})),
    {key:'sizeNote',type:'note',label:'Content reflows without tiny text. Enlarge the widget if its selected fields cannot fit. Lane colour, stripe, radius and border use the normal widget controls.'}
  ]; }
  function applyPreset(opt, preset) { return {...opt,preset,...defaults(preset)}; }
  const available = (e,k,fallback) => e.systemEnabled ? e.systemEnabled(k) : !!fallback;
  const fmt = n => Number.isFinite(n)?E.fmtTime(n):'—';
  function read(type,c,S,helpers) {
    const e=S.eng,t=e.status==='paused'?e.pausedAt:e.status==='finished'?e.endAt:S.now;
    const m={...helpers, lane:c?c.lane+1:null, name:c?.driverName||'—',car:c?.carName||'', status:c?.dq?'Disqualified':c?.retired?'Retired':c?.done?'Finished':e.status==='ready'?'Ready':e.status==='paused'?'Paused':c?.blockAt!=null?'In pits':'On track'};
    if(!c)return m;
    const i=e.cars.indexOf(c),physical=i>=0&&!c.virtual;
    m.laps=c.virtual?c.lapsAll:e.lapsOf?e.lapsOf(c):c.laps.length;
    m.best=fmt(c.best);const a=E.averageLaps(c);m.average=a.length?fmt(a.reduce((n,x)=>n+x,0)/a.length):'—';m.last=c.laps.length?fmt(c.laps[c.laps.length-1]):'—';
    if(!['aiodriver','aiopit','aiostrategy'].includes(type))return m;
    const tw=physical&&available(e,'tyrewear',e.tyrewear)?Tw.view(e,[c.lane],t).rows[0]:null;
    m.fuel={value:'Off',percent:null};
    if(physical&&available(e,'fuel',e.fuel?.on)){const tank=e.tankOf?e.tankOf(i):e.fuel.tank,v=e.fuelOf(i,t),pct=tank>0&&Number.isFinite(v)?Math.max(0,Math.min(100,v/tank*100)):null;m.fuel={value:pct===null?'—':Math.round(pct)+'%',percent:pct};}
    m.tyres=tw?{value:tw.shown+'%',percent:tw.shown,color:tw.color,name:tw.tyre,left:tw.leftText,fitting:tw.fitting,note:Tw.withTyres(e.cfg.tyrewear?.tyres||e.tyrewear.tyres).stateOf(tw).text}:{value:'Off',percent:null,name:'Tyres',left:'Off'};
    const ps=physical&&available(e,'pushsave',e.pushSave)?e.psInfo(c):null;
    m.pace=ps?{value:Ps.kindText(ps.kind),kind:ps.kind,note:Number.isFinite(ps.p)?Ps.pctText(ps.p)+' pace':Ps.whyText(ps.why),fuel:ps.fuel,tyres:ps.tyres}:{value:'Off',kind:'off',note:''};
    m.range=physical&&available(e,'fuel',e.fuel?.on)?Sw.read('fuelrange',c,{...S,now:t}):{value:'Off',note:'Fuel system off'};
    if(type==='aiopit'){
      const held=physical&&e.pitControl&&['auto','manual'].includes(e.pitControl.mode);
      const elapsed=physical?e.pitTime(i,t):null;
      m.service=held?Sw.read('servicestop',c,{...S,now:t}):{value:elapsed?Sw.clock(elapsed.ms):'—',note:c.blockAt!=null?'Pit time elapsed · sensor-controlled stop':'Not in pits'};
      m.serviceLabel=held?'Service stop':'Pit time elapsed';
      m.penalty=physical?Sw.read('penaltyserve',c,{...S,now:t}):{value:'—',note:''};
      m.mandatory=tw?.mand?Tw.withTyres(e.tyrewear.tyres).mandStateText(tw.mand):'Off';
    }
    return m;
  }
  const fact=(label,value,primary=false,raw=false)=>`<div class="aio-fact${primary?' aio-primary':''}"><small>${esc(label)}</small><b>${raw?value:esc(value??'—')}</b></div>`;
  const line=(label,value,numeric=false)=>`<div class="aio-line"><span>${esc(label)}</span><strong${numeric?' data-wd-numeric':''}>${esc(value??'—')}</strong></div>`;
  const meter=p=>Number.isFinite(p)?`<span class="aio-meter" role="meter" aria-label="Remaining" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}"><i style="width:${Math.max(0,Math.min(100,p))}%"></i></span>`:'';
  function html(type,m,raw={}) {
    const o=clean(raw),identity=()=>`<div class="aio-identity aio-icon-${o.iconLayout}"><span class="aio-position" aria-label="Position">${esc(m.position||'—')}</span>${o.avatar&&o.iconLayout!=='none'?`<span class="aio-avatar">${m.avatarHtml||esc((m.name||'?')[0])}</span>`:''}<div class="aio-who"><strong>${esc(m.name)}</strong>${o.car&&m.car?`<span>${esc(m.car)}</span>`:''}</div></div>`;
    const lap=()=>`<div class="aio-laprow"><div><small>Laps driven</small><strong>${esc(m.laps)}${m.limit>0?` <em>/ ${esc(m.limit)}</em>`:''}</strong></div><span class="aio-status">${esc(m.status)}</span></div>`;
    const timing=()=>`<div class="aio-facts">${fact('Current lap',m.current,true,true)}${fact(o.gapTo==='ahead'?'Gap ahead':'Gap to leader',o.gapTo==='ahead'?m.ahead:m.gap,false,true)}${fact('Best legal lap',m.best)}</div>${o.last?`<div class="aio-foot">${line('Last lap',m.last)}${line('Average lap',m.average)}</div>`:''}`;
    const sys=(label,v,pct,note,kind='',color='')=>`<div class="aio-system ${kind}"${/^#[0-9a-f]{3,8}$/i.test(color)?` style="--aio-meter:${color}"`:''}><small>${esc(label)}</small><strong>${esc(v)}</strong>${meter(pct)}${note?`<span>${esc(note)}</span>`:''}</div>`;
    let body='';
    if(type==='aiolane')body=identity()+lap()+(o.gap?`<div class="aio-foot"><span>Gap to leader</span><b>${m.gap||'—'}</b></div>`:'');
    if(type==='aiotiming')body=timing();
    if(type==='aiodriver')body=identity()+lap()+'<div class="aio-rule"></div>'+timing()+(o.fuel||o.tyres||o.pace?`<div class="aio-systems">${o.fuel?sys('Fuel',m.fuel.value,m.fuel.percent,'','aio-fuel'):''}${o.tyres?sys(m.tyres.name==='Tyres'?'Tyres':'Tyres · '+m.tyres.name,m.tyres.value,m.tyres.percent,'','aio-tyres',m.tyres.color):''}${o.pace?sys('Push & Save',m.pace.value,null,m.pace.note,'aio-pace aio-'+(['push','normal','save'].includes(m.pace.kind)?m.pace.kind:'off')):''}</div>`:'');
    if(type==='aiopit')body=`<div class="aio-service">${fact(m.serviceLabel,m.service.value,true)}<p>${esc(m.service.note)}</p>${Number.isFinite(m.service.progress)?meter(m.service.progress*100):''}</div><div class="aio-lines">${line('Fuel',m.fuel.value,true)}${line('Tyres',m.tyres.note||m.tyres.value)}${o.repairs?`<div class="aio-line"><span>Repairs</span><strong>${m.repairs||'Off'}</strong></div>`:''}${o.penalties?line('Pit penalties',m.penalty.value,true)+`<p class="aio-note">${esc(m.penalty.note)}</p>`:''}${o.mandatory?line('Mandatory stops',m.mandatory):''}</div>`;
    if(type==='aiorace')body=`<div class="aio-session"><strong>${m.session||'Race Overview'}</strong>${o.track?`<span>${m.track||'—'}</span>`:''}</div><div class="aio-facts">${fact('Elapsed race time',m.clock,true,true)}${fact(m.remainingLabel,m.remaining,false,true)}${fact('Flag',m.flag,false,true)}</div><div class="aio-foot">${o.weather?`<span>Weather <b>${m.weather||'Off'}</b></span>`:''}${o.leader?`<span>Leader <b data-wd-identity>${m.leader||'—'}</b></span>`:''}</div>`;
    if(type==='aiostrategy')body=`<div class="aio-facts aio-range">${fact('Fuel range',m.range.value,true)}${fact('Tyre life',m.tyres.left)}</div><p class="aio-note">${esc(m.range.note)} · ${esc(m.tyres.name)}</p><div class="aio-rule"></div>${line('Push & Save',m.pace.value)}<p class="aio-note">${esc(m.pace.note)}</p>${o.multipliers?`<div class="aio-foot">${line('Fuel use',Number.isFinite(m.pace.fuel)?'×'+m.pace.fuel.toFixed(2):'Off')}${line('Tyre wear',Number.isFinite(m.pace.tyres)?'×'+m.pace.tyres.toFixed(2):'Off')}</div>`:''}`;
    if(type==='aioresults')body=identity()+'<div class="aio-rule"></div>'+`<div class="aio-facts">${fact('Laps driven',m.laps,true)}${fact('Best legal lap',m.best)}${fact('Gap to leader',m.gap,false,true)}</div><div class="aio-foot">${o.total?`<span>Total time <b>${m.total||'—'}</b></span>`:''}${o.points?`<span>Championship / heat points <b>${esc(m.points??'—')}</b></span>`:''}</div>`;
    const label=type==='aioresults'?(m.final?m.position===1&&!['Disqualified','Retired'].includes(m.status)?'Winner':'Results':'Provisional results'):type==='aiorace'?'Race Overview':m.virtualRival?'Virtual rival':`Lane ${m.lane}`;
    return `<div class="aio-box aio-${o.arrangement}" data-aio="${type}"${type==='aioresults'&&m.final&&!['Disqualified','Retired'].includes(m.status)&&m.position>=1&&m.position<=3?` data-medal="${['gold','silver','bronze'][m.position-1]}"`:''}><div class="aio-content"><div class="aio-heading"><span>${esc(label)}</span>${type!=='aiorace'?`<span>${esc(m.status==='On track'?'Live':m.status)}</span>`:''}</div>${body}</div><span class="aio-sizehint">Enlarge widget<br><small>Selected fields need more room</small></span></div>`;
  }
  function sample(type,lane,opt,avatarHtml='') {const n=lane%8;return html(type,{lane:n+1,name:['James','Bjornie','Maria','Sam'][n%4],car:['NSR Mosler MT900R','NSR Corvette C7.R'][n%2],position:n+1,status:type==='aioresults'?'Finished':'On track',final:type==='aioresults',avatarHtml,laps:24,limit:65,current:'9.142',gap:n?'+0.642':'Leader',ahead:n?'+0.642':'Leader',best:'8.402',last:'9.208',average:'9.364',fuel:{value:'62%',percent:62},tyres:{value:'74%',percent:74,name:'Soft',left:'23 laps',note:'Fitting Medium · 8.0 s'},pace:{value:'PUSH',kind:'push',note:'−2.4% pace',fuel:1.22,tyres:1.35},range:{value:'≈ 18.4 laps',note:'Estimated · last 5 clean laps'},service:{value:'00:18.0',note:'Service in progress · includes 5 s penalty',progress:.4},serviceLabel:'Service stop',penalty:{value:'00:05.0',note:'1 pit penalty'},repairs:'No damage',mandatory:'1 stop remaining',session:'Slotrace Circuit Grand Prix',track:'Slotrace Circuit',clock:'03:52.4',remainingLabel:'Laps remaining',remaining:'41',flag:'Green flag',weather:'Dry',leader:'James',total:'10:08.660',points:25},opt); }
  // Never scale a whole composition into tiny text. Try denser spacing, then give a clear size hint.
  function fit(rootEl) {if(!rootEl?.querySelectorAll)return;rootEl.querySelectorAll('.aio-box').forEach(el=>{const content=el.querySelector('.aio-content');if(!content||!el.clientWidth||!el.clientHeight)return;el.classList.remove('aio-small','aio-tight');const overflow=()=>content.scrollHeight>el.clientHeight+1||content.scrollWidth>el.clientWidth+1||[...content.querySelectorAll('.aio-fact b')].some(value=>value.scrollWidth>value.clientWidth+1);if(overflow())el.classList.add('aio-tight');if(overflow())el.classList.add('aio-small');});}
  const api={TYPES,DEFINITIONS,options,clean,applyPreset,read,html,sample,fit};root.AllInOne=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
