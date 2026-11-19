'use strict';
// "A new version is available": asks GitHub for the newest published Circuit release, once
// when Circuit starts (and when Check now is clicked in Settings).
//
// Only the latest release is requested; nothing about the user or the collection is sent, and
// the request carries a generic User-Agent with the app version. From the answer Circuit keeps
// the version, the release date, the short "What's new" section of the release notes (as plain
// text) and the names, sizes and fingerprints of the downloads.
//
// Download fetches the one file that matches this copy (the Windows installer or portable app,
// the macOS disk image, the Linux AppImage or .deb) into the Downloads folder, checks its size
// and SHA-256 fingerprint, and never runs it: people install it themselves. The address is
// built from this repository, the validated version tag and a validated file name, never
// taken from the answer, so only this app's own release files can be fetched.
//
// Settings and the last result belong to this computer's profile (update-check.json).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FILE = 'update-check.json';
const VERSION = 1;
const TIMEOUT_MS = 15 * 1000;
const MAX_BYTES = 1024 * 1024;
const MAX_DOWNLOAD = 1024 * 1024 * 1024; // 1 GB: the app downloads are well below this.
const STALL_MS = 60 * 1000; // a download that receives nothing for a minute is given up
const SEMVER = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;
const MAX_NOTES = 6;
const MAX_NOTE = 280;
// The defaults are SlotForge Circuit's; another app passes its own (see the constructor).
const PREFIX = 'SlotForgeCircuit';

function fault(message, code) {
  return Object.assign(Error(message), code ? { code } : {});
}

/** "1.6.0" or "v1.6.0" → [1, 6, 0]; anything else → null. */
function parse(version) {
  const m = SEMVER.exec(String(version || '').trim());
  return m ? m.slice(1).map(Number) : null;
}

function compare(a, b) {
  const x = parse(a),
    y = parse(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

/** "https://github.com/owner/repo" (package.json homepage, optionally .git or #readme) → "owner/repo". */
function repository(homepage) {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?(?:#.*)?$/.exec(
    String(homepage || '')
  );
  if (!m) throw fault('This app does not know where its releases are published.', 'NO_REPOSITORY');
  return `${m[1]}/${m[2]}`;
}

function pageUrl(repo, tag) {
  return `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`;
}

function fileUrl(repo, tag, name) {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

/** Markdown of one line → plain text: links keep their words, marks and code ticks go. */
function plain(line) {
  return line
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The "What's new" section of the release notes as a few plain lines: everything under a
 * heading called What's new (any level) up to the next heading. A line "- **Title:** text"
 * becomes { title, text }; other lines { text }.
 */
function whatsNew(body) {
  const lines = String(body || '')
    .slice(0, MAX_BYTES)
    .split(/\r?\n/);
  const start = lines.findIndex(l => /^#{1,6}\s*what[’']?s new\s*$/i.test(l.trim()));
  if (start < 0) return [];
  const notes = [];
  for (const raw of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(raw.trim())) break;
    const item = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(raw);
    const text = item ? item[1] : raw;
    if (!text.trim()) continue;
    if (!item && notes.length) {
      // A wrapped line belongs to the item above it.
      const last = notes[notes.length - 1];
      last.text = plain(last.text + ' ' + text);
      continue;
    }
    const titled = /^\s*\*\*([^*]{1,80}?):?\*\*:?\s*(.*)$/.exec(text);
    notes.push(titled ? { title: plain(titled[1]).replace(/:$/, ''), text: plain(titled[2]) } : { text: plain(text) });
    if (notes.length >= MAX_NOTES) break;
  }
  return clean(notes);
}

/** Keeps only well-formed, short notes (also for notes read back from the settings file). */
function clean(notes) {
  if (!Array.isArray(notes)) return [];
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  return notes
    .filter(n => n && typeof n.text === 'string' && (n.title === undefined || typeof n.title === 'string'))
    .map(n => ({
      ...(n.title ? { title: cut(plain(n.title), 60) } : {}),
      text: cut(plain(n.text), MAX_NOTE),
    }))
    .filter(n => n.text || n.title)
    .slice(0, MAX_NOTES);
}

/** The release's downloads for this version: a safe name, a size and (when GitHub has one) a SHA-256. */
function assets(list, version, prefix = PREFIX) {
  if (!Array.isArray(list)) return [];
  const named = new RegExp(`^${prefix}-${version.replace(/\./g, '\\.')}-[A-Za-z0-9_-]+\\.[A-Za-z0-9.]+$`);
  return list
    .filter(a => a && named.test(a.name) && Number.isSafeInteger(a.size) && a.size > 0 && a.size <= MAX_DOWNLOAD)
    .map(a => {
      const digest = /^sha256:([0-9a-f]{64})$/.exec(String(a.digest || ''));
      return { name: a.name, size: a.size, ...(digest ? { sha256: digest[1] } : {}) };
    });
}

/** Validates GitHub's "latest release" answer and keeps only what the app shows. */
function release(json, prefix = PREFIX) {
  if (!json || typeof json !== 'object') throw fault('GitHub sent an unexpected answer.', 'BAD_RESPONSE');
  if (json.draft || json.prerelease) throw fault('GitHub sent an unpublished release.', 'BAD_RESPONSE');
  const tag = String(json.tag_name || '');
  if (!parse(tag)) throw fault('The latest release has no usable version number.', 'BAD_RESPONSE');
  const published = Date.parse(json.published_at || '');
  const version = tag.replace(/^v/, '');
  return {
    version,
    tag,
    publishedAt: Number.isFinite(published) ? published : null,
    notes: whatsNew(json.body),
    assets: assets(json.assets, version, prefix),
  };
}

/**
 * Which kind of copy is running, and the release file that replaces it.
 * edition: { platform, arch, portable, appImage } (portable: the Windows portable app,
 * appImage: a Linux AppImage; otherwise the installer or the .deb).
 */
function kindOf(edition = {}) {
  const { platform, portable, appImage } = edition;
  if (platform === 'win32') return portable ? 'portable' : 'setup';
  if (platform === 'darwin') return 'mac';
  if (platform === 'linux') return appImage ? 'appimage' : 'deb';
  return null;
}
const KIND_LABEL = {
  setup: 'Windows · installer',
  portable: 'Windows · portable app',
  mac: 'macOS',
  appimage: 'Linux · AppImage',
  deb: 'Linux · .deb package',
};
function fileFor(latest, edition = {}, prefix = PREFIX) {
  if (!latest) return null;
  const arch = edition.arch || 'x64';
  const kind = kindOf(edition);
  const wanted = {
    setup: [`Setup-${arch}.exe`],
    portable: [`Portable-${arch}.exe`],
    mac: ['mac-universal.dmg', `mac-${arch}.dmg`],
    appimage: [`linux-${arch === 'x64' ? 'x86_64' : arch}.AppImage`],
    deb: [`linux-${arch === 'x64' ? 'amd64' : arch}.deb`],
  }[kind];
  if (!wanted) return null;
  for (const end of wanted) {
    const found = latest.assets.find(a => a.name === `${prefix}-${latest.version}-${end}`);
    if (found) return found;
  }
  return null;
}

class UpdateCheck {
  /**
   * @param {object} o
   * @param {string} o.profile          Profile folder that holds update-check.json.
   * @param {string} o.current          The running app version.
   * @param {string} o.homepage         package.json "homepage" (the GitHub repository).
   * @param {(url: string, init: object) => Promise<Response>} o.fetch
   * @param {string} [o.appName]       Name in messages ("Circuit").
   * @param {string} [o.artifactPrefix] Start of the release file names ("SlotForgeCircuit").
   * @param {string} [o.userAgent]     User-Agent product, sent with the version ("SlotForge-Circuit").
   * @param {boolean} [o.automatic]     Check when the app starts (packaged apps only).
   * @param {object} [o.edition]        { platform, arch, portable, appImage } of this copy.
   * @param {string} [o.downloads]      The folder downloads are saved to.
   * @param {() => void} [o.onChange]
   * @param {() => number} [o.now]
   */
  constructor(o) {
    this.file = path.join(o.profile, FILE);
    this.current = o.current;
    this.app = o.appName || 'Circuit';
    this.prefix = o.artifactPrefix || PREFIX;
    this.agent = `${o.userAgent || 'SlotForge-Circuit'}/${o.current}`;
    try {
      this.repo = repository(o.homepage);
    } catch (e) {
      this.repo = null; // Never stop the app from opening over this; Settings explains it.
      this.unavailable = e.message;
    }
    this.fetch = o.fetch;
    this.automatic = o.automatic !== false;
    this.edition = o.edition || {};
    this.downloads = o.downloads || null;
    this.onChange = o.onChange || (() => {});
    this.now = o.now || (() => Date.now());
    this.checking = null;
    this.controller = null;
    this.stopped = false;
    this.download = { state: 'idle' };
    this.downloadController = null;
    this.state = this.load();
  }

  load() {
    let saved = null;
    try {
      saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      saved = null;
    }
    if (saved?.version !== VERSION) saved = {};
    let latest = null;
    try {
      if (saved.latest) {
        latest = release(
          {
            tag_name: saved.latest.tag,
            published_at: Number.isFinite(saved.latest.publishedAt)
              ? new Date(saved.latest.publishedAt).toISOString()
              : '',
          },
          this.prefix
        );
        latest.notes = clean(saved.latest.notes);
        latest.assets = assets(
          (Array.isArray(saved.latest.assets) ? saved.latest.assets : []).map(a => ({
            ...a,
            digest: a?.sha256 ? `sha256:${a.sha256}` : undefined,
          })),
          latest.version,
          this.prefix
        );
      }
    } catch {
      latest = null;
    }
    return {
      enabled: typeof saved.enabled === 'boolean' ? saved.enabled : true,
      lastCheck: Number.isFinite(saved.lastCheck) ? saved.lastCheck : null,
      latest,
      skipped: parse(saved.skipped) ? String(saved.skipped) : null,
      lastError: typeof saved.lastError === 'string' ? saved.lastError : null,
    };
  }

  persist() {
    const temp = this.file + '.tmp';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify({ version: VERSION, ...this.state }, null, 2));
    fs.renameSync(temp, this.file);
  }

  status() {
    const { enabled, lastCheck, latest, skipped, lastError } = this.state;
    const newer = !!latest && compare(latest.version, this.current) > 0;
    const file = newer ? fileFor(latest, this.edition, this.prefix) : null;
    const kind = kindOf(this.edition);
    return {
      enabled,
      automatic: this.automatic && !!this.repo,
      current: this.current,
      kind,
      kindLabel: KIND_LABEL[kind] || null,
      latest: newer ? { version: latest.version, publishedAt: latest.publishedAt, notes: latest.notes, file } : null,
      upToDate: !!latest && !newer,
      // The pop-up: only once the file for this copy is attached to the release (the macOS and
      // Linux files follow the Windows ones a little later). Skip hides it until a newer version.
      notify: enabled && newer && !!file && (!skipped || compare(latest.version, skipped) > 0),
      lastCheck,
      lastError: this.unavailable || lastError,
      checking: !!this.checking,
      download: { ...this.download },
    };
  }

  /** Once when the app starts: checks if checking is on; a failure is only shown in Settings. */
  async startupCheck() {
    if (!this.automatic || !this.repo || !this.state.enabled || this.checking || this.stopped) return null;
    try {
      return await this.check();
    } catch {
      return null;
    }
  }

  /** Resolves with the status after the check has finished (checking is false by then). */
  check() {
    if (!this.repo) return Promise.reject(fault(this.unavailable, 'NO_REPOSITORY'));
    if (this.stopped) return Promise.reject(fault(`${this.app} is closing.`));
    if (!this.checking) {
      this.checking = this.request().finally(() => {
        this.checking = null;
        this.onChange();
      });
      this.onChange();
    }
    return this.checking.then(() => this.status());
  }

  async request() {
    const attempt = this.now();
    const controller = new AbortController();
    this.controller = controller;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let found;
    try {
      let response;
      try {
        // Redirects are followed: GitHub answers a renamed repository with a redirect.
        response = await this.fetch(`https://api.github.com/repos/${this.repo}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': this.agent },
          signal: controller.signal,
        });
      } catch {
        throw controller.signal.aborted && !this.stopped
          ? fault('GitHub did not answer in time. Try again later.', 'TIMEOUT')
          : fault(`${this.app} could not reach GitHub. Check the internet connection and try again.`, 'OFFLINE');
      }
      if (response.status === 404) throw fault('No published release was found yet.', 'NO_RELEASE');
      if (response.status === 403 || response.status === 429)
        throw fault(`GitHub asked ${this.app} to wait before checking again. Try again later.`, 'RATE_LIMITED');
      if (!response.ok)
        throw fault(`GitHub answered with an error (${response.status}). Try again later.`, 'BAD_RESPONSE');
      const length = Number(response.headers?.get?.('content-length'));
      if (Number.isFinite(length) && length > MAX_BYTES)
        throw fault('GitHub sent an unexpectedly large answer.', 'BAD_RESPONSE');
      let text;
      try {
        text = await response.text();
      } catch {
        throw fault('GitHub did not answer in time. Try again later.', 'TIMEOUT');
      }
      if (Buffer.byteLength(text) > MAX_BYTES) throw fault('GitHub sent an unexpectedly large answer.', 'BAD_RESPONSE');
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw fault('GitHub sent an unexpected answer.', 'BAD_RESPONSE');
      }
      found = release(json, this.prefix);
    } catch (e) {
      this.state.lastError = e.message;
      try {
        this.persist();
      } catch {
        /* The error still reaches the caller. */
      }
      throw e;
    } finally {
      clearTimeout(timer);
      this.controller = null;
    }
    // Success is recorded even if saving it to disk fails; it is saved again next time.
    if (this.state.latest?.version !== found.version && this.download.state !== 'downloading')
      this.download = { state: 'idle' };
    this.state.latest = found;
    this.state.lastCheck = attempt;
    this.state.lastError = null;
    try {
      this.persist();
    } catch {
      /* Kept in memory for this session. */
    }
    return this.status();
  }

  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw fault(`Choose whether ${this.app} checks for new versions.`);
    this.state.enabled = enabled;
    this.persist();
    this.onChange();
    return this.status();
  }

  /** Skip: no pop-up for this version; the next newer version shows it again. */
  skip(version) {
    if (!this.state.latest || version !== this.state.latest.version)
      throw fault('This version is no longer the latest.');
    this.state.skipped = version;
    this.persist();
    this.onChange();
    return this.status();
  }

  /** The release page: built from the repository and the validated version tag only. */
  releaseUrl() {
    if (!this.status().latest) throw fault('There is no newer version to download.');
    return pageUrl(this.repo, this.state.latest.tag);
  }

  setDownload(next) {
    this.download = next;
    this.onChange();
  }

  /**
   * Downloads the file for this copy into the Downloads folder. Resolves with the status when
   * it is saved; progress shows in status().download while it runs. The file is never opened.
   */
  async startDownload() {
    if (this.download.state === 'downloading') return this.status();
    if (this.stopped) throw fault(`${this.app} is closing.`);
    const s = this.status();
    const file = s.latest?.file;
    if (!file) throw fault(`There is no download for this copy of ${this.app} in the newest release.`, 'NO_FILE');
    if (!this.downloads) throw fault(`${this.app} does not know where to save downloads.`, 'NO_FOLDER');
    const target = path.join(this.downloads, file.name);
    const part = target + '.part';
    const controller = new AbortController();
    this.downloadController = controller;
    let stall = null;
    const watch = () => {
      clearTimeout(stall);
      stall = setTimeout(() => controller.abort(), STALL_MS);
    };
    this.setDownload({
      state: 'downloading',
      version: s.latest.version,
      name: file.name,
      received: 0,
      total: file.size,
    });
    let out = null;
    try {
      watch();
      let response;
      try {
        response = await this.fetch(fileUrl(this.repo, this.state.latest.tag, file.name), {
          headers: { 'User-Agent': this.agent },
          signal: controller.signal,
        });
      } catch {
        throw fault(`${this.app} could not reach GitHub. Check the internet connection and try again.`, 'OFFLINE');
      }
      if (!response.ok || !response.body)
        throw fault(`GitHub answered with an error (${response.status}). Try again later.`, 'BAD_RESPONSE');
      fs.mkdirSync(this.downloads, { recursive: true });
      out = fs.openSync(part, 'w');
      const hash = crypto.createHash('sha256');
      const reader = response.body.getReader();
      let received = 0,
        told = 0;
      for (;;) {
        let chunk;
        try {
          chunk = await reader.read();
        } catch {
          throw fault('The download stopped. Check the internet connection and try again.', 'OFFLINE');
        }
        if (chunk.done) break;
        watch();
        const bytes = Buffer.from(chunk.value);
        received += bytes.length;
        if (received > file.size) throw fault('The download is larger than GitHub said it would be.', 'BAD_FILE');
        hash.update(bytes);
        fs.writeSync(out, bytes);
        // Tell the window about four times a second at most.
        if (this.now() - told > 250) {
          told = this.now();
          this.setDownload({ ...this.download, received });
        }
      }
      fs.closeSync(out);
      out = null;
      if (received !== file.size) throw fault('The download is incomplete. Try again.', 'BAD_FILE');
      if (file.sha256 && hash.digest('hex') !== file.sha256)
        throw fault('The downloaded file does not match the release. It was removed; try again.', 'BAD_FILE');
      fs.renameSync(part, target);
      this.setDownload({ state: 'done', version: s.latest.version, name: file.name, file: target, total: file.size });
      return this.status();
    } catch (e) {
      const cancelled = controller.signal.aborted && this.download.cancelled;
      const message = cancelled
        ? 'Download cancelled.'
        : controller.signal.aborted && !this.stopped
          ? 'The download stopped. Check the internet connection and try again.'
          : e.message;
      this.setDownload({ state: cancelled ? 'idle' : 'failed', name: file.name, error: cancelled ? null : message });
      throw fault(message, cancelled ? 'CANCELLED' : e.code);
    } finally {
      clearTimeout(stall);
      if (out !== null)
        try {
          fs.closeSync(out);
        } catch {}
      try {
        fs.rmSync(part, { force: true });
      } catch {}
      this.downloadController = null;
    }
  }

  cancelDownload() {
    if (this.download.state !== 'downloading') return this.status();
    this.download.cancelled = true;
    this.downloadController?.abort();
    return this.status();
  }

  /** The saved download, for "Show in folder". */
  downloadedFile() {
    if (this.download.state !== 'done' || !this.download.file || !fs.existsSync(this.download.file))
      throw fault('The downloaded file is no longer there.', 'NO_FILE');
    return this.download.file;
  }

  /** At quit: no new checks, and a check or download in progress is abandoned. */
  stop() {
    this.stopped = true;
    this.controller?.abort();
    this.downloadController?.abort();
  }
}

module.exports = {
  UpdateCheck,
  parse,
  compare,
  repository,
  release,
  pageUrl,
  fileUrl,
  whatsNew,
  fileFor,
  kindOf,
};
