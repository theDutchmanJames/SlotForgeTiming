// Regression checks use the real renderer with isolated settings.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../../../outputs/widget-customization-audit');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/customization-audit-'+process.pid));app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  win.setContentSize(1200,850);win.showInactive();await wait(350);
  const result=await run(`
   window.audit=[];window.check=(name,ok,detail)=>audit.push({name,ok:!!ok,detail});
   const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:99999;padding:20px;background:var(--bg)';document.body.append(host);host.innerHTML='<h2>Widget customization audit</h2><div class="canvas live" id="audit-canvas"></div>';
   const w={...Widgets.newWidget('speed',0,20,20),w:400,h:180,numberFormat:{units:'below',digits:1}};
   const l={ratioW:1000,ratioH:600,widgets:[w],laneColors:[{bg:'#eeeeee',text:'#222222'}]};
   const nodes=LiveCanvas.build(document.getElementById('audit-canvas'),l,1,{maxH:80}),n=nodes[0];
   n.val.textContent='23.4 km/h';WidgetView.fit(n,{});
   const number=n.val.querySelector('.wd-number'),unit=n.val.querySelector('.wd-unit');
   check('Units below scalar values',unit&&number&&unit.getBoundingClientRect().top>=number.getBoundingClientRect().bottom-1,{html:n.val.innerHTML,number:number?.getBoundingClientRect().toJSON(),unit:unit?.getBoundingClientRect().toJSON()});
   // A rule must not accidentally replace a deliberately chosen manual text size.
   const manual={...Widgets.newWidget('name',0,20,240),w:400,h:140,textSize:23,textColor:'#123456',typography:{textSource:'custom'},designRules:[{field:'fuelpct',op:'lt',value:'10',target:'border',color:'#ff0000'}]};
   const saved=WidgetDesign.saveStyle(l,manual,'Legacy manual');const copy={...Widgets.newWidget('name',0,460,240),w:400,h:140};WidgetDesign.applyStyle(copy,saved);
   check('Saved style preserves manual font size',Frame.typography(copy).valueSize===23,{before:Frame.typography(manual),after:Frame.typography(copy)});
   const mn=WidgetView.mount(document.getElementById('audit-canvas'),manual,l);mn.val.textContent='James';WidgetView.fit(mn,{designRule:null});
   check('Border-only rules preserve custom text colour',mn.el.style.color==='rgb(18, 52, 86)',mn.el.style.color);
   manual.typography.textSource='theme';WidgetView.fit(mn,{});
   check('Inactive rules honour Theme text selection',mn.el.style.color==='var(--ink)',mn.el.style.color);
   manual.typography.textSource='custom';WidgetView.fit(mn,{});
   const race={...Widgets.newWidget('aiorace',null,20,410),w:840,h:180,numberFormat:{digits:2}};
   const rn=WidgetView.mount(document.getElementById('audit-canvas'),race,l);rn.val.innerHTML=AllInOne.html('aiorace',{session:'Test',clock:'30.123',remainingLabel:'Laps left',remaining:'12',flag:'Racing',leader:'007',weather:'Dry'});WidgetView.fit(rn,{});
   check('Formatting leaves numeric driver names intact',rn.val.textContent.includes('Leader 007'),rn.val.textContent);
   const pit={...Widgets.newWidget('aiopit',0,20,410),w:840,h:180,numberFormat:{digits:1,units:'hidden'}};
   const pn=WidgetView.mount(document.getElementById('audit-canvas'),pit,l);pn.val.innerHTML=AllInOne.sample('aiopit',0,{});WidgetView.fit(pn,{});
   check('All-in-One secondary numbers use formatting',[...pn.val.querySelectorAll('.aio-line [data-wd-numeric]')].every(e=>e.querySelector('.wd-number')));
   pn.el.remove();
   // Text outline must affect glyphs, not a bar or SVG graphic.
   const bar={...Widgets.newWidget('fuel',0,460,20),w:400,h:180,opt:{barStyle:'digital',mode:'both'},typography:{outline:1,shadow:'soft'}};
   const bn=WidgetView.mount(document.getElementById('audit-canvas'),bar,l);bn.val.innerHTML=Timing.content(bar,WidgetPreview.state(bar,{scenario:'race',layout:l})).html;WidgetView.fit(bn,{});
   check('Fuel gauge remains visible with text effects',!!bn.val.querySelector('.fg-meter')&&bn.val.querySelector('.fg-meter').getBoundingClientRect().width>10);
   bar.appearance={highlightTarget:'text',source:'theme'};WidgetView.fit(bn,{bg:'#ff0000',color:'#ffffff',designRule:{index:0,target:'background',color:'#ffffff'}});
   check('Background rules keep contrasting text over state colours',bn.el.style.getPropertyValue('--ws-state-ink')===bn.el.style.color,bn.el.style.cssText);
   for(const [type,opt] of [['clock',{style:'digital'}],['clock',{style:'pitwall'}],['logo',{}],['racechart',{}],['dlaptime',{}],['leaderboard',{}],['fuel',{barStyle:'digital',mode:'both'}]]){
    const test={...Widgets.newWidget(type,0,20,20),w:400,h:200,opt,appearance:{separatePadding:true,paddingLeft:30,paddingRight:12,paddingTop:50,paddingBottom:20}};
    const tn=WidgetView.mount(document.getElementById('audit-canvas'),test,l),output=Timing.content(test,WidgetPreview.state(test,{scenario:'race',layout:l}));tn.val.innerHTML=output.html;WidgetView.fit(tn,output);
    const scale=tn.el.getBoundingClientRect().width/test.w,actual=parseFloat(tn.val.style.top);
    check('Independent padding: '+type+' '+(opt.style||''),Math.abs(actual-50*scale)<1&&Math.abs(parseFloat(tn.val.style.left)-30*scale)<1,{actual,expected:50*scale});
    test.appearance.separatePadding=false;WidgetView.fit(tn,output);check('Padding reset: '+type,!tn.el.hasAttribute('data-wd-padding')&&tn.val.style.left!==(30*scale)+'px');tn.el.remove();
   }
   window.auditNodes=nodes;return audit;
  `);
  await wait(150);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'widgets.png'),(await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify(result,null,2));app.exit(result.every(r=>r.ok)?0:1);
 }catch(e){console.error(e);app.exit(1);}
}));require('../../main');
