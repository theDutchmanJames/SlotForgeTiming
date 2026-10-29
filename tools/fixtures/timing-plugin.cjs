// Separately installed simulator example. Never loaded by the standard app.
const fs=require('node:fs'),path=require('node:path');
const code=`let session=null,levels=[],values={};
const snapshot=()=>levels.map(x=>({...x}));
exports.activate=c=>c.status('Simulated timing driver ready — no hardware');
exports.timing={
 connect(c,s){session=s;levels=['lap','pit','call'].flatMap(kind=>Array.from({length:kind==='call'?1:8},(_,channel)=>({kind,channel,on:kind==='lap'&&channel===0&&c.settings.start_covered===true})));return snapshot();},
 arm(c,s){session=s;return snapshot();},
 disconnect(){session=null;values={};},
 outputs(c,p){values={...p.values};return true;},
 simulate(c,s,e){if(e.kind==='disconnect'){s.disconnected('Simulated device disconnect');return;}const x=levels.find(x=>x.kind===e.kind&&x.channel===e.channel);if(!x)throw Error('Unknown sensor');x.on=e.on;s.sensor(e.kind,e.channel,e.on);return {ack:true};}
};`;
function make(){return {format:'slotforge-code-plugin',apiVersion:1,manifest:{id:'example.simulated-timing',name:'Simulated Timing Interface',version:'1.0.0',author:'SlotForge example',description:'Manual lap, pit and track-call levels for testing the timing API. No physical hardware.',license:'CC0-1.0',minAppVersion:'1.99.2',runtime:'node',commands:[],settings:[{id:'start_covered',label:'Start with lap channel 0 covered (connection test)',type:'boolean',default:false}],timing:{api:1,label:'Simulated sensors',channels:8,inputs:['lap','pit','call'],outputs:['master','go','yellow','red','start1','start2','start3','start4','start5',...Array.from({length:8},(_,i)=>'relay'+(i+1))],simulation:true}},entry:'main.cjs',files:{'main.cjs':Buffer.from(code).toString('base64')}};}
module.exports={make,code};
if(require.main===module){const target=path.resolve(process.argv[2]||'simulated-timing.slotforge-plugin');fs.writeFileSync(target,JSON.stringify(make(),null,2));console.log(target);}
