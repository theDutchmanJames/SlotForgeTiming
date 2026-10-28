const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process'),P=require('../renderer/phidget'),{createController}=require('../phidgetport');
const binary=path.join(__dirname,'../native/phidget/SlotForgePhidget.exe'),wait=ms=>new Promise(r=>setTimeout(r,ms));
const c=P.defaults();c.lanes=1;c.lap[0].address={serial:123,channel:0,type:'digital',hubPort:-1,hubDevice:false};c.outputsOn=true;c.outputs=[{address:{...c.lap[0].address,type:'output'},active:true,role:'master'}];
{
 const source=require('node:fs').readFileSync(path.join(__dirname,'../main.js'),'utf8'),start=source.indexOf('  const phidgetOwner ='),end=source.indexOf("  ipcMain.handle('parallel:",start),handlers={},calls=[];
 const frame={},contents={mainFrame:frame},win={webContents:contents,isDestroyed:()=>false},owner={sender:contents,senderFrame:frame};
 const port=Object.fromEntries(['state','scan','open','close','alive','armTests','test','setRace','outputs'].map(k=>[k,(...args)=>calls.push([k,...args])]));
 let choice='phidget';
 new Function('ipcMain','mainWin','phidget','db',source.slice(start,end))({handle:(k,f)=>handlers[k]=f},win,port,{getSettings:()=>({timingHw:choice})});
 for(const fn of Object.values(handlers)){assert.throws(()=>fn({sender:{},senderFrame:frame}),/main app window/);assert.throws(()=>fn({sender:contents,senderFrame:{}}),/main app window/);}
 assert.equal(calls.length,0);handlers['phidget:scan'](owner);assert.equal(calls[0][0],'scan');
 choice='trackmate';for(const [k,args] of [['open',[c]],['race',[true,1]],['outputs',[{},1]]])assert.throws(()=>handlers['phidget:'+k](owner,...args),/timing hardware/);
}
async function main(){if(process.platform!=='win32'){console.log('SKIP Windows native Phidget helper on this OS');return;}let helper;const events=[],create=allow=>createController({allowSimulation:allow,spawn:()=>helper=spawn(binary,['--simulate'],{windowsHide:true,stdio:['pipe','pipe','pipe']}),onEvent:e=>events.push(e)});
 const denied=create(false);await assert.rejects(denied.open(c),/simulation/);denied.shutdown();
 const p=create(true);try{assert.deepEqual((await p.scan()).devices,[]);await p.open(c);assert(p.state().connected);assert(Number.isFinite(p.state().clockUncertainty));assert(events.some(e=>e.type==='sample'&&e.value===0));helper.stdin.write(JSON.stringify({id:100000,cmd:'inject',key:P.key(c.lap[0].address),value:1})+'\n');await wait(60);assert(events.some(e=>e.type==='sample'&&e.value===1));await p.armTests(true);await assert.rejects(p.test('constructor'),/Assign/);await p.test(0);await assert.rejects(p.setRace('true',1),/Invalid/);const race=await p.setRace(true,1);await assert.rejects(p.armTests(true),/race/);await assert.rejects(p.close(),/race/);await assert.rejects(p.outputs({master:true},race.lease+1),/own/);await p.outputs({master:true},race.lease);await p.setRace(false,1,race.lease);assert(!p.state().race);await p.close();assert(!p.state().connected);
 await p.open(c);const feed=events.filter(e=>e.type==='sample'||e.type==='tick');assert(feed.every(e=>Number.isFinite(e.at)));await wait(3450);assert(!p.state().connected,'renderer heartbeat loss closes helper');assert.match(p.state().error,/responding/);
 await p.open(c);helper.kill();await wait(150);assert(!p.state().connected,'helper crash closes connection');
 await p.open(c);const latest=events.filter(e=>e.type==='sample'||e.type==='tick').at(-1);
 helper.stdout.emit('data',Buffer.from(JSON.stringify({type:'tick',seq:latest.seq+2,at:latest.at})+'\n'));
 assert(!p.state().connected);assert.match(p.state().error,/lost an event/);
 await p.open(c);helper.stdin.write(JSON.stringify({id:100002,cmd:'inject',key:P.key(c.lap[0].address),value:2})+'\n');await wait(60);assert(!p.state().connected);assert.match(p.state().error,/input channel or value/);
 const opening=p.open(c),cancelled=assert.rejects(opening,/cancelled|closed/);await p.close();await cancelled;assert(!p.state().connected);
 }finally{p.shutdown();}
 // The native watchdog must work even when the parent stops sending anything.
 const raw=spawn(binary,['--simulate'],{windowsHide:true,stdio:['pipe','pipe','pipe']}),lines=[];
 const reader=require('node:readline').createInterface({input:raw.stdout});reader.on('line',s=>lines.push(JSON.parse(s)));
 raw.stdin.write(JSON.stringify({id:1,cmd:'open',channels:[{key:P.key(c.lap[0].address),address:c.lap[0].address,off:0,initial:0}]})+'\n');
 await wait(2500);assert(lines.some(p=>p.type==='error'&&/heartbeat/.test(p.message)),'compiled helper watchdog closes without parent commands');raw.stdin.end();raw.kill();reader.close();
 const unsupported=createController({platform:'linux'});await assert.rejects(unsupported.open(c),/Windows/);
 console.log('Phidget backend passed: compiled helper, clock handshake, simulation rejection, inputs, output ownership, tests, disconnect, heartbeat loss and process failure.');}
main().catch(e=>{console.error(e);process.exitCode=1;});
