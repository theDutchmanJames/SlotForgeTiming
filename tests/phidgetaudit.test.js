// Regression cases found during the Phidget audit. No physical hardware access.
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
const P=require('../renderer/phidget'),PR=require('../renderer/parallelrace'),{createController}=require('../phidgetport');
const wait=ms=>new Promise(r=>setTimeout(r,ms)),turn=()=>new Promise(r=>setImmediate(r));
const address=(channel,type='digital',hubPort=-1,hubDevice=false)=>({serial:123,channel,type,hubPort,hubDevice});
function config(){const c=P.defaults();c.lanes=1;c.lap[0].address=address(0);c.outputsOn=true;c.outputs=[{address:address(0,'output'),active:true,role:'master'}];return c;}
async function inputs(){
  const hub=config();hub.lanes=2;hub.lap[0].address=address(0,'digital',2,true);hub.lap[1].address=address(1,'digital',2,false);
  assert(P.validate(hub).some(x=>x.includes('VINT device')));hub.lap[0].address.hubDevice=false;assert.deepEqual(P.validate(hub),[]);
  let phase='countdown',allowed=false;const l=P.createLink({config:config()}),events=[],writes=[];l.setConnected(true);
  const b=PR.bind({link:l,setup:{startPower:'on'},resetInputsOnRun:true,powerAllowed:()=>allowed,pitMs:1000,cars:()=>[{lane:0}],
    phase:()=>phase,flag:()=>'',lights:()=>0,crossCar:()=>events.push('lap'),holdCar:()=>events.push('hold'),unblockCar:()=>events.push('free'),
    acquire:async()=>({lease:9}),release:async token=>events.push('release:'+token),outputs:async value=>writes.push(value)});
  await turn();assert.equal(writes.at(-1).master,false,'restored race power interlock overrides start-power preference');
  const feed=(at,value)=>l.feed({at,value,key:P.key(address(0))});
  feed(0,0);feed(900,1);phase='running';allowed=true;b.sync();l.tick(2000);
  assert.deepEqual(events,[],'a countdown crossing cannot turn into a pit after green');
  feed(2100,0);feed(2200,1);l.tick(3200);assert.deepEqual(events,['lap','hold']);
  phase='paused';b.sync();phase='running';b.sync();feed(3300,0);
  assert.deepEqual(events,['lap','hold','free'],'an existing pit still receives its release after resume');
  l.setConnected(false);b.off();await turn();assert.equal(events.at(-1),'release:9','leaving disconnected releases retained ownership');
}
async function backend(){
  if(process.platform!=='win32')return;
  const writes=[];let helper,failNextOutput=false;
  const p=createController({allowSimulation:true,spawn:()=>{
    helper=spawn(path.join(__dirname,'../native/phidget/SlotForgePhidget.exe'),['--simulate'],{windowsHide:true});
    const write=helper.stdin.write.bind(helper.stdin);
    helper.stdin.write=(s,...args)=>{
      const m=JSON.parse(s);
      if(m.cmd==='outputs'){
        writes.push(m.values);
        if(failNextOutput){failNextOutput=false;helper.stdin.emit('error',Error('Injected output acknowledgement failure'));return true;}
      }
      return write(s,...args);
    };
    return helper;
  }});
  const c=config();
  try{
    await p.open(c);await p.armTests(true);
    const testing=p.test(0),claiming=p.setRace(true,1);await testing;const owner=await claiming;
    await p.outputs({master:true},owner.lease);const count=writes.length;
    await wait(1350);assert.equal(writes.length,count,'an old test timer must not switch off race outputs');
    helper.kill();await wait(150);assert(p.state().race,'disconnect retains the race reservation');
    await assert.rejects(p.scan(),/Disconnect/);await assert.rejects(p.armTests(true),/race/);
    await assert.rejects(p.open({...c,name:'Changed wiring'}),/saved Phidget configuration/);
    await p.open(c);assert(p.state().race);await assert.rejects(p.setRace(true,1),/ownership/);
    await assert.rejects(p.outputs({master:true},owner.lease),/own/);
    const next=await p.setRace(true,1,owner.lease);assert(next.lease!==owner.lease);
    await p.setRace(false,1,owner.lease);assert(p.state().race,'old release cannot release new connection ownership');
    await p.setRace(false,1,next.lease);assert(!p.state().race);
    await p.armTests(true);const idleWrites=writes.length;await p.setRace(false,1,next.lease);
    assert(p.state().armed);assert.equal(writes.length,idleWrites,'duplicate release cannot interfere with idle output testing');
    failNextOutput=true;await assert.rejects(p.setRace(true,1),/Injected/);assert(!p.state().race,'failed first acquisition cannot strand a race lock');
    await p.open(c);const again=await p.setRace(true,1);helper.kill();await wait(150);
    await p.setRace(false,1,again.lease);assert(!p.state().race,'leaving while disconnected clears the reservation');
  }finally{p.shutdown();}
}
async function startup(){
 const {EventEmitter}=require('node:events'),timers=new Set(),module={exports:{}};let now=0;
 const set=(fn,ms)=>{const t={fn,at:now+ms,unref(){}};timers.add(t);return t;};
 const advance=ms=>{now+=ms;for(const t of [...timers])if(t.at<=now){timers.delete(t);t.fn();}};
 require('node:vm').runInNewContext(require('node:fs').readFileSync(path.join(__dirname,'../phidgetport.js'),'utf8'),{module,exports:module.exports,__dirname:path.join(__dirname,'..'),process,require:n=>n==='./renderer/phidget'?P:require(n),setTimeout:set,clearTimeout:t=>timers.delete(t),setInterval:set,clearInterval:t=>timers.delete(t),Buffer});
 let child,killed=false;const p=module.exports.createController({platform:'win32',spawn:()=>{
  child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.stdin.writable=true;child.kill=()=>{killed=true;};child.stdin.end=()=>{};
  child.stdin.write=line=>{const m=JSON.parse(line);child.stdout.emit('data',Buffer.from(JSON.stringify({type:'reply',id:m.id,devices:[]})+'\n'));};return child;
 }});
 let settled=false;const scan=p.scan();scan.then(()=>{settled=true;},()=>{settled=true;});advance(6000);await turn();assert(!settled,'A cold helper can start after the former four-second deadline');
 child.stdout.emit('data',Buffer.from('{"type":"hello","protocol":1}\n'));assert.equal((await scan).devices.length,0);advance(1000);assert(killed);
 const hung=p.scan();const rejected=assert.rejects(hung,/did not start/);advance(12000);await rejected;advance(1000);assert(!p.state().connected);p.shutdown();
}
(async()=>{await inputs();await startup();await backend();console.log('PHIDGET AUDIT PASSED: bounded cold startup, test/race overlap, disconnect reservation, recovery leases, failed acquisition, start/resume sensor gating, existing pits, power interlock and VINT conflicts.');})().catch(e=>{console.error(e);process.exitCode=1;});
