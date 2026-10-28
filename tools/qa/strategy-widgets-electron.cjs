// Verify the production editor, persistence, shared rendering and geometry with isolated app data.
const { app } = require('electron'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const data = path.resolve(__dirname, '../../.tmp-test/strategy-ui-' + process.pid);
const output = path.resolve(__dirname, '../../../outputs/strategy-widgets');
fs.mkdirSync(data, { recursive: true }); fs.mkdirSync(output, { recursive: true });
app.setPath('appData', data); app.disableHardwareAcceleration();
let done = false;
const wait = ms => new Promise(r => setTimeout(r, ms));
const timer = setTimeout(() => { console.error('Strategy widget UI check timed out'); app.exit(1); }, 55000);
app.on('browser-window-created', (_, win) => {
  win.hide();
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    const run = text => win.webContents.executeJavaScript('(async()=>{' + text + '})()');
    try {
      await wait(600); win.setTitle('SlotForge widget verification'); win.showInactive(); await wait(350); win.setMinimumSize(0, 0); win.setContentSize(1200, 900);
      await run(`
        const defs=StrategyWidgets.DEFINITIONS;
        const d={name:'Strategy widgets QA',ratioW:16,ratioH:9,guides:{v:[],h:[]},widgets:defs.map(([type],i)=>Widgets.newWidget(type,0,20+i*15,20+i*15))};
        state.tab='custom';state.customSub='layouts';state.editing={id:null,draft:d,sel:[],snap:true,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[]};await render();
        for(const [type,label,folder] of defs){const button=document.querySelector('[data-add="'+type+'"]');if(!button||button.textContent!==label||button.closest('details').querySelector('summary').textContent!==folder)throw Error('Wrong palette entry: '+type);}
        await editorSave();const saved=(await api.list('layouts')).find(x=>x.name==='Strategy widgets QA');if(!saved||saved.widgets.length!==7)throw Error('Layout save');
        state.editing={id:saved.id,draft:structuredClone(saved),sel:[],snap:true,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[]};await render();
        if(document.querySelectorAll('#canvas .strategy-widget').length!==7)throw Error('Reopened editor samples');
        window.qaSaved=saved;
        const eng=RaceEngine.createRace({type:'race',laps:100,minLap:100,fuel:{on:true,tank:100,perLap:2,rate:2,pitHold:2000},pitControl:{mode:'manual',seconds:30,waitReturn:true},safetycar:SafetyCar.clean({target:12}),endurance:Endurance.clean({sessionType:'endurance',swapConfirm:'button'}),entries:[{lane:0,driverId:'a',driverName:'James',roster:[{id:'a',name:'James'},{id:'b',name:'Bjornie'}]},{lane:1,driverId:'c',driverName:'Sam'}]});
        eng.start(0);for(let n=1;n<=5;n++){eng.cross(0,n*10000);eng.cross(1,n*10500);}eng.setFlag('yellow',53000);eng.cross(0,64000);eng.block(0,75000);eng.tick(77000);eng.cars[0].pending.push({kind:'stopgo',seconds:5});eng.tick(77000);eng.setInvalid(0,eng.cars[0].laps.length-1,true);
        window.qaEngine=eng;window.qaDefs=defs;
        window.qaContext={raceId:'strategy-ui',eng,now:82000,phase:'running',setup:{sessionType:'race'},track:{},lanes:2,base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
        document.body.innerHTML='<h1 style="padding:16px 24px">Race information widgets</h1><div id="qa-host" style="margin:0 12px"></div>';
        window.qaDraw=(width,theme)=>{
          document.documentElement.dataset.theme=theme;
          const cols=width<800?2:3,step=1000/cols,h=cols===2?245:175,rows=Math.ceil(defs.length/cols),height=rows*(h+20)+20;
          const layout={ratioW:1000,ratioH:height,radius:8,laneColorStyle:'top',laneColors:[{bg:'#309fc3',text:'#e8e6e1'},{bg:'#75a348',text:'#e8e6e1'}],widgets:defs.map(([type],i)=>({...Widgets.newWidget(type,type==='gapnext'?1:0,10+(i%cols)*step,10+Math.floor(i/cols)*(h+20)),w:step-20,h,textSize:cols===2?43:32,titleSize:cols===2?20:12,opt:type==='lapvalidity'?{lap:'last'}:{}}))};
          const ctx={...window.qaContext,layout},view=LiveShare.viewer();view.feedStatic(JSON.parse(JSON.stringify(LiveShare.packStatic(ctx))));view.feedDynamic(JSON.parse(JSON.stringify(LiveShare.packDynamic(ctx))),82000);
          const host=document.getElementById('qa-host');host.innerHTML='<div class="canvas live" id="qa-canvas"></div>';const canvas=document.getElementById('qa-canvas');
          const nodes=LiveCanvas.build(canvas,layout,2);canvas.style.width='100%';LiveCanvas.paint(nodes,view.shared(82000));window.qaNodes=nodes;
        };
      `);
      for (const [width, theme] of [[1200, 'dark'], [600, 'dark'], [600, 'light']]) {
        win.setContentSize(width, width === 600 ? 760 : 800);
        await run(`qaDraw(${width},${JSON.stringify(theme)});`); await wait(220);
        const boxes = await run(`
          return qaNodes.map(n=>{const box=n.el.getBoundingClientRect(),title=n.tit.getBoundingClientRect(),value=n.val.querySelector('.strategy-value').getBoundingClientRect(),note=n.val.querySelector('.strategy-note')?.getBoundingClientRect();return {type:n.w.type,inside:value.left>=box.left-1&&value.right<=box.right+1&&value.top>=title.bottom-1&&value.bottom<=box.bottom+1,noteInside:!note||note.bottom<=box.bottom+1,text:n.val.textContent};});
        `);
        console.log(width, theme, JSON.stringify(boxes));
        assert(boxes.every(b => b.inside && b.noteInside), 'Widget content overlaps title or frame');
        fs.writeFileSync(path.join(output, `widgets-${width}-${theme}.png`), (await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
      }
      console.log('STRATEGY WIDGET ELECTRON CHECK PASSED: palette, save/reopen, shared canvas, 1200/600 px, dark/light');
      clearTimeout(timer); app.quit();
    } catch (err) { console.error(err); app.exit(1); }
  });
});
require('../../main');
