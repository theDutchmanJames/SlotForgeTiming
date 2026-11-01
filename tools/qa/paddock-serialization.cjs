// Synthetic, in-memory measurement; no user files are opened or written.
const {performance}=require('node:perf_hooks'),Database=require('../../db'),{Paddock}=require('../../paddock');
const db=Object.create(Database.prototype);
db.data={slotcars:Array.from({length:80},(_,i)=>({id:String(i),picture:'data:image/png;base64,'+'A'.repeat(1024*1024)})),sessions:[],laps:Array.from({length:20000},(_,i)=>({id:String(i),time:10000,sessionId:'old'})),paddock:{withdrawals:[]}};
db.texts=new WeakMap();db.fileChunks();
const measure=()=>{const start=performance.now();db.fileChunks();return +(performance.now()-start).toFixed(1);};
db.touchAll();const previousInvalidationMs=measure();let targetedInvalidationMs;
db.commit=()=>{targetedInvalidationMs=measure();};db.saved=async()=>{};
const client=new Paddock(db);
client.commit().then(()=>console.log(JSON.stringify({imageMiB:80,laps:20000,previousInvalidationMs,targetedInvalidationMs}))).finally(()=>client.stop());
