# Paddock incremental catalogue — phase 1 review

Reviewed 3 November 2026 against the local Paddock `integration-handoff/scalable-v1` contract and its production SQLite/public API implementation.

## Implemented

- Negotiate the optional `scalable-v1` capability through the existing authenticated status request. Hosts without it retain the original protocol; an unsaved Paddock collection also falls back to that protocol.
- Download metadata in snapshot-bound pages. Subsequent 30-second browser checks request durable car invalidations/removals. Expired cursors, restored database epochs and configuration-dependency resets rebuild the metadata catalogue.
- Publish the applied cursor and linked-car changes in the same JSON/SQLite operation. A failed download or failed transaction preserves the previous complete catalogue. Unchanged cursors perform no database write.
- Download visible photos separately in 256 KiB chunks, with exact offset, size, database identity and SHA-256 verification of the original UTF-8 data URI. Accept only the documented image types, public car-media paths and 12 MiB photo bound. The main-process photo cache is limited to 32 MiB.
- Keep catalogue transactions photo-free, including updates to previously linked cars. Selecting/refreshing a linked car saves its verified current photo for offline use. Existing inline-photo links are upgraded without passing their saved BLOBs through catalogue IPC. A changed online photo can appear in the browser before that car is selected again; its durable offline photo updates on selection/explicit linked-car refresh.
- Refresh current linked specifications and configurations after invalidation, while preserving Timing simulation settings and historical race captures. Archived/deleted cars disappear from selectable catalogue rows, retain their local history and cannot start a new linked race.
- Preserve existing result delivery, permissions, authentication cooldowns, signed pre-race capture and offline warnings. No new connection settings are required. No private Dealership synchronization endpoints or Paddock database files are used by the application.
- Retry failed visible images on a later refresh without replacing unchanged cards or stealing focus. Update the Help guidance for incremental and legacy hosts.

## Review repairs

1. A metadata reset originally read unchanged linked photos into a large batch. Catalogue updates now preserve those assets inside storage and send metadata only.
2. The new public list includes archived cars, unlike the old list. They are now explicitly excluded from selectable rows.
3. A failed photo request could remain blank indefinitely because its image node was marked loaded. Refresh now retries missing photos.
4. Legacy links did not have a photo hash. Their saved photo is hashed once in storage so offline pictures survive upgrading protocols.
5. An old lost-acknowledgement test immediately retried a delivery despite the newer retry deadline. It now checks that deadline and exercises the explicit retry action, retaining duplicate-delivery verification.

## Validation

- 97 focused Paddock/controller/storage tests passed, including both JSON and SQLite backends, old/unsaved hosts, new public projections backed by Paddock's real SQLite code, invalidation, reset, archive/unarchive, restart, signed captures, interrupted photos, digest failures, wrong database identity, snapshot restart and transactional rollback.
- All 318 storage regression tests passed.
- Packaging checks and both Help checks passed. The new runtime module is included by the existing package file rules.
- Actual Timing/Electron app checks passed with both legacy and scalable synthetic HTTP hosts on isolated profiles. These cover negotiation, photo-free catalogue IPC, visible-page photos, serial loading, unchanged DOM/focus, search, pagination, updated names/photos, queued selection, connection dialogue and teardown.
- Screenshots inspected at 1280 and 600 px. Three columns at the wider size and one column at the narrow size fit without horizontal overflow.
- The scalable app fixture contained 11,869,195 bytes of car/photo JSON. Its catalogue IPC was 48,288 bytes, with one visible image transfer at a time and no recorded renderer long tasks during initial loading. This is a fixture measurement, not a guarantee for every machine or collection.

Evidence is under `outputs/sqlite-conversion/scalable-*.log` and `outputs/paddock-scalable/` in the parent workspace. The legacy app evidence remains under `outputs/paddock-performance/`.

## Boundaries

The existing 10,000-car limit remains. This phase does not add SSE, result-history downloads, new result fields, arbitrary custom-field synchronization or shared SQLite asset deduplication. Those are separate phases. Capability negotiation means older installed Paddock releases continue using the old protocol until they expose the extension.

Tests used generated profiles and artificial collections. Neither personal database nor the Paddock source was changed. These changes are local; no release or GitHub push was made.
