// Actual app/IPC/HTTP delivery on a generated profile; no real Paddock database.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
require('./qa-completion.cjs').preventRelaunch(app);
const {hash}=require('../../paddock'),Journal=require('../../renderer/paddockrace'),Engine=require('../../renderer/engine');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/delivery-ui');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/delivery-'+process.pid));app.disableHardwareAcceleration();
require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false,server,posts=0,checks=0,delivered;
const receipt=p=>({ok:true,databaseId:p.databaseId,sourceId:p.source.id,sessionId:p.sessionId,revision:p.revision,state:p.state,contentHash:hash(p)});
setTimeout(()=>{console.error('Delivery UI timeout');app.exit(2);},60000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async code=>{for(let i=0;i<150;i++){if(await run(code))return;await wait(40);}throw Error('Timed out: '+code);};
 const shot=async name=>{await wait(150);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  server=http.createServer(async(req,res)=>{
   try{assert.equal(req.headers.authorization,'Bearer test password');res.setHeader('Content-Type','application/json');
    const status={id:'paddock-demo',name:'QA Dealership',permissions:{timingResults:true},capabilities:{timing:{versions:[1]}}};
    if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;delivered=JSON.parse(raw);posts++;res.end(JSON.stringify(receipt(delivered)));}
    else if(req.url.startsWith('/v1/timing/sessions/')){checks++;res.end(JSON.stringify(receipt(delivered)));}
    else res.end(JSON.stringify(req.url==='/v1/status'?status:{...status,cars:[],nextOffset:null}));
   }catch(error){console.error(error);res.statusCode=500;res.end('{}');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));await wait(400);win.setMinimumSize(0,0);win.setContentSize(1200,900);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));await api.paddockConnect({address:'127.0.0.1:${server.address().port}',code:'test password'});`);
  const profile=JSON.parse(fs.readFileSync(path.join(__dirname,'../../tests/fixtures/paddock/fixtures/profile-car-a.json')));
  const journal={captures:{a:{configuration:profile.configuration,name:'Club GT3'}},lanes:[20],heats:[]};
  let wall=100000;const engine=Journal.attach(Engine.createRace({type:'race',laps:5,minLap:100,paddockClock:t=>100000+t,entries:[{carId:'a',driverId:'driver',driverName:'James',lane:0}]}),journal,'1',()=>wall,t=>100000+t);
  engine.start(0);wall=110000;engine.cross(0,10000);engine.stop(10000);engine.adjust(0,{ms:1500,laps:1});engine.paddockReview();journal.classifiedTimes={a:engine.spentOf(engine.cars[0],engine.endAt,true)};
  const session={setupName:'Delivery integration race',trackId:'track',trackName:'Club Circuit',sessionType:'race',endedBy:engine.endedBy,weatherNote:'Dry, then light rain.',paddockJournal:journal,standings:[{carId:'a',laps:2,pos:1,total:10000,adjMs:1500,adjLaps:1}]};
  await run(`window.savedId=await api.saveSession(${JSON.stringify(session)},[]);`);
  await until(`return (await api.paddockStatus()).deliveries.some(d=>d.status==='sent');`);
  assert.equal(posts,1,'Finalization automatically schedules upload without Retry');
  assert.deepEqual(delivered.adjustments.map(a=>[a.kind,a.amount]),[['time',1500],['laps',1]]);assert.equal(delivered.standings[0].classifiedElapsedMs,11500);assert.equal(delivered.participants[0].laps.length,1);assert.match(delivered.notes,/Dry, then light rain/);assert.match(delivered.notes,/Stopped/);
  fs.writeFileSync(path.join(out,'reviewed-payload.json'),JSON.stringify(delivered,null,2));
  await run(`state.tab='database';state.sub='slotcars';await render();window.ed=await PaddockUI.open(api);ed.dialog.querySelector('#paddock-results').scrollIntoView();`);
  assert(await run(`return !!ed.dialog.querySelector('[data-receipt]');`),'Delivered receipt action is visible');await shot('delivered-1200');
  await run(`ed.dialog.querySelector('[data-receipt]').click();`);
  await until(`return !ed.dialog.querySelector('[data-receipt]').disabled;`);assert.equal(checks,1);assert.equal(posts,1,'Checking receipt does not upload again');
  win.setContentSize(600,900);await run(`state.settings.theme='light';applyTheme();ed.dialog.querySelector('#paddock-results').scrollIntoView();`);await shot('delivered-light-600');
  assert(await run(`return ed.dialog.scrollWidth<=ed.dialog.clientWidth+2;`),'Delivery dialog fits at 600px');assert.deepEqual(await run('return qaErrors;'),[]);
  console.log('DELIVERY UI PASS: durable finalize -> automatic HTTP delivery -> receipt action; 1200 dark/600 light.');server.close();require('./qa-completion.cjs').complete();app.exit(0);
 }catch(error){console.error(error);await shot('failure');server?.close();app.exit(1);}
 });});require('../../main');
