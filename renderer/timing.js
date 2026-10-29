// Works out what each widget shows on the live timing page. Pure: it only reads the state it is given,
// so it can be tested without a screen. The widgets made in the Widget Builder are drawn here too.
(function (root) {
  const Cw = typeof module !== 'undefined' ? require('./chartwidgets.js') : root.ChartWidgets;
  const Aio = typeof module !== 'undefined' ? require('./allinone.js') : root.AllInOne;
  const Stw = typeof module !== 'undefined' ? require('./strategywidgets.js') : root.StrategyWidgets;
  const Pcw = typeof module !== 'undefined' ? require('./pitwidgets.js') : root.PitWidgets;
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const Bp = typeof module !== 'undefined' ? require('./bop.js') : root.Bop; // Balance of Power (bop.js)
  const Sp = typeof module !== 'undefined' ? require('./speed.js') : root.Speed;
  const Wd = typeof module !== 'undefined' ? require('./widgets.js') : root.Widgets;
  const F = typeof module !== 'undefined' ? require('./frame.js') : root.Frame;
  const Tk = typeof module !== 'undefined' ? require('./tokens.js') : root.Tokens;
  const Dl = typeof module !== 'undefined' ? require('./delta.js') : root.Delta; // the Delta Timers (delta.js)
  const Av = typeof module !== 'undefined' ? require('./avatars.js') : root.Avatars; // the standard avatars of the lanes (avatars.js)
  const Ww = typeof module !== 'undefined' ? require('./weatherwidgets.js') : root.WxW; // the weather widgets (weatherwidgets.js)
  const Tyw = typeof module !== 'undefined' ? require('./tyrewidgets.js') : root.TyreWidgets; // the Tyre Degradation widget and the Tyres cell (tyrewidgets.js, 1.40.0)
  const Pw = typeof module !== 'undefined' ? require('./pacewidgets.js') : root.PaceW; // the Pace meter widget and the Pace cells (pacewidgets.js, 1.54.0)
  const Tw = typeof module !== 'undefined' ? require('./tyrewear.js') : root.TyreWear;
  const En = typeof module !== 'undefined' ? require('./endurance.js') : root.Endurance; // the Endurance Race (endurance.js)
  const Dm = typeof module !== 'undefined' ? require('./damage.js') : root.Damage; // the Damage System (damage.js)
  const Fl = typeof module !== 'undefined' ? require('./failures.js') : root.Failures; // Car Failures (failures.js)
  const Ds = typeof module !== 'undefined' ? require('./distance.js') : root.Distance; // Distance Racing: the distance driven and to go (distance.js)
  const Bo = typeof module !== 'undefined' ? require('./boardorder.js') : root.BoardOrder; // the order of a leaderboard (boardorder.js)
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  // A cache belongs to one synchronous paint, never to lap-count or wall time.
  // The next paint sees lap edits, invalidations, removal, pit changes and restores.
  const FRAME=Symbol('widget-frame');
  const gapBenchmarks=new WeakMap();
  const beginFrame=S=>({...S,[FRAME]:new WeakMap()});
  function lapStats(S,c,kind='average') {
    let byKind=S?.[FRAME]?.get(c);if(!byKind){byKind={};S?.[FRAME]?.set(c,byKind);}
    if(!byKind[kind]){
      const laps=Object.freeze((kind==='good'?E.goodLaps(c):E.averageLaps(c)).slice());
      let avg,med;
      byKind[kind]=Object.freeze({laps,get mean(){return avg??(avg=mean(laps));},get median(){return med??(med=median(laps));}});
    }
    return byKind[kind];
  }
  function contentKey(w,S) {
    if(Wd.def(w.type)?.updates!=='identity'||Object.keys(w.opt||{}).length)return null;
    const c=S.carByLane(w.lane);if(c?.virtual||c?.virtualRival)return null;
    const field={name:'driverName',nickname:'nickname',callsign:'callsign',carname:'carName'}[w.type];
    const token=S.tokens&&c?S.tokens.stateOf(w.lane,S.eng.elapsed(S.now)):null;
    return JSON.stringify([w.type,w.lane,!!c,c?.[field],c?.driverName,token,S.tokens?.outColor]);
  }
  const clockText = ms => { const d = Math.max(0, Math.floor(ms / 100)), p2 = n => String(n).padStart(2, '0'); return `${p2(Math.floor(d / 600))}:${p2(Math.floor(d / 10) % 60)}.${d % 10}`; }; // always 00:00.0
  const mmss = ms => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }; // time remaining
  const contrast = Dl.onColor; // black or white text, whichever reads better on a colour

  // A finished lap is a track record if it beats every earlier lap on the track, a personal best if it beats
  // the driver's earlier laps. The very first lap ever set is neither, so nothing flashes for it.
  function classifyLap(time, prevPersonal, prevTrack) {
    if (Number.isFinite(prevTrack) && time < prevTrack) return 'record';
    if (Number.isFinite(prevPersonal) && time < prevPersonal) return 'pb';
    return '';
  }

  // the name of the race for the widgets: "Heat 2 of 3", or "Final A" (a heat race with finals; S.heat.final is also set after the last final)
  const heatLabel = h => (h.final ? `Final ${h.final}` : `Heat ${Math.min(h.idx + 1, h.count)} of ${h.count}`);
  const lapLimitOf = setup => ((setup.sessionType === 'race' && setup.raceBy !== 'time') || (setup.sessionType === 'heats' && setup.heatBy !== 'time')) ? Number(setup.laps) || 0 : 0; // (1.62.0: a Race limited by a time has no laps to drive)
  const timeLimitOf = setup => (setup.sessionType === 'timed' || (setup.sessionType === 'race' && setup.raceBy === 'time') || setup.sessionType === 'qualifying' || (setup.sessionType === 'heats' && setup.heatBy === 'time')) ? (Number(setup.duration) || 0) * 60000 : 0;
  // The laps a car has to drive: in a Distance Race the laps of its own lane, else the laps of the race. 0: no limit.
  const limitFor = (S, c) => (S.eng.distance && S.eng.limitOf ? S.eng.limitOf(c) : lapLimitOf(S.setup));
  // The laps of the race as a whole: the lap the leader is on, and the laps the leader has to drive (in a Distance Race the leader's lane may have more or fewer laps than another)
  function raceLaps(S) {
    if (S.eng.distance && S.eng.limitOf) { const lead = (S.standings()[0] || {}).car; if (lead) return { total: S.eng.limitOf(lead), most: lead.laps.length, cur: lead.done ? lead.laps.length : lead.laps.length + 1 }; }
    const total = lapLimitOf(S.setup), most = Math.max(0, ...S.eng.cars.map(x => x.laps.length));
    return { total, most, cur: S.eng.cars.some(x => x.done && x.laps.length === most) ? most : most + 1 };
  }
  // The look at the distance of a car (distance.js look): its lane in metres from the race (a Distance Race) or from the track, the laps that count, the laps it has to drive, and for a smooth distance the part of the lap it is in
  function distLook(S, c, smooth) {
    const d = S.eng.distance, ln = d && d.lanes[Math.min(d.lanes.length - 1, c.lane | 0)], len = ln && ln.length > 0 ? ln.length : Sp.laneLength(S.track || {}, c.lane) || 0;
    const i = S.eng.cars.indexOf(c), laps = S.eng.lapsOf ? S.eng.lapsOf(c) : c.laps.length, lap = smooth && !c.done ? Ds.expectedLap(c.laps, c.bad) : null;
    return Ds.look(len, laps, limitFor(S, c), lap ? { lapMs: lap, sinceMs: i >= 0 ? S.eng.lapElapsed(i, S.now) : 0 } : null);
  }
  const distUnit = (S, opt) => Ds.unitOf(opt, S.distUnit);
  const distLaneVars = (S, c) => {
    const l = distLook(S, c, true), u = distUnit(S, {});
    return { distance: l.driven === null ? '\u2013' : Ds.text(l.driven, u), distleft: l.left === null ? '\u2013' : Ds.text(l.left, u), lapstogo: l.lapsLeft === null ? '\u2013' : l.lapsLeft };
  };
  const sessionLabel = { practice: 'Free practice', qualifying: 'Qualifying', race: 'Race', timed: 'Timed race', heats: 'Heats', endurance: 'Endurance', tokens: 'Time tokens' };
  const flagText = { ready: 'Ready', running: 'Racing', paused: 'Paused', between: 'Heat finished', finished: 'Finished' };


  // Endurance Race: the look at the swaps of a car (nothing for a car that does not swap), and the name of a driver of its team as the widget wants it
  const swapLook = (S, c, t) => { const i = S.eng.cars.indexOf(c); return c && c.en && S.eng.endurance && S.eng.enLook && i >= 0 ? S.eng.enLook(i, t) : null; };
  const rosterName = (c, id, how) => { const r = (c.roster || []).find(x => x.id === id); return r ? (how === 'nickname' ? r.nickname || r.name : how === 'callsign' ? r.callsign || r.name : r.name) || '' : ''; };
  function swapVars(S, c, t) {
    const l = swapLook(S, c, t); if (!l) return { nextdriver: '–', swap: '–', stint: '–' };
    return { nextdriver: esc(rosterName(c, l.next) || '–'), swap: esc(En.chipOf(S.eng.endurance, l).text), stint: En.clock(l.stintMs) };
  }

  // Damage System: the look at the damage of a car (null: the race has no damage rules), and what the custom texts can say of it
  const damageLook = (S, c, t) => { const i = S.eng.cars.indexOf(c); return c && S.eng.damage && S.eng.damageOf && i >= 0 ? S.eng.damageOf(i, t) : null; };
  const damageName = d => (d.out ? (d.out === 'dq' ? 'Disqualified' : 'Retired') : d.level >= 0 ? d.name : d.points > 0 ? 'Minor damage' : 'No damage');
  function damageVars(S, c, t) {
    const d = damageLook(S, c, t); if (!d) return { damage: '–', damagelevel: '–', repairs: '–' };
    return { damage: d.points, damagelevel: esc(damageName(d)), repairs: d.repairs };
  }
  // Car Failures: the look at the failure of a car (null: the race has none), and what the custom texts can say of it
  const failureLook = (S, c, t) => { const i = S.eng.cars.indexOf(c); return c && S.eng.failures && S.eng.failureOf && i >= 0 ? S.eng.failureOf(i, t) : null; };
  function failureVars(S, c, t) {
    const f = failureLook(S, c, t); if (!f) return { failure: '\u2013', failures: '\u2013' };
    return { failure: esc(f.out ? (f.out === 'dq' ? 'Disqualified' : 'Retired') : f.active ? f.name : 'No failure'), failures: f.count };
  }
  const lapsWord = n => `${n} lap${n === 1 ? '' : 's'}`;

  // A timing gap can be expressed as a share of a lap without pretending that we
  // know a car's exact position between sensors. The engine's adjusted gap is
  // converted at the leader's median valid pace, so penalties and review changes
  // remain part of the estimate. Practice and qualifying compare best laps, not
  // race position, and stay in time.
  function gapLaps(S, c) {
    if (!S || !c || ['practice', 'qualifying'].includes(S.setup && S.setup.sessionType) || !S.eng || typeof S.eng.gapInfo !== 'function') return '';
    const rows = S.standings() || [], row = S.rowOf(c), leader = rows[0] && rows[0].car, index = S.eng.cars.indexOf(c);
    if (!row || row.pos <= 1 || !leader) return '';
    const info = Number.isFinite(row.gapMs)?{lead:row.gapMs}:index>=0&&!leader.virtualRival?S.eng.gapInfo()[index]:null, stats=lapStats(S,leader),laps=stats.laps;
    const Ps = typeof module !== 'undefined' ? require('./pushsave.js') : globalThis.PushSave;
    const policy = Ps?.estimatePolicy(S.eng.cfg?.calculations?.estimates || {});
    // The statistics object lasts for this paint only; non-frame calls get a fresh object.
    const key=policy?JSON.stringify([policy.gapMethod,policy.gapWindow]):'median';
    let estimates=gapBenchmarks.get(stats);if(!estimates){estimates=new Map();gapBenchmarks.set(stats,estimates);}
    if(!estimates.has(key))estimates.set(key,policy ? Ps.benchmark(policy.gapMethod, laps, 0, {window:policy.gapWindow,minimum:1}) : laps.length ? stats.median : NaN);
    const pace=estimates.get(key);
    if (!info || !Number.isFinite(info.lead) || !(pace > 0)) return '';
    const value = Math.round(info.lead / pace * 10) / 10;
    if (!(value > 0)) return '';
    return `+${value.toFixed(1)} ${value === 1 ? 'lap' : 'laps'}`;
  }
  function gapText(S, c, opt) {
    const time = (S.rowOf(c) || {}).gap || '', display = opt && ['time', 'laps', 'both'].includes(opt.display) ? opt.display : 'time';
    if (display === 'time' || !time || !time.startsWith('+')) return time;
    const laps = gapLaps(S, c);
    return display === 'laps' ? (laps || time) : laps ? `${time} · ${laps}` : time;
  }

  // The {variables} of the custom text widgets. Values are already safe to put in HTML.
  function laneVars(S, c, t) {
    const E_ = S.eng, i = E_.cars.indexOf(c), row = S.rowOf(c), laps = c.laps.length, g = lapStats(S,c,'good').laps, F = E_.fuel, P = E_.penalty, track = S.track || {}, ch = S.champ;
    const speedOf = scaled => { const ms = laps ? c.laps[laps - 1] : null, base = Sp.kmh(Sp.laneLength(track, c.lane), ms), f = scaled ? (Sp.scaleFactor(c.carScale) || Sp.scaleFactor(track.scale)) : 1; return base === null || !f ? '–' : (base * f).toFixed(scaled ? 0 : 1); };
    const pit = E_.pitTime(i, t), sec = P && P.on ? E_.penMs(c) / 1000 : 0, best = S.personalBest(c.driverId);
    let champ = '–'; if (ch && ch.on) { champ = ch.done.get(c.asTeam ? c.teamId : c.driverId) || 0; if (['running', 'paused', 'review'].includes(S.phase) && E_.cars.some(x => x.laps.length)) champ += ch.list[(row.physicalPos || row.pos) - 1] || 0; }
    return { name: esc(c.driverName), team: esc(c.teamName || ''), nickname: esc(c.nickname || c.driverName), callsign: esc(c.callsign || ''), car: esc(c.carName || ''), lane: c.lane + 1, position: row.pos, lap: c.done ? laps : laps + 1, laps,
      laptime: c.done ? '–' : E.fmtTime(E_.lapElapsed(i, S.now)), last: laps ? E.fmtTime(c.laps[laps - 1]) : '–', best: c.best === null ? '–' : E.fmtTime(c.best), avg: g.length ? E.fmtTime(lapStats(S,c,'good').mean) : '–', median: g.length ? E.fmtTime(lapStats(S,c,'good').median) : '–',
      record: Number.isFinite(best) ? E.fmtTime(best) : '–', gap: esc(row.gap),
      fuel: F && F.on ? `${(Math.floor(E_.fuelOf(i, t) * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')} L` : '–', fuelpct: F && F.on && F.tank ? Math.round(E_.fuelOf(i, t) / (E_.tankOf ? E_.tankOf(i) : F.tank) * 100) + '%' : '–', bop: c.bop ? Bp.signed(c.bop) : '–',
      penpoints: P && P.on ? (c.dq ? 'DQ' : c.points) : '–', pentime: P && P.on ? `+${Number.isInteger(sec) ? sec : sec.toFixed(1)} s` : '–', champ, pits: c.pits ? c.pits.length : 0, pit: pit ? E.fmtTime(pit.ms) : '–', speed: speedOf(true), speedreal: speedOf(false), ...swapVars(S, c, t), ...damageVars(S, c, t), ...failureVars(S, c, t), ...distLaneVars(S, c), ...Ww.laneVars(c, E_) };
  }
  function raceVars(S, t) {
    const rl = raceLaps(S), laps = rl.total, time = timeLimitOf(S.setup), lead = S.standings()[0], most = rl.most, sr = S.sessionRecord ? S.sessionRecord() : null, tr = S.trackRecord ? S.trackRecord() : null;
    const st = flagStateOf(S);
    const rec = r => (r && Number.isFinite(r.time) ? E.fmtTime(r.time) : '–'), by = r => (r && Number.isFinite(r.time) && r.name ? esc(r.name) : '');
    return { clock: clockText(S.eng.elapsed(t)), timeleft: time ? mmss(Math.max(0, time - S.eng.elapsed(t))) : '–', lapsleft: laps ? Math.max(0, laps - most) : '–', lapstotal: laps || '–', racedistance: S.eng.distance ? Ds.text(S.eng.distance.distance, distUnit(S, {})) : '–', leader: lead && lead.car ? esc(lead.car.driverName) : '–',
      flag: st === 'red' ? 'Red flag' : st === 'yellow' ? (S.eng.safetyCar ? 'Safety Car' : 'Yellow flag') : flagText[st] || '', heat: S.heat ? heatLabel(S.heat) : '',
      track: esc((S.track && S.track.name) || ''), session: esc(S.setup.name || ''), type: esc(sessionLabel[S.setup.ofType || (S.setup.sessionType === 'race' && S.setup.raceBy === 'time' ? 'timed' : S.setup.sessionType)] || ''), // (1.62.0: a Race limited by a time is a Timed race, as the race screen says)
       sessionrecord: rec(sr), sessionrecordby: by(sr), trackrecord: rec(tr), trackrecordby: by(tr), yellowtarget: S.eng.yellow && S.eng.yellow.target > 0 ? E.fmtTime(S.eng.yellow.target) : '', ...Ww.raceVars(S.eng, t) };
  }

  // Total Time (1.63.0): how long the car has been racing, in milliseconds: { heat: in this race or heat, all: in all heats so far }, with the time penalties and the corrections of the review (penalties)
  // or without. t: the moment to read it at. The heats that are done come with the heat info (before: [[participant, ms with penalties, ms without]], see the engine's spentBy). Once the last heat is
  // recorded, or the event was stopped after a heat, the engine on the screen is that heat and it is in those figures already, so it is not added a second time. A race that is not a heat race has no heats before it.
  function totalTimes(c, S, t, penalties) {
    const E_ = S.eng, h = S.heat, now = E_.spentOf ? E_.spentOf(c, t, penalties) : NaN;
    const mine = h && Array.isArray(h.before) && c.participant !== undefined ? h.before.find(x => x && x[0] === c.participant) : null, prior = mine ? Number(penalties ? mine[1] : mine[2]) || 0 : 0;
    const recorded = !!h && !!mine && (S.phase === 'finished' || h.idx >= (h.total || h.count || 0));
    return { heat: now, all: recorded ? prior : prior + now };
  }
  // ---------- 1.67.0: a leaderboard that counts over all heats ----------
  // The leaderboard setting "Count over: All heats so far" draws every participant of a heat race, in the order of the overall result, from a state of its own: the real state, with the cars
  // replaced by "overall cars" (virtual: true). An overall car holds who the participant is (S.roster), what the heats that are done left behind (S.prior: laps, points, best lap, metres and the lap
  // times that count) and the car that is racing now (real; none for a driver who is not on track): its laps are the lap times that count in all heats, its best lap the best of all heats, so the
  // widgets that show a lap time, the average or the median work as they are. What cannot be added up (the lap that runs, fuel, tyres, penalties...) is the real car's, a dash for a driver who is not racing.
  const OVER_FIELDS = new Set(['classname','classposition','classgap','classpoints','classbest','position', 'gap', 'name', 'nickname', 'callsign', 'avatar', 'driverflag', 'carname', 'carpicture', 'teamname', 'teampicture', 'lanecolor', 'bestlap', 'avglap', 'medlap', 'lastlap', 'recordlap']); // (from the fields of the overall car)
  const finiteMin = (a, b) => { const x = Number.isFinite(a) ? a : Infinity, y = Number.isFinite(b) ? b : Infinity, m = Math.min(x, y); return m === Infinity ? null : m; };
  function overallState(S) {
    if (S.__over !== undefined) return S.__over;
    const se = S.season && Array.isArray(S.season.order) && S.season.order.length ? S.season : null, h = se || S.heat, ro = S.roster, pr = Array.isArray(S.prior) ? S.prior : [], pa = Array.isArray(S.past) ? S.past : []; // (1.68.0: in a race of a championship the order is that of the standings of the championship, if the race ended now)
    let res = null;
    if (h && Array.isArray(h.order) && h.order.length && Array.isArray(ro) && ro.length) {
      const kind = h.ovBy || 'laps', lead = h.order[0] ? h.order[0][1] : null, real = new Map(S.eng.cars.map(c => [c.participant, c])), cars = new Map();
      // once the last heat is recorded (or the event was stopped after a heat) the engine on the screen is that heat and its laps are in what the heats left behind already: they are not counted a second time (1.68.0; 1.67.0 counted them twice)
      const recorded = !!S.heat && S.phase === 'finished';
      const gapOf = score => { // how far behind the leader of the overall result, in what the result counts
        if (!Number.isFinite(score) || !Number.isFinite(lead)) return '';
        const d = kind === 'time' ? score - lead : lead - score;
        if (!(d > 1e-9)) return '';
        return kind === 'time' ? '+' + E.fmtTime(d) : kind === 'points' ? '−' + Math.round(d * 100) / 100 : kind === 'distance' ? '+' + Ds.text(d, S.distUnit === 'ft' ? 'ft' : 'm') : '+' + d + (d === 1 ? ' lap' : ' laps');
      };
      const rows = h.order.map(([p, score], i) => {
        const id = ro[p] || {}, rc = real.get(p) || null, rl = rc && !recorded ? rc : null, pri = pr.find(x => x && x.p === p) || null, pst = pa.find(x => x && x.p === p) || null, pv = (pst && Array.isArray(pst.valid) ? pst.valid : []).concat(pri && Array.isArray(pri.valid) ? pri.valid : []), k = pv.length, shift = a => (Array.isArray(a) ? a.map(n => n + k) : []); // (the lap times of the earlier rounds, then those of the earlier heats)
        const vc = { raceClass:id.raceClass||'', virtual: true, real: rc, participant: p, lane: rc ? rc.lane : 1000 + p, prior: pri, past: pst,
          driverId: id.driverId || '', carId: id.carId || '', driverName: id.driverName || '', nickname: id.nickname || '', callsign: id.callsign || '', flag: id.flag || '', avatar: id.avatar || '', carName: id.carName || '', carPicture: id.carPicture || '', carScale: id.carScale || '',
          teamId: id.teamId || '', teamName: id.teamName || '', teamPicture: id.teamPicture || '', asTeam: !!id.asTeam,
          recorded, laps: pv.concat(rl ? rl.laps : []), bad: pv.map(() => false).concat(rl ? rl.bad || [] : []), invalid: rl ? shift(rl.invalid) : [], removed: rl ? shift(rl.removed) : [], pitLaps: rl ? shift(rl.pitLaps) : [],
          best: finiteMin(finiteMin(pst && pst.best, pri && pri.best), rl && rl.best), lapsAll: (pst ? Number(pst.laps) || 0 : 0) + (pri ? Number(pri.laps) || 0 : 0) + (rl ? (S.eng.lapsOf ? S.eng.lapsOf(rl) : rl.laps.length) : 0),
          retired: !!(rc && rc.retired), dq: !!(rc && rc.dq), outOfFuel: !!(rc && rc.outOfFuel), blockAt: rc ? rc.blockAt : null, pending: rc ? rc.pending : [] };
        cars.set(vc.lane, vc);
        return { ...(S.season?.classRows||S.heat?.classRows||[]).find(x=>x.participant===p),pos: i + 1, index: i, car: vc, gap: i === 0 ? '' : gapOf(score) };
      });
      rows.forEach(r=>{if(!r.raceClass)return;const best=rows.filter(x=>x.raceClass===r.raceClass&&Number.isFinite(x.car.best)).map(x=>x.car.best);r.classBest=best.length?Math.min(...best):null;});
      res = Object.assign(Object.create(S), { base: S, over: true, standings: () => rows, carByLane: lane => cars.get(lane) || null, rowOf: c => (c && c.virtual ? rows.find(x => x.car === c) : S.rowOf(c)) });
    }
    try { Object.defineProperty(S, '__over', { value: res, enumerable: false, configurable: true, writable: true }); } catch (e) { /* (a state that cannot be written to is made again at every look) */ }
    return res;
  }
  // the time a participant has raced in all heats so far (and in this one): { heat, all }, the same as totalTimes; a driver who is not racing now has only the heats that are done
  function overallTotals(c, S0, t, penalties) {
    const add = c.past ? Number(penalties ? c.past.t0 : c.past.t1) || 0 : 0; // (1.68.0: the time of the earlier rounds of the championship)
    if (c.real) { const v = totalTimes(c.real, S0, t, penalties); return { heat: v.heat, all: Number.isFinite(v.all) ? v.all + add : v.all }; }
    const h = S0.heat, mine = h && Array.isArray(h.before) ? h.before.find(x => x && x[0] === c.participant) : null, v = mine ? Number(penalties ? mine[1] : mine[2]) : NaN;
    return { heat: NaN, all: Number.isFinite(v) ? v + add : add > 0 ? add : NaN };
  }
  // the championship points of a participant as the widget shows them: the heats that are done, and what the place of the car in the race that is racing now is worth
  function overallPoints(c, S0, live) {
    if (S0.season && Array.isArray(S0.season.pts)) { // (1.68.0: a race of a championship: the points of the championship, with this race counted as if it ended now; without the live part: before this race)
      const x = S0.season.pts.find(q => q && q[0] === c.participant), v = x ? x[live === false ? 2 : 1] : null;
      return Number.isFinite(v) ? v : null;
    }
    const ch = S0.champ; if (!ch || !ch.on) return null;
    let pts = ch.done.get(c.asTeam ? c.teamId : c.driverId) || 0;
    if (live !== false && (c.real || !c.virtual) && ['running', 'paused', 'review'].includes(S0.phase) && S0.eng.cars.some(x => x.laps.length)) pts += ch.list[S0.rowOf(c.real || c).pos - 1] || 0;
    return pts;
  }
  // what a widget of an overall car shows; null: it is made from the fields of the car, as for any car
  function overallContent(w, type, opt, c, S, t) {
    const S0 = S.base || S;
    if (OVER_FIELDS.has(type)) return null;
    switch (type) {
      case 'lap': return { html: String(c.lapsAll) }; // (the laps driven in all heats so far)
      case 'totaltime': return { html: Wd.totalTimeHtml(overallTotals(c, S0, t, Wd.ttPenalties(opt)), Wd.ttScope(opt) === 'heat' ? { ...opt, scope: 'all' } : opt) }; // (in this board a total is a total: "this race or heat" counts as all heats; "both" shows both)
      case 'champpoints': { const v = overallPoints(c, S0, opt.live); return { html: v === null ? '–' : String(v) }; }
      case 'distance': {
        const pri = c.prior, pst = c.past, cur = c.real && !c.recorded ? distLook(S0, c.real, Ds.smoothOn(opt)).driven : 0;
        if ((pri && !Number.isFinite(pri.dist)) || (pst && !Number.isFinite(pst.dist)) || cur === null || (!pri && !pst && !c.real)) return { html: '–' }; // (a heat or a round without metres: the total cannot be added up)
        return { html: esc(Ds.text((pri ? pri.dist : 0) + (pst ? pst.dist : 0) + cur, distUnit(S0, opt), opt.decimals)) };
      }
      default: return c.real ? widgetContent({ ...w, lane: c.real.lane }, S0) : { html: '–' }; // (the car that is racing now; a driver who is not on track has nothing)
    }
  }

  // The value a leaderboard is ordered by (see boardorder.js), as a number (or the name as text); null when the car has none yet: no lap, or the race has no such rule.
  // Times are in milliseconds. t: the moment the values are read at.
  function orderValue(key, c, S, t) {
    if(c.virtualRival && !['best','last','avg','median','laps','totaltime','totaltimeall','name'].includes(key))return null;
    if (c.virtual) { // (1.67.0, a leaderboard that counts over all heats: the values of the overall car; what cannot be added up is the real car's)
      const S0 = S.base || S;
      switch (key) {
        case 'laps': return c.lapsAll;
        case 'totaltime': case 'totaltimeall': { if (c.real && (!c.real.done || c.real.retired || c.real.dq)) return null; const v = overallTotals(c, S0, t, true).all; return Number.isFinite(v) ? v : null; }
        case 'champ': return overallPoints(c, S0);
        case 'best': case 'last': case 'avg': case 'median': case 'record': case 'name': break;
        case 'lane': return c.real ? c.real.lane : null;
        default: return c.real ? orderValue(key, c.real, S0, t) : null;
      }
    }
    const E_ = S.eng, i = E_.cars.indexOf(c), n = c.laps.length, P = E_.penalty, F = E_.fuel, ch = S.champ;
    const good = () => lapStats(S,c).laps; // (the average and the median are those of the saved result: without the laps with a pit stop)
    switch (key) {
      case 'best': return c.best === null || c.best === undefined ? null : c.best;
      case 'last': return n ? c.laps[n - 1] : null;
      case 'avg': return good().length ? lapStats(S,c).mean : null;
      case 'median': return good().length ? lapStats(S,c).median : null;
      case 'record': { const b = S.personalBest(c.driverId); return Number.isFinite(b) ? b : null; }
      case 'laps': return n;
      case 'totaltime': case 'totaltimeall': { // (1.63.0) the shortest time is the best; a car that is still racing, or is out of the race, has none yet and stays below the cars that finished
        if (!c.done || c.retired || c.dq) return null;
        const v = totalTimes(c, S, t, true)[key === 'totaltime' ? 'heat' : 'all'];
        return Number.isFinite(v) ? v : null;
      }
      case 'speed': { // the speed of the last lap, as the Speed widget shows it by default (scaled)
        const track = S.track || {}, base = n ? Sp.kmh(Sp.laneLength(track, c.lane), c.laps[n - 1]) : null, f = Sp.scaleFactor(c.carScale) || Sp.scaleFactor(track.scale);
        return base === null || !f ? null : base * f;
      }
      case 'champ': { // the championship points of the heat race, as the widget shows them (with the points of the place the car is in while the race runs)
        if (!(ch && ch.on)) return null;
        let v = ch.done.get(c.asTeam ? c.teamId : c.driverId) || 0;
        if (['running', 'paused', 'review'].includes(S.phase) && E_.cars.some(x => x.laps.length)) v += ch.list[(S.rowOf(c).physicalPos || S.rowOf(c).pos) - 1] || 0;
        return v;
      }
      case 'penpoints': return P && P.on ? (c.dq ? Infinity : c.points) : null; // (a disqualified car is the worst there is)
      case 'pentime': return P && P.on ? E_.penMs(c) : null;
      case 'damage': { const d = damageLook(S, c, t); return d ? d.points : null; }
      case 'pits': return c.pits ? c.pits.length : 0;
      case 'fuel': return F && F.on && i >= 0 ? E_.fuelOf(i, t) : null;
      case 'lane': return c.lane;
      case 'name': return c.driverName || '';
      default: return null;
    }
  }
  // the standings of a leaderboard in the order it asks for (opt.orderBy, opt.orderDir); the standings themselves when it follows the race
  function ordered(list, opt, S) {
    if (!Bo.isOrdered(opt)) return list;
    const t = S.eng.endAt && S.eng.status === 'finished' ? S.eng.endAt : S.now, key = Bo.keyOf(opt);
    return Bo.order(list, opt, x => (x && x.car ? orderValue(key, x.car, S, t) : null));
  }

  const stateOf = S => (S.phase === 'countdown' ? 'countdown' : S.eng.flag === 'red' ? 'red' : S.eng.flag === 'yellow' ? 'yellow' : S.phase === 'review' ? 'finished' : S.phase); // the state of the race for the flag and lights widgets; a start (or restart) countdown comes first

  // the flag to show: always a flag, never the countdown. Before the start (and during its countdown) Ready; during a restart after a red flag the red flag stays up until lights out.
  const flagStateOf = S => (S.eng.flag === 'red' ? 'red' : S.eng.flag === 'yellow' ? 'yellow' : S.phase === 'countdown' ? 'ready' : S.phase === 'review' ? 'finished' : S.phase);

  // S: { eng, now, phase, lights, setup, heat: {idx, count} | null, carByLane(lane), rowOf(car), flashOf(car), personalBest(driverId) }
  // The Token Clock turns amber in its warning; and when a lane's time is up, everything on that lane turns the "time is up" colour (it wins over the widget's own
  // background and the lane colours), with text that can be read on it. S.tokens: the token clocks (see tokens.js), only in a Time Token Session.
  function allInOneContent(w, S, c, opt, t) {
    const part = (type, options={}) => widgetContent({...w,type,opt:options},S).html;
    const vars = raceVars(S,t), o = Aio.clean(opt), row=c?S.rowOf(c):null;
    let points=null;
    if(c){
      if(S.season && Array.isArray(S.season.pts)){const p=S.season.pts.find(x=>x[0]===c.participant);points=p&&Number.isFinite(p[1])?p[1]:null;}
      else if(S.champ?.on) points=part('champpoints');
    }
    const max=timeLimitOf(S.setup),laps=raceLaps(S),finished=S.phase==='finished';
    const model=Aio.read(w.type,c,S,{
      position:row?.pos,limit:c?limitFor(S,c):0,
      avatarHtml:c&&o.avatar&&['aiolane','aiodriver','aioresults'].includes(w.type)?part('avatar'):'',current:c?part('laptime'):'—',
      gap:c?(row?.pos===1?'Leader':esc(gapText(S,c,{}))||'—'):'—',
      ahead:c?(row?.pos===1?'Leader':esc(Stw.read('gapnext',c,S).value)):'—',
      total:c?part('totaltime',{scope:'heat',penalties:true}):'—',points,final:finished,
      repairs:c&&S.eng.systemEnabled?.('damage')?part('repairtimer'):'Off',
      session:vars.session,track:vars.track,clock:vars.clock,
      remainingLabel:max?'Time remaining':laps.total?'Laps remaining':'Session',remaining:max?vars.timeleft:laps.total?vars.lapsleft:vars.type,
      flag:vars.flag,weather:S.eng.systemEnabled?.('weather')?vars.weather:'Off',leader:vars.leader
    });
    return {html:Aio.html(w.type,model,opt)};
  }
  const designValueFrames=new WeakMap();
  function content(w, S) {
    let out = widgetContent(w, S); const d = Wd.def(w.type);
    if(w.designRules?.length){const design=typeof module!=='undefined'?require('./widgetdesign.js'):root.WidgetDesign;
      const car=d?.perLane?S.carByLane(w.lane):null;
      let cache=S[FRAME]?designValueFrames.get(S):null;if(!cache){cache=new Map();if(S[FRAME])designValueFrames.set(S,cache);}
      let values=cache.get(car);if(!values){values=composeValues(S,car,S.eng.endAt&&S.eng.status==='finished'?S.eng.endAt:S.now);values.pending=car&&!car.virtualRival?(car.pending||[]).length:null;if(car&&!car.dq&&!car.retired&&(S.eng.status==='finished'||S.phase==='finished'||S.phase==='review'))values.driverstatus='Finished';if(S.phase==='countdown')values.flag='Countdown';cache.set(car,values);}

      out={...out,designRule:design.evaluate(w.designRules,values)};
    }
    if (S.tokens && d && d.perLane && S.carByLane(w.lane) && S.tokens.stateOf(w.lane, S.eng.elapsed(S.now)) === 'out') return { ...out, designRule:null, bg: S.tokens.outColor, color: contrast(S.tokens.outColor) };
    return out;
  }
  function composedContent(C, composition, w, S, values, scope) {
    const components=[];
    const html=C.render(composition,values,{scope,components,component:n=>{
      const child={...w,type:n.component,opt:n.options};
      return n.component==='racechart'
        ? {html:'',state:S,render:size=>widgetContent({...child,chartSize:size},S)}
        : widgetContent(child,S);
    }});
    return {html,components};
  }
  function widgetContent(w, S) {
    if(w.type==='pluginlane'||w.type==='pluginrace')return ((typeof module!=='undefined'?require('./plugindisplay'):root.PluginDisplay)?.content(w,S)||{html:'Plugin unavailable'});
    const type = w.type, opt = Wd.resolveOpt(w, S.imageSets, S.clubLogo); // the widget's own settings, with a chosen picture set (or the club logo) filled in
    const perLane = !!(Wd.def(type) && Wd.def(type).perLane); // a widget that shows one lane's car
    const c = perLane ? S.carByLane(w.lane) : null;
    if (perLane && !c && !((type === 'teamname' || type === 'teampicture') && opt.team)) return { html: '' }; // (a widget that shows one chosen team needs no car)
    const t = S.eng.endAt && S.eng.status === 'finished' ? S.eng.endAt : S.now;
    if(['classname','classposition','classgap','classpoints','classbest'].includes(type)){
      const M=typeof module!=='undefined'?require('./multiclass.js'):root.MultiClass;
      const x=S.rowOf(c),values={classname:x?.className||c?.className,classposition:x?.classPos,classgap:M?.gapText(x?.classGap),classpoints:(S.over?x?.classPoints:S.season?.classRows?.find(r=>r.participant===c.participant)?.classPoints??x?.classPoints),classbest:Number.isFinite(x?.classBest)?E.fmtTime(x.classBest):'—'};
      return {html:type==='classname'&&x?.className?M.badge(x):esc(values[type]??'—')};
    }
    if (c?.virtualRival) {
      const row=S.rowOf(c), current=E.fmtTime(Math.max(0,S.eng.elapsed(t)-c.total));
      const values={name:esc(c.driverName),nickname:esc(c.nickname||c.driverName),callsign:esc(c.callsign),carname:esc(c.carName),position:String(row?.pos??'—'),lane:c.lane>=0?String(c.lane+1):'Virtual',lap:String(c.laps.length),laptime:c.done?'–':current,bestlap:c.best===null?'–':E.fmtTime(c.best),get avglap(){const stats=lapStats(S,c);return stats.laps.length?E.fmtTime(stats.mean):'–';},get medlap(){const stats=lapStats(S,c);return stats.laps.length?E.fmtTime(stats.median):'–';},gap:esc(row?.gap||''),totaltime:E.fmtTime(c.done?c.total:S.eng.elapsed(t))};
      if(opt.composition && type==='textlane') {
        const C=typeof module!=='undefined'?require('./widgetcompose.js'):root.WidgetCompose;
        return composedContent(C,opt.composition,w,S,composeValues(S,c,t),'lane');
      }
      if(Aio.TYPES.has(type)) {
        const model=Aio.read(type,c,S,{position:row?.pos,limit:S.eng.type==='race'&&!S.eng.cfg.distance?Number(S.eng.cfg.laps)||0:0,avatarHtml:c.avatar?Wd.avatarHtml(c.avatar,opt):esc(c.driverName.slice(0,1)),current:values.laptime,gap:row?.pos===1?'Leader':values.gap||'–',ahead:'–',total:values.totaltime,points:null,repairs:'Not applied',final:S.phase==='finished'});
        model.virtualRival=true;return {html:Aio.html(type,model,opt)};
      }
      if(type==='avatar')return {html:c.avatar?Wd.avatarHtml(c.avatar,opt):esc(c.driverName.slice(0,1))};
      if(type==='gap')return {html:esc(gapText(S,c,opt))};
      // Replays restart each heat; no cumulative rival heat total is recorded.
      if(type==='totaltime'){const heat=c.done?c.total:S.eng.elapsed(t);return {html:Wd.totalTimeHtml({heat,all:S.heat?NaN:heat},opt)};}
      if(type==='lastlap'){
        const count=Wd.clampInt(opt.lapsPerColumn,1,30,1)*Wd.clampInt(opt.columns,1,3,1),start=Math.max(0,c.laps.length-count);
        return {html:Wd.lapListHtml(c.laps.slice(start).map((v,i)=>({n:start+i+1,t:E.fmtTime(v)})).reverse(),opt.lapsPerColumn,opt.columns,opt.lapNumbers!==false)};
      }
      if(type==='textlane')return {html:Wd.fillText(opt.text||'',{name:values.name,car:values.carname,lane:c.lane>=0?String(c.lane+1):'Virtual',position:values.position,laps:c.laps.length,lap:c.laps.length,laptime:values.laptime,last:c.laps.length?E.fmtTime(c.laps.at(-1)):'–',best:values.bestlap,avg:values.avglap,median:values.medlap,gap:values.gap,nickname:values.nickname,callsign:values.callsign})};
      return {html:values[type]??'–'};
    }
    if (opt.composition && ['textlane','textrace'].includes(type)) {
      const C = typeof module !== 'undefined' ? require('./widgetcompose.js') : root.WidgetCompose;
      if (C) return composedContent(C,opt.composition,w,S,composeValues(S,c,t),c?'lane':'race');
    }
    if (c && c.virtual) { const v = overallContent(w, type, opt, c, S, t); if (v) return v; } // (a leaderboard that counts over all heats, 1.67.0)
    if (Aio.TYPES.has(type)) return allInOneContent(w, S, c, opt, t);
    if (Pcw.TYPES.has(type)) return Pcw.content(type,S,opt);
    if (Stw.TYPES.has(type)) return { html: Stw.html(Stw.read(type, c, S, opt), opt) };
    if (type === 'racechart') return Cw.content(w, S);
    switch (type) {
      case 'tokenclock': {
        const K = S.tokens; if (!K) return { html: '–' };
        const T = S.eng.elapsed(t), st = K.stateOf(c.lane, T), html = Tk.clockText(K.left(c.lane, T));
        if (st === 'warning' && opt.warnColour !== false) return { html, bg: K.warnColor, color: contrast(K.warnColor) };
        if (st === 'idle') return { html, color: 'var(--muted)' }; // nothing bought on this lane: dimmed
        return { html };
      }
      case 'dlaplap': case 'dlaptime': case 'davglap': case 'dmedlap': case 'dbestlap': case 'drecordlap': case 'dpitstop': case 'dsessionrecord': case 'dtrackrecord': { // a Delta Timer: the ordinary widget, with the difference beside it (delta.js)
        const res = Dl.compute(type, opt, c, S, t), left = Dl.leftOf(type, opt, c, res);
        if (left) { // the left side shows the value it is compared with (another lane's, a record...): only the value, never the colours of that lane's flash
          const v = left.blank ? { html: '–' } : widgetContent({ ...w, type: left.type, lane: left.car ? left.car.lane : w.lane, opt: left.record ? { ...(w.opt || {}), showName: false } : w.opt }, S);
          return { html: Dl.wrap(v.html, res, opt, left.blank ? '' : left.who) };
        }
        if (Dl.KINDS[type].steady) { // Lap to Lap Delta: the last lap that was set stays on the left for the whole lap (the Laptime widget runs a clock instead), in the colour of a personal best or a record for a moment
          const last = c.laps.length ? c.laps[c.laps.length - 1] : null;
          return { html: Dl.wrap(Number.isFinite(last) ? E.fmtTime(last) : '–', res, opt) };
        }
        const base = widgetContent({ ...w, type: Dl.baseOf(type) }, S);
        return { ...base, html: Dl.wrap(base.html, res, opt) };
      }
      case 'lanecolor': { const lc = S.laneColorsOf ? S.laneColorsOf(c.lane) : {}; return { html: '', ...(lc.bg && !w.bgColor && (!F || F.laneStyle(w, S.layout) === 'full') ? { bg: lc.bg } : {}) }; } // stripes use the shared frame; explicit widget backgrounds still win
      case 'nickname': return { html: esc(c.nickname || c.driverName) };
      case 'speed': {
        const track = S.track || {}, ms = !c.laps.length ? null : opt.source === 'best' ? c.best : opt.source === 'average' ? (lapStats(S,c).laps.length ? lapStats(S,c).mean : null) : c.laps[c.laps.length - 1];
        const base = Sp.kmh(Sp.laneLength(track, c.lane), ms), scaled = opt.mode !== 'real', f = scaled ? (Sp.scaleFactor(c.carScale) || Sp.scaleFactor(track.scale)) : 1;
        if (base === null || !f) return { html: '–' };
        const v = Sp.toUnit(base * f, opt.unit);
        return { html: v.toFixed(scaled ? 0 : 1) + (opt.showUnit === false ? '' : opt.unit === 'mph' ? ' mph' : ' km/h') };
      }
      case 'carpicture': return { html: c.carPicture ? Wd.avatarHtml(c.carPicture, { frame: opt.frame, avatarMirror: !!opt.carMirror }) : '' }; // (the picture in its frame; 1.30.1: mirror flips it left to right inside the frame, as for the Avatar)
      case 'textlane': return { html: Wd.fillText(opt.text ?? Wd.TEXT_LANE_DEFAULT, laneVars(S, c, t)) };
      case 'imagelane': return { html: Wd.imageHtml(Wd.pickImage(opt, laneVars(S, c, t)), opt.fit) };
      case 'logo': return { html: Wd.imageHtml(opt.image, opt.fit) };
      case 'imagerace': return { html: Wd.imageHtml(Wd.pickImage(opt, raceVars(S, t)), opt.fit) };
      case 'textrace': return { html: Wd.fillText(opt.text ?? Wd.TEXT_RACE_DEFAULT, raceVars(S, t)) };
      case 'teamname': case 'teampicture': { // the team of the lane, or the team that was chosen in the widget (Database > Teams)
        const t = opt.team ? (S.teams || []).find(x => x.id === opt.team) : c && c.teamName ? { name: c.teamName, picture: c.teamPicture } : null;
        if (!t) return { html: '' };
        return type === 'teamname' ? { html: esc(t.name || '') } : { html: t.picture ? Wd.avatarHtml(t.picture, { frame: opt.frame }) : '' }; // (the picture's text is built once: 1.60.2)
      }
      case 'carname': return { html: esc(c.carName || '') };
      case 'callsign': return { html: esc(c.callsign || '') };
      case 'name': return { html: esc(c.driverName) };
      case 'avatar': { // the driver's own picture; without one the avatar of the lane; with "no avatars" the first letter of the name
        const pic = c.avatar || Av.forLane(opt, c.lane);
        return { html: pic ? Wd.avatarHtml(pic, opt) : `<span class="av">${esc((c.driverName || '?')[0])}</span>` };
      }
      case 'driverflag': return { html: c.flag ? `<span class="fi fi-${esc(String(c.flag).toLowerCase())}"></span>` : '' };
      case 'position': return { html: String(S.rowOf(c).pos) };
      case 'lap': {
        const total = limitFor(S, c), n = c.laps.length, cur = c.done ? n : n + 1;
        return { html: total ? `${Math.min(cur, total)}/${total}` : String(cur) };
      }
      case 'racelaps': { // the laps of the race as a whole: the lap the leader is on (up, with the number of laps of the race when it has one), or the laps left (down: nothing to count when the race has no number of laps)
        const { total, most, cur } = raceLaps(S);
        if (Wd.lapCountOf(opt) === 'down') return { html: total ? String(Math.max(0, total - most)) : '–' };
        return { html: total ? (Wd.lapTotalOn(opt) ? `${Math.min(cur, total)}/${total}` : String(Math.min(cur, total))) : String(cur) };
      }
      case 'distance': { // Distance Racing: the distance the car has driven (smoothly between two crossings of the line, or exactly), with the distance of the race or as a percentage
        const l = distLook(S, c, Ds.smoothOn(opt)), u = distUnit(S, opt);
        if (l.driven === null) return { html: '\u2013' };
        if (opt.show === 'percent') return { html: l.pct === null ? '\u2013' : Math.round(l.pct) + '%' };
        return { html: esc(Ds.text(l.driven, u, opt.decimals) + (opt.show === 'both' && l.target > 0 ? ' of ' + Ds.text(l.target, u, opt.decimals) : '')) };
      }
      case 'distleft': { // Distance Racing: the distance still to drive until the finish line (a race with laps or a distance)
        const l = distLook(S, c, Ds.smoothOn(opt)), u = distUnit(S, opt);
        return { html: l.left === null ? '\u2013' : esc(Ds.text(l.left, u, opt.decimals) + (opt.words === true ? ' to go' : '')) };
      }
      case 'lapstogo': { // the laps the car still has to drive; "Last lap" when it is on its last one
        const n = limitFor(S, c) > 0 ? Math.max(0, limitFor(S, c) - (S.eng.lapsOf ? S.eng.lapsOf(c) : c.laps.length)) : null;
        if (n === null) return { html: '\u2013' };
        if (opt.show === 'number') return { html: String(n) };
        return { html: n === 0 ? 'Finished' : n === 1 && opt.lastLap !== false ? 'Last lap' : `${n} ${n === 1 ? 'lap' : 'laps'} to go` };
      }
      case 'totaltime': return { html: Wd.totalTimeHtml(totalTimes(c, S, t, Wd.ttPenalties(opt)), opt) }; // (1.63.0)
      case 'laptime': {
        const f = S.flashOf(c);
        if (f && S.now - f.at < (opt.holdSeconds ?? 3) * 1000) {
          return { html: E.fmtTime(f.time) };
        }
        return { html: c.done ? '–' : E.fmtTime(S.eng.lapElapsed(S.eng.cars.indexOf(c), S.now)) };
      }
      case 'lastlap': {
        const count=Wd.clampInt(opt.lapsPerColumn,1,30,1)*Wd.clampInt(opt.columns,1,3,1);
        const start=Math.max(0,c.laps.length-count);
        const shown=c.laps.slice(start).map((t,i)=>({n:start+i+1,t:E.fmtTime(t)})).reverse();
        return {html:Wd.lapListHtml(shown,opt.lapsPerColumn,opt.columns,opt.lapNumbers!==false)};
      }
      case 'avglap': return { html: lapStats(S,c).laps.length ? E.fmtTime(lapStats(S,c).mean) : '–' };
      case 'medlap': return { html: lapStats(S,c).laps.length ? E.fmtTime(lapStats(S,c).median) : '–' };
      case 'bestlap': return { html: c.best === null ? '–' : E.fmtTime(c.best) };
      case 'gap': return { html: esc(gapText(S, c, opt)) };
      case 'recordlap': { const b = S.personalBest(c.driverId); return { html: Number.isFinite(b) ? E.fmtTime(b) : '–' }; }
      case 'sessionrecord': case 'trackrecord': {
        const r = type === 'sessionrecord' ? S.sessionRecord() : S.trackRecord();
        if (!r || !Number.isFinite(r.time)) return { html: '–' };
        return { html: opt.showName !== false && r.name ? `<span class="record-line"><span class="record-value">${E.fmtTime(r.time)}</span><small class="rn">${esc(r.name)}</small></span>` : E.fmtTime(r.time) };
      }
      case 'heatlist': return { html: S.heat ? Wd.heatListHtml(S.heat, S.phase, opt) : '\u2013' }; // every heat of a heat-based race, with who won it
      case 'nextheat': return { html: S.heat ? Wd.nextHeatHtml(S.heat, S.phase, opt) : '\u2013' }; // 1.62.0: the drivers of the next heat, by lane
      case 'leaderboard': {
        const design = opt.design && (S.rowDesigns || []).find(x => x.id === opt.design); // a row design you made, instead of the classic table
        const RowsM = typeof module !== 'undefined' ? require('./rows.js') : root.Rows;
        const laneMode = F ? F.laneStyle(w, S.layout) : 'full', laneTransparency = F ? F.transparency(w, S.layout) : 0;
        if (design) { const components=[];return { html: RowsM.html(design, S, undefined, { components,scale: opt.scale, gaps: opt.gaps, fill: opt.fill, from: opt.from, to: opt.to, orderBy: opt.orderBy, orderDir: opt.orderDir, countOver: opt.countOver, laneColorStyle: laneMode, laneTransparency }),components }; }
        const SS = opt.countOver === 'all' ? overallState(S) || S : S, ES = SS.eng; // (1.67.0: a board that counts over all heats lists every participant; what only the car on track has is read from that car)
        const rows = RowsM.range(ordered(SS.standings(), opt, SS), opt).map(x => { // (orderBy: the board in the order of a value; from and to: only some of the places, for a board that shows part of the field)
          const car = x.car, rc = car.virtualRival ? null : car.virtual ? car.real : car, lc = SS.laneColorsOf ? SS.laneColorsOf(car.lane) : {}, ri = rc ? ES.cars.indexOf(rc) : -1;
          const raw = S.layout ? (S.layout.laneColors || [])[car.lane]?.bg || '' : lc.bg || '', expired = SS.tokens && SS.tokens.stateOf(car.lane, SS.eng.elapsed(SS.now)) === 'out';
          return { lane:car.virtual?car.real?.lane:car.lane, pos: x.pos, flag: car.flag, name: car.driverName, nickname: car.nickname || car.driverName, callsign: car.callsign || '',
            laps: String(car.virtual ? car.lapsAll : car.laps.length), best: car.best === null ? '–' : E.fmtTime(car.best), last: car.laps.length ? E.fmtTime(car.laps[car.laps.length - 1]) : '–',
            current: car.virtualRival ? (car.done ? '–' : E.fmtTime(Math.max(0,ES.elapsed(SS.now)-car.total))) : !rc || rc.done ? '–' : E.fmtTime(ES.lapElapsed(ri, SS.now)), fuel: rc && ES.fuel && ES.fuel.on ? `${(Math.floor(ES.fuelOf(ri, SS.now) * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')} L` : '–', tyres: rc && opt.colTyres === true && ES.tyrewear ? Tyw.cellHtml(Tw.view(ES, [rc.lane], SS.now).rows[0]) : '–', pace: rc && opt.colPace === true && ES.pushSave ? Pw.rowHtml(ES.psInfo(rc), ES.pushSave, { look: 'cell' }).html : '–', gap: x.gap, color: lc.color, bg: lc.bg, ...(laneMode !== 'full' ? { color: expired ? lc.color : '', bg: expired ? lc.bg : '', laneBg: raw, laneColorStyle: laneMode, laneTransparency } : {}) };
        });
        return { html: Wd.leaderHtml(rows, opt) };
      }
      case 'fuel': { const F = S.eng.fuel, i = S.eng.cars.indexOf(c); return { html: F && F.on ? Wd.fuelHtml(S.eng.fuelOf(i, t), S.eng.tankOf ? S.eng.tankOf(i) : F.tank, opt) : '–' }; }
      case 'tyre': return Ww.tyreContent(opt, c, S); // the tyre of the car (the weather: a pit stop changes it)
      case 'tyrelife': return Tyw.content(opt, c, S, t); // how much life the tyres of the car have left (Tyre Wear)
      case 'pace': return Pw.content(opt, c, S); // how hard the car is driven, and what it does to the tyres and the fuel (Push and Save)
      case 'tyresets': return Tyw.setsContent(opt, c, S, t); // the sets that are left of every tyre (Tyre Wear with sets)
      case 'wxforecast': return Ww.forecastContent(opt, S, t); // the weather now, and what comes next
      case 'wxconditions': return Ww.conditionsContent(opt, S); // track and air temperature, wind speed and direction
      case 'currentdriver': { // Endurance Race: the driver at the wheel (any race: the driver of the car), and how long he has been there
        const name = opt.show === 'nickname' ? c.nickname || c.driverName : opt.show === 'callsign' ? c.callsign || c.driverName : c.driverName, l = opt.stint === true ? swapLook(S, c, t) : null;
        return { html: esc(name || '') + (l ? ` \u00b7 ${En.clock(l.stintMs)}` : '') };
      }
      case 'nextdriver': { // Endurance Race: the driver who steps in at the next swap
        const l = swapLook(S, c, t); if (!l) return { html: '' };
        const n = rosterName(c, l.next, opt.show);
        return { html: n ? (opt.prefix === true ? 'Next: ' : '') + esc(n) : '\u2013' };
      }
      case 'swaptimer': { // Endurance Race: the time to the swap, amber in the warning and red when the swap is due
        const l = swapLook(S, c, t); if (!l) return { html: '' };
        const cfg = S.eng.endurance, chip = En.chipOf(cfg, l), stand = l.standLeft === null || l.standLeft === undefined ? '' : ` \u00b7 stand still ${Math.ceil(l.standLeft / 1000)} s`;
        const late = chip.kind === 'due' || chip.kind === 'overdue', text = opt.show === 'clock' ? (late ? 'NOW' : l.left === null || l.left === undefined ? '' : En.leftText(cfg, l.left)) : chip.text + stand;
        const bg = chip.kind === 'soon' ? opt.soonColor || '#ffb000' : late ? opt.dueColor || '#e03131' : '';
        return bg ? { html: esc(text), bg, color: contrast(bg) } : { html: esc(text) };
      }
      case 'swapsignal': { // Endurance Race (1.35.1): the signal that a driver swap is needed: the word, flashing, with who comes out and who steps in; it stays until the swap is made (or only the warning before it: amber)
        const l = swapLook(S, c, t); if (!l) return { html: '' };
        const late = l.state === 'due' || l.state === 'overdue', soon = l.state === 'soon' && opt.when === 'soon';
        if (!late && !soon) return { html: '' };
        const cfg = S.eng.endurance, word = late ? (String(opt.text ?? '').trim() || 'SWAP') : En.chipOf(cfg, l).text;
        const names = opt.names === false ? '' : `<small>${esc(rosterName(c, l.driver, opt.show) || c.driverName || '?')} \u2192 ${esc(rosterName(c, l.next, opt.show) || '?')}</small>`;
        const sub = l.state === 'overdue' ? `<small>${Math.round(l.over)} s late</small>` : '';
        const on = opt.flash === false || Math.floor((S.now || 0) / 500) % 2 === 0, bg = late ? (on ? opt.dueColor || '#e03131' : opt.offColor || '#6b1414') : opt.soonColor || '#ffb000';
        return { html: `<span class="swsig"><b>${esc(word)}</b>${names}${sub}</span>`, bg, color: contrast(bg) };
      }
      case 'damage': { // Damage System: the level and the points of the car, amber for a level to pit for whenever you can, red for as fast as you can (or a car that is late)
        const d = damageLook(S, c, t); if (!d) return { html: '\u2013' };
        if (d.out) { const bg = d.out === 'dq' ? '#d62828' : opt.outColor || '#555b66'; return { html: d.out === 'dq' ? 'DQ' : 'RETIRED', bg, color: contrast(bg) }; }
        if (!d.points) return { html: opt.showNone === false ? '' : opt.show === 'points' ? '0' : 'No damage' };
        const text = opt.show === 'points' ? String(d.points) : opt.show === 'level' ? damageName(d) : `${damageName(d)} \u00b7 ${d.points}`;
        const late = d.lapsLeft !== null && d.lapsLeft < 0, bg = late || d.tone === 'red' || d.tone === 'out' ? opt.redColor || '#e03131' : d.tone === 'amber' ? opt.amberColor || '#ffb000' : '';
        return bg ? { html: esc(text), bg, color: contrast(bg) } : { html: esc(text) };
      }
      case 'repairtimer': { // Damage System: when the car should pit and for how long, and while it stands on the sensor how long the repair still takes
        const d = damageLook(S, c, t); if (!d) return { html: '\u2013' };
        if (d.out) return { html: opt.show === 'clock' ? '' : d.out === 'dq' ? 'DQ' : 'OUT' };
        if (d.standLeft !== null) { const bg = opt.standColor || '#3ddc84', clock = Dm.secClock(d.standLeft); return { html: opt.show === 'clock' ? clock : `Repairing ${clock}`, bg, color: contrast(bg) }; }
        if (!(d.points > 0) || d.level < 0) return { html: opt.show === 'clock' ? '' : '\u2013' };
        const late = d.lapsLeft !== null && d.lapsLeft < 0, hasTime = d.action === 'repair' && d.seconds > 0, clock = hasTime ? Dm.secClock(d.seconds * 1000) : '';
        const when = d.lapsLeft === null ? (d.urgent ? 'Pit as fast as you can' : 'Pit whenever you can') : late ? `Pit now, ${lapsWord(-d.lapsLeft)} late` : d.lapsLeft === 0 ? 'Pit now' : `Pit in ${lapsWord(d.lapsLeft)}`;
        const bg = late || d.urgent ? opt.dueColor || '#e03131' : opt.soonColor || '#ffb000';
        return { html: esc(opt.show === 'clock' ? clock : when + (clock ? ` \u00b7 ${clock}` : '')), bg, color: contrast(bg) };
      }
      case 'carfailure': { // Car Failures: the failure the car has now and what it asks: amber to pit for whenever you can, red as fast as you can (or late or a failure that ends the car), green while it is repaired
        const f = failureLook(S, c, t); if (!f) return { html: '\u2013' };
        if (f.out) { const bg = f.out === 'dq' ? '#d62828' : opt.outColor || '#555b66'; return { html: f.out === 'dq' ? 'DQ' : 'RETIRED', bg, color: contrast(bg) }; }
        if (!f.active) return { html: opt.showNone === false ? '' : esc(String(opt.noneText ?? '').trim() || 'No failure') };
        if (f.standLeft !== null) { const bg = opt.standColor || '#3ddc84'; return { html: esc(opt.show === 'name' ? f.name : `${f.name} \u00b7 Repairing ${Dm.secClock(f.standLeft)}`), bg, color: contrast(bg) }; }
        const late = f.lapsLeft !== null && f.lapsLeft < 0, bg = late || f.tone === 'red' || f.tone === 'out' ? opt.redColor || '#e03131' : opt.amberColor || '#ffb000';
        return { html: esc(opt.show === 'name' ? f.name : `${f.name} \u00b7 ${Fl.whenText(f, f.lapsLeft)}`), bg, color: contrast(bg) };
      }
      case 'bop': { // Balance of Power: off, hindered (an arrow down) or helped (an arrow up), with the percentage
        const pct = c.bop || 0;
        if (!pct) return { html: opt.showOff === false ? '' : 'BoP off' };
        const bg = pct < 0 ? (opt.hinderColor || '#ff8c00') : (opt.helpColor || '#3ddc84'), text = opt.showPercent === false ? `BoP ${pct < 0 ? '\u25BC' : '\u25B2'}` : Bp.shortText(pct);
        return { html: esc(text), bg, color: contrast(bg) };
      }
      case 'champpoints': { // points from the heats finished so far, plus (optionally) what the current heat's positions are worth right now
        const ch = S.champ; if (!ch || !ch.on) return { html: '–' };
        let pts = ch.done.get(c.asTeam ? c.teamId : c.driverId) || 0;
        const going = ['running', 'paused', 'review'].includes(S.phase) && S.eng.cars.some(x => x.laps.length);
        if (opt.live !== false && going) pts += ch.list[(S.rowOf(c).physicalPos || S.rowOf(c).pos) - 1] || 0;
        return { html: String(pts) };
      }
      case 'penalty': {
        if (!S.eng.penalty || !S.eng.penalty.on) return { html: '–' };
        if (c.dq) return { html: 'DQ', bg: '#d62828', color: '#fff' };
        const sec = S.eng.penMs(c) / 1000, secText = `+${Number.isInteger(sec) ? sec : sec.toFixed(1)} s`;
        const main = opt.show === 'time' ? secText : opt.show === 'both' ? `${c.points} (${secText})` : String(c.points);
        return { html: main + (c.pending && c.pending.length ? `<small class="rn">${esc(c.pending.map(p => p.name).join(', '))}</small>` : '') }; // a penalty still to be served is shown under the points
      }
      case 'pitstop': { const p = S.eng.pitTime(S.eng.cars.indexOf(c), t); return { html: p ? E.fmtTime(p.ms) : '–' }; }
      case 'clock': {
        const lim = opt.countdown !== false ? timeLimitOf(S.setup) : 0, time = clockText(lim ? lim - S.eng.elapsed(t) : S.eng.elapsed(t));
        const st=S.eng.status==='finished'||S.phase==='review'?'finished':stateOf(S),html=Wd.clockHtml(w,time,st,!!lim);
        return {html,...(opt.flagColour!==false?{color:st==='red'?'var(--clock-red)':st==='yellow'?'var(--clock-yellow)':st==='running'?'var(--clock-green)':'var(--ink)'}:{})};
      }
      case 'lights': { // counting down: the lights come on one by one; otherwise the choice for the state of the race
        // a picture set gives a picture per light and per race state (a set from before the grid has only Countdown and Lights off)
        const st = stateOf(S), imgs = opt.lightImages || {}, pics = { pick: (i, lit) => Wd.lightPic(imgs, st, i, lit) };
        if (st === 'countdown') return { html: Wd.lightsHtml(S.lights, pics) };
        // the widget's own choice for this state wins; the standard Race Settings behaviour is to follow the racing flags after the start.
        const own = opt['lights_' + st] !== undefined && opt['lights_' + st] !== '', follow = ['running', 'yellow', 'red'].includes(st);
        return { html: Wd.lightsHtml(own ? Wd.lightCount(opt, st) : follow ? 5 : 0, pics, Wd.lightColor(opt, st)) };
      }
      case 'info': {
        const parts = [];
        if (S.heat) parts.push(heatLabel(S.heat));
        const rl = raceLaps(S), laps = rl.total, time = timeLimitOf(S.setup);
        if (laps) { const left = Math.max(0, laps - rl.most); parts.push(`${left} ${left === 1 ? 'lap' : 'laps'} left`); }
        else if (time) parts.push(`${mmss(Math.max(0, time - S.eng.elapsed(t)))} left`);
        else if (!S.heat) parts.push(S.setup.sessionType === 'tokens' ? 'Time tokens' : 'Free practice');
        if (S.heat && S.phase === 'between' && S.heat.breakLeft > 0) parts.push(`next ${S.heat.final ? 'final ' + S.heat.final : 'heat'} in ${mmss(S.heat.breakLeft * 1000)}`);
        return { html: esc(parts.join(' · ')) };
      }
      case 'flag': { // the race state as a flag, an LED, text or a picture of a picture set (the widget's Flag style)
        const st = flagStateOf(S), style = Wd.flagStyleOf(opt);
        if (st === 'running' && S.eng.rndSoon) { // 1.59.0: a random yellow flag is about to come (the warning of the Safety car system): the yellow flag flashes, twice a second, in whatever the widget shows
          const dim = Math.floor((S.now || 0) / 500) % 2 === 1, fade = h => (!dim ? h : /^<(svg|img) [^>]*style="/.test(h) ? h.replace(/^(<(?:svg|img) [^>]*style=")/, '$1opacity:.25;') : h.replace(/^<(svg|img) /, '<$1 style="opacity:.25" '));
          const yimg = style === 'images' ? opt.img_yellow : '';
          if (style === 'flags') return { html: fade(Wd.flagHtml('yellow', { mirror: !!opt.flagMirror })) };
          if (style === 'leds') return { html: fade(Wd.ledHtml('yellow')) };
          if (yimg) return { html: fade(Wd.flagImgHtml(yimg, 'Yellow flag soon', !!opt.imageMirror)) };
          return { html: S.eng.safetyCar ? 'SAFETY CAR SOON' : 'YELLOW FLAG SOON', bg: dim ? '#8a7400' : '#ffd400', color: dim ? '#fff' : '#000' };
        }
        if (style === 'flags') return { html: Wd.flagHtml(st, { mirror: !!opt.flagMirror }) };
        if (style === 'leds') return { html: Wd.ledHtml(st) };
        const img = style === 'images' ? opt['img_' + st] : '';
        if (img) return { html: Wd.flagImgHtml(img, flagText[st] || st, !!opt.imageMirror) };
        if (st === 'red') return { html: 'RED FLAG', bg: '#d62828', color: '#fff' }; // text, also for a state a picture set has no picture for
        if (st === 'yellow') return { html: S.eng.safetyCar ? 'SAFETY CAR' : 'YELLOW FLAG', bg: '#ffd400', color: '#000' }; // (a race with a safety car system: the yellow flag is the Safety Car, 1.53.0)
        return { html: flagText[st] || '' };
      }
      case 'start': return { html: S.phase === 'between' && S.heat ? (S.heat.final ? `Start final ${S.heat.final}` : `Start heat ${S.heat.idx + 1}`) : 'Start', button: true, disabled: !(S.phase === 'ready' || S.phase === 'between') || !!S.calling || !!(S.heat && S.heat.picking) };
      case 'pause': return { html: S.phase === 'paused' ? 'Resume' : 'Pause', button: true, disabled: !(S.phase === 'running' || S.phase === 'paused') };
      case 'stop': return { html: 'Stop', button: true, disabled: !(S.phase === 'running' || S.phase === 'paused' || S.phase === 'between') };
      case 'yellow': return { html: S.eng.safetyCar ? 'Safety Car' : 'Yellow flag', button: true, disabled: !(S.phase === 'running' || S.eng.flag === 'yellow') || S.eng.flag === 'red',
        ...(S.eng.flag === 'yellow' ? { bg: '#ffd400', color: '#000' } : {}) };
      case 'red': return { html: 'Red flag', button: true, disabled: !(S.phase === 'running' || S.phase === 'paused'),
        ...(S.eng.flag === 'red' ? { bg: '#d62828', color: '#fff' } : {}) };
      default: return { html: '' };
    }
  }

  // Typed data for compositions: calculations remain owned by the race engine.
  function composeValues(S,c,t) {
    const C=typeof module!=='undefined'?require('./widgetcompose.js'):root.WidgetCompose,e=S.eng;
    if(c?.virtualRival) {
      const values={...Object.fromEntries(C.catalog('lane').map(v=>[v.key,null])),...composeValues(S,null,t)},good=lapStats(S,c).laps,secs=v=>Number.isFinite(v)?v/1000:null;
      return {...values,name:c.driverName,nickname:c.nickname,callsign:c.callsign,car:c.carName,position:Number.isFinite(S.rowOf(c)?.pos)?S.rowOf(c).pos:null,laps:c.laps.length,lap:c.laps.length,lane:c.lane>=0?c.lane+1:null,best:secs(c.best),last:secs(c.laps.at(-1)),avg:good.length?secs(lapStats(S,c).mean):null,median:good.length?secs(lapStats(S,c).median):null,laptime:c.done?null:secs(Math.max(0,e.elapsed(t)-c.total)),total:secs(c.done?c.total:e.elapsed(t)),gap:S.rowOf(c)?.gap||'',driverstatus:c.done?'Finished':e.status==='paused'?'Paused':'Virtual replay'};
    }
    if(c?.virtual){
      const base=S.base||S,values=c.real?composeValues(base,c.real,t):Object.fromEntries(C.catalog('lane').map(v=>[v.key,null]));
      const good=lapStats(S,c).laps,seconds=v=>Number.isFinite(v)?v/1000:null;
      Object.assign(values,{...Object.fromEntries(Object.entries(raceVars(base,t)).map(([k,v])=>[k,typeof v==='string'?C.decode(v):v])),name:c.driverName,car:c.carName,nickname:c.nickname,callsign:c.callsign,team:c.teamName,lane:c.real?c.real.lane+1:null,position:S.rowOf(c)?.pos??null,laps:c.lapsAll,best:seconds(c.best),last:seconds(c.laps.at(-1)),avg:good.length?seconds(lapStats(S,c).mean):null,median:good.length?seconds(lapStats(S,c).median):null,gap:S.rowOf(c)?.gap||'',total:seconds(overallTotals(c,base,t,true).all),champ:overallPoints(c,base)});
      const race=composeValues(base,null,t);for(const v of C.catalog('race'))values[v.key]=race[v.key];return values;
    }
    const values=Object.fromEntries(Object.entries({...raceVars(S,t),...(c?laneVars(S,c,t):{})}).map(([k,v])=>[k,typeof v==='string'?C.decode(v):v]));
    // Legacy text variables contain display dashes. Compositions expose absence as null
    // so availability rules work; identity strings remain exactly as entered.
    for(const [key,value] of Object.entries(values))if(!['name','nickname','callsign','team','car','track','session'].includes(key)&&['','–','—'].includes(value))values[key]=null;
    for(const key of ['champ','speed','speedreal','damage','repairs','failures','lapstogo'])if(values[key]!=null)values[key]=Number.isFinite(Number(values[key]))?Number(values[key]):null;
    const seconds=v=>Number.isFinite(v)?v/1000:null;
    Object.assign(values,{sessionrecord:seconds(S.sessionRecord?.()?.time),trackrecord:seconds(S.trackRecord?.()?.time),yellowtarget:e.yellow?.target>0?seconds(e.yellow.target):null});
    const time=timeLimitOf(S.setup),rl=raceLaps(S);
    Object.assign(values,{clock:e.elapsed(t)/1000,timeleft:time?Math.max(0,time-e.elapsed(t))/1000:null,lapsleft:rl.total?Math.max(0,rl.total-rl.most):null,lapstotal:rl.total||null});
    if(!c)return values;
    const i=e.cars.indexOf(c),physical=i>=0&&!c.virtual,good=lapStats(S,c).laps,enabled=(key,fallback)=>physical&&(e.systemEnabled?e.systemEnabled(key):!!fallback),fuel=enabled('fuel',e.fuel?.on),tyres=enabled('tyrewear',e.tyrewear),pace=enabled('pushsave',e.pushSave),p=pace?e.psInfo(c):null,tw=tyres?Tw.view(e,[c.lane],t).rows[0]:null,pit=physical?e.pitTime(i,t):null;
    const secs=v=>Number.isFinite(v)?v/1000:null,service=physical?Stw.read('servicestop',c,{...S,now:t}):null;
    Object.assign(values,{lane:c.lane+1,position:S.rowOf(c)?.pos??null,lap:c.done?c.laps.length:c.laps.length+1,laps:e.lapsOf?e.lapsOf(c):c.laps.length,laptime:physical&&!c.done?secs(e.lapElapsed(i,t)):null,last:secs(c.laps.at(-1)),best:secs(c.best),avg:good.length?secs(lapStats(S,c).mean):null,median:good.length?secs(lapStats(S,c).median):null,record:secs(S.personalBest(c.driverId)),fuel:fuel?e.fuelOf(i,t):null,fuelpct:fuel?e.fuelOf(i,t)/(e.tankOf?e.tankOf(i):e.fuel.tank)*100:null,penpoints:c.points??0,pentime:e.penMs?secs(e.penMs(c)):0,pits:c.pits?.length||0,pit:pit?secs(pit.ms):null,tyrelife:tw?.shown??null,tyrelaps:tw?.lapsLeft??null,pace:p?PsKind(p.kind):null,pacedelta:Number.isFinite(p?.p)?p.p:null,fuelmult:p?.fuel??null,tyremult:p?.tyres??null,service:e.pitControl&&['auto','manual'].includes(e.pitControl.mode)?(['—','–'].includes(service?.value)?service.note:service?.value??null):null,serviceprogress:Number.isFinite(service?.progress)?service.progress*100:null,inpit:c.blockAt!=null||!!c.pitHold,driverstatus:c.dq?'Disqualified':c.retired?'Retired':c.done?'Finished':c.blockAt!=null||c.pitHold?'In pits':e.status==='ready'?'Ready':e.status==='paused'?'Paused':'On track',gaplaps:gapLaps(S,c)||null,total:secs(totalTimes(c,S,t,true).heat)});
    values.champ=overallPoints(c,S);
    return values;
  }
  const PsKind=k=>({push:'Push',normal:'Normal',save:'Save'}[k]||'Normal');
  const api = { beginFrame, lapStats, contentKey, content, ordered, orderValue, overallState, classifyLap, mean, median, contrast, gapLaps, gapText, composeValues };
  root.Timing = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
