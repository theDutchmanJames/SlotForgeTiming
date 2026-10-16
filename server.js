// Network access: a small web server so tablets and phones on the same wifi can follow the race in a browser.
// They get the same Live Race pages as the second screen (read only). Only the Race Director page needs the password.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };
// what other devices may read from the database: no settings (they hold the password), nothing is ever written
const READABLE = ['drivers', 'teams', 'slotcars', 'tracks', 'racesetups', 'layouts', 'rowdesigns', 'sessions', 'laps', 'penaltysystems', 'fuelrules', 'weathersystems'];
// what the Race Director page may send to the race
const COMMANDS = ['start', 'pause', 'stop', 'yellow', 'red', 'penalty', 'assign', 'review', 'call', 'callresolve', 'addtime', 'reducetime', 'undotime', 'endtime', 'cleartime', 'setdriver', 'bop', 'weather', 'swap', 'swapnext'];
// The commands of the Tokens page (Time Token Sessions) are checked here before they go to the race window: a lane is a whole number from 0 to 15,
// the minutes to add are a number above 0 and at most 1440 (a day), a driver is the id of a driver (or '' for a Guest).
const TOKEN_COMMANDS = ['addtime', 'reducetime', 'undotime', 'endtime', 'cleartime', 'setdriver'];
function tokenCommand(c) {
  if (!TOKEN_COMMANDS.includes(c.type)) return true;
  if (!Number.isInteger(c.lane) || c.lane < 0 || c.lane > 15) return false;
  if (c.type === 'addtime' || c.type === 'reducetime') return typeof c.minutes === 'number' && Number.isFinite(c.minutes) && c.minutes > 0 && c.minutes <= 1440;
  if (c.type === 'setdriver') return typeof c.driverId === 'string' && c.driverId.length <= 80;
  return true;
}

// The command of Balance of Power: a lane is a whole number from 0 to 15, and what is pressed one of the five buttons of the lane controls.
const BOP_HOW = ['hinder', 'help', 'off', 'auto', 'accept'];
const WX_STATES = ['dry', 'cloudy', 'wet', 'clearing'];
// the Race Director sets the weather: one of the four states
function weatherCommand(c) {
  if (c.type !== 'weather') return true;
  return typeof c.state === 'string' && WX_STATES.includes(c.state);
}
// The commands of an Endurance Race: a lane is a whole number from 0 to 15; the driver who steps in (swap) is the id of a driver, or left out; swapnext needs the id of the driver who is next.
function swapCommand(c) {
  if (c.type !== 'swap' && c.type !== 'swapnext') return true;
  if (!Number.isInteger(c.lane) || c.lane < 0 || c.lane > 15) return false;
  const id = c.type === 'swap' ? c.to : c.id;
  if (c.type === 'swap' && (id === undefined || id === null || id === '')) return true;
  return typeof id === 'string' && id.length > 0 && id.length <= 80;
}
function bopCommand(c) {
  if (c.type !== 'bop') return true;
  return Number.isInteger(c.lane) && c.lane >= 0 && c.lane <= 15 && typeof c.how === 'string' && BOP_HOW.includes(c.how);
}

// o: { root (the renderer folder), appRoot (holds node_modules), schema, getSettings(), list(entity), customFields(entity), getLive() -> {stat, dyn}, onCommand(cmd) }
function createServer(o) {
  const clients = new Set(), tokens = new Map(); // token -> the password it was given for (a changed password logs everyone out)
  const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  const password = () => String((o.getSettings() || {}).netPassword || '');
  const body = req => new Promise((resolve, reject) => {
    let n = 0; const parts = [];
    req.on('data', c => { n += c.length; if (n > 1e6) { reject(new Error('too big')); req.destroy(); } else parts.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
  const same = (a, b) => { const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest(); return crypto.timingSafeEqual(x, y); };

  function serveFile(res, file) {
    fs.readFile(file, (err, data) => err ? send(res, 404, { error: 'not found' }) : send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'));
  }
  function inside(base, rel) { const f = path.resolve(base, '.' + path.sep + rel), b = path.resolve(base); return f === b || f.startsWith(b + path.sep) ? f : null; }

  async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
      if (req.method === 'GET' && p === '/events') { // live updates (server-sent events)
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write('retry: 2000\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return;
      }
      if (req.method === 'GET' && p.startsWith('/api/')) {
        const [, , what, arg] = p.split('/');
        if (what === 'schema') return send(res, 200, o.schema);
        if (what === 'settings') { const s = { ...o.getSettings() }; delete s.netPassword; return send(res, 200, s); }
        if (what === 'live') return send(res, 200, o.getLive());
        if (what === 'list' && READABLE.includes(arg)) return send(res, 200, o.list(arg));
        if (what === 'custom' && READABLE.includes(arg)) return send(res, 200, o.customFields(arg));
        if (what === 'director') return send(res, 200, { passwordSet: !!password() });
        return send(res, 404, { error: 'not found' });
      }
      if (req.method === 'POST' && p === '/api/auth') { // log in to the Race Director page
        const b = await body(req), pw = password();
        if (!pw) return send(res, 403, { error: 'nopassword' });
        if (typeof b.password !== 'string' || !same(b.password, pw)) { await new Promise(r => setTimeout(r, o.failDelay ?? 600)); return send(res, 401, { error: 'wrong' }); }
        const token = crypto.randomBytes(24).toString('hex'); tokens.set(token, pw);
        return send(res, 200, { token });
      }
      if (req.method === 'POST' && p === '/api/command') {
        const b = await body(req), pw = password();
        if (!pw || typeof b.token !== 'string' || tokens.get(b.token) !== pw) return send(res, 401, { error: 'login' });
        if (!b.cmd || !COMMANDS.includes(b.cmd.type)) return send(res, 400, { error: 'unknown command' });
        if (!tokenCommand(b.cmd) || !bopCommand(b.cmd) || !weatherCommand(b.cmd) || !swapCommand(b.cmd)) return send(res, 400, { error: 'bad command' });
        o.onCommand(b.cmd); return send(res, 200, { ok: true });
      }
      if (req.method === 'GET') { // the app's own pages
        let rel = p === '/' ? 'index.html' : p.slice(1), file;
        if (rel.startsWith('node_modules/flag-icons/')) file = inside(path.join(o.appRoot, 'node_modules', 'flag-icons'), rel.slice('node_modules/flag-icons/'.length));
        else file = inside(o.root, rel);
        if (!file) return send(res, 403, { error: 'no' });
        return serveFile(res, file);
      }
      send(res, 405, { error: 'no' });
    } catch (e) { send(res, 400, { error: String(e.message || e) }); }
  }

  const server = http.createServer((req, res) => { handler(req, res); });
  return {
    listen: (port, host = '0.0.0.0') => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.removeListener('error', reject); resolve(server.address().port); }); }),
    close: () => new Promise(resolve => { clients.forEach(c => { try { c.end(); } catch { /* gone */ } }); clients.clear(); server.close(() => resolve()); if (server.closeAllConnections) server.closeAllConnections(); }),
    // tell every connected browser: event 'static' or 'push'
    broadcast: (event, data) => { if (!clients.size) return; const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`; clients.forEach(c => { try { c.write(msg); } catch { clients.delete(c); } }); },
    clientCount: () => clients.size
  };
}
module.exports = { createServer, tokenCommand, bopCommand, weatherCommand, swapCommand };
