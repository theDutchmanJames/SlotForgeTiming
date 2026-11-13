const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const H=require('../renderer/hardware');
const ui=fs.readFileSync(require.resolve('../renderer/dsui'),'utf8');
function harness(){
  const timers=[],ctx=vm.createContext({Hardware:H,DsTiming:require('../renderer/dstiming'),performance:{now:()=>1250},document:{getElementById:()=>null},setTimeout:fn=>{timers.push(fn);return timers.length;},state:{settings:{dsType:'ds300'}}});
  vm.runInContext(ui,ctx);
  return {ctx,timers,run:s=>vm.runInContext(s,ctx)};
}
test('reference speeds preserve existing defaults and distinguish 56000 from 57600',()=>{
  assert.equal(H.serialConfig().baud,9600);
  assert.equal(H.serialConfig({baud:'56000'}).baud,56000);
  assert.equal(H.serialConfig({baud:57600}).baud,57600);
  assert.equal(H.dsGuidance('ds030').baud,4800);
  assert.equal(H.dsGuidance('ds200').baud,4800);
  assert.equal(H.dsGuidance('ds300').baud,56000);
  for(const id of ['ds0045','ds200b','ds300rc','unknown'])assert.equal(H.dsGuidance(id).baud,null);
  assert.equal(H.dsTypeName('ds0045'),'DS-0045');
  assert(H.TIMING.some(([id])=>id==='ds'),'DS-200 / DS-300 timing can be selected');
});
test('offline check accepts binary payloads and legacy captures without treating notes as bytes',()=>{
  const bytes=Array.from({length:256},(_,i)=>i),rows=[];
  for(let i=0;i<bytes.length;i+=64)rows.push(H.line(1234,'<-',bytes.slice(i,i+64)));
  rows.push('    1.250  NOTE  example <- 2 B not data');
  const text=H.dsCapture({type:'ds300',omitted:2000},rows),r=H.dsInspectCapture(text);
  assert.deepEqual(r,{bytes:256,chunks:4,sessions:0,omitted:2000});
  assert.equal(H.dsInspectCapture(H.dsHeader({})+'\r\n'+H.line(0,'<-',[0,13,10,255])).bytes,4);
  assert.throws(()=>H.dsInspectCapture(text.replace('64 B','63 B')),/Byte count mismatch/);
  assert.throws(()=>H.dsInspectCapture(H.dsHeader({})+'\n0.000 <- 1 B zz |.|'),/Invalid receive/);
  assert.throws(()=>H.dsInspectCapture('PC Lap Counter'),/not a SlotForge/);
  assert.throws(()=>H.dsInspectCapture('x'.repeat(8*1024*1024+1)),/smaller/);
});

test('payload text cannot masquerade as notes or connection metadata',()=>{
  const payload=Buffer.from('NOTE -- connected to fake | <- 1 B');
  const rows=[H.line(0,'<-',payload),'    0.001  NOTE  -- connected to fake',
    '          -- connected to DS-300 / COM port at 56000 baud --'];
  assert.deepEqual(H.dsInspectCapture(H.dsCapture({},rows)),{bytes:payload.length,chunks:1,sessions:1,omitted:0});
  const corrupt=H.dsCapture({},[H.line(0,'<-',Buffer.from('NOTE'))]).replace('4 B','3 B');
  assert.throws(()=>H.dsInspectCapture(corrupt),/mismatch/);
});

test('long legacy rows are checked without recursive hex matching; malformed loss counts fail',()=>{
  const count=100000, row=`0.000 <- ${count} B ${'00'.repeat(count)} |${'.'.repeat(count)}|`;
  assert.equal(H.dsInspectCapture(H.dsHeader({})+'\n'+row).bytes,count);
  for(const omitted of ['NaN','Infinity','1 trailing text','9007199254740992']) {
    assert.throws(()=>H.dsInspectCapture(H.dsHeader({})+'\nOmitted log lines: '+omitted),/omitted-line/);
  }
});
test('capture is bounded, loss is explicit, and serial bursts schedule one UI refresh',()=>{
  const {run,timers}=harness();
  run('dscReceive(new Uint8Array(10000))');
  assert.equal(run('dsc.bytes'),10000); assert.equal(run('dsc.pieces'),1);
  assert.equal(run('dsc.lines.length'),157); assert.equal(timers.length,1);
  assert.equal(run('Hardware.dsInspectCapture(Hardware.dsCapture({},dsc.lines)).bytes'),10000);
  run('for(let i=0;i<20000;i++)dscPush("note")');
  assert(run('dsc.lines.length <= DSC_KEPT')); assert(run('dsc.omitted > 0'));
});
test('open errors persist, duplicate opens are refused, and no protocol writer is used',async()=>{
  const {run,ctx}=harness(); let release,opens=0;
  ctx.port={open:()=>{opens++;return new Promise(r=>release=r);},setSignals:async()=>{},getSignals:async()=>({}),close:async()=>{},readable:null,get writable(){throw Error('must not acquire writer');}};
  run('dsc.dev=port');const opening=run('dscOpen()');
  assert.equal(await run('dscOpen()'),false); release();await opening;await run('dsc.loop');assert.equal(opens,1);
  ctx.port.open=async()=>{throw Error('port busy');};
  assert.equal(await run('dscOpen()'),false);assert.match(run('dsc.message'),/port busy/);
});
test('read completion releases lock and closes the port; saved identity is immutable',async()=>{
  const {run,ctx}=harness();let closed=0,released=0;
  ctx.port={open:async()=>{},setSignals:async()=>{},getSignals:async()=>({}),close:async()=>closed++,readable:{getReader:()=>({read:async()=>({done:true}),releaseLock:()=>released++})}};
  run('dsc.dev=port;dsc.cfg.baud=56000'); await run('dscOpen()');await run('dsc.loop');
  assert.equal(closed,1);assert.equal(released,1);assert.equal(run('dsc.reader'),null);assert.equal(run('dsc.open'),false);
  run('state.settings.dsType="ds030"');assert.equal(run('dsc.capture.type'),'ds300');
  assert.match(run('dsc.lines.join(" ")'),/DS-300.*56000 baud/);
});
test('late control-line samples cannot contaminate a later connection',async()=>{
  const {run,ctx}=harness();let resolve;
  ctx.port={getSignals:()=>new Promise(r=>resolve=r)};
  run('dsc.dev=port;dsc.open=true;dscPoll();dsc.gen++');resolve({clearToSend:true});await new Promise(setImmediate);
  assert.equal(run('dsc.lines.length'),0);
});
test('disconnect cancels the reader once, releases it before closing, and retains received bytes',async()=>{
  const {run,ctx}=harness();let finish;const events=[];let first=true;
  ctx.port={open:async()=>{},setSignals:async()=>{},getSignals:async()=>({}),close:async()=>events.push('close'),readable:{getReader:()=>({read:async()=>first?(first=false,{value:Uint8Array.from([0,255,13])}):new Promise(r=>finish=r),cancel:async()=>{events.push('cancel');finish({done:true});},releaseLock:()=>events.push('release')})}};
  run('dsc.dev=port');await run('dscOpen()');await new Promise(setImmediate);
  const closing=run('dscClose()');await run('dscClose()');await closing;
  assert.deepEqual(events,['cancel','release','close']);assert.equal(run('dsc.bytes'),3);
});

test('failed port close retains ownership and supports retry instead of reconnecting over it',async()=>{
  const {run,ctx}=harness();let closes=0,opens=0;
  ctx.port={open:async()=>opens++,setSignals:async()=>{},getSignals:async()=>({}),readable:null,
    close:async()=>{if(++closes===1)throw Error('driver busy');}};
  run('dsc.dev=port');await run('dscOpen()');await run('dsc.loop');
  assert.equal(run('dsc.needsClose===port'),true);assert.match(run('dsc.message'),/Retry disconnect/);
  assert.equal(await run('dscOpen()'),false);assert.equal(opens,1);
  await run('dscClose()');assert.equal(closes,2);assert.equal(run('dsc.needsClose'),null);
  assert.equal(run('dsc.message'),'');
});

test('finding ports or saving a model blocks opening with stale selection',async()=>{
  const {run,ctx}=harness();let opens=0;
  ctx.port={open:async()=>opens++};run('dsc.dev=port;dscFinding=true');
  assert.equal(await run('dscOpen()'),false);
  run('dscFinding=false;dscSaving=true');assert.equal(await run('dscOpen()'),false);
  assert.equal(opens,0);
});
