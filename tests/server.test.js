// Network access: the web server, its password rules and the live updates, tested over real connections on this computer.
const http = require('http'), path = require('path');
const { createServer } = require('../server.js'), QR = require('../qr.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const R = path.join(__dirname, '..');
let settings = { theme: 'midnight', netPassword: 'secret', rules: 'Be kind.' };
const live = { stat: { raceId: 'r1', title: 'Test' }, dyn: { raceId: 'r1', phase: 'running' } };
const cmds = [];
const srv = createServer({ root: path.join(R, 'renderer'), appRoot: R, schema: { tracks: { label: 'Track' } }, getSettings: () => settings, list: e => [{ id: 'x', entity: e }], customFields: () => [], getLive: () => live, onCommand: c => cmds.push(c), failDelay: 10 });
const call = (port, method, url, data) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: url, method, headers: data ? { 'Content-Type': 'application/json' } : {} }, res => {
    const parts = []; res.on('data', c => parts.push(c)); res.on('end', () => { const t = Buffer.concat(parts).toString(); let j = null; try { j = JSON.parse(t); } catch { /* not json */ } resolve({ code: res.statusCode, type: res.headers['content-type'], text: t, json: j }); });
  }); req.on('error', reject); if (data) req.write(JSON.stringify(data)); req.end();
});

(async () => {
  const port = await srv.listen(0, '127.0.0.1'), get = u => call(port, 'GET', u), post = (u, d) => call(port, 'POST', u, d);
  let r = await get('/');
  ok('the app page is served', r.code === 200 && r.type.includes('text/html') && r.text.includes('<main id="view">'));
  r = await get('/engine.js'); ok('its scripts are served', r.code === 200 && r.type.includes('javascript') && r.text.includes('createRace'));
  r = await get('/styles.css'); ok('...and styles', r.code === 200 && r.type.includes('css'));
  r = await get('/../db.js'); ok('files outside the app pages are not served', r.code !== 200 && !r.text.includes('class Database'));
  r = await get('/%2e%2e/db.js'); ok('...not even with an escaped path', r.code !== 200 && !r.text.includes('class Database'));
  r = await get('/node_modules/electron/package.json'); ok('...nor other packages', r.code !== 200);
  r = await get('/api/settings'); ok('settings are shared without the password', r.code === 200 && r.json.theme === 'midnight' && r.json.rules === 'Be kind.' && !('netPassword' in r.json) && !r.text.includes('secret'));
  r = await get('/api/list/drivers'); ok('the database can be read', r.code === 200 && r.json[0].entity === 'drivers');
  r = await get('/api/list/settings'); ok('...but only its tables', r.code === 404);
  r = await get('/api/list/tyrewearsystems'); ok('...the tyre wear systems too (1.40.0: a phone that runs a race needs them) and the scripts of the tyre widgets are served', r.code === 200 && r.json[0].entity === 'tyrewearsystems' && (await get('/tyrewear.js')).text.includes('TyreWear') && (await get('/tyrewidgets.js')).text.includes('TyreWidgets'));
  r = await get('/api/schema'); ok('the schema is shared', r.json.tracks.label === 'Track');
  r = await get('/api/live'); ok('the running race can be fetched', r.json.stat.raceId === 'r1' && r.json.dyn.phase === 'running');
  r = await post('/api/add', {}); ok('nothing can be written', r.code === 404 || r.code === 405);
  r = await post('/api/command', { cmd: { type: 'start' } }); ok('a command without logging in is refused', r.code === 401 && cmds.length === 0);
  r = await post('/api/command', { token: 'made-up', cmd: { type: 'start' } }); ok('...also with a made-up token', r.code === 401 && cmds.length === 0);
  r = await post('/api/auth', { password: 'nope' }); ok('a wrong password is refused', r.code === 401 && !r.json.token);
  r = await post('/api/auth', {}); ok('...and a missing one', r.code === 401);
  r = await post('/api/auth', { password: 'secret' }); const token = r.json.token; ok('the right password gives a token', r.code === 200 && typeof token === 'string' && token.length >= 32);
  r = await post('/api/command', { token, cmd: { type: 'start' } }); ok('...which can send commands to the race', r.code === 200 && cmds.length === 1 && cmds[0].type === 'start');
  r = await post('/api/command', { token, cmd: { type: 'penalty', lane: 1, n: 1 } }); ok('...including penalties', r.code === 200 && cmds[1].lane === 1);
  r = await post('/api/command', { token, cmd: { type: 'call', lane: 0 } }); ok('...a call from a lane', r.code === 200 && cmds.length === 3 && cmds[2].type === 'call' && cmds[2].lane === 0);
  r = await post('/api/command', { token, cmd: { type: 'callresolve', id: 1, how: 'dismiss' } }); ok('...and the decision about a call', r.code === 200 && cmds.length === 4 && cmds[3].how === 'dismiss');
  r = await post('/api/command', { token, cmd: { type: 'penalty', lane: 99, n: 1 } }); const n0 = cmds.length; ok('a penalty for a lane that does not exist is refused (1.39.1)', r.code === 400);
  r = await post('/api/command', { token, cmd: { type: 'penalty', lane: 1, n: 'lots' } }); ok('...and so is a penalty of "lots"', r.code === 400);
  r = await post('/api/command', { token, cmd: { type: 'call' } }); ok('...a call without a lane', r.code === 400);
  r = await post('/api/command', { token, cmd: { type: 'callresolve', id: 1, how: { x: 1 } } }); ok('...a decision that is not a word', r.code === 400);
  r = await post('/api/command', { token, cmd: { type: 'assign', lane: 0, typeIndex: -3 } }); ok('...a penalty type that does not exist', r.code === 400 && cmds.length === n0);
  r = await post('/api/command', { token, cmd: { type: 'delete everything' } }); ok('unknown commands are refused', r.code === 400 && cmds.length === 4);
  cmds.length = 2;
  r = await get('/api/director'); ok('the page can ask whether a password is set', r.json.passwordSet === true);
  settings = { ...settings, netPassword: 'changed' };
  r = await post('/api/command', { token, cmd: { type: 'stop' } }); ok('changing the password logs everyone out', r.code === 401 && cmds.length === 2);
  settings = { ...settings, netPassword: '' };
  r = await post('/api/auth', { password: '' }); ok('with no password set the Race Director is closed to the network', r.code === 403 && r.json.error === 'nopassword');
  r = await get('/api/director'); ok('...and the page can tell', r.json.passwordSet === false);
  settings = { ...settings, netPassword: 'secret' };

  // live updates
  const got = [];
  await new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: '/events' }, res => {
      ok('live updates are a stream', res.headers['content-type'].includes('text/event-stream'));
      res.on('data', c => { got.push(c.toString()); });
      setTimeout(() => { srv.broadcast('static', { raceId: 'r2' }); srv.broadcast('push', { raceId: 'r2', n: 1 }); }, 50);
      setTimeout(() => { req.destroy(); resolve(); }, 250);
    });
  });
  const all = got.join('');
  ok('a connected browser receives what the race shares', all.includes('event: static') && all.includes('"raceId":"r2"') && all.includes('event: push') && all.includes('"n":1'));
  await new Promise(r => setTimeout(r, 50));
  ok('a closed connection is forgotten', srv.clientCount() === 0);
  await srv.close();

  // the QR code
  const m = QR.matrix('http://192.168.1.23:8787/'), svg = QR.svg('http://192.168.1.23:8787/');
  ok('the QR code is a square of modules with the finder squares in the corners', m.length === m[0].length && m.length >= 25 && m[0].slice(0, 7).every(Boolean) && m[6].slice(0, 7).every(Boolean) && !m[1][1]);
  ok('...and an SVG with a white border', svg.startsWith('<svg') && svg.includes('fill="#fff"') && svg.includes('viewBox="0 0 ' + (m.length + 8)));
  console.log(fails ? fails + ' SERVER TESTS FAILED' : 'ALL SERVER TESTS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
