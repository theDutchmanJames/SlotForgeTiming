const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/fuel-compact');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/fuel-compact-'+process.pid));app.disableHardwareAcceleration();
let done=false;setTimeout(()=>app.exit(2),60000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 try{
  win.setMinimumSize(0,0);win.setContentSize(900,720);win.showInactive();
  const result=await win.webContents.executeJavaScript(`(async()=>{
   await document.fonts.ready;
   const host=document.createElement('div');host.className='canvas';Object.assign(host.style,{position:'fixed',inset:'0',zIndex:99999,background:'var(--bg)'});document.body.append(host);
   const checks=[];
   for(const style of ['digital','scale'])for(const mode of ['bar','both'])for(const height of [40,60,120])for(const sizing of ['auto','manual'])for(const level of [0,20,96.8]){
    host.replaceChildren();const w={...Widgets.newWidget('fuel',0,0,0),w:370,h:height,showTitle:height===60,title:'Fuel',opt:{barStyle:style,mode},typography:{mode:sizing,valueSize:80,shrink:true}};
    const layout={ratioW:1,ratioH:1,widgets:[w]};host.style.width='1000px';host.style.height='1000px';
    const n=WidgetView.mount(host,w,layout);n.val.innerHTML=Widgets.fuelHtml(level,100,w.opt);WidgetView.fit(n,{});
    const b=n.val.getBoundingClientRect(),m=n.val.querySelector('.fg-meter').getBoundingClientRect();
    const inside=m.left>=b.left-.75&&m.right<=b.right+.75&&m.top>=b.top-.75&&m.bottom<=b.bottom+.75;
    checks.push({style,mode,height,sizing,level,fits:Frame.textFits(n.val),status:n.el.dataset.fitStatus,inside,bar:[m.width,m.height]});
   }
   host.replaceChildren();host.style.width='800px';host.style.height='650px';host.style.left='30px';host.style.top='30px';
   [0,1,2,3,4,5].forEach(i=>{const w={...Widgets.newWidget('fuel',i%2,0,i*110),w:600,h:60,showTitle:false,opt:{barStyle:i<4?'digital':'scale',mode:i===1?'bar':'both'},typography:{mode:i===2?'manual':'auto',valueSize:80,shrink:true}};const n=WidgetView.mount(host,w,{ratioW:800,ratioH:650,widgets:[w]});n.val.innerHTML=Widgets.fuelHtml(i===3?20:i===5?0:96.8,100,w.opt);WidgetView.fit(n,{});});
   return checks;
  })()`);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(out,'actual-app.png'),(await win.webContents.capturePage()).toPNG());
  const failed=result.filter(x=>!x.fits||x.status!=='fits'||!x.inside||x.bar[0]<12||x.bar[1]<6);
  assert.deepEqual(failed,[]);console.log('COMPACT FUEL PASSED:',result.length,'cases; text and bar fit with auto/manual shrinking, warnings and bar-only mode');app.quit();
 }catch(e){console.error(e);app.exit(1);}
}));require('../../main');
