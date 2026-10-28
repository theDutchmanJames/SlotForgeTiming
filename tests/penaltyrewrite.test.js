const { createRace, penaltyConfig } = require('../renderer/engine.js');
const Words = require('../renderer/systemwords.js');
let fails = 0;
const ok = (name, yes) => { console.log((yes ? 'ok   ' : 'FAIL ') + name); if (!yes) fails++; };
const race = penalty => createRace({ type: 'race', laps: 20, minLap: 800, penalty, entries: [{ lane: 0, driverId: 'a', driverName: 'Alex' }] });

const system = {
  name: 'Escalating', ruleMode: 'custom', dqOn: 'on', dqPoints: 9, dqUnserved: 'on',
  rules: [{ from: 1, time: 0, laps: 0, pit: 0 }, { from: 3, time: 5, laps: 1, pit: 8 }, { from: 5, time: 12, laps: 2, pit: 15 }],
  types: [{ name: 'Unsafe release', points: 1, effect: 'time', amount: 2 }, { name: 'Track limits', points: 0, effect: 'laps', amount: 1 }, { name: 'Stop and hold', points: 0, effect: 'pit', amount: 10 }]
};
const P = penaltyConfig(system);
let r = race(P); r.start(0); r.cross(0, 1000); r.cross(0, 2000); r.addPoints(0, 3, 2100);
ok('a ladder uses the highest reached row as the total time and scoring-lap consequence', r.penMs(r.cars[0]) === 5000 && r.lapsOf(r.cars[0]) === 1);
ok('crossing a pit threshold queues exactly that mandatory stop', r.cars[0].pending.length === 1 && r.cars[0].pending[0].seconds === 8 && r.cars[0].pending[0].mandatory);
r.addPoints(0, 2, 2200);
ok('a higher threshold replaces time/laps and the earlier unserved pit tier', r.penMs(r.cars[0]) === 12000 && r.lapsOf(r.cars[0]) === 0 && r.cars[0].pending.length === 1 && r.cars[0].pending[0].seconds === 15);
r.assign(0, 0, 2300); r.assign(0, 1, 2400); r.assign(0, 2, 2500);
ok('named penalties add points and can apply immediate time, scoring laps and pit work', r.cars[0].points === 6 && r.cars[0].extraMs === 2000 && r.cars[0].specialLaps === 1 && r.cars[0].pending.some(p => p.name === 'Stop and hold' && p.seconds === 10));
r.addPoints(0, 3, 2600);
ok('the configurable point limit still disqualifies', r.cars[0].dq === true);

const legacy = penaltyConfig({ timeRule: 'every', everyPoints: 5, everySeconds: 5, types: [{ name: 'Legacy drive-through', kind: 'drivethrough', seconds: 0, cost: 2, extra: 1, unserved: 10 }] });
r = race(legacy); r.start(0); r.addPoints(0, 2, 1000); r.assign(0, 0, 1100);
ok('an earlier saved special penalty still spends its points and queues its original pit rule', r.cars[0].points === 0 && r.cars[0].pending.length === 1 && r.cars[0].pending[0].kind === 'drivethrough');

const words = Words.describe('penaltysystems', system);
ok('plain words explain the cumulative ladder, named penalties and stop disqualification', words.say.map(x => x.t || '').join('').includes('highest point level') && words.pills.length >= 2);

// Replacement applies only to the automatic tier, not another named penalty.
const tiers = penaltyConfig({ ruleMode:'custom', rules:[{from:1,pit:8},{from:3,pit:15}],types:[{name:'Penalty points · 1 points',points:0,effect:'pit',amount:10}] });
r=race(tiers);r.start(0);r.addPoints(0,1,100);r.assign(0,0,101);r.addPoints(0,2,102);
ok('a special penalty with the same text remains independent',r.cars[0].pending.length===2&&r.cars[0].pending[0].seconds===15&&r.cars[0].pending[1].seconds===10);
r=race(tiers);r.start(0);r.addPoints(0,1,100);r.block(0,1000);r.tick(10000);r.unblock(0,11000);r.addPoints(0,2,12000);
ok('completed lower tiers remain served and a later tier requires its own stop',r.cars[0].served.length===1&&r.cars[0].served[0].seconds===8&&r.cars[0].pending.length===1&&r.cars[0].pending[0].seconds===15);
r=createRace({type:'race',laps:99,entries:[{lane:0,driverName:'A'}],penalty:tiers,fuel:{on:false,pitHold:2000},pitControl:{mode:'manual',seconds:30,waitReturn:false}});r.start(0);r.addPoints(0,1,100);r.block(0,1000);r.tick(34000);r.addPoints(0,2,35000);
ok('an in-progress tier extends to the new duration without restarting service',r.cars[0].pending.length===1&&r.cars[0].pitHold.extraMs===15000&&r.cars[0].served.length===0);
r.tick(48000);
ok('replacement completes after normal service plus the higher duration',r.cars[0].served.length===1&&r.cars[0].served[0].seconds===15&&r.cars[0].served[0].servedAt===48000);
r=race(tiers);r.start(0);r.addPoints(0,3,100);r.addPoints(0,-3,101);r.addPoints(0,1,102);
ok('correcting points and recrossing a lower tier does not add a shorter duplicate stop',r.cars[0].pending.length===1&&r.cars[0].pending[0].seconds===15);

if (fails) { console.error(`${fails} PENALTY REWRITE TESTS FAILED`); process.exit(1); }
console.log('ALL PENALTY REWRITE TESTS PASSED');
