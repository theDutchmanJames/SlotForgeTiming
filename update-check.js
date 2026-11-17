'use strict';
// Is a newer release of SlotForge Timing on GitHub? Notify only: the app shows the news and a link to the release page; it never
// downloads or installs anything itself. One request to GitHub's public release API, with nothing about the user or the club in it.
// The result is kept in the profile (update-check.json), so the app asks GitHub at most once every 12 hours.
const RELEASES = 'https://api.github.com/repos/theDutchmanJames/SlotForgeTiming/releases/latest';
const PAGE = 'https://github.com/theDutchmanJames/SlotForgeTiming/releases/';
const INTERVAL_MS = 12 * 60 * 60 * 1000;

// "2.10.0" > "2.9.3"; a leading v and anything after a - or + (a pre-release or build tag) are ignored
function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v || '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function newer(candidate, current) {
  const a = parseVersion(candidate),
    b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
// Only what the app shows, checked: a draft or a pre-release is not offered, and the link must be a release page of this app.
function releaseOf(json) {
  if (!json || typeof json !== 'object' || json.draft || json.prerelease) return null;
  const version = parseVersion(json.tag_name);
  const url = typeof json.html_url === 'string' && json.html_url.startsWith(PAGE) ? json.html_url : null;
  if (!version || !url) return null;
  return {
    version: version.join('.'),
    name: String(json.name || 'SlotForge Timing ' + version.join('.')).slice(0, 120),
    url,
    publishedAt: typeof json.published_at === 'string' ? json.published_at.slice(0, 40) : ''
  };
}

// store: { read() -> saved object or null, write(object) }; fetch: the global fetch (or a stand-in in tests)
function createUpdateChecker({ currentVersion, fetch, store, now = () => Date.now(), intervalMs = INTERVAL_MS, timeoutMs = 8000 }) {
  let saved = (() => {
    try {
      return store.read() || {};
    } catch {
      return {};
    }
  })();
  let busy = null;
  const status = () => {
    const latest = saved.latest && newer(saved.latest.version, currentVersion) ? saved.latest : null;
    return {
      current: currentVersion,
      available: !!latest,
      latest,
      checkedAt: saved.checkedAt || null,
      error: saved.error || ''
    };
  };
  async function ask() {
    const ctl = new AbortController(),
      timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(RELEASES, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SlotForge-Timing/' + currentVersion },
        signal: ctl.signal
      });
      if (!res.ok) throw Error('GitHub answered ' + res.status);
      const release = releaseOf(await res.json());
      saved = { checkedAt: new Date(now()).toISOString(), latest: release, error: '' };
    } catch (error) {
      // (offline, GitHub busy or blocked: try again at the next check; what was known before stays)
      saved = {
        ...saved,
        checkedAt: new Date(now()).toISOString(),
        error: error.name === 'AbortError' ? 'No answer from GitHub.' : String(error.message || error).slice(0, 200)
      };
    } finally {
      clearTimeout(timer);
    }
    try {
      store.write(saved);
    } catch {
      /* the next start asks again */
    }
    return status();
  }
  // force: the person pressed Check now; otherwise at most once per interval
  function check(force = false) {
    const last = Date.parse(saved.checkedAt || '');
    if (!force && Number.isFinite(last) && now() - last < intervalMs) return Promise.resolve(status());
    if (!busy) busy = ask().finally(() => (busy = null));
    return busy;
  }
  return { check, status };
}

module.exports = { createUpdateChecker, newer, parseVersion, releaseOf, RELEASES, PAGE, INTERVAL_MS };
