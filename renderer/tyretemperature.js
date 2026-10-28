// Gameplay temperatures, never physical sensor measurements. Pure and clock-free.
(function(root){
  const n=(v,d,lo,hi)=>Number.isFinite(Number(v))&&v!==''&&v!==null?Math.max(lo,Math.min(hi,Number(v))):d;
  const DEFAULT={start:20,low:60,high:90,warm:12,cool:20,coldWear:20,hotWear:30};
  const AMBIENT={dry:20,cloudy:18,wet:15,clearing:18};
  function compound(x={}){
    x=x&&typeof x==='object'?x:{};
    const low=n(x.low,60,0,149),high=n(x.high,90,low+1,150);
    return {start:n(x.start,20,-20,180),low,high,warm:n(x.warm,12,0,50),cool:n(x.cool,20,0,120),coldWear:n(x.coldWear,20,0,200),hotWear:n(x.hotWear,30,0,200)};
  }
  function clean(x={},codes=[]){
    x=x&&typeof x==='object'?x:{};
    return {ambientSource:x.ambientSource==='manual'?'manual':'weather',ambient:Object.fromEntries(Object.entries(AMBIENT).map(([k,d])=>[k,n(x.ambient?.[k],d,-20,60)])),tyres:Object.fromEntries(codes.map(k=>[k,compound(x.tyres?.[k])]))};
  }
  const settings=(cfg,code)=>compound(cfg?.tyres?.[code]);
  const ambient=(cfg,weather)=>cfg?.ambient?.[weather]??AMBIENT[weather]??AMBIENT.dry;
  const approach=(v,target,step)=>v+Math.sign(target-v)*Math.min(Math.abs(target-v),Math.max(0,step));
  function cool(cfg,code,value,seconds,weather){const s=settings(cfg,code);return approach(n(value,s.start,-20,180),ambient(cfg,weather),s.cool*Math.max(0,seconds)/60);}
  function lap(cfg,code,value,kind='normal',weather='dry'){
    const s=settings(cfg,code),mid=(s.low+s.high)/2,span=s.high-s.low;
    const intensity=typeof kind==='number'?n(kind,0,-1,1):kind==='push'?1:kind==='save'?-1:0;
    // At full Push the equilibrium is above the working range; at Save below it.
    const target=Math.max(-20,Math.min(180,mid+intensity*.75*span+(ambient(cfg,weather)-ambient(cfg,'dry'))*.5));
    return approach(n(value,s.start,-20,180),target,s.warm);
  }
  function view(cfg,code,value){
    const s=settings(cfg,code),temp=n(value,s.start,-20,180),state=temp<s.low?'cold':temp>s.high?'hot':'working';
    const fraction=state==='cold'?Math.min(1,(s.low-temp)/Math.max(1,s.low+20)):state==='hot'?Math.min(1,(temp-s.high)/Math.max(1,180-s.high)):0;
    return {value:temp,state,label:{cold:'Cold',working:'Working',hot:'Hot'}[state],multiplier:1+fraction*(state==='cold'?s.coldWear:s.hotWear)/100,low:s.low,high:s.high};
  }
  function intensity(cfg,pace){
    if(!cfg||!pace||pace.w||!Number.isFinite(pace.p))return 0;
    const p=pace.p;
    if(cfg.mode==='median')return p<0?Math.min(1,-p/Math.max(.1,cfg.pushAt)): -Math.min(1,p/Math.max(.1,cfg.saveAt));
    return p<=cfg.normal?Math.min(1,(cfg.normal-p)/Math.max(.1,cfg.normal)):-Math.min(1,(p-cfg.normal)/Math.max(.1,cfg.saveAt-cfg.normal));
  }
  const api={DEFAULT,AMBIENT,compound,clean,settings,ambient,cool,lap,view,intensity};
  if(typeof module!=='undefined')module.exports=api;else root.TyreTemperature=api;
})(typeof globalThis!=='undefined'?globalThis:this);
