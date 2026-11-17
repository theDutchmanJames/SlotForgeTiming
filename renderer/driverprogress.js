// Driver progress on the card of a driver (2.3.0): per track, a line of the best and the average lap per month, the table of the months,
// and in words how much faster and steadier the driver got. The figures come from the main process (driver-progress.js). Pure: it only builds HTML.
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const secs = ms => (Number.isFinite(ms) ? (ms / 1000).toFixed(3) : '–');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthText = m => {
    const [y, mo] = String(m).split('-');
    return MONTHS[Number(mo) - 1] ? MONTHS[Number(mo) - 1] + ' ' + y : m;
  };
  // in words: "Since Mar 2026: the best lap is 0.312 s faster, the average 0.540 s; 3.1 points steadier."
  function changeText(t) {
    const c = t.change;
    if (!c) return 'One month so far: the trend shows from the second month on.';
    const by = (ms, what) =>
      Math.abs(ms) < 1 ? `${what} is the same` : `${what} is ${secs(Math.abs(ms))} s ${ms > 0 ? 'faster' : 'slower'}`;
    const steady =
      c.consistency === null || c.consistency === 0
        ? ''
        : `; ${Math.abs(c.consistency)} points ${c.consistency > 0 ? 'steadier' : 'less steady'}`;
    return `Since ${monthText(t.months[0].month)}: ${by(c.best, 'the best lap')}, ${by(c.avg, 'the average')}${steady}.`;
  }
  // a small line chart of the best (solid) and the average (dashed) lap per month; faster is higher
  function chart(months) {
    if (months.length < 2) return '';
    const W = 320,
      Hh = 90,
      P = 8,
      vals = months.flatMap(m => [m.best, m.avg]),
      lo = Math.min(...vals),
      hi = Math.max(...vals),
      span = hi - lo || 1;
    const x = i => P + (i * (W - 2 * P)) / (months.length - 1),
      y = v => P + ((v - lo) / span) * (Hh - 2 * P); // (a smaller time is higher up: y grows downwards)
    const line = key => months.map((m, i) => `${x(i).toFixed(1)},${y(m[key]).toFixed(1)}`).join(' ');
    return `<svg class="dp-chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Best and average lap per month, faster is higher"><polyline points="${line('avg')}" class="dp-avg"/><polyline points="${line('best')}" class="dp-best"/>${months.map((m, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(m.best).toFixed(1)}" r="2.5" class="dp-dot"><title>${esc(monthText(m.month))}: best ${secs(m.best)} s</title></circle>`).join('')}</svg>`;
  }
  function html(d) {
    if (!d || !d.tracks || !d.tracks.length)
      return '<p class="muted">No laps yet: the progress shows after the first race on this computer.</p>';
    return (
      `<p class="muted">${d.laps} clean laps in ${d.sessions} session${d.sessions === 1 ? '' : 's'}. Average and consistency count the laps that are no slower than 130% of the month's best, so a crash does not count as pace. Consistency: 100% = every lap exactly the same.</p>` +
      d.tracks
        .map(
          t => `<div class="dp-track"><h5>${esc(t.name || '(deleted track)')} <span class="muted">· best ${secs(t.best)} s · ${t.laps} laps</span></h5>
        <p class="dp-change">${esc(changeText(t))}</p>${chart(t.months)}
        <table class="fields dp-table"><thead><tr><th>Month</th><th>Laps</th><th>Best</th><th>Average</th><th>Consistency</th></tr></thead><tbody>${t.months
          .slice()
          .reverse()
          .map(
            m =>
              `<tr><td>${esc(monthText(m.month))}</td><td>${m.laps}</td><td>${secs(m.best)}</td><td>${secs(m.avg)}</td><td>${m.consistency === null ? '–' : m.consistency + '%'}</td></tr>`
          )
          .join('')}</tbody></table></div>`
        )
        .join('')
    );
  }
  const api = { html, changeText, chart, monthText };
  root.DriverProgress = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
