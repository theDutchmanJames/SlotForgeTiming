// Works out what each widget shows on the live timing page. Pure: it only reads the state it is given,
// so it can be tested without a screen. The widgets made in the Widget Builder are drawn here too.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const Sp = typeof module !== 'undefined' ? require('./speed.js') : root.Speed;
  const Wd = typeof module !== 'undefined' ? require('./widgets.js') : root.Widgets;
  const Tk = typeof module !== 'undefined' ? require('./tokens.js') : root.Tokens;
  const Dl = typeof module !== 'undefined' ? require('./delta.js') : root.Delta; // the Delta Timers (delta.js)
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
  const lapLimitOf = setup => (setup.sessionType === 'race' || (setup.sessionType === 'heats' && setup.heatBy !== 'time')) ? Number(setup.laps) || 0 : 0;
  const timeLimitOf = setup => (setup.sessionType === 'timed' || setup.sessionType === 'qualifying' || (setup.sessionType === 'heats' && setup.heatBy === 'time')) ? (Number(setup.duration) || 0) * 60000 : 0;
  const sessionLabel = { practice: 'Free practice', qualifying: 'Qualifying', race: 'Race', timed: 'Timed race', heats: 'Heats', tokens: 'Time tokens' };
  const flagText = { ready: 'Ready', running: 'Racing', paused: 'Paused', between: 'Heat finished', finished: 'Finished' };


  // The {variables} of the custom text widgets. Values are already safe to put in HTML.
  function laneVars(S, c, t) {
    const E_ = S.eng, i = E_.cars.indexOf(c), row = S.rowOf(c), laps = c.laps.length, g = E.goodLaps(c), F = E_.fuel, P = E_.penalty, track = S.track || {}, ch = S.champ;
    const speedOf = scaled => { const ms = laps ? c.laps[laps - 1] : null, base = Sp.kmh(Sp.laneLength(track, c.lane), ms), f = scaled ? (Sp.scaleFactor(c.carScale) || Sp.scaleFactor(track.scale)) : 1; return base === null || !f ? '–' : (base * f).toFixed(scaled ? 0 : 1); };
    const pit = E_.pitTime(i, t), sec = P && P.on ? E_.penMs(c) / 1000 : 0, best = S.personalBest(c.driverId);
    let champ = '–'; if (ch && ch.on) { champ = ch.done.get(c.driverId) || 0; if (['running', 'paused', 'review'].includes(S.phase) && E_.cars.some(x => x.laps.length)) champ += ch.list[row.pos - 1] || 0; }
    return { name: esc(c.driverName), nickname: esc(c.nickname || c.driverName), callsign: esc(c.callsign || ''), car: esc(c.carName || ''), lane: c.lane + 1, position: row.pos, lap: c.done ? laps : laps + 1, laps,
      laptime: c.done ? '–' : E.fmtTime(E_.lapElapsed(i, S.now)), last: laps ? E.fmtTime(c.laps[laps - 1]) : '–', best: c.best === null ? '–' : E.fmtTime(c.best), avg: g.length ? E.fmtTime(mean(g)) : '–', median: g.length ? E.fmtTime(median(g)) : '–',
      record: Number.isFinite(best) ? E.fmtTime(best) : '–', gap: esc(row.gap),
      fuel: F && F.on ? `${(Math.floor(E_.fuelOf(i, t) * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')} L` : '–', fuelpct: F && F.on && F.tank ? Math.round(E_.fuelOf(i, t) / F.tank * 100) + '%' : '–',
      penpoints: P && P.on ? (c.dq ? 'DQ' : c.points) : '–', pentime: P && P.on ? `+${Number.isInteger(sec) ? sec : sec.toFixed(1)} s` : '–', champ, pits: c.pits ? c.pits.length : 0, pit: pit ? E.fmtTime(pit.ms) : '–', speed: speedOf(true), speedreal: speedOf(false) };
  }
  function raceVars(S, t) {
    const laps = lapLimitOf(S.setup), time = timeLimitOf(S.setup), lead = S.standings()[0], most = Math.max(0, ...S.eng.cars.map(x => x.laps.length)), sr = S.sessionRecord ? S.sessionRecord() : null, tr = S.trackRecord ? S.trackRecord() : null;
    const st = flagStateOf(S);
    const rec = r => (r && Number.isFinite(r.time) ? E.fmtTime(r.time) : '–'), by = r => (r && Number.isFinite(r.time) && r.name ? esc(r.name) : '');
    return { clock: clockText(S.eng.elapsed(t)), timeleft: time ? mmss(Math.max(0, time - S.eng.elapsed(t))) : '–', lapsleft: laps ? Math.max(0, laps - most) : '–', lapstotal: laps || '–', leader: lead && lead.car ? esc(lead.car.driverName) : '–',
      flag: st === 'red' ? 'Red flag' : st === 'yellow' ? 'Yellow flag' : flagText[st] || '', heat: S.heat ? heatLabel(S.heat) : '',
      track: esc((S.track && S.track.name) || ''), session: esc(S.setup.name || ''), type: esc(sessionLabel[S.setup.sessionType] || ''), sessionrecord: rec(sr), sessionrecordby: by(sr), trackrecord: rec(tr), trackrecordby: by(tr) };
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
    if (perLane && !c) return { html: '' };
    const t = S.eng.endAt && S.eng.status === 'finished' ? S.eng.endAt : S.now;
    switch (type) {
      case 'tokenclock': {
        const K = S.tokens; if (!K) return { html: '–' };
        const T = S.eng.elapsed(t), st = K.stateOf(c.lane, T), html = Tk.clockText(K.left(c.lane, T));
        if (st === 'warning' && opt.warnColour !== false) return { html, bg: K.warnColor, color: contrast(K.warnColor) };
        if (st === 'idle') return { html, color: 'var(--muted)' }; // nothing bought on this lane: dimmed
        return { html };
      }
      case 'dlaptime': case 'davglap': case 'dmedlap': case 'dbestlap': case 'drecordlap': case 'dpitstop': case 'dsessionrecord': case 'dtrackrecord': { // a Delta Timer: the ordinary widget, with the difference beside it (delta.js)
        const base = widgetContent({ ...w, type: Dl.baseOf(type) }, S);
        return { ...base, html: Dl.wrap(base.html, Dl.compute(type, opt, c, S, t), opt) };
      }
      case 'lanecolor': { const lc = S.laneColorsOf ? S.laneColorsOf(c.lane) : {}; return { html: '', ...(lc.bg && !w.bgColor ? { bg: lc.bg } : {}) }; } // the colour set for the lane in the layout (Lane colours); a colour set on the widget itself wins and never changes the lane's colour for other widgets
      case 'nickname': return { html: esc(c.nickname || c.driverName) };
      case 'speed': {
        const track = S.track || {}, ms = !c.laps.length ? null : opt.source === 'best' ? c.best : opt.source === 'average' ? (E.goodLaps(c).length ? mean(E.goodLaps(c)) : null) : c.laps[c.laps.length - 1];
        const base = Sp.kmh(Sp.laneLength(track, c.lane), ms), scaled = opt.mode !== 'real', f = scaled ? (Sp.scaleFactor(c.carScale) || Sp.scaleFactor(track.scale)) : 1;
        if (base === null || !f) return { html: '–' };
        const v = Sp.toUnit(base * f, opt.unit);
        return { html: v.toFixed(scaled ? 0 : 1) + (opt.showUnit === false ? '' : opt.unit === 'mph' ? ' mph' : ' km/h') };
      }
      case 'carpicture': return { html: c.carPicture ? `<span class="avframe"><img class="avimg" src="${esc(c.carPicture)}" alt="" style="transform:${Wd.frameTransform(opt.frame)}"></span>` : '' };
      case 'textlane': return { html: Wd.fillText(opt.text ?? Wd.TEXT_LANE_DEFAULT, laneVars(S, c, t)) };
      case 'imagelane': return { html: Wd.imageHtml(Wd.pickImage(opt, laneVars(S, c, t)), opt.fit) };
      case 'logo': return { html: Wd.imageHtml(opt.image, opt.fit) };
      case 'imagerace': return { html: Wd.imageHtml(Wd.pickImage(opt, raceVars(S, t)), opt.fit) };
      case 'textrace': return { html: Wd.fillText(opt.text ?? Wd.TEXT_RACE_DEFAULT, raceVars(S, t)) };
      case 'carname': return { html: esc(c.carName || '') };
      case 'callsign': return { html: esc(c.callsign || '') };
      case 'name': return { html: esc(c.driverName) };
      case 'avatar': return { html: c.avatar ? `<span class="avframe"><img class="avimg" src="${esc(c.avatar)}" alt="" style="transform:${Wd.frameTransform(opt.frame)}"></span>` : `<span class="av">${esc((c.driverName || '?')[0])}</span>` };
      case 'driverflag': return { html: c.flag ? `<span class="fi fi-${esc(String(c.flag).toLowerCase())}"></span>` : '' };
      case 'position': return { html: String(S.rowOf(c).pos) };
      case 'lap': {
        const total = lapLimitOf(S.setup), n = c.laps.length, cur = c.done ? n : n + 1;
        return { html: total ? `${Math.min(cur, total)}/${total}` : String(cur) };
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
      case 'avglap': return { html: E.goodLaps(c).length ? E.fmtTime(mean(E.goodLaps(c))) : '–' };
      case 'medlap': return { html: E.goodLaps(c).length ? E.fmtTime(median(E.goodLaps(c))) : '–' };
      case 'bestlap': return { html: c.best === null ? '–' : E.fmtTime(c.best) };
      case 'gap': return { html: esc(S.rowOf(c).gap) };
      case 'recordlap': { const b = S.personalBest(c.driverId); return { html: Number.isFinite(b) ? E.fmtTime(b) : '–' }; }
      case 'sessionrecord': case 'trackrecord': {
        const r = type === 'sessionrecord' ? S.sessionRecord() : S.trackRecord();
        if (!r || !Number.isFinite(r.time)) return { html: '–' };
        return { html: E.fmtTime(r.time) + (opt.showName !== false && r.name ? `<small class="rn">${esc(r.name)}</small>` : '') };
      }
      case 'leaderboard': {
        const design = opt.design && (S.rowDesigns || []).find(x => x.id === opt.design); // a row design you made, instead of the classic table
        if (design) return { html: (typeof module !== 'undefined' ? require('./rows.js') : root.Rows).html(design, S, undefined, { scale: opt.scale, gaps: opt.gaps, fill: opt.fill }) };
        const rows = S.standings().map(x => {
          const car = x.car, lc = S.laneColorsOf ? S.laneColorsOf(car.lane) : {};
          return { pos: x.pos, flag: car.flag, name: car.driverName, nickname: car.nickname || car.driverName, callsign: car.callsign || '',
            laps: String(car.laps.length), best: car.best === null ? '–' : E.fmtTime(car.best), last: car.laps.length ? E.fmtTime(car.laps[car.laps.length - 1]) : '–',
            current: car.done ? '–' : E.fmtTime(S.eng.lapElapsed(S.eng.cars.indexOf(car), S.now)), fuel: S.eng.fuel && S.eng.fuel.on ? `${(Math.floor(S.eng.fuelOf(S.eng.cars.indexOf(car), S.now) * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '')} L` : '–', gap: x.gap, color: lc.color, bg: lc.bg };
        });
        return { html: Wd.leaderHtml(rows, opt) };
      }
      case 'fuel': { const F = S.eng.fuel; return { html: F && F.on ? Wd.fuelHtml(S.eng.fuelOf(S.eng.cars.indexOf(c), t), F.tank, opt) : '–' }; }
      case 'champpoints': { // points from the heats finished so far, plus (optionally) what the current heat's positions are worth right now
        const ch = S.champ; if (!ch || !ch.on) return { html: '–' };
        let pts = ch.done.get(c.driverId) || 0;
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
        // a picture set gives a picture per light and per race state (a set from before the grid has only Light on and Light off)
        const st = stateOf(S), imgs = opt.lightImages || {}, pics = { pick: (i, lit) => Wd.lightPic(imgs, st, i, lit) };
        if (st === 'countdown') return { html: Wd.lightsHtml(S.lights, pics) };
        // the widget's own choice for this state wins; without one, a race setup that lets the lights follow the flag lights all five for green, yellow and red
        const own = opt['lights_' + st] !== undefined && opt['lights_' + st] !== '', follow = S.setup && S.setup.lightsAfter === 'flags' && ['running', 'yellow', 'red'].includes(st);
        return { html: Wd.lightsHtml(own ? Wd.lightCount(opt, st) : follow ? 5 : 0, pics, Wd.lightColor(opt, st)) };
      }
      case 'info': {
        const parts = [];
        if (S.heat) parts.push(heatLabel(S.heat));
        const laps = lapLimitOf(S.setup), time = timeLimitOf(S.setup);
        if (laps) parts.push(`${Math.max(0, laps - Math.max(0, ...S.eng.cars.map(x => x.laps.length)))} laps left`);
        else if (time) parts.push(`${mmss(Math.max(0, time - S.eng.elapsed(t)))} left`);
        else if (!S.heat) parts.push(S.setup.sessionType === 'tokens' ? 'Time tokens' : 'Free practice');
        if (S.heat && S.phase === 'between' && S.heat.breakLeft > 0) parts.push(`next ${S.heat.final ? 'final ' + S.heat.final : 'heat'} in ${mmss(S.heat.breakLeft * 1000)}`);
        return { html: esc(parts.join(' · ')) };
      }
      case 'flag': { // the race state as a flag, an LED, text or a picture of a picture set (the widget's Flag style)
        const st = flagStateOf(S), style = Wd.flagStyleOf(opt);
        if (style === 'flags') return { html: Wd.flagHtml(st, { mirror: !!opt.flagMirror }) };
        if (style === 'leds') return { html: Wd.ledHtml(st) };
        const img = style === 'images' ? opt['img_' + st] : '';
        if (img) return { html: `<img class="flagimg" src="${esc(img)}" alt="${esc(flagText[st] || st)}">` };
        if (st === 'red') return { html: 'RED FLAG', bg: '#d62828', color: '#fff' }; // text, also for a state a picture set has no picture for
        if (st === 'yellow') return { html: 'YELLOW FLAG', bg: '#ffd400', color: '#000' };
        return { html: flagText[st] || '' };
      }
      case 'start': return { html: S.phase === 'between' && S.heat ? (S.heat.final ? `Start final ${S.heat.final}` : `Start heat ${S.heat.idx + 1}`) : 'Start', button: true, disabled: !(S.phase === 'ready' || S.phase === 'between') || !!S.calling || !!(S.heat && S.heat.picking) };
      case 'pause': return { html: S.phase === 'paused' ? 'Resume' : 'Pause', button: true, disabled: !(S.phase === 'running' || S.phase === 'paused') };
      case 'stop': return { html: 'Stop', button: true, disabled: !(S.phase === 'running' || S.phase === 'paused' || S.phase === 'between') };
      case 'yellow': return { html: 'Yellow flag', button: true, disabled: !(S.phase === 'running' || S.eng.flag === 'yellow') || S.eng.flag === 'red',
        ...(S.eng.flag === 'yellow' ? { bg: '#ffd400', color: '#000' } : {}) };
      case 'red': return { html: 'Red flag', button: true, disabled: !(S.phase === 'running' || S.phase === 'paused'),
        ...(S.eng.flag === 'red' ? { bg: '#d62828', color: '#fff' } : {}) };
      default: return { html: '' };
    }
  }

  const api = { content, classifyLap, mean, median, contrast };
  root.Timing = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
