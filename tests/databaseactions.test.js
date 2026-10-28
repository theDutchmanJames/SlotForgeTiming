const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const schema=require('../schema');
const src=fs.readFileSync(path.join(__dirname,'../renderer/database.js'),'utf8');
const context=vm.createContext({titleOf:(e,x)=>schema[e].title.map(k=>x[k]).filter(Boolean).join(' ')||'(unnamed)'});
vm.runInContext(src.slice(src.indexOf('const COPY_SETUP_ENTITIES'),src.indexOf('// All countries'))+'\nthis.copy=setupCopyData;this.order=databaseOrdered;this.entities=[...COPY_SETUP_ENTITIES];',context);
const plain=x=>JSON.parse(JSON.stringify(x));
const original={id:'original',name:'Club night',track:'track-1',fuel:'fuel-1',disabledSystems:['weather'],tyres:{C_club:{name:'Club tyre',wear:.125}},rules:[{from:3,pit:30}],custom:{note:'Keep this'}};
const before=plain(original),copy=context.copy(original,[original]);
assert.equal(copy.name,'Club night (copy)');assert(!('id' in copy));
assert.deepEqual(plain({...copy,name:original.name,id:original.id}),before);
copy.tyres.C_club.wear=2;copy.rules[0].pit=90;copy.disabledSystems.push('fuel');copy.custom.note='Changed';
assert.deepEqual(original,before,'nested fields must not share references');
assert.equal(context.copy(original,[original,{name:'club NIGHT (COPY)'},{name:'Club night (copy 2)'}]).name,'Club night (copy 3)');
assert.equal(copy.track,original.track,'copy keeps chosen track');assert.equal(copy.fuel,original.fuel,'copy keeps selected system links');
for(const entity of ['tracks','drivers']){
 const rows=[{id:'z',name:'Zulu'},{id:'10',name:'car 10'},{id:'2',name:'Car 2'},{id:'a',name:'alpha'}],before=plain(rows);
 assert.deepEqual(plain(context.order(entity,rows)).map(x=>x.id),['a','2','10','z']);
 assert.deepEqual(rows,before,'sorting must not reorder stored data');
}
const cars=[{brand:'NSR',manufacturer:'Porsche',model:'997'},{brand:'AvantSlot',manufacturer:'BMW',model:'M3'},{brand:'NSR',manufacturer:'Audi',model:'R8'}];
assert.deepEqual(plain(context.order('slotcars',cars)),[cars[1],cars[2],cars[0]],'cars sort by their displayed brand/manufacturer/model');
const results=[{name:'Zulu'},{name:'Alpha'}];assert.equal(context.order('sessions',results),results,'race results keep their original order');
assert.equal(context.entities.length,8);assert(context.entities.every(e=>schema[e]&&schema[e].linked===false));
console.log('Database copy isolation, unique names, links and alphabetical view ordering passed.');
