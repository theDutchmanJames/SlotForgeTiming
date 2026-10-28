// Read-only race information. Shared by editor samples, timing and leaderboard rows.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clock = ms => { const n = Math.max(0, Math.ceil(ms / 100)); return `${String(Math.floor(n / 600)).padStart(2, '0')}:${String(Math.floor(n / 10) % 60).padStart(2, '0')}.${n % 10}`; };
  const detail = { key: 'details', label: 'Show supporting detail', type: 'checkbox', default: true };
  const DEFINITIONS = [
    ['servicestop', 'Service Stop', 'Pit Stops', [{ ...detail }, { key: 'progress', label: 'Show stop progress', type: 'checkbox', default: true }]],
    ['fuelrange', 'Fuel Range', 'Slotcar', [{ ...detail }, { key: 'sampleLaps', label: 'Recent clean laps for estimate (Calculations can override)', type: 'number', min: 3, max: 20, step: 1, default: 5 }]],
    ['gapnext', 'Gap to Next Driver', 'Position and Progress', [{ ...detail }]],
    ['penaltyserve', 'Penalty to Serve', 'Pit Stops', [{ ...detail }]],
    ['lapvalidity', 'Lap Validity', 'Lap Times and Records', [{ ...detail }, { key: 'lap', label: 'Check', type: 'select', default: 'current', choices: [['current', 'Current lap (last lap after finishing)'], ['last', 'Last completed lap']] }]],
    ['safetycartarget', 'Safety Car Target', 'Race', [{ ...detail }]],
    ['stinttime', 'Stint Time', 'Team and Swaps', [{ ...detail }]]
  ];
  const TYPES = new Set(DEFINITIONS.map(d => d[0]));
  const model = (value, note = '', tone = '', progress = null) => ({ value, note, tone, progress });
  const unavailable = note => model('—', note);
  const timeAt = (e, t) => e.status === 'paused' ? e.pausedAt : e.status === 'finished' ? e.endAt : t;
  const out = c => c.dq ? model('DQ', 'Driver disqualified', 'bad') : c.retired ? model('OUT', 'Driver retired') : null;
  const pendingMs = c => (c.pending || []).reduce((n, p) => n + (p.kind === 'stopgo' ? Math.max(0, Number(p.seconds) || 0) * 1000 : 0), 0);
  function read(type, c, S, opt = {}) {
    const e = S.eng, i = e.cars.indexOf(c), t = timeAt(e, S.now), terminal = out(c);
    if (terminal && type !== 'lapvalidity' && type !== 'stinttime') return terminal;
    if (type === 'servicestop') {
      const ph = e.pitControl;
      if (!ph || !['auto', 'manual'].includes(ph.mode)) return unavailable('Service Stop off');
      if (c.done || e.status === 'finished') return model('FINISHED', 'Stop timing has ended');
      const h = e.pitHoldOf(i, t);
      if (!h || !c.pitHold) return model('—', c.blockAt != null ? 'Waiting for pit entry' : 'Not in pits');
      const total = ph.seconds * 1000 + (c.pitHold.extraMs || 0);
      const progress = total > 0 ? Math.max(0, Math.min(1, 1 - h.remaining / total)) : 0;
      const extra = c.pitHold.extraMs > 0 ? ` · +${c.pitHold.extraMs / 1000} s penalty` : '';
      if (e.status !== 'running') return model('PAUSED', `${clock(h.remaining)} remaining`, 'warn', progress);
      if (h.randomHold) return model('HOLD', 'Pit exit held by Random Flag', 'warn', progress);
      if (!h.ready) return model(clock(h.remaining), h.text + extra, 'warn', progress);
      if (h.mode === 'manual') return model('READY', 'Awaiting director release', 'warn', 1);
      // Timer completion alone is not permission to leave: the sensor may need the car back.
      if (h.covered === null) return model('HOLD', 'Waiting for sensor', 'warn', 1);
      if (ph.waitReturn !== false && !c.pitHold.returned && h.covered === false) return model('RETURN', 'Return car to sensor', 'warn', 1);
      return model('GO', h.covered ? 'Drive off sensor' : 'Ready to release', 'good', 1);
    }
    if (type === 'fuelrange') {
      if (!e.fuel || !e.fuel.on) return unavailable('Fuel system off');
      const Ps = typeof module !== 'undefined' ? require('./pushsave.js') : root.PushSave;
      const policy = Ps?.estimatePolicy(e.cfg?.calculations?.estimates || {});
      const count = Math.max(3, Math.min(20, Math.round(policy?.fuelWindow || Number(opt.sampleLaps) || 5)));
      const samples = (c.fuelSamples || []).filter(x => x && Number.isFinite(x.used) && x.used > 0 && x.lap < c.laps.length && !(c.invalid || []).includes(x.lap) && !(c.removed || []).includes(x.lap) && !(c.bad || [])[x.lap] && !(c.pitLaps || []).includes(x.lap)).slice(-count);
      if (samples.length < 3) return unavailable(`Learning · ${samples.length}/3 clean laps`);
      const remaining = e.fuelOf(i, t), used = policy?.fuelMethod === 'median' ? Ps.benchmark('median', samples.map(x=>x.used), 0, {minimum:3}) : samples.reduce((n, x) => n + x.used, 0) / samples.length;
      if (!Number.isFinite(remaining)) return unavailable('Fuel unavailable');
      const laps = Math.max(0, remaining) / used;
      return model(`≈ ${laps.toFixed(1)} laps`, `Estimated · last ${samples.length} laps`, laps < 2 ? 'warn' : '');
    }
    if (type === 'gapnext') {
      const rows = e.standings(), row = rows.find(r => r.car === c), gap = e.gapInfo()[i];
      if (!row || !gap) return unavailable('No classified position');
      if (row.pos === 1) return model('LEADER', 'No driver ahead');
      if (!Number.isFinite(gap.ahead)) return unavailable('Waiting for comparable laps');
      const ahead = rows[row.pos - 2];
      return model('+' + E.fmtTime(gap.ahead), `To ${ahead.car.driverName || 'driver'} · P${ahead.pos}`);
    }
    if (type === 'penaltyserve') {
      const queue = c.pending || [], ms = pendingMs(c);
      if (!queue.length) return model('CLEAR', 'No pit penalties outstanding', 'good');
      const h = e.pitHoldOf(i, t);
      let left = ms;
      if (c.blockAt != null && e.status !== 'ready') {
        if (h && c.pit) left = Math.min(ms, Math.max(0, c.pit.start + e.pitControl.seconds * 1000 + (c.pit.penaltyMs || 0) + ms - t));
        // Legacy stops serve the first penalty from sensor arrival. Subsequent penalties
        // are shown as queued; do not invent an additive countdown for that old mode.
        else if (queue[0].kind === 'stopgo') left = Math.max(0, queue[0].seconds * 1000 - (t - c.blockAt)) + Math.max(0, ms - queue[0].seconds * 1000);
      }
      const drive = queue.filter(p => p.kind === 'drivethrough').length;
      const note = `${queue.length} pit ${queue.length === 1 ? 'penalty' : 'penalties'}${drive ? ` · ${drive} drive-through` : ''}${e.status === 'paused' ? ' · paused' : ''}`;
      return model(ms ? clock(left) : 'PIT REQUIRED', note, 'warn');
    }
    if (type === 'lapvalidity') {
      if (c.dq) return model('DQ', 'Driver disqualified', 'bad');
      const last = opt.lap === 'last' || c.done || e.status === 'finished';
      if (!last) {
        if (!c.started || e.status === 'ready') return unavailable('Lap timing not started');
        if (c.redInterrupted) return model('INVALID', 'Current lap · red flag interruption', 'bad');
        if (c.resumed) return model('EXCLUDED', 'Current lap · interrupted timing', 'warn');
        if (Number(e.cfg.maxLap) > 0 && e.lapElapsed(i, t) > Number(e.cfg.maxLap)) return model('EXCLUDED', 'Current lap · over maximum lap time', 'warn');
        return model('VALID SO FAR', 'Current lap · provisional', 'good');
      }
      const n = c.laps.length - 1;
      if (n < 0) return unavailable('No completed lap');
      const tag = `Lap ${n + 1}`;
      if ((c.removed || []).includes(n)) return model('REMOVED', `${tag} · removed from result`, 'bad');
      if ((c.invalid || []).includes(n)) return model('INVALID', `${tag} · ${(c.redLaps || []).includes(n) ? 'red flag interruption' : 'director invalidated'}`, 'bad');
      if ((c.bad || [])[n]) return model('EXCLUDED', `${tag} · slow or interrupted timing`, 'warn');
      return model('VALID', `${tag} · eligible for lap records`, 'good');
    }
    if (type === 'safetycartarget') {
      if (!e.safetyCar) return unavailable('Safety Car system off');
      if (!e.scOut() || e.status === 'finished') return unavailable('Safety Car not deployed');
      const target = e.yellow && e.yellow.target;
      if (!(target > 0)) return unavailable('No target lap time');
      // Only a whole lap driven under the current yellow flag is judged by the engine.
      const n = c.laps.length, dt = n ? c.laps[n - 1] : null, fullyYellow = n > 0 && e.yellowAt != null && c.last - dt >= e.yellowAt;
      if (!fullyYellow) return model(E.fmtTime(target) + ' s', 'Minimum lap time · awaiting full yellow lap', 'warn');
      const delta = dt - target;
      return model(E.fmtTime(target) + ' s', `Last lap ${delta < 0 ? '−' : '+'}${(Math.abs(delta) / 1000).toFixed(3)} s · ${delta < 0 ? 'too fast' : 'on target'}`, delta < 0 ? 'bad' : 'good');
    }
    if (type === 'stinttime') {
      const look = c.en && e.endurance && e.enLook(i, t);
      return look ? model(clock(look.stintMs), `Current driver · ${c.driverName || '—'}`) : unavailable('No driver rotation in this race');
    }
    return unavailable('');
  }
  function html(m, opt = {}) {
    const tone = ['good', 'warn', 'bad'].includes(m.tone) ? m.tone : '';
    const note = opt.details !== false && m.note ? `<span class="strategy-note">${esc(m.note)}</span>` : '';
    const bar = opt.progress !== false && Number.isFinite(m.progress) ? `<span class="strategy-track" role="progressbar" aria-label="Stop progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(m.progress * 100)}"><span style="width:${Math.max(0, Math.min(100, m.progress * 100))}%"></span></span>` : '';
    return `<span class="strategy-widget strategy-${tone || 'plain'}"><strong class="strategy-value">${esc(m.value)}</strong>${note}${bar}</span>`;
  }
  const SAMPLES = {
    servicestop: model('00:15.0', 'Service in progress · +5 s penalty', 'warn', .57),
    fuelrange: model('≈ 18.4 laps', 'Estimated · last 5 laps'),
    gapnext: model('+0.825', 'To Bjornie · P2'),
    penaltyserve: model('00:05.0', '1 pit penalty', 'warn'),
    lapvalidity: model('INVALID', 'Current lap · red flag interruption', 'bad'),
    safetycartarget: model('12.000 s', 'Last lap −0.250 s · too fast', 'bad'),
    stinttime: model('04:32.1', 'Current driver · James')
  };
  const api = { TYPES, DEFINITIONS, read, html, clock, sample: (type, opt) => html(SAMPLES[type], opt) };
  root.StrategyWidgets = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
