# Paddock connection performance repair

Timing-side investigation, 1 November 2026. The reported symptom was a brief whole-window freeze during database access and result delivery.

## Causes and repairs

- Every Paddock commit previously called `Database.touchAll()`. Even a small receipt update re-serialized unrelated pictures and race history on Electron's main thread. The client now invalidates only changed car or session rows. Top-level connection, catalogue and withdrawal state remains included in every save.
- Catalogue refresh used JSON round trips to copy linked cars for rollback. Shallow snapshots now retain the original immutable picture strings and capture objects; modified fields are still restored on failure. Unchanged public car fields keep their existing serialization cache.
- The browser previously received every photo and embedded visible base64 strings into HTML again whenever busy state or a polling result changed. The renderer now receives small metadata records and requests individual pictures from Timing's existing cache for the current page. These are local IPC requests, not extra Paddock network requests. One picture is loaded at a time, with time for input between requests. Unchanged checks keep the same DOM and decoded images.
- Connection controls previously fetched all local car photos to populate text-only selectors. They now request only the necessary identifiers and names. Their catalogue is paginated in groups of 40, and search covers the entire list.
- HTTP responses already count received bytes. Collection-limit checks now reuse this count instead of serializing each photo-heavy response again just to measure it.

## Safeguards retained

Results are still saved before upload, receipts are persisted, corrections and withdrawals retain their identities, and network failures keep results queued. Incomplete catalogue downloads never replace a complete cache. Offline configurations, class filtering, archived-car restrictions, authentication backoff and the 30-second refresh gate remain in place. No database format or Paddock public API change is required.

## Reproduction and verification

Run from the Timing source directory:

```powershell
node tools/qa/paddock-serialization.cjs
npm.cmd run test:paddock
npx.cmd electron tools/qa/paddock-performance-electron.cjs
```

The serialization benchmark uses 80 MiB of synthetic photo strings and 20,000 laps without opening any user files. The initial measurement reduced main-thread serialization from about 95 ms to 3 ms. This measures serialization, not total disk or network time; results vary by machine.

The actual Electron check uses 90 artificial pictures (about 12 MB total). Its catalogue IPC response was about 14 KB, with only the visible 40 pictures loaded separately. An unchanged refresh fetched no pictures and retained the same card/image nodes. No renderer long tasks over 50 ms were observed during initial browsing in that run. It also checks pagination, search, photo replacement, narrow-screen layout, connection controls and cancellation when the browser closes.

The Paddock regression suite includes cache-reuse, persisted receipts and withdrawals, stale-photo rejection, offline pictures, changed-car invalidation and failed-save rollback tests. Existing actual-app checks cover connection errors, car selection, live race capture and result delivery. These isolated tests complement, rather than replace, testing the updated builds on the user's two PCs.
