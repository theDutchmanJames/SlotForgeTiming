// Read-only charts over completed laps. No chart option changes race rules.
(function (root) {
  const X = typeof module !== 'undefined' ? require('./chartextras.js') : root.ChartExtras;
  const STYLES = [['trend', 'Lap Trend'], ['bars', 'Driver Comparison'], ['delta', 'Delta Trend'], ['track','Live Track'], ['box','Lap Time Spread'], ['hist','Lap Distribution'], ['position','Position History'], ['heat','Lap Heatmap']];
  const METRICS = [['lap', 'Lap time'], ['best', 'Best lap so far'], ['average', 'Average lap'], ['median', 'Median lap']];
  const COLORS = ['#35a8cf', '#80b354', '#e7bb31', '#ae8ce6', '#e47766', '#5fcac3', '#e885b9', '#a9b8cb'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d, lo, hi) => v !== '' && v != null && Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d;
  const choice = (v, choices, fallback) => choices.includes(v) ? v : fallback;
  function clean(raw = {}) {
    const d = raw || {}, style = choice(d.style, STYLES.map(x => x[0]), 'trend');
    return { name: String(d.name || 'New chart').slice(0, 100), note: String(d.note || '').slice(0, 500), style,
      // Retain the saved 'oval' key for the original lane styling; geometry comes from the race track.
      trackDrawing: choice(d.trackDrawing,['oval','design'],'oval'), virtual: d.virtual !== false, direction: choice(d.direction,['cw','ccw'],'cw'), pace: choice(d.pace,['median','average','last','track','profile'],'median'), motion: choice(String(d.motion),['10','4','0'],'10'),
      whisker: choice(d.whisker,['range','iqr'],'range'), bin: choice(String(d.bin),['0.1','0.2','0.5'],'0.2'), frequency: choice(d.frequency,['count','percent'],'count'), heatReference: choice(d.heatReference,['track','median'],'track'), labels: d.labels !== false,
      metric: choice(d.metric, METRICS.map(x => x[0]), style === 'bars' ? 'best' : 'lap'),
      drivers: choice(d.drivers, ['all', 'selected', 'one'], 'all'), lanes: Array.isArray(d.lanes) ? [...new Set(d.lanes.filter(n => Number.isInteger(n) && n >= 0 && n < 8))] : [0, 1, 2, 3], lane: Math.round(num(d.lane, 0, 0, 7)),
      history: choice(String(d.history), ['10', '20', '50', '100', 'all'], '20'), aggregate: choice(d.aggregate, ['all', 'rolling'], 'all'), window: Math.round(num(d.window, 5, 2, 100)),
      reference: choice(d.reference, style === 'delta' ? ['track', 'record', 'personal', 'manual'] : ['none', 'track', 'record', 'personal', 'manual'], 'track'), manual: num(d.manual, 10.5, .001, 3600),
      pits: d.pits === true, excluded: d.excluded !== false, legend: d.legend !== false, points: d.points === true, patterns: d.patterns === true,
      thickness: num(d.thickness, 2.5, 1, 5), scale: choice(d.scale, ['auto', 'fixed'], 'auto'), min: num(d.min, style === 'delta' ? -1 : 9, -3600, 3600), max: num(d.max, style === 'delta' ? 1 : 12, -3600, 3600) };
  }
  const median = a => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  function runningMedian() {
    const low=[],high=[];
    const push=(a,v,sign)=>{a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(sign*a[p]<=sign*a[i])break;[a[p],a[i]]=[a[i],a[p]];i=p;}};
    const pop=(a,sign)=>{const v=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&sign*a[c+1]<sign*a[c])c++;if(sign*a[i]<=sign*a[c])break;[a[i],a[c]]=[a[c],a[i]];i=c;}}return v;};
    return v=>{if(!low.length||v<=low[0])push(low,v,-1);else push(high,v,1);if(low.length>high.length+1)push(high,pop(low,-1),1);if(high.length>low.length)push(low,pop(high,1),-1);return low.length===high.length?(low[0]+high[0])/2:low[0];};
  }
  function model(raw, S) {
    const d = clean(raw), cars = [...((S.eng || {}).cars || []), ...(d.virtual ? (S.eng?.rivals || []) : [])].filter(c => d.drivers === 'all' || (d.drivers === 'one' ? c.lane === d.lane : d.lanes.includes(c.lane)));
    const last = Math.max(0, ...cars.map(c => (c.laps || []).length)), from = d.history === 'all' ? 0 : Math.max(0, last - Number(d.history));
    const series = cars.map(c => {
      const referenceMs = d.reference === 'manual' ? d.manual * 1000 : d.reference === 'track' ? Number((S.track || {}).targetLap) * 1000 : d.reference === 'personal' ? S.personalBest?.(c.driverId) : d.reference === 'record' ? S.trackRecord?.()?.time : null;
      const reference = Number.isFinite(referenceMs) && referenceMs > 0 ? referenceMs / 1000 : null;
      const excluded = new Set([...(c.invalid || []), ...(c.removed || []), ...(c.redLaps || [])]), pits = new Set(c.pitLaps || []);
      let sum = 0, count = 0, best = Infinity, values = [], latest = null; const nextMedian=runningMedian();
      const points = (c.laps || []).map((ms, n) => {
        const reason = excluded.has(n) ? 'Invalid / removed' : (c.bad || [])[n] ? 'Interrupted / excluded' : !d.pits && pits.has(n) ? 'Pit lap' : !(Number.isFinite(ms) && ms > 0) ? 'Unavailable' : '';
        if (reason) return { lap: n + 1, value: null, reason };
        const seconds = ms / 1000; sum += seconds; count++; best = Math.min(best, seconds);
        if (d.aggregate === 'rolling') { values.push(seconds); if(values.length>d.window)sum-=values.shift(); }
        const value = X.styles.includes(d.style) ? seconds : d.metric === 'lap' ? seconds : d.metric === 'best' ? best : d.metric === 'average' ? sum / (d.aggregate==='rolling'?values.length:count) : d.aggregate==='rolling'?median(values):nextMedian(seconds);
        latest = value;
        return { lap: n + 1, value: d.style === 'delta' ? reference === null ? null : value - reference : value, reason: d.style === 'delta' && reference === null ? 'No reference' : '' };
      }).slice(from);
      const color = (S.layout?.laneColors || [])[c.lane]?.bg;
      return { lane: c.lane, name: c.driverName || `Lane ${c.lane + 1}`, color: /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color || '') ? color : COLORS[((c.lane % 8) + 8) % 8], reference, latest, points, dq: !!c.dq, virtual: !!c.virtualRival };
    });
    const extra = X.styles.includes(d.style) ? X.model(d,series,cars,S) : {};
    return { ...extra, d, series, from: from + 1, last, excluded: series.reduce((n, s) => n + s.points.filter(p => p.reason && p.reason !== 'No reference').length, 0) };
  }
  // Keep endpoints and local extrema in each screen bucket, including gaps.
  // The raw observations remain available for statistics; only drawing is reduced.
  function thin(points, pixels) {
    const limit = Math.max(20, Math.floor(pixels)); if (points.length <= limit * 3) return points;
    const step = Math.ceil(points.length / limit), out = [];
    for (let i = 0; i < points.length; i += step) {
      const part = points.slice(i, i + step), indices = new Set([0, part.length - 1]);
      let low = -1, high = -1;
      part.forEach((p, j) => { if (p.value === null) { indices.add(j); if (j) indices.add(j - 1); if (j + 1 < part.length) indices.add(j + 1); } else { if (low < 0 || p.value < part[low].value) low = j; if (high < 0 || p.value > part[high].value) high = j; } });
      if (low >= 0) indices.add(low); if (high >= 0) indices.add(high);
      [...indices].sort((a, b) => a - b).forEach(j => out.push(part[j]));
    }
    return out;
  }
  const fmt = n => n.toFixed(3), delta = n => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
  function html(m, width = 480, height = 290) {
    const { d, series } = m, w = Math.max(0, Math.round(width)), h = Math.max(0, Math.round(height));
    const empty = message => `<div class="race-chart-empty">${esc(message)}</div>`;
    if (w < 240 || h < 160) return empty('Enlarge chart to at least 240 × 160 px');
    if (!series.length) return empty('No selected lanes in this race');
    if (X.styles.includes(d.style)) return X.html(m,w,h);
    const bars = d.style === 'bars', isDelta = d.style === 'delta', legendRows = d.legend && !bars ? Math.ceil(series.length / Math.max(1, Math.floor(w / 130))) : 0;
    const top = 27, left = bars ? Math.min(110, Math.round(w * .24)) : 64, right = bars ? 65 : 20, bottom = 39, svgH = h - (legendRows * 22) - 28, plotH = svgH - top - bottom, plotW = w - left - right;
    if (plotH < 60) return empty('Enlarge chart to give the labels room');
    const values = bars ? series.map(s => s.latest).filter(v => v !== null) : series.flatMap(s => s.points.map(p => p.value).filter(v => v !== null));
    const references = d.reference === 'none' ? [] : series.map(s => s.reference).filter(v => v !== null);
    if (!values.length) return empty(isDelta && references.length === 0 ? 'No reference lap time available' : 'Waiting for eligible completed laps');
    let lo=Infinity,hi=-Infinity; for(const v of values){lo=Math.min(lo,v);hi=Math.max(hi,v);}for(const v of isDelta?[0]:references){lo=Math.min(lo,v);hi=Math.max(hi,v);}
    const pad = Math.max(.05, (hi - lo) * .12); lo -= pad; hi += pad;
    if (isDelta) { hi = Math.max(Math.abs(lo), Math.abs(hi)); lo = -hi; }
    if (bars) { lo = 0; hi = Math.max(...values, ...references) * 1.15; }
    else if (d.scale === 'fixed' && d.max > d.min) { lo = d.min; hi = d.max; }
    const x = lap => left + (lap - m.from) / Math.max(1, m.last - m.from) * plotW, y = v => top + (hi - v) / (hi - lo) * plotH;
    let parts = [], clipped = 0;
    const text = (x, y, v, anchor = 'middle', cls = '') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(v)}</text>`;
    const line = (x1, y1, x2, y2, cls = 'chart-grid', style = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" ${style}/>`;
    if (bars) {
      [0, .5, 1].forEach(k => { const px = left + plotW * k; parts.push(line(px, top, px, top + plotH), text(px, top + plotH + 18, (hi * k).toFixed(1))); });
      const sorted = series.slice().sort((a, b) => (a.latest ?? Infinity) - (b.latest ?? Infinity)), rowH = plotH / sorted.length;
      if (rowH < 23) return empty('Enlarge chart for all selected drivers');
      sorted.forEach((s, i) => { const py = top + rowH * (i + .5), maxLetters = Math.max(6, Math.floor((left - 12) / 7)), name = s.name.length > maxLetters ? s.name.slice(0, maxLetters - 1) + '…' : s.name;
        parts.push(`<g><title>${esc(s.name)}: ${s.latest === null ? 'no eligible laps' : fmt(s.latest) + ' seconds'}${s.dq ? ' · DQ' : ''}</title>`, text(left - 8, py + 4, name, 'end'));
        if (s.latest !== null) { const bw = s.latest / hi * plotW; parts.push(`<rect x="${left}" y="${py - Math.min(12, rowH / 3)}" width="${bw}" height="${Math.min(24, rowH * 2 / 3)}" rx="4" fill="${s.color}"/>`, text(left + bw + 7, py + 4, fmt(s.latest), 'start', 'chart-value')); }
        else parts.push(text(left + 8, py + 4, '—', 'start'));
        if (s.reference !== null && d.reference !== 'none') { const rx = left + s.reference / hi * plotW; parts.push(line(rx, py - rowH * .35, rx, py + rowH * .35, 'chart-reference')); }
        parts.push('</g>');
      });
      parts.push(text(left + plotW / 2, svgH - 3, 'Lap time (seconds) · shorter is faster', 'middle', 'chart-axis'));
    } else {
      const precision = hi - lo < .1 ? 3 : hi - lo < 1 ? 2 : 1;
      for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; parts.push(line(left, y(v), w - right, y(v)), text(left - 8, y(v) + 4, (isDelta && v > 0 ? '+' : '') + v.toFixed(precision), 'end')); }
      const ticks = [...new Set([m.from, Math.round((m.from + m.last) / 2), m.last])];
      ticks.forEach(n => parts.push(text(x(n), top + plotH + 18, String(n))));
      parts.push(text(left + plotW / 2, svgH - 3, 'Completed lap', 'middle', 'chart-axis'));
      if (isDelta && lo <= 0 && hi >= 0) parts.push(line(left, y(0), w - right, y(0), 'chart-reference'));
      else if (d.reference !== 'none') series.forEach((s, i) => { if (s.reference !== null && s.reference >= lo && s.reference <= hi && (i === 0 || d.reference === 'personal')) parts.push(line(left, y(s.reference), w - right, y(s.reference), 'chart-reference', d.reference === 'personal' ? `style="stroke:${s.color}"` : '')); });
      series.forEach((s, i) => {
        let path = '', open = false; const lone=s.points.filter(p=>p.value!==null).length===1;
        // Count all clipped values before thinning, so the note remains accurate.
        clipped += s.points.filter(p => p.value !== null && (p.value < lo || p.value > hi)).length;
        thin(s.points, plotW).forEach(p => {
          if (p.value === null || p.value < lo || p.value > hi) { open = false; if (p.value === null && d.excluded && p.reason !== 'No reference') parts.push(`<path d="M${x(p.lap)-3} ${top+plotH-8}l6 6m-6 0l6-6" stroke="${s.color}" fill="none"><title>${esc(s.name)} · lap ${p.lap}: ${esc(p.reason)}</title></path>`); return; }
          path += (open ? 'L' : 'M') + x(p.lap).toFixed(2) + ' ' + y(p.value).toFixed(2) + ' '; open = true;
          if (d.points || lone) parts.push(`<circle cx="${x(p.lap)}" cy="${y(p.value)}" r="3" fill="${s.color}"><title>${esc(s.name)} · lap ${p.lap}: ${isDelta ? delta(p.value) : fmt(p.value)} s</title></circle>`);
        });
        parts.push(`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="${d.thickness}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${d.patterns ? ['', '8 4', '3 4', '10 3 2 3'][i % 4] : ''}"><title>${esc(s.name)}${s.dq ? ' · DQ' : ''}</title></path>`);
      });
    }
    const missing = d.reference !== 'none' && series.some(s => s.reference === null), refName = { none: 'No reference', track: 'Track target', record: 'Track record', personal: 'Personal best', manual: 'Manual target' }[d.reference];
    const refText = d.reference !== 'none' && d.reference !== 'personal' && references.length ? `${refName} ${fmt(references[0])} s` : refName;
    const note = `${refText}${missing ? ' · reference unavailable for some lanes' : ''}${bars ? ' · axis starts at zero' : `${m.excluded ? ' · '+m.excluded+' excluded laps' : ''}${clipped ? ' · '+clipped+' outside range' : ''}`}`;
    return `<div class="race-chart" role="group" aria-label="${esc(d.name)}"><svg viewBox="0 0 ${w} ${svgH}" width="${w}" height="${svgH}" role="img" aria-label="${esc(METRICS.find(x => x[0] === d.metric)[1])}${isDelta ? ' difference from reference, negative is faster' : ''}"><title>${esc(d.name)}</title>${text(left, 15, isDelta ? 'DELTA (s) · below zero is faster' : 'LAP TIME (s)', 'start', 'chart-axis')}${parts.join('')}</svg>${d.legend && !bars ? `<div class="chart-legend">${series.map(s => `<span title="${esc(s.name)}"><i style="background:${s.color}"></i>L${s.lane+1} · ${esc(s.name)}${s.dq ? ' · DQ' : ''}</span>`).join('')}</div>` : ''}<div class="chart-note" title="${esc(note)}">${esc(note)}</div></div>`;
  }
  function sampleState() {
    const P=typeof module!=='undefined'?require('./widgetpreview.js'):root.WidgetPreview;
    return P.state({type:'racechart'});
  }
  const sample = (d,width,height,layout={}) => html(model(d,{...sampleState(),layout}),width,height);
  const cache = new WeakMap();
  function content(w, S) {
    const raw = (S.chartDesigns || []).find(d => d.id === w.opt?.chartDesign);
    if (!raw) return { html: '<div class="race-chart-empty">Choose a saved design from Customization → Chart Editor</div>' };
    // A widget can override appearance without changing shared geometry or its saved chart.
    const appearance=raw.style==='track'&&['oval','design'].includes(w.opt?.trackDrawing)?w.opt.trackDrawing:'inherit';
    const effective=appearance==='inherit'?raw:{...raw,trackDrawing:appearance};
    // Editor changes must be visible immediately; the live cache throttles only race updates.
    if(S.preview)return {html:html(model(effective,S),w.chartSize?.width,w.chartSize?.height)};
    let items = cache.get(S.eng); if (!items) cache.set(S.eng, items = new Map());
    const size = w.chartSize || {width:480,height:290}, key = raw.id+'|'+appearance+'|'+JSON.stringify(S.layout?.laneColors||[]), t = typeof performance !== 'undefined' ? performance.now() : Date.now(), old = items.get(key);
    const cars = [...S.eng.cars,...(raw.virtual !== false ? S.eng.rivals || [] : [])];
    const count = cars.map(c => c.laps.length).join(',');
    // Check corrections at most four times per second; a clock tick alone never
    // rebuilds statistics. New laps bypass this interval. Snapshots also detect
    // same-length corrections and undo, without mutating engine-owned arrays.
    let current = old;
    if (!old || old.raw !== raw || old.count !== count || t - old.at >= 250) {
      const meta=JSON.stringify([effective,S.track?.targetLap,S.track?.lanes,S.track?.trackDesign?.document?.design?.revision,S.track?.trackDesign?.laneRoutes,S.track?.trackDesign?.confirmedMappingRevision,S.layout?.laneColors,S.trackRecord?.()?.time,cars.map(c=>[c.lane,c.driverName,c.driverId,c.dq,c.invalid,c.removed,c.pitLaps,c.redLaps,c.total,S.personalBest?.(c.driverId)])]);
      const same=old&&old.meta===meta&&old.snapshot.length===cars.length&&old.snapshot.every((p,i)=>p.laps.length===cars[i].laps.length&&p.laps.every((v,n)=>v===cars[i].laps[n])&&p.bad.length===(cars[i].bad||[]).length&&p.bad.every((v,n)=>v===(cars[i].bad||[])[n]));
      if(same){current.at=t;current.raw=raw;}
      else current={raw,count,at:t,meta,snapshot:cars.map(c=>({laps:c.laps.slice(),bad:(c.bad||[]).slice()})),model:model(effective,S)};
    }
    // Reuse geometry when several differently sized widgets share one design.
    const sizeKey=Math.round(size.width)+':'+Math.round(size.height);
    current.renders ||= new Map();
    if(!current.renders.has(sizeKey)){if(current.renders.size>=8)current.renders.delete(current.renders.keys().next().value);current.renders.set(sizeKey,html(current.model,size.width,size.height));}
    items.set(key,current);if(items.size>32)items.delete(items.keys().next().value);
    return {html:current.renders.get(sizeKey), ...(raw.style==='track'?{chartTrack:current.model}:{})};
  }
  const updateTrack=(node,out,S)=>out.chartTrack && X.update(node,out.chartTrack,S);
  const api = {updateTrack,STYLES,METRICS,clean,model,html,sample,sampleState,thin,content};
  if (typeof module !== 'undefined') module.exports = api; else root.ChartWidgets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
