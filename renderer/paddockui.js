(function(root){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function open(api,onSaved){
    let status,locals,catalog=[],busy=false;
    try{[status,locals]=await Promise.all([api.paddockStatus(),api.list('slotcars')]);}catch(e){alert('Could not open Paddock: '+e.message);return;}
    const dialog=document.createElement('dialog');dialog.className='paddock-dialog';document.body.append(dialog);
    dialog.innerHTML=`<header><div><p class="muted">DATABASE CONNECTION</p><h2>SlotForge Paddock</h2><p>Choose your cars here. Keep their technical history in Paddock.</p></div><button class="btn" data-close>Close</button></header>
      <div class="paddock-shell"><nav aria-label="Paddock sections"><button class="btn" data-jump="connection">Connection</button><button class="btn" data-jump="cars">Available cars</button><button class="btn" data-jump="results">Result delivery</button><p class="muted">Cars stay available offline. Racing never waits for a results upload.</p></nav><main>
      <p role="status" data-status></p><p role="alert" data-error></p>
      <section id="paddock-connection"><h3>Connection</h3><p>Start sharing in Paddock, enable <b>Allow Timing results</b>, then use its separate <b>Timing connection code</b>.</p>
      <div class="row"><button class="btn" data-find>Find Paddock on network</button><select aria-label="Nearby Paddock hosts" data-hosts><option value="">Or enter an address below</option></select></div>
      <label>Host address and port<input data-address placeholder="192.168.1.20:51234" value="${esc(status.connection?.address||'')}" autocomplete="off"></label>
      <label>Timing connection code<input data-code type="password" autocomplete="off" spellcheck="false" placeholder="24-character code from Paddock"></label>
      <p class="muted">The code is kept only while Timing is open. Paddock changes its code and port when sharing restarts. Reconnect to the same database with its new address.</p>
      <div class="row"><button class="btn primary" data-connect>Connect</button><button class="btn" data-disconnect>Disconnect</button><button class="btn" data-forget>Forget host</button></div></section>
      <section id="paddock-cars"><h3>Available cars</h3><p>Link a Paddock car to a new Timing car, or choose an existing car to preserve its race history. Imported details refresh from Paddock; Timing’s simulation and service settings stay local.</p>
      <div class="row"><button class="btn" data-browse>Load catalogue</button><button class="btn" data-refresh>Refresh linked cars</button><input data-search placeholder="Find a car…" aria-label="Find a Paddock car"></div><div data-catalog></div><details><summary>Linked cars and offline configurations</summary><div data-linked></div></details></section>
      <section id="paddock-results"><h3>Result delivery</h3><p>Finalized results are saved locally, then sent automatically. Corrections replace earlier results; deleting a session queues a withdrawal. Connection failures keep results waiting.</p><p class="muted">Current configurations only. Separate class standings stay in Timing. Time Token Sessions and older races without captured configurations are not uploaded.</p><div class="row"><button class="btn" data-retry>Retry pending results</button><button class="btn" data-status-refresh>Refresh status</button></div><div data-deliveries></div></section>
      </main></div>`;
    const q=s=>dialog.querySelector(s),error=text=>q('[data-error]').textContent=text;
    function paint(){q('[data-status]').textContent=status.connected?'Connected to '+status.connection.name:status.connection?'Saved host: '+status.connection.name+' · '+(status.hasCode?'Offline':'Enter the current code to reconnect'):'No Paddock host connected';
      if(status.error)error(status.error);
      q('[data-linked]').innerHTML=status.linked.length?status.linked.map(c=>`<p><b>${esc(c.name)}</b> · ${c.archived?'Unavailable in Paddock':'Available'}<br><small>Configuration captured ${esc(c.capturedAt?new Date(c.capturedAt).toLocaleString():'not yet')}</small></p>`).join(''):'<p class="muted">No linked cars yet.</p>';
      q('[data-deliveries]').innerHTML=status.deliveries.length?status.deliveries.map(d=>`<div class="paddock-delivery"><b>${esc(d.name)}</b><span>${esc(d.status==='sent'?'Delivered':d.status==='pending'?'Waiting to send':d.status==='withdrawn'?'Withdrawal queued': 'Needs attention')}</span>${d.error?`<p>${esc(d.error)}</p>`:''}</div>`).join(''):'<p class="muted">No Paddock results yet. Race with a linked car to create one.</p>';
    }
    function cars(){const search=q('[data-search]').value.toLowerCase(),shown=catalog.filter(c=>[c.name,c.maker,c.model,c.raceClass].join(' ').toLowerCase().includes(search));q('[data-catalog]').innerHTML=shown.map(c=>`<div class="paddock-car"><div><b>${esc(c.name)}</b><p class="muted">${esc(c.maker)} · ${esc(c.raceClass||'No race class')}</p></div>${locals.some(l=>l.paddock?.databaseId===status.connection?.databaseId&&l.paddock.carId===c.id)?'<span>Linked</span>':`<select data-local="${esc(c.id)}" aria-label="Timing car for ${esc(c.name)}"><option value="">Create new Timing car</option>${locals.filter(l=>!l.paddock).map(l=>`<option value="${esc(l.id)}">${esc([l.brand,l.manufacturer,l.model].filter(Boolean).join(' '))}</option>`).join('')}</select><button class="btn" data-link="${esc(c.id)}">Use this car</button>`}</div>`).join('')||'<p class="muted">'+(catalog.length?'No matching cars.':'Connect and load the catalogue to choose cars.')+'</p>';}
    async function run(fn){
      if(busy)return;busy=true;error('');let failure=null;
      dialog.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);
      try{await fn();}catch(e){failure=e;}
      // A connection or car link may have succeeded before a later catalogue fetch failed.
      try{[status,locals]=await Promise.all([api.paddockStatus(),api.list('slotcars')]);paint();cars();}catch(e){failure=failure||e;}
      finally{busy=false;dialog.querySelectorAll('button,input,select').forEach(x=>x.disabled=false);}
      if(failure)error(failure.message);
    }
    q('[data-find]').onclick=()=>run(async()=>{const hosts=await api.paddockDiscover();q('[data-hosts]').innerHTML='<option value="">'+(hosts.length?'Choose a host':'No host found — enter address manually')+'</option>'+hosts.map(h=>`<option value="${esc(h.address)}">${esc(h.name)} · ${esc(h.address)}</option>`).join('');});
    q('[data-hosts]').onchange=e=>{if(e.target.value)q('[data-address]').value=e.target.value;};
    q('[data-connect]').onclick=()=>run(async()=>{status=await api.paddockConnect({address:q('[data-address]').value,code:q('[data-code]').value});q('[data-code]').value='';catalog=await api.paddockBrowse();});
    q('[data-disconnect]').onclick=()=>run(()=>api.paddockDisconnect(false));
    q('[data-forget]').onclick=()=>{if(confirm('Forget this host? Linked cars and saved results stay local. Pending results can only be delivered to their original Paddock database.'))run(async()=>{await api.paddockDisconnect(true);catalog=[];q('[data-address]').value='';});};
    q('[data-browse]').onclick=()=>run(async()=>{catalog=await api.paddockBrowse();});
    q('[data-refresh]').onclick=()=>run(()=>api.paddockRefresh());
    q('[data-retry]').onclick=()=>run(()=>api.paddockRetry());q('[data-status-refresh]').onclick=()=>run(async()=>{});
    q('[data-search]').oninput=cars;
    q('[data-catalog]').onclick=e=>{const b=e.target.closest('[data-link]');if(b)run(async()=>{const local=[...dialog.querySelectorAll('[data-local]')].find(x=>x.dataset.local===b.dataset.link).value;await api.paddockLink(b.dataset.link,local);catalog=await api.paddockBrowse();});};
    dialog.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>q('#paddock-'+b.dataset.jump).scrollIntoView({behavior:'smooth',block:'start'}));
    q('[data-close]').onclick=()=>dialog.close();dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>{dialog.remove();onSaved?.();};paint();cars();dialog.showModal();return {dialog};
  }
  root.PaddockUI={open};
})(globalThis);
