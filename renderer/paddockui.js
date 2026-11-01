(function(root){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function open(api,onSaved){
    let status,locals,catalog=[],busy=false,cooldownTimer;
    try{[status,locals]=await Promise.all([api.paddockStatus(),api.list('slotcars')]);}catch(e){alert('Could not open Paddock: '+e.message);return;}
    const dialog=document.createElement('dialog');dialog.className='paddock-dialog';document.body.append(dialog);
    dialog.innerHTML=`<header><div><p class="muted">DATABASE CONNECTION</p><h2>SlotForge Paddock</h2><p>Choose your cars here. Keep their technical history in Paddock.</p></div><button class="btn" data-close>Close</button></header>
      <div class="paddock-shell"><nav aria-label="Paddock sections"><button class="btn" data-jump="connection">Connection</button><button class="btn" data-jump="cars">Available cars</button><button class="btn" data-jump="results">Result delivery</button><p class="muted">Cars stay available offline. Racing never waits for a results upload.</p></nav><main>
      <p role="status" data-status></p><p role="alert" data-error></p>
      <section id="paddock-connection"><h3>Connection</h3><p>Start sharing in Paddock, enable <b>Allow Timing results</b>, then use its separate <b>Timing connection code or password</b>. Browse-only and car-submission passwords do not allow result delivery.</p>
      <div class="row"><button class="btn" data-find>Find Paddock on network</button><select aria-label="Nearby Paddock hosts" data-hosts><option value="">Or enter an address below</option></select></div>
      <label>Host address and port<input data-address placeholder="192.168.1.20:51234" value="${esc(status.connection?.address||'')}" autocomplete="off"></label>
      <label>Timing connection code or password<input data-code type="password" autocomplete="off" spellcheck="false" placeholder="Generated code or custom Timing password"></label>
      <p class="muted">Passwords are case-sensitive: 8–128 English letters, numbers, spaces or symbols. Internal spaces are kept exactly; leave no spaces at either end. Custom passwords are available in Paddock 0.18.0 and later; older builds use generated codes.</p>
      <p class="muted">Your code or password stays in memory only. Restarting Paddock sharing resets custom passwords and generates new codes; the port can also change. Reconnect using its current Timing credential and address.</p>
      <p data-cooldown role="status" hidden></p>
      <div class="row"><button class="btn primary" data-connect>Connect</button><button class="btn" data-disconnect>Disconnect</button><button class="btn" data-forget>Forget host</button></div></section>
      <section id="paddock-cars"><h3>Available cars</h3><p>For normal racing, use the Paddock Database view or Browse Local / Paddock cars on Home. Selection caches the car automatically. The tools below can also link an existing Timing car to preserve its previous race history. Specifications come from Paddock; simulation and service settings stay local.</p>
      <details><summary>Link live or import a file?</summary><p><b>Link live here</b> to refresh car details and return finalized race results to Paddock.</p><p><b>Import independent copies</b> without a network connection: export cars from Paddock using its <b>SlotForge Timing</b> format, then open <b>App Settings → Import and Export → Import</b> in Timing. Supported specifications, race classes and pictures come across. File imports do not link cars or send results back; importing the same file again creates more copies. Saved Paddock setups and performance history are not included.</p></details>
      <div class="row"><button class="btn" data-browse>Load catalogue</button><button class="btn" data-refresh>Refresh linked cars</button><input data-search placeholder="Find a car…" aria-label="Find a Paddock car"></div><div data-catalog></div><details><summary>Linked cars and offline configurations</summary><div data-linked></div></details></section>
      <section id="paddock-results"><h3>Result delivery</h3><p>Finalized results are saved locally, then sent automatically. Corrections replace earlier results; deleting a session queues a withdrawal. Connection failures keep results waiting. Use <b>Check Paddock result</b> beside a delivered session to fetch its latest receipt and warnings without uploading it again. Historical sessions are checked on demand, not while racing.</p><p class="muted">Current configurations only. Separate class standings stay in Timing. Time Token Sessions and older races without captured configurations are not uploaded.</p><div class="row"><button class="btn" data-retry>Retry pending results</button><button class="btn" data-status-refresh>Refresh local status</button></div><div data-deliveries></div></section>
      </main></div>`;
    const q=s=>dialog.querySelector(s),error=text=>q('[data-error]').textContent=String(text||'').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
    const remaining=value=>{try{const host=new URL(value.includes('://')?value:'http://'+value).hostname;return Math.max(0,...(status.cooldowns||[]).filter(x=>x.host===(host==='localhost'?'127.0.0.1':host)).map(x=>Math.ceil((x.until-Date.now())/1000)));}catch{return 0;}};
    function cooldown(){
      clearTimeout(cooldownTimer);const entered=remaining(q('[data-address]').value),saved=remaining(status.connection?.address||''),seconds=Math.max(entered,saved);
      q('[data-cooldown]').hidden=!seconds;q('[data-cooldown]').textContent=seconds?'Paddock is limiting connection attempts. Try again in '+seconds+' seconds. Saved results remain queued.':'';
      q('[data-connect]').disabled=busy||entered>0;
      dialog.querySelectorAll('[data-browse],[data-refresh],[data-retry],[data-link],[data-receipt]').forEach(x=>x.disabled=busy||saved>0);
      if(seconds)cooldownTimer=setTimeout(cooldown,1000);
    }
    function paint(){q('[data-status]').textContent=status.connected?'Connected to '+status.connection.name:status.connection?'Saved host: '+status.connection.name+' · '+(status.hasCode?'Offline':'Enter the current code or password to reconnect'):'No Paddock host connected';
      if(status.error)error(status.error);
      q('[data-linked]').innerHTML=status.linked.length?status.linked.map(c=>`<p><b>${esc(c.name)}</b> · ${c.archived?'Unavailable in Paddock':'Available'}<br><small>Configuration captured ${esc(c.capturedAt?new Date(c.capturedAt).toLocaleString():'not yet')}</small></p>`).join(''):'<p class="muted">No linked cars yet.</p>';
      q('[data-deliveries]').innerHTML=status.deliveries.length?status.deliveries.map(d=>{
        const warnings=d.warnings||[],needsCorrection=warnings.some(w=>w.code==='SESSION_REQUIRES_CORRECTION');
        const label=d.status==='sent'?(needsCorrection?'Delivered · correction needed':d.receiptCheckError?'Delivered · check needed':warnings.length?'Delivered · warning':'Delivered'):d.status==='pending'?'Waiting to send':d.status==='withdrawn'?'Withdrawal queued':'Needs attention';
        const warningText=w=>w.code==='SESSION_REQUIRES_CORRECTION'?'Paddock excludes this session from statistics because its measured lap intervals overlap. Review and correct the saved laps, or deliberately delete the session to send a withdrawal. Retrying unchanged results will not fix it.':w.code==='CAR_ARCHIVED'?'This car is archived in Paddock. Its historical result was accepted.':'Paddock reported '+w.code+'. Inspect this result in Paddock.';
        return `<div class="paddock-delivery"><b>${esc(d.name)}</b><span>${esc(label)}</span>${d.error?`<p>${esc(d.error)}</p>`:''}${warnings.map(w=>`<p class="paddock-warning"><b>${esc(w.carName||w.carId)}</b>: ${esc(warningText(w))}</p>`).join('')}${d.receiptCheckError?`<p class="paddock-warning">Latest check failed: ${esc(d.receiptCheckError)} Last saved receipt retained.</p>`:''}${d.receiptCheckedAt?`<p class="muted">Receipt checked ${esc(new Date(d.receiptCheckedAt).toLocaleString())}</p>`:''}${d.status==='sent'&&d.databaseId===status.connection?.databaseId?`<button class="btn" data-receipt="${esc(d.sessionId)}">Check Paddock result</button>`:''}</div>`;
      }).join(''):'<p class="muted">No Paddock results yet. Race with a linked car to create one.</p>';
    }
    function cars(){const search=q('[data-search]').value.toLowerCase(),shown=catalog.filter(c=>[c.name,c.maker,c.model,c.raceClass].join(' ').toLowerCase().includes(search));q('[data-catalog]').innerHTML=shown.map(c=>`<div class="paddock-car"><div><b>${esc(c.name)}</b><p class="muted">${esc(c.maker)} · ${esc(c.raceClass||'No race class')}</p></div>${locals.some(l=>l.paddock?.databaseId===status.connection?.databaseId&&l.paddock.carId===c.id)?'<span>Linked</span>':`<select data-local="${esc(c.id)}" aria-label="Timing car for ${esc(c.name)}"><option value="">Create new Timing car</option>${locals.filter(l=>!l.paddock).map(l=>`<option value="${esc(l.id)}">${esc([l.brand,l.manufacturer,l.model].filter(Boolean).join(' '))}</option>`).join('')}</select><button class="btn" data-link="${esc(c.id)}">Use this car</button>`}</div>`).join('')||'<p class="muted">'+(catalog.length?'No matching cars.':'Connect and load the catalogue to choose cars.')+'</p>';}
    async function run(fn){
      if(busy)return;busy=true;error('');let failure=null;
      dialog.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);
      try{await fn();}catch(e){failure=e;}
      // A connection or car link may have succeeded before a later catalogue fetch failed.
      try{[status,locals]=await Promise.all([api.paddockStatus(),api.list('slotcars')]);paint();cars();}catch(e){failure=failure||e;}
      finally{busy=false;dialog.querySelectorAll('button,input,select').forEach(x=>x.disabled=false);cooldown();}
      if(failure)error(failure.message);
    }
    q('[data-find]').onclick=()=>run(async()=>{q('[data-find]').textContent='Searching… (about 4 seconds)';try{const hosts=await api.paddockDiscover();q('[data-hosts]').innerHTML='<option value="">'+(hosts.length?'Choose a host':'No host found — enter address manually')+'</option>'+hosts.map(h=>`<option value="${esc(h.address)}">${esc(h.name)} · ${esc(h.address)}</option>`).join('');if(!hosts.length)throw Error('No Paddock host replied after several attempts. Make sure sharing is active on the same local network. Discovery uses UDP port 47778 and may be blocked even when connecting by address works; you can enter the host address below.');}finally{q('[data-find]').textContent='Find Paddock on network';}});
    q('[data-hosts]').onchange=e=>{if(e.target.value)q('[data-address]').value=e.target.value;cooldown();};q('[data-address]').oninput=cooldown;
    q('[data-connect]').onclick=()=>run(async()=>{status=await api.paddockConnect({address:q('[data-address]').value,code:q('[data-code]').value});q('[data-code]').value='';catalog=await api.paddockBrowse();});
    q('[data-disconnect]').onclick=()=>run(()=>api.paddockDisconnect(false));
    q('[data-forget]').onclick=()=>{if(confirm('Forget this host? Linked cars and saved results stay local. Pending results can only be delivered to their original Paddock database.'))run(async()=>{await api.paddockDisconnect(true);catalog=[];q('[data-address]').value='';});};
    q('[data-browse]').onclick=()=>run(async()=>{catalog=await api.paddockBrowse();});
    q('[data-refresh]').onclick=()=>run(()=>api.paddockRefresh());
    q('[data-retry]').onclick=()=>run(()=>api.paddockRetry());q('[data-status-refresh]').onclick=()=>run(async()=>{});
    q('[data-deliveries]').onclick=e=>{const b=e.target.closest('[data-receipt]');if(b)run(()=>api.paddockCheckReceipt(b.dataset.receipt));};
    q('[data-search]').oninput=()=>{cars();cooldown();};
    q('[data-catalog]').onclick=e=>{const b=e.target.closest('[data-link]');if(b)run(async()=>{const local=[...dialog.querySelectorAll('[data-local]')].find(x=>x.dataset.local===b.dataset.link).value;await api.paddockLink(b.dataset.link,local);catalog=await api.paddockBrowse();});};
    dialog.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>q('#paddock-'+b.dataset.jump).scrollIntoView({behavior:'smooth',block:'start'}));
    q('[data-close]').onclick=()=>dialog.close();dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>{clearTimeout(cooldownTimer);dialog.remove();onSaved?.();};paint();cars();cooldown();dialog.showModal();return {dialog};
  }
  root.PaddockUI={open};
})(globalThis);
