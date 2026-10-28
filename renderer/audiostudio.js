// Presentation and shared controls for Audio Settings. Existing draft/undo/save ownership stays in audioedit.
let audioView = { tab: 'calls', category: '', call: 'prerace', search: '', filter: 'all', profile: '' };
const audioDefaults = () => Sound.defaultSet();
const audioSample = c => Object.fromEntries(AudioCalls.variablesFor(c).map(k => [k, Announcer.SAMPLE[k] ?? '']));
function audioPreview(box, d) {
  if (box.nodeType !== 1) return;
  box.querySelectorAll('[data-message-preview]').forEach(el => {
    const [id,n] = el.dataset.messagePreview.split(':'), c = Announcer.CALLS.find(x=>x.id===id), line = d.calls[id]?.lines[Number(n)]; if(!line||!c)return;
    const sample=audioSample(c), check=AudioCalls.inspect(line.text,c,sample), mode=line.mode||(line.file?'file':'text');
    el.textContent=mode==='file'?'Plays the sound file instead of speech.':check.unknown.length?'Unavailable for this call: '+check.unknown.map(k=>'{'+k+'}').join(', '):'Example: '+Announcer.fill(line.text,sample);
    el.classList.toggle('audio-invalid',check.unknown.length>0&&mode!=='file');
  });
}
function audioStudio(box,d) {
  if (box.nodeType !== 1) return;
  const C=Announcer.CALLS,A=Announcer.AMBIENT,defaults=audioDefaults(),view=audioView;
  box.classList.add('audio-editor');
  const content=document.createElement('div');content.className='audio-studio-content';
  while(box.firstChild)content.appendChild(box.firstChild);box.appendChild(content);
  const bars=content.querySelectorAll('.ed-bar'),head=bars[0],voice=bars[1];head.classList.add('audio-studio-header');
  const shell=document.createElement('section');shell.className='audio-studio';shell.innerHTML=`<div class="audio-tabs" aria-label="Audio editor"><button class="btn" data-audio-tab="calls">Calls</button><button class="btn" data-audio-tab="mix">Voice &amp; mix</button><button class="btn" data-audio-tab="ambient">Ambient sounds</button></div><div class="audio-columns"><aside class="audio-rail"><label>Find a call<input type="search" data-audio-search placeholder="Name, event or value" value="${esc(view.search)}"></label><label>Show<select data-audio-filter><option value="all">All calls</option><option value="on">Enabled</option><option value="off">Disabled</option><option value="modified">Modified</option><option value="new">New calls</option></select></label><nav aria-label="Audio categories"></nav></aside><div class="audio-main"><div class="audio-choices"></div><div class="audio-call-body"></div></div></div><section class="audio-mixer" hidden></section></section>`;
  content.insertBefore(shell,head.nextSibling);const mixer=shell.querySelector('.audio-mixer'),body=shell.querySelector('.audio-call-body');mixer.appendChild(voice);
  ['au-voicenote','au-vbox'].forEach(id=>{const el=content.querySelector('#'+id);if(el)mixer.appendChild(el);});
  const help=content.querySelector('.audhelp');help.open=false;mixer.appendChild(help);
  content.querySelector('.audtools')?.remove();
  const groups=[...content.querySelectorAll('.audgroup')];groups.forEach(el=>body.appendChild(el));
  const shared=document.createElement('section');shared.className='audio-panel audio-blue';shared.innerHTML=`<h3>Speech &amp; commentary</h3><div class="audio-fields"><label>Lap-time decimals<select data-audio-setting="spokenDecimals"><option value="2"${Number(d.spokenDecimals)!==3?' selected':''}>2 decimals</option><option value="3"${Number(d.spokenDecimals)===3?' selected':''}>3 decimals</option></select></label><label>Discard old commentary after (seconds)<input type="number" data-audio-setting="queueAge" min="0" max="120" value="${esc(d.queueAge??12)}"><small>0 = no expiry. Race-control and result calls do not expire.</small></label></div><p>Flag, start and session-end calls interrupt commentary. Other calls queue. Missing values or unmet conditions skip that message and allow a matching fallback.</p><label>Starting profile<select id="au-profile"><option>Essential</option><option selected>Club</option><option>Broadcast</option></select></label><button class="btn" data-audio-profile="preview">Preview profile changes</button><div id="au-profile-preview" role="status"></div><div class="audio-profile-actions" hidden><button class="btn" data-audio-profile="apply">Apply profile</button><button class="btn" data-audio-profile="cancel">Cancel</button></div></section>`;mixer.prepend(shared);
  const log=document.createElement('details');log.className='audio-panel';log.innerHTML='<summary>Playback diagnostics</summary><button class="btn" data-audio-diagnostics="1">Refresh recent decisions</button><pre id="au-diagnostics"></pre>';mixer.appendChild(log);
  // Preserve the original mixer controls, move them out of the long ambient folder.
  const ambGroup=groups.find(g=>g.dataset.group===Announcer.AMBIENT_GROUP),ambControls=ambGroup?.querySelector('.ambintro');
  if(ambControls)mixer.appendChild(ambControls);
  C.forEach(c=>{
    const enable=body.querySelector(`[data-on="${c.id}"]`),card=enable?.closest('fieldset');if(!card)return;card.dataset.audioCall=c.id;card.classList.add('audio-selected-call');
    const description=document.createElement('div');description.className='audio-plain';description.innerHTML=`<small>IN PLAIN WORDS</small><p>${esc(c.label)}</p>${c.added?'<small>New call'+(d.calls[c.id]?.on===false?' · disabled until you enable it':'')+'</small>':''}`;card.insertBefore(description,card.querySelector('legend').nextSibling);
    // Editing a disabled call is allowed; its settings stay visible.
    card.querySelectorAll(':scope > div').forEach(inner=>{inner.hidden=false;});
    card.querySelectorAll('.audline').forEach(line=>{
      const input=line.querySelector('[data-text]');if(!input)return;const key=input.dataset.text,record=d.calls[c.id].lines[Number(key.split(':')[1])];
      const heading=document.createElement('h3');heading.textContent='What to play · variation '+(Number(key.split(':')[1])+1);line.prepend(heading);
      line.classList.add('audio-message');const mode=record.mode||(record.file?'file':'text');
      const controls=document.createElement('div');controls.className='audio-message-options';controls.innerHTML=`<label>Playback<select data-audio-mode="${key}">${[['text','Spoken message'],['file','Sound file'],['both','Sound, then speech']].map(([v,t])=>`<option value="${v}"${mode===v?' selected':''}>${t}</option>`).join('')}</select></label>${record.file?`<span>${esc(record.fileName||'Attached recording')}</span>`:''}<div class="audio-values">${AudioCalls.variablesFor(c).map(k=>`<button type="button" class="btn" data-audio-insert="${key}:${k}" title="${esc(Announcer.VARS[k]||k)} · Example: ${esc(Announcer.SAMPLE[k]??'not available')}">{${k}}</button>`).join('')}</div><p data-message-preview="${key}" aria-live="polite"></p><small>Matching conditional messages take precedence. Otherwise a matching unconditional message is selected at random.</small>`;
      const picker=document.createElement('details'),values=controls.querySelector('.audio-values');picker.className='audio-value-picker';picker.innerHTML='<summary>Insert a value · definitions and examples</summary>';values.before(picker);picker.appendChild(values);
      line.appendChild(controls);line.querySelector('[data-test]')?.replaceChildren(document.createTextNode('Preview message'));
      const test=document.createElement('button');test.className='btn';test.type='button';test.dataset.audioEvent=key;test.textContent='Test conditions';line.appendChild(test);
      if(mode==='file')input.hidden=true;const file=line.querySelector('.audfile');if(file)file.hidden=mode==='text';
    });
    const extra=document.createElement('section');extra.className='audio-panel audio-amber';extra.innerHTML=audioTrigger(c,d);if(extra.innerHTML)card.insertBefore(extra,card.querySelector('.audline')?.parentElement||card.lastChild);
  });
  audioSelect(box,d);audioPreview(box,d);
}
function audioTrigger(c,d) {
  const field=(key,label,note='')=>{const [v,lo,hi]=AudioCalls.SETTINGS[key];return `<label>${label}<input type="number" data-audio-setting="${key}" min="${lo}" max="${hi}" step="${['fuelRange','paceHysteresis'].includes(key)?0.1:1}" value="${esc(d[key]??v)}">${note?'<small>'+note+'</small>':''}</label>`;};
  let html='';
  if(c.id==='fuellow')html=field('fuelLow','Fuel warning at (%)')+field('fuelReset','Allow another warning above (%)','Must exceed the warning threshold. Uses this car’s effective tank.');
  if(['fuelrange','fuelfinish'].includes(c.id))html=field('fuelRange','Low estimated range (laps)')+field('fuelSamples','Recent clean laps to average','At least 3 clean samples are needed before estimating range.');
  if(c.id==='battle')html=`<label>Gap below (seconds)<input type="number" data-audio-setting="closeGap" min="0.1" max="30" step="0.1" value="${esc(d.closeGap??1)}"><small>Shared with Closing in.</small></label>`;
  if(['pushstate','savestate','normalstate'].includes(c.id))html=field('paceLaps','Consecutive laps in the new state')+field('paceHysteresis','Normal pace band (±%)','Small changes inside this band are Normal; consecutive laps and repeat limits prevent chatter.');
  if(['laptime','racesummary','mandatorydue'].includes(c.id))html=field('summaryEvery','Every N completed laps')+(c.id==='racesummary'?`<label>Automatic summary<select data-audio-setting="summaryMode"><option value="laps"${d.summaryMode!=='time'?' selected':''}>Every N laps</option><option value="time"${d.summaryMode==='time'?' selected':''}>Every N seconds</option></select></label>`+field('summarySeconds','Seconds between summaries'):'' );
  if(c.id==='servicecountdown')html=`<label>Announce at remaining seconds<input data-audio-setting="serviceCountdown" value="${esc(d.serviceCountdown??'10,5')}"><small>Comma-separated, e.g. 10, 5. Includes additive penalty time.</small></label>`;
  if(c.id==='serviceready')html='<p>Automatic Service Stop only. Timer, penalties, sensor return and pit-exit holds must all allow departure. Manual stops still require the director’s Release action.</p>';
  return html?'<h3>When to announce</h3><div class="audio-fields">'+html+'</div>':'';
}
function audioSelect(box,d) {
  if (box.nodeType !== 1) return;
  const v=audioView,ambient=v.tab==='ambient',defs=ambient?Announcer.AMBIENT:Announcer.CALLS,group=c=>ambient?c.section:AudioCalls.category(c),groups=[...new Set(defs.map(group))].sort((a,b)=>{const order=['Start & session','Positions & battles','Laps & records','Progress & milestones','Pits & Service Stop','Fuel Systems','Penalty Systems','Flags & Safety Car','Tyre Wear Systems','Weather Systems','Push & Save Systems','Damage & failures','Resource Systems','Endurance & driver swaps','Time Tokens','Balance of Power','Race control','Results & championship','Timing hardware'];return ambient?0:order.indexOf(a)-order.indexOf(b);}),defaults=audioDefaults();
  if(!groups.includes(v.category))v.category=groups[0];
  const matches=c=>{const cc=d.calls[c.id]||{},base=defaults.calls[c.id]||{};return (!v.search||(AudioCalls.title(c)+' '+c.label+' '+c.vars.join(' ')).toLowerCase().includes(v.search.toLowerCase()))&&(v.filter==='all'||v.filter==='on'&&cc.on!==false||v.filter==='off'&&cc.on===false||v.filter==='new'&&c.added||v.filter==='modified'&&JSON.stringify(cc)!==JSON.stringify(base));};
  const list=defs.filter(c=>matches(c)&&(v.search||group(c)===v.category));if(!list.some(c=>c.id===v.call))v.call=list[0]?.id||'';
  box.querySelector('.audio-rail nav').innerHTML=groups.map(g=>{const cs=defs.filter(c=>group(c)===g),on=cs.filter(c=>(d.calls[c.id]||{}).on!==false).length;return `<button type="button" class="audio-category" data-audio-category="${esc(g)}" data-system="${AudioCalls.TONES[g]||''}" aria-pressed="${g===v.category}"><strong>${esc(g)}</strong><small>${on} / ${cs.length} enabled</small></button>`;}).join('');
  box.querySelector('.audio-choices').innerHTML=(list.length?list.map(c=>`<button type="button" class="btn" data-audio-call="${c.id}" aria-pressed="${v.call===c.id}">${esc(AudioCalls.title(c))}${d.calls[c.id]?.on===false?' · Off':''}</button>`).join(''):'<p>No matching calls.</p>')+`<div class="audio-category-tools"><button class="btn" data-audio-enable="1">Enable category</button><button class="btn" data-audio-enable="0">Disable category</button></div>`;
  box.querySelectorAll('.audgroup').forEach(el=>{el.open=true;el.hidden=ambient?el.dataset.group!==Announcer.AMBIENT_GROUP:el.dataset.group===Announcer.AMBIENT_GROUP;const s=el.querySelector(':scope > summary');if(s)s.hidden=true;});
  box.querySelectorAll('.ambsection').forEach(el=>{el.open=true;const s=el.querySelector('summary');if(s)s.hidden=true;});
  box.querySelectorAll('.audcall').forEach(el=>{const id=el.querySelector('[data-on]')?.dataset.on;el.hidden=id!==v.call;});
  box.querySelectorAll('[data-audio-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.audioTab===v.tab)));
  box.querySelector('.audio-columns').hidden=v.tab==='mix';box.querySelector('.audio-mixer').hidden=v.tab!=='mix';box.querySelector('[data-audio-filter]').value=v.filter;
}
