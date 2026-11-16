const B = require('../renderer/arduinobox.js'), R = require('../renderer/arduinorace.js');
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const s = b => String.fromCharCode(...b).trim();
function fake(setup) {
  const link = B.createLink({ now: () => 1000 }), sent = [], did = [], cars = [{ lane: 0, blockAt: null }, { lane: 1, blockAt: null }, { lane: 2, blockAt: null }];
  link.setConnected(true); link.setSender(b => sent.push(s(b)));
  const st = { phase: 'ready', lights: 0, flag: '' };
  const b = R.bind({ link, cars: () => cars, crossCar: (i, at) => did.push(['cross', i, at]), blockCar: i => { cars[i].blockAt = 1; did.push(['block', i]); }, unblockCar: i => { cars[i].blockAt = null; did.push(['unblock', i]); },
    actions: { call: l => did.push(['call', l]) }, trackcall: () => did.push(['trackcall']), phase: () => st.phase, lights: () => st.lights, flag: () => st.flag, setup, keepalive: false,
    onJump: (l, at) => did.push(['jump', l]), onTrap: (l, ms) => did.push(['trap', l, ms]) });
  return { link, sent, did, cars, st, b };
}
{ // the lights for every phase
  ok('ready and between = off', R.lightsFor('ready', 0, '') === '0' && R.lightsFor('between', 0, '') === '0');
  ok('countdown = the number of lights of the app', R.lightsFor('countdown', 3, '') === '3' && R.lightsFor('countdown', 5, '') === '5' && R.lightsFor('countdown', 9, '') === '5');
  ok('running = GO, yellow = caution, red = STOP', R.lightsFor('running', 0, '') === 'G' && R.lightsFor('running', 0, 'yellow') === 'Y' && R.lightsFor('running', 0, 'red') === 'S');
  ok('paused and finished = STOP', R.lightsFor('paused', 0, '') === 'S' && R.lightsFor('finished', 0, '') === 'S');
}
{ // a race from start to finish
  const f = fake({ startPower: 'on' });
  ok('on bind: power on (startPower on), the lights off, the readings stream off', f.sent.includes('M1') && f.sent.includes('L0') && f.sent.includes('Z0'));
  f.st.phase = 'countdown'; f.st.lights = 1; f.b.sync(); f.st.lights = 2; f.b.sync(); f.b.sync();
  ok('the countdown lights follow, with a beep per light, and nothing is repeated', f.sent.slice(-4).join() === 'L1,B1,L2,B1');
  f.link.emit({ type: 'hit', lane: 1, at: 5 }); ok('a crossing during the countdown is a jump start, not a lap', f.did[0].join() === 'jump,1' && !f.did.some(d => d[0] === 'cross'));
  f.st.phase = 'running'; f.st.lights = 0; f.b.sync(); ok('lights out: GO and the long beep', f.sent.slice(-2).join() === 'LG,B3');
  f.link.emit({ type: 'hit', lane: 1, at: 5000 }); ok('a crossing while running reaches crossCar with the car index', f.did[f.did.length - 1].join() === 'cross,1,5000');
  f.link.emit({ type: 'pit', pit: 0, in: true, at: 1 }); f.link.emit({ type: 'pit', pit: 0, in: false, at: 2 }); ok('pit sensor 1 blocks and frees car 0', f.did.slice(-2).map(d => d.join()).join('|') === 'block,0|unblock,0');
  f.link.emit({ type: 'call', at: 1 }); ok('W is the Trackcall', f.did[f.did.length - 1][0] === 'trackcall');
  f.link.emit({ type: 'button', lane: 2, at: 1 }); ok('a lane button is a call from that lane', f.did[f.did.length - 1].join() === 'call,2');
  f.link.emit({ type: 'trap', lane: 0, ms: 48, at: 1 }); ok('the speed trap reaches onTrap', f.did[f.did.length - 1].join() === 'trap,0,48');
  f.st.flag = 'yellow'; f.b.sync(); ok('yellow flag: caution', f.sent[f.sent.length - 1] === 'LY');
  f.st.flag = 'red'; f.b.sync(); ok('red flag: STOP', f.sent[f.sent.length - 1] === 'LS');
  f.st.flag = ''; f.b.sync(); ok('flag cleared: GO again (no beep: not a start)', f.sent[f.sent.length - 1] === 'LG');
  f.cars[2].retired = true; f.b.sync(); f.b.sync(); ok('a retired car loses its lane power, once', f.sent.filter(x => x === 'Q30').length === 1);
  f.b.power(false); ok('power(off) goes to the box and the link', f.sent[f.sent.length - 1] === 'M0' && f.link.power === false);
  f.link.emit({ type: 'safe', on: true }); f.link.emit({ type: 'safe', on: false }); ok('back from the safe state the lights are told again', f.sent[f.sent.length - 1] === 'LG');
  ok('...and the track power the race wants (the box cut it when it lost the PC): here off, as the race left it', f.sent[f.sent.length - 2] === 'M0' && f.link.power === false);
  f.b.power(true); f.link.emit({ type: 'safe', on: true }); f.link.emit({ type: 'safe', on: false });
  ok('...and when the race had the power on, it is switched on again (1.39.1)', f.sent[f.sent.length - 2] === 'M1' && f.link.power === true);
  f.st.phase = 'finished'; f.b.sync(); ok('finished: STOP', f.sent[f.sent.length - 1] === 'LS');
  f.b.off(); ok('off(): STOP and the cut lanes get their power back', f.sent.slice(-2).join() === 'LS,Q31');
  const n = f.did.length; f.link.emit({ type: 'hit', lane: 0, at: 1 }); ok('and nothing is listened to any more', f.did.length === n);
}
{ // settings: start without power, pit by button only, no beeps, no lane power cut
  const f = fake({ startPower: 'off', boxPit: 'button', boxBeeps: false, boxLanePower: 'off' });
  ok('startPower off: the box is told power off', f.sent.includes('M0') && !f.sent.includes('M1'));
  f.st.phase = 'countdown'; f.st.lights = 1; f.b.sync(); ok('no beeps when switched off', !f.sent.includes('B1'));
  f.st.phase = 'running'; f.b.sync(); f.link.emit({ type: 'pit', pit: 0, in: true, at: 1 }); ok('pit by button only: the pit sensor does nothing', !f.did.some(d => d[0] === 'block'));
  f.cars[0].dq = true; f.b.sync(); ok('lane power is left alone when the setting says so', !f.sent.some(x => /^Q/.test(x)));
  f.link.emit({ type: 'hit', lane: 0, at: 1 }); ok('ready/countdown aside, a hit counts', f.did.some(d => d[0] === 'cross'));
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
