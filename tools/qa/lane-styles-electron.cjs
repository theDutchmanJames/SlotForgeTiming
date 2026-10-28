// Production editor, database and shared canvas. Isolated data; no timing hardware is opened.
const { app } = require('electron'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const data = path.join(__dirname, '../../.tmp-test/lane-styles-electron-' + process.pid); fs.mkdirSync(data, { recursive: true }); app.setPath('appData', data); app.disableHardwareAcceleration();
const wait = ms => new Promise(r => setTimeout(r, ms)); let done = false;
const timeout = setTimeout(() => { console.error('Lane style Electron check timed out'); app.exit(1); }, 30000); timeout.unref();
app.on('browser-window-created', (_e, win) => {
  win.hide(); win.on('show', () => win.hide());
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    try {
      await wait(600);
      const result = await win.webContents.executeJavaScript(`(async()=>{
        const assert=(v,m)=>{if(!v)throw Error(m)},change=(id,value)=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));};
        const d={name:'Lane styles QA',ratioW:16,ratioH:9,guides:{v:[],h:[]},laneColors:[{bg:'#e5484d',text:'#ffffff'},{bg:'#3b82f6',text:'#ffffff'}],widgets:[Widgets.newWidget('name',0,20,20),Widgets.newWidget('lastlap',1,260,20)]};
        state.tab='custom';state.customSub='layouts';state.editing={id:null,draft:d,sel:[d.widgets[0]],snap:true,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[]};await render();
        assert(document.getElementById('e-lanestyle').value==='full','legacy Full default');change('e-lanestyle','top');const edge=document.querySelector('[data-ws=appearance][data-key=edge]');edge.value='left';edge.dispatchEvent(new Event('input',{bubbles:true}));edge.dispatchEvent(new Event('change',{bubbles:true}));await editorSave();
        let saved=(await api.list('layouts')).find(l=>l.name==='Lane styles QA');assert(saved.laneColorStyle==='top'&&saved.widgets[0].appearance.edge==='left','real database save');
        editorUndo();assert(!state.editing.draft.widgets[0].appearance?.edge,'undo');editorRedo();assert(state.editing.draft.widgets[0].appearance.edge==='left','redo');
        const copy=await api.add('layouts',{...structuredClone(saved),id:undefined,name:'Copied lane styles QA'});assert(copy.laneColorStyle==='top'&&copy.widgets[0].appearance.edge==='left','copy');
        state.editing=null;await render();state.editing={id:saved.id,draft:structuredClone(saved),sel:[],snap:true,dirty:false,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[]};await render();assert(document.getElementById('e-lanestyle').value==='top','reopen');
        const host=document.createElement('div');host.className='canvas';host.style.width='1000px';host.style.height='562px';document.body.appendChild(host);
        const eng=RaceEngine.createRace({type:'race',laps:5,entries:[{lane:0,driverName:'A'},{lane:1,driverName:'B'}]});eng.start(0);
        const ctx={raceId:'styles',eng,layout:saved,setup:{sessionType:'race',laps:5},track:{},lanes:2,base:{personal:new Map(),track:Infinity},now:1000,phase:'running',flash:new Map(),bestBy:new Map(),bestAll:Infinity};
        const stat=JSON.parse(JSON.stringify(LiveShare.packStatic(ctx))),sender=LiveShare.sender(),viewer=LiveShare.viewer();viewer.feedStatic(stat);viewer.feedDynamic(JSON.parse(JSON.stringify(sender.pack(ctx,1000))),performance.now());
        const shared=viewer.shared(performance.now()),nodes=LiveCanvas.build(host,stat.layout,2);LiveCanvas.paint(nodes,shared);
        assert(nodes[0].el.classList.contains('lcstripe-side')&&nodes[1].el.classList.contains('lcstripe-top'),'shared view inherits and overrides');const side=getComputedStyle(nodes[0].el,'::after'),top=getComputedStyle(nodes[1].el,'::after');assert(side.borderLeftWidth!=='0px'&&side.backgroundImage==='none','side stripe follows the rounded border edge');assert(top.borderTopWidth!=='0px'&&top.borderTopColor!=='rgba(0, 0, 0, 0)','top stripe painted');const probe=document.createElement('div');probe.style.backgroundColor='var(--panel)';host.appendChild(probe);assert(getComputedStyle(nodes[1].el).backgroundColor===getComputedStyle(probe).backgroundColor,'neutral theme background');host.remove();
        return {realEditor:true,database:true,copy:true,reopen:true,undoRedo:true,sharedViewer:true,curvedSideStripe:true};
      })()`);
      console.log('ELECTRON LANE STYLES PASSED ' + JSON.stringify(result)); clearTimeout(timeout); app.quit();
    } catch (x) { console.error(x); app.exit(1); }
  });
});
require('../../main');
