let fails=0, reachedEnd=false; process.on('exit',code=>{ if(code===0&&!reachedEnd){ console.log('FAIL the test stopped before its end (something waited for ever)'); process.exitCode=1; } }); process.on('unhandledRejection',e=>{console.log('UNHANDLED:',e.stack.split('\n').slice(0,6).join('\n'));process.exit(1)});
const vm=require('vm'),fs=require('fs');
const localDay=iso=>{ const d=new Date(iso), two=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+two(d.getMonth()+1)+'-'+two(d.getDate()); }; // (the day as the club sees it: these pages show local dates)
const R=require('path').join(__dirname,'..')+'/';
const schema=require(R+'schema.js');
const els={};
const mk=()=>new Proxy({innerHTML:'',style:{},dataset:{},hidden:false,value:'',checked:false,classList:{add(){},remove(){},toggle(){}},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:562})},
  {get:(t,k)=>k in t?t[k]:(()=>mk()),set:(t,k,v)=>{t[k]=v;return true}});
const document={addEventListener(){},removeEventListener(){},querySelector:()=>mk(),querySelectorAll:()=>[mk(),mk(),mk()],getElementById:id=>els[id]||(els[id]=mk()),documentElement:{dataset:{},style:{props:{},setProperty(k,v){this.props[k]=v}}},body:{contains:()=>true},createElement:()=>mk()};
const store={tracks:[{id:'t1',name:'Living room',lanes:2}],drivers:[],slotcars:[],racesetups:[{id:'r1',name:'Friday',sessionType:'race',track:'t1',laps:10,layout:'',layout2:''}],layouts:[],rowdesigns:[],imagesets:[],audiosets:[],customwidgets:[],sessions:[],laps:[]};
const calls=[];
const exported=[]; let exportResult={saved:true,path:'C:/Reports/x.pdf'};
let bkResult={ok:true,file:'b.json',date:'2026-10-11T10:00:00Z',appVersion:'0.44.0',counts:{tracks:2,layouts:1},laps:30}; const xfer=[]; let importResult={ok:true,file:'my.json',summary:{layouts:{count:1,names:['Main']},tracks:{count:2,names:['A','B']}}};
const opened=[]; const zooms=[]; const customDefs={}; let depsResult={}; const voiceCalls=[]; let voiceHost={ windows:true, os:'win32 10.0.26220', parts:[{title:'Windows registry, Speech_OneCore voices',lines:['MSTTS_V110_enUS_DavidM']},{title:'Windows Runtime voices (name | language | id)',lines:['Microsoft David | en-US | HKEY_LOCAL_MACHINE\\X']}] };
const api={voiceReport:async()=>{voiceCalls.push(1); if(voiceHost instanceof Error) throw voiceHost; return JSON.parse(JSON.stringify(voiceHost));},setZoom:f=>{zooms.push(f)},exportDeps:async()=>depsResult,exportData:async(p,d)=>{xfer.push(['export',p,d]);return {saved:true,path:'C:/x.json',counts:{tracks:1}}},importOpen:async()=>importResult,importApply:async()=>{xfer.push(['apply']);return {layouts:1,tracks:2}},importCancel:async()=>{xfer.push(['cancel'])},backupSave:async()=>{xfer.push(['bksave']);return {saved:true,path:'C:/b.json'}},backupOpen:async()=>bkResult,backupRestore:async()=>{xfer.push(['bkrestore']);return {safety:'C:/s.json'}},backupCancel:async()=>{xfer.push(['bkcancel'])},liveOpen:async()=>{opened.push(1)},exportPdf:async(html,name)=>{exported.push([html,name]);return exportResult},schema:async()=>schema,getSettings:async()=>({theme:'dark'}),setSettings:async p=>{calls.push(['settings',p]);return p},dbPath:async()=>'x',
  list:async e=>JSON.parse(JSON.stringify(store[e]||[])),customFields:async e=>customDefs[e]||[],linkedLaps:async()=>0,
  add:async(e,item)=>{const row={...item,id:'L'+(store[e].length+1)};store[e].push(row);calls.push(['add',e,item]);return row},
  update:async(e,id,p)=>{calls.push(['update',e,id,p]);const r=store[e].find(x=>x.id===id);Object.assign(r,p);return r},
  remove:async(e,id)=>{store[e]=store[e].filter(x=>x.id!==id)}};
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
// the real app passes everything through Electron's structured clone, which refuses a function ("An object could not be cloned"): every call of the app interface is checked the same way here
for (const k of Object.keys(api)) { const f = api[k]; if (typeof f === 'function') api[k] = (...x) => { x.forEach(v => { if (typeof v !== 'function') structuredClone(v); }); return f(...x); }; }
const ctx=vm.createContext({document,api,console: appConsole,Intl,URL,Image:function(){},confirm:()=>true,alert(){},setTimeout,clearTimeout,setInterval,clearInterval,performance,});
const listeners={}; ctx.window=ctx; ctx.addEventListener=(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)}; ctx.removeEventListener=(t,f)=>{listeners[t]=(listeners[t]||[]).filter(x=>x!==f)};
const errors=[];
for(const f of ['listnum.js', 'bop.js', 'weather.js', 'endurance.js', 'damage.js', 'engine.js','heats.js', 'rotation.js', 'tokens.js','speed.js', 'distance.js','stats.js','homestats.js','carstats.js','viewset.js','picture.js','uiscale.js','theme.js','banner.js','icons.js','delta.js','avatars.js', 'weatherwidgets.js', 'boardorder.js', 'widgets.js','frame.js','backdrop.js','announcer.js','sound.js','timing.js','rows.js','richtext.js','canvas.js','liveshare.js','review.js','adjustpad.js', 'adjustui.js', 'dirfolder.js', 'penaltyui.js', 'rotationdrag.js','padui.js','livegrid.js', 'homegrid.js', 'drivergrid.js', 'homecards.js', 'liveview.js','report.js','database.js','landing.js','race.js','undo.js','editor.js','tokenui.js', 'bopui.js', 'weatherui.js', 'tyreui.js', 'rotationui.js', 'audioedit.js','widgetbuilder.js','transferui.js','themeui.js','help.js','hardware.js','trackmate.js','hardwareui.js','zipfile.js','arduinosketch.js','arduinobox.js','arduinosim.js','arduinorace.js','arduinoui.js','dsui.js','app.js']){
  try{vm.runInContext(fs.readFileSync(R+'renderer/'+f,'utf8'),ctx,{filename:f})}catch(e){errors.push(f+': '+e.message)}
}
const run=s=>vm.runInContext(s,ctx), E=id=>document.getElementById(id);
const realResize=ctx.resizeImage; // (some tests below replace it; this one is the page's own)
const say=(m,c)=>{console.log((c?'ok   ':'FAIL ')+m); if(!c)fails++;};
(async()=>{
  await new Promise(r=>setTimeout(r,50));
  say('all scripts load without errors', errors.length===0); if(errors.length)console.log(errors);
  // Race Setup tab
  run("state.tab='setup'"); await run('render()');
  say('Race Setup tab: race setups list with add button', E('setupmgr').innerHTML.includes('id="add"') && !E('view').innerHTML.includes('Layouts'));
  run("openForm('racesetups', null)");
  const form=E('dlg').innerHTML;
  say('race setup form: layout choices per screen', form.includes('id="f-layout"')&&form.includes('id="f-layout2"')&&form.includes('Default layout')&&form.includes('Same as main screen'));
  run("openForm('tracks', null)"); await new Promise(r=>setTimeout(r,20));
  say('the track form only accepts whole numbers of lanes from 1 up, and other numbers stay free', E('dlg').innerHTML.includes('id="f-lanes" type="number" step="1" min="1"') && E('dlg').innerHTML.includes('id="f-minLap" type="number" step="any" min="0"'));
  { const f=E('dlg').innerHTML, at=k=>f.indexOf('data-key="'+k+'"');
    say('the track form has a Lane length modifier choice (None, Calculated from the bends, Measured), after the track length', f.includes('id="f-laneModifier"') && ['None: every lane has the track length','Calculated from the bends','Measured: I enter the length of every lane'].every(t=>f.includes(t)) && at('length')<at('laneModifier') && at('laneModifier')<at('outsideLane') && at('outsideLane')<at('laneSpacing') && at('laneSpacing')<at('netTurns') && at('netTurns')<at('laneLengths') && /value="none" selected/.test(f));
    say('...the lane spacing hint says what the 6.3 means: the distance shorter, not 6.3 times shorter', f.includes('2 \u00d7 \u03c0 (about 6.3) times this distance shorter for every full turn of the track: 100 mm gives 0.63 m shorter per lane on a loop') && !f.includes('about 6.3 times this distance shorter: 100 mm gives 0.63 m per lane'));
    say('...the full turns field says that the angle counts, not the number of bends', /id="f-netTurns" type="number" step="1" min="0"/.test(f) && f.includes('not how many there are') && f.includes('0 is a figure-eight'));
    say('...and a list for the measured length of every lane', f.includes('id="f-laneLengths"') && f.includes('Length of every lane (metres), lane 1 first') && f.includes('for example 15.4, 15.8, 16.2'));
    const shown=(key,mod)=>run(`isShown(state.schema.tracks.fields.find(f=>f.key==='${key}'), k=>({laneModifier:'${mod}'})[k])`);
    say('which fields show: with None nothing more; Calculated shows the outside lane, spacing and full turns; Measured shows the list', ['outsideLane','laneSpacing','netTurns','laneLengths'].every(k=>!shown(k,'none')) && ['outsideLane','laneSpacing','netTurns'].every(k=>shown(k,'bends')) && !shown('laneLengths','bends') && ['outsideLane','laneSpacing','netTurns'].every(k=>!shown(k,'measured')) && shown('laneLengths','measured'));
    run("openForm('tracks', {id:'old1', name:'Old oval', lanes:2, length:10, laneSpacing:100})"); await new Promise(r=>setTimeout(r,20));
    const o=E('dlg').innerHTML;
    say('a track saved before the modifier opens as Calculated with 1 turn (it was a loop), so saving it again changes nothing', /<option value="bends" selected>/.test(o) && !/<option value="none" selected>/.test(o) && /id="f-netTurns"[^>]*value="1"/.test(o));
    run("openForm('tracks', {id:'old2', name:'Old eight', lanes:2, length:10, trackShape:'figure8'})"); await new Promise(r=>setTimeout(r,20));
    say('a track saved with 0.60.0\'s figure-eight shape opens as None', /<option value="none" selected>/.test(E('dlg').innerHTML));
    run("openForm('tracks', {id:'old3', name:'Pick', lanes:3, length:16, laneModifier:'measured', laneLengths:'15.4, 15.8, 16.2'})"); await new Promise(r=>setTimeout(r,20));
    say('a track with measured lengths opens as Measured, with its list', /<option value="measured" selected>/.test(E('dlg').innerHTML) && E('dlg').innerHTML.includes('value="15.4, 15.8, 16.2"'));
    // saving: the number of measured lengths has to match the lanes
    const prevAdd=api.add, prevUpd=api.update, got=[]; api.update=async(en,id,d)=>{got.push([en,id,d]);return {};};
    const stand=['f-name','f-lanes','f-laneModifier','f-length','f-laneLengths'], keepVals=stand.map(id=>document.getElementById(id).value);
    { const set=(id,v)=>{ document.getElementById(id).value=v; }; set('f-name','Pick'); set('f-lanes','3'); set('f-laneModifier','measured'); set('f-length','16'); } // (the stand-in for the window does not read the form's own values)
    document.getElementById('f-laneLengths').value='15.4, 15.8'; await document.getElementById('frm').onsubmit({preventDefault(){}});
    say('Measured with too few lengths is refused with a clear message, nothing is saved', document.getElementById('err').textContent.includes('3 numbers above 0') && document.getElementById('err').textContent.includes('you entered 2') && got.length===0);
    document.getElementById('f-laneLengths').value='15.4, 15.8, x'; await document.getElementById('frm').onsubmit({preventDefault(){}});
    say('...a length that is not a number is refused too', got.length===0 && document.getElementById('err').textContent.length>0);
    document.getElementById('f-laneLengths').value='15.4, 15.8, 16.2'; await document.getElementById('frm').onsubmit({preventDefault(){}});
    say('...with one length per lane it is saved', got.length===1 && got[0][2].laneModifier==='measured' && got[0][2].laneLengths==='15.4, 15.8, 16.2' && got[0][2].lanes===3);
    api.update=prevUpd; api.add=prevAdd; stand.forEach((id,i)=>{ document.getElementById(id).value=keepVals[i]; }); }
  // 1.30.0: the Statistics folder of a slotcar: Service Interval, Laps Driven, Laps Since Last Interval with Reset, Last Serviced and the Mileage
  { const prevList=api.list, prevAdd=api.add, prevUpd=api.update, got=[], wait=()=>new Promise(r=>setTimeout(r,20)), el=id=>document.getElementById(id);
    const T=[{id:'t1',name:'Oval',length:20,lanes:2},{id:'t2',name:'Bare',lanes:2},{id:'t3',name:'Short',length:5,lanes:1,deslotTime:1.5}], LP=[{carId:'c1',trackId:'t1',time:10,date:'2026-01-01T10:00:00Z'},{carId:'c1',trackId:'t1',time:11,date:'2026-01-01T10:00:00Z'},{carId:'c2',trackId:'t1',time:10},{carId:'c1',trackId:'t2',time:12},
      {carId:'c5',trackId:'t3',time:2000,sessionId:'s5',date:'2026-04-01T10:00:00.000Z'},{carId:'c5',trackId:'t3',time:1400,sessionId:'s5',date:'2026-04-01T10:00:00.000Z'},{carId:'c5',trackId:'t1',time:3000,sessionId:'s1',date:'2026-01-01T10:00:00.000Z'},{carId:'c5',trackId:'t1',time:100,sessionId:'s6',token:true,date:'2026-05-01T10:00:00.000Z'}],
    SS=[{id:'s1',sessionType:'race',standings:[{carId:'c5',pos:2,laps:1}]},{id:'s5',sessionType:'race',standings:[{carId:'c5',pos:1,laps:2}]},{id:'s6',sessionType:'tokens',standings:[{carId:'c5',pos:1,laps:2}]}];
    let listed=[]; api.list=async n=>{ listed.push(n); return n==='laps'?LP:n==='tracks'?T:n==='sessions'?SS:[]; }; api.update=async(en,id,d)=>{got.push([en,id,d]);return {};}; api.add=async(en,d)=>{got.push([en,'',d]);return {};};
    const car={id:'c1',brand:'Slot.it',model:'956',lapsDriven:50,lapsSinceService:12,serviceInterval:300,serviceDate:'2026-03-01T12:00:00.000Z'};
    run('delete formOpen.slotcars'); el('f-serviceInterval').value='300'; run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait(); // (the stand-in for the window does not put the saved values in the fields: the interval is typed in first)
    let f=E('dlg').innerHTML, at=k=>f.indexOf('data-key="'+k+'"');
    say('the Statistics folder of a slot car has, in this order: Service Interval, Laps Driven, Laps Since Last Interval, Last Serviced, Services Done, Mileage, Mileage Since Last Service, Last Driven, Sessions Driven, Wins, Deslots, Fastest Lap Ever and Best Lap per Track', ['serviceInterval','lapsDriven','lapsSinceService','serviceDate','servicesDone','_mileage','_mileageSince','_lastDriven','_sessions','_wins','_deslots','_fastest','_byTrack'].every((k,i,a)=>at(k)>0 && (!i || at(k)>at(a[i-1]))) && at('serviceInterval')>f.indexOf('data-fg="stats"'));
    say('...the words under Laps Since Last Interval have their place in the form (the screen writes them there)', f.includes('id="svc-note"') && (f.match(/id="svc-note"/g)||[]).length===1);
    say('...a day that is not a date shows as nothing (Last Serviced of a car with a wrong date), and a day is written as day, month and year', run("plainDate('nonsense')")==='' && run("plainDate('')")==='' && run("plainDate(undefined)")==='' && /2026/.test(run("plainDate('2026-03-01T12:00:00.000Z')")) && /^\D*\d{1,2}\D+2026$|^\D*2026\D*$|2026/.test(run("plainDate('2026-03-01T12:00:00.000Z')")));
    say('...with those names (Laps Driven now with capitals)', ['Service Interval','Laps Driven','Laps Since Last Interval','Last Serviced','Services Done','Mileage','Mileage Since Last Service','Last Driven','Sessions Driven','Wins','Deslots','Fastest Lap Ever','Best Lap per Track'].every(l=>f.includes('<label for="f-'+({'Service Interval':'serviceInterval','Laps Driven':'lapsDriven','Laps Since Last Interval':'lapsSinceService','Last Serviced':'serviceDate','Services Done':'servicesDone','Mileage':'_mileage','Mileage Since Last Service':'_mileageSince','Last Driven':'_lastDriven','Sessions Driven':'_sessions','Wins':'_wins','Deslots':'_deslots','Fastest Lap Ever':'_fastest','Best Lap per Track':'_byTrack'})[l]+'">'+l)) && !f.includes('Laps driven'));
    say('...the Service Interval is a number you can type (whole laps from 1, optional) and has 300', /id="f-serviceInterval" type="number" step="1" min="1" value="300"/.test(f) && /data-key="serviceInterval"[^]*?\(optional\)/.test(f));
    say('...Laps Driven, Laps Since Last Interval, Last Serviced, Services Done and all the worked-out figures are shown but cannot be typed over', ['lapsDriven','lapsSinceService','serviceDate','servicesDone','_mileage','_mileageSince','_lastDriven','_sessions','_wins','_deslots','_fastest'].every(k=>new RegExp('id="f-'+k+'"[^>]*disabled').test(f)));
    say('...Services Done of a car that was serviced before the count existed is 1 (its Last Serviced tells), and the table of the tracks is a box the screen fills in', /id="f-servicesDone" type="number" value="1" disabled/.test(f) && f.includes('id="f-_byTrack" class="svc-tracks-box"') && (f.match(/id="f-_byTrack"/g)||[]).length===1 && f.includes('<div class="field full" data-key="_byTrack">'));
    say('...every worked-out figure has its hint (what it counts), the table too', ['_mileage','_mileageSince','_lastDriven','_sessions','_wins','_deslots','_fastest','_byTrack'].every(k=>{ const i=f.indexOf('data-key="'+k+'"'); return i>0 && /class="muted hint"/.test(f.slice(i, i+900)); }));
    say('...Laps Since Last Interval shows 12, and has the button that starts the count again', /id="f-lapsSinceService" type="number" value="12" disabled/.test(f) && f.includes('data-svcreset="1"') && f.includes('data-svcreset="1">Reset</button>') && (f.match(/data-svcreset/g)||[]).length===1);
    say('...Last Serviced shows the day (1 Mar 2026)', /id="f-serviceDate" type="text" value="[^"]*2026[^"]*" disabled/.test(f) && !f.includes('2026-03-01T12:00'));
    say('...the form says how many laps are left until the next service (300 minus 12 is 288), and that there is no service due', el('svc-note').textContent==='288 laps to go until the next service (the interval is 300 laps).' && el('svc-note').classList!==undefined);
    say('...the Mileage is worked out from the laps and the tracks of the database (2 laps of the 20 m track: 40 m; the lap on the track without a length and the laps of another car are left out)', listed.includes('laps') && listed.includes('tracks') && el('f-_mileage').value==='40 m');
    say('...nothing about it is a field of the slot car that is saved: the Mileage is not in the form fields that are kept', !run("state.schema.slotcars.fields.some(f=>f.key==='_mileage')"));
    // 1.33.0: the figures worked out from the laps, the sessions and the tracks
    say('...the other figures of the car are worked out from the sessions too (the sessions are read as well)', listed.includes('sessions') && !run("state.schema.slotcars.fields.some(f=>f.key.startsWith('_'))"));
    const put=(id,v)=>{ el(id).value=v; };
    { const c5={id:'c5',brand:'Scalex',model:'GT',lapsDriven:10,lapsSinceService:4,serviceInterval:300,servicesDone:2,serviceDate:'2026-03-01T12:00:00.000Z'};
      run('delete formOpen.slotcars'); run(`openForm('slotcars', ${JSON.stringify(c5)})`); await wait(); const f5=E('dlg').innerHTML;
      say('Services Done shows the count that is kept (2)', /id="f-servicesDone" type="number" value="2" disabled/.test(f5));
      say('Mileage is 30 m (the token lap is left out), and Mileage Since Last Service is the 2 laps of the 5 m track after the service day: 10 m', el('f-_mileage').value==='30 m' && el('f-_mileageSince').value==='10 m');
      say('Last Driven is the day of the last lap (1 Apr 2026, not the token lap of May), Sessions Driven are 2 (the Time Token Session is not counted) and Wins are 1', el('f-_lastDriven').value===run("plainDate('2026-04-01T10:00:00.000Z')") && /2026/.test(el('f-_lastDriven').value) && el('f-_sessions').value==='2' && el('f-_wins').value==='1');
      say('Deslots are the laps slower than the deslot time of their track (the 2.000 s lap on the 1.5 s track: 1)', el('f-_deslots').value==='1');
      say('Fastest Lap Ever is the best lap and its track', el('f-_fastest').value==='1.400 on Short');
      const tb=el('f-_byTrack').innerHTML;
      say('Best Lap per Track is a table with the laps, the best lap and the average of every track (Short 2, 1.400, 1.700; Oval 1, 3.000, 3.000), the track with the most laps first', tb.includes('<th>Track</th><th>Laps</th><th>Best</th><th>Average</th>') && tb.includes('<td>Short</td><td>2</td><td>1.400</td><td>1.700</td>') && tb.includes('<td>Oval</td><td>1</td><td>3.000</td><td>3.000</td>') && tb.indexOf('Short')<tb.indexOf('Oval') && !tb.includes('Bare'));
      say('...an unknown time or a track name is safe text in it', run("carTracksHtml({tracks:[{name:'<b>x</b>',laps:1,best:1000,avg:1000}]})").includes('&lt;b&gt;x&lt;/b&gt;') && run("carTracksHtml({tracks:[{name:'',laps:1,best:1000,avg:1000}]})").includes('<td>–</td>') && run("carTracksHtml({tracks:[]})").includes('No valid laps yet.'));
      say('Mileage in the miles-and-feet setting shows the other figures as before (the times and the counts do not change with the distance unit)', (run("state.settings.distanceUnit='ft'"), run(`openForm('slotcars', ${JSON.stringify(c5)})`), await wait(), el('f-_mileage').value==='98 ft' && el('f-_mileageSince').value==='33 ft' && el('f-_fastest').value==='1.400 on Short' && el('f-_wins').value==='1'));
      run("state.settings.distanceUnit=undefined");
      // Reset: Services Done goes up by one and the distance since the service starts again at 0, at once
      run(`openForm('slotcars', ${JSON.stringify(c5)})`); await wait(); await E('dlg').onclick({target:{closest:()=>({id:'',dataset:{svcreset:'1'}})}});
      say('Reset shows Services Done 3 at once, and the mileage since the service as 0 m', el('f-servicesDone').value===3 && el('f-_mileageSince').value==='0 m' && el('f-_mileage').value==='30 m');
      got.length=0; put('f-brand','Scalex'); put('f-model','GT'); put('f-serviceInterval','300'); await el('frm').onsubmit({preventDefault(){}});
      say('...and when the form is saved Services Done is 3', got.length===1 && got[0][1]==='c5' && got[0][2].servicesDone===3 && got[0][2].lapsSinceService===0 && !('_wins' in got[0][2]) && !('_byTrack' in got[0][2]) && !('_fastest' in got[0][2]) && !('_mileageSince' in got[0][2]) && !Object.keys(got[0][2]).some(k=>k.startsWith('_')));
      // when Reset is pressed before the laps are read, the distance since the service still ends at 0 m
      let release; const gate=new Promise(r=>{ release=r; }); const keepList=api.list; api.list=async n=>{ await gate; return keepList(n); };
      run(`openForm('slotcars', ${JSON.stringify(c5)})`); await E('dlg').onclick({target:{closest:()=>({id:'',dataset:{svcreset:'1'}})}}); release(); await wait(); api.list=keepList;
      say('...also when the laps are read after Reset was pressed', el('f-_mileageSince').value==='0 m' && el('f-_mileage').value==='30 m' && el('f-servicesDone').value===3);
      run(`openForm('slotcars', ${JSON.stringify(c5)})`); await wait(); got.length=0; put('f-brand','Scalex'); put('f-model','GT'); put('f-serviceInterval','300'); await el('frm').onsubmit({preventDefault(){}});
      say('Saving without Reset does not send Services Done', got.length===1 && !('servicesDone' in got[0][2]));
    }
    run('delete formOpen.slotcars'); el('f-serviceInterval').value='300'; run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait(); // (back to the form of the first car, for the tests that follow)
    // a car that was serviced before the count existed: Reset makes it 2
    run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait(); await E('dlg').onclick({target:{closest:()=>({id:'',dataset:{svcreset:'1'}})}}); got.length=0; put('f-brand','Slot.it'); put('f-model','956'); put('f-serviceInterval','300'); await el('frm').onsubmit({preventDefault(){}});
    say('a car that was serviced before the count existed (it has a day of service) is at 2 services after Reset, and a car that was never serviced is at 1', got.length===1 && got[0][2].servicesDone===2);
    run(`openForm('slotcars', ${JSON.stringify({id:'c7',brand:'Fresh',lapsDriven:3})})`); await wait(); await E('dlg').onclick({target:{closest:()=>({id:'',dataset:{svcreset:'1'}})}}); got.length=0; put('f-brand','Fresh'); put('f-serviceInterval','300'); await el('frm').onsubmit({preventDefault(){}});
    say('...(a car that was never serviced: 1 service after Reset)', got.length===1 && got[0][2].servicesDone===1);
    run('delete formOpen.slotcars'); el('f-serviceInterval').value='300'; run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait();
    // the interval can be changed while the form is open: the words follow (a service due is said in the colour of a warning)
    let due=null; el('svc-note').classList={toggle:(c,on)=>{ due=[c,on]; }};
    el('f-serviceInterval').value='12'; E('dlg').oninput({target:{id:'f-serviceInterval'}}); const dueNow=due;
    say('typing a service interval of 12 makes the service due (12 of 12), and the words say so, in the colour of a warning', el('svc-note').textContent==='Service due: 12 laps since the last service, the interval is 12 laps.' && dueNow && dueNow[0]==='due' && dueNow[1]===true);
    el('f-serviceInterval').value=''; E('dlg').oninput({target:{id:'f-serviceInterval'}});
    say('...an empty interval: no service interval is set, and no warning', el('svc-note').textContent==='No service interval is set.' && due[1]===false);
    el('f-serviceInterval').value='300'; E('dlg').oninput({target:{id:'f-serviceInterval'}});
    // Reset: shown at once, kept when the form is saved
    got.length=0; const set=(id,v)=>{ el(id).value=v; }; set('f-brand','Slot.it'); set('f-model','956'); set('f-scale',''); set('f-motor',''); set('f-tyres',''); set('f-gearing',''); set('f-weight',''); set('f-damageFactor','1'); set('f-tyreCompound','D');
    await el('frm').onsubmit({preventDefault(){}});
    say('saving the form without Reset does not touch the counts: only the interval is sent, with the other settings', got.length===1 && got[0][0]==='slotcars' && got[0][1]==='c1' && got[0][2].serviceInterval===300 && !('lapsSinceService' in got[0][2]) && !('serviceDate' in got[0][2]) && !('lapsDriven' in got[0][2]) && !('_mileage' in got[0][2]));
    run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait();
    const t0=Date.now(); await E('dlg').onclick({target:{closest:()=>({id:'',dataset:{svcreset:'1'}})}});
    say('Reset shows 0 at once, today as the day, and says when it is kept', el('f-lapsSinceService').value===0 && el('f-serviceDate').value!==undefined && String(el('f-serviceDate').value).includes(String(new Date().getFullYear())) && el('svc-note').textContent==='300 laps to go until the next service (the interval is 300 laps). The count starts again at 0 when you save.');
    got.length=0; set('f-brand','Slot.it'); set('f-model','956'); set('f-serviceInterval','300'); await el('frm').onsubmit({preventDefault(){}});
    say('...and when the form is saved the count is 0 and the day is now (an ISO date and time between the press and now)', got.length===1 && got[0][2].lapsSinceService===0 && typeof got[0][2].serviceDate==='string' && Date.parse(got[0][2].serviceDate)>=t0-5 && Date.parse(got[0][2].serviceDate)<=Date.now()+5 && !('lapsDriven' in got[0][2]));
    run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait(); got.length=0; set('f-brand','Slot.it'); set('f-model','956'); set('f-serviceInterval','300');
    await el('frm').onsubmit({preventDefault(){}});
    say('...a form that is opened again after pressing Reset and cancelling starts clean (nothing is reset unless Save follows the button in the same form)', got.length===1 && !('lapsSinceService' in got[0][2]) && !('serviceDate' in got[0][2]));
    // the interval is a whole number of laps from 1
    run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait(); got.length=0; set('f-brand','Slot.it'); set('f-model','956');
    set('f-serviceInterval','250.7'); await el('frm').onsubmit({preventDefault(){}}); const frac=got.length&&got[0][2].serviceInterval;
    got.length=0; set('f-serviceInterval','0'); await el('frm').onsubmit({preventDefault(){}}); const zero=got.length&&got[0][2].serviceInterval;
    got.length=0; set('f-serviceInterval',''); await el('frm').onsubmit({preventDefault(){}}); const none=got.length&&got[0][2].serviceInterval;
    say('saving: a service interval of 250.7 becomes 250 laps, 0 becomes 1, and an empty one stays empty (no interval)', frac===250 && zero===1 && none==='');
    // a new car: no counts to reset, nothing to work out
    listed=[]; run('delete formOpen.slotcars'); run("openForm('slotcars', null)"); await wait(); f=E('dlg').innerHTML;
    say('a new slot car: Laps Driven and Laps Since Last Interval are 0, Last Serviced says Never, the Mileage is 0 m without looking at the laps', /id="f-lapsDriven" type="number" value="0" disabled/.test(f) && /id="f-lapsSinceService" type="number" value="0" disabled/.test(f) && /id="f-serviceDate" type="text" value="Never" disabled/.test(f) && el('f-_mileage').value==='0 m' && !listed.includes('laps'));
    say('...a new slot car has no figures of races yet: Services Done 0, no distance since a service, Never driven, no sessions, wins or deslots, no fastest lap, and no valid laps for the table', /id="f-servicesDone" type="number" value="0" disabled/.test(f) && el('f-_mileageSince').value==='0 m' && el('f-_lastDriven').value==='Never' && el('f-_sessions').value==='0' && el('f-_wins').value==='0' && el('f-_deslots').value==='0' && el('f-_fastest').value==='–' && el('f-_byTrack').innerHTML.includes('No valid laps yet.') && !listed.includes('sessions') && !listed.includes('tracks'));
    say('...and says there is no service interval until one is typed', el('svc-note').textContent==='No service interval is set.');
    set('f-brand','New'); set('f-serviceInterval',''); got.length=0; await el('frm').onsubmit({preventDefault(){}});
    say('...saving it starts the counts at 0, without a day of service (and Reset is not needed)', got.length===1 && got[0][0]==='slotcars' && got[0][1]==='' && got[0][2].lapsDriven===0 && got[0][2].lapsSinceService===0 && got[0][2].serviceDate==='' && got[0][2].servicesDone===0 && !('_mileage' in got[0][2]));
    // a car from before 1.30.0 (no count of its own): all its laps count
    run(`openForm('slotcars', ${JSON.stringify({id:'c3',brand:'Old',lapsDriven:80})})`); await wait(); f=E('dlg').innerHTML;
    say('a car without a count of the laps since the last service shows all its laps driven (80), and Last Serviced says Never', /id="f-lapsSinceService" type="number" value="80" disabled/.test(f) && /id="f-serviceDate" type="text" value="Never" disabled/.test(f));
    // the mileage in the miles-and-feet setting, and a track without a length
    run("state.settings.distanceUnit='ft'"); run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait();
    say('the Mileage follows the distance unit of the display settings (feet and miles: 131 ft)', el('f-_mileage').value==='131 ft'); run("state.settings.distanceUnit=undefined");
    T[0]={id:'t1',name:'Oval',lanes:2}; run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait();
    say('...with no track length known the distance is a dash', el('f-_mileage').value==='–'); T[0]={id:'t1',name:'Oval',length:20,lanes:2};
    api.list=async n=>{ throw new Error('no'); }; run(`openForm('slotcars', ${JSON.stringify(car)})`); await wait();
    say('...and a dash when the laps cannot be read (the form still opens)', el('f-_mileage').value==='–' && E('dlg').innerHTML.includes('id="f-serviceInterval"'));
    say('...all the other figures and the table are a dash too', ['_mileageSince','_lastDriven','_sessions','_wins','_deslots','_fastest'].every(k=>el('f-'+k).value==='–') && el('f-_byTrack').textContent==='–');
    api.list=prevList; api.add=prevAdd; api.update=prevUpd; }
  // 1.20.0: the race setup form has an Adjust pads folder: the values of the five pads for this setup
  { run("openForm('racesetups', {id:'pads1', name:'Pads', sessionType:'race', padPoints:'3, 1, 10, 1', padLaps:''})"); await new Promise(r=>setTimeout(r,20));
    const f=E('dlg').innerHTML, i0=f.indexOf('Adjust pads');
    say('the race setup form has an Adjust pads group (after Yellow flag, before Screens and sound) with a field for each pad', i0>f.indexOf('Yellow flag') && i0<f.indexOf('Screens and sound') && ['padPoints','padDamage','padSeconds','padLaps','padChamp'].every(k=>f.includes('id="f-'+k+'"')) && f.includes('Penalty points pad') && f.includes('Time pad (seconds)') && f.includes('Championship points pad'));
    say('...a setup shows the list it has of its own, and the other fields are empty, with the group saying that an empty field uses the App Settings values', f.includes('value="3, 1, 10, 1"') && /id="f-padLaps"[^>]*value=""/.test(f) && /id="f-padLaps"[^>]*placeholder="Empty: the App Settings values"/.test(f) && f.includes('An empty field uses the values from App Settings, Race Director.'));
    const prevAdd=api.add, prevUpd=api.update, got=[]; api.update=async(en,id,d)=>{got.push([en,id,d]);return {};}; api.add=async(en,d)=>{got.push([en,'',d]);return {};};
    const set=(id,v)=>{ document.getElementById(id).value=v; }, keep=['f-name','f-sessionType','f-padPoints','f-padLaps','f-padSeconds'].map(id=>document.getElementById(id).value);
    set('f-name','Pads'); set('f-sessionType','race'); set('f-padPoints','3, 1, 10, 1'); set('f-padLaps',''); set('f-padSeconds','');
    await document.getElementById('frm').onsubmit({preventDefault(){}});
    const rs=got[got.length-1]&&got[got.length-1][2];
    say('saving tidies the list of a pad (sorted, no doubles) and leaves the other pads empty (the App Settings values)', got.length===1 && got[0][0]==='racesetups' && rs.padPoints==='1, 3, 10' && rs.padLaps==='' && rs.padSeconds==='' && rs.padDamage==='' && rs.padChamp==='');
    set('f-padSeconds','2.5, five'); got.length=0; await document.getElementById('frm').onsubmit({preventDefault(){}});
    say('...a mistake between numbers is left out (2.5 stays), and the time pad keeps its decimals', got.length===1 && got[0][2].padSeconds==='2.5');
    set('f-padLaps','many'); got.length=0; await document.getElementById('frm').onsubmit({preventDefault(){}});
    say('text without a single usable number is refused with a clear message and nothing is saved', got.length===0 && document.getElementById('err').textContent.includes('numbers above zero') && document.getElementById('err').textContent.includes('App Settings'));
    api.update=prevUpd; api.add=prevAdd; ['f-name','f-sessionType','f-padPoints','f-padLaps','f-padSeconds'].forEach((id,k)=>{ document.getElementById(id).value=keep[k]; }); }
  // Layouts sub-tab
  run("state.tab='custom'; state.customSub='layouts'"); await run('render()');
  const lst=E('setupbox').innerHTML;
  say('layouts list: built-in default with a copy button', lst.includes('Default layout')&&lst.includes('id="copydef"')&&lst.includes('id="newl"'));
  say('layouts list: the built-in token layout has its own copy button', lst.includes('Default token layout') && lst.includes('id="copytok"'));
  await E('setupbox').onclick({target:{closest:()=>({id:'copytok',dataset:{}})}}); await new Promise(r=>setTimeout(r,20));
  say('...copying it opens the editor with its widgets: a Token Clock for every lane', run("state.editing.draft.widgets.filter(w=>w.type==='tokenclock').length")===8 && run('state.editing.draft.name')==='My token layout' && run("state.editing.draft.widgets.some(w=>w.type==='textlane'&&w.opt.text==='Lane {lane}')"));
  run('editorLeave()'); run("state.tab='custom'; state.customSub='layouts'"); await run('render()');
  // copy default -> editor
  await E('setupbox').onclick({target:{closest:()=>({id:'copydef',dataset:{}})}}); await new Promise(r=>setTimeout(r,20));
  const ed=E('view').innerHTML;
  say('editor opens: toolbar, palette, canvas, side panel', ed.includes('id="e-name"')&&ed.includes('id="canvas"')&&ed.includes('data-add="bestlap"')&&ed.includes('id="side"'));
  say('palette groups are folders, Race on top: Race, Driver, Slotcar, Timing, Timing Records, Delta Timers, Controls (closed to begin with)', ed.indexOf('data-pal="Race"')<ed.indexOf('data-pal="Driver"') && ed.indexOf('data-pal="Timing Records"')<ed.indexOf('data-pal="Delta Timers"') && ed.indexOf('data-pal="Delta Timers"')<ed.indexOf('data-pal="Controls"') && ['Driver','Slotcar','Timing','Timing Records','Delta Timers','Race','Controls'].every(g=>ed.includes('data-pal="'+g+'"><summary>'+g+'</summary>')) && !ed.includes('data-pal="Driver" open'));
  const canvas=E('canvas').innerHTML;
  say('canvas shows the default layout widgets ('+(canvas.match(/class="lw[ "]/g)||[]).length+')', (canvas.match(/class="lw[ "]/g)||[]).length===57);
  say('snapping is on by default', run('state.editing.snap')===true);
  // add, adjust, save
  say('nothing changed yet -> not dirty (copy of default counts as new)', run('editorDirty()')===true);
  run("editorAdd('clock')");
  say('added widget is selected and drawn', run('state.editing.draft.widgets.length')===58 && E('side').innerHTML.includes('Race clock') && E('side').innerHTML.includes('Text colour'));
  E('side').oninput({target:{id:'s-size',value:'45',type:'number',dataset:{}}});
  say('text size setting applies', run('state.editing.draft.widgets[57].textSize')===45 && E('canvas').innerHTML.includes('font-size:4.5cqw'));
  E('side').oninput({target:{dataset:{color:'bgColor'},value:'#112233',type:'color'}});
  say('background colour setting applies', run('state.editing.draft.widgets[57].bgColor')==='#112233' && E('canvas').innerHTML.includes('background:#112233'));
  E('side').onchange({target:{dataset:{theme:'bgColor'},checked:true}});
  say('"theme default" clears the colour', run('state.editing.draft.widgets[57].bgColor')==='');
  // widget settings: grouped like folders, border shade and transparency
  { const side=E('side').innerHTML, at=g=>side.indexOf('data-side="'+g+'"');
    say('the settings are grouped: Title, then Text, then Background and border', at('title')>=0 && at('title')<at('text') && at('text')<at('frame') && side.includes('<summary>Background and border</summary>') && side.includes('<summary>Title</summary>') && side.includes('<summary>Text</summary>'));
    say('every setting is still there under its own id', ['s-title','s-showtitle','s-tsize','s-tbold','s-tspace','s-vbold','s-vital','s-size','s-bmode','s-bshade','s-trans'].every(i=>side.includes('id="'+i+'"')) && side.includes('data-color="textColor"') && side.includes('data-color="bgColor"'));
    say('Duplicate and Remove stay below the groups', side.indexOf('id="s-dup"')>at('frame') && side.indexOf('id="s-del"')>side.indexOf('id="s-dup"'));
    say('1.29.1: the groups start closed (a long list of settings is not what you see first): none of them has the open attribute', !/<details class="sidegroup" data-side="[a-z]+" open>/.test(side) && (side.match(/<details class="sidegroup" data-side="[a-z]+">/g)||[]).length>=4); }
  // folders remember how you left them (1.29.1: the ones you opened)
  run("state.sideOpen.add('title')"); E('side').innerHTML=run('sideHtml()');
  say('a folder that was opened stays open for the next widget, the others stay closed', /<details class="sidegroup" data-side="title" open>/.test(E('side').innerHTML) && /<details class="sidegroup" data-side="text">/.test(E('side').innerHTML) && /<details class="sidegroup" data-side="opts">/.test(E('side').innerHTML));
  run("state.sideOpen.delete('title')"); E('side').innerHTML=run('sideHtml()');
  { // 1.29.1: the settings folders remember how you left them, and the widget list and the settings panel are as tall as the window leaves room for (the page itself never gets a scrollbar from them)
    const panel=cls=>({classList:{contains:c=>c===cls},style:{}}), pal=panel('ed-pal'), side=panel('ed-side'), stage=panel('ed-stage');
    const page={}, form={parentElement:page}, mainEl={children:[pal,stage,side],parentElement:form,getBoundingClientRect:()=>({top:mainEl.top})};
    const saved={q:document.querySelector,iH:ctx.innerHeight,iW:ctx.innerWidth,gcs:ctx.getComputedStyle,body:document.body};
    const fake=(gcs)=>{ document.querySelector=sel=>(sel==='.ed-main'?mainEl:saved.q(sel)); document.body=page; ctx.innerHeight=1080; ctx.innerWidth=1920; mainEl.top=249; ctx.getComputedStyle=gcs||(e=>(e===form?{paddingBottom:'20px',marginBottom:'0px',borderBottomWidth:'0px'}:e===mainEl?{paddingBottom:'0px',marginBottom:'3px',borderBottomWidth:'0px'}:{paddingBottom:'99px',marginBottom:'0px',borderBottomWidth:'0px'})); pal.style={}; side.style={}; stage.style={}; };
    const unfake=()=>{ document.querySelector=saved.q; document.body=saved.body; ctx.innerHeight=saved.iH; ctx.innerWidth=saved.iW; ctx.getComputedStyle=saved.gcs; if(saved.gcs===undefined) delete ctx.getComputedStyle; if(saved.iH===undefined) delete ctx.innerHeight; if(saved.iW===undefined) delete ctx.innerWidth; };
    // the folders: opening one remembers it, closing it forgets it
    let onToggle=null; const sd=E('side'), was=sd.addEventListener; sd.addEventListener=(t,f)=>{ if(t==='toggle') onToggle=f; };
    fake(); side.style.maxHeight='old'; await run('render()'); sd.addEventListener=was;
    say('the editor listens to the folders of the settings panel', typeof onToggle==='function');
    say('drawing the settings panel fits the panels to the window (the widget list and the settings panel get the room from where they start to the bottom of the window)', pal.style.maxHeight==='808px' && side.style.maxHeight==='808px');
    if(onToggle){ const g=open=>({target:{open,dataset:{side:'frame'}}}), set=()=>JSON.stringify([...run('state.sideOpen')]);
      pal.style={}; side.style={}; onToggle(g(true)); const a=set(), fitted=side.style.maxHeight; onToggle(g(false)); const b=set(); onToggle({target:{open:true,dataset:{}}}); const c=set(); onToggle({target:{open:false,dataset:{}}}); const d2=set();
      say('...opening a folder remembers it, closing it forgets it, and something else that toggles (a folder of the widget list) is left alone', a==='["frame"]' && b==='[]' && c==='[]' && d2==='[]');
      say('...and the panels are fitted again when a folder opens (the list gets longer or shorter)', fitted==='808px');
      run("state.sideOpen.clear()"); E('side').innerHTML=run('sideHtml()'); }
    // the window listeners: once, whatever the number of times the editor is drawn
    run('panelFitWired=false'); listeners.resize=[]; listeners.scroll=[]; await run('render()'); await run('render()');
    say('the panels follow the window: one listener for resizing and one for scrolling, however often the editor is drawn', listeners.resize.length===1 && listeners.scroll.length===1 && typeof listeners.resize[0]==='function' && listeners.resize[0]===listeners.scroll[0]);
    unfake();
    // the room for a panel
    say('the room for a panel: the window minus where it starts minus the room kept under it, and never less than 160', run('panelRoom(1080, 249, 20)')===811 && run('panelRoom(1080, -50, 20)')===1052 && run('panelRoom(1080, 249, 0)')===823 && run('panelRoom(300, 249, 20)')===160 && run('panelRoom(1080, 4, 4)')===1064 && run('panelRoom(1080, 9, 9)')===1062);
    say('...rounded down to whole pixels', run('panelRoom(1080, 249.4, 20)')===810 && run('panelRoom(1080.9, 249, 20)')===811);
    // fitPanels
    fake(); run('fitPanels()');
    say('both panels get the room from their place to the bottom of the window (the padding under the editor is kept free), and the canvas is left alone', pal.style.maxHeight==='808px' && side.style.maxHeight==='808px' && stage.style.maxHeight===undefined);
    mainEl.top=-120; run('fitPanels()'); say('...scrolled down, where the panels stick to the top of the window, they get the whole window', side.style.maxHeight===(1080-8-23)+'px');
    fake(); ctx.innerWidth=901; run('fitPanels()'); say('...in a window wider than 900 pixels the panels are fitted', side.style.maxHeight==='808px');
    fake(); ctx.innerWidth=900; side.style.maxHeight='keep'; run('fitPanels()'); say('...in one column (900 pixels and narrower) the panels are part of the page and keep the height of the style sheet', side.style.maxHeight==='' && pal.style.maxHeight==='');
    fake(); ctx.innerWidth=400; run('fitPanels()'); say('...also in a phone window', side.style.maxHeight==='' && pal.style.maxHeight==='');
    fake(); ctx.innerHeight=undefined; side.style.maxHeight='keep'; run('fitPanels()'); say('...a window without a height changes nothing', side.style.maxHeight==='keep');
    fake(); document.querySelector=()=>null; side.style.maxHeight='keep'; run('fitPanels()'); say('...and nothing happens when no editor is on the page', side.style.maxHeight==='keep');
    fake(); document.querySelector=sel=>({}); side.style.maxHeight='keep'; let boom=null; try{ run('fitPanels()'); }catch(e){ boom=e; } say('...or when what is found has no panels in it', boom===null && side.style.maxHeight==='keep');
    // what is kept free under the editor: padding, margin and border of the editor and the boxes around it, up to the page
    fake(e=>({paddingBottom:'0px',marginBottom:'0px',borderBottomWidth:'0px'})); run('fitPanels()'); say('...with nothing kept free under the editor the panels keep 8 pixels (the space the sticky panels have at the top)', side.style.maxHeight==='823px');
    fake(e=>({paddingBottom:'0px',marginBottom:'0px',borderBottomWidth:e===form?'4px':'0px'})); run('fitPanels()'); say('...less than 8 pixels under the editor changes nothing (the 8 pixels are kept anyway)', side.style.maxHeight==='823px');
    fake(e=>({paddingBottom:'0px',marginBottom:'0px',borderBottomWidth:e===form?'14px':'0px'})); run('fitPanels()'); say('...a border of 14 pixels counts', side.style.maxHeight==='817px');
    fake(e=>({paddingBottom:'0px',marginBottom:e===mainEl?'14px':'0px',borderBottomWidth:'0px'})); run('fitPanels()'); say('...a margin of 14 pixels counts', side.style.maxHeight==='817px');
    fake(e=>({paddingBottom:e===form?'14px':'0px',marginBottom:'0px',borderBottomWidth:'0px'})); run('fitPanels()'); say('...a padding of 14 pixels counts', side.style.maxHeight==='817px');
    fake(e=>({paddingBottom:e===form?'10px':e===mainEl?'3px':'0px',marginBottom:e===form?'2px':'0px',borderBottomWidth:e===form?'1px':'0px'})); run('fitPanels()'); say('...they add up: the editor and the box around it (3 + 10 + 2 + 1 = 16 pixels)', side.style.maxHeight==='815px');
    fake(); document.body={}; run('fitPanels()'); say('...the page itself (the last box, which has no parent) is not counted', side.style.maxHeight==='808px');
    fake(); ctx.getComputedStyle=undefined; run('fitPanels()'); say('...without a way to measure the boxes the panels keep 8 pixels under them', side.style.maxHeight==='823px');
    unfake();
    const css=fs.readFileSync(R+'renderer/styles.css','utf8');
    say('...the style sheet keeps a height for the panels too (for the moment before the page has measured), and they scroll inside themselves', /\.ed-pal,\.ed-side\{position:sticky;top:8px;max-height:calc\(100vh - 16px\);overflow-y:auto\}/.test(css)); }
  const w57=()=>run('state.editing.draft.widgets[57]');
  say('a new widget has no border or transparency setting and looks as before', w57().borderMode===undefined && w57().transparency===undefined && !E('canvas').innerHTML.includes('color-mix'));
  say('...the border choice shows "Theme default" and the shade slider is switched off', /id="s-bmode"[^>]*><option value="" selected>Theme default/.test(E('side').innerHTML) && /id="s-bshade" type="range"[^>]*disabled/.test(E('side').innerHTML) && /id="s-trans" type="range"[^>]*value="0"/.test(E('side').innerHTML));
  E('side').onchange({target:{id:'s-bmode',value:'shade',dataset:{}}});
  say('border "Shade of the background" is made from the background and a quarter white', w57().borderMode==='shade' && E('canvas').innerHTML.includes('border-color:color-mix(in srgb, white 25%, var(--panel))'));
  say('...and now the slider can be used, at a quarter white (37.5%)', !/id="s-bshade" type="range"[^>]*disabled/.test(E('side').innerHTML) && /id="s-bshade" type="range" min="0" max="100" step="0.5" value="37.5"/.test(E('side').innerHTML));
  E('side').oninput({target:{id:'s-bshade',value:'0',type:'range',dataset:{}}});
  say('slider at 0% = white border', w57().borderShade===0 && E('canvas').innerHTML.includes('border-color:color-mix(in srgb, white 100%, var(--panel))') && E('s-bshade-v').textContent==='0%');
  E('side').oninput({target:{id:'s-bshade',value:'100',type:'range',dataset:{}}});
  say('slider at 100% = black border', E('canvas').innerHTML.includes('border-color:color-mix(in srgb, black 100%, var(--panel))') && E('s-bshade-v').textContent==='100%');
  E('side').oninput({target:{dataset:{color:'bgColor'},value:'#336699',type:'color'}});
  E('side').oninput({target:{id:'s-bshade',value:'50',type:'range',dataset:{}}});
  say('slider at 50% = the background colour', E('canvas').innerHTML.includes('background:#336699;border-color:#336699;background-clip:padding-box'));
  E('side').onchange({target:{id:'s-bmode',value:'off',dataset:{}}});
  say('border "No border"', w57().borderMode==='off' && E('canvas').innerHTML.includes('background:#336699;border-color:transparent;background-clip:padding-box') && /id="s-bshade" type="range"[^>]*disabled/.test(E('side').innerHTML));
  E('side').oninput({target:{id:'s-trans',value:'40',type:'range',dataset:{}}});
  say('transparency fades the background (and the border with it)', w57().transparency===40 && E('canvas').innerHTML.includes('background:color-mix(in srgb, #336699 60%, transparent);border-color:transparent') && E('s-trans-v').textContent==='40%');
  say('...but not the title or the value', !/class="lw-(title|val)"[^>]*color-mix/.test(E('canvas').innerHTML) && !/<span class="lw-(title|val)"[^>]*opacity/.test(E('canvas').innerHTML));
  run("state.editing.sel=[state.editing.draft.widgets[0], state.editing.draft.widgets[57]]"); E('side').innerHTML=run('sideHtml()');
  say('with two widgets selected that differ, the border choice says (different) and the slider does not change them until it is moved', E('side').innerHTML.includes('<option value="" selected>(different)</option>') && run('state.editing.draft.widgets[0].borderMode')===undefined);
  E('side').oninput({target:{id:'s-trans',value:'10',type:'range',dataset:{}}});
  say('moving a slider with several widgets selected changes all of them', run('state.editing.draft.widgets[0].transparency')===10 && w57().transparency===10);
  run("state.editing.draft.widgets[0].transparency=0; state.editing.sel=[state.editing.draft.widgets[57]]"); E('side').innerHTML=run('sideHtml()');
  E('side').onchange({target:{id:'s-bmode',value:'bogus',dataset:{}}});
  say('an unknown border choice is ignored', w57().borderMode==='off');
  E('side').onchange({target:{id:'s-bmode',value:'',dataset:{}}}); E('side').oninput({target:{id:'s-trans',value:'0',type:'range',dataset:{}}});
  say('back to Theme default and 0% transparency: the widget looks as before', !E('canvas').innerHTML.includes('color-mix') && E('canvas').innerHTML.includes('background:#336699'));
  E('side').onchange({target:{dataset:{theme:'bgColor'},checked:true}});
  // rounded corners: one setting for the layout (top bar), an override per widget
  say('the top bar has a Rounded corners field, empty = the classic corners', /id="e-lradius"[^>]*placeholder="classic" value=""/.test(run('view.innerHTML')));
  say('...and nothing has a corner of its own yet', !E('canvas').innerHTML.includes('border-radius'));
  E('e-lradius').oninput({target:{value:'20'}});
  say('a layout setting of 20 rounds every widget (20% of its shorter side)', run('state.editing.draft.radius')===20 && (E('canvas').innerHTML.match(/border-radius/g)||[]).length>=57);
  say('...each by its own size: a 120 wide, 60 high widget gets 20% of 60 (1.2cqw of the page width)', E('canvas').innerHTML.includes('border-radius:1.2cqw') && new Set(E('canvas').innerHTML.match(/border-radius:[^;"]*/g)).size>1);
  E('e-lradius').oninput({target:{value:'0'}});
  say('0 is square', run('state.editing.draft.radius')===0 && E('canvas').innerHTML.includes('border-radius:0cqw'));
  E('e-lradius').oninput({target:{value:'900'}});
  say('a layout setting is kept to 0 to 50', run('state.editing.draft.radius')===50);
  E('e-lradius').oninput({target:{value:''}});
  say('empty goes back to the classic corners', run('state.editing.draft.radius')==='' && !E('canvas').innerHTML.includes('border-radius'));
  E('e-lradius').oninput({target:{value:'20'}});
  run("state.editing.sel=[state.editing.draft.widgets[57]]"); E('side').innerHTML=run('sideHtml()');
  say('a widget offers Rounded corners, empty = as the layout', /id="s-radius" type="number" min="0" max="50" step="0.5" value="" placeholder="as the layout"/.test(E('side').innerHTML));
  E('side').oninput({target:{id:'s-radius',value:'50',type:'number',dataset:{}}});
  say('a widget\'s own setting wins over the layout\'s: 50 is fully round', w57().radius===50 && new RegExp('data-i="57" style="[^"]*border-radius:'+(50*Math.min(w57().w,w57().h)/1000)+'cqw').test(E('canvas').innerHTML));
  E('side').oninput({target:{id:'s-radius',value:'0',type:'number',dataset:{}}});
  say('a widget can be square in a round layout (0 is a setting, not empty)', w57().radius===0 && new RegExp('data-i="57" style="[^"]*border-radius:0cqw').test(E('canvas').innerHTML));
  E('side').oninput({target:{id:'s-radius',value:'',type:'number',dataset:{}}});
  say('emptying it goes back to following the layout', w57().radius==='' && new RegExp('data-i="57" style="[^"]*border-radius:'+(20*Math.min(w57().w,w57().h)/1000)+'cqw').test(E('canvas').innerHTML));
  // page background: a picture behind the widgets, with filters
  const gid=id=>document.getElementById(id), PICT='data:image/png;base64,iVBORw0KGgo=';
  say('the top bar has a Background button, not pressed while there is no picture', /id="e-background" aria-pressed="false"/.test(run('view.innerHTML')));
  E('e-background').onclick();
  say('it opens a Page background dialog: picture, fit, blur, brightness, colour; the filters wait for a picture', E('dlg').innerHTML.includes('Page background') && ['bg-file','bg-fit','bg-blur','bg-bright','bg-sat','bg-reset'].every(i=>E('dlg').innerHTML.includes('id="'+i+'"')) && /id="bg-blur"[^>]*disabled/.test(E('dlg').innerHTML) && E('dlg').innerHTML.includes('No picture') && !E('dlg').innerHTML.includes('id="bg-clear"'));
  run("resizeImage = async () => '"+PICT+"'");
  await gid('bg-file').onchange({target:{files:[{name:'track.jpg'}]}});
  say('choosing a picture sets it for the layout (shrunk to 1920 like the others) and the layer appears behind the widgets', run('state.editing.draft.bgImage')===PICT && run('state.editing.bgNode.className')==='bgpic' && run('state.editing.bgNode.style.cssText').includes("url('"+PICT+"')"));
  say('...the dialog now offers Remove and the filters', E('dlg').innerHTML.includes('id="bg-clear"') && !/id="bg-blur"[^>]*disabled/.test(E('dlg').innerHTML) && E('dlg').innerHTML.includes('class="bgpic"'));
  gid('bg-blur').oninput({target:{value:'60'}});
  say('blur 60 blurs the picture layer (and says so)', run('state.editing.draft.bgBlur')===60 && run('state.editing.bgNode.style.cssText').includes('blur(2.4cqw)') && gid('bg-blur-v').textContent==='60%');
  gid('bg-bright').oninput({target:{value:'70'}}); gid('bg-sat').oninput({target:{value:'0'}});
  say('brightness and colour', run('state.editing.draft.bgBrightness')===70 && run('state.editing.draft.bgSaturation')===0 && run('state.editing.bgNode.style.cssText').includes('blur(2.4cqw) brightness(70%) saturate(0%)') && gid('bg-sat-v').textContent==='0%');
  gid('bg-fit').onchange({target:{value:'contain'}});
  say('fit', run('state.editing.draft.bgFit')==='contain' && run('state.editing.bgNode.style.cssText').includes('background-size:contain'));
  const keepNode=run('state.editing.bgNode');
  E('side').oninput({target:{id:'s-size',value:'45',type:'number',dataset:{}}}); // anything that redraws the canvas
  say('the picture layer is kept, not rebuilt, when the canvas is redrawn (big pictures stay fast)', run('state.editing.bgNode')===keepNode);
  gid('bg-reset').onclick();
  say('Reset filters puts blur, brightness and colour back and leaves the picture', run('state.editing.draft.bgBlur')===0 && run('state.editing.draft.bgBrightness')===100 && run('state.editing.draft.bgSaturation')===100 && run('state.editing.draft.bgImage')===PICT && E('dlg').innerHTML.includes('<output id="bg-blur-v">0%</output>') && run('state.editing.draft.bgFit')==='contain');
  gid('bg-blur').oninput({target:{value:'40'}}); gid('bg-fit').onchange({target:{value:'cover'}});
  say('the layout is marked as changed', run('state.editing.dirty')===true);
  gid('bg-clear').onclick();
  say('Remove takes the picture away: no layer, filters wait again', run('state.editing.draft.bgImage')==='' && run('state.editing.bgNode')===null && /id="bg-blur"[^>]*disabled/.test(E('dlg').innerHTML));
  run("state.editing.draft.bgImage='http://evil.example/x.png'"); E('side').oninput({target:{id:'s-size',value:'45',type:'number',dataset:{}}});
  say('a picture that points elsewhere (for instance from a doctored import file) is not used', run('state.editing.bgNode')===null);
  await gid('bg-file').onchange({target:{files:[{name:'track.jpg'}]}}); gid('bg-blur').oninput({target:{value:'40'}});
  gid('bgform').onsubmit({preventDefault(){}});
  say('Done closes the dialog and keeps the settings', run('state.editing.draft.bgImage')===PICT && run('state.editing.draft.bgBlur')===40);
  // transparency for all widgets, set in the same dialog
  E('e-background').onclick();
  say('the dialog has a Widget transparency slider that works without a picture too', E('dlg').innerHTML.includes('id="bg-wtrans"') && !/id="bg-wtrans"[^>]*disabled/.test(E('dlg').innerHTML) && E('dlg').innerHTML.includes('Widget transparency'));
  const wt=i=>run(`state.editing.draft.widgets[${i}]`);
  gid('bg-wtrans').oninput({target:{value:'35'}});
  say('the layout setting is kept and shown', run('state.editing.draft.widgetTransparency')===35 && gid('bg-wtrans-v').textContent==='35%');
  say('...every widget that has no setting of its own gets it (background and border)', (E('canvas').innerHTML.match(/background:color-mix\(in srgb, var\(--panel\) 65%, transparent\)/g)||[]).length>=50);
  say('...but a widget that has its own transparency keeps it (widget 57 has its own 0, solid)', wt(57).transparency===0 && !new RegExp('data-i="57" style="[^"]*color-mix').test(E('canvas').innerHTML));
  gid('bgform').onsubmit({preventDefault(){}});
  run("state.editing.sel=[state.editing.draft.widgets[3]]"); E('side').innerHTML=run('sideHtml()');
  say('a widget without its own setting says "Same as the layout" (ticked), the slider is off and shows the layout\'s 35%', /id="s-transfollow" checked/.test(E('side').innerHTML) && /id="s-trans" type="range"[^>]*value="35"[^>]*disabled/.test(E('side').innerHTML));
  E('side').onchange({target:{id:'s-transfollow',checked:false,dataset:{}}});
  say('unticking it keeps the look and makes 35 the widget\'s own setting, which the slider can now change', wt(3).transparency===35 && !/id="s-trans" type="range"[^>]*disabled/.test(E('side').innerHTML) && !/id="s-transfollow" checked/.test(E('side').innerHTML));
  E('side').oninput({target:{id:'s-trans',value:'80',type:'range',dataset:{}}});
  say('the widget\'s own value wins over the layout\'s', wt(3).transparency===80 && E('canvas').innerHTML.includes('data-i="3"') && new RegExp('data-i="3" style="[^"]*background:color-mix\\(in srgb, [^)]*\\) 20%, transparent\\)').test(E('canvas').innerHTML));
  E('side').onchange({target:{id:'s-transfollow',checked:true,dataset:{}}});
  say('ticking "Same as the layout" again hands it back', wt(3).transparency==='' && /id="s-transfollow" checked/.test(E('side').innerHTML) && /id="s-trans" type="range"[^>]*value="35"/.test(E('side').innerHTML));
  E('side').oninput({target:{id:'s-trans',value:'0',type:'range',dataset:{}}});
  say('a widget can be solid in a see-through layout (its own 0)', wt(3).transparency===0 && !new RegExp('data-i="3" style="[^"]*color-mix').test(E('canvas').innerHTML));
  E('side').onchange({target:{id:'s-transfollow',checked:true,dataset:{}}});
  say('a newly added widget follows the layout', (()=>{ run("editorAdd('clock')"); const w=run('state.editing.sel[0]'); const r=w.transparency===undefined && /id="s-transfollow" checked/.test(E('side').innerHTML); run("state.editing.draft.widgets.pop(); state.editing.sel=[]"); return r; })());
  run("state.editing.sel=[state.editing.draft.widgets[57]]"); // back to the clock for the lines below
  E('side').oninput({target:{id:'s-radius',value:'50',type:'number',dataset:{}}});
  run("state.editing.sel=[]");
  run("editorAdd('bestlap')");
  say('lane widgets show lane selector', E('side').innerHTML.includes('id="s-lane"'));
  run("editorAdd('laptime')");
  say('lap time widget shows hold time and highlight colours', ['holdSeconds','pbColor','recordColor'].every(k=>E('side').innerHTML.includes('data-opt="'+k+'"')));

  run("editorAdd('flag')");
  { const h = () => E('side').innerHTML, sel = () => run("state.editing.sel[0]");
    say('race flag widget: its settings are a Flag style with Flags, LEDs, Text and Image set, and the flag can be mirrored', h().includes('Flag style') && !h().includes('Race Flag settings') && h().includes('data-opt="flagStyle"') && ['Flags','LEDs','Text (the background','Image set (made under'].every(t=>h().includes(t)) && /<option value="flags" selected>/.test(h()) && h().includes('data-opt="flagMirror"') && h().includes('Mirror the flag'));
    say('...the Flags style has no picture set choice and no picture uploads of its own', !h().includes('data-opt="imageSet"') && !h().includes('data-optimg='));
    run("state.editing.sel[0].opt = { flagStyle: 'images' }"); E('side').innerHTML=run('sideHtml()');
    say('the Image set style offers the picture sets and a Mirror for the pictures (not the one of the flags)', h().includes('data-opt="imageSet"') && h().includes('None (shows the flag name as text)') && h().includes('data-opt="imageMirror"') && !h().includes('data-opt="flagMirror"') && /<option value="images" selected>/.test(h()));
    E('side').oninput({ target: { id: 'o-imageMirror', type: 'checkbox', checked: true, dataset: { opt: 'imageMirror' } } });
    say('...ticking it is stored in the widget, and unticking turns it off', sel().opt.imageMirror === true && (E('side').oninput({ target: { id: 'o-imageMirror', type: 'checkbox', checked: false, dataset: { opt: 'imageMirror' } } }), sel().opt.imageMirror === false));
    run("state.editing.sel[0].opt = { flagStyle: 'images' }"); E('side').innerHTML=run('sideHtml()');
    run("state.editing.sel[0].opt = { flagStyle: 'leds' }"); E('side').innerHTML=run('sideHtml()');
    say('LEDs and Text have no extra settings', !h().includes('data-opt="imageSet"') && !h().includes('data-opt="flagMirror"') && !h().includes('data-opt="imageMirror"') && /<option value="leds" selected>/.test(h()));
    run("state.editing.sel[0].opt = { imageSet: 'old' }"); E('side').innerHTML=run('sideHtml()');
    say('a flag widget that already used a picture set shows Image set', /<option value="images" selected>/.test(h()) && h().includes('data-opt="imageSet"'));
    await E('side').onchange({ target: { dataset: { opt: 'flagStyle' }, value: 'flags', type: 'select-one' } });
    say('choosing a style is stored in the widget and the settings are redrawn for it', run("state.editing.sel[0].opt.flagStyle") === 'flags' && h().includes('data-opt="flagMirror"') && !h().includes('data-opt="imageSet"'));
    run("state.editing.sel[0].opt = {}"); E('side').innerHTML=run('sideHtml()'); }
  say('start lights widget: a picture set choice and, per race state, how many lights are on and their colour', run("(k => k.includes('imageSet') && ['ready','running','paused','between','finished','yellow','red'].every(s => k.includes('lights_'+s) && k.includes('lightcol_'+s)) && !k.includes('lights_countdown') && !k.some(x => x.indexOf('img') === 0))(Widgets.def('lights').options.map(o => o.key))"));
  run("editorAdd('leaderboard')");
  say('leaderboard offers a driver-column choice and column switches', E('side').innerHTML.includes('data-opt="driverBy"') && E('side').innerHTML.includes('type="checkbox" data-opt="colBest"'));
  say('alignment: the leaderboard can align its title, but has no text alignment (its columns come from the layout you make)', E('side').innerHTML.includes('id="s-talign"') && !E('side').innerHTML.includes('id="s-valign"'));
  { const h = () => E('side').innerHTML, sel = () => run("state.editing.sel[0]"), pick = (id, v) => E('side').onchange({ target: { id, value: v, dataset: {} } }), n0 = run('state.editing.draft.widgets.length');
    run("editorAdd('laptime')");
    say('alignment: every widget has Title alignment (left) and Text alignment (center) as its standard', /id="s-talign">[\s\S]*?<option value="left" selected>/.test(h()) && /id="s-valign">[\s\S]*?<option value="center" selected>/.test(h()) && !/class="lw[^"]*\bta-/.test(E('canvas').innerHTML.split('data-i="' + run('state.editing.draft.widgets.indexOf(state.editing.sel[0])') + '"')[0].split('class="lw').pop() || ''));
    pick('s-talign', 'right'); pick('s-valign', 'left');
    say('...choosing is stored in the widget and the widget is drawn with it (title right, text left)', sel().titleAlign === 'right' && sel().valueAlign === 'left' && new RegExp('class="lw sel[^"]*ta-r va-l"').test(E('canvas').innerHTML));
    pick('s-talign', 'center'); pick('s-valign', 'right');
    say('...center for the title and right for the text', sel().titleAlign === 'center' && sel().valueAlign === 'right' && new RegExp('class="lw sel[^"]*ta-c va-r"').test(E('canvas').innerHTML));
    pick('s-talign', 'sideways'); pick('s-valign', '');
    say('...a wrong choice changes nothing', sel().titleAlign === 'center' && sel().valueAlign === 'right');
    pick('s-talign', 'left'); pick('s-valign', 'center');
    say('...left and center are the standard again: no extra classes', !/class="lw sel[^"]*\b(ta|va)-/.test(E('canvas').innerHTML));
    run("editorAdd('start')");
    say('alignment: a button widget has none', !h().includes('id="s-talign"') && !h().includes('id="s-valign"'));
    run("editorAdd('avatar')");
    say('avatar widget: a choice of avatars (standard, none or a set), a Mirror tick box and the position and zoom', h().includes('data-opt="imageSet"') && h().includes('Standard avatars (built in)') && h().includes('No avatars (the first letter of the name)') && h().includes('data-opt="avatarMirror"') && h().includes('data-frame="frame"') && !h().includes('No sets yet'));
    run("state.editing.imageSets = [{ id: 'av1', name: 'Racers', kind: 'avatars', images: {} }, { id: 'fl1', name: 'Flags', kind: 'flag', images: {} }]"); E('side').innerHTML = run('sideHtml()');
    say('...only the sets of the kind Avatars are offered', h().includes('>Racers</option>') && !h().includes('>Flags</option>'));
    E('side').oninput({ target: { id: 'o-avatarMirror', type: 'checkbox', checked: true, dataset: { opt: 'avatarMirror' } } });
    await E('side').onchange({ target: { dataset: { opt: 'imageSet' }, value: 'av1', type: 'select-one' } });
    say('...the Mirror and the chosen set are stored in the widget', sel().opt.avatarMirror === true && sel().opt.imageSet === 'av1' && /<option value="av1" selected>/.test(h()));
    // 1.5.0: the weather widgets
    run("editorAdd('tyre')");
    say('tyres widget: a choice of a picture set (the tyres are drawn without one), how the tyre is shown and the warning to change tyres', h().includes('data-opt="imageSet"') && h().includes('None (the tyres are drawn)') && h().includes('data-opt="tyreShow"') && /id="o-tyreWarn" type="checkbox" data-opt="tyreWarn" checked/.test(h()) && /<option value="icon" selected>/.test(h()));
    run("state.editing.imageSets = [{ id: 'ty1', name: 'Rubber', kind: 'tyres', images: {} }, { id: 'we1', name: 'Skies', kind: 'weather', images: {} }, { id: 'co1', name: 'Gauges', kind: 'conditions', images: {} }]"); E('side').innerHTML = run('sideHtml()');
    say('...only the sets of the kind Tyres are offered', h().includes('>Rubber</option>') && !h().includes('>Skies</option>') && !h().includes('>Gauges</option>'));
    await E('side').onchange({ target: { dataset: { opt: 'imageSet' }, value: 'ty1', type: 'select-one' } });
    E('side').oninput({ target: { id: 'o-tyreShow', dataset: { opt: 'tyreShow' }, value: 'both', type: 'select-one' } });
    say('...the chosen set and the way to show the tyre are stored in the widget, and the canvas shows the tyre of the first lane (Soft) with its name', sel().opt.imageSet === 'ty1' && sel().opt.tyreShow === 'both' && /<option value="ty1" selected>/.test(h()) && E('canvas').innerHTML.includes('aria-label="Soft tyres"') && E('canvas').innerHTML.includes('<span class="wxt">Soft</span>'));
    say('...a Tyres widget is a widget of every lane (its lane is chosen like the others) and sits in a group Weather of the Add widget list', run("Widgets.def('tyre').perLane") === true && h().includes('id="s-lane"') && run("(() => { const g = {}; Widgets.REGISTRY.forEach(d => (g[d.group] = g[d.group] || []).push(d.type)); return g.Weather.join(); })()") === 'tyre,wxforecast,wxconditions');
    run("editorAdd('wxforecast')");
    say('weather forecast widget: a choice of a picture set, how the weather is shown and whether the next change is shown (no lane)', h().includes('data-opt="imageSet"') && h().includes('None (the weather is drawn)') && h().includes('data-opt="show"') && /id="o-showNext" type="checkbox" data-opt="showNext" checked/.test(h()) && !h().includes('id="s-lane"') && E('canvas').innerHTML.includes('Clearing in 3 laps'));
    say('...only the sets of the kind Weather are offered', h().includes('>Skies</option>') && !h().includes('>Rubber</option>') && !h().includes('>Gauges</option>'));
    E('side').oninput({ target: { id: 'o-show', dataset: { opt: 'show' }, value: 'text', type: 'select-one' } });
    E('side').oninput({ target: { id: 'o-showNext', type: 'checkbox', checked: false, dataset: { opt: 'showNext' } } });
    say('...Text only and no next change: the canvas shows just "Wet"', sel().opt.show === 'text' && sel().opt.showNext === false && E('canvas').innerHTML.includes('<span class="wxt">Wet</span>') && !E('canvas').innerHTML.includes('Clearing in 3 laps'));
    run("editorAdd('wxconditions')");
    say('track conditions widget: a picture set, where the values come from, the units, the four parts, the degrees and the layout; the numbers of its own are hidden', h().includes('None (the icons are drawn)') && h().includes('data-opt="values"') && h().includes('data-opt="units"') && ['showTrack', 'showAir', 'showWind', 'showDir', 'showDegrees'].every(k => h().includes('data-opt="' + k + '"')) && h().includes('data-opt="layout"') && !h().includes('data-opt="ownDryTrack"') && !h().includes('Your own values') && /<option value="system" selected>The weather system of the race/.test(h()));
    say('...only the sets of the kind Track conditions are offered, and the canvas shows the dry numbers of the standard weather system', h().includes('>Gauges</option>') && !h().includes('>Rubber</option>') && !h().includes('>Skies</option>') && E('canvas').innerHTML.includes('30 °C') && E('canvas').innerHTML.includes('10 km/h'));
    await E('side').onchange({ target: { dataset: { opt: 'values' }, value: 'own', type: 'select-one' } });
    say('...choosing My own values shows the note and the numbers of every state of the weather (16), starting with the standard ones', sel().opt.values === 'own' && h().includes('Your own values') && (h().match(/data-opt="own(Dry|Cloudy|Wet|Clearing)(Track|Air|Wind|Dir)"/g) || []).length === 16 && /id="o-ownDryTrack"[^>]*value="30"/.test(h()) && /id="o-ownWetWind"[^>]*value="22"/.test(h()) && /id="o-ownClearingDir"[^>]*max="359"[^>]*value="295"|id="o-ownClearingDir"[^>]*value="295"/.test(h()));
    E('side').oninput({ target: { id: 'o-ownDryTrack', type: 'number', value: '44', dataset: { opt: 'ownDryTrack' } } });
    say('...a number is stored in the widget (as a number) and the canvas follows it', sel().opt.ownDryTrack === 44 && E('canvas').innerHTML.includes('44 °C'));
    await E('side').onchange({ target: { dataset: { opt: 'units' }, value: 'imperial', type: 'select-one' } });
    say('...the units are redrawn too: the numbers that were not changed start from the standard in the new units (86 degrees, 6 mph), the canvas shows them', sel().opt.units === 'imperial' && /id="o-ownDryAir"[^>]*value="75"/.test(h()) && /id="o-ownDryWind"[^>]*value="6"/.test(h()) && E('canvas').innerHTML.includes('°F'));
    await E('side').onchange({ target: { dataset: { opt: 'values' }, value: 'system', type: 'select-one' } });
    say('...and back to the weather system the numbers of its own are hidden again (they are kept in the widget)', !h().includes('data-opt="ownDryTrack"') && sel().opt.ownDryTrack !== undefined);
    run("state.editing.imageSets = []");
    run("state.editing.imageSets = []");
    run("editorAdd('dbestlap')");
    say('delta badge: size, outline, bold and italic of the badge', h().includes('data-opt="badgeScale"') && h().includes('data-opt="badgeOutline"') && /id="o-badgeBold" type="checkbox" data-opt="badgeBold" checked/.test(h()) && /id="o-badgeItalic" type="checkbox" data-opt="badgeItalic" >/.test(h()) && /id="o-badgeScale"[^>]*value="100"/.test(h()) && /id="o-badgeOutline"[^>]*value="0"/.test(h()));
    await E('side').onchange({ target: { dataset: { opt: 'style' }, value: 'outlined', type: 'select-one' } });
    say('...the outline thickness starts at the line of the outlined look (14) and at none for the filled look', /id="o-badgeOutline"[^>]*value="14"/.test(h()) && (await E('side').onchange({ target: { dataset: { opt: 'style' }, value: 'filled', type: 'select-one' } }), /id="o-badgeOutline"[^>]*value="0"/.test(h())));
    E('side').oninput({ target: { id: 'o-badgeScale', type: 'range', value: '65', dataset: { opt: 'badgeScale', unit: '%' } } });
    say('...the size is stored as a number and the badge in the canvas follows it', sel().opt.badgeScale === 65 && E('canvas').innerHTML.includes('font-size:calc(.95em*0.65)'));
    // 1.18.0: the value and the badge side by side, or one above the other
    say('1.18.0: a Delta Timer has "Value and badge", left and right as the standard, and the canvas draws it side by side', /<select id="o-direction"[^>]*>.*<option value="row" selected>Left and right/.test(h()) && h().includes('<option value="column">Top and bottom') && !E('canvas').innerHTML.includes('dlt-col') && h().includes('The badge fills the height of the widget, beside the value.'));
    await E('side').onchange({ target: { dataset: { opt: 'direction' }, value: 'column', type: 'select-one' } });
    say('...choosing Top and bottom is kept on the widget, the canvas stacks the badge below the value, and the hint says to give the widget room', sel().opt.direction === 'column' && E('canvas').innerHTML.includes('class="dlt dlt-col"') && h().includes('<option value="column" selected>Top and bottom') && h().includes('give it room'));
    say('...the size of the badge is then a share of the width: the scaled badge in the canvas has a width, not a height', E('canvas').innerHTML.includes('width:min(100%,calc((100% - .32em)*0.65))') && !E('canvas').innerHTML.includes('height:min(100%,calc((100% - .32em)*0.65))'));
    await E('side').onchange({ target: { dataset: { opt: 'direction' }, value: 'row', type: 'select-one' } });
    say('...and back to Left and right the class goes again', sel().opt.direction === 'row' && !E('canvas').innerHTML.includes('dlt-col') && E('canvas').innerHTML.includes('height:min(100%,calc((100% - .32em)*0.65))'));
    run('state.editing.draft.widgets.length = ' + n0 + '; state.editing.sel = [state.editing.draft.widgets[' + (n0 - 1) + ']]'); E('side').innerHTML = run('sideHtml()'); // (the widgets of these checks are not part of the layout that is saved below; the leaderboard is selected again)
  }
  E('side').oninput({target:{dataset:{opt:'colLast'},type:'checkbox',checked:true,value:'on'}});
  say('a checkbox option is stored as true', run('state.editing.sel[0].opt.colLast') === true);
  E('side').oninput({target:{dataset:{opt:'driverBy'},type:'select-one',value:'callsign'}});
  say('a select option is stored', run('state.editing.sel[0].opt.driverBy') === 'callsign');
  run("editorAdd('lastlap')");
  say('last lap offers laps per column and columns', E('side').innerHTML.includes('data-opt="lapsPerColumn"') && E('side').innerHTML.includes('data-opt="columns"'));
  run("state.editing.draft.widgets.splice(-3); state.editing.sel = []"); // leave the layout as it was for the tests below
  await run('editorSave()');
  const saved=calls.find(c=>c[0]==='add'&&c[1]==='layouts');
  say('layout saved to the database with 60 widgets', saved && saved[2].name==='My layout' && saved[2].widgets.length===60 && saved[2].ratioW===16);
  say('saved widgets keep their settings', saved[2].widgets[57].textSize===45);
  say('the layout\'s corner radius and a widget\'s own radius are saved', saved[2].radius===20 && saved[2].widgets[57].radius===50);
  say('the layout\'s widget transparency is saved', saved[2].widgetTransparency===35);
  run('state.editing.draft.widgetTransparency=0'); // back to solid for the tests below
  say('the page background picture and its filters are saved with the layout', saved[2].bgImage===PICT && saved[2].bgBlur===40 && saved[2].bgFit==='cover' && saved[2].bgBrightness===100 && saved[2].bgSaturation===100);
  run('state.editing.draft.bgImage=""'); // back to no picture for the tests below
  run('state.editing.draft.radius=""; state.editing.draft.widgets[57].radius=""'); // back to the classic corners for the tests below
  say('not dirty after saving', run('editorDirty()')===false);
  // change proportions
  E('e-ratio').onchange({target:{value:'4:3'}});
  say('proportions preset changes the canvas', run('state.editing.draft.ratioW')===4 && run('state.editing.draft.ratioH')===3 && E('canvas').style.aspectRatio==='4 / 3');
  say('widgets still fit after changing proportions', run("state.editing.draft.widgets.every(g=>g.y+g.h<=Widgets.heightOf(state.editing.draft))"));
  // remove a widget
  run('state.editing.sel=[state.editing.draft.widgets[0]]'); E('side').onclick({target:{closest:()=>({id:'s-del'})}});
  say('remove widget', run('state.editing.draft.widgets.length')===59);
  // leave editor, list shows the saved layout, then edit it
  run("editorLeave()"); await run('render()');
  say('saved layout appears in the list', E('setupbox').innerHTML.includes('My layout') && E('setupbox').innerHTML.includes('data-edit="L1"'));
  await E('setupbox').onclick({target:{closest:()=>({dataset:{edit:'L1'}})}}); await new Promise(r=>setTimeout(r,20));
  say('editing a saved layout loads its widgets', run('state.editing.id')==='L1' && run('state.editing.draft.widgets.length')===60 && run('editorDirty()')===false);
  // race setup can now choose it
  run("editorLeave(); state.tab='setup'"); await run('render()'); run("state.refs.layouts=state.refs.layouts||[]; openForm('racesetups', null)");
  say('race setup form lists the saved layout', E('dlg').innerHTML.includes('My layout'));
    // ================= batch A: the layout editor =================
  const U=1000, ptr=(over={})=>({clientX:0,clientY:0,shiftKey:false,preventDefault(){},target:{dataset:{},closest:()=>null},...over});
  const onW=(i,over={})=>ptr({target:{dataset:{},closest:()=>({dataset:{i:String(i)}})},...over});
  const drag=(downEv,dx,dy)=>{ E('canvas').onpointerdown({...downEv}); const mv=(listeners.pointermove||[]).slice(-1)[0], up=(listeners.pointerup||[]).slice(-1)[0];
    mv({clientX:downEv.clientX+dx,clientY:downEv.clientY+dy}); up(); };
  const widgets=()=>run('state.editing.draft.widgets'), sel=()=>run('state.editing.sel.length');
  const openEditor=async()=>{ run("state.editing=null; state.tab='custom'; state.customSub='layouts'"); await run('render()');
    await E('setupbox').onclick({target:{closest:()=>({id:'newl',dataset:{}})}}); await new Promise(r=>setTimeout(r,20)); };
  ctx.__fits=0; run('(() => { const f = Rows.fitText; Rows.fitText = (r, m) => { __fits++; return f(r, m); }; })()'); // (counts the times the text of row cells is fitted)
  await openEditor();
  say('new layout starts empty with a finer 5-unit grid', widgets().length===0 && run('Widgets.GRID')===5);
  ['position','bestlap','name'].forEach(t=>run(`editorAdd('${t}')`));
  say('widgets are added with lanes counted up to 8', run("state.editing.draft.widgets.map(w=>w.lane).join()")==='0,0,0');
  // ---- titles ----
  const c0=E('canvas').innerHTML;
  say('every widget shows its title (its name) in the editor', c0.includes('>Position<')&&c0.includes('>Best lap<')&&c0.includes('>Name<'));
  run('state.editing.sel=[state.editing.draft.widgets[1]]'); run('state.editing.sel=[...state.editing.sel]'); E('side').innerHTML=run('sideHtml()');
  E('side').oninput({target:{id:'s-title',value:'Fastest',dataset:{}}});
  say('a title can be renamed', widgets()[1].title==='Fastest' && E('canvas').innerHTML.includes('>Fastest<'));
  E('side').onchange({target:{id:'s-showtitle',checked:false,dataset:{}}});
  say('a title can be hidden', widgets()[1].showTitle===false && !E('canvas').innerHTML.includes('>Fastest<'));
  E('side').onchange({target:{id:'s-showtitle',checked:true,dataset:{}}});
  E('side').oninput({target:{id:'s-tsize',value:'20',dataset:{}}});
  say('title size is adjustable', widgets()[1].titleSize===20 && E('canvas').innerHTML.includes('font-size:2cqw'));
  say('side panel offers lanes 1 to 8', E('side').innerHTML.includes('Lane 8'));
  // ---- finer handles ----
  const css2=fs.readFileSync(R+'renderer/styles.css','utf8');
  say('corner handles are smaller', /\.lw \.h\{[^}]*width:8px/.test(css2) && !/\.lw \.h\{[^}]*width:12px/.test(css2));
  // ---- multi-select ----
  run('state.editing.sel=[]'); await run('render()'); // back to a clean selection
  await openEditor(); ['position','bestlap','name','lap'].forEach(t=>run(`editorAdd('${t}')`));
  const ws=widgets(); ws[0].x=100;ws[0].y=100; ws[1].x=300;ws[1].y=100; ws[2].x=500;ws[2].y=100; ws[3].x=100;ws[3].y=300;
  E('canvas').onpointerdown(onW(0)); (listeners.pointerup||[]).slice(-1)[0]?.();
  say('clicking a widget selects just it', sel()===1);
  E('canvas').onpointerdown(onW(1,{shiftKey:true})); say('Shift-click adds a widget to the selection', sel()===2);
  E('canvas').onpointerdown(onW(1,{shiftKey:true})); say('Shift-click again removes it', sel()===1);
  E('canvas').onpointerdown(onW(1,{shiftKey:true}));
  say('the panel says how many are selected', E('side').innerHTML.includes('2 widgets selected'));
  E('side').oninput({target:{id:'s-size',value:'44',dataset:{}}});
  say('settings apply to every selected widget', ws[0].textSize===44 && ws[1].textSize===44 && ws[2].textSize!==44);
  E('side').oninput({target:{dataset:{color:'bgColor'},value:'#123456',type:'color'}});
  say('so do colours', ws[0].bgColor==='#123456' && ws[1].bgColor==='#123456' && ws[2].bgColor==='');
  E('side').onchange({target:{id:'s-lane',value:'3',dataset:{}}});
  say('and the lane', ws[0].lane===3 && ws[1].lane===3 && ws[2].lane===0);
  const a0={x:ws[0].x,y:ws[0].y}, b0={x:ws[1].x,y:ws[1].y};
  drag(onW(0,{clientX:100,clientY:100}),60,35);
  say('dragging moves the whole group together by the same amount', ws[0].x===a0.x+60 && ws[1].x===b0.x+60 && ws[0].y===a0.y+35 && ws[1].y===b0.y+35 && sel()===2);
  say('the third widget stayed where it was', ws[2].x===500 && ws[2].y===100);
  // marquee
  E('canvas').onpointerdown(ptr({clientX:20,clientY:20})); { const mv=(listeners.pointermove||[]).slice(-1)[0], up=(listeners.pointerup||[]).slice(-1)[0]; mv({clientX:620,clientY:250}); up(); }
  say('a selection rectangle selects every widget inside it', sel()===3 && run('state.editing.sel').every(w=>w!==ws[3]));
  E('canvas').onpointerdown(ptr({clientX:900,clientY:500})); (listeners.pointerup||[]).slice(-1)[0]();
  say('clicking an empty spot clears the selection', sel()===0);
  run("editorKeyHandler({key:'a',ctrlKey:true,target:{matches:()=>false},preventDefault(){}})");
  say('Ctrl+A selects everything', sel()===4);
  run("editorKeyHandler({key:'Delete',target:{matches:()=>false}})");
  say('Delete removes everything selected', widgets().length===0 && sel()===0);
  // ---- 1.34.1: a widget can be made very small ----
  await openEditor(); run("editorAdd('bestlap')"); { const g0 = widgets()[0]; g0.x = 100; g0.y = 100; g0.w = 150; g0.h = 60; }
  { const se = (extra = {}) => onW(0, { target: { dataset: { h: 'se' }, closest: () => ({ dataset: { i: '0' } }) }, clientX: 250, clientY: 160, ...extra }), nw = () => onW(0, { target: { dataset: { h: 'nw' }, closest: () => ({ dataset: { i: '0' } }) }, clientX: 100, clientY: 100 });
    E('canvas').onpointerdown(onW(0)); (listeners.pointerup||[]).slice(-1)[0]?.();
    say('a widget can be as small as 5 units, in the editor and on the grid (it was 40): pulled in from the bottom right corner', run('Widgets.MIN') === 5 && (drag(se(), -900, -900), widgets()[0].w === 5 && widgets()[0].h === 5 && widgets()[0].x === 100 && widgets()[0].y === 100));
    widgets()[0].w = 150; widgets()[0].h = 60;
    drag(nw(), 900, 900);
    say('...and from the top left corner, with the bottom right corner where it was', widgets()[0].w === 5 && widgets()[0].h === 5 && widgets()[0].x === 245 && widgets()[0].y === 155);
    widgets()[0].x = 100; widgets()[0].y = 100; widgets()[0].w = 150; widgets()[0].h = 60; E('e-snap').onchange({ target: { checked: false } });
    drag(se(), -143, -53);
    say('without snapping the size is exactly what is dragged: 7 by 7 (no grid step, no 40)', widgets()[0].w === 7 && widgets()[0].h === 7);
    say('a small widget that is selected has its handles outside its corners (the class tiny), so the widget itself can be grabbed', /class="lw sel tiny[ "]/.test(E('canvas').innerHTML) && (E('canvas').innerHTML.match(/class="h /g) || []).length === 4);
    drag(onW(0, { clientX: 105, clientY: 105 }), 50, 40);
    say('...and a drag on the small widget moves it (it is not a resize)', widgets()[0].x === 150 && widgets()[0].y === 140 && widgets()[0].w === 7 && widgets()[0].h === 7);
    widgets()[0].w = 59; widgets()[0].h = 200; drag(onW(0, { clientX: 160, clientY: 150 }), 0, 0);
    say('a widget narrower than 60 units counts as small, and one lower than 60 too', /class="lw sel tiny[ "]/.test(E('canvas').innerHTML) && (widgets()[0].w = 200, widgets()[0].h = 59, drag(onW(0, { clientX: 160, clientY: 150 }), 0, 0), /class="lw sel tiny[ "]/.test(E('canvas').innerHTML)));
    widgets()[0].w = 60; widgets()[0].h = 60; drag(onW(0, { clientX: 160, clientY: 150 }), 0, 0);
    say('...60 by 60 is not small, and keeps its handles on the corners', !E('canvas').innerHTML.includes('tiny') && E('canvas').innerHTML.includes('class="lw sel"'));
    widgets()[0].w = 7; widgets()[0].h = 7; E('canvas').onpointerdown(ptr({ clientX: 900, clientY: 500 })); (listeners.pointerup||[]).slice(-1)[0]();
    say('a small widget that is not selected has no handles, so nothing special', !E('canvas').innerHTML.includes('tiny') && !E('canvas').innerHTML.includes('class="h '));
    E('e-snap').onchange({ target: { checked: true } });
    say('the handles of a small widget are drawn outside the corners (the style sheet)', /\.lw\.tiny \.h\.nw\{left:-11px;top:-11px\}\.lw\.tiny \.h\.ne\{right:-11px;top:-11px\}\.lw\.tiny \.h\.sw\{left:-11px;bottom:-11px\}\.lw\.tiny \.h\.se\{right:-11px;bottom:-11px\}/.test(css2)); }
  // ---- duplicate for the next lane ----
  await openEditor(); run("editorAdd('bestlap')"); let w0=widgets()[0]; w0.x=100; w0.y=100; w0.w=150; w0.h=60; w0.lane=0;
  run('state.editing.sel=[state.editing.draft.widgets[0]]'); E('side').onclick({target:{closest:()=>({id:'s-dup'})}});
  say('Duplicate makes a copy for the next lane, directly below', widgets().length===2 && widgets()[1].lane===1 && widgets()[1].x===100 && widgets()[1].y===170 && sel()===1 && run('state.editing.sel[0]')===widgets()[1]);
  drag(onW(1,{clientX:300,clientY:300}),200,-70); // move the first copy up beside the original, 200 to the right
  say('the copy was moved into the same row', widgets()[1].x===300 && widgets()[1].y===100);
  E('side').onclick({target:{closest:()=>({id:'s-dup'})}});
  say('Duplicate repeats the step you moved the last copy by (a row)', widgets().length===3 && widgets()[2].lane===2 && widgets()[2].x===500 && widgets()[2].y===100);
  drag(onW(2,{clientX:600,clientY:130}),0,100); // nudge the newest copy down, which changes the step for the next one
  E('side').onclick({target:{closest:()=>({id:'s-dup'})}});
  say('...and a new step is learned when you move a copy again', widgets()[3].lane===3 && widgets()[3].x===700 && widgets()[3].y===widgets()[2].y+100);
  // ---- guidelines ----
  E('e-guides').onclick();
  say('Guidelines button asks for the number of lanes and a direction', E('dlg').innerHTML.includes('Number of lanes (2 to 8)') && E('dlg').innerHTML.includes('Vertical lines') && E('dlg').innerHTML.includes('Horizontal lines') && E('dlg').innerHTML.includes('Both'));
  document.getElementById('g-n').value='9'; await E('gform').onsubmit({preventDefault(){}});
  say('more than 8 lanes is refused', E('gerr').textContent.includes('2 to 8') && run('state.editing.draft.guides.v.length')===0);
  document.getElementById('g-n').value='3'; document.getElementById('g-dir-v').checked=true; document.getElementById('g-dir-h').checked=false; document.getElementById('g-dir-b').checked=false;
  await E('gform').onsubmit({preventDefault(){}});
  say('3 lanes, vertical: lines at a third and two thirds', run('state.editing.draft.guides.v').join()==='333.33,666.67' && run('state.editing.draft.guides.h.length')===0);
  say('guidelines are drawn in the editor', (E('canvas').innerHTML.match(/class="gl gl-v"/g)||[]).length===2);
  E('e-guides').onclick(); say('clicking Guidelines again turns them off', run('state.editing.draft.guides.v.length')===0 && !E('canvas').innerHTML.includes('class="gl'));
  E('e-guides').onclick(); document.getElementById('g-n').value='8'; document.getElementById('g-dir-v').checked=false; document.getElementById('g-dir-b').checked=true;
  await E('gform').onsubmit({preventDefault(){}});
  say('8 lanes, both directions: 7 vertical and 7 horizontal lines', run('state.editing.draft.guides.v.length')===7 && run('state.editing.draft.guides.h.length')===7);
  // a widget dragged near a line sticks to it
  run('state.editing.draft.widgets[0].x=300; state.editing.draft.widgets[0].y=400'); run('state.editing.sel=[state.editing.draft.widgets[0]]'); drag(onW(0,{clientX:310,clientY:410}),46,0);
  say('dragging a widget near a guideline snaps its edge to it', widgets()[0].x+widgets()[0].w===500);
  // ---- lane colours ----
  E('e-lanecolors').onclick();
  say('Lane colours lists 8 lanes with text and background colours', (E('dlg').innerHTML.match(/Lane \d text colour/g)||[]).length===8 && E('dlg').innerHTML.includes('Theme'));
  document.getElementById('lc-t-0').value='#ff0000'; document.getElementById('lc-tt-0').checked=false; document.getElementById('lc-b-0').value='#001122'; document.getElementById('lc-bt-0').checked=false;
  document.getElementById('lc-tt-1').checked=true; document.getElementById('lc-bt-1').checked=true;
  for(let i=2;i<8;i++){ document.getElementById('lc-tt-'+i).checked=true; document.getElementById('lc-bt-'+i).checked=true; }
  await E('lform').onsubmit({preventDefault(){}});
  say('lane colours are kept on the layout', run('state.editing.draft.laneColors').length===8 && run('state.editing.draft.laneColors[0].text')==='#ff0000' && run('state.editing.draft.laneColors[1].bg')==='');
  say('widgets of lane 1 show the lane colours in the editor', E('canvas').innerHTML.includes('color:#ff0000') && E('canvas').innerHTML.includes('background:#001122'));
  run('state.editing.draft.widgets[0].textColor="#00ff00"'); 
  await run('state.editing.sel=[]'); run("editorKeyHandler({key:'Escape',target:{matches:()=>false}})");
  const saveCalls=[]; const oldAdd=api.add; api.add=async(e,it)=>{saveCalls.push([e,it]);return {id:'LX'}};
  run('state.editing.draft.name="Lanes"'); await run('editorSave()');
  say('saving keeps guidelines and lane colours', saveCalls.length===1 && saveCalls[0][1].guides.v.length===7 && saveCalls[0][1].laneColors[0].bg==='#001122');
  api.add=oldAdd;
  { const got=[]; api.add=async(e,it)=>{got.push(e); await new Promise(r=>setTimeout(r,30)); return {id:'LY'}}; // a second click (or Ctrl+S) while the first save is being written is the same save
    run('state.editing.id=null'); run('state.editing.draft.name="Twice"'); const both=await Promise.all([run('editorSave()'),run('editorSave()')]);
    say('saving a new layout twice at once adds it once, and both calls come back saved', got.length===1 && both.every(x=>x===true) && run('state.editing.id')==='LY'); api.add=oldAdd; }
  say('a widget\'s own colour wins over its lane colour', run("Widgets.colorsOf(state.editing.draft.widgets[0], state.editing.draft).color")==='#00ff00' && run("Widgets.colorsOf(state.editing.draft.widgets[0], state.editing.draft).bg")==='#001122');

  // ---- batch 1 findings ----
  run("document.querySelector('h1')"); run("tabsEl").onclick({ target: { closest: () => ({ dataset: { id: 'live' } }) } }); say('the Live Race tab opens the second screen instead of a page', opened.length === 1 && run('state.tab') !== 'live');
  run("state.tab='setup'; state.setupSub='penalties'"); await run('render()');
  say('Race Setup has a Penalty systems sub-tab with an add button', E('setuptabs').innerHTML.includes('Penalty Systems') && E('setupmgr').innerHTML.includes('id="add"'));
  run("openForm('penaltysystems', null)");
  say('penalty system form: time rule, every X points, seconds and disqualify limit', ['f-timeRule', 'f-everyPoints', 'f-everySeconds', 'f-dqPoints'].every(id => E('dlg').innerHTML.includes('id="' + id + '"')));
  say('...and the special penalties editor with the three starting penalties', E('dlg').innerHTML.includes('id="pt-box"') && E('dlg').innerHTML.includes('Drivethrough') && E('dlg').innerHTML.includes('Stop-and-Go 10 s'));
  run("state.setupSub='setups'");
  store.drivers.push(...Array.from({ length: 7 }, (_, i) => ({ id: 'q' + i, name: 'Driver' + i })));
  run("state.tab='home'"); await run('render()');
  const full = E('view').innerHTML;
  const outsideSelects = full.replace(/<select[\s\S]*?<\/select>/g, '');
  say('Home no longer lists drivers, slotcars, tracks or race setups under Available (1.10.1)', !full.includes('Available') && !full.includes('data-more') && !full.includes('class="grid"') && !full.includes('Show all') && !/Driver\d/.test(outsideSelects), outsideSelects.slice(0, 200));
  say('...the drivers are still there in the dropdowns of the lanes', /data-k="driverId"[\s\S]*Driver5/.test(full));
  say('...and Home still has Start a race', full.includes('Start a race'));
  store.drivers.length = 0; run("state.sub='tracks'; state.tab='settings'"); await run('render()');
  // ---- App Settings > App Theme ----
  const withMerge = async fn => { const keep = api.setSettings; api.setSettings = async p => { calls.push(['settings', p]); return { ...run('state.settings'), ...p }; }; try { await fn(); } finally { api.setSettings = keep; } }; // the real setSettings answers with all the settings, not just the change
  await withMerge(async () => {
    const sheet = {}; for (const m of fs.readFileSync(R + 'renderer/styles.css', 'utf8').matchAll(/^\[data-theme="(\w+)"\]\{([^}]*)\}/gm)) sheet[m[1]] = Object.fromEntries(m[2].split(';').filter(Boolean).map(x => x.split(':')).map(([k, v]) => [k.slice(2), v]));
    const keepQuery = document.querySelector; document.querySelector = sel => ({ sel }); ctx.getComputedStyle = el => ({ getPropertyValue: n => (sheet[(/data-pick="(\w+)"/.exec(el.sel) || [])[1]] || {})[n.slice(2)] || '' }); // the page would answer from styles.css
    const props = () => document.documentElement.style.props, th = () => E('settingsbox').innerHTML, pick = k => E('settingsbox').onclick({ target: { closest: () => ({ dataset: { pick: k } }) } });
    run("state.settings={theme:'dark'}; state.tab='settings'; state.settingsSub='theme'"); await run('render()');
    say('App Settings has an App Theme tab between General and Network, and General no longer has the theme choice', E('settingstabs').innerHTML.indexOf('General') < E('settingstabs').innerHTML.indexOf('App Theme') && E('settingstabs').innerHTML.indexOf('App Theme') < E('settingstabs').innerHTML.indexOf('Network'));
    say('App Theme: a tile for every theme with the current one marked', ['dark', 'light', 'midnight', 'forest', 'sunset', 'violet', 'carbon', 'ocean', 'custom'].every(k => th().includes('data-pick="' + k + '"')) && th().includes('data-pick="dark" aria-pressed="true"') && th().includes('✓ Dark') && th().includes('data-pick="midnight" aria-pressed="false"'));
    say('...and a colour picker for each colour of the Custom theme', ['bg', 'panel', 'ink', 'muted', 'line', 'accent'].every(k => th().includes('data-color="' + k + '"')));
    let n = calls.length; await pick('midnight');
    say('choosing a ready-made theme saves and applies it, and puts no colours of its own on the page', calls.slice(n).some(c => c[0] === 'settings' && c[1].theme === 'midnight') && document.documentElement.dataset.theme === 'midnight' && ['--bg', '--panel', '--ink', '--muted', '--line', '--accent', '--on-accent'].every(k => props()[k] === ''));
    n = calls.length; await pick('custom'); const seeded = (calls.slice(n).find(c => c[0] === 'settings') || [])[1] || {};
    say('choosing Custom for the first time starts from the colours of the theme you were on', seeded.theme === 'custom' && seeded.customColors && seeded.customColors.bg === '#0e1624' && seeded.customColors.panel === '#16233a' && seeded.customColors.accent === '#4c9aff');
    say('...and puts those colours on the page, with a readable text colour for the accent', document.documentElement.dataset.theme === 'custom' && props()['--bg'] === '#0e1624' && props()['--accent'] === '#4c9aff' && props()['--on-accent'] === '#000000');
    n = calls.length; E('settingsbox').oninput({ target: { dataset: { color: 'accent' }, value: '#00ff88' } });
    say('moving a colour shows it at once, without saving yet', props()['--accent'] === '#00ff88' && calls.length === n && run('state.settings.customColors.accent') === '#00ff88' && document.documentElement.dataset.theme === 'custom');
    await E('settingsbox').onchange({ target: { dataset: { color: 'accent' } } });
    say('letting go saves all the colours as the Custom theme', calls.slice(n).some(c => c[0] === 'settings' && c[1].theme === 'custom' && c[1].customColors.accent === '#00ff88' && c[1].customColors.bg === '#0e1624'));
    E('settingsbox').oninput({ target: { dataset: { color: 'bg' }, value: 'javascript:alert(1)' } });
    say('a colour that is not a plain hex colour is ignored', run('state.settings.customColors.bg') === '#0e1624' && props()['--bg'] === '#0e1624');
    E('settingsbox').oninput({ target: { dataset: { color: 'ink' }, value: '#0e1624' } });
    say('text in the colour of the background gets a warning', E('th-warn').textContent.includes('hard to read'));
    await pick('dark');
    say('going back to a ready-made theme takes the custom colours off the page, but keeps them', props()['--bg'] === '' && props()['--on-accent'] === '' && document.documentElement.dataset.theme === 'dark' && run('state.settings.customColors.accent') === '#00ff88');
    n = calls.length; await pick('custom');
    say('choosing Custom again brings its own colours back (it is not started over)', !calls.slice(n).some(c => c[1] && c[1].customColors) && props()['--accent'] === '#00ff88');
    E('th-from').value = 'forest'; ctx.confirm = () => false; n = calls.length; await E('settingsbox').onclick({ target: { id: 'th-copy', closest: () => null } });
    say('copying the colours of a theme asks first when you already have your own, and changes nothing on No', calls.length === n && props()['--accent'] === '#00ff88');
    ctx.confirm = () => true; await E('settingsbox').onclick({ target: { id: 'th-copy', closest: () => null } });
    say('...and on Yes your colours become those of that theme', props()['--bg'] === '#121a16' && props()['--accent'] === '#3ecf8e' && run('state.settings.customColors.panel') === '#1b2721');
    run("state.settings={theme:'custom',customColors:{bg:'red;background:url(//x)',panel:'#fff',ink:'expression(1)',accent:'#12'}}"); run('applyTheme()');
    say('colours from a file that are not plain hex colours never reach the page (the Dark colour is used instead)', props()['--bg'] === '#171b21' && props()['--panel'] === '#ffffff' && props()['--ink'] === '#e8e6e1' && props()['--accent'] === '#e5484d');
    run("state.settings={theme:'neon'}"); run('applyTheme()');
    say('a theme this version does not know falls back to Dark', document.documentElement.dataset.theme === 'dark' && props()['--bg'] === '');
    document.querySelector = keepQuery; delete ctx.getComputedStyle; run("state.settings={theme:'dark'}; state.settingsSub='general'");
  });
  say('tabs, left to right', run('TABS.map(t=>t[1]).join()') === 'Home,Database,Race Setup,Customization,App Settings,Racing Rules,Live Race');
  { const t = E('tabs').innerHTML, live = t.slice(t.indexOf('data-id="live"') - 80);
    const litHtml = run(`(() => { const keepR = state.race, keepL = live; state.race = {}; live = { alive: true, phase: 'running' }; const el = { innerHTML: '' }; try { renderTabs(el, tabsNow(), 'home', () => {}, TAB_ICONS); } finally { state.race = keepR; live = keepL; } return el.innerHTML; })()`);
    const litLive = litHtml.slice(litHtml.indexOf('data-id="live"') - 80);
    say('no race is running: the Live Race tab is switched off, a Live on Air sign with the light out (grey light, hidden from screen readers) and a hint that it still opens the Live Race', (t.match(/class="tab onair/g) || []).length === 1 && /class="tab onair off"[^>]*data-id="live"/.test(t) && live.includes('<span class="led" aria-hidden="true"></span>Live Race</button>') && live.includes('title="No race is running. Opens the Live Race on a second screen anyway."') && !t.includes('led red') && !t.includes('racetab'));
    say('a race is running: the Live Race tab is lit as before, a red light in front of the name, and the Race tab is there too', (litHtml.match(/class="tab onair/g) || []).length === 1 && /class="tab onair"[^>]*data-id="live"/.test(litHtml) && litLive.includes('<span class="led red" aria-hidden="true"></span>Live Race</button>') && litLive.includes('title="Opens the Live Race on a second screen"') && !litHtml.includes('onair off') && (litHtml.match(/class="led red"/g) || []).length === 1 && litHtml.includes('racetab'));
    say('...the other tabs are plain (no light), there is only one sign, and it never claims to be the open page', !t.slice(0, t.indexOf('class="tab onair')).includes('led') && /data-id="live"/.test(t) && !/aria-selected="true"[^>]*data-id="live"/.test(t) && !/aria-selected="true"[^>]*data-id="live"/.test(litHtml));
    say('...and the switched-off sign still works: clicking it picks the Live Race tab (it is a button like the lit one)', (() => { let picked = ''; const el = { innerHTML: '' }; run('renderTabs')(el, run('tabsNow()'), 'home', id => { picked = id; }); el.onclick({ target: { closest: () => ({ dataset: { id: 'live' } }) } }); return picked === 'live'; })());
    say('the two looks are part of the stylesheet: lit = red letters and light inside a red outline, no background of its own, no animation; off = grey letters, no glow, a grey light, and the outline lights up only a little on hover', (css => { const sign = (css.match(/\.tab\.onair\{[^}]*\}/) || [''])[0], led = (css.match(/\.led\.red\{[^}]*\}/) || [''])[0], off = (css.match(/\.tab\.onair\.off\{[^}]*\}/) || [''])[0], offLed = (css.match(/\.tab\.onair\.off \.led\{[^}]*\}/) || [''])[0], offHover = (css.match(/\.tab\.onair\.off:hover\{[^}]*\}/) || [''])[0];
      return /background:transparent/.test(sign) && !/background:#/.test(sign) && /color:var\(--onair\)/.test(sign) && /border:1\.5px solid var\(--onair\)/.test(sign) && /background:#ff3b3b/.test(led) && !/animation|@keyframes/.test(sign + led + off + offLed) && !/@keyframes/.test(css.slice(css.indexOf('.tab.onair'), css.indexOf('.led.red') + 200))
        && /--onair:color-mix\(in srgb,var\(--muted\)/.test(off) && /text-shadow:none/.test(off) && /box-shadow:none/.test(off) && /background:#555a63/.test(offLed) && !/ff3b3b/.test(off + offLed) && /color:var\(--ink\)/.test(offHover); })(require('fs').readFileSync(__dirname + '/../renderer/styles.css', 'utf8')));
  }
  // the line pictures at the left of the main tabs (icons.js)
  { const t = E('tabs').innerHTML, btn = id => (t.split('</button>').find(b => b.includes(`data-id="${id}"`)) || '') + '</button>', label = { home: 'Home', database: 'Database', setup: 'Race Setup', custom: 'Customization', settings: 'App Settings', rules: 'Racing Rules' };
    say('every main tab except Live Race has a line picture before its name: first in the button, 18 pixels, hidden from screen readers', Object.keys(label).every(id => btn(id).startsWith('<button class="tab hasico"') && btn(id).includes(`><svg class="tabico" viewBox="0 0 24 24" width="18" height="18" `) && btn(id).includes('aria-hidden="true"') && btn(id).endsWith(`</svg>${label[id]}</button>`)) && (t.match(/class="tabico"/g) || []).length === 6);
    say('...the name of each tab is still plain text next to it (for screen readers and for the keys)', Object.keys(label).every(id => btn(id).replace(/<svg.*?<\/svg>/, '').replace(/<[^>]*>/g, '') === label[id]));
    say('...the Live Race tab gets no picture: it keeps its Live on Air light (switched off when no race is running)', !btn('live').includes('<svg') && btn('live').includes('class="tab onair off"') && btn('live').includes('class="led"'));
    say('each picture is one of the set: Home a house, Database and Racing Rules the pictures of those tiles on the Live Race page, and the others their own', run("JSON.stringify(TAB_ICONS)") === '{"home":"home","database":"database","setup":"setup","custom":"custom","settings":"settings","rules":"rules"}' && Object.keys(label).every(id => btn(id).includes(run(`Icons.PATHS[TAB_ICONS.${id}]`))) && ['database', 'rules'].every(id => btn(id).includes(run(`Icons.PATHS.${id}`))));
    say('...all of them different, so no two tabs look alike', new Set(Object.keys(label).map(id => (btn(id).match(/<svg.*<\/svg>/) || [''])[0])).size === 6);
    say('the tabs inside a screen (settings, hardware, setups, customization) have no pictures', ['settingstabs', 'hwtabs', 'setuptabs', 'customtabs'].every(id => !E(id).innerHTML.includes('<svg')) && E('settingstabs').innerHTML.includes('class="tab"') && !/hasico/.test(E('settingstabs').innerHTML));
    say('a tab that is given no picture (or one that does not exist) stays a plain tab', run(`(() => { const el = { innerHTML: '' }; renderTabs(el, [['a', 'A'], ['b', 'B'], ['c', 'C']], 'a', () => {}, { b: 'nope', c: 'constructor' }); return el.innerHTML; })()`) === '<button class="tab" role="tab" aria-selected="true" data-id="a">A</button><button class="tab" role="tab" aria-selected="false" data-id="b">B</button><button class="tab" role="tab" aria-selected="false" data-id="c">C</button>');
    say('the picture does not change what a click does (it is part of the button)', (() => { const picked = []; run('globalThis.__p=[]'); run(`(() => { const el = { innerHTML: '', onclick: null }; renderTabs(el, [['a', 'A']], 'b', id => globalThis.__p.push(id), { a: 'home' }); el.onclick({ target: { closest: () => ({ dataset: { id: 'a' } }) } }); })()`); return run('globalThis.__p').join() === 'a'; })());
    say('the pictures are part of the stylesheet: in the accent colour of the theme (the colour of the Start Race button), so they change with the theme, and placed left of the text with a small gap', (css => { const rule = (css.match(/\.tab \.tabico\{[^}]*\}/) || [''])[0], row = (css.match(/\.tab\.hasico\{[^}]*\}/) || [''])[0], btn = (css.match(/\.btn\.primary\{[^}]*\}/) || [''])[0];
      return /color:var\(--accent\)/.test(rule) && !/#[0-9a-f]{3}|rgb|hsl/i.test(rule) && /display:inline-flex/.test(row) && /align-items:center/.test(row) && /gap:\d+px/.test(row) && !/flex-direction|order:/.test(row) && /background:var\(--accent\)/.test(btn); })(require('fs').readFileSync(__dirname + '/../renderer/styles.css', 'utf8')));
  }
  run("state.tab='settings'"); await run('render()');
  say('App Settings: app name field', E('view').innerHTML.includes('App Settings') && E('settingsbox').innerHTML.includes('id="appname"'));
  await E('appname').onchange({ target: { value: ' Dutch Timing ' } });
  say('the app name is saved trimmed', calls.some(c => c[0] === 'settings' && c[1].appName === 'Dutch Timing'));
  say('App Settings: the labels are "App Name" and "Welcome Message", the message field shows the standard message as its placeholder', E('settingsbox').innerHTML.includes('>App Name (shown at the top of the window)<') && E('settingsbox').innerHTML.includes('>Welcome Message (shown at the top of the Home tab)<') && E('settingsbox').innerHTML.includes('id="welcome"') && E('settingsbox').innerHTML.includes('placeholder="Welcome to the SlotForge Slotcar Timing App!"'));
  await E('welcome').onchange({ target: { value: '  Race night at <Dutch\'s> track  ' } });
  say('the welcome message is saved trimmed', calls.some(c => c[0] === 'settings' && c[1].welcome === 'Race night at <Dutch\'s> track'));
  run("state.tab='home'"); await run('render()');
  say('Home shows the welcome message (as plain text: nothing in it is run as markup) instead of the standard one', E('view').innerHTML.includes("<h2>Race night at &lt;Dutch's&gt; track</h2>") && !E('view').innerHTML.includes('Welcome to the SlotForge'));
  run("state.tab='settings'"); await run('render()');
  await E('welcome').onchange({ target: { value: '   ' } });
  say('an empty welcome message brings back the standard one', calls.slice(-1)[0][1].welcome === '' && run('welcomeOf()') === 'Welcome to the SlotForge Slotcar Timing App!');
  run("state.settings.homeHeader='data:image/png;base64,HDR'; state.tab='settings'"); await run('render()');
  say('App Settings: header picture can be chosen and removed', E('settingsbox').innerHTML.includes('id="hdrfile"') && E('settingsbox').innerHTML.includes('id="hdrclear"'));
  run("state.tab='home'"); await run('render()');
  say('Home shows the header picture, with no picture controls', E('view').innerHTML.includes('class="homebanner"') && !E('view').innerHTML.includes('hdrfile'));
  say('Home greets with the new title', E('view').innerHTML.includes('<h2>Welcome to the SlotForge Slotcar Timing App!</h2>') && !E('view').innerHTML.includes('<h2>Home</h2>'));
  say('the header follows the shape of the picture while the height is automatic', !E('view').innerHTML.includes('aspect-ratio'));
  run("state.settings.homeHeaderHeight=25"); await run('render()');
  say('a chosen height makes the header that percentage of the window width, whatever the picture', E('view').innerHTML.includes('style="aspect-ratio:100 / 25;max-height:none"'));
  let badHeight = []; for (const bad of [3, 80, 'x', null, -5, 0, '']) { run('state.settings.homeHeaderHeight=' + JSON.stringify(bad)); await run('render()'); if (E('view').innerHTML.includes('aspect-ratio')) badHeight.push(bad); }
  say('a height outside 5 to 60, or rubbish, means automatic', badHeight.length === 0);
  await withMerge(async () => {
    run("state.settings.homeHeader='data:image/png;base64,HDR'; state.settings.homeHeaderHeight=''; state.tab='settings'; state.settingsSub='general'"); await run('render()');
    const g = () => E('settingsbox').innerHTML;
    say('with a header picture, General offers a height slider that starts on Automatic', g().includes('id="hdrh"') && g().includes('id="hdrauto" type="checkbox" checked') && g().includes('>automatic</output>'));
    E('hdrauto').checked = false; E('hdrh').value = '18'; const n = calls.length; await E('hdrauto').onchange(); await new Promise(r => setTimeout(r, 20));
    say('turning Automatic off applies the height of the slider', calls.slice(n).some(c => c[0] === 'settings' && c[1].homeHeaderHeight === 18) && g().includes('18% of the width') && g().includes('aspect-ratio:100 / 18'));
    E('hdrh').value = '32'; E('hdrh').oninput();
    say('moving the slider shows the new height at once, without saving', E('hdrhv').textContent === '32% of the width' && E('hdrprev').style.cssText === 'aspect-ratio:100 / 32;max-height:none' && calls.length === n + 1);
    await E('hdrh').onchange();
    say('letting go saves it', run('state.settings.homeHeaderHeight') === 32);
    E('hdrauto').checked = true; await E('hdrauto').onchange(); await new Promise(r => setTimeout(r, 20));
    say('Automatic saves an empty height again', run('state.settings.homeHeaderHeight') === '' && g().includes('>automatic</output>'));
    run("state.settings.homeHeader=''"); await run('render()');
    say('without a header picture there is no height control', !g().includes('id="hdrh"'));
    run("state.settings={theme:'dark'}; state.settingsSub='general'");
  });
  await withMerge(async () => { // the position of the header picture: sliders, Center, dragging
    const wait = () => new Promise(r => setTimeout(r, 20)), g = () => E('settingsbox').innerHTML, saved = () => run('JSON.stringify(state.settings.homeHeaderPos)');
    const stage = (auto, h = 25) => { E('hdrauto').checked = auto; E('hdrh').value = String(h); }; // the stub keeps the controls of the earlier tests: set them as the markup would
    const shape = (cw, ch, nw, nh) => Object.assign(E('hdrprev'), { clientWidth: cw, clientHeight: ch, naturalWidth: nw, naturalHeight: nh });
    run("state.settings.homeHeader='data:image/png;base64,HDR'; state.settings.homeHeaderHeight=25; delete state.settings.homeHeaderPos; state.tab='settings'; state.settingsSub='general'");
    shape(480, 120, 1000, 1000); stage(false); await run('render()'); await wait(); // a square picture in a wide box: it sticks out at the top and bottom
    say('General offers a Left / right and an Up / down slider and a Center button, in the middle to start', g().includes('id="hdrx"') && g().includes('id="hdry"') && g().includes('id="hdrcenter"') && E('hdrx').value === 50 && E('hdryv').textContent === '50%' && !g().includes('object-position'));
    say('only the direction in which the picture is cropped can be moved', E('hdrx').disabled === true && E('hdry').disabled === false);
    const n = calls.length; E('hdry').value = '80'; E('hdry').oninput();
    say('moving a slider shows the position at once, without saving', E('hdrprev').style.cssText === 'aspect-ratio:100 / 25;max-height:none;object-position:50% 80%' && E('hdryv').textContent === '80%' && calls.length === n);
    await E('hdry').onchange();
    say('letting go saves it', saved() === '{"x":50,"y":80}' && calls.slice(n).some(c => c[0] === 'settings' && c[1].homeHeaderPos && c[1].homeHeaderPos.y === 80));
    run("state.tab='home'"); await run('render()');
    say('Home shows the picture at that position', E('view').innerHTML.includes('object-position:50% 80%'));
    run("state.tab='settings'"); stage(false); await run('render()'); await wait();
    say('General shows the saved position again', E('hdry').value === 80 && E('hdryv').textContent === '80%' && g().includes('object-position:50% 80%'));
    await E('hdrcenter').onclick(); await wait();
    say('Center puts the picture back in the middle and saves that', saved() === '{"x":50,"y":50}' && E('hdry').value === 50 && !E('hdrprev').style.cssText.includes('object-position'));

    const prev = () => E('hdrprev'); // dragging: 480 x 120 box, 1000 x 1000 picture: it can move 360 px up and down
    prev().onpointerdown({ button: 2, clientX: 200, clientY: 100, pointerId: 1 }); prev().onpointermove({ clientX: 200, clientY: 40 });
    say('a right click does not start a drag', saved() === '{"x":50,"y":50}' && !prev().style.cssText.includes('object-position'));
    const m = calls.length; prev().onpointerdown({ button: 0, clientX: 200, clientY: 100, pointerId: 1 }); prev().onpointermove({ clientX: 260, clientY: 70 });
    say('dragging the picture up moves what shows towards the bottom, and not sideways where it fits', prev().style.cssText.endsWith('object-position:50% 58.3%') && E('hdry').value === 58.3 && E('hdryv').textContent === '58%' && calls.length === m);
    prev().onpointerup(); await wait();
    say('letting go saves the dragged position', saved() === '{"x":50,"y":58.3}');
    prev().onpointermove({ clientX: 200, clientY: 0 });
    say('after the drag the picture stays where it is', saved() === '{"x":50,"y":58.3}' && prev().style.cssText.endsWith('50% 58.3%'));
    prev().onpointerup(); await wait(); const k = calls.length; prev().onpointerup();
    say('letting go twice saves once', calls.length === k);
    await E('hdrcenter').onclick(); await wait();

    shape(480, 120, 3000, 500); stage(false); await run('render()'); await wait(); // a very wide picture: it sticks out at the sides
    say('a wide picture can be moved left and right instead', E('hdrx').disabled === false && E('hdry').disabled === true);
    prev().onpointerdown({ button: 0, clientX: 300, clientY: 50, pointerId: 2 }); prev().onpointermove({ clientX: 200, clientY: 90 }); prev().onpointerup(); await wait();
    say('dragging left shows more of the right side', JSON.parse(saved()).y === 50 && JSON.parse(saved()).x > 50);
    E('hdrx').value = '10'; E('hdrx').oninput(); await E('hdrx').onchange();
    say('the Left / right slider saves the sideways position', saved() === '{"x":10,"y":50}');

    shape(480, 120, 1600, 400); stage(false); await run('render()'); await wait(); // the same shape as the box: it all shows
    say('a picture that fits the box has nothing to move: both sliders are greyed out and it cannot be dragged', E('hdrx').disabled === true && E('hdry').disabled === true);
    const f = calls.length; prev().onpointerdown({ button: 0, clientX: 300, clientY: 50, pointerId: 3 }); prev().onpointermove({ clientX: 100, clientY: 5 }); prev().onpointerup();
    say('...and a try changes nothing', calls.length === f);

    shape(480, 110, 1000, 1000); run("state.settings.homeHeaderHeight=''; state.settings.homeHeaderPos={x:30,y:20}"); stage(true); await run('render()'); await wait();
    say('with an automatic height the preview keeps its own height and the position', g().includes('style="max-height:110px;object-position:30% 20%"'));
    run("state.tab='home'"); await run('render()');
    say('...and Home shows it at that position, at its natural height', E('view').innerHTML.includes('style="object-position:30% 20%"'));

    ctx.resizeImage = async () => 'data:image/png;base64,NEWPICTURE';
    run("state.tab='settings'"); stage(true); await run('render()'); await wait();
    await E('hdrfile').onchange({ target: { files: [{}] } }); await wait();
    say('a new picture starts in the middle again', run('state.settings.homeHeader') === 'data:image/png;base64,NEWPICTURE' && saved() === '{"x":50,"y":50}');
    delete ctx.resizeImage;

    for (const bad of [{ x: '50%;background:url(x)', y: 'javascript:1' }, 'abc', 5, null, { x: -40, y: 900 }]) {
      run('state.settings.homeHeaderPos=' + JSON.stringify(bad)); run("state.tab='home'"); await run('render()');
      const h = E('view').innerHTML;
      say('a damaged saved position cannot add anything to the page: ' + JSON.stringify(bad), !h.includes('url(') && !h.includes('javascript') && !h.includes('background') && (h.includes('object-position:0% 100%') || !h.includes('object-position')));
    }
    run("state.settings={theme:'dark'}; state.settingsSub='general'; state.tab='home'");
  });
  await withMerge(async () => { // the club logo: App Settings, the Home tab and the Logo widget
    const wait = () => new Promise(r => setTimeout(r, 20)), g = () => E('settingsbox').innerHTML, v = () => E('view').innerHTML, saved = () => run('JSON.stringify(state.settings.homeLogoPos)');
    const PIC = 'data:image/png;base64,HDR', LOGO = 'data:image/png;base64,CLUBLOGO';
    const shape = (id, cw, ch, nw, nh) => Object.assign(E(id), { clientWidth: cw, clientHeight: ch, naturalWidth: nw, naturalHeight: nh });
    const open = async () => { run("state.tab='settings'; state.settingsSub='general'"); await run('render()'); await wait(); };
    const home = async () => { run("state.tab='home'"); await run('render()'); };
    run(`state.settings={theme:'dark',homeHeader:'${PIC}',homeHeaderHeight:25}; delete state.settings.clubLogo`); await open();
    say('General has a Club logo setting to choose a picture, and nothing else of the logo until there is one', g().includes('id="logofile"') && !g().includes('id="logoside"') && !g().includes('id="logoclear"') && !g().includes('id="logow"'));
    { const q = () => g().split('id="picq"')[1] || '';
      say('General has a Pictures folder: Original is the standard quality, High and Standard are the other two', g().includes('data-folder="general:pictures"') && g().includes('Quality of the pictures you upload') && /<option value="original" selected>/.test(q()) && (q().split('</select>')[0].match(/<option /g) || []).length === 3 && g().includes('Raspberry Pi'));
      const nq = calls.length; await E('picq').onchange({ target: { value: 'high' } }); await wait();
      say('...choosing a quality is saved and the page shows it', run('state.settings.pictureQuality') === 'high' && calls.slice(nq).some(c => c[1].pictureQuality === 'high') && /<option value="high" selected>/.test(q()));
      await E('picq').onchange({ target: { value: 'banana' } }); await wait();
      say('...a value that does not exist becomes Original', run('state.settings.pictureQuality') === 'original' && /<option value="original" selected>/.test(q()));
      { const was = { document: ctx.document, URL: ctx.URL, Image: ctx.Image }; // the real upload function, with a picture of 5000 x 2500 pixels and a canvas that tells its size
        ctx.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
        ctx.Image = function () { const i = this; Object.defineProperty(i, 'src', { set() { i.naturalWidth = 5000; i.naturalHeight = 2500; setTimeout(() => i.onload(), 0); } }); };
        ctx.document = Object.assign(Object.create(was.document), { createElement: () => { const c = { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: (m, k) => `${m} ${c.width}x${c.height} ${k}`.trim() }; return c; } }); // (the page's own document stays behind it: a timer of the page that fires meanwhile still finds getElementById)
        const up = async (quality, max) => { if (quality) run(`state.settings.pictureQuality='${quality}'`); else run('delete state.settings.pictureQuality'); return realResize({ type: 'image/png', size: 100 }, max); };
        const r = [await up(undefined, 512), await up('original', 512), await up('high', 512), await up('standard', 512), await up('standard', 1024)];
        Object.assign(ctx, was);
        say('uploading a picture uses the chosen quality: Original keeps up to 4000 px, High 2000 px, Standard the size of the place it is for', r.join(' | ') === 'image/png 4000x2000 0.92 | image/png 4000x2000 0.92 | image/png 2000x1000 0.92 | image/png 512x256 0.85 | image/png 1024x512 0.85'); }
      run('delete state.settings.pictureQuality'); await open(); }
    // choosing the picture
    let sizeArgs = null; ctx.resizeImage = async (f, max, png) => { sizeArgs = [max, png]; return LOGO; };
    await E('logofile').onchange({ target: { files: [{}] } }); await wait();
    say('a chosen logo is shrunk to 600 px and keeps its transparency', JSON.stringify(sizeArgs) === '[600,true]');
    say('...it is saved and starts in the middle', run('state.settings.clubLogo') === LOGO && saved() === '{"x":50,"y":50}' && calls.slice(-1)[0][1].clubLogo === LOGO);
    say('...and is not shown on the Home tab until a side is chosen', g().includes('id="logoside"') && g().includes('id="logoclear"') && g().includes('id="logothumb"') && !g().includes('id="logow"') && !g().includes('id="hdrbox"') && g().includes('selected>Not shown'));
    await home();
    say('Home is the same as before: only the picture', v().includes('class="homebanner"') && !v().includes('withlogo') && !v().includes('hcell') && !v().includes(LOGO) && v().includes('style="aspect-ratio:100 / 25;max-height:none"'));
    // choosing a side
    await open(); const n0 = calls.length; await E('logoside').onchange({ target: { value: 'left' } }); await wait();
    say('choosing a side saves it', run('state.settings.homeLogoSide') === 'left' && calls.slice(n0).some(c => c[1].homeLogoSide === 'left'));
    say('...Not shown, Left and Right are the choices, with the chosen one selected', ['<option value="">Not shown</option>', '<option value="left" selected>Left of the header picture</option>', '<option value="right">Right of the header picture</option>'].every(o => g().includes(o)));
    say('...and shows the logo controls and a preview of the whole header', ['logow', 'logox', 'logoy', 'logocenter', 'hdrbox', 'logoprev', 'hdrprev'].every(i => g().includes('id="' + i + '"')) && g().includes('selected>Left of the header picture') && !g().includes('id="logothumb"'));
    say('...the width starts at 25% and the logo in the middle', g().includes('id="logow" type="range" min="10" max="50" step="1" value="25"') && g().includes('25% of the header') && g().includes('id="logox" type="range" min="0" max="100" step="1" value="50"') && E('logoyv').textContent === '50%');
    say('...and the preview has the same two columns and height as Home will have', g().includes('grid-template-columns:minmax(0,25fr) minmax(0,75fr);aspect-ratio:100 / 25') && g().indexOf('id="logoprev"') < g().indexOf('id="hdrprev"'));
    await home();
    say('Home shows the logo left of the picture, in two columns of one height', v().includes('class="homehead withlogo"') && v().includes('grid-template-columns:minmax(0,25fr) minmax(0,75fr);aspect-ratio:100 / 25') && v().indexOf(LOGO) < v().indexOf(PIC) && v().includes('class="hcell hlogo"') && v().includes('grid-column:1;') && v().includes('grid-column:2;'));
    say('...the picture itself carries no height of its own then (the header decides)', !v().includes('<img class="homebanner" src="' + PIC + '" alt="" style') && !v().includes('max-height:none"'));
    say('...there is no hidden copy of the picture when the height is set', !v().includes('hsizer'));
    run("state.settings.homeLogoSide='right'"); await home();
    say('on the right the picture comes first', v().includes('grid-template-columns:minmax(0,75fr) minmax(0,25fr)') && v().indexOf(PIC) < v().indexOf(LOGO) && /hcell hlogo" style="grid-column:2;/.test(v()));
    run("state.settings.homeLogoShare=40"); await home();
    say('the width of the logo sets the columns', v().includes('grid-template-columns:minmax(0,60fr) minmax(0,40fr)'));
    run("state.settings.homeHeaderHeight=''"); await home();
    say('with an automatic height the picture decides the height: no aspect ratio, and a hidden copy of the picture spans the header to give it', !v().includes('aspect-ratio') && v().includes('class="hsizer"') && v().includes('aria-hidden="true"') && (v().match(new RegExp(PIC, 'g')) || []).length === 2);
    run("state.settings.homeHeaderHeight=25; state.settings.homeLogoShare=25; state.settings.homeLogoSide='left'; state.settings.homeLogoPos={x:20,y:70}"); await home();
    say('the position of the logo is applied to the logo, not to the picture', /hlogo" style="grid-column:1;"><img src="[^"]*" alt="" style="object-position:20% 70%"/.test(v()) && !/homebanner"[^>]*object-position/.test(v()));
    run("state.settings.homeHeaderPos={x:10,y:90}"); await home();
    say('...and the position of the picture to the picture', /homebanner" src="[^"]*" alt="" style="object-position:10% 90%"/.test(v()) && /hlogo[^>]*><img src="[^"]*" alt="" style="object-position:20% 70%"/.test(v()));
    run("state.settings.homeHeaderPos={x:50,y:50}; state.settings.homeLogoPos={x:50,y:50}; state.settings.homeLogoShare=25");
    // the controls in App Settings
    await open();
    shape('logoprev', 120, 90, 500, 500); shape('hdrprev', 360, 90, 1600, 300); await run('render()'); await wait();
    say('a square logo in a wide space can only be moved left and right', E('logox').disabled === false && E('logoy').disabled === true);
    const n1 = calls.length; E('logow').value = '40'; E('logow').oninput();
    say('moving the width slider shows it at once, without saving', E('logowv').textContent === '40% of the header' && E('hdrbox').style.cssText.includes('minmax(0,40fr) minmax(0,60fr)') && calls.length === n1);
    await E('logow').onchange();
    say('letting go saves it', run('state.settings.homeLogoShare') === 40 && calls.slice(n1).some(c => c[1].homeLogoShare === 40));
    E('logox').value = '10'; E('logox').oninput();
    say('moving the Left / right slider shows the position at once, without saving', E('logoprev').style.cssText === 'object-position:10% 50%' && E('logoxv').textContent === '10%' && saved() === '{"x":50,"y":50}');
    await E('logox').onchange();
    say('letting go saves the position of the logo', saved() === '{"x":10,"y":50}');
    say('...and the position of the header picture is not touched', run('JSON.stringify(state.settings.homeHeaderPos)') === '{"x":50,"y":50}');
    await open(); shape('logoprev', 120, 90, 500, 500); shape('hdrprev', 360, 90, 1600, 300); await run('render()'); await wait();
    say('General shows the saved position and width again', E('logox').value === 10 && E('logoxv').textContent === '10%' && g().includes('40% of the header') && g().includes('object-position:10% 50%'));
    await E('logocenter').onclick(); await wait();
    say('Center the logo puts it back in the middle and saves that', saved() === '{"x":50,"y":50}' && E('logox').value === 50 && !E('logoprev').style.cssText.includes('object-position'));
    shape('logoprev', 120, 90, 800, 200); await run('render()'); await wait();
    say('a wide logo in a tall space can only be moved up and down', E('logox').disabled === true && E('logoy').disabled === false);
    shape('logoprev', 120, 90, 600, 450); await run('render()'); await wait();
    say('a logo of the shape of its space fills it: both sliders are greyed out', E('logox').disabled === true && E('logoy').disabled === true);
    // no picture: the logo alone
    run("state.settings.homeHeader=''; state.settings.homeHeaderHeight=''"); await open();
    say('with a logo and no header picture the Height slider is still offered, starting at 18%, without Automatic and without the picture position', g().includes('id="hdrh"') && !g().includes('id="hdrh" type="range" min="5" max="60" step="1" value="18" disabled') && g().includes('18% of the width') && !g().includes('id="hdrauto"') && !g().includes('id="hdrx"') && g().includes('id="logow"'));
    say('...and the preview shows the logo in a header of that height', g().includes('id="hdrbox"') && g().includes('aspect-ratio:100 / 18') && !g().includes('id="hdrprev"') && g().includes('id="logoprev"'));
    await home();
    say('Home shows the logo alone, in a header of 18% of the width', v().includes('withlogo') && v().includes('aspect-ratio:100 / 18') && !v().includes('homebanner') && !v().includes('hsizer') && v().includes('CLUBLOGO'));
    run("state.settings.homeHeaderHeight=30"); await open(); await home();
    say('...or the height that was set', v().includes('aspect-ratio:100 / 30'));
    // removing
    run(`state.settings.homeHeader='${PIC}'`); await open(); const n2 = calls.length; await E('logoclear').onclick(); await wait();
    say('Remove logo takes the logo away and keeps the other choices', run('state.settings.clubLogo') === '' && calls.slice(n2).some(c => c[1].clubLogo === '') && run('state.settings.homeLogoSide') === 'left' && !g().includes('id="logoside"') && !g().includes('id="logow"'));
    await home();
    say('...Home shows the header as before', v().includes('class="homebanner"') && !v().includes('withlogo'));
    run(`state.settings.clubLogo='${LOGO}'`); await open(); await E('logoside').onchange({ target: { value: '' } }); await wait();
    say('Not shown puts the header back as it was, and keeps the logo', run('state.settings.homeLogoSide') === '' && run('state.settings.clubLogo') === LOGO && !g().includes('id="logow"') && g().includes('id="logothumb"'));
    await home();
    say('...on the Home tab', !v().includes('withlogo') && !v().includes('CLUBLOGO'));
    // damaged saved values cannot add anything to the page
    for (const bad of [{ side: 'left;x:y', share: '5%;background:url(x)', pos: { x: '50%;background:url(x)', y: 'javascript:1' } }, { side: 'left', share: 'url(x)', pos: 'abc' }, { side: 'left', share: 9999, pos: { x: -40, y: 900 } }, { side: 'right', share: null, pos: null }]) {
      run(`state.settings.homeLogoSide=${JSON.stringify(bad.side)}; state.settings.homeLogoShare=${JSON.stringify(bad.share)}; state.settings.homeLogoPos=${JSON.stringify(bad.pos)}`); await home();
      const h = v().replace(LOGO, '').replace(PIC, '');
      say('a damaged saved logo setting cannot add anything to the page: ' + JSON.stringify(bad), !h.includes('url(') && !h.includes('javascript') && !h.includes('background') && !h.includes('x:y'));
    }
    // the Logo widget
    ctx.resizeImage = async () => 'data:image/png;base64,OWNLOGO';
    run(`state.settings={theme:'dark',clubLogo:'${LOGO}'}; state.editing=null; state.tab='custom'; state.customSub='layouts'`); await openEditor(); run("editorAdd('logo')");
    say('a Logo widget without a picture of its own shows the club logo in the layout editor, and says so', E('canvas').innerHTML.includes('CLUBLOGO') && E('side').innerHTML.includes('your club logo, from App Settings') && E('side').innerHTML.includes('CLUBLOGO') && !E('side').innerHTML.includes('Use the club logo'));
    await E('side').onchange({ target: { dataset: { optimg: 'image' }, files: [{}] } }); await wait();
    say('choosing a picture in the widget replaces it, for that widget only', E('canvas').innerHTML.includes('OWNLOGO') && !E('canvas').innerHTML.includes('CLUBLOGO') && run('state.editing.draft.widgets[0].opt.image') === 'data:image/png;base64,OWNLOGO');
    E('side').innerHTML = run('sideHtml()');
    say('...and the widget offers to go back to the club logo', E('side').innerHTML.includes('Use the club logo') && E('side').innerHTML.includes('OWNLOGO') && !E('side').innerHTML.includes('from App Settings'));
    E('side').onclick({ target: { closest: () => ({ dataset: { clearopt: 'image' } }) } });
    say('Use the club logo goes back to it', E('canvas').innerHTML.includes('CLUBLOGO') && !E('canvas').innerHTML.includes('OWNLOGO') && run('state.editing.draft.widgets[0].opt.image') === undefined);
    run("state.settings.clubLogo=''"); E('side').oninput({ target: { dataset: { opt: 'fit' }, value: 'contain', type: 'select-one' } }); E('side').innerHTML = run('sideHtml()');
    say('without a club logo the widget says where to set one, and shows nothing', E('side').innerHTML.includes('set your club logo in App Settings') && !E('canvas').innerHTML.includes('CLUBLOGO'));
    run("state.editing.draft.widgets[0].opt.image='data:own'"); E('side').innerHTML = run('sideHtml()');
    say('...and a picture of its own can only be removed then', E('side').innerHTML.includes('>Remove</button>') && !E('side').innerHTML.includes('Use the club logo'));
    delete ctx.resizeImage;
    run("state.settings={theme:'dark'}; state.editing=null; state.tab='home'; state.settingsSub='general'");
  });
  run("state.settings.homeHeader=''"); await run('render()');
  say('Home without a picture shows no banner', !E('view').innerHTML.includes('homebanner'));
  run("state.tab='custom'; state.customSub='audio'"); await run('render()');
  say('Customization has Layout Editor, Leaderboard Editor, Audio Settings and Image Settings', ['Layout Editor','Leaderboard Editor','Audio Settings','Image Settings'].every(t=>E('customtabs').innerHTML.includes(t)));
  run("state.editing=null"); await run('render()');
  say('Audio Settings: empty list with a New button', E('setupbox').innerHTML.includes('id="newaud"') && E('setupbox').innerHTML.includes('No audio sets yet'));
  await E('setupbox').onclick({target:{closest:()=>({id:'newaud',dataset:{}})}});
  say('a new audio set shows voice settings and every call with default sentences', ['au-name','au-voice','au-rate','au-by','au-save'].every(i=>E('setupbox').innerHTML.includes('id="'+i+'"')) && ['Before the start: said when Start is pressed','A new leader','Fastest lap of the race','Yellow flag','The winner'].every(t=>E('setupbox').innerHTML.includes(t)) && E('setupbox').innerHTML.includes('takes the lead'));
  say('the audio page lists every variable with what it says, an example and where it is used', ['{percent}','{left}','{penalty}','{lap}','{laps}','{other}','Every call about a driver','The race distance reached, in percent'].every(t=>E('setupbox').innerHTML.includes(t)) && E('setupbox').innerHTML.includes('audhelp'));
  await E('setupbox').onclick({target:{closest:()=>({dataset:{addline:'newleader'}})}});
  say('a sentence can be added to a call', (E('setupbox').innerHTML.match(/data-text="newleader:/g)||[]).length===4);
  E('setupbox').oninput({target:{dataset:{text:'newleader:3'},value:'Watch out, {driver} leads!'}});
  say('the Voice choice has a tooltip that tells how to install more voices in Windows 11 and Windows 10', (E('setupbox').innerHTML.match(/title="To add more voices[^"]*Manage voices &gt; Add voices[^"]*Text-to-speech option[^"]*"/g) || []).length === 3 && E('setupbox').innerHTML.includes('id="au-voicehelp"') && /<button type="button" class="linkbtn" id="au-voicehelp" aria-expanded="false"/.test(E('setupbox').innerHTML));
  { const html=()=>E('setupbox').innerHTML, note=()=>E('au-voicenote');
    say('1.16.2: "How do I get more voices?" is a real button (it can be reached with the keyboard), and the answer is not shown until it is clicked', /<button type="button" class="linkbtn" id="au-voicehelp"[^>]*>ⓘ How do I get more voices\?<\/button>/.test(html()) && html().includes('id="au-voicenote" role="note" hidden>'));
    E('au-voicehelp').onclick();
    say('...a click shows the answer on the page: the Windows 11 way, the restart, and the Windows 10 way', note().hidden === false && /Settings &gt; Time &amp; language &gt; Speech &gt; Manage voices &gt; Add voices/.test(html()) && html().includes('should show up in the app after a restart') && html().includes('Windows 10: Settings'));
    say('...the page remembers that it is shown', (await run('audVoiceNote')) === true);
    await run('renderAudioSetEditor(document.getElementById("setupbox"))');
    say('...the answer stays open when the editor is drawn again (a step, Undo or a folder), with aria-expanded for a screen reader, and a second click hides it', html().includes('id="au-voicenote" role="note">') && html().includes('aria-expanded="true"') && (E('au-voicehelp').onclick(), note().hidden === true && (await run('audVoiceNote')) === false));
    await run('renderAudioSetEditor(document.getElementById("setupbox"))');
    say('...hidden again after the next drawing', html().includes('id="au-voicenote" role="note" hidden>') && html().includes('aria-expanded="false"')); }
  { const box=()=>E('setupbox');
    say('1.16.1: the audio editor has a Voice report button, and the report is not shown until it is asked for', box().innerHTML.includes('id="au-vreport"') && box().innerHTML.includes('id="au-vbox" hidden') && voiceCalls.length===0);
    say('...the voice tooltip says that the Natural voices of Narrator (Andrew) are not offered to other apps, as far as we know, and points to the report', /Natural and Natural HD voices[^"]*Andrew[^"]*not offered to other apps[^"]*Voice report/.test(box().innerHTML));
    await E('au-vreport').onclick();
    const t=E('au-vtext').value;
    say('the report says what the app is offered (a count, none here) and what Windows lists: the two registry lists and the Windows Runtime voices, with the voice names', t.startsWith('SlotForge Timing: voice report') && t.includes('Voices the app is offered (0):') && t.includes('Windows registry, Speech_OneCore voices:\n  MSTTS_V110_enUS_DavidM') && t.includes('Windows Runtime voices (name | language | id):\n  Microsoft David | en-US') && voiceCalls.length===1 && E('au-vbox').hidden===false);
    voiceHost=new Error('no'); await E('au-vreport').onclick();
    say('...when Windows cannot be asked, the report still says what the app is offered, and says so', E('au-vtext').value.includes('Voices the app is offered (0):') && E('au-vtext').value.includes('The voice lists of Windows could not be asked.'));
    voiceHost={ windows:false, os:'linux 6.1', parts:[] }; await E('au-vreport').onclick();
    say('...on a computer that is not Windows it says there are no Windows lists', E('au-vtext').value.includes('not running Windows') && E('au-vtext').value.includes('on linux 6.1'));
    ctx.navigator = { ...(ctx.navigator||{}), clipboard:{ writeText: async x => { ctx.__copied = x; } } }; ctx.__copied='';
    await E('au-vcopy').onclick();
    say('the Copy button puts the report on the clipboard', ctx.__copied === E('au-vtext').value && E('au-vmsg').textContent === 'Copied.');
    ctx.navigator = { ...(ctx.navigator||{}), clipboard:{ writeText: async () => { throw new Error('denied'); } } }; await E('au-vcopy').onclick();
    say('...and when the clipboard says no, the page says what to do', E('au-vmsg').textContent.includes('Ctrl+C'));
    voiceHost={ windows:true, os:'win32 10.0.26220', parts:[{title:'Windows registry, Speech_OneCore voices',lines:['MSTTS_V110_enUS_DavidM']},{title:'Windows Runtime voices (name | language | id)',lines:['Microsoft David | en-US | HKEY_LOCAL_MACHINE\\X']}] }; }
  { const html = () => E('setupbox').innerHTML, openCount = () => (html().match(/<details class="audgroup"[^>]* open/g) || []).length, all = () => (html().match(/<details class="audgroup"/g) || []).length;
    say('the calls are in folders, one per group, all closed to start, each saying how many of its calls are on (the calls that talk a lot are off in the default set)', all() === 15 && openCount() === 0 && html().includes('<strong>Endurance</strong> <span class="muted">4 of 5 calls on</span>') && html().includes('<strong>Damage</strong> <span class="muted">7 of 8 calls on</span>') && html().includes('<strong>Weather</strong> <span class="muted">8 of 8 calls on</span>') && html().includes('<strong>Balance of Power</strong> <span class="muted">2 of 2 calls on</span>') && html().includes('<strong>Start</strong> <span class="muted">7 of 7 calls on</span>') && html().includes('<strong>Laps and records</strong>') && html().includes('<strong>Flags</strong> <span class="muted">5 of 5 calls on</span>') && html().includes('<strong>Time tokens</strong> <span class="muted">2 of 4 calls on</span>') && html().includes('<strong>Safety</strong> <span class="muted">0 of 4 calls on</span>') && html().includes('<strong>Laps and records</strong> <span class="muted">3 of 5 calls on</span>') && html().includes('<strong>Pit and fuel</strong> <span class="muted">4 of 6 calls on</span>') && html().includes('<strong>Penalties</strong> <span class="muted">3 of 6 calls on</span>'));
    say('...and the folders of the talkative calls say how many are off in a new set (Race progress 8 of 10, Gaps and battles 0 of 3)', html().includes('<strong>Race progress</strong> <span class="muted">8 of 10 calls on</span>') && html().includes('<strong>Gaps and battles</strong> <span class="muted">0 of 3 calls on</span>') && html().includes('<strong>Positions</strong> <span class="muted">2 of 2 calls on</span>'));
    say('every call sits inside its folder (the folder holds the fieldsets)', (html().match(/class="audcall"/g) || []).length === run('Announcer.CALLS.length') && run('Announcer.CALLS.length') === 78 && html().indexOf('<details class="audgroup"') < html().indexOf('class="audcall"'));
    await E('setupbox').onclick({target:{closest:()=>({dataset:{openall:'1'}})}});
    say('Open all folders opens every folder', openCount() === 15);
    await E('setupbox').onclick({target:{closest:()=>({dataset:{addline:'newleader'}})}});
    say('...and they stay open when the page redraws (a sentence was added)', openCount() === 15);
    await E('setupbox').onclick({target:{closest:()=>({dataset:{delline:'newleader:4'}})}});
    await E('setupbox').onclick({target:{closest:()=>({dataset:{openall:'0'}})}});
    say('Close all folders closes them again', openCount() === 0 && all() === 15); }
  { // the look of the Audio Settings folders: the same as the groups of the Add and Race Setup forms
    const css = fs.readFileSync(R + 'renderer/styles.css', 'utf8'), html = E('setupbox').innerHTML, rule = re => re.test(css);
    say('the folders look like the groups of the forms: the same rules, shared (an accent bar, a tinted header, an accent chevron)', rule(/\.fgroup,\.audgroup,\.dbfolder,\.audhelp\{[^}]*border-left:4px solid var\(--accent\)/) && rule(/\.fgroup>summary,\.audgroup>summary,\.dbfolder>summary,\.audhelp>summary\{[^}]*color-mix\(in srgb,var\(--accent\) 16%,var\(--panel\)\)/) && rule(/\.audgroup>summary::before[^{]*\{[^}]*border-right:2px solid var\(--accent\)/));
    say('...the chevron turns when a folder is open, the browser\'s own triangle is gone, and the keyboard focus shows', rule(/\.audgroup\[open\]>summary::before[^{]*\{[^}]*rotate\(45deg\)/) && rule(/\.audgroup>summary::-webkit-details-marker[^{]*\{display:none\}/) && rule(/\.audgroup>summary:focus-visible[^{]*\{[^}]*outline:2px solid var\(--accent\)/));
    say('...a folder that is closed has a header with round corners all round, as in the forms', rule(/\.audgroup:not\(\[open\]\)>summary[^{]*\{border-radius:7px\}/));
    say('the help folder has the same shape in a neutral colour, so that it is not taken for a place to change something', rule(/\.audhelp\{border-left-color:var\(--muted\)\}/) && rule(/\.audhelp>summary\{background:color-mix\(in srgb,var\(--muted\) 16%/) && html.includes('<details class="audhelp"') && /<details class="audhelp"[^>]*><summary>/.test(html));
    say('the calls in a folder are told apart by a line, not by a box', rule(/\.audgroup>\.audcall\{[^}]*border:0;border-top:1px solid var\(--line\)/) && rule(/\.audgroup>\.audcall:first-of-type\{border-top:0\}/));
    say('the name of a call (with its tick box) is a header over its sentences; one that is off is greyed', rule(/\.audcall>legend\{float:left;width:100%/) && rule(/\.audcall>legend\+\*\{clear:both\}/) && rule(/\.audcall>legend label:has\(input:not\(:checked\)\)\{color:var\(--muted\)/) && rule(/\.audcall input\[type=checkbox\]\{accent-color:var\(--accent\)/));
    say('the buttons to choose a sound file look like the other buttons, and Add a sentence has the accent colour', rule(/\.audcall input\[type=file\]::file-selector-button\{[^}]*border:1px solid var\(--line\);border-radius:6px/) && rule(/\.audcall \[data-addline\]\{border-style:dashed;color:var\(--accent\)\}/));
    say('a sentence has its sound file choice in a column of its own, so that Test and Delete line up; on a narrow window the row wraps', rule(/\.audfile\{[^}]*flex:0 0 17em/) && rule(/\.audcall \.audline\{[^}]*flex-wrap:wrap\}/) && rule(/\.audcall \.audline \.wide\{flex:1 1 16em;min-width:0/) && (html.match(/data-text="/g) || []).length > 20 && (html.match(/class="audfile"/g) || []).length === (html.match(/data-text="/g) || []).length);
    say('Open all folders and Close all folders sit in the same bar as in the forms, under the heading Calls', html.includes('<div class="fgtools audtools"><strong>Calls</strong><button class="btn" type="button" data-openall="1">Open all folders</button><button class="btn" type="button" data-openall="0">Close all folders</button></div>') && rule(/\.fgtools\{display:flex/));
    say('the names of the variables in the help table do not break in two', rule(/\.audhelp td:first-child\{white-space:nowrap\}/));
    ctx.__keepFile = run('audEd.draft.calls.yellowflag.lines[0].file'); run("audEd.draft.calls.yellowflag.lines[0].file='data:audio/mp3;base64,AAAA'"); run("renderAudioSetEditor(document.getElementById('setupbox'))");
    const withFile = E('setupbox').innerHTML, line = withFile.slice(withFile.indexOf('data-text="yellowflag:0"')), cell = line.slice(line.indexOf('<span class="audfile">'), line.indexOf('</span>', line.indexOf('data-nofile')) + 7);
    say('a sentence with a sound file keeps the Remove file button in the same column', cell.includes('sound file') && cell.includes('data-nofile="yellowflag:0"') && !cell.includes('type="file"'));
    run(`audEd.draft.calls.yellowflag.lines[0].file=${JSON.stringify(ctx.__keepFile || '')}`); run("renderAudioSetEditor(document.getElementById('setupbox'))"); }
  say('the race distance call has a field for the distances (50 by default)', E('setupbox').innerHTML.includes('id="au-dist" value="50"')); E('au-dist').onchange({target:{value:'25, 50, 75'}});
  { const h=E('setupbox').innerHTML, from=h.indexOf('data-group="Start"'), pre=h.slice(h.indexOf('Before the start', from), h.indexOf('Light 1 comes on', from)); // (the variables table above the folders names the call too)
    say('the pre-race call comes first in the Start folder, says what it does, and has a pause field (1 second by default)', from>0 && h.indexOf('Before the start', from)>from && h.indexOf('Before the start', from)<h.indexOf('Light 1 comes on', from) && pre.includes('Drivers, get ready. The race is about to start!') && pre.includes('The start lights wait until it has been said') && pre.includes('id="au-pause" min="0" max="10" step="0.5" value="1"') && !h.includes('Start lights begin'));
    const t=v=>{ const x={target:{value:v}}; E('au-pause').onchange(x); return [run('audEd.draft.preDelay'), x.target.value]; };
    say('the pause is kept between 0 and 10 seconds, and a wrong entry becomes 1', t('99')[0]===10 && t('-3')[0]===0 && t('')[0]===1 && t('abc')[0]===1 && t('0')[0]===0 && t('2.5')[0]===2.5 && t('4')[1]===4 && (t('2.5'),true)); }
  { const h = E('setupbox').innerHTML, at = k => h.indexOf(k), grp = g => at(`data-group="${g}"`), checked = id => new RegExp(`data-on="${id}" checked`).test(h);
    say('two new folders, Race progress and Gaps and battles, come after Positions and before Laps and records', grp('Positions') < grp('Race progress') && grp('Race progress') < grp('Gaps and battles') && grp('Gaps and battles') < grp('Laps and records'));
    say('...with their calls: laps to go, minutes to go, the distance call, last lap (leader and others), next heat, heat finished; closing in, battle, lapped', ['lapstogo', 'timetogo', 'distance', 'lastlap', 'lastlapother', 'nextheat', 'heatend'].every(id => at(`data-on="${id}"`) > grp('Race progress') && at(`data-on="${id}"`) < grp('Gaps and battles')) && ['closing', 'battle', 'lapped'].every(id => at(`data-on="${id}"`) > grp('Gaps and battles') && at(`data-on="${id}"`) < grp('Laps and records')));
    say('a new set has the talkative calls off (another driver on the last lap, closing in, battle, lapped) and the other new calls on', ['lastlapother', 'closing', 'battle', 'lapped'].every(id => at(`data-on="${id}"`) > 0 && !checked(id)) && ['lapstogo', 'timetogo', 'nextheat', 'heatend', 'lastlap', 'distance'].every(checked));
    say('laps to go has a field for the laps (3 by default) in its own call, and minutes to go one for the minutes (1)', (h.match(/id="au-lapsgo" value="3"/g) || []).length === 1 && (h.match(/id="au-mingo" value="1"/g) || []).length === 1 && at('id="au-lapsgo"') > at('data-on="lapstogo"') && at('id="au-lapsgo"') < at('data-on="timetogo"') && at('id="au-mingo"') > at('data-on="timetogo"') && at('id="au-mingo"') < at('data-on="distance"'));
    say('closing in has the gap field (1 second, 0.1 to 30), and the battle call the laps field (3, 2 to 20), each in its own call', h.includes('id="au-closegap" min="0.1" max="30" step="0.1" value="1"') && h.includes('id="au-battlelaps" min="2" max="20" step="1" value="3"') && at('id="au-closegap"') > at('data-on="closing"') && at('id="au-closegap"') < at('data-on="battle"') && at('id="au-battlelaps"') > at('data-on="battle"') && at('id="au-battlelaps"') < at('data-on="lapped"'));
    say('...each call lists the variables it can use', ['lapstogo:{left}', 'timetogo:{left}', 'closing:{gap}', 'lapped:{lapsdown}', 'nextheat:{heat}', 'heatend:{heats}', 'prerace:{track}'].every(x => { const [id, v] = x.split(':'); const from = at(`data-on="${id}"`); return h.slice(from, from + 6000).includes('You can use') && h.slice(from, h.indexOf('</fieldset>', from)).includes(v); }));
    E('au-lapsgo').onchange({ target: { value: ' 5, 2 ' } }); E('au-mingo').onchange({ target: { value: '2, 1' } });
    const gap = v => { const x = { target: { value: v } }; E('au-closegap').onchange(x); return [run('audEd.draft.closeGap'), x.target.value]; };
    const bl = v => { const x = { target: { value: v } }; E('au-battlelaps').onchange(x); return [run('audEd.draft.battleLaps'), x.target.value]; };
    say('the laps and minutes are kept as typed (trimmed), to be read when the race starts', run('audEd.draft.lapsToGo') === '5, 2' && run('audEd.draft.minutesToGo') === '2, 1');
    say('the gap is kept between 0.1 and 30 seconds, and a wrong entry becomes 1', gap('99')[0] === 30 && gap('0')[0] === 0.1 && gap('')[0] === 1 && gap('abc')[0] === 1 && gap('1.5')[0] === 1.5 && gap('2')[1] === 2);
    say('the laps of a battle are whole numbers from 2 to 20, and a wrong entry becomes 3', bl('25')[0] === 20 && bl('1')[0] === 2 && bl('')[0] === 3 && bl('x')[0] === 3 && bl('4')[0] === 4 && bl('2.6')[0] === 3 && bl('5')[1] === 5);
    gap('1.5'); bl('4'); }
  { const h = E('setupbox').innerHTML, at = k => h.indexOf(k), grp = g => at(`data-group="${g}"`), checked = id => new RegExp(`data-on="${id}" checked`).test(h);
    const fresh = ['firstlap', 'nearrecord', 'fuelhalf', 'refuelled', 'penaltyserved', 'penaltyforgiven', 'penaltytime', 'lanecall', 'nolap', 'trackmatelost', 'trackmateback', 'tokenadded', 'tokenfree'];
    say('a new Safety folder comes after Flags and before Finish, with the call from a lane, no lap for a while, and the Trackmate lost and back', grp('Flags') < grp('Safety') && grp('Safety') < grp('Finish') && ['lanecall', 'nolap', 'trackmatelost', 'trackmateback'].every(id => at(`data-on="${id}"`) > grp('Safety') && at(`data-on="${id}"`) < grp('Finish')));
    say('...and the other new calls sit in their folders: laps and records, pit and fuel, penalties, time tokens', [['firstlap', 'Laps and records', 'Pit and fuel'], ['nearrecord', 'Laps and records', 'Pit and fuel'], ['fuelhalf', 'Pit and fuel', 'Penalties'], ['refuelled', 'Pit and fuel', 'Penalties'], ['penaltyserved', 'Penalties', 'Flags'], ['penaltyforgiven', 'Penalties', 'Flags'], ['penaltytime', 'Penalties', 'Flags'], ['tokenadded', 'Time tokens', null], ['tokenfree', 'Time tokens', null]].every(([id, from, to]) => at(`data-on="${id}"`) > grp(from) && (!to || at(`data-on="${id}"`) < grp(to))));
    say('all 13 new calls are off in a new set', fresh.every(id => at(`data-on="${id}"`) > 0 && !checked(id)));
    say('close to the record has a field (0.1 seconds, 0.01 to 5) in its own call, and no lap a field (30 seconds, 5 to 600) in its own call', h.includes('id="au-nearrecord" min="0.01" max="5" step="0.01" value="0.1"') && h.includes('id="au-nolap" min="5" max="600" step="1" value="30"') && at('id="au-nearrecord"') > at('data-on="nearrecord"') && at('id="au-nearrecord"') < at('data-on="fuelhalf"') && at('id="au-nolap"') > at('data-on="nolap"') && at('id="au-nolap"') < at('data-on="trackmatelost"'));
    say('...the variables of the new calls are listed under them', ['firstlap:{time}', 'nearrecord:{off}', 'fuelhalf:{fuel}', 'refuelled:{refuelled}', 'penaltyserved:{penalty}', 'penaltytime:{added}', 'lanecall:{lane}', 'nolap:{seconds}', 'tokenadded:{added}', 'pitout:{pit}', 'trackrecord:{improved}', 'personalbest:{record}'].every(x => { const [id, v] = x.split(':'); const from = at(`data-on="${id}"`); return h.slice(from, h.indexOf('</fieldset>', from)).includes(v); }));
    say('the table of variables has the new words, and says which ones every call has', ['gapahead', 'record', 'improved', 'off', 'pit', 'refuelled', 'added'].every(v => h.includes(`<code>{${v}}</code>`)) && /<code>\{gapahead\}<\/code><\/td><td>[^<]*<\/td><td>[^<]*<\/td><td class="muted">Every call about a driver/.test(h) && /<code>\{record\}<\/code><\/td><td>[^<]*<\/td><td>[^<]*<\/td><td class="muted">Every call</.test(h) && /<code>\{lane\}<\/code><\/td><td>[^<]*<\/td><td>[^<]*<\/td><td class="muted">Every call about a driver/.test(h));
    const nr = v => { const x = { target: { value: v } }; E('au-nearrecord').onchange(x); return [run('audEd.draft.nearRecord'), x.target.value]; };
    const nl = v => { const x = { target: { value: v } }; E('au-nolap').onchange(x); return [run('audEd.draft.noLapSeconds'), x.target.value]; };
    say('the distance to the record is kept between 0.01 and 5 seconds, and a wrong entry becomes 0.1', nr('99')[0] === 5 && nr('0')[0] === 0.01 && nr('')[0] === 0.1 && nr('abc')[0] === 0.1 && nr('0.25')[0] === 0.25 && nr('2')[1] === 2);
    say('the time without a lap is whole seconds from 5 to 600, and a wrong entry becomes 30', nl('9999')[0] === 600 && nl('1')[0] === 5 && nl('')[0] === 30 && nl('x')[0] === 30 && nl('45')[0] === 45 && nl('12.6')[0] === 13 && nl('60')[1] === 60);
    nr('0.25'); nl('45'); }
  // ---------- 0.89.0: the Only if box of a sentence, and the wait of a call ----------
  store.drivers = [{ id: 'd1', name: 'Alex' }, { id: 'd2', name: 'Sam' }];
  { run("audDrivers = [{ id: 'd1', name: 'Alex' }, { id: 'd2', name: 'Sam' }]"); run('renderAudioSetEditor(document.getElementById("setupbox"))');
    const h = () => E('setupbox').innerHTML, at = k => h().indexOf(k), callEnd = id => h().indexOf('</fieldset>', at(`data-on="${id}"`)), within = (id, k) => { const i = h().indexOf(k, at(`data-on="${id}"`)); return i > 0 && i < callEnd(id); };
    const cond = (id, n, k, v) => E('setupbox').onchange({ target: { dataset: { cond: k, line: `${id}:${n}` }, value: v } });
    say('a call about a driver has an Only if box under every sentence, with the driver, the top and the gap (and the lap time where a time is said)', ['newleader', 'overtake', 'pitin', 'fastestlap'].every(id => within(id, 'data-cond="driver" data-line="' + id + ':0"') && within(id, 'data-cond="top" data-line="' + id + ':0"') && within(id, 'data-cond="gap" data-line="' + id + ':0"')) && within('fastestlap', 'data-cond="time" data-line="fastestlap:0"') && !within('newleader', 'data-cond="time"') && !within('pitin', 'data-cond="time"'));
    say('...a Time Token call only has the driver; a call that is not about a driver has none', within('tokenwarning', 'data-cond="driver"') && !within('tokenwarning', 'data-cond="top"') && !within('tokenwarning', 'data-cond="gap"') && !within('yellowflag', 'class="audcond"') && !within('finished', 'class="audcond"') && !within('countdown5', 'class="audcond"'));
    say('...each sentence has its own box', (h().slice(at('data-on="newleader"'), callEnd('newleader')).match(/class="audcond"/g) || []).length === run('audEd.draft.calls.newleader.lines.length') && run('audEd.draft.calls.newleader.lines.length') >= 2);
    say('the driver choice lists "anyone" and the drivers of the database', within('newleader', '<option value="">anyone</option><option value="d1">Alex</option><option value="d2">Sam</option>'));
    say('the box is closed to begin with, and says nothing about conditions that are not set', !within('newleader', 'class="audcond" data-cond-key="newleader:0" open') && within('newleader', '<summary>Only if&hellip;</summary>'));
    cond('newleader', 1, 'driver', 'd2'); cond('newleader', 1, 'top', '3');
    say('choosing a driver and a top number are kept in the sentence (and a step to undo)', JSON.stringify(run('audEd.draft.calls.newleader.lines[1].only')) === '{"driver":"d2","top":3}' && run('audEd.dirty') === true);
    say('...the summary of the box says what is set, and the driver and the number show again', within('newleader', '<summary>Only if&hellip; <span class="muted">(Sam, top 3)</span></summary>') && within('newleader', '<option value="d2" selected>Sam</option>') && within('newleader', 'data-cond="top" data-line="newleader:1" min="1" max="99" step="1" value="3"'));
    say('...the other sentence is untouched', run('audEd.draft.calls.newleader.lines[0].only') === undefined);
    const top = v => { cond('newleader', 0, 'top', v); const o = run('audEd.draft.calls.newleader.lines[0].only'); return o ? o.top : undefined; };
    say('the top is a whole number from 1 to 99; empty, 0, negative or nonsense takes it away', top('99') === 99 && top('120') === 99 && top('2.6') === 3 && top('0.4') === 1 && top('') === undefined && top('5') === 5 && top('0') === undefined && top('4') === 4 && top('-2') === undefined && top('x') === undefined);
    const tim = v => { cond('fastestlap', 0, 'time', v); const o = run('audEd.draft.calls.fastestlap.lines[0].only'); return o ? o.time : undefined; };
    say('the lap time is from 0.1 to 3600 seconds, with decimals; empty or 0 takes it away', tim('5.25') === 5.25 && tim('9999') === 3600 && tim('0.01') === 0.1 && tim('0') === undefined && tim('4.9') === 4.9 && tim('') === undefined);
    const gp = v => { cond('pitin', 0, 'gap', v); const o = run('audEd.draft.calls.pitin.lines[0].only'); return o ? o.gap : undefined; };
    say('the gap is from 0.1 to 600 seconds; empty or 0 takes it away', gp('2.5') === 2.5 && gp('9999') === 600 && gp('0.01') === 0.1 && gp('0') === undefined && gp('1.5') === 1.5 && gp('') === undefined);
    cond('pitin', 0, 'gap', '2'); cond('pitin', 0, 'driver', 'd1'); cond('pitin', 0, 'gap', ''); cond('pitin', 0, 'driver', '');
    say('when every condition is taken away the sentence has none at all (nothing empty is stored)', run('audEd.draft.calls.pitin.lines[0].only') === undefined && !('only' in run('audEd.draft.calls.pitin.lines[0]')));
    cond('newleader', 0, 'top', '4'); // keep one for the saving tests below
    run('audCond.add("newleader:1")'); run('renderAudioSetEditor(document.getElementById("setupbox"))');
    say('a box that was opened stays open when the page is drawn again', within('newleader', 'class="audcond" data-cond-key="newleader:1" open') && !within('newleader', 'class="audcond" data-cond-key="newleader:0" open'));
    run('audDrivers = [{ id: "d1", name: "Alex" }]'); run('renderAudioSetEditor(document.getElementById("setupbox"))');
    say('a driver that is not in the database any more is shown as gone, and the sentence keeps its condition', within('newleader', '<option value="d2" selected>(a driver that is gone)</option>') && within('newleader', '(a driver that is gone, top 3)'));
    run("audDrivers = [{ id: 'd1', name: 'Alex' }, { id: 'd2', name: 'Sam' }]"); run('renderAudioSetEditor(document.getElementById("setupbox"))');
    // the wait
    const cool = (id, v) => { E('setupbox').onchange({ target: { dataset: { cool: id }, value: v } }); return run(`audEd.draft.calls.${id}.cooldown`); };
    say('every call except the start countdown and the finish has a "not again within" box (empty to begin with), and the calls about a driver choose whom it counts for', ['newleader', 'yellowflag', 'tokenwarning', 'lapstogo', 'trackmatelost'].every(id => within(id, `data-cool="${id}" min="1" max="3600" step="1" value=""`)) && ['newleader', 'tokenwarning'].every(id => within(id, `<select data-coolfor="${id}"><option value="all">for the whole call</option><option value="driver">for each driver</option></select>`)) && !within('yellowflag', 'data-coolfor') && !within('prerace', 'data-cool=') && !within('countdown3', 'data-cool=') && !within('finished', 'data-cool=') && !within('winner', 'data-cool='));
    say('the wait is whole seconds from 1 to 3600; empty, 0, negative or nonsense takes it away', cool('overtake', '30') === 30 && cool('overtake', '99999') === 3600 && cool('overtake', '2.6') === 3 && cool('overtake', '0.2') === 1 && cool('overtake', '') === undefined && cool('overtake', '20') === 20 && cool('overtake', '0') === undefined && cool('overtake', '-4') === undefined && cool('overtake', 'x') === undefined);
    cool('overtake', '45'); E('setupbox').onchange({ target: { dataset: { coolfor: 'overtake' }, value: 'driver' } });
    say('counting for each driver is kept, and shows again', run('audEd.draft.calls.overtake.coolFor') === 'driver' && within('overtake', 'data-cool="overtake" min="1" max="3600" step="1" value="45"') && within('overtake', '<option value="driver" selected>for each driver</option>'));
    E('setupbox').onchange({ target: { dataset: { coolfor: 'overtake' }, value: 'all' } });
    say('...and "for the whole call" takes it away again', run('audEd.draft.calls.overtake.coolFor') === undefined);
    E('setupbox').onchange({ target: { dataset: { coolfor: 'overtake' }, value: 'driver' } });
    // Test ignores the conditions and the wait
    run("Sound.state.backend={voices:()=>[],speak(t,o,d){d()},file(u,o,d){d()},stop(){}}"); run('Sound.state.log.length = 0');
    run("audEd.draft.calls.newleader.lines[1].text = 'Only for Sam in the top 3'");
    await E('setupbox').onclick({ target: { closest: () => ({ dataset: { test: 'newleader:1' } }) } });
    say('the Test button of a sentence with conditions speaks it all the same (the conditions are about a real race)', run('Sound.state.log[Sound.state.log.length-1]') === 'Only for Sam in the top 3' && E('au-msg').textContent === '');
    run('Sound.state.backend = null');
    // deleting a sentence closes the boxes of that call (the numbers of the sentences after it change)
    await E('setupbox').onclick({ target: { closest: () => ({ dataset: { addline: 'pitin' } }) } }); run('audCond.add("pitin:1")'); run('audCond.add("newleader:1")');
    await E('setupbox').onclick({ target: { closest: () => ({ dataset: { delline: 'pitin:1' } }) } });
    say('deleting a sentence closes the Only if boxes of its call, and of no other call', run('audCond.has("pitin:1")') === false && run('audCond.has("newleader:1")') === true && run('audEd.draft.calls.pitin.lines.length') === 2);
  }
  E('setupbox').onchange({target:{dataset:{on:'redflag'},checked:false}}); E('au-name').oninput({target:{value:'Commentator'}}); E('au-by').onchange({target:{value:'nickname'}});
  const nA=calls.length; await E('au-save').onclick();
  const addA=calls.slice(nA).find(c=>c[0]==='add'&&c[1]==='audiosets');
  say('saving stores the set: name, driver style, sentences and calls turned off', addA && addA[2].name==='Commentator' && addA[2].driverBy==='nickname' && addA[2].calls.newleader.lines[3].text==='Watch out, {driver} leads!' && addA[2].calls.redflag.on===false && addA[2].distances==='25, 50, 75' && addA[2].lapsToGo==='5, 2' && addA[2].minutesToGo==='2, 1' && addA[2].closeGap===1.5 && addA[2].battleLaps===4 && addA[2].preDelay===2.5 && addA[2].calls.prerace.on===true && addA[2].calls.prerace.lines[0].text==='Drivers, get ready. The race is about to start!');
  say('...and the distance to the record and the time without a lap', addA && addA[2].nearRecord === 0.25 && addA[2].noLapSeconds === 45);
  say('...and the conditions of the sentences and the wait of the calls', addA && JSON.stringify(addA[2].calls.newleader.lines[1].only) === '{"driver":"d2","top":3}' && addA[2].calls.newleader.lines[0].only.top === 4 && addA[2].calls.overtake.cooldown === 45 && addA[2].calls.overtake.coolFor === 'driver' && !('only' in addA[2].calls.pitin.lines[0]) && addA[2].calls.fastestlap.lines[0].only === undefined && addA[2].calls.winner.cooldown === undefined);
  E('au-back').onclick(); await new Promise(r=>setTimeout(r,50));
  say('the saved set is in the list', E('setupbox').innerHTML.includes('Commentator'));
  store.drivers = [{ id: 'd1', name: 'Alex' }, { id: 'd2', name: 'Sam' }]; run('audDrivers = []');
  await E('setupbox').onclick({target:{closest:()=>({dataset:{edit:'L1'}})}});
  say('editing a saved audio set shows its own race distances, not the default 50, and its own pause', E('setupbox').innerHTML.includes('id="au-dist" value="25, 50, 75"') && E('setupbox').innerHTML.includes('id="au-pause" min="0" max="10" step="0.5" value="2.5"') && E('setupbox').innerHTML.includes('id="au-lapsgo" value="5, 2"') && E('setupbox').innerHTML.includes('id="au-mingo" value="2, 1"') && E('setupbox').innerHTML.includes('value="1.5"') && E('setupbox').innerHTML.includes('id="au-battlelaps" min="2" max="20" step="1" value="4"'));
  say('...the conditions and the wait show again when it is edited (with the drivers of the database, which are fetched when the editor opens)', run('audDrivers').map(x => x.name).join() === 'Alex,Sam' && E('setupbox').innerHTML.includes('<option value="">anyone</option><option value="d1">Alex</option><option value="d2" selected>Sam</option>') && JSON.stringify(run('audEd.draft.calls.newleader.lines[1].only')) === '{"driver":"d2","top":3}' && run('audEd.draft.calls.overtake.cooldown') === 45 && E('setupbox').innerHTML.includes('data-cond="top" data-line="newleader:1" min="1" max="99" step="1" value="3"') && E('setupbox').innerHTML.includes('data-cool="overtake" min="1" max="3600" step="1" value="45"'));
  say('...and they show again when it is edited', E('setupbox').innerHTML.includes('id="au-nearrecord" min="0.01" max="5" step="0.01" value="0.25"') && E('setupbox').innerHTML.includes('id="au-nolap" min="5" max="600" step="1" value="45"'));
  E('au-back').onclick(); await new Promise(r=>setTimeout(r,50));
  const nD=calls.length; await E('setupbox').onclick({target:{closest:()=>({dataset:{dup:'L1'}})}});
  const dupA=calls.slice(nD).find(c=>c[0]==='add'&&c[1]==='audiosets');
  say('duplicating an audio set keeps its race distances', dupA && dupA[2].name==='Commentator (copy)' && dupA[2].distances==='25, 50, 75' && dupA[2].lapsToGo==='5, 2' && dupA[2].minutesToGo==='2, 1' && dupA[2].closeGap===1.5 && dupA[2].battleLaps===4);
  store.drivers = [];
  say('...duplicating keeps them too', dupA && dupA[2].nearRecord === 0.25 && dupA[2].noLapSeconds === 45 && JSON.stringify(dupA[2].calls.newleader.lines[1].only) === '{"driver":"d2","top":3}' && dupA[2].calls.overtake.cooldown === 45 && dupA[2].calls.overtake.coolFor === 'driver');
  // the Test button of a sentence: it speaks the sentence, and says so when the sentence is empty
  await E('setupbox').onclick({target:{closest:()=>({dataset:{edit:'L1'}})}});
  run("Sound.state.backend={voices:()=>[],speak(t,o,d){d()},file(u,o,d){d()},stop(){}}");
  E('setupbox').oninput({target:{dataset:{text:'redflag:0'},value:'Stop the cars'}});
  await E('setupbox').onclick({target:{closest:()=>({dataset:{test:'redflag:0'}})}});
  say('the Test button speaks the sentence and clears the message', run("Sound.state.log[Sound.state.log.length-1]")==='Stop the cars' && E('au-msg').textContent==='');
  E('setupbox').oninput({target:{dataset:{text:'redflag:0'},value:'  '}});
  await E('setupbox').onclick({target:{closest:()=>({dataset:{test:'redflag:0'}})}});
  say('the Test button says so when the sentence is empty', E('au-msg').textContent==='This sentence is empty.');
  run("Sound.state.backend=null"); E('au-back').onclick(); await new Promise(r=>setTimeout(r,50));
  run("state.tab='custom'; state.customSub='widgets'"); await run('render()');
  say('Customization has a Widget Builder tab, and its list starts empty with a New button', E('customtabs').innerHTML.includes('Widget Builder') && E('setupbox').innerHTML.includes('id="newwb"') && E('setupbox').innerHTML.includes('No widgets yet'));
  await E('setupbox').onclick({target:{closest:()=>({id:'newwb',dataset:{}})}});
  say('a new widget has name, kind, text, variable buttons, size and a preview', ['wb-name','wb-type','wb-text','wb-w','wb-h','wb-size','wb-save','wb-prev'].every(i=>E('setupbox').innerHTML.includes('id="'+i+'"')) && E('setupbox').innerHTML.includes('data-var="best"'));
  say('1.34.1: the width and the height of a custom widget can be as small as a widget can be (5)', /id="wb-w" type="number" min="5"/.test(E('setupbox').innerHTML) && /id="wb-h" type="number" min="5"/.test(E('setupbox').innerHTML));
  await E('wb-save').onclick(); say('saving without a name is refused', !calls.slice(-1).some(c=>c[0]==='add'&&c[1]==='customwidgets'));
  E('wb-name').oninput({target:{value:'Best lap line'}}); E('wb-text').oninput({target:{value:'{name}: {best}'}}); E('wb-size').onchange({target:{value:'44'}});
  const nW=calls.length; await E('wb-save').onclick();
  const addW=calls.slice(nW).find(c=>c[0]==='add'&&c[1]==='customwidgets');
  say('saving stores the widget', addW && addW[2].name==='Best lap line' && addW[2].type==='textlane' && addW[2].text==='{name}: {best}' && addW[2].textSize===44);
  say('the kind list offers text and image widgets', ['textlane','textrace','imagelane','imagerace'].every(k=>E('setupbox').innerHTML.includes('value="'+k+'"')));
  E('wb-type').onchange({target:{value:'imagelane'}});
  say('an image widget has a fixed picture, a fit and a rule list with an Add button', ['wb-fit','wb-addrule'].every(i=>E('setupbox').innerHTML.includes('id="'+i+'"')) && E('setupbox').innerHTML.includes('data-pic="fixed"') && E('setupbox').innerHTML.includes('No rules yet'));
  E('wb-addrule').onclick(); E('wb-addrule').onclick();
  say('rules can be added (variable, comparison, value, picture)', (E('setupbox').innerHTML.match(/data-rule="/g)||[]).length===2 && E('setupbox').innerHTML.includes('data-rv="1"'));
  E('setupbox').onchange({target:{dataset:{rv:'0'},value:'position'}}); E('setupbox').onchange({target:{dataset:{rval:'0'},value:'1'}});
  E('setupbox').onclick({target:{closest:()=>({dataset:{rdel:'1'}})}});
  say('a rule can be removed', (E('setupbox').innerHTML.match(/data-rule="/g)||[]).length===1);
  const nWI=calls.length; E('wb-name').oninput({target:{value:'Trophy'}}); await E('wb-save').onclick();
  const addWI=calls.slice(nWI).find(c=>c[0]==='update'&&c[1]==='customwidgets'); if(addWI) addWI[2]=addWI[3];
  say('saving an image widget stores its rules', addWI && addWI[2].type==='imagelane' && addWI[2].rules.length===1 && addWI[2].rules[0].var==='position' && addWI[2].rules[0].value==='1');
  E('wb-back').onclick(); await new Promise(r=>setTimeout(r,50));
  say('the saved widget is in the list', E('setupbox').innerHTML.includes('Trophy') && E('setupbox').innerHTML.includes('1 rule(s)'));
  store.tracks=[{id:'t1',name:'Living room',lanes:2}]; run("state.tab='settings'; state.settingsSub='transfer'"); await run('render()');
  say('App Settings has an Import and Export tab with the groups, an export button and an import button', ['Import and Export','Database','Look and sound','History','id="tr-export"','id="tr-open"'].every(t=>(E('settingstabs').innerHTML+E('settingsbox').innerHTML).includes(t)) && E('settingsbox').innerHTML.includes('Living room') && E('settingsbox').innerHTML.includes('disabled'));
  E('settingsbox').onchange({target:{id:'',checked:true,dataset:{item:'tracks:t1'}}}); await new Promise(r=>setTimeout(r,30));
  say('ticking an item enables the export button and counts it', !/id="tr-export" disabled/.test(E('settingsbox').innerHTML) && E('settingsbox').innerHTML.includes('Export 1 ticked item to a file'));
  run("trState.open.add('g:Database'); trState.open.add('e:tracks')"); await run("renderTransferSettings(document.getElementById('settingsbox'))"); await new Promise(r=>setTimeout(r,30));
  say('the groups that are open stay open when the page is drawn again', E('settingsbox').innerHTML.includes('data-key="g:Database" open') && E('settingsbox').innerHTML.includes('data-key="e:tracks" open') && !E('settingsbox').innerHTML.includes('data-key="g:History" open'));
  depsResult={layouts:[{id:'l9',required:false}],tracks:[{id:'t1',required:true}]}; store.layouts=[{id:'l9',name:'Used layout',widgets:[]}];
  E('settingsbox').onchange({target:{checked:true,dataset:{item:'racesetups:r1'}}}); await new Promise(r=>setTimeout(r,30));
  say('what the ticked items use is listed with a tick box each, and what a session needs cannot be unticked', E('settingsbox').innerHTML.includes('Also take what these items use') && E('settingsbox').innerHTML.includes('Used layout') && E('settingsbox').innerHTML.includes('data-dep="layouts:l9"') && /data-dep="tracks:t1"[^>]*disabled/.test(E('settingsbox').innerHTML));
  E('settingsbox').onchange({target:{checked:false,dataset:{dep:'layouts:l9'}}}); await new Promise(r=>setTimeout(r,30)); await E('tr-export').onclick();
  say('exporting sends the ticked items and only the things they use that are still ticked', xfer.some(x=>x[0]==='export' && x[1].tracks[0]==='t1' && x[1].racesetups[0]==='r1' && !(x[2].layouts||[]).length && x[2].tracks[0]==='t1'));
  await E('tr-open').onclick(); await new Promise(r=>setTimeout(r,30));
  say('a chosen file is described before anything is added', E('settingsbox').innerHTML.includes('my.json') && E('settingsbox').innerHTML.includes('2 tracks') && E('settingsbox').innerHTML.includes('1 layout') && E('settingsbox').innerHTML.includes('id="tr-apply"'));
  await E('tr-apply').onclick(); await new Promise(r=>setTimeout(r,30));
  say('adding applies the import and says what was added', xfer.some(x=>x[0]==='apply') && E('settingsbox').innerHTML.includes('Added 1 layout, 2 tracks'));
  importResult={ok:false,error:'This is not an export file from this app.'}; await E('tr-open').onclick(); await new Promise(r=>setTimeout(r,30));
  say('a wrong file shows the reason', E('settingsbox').innerHTML.includes('This is not an export file') || E('tr-msg').textContent.includes('not an export file'));
  say('the page starts with the complete backup section', E('settingsbox').innerHTML.includes('Complete backup') && E('settingsbox').innerHTML.indexOf('Complete backup') < E('settingsbox').innerHTML.indexOf('data-folder="transfer:export"') && E('settingsbox').innerHTML.includes('id="bk-save"'));
  say('Import and Export is three folders (backup, export, import), open at first, with the same Open all and Close all as Results and Records', ['backup', 'export', 'import'].every(f => E('settingsbox').innerHTML.includes('data-folder="transfer:' + f + '"')) && (E('settingsbox').innerHTML.match(/<details class="dbfolder"[^>]* open/g) || []).length === 3 && E('settingsbox').innerHTML.includes('data-folderall="1"') && !E('settingsbox').innerHTML.includes('<h3>'));
  E('settingsbox').onclick({ target: { closest: () => ({ dataset: { folderall: '0' } }) } }); await new Promise(r => setTimeout(r, 40));
  say('...Close all closes the three, and the buttons are still there (the page is drawn again)', !/<details class="dbfolder"[^>]* open/.test(E('settingsbox').innerHTML) && E('settingsbox').innerHTML.includes('id="bk-save"') && E('settingsbox').innerHTML.includes('id="tr-open"'));
  E('settingsbox').onclick({ target: { closest: () => ({ dataset: { folderall: '1' } }) } }); await new Promise(r => setTimeout(r, 40));
  say('...and Open all opens them again, the Export folder says how many items are ticked', (E('settingsbox').innerHTML.match(/<details class="dbfolder"[^>]* open/g) || []).length === 3 && /transfer:export"[^>]*><summary><strong>Export<\/strong> <span class="muted">(\d+ ticked|choose what to save in a file)<\/span>/.test(E('settingsbox').innerHTML));
  await E('bk-save').onclick(); await new Promise(r=>setTimeout(r,20));
  say('saving a backup asks for a file and says where it went', xfer.some(x=>x[0]==='bksave') && E('bk-msg').textContent.includes('C:/b.json'));
  await E('bk-open').onclick(); await new Promise(r=>setTimeout(r,30));
  say('a chosen backup is described and a warning says everything is replaced', E('settingsbox').innerHTML.includes('b.json') && E('settingsbox').innerHTML.includes('2 tracks') && E('settingsbox').innerHTML.includes('30 laps') && E('settingsbox').innerHTML.includes('replaces everything') && E('settingsbox').innerHTML.includes('id="bk-apply"'));
  await E('bk-cancel').onclick(); await new Promise(r=>setTimeout(r,20));
  say('cancel leaves everything alone', xfer.some(x=>x[0]==='bkcancel') && !xfer.some(x=>x[0]==='bkrestore') && !E('settingsbox').innerHTML.includes('id="bk-apply"'));
  await E('bk-open').onclick(); await new Promise(r=>setTimeout(r,30)); await E('bk-apply').onclick(); await new Promise(r=>setTimeout(r,30));
  say('restoring runs after the question is answered with yes', xfer.some(x=>x[0]==='bkrestore'));
  bkResult={ok:false,error:'This is not a backup file from this app.'}; await E('bk-open').onclick(); await new Promise(r=>setTimeout(r,30));
  say('a wrong backup file shows the reason', E('bk-msg').textContent.includes('not a backup file') || E('settingsbox').innerHTML.includes('not a backup file'));
  run("state.customSub='layouts'");
  run("state.settings.rules='';state.tab='rules'"); await run('render()');
  say('Racing Rules tab shows a text editor with a formatting bar', E('view').innerHTML.includes('id="rules"') && E('view').innerHTML.includes('contenteditable="true"') && ['bold','italic','underline','insertUnorderedList','removeFormat','heading'].every(c => E('view').innerHTML.includes('data-cmd="'+c+'"')) && E('view').innerHTML.includes('id="rte-size"') && E('view').innerHTML.includes('id="rte-color"'));
  const before=calls.filter(c=>c[0]==='settings').length;
  E('rules').innerHTML='1. No pushing.<br>2. <b>Respect</b> the marshals.<script>x()</script>'; E('rules').oninput();
  await new Promise(r=>setTimeout(r,800));
  const sv=calls.filter(c=>c[0]==='settings').slice(before).pop();
  say('rules are saved as you type, formatting kept and anything unsafe removed', sv && sv[1].rules==='1. No pushing.<br>2. <b>Respect</b> the marshals.');
  E('rules').innerHTML='Changed'; E('rules').oninput(); E('rules').onblur(); await new Promise(r=>setTimeout(r,20));
  say('leaving the box saves straight away', calls.filter(c=>c[0]==='settings').pop()[1].rules==='Changed');
  say('the Racing Rules button is the same stand-out button (accent fill, a page picture in front of the words)', /<button class="btn primary pdfbtn" type="button" id="rules-pdf"><svg[^>]*>.*<\/svg><span>Export to PDF<\/span><\/button>/.test(E('view').innerHTML));
  say('Racing Rules has an Export to PDF button and the credit at the bottom right of the text: the thanks, one line each', E('view').innerHTML.includes('id="rules-pdf"') && E('view').innerHTML.includes('class="rules-credit"') && E('view').innerHTML.includes('made by Claude and theDutchmanJames.<br>For all Slotcar Enthusiasts and special thanks to:<br>Bjorn F. - For being my best mate!<br>') && E('view').innerHTML.includes('Johnno @Slotracer, for the first constructive feedback</p>') && E('view').innerHTML.includes('LMP &amp; Superslab @Slotforum'));
  { const before = exported.length; E('rules').innerHTML=''; await E('rules-pdf').onclick();
    say('an empty rules text is not exported', exported.length === before && E('rulesmsg').textContent.includes('Write some rules'));
    E('rules').innerHTML='<h2>Safety</h2>No pushing'; await E('rules-pdf').onclick();
    const last = exported[exported.length-1];
    say('the rules are sent to be saved as a PDF', exported.length === before+1 && last[1] === 'Racing Rules.pdf' && last[0].includes('<h2>Safety</h2>No pushing') && last[0].includes('Racing Rules') &&E('rulesmsg').textContent.includes('Saved to'));
    exported.length = 0; } // the session report test below counts its own exports
  const execs=[]; document.execCommand=(...a)=>{execs.push(a); return true}; 
  E('rte-bar').onclick({target:{closest:()=>({dataset:{cmd:'bold'}})}});
  say('the Bold button formats the selection', execs.some(a=>a[0]==='bold'));
  E('rte-size').onchange({target:{value:'5'}}); E('rte-color').onchange({target:{value:'#ff0000'}});
  say('size and colour apply to the selection', execs.some(a=>a[0]==='fontSize'&&a[2]==='5') && execs.some(a=>a[0]==='foreColor'&&a[2]==='#ff0000'));
  E('rte-bar').onclick({target:{closest:()=>({dataset:{cmd:'removeFormat'}})}}); say('formatting can be cleared', execs.some(a=>a[0]==='removeFormat'));
  delete document.execCommand;
  run("state.settings={theme:'dark',rules:'Saved rules'}"); await run('render()');
  say('saved rules come back when the tab is opened again', E('view').innerHTML.includes('Saved rules'));
  run("state.settings={theme:'dark',rules:'Plain old <b>text</b> and \\n a line'}"); await run('render()');
  say('formatted and older plain rules both show in the editor', E('view').innerHTML.includes('<b>text</b>') && E('view').innerHTML.includes('a line'));
  const css=fs.readFileSync(R+'renderer/styles.css','utf8');
  say('the page is no longer fixed to 1000px wide', !/main\{[^}]*max-width:1000px/.test(css) && /main\{[^}]*width:100%/.test(css));
  // ---- batch 2: grid view ----
  say('tracks have an optional picture field', schema.tracks.fields.some(f=>f.key==='picture'&&f.type==='image'&&f.optional));
  store.drivers.push({id:'d1',name:'Alex',nickname:'Speedy',callsign:'ALX',flag:'NL',avatar:'data:image/jpeg;base64,AAA'},{id:'d2',name:'Sam'});
  store.slotcars.push({id:'c1',brand:'NSR',manufacturer:'Ford',model:'GT40',scale:'1:32',motor:'King',lapsDriven:12,picture:'data:image/jpeg;base64,BBB'});
  run("state.settings={theme:'dark'}; state.tab='database'; state.sub='drivers'"); await run('render()');
  say('list view by default, with a List / Grid switch', E('subview').innerHTML.includes('<table') && E('subview').innerHTML.includes('id="vgrid"') && E('subview').innerHTML.includes('id="vlist"'));
  await E('subview').onclick({target:{closest:()=>({id:'vgrid',dataset:{}})}}); await new Promise(r=>setTimeout(r,20));
  const gridCall=calls.filter(c=>c[0]==='settings').pop();
  say('switching to grid is remembered', gridCall && gridCall[1].dbView==='grid');
  const g=E('subview').innerHTML;
  say('grid shows a card per driver with the avatar as thumbnail', (g.match(/class="gcard( |")/g)||[]).length===2 && g.includes('src="data:image/jpeg;base64,AAA"'));
  say('a driver without an avatar gets a coloured initial tile', g.includes('class="ph"') && g.includes('>S</span>'));
  say('cards show key details (nickname, callsign, flag)', g.includes('Speedy') && g.includes('ALX') && g.includes('fi-nl'));
  run("state.sub='slotcars'"); await run('render()');
  const gc=E('subview').innerHTML;
  say('slot car cards use the car picture and show laps driven', gc.includes('src="data:image/jpeg;base64,BBB"') && gc.includes('Laps Driven') && gc.includes('NSR Ford GT40'));
  run("state.sub='tracks'"); await run('render()');
  say('track cards fall back to the initial tile until a picture is added', E('subview').innerHTML.includes('class="ph"') && E('subview').innerHTML.includes('Living room'));
  run("state.sub='drivers'"); await run('render()');
  await E('subview').onclick({target:{closest:()=>({dataset:{edit:'d1'}})}}); await new Promise(r=>setTimeout(r,20));
  say('Edit on a card opens the form', E('dlg').innerHTML.includes('Edit driver') && E('dlg').innerHTML.includes('Alex'));
  run("state.sub='tracks'"); await run('render()');
  run("openForm('tracks', null)"); say('the track form offers a picture upload', E('dlg').innerHTML.includes('id="f-picture"') && E('dlg').innerHTML.includes('type="file"'));
  await E('subview').onclick({target:{closest:()=>({id:'vlist',dataset:{}})}}); await new Promise(r=>setTimeout(r,20));
  say('switching back to list works', calls.filter(c=>c[0]==='settings').pop()[1].dbView==='list' && E('subview').innerHTML.includes('<table'));
  // ---- 1.2.0: the view card (click a row or a card of Slotcars, Tracks or Drivers) ----
  { const wait = () => new Promise(r => setTimeout(r, 20)), dh = () => E('dlg').innerHTML, sh = () => E('subview').innerHTML;
    const click = m => ({ target: { closest: sel => m[sel] || null } }); // (what a click on one thing gives: the element for each selector it is inside of)
    const row = id => click({ '[data-view]': { dataset: { view: id } } });
    let closes = 0; E('dlg').close = () => { closes++; };
    Object.assign(store.tracks[0], { scale: '1:32', length: 12, notes: 'Line one\nLine two', laneModifier: 'none', outsideLane: 'first' }); // (a track saved without the lane length modifier counts as a loop, so this one says None)
    store.slotcars.push({ id: 'c2', brand: 'Slot.it', manufacturer: 'Porsche', model: '956', scale: '1:32', motor: 'Flat <6>', tyres: 'Urethane', weight: '78 g', lapsDriven: 3, picture: 'data:image/jpeg;base64,MAIN', pictureFrame: { zoom: 2, x: 0, y: 0 }, extraPictures: ['data:image/jpeg;base64,G1', 'data:image/jpeg;base64,G2'], custom: { x1: 'Shelf 3' } },
      { id: 'c3', brand: 'Ninco', model: 'Lola' });
    customDefs.slotcars = [{ id: 'x1', label: 'Owned by', type: 'text' }, { id: 'x2', label: 'Bought', type: 'text' }];
    run("state.sub='tracks'"); await run('render()');
    say('the rows of the Tracks list can be clicked (and reached with the keyboard)', /<tr class="clickable" data-view="t1" tabindex="0"/.test(sh()));
    E('dlg').innerHTML = '';
    await E('subview').onclick(click({ button: { dataset: { edit: 't1' } } })); await wait();
    say('the Edit button of a row still opens the form, not the card', dh().includes('Edit track') && !dh().includes('vcard'));
    E('dlg').innerHTML = '';
    let focused = null; E('vcclose').focus = o => { focused = o || {}; };
    await E('subview').onclick(row('t1')); await wait();
    say('...the Close button has the focus without scrolling (the card opens at its top)', focused !== null && focused.preventScroll === true); delete E('vcclose').focus;
    say('a click on a row shows the card: a title, no form, nothing to type in', dh().includes('class="vcard"') && dh().includes('<h3 class="vctitle">Living room</h3>') && !dh().includes('<form') && !dh().includes('<input'));
    say('...with every field that is filled in, with its label', dh().includes('<dt>Number of lanes</dt><dd>2</dd>') && dh().includes('<dt>Scale</dt><dd>1:32</dd>') && dh().includes('<dt>Track length (metres)</dt><dd>12 m</dd>'));
    say('...a name is the title already, so it is not repeated; fields without a value are left out', !dh().includes('<dt>Name</dt>') && !dh().includes('<dt>Track Surface</dt>') && !dh().includes('<dt>Minimum lap time'));
    say('...a field that the form would hide (it depends on another choice) is left out', !dh().includes('The track length is that of'));
    say('...a long note shows in full with its lines, on a row of its own', dh().includes('<div class="wide"><dt>Notes</dt><dd>Line one<br>Line two</dd></div>'));
    say('...a track without a picture has the coloured initial, and no gallery', dh().includes('class="ph"') && dh().includes('>L</span>') && dh().includes('vcpic gimg nopic') && !dh().includes('vcgal'));
    say('...there are Close and Edit buttons, and the large picture is not shown', dh().includes('id="vcclose"') && dh().includes('id="vcedit"') && dh().includes('id="vcbig" hidden'));
    E('dlg').onclick(click({ button: { id: 'vcclose', dataset: {} } }));
    say('Close closes the card', closes === 1);
    let shown = 0; E('dlg').showModal = () => { shown++; }; E('dlg').open = true; // (a real dialog is open while the card is shown)
    E('dlg').onclick(click({ button: { id: 'vcedit', dataset: {} } })); await wait();
    say('Edit opens the form of this track', dh().includes('Edit track') && dh().includes('<form') && !dh().includes('vcard') && E('dlg').onclick !== undefined);
    say('...in the dialog that is open already (showModal on an open dialog is an error)', shown === 0);
    E('dlg').open = false; await E('subview').onclick(click({ button: { id: 'add', dataset: {} } })); await wait();
    say('...while a form that is opened from the list does open the dialog', shown === 1 && dh().includes('<form')); delete E('dlg').open; delete E('dlg').showModal;
    // a track saved before the lane length modifier existed shows what it always did (a loop), not an empty field
    store.tracks.push({ id: 't2', name: 'Old track', lanes: 2 }); await run('render()'); E('dlg').innerHTML = ''; await E('subview').onclick(row('t2')); await wait();
    say('...the card of a track saved before the lane length modifier says so too (calculated from the bends, as a loop)', dh().includes('<dt>Lane length modifier</dt><dd>Calculated from the bends')); store.tracks.pop(); E('dlg').innerHTML = '';
    run("state.sub='tracks'"); await run('render()');
    let kept = 0; E('subview').onkeydown({ key: 'Enter', preventDefault() { kept++; }, target: { dataset: { view: 't1' } } }); await wait();
    say('Enter on a focused row opens the card', dh().includes('class="vcard"') && dh().includes('Living room') && kept === 1);
    E('dlg').innerHTML = ''; E('subview').onkeydown({ key: ' ', preventDefault() { kept++; }, target: { dataset: { view: 't1' } } }); await wait();
    say('...Space does the same, and the page does not scroll (the key is kept from the page)', dh().includes('class="vcard"') && kept === 2);
    E('dlg').innerHTML = '';
    E('subview').onkeydown({ key: 'a', preventDefault() { kept++; }, target: { dataset: { view: 't1' } } }); E('subview').onkeydown({ key: 'Enter', preventDefault() { kept++; }, target: { dataset: {} } }); await wait();
    say('...another key, or Enter on something else, does nothing (and is left to the page)', dh() === '' && kept === 2);

    // Slotcars: the main picture, the details and a gallery
    run("state.sub='slotcars'"); await run('render()');
    E('dlg').innerHTML = ''; await E('subview').onclick(row('c2')); await wait();
    say('a Slotcar card has the main picture on top, as a button that shows it large (with its framing)', dh().indexOf('class="vcpic gimg"') > -1 && dh().indexOf('class="vcpic gimg"') < dh().indexOf('class="vctitle"') && /data-big="0"[^>]*><img src="data:image\/jpeg;base64,MAIN"[^>]*transform:/.test(dh()));
    say('...brand, manufacturer and model stay in the list (the title joins them), with the technical details, laps driven and the extra fields', dh().includes('<h3 class="vctitle">Slot.it Porsche 956</h3>') && dh().includes('<dt>Brand</dt><dd>Slot.it</dd>') && dh().includes('<dt>Manufacturer</dt><dd>Porsche</dd>') && dh().includes('<dt>Model</dt><dd>956</dd>') && dh().includes('<dt>Tyres</dt><dd>Urethane</dd>') && dh().includes('<dt>Weight</dt><dd>78 g</dd>') && dh().includes('<dt>Laps Driven</dt><dd>3</dd>') && dh().includes('<dt>Owned by</dt><dd>Shelf 3</dd>'));
    say('...text is safe (a "<" in a field is shown as text), and an empty field or extra field is left out', dh().includes('Flat &lt;6&gt;') && !dh().includes('Flat <6>') && !dh().includes('<dt>Gearing') && !dh().includes('<dt>Bought'));
    // 1.30.0: the statistics of a slotcar are on its card too, with the mileage worked out from the laps
    say('...a car that has no service interval or service yet shows Laps Driven, and no empty Service Interval or Last Serviced (the Mileage is worked out when the card is open)', !dh().includes('<dt>Service Interval') && !dh().includes('<dt>Last Serviced') && dh().includes('<dt>Mileage</dt><dd><span id="vc_mileage">') && dh().includes('<dt>Services Done</dt><dd>0</dd>'));
    { const prevList=api.list, c2=store.slotcars.find(c=>c.id==='c2'), keep={...c2};
      api.list=async n=>n==='laps'?[{carId:'c2',trackId:'t1',time:10},{carId:'c2',trackId:'t1',time:11},{carId:'c3',trackId:'t1',time:10}]:n==='tracks'?[{id:'t1',length:12,lanes:2}]:prevList(n);
      Object.assign(c2,{serviceInterval:300,lapsSinceService:2,serviceDate:'2026-03-01T12:00:00.000Z'}); run("state.sub='slotcars'"); await run('render()'); const mileOut=E('vc_mileage'); E('dlg').innerHTML=''; await E('subview').onclick(row('c2')); await wait();
      say('...a car with a service interval and a service shows them: Service Interval 300, Laps Since Last Interval 2, Last Serviced as a day', dh().includes('<dt>Service Interval</dt><dd>300</dd>') && dh().includes('<dt>Laps Since Last Interval</dt><dd>2</dd>') && /<dt>Last Serviced<\/dt><dd>[^<]*2026<\/dd>/.test(dh()) && !dh().includes('2026-03-01T12'));
      say('...in the order of the form: the interval, Laps Driven, the laps since the last interval, the day, and the Mileage last', ['<dt>Service Interval','<dt>Laps Driven','<dt>Laps Since Last Interval','<dt>Last Serviced','<dt>Mileage'].every((k,i,a)=>dh().indexOf(k)>0 && (!i || dh().indexOf(k)>dh().indexOf(a[i-1]))));
      say('...and the mileage is the distance of its laps (2 laps of 12 m: 24 m)', E('vc_mileage').textContent==='24 m');
      say('...Services Done says 1 (the day of service tells of one), and Next Service says how many laps are to go (298 of 300)', dh().includes('<dt>Services Done</dt><dd>1</dd>') && E('vc-service').textContent==='298 laps to go until the next service (the interval is 300 laps).' && E('vc-service').className==='' && dh().includes('<dt>Next Service</dt>'));
      c2.lapsSinceService=305; await run('render()'); E('dlg').innerHTML=''; await E('subview').onclick(row('c2')); await wait();
      say('...a service that is due is said in the colour of a warning, with the laps over (305 of 300)', E('vc-service').textContent==='Service due: 305 laps since the last service, the interval is 300 laps (5 laps over).' && E('vc-service').className==='svc-note due');
      c2.lapsSinceService=2; await run('render()'); E('dlg').innerHTML=''; await E('subview').onclick(row('c2')); await wait();
      say('...then the figures from the laps follow, in this order: Mileage, Mileage Since Last Service, Last Driven, Sessions Driven, Wins, Deslots, Fastest Lap Ever and Best Lap per Track (the table is a wide row)', ['<dt>Services Done','<dt>Next Service','<dt>Mileage','<dt>Mileage Since Last Service','<dt>Last Driven','<dt>Sessions Driven','<dt>Wins','<dt>Deslots','<dt>Fastest Lap Ever','<dt>Best Lap per Track'].every((k,i,a)=>dh().indexOf(k)>0 && (!i || dh().indexOf(k)>dh().indexOf(a[i-1]))) && /<div class="wide"><dt>Best Lap per Track<\/dt>/.test(dh()));
      say('...with the figures of its laps (no date on them, so all 2 laps count since the service and the car has not been driven on a day; 0.010 is the best lap; the table has the track without a name)', E('vc_mileageSince').textContent==='24 m' && E('vc_lastDriven').textContent==='Never' && E('vc_sessions').textContent==='0' && E('vc_wins').textContent==='0' && E('vc_deslots').textContent==='0' && E('vc_fastest').textContent==='0.010' && E('vc_byTrack').innerHTML.includes('<td>–</td><td>2</td><td>0.010</td>'));
      api.list=async n=>{ if(n==='laps'||n==='tracks') throw new Error('no'); return prevList(n); }; E('dlg').innerHTML=''; await E('subview').onclick(row('c2')); await wait();
      say('...a dash when the laps cannot be read (the card still opens), the words about the next service stay', ['_mileage','_mileageSince','_lastDriven','_sessions','_wins','_deslots','_fastest'].every(k=>E('vc'+k).textContent==='–') && E('vc_byTrack').textContent==='–' && E('vc-service').textContent.startsWith('298 laps to go') && dh().includes('class="vctitle"'));
      api.list=prevList; Object.keys(c2).forEach(k=>delete c2[k]); Object.assign(c2,keep); E('dlg').innerHTML=''; await E('subview').onclick(row('c2')); await wait(); }
    say('...the other pictures are small ones at the bottom, below the details, after a heading that counts them', /2 more pictures<\/h4><div class="vcgal">/.test(dh()) && dh().indexOf('vcgal') > dh().indexOf('vcfields') && (dh().match(/class="vcthumb"/g) || []).length === 2 && dh().includes('data-big="1"') && dh().includes('data-big="2"') && !dh().includes('data-big="3"'));
    say('...the card does not hold the main picture in the gallery twice', (dh().match(/base64,MAIN/g) || []).length === 1);
    const big = () => E('vcbig').hidden, bigSrc = () => E('vcbigimg').src, ev0 = () => click({ button: { dataset: {} } });
    E('dlg').onclick(click({ button: { dataset: { big: '1' } } }));
    say('a click on a small picture shows it large', big() === false && bigSrc() === 'data:image/jpeg;base64,G1');
    E('dlg').onclick(ev0());
    say('...a click on the large picture closes it again (and not the card)', big() === true && closes === 1);
    E('dlg').onclick(click({ button: { dataset: { big: '9' } } }));
    say('...a button for a picture that is not there shows nothing large', big() === true && closes === 1);
    E('dlg').onclick(click({ button: { dataset: { big: '2' } } }));
    say('...every small picture shows its own', bigSrc() === 'data:image/jpeg;base64,G2');
    let prevented = 0; E('dlg').oncancel({ preventDefault() { prevented++; } });
    say('Escape while a picture is large closes the picture and keeps the card', prevented === 1 && big() === true);
    E('dlg').oncancel({ preventDefault() { prevented++; } });
    say('...Escape with nothing large is left alone, so it closes the card', prevented === 1);
    E('dlg').onclick(click({ button: { dataset: { big: '0' } } }));
    say('the main picture can be shown large too', big() === false && bigSrc() === 'data:image/jpeg;base64,MAIN');
    E('dlg').onclick(ev0());
    E('dlg').onclose();
    say('when the card is closed, the Escape handler is gone (the forms must not keep it)', E('dlg').oncancel === null);

    // a Slotcar with no pictures, and the grid
    E('dlg').innerHTML = ''; await E('subview').onclick(row('c3')); await wait();
    say('a Slotcar without pictures has the coloured initial of its name, no gallery and no large picture to open', dh().includes('<h3 class="vctitle">Ninco Lola</h3>') && dh().includes('class="ph"') && dh().includes('>N</span>') && !dh().includes('vcgal') && !dh().includes('data-big'));
    await E('subview').onclick({ target: { closest: s => s === 'button' ? { id: 'vgrid', dataset: {} } : null } }); await wait();
    say('in the grid every card can be clicked', (sh().match(/<article class="gcard clickable" data-view="c\d" tabindex="0"/g) || []).length === 3);
    // 1.33.0: a car whose laps since the last service reached the interval has a "Service due" mark in the grid and the list
    { const c2=store.slotcars.find(c=>c.id==='c2'), keep={...c2}, marks=h=>(h.match(/class="svc-due"/g)||[]).length, cardOf=(h,id)=>h.split('<article').find(x=>x.includes('data-view="'+id+'"'))||'', rowOf=(h,id)=>h.split('<tr').find(x=>x.includes('data-view="'+id+'"'))||'';
      say('cars without a service interval have no "Service due" mark (grid)', marks(sh())===0);
      Object.assign(c2,{serviceInterval:100,lapsSinceService:99}); await run('render()');
      say('...99 of 100 laps is not due yet', marks(sh())===0);
      Object.assign(c2,{serviceInterval:100,lapsSinceService:100}); await run('render()');
      say('...100 of 100 laps: the card of that car has the mark, under its picture next to its name, and the other cars do not', marks(sh())===1 && /<h3>[^<]*<\/h3><span class="svc-due"[^>]*>Service due<\/span>/.test(cardOf(sh(),'c2')) && !cardOf(sh(),'c3').includes('svc-due'));
      say('...the mark says what it is for when it is pointed at', cardOf(sh(),'c2').includes('title="The laps since the last service have reached the service interval"'));
      await E('subview').onclick({ target: { closest: s => s === 'button' ? { id: 'vlist', dataset: {} } : null } }); await wait();
      say('in the list the mark is in the first cell of the row of that car, next to its name', marks(sh())===1 && /<td>[^]*?<span class="svc-due"[^>]*>Service due<\/span><\/td>/.test(rowOf(sh(),'c2')) && rowOf(sh(),'c2').indexOf('svc-due')<rowOf(sh(),'c2').indexOf('</td>') && !rowOf(sh(),'c3').includes('svc-due'));
      Object.assign(c2,{serviceInterval:100,lapsSinceService:250}); await run('render()');
      say('...a car far over its interval still has one mark', marks(sh())===1);
      say('only slot cars get the mark (a driver with the same fields does not)', run("rowMark('drivers', {serviceInterval:1, lapsSinceService:5})")==='' && run("rowMark('slotcars', {serviceInterval:1, lapsSinceService:5})").includes('Service due') && run("rowMark('slotcars', {})")==='');
      Object.keys(c2).forEach(k=>delete c2[k]); Object.assign(c2,keep); await E('subview').onclick({ target: { closest: s => s === 'button' ? { id: 'vgrid', dataset: {} } : null } }); await wait(); }
    E('dlg').innerHTML = ''; await E('subview').onclick(row('c2')); await wait();
    say('...and opens the same card', dh().includes('Slot.it Porsche 956') && dh().includes('vcgal'));
    E('dlg').innerHTML = ''; await E('subview').onclick(click({ button: { dataset: { del: 'zzz' } } })).catch(() => {});
    say('...a click on a button of a card opens no card', !dh().includes('vcard'));
    await E('subview').onclick(row('nobody')); await wait();
    say('...a click on a card that is not in the list opens nothing', !dh().includes('vcard'));
    await E('subview').onclick({ target: { closest: s => s === 'button' ? { id: 'vlist', dataset: {} } : null } }); await wait();

    // Drivers: the avatar on top, no gallery
    run("state.sub='drivers'"); await run('render()');
    E('dlg').innerHTML = ''; await E('subview').onclick(row('d1')); await wait();
    say('a Driver card has the avatar on top, the details (callsign, flag...), and no gallery', dh().includes('<h3 class="vctitle">Alex</h3>') && dh().includes('base64,AAA') && dh().includes('<dt>Callsign (3 letters)</dt><dd>ALX</dd>') && dh().includes('fi-nl') && dh().includes('<dt>Nickname</dt><dd>Speedy</dd>') && !dh().includes('vcgal'));
    say('...and the avatar can be shown large', dh().includes('data-big="0"'));

    // the other pages with a list do not get a card
    run("state.tab='setup'; state.setupSub='racesetups'"); await run('render()');
    say('Race setups are not clickable (they have no card)', E('setupmgr').innerHTML.includes('Friday') && !E('setupmgr').innerHTML.includes('data-view') && !E('setupmgr').innerHTML.includes('clickable'));
    run("state.tab='database'");
    delete customDefs.slotcars; run('state.custom.slotcars = []'); E('dlg').innerHTML = ''; }
  run("state.tab='setup'"); await run('render()');
  say('race setups have a List / Grid switch', E('setupmgr').innerHTML.includes('id="vgrid"') && E('setupmgr').innerHTML.includes('id="vlist"'));
  const sl=E('setupmgr').innerHTML;
  say('race setup list is short: name, track, session type, laps or time', sl.includes('<th>Name</th>') && sl.includes('<th>Laps / time</th>') && sl.includes('10 laps') && !sl.includes('Timing page layout') && !sl.includes('<th>Number of laps</th>'));
  Object.assign(store.tracks[0], { picture:'data:image/jpeg;base64,AAAA', pictureFrame:{zoom:2,x:1,y:0} });
  await E('setupmgr').onclick({target:{closest:()=>({id:'vgrid',dataset:{}})}}); await new Promise(r=>setTimeout(r,20));
  const sg=E('setupmgr').innerHTML;
  say('race setup grid remembers its own choice', calls.filter(c=>c[0]==='settings').pop()[1].setupView==='grid');
  say('race setup grid shows the track picture with the track\'s framing, name and details', sg.includes('class="cards"') && sg.includes('base64,AAAA') && sg.includes('translate(50%, 0%) scale(2)') && sg.includes('Friday') && sg.includes('10 laps') && sg.includes('Living room'));
  await E('setupmgr').onclick({target:{closest:()=>({id:'vlist',dataset:{}})}}); await new Promise(r=>setTimeout(r,20));
  say('...and back to the list', E('setupmgr').innerHTML.includes('<table'));
  // ---- the Race Setup form: the settings in collapsible groups ----
  {
    const sch=run('state.schema.racesetups'), parts=h=>h.split('<details class="fgroup"').slice(1), openForm_=()=>run("openForm('racesetups', null)");
    run('delete formOpen.racesetups'); openForm_(); const f=E('dlg').innerHTML, ps=parts(f);
    say('the Race Setup form has its settings in groups, in this order: session, length, endurance, start, rules, yellow flag, adjust pads, screens, Trackmate, SlotForge box', ps.map(x=>/data-fg="(\w+)"/.exec(x)[1]).join()==='session,length,endurance,start,rules,yellow,pads,screens,trackmate,box' && sch.groups.length===10);
    say('the settings are grouped as designed: Session (name, type, track), Length and result, Endurance, Start, Rule sets, Yellow flag, Adjust pads, Screens and sound, Trackmate, SlotForge box', sch.fields.map(f=>f.group+':'+f.key).join()==='session:name,session:sessionType,session:track,length:raceBy,length:enduranceBy,length:heatBy,length:rotation,length:participants,length:teamDriver,length:heatPlan,length:heats,length:heatsEach,length:heatEven,length:heatSeeding,length:laps,length:distance,length:distanceMode,length:laneDistances,length:distanceRound,length:distanceMax,length:duration,length:endRule,length:resultBy,length:unfinished,length:points,length:countBy,length:bestHeats,length:dropWorst,length:fastestBonus,length:tieBreak,length:finals,length:finalMode,length:finalLaps,length:finalDuration,length:finalDistance,length:breakSeconds,length:breakAuto,endurance:swapUnit,endurance:swapWhere,endurance:swapMode,endurance:swapEvery,endurance:swapEveryDist,endurance:swapMoments,endurance:swapMomentsDist,endurance:stintMin,endurance:stintMinDist,endurance:stintMax,endurance:stintMaxDist,endurance:totalMin,endurance:totalMinDist,endurance:totalMax,endurance:totalMaxDist,endurance:swapWarn,endurance:swapWarnDist,endurance:swapConfirm,endurance:swapSeconds,endurance:swapNext,endurance:swapGrace,endurance:swapLate,endurance:swapPenalty,endurance:swapRepeat,endurance:swapEarly,endurance:minPenalty,start:lightsMin,start:lightsMax,start:lightsAfter,start:restartAfterRed,start:firstLap,rules:penaltySystem,rules:damageSystem,rules:fuelRules,rules:bop,rules:weather,rules:pitHold,yellow:yellowTarget,yellow:yellowPoints,pads:padPoints,pads:padDamage,pads:padSeconds,pads:padLaps,pads:padChamp,screens:layout,screens:layout2,screens:audioSet,trackmate:startPower,trackmate:trackcall,trackmate:trackcallWindow,box:boxPit,box:boxLanePower,box:boxBeeps,box:boxLaneLights');
    say('every setting is in its own group, once, and nowhere else', sch.fields.length===91 && sch.fields.every(k=>ps.filter(x=>x.includes('data-key="'+k.key+'"')).length===1 && /data-fg="(\w+)"/.exec(ps.find(x=>x.includes('data-key="'+k.key+'"')))[1]===k.group && (f.match(new RegExp('id="f-'+k.key+'"','g'))||[]).length===1));
    say('each group has a header with its title and a line that says what is in it', sch.groups.every(g=>f.includes('<strong>'+g.title+'</strong>') && f.includes(g.note)) && f.includes('<summary><strong>Session</strong>'));
    say('Session and Length and result are open, the others closed', ps.map(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]?1:0).join('')==='1100000000');
    say('Open all and Close all are offered, first, above the groups', f.includes('data-fgall="1"') && f.includes('data-fgall="0"') && f.indexOf('data-fgall')<f.indexOf('<details class="fgroup"') && f.includes('class="formgrid grouped"') && f.includes('class="fgrid"'));
    say('the buttons of the form are outside the groups (Save and Cancel stay in view)', f.indexOf('type="submit"')>f.lastIndexOf('</details>') && f.includes('id="cancel"'));
    run("state.schema.zzz={label:'Thing',plural:'Things',title:['name'],extra:false,fields:[{key:'name',label:'Name',type:'text'},{key:'size',label:'Size',type:'number'}]}");
    say('a form without groups is as it was (one flat list)', (run("openForm('zzz', null)"), !E('dlg').innerHTML.includes('fgroup') && E('dlg').innerHTML.includes('<div class="formgrid">') && !E('dlg').innerHTML.includes('data-fgall') && E('dlg').innerHTML.includes('id="f-size"')));
    run('delete state.schema.zzz');
    run("state.schema.racesetups.fields.push({ key: 'zzz', label: 'Something extra', type: 'text' })"); openForm_(); { const ex=parts(E('dlg').innerHTML), last=ex[ex.length-1];
      say('a setting that is in no group is not lost: it goes into a last group, More', ex.length===11 && /^ data-fg="_more"/.test(last) && last.includes('data-key="zzz"') && last.includes('<strong>More</strong>') && ex.slice(0,10).every(x=>!x.includes('data-key="zzz"'))); }
    run('state.schema.racesetups.fields.pop()'); openForm_(); say('...and without such a setting there is no More group', parts(E('dlg').innerHTML).length===10);
    // opening and closing is remembered for the next time the form is opened
    const mine=['session','length','endurance','start','rules','yellow','pads','screens','trackmate','box'].map(id=>({dataset:{fg:id},open:id==='session'||id==='length',hidden:false}));
    E('dlg').querySelectorAll=sel=>sel==='.fgroup'?mine:[];
    openForm_(); mine[3].open=true; mine[3].ontoggle(); mine[0].open=false; mine[0].ontoggle();
    openForm_(); const f2=parts(E('dlg').innerHTML).map(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]?1:0).join('');
    say('a group you opened stays open the next time the form opens, and one you closed stays closed', f2==='0101000000');
    E('dlg').onclick({target:{closest:()=>({dataset:{fgall:'1'}})}});
    say('Open all opens every group and the form remembers it', mine.every(g=>g.open===true) && parts((openForm_(),E('dlg').innerHTML)).every(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]) );
    E('dlg').onclick({target:{closest:()=>({dataset:{fgall:'0'}})}});
    say('Close all closes every group and the form remembers it', mine.every(g=>g.open===false) && parts((openForm_(),E('dlg').innerHTML)).every(x=>!/^ data-fg="\w+"( open)?>/.exec(x)[1]));
    run('delete formOpen.racesetups'); openForm_();
    say('another kind of form does not share it (and the memory is per kind of item)', !('zzz' in run('formOpen')) && parts(E('dlg').innerHTML).map(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]?1:0).join('')==='1100000000');
    // a group with nothing to show is hidden: Length and result in a free practice
    const reg={}; E('dlg').querySelector=sel=>reg[sel]||(reg[sel]={hidden:false}); openForm_();
    const setv=(id,v)=>{ document.getElementById(id).value=v; };
    setv('f-sessionType','practice'); setv('f-heatBy','laps'); setv('f-heatPlan','manual'); setv('f-resultBy','laps'); setv('f-trackcall','yellowred');
    E('dlg').onchange({target:{tagName:'SELECT',id:'f-sessionType',dataset:{},type:'select-one',value:'practice'}});
    say('in a free practice there is nothing to set in Length and result, so that group is hidden, and the others are not', reg['[data-fg="length"]'].hidden===true && ['session','start','rules','screens','trackmate'].every(g=>reg['[data-fg="'+g+'"]'].hidden===false));
    setv('f-sessionType','race'); E('dlg').onchange({target:{tagName:'SELECT',id:'f-sessionType',dataset:{},type:'select-one',value:'race'}});
    say('...a race by laps shows it again', reg['[data-fg="length"]'].hidden===false && reg['[data-key="laps"]'].hidden===false && reg['[data-key="duration"]'].hidden===true);
    setv('f-sessionType','timed'); E('dlg').onchange({target:{tagName:'SELECT',id:'f-sessionType',dataset:{},type:'select-one',value:'timed'}});
    say('...and so does a timed race, with the duration instead of the laps', reg['[data-fg="length"]'].hidden===false && reg['[data-key="duration"]'].hidden===false && reg['[data-key="laps"]'].hidden===true);
    setv('f-sessionType','tokens'); E('dlg').onchange({target:{tagName:'SELECT',id:'f-sessionType',dataset:{},type:'select-one',value:'tokens'}});
    say('a Time Token Session has no yellow flag target: the Yellow flag group is hidden there, and shown for a race', reg['[data-fg="yellow"]'].hidden===true && reg['[data-key="yellowTarget"]'].hidden===true);
    setv('f-sessionType','race'); E('dlg').onchange({target:{tagName:'SELECT',id:'f-sessionType',dataset:{},type:'select-one',value:'race'}});
    { const g = sch.groups.find(x => x.id === 'rules'), inside = sch.fields.filter(f => f.group === 'rules').map(f => f.key);
      say('1.11.0: the folder with the penalty, damage, fuel and weather systems, Balance of Power and the pit hold time is called Rule sets, and its line lists them', g.title === 'Rule sets' && /penalty, damage, fuel and weather systems/.test(g.note) && /Balance of Power/.test(g.note) && /pit stop sensor/.test(g.note) && ['penaltySystem', 'damageSystem', 'fuelRules', 'bop', 'weather', 'pitHold'].every(k => inside.includes(k)) && !JSON.stringify(sch.groups).includes('Penalties, fuel')); }
    say('...a race shows both settings, in the group after Rule sets', reg['[data-fg="yellow"]'].hidden===false && reg['[data-key="yellowTarget"]'].hidden===false && reg['[data-key="yellowPoints"]'].hidden===false && sch.groups.findIndex(g=>g.id==='yellow')===sch.groups.findIndex(g=>g.id==='rules')+1);
    { const t=sch.fields.find(k=>k.key==='yellowTarget'), pts=sch.fields.find(k=>k.key==='yellowPoints');
      say('the target is in seconds, 0 (none) to start with; the points are 1 to start with; both say what they do', t.type==='number' && t.default===0 && t.min===0 && pts.type==='number' && pts.default===1 && pts.min===0 && /7\.500/.test(t.hint) && /15\.000/.test(t.hint) && /penalty system/.test(pts.hint) && /seconds/.test(t.label)); }
    setv('f-sessionType','timed'); E('dlg').onchange({target:{tagName:'SELECT',id:'f-sessionType',dataset:{},type:'select-one',value:'timed'}});
    E('dlg').querySelector=()=>mk(); E('dlg').querySelectorAll=()=>[mk(),mk(),mk()];
    // the first field gets the cursor, not the Open all button
    ctx.__focus=[]; E('f-name').focus=()=>{ ctx.__focus.push('name'); }; openForm_();
    say('the first field gets the cursor when the form opens', ctx.__focus.join()==='name'); delete E('f-name').focus;
    // saving reads the settings in closed groups too
    run('delete formOpen.racesetups'); openForm_(); setv('f-name','Grouped'); setv('f-sessionType','race'); setv('f-lightsMin','2'); setv('f-lightsMax','4'); setv('f-trackcall','yellow'); setv('f-yellowTarget','15'); setv('f-yellowPoints','2');
    const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='add'&&c[1]==='racesetups');
    say('settings in closed groups are saved with the rest', saved && saved[2].name==='Grouped' && saved[2].lightsMin===2 && saved[2].lightsMax===4 && saved[2].trackcall==='yellow');
    say('...also the yellow flag target and its points (numbers)', saved && saved[2].yellowTarget===15 && saved[2].yellowPoints===2);
    run('delete formOpen.racesetups');
  }
  // ---- the Track form: the same groups ----
  {
    const sch=run('state.schema.tracks'), parts=h=>h.split('<details class="fgroup"').slice(1), openForm_=()=>run("openForm('tracks', null)"), openState=h=>parts(h).map(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]?1:0).join('');
    run('delete formOpen.tracks'); openForm_(); const f=E('dlg').innerHTML, ps=parts(f);
    say('the Track form has its fields in groups, in this order: basics, length and lanes, lap time limits, picture and notes', ps.map(x=>/data-fg="(\w+)"/.exec(x)[1]).join()==='basics,length,laps,extras' && sch.groups.length===4);
    say('the fields are grouped as designed: Basics (name, lanes, scale, surface), Length and lanes (the length and everything about the lane lengths), Lap time limits, Picture and notes', sch.fields.map(f=>f.group+':'+f.key).join()==='basics:name,basics:lanes,basics:scale,basics:surface,length:length,length:laneModifier,length:outsideLane,length:laneSpacing,length:netTurns,length:laneLengths,laps:minLap,laps:maxLap,laps:deslotTime,extras:picture,extras:notes');
    say('every field is in its own group, once, and nowhere else (the 15 fields of a track)', sch.fields.length===15 && sch.fields.every(k=>ps.filter(x=>x.includes('data-key="'+k.key+'"')).length===1 && /data-fg="(\w+)"/.exec(ps.find(x=>x.includes('data-key="'+k.key+'"')))[1]===k.group && (f.match(new RegExp('id="f-'+k.key+'"','g'))||[]).length===1));
    say('each group has a header with its title and a line that says what is in it', sch.groups.every(g=>f.includes('<strong>'+g.title+'</strong>') && g.note && f.includes(g.note)) && sch.groups.map(g=>g.title).join('|')==='Basics|Length and lanes|Lap time limits|Picture and notes' && sch.groups.map(g=>g.note).join('|')==='Name, number of lanes, scale and surface|How long the track is, and how the lanes differ in length|Ignore faulty triggers and very slow laps|A picture for the lists and cards, and your own notes');
    say('Basics and Length and lanes are open to begin with, the lap time limits and the picture and notes are closed', openState(f)==='1100');
    say('the buttons of the form are outside the groups, and Open all / Close all come first', f.indexOf('type="submit"')>f.lastIndexOf('</details>') && f.indexOf('data-fgall')<f.indexOf('<details class="fgroup"') && f.includes('class="formgrid grouped"'));
    say('the surface is with the other basics now (it was the last but two)', f.indexOf('data-key="surface"')>f.indexOf('data-key="scale"') && f.indexOf('data-key="surface"')<f.indexOf('data-key="length"'));
    // the lane fields still come and go with the Lane length modifier, inside their group, which stays
    const reg={}; E('dlg').querySelector=sel=>reg[sel]||(reg[sel]={hidden:false}); openForm_();
    const setv=(id,v)=>{ document.getElementById(id).value=v; }, pick=v=>{ setv('f-laneModifier',v); E('dlg').onchange({target:{tagName:'SELECT',id:'f-laneModifier',dataset:{},type:'select-one',value:v}}); };
    const lanes=['outsideLane','laneSpacing','netTurns','laneLengths'], hid=k=>reg['[data-key="'+k+'"]'].hidden;
    pick('none'); say('with None the lane fields are hidden, and the group that holds them is not', lanes.every(k=>hid(k)===true) && reg['[data-fg="length"]'].hidden===false);
    pick('bends'); say('Calculated from the bends shows the outside lane, the spacing and the full turns', hid('outsideLane')===false && hid('laneSpacing')===false && hid('netTurns')===false && hid('laneLengths')===true);
    pick('measured'); say('Measured shows the list of lane lengths', hid('laneLengths')===false && hid('laneSpacing')===true && reg['[data-fg="length"]'].hidden===false);
    say('no group of the track form is ever hidden', ['basics','length','laps','extras'].every(g=>!reg['[data-fg="'+g+'"]'] || reg['[data-fg="'+g+'"]'].hidden===false));
    pick('none'); // (the stand-in for the window keeps the value of a field, so put it back)
    E('dlg').querySelector=()=>mk(); E('dlg').querySelectorAll=()=>[mk(),mk(),mk()];
    // the first field gets the cursor
    ctx.__focus=[]; E('f-name').focus=()=>{ ctx.__focus.push('name'); }; openForm_();
    say('the first field gets the cursor when the form opens', ctx.__focus.join()==='name'); delete E('f-name').focus;
    // opening a group is remembered, for tracks only
    const mine=['basics','length','laps','extras'].map(id=>({dataset:{fg:id},open:id==='basics'||id==='length',hidden:false}));
    E('dlg').querySelectorAll=sel=>sel==='.fgroup'?mine:[];
    run('delete formOpen.tracks'); openForm_(); mine[2].open=true; mine[2].ontoggle(); openForm_();
    say('a group you opened stays open the next time the track form opens', openState(E('dlg').innerHTML)==='1110');
    run("openForm('racesetups', null)"); say('...but it is not the memory of the Race Setup form', openState(E('dlg').innerHTML)==='110000' || run('Array.from(formOpen.racesetups).join()')==='session,length');
    // saving reads the fields in closed groups too
    run('delete formOpen.tracks'); E('dlg').querySelectorAll=()=>[mk(),mk(),mk()]; openForm_();
    setv('f-name','Grouped track'); setv('f-lanes','4'); setv('f-minLap','2'); setv('f-maxLap','40'); setv('f-notes','Fast');
    const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='add'&&c[1]==='tracks');
    say('fields in closed groups are saved with the rest', saved && saved[2].name==='Grouped track' && saved[2].lanes===4 && Number(saved[2].minLap)===2 && Number(saved[2].maxLap)===40 && saved[2].notes==='Fast');
    run('delete formOpen.tracks');
  }
  // ---- the Driver, Slot car, Fuel setup and Penalty system forms: the same groups ----
  {
    const parts=h=>h.split('<details class="fgroup"').slice(1), openState=h=>parts(h).map(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]?1:0).join('');
    const openF=(e,item)=>run(`openForm('${e}', ${item?JSON.stringify(item):'null'})`);
    // the groups of a form as designed: [group id, title, note, open, [fields]]
    const DESIGN={
      drivers:[['basics','Basics','Name, nickname and the three-letter callsign',1,['name','nickname','callsign']],['personal','Personal details','Date of birth and country flag',1,['dateOfBirth','flag']],['avatar','Avatar','The picture on driver cards and timing screens',0,['avatar']]],
      slotcars:[['basics','Basics','Brand, manufacturer, model and scale',1,['brand','manufacturer','model','scale']],['technical','Technical details','Motor, tyres, gearing and weight',1,['motor','tyres','tyreCompound','damageFactor','gearing','weight']],['pictures','Pictures','The main picture, and more pictures of the chassis and parts',0,['picture','extraPictures']],['stats','Statistics','The service interval, the services done, and the laps, mileage, wins and best laps counted from your races',0,['serviceInterval','lapsDriven','lapsSinceService','serviceDate','servicesDone']]],
      fuelrules:[['basics','Basics','Name, tank size and the fuel used per lap',1,['name','tank','perLap','targetLap']],['empty','Empty tank and refuelling','What happens when the fuel runs out, and the refuelling speed',1,['empty','rate']],['fast','Fast and slow laps','How much more fuel a fast lap uses, and how much a slow lap saves',0,['maxExtra','maxSaving']]],
      weathersystems:[['basics','Basics','Name, and whether the weather is counted in laps or in minutes',1,['name','unit']],['forecast','The rain','When it starts and how long it lasts, with the clouds before and the drying after',1,['startMode','startAt','startFrom','startTo','rainMode','rainFor','rainMin','rainMax','cloudyFor','clearingFor','sameInHeats']],['tyres','Tyres and penalties','Which tyres a pit stop gives, and the points for staying on the wrong tyres',1,['cloudyTyre','clearingTyre','react','wetPoints','dryPoints','repeat']],['hinder','Hindering the cars','How much slower the wrong tyres make a car (through its fuel use, refuelling and tank)',0,['hinder','hUse','hRate','hTank',...['dry','cloudy','wet','clearing'].flatMap(st=>['Dry','Inter','Wet'].map(c=>st+'On'+c))]],['conditions','Track conditions','Track and air temperature, wind speed and direction for every weather state (shown by the Track Conditions widget, said by the audio)',0,['units',...['Dry','Cloudy','Wet','Clearing'].flatMap(st=>['trackTemp','airTemp','windSpeed','windDir'].map(b=>b+st))]]],
      penaltysystems:[['basics','Basics','Name, and how penalty points turn into time',1,['name','timeRule','everyPoints','everySeconds','steps']],['special','Special penalties','Penalties the Race Director can give, such as a Stop-and-Go or a Drivethrough',1,['types']],['limits','Disqualification and fuel','When a driver is disqualified, and points for an empty tank',0,['dqPoints','fuelPoints']]],
      damagesystems:[['basics','Basics','Name, the stop in the pits and the damage of a deslot',1,['name','stop','deslotPoints']],['levels','Levels','How much damage asks for which stop in the pits',1,['levels']],['incidents','Incidents','What the Race Director can give a car with a button',1,['incidents']],['fines','Penalty points','For a stop that is late, and for leaving too early',0,['latePoints','earlyPoints']]],
    };
    for (const e of Object.keys(DESIGN)) {
      const D=DESIGN[e], sch=run('state.schema.'+e), name=sch.label+' form';
      run('delete formOpen.'+e); openF(e,null); const f=E('dlg').innerHTML, ps=parts(f), all=[].concat(...D.map(g=>g[4]));
      say(`the ${name} has its fields in groups, in this order: ${D.map(g=>g[0]).join(', ')}`, ps.map(x=>/data-fg="(\w+)"/.exec(x)[1]).join()===D.map(g=>g[0]).join() && sch.groups.length===D.length);
      say(`the ${name}: every field is in the group designed for it, once, and nowhere else`, sch.fields.map(x=>x.group+':'+x.key).join()===[].concat(...D.map(g=>g[4].map(k=>g[0]+':'+k))).join() && sch.fields.length===all.length && all.every(k=>{ const own=ps.filter(x=>x.includes('data-key="'+k+'"')); return own.length===1 && /data-fg="(\w+)"/.exec(own[0])[1]===D.find(g=>g[4].includes(k))[0] && (f.match(new RegExp('id="f-'+k+'"','g'))||[]).length<=1; }));
      say(`the ${name}: the headers have the titles and notes as designed`, sch.groups.map(g=>g.title+'|'+g.note).join('\n')===D.map(g=>g[1]+'|'+g[2]).join('\n') && D.every(g=>f.includes('<strong>'+g[1]+'</strong>') && f.includes(g[2])));
      say(`the ${name}: what is open to begin with is ${D.map(g=>g[3]?'open':'closed').join(', ')}`, openState(f)===D.map(g=>g[3]).join(''));
      say(`the ${name}: Open all / Close all come first, and Save and Cancel are outside the groups`, f.indexOf('data-fgall')<f.indexOf('<details class="fgroup"') && f.includes('class="formgrid grouped"') && f.indexOf('type="submit"')>f.lastIndexOf('</details>') && f.includes('id="cancel"'));
      // the memory of the open groups is its own for each kind of form
      const mine=D.map(g=>({dataset:{fg:g[0]},open:!!g[3],hidden:false})); E('dlg').querySelectorAll=sel=>sel==='.fgroup'?mine:[];
      run('delete formOpen.'+e); openF(e,null); mine[mine.length-1].open=true; mine[mine.length-1].ontoggle(); openF(e,null);
      say(`the ${name}: the group you opened stays open the next time`, openState(E('dlg').innerHTML)===D.map((g,i)=>(g[3]||i===D.length-1)?1:0).join(''));
      run('delete formOpen.'+e); E('dlg').querySelectorAll=()=>[mk(),mk(),mk()];
    }
    run('delete formOpen.drivers; delete formOpen.slotcars');
    { const mine=[{dataset:{fg:'basics'},open:true},{dataset:{fg:'personal'},open:true},{dataset:{fg:'avatar'},open:false}]; E('dlg').querySelectorAll=sel=>sel==='.fgroup'?mine:[]; openF('drivers',null); mine[2].open=true; mine[2].ontoggle();
      E('dlg').querySelectorAll=()=>[mk(),mk(),mk()]; openF('slotcars',null);
      say('what is open in one kind of form is not copied to another (opening the Avatar group does not change the slot car form)', openState(E('dlg').innerHTML)==='1100' && run('Array.from(formOpen.drivers).join()')==='basics,personal,avatar' && run('Array.from(formOpen.slotcars).join()')==='basics,technical'); }
    // the driver form: the avatar (a picture with its frame) sits in its group
    run('delete formOpen.drivers'); openF('drivers',{id:'d1',name:'Ann',nickname:'A',callsign:'ANN',flag:'nl',avatar:'data:image/png;base64,AAAA'});
    { const ps=parts(E('dlg').innerHTML), av=ps.find(x=>/data-fg="avatar"/.test(x));
      say('the driver form: the avatar and its framing are in the Avatar group, the callsign and the flag in theirs', av.includes('id="f-avatar"') && av.includes('data-frame="avatar"') && !av.includes('id="f-name"') && ps[0].includes('id="f-callsign"') && ps[1].includes('id="f-flag"') && ps[1].includes('id="f-dateOfBirth"')); }
    // the slot car form: pictures and the gallery in Pictures, the laps driven (counted by the app) shown but not editable in Statistics
    run('delete formOpen.slotcars'); openF('slotcars',null);
    { const ps=parts(E('dlg').innerHTML), pic=ps.find(x=>/data-fg="pictures"/.test(x)), st=ps.find(x=>/data-fg="stats"/.test(x));
      say('the slot car form: the main picture and the gallery are in Pictures', pic.includes('id="f-picture"') && pic.includes('id="gal-box"') && !st.includes('id="f-picture"'));
      say('...and the laps driven are in Statistics, shown but not editable', /id="f-lapsDriven"[^>]*disabled/.test(st)); }
    // the fuel setup: the empty tank group comes before the fast and slow laps, and the list columns did not change
    say('the fuel setup: the table of fuel setups has the same columns as before (name, tank, fuel per lap, target lap)', run("state.schema.fuelrules.list.join()")==='name,tank,perLap,targetLap' && run("state.schema.fuelrules.card.join()")==='tank,perLap,targetLap');
    say('the penalty system: the table has the same columns as before (name, time rule, disqualification points)', run("state.schema.penaltysystems.list.join()")==='name,timeRule,dqPoints' && run("state.schema.penaltysystems.card.join()")==='timeRule,dqPoints');
    say('the driver and slot car tables list every field in the order of the form (as before the groups)', run("state.schema.drivers.fields.map(f=>f.key).join()")==='name,nickname,callsign,dateOfBirth,flag,avatar' && run("state.schema.slotcars.fields.map(f=>f.key).join()")==='brand,manufacturer,model,scale,motor,tyres,tyreCompound,damageFactor,gearing,weight,picture,extraPictures,serviceInterval,lapsDriven,lapsSinceService,serviceDate,servicesDone');
    // the penalty system: the time rule fields still come and go inside Basics, and the special penalties are in their group
    run('delete formOpen.penaltysystems'); { const reg={}; E('dlg').querySelector=sel=>reg[sel]||(reg[sel]={hidden:false}); openF('penaltysystems',null);
      const setv=(id,v)=>{ document.getElementById(id).value=v; }, pick=v=>{ setv('f-timeRule',v); E('dlg').onchange({target:{tagName:'SELECT',id:'f-timeRule',dataset:{},type:'select-one',value:v}}); }, hid=k=>reg['[data-key="'+k+'"]'].hidden;
      pick('every'); say('the penalty system: with "Every X points add Y seconds" the two numbers show and the table of steps is hidden', hid('everyPoints')===false && hid('everySeconds')===false && hid('steps')===true);
      pick('steps'); say('...with "Steps I define" the table shows and the two numbers are hidden', hid('steps')===false && hid('everyPoints')===true && hid('everySeconds')===true);
      say('...and no group is hidden by it', ['basics','special','limits'].every(g=>!reg['[data-fg="'+g+'"]'] || reg['[data-fg="'+g+'"]'].hidden===false)); pick('every'); E('dlg').querySelector=()=>mk(); }
    openF('penaltysystems',null);
    { const ps=parts(E('dlg').innerHTML), sp=ps.find(x=>/data-fg="special"/.test(x));
      say('the penalty system: the special penalties (their list and the Add button) are in their group', sp.includes('id="pt-box"') && sp.includes('data-ptadd="1"') && !ps.find(x=>/data-fg="basics"/.test(x)).includes('id="pt-box"')); }
    // 1.10.0: the damage system form: the levels and the incidents, with the examples to start with
    store.damagesystems = []; // (the fake store of the test has no damage systems yet)
    run('delete formOpen.damagesystems'); openF('damagesystems',null);
    { const ps=parts(E('dlg').innerHTML), lv=ps.find(x=>/data-fg="levels"/.test(x)), ic=ps.find(x=>/data-fg="incidents"/.test(x)), bs=ps.find(x=>/data-fg="basics"/.test(x));
      say('1.10.0 the damage system form: the levels are in their group with an Add button, the incidents in theirs', lv.includes('id="dl-box"') && lv.includes('data-dladd="1"') && ic.includes('id="di-box"') && ic.includes('data-diadd="1"') && !bs.includes('id="dl-box"') && !bs.includes('id="di-box"'));
      say('...a new damage system starts with the four examples (light, medium, heavy, critical damage) and three incidents', lv.split('data-dlk="name"').length===5 && ['Light damage','Medium damage','Heavy damage','Critical damage'].every(n=>lv.includes('value="'+n+'"')) && ic.split('data-dik="name"').length===4 && ['Deslot','Contact','Hard crash'].every(n=>ic.includes('value="'+n+'"')));
      say('...a level has its name, the points it starts at, the seconds, the urgency, the deadline and what the stop does', lv.includes('data-dlk="from" value="3"') && lv.includes('data-dlk="seconds" value="10"') && lv.includes('<option value="asap" selected>As fast as you can</option>') && lv.includes('data-dlk="within" value="3"') && lv.includes('<option value="retire" selected>Retires the car</option>') && lv.includes('Whenever you can') && lv.includes('Disqualifies the car'));
      say('...the column headers say what each column is', lv.includes('From (damage points)') && lv.includes('Stand still (s)') && lv.includes('Within (laps, 0 = no deadline)') && lv.includes('The stop')); }
    { const click=d=>E('dlg').onclick({target:{closest:()=>({dataset:d})}}), type=(attr,i,k,v)=>E('dlg').oninput({target:{dataset:{[attr]:String(i),[attr+'k']:k},value:v}});
      click({dladd:'1'}); let b=document.getElementById('dl-box').innerHTML;
      say('Add a level adds a row 3 points above the last (a new level at 13)', b.split('data-dlk="name"').length===6 && b.includes('data-dlk="from" value="13"'));
      click({dldel:'0'}); b=document.getElementById('dl-box').innerHTML;
      say('Remove takes that row away', b.split('data-dlk="name"').length===5 && !b.includes('value="Light damage"') && b.includes('value="Medium damage"'));
      type('dl',0,'name','Bent axle'); type('dl',0,'from','4'); type('dl',0,'seconds','7.5'); type('dl',0,'urgency','asap'); type('dl',0,'within','2'); type('dl',0,'action','dq');
      click({didel:'1'}); click({diadd:'1'}); type('di',2,'name','Roll'); type('di',2,'points','5'); type('di',1,'points','3.8');
      const setv=(id,v)=>{ document.getElementById(id).value=v; }; setv('f-name','Club damage'); setv('f-stop','add'); setv('f-deslotPoints','2'); setv('f-latePoints','3'); setv('f-earlyPoints','0');
      const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='add'&&c[1]==='damagesystems');
      say('1.10.0 saving a damage system keeps its settings, the levels as edited and the incidents as edited', saved && saved[2].name==='Club damage' && saved[2].stop==='add' && Number(saved[2].deslotPoints)===2 && Number(saved[2].latePoints)===3 && Number(saved[2].earlyPoints)===0);
      say('...a level: name, points, seconds (7.5), urgency, deadline and what the stop does', saved && JSON.stringify(saved[2].levels[0])===JSON.stringify({name:'Bent axle',from:4,seconds:7.5,urgency:'asap',within:2,action:'dq'}) && saved[2].levels.length===4);
      say('...the other levels as they were, in order (heavy 9, critical 10, and the added one at 13, which has no name yet)', saved && saved[2].levels.map(l=>l.from).join()==='4,9,10,13' && saved[2].levels[3].name==='');
      say('...the incidents: the one that was removed is gone, points are whole numbers, a new one has its name', saved && JSON.stringify(saved[2].incidents)===JSON.stringify([{name:'Deslot',points:1},{name:'Hard crash',points:3},{name:'Roll',points:5}])); }
    store.damagesystems = [{ id: 'dm1', name: 'Empty' }];
    run('delete formOpen.damagesystems'); openF('damagesystems',{id:'dm1',name:'Empty',levels:[{name:'',from:0,seconds:'x',urgency:'zz',within:'-3',action:'weird'},{name:'Keep',from:'7',seconds:'',urgency:'',within:'',action:''}],incidents:[{name:'',points:4},{name:'Hit',points:0}]});
    { const lv=E('dlg').innerHTML; const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='update'&&c[1]==='damagesystems') || calls.slice(nb).find(c=>c[1]==='damagesystems');
      say('an edited damage system shows what it has (not the examples), and saving cleans the rows: an empty row goes, wrong numbers become 0, an unknown choice the first', lv.includes('value="Keep"') && !lv.includes('Light damage') && saved && JSON.stringify((saved[3]||saved[2]).levels)===JSON.stringify([{name:'Keep',from:7,seconds:0,urgency:'whenever',within:0,action:'repair'}]) && JSON.stringify((saved[3]||saved[2]).incidents)===JSON.stringify([{name:'Hit',points:1}])); }
    run('delete formOpen.damagesystems'); openF('damagesystems',{id:'dm2',name:'None'});
    say('a damage system without levels says so', E('dlg').innerHTML.includes('No levels yet') && E('dlg').innerHTML.includes('No incidents yet'));
    // saving reads the fields in closed groups too (the saved items are taken out of the store again afterwards)
    const keepStore={}; ['fuelrules','penaltysystems','drivers','slotcars'].forEach(e=>{ keepStore[e]=store[e]; store[e]=(store[e]||[]).slice(); });
    run('delete formOpen.fuelrules'); E('dlg').querySelectorAll=()=>[mk(),mk(),mk()]; openF('fuelrules',null);
    { const setv=(id,v)=>{ document.getElementById(id).value=v; }; setv('f-name','Closed groups'); setv('f-tank','90'); setv('f-perLap','1.5'); setv('f-maxExtra','40'); setv('f-maxSaving','10'); setv('f-empty','warn'); setv('f-rate','7');
      const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='add'&&c[1]==='fuelrules');
      say('the fuel setup: the settings in the closed group (fast and slow laps) are saved with the rest', saved && saved[2].name==='Closed groups' && Number(saved[2].tank)===90 && Number(saved[2].maxExtra)===40 && Number(saved[2].maxSaving)===10 && saved[2].empty==='warn' && Number(saved[2].rate)===7); }
    run('delete formOpen.penaltysystems'); openF('penaltysystems',null);
    { const setv=(id,v)=>{ document.getElementById(id).value=v; }; setv('f-name','Strict'); setv('f-timeRule','every'); setv('f-everyPoints','3'); setv('f-everySeconds','4'); setv('f-dqPoints','30'); setv('f-fuelPoints','2');
      const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='add'&&c[1]==='penaltysystems');
      say('the penalty system: the settings in the closed group (disqualification, fuel points) are saved with the rest', saved && saved[2].name==='Strict' && Number(saved[2].dqPoints)===30 && Number(saved[2].fuelPoints)===2 && Number(saved[2].everyPoints)===3); }
    run('delete formOpen.drivers'); openF('drivers',null);
    { const setv=(id,v)=>{ document.getElementById(id).value=v; }; setv('f-name','Closed Ann'); setv('f-nickname','Ann'); setv('f-callsign','ann'); setv('f-dateOfBirth','1990-05-01'); setv('f-flag','nl');
      const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='add'&&c[1]==='drivers');
      say('the driver form: saved with the settings of every group (the callsign still in capitals)', saved && saved[2].name==='Closed Ann' && saved[2].nickname==='Ann' && saved[2].callsign==='ANN' && saved[2].dateOfBirth==='1990-05-01' && saved[2].flag==='nl'); }
    run('delete formOpen.slotcars'); openF('slotcars',null);
    { const setv=(id,v)=>{ document.getElementById(id).value=v; }; setv('f-brand','NSR'); setv('f-manufacturer','Ford'); setv('f-model','GT40'); setv('f-scale','1:32'); setv('f-motor','King 21k'); setv('f-tyres','Urethane'); setv('f-gearing','9/27'); setv('f-weight','80 g');
      const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='add'&&c[1]==='slotcars');
      say('the slot car form: saved with the settings of every group (and the laps driven start at 0)', saved && saved[2].brand==='NSR' && saved[2].model==='GT40' && saved[2].motor==='King 21k' && saved[2].weight==='80 g' && saved[2].lapsDriven===0); }
    ['drivers','slotcars','fuelrules','penaltysystems'].forEach(e=>{ run('delete formOpen.'+e); if(keepStore[e]===undefined) delete store[e]; else store[e]=keepStore[e]; });
  }
  // ---------- extra fields: the group of the form they are shown in (0.75.0) ----------
  {
    const parts=h=>h.split('<details class="fgroup"').slice(1), partOf=(h,g)=>parts(h).find(x=>x.startsWith(' data-fg="'+g+'"'));
    const extras={slotcars:[{id:'x1',label:'Chassis notes',type:'text',options:[],group:'technical'},{id:'x2',label:'Owner',type:'text',options:[],group:''},{id:'x3',label:'Old one',type:'text',options:[]},{id:'x4',label:'Lost one',type:'text',options:[],group:'gone'}],drivers:[],zzy:[{id:'z1',label:'Foo',type:'text',options:[]}]};
    const prev={cf:api.customFields,add:api.addCustomField,set:api.setCustomFieldGroup,rm:api.removeCustomField};
    const log=[]; let failNext=false;
    api.customFields=async e=>JSON.parse(JSON.stringify(extras[e]||[]));
    api.addCustomField=async(e,f)=>{ log.push(['add',e,f]); const row={id:'n'+log.length,...f}; (extras[e]=extras[e]||[]).push(row); return row; };
    api.setCustomFieldGroup=async(e,id,g)=>{ if(failNext) throw new Error('disk full'); log.push(['group',e,id,g]); const f=extras[e].find(x=>x.id===id); f.group=g; return f; };
    api.removeCustomField=async(e,id)=>{ extras[e]=extras[e].filter(x=>x.id!==id); };
    const options=(h,sel)=>{ const m=new RegExp(sel+'[^>]*>(.*?)</select>','s').exec(h); return m?[...m[1].matchAll(/<option value="([^"]*)"( selected)?>([^<]*)<\/option>/g)].map(o=>({v:o[1],sel:!!o[2],t:o[3]})):null; };
    const wait=()=>new Promise(r=>setTimeout(r,20));
    const clickAdd=async()=>E('dlg').onclick({target:{closest:()=>({id:'xadd',dataset:{}})}});
    const form=async e=>{ run('delete formOpen.'+e); await run("openExtra('"+e+"')"); run("openForm('"+e+"', null)"); return E('dlg').innerHTML; };

    // the dialog: a choice for the new field, and one for every field there is
    await run("openExtra('slotcars')"); let dlgHtml=E('dlg').innerHTML;
    const nw=options(dlgHtml,'<select id="xg"');
    say('the Extra fields dialog asks for the group of a new field: the groups of the form in the order of the form, then More', nw && nw.map(o=>o.t).join()==='Basics,Technical details,Pictures,Statistics,More' && nw.map(o=>o.v).join()==='basics,technical,pictures,stats,' && dlgHtml.includes('for="xg">Group in the form'));
    say('...and More is the one that is chosen to begin with, and only More', nw.filter(o=>o.sel).map(o=>o.t).join()==='More');
    const own=id=>options(dlgHtml,'<select data-grp="'+id+'"');
    say('every extra field in the list shows its group (the one it has)', own('x1').filter(o=>o.sel).map(o=>o.v).join()==='technical' && own('x2').filter(o=>o.sel).map(o=>o.v).join()==='' && own('x1').map(o=>o.t).join()==='Basics,Technical details,Pictures,Statistics,More');
    say('...a field without a group, and a field whose group is not on the form (any more), show More', own('x3').filter(o=>o.sel).map(o=>o.t).join()==='More' && own('x4').filter(o=>o.sel).map(o=>o.t).join()==='More');
    say('...the choices have a name for a screen reader, and the list still has the Delete buttons', dlgHtml.includes('aria-label="Group of Chassis notes"') && (dlgHtml.match(/data-rm="/g)||[]).length===4);

    // where the fields appear in the form
    let f=await form('slotcars'), tech=partOf(f,'technical'), more=partOf(f,'_more');
    say('an extra field is shown in the group it was given: in Technical details, after the fields of that group', tech.includes('data-key="x1"') && tech.indexOf('data-key="weight"')<tech.indexOf('data-key="x1"') && !more.includes('data-key="x1"'));
    say('...the others are in More: with no group, with no group any more, and a field that is in More', ['x2','x3','x4'].every(k=>more.includes('data-key="'+k+'"') && !tech.includes('data-key="'+k+'"')) && parts(f).length===5 && parts(f)[4].startsWith(' data-fg="_more"'));
    say('...and no other group has an extra field', ['basics','pictures','stats'].every(g=>!/data-key="x\d"/.test(partOf(f,g))));
    say('Technical details stays open and More stays closed (the extra field did not change that)', /^ data-fg="technical" open>/.test(tech) && !/^ data-fg="_more" open>/.test(more));

    // adding
    E('xl').value='Gearbox'; E('xt').value='text'; E('xo').value=''; E('xg').value='technical'; await run("openExtra('slotcars')"); E('xl').value='Gearbox'; E('xt').value='text'; E('xo').value=''; E('xg').value='technical';
    await clickAdd(); await wait();
    say('adding a field gives the chosen group to the database', log.length===1 && log[0][0]==='add' && log[0][1]==='slotcars' && log[0][2].label==='Gearbox' && log[0][2].group==='technical' && log[0][2].type==='text');
    say('...and the list shows it with that group', options(E('dlg').innerHTML,'<select data-grp="n1"').filter(o=>o.sel).map(o=>o.v).join()==='technical');
    f=await form('slotcars'); say('...and the form has it in that group', partOf(f,'technical').includes('data-key="n1"'));
    await run("openExtra('slotcars')"); E('xl').value='Misc'; E('xt').value='text'; E('xo').value=''; E('xg').value=''; await clickAdd(); await wait();
    say('a field left on More is added to More (an empty group)', log[1][2].label==='Misc' && log[1][2].group==='');
    f=await form('slotcars'); say('...and the form has it in More', partOf(f,'_more').includes('data-key="n2"') && !partOf(f,'technical').includes('data-key="n2"'));
    await run("openExtra('slotcars')"); E('xl').value='Choice'; E('xt').value='list'; E('xo').value='a, b'; E('xg').value='pictures'; await clickAdd(); await wait();
    say('a pick-list keeps its options with the group', log[2][2].type==='list' && log[2][2].options.join()==='a,b' && log[2][2].group==='pictures');
    await run("openExtra('slotcars')"); E('xl').value=''; E('xg').value='technical'; const nlog=log.length; await clickAdd(); await wait();
    say('a field without a name is still refused, and nothing is added', E('err').textContent==='Please enter a name for the field.' && log.length===nlog);
    await run("openExtra('drivers')"); const dopts=options(E('dlg').innerHTML,'<select id="xg"');
    say('another kind of item shows its own groups (Basics, Personal details, Avatar, More for drivers)', dopts.map(o=>o.t).join()==='Basics,Personal details,Avatar,More');
    await run("openExtra('tracks')"); say('...and tracks theirs', options(E('dlg').innerHTML,'<select id="xg"').map(o=>o.t).join()==='Basics,Length and lanes,Lap time limits,Picture and notes,More');

    // changing the group of a field that is there
    await run("openExtra('slotcars')"); const sel={id:'',dataset:{grp:'x2'},value:'pictures'}; const nl=log.length;
    await E('dlg').onchange({target:sel});
    say('choosing another group for a field saves it right away', log.length===nl+1 && log[nl][0]==='group' && log[nl][1]==='slotcars' && log[nl][2]==='x2' && log[nl][3]==='pictures');
    f=await form('slotcars'); say('...and the form has the field in its new group (and not in More any more)', partOf(f,'pictures').includes('data-key="x2"') && !partOf(f,'_more').includes('data-key="x2"') && partOf(f,'pictures').indexOf('data-key="extraPictures"')<partOf(f,'pictures').indexOf('data-key="x2"'));
    await run("openExtra('slotcars')"); await E('dlg').onchange({target:{id:'',dataset:{grp:'x2'},value:''}});
    f=await form('slotcars'); say('...and back to More', log[log.length-1][3]==='' && partOf(f,'_more').includes('data-key="x2"') && !partOf(f,'pictures').includes('data-key="x2"'));
    await run("openExtra('slotcars')"); const m0=log.length; E('xow').hidden=true; await E('dlg').onchange({target:{id:'xt',dataset:{},value:'list'}});
    say('choosing the type Pick-list shows the options box, and does not touch the groups', log.length===m0 && E('xow').hidden===false);
    await E('dlg').onchange({target:{id:'xt',dataset:{},value:'text'}}); say('...and another type hides it again', E('xow').hidden===true && log.length===m0);
    await E('dlg').onchange({target:{id:'',dataset:{grp:'nope'},value:'basics'}}); say('a choice for a field that is not in the list is ignored', log.length===m0);
    // a group that could not be saved is not kept
    await run("openExtra('slotcars')"); failNext=true; const bad={id:'',dataset:{grp:'x1'},value:'basics'}; await E('dlg').onchange({target:bad}); failNext=false;
    say('if the group cannot be saved, the choice goes back and says why', bad.value==='technical' && E('err').textContent.includes('disk full') && run("state.custom.slotcars.find(x=>x.id==='x1').group")==='technical');
    f=await form('slotcars'); say('...and the form still has the field where it was', partOf(f,'technical').includes('data-key="x1"'));
    // ... and it goes back to the group the field had when you last changed it in this dialog (not the one it had when the dialog opened)
    await run("openExtra('slotcars')"); await E('dlg').onchange({target:{id:'',dataset:{grp:'x2'},value:'pictures'}}); failNext=true; const bad2={id:'',dataset:{grp:'x2'},value:'stats'}; await E('dlg').onchange({target:bad2}); failNext=false;
    say('...and after a change that worked, a change that fails goes back to that one', bad2.value==='pictures' && log[log.length-1][3]==='pictures');
    await E('dlg').onchange({target:{id:'',dataset:{grp:'x2'},value:''}});
    // values of the extra fields are saved from every group
    { const keep=store.slotcars; store.slotcars=[]; run('delete formOpen.slotcars'); await run("openExtra('slotcars')"); run("openForm('slotcars', null)");
      const setv=(id,v)=>{ document.getElementById(id).value=v; }; setv('f-brand','NSR'); setv('f-model','GT40'); setv('f-x1','Sheet steel'); setv('f-x2','Dutch'); setv('f-n1','5-speed');
      const nb=calls.length; await E('frm').onsubmit({preventDefault(){}}); const saved=calls.slice(nb).find(c=>c[0]==='add'&&c[1]==='slotcars');
      say('the values of extra fields are saved whatever group they are in', saved && saved[2].custom.x1==='Sheet steel' && saved[2].custom.x2==='Dutch' && saved[2].custom.n1==='5-speed');
      store.slotcars=keep; }
    // a kind of item without groups: no choice
    run("state.schema.zzy={label:'Zed',plural:'Zeds',title:['name'],fields:[{key:'name',label:'Name',type:'text'}]}");
    await run("openExtra('zzy')"); dlgHtml=E('dlg').innerHTML;
    say('a kind of item whose form has no groups has no group choice', !dlgHtml.includes('id="xg"') && !dlgHtml.includes('data-grp=') && dlgHtml.includes('Foo') && dlgHtml.includes('data-rm="z1"'));
    E('xl').value='Bar'; E('xt').value='text'; E('xo').value=''; E('xg').value='technical'; const zl=log.length; await clickAdd(); await wait();
    say('...and a field added there has no group', log.length===zl+1 && log[zl][2].group==='' );
    run('delete state.schema.zzy'); run('delete formOpen.slotcars');
    Object.assign(api,{customFields:prev.cf,addCustomField:prev.add,setCustomFieldGroup:prev.set,removeCustomField:prev.rm}); if(prev.add===undefined) delete api.addCustomField; if(prev.set===undefined) delete api.setCustomFieldGroup; if(prev.rm===undefined) delete api.removeCustomField;
    run("state.custom.slotcars=[]; state.custom.drivers=[]; state.custom.tracks=[]");
  }
  run("state.settings={theme:'dark'}");
  // picture framing in a form
  run(`openForm('tracks', ${JSON.stringify(store.tracks[0])})`);
  say('the form frames the picture with the saved position', E('dlg').innerHTML.includes('data-frame="picture"') && E('dlg').innerHTML.includes('translate(50%, 0%) scale(2)') && E('dlg').innerHTML.includes('class="framezoom"'));
  document.getElementById('f-name').value='Living room';
  const callsBefore=calls.length; await E('frm').onsubmit({preventDefault(){}});
  const savedTrack=calls.slice(callsBefore).find(c=>c[0]==='update'&&c[1]==='tracks');
  say('the framing is saved with the item', savedTrack && savedTrack[3].pictureFrame && savedTrack[3].pictureFrame.zoom===2 && savedTrack[3].pictureFrame.x===1);
  // the frame editor itself: zoom slider, dragging, reset
  let stored={zoom:1,x:0,y:0};
  const fimg={style:{}}, fzoom={value:'1'}, freset={}, fpic={getBoundingClientRect:()=>({width:200,height:150})};
  const fbox={dataset:{frame:'picture'},querySelector:q=>q==='.framebox'?fpic:q==='.framebox img'?fimg:q==='.framezoom'?fzoom:q==='.framereset'?freset:null};
  ctx.__root={querySelectorAll:()=>[fbox]}; ctx.__get=()=>stored; ctx.__set=(k,f)=>{stored=f};
  run('attachFrames(__root, __get, __set)');
  fzoom.value='2'; fzoom.oninput();
  say('zoom slider zooms and the preview follows', stored.zoom===2 && fimg.style.transform.includes('scale(2)'));
  fpic.onpointerdown({clientX:100,clientY:50,preventDefault(){}});
  (listeners.pointermove||[]).forEach(f=>f({clientX:120,clientY:50}));
  say('dragging the preview moves the picture', Math.abs(stored.x-0.2)<1e-9 && stored.y===0);
  (listeners.pointerup||[]).forEach(f=>f());
  say('releasing stops the drag', (listeners.pointermove||[]).length===0);
  freset.onclick(); say('reset centres and unzooms', stored.zoom===1 && stored.x===0 && fzoom.value===1);
  // Avatar widget settings
  await openEditor(); run("editorAdd('avatar')");
  say('Avatar widget settings offer picture position and zoom', E('side').innerHTML.includes('data-frame="frame"') && E('side').innerHTML.includes('class="framezoom"'));
  run("state.editing.draft.widgets.pop(); state.editing.sel=[]");
  run("state.settings.dbView='grid'; state.tab='database'; state.sub='tracks'"); await run('render()');
  say('the saved choice applies to every list that has pictures', E('subview').innerHTML.includes('class="cards"'));

  // ---- batch 2: PDF export of a session ----
  store.sessions=[{id:'s1',setupName:'Friday Sprint',sessionType:'race',trackId:'t1',trackName:'Living room',date:'2026-10-11T18:30:00Z',endedBy:'Every car finished',
    standings:[{pos:1,driverId:'d1',carId:'c1',driverName:'Alex',carName:'NSR Ford GT40',laps:2,best:5000,total:10500}]}];
  store.laps=[{id:'l1',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:1,time:5500},{id:'l2',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:2,time:5000}];
  run("state.tab='database'; state.sub='results'"); await run('render()');
  say('every session has an Export to PDF button', E('resbody').innerHTML.includes('Export to PDF') && E('resbody').innerHTML.includes('data-pdf="s1"'));
  { const cups = () => (E('resbody').innerHTML.match(/<svg class="trophy"/g) || []).length;
    say('the winner of a race has the cup: in the summary line and in front of the name in the table', cups() === 2 && /Winner: <svg class="trophy"[^]*?<\/svg> Alex<\/summary>/.test(E('resbody').innerHTML) && /<td><svg class="trophy"[^]*?<\/svg> Alex<\/td>/.test(E('resbody').innerHTML));
    say('...and with the Driver column on, the position cell has no cup (it is only there when the Driver column is off)', E('resbody').innerHTML.includes('<td>1</td><td><svg class="trophy"') && !E('resbody').innerHTML.includes('<td>1 <svg class="trophy"'));
    const keepS = store.sessions; store.sessions = [...keepS, { id: 's9', setupName: 'Quali', sessionType: 'qualifying', trackId: 't1', trackName: 'Living room', date: '2026-10-12T18:30:00Z', standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'NSR', laps: 2, best: 5000, total: 10500 }] },
      { id: 's8', setupName: 'Heats', sessionType: 'heats', trackId: 't1', trackName: 'Living room', date: '2026-10-13T18:30:00Z', standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'NSR', laps: 9, points: 0, best: 5000, total: null }, { pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Sam', carName: 'NSR', laps: 8, points: 0, best: 5100, total: null }],
        heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 5 }, { pos: 2, driverName: 'Sam', laps: 4 }] }, { heat: 2, rows: [{ pos: 1, driverName: 'Sam', laps: 5 }, { pos: 2, driverName: 'Alex', laps: 4 }] }] }];
    await run('render()'); const html = E('resbody').innerHTML;
    say('a qualifying has no winner\'s cup and its line says who was fastest, not who won; a heat race has one in its line, one in the table and one for every heat (4)', cups() === 6 && html.includes('Quali · Qualifying') && /Fastest: Alex<\/summary>/.test(html) && html.includes('1. <svg class="trophy"') && html.includes('2. Sam (4 laps'));
    store.sessions = keepS; await run('render()'); }
  { const prevAdd = api.add, got = []; // a double click on Save while the first save is being written adds one driver, not two; a failing save keeps the form open and says why
    api.add = async (e, it) => { got.push([e, it.name]); await new Promise(r => setTimeout(r, 30)); return { id: 'DX' }; };
    run('state.sub="drivers"'); run("openForm('drivers', null)"); await new Promise(r => setTimeout(r, 20));
    document.getElementById('f-name').value = 'Twice'; E('dlg').open = true;
    const ev = { preventDefault() {} }, frm = E('frm'); await Promise.all([frm.onsubmit(ev), frm.onsubmit(ev)]);
    say('a double click on Save in a database form adds the row once', got.length === 1 && got[0][0] === 'drivers' && got[0][1] === 'Twice');
    api.add = async () => { throw new Error('disk full'); }; E('dlg').open = true; await frm.onsubmit(ev);
    say('...and a save that fails says why and keeps the form open', E('err').textContent.includes('disk full') && E('dlg').open === true);
    api.add = prevAdd; E('dlg').open = false; run('state.sub="results"'); }
  { const keepS = store.sessions, wait = () => new Promise(r => setTimeout(r, 20));
    // the winner was deleted from the database: the runner-up is second, and is not called the winner; a session without results (a hand-made file) still shows
    store.sessions = [{ id: 's7', setupName: 'No winner left', sessionType: 'race', trackId: 't1', trackName: 'Living room', date: '2026-10-14T18:30:00Z', standings: [{ pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Sam', carName: 'NSR', laps: 4, best: 5200, total: 20500 }] },
      { id: 's6', setupName: 'Empty file', sessionType: 'race', trackId: 't1', trackName: 'Living room', date: '2026-10-15T18:30:00Z' }];
    await run('render()'); const h = E('resbody').innerHTML;
    { const line = (h.split('<details').find(x => x.includes('No winner left')) || '').split('</summary>')[0];
      say('a race whose winner was deleted does not call the runner-up the winner', line.includes('No winner left') && line.includes('Living room') && !line.includes('Winner') && !line.includes('Sam')); }
    say('a session without a list of results shows with an empty table instead of an empty page', h.includes('Empty file') && h.includes('No winner left') && !E('resbody').innerHTML.includes('undefined'));
    store.sessions = keepS; await run('render()'); }
  { const keepS = store.sessions; // 1.2.0: what the Race Director adjusted in the review shows in the results
    store.sessions = [{ ...keepS[0], standings: [{ ...keepS[0].standings[0], laps: 1, adjLaps: -1, adjMs: 5000 }] },
      { id: 's7', setupName: 'Pts', sessionType: 'heats', resultBy: 'points', trackId: 't1', trackName: 'Living room', date: '2026-10-13T18:30:00Z', standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'NSR', laps: 9, points: 23, adjPoints: 5, best: 5000, total: null }],
        heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 5, points: 15, adjPoints: 5 }, { pos: 2, driverName: 'Sam', laps: 3, points: 8, adjLaps: -1, adjMs: 2000 }] }] }];
    await run('render()'); const html = E('resbody').innerHTML;
    say('a driver whose result was adjusted has the amounts next to the name, and the total time has the adjustment in it (10.500 and 5 s is 15.500)', html.includes('Alex <span class="muted">(adjusted: −1 lap, +5 s)</span>') && html.includes('<td>15.500</td>'));
    say('...in a heat race the table says it with the points, and every heat says what was adjusted in it', html.includes('Alex <span class="muted">(adjusted: +5 pts)</span>') && html.includes('Alex (5 laps, 15 pts, adjusted: +5 pts)') && html.includes('Sam (3 laps, 8 pts, adjusted: −1 lap, +2 s)'));
    store.sessions = keepS; await run('render()');
    say('...and a result that was not adjusted has nothing about it', !E('resbody').innerHTML.includes('adjusted')); }
  { const keepS = store.sessions; // 1.3.0: what Balance of Power did shows in the results
    store.sessions = [{ ...keepS[0], standings: [{ ...keepS[0].standings[0], bopNote: 'hindered 20% (from the start to lap 12)' }] },
      { id: 's8', setupName: 'Heats', sessionType: 'heats', resultBy: 'laps', trackId: 't1', trackName: 'Living room', date: '2026-10-13T18:30:00Z', standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'NSR', laps: 9, points: 0, best: 5000, total: null }],
        heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 5, points: 0, bopNote: 'helped 15% (laps 2 to 4)' }, { pos: 2, driverName: 'Sam', laps: 3, points: 0 }] }] }];
    await run('render()'); const html = E('resbody').innerHTML;
    say('1.3.0: a driver who had Balance of Power has what it did next to the name, muted', html.includes('Alex <span class="muted">(Balance of Power: hindered 20% (from the start to lap 12))</span>'));
    say('...and a heat says it in its row', html.includes('Alex (5 laps, Balance of Power: helped 15% (laps 2 to 4))') && html.includes('Sam (3 laps)'));
    store.sessions = keepS; await run('render()');
    say('...and a result without it has nothing about it', !E('resbody').innerHTML.includes('Balance of Power')); }
  { const keepS = store.sessions; // 1.4.0: what the weather and the tyres did shows in the results
    store.sessions = [{ ...keepS[0], weatherNote: 'Cloudy from lap 8, rain from lap 10', standings: [{ ...keepS[0].standings[0], bopNote: 'helped 10% (from the start)', tyreNote: 'Wet tyres after lap 9' }] },
      { id: 's9', setupName: 'Heats', sessionType: 'heats', resultBy: 'laps', trackId: 't1', trackName: 'Living room', date: '2026-10-14T18:30:00Z', standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'NSR', laps: 9, points: 0, best: 5000, total: null }],
        heatResults: [{ heat: 1, weatherNote: 'Rain from lap 3', rows: [{ pos: 1, driverName: 'Alex', laps: 5, points: 0, tyreNote: 'Wet tyres after lap 4' }, { pos: 2, driverName: 'Sam', laps: 3, points: 0 }] }] }];
    await run('render()'); const html = E('resbody').innerHTML;
    say('1.4.0: a driver whose tyres were changed has it next to the name, muted, after Balance of Power', html.includes('Alex <span class="muted">(Balance of Power: helped 10% (from the start); Tyres: Wet tyres after lap 9)</span>'));
    say('...the weather is said under the table, and a heat says its own weather and the tyres in its row', html.includes('<p class="muted">Weather: Cloudy from lap 8, rain from lap 10</p>') && html.includes('Weather: Rain from lap 3') && html.includes('Alex (5 laps, Tyres: Wet tyres after lap 4)'));
    store.sessions = keepS; await run('render()');
    say('...and a result without it has nothing about it', !E('resbody').innerHTML.includes('Weather:') && !E('resbody').innerHTML.includes('Tyres:')); }
  { const keepS = store.sessions; // 1.23.0: the damage of a heat-based race shows in the results (behind the name, and in the row of every heat)
    store.sessions = [{ id: 's10', setupName: 'Heats', sessionType: 'heats', resultBy: 'laps', trackId: 't1', trackName: 'Living room', date: '2026-10-14T18:30:00Z',
      standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'NSR', laps: 9, points: 0, best: 5000, total: null, damageNote: '15 damage points in 2 heats, 1 repair (10 seconds in the pits), retired by damage in 1 heat' }, { pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Sam', carName: 'Sly', laps: 8, points: 0, best: 5200, total: null }],
      heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 5, points: 0, damageNote: '5 damage points, 1 repair (10 seconds in the pits)' }, { pos: 2, driverName: 'Sam', laps: 3, points: 0 }] }, { heat: 2, rows: [{ pos: 1, driverName: 'Sam', laps: 5, points: 0 }, { pos: 2, driverName: 'Alex', laps: 1, points: 0, damageNote: '10 damage points, retired by damage', damageOut: 'retire' }] }] }];
    await run('render()'); const html = E('resbody').innerHTML;
    say('1.23.0: a heat-based race says what the damage did: behind the name of the driver, muted, and in the row of each heat', html.includes('Alex <span class="muted">(Damage: 15 damage points in 2 heats, 1 repair (10 seconds in the pits), retired by damage in 1 heat)</span>') && html.includes('Alex (5 laps, Damage: 5 damage points, 1 repair (10 seconds in the pits))') && html.includes('Alex (1 laps, Damage: 10 damage points, retired by damage)'));
    say('...a driver without damage has nothing about it', html.includes('Sam (3 laps)') && !html.includes('Sam <span class="muted">(Damage'));
    store.sessions = keepS; await run('render()'); }
  say('...and it stands out: filled with the accent colour, with a page picture, and the Delete button next to it does not', /<button class="btn primary pdfbtn" type="button" data-pdf="s1"><svg[^>]*>.*?<\/svg><span>Export to PDF<\/span><\/button><button class="btn danger" data-delsession="s1">/.test(E('resbody').innerHTML) && (E('resbody').innerHTML.match(/class="btn primary pdfbtn"/g) || []).length === (E('resbody').innerHTML.match(/data-pdf="/g) || []).length);
  // Export to PDF asks what to include first (1.0.0): the helper clicks the button, then Export in the dialog that opens
  const pdfOpen=()=>E('resbody').onclick({target:{closest:sel=>sel.includes('data-pdf')?{dataset:{pdf:'s1'}}:null}});
  const dlgClick=(id,data)=>E('dlg').onclick({target:{closest:()=>({id,dataset:data||{}})}});
  const pdfClick=async()=>{ const done=pdfOpen(); await dlgClick('pdfgo'); await done; };
  await pdfClick();
  say('the report is sent to be saved as a PDF with a sensible file name', exported.length===1 && exported[0][1]==='Friday Sprint '+localDay('2026-10-11T18:30:00Z')+'.pdf' && exported[0][0].includes('All lap times') && exported[0][0].includes('5.500'));
  { const keepSet=api.setSettings; api.setSettings=async p=>{calls.push(['settings',p]);return {...run('state.settings'),...p}}; // (the stand-in of the window gives back only what was saved: here the speed unit has to stay)
    run("state.settings.speedUnit='mph'; globalThis.__rs = Report.sessionHtml; Report.sessionHtml = a => { globalThis.__unit = a.unit; globalThis.__dist = a.distUnit; return globalThis.__rs(a); }"); const nE=exported.length; await pdfClick();
    say('1.22.0: with the speed unit mph the PDF of a session is made with the unit mph (the speeds in it are written in mph: tests/report.test.js)', run('globalThis.__unit')==='mph' && exported.length===nE+1);
    run("state.settings.speedUnit=undefined"); await pdfClick();
    say('...and with no unit chosen it is made with km/h', run('globalThis.__unit')==='kmh' && exported.length===nE+2);
    say('1.27.0: with no distance unit chosen the PDF is made with metres', run('globalThis.__dist')==='m');
    run("state.settings.distanceUnit='ft'"); await pdfClick();
    say('...and with the distance unit feet and miles it is made with feet (the distance in it is in feet: tests/report.test.js), the speed unit being a thing of its own', run('globalThis.__dist')==='ft' && run('globalThis.__unit')==='kmh' && exported.length===nE+3);
    run("delete state.settings.distanceUnit");
    run("Report.sessionHtml = globalThis.__rs; state.settings.pdfPages=undefined"); api.setSettings=keepSet; exported.length=nE; }
  say('the user is told where it was saved', E('pdfmsg-s1').textContent==='Saved to C:/Reports/x.pdf');
  exportResult={saved:false}; await pdfClick();
  say('cancelling the save dialog is handled', E('pdfmsg-s1').textContent==='Export cancelled.');
  api.exportPdf=async()=>{throw new Error('disk full')}; await pdfClick();
  say('errors are shown instead of failing silently', E('pdfmsg-s1').textContent==='Could not make the PDF: disk full');
  // ---- 1.0.0: the PDF dialog ----
  { api.exportPdf=async(html,name)=>{exported.push([html,name]);return exportResult}; exportResult={saved:true,path:'C:/Reports/x.pdf'};
    const keepSet=api.setSettings; api.setSettings=async p=>{calls.push(['settings',p]);return {...run('state.settings'),...p}};
    run('state.settings.pdfPages=undefined; state.settings.viewSettings=undefined; viewBars.clear()');
    let n=exported.length, done=pdfOpen(), d=E('dlg').innerHTML;
    say('Export to PDF asks what to include: pages (results table, every lap time), the columns of the table, Export and Cancel', d.includes('<h3>Export to PDF</h3>') && ['results','laps'].every(k=>d.includes(`data-pdfpage="${k}" checked`)) && !d.includes('data-pdfpage="heats"') && d.includes('id="pdfgo"') && d.includes('id="pdfcancel"'));
    say('...the columns are those of this session, checked as the View settings have them (average lap and consistency on, median off; speed is not offered: the track has no length)', ['pos','driver','car','laps','best','total','avg','spread'].every(k=>d.includes(`data-pdfcol="${k}" checked`)) && d.includes('data-pdfcol="median">') && !d.includes('data-pdfcol="speed"') && !d.includes('data-pdfcol="pits"'));
    await dlgClick('pdfcancel'); await done;
    say('Cancel makes no PDF', exported.length===n);
    done=pdfOpen();
    E('dlg').onchange({target:{dataset:{pdfpage:'laps'},checked:false}}); E('dlg').onchange({target:{dataset:{pdfcol:'avg'},checked:false}}); E('dlg').onchange({target:{dataset:{pdfcol:'median'},checked:true}});
    await dlgClick('pdfgo'); await done;
    let html=exported[exported.length-1][0];
    say('the PDF holds what was picked: no page with lap times, the Median lap column instead of the Average lap column', exported.length===n+1 && !html.includes('All lap times') && html.includes('<th>Median lap</th>') && !html.includes('<th>Average lap</th>') && html.includes('<th>Consistency</th>') && html.includes('<th>Pos</th>'));
    say('the choice of pages is kept in the settings', calls.some(c=>c[0]==='settings'&&c[1].pdfPages&&c[1].pdfPages.laps===false&&c[1].pdfPages.results===true));
    done=pdfOpen(); d=E('dlg').innerHTML;
    say('...and the dialog starts with the pages as they were left; the columns go back to the View settings', d.includes('data-pdfpage="results" checked') && d.includes('data-pdfpage="laps">') && d.includes('data-pdfcol="avg" checked') && d.includes('data-pdfcol="median">'));
    E('dlg').onchange({target:{dataset:{pdfpage:'results'},checked:false}}); await dlgClick('pdfgo');
    say('nothing to include gives a message and the dialog stays', E('pdferr').textContent==='Pick at least one thing to include.' && exported.length===n+1);
    E('dlg').onchange({target:{dataset:{pdfpage:'results'},checked:true}}); await dlgClick('', {pdfall:'0'}); await dlgClick('pdfgo');
    say('a results table without columns gives a message too', E('pdferr').textContent==='Pick at least one column, or leave the results table out.' && exported.length===n+1);
    await dlgClick('', {pdfall:'1'}); await dlgClick('pdfgo'); await done;
    html=exported[exported.length-1][0];
    say('All columns picks every column that this session has', exported.length===n+2 && ['Pos','Driver','Car','Laps','Best lap','Total time','Average lap','Median lap','Consistency'].every(c=>html.includes(`<th>${c}</th>`)));
    api.setSettings=keepSet; run('state.settings.pdfPages=undefined');
  }
  // ---- 1.0.0: View settings of Results and Records ----
  { const keepSet=api.setSettings; api.setSettings=async p=>{calls.push(['settings',p]);return {...run('state.settings'),...p}};
    const keep={tracks:store.tracks,sessions:store.sessions,laps:store.laps,drivers:store.drivers,slotcars:store.slotcars};
    Object.assign(store,{tracks:[{id:'t1',name:'Living room',lanes:2,length:10,scale:'1:32',laneModifier:'none'}],drivers:[{id:'d1',name:'Alex'}],slotcars:[{id:'c1',brand:'NSR',scale:'1:24'}],
      sessions:[{id:'s1',setupName:'Friday Sprint',sessionType:'race',trackId:'t1',trackName:'Living room',date:'2026-10-11T18:30:00Z',standings:[{pos:1,driverId:'d1',carId:'c1',driverName:'Alex',carName:'NSR',laps:3,best:5000,total:16000,pits:1,pitTime:4000,penaltyPoints:2}]}],
      laps:[{id:'l1',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lane:1,lapNumber:1,time:5200,date:'2026-10-11T18:31:00Z'},{id:'l2',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lane:1,lapNumber:2,time:5000,date:'2026-10-11T18:32:00Z'},{id:'l3',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lane:1,lapNumber:3,time:5800,pit:true,date:'2026-10-11T18:33:00Z'}]});
    run('state.settings.viewSettings=undefined; viewBars.clear(); folderClosed.clear()');
    const rb=mk(); await run('renderResultsPool')(rb,'racing'); let h=rb.innerHTML;
    const heads=(h,from)=>((h.split(from)[1]||'').match(/<table[^>]*>.*?<\/tr>/s)||[''])[0].match(/<th>(.*?)<\/th>/g)?.map(x=>x.replace(/<\/?th>/g,''))||[];
    say('the buttons above the folders end with View settings, after Open all and Close all', /data-folderall="1">Open all<\/button><button class="btn" type="button" data-folderall="0">Close all<\/button><button class="btn vsbtn" type="button" data-viewbar="results" aria-expanded="false"[^>]*>View settings<\/button>/.test(h));
    say('...the bar is closed to start', !h.includes('class="viewbar"'));
    say('the session table shows the old columns and the new figures that are on to start', heads(h,'data-folder="results:sessions"').join()==='Pos,Driver,Car,Laps,Best lap,Total time,Average lap,Consistency,Average speed,Pit stops,Pit time,Penalty points');
    say('...with the figures worked out from the laps (the pit lap is left out: average 5.100, 20 m in 10.2 s is 7.1 km/h) and the pit stops and points that were saved', h.includes('<td>5.100</td>') && h.includes('7.1 km/h') && h.includes('<td>±0.141 s</td>') && h.includes('<td>4.000</td>'));
    say('...and a line that tells how the figures are counted', h.includes('Lap figures count the valid laps only'));
    say('the records show the average speed of the lap, the session and the date; lane, lap number and scale speed are off to start', heads(h,'data-folder="results:tracks"').join()==='Track,Driver,Lap time,Car,Average speed,Session,Set on,' && h.includes('<td>7.2 km/h</td>') && h.includes('<td>Friday Sprint</td>'));
    say('...a pit lap is in italics in the list of lap times', h.includes('<em title="Lap with a pit stop">3: 5.800</em>'));
    // the bar
    await rb.onclick({target:{closest:sel=>sel==='[data-viewbar]'?{dataset:{viewbar:'results'}}:null}}); h=rb.innerHTML;
    say('the View settings button opens a bar with a group for the records and one for the sessions, a check box for every column', h.includes('class="viewbar"') && h.includes('aria-expanded="true"') && h.includes('<legend>Track records and personal bests</legend>') && h.includes('<legend>Sessions</legend>') &&
      ['track','driver','time','car','speed','scalespeed','session','lane','lapno','date'].every(k=>h.includes(`data-vs="results/records" data-key="${k}"`)) && ['pos','avg','median','spread','speed','scalespeed','distance','pits','pittime','penalty'].every(k=>h.includes(`data-vs="results/sessions" data-key="${k}"`)));
    say('...checked as they are shown now', h.includes('data-vs="results/sessions" data-key="avg" checked') && h.includes('data-vs="results/sessions" data-key="median">') && h.includes('data-vs="results/records" data-key="lane">'));
    const tick=(vs,key,on)=>rb.onchange({target:{dataset:{vs,key},checked:on}});
    await tick('results/sessions','spread',false); h=rb.innerHTML;
    say('turning a column off hides it right away, and the bar stays open', !heads(h,'data-folder="results:sessions"').includes('Consistency') && h.includes('class="viewbar"') && h.includes('data-vs="results/sessions" data-key="spread">'));
    say('...and it is kept in the settings', JSON.stringify(run('state.settings.viewSettings'))==='{"results":{"sessions":{"spread":false}}}' && calls.some(c=>c[0]==='settings'&&c[1].viewSettings));
    await tick('results/sessions','scalespeed',true); await tick('results/sessions','distance',true); await tick('results/records','lane',true); await tick('results/records','scalespeed',true); h=rb.innerHTML;
    say('columns that are off to start can be turned on: scale speed (car 1:24: 7.1 km/h is 169 at scale), distance', heads(h,'data-folder="results:sessions"').slice(-6).join()==='Average speed,Average scale speed,Distance,Pit stops,Pit time,Penalty points' && h.includes('<td>169 km/h</td>') && h.includes('<td>30 m</td>'));
    say('...in the records too: the lane and the scale speed of the lap', heads(h,'data-folder="results:tracks"').join()==='Track,Driver,Lap time,Car,Average speed,Average scale speed,Session,Lane,Set on,' && h.includes('<td>173 km/h</td>'));
    { run("state.settings.speedUnit='mph'"); const rm=mk(); await run('renderResultsPool')(rm,'racing'); const hm=rm.innerHTML;
      say('1.22.0: with the speed unit mph the sessions and the records show miles per hour (7.1 km/h is 4.4 mph, 169 at scale is 105 mph, the lap of 7.2 km/h is 4.5 mph and 173 at scale is 107 mph) and no km/h is left', !hm.includes('km/h') && hm.includes('<td>4.4 mph</td>') && hm.includes('<td>105 mph</td>') && hm.includes('<td>4.5 mph</td>') && hm.includes('<td>107 mph</td>'));
      say('...the other columns are as they were (the lap times, the distance in metres)', hm.includes('<td>5.100</td>') && hm.includes('<td>30 m</td>'));
      run("state.settings.speedUnit=undefined"); }
    { run("state.settings.distanceUnit='ft'"); const rm=mk(); await run('renderResultsPool')(rm,'racing'); const hf=rm.innerHTML;
      say('1.27.0: with the distance unit feet and miles the distance of the sessions is in feet (30 m is 98 ft) and no metre is left; the speeds and the lap times are as they were', hf.includes('<td>98 ft</td>') && !hf.includes('<td>30 m</td>') && hf.includes('<td>5.100</td>') && hf.includes('km/h'));
      run("delete state.settings.distanceUnit"); }
    // the last column cannot go
    for (const k of ['track','driver','time','car','speed','scalespeed','session','lane','date']) await tick('results/records',k,false);
    h=rb.innerHTML;
    say('the last column of a table cannot be turned off: its check box is switched off', heads(h,'data-folder="results:tracks"').join()==='Set on,' && h.includes('data-vs="results/records" data-key="date" checked disabled') && (h.match(/data-vs="results\/records" data-key="\w+" checked/g)||[]).length===1);
    await rb.onclick({target:{closest:sel=>sel==='[data-vsreset]'?{dataset:{vsreset:'results'}}:null}}); h=rb.innerHTML;
    say('Back to the standard view puts both tables back', JSON.stringify(run('state.settings.viewSettings.results.records'))==='{}' && JSON.stringify(run('state.settings.viewSettings.results.sessions'))==='{}' && heads(h,'data-folder="results:tracks"').join()==='Track,Driver,Lap time,Car,Average speed,Session,Set on,' && heads(h,'data-folder="results:sessions"').includes('Consistency'));
    const rb2=mk(); await run('renderResultsPool')(rb2,'racing');
    say('the bar stays open when the page is drawn again (it is remembered while the app runs)', rb2.innerHTML.includes('class="viewbar"'));
    await rb2.onclick({target:{closest:sel=>sel==='[data-viewbar]'?{dataset:{viewbar:'results'}}:null}});
    say('...and the button closes it', !rb2.innerHTML.includes('class="viewbar"') && rb2.innerHTML.includes('aria-expanded="false"'));
    // a session from before 1.0.0
    Object.assign(store,{sessions:[{...store.sessions[0],standings:[{pos:1,driverId:'d1',carId:'c1',driverName:'Alex',carName:'NSR',laps:3,best:5000,total:16000}]}],laps:store.laps.map(l=>({id:l.id,sessionId:l.sessionId,driverId:l.driverId,carId:l.carId,trackId:l.trackId,lapNumber:l.lapNumber,time:l.time,date:l.date}))});
    const rb3=mk(); await run('renderResultsPool')(rb3,'racing');
    say('a session saved before 1.0.0 (no lane, no pit stops, no penalty system) still shows what can be worked out and leaves the rest out', heads(rb3.innerHTML,'data-folder="results:sessions"').join()==='Pos,Driver,Car,Laps,Best lap,Total time,Average lap,Consistency,Average speed');
    // the Token Records pool has its own group
    run('viewBars.add("results")');
    // the bar: a note on the columns that are only there sometimes, and a check box it does not know changes nothing
    { const rb4=mk(); await run('renderResultsPool')(rb4,'racing');
      say('the check boxes of columns that only some sessions have say so when you hold the mouse over them (Points, Pit stops)', rb4.innerHTML.includes('title="Shown only in a race that is decided on points"') && rb4.innerHTML.includes('title="Shown only when the race had fuel or pit stops"'));
      const before=JSON.stringify(run('state.settings.viewSettings')); await rb4.onchange({target:{dataset:{vs:'nothing/here',key:'x'},checked:false}}); await rb4.onchange({target:{dataset:{},checked:false}});
      say('a check box that is not one of the tables changes nothing (and breaks nothing)', JSON.stringify(run('state.settings.viewSettings'))===before); }
    Object.assign(store,{sessions:[{id:'k1',setupName:'Open evening',sessionType:'tokens',trackId:'t1',trackName:'Living room',date:'2026-10-11T19:00:00Z',token:{stint:'a',lane:2,bought:600000,carried:0,left:0},standings:[{pos:1,driverId:'d1',carId:'c1',driverName:'Alex',carName:'NSR',laps:2,lateLaps:0,best:5000,total:10200}]}],
      laps:[{id:'k1l1',sessionId:'k1',token:true,stint:'a',lane:2,driverId:'d1',carId:'c1',trackId:'t1',lapNumber:1,time:5200,date:'2026-10-11T19:01:00Z'},{id:'k1l2',sessionId:'k1',token:true,stint:'a',lane:2,driverId:'d1',carId:'c1',trackId:'t1',lapNumber:2,time:5000,date:'2026-10-11T19:02:00Z'}]});
    const tb=mk(); await run('renderResultsPool')(tb,'tokens'); h=tb.innerHTML;
    say('a stint has the average lap and the average speed besides its old columns (the lane 2 of a track with equal lanes: 10 m)', heads(h,'data-folder="tresults:sessions"').join()==='Driver,Car,Lane,Time bought,Laps,Late laps,Best lap,Total time,Average lap,Average speed' && h.includes('<td>5.100</td>') && h.includes('<td>7.1 km/h</td>'));
    { run("state.settings.speedUnit='mph'"); const tm=mk(); await run('renderResultsPool')(tm,'tokens');
      say('1.22.0: with the speed unit mph the average speed of a stint is in mph (7.1 km/h is 4.4 mph)', tm.innerHTML.includes('<td>4.4 mph</td>') && !tm.innerHTML.includes('km/h')); run("state.settings.speedUnit=undefined"); }
    { const vs0 = JSON.stringify(run('state.settings.viewSettings') ?? null); run("state.settings.viewSettings = { results: { stints: { distance: true } } }"); const tm0=mk(); await run('renderResultsPool')(tm0,'tokens'); run("state.settings.distanceUnit='ft'"); const tm=mk(); await run('renderResultsPool')(tm,'tokens');
      say('1.27.0: the distance of a stint is in metres, and with the distance unit feet and miles in feet (20 m is 66 ft), the speed staying in km/h', tm0.innerHTML.includes('<td>20 m</td>') && !tm0.innerHTML.includes(' ft</td>') && tm.innerHTML.includes('<td>66 ft</td>') && !tm.innerHTML.includes('<td>20 m</td>') && tm.innerHTML.includes('<td>7.1 km/h</td>'));
      run("delete state.settings.distanceUnit; state.settings.viewSettings = " + vs0 + "; if (state.settings.viewSettings === null) delete state.settings.viewSettings"); }
    say('...its bar has the group Stints, with its own columns', h.includes('<legend>Stints</legend>') && h.includes('data-vs="results/stints" data-key="distance"') && !h.includes('data-vs="results/sessions"'));
    await tb.onchange({target:{dataset:{vs:'results/stints',key:'late'},checked:false}});
    say('...turning one off changes the stints and not the sessions of the racing pool', !heads(tb.innerHTML,'data-folder="tresults:sessions"').includes('Late laps') && JSON.stringify(run('state.settings.viewSettings.results.stints'))==='{"late":false}' && JSON.stringify(run('state.settings.viewSettings.results.sessions'))==='{}');
    // a stint on a track without a length has no speed and no distance (and the average lap stays)
    store.tracks[0].length=''; const tb2=mk(); await run('renderResultsPool')(tb2,'tokens');
    say('a track without a length: no speed and distance columns for a stint, the average lap stays', !heads(tb2.innerHTML,'data-folder="tresults:sessions"').some(c=>/speed|Distance/.test(c)) && heads(tb2.innerHTML,'data-folder="tresults:sessions"').includes('Average lap'));
    run('state.settings.viewSettings=undefined; viewBars.clear()');
    Object.assign(store,keep); api.setSettings=keepSet; }
  // ---- 1.0.0: View settings of Tracks, Drivers and Slotcars ----
  { const keepSet=api.setSettings; api.setSettings=async p=>{calls.push(['settings',p]);return {...run('state.settings'),...p}};
    const keep={tracks:store.tracks,drivers:store.drivers,slotcars:store.slotcars};
    Object.assign(store,{tracks:[{id:'t1',name:'Living room',lanes:2,scale:'1:32',surface:'Wood',length:12,notes:'Fast'}],drivers:[{id:'d1',name:'Alex',nickname:'Al',callsign:'ALX',flag:'NL',dateOfBirth:'1980-01-01'}],slotcars:[{id:'c1',brand:'NSR',manufacturer:'NSR',model:'GT40',scale:'1:32',motor:'King',tyres:'Urethane',gearing:'9/27',lapsDriven:3}]});
    run("state.settings.viewSettings=undefined; viewBars.clear(); state.settings.dbView='list'; state.tab='database'; state.sub='tracks'"); await run('render()');
    const sv=E('subview'), th=h=>(h.match(/<tr>.*?<\/tr>/s)||[''])[0].match(/<th>(.*?)<\/th>/g)?.map(x=>x.replace(/<\/?th>/g,''))||[];
    let h=sv.innerHTML;
    say('Tracks: View settings sits after Extra fields and before the List / Grid choice', /id="extra">Extra fields…<\/button><button class="btn vsbtn" type="button" data-viewbar="mgr:tracks"[^>]*>View settings<\/button><span class="seg"/.test(h));
    say('...the list shows every field to start, as it always did', th(h).join()==='Name,Number of lanes,Scale,Track Surface,Track length (metres),Lane length modifier,The track length is that of,Distance between the lanes (millimetres, centre to centre),Full turns the track makes (left bends minus right bends),Length of every lane (metres), lane 1 first,Minimum lap time (seconds),Maximum lap time (seconds),Deslot time (seconds),Picture,Notes,');
    const click=(el,attrs)=>el.onclick({target:{closest:sel=>sel==='button'?{dataset:attrs}:null}});
    await click(sv,{viewbar:'mgr:tracks'}); h=sv.innerHTML;
    say('the button opens a bar with a check box for every column of the list, all checked', h.includes('class="viewbar"') && h.includes('<legend>Columns in the track list</legend>') && h.includes('data-vs="tracks/list" data-key="surface" checked') && h.includes('data-vs="tracks/list" data-key="notes" checked') && h.includes('turn columns'.replace('turn','Turn')));
    const tick=(vs,key,on)=>sv.onchange({target:{dataset:{vs,key},checked:on}});
    await tick('tracks/list','laneModifier',false); await tick('tracks/list','picture',false); await tick('tracks/list','laneSpacing',false);
    say('columns can be turned off: they leave the list and stay in the form', !th(sv.innerHTML).includes('Lane length modifier') && !th(sv.innerHTML).includes('Picture') && th(sv.innerHTML).includes('Notes') && th(sv.innerHTML).length===th(h).length-3);
    say('...and the choice is kept for the List view of Tracks', JSON.stringify(run('state.settings.viewSettings'))==='{"tracks":{"list":{"laneModifier":false,"picture":false,"laneSpacing":false}}}');
    // the grid has its own rows
    await click(sv,{}); // (a click on nothing that is a button we know)
    run("state.settings.dbView='grid'"); await run('render()'); h=sv.innerHTML;
    say('the Grid view has View settings of its own: the rows of the cards are lanes, scale and surface to start', h.includes('class="cards"') && h.includes('<legend>Rows on the track cards</legend>') && h.includes('data-vs="tracks/grid" data-key="lanes" checked') && h.includes('data-vs="tracks/grid" data-key="surface" checked') && h.includes('data-vs="tracks/grid" data-key="length">') && !h.includes('data-key="name"') && !h.includes('data-key="picture"') &&
      h.includes('Number of lanes') && h.includes('Wood') && !h.includes('<span class="muted">Track length'));
    await tick('tracks/grid','length',true); await tick('tracks/grid','scale',false); h=sv.innerHTML;
    say('...rows can be turned on and off', h.includes('<span class="muted">Track length (metres)</span> 12 m') && !h.includes('<span class="muted">Scale</span>') && h.includes('Wood') && JSON.stringify(run('state.settings.viewSettings.tracks.grid'))==='{"length":true,"scale":false}');
    say('...and the List choices are not touched', JSON.stringify(run('state.settings.viewSettings.tracks.list'))==='{"laneModifier":false,"picture":false,"laneSpacing":false}');
    await tick('tracks/grid','lanes',false); await tick('tracks/grid','surface',false); await tick('tracks/grid','length',false);
    say('the last row of a card cannot be turned off', /data-vs="tracks\/grid" data-key="\w+" checked disabled/.test(sv.innerHTML) && (sv.innerHTML.match(/data-vs="tracks\/grid" data-key="\w+" checked/g)||[]).length===1);
    await click(sv,{vsreset:'mgr:tracks'}); h=sv.innerHTML;
    say('Back to the standard view resets the view that is on screen only (the Grid), not the List', JSON.stringify(run('state.settings.viewSettings.tracks.grid'))==='{}' && JSON.stringify(run('state.settings.viewSettings.tracks.list'))!=='{}' && h.includes('data-vs="tracks/grid" data-key="surface" checked'));
    // drivers and slotcars
    run("state.sub='drivers'"); await run('render()'); await click(sv,{viewbar:'mgr:drivers'}); h=sv.innerHTML;
    say('Drivers has it too: the card has nickname, callsign and flag to start (Date of birth can be turned on)', h.includes('<legend>Rows on the driver cards</legend>') && h.includes('data-vs="drivers/grid" data-key="callsign" checked') && h.includes('data-vs="drivers/grid" data-key="dateOfBirth">') && h.includes('ALX') && !h.includes('1980'));
    await tick('drivers/grid','dateOfBirth',true);
    say('...and the date of birth then shows on the card', sv.innerHTML.includes('Date of birth</span> 1980-01-01'));
    run("state.sub='slotcars'"); await run('render()'); await click(sv,{viewbar:'mgr:slotcars'}); h=sv.innerHTML;
    say('Slotcars has it too: scale, motor, tyres and laps driven to start; gearing and weight can be turned on; the pictures and the name are not rows', h.includes('<legend>Rows on the slot car cards</legend>') && h.includes('data-vs="slotcars/grid" data-key="lapsDriven" checked') && h.includes('data-vs="slotcars/grid" data-key="gearing">') && !h.includes('data-vs="slotcars/grid" data-key="brand"') && !h.includes('data-key="extraPictures"') && !h.includes('data-key="picture"'));
    run("state.settings.dbView='list'"); await run('render()'); h=sv.innerHTML;
    say('...the list of Slotcars has every field to start, with the pictures', h.includes('<legend>Columns in the slot car list</legend>') && h.includes('data-vs="slotcars/list" data-key="extraPictures" checked') && h.includes('data-vs="slotcars/list" data-key="brand" checked'));
    run("state.sub='results'"); await run('render()');
    say('Results and Records gets none of the click handlers of the page that was before it (its View settings button used to bring up the Drivers page)', sv.onclick === null && sv.onchange === null && E('resbody').innerHTML.includes('data-viewbar="results"') && !E('resbody').innerHTML.includes('data-viewbar="mgr:'));
    run("state.sub='drivers'"); await run('render()');
    say('...and a list page that comes after it has its own again', typeof sv.onclick === 'function');
    // the other lists have none
    run("state.sub='tracks'"); run("state.tab='setup'"); await run('render()');
    say('the Race Setup list has no View settings (only Tracks, Drivers and Slotcars were asked for)', !E('setupmgr').innerHTML.includes('View settings'));
    run("state.tab='database'; state.sub='tracks'; state.settings.viewSettings=undefined; viewBars.clear()");
    Object.assign(store,keep); api.setSettings=keepSet; }
  // ---- batch C: removing records only ----
  Object.assign(store, { sessions:[{id:'s1',setupName:'S',sessionType:'race',trackId:'t1',trackName:'Living room',date:'2026-01-01T10:00:00Z',standings:[{pos:1,driverId:'d1',driverName:'Alex',carName:'c',laps:2,best:5000,total:10000}]}],
    drivers:[{id:'d1',name:'Alex'}], slotcars:[{id:'c1',brand:'Car'}],
    laps:[{id:'l1',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:1,time:5000,date:'2026-01-01T10:00:00Z'},{id:'l2',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:2,time:6000,date:'2026-01-01T10:00:00Z'}] });
  const delRec=(box,kind,lap)=>box.onclick({target:{closest:sel=>sel==='[data-delrec]'?{dataset:{delrec:kind,lap}}:null}});
  const resBox=mk(); await run('renderResultsPool')(resBox, 'racing');
  say('records show the fastest lap with a Remove button', resBox.innerHTML.includes('5.000') && resBox.innerHTML.includes('data-delrec="track"') && resBox.innerHTML.includes('data-delrec="pb"'));
  await delRec(resBox,'track','l1');
  say('removing a track record only flags the lap', calls.some(c=>c[0]==='update'&&c[1]==='laps'&&c[2]==='l1'&&c[3].noTrackRecord===true) && store.laps.length===2);
  const resBox2=mk(); await run('renderResultsPool')(resBox2, 'racing');
  const part=(h,a,b)=>h.split(a)[1].split(b)[0];
  say('the next fastest lap takes over the track record', part(resBox2.innerHTML,'Track records','Personal bests').includes('6.000') && !part(resBox2.innerHTML,'Track records','Personal bests').includes('5.000'));
  say('the lap is still a personal best and still in its session', part(resBox2.innerHTML,'Personal bests','Sessions').includes('5.000') && resBox2.innerHTML.includes('1: 5.000'));
  await delRec(resBox2,'pb','l1');
  const resBox3=mk(); await run('renderResultsPool')(resBox3, 'racing');
  say('removing a personal best hands it to the next lap', part(resBox3.innerHTML,'Personal bests','Sessions').includes('6.000') && !part(resBox3.innerHTML,'Personal bests','Sessions').includes('5.000') && resBox3.innerHTML.includes('1: 5.000'));
  // ---- folders: Results and Records, and Race Setups, look like the groups of the forms ----
  { const keep = { sessions: store.sessions, laps: store.laps, drivers: store.drivers, slotcars: store.slotcars };
    Object.assign(store, { drivers:[{id:'d1',name:'Alex'},{id:'d2',name:'Sam'}], slotcars:[{id:'c1',brand:'Car'}],
      sessions:[{id:'s1',setupName:'S',sessionType:'race',trackId:'t1',trackName:'Living room',date:'2026-01-01T10:00:00Z',standings:[{pos:1,driverId:'d1',driverName:'Alex',carName:'c',laps:2,best:5000,total:10000}]},
        {id:'s2',setupName:'P',sessionType:'practice',trackId:'t1',trackName:'Living room',date:'2026-01-02T10:00:00Z',standings:[{pos:1,driverId:'d2',driverName:'Sam',carName:'c',laps:1,best:5500,total:5500}]}],
      laps:[{id:'l1',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:1,time:5000,date:'2026-01-01T10:00:00Z'},{id:'l2',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:2,time:6000,date:'2026-01-01T10:00:00Z'},
        {id:'l3',sessionId:'s2',driverId:'d2',carId:'c1',trackId:'t1',lapNumber:1,time:5500,date:'2026-01-02T10:00:00Z'}] });
    run('folderClosed.clear()');
    const rb = mk(); await run('renderResultsPool')(rb, 'racing'); const h = rb.innerHTML, tags = h.match(/<details class="dbfolder"[^>]*>/g) || [], opens = () => (rb.innerHTML.match(/<details class="dbfolder"[^>]* open>/g) || []).length;
    say('Results and Records has three folders, Track records, Personal bests and Sessions, each telling how many it holds', tags.length === 3 && h.includes('<strong>Track records</strong> <span class="muted">1 record</span>') && h.includes('<strong>Personal bests</strong> <span class="muted">2 personal bests</span>') && h.includes('<strong>Sessions</strong> <span class="muted">2 sessions</span>'));
    say('...the folders are open to start, and each has its own key (page and folder)', opens() === 3 && ['results:tracks','results:pb','results:sessions'].every(k => h.includes(`data-folder="${k}"`)));
    say('...the records are in the first two folders (with their Remove buttons) and the sessions, still rows that open, in the third', h.indexOf('data-folder="results:tracks"') < h.indexOf('data-delrec="track"') && h.indexOf('data-delrec="track"') < h.indexOf('data-folder="results:pb"') && h.indexOf('data-delrec="pb"') < h.indexOf('data-folder="results:sessions"') && h.indexOf('data-folder="results:sessions"') < h.indexOf('<details class="card sess" data-sid="') && (h.match(/<details class="card sess" data-sid="/g) || []).length === 2 && h.includes('data-pdf="s1"') && h.includes('data-pdf="s2"') && h.endsWith('</div></details></details>'));
    say('...Open all and Close all sit above them, in the bar of the forms', h.startsWith('<div class="fgtools"><button class="btn" type="button" data-folderall="1">Open all</button><button class="btn" type="button" data-folderall="0">Close all</button><button class="btn vsbtn"'));
    const all_ = v => rb.onclick({ target: { closest: sel => sel === '[data-folderall]' ? { dataset: { folderall: v } } : null } });
    await all_('0'); say('Close all closes the three folders', opens() === 0 && (rb.innerHTML.match(/<details class="dbfolder"/g) || []).length === 3);
    await all_('1'); say('...and Open all opens them again', opens() === 3);
    { const mine = [{ dataset: { folder: 'results:pb' }, open: true }, { dataset: { folder: 'results:sessions' }, open: true }];
      rb.querySelectorAll = sel => sel === 'details.dbfolder' ? mine : []; await run('renderResultsPool')(rb, 'racing');
      mine[0].open = false; mine[0].ontoggle(); await run('renderResultsPool')(rb, 'racing');
      say('a folder you close stays closed when the page is drawn again (a record removed, a session deleted), the others stay open', opens() === 2 && /data-folder="results:pb"><summary>/.test(rb.innerHTML) && /data-folder="results:tracks" open>/.test(rb.innerHTML) && /data-folder="results:sessions" open>/.test(rb.innerHTML));
      mine[0].open = true; mine[0].ontoggle(); await run('renderResultsPool')(rb, 'racing'); say('...and one you open again is open again', opens() === 3);
      rb.querySelectorAll = () => [mk(), mk(), mk()]; }
    await all_('0'); const rb2 = mk(); await run('renderResultsPool')(rb2, 'racing');
    say('the state is kept while the app runs, also for the page drawn in a new place (another tab and back)', (rb2.innerHTML.match(/<details class="dbfolder"[^>]* open>/g) || []).length === 0);
    await all_('1');
    store.laps = store.laps.filter(l => l.sessionId === 's2'); const rb3 = mk(); await run('renderResultsPool')(rb3, 'racing');
    say('the folders count what the laps hold: with the laps of one session only, one record, and the sessions are still two', rb3.innerHTML.includes('<strong>Track records</strong> <span class="muted">1 record</span>') && rb3.innerHTML.includes('<strong>Sessions</strong> <span class="muted">2 sessions</span>'));
    store.laps = []; const rb4 = mk(); await run('renderResultsPool')(rb4, 'racing');
    say('without laps the two record folders count none and say None yet, and the sessions are still listed', rb4.innerHTML.includes('<strong>Track records</strong> <span class="muted">0 records</span>') && rb4.innerHTML.includes('<strong>Personal bests</strong> <span class="muted">0 personal bests</span>') && (rb4.innerHTML.match(/None yet\./g) || []).length === 2 && rb4.innerHTML.includes('<strong>Sessions</strong> <span class="muted">2 sessions</span>'));
    store.sessions = []; const rb5 = mk(); await run('renderResultsPool')(rb5, 'racing');
    say('without sessions there are no folders, only the sentence that tells where results come from', !rb5.innerHTML.includes('dbfolder') && rb5.innerHTML.includes('No results yet.'));
    Object.assign(store, keep); run('folderClosed.clear()'); }
  { // Racing Records and Token Records are two pools that never mix
    const keep = { sessions: store.sessions, laps: store.laps, drivers: store.drivers, slotcars: store.slotcars };
    Object.assign(store, { drivers:[{id:'d1',name:'Alex'}], slotcars:[{id:'c1',brand:'Car'}],
      sessions:[{id:'s1',setupName:'S',sessionType:'race',trackId:'t1',trackName:'Living room',date:'2026-01-01T10:00:00Z',standings:[{pos:1,driverId:'d1',driverName:'Alex',carName:'c',laps:2,best:5000,total:10000}]},
        {id:'k1',setupName:'Club night',sessionType:'tokens',trackId:'t1',trackName:'Living room',date:'2026-02-01T10:00:00Z',endedBy:'The time ran out',token:{stint:1,lane:2,bought:600000,carried:0,left:0},standings:[{pos:1,driverId:'d1',carId:'c1',driverName:'Alex',carName:'Car',laps:2,lateLaps:1,best:4000,total:9000,lane:2,bought:600000}]},
        {id:'k2',setupName:'Club night',sessionType:'tokens',trackId:'t1',trackName:'Living room',date:'2026-02-01T11:00:00Z',endedBy:'The driver changed',token:{stint:2,lane:1,bought:90000,carried:30000,left:20000},standings:[{pos:1,driverId:'',carId:'c1',driverName:'Guest',carName:'Car',laps:1,lateLaps:0,best:3000,total:3000,lane:1,bought:90000}]}],
      laps:[{id:'l1',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:1,time:5000,date:'2026-01-01T10:00:00Z'},{id:'l2',sessionId:'s1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:2,time:6000,date:'2026-01-01T10:00:00Z'},
        {id:'t1',sessionId:'k1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:1,time:4000,date:'2026-02-01T10:00:00Z',token:true,stint:1,lane:2},
        {id:'t2',sessionId:'k1',driverId:'d1',carId:'c1',trackId:'t1',lapNumber:2,time:2000,date:'2026-02-01T10:00:00Z',token:true,stint:1,lane:2,late:true,invalid:true,noTrackRecord:true,noPersonalBest:true},
        {id:'t3',sessionId:'k2',driverId:'',carId:'c1',trackId:'t1',lapNumber:1,time:3000,date:'2026-02-01T11:00:00Z',token:true,stint:2,lane:1}] });
    run('folderClosed.clear()');
    const rr = mk(); await run('renderResultsPool')(rr, 'racing'), tr = mk(); await run('renderResultsPool')(tr, 'tokens');
    const rh = rr.innerHTML, th = tr.innerHTML, pt = (h, a, b) => h.split(a)[1].split(b)[0];
    say('Racing Records holds the raced sessions and laps only: the token laps are not in the records or the sessions', rh.includes('5.000') && !rh.includes('4.000') && !rh.includes('3.000') && !rh.includes('2.000') && rh.includes('<strong>Sessions</strong> <span class="muted">1 session</span>') && !rh.includes('Club night'));
    say('Token Records has the same three folders, but the sessions are called Stints', (th.match(/<details class="dbfolder"[^>]*>/g) || []).length === 3 && th.includes('<strong>Track records</strong>') && th.includes('<strong>Personal bests</strong>') && th.includes('<strong>Stints</strong> <span class="muted">2 stints</span>') && !th.includes('<strong>Sessions</strong>'));
    say('...each pool has its own folders to open and close (a different page key)', th.includes('data-folder="tresults:tracks"') && rh.includes('data-folder="results:tracks"') && !th.includes('data-folder="results:'));
    say('...the track record is the fastest valid token lap (a Guest can hold it), a late lap never counts', pt(th, 'Track records', 'Personal bests').includes('3.000') && pt(th, 'Track records', 'Personal bests').includes('Guest') && !pt(th, 'Track records', 'Personal bests').includes('2.000') && !pt(th, 'Track records', 'Personal bests').includes('5.000'));
    say('...personal bests are for drivers (a Guest has none), and not from the racing laps', th.includes('<strong>Personal bests</strong> <span class="muted">1 personal best</span>') && pt(th, 'Personal bests', 'Stints').includes('4.000') && !pt(th, 'Personal bests', 'Stints').includes('Guest') && !pt(th, 'Personal bests', 'Stints').includes('5.000'));
    say('...a stint shows its lane, driver, time bought and laps in its title', th.includes('Lane 2 · Alex · 10 min · 2 laps') && th.includes('Lane 1 · Guest · 1 min 30 s · 1 lap '));
    say('...and in its table: time bought, late laps, best lap; the time that came over and the time not used', th.includes('<th>Time bought</th>') && th.includes('<th>Late laps</th>') && th.includes('The time ran out') && th.includes('30 s came over from the driver before') && th.includes('20 s was not used'));
    say('...the late lap is struck through and says why', th.includes('<s class="lapbad" title="Late lap: driven after the time was up">2: 2.000</s>') && th.includes('1: 4.000'));
    say('...the stint has the same stand-out Export to PDF button', /class="btn primary pdfbtn" type="button" data-pdf="k1"/.test(th));
  say('...a stint can be exported and deleted', th.includes('data-pdf="k1"') && th.includes('data-delsession="k1"') && th.includes('Delete this stint'));
    // the page with its two tabs
    run("state.tab='database'; state.sub='results'; state.resultsSub='racing'"); await run('render()');
    say('Results and Records has two tabs, Racing Records first', E('respool').innerHTML.includes('Racing Records') && E('respool').innerHTML.includes('Token Records') && E('respool').innerHTML.indexOf('Racing Records') < E('respool').innerHTML.indexOf('Token Records') && E('resbody').innerHTML.includes('<strong>Sessions</strong>'));
    run("state.resultsSub='tokens'"); await run('render()');
    say('...and Token Records shows the other pool', E('resbody').innerHTML.includes('<strong>Stints</strong>') && !E('resbody').innerHTML.includes('<strong>Sessions</strong>'));
    store.sessions = store.sessions.filter(x => x.sessionType !== 'tokens'); const te = mk(); await run('renderResultsPool')(te, 'tokens');
    say('with no token results the page says where they come from', te.innerHTML.includes('No token results yet.') && !te.innerHTML.includes('dbfolder'));
    store.sessions = keep.sessions.filter(x => x.sessionType === 'tokens'); const re = mk(); await run('renderResultsPool')(re, 'racing');
    say('...and with only token results Racing Records is empty', re.innerHTML.includes('No results yet.') && !re.innerHTML.includes('dbfolder'));
    run("state.resultsSub='racing'"); Object.assign(store, keep); run('folderClosed.clear()'); }
  { // 1.9.0: the race setup form for an Endurance Race
    const F = run('state.schema.racesetups.fields'), isShown = run('isShown'), fld = k => F.find(f => f.key === k);
    const shown = (type, extra = {}) => F.filter(f => isShown(f, k => ({ sessionType: type, enduranceBy: 'time', swapMode: 'every', swapConfirm: 'both', swapEarly: 'allow', heatBy: 'laps', heatPlan: 'manual', resultBy: 'laps', trackcall: 'yellowred', ...extra })[k])).map(f => f.key);
    const swapKeys = F.filter(f => f.group === 'endurance').map(f => f.key), has = (list, ...keys) => keys.every(k => list.includes(k));
    say('the session types have the Endurance Race, between the heat-based race and the Time Token Session', fld('sessionType').options.map(o => o[0]).join() === 'practice,qualifying,race,timed,heats,endurance,tokens' && fld('sessionType').options.find(o => o[0] === 'endurance')[1] === 'Endurance Race');
    say('the folder Endurance: driver swaps is there, after Length and result, with 26 settings', run('state.schema.racesetups.groups.map(g => g.id).join()').startsWith('session,length,endurance,start') && run("state.schema.racesetups.groups.find(g => g.id === 'endurance').title") === 'Endurance: driver swaps' && swapKeys.length === 26);
    const e = shown('endurance');
    say('an Endurance Race asks the swaps in minutes or laps, when a swap is needed, the stints, the totals, the warning, how the swap is made, who steps in, the grace, what a late swap costs and what an early swap costs', has(e, 'swapUnit', 'swapMode', 'swapEvery', 'stintMin', 'stintMax', 'totalMin', 'totalMax', 'swapWarn', 'swapConfirm', 'swapSeconds', 'swapNext', 'swapGrace', 'swapLate', 'swapPenalty', 'swapRepeat', 'swapEarly', 'minPenalty') && !e.includes('swapMoments'));
    say('...none of the swap settings show for any other kind of session', ['practice', 'qualifying', 'race', 'timed', 'heats', 'tokens'].every(t => swapKeys.every(k => !shown(t).includes(k)) && !shown(t).includes('enduranceBy')));
    say('...a swap every so often asks the interval, fixed moments ask the list of moments, a free swap asks neither', has(shown('endurance', { swapMode: 'every' }), 'swapEvery') && !shown('endurance', { swapMode: 'every' }).includes('swapMoments') && has(shown('endurance', { swapMode: 'moments' }), 'swapMoments') && !shown('endurance', { swapMode: 'moments' }).includes('swapEvery') && !has(shown('endurance', { swapMode: 'free' }), 'swapEvery') && !shown('endurance', { swapMode: 'free' }).includes('swapMoments'));
    say('...the seconds on the pit sensor only when the sensor makes the swap (not when only the button does)', has(shown('endurance', { swapConfirm: 'both' }), 'swapSeconds') && has(shown('endurance', { swapConfirm: 'sensor' }), 'swapSeconds') && !shown('endurance', { swapConfirm: 'button' }).includes('swapSeconds'));
    say('...an Endurance Race by time asks the duration, by laps the number of laps, and neither asks the heat settings', has(shown('endurance', { enduranceBy: 'time' }), 'duration') && !shown('endurance', { enduranceBy: 'time' }).includes('laps') && has(shown('endurance', { enduranceBy: 'laps' }), 'laps') && !shown('endurance', { enduranceBy: 'laps' }).includes('duration') && ['time', 'laps'].every(b => ['heatPlan', 'heats', 'countBy', 'finals', 'breakSeconds', 'rotation', 'teamDriver'].every(k => !shown('endurance', { enduranceBy: b }).includes(k))));
    say('...a heat-based Endurance Race asks the heat settings (the plan, the heats, how they add up, the finals, the break, the rotation, the driver of the team) and the length of a heat', has(shown('endurance', { enduranceBy: 'heats' }), 'heatBy', 'heatPlan', 'heats', 'countBy', 'finals', 'breakSeconds', 'rotation', 'teamDriver') && has(shown('endurance', { enduranceBy: 'heats', heatBy: 'laps' }), 'laps') && has(shown('endurance', { enduranceBy: 'heats', heatBy: 'time' }), 'duration'));
    say('...all of them also ask the start, the penalties, the fuel and the screens, like every race', ['time', 'laps', 'heats'].every(b => has(shown('endurance', { enduranceBy: b }), 'lightsMin', 'penaltySystem', 'fuelRules', 'layout', 'audioSet')));
    say('...an early swap asks nothing more; the penalty for a driver who drove too little is a setting of its own, with a penalty system needed', fld('swapEarly').options.map(o => o[0]).join() === 'allow,penalty' && fld('minPenalty').default === 0 && /penalty system/.test(fld('minPenalty').hint) && /penalty system/.test(fld('swapEarly').hint) && /Penalty points for every driver who drove less/.test(fld('minPenalty').label));
    { const lt = run('limitText');
      say('the list of race setups shows how long an Endurance Race is: the minutes, the laps, or the heats (the laps or minutes of a heat)', lt({ sessionType: 'endurance', enduranceBy: 'time', duration: 120 }) === '120 min' && lt({ sessionType: 'endurance', enduranceBy: 'laps', laps: 300 }) === '300 laps' && lt({ sessionType: 'endurance', enduranceBy: 'laps', laps: 1 }) === '1 lap' && lt({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'laps', laps: 20 }) === '20 laps per heat' && lt({ sessionType: 'endurance', enduranceBy: 'heats', heatBy: 'time', duration: 30 }) === '30 min per heat');
      say('...with nothing filled in it shows nothing (and an older setup without the setting is by time)', lt({ sessionType: 'endurance', enduranceBy: 'laps', laps: '' }) === '' && lt({ sessionType: 'endurance', enduranceBy: 'time', duration: '' }) === '' && lt({ sessionType: 'endurance', laps: 5 }) === '' && lt({ sessionType: 'endurance', duration: 90 }) === '90 min'); }
    say('...every setting of the folder explains itself where the choice is not plain (the unit, when a swap is needed, the stints, the totals, the warning, the sensor, who steps in, the grace, the penalty, the repeat)', ['swapUnit', 'swapMode', 'swapMoments', 'stintMin', 'stintMax', 'totalMin', 'totalMax', 'swapWarn', 'swapSeconds', 'swapNext', 'swapGrace', 'swapPenalty', 'swapRepeat', 'swapEarly', 'minPenalty'].every(k => fld(k).hint && fld(k).hint.length > 40));
  }
  { // the race setup form for a Time Token Session
    const F = run('state.schema.racesetups.fields'), isShown = run('isShown');
    const shown = (type, extra = {}) => F.filter(f => isShown(f, k => ({ sessionType: type, heatBy: 'laps', heatPlan: 'manual', resultBy: 'laps', trackcall: 'yellowred', ...extra })[k])).map(f => f.key);
    const tok = shown('tokens'), race = shown('race');
    say('Session type has Time Token Session, and says where its settings are', run("state.schema.racesetups.fields.find(f=>f.key==='sessionType').options.map(o=>o.join(':')).join()").includes('tokens:Time Token Session') && /Race Setup > Time Tokens/.test(run("state.schema.racesetups.fields.find(f=>f.key==='sessionType').hint")));
    say('a Time Token Session asks for a name, track, layouts, audio set and the Trackmate settings, and nothing about lights, laps, fuel or penalties', tok.join() === 'name,sessionType,track,layout,layout2,audioSet,startPower,trackcall,trackcallWindow');
    { const b = F.filter(f => f.group === 'box'); // 1.37.0: the SlotForge box folder
      say('1.37.0: the SlotForge box folder has four settings with their defaults (what starts a pit stop, the lane power of a retired car, the beeps, the lane lights)', b.map(f => f.key + '=' + f.default).join() === 'boxPit=both,boxLanePower=retired,boxBeeps=yes,boxLaneLights=no' && b.every(f => f.type === 'select' && f.options.length >= 2 && f.options.some(o => o[0] === f.default)));
      say('...they are asked in every racing session (practice, qualifying, race, timed, heats, endurance) and not in a Time Token Session', ['practice', 'qualifying', 'race', 'timed', 'heats', 'endurance'].every(t => b.every(f => shown(t).includes(f.key))) && b.every(f => !tok.includes(f.key))); }
    say('...a race still asks for all of them', ['lightsMin', 'lightsMax', 'lightsAfter', 'restartAfterRed', 'firstLap', 'penaltySystem', 'fuelRules', 'pitHold', 'laps', 'endRule'].every(k => race.includes(k)) && !race.includes('heatBy'));
    say('...so do the other kinds of session (practice, qualifying, timed, heats)', ['practice', 'qualifying', 'timed', 'heats'].every(t => shown(t).includes('lightsMin') && shown(t).includes('penaltySystem')));
    say('1.10.0 the race setup asks for a Damage system in a race, a timed race, heats and an Endurance Race, but not in a practice or a qualifying (or a Time Token Session)', ['race', 'timed', 'heats', 'endurance'].every(t => shown(t).includes('damageSystem')) && ['practice', 'qualifying', 'tokens'].every(t => !shown(t).includes('damageSystem')));
    { const hs = (plan, extra) => shown('heats', { heatPlan: plan, ...extra }), has = (list, ...keys) => keys.every(k => list.includes(k));
      say('0.93.0: the heat plans are I choose, same number of heats, round robin and lane rotation', run("state.schema.racesetups.fields.find(f=>f.key==='heatPlan').options.map(o=>o[0]).join()") === 'manual,perdriver,roundrobin,rotation');
      say('...\"I choose\" asks how many heats and who races together; not the heats for every driver, nor the same number for everyone', has(hs('manual'), 'heats', 'heatSeeding') && !has(hs('manual'), 'heatsEach') && !has(hs('manual'), 'heatEven'));
      say('...\"same number of heats\" asks the heats for every driver and who races together', has(hs('perdriver'), 'heatsEach', 'heatSeeding') && !has(hs('perdriver'), 'heats') && !has(hs('perdriver'), 'heatEven'));
      say('...round robin asks only whether everyone gets the same number of heats', has(hs('roundrobin'), 'heatEven') && !has(hs('roundrobin'), 'heats') && !has(hs('roundrobin'), 'heatsEach') && !has(hs('roundrobin'), 'heatSeeding'));
      say('...lane rotation asks nothing more (the plan follows from the track)', !has(hs('rotation'), 'heats') && !has(hs('rotation'), 'heatsEach') && !has(hs('rotation'), 'heatEven') && !has(hs('rotation'), 'heatSeeding') && has(hs('rotation'), 'heatBy', 'heatPlan', 'resultBy'));
      say('...none of them shows for a race that is not a heat race', ['heats', 'heatsEach', 'heatEven', 'heatSeeding'].every(k => !shown('race').includes(k)));
      const fld = k => run(`state.schema.racesetups.fields.find(f=>f.key==='${k}')`);
      say('the new settings start as before: no seeding, no equalising, 3 heats for every driver', fld('heatEven').default === 'no' && fld('heatSeeding').default === 'random' && fld('heatsEach').default === 3 && fld('heatPlan').default === 'manual' && fld('heatEven').options.map(o => o[0]).join() === 'no,yes' && fld('heatSeeding').options.map(o => o[0]).join() === 'random,mixed,speed');
      say('...every one explains itself', ['heatPlan', 'heats', 'heatsEach', 'heatEven', 'heatSeeding'].every(k => fld(k).hint.length > 60)); }
    { const hs = extra => shown('heats', extra), has = (list, ...keys) => keys.every(k => list.includes(k)), fld = k => run(`state.schema.racesetups.fields.find(f=>f.key==='${k}')`);
      say('0.94.0: a heat race asks how the heats are added up, whether to drop the worst heat and what decides a tie', has(hs({}), 'countBy', 'dropWorst', 'tieBreak') && has(hs({ resultBy: 'points' }), 'countBy', 'dropWorst', 'tieBreak'));
      say('...\"heats that count\" only when only the best heats count', has(hs({ countBy: 'best' }), 'bestHeats') && !has(hs({ countBy: 'total' }), 'bestHeats') && !has(hs({ countBy: 'average' }), 'bestHeats') && !has(hs({}), 'bestHeats'));
      say('...the bonus for the fastest lap only when the result is counted by points', has(hs({ resultBy: 'points' }), 'fastestBonus') && !has(hs({ resultBy: 'laps' }), 'fastestBonus'));
      say('...none of them shows for a race that is not a heat race', ['countBy', 'bestHeats', 'dropWorst', 'fastestBonus', 'tieBreak'].every(k => !shown('race').includes(k) && !shown('race', { countBy: 'best', resultBy: 'points' }).includes(k)));
      say('the new settings start as before: all heats added up, nothing dropped, no bonus, the standard tie-breaker, 2 best heats', fld('countBy').default === 'total' && fld('dropWorst').default === 'no' && fld('fastestBonus').default === 0 && fld('tieBreak').default === 'default' && fld('bestHeats').default === 2);
      say('...and offer what the Help names', fld('countBy').options.map(o => o[0]).join() === 'total,average,best' && fld('dropWorst').options.map(o => o[0]).join() === 'no,yes' && fld('tieBreak').options.map(o => o[0]).join() === 'default,bestlap,wins,time');
      say('...every one explains itself', ['countBy', 'bestHeats', 'dropWorst', 'fastestBonus', 'tieBreak'].every(k => fld(k).hint.length > 60)); }
    { const hs = extra => shown('heats', extra), fld = k => run(`state.schema.racesetups.fields.find(f=>f.key==='${k}')`);
      say('0.95.0: a heat race asks for a break between heats and what happens when it is over; no other kind of session does', ['breakSeconds', 'breakAuto'].every(k => hs({}).includes(k) && hs({ resultBy: 'points', heatPlan: 'rotation' }).includes(k) && !shown('race').includes(k) && !shown('practice').includes(k) && !shown('tokens').includes(k)));
      say('...no break and waiting for Start is the standard, as before', fld('breakSeconds').default === 0 && fld('breakSeconds').min === 0 && fld('breakAuto').default === 'no' && fld('breakAuto').options.map(o => o[0]).join() === 'no,yes' && fld('breakSeconds').group === 'length' && fld('breakAuto').group === 'length');
      say('...and both explain themselves', fld('breakSeconds').hint.length > 60 && fld('breakAuto').hint.length > 60); }
    { const hs = extra => shown('heats', extra), fld = k => run(`state.schema.racesetups.fields.find(f=>f.key==='${k}')`);
      say('0.96.0: a heat race asks whether there are finals; no other kind of session does', hs({}).includes('finals') && !shown('race').includes('finals') && !shown('practice').includes('finals') && !shown('tokens').includes('finals'));
      say('...what the finals decide and the length of a final only when there are finals', !hs({}).includes('finalMode') && !hs({ finals: 'none' }).includes('finalMode') && hs({ finals: 'a' }).includes('finalMode') && hs({ finals: 'ab' }).includes('finalMode') && !hs({}).includes('finalLaps') && !hs({ finals: 'none', heatBy: 'laps' }).includes('finalLaps'));
      say('...the length in laps for a race by laps, in minutes for a race by time', hs({ finals: 'a', heatBy: 'laps' }).includes('finalLaps') && !hs({ finals: 'a', heatBy: 'laps' }).includes('finalDuration') && hs({ finals: 'ab', heatBy: 'time' }).includes('finalDuration') && !hs({ finals: 'ab', heatBy: 'time' }).includes('finalLaps'));
      say('...the standard is no finals, the finals decide the places, and a final is as long as a heat (0)', fld('finals').default === 'none' && fld('finalMode').default === 'places' && fld('finalLaps').default === 0 && fld('finalDuration').default === 0 && fld('finalLaps').min === 0 && fld('finalDuration').min === 0);
      say('...and offer what the Help names', fld('finals').options.map(o => o[0]).join() === 'none,a,ab' && fld('finalMode').options.map(o => o[0]).join() === 'places,added' && ['finals', 'finalMode', 'finalLaps', 'finalDuration'].every(k => fld(k).group === 'length' && fld(k).hint.length > 40)); }
  }
  { // starting a Time Token Session from the Home tab: drivers and cars are optional
    const keep = { racesetups: store.racesetups, tracks: store.tracks, last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments') };
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 2 }]; store.racesetups = [{ id: 'k1', name: 'Club night', sessionType: 'tokens', track: 't1' }];
    run("state.settings.lastSetupId = 'k1'; state.settings.assignments = {}; state.tab = 'home'"); await run('render()');
    const hh = E('view').innerHTML;
    say('a Time Token Session can be started with no drivers and cars: the lanes say Guest and (no car), nothing is reported missing', hh.includes('Guest (no driver)') && hh.includes('(no car)') && !hh.includes('class="issues"') && !hh.includes('needs a driver') && /<button class="btn primary big" id="start" >/.test(hh) );
    say('...the button says Open the session, and a line explains how time is added', hh.includes('Open the session') && !hh.includes('>Start race<') && hh.includes('A Time Token Session starts with every lane switched off'));
    store.racesetups = [{ id: 'k2', name: 'Friday', sessionType: 'race', track: 't1', laps: 5 }]; run("state.settings.lastSetupId = 'k2'"); await run('render()');
    say('a normal race still needs a driver and a car on every lane', E('view').innerHTML.includes('needs a driver and a car') && E('view').innerHTML.includes('>Start race<'));
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks }); run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}`); }
  { // 1.17.0: the Home tab: the welcome band, coloured lanes, start lights and the cards on the right
    const keep = { racesetups: store.racesetups, tracks: store.tracks, drivers: store.drivers, slotcars: store.slotcars, sessions: store.sessions, laps: store.laps, layouts: store.layouts, audiosets: store.audiosets, last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), net: run('state.settings.netOn') };
    const home = async () => { run("state.tab = 'home'"); await run('render()'); await new Promise(r => setTimeout(r, 10)); return E('view').innerHTML; }, side = () => ['record', 'last', 'glance'].map(k => E('hmc-' + k).innerHTML).join(''); // (the three cards of the usual Home are drawn into their own cells, which the test page keeps apart)
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 3, length: 10, scale: '1:32', laneModifier: 'none' }, { id: 't2', name: 'Garage', lanes: 2, length: 25, laneModifier: 'none' }];
    store.drivers = [{ id: 'd1', name: 'Dutch' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Mila' }]; store.slotcars = [{ id: 'c1', brand: 'Porsche', model: '917' }, { id: 'c2', brand: 'Ford', model: 'GT40' }];
    store.layouts = [{ id: 'ly1', name: 'Club', laneColors: [{ bg: '#112233' }, {}, { bg: 'red;x' }] }]; store.audiosets = [{ id: 'au1', name: 'Announcer' }];
    store.racesetups = [{ id: 'k1', name: 'Club race', sessionType: 'race', track: 't1', laps: 20, layout: 'ly1', audioSet: 'au1' }, { id: 'k2', name: 'Quiet race', sessionType: 'race', track: 't1', laps: 5 }];
    store.sessions = []; store.laps = [];
    run("state.settings.lastSetupId = 'k1'; state.settings.netOn = false; state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }, { driverId: 'd3', carId: '' }] }");
    let hh = await home();
    say('1.17.0: the Home tab has a welcome band with the welcome message, the date and the track', hh.includes('class="hm-band"') && /<h2>Welcome to the SlotForge/.test(hh) && /class="hm-sub">[^<]* · Living room</.test(hh));
    say('...the chips: Trackmate, the network, the audio set of the setup and the counts of the database', hh.includes('data-key="tm" data-state="warn"><i aria-hidden="true"></i>Trackmate not connected') && hh.includes('Not shared on the network') && hh.includes('Audio: Announcer') && hh.includes('3 drivers · 2 slotcars · 2 tracks'));
    say('...a lane has the colour that its layout gives it on the race screen, else one of the eight colours (and never colour text that is not a colour)', hh.includes('data-row="0" style="--c:#112233"') && hh.includes('data-row="1" style="--c:' + run('HomeStats.PALETTE[1]') + '"') && hh.includes('data-row="2" style="--c:' + run('HomeStats.PALETTE[2]') + '"') && !hh.includes('red;x'));
    say('...the start lights: one for every lane, lit when the lane has its driver and car, with the words', (hh.match(/<i class="on" style="--c:/g) || []).length === 2 && (hh.match(/<i style="--c:/g) || []).length === 1 && hh.includes('2 of 3 lanes are ready.'));
    say('...the Start button is the big one, and still disabled while a lane is not ready', /<button class="btn primary big" id="start" disabled>/.test(hh) && hh.includes('Lane 3 needs a driver and a car.'));
    run("state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }, { driverId: 'd3', carId: 'c1' }] }"); hh = await home();
    say('...every lane filled in but a car on two lanes: all the lights are lit, they say "filled in" (not ready), and the button stays off', (hh.match(/<i class="on" style="--c:/g) || []).length === 3 && hh.includes('All 3 lanes are filled in.') && !hh.includes('are ready.') && hh.includes('A car is used more than once.') && /id="start" disabled/.test(hh));
    store.slotcars.push({ id: 'c3', brand: 'Lola', model: 'T70' }); run("state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }, { driverId: 'd3', carId: 'c3' }] }"); hh = await home();
    say('...with every lane ready and nothing else wrong all the lights are lit, they say ready, and the Start button works', (hh.match(/<i class="on" style="--c:/g) || []).length === 3 && hh.includes('All 3 lanes are ready.') && !hh.includes('class="issues"') && /<button class="btn primary big" id="start" >/.test(hh));
    store.slotcars.pop();
    run("state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }] }"); hh = await home();
    say('...no audio set: the chip says No audio', (run("state.settings.lastSetupId = 'k2'"), true) && (await home()).includes('No audio'));
    run("state.settings.lastSetupId = 'k1'");
    // the cards on the right
    await home(); say('with nothing raced the right side says what will show up there', side().includes('class="card hm-empty"') && !side().includes('Record to beat') && !side().includes('hm-glance'));
    const lapRow = (time, extra) => ({ id: 'L' + Math.random(), sessionId: 'S1', trackId: 't1', driverId: 'd2', carId: 'c2', lane: 1, time, lapNumber: 1, date: '2026-10-10T18:00:00.000Z', ...extra });
    store.sessions = [{ id: 'S0', setupName: 'Old race', sessionType: 'race', trackId: 't1', trackName: 'Living room', date: '2026-09-12T18:00:00.000Z', standings: [{ pos: 1, driverId: 'd1', driverName: 'Dutch', carId: 'c1', laps: 10, best: 5100 }] },
      { id: 'S1', setupName: 'Club race', sessionType: 'race', trackId: 't1', trackName: 'Living room', date: '2026-10-10T18:00:00.000Z', standings: [{ pos: 1, driverId: 'd2', driverName: 'Sam', carId: 'c2', laps: 20, best: 4861 }, { pos: 2, driverId: 'd1', driverName: 'Dutch', carId: 'c1', laps: 20, best: 4955 }, { pos: 3, driverId: 'd3', driverName: 'Mila', carId: 'c1', laps: 19, best: 5200 }] }];
    store.laps = [lapRow(4861), lapRow(4955, { driverId: 'd1', carId: 'c1' }), lapRow(5200, { driverId: 'd3', carId: 'c1' }), lapRow(5100, { sessionId: 'S0', driverId: 'd1', carId: 'c1', date: '2026-09-12T18:00:00.000Z' }), lapRow(4000, { trackId: 't2', sessionId: 'S2' }), lapRow(3500, { driverId: 'd3', invalid: true, noTrackRecord: true, noPersonalBest: true })];
    hh = await home(); const sd = side();
    say('the record to beat: the fastest lap on the track of the setup, with the driver and the car, and who on the grid is closest', sd.includes('class="card hm-rec"') && sd.includes('<div class="hm-time">4.861</div>') && sd.includes('<strong>Sam</strong> · Ford GT40') && sd.includes('Sam is on the grid and holds the record.'));
    say('...a lap that is invalid, or of another track, is not the record; the card says whose track it is', !sd.includes('3.500') && !sd.includes('>4.000<') && sd.includes('<span class="hm-tag">Living room</span>'));
    say('the last race: the podium in the order of the places, the race, the track and the fastest lap', sd.includes('class="card hm-last"') && /<li class="p1"><span class="n">1<\/span><strong>Sam<\/strong><small>20 laps<\/small><\/li><li class="p2"><span class="n">2<\/span><strong>Dutch<\/strong>/.test(sd) && sd.includes('<li class="p3"><span class="n">3</span><strong>Mila</strong><small>19 laps</small>') && sd.includes('Club race on Living room · Fastest lap: Sam, 4.861'));
    say('at a glance: races, laps, distance and who won most', sd.includes('<div class="v">2</div><div class="l">races raced</div>') && sd.includes('<div class="v">5</div><div class="l">laps driven</div>') && sd.includes('<div class="v">65 m</div>') && />Sam<\/div><div class="l">most wins \(1\)/.test(sd));
    { run("state.settings.distanceUnit='ft'"); await home(); const sf = side(); run("delete state.settings.distanceUnit"); await home();
      say('1.27.0: with the distance unit feet and miles the glance card shows the distance in feet (65 m is 213 ft), and the other tiles stay as they are', sf.includes('<div class="v">213 ft</div>') && !sf.includes('<div class="v">65 m</div>') && sf.includes('<div class="v">5</div><div class="l">laps driven</div>') && side().includes('<div class="v">65 m</div>')); }
    say('...a track that has no lap yet says so, and the first lap sets the record', (run("state.settings.lastSetupId = 'k1'"), store.tracks[0].id = 'tX', store.racesetups[0].track = 'tX', (await home(), side().includes('No lap has been saved on this track yet.'))));
    store.tracks[0].id = 't1'; store.racesetups[0].track = 't1';
    // the laps are fetched once while you stay on Home, and again when Home is shown again
    let fetched = 0; const realList = api.list; api.list = async e => { if (e === 'laps') fetched++; return realList(e); };
    await home(); const first = fetched;
    await E('view').onchange({ target: { id: 'setup', value: 'k2' } }); await new Promise(r => setTimeout(r, 20)); await E('view').onchange({ target: { id: 'setup', value: 'k1' } }); await new Promise(r => setTimeout(r, 20));
    say('the laps are fetched once while you stay on the Home tab (a change of setup does not fetch them again), and again when Home is shown again', first === 1 && fetched === 1 && (await home(), fetched === 2));
    api.list = realList;
    // the Trackmate chip follows the connection, while Home is open
    await home(); run('Trackmate.link.setConnected(true)');
    say('the Trackmate chip lights up when the Trackmate is connected, and goes dark when it is not', E('hm-chips').innerHTML.includes('data-state="on"><i aria-hidden="true"></i>Trackmate connected') && (run('Trackmate.link.setConnected(false)'), E('hm-chips').innerHTML.includes('Trackmate not connected')));
    // 1.39.0: the chip is the timing hardware that was CHOSEN (App Settings, Timing Hardware): green when connected, red when chosen and not connected, dim when none is chosen
    const chipAfter = async patch => { run(`(p => Object.keys(p).forEach(k => { if (p[k] === null) delete state.settings[k]; else state.settings[k] = p[k]; }))(${JSON.stringify(patch)})`); const h = await home(); return h.match(/data-key="tm"[^>]*>(?:<i[^>]*><\/i>)?[^<]*/)[0].replace(/<i[^>]*><\/i>/, '|').replace(/data-key="tm" /, ''); };
    say('1.39.0: the Trackmate chosen (also when nothing was chosen yet): red and "not connected" until it is connected', (await chipAfter({ timingHw: 'trackmate' })) === 'data-state="warn">|Trackmate not connected' && (await chipAfter({ timingHw: null })) === 'data-state="warn">|Trackmate not connected');
    run('Trackmate.link.setConnected(true)'); say('...green when it is connected, and it follows the connection while Home is open', E('hm-chips').innerHTML.includes('data-state="on"><i aria-hidden="true"></i>Trackmate connected') && (run('Trackmate.link.setConnected(false)'), E('hm-chips').innerHTML.includes('data-state="warn"><i aria-hidden="true"></i>Trackmate not connected')));
    say('...the virtual box ticked is the Arduino box in use (nothing chosen yet): "Virtual Arduino box not connected", red', (await chipAfter({ abVirtual: true })) === 'data-state="warn">|Virtual Arduino box not connected');
    run('ArduinoBox.link.setConnected(true)');
    say('...it turns green when the virtual box connects while Home is open', E('hm-chips').innerHTML.includes('data-state="on"><i aria-hidden="true"></i>Virtual Arduino box connected'));
    run('Trackmate.link.setConnected(true)');
    say('...one at a time: the Trackmate being connected as well changes nothing while the box is the one in use', !E('hm-chips').innerHTML.includes('Trackmate') );
    run('Trackmate.link.setConnected(false); ArduinoBox.link.setConnected(false)');
    say('...and it turns red again when the box goes away', E('hm-chips').innerHTML.includes('data-state="warn"><i aria-hidden="true"></i>Virtual Arduino box not connected'));
    say('...a remembered real box is "Arduino box"', (await chipAfter({ abVirtual: false, abDevice: { vid: 9025, pid: 67 } })) === 'data-state="warn">|Arduino box not connected');
    say('...a choice made beats what was set up: the Trackmate chosen with the virtual box ticked is the Trackmate', (await chipAfter({ abVirtual: true, timingHw: 'trackmate' })) === 'data-state="warn">|Trackmate not connected');
    say('...none chosen: "No timing hardware chosen", dim, and not red even though a box is ticked', (await chipAfter({ timingHw: 'none' })) === 'data-state="off">|No timing hardware chosen');
    run('delete state.settings.abVirtual; delete state.settings.abDevice; delete state.settings.timingHw');
    // a network that was switched on but could not start
    run('state.settings.netOn = true'); api.netStatus = async () => ({ on: false, port: 0, error: 'Port 8787 is already in use. Choose another port.', passwordSet: false, urls: [] }); await home();
    say('a network that is switched on but could not start gets a red light', E('hm-chips').innerHTML.includes('data-state="warn"><i aria-hidden="true"></i>Network sharing could not start'));
    api.netStatus = async () => ({ on: true, port: 8787, error: '', passwordSet: false, urls: [] }); await home();
    say('...and one that runs is lit', E('view').innerHTML.includes('data-state="on"><i aria-hidden="true"></i>Shared on the network'));
    delete api.netStatus;
    // a Time Token Session: nothing is needed, so every light is lit; only token sessions raced: the right side is still empty
    store.racesetups = [{ id: 'kt', name: 'Club night', sessionType: 'tokens', track: 't1' }]; store.sessions = [{ id: 'T1', setupName: 'Club night', sessionType: 'tokens', date: '2026-10-11T18:00:00.000Z', standings: [] }]; store.laps = [lapRow(3000, { token: true })]; run("state.settings.lastSetupId = 'kt'; state.settings.assignments = {}");
    hh = await home();
    say('a Time Token Session has every light lit, and its sessions never show on Home as a race', (hh.match(/<i class="on" style="--c:/g) || []).length === 3 && hh.includes('All 3 lanes are ready.') && side().includes('class="card hm-empty"') && !side().includes('Record to beat'));
    { const keepConfirm = ctx.confirm, asked = []; ctx.confirm = m => { asked.push(m); return false; }; run("Trackmate.link.setConnected(false); state.settings.timingHw = 'trackmate'; state.race = null");
      await E('view').onclick({ target: { closest: () => ({ id: 'start', dataset: {} }) } }); await new Promise(r => setTimeout(r, 20));
      say('1.39.0: a Time Token Session does not count laps from the hardware, so Open the session does not ask about it', asked.length === 0 && !!run('state.race'));
      ctx.confirm = keepConfirm; run("delete state.settings.timingHw; state.race = null; state.tab = 'home'"); }
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, drivers: keep.drivers, slotcars: keep.slotcars, sessions: keep.sessions, laps: keep.laps, layouts: keep.layouts, audiosets: keep.audiosets }); run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; state.settings.netOn = ${JSON.stringify(!!keep.net)}`); }
  { // 1.25.0: the cards of Home in a grid: Customize (set up like the Leaderboard grid), the seven new cards, the races that open in Results and the shortcuts
    const keep = { racesetups: store.racesetups, tracks: store.tracks, drivers: store.drivers, slotcars: store.slotcars, sessions: store.sessions, laps: store.laps, layouts: store.layouts, audiosets: store.audiosets, pen: store.penaltysystems, fuel: store.fuelrules,
      last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), grid: run('state.settings.homeGrid'), custom: run('state.homeCustom') };
    const savedCalls = [], realSet = api.setSettings; api.setSettings = async p => { savedCalls.push(p); return { ...run('state.settings'), ...p }; }; // (the stand-in of the window gives back only what was saved; here the whole settings have to come back)
    const home = async () => { run("state.tab = 'home'"); await run('render()'); await new Promise(r => setTimeout(r, 10)); return E('view').innerHTML; };
    const click = async dataset => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: dataset.id || '', dataset } : null) } }); await new Promise(r => setTimeout(r, 15)); return E('view').innerHTML; };
    const change = async (dataset, value, type) => { await E('view').onchange({ target: { dataset, value, type: type || 'select-one', checked: value === true } }); await new Promise(r => setTimeout(r, 15)); return E('view').innerHTML; };
    const gridNow = () => run('JSON.stringify(HomeGrid.gridOf(state.settings))'), spots = () => JSON.parse(gridNow()).boards.map(b => `${b.opt.card}@${b.c}.${b.r}:${b.w}x${b.h}`).join(' ');
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 3, length: 10, scale: '1:32', laneModifier: 'none' }, { id: 't2', name: 'Garage', lanes: 2, length: 25, laneModifier: 'none' }];
    store.drivers = [{ id: 'd1', name: 'Dutch' }, { id: 'd2', name: 'Sam' }, { id: 'd3', name: 'Mila' }]; store.slotcars = [{ id: 'c1', brand: 'Porsche', model: '917' }, { id: 'c2', brand: 'Ford', model: 'GT40' }, { id: 'c3', brand: 'Lola', model: 'T70' }];
    store.layouts = []; store.audiosets = []; store.penaltysystems = [{ id: 'p1', name: 'Club penalties' }]; store.fuelrules = [{ id: 'f1', name: 'Sprint fuel' }];
    store.racesetups = [{ id: 'k1', name: 'Club race', sessionType: 'race', track: 't1', laps: 20, penaltySystem: 'p1', fuelRules: 'f1' }]; store.sessions = []; store.laps = [];
    run("state.settings.lastSetupId = 'k1'; state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }, { driverId: 'd3', carId: 'c3' }] }; delete state.settings.homeGrid; state.homeCustom = { open: false, sel: 0 }");
    let hh = await home();
    say('1.25.0: Home is a grid of cards; to begin with it is the Home of before: Start a race over two columns and three rows, and the record, the last race and the totals in the third column',
      hh.includes('<div class="hm-grid" id="homegrid" style="grid-template-columns:repeat(3,minmax(0,1fr))">') && hh.includes('<section class="card hm-start" id="hmc-start" style="grid-column:1 / span 2;grid-row:1 / span 3"><h3>Start a race</h3>') && hh.includes('id="hmc-record" data-card="record" style="grid-column:3 / span 1;grid-row:1 / span 1"') && hh.includes('id="hmc-last" data-card="last" style="grid-column:3 / span 1;grid-row:2 / span 1"') && hh.includes('id="hmc-glance" data-card="glance" style="grid-column:3 / span 1;grid-row:3 / span 1"') && !hh.includes('id="hmc-recent"'));
    say('...the band has a Customize button (closed), and the panel is not there', hh.includes('id="hmcustom" aria-expanded="false"') && !hh.includes('id="hm-customize"') && !hh.includes('hm-cols') && !hh.includes('homeside'));
    hh = await click({ id: 'hmcustom' });
    say('Customize opens a panel like the one of the Leaderboard page: the little squares of the grid (6 by 4, nine lit), the size in words and a card for every cell', hh.includes('id="hm-customize"') && hh.includes('id="hmcustom" aria-expanded="true"') && (hh.match(/class="lv-gp/g) || []).length === 24 && (hh.match(/class="lv-gp on"/g) || []).length === 9 && hh.includes('<output id="hg-gridsize">3 columns × 3 rows</output>') && hh.includes('aria-label="3 columns by 2 rows"'));
    say('...Start a race is in its cell as a fixed card (no choice), the other cards have a list of cards and a button for their settings, and no cell is empty', hh.includes('<span class="hm-fixed">Start a race <small>(always on Home)</small></span>') && (hh.match(/data-hcell="/g) || []).length === 3 && !hh.includes('data-hadd=') && hh.includes('data-hsel="3" aria-pressed="false">Card 4 settings') && hh.includes('data-hsel="0" aria-pressed="true">Card 1 settings'));
    say('...the settings of the first card show: it covers 2 columns and 3 rows at most, and Start a race has no other settings; "Back to the usual Home" is off while Home is the usual one', hh.includes('<legend>Card 1: Start a race (column 1, row 1)</legend>') && /id="hg-w" data-hspan="w"><option value="1">1<\/option><option value="2" selected>2<\/option><\/select>/.test(hh) && /id="hg-h" data-hspan="h"><option value="1">1<\/option><option value="2">2<\/option><option value="3" selected>3<\/option>/.test(hh) && !hh.includes('data-hopt=') && hh.includes('id="hmdefault" disabled'));
    say('...the list of a cell has the cards that are not on Home yet and the card of the cell, not Start a race', (() => { const sel = hh.split('data-hcell="1"')[1].split('</select>')[0]; return sel.includes('<option value="record" selected>Record to beat</option>') && sel.includes('value="recent"') && sel.includes('value="shortcuts"') && !sel.includes('value="last"') && !sel.includes('value="start"') && sel.includes('<option value="">(empty)</option>'); })());
    hh = await click({ hgrid: '4,2' });
    say('a square of the grid picker makes the grid 4 columns by 2 rows: Start a race is cut back to the grid, the card in the row that is gone is gone, and the saved grid is the grid that holds together', spots() === 'start@1.1:2x2 record@3.1:1x1 last@3.2:1x1' && JSON.stringify(savedCalls[savedCalls.length - 1].homeGrid) === gridNow() && hh.includes('repeat(4,minmax(0,1fr))') && hh.includes('<output id="hg-gridsize">4 columns × 2 rows</output>') && hh.includes('id="hm-customize"') && !hh.includes('id="hmc-glance"'));
    say('...the cells that are empty now have a list of their own, with every card that is not on Home; Customize stays open and "Back to the usual Home" is on', hh.includes('data-hadd="4,1"') && hh.includes('data-hadd="4,2"') && hh.split('data-hadd="4,1"')[1].split('</select>')[0].includes('value="glance"') && !hh.split('data-hadd="4,1"')[1].split('</select>')[0].includes('value="record"') && !/id="hmdefault" disabled/.test(hh));
    hh = await change({ hadd: '4,1' }, 'recent');
    say('a card for an empty cell puts it there, and its settings show: Recent races has "How many races", 5 to begin with', spots() === 'start@1.1:2x2 record@3.1:1x1 recent@4.1:1x1 last@3.2:1x1' && hh.includes('<legend>Card 3: Recent races (column 4, row 1)</legend>') && /id="hg-count" data-hopt="count">[^]*<option value="5" selected>5<\/option>/.test(hh) && hh.includes('id="hmc-recent" data-card="recent" style="grid-column:4 / span 1;grid-row:1 / span 1"'));
    hh = await change({ hopt: 'count' }, '8');
    say('...an option of the card is saved with the card (8 races)', JSON.parse(gridNow()).boards[2].opt.count === '8' && /<option value="8" selected>8<\/option>/.test(hh));
    hh = await change({ hadd: '4,2' }, 'shortcuts');
    say('a Shortcuts card has a tick for every page; the ones that are on to begin with are ticked', hh.includes('<legend>Card 5: Shortcuts (column 4, row 2)</legend>') && (hh.match(/type="checkbox" data-hopt="go_/g) || []).length === 11 && hh.includes('id="hg-go_help" type="checkbox" data-hopt="go_help" checked') && !/id="hg-go_rules" type="checkbox" data-hopt="go_rules" checked/.test(hh));
    hh = await change({ hopt: 'go_rules' }, true, 'checkbox'); await change({ hopt: 'go_help' }, false, 'checkbox');
    say('...a tick is saved with the card', JSON.parse(gridNow()).boards[4].opt.go_rules === true && JSON.parse(gridNow()).boards[4].opt.go_help === false && run('HomeGrid.shortcutsOf(HomeGrid.gridOf(state.settings).boards[4]).map(s => s.key).join()') === 'results,drivers,slotcars,tracks,setup,rules');
    hh = await click({ hsel: '0' }); hh = await change({ hspan: 'w' }, '1');
    say('Start a race can be made narrower like any card (1 column); the cell next to it is then empty', spots().startsWith('start@1.1:1x2') && hh.includes('data-hadd="2,1"') && hh.includes('<section class="card hm-start" id="hmc-start" style="grid-column:1 / span 1;grid-row:1 / span 2">'));
    hh = await change({ hspan: 'w' }, '2');
    hh = await change({ hcell: '1' }, '');
    say('"(empty)" for a card takes it away: the cell is empty, the other cards stay', !spots().includes('record') && spots() === 'start@1.1:2x2 recent@4.1:1x1 last@3.2:1x1 shortcuts@4.2:1x1' && hh.includes('data-hadd="3,1"'));
    hh = await change({ hcell: '1' }, 'last');
    say('...a card that is on Home already cannot be chosen for another cell (the list does not offer it, and a request for it changes nothing)', spots().includes('recent@4.1') && !hh.split('data-hadd="3,1"')[1].split('</select>')[0].includes('value="recent"') && (await change({ hadd: '3,1' }, 'last'), spots().split('last').length === 2));
    await click({ id: 'hmdefault' });
    say('"Back to the usual Home" puts the Home of before back (the saved grid is gone), and the button is off again', savedCalls[savedCalls.length - 1].homeGrid === null && spots() === 'start@1.1:2x3 record@3.1:1x1 last@3.2:1x1 glance@3.3:1x1' && E('view').innerHTML.includes('id="hmdefault" disabled'));

    // the cards, with a grid of all eleven
    const ALL = { cols: 4, rows: 3, boards: [['start', 1, 1, 2, 1], ['record', 3, 1], ['last', 4, 1], ['glance', 1, 2], ['recent', 2, 2], ['fastest', 3, 2], ['records', 4, 2], ['top', 1, 3], ['bests', 2, 3], ['rules', 3, 3], ['shortcuts', 4, 3]].map(([card, c, r, w = 1, h = 1]) => ({ c, r, w, h, opt: { card } })) };
    run(`state.settings.homeGrid = ${JSON.stringify(ALL)}; state.homeCustom = { open: false, sel: 0 }`);
    hh = await home(); const cell = k => E('hmc-' + k).innerHTML;
    say('a Home with all the cards and nothing raced yet: the first card that needs races says what will show up and the others that need races are empty; the rules and the shortcuts are there', cell('record').includes('class="card hm-empty"') && ['last', 'glance', 'recent', 'fastest', 'records', 'top', 'bests'].every(k => cell(k) === '') && cell('rules').includes('class="card hm-rules"') && cell('shortcuts').includes('class="card hm-shortcuts"'));
    say('...the rules of the race setup: the kind, the laps, the penalty system and the fuel setup by name, and what it has not is Off', cell('rules').includes('<span class="hm-tag">Club race</span>') && cell('rules').includes('<span class="muted">Length</span><strong>20 laps</strong>') && cell('rules').includes('<strong>Club penalties</strong>') && cell('rules').includes('<strong>Sprint fuel</strong>') && /<span class="muted">Weather<\/span><strong>Off<\/strong>/.test(cell('rules')));
    const now = new Date(), nowIso = now.toISOString(), lastYear = new Date(now.getFullYear() - 1, 5, 1).toISOString(), lapRow = (time, extra) => ({ id: 'L' + Math.random(), sessionId: 'S1', trackId: 't1', driverId: 'd2', carId: 'c2', lane: 1, time, lapNumber: 1, date: nowIso, ...extra });
    store.sessions = [{ id: 'S0', setupName: 'Old race', sessionType: 'race', trackId: 't1', trackName: 'Living room', date: lastYear, standings: [{ pos: 1, driverId: 'd1', driverName: 'Dutch', carId: 'c1', laps: 10, best: 5100 }] },
      { id: 'S1', setupName: 'Club race', sessionType: 'race', trackId: 't1', trackName: 'Living room', date: nowIso, standings: [{ pos: 1, driverId: 'd2', driverName: 'Sam', carId: 'c2', laps: 20, best: 4861 }, { pos: 2, driverId: 'd1', driverName: 'Dutch', carId: 'c1', laps: 20, best: 4955 }, { pos: 3, driverId: 'd3', driverName: 'Mila', carId: 'c3', laps: 19, best: 5200 }] }];
    store.laps = [lapRow(4861), lapRow(4955, { driverId: 'd1', carId: 'c1' }), lapRow(5200, { driverId: 'd3', carId: 'c3' }), lapRow(5100, { sessionId: 'S0', driverId: 'd1', carId: 'c1', date: lastYear }), lapRow(7000, { trackId: 't2', driverId: 'd3', sessionId: 'S2' })];
    hh = await home();
    say('with races the seven cards show their figures: recent races (the newest first, each a button with its session)', cell('recent').includes('class="card hm-recent"') && cell('recent').includes('data-session="S1"') && cell('recent').indexOf('data-session="S1"') < cell('recent').indexOf('data-session="S0"') && cell('recent').includes('Sam won') && cell('recent').includes('Dutch won'));
    say('...fastest laps this week on the track of the setup (the old lap of last year is not there)', cell('fastest').includes('<span class="hm-tag">Living room</span>') && cell('fastest').includes('<span class="w">Sam</span><strong>4.861</strong>') && cell('fastest').indexOf('Sam') < cell('fastest').indexOf('Dutch') && !cell('fastest').includes('5.100'));
    say('...records on all tracks (a row for each track, A to Z), and top drivers (only the wins of this year count: Sam, not Dutch who won last year)', cell('records').includes('<strong>Garage</strong>') && cell('records').indexOf('Garage') < cell('records').indexOf('Living room') && cell('records').includes('7.000') && cell('records').includes('4.861') && cell('top').includes('<span class="hm-tag">wins this year</span>') && cell('top').includes('<span class="w">Sam</span>') && !cell('top').includes('Dutch'));
    say('...the personal bests of the drivers in the lanes, in the order of the lanes, with the colour of the lane', cell('bests').includes('class="card hm-bests"') && cell('bests').indexOf('Dutch') < cell('bests').indexOf('Sam') && cell('bests').indexOf('Sam') < cell('bests').indexOf('Mila') && cell('bests').includes('4.955') && cell('bests').includes('4.861') && cell('bests').includes('5.200') && cell('bests').includes('<i class="hm-dot" style="--c:' + run('HomeStats.PALETTE[0]') + '"></i>Dutch'));
    say('...and the three of before are the cards they were', cell('record').includes('<div class="hm-time">4.861</div>') && cell('last').includes('<li class="p1"><span class="n">1</span><strong>Sam</strong>') && cell('glance').includes('races raced'));
    // a race that is clicked opens in Results
    run("folderClosed.add('results:sessions')"); await click({ session: 'S1' });
    say('a race on Home opens in Results and Records: the page of the results, its folder of sessions open, the card of that race there (and Home forgets the choice)', run('state.tab') === 'database' && run('state.sub') === 'results' && run('state.resultsSub') === 'racing' && run('state.focusSession') === null && E('resbody').innerHTML.includes('<details class="card sess" data-sid="S1">') && !run("folderClosed.has('results:sessions')") && /data-folder="results:sessions" open>/.test(E('resbody').innerHTML));
    // the shortcuts
    hh = await home(); const nOpen = opened.length;
    await click({ go: 'drivers' }); say('a shortcut goes to its page: Drivers is the Database tab on Drivers', run('state.tab') === 'database' && run('state.sub') === 'drivers');
    await home(); await click({ go: 'help' }); say('...Help is App Settings on Help', run('state.tab') === 'settings' && run('state.settingsSub') === 'help'); run("state.settingsSub = 'general'");
    await home(); await click({ go: 'setup' }); say('...Race Setup is the Race Setup tab', run('state.tab') === 'setup');
    await home(); await click({ go: 'results' }); say('...Results and Records is the Database tab on the results of the races', run('state.tab') === 'database' && run('state.sub') === 'results' && run('state.resultsSub') === 'racing');
    await home(); await click({ go: 'live' }); say('...Live Race opens its own window and leaves Home where it is; a shortcut that does not exist does nothing', opened.length === nOpen + 1 && run('state.tab') === 'home' && (await click({ go: 'bogus' }), run('state.tab') === 'home'));
    // a grid that is damaged still gives a Home with Start a race
    run("state.settings.homeGrid = { cols: 'x', rows: 9, boards: [{ c: 1, r: 1, w: 1, h: 1, opt: { card: 'zzz' } }, { c: 1, r: 1, w: 1, h: 1, opt: { card: 'rules' } }] }");
    hh = await home();
    say('a saved grid that is damaged (a card that does not exist, a size that is not a number) still gives a Home that works: the grid is mended and Start a race is there', hh.includes('id="hmc-start"') && hh.includes('id="hmc-rules"') && hh.includes('id="start"') && !hh.includes('zzz') && hh.includes('repeat(1,minmax(0,1fr))'));
    say('...Start race still starts the race from a Home like that', (run("state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }, { driverId: 'd3', carId: 'c3' }] }"), await home(), await E('view').onclick({ target: { closest: () => ({ id: 'start', dataset: {} }) } }), run('state.tab') === 'race' && run("state.race && state.race.rows.length") === 3));
    // 1.39.0: Start race with the timing hardware that was chosen not connected asks first (OK: start anyway, Cancel: do not start)
    { const keepConfirm = ctx.confirm, asked = []; let answer = true;
      ctx.confirm = m => { asked.push(String(m)); return answer; };
      const attempt = async (patch, ans) => { answer = ans; asked.length = 0; run(`(p => Object.keys(p).forEach(k => { if (p[k] === null) delete state.settings[k]; else state.settings[k] = p[k]; }))(${JSON.stringify(patch)})`); run("state.race = null; state.tab = 'home'; if (typeof live !== 'undefined' && live) { try { live.leave && live.leave(); } catch (x) {} }"); await home();
        await E('view').onclick({ target: { closest: () => ({ id: 'start', dataset: {} }) } }); await new Promise(r => setTimeout(r, 20)); return run('state.race') ? 'started' : 'not started'; };
      run('Trackmate.link.setConnected(false); ArduinoBox.link.setConnected(false)');
      say('1.39.0: the Trackmate is chosen and not connected: Start race asks, and says which hardware', (await attempt({ timingHw: 'trackmate' }, false)) === 'not started' && asked.length === 1 && asked[0].includes('The Trackmate Interface is the timing hardware you chose, and it is not connected'));
      say('...OK starts the race anyway', (await attempt({ timingHw: 'trackmate' }, true)) === 'started' && asked.length === 1);
      say('...the virtual box is named as such', (await attempt({ timingHw: 'arduino', abVirtual: true }, false)) === 'not started' && asked[0].includes('The virtual Arduino box is the timing hardware you chose'));
      say('...a real box too', (await attempt({ timingHw: 'arduino', abVirtual: false }, false)) === 'not started' && asked[0].includes('The Arduino box is the timing hardware you chose'));
      run('Trackmate.link.setConnected(true)');
      say('...connected: no question, the race starts', (await attempt({ timingHw: 'trackmate' }, false)) === 'started' && asked.length === 0);
      say('...one at a time: only the other hardware connected still asks', (await attempt({ timingHw: 'arduino', abVirtual: true }, false)) === 'not started' && asked.length === 1);
      run('Trackmate.link.setConnected(false)');
      say('...none chosen: no question, whatever is (not) connected', (await attempt({ timingHw: 'none' }, false)) === 'started' && asked.length === 0);
      ctx.confirm = keepConfirm; run("delete state.settings.timingHw; delete state.settings.abVirtual"); }
    run("state.race = null; state.tab = 'home'");
    api.setSettings = realSet;
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, drivers: keep.drivers, slotcars: keep.slotcars, sessions: keep.sessions, laps: keep.laps, layouts: keep.layouts, audiosets: keep.audiosets, penaltysystems: keep.pen, fuelrules: keep.fuel });
    run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; ${keep.grid === undefined ? 'delete state.settings.homeGrid' : 'state.settings.homeGrid = ' + JSON.stringify(keep.grid)}; state.homeCustom = ${JSON.stringify(keep.custom || { open: false, sel: 0 })}`); }
  { // 1.26.0: the Weather card and the Tyres Available card of Home: what Customize offers for them, and what they show (nothing is read from a race)
    const keep = { racesetups: store.racesetups, tracks: store.tracks, sessions: store.sessions, laps: store.laps, imagesets: store.imagesets, drivers: store.drivers, slotcars: store.slotcars, layouts: store.layouts, audiosets: store.audiosets,
      last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), grid: run('state.settings.homeGrid'), custom: run('state.homeCustom') };
    const savedCalls = [], realSet = api.setSettings; api.setSettings = async p => { savedCalls.push(p); return { ...run('state.settings'), ...p }; };
    const home = async () => { run("state.tab = 'home'"); await run('render()'); await new Promise(r => setTimeout(r, 10)); return E('view').innerHTML; };
    const click = async dataset => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: dataset.id || '', dataset } : null) } }); await new Promise(r => setTimeout(r, 15)); return E('view').innerHTML; };
    const wait = ms => new Promise(r => setTimeout(r, ms)), soft = t => t === 'text' || t === 'number'; // (a text or a number is drawn a moment after it is saved: HOME_SOFT_MS)
    run('HOME_SOFT_MS = 20');
    const change = async (dataset, value, type) => { await E('view').onchange({ target: { dataset, value, type: type || 'select-one', checked: value === true } }); await wait(soft(type) ? 90 : 15); return E('view').innerHTML; };
    const board = k => JSON.parse(run('JSON.stringify(HomeGrid.gridOf(state.settings))')).boards.find(b => b.opt.card === k), cell = k => E('hmc-' + k).innerHTML, IMG = 'data:image/png;base64,AAAA';
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 2, length: 10, laneModifier: 'none' }]; store.drivers = [{ id: 'd1', name: 'Dutch' }, { id: 'd2', name: 'Sam' }]; store.slotcars = [{ id: 'c1', brand: 'Porsche', model: '917' }, { id: 'c2', brand: 'Ford', model: 'GT40' }];
    store.layouts = []; store.audiosets = []; store.racesetups = [{ id: 'k1', name: 'Club race', sessionType: 'race', track: 't1', laps: 20 }]; store.sessions = []; store.laps = [];
    store.imagesets = [{ id: 'is1', name: 'My weather', kind: 'weather', images: { wet: IMG, dry: IMG + 'D' } }, { id: 'is2', name: 'My tyres', kind: 'tyres', images: { S: IMG + 'S', wet: IMG + 'X', dry: IMG + 'X' } }, { id: 'is3', name: 'My icons', kind: 'conditions', images: { tracktemp: IMG + 'T' } }];
    const GRID = { cols: 4, rows: 2, boards: [{ c: 1, r: 1, w: 2, h: 2, opt: { card: 'start' } }, { c: 3, r: 1, w: 1, h: 1, opt: { card: 'weather' } }, { c: 4, r: 1, w: 1, h: 1, opt: { card: 'tyres' } }] };
    run(`state.settings.lastSetupId = 'k1'; state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }] }; state.settings.homeGrid = ${JSON.stringify(GRID)}; state.homeCustom = { open: true, sel: 1 }`);
    let hh = await home();
    say('1.26.0: the Weather and Tyres Available cards show with no race saved at all (they are for show: the friendly card of the other cards is not for them)', cell('weather').includes('class="card hm-weather"') && cell('tyres').includes('class="card hm-tyrecard"') && !cell('weather').includes('hm-empty') && !cell('tyres').includes('hm-empty'));
    say('...the Weather card begins with the dry values: the sun, 30 °C, 24 °C, 10 km/h and the wind from the south west', cell('weather').includes('<strong>Dry</strong>') && cell('weather').includes('<b>30 °C</b>') && cell('weather').includes('<b>24 °C</b>') && cell('weather').includes('<b>10 km/h</b>') && cell('weather').includes('<b>SW</b>'));
    say('...the Tyres Available card begins with Hard, Medium and Soft, in a column, with no numbers', cell('tyres').includes('hm-ty-column') && ['Hard', 'Medium', 'Soft'].every(n => cell('tyres').includes(`<span class="n">${n}</span>`)) && !cell('tyres').includes('×'));
    say('the list of the cell of Weather has Weather chosen, and does not offer Tyres Available again (it is on Home already)', hh.split('data-hcell="1"')[1].split('</select>')[0].includes('<option value="weather" selected>Weather</option>') && hh.split('data-hcell="1"')[1].split('</select>')[0].includes('value="tyres"') === false);
    // the settings of the Weather card
    say('Customize shows the settings of the Weather card: the weather, a line of text, the units, the four numbers (with their limits), the ticks, the way to put them and two picture sets',
      hh.includes('<legend>Card 2: Weather (column 3, row 1)</legend>') && /id="hg-state" data-hopt="state">[^]*<option value="dry" selected>Dry<\/option>/.test(hh) && hh.includes('id="hg-line" data-hopt="line" type="text" maxlength="40" value="" placeholder="Clearing after lunch" aria-label="A line under it (your own words, or empty)"')
      && hh.includes('id="hg-track" data-hopt="track" type="number" min="-60" max="150" step="1" value="30"') && hh.includes('id="hg-air" data-hopt="air" type="number" min="-60" max="150" step="1" value="24"') && hh.includes('id="hg-wind" data-hopt="wind" type="number" min="0" max="400" step="1" value="10"')
      && hh.includes('id="hg-dir" data-hopt="dir" type="number" min="0" max="359" step="1" value="225"') && hh.includes('id="hg-showTrack" type="checkbox" data-hopt="showTrack" checked') && /id="hg-showDegrees" type="checkbox" data-hopt="showDegrees" >/.test(hh)
      && /id="hg-units" data-hopt="units"><option value="metric" selected>Celsius and km\/h<\/option><option value="imperial">Fahrenheit and mph<\/option>/.test(hh) && hh.includes('id="hg-layout" data-hopt="layout"'));
    { const sel = id => hh.split(`id="${id}"`)[1].split('</select>')[0];
      say('...a picture set can be chosen from the sets of the right kind: weather pictures from the sets of weather, icons from the sets of conditions, never the set of tyres', sel('hg-weatherSet').includes('<option value="">None (drawn)</option>') && sel('hg-weatherSet').includes('<option value="is1">My weather</option>') && !sel('hg-weatherSet').includes('My tyres') && !sel('hg-weatherSet').includes('My icons') && sel('hg-condSet').includes('<option value="is3">My icons</option>') && !sel('hg-condSet').includes('My weather')); }
    hh = await change({ hopt: 'state' }, 'wet'); hh = await change({ hopt: 'line' }, 'Clearing after lunch', 'text'); hh = await change({ hopt: 'track' }, '31', 'number');
    say('the weather, a line and a number are saved with the card and show at once (a text field and a number field save what was typed)', board('weather').opt.state === 'wet' && board('weather').opt.line === 'Clearing after lunch' && board('weather').opt.track === '31' && cell('weather').includes('<strong>Wet</strong><small>Clearing after lunch</small>') && cell('weather').includes('<b>31 °C</b>') && hh.includes('type="number" min="-60" max="150" step="1" value="31"') && hh.includes('value="Clearing after lunch"'));
    say('...what was saved is the grid that holds together', JSON.stringify(savedCalls[savedCalls.length - 1].homeGrid) === run('JSON.stringify(HomeGrid.gridOf(state.settings))'));
    hh = await change({ hopt: 'track' }, '9999', 'number'); say('...a number that is too big is held at the limit (150), and what is not a number is the standard (30)', cell('weather').includes('<b>150 °C</b>') && (await change({ hopt: 'track' }, 'warm', 'number'), cell('weather').includes('<b>30 °C</b>')));
    await change({ hopt: 'track' }, '31', 'number');
    hh = await change({ hopt: 'units' }, 'imperial');
    say('other units change the numbers with them (31 °C is 88 °F, 24 °C is 75 °F, 10 km/h is 6 mph) in the card and in the fields', cell('weather').includes('<b>88 °F</b>') && cell('weather').includes('<b>75 °F</b>') && cell('weather').includes('<b>6 mph</b>') && hh.includes('id="hg-track" data-hopt="track" type="number" min="-60" max="150" step="1" value="88"') && hh.includes('id="hg-wind" data-hopt="wind" type="number" min="0" max="400" step="1" value="6"'));
    await change({ hopt: 'units' }, 'metric'); hh = await change({ hopt: 'showDegrees' }, true, 'checkbox'); hh = await change({ hopt: 'showAir' }, false, 'checkbox'); hh = await change({ hopt: 'layout' }, 'row');
    say('the ticks and the way to put the values are saved: degrees too, no air temperature, in a row', cell('weather').includes('<b>SW 225°</b>') && !cell('weather').includes('>Air<') && cell('weather').includes('hm-ctiles cd-row'));
    hh = await change({ hopt: 'weatherSet' }, 'is1'); hh = await change({ hopt: 'condSet' }, 'is3');
    say('a picture set for the weather and one for the icons: their pictures are in the card (the Wet picture and the track temperature icon); the other icons are drawn', cell('weather').includes(`<img class="wxic" src="${IMG}" alt="Wet">`) && cell('weather').includes(`<img class="wxic" src="${IMG}T" alt="Track temperature">`) && cell('weather').includes('aria-label="Wind speed"') && /id="hg-weatherSet" data-hopt="weatherSet"><option value="">None \(drawn\)<\/option><option value="is1" selected>My weather<\/option>/.test(hh));
    hh = await change({ hopt: 'weatherSet' }, 'is2');
    say('...a set of another kind is not used (a set of tyres cannot be the weather: the weather is drawn), and neither is a set that was deleted', !cell('weather').includes('AAAAX') && cell('weather').includes('aria-label="Wet"') && (await change({ hopt: 'weatherSet' }, 'ghost'), cell('weather').includes('aria-label="Wet"') && !cell('weather').includes('<img class="wxic" src="' + IMG + '" alt="Wet">')));
    // the settings of the Tyres Available card
    hh = await click({ hsel: '2' });
    say('Customize shows the settings of Tyres Available: a row for each of the six tyres (a tick, your name, how many), then how many to show, the way to put the tyres and a picture set',
      hh.includes('<legend>Card 3: Tyres Available (column 4, row 1)</legend>') && (hh.match(/class="hm-orow"/g) || []).length === 6 && hh.includes('id="hg-on_H" type="checkbox" data-hopt="on_H" checked') && /id="hg-on_SS" type="checkbox" data-hopt="on_SS" >/.test(hh)
      && hh.includes('id="hg-name_S" data-hopt="name_S" type="text" maxlength="24" value="" placeholder="Name (Soft)" aria-label="Your name for Soft"') && hh.includes('id="hg-count_S" data-hopt="count_S" type="number" min="0" max="99" step="1" value="4" aria-label="How many sets of Soft"><span class="muted">sets</span>')
      && hh.includes('id="hg-showCount" type="checkbox" data-hopt="showCount" >') && hh.includes('id="hg-layout" data-hopt="layout"><option value="column" selected>In a column</option><option value="row">In a row</option>') && hh.includes('id="hg-tyreSet" data-hopt="tyreSet"'));
    say('...a row has its tick, its name and its number in one line (one block per tyre, in the order of the weather system)', (() => { const rows = hh.split('class="hm-orow"').slice(1).map(r => r.split('</div>')[0]); return rows.length === 6 && rows.every((r, k) => r.includes(`id="hg-on_${['H', 'M', 'S', 'SS', 'INT', 'W'][k]}"`) && r.includes('type="text"') && r.includes('type="number"')) && rows[0].includes('> Hard</label>') && rows[4].includes('> Intermediate</label>'); })());
    hh = await change({ hopt: 'name_S' }, 'Grippy', 'text'); hh = await change({ hopt: 'on_SS' }, true, 'checkbox'); hh = await change({ hopt: 'on_H' }, false, 'checkbox');
    say('a name you give a tyre shows in the card, a tyre you tick is added (in the order of the weather system) and a tyre you untick is gone', ['Medium', 'Grippy', 'Supersoft'].every((n, k, all) => k === 0 || cell('tyres').indexOf(`>${n}</span>`) > cell('tyres').indexOf(`>${all[k - 1]}</span>`)) && !cell('tyres').includes('>Hard<') && cell('tyres').includes('aria-label="Soft tyres"') && hh.includes('id="hg-name_S" data-hopt="name_S" type="text" maxlength="24" value="Grippy"'));
    hh = await change({ hopt: 'showCount' }, true, 'checkbox'); hh = await change({ hopt: 'count_S' }, '6', 'number'); hh = await change({ hopt: 'layout' }, 'row');
    say('how many and the way to put the tyres: "× 6" behind the Soft tyre, "× 4" behind the others, side by side', cell('tyres').includes('<span class="n">Grippy</span><strong class="c">× 6</strong>') && cell('tyres').includes('<span class="n">Medium</span><strong class="c">× 4</strong>') && cell('tyres').includes('hm-tyres hm-ty-row') && board('tyres').opt.count_S === '6');
    hh = await change({ hopt: 'tyreSet' }, 'is2');
    say('a picture set of tyres: its picture for the Soft tyre, the others are drawn', cell('tyres').includes(`<img class="wxic" src="${IMG}S" alt="Soft tyres">`) && cell('tyres').includes('aria-label="Medium tyres"') && /id="hg-tyreSet" data-hopt="tyreSet"><option value="">None \(drawn\)<\/option><option value="is2" selected>My tyres<\/option>/.test(hh));
    for (const k of ['M', 'S', 'SS']) await change({ hopt: 'on_' + k }, false, 'checkbox');
    say('no tyre ticked: the card says how to get tyres', cell('tyres').includes('No tyre is ticked. Open Customize and tick the tyres you want here.'));
    // a line of text or a number: saved when you leave the field, drawn a moment later; the cursor stays; nothing is lost
    await change({ hopt: 'on_M' }, true, 'checkbox'); await change({ hopt: 'on_S' }, true, 'checkbox'); await change({ hopt: 'on_SS' }, false, 'checkbox'); run('HOME_SOFT_MS = 150'); await home(); const n0 = savedCalls.length;
    await E('view').onchange({ target: { dataset: { hopt: 'count_M' }, value: '9', type: 'number' } }); await wait(40);
    say('a number is saved at once, and Home is drawn a moment later (a click or a Tab that comes next is not lost to a page that changes under it)', savedCalls.length === n0 + 1 && board('tyres').opt.count_M === '9' && !cell('tyres').includes('× 9') && (await wait(220), true));
    run("var __n = 0; var __orig = renderHome; renderHome = function () { __n++; return __orig.apply(this, arguments); }; HOME_SOFT_MS = 40");
    await E('view').onchange({ target: { dataset: { hopt: 'name_M' }, value: 'One', type: 'text' } }); await E('view').onchange({ target: { dataset: { hopt: 'name_M' }, value: 'Two', type: 'text' } }); await wait(150);
    say('...two changes in a row are drawn once (the last one), and nothing is lost', run('__n') === 1 && board('tyres').opt.name_M === 'Two' && cell('tyres').includes('>Two<') && !cell('tyres').includes('>One<'));
    run('__n = 0');
    await E('view').onchange({ target: { dataset: { hopt: 'name_M' }, value: 'Three', type: 'text' } }); await E('view').onchange({ target: { dataset: { hopt: 'on_SS' }, value: true, type: 'checkbox', checked: true } }); await wait(150);
    say('a tick right after a text (the click that comes after the field is left) is made on the grid with the text in it: both are saved, and Home is drawn once (the drawing that waited is this one)', board('tyres').opt.name_M === 'Three' && board('tyres').opt.on_SS === true && cell('tyres').includes('>Three<') && cell('tyres').includes('>Supersoft<') && run('__n') === 1);
    say('...when a save is done no grid is kept as "the latest" any more (the next change starts from what is saved)', run('state.homeCustom.latest') == null);
    run('HOME_SOFT_MS = 200; __n = 0');
    await E('view').onchange({ target: { dataset: { hopt: 'name_M' }, value: 'Six', type: 'text' } }); await wait(120); await E('view').onchange({ target: { dataset: { hopt: 'name_M' }, value: 'Seven', type: 'text' } }); await wait(110);
    say('every change starts the wait again: a second change shortly after the first is drawn a moment after the second, not at the time the first would have been', run('__n') === 0 && (await wait(250), run('__n') === 1 && cell('tyres').includes('>Seven<')));
    run('HOME_SOFT_MS = 40');
    run('__n = 0');
    await E('view').onchange({ target: { dataset: { hopt: 'name_M' }, value: 'Four', type: 'text' } }); await E('view').oninput({ target: { id: 'hg-name_S', type: 'text', dataset: { hopt: 'name_S' } } }); await wait(120);
    say('...while you are typing in a field nothing is drawn (the field would lose what you type); when that field is left it is saved and drawn', run('__n') === 0 && run('state.homeCustom.typing') === true && !cell('tyres').includes('>Four<') && (await E('view').onchange({ target: { dataset: { hopt: 'name_S' }, value: 'Fast', type: 'text' } }), await wait(120), run('__n') === 1 && cell('tyres').includes('>Four<') && cell('tyres').includes('>Fast<') && run('state.homeCustom.typing') === false));
    await E('view').oninput({ target: { id: 'hg-on_S', type: 'checkbox', dataset: { hopt: 'on_S' } } });
    say('...only a text or a number counts as typing', run('state.homeCustom.typing') === false);
    run('__n = 0'); await E('view').onchange({ target: { dataset: { hopt: 'name_M' }, value: 'Five', type: 'text' } }); run("state.tab = 'setup'"); await wait(120);
    say('a drawing that waited is not made when you have gone to another tab', run('__n') === 0); run("state.tab = 'home'");
    run('renderHome = __orig; HOME_SOFT_MS = 20');
    say('typing counts in a line of text or a number of Customize, nothing else', run("homeFocusId({ id: 'hg-name_S', type: 'text', dataset: { hopt: 'name_S' } })") === 'hg-name_S' && run("homeFocusId({ id: 'hg-count_S', type: 'number', dataset: { hopt: 'count_S' } })") === 'hg-count_S'
      && run("homeFocusId({ id: 'hg-on_S', type: 'checkbox', dataset: { hopt: 'on_S' } })") === '' && run("homeFocusId({ id: 'setup', type: 'select-one', dataset: {} })") === '' && run("homeFocusId({ id: 'f-name', type: 'text', dataset: {} })") === '' && run('homeFocusId(null)') === ''
      && run("homeFieldId({ id: 'hg-on_S' })") === 'hg-on_S' && run("homeFieldId({ id: 'hg-state' })") === 'hg-state' && run("homeFieldId({ id: 'setup' })") === '' && run("homeFieldId({ id: 'hgx' })") === '' && run('homeFieldId(null)') === '' && run('homeFieldId({})') === '');
    { const got = [], el = E('hg-name_S'), el2 = E('hg-count_S'); el.focus = () => got.push('focus name'); el.setSelectionRange = (a, b2) => got.push(`select ${a}-${b2}`); el2.focus = () => got.push('focus count'); el2.select = () => got.push('select all'); el2.setSelectionRange = () => got.push('WRONG');
      document.activeElement = { id: 'hg-name_S', type: 'text', dataset: { hopt: 'name_S' }, selectionStart: 2, selectionEnd: 5 }; run('state.homeCustom.open = true'); await home();
      say('when Home is drawn again the line of text that had the cursor has it again, with the same part of the text selected', got.join() === 'focus name,select 2-5');
      got.length = 0; document.activeElement = { id: 'hg-count_S', type: 'number', dataset: { hopt: 'count_S' }, selectionStart: null, selectionEnd: null }; await home();
      say('...a number has no part to select: all of it is selected, as when you come into the field with Tab', got.join() === 'focus count,select all');
      got.length = 0; E('hg-on_M').focus = () => got.push('focus tick'); document.activeElement = { id: 'hg-on_M', type: 'checkbox', dataset: { hopt: 'on_M' }, selectionStart: null, selectionEnd: null }; await home();
      say('...a tick or a choice of Customize has it again too (you can go on with the keyboard), without anything selected', got.join() === 'focus tick');
      got.length = 0; document.activeElement = { id: 'setup', type: 'select-one', dataset: {} }; await home(); document.activeElement = { id: 'hg-name_S', type: 'text', dataset: { hopt: 'name_S' }, selectionStart: 1, selectionEnd: 1 }; run('state.homeCustom.open = false'); await home();
      say('...a control that is not one of Customize (the race setup on Home), and any control with Customize closed, get nothing', got.length === 0); delete document.activeElement; run('state.homeCustom.open = true'); }
    // back to the usual Home
    run('state.homeCustom.open = true'); await home(); await click({ id: 'hmdefault' });
    say('"Back to the usual Home" takes both cards away with the rest of the grid', savedCalls[savedCalls.length - 1].homeGrid === null && !E('view').innerHTML.includes('id="hmc-weather"') && !E('view').innerHTML.includes('id="hmc-tyres"'));
    api.setSettings = realSet;
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, sessions: keep.sessions, laps: keep.laps, imagesets: keep.imagesets, drivers: keep.drivers, slotcars: keep.slotcars, layouts: keep.layouts, audiosets: keep.audiosets });
    run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; ${keep.grid === undefined ? 'delete state.settings.homeGrid' : 'state.settings.homeGrid = ' + JSON.stringify(keep.grid)}; state.homeCustom = ${JSON.stringify(keep.custom || { open: false, sel: 0 })}`); }
  { // 1.28.0: the Notes card and the Car Mileage card of Home: what Customize offers for them (a box for the lines of Notes) and what they show
    const keep = { racesetups: store.racesetups, tracks: store.tracks, sessions: store.sessions, laps: store.laps, drivers: store.drivers, slotcars: store.slotcars, layouts: store.layouts, audiosets: store.audiosets,
      last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), grid: run('state.settings.homeGrid'), custom: run('state.homeCustom'), du: run('state.settings.distanceUnit') };
    const savedCalls = [], realSet = api.setSettings; api.setSettings = async p => { savedCalls.push(p); return { ...run('state.settings'), ...p }; };
    const home = async () => { run("state.tab = 'home'"); await run('render()'); await new Promise(r => setTimeout(r, 10)); return E('view').innerHTML; };
    const wait = ms => new Promise(r => setTimeout(r, ms)), soft = t => t === 'text' || t === 'number' || t === 'textarea';
    run('HOME_SOFT_MS = 20');
    const change = async (dataset, value, type) => { await E('view').onchange({ target: { dataset, value, type: type || 'select-one', checked: value === true } }); await wait(soft(type) ? 90 : 15); return E('view').innerHTML; };
    const board = k => JSON.parse(run('JSON.stringify(HomeGrid.gridOf(state.settings))')).boards.find(b => b.opt.card === k), cell = k => E('hmc-' + k).innerHTML;
    const yr = new Date().getFullYear(), at = (y, d) => `${y}-${d}T19:00:00.000Z`, PIC = 'data:image/png;base64,PORSCHE';
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 2, length: 10, laneModifier: 'none' }]; store.drivers = [{ id: 'd1', name: 'Dutch' }, { id: 'd2', name: 'Sam' }];
    store.slotcars = [{ id: 'c1', brand: 'Porsche', model: '917', picture: PIC }, { id: 'c2', brand: 'Ford', model: 'GT40' }]; store.layouts = []; store.audiosets = [];
    store.racesetups = [{ id: 'k1', name: 'Club race', sessionType: 'race', track: 't1', laps: 20 }]; store.sessions = []; store.laps = [];
    const GRID = { cols: 4, rows: 2, boards: [{ c: 1, r: 1, w: 2, h: 2, opt: { card: 'start' } }, { c: 3, r: 1, w: 1, h: 1, opt: { card: 'notes' } }, { c: 4, r: 1, w: 1, h: 1, opt: { card: 'mileage' } }] };
    run(`state.settings.lastSetupId = 'k1'; state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }, { driverId: 'd2', carId: 'c2' }] }; state.settings.homeGrid = ${JSON.stringify(GRID)}; state.homeCustom = { open: true, sel: 1 }; delete state.settings.distanceUnit`);
    let hh = await home();
    say('1.28.0: Notes shows with no race saved at all, with its title and the line that says there are no notes yet; Car Mileage with nothing raced gives way to the friendly card', cell('notes').includes('class="card hm-notes hm-n-normal"') && cell('notes').includes('<h3>Notes</h3>') && cell('notes').includes('No notes yet.') && !cell('notes').includes('hm-empty') && cell('mileage').includes('class="card hm-empty"') && !cell('mileage').includes('hm-mileage'));
    say('Customize shows the settings of the Notes card: the title, a box for the words (a text box of 6 lines that holds 600 characters, the whole width), the size and the tick for the title',
      hh.includes('<legend>Card 2: Notes (column 3, row 1)</legend>') && hh.includes('id="hg-title" data-hopt="title" type="text" maxlength="40" value="Notes" placeholder="Notes"') && hh.includes('<div class="field hm-wide"><label for="hg-text">Your notes (a new line stays a new line)</label><textarea id="hg-text" data-hopt="text" rows="6" maxlength="600" placeholder="Doors open 19:00, first heat 19:30." aria-label="Your notes (a new line stays a new line)"></textarea></div>')
      && /id="hg-size" data-hopt="size"><option value="normal" selected>Normal<\/option><option value="large">Large<\/option>/.test(hh) && hh.includes('id="hg-showTitle" type="checkbox" data-hopt="showTitle" checked'));
    // typing in the box, and leaving it
    run('globalThis.__n = 0; globalThis.__orig = renderHome; renderHome = async function () { globalThis.__n++; return __orig.apply(this, arguments); }');
    await E('view').oninput({ target: { id: 'hg-text', type: 'textarea', dataset: { hopt: 'text' } } }); await wait(60);
    say('while you type in the box of the words nothing is drawn (the box would lose what you type); that counts as typing like a line of text does', run('__n') === 0 && run('state.homeCustom.typing') === true && run("homeFocusId({ id: 'hg-text', type: 'textarea', dataset: { hopt: 'text' } })") === 'hg-text' && run("homeFocusId({ id: 'hg-text', type: 'select-one', dataset: { hopt: 'text' } })") === '');
    const words = 'Doors open 19:00\nBring <b>tyres</b>\n\nMarshals: Sam and Kim';
    await E('view').onchange({ target: { dataset: { hopt: 'text' }, value: words, type: 'textarea' } }); await wait(4); const early = run('__n'); await wait(120);
    say('...when the box is left the words are saved with their lines and Home is drawn once, a moment later (not at once, so a click or a Tab that comes next is not lost), the card shows them with the lines and made safe', early === 0 && run('__n') === 1 && board('notes').opt.text === words && cell('notes').includes('<div class="hm-ntext">Doors open 19:00\nBring &lt;b&gt;tyres&lt;/b&gt;\n\nMarshals: Sam and Kim</div>') && !cell('notes').includes('No notes yet') && run('state.homeCustom.typing') === false);
    run('renderHome = __orig');
    say('...and the box has the words again, with their lines, after the page is drawn (the words are in the box, made safe)', E('view').innerHTML.includes('maxlength="600" placeholder="Doors open 19:00, first heat 19:30." aria-label="Your notes (a new line stays a new line)">Doors open 19:00\nBring &lt;b&gt;tyres&lt;/b&gt;\n\nMarshals: Sam and Kim</textarea>'));
    hh = await change({ hopt: 'title' }, 'Club night', 'text'); hh = await change({ hopt: 'size' }, 'large');
    say('the title and the size are saved and shown', cell('notes').includes('<h3>Club night</h3>') && cell('notes').includes('hm-n-large') && board('notes').opt.title === 'Club night' && board('notes').opt.size === 'large');
    hh = await change({ hopt: 'showTitle' }, false, 'checkbox'); say('...the title can be switched off', !cell('notes').includes('<h3>') && cell('notes').includes('hm-ntext'));
    await change({ hopt: 'text' }, '   ', 'textarea'); say('...and a box that is emptied is the line that says there are no notes yet', cell('notes').includes('No notes yet.') && !cell('notes').includes('hm-ntext'));
    { const got = [], el = E('hg-text'); el.focus = () => got.push('focus text'); el.setSelectionRange = (a, b2) => got.push(`select ${a}-${b2}`);
      document.activeElement = { id: 'hg-text', type: 'textarea', dataset: { hopt: 'text' }, selectionStart: 4, selectionEnd: 9 }; run('state.homeCustom.open = true'); await home();
      say('when Home is drawn again the box of the words has the cursor again, with the same part selected', got.join() === 'focus text,select 4-9'); delete document.activeElement; }
    // Car Mileage: settings and what it shows
    run('state.homeCustom.sel = 2'); hh = await home();
    say('Customize shows the settings of Car Mileage: what to show, how many cars, the period, the picture and the bar', hh.includes('<legend>Card 3: Car Mileage (column 4, row 1)</legend>')
      && /id="hg-show" data-hopt="show"><option value="both" selected>Laps and distance<\/option><option value="laps">Laps<\/option><option value="distance">Distance<\/option>/.test(hh) && /id="hg-count" data-hopt="count">[^]*<option value="5" selected>5<\/option>/.test(hh)
      && /id="hg-period" data-hopt="period"><option value="all" selected>All time<\/option><option value="year">This year<\/option>/.test(hh) && hh.includes('id="hg-pics" type="checkbox" data-hopt="pics" checked') && hh.includes('id="hg-bars" type="checkbox" data-hopt="bars" checked'));
    const std = (pos, id, name, laps, car) => ({ pos, driverId: id, driverName: name, carId: car, laps, best: 5000 }), lp = (n, car, extra) => ({ id: 'L' + n + car + Math.random(), sessionId: 's1', trackId: 't1', driverId: car === 'c1' ? 'd1' : 'd2', carId: car, lane: 1, time: 5000, lapNumber: n, date: at(yr, '03-01'), ...extra });
    store.sessions = [{ id: 's1', sessionType: 'race', date: at(yr, '03-01'), setupName: 'Club race', trackId: 't1', trackName: 'Living room', standings: [std(1, 'd1', 'Dutch', 5, 'c1'), std(2, 'd2', 'Sam', 3, 'c2')] }];
    store.laps = [...[1, 2, 3, 4, 5].map(n => lp(n, 'c1')), ...[1, 2, 3].map(n => lp(n, 'c2')), lp(6, 'c2', { date: at(yr - 1, '06-01'), sessionId: 's0' }), lp(7, 'c1', { invalid: true })];
    hh = await home();
    say('with races saved the card lists the slotcars, the one with the most laps first, with the laps and the distance (5 laps of 10 m is 50 m), the picture of the car that has one, and the bars', cell('mileage').includes('class="card hm-mileage"') && cell('mileage').includes('<span class="hm-tag">all time</span>')
      && cell('mileage').indexOf('Porsche 917') < cell('mileage').indexOf('Ford GT40') && cell('mileage').includes('<strong>5 laps</strong> · <span class="muted">50 m</span>') && cell('mileage').includes('<strong>4 laps</strong> · <span class="muted">40 m</span>')
      && cell('mileage').includes(`<img class="hm-carpic" src="${PIC}" alt="">`) && cell('mileage').includes('<span class="hm-carpic"></span>') && cell('mileage').includes('style="width:100%"') && cell('mileage').includes('style="width:80%"'));
    hh = await change({ hopt: 'period' }, 'year');
    say('...this year only counts the laps of this year (the Ford has 3 laps, 30 m, the lap of last year is out)', cell('mileage').includes('<span class="hm-tag">this year</span>') && cell('mileage').includes('<strong>3 laps</strong> · <span class="muted">30 m</span>') && !cell('mileage').includes('4 laps') && board('mileage').opt.period === 'year');
    hh = await change({ hopt: 'show' }, 'distance'); hh = await change({ hopt: 'pics' }, false, 'checkbox'); hh = await change({ hopt: 'bars' }, false, 'checkbox');
    say('...Show, the picture and the bar are saved: only the distance, no picture, no bar', cell('mileage').includes('<strong>50 m</strong>') && !cell('mileage').includes('laps') && !cell('mileage').includes('hm-carpic') && !cell('mileage').includes('hm-mbar'));
    { const base = { cars: store.slotcars, laps: store.laps }, rows = () => (cell('mileage').match(/class="hm-mrow"/g) || []).length;
      store.slotcars = [...base.cars, ...[3, 4, 5, 6, 7].map(i => ({ id: 'c' + i, brand: 'Car', model: String(i) }))]; store.laps = [...base.laps, ...[3, 4, 5, 6, 7].map(i => lp(1, 'c' + i, { carId: 'c' + i }))]; await home();
      const five = rows(); await change({ hopt: 'count' }, '3'); const three = rows(); await change({ hopt: 'count' }, '8'); const all = rows(); await change({ hopt: 'count' }, '5');
      say('Cars shown: with seven cars that have laps the card shows 5 to begin with, 3 when you choose 3, and all seven when you choose 8', five === 5 && three === 3 && all === 7 && board('mileage').opt.count === '5');
      store.slotcars = base.cars; store.laps = base.laps; await home(); }
    hh = await change({ hopt: 'show' }, 'laps'); hh = await change({ hopt: 'count' }, '3'); run('state.settings.distanceUnit = "ft"'); hh = await home();
    say('...and the number of cars, laps only; the distance is in the unit of App Settings (50 m is 164 ft)', cell('mileage').includes('<strong>5 laps</strong>') && !cell('mileage').includes('164 ft') && (await change({ hopt: 'show' }, 'both'), cell('mileage').includes('<span class="muted">164 ft</span>')) && !cell('mileage').includes(' m</span>'));
    run('delete state.settings.distanceUnit'); await change({ hopt: 'count' }, '5');
    store.slotcars = [{ id: 'c2', brand: 'Ford', model: 'GT40' }]; hh = await home();
    say('a car that is not in the database any more is left out (its laps stay in the races)', !cell('mileage').includes('Porsche') && cell('mileage').includes('Ford GT40'));
    store.laps = [lp(1, 'c1', { carId: undefined })]; store.slotcars = [{ id: 'c1', brand: 'Porsche', model: '917' }]; hh = await home();
    say('...and laps without a car give the card that says no lap has been driven with a car this year yet (this year is still chosen), and with all time no lap has been saved with a car yet', cell('mileage').includes('No lap has been driven with a car this year yet.') && !cell('mileage').includes('hm-mrow') && (await change({ hopt: 'period' }, 'all'), cell('mileage').includes('No lap has been saved with a car yet.') && !cell('mileage').includes('this year yet')));
    await click0(); async function click0() { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: 'hmdefault', dataset: {} } : null) } }); await wait(15); }
    say('"Back to the usual Home" takes both cards away with the rest of the grid', savedCalls[savedCalls.length - 1].homeGrid === null && !E('view').innerHTML.includes('id="hmc-notes"') && !E('view').innerHTML.includes('id="hmc-mileage"'));
    api.setSettings = realSet;
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, sessions: keep.sessions, laps: keep.laps, drivers: keep.drivers, slotcars: keep.slotcars, layouts: keep.layouts, audiosets: keep.audiosets });
    run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; ${keep.grid === undefined ? 'delete state.settings.homeGrid' : 'state.settings.homeGrid = ' + JSON.stringify(keep.grid)}; state.homeCustom = ${JSON.stringify(keep.custom || { open: false, sel: 0 })}; ${keep.du === undefined ? 'delete state.settings.distanceUnit' : 'state.settings.distanceUnit = ' + JSON.stringify(keep.du)}`); }
  { // 1.34.0: the Service Due card of Home: the cars that need servicing, from the cars (no races needed), and a click on a car opens its card in the Database
    const keep = { racesetups: store.racesetups, tracks: store.tracks, sessions: store.sessions, laps: store.laps, drivers: store.drivers, slotcars: store.slotcars, layouts: store.layouts, audiosets: store.audiosets,
      last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), grid: run('state.settings.homeGrid'), custom: run('state.homeCustom'), tab: run('state.tab'), sub: run('state.sub') };
    const savedCalls = [], realSet = api.setSettings; api.setSettings = async p => { savedCalls.push(p); return { ...run('state.settings'), ...p }; };
    const wait = ms => new Promise(r => setTimeout(r, ms)), home = async () => { run("state.tab = 'home'"); await run('render()'); await wait(10); return E('view').innerHTML; };
    const change = async (dataset, value, type) => { await E('view').onchange({ target: { dataset, value, type: type || 'select-one', checked: value === true } }); await wait(15); return E('view').innerHTML; };
    const clickHome = async dataset => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: dataset.id || '', dataset } : null) } }); await wait(40); };
    const board = k => JSON.parse(run('JSON.stringify(HomeGrid.gridOf(state.settings))')).boards.find(b => b.opt.card === k), cell = k => E('hmc-' + k).innerHTML, PIC = 'data:image/png;base64,PORSCHE';
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 2, length: 10, laneModifier: 'none' }]; store.drivers = [{ id: 'd1', name: 'Dutch' }]; store.layouts = []; store.audiosets = [];
    store.racesetups = [{ id: 'k1', name: 'Club race', sessionType: 'race', track: 't1', laps: 20 }]; store.sessions = []; store.laps = [];
    const car = (id, brand, model, interval, since, extra) => ({ id, brand, model, ...(interval ? { serviceInterval: interval } : {}), lapsSinceService: since, ...extra });
    store.slotcars = [car('c1', 'Porsche', '917', 300, 342, { picture: PIC }), car('c2', 'Ford', 'GT40', 200, 200), car('c3', 'Ninco', 'Lola', 300, 278), car('c4', 'Slot.it', 'Fresh', 300, 100), car('c5', 'No', 'Interval', 0, 900), car('c6', 'Scalex', 'Mid', 300, 230)];
    run(`state.settings.lastSetupId = 'k1'; state.settings.assignments = { k1: [{ driverId: 'd1', carId: 'c1' }] }; state.settings.homeGrid = ${JSON.stringify({ cols: 4, rows: 2, boards: [{ c: 1, r: 1, w: 2, h: 2, opt: { card: 'start' } }, { c: 3, r: 1, w: 2, h: 1, opt: { card: 'service' } }] })}; state.homeCustom = { open: true, sel: 1 }`);
    let hh = await home();
    say('Customize shows the settings of Service Due: what to show, what coming up means, how many cars, the bar and the picture', hh.includes('<legend>Card 2: Service Due (column 3, row 1)</legend>')
      && /id="hg-show" data-hopt="show"><option value="soon" selected>Due and coming up<\/option><option value="due">Due only<\/option>/.test(hh) && /id="hg-within" data-hopt="within"><option value="5">5% of the interval<\/option><option value="10" selected>10% of the interval<\/option>/.test(hh)
      && /id="hg-count" data-hopt="count">[^]*<option value="5" selected>5<\/option>/.test(hh) && hh.includes('id="hg-bars" type="checkbox" data-hopt="bars" checked') && hh.includes('id="hg-pics" type="checkbox" data-hopt="pics" checked'));
    say('the card shows without any race saved: the cars that are due first (the most laps over first), then the cars coming up; a car far from its interval and a car without an interval are not there', cell('service').includes('class="card hm-svc"') && cell('service').includes('<span class="hm-tag">3 cars</span>')
      && cell('service').indexOf('Porsche 917') < cell('service').indexOf('Ford GT40') && cell('service').indexOf('Ford GT40') < cell('service').indexOf('Ninco Lola') && !cell('service').includes('Fresh') && !cell('service').includes('Interval') && !cell('service').includes('Scalex'));
    say('...a car that is due says Service due with its laps (342 of 300, 42 over; 200 of 200, due now), a car coming up how many laps to go (22 of 300), each with a bar (full, full, 93%) and the picture of the car that has one', cell('service').includes('<strong class="sv-st due">Service due</strong><small>342 of 300 laps · 42 over</small>')
      && cell('service').includes('<small>200 of 200 laps · due now</small>') && cell('service').includes('<strong class="sv-st soon">22 laps to go</strong><small>278 of 300 laps</small>') && cell('service').includes(`<img class="hm-carpic" src="${PIC}" alt="">`) && cell('service').includes('<span class="hm-carpic"></span>')
      && cell('service').includes('<i class="due" style="width:100%"></i>') && cell('service').includes('<i class="soon" style="width:93%"></i>'));
    say('...every car is a button with its id, to open its card', ['c1', 'c2', 'c3'].every(id => cell('service').includes(`<button class="hm-mrow hm-carbtn" type="button" data-car="${id}" title="Open the card of this car">`)) && !cell('service').includes('data-car="c4"'));
    hh = await change({ hopt: 'show' }, 'due');
    say('Show: Due only leaves the car that is coming up out (2 cars)', cell('service').includes('<span class="hm-tag">2 cars</span>') && !cell('service').includes('Ninco') && !cell('service').includes('laps to go') && board('service').opt.show === 'due');
    hh = await change({ hopt: 'show' }, 'soon'); hh = await change({ hopt: 'within' }, '5');
    say('Coming up means within 5% of the interval: 22 laps to go of 300 is 7%, so that car is out', cell('service').includes('<span class="hm-tag">2 cars</span>') && !cell('service').includes('Ninco') && board('service').opt.within === '5');
    hh = await change({ hopt: 'within' }, '25');
    say('...within 25%: the car with 70 to go (230 of 300) comes up too, after the car with 22 to go (the fewest laps to go first)', cell('service').includes('<span class="hm-tag">4 cars</span>') && cell('service').indexOf('Ninco') < cell('service').indexOf('Scalex') && cell('service').includes('<small>230 of 300 laps</small>') && cell('service').includes('70 laps to go') && !cell('service').includes('Fresh'));
    hh = await change({ hopt: 'count' }, '3');
    say('Cars shown: with 4 cars and 3 chosen the card shows 3 and says so (3 of 4 cars)', cell('service').includes('<span class="hm-tag">3 of 4 cars</span>') && !cell('service').includes('Scalex') && (cell('service').match(/data-car="/g) || []).length === 3);
    hh = await change({ hopt: 'count' }, '5'); hh = await change({ hopt: 'within' }, '10');
    hh = await change({ hopt: 'bars' }, false, 'checkbox');
    say('Bars off: the cars keep their picture and their words, with no bar', cell('service').includes('hm-mrow') && !cell('service').includes('hm-mbar') && cell('service').includes('hm-carpic') && cell('service').includes('Service due'));
    hh = await change({ hopt: 'bars' }, true, 'checkbox'); hh = await change({ hopt: 'pics' }, false, 'checkbox');
    say('Pictures off: the bars stay, the pictures go', !cell('service').includes('hm-carpic') && cell('service').includes('hm-mbar'));
    hh = await change({ hopt: 'bars' }, false, 'checkbox');
    say('Bars and pictures both off is the compact card: one line a car, a dot, the name and how far it is (42 laps over, due now, 22 laps to go)', !cell('service').includes('hm-mrow') && !cell('service').includes('hm-mbar') && !cell('service').includes('hm-carpic')
      && cell('service').includes('<button class="hm-kv hm-carbtn" type="button" data-car="c1" title="Open the card of this car"><span class="who"><i class="sv-dot due"></i>Porsche 917</span><strong class="sv-st due">42 laps over</strong></button>')
      && cell('service').includes('<span class="who"><i class="sv-dot due"></i>Ford GT40</span><strong class="sv-st due">due now</strong>') && cell('service').includes('<span class="who"><i class="sv-dot soon"></i>Ninco Lola</span><strong class="sv-st soon">22 laps to go</strong>'));
    // a click on a car
    await clickHome({ car: 'c3' });
    say('a click on a car goes to Slotcars in the Database and opens the card of that car (and Home forgets the choice)', run('state.tab') === 'database' && run('state.sub') === 'slotcars' && run('state.focusCar') === null && E('dlg').innerHTML.includes('<h3 class="vctitle">Ninco Lola</h3>'));
    E('dlg').innerHTML = ''; run("state.tab = 'database'; state.sub = 'slotcars'"); await run('render()'); await wait(20);
    say('...the Slotcars page opened any other time opens no card', !E('dlg').innerHTML.includes('vctitle'));
    run("state.focusCar = 'gone'"); await run('render()'); await wait(20);
    say('...a car that is not in the database any more opens nothing, and the choice is forgotten', !E('dlg').innerHTML.includes('vctitle') && run('state.focusCar') === null);
    // nothing to service
    run("state.tab = 'home'"); store.slotcars = [car('c1', 'Porsche', '917', 300, 20), car('c5', 'No', 'Interval', 0, 900)]; hh = await home();
    say('when no car needs servicing the card says so, with the words for the choice (within 10% of its service interval, or past it)', cell('service').includes('<span class="hm-tag">all good</span>') && cell('service').includes('No car needs servicing. A car shows here when it is within 10% of its service interval, or past it.') && !cell('service').includes('data-car'));
    hh = await change({ hopt: 'show' }, 'due');
    say('...and for Due only (when it has reached its service interval)', cell('service').includes('No car needs servicing. A car shows here when it has reached its service interval.'));
    store.slotcars = [car('c5', 'No', 'Interval', 0, 900)]; hh = await home();
    say('when no car has a service interval the card says where to set one, and there is nothing to be good about', cell('service').includes('No slotcar has a service interval yet. Set one in Database > Slotcars, in the Statistics folder of a car.') && !cell('service').includes('hm-tag'));
    store.slotcars = []; hh = await home();
    say('...no cars at all is the same card', cell('service').includes('No slotcar has a service interval yet.'));
    await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: 'hmdefault', dataset: {} } : null) } }); await wait(15);
    say('"Back to the usual Home" takes the card away with the rest of the grid', savedCalls[savedCalls.length - 1].homeGrid === null && !E('view').innerHTML.includes('id="hmc-service"'));
    api.setSettings = realSet;
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, sessions: keep.sessions, laps: keep.laps, drivers: keep.drivers, slotcars: keep.slotcars, layouts: keep.layouts, audiosets: keep.audiosets });
    run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; ${keep.grid === undefined ? 'delete state.settings.homeGrid' : 'state.settings.homeGrid = ' + JSON.stringify(keep.grid)}; state.homeCustom = ${JSON.stringify(keep.custom || { open: false, sel: 0 })}; state.tab = ${JSON.stringify(keep.tab || 'home')}; state.sub = ${JSON.stringify(keep.sub || '')}`); E('dlg').innerHTML = ''; }
  { // Race Setups: the session type is the folder
    const keepSetups = store.racesetups, keepTracks = store.tracks;
    store.racesetups = [{id:'r1',name:'Friday',sessionType:'race',track:'t1',laps:10},{id:'r2',name:'Sprint',sessionType:'race',track:'t1',laps:5},{id:'r3',name:'Warm up',sessionType:'practice',track:'t1'},
      {id:'r4',name:'Old style',sessionType:'enduro',track:'t1',laps:3}];
    run('folderClosed.clear()'); run("state.tab='setup'"); await run('render()');
    const sm = () => E('setupmgr').innerHTML, folders_ = () => sm().match(/<details class="dbfolder"[^>]*>/g) || [], opens = () => (sm().match(/<details class="dbfolder"[^>]* open>/g) || []).length, titles = () => (sm().match(/<details class="dbfolder"[^>]*><summary><strong>[^<]*/g) || []).map(x => x.replace(/.*<strong>/, ''));
    say('Race Setups has a folder for every session type in use, in the order of the session types, with how many setups it holds', titles().join('|') === 'Free practice|Race by laps or distance|Other' && sm().includes('<strong>Free practice</strong> <span class="muted">1 race setup</span>') && sm().includes('<strong>Race by laps or distance</strong> <span class="muted">2 race setups</span>'));
    say('...a setup of a session type that is not in the list goes in Other, so that none is lost', sm().includes('<strong>Other</strong> <span class="muted">1 race setup</span>') && sm().includes('Old style'));
    say('...a session type without setups has no folder (Qualifying, Timed race and Heat-based race are not there)', !sm().includes('<strong>Qualifying</strong>') && !sm().includes('<strong>Timed race</strong>') && !sm().includes('<strong>Heat-based race</strong>'));
    say('...and every setup is in the folder of its type', (() => { const h = sm(), at = t => h.indexOf(`<strong>${t}</strong>`); return h.indexOf('Warm up') > at('Free practice') && h.indexOf('Warm up') < at('Race by laps or distance') && h.indexOf('Friday') > at('Race by laps or distance') && h.indexOf('Sprint') > at('Race by laps or distance') && h.indexOf('Friday') < at('Other') && h.indexOf('Old style') > at('Other'); })());
    say('the session type is the folder, so the list does not repeat it as a column; the others stay', !sm().includes('<th>Session type</th>') && sm().includes('<th>Name</th>') && sm().includes('<th>Laps / time</th>') && sm().includes('10 laps'));
    say('the folders are open to start, with Open all and Close all above them', opens() === 3 && sm().includes('data-folderall="1"') && sm().includes('data-folderall="0"') && ['setups:practice','setups:race','setups:_other'].every(k => sm().includes(`data-folder="${k}"`)));
    const allS = v => E('setupmgr').onclick({ target: { closest: sel => sel === 'button' ? { id: '', dataset: { folderall: v } } : null } });
    await allS('0'); await new Promise(r => setTimeout(r, 20)); say('Close all closes the folders of the setups', opens() === 0 && folders_().length === 3);
    await allS('1'); await new Promise(r => setTimeout(r, 20)); say('...and Open all opens them again', opens() === 3);
    { const mine = [{ dataset: { folder: 'setups:race' }, open: true }]; E('setupmgr').querySelectorAll = sel => sel === 'details.dbfolder' ? mine : [];
      run("state.tab='setup'"); await run('render()'); mine[0].open = false; mine[0].ontoggle(); await run('render()');
      say('a folder you close stays closed when the page is drawn again, the others stay open', opens() === 2 && /data-folder="setups:race"><summary>/.test(sm()) && /data-folder="setups:practice" open>/.test(sm()));
      E('setupmgr').querySelectorAll = () => [mk(), mk(), mk()]; }
    say('the folders of Results and of Race Setups do not share their state (the same key would close both)', run("folderKey('results','tracks') !== folderKey('setups','tracks')"));
    run('folderClosed.clear()');
    await E('setupmgr').onclick({ target: { closest: () => ({ id: 'vgrid', dataset: {} }) } }); await new Promise(r => setTimeout(r, 20));
    say('in the grid the cards sit in the same folders, and a card does not repeat the session type', titles().join('|') === 'Free practice|Race by laps or distance|Other' && (sm().match(/class="gcard"/g) || []).length === 4 && !/<span class="muted">Session type<\/span>/.test(sm()) && sm().includes('10 laps'));
    await E('setupmgr').onclick({ target: { closest: () => ({ id: 'vlist', dataset: {} }) } }); await new Promise(r => setTimeout(r, 20));
    store.racesetups = [{id:'r1',name:'Friday',sessionType:'race',track:'t1',laps:10},{id:'r2',name:'Sprint',sessionType:'race',track:'t1',laps:5}];
    run("state.tab='setup'"); await run('render()');
    say('with setups of one session type there is one folder and no Open all / Close all (nothing to open or close all of)', titles().join('|') === 'Race by laps or distance' && !sm().includes('data-folderall'));
    store.racesetups = []; run("state.tab='setup'"); await run('render()');
    say('without any setups there are no folders, only the sentence that says so', !sm().includes('dbfolder') && sm().includes('No race setups yet'));
    store.racesetups = keepSetups; store.tracks = keepTracks; run('folderClosed.clear()'); run("state.tab='setup'"); await run('render()'); }
  { const css = fs.readFileSync(R + 'renderer/styles.css', 'utf8'), rule = re => re.test(css);
    say('the folders of the lists have the look of the groups of the forms: the same shared rules (bar, tinted header, chevron, closed header round, focus)', rule(/\.fgroup,\.audgroup,\.dbfolder,\.audhelp\{[^}]*border-left:4px solid var\(--accent\)/) && rule(/\.fgroup>summary,\.audgroup>summary,\.dbfolder>summary,\.audhelp>summary\{/) && rule(/\.dbfolder>summary::before/) && rule(/\.dbfolder\[open\]>summary::before/) && rule(/\.dbfolder:not\(\[open\]\)>summary/) && rule(/\.dbfolder>summary:focus-visible/) && rule(/\.dbfolder>summary::-webkit-details-marker/));
    say('the tables sit in a folder without a box of their own (in a narrow window they scroll sideways, their cells do not wrap), and the sessions are rows told apart by a line', rule(/\.dbfolder \.fields\{border:0/) && rule(/\.dbfolder>\.wrap td,\.dbfolder>\.wrap th\{white-space:nowrap\}/) && rule(/\.dbfolder>\.card\.sess\{[^}]*border:0;border-top:1px solid var\(--line\)/) && rule(/\.dbfolder>\.card\.sess:first-of-type\{border-top:0\}/) && rule(/\.sess>summary::-webkit-details-marker\{display:none\}/)); }
  // ---- batch E: fuel in the race setup and the Fuel widget settings ----
  run("state.sub='tracks'; state.tab='setup'; state.setupSub='setups'"); await run('render()');
  run("state.refs.fuelrules=[{id:'fr1',name:'Std'}]; openForm('racesetups', null)");
  say('the setup form has the fuel rules choice and the pit hold time (the fuel settings moved to Fuel rules)', ['f-fuelRules','f-pitHold'].every(id => E('dlg').innerHTML.includes('id="'+id+'"')) && !E('dlg').innerHTML.includes('id="f-fuelTank"'));
  run("state.setupSub='fuel'"); await run('render()');
  say('Race Setup has a Fuel Setups sub-tab', E('setuptabs').innerHTML.includes('Fuel Setups') && E('setupmgr').innerHTML.includes('id="add"'));
  run("openForm('fuelrules', null)");
  say('the fuel rule form: tank, litres per lap, target lap, extra and saving limits, empty-tank choices, refuel speed', ['f-tank','f-perLap','f-targetLap','f-maxExtra','f-maxSaving','f-empty','f-rate'].every(id => E('dlg').innerHTML.includes('id="'+id+'"'))
    && ['retire','stop','warn'].every(v => E('dlg').innerHTML.includes('value="'+v+'"')));
  run("state.setupSub='setups'");
  run("document.getElementById('dlg').close && 0");
  await openEditor(); run("editorAdd('fuel')");
  const fs1 = E('side').innerHTML;
  say('Fuel widget settings: display mode, colour limits and colours, and no picture uploads of its own', ['mode','lowAt','lowColor','critAt','critColor','imageSet'].every(k => fs1.includes('data-opt="'+k+'"')) && fs1.includes('Bar and number') && fs1.includes('Pictures from the picture set') && !fs1.includes('data-optimglist') && !fs1.includes('data-opt="steps"'));
  E('side').oninput({target:{dataset:{opt:'mode'},type:'select-one',value:'images'}});
  say('the display mode is stored', run('state.editing.sel[0].opt.mode') === 'images');
  run("editorAdd('pitstop')"); say('Pitstop time widget can be added', run("state.editing.sel[0].type") === 'pitstop');
  run("state.editing.draft.widgets.splice(-2); state.editing.sel = []");
  // ---- batch F: text styling, layout note, car widgets in the editor ----
  await openEditor(); run("editorAdd('bestlap')");
  const sp = E('side').innerHTML;
  say('side panel: title bold, title takes space, value bold / italic', ['s-tbold','s-tspace','s-vbold','s-vital'].every(id => sp.includes('id="'+id+'"')) && /id="s-vbold" checked/.test(sp) && !/id="s-vital" checked/.test(sp) && !/id="s-tspace" checked/.test(sp));
  E('side').onchange({target:{id:'s-tbold',checked:true,dataset:{}}}); E('side').onchange({target:{id:'s-tspace',checked:true,dataset:{}}});
  E('side').onchange({target:{id:'s-vbold',checked:false,dataset:{}}}); E('side').onchange({target:{id:'s-vital',checked:true,dataset:{}}});
  say('the settings are stored on the widget', run('(w => w.titleBold === true && w.titleSpace === true && w.valueBold === false && w.valueItalic === true)(state.editing.sel[0])'));
  const cv = E('canvas').innerHTML;
  say('the editor shows them: title in bold, own row, value italic and normal weight', cv.includes('tspace') && cv.includes('font-weight:700') && cv.includes('font-style:italic') && cv.includes('font-weight:400'));
  run("editorAdd('carpicture')");
  say('slotcar picture widget has picture position settings and a slotcar preview note', E('side').innerHTML.includes('data-frame="frame"') && E('side').innerHTML.includes('slotcar'));
  { const hh=()=>E('side').innerHTML, sl=()=>run('state.editing.sel[0]');
    say('1.30.1: ...and a Mirror tick box (off to begin with), before the position and zoom', /id="o-carMirror" type="checkbox" data-opt="carMirror"(?! checked)/.test(hh()) && hh().includes('Mirror the picture (flip it left to right)') && hh().indexOf('data-opt="carMirror"')<hh().indexOf('data-frame="frame"'));
    E('side').oninput({ target: { id: 'o-carMirror', type: 'checkbox', checked: true, dataset: { opt: 'carMirror' } } });
    E('side').innerHTML = run('sideHtml()');
    say('...ticking it stores it in the widget (and shows it ticked)', sl().opt.carMirror===true && /id="o-carMirror" type="checkbox" data-opt="carMirror" checked/.test(hh()));
    E('side').oninput({ target: { id: 'o-carMirror', type: 'checkbox', checked: false, dataset: { opt: 'carMirror' } } });
    E('side').innerHTML = run('sideHtml()'); say('...and unticking it again', !sl().opt.carMirror && !/data-opt="carMirror" checked/.test(hh())); }
  // 1.8.0: the team widgets choose the team they show
  run("state.editing.teams = [{ id: 'T1', name: 'Red Bulls', picture: 'data:image/png;base64,AA' }, { id: 'T2', name: 'Blue <Moons>' }]");
  run("editorAdd('teamname')"); E('side').innerHTML = run('sideHtml()');
  { const sd = E('side').innerHTML;
    say('Team Name widget: a choice of the team to show (the team of the lane, or one of the teams of the database; a name is written safely)', run('state.editing.sel[0].type') === 'teamname' && sd.includes('data-opt="team"') && sd.includes('<option value="">The team of the lane</option>') && sd.includes('<option value="T1">Red Bulls</option>') && sd.includes('Blue &lt;Moons&gt;') && sd.includes('Choose a team from the database to always show that team'));
    E('side').oninput({ target: { dataset: { opt: 'team' }, type: 'select-one', value: 'T2' } });
    say('...the choice is stored on the widget, and shows as selected', run('state.editing.sel[0].opt.team') === 'T2' && (E('side').innerHTML = run('sideHtml()'), E('side').innerHTML.includes('<option value="T2" selected>')));
    run("editorAdd('teampicture')"); E('side').innerHTML = run('sideHtml()');
    say('Team Picture widget: the same choice, and the picture position and zoom with a team preview', E('side').innerHTML.includes('data-opt="team"') && E('side').innerHTML.includes('data-frame="frame"') && E('side').innerHTML.includes('class="framezoom"') && E('side').innerHTML.includes('data:image/png;base64,AA'));
    run("state.editing.teams = [{ id: 'T2', name: 'Blue' }]"); E('side').innerHTML = run('sideHtml()');
    say('...without a team that has a picture the preview says so (a team, not a driver)', E('side').innerHTML.includes('Add a team with a picture to see a preview'));
    say('the palette lists the Team widgets in a folder of their own (the team, and for an Endurance Race the driver at the wheel, the next driver, the swap timer and the swap signal)', run('Widgets.REGISTRY.filter(d => d.group === "Team").map(d => d.type).join()') === 'teamname,teampicture,currentdriver,nextdriver,swaptimer,swapsignal');
    run("state.editing.draft.widgets.splice(-2); state.editing.sel = []"); }
  run("editorAdd('carname')"); say('slotcar name widget can be added', run('state.editing.sel[0].type') === 'carname');
  run("state.editing.customWidgets=[{id:'cw1',name:'Best lap line',type:'textlane',text:'{name}: {best}',w:320,h:70,textSize:44,valueBold:false,valueItalic:true}]"); run('renderEditor()'); await new Promise(r=>setTimeout(r,20));
  say('saved widgets are listed in the Custom folder of the Layout Editor', run('view.innerHTML').includes('data-pal="Custom"') && run('view.innerHTML').includes('data-addcw="cw1"'));
  run("editorAddCustom('cw1')");
  say('adding a saved widget puts a copy with its text, size and look in the layout', run("(g=>g.type==='textlane'&&g.opt.text==='{name}: {best}'&&g.w===320&&g.textSize===44&&g.valueItalic===true&&g.valueBold===false&&g.title==='Best lap line'&&g.showTitle===false)(state.editing.sel[0])"));
  say('the Layout Editor list no longer offers the old custom text widgets', run("view.innerHTML").includes('data-add="clock"') && !run("view.innerHTML").includes('data-add="textlane"') && !run("view.innerHTML").includes('data-add="textrace"'));
  run("editorAdd('textlane')");
  say('a custom text widget (as made by the Widget Builder) has a text setting with its default, and starts without a title', run('state.editing.sel[0].type') === 'textlane' && E('side').innerHTML.includes('data-opt="text"') && E('side').innerHTML.includes('{position}. {name}') && run('state.editing.sel[0].showTitle') === false);
  say('the palette has a Slotcar group', E('canvas') && true && run("Widgets.REGISTRY.some(x => x.group === 'Slotcar')"));
  E('e-note').oninput({target:{value:'For the 4 lane track'}});
  say('layout note is kept in the draft', run('state.editing.draft.note') === 'For the 4 lane track');
  const addCallsN = calls.length; await run('editorSave()');
  const savedLayout = calls.slice(addCallsN).find(c => c[0] === 'add' && c[1] === 'layouts');
  say('...and saved with the layout', savedLayout && savedLayout[2].note === 'For the 4 lane track');
  run("state.editing=null; state.tab='custom'; state.customSub='layouts'"); await run('render()');
  say('layout list shows the note next to the layout (the default layout has one too)', E('setupbox').innerHTML.includes('<th>Note</th>') && E('setupbox').innerHTML.includes('For the 4 lane track') && E('setupbox').innerHTML.includes('Built in, used when a race setup has none'));
  // ---- batch G: track length calculator and car picture gallery ----
  run("state.tab='database'; state.sub='tracks'"); await run('render()');
  run("openForm('tracks', null)");
  const tf = E('dlg').innerHTML;
  say('track form: length in metres with a calculator button', tf.includes('id="f-length"') && tf.includes('metres') && tf.includes('data-calcopen="1"') && tf.includes('data-calcuse="1"'));
  const click = (dataset) => E('dlg').onclick({target:{closest:()=>({dataset})}});
  click({calcopen:'1'});
  E('dlg').oninput({target:{classList:{},dataset:{i:'0'},className:'calc-count',value:'65'}});
  say('calculator: 65 pieces x 200 mm = 13 m', E('calc-total').textContent === '13 m');
  click({calcadd:'1'}); E('dlg').oninput({target:{classList:{},dataset:{i:'1'},className:'calc-count',value:'10'}}); E('dlg').oninput({target:{classList:{},dataset:{i:'1'},className:'calc-mm',value:'350'}});
  say('calculator: a second kind of piece adds to the total', E('calc-total').textContent === '16.5 m');
  click({calcdel:'1'});
  say('calculator: removing a row takes it off the total', E('calc-total').textContent === '13 m');
  click({calcuse:'1'});
  say('"Use this length" fills the length box', E('f-length').value === 13);
  document.getElementById('f-name').value='Big track'; document.getElementById('f-lanes').value='4';
  let n0 = calls.length; await E('frm').onsubmit({preventDefault(){}});
  let addT = calls.slice(n0).find(c => c[0]==='add' && c[1]==='tracks');
  say('the track is saved with its length in metres and the pieces behind it', addT && addT[2].length === 13 && JSON.stringify(addT[2].lengthPieces) === '[{"count":65,"mm":200}]');
  run("openForm('tracks', null)"); click({calcopen:'1'});
  document.getElementById('f-name').value='Manual'; document.getElementById('f-length').value='9.5';
  E('dlg').oninput({target:{classList:{},dataset:{i:'0'},className:'calc-count',value:'65'}});
  n0 = calls.length; await E('frm').onsubmit({preventDefault(){}});
  addT = calls.slice(n0).find(c => c[0]==='add' && c[1]==='tracks');
  say('a length typed by hand that differs from the calculator keeps no pieces', addT && addT[2].length === 9.5 && addT[2].lengthPieces.length === 0);
  run(`openForm('tracks', ${JSON.stringify({id:'tx',name:'Old',length:'12,5 m'})})`);
  say('an older text length is read as metres', E('f-length') && E('dlg').innerHTML.includes('value="12.5"'));
  run("document.getElementById('dlg').close()");

  // ---- 1.27.0: the track form in feet and inches (what is kept stays in metres and millimetres) ----
  { const trk = { id: 'ft1', name: 'Basement', lanes: 3, length: 12.35, laneModifier: 'measured', laneLengths: '11.55, 12.08,12.5', laneSpacing: 100, lengthPieces: [{ count: 50, mm: 247 }] }; // (numbers that do not come back when they go through feet and back: 11.55 m is 37.89 ft is 11.549 m, 100 mm is 3.94 in is 100.08 mm)
    const sch = run('state.schema.tracks.fields'), fld = k => sch.find(f => f.key === k);
    store.tracks.push(JSON.parse(JSON.stringify(trk))); // (the form of an old track saves with update: the stand-in for the database needs the track)
    const saved = n => { const c = calls.slice(n).find(c => c[1] === 'tracks' && (c[0] === 'add' || c[0] === 'update')); return c ? (c[0] === 'add' ? c[2] : c[3]) : null; };
    say('1.27.0: the schema marks the three fields that hold a length (the track length and the lane lengths in metres, the lane spacing in millimetres), each with its words for feet and inches', fld('length').unit === 'm' && fld('laneLengths').unit === 'm' && fld('laneSpacing').unit === 'mm' && fld('length').labelFt === 'Track length (feet)' && fld('laneLengths').labelFt === 'Length of every lane (feet), lane 1 first' && /inches, centre to centre/.test(fld('laneSpacing').labelFt) && /50\.5, 51\.8, 53\.1/.test(fld('laneLengths').hintFt) && /4 inches/.test(fld('laneSpacing').hintFt) && sch.filter(f => f.unit).length === 3);
    run("openForm('tracks', " + JSON.stringify(trk) + ")"); await new Promise(r => setTimeout(r, 20)); const fm = E('dlg').innerHTML;
    say('in metres the form is as it was: metres in the labels, the saved numbers, nothing to convert back', fm.includes('Track length (metres)') && fm.includes('value="12.35"') && fm.includes('value="11.55, 12.08,12.5"') && fm.includes('value="100"') && !fm.includes('data-du') && !fm.includes('data-shown') && fm.includes('> <span>metres</span>') && fm.includes('Length of one piece in millimetres') && fm.includes('<strong id="calc-total">12.35 m</strong>'));
    run("document.getElementById('dlg').close()");
    run("state.settings.distanceUnit='ft'");
    run("openForm('tracks', " + JSON.stringify(trk) + ")"); await new Promise(r => setTimeout(r, 20)); const ff = E('dlg').innerHTML;
    say('with feet and miles the form asks for feet: the labels say feet and inches, and the numbers shown are the saved metres in feet (12.35 m is 40.52 ft, 100 mm is 3.94 in)', ff.includes('Track length (feet)') && !ff.includes('Track length (metres)') && ff.includes('Length of every lane (feet), lane 1 first') && ff.includes('Distance between the lanes (inches, centre to centre)') && !ff.includes('millimetres, centre') && ff.includes('<span>feet</span>') && !ff.includes('<span>metres</span>'));
    say('...the numbers: the length 40.52, the lanes 37.89, 39.63, 41.01 and the spacing 3.94, each with the text that is shown and the exact saved number behind it', /id="f-length"[^>]*value="40.52" data-du="ft" data-shown="40.52" data-keep="12.35"/.test(ff) && /id="f-laneLengths"[^>]*value="37.89, 39.63, 41.01" data-du="ft" data-shown="37.89, 39.63, 41.01" data-keep="11.55, 12.08,12.5"/.test(ff) && /id="f-laneSpacing"[^>]*value="3.94" data-du="ft" data-shown="3.94" data-keep="100"/.test(ff));
    say('...the hints talk feet too, the calculator takes inches (247 mm is 9.72 in) and its total is in feet (12.35 m is 40.5 ft)', ff.includes('50.5, 51.8, 53.1') && !ff.includes('for example 15.4, 15.8, 16.2') && ff.includes('4 inches gives about 2 feet shorter') && ff.includes('Length of one piece in inches') && /class="calc-mm"[^>]*value="9.72"/.test(ff) && /<\/strong>|> in <button/.test(ff) && ff.includes('<strong id="calc-total">40.5 ft</strong>'));
    const setf = () => { const el = k => document.getElementById('f-' + k), at = (k, shown, keep) => { el(k).dataset = { du: 'ft', shown, keep }; };
      el('name').value = 'Basement'; el('lanes').value = '3'; el('laneModifier').value = 'measured';
      el('length').value = '40.52'; at('length', '40.52', '12.35'); el('laneLengths').value = '37.89, 39.63, 41.01'; at('laneLengths', '37.89, 39.63, 41.01', '11.55, 12.08,12.5'); el('laneSpacing').value = '3.94'; at('laneSpacing', '3.94', '100'); };
    setf(); let n1 = calls.length; await E('frm').onsubmit({ preventDefault() {} }); const g = saved(n1);
    say('saving without touching a number gives back exactly what was saved (12.35, "11.55, 12.08,12.5" as it was written, 100, the pieces): the feet that are shown are rounded, the metres must not drift', g && g.length === 12.35 && g.laneLengths === '11.55, 12.08,12.5' && g.laneSpacing === 100 && JSON.stringify(g.lengthPieces) === '[{"count":50,"mm":247}]');
    run("openForm('tracks', " + JSON.stringify(trk) + ")"); await new Promise(r => setTimeout(r, 20)); setf();
    document.getElementById('f-length').value = '50'; document.getElementById('f-laneLengths').value = '37.89, 40, 41.01'; document.getElementById('f-laneSpacing').value = '4';
    n1 = calls.length; await E('frm').onsubmit({ preventDefault() {} }); const g2 = saved(n1);
    say('a number that is changed is typed in feet and kept in metres: 50 ft is 15.24 m, 4 in is 101.6 mm, and of the lanes only the one that was changed (40 ft is 12.192 m): the others stay exactly as saved', g2 && g2.length === 15.24 && g2.laneLengths === '11.55, 12.192, 12.5' && g2.laneSpacing === 101.6);
    say('...the pieces do not add up to the new length any more, so none are kept', g2 && JSON.stringify(g2.lengthPieces) === '[]');
    run("openForm('tracks', " + JSON.stringify({ ...trk, lengthPieces: [] }) + ")"); await new Promise(r => setTimeout(r, 20)); setf(); click({ calcopen: '1' });
    E('dlg').oninput({ target: { classList: {}, dataset: { i: '0' }, className: 'calc-count', value: '60' } }); E('dlg').oninput({ target: { classList: {}, dataset: { i: '0' }, className: 'calc-mm', value: '8' } });
    say('the calculator in inches: 60 pieces of 8 in (203.2 mm) are 12.192 m, and the total says 40 ft', E('calc-total').textContent === '40 ft');
    click({ calcadd: '1' }); say('...a new row starts with the length of the one above it (8 in), and the total does not change', E('calc-total').textContent === '40 ft' && (E('calc-rows').innerHTML.match(/class="calc-mm"[^>]*value="8"/g) || []).length === 2); click({ calcdel: '1' });
    click({ calcuse: '1' });
    say('"Use this length" fills the length box in feet (40) and remembers the exact metres', E('f-length').value === 40 && E('f-length').dataset.shown === '40' && E('f-length').dataset.keep === '12.192' && E('f-length').dataset.du === 'ft');
    n1 = calls.length; await E('frm').onsubmit({ preventDefault() {} }); const g3 = saved(n1);
    say('...and the track is saved with 12.192 m and the pieces behind it (60 x 203.2 mm), as they add up exactly', g3 && g3.length === 12.192 && JSON.stringify(g3.lengthPieces) === '[{"count":60,"mm":203.2}]');
    say('a length that is not a number in the list of lanes is still refused when it is typed in feet', await (async () => { run("openForm('tracks', " + JSON.stringify(trk) + ")"); await new Promise(r => setTimeout(r, 20)); setf(); document.getElementById('f-laneLengths').value = '37.73, x, 41.01'; const n2 = calls.length; await E('frm').onsubmit({ preventDefault() {} }); return !calls.slice(n2).some(c => c[1] === 'tracks') && /numbers separated by commas/.test(E('err').textContent); })());
    run("document.getElementById('dlg').close()");
    const C = (f, v) => run('cell(' + JSON.stringify(f) + ', ' + JSON.stringify(v) + ')');
    say('in lists and cards a length is written in feet: the track length 39.4 ft, the lanes 37.73, 39.37, the spacing 3.94; an old text length stays as it was typed', C({ type: 'tracklength' }, 12) === '39.4 ft' && C({ type: 'numberlist', unit: 'm' }, '11.5, 12') === '37.73, 39.37' && C({ type: 'number', unit: 'mm' }, 100) === '3.94' && C({ type: 'tracklength' }, '12,5 m') === '12,5 m' && C({ type: 'number' }, 100) === '100' && C({ type: 'tracklength' }, '') === '');
    say('...and the column headers and card rows use the words for feet (the label of the field in feet)', run("fl({ label: 'Track length (metres)', labelFt: 'Track length (feet)' })") === 'Track length (feet)' && run("fl({ label: 'Name' })") === 'Name');
    run("delete state.settings.distanceUnit"); store.tracks = store.tracks.filter(t => t.id !== 'ft1');
    say('back in metres everything is as it was (12 m, the metres in the labels)', C({ type: 'tracklength' }, 12) === '12 m' && C({ type: 'numberlist', unit: 'm' }, '11.5, 12') === '11.5, 12' && C({ type: 'number', unit: 'mm' }, 100) === '100' && run("fl({ label: 'Track length (metres)', labelFt: 'Track length (feet)' })") === 'Track length (metres)' && run("fh({ hint: 'a', hintFt: 'b' })") === 'a'); }

  const carItem = {id:'cx',brand:'NSR',manufacturer:'Ford',model:'GT40',picture:'data:main',pictureFrame:{zoom:2,x:1,y:0},extraPictures:['data:a','data:b','data:c']};
  store.slotcars.push(JSON.parse(JSON.stringify(carItem)));
  run(`openForm('slotcars', ${JSON.stringify(carItem)})`);
  say('car form: main picture plus a gallery of more pictures', E('dlg').innerHTML.includes('Main picture') && E('dlg').innerHTML.includes('id="f-extraPictures"') && E('dlg').innerHTML.includes('multiple'));
  say('...the gallery lists the extra pictures with Make main / Remove', ['data:a','data:b','data:c'].every(x => E('gal-box').innerHTML.includes(x)) && E('gal-box').innerHTML.includes('data-galmain="0"') && E('gal-box').innerHTML.includes('data-galdel="2"'));
  click({galview:'1'}); say('clicking a thumbnail shows it larger', E('gal-box').innerHTML.includes('class="galbig" src="data:b"'));
  click({galdel:'2'}); click({galmain:'0'});
  document.getElementById('f-brand').value='NSR';
  n0 = calls.length; await E('frm').onsubmit({preventDefault(){}});
  const upC = calls.slice(n0).find(c => c[0]==='update' && c[1]==='slotcars' && c[2]==='cx');
  say('making a picture the main one swaps it with the old main picture', upC && upC[3].picture === 'data:a' && JSON.stringify(upC[3].extraPictures) === '["data:main","data:b"]' && upC[3].pictureFrame.zoom === 1);
  run("resizeImage = async () => 'data:new'");
  run(`openForm('slotcars', ${JSON.stringify({id:'cy',brand:'X',picture:'',extraPictures:[]})})`);
  await E('dlg').onchange({target:{dataset:{gallery:'1'},files:Array.from({length:15},()=>({})),value:'x',id:'f-extraPictures',type:'file'}});
  say('at most 12 extra pictures are kept', (E('gal-box').innerHTML.match(/data-galdel=/g) || []).length === 12);
  click({galmain:'0'});
  say('with no main picture yet, a gallery picture simply becomes the main one', (E('gal-box').innerHTML.match(/data-galdel=/g) || []).length === 11);
  run("document.getElementById('dlg').close()");

  Object.assign(store, { slotcars: [{id:'cx',brand:'NSR',manufacturer:'Ford',model:'GT40',picture:'data:main',extraPictures:['data:a','data:b']}] });
  run("state.settings.dbView='grid'; state.tab='database'; state.sub='slotcars'"); await run('render()');
  say('grid card says how many more pictures a car has', E('subview').innerHTML.includes('+2 more pictures'));
  run("state.settings.dbView='list'"); await run('render()');
  say('list shows the number of extra pictures', E('subview').innerHTML.includes('2 more'));
  Object.assign(store, { tracks: [{id:'t9',name:'Big',lanes:4,length:13}] });
  run("state.sub='tracks'"); await run('render()');
  say('track list shows the length in metres', E('subview').innerHTML.includes('13 m'));
  await openEditor(); run("editorAdd('speed')");
  say('Speed widget settings: scaled or real, unit, lap, show unit', ['mode','unit','source','showUnit'].every(k => E('side').innerHTML.includes('data-opt="'+k+'"')) && E('side').innerHTML.includes('Scaled speed') && E('side').innerHTML.includes('Miles per hour'));
  run("state.editing.draft.widgets.pop(); state.editing.sel = []");
  // ---- Home: clearing the qualifying result ----
  store.racesetups[0].track='t9'; store.drivers.push({id:'qd1',name:'Quinn'}); store.sessions.push({id:'qs1',sessionType:'qualifying',trackId:'t9',date:'2026-10-01T10:00:00Z',standings:[{driverId:'qd1',driverName:'Quinn'}]});
  run("state.editing=null; state.tab='home'; state.settings.lastSetupId='r1'; state.settings.qualCleared={}"); await run('render()');
  say('Home names the qualifying winner and offers to clear it', E('view').innerHTML.includes('Quinn won the latest qualifying') && E('view').innerHTML.includes('id="clearqual"'));
  const nQ=calls.length; await E('view').onclick({target:{closest:()=>({id:'clearqual',dataset:{}})}}); await new Promise(r=>setTimeout(r,30));
  say('clearing saves which result was cleared', calls.slice(nQ).some(c=>c[0]==='settings'&&c[1].qualCleared&&c[1].qualCleared.t9==='qs1'));
  say('...and the winner and lane choice are gone from Home', !E('view').innerHTML.includes('latest qualifying') && !E('view').innerHTML.includes('id="winlane"'));
  store.sessions.push({id:'qs2',sessionType:'qualifying',trackId:'t9',date:'2026-10-02T10:00:00Z',standings:[{driverId:'qd1',driverName:'Quinn'}]}); await run('render()');
  say('a newer qualifying brings the winner back', E('view').innerHTML.includes('Quinn won the latest qualifying'));
  // ---- App Settings > Timing Hardware ----
  run("state.tab='settings'; state.settingsSub='hardware'"); await run('render()');
  say('Timing Hardware sub-tab: find buttons, speed, connect, send, copy/save/clear and the log', ['hw-serial','hw-hid','hw-baud','hw-init','hw-lanes','hw-hide','hw-conn','hw-send','hw-copy','hw-save','hw-clear','hw-log'].every(i=>E('hwbox').innerHTML.includes('id="'+i+'"')) && E('hwbox').innerHTML.includes('No device chosen'));
  say('Timing Hardware has sub-tabs: Trackmate Interface, DS Electronics and Other', E('hwtabs').innerHTML.includes('Trackmate Interface') && E('hwtabs').innerHTML.includes('DS Electronics') && E('hwtabs').innerHTML.includes('>Other<') && E('settingstabs').innerHTML.includes('Timing Hardware'));
  say('remember/auto-connect is on by default and setup values are shown', E('hwbox').innerHTML.includes('id="hw-auto" checked') && E('hwbox').innerHTML.includes('id="hw-lanes" min="1" max="8" value="2"'));
  const nH=calls.length; await E('hw-nc').onchange({target:{value:'0'}}); await E('hw-deb').onchange({target:{value:'3'}}); await E('hw-auto').onchange({target:{checked:false}});
  say('the power relay type can be chosen', E('hwbox').innerHTML.includes('id="hw-relay"'));
  say('each sensor has a lane choice', E('hwbox').innerHTML.includes('data-sensor="0"') && E('hwbox').innerHTML.includes('data-sensor="1"'));
  { const h=E('hwbox').innerHTML, has=i=>h.includes('data-sensor="'+i+'"') && h.includes('id="hw-led-'+i+'"');
    say('all eight sensors (A to H) are listed, each with a check light', [0,1,2,3,4,5,6,7].every(has) && h.includes('Sensor 8 (H)') && h.includes('Sensor 1 (A)'));
    say('with Lanes at 2 only the first two are in use: the other six are dimmed and cannot be changed', (h.match(/class="sens"/g)||[]).length===2 && (h.match(/class="sens off"/g)||[]).length===6 && (h.match(/data-sensor="\d" aria-label="Lane of sensor \d" disabled/g)||[]).length===6 && h.includes('Switched off: Lanes above is 2'));
    say('...the two in use can swap between the two lanes, not more', /data-sensor="0"[^>]*><option value="0" selected>Lane 1<\/option><option value="1">Lane 2<\/option><\/select>/.test(h));
    say('the lights start off', (h.match(/class="led"/g)||[]).length===8 && !h.includes('class="led on"')); }
  // the check lights: green while a sensor sends letters
  { const rec={}, label={}; for(let i=0;i<8;i++){ const el=E('hw-led-'+i); rec[i]=[]; el.classList={toggle:(c,v)=>rec[i].push(v),add(){},remove(){}}; el.setAttribute=(k,v)=>{ if(k==='aria-label') label[i]=v; }; }
    // A fake clock and timer queue stand in for real time, so the one-second hold never depends on how busy the computer is.
    run(`globalThis.__real = { performance, setTimeout, clearTimeout }; globalThis.__T = { now: 100000, q: [], id: 0 };
      performance = { now: () => __T.now };
      setTimeout = (f, ms) => { const id = ++__T.id; __T.q.push({ id, at: __T.now + (ms || 0), f }); return id; };
      clearTimeout = id => { __T.q = __T.q.filter(e => e.id !== id); };
      globalThis.__adv = ms => { const end = __T.now + ms; for (;;) { const due = __T.q.filter(e => e.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; __T.q = __T.q.filter(e => e !== due); __T.now = Math.max(__T.now, due.at); due.f(); } __T.now = end; };
      hw.lit = Array(8).fill(null); hw.ledTimers = [];`);
    try {
      run("tmReceive(Uint8Array.of(66))"); // B = sensor 2
      say('a letter from a sensor turns its own light green (B is sensor 2) and no other', rec[1].at(-1)===true && [0,2,3,4,5,6,7].every(i=>!rec[i].includes(true)) && label[1]==='Sensor 2: triggered');
      run("tmReceive(Uint8Array.of(65, 72, 67, 68, 69, 70, 71))");
      say('A to H light sensors 1 to 8', [0,1,2,3,4,5,6,7].every(i=>rec[i].at(-1)===true) && label[7]==='Sensor 8: triggered');
      run("__adv(950)");
      say('the lights are still on just before the second is over', [0,1,2,3,4,5,6,7].every(i=>rec[i].at(-1)===true));
      run("__adv(150)");
      say('a light goes out about a second after its last letter', [0,1,2,3,4,5,6,7].every(i=>rec[i].at(-1)===false) && label[0]==='Sensor 1: not triggered');
      run("tmReceive(Uint8Array.of(67)); __adv(700); tmReceive(Uint8Array.of(67)); __adv(700)");
      say('a car that stays over a sensor keeps its light on (every new letter starts the second again)', rec[2].at(-1)===true);
      run("__adv(450)");
      say('...and it goes out after the car has gone', rec[2].at(-1)===false);
      const seen = [0,1,2,3,4,5,6,7].map(i => rec[i].length);
      run("tmReceive(Uint8Array.of(87, 49, 50, 13)); __adv(2000)");
      say('the Trackcall button or a time message lights nothing', [0,1,2,3,4,5,6,7].every(i => !rec[i].slice(seen[i]).includes(true)) && [0,1,2,3,4,5,6,7].every(i => rec[i].at(-1)===false));
    } finally { run("performance = __real.performance; setTimeout = __real.setTimeout; clearTimeout = __real.clearTimeout; hw.lit = Array(8).fill(null); hw.ledTimers = []"); } }
  { // Lanes at 8: all sensors in use
    run("state.settings.tmLanes=8; renderHardwareSettings(document.getElementById('hwbox'))"); const h=E('hwbox').innerHTML;
    say('with Lanes at 8 no sensor is dimmed and each can take any of the eight lanes', (h.match(/class="sens"/g)||[]).length===8 && !h.includes('sens off') && !/data-sensor="\d" aria-label="Lane of sensor \d" disabled/.test(h) && /data-sensor="7"[^>]*>(<option value="\d"( selected)?>Lane \d<\/option>){8}<\/select>/.test(h));
    run("state.settings.tmLanes=2");
  }
  { // changing Lanes while connected tells the Trackmate at once
    run("globalThis.__sent=[]; hw.open=true; hw.kind='serial'; hw.writer={write:async b=>{ globalThis.__sent.push(Array.from(b).map(c=>String.fromCharCode(c)).join('').replace(/\\s+$/,'')); }}");
    await withMerge(async()=>{ await E('hw-lanes').onchange({target:{value:'8'}}); });
    say('changing Lanes while connected sends the new setup (A8) to the Trackmate', run('globalThis.__sent').includes('A8') && run('state.settings.tmLanes')===8);
    say('...and shows all eight sensors in use', !E('hwbox').innerHTML.includes('sens off'));
    run("globalThis.__sent=[]; hw.open=false; state.settings.tmLanes=2");
    await withMerge(async()=>{ await E('hw-lanes').onchange({target:{value:'4'}}); });
    say('when no Trackmate is connected, changing Lanes only saves it', run('globalThis.__sent').length===0 && run('state.settings.tmLanes')===4);
    run("state.settings.tmLanes=2; hw.kind=''; hw.writer=null; renderHardwareSettings(document.getElementById('hwbox'))"); }
  const nM=calls.length; await E('hwbox').onchange({target:{dataset:{sensor:'0'},value:'1'}});
  say('choosing lane 2 for sensor 1 swaps the two sensors and saves it', calls.slice(nM).some(c=>c[0]==='settings'&&c[1].tmLaneMap&&c[1].tmLaneMap.slice(0,2).join()==='1,0'));
  say('sensor type, debounce and auto-connect are saved as settings', calls.slice(nH).some(c=>c[0]==='settings'&&c[1].tmNC===false) && calls.slice(nH).some(c=>c[0]==='settings'&&c[1].tmDeb===3) && calls.slice(nH).some(c=>c[0]==='settings'&&c[1].tmAuto===false));
  say('...and Connect waits until a device is chosen', E('hwbox').innerHTML.includes('id="hw-conn" disabled'));
  // ---- App Settings > Timing Hardware > Arduino (1.37.0): the SlotForge box ----
  { const t = E('hwtabs').innerHTML, at = k => t.indexOf(k);
    say('1.37.0: the Timing Hardware sub-tabs are Trackmate Interface, Arduino, DS Electronics, Other (in this order)', at('Trackmate Interface') > -1 && at('Trackmate Interface') < at('>Arduino<') && at('>Arduino<') < at('DS Electronics') && at('DS Electronics') < at('>Other<'));
    run("state.hwSub='arduino'; state.settings.abVirtual=false"); await run('render()'); const html = () => E('hwbox').innerHTML, wait = ms => new Promise(r => setTimeout(r, ms));
    say('the Arduino page has Find the box, Connect, the virtual box, the sketch download, Calibrate, the lights test, Power on and off, Beep and Save to the box', ['ab-find', 'ab-conn', 'ab-virtual', 'ab-download', 'ab-calib', 'ab-lighttest', 'ab-pon', 'ab-poff', 'ab-beep', 'ab-save', 'ab-log'].every(i => html().includes(`id="${i}"`)) && html().includes('Find the box') && html().includes('Download the Arduino sketch (' + run('ArduinoSketch.version') + ')'));
    say('...nothing is connected yet, so the box commands are switched off, and without COM port support (a browser) it says so', /id="ab-calib" disabled/.test(html()) && /id="ab-save" disabled/.test(html()) && /id="ab-find" disabled/.test(html()));
    say('...the pin table has the roles Not used, Lane sensor, Pit sensor and Call buttons for every analog pin', html().includes('data-pinrole="0"') && html().includes('data-pinrole="7"') && ['Not used', 'Lane sensor', 'Pit sensor', 'Call buttons (ladder)'].every(r => html().includes('>' + r + '<')));
    // 1.38.1: in the app the main process lists the COM ports and asks the page to show them; the Arduino page had no list to show, so "Find the box" could never choose a port
    { let ask = null; const picked = []; api.onHwChoose = f => { ask = f; }; api.hwChosen = id => picked.push(id); await run('render()');
      say('1.38.1: the Arduino page waits for the port list of the main process (like the Trackmate and DS Electronics pages)', typeof ask === 'function' && html().includes('id="ab-pick"'));
      let done = ask('serial', [{ displayName: 'Arduino Nano', portName: 'COM5', portId: 'p5', vendorId: 0x1a86, productId: 0x7523 }, { displayName: 'Communications Port', portName: 'COM1', portId: 'p1' }]); await wait(5);
      say('...the ports found are shown, with their USB numbers when they have them, and a Cancel', E('ab-pick').innerHTML.includes('Arduino Nano') && E('ab-pick').innerHTML.includes('COM5') && E('ab-pick').innerHTML.includes('(1A86:7523)') && E('ab-pick').innerHTML.includes('data-pick="1"') && E('ab-pick').innerHTML.includes('data-pick="-1"'));
      run('abRedraw()'); await wait(5); // (the page is drawn again while the list is open: a message from the box does that)
      say('...a redraw of the page does not lose the list', E('ab-pick').innerHTML.includes('Arduino Nano'));
      E('ab-pick').onclick({ target: { closest: () => ({ dataset: { pick: '0' } }) } }); const got = await done; await wait(5);
      say('...the chosen port goes back to the main process and the list goes away', got === undefined && picked.join() === 'p5' && E('ab-pick').innerHTML === '');
      done = ask('serial', []); await wait(5); say('...with no ports the page says so', E('ab-pick').innerHTML.includes('No ports found'));
      E('ab-pick').onclick({ target: { closest: () => ({ dataset: { pick: '-1' } }) } }); await done; say('...Cancel sends an empty choice', picked.join() === 'p5,');
      const first = ask('serial', [{ portName: 'COM1', portId: 'p1' }]), second = ask('serial', [{ portName: 'COM2', portId: 'p2' }]); await wait(5); await first;
      say('...a second question drops the first one (it is answered empty) and shows the new list', picked.join() === 'p5,,' && E('ab-pick').innerHTML.includes('COM2') && !E('ab-pick').innerHTML.includes('COM1'));
      E('ab-pick').onclick({ target: { closest: () => ({ dataset: { pick: '-1' } }) } }); await second;
      run("state.hwSub='arduino'"); await run('render()'); delete api.onHwChoose; delete api.hwChosen; }
    ctx.ReadableStream = ReadableStream; ctx.WritableStream = WritableStream; // (the page of the app is in the browser, which has them; this stand-in page has to be given them)
    await E('ab-virtual').onchange({ target: { checked: true } }); await wait(150);
    say('the virtual box connects at once: the status line of the Arduino page says it is connected and the commands are switched on', run('abConnected()') === true && /id="ab-calib"(?! disabled)/.test(html()) && /id="ab-save"(?! disabled)/.test(html()) && E('ab-virtual') !== undefined);
    await E('ab-conn').onclick(); await wait(50); await E('ab-virtual').onchange({ target: { checked: false } }); await wait(50);
    say('...and it lets go again (nothing keeps running after the page is done)', run('abConnected()') === false);
    delete ctx.ReadableStream; delete ctx.WritableStream; run("state.hwSub='trackmate'"); await run('render()'); }
  // ---- 1.38.1: a window that cannot start shows why (the Live Race window used to stay white) ----
  { const appSrc = require('fs').readFileSync(require('path').join(__dirname, '../renderer/app.js'), 'utf8');
    say('1.38.1: the start of the window is guarded: a failure goes to bootFailed', /\n\}\)\(\)\.catch\(bootFailed\);\s*$/.test(appSrc) && /function bootFailed\(e\)/.test(appSrc));
    appConsole.expected = true; const seen0 = appConsole.seen; // (the failure is reported to the console, which is the point)
    run("bootFailed(new Error('The schema could not be read'))");
    say('...which shows the message and a Try again button in place of an empty page', E('view').innerHTML.includes('This window could not be opened') && E('view').innerHTML.includes('The schema could not be read') && E('view').innerHTML.includes('id="bootagain"') && run('view.hidden') === false);
    run("bootFailed(undefined)"); say('...and does not fall over on an error without a message', E('view').innerHTML.includes('This window could not be opened') && appConsole.seen === seen0 + 2);
    appConsole.expected = false; run("state.tab = 'settings'"); await run('render()'); }
  // ---- App Settings > Timing Hardware > oXigen Digital: a place held for it (1.38.0) ----
  { const t = E('hwtabs').innerHTML, at = k => t.indexOf(k);
    say('1.38.0: the Timing Hardware sub-tabs are Trackmate Interface, Arduino, DS Electronics, oXigen Digital, Other (in this order)', at('Trackmate Interface') > -1 && at('Trackmate Interface') < at('>Arduino<') && at('>Arduino<') < at('DS Electronics') && at('DS Electronics') < at('>oXigen Digital<') && at('>oXigen Digital<') < at('>Other<'));
    E('hwtabs').onclick({ target: { closest: () => ({ dataset: { id: 'oxigen' } }) } }); await new Promise(r => setTimeout(r, 10)); // (a click on the tab)
    const h = E('hwbox').innerHTML;
    say('...a click on the oXigen Digital tab selects it and opens a page that says there is nothing to set up yet', run('state.hwSub') === 'oxigen' && E('hwtabs').innerHTML.includes('aria-selected="true" data-id="oxigen"') && h.includes('<strong>oXigen Digital</strong>') && h.includes('There is nothing to set up here yet'));
    say('...the page has no buttons, fields or lights (nothing connects, nothing is saved)', !/<(button|input|select|textarea)/.test(h) && !h.includes('class="led'));
    run("state.hwSub='trackmate'"); await run('render()'); }
  // ---- 1.39.0: the timing hardware in use, chosen at the top of Timing Hardware (one at a time) ----
  { const wait = ms => new Promise(r => setTimeout(r, ms)), page = () => E('settingsbox').innerHTML, setS = patch => run(`(p => Object.keys(p).forEach(k => { if (p[k] === null) delete state.settings[k]; else state.settings[k] = p[k]; }))(${JSON.stringify(patch)})`);
    ctx.ReadableStream = ReadableStream; ctx.WritableStream = WritableStream; const keepSet = api.setSettings; api.setSettings = async p => ({ ...run('state.settings'), ...p }); // (the real setSettings answers with all the settings; the stand-in of the window only with what was saved)
    setS({ timingHw: null, abVirtual: null, abDevice: null, tmDevice: null }); run("state.tab = 'settings'; state.settingsSub = 'hardware'; state.hwSub = 'trackmate'"); await run('render()');
    say('1.39.0: the top of Timing Hardware has "Timing hardware in use" with None, Trackmate Interface and Arduino box', page().includes('Timing hardware in use') && page().includes('id="hw-use"') && ['none:None (keys or simulated cars)', 'trackmate:Trackmate Interface', 'arduino:Arduino box (SlotForge)'].every(o => page().includes(`<option value="${o.split(':')[0]}"`) && page().includes(o.split(':')[1])));
    say('...nothing chosen yet: the Trackmate is the one in use, and its page has no "not in use" note', page().includes('<option value="trackmate" selected>') && !page().includes('Use this one'));
    // choosing the Arduino box
    await E('hw-use').onchange({ target: { value: 'arduino' } }); await wait(50);
    say('...choosing the Arduino box saves the choice and shows its page', run('state.settings.timingHw') === 'arduino' && run('state.hwSub') === 'arduino' && page().includes('<option value="arduino" selected>'));
    await E('hwtabs').onclick({ target: { closest: () => ({ dataset: { id: 'trackmate' } }) } }); await wait(20);
    say('...the Trackmate page now says it is not in use for races, names the one that is, and offers Use this one', page().includes('This page is not in use for races: the app uses the Arduino box.') && page().includes('id="hw-usethis"'));
    await E('hw-usethis').onclick(); await wait(50);
    say('...Use this one makes it the one in use', run('state.settings.timingHw') === 'trackmate' && !page().includes('Use this one'));
    await E('hw-use').onchange({ target: { value: 'none' } }); await wait(50);
    say('...None: saved, and no page is "the one"; the pages still open', run('state.settings.timingHw') === 'none' && page().includes('<option value="none" selected>') && run('state.hwSub') === 'trackmate' && page().includes('This page is not in use for races: the app uses no timing hardware.'));
    // letting go of the one that was in use
    setS({ timingHw: 'trackmate' }); run("hw.kind0 = hw.kind; hw.open = true; hw.kind = 'hid'; hw.dev = { close: async () => {} }; Trackmate.link.setConnected(true)"); await run('render()');
    await E('hw-use').onchange({ target: { value: 'arduino' } }); await wait(80);
    say('...changing the choice disconnects the one that was in use (one at a time)', run('hw.open') === false && run('Trackmate.link.connected') === false);
    // ticking the virtual box means the Arduino box is the one in use
    run('hw.dev = null; hw.kind = hw.kind0'); setS({ timingHw: 'trackmate', abVirtual: false }); run("state.hwSub = 'arduino'"); await run('render()');
    await E('ab-virtual').onchange({ target: { checked: true } }); await wait(150);
    say('...ticking "Use the virtual box" makes the Arduino box the one in use, and it connects', run('state.settings.timingHw') === 'arduino' && run('abConnected()') === true);
    await E('ab-conn').onclick(); await wait(50); await E('ab-virtual').onchange({ target: { checked: false } }); await wait(50);
    // 1.39.1: the same with nothing chosen yet (no timingHw saved: the tick alone already made the Arduino box the one in use): the choice is saved all the same and the list above follows
    setS({ timingHw: null, abVirtual: false }); run('ab.dev = null'); run("state.hwSub = 'arduino'"); await run('render()');
    say('...nothing chosen yet: the Trackmate is the one in use, and the Arduino page says so', run('Hardware.timingChosen(state.settings)') === 'trackmate' && page().includes('This page is not in use for races: the app uses the Trackmate Interface.'));
    await E('ab-virtual').onchange({ target: { checked: true } }); await wait(150);
    say('...ticking the virtual box saves the Arduino box as the choice (not only as a side effect of the tick), and the list above shows it', run('state.settings.timingHw') === 'arduino' && E('hw-use').value === 'arduino' && run('abConnected()') === true);
    say('...and the note "not in use" is taken off the Arduino page', E('hwnote').hidden === true && E('hwnote').innerHTML === '');
    await E('ab-conn').onclick(); await wait(50); await E('ab-virtual').onchange({ target: { checked: false } }); await wait(50);
    // only the one in use connects by itself
    setS({ timingHw: 'trackmate', abVirtual: true, abAuto: true }); run('ab.dev = null');
    const autoNo = await run('abAutoConnect()'); await wait(80);
    say('...a box that is ticked or remembered does not connect by itself while another hardware is in use', autoNo === false && run('abConnected()') === false);
    setS({ timingHw: 'arduino' }); const autoYes = await run('abAutoConnect()'); await wait(100);
    say('...and it does when it is the one in use', autoYes === true && run('abConnected()') === true);
    await E('ab-conn').onclick(); await wait(50); await E('ab-virtual').onchange({ target: { checked: false } }); await wait(50);
    setS({ timingHw: 'arduino', tmDevice: { vid: 1, pid: 2 }, tmAuto: true }); run("hw.open = false");
    { const keepSerial = ctx.navigator.serial; let looked = 0; ctx.navigator.serial = { getPorts: async () => { looked++; return []; } };
      await run('tmAutoConnect()'); const whileOther = looked; setS({ timingHw: 'trackmate' }); await run('tmAutoConnect()'); ctx.navigator.serial = keepSerial;
      say('...the Trackmate does not even look for its port by itself while the Arduino box is in use, and does when it is the one in use', whileOther === 0 && looked === 1); }
    setS({ timingHw: null, abVirtual: null, abAuto: null, tmDevice: null, tmAuto: null }); run("state.hwSub = 'trackmate'"); await run('render()');
    api.setSettings = keepSet; delete ctx.ReadableStream; delete ctx.WritableStream; }
  // ---- App Settings > Timing Hardware > DS Electronics: the listening version ----
  { const t = E('hwtabs').innerHTML, at = k => t.indexOf(k);
    say('the sub-tabs are in this order: Trackmate Interface, DS Electronics, Other', at('Trackmate Interface') > -1 && at('Trackmate Interface') < at('DS Electronics') && at('DS Electronics') < at('>Other<'));
    const pick = new Set(), ds = { opened: [], sig: [], writes: [], closes: 0, ctl: null }, fresh = () => new ReadableStream({ start(c) { ds.ctl = c; } });
    const port = { getInfo: () => ({ usbVendorId: 0x0403, usbProductId: 0x6001 }), readable: null, writable: { getWriter() { ds.writes.push('getWriter'); return { write: b => ds.writes.push(b), releaseLock() {} }; } },
      open: async function (o) { ds.opened.push(o); this.readable = fresh(); }, close: async function () { if (this.readable && this.readable.locked) throw new Error('the stream is still locked'); ds.closes++; this.readable = null; },
      setSignals: async x => { ds.sig.push(x); }, getSignals: async () => ({ clearToSend: false, dataSetReady: true, dataCarrierDetect: false, ringIndicator: false }) };
    const wait = ms => new Promise(r => setTimeout(r, ms)), msg = () => E('ds-msg').textContent, log = () => E('ds-log').textContent, box = () => E('hwbox'), html = () => E('hwbox').innerHTML;
    const blobs = [], keepBlob = ctx.Blob, keepURL = URL.createObjectURL, copied = [], anchors = [], keepCreate = document.createElement;
    ctx.Blob = Blob; URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; }; document.createElement = () => { const a = mk(); anchors.push(a); return a; }; document.body.appendChild = () => {};
    ctx.navigator = { userAgent: 'Mozilla/5.0 SlotForge-Timing/9.8.7 Electron/33.0.0 Safari/537.36', serial: undefined, clipboard: { writeText: async x => { copied.push(x); } } };
    run("state.hwSub='ds'; state.settings.dsType=undefined"); await run('render()');
    say('the DS Electronics page says it is a listening version that sends nothing, with the five models to choose from', html().includes('Listening version') && html().includes('sends nothing to the unit') && ['ds030:DS-030', 'ds200:DS-200', 'ds200b:DS-200b', 'ds300:DS-300', 'ds300rc:DS-300 RC'].every(x => html().includes(`name="dstype" value="${x.split(':')[0]}"> ${x.split(':')[1]}</label>`)) && !/checked> DS/.test(html()) && E('hwtabs').innerHTML.includes('aria-selected="true" data-id="ds"'));
    say('...and the serial settings, the note field, the log with its buttons and the connection light', ['ds-find', 'ds-conn', 'ds-led', 'ds-baud', 'ds-data', 'ds-parity', 'ds-stop', 'ds-dtr', 'ds-rts', 'ds-note', 'ds-addnote', 'ds-copy', 'ds-save', 'ds-clear', 'ds-log', 'ds-stats'].every(i => html().includes(`id="${i}"`)) && html().includes('How to make a capture'));
    say('...the speed starts at 9600 with 8 data bits, no parity and 1 stop bit, DTR and RTS on, and the speeds to choose from are listed', html().includes('<option selected>9600</option>') && html().includes('<option>1200</option>') && html().includes('<option>115200</option>') && html().includes('id="ds-dtr" checked') && html().includes('id="ds-rts" checked'));
    say('without COM port support (a browser) there is nothing to find or connect, and it says why', html().includes('id="ds-find" disabled') && html().includes('id="ds-conn" disabled') && html().includes('COM ports can only be used in the desktop app.'));
    // the main process lists the ports, the person picks one
    { let ask = null; const picked = []; api.onHwChoose = f => { ask = f; }; api.hwChosen = id => picked.push(id); await run('render()');
      say('the page waits for the port list of the main process', typeof ask === 'function');
      let done = ask('serial', [{ displayName: 'USB Serial A', portName: 'COM3', portId: 'p3', vendorId: 0x0403, productId: 0x6001 }, { displayName: 'Communications Port', portName: 'COM1', portId: 'p1' }]); await wait(5);
      say('the ports found are shown, with their USB numbers when they have them', E('ds-pick').innerHTML.includes('USB Serial A') && E('ds-pick').innerHTML.includes('COM3') && E('ds-pick').innerHTML.includes('(0403:6001)') && E('ds-pick').innerHTML.includes('data-pick="1"') && E('ds-pick').innerHTML.includes('data-pick="-1"'));
      E('ds-pick').onclick({ target: { closest: () => ({ dataset: { pick: '1' } }) } }); await done; say('the chosen port goes back to the main process', picked.join() === 'p1');
      done = ask('serial', []); await wait(5); say('with no ports the page says so', E('ds-pick').innerHTML.includes('No ports found'));
      E('ds-pick').onclick({ target: { closest: () => ({ dataset: { pick: '-1' } }) } }); await done; say('Cancel sends nothing back but an empty choice', picked.join() === 'p1,');
      delete api.onHwChoose; delete api.hwChosen; }
    // with Web Serial: find the port, choose the model, connect
    ctx.navigator.serial = { requestPort: async () => port };
    await run('render()'); say('with COM port support the find button works, Connect still waits', !/id="ds-find" disabled/.test(html()) && html().includes('id="ds-conn" disabled') && html().includes('No port chosen.'));
    await E('ds-find').onclick(); say('after Find the port is named (with its USB numbers), and the page asks for the model before connecting', html().includes('COM port (USB 0403:6001)') && html().includes('Choose the model above to connect.') && html().includes('id="ds-conn" disabled'));
    { const n = calls.length; await withMerge(async () => { await box().onchange({ target: { name: 'dstype', value: 'ds999' } }); await box().onchange({ target: { name: 'other', value: 'ds300' } }); await wait(20); });
      say('a model that does not exist, or a change of something else, is ignored', calls.slice(n).filter(c => c[0] === 'settings' && 'dsType' in c[1]).length === 0 && run('state.settings.dsType') === undefined);
      await withMerge(async () => { await box().onchange({ target: { name: 'dstype', value: 'ds300' } }); await wait(30); });
      say('choosing a model saves it, and Connect is then ready', calls.slice(n).some(c => c[0] === 'settings' && c[1].dsType === 'ds300') && run('state.settings.dsType') === 'ds300' && /id="ds-conn" >/.test(html()) && html().includes('name="dstype" value="ds300" checked> DS-300</label>') && !html().includes('Choose the model above to connect.')); }
    await E('ds-baud').onchange({ target: { value: '19200' } }); await E('ds-parity').onchange({ target: { value: 'even' } }); await E('ds-rts').onchange({ target: { checked: false } });
    say('the serial settings are kept while the app runs', run('JSON.stringify(dsc.cfg)') === '{"baud":19200,"data":8,"parity":"even","stop":1,"dtr":true,"rts":false}');
    await E('ds-conn').onclick(); await wait(20);
    say('Connect opens the port with those settings and sets DTR and RTS as chosen', ds.opened.length === 1 && JSON.stringify(ds.opened[0]) === '{"baudRate":19200,"dataBits":8,"stopBits":1,"parity":"even","flowControl":"none"}' && JSON.stringify(ds.sig[0]) === '{"dataTerminalReady":true,"requestToSend":false}');
    say('...the light is on, the button says Disconnect, the speed cannot be changed while connected, the device is named with its model', html().includes('class="led on" id="ds-led"') && html().includes('Disconnect</button>') && /id="ds-baud" disabled/.test(html()) && html().includes('DS-300 on COM port (USB 0403:6001) is connected'));
    say('...the log says what it connected to, and the page says that nothing has arrived yet', log().includes('-- connected to the COM port at 19200 baud, 8 data bits, parity even, 1 stop bit(s), DTR on, RTS off --') && E('ds-stats').textContent.startsWith('Connected. Nothing has arrived yet'));
    say('...the control lines are written to the log when they change (once, not every time they are read)', (log().match(/LINES  CTS=0 DSR=1 DCD=0 RI=0/g) || []).length === 1);
    say('the Trackmate connection is a separate thing: it is not touched', run('hw.open') === false && run('hw.dev') === null && run('hw.lines.length') === run('hw.lines.length'));
    // data arrives
    ds.ctl.enqueue(new Uint8Array([0x41, 0x0d, 0x0a])); ds.ctl.enqueue(new Uint8Array([0x4c, 0x31, 0x20, 0x30, 0x37, 0x2e, 0x33, 0x35, 0x0d, 0x0a])); await wait(30);
    say('what arrives is written to the log with the time, the number of bytes, the hex and the text', /\d\.\d{3}  <-    3 B  41 0d 0a  \|A\.\.\|/.test(log()) && /<-   10 B  4c 31 20 30 37 2e 33 35 0d 0a  \|L1 07\.35\.\.\|/.test(log()));
    say('...and the page counts the bytes and the pieces', E('ds-stats').textContent.startsWith('Received: 13 byte(s) in 2 piece(s). The last one came '));
    // notes
    E('ds-note').value = 'lane 1: car over the sensor'; E('ds-addnote').onclick();
    say('a note is written to the log with the time, and the field is emptied', /\d\.\d{3}  NOTE  lane 1: car over the sensor/.test(log()) && E('ds-note').value === '');
    E('ds-note').value = '   '; E('ds-addnote').onclick(); const lines0 = run('dsc.lines.length'); E('ds-note').value = 'with Enter'; let prevented = false; E('ds-note').onkeydown({ key: 'a', preventDefault() { prevented = true; } }); const lines1 = run('dsc.lines.length'); E('ds-note').onkeydown({ key: 'Enter', preventDefault() { prevented = true; } });
    say('an empty note is not added; Enter adds the note (and does not submit anything), other keys do nothing', /NOTE  with Enter/.test(log()) && run('dsc.lines.length') === lines0 + 1 && lines1 === lines0 && prevented && E('ds-note').value === '' && !/NOTE  \s*$/m.test(log()));
    // the model can be changed during a connection: it is written in the log
    { const n = calls.length; await withMerge(async () => { await box().onchange({ target: { name: 'dstype', value: 'ds200' } }); await wait(30); });
      say('the model can be changed while connected, and the log says so', calls.slice(n).some(c => c[0] === 'settings' && c[1].dsType === 'ds200') && log().includes('-- the unit was set to DS-200 --') && !/name="dstype"[^>]*disabled/.test(html()));
      await withMerge(async () => { await box().onchange({ target: { name: 'dstype', value: 'ds300' } }); await wait(30); }); }
    // save and copy: the whole log with the top lines
    { const lines = run('dsc.lines.slice()');
      E('ds-save').onclick(); const text = await blobs[0].text(), a = anchors[anchors.length - 1];
      say('Save log makes a text file named after the model, with the top lines and then every line of the log', a.download === 'ds-electronics-ds300-log.txt' && text.startsWith('SlotForge Timing 9.8.7 - DS Electronics capture\r\n') && text.includes('\r\nUnit: DS-300\r\n') && text.includes('\r\nPort: COM port (USB 0403:6001)\r\n') && lines.every(l => text.includes(l)) && text.indexOf(lines[0]) > text.indexOf('Port:'));
      await E('ds-copy').onclick(); say('Copy log copies the same text (the time of saving apart)', copied.length === 1 && copied[0].replace(/Saved: [^\r]*/, '') === text.replace(/Saved: [^\r]*/, '') && msg() === 'Copied.'); }
    say('nothing was ever sent to the unit', ds.writes.length === 0);
    E('ds-clear').onclick(); say('Clear empties the log (on the page and in the file)', log() === '' && run('dsc.lines.length') === 0);
    // disconnect
    await E('ds-conn').onclick(); await wait(30);
    say('Disconnect closes the port and the light goes out (the port is not left open and locked)', ds.closes === 1 && run('dsc.open') === false && /class="led" id="ds-led"/.test(html()) && html().includes('Connect</button>') && !msg().includes('Could not'));
    say('...the log says how much came in, and the page remembers it', log().includes('-- disconnected: 13 byte(s) received in 2 piece(s) --') && E('ds-stats').textContent === 'Last connection: 13 byte(s) received in 2 piece(s).');
    E('ds-note').value = 'not connected'; E('ds-addnote').onclick(); say('a note cannot be added without a connection', !log().includes('not connected  ') && !/NOTE  not connected/.test(log()));
    // connect again, then the unit goes away
    await E('ds-conn').onclick(); await wait(20); ds.ctl.enqueue(new Uint8Array([0x42])); await wait(20);
    say('connecting again starts the counts again', ds.opened.length === 2 && E('ds-stats').textContent.startsWith('Received: 1 byte(s) in 1 piece(s)'));
    port.readable = null; ds.ctl.error(new Error('gone')); await wait(30);
    say('when the unit goes away the error and the loss are in the log, the light goes out and Connect is back', /ERROR  Error: gone/.test(log()) && log().includes('-- the device went away --') && run('dsc.open') === false && html().includes('Connect</button>'));
    // a stream that simply ends (and no new one comes) also means the unit is gone: the reading must not start over and over
    ctx.navigator.serial = { requestPort: async () => port }; await run('render()'); await E('ds-find').onclick(); await E('ds-conn').onclick(); await wait(20); ds.ctl.close(); await wait(50);
    say('a stream that ends is treated as the unit going away (no endless reading)', log().includes('-- the device went away --') && run('dsc.open') === false && html().includes('Connect</button>'));
    // a wrong speed gives the same error over and over: one line with a count, not thousands of lines
    { let n = 0, cur = null; const mkBad = () => new ReadableStream({ start(c) { setTimeout(() => { c.error(Object.assign(new Error('Framing error.'), { name: 'FramingError' })); n++; cur = n < 5 ? mkBad() : null; }, 1); } });
      const bad = { ...port, open: async () => { cur = mkBad(); }, close: async () => {}, get readable() { return cur; } }; ctx.navigator.serial = { requestPort: async () => bad }; await run('render()'); await E('ds-find').onclick(); await E('ds-clear').onclick(); await E('ds-conn').onclick(); await wait(120);
      const errLines = log().split('\n').filter(l => l.includes('ERROR'));
      say('five framing errors in a row make one ERROR line with the count, and the loss of the port after them is noted', errLines.length === 1 && errLines[0].includes('FramingError: Framing error.  (5 times)') && log().includes('-- the device went away --') && run('dsc.open') === false);
      say('...the reading never spins: it stopped after those five errors', n === 5); }
    // a port that cannot be opened
    { const busy = { ...port, open: async () => { throw new Error('Failed to open serial port.'); } }; ctx.navigator.serial = { requestPort: async () => busy }; await run('render()'); await E('ds-find').onclick(); await E('ds-conn').onclick();
      say('a port that cannot be opened is explained, with the likely cause', msg().startsWith('Could not connect: Failed to open serial port.') && msg().includes('is another program using this port?') && run('dsc.open') === false); }
    // what the person sees if the saved model is not one of ours
    run("state.settings.dsType='bogus'"); await run('render()'); say('a saved model that is not in the list shows no model as chosen', !/value="ds\w+" checked/.test(html())); run("state.settings.dsType=undefined");
    delete ctx.navigator; delete document.body.appendChild; ctx.Blob = keepBlob; URL.createObjectURL = keepURL; document.createElement = keepCreate; run("state.hwSub='trackmate'"); await run('render()');
    say('back on the Trackmate page everything is as it was', html().includes('id="hw-serial"') && !html().includes('ds-log')); }
  run("state.settingsSub='general'");
  // ---- App Settings > Network access ----
  run("state.tab='settings'; state.settingsSub='general'"); await run('render()');
  say('App Settings has General, App Theme and Network sub-tabs; General keeps the name and header but not the theme or the network settings', E('settingstabs').innerHTML.includes('General') && E('settingstabs').innerHTML.includes('App Theme') && E('settingstabs').innerHTML.includes('Network') && E('settingsbox').innerHTML.includes('id="appname"') && !E('settingsbox').innerHTML.includes('id="theme"') && !E('settingsbox').innerHTML.includes('id="net-on"'));
  // ---- App Settings > Race Director (1.12.0): the values of the adjust pads and their layout ----
  await withMerge(async () => {
    const tabs = E('settingstabs').innerHTML;
    say('App Settings has a Race Director sub-tab, after App Theme and before Network', tabs.includes('data-id="director"') && tabs.indexOf('App Theme') < tabs.indexOf('Race Director') && tabs.indexOf('Race Director') < tabs.indexOf('>Network<'));
    run("state.settings={theme:'dark'}; state.settingsSub='director'"); await run('render()');
    const g = () => E('settingsbox').innerHTML;
    say('the page has a field for the values of each group (penalty points, damage points, time, laps, championship points) with the standard values, a layout choice and a preview of the five pads', ['pad-points','pad-damage','pad-time','pad-laps','pad-champ'].every(i => g().includes(`id="${i}"`)) && g().includes('value="1, 2, 4"') && g().includes('value="1, 2, 5"') && g().includes('value="5, 10, 30"') && g().includes('value="1, 2"') && g().includes('data-padlayout="h" aria-pressed="true"') && g().includes('data-padlayout="v" aria-pressed="false"') && g().includes('id="pad-preview"') && (g().match(/data-pad="/g) || []).length === 5 && g().includes('Damage points'));
    say('...the preview cannot be used by mistake (it is inert and hidden from a screen reader), and the page says where the values are used', g().includes('id="pad-preview" inert aria-hidden="true"') && g().includes('Adjust folder of the Race Director page') && g().includes('race review'));
    const calls0 = calls.length;
    E('settingsbox').onchange({ target: { closest: () => ({ dataset: { padlist: 'time' }, value: '30, 5, 10, 10, x, 2.5' }) } }); await new Promise(r => setTimeout(r, 30));
    const last = calls[calls.length - 1];
    say('typing the values of the time pad saves them cleaned (sorted, no doubles, no mistakes)', calls.length === calls0 + 1 && last[0] === 'settings' && JSON.stringify(last[1]) === '{"padSeconds":[2.5,5,10,30]}' && JSON.stringify(run('state.settings.padSeconds')) === '[2.5,5,10,30]');
    say('...and the preview shows them', E('pad-preview').innerHTML.includes('data-v="2.5"') && E('pad-preview').innerHTML.includes('data-v="30"'));
    E('settingsbox').onchange({ target: { closest: () => ({ dataset: { padlist: 'laps' }, value: 'abc' }) } }); await new Promise(r => setTimeout(r, 30));
    say('text without numbers gives the standard values again', JSON.stringify(run('state.settings.padLaps')) === '[1,2]');
    E('settingsbox').onclick({ target: { closest: () => ({ dataset: { padlayout: 'v' } }) } }); await new Promise(r => setTimeout(r, 30));
    say('Vertical is saved in the settings, and the preview is drawn as rows', run('state.settings.padLayout') === 'v' && E('pad-preview').innerHTML.includes('pad-v') && !E('pad-preview').innerHTML.includes('pad-h'));
    E('settingsbox').onclick({ target: { closest: () => ({ id: 'pad-reset', dataset: {} }) } }); await new Promise(r => setTimeout(r, 60));
    say('Back to the standard values puts all five lists back (the layout stays)', JSON.stringify(run('[state.settings.padPoints, state.settings.padDamage, state.settings.padSeconds, state.settings.padLaps, state.settings.padChamp]')) === '[[1,2,5],[1,2,4],[5,10,30],[1,2],[1,2,5]]' && run('state.settings.padLayout') === 'v' && g().includes('value="5, 10, 30"'));
    run("state.settings={theme:'dark'}; state.settingsSub='general'");
  });
  // ---- App Settings > Help ----
  { const tabs = E('settingstabs').innerHTML;
    say('App Settings has a Help sub-tab, last after Import and Export', tabs.includes('data-id="help"') && tabs.indexOf('Import and Export') < tabs.indexOf('>Help<') && tabs.indexOf('data-id="help"') > tabs.indexOf('data-id="transfer"'));
    run("state.settingsSub='help'"); await run('render()');
    const box = E('settingsbox').innerHTML;
    say('the Help sub-tab shows the welcome first, with the quick start steps', box.includes('Welcome to SlotForge Timing') && box.includes('How do I get started?') && box.includes('class="hw-steps"') && box.indexOf('helpwelcome') < box.indexOf('helpfolder'));
    say('...then the folders, in the folder style of the Database tab, all closed', (box.match(/<details class="dbfolder helpfolder"/g) || []).length === run('Help.folders().length') && !/<details[^>]* open/.test(box));
    say('...and none of the settings of the other sub-tabs', !box.includes('id="appname"') && !box.includes('id="net-on"'));
    E('settingsbox').onclick({ target: { closest: () => ({ dataset: { helpall: '1' } }) } });
    say('Open all opens every folder', (E('settingsbox').innerHTML.match(/<details[^>]* open/g) || []).length === run('Help.folders().length'));
    E('settingsbox').onclick({ target: { closest: () => ({ dataset: { helpall: '0' } }) } });
    run("state.settingsSub='general'"); await run('render()');
    say('General is made of folders (open at first), and has the name, header and logo settings in them', ['display', 'names', 'header', 'logo', 'pictures', 'data'].every(f => E('settingsbox').innerHTML.includes('data-folder="general:' + f + '"')) && E('settingsbox').innerHTML.includes('id="appname"') && (E('settingsbox').innerHTML.match(/<details class="dbfolder"[^>]* open/g) || []).length === 6);
    E('settingsbox').onclick({ target: { closest: () => ({ dataset: { folderall: '0' } }) } }); await new Promise(r => setTimeout(r, 40));
    say('Close all closes every folder of General, and they stay closed when the page is drawn again', !/<details class="dbfolder"[^>]* open/.test(E('settingsbox').innerHTML) && (E('settingsbox').innerHTML.match(/<details class="dbfolder"/g) || []).length === 6 && E('settingsbox').innerHTML.includes('id="appname"'));
    E('settingsbox').onclick({ target: { closest: () => ({ dataset: { folderall: '1' } }) } }); await new Promise(r => setTimeout(r, 40));
    say('Open all opens them again', (E('settingsbox').innerHTML.match(/<details class="dbfolder"[^>]* open/g) || []).length === 6);
    { const wait = () => new Promise(r => setTimeout(r, 40)), ui = () => E('settingsbox').innerHTML.split('id="uiscale"')[1] || '';
      say('General has a Display folder first, with the Interface size: six sizes, the standard one chosen', E('settingsbox').innerHTML.indexOf('data-folder="general:display"') < E('settingsbox').innerHTML.indexOf('data-folder="general:names"') && E('settingsbox').innerHTML.includes('id="uiscale"') && (ui().split('</select>')[0].match(/<option /g) || []).length === 6 && /<option value="100" selected>100% \(standard\)/.test(ui()));
      say('...the folder says the size beside its title', /<summary><strong>Display<\/strong> <span class="muted">interface size 100%/.test(E('settingsbox').innerHTML));
      say('...the app asked for the standard size (no zoom) when it started', zooms.length >= 1 && zooms[0] === 1);
      const nz = zooms.length, nc = calls.length; await E('uiscale').onchange({ target: { value: '150' } }); await wait();
      say('...choosing 150% saves it, zooms the window by 1.5 and shows it chosen', run('state.settings.uiScale') === 150 && calls.slice(nc).some(c => c[1].uiScale === 150) && zooms.slice(nz).pop() === 1.5 && /<option value="150" selected>/.test(ui()) && /interface size 150%/.test(E('settingsbox').innerHTML));
      await E('uiscale').onchange({ target: { value: '200' } }); await wait();
      say('...the largest size is a zoom of 2', run('state.settings.uiScale') === 200 && zooms[zooms.length - 1] === 2);
      await E('uiscale').onchange({ target: { value: '137' } }); await wait();
      say('...a size that does not exist becomes the standard, and the window is back to normal', run('state.settings.uiScale') === 100 && zooms[zooms.length - 1] === 1 && /<option value="100" selected>/.test(ui()));
      say('1.22.0: the Display folder also has the speed unit of the tables, km/h to start, and says it beside its title', E('settingsbox').innerHTML.includes('id="speedunit"') && /<option value="kmh" selected>/.test(E('settingsbox').innerHTML.split('id="speedunit"')[1]) && /<option value="mph">Miles per hour \(mph\)<\/option>/.test(E('settingsbox').innerHTML) && /speeds in km\/h/.test(E('settingsbox').innerHTML));
      { const nc2 = calls.length; await E('speedunit').onchange({ target: { value: 'mph' } }); await wait();
        say('...choosing mph saves it, shows it chosen and in the folder note', run('state.settings.speedUnit') === 'mph' && calls.slice(nc2).some(c => c[1].speedUnit === 'mph') && /<option value="mph" selected>/.test(E('settingsbox').innerHTML.split('id="speedunit"')[1]) && /speeds in mph/.test(E('settingsbox').innerHTML));
        await E('speedunit').onchange({ target: { value: 'furlongs' } }); await wait();
        say('...a unit that does not exist becomes km/h', run('state.settings.speedUnit') === 'kmh' && /speeds in km\/h/.test(E('settingsbox').innerHTML)); }
      say('1.27.0: the Display folder also has the distance unit, metres and kilometres to start, with both choices, and says it beside its title; the speed unit no longer says anything about distances', E('settingsbox').innerHTML.includes('id="distunit"') && /<option value="m" selected>Metres and kilometres \(m, km\)<\/option>/.test(E('settingsbox').innerHTML.split('id="distunit"')[1]) && /<option value="ft">Feet and miles \(ft, mi\)<\/option>/.test(E('settingsbox').innerHTML) && /distances in metres and kilometres/.test(E('settingsbox').innerHTML) && !E('settingsbox').innerHTML.includes('Distances stay in metres'));
      { const nc3 = calls.length; await E('distunit').onchange({ target: { value: 'ft' } }); await wait();
        say('...choosing feet and miles saves it, shows it chosen and in the folder note, and leaves the speed unit alone', run('state.settings.distanceUnit') === 'ft' && calls.slice(nc3).some(c => c[1].distanceUnit === 'ft') && !calls.slice(nc3).some(c => c[1].speedUnit !== undefined) && /<option value="ft" selected>/.test(E('settingsbox').innerHTML.split('id="distunit"')[1]) && /distances in feet and miles/.test(E('settingsbox').innerHTML));
        await E('distunit').onchange({ target: { value: 'furlongs' } }); await wait();
        say('...a unit that does not exist becomes metres', run('state.settings.distanceUnit') === 'm' && /distances in metres and kilometres/.test(E('settingsbox').innerHTML)); run("delete state.settings.distanceUnit"); }
    }
    say('the folders have a note beside the title, the body has room around it, and the database file is in the last folder', /<summary><strong>Header picture<\/strong> <span class="muted">no picture<\/span>/.test(E('settingsbox').innerHTML) && /<div class="fbody">/.test(E('settingsbox').innerHTML) && E('settingsbox').innerHTML.indexOf('Saved in:') > E('settingsbox').innerHTML.indexOf('data-folder="general:data"'));
    run("state.settingsSub='help'"); await run('render()');
    say('going to General and back leaves the Help folders as they were (closed)', !/<details[^>]* open/.test(E('settingsbox').innerHTML));
  }
  run("state.settingsSub='network'"); await run('render()');
  say('the Network sub-tab: switch (off by default), port and password, no status when the app cannot say', E('settingsbox').innerHTML.includes('id="net-on"') && !E('settingsbox').innerHTML.includes('id="net-on" type="checkbox" checked') && E('settingsbox').innerHTML.includes('id="net-port"') && E('settingsbox').innerHTML.includes('id="net-pass"'));
  api.netStatus = async () => ({ on: true, port: 8787, error: '', passwordSet: false, urls: [{ url: 'http://192.168.1.2:8787/', svg: '<svg id="theqr"></svg>' }] });
  let pdfHtml = ''; api.exportPdf = async h => { pdfHtml = h; return { saved: true, path: 'C:\\qr.pdf' }; };
  const nS = calls.length; await E('net-on').onchange({ target: { checked: true } }); await new Promise(r => setTimeout(r, 20));
  say('switching it on saves the setting and shows the address with its QR code', calls.slice(nS).some(c => c[0] === 'settings' && c[1].netOn === true) && E('net-info').innerHTML.includes('http://192.168.1.2:8787/') && E('net-info').innerHTML.includes('theqr') && E('net-info').innerHTML.includes('no password') === false && E('net-info').innerHTML.includes('Race Director page is closed'));
  say('each address has a Save QR code as PDF button', E('net-info').innerHTML.includes('data-qrpdf="0"'));
  await E('net-info').onclick({ target: { closest: () => ({ dataset: { qrpdf: '0' } }) } });
  say('the PDF page holds the QR code and the address', pdfHtml.includes('theqr') && pdfHtml.includes('http://192.168.1.2:8787/') && pdfHtml.includes('Scan this code'));
  await E('net-pass').onchange({ target: { value: 'abc' } }); await E('net-port').onchange({ target: { value: '9000' } }); await new Promise(r => setTimeout(r, 20));
  say('password and port are saved', calls.some(c => c[0] === 'settings' && c[1].netPassword === 'abc') && calls.some(c => c[0] === 'settings' && c[1].netPort === 9000));
  const badPort = { value: '99999' }; await E('net-port').onchange({ target: badPort }); await new Promise(r => setTimeout(r, 20));
  say('a port that does not exist falls back to 8787', calls.some(c => c[0] === 'settings' && c[1].netPort === 8787) && badPort.value === 8787);
  api.netStatus = async () => ({ on: false, port: 0, error: 'Port 8787 is already in use. Choose another port.', passwordSet: true, urls: [] }); await E('net-on').onchange({ target: { checked: true } }); await new Promise(r => setTimeout(r, 20));
  say('a problem such as a busy port is shown', E('net-info').innerHTML.includes('already in use'));
  delete api.netStatus;
  // ---- Customization > Image Settings ----
  run("state.editing=null; state.tab='custom'; state.customSub='images'"); await run('render()');
  say('Image Settings: empty list with a New button', E('setupbox').innerHTML.includes('id="newset"') && E('setupbox').innerHTML.includes('No picture sets yet'));
  await E('setupbox').onclick({target:{closest:()=>({id:'newset',dataset:{}})}});
  say('a new set opens an editor: name, type, number of pictures and a slot per picture', E('setupbox').innerHTML.includes('id="is-name"') && E('setupbox').innerHTML.includes('id="is-kind"') && E('setupbox').innerHTML.includes('id="is-steps"') && (E('setupbox').innerHTML.match(/data-slot=/g)||[]).length===10 && E('setupbox').innerHTML.includes('1 (full)') && E('setupbox').innerHTML.includes('10 (empty)'));
  run("resizeImage = async () => 'data:pic'");
  E('is-steps').onchange({target:{value:'4'}}); say('the number of picture slots follows (2 to 20)', (E('setupbox').innerHTML.match(/data-slot=/g)||[]).length===4);
  await E('setupbox').onchange({target:{dataset:{slot:'0'},files:[{}]}}); await E('setupbox').onchange({target:{dataset:{slot:'3'},files:[{}]}});
  say('a picture can be added to a slot and removed again', (E('setupbox').innerHTML.match(/data-clear=/g)||[]).length===2);
  E('setupbox').onclick({target:{closest:()=>({dataset:{clear:'3'}})}}); say('...removed', (E('setupbox').innerHTML.match(/data-clear=/g)||[]).length===1);
  E('is-name').oninput({target:{value:'My tank'}});
  const nI=calls.length; await E('is-save').onclick();
  const addI=calls.slice(nI).find(c=>c[0]==='add'&&c[1]==='imagesets');
  say('saving stores the set', addI && addI[2].name==='My tank' && addI[2].kind==='fuel' && addI[2].steps===4 && addI[2].images.length===4 && addI[2].images[0]==='data:pic' && addI[2].images[3]==='');
  E('is-kind').onchange({target:{value:'flag'}});
  say('a flag set has a slot per race flag state', (E('setupbox').innerHTML.match(/data-slot=/g)||[]).length===7 && E('setupbox').innerHTML.includes('Yellow flag') && !E('setupbox').innerHTML.includes('Get ready'));
  E('is-kind').onchange({target:{value:'lights'}});
  { const h=()=>E('setupbox').innerHTML, slots=()=>(h().match(/data-slot="/g)||[]).length, rows=['Lights off','Countdown','Pre-Race','Racing (green flag)','Paused','Heat finished','Finished (chequered flag)','Yellow flag','Red flag'];
    say('a start lights set is a grid: a row for Lights off, Countdown and every race state (Pre-Race, not Ready; the old names are gone), by All lights and light 1 to 5 (54 pictures)', slots()===54 && !h().includes('<th scope="row">Ready</th>') && !h().includes('<th scope="row">Light on</th>') && !h().includes('<th scope="row">Light off</th>') && rows.every(r=>h().includes('<th scope="row">'+r+'</th>')) && ['All lights','Light 1','Light 2','Light 3','Light 4','Light 5'].every(c=>h().includes('<th>'+c+'</th>')) && h().includes('Start lights (a picture per light and per race state)') && !h().includes('(a lit and an unlit light)'));
    say('...every cell has a file chooser named for its row and light, and starts as a plain round light', h().includes('aria-label="Picture for Yellow flag, light 3"') && h().includes('data-slot="yellow_3"') && h().includes('data-slot="yellow"') && h().includes('data-slot="on_1"') && h().includes('data-slot="off"') && (h().match(/class="lgpick none"/g)||[]).length===54 && !h().includes('data-clear='));
    say('...and shows a preview of the five lights with three on', h().includes('id="is-prev"') && h().includes('class="slsvg"') && (h().match(/class="sl on"/g)||[]).length===3 && (h().match(/<circle/g)||[]).length===5);
    say('...and the hint above the grid says every row stands on its own, that the Countdown pictures are only for the countdown, and that Lights off is for every light that is off', h().includes('Every row stands on its own: the Countdown pictures are only for the countdown') && h().includes('Lights off is for every light that is off, in every state'));
    await E('setupbox').onchange({target:{dataset:{slot:'on'},files:[{}]}});
    say('a picture in Countdown / All lights is shown dimmed in the five empty cells of the Countdown row only (1.28.1: not in Yellow flag, Red flag, Paused and the other rows), and in the preview', (h().match(/class="lgpick behind"/g)||[]).length===5 && h().includes('title="Countdown, light 3: uses the Countdown picture"') && h().includes('title="Yellow flag, light 3: a plain round light"') && h().includes('title="Red flag, all lights: a plain round light"') && h().includes('title="Paused, light 1: a plain round light"') && h().includes('title="Lights off, light 2: a plain round light"') && (h().match(/<image/g)||[]).length===3);
    await E('setupbox').onchange({target:{dataset:{slot:'yellow_3'},files:[{}]}});
    say('a picture of its own for one light in one state: the cell shows it undimmed with a Remove button, and the cells that fall back to it change', h().includes('data-clear="yellow_3"') && (h().match(/data-clear=/g)||[]).length===2 && !h().includes('title="Yellow flag, light 3: uses') && h().includes('Remove the picture for Yellow flag, light 3'));
    E('is-prev').onchange({target:{value:'yellow'}});
    say('the preview can show a race state', run('imgEd.preview')==='yellow' && h().includes('<option value="yellow" selected>') && h().includes('class="slsvg"'));
    E('setupbox').onclick({target:{closest:()=>({dataset:{clear:'yellow_3'}})}});
    say('a picture is removed again (the cell is a plain round light again: no row borrows from the Countdown row)', !h().includes('data-clear="yellow_3"') && h().includes('title="Yellow flag, light 3: a plain round light"') && !h().includes('Yellow flag, light 3: uses'));
    E('setupbox').onclick({target:{closest:()=>({dataset:{clear:'on'}})}});
    say('...and with nothing left everything is a plain round light again', (h().match(/class="lgpick none"/g)||[]).length===54 && (h().match(/<image/g)||[]).length===0);
  }
  await E('is-back').onclick(); run("state.customSub='images'"); await run('render()');
  say('the list shows the set with its picture count', E('setupbox').innerHTML.includes('My tank') && E('setupbox').innerHTML.includes('1 of 4'));
  const setId=store.imagesets[0].id;
  await E('setupbox').onclick({target:{closest:()=>({dataset:{dup:setId}})}}); say('a set can be duplicated', store.imagesets.length===2 && store.imagesets[1].name==='My tank (copy)');
  // choosing a set in a widget
  run("state.editing=null; state.customSub='layouts'"); await openEditor(); run("editorAdd('fuel')");
  let fsd=E('side').innerHTML;
  say('the Fuel widget offers the fuel sets and no picture uploads of its own', fsd.includes('data-opt="imageSet"') && fsd.includes('My tank') && fsd.includes('>None<') && !fsd.includes('data-optimglist="stepImages"'));
  E('side').onchange({target:{dataset:{opt:'imageSet'},value:setId}});
  fsd=E('side').innerHTML;
  say('with a set chosen the widget\'s own picture uploads are hidden and the canvas uses the set', run('state.editing.draft.widgets[0].opt.imageSet')===setId && !fsd.includes('data-optimglist="stepImages"') && !E('canvas').innerHTML.includes('class="fbar"') && E('canvas').innerHTML.includes('class="fnum"'));
  E('side').onchange({target:{dataset:{opt:'imageSet'},value:''}});
  say('...and without a set the widget shows its bar again', !E('side').innerHTML.includes('data-optimglist="stepImages"') && E('canvas').innerHTML.includes('class="fbar"'));
  run("state.editing.draft.widgets[0].opt.stepImages=['data:own','data:own2']; state.editing.draft.widgets[0].opt.steps=2"); E('side').innerHTML=run('sideHtml()');
  say('a widget with its own pictures can save them as a set', E('side').innerHTML.includes('data-saveset="1"'));
  const nJ=calls.length; E('side').onclick({target:{closest:()=>({dataset:{saveset:'1'}})}}); await new Promise(r=>setTimeout(r,30));
  const addJ=calls.slice(nJ).find(c=>c[0]==='add'&&c[1]==='imagesets');
  say('...which is stored and chosen in the widget', addJ && addJ[2].kind==='fuel' && addJ[2].images.join()==='data:own,data:own2' && addJ[2].steps===2 && run('state.editing.draft.widgets[0].opt.imageSet')===store.imagesets[store.imagesets.length-1].id);
  run("state.editing.draft.widgets.pop(); state.editing.sel=[]; editorAdd('flag'); state.editing.sel[0].opt = { flagStyle: 'images' }"); E('side').innerHTML=run('sideHtml()');
  say('the Race flag widget offers flag sets, not fuel sets', E('side').innerHTML.includes('data-opt="imageSet"') && !E('side').innerHTML.includes('My tank'));
  run("state.editing.draft.widgets.pop(); state.editing.sel=[]");
  // ---- 0.91.0: the Delta Timers folder and the settings of a Delta Timer ----
  { const pal=run('view.innerHTML'), types=['dlaptime','davglap','dmedlap','dbestlap','drecordlap','dpitstop','dsessionrecord','dtrackrecord'];
    say('the palette has a Delta Timers folder (closed) with the eight widgets, by name', pal.includes('<details class="palgroup" data-pal="Delta Timers"><summary>Delta Timers</summary>') && types.every(t=>pal.includes('data-add="'+t+'"')) && pal.includes('>Personal Best Delta</button>') && pal.includes('>Pitstop Time Delta</button>') && !pal.includes('data-add="dlastlap"'));
    run("editorAdd('drecordlap')"); let sd=E('side').innerHTML; const w=()=>run('state.editing.sel[0]');
    say('a Personal Best Delta starts as one lane widget with a title and the settings below', w().type==='drecordlap' && w().lane===0 && sd.includes('Personal best delta') && E('canvas').innerHTML.includes('dlt-badge'));
    say('...its settings: what is compared (three ways), compare with (five), which lane, decimals, the look, the arrow and the three colours', ['measure','compare','targetLane','decimals','style','arrow','fasterColor','slowerColor','equalColor'].every(k=>sd.includes('data-opt="'+k+'"')) && sd.includes('<option value="static" selected>This lane\'s personal best against theirs</option>') && sd.includes('This lane\'s last lap against its own personal best') && ['lane','leader','fastest','track','session'].every(k=>sd.includes('<option value="'+k+'"')) && sd.includes('The next lane (the last lane with lane 1)') && sd.includes('Lane 8') && sd.includes('Colour when faster') && sd.includes('Look of the badge') && sd.includes('Arrow in the badge'));
    E('side').onchange({target:{dataset:{opt:'compare'},value:'leader'}}); sd=E('side').innerHTML;
    say('compare with "the leader": the Which lane setting goes away, and the choice is kept on the widget', w().opt.compare==='leader' && !sd.includes('data-opt="targetLane"') && sd.includes('data-opt="compare"'));
    E('side').onchange({target:{dataset:{opt:'compare'},value:'lane'}}); sd=E('side').innerHTML;
    say('...back to "a chosen lane": it comes back', sd.includes('data-opt="targetLane"'));
    E('side').onchange({target:{dataset:{opt:'measure'},value:'self'}}); sd=E('side').innerHTML;
    say('"last lap against its own value" needs no other lane: compare with and which lane go away', w().opt.measure==='self' && !sd.includes('data-opt="compare"') && !sd.includes('data-opt="targetLane"') && sd.includes('data-opt="measure"') && sd.includes('data-opt="decimals"'));
    say('...and the whole sentence of the choice shows under the box (the box itself is narrow in the side panel)', /<span class="muted hint">This lane's last lap against its own personal best\.<\/span>/.test(sd));
    E('side').onchange({target:{dataset:{opt:'measure'},value:'live'}}); sd=E('side').innerHTML;
    say('...and back to the other two it comes back', sd.includes('data-opt="compare"') && sd.includes('data-opt="targetLane"') && /<option value="live" selected>/.test(sd));
    say('...and the sentence follows the choice', /<span class="muted hint">This lane's last lap against their personal best\.<\/span>/.test(sd) && !/against its own personal best\./.test(sd));
    E('side').oninput({target:{dataset:{opt:'targetLane'},value:'2',type:'select-one'}}); E('side').oninput({target:{dataset:{opt:'slowerColor'},value:'#ff00aa',type:'color'}}); E('side').oninput({target:{dataset:{opt:'arrow'},value:'down',type:'select-one'}}); E('side').oninput({target:{dataset:{opt:'style'},value:'outlined',type:'select-one'}});
    E('side').innerHTML=run('sideHtml()');
    say('a lane, a colour and the arrow are kept on the widget', w().opt.targetLane==='2' && w().opt.slowerColor==='#ff00aa' && w().opt.arrow==='down' && w().opt.style==='outlined' && E('side').innerHTML.includes('<option value="2" selected>Lane 2</option>') && E('side').innerHTML.includes('<option value="down" selected>') && E('side').innerHTML.includes('<option value="outlined" selected>') && E('side').innerHTML.includes('Only the outline and the text have the colour'));
    run("editorAdd('dsessionrecord')"); sd=E('side').innerHTML;
    say('a Session Record Delta compares with its record only: no compare with or lane, but who set it and the badge settings', !sd.includes('data-opt="compare"') && !sd.includes('data-opt="targetLane"') && sd.includes('data-opt="measure"') && sd.includes('data-opt="showName"') && sd.includes('data-opt="fasterColor"') && sd.includes('This lane\'s best lap against the session record'));
    run("editorAdd('dpitstop')"); sd=E('side').innerHTML;
    say('a Pitstop Time Delta has a single way to compare, said in a note, and no records to compare with', !sd.includes('data-opt="measure"') && sd.includes("This lane's pit stop time against theirs.") && sd.includes('The fastest pit stop') && !sd.includes('<option value="track"'));
    run("editorAdd('dlaptime')"); sd=E('side').innerHTML;
    say('a Laptime Delta has two ways to compare, and the settings of the Laptime widget (how long a finished lap stays)', (sd.match(/<select id="o-measure"[^>]*>(.*?)<\/select>/)||['',''])[1].split('<option').length===3 && sd.includes('data-opt="holdSeconds"') && sd.includes('data-opt="pbColor"'));
    run("editorAdd('dlaplap')"); sd=E('side').innerHTML;
    say('1.29.0: a Lap to Lap Delta says in a note what it compares (the last lap against the lap before it), has no choice of what, no lane and no "left value shows", the settings of the Laptime widget (how long a finished lap keeps its colour) and the badge settings', !sd.includes('data-opt="measure"') && !sd.includes('data-opt="compare"') && !sd.includes('data-opt="targetLane"') && !sd.includes('data-opt="leftShows"') && sd.includes("This lane's last lap against the lap before it.") && sd.includes('data-opt="holdSeconds"') && sd.includes('data-opt="pbColor"') && sd.includes('data-opt="fasterColor"') && sd.includes('data-opt="decimals"') && E('canvas').innerHTML.includes('dlt-badge'));
    run("state.editing.sel=[state.editing.draft.widgets[0], state.editing.draft.widgets[state.editing.draft.widgets.length-1]]"); E('side').innerHTML=run('sideHtml()');
    say('with two different widgets selected no widget settings are shown (as for any two different widgets)', !E('side').innerHTML.includes('data-opt="measure"'));
    run("while(state.editing.draft.widgets.length && /^d/.test(state.editing.draft.widgets[state.editing.draft.widgets.length-1].type)) state.editing.draft.widgets.pop(); state.editing.sel=[]"); }
  // ---- Customization > Image Settings: saving a Start lights grid ----
  { const keep=store.imagesets.slice();
    run("editorLeave(); state.editing=null; state.tab='custom'; state.customSub='images'; imgEd=null"); await run('render()');
    await E('setupbox').onclick({target:{closest:()=>({id:'newset',dataset:{}})}}); E('is-kind').onchange({target:{value:'lights'}});
    E('is-name').oninput({target:{value:'Gantry'}});
    for(const k of ['on','off','yellow','yellow_2','red_1','red_5']) await E('setupbox').onchange({target:{dataset:{slot:k},files:[{}]}});
    E('setupbox').onclick({target:{closest:()=>({dataset:{clear:'red_5'}})}}); // (put in and taken out again: nothing is kept for it)
    const nG=calls.length; await E('is-save').onclick();
    const addG=calls.slice(nG).find(c=>c[0]==='add'&&c[1]==='imagesets');
    say('saving a Start lights set stores the grid: a picture under the key of its row and light, nothing for the empty cells', addG && addG[2].kind==='lights' && Object.keys(addG[2].images).sort().join()==='off,on,red_1,yellow,yellow_2' && addG[2].images.yellow_2==='data:pic' && Object.values(addG[2].images).every(v=>v));
    await E('is-back').onclick(); run("state.customSub='images'"); await run('render()');
    say('the list counts the pictures out of 54', E('setupbox').innerHTML.includes('Gantry') && E('setupbox').innerHTML.includes('5 of 54'));
    const gid=store.imagesets.find(x=>x.name==='Gantry').id;
    await E('setupbox').onclick({target:{closest:()=>({dataset:{edit:gid}})}});
    say('editing it again shows the pictures in their cells', E('setupbox').innerHTML.includes('data-clear="red_1"') && E('setupbox').innerHTML.includes('data-clear="yellow_2"') && (E('setupbox').innerHTML.match(/data-clear=/g)||[]).length===5);
    await E('is-back').onclick();
    // a set made before the grid (only Light on and Light off) opens in the grid with those two filled in
    store.imagesets.push({id:'old1',name:'Old lights',kind:'lights',images:{on:'data:ON',off:'data:OFF'}});
    run("state.customSub='images'"); await run('render()');
    await E('setupbox').onclick({target:{closest:()=>({dataset:{edit:'old1'}})}});
    say('a set from before the grid: Countdown and Lights off are in their cells, the cells of the Countdown row show Countdown dimmed, the other rows are plain round lights', (E('setupbox').innerHTML.match(/data-clear=/g)||[]).length===2 && E('setupbox').innerHTML.includes('data-clear="on"') && E('setupbox').innerHTML.includes('data-clear="off"') && E('setupbox').innerHTML.includes('title="Countdown, light 2: uses the Countdown picture"') && E('setupbox').innerHTML.includes('title="Red flag, light 2: a plain round light"'));
    await E('is-back').onclick();
    store.imagesets.length=0; keep.forEach(x=>store.imagesets.push(x));
  }
  // ---- Customization > Leaderboard rows ----
  run("editorLeave(); state.editing=null; state.tab='custom'; state.customSub='rows'"); await run('render()');
  say('Customization has a Leaderboard Editor sub-tab', E('customtabs').innerHTML.includes('Leaderboard Editor'));
  say('row design list: empty with a New button', E('setupbox').innerHTML.includes('id="newr"') && E('setupbox').innerHTML.includes('No row designs yet'));
  await E('setupbox').onclick({target:{closest:()=>({id:'newr',dataset:{}})}}); await new Promise(r=>setTimeout(r,20));
  const rd=()=>run('state.editing.draft');
  say('a new row design opens in the editor with the usual cells', rd().kind==='row' && rd().widgets.length===6 && rd().ratioW===1000 && rd().ratioH===70 && E('view').innerHTML.includes('New row design'));
  const bar=E('view').innerHTML;
  say('the row editor has row height, spacing, header and colours instead of proportions and lane colours', bar.includes('id="e-rowh"') && bar.includes('id="e-gap"') && bar.includes('id="e-header"') && bar.includes('id="e-rowcolors"') && !bar.includes('id="e-ratio"') && !bar.includes('id="e-lanecolors"') && bar.includes('Save row design'));
  say('only driver widgets are on offer', bar.includes('data-add="bestlap"') && bar.includes('data-add="name"') && !bar.includes('data-add="clock"') && !bar.includes('data-add="start"') && !bar.includes('data-add="leaderboard"'));
  say('the canvas is one row, the preview shows five states', E('canvas').style.aspectRatio==='1000 / 70' && (E('e-preview').innerHTML.match(/class="rrow /g)||[]).length===5);
  say('...and the text of its cells is fitted to the cells', ctx.__fits>0);
  say('cells show no lane badge or title', !E('canvas').innerHTML.includes('lw-lane') && !E('canvas').innerHTML.includes('lw-title'));
  run("editorAdd('fuel')");
  say('a widget can be added, with no lane', rd().widgets.length===7 && rd().widgets[6].lane===0 && rd().widgets[6].showTitle===false && E('canvas').innerHTML.includes('class="lw sel'));
  E('side').innerHTML=run('sideHtml()');
  const sd=E('side').innerHTML;
  say('its settings: exact place, header text, no lane or title switches', sd.includes('data-geo="x"') && sd.includes('data-geo="w"') && sd.includes('Header text') && !sd.includes('id="s-lane"') && !sd.includes('id="s-showtitle"'));
  E('side').oninput({target:{dataset:{geo:'x'},value:'300',type:'number'}});
  E('side').oninput({target:{dataset:{geo:'w'},value:'400',type:'number'}});
  say('place and size can be typed', rd().widgets[6].x===300 && rd().widgets[6].w===400);
  E('side').oninput({target:{dataset:{geo:'w'},value:'9000',type:'number'}});
  say('...but stay inside the row', rd().widgets[6].x+rd().widgets[6].w<=1000);
  E('side').oninput({target:{dataset:{geo:'w'},value:'7',type:'number'}}); E('side').oninput({target:{dataset:{geo:'h'},value:'6',type:'number'}});
  say('1.34.1: the width and height of a cell of the row can be typed down to 5 (a width of 7 and a height of 6 stay as typed; 2 becomes 5)', rd().widgets[6].w===7 && rd().widgets[6].h===6 && (E('side').oninput({target:{dataset:{geo:'w'},value:'2',type:'number'}}), E('side').oninput({target:{dataset:{geo:'h'},value:'1',type:'number'}}), rd().widgets[6].w===5 && rd().widgets[6].h===5));
  E('side').oninput({target:{dataset:{geo:'w'},value:'400',type:'number'}}); E('side').oninput({target:{dataset:{geo:'h'},value:'60',type:'number'}});
  E('e-rowh').oninput({target:{value:'100'}});
  say('row height changes the design and the canvas', rd().ratioH===100 && E('canvas').style.aspectRatio==='1000 / 100');
  E('e-radius').oninput({target:{value:'40'}});
  say('rounded corners: a setting, shown in the preview', rd().radius===40 && E('e-preview').innerHTML.includes('border-radius:4cqw'));
  E('e-gap').oninput({target:{value:'12'}}); E('e-header').onchange({target:{checked:true}});
  say('spacing and header', rd().gap===12 && rd().header===true && E('e-preview').innerHTML.includes('rrow-head'));
  await E('e-rowcolors').onclick();
  say('the colours dialog lists the states', E('dlg').innerHTML.includes('Row colours') && E('dlg').innerHTML.includes('Leader') && E('dlg').innerHTML.includes('In the pits') && E('dlg').innerHTML.includes('id="rc-leader-b"'));
  document.getElementById('rc-leader-b').value='#00aa00'; document.getElementById('rc-leader-t').value='#ffffff'; document.getElementById('rc-states').checked=true;
  ['rowText','rowBg','altBg','headerText','headerBg'].forEach(k=>{ document.getElementById('rc-'+k+'-th').checked=true; });
  ['out','pit','pen'].forEach(k=>{ document.getElementById('rc-'+k+'-t').value='#ffffff'; document.getElementById('rc-'+k+'-b').value='#222222'; });
  await E('rcform').onsubmit({preventDefault(){}});
  say('colours are applied', rd().leaderBg==='#00aa00' && rd().states===true && E('e-preview').innerHTML.includes('background:#00aa00'));
  E('e-name').oninput({target:{value:'Big screen'}});
  const nR=calls.length; await run('editorSave()');
  const addR=calls.slice(nR).find(c=>c[0]==='add'&&c[1]==='rowdesigns');
  say('saving stores the design as a row design', addR && addR[2].name==='Big screen' && addR[2].kind==='row' && addR[2].ratioH===100 && addR[2].gap===12 && addR[2].leaderBg==='#00aa00' && addR[2].widgets.length===7);
  run("editorLeave(); state.editing=null"); await run('render()');
  say('the list shows it', E('setupbox').innerHTML.includes('Big screen') && E('setupbox').innerHTML.includes('data-dup='));
  const id0=store.rowdesigns[0].id;
  await E('setupbox').onclick({target:{closest:()=>({dataset:{dup:id0}})}}); await new Promise(r=>setTimeout(r,20));
  say('duplicate makes a copy', store.rowdesigns.length===2 && store.rowdesigns[1].name==='Big screen (copy)');
  await E('setupbox').onclick({target:{closest:()=>({dataset:{edit:id0}})}}); await new Promise(r=>setTimeout(r,20));
  say('edit opens it again with its settings', rd().kind==='row' && rd().ratioH===100 && rd().widgets.length===7 && E('view').innerHTML.includes('Edit row design') && E('view').innerHTML.includes('value="100"'));
  // choosing a design in the leaderboard widget
  run("editorLeave(); state.editing=null; state.customSub='layouts'"); await openEditor(); run("editorAdd('leaderboard')");
  let slb=E('side').innerHTML;
  say('the leaderboard widget offers the row designs and the classic columns', slb.includes('data-opt="design"') && slb.includes('Big screen') && slb.includes('Classic table') && slb.includes('data-opt="colLast"'));
  E('side').onchange({target:{dataset:{opt:'design'},value:id0}});
  slb=E('side').innerHTML;
  say('with a design chosen the classic column choices are hidden', run('state.editing.draft.widgets[0].opt.design')===id0 && !slb.includes('data-opt="colLast"') && slb.includes('data-opt="design"'));
  { // 1.19.0: the leaderboard can be ordered by a value
    const lbH = () => E('side').innerHTML;
    say('1.19.0: the leaderboard widget has "Order by" (the race position is chosen) and no "Best or worst on top" yet, with a design and without', /<select id="o-orderBy"[^>]*>.*<option value="position" selected>Race position/.test(lbH()) && lbH().includes('<option value="best">Best lap') && lbH().includes('<option value="champ">Championship points') && lbH().includes('<option value="penpoints">Penalty points')
      && !lbH().includes('id="o-orderDir"') && lbH().includes('The rows follow the race: the leader on top.'));
    await E('side').onchange({ target: { dataset: { opt: 'orderBy' }, value: 'best', type: 'select-one' } });
    say('...choosing the best lap keeps it on the widget, and now "Best or worst on top" is offered with Best first chosen, and the hint says what is on top', run('state.editing.draft.widgets[0].opt.orderBy') === 'best' && /<select id="o-orderDir"[^>]*>.*<option value="best" selected>Best first/.test(lbH()) && lbH().includes('<option value="worst">Worst first') && lbH().includes('puts the fastest lap on top') && lbH().includes('<option value="best" selected>Best lap'));
    E('side').oninput({ target: { dataset: { opt: 'orderDir' }, value: 'worst', type: 'select-one' } });
    say('...Worst first is kept on the widget too', run('state.editing.draft.widgets[0].opt.orderDir') === 'worst');
    await E('side').onchange({ target: { dataset: { opt: 'orderBy' }, value: 'position', type: 'select-one' } });
    say('...and the direction is gone from the settings', !lbH().includes('id="o-orderDir"') && run('state.editing.draft.widgets[0].opt.orderBy') === 'position');
  }
  run("state.editing.draft.widgets.pop(); state.editing.sel = []");
  // choosing a timing device: the main process lists what it found, the person picks one, and the choice goes back
  {
    let ask=null; const picked=[]; api.onHwChoose=f=>{ask=f}; api.hwChosen=id=>picked.push(id);
    run("state.settings.tmLaneMap=undefined; renderHardwareSettings({innerHTML:'',querySelector:()=>mk()})");
    say('the hardware screen waits for the device list from the main process', typeof ask==='function');
    const done=ask('serial',[{displayName:'Trackmate A',portId:'COM3'},{displayName:'Other',portId:'COM4'}]); await new Promise(r=>setTimeout(r,5));
    say('the list of found devices is shown', E('hw-pick').innerHTML.includes('Trackmate A') && E('hw-pick').innerHTML.includes('data-pick="1"'));
    E('hw-pick').onclick({target:{closest:()=>({dataset:{pick:'1'}})}}); await done;
    say('the chosen device goes back to the main process', picked.join()==='COM4');
    delete api.onHwChoose; delete api.hwChosen;
  }
  // ids from a restored backup or an imported file are shown safely: a hostile id cannot add HTML to a page
  {
    const evil='x"><img src=x onerror=alert(1)>', shown='x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;';
    run("state.editing=null"); const keep=JSON.stringify(store);
    Object.assign(store,{ tracks:[{id:evil,name:'T',lanes:2}], drivers:[{id:evil,name:'D'}], slotcars:[{id:evil,brand:'B'}], racesetups:[{id:evil,name:'S',track:evil,sessionType:'race'}], layouts:[{id:evil,name:'L',widgets:[]}], rowdesigns:[{id:evil,name:'R',kind:'row',widgets:[]}],
      imagesets:[{id:evil,name:'I',kind:'driver',images:[]}], audiosets:[{id:evil,name:'A',calls:{}}], customwidgets:[{id:evil,name:'W',type:'textlane',text:'{name}'}],
      sessions:[{id:evil,date:'2026-01-01T10:00:00Z',setupName:'S',sessionType:'race',trackName:'T',standings:[{pos:1,driverId:evil,driverName:'D',carName:'B',laps:1,best:1000}]}], laps:[{id:evil,sessionId:evil,trackId:evil,driverId:evil,carId:evil,time:1000,lapNumber:1,date:'2026-01-01T10:00:00Z'}] });
    const screens=[['the database list',async()=>{run("state.tab='database'; state.sub='tracks'; state.settings.dbView='list'"); await run('render()'); return E('subview').innerHTML;}],
      ['the database cards',async()=>{run("state.settings.dbView='grid'"); await run('render()'); run("state.settings.dbView='list'"); return E('subview').innerHTML;}],
      ['the results',async()=>{const b={innerHTML:''}; await run('renderResultsPool')(b, 'racing'); return b.innerHTML;}],
      ['the layouts',async()=>{const b={innerHTML:''}; await run('renderLayoutList')(b); return b.innerHTML;}],
      ['the row designs',async()=>{const b={innerHTML:''}; await run('renderRowList')(b); return b.innerHTML;}],
      ['the picture sets',async()=>{const b={innerHTML:''}; await run('renderImageSets')(b); return b.innerHTML;}],
      ['the audio sets',async()=>{const b={innerHTML:''}; await run('renderAudioSets')(b); return b.innerHTML;}],
      ['the widgets',async()=>{const b={innerHTML:''}; await run('renderWidgetBuilder')(b); return b.innerHTML;}],
      ['Home',async()=>{run("state.tab='home'"); await run('render()'); return E('view').innerHTML;}]];
    for (const [name,draw] of screens) { const html=await draw(); say(name+' show a hostile id as plain text', html.includes(shown) && !html.includes('"><img')); }
    Object.keys(store).forEach(k=>delete store[k]); Object.assign(store,JSON.parse(keep));
  }

  // ================= the Leaderboard widget with a row design, in the Layout Editor =================
  {
    const prevRD=store.rowdesigns, W=()=>widgets()[0], canvasHas=t=>E('canvas').innerHTML.includes(t), rrows=()=>(E('canvas').innerHTML.match(/class="rrow /g)||[]).length;
    store.rowdesigns=[{...run('Rows.defaultDesign()'),id:'RD1',name:'Wide rows'},{...run('Rows.defaultDesign()'),id:'RD2',name:'With header',header:true,headerH:40},
      run(`(() => { const d = Rows.defaultDesign(); d.id = 'RD3'; d.name = 'Far points'; const g = (type, x, w) => { const c = Widgets.newWidget(type, 0, x, 5); c.x = x; c.w = w; c.h = 60; c.textSize = 30; c.showTitle = false; return c; };
        d.widgets = [g('position', 5, 70), g('driverflag', 80, 70), g('callsign', 155, 100), g('champpoints', 780, 200)]; return d; })()`)];
    await openEditor(); run("editorAdd('leaderboard')"); run('state.editing.sel=[state.editing.draft.widgets[0]]'); run('renderEditor()');
    say('the classic table needs no fitting', (ctx.__fits=0, run('renderEditor()'), ctx.__fits===0));
    say('without a row design the widget shows the classic table, with the column choices and no size slider', canvasHas('<table') && !canvasHas('rrows') && E('side').innerHTML.includes('data-opt="colLast"') && !E('side').innerHTML.includes('id="o-scale"'));
    await E('side').onchange({target:{id:'o-design',value:'RD1',dataset:{opt:'design'},type:'select-one'}});
    say('choosing a row design makes the widget in the editor show those rows, with sample drivers', W().opt.design==='RD1' && canvasHas('rrows') && !canvasHas('<table') && rrows()===8 && canvasHas('>Alex<') && canvasHas('--rtot:602;--rk:1'));
    say('...the text of its cells is fitted to the cells in the layout too', ctx.__fits>0);
    say('...the column choices go away and the size slider appears, at 100%', !E('side').innerHTML.includes('data-opt="colLast"') && E('side').innerHTML.includes('id="o-scale"') && E('side').innerHTML.includes('Size of the rows') && E('side').innerHTML.includes('<output id="o-scale-v">100%</output>') && E('side').innerHTML.includes('type="range" min="20" max="100"'));
    const n0=run('state.editing.history.stats()').undo;
    ['90','75','60'].forEach(v=>E('side').oninput({target:{id:'o-scale',value:v,dataset:{opt:'scale',unit:'%'},type:'range'}}));
    say('moving the slider stores a number, shows the figure beside it and shrinks the rows in the layout at once', W().opt.scale===60 && typeof W().opt.scale==='number' && E('o-scale-v').textContent==='60%' && canvasHas('--rk:0.6') && W().opt.design==='RD1');
    E('e-undo').onclick(); say('...and one go of the slider is one step to undo (the Undo button)', W().opt.scale===undefined && canvasHas('--rk:1') && run('state.editing.history.stats().undo')===n0 && E('side').innerHTML.includes('<output id="o-scale-v">100%</output>'));
    E('e-redo').onclick(); say('...and it comes back with Redo', W().opt.scale===60 && canvasHas('--rk:0.6'));
    // the blank space between the columns of a design whose points are far from its callsign
    await E('side').onchange({target:{id:'o-design',value:'RD3',dataset:{opt:'design'},type:'select-one'}});
    say('with a row design there is also the slider for the space between the columns, at 100%: the rows are as designed', E('side').innerHTML.includes('id="o-gaps"') && E('side').innerHTML.includes('Space between the columns') && E('side').innerHTML.includes('<output id="o-gaps-v">100%</output>') && E('side').innerHTML.includes('id="o-gaps" type="range" min="0" max="100"') && !canvasHas('--rw') && canvasHas('aspect-ratio:1000 / 70'));
    const g0=run('state.editing.history.stats()').undo;
    ['70','30','0'].forEach(v=>E('side').oninput({target:{id:'o-gaps',value:v,dataset:{opt:'gaps',unit:'%'},type:'range'}}));
    say('pulling it to 0 closes up the blank space: the widget shows narrower rows at once, with the size choice kept', W().opt.gaps===0 && typeof W().opt.gaps==='number' && E('o-gaps-v').textContent==='0%' && canvasHas('--rtot:602;--rk:0.6;--rw:470') && canvasHas('aspect-ratio:470 / 70') && !canvasHas('aspect-ratio:1000 / 70') && W().opt.scale===60);
    E('e-undo').onclick(); say('...one go of the slider is one step: Undo puts the blank space back', W().opt.gaps===undefined && !canvasHas('--rw') && canvasHas('aspect-ratio:1000 / 70') && run('state.editing.history.stats().undo')===g0 && E('side').innerHTML.includes('<output id="o-gaps-v">100%</output>'));
    E('e-redo').onclick(); say('...and Redo closes it again', W().opt.gaps===0 && canvasHas('--rw:470'));
    // Fill the frame: off, taller rows, more space between the rows
    { const side=()=>E('side').innerHTML, pick=v=>E('side').oninput({target:{id:'o-fill',value:v,dataset:{opt:'fill'},type:'select-one'}});
      say('with a row design there is also the choice Fill the frame, with its explanation, off to begin with: the rows are as before', side().includes('id="o-fill"') && side().includes('Fill the frame') && side().includes('<option value="off" selected>Off: the rows keep the shape of the design</option>') && side().includes('<option value="rows">Taller rows</option>') && side().includes('<option value="gaps">More space between the rows</option>') && side().includes('class="muted hint">In a tall frame the rows keep the shape') && !canvasHas('data-fill'));
      const f0=run('state.editing.history.stats()').undo; pick('rows');
      say('choosing Taller rows stores it and the widget in the layout shows it at once, with the size and the closed-up columns kept', W().opt.fill==='rows' && canvasHas('<div class="rrows" data-fill="rows" style="--rtot:602;--rk:0.6;--rw:470">') && W().opt.scale===60 && W().opt.gaps===0 && W().opt.design==='RD3');
      pick('gaps'); say('...More space between the rows shows too', W().opt.fill==='gaps' && canvasHas('data-fill="gaps"') && !canvasHas('data-fill="rows"'));
      pick('off'); say('...and Off takes it away again (the rows are as before)', W().opt.fill==='off' && !canvasHas('data-fill') && canvasHas('--rtot:602;--rk:0.6;--rw:470"'));
      pick('rows'); pick('gaps');
      say('every choice is a step of its own (also when they come quickly after each other)', run('state.editing.history.stats()').undo===f0+5);
      E('e-undo').onclick(); say('Undo goes back one choice at a time (More space back to Taller rows)', W().opt.fill==='rows' && canvasHas('data-fill="rows"') && side().includes('<option value="rows" selected>Taller rows</option>'));
      E('e-undo').onclick(); E('e-undo').onclick(); E('e-undo').onclick(); E('e-undo').onclick(); say('...and all the way back to nothing chosen', W().opt.fill===undefined && !canvasHas('data-fill') && side().includes('<option value="off" selected>') && run('state.editing.history.stats()').undo===f0);
      E('e-redo').onclick(); say('...and Redo brings the first choice back', W().opt.fill==='rows' && canvasHas('data-fill="rows"'));
      await E('side').onchange({target:{id:'o-design',value:'RD2',dataset:{opt:'design'},type:'select-one'}});
      say('another design keeps the choice (it belongs to the widget, not to the design), and the header row is part of the board', W().opt.fill==='rows' && canvasHas('data-fill="rows"') && canvasHas('rrow-head') && canvasHas('--rtot:648;--rk:0.6'));
      await E('side').onchange({target:{id:'o-design',value:'',dataset:{opt:'design'},type:'select-one'}});
      say('the classic table has no such choice (and no frame to fill)', !side().includes('id="o-fill"') && canvasHas('<table') && !canvasHas('data-fill'));
      await E('side').onchange({target:{id:'o-design',value:'RD3',dataset:{opt:'design'},type:'select-one'}}); pick('off'); }
    await E('side').onchange({target:{id:'o-design',value:'RD2',dataset:{opt:'design'},type:'select-one'}});
    say('another design redraws the widget: its header row shows, the size stays', canvasHas('rrow-head') && canvasHas('>Position<') && canvasHas('--rtot:648;--rk:0.6'));
    await E('side').onchange({target:{id:'o-design',value:'',dataset:{opt:'design'},type:'select-one'}});
    say('back to the classic table: the table is back and so are the column choices, without the slider', canvasHas('<table') && !canvasHas('rrows') && E('side').innerHTML.includes('data-opt="colLast"') && !E('side').innerHTML.includes('id="o-scale"'));
    W().opt.design='gone'; run('renderEditor()');
    say('a design that has been deleted shows the classic table (as in the race)', canvasHas('<table') && !canvasHas('rrows'));
    // two leaderboards selected: the slider is for both
    W().opt.design='RD1'; run("editorAdd('leaderboard')"); run('state.editing.draft.widgets[1].opt={design:"RD1"}'); run('state.editing.sel=[...state.editing.draft.widgets]'); run('renderEditor()');
    E('side').oninput({target:{id:'o-scale',value:'40',dataset:{opt:'scale',unit:'%'},type:'range'}});
    say('with several leaderboards selected the size is set on all of them', widgets()[0].opt.scale===40 && widgets()[1].opt.scale===40);
    E('side').oninput({target:{id:'o-gaps',value:'20',dataset:{opt:'gaps',unit:'%'},type:'range'}});
    say('...and so is the space between the columns', widgets()[0].opt.gaps===20 && widgets()[1].opt.gaps===20 && E('o-gaps-v').textContent==='20%');
    E('side').oninput({target:{id:'o-fill',value:'gaps',dataset:{opt:'fill'},type:'select-one'}});
    say('...and so is Fill the frame', widgets()[0].opt.fill==='gaps' && widgets()[1].opt.fill==='gaps');
    // a slider of a widget's own does not touch the sliders of the side panel itself
    say('the size figure is the only text changed by the slider (the other figures of the panel are left alone)', !E('side').innerHTML.includes('o-scale-v">NaN'));
    store.rowdesigns=prevRD;
  }

  // ================= undo and redo in the editors =================
  {
    const hs=()=>run('state.editing.history.stats()'), wait=()=>new Promise(r=>setTimeout(r,20));
    const key=(k,o={})=>{ let pd=0; ctx.__k={key:k,target:{matches:()=>false},preventDefault(){pd++},...o}; run('editorKeyHandler(__k)'); return pd; };
    const undoKey=(o={})=>key('z',{ctrlKey:true,...o}), redoKey=(o={})=>key('y',{ctrlKey:true,...o});
    const box=(tag,type)=>({matches:s=>s.split(',').includes(tag),type});
    await openEditor();
    say('the toolbar has Undo and Redo with their keys in the tooltip, both off while there is nothing to undo', E('view').innerHTML.includes('id="e-undo"') && E('view').innerHTML.includes('id="e-redo"') && E('view').innerHTML.includes('(Ctrl+Z)') && E('view').innerHTML.includes('(Ctrl+Y)') && E('e-undo').disabled===true && E('e-redo').disabled===true);
    ['position','bestlap','name'].forEach(t=>run(`editorAdd('${t}')`));
    say('every widget added is a step of its own, and Undo lights up', hs().undo===3 && E('e-undo').disabled===false && E('e-redo').disabled===true);
    // the key that can be pressed by mistake
    run('state.editing.sel=[state.editing.draft.widgets[1]]'); const gone=run('state.editing.draft.widgets[1].type');
    run("editorKeyHandler({key:'Delete',target:{matches:()=>false}})");
    say('Delete removes the selected widget (no question asked)', widgets().length===2 && widgets().every(w=>w.type!==gone) && hs().undo===4);
    const histObj=run('state.editing.history'), pd=undoKey();
    say('Ctrl+Z brings it back, in its place, and selects it', pd===1 && widgets().length===3 && widgets()[1].type===gone && sel()===1 && run('state.editing.sel[0]')===widgets()[1] && E('e-msg').textContent==='Undone.' && E('canvas').innerHTML.includes('>Best lap<'));
    say('the editor is drawn again but keeps its steps, and Redo is on now', run('state.editing.history')===histObj && E('e-redo').disabled===false && E('e-undo').disabled===false);
    redoKey(); say('Ctrl+Y does it again (delete)', widgets().length===2 && E('e-msg').textContent==='Redone.');
    undoKey(); key('Z',{ctrlKey:true,shiftKey:true}); say('Ctrl+Shift+Z is Redo too', widgets().length===2);
    key('z',{metaKey:true}); say('Cmd+Z works as Ctrl+Z (Mac)', widgets().length===3);
    E('e-undo').onclick(); say('the Undo button undoes the step before', widgets().length===2 && widgets().map(w=>w.type).join()==='position,bestlap');
    E('e-redo').onclick(); say('the Redo button redoes it', widgets().length===3);
    for(let i=0;i<10;i++) undoKey();
    say('undoing all the way gives the empty layout, and then says so', widgets().length===0 && E('e-undo').disabled===true && E('e-msg').textContent==='Nothing to undo.' && hs().undo===0);
    for(let i=0;i<10;i++) redoKey();
    say('redoing all the way ends where you were, and then says so', widgets().length===2 && E('e-redo').disabled===true && E('e-msg').textContent==='Nothing to redo.');
    run("editorAdd('lap')"); say('a new change ends the redo list', E('e-redo').disabled===true && widgets().length===3);

    // one drag is one step, however many moves it has
    await openEditor(); run("editorAdd('bestlap')"); run('state.editing.sel=[]');
    const p0={x:widgets()[0].x,y:widgets()[0].y}, n0=hs().undo;
    E('canvas').onpointerdown(onW(0,{clientX:100,clientY:100}));
    const mv=(listeners.pointermove||[]).slice(-1)[0], up=(listeners.pointerup||[]).slice(-1)[0];
    for(let i=1;i<=6;i++) mv({clientX:100+i*30,clientY:100+i*10});
    say('while the mouse is held a drag is not a step yet', widgets()[0].x>p0.x && hs().undo===n0 && E('e-undo').disabled===false);
    up(); say('letting go ends it: six moves are one step', hs().undo===n0+1);
    undoKey(); say('one Ctrl+Z puts the widget back where it was', widgets()[0].x===p0.x && widgets()[0].y===p0.y);
    say('...and selects the widget that moved back, so you see what was undone', sel()===1 && run('state.editing.sel[0]')===widgets()[0]);
    redoKey(); say('...and one Ctrl+Y moves it again', widgets()[0].x>p0.x);

    // typing and sliders: changed all the time, undone in one go
    run('state.editing.sel=[state.editing.draft.widgets[0]]'); const before=widgets()[0].textSize;
    ['40','45','50'].forEach(v=>E('side').oninput({target:{id:'s-size',value:v,dataset:{},type:'number'}}));
    say('a slider (or typed numbers) changes at once, and is one step for undo', widgets()[0].textSize===50 && (undoKey(), widgets()[0].textSize===before));
    // single actions in the side panel are steps of their own
    run('state.editing.sel=[state.editing.draft.widgets[0]]'); const nb=hs().undo;
    E('side').onchange({target:{id:'s-tbold',checked:true,dataset:{}}}); E('side').onchange({target:{id:'s-vital',checked:true,dataset:{}}});
    say('two tick boxes pressed quickly are two steps', hs().undo===nb+2 && widgets()[0].titleBold===true && widgets()[0].valueItalic===true);
    undoKey(); say('Ctrl+Z undoes only the last of them', widgets()[0].titleBold===true && widgets()[0].valueItalic!==true);
    { const n=hs().undo; E('side').oninput({target:{dataset:{opt:'demo'},type:'checkbox',checked:true}}); E('side').oninput({target:{dataset:{opt:'demo'},type:'checkbox',checked:false}});
      say('a tick box of a widget\'s own settings is a step each time, not merged with the next', hs().undo===n+2 && (undoKey(), widgets()[0].opt.demo===true)); }

    // Ctrl+Z while typing in a text box is the browser's own; a slider or tick box that still has focus leaves it to the editor
    E('e-name').oninput({target:{value:'Hello'}});
    say('typing in a text box: Ctrl+Z is left to the browser (it undoes the typing)', [['input','text'],['input','number'],['textarea']].every(([t,ty])=>undoKey({target:box(t,ty)})===0) && run('state.editing.draft.name')==='Hello');
    say('...but with a slider, tick box, colour or list in focus it is the editor\'s', ['range','checkbox','color'].map(ty=>[ty]).length===3 && undoKey({target:box('input','range')})===1 && run('state.editing.draft.name')!=='Hello');
    run("editorAdd('lap')"); { const n=widgets().length; say('with a tick box in focus Ctrl+Z works', undoKey({target:box('input','checkbox')})===1 && widgets().length===n-1); run("editorAdd('lap')"); say('...and with a list in focus', undoKey({target:box('select')})===1 && widgets().length===n-1); }
    // a dialog on top
    run("editorAdd('lap')"); { const n=widgets().length; E('dlg').open=true; const pd2=undoKey(); E('dlg').open=false;
      say('while a dialog is open Ctrl+Z leaves the editor under it alone', pd2===0 && widgets().length===n); undoKey(); say('...and works again when it is closed', widgets().length===n-1); }

    // the other single actions: duplicate, a saved widget, guidelines
    await openEditor(); run("editorAdd('bestlap')"); run('state.editing.sel=[state.editing.draft.widgets[0]]'); const nd=hs().undo;
    E('side').onclick({target:{closest:()=>({id:'s-dup'})}});
    say('Duplicate is one step, and undo removes the copy', hs().undo===nd+1 && widgets().length===2 && (undoKey(), widgets().length===1));
    run("state.editing.customWidgets=[{id:'cw1',name:'Best lap line',type:'textlane',text:'{name}: {best}',w:320,h:70,textSize:44,valueBold:false,valueItalic:true}]"); run('renderEditor()'); await wait();
    const nc=hs().undo; run("editorAddCustom('cw1')");
    say('a saved widget is one step: undo takes the whole widget away, not only its look', hs().undo===nc+1 && widgets().length===2 && (undoKey(), widgets().length===1));
    E('e-guides').onclick(); document.getElementById('g-n').value='3'; document.getElementById('g-dir-v').checked=true; document.getElementById('g-dir-h').checked=false; document.getElementById('g-dir-b').checked=false;
    await E('gform').onsubmit({preventDefault(){}});
    say('placing guidelines is a step', run('state.editing.draft.guides.v.length')===2 && (undoKey(), run('state.editing.draft.guides.v.length')===0 && !E('canvas').innerHTML.includes('class="gl')));
    redoKey(); E('e-guides').onclick(); say('turning them off is a step too', run('state.editing.draft.guides.v.length')===0 && (undoKey(), run('state.editing.draft.guides.v.length')===2));

    // pictures are kept once, however many steps
    await openEditor(); run("state.editing.draft.bgImage='data:image/png;base64,'+'A'.repeat(200000)");
    for(let i=0;i<6;i++) run("editorAdd('bestlap')");
    say('a big background picture in many steps does not fill the memory: it is kept once', hs().undo===6 && hs().chars<40000 && hs().pictures===1);
    undoKey(); undoKey(); undoKey();
    say('...and it is still there, whole, after undoing', run('state.editing.draft.bgImage.length')===200022 && widgets().length===3);

    // unsaved changes: undoing back to what is saved is clean again
    await openEditor(); run("editorAdd('bestlap')"); E('e-name').oninput({target:{value:'Undo test'}});
    await run('editorSave()'); const savedId=run('state.editing.id');
    say('after saving, nothing is unsaved', run('editorDirty()')===false);
    run("editorAdd('name')"); say('a change is unsaved', run('editorDirty()')===true);
    undoKey(); say('undoing back to what is saved: nothing is unsaved any more (leaving asks nothing)', run('editorDirty()')===false && widgets().length===1);
    redoKey(); say('redo: unsaved again', run('editorDirty()')===true);
    undoKey(); undoKey(); say('undoing past what is saved: unsaved', run('editorDirty()')===true && run('state.editing.draft.name')!=='Undo test');
    const oldHist=run('state.editing.history'); run("editorLeave()"); await run('render()');
    say('leaving the editor forgets its steps', run('state.editing')===null && oldHist.stats().undo===0 && !oldHist.canUndo());
    await E('setupbox').onclick({target:{closest:()=>({dataset:{edit:savedId}})}}); await wait();
    say('a layout opened from the list starts with no steps and nothing unsaved', run('state.editing.id')===savedId && hs().undo===0 && run('editorDirty()')===false && E('e-undo').disabled===true);
    run("editorAdd('lap')"); say('a change is unsaved', run('editorDirty()')===true);
    undoKey(); say('...and undoing it makes it clean again', run('editorDirty()')===false);

    // the leaderboard (row) editor has the same
    run("editorLeave(); state.editing=null; state.customSub='rows'"); await run('render()');
    await E('setupbox').onclick({target:{closest:()=>({id:'newr',dataset:{}})}}); await wait();
    say('the row editor has Undo and Redo too', E('view').innerHTML.includes('id="e-undo"') && E('e-undo').disabled===true);
    E('e-header').onchange({target:{checked:true}}); say('the header tick box is a step', run('state.editing.draft.header')===true && hs().undo===1);
    undoKey(); say('...and undo switches the header off again', !run('state.editing.draft.header'));
    E('e-rowh').oninput({target:{value:'100'}}); E('e-gap').oninput({target:{value:'12'}});
    undoKey(); say('row height and spacing changed together are one step', run('state.editing.draft.ratioH')===70 && run('state.editing.draft.gap')!==12);
    redoKey(); say('...and redone together', run('state.editing.draft.ratioH')===100 && run('state.editing.draft.gap')===12);
    run("editorAdd('fuel')"); { const n=widgets().length; run('state.editing.sel=[state.editing.draft.widgets[state.editing.draft.widgets.length-1]]'); E('side').onclick({target:{closest:()=>({id:'s-del'})}});
      say('the Remove button of a row cell is a step too', widgets().length===n-1 && (undoKey(), widgets().length===n)); }
    await run('editorSave()'); say('a saved row design: nothing is unsaved', run('editorDirty()')===false);
    run("editorAdd('lap')"); say('...a change is unsaved', run('editorDirty()')===true); undoKey(); say('...and undoing back to the saved row design is clean again', run('editorDirty()')===false);
    run("editorLeave(); state.editing=null; state.customSub='layouts'");
  }

  // ================= undo and redo in Audio Settings, Image Settings and the Widget Builder =================
  {
    const key=(k,o={})=>{ let pd=0; ctx.__k={key:k,target:{matches:()=>false},preventDefault(){pd++},...o}; run('draftKeyHandler(__k)'); return pd; };
    const undoKey=(o={})=>key('z',{ctrlKey:true,...o}), redoKey=(o={})=>key('y',{ctrlKey:true,...o});
    const boxOf=(tag,type)=>({matches:s=>s.split(',').includes(tag),type});
    const hs=ed=>run(ed+'.history.stats()'), html=()=>E('setupbox').innerHTML, wait=()=>new Promise(r=>setTimeout(r,20));
    const open=async(sub,newId)=>{ run("state.editing=null; state.tab='custom'; state.customSub='"+sub+"'"); await run('render()'); await E('setupbox').onclick({target:{closest:()=>({id:newId,dataset:{}})}}); };

    // ---------- Audio Settings ----------
    run('audEd=null'); await open('audio','newaud');
    say('the audio set editor has Undo and Redo, with their keys in the tooltip, both off to begin with', html().includes('id="au-undo"') && html().includes('id="au-redo"') && html().includes('Undo the last change (Ctrl+Z)') && html().includes('Redo (Ctrl+Y)') && E('au-undo').disabled===true && E('au-redo').disabled===true);
    const rate0=run('audEd.draft.rate'), by0=run('audEd.draft.driverBy');
    E('au-rate').onchange({target:{value:'1.5'}});
    say('a change of the speed is a step, and Undo lights up', run('audEd.draft.rate')===1.5 && hs('audEd').undo===1 && E('au-undo').disabled===false && E('au-redo').disabled===true);
    E('au-undo').onclick(); say('the Undo button puts the speed back, and says so', run('audEd.draft.rate')===rate0 && E('au-msg').textContent==='Undone.' && E('au-undo').disabled===true && E('au-redo').disabled===false && html().includes('id="au-rate"'));
    E('au-redo').onclick(); say('Redo brings it again', run('audEd.draft.rate')===1.5 && E('au-msg').textContent==='Redone.' && E('au-redo').disabled===true);
    E('au-undo').onclick(); E('au-undo').onclick(); say('nothing more to undo: it says so and changes nothing', E('au-msg').textContent==='Nothing to undo.' && run('audEd.draft.rate')===rate0);
    E('au-by').onchange({target:{value:'callsign'}}); E('au-voice').onchange({target:{value:'Hazel'}}); E('au-vol').onchange({target:{value:'0.4'}});
    say('every change is a step of its own, also when they come quickly after each other (the way drivers are said, the voice, the volume)', hs('audEd').undo===3 && run('audEd.draft.driverBy')==='callsign' && run('audEd.draft.voice')==='Hazel' && run('audEd.draft.volume')===0.4);
    undoKey(); undoKey(); undoKey(); say('...and Ctrl+Z undoes them one by one', run('audEd.draft.volume')!==0.4 && run('audEd.draft.voice')!=='Hazel' && run('audEd.draft.driverBy')===by0);
    redoKey(); say('Ctrl+Y redoes one', run('audEd.draft.driverBy')==='callsign' && run('audEd.draft.voice')!=='Hazel'); undoKey(); key('Z',{ctrlKey:true,shiftKey:true}); say('Ctrl+Shift+Z is Redo too', run('audEd.draft.driverBy')==='callsign');
    undoKey();
    // a call turned off, a sentence added and deleted
    await E('setupbox').onchange({target:{dataset:{on:'newleader'},checked:false}});
    say('turning a call off is a step, and the editor shows it', run('audEd.draft.calls.newleader.on')===false && /data-on="newleader"(?! checked)/.test(html()));
    undoKey(); say('...undoing turns it on again, in the editor too (the folder is drawn again from the remembered state)', run('audEd.draft.calls.newleader.on')!==false && /data-on="newleader" checked/.test(html()));
    const n0=run('audEd.draft.calls.newleader.lines.length');
    await E('setupbox').onclick({target:{closest:()=>({dataset:{addline:'newleader'}})}}); say('a sentence added is a step', run('audEd.draft.calls.newleader.lines.length')===n0+1);
    undoKey(); say('...undone', run('audEd.draft.calls.newleader.lines.length')===n0 && (html().match(/data-text="newleader:/g)||[]).length===n0);
    const line0=run('audEd.draft.calls.newleader.lines[0].text');
    await E('setupbox').onclick({target:{closest:()=>({dataset:{delline:'newleader:0'}})}}); say('a sentence deleted is a step', run('audEd.draft.calls.newleader.lines.length')===n0-1);
    undoKey(); say('...and Undo brings the sentence back with its words, in its place', run('audEd.draft.calls.newleader.lines.length')===n0 && run('audEd.draft.calls.newleader.lines[0].text')===line0);
    // typing: a typed sentence is one step (after a quiet moment), and a text box has its own Ctrl+Z
    E('setupbox').oninput({target:{dataset:{text:'newleader:0'},value:'Hel'}}); E('setupbox').oninput({target:{dataset:{text:'newleader:0'},value:'Hello'}}); E('au-name').oninput({target:{value:'Weekend commentator'}});
    const u0=hs('audEd').undo; undoKey(); say('what is typed before the quiet moment is one step: Undo takes back the sentence and the name together', run('audEd.draft.calls.newleader.lines[0].text')===line0 && run('audEd.draft.name')!=='Weekend commentator' && hs('audEd').undo===u0);
    redoKey(); say('...and Redo brings them back', run('audEd.draft.calls.newleader.lines[0].text')==='Hello' && run('audEd.draft.name')==='Weekend commentator');
    { const before=run('audEd.draft.name'); const pd=key('z',{ctrlKey:true,target:boxOf('input','text')}); say('in a text box Ctrl+Z is left to the box (the browser\'s own undo): the editor does nothing', pd===0 && run('audEd.draft.name')===before && run('audEd.draft.calls.newleader.lines[0].text')==='Hello');
      const pd2=key('z',{ctrlKey:true,target:boxOf('input','checkbox')}); say('...but a tick box or a slider is not a text box: the editor takes it', pd2===1 && run('audEd.draft.name')!==before); redoKey(); }
    say('other keys do nothing: Z without Ctrl, Ctrl+Q', key('z')===0 && key('q',{ctrlKey:true})===0);
    // saved or not
    say('a new audio set that was never saved is unsaved, also when everything is undone', (()=>{ for(let i=0;i<30;i++) undoKey(); return run('audEd.draft.rate')===rate0 && run('audEd.draft.driverBy')===by0 && hs('audEd').undo===0 && run('audEd.dirty')===true; })());
    E('au-rate').onchange({target:{value:'1.2'}}); E('au-pitch').onchange({target:{value:'0.8'}});
    const nA=calls.length; await E('au-save').onclick(); const addA=calls.slice(nA).find(c=>c[0]==='add'&&c[1]==='audiosets');
    say('saving stores what the editor shows now', addA && addA[2].rate===1.2 && addA[2].pitch===0.8 && run('audEd.dirty')===false && run('audEd.history.isClean()')===true);
    E('au-vol').onchange({target:{value:'0.3'}}); say('a change after saving is unsaved', run('audEd.dirty')===true);
    undoKey(); say('...and undoing it is clean again (nothing to save any more)', run('audEd.dirty')===false);
    undoKey(); say('undoing past what was saved is unsaved again', run('audEd.dirty')===true && run('audEd.draft.pitch')!==0.8);
    redoKey(); say('...and clean again after Redo to the saved state', run('audEd.dirty')===false && run('audEd.draft.pitch')===0.8);
    // when the editor is not on the screen (another page is shown), the keys do nothing
    { const ge=document.getElementById; document.getElementById=id=>id==='au-undo'?null:ge(id); const r0=run('audEd.draft.pitch'), pd=undoKey(); document.getElementById=ge; say('the keys do nothing while the editor is not on the screen', pd===0 && run('audEd.draft.pitch')===r0); }
    { ctx.__dlgWas=run('dlg.open'); run('dlg.open=true'); const pd=undoKey(); run('dlg.open=__dlgWas'); say('...nor while a window (a dialog) is open', pd===0); }
    // leaving
    const hist1=run('audEd.history'); E('au-back').onclick();
    say('leaving the editor forgets its steps and takes its key off', run('audEd')===null && hist1.stats().undo===0 && !hist1.canUndo() && run('draftKeyHandler')===null);
    await run('render()'); { const id=store.audiosets[store.audiosets.length-1].id; await E('setupbox').onclick({target:{closest:()=>({dataset:{edit:id}})}});
      say('a set opened from the list starts with no steps and nothing unsaved', hs('audEd').undo===0 && run('audEd.dirty')===false && E('au-undo').disabled===true && E('au-redo').disabled===true);
      E('au-pitch').onchange({target:{value:'1.9'}}); say('...a change there is unsaved, and undoing it is clean', run('audEd.dirty')===true && (undoKey(), run('audEd.dirty')===false));
      E('au-back').onclick(); }

    // ---------- Image Settings ----------
    run('imgEd=null; resizeImage = async () => "data:pic"'); await open('images','newset');
    say('the picture set editor has Undo and Redo too, both off to begin with', html().includes('id="is-undo"') && html().includes('id="is-redo"') && E('is-undo').disabled===true && E('is-redo').disabled===true && html().includes('(Ctrl+Z)'));
    E('is-steps').onchange({target:{value:'4'}}); say('the number of pictures is a step', (html().match(/data-slot=/g)||[]).length===4 && hs('imgEd').undo===1);
    E('is-undo').onclick(); say('Undo gives the ten slots back, and Redo the four', (html().match(/data-slot=/g)||[]).length===10 && E('is-msg').textContent==='Undone.' && (E('is-redo').onclick(), (html().match(/data-slot=/g)||[]).length===4));
    await E('setupbox').onchange({target:{dataset:{slot:'0'},files:[{}]}}); await E('setupbox').onchange({target:{dataset:{slot:'3'},files:[{}]}});
    say('every picture added is a step', (html().match(/data-clear=/g)||[]).length===2 && hs('imgEd').undo===3);
    undoKey(); say('Ctrl+Z takes the last picture away', (html().match(/data-clear=/g)||[]).length===1 && run('imgEd.draft.images[3]')===undefined);
    E('setupbox').onclick({target:{closest:()=>({dataset:{clear:'0'}})}}); say('removing a picture is a step', (html().match(/data-clear=/g)||[]).length===0);
    undoKey(); say('...and Undo puts the picture back', (html().match(/data-clear=/g)||[]).length===1 && run('imgEd.draft.images[0]')==='data:pic');
    E('is-name').oninput({target:{value:'Tank'}}); E('is-name').oninput({target:{value:'Tank pictures'}}); undoKey();
    say('a typed name is one step', run('imgEd.draft.name')==='New picture set');
    redoKey(); E('is-kind').onchange({target:{value:'flag'}});
    say('the kind of a new set is a step: a flag set has its seven states', (html().match(/data-slot=/g)||[]).length===7 && run('imgEd.draft.kind')==='flag');
    undoKey(); say('...and Undo goes back to the fuel set with its pictures', run('imgEd.draft.kind')==='fuel' && (html().match(/data-slot=/g)||[]).length===4 && (html().match(/data-clear=/g)||[]).length===1 && run('imgEd.draft.name')==='Tank pictures');
    // a big picture is kept once, however many steps hold it
    run('resizeImage = async () => "data:image/png;base64," + "A".repeat(5000)');
    for (const slot of ['1','2','3']) await E('setupbox').onchange({target:{dataset:{slot},files:[{}]}});
    say('a big picture is kept once, however many steps hold it', hs('imgEd').pictures===1 && (html().match(/data-clear=/g)||[]).length===4);
    undoKey(); undoKey(); say('...and the steps bring it back', (html().match(/data-clear=/g)||[]).length===2 && run('imgEd.draft.images[1].length')>5000);
    redoKey(); redoKey(); say('...forward too', (html().match(/data-clear=/g)||[]).length===4 && run('imgEd.draft.images[3].length')>5000);
    run('resizeImage = async () => "data:pic"');
    say('a new picture set that was never saved is unsaved, also at the start state', (()=>{ for(let i=0;i<30;i++) undoKey(); return run('imgEd.dirty')===true && hs('imgEd').undo===0; })());
    E('is-name').oninput({target:{value:'Saved tank'}}); const nIm=calls.length; await E('is-save').onclick();
    say('saving a set: nothing is unsaved', calls.slice(nIm).some(c=>c[0]==='add'&&c[1]==='imagesets') && run('imgEd.dirty')===false);
    E('is-steps').onchange({target:{value:'6'}}); say('a change after saving is unsaved', run('imgEd.dirty')===true); undoKey(); say('...and undoing it is clean', run('imgEd.dirty')===false);
    undoKey(); say('undoing past what was saved is unsaved again', run('imgEd.dirty')===true); redoKey(); say('...and clean after Redo', run('imgEd.dirty')===false);
    { const ge=document.getElementById; document.getElementById=id=>id==='is-undo'?null:ge(id); const before=run('imgEd.draft.name'), pd=undoKey(); document.getElementById=ge; say('the keys do nothing while the picture set editor is not on the screen', pd===0 && run('imgEd.draft.name')===before); }
    const hist2=run('imgEd.history'); E('is-back').onclick(); say('leaving the picture set editor forgets its steps', run('imgEd')===null && hist2.stats().undo===0 && run('draftKeyHandler')===null);
    await open('images','newset'); E('is-kind').onchange({target:{value:'avatars'}});
    say('Image Settings: a set of Avatars has eight slots, one for each lane, each showing the standard avatar of the lane until you add your own', (html().match(/data-slot=/g)||[]).length===8 && ['Lane 1','Lane 8'].every(t=>html().includes('<td>'+t+'</td>')) && (html().match(/class="optimg dim"/g)||[]).length===8 && html().includes('The Avatar widget shows the picture of the driver') && html().includes('keep their transparency') && html().includes('General > Pictures'));
    await E('setupbox').onchange({target:{dataset:{slot:'3'},files:[{}]}});
    say('...a picture added for lane 3 is kept under "3", and only that lane stops showing the standard avatar', run('imgEd.draft.images["3"]')==='data:pic' && (html().match(/class="optimg dim"/g)||[]).length===7 && (html().match(/data-clear=/g)||[]).length===1);
    E('is-name').oninput({target:{value:'Club drivers'}}); const nAv=calls.length; await E('is-save').onclick();
    say('...and it is saved as a set of the kind avatars with that picture', calls.slice(nAv).some(c=>c[0]==='add'&&c[1]==='imagesets'&&c[2].kind==='avatars'&&c[2].name==='Club drivers'&&c[2].images['3']==='data:pic'));
    E('is-back').onclick();
    // 1.5.0: picture sets for the Tyres, Weather Forecast and Track Conditions widgets
    await open('images','newset');
    say('Image Settings (1.5.0): the choices of what a set is for are fuel, flag, lights, avatars, tyres, weather, conditions', run('SET_KINDS.map(k=>k[0]).join()')==='fuel,flag,lights,avatars,tyres,weather,conditions' && ['Tyres (a picture per tyre)','Weather (a picture per state of the weather)','Track conditions (an icon per item)'].every(t=>html().includes(t)));
    E('is-kind').onchange({target:{value:'tyres'}});
    say('...a set of Tyres has six slots, one for each tyre with its code, each showing the standard drawn tyre dimmed until you add your own', (html().match(/data-slot=/g)||[]).length===6 && ['Hard (H)','Medium (M)','Soft (S)','Supersoft (SS)','Intermediate (INT)','Wet (W)'].every(t=>html().includes('<td>'+t+'</td>')) && (html().match(/class="setslot"/g)||[]).length===6 && (html().match(/<svg class="wxic"/g)||[]).length===6 && html().includes('drawn in the colours of Formula 1') && html().includes('Soft tyres'));
    say('...the table of the tyres is headed Tyre (and the tyres come in the order Hard, Medium, Soft, Supersoft, Intermediate, Wet)', html().includes('<th>Tyre</th>') && !html().includes('<th>Item</th>') && !html().includes('<th>State</th>') && ['Hard (H)','Medium (M)','Soft (S)','Supersoft (SS)','Intermediate (INT)','Wet (W)'].every((t,i,a)=>i===0||html().indexOf('<td>'+a[i-1]+'</td>')<html().indexOf('<td>'+t+'</td>')));
    await E('setupbox').onchange({target:{dataset:{slot:'SS'},files:[{}]}});
    say('...a picture added for the Supersoft is kept under "SS", and only that tyre stops showing the standard picture', run('imgEd.draft.images["SS"]')==='data:pic' && (html().match(/class="setslot"/g)||[]).length===5 && (html().match(/data-clear=/g)||[]).length===1);
    E('is-name').oninput({target:{value:'Rubber'}}); const nTy=calls.length; await E('is-save').onclick();
    say('...it is saved as a set of the kind tyres with that picture', calls.slice(nTy).some(c=>c[0]==='add'&&c[1]==='imagesets'&&c[2].kind==='tyres'&&c[2].name==='Rubber'&&c[2].images.SS==='data:pic'));
    E('is-back').onclick();
    await open('images','newset'); E('is-kind').onchange({target:{value:'weather'}});
    say('...a set of Weather has four slots: Dry, Cloudy, Wet and Clearing, with the drawn pictures dimmed', (html().match(/data-slot=/g)||[]).length===4 && ['Dry','Cloudy','Wet','Clearing'].every(t=>html().includes('<td>'+t+'</td>')) && (html().match(/class="setslot"/g)||[]).length===4 && (html().match(/<svg class="wxic"/g)||[]).length===4 && html().includes('One picture for each state of the weather'));
    say('...its table is headed State, the states in the order Dry, Cloudy, Wet, Clearing', html().includes('<th>State</th>') && !html().includes('<th>Tyre</th>') && !html().includes('<th>Item</th>') && html().indexOf('<td>Dry</td>')<html().indexOf('<td>Cloudy</td>') && html().indexOf('<td>Cloudy</td>')<html().indexOf('<td>Wet</td>') && html().indexOf('<td>Wet</td>')<html().indexOf('<td>Clearing</td>'));
    await E('setupbox').onchange({target:{dataset:{slot:'clearing'},files:[{}]}}); E('is-name').oninput({target:{value:'Skies'}}); const nWe=calls.length; await E('is-save').onclick();
    say('...and is saved as a set of the kind weather', calls.slice(nWe).some(c=>c[0]==='add'&&c[1]==='imagesets'&&c[2].kind==='weather'&&c[2].images.clearing==='data:pic'));
    E('is-back').onclick();
    await open('images','newset'); E('is-kind').onchange({target:{value:'conditions'}});
    say('...a set of Track conditions has four slots: track temperature, air temperature, wind speed and wind direction (to be drawn pointing up)', (html().match(/data-slot=/g)||[]).length===4 && ['Track temperature','Air temperature','Wind speed'].every(t=>html().includes('<td>'+t+'</td>')) && html().includes('Wind direction (draw it pointing up') && (html().match(/class="setslot"/g)||[]).length===4 && html().includes('Draw the wind direction pointing up'));
    say('...its table is headed Item, and the items come in the order track temperature, air temperature, wind speed, wind direction', html().includes('<th>Item</th>') && !html().includes('<th>Tyre</th>') && !html().includes('<th>State</th>') && html().indexOf('<td>Track temperature</td>')<html().indexOf('<td>Air temperature</td>') && html().indexOf('<td>Air temperature</td>')<html().indexOf('<td>Wind speed</td>') && html().indexOf('<td>Wind speed</td>')<html().indexOf('<td>Wind direction'));
    await E('setupbox').onchange({target:{dataset:{slot:'winddir'},files:[{}]}}); E('is-name').oninput({target:{value:'Gauges'}}); const nCo=calls.length; await E('is-save').onclick();
    say('...and is saved as a set of the kind conditions', calls.slice(nCo).some(c=>c[0]==='add'&&c[1]==='imagesets'&&c[2].kind==='conditions'&&c[2].images.winddir==='data:pic'));
    E('is-back').onclick();
    say('the list of the sets says how many pictures of how many each has (1 of 6 tyres, 1 of 4 for the weather and the conditions) and what each is for', await (async()=>{ await open('images'); const h=html(); return h.includes('Tyres (a picture per tyre)') && h.includes('Weather (a picture per state of the weather)') && h.includes('Track conditions (an icon per item)') && h.includes('>1 of 6<') && (h.match(/>1 of 4</g)||[]).length>=2; })());
    // switching to another tab of Customization closes the editor and forgets its steps
    await open('images','newset'); E('is-steps').onchange({target:{value:'5'}}); const hist3=run('imgEd.history'); ctx.__t={dataset:{id:'audio'}};
    await E('customtabs').onclick({target:{closest:()=>ctx.__t}});
    say('another tab of Customization closes the picture set editor and its steps (as it always closed it)', run('imgEd')===null && hist3.stats().undo===0 && run('draftKeyHandler')===null);

    // (0.75.0) ... but with changes that are not saved it asks first (with the same question as the Back button of that editor)
    { const asked=[]; let answer=false; ctx.confirm=m=>{ asked.push(m); return answer; };
      const tab=async id=>{ ctx.__t={dataset:{id}}; await E('customtabs').onclick({target:{closest:()=>ctx.__t}}); };
      store.imagesets.push({id:'iq1',name:'Saved one',kind:'fuel',steps:10,images:[]}); store.customwidgets=(store.customwidgets||[]); store.customwidgets.push({id:'wq1',name:'Saved line',type:'textlane',text:'{name}',w:300,h:60,textSize:40});
      const openEdit=async(sub,id)=>{ run("state.editing=null; state.tab='custom'; state.customSub='"+sub+"'"); await run('render()'); await E('setupbox').onclick({target:{closest:()=>({id:'',dataset:{edit:id}})}}); };
      // picture sets
      await openEdit('images','iq1'); const was=run('imgEd')!==null && run('imgEd.dirty')===false; await tab('audio');
      say('a saved picture set that you did not change is closed by another tab without asking', was && asked.length===0 && run('imgEd')===null && run('state.customSub')==='audio');
      await openEdit('images','iq1'); E('is-steps').onchange({target:{value:'5'}}); const h1=run('imgEd.history'); E('setupbox').innerHTML+='<!--still here-->'; await tab('audio');
      say('with changes that are not saved, another tab asks first (once), saying what would be lost', asked.length===1 && asked[0]==='Discard your unsaved changes to this picture set?');
      say('...and when you say no, the editor stays: same screen, same tab, same steps, the keys still work', run('imgEd')!==null && run('state.customSub')==='images' && E('setupbox').innerHTML.includes('<!--still here-->') && h1.stats().undo===1 && run('draftKeyHandler')!==null && run('imgEd.dirty')===true);
      undoKey(); say('...Undo still takes the change back, and then the set has no changes (no question)', run('imgEd.draft.steps')===10 && run('imgEd.dirty')===false);
      redoKey(); await tab('audio'); say('...asking again asks again (a second time, still no)', asked.length===2 && run('imgEd')!==null && run('state.customSub')==='images');
      answer=true; await tab('audio');
      say('when you say yes, the editor and its steps are gone and the other tab opens', asked.length===3 && run('imgEd')===null && h1.stats().undo===0 && run('draftKeyHandler')===null && run('state.customSub')==='audio');
      // a new set counts as unsaved (as it does for the Back button)
      answer=false; asked.length=0; await open('images','newset'); await tab('audio');
      say('a new picture set that was never saved is asked about too, as with Back', asked.length===1 && run('imgEd')!==null && run('state.customSub')==='images');
      // after saving there is nothing to lose
      asked.length=0; E('is-name').oninput({target:{value:'Saved set'}}); run('imgEd.history.commit()'); await E('is-save').onclick();
      const savedClean=run('imgEd.dirty')===false; await tab('layouts'); say('a picture set that was just saved is closed without asking', savedClean && asked.length===0 && run('imgEd')===null && run('state.customSub')==='layouts');
      // the same tab as the one you are on: its editor would be closed too
      asked.length=0; await openEdit('images','iq1'); E('is-steps').onchange({target:{value:'6'}}); await tab('images');
      say('clicking the Image Settings tab while its own editor has changes asks too', asked.length===1 && run('imgEd')!==null);
      answer=true; await tab('images'); await new Promise(r=>setTimeout(r,20)); say('...and says yes: the editor closes and the list of sets shows', asked.length===2 && run('imgEd')===null && run('state.customSub')==='images' && E('setupbox').innerHTML.includes('id="newset"'));
      // the widget builder
      answer=false; asked.length=0; await openEdit('widgets','wq1'); const wclean=run('wbEd')!==null && run('wbEd.dirty')===false; await tab('audio');
      say('a saved widget that you did not change is closed by another tab without asking', wclean && asked.length===0 && run('wbEd')===null && run('state.customSub')==='audio');
      await openEdit('widgets','wq1'); E('wb-size').onchange({target:{value:'44'}}); const h2=run('wbEd.history'); E('setupbox').innerHTML+='<!--wb still here-->'; await tab('rows');
      say('with changes that are not saved the widget builder asks first, in the same words as its Back button', asked.length===1 && asked[0]==='Discard your unsaved changes to this widget?');
      say('...and when you say no, the widget builder stays with its steps', run('wbEd')!==null && run('state.customSub')==='widgets' && E('setupbox').innerHTML.includes('<!--wb still here-->') && h2.stats().undo===1 && run('draftKeyHandler')!==null);
      undoKey(); say('...Undo still works', run('wbEd.draft.textSize')===40); redoKey();
      answer=true; await tab('rows'); say('...yes closes it and opens the other tab', asked.length===2 && run('wbEd')===null && h2.stats().undo===0 && run('state.customSub')==='rows' && run('draftKeyHandler')===null);
      // the Back button of the widget builder asks the same question
      answer=false; asked.length=0; await openEdit('widgets','wq1'); E('wb-size').onchange({target:{value:'45'}}); E('wb-back').onclick();
      say('the Back button of the widget builder asks the same question', asked.length===1 && asked[0]==='Discard your unsaved changes to this widget?' && run('wbEd')!==null);
      answer=true; E('wb-back').onclick(); say('...and yes leaves', run('wbEd')===null);
      // the audio editor is kept when you change tab (you come back to it), so there is nothing to ask
      answer=false; asked.length=0; run('audEd=null'); await open('audio','newaud'); E('au-rate').onchange({target:{value:'1.3'}}); await tab('layouts');
      say('the audio set editor, which stays open when you change tab, is not asked about', asked.length===0 && run('audEd')!==null && run('audEd.dirty')===true && run('state.customSub')==='layouts');
      run('audEd=null'); store.imagesets=store.imagesets.filter(x=>x.id!=='iq1'); store.customwidgets=store.customwidgets.filter(x=>x.id!=='wq1'); ctx.confirm=()=>true; run('imgEd=null; wbEd=null'); }

    // ---------- Widget Builder ----------
    run('wbEd=null'); await open('widgets','newwb');
    say('the widget builder has Undo and Redo too, both off to begin with', html().includes('id="wb-undo"') && html().includes('id="wb-redo"') && E('wb-undo').disabled===true && E('wb-redo').disabled===true);
    const size0=run('wbEd.draft.textSize'), text0=run('wbEd.draft.text');
    E('wb-size').onchange({target:{value:'44'}}); say('the text size is a step', run('wbEd.draft.textSize')===44 && hs('wbEd').undo===1);
    E('wb-undo').onclick(); say('Undo puts it back and the page shows it', run('wbEd.draft.textSize')===size0 && html().includes('id="wb-size" type="number" min="5" max="200" step="1" value="'+size0+'"') && E('wb-msg').textContent==='Undone.');
    E('wb-redo').onclick(); say('Redo brings it again', run('wbEd.draft.textSize')===44);
    E('wb-bold').onchange({target:{checked:false}}); E('wb-italic').onchange({target:{checked:true}}); say('bold and italic are steps of their own', hs('wbEd').undo===3 && run('wbEd.draft.valueBold')===false && run('wbEd.draft.valueItalic')===true);
    undoKey(); undoKey(); say('...and Ctrl+Z undoes them', run('wbEd.draft.valueBold')!==false && !run('wbEd.draft.valueItalic'));
    E('wb-text').oninput({target:{value:'{na'}}); E('wb-text').oninput({target:{value:'{name} {best}'}}); E('wb-name').oninput({target:{value:'My line'}}); undoKey();
    say('what is typed in the text and the name before the quiet moment is one step', run('wbEd.draft.text')===text0 && run('wbEd.draft.name')==='');
    redoKey(); say('...and redone', run('wbEd.draft.text')==='{name} {best}' && run('wbEd.draft.name')==='My line');
    E('wb-type').onchange({target:{value:'imagelane'}}); say('the kind is a step: an image widget with its rule list', html().includes('id="wb-addrule"') && !html().includes('id="wb-text"'));
    E('wb-addrule').onclick(); E('wb-addrule').onclick(); E('setupbox').onchange({target:{dataset:{rv:'0'},value:'position'}}); E('setupbox').onchange({target:{dataset:{rval:'0'},value:'1'}});
    say('rules added and changed are steps', (html().match(/data-rule="/g)||[]).length===2 && run('wbEd.draft.rules[0].var')==='position' && run('wbEd.draft.rules[0].value')==='1');
    E('setupbox').onclick({target:{closest:()=>({dataset:{rdel:'0'}})}}); say('a rule removed is a step', (html().match(/data-rule="/g)||[]).length===1);
    undoKey(); say('...and Undo brings it back, with its variable and value', (html().match(/data-rule="/g)||[]).length===2 && run('wbEd.draft.rules[0].var')==='position' && run('wbEd.draft.rules[0].value')==='1');
    undoKey(); undoKey(); undoKey(); undoKey(); say('Undo goes on: the value and variable of the rule, and the two rules added: back to an empty rule list', run('wbEd.draft.type')==='imagelane' && run('wbEd.draft.rules.length')===0 && html().includes('No rules yet'));
    undoKey(); say('...back to the text widget, with its text', run('wbEd.draft.type')==='textlane' && html().includes('id="wb-text"') && run('wbEd.draft.text')==='{name} {best}');
    for (let i=0;i<6;i++) undoKey(); say('a new widget that was never saved is unsaved, also at the start state', run('wbEd.dirty')===true && run('wbEd.draft.text')===text0 && hs('wbEd').undo===0);
    E('wb-name').oninput({target:{value:'Line one'}}); const nWb=calls.length; await E('wb-save').onclick();
    say('saving a widget: nothing is unsaved', calls.slice(nWb).some(c=>c[0]==='add'&&c[1]==='customwidgets') && run('wbEd.dirty')===false);
    E('wb-w').onchange({target:{value:'500'}}); say('a change after saving is unsaved', run('wbEd.dirty')===true); undoKey(); say('...and undoing it is clean', run('wbEd.dirty')===false);
    undoKey(); say('undoing past what was saved is unsaved again', run('wbEd.dirty')===true); redoKey(); say('...and clean after Redo', run('wbEd.dirty')===false);
    { const ge=document.getElementById; document.getElementById=id=>id==='wb-undo'?null:ge(id); const before=run('wbEd.draft.name'), pd=undoKey(); document.getElementById=ge; say('the keys do nothing while the widget builder is not on the screen', pd===0 && run('wbEd.draft.name')===before); }
    const hist4=run('wbEd.history'); E('wb-back').onclick(); await wait(); say('leaving the widget builder forgets its steps', run('wbEd')===null && hist4.stats().undo===0 && run('draftKeyHandler')===null);
    // ---------- more: single actions are steps of their own, typing is noted, the key is registered once ----------
    const live=new Set(), ae=document.addEventListener, re=document.removeEventListener;
    document.addEventListener=(t,f)=>{ if(t==='keydown') live.add(f); }; document.removeEventListener=(t,f)=>{ if(t==='keydown') live.delete(f); };
    const BIG='data:audio/mp3;base64,'+'A'.repeat(3000);
    ctx.FileReader=function(){ this.readAsDataURL=()=>{ this.result=BIG; setTimeout(()=>this.onload(),0); }; };
    run('audEd=null'); await open('audio','newaud'); E('au-undo').onclick(); E('au-rate').onchange({target:{value:'1.3'}}); E('au-redo').onclick(); E('au-undo').onclick();
    say('only one key handler is alive, however often the editor is drawn again', live.size===1);
    // the audio set editor
    E('au-pause').onchange({target:{value:'3'}}); E('au-dist').onchange({target:{value:'10'}}); E('au-by').onchange({target:{value:'nickname'}});
    undoKey(); say('the pause, the race distances and the way drivers are said are three steps: Undo takes back the last one only', run('audEd.draft.driverBy')!=='nickname' && run('audEd.draft.preDelay')===3 && run('audEd.draft.distances')==='10');
    undoKey(); say('...then the distances', run('audEd.draft.distances')!=='10' && run('audEd.draft.preDelay')===3); undoKey(); say('...then the pause', run('audEd.draft.preDelay')!==3);
    for(let i=0;i<9;i++) undoKey();
    E('au-rate').onchange({target:{value:'1.4'}}); E('au-name').oninput({target:{value:'Typed name'}}); undoKey();
    say('what is typed is noted as a change (Undo takes the name back, and only it)', run('audEd.draft.name')!=='Typed name' && run('audEd.draft.rate')===1.4);
    E('au-rate').onchange({target:{value:'1.6'}}); E('setupbox').oninput({target:{dataset:{text:'newleader:0'},value:'Typed sentence'}}); undoKey();
    say('...also a sentence (Undo takes the sentence back, and only it)', run('audEd.draft.calls.newleader.lines[0].text')!=='Typed sentence' && run('audEd.draft.rate')===1.6);
    // a sound file: chosen (a step), removed (a step), the picture kept once
    await E('setupbox').onchange({target:{dataset:{file:'newleader:0'},files:[{size:100}]}}); await wait();
    say('a sound file chosen for a sentence is a step', run('audEd.draft.calls.newleader.lines[0].file')===BIG && hs('audEd').pictures===1 && !html().includes('data-file="newleader:0"'));
    { const before = run('audEd.draft.calls.newleader.lines[0].file'); await E('setupbox').onchange({target:{dataset:{file:'newleader:0'},files:[{size:10000001}]}}); await wait();
      say('a sound file over 10 MB is refused, with the limit in the message, and nothing changes', E('au-msg').textContent==='That file is too big (10.0 MB). The limit is 10 MB.' && run('audEd.draft.calls.newleader.lines[0].file')===before && run('Sound.MAX_FILE')===10000000);
      await E('setupbox').onchange({target:{dataset:{file:'newleader:0'},files:[{size:9500000}]}}); await wait();
      say('...a file of 9.5 MB is fine (it was refused above 1.5 MB before 1.1.0), and the help text names the limit', E('au-msg').textContent!=='That file is too big (9.5 MB). The limit is 10 MB.' && run('audEd.draft.calls.newleader.lines[0].file')===BIG && E('setupbox').innerHTML.includes('up to 10 MB per file')); }
    await E('setupbox').onclick({target:{closest:()=>({dataset:{nofile:'newleader:0'}})}}); await E('setupbox').onclick({target:{closest:()=>({dataset:{addline:'newleader'}})}});
    undoKey(); say('removing the file and adding a sentence are two steps: Undo takes the sentence away and the file stays removed', run('audEd.draft.calls.newleader.lines[0].file')==='' && run('audEd.draft.calls.newleader.lines.length')===n0);
    undoKey(); say('...and then Undo brings the sound file back', run('audEd.draft.calls.newleader.lines[0].file')===BIG && hs('audEd').pictures===1);
    undoKey(); say('...and then takes it away again (the sound file is kept once, however many steps hold it)', run('audEd.draft.calls.newleader.lines[0].file')==='' && hs('audEd').pictures===1);
    // a name with spaces is saved without them, and the steps know it; a change made while the set is written is not saved yet
    E('au-name').oninput({target:{value:'  Padded  '}}); run('audEd.history.commit()');
    { const pu=api.update, pa=api.add; let during=false; api.add=async(...a)=>{ if(!during){ during=true; E('au-vol').onchange({target:{value:'0.2'}}); } return pa(...a); };
      const nP=calls.length; await E('au-save').onclick(); api.add=pa; api.update=pu; const saved=calls.slice(nP).find(c=>c[0]==='add'&&c[1]==='audiosets');
      say('saving takes the spaces off the name', saved && saved[2].name==='Padded' && run('audEd.draft.name')==='Padded');
      say('a change made while the set is being written is not saved yet: the set is unsaved', saved && saved[2].volume!==0.2 && run('audEd.dirty')===true); }
    undoKey(); say('Undo after saving keeps the name without spaces', run('audEd.draft.name')==='Padded'); redoKey(); say('...and so does Redo', run('audEd.draft.name')==='Padded');
    E('au-back').onclick(); say('leaving the editor takes its key away', live.size===0);

    // the picture set editor
    run('imgEd=null; resizeImage = async () => "data:pic"'); await open('images','newset');
    E('is-steps').onchange({target:{value:'6'}}); E('is-kind').onchange({target:{value:'flag'}}); const flag0=run('Widgets.FLAG_STATES[0][0]'); await E('setupbox').onchange({target:{dataset:{slot:flag0},files:[{}]}});
    undoKey(); say('the kind and a picture are two steps: Undo takes the picture away, and the set stays a flag set', run('imgEd.draft.kind')==='flag' && !run('imgEd.draft.images["'+flag0+'"]'));
    undoKey(); say('...and then Undo makes it the fuel set again', run('imgEd.draft.kind')==='fuel' && run('imgEd.draft.steps')===6);
    for(let i=0;i<5;i++) undoKey();
    await E('setupbox').onchange({target:{dataset:{slot:'0'},files:[{}]}}); await E('setupbox').onchange({target:{dataset:{slot:'3'},files:[{}]}});
    E('setupbox').onclick({target:{closest:()=>({dataset:{clear:'0'}})}}); await E('setupbox').onchange({target:{dataset:{slot:'2'},files:[{}]}});
    undoKey(); say('removing a picture and adding another are two steps: Undo takes the added one away, and the first stays removed', !run('imgEd.draft.images[2]') && !run('imgEd.draft.images[0]') && run('imgEd.draft.images[3]')==='data:pic');
    undoKey(); say('...and then Undo brings the removed one back', run('imgEd.draft.images[0]')==='data:pic');
    E('is-steps').onchange({target:{value:'8'}}); E('is-name').oninput({target:{value:'Typed set name'}}); undoKey();
    say('a typed name is noted as a change (Undo takes it back, and only it)', run('imgEd.draft.name')!=='Typed set name' && run('imgEd.draft.steps')===8);
    E('is-name').oninput({target:{value:'  Padded set  '}}); run('imgEd.history.commit()');
    { const pa=api.add; let during=false; api.add=async(...a)=>{ if(!during){ during=true; E('is-steps').onchange({target:{value:'5'}}); } return pa(...a); };
      const nP=calls.length; await E('is-save').onclick(); api.add=pa; const saved=calls.slice(nP).find(c=>c[0]==='add'&&c[1]==='imagesets');
      say('saving takes the spaces off the name', saved && saved[2].name==='Padded set' && run('imgEd.draft.name')==='Padded set');
      say('a change made while the set is being written is not saved yet: the set is unsaved', saved && saved[2].steps===8 && run('imgEd.dirty')===true); }
    undoKey(); say('Undo after saving keeps the name without spaces', run('imgEd.draft.name')==='Padded set'); redoKey(); say('...and so does Redo', run('imgEd.draft.name')==='Padded set');
    E('is-back').onclick();

    // the widget builder
    run('wbEd=null'); await open('widgets','newwb');
    say('the greyed-out Undo and Redo of the widget builder look switched off, as in the other editors (its bar has its own class for it)', html().includes('class="row wb-bar"') && /\.wb-bar \.btn:disabled\s*\{[^}]*opacity/.test(fs.readFileSync(R+'renderer/styles.css','utf8')));
    E('wb-size').onchange({target:{value:'50'}}); E('wb-name').oninput({target:{value:'Typed widget name'}}); undoKey();
    say('a typed name is noted as a change (Undo takes it back, and only it)', run('wbEd.draft.name')!=='Typed widget name' && run('wbEd.draft.textSize')===50);
    E('wb-type').onchange({target:{value:'imagelane'}});
    say('a kind that adds fields to the draft: the image widget has a rule list and a fit', run('wbEd.draft.rules')!==undefined && run('wbEd.draft.fit')==='contain');
    undoKey(); say('...and undoing it takes them away again (the draft is exactly what it was)', run('wbEd.draft.type')==='textlane' && !run('"rules" in wbEd.draft') && !run('"fit" in wbEd.draft'));
    redoKey(); E('wb-addrule').onclick(); E('setupbox').oninput({target:{dataset:{rval:'0'},value:'7'}}); undoKey();
    say('...and a typed rule value is noted as a change (Undo takes it back, and only it)', run('wbEd.draft.rules.length')===1 && run('wbEd.draft.rules[0].value')==='');
    await E('setupbox').onchange({target:{dataset:{pic:'fixed'},files:[{}]}}); await E('setupbox').onchange({target:{dataset:{pic:'0'},files:[{}]}});
    undoKey(); say('a fixed picture and the picture of a rule are two steps: Undo takes the rule\'s picture away only', run('wbEd.draft.image')==='data:pic' && !run('wbEd.draft.rules[0].image'));
    await E('setupbox').onchange({target:{dataset:{pic:'0'},files:[{}]}}); E('setupbox').onclick({target:{closest:()=>({dataset:{clr:'0'}})}}); E('wb-addrule').onclick();
    undoKey(); say('removing the picture of a rule and adding a rule are two steps: Undo takes the added rule away, the picture stays removed', run('wbEd.draft.rules.length')===1 && !run('wbEd.draft.rules[0].image'));
    undoKey(); say('...and then Undo brings the picture back', run('wbEd.draft.rules[0].image')==='data:pic');
    E('wb-name').oninput({target:{value:'Slow save'}}); run('wbEd.history.commit()');
    { const pa=api.add; let during=false; api.add=async(...a)=>{ if(!during){ during=true; E('wb-size').onchange({target:{value:'61'}}); } return pa(...a); };
      const nP=calls.length; await E('wb-save').onclick(); api.add=pa; const saved=calls.slice(nP).find(c=>c[0]==='add'&&c[1]==='customwidgets');
      say('a change made while the widget is being written is not saved yet: the widget is unsaved', saved && saved[2].name==='Slow save' && saved[2].textSize!==61 && run('wbEd.dirty')===true);
      undoKey(); say('...and undoing it is clean again, as what was written', run('wbEd.dirty')===false); }
    E('wb-back').onclick(); await wait(); say('leaving the widget builder takes its key away', live.size===0);
    document.addEventListener=ae; document.removeEventListener=re; delete ctx.FileReader; delete ctx.resizeImage;
    run("state.customSub='layouts'");
  }

  { // 0.92.0: the plan of a heat race on the Home tab
    const keepSet = api.setSettings; api.setSettings = async p => { calls.push(['settings', p]); return { ...run('state.settings'), ...p }; }; // (the real setSettings answers with all the settings)
    const keep = { racesetups: store.racesetups, tracks: store.tracks, drivers: store.drivers, slotcars: store.slotcars, last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), seeds: run('state.settings.heatSeeds') };
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 2 }]; store.drivers = ['Alex', 'Sam', 'Kim', 'Lee', 'Max'].map((n, i) => ({ id: 'hp' + i, name: n })); store.slotcars = [{ id: 'hc1', brand: 'Car' }];
    store.racesetups = [{ id: 'hs1', name: 'Club heats', sessionType: 'heats', track: 't1', heatBy: 'laps', laps: 6, heatPlan: 'manual', heats: 2 }];
    const asg = n => Array.from({ length: n }, (_, i) => ({ driverId: 'hp' + i, carId: 'hc1' }));
    const clickStart = async () => { const kept = []; await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: 'start', dataset: {} } : null) } }); await new Promise(r => setTimeout(r, 20)); };
    run("state.settings.lastSetupId = 'hs1'; state.settings.heatSeeds = {}; state.settings.assignments = " + JSON.stringify({ hs1: asg(5) }) + "; state.tab = 'home'; state.race = null"); await run('render()');
    let h = E('view').innerHTML;
    say('a heat race shows its plan on the Home tab: the number of heats, how long they are, a table of the heats by lane', h.includes('<h4>Heat plan</h4>') && h.includes('2 heats, each 6 laps.') && h.includes('<th>Lane 1</th><th>Lane 2</th>') && (h.match(/<tr><td>[12]<\/td>/g) || []).length >= 2);
    say('...with the drivers in it (every driver once in this plan, "I choose" 2 heats on 2 lanes for 5 drivers: 4 places for 5 drivers, so the warning shows)', ['Alex', 'Sam', 'Kim', 'Lee', 'Max'].filter(n => h.includes('>' + n + '<')).length >= 4 && h.includes('class="hint2 hpwarn"') && h.includes('do not race the same number of heats'));
    say('...a closed box says how often every driver races and in which lane, and there is a Shuffle again button', h.includes('<details class="hplanes">') && !/<details class="hplanes" open/.test(h) && h.includes('How often every driver races, and in which lane') && h.includes('id="reshuffle"'));
    const seed1 = run('state.settings.heatSeeds.hs1');
    say('the shuffle is kept with the race setup, as a whole number from 1', Number.isInteger(seed1) && seed1 >= 1);
    const table = html => (html.match(/<table class="fields heatplan-table">[\s\S]*?<\/table>/) || [''])[0];
    const t1 = table(h);
    await run('render()');
    say('drawing the Home tab again shows the same plan (the shuffle is kept)', table(E('view').innerHTML) === t1 && run('state.settings.heatSeeds.hs1') === seed1);
    let changed = 0; for (let n = 0; n < 8 && !changed; n++) { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: 'reshuffle', dataset: {} } : null) } }); await new Promise(r => setTimeout(r, 20)); if (table(E('view').innerHTML) !== t1) changed = 1; }
    say('Shuffle again makes another plan, with another seed', changed === 1 && run('state.settings.heatSeeds.hs1') !== seed1);
    const planNow = table(E('view').innerHTML);
    await clickStart();
    say('Start race hands the plan on Home to the race (the plan the race uses is the one that was shown)', run('state.race.schedule.length') === 2 && run('state.race.schedule').every(x => x.length === 2) && run('state.tab') === 'race');
    const lanesOf = (html, heat) => ((html.match(/<tr><td>\d+<\/td>.*?<\/tr>/g) || [])[heat - 1] || '').replace(/<[^>]+>/g, '|');
    const sch = run('state.race.schedule'), names = ['Alex', 'Sam', 'Kim', 'Lee', 'Max'];
    say('...in the same drivers and lanes as the table', sch.every((heat, i) => heat.every(e => lanesOf(planNow, i + 1).split('|').filter(Boolean)[1 + e.lane] === names[e.p])));
    run("state.tab = 'home'; state.race = null"); store.racesetups = [{ id: 'hs1', name: 'Club heats', sessionType: 'heats', track: 't1', heatBy: 'time', duration: 4, heatPlan: 'roundrobin' }];
    run("state.settings.assignments = " + JSON.stringify({ hs1: asg(3) })); await run('render()'); h = E('view').innerHTML;
    say('round robin with 3 drivers on 2 lanes: 3 heats of 4 minutes, 12 minutes of racing in total, everyone races 2', h.includes('3 heats, each 4 minutes (12 minutes of racing in total).') && h.includes('Every driver races 2 heats.') && !h.includes('hpwarn'));
    run("state.race = null"); store.racesetups = [{ id: 'hs1', name: 'Club heats', sessionType: 'race', track: 't1', laps: 5 }]; await run('render()');
    say('a race that is not a heat race has no plan on the Home tab', !E('view').innerHTML.includes('Heat plan') && !E('view').innerHTML.includes('id="reshuffle"'));
    store.racesetups = [{ id: 'hs1', name: 'Club heats', sessionType: 'heats', track: 't1', heatBy: 'laps', laps: 6, heatPlan: 'manual', heats: 2 }]; store.tracks = [{ id: 't1', name: 'Living room', lanes: 0 }]; await run('render()');
    say('a track without lanes has no plan, and the missing lanes are reported as before', !E('view').innerHTML.includes('Heat plan') && E('view').innerHTML.includes('The track has no number of lanes'));
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, drivers: keep.drivers, slotcars: keep.slotcars }); run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; state.settings.heatSeeds = ${JSON.stringify(keep.seeds || {})}`); run("state.race = null; state.tab = 'home'"); api.setSettings = keepSet;
  }

  { // 0.93.0: the other plans on the Home tab, and the seeding from a qualifying
    const keep = { racesetups: store.racesetups, tracks: store.tracks, drivers: store.drivers, slotcars: store.slotcars, sessions: store.sessions, last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), seeds: run('state.settings.heatSeeds') };
    const keepSet = api.setSettings; api.setSettings = async p => { calls.push(['settings', p]); return { ...run('state.settings'), ...p }; };
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 4 }]; store.drivers = ['Alex', 'Sam', 'Kim', 'Lee', 'Max', 'Zoe', 'Jan', 'Tim'].map((n, i) => ({ id: 'hp' + i, name: n })); store.slotcars = [{ id: 'hc1', brand: 'Car' }]; store.sessions = [];
    const setupOf = over => [{ id: 'hs1', name: 'Club heats', sessionType: 'heats', track: 't1', heatBy: 'laps', laps: 6, heatPlan: 'manual', heats: 2, ...over }];
    const asg = n => Array.from({ length: n }, (_, i) => ({ driverId: 'hp' + i, carId: 'hc1' }));
    const home = async (over, n = 8) => { store.racesetups = setupOf(over); run("state.settings.lastSetupId = 'hs1'; state.settings.heatSeeds = { hs1: 77 }; state.settings.assignments = " + JSON.stringify({ hs1: asg(n) }) + "; state.tab = 'home'; state.race = null"); await run('render()'); return E('view').innerHTML; };
    const start = async () => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: 'start', dataset: {} } : null) } }); await new Promise(r => setTimeout(r, 20)); return run('state.race.schedule'); };
    let h = await home({ heatPlan: 'perdriver', heatsEach: 3 }, 7);
    say('the plan "same number of heats": 7 drivers on 4 lanes with 3 heats each is 6 heats, everybody races 3, the lanes are even, no warning', h.includes('6 heats, each 6 laps.') && h.includes('Every driver races 3 heats.') && h.includes('The lanes are shared evenly.') && !h.includes('hpwarn'));
    h = await home({ heatPlan: 'rotation' }, 7);
    say('lane rotation: 7 heats, everybody 4 heats, in every lane once, said in the preview, and the lane table shows 1 for everybody', h.includes('7 heats, each 6 laps.') && h.includes('Every driver races 4 heats.') && h.includes('Every driver races once in every lane.') && !h.includes('hpwarn') && (h.match(/<td class="num">1<\/td>/g) || []).length >= 28);
    h = await home({ heatPlan: 'roundrobin' }, 7);
    say('round robin for 7: the warning, and it says to set "Same number of heats for everyone" to Yes', h.includes('hpwarn') && h.includes('Same number of heats for everyone'));
    h = await home({ heatPlan: 'roundrobin', heatEven: 'yes' }, 7);
    say('...with that set to Yes there are 7 heats and everybody races 4, no warning', h.includes('7 heats, each 6 laps.') && h.includes('Every driver races 4 heats.') && !h.includes('hpwarn'));
    h = await home({ heatPlan: 'manual', heatSeeding: 'speed' }, 8);
    say('seeding with no qualifying on this track: a line says so, and the drivers are shuffled', h.includes('There is no qualifying on this track yet, so the drivers are shuffled.'));
    store.sessions = [{ id: 'q1', sessionType: 'qualifying', trackId: 't1', date: '2026-10-01T18:00:00Z', standings: ['hp5', 'hp2', 'hp7', 'hp0', 'hp1', 'hp3', 'hp4', 'hp6'].map((id, i) => ({ pos: i + 1, driverId: id })) },
      { id: 'q0', sessionType: 'qualifying', trackId: 't1', date: '2026-09-01T18:00:00Z', standings: ['hp0', 'hp1', 'hp2', 'hp3', 'hp4', 'hp5', 'hp6', 'hp7'].map((id, i) => ({ pos: i + 1, driverId: id })) },
      { id: 'q9', sessionType: 'qualifying', trackId: 'other', date: '2026-10-05T18:00:00Z', standings: [{ pos: 1, driverId: 'hp3' }] }];
    h = await home({ heatPlan: 'manual', heatSeeding: 'speed', heats: 2 }, 8);
    say('seeding with a qualifying: a line says it is seeded by the latest one on this track (1 October; the older one and the one on another track do not count)', h.includes('Seeded by the latest qualifying on this track ('+localDay('2026-10-01T18:00:00Z')+').') && !h.includes('drivers who did not take part'));
    let sch = await start();
    say('...the four fastest of that qualifying (Zoe, Kim, Tim, Alex) race in the last heat, the others in the first', sch.length === 2 && sch[1].map(e => e.p).sort().join() === '0,2,5,7' && sch[0].map(e => e.p).sort().join() === '1,3,4,6');
    h = await home({ heatPlan: 'manual', heatSeeding: 'mixed', heats: 4, laps: 6 }, 8);
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 2 }]; h = await home({ heatPlan: 'manual', heatSeeding: 'mixed', heats: 4 }, 8); sch = await start();
    say('mixed on 2 lanes: every heat has one of the four fastest and one of the four slowest', sch.length === 4 && sch.every(x => x.filter(e => [0, 2, 5, 7].includes(e.p)).length === 1));
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 4 }];
    store.sessions = [{ id: 'q2', sessionType: 'qualifying', trackId: 't1', date: '2026-10-01T18:00:00Z', standings: ['hp0', 'hp1', 'hp2'].map((id, i) => ({ pos: i + 1, driverId: id })) }];
    h = await home({ heatPlan: 'manual', heatSeeding: 'speed', heats: 2 }, 8);
    say('drivers who were not in the qualifying are placed last, and a line says so', h.includes('Seeded by the latest qualifying') && h.includes('drivers who did not take part are placed last'));
    store.sessions = [{ id: 'q3', sessionType: 'qualifying', trackId: 't1', date: '2026-10-01T18:00:00Z', standings: [{ pos: 1, driverId: 'someone-else' }] }];
    h = await home({ heatPlan: 'manual', heatSeeding: 'speed', heats: 2 }, 8);
    say('a qualifying in which none of these drivers took part: a line says so, and they are shuffled', h.includes('None of these drivers took part in the latest qualifying, so they are shuffled.'));
    h = await home({ heatPlan: 'rotation', heatSeeding: 'speed' }, 8);
    say('round robin and lane rotation do not use the seeding: no line about it', !h.includes('Seeded by') && !h.includes('no qualifying on this track') && !h.includes('None of these drivers'));
    h = await home({ heatPlan: 'manual' }, 8);
    say('the standard (shuffled) has no line about seeding either', !h.includes('Seeded by') && !h.includes('no qualifying on this track'));
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, drivers: keep.drivers, slotcars: keep.slotcars, sessions: keep.sessions }); run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; state.settings.heatSeeds = ${JSON.stringify(keep.seeds || {})}`); run("state.race = null; state.tab = 'home'"); api.setSettings = keepSet;
  }

  { // 0.94.0: the Home tab says how the overall result is counted, and whether uneven heats are fair then
    const keep = { racesetups: store.racesetups, tracks: store.tracks, drivers: store.drivers, slotcars: store.slotcars, sessions: store.sessions, last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), seeds: run('state.settings.heatSeeds') };
    const keepSet = api.setSettings; api.setSettings = async p => { calls.push(['settings', p]); return { ...run('state.settings'), ...p }; };
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 4 }]; store.drivers = ['Alex', 'Sam', 'Kim', 'Lee', 'Max', 'Zoe', 'Jan'].map((n, i) => ({ id: 'hp' + i, name: n })); store.slotcars = [{ id: 'hc1', brand: 'Car' }]; store.sessions = [];
    const home = async over => { store.racesetups = [{ id: 'hs1', name: 'Club heats', sessionType: 'heats', track: 't1', heatBy: 'laps', laps: 6, heatPlan: 'manual', heats: 3, resultBy: 'points', ...over }];
      run("state.settings.lastSetupId = 'hs1'; state.settings.heatSeeds = { hs1: 77 }; state.settings.assignments = " + JSON.stringify({ hs1: Array.from({ length: 7 }, (_, i) => ({ driverId: 'hp' + i, carId: 'hc1' })) }) + "; state.tab = 'home'; state.race = null"); await run('render()'); return E('view').innerHTML; };
    let h = await home({});
    say('3 heats for 7 drivers on 4 lanes: some race 2 heats, some 1, and added up that is flagged in red, with the way out (and the average as another)', h.includes('hpwarn') && h.includes('do not race the same number of heats: 1 to 2') && h.includes('Or count the average per heat.') && !h.includes('Overall result:'));
    h = await home({ countBy: 'average' });
    say('counted as the average per heat: the same plan is fair, no red, and the line says how it is counted', !h.includes('hpwarn') && h.includes('The drivers race 1 to 2 heats. The result is the average per heat, so that is fair.') && h.includes('Overall result: the average per heat.'));
    h = await home({ countBy: 'best', bestHeats: 1 });
    say('only the best 1 heat counts: everybody counts one heat, so that is fair too', !h.includes('hpwarn') && h.includes('but the same number of heats counts for everyone, so that is fair.') && h.includes('only the best 1 heat of every driver counts.'));
    h = await home({ countBy: 'best', bestHeats: 2 });
    say('only the best 2 heats count while some drivers race 1: flagged in red twice (it is not equal, and they have fewer than the others)', h.includes('hpwarn') && h.includes('do not race the same number of heats') && h.includes('Some drivers race fewer than 2 heats (1): all their heats count'));
    h = await home({ dropWorst: 'yes' });
    say('the worst heat dropped: drivers with 1 and with 2 heats both count 1, so that is fair', !h.includes('hpwarn') && h.includes('but the same number of heats counts for everyone, so that is fair.') && h.includes('Overall result: the worst heat of every driver is dropped.'));
    h = await home({ countBy: 'best', bestHeats: 3, dropWorst: 'yes' });
    say('...the best 3 with the worst dropped while drivers race 1 or 2 heats: everybody counts 1, so it is fair and there is no line about fewer heats', !h.includes('hpwarn') && h.includes('same number of heats counts for everyone') && !h.includes('Some drivers race fewer than'));
    h = await home({ heatPlan: 'perdriver', heatsEach: 3, countBy: 'average', fastestBonus: 1, tieBreak: 'time' });
    say('with the same number of heats for everyone, a bonus and a tie-breaker: the line names them (and no talk of fairness)', h.includes('Every driver races 3 heats.') && h.includes('Overall result: the average per heat; 1 bonus point for the fastest lap of every heat; a tie is decided by the lowest total time first.') && !h.includes('so that is fair'));
    h = await home({ resultBy: 'laps', fastestBonus: 3 });
    say('a result by laps has no bonus, so it is not in the line (the setting is ignored)', !h.includes('bonus'));
    h = await home({ finals: 'ab', finalMode: 'added', finalLaps: 12 });
    say('0.96.0: Home tells about the finals: who is in them, that the best-placed driver chooses a lane, how the finals count and how long a final is', h.includes('Then a final A with the best') && h.includes('after a final B with the next') && h.includes('the best-placed driver chooses a lane first') && h.includes('What a driver scores in a final is added to the heat result.') && h.includes('A final is 12 laps long.'));
    h = await home({ finals: 'a' });
    say('...the finals decide the places by default, and a final of the length of a heat says nothing about its length', h.includes('The finals decide the final places: the heat result only decides who races in which final.') && !h.includes('laps long') && !h.includes('after a final B'));
    h = await home({});
    say('...without finals there is no word about them (and the plan is the same)', !/final/i.test(h.replace(/Overall result|fastest/g, '')));
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, drivers: keep.drivers, slotcars: keep.slotcars, sessions: keep.sessions }); run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; state.settings.heatSeeds = ${JSON.stringify(keep.seeds || {})}`); run("state.race = null; state.tab = 'home'"); api.setSettings = keepSet;
  }
  { // 0.94.0: the saved result of a heat race with its own way of counting, in Results and Records
    const keep = { sessions: store.sessions, laps: store.laps };
    const heatSession = scoring => ({ id: 'hsx', setupName: 'Club night', sessionType: 'heats', resultBy: 'points', trackId: 't1', trackName: 'Living room', date: '2026-10-12T18:30:00Z', endedBy: '',
      standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'A', laps: 8, points: 20, best: 5000, total: null, ...(scoring ? { score: 9, counted: 2, heats: 2 } : {}) }, { pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Sam', carName: 'B', laps: 4, points: 12, best: 5100, total: null, ...(scoring ? { score: 8.3333333, counted: 2, heats: 3 } : {}) }],
      heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 2, points: scoring ? 12 : 10, ...(scoring ? { bonus: 2 } : {}) }, { pos: 2, driverName: 'Sam', laps: 2, points: 8 }] }], ...(scoring ? { scoring } : {}) });
    store.laps = [];
    store.sessions = [heatSession({ countBy: 'average', bestHeats: 2, dropWorst: true, fastestBonus: 2, tieBreak: 'default' })];
    run("state.tab='database'; state.sub='results'"); await run('render()');
    let h = E('resbody').innerHTML;
    say('Results and Records: a heat race with its own counting has a Result column ("9 avg", "8.33 avg (2 of 3 heats)"), says how it was counted and shows the bonus in the heat', h.includes('<th>Result</th>') && h.includes('<td>9 avg</td>') && h.includes('<td>8.33 avg (2 of 3 heats)</td>') && h.includes('Overall result: the average per heat; the worst heat of every driver is dropped; 2 bonus points for the fastest lap of every heat.') && h.includes('12 pts incl. 2 for the fastest lap'));
    store.sessions = [{ ...heatSession({ countBy: 'average', bestHeats: 2, dropWorst: false, fastestBonus: 0, tieBreak: 'default' }), sessionType: 'race' }];
    await run('render()'); h = E('resbody').innerHTML;
    say('...only heat races get the column and the line', !h.includes('<th>Result</th>') && !h.includes('Overall result:'));
    store.sessions = [heatSession(null)];
    await run('render()'); h = E('resbody').innerHTML;
    say('...a heat race of before has none of that: no Result column, no line, no bonus text', !h.includes('<th>Result</th>') && !h.includes('Overall result:') && !h.includes('for the fastest lap') && h.includes('10 pts') && !h.includes('12 pts'));
    store.sessions = [{ ...heatSession({ countBy: 'average', bestHeats: 2, dropWorst: true, fastestBonus: 2, tieBreak: 'default' }), sessionType: 'endurance' }];
    await run('render()'); h = E('resbody').innerHTML;
    say('1.9.0: an endurance race in heats counts like a heat race: Result column, the way it was counted and the bonus', h.includes('<th>Result</th>') && h.includes('<td>9 avg</td>') && h.includes('Overall result: the average per heat;') && h.includes('12 pts incl. 2 for the fastest lap'));
    store.sessions = [{ ...heatSession({ countBy: 'average', bestHeats: 2, dropWorst: true, fastestBonus: 2, tieBreak: 'default' }), sessionType: 'endurance', heatResults: undefined }];
    await run('render()'); h = E('resbody').innerHTML;
    say('...an endurance race in one go (no heats) has no Result column and no counting line, whatever is stored', !h.includes('<th>Result</th>') && !h.includes('Overall result:'));
    const finSession = mode => ({ ...heatSession(mode === 'added' ? { countBy: 'total', bestHeats: 2, dropWorst: false, fastestBonus: 0, tieBreak: 'default' } : null), finals: { finals: 'ab', finalMode: mode },
      standings: [{ pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'A', laps: 12, points: 30, best: 5000, total: null, finalName: 'A', finalPos: 1, ...(mode === 'added' ? { score: 28, counted: 2, heats: 2, heatScore: 18, finalPoints: 10, finalLaps: 4 } : {}) },
        { pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Sam', carName: 'B', laps: 8, points: 20, best: 5100, total: null, finalName: 'B', finalPos: 1 }, { pos: 3, driverId: 'd3', carId: 'c3', driverName: 'Kim', carName: 'C', laps: 2, points: 5, best: 5300, total: null }],
      heatResults: [{ heat: 1, rows: [{ pos: 1, driverName: 'Alex', laps: 2, points: 10 }] }, { heat: 2, final: 'B', rows: [{ pos: 1, driverName: 'Sam', laps: 4, points: 10 }] }, { heat: 3, final: 'A', rows: [{ pos: 1, driverName: 'Alex', laps: 4, points: 10 }] }] });
    store.sessions = [finSession('places')];
    store.laps = [{ id: 'l1', sessionId: 'hsx', driverId: 'd1', heat: 1, lapNumber: 1, time: 5000 }, { id: 'l2', sessionId: 'hsx', driverId: 'd1', heat: 3, final: 'A', lapNumber: 1, time: 5100 }, { id: 'l3', sessionId: 'hsx', driverId: 'd2', heat: 2, final: 'B', lapNumber: 1, time: 5200 }];
    await run('render()'); h = E('resbody').innerHTML;
    say('0.96.0: Results and Records: a heat race with finals has a Final column ("Final A: 1st", "Final B: 1st", nothing for a driver in no final)', h.includes('<th>Final</th>') && h.includes('<td>Final A: 1st</td>') && h.includes('<td>Final B: 1st</td>') && /Kim<\/td>.*?<td>5<\/td><td><\/td><td>/.test(h));
    say('...the heats and the finals are listed by name, and the heading says both', h.includes('Heats and finals') && h.includes('<strong>Heat 1</strong>') && h.includes('<strong>Final B</strong>') && h.includes('<strong>Final A</strong>') && !h.includes('<strong>Heat 2</strong>') && !h.includes('<strong>Heat 3</strong>'));
    say('...it says how the finals counted, and the laps of a final are marked F and the letter', h.includes('The finals decide the final places.') && h.includes('FA 1: ') && h.includes('FB 1: ') && h.includes('H1 1: '));
    store.sessions = [finSession('added')]; await run('render()'); h = E('resbody').innerHTML;
    say('...with the final added the Result column shows the sum, and the note says so', h.includes('<th>Result</th>') && h.includes('<td>18 + 10 final = 28</td>') && h.includes('What a driver scores in a final is added to the heat result.'));
    store.sessions = [heatSession(null)]; await run('render()'); h = E('resbody').innerHTML;
    store.sessions = [{ ...finSession('places'), sessionType: 'race' }]; await run('render()'); h = E('resbody').innerHTML;
    say('...only a heat race has the Final column (a race with a finals field does not)', !h.includes('<th>Final</th>') && !h.includes('The finals decide the final places.'));
    store.sessions = [heatSession(null)]; await run('render()'); h = E('resbody').innerHTML;
    say('...a heat race without finals has no Final column and the heading is Heats', !h.includes('<th>Final</th>') && h.includes('<h4>Heats</h4>') && !h.includes('Heats and finals'));
    store.sessions = keep.sessions; store.laps = keep.laps; run("state.sub='tracks'"); await run('render()');
  }

  { // 0.95.0: the plan on the Home tab can be changed by hand (click a place, click another place)
    const keep = { racesetups: store.racesetups, tracks: store.tracks, drivers: store.drivers, slotcars: store.slotcars, sessions: store.sessions, last: run('state.settings.lastSetupId'), asg: run('state.settings.assignments'), seeds: run('state.settings.heatSeeds'), edits: run('state.settings.heatEdits') };
    const keepSet = api.setSettings; api.setSettings = async p => { calls.push(['settings', p]); return { ...run('state.settings'), ...p }; };
    store.tracks = [{ id: 't1', name: 'Living room', lanes: 4 }]; store.drivers = ['Alex', 'Sam', 'Kim', 'Lee', 'Max', 'Zoe', 'Jan'].map((n, i) => ({ id: 'hp' + i, name: n })); store.slotcars = [{ id: 'hc1', brand: 'Car' }]; store.sessions = [];
    const setup = over => ({ id: 'hs1', name: 'Club heats', sessionType: 'heats', track: 't1', heatBy: 'laps', laps: 6, heatPlan: 'manual', heats: 3, ...over });
    const home = async (over, n = 6, edits) => { store.racesetups = [setup(over)];
      run("state.settings.lastSetupId = 'hs1'; state.settings.heatSeeds = { hs1: 77 }; state.settings.heatEdits = " + JSON.stringify(edits || {}) + "; state.settings.assignments = " + JSON.stringify({ hs1: Array.from({ length: n }, (_, i) => ({ driverId: 'hp' + i, carId: 'hc1' })) }) + "; state.tab = 'home'; state.race = null; state.heatSel = null; state.heatMsg = ''"); await run('render()'); return E('view').innerHTML; };
    const click = async (hp, id) => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: id || '', dataset: hp === undefined ? {} : { hp } } : null) } }); await new Promise(r => setTimeout(r, 20)); return E('view').innerHTML; };
    const plan0 = () => run('Heats.plan(' + JSON.stringify({ count: 6, lanes: 4, setup: setup({}), seed: 77 }) + ')'), edited = () => run('state.settings.heatEdits && state.settings.heatEdits.hs1');
    let h = await home({});
    const S0 = plan0();
    say('every place of the Heat plan is a button (3 heats x 4 lanes), and the page says how to change the plan', (h.match(/class="hpcell/g) || []).length === 12 && h.includes('data-hp="0:0"') && h.includes('data-hp="2:3"') && h.includes('To change the plan, click a place and then another place') && !h.includes('Reset my changes') && !h.includes('You changed this plan by hand'));
    const pair = (() => { for (let l1 = 0; l1 < 4; l1++) for (let l2 = 0; l2 < 4; l2++) { const r = run('Heats.swap(' + JSON.stringify(S0) + ', { heat: 0, lane: ' + l1 + ' }, { heat: 1, lane: ' + l2 + ' }, 6, 4)'); if (r.schedule) return { a: `0:${l1}`, b: `1:${l2}`, l1, l2, schedule: r.schedule }; } return null; })();
    say('(the plan of this seed has a swap that is allowed between heat 1 and heat 2)', !!pair);
    h = await click('0:0');
    say('clicking a place selects it (marked, and the page says what to do next)', h.includes('class="hpcell sel" data-hp="0:0" aria-pressed="true"') && h.includes('Now click the place to swap it with.') && (h.match(/class="hpcell sel"/g) || []).length === 1);
    h = await click('0:0');
    say('clicking the same place again lets go of it (and says nothing about it)', !h.includes('hpcell sel') && !edited() && h.includes('To change the plan') && !h.includes('role="alert"') && !h.includes('same place'));
    run("state.heatSel = { setupId: 'another-setup', heat: 0, lane: 0 }"); await run('render()'); h = E('view').innerHTML;
    say('a place that was clicked in another race setup is not shown as selected here', !h.includes('hpcell sel') && h.includes('To change the plan'));
    run('state.heatSel = null'); await run('render()');
    h = await click(pair.a); h = await click(pair.b);
    const exp = { schedule: pair.schedule };
    say('clicking another place swaps the two: the changed plan is saved with the plan it was made from', !!exp.schedule && JSON.stringify(edited().schedule) === JSON.stringify(exp.schedule) && edited().key === run('Heats.planKey(' + JSON.stringify({ count: 6, lanes: 4, setup: setup({}), seed: 77 }) + ')') && !h.includes('hpcell sel'));
    const nm = i => store.drivers[i].name, cellOf = (sch, hh, l) => { const e = sch[hh].find(x => x.lane === l); return e ? nm(e.p) : '–'; };
    const cell = (hh, l, sch) => `data-hp="${hh}:${l}" aria-pressed="false" title="Click this place, then another one, to swap the two">${cellOf(sch, hh, l)}</button>`;
    say('...the table shows the swapped drivers, the page says the plan was changed by hand, and offers to reset it', h.includes(cell(0, pair.l1, exp.schedule)) && cell(0, pair.l1, exp.schedule) !== cell(0, pair.l1, S0) && h.includes('You changed this plan by hand') && h.includes('id="resetplan"'));
    say('...the numbers follow the changed plan (the table of heats per driver is the one of the new plan)', (st => st.per.every((x, i) => h.includes(`<td>${nm(i)}</td><td class="num">${x.heats}</td>`)))(run('Heats.stats(' + JSON.stringify(exp.schedule) + ', 6, 4)')));
    run("state.race = null"); const sch = await (async () => { await E('view').onclick({ target: { closest: sel => (sel === 'button' ? { id: 'start', dataset: {} } : null) } }); await new Promise(r => setTimeout(r, 20)); return run('state.race.schedule'); })();
    say('Start race races the changed plan', JSON.stringify(sch) === JSON.stringify(exp.schedule));
    run("state.tab = 'home'; state.race = null"); await run('render()');
    // an allowed change that makes a driver race twice in a heat is refused: find a driver who races in two heats, and swap their place in the first with another driver of the second
    const twice = (() => { for (let a = 0; a < exp.schedule.length; a++) for (const e of exp.schedule[a]) for (let b = a + 1; b < exp.schedule.length; b++) { const other = exp.schedule[b].find(x => x.p !== e.p); if (exp.schedule[b].some(x => x.p === e.p) && other) return { a: `${a}:${e.lane}`, b: `${b}:${other.lane}` }; } return null; })();
    h = twice ? (await click(twice.a), await click(twice.b)) : '';
    say('a driver can not be put in the same heat twice: the page says so, nothing is selected and the plan is as it was', !!twice && h.includes('That would put a driver in the same heat twice.') && h.includes('role="alert"') && !h.includes('hpcell sel') && JSON.stringify(edited().schedule) === JSON.stringify(exp.schedule));
    h = await click('0:0');
    say('...the message goes away with the next click', !h.includes('That would put a driver') && h.includes('hpcell sel'));
    h = await click('0:0');
    h = await click(undefined, 'resetplan');
    say('Reset my changes brings back the plan that was made (and takes the notes away)', !edited() && !h.includes('You changed this plan by hand') && !h.includes('Reset my changes') && JSON.stringify(run('state.settings.heatEdits')) === '{}' && h.includes(cell(0, pair.l1, S0)));
    // Shuffle again drops the changes
    h = await click(pair.a); h = await click(pair.b);
    say('(changed again)', !!edited());
    h = await click(undefined, 'reshuffle');
    say('Shuffle again makes a new plan and drops the changes', !edited() && !h.includes('You changed this plan by hand') && run('state.settings.heatSeeds.hs1') !== 77);
    // the changed plan is kept while nothing it was made from changes, and goes away when something does
    const keepEdit = { hs1: { key: run('Heats.planKey(' + JSON.stringify({ count: 6, lanes: 4, setup: setup({}), seed: 77 }) + ')'), schedule: exp.schedule } };
    h = await home({}, 6, keepEdit);
    say('a changed plan that was saved is shown again later', h.includes('You changed this plan by hand') && h.includes(cell(0, pair.l1, exp.schedule)));
    h = await home({ laps: 9, heatBy: 'time', duration: 4, resultBy: 'points', countBy: 'average', breakSeconds: 30 }, 6, keepEdit);
    say('...also when only the length of a heat, the points, the way of counting or the break change', h.includes('You changed this plan by hand'));
    h = await home({}, 5, keepEdit);
    say('...but not with another number of participants (the plan is made again)', !h.includes('You changed this plan by hand') && (h.match(/class="hpcell/g) || []).length === 12);
    h = await home({ heats: 2 }, 6, keepEdit);
    say('...nor with other heat settings', !h.includes('You changed this plan by hand'));
    h = await home({}, 6, { hs1: { key: keepEdit.hs1.key, schedule: [[{ p: 9, lane: 0 }]] } });
    say('a saved change that does not fit any more is ignored', !h.includes('You changed this plan by hand') && (h.match(/class="hpcell/g) || []).length === 12);
    // an empty place: a driver moves there
    h = await home({ heatPlan: 'perdriver', heatsEach: 3 }, 7);
    const S1 = run('Heats.plan(' + JSON.stringify({ count: 7, lanes: 4, setup: setup({ heatPlan: 'perdriver', heatsEach: 3 }), seed: 77 }) + ')');
    const free = (() => { for (let a = 0; a < S1.length; a++) for (let l = 0; l < 4; l++) if (!S1[a].some(e => e.lane === l)) return { a, l }; return null; })();
    say('(7 drivers with 3 heats each make heats with a free place)', !!free && h.includes('<span class="muted">–</span>'));
    if (free) { const src = S1.findIndex((x, i) => i !== free.a && x.length > 1 && !x.some(e => S1[free.a].some(f => f.p === e.p))); const mv = src >= 0 ? S1[src][0] : null;
      if (mv) { h = await click(`${src}:${mv.lane}`); h = await click(`${free.a}:${free.l}`);
        say('a driver moves into a free place of another heat', !!edited() && edited().schedule[free.a].some(e => e.p === mv.p && e.lane === free.l) && !edited().schedule[src].some(e => e.p === mv.p) && h.includes('You changed this plan by hand')); }
      else say('a driver moves into a free place of another heat (no heat was found for this)', true); }
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks, drivers: keep.drivers, slotcars: keep.slotcars, sessions: keep.sessions }); run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}; state.settings.heatSeeds = ${JSON.stringify(keep.seeds || {})}; state.settings.heatEdits = ${JSON.stringify(keep.edits || {})}`); run("state.race = null; state.tab = 'home'; state.heatSel = null; state.heatMsg = ''"); api.setSettings = keepSet;
  }
reachedEnd=true; console.log(fails?fails+' SCREEN TESTS FAILED':'ALL SCREEN TESTS PASSED'); process.exit(fails?1:0);
})();
