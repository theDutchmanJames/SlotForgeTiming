(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sum=g=>Object.values(g||{}).reduce((a,b)=>a+b,0);
 function progress(p){const c=p.counts.cars,h=p.counts.sessions;return `<h3>${p.state==='blocked'?'Migration needs reconciliation':p.state==='paused'?'Migration paused':p.state==='complete'?'Migration review finished':'Moving your existing collection'}</h3><p><b>1. Cars:</b> ${c.linked||0} of ${sum(c)} linked · ${c.queued||0} awaiting review/delivery.</p><p><b>2. History:</b> ${h.complete||0} of ${sum(h)} sessions approved · ${h.queued||0} awaiting review/delivery.</p><p>In Paddock, open <b>Review → Timing collection</b>. Review the cars first; Timing then sends their older sessions automatically. Approve the history there to make it appear in the normal car history. Received or pending does not mean accepted.</p>${p.error?`<p role="alert">${esc(p.error)}</p>`:''}${p.items.length?`<details open><summary>Kept local or needs attention (${(c.attention||0)+(h.attention||0)+(c.excluded||0)+(h.excluded||0)})</summary>${p.items.map(i=>`<p><b>${esc(i.name)}</b> · ${esc(i.error||i.state)}</p>`).join('')}</details>`:''}<p class="muted">Your original Timing IDs, race history and simulation settings are retained. Missing historical configurations stay unknown. Pausing stops new orchestration; already submitted reviews retain their decisions and delivery/recovery controls.</p><button class="btn" data-collection-action="${p.state==='running'?'pause':'resume'}" ${p.state==='blocked'?'disabled':''}>${p.state==='running'?'Pause migration':'Resume / check resolved items'}</button>`;}
 async function open(api){
  if(document.querySelector('[data-collection-dialog]'))return;
  const d=document.createElement('dialog');d.className='paddock-dialog';d.dataset.collectionDialog='';d.innerHTML='<header><h2>Use existing Timing collection</h2><button class="btn" data-close>Close</button></header><main data-collection-content></main><p role="status" data-collection-message></p>';document.body.append(d);d.showModal();let timer,busy=false,preview;
  const q=s=>d.querySelector(s),request=o=>typeof PaddockHistorical!=='undefined'?PaddockHistorical.requestWhenReady(()=>api.paddockCollectionMigration(o),()=>d.isConnected):api.paddockCollectionMigration(o);
  d.addEventListener('close',()=>{clearTimeout(timer);d.remove();},{once:true});q('[data-close]').onclick=()=>d.close();
  async function refresh(){clearTimeout(timer);if(!d.isConnected||busy)return;
   try{const s=await request({action:'status'});if(!d.isConnected)return;
    if(s.plan){q('[data-collection-content]').innerHTML=progress(s.plan);timer=setTimeout(refresh,4000);}
    else if(!preview){busy=true;preview=await request({action:'preview'});if(!d.isConnected)return;
     const matches=preview.cars.filter(c=>!c.paddock&&c.matches.length);
     q('[data-collection-content]').innerHTML=`<p><b>${preview.cars.length} Timing cars · ${preview.sessions.length} saved sessions · ${preview.laps} saved laps</b></p><p>This guided migration sends your existing cars, main photos and associated older history to Paddock. You review both stages in <b>Paddock → Review → Timing collection</b>. Timing resumes automatically after approvals or a restart; no separate exports for each car or race.</p><p>Originals remain in Timing. Existing result deliveries keep their own identities. Unsupported or oversize evidence stays local and is listed for attention.</p>${matches.length?'<h3>Possible existing cars — confirm physical identity</h3><p>Matching names or models are suggestions only. Two identical models may be different physical cars.</p>':''}${matches.map(c=>`<label>${esc(c.name)}<select data-collection-car="${esc(c.id)}"><option value="">Choose what to do…</option><option value="create">Create a separate car</option><option value="skip">Keep this car local</option>${c.matches.map(m=>`<option value="link:${esc(m.id)}">Same physical car: ${esc(m.name)} (${esc(m.id)})</option>`).join('')}</select></label>`).join('')}<p class="muted">Cars without possible matches are proposed as new cars for owner review. No present-day car configuration or track length is invented for old laps.</p><button class="btn primary" data-collection-start>Start guided migration</button>`;
    }
   }catch(e){if(d.isConnected)q('[data-collection-message]').textContent=e.message;}finally{busy=false;}
  }
  d.onclick=async e=>{const b=e.target.closest('[data-collection-start],[data-collection-action]');if(!b||busy)return;busy=true;b.disabled=true;
   try{let o={action:b.dataset.collectionAction};if(b.hasAttribute('data-collection-start')){const choices={};for(const s of d.querySelectorAll('[data-collection-car]')){if(!s.value)throw Error('Choose what to do with each possible physical-car match.');choices[s.dataset.collectionCar]=s.value.startsWith('link:')?{action:'link',carId:s.value.slice(5)}:{action:s.value};}o={action:'start',revision:preview.revision,choices};}await request(o);q('[data-collection-message]').textContent='Progress is saved. You may close this window; keep both apps running for delivery.';}
   catch(error){q('[data-collection-message]').textContent=error.message;}finally{busy=false;b.disabled=false;await refresh();}
  };
  await refresh();
 }
 function init(api){
  if(!api.paddockCollectionMigration)return;
  let banner;async function check(){try{if(document.hidden)return;const s=await api.paddockCollectionMigration({action:'status'});const show=s.available&&(s.plan?s.plan.state!=='complete'||s.plan.items.some(i=>i.state==='attention'):s.counts?.cars>0||s.counts?.sessions>0);
   if(!show){banner?.remove();banner=null;return;}if(!banner){banner=document.createElement('aside');banner.className='card collection-onboarding';banner.innerHTML='<span data-collection-notice></span> <button class="btn primary">Use existing Timing collection</button>';banner.querySelector('button').onclick=()=>open(api);document.querySelector('header')?.after(banner);}
   banner.querySelector('[data-collection-notice]').textContent=s.plan?'Your Timing collection migration has saved progress.':'Paddock is connected. Bring your existing Timing cars and older races into the same collection.';
   banner.querySelector('button').textContent=s.plan?'View migration progress':'Use existing Timing collection';
  }catch{}finally{setTimeout(check,15000);}}setTimeout(check,2000);
 }
 root.PaddockCollection={open,init,progress};if(typeof module!=='undefined')module.exports=root.PaddockCollection;
})(globalThis);
