'use strict';
const D=require('./dashboard-read'),R=require('./reference-read'),E=require('./renderer/endurance');
function options(o){if(!o||typeof o.trackId!=='string'||!o.setup||typeof o.setup!=='object'||!Array.isArray(o.rows)||o.rows.length>4096||o.rows.some(r=>!r||['driverId','carId','teamId'].some(k=>r[k]!==undefined&&typeof r[k]!=='string'))||typeof o.championship!=='boolean'||o.revision!==undefined&&typeof o.revision!=='string')throw Error('Invalid race input request.');return o;}
function read(source,value){const o=options(value);if(o.revision!==undefined&&o.revision!==source.revision())throw require('./catalogue-read').stale();const setup=E.effective(o.setup),one=(entity,id)=>typeof id==='string'&&id?source.get(entity,id):null,selected=(entity,ids)=>[...new Set(ids)].map(id=>one(entity,id)).filter(Boolean);
 const teams=source.meta('teams'),rosters=new Set(o.rows.flatMap(r=>teams.find(t=>t.id===r.teamId)?.drivers||[])),drivers=new Set([...rosters,...o.rows.map(r=>r.driverId)]);
 const allDrivers=source.meta('drivers').map(d=>setup.sessionType==='tokens'||drivers.has(d.id)?one('drivers',d.id):d);
 const collections={drivers:allDrivers,slotcars:selected('slotcars',o.rows.map(r=>r.carId)),teams,layouts:selected('layouts',[setup.layout,setup.layout2]),audiosets:selected('audiosets',[setup.audioSet])};
 for(const [entity,key] of Object.entries({penaltysystems:'penaltySystem',fuelrules:'fuelRules',weathersystems:'weather',damagesystems:'damageSystem',tyrewearsystems:'tyreWear',safetycarsystems:'safetyCar',pushsavesystems:'pushSave'}))collections[entity]=selected(entity,[setup[key]]);
 const display=require('./display-read').read(source,collections.layouts);
 const teamIds=new Set([...o.rows.map(r=>r.teamId),...display.teamIds]);
 collections.teams=teams.map(t=>teamIds.has(t.id)?one('teams',t.id):t);
 for(const entity of ['rowdesigns','chartdesigns','imagesets'])collections[entity]=display[entity];
 collections.laps=[]; // Championship history has its own aggregate reader.
 return {collections,chartIds:display.chartIds,records:D.records(source.laps(o.trackId),o.trackId,setup.sessionType==='tokens')};
}
function jsonSource(db){return {...D.jsonSource(db),revision:()=>require('./catalogue-read').jsonRevision(db),get:(e,id)=>db.getRecord(e,id),meta:e=>db.list(e).map(r=>R.project(e,r.id,p=>p.reduce((x,k)=>x?.[k],r)))};}
module.exports={options,read,jsonSource};
