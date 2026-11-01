// Trusted LAN client. Network work runs in main, never in the lap timing path.
const http=require('node:http'),net=require('node:net'),dgram=require('node:dgram'),os=require('node:os'),crypto=require('node:crypto');
const Records=require('./paddockrecords');
const RESPONSE_BYTES=Symbol('responseBytes');
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const TERMINAL_CODES=new Set(['INVALID_JSON','INVALID_PAYLOAD','SUMMARY_MISMATCH','DATABASE_REQUIRED','BROWSER_ORIGIN_FORBIDDEN','TIMING_PERMISSION_REQUIRED','CAR_NOT_FOUND','NOT_FOUND','DATABASE_MISMATCH','CONFIGURATION_MISMATCH','CONFIGURATION_INVALID','REVISION_CONFLICT','STALE_REVISION','PAYLOAD_TOO_LARGE','CONTENT_TYPE_REQUIRED','CONTENT_ENCODING_UNSUPPORTED','UNSUPPORTED_VERSION','CAPACITY_EXCEEDED','RECEIPT_MISMATCH']);
const COPY_FIELDS=['brand','manufacturer','model','scale','motor','gearing','tyres','weight','picture','raceClass'];
function checkedReceipt(r,p){
  if(!r?.ok||r.databaseId!==p.databaseId||r.sourceId!==p.source.id||r.sessionId!==p.sessionId||r.revision!==p.revision||r.state!==p.state||r.contentHash!==hash(p)||r.warnings!==undefined&&(!Array.isArray(r.warnings)||r.warnings.length>512||r.warnings.some(w=>!w||typeof w.code!=='string'||w.code.length>100||typeof w.carId!=='string'||!ID.test(w.carId))))throw Object.assign(Error('Paddock receipt does not match this result. Check the original database and result revision; no local result was replaced.'),{code:'RECEIPT_MISMATCH'});
  return r;
}
function receiptWarnings(d){return d.status==='sent'&&Array.isArray(d.receipt?.warnings)?d.receipt.warnings.slice(0,512).filter(w=>w&&typeof w==='object').map(w=>({code:String(w.code||'').slice(0,100),carId:String(w.carId||'').slice(0,100),carName:d.payload?.participants?.find(p=>p.carId===w.carId)?.displayName||w.carId})):[];}
function credential(value){
  if(typeof value!=='string'||value.length<4||value.length>128||!(/^[\x20-\x7e]+$/).test(value)||value!==value.trim())throw Error('Enter the Dealership password from Paddock: 4–128 English letters, numbers, spaces or symbols, with no spaces at either end.');
  return value; // Opaque and case-sensitive, including repeated internal spaces.
}
function retryDelay(value,now=Date.now()){
  const raw=String(value??'').trim(),seconds=/^\d+$/.test(raw)?Number(raw):NaN;
  const ms=Number.isFinite(seconds)?seconds*1000:/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(raw)?Date.parse(raw)-now:NaN;
  return Number.isFinite(ms)?Math.min(86400000,Math.max(1000,ms)):60000;
}
const hostKey=base=>{const host=new URL(address(base)).hostname;return host==='localhost'?'127.0.0.1':host;};
function privateIP(ip){if(net.isIP(ip)!==4)return false;const [a,b]=ip.split('.').map(Number);return a===127||a===10||a===192&&b===168||a===172&&b>=16&&b<=31;}
function address(input){const u=new URL(String(input).includes('://')?input:'http://'+input);if(u.protocol!=='http:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(privateIP(u.hostname)||u.hostname==='localhost'))throw Error('Enter a local IPv4 address and port, for example 192.168.1.20:51234.');if(!u.port)throw Error('Include the port displayed by Paddock.');return u.origin;}
function request(base,route,code,databaseId,body,limit=16*1024*1024){return new Promise((resolve,reject)=>{
  const raw=body===undefined?null:JSON.stringify(body);if(raw&&Buffer.byteLength(raw)>8*1024*1024)return reject(Object.assign(Error('Session exceeds Paddock’s 8 MiB limit.'),{code:'PAYLOAD_TOO_LARGE'}));
  const u=new URL(route,address(base));if(u.origin!==address(base))return reject(Error('Unexpected host address.'));
  const req=http.request(u,{method:raw?'POST':'GET',headers:{Authorization:'Bearer '+code,...(databaseId?{'X-SlotForge-Database':databaseId}:{}),'X-SlotForge-Pages':'1',...(raw?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}:{})}},res=>{
    if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();return reject(Error('Compressed Paddock responses are unsupported.'));}
    let size=0;const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>limit)res.destroy(Error('Paddock response is too large.'));else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{try{if(res.statusCode===429){const e=Error('Paddock has temporarily limited connection attempts. Wait before retrying; saved results remain queued.');e.code='AUTH_RATE_LIMITED';e.httpStatus=429;e.retryAfterMs=retryDelay(res.headers['retry-after']);throw e;}const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(res.statusCode!==200){const e=Error(value.error||'Paddock returned HTTP '+res.statusCode);e.code=value.code||'HTTP_'+res.statusCode;e.httpStatus=res.statusCode;throw e;}if(value&&typeof value==='object')Object.defineProperty(value,RESPONSE_BYTES,{value:size});resolve(value);}catch(e){reject(e);}});
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
  constructor(db){this.db=db;this.code='';this.connected=false;this.error='';this.catalog=[];this.busy=false;this.stopped=false;this.timer=null;this.cooldowns=new Map();Records.state(db.data);}
  cooldownsNow(){for(const [host,until] of this.cooldowns)if(until<=Date.now())this.cooldowns.delete(host);return [...this.cooldowns].map(([host,until])=>({host,until}));}
  retryAt(base){this.cooldownsNow();return base?this.cooldowns.get(hostKey(base))||0:0;}
  async hostRequest(base,route,code,databaseId,body,limit){
    const until=this.retryAt(base);
    if(until)throw Object.assign(Error('Paddock connection cooldown: try again in '+Math.ceil((until-Date.now())/1000)+' seconds. Saved results remain queued.'),{code:'AUTH_RATE_LIMITED',retryAt:until});
    try{return await request(base,route,code,databaseId,body,limit);}catch(e){
      if(e.httpStatus===429){
        const host=hostKey(base);if(this.cooldowns.size>=100&&!this.cooldowns.has(host))this.cooldowns.delete(this.cooldowns.keys().next().value);
        this.cooldowns.set(host,Date.now()+e.retryAfterMs);e.retryAt=this.cooldowns.get(host);
        if(this.state().connection&&hostKey(this.state().connection.address)===host){this.connected=false;this.error=e.message;this.schedule();}
      }
      throw e;
    }
  }
  state(){return Records.state(this.db.data);}
  async exclusive(task){if(this.busy)throw Error('Wait for the current Paddock operation.');this.busy=true;try{return await task();}finally{this.busy=false;}}
  // Top-level Paddock state is always serialized by Database. Only invalidate
  // changed table rows; invalidating everything re-encodes every photo and lap.
  async commit(rows=[]){for(const row of rows)this.db.touch(row);this.db.commit();await this.db.saved();}
  deliveryRows(d){return this.db.data.sessions.filter(s=>s.paddockDelivery===d);}
  deliveries(){return [...this.db.data.sessions.map(s=>s.paddockDelivery).filter(d=>d&&d.status!=='withdrawn'),...this.state().withdrawals];}
  status(){const c=this.state().connection;return {connection:c,connected:this.connected,hasCode:!!this.code,error:this.error,busy:this.busy,cooldowns:this.cooldownsNow(),
    linked:this.db.data.slotcars.filter(c=>c.paddock).map(c=>({id:c.id,name:[c.brand,c.manufacturer,c.model].filter(Boolean).join(' '),databaseId:c.paddock.databaseId,carId:c.paddock.carId,archived:!!c.paddock.archived,capturedAt:c.paddock.configuration?.capturedAt})),
    deliveries:this.deliveries().map(d=>({sessionId:d.payload?.sessionId||d.sessionId||'',name:d.name||d.payload?.name||'Saved session',revision:d.payload?.revision,status:d.status,error:d.error||'',databaseId:d.payload?.databaseId||d.databaseId,receivedAt:d.receipt?.receivedAt,warnings:receiptWarnings(d),receiptCheckedAt:d.receiptCheckedAt,receiptCheckError:d.receiptCheckError||''}))};}
  checkReceipt(sessionId){return this.exclusive(async()=>{
    if(this.isRacing?.())throw Error('Finish the race before checking Paddock results.');
    const c=this.state().connection,d=this.deliveries().find(d=>d.status==='sent'&&d.payload?.sessionId===sessionId&&d.payload.databaseId===c?.databaseId);
    if(!d||!ID.test(sessionId))throw Error('Choose a delivered result from the connected Paddock database.');
    const p=d.payload;let r,failure;
    try{r=checkedReceipt(await this.call('/v1/timing/sessions/'+encodeURIComponent(p.source.id)+'/'+encodeURIComponent(p.sessionId)),p);}catch(e){failure=e;}
    // A local correction/deletion can replace a delivery while this GET is in flight.
    if(this.stopped||this.isRacing?.()||!this.deliveries().includes(d)||d.payload!==p||d.status!=='sent')return this.status();
    const before={receipt:d.receipt,receiptCheckedAt:d.receiptCheckedAt,receiptCheckError:d.receiptCheckError};
    if(r){d.receipt=r;d.receiptCheckedAt=new Date().toISOString();d.receiptCheckError='';}
    else d.receiptCheckError=failure?.code==='SESSION_NOT_FOUND'?'Paddock no longer has a receipt for this result. Verify the original database or restored backup before resending.':failure.message;
    const rows=this.deliveryRows(d);
    try{await this.commit(rows);}catch(e){Object.assign(d,before);rows.forEach(row=>this.db.touch(row));throw e;}
    if(failure)throw failure;
    return this.status();
  });}
  async connect(input){
    if(this.busy)throw Error('Wait for the current Paddock operation.');this.busy=true;
    try{const base=address(input.address),code=credential(input.code);
      const s=await this.hostRequest(base,'/v1/status',code);if(!ID.test(s.id)||typeof s.name!=='string')throw Error('Invalid Paddock host identity.');
      const old=this.state().connection;if(old&&old.databaseId!==s.id)throw Error('This is a different Paddock database. Disconnect and forget the old host before pairing another.');
      const before=this.state().connection;this.state().connection={address:base,databaseId:s.id,name:s.name,results:!!s.permissions?.timingResults,timing:!!s.capabilities?.timing?.versions?.includes(1)};
      try{await this.commit();}catch(e){this.state().connection=before;throw e;}
      this.code=code;this.connected=true;this.error='';this.catalogueError='';this.nextCatalogueCheck=0;this.catalogueFailures=0;this.schedule();return this.status();
    }finally{this.busy=false;}
  }
  disconnect(forget=false){return this.exclusive(async()=>{this.code='';this.connected=false;this.catalog=[];clearTimeout(this.timer);const previous=this.state().connection;if(forget)this.state().connection=null;try{await this.commit();}catch(e){this.state().connection=previous;throw e;}this.error='';return this.status();});}
  async call(route,body,limit){const c=this.state().connection;if(!c||!this.code)throw Error('Connect with the current Paddock Dealership password first (or a Timing credential on a legacy host).');return this.hostRequest(c.address,route,this.code,c.databaseId,body,limit);}
  browse(){return this.exclusive(()=>this.browseNow());}
  catalogueView(includePictures=true){
    const c=this.state().connection,cache=this.state().catalogue;
    const same=!!c&&cache?.databaseId===c.databaseId;
    const links=new Map(this.db.data.slotcars.filter(x=>c&&x.paddock?.databaseId===c.databaseId).map(x=>[x.paddock.carId,x])),pictures=new Map(this.catalog.map(x=>[x.id,x.picture]));
    // Upgrades may already have linked profiles but no full catalogue cache yet.
    const rows=same?cache.cars:[...links.values()].filter(x=>!x.paddock.archived).map(x=>({id:x.paddock.carId,name:x.paddock.name||x.model||'Unnamed car',maker:x.brand||'',model:x.model||'',raceClass:this.db.data.raceclasses.find(k=>k.id===x.raceClass)?.name||''}));
    if(this.images){const ids=new Set(rows.map(row=>row.id));for(const id of this.images.keys())if(!ids.has(id))this.images.delete(id);}
    return {connection:c,connected:this.connected&&!!this.code,lastUpdated:same?cache.updatedAt:null,
      cars:rows.map(row=>{const linked=links.get(row.id),picture=pictures.get(row.id)||linked?.picture||'',image=this.catalogueImage(row.id,picture,c.databaseId);return {...row,linked:linked?.id||'',picture:includePictures?image.picture:'',pictureKey:image.key,capturedAt:linked?.paddock.configuration?.capturedAt||null};}),
      error:this.catalogueError||'',nextCheckAt:this.nextCatalogueCheck||0};
  }
  catalogueImage(id,picture,databaseId){
    this.images??=new Map();const old=this.images.get(id);
    if(old?.source===picture&&old.databaseId===databaseId)return old;
    const valid=/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(picture);
    const image={source:picture,picture:valid?picture:'',databaseId,key:valid?String(this.imageSequence=(this.imageSequence||0)+1):''};
    this.images.set(id,image);return image;
  }
  picture(id,key){
    const image=this.images?.get(id);
    return image&&image.databaseId===this.state().connection?.databaseId&&image.key===key?image.picture:'';
  }
  async catalogue(force=false,includePictures=true){
    if(typeof force!=='boolean')throw Error('Invalid catalogue refresh.');
    if(this.busy||this.isRacing?.())return this.catalogueView(includePictures);
    if(!this.code||!this.state().connection){this.catalogueError=this.state().connection?'Offline — reconnect to refresh. Previously selected cars remain available.':'Connect to Paddock to browse its cars.';return this.catalogueView(includePictures);}
    if(!force&&Date.now()<(this.nextCatalogueCheck||0))return this.catalogueView(includePictures);
    return this.exclusive(async()=>{
      try{
        const c=this.state().connection,s=await this.call('/v1/status');
        if(s.id!==c.databaseId)throw Object.assign(Error('Paddock database identity changed. Reconnect to the original database.'),{code:'DATABASE_MISMATCH'});
        if(!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('Invalid Paddock database revision.');
        const cache=this.state().catalogue;
        const publicRevision=Number.isSafeInteger(s.catalogueRevision)&&s.catalogueRevision>=0?s.catalogueRevision:null;
        const changed=publicRevision!==null&&Number.isSafeInteger(cache?.catalogueRevision)?cache.catalogueRevision!==publicRevision:cache?.revision!==s.revision;
        if(force||cache?.databaseId!==c.databaseId||changed)await this.browseNow();
        this.connected=true;this.catalogueError='';this.catalogueFailures=0;this.nextCatalogueCheck=Date.now()+30000;
      }catch(e){
        this.connected=false;this.catalogueError=e.message;
        if(['UNAUTHENTICATED','DATABASE_MISMATCH'].includes(e.code))this.code='';
        this.catalogueFailures=(this.catalogueFailures||0)+1;
        this.nextCatalogueCheck=Math.max(this.retryAt(this.state().connection?.address),Date.now()+Math.min(300000,30000*2**Math.min(this.catalogueFailures,4)));
      }
      return this.catalogueView(includePictures);
    });
  }
  async browseNow(attempt=0){const c=this.state().connection;if(!c)throw Error('Connect to Paddock first.');let out=[],offset=0,revision=null,catalogueRevision=null,total=0,complete=false;
    for(let page=0;page<401;page++){
      let v;try{v=await this.call('/v1/collection'+(offset?'?offset='+offset+'&revision='+revision+'&database='+encodeURIComponent(c.databaseId):''),undefined,32*1024*1024);}catch(e){if(e.httpStatus===409&&attempt<1)return this.browseNow(attempt+1);throw e;}
      if(v.id===c.databaseId&&Number.isInteger(v.revision)&&revision!==null&&v.revision!==revision&&attempt<1)return this.browseNow(attempt+1);
      if(v.id!==c.databaseId||!Number.isInteger(v.revision)||revision!==null&&v.revision!==revision)throw Error('Paddock changed during the refresh. Refresh the catalogue again.');
      const pageRevision=Number.isSafeInteger(v.catalogueRevision)&&v.catalogueRevision>=0?v.catalogueRevision:null;
      if(offset&&pageRevision!==catalogueRevision)throw Error('Paddock catalogue changed during the refresh.');
      catalogueRevision=pageRevision;
      if(!Array.isArray(v.cars))throw Error('Invalid Paddock collection.');revision=v.revision;total+=(v[RESPONSE_BYTES]??Buffer.byteLength(JSON.stringify(v)));if(total>200*1024*1024)throw Error('Paddock collection exceeds 200 MiB.');
      out.push(...v.cars);if(out.length>10000)throw Error('Too many Paddock cars.');if(v.nextOffset===null||v.nextOffset===undefined){complete=true;break;}if(!Number.isInteger(v.nextOffset)||v.nextOffset<=offset)throw Error('Invalid Paddock pagination.');offset=v.nextOffset;
    }
    if(!complete)throw Error('Paddock catalogue exceeded the pagination limit; no partial catalogue was loaded.');
    if(new Set(out.map(c=>c.id)).size!==out.length||out.some(c=>!ID.test(c.id)||typeof c.name!=='string'))throw Error('Invalid or duplicate car identities.');
    if(out.some(c=>['maker','marque','model','scale','raceClass','picture','availability'].some(k=>c[k]!=null&&typeof c[k]!=='string')||c.picture&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(c.picture)))throw Error('Invalid public car details in Paddock catalogue.');
    const summaries=out.map(c=>({id:c.id,name:c.name,maker:c.maker||'',model:c.model||'',raceClass:c.raceClass||''}));
    const previous=this.state().catalogue,changes=[],classes=new Set(this.db.data.raceclasses.map(x=>x.id));
    // Publish only a complete catalogue. Never touch a race's pinned configuration.
    const remoteById=new Map(out.map(x=>[x.id,x]));
    try{
      for(const row of this.db.data.slotcars.filter(x=>x.paddock?.databaseId===c.databaseId)){
        const remote=remoteById.get(row.paddock.carId);
        if(remote){
          const patch=this.patch({car:remote,databaseId:c.databaseId,configuration:{technical:remote.technical}});
          if(row.paddock.configuration)patch.paddock.configuration=row.paddock.configuration;else delete patch.paddock.configuration;
          if(COPY_FIELDS.every(key=>row[key]===patch[key])&&Object.keys(patch.paddock).every(key=>row.paddock[key]===patch.paddock[key]))continue;
          changes.push({row,previous:{...row}});Object.assign(row,patch);
        }else if(!row.paddock.archived){changes.push({row,previous:{...row}});row.paddock={...row.paddock,archived:true};}
      }
      this.state().catalogue={databaseId:c.databaseId,revision,catalogueRevision,updatedAt:new Date().toISOString(),cars:summaries};
      await this.commit(changes.map(x=>x.row));
    }catch(e){this.state().catalogue=previous;changes.forEach(x=>{for(const key of [...COPY_FIELDS,'paddock']){if(Object.hasOwn(x.previous,key))x.row[key]=x.previous[key];else delete x.row[key];}this.db.touch(x.row);});this.db.data.raceclasses=this.db.data.raceclasses.filter(x=>classes.has(x.id));throw e;}
    this.catalog=out;this.catalogueError='';this.nextCatalogueCheck=Date.now()+30000;
    return this.catalogueView(false).cars;
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
  async linkNow(carId,localId){if(!this.state().connection?.timing)throw Error('This Paddock host needs the Timing v1 update before cars can be linked.');const p=await this.profile(carId);if(p.car.archived)throw Object.assign(Error('This car is archived in Paddock.'),{code:'CAR_ARCHIVED'});const existing=this.db.data.slotcars.find(c=>c.paddock?.databaseId===p.databaseId&&c.paddock.carId===carId);
    if(existing&&localId&&existing.id!==localId)throw Error('This Paddock car is already linked to another Timing car.');let row=existing||this.db.data.slotcars.find(c=>c.id===localId);if(localId&&!row)throw Error('Local car no longer exists.');if(row?.paddock&&(row.paddock.carId!==carId||row.paddock.databaseId!==p.databaseId))throw Error('This Timing car is already linked.');
    const previous=row?{...row}:null,classes=new Set(this.db.data.raceclasses.map(c=>c.id)),createdClasses=[];try{const patch=this.patch(p);createdClasses.push(...this.db.data.raceclasses.filter(c=>!classes.has(c.id)).map(c=>c.id));if(row)Object.assign(row,patch);else{row={id:crypto.randomUUID(),custom:{},lapsDriven:0,...patch};this.db.data.slotcars.push(row);}await this.commit([row]);return row;}catch(e){if(previous){for(const key of [...COPY_FIELDS,'paddock']){if(Object.hasOwn(previous,key))row[key]=previous[key];else delete row[key];}}else this.db.data.slotcars=this.db.data.slotcars.filter(c=>c!==row);this.db.data.raceclasses=this.db.data.raceclasses.filter(c=>!createdClasses.includes(c.id));if(row)this.db.touch(row);throw e;}
  }
  refresh(){return this.exclusive(()=>this.refreshNow());}
  async refreshNow(){const linked=this.db.data.slotcars.filter(c=>c.paddock?.databaseId===this.state().connection?.databaseId);for(const c of linked){try{await this.linkNow(c.paddock.carId,c.id);}catch(e){if(['CAR_NOT_FOUND','CAR_ARCHIVED'].includes(e.code)){const before=c.paddock;c.paddock={...before,archived:true};try{await this.commit([c]);}catch(saveError){c.paddock=before;this.db.touch(c);throw saveError;}}else throw e;}}return this.status();}
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
          const knownClass=this.db.data.raceclasses.find(x=>x.id===c.raceClass)?.name||'';
          if(knownClass.trim().toLocaleLowerCase()!==(p.car.raceClass||'').trim().toLocaleLowerCase())throw Object.assign(Error(c.paddock.name+' changed race class in Paddock. Refresh the Paddock Database and check the car selection before starting.'),{code:'CAR_CLASS_CHANGED'});
          configuration=p.configuration;fresh=true;updates.push({car:c,before:c.paddock.configuration,after:configuration});
        }catch(e){
          if(['CAR_NOT_FOUND','CAR_CLASS_CHANGED','DATABASE_MISMATCH'].includes(e.code)){if(e.code==='DATABASE_MISMATCH'){this.code='';this.connected=false;}throw e;}
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
      try{await this.commit(updates.map(u=>u.car));}catch(e){updates.forEach(u=>{u.car.paddock.configuration=u.before;this.db.touch(u.car);});throw e;}
    }
    return {captures,warnings,heats:[]};
  }
  schedule(delay=30000){clearTimeout(this.timer);if(!this.stopped&&this.code)this.timer=setTimeout(()=>this.flush().catch(()=>{}),Math.max(delay,this.retryAt(this.state().connection?.address)-Date.now())).unref();}
  async flush(){if(this.busy||!this.code||this.stopped||this.isRacing?.()){this.schedule();return this.status();}this.busy=true;let retry=30000;
    try{await this.db.saved();const c=this.state().connection;if(!this.deliveries().some(d=>d.status==='pending'&&d.payload?.databaseId===c?.databaseId))return this.status();const s=await this.call('/v1/status');if(s.id!==c.databaseId)throw Object.assign(Error('Paddock database identity changed.'),{code:'DATABASE_MISMATCH'});if(!s.permissions?.timingResults)throw Error('This connection cannot send results. Use the Dealership password. On a legacy Paddock host, enable Allow Timing results and use its dedicated Timing credential.');
      for(const d of this.deliveries().filter(d=>d.status==='pending'&&d.payload?.databaseId===c.databaseId)){
        if(this.isRacing?.())break;
        try{const p=d.payload;await this.commit(this.deliveryRows(d));if(this.stopped)return this.status();if(this.isRacing?.())break;const r=checkedReceipt(await this.call('/v1/timing/sessions',p),p);if(this.stopped)return this.status();
          // If the local result was corrected/deleted during upload, only acknowledge this exact object.
          d.receipt=r;d.status='sent';d.error='';d.receiptCheckedAt=new Date().toISOString();d.receiptCheckError='';await this.commit(this.deliveryRows(d));
        }catch(e){d.error=e.message;d.status=TERMINAL_CODES.has(e.code)?'attention':'pending';await this.commit(this.deliveryRows(d));throw e;}
      }this.connected=true;this.error='';
    }catch(e){this.connected=false;this.error=e.message;retry=60000;if(['DATABASE_MISMATCH','UNAUTHENTICATED'].includes(e.code)){this.code='';}}
    finally{this.busy=false;this.schedule(retry);}return this.status();
  }
  async retry(){await this.exclusive(async()=>{const rows=[];let changed=false;for(const d of this.deliveries())if(d.payload&&d.status==='attention'){d.status='pending';rows.push(...this.deliveryRows(d));changed=true;}if(changed)await this.commit(rows);});return this.flush();}
  stop(){this.stopped=true;clearTimeout(this.timer);this.code='';}
}
function canonical(v){return Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);}
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
module.exports={Paddock,privateIP,address,request,discover,COPY_FIELDS,hash,credential,retryDelay};
