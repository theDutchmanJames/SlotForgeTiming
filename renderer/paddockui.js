(function(root){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function mount(api,dialog,options={}){
    let status,locals,catalog=[],catalogDatabaseId,busy=false,cooldownTimer,carPage=0,carCount=0,closed=false;
    dialog.classList.add("dealership-settings");dialog.innerHTML='<p role="status">Loading connection settings…</p>';
    const active=()=>!closed&&dialog.isConnected;
    function stop(){closed=true;clearTimeout(cooldownTimer);observer.disconnect();}
    const observer=new MutationObserver(()=>{if(!dialog.isConnected)stop();});observer.observe(document.body,{childList:true,subtree:true});
    try{[status,locals]=await Promise.all([api.paddockStatus(),api.paddockLocalCars()]);}catch(e){if(active())dialog.textContent='Could not load connection settings: '+e.message;stop();return;}
    if(!active()){stop();return;}
    dialog.innerHTML=`<header><div><p class="muted">DATABASE CONNECTION</p><h2>Connect to Dealership</h2><p>Browse a network collection and return finalised race results.</p></div>${options.modal?'<button class="btn" data-close>Close</button>':''}</header>
      <div class="paddock-shell"><nav aria-label="Paddock sections"><button class="btn" data-jump="connection">Dealership</button><button class="btn" data-jump="cars">Available cars</button><button class="btn" data-jump="results">Result delivery</button><p class="muted">Cars with captured configurations stay available offline. Racing never waits for a results upload.</p></nav><main>
      <p role="status" data-status></p><p role="alert" data-error></p>
      <section id="paddock-connection"><h3>Paddock Dealership</h3><p class="muted">Your same-computer shared database already appears in Slotcars. It needs no password, hosting switch or running Paddock app.</p><p>Start Dealership hosting in Paddock, then enter its <b>Dealership password</b> here to browse cars and send finalized results.</p>
      <div class="row"><button class="btn" data-find>Find Dealership on network</button><select aria-label="Nearby Paddock hosts" data-hosts><option value="">Or enter an address below</option></select></div>
      <label>Host address and port<input data-address placeholder="192.168.1.20:51234" value="${esc(status.connection?.mode==='local'?'':status.connection?.address||'')}" autocomplete="off"></label>
      <label>Dealership password<input data-code type="password" minlength="4" maxlength="128" autocomplete="off" spellcheck="false" placeholder="Password set on the Paddock dealership"></label>
      <p class="muted">Passwords are case-sensitive: 4–128 English letters, numbers, spaces or symbols. Internal spaces are kept exactly; leave no spaces at either end.</p>
      <p class="muted">Timing keeps the password in memory only; reconnect after restarting Timing. Paddock remembers its Dealership password, but its host port can change after a restart.</p>
      <p class="muted">Moving from an older restricted connection? A Dealership password grants broader collection access. Enter the new password yourself and use the current address. Timing verifies the saved database identity and keeps pending results.</p>
      <div class="row"><button class="btn primary" data-connect>Connect</button><button class="btn" data-disconnect>Disconnect</button><button class="btn" data-forget>Forget host</button></div></section>
      <p data-cooldown role="status" hidden></p><section id="paddock-cars"><h3>Available cars</h3><p>Network cars appear in the Dealership Cars view and Home car browser. Selecting a car captures its configuration for offline racing. Link to an existing Timing car below to preserve its history. The same-computer shared database remains separate from this network connection.</p>
      <details><summary>Link live or import a file?</summary><p><b>Link live here</b> to refresh car details and return finalized race results to Paddock.</p><p><b>Import independent copies</b> without a network connection: export cars from Paddock using its <b>SlotForge Timing</b> format, then open <b>App Settings → Import and Export → Import</b> in Timing. Supported specifications, race classes and pictures come across. File imports do not link cars or send results back; importing the same file again creates more copies. Saved Paddock setups and performance history are not included.</p></details>
      <div class="row"><button class="btn" data-browse>Load catalogue</button><button class="btn" data-refresh>Refresh linked cars</button><input data-search placeholder="Find a car…" aria-label="Find a Paddock car"></div><div data-catalog></div><div class="pb-pages"><button class="btn" data-car-prev>Previous</button><span data-car-count></span><button class="btn" data-car-next>Next</button></div><details><summary>Linked cars and offline configurations</summary><div data-linked></div></details></section>
      <section id="paddock-results"><h3>Result delivery</h3><p>Finalized results are saved locally, then sent automatically. Corrections replace earlier results; deleting a session queues a withdrawal. Connection failures keep results waiting. Use <b>Check Paddock result</b> beside a delivered session to fetch its latest receipt and warnings without uploading it again. Historical sessions are checked on demand, not while racing. With an updated same-computer library, pending results carry a saved operation ID and restore generation. Lost replies recover that exact operation. Larger results use resumable chunks; receiving chunks alone does not mark a result delivered. The current 8 MiB and 50,000-lap limits still apply. A restored library or conflicting revision needs comparison with Race history; retry never overwrites the newer result or changes the saved recovery identity.</p><p class="muted">Original captured car configurations are preserved. Separate class standings stay in Timing. Time Token Sessions and older races without captured configurations are not uploaded.</p><div class="row"><button class="btn" data-retry>Retry pending results</button><button class="btn" data-status-refresh>Refresh local status</button></div><div data-deliveries></div></section>
      </main></div>`;
    const q=s=>dialog.querySelector(s),error=text=>q('[data-error]').textContent=String(text||'').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');
    const remaining=(value,code)=>{try{const url=new URL(value.includes('://')?value:'http://'+value),host=url.hostname;return Math.max(0,...(status.cooldowns||[]).filter(x=>(!code||x.code===code)&&x.host===(host==='localhost'?'127.0.0.1':host)&&(!x.address||new URL(x.address).port===url.port)).map(x=>Math.ceil((x.until-Date.now())/1000)));}catch{return 0;}};
    function cooldown(){
      if(!active())return;
      clearTimeout(cooldownTimer);const entered=remaining(q('[data-address]').value),saved=remaining(status.connection?.address||''),seconds=Math.max(entered,saved);
      q('[data-cooldown]').hidden=!seconds;q('[data-cooldown]').textContent=seconds?(Math.max(remaining(q('[data-address]').value,'HOST_MIGRATING'),remaining(status.connection?.address||'','HOST_MIGRATING'))>0?'Paddock is changing sharing mode. Try again in ':'Paddock is limiting connection attempts. Try again in ')+seconds+' seconds. Saved results remain queued.':'';
      q('[data-connect]').disabled=busy||entered>0||status.connection?.mode==='local';
      q('[data-disconnect]').disabled=q('[data-forget]').disabled=busy||!status.connection||status.connection.mode==='local';
      dialog.querySelectorAll('[data-browse],[data-refresh],[data-retry],[data-link],[data-receipt]').forEach(x=>x.disabled=busy||saved>0);
      q('[data-car-prev]').disabled=busy||carPage===0;q('[data-car-next]').disabled=busy||(carPage+1)*40>=carCount;
      if(seconds)cooldownTimer=setTimeout(cooldown,1000);
    }
    function paint(){if(!active())return;localUI?.paint();q('[data-status]').textContent=status.connected?'Connected to '+status.connection.name:status.connection?'Saved host: '+status.connection.name+' · '+(status.connection.mode==='local'?(status.connection.automatic===false?'Disconnected · reconnect to use the collection':'Collection unavailable · automatic reconnection enabled'):status.hasCode?'Offline':'Enter the Dealership password to reconnect'):'No Paddock host connected';
      if(status.error)error(status.error);
      q('[data-linked]').innerHTML=status.linked.length?status.linked.map(c=>`<p><b>${esc(c.name)}</b> · ${c.archived?'Unavailable in Paddock':'Available'}<br><small>Configuration captured ${esc(c.capturedAt?new Date(c.capturedAt).toLocaleString():'not yet')}</small></p>`).join(''):'<p class="muted">No linked cars yet.</p>';
      q('[data-deliveries]').innerHTML=status.deliveries.length?status.deliveries.map(d=>{
        const warnings=d.warnings||[],needsCorrection=warnings.some(w=>w.code==='SESSION_REQUIRES_CORRECTION');
        const label=d.status==='sent'?(needsCorrection?'Delivered · correction needed':d.receiptCheckError?'Delivered · check needed':warnings.length?'Delivered · warning':'Delivered'):d.status==='pending'?'Waiting to send':d.status==='withdrawn'?'Withdrawal queued':'Needs attention';
        const warningText=w=>w.code==='SESSION_REQUIRES_CORRECTION'?'Paddock excludes this session from statistics because its measured lap intervals overlap. Review and correct the saved laps, or deliberately delete the session to send a withdrawal. Retrying unchanged results will not fix it.':w.code==='CAR_ARCHIVED'?'This car is archived in Paddock. Its historical result was accepted.':'Paddock reported '+w.code+'. Inspect this result in Paddock.';
        return `<div class="paddock-delivery"><b>${esc(d.name)}</b><span>${esc(label)}</span>${d.error?`<p>${esc(d.error)}</p>`:''}${warnings.map(w=>`<p class="paddock-warning"><b>${esc(w.carName||w.carId)}</b>: ${esc(warningText(w))}</p>`).join('')}${d.receiptCheckError?`<p class="paddock-warning">Latest check failed: ${esc(d.receiptCheckError)} Last saved receipt retained.</p>`:''}${d.receiptCheckedAt?`<p class="muted">Receipt checked ${esc(new Date(d.receiptCheckedAt).toLocaleString())}</p>`:''}${d.status==='sent'&&d.databaseId===status.connection?.databaseId?`<button class="btn" data-receipt="${esc(d.sessionId)}">Check Paddock result</button>`:''}</div>`;
      }).join(''):'<p class="muted">No Paddock results yet. Race with a linked car to create one.</p>';
    }
    function cars(){if(!active())return;const search=q('[data-search]').value.toLowerCase(),shown=catalog.filter(c=>[c.name,c.maker,c.model,c.raceClass].join(' ').toLowerCase().includes(search));carCount=shown.length;carPage=Math.min(carPage,Math.max(0,Math.ceil(carCount/40)-1));q('[data-car-count]').textContent=carCount+' cars · Page '+(carPage+1)+' of '+Math.max(1,Math.ceil(carCount/40));q('[data-catalog]').innerHTML=shown.slice(carPage*40,carPage*40+40).map(c=>`<div class="paddock-car"><div><b>${esc(c.name)}</b><p class="muted">${esc(c.maker)} · ${esc(c.raceClass||'No race class')}</p></div>${locals.some(l=>l.paddock?.databaseId===status.connection?.databaseId&&l.paddock.carId===c.id)?'<span>Linked</span>':`<select data-local="${esc(c.id)}" aria-label="Timing car for ${esc(c.name)}"><option value="">Create new Timing car</option>${locals.filter(l=>!l.paddock&&status.connection?.mode!=='local').map(l=>`<option value="${esc(l.id)}">${esc([l.brand,l.manufacturer,l.model].filter(Boolean).join(' '))}</option>`).join('')}</select><button class="btn" data-link="${esc(c.id)}">Use this car</button>`}</div>`).join('')||'<p class="muted">'+(catalog.length?'No matching cars.':'Connect and load the catalogue to choose cars.')+'</p>';}
    async function loadCatalogue(force=false){const view=await api.paddockCatalogue(force);catalog=view.cars;catalogDatabaseId=view.connection?.databaseId;if(view.error)throw Error(view.error);}
    async function run(fn){
      if(busy||!active())return;busy=true;error('');let failure=null;
      dialog.querySelectorAll('button,input,select').forEach(x=>x.disabled=true);
      try{await fn();}catch(e){failure=e;}
      // A connection or car link may have succeeded before a later catalogue fetch failed.
      try{[status,locals]=await Promise.all([api.paddockStatus(),api.paddockLocalCars()]);if(catalogDatabaseId!==status.connection?.databaseId){catalog=[];catalogDatabaseId=undefined;carPage=0;}await localUI?.refresh();paint();cars();}catch(e){failure=failure||e;}
      finally{busy=false;dialog.querySelectorAll('button,input,select').forEach(x=>x.disabled=false);localUI?.paint();cooldown();}
      if(active()){if(failure)error(failure.message);await options.onChanged?.(status); }
    }
    const localUI=root.PaddockLocalUI?.mount(api,dialog,run,()=>({status,locals,catalog}),loadCatalogue);try{await localUI?.refresh();}catch(e){error('Could not load transfer history: '+e.message);}
    q('[data-find]').onclick=()=>run(async()=>{q('[data-find]').textContent='Searching… (about 4 seconds)';try{const hosts=await api.paddockDiscover();q('[data-hosts]').innerHTML='<option value="">'+(hosts.length?'Choose a host':'No host found — enter address manually')+'</option>'+hosts.map(h=>`<option value="${esc(h.address)}">${esc(h.name)} · ${esc(h.address)}</option>`).join('');if(!hosts.length)throw Error('No Paddock host replied after several attempts. Make sure Paddock hosting is active on the same local network. Discovery uses UDP port 47778 and may be blocked even when connecting by address works; you can enter the host address below.');}finally{q('[data-find]').textContent='Find Dealership on network';}});
    q('[data-hosts]').onchange=e=>{if(e.target.value)q('[data-address]').value=e.target.value;cooldown();};q('[data-address]').oninput=cooldown;
    q('[data-connect]').onclick=()=>run(async()=>{status=await api.paddockConnect({address:q('[data-address]').value,code:q('[data-code]').value});q('[data-code]').value='';await loadCatalogue();});
    q('[data-disconnect]').onclick=()=>run(()=>api.paddockDisconnect(false));
    q('[data-forget]').onclick=()=>{if(confirm('Forget this host? Linked cars and saved results stay local. Pending results can only be delivered to their original Paddock database.'))run(async()=>{await api.paddockDisconnect(true);catalog=[];q('[data-address]').value='';});};
    q('[data-browse]').onclick=()=>run(async()=>{await loadCatalogue(true);});
    q('[data-refresh]').onclick=()=>run(()=>api.paddockRefresh());
    q('[data-retry]').onclick=()=>run(()=>api.paddockRetry());q('[data-status-refresh]').onclick=()=>run(async()=>{});
    q('[data-deliveries]').onclick=e=>{const b=e.target.closest('[data-receipt]');if(b)run(()=>api.paddockCheckReceipt(b.dataset.receipt));};
    q('[data-search]').oninput=()=>{carPage=0;cars();cooldown();};
    q('[data-car-prev]').onclick=()=>{carPage=Math.max(0,carPage-1);cars();cooldown();};q('[data-car-next]').onclick=()=>{carPage++;cars();cooldown();};
    q('[data-catalog]').onclick=e=>{const b=e.target.closest('[data-link]');if(b)run(async()=>{const local=[...dialog.querySelectorAll('[data-local]')].find(x=>x.dataset.local===b.dataset.link).value;await api.paddockLink(b.dataset.link,local);await loadCatalogue();});};
    dialog.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{const target=q('#paddock-'+b.dataset.jump);if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});});
    if(options.compact){
      dialog.classList.add('dealership-compact');dialog.querySelector('header').hidden=true;
      q('.paddock-shell nav').hidden=true;q('#paddock-cars').hidden=true;q('#paddock-results').hidden=true;
      const guidance=document.createElement('details');guidance.innerHTML='<summary>Password and connection guidance</summary>';
      q('#paddock-connection').querySelectorAll(':scope > p.muted').forEach(p=>guidance.append(p));
      q('#paddock-connection').append(guidance);
    }
    // A catalogue refresh can detect a lost connection while this form remains open.
    // Update status without clearing a password/address the user is editing.
    async function refresh(){
      if(!active()||busy)return;
      try{const latest=await api.paddockStatus();if(!active()||busy)return;status=latest;paint();cooldown();}
      catch(e){if(active())error(e.message);}
    }
    paint();cars();cooldown();return {dialog,stop,refresh,isBusy:()=>busy};
  }
  async function open(api,onSaved){
    const dialog=document.createElement('dialog');dialog.className='paddock-dialog';document.body.append(dialog);
    let ui;dialog.onclose=()=>{ui?.stop();dialog.remove();onSaved?.();};dialog.showModal();
    ui=await mount(api,dialog,{modal:true});
    if(!ui){dialog.remove();return;}
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.oncancel=e=>{if(ui.isBusy())e.preventDefault();};
    return ui;
  }
  root.PaddockUI={open,mount};
})(globalThis);
