const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const H=require('../renderer/hardware'),T=require('../renderer/trackmate'),D=require('../renderer/digitalinputs'),P=require('../renderer/timingplugin');
test('removed hardware is unavailable and legacy selection cannot auto-connect another interface',()=>{
  assert(!H.TIMING.some(x=>x[0]==='phidget'));
  for(const extra of [{},{abVirtual:true},{abDevice:{vid:1}},{tmDevice:{vid:1}}])assert.equal(H.timingChosen({...extra,timingHw:'phidget'}),'none');
  for(const file of ['main.js','preload.js','renderer/index.html','renderer/app.js','renderer/race.js','renderer/help.js'])assert(!/phidget/i.test(fs.readFileSync(path.join(__dirname,'..',file),'utf8')),file);
  assert(!JSON.stringify(require('../package.json')).includes('phidget'));
});
test('Track Call uses real W packets, expires, retriggers and clears on disconnect without affecting laps',async()=>{
  let now=0,next=0;const timers=new Map(),elements=new Map();
  for(const id of ['hw-led-call',...Array.from({length:8},(_,i)=>'hw-led-'+i)])elements.set(id,{on:false,attrs:{},classList:{toggle(k,v){elements.get(id).on=v;}},setAttribute(k,v){this.attrs[k]=v;}});
  const link=T.createLink({now:()=>now}),events=[];link.on(e=>events.push(e));link.setConnected(true);
  const context=vm.createContext({Trackmate:{...T,link},Hardware:H,performance:{now:()=>now},document:{getElementById:id=>elements.get(id)},setTimeout:(f,ms)=>{timers.set(++next,{f,at:now+ms});return next;},clearTimeout:id=>timers.delete(id),console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/hardwareui.js'),'utf8'),context);
  const run=s=>vm.runInContext(s,context),advance=ms=>{now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.f();}};
  run('tmReceive(new Uint8Array([87]))');assert(elements.get('hw-led-call').on);assert.equal(events.length,1);assert.equal(events[0].type,'call');assert.equal(link.hits,0);
  assert.equal(elements.get('hw-led-call').attrs['aria-label'],'Track Call: triggered');
  advance(700);run('tmReceive(new Uint8Array([87]))');advance(400);assert(elements.get('hw-led-call').on);advance(650);assert(!elements.get('hw-led-call').on);
  run('tmReceive(new Uint8Array([65,72]))');assert(elements.get('hw-led-0').on);assert(elements.get('hw-led-7').on);assert(!elements.get('hw-led-call').on);assert.equal(link.hits,2);
  run('tmReceive(new Uint8Array([87]))');await run('tmClose()');assert([...elements.values()].every(x=>!x.on));assert.equal(timers.size,0);assert.equal(link.connected,false);
  run('tmReceive(new Uint8Array([87]))');run('tmClearLeds()');advance(1200);assert(!elements.get('hw-led-call').on);
});
test('plugin digital inputs preserve initial-level safety, call edges and rearm delay',()=>{
  const config=P.sensorConfig(P.config({trackcall:true,rearm:100})),link=D.createLink({config}),events=[];link.on(e=>events.push(e));link.setConnected(true);
  const feed=(at,value,address=config.call.address)=>link.feed({key:D.key(address),at,value});
  feed(0,1);assert.equal(events.length,0);feed(10,0);feed(50,1);assert.equal(events.length,0);
  feed(60,0);feed(160,1);assert.equal(events.length,1);assert.equal(events[0].type,'call');feed(170,1);assert.equal(events.length,1);
  assert.equal(feed(169,0),false);assert.equal(feed(180,2),false);assert.equal(feed(180,1,'unknown'),false);
  link.rearm();feed(190,1);assert.equal(events.length,1);feed(200,0);feed(300,1);assert.equal(events.length,2);
  link.setConnected(false);assert.equal(feed(400,0),false);link.setConnected(true);feed(500,1);assert.equal(events.length,2);
  link.configure(config);feed(600,0);feed(700,1);assert.equal(events.length,3);
});
