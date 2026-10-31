// Trusted LAN client. Network work runs in main, never in the lap timing path.
const http=require('node:http'),net=require('node:net'),dgram=require('node:dgram'),os=require('node:os'),crypto=require('node:crypto');
const Records=require('./paddockrecords');
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const TERMINAL_CODES=new Set(['INVALID_JSON','INVALID_PAYLOAD','SUMMARY_MISMATCH','DATABASE_REQUIRED','BROWSER_ORIGIN_FORBIDDEN','TIMING_PERMISSION_REQUIRED','CAR_NOT_FOUND','NOT_FOUND','DATABASE_MISMATCH','CONFIGURATION_MISMATCH','CONFIGURATION_INVALID','REVISION_CONFLICT','STALE_REVISION','PAYLOAD_TOO_LARGE','CONTENT_TYPE_REQUIRED','CONTENT_ENCODING_UNSUPPORTED','UNSUPPORTED_VERSION','CAPACITY_EXCEEDED','RECEIPT_MISMATCH']);
const COPY_FIELDS=['brand','manufacturer','model','scale','motor','gearing','tyres','weight','picture','raceClass'];
function privateIP(ip){if(net.isIP(ip)!==4)return false;const [a,b]=ip.split('.').map(Number);return a===127||a===10||a===192&&b===168||a===172&&b>=16&&b<=31;}
function address(input){const u=new URL(String(input).includes('://')?input:'http://'+input);if(u.protocol!=='http:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(privateIP(u.hostname)||u.hostname==='localhost'))throw Error('Enter a local IPv4 address and port, for example 192.168.1.20:51234.');if(!u.port)throw Error('Include the port displayed by Paddock.');return u.origin;}
function request(base,route,code,databaseId,body,limit=16*1024*1024){return new Promise((resolve,reject)=>{
  const raw=body===undefined?null:JSON.stringify(body);if(raw&&Buffer.byteLength(raw)>8*1024*1024)return reject(Object.assign(Error('Session exceeds Paddock’s 8 MiB limit.'),{code:'PAYLOAD_TOO_LARGE'}));
  const u=new URL(route,address(base));if(u.origin!==address(base))return reject(Error('Unexpected host address.'));
  const req=http.request(u,{method:raw?'POST':'GET',headers:{Authorization:'Bearer '+code,...(databaseId?{'X-SlotForge-Database':databaseId}:{}),'X-SlotForge-Pages':'1',...(raw?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}:{})}},res=>{
    if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();return reject(Error('Compressed Paddock responses are unsupported.'));}
    let size=0;const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>limit)res.destroy(Error('Paddock response is too large.'));else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(res.statusCode!==200){const e=Error(value.error||'Paddock returned HTTP '+res.statusCode);e.code=value.code||'HTTP_'+res.statusCode;e.httpStatus=res.statusCode;throw e;}resolve(value);}catch(e){reject(e);}});
  });const timer=setTimeout(()=>req.destroy(Error('Paddock did not respond within 15 seconds.')),15000);req.on('close',()=>clearTimeout(timer));req.on('error',reject);if(raw)req.write(raw);req.end();
});}
// Each adapter owns a socket: asynchronous sends cannot inherit another adapter's routing.
function discover({duration=4200,retryMs=1000}={}){return new Promise((resolve,reject)=>{
  const adapters=[...new Map(Object.values(os.networkInterfaces()).flat().filter(n=>n.family==='IPv4'&&privateIP(n.address)).map(n=>[n.address,n])).values()];
  if(!adapters.length)return reject(Error('No local IPv4 network adapter is available for Paddock discovery. Enter the host address manually.'));
  const nonce=crypto.randomBytes(16).toString('hex'),packet=Buffer.from(JSON.stringify({type:'slotforge-discover',version:1,nonce})),found=new Map(),sockets=new Set(),timers=new Set();let done=false,sent=0;
  const later=(fn,ms)=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);};
  const close=socket=>{sockets.delete(socket);try{socket.close();}catch{}};
  const finish=()=>{if(done)return;done=true;timers.forEach(clearTimeout);timers.clear();sockets.forEach(close);
    if(!sent&&!found.size)reject(Error('Paddock discovery could not send on a local network adapter. Check the connection or enter the host address manually.'));
    else resolve([...found.values()].sort((a,b)=>a.name.localeCompare(b.name)));
  };
  later(finish,duration);
  for(const nic of adapters){
    let socket;try{socket=dgram.createSocket('udp4');sockets.add(socket);}catch{continue;}
    socket.on('error',()=>close(socket));
    socket.on('message',(raw,remote)=>{try{
      if(done||raw.length>2048||!privateIP(remote.address))return;const v=JSON.parse(raw);
      if(v.type!=='slotforge-host'||v.version!==1||v.nonce!==nonce||typeof v.id!=='string'||!ID.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>200||!Number.isInteger(v.port)||v.port<1||v.port>65535)return;
      const key=v.id+'@'+remote.address+':'+v.port;if(found.size<100||found.has(key))found.set(key,{id:v.id,name:v.name,address:'http://'+remote.address+':'+v.port});
    }catch{}});
    try{socket.bind(0,nic.address,()=>{
      if(done||!sockets.has(socket))return;const destinations=[];
      try{socket.setMulticastTTL(1);socket.setMulticastInterface(nic.address);destinations.push('239.255.47.77');}catch{}
      // Paddock listens on this same UDP port for broadcast as well as multicast.
      // Use only the adapter's own subnet, never probe ranges of host addresses.
      if(!nic.internal&&net.isIP(nic.netmask)===4){
        const mask=nic.netmask.split('.').map(Number),bits=mask.map(n=>n.toString(2).padStart(8,'0')).join('');
        if(/^1+0{2,}$/.test(bits)){
          const broadcast=nic.address.split('.').map((n,i)=>Number(n)|(~mask[i]&255)).join('.');
          if(privateIP(broadcast))try{socket.setBroadcast(true);destinations.push(broadcast);}catch{}
        }
      }
      if(!destinations.length){close(socket);return;}
      const sendRound=round=>{
        if(done||!sockets.has(socket))return;
        for(const destination of destinations)try{socket.send(packet,47778,destination,e=>{if(!done&&!e)sent++;});}catch{}
        if(round<3)later(()=>sendRound(round+1),retryMs);
      };
      sendRound(0);
    });}catch{close(socket);}
  }
});}
class Paddock {
  constructor(db){this.db=db;this.code='';this.connected=false;this.error='';this.catalog=[];this.busy=false;this.stopped=false;this.timer=null;Records.state(db.data);}
  state(){return Records.state(this.db.data);}
  async exclusive(task){if(this.busy)throw Error('Wait for the current Paddock operation.');this.busy=true;try{return await task();}finally{this.busy=false;}}
  async commit(){this.db.touchAll();this.db.commit();await this.db.saved();}
  deliveries(){return [...this.db.data.sessions.map(s=>s.paddockDelivery).filter(d=>d&&d.status!=='withdrawn'),...this.state().withdrawals];}
  status(){const c=this.state().connection;return {connection:c,connected:this.connected,hasCode:!!this.code,error:this.error,busy:this.busy,
    linked:this.db.data.slotcars.filter(c=>c.paddock).map(c=>({id:c.id,name:[c.brand,c.manufacturer,c.model].filter(Boolean).join(' '),databaseId:c.paddock.databaseId,carId:c.paddock.carId,archived:!!c.paddock.archived,capturedAt:c.paddock.configuration?.capturedAt})),
    deliveries:this.deliveries().map(d=>({sessionId:d.payload?.sessionId||d.sessionId||'',name:d.name||d.payload?.name||'Saved session',revision:d.payload?.revision,status:d.status,error:d.error||'',databaseId:d.payload?.databaseId||d.databaseId,receivedAt:d.receipt?.receivedAt}))};}
  async connect(input){
    if(this.busy)throw Error('Wait for the current Paddock operation.');this.busy=true;
    try{const base=address(input.address),code=String(input.code||'').trim();if(!/^[a-fA-F0-9]{24}$/.test(code))throw Error('Enter the 24-character connection code displayed by Paddock.');
      const s=await request(base,'/v1/status',code);if(!ID.test(s.id)||typeof s.name!=='string')throw Error('Invalid Paddock host identity.');
      const old=this.state().connection;if(old&&old.databaseId!==s.id)throw Error('This is a different Paddock database. Disconnect and forget the old host before pairing another.');
      const before=this.state().connection;this.state().connection={address:base,databaseId:s.id,name:s.name,results:!!s.permissions?.timingResults,timing:!!s.capabilities?.timing?.versions?.includes(1)};
      try{await this.commit();}catch(e){this.state().connection=before;throw e;}
      this.code=code;this.connected=true;this.error='';this.schedule();return this.status();
    }finally{this.busy=false;}
  }
  disconnect(forget=false){return this.exclusive(async()=>{this.code='';this.connected=false;this.catalog=[];clearTimeout(this.timer);const previous=this.state().connection;if(forget)this.state().connection=null;try{await this.commit();}catch(e){this.state().connection=previous;throw e;}this.error='';return this.status();});}
  async call(route,body,limit){const c=this.state().connection;if(!c||!this.code)throw Error('Connect with the current Paddock code first.');return request(c.address,route,this.code,c.databaseId,body,limit);}
  browse(){return this.exclusive(()=>this.browseNow());}
  async browseNow(){const c=this.state().connection;if(!c)throw Error('Connect to Paddock first.');let out=[],offset=0,revision=null,total=0,complete=false;
    for(let page=0;page<401;page++){
      const v=await this.call('/v1/collection'+(offset?'?offset='+offset+'&revision='+revision+'&database='+encodeURIComponent(c.databaseId):''),undefined,32*1024*1024);
      if(v.id!==c.databaseId||!Number.isInteger(v.revision)||revision!==null&&v.revision!==revision)throw Error('Paddock changed during the refresh. Refresh the catalogue again.');
      if(!Array.isArray(v.cars))throw Error('Invalid Paddock collection.');revision=v.revision;total+=Buffer.byteLength(JSON.stringify(v));if(total>200*1024*1024)throw Error('Paddock collection exceeds 200 MiB.');
      out.push(...v.cars);if(out.length>10000)throw Error('Too many Paddock cars.');if(v.nextOffset===null||v.nextOffset===undefined){complete=true;break;}if(!Number.isInteger(v.nextOffset)||v.nextOffset<=offset)throw Error('Invalid Paddock pagination.');offset=v.nextOffset;
    }
    if(!complete)throw Error('Paddock catalogue exceeded the pagination limit; no partial catalogue was loaded.');
    if(new Set(out.map(c=>c.id)).size!==out.length||out.some(c=>!ID.test(c.id)||typeof c.name!=='string'))throw Error('Invalid or duplicate car identities.');
    this.catalog=out;return out.map(c=>({id:c.id,name:c.name,maker:c.maker||'',model:c.model||'',raceClass:c.raceClass||'',linked:this.db.data.slotcars.find(x=>x.paddock?.databaseId===this.state().connection.databaseId&&x.paddock.carId===c.id)?.id||''}));
  }
  async profile(carId){if(!ID.test(carId))throw Error('Invalid car ID.');const p=await this.call('/v1/timing/cars/'+encodeURIComponent(carId));
    if(p.integrationVersion!==1||p.databaseId!==this.state().connection.databaseId||p.car?.id!==carId||p.configuration?.carId!==carId||p.configuration.databaseId!==p.databaseId||!/^[a-f0-9]{64}$/.test(p.configuration.signature)||!Number.isFinite(Date.parse(p.configuration.capturedAt)))throw Error('Invalid Paddock car profile.');
    if(p.car.picture&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(p.car.picture))throw Error('Unsupported Paddock picture.');return p;
  }
  patch(profile){const c=profile.car,t=profile.configuration.technical||{};let raceClass='';if(c.raceClass?.trim()){let cl=this.db.data.raceclasses.find(x=>x.name.trim().toLocaleLowerCase()===c.raceClass.trim().toLocaleLowerCase());if(!cl){cl={id:crypto.randomUUID(),name:c.raceClass.trim(),color:'#8295a6',custom:{}};this.db.data.raceclasses.push(cl);}raceClass=cl.id;}
    return {brand:c.maker||'',manufacturer:c.marque||'',model:c.model||c.name,scale:c.scale||'',motor:t.motor||'',gearing:[t.pinion,t.gear].filter(Boolean).join(' / '),tyres:t.rearTyres||'',weight:t.weight||'',picture:c.picture||'',raceClass,
      paddock:{databaseId:profile.databaseId,carId:c.id,name:c.name,archived:!!c.archived,availability:c.availability||'',configuration:profile.configuration}};
  }
  link(carId,localId){return this.exclusive(()=>this.linkNow(carId,localId));}
  async linkNow(carId,localId){if(!this.state().connection?.timing)throw Error('This Paddock host needs the Timing v1 update before cars can be linked.');const p=await this.profile(carId);if(p.car.archived)throw Error('This car is archived in Paddock.');const existing=this.db.data.slotcars.find(c=>c.paddock?.databaseId===p.databaseId&&c.paddock.carId===carId);
    if(existing&&localId&&existing.id!==localId)throw Error('This Paddock car is already linked to another Timing car.');let row=existing||this.db.data.slotcars.find(c=>c.id===localId);if(localId&&!row)throw Error('Local car no longer exists.');if(row?.paddock&&(row.paddock.carId!==carId||row.paddock.databaseId!==p.databaseId))throw Error('This Timing car is already linked.');
    const previous=row?copyData(row):null,classes=new Set(this.db.data.raceclasses.map(c=>c.id)),createdClasses=[];try{const patch=this.patch(p);createdClasses.push(...this.db.data.raceclasses.filter(c=>!classes.has(c.id)).map(c=>c.id));if(row)Object.assign(row,patch);else{row={id:crypto.randomUUID(),custom:{},lapsDriven:0,...patch};this.db.data.slotcars.push(row);}await this.commit();return row;}catch(e){if(previous){for(const key of [...COPY_FIELDS,'paddock']){if(Object.hasOwn(previous,key))row[key]=previous[key];else delete row[key];}}else this.db.data.slotcars=this.db.data.slotcars.filter(c=>c!==row);this.db.data.raceclasses=this.db.data.raceclasses.filter(c=>!createdClasses.includes(c.id));this.db.touchAll();throw e;}
  }
  refresh(){return this.exclusive(()=>this.refreshNow());}
  async refreshNow(){const linked=this.db.data.slotcars.filter(c=>c.paddock?.databaseId===this.state().connection?.databaseId);for(const c of linked){try{await this.linkNow(c.paddock.carId,c.id);}catch(e){if(e.code==='CAR_NOT_FOUND'||e.message.includes('archived')){c.paddock.archived=true;await this.commit();}else throw e;}}return this.status();}
  prepare(ids){return this.exclusive(()=>this.prepareNow(ids));}
  async prepareNow(ids){
    if(!Array.isArray(ids))throw Error('Choose the cars for this race.');
    const selected=ids.filter(id=>this.db.data.slotcars.some(c=>c.id===id&&c.paddock));
    if(new Set(selected).size!==selected.length)throw Error('A physical Paddock car can only be assigned to one entry in this race.');
    const captures={},warnings=[],updates=[];let offline=false;
    for(const localId of new Set(ids)){
      const c=this.db.data.slotcars.find(c=>c.id===localId);if(!c?.paddock)continue;
      if(c.paddock.archived)throw Error(c.paddock.name+' is no longer available in Paddock.');
      let configuration=c.paddock.configuration,fresh=false;
      if(!offline&&this.code&&this.state().connection?.databaseId===c.paddock.databaseId){
        try{
          const p=await this.profile(c.paddock.carId);
          if(p.car.archived)throw Object.assign(Error('Car is archived in Paddock.'),{code:'CAR_NOT_FOUND'});
          configuration=p.configuration;fresh=true;updates.push({car:c,before:c.paddock.configuration,after:configuration});
        }catch(e){
          if(['CAR_NOT_FOUND','DATABASE_MISMATCH'].includes(e.code)){if(e.code==='DATABASE_MISMATCH'){this.code='';this.connected=false;}throw e;}
          offline=true;this.connected=false;this.error=e.message;if(e.code==='UNAUTHENTICATED')this.code='';
        }
      }
      if(!configuration)throw Error('Connect to capture a configuration for '+c.paddock.name);
      if(!fresh)warnings.push(c.paddock.name+': using cached configuration from '+configuration.capturedAt);
      captures[localId]={name:c.paddock.name,configuration};
    }
    if(new Set(Object.values(captures).map(c=>c.configuration.databaseId)).size>1)throw Error('Choose linked cars from one Paddock database for this race.');
    // Publish fresh captures together. A local disk failure must never masquerade as an offline cache hit.
    if(updates.length){
      updates.forEach(u=>{u.car.paddock.configuration=u.after;});
      try{await this.commit();}catch(e){updates.forEach(u=>{u.car.paddock.configuration=u.before;});this.db.touchAll();throw e;}
    }
    return {captures,warnings,heats:[]};
  }
  schedule(delay=30000){clearTimeout(this.timer);if(!this.stopped&&this.code)this.timer=setTimeout(()=>this.flush().catch(()=>{}),delay).unref();}
  async flush(){if(this.busy||!this.code||this.stopped||this.isRacing?.()){this.schedule();return this.status();}this.busy=true;let retry=30000;
    try{await this.db.saved();const c=this.state().connection,s=await this.call('/v1/status');if(s.id!==c.databaseId)throw Object.assign(Error('Paddock database identity changed.'),{code:'DATABASE_MISMATCH'});if(!s.permissions?.timingResults)throw Error('Enable Allow Timing results and use the Timing connection code.');
      for(const d of this.deliveries().filter(d=>d.status==='pending'&&d.payload?.databaseId===c.databaseId)){
        if(this.isRacing?.())break;
        try{const p=d.payload;await this.commit();if(this.stopped)return this.status();if(this.isRacing?.())break;const r=await this.call('/v1/timing/sessions',p);if(this.stopped)return this.status();if(!r.ok||r.databaseId!==p.databaseId||r.sourceId!==p.source.id||r.sessionId!==p.sessionId||r.revision!==p.revision||r.state!==p.state||r.contentHash!==hash(p))throw Object.assign(Error('Paddock receipt does not match this result.'),{code:'RECEIPT_MISMATCH'});
          // If the local result was corrected/deleted during upload, only acknowledge this exact object.
          d.receipt=r;d.status='sent';d.error='';await this.commit();
        }catch(e){d.error=e.message;d.status=TERMINAL_CODES.has(e.code)?'attention':'pending';await this.commit();throw e;}
      }this.connected=true;this.error='';
    }catch(e){this.connected=false;this.error=e.message;retry=60000;if(['DATABASE_MISMATCH','UNAUTHENTICATED'].includes(e.code)){this.code='';}}
    finally{this.busy=false;this.schedule(retry);}return this.status();
  }
  async retry(){await this.exclusive(async()=>{for(const d of this.deliveries())if(d.payload&&d.status==='attention')d.status='pending';await this.commit();});return this.flush();}
  stop(){this.stopped=true;clearTimeout(this.timer);this.code='';}
}
const copyData=x=>JSON.parse(JSON.stringify(x));
function canonical(v){return Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);}
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
module.exports={Paddock,privateIP,address,request,discover,COPY_FIELDS,hash};
