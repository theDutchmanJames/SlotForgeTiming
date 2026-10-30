// Database editor for a track's design, independent of its records and measured lengths.
(function(root){
  const D=root.TrackDesign,I=root.SlotForgeIntegration,E=D.esc;
  async function open(api,initial,onSaved){
    const tracks=await api.list('tracks'),dialog=document.createElement('dialog');dialog.className='track-design-dialog';
    document.body.append(dialog);
    let target=initial||null,doc=null,mapping=[],confirmed=false,png='',busy=false,previewRun=0;
    let choices={name:!target,lanes:!target,lengths:!target,picture:!target};
    const error=text=>{const el=dialog.querySelector('[data-design-error]');if(el){el.textContent=text;el.scrollIntoView({block:'nearest'});}};
    const count=()=>choices.lanes?(doc?.track.laneCount||doc?.track.slotCountsInDrawing[0]||1):Number(target?.lanes||2);
    function setMapping(previous){
      const restored=D.restoreMapping(doc,previous,count());mapping=restored.laneRoutes;confirmed=restored.confirmed;
    }
    async function loadRaw(raw){
      if(busy)return;
      doc=D.normalize(raw);setMapping(target?.trackDesign);png='';render();await paint();
    }
    function change(){confirmed=false;dialog.querySelector('[data-confirm]').checked=false;paint();}
    async function paint(){
      const seq=++previewRun,box=dialog.querySelector('[data-preview]');if(!doc)return;
      dialog.querySelector('.td-warnings').innerHTML=doc.compatibility.issues.map(w=>`<li>${E(w.message)}</li>`).join('');
      try{
        const p=await D.thumbnail(doc);if(seq!==previewRun||!dialog.isConnected)return;png=p;
        const ready=D.configure(doc,mapping,true),rt=D.runtime(ready,mapping.length);
        if(rt?.error)throw Error(rt.error);
        const colors=['#35a8cf','#80b354','#e7bb31','#ae8ce6','#e47766','#5fcac3','#e885b9','#a9b8cb'];
        box.innerHTML=`<svg viewBox="0 0 720 400" role="img" aria-label="Track design with lane numbers and direction arrows">${D.drawing(rt,720,400)}${mapping.map((_,i)=>{const q=D.point(rt,i,.04,720,400);return `<g transform="translate(${q.x} ${q.y})"><path d="M-14 -7L0 0L-14 7" transform="rotate(${q.angle})" fill="none" stroke="${colors[i]}" stroke-width="4"/><circle r="10" fill="${colors[i]}"/><text y="4" text-anchor="middle" fill="#101820" font-size="12" font-weight="bold">${i+1}</text></g>`;}).join('')}</svg>`;
      }catch(e){
        if(seq!==previewRun||!dialog.isConnected)return;
        box.innerHTML=png?`<img src="${png}" alt="Imported track design"><p class="muted">${E(e.message)}</p>`:`<p class="muted">${E(e.message)}</p>`;
      }
    }
    function render(){
      const lanes=doc?.track.lanes||[],defs=new Map((doc?.definitions||[]).map(d=>[d.id,d]));
      const roads=(doc?.pieces||[]).filter(p=>!['reference','straight-border','curve-border'].includes(defs.get(p.definitionId)?.parameters.type));
      const options=(a,value)=>a.map(([id,label])=>`<option value="${E(id)}"${String(id)===String(value)?' selected':''}>${E(label)}</option>`).join('');
      const check=(key,label)=>`<label class="td-check"><input type="checkbox" data-copy="${key}"${choices[key]?' checked':''}${!target&&['name','lanes'].includes(key)?' disabled':''}>${label}</label>`;
      dialog.innerHTML=`<header class="td-head"><div><span class="muted">DATABASE / TRACKS</span><h2>Track Builder design</h2><p>Import the drawing, confirm your timing lanes, then use it in Live Track charts.</p></div><button class="btn" data-close>Close</button></header><div class="td-layout"><nav aria-label="Track design sections">${[['import','Import & destination'],['mapping','Lanes & timing line'],['profile','Animation profile'],['apply','Save to database']].map(([id,label])=>`<button class="btn" data-section="${id}">${label}</button>`).join('')}<p class="muted">Positions are estimates between sensor crossings. The profile changes the animation, never measured laps or race rules.</p></nav><main>
      <section id="td-import"><h3>Import & destination</h3><label class="field">Track Builder file<input type="file" accept=".json,.slotforge.json" data-file></label><span class="muted">A .slotforge.json export, up to 5 MiB. No separate picture is needed.</span><label class="field">Save design to<select data-target>${options([['','Create a new track'],...tracks.map(t=>[t.id,t.name||'Unnamed track'])],target?.id||'')}</select></label>${target?`<p>Updating <strong>${E(target.name)}</strong>. Its identity and race records stay linked.</p>`:''}${doc?`<h3>${E(doc.title)}</h3><p>${lanes.length} closed routes · ${doc.pieces.length} pieces · ${(doc.definitions||[]).filter(d=>d.parameters.type==='reference').length} reference definitions</p><div class="td-preview" data-preview></div><ul class="td-warnings">${doc.compatibility.issues.map(w=>`<li>${E(w.message)}</li>`).join('')}</ul>`:'<p class="muted">Choose an export to see the track and its nominal lane lengths.</p>'}</section>
      <details id="td-mapping" open><summary>Lanes & timing line</summary><div class="td-fields">${doc?`${check('lanes','Use the design’s lane count')}<div class="td-lanes">${mapping.map((id,i)=>`<label class="field">Timing lane ${i+1}<select data-lane="${i}">${options([['','Not mapped'],...lanes.map(l=>[l.id,`${l.label} · ${(l.lengthMm/1000).toFixed(3)} m nominal`])],id)}</select></label>`).join('')}</div><div class="formgrid"><label class="field">Piece containing the lap sensor<select data-line>${options([['','Choose a road piece'],...roads.map(p=>[p.id,`${defs.get(p.definitionId).name} · ${p.id}`])],doc.timing.startFinish?.pieceId||'')}</select></label><label class="field">Sensor position along that piece (%)<input type="number" data-fraction min="0" max="100" step="any" value="${(doc.timing.startFinish?.fraction??.5)*100}"></label><label class="field">Travel direction<select data-direction>${options([[1,'Forward along the route'],[-1,'Reverse along the route']],doc.timing.direction)}</select></label></div><p class="muted">0% and 100% are the piece’s local ends. Use the numbered arrows in the preview to check the physical lane order and direction. A changed circuit requires confirmation again.</p><label class="td-check"><input type="checkbox" data-confirm${confirmed?' checked':''}>I have checked every lane, direction and the sensor position</label>`:'Import a design first.'}</div></details>
      <details id="td-profile"><summary>Animation profile</summary><div class="td-fields"><p class="muted">Inherited from Track Builder. Straight speed, braking and cornering shape the movement within each estimated lap. In Chart Editor, choose “Imported tuning profile” under “Estimate lap progress using” to use its calculated lap duration too. Other benchmarks scale this movement to the selected lap time. These estimates never count laps; only sensor crossings do.</p>${doc?`<div class="td-lanes">${[['speed','Straight speed (mm/s)',200,3000,10],['acceleration','Acceleration (mm/s²)',100,4000,10],['brake','Braking (mm/s²)',100,5000,10],['corner','Corner speed factor',.2,.95,.01],['drift','Visual body drift (degrees)',0,30,1]].map(([key,label,min,max,step])=>`<label class="field">${label}<input type="number" data-profile="${key}" min="${min}" max="${max}" step="any" value="${doc.profile[key]}"></label>`).join('')}</div>`:''}</div></details>
      <section id="td-apply"><h3>Save to database</h3>${check('name','Use the design’s track name')}${check('lengths','Use nominal design lengths for the mapped lanes')}${check('picture','Use the generated transparent PNG as the track picture')}<p class="muted">Existing lengths and picture stay unchanged unless selected. Nominal lengths are calculated from the design, not verified physical measurements. Your track’s lap limits, target time and race records remain unchanged.</p><p class="td-message" data-design-error role="alert"></p><div class="row"><button class="btn primary" data-save${!doc?' disabled':''}>${target?'Save track design':'Create track'}</button>${target?.trackDesign?'<button class="btn danger" data-remove>Remove linked design</button>':''}</div><p class="muted">Next: Customization → Chart Editor → Live Track → Appearance. Choose Coloured Lanes or Track Builder Artwork; both follow this imported layout. Select this track in your Race Setup. Changes apply to the next race.</p></section></main></div>`;
      dialog.querySelector('[data-close]').onclick=()=>dialog.close();
      dialog.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{const el=dialog.querySelector('#td-'+b.dataset.section);if(el.tagName==='DETAILS')el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'});});
      dialog.querySelector('[data-file]').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>D.MAX_BYTES)throw Error('The file exceeds 5 MiB.');await loadRaw(await file.text());}catch(e){error(e.message);}};
      dialog.querySelector('[data-target]').onchange=e=>{if(busy)return;target=tracks.find(t=>t.id===e.target.value)||null;choices={name:!target,lanes:!target,lengths:!target,picture:!target};if(doc)setMapping(target?.trackDesign);render();paint();};
      dialog.querySelectorAll('[data-copy]').forEach(el=>el.onchange=()=>{choices[el.dataset.copy]=el.checked;if(el.dataset.copy==='lanes'&&doc){setMapping(null);render();paint();}});
      dialog.querySelectorAll('[data-lane]').forEach(el=>el.onchange=()=>{mapping[Number(el.dataset.lane)]=el.value;change();});
      const lineChange=()=>{const pieceId=dialog.querySelector('[data-line]').value,fraction=Number(dialog.querySelector('[data-fraction]').value)/100;if(!Number.isFinite(fraction)||fraction<0||fraction>1){error('Sensor position must be between 0% and 100%.');return;}doc=I.prepare(doc,{...I.readState(doc),startFinish:pieceId?{pieceId,fraction}:null,direction:Number(dialog.querySelector('[data-direction]').value)},false);change();};
      for(const sel of ['[data-line]','[data-fraction]','[data-direction]'])if(dialog.querySelector(sel))dialog.querySelector(sel).onchange=lineChange;
      dialog.querySelectorAll('[data-profile]').forEach(el=>el.onchange=()=>{if(!el.checkValidity()){error('Use a profile value within the shown limits.');return;}doc=I.prepare({...doc,profile:{...doc.profile,[el.dataset.profile]:Number(el.value)}},undefined,false);paint();});
      if(dialog.querySelector('[data-confirm]'))dialog.querySelector('[data-confirm]').onchange=e=>{confirmed=e.target.checked;};
      dialog.querySelector('[data-save]').onclick=async()=>{
        if(busy)return;
        const controls=[...dialog.querySelectorAll('button,input,select')],disabled=controls.map(el=>el.disabled);
        try{
          if(![...dialog.querySelectorAll('input[type=number]')].every(el=>el.reportValidity()))throw Error('Check the highlighted values.');
          // Freeze the intended document, destination and copy choices across asynchronous I/O.
          const saved=D.configure(doc,mapping,confirmed),targetId=target?.id,copy={...choices};
          busy=true;controls.forEach(el=>el.disabled=true);
          const fresh=targetId?(await api.list('tracks')).find(t=>t.id===targetId):null;
          if(targetId&&!fresh)throw Error('The destination track was removed. Choose another destination.');
          const patch=D.patch(fresh,saved,{...copy,png:copy.picture?await D.thumbnail(saved.document):''});
          if(targetId)await api.update('tracks',targetId,patch);else await api.add('tracks',patch);
          dialog.close();await onSaved?.();
        }catch(e){error(e.message);}finally{busy=false;controls.forEach((el,i)=>{if(el.isConnected)el.disabled=disabled[i];});}
      };
      if(dialog.querySelector('[data-remove]'))dialog.querySelector('[data-remove]').onclick=async()=>{try{await api.update('tracks',target.id,{trackDesign:null});dialog.close();await onSaved?.();}catch(e){error(e.message);}};
    }
    dialog.oncancel=e=>{if(busy)e.preventDefault();};dialog.onclose=()=>{++previewRun;dialog.remove();};render();dialog.showModal();
    if(target?.trackDesign)try{await loadRaw(target.trackDesign.document);}catch(e){error(e.message);}
    return {dialog,loadRaw};
  }
  root.TrackDesignUI={open};
})(globalThis);
