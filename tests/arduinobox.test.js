const B = require('../renderer/arduinobox.js');
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const bytes = s => Array.from(s, c => c.charCodeAt(0));
// a rig: a link on a fake PC clock; tick(ms) is a box tick, letter(c) a letter, ext(text) a bracketed event
function rig(jitter) {
  let pc = 1000, h = 0, arrival = 1000; const out = [], link = B.createLink({ now: () => arrival }); link.on(e => out.push(e));
  const tick = ms => { h += ms; pc = 1000 + h; arrival = pc + (jitter ? Math.floor(Math.random() * jitter) : 0); link.feed(bytes(String(ms) + '\n\r')); };
  const letter = c => { arrival = pc; return link.feed(bytes(c)); }, ext = t => { arrival = pc; return link.feed(bytes('[' + t + ']')); };
  return { link, out, tick, letter, ext, H: () => h };
}
{ // the parser
  const p = B.parser(), m = p.feed(bytes('157\n\rA[P2+]200\n\rW[T1 48]AA[V 1.0.0 nano 8]'));
  ok('ticks, letters, W and bracketed events come out whole', m.map(x => x.type).join() === 'tick,lane,ext,tick,call,ext,lane,lane,ext');
  ok('a bracketed event keeps its text and raw bytes', m[2].text === 'P2+' && String.fromCharCode(...m[2].raw) === '[P2+]');
  const q = B.parser(), parts = q.feed(bytes('20')).concat(q.feed(bytes('0\n')), q.feed(bytes('\r[T3 1')), q.feed(bytes('23]B')));
  ok('pieces across feeds are put together (a tick and an event split anywhere)', parts.map(x => x.type).join() === 'tick,ext,lane' && parts[0].ms === 200 && parts[1].text === 'T3 123');
  ok('digits inside brackets do not disturb the ticks', (() => { const r = B.parser(); const o = r.feed(bytes('[Z0 512]200\n\r')); return o[1].type === 'tick' && o[1].ms === 200; })());
  ok('parseExt reads tag, number, sign and arguments', JSON.stringify(B.parseExt('P2+')) === '{"tag":"P","n":2,"sign":"+","args":[]}' && B.parseExt('T1 48').args[0] === '48' && B.parseExt('V 1.0.0 nano 8').n === null && B.parseExt('S-').sign === '-');
  ok('describeExt is readable', /pit sensor 2 covered/.test(B.describeExt('P2+')) && /lane 1 covered for 48 ms/.test(B.describeExt('T1 48')) && /SAFE STATE/.test(B.describeExt('S+')));
}
{ // commands
  const s = b => String.fromCharCode(...b);
  ok('commands are lines', s(B.C.version()) === 'V\n' && s(B.C.keepalive()) === '!\n' && s(B.C.lights('G')) === 'LG\n' && s(B.C.beep(9)) === 'B3\n' && s(B.C.mainPower(true)) === 'M1\n');
  ok('lane commands are 1-based on the wire', s(B.C.lanePower(0, false)) === 'Q10\n' && s(B.C.lanePixel(2, '#ff8800')) === 'N3 ff8800\n');
  ok('pin role: L1 / P2 / K / N with the kind', s(B.C.pinRole(0, 'L', 1, 0)) === 'P0 L1 0\n' && s(B.C.pinRole(4, 'P', 2, 1)) === 'P4 P2 1\n' && s(B.C.pinRole(7, 'K', 0, 0)) === 'P7 K 0\n' && s(B.C.pinRole(5, 'N', 0, 0)) === 'P5 N 0\n');
  ok('thresholds, options, save, list, readings, back to Trackmate mode', s(B.C.thresholds(1, 700, 500)) === 'H1 700 500\n' && s(B.C.option('blackout', 300)) === 'O blackout 300\n' && s(B.C.save()) === 'W\n' && s(B.C.list()) === '?\n' && s(B.C.readings(true)) === 'Z1\n' && s(B.C.trackmateMode()) === 'G\n');
}
{ // the link: laps as the Trackmate does them, then the extras
  const r = rig(0);
  for (let i = 0; i < 5; i++) r.tick(200);
  r.tick(157); r.letter('A'); const h1 = r.H(); r.tick(43); r.letter('A'); r.tick(200); r.letter('A'); r.tick(200);
  ok('a car over the sensor (repeated A) is one crossing', r.out.filter(e => e.type === 'hit').length === 1 && r.out[0].lane === 0);
  for (let i = 0; i < 12; i++) r.tick(200);
  r.tick(121); r.letter('A'); const h2 = r.H(); const hits = r.out.filter(e => e.type === 'hit');
  ok('the next pass is a new crossing and the time between them is the box clock', hits.length === 2 && hits[1].at - hits[0].at === h2 - h1);
  r.letter('W'); ok('W is a call', r.out[r.out.length - 1].type === 'call');
  r.ext('V 1.0.0 nano 8'); ok('V puts the link in SlotForge mode with the version', r.link.slotforge && r.link.version.board === 'nano' && r.out[r.out.length - 1].type === 'version');
  r.tick(200); r.ext('P2+'); r.ext('P2+'); r.ext('P2-');
  const pits = r.out.filter(e => e.type === 'pit'); ok('pit sensor 2 in (once) and out, 0-based', pits.length === 2 && pits[0].pit === 1 && pits[0].in && !pits[1].in);
  r.ext('K3'); ok('a call button of lane 3 (0-based 2)', r.out[r.out.length - 1].type === 'button' && r.out[r.out.length - 1].lane === 2);
  r.ext('T1 48'); ok('the speed trap: lane 1 covered 48 ms', r.out[r.out.length - 1].type === 'trap' && r.out[r.out.length - 1].ms === 48 && r.out[r.out.length - 1].lane === 0);
  r.ext('Z0 512'); ok('a reading is kept and reported', r.link.readings[0] === 512 && r.out[r.out.length - 1].type === 'reading');
  r.ext('C0 980 833 588'); ok('a calibration result sets the pin thresholds', r.link.pins[0].arm === 833 && r.link.pins[0].trig === 588 && r.out[r.out.length - 1].type === 'calibrated');
  r.ext('O pin 4 2 1 0 700 500'); ok('a pin setting from the box: A4 = pit sensor 1, light', r.link.pins[4].role === 'P' && r.link.pins[4].index === 1 && r.link.pins[4].kind === 0);
  r.ext('O lights 1 8 64 0'); ok('an option from the box', r.link.options.lights.join() === '1,8,64,0');
  r.ext('S+'); ok('the safe state is reported', r.link.safe && r.out[r.out.length - 1].type === 'safe' && r.out[r.out.length - 1].on);
  const before = r.out.filter(e => e.type === 'hit').length; r.ext('S-'); r.ext('B2 4000'); r.ext('B2 10000');
  const bh = r.out.filter(e => e.type === 'hit').slice(before);
  ok('buffered laps come back as hits on their box time', bh.length === 2 && bh.every(h => h.buffered && h.lane === 1) && bh[1].at - bh[0].at === 6000);
  r.ext('E hello'); ok('a message', r.out[r.out.length - 1].type === 'message' && r.out[r.out.length - 1].text === 'hello');
  r.ext('!'); ok('the answer to a keep-alive is an ack with its time', r.out[r.out.length - 1].type === 'ack' && r.link.lastAck > 0);
}
{ // the lane map and the sender
  const r = rig(0); r.link.setMap([3, 2, 1, 0, 4, 5, 6, 7]); r.tick(200); r.letter('A');
  ok('with a map, letter A counts for lane 4', r.out[0].type === 'hit' && r.out[0].lane === 3);
  r.ext('K1'); ok('and the call button of letter 1 too', r.out[r.out.length - 1].lane === 3);
  const sent = []; r.link.setSender(b => sent.push(String.fromCharCode(...b)));
  r.link.send(B.C.keepalive()); ok('nothing is sent while not connected', sent.length === 0);
  r.link.setConnected(true); r.link.send(B.C.keepalive()); ok('send() goes through the installed sender when connected', sent.join() === '!\n');
  const st = []; r.link.onStatus(on => st.push(on)); r.link.setConnected(false); r.link.setConnected(false);
  ok('disconnecting resets and reports once', st.join() === 'false' && !r.link.slotforge && r.link.version === null);
}
{ // USB jitter does not reach the lap times
  const r = rig(15); for (let i = 0; i < 30; i++) r.tick(200);
  r.tick(100); r.letter('A'); const a = r.H(); for (let i = 0; i < 25; i++) r.tick(200); r.tick(60); r.letter('A'); const b = r.H();
  const hits = r.out.filter(e => e.type === 'hit'); ok('with up to 15 ms of USB delay the lap time is within 15 ms', hits.length === 2 && Math.abs((hits[1].at - hits[0].at) - (b - a)) <= 15);
}
{ // buffered laps: 1.0.5 sends "ms ago" (right on a board whose clock did not start at the connection); a 1.0.4 box still sends the absolute box time, and the link knows from the version
  const feed = (ver, bValue) => { let pc = 10000; const L = B.createLink({ now: () => pc }); const hits = []; L.on(e => { if (e.type === 'hit') hits.push(e); }); L.setConnected(true);
    const say = (t, text) => { pc = t; L.feed(Array.from(text, ch => ch.charCodeAt(0))); };
    say(10000, `[V ${ver} nano 8]`); say(10200, '200\n\r'); say(10400, '200\n\r'); say(10600, '200\n\r'); say(10800, `200\n\r[S-]200\n\r[B1 ${bValue}]`); return hits[0]; };
  const h5 = feed('1.0.5', 300); ok('1.0.5: [B1 300] after ticks adding up to 1000 ms is a lap 300 ms before that tick (box ms 700)', h5 && h5.buffered && Math.abs(h5.at - (10800 - 300)) <= 2, h5 && h5.at);
  const h4 = feed('1.0.4', 700); ok('1.0.4: [B1 700] is the absolute box time 700 (the same lap), as before', h4 && h4.buffered && Math.abs(h4.at - (10800 - 300)) <= 2, h4 && h4.at);
}
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
