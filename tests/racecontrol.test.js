'use strict';
// 2.4.0: Race Control (renderer/racecontrol.js, SlotForgeRestyle.md "Race Control"): the bar on top of the race window (the state in words with the
// colour of its flag, the clock, the controls whatever the layout has, the timing status and Tools), the call that waits as a decision, the order as a
// timing tower, the race screen as a monitor. And the engine's decisions on a call, the default layout for eight lanes, and how race.js uses it.
const test = require('node:test'),
  assert = require('node:assert/strict');
const RC = require('../renderer/racecontrol.js'),
  E = require('../renderer/engine.js');
const { code, has } = require('./source.cjs');

test('the state in words: ready, the lights, green, a track call, caution, red, paused, the break', () => {
  const s = o => RC.stateOf({ phase: 'running', flag: '', ...o });
  assert.deepEqual(
    ['ready', 'countdown', 'running', 'paused', 'between'].map(phase => s({ phase }).key),
    ['ready', 'countdown', 'green', 'paused', 'between']
  );
  assert.equal(s({ lapLine: 'Lap 6 of 50 · Anna leads by 0.120' }).sub, 'Lap 6 of 50 · Anna leads by 0.120');
  const call = s({
    flag: 'yellow',
    calls: [
      { lane: 0, name: 'Anna', at: '0:11' },
      { lane: 2, name: 'Chris', at: '0:12' }
    ]
  });
  assert.deepEqual([call.key, call.kicker, call.title], ['yellow', 'Yellow flag', 'Track call · lane 1']);
  assert.equal(call.sub, 'Anna called at 0:11 (and 1 more). Decide below.');
  assert.equal(s({ flag: 'yellow' }).title, 'Caution');
  assert.deepEqual(
    [s({ phase: 'paused', flag: 'red' }).key, s({ phase: 'paused', flag: 'red' }).title],
    ['red', 'Race stopped'],
    'red wins over the pause it makes'
  );
  assert.equal(s({ restarting: true, flag: 'red' }).key, 'countdown', 'lifting a red flag: the lights first');
  assert.equal(s({ phase: 'between', picking: true }).sub, 'Choose the lanes of the final first.');
});

test('the controls: one main action for the state, the flags outlined (filled while out), Stop as red text, nothing the state cannot do', () => {
  const ctl = (o, x) => RC.controlsOf(RC.stateOf({ phase: 'running', flag: '', ...o }), x || {});
  const acts = c => c.map(b => b.act + (b.cls.includes('primary') ? '!' : '') + (b.disabled ? '-' : '')).join(' ');
  assert.equal(acts(ctl({ phase: 'ready' })), 'start! yellow- red- home');
  assert.equal(acts(ctl({})), 'pause yellow red stop');
  assert.equal(acts(ctl({ flag: 'yellow' }, { flag: 'yellow' })), 'pause yellow red stop');
  assert(
    ctl({ flag: 'yellow' }, { flag: 'yellow' })
      .find(b => b.act === 'yellow')
      .cls.includes(' on'),
    'the yellow is filled while it is out'
  );
  assert.equal(acts(ctl({ phase: 'paused', flag: 'red' })), 'red! yellow- red stop', 'Resume lifts the red flag');
  assert(
    ctl({ phase: 'paused', flag: 'red' })
      .find(b => b.act === 'red' && !b.cls.includes('primary'))
      .cls.includes(' on')
  );
  assert.equal(acts(ctl({ phase: 'paused' })), 'pause! yellow- red stop');
  assert.equal(acts(ctl({ phase: 'countdown' })), 'start- yellow- red- stop-');
  assert.equal(acts(ctl({ phase: 'between', picking: true }, { picking: true })), 'start!- stop');
  assert.equal(ctl({}).find(b => b.act === 'stop').cls, 'rc-stop');
  assert.deepEqual(
    ctl({}).map(b => b.key),
    ['Space', 'Y', 'R', 'S'],
    'every control says its key'
  );
});

test('the bar: a stripe in the colour of the flag, the race, the state, the clock, the controls with their keys, the pills and Tools', () => {
  const S = RC.stateOf({ phase: 'running', flag: '', lapLine: 'Lap 6 of 50' });
  const html = RC.barHtml({
    race: 'Check race · 50 laps · Club Oval',
    state: S,
    clock: '0:11.0',
    clockNote: '44 laps to go',
    controls: RC.controlsOf(S),
    sim: true
  });
  assert.match(html, /^<div class="rc-flag" aria-hidden="true"><\/div>/);
  assert.match(
    html,
    /<div class="rc-race">Check race · 50 laps · Club Oval<\/div><div data-rc-part="state" role="status" aria-live="polite"><div class="rc-k">Green flag<\/div><div class="rc-t">Racing<\/div><div class="rc-s">Lap 6 of 50<\/div>/
  );
  assert.match(html, /<div class="rc-msg" data-rc-msg><\/div>/, 'a place for the status line of the race');
  assert.match(html, /data-rc-part="clock"><b>0:11\.0<\/b><small>44 laps to go<\/small>/);
  assert.match(html, /<button type="button" class="btn " data-rc="pause"><span>Pause<\/span><kbd>Space<\/kbd><\/button>/);
  assert.match(html, /class="btn rc-stop" data-rc="stop"><span>Stop<\/span><kbd>S<\/kbd>/);
  assert.match(html, /rc-pill sim"[^>]*><i><\/i>Simulated<\/span>/, 'simulated cars are said in amber');
  assert.match(
    html,
    /<details class="rc-tools" data-rc-tools><summary class="btn">Tools<\/summary><div class="rc-menu" data-rc-menu><\/div><\/details>/
  );
  assert.equal(RC.COLOR.yellow, '#f5c518');
  assert.equal(RC.COLOR.red, '#e5484d');
});

test('a call as a decision: the lane in its colour, who called and when, Resume racing first, a lap given or taken, red, a note for the log', () => {
  const html = RC.callsHtml([{ id: 3, lane: 1, name: 'Bjorn', color: '#3b82f6', at: '0:32', lap: 6 }], { penalty: true });
  assert.match(html, /<div class="rc-call" style="--c:#3b82f6"><span class="rc-cl-lane">2<\/span>/);
  assert.match(html, /<h3>Track call · lane 2 · Bjorn<\/h3><p>Called at 0:32, lap 6\./);
  assert.deepEqual(
    [...html.matchAll(/data-call="([a-z]+)"/g)].map(m => m[1]),
    ['resume', 'penalty', 'lapplus', 'lapminus', 'red']
  );
  assert.match(html, /class="btn primary" data-call="resume" data-id="3">Resume racing/);
  assert.match(html, /<input type="text" maxlength="120" data-call-note="3"/);
  assert(
    !RC.callsHtml([{ id: 3, lane: 1, name: 'B' }], { penalty: false }).includes('data-call="penalty"'),
    'no penalty point without a penalty system'
  );
  assert(!RC.callsHtml([{ id: 3, lane: 1, name: 'B', dq: true }], { penalty: true }).includes('data-call="penalty"'));
  assert.equal(RC.callsHtml([], {}), '');
});

test('the order as a timing tower: places in podium colours, the lane stripe, laps, last and best (the fastest in purple), the gap, chips', () => {
  const rows = [
    {
      pos: 1,
      name: 'Anna',
      car: 'NSR',
      lane: 0,
      color: '#e5484d',
      laps: 6,
      last: 5160,
      best: 5060,
      chips: [{ text: 'Call', kind: 'call' }]
    },
    {
      pos: 2,
      name: 'Bjorn',
      car: 'Mosler',
      lane: 1,
      color: '#3b82f6',
      laps: 6,
      last: 5290,
      best: 5190,
      gap: '+0.780',
      chips: [{ text: 'Pit', kind: 'pit' }]
    }
  ];
  const html = RC.towerHtml(rows, { fastest: 5060 });
  assert.equal((html.match(/class="rc-tr"/g) || []).length, 2);
  assert.match(html, /rc-p p1" role="cell">1</);
  assert.match(html, /<span class="rc-strp" aria-hidden="true"><\/span>/);
  assert.match(html, /<b>Anna<\/b><small>lane 1 · NSR<\/small>/);
  assert.match(html, /<span class="rc-chip call">Call<\/span>/);
  assert.match(html, /<span class="rc-chip pit">Pit<\/span>/);
  assert.match(html, /rc-v fl" role="cell">5\.060<small>best/);
  assert.match(html, /rc-g lead" role="cell">Leader/);
  assert.match(html, /rc-g" role="cell">\+0\.780/);
  assert.match(RC.towerHtml([]), /The order shows here once the race is on/);
});

test('the monitor: ON SCREEN, the layout, Hide S M L (a size that is not known is M), full screen', () => {
  const html = RC.monitorHead('s', 'Default layout');
  assert.match(html, /<span class="rc-live"><i><\/i>On screen<\/span><b>Race screen<\/b><small>Default layout<\/small>/);
  assert.deepEqual(
    [...html.matchAll(/data-rc-size="([a-z]+)" aria-pressed="(true|false)"/g)].map(m => m[1] + (m[2] === 'true' ? '*' : '')),
    ['hide', 's*', 'm', 'l']
  );
  assert.match(html, /data-rc="fullscreen"/);
  assert.equal(RC.sizeOf('xl'), 'm');
  assert.equal(RC.sizeOf(undefined), 'm');
});

test('the engine: a lap given or taken, the red flag, a note; racing resumes after the last call when the yellow was of a call', () => {
  const race = () => {
    const r = E.createRace({ entries: [{ lane: 0 }, { lane: 1 }, { lane: 2 }], lapLimit: 50 });
    r.start(0);
    r.cross(0, 5000);
    r.cross(1, 5100);
    return r;
  };
  let r = race();
  r.call(0, 6000);
  assert.equal(r.flag, 'yellow');
  assert.equal(r.resolveCall(1, 'lapplus', 7000, { note: '  Deslot in the hairpin ', resume: true }), true);
  assert.equal(r.cars[0].adjLaps, 1, 'a lap given');
  assert.equal(r.flag, '', 'the last call settled: the yellow of the call goes in, racing resumes');
  const end = r.events.find(e => e.type === 'callend');
  assert.deepEqual([end.how, end.note], ['lapplus', 'Deslot in the hairpin']);
  assert(r.events.some(e => e.type === 'raceflag' && e.flag === '' && e.by === 'call'));
  // two calls: the yellow stays until the last is settled
  r = race();
  r.call(0, 6000);
  r.call(1, 6100);
  r.resolveCall(1, 'resume', 6500, { resume: true });
  assert.equal(r.flag, 'yellow', 'another call still waits');
  r.resolveCall(2, 'lapminus', 6600, { resume: true });
  assert.deepEqual([r.flag, r.cars[1].adjLaps], ['', -1]);
  // the Race Director raised the yellow himself: a call does not take it in
  r = race();
  r.setFlag('yellow', 5500);
  r.call(2, 6000);
  r.resolveCall(1, 'resume', 6500, { resume: true });
  assert.equal(r.flag, 'yellow');
  // without resume (the Race Director page, as before) the flag stays
  r = race();
  r.call(0, 6000);
  r.resolveCall(1, 'dismiss', 6500);
  assert.equal(r.flag, 'yellow');
  // red: the red flag goes out and the race pauses
  r = race();
  r.call(0, 6000);
  assert.equal(r.resolveCall(1, 'red', 6500, { resume: true }), true);
  assert.deepEqual([r.flag, r.status], ['red', 'paused']);
  // a lap can not be taken from a car that has none: the call waits
  r = E.createRace({ entries: [{ lane: 0 }], lapLimit: 5 });
  r.start(0);
  r.call(0, 1000);
  assert.equal(r.resolveCall(1, 'lapminus', 1500, { resume: true }), false);
  assert.equal(r.calls[0].open, true);
});

test('race.js: Race Control on the race page (not for a Time Token Session), the race screen without its own controls, the call with its note', () => {
  const race = code('renderer/race.js');
  assert(has(race, "const rcOn = !tokenSession && typeof RaceControl !== 'undefined';"));
  assert(has(race, '<div id="rcbar" class="rc-bar" role="region" aria-label="Race control"></div>'));
  assert(
    has(race, 'rcOn ? Widgets.withoutControls(layout, lanes).layout : layout'),
    'the race screen leaves its own buttons out, as the second screen does'
  );
  assert(has(race, 'if (menu && tools) menu.appendChild(tools);'), 'the tool bar of before is the Tools menu');
  assert(
    has(
      race,
      "actions.callResolve(Number(b.dataset.id), b.dataset.call, rcOn ? { note: note ? note.value : '', resume: true } : undefined);"
    )
  );
  assert(has(race, 'state.settings = await api.setSettings({ raceMonitor: live.rc.size });'), 'the size of the monitor is remembered');
  assert(code('renderer/index.html').includes('<script src="racecontrol.js"></script>'));
  assert(code('renderer/pitwidgets.js').includes("lapplus: 'A lap given'"), 'the log says what was decided');
});
