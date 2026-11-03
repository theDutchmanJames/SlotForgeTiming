# SQLite conversion — first boundary review

3 November 2026. This checkpoint starts phase 1 of [the conversion plan](SQLITE-CONVERSION-PLAN.md).
It does not complete the storage conversion or enable migration.

## Implemented

`data-repository.js` owns application-level dispatch for database editor CRUD,
custom definitions, linked-lap counts and session saves/removals. `main.js` keeps
the same existing IPC channels and response semantics. The new `db:get` channel
returns a detached single record or null. The legacy full-list channel remains.
Paddock's local-car list projects metadata without copying photographs or signed
configurations. Existing JSON persistence and ResourceStore queues remain authoritative.

## Review findings addressed

- The first ownership check used a detached whole-car read. That would copy media
  and captures unnecessarily. It now reads only whether a Paddock link exists;
  a regression fixture throws if a photo is accessed.
- Entity validation previously accepted inherited object names such as constructor.
  The adapter now requires an own schema entry, tested for reads and legacy lists.
- Resource finalization must not accidentally fall through to ordinary save.
  Dispatch retains the existing deduplication queue and fails if it is unavailable.
- Three old tests asserted the exact main.js source spelling. Their wiring checks
  now match the adapter; new behavioural tests execute the actual registered
  handler expressions and verify delayed/rejected durability acknowledgements.

## Evidence

- Eight new Node tests cover actual IPC wiring, CRUD/custom-field reopen,
  unknown/custom data, detached reads, ownership, no unrelated media access,
  resource deduplication, failed finalization, Paddock revisions/withdrawals/source
  identity, cascade deletion and saved layout definitions.
- The hidden Electron probe loads the real main process and preload on an isolated
  appData profile. It exercises CRUD, custom values, summaries, session save/remove
  and Home rendering. `outputs/sqlite-conversion/electron-results.json` and
  `home.png` are outside the app repository. The screenshot was inspected.
- Full existing regression execution is recorded outside the repository in
  `outputs/sqlite-prototype/conversion-regression.log` (pretest plus the initial
  main-suite run) and `conversion-main-regression.log` (main-suite continuation).
  The initial main run found the old perfstats source-spelling assertion; it was
  updated. All 60 configured pretest commands and all 142 main-suite commands
  completed successfully across these runs. Seven optional external-Paddock tests
  were skipped because no Paddock source was configured; this is not a physical
  LAN verification. The final boundary tests were rerun: eight passed, none skipped.
- Syntax checks and CRLF-aware diff whitespace checks pass for this change.

The sandbox initially prevented atomic rename in disposable test folders. Running
the same tests outside that sandbox passed; no production persistence workaround
was added. Tests never opened the personal application database.

Checkpoint result: first repository/IPC slice reviewed and passing. Run
`npm.cmd run test:storage` for its focused tests and
`npm.cmd run test:storage:electron` for the isolated real-app probe. Further phase
work remains as listed below; the application still opens its existing JSON file.

## Explicit remaining work

This facade does not make JSON storage transactional or eliminate all full-state
reads. Ordinary JSON edits retain their previous failure behaviour. Paddock,
resources, import/restore, settings and resume still have direct backend paths;
these are inventoried in the plan and must be accounted for before SQLite is
authoritative. The targeted read API still scans the JSON in-memory table.

Next is the worker-backed SQLite repository and verified migration on copies,
including the settings sidecar and all domain transaction dependencies. Bounded
renderer queries, lazy asset lifetime management, negotiated network deltas and
portable backup/restore follow their own gates. No API change was made on Paddock,
no hardware/LAN performance claim is made, and no release or GitHub push occurred.
