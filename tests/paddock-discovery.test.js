const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events'),{createRequire}=require('node:module');
const source=path.resolve(__dirname,'../paddock.js'),realRequire=createRequire(source);
const nic=(address,netmask='255.255.255.0',internal=false)=>({family:'IPv4',address,netmask,internal});
function harness({interfaces={lan:[nic('192.168.1.5')]},respond=()=>true,broken,invalid=false}={}){
 const sockets=[],sent=[],timers=new Set();let replies=0;
 class Socket extends EventEmitter {
  constructor(){super();sockets.push(this);this.closed=false;}
  bind(...args){this.bound=typeof args[1]==='string'?args[1]:null;setImmediate(()=>{if(!this.closed)args.at(-1)();});}
  setMulticastTTL(){} setBroadcast(){}
  setMulticastInterface(ip){this.adapter=ip;}
  send(bytes,port,destination,callback){setImmediate(()=>{if(this.closed)return;const ip=this.bound||this.adapter,packet=JSON.parse(bytes);sent.push({ip,port,destination,packet});if(ip===broken){const e=Object.assign(Error('Adapter unavailable'),{code:'ENETUNREACH'});if(callback)callback(e);else this.emit('error',e);return;}callback?.();if(!respond({ip,destination,sent}))return;
   const item={type:'slotforge-host',version:1,nonce:packet.nonce,id:'host',name:'Club',port:54321};const emit=(p,peer='192.168.1.20')=>this.emit('message',Buffer.from(JSON.stringify(p)),{address:peer,port:47778});
   if(invalid){emit({...item,nonce:'wrong'});emit({...item,id:42});emit({...item,name:' '});emit({...item,port:0});emit(item,'8.8.8.8');emit({...item,name:'x'.repeat(2100)});}
   emit(item);replies++;
  });}
  close(){this.closed=true;}
 }
 const mod={exports:{}};const timeout=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},Math.min(ms,60));timers.add(id);return id;};const clear=id=>{timers.delete(id);clearTimeout(id);};
 vm.runInNewContext(fs.readFileSync(source,'utf8'),{module:mod,exports:mod.exports,require:id=>id==='node:dgram'?{createSocket:()=>new Socket()}:id==='node:os'?{networkInterfaces:()=>interfaces}:realRequire(id),Buffer,URL,setTimeout:timeout,clearTimeout:clear});
 return {scan:()=>mod.exports.discover({duration:60,retryMs:15}),sent,sockets,timers,get replies(){return replies;}};
}
test('discovery keeps each adapter isolated while UDP sends are pending',async()=>{const h=harness({interfaces:{lan:[nic('192.168.1.5')],other:[nic('10.0.0.5')]},respond:x=>x.ip==='192.168.1.5'});const hosts=await h.scan();assert.equal(hosts.length,1);assert(h.sent.some(x=>x.ip==='192.168.1.5'));assert(h.sockets.every(s=>s.closed));assert.equal(h.timers.size,0);});
test('one broken adapter does not cancel replies on a working adapter',async()=>{const h=harness({interfaces:{bad:[nic('10.0.0.5')],lan:[nic('192.168.1.5')]},broken:'10.0.0.5'});assert.equal((await h.scan()).length,1);assert(h.sockets.every(s=>s.closed));});
test('local subnet broadcast finds a host when multicast gets no reply',async()=>{const h=harness({respond:x=>x.destination==='192.168.1.255'});assert.equal((await h.scan()).length,1);assert(h.sent.every(x=>['239.255.47.77','192.168.1.255'].includes(x.destination)));});
test('discovery retries after the first request round is lost',async()=>{const h=harness({respond:x=>x.sent.filter(s=>s.destination===x.destination).length>1});assert.equal((await h.scan()).length,1);assert(h.sent.length<=8);});
test('discovery rejects malformed replies, deduplicates hosts and never broadcasts credentials',async()=>{const h=harness({invalid:true});const hosts=await h.scan();assert.equal(hosts.length,1);assert.equal(hosts[0].id,'host');assert.equal(hosts[0].address,'http://192.168.1.20:54321');assert(h.sent.every(x=>Object.keys(x.packet).sort().join(',')==='nonce,type,version'));});
test('a discovery socket failure produces an error instead of an empty successful scan',async()=>{const h=harness({broken:'192.168.1.5'});await assert.rejects(h.scan(),/discovery|network|adapter/i);assert(h.sockets.every(s=>s.closed));assert.equal(h.timers.size,0);});
test('no suitable network adapter is reported explicitly',async()=>{const h=harness({interfaces:{}});await assert.rejects(h.scan(),/network|adapter/i);});
test('same-computer discovery supports loopback without a broadcast',async()=>{const h=harness({interfaces:{lo:[nic('127.0.0.1','255.0.0.0',true)]}});assert.equal((await h.scan()).length,1);assert(h.sent.every(x=>x.destination==='239.255.47.77'));});

for(const broadcastOnly of [false,true])test('real Paddock advertiser responds to '+(broadcastOnly?'subnet broadcast fallback':'Timing discovery'),{skip:!process.env.PADDOCK_SOURCE},async t=>{
 const {advertise}=require(path.join(process.env.PADDOCK_SOURCE,'src/discovery.cjs'));
 const host=await advertise(()=>({id:'timing-discovery-test',name:'Discovery test host',port:54321}));t.after(()=>new Promise(resolve=>host.close(resolve)));
 let discover=realRequire('./paddock').discover;
 if(broadcastOnly){const dgram=require('node:dgram'),mod={exports:{}};
  vm.runInNewContext(fs.readFileSync(source,'utf8'),{module:mod,exports:mod.exports,require:id=>id==='node:dgram'?{...dgram,createSocket:(...args)=>{const socket=dgram.createSocket(...args);socket.setMulticastInterface=()=>{throw Error('Multicast unavailable in test');};return socket;}}:realRequire(id),Buffer,URL,setTimeout,clearTimeout});discover=mod.exports.discover;
 }
 const found=await discover({duration:900,retryMs:250});assert(found.some(h=>h.id==='timing-discovery-test'),'Paddock must reply using the existing discovery protocol');
});
