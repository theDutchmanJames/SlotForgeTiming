// Audit regressions; native tests use in-memory ports, never a physical driver.
const assert=require('node:assert/strict'),P=require('../renderer/parallel'),PR=require('../renderer/parallelrace'),{createController}=require('../parallelport'),{spawn}=require('node:child_process'),path=require('node:path');
const wait=ms=>new Promise(r=>setTimeout(r,ms)),turn=()=>new Promise(r=>setImmediate(r));
const feed=(l,at,on=false)=>l.feed({at,status:on?192:128,control:11});
async function inputs(){
  const l=P.createLink({config:P.config({rearm:20,filter:3})});l.setConnected(true);feed(l,0);feed(l,1,true);feed(l,10);assert.equal(l.total,0,'initial clear duration must satisfy rearm');
  feed(l,15,true);feed(l,19);assert.equal(l.total,0,'short unaccepted pulses cannot leave rearm bypassed');feed(l,40,true);feed(l,45);assert.equal(l.total,1);
  let phase='countdown',allowed=false;const q=P.createLink(),events=[],writes=[];q.setConnected(true);
  const b=PR.bind({link:q,setup:{startPower:'on'},resetInputsOnRun:true,powerAllowed:()=>allowed,pitMs:1000,cars:()=>[{lane:0}],phase:()=>phase,flag:()=>'',lights:()=>0,
    crossCar:()=>events.push('lap'),holdCar:()=>events.push('hold'),unblockCar:()=>events.push('free'),acquire:async()=>({lease:1}),release:async()=>{},outputs:async v=>writes.push(v)});
  await turn();assert.equal(writes.at(-1).master,false);
  feed(q,0);feed(q,10,true);phase='running';allowed=true;b.sync();feed(q,2000,true);assert.deepEqual(events,[],'countdown coverage cannot become a pit after start');
  feed(q,2100);feed(q,2200,true);feed(q,3200,true);assert.deepEqual(events,['lap','hold']);phase='paused';b.sync();phase='running';b.sync();feed(q,3300);assert.deepEqual(events,['lap','hold','free'],'existing pit releases after resume');b.off();
}
async function delayedOwnership(){
  for(const reconnectEarly of [false,true]){
    const l=P.createLink();l.setConnected(true);let finish;const releases=[],claims=[],writes=[];
    const b=PR.bind({link:l,setup:{},cars:()=>[],phase:()=> 'paused',flag:()=>'',lights:()=>0,
      acquire:token=>{claims.push(token);return claims.length===1?new Promise(r=>finish=r):Promise.resolve({lease:2});},release:async token=>releases.push(token),outputs:async (v,token)=>writes.push(token)});
    l.setConnected(false);if(reconnectEarly)l.setConnected(true);finish({lease:1});await turn();
    assert.deepEqual(releases,[],'late acknowledgement must retain reservation while a race remains open');
    if(!reconnectEarly){assert(!b.ready());l.setConnected(true);await turn();}
    assert.deepEqual(claims,[null,1]);assert(b.ready());assert(writes.every(token=>token===2),'old connection lease cannot drive outputs');b.off();await turn();assert.deepEqual(releases,[2]);
  }
}
async function closedBinding(){
  const l=P.createLink();l.setConnected(true);let reject;const errors=[];
  const b=PR.bind({link:l,setup:{},cars:()=>[],phase:()=> 'ready',flag:()=>'',lights:()=>0,acquire:()=>new Promise((_,no)=>reject=no),release:async()=>{},outputs:async()=>{},onError:e=>errors.push(e)});
  b.off();reject(Error('Old connection failed'));await turn();assert.deepEqual(errors,[],'disposed races cannot report late failures into a new race');
}
async function backend(){
  if(process.platform!=='win32')return;
  let helper;const packets=[];const c=createController({allowSimulation:true,onEvent:e=>packets.push(e),spawn:()=>helper=spawn(path.join(__dirname,'../native/parallel/SlotForgeParallel.exe'),['--simulate'],{windowsHide:true})});
  const config=P.config({port:'lpt3',outputsOn:true,outputs:{2:'master'}});
  try{
    await c.open(config);await wait(35);assert(packets.some(e=>e.type==='sample'&&e.status===128&&e.control===11),'LPT3 simulation must use offsets from 3BC, not address modulo eight');
    await assert.rejects(c.check({...config,port:'lpt1'}),/different port/);assert(c.state().connected);
    const first=c.setRace(true,4);assert.throws(()=>c.setRace(true,4),/already held/);assert.throws(()=>c.setRace('yes',4),/Invalid/);
    c.outputs({master:true},first.lease);helper.kill();await wait(150);assert(c.state().race);assert(!c.state().connected);
    await assert.rejects(c.close(),/owns/);await assert.rejects(c.check(config),/owns/);await assert.rejects(c.open({...config,name:'Changed'}),/saved parallel/);
    await c.open(config);assert.throws(()=>c.outputs({master:true},first.lease),/owns/);assert.throws(()=>c.setRace(true,4),/already held/);
    const second=c.setRace(true,4,first.lease);c.setRace(false,4,first.lease);assert(c.state().race);c.setRace(false,4,second.lease);assert(!c.state().race);
    c.armTests(true);c.setRace(false,4,second.lease);assert(c.state().armed,'duplicate release cannot disturb idle output tests');
    const third=c.setRace(true,4);c.outputs({master:true},third.lease);
    // Main process remains responsive and sends native pings, but renderer heartbeats stop.
    await wait(3400);assert(!c.state().connected);assert(c.state().race);assert.match(c.state().error,/Main window stopped/);
    c.setRace(false,4,third.lease);assert(!c.state().race);
    await c.open(config);const keep=setInterval(()=>c.alive(),300);await wait(3300);clearInterval(keep);assert(c.state().connected,'responsive renderer retains the connection');
  }finally{await c.shutdown();}
  const sendFailure=createController({allowSimulation:true,spawn:()=>{
    const p=spawn(path.join(__dirname,'../native/parallel/SlotForgeParallel.exe'),['--simulate'],{windowsHide:true}),write=p.stdin.write.bind(p.stdin);
    p.stdin.write=(s,...args)=>{if(s.startsWith('Q '))throw Error('Injected command send failure');return write(s,...args);};return p;
  }});
  await assert.rejects(sendFailure.open(P.defaults()),/Injected command send failure/);assert(!sendFailure.state().connected);await sendFailure.shutdown();
  const broken=createController({spawn:()=>{throw Error('Injected launch failure')}});await assert.rejects(broken.open(P.defaults()),/Injected launch/);assert(!broken.state().connected);await broken.shutdown();
}
(async()=>{await inputs();await delayedOwnership();await closedBinding();await backend();console.log('PARALLEL AUDIT PASSED: rearm/filter, held sensors, pit resume, restored-power gate, lease ownership/recovery, renderer watchdog, launch failure and LPT3 simulation.');})().catch(e=>{console.error(e);process.exitCode=1});
