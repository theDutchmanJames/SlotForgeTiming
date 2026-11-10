(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function lapsHtml(rows){return `<div class="wrap"><table class="fields"><thead><tr><th>Lap</th><th>Lane</th><th>Saved time (s)</th><th>Saved flags</th></tr></thead><tbody>${rows.map(l=>`<tr><td>${esc(l.lapNumber??'Unknown')}</td><td>${esc(l.lane??'Unknown')}</td><td>${Number.isFinite(l.time)?(l.time/1000).toFixed(3):'Unknown'}</td><td>${['invalid','late','pit','noPersonalBest','noTrackRecord'].filter(k=>l[k]).map(esc).join(', ')||'None recorded'}</td></tr>`).join('')}</tbody></table></div>`;}
 async function mount(box,api){
  let offset=0,token,serial=0,state='active';
  async function load(reset=false){if(reset){offset=0;token=undefined;}const generation=++serial;box.innerHTML='<p>Loading original session evidence…</p>';
   try{const page=await api.libraryOriginalHistory({kind:'sessions',offset,limit:50,state,...(token?{token}:{})});if(generation!==serial||!box.isConnected)return;token=page.token;
    box.innerHTML=`<h3>Original session evidence</h3><p class="muted">Time Token sessions and older history preserved in the same car library. These exact originals do not contribute to verified measured records or mileage.</p><div class="row"><button class="btn" data-refresh>Refresh originals</button><label>Show <select data-state><option value="active">Active</option><option value="withdrawn">Withdrawn</option><option value="all">All originals</option></select></label><button class="btn" data-prev ${offset?'':'disabled'}>Previous</button><span>${page.total} sessions</span><button class="btn" data-next ${page.nextOffset===null?'disabled':''}>Next</button></div><div data-entries></div>`;
    const select=box.querySelector('[data-state]');select.value=state;select.onchange=()=>{state=select.value;void load(true);};box.querySelector('[data-refresh]').onclick=()=>load(true);box.querySelector('[data-prev]').onclick=()=>{offset=Math.max(0,offset-50);void load();};box.querySelector('[data-next]').onclick=()=>{offset=page.nextOffset;void load();};
    for(const row of page.rows){const card=document.createElement('details');card.className='card central-session original-session';card.innerHTML=`<summary>${esc(row.name)} · ${row.lapCount} laps · revision ${row.revision}${row.state==='withdrawn'?' · Withdrawn':''}</summary><div class="sessbody"></div>`;box.querySelector('[data-entries]').append(card);let opened=false;
     card.ontoggle=async()=>{if(!card.open||opened)return;opened=true;const content=card.querySelector('.sessbody');content.textContent='Loading original…';const identity={sourceId:row.sourceId,originalId:row.originalId,token:page.token};
      try{const d=await api.libraryOriginalHistory({kind:'detail',...identity});if(!card.isConnected||generation!==serial)return;content.innerHTML=`<p>${esc(d.session?.sessionType||'Unknown type')} · ${esc(d.session?.trackName||'Unknown track')} · ${esc(d.session?.date||'Date unknown')}</p><p>${esc(d.projectionReason)}</p><div data-laps></div>`;
       let lapRequest=0;async function laps(at=0){const request=++lapRequest,target=content.querySelector('[data-laps]');target.textContent='Loading original laps…';try{const p=await api.libraryOriginalHistory({kind:'laps',...identity,offset:at,limit:100});if(request!==lapRequest||!card.isConnected||generation!==serial)return;target.innerHTML=`<div class="row"><button class="btn" data-before ${at?'':'disabled'}>Previous laps</button><span>${p.total?at+1:0}–${at+p.rows.length} of ${p.total}</span><button class="btn" data-after ${p.nextOffset===null?'disabled':''}>Next laps</button></div>`+lapsHtml(p.rows);target.querySelector('[data-before]').onclick=()=>laps(Math.max(0,at-100));target.querySelector('[data-after]').onclick=()=>laps(p.nextOffset);}catch(e){if(request===lapRequest&&target.isConnected)target.textContent=e.message+' Refresh originals to reload.';}}
       await laps();
      }catch(e){if(content.isConnected){opened=false;content.textContent=e.message+' Refresh originals to reload.';}}
     };
    }
   }catch(e){if(generation===serial&&box.isConnected){box.innerHTML=`<p role="alert">${esc(e.message)}</p><button class="btn">Refresh originals</button>`;box.querySelector('button').onclick=()=>load(true);}}
  }
  await load();
 }
 root.OriginalHistory={mount,lapsHtml};if(typeof module!=='undefined')module.exports={lapsHtml};
})(globalThis);
