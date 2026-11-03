# Championship and live-display read review

3 November 2026. Local implementation; production storage remains JSON. All SQLite
migration, writes and index upgrades in this phase used explicit disposable copies.
No personal database was migrated and no release was made.

## Changes

- `raceSeason` reads the selected championship, its scoring sessions and the laps
  needed by the actual race participants. It runs after team/endurance participant
  construction so driver totals cannot accidentally substitute for team totals.
- `Season.pastFrom` streams matching laps through the existing calculation rules.
  The original array-based entry point delegates to it and remains available to
  existing consumers. Result adjustments, penalty time, pit/invalid/slow-lap rules,
  historical late-lap behavior and measured/calculated lane lengths are preserved.
- The renderer receives totals and valid lap times, without the complete lap
  objects. Numeric times remain necessary for exact median/average widgets.
  Championship sessions retain qualifying, class, roster and team scoring details.
  Unrelated championships, embedded media and Paddock captures are excluded.
- SQLite selects championship sessions through an expression index and saved laps
  through the existing session index. The read is a single transaction. Opening
  an older experimental working-format-4 copy adds the new index without changing
  authoritative records or requiring a new format number.
- Race preparation follows explicit layout dependencies: leaderboard row designs,
  saved charts, image sets and fixed team pictures. The walker includes standard
  components nested inside Widget Builder compositions, both screen layouts,
  repeated references and deleted-reference fallbacks. Inline media stays intact.
  Team metadata remains available; full team pictures load for entrants and widgets
  that reference them. Selected team rosters retain their driver avatars.
- Chart Editor refreshes only the IDs used by the race, including missing IDs so a
  restored design can reappear. Responses from an obsolete race or an older refresh
  cannot replace current chart data.
- Championship read errors now prevent race preparation with a visible explanation.
  The previous silent fallback could start a race without its championship totals.

## Verification and review

- Eleven new focused tests cover JSON/SQLite parity, explicit expected totals,
  penalties, distance, reruns, excluded/zero-share rounds, qualifying, virtual
  participants, team/class scoring, missing lengths, worker IPC, display dependencies,
  chart selections, absent/cyclic row references and existing-copy index upgrades.
- A 100,000-lap synthetic JSON history is scanned once. Only the two relevant
  times and championship data leave the adapter (under 3 KB for this fixture).
  This is a functional transfer/iteration check, not a general timing benchmark.
- Storage suite: all 162 tests passed. The full application regression suite
  (`npm test`) exited 0, as did the ASAR-packaged SQLite worker probe.
- Actual Electron app, generated profile: visible prior championship laps and
  points, populated live lap chart, selected team artwork, row avatars and a custom
  composition. Legacy full-list reads for history/design/reference entities were
  made to throw during race preparation, proving the new read paths were used.
- Captured all nine themes; inspected dark/light/custom rendering. Secondary chart
  rendering uses the same selected dependency set. Chart refresh, overlapping
  refresh order, leaving during a pending championship query and a read failure
  were exercised in the app. No renderer errors were reported. The existing Home
  and ordinary-race Electron probe also passed after the dependency changes.
- Test development caught two incorrect fixture expectations: championship session
  IDs must be unique across rounds, and saved distance totals round to three
  decimals. Both fixtures were corrected rather than changing application rules.
- Review preserved the old `Season.past` contract, removed unused full-collection
  helpers from the race source, checked null legacy lap handling and verified the
  new IPC methods through both repositories and the worker allowlist.

Evidence: `../outputs/sqlite-conversion/season-targeted.log`, `season-storage.log`,
`season-app-suite.log`, `season-asar.log`, and `season-ui/result.json`.
Reproduce: `npm run test:storage`, `npm run test:season:electron`,
`npm run test:sqlite:asar`, `npm test`.

## Limits and next work

The JSON backend still holds the whole database and computes in the main process.
The JSON championship adapter scans saved laps once and groups references to the
selected ones; SQLite performs the corresponding reads in its worker. Numeric
valid-lap sequences and the selected championship's scoring rows still grow with
that championship. This is not a constant-memory history algorithm.

Selected layouts may legitimately reference many large assets. The walker avoids
unrelated media; it does not impose a new size limit or strip saved widget content.
This phase does not change plugins' separately managed display data or editor,
export and server contracts that still intentionally request complete documents.

Next: migrate direct lifecycle/integration consumers, especially the Paddock
catalogue/result scheduler and resource recovery, onto the existing asynchronous
repository/write adapters. Then qualify bulk import/export, backups, restore,
shutdown/restart, cross-platform packaging and activation/recovery before making
SQLite authoritative. Legacy JSON import/conversion remains part of that rollout.
