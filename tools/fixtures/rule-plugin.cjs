// Example package for manual installation and automated integration checks.
exports.make=()=>({format:'slotforge-code-plugin',apiVersion:1,manifest:{id:'example.club-rules',name:'Club race rules',version:'1.0.0',author:'SlotForge API example',license:'MIT',minAppVersion:'1.99.2',runtime:'node',description:'Fuel/tyre usage factors, a target-lap time consequence and a completed-lap competition bonus.',rules:{api:1,label:'Club challenge',description:'Apply a bounded usage factor and a time consequence for laps faster than the target. Award a competition bonus per completed lap.'},settings:[
 {id:'fuel',label:'Fuel usage multiplier',type:'number',min:0,max:10,default:1.2},
 {id:'tyres',label:'Tyre wear multiplier',type:'number',min:0,max:10,default:1.5},
 {id:'target',label:'Minimum target lap (seconds)',type:'number',min:0,max:3600,default:10},
 {id:'penalty',label:'Time per faster lap (seconds)',type:'number',min:0,max:3600,default:2},
 {id:'bonus',label:'Competition points per completed lap',type:'number',min:-100,max:100,default:1}
 ]},entry:'main.cjs',files:{'main.cjs':Buffer.from(`exports.rules=context=>{
 const s=context.settings;
 return {fuelMultiplier:s.fuel,tyreMultiplier:s.tyres,
 lapTimeMs:{op:'if',args:[{op:'lt',args:[{var:'lapMs'},s.target*1000]},s.penalty*1000,0]},
 points:{op:'mul',args:[{var:'lap'},s.bonus]}};
};`).toString('base64')}});
