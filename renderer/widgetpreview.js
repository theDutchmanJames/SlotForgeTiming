// Deterministic, isolated preview races. Use the production engine/formatter for
// stateful options instead of maintaining a second set of display rules.
(function (root) {
  const dep = (file, name) => (typeof module !== 'undefined' ? require('./' + file + '.js') : root[name]);
  const TYPES = new Set(
    dep('widgets', 'Widgets')
      .REGISTRY.filter(d => !d.button)
      .map(d => d.type)
  );
  // Only the fixed scenario keys below are cached. Saved designs/assets are
  // applied to a fresh view on every render, never retained by these engines.
  const scenarios = new Map();
  // (2.4.0, SlotForgeRestyle.md "Try It") scenario 'play' is a sample race that moves: o.lanes cars (2 to 8), o.t ms of race time, o.moment
  // ('lights', 'racing', 'yellow', 'red', 'pit', 'finished'). It is built again for every frame (a few hundred crossings), never cached.
  function context(scenario = 'race', o = {}) {
    const n = scenario === 'play' ? Math.max(1, Math.min(8, Math.round(Number(o.lanes) || 4))) : 8,
      playing = scenario === 'play',
      moment = o.moment || 'racing',
      T = Math.max(0, Number(o.t) || 0);
    const E = dep('engine', 'RaceEngine'),
      En = dep('endurance', 'Endurance'),
      D = dep('damage', 'Damage');
    const names = ['James', 'Bjornie', 'Maria', 'Sam', 'Alex', 'Kim', 'Lee', 'Robin'];
    const entries = names.slice(0, n).map((name, lane) => ({
      lane,
      driverId: 'preview-' + lane,
      driverName: scenario === 'long' ? 'Alexandria van den Berg-Richardson' : name,
      nickname: name + ' Racer',
      callsign: 'P' + (lane + 1),
      carName: scenario === 'long' ? 'ScaleAuto Corvette C7.R Limited Championship Edition' : 'GT3 car ' + (lane + 1),
      flag: ['nl', 'de', 'gb', 'us'][lane % 4],
      tyre: ['S', 'M', 'H', 'SS', 'INT', 'W'][lane % 6],
      participant: 'preview-' + lane,
      teamId: 'team-' + lane,
      teamName: 'Team ' + name,
      raceClass: lane % 2 ? 'prototype' : 'gt3',
      className: lane % 2 ? 'Prototype' : 'GT3',
      roster: [
        { id: 'preview-' + lane, name, nickname: name + ' Racer', callsign: 'P' + (lane + 1) },
        { id: 'relief-' + lane, name: names[(lane + 1) % 8], nickname: 'Relief ' + (lane + 1), callsign: 'R' + (lane + 1) }
      ]
    }));
    const eng = E.createRace({
      type: scenario === 'laps' ? 'race' : 'timed',
      laps: 65,
      duration: 60,
      firstLap: 'count',
      minLap: 100,
      endRule: 'all',
      trackLength: 20,
      endurance: En.clean({ sessionType: 'endurance', swapEvery: 30, swapWarn: 1, swapGrace: 30 }),
      damage: D.clean({ ...D.defaults(), failuresOn: true, failFrom: 100, failTo: 100 }),
      rnd: () => 0.999999,
      fuel: { on: true, tank: 300, perLap: 2, rate: 2, pitHold: 2000, empty: 'warn' },
      tyrewear: dep('tyrewear', 'TyreWear').clean({ setsMode: 'car' }),
      pushsave: dep('pushsave', 'PushSave').clean(dep('pushsave', 'PushSave').defaults()),
      weather: dep('weather', 'Wx').clean({}, 42),
      penalty: { on: true, perPoint: 5 },
      safetycar: dep('safetycar', 'SafetyCar').clean({ target: 15 }),
      classPoints: [25, 18, 15],
      pitControl: { mode: 'manual', seconds: 30 },
      multiclass: dep('multiclass', 'MultiClass').clean({
        display: 'overall',
        classes: [
          { id: 'gt3', name: 'GT3', color: '#63b9db', points: [25, 18, 15] },
          { id: 'prototype', name: 'Prototype', color: '#c6a5f0', points: [25, 18, 15] }
        ]
      }),
      entries
    });
    eng.start(0);
    const history = scenario === 'history';
    if (playing) {
      // every car laps at its own pace with a little wobble; the lane in the pits loses its time there
      const at = [];
      for (let lane = 0; lane < n; lane++) {
        let t = 0;
        for (let lap = 1; lap < 400; lap++) {
          t += 9800 + lane * 137 + Math.round(Math.sin(lap * 1.7 + lane * 2.1) * 260);
          if (t > T || moment === 'lights') break; // (the lights are still counting: nobody has a lap yet)
          at.push([t, lane]);
        }
      }
      at.sort((a, b) => a[0] - b[0]).forEach(([t, lane]) => eng.cross(lane, t));
    } else
      for (let lap = 1; lap <= (history ? 90 : 5); lap++)
        for (let lane = 0; lane < 8; lane++)
          eng.cross(lane, lap * (10000 + lane * 73) + (history ? Math.round(Math.sin(lap * 2.4 + lane) * 160) : 0));
    eng.cars.forEach((car, lane) => {
      car.bop = [-20, 0, 15][lane % 3];
      if (lane % 4 && !playing) eng.addDamage(lane, [0, 3, 9, 10][lane % 4], history ? 949000 : 60000);
    });
    const now = playing ? T : history ? 950000 : scenario === 'swap-soon' ? 1770000 : scenario === 'swap-due' ? 1812000 : 83000;
    if (playing) {
      if (moment === 'yellow') eng.setFlag('yellow', Math.max(0, T - 1));
      if (moment === 'red') eng.setFlag('red', Math.max(0, T - 1));
      if (moment === 'pit') {
        eng.pitSensor(0, true, Math.max(0, T - 2500));
        eng.block(0, Math.max(0, T - 2500));
      }
      if (moment === 'finished') eng.stop(T);
    }
    if (scenario === 'rows') {
      eng.cars[2].blockAt = 78000;
      eng.cars[3].pending = [{ name: 'Stop and go', seconds: 5 }];
      eng.cars[4].retired = true;
    }
    if (scenario === 'warning')
      eng.cars.forEach(c => {
        c.fuel = 12;
        c.twLife = 9;
      });
    if (scenario === 'pit') {
      eng.cars.forEach((c, i) => {
        eng.pitSensor(i, true, 78000);
        eng.block(i, 78000);
      });
    }
    if (scenario === 'red') eng.setFlag('red', 80000);
    if (scenario === 'finished') eng.stop(80000);
    if (!playing) {
      eng.giveFailure(1, 0, history ? 949000 : 60000);
      eng.giveFailure(2, 1, history ? 949000 : 60000);
    }
    eng.tick(now);
    const heat = {
      idx: 1,
      count: 3,
      before: entries.map((e, i) => [e.participant, 95000 + i * 1000, 95000 + i * 1000]),
      by: 'points',
      breakLeft: 90,
      list: Array.from({ length: 3 }, (_, i) => ({
        name: 'Heat ' + (i + 1),
        drivers: entries.map(e => ({ lane: e.lane, name: e.driverName })),
        rows: i === 0 ? entries.map((e, j) => ({ pos: j + 1, name: e.driverName, points: 10 - j, laps: 10 })) : []
      }))
    };
    return (typeof module !== 'undefined' ? require('./liveshare.js') : LiveShare).makeShared({
      eng,
      now,
      phase: playing
        ? { lights: 'countdown', red: 'paused', finished: 'finished' }[moment] || 'running'
        : scenario === 'finished'
          ? 'finished'
          : scenario === 'red'
            ? 'paused'
            : 'running',
      lights: playing && moment === 'lights' ? 1 + (Math.floor(T / 800) % 5) : 3,
      setup: { sessionType: scenario === 'laps' ? 'race' : 'timed', laps: 65, duration: 60 },
      layout: { widgets: [] },
      track: { name: 'Preview circuit', targetLap: 10.5, length: 20, lanes: n, laneModifier: 'none', scale: '1:32' },
      heat,
      base: { personal: new Map(entries.map((e, i) => [e.driverId, 9800 + i * 73])), track: 9500, trackName: 'James' },
      flash: new Map(),
      bestBy: new Map(),
      bestAll: 10000,
      bestAllName: 'James',
      champ: { on: true, list: [25, 18, 15, 12, 10, 8, 6, 4], done: entries.map((e, i) => [e.driverId, 30 - i]) }
    });
  }
  function state(w = {}, options = {}) {
    const requested = options.scenario || w.previewScenario;
    const scenario = ['race', 'laps', 'rows', 'history', 'long', 'warning', 'pit', 'red', 'finished', 'swap-soon', 'swap-due'].includes(
      requested
    )
      ? requested
      : ['racelaps', 'lap', 'lapstogo', 'distance', 'distleft', 'info'].includes(w.type)
        ? 'laps'
        : w.type === 'leaderboard'
          ? 'rows'
          : w.type === 'swapsignal'
            ? 'swap-due'
            : w.type === 'swaptimer'
              ? ['race', 'swap-soon', 'swap-due'][(w.lane || 0) % 3]
              : ['lastlap', 'racechart'].includes(w.type)
                ? 'history'
                : 'race';
    // (2.4.0) a sample race that moves (play) comes in ready, through the options or the editor's preview context
    const played = options.play || (w.previewContext && w.previewContext.play);
    if (!played && !scenarios.has(scenario)) scenarios.set(scenario, context(scenario));
    const base = played || scenarios.get(scenario),
      assets = w.previewContext || {},
      layout = options.layout || assets.layout || w.previewLayout || base.layout;
    const S = {
      ...base,
      ...assets,
      ...options,
      preview: true,
      layout,
      now: base.now + (options.offset || 0),
      laneColorsOf: lane => {
        const lc = layout.laneColors?.[lane] || {};
        return { bg: lc.bg || '', color: lc.text || '' };
      }
    };
    // A layout preview needs an explicit track and matching sample lanes; eight
    // synthetic lanes would otherwise force a two-lane imported circuit back to the oval.
    if (
      w.type === 'racechart' &&
      assets.chartPreviewTrack &&
      (S.chartDesigns || []).find(d => d.id === w.opt?.chartDesign)?.style === 'track'
    ) {
      S.track = assets.chartPreviewTrack;
      S.eng = { ...S.eng, cars: S.eng.cars.filter(c => c.lane < Number(S.track.lanes)), rivals: [] };
    }
    if (w.type === 'tokenclock')
      S.tokens = dep('tokens', 'Tokens').view({
        ends: Array.from({ length: 8 }, (_, i) => S.now + (i % 3 === 2 ? 45000 : 600000 + i * 60000)),
        warnMs: 60000
      });
    if (w.type === 'nextheat') S.phase = 'between';
    // Optional transient state belongs to the preview host, never to saved options.
    const flag = w.previewState;
    return flag
      ? {
          ...S,
          phase: flag === 'red' ? 'paused' : flag === 'yellow' ? 'running' : flag,
          eng: { ...S.eng, flag: ['red', 'yellow'].includes(flag) ? flag : S.eng.flag }
        }
      : S;
  }
  function content(w, options) {
    if (!TYPES.has(w.type)) return null;
    return dep('timing', 'Timing').content({ ...w, lane: w.lane ?? 0 }, state(w, options));
  }
  function values(scope, scenario = 'race', lane = 0) {
    const S = state({}, { scenario }),
      T = dep('timing', 'Timing'),
      v = T.composeValues(S, scope === 'lane' ? S.carByLane(lane) : null, S.now);
    if (scenario === 'missing') Object.keys(v).forEach(k => (v[k] = null));
    return v;
  }
  // (2.4.0, "Try It") the sample race at a moment: the shared state the widgets read, and a line for the bar (lap and clock)
  function play(o = {}) {
    const S = context('play', o),
      lead = Math.max(0, ...S.eng.cars.map(c => c.laps.length)),
      sec = Math.floor((Number(o.t) || 0) / 1000);
    return { shared: S, lap: lead, clock: `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` };
  }
  const api = { TYPES, context, state, content, values, play };
  root.WidgetPreview = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
