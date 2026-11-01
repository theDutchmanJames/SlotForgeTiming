// Public catalogue browser. One shared main-process revision check; no race-time polling.
(function(root){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function mount(box,api,options={}){
    let data={cars:[]},source='paddock',busy=false,closed=false,timer,search='',page=0,local=[],markup='',loadingImages=false,refreshing=false,pendingRefresh=null;
    const imageCache=new Map(),names=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
    box.classList.add('paddock-browser');
    box.innerHTML=`<div class="pb-toolbar"><div class="seg" role="group" aria-label="Car database"><button class="btn" data-source="local">Local Database</button><button class="btn on" data-source="paddock">Paddock Database</button></div><button class="btn" data-connection>Connection &amp; results</button><button class="btn" data-refresh>Refresh now</button></div><p data-summary aria-live="polite"></p><p class="muted" data-guidance></p><p data-error role="status"></p><input type="search" data-search aria-label="Search cars" placeholder="Search by name, model or race class…"><div class="pb-cars" data-cars></div><div class="pb-pages"><button class="btn" data-prev>Previous</button><span data-count></span><button class="btn" data-next>Next</button></div>`;
    const q=s=>box.querySelector(s),active=()=>!closed&&box.isConnected;
    function stop(){closed=true;clearTimeout(timer);observer.disconnect();imageCache.clear();}
    const observer=new MutationObserver(()=>{if(!box.isConnected)stop();});observer.observe(document.body,{childList:true,subtree:true});
    // Fetch one visible picture at a time. Keep base64 out of HTML parsing and
    // leave a turn for input/painting between pictures. Background checks do not
    // replace existing image nodes or decode unchanged pictures again.
    async function loadImages(){
      if(loadingImages)return;loadingImages=true;
      try{while(active()){
        const img=q('img[data-picture]:not([data-loaded])');if(!img)break;
        img.dataset.loaded='true';const key=img.dataset.picture;
        let picture=imageCache.get(key);
        try{if(picture===undefined)picture=img.dataset.origin==='local'?local.find(c=>c.id===img.dataset.id)?.picture||'':await api.paddockPicture(img.dataset.id,img.dataset.key);}
        catch{picture='';}
        if(!active())break;
        if(img.isConnected&&picture){imageCache.set(key,picture);img.src=picture;}
        await new Promise(resolve=>setTimeout(resolve,16));
      }}finally{loadingImages=false;}
    }
    function paint(){
      if(!active())return;
      box.querySelectorAll('[data-source]').forEach(b=>{b.classList.toggle('on',b.dataset.source===source);b.setAttribute('aria-pressed',String(b.dataset.source===source));});
      q('[data-source="paddock"]').textContent='Paddock'+(data.connection?' · '+data.connection.name:' Database');
      q('[data-summary]').textContent=source==='local'?'Your Timing cars':(data.connection?data.connection.name+' · '+(data.connected?'Connected':'Offline'):'No Paddock database connected')+(data.lastUpdated?' · Updated '+new Date(data.lastUpdated).toLocaleString():'');
      q('[data-guidance]').textContent=source==='local'?'Cars managed in SlotForge Timing.':'Car details are managed in Paddock. Checks every 30 seconds while this view is open; only changes reload the catalogue. Finalised race results are sent back automatically.';
      q('[data-refresh]').hidden=source==='local';q('[data-refresh]').disabled=busy;
      if(options.guidance)q('[data-guidance]').textContent+=' '+options.guidance;
      const list=(source==='local'?local:data.cars).filter(c=>(!options.accept||options.accept(c,source))&&[c.name,c.maker,c.model,c.raceClassName||c.raceClass].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b)=>names.compare(a.name,b.name));
      page=Math.min(page,Math.max(0,Math.ceil(list.length/40)-1));
      const html=list.slice(page*40,page*40+40).map(c=>`<article class="pb-car">${(source==='local'?c.picture:c.pictureKey)?`<img data-picture="${esc(source+':'+c.id+':'+(c.pictureKey||''))}" data-id="${esc(c.id)}" data-key="${esc(c.pictureKey||'')}" data-origin="${source}" decoding="async" alt="">`:'<span class="pb-car-placeholder" aria-hidden="true">▱</span>'}<div><h3>${esc(c.name)}</h3><p>${esc([c.maker,c.raceClassName||c.raceClass].filter(Boolean).join(' · '))}</p><small>${source==='local'?'Local car':c.capturedAt?'Available offline · captured '+esc(new Date(c.capturedAt).toLocaleString()):'Available when connected'}</small></div><button class="btn" data-use="${esc(c.id)}" ${source==='paddock'&&!data.connected&&!c.capturedAt?'data-unavailable':''}>${options.choose?'Select car':'View car'}</button></article>`).join('')||'<p class="muted">'+(search?'No matching cars.':source==='local'?'No local cars yet.':'Connect to Paddock to load its available cars. A saved catalogue remains visible offline.')+'</p>';
      if(html!==markup){
        markup=html;q('[data-cars]').innerHTML=html;
        const keys=new Set([...box.querySelectorAll('[data-picture]')].map(img=>img.dataset.picture));
        for(const key of imageCache.keys())if(!keys.has(key))imageCache.delete(key);
        loadImages();
      }
      box.querySelectorAll('[data-use]').forEach(b=>b.disabled=busy&&!refreshing||b.hasAttribute('data-unavailable'));
      q('[data-count]').textContent=list.length+' cars · Page '+(page+1)+' of '+Math.max(1,Math.ceil(list.length/40));q('[data-prev]').disabled=page===0;q('[data-next]').disabled=(page+1)*40>=list.length;
    }
    async function refresh(force=false){
      if(!active()||busy)return;
      busy=true;refreshing=true;paint();
      pendingRefresh=(async()=>{
        try{data=await api.paddockCatalogue(force);if(active())q('[data-error]').textContent=data.error||'';}
        catch(e){if(active())q('[data-error]').textContent=e.message;}
        finally{busy=false;refreshing=false;paint();}
      })();
      try{await pendingRefresh;}finally{pendingRefresh=null;}
    }
    async function tick(){
      if(!active())return stop();
      const modal=document.querySelector('dialog[open]');
      if(source==='paddock'&&!document.hidden&&(!modal||modal.contains(box)))await refresh();
      if(active())timer=setTimeout(tick,30000);
    }
    q('[data-search]').oninput=e=>{search=e.target.value;page=0;paint();};
    box.onclick=async e=>{
      const b=e.target.closest('button');if(!b)return;e.stopPropagation();
      if(b.dataset.source){if(b.dataset.source==='local'&&options.openLocal)return options.openLocal();source=b.dataset.source;page=0;if(source==='local'){const [cars,classes]=await Promise.all([api.list('slotcars'),api.list('raceclasses')]);local=cars.filter(c=>!c.paddock).map(c=>({...c,raceClassName:classes.find(x=>x.id===c.raceClass)?.name||'',name:[c.brand,c.manufacturer,c.model].filter(Boolean).join(' ')||'Unnamed car'}));paint();}else await refresh();return;}
      if(b.hasAttribute('data-connection'))return PaddockUI.open(api,()=>refresh());
      if(b.hasAttribute('data-refresh'))return refresh(true);
      if(b.hasAttribute('data-prev')){page--;paint();return;}if(b.hasAttribute('data-next')){page++;paint();return;}
      if(!b.dataset.use)return;
      // A periodic revision check must not steal keyboard focus or discard a
      // click. Finish that check, then select using the latest catalogue data.
      const requestedSource=source;
      if(pendingRefresh)await pendingRefresh;
      if(!active()||busy||source!==requestedSource)return;
      busy=true;paint();
      try{
        const selected=(source==='local'?local:data.cars).find(c=>c.id===b.dataset.use);if(!selected)return;
        let car=source==='local'?selected:null;
        if(!car){if(data.connected)car=await api.paddockLink(selected.id);else car=(await api.list('slotcars')).find(c=>c.id===selected.linked&&!c.paddock?.archived);}
        if(!car)throw Error('Reconnect to Paddock before selecting this car.');
        if(active())await (options.choose||options.view)?.(car);
      }catch(err){if(active())q('[data-error]').textContent=err.message;}
      finally{busy=false;paint();}
    };
    paint();refresh().then(()=>{if(active())timer=setTimeout(tick,30000);});
    return {stop,refresh};
  }
  function pick(api,choose,options={}){
    const dialog=document.createElement('dialog');dialog.className='paddock-dialog';dialog.innerHTML='<header><h2>Choose a car</h2><button class="btn" data-close>Close</button></header><div data-browser></div>';document.body.append(dialog);dialog.showModal();
    const browser=mount(dialog.querySelector('[data-browser]'),api,{...options,choose:async car=>{await choose(car);dialog.close();}});
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>{browser.stop();dialog.remove();};return dialog;
  }
  root.PaddockBrowser={mount,pick};
})(globalThis);
