# Paddock catalogue, linking and capture integration

3 November 2026. Production still uses JSON. SQLite tests use generated source
files, verified migrations and separate working forks. The user's existing
database was not opened or converted. No GitHub push or release was requested.

## Completed

The Paddock controller now uses explicit storage adapters for connection identity,
catalogue cache, linked-car reads and writes, archiving, selected race captures,
offline pictures and status summaries. The earlier shared delivery service remains
in use. The controller has no direct database access or legacy fixture accessors.

`paddock-storage.js` implements the JSON adapter and the SQLite repository adapter.
`sqlite-paddock-read.js` supplies worker queries; `sqlite-paddock.js` retains typed,
transactional commands and now supports public-catalogue updates and archiving.
The normal app constructs the JSON adapter. SQLite can only be supplied explicitly
to the controller by working-copy tooling; no production backend switch was added.

- Linked-car metadata is read in revision-consistent worker pages of at most 200
  rows. Single-car linking uses the remote car identity; race preparation requests
  only the selected cars. Browsing does not transfer full configurations or photos
  through the worker. Pictures load separately with stale-key and host checks.
- Signed configurations use their recorded structural shape, preserving empty
  objects, arrays, unknown fields and original embedded media. Capture snapshots
  remain immutable when the public catalogue changes later.
- Linking preserves local IDs, custom values, simulation settings and counters.
  Public catalogue changes update managed specifications/classes without replacing
  pinned race configurations. Missing cars become archived rather than deleted.
- Capture checks selected-car versions and class names again before publication.
  A stale response cannot overwrite a newer configuration or silently start with
  changed car selection. Cached offline configurations retain their original date.
- Catalogue/cache updates commit together with linked-car changes in SQLite.
  JSON rollback invalidates changed serialization entries and removes only classes
  created by that operation, preserving unrelated edits made while a save waits.
- Credentials remain memory-only. Existing polling intervals, public-revision
  optimization, pagination limits, identity checks and HTTP API remain unchanged.

## Findings fixed during review

1. Async storage introduced a possible overlap between two catalogue requests.
   The controller rechecks its operation/race guard after the storage await.
2. Worker reads initially bound an absent race-class ID to SQL. Optional classes
   are now handled without issuing that lookup.
3. SQLite byte arrays need explicit Buffer conversion before base64 encoding.
   Offline image equality tests cover the returned original content.
4. Delivery summary selection had a field-prefix length error. Controller tests
   now verify pending and sent sessions through the worker status read.
5. Reconstructing only scalar leaves drops empty objects in opaque configurations.
   Selected capture reads now reconstruct the recorded shape and restore media.
6. JSON rollback could remove a class created by another action during a failed
   save. Rollback tracks only this operation's created classes and changed values.
7. Offline picture removal could retain its old cache key. Keys now clear when
   images disappear; unsupported URLs remain hidden. Stale picture checks read
   current image metadata after awaiting the connection identity.
8. The old catalogue UI probe's 600px request was clamped by the app's minimum
   window size. The isolated probe now removes that minimum before taking the
   narrow screenshot; the actual 600px layout was checked.

## Verification

- Full **`npm test` passed**, including pretest checks and the existing application
  regressions. The final targeted/storage runs additionally cover the last review
  fixes made while the longer race simulations were running.
- **187 storage tests passed**, including 12 new Paddock adapter/controller tests.
  Coverage includes both JSON and actual SQLite workers, local-field preservation,
  public updates, archiving, stale captures, stopping during download, rollback,
  metadata pagination, exact media/configuration round trips and offline restart.
- Targeted Paddock regression run: **88 passed, 5 skipped**; five cases requiring a separate Paddock
  source checkout were skipped. Synthetic loopback hosts and the actual Timing
  HTTP client were exercised; this was not a physical two-PC LAN test.
- Packaged ASAR worker probe passed, now including controller linking, capture and
  status as well as delivery and resource recovery.
- Actual-app catalogue probe passed on an isolated generated profile with about
  **12 MB** of synthetic photos. Its initial catalogue IPC was about **14 KB**;
  only the 40 visible-page photos were requested, one at a time. Unchanged refresh
  requested no new photos and retained cards and keyboard focus. Search, pagination,
  changed pictures, selection during refresh and teardown were checked.
- Actual-app result delivery probe passed: finalized session-save IPC triggered
  automatic upload, showed Delivered, and checked a receipt without uploading again.
- Visually inspected catalogue screenshots at 1280px and a true 600px width.
  Navigation wraps, cards change to one column, and controls remain readable.
  Delivery views retain the previously verified dark/light presentation.

Logs are under `../outputs/sqlite-conversion/paddock-phase-*.log`, with detailed
worker results in `paddock-worker.log`. Catalogue screenshots and measured results
are under `../outputs/paddock-performance`; isolated helper diagnostics are under
`../outputs/sqlite-conversion/paddock-ui` and `delivery-ui`.

## Limits and next work

The current public Paddock protocol still downloads complete changed catalogue
pages, including their photos. This phase does not invent a delta or media endpoint.
The controller collects bounded worker pages into the existing complete metadata
view, and result status still returns all delivery summaries. Those are preserved
UI/API contracts, not claims of unlimited-history scalability. JSON remains a
transitional in-memory backend with its existing whole-file persistence costs.

Bulk import/export, backup/restore and remaining direct settings/lifecycle/network
consumers still need conversion or explicit compatibility adapters. Crash-safe
activation and downgrade recovery, plus cross-platform release qualification, are
still gates before converting the personal database. The source JSON stays intact.
