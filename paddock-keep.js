'use strict';
// (2.4.0, SlotForgeRestyle.md "Paddock Pit Lane") the Dealership password remembered on this computer, and reconnecting by itself.
// The password is kept encrypted by Windows (Electron safeStorage: only this Windows user on this computer can read it), next to the database id of
// the Paddock it belongs to. Without encryption nothing is written: the password then stays in memory only, as before.
// reconnect(): the saved address first; when Paddock moved to another port (it can after a restart), the Dealership is found on the network again by
// its database id. A wrong password forgets the remembered one.
const fs = require('node:fs'),
  path = require('node:path');

class PaddockKeep {
  // file: where it is kept; crypt: { available(), encrypt(text) -> Buffer, decrypt(Buffer) -> text }
  constructor(file, crypt) {
    this.file = file;
    this.crypt = crypt;
  }
  available() {
    try {
      return !!this.crypt?.available();
    } catch {
      return false;
    }
  }
  read() {
    try {
      const v = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return v && typeof v.databaseId === 'string' && typeof v.secret === 'string' ? v : null;
    } catch {
      return null;
    }
  }
  // the remembered password of this Paddock database ('' when there is none)
  code(databaseId) {
    const v = this.read();
    if (!v || (databaseId && v.databaseId !== databaseId) || !this.available()) return '';
    try {
      return String(this.crypt.decrypt(Buffer.from(v.secret, 'base64')) || '');
    } catch {
      return '';
    }
  }
  has(databaseId) {
    const v = this.read();
    return !!v && (!databaseId || v.databaseId === databaseId);
  }
  remember(connection, code) {
    if (!connection?.databaseId || !code || !this.available()) return false;
    const secret = Buffer.from(this.crypt.encrypt(String(code))).toString('base64');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(
      tmp,
      JSON.stringify({ databaseId: connection.databaseId, name: connection.name || '', secret, at: new Date().toISOString() })
    );
    fs.renameSync(tmp, this.file);
    return true;
  }
  forget() {
    try {
      fs.rmSync(this.file, { force: true });
    } catch {}
  }
}

// one try to connect again with the remembered password: { tried, ok, how ('saved' | 'found'), reason }
async function reconnect(paddock, keep, discover) {
  const s = await paddock.status();
  const c = s.connection;
  if (!c || c.mode === 'local') return { tried: false, reason: 'no-dealership' };
  if (s.connected && s.hasCode) {
    // (connected means: the last request worked; a short status request says whether it still is)
    if (!paddock.ping || (await paddock.ping())) return { tried: false, ok: true, reason: 'connected' };
  }
  if (paddock.busy || paddock.isRacing?.()) return { tried: false, reason: 'busy' };
  const code = keep.code(c.databaseId);
  if (!code) return { tried: false, reason: 'no-password' };
  const wrong = e => e && (e.code === 'UNAUTHENTICATED' || /password|unauthori[sz]ed/i.test(e.message || ''));
  try {
    await paddock.connect({ address: c.address, code });
    return { tried: true, ok: true, how: 'saved' };
  } catch (e) {
    if (wrong(e)) {
      keep.forget();
      return { tried: true, ok: false, reason: 'password' };
    }
  }
  let found = [];
  try {
    found = await discover();
  } catch {
    return { tried: true, ok: false, reason: 'not-found' };
  }
  // (Paddock answers on every network adapter: the address on the home network first, virtual adapters and this computer last)
  const score = a =>
    /\/\/192\.168\./.test(a) ? 0 : /\/\/10\./.test(a) ? 1 : /\/\/172\./.test(a) ? 2 : /\/\/(127\.|localhost)/.test(a) ? 4 : 3;
  const host = found.filter(h => h.id === c.databaseId && h.address !== c.address).sort((a, b) => score(a.address) - score(b.address))[0];
  if (!host) return { tried: true, ok: false, reason: 'not-found' };
  try {
    await paddock.connect({ address: host.address, code });
    return { tried: true, ok: true, how: 'found', address: host.address };
  } catch (e) {
    if (wrong(e)) keep.forget();
    return { tried: true, ok: false, reason: wrong(e) ? 'password' : 'not-found' };
  }
}

module.exports = { PaddockKeep, reconnect };
