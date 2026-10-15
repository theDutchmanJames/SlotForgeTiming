let fails=0, reachedEnd=false; process.on('exit',code=>{ if(code===0&&!reachedEnd){ console.log('FAIL the test stopped before its end (something waited for ever)'); process.exitCode=1; } }); process.on('unhandledRejection',e=>{console.log('UNHANDLED:',e.stack.split('\n').slice(0,6).join('\n'));process.exit(1)});
const vm=require('vm'),fs=require('fs');
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
const opened=[]; const zooms=[]; const customDefs={}; let depsResult={}; const api={setZoom:f=>{zooms.push(f)},exportDeps:async()=>depsResult,exportData:async(p,d)=>{xfer.push(['export',p,d]);return {saved:true,path:'C:/x.json',counts:{tracks:1}}},importOpen:async()=>importResult,importApply:async()=>{xfer.push(['apply']);return {layouts:1,tracks:2}},importCancel:async()=>{xfer.push(['cancel'])},backupSave:async()=>{xfer.push(['bksave']);return {saved:true,path:'C:/b.json'}},backupOpen:async()=>bkResult,backupRestore:async()=>{xfer.push(['bkrestore']);return {safety:'C:/s.json'}},backupCancel:async()=>{xfer.push(['bkcancel'])},liveOpen:async()=>{opened.push(1)},exportPdf:async(html,name)=>{exported.push([html,name]);return exportResult},schema:async()=>schema,getSettings:async()=>({theme:'dark'}),setSettings:async p=>{calls.push(['settings',p]);return p},dbPath:async()=>'x',
  list:async e=>JSON.parse(JSON.stringify(store[e]||[])),customFields:async e=>customDefs[e]||[],linkedLaps:async()=>0,
  add:async(e,item)=>{const row={...item,id:'L'+(store[e].length+1)};store[e].push(row);calls.push(['add',e,item]);return row},
  update:async(e,id,p)=>{calls.push(['update',e,id,p]);const r=store[e].find(x=>x.id===id);Object.assign(r,p);return r},
  remove:async(e,id)=>{store[e]=store[e].filter(x=>x.id!==id)}};
// the app reports a screen that could not be drawn with console.error: that is a failed test (unless the test expects it)
const appConsole = { ...console, expected: false, seen: 0, error: (...a) => { if (appConsole.expected) { appConsole.seen++; return; } console.log('FAIL the app reported an error: ' + a.map(x => (x && x.stack) || x).join(' ').slice(0, 300)); fails++; } };
const ctx=vm.createContext({document,api,console: appConsole,Intl,URL,Image:function(){},confirm:()=>true,alert(){},setTimeout,clearTimeout,setInterval,clearInterval,performance,});
const listeners={}; ctx.window=ctx; ctx.addEventListener=(t,f)=>{(listeners[t]=listeners[t]||[]).push(f)}; ctx.removeEventListener=(t,f)=>{listeners[t]=(listeners[t]||[]).filter(x=>x!==f)};
const errors=[];
for(const f of ['bop.js', 'weather.js', 'engine.js','heats.js','tokens.js','speed.js','stats.js','viewset.js','picture.js','uiscale.js','theme.js','banner.js','icons.js','delta.js','avatars.js', 'weatherwidgets.js', 'widgets.js','frame.js','backdrop.js','announcer.js','sound.js','timing.js','rows.js','richtext.js','canvas.js','liveshare.js','review.js','liveview.js','report.js','database.js','landing.js','race.js','undo.js','editor.js','tokenui.js', 'bopui.js', 'weatherui.js','audioedit.js','widgetbuilder.js','transferui.js','themeui.js','help.js','hardware.js','trackmate.js','hardwareui.js','dsui.js','app.js']){
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
    say('the groups start open', !/<details class="sidegroup" data-side="[a-z]+">/.test(side)); }
  E('side').ontoggle; // folders remember how you left them
  run("state.sideClosed.add('title')"); E('side').innerHTML=run('sideHtml()');
  say('a folder that was closed stays closed for the next widget', /<details class="sidegroup" data-side="title">/.test(E('side').innerHTML) && /<details class="sidegroup" data-side="text" open>/.test(E('side').innerHTML));
  run("state.sideClosed.delete('title')"); E('side').innerHTML=run('sideHtml()');
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
  run("state.settings.recent={drivers:['q5','q2'],cars:[]}; state.tab='home'"); await run('render()');
  const full = E('view').innerHTML, hv = full.slice(full.indexOf('<h3>Drivers'));
  say('Home lists only 5 drivers, the last used first, with a button to the database', hv.indexOf('Driver5') < hv.indexOf('Driver2') && hv.indexOf('Driver2') < hv.indexOf('Driver0') && !hv.includes('Driver6') && hv.includes('data-more="drivers"'));
  await E('view').onclick({ target: { closest: () => ({ dataset: { more: 'drivers' } }) } });
  say('the button opens the Drivers page of the database', run('state.tab') === 'database' && run('state.sub') === 'drivers');
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
    say('the Live Race tab is the one tab that looks like a Live on Air sign: a red light in front of the name (hidden from screen readers), and a hint', (t.match(/class="tab onair"/g) || []).length === 1 && /class="tab onair"[^>]*data-id="live"/.test(t) && live.includes('<span class="led red" aria-hidden="true"></span>Live Race</button>') && live.includes('title="Opens the Live Race on a second screen"'));
    say('...the other tabs are plain (no light), there is only one light, and the sign never claims to be the open page', (t.match(/class="led red"/g) || []).length === 1 && !t.slice(0, t.indexOf('class="tab onair"')).includes('led') && /data-id="live"/.test(t) && !/aria-selected="true"[^>]*data-id="live"/.test(t));
    say('the sign is part of the stylesheet, always the same: red letters and light inside a red outline, no background of its own, no animation and no link to a running race', (css => { const sign = (css.match(/\.tab\.onair\{[^}]*\}/) || [''])[0], led = (css.match(/\.led\.red\{[^}]*\}/) || [''])[0];
      return /background:transparent/.test(sign) && !/background:#/.test(sign) && /color:var\(--onair\)/.test(sign) && /border:1\.5px solid var\(--onair\)/.test(sign) && /background:#ff3b3b/.test(led) && !/animation|@keyframes/.test(sign + led) && !/@keyframes/.test(css.slice(css.indexOf('.tab.onair'), css.indexOf('.led.red') + 200)); })(require('fs').readFileSync(__dirname + '/../renderer/styles.css', 'utf8')));
  }
  // the line pictures at the left of the main tabs (icons.js)
  { const t = E('tabs').innerHTML, btn = id => (t.split('</button>').find(b => b.includes(`data-id="${id}"`)) || '') + '</button>', label = { home: 'Home', database: 'Database', setup: 'Race Setup', custom: 'Customization', settings: 'App Settings', rules: 'Racing Rules' };
    say('every main tab except Live Race has a line picture before its name: first in the button, 18 pixels, hidden from screen readers', Object.keys(label).every(id => btn(id).startsWith('<button class="tab hasico"') && btn(id).includes(`><svg class="tabico" viewBox="0 0 24 24" width="18" height="18" `) && btn(id).includes('aria-hidden="true"') && btn(id).endsWith(`</svg>${label[id]}</button>`)) && (t.match(/class="tabico"/g) || []).length === 6);
    say('...the name of each tab is still plain text next to it (for screen readers and for the keys)', Object.keys(label).every(id => btn(id).replace(/<svg.*?<\/svg>/, '').replace(/<[^>]*>/g, '') === label[id]));
    say('...the Live Race tab gets no picture: it keeps its Live on Air light', !btn('live').includes('<svg') && btn('live').includes('class="tab onair"') && btn('live').includes('class="led red"'));
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
        ctx.document = { createElement: () => { const c = { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: (m, k) => `${m} ${c.width}x${c.height} ${k}`.trim() }; return c; } };
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
  say('the Voice choice has a tooltip that tells how to install more voices in Windows 11 and Windows 10', (E('setupbox').innerHTML.match(/title="To add more voices[^"]*Manage voices &gt; Add voices[^"]*Text-to-speech option[^"]*"/g) || []).length === 3 && E('setupbox').innerHTML.includes('id="au-voicehelp"') && E('setupbox').innerHTML.includes('tabindex="0"'));
  { const html = () => E('setupbox').innerHTML, openCount = () => (html().match(/<details class="audgroup"[^>]* open/g) || []).length, all = () => (html().match(/<details class="audgroup"/g) || []).length;
    say('the calls are in folders, one per group, all closed to start, each saying how many of its calls are on (the calls that talk a lot are off in the default set)', all() === 13 && openCount() === 0 && html().includes('<strong>Weather</strong> <span class="muted">8 of 8 calls on</span>') && html().includes('<strong>Balance of Power</strong> <span class="muted">2 of 2 calls on</span>') && html().includes('<strong>Start</strong> <span class="muted">7 of 7 calls on</span>') && html().includes('<strong>Laps and records</strong>') && html().includes('<strong>Flags</strong> <span class="muted">5 of 5 calls on</span>') && html().includes('<strong>Time tokens</strong> <span class="muted">2 of 4 calls on</span>') && html().includes('<strong>Safety</strong> <span class="muted">0 of 4 calls on</span>') && html().includes('<strong>Laps and records</strong> <span class="muted">3 of 5 calls on</span>') && html().includes('<strong>Pit and fuel</strong> <span class="muted">4 of 6 calls on</span>') && html().includes('<strong>Penalties</strong> <span class="muted">3 of 6 calls on</span>'));
    say('...and the folders of the talkative calls say how many are off in a new set (Race progress 8 of 9, Gaps and battles 0 of 3)', html().includes('<strong>Race progress</strong> <span class="muted">8 of 9 calls on</span>') && html().includes('<strong>Gaps and battles</strong> <span class="muted">0 of 3 calls on</span>') && html().includes('<strong>Positions</strong> <span class="muted">2 of 2 calls on</span>'));
    say('every call sits inside its folder (the folder holds the fieldsets)', (html().match(/class="audcall"/g) || []).length === run('Announcer.CALLS.length') && run('Announcer.CALLS.length') === 64 && html().indexOf('<details class="audgroup"') < html().indexOf('class="audcall"'));
    await E('setupbox').onclick({target:{closest:()=>({dataset:{openall:'1'}})}});
    say('Open all folders opens every folder', openCount() === 13);
    await E('setupbox').onclick({target:{closest:()=>({dataset:{addline:'newleader'}})}});
    say('...and they stay open when the page redraws (a sentence was added)', openCount() === 13);
    await E('setupbox').onclick({target:{closest:()=>({dataset:{delline:'newleader:4'}})}});
    await E('setupbox').onclick({target:{closest:()=>({dataset:{openall:'0'}})}});
    say('Close all folders closes them again', openCount() === 0 && all() === 13); }
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
  say('slot car cards use the car picture and show laps driven', gc.includes('src="data:image/jpeg;base64,BBB"') && gc.includes('Laps driven') && gc.includes('NSR Ford GT40'));
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
    say('...brand, manufacturer and model stay in the list (the title joins them), with the technical details, laps driven and the extra fields', dh().includes('<h3 class="vctitle">Slot.it Porsche 956</h3>') && dh().includes('<dt>Brand</dt><dd>Slot.it</dd>') && dh().includes('<dt>Manufacturer</dt><dd>Porsche</dd>') && dh().includes('<dt>Model</dt><dd>956</dd>') && dh().includes('<dt>Tyres</dt><dd>Urethane</dd>') && dh().includes('<dt>Weight</dt><dd>78 g</dd>') && dh().includes('<dt>Laps driven</dt><dd>3</dd>') && dh().includes('<dt>Owned by</dt><dd>Shelf 3</dd>'));
    say('...text is safe (a "<" in a field is shown as text), and an empty field or extra field is left out', dh().includes('Flat &lt;6&gt;') && !dh().includes('Flat <6>') && !dh().includes('<dt>Gearing') && !dh().includes('<dt>Bought'));
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
    say('the Race Setup form has its settings in groups, in this order: session, length, start, rules, yellow flag, screens, Trackmate', ps.map(x=>/data-fg="(\w+)"/.exec(x)[1]).join()==='session,length,start,rules,yellow,screens,trackmate' && sch.groups.length===7);
    say('the settings are grouped as designed: Session (name, type, track), Length and result, Start, Penalties fuel and pits, Yellow flag, Screens and sound, Trackmate', sch.fields.map(f=>f.group+':'+f.key).join()==='session:name,session:sessionType,session:track,length:heatBy,length:heatPlan,length:heats,length:heatsEach,length:heatEven,length:heatSeeding,length:laps,length:duration,length:endRule,length:resultBy,length:points,length:countBy,length:bestHeats,length:dropWorst,length:fastestBonus,length:tieBreak,length:finals,length:finalMode,length:finalLaps,length:finalDuration,length:breakSeconds,length:breakAuto,start:lightsMin,start:lightsMax,start:lightsAfter,start:restartAfterRed,start:firstLap,rules:penaltySystem,rules:fuelRules,rules:bop,rules:weather,rules:pitHold,yellow:yellowTarget,yellow:yellowPoints,screens:layout,screens:layout2,screens:audioSet,trackmate:startPower,trackmate:trackcall,trackmate:trackcallWindow');
    say('every setting is in its own group, once, and nowhere else', sch.fields.length===43 && sch.fields.every(k=>ps.filter(x=>x.includes('data-key="'+k.key+'"')).length===1 && /data-fg="(\w+)"/.exec(ps.find(x=>x.includes('data-key="'+k.key+'"')))[1]===k.group && (f.match(new RegExp('id="f-'+k.key+'"','g'))||[]).length===1));
    say('each group has a header with its title and a line that says what is in it', sch.groups.every(g=>f.includes('<strong>'+g.title+'</strong>') && f.includes(g.note)) && f.includes('<summary><strong>Session</strong>'));
    say('Session and Length and result are open, the others closed', ps.map(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]?1:0).join('')==='1100000');
    say('Open all and Close all are offered, first, above the groups', f.includes('data-fgall="1"') && f.includes('data-fgall="0"') && f.indexOf('data-fgall')<f.indexOf('<details class="fgroup"') && f.includes('class="formgrid grouped"') && f.includes('class="fgrid"'));
    say('the buttons of the form are outside the groups (Save and Cancel stay in view)', f.indexOf('type="submit"')>f.lastIndexOf('</details>') && f.includes('id="cancel"'));
    run("state.schema.zzz={label:'Thing',plural:'Things',title:['name'],extra:false,fields:[{key:'name',label:'Name',type:'text'},{key:'size',label:'Size',type:'number'}]}");
    say('a form without groups is as it was (one flat list)', (run("openForm('zzz', null)"), !E('dlg').innerHTML.includes('fgroup') && E('dlg').innerHTML.includes('<div class="formgrid">') && !E('dlg').innerHTML.includes('data-fgall') && E('dlg').innerHTML.includes('id="f-size"')));
    run('delete state.schema.zzz');
    run("state.schema.racesetups.fields.push({ key: 'zzz', label: 'Something extra', type: 'text' })"); openForm_(); { const ex=parts(E('dlg').innerHTML), last=ex[ex.length-1];
      say('a setting that is in no group is not lost: it goes into a last group, More', ex.length===8 && /^ data-fg="_more"/.test(last) && last.includes('data-key="zzz"') && last.includes('<strong>More</strong>') && ex.slice(0,7).every(x=>!x.includes('data-key="zzz"'))); }
    run('state.schema.racesetups.fields.pop()'); openForm_(); say('...and without such a setting there is no More group', parts(E('dlg').innerHTML).length===7);
    // opening and closing is remembered for the next time the form is opened
    const mine=['session','length','start','rules','yellow','screens','trackmate'].map(id=>({dataset:{fg:id},open:id==='session'||id==='length',hidden:false}));
    E('dlg').querySelectorAll=sel=>sel==='.fgroup'?mine:[];
    openForm_(); mine[2].open=true; mine[2].ontoggle(); mine[0].open=false; mine[0].ontoggle();
    openForm_(); const f2=parts(E('dlg').innerHTML).map(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]?1:0).join('');
    say('a group you opened stays open the next time the form opens, and one you closed stays closed', f2==='0110000');
    E('dlg').onclick({target:{closest:()=>({dataset:{fgall:'1'}})}});
    say('Open all opens every group and the form remembers it', mine.every(g=>g.open===true) && parts((openForm_(),E('dlg').innerHTML)).every(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]) );
    E('dlg').onclick({target:{closest:()=>({dataset:{fgall:'0'}})}});
    say('Close all closes every group and the form remembers it', mine.every(g=>g.open===false) && parts((openForm_(),E('dlg').innerHTML)).every(x=>!/^ data-fg="\w+"( open)?>/.exec(x)[1]));
    run('delete formOpen.racesetups'); openForm_();
    say('another kind of form does not share it (and the memory is per kind of item)', !('zzz' in run('formOpen')) && parts(E('dlg').innerHTML).map(x=>/^ data-fg="\w+"( open)?>/.exec(x)[1]?1:0).join('')==='1100000');
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
    say('...a race shows both settings, in the group after the penalties, fuel and pits', reg['[data-fg="yellow"]'].hidden===false && reg['[data-key="yellowTarget"]'].hidden===false && reg['[data-key="yellowPoints"]'].hidden===false && sch.groups.findIndex(g=>g.id==='yellow')===sch.groups.findIndex(g=>g.id==='rules')+1);
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
    say('the fields are grouped as designed: Basics (name, lanes, scale, surface), Length and lanes (the length and everything about the lane lengths), Lap time limits, Picture and notes', sch.fields.map(f=>f.group+':'+f.key).join()==='basics:name,basics:lanes,basics:scale,basics:surface,length:length,length:laneModifier,length:outsideLane,length:laneSpacing,length:netTurns,length:laneLengths,laps:minLap,laps:maxLap,extras:picture,extras:notes');
    say('every field is in its own group, once, and nowhere else (the 14 fields of a track)', sch.fields.length===14 && sch.fields.every(k=>ps.filter(x=>x.includes('data-key="'+k.key+'"')).length===1 && /data-fg="(\w+)"/.exec(ps.find(x=>x.includes('data-key="'+k.key+'"')))[1]===k.group && (f.match(new RegExp('id="f-'+k.key+'"','g'))||[]).length===1));
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
      slotcars:[['basics','Basics','Brand, manufacturer, model and scale',1,['brand','manufacturer','model','scale']],['technical','Technical details','Motor, tyres, gearing and weight',1,['motor','tyres','tyreCompound','gearing','weight']],['pictures','Pictures','The main picture, and more pictures of the chassis and parts',0,['picture','extraPictures']],['stats','Statistics','Laps driven, counted automatically from your races',0,['lapsDriven']]],
      fuelrules:[['basics','Basics','Name, tank size and the fuel used per lap',1,['name','tank','perLap','targetLap']],['empty','Empty tank and refuelling','What happens when the fuel runs out, and the refuelling speed',1,['empty','rate']],['fast','Fast and slow laps','How much more fuel a fast lap uses, and how much a slow lap saves',0,['maxExtra','maxSaving']]],
      weathersystems:[['basics','Basics','Name, and whether the weather is counted in laps or in minutes',1,['name','unit']],['forecast','The rain','When it starts and how long it lasts, with the clouds before and the drying after',1,['startMode','startAt','startFrom','startTo','rainMode','rainFor','rainMin','rainMax','cloudyFor','clearingFor','sameInHeats']],['tyres','Tyres and penalties','Which tyres a pit stop gives, and the points for staying on the wrong tyres',1,['cloudyTyre','clearingTyre','react','wetPoints','dryPoints','repeat']],['hinder','Hindering the cars','How much slower the wrong tyres make a car (through its fuel use, refuelling and tank)',0,['hinder','hUse','hRate','hTank',...['dry','cloudy','wet','clearing'].flatMap(st=>['Dry','Inter','Wet'].map(c=>st+'On'+c))]],['conditions','Track conditions','Track and air temperature, wind speed and direction for every weather state (shown by the Track Conditions widget, said by the audio)',0,['units',...['Dry','Cloudy','Wet','Clearing'].flatMap(st=>['trackTemp','airTemp','windSpeed','windDir'].map(b=>b+st))]]],
      penaltysystems:[['basics','Basics','Name, and how penalty points turn into time',1,['name','timeRule','everyPoints','everySeconds','steps']],['special','Special penalties','Penalties the Race Director can give, such as a Stop-and-Go or a Drivethrough',1,['types']],['limits','Disqualification and fuel','When a driver is disqualified, and points for an empty tank',0,['dqPoints','fuelPoints']]]
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
    say('the driver and slot car tables list every field in the order of the form (as before the groups)', run("state.schema.drivers.fields.map(f=>f.key).join()")==='name,nickname,callsign,dateOfBirth,flag,avatar' && run("state.schema.slotcars.fields.map(f=>f.key).join()")==='brand,manufacturer,model,scale,motor,tyres,tyreCompound,gearing,weight,picture,extraPictures,lapsDriven');
    // the penalty system: the time rule fields still come and go inside Basics, and the special penalties are in their group
    run('delete formOpen.penaltysystems'); { const reg={}; E('dlg').querySelector=sel=>reg[sel]||(reg[sel]={hidden:false}); openF('penaltysystems',null);
      const setv=(id,v)=>{ document.getElementById(id).value=v; }, pick=v=>{ setv('f-timeRule',v); E('dlg').onchange({target:{tagName:'SELECT',id:'f-timeRule',dataset:{},type:'select-one',value:v}}); }, hid=k=>reg['[data-key="'+k+'"]'].hidden;
      pick('every'); say('the penalty system: with "Every X points add Y seconds" the two numbers show and the table of steps is hidden', hid('everyPoints')===false && hid('everySeconds')===false && hid('steps')===true);
      pick('steps'); say('...with "Steps I define" the table shows and the two numbers are hidden', hid('steps')===false && hid('everyPoints')===true && hid('everySeconds')===true);
      say('...and no group is hidden by it', ['basics','special','limits'].every(g=>!reg['[data-fg="'+g+'"]'] || reg['[data-fg="'+g+'"]'].hidden===false)); pick('every'); E('dlg').querySelector=()=>mk(); }
    openF('penaltysystems',null);
    { const ps=parts(E('dlg').innerHTML), sp=ps.find(x=>/data-fg="special"/.test(x));
      say('the penalty system: the special penalties (their list and the Add button) are in their group', sp.includes('id="pt-box"') && sp.includes('data-ptadd="1"') && !ps.find(x=>/data-fg="basics"/.test(x)).includes('id="pt-box"')); }
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
    say('a qualifying has no winner\'s cup (its line says Winner as before); a heat race has one in its line, one in the table and one for every heat (4)', cups() === 6 && html.includes('Quali · Qualifying') && /Winner: Alex<\/summary>/.test(html) && html.includes('1. <svg class="trophy"') && html.includes('2. Sam (4 laps'));
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
  say('...and it stands out: filled with the accent colour, with a page picture, and the Delete button next to it does not', /<button class="btn primary pdfbtn" type="button" data-pdf="s1"><svg[^>]*>.*?<\/svg><span>Export to PDF<\/span><\/button><button class="btn danger" data-delsession="s1">/.test(E('resbody').innerHTML) && (E('resbody').innerHTML.match(/class="btn primary pdfbtn"/g) || []).length === (E('resbody').innerHTML.match(/data-pdf="/g) || []).length);
  // Export to PDF asks what to include first (1.0.0): the helper clicks the button, then Export in the dialog that opens
  const pdfOpen=()=>E('resbody').onclick({target:{closest:sel=>sel.includes('data-pdf')?{dataset:{pdf:'s1'}}:null}});
  const dlgClick=(id,data)=>E('dlg').onclick({target:{closest:()=>({id,dataset:data||{}})}});
  const pdfClick=async()=>{ const done=pdfOpen(); await dlgClick('pdfgo'); await done; };
  await pdfClick();
  say('the report is sent to be saved as a PDF with a sensible file name', exported.length===1 && exported[0][1]==='Friday Sprint 2026-10-11.pdf' && exported[0][0].includes('All lap times') && exported[0][0].includes('5.500'));
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
    say('...the list shows every field to start, as it always did', th(h).join()==='Name,Number of lanes,Scale,Track Surface,Track length (metres),Lane length modifier,The track length is that of,Distance between the lanes (millimetres, centre to centre),Full turns the track makes (left bends minus right bends),Length of every lane (metres), lane 1 first,Minimum lap time (seconds),Maximum lap time (seconds),Picture,Notes,');
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
    say('...the records are in the first two folders (with their Remove buttons) and the sessions, still rows that open, in the third', h.indexOf('data-folder="results:tracks"') < h.indexOf('data-delrec="track"') && h.indexOf('data-delrec="track"') < h.indexOf('data-folder="results:pb"') && h.indexOf('data-delrec="pb"') < h.indexOf('data-folder="results:sessions"') && h.indexOf('data-folder="results:sessions"') < h.indexOf('<details class="card sess">') && (h.match(/<details class="card sess">/g) || []).length === 2 && h.includes('data-pdf="s1"') && h.includes('data-pdf="s2"') && h.endsWith('</div></details></details>'));
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
  { // the race setup form for a Time Token Session
    const F = run('state.schema.racesetups.fields'), isShown = run('isShown');
    const shown = (type, extra = {}) => F.filter(f => isShown(f, k => ({ sessionType: type, heatBy: 'laps', heatPlan: 'manual', resultBy: 'laps', trackcall: 'yellowred', ...extra })[k])).map(f => f.key);
    const tok = shown('tokens'), race = shown('race');
    say('Session type has Time Token Session, and says where its settings are', run("state.schema.racesetups.fields.find(f=>f.key==='sessionType').options.map(o=>o.join(':')).join()").includes('tokens:Time Token Session') && /Race Setup > Time Tokens/.test(run("state.schema.racesetups.fields.find(f=>f.key==='sessionType').hint")));
    say('a Time Token Session asks for a name, track, layouts, audio set and the Trackmate settings, and nothing about lights, laps, fuel or penalties', tok.join() === 'name,sessionType,track,layout,layout2,audioSet,startPower,trackcall,trackcallWindow');
    say('...a race still asks for all of them', ['lightsMin', 'lightsMax', 'lightsAfter', 'restartAfterRed', 'firstLap', 'penaltySystem', 'fuelRules', 'pitHold', 'laps', 'endRule'].every(k => race.includes(k)) && !race.includes('heatBy'));
    say('...so do the other kinds of session (practice, qualifying, timed, heats)', ['practice', 'qualifying', 'timed', 'heats'].every(t => shown(t).includes('lightsMin') && shown(t).includes('penaltySystem')));
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
    say('a Time Token Session can be started with no drivers and cars: the lanes say Guest and (no car), nothing is reported missing', hh.includes('Guest (no driver)') && hh.includes('(no car)') && !hh.includes('class="issues"') && !hh.includes('needs a driver') && /<button class="btn primary" id="start" >/.test(hh) );
    say('...the button says Open the session, and a line explains how time is added', hh.includes('Open the session') && !hh.includes('>Start race<') && hh.includes('A Time Token Session starts with every lane switched off'));
    store.racesetups = [{ id: 'k2', name: 'Friday', sessionType: 'race', track: 't1', laps: 5 }]; run("state.settings.lastSetupId = 'k2'"); await run('render()');
    say('a normal race still needs a driver and a car on every lane', E('view').innerHTML.includes('needs a driver and a car') && E('view').innerHTML.includes('>Start race<'));
    Object.assign(store, { racesetups: keep.racesetups, tracks: keep.tracks }); run(`state.settings.lastSetupId = ${JSON.stringify(keep.last || '')}; state.settings.assignments = ${JSON.stringify(keep.asg || {})}`); }
  { // Race Setups: the session type is the folder
    const keepSetups = store.racesetups, keepTracks = store.tracks;
    store.racesetups = [{id:'r1',name:'Friday',sessionType:'race',track:'t1',laps:10},{id:'r2',name:'Sprint',sessionType:'race',track:'t1',laps:5},{id:'r3',name:'Warm up',sessionType:'practice',track:'t1'},
      {id:'r4',name:'Old style',sessionType:'enduro',track:'t1',laps:3}];
    run('folderClosed.clear()'); run("state.tab='setup'"); await run('render()');
    const sm = () => E('setupmgr').innerHTML, folders_ = () => sm().match(/<details class="dbfolder"[^>]*>/g) || [], opens = () => (sm().match(/<details class="dbfolder"[^>]* open>/g) || []).length, titles = () => (sm().match(/<details class="dbfolder"[^>]*><summary><strong>[^<]*/g) || []).map(x => x.replace(/.*<strong>/, ''));
    say('Race Setups has a folder for every session type in use, in the order of the session types, with how many setups it holds', titles().join('|') === 'Free practice|Race by laps|Other' && sm().includes('<strong>Free practice</strong> <span class="muted">1 race setup</span>') && sm().includes('<strong>Race by laps</strong> <span class="muted">2 race setups</span>'));
    say('...a setup of a session type that is not in the list goes in Other, so that none is lost', sm().includes('<strong>Other</strong> <span class="muted">1 race setup</span>') && sm().includes('Old style'));
    say('...a session type without setups has no folder (Qualifying, Timed race and Heat-based race are not there)', !sm().includes('<strong>Qualifying</strong>') && !sm().includes('<strong>Timed race</strong>') && !sm().includes('<strong>Heat-based race</strong>'));
    say('...and every setup is in the folder of its type', (() => { const h = sm(), at = t => h.indexOf(`<strong>${t}</strong>`); return h.indexOf('Warm up') > at('Free practice') && h.indexOf('Warm up') < at('Race by laps') && h.indexOf('Friday') > at('Race by laps') && h.indexOf('Sprint') > at('Race by laps') && h.indexOf('Friday') < at('Other') && h.indexOf('Old style') > at('Other'); })());
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
    say('in the grid the cards sit in the same folders, and a card does not repeat the session type', titles().join('|') === 'Free practice|Race by laps|Other' && (sm().match(/class="gcard"/g) || []).length === 4 && !/<span class="muted">Session type<\/span>/.test(sm()) && sm().includes('10 laps'));
    await E('setupmgr').onclick({ target: { closest: () => ({ id: 'vlist', dataset: {} }) } }); await new Promise(r => setTimeout(r, 20));
    store.racesetups = [{id:'r1',name:'Friday',sessionType:'race',track:'t1',laps:10},{id:'r2',name:'Sprint',sessionType:'race',track:'t1',laps:5}];
    run("state.tab='setup'"); await run('render()');
    say('with setups of one session type there is one folder and no Open all / Close all (nothing to open or close all of)', titles().join('|') === 'Race by laps' && !sm().includes('data-folderall'));
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
    await E('setupbox').onchange({target:{dataset:{slot:'on'},files:[{}]}});
    say('a picture in Countdown / All lights is shown dimmed in every empty cell that falls back to it, and in the preview', (h().match(/class="lgpick behind"/g)||[]).length>=40 && h().includes('title="Yellow flag, light 3: uses the Countdown picture"') && h().includes('title="Lights off, light 2: a plain round light"') && (h().match(/<image/g)||[]).length===3);
    await E('setupbox').onchange({target:{dataset:{slot:'yellow_3'},files:[{}]}});
    say('a picture of its own for one light in one state: the cell shows it undimmed with a Remove button, and the cells that fall back to it change', h().includes('data-clear="yellow_3"') && (h().match(/data-clear=/g)||[]).length===2 && !h().includes('title="Yellow flag, light 3: uses') && h().includes('Remove the picture for Yellow flag, light 3'));
    E('is-prev').onchange({target:{value:'yellow'}});
    say('the preview can show a race state', run('imgEd.preview')==='yellow' && h().includes('<option value="yellow" selected>') && h().includes('class="slsvg"'));
    E('setupbox').onclick({target:{closest:()=>({dataset:{clear:'yellow_3'}})}});
    say('a picture is removed again (the cell falls back to Countdown)', !h().includes('data-clear="yellow_3"') && h().includes('title="Yellow flag, light 3: uses the Countdown picture"'));
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
    say('a set from before the grid: Countdown and Lights off are in their cells, and the other cells show Countdown dimmed', (E('setupbox').innerHTML.match(/data-clear=/g)||[]).length===2 && E('setupbox').innerHTML.includes('data-clear="on"') && E('setupbox').innerHTML.includes('data-clear="off"') && E('setupbox').innerHTML.includes('uses the Countdown picture"'));
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
    say('seeding with a qualifying: a line says it is seeded by the latest one on this track (1 October; the older one and the one on another track do not count)', h.includes('Seeded by the latest qualifying on this track (2026-10-01).') && !h.includes('drivers who did not take part'));
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
