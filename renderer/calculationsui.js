// Calculations uses the same saved systems and pure rules as race preparation.
// Example inputs are local to this page; only labelled Save controls persist rules.
const CalculationPage = (() => {
  let active = 'pace', selected = {}, example = { laps: '10, 10.2, 9.8, 12', lap: 9.5, target: 10 };
  const sections = [
    ['pace', 'Pace benchmarks', 'Push & Save · Tyre Wear', 'var(--c-ps)'],
    ['fuel', 'Fuel & tyres', 'Consumption · grip · stacking', 'var(--c-fuel)'],
    ['effects', 'Race effects', 'Balance of Power · weather · damage', 'var(--c-wx)'],
    ['resources','Resource allocation','Tyre sets · repairs · components','#56bfaa'],
    ['pits', 'Pit service & penalties', 'Service order · timers · consequences', 'var(--c-pen)'],
    ['estimates', 'Estimates & timing', 'Range · distance · gaps', 'var(--c-tok)'],
    ['results', 'Results & scoring', 'Eligible laps · heats · championships', 'var(--c-ch)']
  ];
  const entities = ['fuelrules', 'tyrewearsystems', 'pushsavesystems', 'weathersystems', 'damagesystems', 'safetycarsystems', 'penaltysystems', 'racesetups', 'championships', 'rotationsetups', 'tracks'];
  const formula = (title, equation, text, worked) => `<article class="calc-equation"><h4>${esc(title)}</h4><code>${esc(equation)}</code><p>${esc(text)}</p>${worked ? `<p class="calc-worked"><b>Example</b> ${esc(worked)}</p>` : ''}</article>`;
  const input = (key, label, value, max = 1000) => `<label>${esc(label)}<input type="number" data-policy="${key}" min="0" max="${max}" step="1" value="${value}" required></label>`;
  const methods = current => PushSave.BENCHMARKS.map(([key, title]) => `<option value="${key}"${current === key ? ' selected' : ''}>${esc(title.replace('recent valid', 'eligible').replace('in this race', 'in the selected history'))}</option>`).join('');
  const routeButton = (tab, sub, text) => `<button type="button" class="btn" data-calc-route="${tab}" data-sub="${sub}">${esc(text)}</button>`;
  const choice = (key, label, value, options) => `<label>${esc(label)}<select name="${key}">${options.map(([v,t])=>`<option value="${v}"${String(value)===String(v)?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  const number = (key, label, value, min, max, step = 1) => `<label>${esc(label)}<input name="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" required></label>`;
  function extraControls(kind) {
    const c = PushSave.calculationSettings(state.settings), r = c.response, e = c.estimates;
    const fields = kind === 'response' ? choice('custom','Tyre pace response',r.custom?'custom':'system',[['system','Use Tyre Wear System strength'],['custom','Custom strength and limits']])
      + number('strength','Custom strength · 0 = no pace effect',r.strength,0,3,.1) + number('minimum','Minimum wear multiplier',r.minimum,.1,1,.05) + number('maximum','Maximum wear multiplier',r.maximum,1,3,.05)
      + choice('combine','Tyre pace contributors',r.combine,[['both','Both systems multiply (current default)'],['tyres','Tyre Wear pace only'],['pushsave','Push & Save tyres only']])
      : choice('gapMethod','Lap-gap reference',e.gapMethod,[['median','Leader’s median lap'],['average','Leader’s average lap']]) + number('gapWindow','Gap history · 0 = all eligible laps',e.gapWindow,0,1000)
      + choice('fuelMethod','Fuel Range consumption estimate',e.fuelMethod,[['average','Average actual consumption'],['median','Median actual consumption']]) + number('fuelWindow','Fuel history · 0 = each widget’s setting',e.fuelWindow,0,20);
    return `<form class="calc-policy" data-extra="${kind}"><h4>${kind==='response'?'Tyre pace response & combined effects':'Estimate preferences'}</h4><p>${kind==='response'?'These limits apply to Tyre Wear’s pace multiplier only. Weather, temperature and base wear still apply. Selecting one pace contributor does not enable that system: if it is off, its pace effect is neutral. Push & Save fuel remains independent.':'Display estimates only: these choices do not change classification, measured timing or fuel consumption. Fuel history is 3–20 laps, or 0 to keep each widget’s existing setting.'}</p><div class="calc-fields">${fields}</div><div class="calc-preview" data-extra-preview></div><button type="submit" class="btn">Save for new races</button> <button type="button" class="btn" data-extra-reset>Restore defaults</button><span class="calc-save" role="status"></span><p class="muted">Restore defaults fills this form; Save applies it. Running and recovered races keep their starting choices.</p></form>`;
  }
  const trials = {};
  function lab(kind, title, fields, note) {
    return `<details class="calc-lab" open data-lab="${kind}"><summary>${title}</summary><p class="muted">Preview only · ${note}</p><div class="calc-fields">${fields}</div><output class="calc-preview" aria-live="polite"></output></details>`;
  }
  function laboratories() {
    if(active==='pits')return lab('service','Try a pit stop',number('fuel','Fuel work · seconds',8,0,3600)+number('repair','Repair work · seconds',12,0,3600)+number('tyres','Tyre work · seconds',10,0,3600)+choice('order','Work order','overlap',[['overlap','All at the same time'],['add','Fuel → repairs → tyres'],['repair','Repairs after fuel; tyres alongside'],['tyres','Fuel and repairs together; tyres after']])+number('reduction','Safety Car reduction · %',0,0,90)+choice('fixed','Fixed Service Stop','off',[['off','Off — normal work duration'],['on','On — fit work into the timer']])+number('window','Fixed service window · seconds',30,1,86400)+number('penalty','Additional penalty · seconds',5,0,3600),'Example jobs, not a prediction for a particular car. Driver swaps, sensor confirmation, manual release and held pit exit may delay departure.')
      + lab('penalty','Try the selected penalty ladder',number('points','Total penalty points',5,0,10000),'Uses the saved Penalty System selected below. A higher unserved pit tier replaces the lower one. Already served stops and Special Penalties stay separate.');
    if(active==='fuel')return lab('combined','See the combined fuel effects',number('bop','Balance of Power · signed %',0,-90,90)+number('weather','Weather handicap · %',20,0,90)+number('grip','Tyre Performance · signed %',10,-90,90)+['bop','weather','grip'].map(k=>choice(k+'Lever',k==='bop'?'BoP affects':k==='weather'?'Weather affects':'Tyre performance affects','all',[['all','Fuel, refuelling and tank'],['use','Fuel use only'],['rate','Refuelling only'],['tank','Tank only'],['none','No fuel effects']])).join('')+number('use','Base fuel per lap · L',2,0,10000,.1)+number('rate','Base refuel speed · L/s',10,.1,10000,.1)+number('tank','Base tank · L',100,.1,10000,.1),'Positive helps; negative hinders. These example switches let you see each source’s contribution; they do not change saved systems.');
    if(active==='pace')return lab('wear','See the combined tyre wear',number('base','Base wear · % per lap',2,0,100,.01)+number('reference','Earlier benchmark · seconds',10,.001,3600,.001)+number('lap','New lap · seconds',8,.001,3600,.001)+number('weather','Weather wear multiplier',1,0,20,.1)+number('temperature','Temperature multiplier',1,1,3,.1),'Uses saved tyre-response preferences and the selected saved Tyre Wear and Push & Save systems below. The example benchmark is supplied explicitly, so history learning is not simulated.');
    if(active==='effects')return lab('safety','Try a Safety Car lap and stop',number('lap','Full yellow lap · seconds',14,.001,3600,.001)+number('service','Ordinary service · seconds',10,0,3600,.1),'Uses the selected saved Safety Car System below. Partial-yellow laps do not receive a target-pace penalty. Penalties and driver swaps are not shortened.');
    if(active==='resources')return lab('resources','Follow a supply allocation',number('sets','Starting allocation · tyre sets',3,0,100000)+number('changes','Completed tyre changes',1,0,100000)+number('credits','Repair credits',3,0,100000)+number('components','Replacement components',1,0,100000)+number('damage','Completed damage repairs requested',1,0,100000)+number('failures','Completed failure repairs requested',1,0,100000),'Illustration with all limits enabled: one starting set, then tyre changes, damage repairs and failure repairs. Insufficient supplies leave work undone. Editing a saved profile never refills existing allocations.');
    if(active==='results')return lab('scoring','Keep overall and class scores separate',number('overall','Overall position',3,1,1000)+number('classPos','Class position',1,1,1000)+number('bonus','Eligible bonus points · each example',1,0,1000)+number('share','Session points share · %',100,0,100)+choice('round','Rounding','nearest',[['nearest','Nearest'],['up','Up'],['down','Down'],['none','No rounding']]),'Uses the selected Championship points table below for both example classifications, without a class override. Bonus input represents an already-eligible award. These are separate scores, never added together.')+lab('drops','Try dropped results',`<label>Decided round scores · comma separated<input name="scores" value="10, 6, 8"></label>`+number('drop','Results to drop',1,0,1000),'Example driver totals after bonuses and rounding. Lowest scores drop first; earlier equal scores drop first. At least one decided result remains.');
    return '';
  }
  function wireTools(box, refs) {
    const record = entity => refs[entity]?.find(r=>r.id===selected[entity]) || refs[entity]?.[0];
    box.querySelectorAll('[data-extra]').forEach(form=>{
      const kind=form.dataset.extra, read=()=>Object.fromEntries([...form.querySelectorAll('[name]')].map(el=>[el.name,el.type==='number'?Number(el.value):el.value]));
      const refresh=()=>{
        const v=read();
        if(kind==='response')for(const el of form.querySelectorAll('input'))el.disabled=v.custom!=='custom';
        form.querySelector('[data-extra-preview]').textContent=kind==='response'?`${v.custom==='custom'?`Tyre pace ×${v.minimum} to ×${v.maximum}, strength ${v.strength}`:'Use each Tyre Wear System’s strength; pace ×0.5 to ×1.5'}. ${v.combine==='both'?'Both enabled pace effects multiply.':v.combine==='tyres'?'Only Tyre Wear contributes pace wear.':'Only Push & Save contributes pace wear.'}`:`Gap: ${v.gapMethod}, ${v.gapWindow||'all'} eligible laps. Fuel Range: ${v.fuelMethod}, ${v.fuelWindow||'widget-selected'} recent laps (at least 3).`;
      };
      form.oninput=refresh;form.querySelector('[data-extra-reset]').onclick=()=>{const d=kind==='response'?PushSave.responsePolicy():PushSave.estimatePolicy();for(const [k,v]of Object.entries(d))form.elements[k].value=k==='custom'?(v?'custom':'system'):v;refresh();};
      form.onsubmit=async ev=>{ev.preventDefault();if(!form.reportValidity())return;const v=read();if(kind==='estimates'&&v.fuelWindow>0&&v.fuelWindow<3){form.querySelector('.calc-save').textContent='Use 0 or at least 3 fuel samples.';return;}const data=kind==='response'?PushSave.responsePolicy({...v,custom:v.custom==='custom'}):PushSave.estimatePolicy(v);await save(form,()=>api.setSettings({[kind==='response'?'tyreResponse':'raceEstimates']:data}),true);box.querySelectorAll('[data-lab]').forEach(el=>el.dispatchEvent(new Event('input')));};refresh();
    });
    box.querySelectorAll('[data-lab]').forEach(panel=>{
      const kind=panel.dataset.lab;
      for(const el of panel.querySelectorAll('[name]'))if(trials[kind]?.[el.name]!==undefined)el.value=trials[kind][el.name];
      const draw=()=>{
        if([...panel.querySelectorAll('input')].some(el=>!el.checkValidity()||el.value==='')){panel.querySelector('output').textContent='Enter valid example values to see the calculation.';return;}
        const v=Object.fromEntries([...panel.querySelectorAll('[name]')].map(el=>[el.name,el.type==='number'?Number(el.value):el.value]));trials[kind]=v;
        const n=x=>Number(x.toFixed(3)), stat=(label,value)=>`<span>${esc(label)}<strong>${esc(value)}</strong></span>`;let html='';
        if(kind==='service'){
          const f=1-v.reduction/100,j={fuel:v.fuel*f,repair:v.repair*f,tyres:v.tyres*f,repairAdd:['add','repair'].includes(v.order),tyreAdd:['add','tyres'].includes(v.order)};
          const natural=Math.max(j.fuel,(j.repairAdd?j.fuel:0)+j.repair,(j.tyreAdd?Math.max(j.fuel,(j.repairAdd?j.fuel:0)+j.repair):0)+j.tyres),duration=v.fixed==='on'?v.window:natural;
          const ends=PitHold.servicePlan(j,duration),scale=natural?duration/natural:0,total=duration+v.penalty,max=Math.max(1,total);
          html=`<p><b>Normal work: ${n(natural)} s → service window: ${n(duration)} s → with penalty: ${n(total)} s</b></p>`+['fuel','repair','tyres','penalty'].map((k,i)=>{const start=k==='penalty'?duration:ends[k]-j[k]*scale,end=k==='penalty'?total:ends[k];return `<div class="calc-job"><span>${['Fuel','Repairs','Tyres','Penalty'][i]} · ${n(start)}–${n(end)} s</span><div><i style="margin-left:${start/max*100}%;width:${(end-start)/max*100}%;background:${['var(--c-fuel)','var(--c-dmg)','var(--c-tyre)','var(--c-pen)'][i]}"></i></div></div>`;}).join('');
        }else if(kind==='combined'){
          const lever=k=>({use:['all','use'].includes(v[k+'Lever']),rate:['all','rate'].includes(v[k+'Lever']),tank:['all','tank'].includes(v[k+'Lever'])}),f=Bop.mix([[v.bop,lever('bop')],[-v.weather,lever('weather')],[v.grip,lever('grip')]]);
          html=stat('Fuel per lap',`${n(v.use*f.use)} L · ×${n(f.use)}`)+stat('Refuelling',`${n(v.rate*f.rate)} L/s · ×${n(f.rate)}`)+stat('Tank',`${n(v.tank*f.tank)} L · ×${n(f.tank)}`)+`<p>BoP ${v.bop>0?'+':''}${v.bop}% · weather −${v.weather}% · tyres ${v.grip>0?'+':''}${v.grip}%. Contributions add per enabled effect and stop at ±90%.</p>`;
        }else if(kind==='wear'){
          const response=PushSave.calculationSettings(state.settings).response,tw=record('tyrewearsystems'),ps=record('pushsavesystems');
          const cfg=TyreWear.clean(tw,{pace:{response,benchmark:'track',trackTarget:v.reference*1000}}),p=ps?PushSave.lapEffect(PushSave.clean(ps),{ref:v.reference*1000,lapMs:v.lap*1000,lapNo:100}):{tyres:1};
          const t=cfg&&response.combine!=='pushsave'?TyreWear.paceMultiplier(cfg,[],v.lap*1000).multiplier:1,q=response.combine!=='tyres'?p.tyres:1,total=v.base*v.weather*v.temperature*t*q;
          html=stat('Calculated wear this lap',`${n(total)} percentage points`)+`<p>${v.base}% base × ${v.weather} weather × ${v.temperature} temperature × ${n(t)} Tyre Wear pace × ${n(q)} Push & Save = <b>${n(total)}%</b>. Remaining life stops at 0%; it cannot become negative.</p><p>${tw?'Tyre Wear: '+esc(tw.name):'No Tyre Wear selected: its pace effect is neutral.'} · ${ps?'Push & Save: '+esc(ps.name):'No Push & Save selected: its effect is neutral.'}</p>`;
        }else if(kind==='penalty'){
          const row=record('penaltysystems');if(!row)html='<p>Create a Penalty System below to try its ladder.</p>';else{const p=RaceEngine.penaltyConfig(row),e=RaceEngine.penaltyEffects(p,v.points);html=stat('Time total',`${n(RaceEngine.penaltyMs(p,v.points)/1000)} s`)+stat('Scoring laps deducted',e.laps)+stat('Unserved tier requires',`${e.pit} s in pits`)+`<p>${p.dq&&v.points>=p.dq?'Point-limit disqualification applies.':'Point-limit disqualification not reached.'} Testing ${esc(row.name)}.</p>`;}
        }else if(kind==='safety'){
          const row=record('safetycarsystems');if(!row)html='<p>Create a Safety Car System below to try its rules.</p>';else{const c=SafetyCar.clean(row),failed=c.target>0&&v.lap*1000<c.target;html=stat('Full-yellow lap',failed?'Too fast':c.target?'Target met':'No target enforced')+stat('Penalty points',failed?c.points:0)+stat('Service work',`${n(v.service*(1-c.pit/100))} s`)+`<p>Using ${esc(row.name)}. The service reduction is fixed at pit entry.</p>`;}
        }else if(kind==='resources'){
          const sets=Math.max(0,v.sets-1),changes=Math.min(sets,v.changes),damage=Math.min(v.credits,v.damage),failures=Math.min(v.credits-damage,v.components,v.failures);
          html=stat('Unused tyre sets',sets-changes)+stat('Repair credits left',v.credits-damage-failures)+stat('Components left',v.components-failures)+`<p>Starting set: ${v.sets?1:0}; completed tyre changes: ${changes}/${v.changes}; damage repairs: ${damage}/${v.damage}; failure repairs: ${failures}/${v.failures}.</p>`;
        }else if(kind==='scoring'){
          const row=record('championships');if(!row)html='<p>Create a Championship below to preview its points table.</p>';else{const c=Champ.clean(row);if(c.pointsMode==='beaten'){panel.querySelector('output').textContent='This championship awards points for opponents beaten. Use a position-table championship for this table preview; its scoring rules are unchanged.';return;}const score=pos=>ChampPts.scaled((c.points[pos-1]??c.pointsRest)+v.bonus,v.share,v.round);html=stat('Overall points',score(v.overall))+stat('Class points',score(v.classPos))+`<p>Separate standings using ${esc(row.name)}. Bonuses shown here assume both example entries are eligible.</p>`;}
        }else if(kind==='drops'){
          const a=v.scores.split(',').map(s=>s.trim());if(!a.length||a.some(x=>x===''||!Number.isFinite(+x)||+x<0)){html='<p>Enter non-negative round scores separated by commas.</p>';}else{const scores=a.map(Number),dropped=new Set(scores.map((score,i)=>({score,i})).sort((a,b)=>a.score-b.score||a.i-b.i).slice(0,Math.min(v.drop,scores.length-1)).map(x=>x.i));html=scores.map((x,i)=>`<span>Round ${i+1}: ${dropped.has(i)?`<s>${x}</s> · dropped`:`<b>${x}</b>`}</span>`).join('')+stat('Kept total',scores.reduce((s,x,i)=>s+(dropped.has(i)?0:x),0));}
        }
        panel.querySelector('output').innerHTML=html;
      };panel.oninput=draw;draw();
    });
  }
  function policyCard(prefix, title, color) {
    const p = PushSave.policyFromSettings(state.settings, prefix);
    return `<form class="calc-policy" data-prefix="${prefix}" style="--calc-accent:${color}"><h4>${title}</h4><p>${prefix === 'tyreWear' ? 'Used when Pace-sensitive wear is enabled in the chosen Tyre Wear System.' : 'Used by the current Push & Save model. Legacy systems retain their original reference rules.'}</p><div class="calc-fields"><label>Benchmark<select data-policy="Benchmark">${methods(p.benchmark)}</select></label>${input('Window', 'Recent eligible laps · 0 = all', p.pacePolicy.window)}${input('Minimum', 'Minimum samples · 0 = automatic', p.pacePolicy.minimum)}</div><p class="muted">Automatic: median / average / weighted / trimmed need 3 samples; previous / best need 1. Track target needs no history. The current lap is compared with earlier laps, never with itself. Weighted: oldest to newest weights 1, 2, 3… Trimmed: remove 10% from each end, rounded down (fewer than 10 samples: ordinary average).</p><output data-preview="${prefix}" class="calc-preview"></output><button class="btn" type="submit">Save ${title} calculation</button><span class="calc-save" role="status"></span></form>`;
  }
  function recordControl(e, refs, fields = []) {
    const rows = refs[e] || [], current = rows.find(r => r.id === selected[e]) || rows[0];
    if (current) selected[e] = current.id;
    const schema = state.schema[e];
    if (!schema) return '';
    if (e === 'pushsavesystems' && current && current.mode !== 'median') fields = ['normal', ...fields.filter(k => k !== 'pushAt')];
    const inline = current ? fields.map(key => {
      const f = schema.fields.find(f => f.key === key);
      if (!f || !['number','select'].includes(f.type)) return '';
      if (f.type === 'select') return `<label>${esc(f.label)}<select data-record-field="${key}">${f.options.map(([v,t])=>`<option value="${esc(v)}"${(current[key]??f.default)===v?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
      return `<label>${esc(f.label)}${f.suffix ? ` (${esc(f.suffix)})` : ''}<input type="number" min="${f.min ?? 0}"${f.max !== undefined ? ` max="${f.max}"` : ''} step="any" data-record-field="${key}" value="${esc(current[key] ?? f.default ?? 0)}" required></label>`;
    }).join('') : '';
    return `<section class="calc-record" data-entity="${e}"><label>${esc(schema.label)}<select data-record-select${rows.length ? '' : ' disabled'}>${rows.length ? rows.map(r => `<option value="${esc(r.id)}"${r.id === current.id ? ' selected' : ''}>${esc(titleOf(e, r))}</option>`).join('') : '<option>No saved systems yet</option>'}</select></label>${inline ? `<form class="calc-record-form"><div class="calc-fields">${inline}</div><button class="btn">Save system values</button><span role="status" class="calc-save"></span></form>` : ''}<div class="calc-actions"><button class="btn" type="button" data-edit-record${current ? '' : ' disabled'}>Edit all ${esc(schema.label.toLowerCase())} rules</button><button class="btn" type="button" data-new-record>Create ${esc(schema.label.toLowerCase())}</button></div><p class="muted">These are the original saved settings. Changes also appear in Race Setup and apply to new races that use this system.</p></section>`;
  }
  function content(refs) {
    if(active==='resources')return `${formula('Resource balance','remaining = initial allocation + director adjustments − completed services','Each driver, slotcar or team has its own account. Event accounts span heats; championship accounts span loaded championship sessions. Points awards and result deletion do not change balances. Editing a profile does not refill existing accounts.','Three tyre sets − one starting set − one completed tyre change = one unused set.')}${formula('Service cost','tyre change = 1 set of the fitted compound\ndamage repair = 1 repair credit\nfailure repair = 1 repair credit + 1 replacement component','Each limit applies only when enabled. Failure repair reserves both supplies together. Insufficient supplies leave work undone, without charging a partial cost. Starting sets count; abandoned work and penalties consume no repair credits.','Damage plus failure repaired in one stop: two repair credits and one component when both limits are on.')}${routeButton('setup','resources','Edit Resource Systems')}`;
    if (active === 'pace') return `<p class="calc-intro">Choose each system’s reference independently. Eligible history excludes pit, slow, red-interrupted and full yellow laps. Removing or invalidating a lap rebuilds future references; it does not refund fuel or wear already used.</p>
      <section class="calc-example"><h4>Try a lap sequence</h4><div class="calc-fields"><label>Earlier eligible laps · seconds, separated by commas<input data-example="laps" value="${esc(example.laps)}"></label><label>New lap · seconds<input data-example="lap" type="number" min="0.001" step="0.001" value="${example.lap}"></label><label>Track target · seconds<input data-example="target" type="number" min="0" step="0.001" value="${example.target}"></label></div><p class="muted">Preview only. In a race, Track target comes from the active track in the Database.</p></section>
      ${policyCard('pushSave', 'Push & Save', 'var(--c-ps)')}${policyCard('tyreWear', 'Tyre Wear', 'var(--c-tyre)')}
      ${formula('Pace difference', '(lap ÷ reference − 1) × 100%', 'A negative difference is faster; a positive difference is slower. No available reference means normal use and wear.', '9.5 s against 10 s = −5%: pushing.')}
      ${formula('Push & Save curve', 'push: 1 + extra × min(1, −pace ÷ push threshold)\nsave: 1 − saving × min(1, pace ÷ save threshold)', 'Extra and saving are fractions. Fuel and tyres have their own switches and amounts. Early laps and excluded laps have no normal pace effect; the yellow-save option is a separate rule.', 'At −1.5%, with full push at −3% and +40% tyre wear, tyre multiplier = 1.20.')}
      ${recordControl('pushsavesystems', refs, ['pushAt', 'saveAt', 'tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave'])}
      ${formula('Tyre pace multiplier', 'clamp(1 + (reference ÷ lap − 1) × strength, minimum, maximum)', 'Default strength comes from Tyre Wear: 0.5 gentle, 1 normal or 1.5 strong, capped at ×0.5–×1.5. Custom response can override strength and limits. The contributor choice above determines which pace effects apply; other wear factors remain independent.', '10 s reference / 8 s lap at normal strength = 1.25 × base wear.')}${recordControl('tyrewearsystems', refs, ['paceWear','paceStrength','stop','changeSeconds'])}`;
    if (active === 'fuel') return `${recordControl('fuelrules', refs, ['tank', 'perLap', 'rate'])}<div id="calc-fuel-example"></div>
      ${formula('Fuel consumption', 'litres used = base litres per lap × combined use factor × Push & Save fuel factor', 'Without Push & Save, older Fuel Systems may still use their legacy target-lap curve. New Fuel Systems use their fixed per-lap amount. Damage is not part of the combined fuel multiplier.', '2 L × 1.20 hindrance × 1.25 push = 3 L per lap.')}
      ${formula('Combined fuel effects', 'signed effect = clamp(sum of enabled source percentages, −90, +90)\nuse = 1 − effect / 100; rate and tank = 1 + effect / 100', 'Balance of Power, weather and tyre grip add independently for each enabled lever. Positive helps; negative hinders. The tank lever applies only when enabled. They do not change measured lap times.', '−20% weather + 10% tyre help = −10%: 1.10 × fuel use; 0.90 × refuel rate if both levers are enabled.')}
      ${formula('Tyre life used', 'wear = compound wear × weather multiplier × distance factor × tyre pace × Push & Save tyres × temperature', 'Distance factor is 1 per lap, or lane length divided by 100 m / 100 ft for distance-based wear. Life is clamped to 0–100%.', '2% × 1.5 weather × 1.25 pace × 1.20 push = 4.5 percentage points of life.')}
      ${formula('Simulated tyre temperature', 'target = working midpoint + pace offset + 0.5 × (ambient now − dry ambient)\npace offset: intensity × 0.75 × range width; intensity scales from −1 at full Save to +1 at full Push\nnew temperature = move toward target by at most warm-up degrees per eligible lap\ncooling = move toward ambient by cooling degrees/minute × elapsed minutes', 'Temperature is optional in Tyre Wear. Weather mode uses air temperature converted to Celsius. Pits and yellow/red pauses cool. Recovery does not simulate offline time. Without eligible Push & Save data, the target is Normal.')}
      ${formula('Temperature wear multiplier', 'cold fraction = clamp((range low − T) ÷ (range low + 20), 0, 1)\nhot fraction = clamp((T − range high) ÷ (180 − range high), 0, 1)\nmultiplier = 1 + fraction × configured extra wear ÷ 100', 'Working-range temperatures have multiplier 1. The lap uses the mean temperature before/after its warming step; the widget shows the multiplier at the current temperature. Temperatures are bounded to −20…180 °C. Initial lifespan estimates assume multiplier 1.', 'With range 60–90 °C, T = 20 °C and 20% maximum cold wear: fraction 0.5 → wear ×1.10.')}
      ${formula('Fresh-tyre grip and the cliff', 'above cliff: bonus × (life − cliff) / (100 − cliff)\nbelow cliff: −hindrance × (cliff − life) / cliff', 'The curve meets zero at a nonzero cliff; a zero cliff applies full hindrance at empty. The resulting percentage feeds the enabled fuel levers. Grip does not speed up the measured clock.', 'Bonus 10%, cliff 40%, life 70% → +5% help.')}${recordControl('tyrewearsystems', refs, ['paceWear','paceStrength','stop','changeSeconds'])}${recordControl('weathersystems', refs)}`;
    if (active === 'effects') return `${bopControls()}
      ${formula('Automatic Balance of Power', 'spread = slowest pace − fastest pace\nscaled strength = maximum × min(1, spread ÷ full-effect gap)', 'Pace uses the chosen average or median and history window. Lane correction divides pace by lane length / mean lane length. Apply and remove thresholds avoid rapid switching. Graded mode scales each car by its distance from the field midpoint.', 'With a 20% maximum, full effect at 1 s and a 0.5 s spread, scaled strength is 10%.')}
      ${formula('Weather handicap', 'selected condition + fitted tyre category → configured help / hindrance', 'The Weather System owns condition probabilities, durations, wrong-tyre penalties and the handicap table. Tyre Wear owns its separate weather-wear table. Custom tyres inherit their chosen weather category.')}${recordControl('weathersystems', refs)}
      ${formula('Damage and failures', 'damage points → highest reached level\nrepair work → configured duration for that level', 'Damage level, repair work and failure chance have their own tables and triggers. Each failure is drawn once per car when a race or heat starts. Its chance is multiplied by the car’s failure factor, capped at 100%; the maximum-failures limit can discard drawn failures. A 10% chance with factor 2 means a 20% draw, not a check every lap.')}${recordControl('damagesystems', refs, ['stop'])}
      ${formula('Safety Car', 'too fast when full-yellow lap < configured target\nreduced pit work = normal work × (1 − reduction / 100)', 'Penalty points and pit reduction have independent switches. Track Call power behaviour comes from Race Setup. Random Flag conditions can hold pit exit or require a target pace; they do not rewrite the lap clock.')}${recordControl('safetycarsystems', refs, ['targetOn','target','pointsOn','points','pitOn','pitPercent'])}`;
    if (active === 'pits') return `${formula('Normal service order', 'fuel finish = missing litres ÷ effective rate\nrepair finish = repair time + (sequential ? fuel finish : 0)\ntyre finish = tyre time + (sequential ? max(fuel finish, repair finish) : 0)', 'The longest completion time sets the normal service duration. Driver-swap and sensor rules can also prevent release.', 'Fuel 8 s, repair 12 s, tyres 10 s: all parallel → 12 s; both sequential → 30 s.')}
      ${formula('Fixed Service Stop override', 'scaled job finish = original job finish × fixed window / longest job\nrelease due = fixed window + penalty time', 'A fixed Service Stop compresses or stretches ordinary service into the selected window. Penalties are always additional. Manual release, return-to-sensor and a Random Flag pit hold can keep the car waiting after the timer.', '45 s of service fitted into 30 s, plus a 5 s penalty → at least 35 s.')}
      ${recordControl('racesetups', refs, ['serviceStop','pitServiceWork','pitHoldSeconds'])}
      ${formula('Penalty points and tiers', 'per-point: consequence = points × amount\ntable: highest reached threshold supplies the consequence', 'A higher unserved pit tier replaces the lower tier. Completed pit penalties remain served; Special Penalties remain separate. Time and lap totals are recalculated from the current tier. Disqualification checks use the enabled thresholds.', 'Thresholds: 1 → nothing, 3 → 5 s, 5 → 10 s. Four points give 5 s; five give 10 s total.')}${recordControl('penaltysystems', refs)}${recordControl('damagesystems', refs, ['stop'])}${recordControl('tyrewearsystems', refs, ['paceWear','paceStrength','stop','changeSeconds'])}`;
    if (active === 'estimates') return `<div class="calc-actions">${routeButton('custom', 'layouts', 'Edit widget estimates in Layout Editor')}${routeButton('custom', 'charts', 'Edit chart calculations')}</div>${formula('Fuel Range widget', 'estimated laps left = remaining fuel ÷ selected average or median actual sampled use', 'The widget samples 3–20 recent clean laps and waits for at least 3. Estimates above choose average or median actual use and can override the widget history length. It includes effects actually applied on those laps. The sample count belongs to each widget in the Layout Editor.', '30 L remaining / 2.5 L average used = about 12 laps.')}
      ${formula('Tyre life estimate', 'laps left = remaining life ÷ base wear for current weather and lane', 'This is a base estimate. It does not predict future pace or future weather. The system’s “Lasts about” control sets base wear as 100 / desired lifetime.', '60% life / 2% per lap = about 30 laps; 800-lap base life means 0.125% wear.')}
      ${formula('Fractional-lap gap', 'lap gap ≈ engine time gap ÷ selected leader pace estimate', 'Uses the median by default; choose average and a history window above. Rounded to one decimal. Practice and qualifying continue to compare best times. Track length is not needed to convert a time gap into a fraction of a lap; distance racing has separate length-based estimates.', '2 s gap / 10 s median = +0.2 laps.')}
      ${formula('Speed, scale speed and distance', 'speed (km/h) = lane metres / lap seconds × 3.6\nscale speed = physical speed × scale factor\ndistance = sum of counted lane lengths', 'Feet, miles and other display units are conversions of stored metres. A missing lane length means a speed or distance estimate is unavailable.')}
      ${formula('Sensors, red flags and first crossing', 'minimum accepted interval = max(0.800 s, track minimum)\ninterrupted lap stays counted but is invalid for records', 'Race Setup controls formation-lap behaviour, red-flag restart and any optional interrupted-lap time addition. Pauses are excluded from the running clock. Sensor thresholds and pit confirmation are distinct from pace sampling.')}${recordControl('tracks', refs, ['targetLap', 'minLap', 'maxLap'])}${recordControl('racesetups', refs)}`;
    return `${formula('Average and median', 'average = sum of eligible lap times ÷ count\nmedian = middle sorted value (or mean of the two middle values)', 'Push & Save and Tyre Wear use the separate pace policies above. Charts have their own sampling options. Eligibility differs by purpose: a pit lap can count in a race result while being excluded from pace learning.')}
      ${formula('Consistency', 'consistency = √(sum of squared deviations ÷ number of eligible laps)', 'Results cards, database Statistics and generated reports use the same population standard deviation. At least two eligible laps are needed. Invalid, removed, slow and pit laps do not count; late token laps are invalid. Existing lap records stay unchanged; derived consistency is recalculated when displayed.', 'For 9 s and 11 s: mean = 10 s; consistency = 1 s on every screen.')}
      ${formula('Classification and records', 'adjusted time = measured race time + applicable time consequences\nclassification follows the selected session winner rule', 'Invalid laps remain in distance unless removed, but cannot set fastest laps, Personal Bests or Track Records. Removed laps do not count. Disqualified and retired participants follow the session classification rules. Practice and qualifying compare eligible best laps.')}
      ${formula('Multi-Class scoring', 'class position = rank among eligible entries in the same class\nclass points = class position table + eligible class bonuses\noverall points and class points are separate totals', 'Each class reuses the heat or championship rules for ties, dropped results, sprint shares and team allocation. Choose a table override in Race Setup > Multi-Class Systems.')}
      ${formula('Virtual Rival replay', 'replay lap = recorded lap × 100 ÷ replay speed (%)\nreplay progress = elapsed race clock', 'Pauses and red flags freeze replay. Invalid source laps are excluded; pit laps are optional. Replayed service time is not charged a second time. Change speed and sequence in Race Setup > Virtual Rival Systems.')}
      ${formula('Plugin race rules', 'consumption = built-in amount × frozen plugin factor\neffective time += valid-lap rule time\ncompetition points += eligible plugin bonus', 'Optional: choose one rule plugin in Race Setup → Rules and Systems. Configure it under App Settings → Plugins. Its bounded program is frozen before racing, stored with results and never changes raw lap times. Fuel/tyre factors are limited to 0–10; disabled systems stay disabled. No plugin worker is called during timing.')}
      ${formula('Heat points', 'heat position → selected points table\naggregate = selected heat results under the heat scoring rule', 'Heat Setup controls which results count, tie ordering, finals and points. Race Results displays the points supplied by that competition; absent points are shown as unavailable, not invented as zero.')}${recordControl('racesetups', refs)}${recordControl('rotationsetups', refs)}
      ${formula('Championship points', 'session score = rounded share of position points and eligible bonuses\nstanding = sum of kept round scores', 'Sprint share and rounding, fastest-lap eligibility, pole and start bonuses, guest scoring, team contribution, dropped results and tie order are configured in the Championship. Dropped results remove the lowest scores, with earlier equal scores dropped first; at least one decided result remains.', 'Scores 10, 6, 8 with one dropped result → 18 points before other rounds.')}${recordControl('championships', refs)}
      ${formula('Time Tokens and endurance', 'token balance = purchased time − elapsed chargeable time', 'A token lane counts laps while paid time remains. Endurance tracks stint time or distance and applies configured missing-swap consequences. The corresponding setup editors retain these rules; normal fuel and tyre systems do not run in a Time Token session.')}${routeButton('setup', 'tokens', 'Edit Time Token rules')}`;
  }
  function bopControls() {
    const c = Bop.settingsOf(state.settings);
    return `<form class="calc-bop calc-policy"><h4>Balance of Power calculation</h4><div class="calc-fields"><label>Measure<select name="bopMeasure"><option value="median"${c.measure === 'median' ? ' selected' : ''}>Median</option><option value="average"${c.measure === 'average' ? ' selected' : ''}>Average</option></select></label><label>Recent laps<input name="bopWindow" type="number" min="3" max="50" value="${c.window}" required></label><label>Minimum laps<input name="bopMinLaps" type="number" min="1" max="50" value="${c.minLaps}" required></label></div><button class="btn">Save Balance of Power calculation</button><span class="calc-save" role="status"></span><p class="muted">Uses the same settings as the Balance of Power page.</p>${routeButton('setup', 'bop', 'Edit all Balance of Power rules')}</form>`;
  }
  async function render(box) {
    const rows = await Promise.all(entities.map(e => api.list(e))), refs = Object.fromEntries(entities.map((e, i) => [e, rows[i]]));
    if (!box.isConnected) return;
    Object.assign(state.refs, refs);
    const section = sections.find(s => s[0] === active);
    box.innerHTML = `<section class="calc-page calc-expanded setuppage"><header class="calc-head"><div><p class="eyebrow">SETTINGS FOR FUTURE RACES</p><h3>Calculations</h3><p>In plain words: choose how pace is measured, see what every racing system adds, and tune the original settings in one place.</p></div><aside><b>Predictable races</b><span>A running race keeps its starting rules. New results retain those rules for review.</span></aside></header><div class="calc-shell"><nav class="calc-rail" aria-label="Calculation sections">${sections.map(([id, title, note, color]) => `<button class="btn" type="button" data-calc-section="${id}" aria-current="${id === active ? 'page' : 'false'}" style="--calc-accent:${color}"><b>${title}</b><small>${note}</small></button>`).join('')}</nav><main class="calc-content" style="--calc-accent:${section[3]}"><header><p class="eyebrow">CALCULATION LIBRARY</p><h3>${section[1]}</h3></header>${active==='pace'?extraControls('response'):active==='estimates'?extraControls('estimates'):''}${laboratories()}${content(refs)}</main></div></section>`;
    box.querySelectorAll('[data-calc-section]').forEach(b => b.onclick = () => { active = b.dataset.calcSection; render(box); });
    box.querySelectorAll('[data-calc-route]').forEach(b => b.onclick = () => {
      state.tab = b.dataset.calcRoute;
      if (state.tab === 'custom') state.customSub = b.dataset.sub; else state.setupSub = b.dataset.sub;
      window.render();
    });
    box.querySelectorAll('[data-example]').forEach(el => el.oninput = () => { example[el.dataset.example] = el.value; preview(box); });
    box.querySelectorAll('[data-prefix]').forEach(form => {
      form.oninput = () => preview(box);
      form.onsubmit = async ev => {
        ev.preventDefault(); if (!form.reportValidity()) return; const p = readPolicy(form), prefix = form.dataset.prefix;
        const automatic = ['last', 'best'].includes(p.benchmark) ? 1 : 3;
        if (p.benchmark !== 'track' && p.window && p.window < (p.minimum || automatic)) { form.querySelector('.calc-save').textContent = 'History must hold at least the required samples.'; return; }
        await save(form, () => api.setSettings({ [prefix + 'Benchmark']: p.benchmark, [prefix + 'Window']: p.window, [prefix + 'Minimum']: p.minimum }), true);
      };
    });
    const bop = box.querySelector('.calc-bop');
    if (bop) bop.onsubmit = async ev => { ev.preventDefault(); const data = Object.fromEntries(new FormData(bop)); if (+data.bopMinLaps > +data.bopWindow) { bop.querySelector('.calc-save').textContent = 'Minimum laps cannot exceed the history window.'; return; } data.bopWindow = +data.bopWindow; data.bopMinLaps = +data.bopMinLaps; await save(bop, () => api.setSettings(data), true); };
    box.querySelectorAll('[data-entity]').forEach(panel => {
      const e = panel.dataset.entity, row = refs[e].find(r => r.id === selected[e]);
      panel.querySelector('[data-record-select]').onchange = ev => { selected[e] = ev.target.value; render(box); };
      const edit = async item => {
        if (e === 'championships' || e === 'rotationsetups') {
          state.tab = 'setup'; state.setupSub = e === 'championships' ? 'championships' : 'rotation';
          await window.render();
          const host = document.getElementById('setupmgr');
          const button = item ? [...host.querySelectorAll('[data-edit]')].find(b => b.dataset.edit === item.id) : host.querySelector(e === 'championships' ? '#newch' : '#newrot');
          if (button) button.click();
          return;
        }
        openForm(e, item); dlg.addEventListener('close', () => { if (box.isConnected) render(box); }, { once: true }); };
      panel.querySelector('[data-edit-record]').onclick = () => edit(row);
      panel.querySelector('[data-new-record]').onclick = () => edit(null);
      const form = panel.querySelector('form');
      if (form) { form.oninput = () => fuelPreview(box); form.onsubmit = async ev => {
        ev.preventDefault(); if (!form.reportValidity()) return;
        const patch = Object.fromEntries([...form.querySelectorAll('[data-record-field]')].map(el => [el.dataset.recordField, el.tagName==='SELECT'?el.value:Number(el.value)]));
        if (e === 'pushsavesystems' && row.mode !== 'median' && patch.saveAt <= patch.normal) { form.querySelector('.calc-save').textContent = 'Full save must be slower than normal pace.'; return; }
        await save(form, async () => { const result = await api.update(e, row.id, patch); Object.assign(row, patch); box.querySelectorAll('[data-lab]').forEach(el=>el.dispatchEvent(new Event('input'))); return result; });
      }; }
    });
    preview(box); fuelPreview(box); wireTools(box, refs);
  }
  async function save(form, write, settings = false) {
    const button = form.querySelector('button'), status = form.querySelector('.calc-save'); button.disabled = true;
    try { const result = await write(); if (settings) state.settings = result; status.textContent = 'Saved for new races'; }
    catch (e) { status.textContent = 'Could not save: ' + e.message; }
    finally { button.disabled = false; }
  }
  function readPolicy(form) {
    const value = key => form.querySelector(`[data-policy="${key}"]`).value;
    return { benchmark: value('Benchmark'), window: Number(value('Window')), minimum: Number(value('Minimum')) };
  }
  function preview(box) {
    const laps = String(example.laps).split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => Number.isFinite(n) && n > 0).map(n => n * 1000);
    box.querySelectorAll('[data-prefix]').forEach(form => {
      const p = readPolicy(form), ref = PushSave.benchmark(p.benchmark, laps, Number(example.target) * 1000, p), lap = Number(example.lap) * 1000;
      const pace = ref > 0 && lap > 0 ? (lap / ref - 1) * 100 : null;
      const out = form.querySelector('output');
      const position = pace === null ? 50 : Math.max(2, Math.min(98, 50 + pace * 2));
      out.innerHTML = `<div class="calc-preview-numbers"><b>${ref ? (ref / 1000).toFixed(3) + ' s reference' : 'Waiting for reference'}</b><span>${pace === null ? 'Add enough eligible laps or a track target' : (pace > 0 ? '+' : '') + pace.toFixed(2) + '% · ' + (pace < 0 ? 'faster' : pace > 0 ? 'slower' : 'at benchmark')}</span></div><div class="calc-pace-bar" aria-hidden="true"><i style="left:${position}%"></i></div><div class="calc-bar-labels"><span>Faster</span><span>Benchmark</span><span>Slower</span></div>`;
    });
  }
  function fuelPreview(box) {
    const target = box.querySelector('#calc-fuel-example'), panel = box.querySelector('[data-entity="fuelrules"]'); if (!target || !panel) return;
    if (!panel.querySelector('[data-record-field]')) { target.textContent = 'Choose or create a Fuel System to preview its range and refuel duration.'; return; }
    const value = key => Number(panel.querySelector(`[data-record-field="${key}"]`)?.value);
    const tank = value('tank'), use = value('perLap'), rate = value('rate');
    target.innerHTML = `<div class="calc-preview"><b>Base values before racing effects</b><div class="calc-preview-numbers"><span>Full tank: <strong>${use > 0 ? (tank / use).toFixed(1) + ' laps' : 'no consumption'}</strong></span><span>Empty to full: <strong>${rate > 0 ? (tank / rate).toFixed(1) + ' s' : 'no refuelling'}</strong></span></div></div>`;
  }
  return { render };
})();
