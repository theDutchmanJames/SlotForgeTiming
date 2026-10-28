// 1.7.0: the Heat List: every heat (and final) with its drivers by lane, who won it and what it gave; the line-up text, the short form that is sent to the
// other screens, the printable sheet, the widget and the line-up call of the announcer.
const E = require('../renderer/engine.js'), H = require('../renderer/heats.js'), R = require('../renderer/report.js'), Wd = require('../renderer/widgets.js');
const Ann = require('../renderer/announcer.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const people = n => Array.from({ length: n }, (_, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam', 'Kim', 'Lee', 'Max'][i] || 'D' + i, nickname: 'N' + i, callsign: 'C' + i }));
const fake = rows => ({ standings: () => rows.map((r, i) => ({ pos: i + 1, car: { participant: r.p, laps: Array(r.laps).fill(0), total: r.time ?? null, best: r.best ?? null, fin: !!r.fin, time: r.time ?? null, estimate: null } })), finishedLaps: c => c.fin, timeOf: c => c.time, estimateOf: c => c.estimate });
const sched3 = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }, { p: 1, lane: 2 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }, { p: 0, lane: 2 }]];
const make = (cfg = {}, sched = sched3, n = 3) => E.createHeatRace({ participants: people(n), schedule: sched, resultBy: 'points', points: [10, 8, 6], lanes: 3, ...cfg });
const P = people(3);

// ---- the list ----
{ const h = make(), l = H.listOf(h, P, {});
  ok('one entry per heat, numbered, with the name of the heat', l.length === 3 && l.map(x => x.n).join() === '1,2,3' && l.map(x => x.name).join() === 'Heat 1,Heat 2,Heat 3' && l.every(x => x.final === ''));
  ok('before the start the first heat is next and the others come later', l.map(x => x.state).join() === 'next,later,later');
  ok('...and while it is racing the first heat is current', H.listOf(h, P, { live: true }).map(x => x.state).join() === 'current,later,later');
  ok('the drivers of a heat are listed by lane, with their names', l[1].drivers.map(d => d.lane + ':' + d.name).join() === '0:Kim,1:Alex,2:Sam' && l[1].drivers.map(d => d.p).join() === '2,0,1');
  ok('a heat that is not raced has no rows and no winner', l.every(x => x.rows.length === 0 && x.winner === null));
  const swapped = H.listOf(make({}, [[{ p: 1, lane: 2 }, { p: 0, lane: 0 }]], 2), P, {});
  ok('the lanes are put in order, whatever the order of the plan', swapped[0].drivers.map(d => d.lane).join() === '0,2' && swapped[0].drivers.map(d => d.name).join() === 'Alex,Sam');
  h.record(fake([{ p: 1, laps: 5, best: 9000 }, { p: 0, laps: 5, best: 9500 }, { p: 2, laps: 4, best: 9900 }]));
  const l2 = H.listOf(h, P, {});
  ok('after a heat it is done, the next heat is next', l2.map(x => x.state).join() === 'done,next,later' && H.listOf(h, P, { live: true }).map(x => x.state).join() === 'done,current,later');
  ok('the winner of a finished heat is the driver in first place, with the name', l2[0].winner && l2[0].winner.p === 1 && l2[0].winner.name === 'Sam' && l2[1].winner === null);
  ok('the rows are in the order of the places, with the name, the lane they raced in, the laps and the points', l2[0].rows.map(r => r.pos + r.name + r.lane + ':' + r.laps + ':' + r.points).join() === '1Sam1:5:10,2Alex0:5:8,3Kim2:4:6');
  h.record(fake([{ p: 0, laps: 5 }, { p: 2, laps: 5 }, { p: 1, laps: 3 }])); h.record(fake([{ p: 2, laps: 5 }, { p: 1, laps: 5 }, { p: 0, laps: 2 }]));
  const l3 = H.listOf(h, P, { live: true });
  ok('when every heat is raced all are done, also when the race is still marked as racing', l3.every(x => x.state === 'done') && l3.map(x => x.winner.name).join() === 'Sam,Alex,Kim');
  ok('the labels of a rotation setup go with their heat', H.listOf(make(), P, { labels: ['A', '', 'C'] }).map(x => x.label).join() === 'A,,C' && l[0].label === '');
  ok('a participant without a name is listed with an empty name (no crash)', H.listOf(make(), [{ driverName: 'Alex' }], {})[0].drivers.map(d => d.name).join() === 'Alex,,');
}

// ---- finals ----
{ const h = make({ finals: 'a', finalA: true }, [sched3[0], sched3[1]]);
  const fin = E.finalsOf({ finals: 'a' });
  const hf = E.createHeatRace({ participants: people(3), schedule: [sched3[0], sched3[1]], resultBy: 'points', points: [10, 8, 6], lanes: 3, ...fin });
  const l = H.listOf(hf, P, {});
  ok('finals come after the heats; before the heats are raced a final has no drivers yet', hf.total === 3 && l.length === 3 && l[2].final === 'A' && l[2].name === 'Final A' && l[2].drivers.length === 0 && l[0].final === '');
  {
    hf.record(fake([{ p: 0, laps: 5 }, { p: 1, laps: 4 }, { p: 2, laps: 3 }])); hf.record(fake([{ p: 0, laps: 5 }, { p: 1, laps: 4 }, { p: 2, laps: 3 }]));
    const l2 = H.listOf(hf, P, {}), f = l2[l2.length - 1];
    ok('once the heats are raced the final lists its drivers, best first, without lanes until they have chosen', f.final === 'A' && f.state === 'next' && f.drivers.length === 3 && f.drivers.every(d => d.lane === null) && f.drivers[0].name === 'Alex');
    hf.pick(2); hf.pick(0);
    const f2 = H.listOf(hf, P, {}).pop();
    ok('...after the choices the drivers are in lane order, with their lanes (the last driver gets the last lane)', f2.drivers.map(d => d.name + d.lane).join() === 'Sam0,Kim1,Alex2');
    ok('a label is only for a heat, never for a final', H.listOf(hf, P, { labels: ['x', 'y', 'z'] }).pop().label === '');
  }
}

// ---- the text of a line-up ----
{ const l = H.listOf(make(), P, {});
  ok('the line-up names every driver with the lane', H.lineupText(l[0]) === 'Alex in lane 1, Sam in lane 2 and Kim in lane 3');
  ok('two drivers are joined with "and", one driver stands alone', H.lineupText({ drivers: [{ lane: 0, name: 'A' }, { lane: 1, name: 'B' }] }) === 'A in lane 1 and B in lane 2' && H.lineupText({ drivers: [{ lane: 3, name: 'A' }] }) === 'A in lane 4');
  ok('a driver without a lane is named alone, nobody gives an empty text', H.lineupText({ drivers: [{ lane: null, name: 'A' }, { lane: -1, name: 'B' }] }) === 'A and B' && H.lineupText({ drivers: [] }) === '' && H.lineupText(null) === '' && H.lineupText({}) === '');
  ok('the way a driver is named can be chosen', H.lineupText(l[0], d => d.name.toUpperCase()) === 'ALEX in lane 1, SAM in lane 2 and KIM in lane 3');
  ok('andList: none, one, two, three', H.andList([]) === '' && H.andList(['a']) === 'a' && H.andList(['a', 'b']) === 'a and b' && H.andList(['a', 'b', 'c']) === 'a, b and c');
}

// ---- the figures of a result ----
{ const row = { points: 10, tm: 125341, fin: true, laps: 5 };
  ok('points: one point, more points', H.rowFigure({ points: 1 }, { points: true }) === '1 point' && H.rowFigure({ points: 0 }, { points: true }) === '0 points' && H.rowFigure(row, { points: true }) === '10 points');
  ok('time: the finish time; an estimate says so; no time and not finished says so', H.rowFigure(row, { time: true }) === '2:05.341' && H.rowFigure({ tm: 90000, fin: false }, { time: true }) === '1:30.000 (estimated)' && H.rowFigure({ tm: null, fin: false }, { time: true }) === 'not finished' && H.rowFigure({ laps: 3 }, { time: true }) === '');
  ok('both are joined; nothing asked gives nothing', H.rowFigure(row, { points: true, time: true }) === '10 points, 2:05.341' && H.rowFigure(row, {}) === '' && H.rowFigure(row) === '');
}

// ---- a plan that is not raced yet ----
{ const l = H.planList([[{ p: 1, lane: 1 }, { p: 0, lane: 0 }], [{ p: 2, lane: 0 }]], ['Ann', 'Bob', 'Cy'], ['first']);
  ok('the plan of the Home tab gives the same list: names, lanes, labels, every heat next or later', l.length === 2 && l[0].drivers.map(d => d.name + d.lane).join() === 'Ann0,Bob1' && l[1].drivers.map(d => d.name).join() === 'Cy' && l[0].label === 'first' && l[1].label === '' && l.map(x => x.state).join() === 'next,later' && l.every(x => x.rows.length === 0));
  ok('...without names or labels it still works', H.planList([[{ p: 0, lane: 0 }]]).length === 1 && H.planList([[{ p: 0, lane: 0 }]])[0].drivers[0].name === '');
}

// ---- the short form for the other screens ----
{ const h = make({ resultBy: 'time', heatBy: 'laps' }); h.record(fake([{ p: 1, laps: 5, fin: true, time: 50000 }, { p: 0, laps: 4, fin: false, time: null }, { p: 2, laps: 5, fin: true, time: 52000 }]));
  const lite = H.listLite(H.listOf(h, P, { labels: ['x'] }));
  ok('the short form has the name, the label (when there is one), the drivers with their lanes and the rows with the figures', lite.length === 3 && lite[0].name === 'Heat 1' && lite[0].label === 'x' && lite[1].label === undefined && lite[0].drivers[1].lane === 1 && lite[0].rows[0].name === 'Sam' && lite[0].rows[0].tm === 50000 && lite[0].rows[0].fin === 1 && lite[0].rows[1].fin === 0 && lite[0].rows[1].tm === undefined);
  ok('...a lane that is not known yet is sent as -1, and nothing is sent that a screen does not show', H.listLite([{ name: 'Final A', label: '', drivers: [{ lane: null, name: 'A', p: 0 }], rows: [] }])[0].drivers[0].lane === -1 && !('state' in lite[0]) && !('winner' in lite[0]) && !('best' in lite[0].rows[0]));
  ok('...it is plain data that survives being sent as text', JSON.stringify(JSON.parse(JSON.stringify(lite))) === JSON.stringify(lite));
  const hp = make(); hp.record(fake([{ p: 2, laps: 5 }, { p: 0, laps: 4 }, { p: 1, laps: 4 }]));
  const lp = H.listLite(H.listOf(hp, P, {}));
  ok('a heat result by points keeps the points and the laps; one without a time keeps no time and no finish', lp[0].rows.map(r => r.pos + r.name + ':' + r.points + ':' + r.laps).join() === '1Kim:10:5,2Alex:8:4,3Sam:6:4' && lp[0].rows.every(r => !('tm' in r) && !('fin' in r)) && lp[1].rows.length === 0);
  ok('a list of a heat race that only has its schedule still has every heat', H.listOf({ schedule: sched3, results: [], idx: 0 }, P, {}).length === 3 && H.listOf({ schedule: sched3, results: [], idx: 0, count: 3 }, P, {}).length === 3);
}

// ---- the sheet ----
{ const l = H.planList(sched3, ['Alex', 'Sam', 'Kim'], ['A', '', '']);
  const html = R.heatSheetHtml({ title: 'Club <night>', subtitle: 'Living room · 3 heats', list: l, lanes: 3 });
  ok('the sheet has the title and subtitle (made safe), a column for every lane and a place for the winner', html.includes('<h1>Club &lt;night&gt;</h1>') && html.includes('Living room · 3 heats') && html.includes('<th>Lane 1</th><th>Lane 2</th><th>Lane 3</th>') && !html.includes('<th>Lane 4</th>') && html.includes('<th>Winner</th>') && !html.includes('<th>Result</th>'));
  ok('...a row per heat with the driver of every lane in the lane column, and the label under the name of the heat', (html.match(/<tr><td class="h">/g) || []).length === 3 && html.includes('<td class="h">Heat 1<br>') && html.includes('A</span>') && html.includes('<td>Alex</td><td>Sam</td><td>Kim</td>') && html.includes('<td>Kim</td><td>Alex</td><td>Sam</td>'));
  ok('...it is a page for the printer: landscape A4, a heat is not cut in two', html.includes('A4 landscape') && html.includes('page-break-inside: avoid'));
  const h = make(); h.record(fake([{ p: 1, laps: 5 }, { p: 0, laps: 5 }, { p: 2, laps: 4 }]));
  const done = R.heatSheetHtml({ title: 'T', list: H.listOf(h, P, {}), lanes: 3, points: true });
  ok('a sheet of a heat that is raced shows the result in the last column, with the points', done.includes('<th>Result</th>') && done.includes('1. Sam (10 points), 2. Alex (8 points), 3. Kim (6 points)'));
  ok('...without the points the places only', R.heatSheetHtml({ title: 'T', list: H.listOf(h, P, {}), lanes: 3 }).includes('1. Sam, 2. Alex, 3. Kim'));
  const fl = R.heatSheetHtml({ title: 'T', list: [{ n: 1, name: 'Final A', label: '', drivers: [{ lane: null, name: 'Alex' }, { lane: null, name: 'Sam' }], rows: [] }], lanes: 2 });
  ok('a final whose lanes are not chosen lists its drivers in one cell', fl.includes('colspan="2">Alex and Sam (lanes are chosen before the final)'));
  ok('the number of lanes follows the plan when it is not given', R.heatSheetHtml({ title: 'T', list: l }).includes('<th>Lane 3</th>') && !R.heatSheetHtml({ title: 'T', list: l }).includes('<th>Lane 4</th>'));
  ok('a heat with one driver in the first lane is a heat, not a final waiting for its lanes', R.heatSheetHtml({ title: 'T', list: H.planList([[{ p: 0, lane: 0 }]], ['Alex']), lanes: 2 }).includes('<td>Alex</td><td>&ndash;</td>') && !R.heatSheetHtml({ title: 'T', list: H.planList([[{ p: 0, lane: 0 }]], ['Alex']), lanes: 2 }).includes('colspan'));
  ok('an empty place is a dash', R.heatSheetHtml({ title: 'T', list: H.planList([[{ p: 0, lane: 1 }]], ['Alex']), lanes: 2 }).includes('<td>&ndash;</td><td>Alex</td>'));
}

// ---- the widget ----
{ const heat = { idx: 1, by: 'points', list: [
    { name: 'Heat 1', drivers: [{ lane: 0, name: 'Alex' }, { lane: 1, name: 'Sam' }], rows: [{ pos: 1, name: 'Sam', points: 10, laps: 5 }, { pos: 2, name: 'Alex', points: 8, laps: 5 }] },
    { name: 'Heat 2', drivers: [{ lane: 0, name: 'Sam' }, { lane: 1, name: 'Alex' }], rows: [] },
    { name: 'Heat 3', drivers: [{ lane: 0, name: 'Alex' }, { lane: 1, name: 'Sam' }], rows: [] },
    { name: 'Heat 4', drivers: [{ lane: -1, name: 'Kim' }], rows: [] }] };
  const html = Wd.heatListHtml(heat, 'between', {});
  ok('the widget lists every heat with its drivers, lane numbers in front, and the winner with a star and the points', (html.match(/<tr /g) || []).length === 4 && html.includes('<td class="hlw-d">1: Alex · 2: Sam</td>') && html.includes('<td class="hlw-win">★ Sam 10</td>'));
  ok('the heat that waits for Start is next, the finished heat is done, the others come later', html.includes('class="hlw-done"') && html.includes('class="hlw-next"') && (html.match(/class="hlw-later"/g) || []).length === 2 && !html.includes('hlw-current'));
  ok('while a heat is racing it is current', Wd.heatListHtml(heat, 'running', {}).includes('class="hlw-current"') && Wd.heatListHtml(heat, 'paused', {}).includes('hlw-current') && Wd.heatListHtml(heat, 'review', {}).includes('hlw-current') && Wd.heatListHtml(heat, 'countdown', {}).includes('hlw-current') && !Wd.heatListHtml(heat, 'ready', {}).includes('hlw-current'));
  ok('a driver without a lane has no number in front', html.includes('<td class="hlw-d">Kim</td>'));
  ok('the lane numbers can be turned off', Wd.heatListHtml(heat, 'ready', { lanes: false }).includes('<td class="hlw-d">Alex · Sam</td>'));
  ok('every place, with the points', Wd.heatListHtml(heat, 'ready', { detail: 'all' }).includes('1 Sam 10 · 2 Alex 8') && Wd.heatListHtml(heat, 'ready', { detail: 'all', figures: false }).includes('1 Sam · 2 Alex'));
  ok('no result at all', !Wd.heatListHtml(heat, 'ready', { detail: 'none' }).includes('★') && Wd.heatListHtml(heat, 'ready', { figures: false }).includes('★ Sam<'));
  ok('from the heat that is racing on', (Wd.heatListHtml(heat, 'ready', { show: 'upcoming' }).match(/<tr /g) || []).length === 3 && !Wd.heatListHtml(heat, 'ready', { show: 'upcoming' }).includes('Heat 1<'));
  ok('the heat that is racing and the two after it', (Wd.heatListHtml(heat, 'ready', { show: 'near' }).match(/<tr /g) || []).length === 3 && Wd.heatListHtml(heat, 'ready', { show: 'near' }).includes('Heat 2<') && Wd.heatListHtml(heat, 'ready', { show: 'near' }).includes('Heat 4<') && !Wd.heatListHtml(heat, 'ready', { show: 'near' }).includes('Heat 1<'));
  const six = { idx: 1, list: Array.from({ length: 6 }, (_, i) => ({ name: 'Heat ' + (i + 1), drivers: [{ lane: 0, name: 'Alex' }], rows: [] })) };
  ok('"the heat that is racing and the two after it" is three heats, "from the heat that is racing" is all that is left', (Wd.heatListHtml(six, 'ready', { show: 'near' }).match(/<tr /g) || []).length === 3 && (Wd.heatListHtml(six, 'ready', { show: 'upcoming' }).match(/<tr /g) || []).length === 5 && Wd.heatListHtml(six, 'ready', { show: 'near' }).includes('Heat 4<') && !Wd.heatListHtml(six, 'ready', { show: 'near' }).includes('Heat 5<') && Wd.heatListHtml(six, 'ready', { show: 'upcoming' }).includes('Heat 6<'));
  ok('a heat without a rows list does not break the widget', Wd.heatListHtml({ idx: 0, list: [{ name: 'Heat 1', drivers: [{ lane: 0, name: 'Alex' }] }] }, 'ready', { detail: 'all' }).includes('<td class="hlw-win"></td>'));
  const end = { ...heat, idx: 4 };
  ok('when all heats are raced the shortened lists show the last ones', Wd.heatListHtml(end, 'finished', { show: 'near' }).includes('Heat 4<') && Wd.heatListHtml(end, 'finished', { show: 'upcoming' }).includes('Heat 4<') && (Wd.heatListHtml(end, 'finished', { show: 'upcoming' }).match(/<tr /g) || []).length === 1 && Wd.heatListHtml(end, 'finished', {}).split('hlw-done').length === 5);
  ok('names are made safe', Wd.heatListHtml({ idx: 0, list: [{ name: 'H<1>', drivers: [{ lane: 0, name: '<b>x</b>' }], rows: [] }] }, 'ready', {}).includes('&lt;b&gt;x&lt;/b&gt;'));
  ok('a race that is no heat race, or a heat race without heats, shows a dash', Wd.heatListHtml(null, 'running', {}) === '–' && Wd.heatListHtml({ idx: 0, list: [] }, 'running', {}) === '–' && Wd.heatListHtml({ idx: 0 }, 'running', {}) === '–');
  const t = { idx: 1, by: 'time', list: [{ name: 'Heat 1', drivers: [{ lane: 0, name: 'Alex' }], rows: [{ pos: 1, name: 'Alex', points: 0, laps: 3, tm: 125341, fin: 1 }, { pos: 2, name: 'Sam', points: 0, laps: 2, tm: 140000, fin: 0 }, { pos: 3, name: 'Kim', points: 0, laps: 1, fin: 0 }] }, { name: 'Heat 2', drivers: [], rows: [] }] };
  ok('a result by time shows the finish time; an estimate is starred; a driver without a time has not finished', Wd.heatListHtml(t, 'ready', { detail: 'all' }).includes('1 Alex 2:05.341 · 2 Sam 2:20.000* · 3 Kim DNF'));
  ok('a result by laps shows the laps', Wd.heatListHtml({ idx: 1, list: [{ name: 'Heat 1', drivers: [], rows: [{ pos: 1, name: 'Alex', points: 0, laps: 5 }] }, { name: 'Heat 2', drivers: [], rows: [] }] }, 'ready', {}).includes('★ Alex 5'));
  ok('the widget is in the register, in the Race group, with its options', (d => d && d.group === 'Race' && d.options.length === 4 && !d.perLane && d.label === 'Heat List')(Wd.def('heatlist')));
  ok('its sample draws a list', Wd.def('heatlist').sample(0, {}).includes('class="hlw"') && Wd.def('heatlist').sample(0, { opt: { detail: 'all' } }).includes('1 James 10'));
}

// ---- the announcer ----
{ const call = Ann.CALLS.find(c => c.id === 'lineup');
  ok('there is a line-up call, off in a new set, that has the heat and the line-up as variables', call && call.defaultOn === false && call.vars.includes('lineup') && call.vars.includes('heat') && call.lines.every(l => l.includes('{lineup}')));
  const mk = (over = {}) => Ann.create({ trackName: 'Living room', ...over });
  const eng = E.createRace({ type: 'race', laps: 3, entries: [{ lane: 0, driverId: 'a', driverName: 'Alex' }, { lane: 1, driverId: 's', driverName: 'Sam' }] });
  const names = ev => ev.map(e => e.call).join();
  const grid = [{ lane: 0, name: 'Alex', nickname: 'Speedy', callsign: 'ALX' }, { lane: 1, name: 'Sam', nickname: '', callsign: '' }, { lane: 2, name: 'Kim', nickname: 'K', callsign: 'KIM' }];
  const a = mk(); a.observe(eng, { phase: 'ready', now: 0 });
  const ev = a.observe(eng, { phase: 'between', now: 0, heat: { idx: 1, count: 3 }, lineup: grid });
  ok('between two heats the next heat is announced and then the line-up', names(ev) === 'nextheat,lineup' && ev[1].vars.heat === 2 && ev[1].vars.heats === 3);
  ok('...the line-up names the drivers with their lanes', ev[1].vars.lineup === 'Alex in lane 1, Sam in lane 2 and Kim in lane 3');
  ok('...once, not again at the next look', names(a.observe(eng, { phase: 'between', now: 10, heat: { idx: 1, count: 3 }, lineup: grid })) === '');
  const b = mk({ driverBy: 'nickname' }); b.observe(eng, { phase: 'ready', now: 0 });
  ok('the audio set can name the drivers by nickname (a driver without one by name)', b.observe(eng, { phase: 'between', now: 0, heat: { idx: 1, count: 3 }, lineup: grid })[1].vars.lineup === 'Speedy in lane 1, Sam in lane 2 and K in lane 3');
  const c = mk({ driverBy: 'callsign' }); c.observe(eng, { phase: 'ready', now: 0 });
  ok('...or by callsign', c.observe(eng, { phase: 'between', now: 0, heat: { idx: 1, count: 3 }, lineup: grid })[1].vars.lineup === 'ALX in lane 1, Sam in lane 2 and KIM in lane 3');
  const d = mk(); d.observe(eng, { phase: 'ready', now: 0 });
  ok('before a final the line-up says "A and B" without lanes while they are not chosen, "Final A" is announced first', (e => names(e) === 'nextfinal,lineup' && e[1].vars.lineup === 'Alex and Sam' && e[1].vars.final === 'A' && e[1].vars.heat === '')(d.observe(eng, { phase: 'between', now: 0, heat: { idx: 3, count: 3, final: 'A' }, lineup: [{ lane: -1, name: 'Alex' }, { lane: -1, name: 'Sam' }] })));
  const h2 = mk(); h2.observe(eng, { phase: 'ready', now: 0 });
  ok('a heat is only announced when the race waits between heats: other changes of the phase say nothing about it', names(h2.observe(eng, { phase: 'countdown', now: 0, lights: 0, heat: { idx: 1, count: 3 }, lineup: grid })) === '' && names(h2.observe(eng, { phase: 'running', now: 0, heat: { idx: 1, count: 3 }, lineup: grid })) === 'lightsout');
  ok('...and a race that waits between but is no heat race says nothing', names(mk().observe(eng, { phase: 'between', now: 0, lineup: grid })) === '');
  const e = mk(); e.observe(eng, { phase: 'ready', now: 0 });
  ok('no drivers to read, no line-up (and no crash without the list)', names(e.observe(eng, { phase: 'between', now: 0, heat: { idx: 1, count: 3 }, lineup: [] })) === 'nextheat');
  const f = mk(); f.observe(eng, { phase: 'ready', now: 0 });
  ok('...also when the race screen sends none', names(f.observe(eng, { phase: 'between', now: 0, heat: { idx: 1, count: 3 } })) === 'nextheat');
  const g = mk(); g.observe(eng, { phase: 'ready', now: 0 });
  ok('a single driver is named alone', g.observe(eng, { phase: 'between', now: 0, heat: { idx: 1, count: 3 }, lineup: [{ lane: 1, name: 'Kim' }] })[1].vars.lineup === 'Kim in lane 2');
}

console.log(fails ? fails + ' HEAT LIST TESTS FAILED' : 'ALL HEAT LIST TESTS PASSED');
if (fails) process.exit(1);
