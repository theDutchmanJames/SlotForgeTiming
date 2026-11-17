'use strict';
// DS-300 test-rig findings: crossings ignored while paused are reported, a box pause while Timing is paused is logged,
// the first lap after an ordinary pause is labelled, the Race Director sees the race screen's message, connected-but-unused
// timing hardware is warned about, captures name the port, and closing does not flood the log.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const DS=require('../renderer/dstiming'),P=require('../renderer/dsprotocol'),E=require('../renderer/engine'),H=require('../renderer/hardware');
const src=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function packet({lane=1,n=1,ticks=50000,control}={}){
  const b=Buffer.alloc(21);b[0]=224;b[1]=n%256;b[2]=21;b[20]=235;b[7]=control===undefined?27:0;b[8]=control||0;b[10]=128>>(lane-1);
  const bcd=v=>(Math.floor(v/10)<<4)|(v%10);b[11]=bcd(Math.floor(n/100));b[12]=bcd(n%100);
  const s=Math.floor(ticks/10000);b[13]=bcd(Math.floor(s/3600));b[14]=bcd(Math.floor(s/60)%60);b[15]=bcd(s%60);b[16]=bcd(Math.floor(ticks%10000/100));b[17]=bcd(ticks%100);
  b[18]=P.checksum(b);return b;
}
function rig(){
  let at=0;const r=E.createRace({type:'race',laps:30,entries:[{lane:0},{lane:1}]});
  const link=DS.createLink({now:()=>at}),faults=[],ignored=[],notices=[];link.setConnected(true,'ds300');
  const b=DS.bind({link,engine:()=>r,phase:()=>r.status,lanes:2,crossCar:(i,t,held,o)=>r.cross(i,t,o),onFault:m=>{faults.push(m);r.setFlag('red',at);},onIgnored:l=>ignored.push(l),onNotice:m=>notices.push(m)});
  return {r,faults,ignored,notices,send(t,o){at=t;link.feed(packet(o));},start(){r.start(0);b.sync();},pause(t){at=t;r.pause(t);b.sync();},resume(t){at=t;r.resume(t);b.sync();}};
}

test('crossings while Timing is paused are reported per lane instead of disappearing',()=>{
  const h=rig();h.start();h.send(100,{n:1});h.send(5100,{n:2});h.pause(6000);
  h.send(9000,{n:3});h.send(9500,{lane:2,n:1});h.send(12000,{n:4});
  assert.deepEqual(h.ignored,[1,2,1]);assert.equal(h.r.cars[0].laps.length,1,'laps while paused are not added');
  assert.equal(h.faults.length,0);
});

test('a box pause or end while Timing is already paused is reported, not dropped',()=>{
  const h=rig();h.start();h.send(100,{n:1});h.pause(2000);
  h.send(3000,{control:165});h.send(3500,{control:164});
  assert.equal(h.faults.length,0,'nothing to stop: Timing is already paused');
  assert.equal(h.notices.length,2);assert(/reported pause/.test(h.notices[0])&&/reported end/.test(h.notices[1]));
  const running=rig();running.start();running.send(100,{n:1});running.send(3000,{control:165});
  assert.equal(running.faults.length,1,'while running the box pause still stops the race');assert.equal(running.notices.length,0);
});

test('the first lap after an ordinary pause is recorded, labelled, and kept in step when laps are removed',()=>{
  const r=E.createRace({type:'race',laps:30,entries:[{lane:0}]});r.start(0);
  r.cross(0,100);r.cross(0,5100);r.pause(6000);r.resume(16000);r.cross(0,20000);r.cross(0,25000);
  const c=r.cars[0];assert.deepEqual(c.resumedLaps,[1]);assert.equal(c.bad[1],false,'an ordinary pause leaves the time out, and the lap still counts as before');assert.equal(Math.round(c.laps[1]),4900,'pause time left out');assert.equal(c.resumedLaps.includes(2),false,'only the first lap after it');
  assert.deepEqual(c.redLaps||[],[],'not a red-flag lap');
  assert.equal(r.removeLap(0,0,true),true);assert.deepEqual(c.resumedLaps,[0],'shifted with the lap list');
  const review=src('renderer/review.js');assert(/resumed \? 'first lap after a pause'/.test(review));
  assert(require('./source.cjs').has(src('renderer/liveshare.js'),"'redLaps', 'resumedLaps'"),'other screens receive it');
});

test('the Race Director page shows what the race screen says, and a resume clears an old pause message',()=>{
  const LS=require('../renderer/liveshare');const s=LS.sender();
  const r=E.createRace({type:'race',laps:3,entries:[{lane:0}]});r.start(0);
  const msg=s.pack({notice:'DS Electronics: DS box reported pause.',raceId:'x',eng:r,phase:'paused',calling:false,lights:0,heat:null,season:null,flash:new Map(),bestAll:Infinity,bestAllName:'',bestBy:new Map(),now:1000},1000);
  assert.equal(JSON.stringify(msg).includes('DS box reported pause.'),true,'the notice travels with the live data');
  assert(src('renderer/liveview.js').includes("$('dir-notice')"),'the Race Director shows it');
  const {code,has}=require('./source.cjs'),race=code('renderer/race.js'); // (compared without spaces, see source.cjs)
  assert(has(race,"if (resuming && live.phase !== 'paused') { const added = live.ds && live.ds.flushHeld ? live.ds.flushHeld() : 0;")&&has(race,"ui('msg').textContent = added ?")&&has(race,": '';"),'resuming clears the old message (2.3.0: or says how many kept laps were added)');
  assert(has(race,'onIgnored: dsIgnored,')&&has(race,'onNotice: dsNotice'),'the race screen listens for both');
});

test('connected timing hardware that is not in use is named, on the page, at Start race and on the race screen',()=>{
  const app=src('renderer/app.js'),start=app.indexOf('const TIMING_NAMES'),end=app.indexOf('function renderHardwareArea');
  const ctx={Hardware:H,state:{settings:{timingHw:'trackmate'}},DsTiming:{link:{connected:true}},Trackmate:{link:{connected:false}}};
  vm.createContext(ctx);vm.runInContext(app.slice(start,end)+';this.u=unusedTimingConnected;this.t=unusedTimingText;',ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.u())),['ds']);assert(/DS Electronics is connected but not the timing hardware in use \(Trackmate Interface\), so its laps are not counted/.test(ctx.t()));
  ctx.state.settings.timingHw='ds';assert.equal(ctx.u().length,0);assert.equal(ctx.t(),'');
  assert(app.includes('is not counting laps.</strong>')&&app.includes('for races</button>'),'the hardware page warns plainly and offers the switch');
  assert(src('renderer/landing.js').includes("unusedTimingText(state.settings)"),'Start race asks first');
  assert(require('./source.cjs').has(require('./source.cjs').code('renderer/race.js'),'id="hwunused"'),'the race screen shows it');
});

test('saved DS captures name the port that was picked, and DS control lines are polled slowly when nobody looks',()=>{
  assert.equal(H.describe('serial',{portName:'COM10 · Port CNCA0'}),'COM10 · Port CNCA0');
  assert.equal(H.describe('serial',{}),'COM port');
  assert(/Port: COM10/.test(H.dsCapture({type:'ds300',info:{portName:'COM10'},when:new Date(0)},[])));
  assert(src('renderer/dsui.js').includes("setTimeout(tick, document.getElementById('ds-log') ? 100 : 1000)"));
});

test('requests after closing has begun are refused quietly, with the same error for the caller',async()=>{
  assert(require('./source.cjs').has(src('main.js'),'appWork.closing?{__sfAppClosing:true}:appWork.run('));
  const pre=src('preload.js'),from=pre.indexOf('const call = '),line=pre.slice(from,pre.indexOf('\n};',from)+3); // the whole declaration, however many lines
  const invoke={value:null};const call=new Function('ipcRenderer',line.replace(/^const call = /,'return ')+';')({invoke:async()=>invoke.value});
  invoke.value={__sfAppClosing:true};await assert.rejects(call('db:list'),e=>e.code==='APP_CLOSING'&&/Timing is closing/.test(e.message));
  invoke.value=[1,2];assert.deepEqual(await call('db:list'),[1,2]);
});
