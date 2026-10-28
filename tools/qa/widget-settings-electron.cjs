const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const output=path.resolve(__dirname,'../../../outputs/widget-settings');fs.mkdirSync(output,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/widget-settings-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(1),120000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
 await wait(500);win.setMinimumSize(0,0);win.setContentSize(1200,950);
 await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));window.check=(v,m)=>{if(!v)throw Error(m);};
 const layout={name:'Widget appearance QA',ratioW:16,ratioH:9,guides:{v:[],h:[]},widgets:[{...Widgets.newWidget('aiolane',0,10,10),w:400,h:320},{...Widgets.newWidget('pace',1,430,10),w:260,h:200}]};
 state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['title','frame','advanced','status']);state.editing={id:null,draft:layout,sel:[layout.widgets[0]],snap:true,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();
 window.change=(scope,key,value)=>{const input=document.querySelector('#side [data-ws="'+scope+'"][data-key="'+key+'"]');check(input,'control '+key);if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
 change('appearance','fill','gradient');change('appearance','source','lane');change('appearance','accent','lane');change('appearance','edge','right');change('appearance','radiusPixels',14);change('appearance','angle',37);
 check(getComputedStyle(document.querySelector('#canvas .lw')).backgroundImage.includes('37deg'),'arbitrary angle renders');
 for(const [angle] of WidgetSettings.directions){change('appearance','angle',angle);check((angle===180?getComputedStyle(document.querySelector('#canvas .lw')).backgroundImage.startsWith('linear-gradient('):getComputedStyle(document.querySelector('#canvas .lw')).backgroundImage.includes(angle+'deg')),'direction '+angle+' actual '+document.querySelector('#canvas .lw').style.cssText);}
 document.querySelector('[data-ws-action=reverse]').click();check(state.editing.sel[0].appearance.angle===270,'reverse');window.editorUndo();check(state.editing.sel[0].appearance.angle===90,'undo');window.editorRedo();check(state.editing.sel[0].appearance.angle===270,'redo');
 change('typography','mode','manual');change('typography','valueSize',32);change('typography','supportSize',13);change('typography','iconSize',32);change('appearance','depth','0');
 document.querySelector('[data-ws-action=copy]').click();state.editing.sel=[state.editing.draft.widgets[1]];renderEditor();document.querySelector('[data-ws-action=paste]').click();check(state.editing.sel[0].lane===1&&state.editing.sel[0].type==='pace'&&!state.editing.sel[0].typography,'copy is appearance only');
 document.getElementById('e-appearance').click();const input=document.querySelector('#dlg [data-key="surfaceOpacity"]')||document.querySelector('dialog [data-key="surfaceOpacity"]');check(input,'layout defaults');input.value=75;input.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('wa-save').click();check(state.editing.draft.widgetAppearance.surfaceOpacity===75,'defaults saved');
 await editorSave();const saved=(await api.list('layouts')).find(x=>x.name==='Widget appearance QA');check(saved.widgets[0].appearance.angle===270&&saved.widgets[0].typography.valueSize===32&&saved.widgetAppearance.surfaceOpacity===75,'persistence');window.qaSaved=saved;
 state.editing={id:saved.id,draft:structuredClone(saved),sel:[],snap:true,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};state.editing.sel=[state.editing.draft.widgets[0]];await render();check(document.querySelector('[data-key=valueSize]').value==='32','reopened controls');`);
 assert(await run(`const side=document.getElementById('side');return side.scrollWidth<=side.clientWidth+1;`),'settings panel fits without horizontal scrolling');
 fs.writeFileSync(path.join(output,'editor.png'),(await win.webContents.capturePage()).toPNG());
 // Group resets must be isolated, undoable, multi-selection safe and persistent.
 await run(`
 check(document.querySelector('[data-ws-group=background] [data-key=surfaceOpacity]'),'background opacity grouped');
 check(document.querySelector('[data-ws-group=border] [data-key=borderOpacity]'),'border opacity grouped');
 check(document.querySelector('[data-ws-group=accent] [data-key=accentOpacity]'),'accent opacity grouped');
 check(!document.querySelector('[data-side=advanced] [data-key=surfaceOpacity]'),'opacity moved from Advanced');
 change('appearance','border','custom');change('appearance','borderColor','#123456');change('appearance','borderOpacity',55);
 const first=state.editing.sel[0],prior=structuredClone(first);document.querySelector('[data-ws-action=reset-group][data-group=border]').click();
 check(!state.editing.sel[0].appearance.border&&!state.editing.sel[0].appearance.borderColor&&!state.editing.sel[0].appearance.borderOpacity,'whole border override cleared');
 check(state.editing.sel[0].appearance.angle===prior.appearance.angle&&state.editing.sel[0].appearance.accent===prior.appearance.accent,'other groups preserved');
 editorUndo();check(state.editing.sel[0].appearance.borderOpacity===55,'group undo');editorRedo();check(!state.editing.sel[0].appearance.borderOpacity,'group redo');
 state.editing.sel=[...state.editing.draft.widgets];renderEditor();const opts=JSON.stringify(state.editing.sel.map(w=>[w.lane,w.opt,w.typography]));
 document.querySelector('[data-ws-action=reset-group][data-group=background]').click();
 check(state.editing.sel.every(w=>!('fill' in w.appearance)&&!('angle' in w.appearance)&&w.appearance.accent==='lane'),'multi reset preserves accents');
 check(JSON.stringify(state.editing.sel.map(w=>[w.lane,w.opt,w.typography]))===opts,'multi reset preserves content');
 check(state.editing.sel.every(w=>Frame.appearance(w,state.editing.draft).surfaceOpacity===75),'reset restores layout opacity');
 await editorSave();const after=(await api.list('layouts')).find(x=>x.name==='Widget appearance QA');check(after.widgets.every(w=>!('angle' in w.appearance)&&w.appearance.edge==='right'),'reset persisted');
 state.editing={id:after.id,draft:structuredClone(after),sel:[],snap:true,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};state.editing.sel=[state.editing.draft.widgets[0]];renderEditor();
 check(document.querySelector('[data-key=surfaceOpacity]').value==='75','reset reopened inherited control');
 document.getElementById('e-appearance').click();check(!document.querySelector('.ws-defaults [data-ws-action=copy]'),'defaults omit widget copy actions');
 document.querySelector('.ws-defaults [data-ws-action=reset-group][data-group=background]').click();check(document.querySelector('.ws-defaults [data-key=surfaceOpacity]').value==='100','default group reset');document.getElementById('wa-cancel').click();check(state.editing.draft.widgetAppearance.surfaceOpacity===75,'cancel keeps defaults');
 change('appearance','fill','gradient');change('appearance','source','lane');change('appearance','border','shade');state.sideOpen=new Set(['frame']);renderEditor();`);
 for(const width of [1200,800])for(const theme of ['dark','light']){
  win.setContentSize(width,1700);await run(`document.documentElement.dataset.theme='${theme}';document.querySelectorAll('#side details').forEach(e=>e.open=true);`);await wait(60);
  assert(await run(`const e=document.getElementById('side');return e.scrollWidth<=e.clientWidth+1;`),'all folders fit '+width+' '+theme);
  await run(`document.querySelectorAll('#side details').forEach(e=>e.open=e.dataset.side==='frame');document.getElementById('side').scrollTop=0;`);await wait(60);
  if(width===1200){const rect=await run(`const r=document.getElementById('side').getBoundingClientRect();return {x:Math.floor(r.x),y:Math.floor(r.y),width:Math.ceil(r.width),height:Math.ceil(r.height)};`);fs.writeFileSync(path.join(output,'groups-'+theme+'.png'),(await win.webContents.capturePage(rect)).toPNG());}
 }
 win.setContentSize(1200,950);
 const optionCases=await run(`let checked=0;state.sideOpen=new Set(['arrange','opts','title','text','frame','advanced','status']);
 for(const def of Widgets.REGISTRY){const w=Widgets.newWidget(def.type,0,10,10);state.editing.draft.widgets=[w];state.editing.sel=[w];const side=document.getElementById('side');side.innerHTML=sideHtml();
 for(const e of side.querySelectorAll('.ws-section input,.ws-section select,.ws-section button')){if(!e.getClientRects().length)continue;const r=e.getBoundingClientRect(),b=e.closest('.ws-section').getBoundingClientRect();check(r.left>=b.left-1&&r.right<=b.right+1,'option clipped '+def.type+' '+(e.dataset.key||e.id||e.textContent));}checked++;}return checked;`);
 await run(`const e=RaceEngine.createRace({type:'race',laps:65,minLap:100,fuel:{on:true,tank:100,perLap:2,rate:2},tyrewear:TyreWear.clean({}),pushsave:PushSave.clean(PushSave.defaults()),entries:[{lane:0,driverId:'a',driverName:'James',carName:'NSR Mosler MT900R'},{lane:1,driverId:'b',driverName:'Bjornie',carName:'Corvette'}]});e.start(0);for(let n=1;n<=5;n++)e.cross(0,n*10000);
 window.qaContext={raceId:'qa-settings',eng:e,now:55000,phase:'running',setup:{sessionType:'race',laps:65},track:{name:'Slotrace Circuit'},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
 document.body.innerHTML='<main style="padding:16px"><div id="qa-host"></div></main>';
 window.qaDraw=(type,width,theme)=>{document.documentElement.dataset.theme=theme;const w={...Widgets.newWidget(type,0,0,0),w:1000,h:type==='aiodriver'?1300:850,opt:type==='pace'?{look:'gauge'}:{},appearance:{fill:'gradient',source:'lane',angle:135,accent:'lane',edge:'left',radiusPixels:14,depth:'35'},typography:{mode:'manual',valueSize:55,supportSize:22,labelSize:18,iconSize:90,minSize:14}};const layout={ratioW:1000,ratioH:w.h,widgets:[w]},ctx={...qaContext,layout,lanes:2};const viewer=LiveShare.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(LiveShare.packStatic(ctx))));viewer.feedDynamic(JSON.parse(JSON.stringify(LiveShare.packDynamic(ctx))),55000);document.getElementById('qa-host').innerHTML='<div id="qa-canvas" class="canvas live"></div>';const c=document.getElementById('qa-canvas');window.qaNodes=LiveCanvas.build(c,layout,2);c.style.width=width+'px';LiveCanvas.paint(qaNodes,viewer.shared(55000));return getComputedStyle(qaNodes[0].el).backgroundImage;};`);
 for(const theme of ['dark','light','ocean'])for(const width of [600,360])for(const type of ['aiolane','aiodriver','pace','tyrelife','lastlap']){
  assert.match(await run(`return qaDraw('${type}',${width},'${theme}');`),/linear-gradient/);await wait(30);
  assert(await run(`return getComputedStyle(qaNodes[0].el,'::after').borderLeftWidth!=='0px';`),'accent '+type);
  if(await run(`return !!document.querySelector('.aio-small');`)){fs.writeFileSync(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());console.log(await run(`return [...document.querySelectorAll('.aio-box,.aio-content,.aio-fact b')].map(e=>({cls:e.className,text:e.textContent,w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight,font:getComputedStyle(e).fontSize}));`));throw Error('readable '+type+' '+width+' '+theme);}
  if(theme==='dark'&&['aiodriver','pace','tyrelife'].includes(type))fs.writeFileSync(path.join(output,type+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
 }
 await run(`qaDraw('aiodriver',600,'light');`);await wait(40);fs.writeFileSync(path.join(output,'aiodriver-light.png'),(await win.webContents.capturePage()).toPNG());
 await run(`qaDraw('lastlap',360,'dark');const n=qaNodes[0];const shared={};const original=Timing.content;try{Timing.content=()=>({html:'9.123'});LiveCanvas.paint(qaNodes,shared);const dark=n.el.style.color;document.documentElement.dataset.theme='light';LiveCanvas.paint(qaNodes,shared);check(dark!==n.el.style.color,'static value updates contrast when theme changes');}finally{Timing.content=original;}
 const accent=getComputedStyle(n.el,'::after').borderLeftColor;Frame.present(n.el,n.w,n.layout,{bg:'#ffdd00',color:'#101010'});check(getComputedStyle(n.el).backgroundImage==='none','race state temporarily replaces gradient');check(getComputedStyle(n.el,'::after').borderLeftColor===accent,'state keeps accent');n.w.appearance.highlights=false;Frame.present(n.el,n.w,n.layout,{bg:'#ffdd00',color:'#101010'});check(getComputedStyle(n.el).backgroundImage.includes('gradient'),'state highlight can be disabled');n.w.appearance.surfaceOpacity=0;Frame.present(n.el,n.w,n.layout);check(getComputedStyle(n.el).boxShadow==='none'&&getComputedStyle(n.el,'::after').borderLeftColor===accent,'transparent surface keeps separate accent and loses depth');`);
 const registryCases=await run(`
 let count=0;const host=document.getElementById('qa-host');host.innerHTML='<div id="registry-canvas" class="canvas" style="width:600px;height:400px"></div>';const canvas=document.getElementById('registry-canvas');
 for(const definition of Widgets.REGISTRY)for(const edge of ['top','left','right']){
  const w={...Widgets.newWidget(definition.type,0,0,0),w:1000,h:500,appearance:{fill:'gradient',source:'custom',baseColor:'#7835ad',accent:'custom',accentColor:'#36b9de',edge,depth:'0',radiusPixels:30}};
  const layout={ratioW:2,ratioH:1,widgets:[w]};state.editing={draft:layout,imageSets:[],rowDesigns:[],chartDesigns:[],drivers:[],cars:[],teams:[]};canvas.innerHTML=widgetHtml(w,false,false,layout);const el=canvas.querySelector('.lw');Frame.present(el,w,layout);const s=getComputedStyle(el),accent=getComputedStyle(el,'::after');
  check(s.backgroundImage.includes('linear-gradient'),'gradient '+definition.type);check(s.boxShadow==='none'||s.boxShadow.split('rgba(0, 0, 0, 0)').length>1,'flat depth '+definition.type);
  check(parseFloat(accent[edge==='top'?'borderTopWidth':edge==='left'?'borderLeftWidth':'borderRightWidth'])>0,'accent '+definition.type+' '+edge);check(accent.borderTopLeftRadius===s.borderTopLeftRadius,'curved corner '+definition.type);count++;
 }return count;`);
 assert.deepEqual(await run('return qaErrors;'),[]);
 console.log('WIDGET SETTINGS ELECTRON PASSED: '+optionCases+' widget option panels, grouped opacity and isolated resets, multi-selection/undo/save/reopen, default reset/cancel, expanded folders in 4 width/theme cases, 8 directions, arbitrary angle, reverse, copy isolation, 30 live shared cases; '+registryCases+' registry gradient/depth/accent cases.');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
});});require('../../main');
