// View settings: which columns (or, in a grid, which rows) of a table are shown. Pure, so it can be tested without a screen.
// A table has a list of columns [{ key, on }]: on is whether the column is shown until the person changes it. What the person changed is kept as an
// overrides map { key: true | false }; a column that is not in it has its default, so a column that is new later (an extra field) shows up by itself.
(function (root) {
  const isOn = (col, saved) => (saved && typeof saved[col.key] === 'boolean' ? saved[col.key] : !!col.on);
  // the keys that are shown, in the order of the columns; never none at all (then the defaults are shown)
  function keys(cols, saved) {
    const k = cols.filter(c => isOn(c, saved)).map(c => c.key);
    if (k.length) return k;
    const d = cols.filter(c => c.on).map(c => c.key);
    return d.length ? d : cols.slice(0, 1).map(c => c.key);
  }
  // The overrides after turning one column on or off. The last column that is shown cannot be turned off. An override that says what the default says is dropped.
  function set(saved, cols, key, on) {
    const col = cols.find(c => c.key === key); if (!col) return { ...(saved || {}) };
    const next = { ...(saved || {}) };
    if (!on && isOn(col, next) && keys(cols, next).length <= 1) return next;
    if (!!on === !!col.on) delete next[key]; else next[key] = !!on;
    return next;
  }
  // settings.viewSettings[a][b]...: read without failing when a step is missing
  const get = (all, path) => path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), all) || {};
  // a copy of all with value at path (the steps on the way are copied too, the rest is shared)
  function put(all, path, value) {
    const root = { ...(all || {}) };
    let o = root;
    path.slice(0, -1).forEach(k => { o[k] = { ...(o[k] && typeof o[k] === 'object' ? o[k] : {}) }; o = o[k]; });
    o[path[path.length - 1]] = value;
    return root;
  }
  const api = { isOn, keys, set, get, put };
  root.ViewSet = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
