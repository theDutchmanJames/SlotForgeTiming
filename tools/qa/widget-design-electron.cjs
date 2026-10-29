const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/widget-design-options');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/widget-design-'+process.pid));app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const shot=async name=>{await wait(100);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  win.setMinimumSize(0,0);win.setContentSize(1440,1000);win.showInactive();await wait(350);
  await run(`window.designErrors=[];addEventListener('error',e=>designErrors.push(e.message));addEventListener('unhandledrejection',e=>designErrors.push(String(e.reason)));window.ck=(v,m)=>{if(!v)throw Error(m)};
    state.tab='custom';state.customSub='layouts';state.sideOpen=new Set(['title','advanced','status']);
    const w={...Widgets.newWidget('bestlap',0,20,20),w:380,h:150};
    state.editing={id:null,draft:{name:'Design options QA',ratioW:10,ratioH:6,widgets:[w],guides:{v:[],h:[]}},sel:[w],snap:false,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};await render();
    window.control=(selector,value)=>{const t=document.querySelector('#side '+selector);ck(t,'Missing control '+selector);if(t.type==='checkbox')t.checked=value;else t.value=value;t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));};
    control('[data-key=separatePadding]',true);control('[data-key=paddingLeft]',24);control('[data-key=paddingRight]',8);control('[data-key=outline]',1);control('[data-key=shadow]','soft');control('[data-wd-format=digits]',2);control('[data-wd-format=fraction]',65);
    ck(state.editing.sel[0].appearance.paddingLeft===24,'Padding stored');ck(state.editing.sel[0].numberFormat.digits===2,'Formatting stored');ck(document.querySelector('#canvas .lw-val').textContent==='10.00','Editor uses chosen precision');
    document.querySelector('[data-wd-name]').value='Club timing';document.querySelector('[data-wd-action=save-style]').click();
    ck(state.editing.draft.widgetStyles.length===1,'Style saved via controls');
    document.querySelector('[data-wd-style]').value=state.editing.draft.widgetStyles[0].id;document.querySelector('[data-wd-action=link-style]').click();
    ck(state.editing.sel[0].appearanceStyle,'Style linked via controls');
    document.querySelector('[data-wd-action=rule-add]').click();control('[data-wd-rule="0"][data-key=value]',10);control('[data-wd-rule="0"][data-key=target]','text-border');
    ck(state.editing.sel[0].designRules[0].value==='10','Rule controls stored');
    document.querySelector('[data-wd-action=rule-preview]').click();ck(document.querySelector('.wd-rule-preview').style.borderColor,'Preview applied');
    const style=state.editing.draft.widgetStyles[0];
    const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify({kind:'slotforge-widget-style',name:'Imported club style',style:style.style})],'style.json',{type:'application/json'}));const picker=document.querySelector('[data-wd-import]');picker.files=transfer.files;picker.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,100));ck(state.editing.draft.widgetStyles.length===2,'Style imports through the real file control');
    const saved=await api.add('layouts',JSON.parse(JSON.stringify({...state.editing.draft,...Frame.pickLayout(state.editing.draft)})));const back=(await api.list('layouts')).find(l=>l.id===saved.id);ck(back.widgetStyles.length===2&&back.widgets[0].numberFormat.digits===2&&back.widgets[0].designRules.length===1,'Database round-trip');
  `);
  await shot('editor-rules');
  await run(`document.querySelector('[data-ws-group=styles]').scrollIntoView({block:'center'});`);await shot('editor-styles');
  await run(`document.querySelector('[data-ws-group=format]').scrollIntoView({block:'center'});`);await shot('editor-formatting');
  await run(`
    window.designLayout={name:'Widget design options',ratioW:1000,ratioH:600,laneColors:[{bg:'#2f9fc5'},{bg:'#76a747'}],widgets:[]};
    const make=(type,lane,x,y,w,h,opt={},extra={})=>({...Widgets.newWidget(type,lane,x,y),w,h,opt,appearance:{source:'theme',border:'shade',borderShade:30,accent:'lane',edge:'left',radiusPixels:14},...extra});
    designLayout.widgets=[
      make('bestlap',0,15,18,300,130,{}, {title:'Smaller fractions',numberFormat:{digits:3,fraction:60}}),
      make('fuel',0,340,18,300,130,{barStyle:'digital',mode:'both',format:'percent'},{title:'Units below',numberFormat:{digits:1,units:'below'},typography:{outline:1,shadow:'soft',effectColor:'#101820'}}),
      make('trackrecord',0,665,18,320,130,{}, {title:'Record with name',numberFormat:{digits:2,fraction:70}}),
      make('aiolane',0,15,175,300,200,{avatar:true,iconLayout:'above',car:true,arrangement:'compact'}),
      make('aiolane',1,340,175,300,200,{avatar:true,iconLayout:'none',car:true},{appearance:{source:'custom',baseColor:'#eeeeee',border:'shade',borderShade:-30,separatePadding:true,paddingTop:16,paddingRight:8,paddingBottom:16,paddingLeft:20,contentGap:8,radiusPixels:14}}),
      make('lastlap',0,665,175,320,200,{columns:2,lapsPerColumn:3,lapNumbers:true},{title:'Two-column lap list',numberFormat:{digits:2,fraction:70}}),
      make('name',0,15,405,300,130,{}, {title:'Low fuel rule',designRules:[{field:'fuelpct',op:'lt',value:'10',target:'text-border',color:'#ffbd45'}]}),
      make('clock',0,340,405,300,130,{style:'classic'}, {title:'Original clock',numberFormat:{digits:1,fraction:60,clock:true}}),
      make('totaltime',0,665,405,320,130,{scope:'heat'}, {title:'Independent margins',appearance:{source:'theme',separatePadding:true,paddingTop:12,paddingBottom:12,paddingLeft:40,paddingRight:8,radiusPixels:14},numberFormat:{digits:2}})
    ];
    window.designHost=document.createElement('div');designHost.style.cssText='position:fixed;inset:0;z-index:99999;background:var(--bg);padding:20px;overflow:auto';document.body.append(designHost);
    designHost.innerHTML='<h2 style="margin:0 0 10px;font-size:24px">Widget design options</h2><div id="design-canvas" class="canvas live"></div>';
    window.designNodes=LiveCanvas.build(document.getElementById('design-canvas'),designLayout,2,{maxH:65});window.paintDesign=scenario=>LiveCanvas.paint(designNodes,WidgetPreview.state({}, {scenario,layout:designLayout}));paintDesign('warning');
    ck(designNodes[0].val.querySelector('.wd-fraction'),'Fraction rendered');ck(designNodes[2].val.querySelector('.record-value .wd-fraction'),'Record formatted');
    ck(designNodes[5].val.querySelectorAll('.wd-fraction').length===5,'Visible list values formatted');
    ck(designNodes[6].el.dataset.designRule==='0','Rule evaluated from real engine');paintDesign('race');ck(designNodes[6].el.dataset.designRule===undefined,'Rule clears');ck(designNodes[6].el.style.borderColor!=='rgb(255, 189, 69)','Rule border restored');paintDesign('warning');
    const legacy={...Widgets.newWidget('name',0,0,0),designRules:[{field:'fuelpct',op:'lt',value:'10',target:'text-border',color:'#ff0000'}]};const legacyLayout={ratioW:1000,ratioH:300,laneColors:[{bg:'#eeeeee',text:'#123456'}],widgets:[legacy]},legacyHost=document.createElement('div');designHost.append(legacyHost);const legacyNodes=LiveCanvas.build(legacyHost,legacyLayout,1,{maxH:0});
    const legacyPaint=scenario=>LiveCanvas.paint(legacyNodes,WidgetPreview.state({}, {scenario,layout:legacyLayout}));legacyPaint('race');ck(legacyNodes[0].el.style.color==='rgb(18, 52, 86)','Original lane text colour retained');legacyPaint('warning');ck(legacyNodes[0].el.style.color==='rgb(255, 0, 0)','Rule overrides original lane');legacyPaint('race');ck(legacyNodes[0].el.style.color==='rgb(18, 52, 86)','Original lane colour restored after rule');LiveCanvas.dispose(legacyNodes);legacyHost.remove();
    const before=JSON.stringify(designLayout);for(let i=0;i<10;i++)paintDesign('warning');ck(JSON.stringify(designLayout)===before,'Renderer does not migrate saved layout');
  `);
  const themes=['dark','light','midnight','forest','sunset','violet','carbon','ocean'];
  for(const theme of themes){await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();paintDesign('warning');`);await wait(100);
   await run(`for(const n of designNodes){ck(!n.error,'Widget render error');ck(!n.el.classList.contains('wf-crowded'),'Crowded '+n.w.type);const b=n.el.getBoundingClientRect(),v=n.val.getBoundingClientRect();ck(v.right<=b.right+1&&v.left>=b.left-1,'Value frame outside '+n.w.type);ck(n.val.scrollWidth<=n.val.clientWidth+2,'Text horizontal overflow '+n.w.type);}`);
   await shot(theme+'-widgets');
  }
  // A single card resized down to 300px, and the same original layout round-trip.
  win.setContentSize(600,700);await run(`LiveCanvas.dispose(designNodes);designLayout={...designLayout,ratioW:1000,ratioH:1000,widgets:[{...designLayout.widgets[0],x:30,y:20,w:940,h:250},{...designLayout.widgets[3],x:30,y:310,w:940,h:480}]};designNodes=LiveCanvas.build(document.getElementById('design-canvas'),designLayout,2,{maxH:65});paintDesign('race');`);await wait(100);await shot('600px');
  await run(`for(const n of designNodes)ck(!n.el.classList.contains('wf-crowded')&&!n.val.querySelector('.aio-small'),'Narrow readable '+n.w.type);LiveCanvas.dispose(designNodes);designHost.remove();`);
  assert.deepEqual(await run('return designErrors;'),[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes,checks:['Editor controls','Style save/link','Rule preview','Real database round-trip','Rule applies and clears','Numeric formatting and records','Two-column lists','All-in-One arrangements','Separate padding','Eight themes','600px resize','No renderer errors']},null,2));
  console.log('WIDGET DESIGN ELECTRON PASSED');app.quit();
 }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure-dom.json'),JSON.stringify(await run(`return window.designNodes?.map(n=>({type:n.w.type,lane:n.w.lane,html:n.el.outerHTML,rect:[n.val.clientWidth,n.val.clientHeight,n.val.scrollWidth,n.val.scrollHeight],children:[...n.val.querySelectorAll('*')].map(el=>({cls:el.className,txt:el.textContent?.slice(0,50),rect:[el.clientWidth,el.clientHeight,el.scrollWidth,el.scrollHeight],style:getComputedStyle(el).cssText,fit:Frame.textFits(el,el,false),bounds:el.getBoundingClientRect().toJSON(),ranges:(()=>{let r=document.createRange();r.selectNodeContents(el);return [...r.getClientRects()].map(b=>b.toJSON())})()}))}));`),null,2));await shot('failure');app.exit(1);}
}));require('../../main');
