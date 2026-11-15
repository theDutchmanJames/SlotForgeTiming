'use strict';
module.exports=function seed(db,{unrelated=205,lapCount=1200}={}){
 const C=require('../../renderer/championship'),image='data:image/png;base64,AQID';
 db.data.drivers=[{id:'d',name:'James',avatar:image},{id:'b',name:'Bjorn',avatar:image},{id:'v',name:'Replay',driverType:'virtual',virtualRivalSystem:'rival'}];
 db.data.tracks=[{id:'t',name:'Club circuit',lanes:2,length:20,laneLengths:[20,22],laneModifier:'manual',picture:image}];
 db.data.teams=[{id:'team',name:'Club',drivers:['d','b'],picture:image}];
 db.data.racesetups=[{id:'race',name:'Club race',sessionType:'race',track:'t',laps:10},{id:'q',name:'Qualifying',sessionType:'qualifying',track:'t'}];
 const cup=C.clean({id:'cup',name:'Club Cup',bonusFast:1,bonusPole:2,rounds:[{id:'r1',track:'t',sessions:[{id:'q',setup:'q',share:0},{id:'race',setup:'race',share:100}]},{id:'r2',track:'t',sessions:[{id:'race2',setup:'race',share:50}]}],roster:[{driver:'d',team:'team'},{driver:'b',team:'team'}]},true);
 db.data.championships=[cup,C.clean({...cup,id:'other',name:'Other Cup'},true)];
 const standings=[{pos:1,driverId:'d',driverName:'James',carName:'Mosler',laps:10,total:70000,best:6500,raceClass:'gt3',classPos:1},{pos:2,driverId:'b',driverName:'Bjorn',carName:'Corvette',laps:10,total:72000,best:6600,raceClass:'gt3',classPos:2}];
 const session=(id,extra={})=>({id,date:'2026-11-15T10:00:00Z',setupName:id,trackId:'t',trackName:'Club circuit',sessionType:'race',standings,champ:{id:'cup',roundId:'r1',sessionId:'race',kind:'race',awarded:'2026-11-15T10:30:00Z'},multiclass:{pointsMode:'both',classes:[{id:'gt3',name:'GT3'}]},classStandings:standings,...extra});
 db.data.sessions=[session('qualifying',{sessionType:'qualifying',champ:{id:'cup',roundId:'r1',sessionId:'q',kind:'qualifying'}}),session('recording'),session('rerun',{date:'2026-11-15T11:00:00Z',champ:{id:'cup',roundId:'r1',sessionId:'race',kind:'race'}}),session('off',{champ:{id:'cup',roundId:'r2',sessionId:'race2',kind:'race',off:true}}),session('team-race',{champ:{id:'cup',roundId:'r2',sessionId:'race2',kind:'race',awarded:'now'},standings:[{pos:1,asTeam:true,teamId:'team',teamName:'Club',laps:10,best:6500,total:70000,drivers:[{driverId:'d',driverName:'James',laps:6,best:6500},{driverId:'b',driverName:'Bjorn',laps:4,best:6600}]}]}),session('virtual-only',{champ:null}),session('token-only',{champ:null,sessionType:'tokens'}),session('empty',{champ:null}),...Array.from({length:unrelated},(_,i)=>session('other-'+i,{champ:{id:'other',roundId:'r1',sessionId:'race',kind:'race',awarded:'now'},paddockDelivery:{payload:{private:image}},unrelatedPicture:image}))];
 db.data.sessions[1].heatResults=[{heat:1,rows:[{driverId:'d',driverName:'James in heats',carName:'Heat car'}]}];
 db.data.laps=Array.from({length:lapCount},(_,i)=>({id:'lap-'+i,sessionId:'recording',driverId:i%3?'d':'b',lane:i%2+1,time:6500+i%100,lapNumber:Math.floor(i/2)+1,heat:i%2,invalid:i%11===0,redFlag:i%13===0,pit:i%17===0,noTrackRecord:i%19===0,noPersonalBest:i%23===0}));
 db.data.laps.push({id:'virtual',sessionId:'virtual-only',virtualRival:true,time:7000,driverId:'v'},{id:'token',sessionId:'token-only',token:true,time:7000,driverId:'d'},{id:'mixed-token',sessionId:'recording',token:true,driverId:'d',time:8000,lapNumber:9999,lane:2,heat:1});
 db.data.laps.push(...Array.from({length:unrelated},(_,i)=>({id:'other-lap-'+i,sessionId:'other-'+i,time:6000,driverId:'d',lapNumber:1,lane:1})));
 db.data.virtualrivalsystems=[{id:'rival',...require('../../renderer/virtualrival').clean({name:'Club replay',trackId:'t',trackName:'Club circuit',sourceId:'recording',sourceDriverId:'d',sourceName:'James',recording:[{time:7500,lap:1},{time:7700,lap:2}],to:2})}];
 return {cup,standings,image};
};
