// Trusted LAN client. Network work runs in main, never in the lap timing path.
const http=require('node:http'),net=require('node:net'),dgram=require('node:dgram'),os=require('node:os'),crypto=require('node:crypto');
const Records=require('./paddockrecords');
const RESPONSE_BYTES=Symbol('responseBytes');
const ID=/^[a-zA-Z0-9_-]{1,100}$/;
const TERMINAL_CODES=new Set(['INVALID_JSON','INVALID_PAYLOAD','SUMMARY_MISMATCH','DATABASE_REQUIRED','BROWSER_ORIGIN_FORBIDDEN','TIMING_PERMISSION_REQUIRED','CAR_NOT_FOUND','NOT_FOUND','DATABASE_MISMATCH','CONFIGURATION_MISMATCH','CONFIGURATION_INVALID','REVISION_CONFLICT','STALE_REVISION','PAYLOAD_TOO_LARGE','CONTENT_TYPE_REQUIRED','CONTENT_ENCODING_UNSUPPORTED','UNSUPPORTED_VERSION','CAPACITY_EXCEEDED','RECEIPT_MISMATCH','RECOVERY_CHANGED','OPERATION_CONFLICT','HISTORY_GUARD_REQUIRED','HISTORY_REVIEW_REQUIRED','UNSUPPORTED_COVERAGE','UPLOAD_CONFLICT','CHUNK_CONFLICT','HASH_MISMATCH']);
const COPY_FIELDS=['brand','manufacturer','model','scale','motor','gearing','tyres','weight','picture','raceClass'];
function validateProfile(p){
  if(!p||p.integrationVersion!==1||typeof p.databaseId!=='string'||!p.databaseId||!p.car||typeof p.car.id!=='string'||!ID.test(p.car.id)||p.configuration?.carId!==p.car.id||p.configuration.databaseId!==p.databaseId||!/^[a-f0-9]{64}$/.test(p.configuration.signature)||!Number.isFinite(Date.parse(p.configuration.capturedAt)))throw Error('Invalid Paddock car profile.');
  if(p.car.picture&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(p.car.picture))throw Error('Unsupported Paddock picture.');
}
function profilePatch(profile,classes){const c=profile.car,t=profile.configuration.technical||{};let raceClass='';if(c.raceClass?.trim()){let cl=classes.find(x=>x.name.trim().toLocaleLowerCase()===c.raceClass.trim().toLocaleLowerCase());if(!cl){cl={id:crypto.randomUUID(),name:c.raceClass.trim(),color:'#8295a6',custom:{}};classes.push(cl);}raceClass=cl.id;}
    return {brand:c.maker||'',manufacturer:c.marque||'',model:c.model||c.name,scale:c.scale||'',motor:t.motor||'',gearing:[t.pinion,t.gear].filter(Boolean).join(' / '),tyres:t.rearTyres||'',weight:t.weight||'',picture:c.picture||'',raceClass,
      paddock:{databaseId:profile.databaseId,carId:c.id,name:c.name,archived:!!c.archived,availability:c.availability||'',configuration:profile.configuration,...(Object.hasOwn(profile,'media')?{mediaHash:profile.media?.hash||''}:{})}};
  }
function checkedReceipt(r,p){
  if(!r?.ok||r.databaseId!==p.databaseId||r.sourceId!==p.source.id||r.sessionId!==p.sessionId||r.revision!==p.revision||r.state!==p.state||r.contentHash!==(require('./paddock-rich-delivery').isRich(p)?require('./paddock-rich-delivery').tuple(p).contentHash:hash(p))||r.warnings!==undefined&&(!Array.isArray(r.warnings)||r.warnings.length>512||r.warnings.some(w=>!w||typeof w.code!=='string'||w.code.length>100||typeof w.carId!=='string'||!ID.test(w.carId))))throw Object.assign(Error('Paddock receipt does not match this result. Check the original database and result revision; no local result was replaced.'),{code:'RECEIPT_MISMATCH'});
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
const listenerKey=base=>{const u=new URL(address(base));if(u.hostname==='localhost')u.hostname='127.0.0.1';return u.origin;};
function privateIP(ip){if(net.isIP(ip)!==4)return false;const [a,b]=ip.split('.').map(Number);return a===127||a===10||a===192&&b===168||a===172&&b>=16&&b<=31;}
function address(input){const u=new URL(String(input).includes('://')?input:'http://'+input);if(u.protocol!=='http:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(privateIP(u.hostname)||u.hostname==='localhost'))throw Error('Enter a local IPv4 address and port, for example 192.168.1.20:51234.');if(!u.port)throw Error('Include the port displayed by Paddock.');return u.origin;}
function request(base,route,code,databaseId,body,limit=16*1024*1024,instanceId,recoveryId,extension='scalable-v1',method){return new Promise((resolve,reject)=>{
  const raw=body===undefined?null:JSON.stringify(body);if(raw&&Buffer.byteLength(raw)>8*1024*1024)return reject(Object.assign(Error('Session exceeds Paddock’s 8 MiB limit.'),{code:'PAYLOAD_TOO_LARGE'}));
  const u=new URL(route,address(base));if(u.origin!==address(base))return reject(Error('Unexpected host address.'));
  const req=http.request(u,{method:method||(raw?'POST':'GET'),headers:{Authorization:'Bearer '+code,...(databaseId?{'X-SlotForge-Database':databaseId}:{}),...(instanceId?{'X-SlotForge-Instance':instanceId}:{}),...(recoveryId?{'X-SlotForge-Recovery':recoveryId}:{}),'X-SlotForge-Pages':'1',...(instanceId||route==='/v1/status'?{'X-SlotForge-Extensions':extension}:{}),...(raw?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}:{})}},res=>{
    if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();return reject(Error('Compressed Paddock responses are unsupported.'));}
    let size=0;const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>limit)res.destroy(Error('Paddock response is too large.'));else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{try{if(res.statusCode===429){const e=Error('Paddock has temporarily limited connection attempts. Wait before retrying; saved results remain queued.');e.code='AUTH_RATE_LIMITED';e.httpStatus=429;e.retryAfterMs=retryDelay(res.headers['retry-after']);throw e;}const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(res.statusCode!==200){const e=Error(String(value.error||'Paddock returned HTTP '+res.statusCode).replaceAll(code||'\x00','[redacted]'));if(value.details&&Buffer.byteLength(JSON.stringify(value.details))<131072)e.details=value.details;for(const k of ['databaseId','recoveryId','current'])if(Object.hasOwn(value,k))e[k]=value[k];e.code=value.code||'HTTP_'+res.statusCode;e.httpStatus=res.statusCode;if(res.statusCode===503&&(res.headers['retry-after']||value.code==='HOST_MIGRATING'))e.retryAfterMs=retryDelay(res.headers['retry-after']);throw e;}if(value&&typeof value==='object')Object.defineProperty(value,RESPONSE_BYTES,{value:size});resolve(value);}catch(e){reject(e);}});
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
  constructor(db,{storage,deliveryStore}={}){this.storage=storage||new(require('./paddock-storage').JsonPaddockStorage)(db);this.code='';this.connected=false;this.error='';this.catalog=[];this.busy=false;this.stopped=false;this.timer=null;this.cooldowns=new Map();this.migrationCooldowns=new Map();this.deliveryStore=deliveryStore||new(require('./json-delivery-store'))(db);this.delivery=new(require('./delivery-service'))(this.deliveryStore,{call:(...args)=>this.call(...args),historyCapability:()=>this.historyCapability,isRacing:()=>!!this.isRacing?.(),isStopped:()=>this.stopped||this.quiescing||!this.code});}
  async connection(){const value=await this.storage.connection();this.lastConnection=value.connection;return value;}
  active(){if(this.stopped)throw Object.assign(Error('Paddock connection stopped.'),{code:'PADDOCK_STOPPED'});}
  cooldownsNow(){
    for(const map of [this.cooldowns,this.migrationCooldowns])for(const [key,until] of map)if(until<=Date.now())map.delete(key);
    return [...this.cooldowns].map(([host,until])=>({host,until,code:'AUTH_RATE_LIMITED'})).concat([...this.migrationCooldowns].map(([base,until])=>({host:hostKey(base),address:base,until,code:'HOST_MIGRATING'})));
  }
  retryAt(base){this.cooldownsNow();return base?Math.max(this.cooldowns.get(hostKey(base))||0,this.migrationCooldowns.get(listenerKey(base))||0):0;}
  async hostRequest(base,route,code,databaseId,body,limit,instanceId,recoveryId,extension,method){
    const until=this.retryAt(base);
    if(until){const reason=this.migrationCooldowns.get(listenerKey(base))===until?'HOST_MIGRATING':'AUTH_RATE_LIMITED';throw Object.assign(Error((reason==='HOST_MIGRATING'?'Paddock is changing sharing mode. Connection cooldown: try again in ':'Paddock connection cooldown: try again in ')+Math.ceil((until-Date.now())/1000)+' seconds. Saved results remain queued.'),{code:reason,retryAt:until,retryAfterMs:until-Date.now()});}
    try{return await request(base,route,code,databaseId,body,limit,instanceId,recoveryId,extension,method);}catch(e){
      if(e.httpStatus===429||e.httpStatus===503&&e.code==='HOST_MIGRATING'){
        // Authentication limits apply to the host; migration only stops its old listener.
        // A separate trusted local service on the same computer remains usable.
        const migration=e.code==='HOST_MIGRATING',key=migration?listenerKey(base):hostKey(base),map=migration?this.migrationCooldowns:this.cooldowns;
        if(map.size>=100&&!map.has(key))map.delete(map.keys().next().value);
        map.set(key,Date.now()+e.retryAfterMs);e.retryAt=map.get(key);
        if(this.lastConnection&&(migration?listenerKey(this.lastConnection.address)===key:hostKey(this.lastConnection.address)===key)){this.connected=false;this.error=e.message;this.schedule();}
      }
      throw e;
    }
  }
  async exclusive(task){if(this.busy)throw Error('Wait for the current Paddock operation.');this.busy=true;try{return await task();}finally{this.busy=false;}}
  async status(){const data=await this.storage.summary();return {...data,connected:this.connected,hasCode:!!this.code,error:this.error,busy:this.busy,sharedCars:!!this.localCapabilities?.sharedCars,localStartup:!!this.sharedStarting,cooldowns:this.cooldownsNow()};}
  checkReceipt(sessionId){return this.exclusive(async()=>{
    if(this.isRacing?.())throw Error('Finish the race before checking Paddock results.');
    const state=await this.storage.summary(),c=state.connection,d=state.deliveries.find(d=>d.status==='sent'&&d.sessionId===sessionId&&d.databaseId===c?.databaseId);
    if(!d||!ID.test(sessionId))throw Error('Choose a delivered result from the connected Paddock database.');
    await this.delivery.checkReceipt(d.key);return this.status();
  });}
  async connect(input){
    if(input?.mode==='local')return this.connectLocal(input);
    if((await this.connection()).connection?.mode==='local')throw Error('Forget the local library before choosing a network connection.');
    if(this.busy)throw Error('Wait for the current Paddock operation.');this.busy=true;
    try{const base=address(input.address),code=credential(input.code);
      const s=await this.hostRequest(base,'/v1/status',code);if(!ID.test(s.id)||typeof s.name!=='string')throw Error('Invalid Paddock host identity.');
      this.active();const before=await this.connection(),old=before.connection;if(old&&old.databaseId!==s.id)throw Error('This is a different Paddock database. Disconnect and forget the old host before pairing another.');
      await this.storage.setConnection({address:base,databaseId:s.id,name:s.name,results:!!s.permissions?.timingResults,timing:!!s.capabilities?.timing?.versions?.includes(1)},before.revision);await this.connection();
      if(this.stopped)return this.status();this.negotiate(s);this.code=code;this.connected=true;this.error='';this.catalogueError='';this.nextCatalogueCheck=0;this.catalogueFailures=0;this.schedule();return this.status();
    }finally{this.busy=false;}
  }
  disconnect(forget=false){return this.exclusive(async()=>{this.closeLocalEvents?.();this.localDescriptor=null;this.code='';this.connected=false;this.catalog=[];this.images?.clear();clearTimeout(this.timer);const before=await this.connection();if(forget){await this.storage.sharedChange({action:'policy',disabled:true});await this.storage.setConnection(null,before.revision);}else if(before.connection?.mode==='local')await this.storage.setConnection({...before.connection,automatic:false},before.revision);await this.connection();this.error='';return this.status();});}
  async call(route,body,limit,recoveryId,method){this.active();const {connection:c}=await this.connection();if(c?.mode==='local')return this.localCall(c,route,body,limit,recoveryId,method);if(!c||!this.code)throw Error('Connect with the current Paddock Dealership password first (or a Timing credential on a legacy host).');return this.hostRequest(c.address,route,this.code,c.databaseId,body,limit);}
  negotiate(status){
    const supported=status.capabilities?.scalable?.version===1&&status.capabilities.scalable.root==='/v1/scalable';
    if(!supported)this.scalable=null;
    else if(this.scalable?.databaseId!==status.id)this.scalable=new(require('./paddock-scalable').Scalable)(async(...args)=>{
      if(this.isRacing?.())throw Error('Paddock refresh paused during racing.');
      if((await this.connection()).connection?.databaseId!==status.id)throw Object.assign(Error('Paddock database identity changed.'),{code:'DATABASE_MISMATCH'});
      return this.call(...args);
    },status.id);
  }
  browse(){return this.exclusive(async()=>{if(this.scalable){const s=await this.call('/v1/status');if(s.id!==(await this.connection()).connection.databaseId)throw Error('Paddock database identity changed.');try{await this.browseScalable(s);return (await this.catalogueView(false)).cars;}catch(e){if(!['STORAGE_REQUIRED','NOT_FOUND','HTTP_404'].includes(e.code))throw e;this.scalable=null;}}return this.browseNow();});}
  async catalogueView(includePictures=true){
    const {connection:c}=await this.connection(),cache=await this.storage.cache(),same=!!c&&cache?.databaseId===c.databaseId;
    const linked=c?await this.storage.cars({databaseId:c.databaseId}):[],links=new Map(linked.map(x=>[x.value.paddock.carId,x])),pictures=new Map(this.catalog.map(x=>[x.id,x.picture]));
    const rows=same?cache.cars:linked.filter(x=>!x.value.paddock.archived).map(({value:x,raceClassName})=>({id:x.paddock.carId,name:x.paddock.name||x.model||'Unnamed car',maker:x.brand||'',model:x.model||'',raceClass:raceClassName}));
    if(this.images){const ids=new Set(rows.map(row=>row.id));for(const id of this.images.keys())if(!ids.has(id))this.images.delete(id);}
    const cars=[];for(const row of rows){if(row.archived)continue;const linked=links.get(row.id);
      if(Object.hasOwn(row,'media')){
        const key=row.media?.hash||'';let picture=includePictures?this.scalable?.cached(row.media)||'':'';
        if(includePictures&&!picture&&key&&linked?.value.paddock.mediaHash===key)picture=await this.storage.picture(linked.value.id,linked.pictureKey);
        this.images??=new Map();this.images.set(row.id,{databaseId:c.databaseId,key,media:row.media,localId:linked?.value.id,localKey:linked?.pictureKey,localHash:linked?.value.paddock.mediaHash});
        cars.push({...row,linked:linked?.value.id||'',picture,pictureKey:key,capturedAt:linked?.value.paddock.configuration?.capturedAt||null});continue;
      }
      const picture=pictures.get(row.id)||'',image=this.catalogueImage(row.id,picture,c.databaseId);
      if(!picture&&linked?.pictureKey){const source=linked.value.id+':'+linked.pictureKey;if(image.localSource!==source){image.key=String(this.imageSequence=(this.imageSequence||0)+1);image.localSource=source;image.localId=linked.value.id;image.localKey=linked.pictureKey;}}
      else {if(image.localSource&&!picture)image.key='';delete image.localId;delete image.localKey;delete image.localSource;}
      cars.push({...row,linked:linked?.value.id||'',picture:includePictures?(image.localId?await this.storage.picture(image.localId,image.localKey):image.picture):'',pictureKey:image.key,capturedAt:linked?.value.paddock.configuration?.capturedAt||null});
    }
    return {connection:c,sharedCars:!!this.localCapabilities?.sharedCars,connected:this.connected&&!!this.code,lastUpdated:same?cache.updatedAt:null,cars,error:this.catalogueError||'',nextCheckAt:this.nextCatalogueCheck||0};
  }
  catalogueImage(id,picture,databaseId){
    this.images??=new Map();const old=this.images.get(id);
    if(old?.source===picture&&old.databaseId===databaseId)return old;
    const valid=/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(picture);
    const image={source:picture,picture:valid?picture:'',databaseId,key:valid?String(this.imageSequence=(this.imageSequence||0)+1):''};
    this.images.set(id,image);return image;
  }
  async picture(id,key){const {connection}=await this.connection(),image=this.images?.get(id);if(!image||image.databaseId!==connection?.databaseId||image.key!==key)return '';
    if(Object.hasOwn(image,'media')){
      if(!image.media)return '';
      if(image.localId&&image.localHash===key){const local=await this.storage.picture(image.localId,image.localKey);if(local)return local;}
      if(!this.code||this.isRacing?.()||!this.scalable)return this.scalable?.cached(image.media)||'';
      try{const value=await this.scalable.picture(image.media);return !this.stopped&&this.images?.get(id)?.key===key&&this.lastConnection?.databaseId===image.databaseId?value:'';}catch(e){this.catalogueError=e.message;if(['MEDIA_CHANGED','CAR_NOT_FOUND'].includes(e.code))this.nextCatalogueCheck=0;return '';}
    }
    return image.localId?this.storage.picture(image.localId,image.localKey):image.picture;}
  async catalogue(force=false,includePictures=true){
    if(typeof force!=='boolean')throw Error('Invalid catalogue refresh.');
    if(this.busy||this.isRacing?.())return this.catalogueView(includePictures);
    const {connection}=await this.connection();if(!this.code||!connection){this.catalogueError=connection?'Offline — reconnect to refresh. Previously selected cars remain available.':'Connect to Paddock to browse its cars.';return this.catalogueView(includePictures);}
    if(!force&&Date.now()<(this.nextCatalogueCheck||0))return this.catalogueView(includePictures);
    if(this.busy||this.isRacing?.())return this.catalogueView(includePictures);
    return this.exclusive(async()=>{
      try{
        const {connection:c}=await this.connection(),s=await this.call('/v1/status');this.active();
        if(s.id!==c.databaseId)throw Object.assign(Error('Paddock database identity changed. Reconnect to the original database.'),{code:'DATABASE_MISMATCH'});
        if(!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('Invalid Paddock database revision.');
        this.negotiate(s);const cache=await this.storage.cache();
        const publicRevision=Number.isSafeInteger(s.catalogueRevision)&&s.catalogueRevision>=0?s.catalogueRevision:null;
        const changed=publicRevision!==null&&Number.isSafeInteger(cache?.catalogueRevision)?cache.catalogueRevision!==publicRevision:cache?.revision!==s.revision;
        if(this.scalable){try{await this.browseScalable(s);}catch(e){if(!['STORAGE_REQUIRED','NOT_FOUND','HTTP_404'].includes(e.code))throw e;this.scalable=null;await this.browseNow();}}
        else if(force||cache?.databaseId!==c.databaseId||changed)await this.browseNow();
        this.connected=true;this.catalogueError='';this.catalogueFailures=0;this.nextCatalogueCheck=Date.now()+30000;
      }catch(e){
        this.connected=false;this.catalogueError=e.message;
        if(['UNAUTHENTICATED','DATABASE_MISMATCH'].includes(e.code))this.code='';
        this.catalogueFailures=(this.catalogueFailures||0)+1;
        this.nextCatalogueCheck=Math.max(this.retryAt(this.lastConnection?.address),Date.now()+Math.min(300000,30000*2**Math.min(this.catalogueFailures,4)));
      }
      return this.catalogueView(includePictures);
    });
  }
  async browseScalable(status){
    const connection=await this.connection(),databaseId=connection.connection.databaseId,cache=await this.storage.cache(),api=this.scalable;
    if(status.id!==databaseId||!Number.isSafeInteger(status.revision)||status.revision<0)throw Error('Invalid Paddock database status.');
    const linked=await this.storage.cars({databaseId}),profiles=new Map();let rows,cursor,affected;
    if(cache?.databaseId===databaseId&&cache.scalableCursor){
      const delta=await api.changes(cache.scalableCursor);
      if(!delta.reset){
        if(!delta.entries.size&&delta.cursor===cache.scalableCursor)return;
        const map=new Map(cache.cars.map(c=>[c.id,c]));affected=new Set(delta.entries.keys());
        for(const [id,operation]of delta.entries){
          if(operation==='remove'){map.delete(id);continue;}
          try{const p=await api.profile(id);profiles.set(id,p);map.set(id,require('./paddock-scalable').car({...p.car,revision:p.configuration.carRevision,media:p.media}));}
          catch(e){if(e.code==='CAR_NOT_FOUND')map.delete(id);else throw e;}
        }
        rows=[...map.values()];cursor=delta.cursor;
      }
    }
    if(!rows){const listing=await api.listing();rows=listing.cars;cursor=listing.cursor;affected=new Set([...rows.map(c=>c.id),...linked.map(c=>c.value.paddock.carId)]);}
    const byId=new Map(rows.map(c=>[c.id,c])),updates=[];
    for(const row of linked){
      const id=row.value.paddock.carId;if(!affected.has(id))continue;const remote=byId.get(id);
      if(!remote||remote.archived){if(!row.value.paddock.archived)updates.push({recordId:row.value.id,expectedRevision:row.revision,archived:true});continue;}
      let p=profiles.get(id);
      if(!p){try{p=await api.profile(id);}catch(e){if(e.code!=='CAR_NOT_FOUND')throw e;byId.delete(id);updates.push({recordId:row.value.id,expectedRevision:row.revision,archived:true});continue;}}
      // A profile can be newer than its listing. The older cursor is retained so
      // the next poll still observes that change (including a changed photo).
      byId.set(id,require('./paddock-scalable').car({...p.car,revision:p.configuration.carRevision,media:p.media}));
      if(p.car.archived){updates.push({recordId:row.value.id,expectedRevision:row.revision,archived:true});continue;}
      // Catalogue work stays photo-free even when thousands of cars are linked.
      // The saved picture belongs to its old hash until selection refreshes it;
      // visible cards can request the new hash independently in bounded chunks.
      updates.push({recordId:row.value.id,expectedRevision:row.revision,profile:p,preservePicture:true});
    }
    this.active();if(this.isRacing?.())throw Error('Paddock refresh paused during racing.');await this.storage.catalogue(databaseId,{databaseId,revision:status.revision,catalogueRevision:status.catalogueRevision??null,scalableCursor:cursor,updatedAt:new Date().toISOString(),cars:[...byId.values()]},updates,connection.revision);
    this.active();this.catalog=[];
  }
  async browseNow(attempt=0){const connection=await this.connection(),c=connection.connection;if(!c)throw Error('Connect to Paddock first.');let out=[],offset=0,revision=null,catalogueRevision=null,total=0,complete=false;
    for(let page=0;page<401;page++){
      let v;try{v=await this.call('/v1/collection'+(offset?'?offset='+offset+'&revision='+revision+'&database='+encodeURIComponent(c.databaseId):''),undefined,32*1024*1024);}catch(e){if(e.httpStatus===409&&attempt<1)return this.browseNow(attempt+1);throw e;}
      if(v.id===c.databaseId&&Number.isSafeInteger(v.revision)&&revision!==null&&v.revision!==revision&&attempt<1)return this.browseNow(attempt+1);
      if(v.id!==c.databaseId||!Number.isSafeInteger(v.revision)||v.revision<0||revision!==null&&v.revision!==revision)throw Error('Paddock changed during the refresh. Refresh the catalogue again.');
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
    this.active();const linked=await this.storage.cars({databaseId:c.databaseId}),remoteById=new Map(out.map(x=>[x.id,x])),updates=[];
    for(const {value:row,revision}of linked){const remote=remoteById.get(row.paddock.carId);if(remote)updates.push({recordId:row.id,expectedRevision:revision,catalogueCar:remote});else if(!row.paddock.archived)updates.push({recordId:row.id,expectedRevision:revision,archived:true});}
    await this.storage.catalogue(c.databaseId,{databaseId:c.databaseId,revision,catalogueRevision,updatedAt:new Date().toISOString(),cars:summaries},updates,connection.revision);this.active();
    this.catalog=out;this.catalogueError='';this.nextCatalogueCheck=Date.now()+30000;
    return (await this.catalogueView(false)).cars;
  }
  async profile(carId,includePicture=true){if(!ID.test(carId))throw Error('Invalid car ID.');let p;
    if(this.scalable){try{p=await this.scalable.profile(carId);if(includePicture)p.car.picture=await this.scalable.picture(p.media);}catch(e){if(!['STORAGE_REQUIRED','NOT_FOUND','HTTP_404'].includes(e.code))throw e;this.scalable=null;}}
    if(!p)p=await this.call('/v1/timing/cars/'+encodeURIComponent(carId));
    if(p.integrationVersion!==1||p.databaseId!==(await this.connection()).connection?.databaseId||p.car?.id!==carId||p.configuration?.carId!==carId||p.configuration.databaseId!==p.databaseId||!/^[a-f0-9]{64}$/.test(p.configuration.signature)||!Number.isFinite(Date.parse(p.configuration.capturedAt)))throw Error('Invalid Paddock car profile.');
    if(p.car.picture&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(p.car.picture))throw Error('Unsupported Paddock picture.');return p;
  }
  link(carId,localId){return this.exclusive(async()=>{
    if(localId&&(await this.connection()).connection?.mode==='local'){
      const row=(await this.storage.cars({ids:[localId]}))[0];
      if(row&&!row.value.paddock)throw Error('Use Share existing Timing cars to request this link through Paddock’s Review screen.');
    }
    return this.linkNow(carId,localId);
  });}
  async linkNow(carId,localId){const {connection}=await this.connection();if(!connection?.timing)throw Error('This Paddock host needs the Timing v1 update before cars can be linked.');
    const rows=await this.storage.cars({databaseId:connection.databaseId,carId}),existing=rows.find(x=>x.value.paddock.carId===carId);
    if(connection.mode==='local'&&!existing&&!localId){const transfers=await this.storage.localRead({kind:'list'});if(transfers.some(t=>t.databaseId===connection.databaseId&&t.targetId===carId&&!['rejected','cancelled'].includes(t.state)))throw Error('This car has an existing Timing transfer. Complete its review under Share existing Timing cars to preserve the original car and history.');}
    if(existing&&localId&&existing.value.id!==localId)throw Error('This Paddock car is already linked to another Timing car.');
    const target=localId?(await this.storage.cars({ids:[localId]}))[0]:existing;if(localId&&!target)throw Error('Local car no longer exists.');
    const p=await this.profile(carId);this.active();if(p.car.archived)throw Object.assign(Error('This car is archived in Paddock.'),{code:'CAR_ARCHIVED'});
    return this.storage.link(p,target?.value.id,target?.revision);
  }
  refresh(){return this.exclusive(()=>this.refreshNow());}
  async refreshNow(){const {connection}=await this.connection();if(!connection)return this.status();const linked=await this.storage.cars({databaseId:connection.databaseId});for(const {value:c,revision}of linked){try{await this.linkNow(c.paddock.carId,c.id);}catch(e){if(['CAR_NOT_FOUND','CAR_ARCHIVED'].includes(e.code))await this.storage.archive(c.id,revision);else throw e;}}return this.status();}
  prepare(ids){return this.exclusive(()=>this.prepareNow(ids));}
  async prepareNow(ids){
    if(!Array.isArray(ids)||ids.length>32||ids.some(id=>typeof id!=='string'))throw Error('Choose the cars for this race.');
    const rows=await this.storage.cars({ids:[...new Set(ids)],details:true}),connection=(await this.connection()).connection;const selected=ids.filter(id=>rows.some(c=>c.value.id===id&&c.value.paddock));
    if(new Set(selected).size!==selected.length)throw Error('A physical Paddock car can only be assigned to one entry in this race.');
    const captures={},warnings=[],updates=[];let offline=false;
    for(const localId of new Set(ids)){
      const row=rows.find(c=>c.value.id===localId),c=row?.value;if(!c?.paddock)continue;
      if(c.paddock.archived)throw Error(c.paddock.name+' is no longer available in Paddock.');
      let configuration=c.paddock.configuration,fresh=false;
      if(!offline&&this.code&&connection?.databaseId===c.paddock.databaseId){
        try{
          const p=await this.profile(c.paddock.carId,false);
          if(p.car.archived)throw Object.assign(Error('Car is archived in Paddock.'),{code:'CAR_NOT_FOUND'});
          const knownClass=row.raceClassName;this.active();
          if(knownClass.trim().toLocaleLowerCase()!==(p.car.raceClass||'').trim().toLocaleLowerCase())throw Object.assign(Error(c.paddock.name+' changed race class in Paddock. Refresh the Paddock Database and check the car selection before starting.'),{code:'CAR_CLASS_CHANGED'});
          configuration=p.configuration;fresh=true;updates.push({recordId:c.id,expectedRevision:row.revision,profile:p});
        }catch(e){
          if(['CAR_NOT_FOUND','CAR_CLASS_CHANGED','DATABASE_MISMATCH','PADDOCK_STOPPED'].includes(e.code)){if(e.code==='DATABASE_MISMATCH'){this.code='';this.connected=false;}throw e;}
          offline=true;this.connected=false;this.error=e.message;if(e.code==='UNAUTHENTICATED')this.code='';
        }
      }
      if(!configuration)throw Error('Connect to capture a configuration for '+c.paddock.name);
      if(!fresh)warnings.push(c.paddock.name+': using cached configuration from '+configuration.capturedAt);
      captures[localId]={name:c.paddock.name,configuration};
    }
    if(new Set(Object.values(captures).map(c=>c.configuration.databaseId)).size>1)throw Error('Choose linked cars from one Paddock database for this race.');
    // Publish fresh captures together. A local disk failure must never masquerade as an offline cache hit.
    this.active();const current=await this.storage.cars({ids:[...new Set(ids)]});
    if(current.length!==rows.length||rows.some(row=>!current.some(c=>c.value.id===row.value.id&&c.revision===row.revision&&c.raceClassName===row.raceClassName)))throw Error('Selected cars changed during capture. Check the selection and try again.');
    this.active();if(updates.length)await this.storage.capture(updates);
    return {captures,warnings,heats:[]};
  }
  schedule(delay=30000){clearTimeout(this.timer);if(!this.stopped&&!this.quiescing&&this.code)this.timer=setTimeout(()=>this.flush().catch(()=>{}),Math.max(delay,this.retryAt(this.lastConnection?.address)-Date.now())).unref();}
  async flush(){
    if(this.busy||!this.code||this.stopped||this.quiescing||this.isRacing?.()){this.schedule();return this.status();}
    this.busy=true;let retry=30000;
    try{const {connection:c}=await this.connection();if(c){const result=await this.delivery.flush(c.databaseId);if(result.verified&&!this.stopped){this.connected=true;this.error='';}}}
    catch(e){this.connected=false;this.error=e.message;retry=Math.max(60000,e.retryAfterMs||0);if(['DATABASE_MISMATCH','UNAUTHENTICATED'].includes(e.code))this.code='';}
    finally{this.busy=false;this.schedule(retry);}return this.status();
  }
  async retry(){await this.exclusive(async()=>{const {connection:c}=await this.connection();if(c)await this.delivery.retry(c.databaseId);});return this.flush();}
  async idle(){while(this.busy)await new Promise(resolve=>setTimeout(resolve,10));await this.deliveryStore.tail?.catch(()=>{});}
  quiesce(){this.quiescing=true;clearTimeout(this.timer);this.timer=null;clearTimeout(this.localTimer);this.closeLocalEvents?.();}
  stop(){this.quiesce();this.stopped=true;this.code='';this.localDescriptor=null;this.connected=false;}
}
function canonical(v){return Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);}
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
module.exports={Paddock,privateIP,address,request,discover,COPY_FIELDS,hash,credential,retryDelay,checkedReceipt,TERMINAL_CODES,profilePatch,validateProfile,receiptWarnings};
Object.assign(Paddock.prototype,require('./paddock-local'));

Object.assign(Paddock.prototype,require('./paddock-shared'));

Object.assign(Paddock.prototype,require('./paddock-shared-startup'));
Object.assign(Paddock.prototype,require('./paddock-historical-review').methods);
Object.assign(Paddock.prototype,require('./paddock-history').methods,require('./paddock-history-sync').methods);

Object.assign(Paddock.prototype,require('./paddock-collection'));
