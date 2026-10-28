// Main-process ownership, validation, clock alignment and bounded native-helper protocol.
const path=require('path'), {spawn}=require('child_process'), {performance}=require('perf_hooks'), P=require('./renderer/phidget');
const clock=()=>performance.timeOrigin+performance.now();
const {isDeepStrictEqual}=require('util');
function createController(o={}) {
  const base=__dirname.endsWith('app.asar')?__dirname+'.unpacked':__dirname;
  const launch=o.spawn||(()=>spawn(path.join(base,'native/phidget/SlotForgePhidget.exe'),[],{windowsHide:true,stdio:['pipe','pipe','pipe']}));
  const notify=o.onEvent||(()=>{}),platform=o.platform||process.platform;
  let child=null,connected=false,busy=false,race=false,lease=0,leaseActive=false,claim=0,c=null,offset=0,uncertainty=null,seq=0,last=-Infinity,buffer='',error='',generation=0,request=0,heartbeat=null,testTimer=null,testEpoch=0,armed=false,devices=[],failsafes=[],alive=clock(),opening=false,pending=[],cancel=0;
  const requests=new Map(),state=()=>({connected,race,busy,armed,config:c,error,devices,failsafes,clockUncertainty:uncertainty,platform});
  const announce=()=>notify({type:'state',...state()});
  function rejectAll(message){for(const p of requests.values()){clearTimeout(p.timer);p.reject(Error(message));}requests.clear();}
  function send(cmd,data={},timeout=5000){return new Promise((resolve,reject)=>{if(!child?.stdin?.writable)return reject(Error('The Phidget helper is not running.'));const id=++request;const timer=setTimeout(()=>{requests.delete(id);reject(Error('Phidget helper timed out: '+cmd));},timeout);requests.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,cmd,...data})+'\n');});}
  function cancelTest(){++testEpoch;clearTimeout(testTimer);testTimer=null;}
  // A lost connection does not end the race's reservation. Only release/shutdown does.
  function terminate(message=''){error=message;connected=false;opening=false;leaseActive=false;armed=false;pending=[];clearInterval(heartbeat);cancelTest();heartbeat=null;const p=child;child=null;++generation;rejectAll(message||'Phidget connection closed.');if(p){try{p.stdin.end();}catch{}const t=setTimeout(()=>p.kill(),1000);t.unref?.();}announce();}
  function packet(p){
    if(!p||typeof p.type!=='string')throw Error('Invalid Phidget helper packet.');
    if(p.type==='hello'){if(p.protocol!==1||(p.simulation&&!o.allowSimulation))throw Error('Unexpected Phidget helper or simulation mode.');const w=requests.get(0);if(w){clearTimeout(w.timer);requests.delete(0);w.resolve(p);}return;}
    if(p.type==='error'){terminate(String(p.message||'Phidget connection failed.'));return;}
    if(p.type==='reply'){const w=requests.get(p.id);if(w){clearTimeout(w.timer);requests.delete(p.id);w.resolve(p);}return;}
    if(p.type==='sample'||p.type==='tick'){
      if(!connected&&!opening)return;
      if(!Number.isInteger(p.seq)||p.seq!==seq+1||!Number.isFinite(p.at)||p.at<last)throw Error('Phidget timing stream lost an event. Reconnect before racing.');
      if(p.type==='sample'){
        const input=P.assignments(c).find(a=>a.kind!=='output'&&P.key(a.address)===p.key);
        if(!input||!Number.isFinite(p.value)||(input.address.type==='digital'&&p.value!==0&&p.value!==1))throw Error('Unexpected Phidget input channel or value.');
      }
      seq=p.seq;last=p.at;const e={...p,at:p.at+offset};
      if(opening){if(pending.length>=16384)throw Error('Phidget connection buffer overflow.');pending.push(e);}else notify(e);
    }
  }
  async function start(){if(platform!=='win32')throw Error('Phidget USB support currently requires the Windows desktop app.');const g=++generation;buffer='';error='';
    const hello=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{requests.delete(0);reject(Error('Phidget helper did not start.'));},4000);requests.set(0,{resolve,reject,timer});});
    try{child=launch();}catch(x){rejectAll(x.message);await hello;return;}
    child.stdout.on('data',b=>{if(g!==generation||!child)return;buffer+=b.toString();try{if(buffer.length>1048576)throw Error('Phidget protocol buffer overflow.');let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(line.trim())packet(JSON.parse(line));}}catch(x){terminate(x.message);}});
    child.stderr.on('data',()=>{});child.stdin.on('error',e=>{if(g===generation)terminate(e.message);});child.on('error',e=>{if(g===generation)terminate('Cannot start Phidget helper: '+e.message);});child.on('exit',code=>{if(g===generation&&child)terminate('Phidget helper stopped ('+code+').');});await hello;
  }
  async function exclusive(fn){if(busy)throw Error('A Phidget operation is in progress.');busy=true;try{return await fn();}catch(x){terminate(x.message);throw x;}finally{busy=false;announce();}}
  async function scan(){if(race||connected)throw Error('Disconnect before scanning Phidget channels.');return exclusive(async()=>{await start();const p=await send('scan');devices=(p.devices||[]).filter(d=>P.addressValid(d.address)).slice(0,512);terminate();return state();});}
  async function open(value){
    if(connected)throw Error('Disconnect before opening the Phidget interface again.');
    const v=P.config(value),errors=P.validate(v);if(errors.length)throw Error(errors[0]);
    if(race&&!isDeepStrictEqual(v,c))throw Error('Reconnect with the race’s saved Phidget configuration, or leave the race first.');
    return exclusive(async()=>{const operation=cancel;terminate();c=v;await start();let best=Infinity;for(let i=0;i<7;i++){const before=clock(),p=await send('clock'),after=clock();if(!Number.isFinite(p.at))throw Error('Invalid helper clock.');if(after-before<best){best=after-before;offset=(before+after)/2-p.at;}}uncertainty=best/2;if(operation!==cancel)throw Error('Connection cancelled.');
      seq=0;last=-Infinity;opening=true;pending=[];
      const channels=P.assignments(c).map(a=>({key:P.key(a.address),address:a.address,off:a.active?0:1,initial:a.address.type==='digital'?(a.active?0:1):(a.below?a.clear:a.trigger-0.1)}));
      const p=await send('open',{channels},Math.min(140000,6000+channels.length*2200));if(operation!==cancel)throw Error('Connection cancelled.');failsafes=p.failsafes||[];connected=true;opening=false;alive=clock();announce();for(const e of pending)notify(e);pending=[];
      heartbeat=setInterval(()=>{if(clock()-alive>3000){terminate('Main window stopped responding; Phidget outputs released.');return;}send('ping',{},1500).catch(x=>terminate(x.message));},400);heartbeat.unref?.();return state();});}
  function physical(wants={}){const values={};for(const a of P.assignments(c||P.defaults()).filter(a=>a.kind==='output'))values[P.key(a.address)]=(wants[a.role]===true)===a.active?1:0;return values;}
  async function write(wants){if(!connected)throw Error('Connect the Phidget first.');const g=generation;try{await send('outputs',{values:physical(wants)});return state();}catch(x){if(g===generation)terminate(x.message);throw x;}}
  async function outputs(wants,token){if(!race||!leaseActive||token!==lease)throw Error('This race does not own the Phidget outputs.');if(!wants||typeof wants!=='object'||Object.entries(wants).some(([k,v])=>!P.roles(c.lanes).some(r=>r[0]===k)||typeof v!=='boolean'))throw Error('Invalid output request.');return write(wants);}
  async function setRace(on,lanes,token){
    if(typeof on!=='boolean')throw Error('Invalid race ownership request.');
    if(!on){
      if(!race||token!==lease)return state();
      ++claim;race=false;leaseActive=false;armed=false;cancelTest();
      if(connected)await write({});announce();return state();
    }
    if(!connected||!Number.isInteger(lanes)||lanes<1||lanes>c.lanes)throw Error('The Phidget must be connected and cover all race lanes.');
    if(race&&(leaseActive||token!==lease))throw Error('Phidget race ownership is already held.');
    const priorRace=race,attempt=++claim;race=true;armed=false;cancelTest();
    try{
      await write({});
      if(attempt!==claim||!connected||!race)throw Error('Race ownership request was cancelled.');
      lease++;leaseActive=true;announce();return {...state(),lease};
    }catch(x){if(attempt===claim){race=priorRace;leaseActive=false;announce();}throw x;}
  }
  async function armTests(on){if(race||!connected)throw Error('Output tests require a connection and no open race.');armed=on===true;cancelTest();await write({});announce();return state();}
  async function test(index){
    if(!armed||race||!connected)throw Error('Enable output tests outside a race first.');
    const a=Number.isInteger(index)&&index>=0?c.outputs[index]:null;if(!c.outputsOn||!a)throw Error('Assign an output first.');
    cancelTest();const epoch=testEpoch;
    await write({[a.role]:true});
    if(epoch===testEpoch&&armed&&!race&&connected)testTimer=setTimeout(()=>{
      if(epoch===testEpoch&&armed&&!race&&connected)write({}).catch(()=>{});
    },1200);
    return state();
  }
  return {state,scan,open,outputs,setRace,armTests,test,alive:()=>{alive=clock();return connected;},close:async()=>{if(race)throw Error('Leave the race before disconnecting.');cancel++;if(connected){try{await write({});}finally{terminate();}}else terminate();return state();},shutdown:()=>{cancel++;claim++;race=false;terminate();}};
}
module.exports={createController};
