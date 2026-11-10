/* Central history is read-only until the coordinated correction contract lands.
   Never convert remote participant/track IDs into local database IDs by name. */
const PaddockHistory=(()=>{
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=x=>Number.isFinite(x)?(x/1000).toFixed(3):'—';
 const identity=r=>JSON.stringify([r.sourceId,r.sessionId]);
 function richHeadHtml(v){
  const {race:r,context:c,provenance:p}=v.body,names=xs=>new Map(xs.map(x=>[x.id,x.name]));
  const cars=new Map(r.participants.map(x=>[x.id,x.displayName])),classes=names(c.classes),heats=names(r.heats),teams=names(c.teams);
  const participant=id=>{const p=r.participants.find(x=>x.id===id);return escape(p.displayName)+(p.teamId?'<br><small>'+escape(teams.get(p.teamId))+'</small>':'')+(p.drivers.length?'<br><small>'+p.drivers.map(d=>escape(d.name)).join(', ')+'</small>':'');};
  const effect=e=>e.kind==='time'?time(e.amount)+' s':escape(e.amount)+' '+escape(e.kind);
  const scopes={overall:'Overall',class:'Class',heat:'Heat',final:'Final','championship-award':'Championship award'};
  const value=x=>x===null?'Unknown':escape(x),heatNames=ids=>ids.map(id=>escape(heats.get(id)||id)).join(', ')||'—';
  return `<p>${escape(r.track.name)} · ${escape(r.type)} · ${r.startedAt?escape(new Date(r.startedAt).toLocaleString()):c.savedAt?'Saved '+escape(new Date(c.savedAt).toLocaleString())+' (start time not recorded)':'Race date unknown'} · revision ${v.accepted.revision}</p>
   <p class="muted">${p.kind==='historical'?'Accepted historical evidence':'Recorded race history'}. ${escape(p.evidence)}${p.missing.length?' Missing evidence: '+p.missing.map(escape).join(', ')+'.':''}</p>
   ${c.classification.length?`<div class="wrap"><table class="fields"><thead><tr><th>Classification</th><th>Car / team</th><th>Position</th><th>Laps</th><th>Time (s)</th><th>Points / score</th></tr></thead><tbody>${c.classification.map(a=>`<tr><td>${scopes[a.scope]}${a.scopeId?' · '+escape(classes.get(a.scopeId)||heats.get(a.scopeId)||a.scopeId):''}</td><td>${participant(a.participantId)}</td><td>${value(a.position)} · ${escape(a.status)}</td><td>${value(a.laps)}</td><td>${a.elapsedMs===null?'Unknown':time(a.elapsedMs)}</td><td>${value(a.points)} points${a.score===null?'':' · '+escape(a.score)+' '+escape(a.scoreUnit||'')}${a.incomplete===true?' · Incomplete':''}${a.estimated===true?' · Estimated':''}${a.gap?'<br>Gap: '+escape(a.gap.value)+' '+escape(a.gap.unit):''}</td></tr>`).join('')}</tbody></table></div>`:'<p>No verified classification was supplied.</p>'}
   <p class="muted">Overall, class, heat, final and championship awards are separate. Missing values stay unknown. These accepted results are not added again to local race totals.</p>
   ${c.classification.some(a=>a.effects.length||a.countedHeatIds.length||a.droppedHeatIds.length)?`<details><summary>Scoring evidence and reviewed adjustments</summary>${c.classification.map(a=>`<p>${escape(cars.get(a.participantId))} · ${scopes[a.scope]}${a.scopeId?' · '+escape(a.scopeId):''}<br>Counted heats: ${heatNames(a.countedHeatIds)} · Dropped heats: ${heatNames(a.droppedHeatIds)}${a.effects.map(e=>'<br>'+effect(e)+' — '+escape(e.reason)).join('')}</p>`).join('')}</details>`:''}
   ${c.notes?`<p class="central-notes">${escape(c.notes)}</p>`:''}
   <label>Lap times <select data-central-participant>${r.participants.map(p=>`<option value="${escape(p.id)}">${escape(p.displayName)} (${v.lapCounts.find(x=>x.participantId===p.id)?.count||0} laps)</option>`).join('')}</select></label><div data-central-laps></div><button class="btn" data-car-statistics>Collection statistics for selected car</button><div data-car-statistics-result></div>`;
 }
 function headHtml(v){
  if(v.body?.format==='history-v1')return richHeadHtml(v);
  const p=v.payload;
  if(p.state==='withdrawn')return `<p>This session was withdrawn. It no longer contributes to records or mileage.</p><p>${escape(p.reason)}</p>`;
  const summaries=new Map(v.summaries.map(s=>[s.participantId,s]));
  return `<p>${escape(p.track.name)} · ${escape(p.type)} · ${escape(new Date(p.startedAt).toLocaleString())} · revision ${escape(p.revision)}</p>
   ${v.requiresCorrection?'<p role="alert">Needs correction. These results are excluded from physical-car statistics.</p>':''}
   ${v.warnings.length?`<p>${v.warnings.map(w=>escape(typeof w==='string'?w:w.message||w.code)).join(' · ')}</p>`:''}
   <div class="wrap"><table class="fields"><thead><tr><th>Position</th><th>Car / drivers</th><th>Classified laps</th><th>Classified time</th><th>Eligible best</th><th>Distance</th></tr></thead><tbody>${[...p.participants].sort((a,b)=>(p.standings.find(s=>s.participantId===a.id)?.position??Infinity)-(p.standings.find(s=>s.participantId===b.id)?.position??Infinity)).map(e=>{
    const s=p.standings.find(s=>s.participantId===e.id),summary=summaries.get(e.id),stats=e.kind==='physical'&&e.carId&&summary?.included&&!v.requiresCorrection?summary.statistics:null;
    return `<tr><td>${escape(s?.position??'—')}<br>${escape(s?.status||'')}</td><td>${escape(e.displayName)}${e.kind==='virtual'?' · Virtual':''}<br><small>${e.drivers.map(d=>escape(d.name)).join(', ')}</small></td><td>${escape(s?.classifiedLaps??'—')}</td><td>${time(s?.classifiedElapsedMs)}</td><td>${time(stats?.bestLapMs)}</td><td>${stats?escape(stats.distanceM)+' m'+(stats.distanceComplete?'':' (known distance)'):'—'}</td></tr>`;
   }).join('')}</tbody></table></div>
   <p class="muted">${v.summaryCoverage==='unavailable'?'Times in seconds. Classification includes reviewed adjustments. Read measured laps below; accepted car totals are available through Collection statistics. Session best/distance summaries are not supplied by this history endpoint.':'Times in seconds. Classification includes reviewed adjustments; eligible bests use measured laps. Bests are for this session, not cross-track records.'}</p>
   ${p.adjustments?.length?`<details><summary>Reviewed adjustments</summary><ul>${p.adjustments.map(a=>`<li>${escape(p.participants.find(e=>e.id===a.participantId)?.displayName)}: ${escape(a.amount)} ${escape(a.kind)} — ${escape(a.reason)}</li>`).join('')}</ul></details>`:''}
   ${p.notes?`<p class="central-notes">${escape(p.notes)}</p>`:''}
   <label>Lap times <select data-central-participant>${p.participants.map(e=>`<option value="${escape(e.id)}">${escape(e.displayName)} (${v.lapCounts.find(c=>c.participantId===e.id)?.count||0} laps)</option>`).join('')}</select></label><div data-central-laps></div>${v.protocol==='shared'?'<button class="btn" data-car-statistics>Collection statistics for selected car</button><div data-car-statistics-result></div>':''}`;
 }
 function lapsHtml(v,head){
  const e=head.payload.participants.find(p=>p.id===v.participantId);
  return `<div class="wrap"><table class="fields"><thead><tr><th>Lap</th><th>Time (s)</th><th>Heat / lane</th><th>Driver</th><th>Eligibility</th></tr></thead><tbody>${v.laps.map(l=>{
   const s=e.stints.find(s=>s.id===l.stintId),driver=e.drivers.find(d=>d.id===s?.driverId),heat=head.payload.heats.find(h=>h.id===s?.heatId);
   if(v.format==='history-v1'){
    const known=x=>x===null?'Unknown':x?'Yes':'No';
    return `<tr><td>${escape(l.number)}</td><td>${l.durationMs===null?'Unknown':time(l.durationMs)}</td><td>${escape(head.payload.heats.find(h=>h.id===l.heatId)?.name||l.heatId||'Unknown heat')} · ${escape(l.lane??'Unknown lane')}</td><td>${escape(e.drivers.find(d=>d.id===l.driverId)?.name||l.driverId||'Unknown driver')}</td><td>Valid: ${known(l.valid)} · Pit: ${known(l.pit)}<br>Personal best: ${known(l.personalRecordEligible)} · Track record: ${known(l.trackRecordEligible)}${l.flags.length?'<br>'+l.flags.map(escape).join(', '):''}${l.reason?' · '+escape(l.reason):''}</td></tr>`;
   }
   const eligibility=!l.valid?'Invalid':l.pit?'Pit lap':l.recordEligible?'Record eligible':'Not record eligible';
   return `<tr><td>${escape(l.number)}</td><td>${time(l.durationMs)}</td><td>${escape(heat?.name||s?.heatId)} · ${escape(s?.lane)}</td><td>${escape(driver?.name)}</td><td>${eligibility}${l.reason?' · '+escape(l.reason):''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
 }
 function statisticsHtml(v,name){
  return `<section class="card"><h4>${escape(name)} · accepted collection statistics</h4><p>${escape(v.acceptedSessions)} sessions · ${escape(v.measuredLaps)} measured laps · ${escape(v.validLaps)} valid non-pit laps</p><p>Average lap: ${time(v.averageLapMs)} s · Eligible best: ${time(v.bestPersonalLapMs)} s · Overall wins: ${escape(v.overallWins)} · Class wins: ${escape(v.classWins)}</p><p>Track-record eligible best: ${time(v.bestTrackLapMs)} s · Historical sessions: ${escape(v.historicalSessions)}</p><p>Physical distance: ${v.distanceComplete||v.unknownDistanceLaps<v.measuredLaps?escape(v.distanceM)+' m':'Unknown'}${v.distanceComplete?'':' · incomplete: '+escape(v.unknownDistanceLaps)+' laps have unknown distance'}</p><p class="muted">All tracks and drivers for this physical car. Accepted evidence is counted once; it is never added again as a second copy. Manual records and opening counters are excluded. Class wins are separate from overall wins; heat, final and championship awards do not count as whole-session wins. Only valid, non-pit laps enter averages and eligible bests.${v.quarantinedSessions?' '+escape(v.quarantinedSessions)+' conflicting sessions are excluded.':''}</p></section>`;
 }
 const busy=e=>String(e?.message).includes('Wait for the current Paddock operation.');
 async function readWhenReady(read,active=()=>true,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
  for(let attempt=0;;attempt++){
   if(!active())throw Error('History view closed.');
   try{return await read();}catch(e){if(!busy(e)||attempt===5)throw e;await wait(250*(attempt+1));}
  }
 }
 async function mount(root,localBox,api,openLocal){
  let offset=0,page=null,query='',filterState='all',snapshot=null,previous=[],seq=0,matches=new Set(),revealed=new Set(),baseline=null;
  const applyDuplicates=()=>{for(const el of localBox.querySelectorAll('details.sess[data-sid]'))el.hidden=matches.has(el.dataset.sid)&&!revealed.has(el.dataset.sid);};
  // Local pagination and race tools can rerender independently of this pane.
  const observer=new MutationObserver(()=>{if(!root.isConnected){observer.disconnect();return;}applyDuplicates();});observer.observe(localBox,{childList:true,subtree:true});
  const status=r=>r.offline?`<p role="status">Cached copy · last checked ${escape(new Date(r.checkedAt).toLocaleString())}. ${escape(r.warning)}</p>`:'';
  async function load(){
   const run=++seq;root.hidden=false;root.innerHTML='<p role="status">Loading collection history…</p>';
   matches=new Set();applyDuplicates();
   try{
    const hint=await api.paddockHistory({kind:'hint'});
    const r=await readWhenReady(()=>api.paddockHistory({kind:'list',offset,...(page?{page}:{}),q:query,state:filterState,...(snapshot?{snapshot}:{})}),()=>run===seq&&root.isConnected);if(run!==seq||!root.isConnected)return;
    baseline=JSON.stringify(hint);
    if(!r.available){root.hidden=true;return;}
    const v=r.value;
    root.innerHTML=`<div class="row"><h3>Race history</h3><button class="btn" data-central-refresh>Refresh history</button></div><p data-central-notice role="status" hidden></p><p class="muted">Finalised sessions from your car collection. Open a session for classification, measured laps and eligible bests. Race tools and track/personal records remain below.</p>`;
    if(!v){root.insertAdjacentHTML('beforeend',`<p role="status">${escape(r.warning)}</p>`);root.querySelector('[data-central-refresh]').onclick=()=>{offset=0;page=null;snapshot=null;previous=[];void load();};return;}
    snapshot=v.snapshot;const protocol=v.protocol;
    matches=new Set(Object.values(r.localMatches||{}).filter(Boolean));applyDuplicates();
    root.insertAdjacentHTML('beforeend',status(r)+`<div class="row"><button class="btn" data-central-prev ${previous.length?'':'disabled'}>Previous sessions</button><span>${v.results.length} sessions · ${protocol==='shared'?'newest first':'source/session order'}</span><button class="btn" data-central-next ${(protocol==='shared'?v.nextPage===null:v.nextOffset===null)?'disabled':''}>Next sessions</button></div>${v.results.length?'':query||filterState!=='all'?'<p>No sessions match these filters.</p>':'<p>No finalised sessions in this collection yet.</p>'}`);
    if(protocol==='shared'){root.insertAdjacentHTML('beforeend',`<form data-history-filter class="row"><label>Find sessions <input name="query" maxlength="200" value="${escape(query)}" placeholder="Session name"></label><label>Show <select name="state"><option value="all">All sessions</option><option value="active">Active results</option><option value="withdrawn">Withdrawn</option></select></label><button class="btn">Apply filters</button></form>`);const form=root.querySelector('[data-history-filter]');form.elements.state.value=filterState;form.onsubmit=e=>{e.preventDefault();query=form.elements.query.value;filterState=form.elements.state.value;offset=0;page=null;snapshot=null;previous=[];void load();};}
    for(const result of v.results){
     const card=document.createElement('details');card.className='card central-session';card.innerHTML=`<summary>${escape(result.name)}${result.state==='withdrawn'?' · Withdrawn':''} <small>${result.startedAt?' · '+escape(new Date(result.startedAt).toLocaleString()):result.savedAt?' · Saved '+escape(new Date(result.savedAt).toLocaleString()):''} · revision ${result.revision}</small></summary><div class="sessbody"></div>`;root.append(card);
     let loaded=false;
     card.ontoggle=async()=>{if(!card.open||loaded)return;loaded=true;const body=card.querySelector('.sessbody');body.innerHTML='<p role="status">Loading session…</p>';
      try{const h=await api.paddockHistory({kind:'head',protocol,sourceId:result.sourceId,sessionId:result.sessionId,token:result.resultToken});if(run!==seq||!card.isConnected)return;
       if(!h.value){body.innerHTML=`<p>${escape(h.warning)}</p>`;loaded=false;return;}
       const head=h.value;body.innerHTML=status(h)+headHtml(head);
       const local=r.localMatches?.[identity(result)];if(local){const button=document.createElement('button');button.className='btn';button.textContent='Open local race tools';button.onclick=()=>{revealed.add(local);applyDuplicates();openLocal(local);};body.append(button);}
       if(head.payload.state==='withdrawn'||!head.payload.participants.length)return;
       const select=body.querySelector('[data-central-participant]'),lapBox=body.querySelector('[data-central-laps]');let lapSeq=0;
       async function laps(at=0){const generation=++lapSeq,participantId=select.value;lapBox.innerHTML='<p role="status">Loading lap times…</p>';
        try{const response=await api.paddockHistory({kind:'laps',protocol,sourceId:result.sourceId,sessionId:result.sessionId,token:result.resultToken,participantId,offset:at});if(generation!==lapSeq||!card.isConnected||run!==seq)return;
         if(!response.value){lapBox.innerHTML=`<p>${escape(response.warning)}</p>`;return;}
         const page=response.value;if((page.format==='history-v1')!==(head.body?.format==='history-v1'))throw Error('History format changed. Refresh the session.');const expected=head.lapCounts.find(x=>x.participantId===participantId)?.count||0;if(page.total!==expected)throw Error('Lap count changed. Refresh history before continuing.');
         lapBox.innerHTML=status(response)+`<div class="row"><button class="btn" data-lap-prev ${at?'':'disabled'}>Previous laps</button><span>${page.total?at+1:0}–${at+page.laps.length} of ${page.total}</span><button class="btn" data-lap-next ${page.nextOffset===null?'disabled':''}>Next laps</button></div>`+lapsHtml(page,head);
         lapBox.querySelector('[data-lap-prev]').onclick=()=>laps(Math.max(0,at-250));lapBox.querySelector('[data-lap-next]').onclick=()=>laps(page.nextOffset);
        }catch(e){if(generation===lapSeq&&run===seq)lapBox.innerHTML=`<p role="alert">${escape(e.message)} Reopen or refresh history to try again.</p>`;}
       }
       select.onchange=()=>{const stats=body.querySelector('[data-car-statistics-result]');if(stats)stats.innerHTML='';void laps();};
       const statsButton=body.querySelector('[data-car-statistics]');if(statsButton)statsButton.onclick=async()=>{const box=body.querySelector('[data-car-statistics-result]'),e=head.payload.participants.find(e=>e.id===select.value);if(!e?.carId){box.textContent='Virtual and unlinked entries have no shared car statistics.';return;}const selected=select.value;box.textContent='Loading accepted car statistics…';try{const response=await api.paddockHistory({kind:'statistics',protocol:'shared',carId:e.carId});if(run!==seq||!card.isConnected||select.value!==selected)return;box.innerHTML=response.value?status(response)+statisticsHtml(response.value,e.displayName):escape(response.warning||'Statistics are not available from this library.');}catch(error){if(select.value===selected)box.textContent=error.message;}};await laps();
      }catch(e){if(run===seq&&card.isConnected){loaded=false;body.innerHTML=`<p role="alert">${escape(e.message)} Refresh history to load the current revision.</p>`;}}
     };
    }
    root.querySelector('[data-central-prev]').onclick=()=>{({offset,page}=previous.pop());void load();};root.querySelector('[data-central-next]').onclick=()=>{previous.push({offset,page});offset=v.nextOffset??0;page=v.nextPage??null;void load();};root.querySelector('[data-central-refresh]').onclick=()=>{offset=0;page=null;snapshot=null;previous=[];void load();};
   }catch(e){if(run!==seq||!root.isConnected)return;root.innerHTML=`<p role="alert">Could not load collection history: ${busy(e)?'The collection is busy. Try Refresh history shortly.':escape(e.message)}</p><button class="btn">Refresh history</button>`;root.querySelector('button').onclick=()=>{offset=0;page=null;snapshot=null;previous=[];void load();};}
  }
  await load();
  // A hint prompts refresh without replacing a session while someone reads it.
  // Dispose on navigation; only a lightweight local status query runs here.
  async function watch(){
   if(!root.isConnected){observer.disconnect();return;}
   try{const info=await api.paddockHistory({kind:'hint'}),hint=JSON.stringify(info);if(baseline&&hint!==baseline){const notice=root.querySelector('[data-central-notice]');if(notice){notice.hidden=false;notice.textContent=info.error?'History synchronisation paused: '+info.error+' Timing will retry automatically.':info.history?.pending?'Updating saved collection history in the background. You can keep using Timing.':'The collection or connection changed. Refresh history to see updated results.';}}}catch{}
   if(root.isConnected)setTimeout(watch,5000);else observer.disconnect();
  }
  if(root.isConnected&&!root.hidden)setTimeout(watch,5000);
 }
 return {mount,headHtml,lapsHtml,statisticsHtml,readWhenReady};
})();
if(typeof module!=='undefined')module.exports=PaddockHistory;
