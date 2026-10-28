const assert = require('assert/strict'), P = require('../renderer/parallel'), PR = require('../renderer/parallelrace');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function fixture(extra = {}) {
  const L = P.createLink(); L.setConnected(true); let phase = 'ready', lights = 0, flag = '', serial = 0, out = [], calls = [], enabled = true;
  const cars = [{ lane: 0 }, { lane: 1 }], o = { link: L, setup: { startPower: 'off' }, pitMs: 1000, cars: () => cars, phase: () => phase, lights: () => lights, flag: () => flag, enabled: () => enabled,
    crossCar: (...a) => calls.push(['hit', ...a]), holdCar: (...a) => calls.push(['hold', ...a]), blockCar: (...a) => calls.push(['pit', ...a]), unblockCar: (...a) => calls.push(['free', ...a]), trackcall: () => calls.push(['call']),
    acquire: async () => ({ lease: ++serial }), release: async lease => calls.push(['release', lease]), outputs: async (wants, lease) => out.push({ wants, lease }), ...extra };
  const binding = PR.bind(o); await tick();
  const sample = (at, high = []) => { let status = 0x80; for (const [pin, bit] of [[10, 6], [11, 7], [12, 5], [13, 4], [15, 3]]) if (high.includes(pin)) status ^= 1 << bit; L.feed({ at, status, control: 0x0b }); };
  sample(0);
  return { L, binding, calls, cars, out, sample, phase: value => { phase = value; binding.sync(); }, lights: value => { lights = value; binding.sync(); }, flag: value => { flag = value; binding.sync(); }, enable: value => { enabled = value; } };
}
(async () => {
  const f = await fixture(); assert(f.binding.ready()); assert.equal(f.out.at(-1).wants.master, false);
  f.phase('countdown'); f.lights(3); assert.equal(f.out.at(-1).wants.start3, true); assert.equal(f.out.at(-1).wants.start4, false); assert.equal(f.out.at(-1).wants.buzzer, true);
  f.sample(10, [10]); assert.equal(f.calls.length, 0); f.sample(20);
  f.phase('running'); f.binding.power(true); assert.equal(f.out.at(-1).wants.go, true); assert.equal(f.out.at(-1).wants.master, true); assert.equal(f.out.at(-1).wants.relay1, true); assert.equal(f.out.at(-1).wants.relay3, false);
  f.sample(100, [10]); f.sample(1100, [10]); f.sample(1200); assert.deepEqual(f.calls.slice(0, 3), [['hit', 0, 100, true], ['hold', 0, 100], ['free', 0, 1200]]);
  f.flag('yellow'); assert.equal(f.out.at(-1).wants.yellow, true); assert.equal(f.out.at(-1).wants.go, false);
  f.flag('red'); f.binding.power(false); assert.equal(f.out.at(-1).wants.red, true); assert.equal(f.out.at(-1).wants.master, false);
  f.phase('paused'); f.sample(1300, [11]); assert.equal(f.calls.filter(e => e[0] === 'hit').length, 1); f.sample(1400);
  f.flag(''); f.phase('running'); f.binding.power(true); f.cars[1].retired = true; f.binding.sync(); assert.equal(f.out.at(-1).wants.relay2, false);
  f.phase('finished'); assert.equal(f.out.at(-1).wants.master, false); assert.equal(f.out.at(-1).wants.go, false);
  f.binding.off(); await tick(); assert(f.calls.some(e => e[0] === 'release'));
  console.log('ok  race phase, start lights, flags, power, retirement, timestamps and cleanup');
  const t = await fixture({ tokens: true, laneAllowed: lane => lane === 0 }); t.phase('running'); t.binding.power(true); t.sample(100, [10]); t.sample(1100, [10]); t.sample(1200); assert.deepEqual(t.calls, [['hit', 0, 100, false]]); assert.equal(t.out.at(-1).wants.relay2, false); t.binding.off();
  console.log('ok  Time Tokens uses crossings without pit events; unpaid lanes stay off');
  const c = await fixture(); c.phase('running'); c.sample(100, [10]); c.sample(1100, [10]); c.L.setConnected(false); assert(c.calls.some(e => e[0] === 'free')); c.L.setConnected(true); await tick(); assert(c.binding.ready()); c.enable(false); c.sample(2000); c.sample(2100, [10]); assert.equal(c.calls.filter(e => e[0] === 'hit').length, 1); c.binding.off();
  console.log('ok  disconnect clears pit ownership; reconnect acquires again; other hardware cannot count');
  let finish, released; const late = await fixture({ acquire: () => new Promise(r => { finish = r; }), release: async lease => { released = lease; } }); late.binding.off(); finish({ lease: 9 }); await tick(); assert.equal(released, 9); assert.equal(late.out.length, 0);
  console.log('ok  leaving during asynchronous acquisition releases only its own lease');
})().catch(x => { console.error(x); process.exitCode = 1; });
