# Timing SQLite conversion

Updated 3 November 2026. This is a staged conversion, not a completed migration.
The reviewed isolated experiment remains under `../outputs/sqlite-prototype`.
Its results measure a proposed architecture, not unchanged application startup.

Current checkpoint: production SQLite activation is available explicitly under
App Settings > General > Database storage. Existing profiles stay on JSON until
the user selects conversion. Startup verifies a separate copy before publishing
the selected generation; it never falls back to stale JSON after activation.
SQLite backup restore similarly stages a new generation and retains the old one.
See [the activation and abrupt-exit review](SQLITE-ACTIVATION-REVIEW.md).
Production startup, conversion, race recovery, finalization, restore and reopening
have passed on generated Windows profiles. The personal database was not opened
or converted. Remaining gates are platform/large-volume qualification, disk-full
and actual power-loss testing, and deciding any future rollout default.

Historical phase 1 checkpoint: the repository/IPC adapter is implemented on
the existing JSON backend. Single-record reads, media-free local-car summaries,
record/custom-field mutations and session dispatch now have an application
boundary. Full-list readers and the direct integration writers listed below still
need conversion. No production SQLite database or automatic migration is enabled.
The [first boundary review](SQLITE-CONVERSION-REVIEW.md) records tests and limits.

Phase 2 copy checkpoint: [the persistent worker and verified copy migration](SQLITE-COPY-MIGRATION.md)
are now implemented. They operate only on explicit copies and expose read-only
queries after migration. The [domain transaction checkpoint](SQLITE-TRANSACTIONS-REVIEW.md)
adds separate experimental working forks, atomic finalization/corrections/removal,
resource checkpoints, scalar custom edits, versions, receipts and a private journal.
The [write-adapter and delivery review](SQLITE-WRITE-ADAPTERS-REVIEW.md) adds typed
editor/settings/integration writes, shared deletion rules, resource recovery adapters
and an indexed delivery outbox with durable claims and acknowledgements. Working
format 2 is upgraded only on disposable working forks. These are explicit async
adapters, not a replacement for all current synchronous consumers. Direct consumers,
bulk workflows and activation/recovery remain gates; do not switch production
storage on the strength of copy tests alone.

Phase 3 catalogue checkpoint: [bounded catalogue reads and lazy pictures](SQLITE-CATALOGUE-REVIEW.md)
now serve Tracks, Drivers, Teams and the local Slotcars list. The live JSON backend
implements the same read contract as experimental SQLite working format 3. SQLite
is still not selected by the app. This was the first bounded UI group.

Phase 3 history checkpoint: [paged Results and targeted car statistics](SQLITE-HISTORY-REVIEW.md)
now use a shared JSON/SQLite read contract. Session headings and record tables are
paged, session bodies load on selection, lap times are paged, and PDF export explicitly
loads the complete selected session. Experimental working format 4 adds history
indexes. Reference pickers, Home/live aggregates, championship-wide reads and other
full-list consumers remain to migrate. JSON remains the active backend.

Phase 3 reference checkpoint: [lightweight Home and editor reference reads](SQLITE-REFERENCES-REVIEW.md)
now page metadata for tracks, drivers, cars, teams, layouts, audio sets and image
sets. Home retrieves only selected image sets and displayed car pictures, and
fetches the complete revision-checked Circuit track before starting a race. Native
selectors still contain all choices. Home history aggregates, live initialization,
championship-wide readers and lifecycle/bulk operations remain pending.

Phase 3 dashboard/startup checkpoint: [targeted Home statistics and race inputs](SQLITE-DASHBOARD-REVIEW.md)
now avoid transferring full lap history to Home and ordinary race initialization.
Home navigation requests the relevant qualifying results and selected championship.
Selected cars, primary/secondary layouts, audio and race systems load in one
revision-checked read; team rosters and record seeds remain complete. The same
contract is available through the experimental SQLite worker. Championship race
history and dynamic display dependencies remain bulk compatibility paths.

Phase 3 championship/display checkpoint: [targeted championship and display reads](SQLITE-SEASON-REVIEW.md)
now prepare championship totals without sending complete saved lap records to the
race renderer. Selected championship results retain scoring details, including
qualifying, team and class results. Layout dependencies include custom compositions,
leaderboard rows, selected image sets and team pictures, plus both screen layouts.
Live chart edits refresh only referenced designs and discard obsolete responses.
JSON remains authoritative; SQLite queries and index upgrades run on explicit copies.

Integration checkpoint: [shared delivery and resource recovery](SQLITE-INTEGRATION-REVIEW.md)
now routes production Paddock delivery through the same asynchronous delivery service
as the SQLite worker. JSON delivery claims, retry deadlines and acknowledgements are
durable. Resource recovery uses explicit JSON/SQLite backends, snapshots inputs before
queueing, and retains spending across resume, discard and finalization. Finalization
schedules delivery only after persistence; shutdown gives an in-flight acknowledgement
the existing bounded save window. Catalogue/link/capture operations, bulk workflows
and storage activation remain separate work. Personal data is still JSON.

Paddock catalogue checkpoint: [the controller/storage integration review](SQLITE-PADDOCK-REVIEW.md)
now covers pairing, catalogue/cache reads and writes, linking, archiving, exact
configuration capture, offline images and delivery status. The same controller
runs against JSON production or an explicitly supplied SQLite working-copy adapter.
Its old direct database accessors have been removed. Worker metadata pages exclude
photo bytes; selected captures retain their exact signed structure. This does not
enable automatic SQLite migration or change Paddock's network protocol.

Lifecycle checkpoint: [settings, recovery, diagnostics and shutdown](SQLITE-LIFECYCLE-REVIEW.md)
now share an asynchronous storage service. Production settings are published only
once saved; restore refreshes the settings cache. Ordinary race recovery joins
resource recovery behind the service, and verified migration sidecars are brought
into experimental SQLite working forks and their native backups. Shutdown drains
accepted work within the existing app timeout. JSON remains the active backend.
Network/full-list compatibility, activation/reopen and release qualification remain.

Compatibility checkpoint: [legacy editor reads, Content Packs and network](SQLITE-COMPATIBILITY-REVIEW.md)
now awaits repository reads through IPC and HTTP. Experimental SQLite compatibility
pages preserve full records and media, reject stale reads and fail explicitly at
size limits. Content Pack choices use names/IDs only; its bridge works without a
JSON database object. Actual-app QA used a read-only SQLite copy probe, not a full
backend switch. Production remains JSON; write composition and activation follow.

Application runtime checkpoint: [write adapters and complete startup/reopen](SQLITE-APP-REVIEW.md)
now connects editors, custom fields, sessions, lap eligibility, championship awards,
Paddock and resource recovery to SQLite without a JSON database object. A development
flag accepts only marked, separate test profiles and is refused in packaged releases.
Three actual app launches verified checkpoint/resume, finalization, persisted results
and counters, import/export and backup. Production activation and in-place SQLite
restore remain gated; the earlier restore-to-copy tooling remains available.

## Principles

A small edit must cause bounded reads, validation, writes, IPC and network work.
Changing storage alone does not accomplish that. Timing owns its local database,
race execution and outgoing results; Paddock owns its collection and host API.
The apps exchange authenticated versioned messages, never SQLite files.

- One authoritative mutation path per converted operation. Do not dual-write JSON
  and SQLite in production. Comparison runs use disposable copies.
- Related changes commit atomically. Race finalization includes sessions, laps,
  counters, resource dependencies and the durable Paddock delivery intent.
- A successful response follows persistence. Notifications follow commit.
- Preserve IDs, unknown/custom values, media representations, ordering-sensitive
  signatures, historical configurations, corrections and withdrawals.
- Capture configuration before racing; refreshing a linked car never rewrites a
  historical capture. Measured results are versioned session submissions, not
  arbitrary independent field patches.
- Existing API and file-size limits remain until their replacements are qualified.
  Do not implement unpublished Paddock change-feed routes.

## Storage design

Use a hybrid schema based on access patterns:

| Data | Intended representation |
| --- | --- |
| Core names, identities, race classes and common filters | Typed columns/indexes |
| Custom field definitions | Stable ID, entity, label, type, choices, group |
| Independently editable custom values | Owner + field ID + typed value/version |
| Laps, sessions and result deliveries | Indexed records with stable relationships |
| Images/audio | Separate assets with identity, MIME, size and hash; lazy reads |
| Widget/layout definitions and small settings | Bounded structured JSON where appropriate |
| Captured race configurations | Immutable snapshots with exact compatibility reconstruction |

Do not add a physical SQL column for every custom field or split every small
object into hundreds of rows. Benchmark alternatives with representative data.
Missing, null, empty and removed are distinct. Address list members by stable ID,
not mutable position. Label changes retain custom-field identity.

## Ordered phases and gates

### 1. Data-access boundary (first implementation)

Inventory mutation/read consumers. Introduce a shared application repository
over the current JSON backend and route database editor, custom-field and session
commands through it. Preserve existing domain rules, Paddock ownership and resource
session dispatch. Add targeted record/projection reads; retain explicit legacy
full-list adapters while migrating screens.

Gate: behavioural IPC tests, save/reopen parity, linked-car protection, resource
dispatch, failure propagation and existing regressions. Document all remaining
direct access. A facade over JSON is not yet a transactional SQLite engine.

### 2. SQLite worker and staged migration

Introduce an isolated serial writer, schema/version checks and bounded repository
queries. Commit records, versions and local delivery journal together. Migrate
copies including the separate settings file; verify exact records, original media,
custom definitions/values, hashes and references before activation. Keep the
untouched recovery source. Unsupported future versions must fail closed.

Gate: differential domain tests, migration interruption/disk-full/corruption,
duplicate identities, worker exit/shutdown, rollback between dependent writes,
same/different-field conflicts and ABA (value changed away and back). No migration
of the personal database as a test. Generic CRUD is insufficient for finalization,
resource spending, deletions/cascades or result correction.

### 3. Bounded UI and lazy media

Move consumers from whole-collection IPC to selected details, summary pages,
indexed search and revision-consistent pagination. Keep a bounded renderer cache;
discard stale responses and preserve selection, scroll and unsaved forms. Generate
thumbnails off the UI thread; originals load on demand. Asset leases cover editors,
exports, history and pending operations before any garbage collection.

Gate: real Electron first-usable-screen, memory plateau and responsiveness tests,
all themes, media round-trip, saved widgets/layouts and active-race regression.
Database open time is not first usable screen time.

### 4. Incremental integrations

Consume capability-advertised catalogue deltas/media APIs only after a concrete
Paddock handoff. Apply batches and cursor together; deduplicate retries, detect gaps,
back off and handle expired cursors explicitly. Never expose private raw journals.
Keep current endpoints and result payload/signature semantics compatible.

Gate: shared old/new API fixtures, lost acknowledgements, restart, offline edits,
database identity changes, corrections, withdrawals and physical two-PC LAN tests.
Measure actual bytes; separate field storage alone does not reduce wire payloads.

### 5. Backup, restore and release qualification

Working-copy import/export and backup/restore are reviewed in `SQLITE-BULK-REVIEW.md`.
Production activation and restart-based restore are reviewed in
`SQLITE-ACTIVATION-REVIEW.md`. Native snapshots, legacy compatibility, interrupted
conversion/restore and actual Windows startup/reopen checks are in place. This
does not complete large-volume, disk-full, power-loss or cross-platform gates.


Consistent snapshots, streamed versioned packages, staged validation and crash-safe
publication. Preserve bounded legacy JSON import/export and original recovery data.
Do not copy an active WAL database's main file alone. Retain media pinned by export.

Gate: cancellation, corruption, interrupted restore, peak disk-space/disk-full tests;
packaged Windows/macOS/Linux worker and migration probes. Explain downgrade recovery.
Only then decide storage limits and rollout defaults. No release is part of this task.

## Operation inventory and transition boundaries

| Entry point | Existing behaviour to preserve | Conversion status |
| --- | --- | --- |
| Storage selection and recovery | Keep original database; never silently open stale data | Explicit production activation and restart-based restore publish a verified generation last; cancel/retry retains sources and previous generations. No automatic conversion |
| Main-window record/custom-field IPC | Validation, linked-car ownership, cascades, save acknowledgement | Both repositories connected; selected production backend owns writes, with durable return shapes and shutdown drain |
| Session save/remove | Paddock prepare/revise/withdraw, counters, resource deduplication | Both backends connected; SQLite commits results, counters, outbox and recovery reconciliation together. Durable identities prevent replay of saved or deleted results |
| Paddock linking, cache, receipt/retry | Authentication, captured profiles, durable results and withdrawals | Shared controller and delivery service use explicit async storage adapters for all operations; production JSON and SQLite working-copy controller parity tested |
| Resource checkpoint/ledger | Serialized spending, recovery, no double spending | Shared async ResourceStore with explicit JSON/SQLite backends; production JSON, worker recovery/finalization tested on copies |
| Import/export, content packs, restore | Dependencies, IDs, complete backups and user confirmation | Both backends connected. SQLite UI restore stages and verifies a new generation on restart, retaining a native before-restore snapshot and the previous generation. Selected copies strip finalization identities; complete backups retain them |
| Settings/resume/performance | Durable settings, recovery checkpoint, shutdown waits | Both backends connected; production startup/reopen and abrupt exits tested in generated profiles. SQLite storage diagnostics and guidance are displayed. Resource ledger remains its atomic authority |
| Catalogue list screens | Local/remote ownership, names, custom columns, full edit data | Four local catalogue lists use bounded summaries and lazy pictures; JSON active, SQLite-copy parity tested |
| Results and selected-car statistics | Eligibility, complete figures, PDF, physical/virtual/team results | Paged/targeted read contract active on JSON; SQLite working-copy parity and indexes tested |
| Home and schema reference selectors | Complete choices, lane colours, classes, team membership, Virtual Rivals and selected media | Seven reference collections use paged metadata; complete selected track loads at race startup; image-from references keep legacy artwork access |
| Home statistics and ordinary race preparation | Exact card figures, qualifying selection, complete selected assets, team substitutes, record seeds | Targeted JSON/SQLite APIs active; Home uses streamed aggregate logic; ordinary races no longer receive full saved laps |
| Championship race preparation and display dependencies | Counted rounds, exact lap statistics, team/class points, custom compositions and both live screens | Targeted JSON/SQLite APIs active; championship scoring data and numeric valid-lap sequences retained; selected row/chart/image/team assets loaded |
| Other renderer/network full lists | Current screens/API responses | IPC/network await repository reads; SQLite compatibility pages provide exact full-list shapes with revision/size checks. Content Pack choices load metadata only. Large legacy readers still need targeted queries when limits are exceeded |
| Plugins | Existing settings/storage/display/rule contracts | Separate plugin storage; audit before any integration change |

The first adapter does not serialize all existing writers or roll back ordinary
JSON edits after disk failure. Those are existing backend limitations, not new
transaction guarantees. All direct consumers must be converted or explicitly
adapted before SQLite becomes authoritative.

## Measurement and review

Keep the reviewed prototype evidence unchanged. Add single-field and custom-value
workloads across increasing cars/laps/media; measure bytes transferred, touched rows,
validation time, blocking, peak memory and durable acknowledgement separately.
Include real decodable unique/duplicate media, sparse and customized records.
Use enough samples for percentile claims; report cold/warm cache and hardware.
Review each phase and record failures/fixes before claiming its gate passed.

Paddock reference: `SlotForge Slotcar Database/docs/SQLITE-SCALABILITY-PLAN.md`,
`SQLITE-TRANSACTIONS.md`, and its 3 November phase review. These are design inputs;
Timing's schema and local migration do not need to match Paddock's.
