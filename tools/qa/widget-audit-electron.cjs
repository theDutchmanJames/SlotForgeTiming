const { app } = require('electron');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(__dirname, '../../../outputs/code-audit');fs.mkdirSync(out,{recursive:true});
const data = path.join(root, '.tmp-test/audit-' + process.pid);
fs.mkdirSync(data, { recursive: true }); app.setPath('appData', data); app.disableHardwareAcceleration();
const wait = ms => new Promise(r => setTimeout(r, ms)); let done = false;
setTimeout(() => app.exit(1), 40000).unref();
app.on('browser-window-created', (_, win) => {
  win.hide(); win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return;
    done = true;
    try {
      await wait(600); win.setMinimumSize(0, 0); win.setContentSize(1200, 900); win.showInactive();
      const result = await win.webContents.executeJavaScript(`(async()=>{
        const d={ratioW:16,ratioH:9,radius:14,laneColorStyle:'side',laneColors:[{bg:'#2fafd7',text:'#fff'}],widgets:[]};
        const variants=[['Default left',{}],['Top',{laneColorStyle:'top'}],['Right',{laneColorStyle:'right'}],['Border off',{borderMode:'off'}],['Custom border',{borderMode:'custom',borderColor:'#ff0099'}],['Zero border',{borderWidth:0}],['Transparency 30%',{transparency:30}],['Square corners',{radius:0}]];
        variants.forEach(([label,extra],i)=>d.widgets.push({...Widgets.newWidget('lastlap',0,20+(i%4)*245,40+Math.floor(i/4)*145),w:225,h:100,title:label,...extra}));
        state.editing={draft:d,sel:[],drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[]};
        document.body.innerHTML='<main style="padding:20px"><h2>Production stripe audit — identical settings, editor vs live</h2><h3>Layout Editor</h3><div id="editor-audit" class="canvas" style="width:1100px;height:340px"></div><h3>Live renderer</h3><div id="live-audit" class="canvas" style="width:1100px;height:340px"></div></main>';
        document.getElementById('editor-audit').innerHTML=d.widgets.map(w=>widgetHtml(w,false,false,d)).join('');
        const eng=RaceEngine.createRace({type:'race',laps:5,entries:[{lane:0,driverName:'James'}]});eng.start(0);eng.cross(0,0);eng.cross(0,10000);
        const ctx={raceId:'audit',eng,layout:d,setup:{sessionType:'race',laps:5},track:{},lanes:1,base:{personal:new Map(),track:Infinity},now:10000,phase:'running',flash:new Map(),bestBy:new Map(),bestAll:Infinity};
        const viewer=LiveShare.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(LiveShare.packStatic(ctx))));viewer.feedDynamic(JSON.parse(JSON.stringify(LiveShare.sender().pack(ctx,10000))),performance.now());
        const nodes=LiveCanvas.build(document.getElementById('live-audit'),d,1);LiveCanvas.paint(nodes,viewer.shared(performance.now()));
        const inspect=el=>{const s=getComputedStyle(el,'::after');return {title:el.querySelector('.lw-title')?.textContent,classes:el.className,left:s.borderLeftColor,leftWidth:s.borderLeftWidth,top:s.borderTopColor,topWidth:s.borderTopWidth,right:s.borderRightColor,rightWidth:s.borderRightWidth,radius:s.borderRadius,background:s.backgroundColor};};
        const editor=[...document.querySelectorAll('#editor-audit > .lw')].map(inspect),live=nodes.map(n=>inspect(n.el));
        for(const [i,x] of live.entries()) {const key=i===1?'top':i===2?'right':'left';if(x[key]!==editor[i][key]||parseFloat(x[key+'Width'])<=0)throw Error('Editor/live stripe disagreement '+i);}
        // Same computed corner geometry for every supported radius, including near-square.
        const probe=nodes[0].el,originalRadius=probe.style.borderRadius;
        for(const radius of [0,2,14,50]) {probe.style.borderRadius=radius+'px';if(getComputedStyle(probe,'::after').borderTopLeftRadius!==getComputedStyle(probe).borderTopLeftRadius)throw Error('Stripe radius mismatch');}
        probe.style.borderRadius=originalRadius;
        return {editor,live};
      })()`);
      await wait(300);
      fs.writeFileSync(path.join(out,'stripes-repaired.json'),JSON.stringify(result,null,2));
      fs.writeFileSync(path.join(out,'stripes-repaired.png'),(await win.webContents.capturePage()).toPNG());
      const rows = await win.webContents.executeJavaScript(`(async()=>{
        document.body.innerHTML='<main style="padding:20px"><h2>Existing Balance of Power header</h2><div id="bop-probe"></div><h2>Leaderboard row stripes</h2><div id="rows-probe" style="width:1000px;container-type:inline-size"></div><h2>Classic leaderboard stripes</h2><div id="classic-probe" style="width:1000px;container-type:inline-size"></div></main>';
        await renderBopSettings(document.getElementById('bop-probe'));
        document.querySelector('#bop-probe .rsbody').remove();document.querySelector('#bop-probe .rsfoot').remove();
        const layout={laneColorStyle:'side',laneColors:[{bg:'#2fafd7',text:'#fff'},{bg:'#e5484d',text:'#fff'}]};
        document.getElementById('rows-probe').innerHTML=Rows.sampleHtml({...Rows.defaultDesign(),states:false},2,[],{laneColorStyle:'side',layout});
        document.getElementById('classic-probe').innerHTML=Widgets.sampleOf(Widgets.def('leaderboard'),0,{...Widgets.newWidget('leaderboard',null),laneColorStyle:'side',previewLayout:layout});
        return [...document.querySelectorAll('[class*="lcstripe"]')].map(el=>{const s=getComputedStyle(el),a=getComputedStyle(el,'::after');return {tag:el.tagName,classes:el.className,left:s.borderLeftWidth,leftColor:s.borderLeftColor,bg:s.backgroundImage,after:a.content,afterBackground:a.backgroundImage,afterLeft:a.borderLeftWidth};});
      })()`);
      if(!rows.length||rows.some(r=>parseFloat(r.afterLeft)<=0))throw Error('Leaderboard stripe missing');
      await wait(200);fs.writeFileSync(path.join(out,'leaderboard-stripes-repaired.json'),JSON.stringify(rows,null,2));
      fs.writeFileSync(path.join(out,'leaderboard-stripes-repaired.png'),(await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(`(async()=>{
        const cfg=PushSave.clean(PushSave.defaults());
        document.body.innerHTML='<main style="padding:24px"><h2>Production Push &amp; Save gauge — median benchmark</h2><p>Three current-model pace states. The needle should agree with the label.</p><div style="display:flex;gap:22px">'+[-3,0,2].map(p=>{
          const e=PushSave.lapEffect(cfg,{lapMs:10000*(1+p/100),ref:10000,lapNo:5});
          const info={kind:e.kind,p:e.p,why:e.why,tyres:e.tyres,fuel:e.fuel,ref:10000,src:'median'};
          return '<div class="lw" style="position:relative;width:350px;height:280px;font-size:26px;border-radius:14px;background:var(--panel)"><span class="lw-val">'+PaceW.rowHtml(info,cfg,{look:'gauge'}).html+'</span></div>';
        }).join('')+'</div></main>';
      })()`);
      await wait(200);fs.writeFileSync(path.join(out,'median-gauge-repaired.png'),(await win.webContents.capturePage()).toPNG());
      if(result.live.some(x=>parseFloat(x.leftWidth)+parseFloat(x.topWidth)+parseFloat(x.rightWidth)<=0))throw Error('Missing live stripe');console.log('REPAIRED STRIPES AND GAUGE CAPTURED');app.quit();
    } catch(e) { console.error(e); app.exit(1); }
  });
});
require(path.join(root,'main'));
