// Production renderer/IPC/network; read-only SQLite probe on a generated profile.
// This is not a production backend switch. Writes are refused during the probe.
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),net=require('node:net');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/compatibility-ui');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
const Repo=require('../../data-repository');let reads=null;
for(const name of ['list','choices','get','customFields','linkedLaps']){const original=Repo.prototype[name];Repo.prototype[name]=function(...args){return reads?reads[name](...args):original.apply(this,args);};}
for(const name of ['add','update','remove','saveSession','removeSession','addCustomField','removeCustomField','setCustomFieldGroup']){const original=Repo.prototype[name];Repo.prototype[name]=function(...args){if(reads)throw Error('Read-only QA probe');return original.apply(this,args);};}
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false,client;setTimeout(()=>app.exit(2),60000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 try{
  await wait(350);win.setContentSize(1280,900);
  await run("window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));await api.add('drivers',{name:'Compatibility driver'});await api.add('chartdesigns',{name:'Club chart',style:'bars'});await api.add('racesetups',{name:'Club race',sessionType:'race',raceBy:'laps',laps:20});");
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  await run(`state.settings=await api.setSettings({netOn:true,netPort:${port},netPassword:'qa-only-password'});`);
  const source=await run('return api.dbPath();');const sourceBytes=fs.readFileSync(source),Client=require('../../sqlite-client');client=new Client();
  await client.migrate(source,path.join(profile,'copy'));await client.forkCopy(path.join(profile,'copy'),path.join(profile,'work'));await client.openWorking(path.join(profile,'work'));
  reads=new(require('../../compatibility-read').SqliteCompatibilityReads)(client);
  const list=await (await fetch('http://127.0.0.1:'+port+'/api/list/drivers')).json();assert.equal(list[0].name,'Compatibility driver');
  assert.equal((await run("return api.list('chartdesigns');"))[0].name,'Club chart');
  assert.equal((await run('return api.packsList();')).choices.chartdesigns.items[0].name,'Club chart');
  await run("state.tab='setup';state.setupSub='setups';await render();");assert(await run("return document.body.textContent.includes('Club race');"));
  await wait(250);fs.writeFileSync(path.join(out,'setup-sqlite-read.png'),(await win.webContents.capturePage()).toPNG());
  await run("state.tab='settings';state.settingsSub='transfer';await render();document.querySelector('[data-transfer-view=packs]').click();");
  for(let i=0;i<60&&!await run("return !!document.querySelector('#pack-open');");i++)await wait(50);
  assert(await run("return !!document.querySelector('[data-pack-kind=chartdesigns]') || document.body.textContent.includes('Club chart');"));
  await run("document.querySelectorAll('details').forEach(d=>d.open=true);document.querySelector('[data-pack-pick=chartdesigns]').scrollIntoView({block:'center'});");
  for(const theme of ['dark','light']){await run(`state.settings.theme='${theme}';applyTheme();`);await wait(150);fs.writeFileSync(path.join(out,'packs-'+theme+'.png'),(await win.webContents.capturePage()).toPNG());}
  assert.deepEqual(await run('return qaErrors;'),[]);assert.deepEqual(fs.readFileSync(source),sourceBytes);
  await client.close();console.log('COMPATIBILITY UI PASS: SQLite copy reads through real IPC, network, Race Setups and Content Packs; source unchanged.');app.exit(0);
 }catch(error){console.error(error);await client?.cancel();app.exit(1);}
 });});require('../../main');
