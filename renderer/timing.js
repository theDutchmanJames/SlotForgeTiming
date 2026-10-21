// Works out what each widget shows on the live timing page. Pure: it only reads the state it is given,
// so it can be tested without a screen. The widgets made in the Widget Builder are drawn here too.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const Bp = typeof module !== 'undefined' ? require('./bop.js') : root.Bop; // Balance of Power (bop.js)
  const Sp = typeof module !== 'undefined' ? require('./speed.js') : root.Speed;
  const Wd = typeof module !== 'undefined' ? require('./widgets.js') : root.Widgets;
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

  // The {variables} of the custom text widgets. Values are already safe to put in HTML.
  function laneVars(S, c, t) {
    const E_ = S.eng, i = E_.cars.indexOf(c), row = S.rowOf(c), laps = c.laps.length, g = E.goodLaps(c), F = E_.fuel, P = E_.penalty, track = S.track || {}, ch = S.champ;
    const speedOf = scaled => { const ms = laps ? c.laps[laps - 1] : null, base = Sp.kmh(Sp.laneLength(track, c.lane), ms), f = scaled ? (Sp.scaleFactor(c.carScale) || Sp.scaleFactor(track.scale)) : 1; return base === null || !f ? '–' : (base * f).toFixed(scaled ? 0 : 1); };
    const pit = E_.pitTime(i, t), sec = P && P.on ? E_.penMs(c) / 1000 : 0, best = S.personalBest(c.driverId);
    let champ = '–'; if (ch && ch.on) { champ = ch.done.get(c.asTeam ? c.teamId : c.driverId) || 0; if (['running', 'paused', 'review'].includes(S.phase) && E_.cars.some(x => x.laps.length)) champ += ch.list[row.pos - 1] || 0; }
    return { name: esc(c.driverName), team: esc(c.teamName || ''), nickname: esc(c.nickname || c.driverName), callsign: esc(c.callsign || ''), car: esc(c.carName || ''), lane: c.lane + 1, position: row.pos, lap: c.done ? laps : laps + 1, laps,
      laptime: c.done ? '–' : E.fmtTime(E_.lapElapsed(i, S.now)), last: laps ? E.fmtTime(c.laps[laps - 1]) : '–', best: c.best === null ? '–' : E.fmtTime(c.best), avg: g.length ? E.fmtTime(mean(g)) : '–', median: g.length ? E.fmtTime(median(g)) : '–',
      record: Number.isFinite(best) ? E.fmtTime(best) : '–', gap: esc(row.gap),
      fuel: F && F.on ? `${(Math.floor(E_.fuelOf(i, t) * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')} L` : '–', fuelpct: F && F.on && F.tank ? Math.round(E_.fuelOf(i, t) / (E_.tankOf ? E_.tankOf(i) : F.tank) * 100) + '%' : '–', bop: c.bop ? Bp.signed(c.bop) : '–',
      penpoints: P && P.on ? (c.dq ? 'DQ' : c.points) : '–', pentime: P && P.on ? `+${Number.isInteger(sec) ? sec : sec.toFixed(1)} s` : '–', champ, pits: c.pits ? c.pits.length : 0, pit: pit ? E.fmtTime(pit.ms) : '–', speed: speedOf(true), speedreal: speedOf(false), ...swapVars(S, c, t), ...damageVars(S, c, t), ...failureVars(S, c, t), ...distLaneVars(S, c), ...Ww.laneVars(c) };
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

  // The value a leaderboard is ordered by (see boardorder.js), as a number (or the name as text); null when the car has none yet: no lap, or the race has no such rule.
  // Times are in milliseconds. t: the moment the values are read at.
  function orderValue(key, c, S, t) {
    const E_ = S.eng, i = E_.cars.indexOf(c), n = c.laps.length, P = E_.penalty, F = E_.fuel, ch = S.champ;
    const good = () => E.averageLaps(c); // (the average and the median are those of the saved result: without the laps with a pit stop)
    switch (key) {
      case 'best': return c.best === null || c.best === undefined ? null : c.best;
      case 'last': return n ? c.laps[n - 1] : null;
      case 'avg': return good().length ? mean(good()) : null;
      case 'median': return good().length ? median(good()) : null;
      case 'record': { const b = S.personalBest(c.driverId); return Number.isFinite(b) ? b : null; }
      case 'laps': return n;
      case 'speed': { // the speed of the last lap, as the Speed widget shows it by default (scaled)
        const track = S.track || {}, base = n ? Sp.kmh(Sp.laneLength(track, c.lane), c.laps[n - 1]) : null, f = Sp.scaleFactor(c.carScale) || Sp.scaleFactor(track.scale);
        return base === null || !f ? null : base * f;
      }
      case 'champ': { // the championship points of the heat race, as the widget shows them (with the points of the place the car is in while the race runs)
        if (!(ch && ch.on)) return null;
        let v = ch.done.get(c.asTeam ? c.teamId : c.driverId) || 0;
        if (['running', 'paused', 'review'].includes(S.phase) && E_.cars.some(x => x.laps.length)) v += ch.list[S.rowOf(c).pos - 1] || 0;
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
  function content(w, S) {
    const out = widgetContent(w, S), d = Wd.def(w.type);
    if (S.tokens && d && d.perLane && S.carByLane(w.lane) && S.tokens.stateOf(w.lane, S.eng.elapsed(S.now)) === 'out') return { ...out, bg: S.tokens.outColor, color: contrast(S.tokens.outColor) };
    return out;
  }
  function widgetContent(w, S) {
    const type = w.type, opt = Wd.resolveOpt(w, S.imageSets, S.clubLogo); // the widget's own settings, with a chosen picture set (or the club logo) filled in
    const perLane = !!(Wd.def(type) && Wd.def(type).perLane); // a widget that shows one lane's car
    const c = perLane ? S.carByLane(w.lane) : null;
    if (perLane && !c && !((type === 'teamname' || type === 'teampicture') && opt.team)) return { html: '' }; // (a widget that shows one chosen team needs no car)
    const t = S.eng.endAt && S.eng.status === 'finished' ? S.eng.endAt : S.now;
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
          const f = S.flashOf(c), last = c.laps.length ? c.laps[c.laps.length - 1] : null, fresh = f && S.now - f.at < (opt.holdSeconds ?? 3) * 1000;
          const bg = fresh ? (f.kind === 'record' ? (opt.recordColor || '#ffc400') : f.kind === 'pb' ? (opt.pbColor || '#a45cff') : null) : null;
          return { html: Dl.wrap(Number.isFinite(last) ? E.fmtTime(last) : '–', res, opt), ...(bg ? { bg, color: contrast(bg) } : {}) };
        }
        const base = widgetContent({ ...w, type: Dl.baseOf(type) }, S);
        return { ...base, html: Dl.wrap(base.html, res, opt) };
      }
      case 'lanecolor': { const lc = S.laneColorsOf ? S.laneColorsOf(c.lane) : {}; return { html: '', ...(lc.bg && !w.bgColor ? { bg: lc.bg } : {}) }; } // the colour set for the lane in the layout (Lane colours); a colour set on the widget itself wins and never changes the lane's colour for other widgets
      case 'nickname': return { html: esc(c.nickname || c.driverName) };
      case 'speed': {
        const track = S.track || {}, ms = !c.laps.length ? null : opt.source === 'best' ? c.best : opt.source === 'average' ? (E.averageLaps(c).length ? mean(E.averageLaps(c)) : null) : c.laps[c.laps.length - 1];
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
      case 'laptime': {
        const f = S.flashOf(c);
        if (f && S.now - f.at < (opt.holdSeconds ?? 3) * 1000) {
          const bg = f.kind === 'record' ? (opt.recordColor || '#ffc400') : f.kind === 'pb' ? (opt.pbColor || '#a45cff') : null;
          return bg ? { html: E.fmtTime(f.time), bg, color: contrast(bg) } : { html: E.fmtTime(f.time) };
        }
        return { html: c.done ? '–' : E.fmtTime(S.eng.lapElapsed(S.eng.cars.indexOf(c), S.now)) };
      }
      case 'lastlap': return { html: Wd.lapListHtml(c.laps.map((t, i) => ({ n: i + 1, t: E.fmtTime(t) })).reverse(), opt.lapsPerColumn, opt.columns, opt.lapNumbers !== false) };
      case 'avglap': return { html: E.averageLaps(c).length ? E.fmtTime(mean(E.averageLaps(c))) : '–' };
      case 'medlap': return { html: E.averageLaps(c).length ? E.fmtTime(median(E.averageLaps(c))) : '–' };
      case 'bestlap': return { html: c.best === null ? '–' : E.fmtTime(c.best) };
      case 'gap': return { html: esc(S.rowOf(c).gap) };
      case 'recordlap': { const b = S.personalBest(c.driverId); return { html: Number.isFinite(b) ? E.fmtTime(b) : '–' }; }
      case 'sessionrecord': case 'trackrecord': {
        const r = type === 'sessionrecord' ? S.sessionRecord() : S.trackRecord();
        if (!r || !Number.isFinite(r.time)) return { html: '–' };
        return { html: E.fmtTime(r.time) + (opt.showName !== false && r.name ? `<small class="rn">${esc(r.name)}</small>` : '') };
      }
      case 'heatlist': return { html: S.heat ? Wd.heatListHtml(S.heat, S.phase, opt) : '\u2013' }; // every heat of a heat-based race, with who won it
      case 'nextheat': return { html: S.heat ? Wd.nextHeatHtml(S.heat, S.phase, opt) : '\u2013' }; // 1.62.0: the drivers of the next heat, by lane
      case 'leaderboard': {
        const design = opt.design && (S.rowDesigns || []).find(x => x.id === opt.design); // a row design you made, instead of the classic table
        const RowsM = typeof module !== 'undefined' ? require('./rows.js') : root.Rows;
        if (design) return { html: RowsM.html(design, S, undefined, { scale: opt.scale, gaps: opt.gaps, fill: opt.fill, from: opt.from, to: opt.to, orderBy: opt.orderBy, orderDir: opt.orderDir }) };
        const rows = RowsM.range(ordered(S.standings(), opt, S), opt).map(x => { // (orderBy: the board in the order of a value; from and to: only some of the places, for a board that shows part of the field)
          const car = x.car, lc = S.laneColorsOf ? S.laneColorsOf(car.lane) : {};
          return { pos: x.pos, flag: car.flag, name: car.driverName, nickname: car.nickname || car.driverName, callsign: car.callsign || '',
            laps: String(car.laps.length), best: car.best === null ? '–' : E.fmtTime(car.best), last: car.laps.length ? E.fmtTime(car.laps[car.laps.length - 1]) : '–',
            current: car.done ? '–' : E.fmtTime(S.eng.lapElapsed(S.eng.cars.indexOf(car), S.now)), fuel: S.eng.fuel && S.eng.fuel.on ? `${(Math.floor(S.eng.fuelOf(S.eng.cars.indexOf(car), S.now) * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')} L` : '–', tyres: opt.colTyres === true && S.eng.tyrewear ? Tyw.cellHtml(Tw.view(S.eng, [car.lane], S.now).rows[0]) : '–', pace: opt.colPace === true && S.eng.pushSave ? Pw.rowHtml(S.eng.psInfo(car), S.eng.pushSave, { look: 'cell' }).html : '–', gap: x.gap, color: lc.color, bg: lc.bg };
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
        if (opt.live !== false && going) pts += ch.list[S.rowOf(c).pos - 1] || 0;
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
        const lim = opt.countdown !== false ? timeLimitOf(S.setup) : 0, html = clockText(lim ? lim - S.eng.elapsed(t) : S.eng.elapsed(t)); // a time limit: the clock counts down to 00:00.0
        if (opt.flagColour !== false) {
          if (S.eng.flag === 'red') return { html, bg: '#d62828', color: '#fff' };
          if (S.eng.flag === 'yellow') return { html, bg: '#ffd400', color: '#000' };
        }
        return { html };
      }
      case 'lights': { // counting down: the lights come on one by one; otherwise the choice for the state of the race
        // a picture set gives a picture per light and per race state (a set from before the grid has only Countdown and Lights off)
        const st = stateOf(S), imgs = opt.lightImages || {}, pics = { pick: (i, lit) => Wd.lightPic(imgs, st, i, lit) };
        if (st === 'countdown') return { html: Wd.lightsHtml(S.lights, pics) };
        // the widget's own choice for this state wins; without one, a race setup that lets the lights follow the flag lights all five for green, yellow and red
        const own = opt['lights_' + st] !== undefined && opt['lights_' + st] !== '', follow = S.setup && S.setup.lightsAfter === 'flags' && ['running', 'yellow', 'red'].includes(st);
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

  const api = { content, ordered, orderValue, classifyLap, mean, median, contrast };
  root.Timing = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
