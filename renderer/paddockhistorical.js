const PaddockHistorical=(()=>{
 // Paddock.exclusive rejects this exact message BEFORE admitting any work.
 // Never repeat an uncertain write, network failure, or changed identity here.
 async function requestWhenReady(request,active=()=>true,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
  for(let attempt=0;;attempt++){
   if(!active())throw Error('Historical Review closed.');
   try{return await request();}catch(error){
    if(!String(error?.message).endsWith('Wait for the current Paddock operation.')||attempt===5)throw error;
    await wait(250*(attempt+1));
   }
  }
 }
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const missingLabel={'crossing-times':'lap crossing timestamps','driver-boundaries':'driver change times',classification:'final classification and awards','record-eligibility':'record eligibility','race-date':'race start and finish times',configuration:'captured car configurations','lane-lengths':'recorded lane lengths'};
 const label={queued:'Waiting to submit — not accepted',pending:'Pending review — not accepted',approved:'Approved in Paddock — original acceptance confirmed',rejected:'Rejected — not accepted',cancelled:'Cancelled — not accepted',conflict:'Conflict — no history replaced'};
 const notice='Received is not accepted. Only an approved decision from Paddock Review confirms acceptance. Pending imports do not add laps, mileage, wins or records to the collection. Your original Timing results remain unchanged.';
 function previewHtml(p){return `<h3>${esc(p.name)}</h3><p><strong>Review destination:</strong> ${esc(p.collectionName||p.databaseId)}</p><p>${esc(p.track)} · ${p.laps} saved ${p.laps===1?'lap':'laps'}</p><p>${notice}</p>${p.approvalEnabled===true?'':'<p class="muted">Historical approval is not available on this connection yet. Evidence can still be submitted for review.</p>'}<ul>${p.participants.map(v=>`<li>${esc(v.name)} · ${v.laps} ${v.laps===1?'lap':'laps'} · ${v.kind==='virtual'?'Virtual':v.carId?'Recorded collection car: '+esc(v.carId):'No recorded collection identity — not linked automatically'}</li>`).join('')}</ul><p><strong>Missing or not mapped:</strong> ${p.missing.map(k=>esc(missingLabel[k]||k)).join(', ')}.</p><p class="muted">Saved overall/class results and identifiable heat/final results accompany the lap evidence. Championship awards without saved values and virtual replay summaries stay in Timing’s original evidence. Unknown values stay unknown. No current car configuration or track length is substituted. One session per submission, up to 50,000 laps and 8 MiB. Large transfers resume after interruptions when Paddock supports them; delivery still only means awaiting review.</p><button class="btn primary" data-historical-submit>Submit evidence for review</button>`;}
 function rowHtml(r,controls=true){return `<article class="card"><h4>${esc(r.name)}</h4><p>${r.state==='blocked'?'<strong>Needs attention — automatic retry stopped</strong>':r.cancelRequested&&r.state!=='complete'?'Cancellation requested — awaiting confirmation':''}</p>${r.items.map(i=>`<p>${r.items.length>1?'Session '+esc(i.sessionId)+'<br>':''}<strong>${esc(label[i.status]||'Unsupported decision — needs review')}</strong>${i.message?' · '+esc(i.message):''}${i.status==='approved'?'<br><small>Accepted at revision 1. This receipt does not confirm the current state: check Collection race history for later corrections or withdrawal.</small>':''}</p>`).join('')}<p class="muted">${esc(r.databaseId)} · ${esc(r.sessionId)}${r.checkedAt?' · Checked '+esc(new Date(r.checkedAt).toLocaleString()):''}</p>${r.error?`<p role="alert">${esc(r.error)}</p>`:''}${r.state==='blocked'?'<p>Original evidence and request identity are retained. Compare this submission in Paddock Review before any manual reconciliation; Timing will not redirect or recreate it after a restore.</p>':r.state==='complete'||!controls?'':`<div class="row"><button class="btn" data-review-refresh="${esc(r.id)}">Check status / retry</button><button class="btn" data-review-cancel="${esc(r.id)}" ${r.cancelRequested?'disabled':''}>Cancel pending submission</button></div>`}</article>`;}
 async function mount(root,api){
  let page=0;
  async function load(){
   if(!root.isConnected)return;
   try{const rows=await api.paddockHistoricalReview({action:'list'});if(!root.isConnected)return;page=Math.min(page,Math.max(0,Math.ceil(rows.length/10)-1));
    const wasOpen=root.querySelector('details')?.open;
    root.innerHTML=`<details class="card" ${wasOpen?'open':''}><summary>Historical Review · ${rows.length} retained ${rows.length===1?'submission':'submissions'}</summary><p>${notice}</p><p>To submit an older race, open its local session below and choose <strong>Historical Review…</strong>. Nothing is submitted automatically. Review decisions belong to Paddock → Review → Historical imports. Timing cannot approve evidence.</p><div role="status" data-review-message></div>${rows.slice(page*10,page*10+10).map(r=>rowHtml(r)).join('')}${rows.length>10?`<div class="row"><button class="btn" data-review-page="-1" ${page?'':'disabled'}>Previous</button><span>Page ${page+1}</span><button class="btn" data-review-page="1" ${(page+1)*10<rows.length?'':'disabled'}>Next</button></div>`:''}<button class="btn" data-review-reload>Refresh saved statuses</button></details>`;
   }catch(e){root.textContent='Historical Review could not be loaded: '+e.message;}
  }
  root.onclick=async e=>{
   const b=e.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-review-reload'))return load();
   if(b.hasAttribute('data-review-page')){page+=Number(b.dataset.reviewPage);return load();}
   const id=b.dataset.reviewRefresh||b.dataset.reviewCancel;if(!id)return;b.disabled=true;
   try{await requestWhenReady(()=>api.paddockHistoricalReview({action:b.dataset.reviewCancel?'cancel':'refresh',id}),()=>root.isConnected);await load();}catch(error){if(root.isConnected){root.querySelector('[data-review-message]').textContent=error.message;b.disabled=false;}}
  };
  root.addEventListener('historical-changed',()=>void load());await load();
 }
 async function open(api,sessionId){
  const dialog=document.createElement('dialog');dialog.className='paddock-dialog historical-dialog';dialog.innerHTML='<h2>Submit older race evidence</h2><div data-historical-preview role="status">Checking saved evidence and host support…</div><div data-historical-message role="status"></div><div class="row"><button class="btn" data-historical-close>Close</button></div>';document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.querySelector('[data-historical-close]').onclick=()=>dialog.close();dialog.showModal();
  async function loadPreview(){
  dialog.querySelector('[data-historical-preview]').textContent='Checking saved evidence and host support…';
  try{const p=await requestWhenReady(()=>api.paddockHistoricalReview({action:'preview',sessionId}),()=>dialog.isConnected);if(!dialog.isConnected)return;dialog.querySelector('[data-historical-preview]').innerHTML=previewHtml(p);
   dialog.querySelector('[data-historical-submit]').onclick=async e=>{e.target.disabled=true;dialog.querySelector('[data-historical-message]').textContent='Submitting saved evidence…';try{const row=await requestWhenReady(()=>api.paddockHistoricalReview({action:'submit',sessionId,originHash:p.originHash,databaseId:p.databaseId,recoveryId:p.recoveryId}),()=>dialog.isConnected);if(dialog.isConnected){dialog.querySelector('[data-historical-message]').textContent='';dialog.querySelector('[data-historical-preview]').innerHTML=`<p>${notice}</p>`+rowHtml(row,false);}document.querySelector('[data-historical-review]')?.dispatchEvent(new Event('historical-changed'));}catch(error){if(dialog.isConnected){dialog.querySelector('[data-historical-message]').textContent=error.message;e.target.disabled=false;}}};
  }catch(e){if(dialog.isConnected){const box=dialog.querySelector('[data-historical-preview]');box.textContent=e.message;const retry=document.createElement('button');retry.className='btn';retry.dataset.historicalRetry='';retry.textContent='Retry preview';retry.onclick=loadPreview;box.append(document.createElement('br'),retry);}}
  }
  await loadPreview();
 }
 return {mount,open,previewHtml,rowHtml,notice,requestWhenReady};
})();
if(typeof module!=='undefined')module.exports=PaddockHistorical;
