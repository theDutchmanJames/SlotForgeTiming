// Presentation only. audioedit owns draft, undo, validation and save.
let audioView={tab:'calls',category:'',call:'prerace',search:'',filter:'all',profile:'',variations:{},folders:{}};
const audioDefaults=()=>Sound.defaultSet();
const audioSample=c=>Object.fromEntries(AudioCalls.variablesFor(c).map(k=>[k,Announcer.SAMPLE[k]??'']));
const audioAmbientTitle=c=>({ambcrowd:'Race crowd',ambparaddock:'Paddock ambience',ambrain:'Rain ambience',ambdry:'Dry-weather ambience'}[c.id]||c.label.split(' (')[0].split(':')[0]);
function audioPreview(box,d){
 if(box.nodeType!==1)return;
 box.querySelectorAll('[data-message-preview]').forEach(el=>{const [id,n]=el.dataset.messagePreview.split(':'),c=Announcer.CALLS.find(x=>x.id===id),line=d.calls[id]?.lines[Number(n)];if(!line||!c)return;
 const sample=audioSample(c),check=AudioCalls.inspect(line.text,c,sample),mode=line.mode||(line.file?'file':'text');
 el.textContent=mode==='file'?(line.file?'Plays the attached sound file instead of speech.':'Attach a sound file to hear this variation.'):check.unknown.length?'Unavailable for this call: '+check.unknown.map(k=>'{'+k+'}').join(', '):'Example: '+Announcer.fill(line.text,sample);
 el.classList.toggle('audio-invalid',check.unknown.length>0&&mode!=='file');});
}
function audioFolder(key,title,note='',open=true){
 const el=document.createElement('details');el.className='audio-folder';el.dataset.audioFolder=key;el.open=audioView.folders?.[key]??open;
 el.innerHTML=`<summary><strong>${esc(title)}</strong><small>${esc(note)}</small></summary><div class="audio-folder-content"></div>`;
 el.ontoggle=()=>{if(el.isConnected)(audioView.folders||(audioView.folders={}))[key]=el.open;};return el;
}
const audioFolderBody=el=>el.querySelector('.audio-folder-content');
function audioBalance(box,d){
 const el=box.querySelector('[data-audio-balance]');if(!el)return;
 const a=Sound.ambientOf(d),calls=Math.round(d.volume*100),normal=Math.round(a.volume*100),retained=Math.round(a.level*100),effective=Math.round(normal*(a.duck?a.level:1));
 el.innerHTML=`<strong>While a call plays</strong><small>Example with an individual sound at 100%</small><div class="audio-meter"><span>Calls</span><span><i style="width:${calls}%"></i></span><b>${calls}%</b></div><div class="audio-meter audio-meter-ambient"><span>Ambient</span><span><i style="width:${effective}%"></i></span><b>${effective}%</b></div><p>${a.duck?`${normal}% ambient × ${retained}% retained = ${effective}%. Returns to ${normal}% after the call.`:`Ambient stays at ${normal}% while calls play.`}</p>`;
 box.querySelector('#au-call-volume-output').textContent=calls+'%';
}
function audioVariations(box,id){
 const card=box.querySelector(`[data-audio-call="${id}"]`);if(!card)return;
 const lines=[...card.querySelectorAll('[data-audio-variation-body]')],view=audioView.variations||(audioView.variations={}),n=Math.max(0,Math.min(Number(view[id])||0,lines.length-1));view[id]=n;
 lines.forEach((el,i)=>el.hidden=i!==n);const select=card.querySelector('[data-audio-variation]');if(select)select.value=String(n);
}
function audioValueExample(box,select){const el=box.querySelector(`[data-audio-value-example="${select.dataset.audioValue}"]`);if(el)el.textContent=select.value?'Example: '+(Announcer.SAMPLE[select.value]??'Depends on race data'):'No values are available for this call.';}
function audioStudio(box,d){
 if(box.nodeType!==1)return;
 const C=Announcer.CALLS,A=Announcer.AMBIENT;box.classList.add('audio-editor');
 const old=document.createElement('div');while(box.firstChild)old.appendChild(box.firstChild);
 const bars=old.querySelectorAll('.ed-bar'),head=bars[0],voice=bars[1],groups=[...old.querySelectorAll('.audgroup')];
 const shell=document.createElement('section');shell.className='audio-studio setuppage';
 shell.innerHTML=`<header class="audio-studio-header"><div class="audio-title"><i data-lucide="audio-lines" aria-hidden="true"></i><div><small>AUDIO SET</small><h2 data-audio-heading>${esc(d.name||'New audio set')}</h2><p>${C.length} race calls · ${A.length} ambient events</p></div></div></header><div class="audio-layout"><nav class="audio-tabs" aria-label="Audio set sections">${[['calls','Race Calls','Words & recordings for race events','megaphone'],['ambient','Ambient Sounds','Backgrounds, engines & race effects','waves'],['mix','Voice & Playback','Commentator, volume & announcement timing','sliders-horizontal']].map(([id,title,note,icon])=>`<button type="button" data-audio-tab="${id}"><i data-lucide="${icon}" aria-hidden="true"></i><span><strong>${title}</strong><small>${note}</small></span></button>`).join('')}<aside><strong>Use this audio set</strong><p>Choose it in Race Setup → Race UI and Audio. Sound plays on the computer running the race.</p></aside></nav><main class="audio-workspace"><div class="audio-plain"><small>IN PLAIN WORDS</small><p data-audio-explanation></p></div><div class="audio-columns"><div class="audio-finder"></div><div class="audio-main"><div class="audio-call-body"></div></div><div class="audio-tools"></div></div><section class="audio-mixer" hidden></section></main></div><footer class="audio-footer"></footer></section>`;
 box.appendChild(shell);const $=s=>shell.querySelector(s),mixer=$('.audio-mixer'),body=$('.audio-call-body');
 $('.audio-studio-header').appendChild(head);head.classList.add('audio-header-controls');
 $('.audio-footer').append(head.querySelector('#au-msg'),head.querySelector('#au-save'));head.querySelector('#au-back').textContent='All audio sets';
 groups.forEach(el=>body.appendChild(el));
 const finder=audioFolder('finder','Find a call','Search, then choose a category and event');
 audioFolderBody(finder).innerHTML=`<div class="audio-fields"><label>Search<input type="search" data-audio-search placeholder="Name, event or value" value="${esc(audioView.search)}"></label><label>Show<select data-audio-filter><option value="all">All calls</option><option value="on">Enabled</option><option value="off">Disabled</option><option value="modified">Modified</option><option value="new">New calls</option></select></label><label>Category<select data-audio-category-select></select></label><label>Call<select data-audio-call-select></select></label></div><p class="muted" data-audio-count></p>`;$('.audio-finder').appendChild(finder);
 const tools=audioFolder('tools','Call presets & group actions','Only if you need them',false);
 audioFolderBody(tools).innerHTML=`<div data-call-presets><label>Starting preset<select id="au-profile"><option>Essential</option><option selected>Club</option><option>Broadcast</option></select></label><p>Changes which calls are enabled. Your messages and recordings are kept. Review before applying.</p><button class="btn" data-audio-profile="preview">Review preset changes</button><div id="au-profile-preview" role="status"></div><div class="audio-profile-actions" hidden><button class="btn" data-audio-profile="apply">Apply preset</button><button class="btn" data-audio-profile="cancel">Cancel</button></div></div><details><summary>Enable or disable the current category</summary><div class="row"><button class="btn" data-audio-enable="1">Enable category</button><button class="btn" data-audio-enable="0">Disable category</button></div></details>`;$('.audio-tools').appendChild(tools);
 const voiceFolder=audioFolder('voice','Commentator voice','How spoken messages sound'),balance=audioFolder('balance','Volume balance','Keep announcements clear'),timing=audioFolder('timing','Announcement timing','Keep commentary relevant',false);mixer.append(voiceFolder,balance,timing);
 const volume=voice.querySelector('#au-vol').closest('label');volume.firstChild.textContent='Calls volume ';volume.querySelector('input').type='range';volume.querySelector('input').step='0.01';volume.insertAdjacentHTML('beforeend','<output id="au-call-volume-output"></output><small>Spoken messages and call recordings.</small>');
 audioFolderBody(voiceFolder).appendChild(voice);voice.className='audio-fields';
 for(const [id,label,note] of [['au-rate','Speech speed','1.0 = normal speed'],['au-pitch','Voice pitch','1.0 = normal pitch'],['au-by','Call drivers by','']]){const el=voice.querySelector('#'+id).closest('label');el.firstChild.textContent=label+' ';if(note)el.insertAdjacentHTML('beforeend',`<small>${note}</small>`);}
 const voiceHelp=audioFolder('voice-help','Voice help & report','Missing a voice?',false);audioFolderBody(voiceFolder).appendChild(voiceHelp);
 ['au-voicehelp','au-vreport','au-voicenote','au-vbox'].forEach(id=>{const el=old.querySelector('#'+id)||voice.querySelector('#'+id);if(el)audioFolderBody(voiceHelp).appendChild(el);});
 audioFolderBody(voiceFolder).insertAdjacentHTML('beforeend','<button class="btn" type="button" data-audio-voice-preview>Preview voice</button>');
 const ambControls=body.querySelector('.ambintro'),ambFields=ambControls.querySelector('.ambset');
 const relabel=(id,text,note='')=>{const input=ambFields.querySelector('#'+id),label=input.closest('label');if(input.type==='checkbox'){[...label.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.remove());label.append(document.createTextNode(text));}else label.firstChild.textContent=text+' ';if(note)label.insertAdjacentHTML('beforeend',`<small>${note}</small>`);return label;};
 relabel('au-ambvol','Ambient volume (%)','Crowd, track and pit sound effects.');relabel('au-ambduck','Lower ambient sounds while a call plays');relabel('au-ambdlvl','Keep this much of their normal volume (%)');
 const max=relabel('au-ambmax','Maximum one-shot effects playing together','Background loops do not use these slots.'),maxFolder=audioFolder('max-effects','Simultaneous sound effects','Only if you need it',false);audioFolderBody(maxFolder).appendChild(max);
 ambFields.prepend(volume);ambFields.className='audio-fields';audioFolderBody(balance).appendChild(ambFields);audioFolderBody(balance).insertAdjacentHTML('beforeend','<div class="audio-balance" data-audio-balance></div>');audioFolderBody(balance).appendChild(maxFolder);ambControls.remove();
 audioFolderBody(timing).innerHTML=`<div class="audio-fields"><label>Lap-time decimals<select data-audio-setting="spokenDecimals"><option value="2"${Number(d.spokenDecimals)!==3?' selected':''}>2 decimals</option><option value="3"${Number(d.spokenDecimals)===3?' selected':''}>3 decimals</option></select></label><label>Skip commentary waiting longer than (seconds)<input type="number" data-audio-setting="queueAge" min="0" max="120" value="${esc(d.queueAge??12)}"><small>0 = keep waiting without expiry.</small></label></div><p>Flag, start and session-end calls interrupt ordinary commentary. Race-control and result calls do not expire. These are playback rules, not changes to race timing.</p>`;
 const help=old.querySelector('.audhelp');help.open=false;audioFolderBody(tools).appendChild(help);
 const log=audioFolder('diagnostics','Playback diagnostics','Why was a call skipped?',false);audioFolderBody(log).innerHTML='<button class="btn" data-audio-diagnostics="1">Refresh recent decisions</button><pre id="au-diagnostics"></pre>';mixer.appendChild(log);
 [...C,...A].forEach(c=>{
  const ambient=!!c.section,enable=body.querySelector(`[data-on="${c.id}"]`),card=enable.closest('fieldset'),inner=card.querySelector(':scope > div');
  card.dataset.audioCall=c.id;card.dataset.system=audioSystemTone(ambient?c.section:AudioCalls.category(c));inner.hidden=false;
  const legend=card.querySelector('legend');legend.textContent=ambient?audioAmbientTitle(c):AudioCalls.title(c);
  const toggle=document.createElement('label');toggle.className='audio-enable';toggle.append(enable,document.createTextNode(ambient?'Enable this sound':'Enable this call'));card.insertBefore(toggle,inner);
  const trigger=audioFolder(c.id+':trigger',ambient?'Playback behaviour':'When it plays',ambient?(c.loop?'Looping background':'One-shot effect'):'Triggered by the race event');audioFolderBody(trigger).innerHTML=`<p>${esc(c.label)}</p>${ambient?'':audioTrigger(c,d)}`;
  const messages=audioFolder(c.id+':messages',ambient?'Sound files':'Message & sound',ambient?'Your own recordings':'What the driver hears');
  const existing=[...inner.children];card.append(trigger,messages);
  existing.filter(el=>!el.matches('.audline,.audcond,.audcool')&&!el.querySelector('[data-addline]')).forEach(el=>audioFolderBody(trigger).appendChild(el));
  const lines=existing.filter(el=>el.matches('.audline'));
  if(lines.length){const choice=document.createElement('label');choice.textContent=ambient?'Recording':'Variation';choice.innerHTML+=`<select data-audio-variation="${c.id}">${lines.map((_,n)=>`<option value="${n}">${ambient?'Recording':'Variation'} ${n+1}</option>`).join('')}</select>`;audioFolderBody(messages).appendChild(choice);}
  lines.forEach((line,n)=>{
   const key=c.id+':'+n,record=d.calls[c.id].lines[n],variation=document.createElement('div');variation.dataset.audioVariationBody=key;variation.className='audio-message';audioFolderBody(messages).appendChild(variation);variation.appendChild(line);
   const condition=existing.find(el=>el.dataset.condKey===key);if(condition)variation.appendChild(condition);
   const remove=line.querySelector('[data-delline]'),actions=audioFolder(key+':actions',ambient?'Recording actions':'Variation actions','',false);audioFolderBody(actions).appendChild(remove);variation.appendChild(actions);
   line.querySelector('[data-test],[data-ambtest]')?.replaceChildren(document.createTextNode(ambient?'Preview sound':'Preview call'));
   if(ambient)return;
   const input=line.querySelector('[data-text]'),mode=record.mode||(record.file?'file':'text'),play=document.createElement('label');play.textContent='Play as';play.innerHTML+=`<select data-audio-mode="${key}">${[['text','Spoken message'],['file','Sound file'],['both','Sound, then speech']].map(([v,t])=>`<option value="${v}"${mode===v?' selected':''}>${t}</option>`).join('')}</select>`;line.prepend(play);
   const textLabel=document.createElement('label');textLabel.className='audio-text-label';textLabel.textContent='Message';input.before(textLabel);textLabel.appendChild(input);textLabel.hidden=mode==='file';
   const file=line.querySelector('.audfile');file.hidden=mode==='text';if(record.fileName)file.insertAdjacentHTML('afterbegin',`<span>${esc(record.fileName)}</span> `);
   const picker=audioFolder(key+':values','Insert a race value','Definitions and examples',false),vars=AudioCalls.variablesFor(c);audioFolderBody(picker).innerHTML=`<label>Available for this call<select data-audio-value="${key}">${vars.map(k=>`<option value="${k}">{${k}} — ${esc(Announcer.VARS[k]||k)}</option>`).join('')}</select></label><small data-audio-value-example="${key}"></small><button type="button" class="btn" data-audio-insert-selected="${key}"${vars.length?'':' disabled'}>Insert value</button>`;picker.hidden=mode==='file';variation.appendChild(picker);
   variation.insertAdjacentHTML('beforeend',`<p class="audio-example" data-message-preview="${key}" aria-live="polite"></p><small>Matching conditional variations take priority. Otherwise an eligible variation is chosen at random.</small>`);
   if(condition){const test=document.createElement('button');test.type='button';test.className='btn';test.dataset.audioEvent=key;test.textContent='Check conditions with sample data';condition.appendChild(test);}
  });
  const add=inner.querySelector('[data-addline]');add.textContent=ambient?'Add a recording':'Add variation';audioFolderBody(messages).appendChild(add);
  const cool=inner.querySelector('.audcool');if(cool){const repeat=audioFolder(c.id+':repeat','Repeat limits','Only if you need them',false);audioFolderBody(repeat).appendChild(cool);card.appendChild(repeat);}
  inner.remove();audioVariations(box,c.id);
 });
 box.querySelectorAll('i[data-lucide]').forEach(el=>{el.outerHTML=Icons.svg({'audio-lines':'say',megaphone:'say',waves:'wind','sliders-horizontal':'sliders'}[el.dataset.lucide]);});
 box.querySelectorAll('[data-audio-value]').forEach(el=>audioValueExample(box,el));audioSelect(box,d);audioPreview(box,d);audioBalance(box,d);
}
function audioSelect(box,d){
 if(box.nodeType!==1)return;
 const v=audioView,ambient=v.tab==='ambient',defs=ambient?Announcer.AMBIENT:Announcer.CALLS,group=c=>ambient?c.section:AudioCalls.category(c),title=c=>ambient?audioAmbientTitle(c):AudioCalls.title(c),groups=[...new Set(defs.map(group))],defaults=audioDefaults();
 if(!groups.includes(v.category))v.category=groups[0];
 const matches=c=>{const cc=d.calls[c.id]||{},base=defaults.calls[c.id]||{};return (!v.search||(title(c)+' '+c.label+' '+(ambient?c.vars:AudioCalls.variablesFor(c)).join(' ')).toLowerCase().includes(v.search.toLowerCase()))&&(v.filter==='all'||v.filter==='on'&&cc.on!==false||v.filter==='off'&&cc.on===false||v.filter==='new'&&c.added||v.filter==='modified'&&JSON.stringify(cc)!==JSON.stringify(base));};
 const list=defs.filter(c=>matches(c)&&(v.search||group(c)===v.category));if(!list.some(c=>c.id===v.call))v.call=list[0]?.id||'';
 box.querySelector('.audio-finder summary strong').textContent=ambient?'Find a sound event':'Find a call';
 box.querySelector('[data-audio-call-select]').parentElement.firstChild.textContent=ambient?'Sound event':'Call';
 box.querySelector('[data-audio-filter] option[value="all"]').textContent=ambient?'All sound events':'All calls';
 box.querySelector('[data-audio-filter] option[value="new"]').textContent=ambient?'New sound events':'New calls';
 box.querySelector('[data-audio-folder="tools"]>summary strong').textContent=ambient?'Category actions & help':'Call presets & group actions';
 box.querySelector('[data-audio-category-select]').innerHTML=groups.map(g=>`<option${g===v.category?' selected':''}>${esc(g)}</option>`).join('');
 box.querySelector('[data-audio-call-select]').innerHTML=list.length?list.map(c=>`<option value="${c.id}"${v.call===c.id?' selected':''}>${esc(title(c))}${d.calls[c.id]?.on===false?' · Off':''}</option>`).join(''):'<option value="">No matching calls</option>';
 box.querySelector('[data-audio-count]').textContent=`${list.length} ${ambient?'sound events':'calls'}${v.search?' across all categories':' in this category'}.`;
 box.querySelector('[data-audio-explanation]').textContent=v.tab==='mix'?"Choose the commentator's voice, balance calls against background sounds, and decide how long commentary can wait before it becomes outdated.":ambient?'Add your own crowd, engine and pit sounds. They play alongside calls on a separate audio channel. Events without an attached file stay silent.':'Choose a race event, decide when its call is allowed, then write a message or attach a recording.';
 box.querySelectorAll('.audgroup').forEach(el=>{el.open=true;el.hidden=ambient?el.dataset.group!==Announcer.AMBIENT_GROUP:el.dataset.group===Announcer.AMBIENT_GROUP;el.querySelector(':scope > summary').hidden=true;});
 box.querySelectorAll('.ambsection').forEach(el=>{el.open=true;el.querySelector('summary').hidden=true;});box.querySelectorAll('.audcall').forEach(el=>el.hidden=el.dataset.audioCall!==v.call);
 box.querySelectorAll('[data-audio-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.audioTab===v.tab)));
 box.querySelector('.audio-columns').hidden=v.tab==='mix';box.querySelector('.audio-mixer').hidden=v.tab!=='mix';box.querySelector('[data-audio-filter]').value=v.filter;box.querySelector('[data-call-presets]').hidden=ambient;
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
  return html?'<div class="audio-fields">'+html+'</div>':'';
}
