// Network access: a small web server so tablets and phones on the same wifi can follow the race in a browser.
// They get the same Live Race pages as the second screen (read only). Only the Race Director page needs the password.
const http = require('http'),
  fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};
// what other devices may read from the database: no settings (they hold the password), nothing is ever written
const READABLE = [
  'resourcesystems',
  'drivers',
  'teams',
  'slotcars',
  'tracks',
  'racesetups',
  'layouts',
  'rowdesigns',
  'chartdesigns',
  'sessions',
  'laps',
  'penaltysystems',
  'damagesystems',
  'fuelrules',
  'weathersystems',
  'tyrewearsystems',
  'safetycarsystems',
  'pushsavesystems',
  'bopsystems',
  'tokensystems',
  'raceclasses',
  'multiclasssystems',
  'virtualrivalsystems'
];
// what the Race Director page may send to the race
const COMMANDS = [
  'start',
  'pause',
  'stop',
  'retire',
  'unretire',
  'yellow',
  'red',
  'penalty',
  'assign',
  'review',
  'call',
  'callresolve',
  'addtime',
  'reducetime',
  'undotime',
  'endtime',
  'cleartime',
  'setdriver',
  'bop',
  'weather',
  'tyre',
  'tyrenext',
  'swap',
  'swapnext',
  'damage',
  'failure',
  'failureclear',
  'pad',
  'pitrelease',
  'pitreleaseearly',
  'system'
];
// The plain buttons of the Race Director page that carry something: a lane is a whole number from 0 to 15, a penalty a number of points, a call has an id and is answered with one word.
const LANE = l => Number.isInteger(l) && l >= 0 && l <= 15;
function plainCommand(c) {
  if (c.type === 'system') return require('./renderer/racesystems').KEYS.includes(c.key) && typeof c.enabled === 'boolean';
  if (c.type === 'penalty')
    return LANE(c.lane) && (c.n === undefined || (typeof c.n === 'number' && Number.isFinite(c.n) && Math.abs(c.n) <= 1000));
  if (c.type === 'assign') return LANE(c.lane) && Number.isInteger(c.typeIndex) && c.typeIndex >= 0 && c.typeIndex < 100;
  if (c.type === 'call' || c.type === 'pitrelease' || c.type === 'pitreleaseearly' || c.type === 'retire' || c.type === 'unretire')
    return LANE(c.lane);
  if (c.type === 'callresolve') return Number.isInteger(c.id) && c.id >= 0 && typeof c.how === 'string' && c.how.length <= 30;
  return true;
}
// The commands of the Tokens page (Time Token Sessions) are checked here before they go to the race window: a lane is a whole number from 0 to 15,
// the minutes to add are a number above 0 and at most 1440 (a day), a driver is the id of a driver (or '' for a Guest).
const TOKEN_COMMANDS = ['addtime', 'reducetime', 'undotime', 'endtime', 'cleartime', 'setdriver'];
function tokenCommand(c) {
  if (!TOKEN_COMMANDS.includes(c.type)) return true;
  if (!Number.isInteger(c.lane) || c.lane < 0 || c.lane > 15) return false;
  if (c.type === 'addtime' || c.type === 'reducetime')
    return typeof c.minutes === 'number' && Number.isFinite(c.minutes) && c.minutes > 0 && c.minutes <= 1440;
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
// the Race Director gives a car another tyre (1.31.0, in every race since 1.32.0): a lane is a whole number from 0 to 15, the tyre one of the six (Hard, Medium, Soft, Supersoft, Intermediate, Wet; the race itself
// refuses Intermediate and Wet when the race has weather, because those come from the pit stops), and save (also change the Slotcar in the Database) true or false when it is there
const TYRE_CODES = require('./renderer/weather').TYRES.map(t => t.code);
function tyreCommand(c) {
  if (c.type !== 'tyre') return true;
  return (
    Number.isInteger(c.lane) &&
    c.lane >= 0 &&
    c.lane <= 15 &&
    typeof c.tyre === 'string' &&
    (TYRE_CODES.includes(c.tyre) || /^C_[A-F0-9]{16,32}$/.test(c.tyre)) &&
    (c.save === undefined || typeof c.save === 'boolean')
  ); // (save: the tyre is also kept on the Slotcar in the Database)
}
// the Race Director queues a tyre for the next stop of a car (Tyre Wear, 1.41.0): a lane from 0 to 15, and the tyre one of the six, or an empty text for "the same tyre"
function tyreNextCommand(c) {
  if (c.type !== 'tyrenext') return true;
  return (
    Number.isInteger(c.lane) &&
    c.lane >= 0 &&
    c.lane <= 15 &&
    typeof c.tyre === 'string' &&
    (c.tyre === '' || TYRE_CODES.includes(c.tyre) || /^C_[A-F0-9]{16,32}$/.test(c.tyre))
  );
}
// The commands of an Endurance Race: a lane is a whole number from 0 to 15; the driver who steps in (swap) is the id of a driver, or left out; swapnext needs the id of the driver who is next.
function swapCommand(c) {
  if (c.type !== 'swap' && c.type !== 'swapnext') return true;
  if (!Number.isInteger(c.lane) || c.lane < 0 || c.lane > 15) return false;
  const id = c.type === 'swap' ? c.to : c.id;
  if (c.type === 'swap' && (id === undefined || id === null || id === '')) return true;
  return typeof id === 'string' && id.length > 0 && id.length <= 80;
}
// The command of the Damage System: a lane is a whole number from 0 to 15, and the damage points are a whole number from -20 to 20, not 0 (negative: taken back).
function damageCommand(c) {
  if (c.type !== 'damage') return true;
  return Number.isInteger(c.lane) && c.lane >= 0 && c.lane <= 15 && Number.isInteger(c.n) && c.n >= -20 && c.n <= 20 && c.n !== 0;
}
// The commands of Car Failures (1.44.0): a lane is a whole number from 0 to 15. 'failure' gives the car a failure: k is its number in the list of the Damage System (0 to 99), or -1 for a random one; 'failureclear' clears the failure of the car.
function failureCommand(c) {
  if (c.type === 'failureclear') return Number.isInteger(c.lane) && c.lane >= 0 && c.lane <= 15;
  if (c.type !== 'failure') return true;
  return Number.isInteger(c.lane) && c.lane >= 0 && c.lane <= 15 && Number.isInteger(c.k) && c.k >= -1 && c.k <= 99;
}
// The command of the adjust pads: a group, a lane (a whole number from 0 to 15) and an amount that is not 0 and not more than 100000 (seconds, laps or points; negative takes off); damage points are a whole number from -20 to 20, as the damage command.
const PAD_GROUPS = ['points', 'damage', 'time', 'laps', 'champ'];
function padCommand(c) {
  if (c.type !== 'pad') return true;
  return (
    typeof c.group === 'string' &&
    PAD_GROUPS.includes(c.group) &&
    Number.isInteger(c.lane) &&
    c.lane >= 0 &&
    c.lane <= 15 &&
    typeof c.amount === 'number' &&
    Number.isFinite(c.amount) &&
    c.amount !== 0 &&
    Math.abs(c.amount) <= 100000 &&
    (c.group !== 'damage' || (Number.isInteger(c.amount) && Math.abs(c.amount) <= 20))
  );
}
function bopCommand(c) {
  if (c.type !== 'bop') return true;
  return Number.isInteger(c.lane) && c.lane >= 0 && c.lane <= 15 && typeof c.how === 'string' && BOP_HOW.includes(c.how);
}
// The corrections of the review (renderer/review.js apply, and the stints of a Time Token Session): only the known ones, each with only its own fields, all of the right kind.
// A car, a lap, a penalty (k) and a stint (sid) are whole numbers from 0; time is in ms, above 0 and at most a day (an adjustment may also take off); the rest is left out.
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const KEY = k => typeof k === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k) && !['__proto__', 'constructor', 'prototype'].includes(k);
const IDX = v => Number.isSafeInteger(v) && v >= 0,
  OPT = f => v => v === undefined || f(v),
  BOOL = OPT(v => typeof v === 'boolean'),
  NUM = max => v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max;
const DAY_MS = 864e5,
  CAR = { car: IDX };
const REVIEW_OPS = {
  finalize: {},
  discard: {},
  nullify: CAR,
  restorepoints: CAR,
  dq: CAR,
  undq: CAR,
  undnf: CAR,
  dnf: CAR,
  adjustreset: CAR,
  forgive: { car: IDX, k: IDX },
  addtime: { car: IDX, ms: v => NUM(DAY_MS)(v) && v > 0 },
  adjust: { car: IDX, ms: OPT(v => Number.isInteger(v) && NUM(DAY_MS)(v)), laps: OPT(NUM(100000)), points: OPT(NUM(100000)) },
  invalid: { car: IDX, lap: IDX, on: BOOL },
  removelap: { car: IDX, lap: IDX, recalc: BOOL },
  sector: { car: IDX, sector: v => v === undefined || v === null || (Number.isInteger(v) && v >= 0 && v <= 1000) },
  sectormove: { car: IDX, dir: v => v === -1 || v === 1 },
  tkinvalid: { sid: IDX, lap: IDX, on: BOOL },
  tkremove: { sid: IDX, lap: IDX, recalc: BOOL }
};
// the fields every command may carry; whatever else a browser sends is not passed on to the race
const FIELDS = {
  retire: ['lane'],
  unretire: ['lane'],
  penalty: ['lane', 'n'],
  assign: ['lane', 'typeIndex'],
  call: ['lane'],
  callresolve: ['id', 'how'],
  addtime: ['lane', 'minutes'],
  reducetime: ['lane', 'minutes'],
  undotime: ['lane'],
  endtime: ['lane'],
  cleartime: ['lane'],
  setdriver: ['lane', 'driverId'],
  bop: ['lane', 'how'],
  weather: ['state'],
  tyre: ['lane', 'tyre', 'save'],
  tyrenext: ['lane', 'tyre'],
  swap: ['lane', 'to'],
  swapnext: ['lane', 'id'],
  damage: ['lane', 'n'],
  failure: ['lane', 'k'],
  failureclear: ['lane'],
  pad: ['group', 'lane', 'amount'],
  pitrelease: ['lane'],
  pitreleaseearly: ['lane'],
  system: ['key', 'enabled']
};
// (follow-up audit) more that a phone never needs: the Time Token balances, hardware and plugin set-up, the edits of a heat plan
const PRIVATE_KEYS = [
  'tokenSessions',
  'hwDiagnostics',
  'dsSerial',
  'parallelPort',
  'pluginTiming',
  'heatEdits',
  'assignments',
  'hwIgnored',
  'tmDevice',
  'abDevice',
  'dsDevice'
];
const PRIVATE_SETTING = /^(net[A-Z]\w*|autoBackup\w*)$|(password|token|secret|folder|path)$/i;
// a clean copy of a command that may go to the race, or null
function cleanCommand(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || !KEY(c.type) || !COMMANDS.includes(c.type)) return null;
  const out = { type: c.type };
  // (audit 2026-11) the race the phone saw: the race window does nothing with a command meant for an earlier heat
  if (typeof c.raceId === 'string' && /^[0-9a-z]{1,40}$/.test(c.raceId)) out.raceId = c.raceId;
  if (typeof c.cid === 'string' && /^[0-9a-z]{4,24}$/.test(c.cid)) out.cid = c.cid; // (2.5.2: the phone's id of the command, for its answer)
  if (c.type === 'review') {
    if (!KEY(c.op) || !own(REVIEW_OPS, c.op)) return null;
    out.op = c.op;
    const spec = REVIEW_OPS[c.op];
    for (const f of Object.keys(spec)) {
      const v = own(c, f) ? c[f] : undefined;
      if (!spec[f](v)) return null;
      if (v !== undefined) out[f] = v;
    }
    if (c.op === 'adjust' && out.ms === undefined && out.laps === undefined && out.points === undefined) return null;
    return out;
  }
  if (c.type === 'system' && !KEY(c.key)) return null;
  for (const f of FIELDS[c.type] || []) if (own(c, f) && c[f] !== undefined) out[f] = c[f];
  if (c.type === 'stop' && (c.how === 'heat' || c.how === 'event')) out.how = c.how; // (2.5.2: End this heat or End the event)
  if (c.type === 'pause' && (c.want === 'pause' || c.want === 'resume')) out.want = c.want; // (audit 2026-11: what the button meant, so a second tap does not undo it)
  return out;
}

// o: { root (the renderer folder), appRoot (holds node_modules), schema, getSettings(), list(entity), customFields(entity), getLive() -> {stat, dyn}, onCommand(cmd) }
// The live pages are for this computer and the local network. A browser must reach them by an IP address, localhost or a local name
// (this computer's own name, alone or with a home-network suffix: .local, .lan, .home.arpa, .home, .internal, .localdomain or a FRITZ!Box router's .fritz.box); any other name could be a public web address pointing here, and is refused (DNS rebinding).
function localHost(host) {
  const net = require('net');
  let h = String(host || '')
    .trim()
    .toLowerCase();
  if (!h) return true; // (an old client that sends no Host)
  const v6 = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(h);
  if (v6) return net.isIPv6(v6[1]);
  if (net.isIPv6(h)) return true; // (an IPv6 address without a port)
  h = h.replace(/:\d{1,5}$/, '').replace(/\.$/, '');
  if (net.isIPv4(h) || h === 'localhost') return true;
  const full = String(require('os').hostname() || '')
      .toLowerCase()
      .replace(/\.$/, ''),
    me = full.split('.')[0];
  return (
    !!me &&
    (h === me || h === full || ['.local', '.lan', '.home.arpa', '.home', '.internal', '.localdomain', '.fritz.box'].some(s => h === me + s))
  );
}
// A POST must say it is JSON (a page on another site cannot send that without asking first), and a browser that names the page it comes from must come from this one.
const jsonPost = req => /^application\/json\s*(;|$)/i.test(String(req.headers['content-type'] || ''));
const sameOrigin = req => {
  const o = req.headers.origin;
  if (o === undefined) return true;
  try {
    return new URL(o).host === String(req.headers.host || '').toLowerCase();
  } catch {
    return false;
  }
};
const loopback = a => /^(127\.|::1$|::ffff:127\.)/.test(String(a || ''));
// what other devices see of a record: a driver's date of birth stays on this computer
function publicList(entity, rows) {
  if (entity !== 'drivers' || !Array.isArray(rows)) return rows;
  return rows.map(r => {
    if (!r || typeof r !== 'object' || !('dateOfBirth' in r)) return r;
    const { dateOfBirth, ...rest } = r;
    return rest;
  });
}
function createServer(o) {
  const work = new (require('./work-gate').WorkGate)(),
    requests = new Set();
  let closing;
  const clients = new Set(),
    tokens = o.tokens || new Map(); // (audit 2026-11: main.js keeps the map, so changing the port or another network setting does not log the phones out) // token -> { pw: the password it was given for (a changed password logs everyone out), at: when }
  const TOKEN_MS = o.tokenMs ?? 12 * 3600e3,
    MAX_TOKENS = 32;
  // Pairing a phone by QR code (2.3.0): a one-time code, valid for a few minutes, that logs one device in as the password would. It is made on this
  // computer only (App Settings), is tied to the password of that moment, and a wrong code counts as a wrong password.
  const pairs = new Map(), // code -> { pw, at }
    PAIR_MS = o.pairMs ?? 10 * 60e3,
    MAX_PAIRS = 8;
  const issueToken = pw => {
    const token = crypto.randomBytes(24).toString('hex');
    tokens.set(token, { pw, at: Date.now() });
    for (const [t, e] of tokens) if (tokens.size > MAX_TOKENS || Date.now() - e.at > TOKEN_MS) tokens.delete(t); // (the oldest go first)
    return token;
  };
  const tokenOk = (t, pw) => {
    const e = typeof t === 'string' && tokens.get(t);
    if (!e) return false;
    if (Date.now() - e.at > TOKEN_MS) {
      tokens.delete(t);
      return false;
    }
    if (e.pw !== pw) {
      tokens.delete(t); // (follow-up audit: a login of an old password is gone for good, also when that password is set again)
      return false;
    }
    e.at = Date.now();
    tokens.delete(t); // (and the one in use moves to the back: a full list lets go of the logins nobody uses)
    tokens.set(t, e); // (audit 2026-11: the login lasts 12 h after its last use, not after logging in, so it does not run out during an evening)
    return true;
  };
  // Guessing the password: one try at a time (each wrong one waits failDelay), and after a few wrong ones from a device, or many from all devices together,
  // nothing is tried for a while that doubles with every further wrong one (up to lockMaxMs). A right password resets it; a quiet hour forgets it.
  const AUTH = { chain: Promise.resolve(), waiting: 0, all: { n: 0, until: 0, last: 0 }, by: new Map() },
    LOCK_MS = o.lockMs ?? 2000,
    LOCK_MAX = o.lockMaxMs ?? 15 * 60e3,
    FORGET_MS = 3600e3;
  const lockOf = (r, after) => {
    r.n++;
    r.last = Date.now();
    if (r.n >= after) r.until = r.last + Math.min(LOCK_MAX, LOCK_MS * 2 ** Math.min(30, r.n - after));
  };
  const recOf = addr => {
    let r = AUTH.by.get(addr);
    if (r && Date.now() - r.last > FORGET_MS) r = null;
    if (!r) {
      r = { n: 0, until: 0, last: 0 };
      AUTH.by.delete(addr);
      if (AUTH.by.size >= 1000) AUTH.by.delete(AUTH.by.keys().next().value);
      AUTH.by.set(addr, r);
    }
    return r;
  };
  // (2.4.0) the lock for all devices does not shut out this computer or a device that already logged in: twenty wrong guesses from
  // somewhere on the wifi must not keep the Race Director out for the whole race (each device still has its own lock)
  const trusted = new Set(),
    trust = addr => {
      trusted.delete(addr);
      if (trusted.size >= 64) trusted.delete(trusted.values().next().value);
      trusted.add(addr);
    },
    allUntil = addr => (loopback(addr) || trusted.has(addr) ? 0 : AUTH.all.until);
  const MAX_PER_ADDR = o.maxPerAddress ?? 8;
  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const password = () => String((o.getSettings() || {}).netPassword || '');
  const body = req =>
    new Promise((resolve, reject) => {
      let n = 0;
      const parts = [];
      req.on('data', c => {
        n += c.length;
        if (n > 1e6) {
          reject(new Error('too big'));
          req.destroy();
        } else parts.push(c);
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(parts).toString() || '{}'));
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
      req.on('aborted', () => reject(Error('Request interrupted.')));
    });
  // A browser that stops reading the live updates must not make Timing keep them all in memory: once more than MAX_BACKLOG waits for it for longer than
  // maxLagMs it is dropped (its browser reconnects by itself and fetches the whole state again). A big picture snapshot that is still on its way is not a stall.
  // A comment line every 25 s finds the connections of phones that went away, so they do not fill the places.
  const MAX_CLIENTS = 64,
    MAX_BACKLOG = 16 * 1024 * 1024,
    maxLagMs = o.maxLagMs ?? 30000;
  const deliver = (c, msg) => {
    try {
      if (c.writableLength > MAX_BACKLOG) {
        c.lagSince = c.lagSince || Date.now();
        if (Date.now() - c.lagSince > maxLagMs) {
          clients.delete(c);
          c.destroy();
          return;
        }
      } else c.lagSince = 0;
      c.write(msg);
    } catch {
      clients.delete(c);
    }
  };
  const ping = setInterval(() => clients.forEach(c => deliver(c, ': ping\n\n')), o.pingMs ?? 25000);
  if (ping.unref) ping.unref();
  const same = (a, b) => {
    const x = crypto.createHash('sha256').update(a).digest(),
      y = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(x, y);
  };

  function serveFile(res, file) {
    return fs.promises.readFile(file).then(
      data => send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'),
      () => send(res, 404, { error: 'not found' })
    );
  }
  function inside(base, rel) {
    const f = path.resolve(base, '.' + path.sep + rel),
      b = path.resolve(base);
    return f === b || f.startsWith(b + path.sep) ? f : null;
  }

  async function handler(req, res) {
    try {
      if (work.closing && !req.complete) return send(res, 503, { error: 'Timing is closing', code: 'APP_CLOSING' });
      if (!localHost(req.headers.host)) return send(res, 421, { error: 'Open this page by the address of the timing computer' }); // (a page from an outside web address may not read the race: DNS rebinding)
      const url = new URL(req.url, 'http://x'),
        p = decodeURIComponent(url.pathname);
      if (req.method === 'GET' && p === '/events') {
        // live updates (server-sent events)
        if (work.closing) return send(res, 503, { error: 'Timing is closing', code: 'APP_CLOSING' });
        // (more browsers than a club needs, or more than a few from one device: the newest waits, so nobody can push the others off; this computer itself has no per-device limit)
        const addr = req.socket.remoteAddress;
        let mine = 0;
        clients.forEach(c => {
          if (c.addr === addr) mine++;
        });
        if (clients.size >= MAX_CLIENTS || ((o.limitLoopback || !loopback(addr)) && mine >= MAX_PER_ADDR)) {
          res.setHeader('Retry-After', '10');
          return send(res, 503, { error: 'Too many live connections' });
        }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.addr = addr;
        res.write('retry: 2000\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (req.method === 'GET' && p.startsWith('/api/')) {
        const [, , what, arg] = p.split('/');
        if (what === 'schema') return send(res, 200, o.schema);
        if (what === 'settings') {
          const s = { ...o.getSettings() };
          // (audit 2026-11) what a phone never needs: the password, the backup and network set-up of this computer, and anything that names a folder or a secret
          for (const k of Object.keys(s)) if (PRIVATE_SETTING.test(k) || PRIVATE_KEYS.includes(k)) delete s[k];
          return send(res, 200, s);
        }
        if (what === 'live') return send(res, 200, o.getLive());
        if (what === 'list' && READABLE.includes(arg)) return send(res, 200, publicList(arg, await o.list(arg)));
        if (what === 'custom' && READABLE.includes(arg)) return send(res, 200, await o.customFields(arg));
        if (what === 'director') return send(res, 200, { passwordSet: !!password() });
        return send(res, 404, { error: 'not found' });
      }
      if (req.method === 'POST' && (p === '/api/auth' || p === '/api/command' || p === '/api/pair')) {
        if (!jsonPost(req)) return send(res, 415, { error: 'Send JSON' });
        if (!sameOrigin(req)) return send(res, 403, { error: 'Open this page by the address of the timing computer' });
      }
      if (req.method === 'POST' && p === '/api/pair') {
        // log in with the one-time code of a QR code (the same guards as a password)
        const b = await body(req),
          pw = password(),
          addr = String(req.socket.remoteAddress || ''),
          mine = recOf(addr);
        if (!pw) return send(res, 403, { error: 'nopassword' });
        // (audit 2026-11) only this device's own lock: wrong passwords from elsewhere on the wifi must not stop a phone from pairing by QR code,
        // the way back in when somebody keeps the lock for all devices going (a code is far too long to guess)
        const wait = mine.until - Date.now();
        if (wait > 0) {
          res.setHeader('Retry-After', String(Math.ceil(wait / 1000)));
          return send(res, 429, { error: `Too many wrong tries. Try again in ${Math.ceil(wait / 1000)} s.` });
        }
        const code = typeof b.code === 'string' ? b.code : '',
          e = pairs.get(code);
        if (!e || Date.now() - e.at > PAIR_MS || e.pw !== pw) {
          if (e) pairs.delete(code);
          lockOf(mine, 5);
          lockOf(AUTH.all, 20);
          await new Promise(r => setTimeout(r, o.failDelay ?? 600));
          return send(res, 401, { error: 'pair' });
        }
        pairs.delete(code); // (once)
        trust(addr);
        return send(res, 200, { token: issueToken(pw) });
      }
      if (req.method === 'POST' && p === '/api/auth') {
        // log in to the Race Director page
        const b = await body(req),
          pw = password(),
          addr = String(req.socket.remoteAddress || ''),
          mine = recOf(addr);
        if (!pw) return send(res, 403, { error: 'nopassword' });
        const locked = () => {
          const wait = Math.max(mine.until, allUntil(addr)) - Date.now();
          if (wait <= 0) return false;
          res.setHeader('Retry-After', String(Math.ceil(wait / 1000)));
          send(res, 429, { error: `Too many wrong passwords. Try again in ${Math.ceil(wait / 1000)} s.` });
          return true;
        };
        if (locked()) return;
        if (AUTH.waiting >= 8 && !loopback(addr) && !trusted.has(addr)) {
          // (audit 2026-11: a device that logged in before, or this computer, is never turned away as busy by a flood of tries from another)
          res.setHeader('Retry-After', '2');
          return send(res, 429, { error: 'Busy. Try again in a moment.' });
        }
        AUTH.waiting++;
        const turn = AUTH.chain.then(async () => {
          // (one at a time, however many arrive together)
          if (locked()) return;
          if (Date.now() - AUTH.all.last > FORGET_MS) AUTH.all.n = 0;
          if (typeof b.password !== 'string' || !same(b.password, pw)) {
            lockOf(mine, 5);
            lockOf(AUTH.all, 20);
            await new Promise(r => setTimeout(r, o.failDelay ?? 600));
            return send(res, 401, { error: 'wrong' });
          }
          mine.n = 0;
          mine.until = 0;
          AUTH.all.n = 0;
          AUTH.all.until = 0;
          trust(addr);
          return send(res, 200, { token: issueToken(pw) });
        });
        AUTH.chain = turn.catch(() => {}).finally(() => AUTH.waiting--);
        return await turn;
      }
      if (req.method === 'POST' && p === '/api/command') {
        const b = await body(req),
          pw = password();
        if (!pw || !b || !tokenOk(b.token, pw)) return send(res, 401, { error: 'login' });
        if (!b.cmd || typeof b.cmd !== 'object' || !COMMANDS.includes(b.cmd.type)) return send(res, 400, { error: 'unknown command' });
        const cmd = cleanCommand(b.cmd);
        if (
          !cmd ||
          !plainCommand(cmd) ||
          !tokenCommand(cmd) ||
          !bopCommand(cmd) ||
          !weatherCommand(cmd) ||
          !tyreCommand(cmd) ||
          !tyreNextCommand(cmd) ||
          !swapCommand(cmd) ||
          !damageCommand(cmd) ||
          !failureCommand(cmd) ||
          !padCommand(cmd)
        )
          return send(res, 400, { error: 'bad command' });
        if (work.closing) return send(res, 503, { error: 'Timing is closing', code: 'APP_CLOSING' });
        await o.onCommand(cmd);
        return send(res, 200, { ok: true });
      }
      if (req.method === 'GET') {
        // the app's own pages
        let rel = p === '/' ? 'index.html' : p.slice(1),
          file;
        if (rel.startsWith('node_modules/flag-icons/'))
          file = inside(path.join(o.appRoot, 'node_modules', 'flag-icons'), rel.slice('node_modules/flag-icons/'.length));
        else file = inside(o.root, rel);
        if (!file) return send(res, 403, { error: 'no' });
        return serveFile(res, file);
      }
      send(res, 405, { error: 'no' });
    } catch (e) {
      // (2.4.0) a phone gets the known request errors only; anything else (a storage or file error, with paths of this computer) stays here
      const known = e instanceof SyntaxError ? 'bad JSON' : ['too big', 'Request interrupted.'].includes(e && e.message) ? e.message : '';
      if (!known) console.error('[server]', e);
      send(res, 400, { error: known || 'bad request' });
    }
  }

  const server = http.createServer((req, res) => {
    if (work.closing) {
      res.setHeader('Retry-After', '2');
      send(res, 503, { error: 'Timing is closing', code: 'APP_CLOSING' });
      req.resume();
      return;
    }
    requests.add(req);
    // A disconnected reader does not release an in-flight storage operation.
    work
      .run(() => handler(req, res))
      .catch(() => res.destroy())
      .finally(() => requests.delete(req));
  });
  function quiesce() {
    work.stop();
    clients.forEach(c => c.end());
    clients.clear();
    for (const req of requests) if (!req.complete) req.destroy();
  }
  return {
    listen: (port, host = '0.0.0.0') =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.removeListener('error', reject);
          resolve(server.address().port);
        });
      }),
    quiesce,
    close: () =>
      (closing ||= (async () => {
        clearInterval(ping);
        quiesce();
        await work.idle();
        await new Promise(resolve => {
          server.close(() => resolve());
          server.closeAllConnections?.();
        });
      })()),
    // tell every connected browser: event 'static' or 'push'
    broadcast: (event, data) => {
      if (!clients.size) return;
      const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      clients.forEach(c => deliver(c, msg));
    },
    clientCount: () => clients.size,
    // a new one-time pairing code (null without a password) -> { code, expiresAt }
    pairing: () => {
      const pw = password();
      if (!pw) return null;
      for (const [c, e] of pairs) if (Date.now() - e.at > PAIR_MS) pairs.delete(c);
      while (pairs.size >= MAX_PAIRS) pairs.delete(pairs.keys().next().value);
      const code = crypto.randomBytes(16).toString('hex'),
        at = Date.now();
      pairs.set(code, { pw, at });
      return { code, expiresAt: new Date(at + PAIR_MS).toISOString() };
    }
  };
}
module.exports = {
  createServer,
  localHost,
  publicList,
  cleanCommand,
  tokenCommand,
  bopCommand,
  weatherCommand,
  tyreCommand,
  tyreNextCommand,
  swapCommand,
  damageCommand,
  failureCommand,
  padCommand
};
