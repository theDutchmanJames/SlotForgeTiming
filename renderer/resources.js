// Resource accounting is independent of timing hardware, points and result approval.
(function(root){
  const clone=x=>JSON.parse(JSON.stringify(x));
  const count=x=>Math.max(0,Math.min(100000,Math.floor(Number(x)||0)));
  function clean(x={}){
    const tyres=Object.fromEntries(['H','M','S','SS','US','HS','SH','INT','W'].map(k=>[k,0]));for(const [k,v] of Object.entries(x.tyres||{H:3,M:3,S:3,INT:2,W:2}))if(/^[A-Za-z0-9_-]{1,60}$/.test(k))tyres[k]=count(v);
    return {name:String(x.name||'Resource allocation').trim().slice(0,100),owner:['driver','car','team'].includes(x.owner)?x.owner:'team',scope:['race','event','championship'].includes(x.scope)?x.scope:'event',tyresOn:x.tyresOn!==false,tyres,repairsOn:!!x.repairsOn,repairs:count(x.repairs??5),componentsOn:!!x.componentsOn,components:count(x.components??2)};
  }
  function prepare(profile,context,ledger={}){
    if(!profile?.id)throw Error('Choose an existing Resource System.');
    const p={...clean(profile),id:profile.id};
    if(p.scope==='championship'&&!context.champId)throw Error('This Resource System requires a championship session loaded from Home.');
    if(!context.runId)throw Error('A resource event needs a stable ID.');
    const accounts=Object.fromEntries(Object.entries(ledger.accounts||{}).filter(([,a])=>p.scope==='championship'&&a.profileId===p.id&&a.scope==='championship'&&a.scopeId===context.champId));
    return {v:1,runId:context.runId,profile:p,champId:context.champId||'',eventName:String(context.eventName||'Event').slice(0,100),champName:String(context.champName||'Championship').slice(0,100),createdAt:new Date().toISOString(),accounts:clone(accounts),events:[],revision:0};
  }
  const owner=(p,c)=>String(c[p.owner==='car'?'carId':p.owner==='team'?'teamId':'driverId']||'');
  function validate(p,entries){
    if(!p)return [];
    return entries.filter(c=>!owner(p,c)).map(c=>`${c.teamName||c.driverName||'Entry'} needs a ${p.owner==='car'?'slotcar':p.owner} for its resource allocation.`);
  }
  const prefix=(s,heat)=>JSON.stringify([s.profile.id,s.profile.scope,s.profile.scope==='championship'?s.champId:s.runId,s.profile.scope==='race'?String(heat):'']);
  const key=(s,c,heat)=>prefix(s,heat)+'/'+JSON.stringify([s.profile.owner,owner(s.profile,c)]);
  function limits(p){const r={};if(p.tyresOn)for(const [code,n]of Object.entries(p.tyres))r['tyre:'+code]=n;if(p.repairsOn)r.repair=p.repairs;if(p.componentsOn)r.component=p.components;return r;}
  function account(s,c,heat){
    const id=owner(s.profile,c);if(!id)throw Error('Missing resource owner.');
    const k=key(s,c,heat);
    if(!s.accounts[k])s.accounts[k]={key:k,profileId:s.profile.id,scope:s.profile.scope,scopeId:s.profile.scope==='championship'?s.champId:s.runId,scopeName:s.profile.scope==='championship'?s.champName:s.eventName+(s.profile.scope==='race'?' · Heat '+(Number(heat)+1):''),createdAt:s.createdAt,owner:s.profile.owner,ownerId:id,name:s.profile.owner==='team'?c.teamName||id:s.profile.owner==='car'?c.carName||id:c.driverName||id,initial:limits(s.profile),balance:limits(s.profile)};
    return s.accounts[k];
  }
  function available(s,c,heat,kind){if(!owner(s.profile,c))return 0;const a=account(s,c,heat);return count(a.balance[kind]);}
  function spend(s,c,heat,cost,reason,at=0){
    const a=account(s,c,heat),items=Object.entries(cost).filter(([,n])=>n>0);
    if(items.some(([k,n])=>!Number.isInteger(n)||available(s,c,heat,k)<n))return false;
    if(!items.length)return true;
    for(const[k,n]of items)a.balance[k]-=n;
    s.events.push({id:s.runId+':'+(s.events.length+1),account:a.key,delta:Object.fromEntries(items.map(([k,n])=>[k,-n])),reason,at,heat});s.revision++;return true;
  }
  function adjust(s,c,heat,kind,n,reason,at=0){
    if(!Number.isInteger(n)||!n||Math.abs(n)>100000||!String(reason||'').trim())return false;
    if(!(kind in limits(s.profile)))return false;
    const a=account(s,c,heat);if((a.balance[kind]||0)+n<0)return false;
    a.balance[kind]=(a.balance[kind]||0)+n;s.events.push({id:s.runId+':'+(s.events.length+1),account:a.key,delta:{[kind]:n},reason:'Director: '+String(reason).trim().slice(0,180),at,heat});s.revision++;return true;
  }
  function attach(R,cfg){
    if(!cfg.resources)return;
    const s=R.resources=cfg.resources,heat=cfg.resourceHeat??0,p=s.profile;
    R.resourceHeat=heat;
    R.resourceBalance=c=>owner(p,c)?({...account(s,c,heat).balance}):{};
    R.resourceAdjust=(i,k,n,reason,t)=>{const c=R.cars[i];return !!c&&!!owner(p,c)&&adjust(s,c,heat,k,n,reason,t);};
    // A correction edits the recorded fit; a real pit change spends the current driver's stock.
    R.resourceCorrectTyre=(c,was,to,t)=>{
      const a=s.accounts[c.resourceTyreAccount];
      if(!a){R.resourceError='The fitted set has no recorded supplying account. Make a normal tyre change instead.';return false;}
      if((a.balance['tyre:'+to]||0)<1)return false;
      const delta={['tyre:'+was]:1,['tyre:'+to]:-1};
      for(const[k,n]of Object.entries(delta))a.balance[k]=(a.balance[k]||0)+n;
      s.events.push({id:s.runId+':'+(s.events.length+1),account:a.key,delta,reason:'Director: Correct fitted compound',at:t,heat});s.revision++;return true;
    };
    R.resourceCost=(c,job,t)=>{
      if(!owner(p,c)){R.resourceError=validate(p,[c]).join(' ');return false;}
      const cost=job.startsWith('tyre:')?(p.tyresOn?{[job]:1}:{}):{...(p.repairsOn?{repair:1}:{}),...(job==='failure'&&p.componentsOn?{component:1}:{})};
      const ok=spend(s,c,heat,cost,job.startsWith('tyre:')?'Fit '+job.slice(5)+' tyres':job==='failure'?'Repair failure':'Repair damage',t);
      c.resourceBlocks=c.resourceBlocks||{};
      if(!ok){
        if(c.resourceBlocks[job]!==c.blockAt)R.events.push({type:'resourceblocked',car:R.cars.indexOf(c),t,job,owner:account(s,c,heat).name,missing:Object.keys(cost).filter(k=>available(s,c,heat,k)<cost[k])});
        c.resourceBlocks[job]=c.blockAt;c.resourceBlocked=job;
      }else {if(job.startsWith('tyre:')&&p.tyresOn)c.resourceTyreAccount=key(s,c,heat);delete c.resourceBlocks[job];c.resourceBlocked=Object.keys(c.resourceBlocks)[0]||'';}
      return ok;
    };
    R.resourceStart=()=>{
      const entries=R.cars.filter(c=>!c.resourceStarted&&!c.virtualRival);
      const errors=validate(p,entries);if(errors.length){R.resourceError=errors.join(' ');return false;}
      // Preflight the whole grid against a copy: shared owners cannot spend the same set twice.
      const trial=clone(s);
      for(const c of entries)if(p.tyresOn&&!spend(trial,c,heat,{['tyre:'+c.tyre]:1},'Starting tyre set')){R.resourceError=`Not enough ${c.tyre} starting sets for ${account(s,c,heat).name}. Grant more resources before starting.`;return false;}
      entries.forEach(c=>account(trial,c,heat));
      Object.assign(s,trial);entries.forEach(c=>{c.resourceStarted=true;if(p.tyresOn)c.resourceTyreAccount=key(s,c,heat);});R.resourceError='';return true;
    };
  }
  const api={clean,prepare,validate,limits,owner,key,account,available,spend,adjust,attach};
  if(typeof module!=='undefined')module.exports=api;else root.Resources=api;
})(typeof globalThis!=='undefined'?globalThis:this);
