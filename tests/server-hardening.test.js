// Network access, hardened: password guessing is slow, only this computer's own names are answered, POSTs must be JSON from the same page,
// review commands are checked field by field (and every command loses fields it does not know), live updates refuse instead of evicting, tokens expire.
const http = require('http'), net = require('net'), path = require('path'), os = require('os');
const { createServer, localHost, cleanCommand } = require('../server.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const R = path.join(__dirname, '..'), wait = ms => new Promise(r => setTimeout(r, ms));
const make = extra => { const cmds = []; const srv = createServer({ root: path.join(R, 'renderer'), appRoot: R, schema: {}, getSettings: () => ({ netPassword: '1234' }), list: () => [], customFields: () => [], getLive: () => ({}), onCommand: c => cmds.push(c), failDelay: 0, ...extra }); return { srv, cmds }; };
const call = (port, url, data, headers = { 'Content-Type': 'application/json' }) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: url, method: 'POST', headers, agent: false }, res => { const parts = []; res.on('data', c => parts.push(c)); res.on('end', () => { let j = null; try { j = JSON.parse(Buffer.concat(parts).toString()); } catch { /* not json */ } resolve({ code: res.statusCode, json: j || {}, retry: res.headers['retry-after'] }); }); });
  req.on('error', reject); req.end(typeof data === 'string' ? data : JSON.stringify(data));
});

(async () => {
  // ---- 2. the Host guard ----
  const me = os.hostname().split('.')[0];
  ok('IP addresses, localhost and this computer\'s own name (alone, .local, .lan, .home.arpa) are answered', ['127.0.0.1:8787', '192.168.1.20', '[::1]:8787', '::1', 'fe80::1', 'localhost', 'LOCALHOST:80', me, me.toUpperCase() + ':8787', me + '.local', me + '.lan.', me + '.home.arpa:8787', ''].every(localHost));
  ok('...a public name that starts with this computer\'s name, other local-looking names and public TLDs are refused', !['evil.com', me + '.attacker.com', me + '.attacker.com:8787', me + '.box', 'racepc.fritz.box', 'other.local', 'other', me + 'x.local', 'a.' + me + '.local', '1.2.3', '[evil.com]:80', me + '.local.evil.com'].some(localHost));
  ok('...this computer\'s own name behind a home router (.fritz.box, .localdomain, .home, .internal) is answered, other names there are not', [me + '.fritz.box', me.toUpperCase() + '.FRITZ.BOX:8787', me + '.localdomain', me + '.home', me + '.internal'].every(localHost) && !['evil.fritz.box', 'x.' + me + '.fritz.box', 'fritz.box', 'other.localdomain'].some(localHost));

  // ---- 4. commands: review checked strictly, unknown fields stripped ----
  const rv = c => cleanCommand({ type: 'review', ...c });
  ok('known review corrections pass with only their own fields', JSON.stringify(rv({ op: 'dq', car: 2, sid: undefined, on: false, recalc: false, evil: 1 })) === '{"type":"review","op":"dq","car":2}'
    && JSON.stringify(rv({ op: 'invalid', car: 0, lap: 3, on: true, recalc: false })) === '{"type":"review","op":"invalid","car":0,"lap":3,"on":true}'
    && rv({ op: 'finalize' }) && rv({ op: 'addtime', car: 1, ms: 5000 }) && rv({ op: 'adjust', car: 1, ms: -3000 }) && rv({ op: 'adjust', car: 1, points: 1.5 }) && rv({ op: 'sector', car: 1, sector: null }) && rv({ op: 'sectormove', car: 1, dir: -1 }) && rv({ op: 'tkremove', sid: 4, lap: 0, recalc: true }) && rv({ op: 'forgive', car: 0, k: 1 }));
  ok('...unknown ops and prototype names are refused', [{ op: 'explode' }, { op: '__proto__' }, { op: 'constructor' }, { op: 'prototype' }, { op: 'toString', car: 0 }, { op: 'hasOwnProperty' }, {}, { op: 7 }].every(c => rv(c) === null));
  ok('...cars, laps and penalties must be whole numbers from 0', [{ op: 'dq', car: -1 }, { op: 'dq', car: 1.5 }, { op: 'dq', car: '1' }, { op: 'dq' }, { op: 'dq', car: 2 ** 60 }, { op: 'invalid', car: 0, lap: -1, on: true }, { op: 'forgive', car: 0, k: 'x' }, { op: 'tkinvalid', sid: null, lap: 0 }].every(c => rv(c) === null));
  ok('...time must be finite, above 0 and at most a day; other fields of the right kind', [{ op: 'addtime', car: 0, ms: 0 }, { op: 'addtime', car: 0, ms: -5 }, { op: 'addtime', car: 0, ms: 864e5 + 1 }, { op: 'addtime', car: 0, ms: Infinity }, { op: 'addtime', car: 0, ms: NaN }, { op: 'addtime', car: 0, ms: '5' },
    { op: 'adjust', car: 0 }, { op: 'adjust', car: 0, ms: 1e12 }, { op: 'adjust', car: 0, laps: 1e9 }, { op: 'sectormove', car: 0, dir: 2 }, { op: 'sector', car: 0, sector: 'x' }, { op: 'invalid', car: 0, lap: 0, on: 'yes' }].every(c => rv(c) === null));
  const polluted = JSON.parse('{"type":"start","__proto__":{"x":1},"constructor":1,"lane":3}');
  ok('every command loses the fields it does not have', JSON.stringify(cleanCommand(polluted)) === '{"type":"start"}' && JSON.stringify(cleanCommand({ type: 'penalty', lane: 1, n: 2, extra: 'x' })) === '{"type":"penalty","lane":1,"n":2}'
    && cleanCommand({ type: 'system', key: '__proto__', enabled: true }) === null && cleanCommand([]) === null && cleanCommand({ type: 'nope' }) === null && Object.getPrototypeOf(cleanCommand(polluted)) === Object.prototype);

  // ---- 1. password guessing ----
  {
    const { srv } = make({ failDelay: 100, lockMs: 400, lockMaxMs: 400 }), port = await srv.listen(0, '127.0.0.1');
    let t = Date.now(); const five = await Promise.all([...Array(5)].map((_, i) => call(port, '/api/auth', { password: String(i) })));
    ok('wrong passwords sent together are tried one at a time', five.every(r => r.code === 401) && Date.now() - t >= 480);
    let r = await call(port, '/api/auth', { password: '1234' });
    ok('...after five wrong ones this device must wait, even with the right password', r.code === 429 && Number(r.retry) >= 1 && /Try again/.test(r.json.error));
    await wait(450); r = await call(port, '/api/auth', { password: '1234' });
    ok('...and the right password works once the wait is over', r.code === 200 && typeof r.json.token === 'string');
    t = Date.now(); const burst = await Promise.all([...Array(40)].map((_, i) => call(port, '/api/auth', { password: 'g' + i })));
    ok('a burst of 40 guesses gets only 5 tries: the rest wait or are turned away', burst.filter(x => x.code === 401).length === 5 && burst.filter(x => x.code === 429).length === 35 && !burst.some(x => x.code === 200));
    await srv.close();
    // the lockout grows: 2 s, 4 s ... (capped)
    const s2 = make({ lockMs: 50, lockMaxMs: 10000 }), p2 = await s2.srv.listen(0, '127.0.0.1');
    for (let i = 0; i < 5; i++) await call(p2, '/api/auth', { password: 'x' });
    await wait(80); await call(p2, '/api/auth', { password: 'x' }); r = await call(p2, '/api/auth', { password: '1234' });
    ok('...and the wait doubles with every further wrong password', r.code === 429);
    await wait(150); r = await call(p2, '/api/auth', { password: '1234' }); ok('...a right password after it resets the count', r.code === 200);
    for (let i = 0; i < 4; i++) await call(p2, '/api/auth', { password: 'x' });
    r = await call(p2, '/api/auth', { password: '1234' }); ok('...so four new mistakes do not lock again', r.code === 200);
    await s2.srv.close();
  }

  // ---- 3. JSON only, from the same page ----
  {
    const { srv, cmds } = make(), port = await srv.listen(0, '127.0.0.1');
    let r = await call(port, '/api/auth', JSON.stringify({ password: '1234' }), { 'Content-Type': 'text/plain' });
    ok('a login sent as text/plain (a cross-site form or fetch without a preflight) is refused', r.code === 415 && !r.json.token);
    r = await call(port, '/api/auth', JSON.stringify({ password: '1234' }), {}); ok('...and so is one without a Content-Type', r.code === 415);
    const token = (await call(port, '/api/auth', { password: '1234' })).json.token;
    r = await call(port, '/api/command', JSON.stringify({ token, cmd: { type: 'stop' } }), { 'Content-Type': 'text/plain;charset=UTF-8' }); ok('...a command too', r.code === 415 && cmds.length === 0);
    r = await call(port, '/api/command', { token, cmd: { type: 'stop' } }, { 'Content-Type': 'application/json', Origin: 'http://evil.example.com' }); ok('a command from a page of another site is refused', r.code === 403 && cmds.length === 0);
    r = await call(port, '/api/auth', { password: '1234' }, { 'Content-Type': 'application/json', Origin: 'null' }); ok('...as is a login from a sandboxed page', r.code === 403);
    r = await call(port, '/api/command', { token, cmd: { type: 'stop' } }, { 'Content-Type': 'application/json; charset=utf-8', Origin: `http://127.0.0.1:${port}` }); ok('...but one from the page itself goes through', r.code === 200 && cmds.length === 1);
    r = await call(port, '/api/command', { token, cmd: { type: 'review', op: 'removelap', car: 1, lap: 2, recalc: true, on: false, __x: 1 } });
    ok('a review correction reaches the race with only its own fields', r.code === 200 && JSON.stringify(cmds[1]) === '{"type":"review","op":"removelap","car":1,"lap":2,"recalc":true}');
    r = await call(port, '/api/command', { token, cmd: { type: 'review', op: 'addtime', car: 0, ms: 1e15 } }); ok('...and a wrong one is refused', r.code === 400 && cmds.length === 2);
    r = await call(port, '/api/command', '{"token":"' + token + '","cmd":{"type":"review","op":"__proto__","car":0}}'); ok('...also a prototype name', r.code === 400 && cmds.length === 2);
    // the Host guard over a real connection
    const raw = text => new Promise(resolve => { const s = net.connect(port, '127.0.0.1', () => s.write(text)); const parts = []; s.on('data', d => parts.push(d)); s.on('end', () => resolve(Buffer.concat(parts).toString())); s.on('error', () => resolve(Buffer.concat(parts).toString())); });
    r = await raw(`GET /api/live HTTP/1.1\r\nHost: ${me}.attacker.com:${port}\r\nConnection: close\r\n\r\n`); ok('a page reached by a public name that starts with this computer\'s name is refused', r.startsWith('HTTP/1.1 421'));
    r = await raw(`GET /api/live HTTP/1.1\r\nHost: ${me}.local:${port}\r\nConnection: close\r\n\r\n`); ok('...the .local name of this computer is answered', r.startsWith('HTTP/1.1 200'));
    await srv.close();
  }

  // ---- 6. tokens expire, and only so many are kept ----
  {
    const { srv, cmds } = make({ tokenMs: 200 }), port = await srv.listen(0, '127.0.0.1');
    const token = (await call(port, '/api/auth', { password: '1234' })).json.token;
    let r = await call(port, '/api/command', { token, cmd: { type: 'start' } }); ok('a fresh token works', r.code === 200);
    await wait(260); r = await call(port, '/api/command', { token, cmd: { type: 'start' } }); ok('...and has expired after its lifetime', r.code === 401 && cmds.length === 1);
    await srv.close();
    const b = make(), p2 = await b.srv.listen(0, '127.0.0.1'), many = [];
    for (let i = 0; i < 33; i++) many.push((await call(p2, '/api/auth', { password: '1234' })).json.token);
    r = await call(p2, '/api/command', { token: many[0], cmd: { type: 'start' } }); const last = await call(p2, '/api/command', { token: many[32], cmd: { type: 'start' } });
    ok('at most 32 tokens are kept: the oldest is dropped', r.code === 401 && last.code === 200);
    await b.srv.close();
  }

  // ---- 5. live updates: a full server refuses, a device has at most 8 ----
  {
    const { srv } = make({ limitLoopback: true }), port = await srv.listen(0, '127.0.0.1');
    const socks = [], heads = [], closed = new Set();
    for (let i = 0; i < 9; i++) { const s = net.connect(port, '127.0.0.1', () => s.write('GET /events HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n')); s.on('error', () => {}); s.on('data', d => { heads[i] = heads[i] || d.toString(); }); s.on('close', () => closed.add(i)); socks.push(s); await wait(10); }
    await wait(150);
    ok('one device follows with at most 8 connections; the 9th is refused and nobody is pushed off', srv.clientCount() === 8 && heads[8].startsWith('HTTP/1.1 503') && heads.slice(0, 8).every(h => h.startsWith('HTTP/1.1 200')) && closed.size === 0);
    socks.forEach(s => s.destroy()); await wait(50); await srv.close();
  }

  console.log(fails ? `${fails} SERVER HARDENING TESTS FAILED` : 'SERVER HARDENING TESTS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
